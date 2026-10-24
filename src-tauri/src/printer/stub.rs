// Non-Windows builds (Linux CI and development): direct printing is unavailable.

pub fn list_printers() -> Result<Vec<String>, String> {
    Ok(Vec::new())
}

pub fn print_raw(_printer: &str, _data: &[u8]) -> Result<(), String> {
    Err("პრინტერზე პირდაპირი ბეჭდვა მხოლოდ Windows-ზეა ხელმისაწვდომი".into())
}
