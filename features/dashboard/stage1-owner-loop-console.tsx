import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  Database,
  ShieldCheck,
} from "lucide-react";
import type {
  Stage1DecisionProjection,
  Stage1OwnerLoopReadout,
  Stage1SourceHealth,
} from "@/features/dashboard/stage1-owner-loop-readout";
import { cn } from "@/lib/utils";

const ZH_POSTURE: Record<Stage1OwnerLoopReadout["posture"], string> = {
  not_configured: "尚未形成运行记录",
  observing: "只读观察中",
  owner_review_required: "有事项待拍板",
  follow_through: "执行跟进中",
  learning_ready: "已有结果可复盘",
  attention_required: "存在证据缺口",
};

const EN_POSTURE: Record<Stage1OwnerLoopReadout["posture"], string> = {
  not_configured: "No runtime records yet",
  observing: "Read-only observation",
  owner_review_required: "Owner review required",
  follow_through: "Follow-through in progress",
  learning_ready: "Results ready to review",
  attention_required: "Evidence gap detected",
};

const ZH_PROJECTION: Record<Stage1DecisionProjection, string> = {
  DRAFT: "草案",
  EVIDENCE_READY: "待拍板",
  OWNER_CONFIRMED: "待派发",
  DISPATCHED: "已派发",
  IN_PROGRESS: "执行中",
  RECEIPT_SUBMITTED: "待验收",
  VERIFIED: "已验收",
  EVALUATED: "已复盘",
  RECEIPT_MISSING: "缺回执",
  REJECTED: "已拒绝",
  BLOCKED: "已阻塞",
  EXPIRED: "已失效",
  SUPERSEDED: "已替代",
};

