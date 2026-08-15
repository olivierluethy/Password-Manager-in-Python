import { useEffect, useMemo, useState } from "react";
import { KeyRound } from "lucide-react";
import { Sidebar, type View } from "@/components/vault/Sidebar";
import { EntryList } from "@/components/vault/EntryList";
import { EntryDetail } from "@/components/vault/EntryDetail";
import { EntryEditor } from "@/components/vault/EntryEditor";
import { CommandPalette } from "@/components/vault/CommandPalette";
import { HealthView } from "@/components/vault/HealthView";
import { GeneratorDialog } from "@/components/generator/GeneratorDialog";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { MigrateDialog } from "@/components/migration/MigrateDialog";
import { NewFolderDialog } from "@/components/vault/NewFolderDialog";
import { api } from "@/lib/api";
import { descendantIds, folderPath } from "@/lib/folders";
import { useVault } from "@/store";
import type { BrowserInfo, Entry, EntryInput } from "@/lib/types";

export function Vault() {
  const {
    entries,
    folders,
    selectedEntryId,
    setSelectedEntry,
    createEntry,
    updateEntry,
    createFolder,
    renameFolder,
  } = useVault();

  const [view, setView] = useState<View>({ type: "all" });
  const [query, setQuery] = useState("");
  const [browsers, setBrowsers] = useState<BrowserInfo[]>([]);
  const [healthScore, setHealthScore] = useState<number | null>(null);
  const [healthKey, setHealthKey] = useState(0);

  // Dialogs
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [migrateOpen, setMigrateOpen] = useState(false);
  const [newFolder, setNewFolder] = useState<{ open: boolean; parentId: string | null }>({
    open: false,
    parentId: null,
  });

  useEffect(() => {
    api.detectBrowsers().then(setBrowsers);
  }, []);

  // Recompute health score whenever entries change.
  useEffect(() => {
    api.vaultHealth().then((r) => setHealthScore(r.score));
    setHealthKey((k) => k + 1);
  }, [entries]);

  // Global shortcuts.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const meta = e.ctrlKey || e.metaKey;
      if (meta && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
      } else if (meta && e.key.toLowerCase() === "n") {
        e.preventDefault();
        openNew();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  const currentFolderId = view.type === "folder" ? view.id : null;

  const visibleEntries = useMemo(() => {
    if (view.type === "favorites") return entries.filter((e) => e.favorite);
    if (view.type === "folder") {
      const ids = descendantIds(folders, view.id);
      return entries.filter((e) => e.folderId && ids.has(e.folderId));
    }
    return entries;
  }, [entries, folders, view]);

  const listTitle =
    view.type === "all"
      ? "All items"
      : view.type === "favorites"
        ? "Favorites"
        : view.type === "folder"
          ? folderPath(folders, view.id) || "Folder"
          : "";

  const selected = entries.find((e) => e.id === selectedEntryId) ?? null;

  function openNew() {
    setEditing(null);
    setEditorOpen(true);
  }
  function openEdit(entry: Entry) {
    setEditing(entry);
    setEditorOpen(true);
  }

  async function handleSave(input: EntryInput, id?: string) {
    if (id) {
      await updateEntry(id, input);
    } else {
      const created = await createEntry(input);
      setSelectedEntry(created.id);
    }
  }

  function jumpToEntry(id: string) {
    // Ensure the entry is visible: switch to "all" if filtered out.
    const entry = entries.find((e) => e.id === id);
    if (!entry) return;
    if (view.type !== "all") setView({ type: "all" });
    setSelectedEntry(id);
  }

  return (
    <div className="flex h-full overflow-hidden bg-ink-900">
      <Sidebar
        view={view}
        onView={(v) => {
          setView(v);
          setQuery("");
        }}
        folders={folders}
        counts={{ all: entries.length, favorites: entries.filter((e) => e.favorite).length }}
        healthScore={healthScore}
        onNewFolder={(parentId) => setNewFolder({ open: true, parentId })}
        onRenameFolder={renameFolder}
        onOpenGenerator={() => setGeneratorOpen(true)}
        onOpenMigrate={() => setMigrateOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {view.type === "health" ? (
        <div className="flex-1 overflow-hidden">
          <HealthView refreshKey={healthKey} onSelectEntry={jumpToEntry} />
        </div>
      ) : (
        <>
          <EntryList
            entries={visibleEntries}
            query={query}
            onQuery={setQuery}
            selectedId={selectedEntryId}
            onSelect={setSelectedEntry}
            onNew={openNew}
            title={listTitle}
          />
          <div className="flex-1 overflow-hidden">
            {selected ? (
              <EntryDetail entry={selected} browsers={browsers} onEdit={() => openEdit(selected)} />
            ) : (
              <EmptyDetail hasEntries={entries.length > 0} onNew={openNew} />
            )}
          </div>
        </>
      )}

      {/* Overlays */}
      <EntryEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        entry={editing}
        folders={folders}
        defaultFolderId={currentFolderId}
        onSave={handleSave}
      />
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        entries={entries}
        folders={folders}
        onSelect={jumpToEntry}
      />
      <GeneratorDialog open={generatorOpen} onOpenChange={setGeneratorOpen} />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} browsers={browsers} />
      <MigrateDialog open={migrateOpen} onOpenChange={setMigrateOpen} />
      <NewFolderDialog
        open={newFolder.open}
        parentId={newFolder.parentId}
        folders={folders}
        onOpenChange={(v) => setNewFolder((s) => ({ ...s, open: v }))}
        onCreate={(name, parentId) => createFolder(name, parentId)}
      />
    </div>
  );
}

function EmptyDetail({ hasEntries, onNew }: { hasEntries: boolean; onNew: () => void }) {
  return (
    <div className="grid h-full place-items-center p-8">
      <div className="flex max-w-xs flex-col items-center text-center">
        <div className="grid h-16 w-16 place-items-center rounded-full border border-ink-600 bg-ink-800">
          <KeyRound size={26} className="text-steel-400" />
        </div>
        <h2 className="mt-5 font-display text-h2 text-mist-50">
          {hasEntries ? "Select an entry" : "Your vault is ready"}
        </h2>
        <p className="mt-1.5 text-body-sm text-steel-400">
          {hasEntries
            ? "Choose a password on the left, or press Ctrl+K to search."
            : "Add your first password to get started."}
        </p>
        {!hasEntries && (
          <button
            onClick={onNew}
            className="mt-5 rounded-md bg-brass-500 px-4 py-2 text-body font-semibold text-[#12100a] transition-colors hover:bg-brass-400"
          >
            Add a password
          </button>
        )}
      </div>
    </div>
  );
}
