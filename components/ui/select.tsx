"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export const Select = SelectPrimitive.Root;
export const SelectGroup = SelectPrimitive.Group;
export const SelectValue = SelectPrimitive.Value;

export function SelectTrigger({
  className,
  children,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger>) {
  const accessibilityProps =
    ariaLabel || ariaLabelledBy
      ? {
          "aria-label": ariaLabel,
          "aria-labelledby": ariaLabelledBy,
        }
      : {
          "aria-label": "Select option / 选择选项",
        };

  return (
    <SelectPrimitive.Trigger
      suppressHydrationWarning
      className={cn(
        "flex h-11 w-full items-center justify-between rounded-2xl border border-[color:var(--border)] bg-[color:color-mix(in_oklab,var(--surface)_86%,white_14%)] px-3.5 text-sm text-[color:var(--foreground)] shadow-[0_10px_24px_-20px_rgba(15,23,42,0.55)] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[color:var(--ring)]",
        className,
      )}
      {...accessibilityProps}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown className="h-4 w-4 text-[color:var(--muted-foreground)]" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

export function SelectContent({
  className,
  children,
  position = "popper",
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        position={position}
        className={cn(
          "z-50 min-w-[8rem] overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:color-mix(in_oklab,var(--surface)_88%,white_12%)] p-1.5 shadow-xl",
          className,
        )}
        {...props}
      >
        <SelectPrimitive.Viewport>{children}</SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

export function SelectItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      className={cn(
        "relative flex cursor-default select-none items-center rounded-xl py-2.5 pl-8 pr-3 text-sm text-[color:var(--foreground)] outline-none data-[highlighted]:bg-[color:var(--surface-subtle)]",
        className,
      )}
      {...props}
    >
      <span className="absolute left-2 flex h-4 w-4 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="h-4 w-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}
