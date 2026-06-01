"use client";

import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BrainCircuit,
  Clock3,
  ShieldCheck,
} from "lucide-react";
import { ActionExecutionMode } from "@prisma/client";
import { useWorkspaceUi } from "@/components/providers/workspace-ui-provider";
import { RecommendationEvidenceDisclosure } from "@/components/recommendations/recommendation-evidence-disclosure";
import { ActionModeBadge } from "@/components/shared/status-badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { enhanceRecommendationExplanationAction } from "@/features/recommendations/actions";
import { cn } from "@/lib/utils";
import { readRecommendationPresentation } from "@/lib/recommendations/recommendation-presentation";
import { formatRoleDetailDisplayText } from "@/lib/presentation/role-detail-display-copy";

const recommendationAutoEnhancementTriggered = new Set<string>();

type RecommendationLike = {
  recommendationId: string;
  title: string;
  description: string;
  score: number;
  urgencyScore?: number;
  impactScore?: number;
  confidenceScore?: number;
  personalizationScore?: number;
  riskScore?: number;
  policyResult: ActionExecutionMode | string;
  explanation: string;
  supportingFactIds?: string[] | string | null;
  blockerIds?: string[] | string | null;
  commitmentIds?: string[] | string | null;
  whyNotAutoExecute?: string | null;
  recommendationPayload?: Record<string, unknown> | string | null;
  appliedPolicyRules?: Array<{
    name: string | null;
    mode: ActionExecutionMode | null;
    reason: string;
  }> | null;
  industryContext?: string | null;
};

