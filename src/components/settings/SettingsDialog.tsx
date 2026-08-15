import { useEffect, useState } from "react";
import { Globe, ImageIcon, KeyRound, Lock, ShieldCheck, Wifi } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import { api, errMsg } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useVault } from "@/store";
import type { BrowserInfo, Settings } from "@/lib/types";

export function SettingsDialog({
  open,
  onOpenChange,
  browsers,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  browsers: BrowserInfo[];
}) {
  const { settings, saveSettings, lock } = useVault();
  const { toast } = useToast();
  const [local, setLocal] = useState<Settings | null>(settings);
  const [showChangePw, setShowChangePw] = useState(false);

  useEffect(() => setLocal(settings), [settings, open]);
  if (!local) return null;

  function update<K extends keyof Settings>(k: K, v: Settings[K]) {
    const next = { ...local!, [k]: v };
    setLocal(next);
    saveSettings(next).catch((e) => toast(errMsg(e), "danger"));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogTitle>Settings</DialogTitle>

        <div className="mt-5 flex max-h-[68vh] flex-col gap-6 overflow-y-auto pr-1">
          {/* Appearance */}
          <Group title="Appearance">
            <Row label="Theme">
              <Segmented
                value={local.theme}
                options={[
                  { value: "system", label: "System" },
                  { value: "dark", label: "Dark" },
                  { value: "light", label: "Light" },
                ]}
                onChange={(v) => update("theme", v as Settings["theme"])}
              />
            </Row>
            <div className="flex items-start gap-3">
              <ImageIcon size={18} className="mt-0.5 shrink-0 text-steel-400" />
              <div className="flex-1">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-body text-mist-200">Load website icons</span>
                  <Switch
                    checked={local.loadWebsiteIcons}
                    onCheckedChange={(v) => update("loadWebsiteIcons", v)}
                  />
                </div>
                <p className="mt-1 text-body-sm text-steel-500">
                  Fetches each entry's favicon from its own website (a network
                  request to that site). Off falls back to a lettered avatar.
                </p>
              </div>
            </div>
          </Group>

          {/* Security */}
          <Group title="Security">
            <Row label="Vault timeout" hint="When to lock after you stop using Tresor.">
              <Select
                ariaLabel="Vault timeout"
                value={String(local.autoLockSecs)}
                onChange={(v) => update("autoLockSecs", Number(v))}
                options={[
                  { value: "-1", label: "Immediately" },
                  { value: "60", label: "1 minute" },
                  { value: "300", label: "5 minutes" },
                  { value: "900", label: "15 minutes" },
                  { value: "1800", label: "30 minutes" },
                  { value: "3600", label: "1 hour" },
                  { value: "14400", label: "4 hours" },
                  { value: "-2", label: "On app restart" },
                  { value: "0", label: "Never" },
                ]}
              />
            </Row>
            <Row label="Vault timeout action">
              <Segmented
                value={local.vaultTimeoutAction}
                options={[
                  { value: "lock", label: "Lock" },
                  { value: "logout", label: "Log out" },
                ]}
                onChange={(v) =>
                  update("vaultTimeoutAction", v as Settings["vaultTimeoutAction"])
                }
              />
            </Row>
            <Row
              label="Lock on app close"
              hint="Requires the master password again next launch."
            >
              <Switch
                checked={local.lockOnClose}
                onCheckedChange={(v) => update("lockOnClose", v)}
              />
            </Row>
            <Row label="Clear clipboard after copy">
              <Select
                ariaLabel="Clear clipboard after copy"
                value={String(local.clipboardClearSecs)}
                onChange={(v) => update("clipboardClearSecs", Number(v))}
                options={[
                  { value: "10", label: "10 seconds" },
                  { value: "20", label: "20 seconds" },
                  { value: "45", label: "45 seconds" },
                  { value: "0", label: "Never" },
                ]}
              />
            </Row>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  lock();
                }}
              >
                <Lock size={15} /> Lock now
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowChangePw(true)}
              >
                <KeyRound size={15} /> Change master password
              </Button>
            </div>
          </Group>

          {/* Browser */}
          <Group title="Opening links">
            <Row label="Default browser" hint="Used when you open an entry's website.">
              <Select
                ariaLabel="Default browser"
                value={local.defaultBrowser}
                onChange={(v) => update("defaultBrowser", v)}
                options={browsers
                  .filter((b) => b.available)
                  .map((b) => ({ value: b.key, label: b.name }))}
                icon={<Globe size={14} />}
              />
            </Row>
          </Group>

          {/* Network / HIBP */}
          <Group title="Breach checking">
            <div
              className={cn(
                "flex items-start gap-3 rounded-md border p-3",
                local.hibpEnabled ? "border-[color:var(--info)]" : "border-ink-600",
              )}
            >
              <Wifi size={18} className="mt-0.5 shrink-0 text-info" />
              <div className="flex-1">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-body text-mist-50">
                    Check passwords against Have I Been Pwned
                  </span>
                  <Switch
                    checked={local.hibpEnabled}
                    onCheckedChange={(v) => update("hibpEnabled", v)}
                  />
                </div>
                <p className="mt-1 text-body-sm text-steel-400">
                  This is the only feature that uses the internet. It sends just the
                  first 5 characters of a password's hash — never the password
                  itself. Off by default to keep Tresor fully offline.
                </p>
              </div>
            </div>
          </Group>

          <SecurityDetails />
        </div>
      </DialogContent>

      <ChangePasswordDialog open={showChangePw} onOpenChange={setShowChangePw} />
    </Dialog>
  );
}

function ChangePasswordDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { toast } = useToast();
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setOldPw("");
      setNewPw("");
      setConfirm("");
    }
  }, [open]);

  async function submit() {
    if (newPw !== confirm) {
      toast("New passwords don't match", "warning");
      return;
    }
    setBusy(true);
    try {
      await api.changeMasterPassword(oldPw, newPw);
      toast("Master password changed", "success");
      onOpenChange(false);
    } catch (e) {
      toast(errMsg(e), "danger");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogTitle>Change master password</DialogTitle>
        <div className="mt-5 flex flex-col gap-3">
          <Input
            type="password"
            placeholder="Current password"
            value={oldPw}
            onChange={(e) => setOldPw(e.target.value)}
            className="font-mono"
          />
          <Input
            type="password"
            placeholder="New password"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            className="font-mono"
          />
          <Input
            type="password"
            placeholder="Confirm new password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="font-mono"
          />
          <p className="text-body-sm text-steel-400">
            The whole vault is re-encrypted under the new password.
          </p>
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={busy || !oldPw || !newPw}>
              Change password
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SecurityDetails() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-md border border-ink-600 bg-ink-850 p-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 text-body-sm text-steel-400 hover:text-mist-50"
      >
        <ShieldCheck size={15} className="text-ok" />
        Security details
      </button>
      {open && (
        <ul className="mt-2 flex flex-col gap-1 pl-6 text-body-sm text-steel-400">
          <li>Key derivation: Argon2id (64 MiB, 3 passes)</li>
          <li>Encryption: XChaCha20-Poly1305 (AEAD)</li>
          <li>Vault stored locally; master password never saved</li>
          <li>Secrets zeroized in memory on lock</li>
        </ul>
      )}
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="font-display text-caption uppercase tracking-wider text-steel-500">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex flex-col">
        <span className="text-body text-mist-200">{label}</span>
        {hint && <span className="text-body-sm text-steel-500">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Segmented({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex gap-1 rounded-md border border-ink-600 bg-ink-850 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-sm px-3 py-1 text-body-sm transition-colors",
            value === o.value ? "bg-ink-700 text-mist-50" : "text-steel-400 hover:text-mist-50",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

