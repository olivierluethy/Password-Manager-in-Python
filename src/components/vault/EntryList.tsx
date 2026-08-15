import { useMemo } from "react";
import { MoreHorizontal, Plus, Search, Star } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { EntryActionsMenu } from "@/components/vault/EntryActionsMenu";
import { Favicon } from "@/components/vault/Favicon";
import { rankEntries } from "@/lib/search";
import { cn } from "@/lib/utils";
import { useVault } from "@/store";
import { ENTRY_MIME } from "@/components/vault/Sidebar";
import type { Entry } from "@/lib/types";

export function EntryList({
  entries,
  query,
  onQuery,
  selectedId,
  onSelect,
  onNew,
  onEditEntry,
  title,
}: {
  entries: Entry[];
  query: string;
  onQuery: (q: string) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onEditEntry: (entry: Entry) => void;
  title: string;
}) {
  const { settings } = useVault();
  const iconsOn = settings?.loadWebsiteIcons ?? true;
  const ranked = useMemo(() => rankEntries(entries, query), [entries, query]);
  const isNearest = query.trim() !== "" && ranked.length === 1 && ranked[0].score <= 0.34;

  return (
    <div className="flex h-full w-[340px] shrink-0 flex-col border-r border-ink-600 bg-ink-850">
      {/* Search + header */}
      <div className="flex flex-col gap-3 border-b border-ink-600 p-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="font-display text-h3 text-mist-50">{title}</h2>
          <Button size="iconSm" onClick={onNew} title="New entry (Ctrl+N)">
            <Plus size={16} />
          </Button>
        </div>
        <div className="relative">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-steel-400"
          />
          <Input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Search…"
            className="h-9 pl-9"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2">
        {ranked.length === 0 ? (
          <EmptyList onNew={onNew} />
        ) : (
          <>
            {isNearest && (
              <p className="px-2 py-1.5 text-body-sm text-steel-500">
                No exact match — closest entry:
              </p>
            )}
            <ul className="flex flex-col gap-0.5">
              {ranked.map(({ entry }) => (
                <Row
                  key={entry.id}
                  entry={entry}
                  active={entry.id === selectedId}
                  iconsOn={iconsOn}
                  onClick={() => onSelect(entry.id)}
                  onEdit={onEditEntry}
                />
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

function Row({
  entry,
  active,
  iconsOn,
  onClick,
  onEdit,
}: {
  entry: Entry;
  active: boolean;
  iconsOn: boolean;
  onClick: () => void;
  onEdit: (entry: Entry) => void;
}) {
  const subtitle =
    entry.usernames[0] || entry.email || entry.url || "No login";
  return (
    <li className="group relative">
      <button
        onClick={onClick}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData(ENTRY_MIME, entry.id);
          e.dataTransfer.effectAllowed = "move";
        }}
        className={cn(
          "flex w-full items-center gap-3 rounded-md border-l-2 py-2 pl-2.5 pr-9 text-left transition-colors duration-150 ease-vault",
          active
            ? "border-brass-500 bg-ink-700"
            : "border-transparent hover:bg-ink-650",
        )}
      >
        <Favicon
          title={entry.title}
          url={entry.url}
          enabled={iconsOn}
          className="h-9 w-9 rounded-sm text-body-sm"
        />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-body text-mist-50">
              {entry.title || entry.url || "Untitled"}
            </span>
            {entry.favorite && (
              <Star size={12} className="shrink-0 fill-brass-500 text-brass-500" />
            )}
          </span>
          <span className="block truncate text-body-sm text-steel-400">{subtitle}</span>
        </span>
      </button>
      <div className="absolute right-1 top-1/2 -translate-y-1/2">
        <EntryActionsMenu
          entry={entry}
          onEdit={onEdit}
          trigger={
            <button
              title="Quick actions"
              className="grid h-7 w-7 place-items-center rounded-sm text-steel-400 opacity-0 transition-opacity hover:bg-ink-600 hover:text-mist-50 focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100 data-[state=open]:text-mist-50"
            >
              <MoreHorizontal size={16} />
            </button>
          }
        />
      </div>
    </li>
  );
}

function EmptyList({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-body-sm text-steel-400">No entries here yet.</p>
      <Button variant="secondary" size="sm" onClick={onNew}>
        <Plus size={15} /> Add your first password
      </Button>
    </div>
  );
}
