// Windows spooler access: the bytes go to the printer unchanged (datatype "RAW").

use std::ffi::c_void;
use std::ptr::{null, null_mut};

use windows_sys::core::{BOOL, PCWSTR};
use windows_sys::Win32::Foundation::{GetLastError, ERROR_INSUFFICIENT_BUFFER};
use windows_sys::Win32::Graphics::Printing::{
    ClosePrinter, EndDocPrinter, EndPagePrinter, EnumPrintersW, GetPrinterW, StartDocPrinterW,
    StartPagePrinter, WritePrinter, DOC_INFO_1W, PRINTER_ATTRIBUTE_WORK_OFFLINE,
    PRINTER_ENUM_CONNECTIONS, PRINTER_ENUM_LOCAL, PRINTER_HANDLE, PRINTER_INFO_4W, PRINTER_INFO_6,
    PRINTER_STATUS_ERROR, PRINTER_STATUS_NOT_AVAILABLE, PRINTER_STATUS_OFFLINE,
    PRINTER_STATUS_PAPER_OUT,
};

// windows-sys only exposes OpenPrinterW with the Win32_Graphics_Gdi feature (for the
// PRINTER_DEFAULTSW argument, which is always null here), so it is declared directly.
#[link(name = "winspool")]
extern "system" {
    fn OpenPrinterW(name: PCWSTR, handle: *mut PRINTER_HANDLE, defaults: *const c_void) -> BOOL;
}

const NOT_READY: u32 = PRINTER_STATUS_OFFLINE
    | PRINTER_STATUS_ERROR
    | PRINTER_STATUS_NOT_AVAILABLE
    | PRINTER_STATUS_PAPER_OUT;

fn wide(text: &str) -> Vec<u16> {
    text.encode_utf16().chain(std::iter::once(0)).collect()
}

fn last_error(message: &str) -> String {
    // SAFETY: GetLastError only reads the calling thread's error code.
    let code = unsafe { GetLastError() };
    format!("{message} ({code})")
}

/// Reads a null-terminated UTF-16 string.
///
/// # Safety
/// `ptr` must be null or point to a valid null-terminated UTF-16 string.
unsafe fn from_wide(ptr: *const u16) -> String {
    if ptr.is_null() {
        return String::new();
    }
    let mut len = 0;
    while *ptr.add(len) != 0 {
        len += 1;
    }
    String::from_utf16_lossy(std::slice::from_raw_parts(ptr, len))
}

/// A u64-backed buffer so the spooler's structs inside it are properly aligned.
fn aligned_buffer(bytes: u32) -> Vec<u64> {
    vec![0u64; (bytes as usize).div_ceil(8).max(1)]
}

pub fn list_printers() -> Result<Vec<String>, String> {
    let flags = PRINTER_ENUM_LOCAL | PRINTER_ENUM_CONNECTIONS;
    let (mut needed, mut count) = (0u32, 0u32);
    // SAFETY: first call only asks for the required buffer size.
    let ok = unsafe { EnumPrintersW(flags, null(), 4, null_mut(), 0, &mut needed, &mut count) };
    if ok == 0 {
        // SAFETY: reads the thread's last error code.
        if unsafe { GetLastError() } != ERROR_INSUFFICIENT_BUFFER {
            return Err(last_error("პრინტერების სიის მიღება ვერ მოხერხდა"));
        }
    }
    if needed == 0 {
        return Ok(Vec::new());
    }
    let mut buffer = aligned_buffer(needed);
    // SAFETY: the buffer holds at least `needed` bytes.
    let ok = unsafe {
        EnumPrintersW(
            flags,
            null(),
            4,
            buffer.as_mut_ptr().cast(),
            needed,
            &mut needed,
            &mut count,
        )
    };
    if ok == 0 {
        return Err(last_error("პრინტერების სიის მიღება ვერ მოხერხდა"));
    }
    // SAFETY: on success the buffer starts with `count` PRINTER_INFO_4W entries whose
    // strings point into the same buffer, which outlives this slice.
    let infos = unsafe {
        std::slice::from_raw_parts(buffer.as_ptr().cast::<PRINTER_INFO_4W>(), count as usize)
    };
    let mut names: Vec<String> = infos
        .iter()
        // SAFETY: pPrinterName is null or a null-terminated string inside `buffer`.
        .map(|info| unsafe { from_wide(info.pPrinterName) })
        .filter(|name| !name.is_empty())
        .collect();
    names.sort();
    names.dedup();
    Ok(names)
}

