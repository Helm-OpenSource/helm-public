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

// Stage normalization for the ingestion boundary.
//
// External case backends do not emit the sample's four canonical stages — they
// emit their own status vocabulary (a real debt-collection backend uses e.g.
// `create` / `dealing` / `transfer` / `finish` / `close` / `processed` /
// `replied`). Casting those raw rows straight to SampleCaseRecord is a trap:
// the sample (and its workers) gate on `stage !== "closed"`, so a real `finish`
// or `close` would be mis-read as still-open and generate signals/allocations
// for dead cases, while a genuinely unknown status would silently look routine.
//
// `normalizeSampleCaseStage` maps the recognized vocabularies and, crucially,
// routes anything unrecognized to `review_required` — surfaced for a human to
// reconcile rather than silently dropped or silently treated as active.
const CLOSED_STAGE_TOKENS = new Set([
  "closed",
  "close",
  "finish",
  "finished",
  "done",
  "complete",
  "completed",
  "resolved",
  "cancel",
  "cancelled",
  "canceled",
  "archived",
]);

const ACTIVE_STAGE_TOKENS = new Set([
  "active_followup",
  "create",
  "created",
  "dealing",
  "open",
  "opened",
  "processing",
  "in_progress",
  "ongoing",
  "follow_up",
  "following_up",
]);

const EVIDENCE_GAP_STAGE_TOKENS = new Set([
  "evidence_gap",
  "missing_evidence",
  "need_evidence",
  "awaiting_evidence",
]);

export function isClosedStage(rawStage: string | null | undefined): boolean {
  if (!rawStage) return false;
  return CLOSED_STAGE_TOKENS.has(rawStage.trim().toLowerCase());
}

export function normalizeSampleCaseStage(
  rawStage: string | null | undefined,
  // Adopters pass their backend's status vocabulary here. Statuses whose
  // disposition is backend-specific (a real backend's `processed` / `replied`
  // can mean "done" OR "in progress" depending on the product) are
  // deliberately NOT auto-classified — declare them explicitly via overrides
  // rather than letting the sample guess.
  overrides?: Readonly<Record<string, SampleCaseStage>>,
): SampleCaseStage {
  const token = rawStage?.trim().toLowerCase() ?? "";
  const override = overrides?.[token];
  if (override) return override;
  if (CLOSED_STAGE_TOKENS.has(token)) return "closed";
  if (EVIDENCE_GAP_STAGE_TOKENS.has(token)) return "evidence_gap";
  if (ACTIVE_STAGE_TOKENS.has(token)) return "active_followup";
  if (token === "review_required") return "review_required";
  // Unknown / drifted upstream status: surface for review rather than silently
  // dropping it (as a wrong "closed" would) or treating it as routine active.
  return "review_required";
}

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

// Defense in depth: observedDate is typed as a required date string, but real
// backends carry pervasive NULL/empty date fields. An unparseable value would
// otherwise silently become an Invalid Date and later throw a contextless
// "RangeError: Invalid time value" when the review packet serializes
// observedAt.toISOString(). Fail loudly here, naming the case, instead.
function parseObservedAt(record: SampleCaseRecord): Date {
  const observedAt = new Date(`${record.observedDate}T00:00:00.000Z`);
  if (Number.isNaN(observedAt.getTime())) {
    throw new Error(
      `Sample case ${record.caseId} has an unparseable observedDate (${JSON.stringify(
        record.observedDate,
      )}); a valid YYYY-MM-DD date is required.`,
    );
  }
  return observedAt;
}

export function mapCaseRecordToSignals(
  record: SampleCaseRecord,
): Array<SignalCandidate<SampleCaseSignalPayload>> {
  // Defense in depth: use the robust closed-stage check so a record carrying a
  // raw/drifted closed status (e.g. "close"/"finish") is not mistaken for open.
  if (isClosedStage(record.stage)) return [];

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
      observedAt: parseObservedAt(record),
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
