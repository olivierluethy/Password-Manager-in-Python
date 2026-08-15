import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
  /** Optional tree depth — indents the option (used by the folder picker). */
  depth?: number;
}

/**
 * A themed select that fully respects dark/light per the styleguide — both the
 * control and its options. Built on the in-DOM Radix dropdown (not a native
 * `<select>`), so opening it never changes OS window focus and never triggers a
 * vault lock.
 */
export function Select({
  value,
  onChange,
  options,
  placeholder = "Select…",
  icon,
  className,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  placeholder?: string;
  icon?: React.ReactNode;
  className?: string;
  ariaLabel?: string;
}) {
  const current = options.find((o) => o.value === value);

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label={ariaLabel}
        className={cn(
          "flex h-10 items-center gap-2 rounded-sm border border-ink-600 bg-ink-800 px-3 text-body text-mist-50 outline-none transition-colors",
          "hover:border-steel-500 focus-visible:border-brass-500 data-[state=open]:border-brass-500",
          className,
        )}
      >
        {icon && <span className="shrink-0 text-steel-400">{icon}</span>}
        <span className={cn("truncate text-left", !current && "text-steel-500")}>
          {current ? current.label : placeholder}
        </span>
        <ChevronDown size={15} className="ml-auto shrink-0 text-steel-400" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={4}
          className="z-50 max-h-[min(320px,60vh)] min-w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto rounded-md border border-ink-600 bg-ink-700 p-1 shadow-pop"
        >
          <DropdownMenu.RadioGroup value={value} onValueChange={onChange}>
            {options.map((o) => (
              <DropdownMenu.RadioItem
                key={o.value}
                value={o.value}
                className="relative flex cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-3 text-body-sm text-mist-200 outline-none data-[highlighted]:bg-ink-650 data-[highlighted]:text-mist-50"
                style={{ paddingLeft: 32 + (o.depth ?? 0) * 14 }}
              >
                <DropdownMenu.ItemIndicator className="absolute left-2.5">
                  <Check size={14} className="text-brass-500" />
                </DropdownMenu.ItemIndicator>
                <span className="truncate">{o.label}</span>
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
