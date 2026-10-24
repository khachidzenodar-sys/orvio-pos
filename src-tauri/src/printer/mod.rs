// Thermal printing: lists Windows printers and sends raw ESC/POS bytes to one.
// The winspool calls are blocking, so they run on a blocking thread.

#[cfg(not(windows))]
#[path = "stub.rs"]
mod platform;
#[cfg(windows)]
#[path = "windows.rs"]
mod platform;

async fn run_blocking<T: Send + 'static>(
    job: impl FnOnce() -> Result<T, String> + Send + 'static,
) -> Result<T, String> {
    tauri::async_runtime::spawn_blocking(job)
        .await
        .map_err(|e| format!("ბეჭდვის ოპერაცია შეწყდა ({e})"))?
}

#[tauri::command]
pub async fn list_printers() -> Result<Vec<String>, String> {
    run_blocking(platform::list_printers).await
}

#[tauri::command]
pub async fn print_raw(printer: String, data: Vec<u8>) -> Result<(), String> {
    if printer.trim().is_empty() {
        return Err("პრინტერი არ არის არჩეული".into());
    }
    if data.is_empty() {
        return Err("დასაბეჭდი მონაცემი ცარიელია".into());
    }
    run_blocking(move || platform::print_raw(&printer, &data)).await
}
