import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  Database,
  ListChecks,
  ShieldCheck,
} from "lucide-react";
import {
  CAIO_MATURITY_STAGES,
  CAIO_STAGE_EVIDENCE,
  type CaioCapabilityMaturityStage,
} from "@/lib/caio-governance/types";
import type {
  Stage1DecisionProjection,
  Stage1OwnerLoopReadout,
  Stage1SourceHealth,
} from "@/features/dashboard/stage1-owner-loop-readout";
import { cn } from "@/lib/utils";

// Display-only projection of the CAIO capability maturity axis (a product
// honesty axis, never a permission axis): which stage this surface embodies
// and how each stage is honestly staged today. Reading it grants nothing.
const CURRENT_CONSOLE_STAGE: CaioCapabilityMaturityStage = "observe";

const ZH_STAGE_LABEL: Record<CaioCapabilityMaturityStage, string> = {
  observe: "观察",
  advise: "建议",
  supervise: "监督",
  orchestrate: "编排",
  authorized_execute: "授权执行",
};

// Frozen English display names (never derived from the machine values,
// which would lowercase them).
const EN_STAGE_LABEL: Record<CaioCapabilityMaturityStage, string> = {
  observe: "Observe",
  advise: "Advise",
  supervise: "Supervise",
  orchestrate: "Orchestrate",
  authorized_execute: "Authorized Execute",
};

type CaioStageEvidenceStatusKey =
  (typeof CAIO_STAGE_EVIDENCE)[CaioCapabilityMaturityStage];

const ZH_STAGE_EVIDENCE: Record<CaioStageEvidenceStatusKey, string> = {
  formed: "已成形",
  next_layer: "仍需下一层",
  roadmap_disabled: "路线图·默认关闭",
};

const EN_STAGE_EVIDENCE: Record<CaioStageEvidenceStatusKey, string> = {
  formed: "formed",
  next_layer: "needs next layer",
  roadmap_disabled: "roadmap · disabled",
};

// The ADR requires Authorized Execute to ALWAYS render with the full
// unauthorized / disabled / not-an-execution-permit wording.
const ZH_STAGE_DETAIL_OVERRIDE: Partial<
  Record<CaioCapabilityMaturityStage, string>
> = {
  authorized_execute: "路线图·未授权·默认关闭·不构成执行许可",
};

const EN_STAGE_DETAIL_OVERRIDE: Partial<
  Record<CaioCapabilityMaturityStage, string>
> = {
  authorized_execute:
    "roadmap · unauthorized · disabled by default · not an execution permit",
};

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

