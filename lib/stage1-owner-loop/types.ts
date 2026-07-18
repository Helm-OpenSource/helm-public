import type {
  DecisionObject,
  SupervisionSignal,
} from "@/lib/agentos-decision-supervision/types";

export const OBSERVATION_PROGRAM_STATUSES = [
  "draft",
  "active",
  "revoked",
  "expired",
] as const;

export type ObservationProgramStatus =
  (typeof OBSERVATION_PROGRAM_STATUSES)[number];

export type EnterpriseObservationProgram = {
  programId: string;
  workspaceRef: string;
  purpose: string;
  scopeRefs: readonly string[];
  dataCategories: readonly string[];
  startsAt: string;
  expiresAt: string;
  retentionDays: number;
  authorizationRef: string;
  status: ObservationProgramStatus;
  revokedAt: string | null;
  revokedByRef: string | null;
  revocationReason: string | null;
  auditRefs: readonly string[];
};

export const OBSERVATION_ACCESS_MODES = [
  "read_only_api",
  "read_only_replica",
  "scheduled_snapshot",
  "file_snapshot",
] as const;

export type ObservationAccessMode =
  (typeof OBSERVATION_ACCESS_MODES)[number];

export const OBSERVATION_SOURCE_STATUSES = [
  "draft",
  "active",
  "paused",
  "revoked",
  "error",
] as const;

export type ObservationSourceStatus =
  (typeof OBSERVATION_SOURCE_STATUSES)[number];

export const OBSERVATION_SENSITIVITY_LEVELS = [
  "public",
  "internal",
  "confidential",
  "restricted",
] as const;

export type ObservationSensitivity =
  (typeof OBSERVATION_SENSITIVITY_LEVELS)[number];

export type ObservationSource = {
  sourceId: string;
  workspaceRef: string;
  programRef: string;
  sourceKind: string;
  accessMode: ObservationAccessMode;
  ownerRef: string;
  freshnessSlaMinutes: number;
  sensitivity: ObservationSensitivity;
  authorizationRef: string;
  secretRef: string;
  retentionDays: number;
  status: ObservationSourceStatus;
};

export const OBSERVATION_OUTCOMES = [
  "success",
  "partial_success",
  "failure",
  "unknown",
] as const;

export type ObservationOutcome = (typeof OBSERVATION_OUTCOMES)[number];

export const EVIDENCE_FRESHNESS_STATES = ["fresh", "stale", "unknown"] as const;

export type EvidenceFreshnessState =
  (typeof EVIDENCE_FRESHNESS_STATES)[number];

export type SourceObservationReceipt = {
  receiptId: string;
  workspaceRef: string;
  sourceRef: string;
  programRef: string;
  windowStart: string;
  windowEnd: string;
  observedAt: string;
  summaryHash: string | null;
  completenessPercent: number | null;
  freshness: EvidenceFreshnessState;
  outcome: ObservationOutcome;
  evidenceRefs: readonly string[];
  errorCodes: readonly string[];
};

export type OwnerQuestionPacket = {
  questionId: string;
  workspaceRef: string;
  askedByOwnerRef: string;
  question: string;
  contextRefs: readonly string[];
  evidenceScopeRefs: readonly string[];
  askedAt: string;
};

export type EvidenceStatement = {
  statement: string;
  evidenceRefs: readonly string[];
  freshness: EvidenceFreshnessState;
};

export type EvidenceConflict = {
  description: string;
  evidenceRefs: readonly string[];
};

export type EvidenceAnswerPacket = {
  answerId: string;
  workspaceRef: string;
  questionRef: string;
  answer: string | null;
  facts: readonly EvidenceStatement[];
  inferences: readonly EvidenceStatement[];
  unknowns: readonly string[];
  conflicts: readonly EvidenceConflict[];
  evidenceRefs: readonly string[];
  freshness: EvidenceFreshnessState;
  confidence: "low" | "medium" | "high";
  generatedAt: string;
  reviewRequired: boolean;
  refusalReason: string | null;
};

export const DECISION_RECORD_STATUSES = [
  "draft",
  "evidence_ready",
  "owner_confirmed",
  "rejected",
  "expired",
  "superseded",
  "evaluated",
] as const;

