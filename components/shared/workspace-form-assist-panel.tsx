"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

type WorkspaceFormAssistAction = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
};

type WorkspaceFormAssistPanelProps = {
  eyebrow: string;
  title: string;
  summary: string;
  actions?: WorkspaceFormAssistAction[];
  bullets?: string[];
  boundary?: string;
  className?: string;
};

export function WorkspaceFormAssistPanel({
  eyebrow,
  title,
  summary,
  actions = [],
  bullets = [],
  boundary,
  className,
}: WorkspaceFormAssistPanelProps) {
  const headingId = useId();
  const summaryId = useId();

  return (
    <section
      className={cn("workspace-form-assist workspace-form-assist-card", className)}
      aria-labelledby={headingId}
      aria-describedby={summaryId}
    >
      <div className="space-y-2">
        <p className="workspace-eyebrow">{eyebrow}</p>
        <h3
          id={headingId}
          className="text-lg font-semibold tracking-tight text-[color:var(--foreground)]"
        >
          {title}
        </h3>
        <p
          id={summaryId}
          className="text-sm leading-7 text-[color:var(--muted-foreground)]"
        >
          {summary}
        </p>
      </div>

      {bullets.length ? (
        <ul className="workspace-form-assist-list" role="list">
          {bullets.map((item) => (
            <li key={item} className="workspace-form-assist-list-item">
              {item}
            </li>
          ))}
        </ul>
      ) : null}

      {actions.length ? (
        <div className="workspace-form-assist-actions">
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              className="workspace-form-assist-action"
              onClick={action.onClick}
              disabled={action.disabled}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}

      {boundary ? (
        <p className="workspace-form-assist-boundary">{boundary}</p>
      ) : null}
    </section>
  );
}
