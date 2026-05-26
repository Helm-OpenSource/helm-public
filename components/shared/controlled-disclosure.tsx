"use client";

import { useState, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type ControlledDisclosureProps = Omit<
  ComponentPropsWithoutRef<"details">,
  "children" | "open"
> & {
  defaultExpanded?: boolean;
  summary: ReactNode;
  summaryLabel?: string;
  summaryClassName?: string;
  bodyClassName?: string;
  children: ReactNode;
};

export function ControlledDisclosure({
  defaultExpanded = false,
  summary,
  summaryLabel,
  summaryClassName,
  bodyClassName,
  className,
  children,
  onToggle,
  ...props
}: ControlledDisclosureProps) {
  const [open, setOpen] = useState(defaultExpanded);

  return (
    <details
      {...props}
      open={open}
      className={cn(className)}
      onToggle={(event) => {
        setOpen(event.currentTarget.open);
        onToggle?.(event);
      }}
    >
      <summary aria-label={summaryLabel} className={summaryClassName}>
        {summary}
      </summary>
      <div className={bodyClassName}>{children}</div>
    </details>
  );
}