export type DecisionRecordStatus = (typeof DECISION_RECORD_STATUSES)[number];

export type DecisionRecord = {
  recordId: string;
  workspaceRef: string;
  decision: DecisionObject;
  facts: readonly EvidenceStatement[];
  inferences: readonly EvidenceStatement[];
  unknowns: readonly string[];
  risks: readonly string[];
  ownerRef: string | null;
  ownerConclusion: string | null;
  ownerConfirmedAt: string | null;
  status: DecisionRecordStatus;
  validUntil: string | null;
};

export type SupervisionSignalRecord = {
  recordId: string;
  workspaceRef: string;
  signal: SupervisionSignal;
  expectedState: string | null;
  actualState: string;
  responsibilityScopeRef: string | null;
  escalationCondition: string;
  createdAt: string;
};

export const OWNER_COMMAND_STATUSES = [
  "draft",
  "owner_confirmed",
  "dispatched",
  "cancelled",
  "expired",
] as const;

export type OwnerCommandStatus = (typeof OWNER_COMMAND_STATUSES)[number];

export const WORK_PACKET_AUTOMATION_LEVELS = [
  "observer",
  "assist",
  "shadow",
  "active_candidate",
] as const;

export type WorkPacketAutomationLevel =
  (typeof WORK_PACKET_AUTOMATION_LEVELS)[number];

export type OwnerCommandDraft = {
  commandId: string;
  workspaceRef: string;
  decisionRef: string;
  ownerRef: string;
  executionTargetRef: string;
  goal: string;
  action: string;
  dueAt: string;
  acceptanceCriteria: readonly string[];
  evidenceRequirements: readonly string[];
  invalidationConditions: readonly string[];
  escalationOwnerRef: string;
  automationLevel: WorkPacketAutomationLevel;
  allowedToolRefs: readonly string[];
  externalSideEffects: readonly string[];
  status: OwnerCommandStatus;
};

export const AUTONOMY_POLICY_STATUSES = [
  "draft",
  "active",
  "suspended",
  "revoked",
  "expired",
] as const;

export type AutonomyPolicyStatus = (typeof AUTONOMY_POLICY_STATUSES)[number];

export type AutonomyPolicyEnvelope = {
  envelopeId: string;
  workspaceRef: string;
  actionCategory: string;
  targetScopeRefs: readonly string[];
  maximumAmount: number | null;
  currency: string | null;
  validFrom: string;
  validUntil: string;
  allowedTimeWindows: readonly string[];
  allowedChannels: readonly string[];
  allowedModelRefs: readonly string[];
  allowedToolRefs: readonly string[];
  policyRefs: readonly string[];
  minimumConfidence: number;
  requireExternalReceipt: boolean;
  stopConditions: readonly string[];
  emergencyStopRef: string;
  ownerApprovalRefs: readonly string[];
  runtimeActivationRef: string | null;
  status: AutonomyPolicyStatus;
};

export type AutonomousActionRequest = {
  workspaceRef: string;
  actionCategory: string;
  targetScopeRef: string;
  amount: number | null;
  currency: string | null;
  channel: string | null;
  modelRef: string;
  toolRef: string;
  confidence: number;
  requestedAt: string;
  observedStopConditions: readonly string[];
  externalSideEffect: boolean;
};

export type AutonomousActionReceipt = {
  receiptId: string;
  workspaceRef: string;
  actionCategory: string;
  subjectRef: string;
  policyEnvelopeRef: string;
  inputEvidenceRefs: readonly string[];
  modelRef: string;
  toolRef: string;
  startedAt: string;
  completedAt: string | null;
  outcome: ObservationOutcome;
  externalReceiptRefs: readonly string[];
  rollbackRef: string | null;
  auditRefs: readonly string[];
};

export const DECISION_FOLLOW_THROUGH_STATES = [
  "DRAFT",
  "EVIDENCE_READY",
  "OWNER_CONFIRMED",
  "DISPATCHED",
  "IN_PROGRESS",
  "RECEIPT_SUBMITTED",
  "VERIFIED",
  "REJECTED",
  "BLOCKED",
  "EXPIRED",
  "SUPERSEDED",
] as const;

export type DecisionFollowThroughState =
  (typeof DECISION_FOLLOW_THROUGH_STATES)[number];