export function RecommendationJudgementCard({
  recommendation,
  className,
  emphasis = "default",
  surfaceTone = "dark",
  layout = "split",
  detailLevel = "full",
  cta,
  secondaryCta,
  footer,
  summaryLabel,
  sourcePage,
}: {
  recommendation: RecommendationLike;
  className?: string;
  emphasis?: "default" | "featured" | "quiet";
  surfaceTone?: "dark" | "light" | "adaptive";
  layout?: "split" | "stacked";
  detailLevel?: "full" | "summary";
  cta?: ReactNode;
  secondaryCta?: ReactNode;
  footer?: ReactNode;
  summaryLabel?: string;
  sourcePage?: string | null;
}) {
  const { locale, demoMode } = useWorkspaceUi();
  const english = locale === "en-US";
  const presentation = readRecommendationPresentation(recommendation);
  const text = (value: string | null | undefined) =>
    formatRoleDetailDisplayText(value, english);
  const resolvedSummaryLabel =
    text(summaryLabel ?? (english ? "Operating judgement" : "经营判断"));
  const resolvedDecisionLabel = text(presentation.decisionLabel);
  const showDecisionRoleBadge =
    resolvedDecisionLabel.trim() !== resolvedSummaryLabel.trim();
  const tradeoffLine = presentation.alternativeActionTitle
    ? english
      ? `${presentation.tradeoffSummary} The higher-priority alternative right now is "${presentation.alternativeActionTitle}".`
      : `${presentation.tradeoffSummary} 当前更优先的替代动作是“${presentation.alternativeActionTitle}”。`
    : presentation.tradeoffSummary;
  const displayTradeoffLine = text(tradeoffLine);
  const compact = emphasis === "quiet";
  const [adaptiveTheme, setAdaptiveTheme] = useState<"light" | "dark">("light");
  const router = useRouter();

  useEffect(() => {
    if (surfaceTone !== "adaptive" || typeof document === "undefined") return;

    const root = document.documentElement;
    const syncTheme = () => {
      setAdaptiveTheme(root.dataset.theme === "dark" ? "dark" : "light");
    };

    syncTheme();

    const observer = new MutationObserver(syncTheme);
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    return () => observer.disconnect();
  }, [surfaceTone]);

  const resolvedSurfaceTone =
    surfaceTone === "adaptive" ? adaptiveTheme : surfaceTone;
  const usesDarkSurface = resolvedSurfaceTone === "dark";
  const usesSummaryLayout = detailLevel === "summary";
  const usesStackedLayout = layout === "stacked" || usesSummaryLayout;
  const toneClasses =
    usesDarkSurface
      ? emphasis === "featured"
        ? "border-[#24384c] bg-[linear-gradient(180deg,#13202d_0%,#0e1723_100%)]"
        : emphasis === "quiet"
          ? "border-[#243447] bg-[linear-gradient(180deg,#121c28_0%,#0d1621_100%)]"
          : "border-[#25384a] bg-[linear-gradient(180deg,#13202d_0%,#0f1824_100%)]"
      : emphasis === "featured"
        ? "border-[color:color-mix(in_oklab,var(--border-strong)_82%,transparent)] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--background-elevated)_98%,white_2%)_0%,color-mix(in_oklab,var(--surface-subtle)_84%,var(--background)_16%)_100%)] text-[color:var(--foreground)]"
        : "border-[color:var(--border)] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--background-elevated)_97%,white_3%)_0%,color-mix(in_oklab,var(--surface-subtle)_90%,var(--background)_10%)_100%)] text-[color:var(--foreground)]";
  const dividerClass = usesDarkSurface
    ? "border-white/10"
    : "border-[color:var(--border)]";
  const neutralBadgeClass = usesDarkSurface
    ? "border-white/10 bg-white/[0.08] text-[#edf4ff] ring-white/10"
    : "border-[color:var(--border)] bg-[color:color-mix(in_oklab,var(--background-elevated)_86%,var(--surface-subtle)_14%)] text-[color:var(--foreground)] ring-[color:var(--border)]";
  const scoreBadgeClass = usesDarkSurface
    ? "border-[color:var(--status-warning-border)]/20 bg-[color:var(--accent-warm)]/10 text-[color:var(--status-warning-text)] ring-[color:var(--status-warning-border)]/15"
    : "border-[color:var(--status-warning-border)] bg-[color:var(--status-warning-bg)] text-[color:var(--status-warning-text)] ring-[color:var(--status-warning-border)]";
  const llmBadgeClass = usesDarkSurface
    ? "border-[color:var(--status-info-border)]/20 bg-[color:var(--accent)]/10 text-[color:var(--status-info-text)] ring-[color:var(--status-info-border)]/15"
    : "border-[color:var(--status-info-border)] bg-[color:var(--status-info-bg)] text-[color:var(--status-info-text)] ring-[color:var(--status-info-border)]";
  const impactBadgeClass = usesDarkSurface
    ? "border-[color:var(--status-danger-border)]/20 bg-[color:var(--accent-danger)]/10 text-[color:var(--status-danger-text)] ring-[color:var(--status-danger-border)]/15"
    : "border-[color:var(--status-danger-border)] bg-[color:var(--status-danger-bg)] text-[color:var(--status-danger-text)] ring-[color:var(--status-danger-border)]";
  const sectionLabelClass = usesDarkSurface
    ? "text-[#94a3b8]"
    : "workspace-note-label";
  const titleClass = usesDarkSurface
    ? "text-[#f8fafc]"
    : "text-[color:var(--foreground)]";
  const bodyClass = usesDarkSurface
    ? "text-[#d7e3f1]"
    : "text-[color:var(--muted-foreground)]";
  const outletCardClass = usesDarkSurface
    ? "rounded-[24px] border border-[color:var(--status-info-border)]/[0.18] bg-[linear-gradient(180deg,rgba(20,33,48,0.96)_0%,rgba(15,24,36,0.96)_100%)] px-4 py-4"
    : "workspace-panel-muted rounded-[24px] px-4 py-4";
  const outletLabelClass = usesDarkSurface
    ? "text-[#93c5fd]"
    : "workspace-note-label";
  const outletBodyClass = usesDarkSurface
    ? "text-[#e2e8f0]"
    : "text-[color:var(--foreground)]";
  const footerClass = usesDarkSurface
    ? "text-[color:var(--muted-foreground)]"
    : "text-[color:var(--muted-foreground)]";
  const actionOutletCopy =
    recommendation.policyResult === ActionExecutionMode.REQUIRES_APPROVAL
      ? english
        ? "This move has a real exit, but it should be turned into a pending action first so approval and audit stay intact."
        : "这条建议不是停在解释里，而是先转成待审批动作，再让审批和审计链接住它。"
      : recommendation.policyResult ===
          ActionExecutionMode.AUTO_WITHIN_THRESHOLD
        ? english
          ? "This move can be turned into an action immediately inside the current threshold, while keeping the audit trail."
          : "这条建议可以在当前阈值内直接转成动作，同时保留完整审计轨迹。"
        : recommendation.policyResult === ActionExecutionMode.FORBIDDEN
          ? english
            ? "The current policy boundary does not allow direct execution, so the correct exit is discussion, clarification or a safer alternate move."
            : "当前策略边界不允许直接执行，因此正确出口是讨论、澄清，或转向更安全的替代动作。"
          : english
            ? "The next step should become a concrete task, meeting or draft so someone can move it forward."
            : "下一步会落成具体动作、会议或草稿，让负责人可以继续推进。";
  const canEnhanceWithLLM =
    !presentation.llmEnhanced &&
    !recommendation.recommendationId.startsWith("preview-");

  useEffect(() => {
    if (!canEnhanceWithLLM) return;
    if (recommendationAutoEnhancementTriggered.has(recommendation.recommendationId)) return;

    recommendationAutoEnhancementTriggered.add(recommendation.recommendationId);
    void (async () => {
      const result = await enhanceRecommendationExplanationAction(
        recommendation.recommendationId,
        sourcePage ?? undefined,
      );
      if (result.ok) {
        router.refresh();
      }
    })();
  }, [
    canEnhanceWithLLM,
    recommendation.recommendationId,
    router,
    sourcePage,
  ]);

  return (
    <div
      className={cn(
        "rounded-[28px] border p-5 shadow-[0_28px_60px_-38px_rgba(2,8,23,0.7)]",
        toneClasses,
        className,
      )}
    >
      <div className={cn("border-b pb-4", dividerClass)}>
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant={emphasis === "featured" ? "approval" : "default"}
            className={neutralBadgeClass}
          >
            {resolvedSummaryLabel}
          </Badge>
          {demoMode && recommendation.industryContext ? (
            <Badge variant="neutral" className={neutralBadgeClass}>
              {recommendation.industryContext}
            </Badge>
          ) : null}
          {showDecisionRoleBadge ? (
            <Badge
              variant={
                presentation.decisionRole === "primary"
                  ? "approval"
                  : presentation.decisionRole === "secondary"
                    ? "info"
                    : "neutral"
              }
              className={neutralBadgeClass}
            >
              {resolvedDecisionLabel}
            </Badge>
          ) : null}
          <Badge variant="warning" className={scoreBadgeClass}>
            {english ? "Score" : "推荐分"} {recommendation.score}
          </Badge>
          <ActionModeBadge
            mode={String(recommendation.policyResult)}
            className={neutralBadgeClass}
          />
          {presentation.llmEnhanced ? (
            <Badge variant="info" className={llmBadgeClass}>
              {english ? "LLM enhanced" : "LLM 增强"}
            </Badge>
          ) : null}
          {typeof recommendation.riskScore === "number" &&
          recommendation.riskScore >= 70 ? (
            <Badge variant="danger" className={impactBadgeClass}>
              {english ? "High-impact judgement" : "高影响判断"}
            </Badge>
          ) : null}
        </div>
      </div>

      <div
        className={cn(
          "mt-5 grid items-start gap-6",
          compact || usesStackedLayout
            ? "grid-cols-1"
            : "2xl:grid-cols-[minmax(420px,1.05fr)_minmax(320px,0.85fr)]",
        )}
      >
        <article className="min-w-0 space-y-6">
          <header className={cn("space-y-5 border-b pb-6", dividerClass)}>
            <p
              className={cn(
                "text-xs font-medium",
                sectionLabelClass,
              )}
            >
              {english ? "Conclusion" : "结论"}
            </p>
            <h3
              className={cn(
                "break-words font-semibold tracking-tight",
                titleClass,
                usesSummaryLayout
                  ? "max-w-2xl text-[1.25rem] leading-[1.32] sm:text-[1.45rem]"
                  : compact || usesStackedLayout
                    ? "text-[1.35rem] leading-[1.34]"
                    : "text-[1.55rem] leading-[1.34]",
              )}
            >
              {text(recommendation.title)}
            </h3>
            <p
              className={cn(
                usesSummaryLayout ? "max-w-[38rem]" : "max-w-4xl",
                bodyClass,
                usesSummaryLayout
                  ? "text-[0.96rem] leading-7"
                  : compact
                    ? "text-[1rem] leading-8"
                    : "text-[1.06rem] leading-8",
              )}
            >
              {text(presentation.whyNow)}
            </p>
            {cta || secondaryCta || footer ? (
              <div className={outletCardClass}>
                <div
                  className="flex flex-col gap-4"
                >
                  <div className="min-w-0 max-w-3xl space-y-2">
                    <p
                      className={cn(
                        "text-xs font-medium",
                        outletLabelClass,
                      )}
                    >
                      {english ? "Recommended outlet" : "建议动作出口"}
                    </p>
                    <p className={cn("text-sm leading-7", outletBodyClass)}>
                      {text(actionOutletCopy)}
                    </p>
                  </div>
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    {cta}
                    {secondaryCta}
                  </div>
                </div>
                {footer ? (
                  <div className={cn("mt-3 text-xs", footerClass)}>{footer}</div>
                ) : null}
              </div>
            ) : null}
          </header>

          {usesSummaryLayout ? null : (
            <>
              <NarrativeSection
                label={english ? "Why now" : "为什么是现在"}
                tone="slate"
                surfaceTone={resolvedSurfaceTone}
              >
                {text(presentation.whyNow)}
              </NarrativeSection>

              <NarrativeSection
                label={english ? "Key evidence" : "关键依据"}
                tone="violet"
                highlights={presentation.supportingHighlights}
                surfaceTone={resolvedSurfaceTone}
              >
                {text(presentation.evidenceLead)}
              </NarrativeSection>

              <NarrativeSection
                label={english ? "If you do not push now" : "如果现在不推进"}
                tone="amber"
                surfaceTone={resolvedSurfaceTone}
              >
                {text(presentation.ifNoAction)}
              </NarrativeSection>

              <NarrativeSection
                label={english ? "Expected impact" : "预计影响"}
                tone="sky"
                surfaceTone={resolvedSurfaceTone}
              >
                {text(presentation.expectedImpact)}
              </NarrativeSection>

              <NarrativeSection
                label={
                  presentation.decisionRole === "defer"
                    ? english
                      ? "Why defer this for now"
                      : "为什么现在先不做"
                    : english
                      ? "Why it ranks here"
                      : "为什么它排在这个位置"
                }
                tone={presentation.decisionRole === "defer" ? "amber" : "slate"}
                surfaceTone={resolvedSurfaceTone}
              >
                {displayTradeoffLine}
              </NarrativeSection>
            </>
          )}
        </article>

        <aside
          className={cn(
            "space-y-3",
            usesSummaryLayout
              ? "grid gap-3 space-y-0"
              : usesStackedLayout
                ? "grid gap-3 space-y-0 md:grid-cols-3"
                : undefined,
          )}
        >
          <JudgementSignal
            icon={AlertTriangle}
            label={english ? "Current top blocker" : "当前最大阻塞"}
            value={
              text(presentation.currentBlocker) ||
              (english
                ? "No explicit blocker is active, but the system still recommends re-anchoring momentum first."
                : "当前没有明确阻塞，但建议优先把节奏重新钉住。")
            }
            tone={presentation.currentBlocker ? "danger" : "neutral"}
            surfaceTone={resolvedSurfaceTone}
          />
          <JudgementSignal
            icon={Clock3}
            label={english ? "Commitment pressure" : "当前承诺压力"}
            value={
              text(presentation.currentCommitment) ||
              (english
                ? "No major overdue commitment is active, so the system can prioritize lower-friction momentum actions."
                : "当前没有显著逾期承诺，可以优先做低阻力推进动作。")
            }
            tone={presentation.currentCommitment ? "warning" : "neutral"}
            surfaceTone={resolvedSurfaceTone}
          />
          <JudgementSignal
            icon={ShieldCheck}
            label={english ? "Policy boundary" : "策略边界"}
            value={
              text(presentation.policyHint) ||
              (english
                ? `The current policy result is "${presentation.policyResultLabel}", and the system will handle this action inside that boundary.`
                : `当前策略结果为“${presentation.policyResultLabel}”，Helm 会按这个边界处理该动作。`)
            }
            tone={
              recommendation.policyResult === ActionExecutionMode.FORBIDDEN
                ? "danger"
                : recommendation.policyResult ===
                    ActionExecutionMode.REQUIRES_APPROVAL
                  ? "approval"
                  : "info"
            }
            surfaceTone={resolvedSurfaceTone}
          />
        </aside>
      </div>

      {!usesSummaryLayout && presentation.personalizationHint ? (
        <div
          className={cn(
            "mt-4 rounded-[24px] px-4 py-4",
            usesDarkSurface
              ? "border border-[color:var(--status-success-border)]/[0.18] bg-[color:var(--accent-success)]/[0.08]"
              : "workspace-note-card",
          )}
          data-tone={usesDarkSurface ? undefined : "emerald"}
        >
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "p-2",
                usesDarkSurface
                  ? "rounded-full border border-[color:var(--status-success-border)]/20 bg-[color:var(--accent-success)]/10 text-[color:var(--status-success-text)]"
                  : "workspace-note-icon-shell text-[color:var(--status-success-text)]",
              )}
            >
              <BrainCircuit className="h-4 w-4" />
            </div>
            <div>
              <p
                className={cn(
                  "text-sm font-medium",
                  usesDarkSurface
                    ? "text-[#f8fafc]"
                    : "text-[color:var(--foreground)]",
                )}
              >
                {english
                  ? "The system is learning your operating habits"
                  : "系统正在学习你的推进习惯"}
              </p>
              <p
                className={cn(
                  "mt-1 text-sm leading-6",
                  usesDarkSurface
                    ? "text-[#d7e3f1]"
                    : "text-[color:var(--muted-foreground)]",
                )}
              >
                {text(presentation.personalizationHint)}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {!usesSummaryLayout && presentation.learnedPatternSummary.length ? (
        <div
          className={cn(
            "mt-4 rounded-[24px] px-4 py-4",
            usesDarkSurface
              ? "border border-[color:var(--accent)]/[0.18] bg-[color:var(--accent)]/[0.08]"
              : "workspace-note-card",
          )}
          data-tone={usesDarkSurface ? undefined : "violet"}
        >
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "p-2",
                usesDarkSurface
                  ? "rounded-full border border-[color:var(--accent)]/20 bg-[color:var(--accent)]/10 text-[color:var(--accent)]"
                  : "workspace-note-icon-shell text-[color:var(--accent)]",
              )}
            >
              <BrainCircuit className="h-4 w-4" />
            </div>
            <div>
              <p
                className={cn(
                  "text-sm font-medium",
                  usesDarkSurface
                    ? "text-[#f8fafc]"
                    : "text-[color:var(--foreground)]",
                )}
              >
                {english
                  ? "What the system recently learned"
                  : "系统最近学到了什么"}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {presentation.learnedPatternSummary.map((item) => (
                  <span
                    key={item}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-medium",
                      usesDarkSurface
                        ? "border border-[color:var(--accent)]/[0.18] bg-white/[0.06] text-[#edf4ff]"
                        : "workspace-note-chip border-[color:var(--accent-soft)] bg-[color:var(--accent-soft)] text-[color:var(--accent)]",
                    )}
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {!usesSummaryLayout && presentation.llmHint ? (
        <div
          className={cn(
            "mt-4 rounded-[24px] px-4 py-4",
            usesDarkSurface
              ? "border border-[color:var(--status-info-border)]/[0.18] bg-[color:var(--accent)]/[0.08]"
              : "workspace-note-card",
          )}
          data-tone={usesDarkSurface ? undefined : "sky"}
        >
          <p
            className={cn(
              "text-sm leading-6",
              usesDarkSurface
                ? "text-[#d7e3f1]"
                : "text-[color:var(--foreground)]",
            )}
          >
            {presentation.llmHint}
          </p>
        </div>
      ) : null}

      <RecommendationEvidenceDisclosure
        recommendationId={recommendation.recommendationId}
        sourcePage={sourcePage}
        evidenceSummary={presentation.evidenceSummary}
        explanation={presentation.explanation}
        supportingHighlights={presentation.supportingHighlights}
        briefingSummary={presentation.briefingSummary}
        ifNoAction={presentation.ifNoAction}
      />
    </div>
  );
}

function JudgementSignal({
  icon: Icon,
  label,
  value,
  tone,
  surfaceTone = "dark",
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone: "danger" | "warning" | "approval" | "info" | "neutral";
  surfaceTone?: "dark" | "light" | "adaptive";
}) {
  const usesDarkSurface = surfaceTone === "dark";
  const toneClasses =
    usesDarkSurface
      ? tone === "danger"
        ? "border-[rgba(252,165,165,0.2)] bg-[rgba(248,113,113,0.09)] text-[#fecaca]"
        : tone === "warning"
          ? "border-[rgba(252,211,77,0.22)] bg-[rgba(252,211,77,0.09)] text-[#fde68a]"
          : tone === "approval"
            ? "border-[rgba(147,197,253,0.22)] bg-[rgba(96,165,250,0.09)] text-[#dbeafe]"
            : tone === "info"
              ? "border-[rgba(125,211,252,0.22)] bg-[rgba(56,189,248,0.09)] text-[#e0f2fe]"
              : "border-white/[0.12] bg-white/[0.06] text-[#edf4ff]"
      : tone === "danger"
        ? "border-[color:var(--status-danger-border)] bg-[color:var(--status-danger-bg)] text-[color:var(--status-danger-text)]"
        : tone === "warning"
          ? "border-[color:var(--status-warning-border)] bg-[color:var(--status-warning-bg)] text-[color:var(--status-warning-text)]"
          : tone === "approval"
            ? "border-[color:var(--accent-soft)] bg-[color:var(--accent-soft)] text-[color:var(--accent)]"
            : tone === "info"
              ? "border-[color:var(--status-info-border)] bg-[color:var(--status-info-bg)] text-[color:var(--status-info-text)]"
              : "border-[color:var(--border)] bg-[color:color-mix(in_oklab,var(--background-elevated)_86%,var(--surface-subtle)_14%)] text-[color:var(--foreground)]";

  return (
    <div
      className={cn(
        "rounded-[20px] border px-4 py-4 shadow-[0_18px_32px_-28px_rgba(15,23,42,0.3)]",
        toneClasses,
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "p-2 shadow-sm",
            usesDarkSurface
              ? "rounded-full border border-white/10 bg-black/25"
              : "workspace-note-icon-shell rounded-full",
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p
            className={cn(
              "text-xs font-medium",
              usesDarkSurface
                ? "text-[#cbd5e1]"
                : "text-[color:var(--muted-foreground)]",
            )}
          >
            {label}
          </p>
          <p
            className={cn(
              "mt-2 break-words text-[15px] leading-7",
              usesDarkSurface ? "text-[#f1f5f9]" : "text-inherit",
            )}
          >
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

function NarrativeSection({
  label,
  children,
  tone = "slate",
  highlights,
  surfaceTone = "dark",
}: {
  label: string;
  children: ReactNode;
  tone?: "slate" | "sky" | "violet" | "amber";
  highlights?: string[];
  surfaceTone?: "dark" | "light" | "adaptive";
}) {
  const usesDarkSurface = surfaceTone === "dark";
  const accentClasses =
    tone === "sky"
      ? "before:bg-[color:var(--status-info-bg)]0"
      : tone === "violet"
        ? "before:bg-[color:var(--accent-soft)]0"
        : tone === "amber"
          ? "before:bg-[color:var(--status-warning-bg)]0"
          : "before:bg-[color:var(--dark-inset-surface)]/75";

  return (
    <section
      className={cn(
        "relative border-b pb-6 before:absolute before:left-0 before:top-0 before:h-7 before:w-1 before:rounded-full",
        usesDarkSurface ? "border-white/10" : "border-[color:var(--border)]",
        accentClasses,
      )}
    >
      <div className="pl-5">
        <p
          className={cn(
            "text-xs font-medium",
            usesDarkSurface
              ? "text-[#94a3b8]"
              : "text-[color:var(--muted-foreground)]",
          )}
        >
          {label}
        </p>
        <p
          className={cn(
            "mt-3 text-[1.02rem] leading-8",
            usesDarkSurface
              ? "text-[#d7e3f1]"
              : "text-[color:var(--foreground)]",
          )}
        >
          {children}
        </p>
        {highlights?.length ? (
          <div className="mt-4 space-y-2">
            {highlights.slice(0, 3).map((item) => (
              <div
                key={item}
                className={cn(
                  "rounded-2xl px-4 py-3",
                  usesDarkSurface
                    ? "border border-white/10 bg-white/[0.05]"
                    : "workspace-panel-muted",
                )}
              >
                <p
                  className={cn(
                    "text-sm leading-7",
                    usesDarkSurface
                      ? "text-[#d7e3f1]"
                      : "text-[color:var(--foreground)]",
                  )}
                >
                  {item}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function RecommendationGhostCTA({ label }: { label: string }) {
  return (
    <Button size="sm" variant="secondary">
      {label}
    </Button>
  );
}
