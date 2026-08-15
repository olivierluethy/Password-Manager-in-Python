import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/Dialog";
import { GeneratorPanel } from "./GeneratorPanel";

export function GeneratorDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogTitle>Password generator</DialogTitle>
        <DialogDescription>
          Every password is drawn from your device's secure random source.
        </DialogDescription>
        <div className="mt-5">
          <GeneratorPanel />
        </div>
      </DialogContent>
    </Dialog>
  );
}
