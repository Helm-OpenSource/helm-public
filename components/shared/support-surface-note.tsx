import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

type SupportSurfaceNoteItem = {
  label: string;
  value: string;
};

export function SupportSurfaceNote({
  label,
  title,
  summary,
  items,
}: {
  label: string;
  title: string;
  summary: string;
  items: SupportSurfaceNoteItem[];
}) {
  return (
    <Card className="workspace-panel-muted overflow-hidden rounded-lg">
      <CardContent className="p-0">
        <details className="group">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 marker:content-none [&::-webkit-details-marker]:hidden">
            <span className="min-w-0">
              <Badge variant="neutral">{label}</Badge>
              <span className="mt-1 block text-sm font-semibold text-[color:var(--foreground)]">
                {title}
              </span>
            </span>
            <span className="inline-flex h-7 w-7 flex-none items-center justify-center rounded-full border border-[color:var(--border)] text-sm font-semibold text-[color:var(--muted)] group-open:hidden">
              +
            </span>
            <span className="hidden h-7 w-7 flex-none items-center justify-center rounded-full border border-[color:var(--border)] text-sm font-semibold text-[color:var(--muted)] group-open:inline-flex">
              -
            </span>
          </summary>
          <div className="space-y-4 border-t border-[color:var(--border)] px-4 py-4">
            <p className="text-sm leading-6 text-[color:var(--muted)]">
              {summary}
            </p>
            <div className="grid gap-3 md:grid-cols-3">
              {items.map((item) => (
                <div
                  key={`${item.label}-${item.value}`}
                  className="workspace-panel rounded-lg px-4 py-4"
                >
                  <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                    {item.label}
                  </p>
                  <p className="mt-2 text-sm leading-7 text-[color:var(--foreground)]">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
