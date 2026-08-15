//! Tauri command handlers — the bridge between the React frontend and the Rust
//! core. Every command locks the vault mutex, performs one operation, and returns
//! serializable data or a `TresorError` (which serializes to a plain string).

use serde::Serialize;
use tauri::{Manager, State};

use crate::analysis::{self, HealthReport, StrengthReport};
use crate::browser::{self, BrowserInfo};
use crate::error::{Result, TresorError};
use crate::generator::{self, GenOptions, GenResult};
use crate::migration::{self, Format, ImportPreview};
use crate::model::{Entry, EntryInput, Folder, Settings, VaultData};
use crate::phishing::{self, UrlVerdict};
use crate::AppState;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultStatus {
    pub exists: bool,
    pub unlocked: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub entries: Vec<Entry>,
    pub folders: Vec<Folder>,
    pub settings: Settings,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportResult {
    pub entries: usize,
    pub folders: usize,
}

// ---- lifecycle ----------------------------------------------------------

#[tauri::command]
pub fn vault_status(state: State<AppState>) -> VaultStatus {
    let vault = state.vault.lock().unwrap();
    VaultStatus {
        exists: vault.exists(),
        unlocked: vault.is_unlocked(),
    }
}

#[tauri::command]
pub fn create_vault(state: State<AppState>, master_password: String) -> Result<Snapshot> {
    let mut vault = state.vault.lock().unwrap();
    vault.create(&master_password)?;
    snapshot(&vault)
}

#[tauri::command]
pub fn unlock_vault(state: State<AppState>, master_password: String) -> Result<Snapshot> {
    let mut vault = state.vault.lock().unwrap();
    vault.unlock(&master_password)?;
    snapshot(&vault)
}

#[tauri::command]
pub fn lock_vault(state: State<AppState>) {
    let mut vault = state.vault.lock().unwrap();
    vault.lock();
}

#[tauri::command]
pub fn change_master_password(
    state: State<AppState>,
    old_password: String,
    new_password: String,
) -> Result<()> {
    let mut vault = state.vault.lock().unwrap();
    vault.change_master_password(&old_password, &new_password)
}

#[tauri::command]
pub fn get_snapshot(state: State<AppState>) -> Result<Snapshot> {
    let vault = state.vault.lock().unwrap();
    snapshot(&vault)
}

fn snapshot(vault: &crate::vault::VaultManager) -> Result<Snapshot> {
    let VaultData {
        entries,
        folders,
        settings,
    } = vault.snapshot()?;
    Ok(Snapshot {
        entries,
        folders,
        settings,
    })
}

// ---- settings -----------------------------------------------------------

#[tauri::command]
pub fn update_settings(state: State<AppState>, settings: Settings) -> Result<Settings> {
    let mut vault = state.vault.lock().unwrap();
    vault.update_settings(settings)
}

// ---- entry CRUD ---------------------------------------------------------

#[tauri::command]
pub fn create_entry(state: State<AppState>, input: EntryInput) -> Result<Entry> {
    let mut vault = state.vault.lock().unwrap();
    vault.create_entry(input)
}

#[tauri::command]
pub fn update_entry(state: State<AppState>, id: String, input: EntryInput) -> Result<Entry> {
    let mut vault = state.vault.lock().unwrap();
    vault.update_entry(&id, input)
}

#[tauri::command]
pub fn delete_entry(state: State<AppState>, id: String) -> Result<()> {
    let mut vault = state.vault.lock().unwrap();
    vault.delete_entry(&id)
}

#[tauri::command]
pub fn move_entry(state: State<AppState>, id: String, folder_id: Option<String>) -> Result<Entry> {
    let mut vault = state.vault.lock().unwrap();
    vault.move_entry(&id, folder_id)
}

#[tauri::command]
pub fn toggle_favorite(state: State<AppState>, id: String) -> Result<Entry> {
    let mut vault = state.vault.lock().unwrap();
    vault.toggle_favorite(&id)
}

// ---- folder CRUD --------------------------------------------------------

#[tauri::command]
pub fn create_folder(
    state: State<AppState>,
    name: String,
    parent_id: Option<String>,
) -> Result<Folder> {
    let mut vault = state.vault.lock().unwrap();
    vault.create_folder(name, parent_id)
}

#[tauri::command]
pub fn rename_folder(state: State<AppState>, id: String, name: String) -> Result<Folder> {
    let mut vault = state.vault.lock().unwrap();
    vault.rename_folder(&id, name)
}

#[tauri::command]
pub fn delete_folder(state: State<AppState>, id: String) -> Result<()> {
    let mut vault = state.vault.lock().unwrap();
    vault.delete_folder(&id)
}

#[tauri::command]
pub fn move_folder(
    state: State<AppState>,
    id: String,
    new_parent: Option<String>,
) -> Result<Folder> {
    let mut vault = state.vault.lock().unwrap();
    vault.move_folder(&id, new_parent)
}

// ---- generator & analysis ----------------------------------------------

#[tauri::command]
pub fn generate_password(options: GenOptions) -> GenResult {
    generator::generate(&options)
}

#[tauri::command]
pub fn analyze_password(password: String) -> StrengthReport {
    analysis::analyze(&password)
}

#[tauri::command]
pub fn vault_health(state: State<AppState>) -> Result<HealthReport> {
    let vault = state.vault.lock().unwrap();
    let entries = vault.entries()?;
    Ok(analysis::health(&entries, crate::model::now_ts()))
}

// ---- phishing / URL -----------------------------------------------------

#[tauri::command]
pub fn verify_url(app: tauri::AppHandle, url: String) -> UrlVerdict {
    let extra = user_blocklist(&app);
    phishing::verify(&url, extra.as_deref())
}

fn user_blocklist(app: &tauri::AppHandle) -> Option<String> {
    let path = app.path().app_data_dir().ok()?.join("blocklist.txt");
    std::fs::read_to_string(path).ok()
}

// ---- browsers -----------------------------------------------------------

#[tauri::command]
pub fn detect_browsers() -> Vec<BrowserInfo> {
    browser::detect()
}

#[tauri::command]
pub fn open_url(url: String, browser: Option<String>) -> Result<()> {
    let key = browser.unwrap_or_else(|| "default".into());
    browser::open(&url, &key)
}

// ---- breach check (opt-in) ---------------------------------------------

#[tauri::command]
pub async fn check_breach(state: State<'_, AppState>, password: String) -> Result<u64> {
    // Gate on the opt-in setting.
    let enabled = {
        let vault = state.vault.lock().unwrap();
        vault.settings().map(|s| s.hibp_enabled).unwrap_or(false)
    };
    if !enabled {
        return Err(TresorError::Message(
            "Breach checking is turned off. Enable it in Settings to use this feature.".into(),
        ));
    }
    crate::breach::check(&password).await
}

// ---- favicons (opt-in via the "Load website icons" setting) -------------

/// Fetch the website icon for an entry's URL, honoring the setting. Returns a
/// `data:` URL, or `null` when icons are disabled or the site has none. Cached on
/// disk so each domain is fetched at most once.
#[tauri::command]
pub async fn fetch_favicon(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    url: String,
) -> Result<Option<String>> {
    let enabled = {
        let vault = state.vault.lock().unwrap();
        vault.settings().map(|s| s.load_website_icons).unwrap_or(true)
    };
    if !enabled || url.trim().is_empty() {
        return Ok(None);
    }
    crate::favicon::fetch(&app, &url).await
}

// ---- encrypted export / import -----------------------------------------

#[tauri::command]
pub fn export_encrypted(state: State<AppState>, path: String) -> Result<()> {
    let vault = state.vault.lock().unwrap();
    vault.export_encrypted(std::path::Path::new(&path))
}

#[tauri::command]
pub fn import_encrypted(
    state: State<AppState>,
    path: String,
    master_password: String,
) -> Result<ImportResult> {
    let mut vault = state.vault.lock().unwrap();
    let data = crate::vault::VaultManager::read_encrypted_backup(
        std::path::Path::new(&path),
        &master_password,
    )?;
    let (entries, folders) = vault.merge_in(data)?;
    Ok(ImportResult { entries, folders })
}

// ---- migration CSV (plaintext, re-authenticated) ------------------------

#[tauri::command]
pub fn export_migration_csv(
    state: State<AppState>,
    format: String,
    path: String,
    master_password: String,
) -> Result<()> {
    let vault = state.vault.lock().unwrap();
    // Re-authenticate before writing plaintext secrets to disk.
    vault.verify_password(&master_password)?;
    let fmt = Format::parse(&format)?;
    let data = vault.snapshot()?;
    let csv = migration::export_csv(&data, fmt)?;
    std::fs::write(&path, csv).map_err(|e| TresorError::Io(e.to_string()))
}

#[tauri::command]
pub fn preview_import_csv(path: String, format: String) -> Result<ImportPreview> {
    let fmt = Format::parse(&format)?;
    let content = std::fs::read_to_string(&path).map_err(|e| TresorError::Io(e.to_string()))?;
    let parsed = migration::parse_csv(&content, fmt)?;
    Ok(ImportPreview {
        count: parsed.rows.len(),
        folders: parsed.folders,
    })
}

#[tauri::command]
pub fn apply_import_csv(
    state: State<AppState>,
    path: String,
    format: String,
) -> Result<ImportResult> {
    let fmt = Format::parse(&format)?;
    let content = std::fs::read_to_string(&path).map_err(|e| TresorError::Io(e.to_string()))?;
    let parsed = migration::parse_csv(&content, fmt)?;
    let folders_before: usize;
    let rows: Vec<(EntryInput, String)> = parsed
        .rows
        .into_iter()
        .map(|r| (r.entry, r.folder_path))
        .collect();
    let mut vault = state.vault.lock().unwrap();
    folders_before = vault.folders()?.len();
    let entries = vault.import_batch(rows)?;
    let folders_after = vault.folders()?.len();
    Ok(ImportResult {
        entries,
        folders: folders_after.saturating_sub(folders_before),
    })
}

// ---- window focus / lock ------------------------------------------------

#[tauri::command]
pub fn focus_window(window: tauri::Window) {
    let _ = window.set_focus();
}
