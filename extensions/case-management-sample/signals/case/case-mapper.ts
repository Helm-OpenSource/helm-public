import {
  buildSignalIdentity,
  type SignalCandidate,
  type SignalGapField,
  type SignalSeverity,
} from "../types";

export type SampleCaseStage =
  | "active_followup"
  | "review_required"
  | "evidence_gap"
  | "closed";

export type SampleCaseBlockedReason =
  | "boundary_attempt"
  | "missing_evidence"
  | "stale_owner"
  | null;

export type SampleCaseRecord = {
  workspaceId: string;
  caseId: string;
  ownerRefId: string;
  stage: SampleCaseStage;
  ageDays: number;
  priorityScore: number;
  evidenceCount: number;
  blockedReason: SampleCaseBlockedReason;
  observedDate: string;
};

export type SampleCaseSignalPayload = {
  caseId: string;
  stage: SampleCaseStage;
  ageDays: number;
  priorityScore: number;
  blocker: Exclude<SampleCaseBlockedReason, null> | "none";
  reviewRequired: boolean;
  nextAction: "collect_evidence" | "review_boundary" | "continue_followup";
};

export function mapCaseRecordToSignals(
  record: SampleCaseRecord,
): Array<SignalCandidate<SampleCaseSignalPayload>> {
  if (record.stage === "closed") return [];

  const severity = deriveSeverity(record);
  const blocker = record.blockedReason ?? "none";
  const reviewRequired =
    record.stage === "review_required" ||
    record.stage === "evidence_gap" ||
    blocker === "boundary_attempt";

  return [
    {
      identity: buildSignalIdentity({
        workspaceId: record.workspaceId,
        sourceWindowKey: `${record.caseId}:${record.observedDate}`,
        signalKey: `case-review:${record.caseId}`,
        severity,
      }),
      scope: {
        owner: { kind: "employee", refId: record.ownerRefId },
        managementScope: {
          workspaceId: record.workspaceId,
          visibleToOwners: true,
          visibleToAdmins: true,
          visibleToManagerChain: reviewRequired ? "sample-review-chain" : null,
          employeePersonalDetailVisibility: reviewRequired
            ? "owner_and_manager_chain"
            : "owner_only",
        },
      },
      source: "external_case_backend",
      sourceRef: {
        sourceKind: "case_system",
        sourceId: record.caseId,
        sourceRef: `case_system:${record.caseId}`,
      },
      subject: {
        kind: "case",
        refId: record.caseId,
        label: record.caseId,
      },
      resourceId: record.caseId,
      payload: {
        caseId: record.caseId,
        stage: record.stage,
        ageDays: record.ageDays,
        priorityScore: record.priorityScore,
        blocker,
        reviewRequired,
        nextAction: deriveNextAction(record),
      },
      observedAt: new Date(`${record.observedDate}T00:00:00.000Z`),
      confidence: record.evidenceCount > 0 ? "trusted" : "degraded",
      gapFields: deriveGapFields(record, severity),
      trace: {
        connectorTraceId: `sample-case:${record.caseId}:${record.observedDate}`,
      },
    },
  ];
}

function deriveSeverity(record: SampleCaseRecord): SignalSeverity {
  if (record.blockedReason === "boundary_attempt") return "critical";
  if (record.stage === "evidence_gap" || record.evidenceCount === 0) return "breach";
  if (record.priorityScore >= 80 || record.ageDays >= 5) return "warning";
  return "info";
}

function deriveNextAction(record: SampleCaseRecord): SampleCaseSignalPayload["nextAction"] {
  if (record.blockedReason === "boundary_attempt") return "review_boundary";
  if (record.stage === "evidence_gap" || record.evidenceCount === 0) {
    return "collect_evidence";
  }
  return "continue_followup";
}

function deriveGapFields(
  record: SampleCaseRecord,
  severity: SignalSeverity,
): readonly SignalGapField[] {
  const gaps: SignalGapField[] = [];

  if (record.evidenceCount === 0 || record.stage === "evidence_gap") {
    gaps.push({
      field: "evidence",
      severity: "breach",
      detail: "case has no reviewable evidence attached",
    });
  }

  if (record.blockedReason === "boundary_attempt") {
    gaps.push({
      field: "boundary_review",
      severity,
      detail:
        "boundary_attempt requires a human review packet before any customer-visible action",
    });
  }

  if (record.blockedReason === "stale_owner") {
    gaps.push({
      field: "owner",
      severity,
      detail: "case owner needs review before owner-sensitive follow-up",
    });
  }

  if (record.stage === "review_required" && gaps.length === 0) {
    gaps.push({
      field: "followup",
      severity,
      detail: "review_required case needs an explicit reviewer-owned next step",
    });
  }

  return gaps;
}
