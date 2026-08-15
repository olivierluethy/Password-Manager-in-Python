import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CornerDownLeft, Search } from "lucide-react";
import { rankEntries } from "@/lib/search";
import { initials, tileHue } from "@/lib/format";
import { folderPath } from "@/lib/folders";
import { cn } from "@/lib/utils";
import type { Entry, Folder } from "@/lib/types";

export function CommandPalette({
  open,
  onOpenChange,
  entries,
  folders,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  entries: Entry[];
  folders: Folder[];
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const ranked = useMemo(() => rankEntries(entries, query).slice(0, 40), [entries, query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  useEffect(() => setActive(0), [query]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.children[active] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function choose(id: string) {
    onSelect(id);
    onOpenChange(false);
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, ranked.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const sel = ranked[active];
      if (sel) choose(sel.entry.id);
    } else if (e.key === "Escape") {
      onOpenChange(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-[90] bg-[color:var(--scrim)] backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            onClick={() => onOpenChange(false)}
          />
          <motion.div
            className="fixed left-1/2 top-[14vh] z-[91] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2"
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.2, 0, 0, 1] }}
          >
            <div className="overflow-hidden rounded-lg border border-ink-600 bg-ink-800 shadow-pop">
              <div className="flex items-center gap-3 border-b border-ink-600 px-4">
                <Search size={17} className="text-steel-400" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={onKey}
                  placeholder="Search your vault…"
                  className="h-14 flex-1 bg-transparent text-body text-mist-50 placeholder:text-steel-500 focus:outline-none"
                />
                <kbd className="rounded-sm border border-ink-600 px-1.5 py-0.5 font-mono text-body-sm text-steel-400">
                  Esc
                </kbd>
              </div>
              <ul ref={listRef} className="max-h-[52vh] overflow-y-auto p-2">
                {ranked.map(({ entry }, i) => {
                  const hue = tileHue(entry.title || entry.url);
                  const path = folderPath(folders, entry.folderId);
                  return (
                    <li
                      key={entry.id}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => choose(entry.id)}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-2",
                        i === active ? "bg-ink-700" : "",
                      )}
                    >
                      <span
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-sm font-display text-body-sm font-semibold"
                        style={{
                          background: `color-mix(in srgb, hsl(${hue} 45% 45%) 22%, var(--ink-700))`,
                          color: `hsl(${hue} 60% 78%)`,
                        }}
                      >
                        {initials(entry.title, entry.url)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-body text-mist-50">
                          {entry.title || entry.url || "Untitled"}
                        </span>
                        <span className="block truncate text-body-sm text-steel-400">
                          {entry.usernames[0] || entry.email || entry.url}
                          {path ? ` · ${path}` : ""}
                        </span>
                      </span>
                      {i === active && (
                        <CornerDownLeft size={15} className="shrink-0 text-steel-400" />
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
