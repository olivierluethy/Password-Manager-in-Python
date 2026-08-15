// Typed wrappers around the Tauri command surface. One place that knows the
// command names; the rest of the app calls these functions.

import { invoke } from "@tauri-apps/api/core";
import type {
  BrowserInfo,
  Entry,
  EntryInput,
  Folder,
  GenOptions,
  GenResult,
  HealthReport,
  ImportPreview,
  ImportResult,
  MigrationFormat,
  Settings,
  Snapshot,
  StrengthReport,
  UrlVerdict,
  VaultStatus,
} from "./types";

export const api = {
  // lifecycle
  vaultStatus: () => invoke<VaultStatus>("vault_status"),
  createVault: (masterPassword: string) =>
    invoke<Snapshot>("create_vault", { masterPassword }),
  unlockVault: (masterPassword: string) =>
    invoke<Snapshot>("unlock_vault", { masterPassword }),
  lockVault: () => invoke<void>("lock_vault"),
  changeMasterPassword: (oldPassword: string, newPassword: string) =>
    invoke<void>("change_master_password", { oldPassword, newPassword }),
  getSnapshot: () => invoke<Snapshot>("get_snapshot"),

  // settings
  updateSettings: (settings: Settings) =>
    invoke<Settings>("update_settings", { settings }),

  // entries
  createEntry: (input: EntryInput) => invoke<Entry>("create_entry", { input }),
  updateEntry: (id: string, input: EntryInput) =>
    invoke<Entry>("update_entry", { id, input }),
  deleteEntry: (id: string) => invoke<void>("delete_entry", { id }),
  moveEntry: (id: string, folderId: string | null) =>
    invoke<Entry>("move_entry", { id, folderId }),
  toggleFavorite: (id: string) => invoke<Entry>("toggle_favorite", { id }),

  // folders
  createFolder: (name: string, parentId: string | null) =>
    invoke<Folder>("create_folder", { name, parentId }),
  renameFolder: (id: string, name: string) =>
    invoke<Folder>("rename_folder", { id, name }),
  deleteFolder: (id: string) => invoke<void>("delete_folder", { id }),
  moveFolder: (id: string, newParent: string | null) =>
    invoke<Folder>("move_folder", { id, newParent }),

  // generator & analysis
  generatePassword: (options: GenOptions) =>
    invoke<GenResult>("generate_password", { options }),
  analyzePassword: (password: string) =>
    invoke<StrengthReport>("analyze_password", { password }),
  vaultHealth: () => invoke<HealthReport>("vault_health"),

  // url / phishing
  verifyUrl: (url: string) => invoke<UrlVerdict>("verify_url", { url }),

  // browsers
  detectBrowsers: () => invoke<BrowserInfo[]>("detect_browsers"),
  openUrl: (url: string, browser?: string) =>
    invoke<void>("open_url", { url, browser: browser ?? null }),

  // breach (opt-in)
  checkBreach: (password: string) => invoke<number>("check_breach", { password }),

  // favicons (opt-in via load_website_icons)
  fetchFavicon: (url: string) => invoke<string | null>("fetch_favicon", { url }),

  // encrypted backup
  exportEncrypted: (path: string) => invoke<void>("export_encrypted", { path }),
  importEncrypted: (path: string, masterPassword: string) =>
    invoke<ImportResult>("import_encrypted", { path, masterPassword }),

  // migration CSV
  exportMigrationCsv: (
    format: MigrationFormat,
    path: string,
    masterPassword: string,
  ) => invoke<void>("export_migration_csv", { format, path, masterPassword }),
  previewImportCsv: (path: string, format: MigrationFormat) =>
    invoke<ImportPreview>("preview_import_csv", { path, format }),
  applyImportCsv: (path: string, format: MigrationFormat) =>
    invoke<ImportResult>("apply_import_csv", { path, format }),
};

/** Normalize a thrown Tauri error (already a string) to a message. */
export function errMsg(e: unknown): string {
  if (typeof e === "string") return e;
  if (e instanceof Error) return e.message;
  return String(e);
}
