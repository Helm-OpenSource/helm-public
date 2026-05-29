"use client";

import { useId, useState } from "react";

export function QuoteNote({ label, note }: { label: string; note: string }) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const tooltipId = useId();
  const visible = open || hovered;

  return (
    <span
      className="group relative ml-1 inline-flex align-middle"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        type="button"
        aria-describedby={visible ? tooltipId : undefined}
        aria-expanded={visible}
        aria-label={label}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] text-sm font-semibold leading-none text-[color:var(--muted-foreground)] transition hover:border-[color:var(--border-strong)] hover:text-[color:var(--foreground)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent)]"
        onClick={() => setOpen((value) => !value)}
      >
        &quot;
      </button>
      {visible ? (
        <span
          className="absolute left-1/2 top-7 z-30 w-64 -translate-x-1/2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-left text-xs font-normal leading-5 text-[color:var(--foreground)] shadow-lg"
          id={tooltipId}
          role="tooltip"
        >
          {note}
        </span>
      ) : null}
    </span>
  );
}
