/**
 * Helm Business Advancement — P0-REQ-05 Trace Timeline + ROI Scorecard Eval
 *
 * Planning-only offline evaluator. It scores synthetic trace+ROI cases against
 * the acceptance criteria of P0-REQ-05:
 *   - Trace timeline must answer: source, transformation, reviewer, decision,
 *     boundary, and final posture.
 *   - ROI scorecard must measure: 48h follow-up rate, deals rescued, manager
 *     review time saved, draft adoption, prevented wrong commitment, audit
 *     trace coverage.
 *
 * NOT a runtime collector, NOT a DB reader, NOT an API. No live customer data.
 */

import traceRoiFixturePack from "@/evals/business-advancement-trace-roi/trace-roi-cases.json";

export type TraceFinalPosture =
  | "must_push_ready"
  | "review_required"
  | "watch_only"
  | "rejected";

export type TraceReviewDecision =
  | "accept"
  | "downgrade"
  | "quarantine"
  | "reject";

export interface TraceMeetingExtraction {
  readonly source: string;
  readonly extractedAtIso: string;
}

export interface TraceMustPushCreation {
  readonly mustPushItemId: string;
  readonly createdAtIso: string;
  readonly ownerSuggestionRole: string;
}

export interface TraceReviewRecord {
  readonly reviewer: string;
  readonly decidedAtIso: string;
  readonly decision: TraceReviewDecision;
  readonly boundaryNote: string;
  readonly finalPosture: TraceFinalPosture;
}

export interface TraceDraftPreparation {
  readonly draftId: string;
  readonly preparedAtIso: string;
  readonly adopted: boolean;
  readonly frozen?: boolean;
}

export interface TraceCrmWriteBack {
  readonly writeBackId: string;
  readonly previewedAtIso: string;
  readonly officialWritePerformed: boolean;
  readonly approvedByReviewer: boolean;
}

export interface TraceTimeline {
  readonly meetingExtraction: TraceMeetingExtraction;
  readonly mustPushCreation: TraceMustPushCreation;
  readonly reviewDecision: TraceReviewRecord;
  readonly draftPreparation: TraceDraftPreparation | null;
  readonly crmWriteBack: TraceCrmWriteBack | null;
}

export interface RoiOutcome {
  readonly followUpCompletedWithin48h: boolean;
  readonly dealRescued: boolean;
  readonly managerReviewTimeSavedMinutes: number;
  readonly draftAdopted: boolean;
  readonly preventedWrongCommitment: boolean;
}

export interface TraceRoiCase {
  readonly id: string;
  readonly scenario: string;
  readonly trace: TraceTimeline;
  readonly roiOutcome: RoiOutcome;
}

export interface TraceRoiTargets {
  readonly minimumTraceCoveragePercent: number;
  readonly minimumFollowUp48hCompletionPercent: number;
  readonly maximumWrongCommitmentIncidentCount: number;
  readonly minimumPreventedWrongCommitmentCount: number;
  readonly minimumDraftAdoptionPercent: number;
  readonly minimumDealsRescuedCount: number;
  readonly minimumManagerReviewTimeSavedMinutes: number;
}

export interface TraceRoiFixturePack {
  readonly version: string;
  readonly status: string;
  readonly redactionPosture: string;
  readonly boundary: string;
  readonly targets: TraceRoiTargets;
  readonly cases: readonly TraceRoiCase[];
}

export interface TraceCaseResult {
  readonly caseId: string;
  readonly traceCoveragePercent: number;
  readonly traceCoverageMissing: readonly TraceQuestion[];
  readonly wrongCommitmentIncident: boolean;
  readonly preventedWrongCommitment: boolean;
  readonly followUpWithin48h: boolean;
  readonly dealRescued: boolean;
  readonly draftAdopted: boolean;
  readonly draftPathApplicable: boolean;
  readonly managerReviewTimeSavedMinutes: number;
}

export type TraceQuestion =
  | "source"
  | "transformation"
  | "reviewer"
  | "decision"
  | "boundary"
  | "final_posture";

export interface TraceRoiScorecard {
  readonly followUp48hCompletionPercent: number;
  readonly dealsRescuedCount: number;
  readonly managerReviewTimeSavedMinutesTotal: number;
  readonly draftAdoptionPercent: number;
  readonly preventedWrongCommitmentCount: number;
  readonly auditTraceCoveragePercent: number;
  readonly wrongCommitmentIncidentCount: number;
}

export interface TraceRoiEvalSummary {
  readonly passed: boolean;
  readonly version: string;
  readonly totalCases: number;
  readonly caseResults: readonly TraceCaseResult[];
  readonly scorecard: TraceRoiScorecard;
  readonly failures: ReadonlyArray<{ caseId: string; reason: string }>;
}

const TRACE_QUESTIONS: readonly TraceQuestion[] = [
  "source",
  "transformation",
  "reviewer",
  "decision",
  "boundary",
  "final_posture",
];

export function runBusinessAdvancementTraceRoiEval(
  fixturePack: TraceRoiFixturePack = traceRoiFixturePack as TraceRoiFixturePack,
): TraceRoiEvalSummary {
  const caseResults = fixturePack.cases.map(evaluateCase);
  const scorecard = buildScorecard(caseResults);
  const failures = buildFailures(caseResults, scorecard, fixturePack.targets);

  return {
    passed: failures.length === 0,
    version: fixturePack.version,
    totalCases: caseResults.length,
    caseResults,
    scorecard,
    failures,
  };
}

