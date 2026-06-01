import { BreadcrumbTrail } from "@/components/shared/breadcrumb-trail";
import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  briefing,
  className,
  showBreadcrumb = true,
  titleAs = "h1",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  briefing?: {
    label?: string;
    headline: string;
    summary: string;
    takeawaysLabel?: string;
    takeaways?: string[];
    operatorLabel?: string;
    operatorPrompt?: string;
    decisionsLabel?: string;
    decisions?: string[];
  };
  className?: string;
  showBreadcrumb?: boolean;
  titleAs?: "h1" | "h2";
}) {
  const TitleTag = titleAs;
  const defaultTakeawaysLabel = "我现在看到的重点";
  const defaultDecisionsLabel = "现在要确认";

  return (
    <div
      className={cn(
        "workspace-shell-panel overflow-hidden rounded-[30px] border px-5 py-5 md:px-6 md:py-6",
        className,
      )}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {showBreadcrumb ? <BreadcrumbTrail /> : null}
          {eyebrow ? (
            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
              {eyebrow}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-4xl space-y-2">
            <TitleTag className="text-[30px] font-semibold tracking-tight text-[color:var(--foreground)] md:text-[34px]">
              {title}
            </TitleTag>
            {description ? (
              <p className="max-w-3xl text-sm leading-7 text-[color:var(--muted)] md:text-[15px]">
                {description}
              </p>
            ) : null}
          </div>
          {actions ? (
            <div className="workspace-toolbar flex flex-wrap items-center gap-3 rounded-[24px] px-3 py-3">
              {actions}
            </div>
          ) : null}
        </div>
        {briefing ? (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_320px]">
            <div className="workspace-accent-card overflow-hidden rounded-[26px]">
              <div className="space-y-4 px-5 py-5">
                {briefing.label ? (
                  <p className="workspace-accent-card-label text-xs font-medium text-[color:var(--muted-foreground)]">
                    {briefing.label}
                  </p>
                ) : null}
                <p className="workspace-accent-card-value text-xl font-semibold tracking-tight">
                  {briefing.headline}
                </p>
                <p className="workspace-accent-card-detail max-w-3xl text-sm leading-7">
                  {briefing.summary}
                </p>
                {briefing.takeaways?.length ? (
                  <div className="workspace-panel-muted space-y-3 rounded-[20px] px-4 py-4">
                    <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                      {briefing.takeawaysLabel ?? defaultTakeawaysLabel}
                    </p>
                    <div className="space-y-2">
                      {briefing.takeaways.slice(0, 3).map((item, index) => (
                        <div
                          key={`takeaway-${index}-${item}`}
                          className="rounded-2xl border border-[color:var(--border)] bg-[color:color-mix(in_oklab,var(--background-elevated)_92%,white_8%)] px-3 py-3"
                        >
                          <p className="text-sm leading-7 text-[color:var(--foreground)]">
                            {item}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
            {briefing.operatorPrompt ? (
              <div className="workspace-panel-muted rounded-[26px] px-5 py-5">
                {briefing.operatorLabel ? (
                  <p className="text-xs font-medium text-[color:color-mix(in_oklab,var(--accent)_58%,var(--muted-foreground)_42%)]">
                    {briefing.operatorLabel}
                  </p>
                ) : null}
                <p className="mt-3 text-base font-semibold leading-7 text-[color:var(--foreground)]">
                  {briefing.operatorPrompt}
                </p>
                {briefing.decisions?.length ? (
                  <div className="mt-4 space-y-3 rounded-[20px] border border-[color:var(--border)] bg-[color:color-mix(in_oklab,var(--background-elevated)_92%,white_8%)] px-4 py-4">
                    <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                      {briefing.decisionsLabel ?? defaultDecisionsLabel}
                    </p>
                    <div className="space-y-2">
                      {briefing.decisions.slice(0, 3).map((item, index) => (
                        <div
                          key={`decision-${index}-${item}`}
                          className="rounded-2xl border border-[color:var(--border)] bg-[color:color-mix(in_oklab,var(--surface-subtle)_90%,white_10%)] px-3 py-3"
                        >
                          <p className="text-sm leading-7 text-[color:var(--foreground)]">
                            {item}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
