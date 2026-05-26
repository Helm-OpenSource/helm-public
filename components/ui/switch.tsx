"use client";

import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

export function Switch({
  className,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  const accessibilityProps =
    ariaLabel || ariaLabelledBy
      ? {
          "aria-label": ariaLabel,
          "aria-labelledby": ariaLabelledBy,
        }
      : {
          "aria-label": "切换设置",
        };

  return (
    <SwitchPrimitive.Root
      className={cn(
        "relative inline-flex h-6 w-11 items-center rounded-full bg-[color:var(--border-strong)] transition data-[state=checked]:bg-[var(--accent)]",
        className,
      )}
      {...accessibilityProps}
      {...props}
    >
      <SwitchPrimitive.Thumb className="block h-5 w-5 translate-x-0.5 rounded-full bg-[color:var(--surface)] shadow-sm transition-transform data-[state=checked]:translate-x-[22px]" />
    </SwitchPrimitive.Root>
  );
}
