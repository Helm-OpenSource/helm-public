import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl text-sm font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]",
  {
    variants: {
      variant: {
        default:
          "theme-primary-action !text-[color:var(--accent-foreground)] shadow-[0_14px_30px_-18px_rgba(25,70,80,0.65)] hover:-translate-y-0.5 hover:brightness-95 [&_svg]:text-current",
        secondary:
          "bg-[color:color-mix(in_oklab,var(--surface)_82%,white_18%)] text-[color:var(--foreground)] ring-1 ring-[color:var(--border)] hover:bg-[color:var(--surface-subtle)]",
        ghost: "text-[color:var(--foreground)] hover:bg-[color:var(--surface-subtle)]",
        outline:
          "bg-transparent text-[color:var(--foreground)] ring-1 ring-[color:var(--border)] hover:bg-[color:var(--surface-subtle)]",
        danger:
          "bg-[color:var(--accent-danger)] text-white hover:brightness-95",
      },
      size: {
        sm: "h-9 px-3.5",
        default: "h-10 px-4.5",
        lg: "h-11 px-5.5",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
