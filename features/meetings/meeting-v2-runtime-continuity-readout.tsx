import { Button } from "@/components/ui/button";
import type { MeetingRuntimeSummary } from "@/lib/helm-v2/meeting-action-pack-runtime";
import {
  renderRuntimeStatusLabel,
  type MeetingV2RuntimeContinuityRemediationAction,
  type MeetingV2RuntimeContinuityRemediationPreview,
} from "@/features/meetings/meeting-v2-runtime-shared";

type MeetingV2RuntimeContinuityReadoutProps = {
  runtime: MeetingRuntimeSummary;
  english: boolean;
  text: (value: string) => string;
  continuityRemediationPreview: MeetingV2RuntimeContinuityRemediationPreview | null;
  onRunContinuityRemediation: (action: MeetingV2RuntimeContinuityRemediationAction) => void;
};

export function MeetingV2RuntimeContinuityReadout({
  runtime,
  english,
  text,
  continuityRemediationPreview,
  onRunContinuityRemediation,
}: MeetingV2RuntimeContinuityReadoutProps) {
  const v21 = runtime.v21;
  if (!v21) return null;

  return (
    <details open className="theme-surface-panel rounded-2xl px-4 py-4">
      <summary className="cursor-pointer text-sm font-semibold text-[color:var(--foreground)]">
        {english ? "Background continuity readout" : "后台运行摘要"}
      </summary>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <p className="text-xs font-semibold text-[color:var(--muted-foreground)]">{english ? "Current state" : "当前状态"}</p>
          {v21.continuity.notebookState ? (
            <>
              <p className="mt-2 text-sm leading-6 text-[color:var(--foreground)]">{text(v21.continuity.notebookState.objective)}</p>
              <div className="mt-2 space-y-1 text-sm text-[color:var(--muted-foreground)]">
                <p>{english ? "Review state" : "复核状态"} · {renderRuntimeStatusLabel(v21.continuity.notebookState.reviewState.toUpperCase(), english)}</p>
                {v21.continuity.notebookState.confirmedFacts.length ? (
                  <p>{english ? "Confirmed" : "已确认"} · {v21.continuity.notebookState.confirmedFacts.slice(0, 2).map(text).join(" / ")}</p>
                ) : null}
              </div>
            </>
          ) : (
            <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">{english ? "No background note yet." : "当前还没有后台记录。"}</p>
          )}
        </div>
        <div>
          <p className="text-xs font-semibold text-[color:var(--muted-foreground)]">{english ? "Saved state" : "保存状态"}</p>
          <p className="mt-2 text-sm text-[color:var(--muted)]">
            {v21.latestCheckpoint
              ? `${text(v21.latestCheckpoint.label)} · ${renderRuntimeStatusLabel(v21.latestCheckpoint.status.toUpperCase(), english)}`
              : english
                ? "No saved point yet."
                : "当前没有恢复点。"}
          </p>
          <div className="mt-2 space-y-1 text-sm text-[color:var(--muted-foreground)]">
            <p>{text(v21.continuity.budgetPosture.reason)}</p>
            <p>{text(v21.continuity.budgetPosture.savingsSummary)}</p>
            <p>
              {english
                ? `${v21.payloads.items.filter((item) => item.activeInContext).length} active / ${v21.payloads.total} saved context items`
                : `当前使用 ${v21.payloads.items.filter((item) => item.activeInContext).length} 条 / 已保存资料 ${v21.payloads.total} 条`}
            </p>
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold text-[color:var(--muted-foreground)]">{english ? "Evidence and blockers" : "依据与阻塞"}</p>
          <ul className="mt-2 space-y-1 text-sm text-[color:var(--muted)]">
            {v21.continuity.notebookState?.blockers.slice(0, 2).map((item, index) => (
              <li key={`blocker-${index}`}>- {text(item)}</li>
            ))}
            {v21.continuity.notebookState?.openQuestions.slice(0, 2).map((item, index) => (
              <li key={`question-${index}`}>- {text(item)}</li>
            ))}
            {v21.truthConflicts.slice(0, 2).map((item) => (
              <li key={item.id}>- {text(item.summary)}</li>
            ))}
            {!v21.continuity.notebookState?.blockers.length &&
            !v21.continuity.notebookState?.openQuestions.length &&
            !v21.truthConflicts.length ? (
              <li>- {english ? "No open blocker currently needs attention." : "当前没有需要处理的阻塞。"}</li>
            ) : null}
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold text-[color:var(--muted-foreground)]">{english ? "Next move" : "下一步动作"}</p>
          <ul className="mt-2 space-y-1 text-sm text-[color:var(--muted)]">
            {v21.continuity.notebookState?.nextActions.slice(0, 3).map((item, index) => (
              <li key={`next-${index}`}>- {text(item)}</li>
            ))}
            {!v21.continuity.notebookState?.nextActions.length ? (
              <li>- {english ? "Keep the meeting in review until a concrete next step appears." : "保持复核，等明确动作后再推进。"}</li>
            ) : null}
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold text-[color:var(--muted-foreground)]">{english ? "Recovery control" : "恢复控制"}</p>
          <p className="mt-2 text-sm font-semibold text-[color:var(--foreground)]" data-testid="continuity-recovery-state">
            {v21.continuity.recovery.state} · {v21.continuity.recovery.failureTaxonomy}
          </p>
          <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">{v21.continuity.recovery.summary}</p>
          <div className="mt-2 space-y-1 text-sm text-[color:var(--muted-foreground)]">
            <p>{v21.continuity.recovery.operatorAction}</p>
            {v21.continuity.recovery.reviewReasons.length ? (
              <p>
                review reasons · {v21.continuity.recovery.reviewReasons.join(" / ")}
              </p>
            ) : null}
            {v21.continuity.recovery.blockedReasons.length ? (
              <p>
                blocked reasons · {v21.continuity.recovery.blockedReasons.join(" / ")}
              </p>
            ) : null}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {v21.continuity.recovery.allowedActions.map((action) => (
              <Button
                key={action}
                variant="secondary"
                className="relative z-10 scroll-mt-32"
                data-testid={`continuity-remediation-${action.toLowerCase()}`}
                onClick={() => onRunContinuityRemediation(action)}
              >
                {action === "SAVE_RECOVERY_CHECKPOINT"
                  ? english
                    ? "Save recovery point"
                    : "保存恢复点"
                  : action === "RESUME_CHECKPOINT"
                    ? english
                      ? "Restore recovery point"
                      : "回到恢复点"
                    : english
                      ? "Refresh context"
                      : "重新整理上下文"}
              </Button>
            ))}
            {!v21.continuity.recovery.allowedActions.length ? (
              <p className="text-xs leading-6 text-[color:var(--muted-foreground)]">
                No bounded remediation action is available here.
              </p>
            ) : null}
            {continuityRemediationPreview ? (
              <div className="w-full rounded-xl border border-[color:var(--border)]/80 bg-[color:var(--surface-subtle)]/70 px-3 py-2 text-xs leading-5 text-[color:var(--muted)]">
                <p>{`${continuityRemediationPreview.executionStatus} · ${continuityRemediationPreview.action}`}</p>
                {continuityRemediationPreview.rollbackAnchorLabel ? (
                  <p>
                    {`rollback anchor · ${continuityRemediationPreview.rollbackAnchorLabel}${
                      continuityRemediationPreview.action === "RESUME_CHECKPOINT" ? " · RESUMED" : ""
                    }`}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold text-[color:var(--muted-foreground)]">{english ? "Operating guidance" : "操作指引"}</p>
          <p className="mt-2 text-sm font-semibold text-[color:var(--foreground)]">{text(v21.continuity.sop.title)}</p>
          <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">{text(v21.continuity.sop.summary)}</p>
          <ul className="mt-2 space-y-1 text-sm text-[color:var(--muted-foreground)]">
            {v21.continuity.sop.evidenceChecklist.slice(0, 3).map((item, index) => (
              <li key={`${item}-${index}`}>- {text(item)}</li>
            ))}
            <li>- {text(v21.continuity.sop.escalationRule)}</li>
          </ul>
          <p className="mt-2 text-xs leading-6 text-[color:var(--muted-foreground)]">{text(v21.continuity.sop.boundaryNote)}</p>
        </div>
        <div data-testid="continuity-remediation-analytics">
          <p className="text-xs font-semibold text-[color:var(--muted-foreground)]">{english ? "Remediation analytics" : "修复分析"}</p>
          <p className="mt-2 text-sm font-semibold text-[color:var(--foreground)]">{v21.continuity.analytics.repeatPattern.status}</p>
          <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">{text(v21.continuity.analytics.repeatPattern.summary)}</p>
          <p className="mt-2 text-xs leading-6 text-[color:var(--muted-foreground)]">
            attempts {v21.continuity.analytics.totalAttempts} · applied {v21.continuity.analytics.appliedCount} · review {v21.continuity.analytics.reviewRequiredCount} · blocked {v21.continuity.analytics.blockedCount}
          </p>
        </div>
        <div data-testid="continuity-remediation-effectiveness">
          <p className="text-xs font-semibold text-[color:var(--muted-foreground)]">{english ? "Remediation effectiveness" : "修复有效性"}</p>
          <p className="mt-2 text-sm font-semibold text-[color:var(--foreground)]">{v21.continuity.effectiveness.latestOutcome}</p>
          <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">{text(v21.continuity.effectiveness.latestSummary)}</p>
          <p className="mt-2 text-xs leading-6 text-[color:var(--muted-foreground)]">
            effective {v21.continuity.effectiveness.effectiveCount} · partial {v21.continuity.effectiveness.partialCount} · ineffective {v21.continuity.effectiveness.ineffectiveCount} · no signal {v21.continuity.effectiveness.noSignalCount}
          </p>
        </div>
        <div data-testid="continuity-recovery-calibration">
          <p className="text-xs font-semibold text-[color:var(--muted-foreground)]">{english ? "Recovery calibration" : "恢复校准"}</p>
          <p className="mt-2 text-sm font-semibold text-[color:var(--foreground)]">
            {v21.continuity.calibration.rawState} -&gt; {v21.continuity.calibration.calibratedState} · {v21.continuity.calibration.confidence}
          </p>
          <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">{text(v21.continuity.calibration.summary)}</p>
          <p className="mt-2 text-xs leading-6 text-[color:var(--muted-foreground)]">{v21.continuity.calibration.reasons.map(text).join(" / ")}</p>
        </div>
        <div data-testid="continuity-evidence-surface">
          <p className="text-xs font-semibold text-[color:var(--muted-foreground)]">{english ? "Evidence surface" : "证据面"}</p>
          <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
            Repeat pattern · {v21.continuity.analytics.repeatPattern.summary}
          </p>
          <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
            Blocked because · {v21.continuity.recovery.blockedReasons.length ? v21.continuity.recovery.blockedReasons.join(" / ") : v21.continuity.recovery.operatorAction}
          </p>
          <ul className="mt-2 space-y-1 text-xs leading-5 text-[color:var(--muted-foreground)]">
            {v21.continuity.evidence.items.slice(0, 4).map((item, index) => (
              <li key={`continuity-evidence-${index}`}>- {item}</li>
            ))}
            {!v21.continuity.evidence.items.length ? (
              <li>- {v21.continuity.evidence.summary}</li>
            ) : null}
          </ul>
        </div>
        <div data-testid="continuity-sop">
          <p className="text-xs font-semibold text-[color:var(--muted-foreground)]">{english ? "SOP" : "SOP"}</p>
          <p className="mt-2 text-sm font-semibold text-[color:var(--foreground)]">{v21.continuity.sop.title}</p>
          <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">{v21.continuity.sop.summary}</p>
          <p className="mt-2 text-xs leading-6 text-[color:var(--muted-foreground)]">
            evidence collection · {v21.continuity.sop.evidenceChecklist.join(" / ")}
          </p>
        </div>
        <div data-testid="continuity-runbook">
          <p className="text-xs font-semibold text-[color:var(--muted-foreground)]">{english ? "Runbook" : "运行手册"}</p>
          <p className="mt-2 text-sm font-semibold text-[color:var(--foreground)]">{v21.continuity.runbook.title}</p>
          <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">{v21.continuity.runbook.summary}</p>
          <ul className="mt-2 space-y-1 text-xs leading-5 text-[color:var(--muted-foreground)]">
            {v21.continuity.runbook.steps.map((item, index) => (
              <li key={`continuity-runbook-${index}`}>- {item}</li>
            ))}
            <li>- {v21.continuity.runbook.boundaryNote}</li>
          </ul>
        </div>
        <div className="md:col-span-2" data-testid="continuity-pilot-review">
          <p className="text-xs font-semibold text-[color:var(--muted-foreground)]">{english ? "Pilot review" : "试点复核"}</p>
          <p className="mt-2 text-sm font-semibold text-[color:var(--foreground)]">
            {v21.continuity.pilotReview.failureTaxonomy} · threshold {v21.continuity.pilotReview.recommendedIneffectiveThreshold} · risk {v21.continuity.pilotReview.riskBand}
          </p>
          <div className="mt-2 grid gap-2 text-xs leading-5 text-[color:var(--muted-foreground)] md:grid-cols-2">
            <p>pilot workspace {v21.continuity.pilotReview.workspaceSizeBand} · session density {v21.continuity.pilotReview.sessionDensityBand}</p>
            <p>meeting cadence {v21.continuity.pilotReview.meetingFrequencyBand} · failure history {v21.continuity.pilotReview.failureHistoryBand}</p>
            <p>participants {v21.continuity.pilotReview.participantRolePosture} · sample {v21.continuity.pilotReview.sampleCoverageBand}</p>
            <p>stability {v21.continuity.pilotReview.stabilityBand} · stability confidence {v21.continuity.pilotReview.stabilityConfidenceBand}</p>
            <p>scale-up {text(v21.continuity.pilotReview.stabilityScaleUpSummary)}</p>
            <p>scale-up recheck {text(v21.continuity.pilotReview.stabilityScaleUpRecheckSummary)}</p>
            <p>subgroup stability drift review {text(v21.continuity.pilotReview.subgroupStabilityDriftSummary)}</p>
            <p>cohort aging comparison {text(v21.continuity.pilotReview.subgroupCohortAgingSummary)}</p>
            <p>cohort aging scale-up review {text(v21.continuity.pilotReview.subgroupDriftAgingScaleUpSummary)}</p>
            <p>subgroup drift long-term cohort aging review {text(v21.continuity.pilotReview.subgroupDriftLongTermCohortAgingSummary)}</p>
            <p>subgroup drift long-term sample expansion review {text(v21.continuity.pilotReview.subgroupDriftLongTermSampleExpansionSummary)}</p>
            <p>sample expansion refinement review {text(v21.continuity.pilotReview.subgroupDriftLongTermSampleExpansionRefinementSummary)}</p>
            <p>interval {v21.continuity.pilotReview.confidenceInterval} confidence interval · {text(v21.continuity.pilotReview.intervalWordingSummary)}</p>
            <p>wording drift audit {text(v21.continuity.pilotReview.intervalWordingDriftSummary)}</p>
            <p>wording drift tracking {text(v21.continuity.pilotReview.wordingDriftTrackingSummary)}</p>
            <p>interval consistency guidance {text(v21.continuity.pilotReview.intervalConsistencyGuidanceSummary)}</p>
            <p>interval wording aging audit {text(v21.continuity.pilotReview.intervalWordingAgingSummary)}</p>
            <p>cross-surface interval wording regression review {text(v21.continuity.pilotReview.intervalWordingRegressionSummary)}</p>
            <p>cross-surface interval wording consistency audit {text(v21.continuity.pilotReview.intervalWordingConsistencyAuditSummary)}</p>
            <p>cross-surface interval wording regression audit {text(v21.continuity.pilotReview.intervalWordingRegressionAuditSummary)}</p>
            <p>cross-readout interval wording regression audit {text(v21.continuity.pilotReview.intervalWordingCrossReadoutAuditSummary)}</p>
            <p>cross-readout interval wording regression refinement {text(v21.continuity.pilotReview.intervalWordingCrossReadoutRegressionRefinementSummary)}</p>
            <p>outcome {v21.continuity.pilotReview.outcomeCorrelationBand} · horizon drift {text(v21.continuity.pilotReview.longHorizonSummary)}</p>
            <p>long-term SOP {text(v21.continuity.pilotReview.longTermSopImpactSummary)}</p>
            <p>material impact {v21.continuity.pilotReview.longTermMaterialImpactBand} · material impact on long-term outcomes {text(v21.continuity.pilotReview.longTermMaterialImpactSummary)}</p>
            <p>material impact review {text(v21.continuity.pilotReview.longTermMaterialImpactReviewSummary)}</p>
            <p>material impact audit {text(v21.continuity.pilotReview.longTermMaterialImpactAuditSummary)}</p>
            <p>material impact pattern aging review {text(v21.continuity.pilotReview.materialImpactPatternAgingSummary)}</p>
            <p>material impact sampling review {text(v21.continuity.pilotReview.materialImpactSamplingSummary)}</p>
            <p>material impact sampling aging review {text(v21.continuity.pilotReview.materialImpactSamplingAgingSummary)}</p>
            <p>material impact sampling aging refinement {text(v21.continuity.pilotReview.materialImpactAgingRefinementSummary)}</p>
            <p>material impact sampling aging audit {text(v21.continuity.pilotReview.materialImpactSamplingAgingAuditSummary)}</p>
            <p>material impact sampling aging refinement audit {text(v21.continuity.pilotReview.materialImpactSamplingAgingRefinementAuditSummary)}</p>
            <p>guidance {text(v21.continuity.pilotReview.guidanceRefinementSummary)}</p>
            <p>operator handling {text(v21.continuity.pilotReview.operatorHandlingSummary)}</p>
            <p>variance {text(v21.continuity.pilotReview.varianceSummary)}</p>
            <p>runbook evidence collection {text(v21.continuity.runbook.summary)}</p>
          </div>
        </div>
      </div>
    </details>
  );
}