/// Closes the printer handle on every exit path.
struct Printer(PRINTER_HANDLE);

impl Drop for Printer {
    fn drop(&mut self) {
        // SAFETY: the handle came from a successful OpenPrinterW and is closed once.
        unsafe { ClosePrinter(self.0) };
    }
}

impl Printer {
    fn open(name: &str) -> Result<Self, String> {
        let name_w = wide(name);
        let mut handle = PRINTER_HANDLE { Value: null_mut() };
        // SAFETY: name_w is null-terminated and lives for the call.
        if unsafe { OpenPrinterW(name_w.as_ptr(), &mut handle, null()) } == 0 {
            return Err(last_error(&format!("პრინტერი „{name}“ ვერ მოიძებნა")));
        }
        Ok(Self(handle))
    }

    /// Reads a GetPrinterW structure; `T` must match `level`.
    fn info<T: Copy>(&self, level: u32) -> Result<T, String> {
        const MESSAGE: &str = "პრინტერის მდგომარეობის შემოწმება ვერ მოხერხდა";
        let mut needed = 0u32;
        // SAFETY: first call only asks for the required buffer size.
        unsafe { GetPrinterW(self.0, level, null_mut(), 0, &mut needed) };
        if needed == 0 {
            return Err(last_error(MESSAGE));
        }
        let mut buffer = aligned_buffer(needed);
        // SAFETY: the buffer holds at least `needed` bytes.
        if unsafe {
            GetPrinterW(
                self.0,
                level,
                buffer.as_mut_ptr().cast(),
                needed,
                &mut needed,
            )
        } == 0
        {
            return Err(last_error(MESSAGE));
        }
        // SAFETY: on success the buffer starts with the structure for `level`.
        Ok(unsafe { *buffer.as_ptr().cast::<T>() })
    }

    fn ensure_ready(&self) -> Result<(), String> {
        let status = self.info::<PRINTER_INFO_6>(6)?.dwStatus;
        let attributes = self.info::<PRINTER_INFO_4W>(4)?.Attributes;
        if status & NOT_READY != 0 || attributes & PRINTER_ATTRIBUTE_WORK_OFFLINE != 0 {
            return Err("პრინტერი გათიშულია ან მზად არ არის".into());
        }
        Ok(())
    }

    fn write_all(&self, data: &[u8]) -> Result<(), String> {
        let mut doc_name = wide("ORVIO");
        let mut datatype = wide("RAW");
        let doc = DOC_INFO_1W {
            pDocName: doc_name.as_mut_ptr(),
            pOutputFile: null_mut(),
            pDatatype: datatype.as_mut_ptr(),
        };
        // SAFETY: doc and its strings live for the call.
        if unsafe { StartDocPrinterW(self.0, 1, &doc) } == 0 {
            return Err(last_error("ბეჭდვის დაწყება ვერ მოხერხდა"));
        }
        let result = self.write_page(data);
        // SAFETY: a document was started above, so it is ended exactly once.
        let ended = unsafe { EndDocPrinter(self.0) };
        result?;
        if ended == 0 {
            return Err(last_error("ბეჭდვის დასრულება ვერ მოხერხდა"));
        }
        Ok(())
    }

    fn write_page(&self, data: &[u8]) -> Result<(), String> {
        // SAFETY: a document is open on this handle.
        if unsafe { StartPagePrinter(self.0) } == 0 {
            return Err(last_error("ბეჭდვის დაწყება ვერ მოხერხდა"));
        }
        let mut rest = data;
        while !rest.is_empty() {
            let chunk = rest.len().min(u32::MAX as usize) as u32;
            let mut written = 0u32;
            // SAFETY: `rest` holds at least `chunk` readable bytes.
            let ok = unsafe { WritePrinter(self.0, rest.as_ptr().cast(), chunk, &mut written) };
            if ok == 0 || written == 0 {
                let error = last_error("პრინტერზე მონაცემის გაგზავნა ვერ მოხერხდა");
                // SAFETY: a page is open on this handle.
                unsafe { EndPagePrinter(self.0) };
                return Err(error);
            }
            rest = &rest[written as usize..];
        }
        // SAFETY: a page is open on this handle.
        if unsafe { EndPagePrinter(self.0) } == 0 {
            return Err(last_error("ბეჭდვის დასრულება ვერ მოხერხდა"));
        }
        Ok(())
    }
}

pub fn print_raw(printer: &str, data: &[u8]) -> Result<(), String> {
    let printer = Printer::open(printer)?;
    printer.ensure_ready()?;
    printer.write_all(data)
}
