import { useEffect, useState } from "react";
import { Globe, KeyRound, ShieldCheck, Wifi } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
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
  const { settings, saveSettings } = useVault();
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
          </Group>

          {/* Security */}
          <Group title="Security">
            <Row label="Auto-lock after inactivity">
              <SelectBox
                value={String(local.autoLockSecs)}
                onChange={(v) => update("autoLockSecs", Number(v))}
                options={[
                  { value: "60", label: "1 minute" },
                  { value: "300", label: "5 minutes" },
                  { value: "900", label: "15 minutes" },
                  { value: "1800", label: "30 minutes" },
                  { value: "0", label: "Never" },
                ]}
              />
            </Row>
            <Row label="Lock when window loses focus" hint="Recommended for shared computers.">
              <Switch checked={local.lockOnBlur} onCheckedChange={(v) => update("lockOnBlur", v)} />
            </Row>
            <Row label="Clear clipboard after copy">
              <SelectBox
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
            <Button variant="secondary" size="sm" onClick={() => setShowChangePw(true)} className="self-start">
              <KeyRound size={15} /> Change master password
            </Button>
          </Group>

          {/* Browser */}
          <Group title="Opening links">
            <Row label="Default browser" hint="Used when you open an entry's website.">
              <SelectBox
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

function SelectBox({
  value,
  onChange,
  options,
  icon,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  icon?: React.ReactNode;
}) {
  return (
    <div className="relative flex items-center">
      {icon && <span className="pointer-events-none absolute left-2.5 text-steel-400">{icon}</span>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-9 rounded-sm border border-ink-600 bg-ink-800 pr-8 text-body-sm text-mist-50 focus-visible:border-brass-500 focus-visible:outline-none",
          icon ? "pl-8" : "pl-3",
        )}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
