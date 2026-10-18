mod backup;
mod printer;
mod storage;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            storage::storage_read,
            storage::storage_write,
            backup::backup_save,
            backup::backup_open,
            printer::list_printers,
            printer::print_raw
        ])
        .run(tauri::generate_context!())
        .expect("ORVIO-ს გაშვება ვერ მოხერხდა");
}
