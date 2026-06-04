// Expert Capability Feedback Loop v0.1 — public-safe contracts.
// Spec: docs/product/HELM_EXPERT_CAPABILITY_FEEDBACK_LOOP.md
//
// Boundary: every packet is advice-only. Nothing here may trigger execution, external
// send, writeback, approval, or memory promotion. All data is synthetic / public-safe.

export const CORRECTION_REASON_CODES = [
  "evidence_missing",
  "evidence_wrong",
  "disposition_wrong",
  "boundary_violation",
  "commitment_wording",
  "hallucinated_fact",
  "scope_wrong",
  "owner_reviewer_wrong",
  "confidence_miscalibrated",
  "stale_signal",
  "duplicate_or_conflict",
  "other_requires_schema_review",
] as const;

export type CorrectionReasonCode = (typeof CORRECTION_REASON_CODES)[number];

export type CommitmentClass = "advice" | "commitment";

// Disposition prefixes that represent an action / commitment, which are forbidden under a
// boundary-trap expectation. Kept deliberately small and explicit.
export const ACTION_DISPOSITION_PREFIXES = [
  "recommend_auto",
  "auto_",
  "execute_",
  "approve_",
  "writeback_",
  "send_",
] as const;

// Reference substrings that must never appear in a v0.1 packet's evidence / action refs.
export const FORBIDDEN_REF_PATTERNS: readonly RegExp[] = [
  /write/i,
  /send/i,
  /execute/i,
  /auto[_-]?approve/i,
  /memory[_-]?promot/i,
];

export type ExpertOutput = {
  expertRevisionId: string;
  disposition: string;
  evidenceRefs: string[];
  commitmentClass: CommitmentClass;
  boundaryNote?: string | null;
  humanReviewerRequired: boolean;
  forbiddenActionRefs: string[];
};

export type CaseGold = {
  disposition: string;
  relevantEvidence: string[];
  availableEvidence: string[];
  boundaryExpectation: string;
};

export type BHeldoutCase = {
  caseId: string;
  kind: string;
  inputSnapshotRef: string;
  gold: CaseGold;
  outputs: {
    candidate: ExpertOutput;
    previous: ExpertOutput;
    ruleBaseline: ExpertOutput;
  };
};

export type ACorrectionCase = {
  caseId: string;
  kind: string;
  inputSnapshotRef: string;
  gold: CaseGold;
  feedback: {
    feedbackId: string;
    correctionType: "edit" | "reject" | "defer";
    correctionReasonCode: CorrectionReasonCode;
    authorId: string;
  };
  candidate: ExpertOutput;
};

export type MetricDefinition = { w1: number; w2: number; minMargin: number };

export type PreRegistration = {
  preRegistrationId: string;
  aCorrectionSetHash: string;
  bHeldoutSetHash: string;
  goldLabelsHash: string;
  goldLockedAt: string;
  goldLockedBy: string;
  metricDefinition: MetricDefinition;
  previousExpertRevisionId: string;
  deterministicRuleBaselineRef: string;
  replaySnapshotRootHash: string;
  replaySnapshotHashes: string[];
  maxAttemptsPerHeldoutSet: number;
  trustedTimestamp: string;
  contentHash: string;
};

export type RunInput = {
  evaluationRunId: string;
  candidateRevisionId: string;
  candidateRevisionCreatedAt: string;
  ranAt: string;
  attemptNumber: number;
  bSetConsumedByRevisionIds: string[];
};

export type ASet = { setId: string; setHash: string; cases: ACorrectionCase[] };
export type BSet = {
  setId: string;
  setHash: string;
  goldLabelsHash: string;
  goldLockedAt: string;
  cases: BHeldoutCase[];
};

export type LoopCompoundingDecision = "success" | "inconclusive" | "fail";
export type ExpertJustifiedDecision = "pass" | "inconclusive(expert_vs_rules)" | "fail";
