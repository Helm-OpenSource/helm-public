import {
  ActionExecutionMode,
  ActionType,
  ActorType,
  ObjectType,
  RecommendationFeedbackType,
  RecommendationStatus,
  type RejectionReasonCode,
  RiskLevel,
} from "@prisma/client";
import type { MemoryRetrievalPackSurfaceTrace } from "@/lib/memory/retrieval-pack-adapter";

export type RecommendationObjectContext = {
  workspaceId: string;
  objectType: ObjectType;
  objectId: string;
  objectLabel: string;
  companyId?: string | null;
  contactId?: string | null;
  opportunityId?: string | null;
  meetingId?: string | null;
  ownerId?: string | null;
  daysSinceLastTouch: number;
  dueSoon: boolean;
  baseRiskLevel: RiskLevel;
  priorityScore: number;
  roleWeight: number;
  stageLabel?: string | null;
  notes?: string | null;
};

export type RecommendationEvidence = {
  supportingFactIds: string[];
  blockerIds: string[];
  commitmentIds: string[];
  briefingSnapshotId?: string | null;
  briefingSummary?: string | null;
  supportingFacts: Array<{
    id: string;
    title: string;
    content: string;
    confidence: number;
    confirmedByUser: boolean;
    freshnessScore: number;
  }>;
  blockers: Array<{
    id: string;
    title: string;
    blockerText: string;
    severity: number;
    status: string;
  }>;
  commitments: Array<{
    id: string;
    title: string;
    commitmentText: string;
    dueDate: Date | null;
    overdueFlag: boolean;
    status: string;
  }>;
  recentMeetings?: Array<{
    id: string;
    title: string;
    summary?: string | null;
  }>;
  recentThreads?: Array<{
    id: string;
    subject: string;
    status: string;
    snippet?: string | null;
  }>;
  memoryRetrievalPack?: MemoryRetrievalPackSurfaceTrace | null;
};

export type RecommendationPatternFact = {
  id: string;
  scopeType: string;
  scopeId?: string | null;
  patternType: string;
  patternKey: string;
  patternValue: string;
  confidence: number;
  evidenceCount: number;
  title?: string | null;
  summary?: string | null;
};

export type RecommendationCandidate = {
  actionType: ActionType;
  title: string;
  description: string;
  aiReason: string;
  draftContent?: string;
  metadata?: Record<string, unknown>;
  resultPreview?: string;
  riskLevel: RiskLevel;
  outbound: boolean;
  usesCommitment: boolean;
  addressesBlocker: boolean;
  sortHint: "speed" | "clarity" | "control" | "relationship";
};

export type RankedRecommendationCandidate = RecommendationCandidate & {
  score: number;
  urgencyScore: number;
  impactScore: number;
  confidenceScore: number;
  personalizationScore: number;
  policyFitScore: number;
  riskScore: number;
  policyResult: ActionExecutionMode;
  policyReason: string;
  appliedPolicyName: string | null;
  appliedPolicyMode: ActionExecutionMode | null;
  appliedRiskThreshold: RiskLevel | null;
  whyNotAutoExecute?: string | null;
  learnedPatternSummary: string[];
};

export type RecommendationOutput = {
  recommendationId: string;
  objectType: ObjectType;
  objectId: string;
  actionType: ActionType;
  title: string;
  description: string;
  score: number;
  urgencyScore: number;
  impactScore: number;
  confidenceScore: number;
  personalizationScore: number;
  policyFitScore: number;
  riskScore: number;
  policyResult: ActionExecutionMode;
  supportingFactIds: string[];
  blockerIds: string[];
  commitmentIds: string[];
  explanation: string;
  appliedPolicyRules: Array<{
    name: string | null;
    mode: ActionExecutionMode | null;
    reason: string;
  }>;
  whyNotAutoExecute?: string | null;
  status: RecommendationStatus;
  createdAt: Date;
  recommendationPayload?: Record<string, unknown> | null;
};

export type RecommendationFeedbackInput = {
  workspaceId: string;
  recommendationId: string;
  userId?: string | null;
  actorName: string;
  actorType?: ActorType;
  english?: boolean;
  suppressEvolutionRefresh?: boolean;
  feedbackType: RecommendationFeedbackType;
  edited?: boolean;
  resultNote?: string | null;
  // Structured rejection taxonomy: set when feedbackType is REJECTED so the
  // learning loop can aggregate WHY suggestions get rejected, not just count.
  rejectionReasonCode?: RejectionReasonCode | null;
  actionItemId?: string | null;
  approvalTaskId?: string | null;
  sourcePage?: string | null;
};
