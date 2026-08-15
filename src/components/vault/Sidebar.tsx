import { useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  ChevronRight,
  FolderPlus,
  Folder as FolderIcon,
  Heart,
  LayoutGrid,
  Lock,
  MoreHorizontal,
  Settings as SettingsIcon,
  ShieldHalf,
  Wand2,
  ArrowLeftRight,
  Pencil,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { buildTree, type FolderNode } from "@/lib/folders";
import { healthColor } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useVault } from "@/store";
import type { Folder } from "@/lib/types";

export type View =
  | { type: "all" }
  | { type: "favorites" }
  | { type: "health" }
  | { type: "folder"; id: string };

const ENTRY_MIME = "application/x-tresor-entry";
const FOLDER_MIME = "application/x-tresor-folder";

export function Sidebar({
  view,
  onView,
  folders,
  counts,
  healthScore,
  onNewFolder,
  onRenameFolder,
  onOpenGenerator,
  onOpenMigrate,
  onOpenSettings,
}: {
  view: View;
  onView: (v: View) => void;
  folders: Folder[];
  counts: { all: number; favorites: number };
  healthScore: number | null;
  onNewFolder: (parentId: string | null) => void;
  onRenameFolder: (id: string, name: string) => void;
  onOpenGenerator: () => void;
  onOpenMigrate: () => void;
  onOpenSettings: () => void;
}) {
  const { lock, moveEntry, moveFolder, deleteFolder } = useVault();
  const tree = buildTree(folders);
  const [dropTarget, setDropTarget] = useState<string | "root" | null>(null);

  function handleDrop(folderId: string | null) {
    return (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDropTarget(null);
      const entryId = e.dataTransfer.getData(ENTRY_MIME);
      if (entryId) {
        moveEntry(entryId, folderId);
        return;
      }
      const folder = e.dataTransfer.getData(FOLDER_MIME);
      if (folder && folder !== folderId) {
        moveFolder(folder, folderId);
      }
    };
  }

  return (
    <aside className="flex h-full w-[248px] shrink-0 flex-col border-r border-ink-600 bg-ink-900">
      {/* Brand */}
      <div className="flex items-center justify-between px-4 py-4">
        <div className="flex items-center gap-2.5">
          <BrandMark />
          <span className="font-display text-h3 tracking-tight text-mist-50">Tresor</span>
        </div>
        <Button variant="ghost" size="iconSm" title="Lock vault (Ctrl+L)" onClick={() => lock()}>
          <Lock size={15} />
        </Button>
      </div>

      {/* Primary nav */}
      <nav className="flex flex-col gap-0.5 px-2">
        <NavItem
          icon={<LayoutGrid size={16} />}
          label="All items"
          count={counts.all}
          active={view.type === "all"}
          onClick={() => onView({ type: "all" })}
          onDrop={handleDrop(null)}
          onDragOver={(e) => {
            e.preventDefault();
            setDropTarget("root");
          }}
          onDragLeave={() => setDropTarget(null)}
          dropActive={dropTarget === "root"}
        />
        <NavItem
          icon={<Heart size={16} />}
          label="Favorites"
          count={counts.favorites}
          active={view.type === "favorites"}
          onClick={() => onView({ type: "favorites" })}
        />
        <NavItem
          icon={<ShieldHalf size={16} />}
          label="Vault health"
          active={view.type === "health"}
          onClick={() => onView({ type: "health" })}
          trailing={
            healthScore !== null ? (
              <span
                className="font-mono text-body-sm"
                style={{ color: healthColor(healthScore) }}
              >
                {healthScore}
              </span>
            ) : undefined
          }
        />
      </nav>

      {/* Folders */}
      <div className="mt-5 flex items-center justify-between px-4 pb-1">
        <span className="font-display text-caption uppercase tracking-wider text-steel-500">
          Folders
        </span>
        <button
          onClick={() => onNewFolder(null)}
          className="grid h-6 w-6 place-items-center rounded-sm text-steel-400 hover:bg-ink-700 hover:text-mist-50"
          title="New folder"
        >
          <FolderPlus size={14} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-2">
        {tree.length === 0 ? (
          <p className="px-2 py-2 text-body-sm text-steel-500">
            No folders yet. Create one to organize entries.
          </p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {tree.map((node) => (
              <FolderRow
                key={node.id}
                node={node}
                view={view}
                onView={onView}
                onNewChild={onNewFolder}
                onRename={onRenameFolder}
                onDelete={deleteFolder}
                onDropFolder={handleDrop}
                dropTarget={dropTarget}
                setDropTarget={setDropTarget}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Footer actions */}
      <div className="flex flex-col gap-0.5 border-t border-ink-600 p-2">
        <FooterItem icon={<Wand2 size={16} />} label="Password generator" onClick={onOpenGenerator} />
        <FooterItem icon={<ArrowLeftRight size={16} />} label="Import & export" onClick={onOpenMigrate} />
        <FooterItem icon={<SettingsIcon size={16} />} label="Settings" onClick={onOpenSettings} />
      </div>
    </aside>
  );
}

function BrandMark() {
  return (
    <span className="grid h-7 w-7 place-items-center rounded-md bg-ink-800">
      <span className="grid h-4 w-4 place-items-center rounded-full border-2 border-brass-500">
        <span className="h-1.5 w-1.5 rounded-full bg-brass-500" />
      </span>
    </span>
  );
}

function NavItem({
  icon,
  label,
  count,
  active,
  onClick,
  trailing,
  onDrop,
  onDragOver,
  onDragLeave,
  dropActive,
}: {
  icon: React.ReactNode;
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
  trailing?: React.ReactNode;
  onDrop?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: () => void;
  dropActive?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-body transition-colors duration-150 ease-vault",
        active ? "bg-ink-700 text-mist-50" : "text-steel-400 hover:bg-ink-700 hover:text-mist-50",
        dropActive && "ring-1 ring-brass-500",
      )}
    >
      <span className={active ? "text-brass-500" : ""}>{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {trailing ?? (count !== undefined && count > 0 && (
        <span className="font-mono text-body-sm text-steel-500">{count}</span>
      ))}
    </button>
  );
}

function FolderRow({
  node,
  view,
  onView,
  onNewChild,
  onRename,
  onDelete,
  onDropFolder,
  dropTarget,
  setDropTarget,
}: {
  node: FolderNode;
  view: View;
  onView: (v: View) => void;
  onNewChild: (parentId: string | null) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onDropFolder: (folderId: string | null) => (e: React.DragEvent) => void;
  dropTarget: string | "root" | null;
  setDropTarget: (v: string | "root" | null) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const active = view.type === "folder" && view.id === node.id;
  const hasChildren = node.children.length > 0;

  return (
    <li>
      <div
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData(FOLDER_MIME, node.id);
          e.dataTransfer.effectAllowed = "move";
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDropTarget(node.id);
        }}
        onDragLeave={() => setDropTarget(null)}
        onDrop={onDropFolder(node.id)}
        onClick={() => onView({ type: "folder", id: node.id })}
        className={cn(
          "group flex cursor-pointer items-center gap-1 rounded-md py-1.5 pr-1 text-body transition-colors duration-150 ease-vault",
          active ? "bg-ink-700 text-mist-50" : "text-steel-400 hover:bg-ink-700 hover:text-mist-50",
          dropTarget === node.id && "ring-1 ring-brass-500",
        )}
        style={{ paddingLeft: `${node.depth * 12 + 6}px` }}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
          className={cn(
            "grid h-4 w-4 shrink-0 place-items-center text-steel-500",
            !hasChildren && "invisible",
          )}
        >
          <ChevronRight
            size={13}
            className={cn("transition-transform duration-150", expanded && "rotate-90")}
          />
        </button>
        <FolderIcon size={15} className={active ? "text-brass-500" : ""} />
        <span className="flex-1 truncate">{node.name}</span>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              onClick={(e) => e.stopPropagation()}
              className="grid h-6 w-6 place-items-center rounded-sm text-steel-500 opacity-0 hover:bg-ink-650 hover:text-mist-50 group-hover:opacity-100"
            >
              <MoreHorizontal size={14} />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              className="z-50 min-w-[160px] rounded-md border border-ink-600 bg-ink-700 p-1 shadow-pop"
            >
              <MenuItem onSelect={() => onNewChild(node.id)} icon={<FolderPlus size={14} />}>
                New subfolder
              </MenuItem>
              <MenuItem
                onSelect={() => {
                  const name = window.prompt("Rename folder", node.name);
                  if (name && name.trim()) onRename(node.id, name.trim());
                }}
                icon={<Pencil size={14} />}
              >
                Rename
              </MenuItem>
              <MenuItem
                danger
                onSelect={() => {
                  if (window.confirm(`Delete folder "${node.name}"? Its entries move to the parent.`))
                    onDelete(node.id);
                }}
                icon={<Trash2 size={14} />}
              >
                Delete
              </MenuItem>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
      {hasChildren && expanded && (
        <ul className="flex flex-col gap-0.5">
          {node.children.map((child) => (
            <FolderRow
              key={child.id}
              node={child}
              view={view}
              onView={onView}
              onNewChild={onNewChild}
              onRename={onRename}
              onDelete={onDelete}
              onDropFolder={onDropFolder}
              dropTarget={dropTarget}
              setDropTarget={setDropTarget}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function MenuItem({
  children,
  icon,
  onSelect,
  danger,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  onSelect: () => void;
  danger?: boolean;
}) {
  return (
    <DropdownMenu.Item
      onSelect={onSelect}
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-sm px-2.5 py-1.5 text-body-sm outline-none data-[highlighted]:bg-ink-650",
        danger ? "text-[color:var(--danger)]" : "text-mist-200 data-[highlighted]:text-mist-50",
      )}
    >
      {icon}
      {children}
    </DropdownMenu.Item>
  );
}

function FooterItem({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-body-sm text-steel-400 transition-colors duration-150 ease-vault hover:bg-ink-700 hover:text-mist-50"
    >
      {icon}
      {label}
    </button>
  );
}

export { ENTRY_MIME };
