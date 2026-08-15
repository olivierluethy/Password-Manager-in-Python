import { useMemo } from "react";
import { Plus, Search, Star } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { rankEntries } from "@/lib/search";
import { initials, tileHue } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ENTRY_MIME } from "@/components/vault/Sidebar";
import type { Entry } from "@/lib/types";

export function EntryList({
  entries,
  query,
  onQuery,
  selectedId,
  onSelect,
  onNew,
  title,
}: {
  entries: Entry[];
  query: string;
  onQuery: (q: string) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  title: string;
}) {
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
                  onClick={() => onSelect(entry.id)}
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
  onClick,
}: {
  entry: Entry;
  active: boolean;
  onClick: () => void;
}) {
  const subtitle = entry.username || entry.email || entry.url || "No login";
  const hue = tileHue(entry.title || entry.url);
  return (
    <li>
      <button
        onClick={onClick}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData(ENTRY_MIME, entry.id);
          e.dataTransfer.effectAllowed = "move";
        }}
        className={cn(
          "flex w-full items-center gap-3 rounded-md border-l-2 px-2.5 py-2 text-left transition-colors duration-150 ease-vault",
          active
            ? "border-brass-500 bg-ink-700"
            : "border-transparent hover:bg-ink-650",
        )}
      >
        <span
          className="grid h-9 w-9 shrink-0 place-items-center rounded-sm font-display text-body-sm font-semibold"
          style={{
            background: `color-mix(in srgb, hsl(${hue} 45% 45%) 22%, var(--ink-700))`,
            color: `hsl(${hue} 60% 78%)`,
          }}
        >
          {initials(entry.title, entry.url)}
        </span>
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
