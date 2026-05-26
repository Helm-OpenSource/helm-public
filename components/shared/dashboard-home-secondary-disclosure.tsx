import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type DashboardHomeSecondaryDisclosureProps = {
  kind: "priority-context" | "surface-routing" | "system-context";
  eyebrow: string;
  title: string;
  summary: string;
  english: boolean;
  defaultExpanded?: boolean;
  children: ReactNode;
};

export function DashboardHomeSecondaryDisclosure({
  kind,
  eyebrow,
  title,
  summary,
  english,
  defaultExpanded = false,
  children,
}: DashboardHomeSecondaryDisclosureProps) {
  return (
    <section
      data-dashboard-home-secondary-disclosure="true"
      data-dashboard-home-secondary-kind={kind}
    >
      <details
        className="workspace-panel-muted rounded-[26px] border border-[color:var(--border)]"
        data-default-expanded={defaultExpanded ? "true" : "false"}
        open={defaultExpanded}
      >
        <summary
          aria-label={title}
          className="flex cursor-pointer list-none items-start justify-between gap-4 px-4 py-4"
        >
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="info">{eyebrow}</Badge>
              <span className="rounded-full border border-[color:var(--border)] bg-[color:var(--background-elevated)] px-2.5 py-1 text-xs font-medium text-[color:var(--muted-foreground)]">
                {english ? "Supporting context" : "补充依据"}
              </span>
            </div>
            <p className="text-base font-semibold tracking-tight text-[color:var(--foreground)]">
              {title}
            </p>
            <p className="max-w-4xl text-sm leading-7 text-[color:var(--muted)]">
              {summary}
            </p>
          </div>
          <div className="inline-flex shrink-0 items-center gap-2 pt-1 text-xs text-[color:var(--muted-foreground)]">
            <span>{english ? "Expand" : "展开"}</span>
            <ChevronDown className="h-4 w-4" />
          </div>
        </summary>
        <div className="space-y-4 border-t border-[color:var(--border)] px-4 py-4">
          {children}
        </div>
      </details>
    </section>
  );
}
