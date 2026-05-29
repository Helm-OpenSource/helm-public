import Link from "next/link";
import { ArrowRight, Quote } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CustomerAssetFocusItem = {
  label: string;
  value: string;
  detail?: string | null;
  href?: string | null;
  tone?: "default" | "info" | "warning" | "danger" | "success";
};

export function CustomerAssetFocusStrip({
  eyebrow,
  title,
  summary,
  items,
  primaryAction,
  secondaryAction,
  className,
}: {
  eyebrow: string;
  title: string;
  summary?: string | null;
  items: CustomerAssetFocusItem[];
  primaryAction?: { label: string; href: string } | null;
  secondaryAction?: { label: string; href: string } | null;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "workspace-panel border-[color:var(--border-strong)]",
        className,
      )}
      data-customer-asset-focus="true"
    >
      <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1.2fr)_auto] xl:items-start">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="info">{eyebrow}</Badge>
            <span
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--background-elevated)] text-[color:var(--muted-foreground)]"
              aria-hidden="true"
            >
              <Quote className="h-3.5 w-3.5" />
            </span>
          </div>
          <h2 className="break-words text-xl font-semibold tracking-tight text-[color:var(--foreground)]">
            {title}
          </h2>
          {summary ? (
            <p className="max-w-4xl break-words text-sm leading-6 text-[color:var(--muted)]">
              {summary}
            </p>
          ) : null}
        </div>

        {primaryAction || secondaryAction ? (
          <div className="flex flex-wrap gap-2 xl:justify-end">
            {primaryAction ? (
              <Button asChild>
                <Link href={primaryAction.href}>
                  {primaryAction.label}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            ) : null}
            {secondaryAction ? (
              <Button asChild variant="secondary">
                <Link href={secondaryAction.href}>
                  {secondaryAction.label}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div
        className={cn(
          "grid gap-2 border-t border-[color:var(--border)] p-3",
          items.length >= 4 ? "sm:grid-cols-2 xl:grid-cols-4" : "md:grid-cols-3",
        )}
      >
        {items.map((item) => {
          const content = (
            <div
              className={cn(
                "h-full rounded-lg border bg-[color:var(--background-elevated)] px-3 py-3",
                item.tone === "warning"
                  ? "border-[color:var(--accent-warm)]"
                  : item.tone === "danger"
                    ? "border-[color:var(--accent-danger)]"
                    : item.tone === "success"
                      ? "border-[color:var(--accent-success)]"
                      : item.tone === "info"
                        ? "border-[color:var(--accent)]"
                        : "border-[color:var(--border)]",
              )}
            >
              <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                {item.label}
              </p>
              <p className="mt-1 line-clamp-2 break-words text-sm font-semibold leading-6 text-[color:var(--foreground)]">
                {item.value}
              </p>
              {item.detail ? (
                <p className="mt-1 line-clamp-2 break-words text-xs leading-5 text-[color:var(--muted)]">
                  {item.detail}
                </p>
              ) : null}
            </div>
          );

          return item.href ? (
            <Link
              key={`${item.label}-${item.value}`}
              href={item.href}
              className="block transition hover:-translate-y-0.5 hover:opacity-90"
            >
              {content}
            </Link>
          ) : (
            <div key={`${item.label}-${item.value}`}>{content}</div>
          );
        })}
      </div>
    </section>
  );
}
