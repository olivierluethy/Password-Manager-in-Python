import { useEffect, useMemo, useState } from "react";
import {
  Eye,
  EyeOff,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  Wand2,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input, Textarea, Field } from "@/components/ui/Input";
import { StrengthBar } from "@/components/StrengthBar";
import { GeneratorPanel } from "@/components/generator/GeneratorPanel";
import { useToast } from "@/components/ui/Toast";
import { api, errMsg } from "@/lib/api";
import { buildTree } from "@/lib/folders";
import { cn } from "@/lib/utils";
import type { Entry, EntryInput, Folder, StrengthReport, UrlVerdict } from "@/lib/types";

const EMPTY: EntryInput = {
  title: "",
  url: "",
  email: "",
  username: "",
  password: "",
  notes: "",
  folderId: null,
  favorite: false,
};

export function EntryEditor({
  open,
  onOpenChange,
  entry,
  folders,
  defaultFolderId,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  entry: Entry | null;
  folders: Folder[];
  defaultFolderId: string | null;
  onSave: (input: EntryInput, id?: string) => Promise<void>;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState<EntryInput>(EMPTY);
  const [show, setShow] = useState(false);
  const [showGen, setShowGen] = useState(false);
  const [strength, setStrength] = useState<StrengthReport | null>(null);
  const [urlVerdict, setUrlVerdict] = useState<UrlVerdict | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (entry) {
      setForm({
        title: entry.title,
        url: entry.url,
        email: entry.email,
        username: entry.username,
        password: entry.password,
        notes: entry.notes,
        folderId: entry.folderId,
        favorite: entry.favorite,
      });
    } else {
      setForm({ ...EMPTY, folderId: defaultFolderId });
    }
    setShow(false);
    setShowGen(false);
    setStrength(null);
    setUrlVerdict(null);
  }, [open, entry, defaultFolderId]);

  // Live strength (debounced).
  useEffect(() => {
    if (!form.password) {
      setStrength(null);
      return;
    }
    const t = setTimeout(() => {
      api.analyzePassword(form.password).then(setStrength);
    }, 180);
    return () => clearTimeout(t);
  }, [form.password]);

  // Live URL verification (debounced).
  useEffect(() => {
    if (!form.url.trim()) {
      setUrlVerdict(null);
      return;
    }
    const t = setTimeout(() => {
      api.verifyUrl(form.url).then(setUrlVerdict);
    }, 300);
    return () => clearTimeout(t);
  }, [form.url]);

  const set = <K extends keyof EntryInput>(k: K, v: EntryInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const folderOptions = useMemo(() => flattenFolders(folders), [folders]);

  async function save() {
    if (!form.title.trim() && !form.url.trim()) {
      toast("Add a title or website first", "warning");
      return;
    }
    setBusy(true);
    try {
      const input = { ...form };
      if (!input.title.trim()) input.title = input.url;
      await onSave(input, entry?.id);
      onOpenChange(false);
    } catch (e) {
      toast(errMsg(e), "danger");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogTitle>{entry ? "Edit entry" : "New entry"}</DialogTitle>

        <div className="mt-5 flex max-h-[65vh] flex-col gap-4 overflow-y-auto pr-1">
          <Field label="Title">
            <Input
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="e.g. GitHub"
              autoFocus
            />
          </Field>

          <Field label="Website">
            <Input
              value={form.url}
              onChange={(e) => set("url", e.target.value)}
              placeholder="https://example.com"
              className="font-mono text-body-sm"
            />
          </Field>
          {urlVerdict && urlVerdict.warnings.length > 0 && (
            <UrlWarning verdict={urlVerdict} />
          )}
          {urlVerdict && urlVerdict.level === "ok" && form.url.trim() && (
            <p className="-mt-2 flex items-center gap-1.5 text-body-sm text-ok">
              <ShieldCheck size={14} /> Address looks safe
            </p>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Field label="Email">
              <Input
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="you@example.com"
              />
            </Field>
            <Field label="Username">
              <Input
                value={form.username}
                onChange={(e) => set("username", e.target.value)}
                placeholder="username"
              />
            </Field>
          </div>

          <Field label="Password">
            <div className="relative">
              <Input
                type={show ? "text" : "password"}
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
                placeholder="Password"
                className="pr-20 font-mono"
              />
              <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 gap-0.5">
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShow((s) => !s)}
                  className="grid h-7 w-7 place-items-center rounded-sm text-steel-400 hover:text-mist-50"
                >
                  {show ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowGen((s) => !s)}
                  className={cn(
                    "grid h-7 w-7 place-items-center rounded-sm hover:text-mist-50",
                    showGen ? "text-brass-500" : "text-steel-400",
                  )}
                  title="Generate"
                >
                  <Wand2 size={15} />
                </button>
              </div>
            </div>
          </Field>

          {strength && form.password && (
            <div className="-mt-2 flex flex-col gap-2">
              <StrengthBar score={strength.score} />
              {strength.warning && (
                <p className="text-body-sm text-[color:var(--warn)]">
                  {strength.warning}
                </p>
              )}
              {strength.suggestions.length > 0 && (
                <ul className="flex flex-col gap-1">
                  {strength.suggestions.map((s, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-1.5 text-body-sm text-steel-400"
                    >
                      <Sparkles size={13} className="mt-0.5 shrink-0 text-brass-500" />
                      {s}
                    </li>
                  ))}
                </ul>
              )}
              <p className="font-mono text-body-sm text-steel-500">
                Cracks in {strength.crackTime}
              </p>
            </div>
          )}

          {showGen && (
            <div className="rounded-md border border-ink-600 bg-ink-800 p-3">
              <GeneratorPanel
                compact
                onUse={(pw) => {
                  set("password", pw);
                  setShowGen(false);
                }}
              />
            </div>
          )}

          <Field label="Folder">
            <select
              value={form.folderId ?? ""}
              onChange={(e) => set("folderId", e.target.value || null)}
              className="h-10 w-full rounded-sm border border-ink-600 bg-ink-800 px-3 text-body text-mist-50 focus-visible:border-brass-500 focus-visible:outline-none"
            >
              <option value="">No folder</option>
              {folderOptions.map((f) => (
                <option key={f.id} value={f.id}>
                  {" ".repeat(f.depth * 2)}
                  {f.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Notes">
            <Textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Anything else worth keeping…"
            />
          </Field>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy}>
            {entry ? "Save changes" : "Add entry"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function UrlWarning({ verdict }: { verdict: UrlVerdict }) {
  const danger = verdict.level === "danger";
  const color = danger ? "var(--danger)" : "var(--warn)";
  return (
    <div
      className="-mt-2 flex flex-col gap-1 rounded-sm border p-2.5"
      style={{ borderColor: color, background: `color-mix(in srgb, ${color} 8%, transparent)` }}
    >
      <span className="flex items-center gap-1.5 text-body-sm font-medium" style={{ color }}>
        {danger ? <ShieldAlert size={14} /> : <TriangleAlert size={14} />}
        {danger ? "This address looks dangerous" : "Double-check this address"}
      </span>
      {verdict.warnings.map((w, i) => (
        <span key={i} className="pl-5 text-body-sm text-steel-400">
          {w}
        </span>
      ))}
    </div>
  );
}

interface FlatFolder {
  id: string;
  name: string;
  depth: number;
}
function flattenFolders(folders: Folder[]): FlatFolder[] {
  const tree = buildTree(folders);
  const out: FlatFolder[] = [];
  const walk = (nodes: ReturnType<typeof buildTree>) => {
    for (const n of nodes) {
      out.push({ id: n.id, name: n.name, depth: n.depth });
      walk(n.children);
    }
  };
  walk(tree);
  return out;
}
