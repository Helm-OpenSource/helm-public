"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type LazyDisclosureProps = {
  title: string;
  quote?: boolean;
  className?: string;
  summaryClassName?: string;
  bodyClassName?: string;
  "data-testid"?: string;
  children: ReactNode;
};

export function LazyDisclosure({
  title,
  quote = true,
  className,
  summaryClassName,
  bodyClassName,
  "data-testid": dataTestId,
  children,
}: LazyDisclosureProps) {
  const [open, setOpen] = useState(false);

  return (
    <details
      data-testid={dataTestId}
      className={cn(
        "rounded-[24px] border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3",
        className,
      )}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary
        className={cn(
          "flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-[color:var(--foreground)] marker:content-none [&::-webkit-details-marker]:hidden",
          summaryClassName,
        )}
      >
        <span>{title}</span>
        {quote ? (
          <span className="text-lg leading-none" aria-hidden>
            &quot;
          </span>
        ) : null}
      </summary>
      {open ? <div className={cn("mt-4", bodyClassName)}>{children}</div> : null}
    </details>
  );
}
