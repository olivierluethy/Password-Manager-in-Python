import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { folderPath } from "@/lib/folders";
import type { Folder } from "@/lib/types";

export function NewFolderDialog({
  open,
  parentId,
  folders,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  parentId: string | null;
  folders: Folder[];
  onOpenChange: (v: boolean) => void;
  onCreate: (name: string, parentId: string | null) => Promise<unknown>;
}) {
  const [name, setName] = useState("");
  useEffect(() => {
    if (open) setName("");
  }, [open]);

  const parent = parentId ? folderPath(folders, parentId) : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await onCreate(name.trim(), parentId);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogTitle>New folder</DialogTitle>
        {parent && (
          <p className="mt-1 text-body-sm text-steel-400">
            Inside <span className="text-mist-200">{parent}</span>
          </p>
        )}
        <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Folder name"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              Create folder
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
