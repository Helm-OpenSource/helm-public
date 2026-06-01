import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import type {
  OperatingFoundationConnection,
  OperatingFoundationItem,
} from "@/lib/operating-system/foundation";

export function OperatingFoundationSummaryCard({
  label,
  title,
  summary,
  items,
  connections,
  note,
}: {
  label: string;
  title: string;
  summary: string;
  items: OperatingFoundationItem[];
  connections: OperatingFoundationConnection[];
  note: string;
}) {
  return (
    <Card
      data-operating-foundation-summary="true"
      className="workspace-panel-muted"
    >
      <CardContent className="space-y-4 py-5">
        <div className="space-y-1">
          {label ? (
            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{label}</p>
          ) : null}
          <p className="text-lg font-semibold text-[color:var(--foreground)]">{title}</p>
          <p className="text-sm leading-7 text-[color:var(--muted-foreground)]">{summary}</p>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {items.map((item) => (
            <div
              key={`${item.label}-${item.value}`}
              className="workspace-panel rounded-[22px] px-4 py-4"
            >
              <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                {item.label}
              </p>
              <p className="mt-2 text-sm leading-7 text-[color:var(--foreground)]">{item.value}</p>
            </div>
          ))}
        </div>

        {connections.length ? (
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {connections.map((connection) => {
                const content = (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                      {connection.label}
                    </p>
                    <p className="text-sm font-medium leading-6 text-[color:var(--foreground)]">
                      {connection.value}
                    </p>
                    <p className="text-xs leading-6 text-[color:var(--muted-foreground)]">
                      {connection.description}
                    </p>
                  </div>
                );

                if (connection.href) {
                  return (
                    <Link
                      key={`${connection.label}-${connection.value}`}
                      href={connection.href}
                      aria-label={connection.label}
                      className="workspace-panel rounded-[22px] px-4 py-4 transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)]"
                    >
                      {content}
                    </Link>
                  );
                }

                return (
                  <div
                    key={`${connection.label}-${connection.value}`}
                    className="workspace-panel rounded-[22px] px-4 py-4"
                  >
                    {content}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="theme-surface-panel-soft rounded-2xl px-4 py-4 text-sm leading-6 text-[color:var(--muted-foreground)]">
          {note}
        </div>
      </CardContent>
    </Card>
  );
}

export function DetailOperatingFoundationCard({
  label,
  title,
  summary,
  items,
  connections,
  note,
}: {
  label: string;
  title: string;
  summary: string;
  items: OperatingFoundationItem[];
  connections: OperatingFoundationConnection[];
  note: string;
}) {
  return (
    <section
      data-detail-operating-foundation="true"
      className="theme-detail-shell-card space-y-3 rounded-[24px] px-4 py-4"
    >
      <div className="space-y-1">
        {label ? (
          <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{label}</p>
        ) : null}
        <p className="text-base font-semibold text-white">{title}</p>
        <p className="text-sm leading-7 text-[color:var(--muted-foreground)]">{summary}</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {items.map((item) => (
          <div
            key={`${item.label}-${item.value}`}
            className="theme-detail-shell-tile rounded-[18px] px-3 py-3"
          >
            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
              {item.label}
            </p>
            <p className="mt-2 text-sm leading-7 text-[color:var(--dark-inset-foreground)]">{item.value}</p>
          </div>
        ))}
      </div>

      {connections.length ? (
        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            {connections.map((connection) => {
              const content = (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                    {connection.label}
                  </p>
                  <p className="text-sm font-medium leading-6 text-[color:var(--dark-inset-foreground)]">
                    {connection.value}
                  </p>
                  <p className="text-xs leading-6 text-[color:var(--muted-foreground)]">
                    {connection.description}
                  </p>
                </div>
              );

              if (connection.href) {
                return (
                  <Link
                    key={`${connection.label}-${connection.value}`}
                    href={connection.href}
                    aria-label={connection.label}
                    className="theme-detail-shell-tile rounded-[18px] px-3 py-3 transition hover:border-[color:rgba(148,163,184,0.34)] hover:bg-[color:rgba(15,23,42,0.86)]"
                  >
                    {content}
                  </Link>
                );
              }

              return (
                <div
                  key={`${connection.label}-${connection.value}`}
                  className="theme-detail-shell-tile rounded-[18px] px-3 py-3"
                >
                  {content}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="rounded-[18px] border border-[color:var(--border-strong)]/70 bg-[color:var(--dark-inset-bg)]/55 px-3 py-3 text-xs leading-6 text-[color:var(--muted-foreground)]">
        {note}
      </div>
    </section>
  );
}
