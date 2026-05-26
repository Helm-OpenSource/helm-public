import { CheckCircle2, CircleAlert, Route, ShieldCheck } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { InternalCommercializationLifecycleReadout } from "@/lib/internal-commercialization/runtime";

export function InternalCommercializationLifecyclePanel({
  readout,
  english,
}: {
  readout: InternalCommercializationLifecycleReadout;
  english: boolean;
}) {
  return (
    <Card
      className="workspace-shell-panel border-[color:var(--mode-card-border)]"
      data-internal-commercialization-lifecycle="read-only"
    >
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-[color:var(--mode-link)]">
          <Route className="h-3.5 w-3.5" />
          {english ? "Reserved commercialization" : "自营商业化"}
        </div>
        <CardTitle className="text-lg tracking-tight text-[color:var(--foreground)]">
          {readout.title}
        </CardTitle>
        <CardDescription className="text-sm leading-7 text-[color:var(--muted-foreground)]">
          {readout.summary}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          {readout.stageBuckets.map((bucket) => (
            <div
              key={bucket.id}
              className="rounded-2xl border border-[color:var(--border)] px-3 py-3"
            >
              <p className="text-xs text-[color:var(--muted-foreground)]">
                {bucket.label}
              </p>
              <p className="mt-1 text-xl font-semibold text-[color:var(--foreground)]">
                {bucket.count}
              </p>
            </div>
          ))}
        </div>
        {readout.truncated ? (
          <div className="rounded-2xl border border-[color:var(--status-warning-border)] bg-[color:var(--status-warning-bg)] px-3 py-2 text-xs leading-6 text-[color:var(--status-warning-text)]">
            {english
              ? "Showing the latest 50 lifecycle runs. Use the source registry for the full list before making decisions."
              : "当前只显示最近 50 条生命周期记录。做判断前请回到来源登记表查看完整列表。"}
          </div>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
          <div className="space-y-3">
            <p className="text-sm font-semibold text-[color:var(--foreground)]">
              {english ? "Today Top 3 commercialization moves" : "今天最该推进的 3 个商业化动作"}
            </p>
            {readout.topWorkItems.length ? (
              readout.topWorkItems.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-[color:var(--foreground)]">
                      {item.title}
                    </p>
                    <span className="rounded-full border border-[color:var(--border)] bg-[color:var(--background)] px-2 py-0.5 text-[11px] text-[color:var(--muted-foreground)]">
                      {item.decisionLabel}
                    </span>
                    {item.expectedOfferStageLabel ? (
                      <span className="rounded-full border border-[color:var(--border)] bg-[color:var(--background)] px-2 py-0.5 text-[11px] text-[color:var(--muted-foreground)]">
                        {item.expectedOfferStageLabel}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs leading-6 text-[color:var(--muted-foreground)]">
                    {item.providerAliasId} · {item.currentStateLabel}
                    {item.nextStateLabel ? ` -> ${item.nextStateLabel}` : ""}
                  </p>
                  <p className="mt-2 text-xs leading-6 text-[color:var(--foreground)]">
                    {item.nextAction}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {item.customerOpportunityAliasIds.slice(0, 4).map((alias) => (
                      <span
                        key={alias}
                        className="rounded-full border border-[color:var(--border)] px-2 py-0.5 text-[11px] text-[color:var(--muted-foreground)]"
                      >
                        {alias}
                      </span>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-[color:var(--border)] px-3 py-3 text-sm leading-7 text-[color:var(--muted-foreground)]">
                {english
                  ? "No alias-only commercialization run has been loaded yet."
                  : "当前还没有导入仅别名的商业化生命周期记录。"}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-[color:var(--foreground)]">
              {english ? "Review-first boundary" : "Review-first 边界"}
            </p>
            <div className="grid gap-2">
              {readout.boundaryChecks.map((check) => (
                <div
                  key={check.id}
                  className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      {check.ok ? (
                        <CheckCircle2 className="h-4 w-4 text-[color:var(--status-success-text)]" />
                      ) : (
                        <CircleAlert className="h-4 w-4 text-[color:var(--status-danger-text)]" />
                      )}
                      <p className="truncate text-xs font-medium text-[color:var(--foreground)]">
                        {check.label}
                      </p>
                    </div>
                    <span className="text-xs text-[color:var(--muted-foreground)]">
                      {check.count}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-[color:var(--foreground)]">
                <ShieldCheck className="h-4 w-4" />
                {english ? "Runtime posture" : "运行边界"}
              </div>
              <p className="mt-2 text-xs leading-6 text-[color:var(--muted-foreground)]">
                {readout.boundary}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
