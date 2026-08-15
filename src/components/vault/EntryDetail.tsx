import { useEffect, useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  ChevronDown,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  Pencil,
  MoreHorizontal,
  ShieldAlert,
  ShieldCheck,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EntryActionsMenu } from "@/components/vault/EntryActionsMenu";
import { Favicon } from "@/components/vault/Favicon";
import { useToast } from "@/components/ui/Toast";
import { api, errMsg } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { folderPath } from "@/lib/folders";
import { cn } from "@/lib/utils";
import { useVault } from "@/store";
import type { BrowserInfo, Entry, UrlVerdict } from "@/lib/types";

export function EntryDetail({
  entry,
  browsers,
  onEdit,
}: {
  entry: Entry;
  browsers: BrowserInfo[];
  onEdit: () => void;
}) {
  const { folders, settings, toggleFavorite } = useVault();
  const { copy, toast } = useToast();
  const [showPw, setShowPw] = useState(false);
  const [verdict, setVerdict] = useState<UrlVerdict | null>(null);
  const [breach, setBreach] = useState<number | null>(null);
  const [checkingBreach, setCheckingBreach] = useState(false);

  useEffect(() => {
    setShowPw(false);
    setBreach(null);
    if (entry.url.trim()) api.verifyUrl(entry.url).then(setVerdict);
    else setVerdict(null);
  }, [entry.id, entry.url]);

  const path = folderPath(folders, entry.folderId);
  const avail = browsers.filter((b) => b.available);

  async function open(browser?: string) {
    try {
      // Warn on dangerous URLs before opening.
      if (verdict && verdict.level === "danger") {
        const ok = window.confirm(
          `This address was flagged as dangerous:\n\n${verdict.warnings.join("\n")}\n\nOpen it anyway?`,
        );
        if (!ok) return;
      }
      await api.openUrl(entry.url, browser ?? settings?.defaultBrowser);
    } catch (e) {
      toast(errMsg(e), "danger");
    }
  }

  async function runBreachCheck() {
    setCheckingBreach(true);
    try {
      const count = await api.checkBreach(entry.password);
      setBreach(count);
      if (count === 0) toast("Not found in known breaches", "success");
    } catch (e) {
      toast(errMsg(e), "danger");
    } finally {
      setCheckingBreach(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-start gap-4 border-b border-ink-600 p-6">
        <Favicon
          title={entry.title}
          url={entry.url}
          enabled={settings?.loadWebsiteIcons ?? true}
          className="h-12 w-12 rounded-md text-h3"
        />
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-h2 text-mist-50">
            {entry.title || entry.url || "Untitled"}
          </h2>
          {path && <p className="mt-0.5 text-body-sm text-steel-400">{path}</p>}
        </div>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            title={entry.favorite ? "Unfavorite" : "Favorite"}
            onClick={() => toggleFavorite(entry.id)}
          >
            <Star
              size={17}
              className={entry.favorite ? "fill-brass-500 text-brass-500" : "text-steel-400"}
            />
          </Button>
          <Button variant="ghost" size="icon" title="Edit" onClick={onEdit}>
            <Pencil size={16} />
          </Button>
          <EntryActionsMenu
            entry={entry}
            onEdit={() => onEdit()}
            trigger={
              <Button variant="ghost" size="icon" title="More actions">
                <MoreHorizontal size={17} />
              </Button>
            }
          />
        </div>
      </div>

      {/* Fields */}
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-6">
        {entry.url && (
          <div className="flex flex-col gap-1.5">
            <FieldLabel>Website</FieldLabel>
            <div className="flex items-center gap-2">
              <div className="flex h-10 min-w-0 flex-1 items-center rounded-sm border border-ink-600 bg-ink-800 px-3">
                <span data-selectable className="truncate font-mono text-body-sm text-mist-50">
                  {entry.url}
                </span>
                {verdict && (
                  <span className="ml-auto pl-2">
                    {verdict.level === "ok" ? (
                      <ShieldCheck size={15} className="text-ok" />
                    ) : (
                      <ShieldAlert
                        size={15}
                        style={{ color: verdict.level === "danger" ? "var(--danger)" : "var(--warn)" }}
                      />
                    )}
                  </span>
                )}
              </div>
              <div className="flex">
                <Button
                  variant="secondary"
                  className="rounded-r-none"
                  onClick={() => open()}
                >
                  <ExternalLink size={15} /> Open
                </Button>
                {avail.length > 1 && (
                  <DropdownMenu.Root>
                    <DropdownMenu.Trigger asChild>
                      <Button variant="secondary" size="icon" className="rounded-l-none border-l-0">
                        <ChevronDown size={15} />
                      </Button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Portal>
                      <DropdownMenu.Content
                        align="end"
                        sideOffset={4}
                        className="z-50 min-w-[180px] rounded-md border border-ink-600 bg-ink-700 p-1 shadow-pop"
                      >
                        {avail.map((b) => (
                          <DropdownMenu.Item
                            key={b.key}
                            onSelect={() => open(b.key)}
                            className="cursor-pointer rounded-sm px-2.5 py-1.5 text-body-sm text-mist-200 outline-none data-[highlighted]:bg-ink-650 data-[highlighted]:text-mist-50"
                          >
                            {b.name}
                          </DropdownMenu.Item>
                        ))}
                      </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                  </DropdownMenu.Root>
                )}
              </div>
            </div>
            {verdict && verdict.warnings.length > 0 && (
              <p
                className="text-body-sm"
                style={{ color: verdict.level === "danger" ? "var(--danger)" : "var(--warn)" }}
              >
                {verdict.warnings[0]}
              </p>
            )}
          </div>
        )}

        {entry.email && (
          <CopyRow label="Email" value={entry.email} onCopy={() => copy(entry.email, "Email")} />
        )}
        {entry.usernames.map((u, i) => (
          <CopyRow
            key={i}
            label={entry.usernames.length > 1 ? `Username ${i + 1}` : "Username"}
            value={u}
            onCopy={() => copy(u, "Username")}
          />
        ))}

        {entry.password && (
          <div className="flex flex-col gap-1.5">
            <FieldLabel>Password</FieldLabel>
            <div className="flex items-center gap-2">
              <div className="flex h-10 min-w-0 flex-1 items-center rounded-sm border border-ink-600 bg-ink-800 px-3">
                <span
                  data-selectable
                  className="truncate font-mono text-body text-mist-50"
                >
                  {showPw ? entry.password : "•".repeat(Math.min(20, entry.password.length))}
                </span>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setShowPw((s) => !s)} title="Reveal">
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </Button>
              <Button
                variant="secondary"
                size="icon"
                onClick={() => copy(entry.password, "Password", settings?.clipboardClearSecs)}
                title="Copy password"
              >
                <Copy size={15} />
              </Button>
            </div>
            {settings?.hibpEnabled && (
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={runBreachCheck}
                  disabled={checkingBreach}
                  className="text-info"
                >
                  {checkingBreach ? "Checking…" : "Check for breaches"}
                </Button>
                {breach !== null && (
                  <span
                    className={cn(
                      "text-body-sm",
                      breach > 0 ? "text-[color:var(--danger)]" : "text-ok",
                    )}
                  >
                    {breach > 0
                      ? `Found in ${breach.toLocaleString()} breaches — change it`
                      : "Clean"}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {entry.notes && (
          <div className="flex flex-col gap-1.5">
            <FieldLabel>Notes</FieldLabel>
            <p
              data-selectable
              className="whitespace-pre-wrap rounded-sm border border-ink-600 bg-ink-800 p-3 text-body-sm text-mist-200"
            >
              {entry.notes}
            </p>
          </div>
        )}

        <div className="mt-auto flex flex-col gap-1 border-t border-ink-600 pt-4 text-body-sm text-steel-500">
          <div className="flex justify-between gap-4">
            <span>Created</span>
            <span className="font-mono text-steel-400">
              {formatDateTime(entry.createdAt)}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span>Last updated</span>
            <span className="font-mono text-steel-400">
              {formatDateTime(entry.updatedAt)}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span>Password changed</span>
            <span className="font-mono text-steel-400">
              {formatDateTime(entry.passwordUpdatedAt)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-display text-caption uppercase tracking-wider text-steel-400">
      {children}
    </span>
  );
}

function CopyRow({
  label,
  value,
  onCopy,
}: {
  label: string;
  value: string;
  onCopy: () => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel>{label}</FieldLabel>
      <div className="flex items-center gap-2">
        <div className="flex h-10 min-w-0 flex-1 items-center rounded-sm border border-ink-600 bg-ink-800 px-3">
          <span data-selectable className="truncate text-body text-mist-50">
            {value}
          </span>
        </div>
        <Button variant="secondary" size="icon" onClick={onCopy} title={`Copy ${label.toLowerCase()}`}>
          <Copy size={15} />
        </Button>
      </div>
    </div>
  );
}
