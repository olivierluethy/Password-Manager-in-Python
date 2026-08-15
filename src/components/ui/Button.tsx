import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-colors duration-150 ease-vault focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 select-none",
  {
    variants: {
      variant: {
        primary:
          "bg-brass-500 text-[#12100a] hover:bg-brass-400 active:bg-brass-600 font-semibold",
        secondary:
          "border border-ink-600 bg-transparent text-mist-200 hover:bg-ink-650 hover:text-mist-50",
        ghost: "bg-transparent text-steel-400 hover:bg-ink-650 hover:text-mist-50",
        danger:
          "border border-[color:var(--danger)] bg-transparent text-[color:var(--danger)] hover:bg-[color:var(--danger)]/10",
        dangerSolid: "bg-[color:var(--danger)] text-white hover:opacity-90",
      },
      size: {
        sm: "h-8 px-3 text-body-sm",
        md: "h-10 px-4 text-body",
        lg: "h-12 px-6 text-body",
        icon: "h-9 w-9 rounded-sm",
        iconSm: "h-7 w-7 rounded-sm",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
