import Link from "next/link";

type PageSkeletonAction = {
  href: string;
  label: string;
};

export function PageSkeleton({
  columns = 3,
  rows = 6,
  eyebrow,
  title,
  description,
  assurance,
  actions = [],
  testId,
}: {
  columns?: number;
  rows?: number;
  eyebrow?: string;
  title?: string;
  description?: string;
  assurance?: string;
  actions?: PageSkeletonAction[];
  testId?: string;
}) {
  return (
    <div className="space-y-6" data-testid={testId}>
      <div className="workspace-shell-panel rounded-[28px] border px-6 py-5 shadow-[0_18px_60px_-36px_rgba(15,23,42,0.38)]">
        {title ? (
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 space-y-3">
              {eyebrow ? (
                <p className="workspace-eyebrow">
                  {eyebrow}
                </p>
              ) : null}
              <h1 className="text-2xl font-semibold text-[color:var(--foreground)]">
                {title}
              </h1>
              {description ? (
                <p className="max-w-3xl text-sm leading-6 text-[color:var(--muted)]">
                  {description}
                </p>
              ) : null}
              {assurance ? (
                <p className="text-xs leading-5 text-[color:var(--muted-foreground)]">
                  {assurance}
                </p>
              ) : null}
            </div>
            {actions.length ? (
              <nav className="flex min-w-0 flex-wrap gap-2" aria-label={title}>
                {actions.map((action) => (
                  <Link
                    key={action.href}
                    className="inline-flex min-h-10 items-center justify-center rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-sm font-semibold text-[color:var(--foreground)] transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent)]"
                    href={action.href}
                  >
                    {action.label}
                  </Link>
                ))}
              </nav>
            ) : null}
          </div>
        ) : (
          <>
            <div className="h-3 w-40 animate-pulse rounded-full bg-[color:var(--border)]" />
            <div className="mt-4 h-10 w-80 animate-pulse rounded-2xl bg-[color:var(--border)]" />
            <div className="theme-surface-track mt-3 h-4 w-full max-w-3xl animate-pulse rounded-full" />
          </>
        )}
      </div>
      <div
        className={`grid gap-4 ${
          columns === 4
            ? "md:grid-cols-2 xl:grid-cols-4"
            : columns === 2
              ? "xl:grid-cols-2"
              : "xl:grid-cols-3"
        }`}
      >
        {Array.from({ length: rows }).map((_, index) => (
          <div
            key={index}
            className="workspace-panel h-52 animate-pulse rounded-[24px] shadow-[0_18px_60px_-36px_rgba(15,23,42,0.28)]"
          />
        ))}
      </div>
    </div>
  );
}