function projectionLabel(
  projection: Stage1DecisionProjection,
  english: boolean,
) {
  if (!english) return ZH_PROJECTION[projection];
  return projection
    .toLowerCase()
    .split("_")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function sourceHealthLabel(health: Stage1SourceHealth, english: boolean) {
  const labels: Record<Stage1SourceHealth, [string, string]> = {
    healthy: ["健康", "Healthy"],
    stale: ["已过时", "Stale"],
    failing: ["异常", "Failing"],
    unknown: ["待观察", "Unknown"],
  };
  return labels[health][english ? 1 : 0];
}

function formatAsOf(value: string, english: boolean) {
  return new Intl.DateTimeFormat(english ? "en" : "zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function Stage1OwnerLoopConsole({
  readout,
  english,
}: {
  readout: Stage1OwnerLoopReadout;
  english: boolean;
}) {
  const postureLabel = (english ? EN_POSTURE : ZH_POSTURE)[readout.posture];
  const verifiedQuality = readout.receipts.averageVerifiedQuality;
  const decisionItems = readout.decisions.items.slice(0, 3);
  const signalItems = readout.supervision.items.slice(0, 3);

  return (
    <section
      aria-labelledby="stage1-owner-loop-title"
      className="border-y border-[color:var(--border)] bg-[color:var(--surface-subtle)]"
      data-stage1-owner-loop-console="true"
    >
      <div className="px-5 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-0.5 grid size-9 shrink-0 place-items-center border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--foreground)]">
              <ShieldCheck className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                {english ? "CEO operating loop" : "一把手经营闭环"}
              </p>
              <h2
                id="stage1-owner-loop-title"
                className="mt-1 text-base font-semibold text-[color:var(--foreground)]"
              >
                {postureLabel}
              </h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-[color:var(--muted-foreground)]">
                {english
                  ? "Read-only operating view. Advice requires owner confirmation; this surface does not execute, send, or create commitments."
                  : "只读经营视图。建议需一把手确认；本面板不执行、不外发、不产生承诺。"}
              </p>
            </div>
          </div>
          <span className="text-xs text-[color:var(--muted-foreground)]">
            {english ? "As of" : "截至"} {formatAsOf(readout.asOf, english)}
          </span>
        </div>

        <div className="mt-5 grid min-h-24 grid-cols-2 border-y border-[color:var(--border)] md:grid-cols-4 md:divide-x md:divide-[color:var(--border)]">
          <Metric
            icon={Database}
            label={english ? "Source health" : "来源健康"}
            value={`${readout.observation.healthy}/${readout.observation.totalSources}`}
            detail={
              english
                ? `${readout.observation.stale} stale · ${readout.observation.failing} failing`
                : `${readout.observation.stale} 个过时 · ${readout.observation.failing} 个异常`
            }
          />
          <Metric
            icon={BookOpenCheck}
            label={english ? "Owner decisions" : "待拍板决策"}
            value={String(readout.decisions.pendingOwner)}
            detail={
              english
                ? `${readout.decisions.inFollowThrough} in follow-through`
                : `${readout.decisions.inFollowThrough} 项跟进中`
            }
          />
          <Metric
            icon={AlertTriangle}
            label={english ? "Open supervision" : "监督异常"}
            value={String(readout.supervision.open)}
            detail={
              english
                ? `${readout.supervision.critical} critical · ${readout.supervision.warning} warning`
                : `${readout.supervision.critical} 个严重 · ${readout.supervision.warning} 个警告`
            }
            attention={readout.supervision.critical > 0}
          />
          <Metric
            icon={CheckCircle2}
            label={english ? "Verified receipts" : "已验收回执"}
            value={`${readout.receipts.verified}/${readout.receipts.workPackets}`}
            detail={
              verifiedQuality === null
                ? english
                  ? `${readout.receipts.missing} missing`
                  : `${readout.receipts.missing} 个缺失`
                : english
                  ? `Quality ${verifiedQuality}/100 · ${readout.receipts.missing} missing`
                  : `质量 ${verifiedQuality}/100 · ${readout.receipts.missing} 个缺失`
            }
            attention={readout.receipts.missing > 0}
          />
        </div>

        <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <div>
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-medium text-[color:var(--foreground)]">
                {english ? "Decision follow-through" : "决策与跟进"}
              </h3>
              <Link
                href="/approvals"
                className="inline-flex items-center gap-1 text-xs text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"
              >
                {english ? "Approvals and verification" : "审批与验收队列"}
                <ArrowRight className="size-3" aria-hidden="true" />
              </Link>
            </div>
            {decisionItems.length > 0 ? (
              <ul className="mt-2 divide-y divide-[color:var(--border)]">
                {decisionItems.map((item) => (
                  <li
                    key={item.id}
                    className="flex min-w-0 items-start justify-between gap-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-[color:var(--foreground)]">
                        {item.businessQuestion}
                      </p>
                      <p className="mt-1 truncate font-mono text-xs text-[color:var(--muted-foreground)]">
                        {item.decisionKey}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 text-xs font-medium",
                        item.needsAttention
                          ? "text-[color:var(--danger)]"
                          : "text-[color:var(--muted-foreground)]",
                      )}
                    >
                      {projectionLabel(item.projection, english)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-[color:var(--muted-foreground)]">
                {english
                  ? "No governed decision records yet."
                  : "尚无受治理的决策运行记录。"}
              </p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-medium text-[color:var(--foreground)]">
                {english ? "Supervision and evidence" : "监督与证据"}
              </h3>
              <Link
                href="/memory"
                className="inline-flex items-center gap-1 text-xs text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"
              >
                {english ? "Candidate memory" : "候选记忆"}
                <ArrowRight className="size-3" aria-hidden="true" />
              </Link>
            </div>
            {signalItems.length > 0 ? (
              <ul className="mt-2 divide-y divide-[color:var(--border)]">
                {signalItems.map((signal) => (
                  <li key={signal.id} className="py-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="line-clamp-2 text-sm text-[color:var(--foreground)]">
                        {signal.observedFact}
                      </p>
                      <span
                        className={cn(
                          "shrink-0 text-xs font-medium",
                          signal.severity === "critical"
                            ? "text-[color:var(--danger)]"
                            : "text-[color:var(--muted-foreground)]",
                        )}
                      >
                        {signal.severity}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">
                      {english ? "Suggested route" : "建议路径"}:{" "}
                      {signal.recommendedRoute}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-[color:var(--muted-foreground)]">
                {english
                  ? "No unresolved supervision signals."
                  : "当前没有未解决的监督信号。"}
              </p>
            )}
            {readout.observation.sources.length > 0 ? (
              <p className="mt-3 border-t border-[color:var(--border)] pt-3 text-xs leading-5 text-[color:var(--muted-foreground)]">
                {readout.observation.sources
                  .slice(0, 3)
                  .map(
                    (source) =>
                      `${source.sourceKey}: ${sourceHealthLabel(source.health, english)}`,
                  )
                  .join(" · ")}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  detail,
  attention = false,
}: {
  icon: typeof Database;
  label: string;
  value: string;
  detail: string;
  attention?: boolean;
}) {
  return (
    <div className="min-w-0 px-3 py-4 first:pl-0 last:pr-0 md:px-5">
      <div className="flex items-center gap-2 text-xs text-[color:var(--muted-foreground)]">
        <Icon className="size-3.5" aria-hidden="true" />
        <span>{label}</span>
      </div>
      <p
        className={cn(
          "mt-2 text-2xl font-semibold tabular-nums text-[color:var(--foreground)]",
          attention && "text-[color:var(--danger)]",
        )}
      >
        {value}
      </p>
      <p className="mt-1 truncate text-xs text-[color:var(--muted-foreground)]">
        {detail}
      </p>
    </div>
  );
}
