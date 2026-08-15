import { useState } from "react";
import { save, open } from "@tauri-apps/plugin-dialog";
import {
  Archive,
  ArrowLeftRight,
  Download,
  TriangleAlert,
  Upload,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { api, errMsg } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useVault } from "@/store";
import type { MigrationFormat } from "@/lib/types";

const FORMATS: { key: MigrationFormat; label: string }[] = [
  { key: "bitwarden", label: "Bitwarden" },
  { key: "lastpass", label: "LastPass" },
  { key: "1password", label: "1Password" },
  { key: "dashlane", label: "Dashlane" },
  { key: "nordpass", label: "NordPass" },
  { key: "keepass", label: "KeePass" },
];

export function MigrateDialog({
  open: isOpen,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [tab, setTab] = useState<"backup" | "migrate">("backup");
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogTitle>Import &amp; export</DialogTitle>
        <div className="mt-4 flex gap-1 rounded-md border border-ink-600 bg-ink-850 p-1">
          <TabButton active={tab === "backup"} onClick={() => setTab("backup")}>
            <Archive size={15} /> Encrypted backup
          </TabButton>
          <TabButton active={tab === "migrate"} onClick={() => setTab("migrate")}>
            <ArrowLeftRight size={15} /> Migrate (CSV)
          </TabButton>
        </div>
        <div className="mt-5">{tab === "backup" ? <BackupTab /> : <MigrateTab />}</div>
      </DialogContent>
    </Dialog>
  );
}

function BackupTab() {
  const { refresh } = useVault();
  const { toast } = useToast();
  const [importPw, setImportPw] = useState("");
  const [importPath, setImportPath] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function exportBackup() {
    const path = await save({
      title: "Save encrypted backup",
      defaultPath: "tresor-backup.tresor",
      filters: [{ name: "Tresor vault", extensions: ["tresor"] }],
    });
    if (!path) return;
    setBusy(true);
    try {
      await api.exportEncrypted(path);
      toast("Encrypted backup saved", "success");
    } catch (e) {
      toast(errMsg(e), "danger");
    } finally {
      setBusy(false);
    }
  }

  async function pickImport() {
    const path = await open({
      title: "Open encrypted backup",
      multiple: false,
      filters: [{ name: "Tresor vault", extensions: ["tresor"] }],
    });
    if (typeof path === "string") setImportPath(path);
  }

  async function runImport() {
    if (!importPath) return;
    setBusy(true);
    try {
      const res = await api.importEncrypted(importPath, importPw);
      toast(`Imported ${res.entries} entries, ${res.folders} folders`, "success");
      setImportPath(null);
      setImportPw("");
      await refresh();
    } catch (e) {
      toast(errMsg(e), "danger");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <p className="text-body-sm text-steel-400">
          A <span className="font-mono text-mist-200">.tresor</span> backup is fully
          encrypted with your master password. It's the safe way to back up or move
          your vault to another machine.
        </p>
        <Button variant="secondary" onClick={exportBackup} disabled={busy} className="self-start">
          <Download size={15} /> Export encrypted backup
        </Button>
      </div>

      <div className="border-t border-ink-600 pt-4">
        <p className="mb-2 text-body-sm text-steel-400">
          Import merges a backup into this vault (existing entries are kept).
        </p>
        {!importPath ? (
          <Button variant="secondary" onClick={pickImport} disabled={busy} className="self-start">
            <Upload size={15} /> Choose backup file…
          </Button>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="truncate font-mono text-body-sm text-mist-200">{importPath}</p>
            <Input
              type="password"
              placeholder="Master password of that backup"
              value={importPw}
              onChange={(e) => setImportPw(e.target.value)}
              className="font-mono"
            />
            <div className="flex gap-2">
              <Button onClick={runImport} disabled={busy || !importPw}>
                Import
              </Button>
              <Button variant="ghost" onClick={() => setImportPath(null)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MigrateTab() {
  const { refresh } = useVault();
  const { toast } = useToast();
  const [dir, setDir] = useState<"export" | "import">("import");
  const [format, setFormat] = useState<MigrationFormat>("bitwarden");
  const [masterPw, setMasterPw] = useState("");
  const [busy, setBusy] = useState(false);

  async function runExport() {
    const path = await save({
      title: "Export migration CSV",
      defaultPath: `tresor-${format}.csv`,
      filters: [{ name: "CSV", extensions: ["csv"] }],
    });
    if (!path) return;
    setBusy(true);
    try {
      await api.exportMigrationCsv(format, path, masterPw);
      toast("Plaintext CSV exported", "warning");
      setMasterPw("");
    } catch (e) {
      toast(errMsg(e), "danger");
    } finally {
      setBusy(false);
    }
  }

  async function runImport() {
    const path = await open({
      title: "Import CSV",
      multiple: false,
      filters: [{ name: "CSV", extensions: ["csv"] }],
    });
    if (typeof path !== "string") return;
    setBusy(true);
    try {
      const preview = await api.previewImportCsv(path, format);
      if (preview.count === 0) {
        toast("No entries found — is the format right?", "warning");
        return;
      }
      const ok = window.confirm(
        `Import ${preview.count} entries${
          preview.folders.length ? ` and ${preview.folders.length} folders` : ""
        } from this ${format} CSV?`,
      );
      if (!ok) return;
      const res = await api.applyImportCsv(path, format);
      toast(`Imported ${res.entries} entries`, "success");
      await refresh();
    } catch (e) {
      toast(errMsg(e), "danger");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 rounded-md border border-ink-600 bg-ink-850 p-1">
        <TabButton active={dir === "import"} onClick={() => setDir("import")}>
          Import from
        </TabButton>
        <TabButton active={dir === "export"} onClick={() => setDir("export")}>
          Export to
        </TabButton>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {FORMATS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFormat(f.key)}
            className={cn(
              "rounded-md border px-3 py-2 text-body-sm transition-colors",
              format === f.key
                ? "border-brass-500 bg-ink-700 text-mist-50"
                : "border-ink-600 text-steel-400 hover:text-mist-50",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {dir === "export" ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-2.5 rounded-md border border-[color:var(--warn)] bg-[color:var(--warn)]/10 p-3">
            <TriangleAlert size={18} className="mt-0.5 shrink-0 text-[color:var(--warn)]" />
            <p className="text-body-sm text-mist-200">
              This writes an <b>unencrypted</b> CSV with all your passwords in plain
              text. Anyone who opens the file can read them. Delete it once you've
              finished migrating. Re-enter your master password to continue.
            </p>
          </div>
          <Input
            type="password"
            placeholder="Master password"
            value={masterPw}
            onChange={(e) => setMasterPw(e.target.value)}
            className="font-mono"
          />
          <Button variant="danger" onClick={runExport} disabled={busy || !masterPw} className="self-start">
            <Download size={15} /> Export plaintext CSV
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-body-sm text-steel-400">
            Select the CSV exported from {FORMATS.find((f) => f.key === format)?.label}.
            Its passwords are added to your encrypted vault.
          </p>
          <Button onClick={runImport} disabled={busy} className="self-start">
            <Upload size={15} /> Choose CSV file…
          </Button>
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-1.5 rounded-sm px-3 py-1.5 text-body-sm transition-colors",
        active ? "bg-ink-700 text-mist-50" : "text-steel-400 hover:text-mist-50",
      )}
    >
      {children}
    </button>
  );
}
