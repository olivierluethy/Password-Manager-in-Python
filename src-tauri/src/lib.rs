mod analysis;
mod breach;
mod browser;
mod commands;
mod crypto;
mod error;
mod favicon;
mod generator;
mod migration;
mod model;
mod phishing;
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
        .plugin(tauri_plugin_clipboard_manager::init())
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
        .invoke_handler(tauri::generate_handler![
            commands::vault_status,
            commands::create_vault,
            commands::unlock_vault,
            commands::lock_vault,
            commands::change_master_password,
            commands::get_snapshot,
            commands::update_settings,
            commands::create_entry,
            commands::update_entry,
            commands::delete_entry,
            commands::move_entry,
            commands::toggle_favorite,
            commands::create_folder,
            commands::rename_folder,
            commands::delete_folder,
            commands::move_folder,
            commands::generate_password,
            commands::analyze_password,
            commands::vault_health,
            commands::verify_url,
            commands::detect_browsers,
            commands::open_url,
            commands::check_breach,
            commands::fetch_favicon,
            commands::export_encrypted,
            commands::import_encrypted,
            commands::export_migration_csv,
            commands::preview_import_csv,
            commands::apply_import_csv,
            commands::focus_window,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
