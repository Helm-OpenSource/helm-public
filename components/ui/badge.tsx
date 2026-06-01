import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex min-w-0 max-w-full items-center break-all rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
  {
    variants: {
      variant: {
        default:
          "bg-[color:color-mix(in_oklab,var(--surface-subtle)_88%,var(--accent-soft)_12%)] text-[color:var(--foreground)] ring-[color:var(--border)]",
        success:
          "bg-[color:color-mix(in_oklab,var(--surface)_82%,rgb(16,185,129)_18%)] text-[color:color-mix(in_oklab,var(--foreground)_84%,rgb(5,150,105)_16%)] ring-[color:color-mix(in_oklab,var(--border)_72%,rgb(16,185,129)_28%)]",
        warning:
          "bg-[color:color-mix(in_oklab,var(--surface)_82%,rgb(245,158,11)_18%)] text-[color:color-mix(in_oklab,var(--foreground)_84%,rgb(180,83,9)_16%)] ring-[color:color-mix(in_oklab,var(--border)_72%,rgb(245,158,11)_28%)]",
        danger:
          "bg-[color:color-mix(in_oklab,var(--surface)_82%,rgb(244,63,94)_18%)] text-[color:color-mix(in_oklab,var(--foreground)_84%,rgb(190,24,93)_16%)] ring-[color:color-mix(in_oklab,var(--border)_72%,rgb(244,63,94)_28%)]",
        info:
          "bg-[color:color-mix(in_oklab,var(--surface)_82%,rgb(14,165,233)_18%)] text-[color:color-mix(in_oklab,var(--foreground)_84%,rgb(3,105,161)_16%)] ring-[color:color-mix(in_oklab,var(--border)_72%,rgb(14,165,233)_28%)]",
        approval:
          "bg-[color:color-mix(in_oklab,var(--surface)_82%,rgb(99,102,241)_18%)] text-[color:color-mix(in_oklab,var(--foreground)_84%,rgb(79,70,229)_16%)] ring-[color:color-mix(in_oklab,var(--border)_72%,rgb(99,102,241)_28%)]",
        neutral:
          "bg-[color:color-mix(in_oklab,var(--surface)_88%,var(--surface-subtle)_12%)] text-[color:var(--muted-foreground)] ring-[color:var(--border)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
