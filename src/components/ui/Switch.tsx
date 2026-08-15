import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

export function Switch({
  checked,
  onCheckedChange,
  className,
  id,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  className?: string;
  id?: string;
}) {
  return (
    <SwitchPrimitive.Root
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      className={cn(
        "peer inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-ink-600 transition-colors duration-150 ease-vault",
        "data-[state=checked]:border-brass-500 data-[state=checked]:bg-brass-500 data-[state=unchecked]:bg-ink-700",
        "focus-visible:outline-none",
        className,
      )}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none block h-4 w-4 translate-x-1 rounded-full bg-mist-50 shadow transition-transform duration-150 ease-vault data-[state=checked]:translate-x-6 data-[state=checked]:bg-[#12100a]" />
    </SwitchPrimitive.Root>
  );
}