function operatingQuestionStateLabel(
  state: Stage1OwnerLoopReadout["operatingQuestions"]["state"],
  english: boolean,
) {
  const labels: Record<
    Stage1OwnerLoopReadout["operatingQuestions"]["state"],
    [string, string]
  > = {
    not_generated: ["尚未生成", "Not generated"],
    awaiting_selection: ["待 CEO 选择", "Awaiting CEO selection"],
    selection_deferred: ["CEO 暂不选择", "Selection deferred"],
    binding_incomplete: ["决策绑定不完整", "Decision binding incomplete"],
    planning_incomplete: ["实施计划待形成", "Implementation plan pending"],
    selected: ["已选择并形成计划", "Selected and planned"],
    last_valid_portfolio_stale: [
      "上一版有效组合",
      "Last valid portfolio",
    ],
    insufficient_evidence: ["证据不足", "Insufficient evidence"],
    invalid_evidence: ["证据校验失败", "Evidence validation failed"],
  };
  return labels[state][english ? 1 : 0];
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
  const operatingQuestions = readout.operatingQuestions;

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
                {english
                  ? "Helm CAIO — the AI executive reporting to the CEO"
                  : "Helm CAIO｜一号位 AI 经营中枢"}
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
              <div
                className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[color:var(--muted-foreground)]"
                data-caio-console-governance="true"
              >
                <span>
                  {english
                    ? "Reports directly and only to the CEO · currently read-only, review-first"
                    : "直属并只向 CEO 汇报 · 当前为只读、复核优先"}
                </span>
                <span className="flex flex-wrap items-center gap-x-2">
                  <span data-caio-console-axis="maturity">
                    {english
                      ? "Capability maturity (not a permission axis):"
                      : "能力成熟度（非权限轴）："}
                  </span>
                  {CAIO_MATURITY_STAGES.map((stage) => (
                    <span
                      key={stage}
                      data-caio-console-stage={stage}
                      data-caio-console-stage-current={
                        stage === CURRENT_CONSOLE_STAGE ? "true" : "false"
                      }
                      className={cn(
                        stage === CURRENT_CONSOLE_STAGE
                          ? "font-medium text-[color:var(--foreground)]"
                          : undefined,
                      )}
                    >
                      {english
                        ? `${EN_STAGE_LABEL[stage]} (${EN_STAGE_DETAIL_OVERRIDE[stage] ?? EN_STAGE_EVIDENCE[CAIO_STAGE_EVIDENCE[stage]]})`
                        : `${ZH_STAGE_LABEL[stage]}（${ZH_STAGE_DETAIL_OVERRIDE[stage] ?? ZH_STAGE_EVIDENCE[CAIO_STAGE_EVIDENCE[stage]]}）`}
                    </span>
                  ))}
                </span>
                <span>
                  {english
                    ? "CAIO is a product role definition, not a legal officer or an authorization; this view follows workspace owner permissions only."
                    : "CAIO 为产品角色定义，不是法定高管身份，也不改变权限；本视图仅按工作区 OWNER 权限展示。"}
                </span>
              </div>
            </div>
          </div>
          <span className="text-xs text-[color:var(--muted-foreground)]">
            {english ? "As of" : "截至"} {formatAsOf(readout.asOf, english)}
          </span>
        </div>

        <div className="mt-5 grid min-h-24 grid-cols-2 border-y border-[color:var(--border)] md:grid-cols-4 md:divide-x md:divide-[color:var(--border)]">
          <Metric
            metricKey="source-health"
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
            metricKey="owner-decisions"
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
            metricKey="open-supervision"
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
            metricKey="verified-receipts"
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

        <section
          aria-labelledby="caio-operating-question-portfolio-title"
          className="mt-5 border-b border-[color:var(--border)] pb-5"
          data-caio-operating-question-portfolio="true"
          data-caio-operating-question-boundary={operatingQuestions.boundary}
          data-caio-operating-question-state={operatingQuestions.state}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <ListChecks
                className="mt-0.5 size-4 shrink-0 text-[color:var(--muted-foreground)]"
                aria-hidden="true"
              />
              <div className="min-w-0">
                <h3
                  id="caio-operating-question-portfolio-title"
                  className="text-sm font-medium text-[color:var(--foreground)]"
                >
                  {english
                    ? "CEO operating-question portfolio"
                    : "CEO 经营问题组合"}
                </h3>
                <p className="mt-1 max-w-3xl text-xs leading-5 text-[color:var(--muted-foreground)]">
                  {english
                    ? "Ten evidence-bound candidates from the current accepted initialization context. This is a read-only projection: it cannot select, confirm, dispatch, or create a Work Packet."
                    : "基于当前已验收初始化上下文形成的 10 个证据化候选。本区仅作只读投影，不能选择、确认、派工或创建 Work Packet。"}
                </p>
              </div>
            </div>
            <div className="shrink-0 text-right text-xs text-[color:var(--muted-foreground)]">
              <p
                className={cn(
                  "font-medium",
                  (operatingQuestions.state === "invalid_evidence" ||
                    operatingQuestions.state === "insufficient_evidence" ||
                    operatingQuestions.state ===
                      "last_valid_portfolio_stale" ||
                    operatingQuestions.state === "binding_incomplete" ||
                    operatingQuestions.state ===
                      "planning_incomplete") &&
                    "text-[color:var(--danger)]",
                )}
              >
                {operatingQuestionStateLabel(
                  operatingQuestions.state,
                  english,
                )}
              </p>
              <p className="mt-1 tabular-nums">
                {english
                  ? `${operatingQuestions.candidates.length} questions · ${operatingQuestions.selectedQuestionIds.length}/3 selected · ${operatingQuestions.decisionBindingCount} bound · ${operatingQuestions.implementationPlanCount} planned`
                  : `${operatingQuestions.candidates.length} 个问题 · 已选 ${operatingQuestions.selectedQuestionIds.length}/3 · 已绑定 ${operatingQuestions.decisionBindingCount} · 已形成计划 ${operatingQuestions.implementationPlanCount}`}
              </p>
              {operatingQuestions.state ===
                "last_valid_portfolio_stale" &&
              operatingQuestions.portfolioGeneratedAt ? (
                <p
                  className="mt-1 max-w-sm text-xs leading-5 text-[color:var(--danger)]"
                  data-caio-operating-question-stale-portfolio="true"
                >
                  {english
                    ? `Latest generation ${operatingQuestions.generationSequence} lacked sufficient evidence; showing valid portfolio ${operatingQuestions.portfolioSequence} from ${formatAsOf(operatingQuestions.portfolioGeneratedAt, true)}.`
                    : `最新第 ${operatingQuestions.generationSequence} 次生成证据不足；当前展示 ${formatAsOf(operatingQuestions.portfolioGeneratedAt, false)} 形成的第 ${operatingQuestions.portfolioSequence} 版有效组合。`}
                </p>
              ) : null}
            </div>
          </div>

          {operatingQuestions.candidates.length > 0 ? (
            <ol className="mt-4 grid gap-x-6 md:grid-cols-2">
              {operatingQuestions.candidates.map((candidate) => (
                <li
                  key={candidate.questionId}
                  className="min-w-0 border-t border-[color:var(--border)] py-3"
                  data-caio-operating-question={candidate.questionId}
                  data-caio-operating-question-selected={
                    candidate.selected ? "true" : "false"
                  }
                  data-caio-operating-question-decision-bound={
                    candidate.decisionRecordId ? "true" : "false"
                  }
                  data-caio-operating-question-plan-materialized={
                    candidate.implementationPlanId ? "true" : "false"
                  }
                >
                  <div className="flex items-start gap-3">
                    <span className="w-6 shrink-0 pt-0.5 text-right font-mono text-xs tabular-nums text-[color:var(--muted-foreground)]">
                      {candidate.rank}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                        <p className="text-sm font-medium text-[color:var(--foreground)]">
                          {candidate.title}
                        </p>
                        <span
                          className={cn(
                            "shrink-0 text-xs",
                            candidate.selected
                              ? "font-medium text-[color:var(--foreground)]"
                              : "text-[color:var(--muted-foreground)]",
                          )}
                        >
                          {candidate.selected
                            ? candidate.implementationPlanId
                              ? english
                                ? "CEO selected · Plan drafted"
                                : "CEO 已选 · 计划已形成"
                              : candidate.decisionRecordId
                                ? english
                                  ? "Decision bound · Planning pending"
                                  : "决策已绑定 · 计划待形成"
                              : english
                                ? "CEO selected · Binding pending"
                                : "CEO 已选 · 待绑定"
                            : english
                              ? "Candidate"
                              : "候选"}
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-[color:var(--muted-foreground)]">
                        {candidate.question}
                      </p>
                      <p className="mt-1 font-mono text-[11px] text-[color:var(--muted-foreground)]">
                        {candidate.businessDomain} ·{" "}
                        {english ? "evidence" : "证据"}{" "}
                        {candidate.evidenceCount} ·{" "}
                        {english ? "score" : "评分"}{" "}
                        {candidate.compositeScore}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-4 border-t border-[color:var(--border)] pt-3 text-sm text-[color:var(--muted-foreground)]">
              {operatingQuestions.state === "invalid_evidence"
                ? english
                  ? "The current portfolio failed evidence validation and is hidden fail-closed."
                  : "当前问题组合未通过证据校验，已按 fail-closed 隐藏。"
                : operatingQuestions.state === "insufficient_evidence"
                  ? english
                    ? "The accepted initialization context does not yet contain enough evidence to form ten questions."
                    : "当前已验收初始化上下文尚不足以形成 10 个经营问题。"
                  : english
                    ? "No governed operating-question portfolio has been generated."
                    : "尚未生成受治理的经营问题组合。"}
            </p>
          )}
        </section>

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
  metricKey,
  icon: Icon,
  label,
  value,
  detail,
  attention = false,
}: {
  metricKey: string;
  icon: typeof Database;
  label: string;
  value: string;
  detail: string;
  attention?: boolean;
}) {
  return (
    <div
      className="min-w-0 px-3 py-4 first:pl-0 last:pr-0 md:px-5"
      data-stage1-owner-loop-metric={metricKey}
    >
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
