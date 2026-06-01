import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { trimText } from "@/lib/utils";

export type OperatingSummaryItem = {
  label: string;
  value: string;
};

export type OperatingSummaryConnection = {
  label: string;
  value: string;
  description?: string;
  href?: string;
  actionLabel?: string;
};

function getOperatingSummaryConnectionAriaLabel(
  connection: OperatingSummaryConnection,
) {
  const compactValue = trimText(connection.value, 44);
  const compactAction = connection.actionLabel
    ? trimText(connection.actionLabel, 32)
    : undefined;

  return [connection.label, compactValue, compactAction]
    .filter(Boolean)
    .join("：");
}

export function ObjectContextOperatingSummary({
  label,
  title,
  summary,
  items,
  connectionsLabel,
  connections,
}: {
  label: string;
  title: string;
  summary: string;
  items: readonly OperatingSummaryItem[];
  connectionsLabel?: string;
  connections?: readonly OperatingSummaryConnection[];
}) {
  return (
    <Card className="workspace-panel-muted">
      <CardContent className="space-y-4 py-5">
        <div className="space-y-2">
          <Badge variant="approval">{label}</Badge>
          <p className="break-words text-lg font-semibold text-[color:var(--foreground)]">
            {title}
          </p>
          <p className="break-words text-sm leading-7 text-[color:var(--muted-foreground)]">
            {summary}
          </p>
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
              <p className="mt-2 break-words text-sm leading-7 text-[color:var(--foreground)]">
                {item.value}
              </p>
            </div>
          ))}
        </div>
        {connections && connections.length > 0 ? (
          <div className="space-y-3">
            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
              {connectionsLabel}
            </p>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {connections.map((connection) => {
                const content = (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                      {connection.label}
                    </p>
                    <p className="break-words text-sm font-medium leading-6 text-[color:var(--foreground)]">
                      {connection.value}
                    </p>
                    {connection.description ? (
                      <p className="break-words text-xs leading-6 text-[color:var(--muted-foreground)]">
                        {connection.description}
                      </p>
                    ) : null}
                    {connection.actionLabel ? (
                      <p className="text-xs font-semibold leading-6 text-[color:var(--accent)]">
                        {connection.actionLabel}
                      </p>
                    ) : null}
                  </div>
                );

                if (connection.href) {
                  return (
                    <Link
                      key={`${connection.label}-${connection.value}`}
                      href={connection.href}
                      aria-label={getOperatingSummaryConnectionAriaLabel(
                        connection,
                      )}
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
      </CardContent>
    </Card>
  );
}
