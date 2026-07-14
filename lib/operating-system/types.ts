import type { ActionExecutionMode, ActionType, ObjectType } from "@prisma/client";

export type OperatingSkillId =
  | "meeting-briefing"
  | "meeting-follow-through"
  | "external-followup-draft"
  | "approval-review"
  | "opportunity-push"
  | "relationship-revival"
  | "memory-correction"
  | "pilot-readiness-diagnostics";

export type OperatingSkillCategory =
  | "memory"
  | "execution"
  | "governance"
  | "diagnostics";

export type OperatingBoundaryMode =
  | "auto"
  | "approval"
  | "manual";

export type OperatingSkillDefinition = {
  id: OperatingSkillId;
  name: string;
  summary: string;
  nameEn?: string;
  summaryEn?: string;
  category: OperatingSkillCategory;
  reads: string[];
  writes: string[];
  defaultBoundary: OperatingBoundaryMode;
  primaryActionTypes: ActionType[];
  primaryObjectTypes: Array<ObjectType | "WORKSPACE">;
  defaultSurface:
    | "dashboard"
    | "meetings"
    | "approvals"
    | "opportunities"
    | "memory"
    | "settings"
    | "diagnostics";
};

export type OperatingSkillInvocation = {
  skillId: OperatingSkillId;
  inputSummary: string;
  outputSummary: string;
  boundaryMode: OperatingBoundaryMode;
  policyResult?: ActionExecutionMode | string | null;
};

export type OperatingEventSignal = {
  id: string;
  kind:
    | "approval-backlog"
    | "overdue-commitment"
    | "high-risk-opportunity"
    | "meeting-follow-through"
    | "relationship-cooling"
    | "memory-correction-burst"
    | "import-ingress-ready"
    | "thread-waiting-on-us";
  title: string;
  summary: string;
  severity: "low" | "medium" | "high";
  suggestedSkillIds: OperatingSkillId[];
};

export type OperatingObjectState = {
  id: string;
  label: string;
  objectType: ObjectType | "WORKSPACE";
  status: "healthy" | "watch" | "blocked";
  summary: string;
  activeFacts: number;
  openCommitments: number;
  openBlockers: number;
  overdueCommitments: number;
  recentCorrections: number;
  recentAudits: number;
  suggestedSkillIds: OperatingSkillId[];
};

export type OperatingMeetingMemoryLifecycle =
  | "promoted"
  | "ready"
  | "pending-review"
  | "conflict";

export type OperatingMeetingTemplateId =
  | "customer-call"
  | "internal-decision"
  | "interview"
  | "vendor-review"
  | "follow-up-sync";

export type OperatingMeetingMemoryGovernanceCue =
  | "personal"
  | "shared-with-team"
  | "promoted-to-object-state"
  | "review-only";

export type OperatingMeetingMemorySourceClass =
  | "meeting-notes"
  | "connected-objects"
  | "promoted-meeting-memory"
  | "blockers-commitments-decisions";

export type OperatingMeetingMemoryReviewState =
  | "pending-review"
  | "conflict"
  | "missing-clarity"
  | "promoted-but-boundary-limited";

export type OperatingMeetingMemoryItemKind =
  | "fact"
  | "commitment"
  | "blocker"
  | "decision"
  | "open-question"
  | "correction";

export type OperatingMeetingMemoryAffectedObject = {
  id: string;
  objectType: ObjectType | "WORKSPACE";
  label: string;
};

export type OperatingMeetingMemorySourcePointer = {
  id: string;
  label: string;
  summary: string;
};

export type OperatingMeetingMemoryItem = {
  id: string;
  kind: OperatingMeetingMemoryItemKind;
  title: string;
  summary: string;
  lifecycle: OperatingMeetingMemoryLifecycle;
  reasonChainSummary: string;
  sourcePointer: OperatingMeetingMemorySourcePointer;
  affectedObjects: OperatingMeetingMemoryAffectedObject[];
  conflictSummary: string | null;
};

export type OperatingMeetingMemoryBundle = {
  meetingId: string;
  meetingLabel: string;
  summary: string;
  lifecycleSummary: string;
  affectedObjects: OperatingMeetingMemoryAffectedObject[];
  sourcePointers: OperatingMeetingMemorySourcePointer[];
  facts: OperatingMeetingMemoryItem[];
  commitments: OperatingMeetingMemoryItem[];
  blockers: OperatingMeetingMemoryItem[];
  decisions: OperatingMeetingMemoryItem[];
  openQuestions: OperatingMeetingMemoryItem[];
  corrections: OperatingMeetingMemoryItem[];
  items: OperatingMeetingMemoryItem[];
  promotedCount: number;
  readyCount: number;
  pendingReviewCount: number;
  conflictCount: number;
};

export type OperatingMeetingMemoryItemGovernanceSummary = {
  visibilityCue: OperatingMeetingMemoryGovernanceCue;
  visibilityLabel: string;
  sourceClass: OperatingMeetingMemorySourceClass;
  sourceClassLabel: string;
  sourceSummary: string;
  eligibilitySummary: string;
};

