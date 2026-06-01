import Link from "next/link";
import {
  ArrowRight,
  Flag,
  GitBranch,
  NotebookPen,
  ShieldCheck,
  Target,
} from "lucide-react";
import { FirstLoopAnchorButton } from "@/components/shared/first-loop-anchor-button";
import { FirstLoopTrackedActionButton } from "@/components/shared/first-loop-tracked-action-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  getFirstLoopStatusLabel,
  type FirstLoopProgressStatus,
  type WorkspaceFirstLoopItem,
  type WorkspaceFirstLoopModel,
} from "@/lib/operating-system/first-loop";
import { formatSeededBusinessCopy } from "@/lib/presentation/seeded-business-copy";

function getStatusVariant(status: FirstLoopProgressStatus) {
  switch (status) {
    case "done":
      return "success" as const;
    case "ready":
      return "warning" as const;
    case "watch":
      return "info" as const;
    case "blocked":
      return "danger" as const;
  }
}

export function formatFirstLoopSurfaceText(value: string, english: boolean) {
  if (english) return value;

  const formatted = value
    .replace(/review-before-commitment/gi, "承诺前复核")
    .replace(/review-before-send/gi, "发送前复核")
    .replace(/first-loop/gi, "首轮闭环")
    .replace(/first loop/gi, "首轮闭环")
    .replace(/live signal/gi, "真实信号")
    .replace(/setup handoff/gi, "初始化交接")
    .replace(/\bfollow-up\b/gi, "跟进")
    .replace(/\baction items\b/gi, "动作项")
    .replace(/\baction item\b/gi, "动作项")
    .replace(/\bbriefing\b/gi, "简报")
    .replace(/\bsetup\b/gi, "初始化")
    .replace(/\bfocus\b/gi, "重点")
    .replace(/\bworkspace\b/gi, "工作区")
    .replace(/\breview\b/gi, "复核")
    .replace(/\bcommitment\b/gi, "承诺")
    .replace(/\bsignal\b/gi, "信号")
    .replace(/\breturn anchor\b/gi, "回到事项")
    .replace(/回访锚点/g, "回到事项")
    .replace(/当前回到事项/g, "回到事项")
    .replace(/当前回访点/g, "回到事项")
    .replace(/已保存回访点/g, "已保存位置")
    .replace(/继续回访点/g, "继续处理")
    .replace(/打开当前锚点/g, "打开回到事项")
    .replace(/打开回访点/g, "打开回到事项")
    .replace(/跟进 邮件/g, "跟进邮件");

  return formatSeededBusinessCopy(formatted, english);
}