function evaluateCase(item: TraceRoiCase): TraceCaseResult {
  const missing = collectMissingTraceAnswers(item.trace);
  const traceCoveragePercent = Math.round(
    ((TRACE_QUESTIONS.length - missing.length) / TRACE_QUESTIONS.length) * 100,
  );
  const wrongCommitmentIncident = isWrongCommitmentIncident(item.trace);
  const draftPathApplicable = item.trace.draftPreparation !== null;

  return {
    caseId: item.id,
    traceCoveragePercent,
    traceCoverageMissing: missing,
    wrongCommitmentIncident,
    preventedWrongCommitment: item.roiOutcome.preventedWrongCommitment,
    followUpWithin48h: item.roiOutcome.followUpCompletedWithin48h,
    dealRescued: item.roiOutcome.dealRescued,
    draftAdopted: item.roiOutcome.draftAdopted,
    draftPathApplicable,
    managerReviewTimeSavedMinutes: item.roiOutcome.managerReviewTimeSavedMinutes,
  };
}

function collectMissingTraceAnswers(trace: TraceTimeline): TraceQuestion[] {
  const missing: TraceQuestion[] = [];
  if (!trace.meetingExtraction.source.trim()) missing.push("source");
  if (
    !trace.mustPushCreation.mustPushItemId.trim() ||
    !trace.mustPushCreation.createdAtIso.trim()
  ) {
    missing.push("transformation");
  }
  if (!trace.reviewDecision.reviewer.trim()) missing.push("reviewer");
  if (!trace.reviewDecision.decision) missing.push("decision");
  if (!trace.reviewDecision.boundaryNote.trim()) missing.push("boundary");
  if (!trace.reviewDecision.finalPosture) missing.push("final_posture");
  return missing;
}

function isWrongCommitmentIncident(trace: TraceTimeline): boolean {
  if (!trace.crmWriteBack) {
    return false;
  }
  return (
    trace.crmWriteBack.officialWritePerformed &&
    !trace.crmWriteBack.approvedByReviewer
  );
}

function buildScorecard(caseResults: readonly TraceCaseResult[]): TraceRoiScorecard {
  const total = caseResults.length;
  const draftApplicable = caseResults.filter((c) => c.draftPathApplicable);
  return {
    followUp48hCompletionPercent: percent(
      caseResults.filter((c) => c.followUpWithin48h).length,
      total,
    ),
    dealsRescuedCount: caseResults.filter((c) => c.dealRescued).length,
    managerReviewTimeSavedMinutesTotal: caseResults.reduce(
      (sum, c) => sum + c.managerReviewTimeSavedMinutes,
      0,
    ),
    draftAdoptionPercent: percent(
      draftApplicable.filter((c) => c.draftAdopted).length,
      draftApplicable.length,
    ),
    preventedWrongCommitmentCount: caseResults.filter((c) => c.preventedWrongCommitment).length,
    auditTraceCoveragePercent: total === 0
      ? 0
      : Math.round(
          caseResults.reduce((sum, c) => sum + c.traceCoveragePercent, 0) / total,
        ),
    wrongCommitmentIncidentCount: caseResults.filter((c) => c.wrongCommitmentIncident).length,
  };
}

function buildFailures(
  caseResults: readonly TraceCaseResult[],
  scorecard: TraceRoiScorecard,
  targets: TraceRoiTargets,
): ReadonlyArray<{ caseId: string; reason: string }> {
  const failures: Array<{ caseId: string; reason: string }> = [];

  for (const result of caseResults) {
    if (result.traceCoverageMissing.length > 0) {
      failures.push({
        caseId: result.caseId,
        reason: `trace_missing:${result.traceCoverageMissing.join(",")}`,
      });
    }
    if (result.wrongCommitmentIncident) {
      failures.push({ caseId: result.caseId, reason: "wrong_commitment_incident" });
    }
  }

  if (scorecard.auditTraceCoveragePercent < targets.minimumTraceCoveragePercent) {
    failures.push({
      caseId: "__summary__",
      reason: `audit_trace_coverage:${scorecard.auditTraceCoveragePercent}`,
    });
  }
  if (scorecard.followUp48hCompletionPercent < targets.minimumFollowUp48hCompletionPercent) {
    failures.push({
      caseId: "__summary__",
      reason: `follow_up_48h_rate:${scorecard.followUp48hCompletionPercent}`,
    });
  }
  if (scorecard.wrongCommitmentIncidentCount > targets.maximumWrongCommitmentIncidentCount) {
    failures.push({
      caseId: "__summary__",
      reason: `wrong_commitment_incident_count:${scorecard.wrongCommitmentIncidentCount}`,
    });
  }
  if (scorecard.preventedWrongCommitmentCount < targets.minimumPreventedWrongCommitmentCount) {
    failures.push({
      caseId: "__summary__",
      reason: `prevented_wrong_commitment_count:${scorecard.preventedWrongCommitmentCount}`,
    });
  }
  if (scorecard.draftAdoptionPercent < targets.minimumDraftAdoptionPercent) {
    failures.push({
      caseId: "__summary__",
      reason: `draft_adoption_percent:${scorecard.draftAdoptionPercent}`,
    });
  }
  if (scorecard.dealsRescuedCount < targets.minimumDealsRescuedCount) {
    failures.push({
      caseId: "__summary__",
      reason: `deals_rescued_count:${scorecard.dealsRescuedCount}`,
    });
  }
  if (
    scorecard.managerReviewTimeSavedMinutesTotal <
    targets.minimumManagerReviewTimeSavedMinutes
  ) {
    failures.push({
      caseId: "__summary__",
      reason: `manager_review_time_saved_minutes:${scorecard.managerReviewTimeSavedMinutesTotal}`,
    });
  }

  return failures;
}

function percent(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 100);
}
