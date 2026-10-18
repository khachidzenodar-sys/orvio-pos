//! Backup files: the Save/Open dialogs are opened from Rust, so the web view
//! never sees or passes file paths.

use crate::storage::write_atomic;
use std::fs;
use std::path::{Path, PathBuf};
use tauri_plugin_dialog::{DialogExt, FilePath};

const MAX_BACKUP_BYTES: u64 = 50 * 1024 * 1024;
const FILTER_NAME: &str = "ORVIO backup";

fn to_path(file: FilePath) -> Result<PathBuf, String> {
    file.into_path()
        .map_err(|e| format!("არჩეული ფაილის მისამართი ვერ წავიკითხე ({e})"))
}

pub fn read_limited(path: &Path, limit: u64) -> Result<String, String> {
    let size = fs::metadata(path)
        .map_err(|e| format!("ფაილის გახსნა ვერ მოხერხდა ({e})"))?
        .len();
    if size > limit {
        return Err("ფაილი ძალიან დიდია და ORVIO-ს სარეზერვო ასლი არ არის".into());
    }
    let bytes = fs::read(path).map_err(|e| format!("ფაილის წაკითხვა ვერ მოხერხდა ({e})"))?;
    String::from_utf8(bytes)
        .map_err(|_| "ფაილი დაზიანებულია ან არ არის ORVIO-ს სარეზერვო ასლი".into())
}

async fn run_blocking<T: Send + 'static>(
    work: impl FnOnce() -> Result<T, String> + Send + 'static,
) -> Result<T, String> {
    tauri::async_runtime::spawn_blocking(work)
        .await
        .map_err(|e| format!("ფაილთან მუშაობა ვერ მოხერხდა ({e})"))?
}

/// Returns false when the user cancels the Save dialog.
#[tauri::command]
pub async fn backup_save(
    app: tauri::AppHandle,
    default_name: String,
    contents: String,
) -> Result<bool, String> {
    run_blocking(move || {
        let Some(file) = app
            .dialog()
            .file()
            .set_title("სარეზერვო ასლის შენახვა")
            .add_filter(FILTER_NAME, &["json"])
            .set_file_name(default_name)
            .blocking_save_file()
        else {
            return Ok(false);
        };
        write_atomic(&to_path(file)?, &contents)?;
        Ok(true)
    })
    .await
}

/// Returns None when the user cancels the Open dialog.
#[tauri::command]
pub async fn backup_open(app: tauri::AppHandle) -> Result<Option<String>, String> {
    run_blocking(move || {
        let Some(file) = app
            .dialog()
            .file()
            .set_title("აღდგენა ფაილიდან")
            .add_filter(FILTER_NAME, &["json"])
            .blocking_pick_file()
        else {
            return Ok(None);
        };
        read_limited(&to_path(file)?, MAX_BACKUP_BYTES).map(Some)
    })
    .await
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_file(name: &str, contents: &[u8]) -> PathBuf {
        let path =
            std::env::temp_dir().join(format!("orvio-backup-test-{}-{name}", std::process::id()));
        fs::write(&path, contents).unwrap();
        path
    }

    #[test]
    fn reads_text_within_limit() {
        let path = temp_file("ok", "{\"a\":\"ქართული\"}".as_bytes());
        assert_eq!(read_limited(&path, 1024).unwrap(), "{\"a\":\"ქართული\"}");
        fs::remove_file(path).unwrap();
    }

    #[test]
    fn rejects_files_over_limit() {
        let path = temp_file("big", &[b'x'; 11]);
        assert!(read_limited(&path, 10).is_err());
        fs::remove_file(path).unwrap();
    }

    #[test]
    fn rejects_invalid_utf8_and_missing_files() {
        let path = temp_file("bin", &[0xff, 0xfe, 0x00]);
        assert!(read_limited(&path, 1024).is_err());
        fs::remove_file(&path).unwrap();
        assert!(read_limited(&path, 1024).is_err());
    }
}