function LoopCard({
  item,
  english,
  formatText = (value) => value,
}: {
  item: WorkspaceFirstLoopItem;
  english: boolean;
  formatText?: (value: string) => string;
}) {
  const copy = (value: string) =>
    formatFirstLoopSurfaceText(formatText(value), english);

  return (
    <div className="workspace-panel rounded-2xl p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-[color:var(--foreground)]">
          {copy(item.label)}
        </p>
        <Badge variant={getStatusVariant(item.status)}>
          {getFirstLoopStatusLabel(item.status, english)}
        </Badge>
      </div>
      <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
        {copy(item.summary)}
      </p>
      <div className="mt-4">
        <Link
          href={item.href}
          className="inline-flex items-center gap-1 text-sm font-medium text-[var(--accent)] transition hover:text-[color:color-mix(in_oklab,var(--accent)_82%,black_18%)]"
        >
          {english ? "Open now" : "现在打开"}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

export function FirstLoopSurfaceSummary({
  model,
  english,
  eyebrow,
  compact = false,
  formatText = (value) => value,
}: {
  model: WorkspaceFirstLoopModel;
  english: boolean;
  eyebrow?: string;
  compact?: boolean;
  formatText?: (value: string) => string;
}) {
  const copy = (value: string) =>
    formatFirstLoopSurfaceText(formatText(value), english);
  const stepCards = [
    model.firstSignal,
    model.firstSuggestion,
    model.reviewCheckpoint,
    model.nextAnchor,
  ];
  const showReturnReadback = model.primaryAction.stepId !== "anchor";
  const primaryActionStatus: FirstLoopProgressStatus =
    model.hasExplicitAnchor && model.primaryAction.stepId === "anchor"
      ? "done"
      : model.steps.some((item) => item.status === "ready")
        ? "ready"
        : model.steps.some((item) => item.status === "watch")
          ? "watch"
          : "done";

  if (compact) {
    return (
      <Card
        className="workspace-panel-muted border-[color:var(--border)]"
        data-first-loop-compact="true"
      >
        <CardContent className="space-y-3 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="info">
                  {eyebrow ?? (english ? "First loop" : "首轮闭环")}
                </Badge>
                <Badge variant={getStatusVariant(primaryActionStatus)}>
                  {copy(model.stageLabel)}
                </Badge>
                <span className="rounded-full border border-[color:var(--border)] bg-[color:var(--background-elevated)] px-3 py-1 text-xs font-medium text-[color:var(--muted-foreground)]">
                  {copy(model.progressLabel)}
                </span>
              </div>
              <p className="min-w-0 text-sm font-semibold leading-6 text-[color:var(--foreground)]">
                {copy(model.primaryAction.label)}
              </p>
              <p className="line-clamp-1 text-xs leading-5 text-[color:var(--muted)]">
                {copy(model.primaryAction.summary)}
              </p>
            </div>
            <FirstLoopTrackedActionButton
              href={model.primaryAction.href}
              label={copy(model.primaryAction.label)}
              summary={copy(model.primaryAction.summary)}
              ctaLabel={copy(model.primaryAction.ctaLabel)}
              sourceArea="first-loop-summary"
              eventKind={
                model.primaryAction.stepId === "anchor"
                  ? "anchor-resumed"
                  : "primary-action-opened"
              }
              stepId={model.primaryAction.stepId}
            />
          </div>

          <details className="rounded-lg border border-[color:var(--border)] bg-[color:var(--background-elevated)] px-3 py-2">
            <summary
              aria-label={english ? "More context" : "补充信息"}
              className="cursor-pointer list-none text-xs font-semibold text-[color:var(--muted)] marker:content-none [&::-webkit-details-marker]:hidden"
            >
              {english ? "More context" : "补充信息"}
            </summary>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={model.hasExplicitAnchor ? "success" : "warning"}>
                    {model.hasExplicitAnchor
                      ? english
                        ? "Return anchor saved"
                        : "回访点已保存"
                      : english
                        ? "Return anchor"
                        : "回到事项"}
                  </Badge>
                  <FirstLoopAnchorButton
                    anchor={{
                      ...model.nextAnchor,
                      label: copy(model.nextAnchor.label),
                      summary: copy(model.nextAnchor.summary),
                    }}
                    english={english}
                    hasExplicitAnchor={model.hasExplicitAnchor}
                  />
                </div>
                {showReturnReadback ? (
                  <div className="mt-3">
                    <p className="text-sm leading-6 text-[color:var(--muted)]">
                      {copy(model.returnReadback.summary)}
                    </p>
                    <Button asChild className="mt-3" size="sm" variant="secondary">
                      <Link href={model.returnReadback.href}>
                        {copy(model.returnReadback.ctaLabel)}
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                ) : null}
              </div>
              <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-3">
                <div className="flex items-center gap-2 text-xs font-medium text-[color:var(--mode-link)]">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {english ? "Guardrail" : "保护线"}
                </div>
                <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                  {copy(model.boundary)}
                </p>
              </div>
            </div>
          </details>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="workspace-panel-muted border-[color:var(--border)]">
      <CardContent className="space-y-4 py-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="info">
            {eyebrow ?? (english ? "First loop" : "首轮闭环")}
          </Badge>
          <Badge
            variant={getStatusVariant(
              model.steps.some((item) => item.status === "ready")
                ? "ready"
                : "done",
            )}
          >
            {copy(model.stageLabel)}
          </Badge>
          <Badge variant={model.hasExplicitAnchor ? "success" : "warning"}>
            {model.hasExplicitAnchor
              ? english
                ? "Return anchor saved"
                : "回访点已保存"
              : english
                ? "Return anchor"
                : "回到事项"}
          </Badge>
          <span className="rounded-full border border-[color:var(--border)] bg-[color:var(--background-elevated)] px-3 py-1 text-xs font-medium text-[color:var(--muted-foreground)]">
            {copy(model.progressLabel)}
          </span>
          <FirstLoopAnchorButton
            anchor={{
              ...model.nextAnchor,
              label: copy(model.nextAnchor.label),
              summary: copy(model.nextAnchor.summary),
            }}
            english={english}
            hasExplicitAnchor={model.hasExplicitAnchor}
          />
        </div>

        <div
          className={`grid gap-3 ${showReturnReadback ? "xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]" : ""}`}
        >
          <div className="workspace-panel rounded-2xl p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="warning">
                {english ? "Next action" : "下一步"}
              </Badge>
              <Badge variant={getStatusVariant(primaryActionStatus)}>
                {copy(model.stageLabel)}
              </Badge>
            </div>
            <p className="mt-3 text-base font-semibold text-[color:var(--foreground)]">
              {copy(model.primaryAction.label)}
            </p>
            <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
              {copy(model.primaryAction.summary)}
            </p>
            <div className="mt-4">
              <FirstLoopTrackedActionButton
                href={model.primaryAction.href}
                label={copy(model.primaryAction.label)}
                summary={copy(model.primaryAction.summary)}
                ctaLabel={copy(model.primaryAction.ctaLabel)}
                sourceArea="first-loop-summary"
                eventKind={
                  model.primaryAction.stepId === "anchor"
                    ? "anchor-resumed"
                    : "primary-action-opened"
                }
                stepId={model.primaryAction.stepId}
              />
            </div>
          </div>

          {showReturnReadback ? (
            <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--background-elevated)] px-4 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={
                    model.returnReadback.mode === "explicit"
                      ? "success"
                      : "info"
                  }
                >
                  {copy(model.returnReadback.label)}
                </Badge>
              </div>
              <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">
                {copy(model.returnReadback.summary)}
              </p>
              <div className="mt-4">
                <Button asChild size="sm" variant="secondary">
                  <Link href={model.returnReadback.href}>
                    {copy(model.returnReadback.ctaLabel)}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <div className="space-y-3">
            <p className="text-lg font-semibold tracking-tight text-[color:var(--foreground)]">
              {copy(model.title)}
            </p>
            <p className="text-sm leading-7 text-[color:var(--muted)]">
              {copy(model.summary)}
            </p>
            <div className="space-y-2 rounded-2xl border border-[color:var(--border)] bg-[color:var(--background-elevated)] px-4 py-4">
              <div className="flex items-center gap-2 text-xs font-medium text-[color:var(--mode-link)]">
                <ShieldCheck className="h-3.5 w-3.5" />
                {english ? "Guardrail" : "保护线"}
              </div>
              <p className="text-sm leading-6 text-[color:var(--muted)]">
                {copy(model.boundary)}
              </p>
            </div>
          </div>

          <div
            className={`grid gap-3 ${compact ? "md:grid-cols-2" : "md:grid-cols-2 xl:grid-cols-2"}`}
          >
            {stepCards.map((item) => (
              <LoopCard
                key={item.id}
                item={item}
                english={english}
                formatText={copy}
              />
            ))}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[
            { icon: Flag, item: model.roleGoal },
            { icon: Target, item: model.firstSignal },
            { icon: GitBranch, item: model.followThrough },
            { icon: NotebookPen, item: model.memoryWriteBack },
          ].map(({ icon: Icon, item }) => (
            <div
              key={item.id}
              className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--background-elevated)] px-4 py-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-medium text-[color:var(--mode-link)]">
                  <Icon className="h-3.5 w-3.5" />
                  {copy(item.label)}
                </div>
                <Badge variant={getStatusVariant(item.status)}>
                  {getFirstLoopStatusLabel(item.status, english)}
                </Badge>
              </div>
              <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">
                {copy(item.summary)}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