export type OperatingMeetingMemoryGovernanceSummary = {
  visibilityCue: OperatingMeetingMemoryGovernanceCue;
  visibilityLabel: string;
  ownershipSummary: string;
  reviewState: OperatingMeetingMemoryReviewState;
  reviewStateLabel: string;
  reviewSummary: string;
  sourceClasses: OperatingMeetingMemorySourceClass[];
  sourceClassLabels: string[];
  sourceSummary: string;
  eligibilitySummary: string;
};

export type OperatingMeetingTemplateSummary = {
  templateId: OperatingMeetingTemplateId;
  label: string;
  summary: string;
  objectEmphasisLine: string;
  nextStepLine: string;
  reviewLine: string;
};

export type OperatingMeetingWorkspaceLightSummary = {
  visibilityCue: OperatingMeetingMemoryGovernanceCue;
  visibilityLabel: string;
  personalCount: number;
  sharedCount: number;
  promotedCount: number;
  reviewOnlyCount: number;
  summary: string;
  collaborationLine: string;
};

export type OperatingMeetingMemorySourceUseLedgerEntry = {
  id: string;
  title: string;
  kind: OperatingMeetingMemoryItemKind;
  kindLabel: string;
  lifecycle: OperatingMeetingMemoryLifecycle;
  lifecycleLabel: string;
  visibilityCue: OperatingMeetingMemoryGovernanceCue;
  visibilityLabel: string;
  reviewState: OperatingMeetingMemoryReviewState;
  reviewStateLabel: string;
  sourceClass: OperatingMeetingMemorySourceClass;
  sourceClassLabel: string;
  sourcePointerLabel: string;
  sourcePointerSummary: string;
  affectedObjectLabels: string[];
  reasonChainSummary: string;
  eligibilitySummary: string;
  conflictSummary: string | null;
};

export type OperatingMeetingMemorySourceUseLedger = {
  summary: string;
  entries: OperatingMeetingMemorySourceUseLedgerEntry[];
};

export type OperatingMeetingMemoryExportItem = {
  id: string;
  title: string;
  kind: OperatingMeetingMemoryItemKind;
  kindLabel: string;
  summary: string;
  lifecycle: OperatingMeetingMemoryLifecycle;
  lifecycleLabel: string;
  visibilityCue: OperatingMeetingMemoryGovernanceCue;
  visibilityLabel: string;
  reviewState: OperatingMeetingMemoryReviewState;
  reviewStateLabel: string;
  sourceClass: OperatingMeetingMemorySourceClass;
  sourceClassLabel: string;
  sourcePointer: OperatingMeetingMemorySourcePointer;
  affectedObjects: string[];
  reasonChainSummary: string;
  eligibilitySummary: string;
  conflictSummary: string | null;
};

export type OperatingMeetingMemoryExportPayload = {
  schemaVersion: "meeting-memory-governance-export-v1";
  exportedAt: string;
  meeting: {
    id: string;
    label: string;
    summary: string;
    lifecycleSummary: string;
  };
  lifecycleCounts: {
    promoted: number;
    ready: number;
    pendingReview: number;
    conflict: number;
  };
  governance: {
    visibilityCue: OperatingMeetingMemoryGovernanceCue;
    visibilityLabel: string;
    ownershipSummary: string;
    reviewState: OperatingMeetingMemoryReviewState;
    reviewStateLabel: string;
    reviewSummary: string;
    sourceClassLabels: string[];
    sourceSummary: string;
    eligibilitySummary: string;
  };
  sourcePointers: OperatingMeetingMemorySourcePointer[];
  items: OperatingMeetingMemoryExportItem[];
};

export type RecommendationOperatingContext = {
  skill: OperatingSkillDefinition | null;
  skillLine: string;
  eventLine: string;
  stateLine: string;
  governanceLine: string;
};

export type ApprovalBoundaryModel = {
  summaryLine: string;
  queueState: "clear" | "review-heavy" | "boundary-heavy";
  autoEligibleCount: number;
  approvalRequiredCount: number;
  highRiskCount: number;
  externalCount: number;
  topSkillIds: OperatingSkillId[];
  boundaryNotes: string[];
};

export type AuditReasonChainItem = {
  id: string;
  label: string;
  summary: string;
};

export type ReadinessGate = {
  id: string;
  label: string;
  status: "ready" | "watch" | "blocked";
  summary: string;
};

export type PilotReadinessModel = {
  score: number;
  stage: "unstable" | "usable" | "scalable";
  headline: string;
  summary: string;
  gates: ReadinessGate[];
  recommendedSkillIds: OperatingSkillId[];
};

export type DashboardArbitrationModel = {
  firstMoveSummary: string;
  whyNow: string;
  boundarySummary: string;
  waitingSummary: string;
  recommendedSkillIds: OperatingSkillId[];
  eventSignals: OperatingEventSignal[];
};
