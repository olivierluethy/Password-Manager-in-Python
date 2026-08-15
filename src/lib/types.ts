// Mirrors the Rust serde types (all camelCase).

export interface Entry {
  id: string;
  title: string;
  url: string;
  email: string;
  usernames: string[];
  password: string;
  notes: string;
  folderId: string | null;
  favorite: boolean;
  createdAt: number;
  updatedAt: number;
  passwordUpdatedAt: number;
}

export interface EntryInput {
  title: string;
  url: string;
  email: string;
  usernames: string[];
  password: string;
  notes: string;
  folderId: string | null;
  favorite: boolean;
}

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  order: number;
  createdAt: number;
  updatedAt: number;
}

export interface Settings {
  /** Vault timeout: -1 = Immediately (on hide), 0 = Never, -2 = On app restart,
   *  positive = inactivity seconds. Never locks on blur/navigation/dialogs. */
  autoLockSecs: number;
  /** What the timeout does: "lock" or "logout". */
  vaultTimeoutAction: "lock" | "logout";
  /** Lock the vault when the app window is closed. */
  lockOnClose: boolean;
  clipboardClearSecs: number;
  theme: "system" | "dark" | "light";
  defaultBrowser: string;
  /** Load website favicons for entries (network request to the entry's site). */
  loadWebsiteIcons: boolean;
  hibpEnabled: boolean;
}

export interface Snapshot {
  entries: Entry[];
  folders: Folder[];
  settings: Settings;
}

export interface VaultStatus {
  exists: boolean;
  unlocked: boolean;
}

export interface StrengthReport {
  score: number; // 0..4
  guessesLog10: number;
  crackTime: string;
  warning: string | null;
  suggestions: string[];
}

export interface HealthItem {
  id: string;
  title: string;
  detail: string;
}
export interface ReuseGroup {
  ids: string[];
  titles: string[];
  count: number;
}
export interface SimilarPair {
  aId: string;
  aTitle: string;
  bId: string;
  bTitle: string;
  similarity: number;
}
export interface HealthReport {
  score: number; // 0..100
  total: number;
  withPassword: number;
  weak: HealthItem[];
  reused: ReuseGroup[];
  similar: SimilarPair[];
  stale: HealthItem[];
}

export interface GenOptions {
  mode: "chars" | "passphrase" | "pronounceable";
  length: number;
  lower: boolean;
  upper: boolean;
  digits: boolean;
  symbols: boolean;
  avoidAmbiguous: boolean;
  minNumbers: number;
  minSymbols: number;
  wordCount: number;
  separator: string;
  capitalize: boolean;
  addNumber: boolean;
}

export interface GenResult {
  password: string;
  entropyBits: number;
}

export interface BrowserInfo {
  key: string;
  name: string;
  available: boolean;
}

export type UrlLevel = "ok" | "caution" | "danger";
export interface UrlVerdict {
  level: UrlLevel;
  normalized: string;
  host: string | null;
  isHttps: boolean;
  warnings: string[];
}

export interface ImportResult {
  entries: number;
  folders: number;
}
export interface ImportPreview {
  count: number;
  folders: string[];
}

export type MigrationFormat =
  | "lastpass"
  | "dashlane"
  | "nordpass"
  | "bitwarden"
  | "1password"
  | "keepass";
