//! Local key/value storage: one JSON file per key in the app data folder.
//! Writes are atomic (tmp file + fsync + rename), so a crash or power loss
//! leaves either the old or the new content, never a half-written file.

use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use tauri::Manager;

const MAX_KEY_LEN: usize = 81;

fn valid_key(key: &str) -> bool {
    let mut chars = key.chars();
    let first_ok = matches!(chars.next(), Some(c) if c.is_ascii_lowercase() || c.is_ascii_digit());
    first_ok
        && key.len() <= MAX_KEY_LEN
        && chars.all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '.' || c == '-')
}

pub fn key_path(dir: &Path, key: &str) -> Result<PathBuf, String> {
    if !valid_key(key) {
        return Err(format!("მონაცემის არასწორი გასაღები ({key})"));
    }
    Ok(dir.join(format!("{key}.json")))
}

pub fn read_file(dir: &Path, key: &str) -> Result<Option<String>, String> {
    let path = key_path(dir, key)?;
    match fs::read_to_string(&path) {
        Ok(text) => Ok(Some(text)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(format!(
            "მონაცემების წაკითხვა კომპიუტერიდან ვერ მოხერხდა ({e})"
        )),
    }
}

pub fn write_atomic(path: &Path, contents: &str) -> Result<(), String> {
    let fail = |e: std::io::Error| format!("მონაცემების შენახვა კომპიუტერზე ვერ მოხერხდა ({e})");
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(fail)?;
    }
    let mut tmp_name = path.as_os_str().to_owned();
    tmp_name.push(".tmp");
    let tmp = PathBuf::from(tmp_name);
    let result = (|| {
        let mut file = fs::File::create(&tmp)?;
        file.write_all(contents.as_bytes())?;
        file.sync_all()?;
        drop(file);
        fs::rename(&tmp, path)
    })();
    if result.is_err() && tmp.is_file() {
        let _ = fs::remove_file(&tmp);
    }
    result.map_err(fail)
}

fn data_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|e| format!("მონაცემების საქაღალდე ვერ მოიძებნა ({e})"))
}

#[tauri::command]
pub async fn storage_read(app: tauri::AppHandle, key: String) -> Result<Option<String>, String> {
    read_file(&data_dir(&app)?, &key)
}

#[tauri::command]
pub async fn storage_write(
    app: tauri::AppHandle,
    key: String,
    value: String,
) -> Result<(), String> {
    write_atomic(&key_path(&data_dir(&app)?, &key)?, &value)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};

    fn temp_dir() -> PathBuf {
        static NEXT: AtomicUsize = AtomicUsize::new(0);
        let n = NEXT.fetch_add(1, Ordering::SeqCst);
        let dir =
            std::env::temp_dir().join(format!("orvio-storage-test-{}-{n}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        dir
    }

    fn write(dir: &Path, key: &str, value: &str) -> Result<(), String> {
        write_atomic(&key_path(dir, key)?, value)
    }

    #[test]
    fn roundtrip_and_overwrite() {
        let dir = temp_dir();
        write(&dir, "orvio.demo.v1", "{\"a\":\"ქართული ₾\"}").unwrap();
        assert_eq!(
            read_file(&dir, "orvio.demo.v1").unwrap().as_deref(),
            Some("{\"a\":\"ქართული ₾\"}")
        );
        write(&dir, "orvio.demo.v1", "second").unwrap();
        assert_eq!(
            read_file(&dir, "orvio.demo.v1").unwrap().as_deref(),
            Some("second")
        );
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn missing_key_reads_none() {
        let dir = temp_dir();
        assert_eq!(read_file(&dir, "orvio.demo.v1").unwrap(), None);
    }

    #[test]
    fn invalid_keys_are_rejected() {
        let dir = temp_dir();
        let long = "a".repeat(82);
        for key in [
            "../x",
            "A",
            "",
            ".hidden",
            "a/b",
            "a\\b",
            "x y",
            long.as_str(),
        ] {
            assert!(key_path(&dir, key).is_err(), "key {key:?} must be rejected");
            assert!(read_file(&dir, key).is_err());
        }
        assert!(key_path(&dir, &"a".repeat(81)).is_ok());
        assert!(key_path(&dir, "orvio.before-restore.20261018-120000").is_ok());
    }

    #[test]
    fn no_tmp_file_left_after_success() {
        let dir = temp_dir();
        write(&dir, "k", "v").unwrap();
        let names: Vec<_> = fs::read_dir(&dir)
            .unwrap()
            .map(|e| e.unwrap().file_name())
            .collect();
        assert_eq!(names, vec![std::ffi::OsString::from("k.json")]);
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn failed_write_keeps_previous_content() {
        let dir = temp_dir();
        write(&dir, "k", "old").unwrap();
        fs::create_dir(dir.join("k.json.tmp")).unwrap();
        assert!(write(&dir, "k", "new").is_err());
        assert_eq!(read_file(&dir, "k").unwrap().as_deref(), Some("old"));
        fs::remove_dir_all(&dir).unwrap();
    }
}
