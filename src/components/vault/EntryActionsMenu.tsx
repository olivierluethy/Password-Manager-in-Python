import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  ExternalLink,
  KeyRound,
  Mail,
  Pencil,
  Trash2,
  User,
} from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { useVault } from "@/store";
import type { Entry } from "@/lib/types";

/**
 * The ⋯ quick-action menu shared by entry list rows and the detail view. Copy
 * actions reuse the clipboard auto-clear behavior. Only shows actions that apply
 * to the entry (email/usernames/URL only when present).
 */
export function EntryActionsMenu({
  entry,
  onEdit,
  trigger,
  align = "end",
}: {
  entry: Entry;
  onEdit: (entry: Entry) => void;
  trigger: React.ReactNode;
  align?: "start" | "end";
}) {
  const { settings, deleteEntry } = useVault();
  const { copy, toast } = useToast();

  async function openUrl() {
    try {
      await api.openUrl(entry.url, settings?.defaultBrowser);
    } catch (e) {
      toast(errMsg(e), "danger");
    }
  }

  function confirmDelete() {
    if (
      window.confirm(
        `Delete "${entry.title || entry.url}"? This can't be undone.`,
      )
    )
      deleteEntry(entry.id);
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild onClick={(e) => e.stopPropagation()}>
        {trigger}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align={align}
          sideOffset={4}
          onClick={(e) => e.stopPropagation()}
          className="z-50 min-w-[200px] rounded-md border border-ink-600 bg-ink-700 p-1 shadow-pop"
        >
          {entry.password && (
            <Item
              icon={<KeyRound size={14} />}
              onSelect={() =>
                copy(entry.password, "Password", settings?.clipboardClearSecs)
              }
            >
              Copy password
            </Item>
          )}
          {entry.email && (
            <Item
              icon={<Mail size={14} />}
              onSelect={() => copy(entry.email, "Email")}
            >
              Copy email
            </Item>
          )}
          {entry.usernames.map((u, i) => (
            <Item
              key={i}
              icon={<User size={14} />}
              onSelect={() => copy(u, "Username")}
            >
              Copy {truncate(u)}
            </Item>
          ))}
          {entry.url && (
            <Item icon={<ExternalLink size={14} />} onSelect={openUrl}>
              Open website
            </Item>
          )}

          <DropdownMenu.Separator className="my-1 h-px bg-ink-600" />

          <Item icon={<Pencil size={14} />} onSelect={() => onEdit(entry)}>
            Edit
          </Item>
          <Item icon={<Trash2 size={14} />} danger onSelect={confirmDelete}>
            Delete
          </Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function Item({
  icon,
  children,
  onSelect,
  danger,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  onSelect: () => void;
  danger?: boolean;
}) {
  return (
    <DropdownMenu.Item
      onSelect={onSelect}
      className={
        "flex cursor-pointer items-center gap-2.5 rounded-sm px-2.5 py-1.5 text-body-sm outline-none " +
        (danger
          ? "text-[color:var(--danger)] data-[highlighted]:bg-[color:color-mix(in_srgb,var(--danger)_14%,transparent)]"
          : "text-mist-200 data-[highlighted]:bg-ink-650 data-[highlighted]:text-mist-50")
      }
    >
      <span className={danger ? "" : "text-steel-400"}>{icon}</span>
      {children}
    </DropdownMenu.Item>
  );
}

function truncate(s: string): string {
  return s.length > 22 ? s.slice(0, 21) + "…" : s;
}
