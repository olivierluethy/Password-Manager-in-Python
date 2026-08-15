import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { api } from "@/lib/api";
import type { Entry, EntryInput, Folder, Settings, Snapshot } from "@/lib/types";

type Status = "loading" | "onboarding" | "locked" | "unlocked";

interface VaultState {
  status: Status;
  entries: Entry[];
  folders: Folder[];
  settings: Settings | null;

  selectedFolderId: string | null; // null = "All items"
  selectedEntryId: string | null;

  setSelectedFolder: (id: string | null) => void;
  setSelectedEntry: (id: string | null) => void;

  createVault: (pw: string) => Promise<void>;
  unlock: (pw: string) => Promise<void>;
  lock: () => Promise<void>;

  refresh: () => Promise<void>;
  applySnapshot: (s: Snapshot) => void;

  createEntry: (input: EntryInput) => Promise<Entry>;
  updateEntry: (id: string, input: EntryInput) => Promise<Entry>;
  deleteEntry: (id: string) => Promise<void>;
  moveEntry: (id: string, folderId: string | null) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;

  createFolder: (name: string, parentId: string | null) => Promise<Folder>;
  renameFolder: (id: string, name: string) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  moveFolder: (id: string, parentId: string | null) => Promise<void>;

  saveSettings: (s: Settings) => Promise<void>;
  markActivity: () => void;
}

const Ctx = createContext<VaultState | null>(null);

export function useVault() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useVault must be used within VaultProvider");
  return ctx;
}

function applyTheme(theme: string) {
  const root = document.documentElement;
  if (theme === "dark" || theme === "light") {
    root.setAttribute("data-theme", theme);
  } else {
    root.removeAttribute("data-theme"); // system
  }
}

export function VaultProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);

  const activityRef = useRef<number>(Date.now());
  const settingsRef = useRef<Settings | null>(null);
  settingsRef.current = settings;

  const applySnapshot = useCallback((s: Snapshot) => {
    setEntries(s.entries);
    setFolders(s.folders);
    setSettings(s.settings);
    applyTheme(s.settings.theme);
  }, []);

  // Initial status probe.
  useEffect(() => {
    (async () => {
      const st = await api.vaultStatus();
      if (!st.exists) setStatus("onboarding");
      else setStatus("locked");
    })();
  }, []);

  const refresh = useCallback(async () => {
    const s = await api.getSnapshot();
    applySnapshot(s);
  }, [applySnapshot]);

  const createVault = useCallback(
    async (pw: string) => {
      const s = await api.createVault(pw);
      applySnapshot(s);
      setStatus("unlocked");
      activityRef.current = Date.now();
    },
    [applySnapshot],
  );

  const unlock = useCallback(
    async (pw: string) => {
      const s = await api.unlockVault(pw);
      applySnapshot(s);
      setStatus("unlocked");
      activityRef.current = Date.now();
    },
    [applySnapshot],
  );

  const lock = useCallback(async () => {
    await api.lockVault();
    setEntries([]);
    setFolders([]);
    setSelectedEntryId(null);
    setStatus("locked");
  }, []);

  const markActivity = useCallback(() => {
    activityRef.current = Date.now();
  }, []);

  // Auto-lock on inactivity.
  useEffect(() => {
    if (status !== "unlocked" || !settings) return;
    const timeout = settings.autoLockSecs;
    if (timeout <= 0) return;
    const iv = setInterval(() => {
      if ((Date.now() - activityRef.current) / 1000 >= timeout) {
        lock();
      }
    }, 1000);
    return () => clearInterval(iv);
  }, [status, settings, lock]);

  // Lock on window blur (if enabled).
  useEffect(() => {
    if (status !== "unlocked") return;
    let unlisten: (() => void) | undefined;
    (async () => {
      const win = getCurrentWindow();
      unlisten = await win.onFocusChanged(({ payload: focused }) => {
        if (!focused && settingsRef.current?.lockOnBlur) {
          lock();
        }
      });
    })();
    return () => unlisten?.();
  }, [status, lock]);

  // Global activity listeners.
  useEffect(() => {
    if (status !== "unlocked") return;
    const handler = () => markActivity();
    window.addEventListener("pointerdown", handler);
    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("pointerdown", handler);
      window.removeEventListener("keydown", handler);
    };
  }, [status, markActivity]);

  // ---- entry actions (optimistic-ish: refetch via returned data) --------
  const createEntry = useCallback(async (input: EntryInput) => {
    const e = await api.createEntry(input);
    setEntries((prev) => [...prev, e]);
    return e;
  }, []);

  const updateEntry = useCallback(async (id: string, input: EntryInput) => {
    const e = await api.updateEntry(id, input);
    setEntries((prev) => prev.map((x) => (x.id === id ? e : x)));
    return e;
  }, []);

  const deleteEntry = useCallback(
    async (id: string) => {
      await api.deleteEntry(id);
      setEntries((prev) => prev.filter((x) => x.id !== id));
      setSelectedEntryId((cur) => (cur === id ? null : cur));
    },
    [],
  );

  const moveEntry = useCallback(async (id: string, folderId: string | null) => {
    const e = await api.moveEntry(id, folderId);
    setEntries((prev) => prev.map((x) => (x.id === id ? e : x)));
  }, []);

  const toggleFavorite = useCallback(async (id: string) => {
    const e = await api.toggleFavorite(id);
    setEntries((prev) => prev.map((x) => (x.id === id ? e : x)));
  }, []);

  // ---- folder actions ---------------------------------------------------
  const createFolder = useCallback(
    async (name: string, parentId: string | null) => {
      const f = await api.createFolder(name, parentId);
      setFolders((prev) => [...prev, f]);
      return f;
    },
    [],
  );

  const renameFolder = useCallback(async (id: string, name: string) => {
    const f = await api.renameFolder(id, name);
    setFolders((prev) => prev.map((x) => (x.id === id ? f : x)));
  }, []);

  const deleteFolder = useCallback(
    async (id: string) => {
      await api.deleteFolder(id);
      // Re-parenting happens server-side; refetch to stay consistent.
      await refresh();
      setSelectedFolderId((cur) => (cur === id ? null : cur));
    },
    [refresh],
  );

  const moveFolder = useCallback(
    async (id: string, parentId: string | null) => {
      await api.moveFolder(id, parentId);
      await refresh();
    },
    [refresh],
  );

  const saveSettings = useCallback(async (s: Settings) => {
    const saved = await api.updateSettings(s);
    setSettings(saved);
    applyTheme(saved.theme);
  }, []);

  const value = useMemo<VaultState>(
    () => ({
      status,
      entries,
      folders,
      settings,
      selectedFolderId,
      selectedEntryId,
      setSelectedFolder: setSelectedFolderId,
      setSelectedEntry: setSelectedEntryId,
      createVault,
      unlock,
      lock,
      refresh,
      applySnapshot,
      createEntry,
      updateEntry,
      deleteEntry,
      moveEntry,
      toggleFavorite,
      createFolder,
      renameFolder,
      deleteFolder,
      moveFolder,
      saveSettings,
      markActivity,
    }),
    [
      status,
      entries,
      folders,
      settings,
      selectedFolderId,
      selectedEntryId,
      createVault,
      unlock,
      lock,
      refresh,
      applySnapshot,
      createEntry,
      updateEntry,
      deleteEntry,
      moveEntry,
      toggleFavorite,
      createFolder,
      renameFolder,
      deleteFolder,
      moveFolder,
      saveSettings,
      markActivity,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
