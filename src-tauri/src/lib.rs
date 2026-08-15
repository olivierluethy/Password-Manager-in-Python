mod crypto;
mod error;
mod model;
mod storage;
mod vault;

use std::sync::Mutex;

use tauri::Manager;

use vault::VaultManager;

/// Application state: the vault manager behind a mutex.
pub struct AppState {
    pub vault: Mutex<VaultManager>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // Resolve the vault file inside the OS app-data directory.
            let dir = app
                .path()
                .app_data_dir()
                .expect("could not resolve app data dir");
            std::fs::create_dir_all(&dir).ok();
            let vault_path = dir.join("vault.tresor");
            app.manage(AppState {
                vault: Mutex::new(VaultManager::new(vault_path)),
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
