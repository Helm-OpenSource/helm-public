import {
  LimitedAutoAcknowledgementStatus,
  LimitedAutoApprovalStatus,
  LimitedAutoExecutionStatus,
  LimitedAutoFailureStatus,
  LimitedAutoRollbackStatus,
  OfficialWriteAcknowledgementStatus,
  OfficialWriteApprovalStatus,
  OfficialWriteExecutionStatus,
  OpportunityStage,
  RiskLevel,
} from "@prisma/client";
import { loadEvalFixture } from "@/lib/evals/fixture-loader";
import { average, includesEvalText, includesInAny, toRate } from "@/lib/evals/shared";
import {
  buildMeetingAnalystArtifacts,
  buildMeetingRuntimeMemoryContext,
  deriveShadowOpportunityUpdate,
  evaluateSprint2MeetingRuntime,
} from "@/lib/helm-v2/meeting-action-pack-runtime";
import {
  buildCommsSchedulerArtifacts,
  buildDraftCommsBundle,
  buildProposalComposerArtifacts,
  DRAFT_ONLY_COMMS_BOUNDARY_NOTE,
  evaluateDraftCommsRiskGuard,
  evaluateSprint3DraftCommsRuntime,
} from "@/lib/helm-v2/draft-comms-handoff-runtime";
import {
  buildOpportunityJudgeArtifacts,
  evaluateSprint4OpportunityJudgeRuntime,
} from "@/lib/helm-v2/opportunity-judge-runtime";
import {
  buildHumanActionExecutionContracts,
  evaluateSprint5HumanActionExecution,
  type HumanActionExecutionAckMode,
  type HumanActionExecutionActionType,
} from "@/lib/helm-v2/human-action-execution-runtime";
import {
  buildOfficialFollowThroughContracts,
  buildLimitedAutoIntentContracts,
  buildOfficialWriteIntentContracts,
  evaluateSprint6OfficialWriteGuard,
  evaluateSprint8LimitedAutoPath,
  evaluateSprint9RicherOfficialCoverage,
  evaluateSprint10OfficialFollowThrough,
  getRicherOfficialActionCoverageCatalog,
  simulateLimitedAutoOutcome,
  type LimitedAutoIntentRuntimeItem,
  type OfficialFollowThroughResolutionStatusValue,
  type OfficialFollowThroughStatusValue,
  type OfficialFollowThroughTypeValue,
  type OfficialFollowThroughUpdateMode,
  type OfficialReconciliationStatusValue,
  type OfficialCoverageActionTypeValue,
  type OfficialWriteActionTypeValue,
  type OfficialWriteIntentRuntimeItem,
  type OfficialWriteExecutionProofSource,
  type OfficialWriteShadowSource,
} from "@/lib/helm-v2/official-system-integration-runtime";
import {
  buildMeetingConnectorSources,
  buildMeetingRetrievalTraces,
  evaluateSprint7IngestionRetrieval,
} from "@/lib/helm-v2/connector-ingestion-retrieval-runtime";
import {
  buildBudgetPosture,
  buildContinuitySnapshot,
  buildCoordinationTraceBridge,
  buildEdgeBriefMarkdown,
  buildProblemSpaceDrafts,
  buildPruneTraceEntries,
  buildRuntimeCacheHealth,
  buildRuntimeContinuityCalibration,
  buildRuntimeContinuityEvidenceSurface,
  buildRuntimeContinuityPilotEffectivenessReview,
  buildRuntimeContinuityPilotSessionReview,
  buildRuntimeContinuityRecovery,
  buildRuntimeContinuityRisk,
  buildRuntimeContinuityRunbook,
  buildRuntimeContinuitySop,
  buildRuntimeNotebookState,
  buildRuntimePayloadHandleState,
  buildRuntimeRemediationAnalytics,
  buildRuntimeRemediationEffectiveness,
  buildResumeFidelity,
  classifyPayloadStateSourceRisk,
  classifyReplayFidelityStatus,
  buildVerificationDecision,
  buildWorldModelSummary,
  classifyCompositionFailure,
  parseContinuitySnapshot,
  selectPayloadsForBudget,
  toPersistedPayloadContract,
} from "@/lib/helm-v2/runtime-upgrade";
import type { HelmV21PersistedPayload } from "@/lib/helm-v2/contracts";
import { buildRunThreadContract } from "@/lib/helm-v2/run-thread-contract";

type MeetingRuntimeGoldenCase = {
  id: string;
  label: string;
  workspaceSummary: string;
  meeting: {
    title: string;
    agenda?: string | null;
    startsAt: string;
    endsAt: string;
    companyName?: string | null;
    ownerName: string;
    contacts: string[];
    opportunity?: {
      title: string;
      type: "CLIENT" | "RECRUITING" | "PARTNERSHIP" | "INTERNAL";
      stage: keyof typeof OpportunityStage;
      riskLevel: keyof typeof RiskLevel;
      nextAction?: string | null;
    } | null;
    note: {
      meetingGoal?: string | null;
      riskAlerts?: string | null;
      summary?: string | null;
      keyDecisions?: string | null;
      confirmations?: string | null;
    };
  };
  promotedMemorySummaries: string[];
  expected: {
    factsIncludes: string[];
    nextActionIncludes: string[];
    expectedShadowStage: keyof typeof OpportunityStage;
    expectedShadowNextActionIncludes: string;
    expectedContextIncludes: string[];
    promiseBoundaryRequired: boolean;
  };
};

type MeetingRuntimeEvalCaseResult = {
  id: string;
  label: string;
  passed: boolean;
  failures: string[];
  extractionScore: number;
  promiseSafetyPass: boolean;
  memoryRelevancePass: boolean;
  shadowJudgementPass: boolean;
};

export type HelmV2MeetingRuntimeEvalSummary = {
  totalCases: number;
  passedCases: number;
  passRate: number;
  extractionAverage: number;
  promiseSafetyRate: number;
  memoryRelevanceRate: number;
  shadowJudgementRate: number;
  auditTraceabilityRate: number;
  cases: MeetingRuntimeEvalCaseResult[];
};

type DraftCommsGoldenCase = {
  id: string;
  label: string;
  workspaceSummary: string;
  meeting: MeetingRuntimeGoldenCase["meeting"];
  promotedMemorySummaries: string[];
  expected: {
    customerFollowupIncludes: string[];
    emailIncludes: string[];
    execBriefIncludes: string[];
    expectedAudienceOrder: Array<"customer" | "internal" | "executive">;
    fallbackRequired: boolean;
    editedRiskyDraftMarkdown?: string;
    requiredBoundaryNotes: string[];
  };
};

type DraftCommsEvalCaseResult = {
  id: string;
  label: string;
  passed: boolean;
  failures: string[];
  draftUsefulnessPass: boolean;
  promiseSafetyPass: boolean;
  nonCommitmentFallbackPass: boolean;
  audienceCorrectnessPass: boolean;
  reviewPathConsistencyPass: boolean;
};

export type HelmV2DraftCommsEvalSummary = {
  totalCases: number;
  passedCases: number;
  passRate: number;
  draftUsefulnessRate: number;
  promiseSafetyRate: number;
  nonCommitmentFallbackRate: number;
  audienceCorrectnessRate: number;
  reviewPathConsistencyRate: number;
  averageBundleConfidence: number;
  cases: DraftCommsEvalCaseResult[];
};

type OpportunityJudgeGoldenCase = {
  id: string;
  label: string;
  workspaceSummary: string;
  meeting: MeetingRuntimeGoldenCase["meeting"];
  promotedMemorySummaries: string[];
  historicalTimeline: string[];
  expected: {
    expectedShadowStage: keyof typeof OpportunityStage;
    expectedTopBlockerIncludes: string;
    expectedNextActionIncludes: string[];
    expectedAttentionFlagKeys: Array<
      | "stage_ambiguity"
      | "missing_champion"
      | "budget_uncertainty"
      | "pricing_sensitivity"
      | "timeline_risk"
      | "dependency_risk"
      | "commitment_risk"
      | "escalation_candidate"
    >;
    requiredBoundaryNotes: string[];
  };
};

type OpportunityJudgeEvalCaseResult = {
  id: string;
  label: string;
  passed: boolean;
  failures: string[];
  stageJudgementPass: boolean;
  blockerRankingPass: boolean;
  nextBestActionPass: boolean;
  managerAttentionPass: boolean;
  shadowBoundaryPass: boolean;
  evidenceSufficiencyPass: boolean;
};

export type HelmV2OpportunityJudgeEvalSummary = {
  totalCases: number;
  passedCases: number;
  passRate: number;
  stageJudgementRate: number;
  blockerRankingRate: number;
  nextBestActionRate: number;
  managerAttentionRate: number;
  shadowBoundaryRate: number;
  evidenceSufficiencyRate: number;
  averageBundleConfidence: number;
  cases: OpportunityJudgeEvalCaseResult[];
};

type HelmV21RuntimeGoldenCase = {
  id: string;
  label: string;
  payloads: Array<{
    payloadKey: string;
    sourceType: HelmV21PersistedPayload["sourceType"];
    sourceId: string;
    label: string;
    loadPolicy: HelmV21PersistedPayload["loadPolicy"];
    text: string;
    loadedByDefault: boolean;
  }>;
  tokenBudgetLimit: number;
  verification: {
    facts: Array<{ content: string; evidence: string[] }>;
    inferredCount: number;
    riskFlags: Array<{ severity: "low" | "medium" | "high"; promiseRisk: boolean; reason: string }>;
    promotedMemoryCount: number;
  };
  recommendedNextAction: string;
  blockers: string[];
  expected: {
    minLoadedHandles: number;
    minPrunedHandles: number;
    verificationStatus: "passed" | "needs_review" | "blocked";
    minTruthScore: number;
    problemSpaceTitles: string[];
    edgeBriefIncludes: string[];
    expectedFailureClass: "CONTEXT_MISS" | "VERIFICATION_FAIL" | "POLICY_BLOCK" | "TOOL_MISS" | "BUDGET_EXHAUSTED" | null;
  };
};

type HelmV21RuntimeEvalCaseResult = {
  id: string;
  label: string;
  passed: boolean;
  failures: string[];
  substratePass: boolean;
  budgetPass: boolean;
  verificationPass: boolean;
  problemSpacePass: boolean;
  edgeBriefPass: boolean;
  telemetryPass: boolean;
  verifiedPromotionPass: boolean;
  truthConflictVisiblePass: boolean;
  confirmedProblemSpacePass: boolean;
  sourceConsistentBriefPass: boolean;
  compositionFailurePass: boolean;
};

export type HelmV21RuntimeSubstrateEvalSummary = {
  totalCases: number;
  passedCases: number;
  passRate: number;
  substrateRate: number;
  budgetGovernanceRate: number;
  checkpointFidelityRate: number;
  cases: HelmV21RuntimeEvalCaseResult[];
};

export type HelmV21VerificationTruthEvalSummary = {
  totalCases: number;
  passedCases: number;
  passRate: number;
  verificationRate: number;
  truthScoreRate: number;
  conflictBoundaryRate: number;
  cases: HelmV21RuntimeEvalCaseResult[];
};

export type HelmV21ProblemSpaceEvalSummary = {
  totalCases: number;
  passedCases: number;
  passRate: number;
  worldModelRate: number;
  problemSpaceRate: number;
  edgeBriefRate: number;
  compositionFailureRate: number;
  cases: HelmV21RuntimeEvalCaseResult[];
};

export type HelmV21OperatorSurfaceEvalSummary = {
  totalCases: number;
  passedCases: number;
  passRate: number;
  traceSurfaceRate: number;
  playerCoachBriefRate: number;
  cacheHealthRate: number;
  consolidationBoundaryRate: number;
  cases: HelmV21RuntimeEvalCaseResult[];
};

export type HelmV21VerifiedCoordinationEvalSummary = {
  totalCases: number;
  passedCases: number;
  passRate: number;
  verifiedPromotionRate: number;
  truthConflictVisibilityRate: number;
  confirmedProblemSpaceRate: number;
  sourceConsistentBriefRate: number;
  compositionFailureRate: number;
  cases: HelmV21RuntimeEvalCaseResult[];
};

type HelmV21BudgetedSessionContinuityGoldenCase = {
  id: string;
  label: string;
  payloads: Array<{
    payloadKey: string;
    sourceType: HelmV21PersistedPayload["sourceType"];
    sourceId: string;
    label: string;
    loadPolicy: HelmV21PersistedPayload["loadPolicy"];
    text: string;
    loadedByDefault: boolean;
  }>;
  tokenBudgetLimit: number;
  continuitySource: Parameters<typeof buildRuntimeNotebookState>[0];
  latestCheckpointStatus?: string | null;
  resumedFromKey?: string | null;
  savedSnapshot?: ReturnType<typeof buildContinuitySnapshot>;
  liveStateOverride?: ReturnType<typeof buildRuntimeNotebookState>;
  pruneEdit?: {
    strategy: string;
    beforeTokenCount: number;
    afterTokenCount: number;
    removedHandles: string[];
    removedSummary: string;
  };
  expected: {
    budgetState: "SAFE" | "WATCH" | "PRUNE" | "COMPACT";
    requiredExternalizedLabels: string[];
    notebookIncludes: string[];
    replayFidelity: "STRONG" | "WATCH" | "WEAK";
    replayMissing?: string[];
    protectedItems: string[];
    minTokensSaved: number;
  };
};

type HelmV21BudgetedSessionContinuityEvalCaseResult = {
  id: string;
  label: string;
  passed: boolean;
  failures: string[];
  payloadExternalizationPass: boolean;
  notebookStatePass: boolean;
  checkpointResumePass: boolean;
  pruneSafetyPass: boolean;
  budgetPosturePass: boolean;
};

export type HelmV21BudgetedSessionContinuityEvalSummary = {
  totalCases: number;
  passedCases: number;
  passRate: number;
  payloadExternalizationRate: number;
  notebookStateRate: number;
  checkpointResumeRate: number;
  pruneSafetyRate: number;
  budgetPostureRate: number;
  cases: HelmV21BudgetedSessionContinuityEvalCaseResult[];
};

type HelmV22CoordinationTraceGoldenCase = {
  id: string;
  label: string;
  problemSpaces: Array<{
    id: string;
    title: string;
    status: string;
    ownerHint?: string | null;
    evidenceRefs: string[];
    meetingId: string;
    opportunityId?: string | null;
    companyId?: string | null;
    updatedAt: string;
    driAssignments: Array<{
      assignedUserName: string | null;
      assignedByName: string | null;
      note: string | null;
    }>;
  }>;
  humanExecutions: Array<{
    id: string;
    meetingId: string;
    opportunityId?: string | null;
    companyId?: string | null;
    status: string;
    executionIntent: string;
    executionOwnerName?: string | null;
    followThroughStatus?: string | null;
    executedAt?: string | null;
    updatedAt: string;
  }>;
  officialFollowThrough: Array<{
    id: string;
    meetingId: string;
    opportunityId?: string | null;
    companyId?: string | null;
    followThroughStatus: string;
    followThroughResolutionStatus: string;
    followThroughOwnerName?: string | null;
    followThroughNextAction?: string | null;
    followThroughSummary?: string | null;
    updatedAt: string;
  }>;
  expected: {
    posture: string;
    summaryIncludes: string[];
    linkageIncludes: string[];
    humanExecutionSummaryIncludes?: string[];
    officialFollowThroughSummaryIncludes?: string[];
  };
};

type HelmV22CoordinationTraceEvalCaseResult = {
  id: string;
  label: string;
  passed: boolean;
  failures: string[];
  posturePass: boolean;
  summaryPass: boolean;
  linkagePass: boolean;
  boundaryPass: boolean;
  humanExecutionVisibilityPass: boolean;
  officialFollowThroughVisibilityPass: boolean;
};

export type HelmV22CoordinationTraceEvalSummary = {
  totalCases: number;
  passedCases: number;
  passRate: number;
  postureRate: number;
  summaryRate: number;
  linkageRate: number;
  boundaryRate: number;
  humanExecutionVisibilityRate: number;
  officialFollowThroughVisibilityRate: number;
  cases: HelmV22CoordinationTraceEvalCaseResult[];
};

type HelmV22ContinuityObservabilityGoldenCase = {
  id: string;
  label: string;
  replayCalibration: {
    fidelityScore: number;
    missing: string[];
    expectedStatus: "STRONG" | "WATCH" | "WEAK";
  };
  payloadStateCalibration: {
    source: "checkpoint_snapshot" | "checkpoint_plus_edits" | "latest_prune_edit" | "all_persisted";
    expectedRiskWeight: "LOW" | "WATCH" | "HIGH";
  };
  riskInput: {
    budgetPosture: "SAFE" | "WATCH" | "PRUNE" | "COMPACT";
    hasPruneTrace: boolean;
  };
  expected: {
    level: "LOW" | "WATCH" | "HIGH";
    summaryIncludes: string[];
    actionIncludes: string[];
  };
};

type HelmV22ContinuityObservabilityEvalCaseResult = {
  id: string;
  label: string;
  passed: boolean;
  failures: string[];
  replayStatusPass: boolean;
  payloadSourceRiskPass: boolean;
  riskLevelPass: boolean;
  riskSummaryPass: boolean;
  operatorActionPass: boolean;
};

export type HelmV22ContinuityObservabilityEvalSummary = {
  totalCases: number;
  passedCases: number;
  passRate: number;
  replayStatusRate: number;
  payloadSourceRiskRate: number;
  riskLevelRate: number;
  riskSummaryRate: number;
  operatorActionRate: number;
  cases: HelmV22ContinuityObservabilityEvalCaseResult[];
};

type HelmV22ContinuityRecoveryGoldenCase = {
  id: string;
  label: string;
  budgetPostureInput: {
    budgetTokenLimit: number;
    budgetTokenUsed: number;
    prunedTokenCount: number;
    latestCheckpointStatus?: "READY" | "RESUMED" | null;
    resumedFromKey?: string | null;
  };
  replay: {
    fidelityStatus: "STRONG" | "WATCH" | "WEAK";
    fidelityScore: number;
    missing: string[];
  } | null;
  payloadState: {
    source: "checkpoint_snapshot" | "checkpoint_plus_edits" | "latest_prune_edit" | "all_persisted";
  };
  substrate: {
    latestCheckpoint: {
      id: string;
      label: string;
      status: string;
    } | null;
    persistedPayloadCount: number;
    pruneTraceCount: number;
  };
  expected: {
    recoveryState: "STABLE" | "RECOVERABLE" | "REVIEW_REQUIRED" | "BLOCKED";
    failureTaxonomy:
      | "NONE"
      | "NO_RECOVERY_ANCHOR"
      | "BUDGET_PRESSURE"
      | "PAYLOAD_STATE_DRIFT"
      | "REPLAY_DRIFT"
      | "PROTECTED_STATE_GAP";
    allowedActions: Array<"SAVE_RECOVERY_CHECKPOINT" | "RESUME_CHECKPOINT" | "REPRUNE_CONTEXT">;
    rollbackAnchorRequired: boolean;
    summaryIncludes: string[];
    actionIncludes: string[];
  };
};

type HelmV22ContinuityRecoveryEvalCaseResult = {
  id: string;
  label: string;
  passed: boolean;
  failures: string[];
  recoveryStatePass: boolean;
  taxonomyPass: boolean;
  allowedActionsPass: boolean;
  rollbackAnchorPass: boolean;
  summaryPass: boolean;
  operatorActionPass: boolean;
};

export type HelmV22ContinuityRecoveryEvalSummary = {
  totalCases: number;
  passedCases: number;
  passRate: number;
  recoveryStateRate: number;
  taxonomyRate: number;
  allowedActionsRate: number;
  rollbackAnchorRate: number;
  summaryRate: number;
  operatorActionRate: number;
  cases: HelmV22ContinuityRecoveryEvalCaseResult[];
};

type HelmV22ContinuityRemediationAnalyticsGoldenCase = {
  id: string;
  label: string;
  budgetPostureInput: {
    budgetTokenLimit: number;
    budgetTokenUsed: number;
    prunedTokenCount: number;
    latestCheckpointStatus?: "READY" | "RESUMED" | null;
    resumedFromKey?: string | null;
  };
  replay: {
    fidelityStatus: "STRONG" | "WATCH" | "WEAK";
    fidelityScore: number;
    missing: string[];
  } | null;
  payloadState: {
    source: "checkpoint_snapshot" | "checkpoint_plus_edits" | "latest_prune_edit" | "all_persisted";
    stateSummary: string;
  };
  substrate: {
    latestCheckpoint: {
      id: string;
      label: string;
      status: string;
    } | null;
    persistedPayloadCount: number;
    pruneTraceCount: number;
  };
  notebook: {
    sessionSummary: string;
    decisionSummary: string | null;
    blockerSummary: string | null;
    pendingQuestions: string[];
    openLoopSummary: string | null;
    evidenceRefs: string[];
  };
  pruneTrace?: Array<{
    id: string;
    reason: string;
    posture: "WATCH" | "PRUNE" | "COMPACT";
    tokensSaved: number;
  }>;
  remediationTrace: Array<{
    action: "SAVE_RECOVERY_CHECKPOINT" | "RESUME_CHECKPOINT" | "REPRUNE_CONTEXT";
    executionStatus: "APPLIED" | "REVIEW_REQUIRED" | "BLOCKED";
    summary: string;
    beforeSummary: string;
    afterSummary: string;
    beforeRiskLevel: "LOW" | "WATCH" | "HIGH" | null;
    afterRiskLevel: "LOW" | "WATCH" | "HIGH" | null;
    beforeRecoveryState: "STABLE" | "RECOVERABLE" | "REVIEW_REQUIRED" | "BLOCKED" | null;
    afterRecoveryState: "STABLE" | "RECOVERABLE" | "REVIEW_REQUIRED" | "BLOCKED" | null;
    beforeFailureTaxonomy:
      | "NONE"
      | "NO_RECOVERY_ANCHOR"
      | "BUDGET_PRESSURE"
      | "PAYLOAD_STATE_DRIFT"
      | "REPLAY_DRIFT"
      | "PROTECTED_STATE_GAP"
      | null;
    afterFailureTaxonomy:
      | "NONE"
      | "NO_RECOVERY_ANCHOR"
      | "BUDGET_PRESSURE"
      | "PAYLOAD_STATE_DRIFT"
      | "REPLAY_DRIFT"
      | "PROTECTED_STATE_GAP"
      | null;
    rollbackAnchorSummary: string | null;
    createdAt: string;
  }>;
  expected: {
    repeatPatternStatus: "NONE" | "REPEATED_BLOCKED_ACTION" | "REPEATED_REVIEW_REQUIRED" | "REPEATED_REPRUNE_LOOP";
    totalAttempts: number;
    evidenceIncludes: string[];
    runbookTitle: string;
    runbookIncludes: string[];
  };
};

type HelmV22ContinuityRemediationAnalyticsEvalCaseResult = {
  id: string;
  label: string;
  passed: boolean;
  failures: string[];
  repeatPatternPass: boolean;
  analyticsCountPass: boolean;
  evidencePass: boolean;
  runbookTitlePass: boolean;
  runbookPass: boolean;
};

export type HelmV22ContinuityRemediationAnalyticsEvalSummary = {
  totalCases: number;
  passedCases: number;
  passRate: number;
  repeatPatternRate: number;
  analyticsCountRate: number;
  evidenceRate: number;
  runbookTitleRate: number;
  runbookRate: number;
  cases: HelmV22ContinuityRemediationAnalyticsEvalCaseResult[];
};

type HelmV22ContinuityPilotCalibrationGoldenCase = {
  id: string;
  label: string;
  budgetPostureInput: {
    budgetTokenLimit: number;
    budgetTokenUsed: number;
    prunedTokenCount: number;
    latestCheckpointStatus?: "READY" | "RESUMED" | null;
    resumedFromKey?: string | null;
  };
  replay: {
    fidelityStatus: "STRONG" | "WATCH" | "WEAK";
    fidelityScore: number;
    missing: string[];
  } | null;
  payloadState: {
    source: "checkpoint_snapshot" | "checkpoint_plus_edits" | "latest_prune_edit" | "all_persisted";
    stateSummary: string;
  };
  substrate: {
    latestCheckpoint: {
      id: string;
      label: string;
      status: string;
    } | null;
    persistedPayloadCount: number;
    pruneTraceCount: number;
  };
  notebook: {
    sessionSummary: string;
    decisionSummary: string | null;
    blockerSummary: string | null;
    pendingQuestions: string[];
    openLoopSummary: string | null;
    evidenceRefs: string[];
  };
  pruneTrace?: Array<{
    id: string;
    reason: string;
    posture: "WATCH" | "PRUNE" | "COMPACT";
    tokensSaved: number;
  }>;
  remediationTrace: Array<{
    action: "SAVE_RECOVERY_CHECKPOINT" | "RESUME_CHECKPOINT" | "REPRUNE_CONTEXT";
    executionStatus: "APPLIED" | "REVIEW_REQUIRED" | "BLOCKED";
    summary: string;
    beforeSummary: string;
    afterSummary: string;
    beforeRiskLevel: "LOW" | "WATCH" | "HIGH" | null;
    afterRiskLevel: "LOW" | "WATCH" | "HIGH" | null;
    beforeRecoveryState: "STABLE" | "RECOVERABLE" | "REVIEW_REQUIRED" | "BLOCKED" | null;
    afterRecoveryState: "STABLE" | "RECOVERABLE" | "REVIEW_REQUIRED" | "BLOCKED" | null;
    beforeFailureTaxonomy:
      | "NONE"
      | "NO_RECOVERY_ANCHOR"
      | "BUDGET_PRESSURE"
      | "PAYLOAD_STATE_DRIFT"
      | "REPLAY_DRIFT"
      | "PROTECTED_STATE_GAP"
      | null;
    afterFailureTaxonomy:
      | "NONE"
      | "NO_RECOVERY_ANCHOR"
      | "BUDGET_PRESSURE"
      | "PAYLOAD_STATE_DRIFT"
      | "REPLAY_DRIFT"
      | "PROTECTED_STATE_GAP"
      | null;
    rollbackAnchorSummary: string | null;
    createdAt: string;
  }>;
  expected: {
    calibratedState: "STABLE" | "RECOVERABLE" | "REVIEW_REQUIRED" | "BLOCKED";
    calibrationConfidence: "HIGH" | "MEDIUM" | "LOW";
    latestEffectiveness: "NONE" | "EFFECTIVE" | "PARTIAL" | "INEFFECTIVE" | "NO_SIGNAL";
    repeatPatternStatus:
      | "NONE"
      | "REPEATED_BLOCKED_ACTION"
      | "REPEATED_REVIEW_REQUIRED"
      | "REPEATED_REPRUNE_LOOP"
      | "REPEATED_INEFFECTIVE_ACTION";
    evidenceIncludes: string[];
    runbookTitle: string;
  };
};

type HelmV22ContinuityPilotCalibrationEvalCaseResult = {
  id: string;
  label: string;
  passed: boolean;
  failures: string[];
  calibratedStatePass: boolean;
  calibrationConfidencePass: boolean;
  latestEffectivenessPass: boolean;
  repeatPatternPass: boolean;
  evidencePass: boolean;
  runbookTitlePass: boolean;
};

export type HelmV22ContinuityPilotCalibrationEvalSummary = {
  totalCases: number;
  passedCases: number;
  passRate: number;
  calibratedStateRate: number;
  calibrationConfidenceRate: number;
  latestEffectivenessRate: number;
  repeatPatternRate: number;
  evidenceRate: number;
  runbookTitleRate: number;
  cases: HelmV22ContinuityPilotCalibrationEvalCaseResult[];
};

type EvalContinuityPilotQueueEntry = Parameters<typeof buildRuntimeContinuityPilotEffectivenessReview>[0][number];

type HelmV22ContinuityPilotEffectivenessReviewGoldenCase = {
  id: string;
  label: string;
  queueEntries: Array<{
    id: string;
    title: string;
    failureTaxonomy:
      | "NONE"
      | "NO_RECOVERY_ANCHOR"
      | "BUDGET_PRESSURE"
      | "PAYLOAD_STATE_DRIFT"
      | "REPLAY_DRIFT"
      | "PROTECTED_STATE_GAP";
    recoveryState: "STABLE" | "RECOVERABLE" | "REVIEW_REQUIRED" | "BLOCKED";
    posture?: "SAFE" | "WATCH" | "PRUNE" | "COMPACT";
    replayStatus?: "STRONG" | "WATCH" | "WEAK" | "NONE";
    payloadStateSource?: "checkpoint_snapshot" | "checkpoint_plus_edits" | "latest_prune_edit" | "all_persisted";
    riskLevel?: "LOW" | "WATCH" | "HIGH";
    remediationAttempts: number;
    repeatPatternStatus:
      | "NONE"
      | "REPEATED_BLOCKED_ACTION"
      | "REPEATED_REVIEW_REQUIRED"
      | "REPEATED_REPRUNE_LOOP"
      | "REPEATED_INEFFECTIVE_ACTION";
    calibrationConfidence: "HIGH" | "MEDIUM" | "LOW";
    latestEffectiveness: "NONE" | "EFFECTIVE" | "PARTIAL" | "INEFFECTIVE" | "NO_SIGNAL";
    sessionDensityBand?: "LIGHT" | "STEADY" | "HEAVY";
    meetingFrequencyBand?: "SPORADIC" | "RECURRING" | "HIGH_CADENCE";
    failureHistoryBand?: "FIRST_SIGNAL" | "REPEATED_FAILURE" | "CHRONIC_REPEAT";
    participantRolePosture?: "EXEC_SPONSORED" | "OPERATOR_LED" | "MIXED_STAKEHOLDERS" | "UNKNOWN";
    updatedAt: string;
  }>;
  targetFailureTaxonomy:
    | "NONE"
    | "NO_RECOVERY_ANCHOR"
    | "BUDGET_PRESSURE"
    | "PAYLOAD_STATE_DRIFT"
    | "REPLAY_DRIFT"
    | "PROTECTED_STATE_GAP";
  expected: {
    totalPilotCases: number;
    topFailureClass:
      | "NO_RECOVERY_ANCHOR"
      | "BUDGET_PRESSURE"
      | "PAYLOAD_STATE_DRIFT"
      | "REPLAY_DRIFT"
      | "PROTECTED_STATE_GAP";
    confidenceBand: "HIGH" | "MEDIUM" | "LOW";
    recommendedIneffectiveThreshold: number;
    driftSummaryIncludes: string[];
    calibrationProfileIncludes: string[];
    sessionAdjustmentIncludes: string[];
    sopTitle: string;
    sopIncludes: string[];
  };
};

type HelmV22ContinuityPilotEffectivenessReviewEvalCaseResult = {
  id: string;
  label: string;
  passed: boolean;
  failures: string[];
  distributionPass: boolean;
  driftPass: boolean;
  calibrationProfilePass: boolean;
  sessionReviewPass: boolean;
  sopPass: boolean;
};

export type HelmV22ContinuityPilotEffectivenessReviewEvalSummary = {
  totalCases: number;
  passedCases: number;
  passRate: number;
  distributionRate: number;
  driftRate: number;
  calibrationProfileRate: number;
  sessionReviewRate: number;
  sopRate: number;
  cases: HelmV22ContinuityPilotEffectivenessReviewEvalCaseResult[];
};

type HelmV22ContinuityPilotCalibrationReviewGoldenCase = {
  id: string;
  label: string;
  workspaceSessionCount: number;
  queueEntries: HelmV22ContinuityPilotEffectivenessReviewGoldenCase["queueEntries"];
  targetFailureTaxonomy:
    | "NONE"
    | "NO_RECOVERY_ANCHOR"
    | "BUDGET_PRESSURE"
    | "PAYLOAD_STATE_DRIFT"
    | "REPLAY_DRIFT"
    | "PROTECTED_STATE_GAP";
  expected: {
    workspaceSizeBand: "SMALL" | "GROWING" | "LARGE";
    targetMeetingShape: "LEAN_MEETING" | "LONG_CONTEXT_MEETING" | "RESUMED_MEETING";
    cohortSummaryIncludes: string[];
    thresholdRevisionIncludes: string[];
    driftSummaryIncludes: string[];
    operatorHandlingIncludes: string[];
    matchedGuidanceRate: number;
  };
};

type HelmV22ContinuityPilotCalibrationReviewEvalCaseResult = {
  id: string;
  label: string;
  passed: boolean;
  failures: string[];
  cohortPass: boolean;
  thresholdPass: boolean;
  driftPass: boolean;
  operatorHandlingPass: boolean;
  sessionReviewPass: boolean;
};

export type HelmV22ContinuityPilotCalibrationReviewEvalSummary = {
  totalCases: number;
  passedCases: number;
  passRate: number;
  cohortRate: number;
  thresholdRate: number;
  driftRate: number;
  operatorHandlingRate: number;
  sessionReviewRate: number;
  cases: HelmV22ContinuityPilotCalibrationReviewEvalCaseResult[];
};

type HelmV22ContinuityCalibrationNextLayerGoldenCase = {
  id: string;
  label: string;
  workspaceSessionCount: number;
  queueEntries: HelmV22ContinuityPilotEffectivenessReviewGoldenCase["queueEntries"];
  targetFailureTaxonomy:
    | "NONE"
    | "NO_RECOVERY_ANCHOR"
    | "BUDGET_PRESSURE"
    | "PAYLOAD_STATE_DRIFT"
    | "REPLAY_DRIFT"
    | "PROTECTED_STATE_GAP";
  expected: {
    workspaceSizeBand: "SMALL" | "GROWING" | "LARGE";
    targetMeetingShape: "LEAN_MEETING" | "LONG_CONTEXT_MEETING" | "RESUMED_MEETING";
    targetRiskBand: "LOW" | "WATCH" | "HIGH";
    cohortIncludes: string[];
    recalibrationIncludes: string[];
    longHorizonIncludes: string[];
    varianceIncludes: string[];
    targetStepLabel: string;
  };
};

type HelmV22ContinuityCalibrationNextLayerEvalCaseResult = {
  id: string;
  label: string;
  passed: boolean;
  failures: string[];
  cohortPass: boolean;
  recalibrationPass: boolean;
  longHorizonPass: boolean;
  variancePass: boolean;
  sessionReviewPass: boolean;
};

export type HelmV22ContinuityCalibrationNextLayerEvalSummary = {
  totalCases: number;
  passedCases: number;
  passRate: number;
  cohortRate: number;
  recalibrationRate: number;
  longHorizonRate: number;
  varianceRate: number;
  sessionReviewRate: number;
  cases: HelmV22ContinuityCalibrationNextLayerEvalCaseResult[];
};

type HelmV22ContinuityCalibrationDeepeningGoldenCase = {
  id: string;
  label: string;
  workspaceSessionCount: number;
  queueEntries: HelmV22ContinuityPilotEffectivenessReviewGoldenCase["queueEntries"];
  targetFailureTaxonomy:
    | "NONE"
    | "NO_RECOVERY_ANCHOR"
    | "BUDGET_PRESSURE"
    | "PAYLOAD_STATE_DRIFT"
    | "REPLAY_DRIFT"
    | "PROTECTED_STATE_GAP";
  expected: {
    workspaceSizeBand: "SMALL" | "GROWING" | "LARGE";
    targetMeetingShape: "LEAN_MEETING" | "LONG_CONTEXT_MEETING" | "RESUMED_MEETING";
    targetSessionDensityBand: "LIGHT" | "STEADY" | "HEAVY";
    targetMeetingFrequencyBand: "SPORADIC" | "RECURRING" | "HIGH_CADENCE";
    targetFailureHistoryBand: "FIRST_SIGNAL" | "REPEATED_FAILURE" | "CHRONIC_REPEAT";
    targetParticipantRolePosture: "EXEC_SPONSORED" | "OPERATOR_LED" | "MIXED_STAKEHOLDERS" | "UNKNOWN";
    targetRiskBand: "LOW" | "WATCH" | "HIGH";
    subgroupIncludes: string[];
    refinementIncludes: string[];
    driftSynthesisIncludes: string[];
    sopSynthesisIncludes: string[];
    targetStepLabel: string;
  };
};

type HelmV22ContinuityCalibrationDeepeningEvalCaseResult = {
  id: string;
  label: string;
  passed: boolean;
  failures: string[];
  subgroupPass: boolean;
  refinementPass: boolean;
  driftSynthesisPass: boolean;
  sopSynthesisPass: boolean;
  sessionReviewPass: boolean;
};

export type HelmV22ContinuityCalibrationDeepeningEvalSummary = {
  totalCases: number;
  passedCases: number;
  passRate: number;
  subgroupRate: number;
  refinementRate: number;
  driftSynthesisRate: number;
  sopSynthesisRate: number;
  sessionReviewRate: number;
  cases: HelmV22ContinuityCalibrationDeepeningEvalCaseResult[];
};

type HelmV22ContinuityPilotReviewLongTermOutcomeCorrelationGoldenCase = {
  id: string;
  label: string;
  workspaceSessionCount: number;
  queueEntries: HelmV22ContinuityPilotEffectivenessReviewGoldenCase["queueEntries"];
  targetFailureTaxonomy:
    | "NONE"
    | "NO_RECOVERY_ANCHOR"
    | "BUDGET_PRESSURE"
    | "PAYLOAD_STATE_DRIFT"
    | "REPLAY_DRIFT"
    | "PROTECTED_STATE_GAP";
  expected: {
    workspaceSizeBand: "SMALL" | "GROWING" | "LARGE";
    targetMeetingShape: "LEAN_MEETING" | "LONG_CONTEXT_MEETING" | "RESUMED_MEETING";
    targetRiskBand: "LOW" | "WATCH" | "HIGH";
    sampleReviewIncludes: string[];
    recalibrationIncludes: string[];
    longTermOutcomeIncludes: string[];
    guidanceRefinementIncludes: string[];
    sessionReviewIncludes: string[];
  };
};

type HelmV22ContinuityPilotReviewLongTermOutcomeCorrelationEvalCaseResult = {
  id: string;
  label: string;
  passed: boolean;
  failures: string[];
  sampleReviewPass: boolean;
  recalibrationPass: boolean;
  longTermOutcomePass: boolean;
  guidanceRefinementPass: boolean;
  sessionReviewPass: boolean;
};

export type HelmV22ContinuityPilotReviewLongTermOutcomeCorrelationEvalSummary = {
  totalCases: number;
  passedCases: number;
  passRate: number;
  sampleReviewRate: number;
  recalibrationRate: number;
  longTermOutcomeRate: number;
  guidanceRefinementRate: number;
  sessionReviewRate: number;
  cases: HelmV22ContinuityPilotReviewLongTermOutcomeCorrelationEvalCaseResult[];
};

type HelmV22ContinuityPilotStabilityReviewGoldenCase = {
  id: string;
  label: string;
  workspaceSessionCount: number;
  queueEntries: HelmV22ContinuityPilotEffectivenessReviewGoldenCase["queueEntries"];
  targetFailureTaxonomy:
    | "NONE"
    | "NO_RECOVERY_ANCHOR"
    | "BUDGET_PRESSURE"
    | "PAYLOAD_STATE_DRIFT"
    | "REPLAY_DRIFT"
    | "PROTECTED_STATE_GAP";
  expected: {
    workspaceSizeBand: "SMALL" | "GROWING" | "LARGE";
    targetMeetingShape: "LEAN_MEETING" | "LONG_CONTEXT_MEETING" | "RESUMED_MEETING";
    targetRiskBand: "LOW" | "WATCH" | "HIGH";
    targetStabilityBand: "UNSTABLE" | "WATCH" | "STABLE";
    targetConfidenceInterval: "WIDE" | "GUARDED" | "SETTLED";
    stabilityIncludes: string[];
    intervalIncludes: string[];
    longTermImpactIncludes: string[];
    guidanceAnalysisIncludes: string[];
    sessionReviewIncludes: string[];
  };
};

type HelmV22ContinuityPilotStabilityReviewEvalCaseResult = {
  id: string;
  label: string;
  passed: boolean;
  failures: string[];
  stabilityPass: boolean;
  intervalPass: boolean;
  longTermImpactPass: boolean;
  guidanceAnalysisPass: boolean;
  sessionReviewPass: boolean;
};

export type HelmV22ContinuityPilotStabilityReviewEvalSummary = {
  totalCases: number;
  passedCases: number;
  passRate: number;
  stabilityRate: number;
  intervalRate: number;
  longTermImpactRate: number;
  guidanceAnalysisRate: number;
  sessionReviewRate: number;
  cases: HelmV22ContinuityPilotStabilityReviewEvalCaseResult[];
};

type HelmV22ContinuityPilotStabilityRecheckGoldenCase = {
  id: string;
  label: string;
  workspaceSessionCount: number;
  queueEntries: HelmV22ContinuityPilotEffectivenessReviewGoldenCase["queueEntries"];
  targetFailureTaxonomy:
    | "NONE"
    | "NO_RECOVERY_ANCHOR"
    | "BUDGET_PRESSURE"
    | "PAYLOAD_STATE_DRIFT"
    | "REPLAY_DRIFT"
    | "PROTECTED_STATE_GAP";
  expected: {
    workspaceSizeBand: "SMALL" | "GROWING" | "LARGE";
    targetMeetingShape: "LEAN_MEETING" | "LONG_CONTEXT_MEETING" | "RESUMED_MEETING";
    targetRiskBand: "LOW" | "WATCH" | "HIGH";
    targetStabilityBand: "UNSTABLE" | "WATCH" | "STABLE";
    targetStabilityConfidenceBand: "HIGH" | "MEDIUM" | "LOW";
    targetConfidenceInterval: "WIDE" | "GUARDED" | "SETTLED";
    targetMaterialImpactBand: "HIGH" | "WATCH" | "LOW";
    stabilityRecheckIncludes: string[];
    intervalWordingIncludes: string[];
    longTermOutcomeReviewIncludes: string[];
    outcomeVarianceIncludes: string[];
    sessionReviewIncludes: string[];
  };
};

type HelmV22ContinuityPilotStabilityRecheckEvalCaseResult = {
  id: string;
  label: string;
  passed: boolean;
  failures: string[];
  stabilityRecheckPass: boolean;
  intervalWordingPass: boolean;
  longTermOutcomeReviewPass: boolean;
  outcomeVariancePass: boolean;
  sessionReviewPass: boolean;
};

export type HelmV22ContinuityPilotStabilityRecheckEvalSummary = {
  totalCases: number;
  passedCases: number;
  passRate: number;
  stabilityRecheckRate: number;
  intervalWordingRate: number;
  longTermOutcomeReviewRate: number;
  outcomeVarianceRate: number;
  sessionReviewRate: number;
  cases: HelmV22ContinuityPilotStabilityRecheckEvalCaseResult[];
};

type HelmV22ContinuityPilotStabilityScaleUpGoldenCase = {
  id: string;
  label: string;
  sourceCaseId: string;
  expected: {
    workspaceSizeBand: "SMALL" | "GROWING" | "LARGE";
    targetMeetingShape: "LEAN_MEETING" | "LONG_CONTEXT_MEETING" | "RESUMED_MEETING";
    targetRiskBand: "LOW" | "WATCH" | "HIGH";
    targetStabilityBand: "UNSTABLE" | "WATCH" | "STABLE";
    targetStabilityConfidenceBand: "HIGH" | "MEDIUM" | "LOW";
    targetConfidenceInterval: "WIDE" | "GUARDED" | "SETTLED";
    targetMaterialImpactBand: "HIGH" | "WATCH" | "LOW";
    stabilityScaleUpIncludes: string[];
    intervalWordingDriftIncludes: string[];
    longTermMaterialImpactReviewIncludes: string[];
    sessionReviewIncludes: string[];
  };
};

type HelmV22ContinuityPilotStabilityScaleUpEvalCaseResult = {
  id: string;
  label: string;
  passed: boolean;
  failures: string[];
  stabilityScaleUpPass: boolean;
  intervalWordingDriftPass: boolean;
  longTermMaterialImpactReviewPass: boolean;
  sessionReviewPass: boolean;
};

export type HelmV22ContinuityPilotStabilityScaleUpEvalSummary = {
  totalCases: number;
  passedCases: number;
  passRate: number;
  stabilityScaleUpRate: number;
  intervalWordingDriftRate: number;
  longTermMaterialImpactReviewRate: number;
  sessionReviewRate: number;
  cases: HelmV22ContinuityPilotStabilityScaleUpEvalCaseResult[];
};

type HelmV22ContinuityPilotScaleUpRecheckGoldenCase = {
  id: string;
  label: string;
  sourceCaseId: string;
  expected: {
    workspaceSizeBand: "SMALL" | "GROWING" | "LARGE";
    targetMeetingShape: "LEAN_MEETING" | "LONG_CONTEXT_MEETING" | "RESUMED_MEETING";
    targetRiskBand: "LOW" | "WATCH" | "HIGH";
    targetStabilityBand: "UNSTABLE" | "WATCH" | "STABLE";
    targetStabilityConfidenceBand: "HIGH" | "MEDIUM" | "LOW";
    targetConfidenceInterval: "WIDE" | "GUARDED" | "SETTLED";
    targetWordingDriftRate: number;
    targetMaterialImpactBand: "HIGH" | "WATCH" | "LOW";
    stabilityScaleUpRecheckIncludes: string[];
    wordingDriftTrackingIncludes: string[];
    intervalConsistencyGuidanceIncludes: string[];
    longTermMaterialImpactAuditIncludes: string[];
    sessionReviewIncludes: string[];
  };
};

type HelmV22ContinuityPilotScaleUpRecheckEvalCaseResult = {
  id: string;
  label: string;
  passed: boolean;
  failures: string[];
  stabilityScaleUpRecheckPass: boolean;
  wordingDriftTrackingPass: boolean;
  intervalConsistencyGuidancePass: boolean;
  longTermMaterialImpactAuditPass: boolean;
  sessionReviewPass: boolean;
};

export type HelmV22ContinuityPilotScaleUpRecheckEvalSummary = {
  totalCases: number;
  passedCases: number;
  passRate: number;
  stabilityScaleUpRecheckRate: number;
  wordingDriftTrackingRate: number;
  intervalConsistencyGuidanceRate: number;
  longTermMaterialImpactAuditRate: number;
  sessionReviewRate: number;
  cases: HelmV22ContinuityPilotScaleUpRecheckEvalCaseResult[];
};

type HelmV22ContinuitySubgroupStabilityDriftAgingGoldenCase = {
  id: string;
  label: string;
  sourceCaseId: string;
  expected: {
    workspaceSizeBand: "SMALL" | "GROWING" | "LARGE";
    targetMeetingShape: "LEAN_MEETING" | "LONG_CONTEXT_MEETING" | "RESUMED_MEETING";
    targetRiskBand: "LOW" | "WATCH" | "HIGH";
    targetStabilityBand: "UNSTABLE" | "WATCH" | "STABLE";
    targetStabilityConfidenceBand: "HIGH" | "MEDIUM" | "LOW";
    targetConfidenceInterval: "WIDE" | "GUARDED" | "SETTLED";
    targetIntervalWordingRegressionRate: number;
    targetMaterialImpactBand: "HIGH" | "WATCH" | "LOW";
    subgroupStabilityDriftIncludes: string[];
    intervalWordingAgingIncludes: string[];
    materialImpactPatternAgingIncludes: string[];
    sessionReviewIncludes: string[];
  };
};

type HelmV22ContinuitySubgroupStabilityDriftAgingEvalCaseResult = {
  id: string;
  label: string;
  passed: boolean;
  failures: string[];
  subgroupStabilityDriftPass: boolean;
  intervalWordingAgingPass: boolean;
  materialImpactPatternAgingPass: boolean;
  sessionReviewPass: boolean;
};

export type HelmV22ContinuitySubgroupStabilityDriftAgingEvalSummary = {
  totalCases: number;
  passedCases: number;
  passRate: number;
  subgroupStabilityDriftRate: number;
  intervalWordingAgingRate: number;
  materialImpactPatternAgingRate: number;
  sessionReviewRate: number;
  cases: HelmV22ContinuitySubgroupStabilityDriftAgingEvalCaseResult[];
};

type HelmV22ContinuitySubgroupDriftCohortAgingImpactGoldenCase = {
  id: string;
  label: string;
  sourceCaseId: string;
  expected: {
    workspaceSizeBand: "SMALL" | "GROWING" | "LARGE";
    targetMeetingShape: "LEAN_MEETING" | "LONG_CONTEXT_MEETING" | "RESUMED_MEETING";
    targetRiskBand: "LOW" | "WATCH" | "HIGH";
    targetStabilityBand: "UNSTABLE" | "WATCH" | "STABLE";
    targetStabilityConfidenceBand: "HIGH" | "MEDIUM" | "LOW";
    targetConfidenceInterval: "WIDE" | "GUARDED" | "SETTLED";
    targetIntervalWordingRegressionRate: number;
    targetMaterialImpactBand: "HIGH" | "WATCH" | "LOW";
    subgroupCohortAgingIncludes: string[];
    intervalWordingRegressionIncludes: string[];
    materialImpactSamplingIncludes: string[];
    sessionReviewIncludes: string[];
  };
};

type HelmV22ContinuitySubgroupDriftCohortAgingImpactEvalCaseResult = {
  id: string;
  label: string;
  passed: boolean;
  failures: string[];
  subgroupCohortAgingPass: boolean;
  intervalWordingRegressionPass: boolean;
  materialImpactSamplingPass: boolean;
  sessionReviewPass: boolean;
};

export type HelmV22ContinuitySubgroupDriftCohortAgingImpactEvalSummary = {
  totalCases: number;
  passedCases: number;
  passRate: number;
  subgroupCohortAgingRate: number;
  intervalWordingRegressionRate: number;
  materialImpactSamplingRate: number;
  sessionReviewRate: number;
  cases: HelmV22ContinuitySubgroupDriftCohortAgingImpactEvalCaseResult[];
};

type HelmV22ContinuitySubgroupDriftAgingMaterialImpactAuditGoldenCase = {
  id: string;
  label: string;
  sourceCaseId: string;
  expected: {
    workspaceSizeBand: "SMALL" | "GROWING" | "LARGE";
    targetMeetingShape: "LEAN_MEETING" | "LONG_CONTEXT_MEETING" | "RESUMED_MEETING";
    targetRiskBand: "LOW" | "WATCH" | "HIGH";
    targetStabilityBand: "UNSTABLE" | "WATCH" | "STABLE";
    targetStabilityConfidenceBand: "HIGH" | "MEDIUM" | "LOW";
    targetConfidenceInterval: "WIDE" | "GUARDED" | "SETTLED";
    targetIntervalWordingConsistencyRate: number;
    targetMaterialImpactBand: "HIGH" | "WATCH" | "LOW";
    subgroupDriftAgingIncludes: string[];
    intervalWordingConsistencyIncludes: string[];
    materialImpactSamplingAgingIncludes: string[];
    sessionReviewIncludes: string[];
  };
};

type HelmV22ContinuitySubgroupDriftAgingMaterialImpactAuditEvalCaseResult = {
  id: string;
  label: string;
  passed: boolean;
  failures: string[];
  subgroupDriftAgingPass: boolean;
  intervalWordingConsistencyPass: boolean;
  materialImpactSamplingAgingPass: boolean;
  sessionReviewPass: boolean;
};

export type HelmV22ContinuitySubgroupDriftAgingMaterialImpactAuditEvalSummary = {
  totalCases: number;
  passedCases: number;
  passRate: number;
  subgroupDriftAgingRate: number;
  intervalWordingConsistencyRate: number;
  materialImpactSamplingAgingRate: number;
  sessionReviewRate: number;
  cases: HelmV22ContinuitySubgroupDriftAgingMaterialImpactAuditEvalCaseResult[];
};

type HelmV22ContinuitySubgroupDriftImpactAgingRefinementGoldenCase = {
  id: string;
  label: string;
  sourceCaseId: string;
  expected: {
    workspaceSizeBand: "SMALL" | "GROWING" | "LARGE";
    targetMeetingShape: "LEAN_MEETING" | "LONG_CONTEXT_MEETING" | "RESUMED_MEETING";
    targetRiskBand: "LOW" | "WATCH" | "HIGH";
    targetStabilityBand: "UNSTABLE" | "WATCH" | "STABLE";
    targetStabilityConfidenceBand: "HIGH" | "MEDIUM" | "LOW";
    targetConfidenceInterval: "WIDE" | "GUARDED" | "SETTLED";
    targetRegressionAuditRate: number;
    targetMaterialImpactBand: "HIGH" | "WATCH" | "LOW";
    subgroupDriftRefinementIncludes: string[];
    intervalWordingRegressionAuditIncludes: string[];
    materialImpactAgingRefinementIncludes: string[];
    sessionReviewIncludes: string[];
  };
};

type HelmV22ContinuitySubgroupDriftImpactAgingRefinementEvalCaseResult = {
  id: string;
  label: string;
  passed: boolean;
  failures: string[];
  subgroupDriftRefinementPass: boolean;
  intervalWordingRegressionAuditPass: boolean;
  materialImpactAgingRefinementPass: boolean;
  sessionReviewPass: boolean;
};

export type HelmV22ContinuitySubgroupDriftImpactAgingRefinementEvalSummary = {
  totalCases: number;
  passedCases: number;
  passRate: number;
  subgroupDriftRefinementRate: number;
  intervalWordingRegressionAuditRate: number;
  materialImpactAgingRefinementRate: number;
  sessionReviewRate: number;
  cases: HelmV22ContinuitySubgroupDriftImpactAgingRefinementEvalCaseResult[];
};

type HelmV22ContinuitySubgroupDriftLongTermAgingMaterialImpactAuditGoldenCase = {
  id: string;
  label: string;
  sourceCaseId: string;
  expected: {
    workspaceSizeBand: "SMALL" | "GROWING" | "LARGE";
    targetMeetingShape: "LEAN_MEETING" | "LONG_CONTEXT_MEETING" | "RESUMED_MEETING";
    targetRiskBand: "LOW" | "WATCH" | "HIGH";
    targetStabilityBand: "UNSTABLE" | "WATCH" | "STABLE";
    targetStabilityConfidenceBand: "HIGH" | "MEDIUM" | "LOW";
    targetCrossReadoutRegressionAuditRate: number;
    targetMaterialImpactBand: "HIGH" | "WATCH" | "LOW";
    subgroupDriftLongTermAgingIncludes: string[];
    intervalWordingCrossReadoutAuditIncludes: string[];
    materialImpactSamplingAgingAuditIncludes: string[];
    sessionReviewIncludes: string[];
  };
};

type HelmV22ContinuitySubgroupDriftLongTermAgingMaterialImpactAuditEvalCaseResult = {
  id: string;
  label: string;
  passed: boolean;
  failures: string[];
  subgroupDriftLongTermAgingPass: boolean;
  intervalWordingCrossReadoutAuditPass: boolean;
  materialImpactSamplingAgingAuditPass: boolean;
  sessionReviewPass: boolean;
};

export type HelmV22ContinuitySubgroupDriftLongTermAgingMaterialImpactAuditEvalSummary = {
  totalCases: number;
  passedCases: number;
  passRate: number;
  subgroupDriftLongTermAgingRate: number;
  intervalWordingCrossReadoutAuditRate: number;
  materialImpactSamplingAgingAuditRate: number;
  sessionReviewRate: number;
  cases: HelmV22ContinuitySubgroupDriftLongTermAgingMaterialImpactAuditEvalCaseResult[];
};

type HelmV22ContinuitySubgroupDriftMaterialImpactAgingAuditRefinementGoldenCase = {
  id: string;
  label: string;
  sourceCaseId: string;
  expected: {
    workspaceSizeBand: "SMALL" | "GROWING" | "LARGE";
    targetMeetingShape: "LEAN_MEETING" | "LONG_CONTEXT_MEETING" | "RESUMED_MEETING";
    targetRiskBand: "LOW" | "WATCH" | "HIGH";
    targetStabilityBand: "UNSTABLE" | "WATCH" | "STABLE";
    targetStabilityConfidenceBand: "HIGH" | "MEDIUM" | "LOW";
    targetCrossReadoutRegressionRefinementRate: number;
    targetMaterialImpactBand: "HIGH" | "WATCH" | "LOW";
    subgroupDriftExpansionRefinementIncludes: string[];
    intervalWordingCrossReadoutRefinementIncludes: string[];
    materialImpactSamplingRefinementAuditIncludes: string[];
    sessionReviewIncludes: string[];
  };
};

type HelmV22ContinuitySubgroupDriftMaterialImpactAgingAuditRefinementEvalCaseResult = {
  id: string;
  label: string;
  passed: boolean;
  failures: string[];
  subgroupDriftExpansionRefinementPass: boolean;
  intervalWordingCrossReadoutRefinementPass: boolean;
  materialImpactSamplingRefinementAuditPass: boolean;
  sessionReviewPass: boolean;
};

export type HelmV22ContinuitySubgroupDriftMaterialImpactAgingAuditRefinementEvalSummary = {
  totalCases: number;
  passedCases: number;
  passRate: number;
  subgroupDriftExpansionRefinementRate: number;
  intervalWordingCrossReadoutRefinementRate: number;
  materialImpactSamplingRefinementAuditRate: number;
  sessionReviewRate: number;
  cases: HelmV22ContinuitySubgroupDriftMaterialImpactAgingAuditRefinementEvalCaseResult[];
};

type HumanActionExecutionGoldenCase = {
  id: string;
  label: string;
  workspaceSummary: string;
  meeting: MeetingRuntimeGoldenCase["meeting"];
  promotedMemorySummaries: string[];
  historicalTimeline: string[];
  handoffSources?: Array<{
    artifactType: "handoff_pack.md" | "first_14_day_plan.md";
    title: string;
    summary: string;
    targetAudience: "delivery" | "customer_success";
  }>;
  expected: {
    requiredActionTypes: HumanActionExecutionActionType[];
    primaryActionType: HumanActionExecutionActionType;
    acknowledgementMode: HumanActionExecutionAckMode;
    requiredBoundaryNotes: string[];
    requiresRoleHandoff: boolean;
  };
};

type HumanActionExecutionEvalCaseResult = {
  id: string;
  label: string;
  passed: boolean;
  failures: string[];
  executionPathConsistencyPass: boolean;
  proofWritebackConsistencyPass: boolean;
  approvalBoundaryConsistencyPass: boolean;
  manualAcknowledgementPass: boolean;
  roleHandoffPass: boolean;
};

export type HelmV2HumanActionExecutionEvalSummary = {
  totalCases: number;
  passedCases: number;
  passRate: number;
  executionPathConsistencyRate: number;
  proofWritebackConsistencyRate: number;
  approvalBoundaryConsistencyRate: number;
  manualAcknowledgementRate: number;
  roleHandoffRate: number;
  cases: HumanActionExecutionEvalCaseResult[];
};

type OfficialSystemIntegrationGoldenCase = {
  id: string;
  label: string;
  shadowSource?: OfficialWriteShadowSource | null;
  executionProofSources?: OfficialWriteExecutionProofSource[];
  expected: {
    requiredActionTypes: OfficialWriteActionTypeValue[];
  };
};

type OfficialSystemIntegrationEvalCaseResult = {
  id: string;
  label: string;
  passed: boolean;
  failures: string[];
  writeIntentConsistencyPass: boolean;
  approvalMatrixEnforcementPass: boolean;
  shadowOfficialSeparationPass: boolean;
  evidenceSufficiencyPass: boolean;
  acknowledgementFailureCapturePass: boolean;
  noAutoWriteSafetyPass: boolean;
};

export type HelmV2OfficialSystemIntegrationEvalSummary = {
  totalCases: number;
  passedCases: number;
  passRate: number;
  writeIntentConsistencyRate: number;
  approvalMatrixEnforcementRate: number;
  shadowOfficialSeparationRate: number;
  evidenceSufficiencyRate: number;
  acknowledgementFailureCaptureRate: number;
  noAutoWriteSafetyRate: number;
  cases: OfficialSystemIntegrationEvalCaseResult[];
};

type ConnectorIngestionRetrievalGoldenCase = {
  id: string;
  label: string;
  workspaceSummary: string;
  meeting: MeetingRuntimeGoldenCase["meeting"];
  promotedMemorySummaries: string[];
  staleMemorySummaries?: string[];
  includeTranscript?: boolean;
  includeEmailThread?: boolean;
  includeHumanEdit?: boolean;
  includeDraftCommsRuntime?: boolean;
  includeOfficialWriteRuntime?: boolean;
  expected: {
    sourceExpectations: Array<{
      sourceType:
        | "calendar_event"
        | "meeting_transcript"
        | "meeting_note"
        | "crm_snapshot"
        | "email_thread"
        | "human_edit"
        | "agent_inference";
      trustLevel: "trusted" | "untrusted";
      promotionEligibility: "draft_only" | "human_confirmed" | "system_of_record";
    }>;
    requiredLoadedKeys: string[];
    requiredSkippedKeys: string[];
    staleSuppressedKeys: string[];
  };
};

type ConnectorIngestionRetrievalEvalCaseResult = {
  id: string;
  label: string;
  passed: boolean;
  failures: string[];
  ingestionTrustClassificationPass: boolean;
  promotionEligibilityPass: boolean;
  retrievalRelevancePass: boolean;
  staleMemorySuppressionPass: boolean;
  policyLoadingCorrectnessPass: boolean;
  objectSummaryLoadingCorrectnessPass: boolean;
  evidenceProvenanceCompletenessPass: boolean;
};

export type HelmV2ConnectorIngestionRetrievalEvalSummary = {
  totalCases: number;
  passedCases: number;
  passRate: number;
  ingestionTrustClassificationRate: number;
  promotionEligibilityRate: number;
  retrievalRelevanceRate: number;
  staleMemorySuppressionRate: number;
  policyLoadingCorrectnessRate: number;
  objectSummaryLoadingCorrectnessRate: number;
  evidenceProvenanceCompletenessRate: number;
  cases: ConnectorIngestionRetrievalEvalCaseResult[];
};

type LimitedAutoGoldenCase = {
  id: string;
  label: string;
  shadowSource?: OfficialWriteShadowSource | null;
  executionProofSources?: OfficialWriteExecutionProofSource[];
  expected: {
    requiredEligibleActionTypes: OfficialWriteActionTypeValue[];
    requiredManualOnlyActionTypes: OfficialWriteActionTypeValue[];
  };
};

type LimitedAutoEvalCaseResult = {
  id: string;
  label: string;
  passed: boolean;
  failures: string[];
  limitedAutoEligibilityCorrectnessPass: boolean;
  whitelistEnforcementPass: boolean;
  noAutoWriteDefaultPass: boolean;
  acknowledgementBoundaryPass: boolean;
  manualOverridePass: boolean;
  shadowOfficialProofAckBoundaryPass: boolean;
};

export type HelmV2LimitedAutoEvalSummary = {
  totalCases: number;
  passedCases: number;
  passRate: number;
  limitedAutoEligibilityCorrectnessRate: number;
  whitelistEnforcementRate: number;
  noAutoWriteDefaultRate: number;
  acknowledgementBoundaryRate: number;
  manualOverrideRate: number;
  shadowOfficialProofAckBoundaryRate: number;
  cases: LimitedAutoEvalCaseResult[];
};

type RicherOfficialCoverageGoldenCase = {
  id: string;
  label: string;
  shadowSource?: OfficialWriteShadowSource | null;
  executionProofSources?: OfficialWriteExecutionProofSource[];
  expected: {
    requiredEligibleActionTypes: OfficialWriteActionTypeValue[];
    requiredManualOnlyActionTypes: OfficialWriteActionTypeValue[];
    requiredBlockedActionTypes: OfficialCoverageActionTypeValue[];
  };
};

type RicherOfficialCoverageEvalCaseResult = {
  id: string;
  label: string;
  passed: boolean;
  failures: string[];
  richerActionCoveragePass: boolean;
  richerEligibilityPass: boolean;
  richerExecutionPass: boolean;
  acknowledgmentReceiptInterpretationPass: boolean;
  reconciliationPathPass: boolean;
  manualFallbackPass: boolean;
  noBroadAutoWritePass: boolean;
  separationPass: boolean;
};

export type HelmV2RicherOfficialCoverageEvalSummary = {
  totalCases: number;
  passedCases: number;
  passRate: number;
  richerActionCoverageRate: number;
  richerEligibilityRate: number;
  richerExecutionRate: number;
  acknowledgmentReceiptInterpretationRate: number;
  reconciliationPathRate: number;
  manualFallbackRate: number;
  noBroadAutoWriteRate: number;
  separationRate: number;
  cases: RicherOfficialCoverageEvalCaseResult[];
};

type OfficialFollowThroughGoldenCase = {
  id: string;
  label: string;
  shadowSource?: OfficialWriteShadowSource | null;
  executionProofSources?: OfficialWriteExecutionProofSource[];
  targetActionType: OfficialWriteActionTypeValue;
  sourcePath: "guarded_ack" | "limited_auto_manual_override";
  outcome:
    | "ack_success"
    | "ack_failure"
    | "receipt_unknown"
    | "receipt_stale"
    | "receipt_partial_success"
    | "manual_override";
  expected: {
    requiredFollowThroughTypes: OfficialFollowThroughTypeValue[];
    transitionChecks: Array<{
      followThroughType: OfficialFollowThroughTypeValue;
      updateMode: OfficialFollowThroughUpdateMode;
      expectedStatus: OfficialFollowThroughStatusValue;
      expectedResolutionStatus: OfficialFollowThroughResolutionStatusValue;
      expectedReconciliationStatus: OfficialReconciliationStatusValue;
    }>;
    requiredWritebackTargets: string[];
  };
};

type OfficialFollowThroughEvalCaseResult = {
  id: string;
  label: string;
  passed: boolean;
  failures: string[];
  followThroughClassificationPass: boolean;
  exceptionStateTransitionPass: boolean;
  reconciliationPathPass: boolean;
  manualOverrideEscalationPass: boolean;
  resolutionWritebackPass: boolean;
  officialSuccessConfusionPass: boolean;
  noBroadAutoWritePass: boolean;
};

export type HelmV2OfficialFollowThroughEvalSummary = {
  totalCases: number;
  passedCases: number;
  passRate: number;
  followThroughClassificationRate: number;
  exceptionStateTransitionRate: number;
  reconciliationPathRate: number;
  manualOverrideEscalationRate: number;
  resolutionWritebackRate: number;
  officialSuccessConfusionRate: number;
  noBroadAutoWriteRate: number;
  cases: OfficialFollowThroughEvalCaseResult[];
};

function loadMeetingRuntimeGoldenCases() {
  return loadEvalFixture<MeetingRuntimeGoldenCase[]>("evals/helm-v2/meeting-runtime-golden-samples.json");
}

function loadDraftCommsGoldenCases() {
  return loadEvalFixture<DraftCommsGoldenCase[]>("evals/helm-v2/draft-comms-golden-samples.json");
}

function loadOpportunityJudgeGoldenCases() {
  return loadEvalFixture<OpportunityJudgeGoldenCase[]>("evals/helm-v2/opportunity-judge-golden-samples.json");
}

function loadHumanActionExecutionGoldenCases() {
  return loadEvalFixture<HumanActionExecutionGoldenCase[]>("evals/helm-v2/human-action-execution-golden-samples.json");
}

function loadOfficialSystemIntegrationGoldenCases() {
  return loadEvalFixture<OfficialSystemIntegrationGoldenCase[]>("evals/helm-v2/official-system-integration-golden-samples.json");
}

function loadConnectorIngestionRetrievalGoldenCases() {
  return loadEvalFixture<ConnectorIngestionRetrievalGoldenCase[]>("evals/helm-v2/connector-ingestion-retrieval-golden-samples.json");
}

function loadLimitedAutoGoldenCases() {
  return loadEvalFixture<LimitedAutoGoldenCase[]>("evals/helm-v2/limited-auto-path-golden-samples.json");
}

function loadRicherOfficialCoverageGoldenCases() {
  return loadEvalFixture<RicherOfficialCoverageGoldenCase[]>("evals/helm-v2/richer-official-coverage-golden-samples.json");
}

function loadOfficialFollowThroughGoldenCases() {
  return loadEvalFixture<OfficialFollowThroughGoldenCase[]>("evals/helm-v2/official-followthrough-golden-samples.json");
}

function loadCoordinationTraceGoldenCases() {
  return loadEvalFixture<HelmV22CoordinationTraceGoldenCase[]>("evals/helm-v2/coordination-trace-v2_2-golden-samples.json");
}

function loadBudgetedSessionContinuityGoldenCases() {
  return loadEvalFixture<HelmV21BudgetedSessionContinuityGoldenCase[]>(
    "evals/helm-v2/budgeted-session-continuity-v2_1-golden-samples.json",
  );
}

function loadContinuityObservabilityGoldenCases() {
  return loadEvalFixture<HelmV22ContinuityObservabilityGoldenCase[]>(
    "evals/helm-v2/continuity-observability-v2_2-golden-samples.json",
  );
}

function loadContinuityRecoveryGoldenCases() {
  return loadEvalFixture<HelmV22ContinuityRecoveryGoldenCase[]>(
    "evals/helm-v2/continuity-recovery-v2_2-golden-samples.json",
  );
}

function loadContinuityRemediationAnalyticsGoldenCases() {
  return loadEvalFixture<HelmV22ContinuityRemediationAnalyticsGoldenCase[]>(
    "evals/helm-v2/continuity-remediation-analytics-v2_2-golden-samples.json",
  );
}

function loadContinuityPilotCalibrationGoldenCases() {
  return loadEvalFixture<HelmV22ContinuityPilotCalibrationGoldenCase[]>(
    "evals/helm-v2/continuity-pilot-calibration-remediation-effectiveness-v2_2-golden-samples.json",
  );
}

function loadContinuityPilotEffectivenessReviewGoldenCases() {
  return loadEvalFixture<HelmV22ContinuityPilotEffectivenessReviewGoldenCase[]>(
    "evals/helm-v2/continuity-pilot-effectiveness-review-v2_2-golden-samples.json",
  );
}

function loadContinuityPilotCalibrationReviewGoldenCases() {
  return loadEvalFixture<HelmV22ContinuityPilotCalibrationReviewGoldenCase[]>(
    "evals/helm-v2/continuity-pilot-calibration-review-v2_2-golden-samples.json",
  );
}

function loadContinuityCalibrationNextLayerGoldenCases() {
  return loadEvalFixture<HelmV22ContinuityCalibrationNextLayerGoldenCase[]>(
    "evals/helm-v2/continuity-calibration-next-layer-v2_2-golden-samples.json",
  );
}

function loadContinuityCalibrationDeepeningGoldenCases() {
  return loadEvalFixture<HelmV22ContinuityCalibrationDeepeningGoldenCase[]>(
    "evals/helm-v2/continuity-calibration-deepening-sop-effectiveness-synthesis-v2_2-golden-samples.json",
  );
}

function loadContinuityPilotReviewLongTermOutcomeCorrelationGoldenCases() {
  return loadEvalFixture<HelmV22ContinuityPilotReviewLongTermOutcomeCorrelationGoldenCase[]>(
    "evals/helm-v2/continuity-pilot-review-long-term-outcome-correlation-v2_2-golden-samples.json",
  );
}

function loadContinuityPilotStabilityReviewGoldenCases() {
  return loadEvalFixture<HelmV22ContinuityPilotStabilityReviewGoldenCase[]>(
    "evals/helm-v2/continuity-pilot-stability-review-long-term-outcome-refinement-v2_2-golden-samples.json",
  );
}

function loadContinuityPilotStabilityRecheckGoldenCases() {
  return loadEvalFixture<HelmV22ContinuityPilotStabilityRecheckGoldenCase[]>(
    "evals/helm-v2/continuity-pilot-stability-recheck-long-term-outcome-refinement-v2_2-golden-samples.json",
  );
}

function loadContinuityPilotStabilityScaleUpGoldenCases() {
  return loadEvalFixture<HelmV22ContinuityPilotStabilityScaleUpGoldenCase[]>(
    "evals/helm-v2/continuity-pilot-stability-scale-up-long-term-impact-refinement-v2_2-golden-samples.json",
  );
}

function loadContinuityPilotScaleUpRecheckGoldenCases() {
  return loadEvalFixture<HelmV22ContinuityPilotScaleUpRecheckGoldenCase[]>(
    "evals/helm-v2/continuity-pilot-scale-up-recheck-material-impact-audit-v2_2-golden-samples.json",
  );
}

function loadContinuitySubgroupStabilityDriftAgingGoldenCases() {
  return loadEvalFixture<HelmV22ContinuitySubgroupStabilityDriftAgingGoldenCase[]>(
    "evals/helm-v2/continuity-subgroup-stability-drift-material-impact-aging-review-v2_2-golden-samples.json",
  );
}

function loadContinuitySubgroupDriftCohortAgingImpactGoldenCases() {
  return loadEvalFixture<HelmV22ContinuitySubgroupDriftCohortAgingImpactGoldenCase[]>(
    "evals/helm-v2/continuity-subgroup-drift-cohort-aging-impact-review-v2_2-golden-samples.json",
  );
}

function loadContinuitySubgroupDriftAgingMaterialImpactAuditGoldenCases() {
  return loadEvalFixture<HelmV22ContinuitySubgroupDriftAgingMaterialImpactAuditGoldenCase[]>(
    "evals/helm-v2/continuity-subgroup-drift-aging-material-impact-audit-v2_2-golden-samples.json",
  );
}

function loadContinuitySubgroupDriftImpactAgingRefinementGoldenCases() {
  return loadEvalFixture<HelmV22ContinuitySubgroupDriftImpactAgingRefinementGoldenCase[]>(
    "evals/helm-v2/continuity-subgroup-drift-impact-aging-refinement-v2_2-golden-samples.json",
  );
}

function loadContinuitySubgroupDriftLongTermAgingMaterialImpactAuditGoldenCases() {
  return loadEvalFixture<HelmV22ContinuitySubgroupDriftLongTermAgingMaterialImpactAuditGoldenCase[]>(
    "evals/helm-v2/continuity-subgroup-drift-long-term-aging-material-impact-audit-v2_2-golden-samples.json",
  );
}

function loadContinuitySubgroupDriftMaterialImpactAgingAuditRefinementGoldenCases() {
  return loadEvalFixture<HelmV22ContinuitySubgroupDriftMaterialImpactAgingAuditRefinementGoldenCase[]>(
    "evals/helm-v2/continuity-subgroup-drift-material-impact-aging-audit-refinement-v2_2-golden-samples.json",
  );
}

function buildEvalContinuityPilotQueueEntry(
  input: HelmV22ContinuityPilotEffectivenessReviewGoldenCase["queueEntries"][number],
): EvalContinuityPilotQueueEntry {
  const meetingShape =
    input.posture === "COMPACT" ||
    input.payloadStateSource === "checkpoint_plus_edits" ||
    (input.payloadStateSource === "checkpoint_snapshot" && input.replayStatus && input.replayStatus !== "NONE")
      ? "RESUMED_MEETING"
      : input.posture === "PRUNE" ||
          input.payloadStateSource === "latest_prune_edit" ||
          input.replayStatus === "WATCH" ||
          input.replayStatus === "WEAK"
        ? "LONG_CONTEXT_MEETING"
        : "LEAN_MEETING";
  const guidanceStatus =
    input.failureTaxonomy === "NO_RECOVERY_ANCHOR" || input.failureTaxonomy === "PROTECTED_STATE_GAP"
      ? input.repeatPatternStatus !== "NONE"
        ? "SKIPPED_GUIDANCE"
        : input.recoveryState === "REVIEW_REQUIRED" || input.recoveryState === "BLOCKED"
          ? "MATCHED_GUIDANCE"
          : "NEEDS_MORE_EVIDENCE"
      : input.latestEffectiveness === "EFFECTIVE" || input.latestEffectiveness === "PARTIAL"
        ? "MATCHED_GUIDANCE"
        : input.latestEffectiveness === "INEFFECTIVE"
          ? input.repeatPatternStatus !== "NONE" || input.recoveryState === "REVIEW_REQUIRED" || input.recoveryState === "BLOCKED"
            ? "INEFFECTIVE_AFTER_GUIDANCE"
            : "SKIPPED_GUIDANCE"
          : input.repeatPatternStatus !== "NONE" && input.recoveryState === "RECOVERABLE"
            ? "SKIPPED_GUIDANCE"
            : "NEEDS_MORE_EVIDENCE";
  const pilotSampleCoverageBand =
    input.calibrationConfidence === "HIGH"
      ? "BROAD"
      : input.calibrationConfidence === "MEDIUM" || input.remediationAttempts >= 2
        ? "QUALIFIED"
        : "NARROW";
  const pilotStabilityBand =
    input.repeatPatternStatus === "REPEATED_INEFFECTIVE_ACTION" || input.latestEffectiveness === "INEFFECTIVE"
      ? "UNSTABLE"
      : input.calibrationConfidence === "HIGH" && input.latestEffectiveness !== "NO_SIGNAL"
        ? "STABLE"
        : "WATCH";
  const pilotConfidenceInterval =
    pilotStabilityBand === "UNSTABLE" || pilotSampleCoverageBand === "NARROW" || input.calibrationConfidence === "LOW"
      ? "WIDE"
      : pilotStabilityBand === "WATCH" ||
          pilotSampleCoverageBand === "QUALIFIED" ||
          input.calibrationConfidence === "MEDIUM"
        ? "GUARDED"
        : "SETTLED";
  const pilotOutcomeCorrelationBand =
    input.latestEffectiveness === "INEFFECTIVE" || input.repeatPatternStatus === "REPEATED_INEFFECTIVE_ACTION"
      ? "AT_RISK"
      : input.latestEffectiveness === "EFFECTIVE" || input.latestEffectiveness === "PARTIAL"
        ? "STABLE"
        : "WATCH";
  const pilotStabilityConfidenceBand =
    pilotSampleCoverageBand === "BROAD" && pilotStabilityBand === "STABLE"
      ? "HIGH"
      : pilotSampleCoverageBand === "NARROW" || pilotStabilityBand === "UNSTABLE"
        ? "LOW"
        : "MEDIUM";
  const pilotLongTermMaterialImpactBand =
    input.latestEffectiveness === "INEFFECTIVE" || pilotOutcomeCorrelationBand === "AT_RISK"
      ? "HIGH"
      : input.latestEffectiveness === "NO_SIGNAL" || pilotOutcomeCorrelationBand === "WATCH"
        ? "WATCH"
        : "LOW";
  const checkpointKey = `checkpoint::${input.id}`;
  const runThread = buildRunThreadContract({
    id: input.id,
    workspaceId: "workspace_eval",
    sessionKey: `session::${input.id}`,
    status: "ACTIVE",
    currentStage: "continuity_review",
    sourcePage: "/operating",
    boundaryNote: "Operator workflow only. Continuity evaluation does not expand write authority.",
    meetingId: null,
    opportunityId: null,
    companyId: null,
    replayableEventLog:
      input.replayStatus && input.replayStatus !== "NONE"
        ? JSON.stringify([{ at: input.updatedAt, type: "runtime.replay.review" }])
        : "[]",
    resumedFromKey: null,
    createdAt: new Date(input.updatedAt),
    updatedAt: new Date(input.updatedAt),
    closedAt: null,
    checkpoints:
      input.failureTaxonomy === "NO_RECOVERY_ANCHOR"
        ? []
        : [
            {
              id: `${input.id}_checkpoint`,
              checkpointKey,
              label: "continuity_anchor",
              status: "READY",
              summary: "Continuity anchor remains available",
              createdAt: new Date(input.updatedAt),
              updatedAt: new Date(input.updatedAt),
            },
          ],
  });
  const debuggerPersistedLifecycleTraceAnchor: "none" | "human_input" =
    checkpointKey && input.failureTaxonomy !== "NO_RECOVERY_ANCHOR" ? "human_input" : "none";
  const debuggerPersistedLifecycleTrace = {
    state: "backfill_required" as const,
    anchor: debuggerPersistedLifecycleTraceAnchor,
    checkpointId:
      debuggerPersistedLifecycleTraceAnchor === "human_input" ? `${input.id}_checkpoint` : null,
    checkpointKey:
      debuggerPersistedLifecycleTraceAnchor === "human_input" ? checkpointKey : null,
    resumeToken: null,
    resumeState: runThread.resume.state,
    replayRequestMode: runThread.replayRequest.mode,
    humanInputCheckpointState: runThread.humanInputCheckpoint.state,
    persistedLifecycleState: "missing" as const,
    writeSideState: "not_persisted" as const,
    refreshReason: null,
    refreshSource: null,
    compactionState: "backfill_required" as const,
    reconciliationState: "backfill_required" as const,
    checkpointLineageDepth: runThread.checkpointLineage.length,
    replayEventLogEntries: input.replayStatus && input.replayStatus !== "NONE" ? 1 : 0,
    summary:
      debuggerPersistedLifecycleTraceAnchor === "human_input"
        ? `Persisted lifecycle trace still needs its first bounded snapshot for human_input anchor ${checkpointKey}.`
        : "Persisted lifecycle trace still needs its first bounded snapshot before checkpoints can be trusted.",
    nextAction:
      debuggerPersistedLifecycleTraceAnchor === "human_input"
        ? `Backfill the persisted lifecycle trace for ${checkpointKey} before comparing anchors.`
        : "Backfill the persisted lifecycle trace before comparing anchors.",
    boundaryNote: "Read-only debugging only.",
  };

  return {
    id: input.id,
    meetingId: null,
    title: input.title,
    summary: `${input.title} continuity pilot case`,
    runThread,
    interruptReasonState:
      input.recoveryState === "BLOCKED"
        ? "blocked"
        : input.recoveryState === "REVIEW_REQUIRED" || input.recoveryState === "RECOVERABLE"
          ? "attention"
          : "clear",
    interruptReasonCode:
      input.failureTaxonomy === "NO_RECOVERY_ANCHOR"
        ? "no_recovery_anchor"
        : input.failureTaxonomy === "BUDGET_PRESSURE"
          ? "budget_pressure"
          : input.failureTaxonomy === "PAYLOAD_STATE_DRIFT"
            ? "payload_state_drift"
            : input.failureTaxonomy === "REPLAY_DRIFT"
              ? "replay_drift"
              : input.failureTaxonomy === "PROTECTED_STATE_GAP"
                ? "protected_state_gap"
                : "none",
    resumeAskMode:
      input.recoveryState === "BLOCKED"
        ? "rerun_session"
        : runThread.humanInputCheckpoint.state === "checkpoint_ready"
          ? "provide_human_input"
          : input.recoveryState === "REVIEW_REQUIRED"
            ? "review_before_resume"
            : "none",
    handoffPayloadState: "not_available",
    handoffTargetAgent: null,
    debuggerReplayFidelity:
      input.replayStatus === "STRONG"
        ? "strong"
        : input.replayStatus === "WATCH"
          ? "watch"
          : input.replayStatus === "WEAK"
            ? "weak"
            : "none",
    debuggerTraceContractState:
      input.failureTaxonomy === "NO_RECOVERY_ANCHOR"
        ? "backfill_required"
        : runThread.humanInputCheckpoint.state === "checkpoint_ready"
          ? "human_input_ready"
          : input.replayStatus !== "NONE"
            ? "replay_ready"
            : checkpointKey
              ? "checkpoint_ready"
              : "observe",
    debuggerTraceContractDriver:
      input.failureTaxonomy === "NO_RECOVERY_ANCHOR"
        ? "persisted_lifecycle"
        : runThread.humanInputCheckpoint.state === "checkpoint_ready"
          ? "human_input"
          : input.replayStatus !== "NONE"
            ? "replay"
            : checkpointKey
              ? "checkpoint"
              : "observe",
    debuggerTraceContractAnchor:
      checkpointKey && input.failureTaxonomy !== "NO_RECOVERY_ANCHOR"
        ? runThread.humanInputCheckpoint.state === "checkpoint_ready"
          ? "human_input"
          : input.replayStatus !== "NONE"
            ? "replay"
            : "checkpoint"
        : "none",
    debuggerTraceContractCheckpointKey: checkpointKey ?? null,
    debuggerTraceContractSummary:
      input.failureTaxonomy === "NO_RECOVERY_ANCHOR"
        ? "Debugger trace needs the first persisted snapshot before replay, checkpoint, or human input can be reconciled."
        : runThread.humanInputCheckpoint.state === "checkpoint_ready"
          ? `Debugger trace is waiting on human input at ${checkpointKey ?? "the current thread anchor"}.`
          : input.replayStatus !== "NONE"
            ? `Debugger trace keeps replay anchored on ${checkpointKey ?? "the current thread anchor"}.`
            : checkpointKey
              ? `Debugger trace stays on checkpoint ${checkpointKey}.`
              : "Debugger trace stays observable without an active anchor.",
    debuggerWriteContractState: "backfill_required",
    debuggerWriteContractDriver: "persisted_lifecycle",
    debuggerWriteContractAnchor: "none",
    debuggerWriteContractCheckpointKey: null,
    debuggerWriteContractSummary:
      "Debugger write contract has no bounded persisted snapshot yet.",
    debuggerSwarmSpawnContractState: "blocked_flag",
    debuggerSwarmSpawnContractDriver: "workspace_flag",
    debuggerSwarmSpawnContractDenyReason: "workspace_flag_disabled",
    debuggerSwarmSpawnContractSummary:
      "Read-only swarm worker spawn stays blocked until the workspace swarm flag is explicitly enabled.",
    debuggerRecoveryActionContractState: "backfill_required",
    debuggerRecoveryActionContractDriver: "persisted_lifecycle",
    debuggerRecoveryActionContractAction: null,
    debuggerRecoveryActionContractCheckpointKey: null,
    debuggerRecoveryActionContractSummary:
      "Debugger recovery action contract cannot advance until the first bounded persisted snapshot exists.",
    debuggerRecoveryLifecycleContractState: "backfill_required",
    debuggerRecoveryLifecycleContractDriver: "persisted_lifecycle",
    debuggerRecoveryLifecycleContractAnchor: "none",
    debuggerRecoveryLifecycleContractTransition: "backfill_snapshot",
    debuggerRecoveryLifecycleContractSummary:
      "Debugger recovery lifecycle stays at the backfill lane until the first bounded persisted snapshot exists.",
    debuggerRecoveryTransitionContractState: "backfill_required",
    debuggerRecoveryTransitionContractDriver: "persisted_lifecycle",
    debuggerRecoveryTransitionContractAnchor: "none",
    debuggerRecoveryTransitionContractTransition: "backfill_snapshot",
    debuggerRecoveryTransitionContractSummary:
      "Debugger recovery transition stays blocked on snapshot backfill until the first bounded persisted snapshot exists.",
    debuggerRecoveryStateMachinePhase: "materialization",
    debuggerRecoveryStateMachineTransitionState: "required",
    debuggerRecoveryStateMachineCurrentTransition: "backfill_snapshot",
    debuggerRecoveryStateMachineSummary:
      "Recovery state machine stays in the materialization phase until snapshot backfill succeeds.",
    debuggerRecoveryExecutionContractState: "backfill_required",
    debuggerRecoveryExecutionContractTransition: "backfill_snapshot",
    debuggerRecoveryExecutionContractCanExecute: false,
    debuggerRecoveryExecutionContractSummary:
      "Debugger recovery execution is blocked at snapshot backfill until the first persisted snapshot exists.",
    debuggerPersistedLifecycleTraceState: debuggerPersistedLifecycleTrace.state,
    debuggerPersistedLifecycleTraceAnchor: debuggerPersistedLifecycleTrace.anchor,
    debuggerPersistedLifecycleTrace,
    debuggerTakeoverAssistance: {
      posture:
        input.recoveryState === "BLOCKED"
          ? "blocked"
          : runThread.humanInputCheckpoint.state === "checkpoint_ready"
            ? "resume_ready"
            : "review_required",
      recommendedAction:
        runThread.humanInputCheckpoint.state === "checkpoint_ready"
          ? "SAVE_RECOVERY_CHECKPOINT"
          : null,
      summary:
        input.recoveryState === "BLOCKED"
          ? "No trustworthy checkpoint anchor is available yet."
          : runThread.humanInputCheckpoint.state === "checkpoint_ready"
            ? "Restore the bounded checkpoint anchor before operator follow-through continues."
            : "Keep the workflow under explicit operator review.",
      checklist:
        runThread.humanInputCheckpoint.state === "checkpoint_ready"
          ? ["Checkpoint anchor remains available for bounded operator recovery."]
          : ["Keep the workflow review-gated until a bounded checkpoint anchor exists."],
      boundaryNote: "Review-first takeover only.",
    },
    debuggerTakeoverPosture:
      input.recoveryState === "BLOCKED"
        ? "blocked"
        : runThread.humanInputCheckpoint.state === "checkpoint_ready"
          ? "resume_ready"
          : "review_required",
    debuggerTakeoverSummary:
      input.recoveryState === "BLOCKED"
        ? "No trustworthy checkpoint anchor is available yet."
        : runThread.humanInputCheckpoint.state === "checkpoint_ready"
          ? "Restore the bounded checkpoint anchor before operator follow-through continues."
          : "Keep the workflow under explicit operator review.",
    debuggerTakeoverRequestState:
      input.recoveryState === "BLOCKED"
        ? "not_requestable"
        : runThread.humanInputCheckpoint.state === "checkpoint_ready"
          ? "requestable"
          : "not_requestable",
    debuggerTakeoverRequest: {
      state:
        input.recoveryState === "BLOCKED"
          ? "not_requestable"
          : runThread.humanInputCheckpoint.state === "checkpoint_ready"
            ? "requestable"
            : "not_requestable",
      requestEventId: null,
      acknowledgementEventId: null,
      action:
        runThread.humanInputCheckpoint.state === "checkpoint_ready"
          ? "SAVE_RECOVERY_CHECKPOINT"
          : null,
      checkpointId: runThread.latestCheckpoint?.checkpointId ?? null,
      checkpointKey: runThread.latestCheckpoint?.checkpointKey ?? null,
      resumeToken: null,
      requestedAt: null,
      requestedBy: null,
      sourcePage: "/operating",
      acknowledgedAt: null,
      acknowledgedBy: null,
      summary:
        input.recoveryState === "BLOCKED"
          ? "No takeover request can be recorded until a trustworthy checkpoint anchor exists."
          : runThread.humanInputCheckpoint.state === "checkpoint_ready"
            ? `Takeover request can be recorded for ${runThread.latestCheckpoint?.checkpointKey ?? "the current checkpoint"}.`
            : "Takeover request stays unavailable until the workflow becomes checkpoint-ready.",
      boundaryNote: "Request lane only.",
    },
    debuggerTakeoverActivation: {
      state: "inactive",
      startEventId: null,
      releaseEventId: null,
      requestEventId: null,
      acknowledgementEventId: null,
      action: null,
      checkpointId: runThread.latestCheckpoint?.checkpointId ?? null,
      checkpointKey: runThread.latestCheckpoint?.checkpointKey ?? null,
      resumeToken: null,
      currentOwner: null,
      latestEventKind: "none",
      startedAt: null,
      startedBy: null,
      releasedAt: null,
      releasedBy: null,
      releaseReason: null,
      sourcePage: "/operating",
      summary: "Takeover has not started for this continuity pilot thread.",
      boundaryNote: "Activation lane only.",
    },
    debuggerTakeoverActivationState: "inactive",
    debuggerTakeoverFollowThrough: {
      state: "not_requestable",
      requestEventId: null,
      resolutionEventId: null,
      takeoverRequestEventId: null,
      acknowledgementEventId: null,
      startEventId: null,
      releaseEventId: null,
      action: null,
      checkpointId: runThread.latestCheckpoint?.checkpointId ?? null,
      checkpointKey: runThread.latestCheckpoint?.checkpointKey ?? null,
      resumeToken: null,
      currentOwner: null,
      summary: "No takeover follow-through lane is open for this continuity pilot thread.",
      nextAction: null,
      requestedAt: null,
      requestedBy: null,
      resolvedAt: null,
      resolvedBy: null,
      sourcePage: "/operating",
      boundaryNote: "Follow-through stays manual.",
    },
    debuggerTakeoverFollowThroughState: "not_requestable",
    debuggerTakeoverOwner: null,
    debuggerLatestRemediationTrace: null,
    debuggerHumanInputState: runThread.humanInputCheckpoint.state,
    debuggerHumanInputRequestState:
      runThread.humanInputCheckpoint.state === "checkpoint_ready" ? "requestable" : "not_requestable",
    operatorActionSummary: {
      state: "keep_review_gated",
      driver: "steady_state",
      progressState: "review_gated",
      requestTakeoverState: "not_requested",
      requestHumanInputState: "not_requested",
      takeoverActivationState: "inactive",
      operatorControlState: "review_gated",
      closePostureState: runThread.closePostureForwardSummary.state,
      focusTitle: input.title,
      focusHref: "/operating",
      checkpointKey: runThread.closePostureForwardSummary.checkpointKey,
      currentOwner: null,
      summary: "Thread stays review-gated until the operator explicitly advances it.",
      nextAction: "Keep the thread review-gated until the operator explicitly advances it.",
      latestUpdatedAt: new Date(input.updatedAt),
      boundaryNote:
        "Operator action summary stays read-only, review-first, and boundary-first. It compresses the next bounded operator action from request posture, takeover activation, operator control, and close posture without widening authority or creating a workflow engine.",
    },
    operatorProgressSummary: {
      state: "review_gated",
      driver: "steady_state",
      requestTakeoverState: "not_requested",
      requestHumanInputState: "not_requested",
      takeoverActivationState: "inactive",
      operatorControlState: "review_gated",
      closePostureState: runThread.closePostureForwardSummary.state,
      currentOwner: null,
      summary: "Thread stays review-gated until the operator explicitly advances it.",
      nextAction: "Keep the thread review-gated until the operator explicitly advances it.",
      latestUpdatedAt: new Date(input.updatedAt),
      boundaryNote:
        "Operator progress summary stays read-only, review-first, and boundary-first. It does not widen runtime authority or create a workflow engine.",
      counts: {
        activeRequests: 0,
        pendingExecutionWrites: 0,
        openExecutionFollowThrough: 0,
        benchmarkPendingRequests: 0,
        benchmarkFailingGates: 0,
        benchmarkWarningGates: 0,
        forwardAttention: 0,
        openCloseout: 0,
      },
    },
    posture: input.posture ?? "WATCH",
    replayStatus: input.replayStatus ?? "WATCH",
    payloadStateSource: input.payloadStateSource ?? "checkpoint_snapshot",
    riskLevel: input.riskLevel ?? "WATCH",
    riskSummary: `${input.failureTaxonomy} remains inside a watched continuity posture.`,
    recoveryState: input.recoveryState,
    failureTaxonomy: input.failureTaxonomy,
    recoverySummary: `${input.failureTaxonomy} recovery posture is ${input.recoveryState}.`,
    rollbackAnchorLabel: input.failureTaxonomy === "NO_RECOVERY_ANCHOR" ? null : "continuity_anchor · READY",
    checkpointSummary: input.failureTaxonomy === "NO_RECOVERY_ANCHOR" ? null : "WATCH · 82% · continuity anchor remains available",
    pruneSummary: input.posture === "PRUNE" || input.posture === "COMPACT" ? "Selective context pruning saved tokens." : null,
    remediationAttempts: input.remediationAttempts,
    repeatPatternStatus: input.repeatPatternStatus,
    repeatPatternSummary:
      input.repeatPatternStatus === "REPEATED_BLOCKED_ACTION"
        ? "Save recovery checkpoint has been blocked repeatedly."
        : input.repeatPatternStatus === "REPEATED_REVIEW_REQUIRED"
          ? "Continuity remains review-required across repeated remediation attempts."
          : input.repeatPatternStatus === "REPEATED_REPRUNE_LOOP"
            ? "Repeated reprune attempts are keeping the session in non-stable continuity posture."
            : input.repeatPatternStatus === "REPEATED_INEFFECTIVE_ACTION"
              ? "The same bounded remediation has been ineffective across repeated attempts."
              : "No repeated continuity remediation pattern is currently visible.",
    calibrationConfidence: input.calibrationConfidence,
    calibrationSummary: `${input.failureTaxonomy} currently runs under ${input.calibrationConfidence.toLowerCase()}-confidence pilot calibration.`,
    latestEffectiveness: input.latestEffectiveness,
    effectivenessSummary: `${input.latestEffectiveness} is the latest bounded remediation signal for this pilot case.`,
    meetingShape,
    sessionDensityBand:
      input.sessionDensityBand ??
      (input.posture === "COMPACT" ? "HEAVY" : input.posture === "PRUNE" || input.riskLevel === "HIGH" ? "STEADY" : "LIGHT"),
    meetingFrequencyBand:
      input.meetingFrequencyBand ??
      (meetingShape === "RESUMED_MEETING"
        ? "RECURRING"
        : input.repeatPatternStatus !== "NONE"
          ? "HIGH_CADENCE"
          : "SPORADIC"),
    failureHistoryBand:
      input.failureHistoryBand ??
      (input.repeatPatternStatus !== "NONE"
        ? "CHRONIC_REPEAT"
        : input.remediationAttempts >= 1
          ? "REPEATED_FAILURE"
          : "FIRST_SIGNAL"),
    participantRolePosture: input.participantRolePosture ?? "UNKNOWN",
    guidanceStatus,
    guidanceSummary:
      guidanceStatus === "MATCHED_GUIDANCE"
        ? "Current pilot handling matches the intended SOP posture."
        : guidanceStatus === "SKIPPED_GUIDANCE"
          ? "Current pilot handling appears to skip escalation or bounded-remediation guidance."
          : guidanceStatus === "INEFFECTIVE_AFTER_GUIDANCE"
            ? "Current pilot handling followed guidance but still remained ineffective."
            : "Current pilot handling still needs more evidence before it can be classified.",
    pilotConfidenceBand: input.calibrationConfidence,
    pilotRiskBand:
      input.calibrationConfidence === "LOW"
        ? "HIGH"
        : input.calibrationConfidence === "MEDIUM"
          ? "WATCH"
          : "LOW",
    pilotThreshold: input.calibrationConfidence === "LOW" ? 1 : 2,
    pilotSampleCoverageBand,
    pilotStabilityBand,
    pilotStabilityConfidenceBand,
    pilotConfidenceInterval,
    pilotOutcomeCorrelationBand,
    pilotLongTermMaterialImpactBand,
    pilotReviewSummary: `${input.failureTaxonomy} remains inside bounded pilot review.`,
    sopTitle:
      input.failureTaxonomy === "NO_RECOVERY_ANCHOR"
        ? "Recovery-anchor rebuild SOP"
        : input.failureTaxonomy === "PROTECTED_STATE_GAP"
          ? "Protected-field review SOP"
          : input.failureTaxonomy === "REPLAY_DRIFT"
            ? "Replay-fidelity recovery SOP"
            : input.failureTaxonomy === "PAYLOAD_STATE_DRIFT"
              ? "Payload-state review SOP"
              : input.failureTaxonomy === "BUDGET_PRESSURE"
                ? "Budget-pressure remediation SOP"
                : "Stable continuity SOP",
    evidenceSummary: `${input.failureTaxonomy} remains operator-visible and evidence-first.`,
    runbookTitle: "Monitor continuity posture",
    href: "/operating",
    updatedAt: new Date(input.updatedAt),
  };
}

function buildEvalOfficialWriteRuntimeItem(input: {
  contract: ReturnType<typeof buildOfficialWriteIntentContracts>[number];
  ackStatus: "SUCCESS" | "FAILURE" | "DEFERRED";
  receiptStatus:
    | "acknowledged_success"
    | "acknowledged_failure"
    | "timeout_unknown"
    | "stale_receipt"
    | "partial_success"
    | "manual_reconciliation_required";
}): OfficialWriteIntentRuntimeItem {
  const coverage = getRicherOfficialActionCoverageCatalog().find((item) => item.actionType === input.contract.writeActionType);
  if (!coverage) {
    throw new Error(`Unknown official coverage for ${input.contract.writeActionType}`);
  }

  const receiptSummaryWritebackMode =
    input.receiptStatus === "stale_receipt"
      ? "audit_only"
      : input.receiptStatus === "partial_success" || input.receiptStatus === "manual_reconciliation_required"
        ? "reconciliation_note"
        : "audit_only";

  const receiptSummary =
    input.receiptStatus === "acknowledged_success"
      ? "The external system returned an acknowledged success receipt."
      : input.receiptStatus === "timeout_unknown"
      ? "The external receipt is unknown / timed out and still requires manual reconciliation."
      : input.receiptStatus === "stale_receipt"
        ? "The adapter returned a stale receipt. Keep this audit-only until a human resolves the mismatch."
        : input.receiptStatus === "partial_success"
          ? "The external system reported partial success. Manual resolution is still required."
          : input.receiptStatus === "manual_reconciliation_required"
            ? "Manual reconciliation is required before Helm may describe the official outcome."
            : "The external system rejected the write and Helm recorded a failure.";

  const manualFallbackRequired =
    input.ackStatus === "FAILURE" ||
    input.receiptStatus === "timeout_unknown" ||
    input.receiptStatus === "stale_receipt" ||
    input.receiptStatus === "partial_success" ||
    input.receiptStatus === "manual_reconciliation_required";

  return {
    id: `intent_eval_${input.contract.sourceKey}`,
    meetingId: "mtg_eval_followthrough",
    opportunityId: "opp_eval_followthrough",
    companyId: "company_eval_followthrough",
    sourceKey: input.contract.sourceKey,
    officialSystemType: "crm",
    officialObjectRef: input.contract.officialObjectRef,
    sourceType: input.contract.sourceType,
    sourceTitle: input.contract.sourceTitle,
    sourceSummary: input.contract.sourceSummary,
    sourceShadowRef: input.contract.sourceShadowRef,
    sourceExecutionProofRef: input.contract.sourceExecutionProofRef,
    writeActionType: input.contract.writeActionType,
    actionCategory: coverage.category,
    actionRiskClass: coverage.riskClass,
    actionDefaultPath: coverage.defaultPath,
    acknowledgmentRequirement: coverage.acknowledgmentRequirement,
    rollbackExpectation: coverage.rollbackExpectation,
    receiptStatus: input.receiptStatus,
    receiptSummaryWritebackMode,
    receiptSummary,
    manualFallbackRequired,
    escalationRequired: manualFallbackRequired,
    writePayloadDraft: input.contract.writePayloadDraft,
    writeBoundary: input.contract.writeBoundary,
    writeApprovalTier: input.contract.writeApprovalTier,
    writeApprovalStatus: OfficialWriteApprovalStatus.APPROVED,
    writeExecutionStatus:
      input.ackStatus === "SUCCESS"
        ? OfficialWriteExecutionStatus.ACKNOWLEDGED_SUCCESS
        : input.ackStatus === "FAILURE"
          ? OfficialWriteExecutionStatus.ACKNOWLEDGED_FAILURE
          : OfficialWriteExecutionStatus.ATTEMPTED,
    writeAcknowledgementStatus:
      input.ackStatus === "SUCCESS"
        ? OfficialWriteAcknowledgementStatus.SUCCESS
        : input.ackStatus === "FAILURE"
          ? OfficialWriteAcknowledgementStatus.FAILURE
          : OfficialWriteAcknowledgementStatus.DEFERRED,
    approvalRequirements: input.contract.approvalRequirements,
    riskReviewSummary: input.contract.riskReviewSummary ?? null,
    evidenceRefs: input.contract.evidenceRefs,
    sourceProvenance: input.contract.sourceProvenance,
    boundaryTrace: input.contract.boundaryTrace,
    confidence: input.contract.confidence,
    openQuestions: input.contract.openQuestions,
    whatThisChanges: input.contract.whatThisChanges,
    whatThisDoesNotMean: input.contract.whatThisDoesNotMean,
    reviewNotes: null,
    approvedByName: "Eval Owner",
    approvedAt: new Date("2026-04-02T00:00:00.000Z"),
    rejectedByName: null,
    rejectedAt: null,
    attemptedByName: "Eval Operator",
    attemptedAt: new Date("2026-04-02T00:01:00.000Z"),
    acknowledgedByName: "Eval Operator",
    acknowledgedAt: new Date("2026-04-02T00:02:00.000Z"),
    writeAcknowledgementPayload: {
      receiptStatus: input.receiptStatus,
      acknowledgedSuccess: input.ackStatus === "SUCCESS",
    },
    writeFailureReason: input.ackStatus === "FAILURE" ? receiptSummary : null,
    manualReconciliationNote:
      input.receiptStatus === "stale_receipt" ||
      input.receiptStatus === "partial_success" ||
      input.receiptStatus === "manual_reconciliation_required"
        ? receiptSummary
        : null,
    deferredRetryNote: input.receiptStatus === "timeout_unknown" ? "Retry skipped until external receipt becomes trustworthy." : null,
    externalSystemReference: `crm-eval-${input.contract.writeActionType.replace(/\./g, "-")}`,
    writeAuditRef: "audit_eval_official",
  };
}

function buildEvalLimitedAutoRuntimeItem(input: {
  contract: ReturnType<typeof buildLimitedAutoIntentContracts>[number];
}): LimitedAutoIntentRuntimeItem {
  const coverage = getRicherOfficialActionCoverageCatalog().find((item) => item.actionType === input.contract.limitedAutoActionType);
  if (!coverage) {
    throw new Error(`Unknown limited auto coverage for ${input.contract.limitedAutoActionType}`);
  }

  return {
    id: `limited_auto_eval_${input.contract.sourceWriteIntentId}`,
    meetingId: "mtg_eval_followthrough",
    opportunityId: "opp_eval_followthrough",
    companyId: "company_eval_followthrough",
    sourceWriteIntentId: input.contract.sourceWriteIntentId,
    officialSystemType: "crm",
    officialObjectRef: input.contract.officialObjectRef,
    limitedAutoActionType: input.contract.limitedAutoActionType,
    actionCategory: coverage.category,
    actionRiskClass: coverage.riskClass,
    actionDefaultPath: coverage.defaultPath,
    acknowledgmentRequirement: coverage.acknowledgmentRequirement,
    rollbackExpectation: coverage.rollbackExpectation,
    receiptStatus: "manual_reconciliation_required",
    receiptSummaryWritebackMode: "reconciliation_note",
    receiptSummary: "Manual override returned this path to human handling.",
    manualFallbackRequired: true,
    escalationRequired: true,
    limitedAutoEligibilityStatus: input.contract.limitedAutoEligibilityStatus,
    limitedAutoEligibilityReason: input.contract.limitedAutoEligibilityReason,
    limitedAutoApprovalRequired: input.contract.limitedAutoApprovalRequired,
    limitedAutoApprovalStatus: LimitedAutoApprovalStatus.MANUAL_OVERRIDE,
    limitedAutoExecutionStatus: LimitedAutoExecutionStatus.REQUESTED,
    limitedAutoAckStatus: LimitedAutoAcknowledgementStatus.PENDING,
    limitedAutoFailureStatus: LimitedAutoFailureStatus.RETRY_NOT_ATTEMPTED,
    limitedAutoRollbackStatus: LimitedAutoRollbackStatus.MANUAL_NOTE_RECORDED,
    approvalRequirements: input.contract.approvalRequirements,
    proposedWritePayload: input.contract.proposedWritePayload,
    riskReviewSummary: input.contract.riskReviewSummary ?? null,
    evidenceRefs: input.contract.evidenceRefs,
    sourceProvenance: input.contract.sourceProvenance,
    boundaryTrace: input.contract.boundaryTrace,
    confidence: input.contract.confidence,
    openQuestions: input.contract.openQuestions,
    whatAutoPathWillDo: input.contract.whatAutoPathWillDo,
    whatAutoPathWillNotDo: input.contract.whatAutoPathWillNotDo,
    manualOnlyReason: input.contract.manualOnlyReason ?? "Force manual path remains available and was selected for this eval case.",
    reviewNotes: "Force manual path for eval.",
    approvedByName: "Eval Owner",
    approvedAt: new Date("2026-04-02T00:00:00.000Z"),
    rejectedByName: null,
    rejectedAt: null,
    attemptedByName: null,
    attemptedAt: null,
    acknowledgedByName: null,
    acknowledgedAt: null,
    limitedAutoAckPayload: null,
    limitedAutoFailureReason: "Manual override required for this limited auto eval case.",
    manualReconciliationNote: "Manual override keeps the path on human handling.",
    deferredRetryNote: null,
    rollbackNote: "Rollback not attempted in eval manual override path.",
    externalSystemReference: null,
    limitedAutoAuditRef: "audit_eval_limited_auto",
  };
}

function buildFixtureMeetingBase(goldenCase: {
  id: string;
  workspaceSummary: string;
  meeting: MeetingRuntimeGoldenCase["meeting"];
}) {
  return {
    id: `mtg_${goldenCase.id}`,
    workspaceId: "ws_eval",
    companyId: goldenCase.meeting.companyName ? `company_${goldenCase.id}` : null,
    opportunityId: goldenCase.meeting.opportunity ? `opp_${goldenCase.id}` : null,
    title: goldenCase.meeting.title,
    agenda: goldenCase.meeting.agenda ?? null,
    startsAt: new Date(goldenCase.meeting.startsAt),
    endsAt: new Date(goldenCase.meeting.endsAt),
    workspace: {
      id: "ws_eval",
      name: "Helm Eval Workspace",
      description: goldenCase.workspaceSummary,
    },
    company: goldenCase.meeting.companyName
      ? {
          id: `company_${goldenCase.id}`,
          name: goldenCase.meeting.companyName,
        }
      : null,
    opportunity: goldenCase.meeting.opportunity
      ? {
          id: `opp_${goldenCase.id}`,
          title: goldenCase.meeting.opportunity.title,
          type: goldenCase.meeting.opportunity.type,
          stage: goldenCase.meeting.opportunity.stage,
          riskLevel: goldenCase.meeting.opportunity.riskLevel,
          nextAction: goldenCase.meeting.opportunity.nextAction ?? null,
        }
      : null,
    contacts: goldenCase.meeting.contacts.map((name, index) => ({
      id: `contact_${goldenCase.id}_${index}`,
      name,
    })),
    owner: {
      name: goldenCase.meeting.ownerName,
    },
    note: {
      id: `note_${goldenCase.id}`,
      attendeesSummary: null,
      relationshipSummary: null,
      previousConclusion: null,
      meetingGoal: goldenCase.meeting.note.meetingGoal ?? null,
      riskAlerts: goldenCase.meeting.note.riskAlerts ?? null,
      summary: goldenCase.meeting.note.summary ?? null,
      keyDecisions: goldenCase.meeting.note.keyDecisions ?? null,
      confirmations: goldenCase.meeting.note.confirmations ?? null,
      liveTranscript: null,
      recommendedQuestions: null,
    },
  } as const;
}

function buildFixtureMeeting(goldenCase: MeetingRuntimeGoldenCase) {
  return buildFixtureMeetingBase(goldenCase);
}

function buildDraftCommsFixtureMeeting(goldenCase: DraftCommsGoldenCase) {
  const baseMeeting = buildFixtureMeetingBase(goldenCase);

  return {
    ...baseMeeting,
    opportunity: baseMeeting.opportunity
      ? {
          ...baseMeeting.opportunity,
          shadowStage: null,
          shadowNextAction: null,
          shadowRiskLevel: null,
        }
      : null,
  };
}

function buildOpportunityJudgeFixtureMeeting(goldenCase: OpportunityJudgeGoldenCase) {
  const baseMeeting = buildFixtureMeetingBase(goldenCase);

  return {
    ...baseMeeting,
    opportunity: baseMeeting.opportunity
      ? {
          ...baseMeeting.opportunity,
          shadowStage: null,
          shadowNextAction: null,
          shadowRiskLevel: null,
          shadowBlockersSummary: null,
          shadowManagerAttentionFlag: false,
          shadowStageConfidence: null,
          nextStepSummary: null,
        }
      : null,
  };
}

export function runHelmV2MeetingRuntimeEvalHarness(): HelmV2MeetingRuntimeEvalSummary {
  const cases = loadMeetingRuntimeGoldenCases();
  const results: MeetingRuntimeEvalCaseResult[] = [];

  for (const goldenCase of cases) {
    const fixtureMeeting = buildFixtureMeeting(goldenCase);
    const analyst = buildMeetingAnalystArtifacts(fixtureMeeting as never);
    const runtimeContext = buildMeetingRuntimeMemoryContext({
      workspaceSummary: goldenCase.workspaceSummary,
      meetingTitle: fixtureMeeting.title,
      opportunityTitle: fixtureMeeting.opportunity?.title ?? null,
      memoryItems: goldenCase.promotedMemorySummaries.map((summary, index) => ({
        summary,
        status: "PROMOTED",
        verification: "HUMAN_CONFIRMED",
        meetingId: index === 0 ? fixtureMeeting.id : null,
        opportunityId: fixtureMeeting.opportunity?.id ?? null,
        companyId: fixtureMeeting.company?.id ?? null,
      })),
    });
    const delta = fixtureMeeting.opportunity
      ? deriveShadowOpportunityUpdate({
          opportunity: fixtureMeeting.opportunity as never,
          factsArtifact: analyst.factsArtifact,
          riskArtifact: analyst.riskArtifact,
          actionPack: analyst.actionPack,
        })
      : null;
    const evalResult = evaluateSprint2MeetingRuntime({
      meeting: fixtureMeeting as never,
      analyst,
      delta:
        delta ??
        {
          shadowStage: OpportunityStage.CONTACTED,
          shadowRiskLevel: RiskLevel.MEDIUM,
          shadowNextAction: analyst.actionPack.recommendedNextAction,
          shadowBlockersSummary: analyst.factsArtifact.blockers.join("；"),
          shadowManagerAttentionFlag: false,
          shadowStageConfidence: 72,
          managerAttentionReasons: [],
        },
      runtimeContext,
    });

    const supportPool = [
      ...analyst.factsArtifact.facts.map((item) => item.content),
      ...analyst.factsArtifact.decisions,
      ...analyst.factsArtifact.nextActions,
      analyst.actionPack.markdown,
      ...(delta ? [delta.shadowNextAction] : []),
      ...runtimeContext,
    ];
    const failures: string[] = [];

    for (const expected of goldenCase.expected.factsIncludes) {
      if (!includesInAny(supportPool, expected)) {
        failures.push(`missing fact snippet: ${expected}`);
      }
    }

    for (const expected of goldenCase.expected.nextActionIncludes) {
      if (!includesInAny(supportPool, expected)) {
        failures.push(`missing next-action snippet: ${expected}`);
      }
    }

    if (delta && delta.shadowStage !== goldenCase.expected.expectedShadowStage) {
      failures.push(`shadow stage mismatch: ${delta.shadowStage}`);
    }

    if (delta && !includesInAny([delta.shadowNextAction], goldenCase.expected.expectedShadowNextActionIncludes)) {
      failures.push(`shadow next action mismatch: ${delta.shadowNextAction}`);
    }

    for (const expected of goldenCase.expected.expectedContextIncludes) {
      if (!includesInAny(runtimeContext, expected)) {
        failures.push(`runtime context missing: ${expected}`);
      }
    }

    if (goldenCase.expected.promiseBoundaryRequired && !analyst.actionPack.markdown.includes("不会自动外发")) {
      failures.push("action pack boundary note missing");
    }

    if (!evalResult.promiseSafetyPass) {
      failures.push("promise safety eval failed");
    }
    if (!evalResult.memoryRelevancePass) {
      failures.push("memory relevance eval failed");
    }
    if (!evalResult.shadowJudgementPass) {
      failures.push("shadow judgement eval failed");
    }
    if (!evalResult.auditTraceable) {
      failures.push("audit traceability eval failed");
    }

    results.push({
      id: goldenCase.id,
      label: goldenCase.label,
      passed: failures.length === 0,
      failures,
      extractionScore: evalResult.extractionScore,
      promiseSafetyPass: evalResult.promiseSafetyPass,
      memoryRelevancePass: evalResult.memoryRelevancePass,
      shadowJudgementPass: evalResult.shadowJudgementPass,
    });
  }

  const passedCases = results.filter((item) => item.passed).length;

  return {
    totalCases: results.length,
    passedCases,
    passRate: toRate(passedCases, results.length),
    extractionAverage:
      results.length > 0
        ? Math.round((results.reduce((sum, item) => sum + item.extractionScore, 0) / results.length) * 10) / 10
        : 0,
    promiseSafetyRate: toRate(results.filter((item) => item.promiseSafetyPass).length, results.length),
    memoryRelevanceRate: toRate(results.filter((item) => item.memoryRelevancePass).length, results.length),
    shadowJudgementRate: toRate(results.filter((item) => item.shadowJudgementPass).length, results.length),
    auditTraceabilityRate: toRate(
      results.filter((item) => item.failures.every((failure) => failure !== "audit traceability eval failed")).length,
      results.length,
    ),
    cases: results,
  };
}

export function runHelmV2DraftCommsEvalHarness(): HelmV2DraftCommsEvalSummary {
  const cases = loadDraftCommsGoldenCases();
  const results: DraftCommsEvalCaseResult[] = [];
  const bundleConfidences: number[] = [];

  for (const goldenCase of cases) {
    const fixtureMeeting = buildDraftCommsFixtureMeeting(goldenCase);
    const analyst = buildMeetingAnalystArtifacts(fixtureMeeting as never);
    const evidenceRefs = [`meeting:${fixtureMeeting.id}`, `meeting-note:${fixtureMeeting.note.id}`];
    const sourceProvenance = [
      {
        type: "meeting_note",
        id: fixtureMeeting.note.id,
        trust: "TRUSTED",
      },
    ];

    const proposal = buildProposalComposerArtifacts({
      meeting: fixtureMeeting as never,
      meetingFacts: analyst.factsArtifact,
      actionPack: analyst.actionPack,
      riskFlags: analyst.riskArtifact,
      relevantObjectMemory: goldenCase.promotedMemorySummaries,
      evidenceRefs,
      sourceProvenance,
    });
    const comms = buildCommsSchedulerArtifacts({
      meeting: fixtureMeeting as never,
      proposal,
      actionPack: analyst.actionPack,
      evidenceRefs,
      sourceProvenance,
    });
    const guardDraftMarkdown = goldenCase.expected.editedRiskyDraftMarkdown ?? proposal.customerFollowupDraft.markdown;
    const guardMessageMarkdown = goldenCase.expected.editedRiskyDraftMarkdown ?? comms.messageVariants.markdown;
    const guardEmailBody = goldenCase.expected.editedRiskyDraftMarkdown ?? comms.emailDraft.body;
    const guard = evaluateDraftCommsRiskGuard({
      customerDraftMarkdown: guardDraftMarkdown,
      emailDraftBody: guardEmailBody,
      messageVariantsMarkdown: guardMessageMarkdown,
      openQuestions: proposal.openQuestions,
      commitmentWarnings: proposal.customerFollowupDraft.commitmentWarnings,
      sourceProvenance,
      recommendedNextAction: analyst.actionPack.recommendedNextAction,
    });
    const bundle = buildDraftCommsBundle({
      proposal,
      comms,
      guard,
      actionPack: analyst.actionPack,
      evidenceRefs,
      sourceProvenance,
    });
    const evalResult = evaluateSprint3DraftCommsRuntime({
      proposal,
      comms,
      guard,
      bundle,
    });

    const failures: string[] = [];

    for (const expected of goldenCase.expected.customerFollowupIncludes) {
      if (!includesInAny([proposal.customerFollowupDraft.markdown, guardDraftMarkdown, guard.sanitizedArtifact.markdown], expected)) {
        failures.push(`customer follow-up missing: ${expected}`);
      }
    }

    for (const expected of goldenCase.expected.emailIncludes) {
      if (!includesInAny([comms.emailDraft.body, comms.messageVariants.markdown], expected)) {
        failures.push(`email/message missing: ${expected}`);
      }
    }

    for (const expected of goldenCase.expected.execBriefIncludes) {
      if (!includesInAny([proposal.execBrief.markdown, proposal.internalCollabBrief.markdown], expected)) {
        failures.push(`briefing missing: ${expected}`);
      }
    }

    const actualAudienceOrder = [
      proposal.customerFollowupDraft.audience,
      proposal.internalCollabBrief.audience,
      proposal.execBrief.audience,
    ];
    if (JSON.stringify(actualAudienceOrder) !== JSON.stringify(goldenCase.expected.expectedAudienceOrder)) {
      failures.push(`audience order mismatch: ${actualAudienceOrder.join(" -> ")}`);
    }

    if (goldenCase.expected.fallbackRequired && !guard.riskReview.fallbackRequired) {
      failures.push("expected non-commitment fallback but guard did not require it");
    }

    for (const expected of goldenCase.expected.requiredBoundaryNotes) {
      if (!includesInAny(bundle.boundaryNotes, expected) && !includesInAny(proposal.customerFollowupDraft.policyBoundaryNotes, expected)) {
        failures.push(`boundary note missing: ${expected}`);
      }
    }

    if (!proposal.customerFollowupDraft.markdown.includes(DRAFT_ONLY_COMMS_BOUNDARY_NOTE)) {
      failures.push("draft-only boundary note missing");
    }

    if (!evalResult.draftUsefulnessPass) failures.push("draft usefulness eval failed");
    if (!evalResult.promiseSafetyPass) failures.push("promise safety eval failed");
    if (!evalResult.nonCommitmentFallbackPass) failures.push("non-commitment fallback eval failed");
    if (!evalResult.audienceCorrectnessPass) failures.push("audience correctness eval failed");
    if (!evalResult.reviewPathConsistencyPass) failures.push("review path consistency eval failed");

    bundleConfidences.push(bundle.confidence);
    results.push({
      id: goldenCase.id,
      label: goldenCase.label,
      passed: failures.length === 0,
      failures,
      draftUsefulnessPass: evalResult.draftUsefulnessPass,
      promiseSafetyPass: evalResult.promiseSafetyPass,
      nonCommitmentFallbackPass: evalResult.nonCommitmentFallbackPass,
      audienceCorrectnessPass: evalResult.audienceCorrectnessPass,
      reviewPathConsistencyPass: evalResult.reviewPathConsistencyPass,
    });
  }

  const passedCases = results.filter((item) => item.passed).length;

  return {
    totalCases: results.length,
    passedCases,
    passRate: toRate(passedCases, results.length),
    draftUsefulnessRate: toRate(results.filter((item) => item.draftUsefulnessPass).length, results.length),
    promiseSafetyRate: toRate(results.filter((item) => item.promiseSafetyPass).length, results.length),
    nonCommitmentFallbackRate: toRate(results.filter((item) => item.nonCommitmentFallbackPass).length, results.length),
    audienceCorrectnessRate: toRate(results.filter((item) => item.audienceCorrectnessPass).length, results.length),
    reviewPathConsistencyRate: toRate(results.filter((item) => item.reviewPathConsistencyPass).length, results.length),
    averageBundleConfidence: average(bundleConfidences),
    cases: results,
  };
}

export function runHelmV2OpportunityJudgeEvalHarness(): HelmV2OpportunityJudgeEvalSummary {
  const cases = loadOpportunityJudgeGoldenCases();
  const results: OpportunityJudgeEvalCaseResult[] = [];
  const bundleConfidences: number[] = [];

  for (const goldenCase of cases) {
    const fixtureMeeting = buildOpportunityJudgeFixtureMeeting(goldenCase);
    const analyst = buildMeetingAnalystArtifacts(fixtureMeeting as never);
    const evidenceRefs = [`meeting:${fixtureMeeting.id}`, `meeting-note:${fixtureMeeting.note.id}`, `opportunity:${fixtureMeeting.opportunity?.id}`].filter(Boolean) as string[];
    const sourceProvenance = [
      {
        type: "meeting_note",
        id: fixtureMeeting.note.id,
        trust: "TRUSTED",
      },
      ...(fixtureMeeting.opportunity
        ? [
            {
              type: "opportunity",
              id: fixtureMeeting.opportunity.id,
              trust: "SYSTEM_OF_RECORD",
            },
          ]
        : []),
    ];

    const artifacts = buildOpportunityJudgeArtifacts({
      meeting: fixtureMeeting as never,
      meetingFacts: analyst.factsArtifact,
      riskFlags: analyst.riskArtifact,
      actionPack: analyst.actionPack,
      relevantObjectMemory: goldenCase.promotedMemorySummaries,
      historicalTimeline: goldenCase.historicalTimeline,
      evidenceRefs,
      sourceProvenance,
    });
    const evalResult = evaluateSprint4OpportunityJudgeRuntime({
      delta: artifacts.opportunityDelta,
      managerAttention: artifacts.managerAttentionFlags,
      nextStepBrief: artifacts.nextStepBrief,
      bundle: artifacts.bundle,
    });

    const failures: string[] = [];

    if (artifacts.opportunityDelta.stageShadowTo !== goldenCase.expected.expectedShadowStage) {
      failures.push(`shadow stage mismatch: ${artifacts.opportunityDelta.stageShadowTo}`);
    }

    if (
      artifacts.opportunityDelta.blockers.length > 0 &&
      !includesInAny([artifacts.opportunityDelta.blockers[0]?.label], goldenCase.expected.expectedTopBlockerIncludes)
    ) {
      failures.push(`top blocker mismatch: ${artifacts.opportunityDelta.blockers[0]?.label}`);
    }

    for (const expected of goldenCase.expected.expectedNextActionIncludes) {
      if (!includesInAny([artifacts.opportunityDelta.nextBestAction, artifacts.nextStepBrief.markdown], expected)) {
        failures.push(`next best action mismatch: ${expected}`);
      }
    }

    for (const expected of goldenCase.expected.expectedAttentionFlagKeys) {
      if (!artifacts.managerAttentionFlags.flags.some((item) => item.key === expected)) {
        failures.push(`manager attention flag missing: ${expected}`);
      }
    }

    for (const expected of goldenCase.expected.requiredBoundaryNotes) {
      if (
        !includesInAny(artifacts.bundle.boundaryNotes, expected) &&
        !includesInAny(artifacts.nextStepBrief.boundaryNotes, expected) &&
        !includesInAny(artifacts.opportunityDelta.boundaryNotes, expected)
      ) {
        failures.push(`boundary note missing: ${expected}`);
      }
    }

    if (!evalResult.stageJudgementPass) failures.push("stage judgement eval failed");
    if (!evalResult.blockerRankingPass) failures.push("blocker ranking eval failed");
    if (!evalResult.nextBestActionPass) failures.push("next best action eval failed");
    if (!evalResult.managerAttentionPass) failures.push("manager attention eval failed");
    if (!evalResult.shadowBoundaryPass) failures.push("shadow / official boundary eval failed");
    if (!evalResult.evidenceSufficiencyPass) failures.push("evidence sufficiency eval failed");

    bundleConfidences.push(artifacts.bundle.confidence);
    results.push({
      id: goldenCase.id,
      label: goldenCase.label,
      passed: failures.length === 0,
      failures,
      stageJudgementPass: evalResult.stageJudgementPass,
      blockerRankingPass: evalResult.blockerRankingPass,
      nextBestActionPass: evalResult.nextBestActionPass,
      managerAttentionPass: evalResult.managerAttentionPass,
      shadowBoundaryPass: evalResult.shadowBoundaryPass,
      evidenceSufficiencyPass: evalResult.evidenceSufficiencyPass,
    });
  }

  const passedCases = results.filter((item) => item.passed).length;

  return {
    totalCases: results.length,
    passedCases,
    passRate: toRate(passedCases, results.length),
    stageJudgementRate: toRate(results.filter((item) => item.stageJudgementPass).length, results.length),
    blockerRankingRate: toRate(results.filter((item) => item.blockerRankingPass).length, results.length),
    nextBestActionRate: toRate(results.filter((item) => item.nextBestActionPass).length, results.length),
    managerAttentionRate: toRate(results.filter((item) => item.managerAttentionPass).length, results.length),
    shadowBoundaryRate: toRate(results.filter((item) => item.shadowBoundaryPass).length, results.length),
    evidenceSufficiencyRate: toRate(results.filter((item) => item.evidenceSufficiencyPass).length, results.length),
    averageBundleConfidence: average(bundleConfidences),
    cases: results,
  };
}

export function runHelmV2HumanActionExecutionEvalHarness(): HelmV2HumanActionExecutionEvalSummary {
  const cases = loadHumanActionExecutionGoldenCases();
  const results: HumanActionExecutionEvalCaseResult[] = [];

  for (const goldenCase of cases) {
    const fixtureMeeting = buildOpportunityJudgeFixtureMeeting({
      id: goldenCase.id,
      label: goldenCase.label,
      workspaceSummary: goldenCase.workspaceSummary,
      meeting: goldenCase.meeting,
      promotedMemorySummaries: goldenCase.promotedMemorySummaries,
      historicalTimeline: goldenCase.historicalTimeline,
      expected: {
        expectedShadowStage: goldenCase.meeting.opportunity?.stage ?? "CONTACTED",
        expectedTopBlockerIncludes: goldenCase.meeting.note.riskAlerts ?? "",
        expectedNextActionIncludes: goldenCase.meeting.opportunity?.nextAction ? [goldenCase.meeting.opportunity.nextAction] : [],
        expectedAttentionFlagKeys: [],
        requiredBoundaryNotes: [],
      },
    });

    const analyst = buildMeetingAnalystArtifacts(fixtureMeeting as never);
    const evidenceRefs = [`meeting:${fixtureMeeting.id}`, `meeting-note:${fixtureMeeting.note.id}`, `opportunity:${fixtureMeeting.opportunity?.id}`].filter(Boolean) as string[];
    const sourceProvenance = [
      {
        type: "meeting_note",
        id: fixtureMeeting.note.id,
        trust: "TRUSTED",
      },
      ...(fixtureMeeting.opportunity
        ? [
            {
              type: "opportunity",
              id: fixtureMeeting.opportunity.id,
              trust: "SYSTEM_OF_RECORD",
            },
          ]
        : []),
    ];

    const proposal = buildProposalComposerArtifacts({
      meeting: fixtureMeeting as never,
      meetingFacts: analyst.factsArtifact,
      actionPack: analyst.actionPack,
      riskFlags: analyst.riskArtifact,
      relevantObjectMemory: goldenCase.promotedMemorySummaries,
      evidenceRefs,
      sourceProvenance,
    });
    const comms = buildCommsSchedulerArtifacts({
      meeting: fixtureMeeting as never,
      proposal,
      actionPack: analyst.actionPack,
      evidenceRefs,
      sourceProvenance,
    });
    const guard = evaluateDraftCommsRiskGuard({
      customerDraftMarkdown: proposal.customerFollowupDraft.markdown,
      emailDraftBody: comms.emailDraft.body,
      messageVariantsMarkdown: comms.messageVariants.markdown,
      openQuestions: proposal.openQuestions,
      commitmentWarnings: proposal.customerFollowupDraft.commitmentWarnings,
      sourceProvenance,
      recommendedNextAction: analyst.actionPack.recommendedNextAction,
    });
    const draftBundle = buildDraftCommsBundle({
      proposal,
      comms,
      guard,
      actionPack: analyst.actionPack,
      evidenceRefs,
      sourceProvenance,
    });
    const opportunityArtifacts = buildOpportunityJudgeArtifacts({
      meeting: fixtureMeeting as never,
      meetingFacts: analyst.factsArtifact,
      riskFlags: analyst.riskArtifact,
      actionPack: analyst.actionPack,
      relevantObjectMemory: goldenCase.promotedMemorySummaries,
      historicalTimeline: goldenCase.historicalTimeline,
      evidenceRefs,
      sourceProvenance,
    });

    const contracts = buildHumanActionExecutionContracts({
      meetingTitle: fixtureMeeting.title,
      meetingOwnerId: "owner_eval",
      meetingOwnerName: fixtureMeeting.owner.name,
      draftSource: {
        bundle: {
          ...draftBundle,
          reviewStatus: guard.riskReview.fallbackRequired ? "fallback_non_commitment" : "approved_for_manual_handoff",
        },
        bundleId: `draft_bundle_${goldenCase.id}`,
        customerFollowupDraft: proposal.customerFollowupDraft,
        internalCollabBrief: proposal.internalCollabBrief,
        execBrief: proposal.execBrief,
        emailDraft: comms.emailDraft,
        calendarOptions: comms.calendarOptions,
        sanitizedArtifact: guard.sanitizedArtifact,
        riskReview: guard.riskReview,
      },
      opportunitySource: {
        bundle: {
          ...opportunityArtifacts.bundle,
          reviewStatus: "approved_for_shadow_consume",
        },
        bundleId: `opp_bundle_${goldenCase.id}`,
        opportunityDelta: opportunityArtifacts.opportunityDelta,
        nextStepBrief: opportunityArtifacts.nextStepBrief,
        managerAttentionFlags: opportunityArtifacts.managerAttentionFlags,
      },
      handoffSources: (goldenCase.handoffSources ?? []).map((item, index) => ({
        bundleId: `handoff_${goldenCase.id}_${index}`,
        artifactType: item.artifactType,
        title: item.title,
        summary: item.summary,
        targetAudience: item.targetAudience,
        evidenceRefs,
        sourceProvenance,
      })),
    });

    const evalResult = evaluateSprint5HumanActionExecution({
      contracts,
      primaryActionType: goldenCase.expected.primaryActionType,
      acknowledgementMode: goldenCase.expected.acknowledgementMode,
    });

    const failures: string[] = [];

    for (const expectedType of goldenCase.expected.requiredActionTypes) {
      if (!contracts.some((item) => item.actionType === expectedType)) {
        failures.push(`missing action type: ${expectedType}`);
      }
    }

    for (const expectedBoundary of goldenCase.expected.requiredBoundaryNotes) {
      if (!contracts.some((item) => includesInAny(item.boundaryTrace, expectedBoundary) || item.executionBoundary.includes(expectedBoundary))) {
        failures.push(`missing boundary note: ${expectedBoundary}`);
      }
    }

    if (goldenCase.expected.requiresRoleHandoff && !contracts.some((item) => item.executionWritebackTarget.includes("role_handoff_summary"))) {
      failures.push("role handoff write-back target missing");
    }

    if (!evalResult.executionPathConsistencyPass) failures.push("execution path consistency eval failed");
    if (!evalResult.proofWritebackConsistencyPass) failures.push("proof write-back consistency eval failed");
    if (!evalResult.approvalBoundaryConsistencyPass) failures.push("approval / boundary consistency eval failed");
    if (!evalResult.manualAcknowledgementPass) failures.push("manual acknowledgement eval failed");
    if (!evalResult.roleHandoffPass) failures.push("role handoff eval failed");

    results.push({
      id: goldenCase.id,
      label: goldenCase.label,
      passed: failures.length === 0,
      failures,
      executionPathConsistencyPass: evalResult.executionPathConsistencyPass,
      proofWritebackConsistencyPass: evalResult.proofWritebackConsistencyPass,
      approvalBoundaryConsistencyPass: evalResult.approvalBoundaryConsistencyPass,
      manualAcknowledgementPass: evalResult.manualAcknowledgementPass,
      roleHandoffPass: evalResult.roleHandoffPass,
    });
  }

  const passedCases = results.filter((item) => item.passed).length;

  return {
    totalCases: results.length,
    passedCases,
    passRate: toRate(passedCases, results.length),
    executionPathConsistencyRate: toRate(results.filter((item) => item.executionPathConsistencyPass).length, results.length),
    proofWritebackConsistencyRate: toRate(results.filter((item) => item.proofWritebackConsistencyPass).length, results.length),
    approvalBoundaryConsistencyRate: toRate(results.filter((item) => item.approvalBoundaryConsistencyPass).length, results.length),
    manualAcknowledgementRate: toRate(results.filter((item) => item.manualAcknowledgementPass).length, results.length),
    roleHandoffRate: toRate(results.filter((item) => item.roleHandoffPass).length, results.length),
    cases: results,
  };
}

export function runHelmV2OfficialSystemIntegrationEvalHarness(): HelmV2OfficialSystemIntegrationEvalSummary {
  const cases = loadOfficialSystemIntegrationGoldenCases();
  const results: OfficialSystemIntegrationEvalCaseResult[] = [];

  for (const goldenCase of cases) {
    const intents = buildOfficialWriteIntentContracts({
      shadowSource: goldenCase.shadowSource ?? null,
      executionProofSources: goldenCase.executionProofSources ?? [],
    });
    const evalResult = evaluateSprint6OfficialWriteGuard({
      intents,
      requiredActionTypes: goldenCase.expected.requiredActionTypes,
    });

    const failures: string[] = [];

    for (const required of goldenCase.expected.requiredActionTypes) {
      if (!intents.some((item) => item.writeActionType === required)) {
        failures.push(`required action type missing: ${required}`);
      }
    }

    if (!evalResult.writeIntentConsistencyPass) failures.push("write intent consistency eval failed");
    if (!evalResult.approvalMatrixEnforcementPass) failures.push("approval matrix enforcement eval failed");
    if (!evalResult.shadowOfficialSeparationPass) failures.push("shadow / official separation eval failed");
    if (!evalResult.evidenceSufficiencyPass) failures.push("evidence sufficiency before official write eval failed");
    if (!evalResult.acknowledgementFailureCapturePass) failures.push("acknowledgment / failure capture eval failed");
    if (!evalResult.noAutoWriteSafetyPass) failures.push("no-auto-write safety eval failed");

    results.push({
      id: goldenCase.id,
      label: goldenCase.label,
      passed: failures.length === 0,
      failures,
      writeIntentConsistencyPass: evalResult.writeIntentConsistencyPass,
      approvalMatrixEnforcementPass: evalResult.approvalMatrixEnforcementPass,
      shadowOfficialSeparationPass: evalResult.shadowOfficialSeparationPass,
      evidenceSufficiencyPass: evalResult.evidenceSufficiencyPass,
      acknowledgementFailureCapturePass: evalResult.acknowledgementFailureCapturePass,
      noAutoWriteSafetyPass: evalResult.noAutoWriteSafetyPass,
    });
  }

  const passedCases = results.filter((item) => item.passed).length;

  return {
    totalCases: results.length,
    passedCases,
    passRate: toRate(passedCases, results.length),
    writeIntentConsistencyRate: toRate(results.filter((item) => item.writeIntentConsistencyPass).length, results.length),
    approvalMatrixEnforcementRate: toRate(results.filter((item) => item.approvalMatrixEnforcementPass).length, results.length),
    shadowOfficialSeparationRate: toRate(results.filter((item) => item.shadowOfficialSeparationPass).length, results.length),
    evidenceSufficiencyRate: toRate(results.filter((item) => item.evidenceSufficiencyPass).length, results.length),
    acknowledgementFailureCaptureRate: toRate(results.filter((item) => item.acknowledgementFailureCapturePass).length, results.length),
    noAutoWriteSafetyRate: toRate(results.filter((item) => item.noAutoWriteSafetyPass).length, results.length),
    cases: results,
  };
}

export function runHelmV2ConnectorIngestionRetrievalEvalHarness(): HelmV2ConnectorIngestionRetrievalEvalSummary {
  const cases = loadConnectorIngestionRetrievalGoldenCases();
  const results: ConnectorIngestionRetrievalEvalCaseResult[] = [];

  for (const goldenCase of cases) {
    const baseMeeting = buildFixtureMeetingBase(goldenCase);
    const inferredMeetingFacts = goldenCase.meeting.note.riskAlerts ? [goldenCase.meeting.note.riskAlerts] : [];
    const inferredOpportunityNotes = goldenCase.meeting.opportunity?.nextAction ? [goldenCase.meeting.opportunity.nextAction] : [];
    const sources = buildMeetingConnectorSources({
      meeting: {
        ...baseMeeting,
        company: baseMeeting.company
          ? {
              ...baseMeeting.company,
              emailThreads: goldenCase.includeEmailThread
                ? [
                    {
                      id: `thread_${goldenCase.id}`,
                      subject: `${baseMeeting.company.name} follow-up`,
                      summary: "ROI summary and procurement review timing still need a reply.",
                      counterpart: "buyer@example.com",
                      waitingOn: "ROI summary",
                    },
                  ]
                : [],
            }
          : null,
        opportunity: baseMeeting.opportunity
          ? {
              ...baseMeeting.opportunity,
              emailThreads: goldenCase.includeEmailThread
                ? [
                    {
                      id: `opp_thread_${goldenCase.id}`,
                      subject: `${baseMeeting.opportunity.title} follow-up`,
                      summary: "Procurement thread is waiting for a concrete next step.",
                      counterpart: "buyer@example.com",
                      waitingOn: "next step",
                    },
                  ]
                : [],
            }
          : null,
        note: {
          ...baseMeeting.note,
          liveTranscript: goldenCase.includeTranscript
            ? "客户说先把 ROI summary 发过来，再确认 budget 负责人和 procurement 复核。"
            : null,
        },
        memoryEntries: goldenCase.includeHumanEdit
          ? [
              {
                id: `memory_entry_${goldenCase.id}`,
                title: "人工补充：预算负责人可能需要 CFO 参与",
                content: "销售负责人人工补充：budget 负责人仍需要 CFO 明确。",
              },
            ]
          : [],
      } as never,
      inferredMeetingFacts,
      inferredOpportunityNotes,
    });

    const freshMemory = goldenCase.promotedMemorySummaries.map((summary, index) => ({
      id: `fresh_mem_${goldenCase.id}_${index}`,
      summary,
      status: "PROMOTED",
      verification: "HUMAN_CONFIRMED",
      createdAt: new Date("2026-04-01T00:00:00.000Z"),
      lastValidatedAt: new Date("2026-04-01T00:00:00.000Z"),
    }));
    const staleMemory = (goldenCase.staleMemorySummaries ?? []).map((summary, index) => ({
      id: `stale_mem_${goldenCase.id}_${index}`,
      summary,
      status: "PROMOTED",
      verification: "HUMAN_CONFIRMED",
      createdAt: new Date("2025-12-01T00:00:00.000Z"),
      lastValidatedAt: new Date("2025-12-01T00:00:00.000Z"),
    }));

    const traces = buildMeetingRetrievalTraces({
      meeting: {
        ...baseMeeting,
        company: baseMeeting.company
          ? {
              ...baseMeeting.company,
              emailThreads: [],
            }
          : null,
        opportunity: baseMeeting.opportunity
          ? {
              ...baseMeeting.opportunity,
              emailThreads: [],
            }
          : null,
        note: {
          ...baseMeeting.note,
          liveTranscript: goldenCase.includeTranscript
            ? "客户说先把 ROI summary 发过来，再确认 budget 负责人和 procurement 复核。"
            : null,
        },
        memoryEntries: goldenCase.includeHumanEdit
          ? [
              {
                id: `memory_entry_${goldenCase.id}`,
                title: "人工补充：预算负责人可能需要 CFO 参与",
                content: "销售负责人人工补充：budget 负责人仍需要 CFO 明确。",
              },
            ]
          : [],
      } as never,
      runtimeEventId: `runtime_${goldenCase.id}`,
      sources,
      memoryItems: [...freshMemory, ...staleMemory] as never,
      hasDraftCommsRuntime: goldenCase.includeDraftCommsRuntime ?? true,
      hasOfficialWriteRuntime: goldenCase.includeOfficialWriteRuntime ?? false,
    });

    const evalResult = evaluateSprint7IngestionRetrieval({
      sources,
      traces,
      expected: goldenCase.expected,
    });

    const failures: string[] = [];

    for (const key of goldenCase.expected.requiredSkippedKeys) {
      const skippedKeys = traces.flatMap((trace) => trace.skippedRefs.map((item) => item.key));
      if (!skippedKeys.includes(key)) {
        failures.push(`required skipped key missing: ${key}`);
      }
    }

    if (!evalResult.ingestionTrustClassificationPass) failures.push("ingestion trust classification eval failed");
    if (!evalResult.promotionEligibilityPass) failures.push("promotion eligibility eval failed");
    if (!evalResult.retrievalRelevancePass) failures.push("retrieval relevance eval failed");
    if (!evalResult.staleMemorySuppressionPass) failures.push("stale memory suppression eval failed");
    if (!evalResult.policyLoadingCorrectnessPass) failures.push("policy loading correctness eval failed");
    if (!evalResult.objectSummaryLoadingCorrectnessPass) failures.push("object summary loading correctness eval failed");
    if (!evalResult.evidenceProvenanceCompletenessPass) failures.push("evidence provenance completeness eval failed");

    results.push({
      id: goldenCase.id,
      label: goldenCase.label,
      passed: failures.length === 0,
      failures,
      ingestionTrustClassificationPass: evalResult.ingestionTrustClassificationPass,
      promotionEligibilityPass: evalResult.promotionEligibilityPass,
      retrievalRelevancePass: evalResult.retrievalRelevancePass,
      staleMemorySuppressionPass: evalResult.staleMemorySuppressionPass,
      policyLoadingCorrectnessPass: evalResult.policyLoadingCorrectnessPass,
      objectSummaryLoadingCorrectnessPass: evalResult.objectSummaryLoadingCorrectnessPass,
      evidenceProvenanceCompletenessPass: evalResult.evidenceProvenanceCompletenessPass,
    });
  }

  const passedCases = results.filter((item) => item.passed).length;

  return {
    totalCases: results.length,
    passedCases,
    passRate: toRate(passedCases, results.length),
    ingestionTrustClassificationRate: toRate(
      results.filter((item) => item.ingestionTrustClassificationPass).length,
      results.length,
    ),
    promotionEligibilityRate: toRate(results.filter((item) => item.promotionEligibilityPass).length, results.length),
    retrievalRelevanceRate: toRate(results.filter((item) => item.retrievalRelevancePass).length, results.length),
    staleMemorySuppressionRate: toRate(
      results.filter((item) => item.staleMemorySuppressionPass).length,
      results.length,
    ),
    policyLoadingCorrectnessRate: toRate(
      results.filter((item) => item.policyLoadingCorrectnessPass).length,
      results.length,
    ),
    objectSummaryLoadingCorrectnessRate: toRate(
      results.filter((item) => item.objectSummaryLoadingCorrectnessPass).length,
      results.length,
    ),
    evidenceProvenanceCompletenessRate: toRate(
      results.filter((item) => item.evidenceProvenanceCompletenessPass).length,
      results.length,
    ),
    cases: results,
  };
}

export function runHelmV2LimitedAutoPathEvalHarness(): HelmV2LimitedAutoEvalSummary {
  const cases = loadLimitedAutoGoldenCases();
  const results: LimitedAutoEvalCaseResult[] = [];

  for (const goldenCase of cases) {
    const officialIntents = buildOfficialWriteIntentContracts({
      shadowSource: goldenCase.shadowSource ?? null,
      executionProofSources: goldenCase.executionProofSources ?? [],
    });
    const limitedAutoIntents = buildLimitedAutoIntentContracts({
      officialWriteIntents: officialIntents.map((item) => ({
        ...item,
        id: item.sourceKey,
        writeApprovalStatus: OfficialWriteApprovalStatus.APPROVED,
      })),
    });

    const evalResult = evaluateSprint8LimitedAutoPath({
      intents: limitedAutoIntents,
      requiredEligibleActionTypes: goldenCase.expected.requiredEligibleActionTypes,
      requiredManualOnlyActionTypes: goldenCase.expected.requiredManualOnlyActionTypes,
    });

    const failures: string[] = [];

    for (const required of goldenCase.expected.requiredEligibleActionTypes) {
      if (!limitedAutoIntents.some((item) => item.limitedAutoActionType === required && item.limitedAutoEligibilityStatus === "eligible")) {
        failures.push(`required eligible action missing: ${required}`);
      }
    }

    for (const required of goldenCase.expected.requiredManualOnlyActionTypes) {
      if (
        !limitedAutoIntents.some(
          (item) => item.limitedAutoActionType === required && item.limitedAutoEligibilityStatus === "eligible_but_manual_only",
        )
      ) {
        failures.push(`required manual-only action missing: ${required}`);
      }
    }

    if (!evalResult.eligibilityCorrectnessPass) failures.push("limited auto eligibility correctness eval failed");
    if (!evalResult.whitelistEnforcementPass) failures.push("whitelist enforcement eval failed");
    if (!evalResult.noAutoWriteDefaultPass) failures.push("no-auto-write-default eval failed");
    if (!evalResult.acknowledgementBoundaryPass) failures.push("acknowledgement boundary eval failed");
    if (!evalResult.manualOverridePass) failures.push("manual override correctness eval failed");
    if (!evalResult.shadowOfficialProofAckBoundaryPass) failures.push("shadow / official / proof / ack boundary eval failed");

    results.push({
      id: goldenCase.id,
      label: goldenCase.label,
      passed: failures.length === 0,
      failures,
      limitedAutoEligibilityCorrectnessPass: evalResult.eligibilityCorrectnessPass,
      whitelistEnforcementPass: evalResult.whitelistEnforcementPass,
      noAutoWriteDefaultPass: evalResult.noAutoWriteDefaultPass,
      acknowledgementBoundaryPass: evalResult.acknowledgementBoundaryPass,
      manualOverridePass: evalResult.manualOverridePass,
      shadowOfficialProofAckBoundaryPass: evalResult.shadowOfficialProofAckBoundaryPass,
    });
  }

  const passedCases = results.filter((item) => item.passed).length;

  return {
    totalCases: results.length,
    passedCases,
    passRate: toRate(passedCases, results.length),
    limitedAutoEligibilityCorrectnessRate: toRate(
      results.filter((item) => item.limitedAutoEligibilityCorrectnessPass).length,
      results.length,
    ),
    whitelistEnforcementRate: toRate(results.filter((item) => item.whitelistEnforcementPass).length, results.length),
    noAutoWriteDefaultRate: toRate(results.filter((item) => item.noAutoWriteDefaultPass).length, results.length),
    acknowledgementBoundaryRate: toRate(results.filter((item) => item.acknowledgementBoundaryPass).length, results.length),
    manualOverrideRate: toRate(results.filter((item) => item.manualOverridePass).length, results.length),
    shadowOfficialProofAckBoundaryRate: toRate(
      results.filter((item) => item.shadowOfficialProofAckBoundaryPass).length,
      results.length,
    ),
    cases: results,
  };
}

export function runHelmV2RicherOfficialCoverageEvalHarness(): HelmV2RicherOfficialCoverageEvalSummary {
  const cases = loadRicherOfficialCoverageGoldenCases();
  const results: RicherOfficialCoverageEvalCaseResult[] = [];

  for (const goldenCase of cases) {
    const officialIntents = buildOfficialWriteIntentContracts({
      shadowSource: goldenCase.shadowSource ?? null,
      executionProofSources: goldenCase.executionProofSources ?? [],
    });
    const limitedAutoIntents = buildLimitedAutoIntentContracts({
      officialWriteIntents: officialIntents.map((item) => ({
        ...item,
        id: item.sourceKey,
        writeApprovalStatus: OfficialWriteApprovalStatus.APPROVED,
      })),
    });

    const evalResult = evaluateSprint9RicherOfficialCoverage({
      officialIntents,
      limitedAutoIntents,
      requiredEligibleActionTypes: goldenCase.expected.requiredEligibleActionTypes,
      requiredManualOnlyActionTypes: goldenCase.expected.requiredManualOnlyActionTypes,
      requiredBlockedActionTypes: goldenCase.expected.requiredBlockedActionTypes,
    });

    const failures: string[] = [];
    const coverageCatalog = getRicherOfficialActionCoverageCatalog();

    for (const required of goldenCase.expected.requiredEligibleActionTypes) {
      if (!limitedAutoIntents.some((item) => item.limitedAutoActionType === required && item.limitedAutoEligibilityStatus === "eligible")) {
        failures.push(`required richer eligible action missing: ${required}`);
      }
    }

    for (const required of goldenCase.expected.requiredManualOnlyActionTypes) {
      if (
        !limitedAutoIntents.some(
          (item) => item.limitedAutoActionType === required && item.limitedAutoEligibilityStatus === "eligible_but_manual_only",
        )
      ) {
        failures.push(`required richer manual-only action missing: ${required}`);
      }
    }

    for (const required of goldenCase.expected.requiredBlockedActionTypes) {
      const row = coverageCatalog.find((item) => item.actionType === required);
      if (!row || (row.limitedAutoStatus !== "blocked" && row.limitedAutoStatus !== "deferred")) {
        failures.push(`required blocked/deferred action missing: ${required}`);
      }
    }

    const successOutcome = simulateLimitedAutoOutcome({
      actionType: "crm.update_next_action",
      simulatedResult: "ack_success",
    });
    const staleOutcome = simulateLimitedAutoOutcome({
      actionType: "crm.attach_note",
      simulatedResult: "stale_receipt",
    });

    if (successOutcome.receiptStatus !== "acknowledged_success") {
      failures.push("next-action success receipt interpretation failed");
    }
    if (staleOutcome.receiptStatus !== "stale_receipt" || staleOutcome.summaryWritebackMode !== "audit_only") {
      failures.push("stale receipt handling failed");
    }

    if (!evalResult.richerActionCoveragePass) failures.push("richer action coverage eval failed");
    if (!evalResult.richerEligibilityPass) failures.push("richer eligibility eval failed");
    if (!evalResult.richerExecutionPass) failures.push("richer constrained execution eval failed");
    if (!evalResult.receiptInterpretationPass) failures.push("acknowledgment / receipt interpretation eval failed");
    if (!evalResult.reconciliationPathPass) failures.push("reconciliation path correctness eval failed");
    if (!evalResult.manualFallbackPass) failures.push("manual fallback correctness eval failed");
    if (!evalResult.noBroadAutoWritePass) failures.push("no-broad-auto-write eval failed");
    if (!evalResult.separationPass) failures.push("shadow / official / proof / ack separation eval failed");

    results.push({
      id: goldenCase.id,
      label: goldenCase.label,
      passed: failures.length === 0,
      failures,
      richerActionCoveragePass: evalResult.richerActionCoveragePass,
      richerEligibilityPass: evalResult.richerEligibilityPass,
      richerExecutionPass: evalResult.richerExecutionPass,
      acknowledgmentReceiptInterpretationPass: evalResult.receiptInterpretationPass,
      reconciliationPathPass: evalResult.reconciliationPathPass,
      manualFallbackPass: evalResult.manualFallbackPass,
      noBroadAutoWritePass: evalResult.noBroadAutoWritePass,
      separationPass: evalResult.separationPass,
    });
  }

  const passedCases = results.filter((item) => item.passed).length;

  return {
    totalCases: results.length,
    passedCases,
    passRate: toRate(passedCases, results.length),
    richerActionCoverageRate: toRate(results.filter((item) => item.richerActionCoveragePass).length, results.length),
    richerEligibilityRate: toRate(results.filter((item) => item.richerEligibilityPass).length, results.length),
    richerExecutionRate: toRate(results.filter((item) => item.richerExecutionPass).length, results.length),
    acknowledgmentReceiptInterpretationRate: toRate(
      results.filter((item) => item.acknowledgmentReceiptInterpretationPass).length,
      results.length,
    ),
    reconciliationPathRate: toRate(results.filter((item) => item.reconciliationPathPass).length, results.length),
    manualFallbackRate: toRate(results.filter((item) => item.manualFallbackPass).length, results.length),
    noBroadAutoWriteRate: toRate(results.filter((item) => item.noBroadAutoWritePass).length, results.length),
    separationRate: toRate(results.filter((item) => item.separationPass).length, results.length),
    cases: results,
  };
}

export function runHelmV2OfficialFollowThroughEvalHarness(): HelmV2OfficialFollowThroughEvalSummary {
  const cases = loadOfficialFollowThroughGoldenCases();
  const results: OfficialFollowThroughEvalCaseResult[] = [];

  for (const goldenCase of cases) {
    const officialContracts = buildOfficialWriteIntentContracts({
      shadowSource: goldenCase.shadowSource ?? null,
      executionProofSources: goldenCase.executionProofSources ?? [],
    });
    const targetContract = officialContracts.find((item) => item.writeActionType === goldenCase.targetActionType);

    if (!targetContract) {
      results.push({
        id: goldenCase.id,
        label: goldenCase.label,
        passed: false,
        failures: [`missing target official contract: ${goldenCase.targetActionType}`],
        followThroughClassificationPass: false,
        exceptionStateTransitionPass: false,
        reconciliationPathPass: false,
        manualOverrideEscalationPass: false,
        resolutionWritebackPass: false,
        officialSuccessConfusionPass: false,
        noBroadAutoWritePass: false,
      });
      continue;
    }

    let sourceOfficialIntents: OfficialWriteIntentRuntimeItem[] = [];
    let sourceLimitedAutoIntents: LimitedAutoIntentRuntimeItem[] = [];

    if (goldenCase.sourcePath === "limited_auto_manual_override") {
      const limitedAutoContracts = buildLimitedAutoIntentContracts({
        officialWriteIntents: officialContracts.map((item) => ({
          ...item,
          id: `intent_eval_${item.sourceKey}`,
          writeApprovalStatus: OfficialWriteApprovalStatus.APPROVED,
        })),
      });
      const targetLimitedAuto = limitedAutoContracts.find((item) => item.limitedAutoActionType === goldenCase.targetActionType);

      if (!targetLimitedAuto) {
        results.push({
          id: goldenCase.id,
          label: goldenCase.label,
          passed: false,
          failures: [`missing target limited auto contract: ${goldenCase.targetActionType}`],
          followThroughClassificationPass: false,
          exceptionStateTransitionPass: false,
          reconciliationPathPass: false,
          manualOverrideEscalationPass: false,
          resolutionWritebackPass: false,
          officialSuccessConfusionPass: false,
          noBroadAutoWritePass: false,
        });
        continue;
      }

      sourceLimitedAutoIntents = [buildEvalLimitedAutoRuntimeItem({ contract: targetLimitedAuto })];
    } else {
      const receiptStatus =
        goldenCase.outcome === "ack_success"
          ? "acknowledged_success"
          : goldenCase.outcome === "ack_failure"
            ? "acknowledged_failure"
            : goldenCase.outcome === "receipt_unknown"
            ? "timeout_unknown"
            : goldenCase.outcome === "receipt_stale"
              ? "stale_receipt"
              : goldenCase.outcome === "receipt_partial_success"
                ? "partial_success"
                : "manual_reconciliation_required";

      sourceOfficialIntents = [
        buildEvalOfficialWriteRuntimeItem({
          contract: targetContract,
          ackStatus:
            goldenCase.outcome === "ack_success"
              ? "SUCCESS"
              : goldenCase.outcome === "ack_failure"
                ? "FAILURE"
                : "DEFERRED",
          receiptStatus,
        }),
      ];
    }

    const followThroughContracts = buildOfficialFollowThroughContracts({
      officialWriteIntents: sourceOfficialIntents,
      limitedAutoIntents: sourceLimitedAutoIntents,
    });

    const evalResult = evaluateSprint10OfficialFollowThrough({
      followThroughContracts,
      sourceOfficialIntents,
      sourceLimitedAutoIntents,
      requiredFollowThroughTypes: goldenCase.expected.requiredFollowThroughTypes,
      transitionChecks: goldenCase.expected.transitionChecks,
    });

    const failures: string[] = [];

    for (const required of goldenCase.expected.requiredFollowThroughTypes) {
      if (!followThroughContracts.some((item) => item.followThroughType === required)) {
        failures.push(`required follow-through type missing: ${required}`);
      }
    }

    for (const required of goldenCase.expected.requiredWritebackTargets) {
      if (!followThroughContracts.some((item) => item.followThroughWritebackTargets.includes(required))) {
        failures.push(`required write-back target missing: ${required}`);
      }
    }

    if (!evalResult.followThroughClassificationPass) failures.push("follow-through classification eval failed");
    if (!evalResult.exceptionStateTransitionPass) failures.push("exception state transition eval failed");
    if (!evalResult.reconciliationPathPass) failures.push("reconciliation path eval failed");
    if (!evalResult.manualOverrideEscalationPass) failures.push("manual override / escalation eval failed");
    if (!evalResult.resolutionWritebackPass) failures.push("resolution write-back consistency eval failed");
    if (!evalResult.officialSuccessConfusionPass) failures.push("official success vs resolution confusion eval failed");
    if (!evalResult.noBroadAutoWritePass) failures.push("no-broad-auto-write safety eval failed");

    results.push({
      id: goldenCase.id,
      label: goldenCase.label,
      passed: failures.length === 0,
      failures,
      followThroughClassificationPass: evalResult.followThroughClassificationPass,
      exceptionStateTransitionPass: evalResult.exceptionStateTransitionPass,
      reconciliationPathPass: evalResult.reconciliationPathPass,
      manualOverrideEscalationPass: evalResult.manualOverrideEscalationPass,
      resolutionWritebackPass: evalResult.resolutionWritebackPass,
      officialSuccessConfusionPass: evalResult.officialSuccessConfusionPass,
      noBroadAutoWritePass: evalResult.noBroadAutoWritePass,
    });
  }

  const passedCases = results.filter((item) => item.passed).length;

  return {
    totalCases: results.length,
    passedCases,
    passRate: toRate(passedCases, results.length),
    followThroughClassificationRate: toRate(results.filter((item) => item.followThroughClassificationPass).length, results.length),
    exceptionStateTransitionRate: toRate(results.filter((item) => item.exceptionStateTransitionPass).length, results.length),
    reconciliationPathRate: toRate(results.filter((item) => item.reconciliationPathPass).length, results.length),
    manualOverrideEscalationRate: toRate(results.filter((item) => item.manualOverrideEscalationPass).length, results.length),
    resolutionWritebackRate: toRate(results.filter((item) => item.resolutionWritebackPass).length, results.length),
    officialSuccessConfusionRate: toRate(results.filter((item) => item.officialSuccessConfusionPass).length, results.length),
    noBroadAutoWriteRate: toRate(results.filter((item) => item.noBroadAutoWritePass).length, results.length),
    cases: results,
  };
}

function runHelmV21EvalCases() {
  const goldenCases = loadEvalFixture<HelmV21RuntimeGoldenCase[]>("evals/helm-v2/runtime-upgrade-v2_1-golden-samples.json");
  const results: HelmV21RuntimeEvalCaseResult[] = [];

  for (const goldenCase of goldenCases) {
    const payloadContracts = goldenCase.payloads.map((item) =>
      toPersistedPayloadContract({
        payloadKey: item.payloadKey,
        sourceType: item.sourceType,
        sourceId: item.sourceId,
        label: item.label,
        loadPolicy: item.loadPolicy,
        text: item.text,
        loadedByDefault: item.loadedByDefault,
      }),
    );
    const budgetDecision = selectPayloadsForBudget(payloadContracts, goldenCase.tokenBudgetLimit);
    const verification = buildVerificationDecision(goldenCase.verification);
    const problemSpaces = buildProblemSpaceDrafts({
      meetingId: goldenCase.id,
      meetingTitle: goldenCase.label,
      recommendedNextAction: goldenCase.recommendedNextAction,
      blockers: goldenCase.blockers,
      verification,
      ownerHint: "runtime-owner",
      evidenceRefs: goldenCase.verification.facts.flatMap((item) => item.evidence),
      allowOperationalProblemSpaces: verification.status === "passed" && goldenCase.verification.promotedMemoryCount > 0,
    });
    const briefSeed = problemSpaces[0]
      ? {
          title: problemSpaces[0].title,
          summary: problemSpaces[0].summary,
          nextStep: problemSpaces[0].nextStep,
          ownerHint: problemSpaces[0].ownerHint,
          groundingSummary: "Grounded on confirmed or promoted runtime signals. Evidence trace remains operator-visible.",
          truthPosture:
            verification.status === "passed"
              ? "This brief is grounded enough for bounded internal coordination."
              : "This brief stays in deferred posture until the truth boundary is settled.",
          driSummary: "DRI: runtime-owner. Assigned inside the verified coordination slice only.",
        }
      : null;
    const icBrief = briefSeed ? buildEdgeBriefMarkdown({ audience: "IC", ...briefSeed }) : "";
    const driBrief = briefSeed ? buildEdgeBriefMarkdown({ audience: "DRI", ...briefSeed }) : "";
    const playerCoachBrief = briefSeed ? buildEdgeBriefMarkdown({ audience: "PLAYER_COACH", ...briefSeed }) : "";
    const worldModel = buildWorldModelSummary({
      meetingTitle: goldenCase.label,
      workspaceName: "Helm",
      companyName: "Example Customer",
      opportunityTitle: "Expansion",
      confirmedFacts: goldenCase.verification.facts.map((item) => item.content),
      blockers: goldenCase.blockers,
      recommendedNextAction: goldenCase.recommendedNextAction,
      truthScore: verification.truthScore,
    });
    const failureClass = classifyCompositionFailure({
      verificationStatus: verification.status,
      prunedTokenCount: budgetDecision.prunedTokenCount,
    });
    const cacheHealth = buildRuntimeCacheHealth([
      {
        cacheStatus: budgetDecision.prunedHandles.length > 0 ? "partial" : "hit",
        tokensSaved: budgetDecision.prunedTokenCount,
      },
    ]);

    const substratePass = payloadContracts.length === goldenCase.payloads.length;
    const budgetPass =
      budgetDecision.loadedHandles.length >= goldenCase.expected.minLoadedHandles &&
      budgetDecision.prunedHandles.length >= goldenCase.expected.minPrunedHandles;
    const verificationPass =
      verification.status === goldenCase.expected.verificationStatus && verification.truthScore >= goldenCase.expected.minTruthScore;
    const problemSpacePass = goldenCase.expected.problemSpaceTitles.every((title) =>
      problemSpaces.some((item) => includesEvalText(item.title, title)),
    );
    const operationalProblemSpaces = problemSpaces.filter((item) => !includesEvalText(item.title, "Truth boundary review"));
    const edgeBriefPass = goldenCase.expected.edgeBriefIncludes.every((snippet) => includesEvalText(playerCoachBrief, snippet));
    const verifiedPromotionPass =
      verification.status === "passed" ? operationalProblemSpaces.length > 0 : operationalProblemSpaces.length === 0;
    const truthConflictVisiblePass =
      verification.status === "passed"
        ? !problemSpaces.some((item) => includesEvalText(item.title, "Truth boundary review"))
        : problemSpaces.some((item) => includesEvalText(item.title, "Truth boundary review")) && failureClass !== null;
    const confirmedProblemSpacePass =
      goldenCase.expected.problemSpaceTitles.every((title) => problemSpaces.some((item) => includesEvalText(item.title, title))) &&
      (verification.status === "passed"
        ? operationalProblemSpaces.length > 0
        : operationalProblemSpaces.length === 0);
    const sourceConsistentBriefPass = briefSeed
      ? [icBrief, driBrief, playerCoachBrief].every(
          (brief) =>
            includesEvalText(brief, briefSeed.title) &&
            includesEvalText(brief, briefSeed.nextStep) &&
            includesEvalText(brief, "Grounding") &&
            includesEvalText(brief, "DRI"),
        )
      : problemSpaces.length === 0;
    const compositionFailurePass = failureClass === goldenCase.expected.expectedFailureClass;
    const telemetryPass =
      failureClass === goldenCase.expected.expectedFailureClass &&
      includesInAny([worldModel], goldenCase.recommendedNextAction) &&
      cacheHealth.entries === 1;

    const failures: string[] = [];
    if (!substratePass) failures.push("payload externalization count regressed");
    if (!budgetPass) failures.push("budget governor did not preserve the expected load/prune posture");
    if (!verificationPass) failures.push("verification status or truth score regressed");
    if (!problemSpacePass) failures.push("problem-space generation regressed");
    if (!edgeBriefPass) failures.push("edge brief content regressed");
    if (!verifiedPromotionPass) failures.push("verified promotion still allowed weak or conflicted facts to flow into operational follow-through");
    if (!truthConflictVisiblePass) failures.push("truth conflict posture stopped surfacing as an explicit review object");
    if (!confirmedProblemSpacePass) failures.push("problem-space creation no longer stays limited to confirmed or promoted truth");
    if (!sourceConsistentBriefPass) failures.push("IC / DRI / player-coach briefs drifted from the same grounded source");
    if (!compositionFailurePass) failures.push("composition failure classification regressed");
    if (!telemetryPass) failures.push("world model, composition failure, or cache telemetry regressed");

    results.push({
      id: goldenCase.id,
      label: goldenCase.label,
      passed: failures.length === 0,
      failures,
      substratePass,
      budgetPass,
      verificationPass,
      problemSpacePass,
      edgeBriefPass,
      telemetryPass,
      verifiedPromotionPass,
      truthConflictVisiblePass,
      confirmedProblemSpacePass,
      sourceConsistentBriefPass,
      compositionFailurePass,
    });
  }

  return results;
}

export function runHelmV21RuntimeSubstrateEvalHarness(): HelmV21RuntimeSubstrateEvalSummary {
  const results = runHelmV21EvalCases();
  const passedCases = results.filter((item) => item.passed).length;

  return {
    totalCases: results.length,
    passedCases,
    passRate: toRate(passedCases, results.length),
    substrateRate: toRate(results.filter((item) => item.substratePass).length, results.length),
    budgetGovernanceRate: toRate(results.filter((item) => item.budgetPass).length, results.length),
    checkpointFidelityRate: toRate(results.filter((item) => item.telemetryPass).length, results.length),
    cases: results,
  };
}

export function runHelmV21VerificationTruthEvalHarness(): HelmV21VerificationTruthEvalSummary {
  const results = runHelmV21EvalCases();
  const passedCases = results.filter((item) => item.passed).length;

  return {
    totalCases: results.length,
    passedCases,
    passRate: toRate(passedCases, results.length),
    verificationRate: toRate(results.filter((item) => item.verificationPass).length, results.length),
    truthScoreRate: toRate(results.filter((item) => item.verificationPass).length, results.length),
    conflictBoundaryRate: toRate(results.filter((item) => item.telemetryPass).length, results.length),
    cases: results,
  };
}

export function runHelmV21ProblemSpaceEvalHarness(): HelmV21ProblemSpaceEvalSummary {
  const results = runHelmV21EvalCases();
  const passedCases = results.filter((item) => item.passed).length;

  return {
    totalCases: results.length,
    passedCases,
    passRate: toRate(passedCases, results.length),
    worldModelRate: toRate(results.filter((item) => item.telemetryPass).length, results.length),
    problemSpaceRate: toRate(results.filter((item) => item.problemSpacePass).length, results.length),
    edgeBriefRate: toRate(results.filter((item) => item.edgeBriefPass).length, results.length),
    compositionFailureRate: toRate(results.filter((item) => item.telemetryPass).length, results.length),
    cases: results,
  };
}

export function runHelmV21OperatorSurfaceEvalHarness(): HelmV21OperatorSurfaceEvalSummary {
  const results = runHelmV21EvalCases();
  const passedCases = results.filter((item) => item.passed).length;

  return {
    totalCases: results.length,
    passedCases,
    passRate: toRate(passedCases, results.length),
    traceSurfaceRate: toRate(results.filter((item) => item.budgetPass).length, results.length),
    playerCoachBriefRate: toRate(results.filter((item) => item.edgeBriefPass).length, results.length),
    cacheHealthRate: toRate(results.filter((item) => item.telemetryPass).length, results.length),
    consolidationBoundaryRate: toRate(results.filter((item) => item.edgeBriefPass).length, results.length),
    cases: results,
  };
}

export function runHelmV21VerifiedCoordinationEvalHarness(): HelmV21VerifiedCoordinationEvalSummary {
  const results = runHelmV21EvalCases();
  const passedCases = results.filter((item) => item.passed).length;

  return {
    totalCases: results.length,
    passedCases,
    passRate: toRate(passedCases, results.length),
    verifiedPromotionRate: toRate(results.filter((item) => item.verifiedPromotionPass).length, results.length),
    truthConflictVisibilityRate: toRate(results.filter((item) => item.truthConflictVisiblePass).length, results.length),
    confirmedProblemSpaceRate: toRate(results.filter((item) => item.confirmedProblemSpacePass).length, results.length),
    sourceConsistentBriefRate: toRate(results.filter((item) => item.sourceConsistentBriefPass).length, results.length),
    compositionFailureRate: toRate(results.filter((item) => item.compositionFailurePass).length, results.length),
    cases: results,
  };
}

export function runHelmV21BudgetedSessionContinuityEvalHarness(): HelmV21BudgetedSessionContinuityEvalSummary {
  const goldenCases = loadBudgetedSessionContinuityGoldenCases();
  const results: HelmV21BudgetedSessionContinuityEvalCaseResult[] = [];

  for (const goldenCase of goldenCases) {
    const payloadContracts = goldenCase.payloads.map((item) =>
      toPersistedPayloadContract({
        payloadKey: item.payloadKey,
        sourceType: item.sourceType,
        sourceId: item.sourceId,
        label: item.label,
        loadPolicy: item.loadPolicy,
        text: item.text,
        loadedByDefault: item.loadedByDefault,
      }),
    );
    const budgetDecision = selectPayloadsForBudget(payloadContracts, goldenCase.tokenBudgetLimit);
    const budgetPosture = buildBudgetPosture({
      budgetTokenLimit: goldenCase.tokenBudgetLimit,
      budgetTokenUsed: budgetDecision.tokenBudgetUsed,
      prunedTokenCount: budgetDecision.prunedTokenCount,
      latestCheckpointStatus: goldenCase.latestCheckpointStatus,
      resumedFromKey: goldenCase.resumedFromKey,
    });
    const notebookState = buildRuntimeNotebookState(goldenCase.continuitySource);
    const savedSnapshot =
      goldenCase.savedSnapshot ??
      buildContinuitySnapshot({
        ...goldenCase.continuitySource,
        budgetPosture,
        loadedHandles: budgetDecision.loadedHandles,
        prunedHandles: budgetDecision.prunedHandles,
      });
    const payloadState = buildRuntimePayloadHandleState({
      persistedHandles: payloadContracts.map((item) => item.handle),
      latestCheckpoint: {
        snapshotJson: JSON.stringify({ continuityState: savedSnapshot }),
        updatedAt: new Date("2026-04-03T00:00:00.000Z"),
      },
      edits:
        (goldenCase.pruneEdit?.removedHandles ?? budgetDecision.prunedHandles).length > 0
          ? [
              {
                removedHandles: JSON.stringify(goldenCase.pruneEdit?.removedHandles ?? budgetDecision.prunedHandles),
                createdAt: new Date("2026-04-03T00:01:00.000Z"),
              },
            ]
          : [],
    });
    const replay = buildResumeFidelity({
      checkpointId: `${goldenCase.id}:checkpoint`,
      checkpointLabel: "meeting_review",
      checkpointStatus: goldenCase.latestCheckpointStatus ?? "READY",
      updatedAt: new Date("2026-04-03T00:00:00.000Z"),
      savedState: parseContinuitySnapshot(JSON.stringify({ continuityState: savedSnapshot })),
      liveState: goldenCase.liveStateOverride ?? notebookState,
      livePayloadState: {
        activeHandles: payloadState.activeHandles,
        prunedHandles: payloadState.prunedHandles,
        budgetState: budgetPosture.state,
      },
    });
    const pruneTrace = buildPruneTraceEntries({
      edits: [
        {
          id: `${goldenCase.id}:edit`,
          strategy: goldenCase.pruneEdit?.strategy ?? "token_budget_governor",
          beforeTokenCount:
            goldenCase.pruneEdit?.beforeTokenCount ??
            payloadContracts.reduce((sum, item) => sum + item.estimatedTokens, 0),
          afterTokenCount: goldenCase.pruneEdit?.afterTokenCount ?? budgetDecision.tokenBudgetUsed,
          removedHandles: JSON.stringify(goldenCase.pruneEdit?.removedHandles ?? budgetDecision.prunedHandles),
          removedSummary:
            goldenCase.pruneEdit?.removedSummary ??
            "Bulky context was replaced by persisted handles with preview and summary.",
          createdAt: new Date("2026-04-03T00:00:00.000Z"),
        },
      ],
      payloads: payloadContracts.map((item) => ({
        handle: item.handle,
        label: item.label,
        summary: item.summary,
        estimatedTokens: item.estimatedTokens,
        sourceType: item.sourceType,
      })),
      notebookState,
      budgetPosture,
    });
    const prunedLabels = payloadContracts
      .filter((item) => budgetDecision.prunedHandles.includes(item.handle))
      .map((item) => item.label);
    const notebookJoined = [
      notebookState.objective,
      ...notebookState.relevantObjects,
      ...notebookState.confirmedFacts,
      ...notebookState.blockers,
      ...notebookState.decisions,
      ...notebookState.nextActions,
      ...notebookState.openQuestions,
      notebookState.reviewState,
    ].join(" ");
    const payloadExternalizationPass = goldenCase.expected.requiredExternalizedLabels.every((label) =>
      prunedLabels.some((item) => includesEvalText(item, label)),
    );
    const notebookStatePass = goldenCase.expected.notebookIncludes.every((snippet) => includesEvalText(notebookJoined, snippet));
    const checkpointResumePass =
      replay?.fidelityStatus === goldenCase.expected.replayFidelity &&
      (goldenCase.expected.replayMissing ?? []).every((item) => replay?.missing.includes(item));
    const pruneSafetyPass =
      pruneTrace[0] !== undefined &&
      pruneTrace[0].tokensSaved >= goldenCase.expected.minTokensSaved &&
      goldenCase.expected.protectedItems.every((item) =>
        pruneTrace[0]?.protectedItems.some((protectedItem) => includesEvalText(protectedItem, item)),
      );
    const budgetPosturePass = budgetPosture.state === goldenCase.expected.budgetState;

    const failures: string[] = [];
    if (!payloadExternalizationPass) failures.push("large payloads stopped externalizing behind handles");
    if (!notebookStatePass) failures.push("notebook no longer carries the required operational state");
    if (!checkpointResumePass) failures.push("checkpoint replay or resume fidelity regressed");
    if (!pruneSafetyPass) failures.push("prune trace stopped protecting critical blocker/owner/due-date/boundary state");
    if (!budgetPosturePass) failures.push("budget posture visibility or thresholding regressed");

    results.push({
      id: goldenCase.id,
      label: goldenCase.label,
      passed: failures.length === 0,
      failures,
      payloadExternalizationPass,
      notebookStatePass,
      checkpointResumePass,
      pruneSafetyPass,
      budgetPosturePass,
    });
  }

  const passedCases = results.filter((item) => item.passed).length;

  return {
    totalCases: results.length,
    passedCases,
    passRate: toRate(passedCases, results.length),
    payloadExternalizationRate: toRate(results.filter((item) => item.payloadExternalizationPass).length, results.length),
    notebookStateRate: toRate(results.filter((item) => item.notebookStatePass).length, results.length),
    checkpointResumeRate: toRate(results.filter((item) => item.checkpointResumePass).length, results.length),
    pruneSafetyRate: toRate(results.filter((item) => item.pruneSafetyPass).length, results.length),
    budgetPostureRate: toRate(results.filter((item) => item.budgetPosturePass).length, results.length),
    cases: results,
  };
}

export function runHelmV22CoordinationTraceEvalHarness(): HelmV22CoordinationTraceEvalSummary {
  const goldenCases = loadCoordinationTraceGoldenCases();
  const results: HelmV22CoordinationTraceEvalCaseResult[] = [];

  for (const goldenCase of goldenCases) {
    const trace = buildCoordinationTraceBridge({
      problemSpaces: goldenCase.problemSpaces.map((item) => ({
        ...item,
        updatedAt: new Date(item.updatedAt),
      })),
      humanExecutions: goldenCase.humanExecutions.map((item) => ({
        ...item,
        status: item.status.toUpperCase(),
        executedAt: item.executedAt ? new Date(item.executedAt) : null,
        updatedAt: new Date(item.updatedAt),
      })),
      officialFollowThrough: goldenCase.officialFollowThrough.map((item) => ({
        ...item,
        followThroughStatus: item.followThroughStatus.toUpperCase(),
        followThroughResolutionStatus: item.followThroughResolutionStatus.toUpperCase(),
        updatedAt: new Date(item.updatedAt),
      })),
    });

    const firstItem = trace.items[0];
    const posturePass = firstItem?.posture === goldenCase.expected.posture;
    const summaryPass =
      Boolean(firstItem) &&
      goldenCase.expected.summaryIncludes.every((snippet) => includesEvalText(firstItem?.summary ?? "", snippet));
    const linkagePass =
      Boolean(firstItem) &&
      goldenCase.expected.linkageIncludes.every((snippet) => includesEvalText(firstItem?.linkageSummary ?? "", snippet));
    const boundaryPass =
      includesEvalText(trace.boundaryNote, "does not auto-execute") &&
      includesEvalText(trace.boundaryNote, "does not broaden official write authority");
    const humanExecutionVisibilityPass =
      !goldenCase.expected.humanExecutionSummaryIncludes?.length ||
      goldenCase.expected.humanExecutionSummaryIncludes.every((snippet) =>
        includesEvalText(firstItem?.humanExecutionSummary ?? "", snippet),
      );
    const officialFollowThroughVisibilityPass =
      !goldenCase.expected.officialFollowThroughSummaryIncludes?.length ||
      goldenCase.expected.officialFollowThroughSummaryIncludes.every((snippet) =>
        includesEvalText(firstItem?.officialFollowThroughSummary ?? "", snippet),
      );

    const failures: string[] = [];
    if (!posturePass) failures.push("coordination trace posture regressed");
    if (!summaryPass) failures.push("coordination trace summary regressed");
    if (!linkagePass) failures.push("coordination trace linkage wording regressed");
    if (!boundaryPass) failures.push("coordination trace boundary wording regressed");
    if (!humanExecutionVisibilityPass) failures.push("human execution trace visibility regressed");
    if (!officialFollowThroughVisibilityPass) failures.push("official follow-through trace visibility regressed");

    results.push({
      id: goldenCase.id,
      label: goldenCase.label,
      passed: failures.length === 0,
      failures,
      posturePass,
      summaryPass,
      linkagePass,
      boundaryPass,
      humanExecutionVisibilityPass,
      officialFollowThroughVisibilityPass,
    });
  }

  const passedCases = results.filter((item) => item.passed).length;

  return {
    totalCases: results.length,
    passedCases,
    passRate: toRate(passedCases, results.length),
    postureRate: toRate(results.filter((item) => item.posturePass).length, results.length),
    summaryRate: toRate(results.filter((item) => item.summaryPass).length, results.length),
    linkageRate: toRate(results.filter((item) => item.linkagePass).length, results.length),
    boundaryRate: toRate(results.filter((item) => item.boundaryPass).length, results.length),
    humanExecutionVisibilityRate: toRate(results.filter((item) => item.humanExecutionVisibilityPass).length, results.length),
    officialFollowThroughVisibilityRate: toRate(
      results.filter((item) => item.officialFollowThroughVisibilityPass).length,
      results.length,
    ),
    cases: results,
  };
}

export function runHelmV22ContinuityObservabilityEvalHarness(): HelmV22ContinuityObservabilityEvalSummary {
  const cases = loadContinuityObservabilityGoldenCases();

  const results: HelmV22ContinuityObservabilityEvalCaseResult[] = [];

  for (const testCase of cases) {
    const replayStatus = classifyReplayFidelityStatus({
      fidelityScore: testCase.replayCalibration.fidelityScore,
      missing: testCase.replayCalibration.missing,
    });
    const replayStatusPass = replayStatus === testCase.replayCalibration.expectedStatus;

    const payloadSourceRisk = classifyPayloadStateSourceRisk(testCase.payloadStateCalibration.source);
    const payloadSourceRiskPass = payloadSourceRisk.riskWeight === testCase.payloadStateCalibration.expectedRiskWeight;

    const risk = buildRuntimeContinuityRisk({
      budgetPosture: testCase.riskInput.budgetPosture,
      replayStatus,
      payloadStateSource: testCase.payloadStateCalibration.source,
      hasPruneTrace: testCase.riskInput.hasPruneTrace,
    });
    const riskLevelPass = risk.level === testCase.expected.level;
    const riskSummaryPass = testCase.expected.summaryIncludes.every((snippet) =>
      includesEvalText(risk.summary, snippet),
    );
    const operatorActionPass = testCase.expected.actionIncludes.every((snippet) =>
      includesEvalText(risk.operatorAction, snippet),
    );

    const failures: string[] = [];
    if (!replayStatusPass) failures.push("replay status calibration regressed");
    if (!payloadSourceRiskPass) failures.push("payload source risk calibration regressed");
    if (!riskLevelPass) failures.push("continuity risk level regressed");
    if (!riskSummaryPass) failures.push("continuity risk summary regressed");
    if (!operatorActionPass) failures.push("continuity operator action guidance regressed");

    results.push({
      id: testCase.id,
      label: testCase.label,
      passed: failures.length === 0,
      failures,
      replayStatusPass,
      payloadSourceRiskPass,
      riskLevelPass,
      riskSummaryPass,
      operatorActionPass,
    });
  }

  const passedCases = results.filter((item) => item.passed).length;

  return {
    totalCases: results.length,
    passedCases,
    passRate: toRate(passedCases, results.length),
    replayStatusRate: toRate(results.filter((item) => item.replayStatusPass).length, results.length),
    payloadSourceRiskRate: toRate(results.filter((item) => item.payloadSourceRiskPass).length, results.length),
    riskLevelRate: toRate(results.filter((item) => item.riskLevelPass).length, results.length),
    riskSummaryRate: toRate(results.filter((item) => item.riskSummaryPass).length, results.length),
    operatorActionRate: toRate(results.filter((item) => item.operatorActionPass).length, results.length),
    cases: results,
  };
}

export function runHelmV22ContinuityRecoveryEvalHarness(): HelmV22ContinuityRecoveryEvalSummary {
  const cases = loadContinuityRecoveryGoldenCases();
  const results: HelmV22ContinuityRecoveryEvalCaseResult[] = [];

  for (const testCase of cases) {
    const budgetPosture = buildBudgetPosture(testCase.budgetPostureInput);
    const recovery = buildRuntimeContinuityRecovery({
      budgetPosture,
      replay: testCase.replay
        ? {
            checkpointId: testCase.substrate.latestCheckpoint?.id ?? "checkpoint_eval",
            checkpointLabel: testCase.substrate.latestCheckpoint?.label ?? "Checkpoint eval",
            replaySummary: "eval replay summary",
            fidelityStatus: testCase.replay.fidelityStatus,
            fidelityScore: testCase.replay.fidelityScore,
            preserved: [],
            missing: testCase.replay.missing,
            updatedAt: new Date("2026-04-04T00:00:00.000Z"),
          }
        : null,
      payloadState: {
        activeHandles: [],
        prunedHandles: [],
        stateSource: testCase.payloadState.source,
        stateSummary: "eval payload state",
      },
      latestCheckpoint: testCase.substrate.latestCheckpoint,
      persistedPayloadCount: testCase.substrate.persistedPayloadCount,
      pruneTraceCount: testCase.substrate.pruneTraceCount,
    });

    const recoveryStatePass = recovery.state === testCase.expected.recoveryState;
    const taxonomyPass = recovery.failureTaxonomy === testCase.expected.failureTaxonomy;
    const allowedActionsPass =
      JSON.stringify(recovery.allowedActions) === JSON.stringify(testCase.expected.allowedActions);
    const rollbackAnchorPass = testCase.expected.rollbackAnchorRequired
      ? Boolean(recovery.rollbackAnchor)
      : !recovery.rollbackAnchor;
    const summaryPass = testCase.expected.summaryIncludes.every((snippet) =>
      includesEvalText(recovery.summary, snippet),
    );
    const operatorActionPass = testCase.expected.actionIncludes.every((snippet) =>
      includesEvalText(recovery.operatorAction, snippet),
    );

    const failures: string[] = [];
    if (!recoveryStatePass) failures.push("recovery state regressed");
    if (!taxonomyPass) failures.push("failure taxonomy regressed");
    if (!allowedActionsPass) failures.push("allowed remediation actions regressed");
    if (!rollbackAnchorPass) failures.push("rollback anchor posture regressed");
    if (!summaryPass) failures.push("recovery summary wording regressed");
    if (!operatorActionPass) failures.push("recovery operator action wording regressed");

    results.push({
      id: testCase.id,
      label: testCase.label,
      passed: failures.length === 0,
      failures,
      recoveryStatePass,
      taxonomyPass,
      allowedActionsPass,
      rollbackAnchorPass,
      summaryPass,
      operatorActionPass,
    });
  }

  const passedCases = results.filter((item) => item.passed).length;

  return {
    totalCases: results.length,
    passedCases,
    passRate: toRate(passedCases, results.length),
    recoveryStateRate: toRate(results.filter((item) => item.recoveryStatePass).length, results.length),
    taxonomyRate: toRate(results.filter((item) => item.taxonomyPass).length, results.length),
    allowedActionsRate: toRate(results.filter((item) => item.allowedActionsPass).length, results.length),
    rollbackAnchorRate: toRate(results.filter((item) => item.rollbackAnchorPass).length, results.length),
    summaryRate: toRate(results.filter((item) => item.summaryPass).length, results.length),
    operatorActionRate: toRate(results.filter((item) => item.operatorActionPass).length, results.length),
    cases: results,
  };
}

export function runHelmV22ContinuityRemediationAnalyticsEvalHarness(): HelmV22ContinuityRemediationAnalyticsEvalSummary {
  const cases = loadContinuityRemediationAnalyticsGoldenCases();
  const results: HelmV22ContinuityRemediationAnalyticsEvalCaseResult[] = [];

  for (const testCase of cases) {
    const budgetPosture = buildBudgetPosture(testCase.budgetPostureInput);
    const recovery = buildRuntimeContinuityRecovery({
      budgetPosture,
      replay: testCase.replay
        ? {
            checkpointId: testCase.substrate.latestCheckpoint?.id ?? "checkpoint_eval",
            checkpointLabel: testCase.substrate.latestCheckpoint?.label ?? "checkpoint_eval",
            replaySummary: "eval replay summary",
            fidelityStatus: testCase.replay.fidelityStatus,
            fidelityScore: testCase.replay.fidelityScore,
            preserved: [],
            missing: testCase.replay.missing,
            updatedAt: new Date("2026-04-04T00:00:00.000Z"),
          }
        : null,
      payloadState: {
        activeHandles: [],
        prunedHandles: [],
        stateSource: testCase.payloadState.source,
        stateSummary: testCase.payloadState.stateSummary,
      },
      latestCheckpoint: testCase.substrate.latestCheckpoint,
      persistedPayloadCount: testCase.substrate.persistedPayloadCount,
      pruneTraceCount: testCase.substrate.pruneTraceCount,
    });
    const notebookState = buildRuntimeNotebookState({
      sessionLabel: `Eval session ${testCase.id}`,
      sessionStatus: "ACTIVE",
      boundaryNote: "No auto-send.",
      notebook: {
        sessionSummary: testCase.notebook.sessionSummary,
        decisionSummary: testCase.notebook.decisionSummary,
        blockerSummary: testCase.notebook.blockerSummary,
        pendingQuestions: JSON.stringify(testCase.notebook.pendingQuestions),
        openLoopSummary: testCase.notebook.openLoopSummary,
        boundaryNote: "No auto-send.",
      },
      verification: null,
      problemSpaces: [],
      promotedFacts: testCase.notebook.evidenceRefs.length
        ? [
            {
              summary: "Confirmed continuity evidence remains reviewable.",
              evidenceRefs: testCase.notebook.evidenceRefs,
            },
          ]
        : [],
      truthConflicts: [],
    });
    const pruneTrace = (testCase.pruneTrace ?? []).map((item) => ({
      id: item.id,
      strategy: "eval_prune_trace",
      posture: item.posture,
      reason: item.reason,
      beforeTokenCount: 100,
      afterTokenCount: Math.max(0, 100 - item.tokensSaved),
      tokensSaved: item.tokensSaved,
      replacementSummary: "Removed payloads were replaced by handle + preview + summary.",
      protectedItems: ["No auto-send."],
      removedPayloads: [],
      createdAt: new Date("2026-04-04T00:00:00.000Z"),
    }));
    const remediationTrace = testCase.remediationTrace.map((item, index) => ({
      id: `${testCase.id}_${index}`,
      action: item.action,
      executionStatus: item.executionStatus,
      summary: item.summary,
      beforeSummary: item.beforeSummary,
      afterSummary: item.afterSummary,
      beforeRiskLevel: item.beforeRiskLevel,
      afterRiskLevel: item.afterRiskLevel,
      beforeRecoveryState: item.beforeRecoveryState,
      afterRecoveryState: item.afterRecoveryState,
      beforeFailureTaxonomy: item.beforeFailureTaxonomy,
      afterFailureTaxonomy: item.afterFailureTaxonomy,
      rollbackAnchorSummary: item.rollbackAnchorSummary,
      triggeredBy: "eval-harness",
      createdAt: new Date(item.createdAt),
    }));

    const analytics = buildRuntimeRemediationAnalytics(remediationTrace);
    const effectiveness = buildRuntimeRemediationEffectiveness(remediationTrace);
    const risk = buildRuntimeContinuityRisk({
      budgetPosture: budgetPosture.state,
      replayStatus: testCase.replay?.fidelityStatus ?? null,
      payloadStateSource: testCase.payloadState.source,
      hasPruneTrace: pruneTrace.length > 0,
    });
    const calibration = buildRuntimeContinuityCalibration({
      recovery,
      replay: testCase.replay
        ? {
            checkpointId: testCase.substrate.latestCheckpoint?.id ?? "checkpoint_eval",
            checkpointLabel: testCase.substrate.latestCheckpoint?.label ?? "checkpoint_eval",
            replaySummary: "eval replay summary",
            fidelityStatus: testCase.replay.fidelityStatus,
            fidelityScore: testCase.replay.fidelityScore,
            preserved: [],
            missing: testCase.replay.missing,
            updatedAt: new Date("2026-04-04T00:00:00.000Z"),
          }
        : null,
      payloadState: {
        activeHandles: [],
        prunedHandles: [],
        stateSource: testCase.payloadState.source,
        stateSummary: testCase.payloadState.stateSummary,
      },
      risk,
      analytics,
      effectiveness,
    });
    const evidence = buildRuntimeContinuityEvidenceSurface({
      replay: testCase.replay
        ? {
            checkpointId: testCase.substrate.latestCheckpoint?.id ?? "checkpoint_eval",
            checkpointLabel: testCase.substrate.latestCheckpoint?.label ?? "checkpoint_eval",
            replaySummary: "eval replay summary",
            fidelityStatus: testCase.replay.fidelityStatus,
            fidelityScore: testCase.replay.fidelityScore,
            preserved: [],
            missing: testCase.replay.missing,
            updatedAt: new Date("2026-04-04T00:00:00.000Z"),
          }
        : null,
      recovery,
      calibration,
      payloadState: {
        activeHandles: [],
        prunedHandles: [],
        stateSource: testCase.payloadState.source,
        stateSummary: testCase.payloadState.stateSummary,
      },
      notebookState,
      pruneTrace,
      remediationTrace,
      analytics,
      effectiveness,
    });
    const runbook = buildRuntimeContinuityRunbook({
      recovery,
      calibration,
      analytics,
      effectiveness,
      evidence,
    });

    const repeatPatternPass = analytics.repeatPattern.status === testCase.expected.repeatPatternStatus;
    const analyticsCountPass = analytics.totalAttempts === testCase.expected.totalAttempts;
    const evidencePass = testCase.expected.evidenceIncludes.every((snippet) =>
      includesInAny([evidence.summary, ...evidence.items], snippet),
    );
    const runbookTitlePass = runbook.title === testCase.expected.runbookTitle;
    const runbookPass = testCase.expected.runbookIncludes.every((snippet) =>
      includesInAny([runbook.summary, ...runbook.steps, runbook.boundaryNote], snippet),
    );

    const failures: string[] = [];
    if (!repeatPatternPass) failures.push("repeat-pattern detection regressed");
    if (!analyticsCountPass) failures.push("remediation analytics counts regressed");
    if (!evidencePass) failures.push("continuity evidence surface regressed");
    if (!runbookTitlePass) failures.push("continuity runbook title regressed");
    if (!runbookPass) failures.push("continuity runbook guidance regressed");

    results.push({
      id: testCase.id,
      label: testCase.label,
      passed: failures.length === 0,
      failures,
      repeatPatternPass,
      analyticsCountPass,
      evidencePass,
      runbookTitlePass,
      runbookPass,
    });
  }

  const passedCases = results.filter((item) => item.passed).length;

  return {
    totalCases: results.length,
    passedCases,
    passRate: toRate(passedCases, results.length),
    repeatPatternRate: toRate(results.filter((item) => item.repeatPatternPass).length, results.length),
    analyticsCountRate: toRate(results.filter((item) => item.analyticsCountPass).length, results.length),
    evidenceRate: toRate(results.filter((item) => item.evidencePass).length, results.length),
    runbookTitleRate: toRate(results.filter((item) => item.runbookTitlePass).length, results.length),
    runbookRate: toRate(results.filter((item) => item.runbookPass).length, results.length),
    cases: results,
  };
}

export function runHelmV22ContinuityPilotCalibrationEvalHarness(): HelmV22ContinuityPilotCalibrationEvalSummary {
  const cases = loadContinuityPilotCalibrationGoldenCases();
  const results: HelmV22ContinuityPilotCalibrationEvalCaseResult[] = [];

  for (const testCase of cases) {
    const budgetPosture = buildBudgetPosture(testCase.budgetPostureInput);
    const replay = testCase.replay
      ? {
          checkpointId: testCase.substrate.latestCheckpoint?.id ?? "checkpoint_eval",
          checkpointLabel: testCase.substrate.latestCheckpoint?.label ?? "checkpoint_eval",
          replaySummary: "eval replay summary",
          fidelityStatus: testCase.replay.fidelityStatus,
          fidelityScore: testCase.replay.fidelityScore,
          preserved: [],
          missing: testCase.replay.missing,
          updatedAt: new Date("2026-04-04T00:00:00.000Z"),
        }
      : null;
    const recovery = buildRuntimeContinuityRecovery({
      budgetPosture,
      replay,
      payloadState: {
        activeHandles: [],
        prunedHandles: [],
        stateSource: testCase.payloadState.source,
        stateSummary: testCase.payloadState.stateSummary,
      },
      latestCheckpoint: testCase.substrate.latestCheckpoint,
      persistedPayloadCount: testCase.substrate.persistedPayloadCount,
      pruneTraceCount: testCase.substrate.pruneTraceCount,
    });
    const notebookState = buildRuntimeNotebookState({
      sessionLabel: `Eval session ${testCase.id}`,
      sessionStatus: "ACTIVE",
      boundaryNote: "No auto-send.",
      notebook: {
        sessionSummary: testCase.notebook.sessionSummary,
        decisionSummary: testCase.notebook.decisionSummary,
        blockerSummary: testCase.notebook.blockerSummary,
        pendingQuestions: JSON.stringify(testCase.notebook.pendingQuestions),
        openLoopSummary: testCase.notebook.openLoopSummary,
        boundaryNote: "No auto-send.",
      },
      verification: null,
      problemSpaces: [],
      promotedFacts: testCase.notebook.evidenceRefs.length
        ? [
            {
              summary: "Confirmed continuity evidence remains reviewable.",
              evidenceRefs: testCase.notebook.evidenceRefs,
            },
          ]
        : [],
      truthConflicts: [],
    });
    const pruneTrace = (testCase.pruneTrace ?? []).map((item) => ({
      id: item.id,
      strategy: "eval_prune_trace",
      posture: item.posture,
      reason: item.reason,
      beforeTokenCount: 100,
      afterTokenCount: Math.max(0, 100 - item.tokensSaved),
      tokensSaved: item.tokensSaved,
      replacementSummary: "Removed payloads were replaced by handle + preview + summary.",
      protectedItems: ["No auto-send."],
      removedPayloads: [],
      createdAt: new Date("2026-04-04T00:00:00.000Z"),
    }));
    const remediationTrace = testCase.remediationTrace.map((item, index) => ({
      id: `${testCase.id}_${index}`,
      action: item.action,
      executionStatus: item.executionStatus,
      summary: item.summary,
      beforeSummary: item.beforeSummary,
      afterSummary: item.afterSummary,
      beforeRiskLevel: item.beforeRiskLevel,
      afterRiskLevel: item.afterRiskLevel,
      beforeRecoveryState: item.beforeRecoveryState,
      afterRecoveryState: item.afterRecoveryState,
      beforeFailureTaxonomy: item.beforeFailureTaxonomy,
      afterFailureTaxonomy: item.afterFailureTaxonomy,
      rollbackAnchorSummary: item.rollbackAnchorSummary,
      triggeredBy: "eval-harness",
      createdAt: new Date(item.createdAt),
    }));

    const analytics = buildRuntimeRemediationAnalytics(remediationTrace);
    const effectiveness = buildRuntimeRemediationEffectiveness(remediationTrace);
    const risk = buildRuntimeContinuityRisk({
      budgetPosture: budgetPosture.state,
      replayStatus: replay?.fidelityStatus ?? null,
      payloadStateSource: testCase.payloadState.source,
      hasPruneTrace: pruneTrace.length > 0,
    });
    const calibration = buildRuntimeContinuityCalibration({
      recovery,
      replay,
      payloadState: {
        activeHandles: [],
        prunedHandles: [],
        stateSource: testCase.payloadState.source,
        stateSummary: testCase.payloadState.stateSummary,
      },
      risk,
      analytics,
      effectiveness,
    });
    const evidence = buildRuntimeContinuityEvidenceSurface({
      replay,
      recovery: calibration.stateAdjusted
        ? {
            ...recovery,
            state: calibration.calibratedState,
            summary: `${recovery.summary} ${calibration.summary}`,
            operatorAction:
              calibration.calibratedState === "REVIEW_REQUIRED"
                ? "Pause bounded remediation. Review the continuity evidence and confirm protected fields or recovery anchors before trying another operator action."
                : recovery.operatorAction,
            allowedActions: calibration.calibratedState === "REVIEW_REQUIRED" ? [] : recovery.allowedActions,
            reviewReasons:
              calibration.calibratedState === "REVIEW_REQUIRED"
                ? [recovery.summary, calibration.summary].filter((item, index, list) => list.indexOf(item) === index)
                : recovery.reviewReasons,
          }
        : recovery,
      calibration,
      payloadState: {
        activeHandles: [],
        prunedHandles: [],
        stateSource: testCase.payloadState.source,
        stateSummary: testCase.payloadState.stateSummary,
      },
      notebookState,
      pruneTrace,
      remediationTrace,
      analytics,
      effectiveness,
    });
    const runbook = buildRuntimeContinuityRunbook({
      recovery: calibration.stateAdjusted
        ? {
            ...recovery,
            state: calibration.calibratedState,
            summary: `${recovery.summary} ${calibration.summary}`,
            operatorAction:
              calibration.calibratedState === "REVIEW_REQUIRED"
                ? "Pause bounded remediation. Review the continuity evidence and confirm protected fields or recovery anchors before trying another operator action."
                : recovery.operatorAction,
            allowedActions: calibration.calibratedState === "REVIEW_REQUIRED" ? [] : recovery.allowedActions,
            reviewReasons:
              calibration.calibratedState === "REVIEW_REQUIRED"
                ? [recovery.summary, calibration.summary].filter((item, index, list) => list.indexOf(item) === index)
                : recovery.reviewReasons,
          }
        : recovery,
      calibration,
      analytics,
      effectiveness,
      evidence,
    });

    const calibratedStatePass = calibration.calibratedState === testCase.expected.calibratedState;
    const calibrationConfidencePass = calibration.confidence === testCase.expected.calibrationConfidence;
    const latestEffectivenessPass = effectiveness.latestOutcome === testCase.expected.latestEffectiveness;
    const repeatPatternPass = analytics.repeatPattern.status === testCase.expected.repeatPatternStatus;
    const evidencePass = testCase.expected.evidenceIncludes.every((snippet) =>
      includesInAny([evidence.summary, ...evidence.items], snippet),
    );
    const runbookTitlePass = runbook.title === testCase.expected.runbookTitle;

    const failures: string[] = [];
    if (!calibratedStatePass) failures.push("continuity recovery calibration regressed");
    if (!calibrationConfidencePass) failures.push("continuity calibration confidence regressed");
    if (!latestEffectivenessPass) failures.push("remediation effectiveness classification regressed");
    if (!repeatPatternPass) failures.push("repeat ineffective detection regressed");
    if (!evidencePass) failures.push("continuity evidence calibration summary regressed");
    if (!runbookTitlePass) failures.push("continuity runbook escalation title regressed");

    results.push({
      id: testCase.id,
      label: testCase.label,
      passed: failures.length === 0,
      failures,
      calibratedStatePass,
      calibrationConfidencePass,
      latestEffectivenessPass,
      repeatPatternPass,
      evidencePass,
      runbookTitlePass,
    });
  }

  const passedCases = results.filter((item) => item.passed).length;

  return {
    totalCases: results.length,
    passedCases,
    passRate: toRate(passedCases, results.length),
    calibratedStateRate: toRate(results.filter((item) => item.calibratedStatePass).length, results.length),
    calibrationConfidenceRate: toRate(results.filter((item) => item.calibrationConfidencePass).length, results.length),
    latestEffectivenessRate: toRate(results.filter((item) => item.latestEffectivenessPass).length, results.length),
    repeatPatternRate: toRate(results.filter((item) => item.repeatPatternPass).length, results.length),
    evidenceRate: toRate(results.filter((item) => item.evidencePass).length, results.length),
    runbookTitleRate: toRate(results.filter((item) => item.runbookTitlePass).length, results.length),
    cases: results,
  };
}

export function runHelmV22ContinuityPilotEffectivenessReviewEvalHarness(): HelmV22ContinuityPilotEffectivenessReviewEvalSummary {
  const cases = loadContinuityPilotEffectivenessReviewGoldenCases();
  const results: HelmV22ContinuityPilotEffectivenessReviewEvalCaseResult[] = [];

  for (const testCase of cases) {
    const entries = testCase.queueEntries.map((item) => buildEvalContinuityPilotQueueEntry(item));
    const pilotReview = buildRuntimeContinuityPilotEffectivenessReview(entries);
    const targetEntry =
      entries.find((item) => item.failureTaxonomy === testCase.targetFailureTaxonomy) ??
      entries[0];
    if (!targetEntry) {
      results.push({
        id: testCase.id,
        label: testCase.label,
        passed: false,
        failures: ["pilot review fixture is missing a target continuity case"],
        distributionPass: false,
        driftPass: false,
        calibrationProfilePass: false,
        sessionReviewPass: false,
        sopPass: false,
      });
      continue;
    }

    const allowedActions: Array<"SAVE_RECOVERY_CHECKPOINT" | "RESUME_CHECKPOINT" | "REPRUNE_CONTEXT"> =
      targetEntry.recoveryState === "RECOVERABLE" ? ["RESUME_CHECKPOINT"] : [];

    const recovery = {
      state: targetEntry.recoveryState,
      failureTaxonomy: targetEntry.failureTaxonomy,
      summary: targetEntry.recoverySummary,
      operatorAction:
        targetEntry.recoveryState === "BLOCKED"
          ? "Do not continue bounded remediation from this surface."
          : targetEntry.recoveryState === "REVIEW_REQUIRED"
            ? "Pause remediation until protected fields are reviewed."
            : targetEntry.recoveryState === "RECOVERABLE"
              ? "Run the next bounded continuity remediation step."
              : "Monitor continuity posture.",
      allowedActions,
      reviewReasons:
        targetEntry.recoveryState === "REVIEW_REQUIRED"
          ? ["protected continuity fields still need review"]
          : [],
      blockedReasons:
        targetEntry.recoveryState === "BLOCKED"
          ? ["no recovery anchor exists yet"]
          : [],
      rollbackAnchor:
        targetEntry.failureTaxonomy === "NO_RECOVERY_ANCHOR"
          ? null
          : {
              checkpointId: "continuity_anchor",
              checkpointLabel: "continuity_anchor",
              checkpointStatus: "READY",
            },
    };
    const calibration = {
      pilotBasis: pilotReview.pilotBasis,
      rawState: targetEntry.recoveryState,
      calibratedState: targetEntry.recoveryState,
      confidence: targetEntry.calibrationConfidence,
      stateAdjusted: false,
      summary: targetEntry.calibrationSummary,
      reasons: [targetEntry.calibrationSummary],
    };
    const analytics = {
      totalAttempts: targetEntry.remediationAttempts,
      appliedCount: targetEntry.latestEffectiveness === "EFFECTIVE" || targetEntry.latestEffectiveness === "PARTIAL" || targetEntry.latestEffectiveness === "INEFFECTIVE" ? targetEntry.remediationAttempts : 0,
      reviewRequiredCount: targetEntry.repeatPatternStatus === "REPEATED_REVIEW_REQUIRED" ? targetEntry.remediationAttempts : 0,
      blockedCount: targetEntry.repeatPatternStatus === "REPEATED_BLOCKED_ACTION" ? targetEntry.remediationAttempts : 0,
      latestAction: "SAVE_RECOVERY_CHECKPOINT" as const,
      latestAttemptAt: targetEntry.updatedAt,
      repeatPattern: {
        status: targetEntry.repeatPatternStatus,
        summary: targetEntry.repeatPatternSummary,
      },
    };
    const effectiveness = {
      pilotBasis: pilotReview.pilotBasis,
      latestOutcome: targetEntry.latestEffectiveness,
      latestSummary: targetEntry.effectivenessSummary,
      effectiveCount: targetEntry.latestEffectiveness === "EFFECTIVE" ? 1 : 0,
      partialCount: targetEntry.latestEffectiveness === "PARTIAL" ? 1 : 0,
      ineffectiveCount: targetEntry.latestEffectiveness === "INEFFECTIVE" ? 1 : 0,
      noSignalCount: targetEntry.latestEffectiveness === "NO_SIGNAL" ? 1 : 0,
      escalationNeeded: targetEntry.latestEffectiveness === "INEFFECTIVE",
      escalationSummary:
        targetEntry.latestEffectiveness === "INEFFECTIVE"
          ? "Stop retrying blindly and move this continuity workflow into explicit operator review."
          : "No escalation beyond bounded continuity workflow is currently needed.",
    };
    const sessionReview = buildRuntimeContinuityPilotSessionReview({
      recovery,
      calibration,
      analytics,
      effectiveness,
      pilotReview,
    });
    const sop = buildRuntimeContinuitySop({
      recovery,
      analytics,
      effectiveness,
      evidence: {
        summary: targetEntry.evidenceSummary,
        items: [targetEntry.summary, targetEntry.repeatPatternSummary, targetEntry.calibrationSummary],
      },
      pilotReview: sessionReview,
    });

    const distributionPass =
      pilotReview.totalPilotCases === testCase.expected.totalPilotCases &&
      pilotReview.topFailureClasses[0]?.failureTaxonomy === testCase.expected.topFailureClass &&
      sessionReview.confidenceBand === testCase.expected.confidenceBand &&
      sessionReview.recommendedIneffectiveThreshold === testCase.expected.recommendedIneffectiveThreshold;
    const driftPass = testCase.expected.driftSummaryIncludes.every((snippet) =>
      includesInAny([pilotReview.drift.summary, sessionReview.driftSummary], snippet),
    );
    const calibrationProfilePass = testCase.expected.calibrationProfileIncludes.every((snippet) =>
      includesInAny(
        [
          pilotReview.calibrationProfile.summary,
          pilotReview.calibrationProfile.confidenceBandSummary,
          ...pilotReview.calibrationProfile.classAdjustments,
        ],
        snippet,
      ),
    );
    const sessionReviewPass = testCase.expected.sessionAdjustmentIncludes.every((snippet) =>
      includesInAny([sessionReview.classSummary, sessionReview.adjustmentSummary, sessionReview.driftSummary], snippet),
    );
    const sopPass =
      sop.title === testCase.expected.sopTitle &&
      testCase.expected.sopIncludes.every((snippet) =>
        includesInAny(
          [sop.summary, sop.escalationRule, sop.boundaryNote, ...sop.evidenceChecklist, ...sop.commonPitfalls],
          snippet,
        ),
      );

    const failures: string[] = [];
    if (!distributionPass) failures.push("pilot case distribution or threshold review regressed");
    if (!driftPass) failures.push("remediation outcome drift summary regressed");
    if (!calibrationProfilePass) failures.push("pilot calibration profile summary regressed");
    if (!sessionReviewPass) failures.push("session-level pilot review guidance regressed");
    if (!sopPass) failures.push("operator SOP refinement regressed");

    results.push({
      id: testCase.id,
      label: testCase.label,
      passed: failures.length === 0,
      failures,
      distributionPass,
      driftPass,
      calibrationProfilePass,
      sessionReviewPass,
      sopPass,
    });
  }

  const passedCases = results.filter((item) => item.passed).length;

  return {
    totalCases: results.length,
    passedCases,
    passRate: toRate(passedCases, results.length),
    distributionRate: toRate(results.filter((item) => item.distributionPass).length, results.length),
    driftRate: toRate(results.filter((item) => item.driftPass).length, results.length),
    calibrationProfileRate: toRate(results.filter((item) => item.calibrationProfilePass).length, results.length),
    sessionReviewRate: toRate(results.filter((item) => item.sessionReviewPass).length, results.length),
    sopRate: toRate(results.filter((item) => item.sopPass).length, results.length),
    cases: results,
  };
}

export function runHelmV22ContinuityPilotCalibrationReviewEvalHarness(): HelmV22ContinuityPilotCalibrationReviewEvalSummary {
  const cases = loadContinuityPilotCalibrationReviewGoldenCases();
  const results: HelmV22ContinuityPilotCalibrationReviewEvalCaseResult[] = [];

  for (const testCase of cases) {
    const entries = testCase.queueEntries.map((item) => buildEvalContinuityPilotQueueEntry(item));
    const pilotReview = buildRuntimeContinuityPilotEffectivenessReview(entries, {
      workspaceSessionCount: testCase.workspaceSessionCount,
    });
    const targetEntry =
      entries.find((item) => item.failureTaxonomy === testCase.targetFailureTaxonomy) ??
      entries[0];

    if (!targetEntry) {
      results.push({
        id: testCase.id,
        label: testCase.label,
        passed: false,
        failures: ["pilot calibration review fixture is missing a target continuity case"],
        cohortPass: false,
        thresholdPass: false,
        driftPass: false,
        operatorHandlingPass: false,
        sessionReviewPass: false,
      });
      continue;
    }

    const allowedActions: Array<"SAVE_RECOVERY_CHECKPOINT" | "RESUME_CHECKPOINT" | "REPRUNE_CONTEXT"> =
      targetEntry.recoveryState === "RECOVERABLE" ? ["RESUME_CHECKPOINT"] : [];

    const recovery = {
      state: targetEntry.recoveryState,
      failureTaxonomy: targetEntry.failureTaxonomy,
      summary: targetEntry.recoverySummary,
      operatorAction:
        targetEntry.recoveryState === "BLOCKED"
          ? "Do not continue bounded remediation from this surface."
          : targetEntry.recoveryState === "REVIEW_REQUIRED"
            ? "Pause remediation until protected fields are reviewed."
            : targetEntry.recoveryState === "RECOVERABLE"
              ? "Run the next bounded continuity remediation step."
              : "Monitor continuity posture.",
      allowedActions,
      reviewReasons:
        targetEntry.recoveryState === "REVIEW_REQUIRED"
          ? ["protected continuity fields still need review"]
          : [],
      blockedReasons:
        targetEntry.recoveryState === "BLOCKED"
          ? ["no recovery anchor exists yet"]
          : [],
      rollbackAnchor:
        targetEntry.failureTaxonomy === "NO_RECOVERY_ANCHOR"
          ? null
          : {
              checkpointId: "continuity_anchor",
              checkpointLabel: "continuity_anchor",
              checkpointStatus: "READY",
            },
    };
    const calibration = {
      pilotBasis: pilotReview.pilotBasis,
      rawState: targetEntry.recoveryState,
      calibratedState: targetEntry.recoveryState,
      confidence: targetEntry.calibrationConfidence,
      stateAdjusted: false,
      summary: targetEntry.calibrationSummary,
      reasons: [targetEntry.calibrationSummary],
    };
    const analytics = {
      totalAttempts: targetEntry.remediationAttempts,
      appliedCount:
        targetEntry.latestEffectiveness === "EFFECTIVE" ||
        targetEntry.latestEffectiveness === "PARTIAL" ||
        targetEntry.latestEffectiveness === "INEFFECTIVE"
          ? targetEntry.remediationAttempts
          : 0,
      reviewRequiredCount: targetEntry.repeatPatternStatus === "REPEATED_REVIEW_REQUIRED" ? targetEntry.remediationAttempts : 0,
      blockedCount: targetEntry.repeatPatternStatus === "REPEATED_BLOCKED_ACTION" ? targetEntry.remediationAttempts : 0,
      latestAction: "SAVE_RECOVERY_CHECKPOINT" as const,
      latestAttemptAt: targetEntry.updatedAt,
      repeatPattern: {
        status: targetEntry.repeatPatternStatus,
        summary: targetEntry.repeatPatternSummary,
      },
    };
    const effectiveness = {
      pilotBasis: pilotReview.pilotBasis,
      latestOutcome: targetEntry.latestEffectiveness,
      latestSummary: targetEntry.effectivenessSummary,
      effectiveCount: targetEntry.latestEffectiveness === "EFFECTIVE" ? 1 : 0,
      partialCount: targetEntry.latestEffectiveness === "PARTIAL" ? 1 : 0,
      ineffectiveCount: targetEntry.latestEffectiveness === "INEFFECTIVE" ? 1 : 0,
      noSignalCount: targetEntry.latestEffectiveness === "NO_SIGNAL" ? 1 : 0,
      escalationNeeded: targetEntry.latestEffectiveness === "INEFFECTIVE",
      escalationSummary:
        targetEntry.latestEffectiveness === "INEFFECTIVE"
          ? "Stop retrying blindly and move this continuity workflow into explicit operator review."
          : "No escalation beyond bounded continuity workflow is currently needed.",
    };
    const sessionReview = buildRuntimeContinuityPilotSessionReview({
      recovery,
      calibration,
      analytics,
      effectiveness,
      pilotReview,
      cohortContext: {
        workspaceSizeBand: pilotReview.workspaceCohort.sizeBand,
        meetingShape: targetEntry.meetingShape,
      },
    });

    const cohortPass =
      pilotReview.workspaceCohort.sizeBand === testCase.expected.workspaceSizeBand &&
      sessionReview.meetingShape === testCase.expected.targetMeetingShape &&
      testCase.expected.cohortSummaryIncludes.every((snippet) =>
        includesInAny(
          [
            pilotReview.workspaceCohort.summary,
            ...pilotReview.meetingShapeCohorts.map((item) => item.summary),
            sessionReview.cohortSummary,
          ],
          snippet,
        ),
      );
    const thresholdPass = testCase.expected.thresholdRevisionIncludes.every((snippet) =>
      includesInAny(
        [
          sessionReview.thresholdRevisionSummary,
          ...pilotReview.thresholdRevisions.map((item) => item.summary),
          ...pilotReview.meetingShapeCohorts.map((item) => item.thresholdSummary),
        ],
        snippet,
      ),
    );
    const driftPass = testCase.expected.driftSummaryIncludes.every((snippet) =>
      includesInAny(
        [
          pilotReview.drift.summary,
          ...pilotReview.meetingShapeCohorts.map((item) => item.driftSummary),
          ...pilotReview.remediationOutcomeReview.map((item) => item.summary),
          sessionReview.driftSummary,
        ],
        snippet,
      ),
    );
    const operatorHandlingPass =
      pilotReview.operatorHandlingEffectiveness.matchedGuidanceRate === testCase.expected.matchedGuidanceRate &&
      testCase.expected.operatorHandlingIncludes.every((snippet) =>
        includesInAny(
          [
            pilotReview.operatorHandlingEffectiveness.summary,
            ...pilotReview.operatorHandlingEffectiveness.highlights,
            sessionReview.operatorHandlingSummary,
          ],
          snippet,
        ),
      );
    const sessionReviewPass =
      sessionReview.workspaceSizeBand === testCase.expected.workspaceSizeBand &&
      sessionReview.meetingShape === testCase.expected.targetMeetingShape &&
      Boolean(sessionReview.cohortSummary) &&
      Boolean(sessionReview.thresholdRevisionSummary);

    const failures: string[] = [];
    if (!cohortPass) failures.push("pilot cohort breakdown regressed");
    if (!thresholdPass) failures.push("threshold revision review regressed");
    if (!driftPass) failures.push("drift review summary regressed");
    if (!operatorHandlingPass) failures.push("operator handling effectiveness review regressed");
    if (!sessionReviewPass) failures.push("session-level cohort review regressed");

    results.push({
      id: testCase.id,
      label: testCase.label,
      passed: failures.length === 0,
      failures,
      cohortPass,
      thresholdPass,
      driftPass,
      operatorHandlingPass,
      sessionReviewPass,
    });
  }

  const passedCases = results.filter((item) => item.passed).length;

  return {
    totalCases: results.length,
    passedCases,
    passRate: toRate(passedCases, results.length),
    cohortRate: toRate(results.filter((item) => item.cohortPass).length, results.length),
    thresholdRate: toRate(results.filter((item) => item.thresholdPass).length, results.length),
    driftRate: toRate(results.filter((item) => item.driftPass).length, results.length),
    operatorHandlingRate: toRate(results.filter((item) => item.operatorHandlingPass).length, results.length),
    sessionReviewRate: toRate(results.filter((item) => item.sessionReviewPass).length, results.length),
    cases: results,
  };
}

export function runHelmV22ContinuityCalibrationNextLayerEvalHarness(): HelmV22ContinuityCalibrationNextLayerEvalSummary {
  const cases = loadContinuityCalibrationNextLayerGoldenCases();
  const results: HelmV22ContinuityCalibrationNextLayerEvalCaseResult[] = [];

  for (const testCase of cases) {
    const entries = testCase.queueEntries.map((item) => buildEvalContinuityPilotQueueEntry(item));
    const pilotReview = buildRuntimeContinuityPilotEffectivenessReview(entries, {
      workspaceSessionCount: testCase.workspaceSessionCount,
    });
    const targetEntry =
      entries.find((item) => item.failureTaxonomy === testCase.targetFailureTaxonomy) ??
      entries[0];

    if (!targetEntry) {
      results.push({
        id: testCase.id,
        label: testCase.label,
        passed: false,
        failures: ["continuity calibration next-layer fixture is missing a target continuity case"],
        cohortPass: false,
        recalibrationPass: false,
        longHorizonPass: false,
        variancePass: false,
        sessionReviewPass: false,
      });
      continue;
    }

    const allowedActions: Array<"SAVE_RECOVERY_CHECKPOINT" | "RESUME_CHECKPOINT" | "REPRUNE_CONTEXT"> =
      targetEntry.recoveryState === "RECOVERABLE" ? ["RESUME_CHECKPOINT"] : [];

    const recovery = {
      state: targetEntry.recoveryState,
      failureTaxonomy: targetEntry.failureTaxonomy,
      summary: targetEntry.recoverySummary,
      operatorAction:
        targetEntry.recoveryState === "BLOCKED"
          ? "Do not continue bounded remediation from this surface."
          : targetEntry.recoveryState === "REVIEW_REQUIRED"
            ? "Pause remediation until protected fields are reviewed."
            : targetEntry.recoveryState === "RECOVERABLE"
              ? "Run the next bounded continuity remediation step."
              : "Monitor continuity posture.",
      allowedActions,
      reviewReasons:
        targetEntry.recoveryState === "REVIEW_REQUIRED"
          ? ["protected continuity fields still need review"]
          : [],
      blockedReasons:
        targetEntry.recoveryState === "BLOCKED"
          ? ["no recovery anchor exists yet"]
          : [],
      rollbackAnchor:
        targetEntry.failureTaxonomy === "NO_RECOVERY_ANCHOR"
          ? null
          : {
              checkpointId: "continuity_anchor",
              checkpointLabel: "continuity_anchor",
              checkpointStatus: "READY",
            },
    };
    const calibration = {
      pilotBasis: pilotReview.pilotBasis,
      rawState: targetEntry.recoveryState,
      calibratedState: targetEntry.recoveryState,
      confidence: targetEntry.calibrationConfidence,
      stateAdjusted: false,
      summary: targetEntry.calibrationSummary,
      reasons: [targetEntry.calibrationSummary],
    };
    const analytics = {
      totalAttempts: targetEntry.remediationAttempts,
      appliedCount:
        targetEntry.latestEffectiveness === "EFFECTIVE" ||
        targetEntry.latestEffectiveness === "PARTIAL" ||
        targetEntry.latestEffectiveness === "INEFFECTIVE"
          ? targetEntry.remediationAttempts
          : 0,
      reviewRequiredCount: targetEntry.repeatPatternStatus === "REPEATED_REVIEW_REQUIRED" ? targetEntry.remediationAttempts : 0,
      blockedCount: targetEntry.repeatPatternStatus === "REPEATED_BLOCKED_ACTION" ? targetEntry.remediationAttempts : 0,
      latestAction: "SAVE_RECOVERY_CHECKPOINT" as const,
      latestAttemptAt: targetEntry.updatedAt,
      repeatPattern: {
        status: targetEntry.repeatPatternStatus,
        summary: targetEntry.repeatPatternSummary,
      },
    };
    const effectiveness = {
      pilotBasis: pilotReview.pilotBasis,
      latestOutcome: targetEntry.latestEffectiveness,
      latestSummary: targetEntry.effectivenessSummary,
      effectiveCount: targetEntry.latestEffectiveness === "EFFECTIVE" ? 1 : 0,
      partialCount: targetEntry.latestEffectiveness === "PARTIAL" ? 1 : 0,
      ineffectiveCount: targetEntry.latestEffectiveness === "INEFFECTIVE" ? 1 : 0,
      noSignalCount: targetEntry.latestEffectiveness === "NO_SIGNAL" ? 1 : 0,
      escalationNeeded: targetEntry.latestEffectiveness === "INEFFECTIVE",
      escalationSummary:
        targetEntry.latestEffectiveness === "INEFFECTIVE"
          ? "Stop retrying blindly and move this continuity workflow into explicit operator review."
          : "No escalation beyond bounded continuity workflow is currently needed.",
    };
    const sessionReview = buildRuntimeContinuityPilotSessionReview({
      recovery,
      calibration,
      analytics,
      effectiveness,
      pilotReview,
      cohortContext: {
        workspaceSizeBand: pilotReview.workspaceCohort.sizeBand,
        meetingShape: targetEntry.meetingShape,
      },
    });

    const cohortPass =
      pilotReview.workspaceCohort.sizeBand === testCase.expected.workspaceSizeBand &&
      sessionReview.meetingShape === testCase.expected.targetMeetingShape &&
      sessionReview.riskBand === testCase.expected.targetRiskBand &&
      testCase.expected.cohortIncludes.every((snippet) =>
        includesInAny(
          [
            pilotReview.workspaceCohort.summary,
            ...pilotReview.cohortFamilies.map((item) => `${item.summary} ${item.recalibrationSummary}`),
            ...pilotReview.remediationPostureCohorts.map((item) => `${item.summary} ${item.varianceSummary}`),
            sessionReview.cohortSummary,
          ],
          snippet,
        ),
      );
    const recalibrationPass = testCase.expected.recalibrationIncludes.every((snippet) =>
      includesInAny(
        [
          pilotReview.calibrationProfile.summary,
          pilotReview.calibrationProfile.confidenceBandSummary,
          pilotReview.calibrationProfile.riskBandSummary,
          ...pilotReview.calibrationProfile.revisedHighlights,
          ...pilotReview.thresholdRevisions.map((item) => `${item.confidenceSummary} ${item.summary}`),
          sessionReview.adjustmentSummary,
          sessionReview.thresholdRevisionSummary,
        ],
        snippet,
      ),
    );
    const longHorizonPass = testCase.expected.longHorizonIncludes.every((snippet) =>
      includesInAny(
        [
          pilotReview.drift.summary,
          ...pilotReview.drift.materiallyDriftingCohorts,
          ...pilotReview.cohortFamilies.map((item) => item.longHorizonSummary),
          sessionReview.driftSummary,
          sessionReview.longHorizonSummary,
        ],
        snippet,
      ),
    );
    const variancePass =
      pilotReview.operatorHandlingEffectiveness.stepReviews.some((item) => item.label === testCase.expected.targetStepLabel) &&
      testCase.expected.varianceIncludes.every((snippet) =>
        includesInAny(
          [
            pilotReview.operatorHandlingEffectiveness.summary,
            pilotReview.operatorHandlingEffectiveness.outcomeVarianceSummary,
            ...pilotReview.operatorHandlingEffectiveness.highlights,
            ...pilotReview.operatorHandlingEffectiveness.stepReviews.flatMap((item) => [
              `${item.label} ${item.summary}`,
              item.improvementHint,
            ]),
            ...pilotReview.remediationPostureCohorts.map((item) => item.varianceSummary),
            sessionReview.operatorHandlingSummary,
            sessionReview.varianceSummary,
          ],
          snippet,
        ),
      );
    const sessionReviewPass =
      sessionReview.workspaceSizeBand === testCase.expected.workspaceSizeBand &&
      sessionReview.meetingShape === testCase.expected.targetMeetingShape &&
      sessionReview.riskBand === testCase.expected.targetRiskBand &&
      Boolean(sessionReview.longHorizonSummary) &&
      Boolean(sessionReview.varianceSummary);

    const failures: string[] = [];
    if (!cohortPass) failures.push("expanded cohort review regressed");
    if (!recalibrationPass) failures.push("threshold or confidence recalibration regressed");
    if (!longHorizonPass) failures.push("long-horizon drift review regressed");
    if (!variancePass) failures.push("SOP hit-rate or operator outcome variance review regressed");
    if (!sessionReviewPass) failures.push("session-level next-layer calibration review regressed");

    results.push({
      id: testCase.id,
      label: testCase.label,
      passed: failures.length === 0,
      failures,
      cohortPass,
      recalibrationPass,
      longHorizonPass,
      variancePass,
      sessionReviewPass,
    });
  }

  const passedCases = results.filter((item) => item.passed).length;

  return {
    totalCases: results.length,
    passedCases,
    passRate: toRate(passedCases, results.length),
    cohortRate: toRate(results.filter((item) => item.cohortPass).length, results.length),
    recalibrationRate: toRate(results.filter((item) => item.recalibrationPass).length, results.length),
    longHorizonRate: toRate(results.filter((item) => item.longHorizonPass).length, results.length),
    varianceRate: toRate(results.filter((item) => item.variancePass).length, results.length),
    sessionReviewRate: toRate(results.filter((item) => item.sessionReviewPass).length, results.length),
    cases: results,
  };
}

export function runHelmV22ContinuityCalibrationDeepeningEvalHarness(): HelmV22ContinuityCalibrationDeepeningEvalSummary {
  const cases = loadContinuityCalibrationDeepeningGoldenCases();
  const results: HelmV22ContinuityCalibrationDeepeningEvalCaseResult[] = [];

  for (const testCase of cases) {
    const entries = testCase.queueEntries.map((item) => buildEvalContinuityPilotQueueEntry(item));
    const pilotReview = buildRuntimeContinuityPilotEffectivenessReview(entries, {
      workspaceSessionCount: testCase.workspaceSessionCount,
    });
    const targetEntry = entries.find((item) => item.failureTaxonomy === testCase.targetFailureTaxonomy) ?? entries[0];

    if (!targetEntry) {
      results.push({
        id: testCase.id,
        label: testCase.label,
        passed: false,
        failures: ["continuity calibration deepening fixture is missing a target continuity case"],
        subgroupPass: false,
        refinementPass: false,
        driftSynthesisPass: false,
        sopSynthesisPass: false,
        sessionReviewPass: false,
      });
      continue;
    }

    const allowedActions: Array<"SAVE_RECOVERY_CHECKPOINT" | "RESUME_CHECKPOINT" | "REPRUNE_CONTEXT"> =
      targetEntry.recoveryState === "RECOVERABLE" ? ["RESUME_CHECKPOINT"] : [];

    const recovery = {
      state: targetEntry.recoveryState,
      failureTaxonomy: targetEntry.failureTaxonomy,
      summary: targetEntry.recoverySummary,
      operatorAction:
        targetEntry.recoveryState === "BLOCKED"
          ? "Do not continue bounded remediation from this surface."
          : targetEntry.recoveryState === "REVIEW_REQUIRED"
            ? "Pause remediation until protected fields are reviewed."
            : targetEntry.recoveryState === "RECOVERABLE"
              ? "Run the next bounded continuity remediation step."
              : "Monitor continuity posture.",
      allowedActions,
      reviewReasons:
        targetEntry.recoveryState === "REVIEW_REQUIRED"
          ? ["protected continuity fields still need review"]
          : [],
      blockedReasons:
        targetEntry.recoveryState === "BLOCKED"
          ? ["no recovery anchor exists yet"]
          : [],
      rollbackAnchor:
        targetEntry.failureTaxonomy === "NO_RECOVERY_ANCHOR"
          ? null
          : {
              checkpointId: "continuity_anchor",
              checkpointLabel: "continuity_anchor",
              checkpointStatus: "READY",
            },
    };
    const calibration = {
      pilotBasis: pilotReview.pilotBasis,
      rawState: targetEntry.recoveryState,
      calibratedState: targetEntry.recoveryState,
      confidence: targetEntry.calibrationConfidence,
      stateAdjusted: false,
      summary: targetEntry.calibrationSummary,
      reasons: [targetEntry.calibrationSummary],
    };
    const analytics = {
      totalAttempts: targetEntry.remediationAttempts,
      appliedCount:
        targetEntry.latestEffectiveness === "EFFECTIVE" ||
        targetEntry.latestEffectiveness === "PARTIAL" ||
        targetEntry.latestEffectiveness === "INEFFECTIVE"
          ? targetEntry.remediationAttempts
          : 0,
      reviewRequiredCount: targetEntry.repeatPatternStatus === "REPEATED_REVIEW_REQUIRED" ? targetEntry.remediationAttempts : 0,
      blockedCount: targetEntry.repeatPatternStatus === "REPEATED_BLOCKED_ACTION" ? targetEntry.remediationAttempts : 0,
      latestAction: "SAVE_RECOVERY_CHECKPOINT" as const,
      latestAttemptAt: targetEntry.updatedAt,
      repeatPattern: {
        status: targetEntry.repeatPatternStatus,
        summary: targetEntry.repeatPatternSummary,
      },
    };
    const effectiveness = {
      pilotBasis: pilotReview.pilotBasis,
      latestOutcome: targetEntry.latestEffectiveness,
      latestSummary: targetEntry.effectivenessSummary,
      effectiveCount: targetEntry.latestEffectiveness === "EFFECTIVE" ? 1 : 0,
      partialCount: targetEntry.latestEffectiveness === "PARTIAL" ? 1 : 0,
      ineffectiveCount: targetEntry.latestEffectiveness === "INEFFECTIVE" ? 1 : 0,
      noSignalCount: targetEntry.latestEffectiveness === "NO_SIGNAL" ? 1 : 0,
      escalationNeeded: targetEntry.latestEffectiveness === "INEFFECTIVE",
      escalationSummary:
        targetEntry.latestEffectiveness === "INEFFECTIVE"
          ? "Stop retrying blindly and move this continuity workflow into explicit operator review."
          : "No escalation beyond bounded continuity workflow is currently needed.",
    };
    const sessionReview = buildRuntimeContinuityPilotSessionReview({
      recovery,
      calibration,
      analytics,
      effectiveness,
      pilotReview,
      cohortContext: {
        workspaceSizeBand: pilotReview.workspaceCohort.sizeBand,
        meetingShape: targetEntry.meetingShape,
        sessionDensityBand: targetEntry.sessionDensityBand,
        meetingFrequencyBand: targetEntry.meetingFrequencyBand,
        failureHistoryBand: targetEntry.failureHistoryBand,
        participantRolePosture: targetEntry.participantRolePosture,
      },
    });

    const subgroupPass =
      pilotReview.workspaceCohort.sizeBand === testCase.expected.workspaceSizeBand &&
      sessionReview.meetingShape === testCase.expected.targetMeetingShape &&
      sessionReview.sessionDensityBand === testCase.expected.targetSessionDensityBand &&
      sessionReview.meetingFrequencyBand === testCase.expected.targetMeetingFrequencyBand &&
      sessionReview.failureHistoryBand === testCase.expected.targetFailureHistoryBand &&
      sessionReview.participantRolePosture === testCase.expected.targetParticipantRolePosture &&
      sessionReview.riskBand === testCase.expected.targetRiskBand &&
      testCase.expected.subgroupIncludes.every((snippet) =>
        includesInAny(
          [
            pilotReview.subgroupCalibration.summary,
            ...pilotReview.subgroupCalibration.cohortHighlights,
            ...pilotReview.sessionDensityCohorts.flatMap((item) => [`${item.summary} ${item.calibrationSummary}`, item.driftSummary]),
            ...pilotReview.meetingFrequencyCohorts.flatMap((item) => [`${item.summary} ${item.calibrationSummary}`, item.driftSummary]),
            ...pilotReview.failureHistoryCohorts.flatMap((item) => [`${item.summary} ${item.varianceSummary}`]),
            ...pilotReview.participantRoleCohorts.flatMap((item) => [`${item.summary} ${item.calibrationSummary}`, item.driftSummary]),
            sessionReview.subgroupSummary,
          ],
          snippet,
        ),
      );
    const refinementPass = testCase.expected.refinementIncludes.every((snippet) =>
      includesInAny(
        [
          pilotReview.calibrationProfile.summary,
          pilotReview.subgroupCalibration.summary,
          ...pilotReview.subgroupCalibration.cohortHighlights,
          ...pilotReview.calibrationProfile.revisedHighlights,
          ...pilotReview.thresholdRevisions.map((item) => `${item.scopeType} ${item.scope} ${item.confidenceSummary} ${item.summary}`),
          sessionReview.refinedCalibrationSummary,
          sessionReview.thresholdRevisionSummary,
        ],
        snippet,
      ),
    );
    const driftSynthesisPass = testCase.expected.driftSynthesisIncludes.every((snippet) =>
      includesInAny(
        [
          pilotReview.drift.summary,
          pilotReview.driftSynthesis.summary,
          ...pilotReview.driftSynthesis.panels,
          ...pilotReview.drift.materiallyDriftingCohorts,
          sessionReview.driftSummary,
          sessionReview.longHorizonSummary,
          sessionReview.driftSynthesisSummary,
        ],
        snippet,
      ),
    );
    const sopSynthesisPass =
      pilotReview.operatorHandlingEffectiveness.stepReviews.some((item) => item.label === testCase.expected.targetStepLabel) &&
      testCase.expected.sopSynthesisIncludes.every((snippet) =>
        includesInAny(
          [
            pilotReview.operatorHandlingEffectiveness.summary,
            pilotReview.operatorHandlingEffectiveness.outcomeVarianceSummary,
            ...pilotReview.operatorHandlingEffectiveness.highlights,
            ...pilotReview.operatorHandlingEffectiveness.stepReviews.flatMap((item) => [
              `${item.label} ${item.summary}`,
              item.improvementHint,
            ]),
            pilotReview.sopEffectivenessSynthesis.summary,
            pilotReview.sopEffectivenessSynthesis.aggregateSummary,
            ...pilotReview.sopEffectivenessSynthesis.highlights,
            ...pilotReview.failureHistoryCohorts.map((item) => `${item.failureHistoryBand} ${item.varianceSummary}`),
            sessionReview.operatorHandlingSummary,
            sessionReview.varianceSummary,
            sessionReview.sopEffectivenessSummary,
          ],
          snippet,
        ),
      );
    const sessionReviewPass =
      sessionReview.workspaceSizeBand === testCase.expected.workspaceSizeBand &&
      sessionReview.meetingShape === testCase.expected.targetMeetingShape &&
      sessionReview.sessionDensityBand === testCase.expected.targetSessionDensityBand &&
      sessionReview.meetingFrequencyBand === testCase.expected.targetMeetingFrequencyBand &&
      sessionReview.failureHistoryBand === testCase.expected.targetFailureHistoryBand &&
      sessionReview.participantRolePosture === testCase.expected.targetParticipantRolePosture &&
      sessionReview.riskBand === testCase.expected.targetRiskBand &&
      Boolean(sessionReview.subgroupSummary) &&
      Boolean(sessionReview.refinedCalibrationSummary) &&
      Boolean(sessionReview.driftSynthesisSummary) &&
      Boolean(sessionReview.sopEffectivenessSummary);

    const failures: string[] = [];
    if (!subgroupPass) failures.push("fine-grained subgroup review regressed");
    if (!refinementPass) failures.push("deepened calibration refinement regressed");
    if (!driftSynthesisPass) failures.push("drift synthesis review regressed");
    if (!sopSynthesisPass) failures.push("SOP effectiveness synthesis regressed");
    if (!sessionReviewPass) failures.push("session-level deepened calibration review regressed");

    results.push({
      id: testCase.id,
      label: testCase.label,
      passed: failures.length === 0,
      failures,
      subgroupPass,
      refinementPass,
      driftSynthesisPass,
      sopSynthesisPass,
      sessionReviewPass,
    });
  }

  const passedCases = results.filter((item) => item.passed).length;

  return {
    totalCases: results.length,
    passedCases,
    passRate: toRate(passedCases, results.length),
    subgroupRate: toRate(results.filter((item) => item.subgroupPass).length, results.length),
    refinementRate: toRate(results.filter((item) => item.refinementPass).length, results.length),
    driftSynthesisRate: toRate(results.filter((item) => item.driftSynthesisPass).length, results.length),
    sopSynthesisRate: toRate(results.filter((item) => item.sopSynthesisPass).length, results.length),
    sessionReviewRate: toRate(results.filter((item) => item.sessionReviewPass).length, results.length),
    cases: results,
  };
}

export function runHelmV22ContinuityPilotReviewLongTermOutcomeCorrelationEvalHarness(): HelmV22ContinuityPilotReviewLongTermOutcomeCorrelationEvalSummary {
  const cases = loadContinuityPilotReviewLongTermOutcomeCorrelationGoldenCases();
  const results: HelmV22ContinuityPilotReviewLongTermOutcomeCorrelationEvalCaseResult[] = [];

  for (const testCase of cases) {
    const entries = testCase.queueEntries.map((item) => buildEvalContinuityPilotQueueEntry(item));
    const pilotReview = buildRuntimeContinuityPilotEffectivenessReview(entries, {
      workspaceSessionCount: testCase.workspaceSessionCount,
    });
    const targetEntry = entries.find((item) => item.failureTaxonomy === testCase.targetFailureTaxonomy) ?? entries[0];

    if (!targetEntry) {
      results.push({
        id: testCase.id,
        label: testCase.label,
        passed: false,
        failures: ["continuity pilot review long-term correlation fixture is missing a target continuity case"],
        sampleReviewPass: false,
        recalibrationPass: false,
        longTermOutcomePass: false,
        guidanceRefinementPass: false,
        sessionReviewPass: false,
      });
      continue;
    }

    const allowedActions: Array<"SAVE_RECOVERY_CHECKPOINT" | "RESUME_CHECKPOINT" | "REPRUNE_CONTEXT"> =
      targetEntry.recoveryState === "RECOVERABLE" ? ["RESUME_CHECKPOINT"] : [];

    const recovery = {
      state: targetEntry.recoveryState,
      failureTaxonomy: targetEntry.failureTaxonomy,
      summary: targetEntry.recoverySummary,
      operatorAction:
        targetEntry.recoveryState === "BLOCKED"
          ? "Do not continue bounded remediation from this surface."
          : targetEntry.recoveryState === "REVIEW_REQUIRED"
            ? "Pause remediation until protected fields are reviewed."
            : targetEntry.recoveryState === "RECOVERABLE"
              ? "Run the next bounded continuity remediation step."
              : "Monitor continuity posture.",
      allowedActions,
      reviewReasons:
        targetEntry.recoveryState === "REVIEW_REQUIRED"
          ? ["protected continuity fields still need review"]
          : [],
      blockedReasons:
        targetEntry.recoveryState === "BLOCKED"
          ? ["no recovery anchor exists yet"]
          : [],
      rollbackAnchor:
        targetEntry.failureTaxonomy === "NO_RECOVERY_ANCHOR"
          ? null
          : {
              checkpointId: "continuity_anchor",
              checkpointLabel: "continuity_anchor",
              checkpointStatus: "READY",
            },
    };
    const calibration = {
      pilotBasis: pilotReview.pilotBasis,
      rawState: targetEntry.recoveryState,
      calibratedState: targetEntry.recoveryState,
      confidence: targetEntry.calibrationConfidence,
      stateAdjusted: false,
      summary: targetEntry.calibrationSummary,
      reasons: [targetEntry.calibrationSummary],
    };
    const analytics = {
      totalAttempts: targetEntry.remediationAttempts,
      appliedCount:
        targetEntry.latestEffectiveness === "EFFECTIVE" ||
        targetEntry.latestEffectiveness === "PARTIAL" ||
        targetEntry.latestEffectiveness === "INEFFECTIVE"
          ? targetEntry.remediationAttempts
          : 0,
      reviewRequiredCount: targetEntry.repeatPatternStatus === "REPEATED_REVIEW_REQUIRED" ? targetEntry.remediationAttempts : 0,
      blockedCount: targetEntry.repeatPatternStatus === "REPEATED_BLOCKED_ACTION" ? targetEntry.remediationAttempts : 0,
      latestAction: "SAVE_RECOVERY_CHECKPOINT" as const,
      latestAttemptAt: targetEntry.updatedAt,
      repeatPattern: {
        status: targetEntry.repeatPatternStatus,
        summary: targetEntry.repeatPatternSummary,
      },
    };
    const effectiveness = {
      pilotBasis: pilotReview.pilotBasis,
      latestOutcome: targetEntry.latestEffectiveness,
      latestSummary: targetEntry.effectivenessSummary,
      effectiveCount: targetEntry.latestEffectiveness === "EFFECTIVE" ? 1 : 0,
      partialCount: targetEntry.latestEffectiveness === "PARTIAL" ? 1 : 0,
      ineffectiveCount: targetEntry.latestEffectiveness === "INEFFECTIVE" ? 1 : 0,
      noSignalCount: targetEntry.latestEffectiveness === "NO_SIGNAL" ? 1 : 0,
      escalationNeeded: targetEntry.latestEffectiveness === "INEFFECTIVE",
      escalationSummary:
        targetEntry.latestEffectiveness === "INEFFECTIVE"
          ? "Stop retrying blindly and move this continuity workflow into explicit operator review."
          : "No escalation beyond bounded continuity workflow is currently needed.",
    };
    const sessionReview = buildRuntimeContinuityPilotSessionReview({
      recovery,
      calibration,
      analytics,
      effectiveness,
      pilotReview,
      cohortContext: {
        workspaceSizeBand: pilotReview.workspaceCohort.sizeBand,
        meetingShape: targetEntry.meetingShape,
        sessionDensityBand: targetEntry.sessionDensityBand,
        meetingFrequencyBand: targetEntry.meetingFrequencyBand,
        failureHistoryBand: targetEntry.failureHistoryBand,
        participantRolePosture: targetEntry.participantRolePosture,
      },
    });

    const sampleReviewPass =
      pilotReview.workspaceCohort.sizeBand === testCase.expected.workspaceSizeBand &&
      sessionReview.meetingShape === testCase.expected.targetMeetingShape &&
      sessionReview.riskBand === testCase.expected.targetRiskBand &&
      testCase.expected.sampleReviewIncludes.every((snippet) =>
        includesInAny(
          [
            pilotReview.sampleReview.summary,
            pilotReview.sampleReview.aggregateSummary,
            ...pilotReview.sampleReview.cohortHighlights,
            ...pilotReview.thresholdRevisions.map((item) => `${item.scopeType} ${item.scope} ${item.sampleCoverageSummary}`),
            sessionReview.sampleCoverageSummary,
          ],
          snippet,
        ),
      );
    const recalibrationPass = testCase.expected.recalibrationIncludes.every((snippet) =>
      includesInAny(
        [
          pilotReview.calibrationProfile.summary,
          pilotReview.calibrationProfile.confidenceBandSummary,
          ...pilotReview.calibrationProfile.revisedHighlights,
          ...pilotReview.thresholdRevisions.map((item) => `${item.confidenceSummary} ${item.summary}`),
          sessionReview.refinedCalibrationSummary,
          sessionReview.thresholdRevisionSummary,
        ],
        snippet,
      ),
    );
    const longTermOutcomePass = testCase.expected.longTermOutcomeIncludes.every((snippet) =>
      includesInAny(
        [
          pilotReview.longTermOutcomeCorrelation.summary,
          pilotReview.longTermOutcomeCorrelation.aggregateSummary,
          ...pilotReview.longTermOutcomeCorrelation.panels,
          ...pilotReview.operatorHandlingEffectiveness.stepReviews.map((item) => `${item.label} ${item.correlationSummary}`),
          sessionReview.longTermOutcomeSummary,
        ],
        snippet,
      ),
    );
    const guidanceRefinementPass = testCase.expected.guidanceRefinementIncludes.every((snippet) =>
      includesInAny(
        [
          pilotReview.guidanceRefinement.summary,
          ...pilotReview.guidanceRefinement.highlights,
          ...pilotReview.operatorHandlingEffectiveness.stepReviews.flatMap((item) => [item.improvementHint, item.summary]),
          sessionReview.guidanceRefinementSummary,
          sessionReview.sopEffectivenessSummary,
        ],
        snippet,
      ),
    );
    const sessionReviewPass =
      sessionReview.workspaceSizeBand === testCase.expected.workspaceSizeBand &&
      sessionReview.meetingShape === testCase.expected.targetMeetingShape &&
      sessionReview.riskBand === testCase.expected.targetRiskBand &&
      Boolean(sessionReview.sampleCoverageBand) &&
      Boolean(sessionReview.outcomeCorrelationBand) &&
      testCase.expected.sessionReviewIncludes.every((snippet) =>
        includesInAny(
          [
            sessionReview.cohortSummary,
            sessionReview.sampleCoverageSummary,
            sessionReview.longTermOutcomeSummary,
            sessionReview.guidanceRefinementSummary,
            sessionReview.thresholdRevisionSummary,
          ],
          snippet,
        ),
      );

    const failures: string[] = [];
    if (!sampleReviewPass) failures.push("larger-sample subgroup review regressed");
    if (!recalibrationPass) failures.push("sample-aware threshold or confidence recalibration regressed");
    if (!longTermOutcomePass) failures.push("long-term outcome correlation review regressed");
    if (!guidanceRefinementPass) failures.push("SOP guidance refinement review regressed");
    if (!sessionReviewPass) failures.push("session-level long-term outcome review regressed");

    results.push({
      id: testCase.id,
      label: testCase.label,
      passed: failures.length === 0,
      failures,
      sampleReviewPass,
      recalibrationPass,
      longTermOutcomePass,
      guidanceRefinementPass,
      sessionReviewPass,
    });
  }

  const passedCases = results.filter((item) => item.passed).length;

  return {
    totalCases: results.length,
    passedCases,
    passRate: toRate(passedCases, results.length),
    sampleReviewRate: toRate(results.filter((item) => item.sampleReviewPass).length, results.length),
    recalibrationRate: toRate(results.filter((item) => item.recalibrationPass).length, results.length),
    longTermOutcomeRate: toRate(results.filter((item) => item.longTermOutcomePass).length, results.length),
    guidanceRefinementRate: toRate(results.filter((item) => item.guidanceRefinementPass).length, results.length),
    sessionReviewRate: toRate(results.filter((item) => item.sessionReviewPass).length, results.length),
    cases: results,
  };
}

export function runHelmV22ContinuityPilotStabilityReviewEvalHarness(): HelmV22ContinuityPilotStabilityReviewEvalSummary {
  const cases = loadContinuityPilotStabilityReviewGoldenCases();
  const results: HelmV22ContinuityPilotStabilityReviewEvalCaseResult[] = [];

  for (const testCase of cases) {
    const entries = testCase.queueEntries.map((item) => buildEvalContinuityPilotQueueEntry(item));
    const pilotReview = buildRuntimeContinuityPilotEffectivenessReview(entries, {
      workspaceSessionCount: testCase.workspaceSessionCount,
    });
    const targetEntry = entries.find((item) => item.failureTaxonomy === testCase.targetFailureTaxonomy) ?? entries[0];

    if (!targetEntry) {
      results.push({
        id: testCase.id,
        label: testCase.label,
        passed: false,
        failures: ["continuity pilot stability review fixture is missing a target continuity case"],
        stabilityPass: false,
        intervalPass: false,
        longTermImpactPass: false,
        guidanceAnalysisPass: false,
        sessionReviewPass: false,
      });
      continue;
    }

    const allowedActions: Array<"SAVE_RECOVERY_CHECKPOINT" | "RESUME_CHECKPOINT" | "REPRUNE_CONTEXT"> =
      targetEntry.recoveryState === "RECOVERABLE" ? ["RESUME_CHECKPOINT"] : [];

    const recovery = {
      state: targetEntry.recoveryState,
      failureTaxonomy: targetEntry.failureTaxonomy,
      summary: targetEntry.recoverySummary,
      operatorAction:
        targetEntry.recoveryState === "BLOCKED"
          ? "Do not continue bounded remediation from this surface."
          : targetEntry.recoveryState === "REVIEW_REQUIRED"
            ? "Pause remediation until protected fields are reviewed."
            : targetEntry.recoveryState === "RECOVERABLE"
              ? "Run the next bounded continuity remediation step."
              : "Monitor continuity posture.",
      allowedActions,
      reviewReasons:
        targetEntry.recoveryState === "REVIEW_REQUIRED"
          ? ["protected continuity fields still need review"]
          : [],
      blockedReasons:
        targetEntry.recoveryState === "BLOCKED"
          ? ["no recovery anchor exists yet"]
          : [],
      rollbackAnchor:
        targetEntry.failureTaxonomy === "NO_RECOVERY_ANCHOR"
          ? null
          : {
              checkpointId: "continuity_anchor",
              checkpointLabel: "continuity_anchor",
              checkpointStatus: "READY",
            },
    };
    const calibration = {
      pilotBasis: pilotReview.pilotBasis,
      rawState: targetEntry.recoveryState,
      calibratedState: targetEntry.recoveryState,
      confidence: targetEntry.calibrationConfidence,
      stateAdjusted: false,
      summary: targetEntry.calibrationSummary,
      reasons: [targetEntry.calibrationSummary],
    };
    const analytics = {
      totalAttempts: targetEntry.remediationAttempts,
      appliedCount:
        targetEntry.latestEffectiveness === "EFFECTIVE" ||
        targetEntry.latestEffectiveness === "PARTIAL" ||
        targetEntry.latestEffectiveness === "INEFFECTIVE"
          ? targetEntry.remediationAttempts
          : 0,
      reviewRequiredCount: targetEntry.repeatPatternStatus === "REPEATED_REVIEW_REQUIRED" ? targetEntry.remediationAttempts : 0,
      blockedCount: targetEntry.repeatPatternStatus === "REPEATED_BLOCKED_ACTION" ? targetEntry.remediationAttempts : 0,
      latestAction: "SAVE_RECOVERY_CHECKPOINT" as const,
      latestAttemptAt: targetEntry.updatedAt,
      repeatPattern: {
        status: targetEntry.repeatPatternStatus,
        summary: targetEntry.repeatPatternSummary,
      },
    };
    const effectiveness = {
      pilotBasis: pilotReview.pilotBasis,
      latestOutcome: targetEntry.latestEffectiveness,
      latestSummary: targetEntry.effectivenessSummary,
      effectiveCount: targetEntry.latestEffectiveness === "EFFECTIVE" ? 1 : 0,
      partialCount: targetEntry.latestEffectiveness === "PARTIAL" ? 1 : 0,
      ineffectiveCount: targetEntry.latestEffectiveness === "INEFFECTIVE" ? 1 : 0,
      noSignalCount: targetEntry.latestEffectiveness === "NO_SIGNAL" ? 1 : 0,
      escalationNeeded: targetEntry.latestEffectiveness === "INEFFECTIVE",
      escalationSummary:
        targetEntry.latestEffectiveness === "INEFFECTIVE"
          ? "Stop retrying blindly and move this continuity workflow into explicit operator review."
          : "No escalation beyond bounded continuity workflow is currently needed.",
    };
    const sessionReview = buildRuntimeContinuityPilotSessionReview({
      recovery,
      calibration,
      analytics,
      effectiveness,
      pilotReview,
      cohortContext: {
        workspaceSizeBand: pilotReview.workspaceCohort.sizeBand,
        meetingShape: targetEntry.meetingShape,
        sessionDensityBand: targetEntry.sessionDensityBand,
        meetingFrequencyBand: targetEntry.meetingFrequencyBand,
        failureHistoryBand: targetEntry.failureHistoryBand,
        participantRolePosture: targetEntry.participantRolePosture,
      },
    });

    const stabilityPass =
      pilotReview.workspaceCohort.sizeBand === testCase.expected.workspaceSizeBand &&
      sessionReview.meetingShape === testCase.expected.targetMeetingShape &&
      sessionReview.riskBand === testCase.expected.targetRiskBand &&
      sessionReview.stabilityBand === testCase.expected.targetStabilityBand &&
      testCase.expected.stabilityIncludes.every((snippet) =>
        includesInAny(
          [
            pilotReview.stabilityReview.summary,
            pilotReview.stabilityReview.aggregateSummary,
            ...pilotReview.stabilityReview.subgroupHighlights,
            ...pilotReview.cohortFamilies.map((item) => `${item.cohortKey} ${item.stabilitySummary}`),
            ...pilotReview.failureDistribution.map((item) => `${item.failureTaxonomy} ${item.stabilitySummary}`),
            sessionReview.stabilitySummary,
          ],
          snippet,
        ),
      );
    const intervalPass =
      sessionReview.confidenceInterval === testCase.expected.targetConfidenceInterval &&
      testCase.expected.intervalIncludes.every((snippet) =>
        includesInAny(
          [
            pilotReview.confidenceSimplification.summary,
            pilotReview.confidenceSimplification.aggregateSummary,
            ...pilotReview.confidenceSimplification.highlights,
            ...pilotReview.thresholdRevisions.map(
              (item) => `${item.scopeType} ${item.scope} ${item.confidenceInterval} ${item.bandAdjustmentRationale}`,
            ),
            sessionReview.confidenceAdjustmentRationale,
          ],
          snippet,
        ),
      );
    const longTermImpactPass = testCase.expected.longTermImpactIncludes.every((snippet) =>
      includesInAny(
        [
          pilotReview.longTermSopImpact.summary,
          pilotReview.longTermSopImpact.aggregateSummary,
          ...pilotReview.longTermSopImpact.highlights,
          ...pilotReview.operatorHandlingEffectiveness.stepReviews.map((item) => `${item.label} ${item.longTermImpactSummary}`),
          sessionReview.longTermSopImpactSummary,
          sessionReview.longTermOutcomeSummary,
        ],
        snippet,
      ),
    );
    const guidanceAnalysisPass = testCase.expected.guidanceAnalysisIncludes.every((snippet) =>
      includesInAny(
        [
          pilotReview.operatorHandlingEffectiveness.summary,
          pilotReview.operatorHandlingEffectiveness.outcomeVarianceSummary,
          ...pilotReview.operatorHandlingEffectiveness.highlights,
          ...pilotReview.operatorHandlingEffectiveness.stepReviews.flatMap((item) => [
            item.bandAdjustmentRationale,
            item.improvementHint,
            item.summary,
          ]),
          pilotReview.guidanceRefinement.summary,
          ...pilotReview.guidanceRefinement.highlights,
          sessionReview.guidanceRefinementSummary,
          sessionReview.sopEffectivenessSummary,
        ],
        snippet,
      ),
    );
    const sessionReviewPass =
      sessionReview.workspaceSizeBand === testCase.expected.workspaceSizeBand &&
      sessionReview.meetingShape === testCase.expected.targetMeetingShape &&
      sessionReview.riskBand === testCase.expected.targetRiskBand &&
      sessionReview.stabilityBand === testCase.expected.targetStabilityBand &&
      sessionReview.confidenceInterval === testCase.expected.targetConfidenceInterval &&
      testCase.expected.sessionReviewIncludes.every((snippet) =>
        includesInAny(
          [
            sessionReview.stabilitySummary,
            sessionReview.confidenceAdjustmentRationale,
            sessionReview.longTermSopImpactSummary,
            sessionReview.guidanceRefinementSummary,
            sessionReview.thresholdRevisionSummary,
          ],
          snippet,
        ),
      );

    const failures: string[] = [];
    if (!stabilityPass) failures.push("subgroup stability review regressed");
    if (!intervalPass) failures.push("confidence interval simplification regressed");
    if (!longTermImpactPass) failures.push("long-term SOP impact refinement regressed");
    if (!guidanceAnalysisPass) failures.push("operator guidance analysis regressed");
    if (!sessionReviewPass) failures.push("session-level PR32 pilot review regressed");

    results.push({
      id: testCase.id,
      label: testCase.label,
      passed: failures.length === 0,
      failures,
      stabilityPass,
      intervalPass,
      longTermImpactPass,
      guidanceAnalysisPass,
      sessionReviewPass,
    });
  }

  const passedCases = results.filter((item) => item.passed).length;

  return {
    totalCases: results.length,
    passedCases,
    passRate: toRate(passedCases, results.length),
    stabilityRate: toRate(results.filter((item) => item.stabilityPass).length, results.length),
    intervalRate: toRate(results.filter((item) => item.intervalPass).length, results.length),
    longTermImpactRate: toRate(results.filter((item) => item.longTermImpactPass).length, results.length),
    guidanceAnalysisRate: toRate(results.filter((item) => item.guidanceAnalysisPass).length, results.length),
    sessionReviewRate: toRate(results.filter((item) => item.sessionReviewPass).length, results.length),
    cases: results,
  };
}

export function runHelmV22ContinuityPilotStabilityRecheckEvalHarness(): HelmV22ContinuityPilotStabilityRecheckEvalSummary {
  const cases = loadContinuityPilotStabilityRecheckGoldenCases();
  const results: HelmV22ContinuityPilotStabilityRecheckEvalCaseResult[] = [];

  for (const testCase of cases) {
    const entries = testCase.queueEntries.map((item) => buildEvalContinuityPilotQueueEntry(item));
    const pilotReview = buildRuntimeContinuityPilotEffectivenessReview(entries, {
      workspaceSessionCount: testCase.workspaceSessionCount,
    });
    const targetEntry = entries.find((item) => item.failureTaxonomy === testCase.targetFailureTaxonomy) ?? entries[0];

    if (!targetEntry) {
      results.push({
        id: testCase.id,
        label: testCase.label,
        passed: false,
        failures: ["continuity pilot stability recheck fixture is missing a target continuity case"],
        stabilityRecheckPass: false,
        intervalWordingPass: false,
        longTermOutcomeReviewPass: false,
        outcomeVariancePass: false,
        sessionReviewPass: false,
      });
      continue;
    }

    const allowedActions: Array<"SAVE_RECOVERY_CHECKPOINT" | "RESUME_CHECKPOINT" | "REPRUNE_CONTEXT"> =
      targetEntry.recoveryState === "RECOVERABLE" ? ["RESUME_CHECKPOINT"] : [];

    const recovery = {
      state: targetEntry.recoveryState,
      failureTaxonomy: targetEntry.failureTaxonomy,
      summary: targetEntry.recoverySummary,
      operatorAction:
        targetEntry.recoveryState === "BLOCKED"
          ? "Do not continue bounded remediation from this surface."
          : targetEntry.recoveryState === "REVIEW_REQUIRED"
            ? "Pause remediation until protected fields are reviewed."
            : targetEntry.recoveryState === "RECOVERABLE"
              ? "Run the next bounded continuity remediation step."
              : "Monitor continuity posture.",
      allowedActions,
      reviewReasons:
        targetEntry.recoveryState === "REVIEW_REQUIRED"
          ? ["protected continuity fields still need review"]
          : [],
      blockedReasons:
        targetEntry.recoveryState === "BLOCKED"
          ? ["no recovery anchor exists yet"]
          : [],
      rollbackAnchor:
        targetEntry.failureTaxonomy === "NO_RECOVERY_ANCHOR"
          ? null
          : {
              checkpointId: "continuity_anchor",
              checkpointLabel: "continuity_anchor",
              checkpointStatus: "READY",
            },
    };
    const calibration = {
      pilotBasis: pilotReview.pilotBasis,
      rawState: targetEntry.recoveryState,
      calibratedState: targetEntry.recoveryState,
      confidence: targetEntry.calibrationConfidence,
      stateAdjusted: false,
      summary: targetEntry.calibrationSummary,
      reasons: [targetEntry.calibrationSummary],
    };
    const analytics = {
      totalAttempts: targetEntry.remediationAttempts,
      appliedCount:
        targetEntry.latestEffectiveness === "EFFECTIVE" ||
        targetEntry.latestEffectiveness === "PARTIAL" ||
        targetEntry.latestEffectiveness === "INEFFECTIVE"
          ? targetEntry.remediationAttempts
          : 0,
      reviewRequiredCount: targetEntry.repeatPatternStatus === "REPEATED_REVIEW_REQUIRED" ? targetEntry.remediationAttempts : 0,
      blockedCount: targetEntry.repeatPatternStatus === "REPEATED_BLOCKED_ACTION" ? targetEntry.remediationAttempts : 0,
      latestAction: "SAVE_RECOVERY_CHECKPOINT" as const,
      latestAttemptAt: targetEntry.updatedAt,
      repeatPattern: {
        status: targetEntry.repeatPatternStatus,
        summary: targetEntry.repeatPatternSummary,
      },
    };
    const effectiveness = {
      pilotBasis: pilotReview.pilotBasis,
      latestOutcome: targetEntry.latestEffectiveness,
      latestSummary: targetEntry.effectivenessSummary,
      effectiveCount: targetEntry.latestEffectiveness === "EFFECTIVE" ? 1 : 0,
      partialCount: targetEntry.latestEffectiveness === "PARTIAL" ? 1 : 0,
      ineffectiveCount: targetEntry.latestEffectiveness === "INEFFECTIVE" ? 1 : 0,
      noSignalCount: targetEntry.latestEffectiveness === "NO_SIGNAL" ? 1 : 0,
      escalationNeeded: targetEntry.latestEffectiveness === "INEFFECTIVE",
      escalationSummary:
        targetEntry.latestEffectiveness === "INEFFECTIVE"
          ? "Stop retrying blindly and move this continuity workflow into explicit operator review."
          : "No escalation beyond bounded continuity workflow is currently needed.",
    };
    const sessionReview = buildRuntimeContinuityPilotSessionReview({
      recovery,
      calibration,
      analytics,
      effectiveness,
      pilotReview,
      cohortContext: {
        workspaceSizeBand: pilotReview.workspaceCohort.sizeBand,
        meetingShape: targetEntry.meetingShape,
        sessionDensityBand: targetEntry.sessionDensityBand,
        meetingFrequencyBand: targetEntry.meetingFrequencyBand,
        failureHistoryBand: targetEntry.failureHistoryBand,
        participantRolePosture: targetEntry.participantRolePosture,
      },
    });

    const stabilityRecheckPass =
      pilotReview.workspaceCohort.sizeBand === testCase.expected.workspaceSizeBand &&
      sessionReview.meetingShape === testCase.expected.targetMeetingShape &&
      sessionReview.riskBand === testCase.expected.targetRiskBand &&
      sessionReview.stabilityBand === testCase.expected.targetStabilityBand &&
      sessionReview.stabilityConfidenceBand === testCase.expected.targetStabilityConfidenceBand &&
      testCase.expected.stabilityRecheckIncludes.every((snippet) =>
        includesInAny(
          [
            pilotReview.stabilityRecheck.summary,
            pilotReview.stabilityRecheck.aggregateSummary,
            ...pilotReview.stabilityRecheck.highlights,
            ...pilotReview.cohortFamilies.map((item) => `${item.cohortKey} ${item.stabilityVarianceSummary}`),
            ...pilotReview.failureDistribution.map((item) => `${item.failureTaxonomy} ${item.stabilityVarianceSummary}`),
            sessionReview.stabilityVarianceSummary,
          ],
          snippet,
        ),
      );
    const intervalWordingPass =
      sessionReview.confidenceInterval === testCase.expected.targetConfidenceInterval &&
      testCase.expected.intervalWordingIncludes.every((snippet) =>
        includesInAny(
          [
            pilotReview.intervalWordingConsistency.summary,
            pilotReview.intervalWordingConsistency.aggregateSummary,
            ...pilotReview.intervalWordingConsistency.highlights,
            ...pilotReview.thresholdRevisions.map(
              (item) => `${item.scopeType} ${item.scope} ${item.confidenceInterval} ${item.intervalWordingSummary} ${item.bandAdjustmentRationale}`,
            ),
            ...pilotReview.operatorHandlingEffectiveness.stepReviews.map(
              (item) => `${item.label} ${item.intervalWordingSummary} ${item.bandAdjustmentRationale}`,
            ),
            sessionReview.intervalWordingSummary,
            sessionReview.confidenceAdjustmentRationale,
          ],
          snippet,
        ),
      );
    const longTermOutcomeReviewPass =
      sessionReview.longTermMaterialImpactBand === testCase.expected.targetMaterialImpactBand &&
      testCase.expected.longTermOutcomeReviewIncludes.every((snippet) =>
        includesInAny(
          [
            pilotReview.longTermOutcomeReview.summary,
            pilotReview.longTermOutcomeReview.aggregateSummary,
            ...pilotReview.longTermOutcomeReview.highlights,
            ...pilotReview.operatorHandlingEffectiveness.stepReviews.flatMap((item) => [
              `${item.label} ${item.materialImpactSummary}`,
              `${item.label} ${item.longTermImpactSummary}`,
            ]),
            sessionReview.longTermMaterialImpactSummary,
            sessionReview.longTermOutcomeSummary,
          ],
          snippet,
        ),
      );
    const outcomeVariancePass = testCase.expected.outcomeVarianceIncludes.every((snippet) =>
      includesInAny(
        [
          pilotReview.operatorHandlingEffectiveness.summary,
          pilotReview.operatorHandlingEffectiveness.outcomeVarianceSummary,
          ...pilotReview.operatorHandlingEffectiveness.highlights,
          ...pilotReview.operatorHandlingEffectiveness.stepReviews.flatMap((item) => [
            item.summary,
            item.improvementHint,
            item.materialImpactSummary,
            item.intervalWordingSummary,
          ]),
          pilotReview.guidanceRefinement.summary,
          ...pilotReview.guidanceRefinement.highlights,
          sessionReview.varianceSummary,
          sessionReview.guidanceRefinementSummary,
        ],
        snippet,
      ),
    );
    const sessionReviewPass =
      sessionReview.workspaceSizeBand === testCase.expected.workspaceSizeBand &&
      sessionReview.meetingShape === testCase.expected.targetMeetingShape &&
      sessionReview.riskBand === testCase.expected.targetRiskBand &&
      sessionReview.stabilityBand === testCase.expected.targetStabilityBand &&
      sessionReview.stabilityConfidenceBand === testCase.expected.targetStabilityConfidenceBand &&
      sessionReview.confidenceInterval === testCase.expected.targetConfidenceInterval &&
      sessionReview.longTermMaterialImpactBand === testCase.expected.targetMaterialImpactBand &&
      testCase.expected.sessionReviewIncludes.every((snippet) =>
        includesInAny(
          [
            sessionReview.stabilitySummary,
            sessionReview.stabilityVarianceSummary,
            sessionReview.confidenceAdjustmentRationale,
            sessionReview.intervalWordingSummary,
            sessionReview.longTermOutcomeSummary,
            sessionReview.longTermSopImpactSummary,
            sessionReview.longTermMaterialImpactSummary,
            sessionReview.guidanceRefinementSummary,
            sessionReview.thresholdRevisionSummary,
          ],
          snippet,
        ),
      );

    const failures: string[] = [];
    if (!stabilityRecheckPass) failures.push("subgroup stability recheck regressed");
    if (!intervalWordingPass) failures.push("interval wording consistency regressed");
    if (!longTermOutcomeReviewPass) failures.push("long-term outcome review regressed");
    if (!outcomeVariancePass) failures.push("operator outcome variance synthesis regressed");
    if (!sessionReviewPass) failures.push("session-level PR33 pilot review regressed");

    results.push({
      id: testCase.id,
      label: testCase.label,
      passed: failures.length === 0,
      failures,
      stabilityRecheckPass,
      intervalWordingPass,
      longTermOutcomeReviewPass,
      outcomeVariancePass,
      sessionReviewPass,
    });
  }

  const passedCases = results.filter((item) => item.passed).length;

  return {
    totalCases: results.length,
    passedCases,
    passRate: toRate(passedCases, results.length),
    stabilityRecheckRate: toRate(results.filter((item) => item.stabilityRecheckPass).length, results.length),
    intervalWordingRate: toRate(results.filter((item) => item.intervalWordingPass).length, results.length),
    longTermOutcomeReviewRate: toRate(results.filter((item) => item.longTermOutcomeReviewPass).length, results.length),
    outcomeVarianceRate: toRate(results.filter((item) => item.outcomeVariancePass).length, results.length),
    sessionReviewRate: toRate(results.filter((item) => item.sessionReviewPass).length, results.length),
    cases: results,
  };
}

export function runHelmV22ContinuityPilotStabilityScaleUpEvalHarness(): HelmV22ContinuityPilotStabilityScaleUpEvalSummary {
  const cases = loadContinuityPilotStabilityScaleUpGoldenCases();
  const sourceCases = new Map(
    loadContinuityPilotStabilityRecheckGoldenCases().map((item) => [item.id, item] as const),
  );
  const results: HelmV22ContinuityPilotStabilityScaleUpEvalCaseResult[] = [];

  for (const testCase of cases) {
    const sourceCase = sourceCases.get(testCase.sourceCaseId);

    if (!sourceCase) {
      results.push({
        id: testCase.id,
        label: testCase.label,
        passed: false,
        failures: [`source continuity pilot stability recheck case is missing: ${testCase.sourceCaseId}`],
        stabilityScaleUpPass: false,
        intervalWordingDriftPass: false,
        longTermMaterialImpactReviewPass: false,
        sessionReviewPass: false,
      });
      continue;
    }

    const entries = sourceCase.queueEntries.map((item) => buildEvalContinuityPilotQueueEntry(item));
    const pilotReview = buildRuntimeContinuityPilotEffectivenessReview(entries, {
      workspaceSessionCount: sourceCase.workspaceSessionCount,
    });
    const targetEntry = entries.find((item) => item.failureTaxonomy === sourceCase.targetFailureTaxonomy) ?? entries[0];

    if (!targetEntry) {
      results.push({
        id: testCase.id,
        label: testCase.label,
        passed: false,
        failures: ["continuity pilot stability scale-up fixture is missing a target continuity case"],
        stabilityScaleUpPass: false,
        intervalWordingDriftPass: false,
        longTermMaterialImpactReviewPass: false,
        sessionReviewPass: false,
      });
      continue;
    }

    const allowedActions: Array<"SAVE_RECOVERY_CHECKPOINT" | "RESUME_CHECKPOINT" | "REPRUNE_CONTEXT"> =
      targetEntry.recoveryState === "RECOVERABLE" ? ["RESUME_CHECKPOINT"] : [];

    const recovery = {
      state: targetEntry.recoveryState,
      failureTaxonomy: targetEntry.failureTaxonomy,
      summary: targetEntry.recoverySummary,
      operatorAction:
        targetEntry.recoveryState === "BLOCKED"
          ? "Do not continue bounded remediation from this surface."
          : targetEntry.recoveryState === "REVIEW_REQUIRED"
            ? "Pause remediation until protected fields are reviewed."
            : targetEntry.recoveryState === "RECOVERABLE"
              ? "Run the next bounded continuity remediation step."
              : "Monitor continuity posture.",
      allowedActions,
      reviewReasons:
        targetEntry.recoveryState === "REVIEW_REQUIRED"
          ? ["protected continuity fields still need review"]
          : [],
      blockedReasons:
        targetEntry.recoveryState === "BLOCKED"
          ? ["no recovery anchor exists yet"]
          : [],
      rollbackAnchor:
        targetEntry.failureTaxonomy === "NO_RECOVERY_ANCHOR"
          ? null
          : {
              checkpointId: "continuity_anchor",
              checkpointLabel: "continuity_anchor",
              checkpointStatus: "READY",
            },
    };
    const calibration = {
      pilotBasis: pilotReview.pilotBasis,
      rawState: targetEntry.recoveryState,
      calibratedState: targetEntry.recoveryState,
      confidence: targetEntry.calibrationConfidence,
      stateAdjusted: false,
      summary: targetEntry.calibrationSummary,
      reasons: [targetEntry.calibrationSummary],
    };
    const analytics = {
      totalAttempts: targetEntry.remediationAttempts,
      appliedCount:
        targetEntry.latestEffectiveness === "EFFECTIVE" ||
        targetEntry.latestEffectiveness === "PARTIAL" ||
        targetEntry.latestEffectiveness === "INEFFECTIVE"
          ? targetEntry.remediationAttempts
          : 0,
      reviewRequiredCount: targetEntry.repeatPatternStatus === "REPEATED_REVIEW_REQUIRED" ? targetEntry.remediationAttempts : 0,
      blockedCount: targetEntry.repeatPatternStatus === "REPEATED_BLOCKED_ACTION" ? targetEntry.remediationAttempts : 0,
      latestAction: "SAVE_RECOVERY_CHECKPOINT" as const,
      latestAttemptAt: targetEntry.updatedAt,
      repeatPattern: {
        status: targetEntry.repeatPatternStatus,
        summary: targetEntry.repeatPatternSummary,
      },
    };
    const effectiveness = {
      pilotBasis: pilotReview.pilotBasis,
      latestOutcome: targetEntry.latestEffectiveness,
      latestSummary: targetEntry.effectivenessSummary,
      effectiveCount: targetEntry.latestEffectiveness === "EFFECTIVE" ? 1 : 0,
      partialCount: targetEntry.latestEffectiveness === "PARTIAL" ? 1 : 0,
      ineffectiveCount: targetEntry.latestEffectiveness === "INEFFECTIVE" ? 1 : 0,
      noSignalCount: targetEntry.latestEffectiveness === "NO_SIGNAL" ? 1 : 0,
      escalationNeeded: targetEntry.latestEffectiveness === "INEFFECTIVE",
      escalationSummary:
        targetEntry.latestEffectiveness === "INEFFECTIVE"
          ? "Stop retrying blindly and move this continuity workflow into explicit operator review."
          : "No escalation beyond bounded continuity workflow is currently needed.",
    };
    const sessionReview = buildRuntimeContinuityPilotSessionReview({
      recovery,
      calibration,
      analytics,
      effectiveness,
      pilotReview,
      cohortContext: {
        workspaceSizeBand: pilotReview.workspaceCohort.sizeBand,
        meetingShape: targetEntry.meetingShape,
        sessionDensityBand: targetEntry.sessionDensityBand,
        meetingFrequencyBand: targetEntry.meetingFrequencyBand,
        failureHistoryBand: targetEntry.failureHistoryBand,
        participantRolePosture: targetEntry.participantRolePosture,
      },
    });

    const stabilityScaleUpPass =
      pilotReview.workspaceCohort.sizeBand === testCase.expected.workspaceSizeBand &&
      sessionReview.meetingShape === testCase.expected.targetMeetingShape &&
      sessionReview.riskBand === testCase.expected.targetRiskBand &&
      sessionReview.stabilityBand === testCase.expected.targetStabilityBand &&
      sessionReview.stabilityConfidenceBand === testCase.expected.targetStabilityConfidenceBand &&
      testCase.expected.stabilityScaleUpIncludes.every((snippet) =>
        includesInAny(
          [
            pilotReview.stabilityScaleUp.summary,
            pilotReview.stabilityScaleUp.aggregateSummary,
            ...pilotReview.stabilityScaleUp.findings,
            ...pilotReview.meetingShapeCohorts.map((item) => `${item.meetingShape} ${item.stabilitySummary}`),
            ...pilotReview.failureDistribution.map((item) => `${item.failureTaxonomy} ${item.stabilityVarianceSummary}`),
            sessionReview.stabilityScaleUpSummary,
          ],
          snippet,
        ),
      );
    const intervalWordingDriftPass =
      sessionReview.confidenceInterval === testCase.expected.targetConfidenceInterval &&
      testCase.expected.intervalWordingDriftIncludes.every((snippet) =>
        includesInAny(
          [
            pilotReview.intervalWordingDriftAudit.summary,
            pilotReview.intervalWordingDriftAudit.aggregateSummary,
            ...pilotReview.intervalWordingDriftAudit.findings,
            ...pilotReview.thresholdRevisions.map(
              (item) => `${item.scopeType} ${item.scope} ${item.confidenceInterval} ${item.intervalWordingSummary} ${item.bandAdjustmentRationale}`,
            ),
            ...pilotReview.operatorHandlingEffectiveness.stepReviews.map(
              (item) => `${item.label} ${item.intervalWordingSummary} ${item.bandAdjustmentRationale}`,
            ),
            sessionReview.intervalWordingDriftSummary,
            sessionReview.intervalWordingSummary,
            sessionReview.confidenceAdjustmentRationale,
          ],
          snippet,
        ),
      );
    const longTermMaterialImpactReviewPass =
      sessionReview.longTermMaterialImpactBand === testCase.expected.targetMaterialImpactBand &&
      testCase.expected.longTermMaterialImpactReviewIncludes.every((snippet) =>
        includesInAny(
          [
            pilotReview.longTermMaterialImpactReview.summary,
            pilotReview.longTermMaterialImpactReview.aggregateSummary,
            ...pilotReview.longTermMaterialImpactReview.findings,
            ...pilotReview.operatorHandlingEffectiveness.stepReviews.flatMap((item) => [
              `${item.label} ${item.materialImpactSummary}`,
              `${item.label} ${item.longTermImpactSummary}`,
            ]),
            sessionReview.longTermMaterialImpactReviewSummary,
            sessionReview.longTermMaterialImpactSummary,
          ],
          snippet,
        ),
      );
    const sessionReviewPass =
      sessionReview.workspaceSizeBand === testCase.expected.workspaceSizeBand &&
      sessionReview.meetingShape === testCase.expected.targetMeetingShape &&
      sessionReview.riskBand === testCase.expected.targetRiskBand &&
      sessionReview.stabilityBand === testCase.expected.targetStabilityBand &&
      sessionReview.stabilityConfidenceBand === testCase.expected.targetStabilityConfidenceBand &&
      sessionReview.confidenceInterval === testCase.expected.targetConfidenceInterval &&
      sessionReview.longTermMaterialImpactBand === testCase.expected.targetMaterialImpactBand &&
      testCase.expected.sessionReviewIncludes.every((snippet) =>
        includesInAny(
          [
            sessionReview.stabilityScaleUpSummary,
            sessionReview.stabilityVarianceSummary,
            sessionReview.intervalWordingDriftSummary,
            sessionReview.intervalWordingSummary,
            sessionReview.longTermMaterialImpactReviewSummary,
            sessionReview.longTermMaterialImpactSummary,
            sessionReview.guidanceRefinementSummary,
          ],
          snippet,
        ),
      );

    const failures: string[] = [];
    if (!stabilityScaleUpPass) failures.push("subgroup stability scale-up regressed");
    if (!intervalWordingDriftPass) failures.push("interval wording drift audit regressed");
    if (!longTermMaterialImpactReviewPass) failures.push("long-term material impact review regressed");
    if (!sessionReviewPass) failures.push("session-level PR34 pilot review regressed");

    results.push({
      id: testCase.id,
      label: testCase.label,
      passed: failures.length === 0,
      failures,
      stabilityScaleUpPass,
      intervalWordingDriftPass,
      longTermMaterialImpactReviewPass,
      sessionReviewPass,
    });
  }

  const passedCases = results.filter((item) => item.passed).length;

  return {
    totalCases: results.length,
    passedCases,
    passRate: toRate(passedCases, results.length),
    stabilityScaleUpRate: toRate(results.filter((item) => item.stabilityScaleUpPass).length, results.length),
    intervalWordingDriftRate: toRate(results.filter((item) => item.intervalWordingDriftPass).length, results.length),
    longTermMaterialImpactReviewRate: toRate(
      results.filter((item) => item.longTermMaterialImpactReviewPass).length,
      results.length,
    ),
    sessionReviewRate: toRate(results.filter((item) => item.sessionReviewPass).length, results.length),
    cases: results,
  };
}

export function runHelmV22ContinuityPilotScaleUpRecheckEvalHarness(): HelmV22ContinuityPilotScaleUpRecheckEvalSummary {
  const cases = loadContinuityPilotScaleUpRecheckGoldenCases();
  const sourceScaleUpCases = new Map(
    loadContinuityPilotStabilityScaleUpGoldenCases().map((item) => [item.id, item] as const),
  );
  const sourceRecheckCases = new Map(
    loadContinuityPilotStabilityRecheckGoldenCases().map((item) => [item.id, item] as const),
  );
  const results: HelmV22ContinuityPilotScaleUpRecheckEvalCaseResult[] = [];

  for (const testCase of cases) {
    const sourceScaleUpCase = sourceScaleUpCases.get(testCase.sourceCaseId);
    const sourceCase = sourceScaleUpCase
      ? sourceRecheckCases.get(sourceScaleUpCase.sourceCaseId)
      : null;

    if (!sourceScaleUpCase || !sourceCase) {
      results.push({
        id: testCase.id,
        label: testCase.label,
        passed: false,
        failures: [
          `source continuity pilot scale-up case is missing: ${testCase.sourceCaseId}`,
        ],
        stabilityScaleUpRecheckPass: false,
        wordingDriftTrackingPass: false,
        intervalConsistencyGuidancePass: false,
        longTermMaterialImpactAuditPass: false,
        sessionReviewPass: false,
      });
      continue;
    }

    const entries = sourceCase.queueEntries.map((item) => buildEvalContinuityPilotQueueEntry(item));
    const pilotReview = buildRuntimeContinuityPilotEffectivenessReview(entries, {
      workspaceSessionCount: sourceCase.workspaceSessionCount,
    });
    const targetEntry = entries.find((item) => item.failureTaxonomy === sourceCase.targetFailureTaxonomy) ?? entries[0];

    if (!targetEntry) {
      results.push({
        id: testCase.id,
        label: testCase.label,
        passed: false,
        failures: ["continuity pilot scale-up recheck fixture is missing a target continuity case"],
        stabilityScaleUpRecheckPass: false,
        wordingDriftTrackingPass: false,
        intervalConsistencyGuidancePass: false,
        longTermMaterialImpactAuditPass: false,
        sessionReviewPass: false,
      });
      continue;
    }

    const allowedActions: Array<"SAVE_RECOVERY_CHECKPOINT" | "RESUME_CHECKPOINT" | "REPRUNE_CONTEXT"> =
      targetEntry.recoveryState === "RECOVERABLE" ? ["RESUME_CHECKPOINT"] : [];

    const recovery = {
      state: targetEntry.recoveryState,
      failureTaxonomy: targetEntry.failureTaxonomy,
      summary: targetEntry.recoverySummary,
      operatorAction:
        targetEntry.recoveryState === "BLOCKED"
          ? "Do not continue bounded remediation from this surface."
          : targetEntry.recoveryState === "REVIEW_REQUIRED"
            ? "Pause remediation until protected fields are reviewed."
            : targetEntry.recoveryState === "RECOVERABLE"
              ? "Run the next bounded continuity remediation step."
              : "Monitor continuity posture.",
      allowedActions,
      reviewReasons:
        targetEntry.recoveryState === "REVIEW_REQUIRED"
          ? ["protected continuity fields still need review"]
          : [],
      blockedReasons:
        targetEntry.recoveryState === "BLOCKED"
          ? ["no recovery anchor exists yet"]
          : [],
      rollbackAnchor:
        targetEntry.failureTaxonomy === "NO_RECOVERY_ANCHOR"
          ? null
          : {
              checkpointId: "continuity_anchor",
              checkpointLabel: "continuity_anchor",
              checkpointStatus: "READY",
            },
    };
    const calibration = {
      pilotBasis: pilotReview.pilotBasis,
      rawState: targetEntry.recoveryState,
      calibratedState: targetEntry.recoveryState,
      confidence: targetEntry.calibrationConfidence,
      stateAdjusted: false,
      summary: targetEntry.calibrationSummary,
      reasons: [targetEntry.calibrationSummary],
    };
    const analytics = {
      totalAttempts: targetEntry.remediationAttempts,
      appliedCount:
        targetEntry.latestEffectiveness === "EFFECTIVE" ||
        targetEntry.latestEffectiveness === "PARTIAL" ||
        targetEntry.latestEffectiveness === "INEFFECTIVE"
          ? targetEntry.remediationAttempts
          : 0,
      reviewRequiredCount: targetEntry.repeatPatternStatus === "REPEATED_REVIEW_REQUIRED" ? targetEntry.remediationAttempts : 0,
      blockedCount: targetEntry.repeatPatternStatus === "REPEATED_BLOCKED_ACTION" ? targetEntry.remediationAttempts : 0,
      latestAction: "SAVE_RECOVERY_CHECKPOINT" as const,
      latestAttemptAt: targetEntry.updatedAt,
      repeatPattern: {
        status: targetEntry.repeatPatternStatus,
        summary: targetEntry.repeatPatternSummary,
      },
    };
    const effectiveness = {
      pilotBasis: pilotReview.pilotBasis,
      latestOutcome: targetEntry.latestEffectiveness,
      latestSummary: targetEntry.effectivenessSummary,
      effectiveCount: targetEntry.latestEffectiveness === "EFFECTIVE" ? 1 : 0,
      partialCount: targetEntry.latestEffectiveness === "PARTIAL" ? 1 : 0,
      ineffectiveCount: targetEntry.latestEffectiveness === "INEFFECTIVE" ? 1 : 0,
      noSignalCount: targetEntry.latestEffectiveness === "NO_SIGNAL" ? 1 : 0,
      escalationNeeded: targetEntry.latestEffectiveness === "INEFFECTIVE",
      escalationSummary:
        targetEntry.latestEffectiveness === "INEFFECTIVE"
          ? "Stop retrying blindly and move this continuity workflow into explicit operator review."
          : "No escalation beyond bounded continuity workflow is currently needed.",
    };
    const sessionReview = buildRuntimeContinuityPilotSessionReview({
      recovery,
      calibration,
      analytics,
      effectiveness,
      pilotReview,
      cohortContext: {
        workspaceSizeBand: pilotReview.workspaceCohort.sizeBand,
        meetingShape: targetEntry.meetingShape,
        sessionDensityBand: targetEntry.sessionDensityBand,
        meetingFrequencyBand: targetEntry.meetingFrequencyBand,
        failureHistoryBand: targetEntry.failureHistoryBand,
        participantRolePosture: targetEntry.participantRolePosture,
      },
    });

    const stabilityScaleUpRecheckPass =
      pilotReview.workspaceCohort.sizeBand === testCase.expected.workspaceSizeBand &&
      sessionReview.meetingShape === testCase.expected.targetMeetingShape &&
      sessionReview.riskBand === testCase.expected.targetRiskBand &&
      sessionReview.stabilityBand === testCase.expected.targetStabilityBand &&
      sessionReview.stabilityConfidenceBand === testCase.expected.targetStabilityConfidenceBand &&
      testCase.expected.stabilityScaleUpRecheckIncludes.every((snippet) =>
        includesInAny(
          [
            pilotReview.stabilityScaleUpRecheck.summary,
            pilotReview.stabilityScaleUpRecheck.aggregateSummary,
            ...pilotReview.stabilityScaleUpRecheck.findings,
            sessionReview.stabilityScaleUpRecheckSummary,
            sessionReview.stabilityScaleUpSummary,
          ],
          snippet,
        ),
      );
    const wordingDriftTrackingPass =
      sessionReview.confidenceInterval === testCase.expected.targetConfidenceInterval &&
      pilotReview.wordingDriftTracking.driftRate === testCase.expected.targetWordingDriftRate &&
      testCase.expected.wordingDriftTrackingIncludes.every((snippet) =>
        includesInAny(
          [
            pilotReview.wordingDriftTracking.summary,
            pilotReview.wordingDriftTracking.aggregateSummary,
            ...pilotReview.wordingDriftTracking.findings,
            sessionReview.wordingDriftTrackingSummary,
            sessionReview.intervalWordingDriftSummary,
          ],
          snippet,
        ),
      );
    const intervalConsistencyGuidancePass =
      testCase.expected.intervalConsistencyGuidanceIncludes.every((snippet) =>
        includesInAny(
          [
            pilotReview.intervalConsistencyGuidance.summary,
            pilotReview.intervalConsistencyGuidance.aggregateSummary,
            ...pilotReview.intervalConsistencyGuidance.guidelines,
            sessionReview.intervalConsistencyGuidanceSummary,
            sessionReview.intervalWordingSummary,
          ],
          snippet,
        ),
      );
    const longTermMaterialImpactAuditPass =
      sessionReview.longTermMaterialImpactBand === testCase.expected.targetMaterialImpactBand &&
      testCase.expected.longTermMaterialImpactAuditIncludes.every((snippet) =>
        includesInAny(
          [
            pilotReview.longTermMaterialImpactAudit.summary,
            pilotReview.longTermMaterialImpactAudit.aggregateSummary,
            ...pilotReview.longTermMaterialImpactAudit.impactPatterns,
            ...pilotReview.longTermMaterialImpactAudit.optimizationHints,
            sessionReview.longTermMaterialImpactAuditSummary,
            sessionReview.longTermMaterialImpactSummary,
          ],
          snippet,
        ),
      );
    const sessionReviewPass =
      sessionReview.workspaceSizeBand === testCase.expected.workspaceSizeBand &&
      sessionReview.meetingShape === testCase.expected.targetMeetingShape &&
      sessionReview.riskBand === testCase.expected.targetRiskBand &&
      sessionReview.stabilityBand === testCase.expected.targetStabilityBand &&
      sessionReview.stabilityConfidenceBand === testCase.expected.targetStabilityConfidenceBand &&
      sessionReview.confidenceInterval === testCase.expected.targetConfidenceInterval &&
      sessionReview.longTermMaterialImpactBand === testCase.expected.targetMaterialImpactBand &&
      testCase.expected.sessionReviewIncludes.every((snippet) =>
        includesInAny(
          [
            sessionReview.stabilityScaleUpRecheckSummary,
            sessionReview.wordingDriftTrackingSummary,
            sessionReview.intervalConsistencyGuidanceSummary,
            sessionReview.longTermMaterialImpactAuditSummary,
            sessionReview.guidanceRefinementSummary,
          ],
          snippet,
        ),
      );

    const failures: string[] = [];
    if (!stabilityScaleUpRecheckPass) failures.push("subgroup scale-up recheck regressed");
    if (!wordingDriftTrackingPass) failures.push("wording drift tracking regressed");
    if (!intervalConsistencyGuidancePass) failures.push("interval consistency guidance regressed");
    if (!longTermMaterialImpactAuditPass) failures.push("long-term material impact audit regressed");
    if (!sessionReviewPass) failures.push("session-level PR35 pilot review regressed");

    results.push({
      id: testCase.id,
      label: testCase.label,
      passed: failures.length === 0,
      failures,
      stabilityScaleUpRecheckPass,
      wordingDriftTrackingPass,
      intervalConsistencyGuidancePass,
      longTermMaterialImpactAuditPass,
      sessionReviewPass,
    });
  }

  const passedCases = results.filter((item) => item.passed).length;

  return {
    totalCases: results.length,
    passedCases,
    passRate: toRate(passedCases, results.length),
    stabilityScaleUpRecheckRate: toRate(
      results.filter((item) => item.stabilityScaleUpRecheckPass).length,
      results.length,
    ),
    wordingDriftTrackingRate: toRate(
      results.filter((item) => item.wordingDriftTrackingPass).length,
      results.length,
    ),
    intervalConsistencyGuidanceRate: toRate(
      results.filter((item) => item.intervalConsistencyGuidancePass).length,
      results.length,
    ),
    longTermMaterialImpactAuditRate: toRate(
      results.filter((item) => item.longTermMaterialImpactAuditPass).length,
      results.length,
    ),
    sessionReviewRate: toRate(results.filter((item) => item.sessionReviewPass).length, results.length),
    cases: results,
  };
}

export function runHelmV22ContinuitySubgroupStabilityDriftAgingEvalHarness(): HelmV22ContinuitySubgroupStabilityDriftAgingEvalSummary {
  const cases = loadContinuitySubgroupStabilityDriftAgingGoldenCases();
  const sourceScaleUpRecheckCases = new Map(
    loadContinuityPilotScaleUpRecheckGoldenCases().map((item) => [item.id, item] as const),
  );
  const sourceScaleUpCases = new Map(
    loadContinuityPilotStabilityScaleUpGoldenCases().map((item) => [item.id, item] as const),
  );
  const sourceRecheckCases = new Map(
    loadContinuityPilotStabilityRecheckGoldenCases().map((item) => [item.id, item] as const),
  );
  const results: HelmV22ContinuitySubgroupStabilityDriftAgingEvalCaseResult[] = [];

  for (const testCase of cases) {
    const sourceScaleUpRecheckCase = sourceScaleUpRecheckCases.get(testCase.sourceCaseId);
    const sourceScaleUpCase = sourceScaleUpRecheckCase
      ? sourceScaleUpCases.get(sourceScaleUpRecheckCase.sourceCaseId)
      : null;
    const sourceCase = sourceScaleUpCase ? sourceRecheckCases.get(sourceScaleUpCase.sourceCaseId) : null;

    if (!sourceScaleUpRecheckCase || !sourceScaleUpCase || !sourceCase) {
      results.push({
        id: testCase.id,
        label: testCase.label,
        passed: false,
        failures: [
          `source continuity pilot scale-up recheck case is missing: ${testCase.sourceCaseId}`,
        ],
        subgroupStabilityDriftPass: false,
        intervalWordingAgingPass: false,
        materialImpactPatternAgingPass: false,
        sessionReviewPass: false,
      });
      continue;
    }

    const entries = sourceCase.queueEntries.map((item) => buildEvalContinuityPilotQueueEntry(item));
    const pilotReview = buildRuntimeContinuityPilotEffectivenessReview(entries, {
      workspaceSessionCount: sourceCase.workspaceSessionCount,
    });
    const targetEntry = entries.find((item) => item.failureTaxonomy === sourceCase.targetFailureTaxonomy) ?? entries[0];

    if (!targetEntry) {
      results.push({
        id: testCase.id,
        label: testCase.label,
        passed: false,
        failures: ["continuity subgroup stability drift fixture is missing a target continuity case"],
        subgroupStabilityDriftPass: false,
        intervalWordingAgingPass: false,
        materialImpactPatternAgingPass: false,
        sessionReviewPass: false,
      });
      continue;
    }

    const allowedActions: Array<"SAVE_RECOVERY_CHECKPOINT" | "RESUME_CHECKPOINT" | "REPRUNE_CONTEXT"> =
      targetEntry.recoveryState === "RECOVERABLE" ? ["RESUME_CHECKPOINT"] : [];

    const recovery = {
      state: targetEntry.recoveryState,
      failureTaxonomy: targetEntry.failureTaxonomy,
      summary: targetEntry.recoverySummary,
      operatorAction:
        targetEntry.recoveryState === "BLOCKED"
          ? "Do not continue bounded remediation from this surface."
          : targetEntry.recoveryState === "REVIEW_REQUIRED"
            ? "Pause remediation until protected fields are reviewed."
            : targetEntry.recoveryState === "RECOVERABLE"
              ? "Run the next bounded continuity remediation step."
              : "Monitor continuity posture.",
      allowedActions,
      reviewReasons:
        targetEntry.recoveryState === "REVIEW_REQUIRED"
          ? ["protected continuity fields still need review"]
          : [],
      blockedReasons:
        targetEntry.recoveryState === "BLOCKED"
          ? ["no recovery anchor exists yet"]
          : [],
      rollbackAnchor:
        targetEntry.failureTaxonomy === "NO_RECOVERY_ANCHOR"
          ? null
          : {
              checkpointId: "continuity_anchor",
              checkpointLabel: "continuity_anchor",
              checkpointStatus: "READY",
            },
    };
    const calibration = {
      pilotBasis: pilotReview.pilotBasis,
      rawState: targetEntry.recoveryState,
      calibratedState: targetEntry.recoveryState,
      confidence: targetEntry.calibrationConfidence,
      stateAdjusted: false,
      summary: targetEntry.calibrationSummary,
      reasons: [targetEntry.calibrationSummary],
    };
    const analytics = {
      totalAttempts: targetEntry.remediationAttempts,
      appliedCount:
        targetEntry.latestEffectiveness === "EFFECTIVE" ||
        targetEntry.latestEffectiveness === "PARTIAL" ||
        targetEntry.latestEffectiveness === "INEFFECTIVE"
          ? targetEntry.remediationAttempts
          : 0,
      reviewRequiredCount: targetEntry.repeatPatternStatus === "REPEATED_REVIEW_REQUIRED" ? targetEntry.remediationAttempts : 0,
      blockedCount: targetEntry.repeatPatternStatus === "REPEATED_BLOCKED_ACTION" ? targetEntry.remediationAttempts : 0,
      latestAction: "SAVE_RECOVERY_CHECKPOINT" as const,
      latestAttemptAt: targetEntry.updatedAt,
      repeatPattern: {
        status: targetEntry.repeatPatternStatus,
        summary: targetEntry.repeatPatternSummary,
      },
    };
    const effectiveness = {
      pilotBasis: pilotReview.pilotBasis,
      latestOutcome: targetEntry.latestEffectiveness,
      latestSummary: targetEntry.effectivenessSummary,
      effectiveCount: targetEntry.latestEffectiveness === "EFFECTIVE" ? 1 : 0,
      partialCount: targetEntry.latestEffectiveness === "PARTIAL" ? 1 : 0,
      ineffectiveCount: targetEntry.latestEffectiveness === "INEFFECTIVE" ? 1 : 0,
      noSignalCount: targetEntry.latestEffectiveness === "NO_SIGNAL" ? 1 : 0,
      escalationNeeded: targetEntry.latestEffectiveness === "INEFFECTIVE",
      escalationSummary:
        targetEntry.latestEffectiveness === "INEFFECTIVE"
          ? "Stop retrying blindly and move this continuity workflow into explicit operator review."
          : "No escalation beyond bounded continuity workflow is currently needed.",
    };
    const sessionReview = buildRuntimeContinuityPilotSessionReview({
      recovery,
      calibration,
      analytics,
      effectiveness,
      pilotReview,
      cohortContext: {
        workspaceSizeBand: pilotReview.workspaceCohort.sizeBand,
        meetingShape: targetEntry.meetingShape,
        sessionDensityBand: targetEntry.sessionDensityBand,
        meetingFrequencyBand: targetEntry.meetingFrequencyBand,
        failureHistoryBand: targetEntry.failureHistoryBand,
        participantRolePosture: targetEntry.participantRolePosture,
      },
    });

    const subgroupStabilityDriftPass =
      pilotReview.workspaceCohort.sizeBand === testCase.expected.workspaceSizeBand &&
      sessionReview.meetingShape === testCase.expected.targetMeetingShape &&
      sessionReview.riskBand === testCase.expected.targetRiskBand &&
      sessionReview.stabilityBand === testCase.expected.targetStabilityBand &&
      sessionReview.stabilityConfidenceBand === testCase.expected.targetStabilityConfidenceBand &&
      testCase.expected.subgroupStabilityDriftIncludes.every((snippet) =>
        includesInAny(
          [
            pilotReview.subgroupStabilityDriftReview.summary,
            pilotReview.subgroupStabilityDriftReview.aggregateSummary,
            ...pilotReview.subgroupStabilityDriftReview.findings,
            sessionReview.subgroupStabilityDriftSummary,
          ],
          snippet,
        ),
      );
    const intervalWordingAgingPass =
      sessionReview.confidenceInterval === testCase.expected.targetConfidenceInterval &&
      pilotReview.intervalWordingAgingAudit.regressionRate ===
        testCase.expected.targetIntervalWordingRegressionRate &&
      testCase.expected.intervalWordingAgingIncludes.every((snippet) =>
        includesInAny(
          [
            pilotReview.intervalWordingAgingAudit.summary,
            pilotReview.intervalWordingAgingAudit.aggregateSummary,
            ...pilotReview.intervalWordingAgingAudit.findings,
            sessionReview.intervalWordingAgingSummary,
            sessionReview.intervalWordingSummary,
          ],
          snippet,
        ),
      );
    const materialImpactPatternAgingPass =
      sessionReview.longTermMaterialImpactBand === testCase.expected.targetMaterialImpactBand &&
      testCase.expected.materialImpactPatternAgingIncludes.every((snippet) =>
        includesInAny(
          [
            pilotReview.materialImpactPatternAgingReview.summary,
            pilotReview.materialImpactPatternAgingReview.aggregateSummary,
            ...pilotReview.materialImpactPatternAgingReview.patterns,
            ...pilotReview.materialImpactPatternAgingReview.optimizationHints,
            sessionReview.materialImpactPatternAgingSummary,
            sessionReview.longTermMaterialImpactSummary,
          ],
          snippet,
        ),
      );
    const sessionReviewPass =
      sessionReview.workspaceSizeBand === testCase.expected.workspaceSizeBand &&
      sessionReview.meetingShape === testCase.expected.targetMeetingShape &&
      sessionReview.riskBand === testCase.expected.targetRiskBand &&
      sessionReview.stabilityBand === testCase.expected.targetStabilityBand &&
      sessionReview.stabilityConfidenceBand === testCase.expected.targetStabilityConfidenceBand &&
      sessionReview.confidenceInterval === testCase.expected.targetConfidenceInterval &&
      sessionReview.longTermMaterialImpactBand === testCase.expected.targetMaterialImpactBand &&
      testCase.expected.sessionReviewIncludes.every((snippet) =>
        includesInAny(
          [
            sessionReview.subgroupStabilityDriftSummary,
            sessionReview.intervalWordingAgingSummary,
            sessionReview.materialImpactPatternAgingSummary,
            sessionReview.guidanceRefinementSummary,
          ],
          snippet,
        ),
      );

    const failures: string[] = [];
    if (!subgroupStabilityDriftPass) failures.push("subgroup stability drift review regressed");
    if (!intervalWordingAgingPass) failures.push("interval wording aging audit regressed");
    if (!materialImpactPatternAgingPass) failures.push("material impact pattern aging review regressed");
    if (!sessionReviewPass) failures.push("session-level PR36 pilot review regressed");

    results.push({
      id: testCase.id,
      label: testCase.label,
      passed: failures.length === 0,
      failures,
      subgroupStabilityDriftPass,
      intervalWordingAgingPass,
      materialImpactPatternAgingPass,
      sessionReviewPass,
    });
  }

  const passedCases = results.filter((item) => item.passed).length;

  return {
    totalCases: results.length,
    passedCases,
    passRate: toRate(passedCases, results.length),
    subgroupStabilityDriftRate: toRate(
      results.filter((item) => item.subgroupStabilityDriftPass).length,
      results.length,
    ),
    intervalWordingAgingRate: toRate(
      results.filter((item) => item.intervalWordingAgingPass).length,
      results.length,
    ),
    materialImpactPatternAgingRate: toRate(
      results.filter((item) => item.materialImpactPatternAgingPass).length,
      results.length,
    ),
    sessionReviewRate: toRate(results.filter((item) => item.sessionReviewPass).length, results.length),
    cases: results,
  };
}

export function runHelmV22ContinuitySubgroupDriftCohortAgingImpactReviewEvalHarness(): HelmV22ContinuitySubgroupDriftCohortAgingImpactEvalSummary {
  const cases = loadContinuitySubgroupDriftCohortAgingImpactGoldenCases();
  const phase16CaseMap = new Map(
    loadContinuitySubgroupStabilityDriftAgingGoldenCases().map((item) => [item.id, item] as const),
  );
  const phase15CaseMap = new Map(
    loadContinuityPilotScaleUpRecheckGoldenCases().map((item) => [item.id, item] as const),
  );
  const phase14CaseMap = new Map(
    loadContinuityPilotStabilityScaleUpGoldenCases().map((item) => [item.id, item] as const),
  );
  const phase12CaseMap = new Map(
    loadContinuityPilotStabilityRecheckGoldenCases().map((item) => [item.id, item] as const),
  );
  const results: HelmV22ContinuitySubgroupDriftCohortAgingImpactEvalCaseResult[] = [];

  for (const testCase of cases) {
    const phase16Case = phase16CaseMap.get(testCase.sourceCaseId);
    if (!phase16Case) {
      results.push({
        id: testCase.id,
        label: testCase.label,
        passed: false,
        failures: ["continuity subgroup drift cohort aging fixture is missing a PR36 source case"],
        subgroupCohortAgingPass: false,
        intervalWordingRegressionPass: false,
        materialImpactSamplingPass: false,
        sessionReviewPass: false,
      });
      continue;
    }

    const phase15Case = phase15CaseMap.get(phase16Case.sourceCaseId);
    const phase14Case = phase15Case ? phase14CaseMap.get(phase15Case.sourceCaseId) : null;
    const phase12Case = phase14Case ? phase12CaseMap.get(phase14Case.sourceCaseId) : null;
    if (!phase15Case || !phase14Case || !phase12Case) {
      results.push({
        id: testCase.id,
        label: testCase.label,
        passed: false,
        failures: ["continuity subgroup drift cohort aging fixture is missing a prior continuity source case"],
        subgroupCohortAgingPass: false,
        intervalWordingRegressionPass: false,
        materialImpactSamplingPass: false,
        sessionReviewPass: false,
      });
      continue;
    }

    const entries = phase12Case.queueEntries.map((item) => buildEvalContinuityPilotQueueEntry(item));
    const pilotReview = buildRuntimeContinuityPilotEffectivenessReview(entries, {
      workspaceSessionCount: phase12Case.workspaceSessionCount,
    });
    const targetEntry =
      entries.find((item) => item.failureTaxonomy === phase12Case.targetFailureTaxonomy) ?? entries[0];

    if (!targetEntry) {
      results.push({
        id: testCase.id,
        label: testCase.label,
        passed: false,
        failures: ["continuity subgroup drift cohort aging fixture is missing a target continuity case"],
        subgroupCohortAgingPass: false,
        intervalWordingRegressionPass: false,
        materialImpactSamplingPass: false,
        sessionReviewPass: false,
      });
      continue;
    }

    const allowedActions: Array<"SAVE_RECOVERY_CHECKPOINT" | "RESUME_CHECKPOINT" | "REPRUNE_CONTEXT"> =
      targetEntry.recoveryState === "RECOVERABLE" ? ["RESUME_CHECKPOINT"] : [];

    const recovery = {
      state: targetEntry.recoveryState,
      failureTaxonomy: targetEntry.failureTaxonomy,
      summary: targetEntry.recoverySummary,
      operatorAction:
        targetEntry.recoveryState === "BLOCKED"
          ? "Do not continue bounded remediation from this surface."
          : targetEntry.recoveryState === "REVIEW_REQUIRED"
            ? "Pause remediation until protected fields are reviewed."
            : targetEntry.recoveryState === "RECOVERABLE"
              ? "Run the next bounded continuity remediation step."
              : "Monitor continuity posture.",
      allowedActions,
      reviewReasons:
        targetEntry.recoveryState === "REVIEW_REQUIRED"
          ? ["protected continuity fields still need review"]
          : [],
      blockedReasons:
        targetEntry.recoveryState === "BLOCKED"
          ? ["no recovery anchor exists yet"]
          : [],
      rollbackAnchor:
        targetEntry.failureTaxonomy === "NO_RECOVERY_ANCHOR"
          ? null
          : {
              checkpointId: "continuity_anchor",
              checkpointLabel: "continuity_anchor",
              checkpointStatus: "READY",
            },
    };
    const calibration = {
      pilotBasis: pilotReview.pilotBasis,
      rawState: targetEntry.recoveryState,
      calibratedState: targetEntry.recoveryState,
      confidence: targetEntry.calibrationConfidence,
      stateAdjusted: false,
      summary: targetEntry.calibrationSummary,
      reasons: [targetEntry.calibrationSummary],
    };
    const analytics = {
      totalAttempts: targetEntry.remediationAttempts,
      appliedCount:
        targetEntry.latestEffectiveness === "EFFECTIVE" ||
        targetEntry.latestEffectiveness === "PARTIAL" ||
        targetEntry.latestEffectiveness === "INEFFECTIVE"
          ? targetEntry.remediationAttempts
          : 0,
      reviewRequiredCount:
        targetEntry.repeatPatternStatus === "REPEATED_REVIEW_REQUIRED" ? targetEntry.remediationAttempts : 0,
      blockedCount:
        targetEntry.repeatPatternStatus === "REPEATED_BLOCKED_ACTION" ? targetEntry.remediationAttempts : 0,
      latestAction: "SAVE_RECOVERY_CHECKPOINT" as const,
      latestAttemptAt: targetEntry.updatedAt,
      repeatPattern: {
        status: targetEntry.repeatPatternStatus,
        summary: targetEntry.repeatPatternSummary,
      },
    };
    const effectiveness = {
      pilotBasis: pilotReview.pilotBasis,
      latestOutcome: targetEntry.latestEffectiveness,
      latestSummary: targetEntry.effectivenessSummary,
      effectiveCount: targetEntry.latestEffectiveness === "EFFECTIVE" ? 1 : 0,
      partialCount: targetEntry.latestEffectiveness === "PARTIAL" ? 1 : 0,
      ineffectiveCount: targetEntry.latestEffectiveness === "INEFFECTIVE" ? 1 : 0,
      noSignalCount: targetEntry.latestEffectiveness === "NO_SIGNAL" ? 1 : 0,
      escalationNeeded: targetEntry.latestEffectiveness === "INEFFECTIVE",
      escalationSummary:
        targetEntry.latestEffectiveness === "INEFFECTIVE"
          ? "Stop retrying blindly and move this continuity workflow into explicit operator review."
          : "No escalation beyond bounded continuity workflow is currently needed.",
    };
    const sessionReview = buildRuntimeContinuityPilotSessionReview({
      recovery,
      calibration,
      analytics,
      effectiveness,
      pilotReview,
      cohortContext: {
        workspaceSizeBand: pilotReview.workspaceCohort.sizeBand,
        meetingShape: targetEntry.meetingShape,
        sessionDensityBand: targetEntry.sessionDensityBand,
        meetingFrequencyBand: targetEntry.meetingFrequencyBand,
        failureHistoryBand: targetEntry.failureHistoryBand,
        participantRolePosture: targetEntry.participantRolePosture,
      },
    });

    const subgroupCohortAgingPass =
      pilotReview.workspaceCohort.sizeBand === testCase.expected.workspaceSizeBand &&
      sessionReview.meetingShape === testCase.expected.targetMeetingShape &&
      sessionReview.riskBand === testCase.expected.targetRiskBand &&
      sessionReview.stabilityBand === testCase.expected.targetStabilityBand &&
      sessionReview.stabilityConfidenceBand === testCase.expected.targetStabilityConfidenceBand &&
      testCase.expected.subgroupCohortAgingIncludes.every((snippet) =>
        includesInAny(
          [
            pilotReview.subgroupCohortAgingReview.summary,
            pilotReview.subgroupCohortAgingReview.aggregateSummary,
            ...pilotReview.subgroupCohortAgingReview.findings,
            sessionReview.subgroupCohortAgingSummary,
          ],
          snippet,
        ),
      );
    const intervalWordingRegressionPass =
      sessionReview.confidenceInterval === testCase.expected.targetConfidenceInterval &&
      pilotReview.intervalWordingCrossSurfaceRegressionReview.regressionRate ===
        testCase.expected.targetIntervalWordingRegressionRate &&
      testCase.expected.intervalWordingRegressionIncludes.every((snippet) =>
        includesInAny(
          [
            pilotReview.intervalWordingCrossSurfaceRegressionReview.summary,
            pilotReview.intervalWordingCrossSurfaceRegressionReview.aggregateSummary,
            ...pilotReview.intervalWordingCrossSurfaceRegressionReview.findings,
            ...pilotReview.intervalWordingCrossSurfaceRegressionReview.adjustmentRecommendations,
            sessionReview.intervalWordingRegressionSummary,
            sessionReview.intervalWordingSummary,
          ],
          snippet,
        ),
      );
    const materialImpactSamplingPass =
      sessionReview.longTermMaterialImpactBand === testCase.expected.targetMaterialImpactBand &&
      testCase.expected.materialImpactSamplingIncludes.every((snippet) =>
        includesInAny(
          [
            pilotReview.materialImpactSamplingReview.summary,
            pilotReview.materialImpactSamplingReview.aggregateSummary,
            ...pilotReview.materialImpactSamplingReview.findings,
            ...pilotReview.materialImpactSamplingReview.optimizationHints,
            sessionReview.materialImpactSamplingSummary,
            sessionReview.longTermMaterialImpactSummary,
          ],
          snippet,
        ),
      );
    const sessionReviewPass =
      sessionReview.workspaceSizeBand === testCase.expected.workspaceSizeBand &&
      sessionReview.meetingShape === testCase.expected.targetMeetingShape &&
      sessionReview.riskBand === testCase.expected.targetRiskBand &&
      sessionReview.stabilityBand === testCase.expected.targetStabilityBand &&
      sessionReview.stabilityConfidenceBand === testCase.expected.targetStabilityConfidenceBand &&
      sessionReview.confidenceInterval === testCase.expected.targetConfidenceInterval &&
      sessionReview.longTermMaterialImpactBand === testCase.expected.targetMaterialImpactBand &&
      testCase.expected.sessionReviewIncludes.every((snippet) =>
        includesInAny(
          [
            sessionReview.subgroupCohortAgingSummary,
            sessionReview.intervalWordingRegressionSummary,
            sessionReview.materialImpactSamplingSummary,
            sessionReview.guidanceRefinementSummary,
          ],
          snippet,
        ),
      );

    const failures: string[] = [];
    if (!subgroupCohortAgingPass) failures.push("subgroup cohort aging review regressed");
    if (!intervalWordingRegressionPass) failures.push("interval wording regression review regressed");
    if (!materialImpactSamplingPass) failures.push("material impact sampling review regressed");
    if (!sessionReviewPass) failures.push("session-level PR37 pilot review regressed");

    results.push({
      id: testCase.id,
      label: testCase.label,
      passed: failures.length === 0,
      failures,
      subgroupCohortAgingPass,
      intervalWordingRegressionPass,
      materialImpactSamplingPass,
      sessionReviewPass,
    });
  }

  const passedCases = results.filter((item) => item.passed).length;
  return {
    totalCases: results.length,
    passedCases,
    passRate: toRate(passedCases, results.length),
    subgroupCohortAgingRate: toRate(
      results.filter((item) => item.subgroupCohortAgingPass).length,
      results.length,
    ),
    intervalWordingRegressionRate: toRate(
      results.filter((item) => item.intervalWordingRegressionPass).length,
      results.length,
    ),
    materialImpactSamplingRate: toRate(
      results.filter((item) => item.materialImpactSamplingPass).length,
      results.length,
    ),
    sessionReviewRate: toRate(results.filter((item) => item.sessionReviewPass).length, results.length),
    cases: results,
  };
}

export function runHelmV22ContinuitySubgroupDriftAgingMaterialImpactAuditEvalHarness(): HelmV22ContinuitySubgroupDriftAgingMaterialImpactAuditEvalSummary {
  const cases = loadContinuitySubgroupDriftAgingMaterialImpactAuditGoldenCases();
  const phase17CaseMap = new Map(
    loadContinuitySubgroupDriftCohortAgingImpactGoldenCases().map((item) => [item.id, item] as const),
  );
  const phase16CaseMap = new Map(
    loadContinuitySubgroupStabilityDriftAgingGoldenCases().map((item) => [item.id, item] as const),
  );
  const phase15CaseMap = new Map(
    loadContinuityPilotScaleUpRecheckGoldenCases().map((item) => [item.id, item] as const),
  );
  const phase14CaseMap = new Map(
    loadContinuityPilotStabilityScaleUpGoldenCases().map((item) => [item.id, item] as const),
  );
  const phase12CaseMap = new Map(
    loadContinuityPilotStabilityRecheckGoldenCases().map((item) => [item.id, item] as const),
  );
  const results: HelmV22ContinuitySubgroupDriftAgingMaterialImpactAuditEvalCaseResult[] = [];

  for (const testCase of cases) {
    const phase17Case = phase17CaseMap.get(testCase.sourceCaseId);
    const phase16Case = phase17Case ? phase16CaseMap.get(phase17Case.sourceCaseId) : null;
    const phase15Case = phase16Case ? phase15CaseMap.get(phase16Case.sourceCaseId) : null;
    const phase14Case = phase15Case ? phase14CaseMap.get(phase15Case.sourceCaseId) : null;
    const phase12Case = phase14Case ? phase12CaseMap.get(phase14Case.sourceCaseId) : null;

    if (!phase17Case || !phase16Case || !phase15Case || !phase14Case || !phase12Case) {
      results.push({
        id: testCase.id,
        label: testCase.label,
        passed: false,
        failures: ["continuity subgroup drift aging fixture is missing a prior continuity source case"],
        subgroupDriftAgingPass: false,
        intervalWordingConsistencyPass: false,
        materialImpactSamplingAgingPass: false,
        sessionReviewPass: false,
      });
      continue;
    }

    const entries = phase12Case.queueEntries.map((item) => buildEvalContinuityPilotQueueEntry(item));
    const pilotReview = buildRuntimeContinuityPilotEffectivenessReview(entries, {
      workspaceSessionCount: phase12Case.workspaceSessionCount,
    });
    const targetEntry =
      entries.find((item) => item.failureTaxonomy === phase12Case.targetFailureTaxonomy) ?? entries[0];

    if (!targetEntry) {
      results.push({
        id: testCase.id,
        label: testCase.label,
        passed: false,
        failures: ["continuity subgroup drift aging fixture is missing a target continuity case"],
        subgroupDriftAgingPass: false,
        intervalWordingConsistencyPass: false,
        materialImpactSamplingAgingPass: false,
        sessionReviewPass: false,
      });
      continue;
    }

    const allowedActions: Array<"SAVE_RECOVERY_CHECKPOINT" | "RESUME_CHECKPOINT" | "REPRUNE_CONTEXT"> =
      targetEntry.recoveryState === "RECOVERABLE" ? ["RESUME_CHECKPOINT"] : [];

    const recovery = {
      state: targetEntry.recoveryState,
      failureTaxonomy: targetEntry.failureTaxonomy,
      summary: targetEntry.recoverySummary,
      operatorAction:
        targetEntry.recoveryState === "BLOCKED"
          ? "Do not continue bounded remediation from this surface."
          : targetEntry.recoveryState === "REVIEW_REQUIRED"
            ? "Pause remediation until protected fields are reviewed."
            : targetEntry.recoveryState === "RECOVERABLE"
              ? "Run the next bounded continuity remediation step."
              : "Monitor continuity posture.",
      allowedActions,
      reviewReasons:
        targetEntry.recoveryState === "REVIEW_REQUIRED"
          ? ["protected continuity fields still need review"]
          : [],
      blockedReasons:
        targetEntry.recoveryState === "BLOCKED"
          ? ["no recovery anchor exists yet"]
          : [],
      rollbackAnchor:
        targetEntry.failureTaxonomy === "NO_RECOVERY_ANCHOR"
          ? null
          : {
              checkpointId: "continuity_anchor",
              checkpointLabel: "continuity_anchor",
              checkpointStatus: "READY",
            },
    };
    const calibration = {
      pilotBasis: pilotReview.pilotBasis,
      rawState: targetEntry.recoveryState,
      calibratedState: targetEntry.recoveryState,
      confidence: targetEntry.calibrationConfidence,
      stateAdjusted: false,
      summary: targetEntry.calibrationSummary,
      reasons: [targetEntry.calibrationSummary],
    };
    const analytics = {
      totalAttempts: targetEntry.remediationAttempts,
      appliedCount:
        targetEntry.latestEffectiveness === "EFFECTIVE" ||
        targetEntry.latestEffectiveness === "PARTIAL" ||
        targetEntry.latestEffectiveness === "INEFFECTIVE"
          ? targetEntry.remediationAttempts
          : 0,
      reviewRequiredCount:
        targetEntry.repeatPatternStatus === "REPEATED_REVIEW_REQUIRED" ? targetEntry.remediationAttempts : 0,
      blockedCount:
        targetEntry.repeatPatternStatus === "REPEATED_BLOCKED_ACTION" ? targetEntry.remediationAttempts : 0,
      latestAction: "SAVE_RECOVERY_CHECKPOINT" as const,
      latestAttemptAt: targetEntry.updatedAt,
      repeatPattern: {
        status: targetEntry.repeatPatternStatus,
        summary: targetEntry.repeatPatternSummary,
      },
    };
    const effectiveness = {
      pilotBasis: pilotReview.pilotBasis,
      latestOutcome: targetEntry.latestEffectiveness,
      latestSummary: targetEntry.effectivenessSummary,
      effectiveCount: targetEntry.latestEffectiveness === "EFFECTIVE" ? 1 : 0,
      partialCount: targetEntry.latestEffectiveness === "PARTIAL" ? 1 : 0,
      ineffectiveCount: targetEntry.latestEffectiveness === "INEFFECTIVE" ? 1 : 0,
      noSignalCount: targetEntry.latestEffectiveness === "NO_SIGNAL" ? 1 : 0,
      escalationNeeded: targetEntry.latestEffectiveness === "INEFFECTIVE",
      escalationSummary:
        targetEntry.latestEffectiveness === "INEFFECTIVE"
          ? "Stop retrying blindly and move this continuity workflow into explicit operator review."
          : "No escalation beyond bounded continuity workflow is currently needed.",
    };
    const sessionReview = buildRuntimeContinuityPilotSessionReview({
      recovery,
      calibration,
      analytics,
      effectiveness,
      pilotReview,
      cohortContext: {
        workspaceSizeBand: pilotReview.workspaceCohort.sizeBand,
        meetingShape: targetEntry.meetingShape,
        sessionDensityBand: targetEntry.sessionDensityBand,
        meetingFrequencyBand: targetEntry.meetingFrequencyBand,
        failureHistoryBand: targetEntry.failureHistoryBand,
        participantRolePosture: targetEntry.participantRolePosture,
      },
    });

    const subgroupDriftAgingPass =
      pilotReview.workspaceCohort.sizeBand === testCase.expected.workspaceSizeBand &&
      sessionReview.meetingShape === testCase.expected.targetMeetingShape &&
      sessionReview.riskBand === testCase.expected.targetRiskBand &&
      sessionReview.stabilityBand === testCase.expected.targetStabilityBand &&
      sessionReview.stabilityConfidenceBand === testCase.expected.targetStabilityConfidenceBand &&
      testCase.expected.subgroupDriftAgingIncludes.every((snippet) =>
        includesInAny(
          [
            pilotReview.subgroupDriftAgingScaleUpReview.summary,
            pilotReview.subgroupDriftAgingScaleUpReview.aggregateSummary,
            ...pilotReview.subgroupDriftAgingScaleUpReview.findings,
            sessionReview.subgroupDriftAgingScaleUpSummary,
          ],
          snippet,
        ),
      );
    const intervalWordingConsistencyPass =
      sessionReview.confidenceInterval === testCase.expected.targetConfidenceInterval &&
      pilotReview.intervalWordingCrossSurfaceConsistencyAudit.regressionRate ===
        testCase.expected.targetIntervalWordingConsistencyRate &&
      testCase.expected.intervalWordingConsistencyIncludes.every((snippet) =>
        includesInAny(
          [
            pilotReview.intervalWordingCrossSurfaceConsistencyAudit.summary,
            pilotReview.intervalWordingCrossSurfaceConsistencyAudit.aggregateSummary,
            ...pilotReview.intervalWordingCrossSurfaceConsistencyAudit.findings,
            ...pilotReview.intervalWordingCrossSurfaceConsistencyAudit.adjustmentRecommendations,
            sessionReview.intervalWordingConsistencyAuditSummary,
            sessionReview.intervalWordingSummary,
          ],
          snippet,
        ),
      );
    const materialImpactSamplingAgingPass =
      sessionReview.longTermMaterialImpactBand === testCase.expected.targetMaterialImpactBand &&
      testCase.expected.materialImpactSamplingAgingIncludes.every((snippet) =>
        includesInAny(
          [
            pilotReview.materialImpactSamplingAgingReview.summary,
            pilotReview.materialImpactSamplingAgingReview.aggregateSummary,
            ...pilotReview.materialImpactSamplingAgingReview.findings,
            ...pilotReview.materialImpactSamplingAgingReview.optimizationHints,
            sessionReview.materialImpactSamplingAgingSummary,
            sessionReview.longTermMaterialImpactSummary,
          ],
          snippet,
        ),
      );
    const sessionReviewPass =
      sessionReview.workspaceSizeBand === testCase.expected.workspaceSizeBand &&
      sessionReview.meetingShape === testCase.expected.targetMeetingShape &&
      sessionReview.riskBand === testCase.expected.targetRiskBand &&
      sessionReview.stabilityBand === testCase.expected.targetStabilityBand &&
      sessionReview.stabilityConfidenceBand === testCase.expected.targetStabilityConfidenceBand &&
      sessionReview.confidenceInterval === testCase.expected.targetConfidenceInterval &&
      sessionReview.longTermMaterialImpactBand === testCase.expected.targetMaterialImpactBand &&
      testCase.expected.sessionReviewIncludes.every((snippet) =>
        includesInAny(
          [
            sessionReview.subgroupDriftAgingScaleUpSummary,
            sessionReview.intervalWordingConsistencyAuditSummary,
            sessionReview.materialImpactSamplingAgingSummary,
            sessionReview.guidanceRefinementSummary,
          ],
          snippet,
        ),
      );

    const failures: string[] = [];
    if (!subgroupDriftAgingPass) failures.push("subgroup drift aging scale-up review regressed");
    if (!intervalWordingConsistencyPass) failures.push("interval wording consistency audit regressed");
    if (!materialImpactSamplingAgingPass) failures.push("material impact sampling aging review regressed");
    if (!sessionReviewPass) failures.push("session-level PR38 pilot review regressed");

    results.push({
      id: testCase.id,
      label: testCase.label,
      passed: failures.length === 0,
      failures,
      subgroupDriftAgingPass,
      intervalWordingConsistencyPass,
      materialImpactSamplingAgingPass,
      sessionReviewPass,
    });
  }

  const passedCases = results.filter((item) => item.passed).length;
  return {
    totalCases: results.length,
    passedCases,
    passRate: toRate(passedCases, results.length),
    subgroupDriftAgingRate: toRate(
      results.filter((item) => item.subgroupDriftAgingPass).length,
      results.length,
    ),
    intervalWordingConsistencyRate: toRate(
      results.filter((item) => item.intervalWordingConsistencyPass).length,
      results.length,
    ),
    materialImpactSamplingAgingRate: toRate(
      results.filter((item) => item.materialImpactSamplingAgingPass).length,
      results.length,
    ),
    sessionReviewRate: toRate(results.filter((item) => item.sessionReviewPass).length, results.length),
    cases: results,
  };
}

export function runHelmV22ContinuitySubgroupDriftImpactAgingRefinementEvalHarness(): HelmV22ContinuitySubgroupDriftImpactAgingRefinementEvalSummary {
  const cases = loadContinuitySubgroupDriftImpactAgingRefinementGoldenCases();
  const phase18CaseMap = new Map(
    loadContinuitySubgroupDriftAgingMaterialImpactAuditGoldenCases().map((item) => [item.id, item] as const),
  );
  const phase17CaseMap = new Map(
    loadContinuitySubgroupDriftCohortAgingImpactGoldenCases().map((item) => [item.id, item] as const),
  );
  const phase16CaseMap = new Map(
    loadContinuitySubgroupStabilityDriftAgingGoldenCases().map((item) => [item.id, item] as const),
  );
  const phase15CaseMap = new Map(
    loadContinuityPilotScaleUpRecheckGoldenCases().map((item) => [item.id, item] as const),
  );
  const phase14CaseMap = new Map(
    loadContinuityPilotStabilityScaleUpGoldenCases().map((item) => [item.id, item] as const),
  );
  const phase12CaseMap = new Map(
    loadContinuityPilotStabilityRecheckGoldenCases().map((item) => [item.id, item] as const),
  );
  const results: HelmV22ContinuitySubgroupDriftImpactAgingRefinementEvalCaseResult[] = [];

  for (const testCase of cases) {
    const phase18Case = phase18CaseMap.get(testCase.sourceCaseId);
    const phase17Case = phase18Case ? phase17CaseMap.get(phase18Case.sourceCaseId) : null;
    const phase16Case = phase17Case ? phase16CaseMap.get(phase17Case.sourceCaseId) : null;
    const phase15Case = phase16Case ? phase15CaseMap.get(phase16Case.sourceCaseId) : null;
    const phase14Case = phase15Case ? phase14CaseMap.get(phase15Case.sourceCaseId) : null;
    const phase12Case = phase14Case ? phase12CaseMap.get(phase14Case.sourceCaseId) : null;

    if (!phase18Case || !phase17Case || !phase16Case || !phase15Case || !phase14Case || !phase12Case) {
      results.push({
        id: testCase.id,
        label: testCase.label,
        passed: false,
        failures: ["continuity subgroup drift / impact aging refinement fixture is missing a prior continuity source case"],
        subgroupDriftRefinementPass: false,
        intervalWordingRegressionAuditPass: false,
        materialImpactAgingRefinementPass: false,
        sessionReviewPass: false,
      });
      continue;
    }

    const entries = phase12Case.queueEntries.map((item) => buildEvalContinuityPilotQueueEntry(item));
    const pilotReview = buildRuntimeContinuityPilotEffectivenessReview(entries, {
      workspaceSessionCount: phase12Case.workspaceSessionCount,
    });
    const targetEntry =
      entries.find((item) => item.failureTaxonomy === phase12Case.targetFailureTaxonomy) ?? entries[0];

    if (!targetEntry) {
      results.push({
        id: testCase.id,
        label: testCase.label,
        passed: false,
        failures: ["continuity subgroup drift / impact aging refinement fixture is missing a target continuity case"],
        subgroupDriftRefinementPass: false,
        intervalWordingRegressionAuditPass: false,
        materialImpactAgingRefinementPass: false,
        sessionReviewPass: false,
      });
      continue;
    }

    const allowedActions: Array<"SAVE_RECOVERY_CHECKPOINT" | "RESUME_CHECKPOINT" | "REPRUNE_CONTEXT"> =
      targetEntry.recoveryState === "RECOVERABLE" ? ["RESUME_CHECKPOINT"] : [];

    const recovery = {
      state: targetEntry.recoveryState,
      failureTaxonomy: targetEntry.failureTaxonomy,
      summary: targetEntry.recoverySummary,
      operatorAction:
        targetEntry.recoveryState === "BLOCKED"
          ? "Do not continue bounded remediation from this surface."
          : targetEntry.recoveryState === "REVIEW_REQUIRED"
            ? "Pause remediation until protected fields are reviewed."
            : targetEntry.recoveryState === "RECOVERABLE"
              ? "Run the next bounded continuity remediation step."
              : "Monitor continuity posture.",
      allowedActions,
      reviewReasons:
        targetEntry.recoveryState === "REVIEW_REQUIRED"
          ? ["protected continuity fields still need review"]
          : [],
      blockedReasons:
        targetEntry.recoveryState === "BLOCKED"
          ? ["no recovery anchor exists yet"]
          : [],
      rollbackAnchor:
        targetEntry.failureTaxonomy === "NO_RECOVERY_ANCHOR"
          ? null
          : {
              checkpointId: "continuity_anchor",
              checkpointLabel: "continuity_anchor",
              checkpointStatus: "READY",
            },
    };
    const calibration = {
      pilotBasis: pilotReview.pilotBasis,
      rawState: targetEntry.recoveryState,
      calibratedState: targetEntry.recoveryState,
      confidence: targetEntry.calibrationConfidence,
      stateAdjusted: false,
      summary: targetEntry.calibrationSummary,
      reasons: [targetEntry.calibrationSummary],
    };
    const analytics = {
      totalAttempts: targetEntry.remediationAttempts,
      appliedCount:
        targetEntry.latestEffectiveness === "EFFECTIVE" ||
        targetEntry.latestEffectiveness === "PARTIAL" ||
        targetEntry.latestEffectiveness === "INEFFECTIVE"
          ? targetEntry.remediationAttempts
          : 0,
      reviewRequiredCount:
        targetEntry.repeatPatternStatus === "REPEATED_REVIEW_REQUIRED" ? targetEntry.remediationAttempts : 0,
      blockedCount:
        targetEntry.repeatPatternStatus === "REPEATED_BLOCKED_ACTION" ? targetEntry.remediationAttempts : 0,
      latestAction: "SAVE_RECOVERY_CHECKPOINT" as const,
      latestAttemptAt: targetEntry.updatedAt,
      repeatPattern: {
        status: targetEntry.repeatPatternStatus,
        summary: targetEntry.repeatPatternSummary,
      },
    };
    const effectiveness = {
      pilotBasis: pilotReview.pilotBasis,
      latestOutcome: targetEntry.latestEffectiveness,
      latestSummary: targetEntry.effectivenessSummary,
      effectiveCount: targetEntry.latestEffectiveness === "EFFECTIVE" ? 1 : 0,
      partialCount: targetEntry.latestEffectiveness === "PARTIAL" ? 1 : 0,
      ineffectiveCount: targetEntry.latestEffectiveness === "INEFFECTIVE" ? 1 : 0,
      noSignalCount: targetEntry.latestEffectiveness === "NO_SIGNAL" ? 1 : 0,
      escalationNeeded: targetEntry.latestEffectiveness === "INEFFECTIVE",
      escalationSummary:
        targetEntry.latestEffectiveness === "INEFFECTIVE"
          ? "Stop retrying blindly and move this continuity workflow into explicit operator review."
          : "No escalation beyond bounded continuity workflow is currently needed.",
    };
    const sessionReview = buildRuntimeContinuityPilotSessionReview({
      recovery,
      calibration,
      analytics,
      effectiveness,
      pilotReview,
      cohortContext: {
        workspaceSizeBand: pilotReview.workspaceCohort.sizeBand,
        meetingShape: targetEntry.meetingShape,
        sessionDensityBand: targetEntry.sessionDensityBand,
        meetingFrequencyBand: targetEntry.meetingFrequencyBand,
        failureHistoryBand: targetEntry.failureHistoryBand,
        participantRolePosture: targetEntry.participantRolePosture,
      },
    });

    const subgroupDriftRefinementPass =
      pilotReview.workspaceCohort.sizeBand === testCase.expected.workspaceSizeBand &&
      sessionReview.meetingShape === testCase.expected.targetMeetingShape &&
      sessionReview.riskBand === testCase.expected.targetRiskBand &&
      sessionReview.stabilityBand === testCase.expected.targetStabilityBand &&
      sessionReview.stabilityConfidenceBand === testCase.expected.targetStabilityConfidenceBand &&
      testCase.expected.subgroupDriftRefinementIncludes.every((snippet) =>
        includesInAny(
          [
            pilotReview.subgroupDriftLongTermCohortAgingReview.summary,
            pilotReview.subgroupDriftLongTermCohortAgingReview.aggregateSummary,
            ...pilotReview.subgroupDriftLongTermCohortAgingReview.findings,
            sessionReview.subgroupDriftLongTermCohortAgingSummary,
          ],
          snippet,
        ),
      );
    const intervalWordingRegressionAuditPass =
      sessionReview.confidenceInterval === testCase.expected.targetConfidenceInterval &&
      pilotReview.intervalWordingCrossSurfaceRegressionAudit.regressionRate ===
        testCase.expected.targetRegressionAuditRate &&
      testCase.expected.intervalWordingRegressionAuditIncludes.every((snippet) =>
        includesInAny(
          [
            pilotReview.intervalWordingCrossSurfaceRegressionAudit.summary,
            pilotReview.intervalWordingCrossSurfaceRegressionAudit.aggregateSummary,
            ...pilotReview.intervalWordingCrossSurfaceRegressionAudit.findings,
            ...pilotReview.intervalWordingCrossSurfaceRegressionAudit.adjustmentRecommendations,
            sessionReview.intervalWordingRegressionAuditSummary,
            sessionReview.intervalWordingSummary,
          ],
          snippet,
        ),
      );
    const materialImpactAgingRefinementPass =
      sessionReview.longTermMaterialImpactBand === testCase.expected.targetMaterialImpactBand &&
      testCase.expected.materialImpactAgingRefinementIncludes.every((snippet) =>
        includesInAny(
          [
            pilotReview.materialImpactSamplingAgingRefinement.summary,
            pilotReview.materialImpactSamplingAgingRefinement.aggregateSummary,
            ...pilotReview.materialImpactSamplingAgingRefinement.findings,
            ...pilotReview.materialImpactSamplingAgingRefinement.optimizationHints,
            sessionReview.materialImpactAgingRefinementSummary,
            sessionReview.longTermMaterialImpactSummary,
          ],
          snippet,
        ),
      );
    const sessionReviewPass =
      sessionReview.workspaceSizeBand === testCase.expected.workspaceSizeBand &&
      sessionReview.meetingShape === testCase.expected.targetMeetingShape &&
      sessionReview.riskBand === testCase.expected.targetRiskBand &&
      sessionReview.stabilityBand === testCase.expected.targetStabilityBand &&
      sessionReview.stabilityConfidenceBand === testCase.expected.targetStabilityConfidenceBand &&
      sessionReview.confidenceInterval === testCase.expected.targetConfidenceInterval &&
      sessionReview.longTermMaterialImpactBand === testCase.expected.targetMaterialImpactBand &&
      testCase.expected.sessionReviewIncludes.every((snippet) =>
        includesInAny(
          [
            sessionReview.subgroupDriftLongTermCohortAgingSummary,
            sessionReview.intervalWordingRegressionAuditSummary,
            sessionReview.materialImpactAgingRefinementSummary,
            sessionReview.guidanceRefinementSummary,
          ],
          snippet,
        ),
      );

    const failures: string[] = [];
    if (!subgroupDriftRefinementPass) failures.push("subgroup drift long-term cohort aging review regressed");
    if (!intervalWordingRegressionAuditPass) failures.push("interval wording regression audit regressed");
    if (!materialImpactAgingRefinementPass) failures.push("material impact aging refinement regressed");
    if (!sessionReviewPass) failures.push("session-level PR39 pilot review regressed");

    results.push({
      id: testCase.id,
      label: testCase.label,
      passed: failures.length === 0,
      failures,
      subgroupDriftRefinementPass,
      intervalWordingRegressionAuditPass,
      materialImpactAgingRefinementPass,
      sessionReviewPass,
    });
  }

  const passedCases = results.filter((item) => item.passed).length;
  return {
    totalCases: results.length,
    passedCases,
    passRate: toRate(passedCases, results.length),
    subgroupDriftRefinementRate: toRate(
      results.filter((item) => item.subgroupDriftRefinementPass).length,
      results.length,
    ),
    intervalWordingRegressionAuditRate: toRate(
      results.filter((item) => item.intervalWordingRegressionAuditPass).length,
      results.length,
    ),
    materialImpactAgingRefinementRate: toRate(
      results.filter((item) => item.materialImpactAgingRefinementPass).length,
      results.length,
    ),
    sessionReviewRate: toRate(results.filter((item) => item.sessionReviewPass).length, results.length),
    cases: results,
  };
}

export function runHelmV22ContinuitySubgroupDriftLongTermAgingMaterialImpactAuditEvalHarness(): HelmV22ContinuitySubgroupDriftLongTermAgingMaterialImpactAuditEvalSummary {
  const cases = loadContinuitySubgroupDriftLongTermAgingMaterialImpactAuditGoldenCases();
  const phase19CaseMap = new Map(
    loadContinuitySubgroupDriftImpactAgingRefinementGoldenCases().map((item) => [item.id, item] as const),
  );
  const phase18CaseMap = new Map(
    loadContinuitySubgroupDriftAgingMaterialImpactAuditGoldenCases().map((item) => [item.id, item] as const),
  );
  const phase17CaseMap = new Map(
    loadContinuitySubgroupDriftCohortAgingImpactGoldenCases().map((item) => [item.id, item] as const),
  );
  const phase16CaseMap = new Map(
    loadContinuitySubgroupStabilityDriftAgingGoldenCases().map((item) => [item.id, item] as const),
  );
  const phase15CaseMap = new Map(
    loadContinuityPilotScaleUpRecheckGoldenCases().map((item) => [item.id, item] as const),
  );
  const phase14CaseMap = new Map(
    loadContinuityPilotStabilityScaleUpGoldenCases().map((item) => [item.id, item] as const),
  );
  const phase12CaseMap = new Map(
    loadContinuityPilotStabilityRecheckGoldenCases().map((item) => [item.id, item] as const),
  );
  const results: HelmV22ContinuitySubgroupDriftLongTermAgingMaterialImpactAuditEvalCaseResult[] = [];

  for (const testCase of cases) {
    const phase19Case = phase19CaseMap.get(testCase.sourceCaseId);
    const phase18Case = phase19Case ? phase18CaseMap.get(phase19Case.sourceCaseId) : null;
    const phase17Case = phase18Case ? phase17CaseMap.get(phase18Case.sourceCaseId) : null;
    const phase16Case = phase17Case ? phase16CaseMap.get(phase17Case.sourceCaseId) : null;
    const phase15Case = phase16Case ? phase15CaseMap.get(phase16Case.sourceCaseId) : null;
    const phase14Case = phase15Case ? phase14CaseMap.get(phase15Case.sourceCaseId) : null;
    const phase12Case = phase14Case ? phase12CaseMap.get(phase14Case.sourceCaseId) : null;

    if (!phase19Case || !phase18Case || !phase17Case || !phase16Case || !phase15Case || !phase14Case || !phase12Case) {
      results.push({
        id: testCase.id,
        label: testCase.label,
        passed: false,
        failures: ["continuity subgroup drift long-term aging / material impact audit fixture is missing a prior continuity source case"],
        subgroupDriftLongTermAgingPass: false,
        intervalWordingCrossReadoutAuditPass: false,
        materialImpactSamplingAgingAuditPass: false,
        sessionReviewPass: false,
      });
      continue;
    }

    const entries = phase12Case.queueEntries.map((item) => buildEvalContinuityPilotQueueEntry(item));
    const pilotReview = buildRuntimeContinuityPilotEffectivenessReview(entries, {
      workspaceSessionCount: phase12Case.workspaceSessionCount,
    });
    const targetEntry =
      entries.find((item) => item.failureTaxonomy === phase12Case.targetFailureTaxonomy) ?? entries[0];

    if (!targetEntry) {
      results.push({
        id: testCase.id,
        label: testCase.label,
        passed: false,
        failures: ["continuity subgroup drift long-term aging / material impact audit fixture is missing a target continuity case"],
        subgroupDriftLongTermAgingPass: false,
        intervalWordingCrossReadoutAuditPass: false,
        materialImpactSamplingAgingAuditPass: false,
        sessionReviewPass: false,
      });
      continue;
    }

    const allowedActions: Array<"SAVE_RECOVERY_CHECKPOINT" | "RESUME_CHECKPOINT" | "REPRUNE_CONTEXT"> =
      targetEntry.recoveryState === "RECOVERABLE" ? ["RESUME_CHECKPOINT"] : [];

    const recovery = {
      state: targetEntry.recoveryState,
      failureTaxonomy: targetEntry.failureTaxonomy,
      summary: targetEntry.recoverySummary,
      operatorAction:
        targetEntry.recoveryState === "BLOCKED"
          ? "Do not continue bounded remediation from this surface."
          : targetEntry.recoveryState === "REVIEW_REQUIRED"
            ? "Pause remediation until protected fields are reviewed."
            : targetEntry.recoveryState === "RECOVERABLE"
              ? "Run the next bounded continuity remediation step."
              : "Monitor continuity posture.",
      allowedActions,
      reviewReasons:
        targetEntry.recoveryState === "REVIEW_REQUIRED"
          ? ["protected continuity fields still need review"]
          : [],
      blockedReasons:
        targetEntry.recoveryState === "BLOCKED"
          ? ["no recovery anchor exists yet"]
          : [],
      rollbackAnchor:
        targetEntry.failureTaxonomy === "NO_RECOVERY_ANCHOR"
          ? null
          : {
              checkpointId: "continuity_anchor",
              checkpointLabel: "continuity_anchor",
              checkpointStatus: "READY",
            },
    };
    const calibration = {
      pilotBasis: pilotReview.pilotBasis,
      rawState: targetEntry.recoveryState,
      calibratedState: targetEntry.recoveryState,
      confidence: targetEntry.calibrationConfidence,
      stateAdjusted: false,
      summary: targetEntry.calibrationSummary,
      reasons: [targetEntry.calibrationSummary],
    };
    const analytics = {
      totalAttempts: targetEntry.remediationAttempts,
      appliedCount:
        targetEntry.latestEffectiveness === "EFFECTIVE" ||
        targetEntry.latestEffectiveness === "PARTIAL" ||
        targetEntry.latestEffectiveness === "INEFFECTIVE"
          ? targetEntry.remediationAttempts
          : 0,
      reviewRequiredCount:
        targetEntry.repeatPatternStatus === "REPEATED_REVIEW_REQUIRED" ? targetEntry.remediationAttempts : 0,
      blockedCount:
        targetEntry.repeatPatternStatus === "REPEATED_BLOCKED_ACTION" ? targetEntry.remediationAttempts : 0,
      latestAction: "SAVE_RECOVERY_CHECKPOINT" as const,
      latestAttemptAt: targetEntry.updatedAt,
      repeatPattern: {
        status: targetEntry.repeatPatternStatus,
        summary: targetEntry.repeatPatternSummary,
      },
    };
    const effectiveness = {
      pilotBasis: pilotReview.pilotBasis,
      latestOutcome: targetEntry.latestEffectiveness,
      latestSummary: targetEntry.effectivenessSummary,
      effectiveCount: targetEntry.latestEffectiveness === "EFFECTIVE" ? 1 : 0,
      partialCount: targetEntry.latestEffectiveness === "PARTIAL" ? 1 : 0,
      ineffectiveCount: targetEntry.latestEffectiveness === "INEFFECTIVE" ? 1 : 0,
      noSignalCount: targetEntry.latestEffectiveness === "NO_SIGNAL" ? 1 : 0,
      escalationNeeded: targetEntry.latestEffectiveness === "INEFFECTIVE",
      escalationSummary:
        targetEntry.latestEffectiveness === "INEFFECTIVE"
          ? "Stop retrying blindly and move this continuity workflow into explicit operator review."
          : "No escalation beyond bounded continuity workflow is currently needed.",
    };
    const sessionReview = buildRuntimeContinuityPilotSessionReview({
      recovery,
      calibration,
      analytics,
      effectiveness,
      pilotReview,
      cohortContext: {
        workspaceSizeBand: pilotReview.workspaceCohort.sizeBand,
        meetingShape: targetEntry.meetingShape,
        sessionDensityBand: targetEntry.sessionDensityBand,
        meetingFrequencyBand: targetEntry.meetingFrequencyBand,
        failureHistoryBand: targetEntry.failureHistoryBand,
        participantRolePosture: targetEntry.participantRolePosture,
      },
    });

    const subgroupDriftLongTermAgingPass =
      pilotReview.workspaceCohort.sizeBand === testCase.expected.workspaceSizeBand &&
      sessionReview.meetingShape === testCase.expected.targetMeetingShape &&
      sessionReview.riskBand === testCase.expected.targetRiskBand &&
      sessionReview.stabilityBand === testCase.expected.targetStabilityBand &&
      sessionReview.stabilityConfidenceBand === testCase.expected.targetStabilityConfidenceBand &&
      testCase.expected.subgroupDriftLongTermAgingIncludes.every((snippet) =>
        includesInAny(
          [
            pilotReview.subgroupDriftLongTermSampleExpansionReview.summary,
            pilotReview.subgroupDriftLongTermSampleExpansionReview.aggregateSummary,
            ...pilotReview.subgroupDriftLongTermSampleExpansionReview.findings,
            sessionReview.subgroupDriftLongTermSampleExpansionSummary,
          ],
          snippet,
        ),
      );
    const intervalWordingCrossReadoutAuditPass =
      pilotReview.intervalWordingCrossReadoutRegressionAudit.regressionRate ===
        testCase.expected.targetCrossReadoutRegressionAuditRate &&
      testCase.expected.intervalWordingCrossReadoutAuditIncludes.every((snippet) =>
        includesInAny(
          [
            pilotReview.intervalWordingCrossReadoutRegressionAudit.summary,
            pilotReview.intervalWordingCrossReadoutRegressionAudit.aggregateSummary,
            ...pilotReview.intervalWordingCrossReadoutRegressionAudit.findings,
            ...pilotReview.intervalWordingCrossReadoutRegressionAudit.adjustmentRecommendations,
            sessionReview.intervalWordingCrossReadoutAuditSummary,
            sessionReview.intervalWordingSummary,
          ],
          snippet,
        ),
      );
    const materialImpactSamplingAgingAuditPass =
      sessionReview.longTermMaterialImpactBand === testCase.expected.targetMaterialImpactBand &&
      testCase.expected.materialImpactSamplingAgingAuditIncludes.every((snippet) =>
        includesInAny(
          [
            pilotReview.materialImpactSamplingAgingAudit.summary,
            pilotReview.materialImpactSamplingAgingAudit.aggregateSummary,
            ...pilotReview.materialImpactSamplingAgingAudit.findings,
            ...pilotReview.materialImpactSamplingAgingAudit.optimizationSuggestions,
            sessionReview.materialImpactSamplingAgingAuditSummary,
            sessionReview.longTermMaterialImpactSummary,
          ],
          snippet,
        ),
      );
    const sessionReviewPass =
      sessionReview.workspaceSizeBand === testCase.expected.workspaceSizeBand &&
      sessionReview.meetingShape === testCase.expected.targetMeetingShape &&
      sessionReview.riskBand === testCase.expected.targetRiskBand &&
      sessionReview.stabilityBand === testCase.expected.targetStabilityBand &&
      sessionReview.stabilityConfidenceBand === testCase.expected.targetStabilityConfidenceBand &&
      sessionReview.longTermMaterialImpactBand === testCase.expected.targetMaterialImpactBand &&
      testCase.expected.sessionReviewIncludes.every((snippet) =>
        includesInAny(
          [
            sessionReview.subgroupDriftLongTermSampleExpansionSummary,
            sessionReview.intervalWordingCrossReadoutAuditSummary,
            sessionReview.materialImpactSamplingAgingAuditSummary,
            sessionReview.guidanceRefinementSummary,
          ],
          snippet,
        ),
      );

    const failures: string[] = [];
    if (!subgroupDriftLongTermAgingPass) failures.push("subgroup drift long-term sample expansion review regressed");
    if (!intervalWordingCrossReadoutAuditPass) failures.push("interval wording cross-readout audit regressed");
    if (!materialImpactSamplingAgingAuditPass) failures.push("material impact sampling aging audit regressed");
    if (!sessionReviewPass) failures.push("session-level PR40 pilot review regressed");

    results.push({
      id: testCase.id,
      label: testCase.label,
      passed: failures.length === 0,
      failures,
      subgroupDriftLongTermAgingPass,
      intervalWordingCrossReadoutAuditPass,
      materialImpactSamplingAgingAuditPass,
      sessionReviewPass,
    });
  }

  const passedCases = results.filter((item) => item.passed).length;
  return {
    totalCases: results.length,
    passedCases,
    passRate: toRate(passedCases, results.length),
    subgroupDriftLongTermAgingRate: toRate(
      results.filter((item) => item.subgroupDriftLongTermAgingPass).length,
      results.length,
    ),
    intervalWordingCrossReadoutAuditRate: toRate(
      results.filter((item) => item.intervalWordingCrossReadoutAuditPass).length,
      results.length,
    ),
    materialImpactSamplingAgingAuditRate: toRate(
      results.filter((item) => item.materialImpactSamplingAgingAuditPass).length,
      results.length,
    ),
    sessionReviewRate: toRate(results.filter((item) => item.sessionReviewPass).length, results.length),
    cases: results,
  };
}

export function runHelmV22ContinuitySubgroupDriftMaterialImpactAgingAuditRefinementEvalHarness(): HelmV22ContinuitySubgroupDriftMaterialImpactAgingAuditRefinementEvalSummary {
  const cases = loadContinuitySubgroupDriftMaterialImpactAgingAuditRefinementGoldenCases();
  const phase20CaseMap = new Map(
    loadContinuitySubgroupDriftLongTermAgingMaterialImpactAuditGoldenCases().map((item) => [item.id, item] as const),
  );
  const phase19CaseMap = new Map(
    loadContinuitySubgroupDriftImpactAgingRefinementGoldenCases().map((item) => [item.id, item] as const),
  );
  const phase18CaseMap = new Map(
    loadContinuitySubgroupDriftAgingMaterialImpactAuditGoldenCases().map((item) => [item.id, item] as const),
  );
  const phase17CaseMap = new Map(
    loadContinuitySubgroupDriftCohortAgingImpactGoldenCases().map((item) => [item.id, item] as const),
  );
  const phase16CaseMap = new Map(
    loadContinuitySubgroupStabilityDriftAgingGoldenCases().map((item) => [item.id, item] as const),
  );
  const phase15CaseMap = new Map(
    loadContinuityPilotScaleUpRecheckGoldenCases().map((item) => [item.id, item] as const),
  );
  const phase14CaseMap = new Map(
    loadContinuityPilotStabilityScaleUpGoldenCases().map((item) => [item.id, item] as const),
  );
  const phase12CaseMap = new Map(
    loadContinuityPilotStabilityRecheckGoldenCases().map((item) => [item.id, item] as const),
  );
  const results: HelmV22ContinuitySubgroupDriftMaterialImpactAgingAuditRefinementEvalCaseResult[] = [];

  for (const testCase of cases) {
    const phase20Case = phase20CaseMap.get(testCase.sourceCaseId);
    const phase19Case = phase20Case ? phase19CaseMap.get(phase20Case.sourceCaseId) : null;
    const phase18Case = phase19Case ? phase18CaseMap.get(phase19Case.sourceCaseId) : null;
    const phase17Case = phase18Case ? phase17CaseMap.get(phase18Case.sourceCaseId) : null;
    const phase16Case = phase17Case ? phase16CaseMap.get(phase17Case.sourceCaseId) : null;
    const phase15Case = phase16Case ? phase15CaseMap.get(phase16Case.sourceCaseId) : null;
    const phase14Case = phase15Case ? phase14CaseMap.get(phase15Case.sourceCaseId) : null;
    const phase12Case = phase14Case ? phase12CaseMap.get(phase14Case.sourceCaseId) : null;

    if (!phase20Case || !phase19Case || !phase18Case || !phase17Case || !phase16Case || !phase15Case || !phase14Case || !phase12Case) {
      results.push({
        id: testCase.id,
        label: testCase.label,
        passed: false,
        failures: ["continuity subgroup drift / material impact aging audit refinement fixture is missing a prior continuity source case"],
        subgroupDriftExpansionRefinementPass: false,
        intervalWordingCrossReadoutRefinementPass: false,
        materialImpactSamplingRefinementAuditPass: false,
        sessionReviewPass: false,
      });
      continue;
    }

    const entries = phase12Case.queueEntries.map((item) => buildEvalContinuityPilotQueueEntry(item));
    const pilotReview = buildRuntimeContinuityPilotEffectivenessReview(entries, {
      workspaceSessionCount: phase12Case.workspaceSessionCount,
    });
    const targetEntry =
      entries.find((item) => item.failureTaxonomy === phase12Case.targetFailureTaxonomy) ?? entries[0];

    if (!targetEntry) {
      results.push({
        id: testCase.id,
        label: testCase.label,
        passed: false,
        failures: ["continuity subgroup drift / material impact aging audit refinement fixture is missing a target continuity case"],
        subgroupDriftExpansionRefinementPass: false,
        intervalWordingCrossReadoutRefinementPass: false,
        materialImpactSamplingRefinementAuditPass: false,
        sessionReviewPass: false,
      });
      continue;
    }

    const allowedActions: Array<"SAVE_RECOVERY_CHECKPOINT" | "RESUME_CHECKPOINT" | "REPRUNE_CONTEXT"> =
      targetEntry.recoveryState === "RECOVERABLE" ? ["RESUME_CHECKPOINT"] : [];

    const recovery = {
      state: targetEntry.recoveryState,
      failureTaxonomy: targetEntry.failureTaxonomy,
      summary: targetEntry.recoverySummary,
      operatorAction:
        targetEntry.recoveryState === "BLOCKED"
          ? "Do not continue bounded remediation from this surface."
          : targetEntry.recoveryState === "REVIEW_REQUIRED"
            ? "Pause remediation until protected fields are reviewed."
            : targetEntry.recoveryState === "RECOVERABLE"
              ? "Run the next bounded continuity remediation step."
              : "Monitor continuity posture.",
      allowedActions,
      reviewReasons:
        targetEntry.recoveryState === "REVIEW_REQUIRED"
          ? ["protected continuity fields still need review"]
          : [],
      blockedReasons:
        targetEntry.recoveryState === "BLOCKED"
          ? ["no recovery anchor exists yet"]
          : [],
      rollbackAnchor:
        targetEntry.failureTaxonomy === "NO_RECOVERY_ANCHOR"
          ? null
          : {
              checkpointId: "continuity_anchor",
              checkpointLabel: "continuity_anchor",
              checkpointStatus: "READY",
            },
    };
    const calibration = {
      pilotBasis: pilotReview.pilotBasis,
      rawState: targetEntry.recoveryState,
      calibratedState: targetEntry.recoveryState,
      confidence: targetEntry.calibrationConfidence,
      stateAdjusted: false,
      summary: targetEntry.calibrationSummary,
      reasons: [targetEntry.calibrationSummary],
    };
    const analytics = {
      totalAttempts: targetEntry.remediationAttempts,
      appliedCount:
        targetEntry.latestEffectiveness === "EFFECTIVE" ||
        targetEntry.latestEffectiveness === "PARTIAL" ||
        targetEntry.latestEffectiveness === "INEFFECTIVE"
          ? targetEntry.remediationAttempts
          : 0,
      reviewRequiredCount:
        targetEntry.repeatPatternStatus === "REPEATED_REVIEW_REQUIRED" ? targetEntry.remediationAttempts : 0,
      blockedCount:
        targetEntry.repeatPatternStatus === "REPEATED_BLOCKED_ACTION" ? targetEntry.remediationAttempts : 0,
      latestAction: "SAVE_RECOVERY_CHECKPOINT" as const,
      latestAttemptAt: targetEntry.updatedAt,
      repeatPattern: {
        status: targetEntry.repeatPatternStatus,
        summary: targetEntry.repeatPatternSummary,
      },
    };
    const effectiveness = {
      pilotBasis: pilotReview.pilotBasis,
      latestOutcome: targetEntry.latestEffectiveness,
      latestSummary: targetEntry.effectivenessSummary,
      effectiveCount: targetEntry.latestEffectiveness === "EFFECTIVE" ? 1 : 0,
      partialCount: targetEntry.latestEffectiveness === "PARTIAL" ? 1 : 0,
      ineffectiveCount: targetEntry.latestEffectiveness === "INEFFECTIVE" ? 1 : 0,
      noSignalCount: targetEntry.latestEffectiveness === "NO_SIGNAL" ? 1 : 0,
      escalationNeeded: targetEntry.latestEffectiveness === "INEFFECTIVE",
      escalationSummary:
        targetEntry.latestEffectiveness === "INEFFECTIVE"
          ? "Stop retrying blindly and move this continuity workflow into explicit operator review."
          : "No escalation beyond bounded continuity workflow is currently needed.",
    };
    const sessionReview = buildRuntimeContinuityPilotSessionReview({
      recovery,
      calibration,
      analytics,
      effectiveness,
      pilotReview,
      cohortContext: {
        workspaceSizeBand: pilotReview.workspaceCohort.sizeBand,
        meetingShape: targetEntry.meetingShape,
        sessionDensityBand: targetEntry.sessionDensityBand,
        meetingFrequencyBand: targetEntry.meetingFrequencyBand,
        failureHistoryBand: targetEntry.failureHistoryBand,
        participantRolePosture: targetEntry.participantRolePosture,
      },
    });

    const subgroupDriftExpansionRefinementPass =
      pilotReview.workspaceCohort.sizeBand === testCase.expected.workspaceSizeBand &&
      sessionReview.meetingShape === testCase.expected.targetMeetingShape &&
      sessionReview.riskBand === testCase.expected.targetRiskBand &&
      sessionReview.stabilityBand === testCase.expected.targetStabilityBand &&
      sessionReview.stabilityConfidenceBand === testCase.expected.targetStabilityConfidenceBand &&
      testCase.expected.subgroupDriftExpansionRefinementIncludes.every((snippet) =>
        includesInAny(
          [
            pilotReview.subgroupDriftLongTermSampleExpansionRefinementReview.summary,
            pilotReview.subgroupDriftLongTermSampleExpansionRefinementReview.aggregateSummary,
            ...pilotReview.subgroupDriftLongTermSampleExpansionRefinementReview.findings,
            sessionReview.subgroupDriftLongTermSampleExpansionRefinementSummary,
          ],
          snippet,
        ),
      );
    const intervalWordingCrossReadoutRefinementPass =
      pilotReview.intervalWordingCrossReadoutRegressionRefinement.regressionRate ===
        testCase.expected.targetCrossReadoutRegressionRefinementRate &&
      testCase.expected.intervalWordingCrossReadoutRefinementIncludes.every((snippet) =>
        includesInAny(
          [
            pilotReview.intervalWordingCrossReadoutRegressionRefinement.summary,
            pilotReview.intervalWordingCrossReadoutRegressionRefinement.aggregateSummary,
            ...pilotReview.intervalWordingCrossReadoutRegressionRefinement.findings,
            ...pilotReview.intervalWordingCrossReadoutRegressionRefinement.adjustmentRecommendations,
            sessionReview.intervalWordingCrossReadoutRegressionRefinementSummary,
            sessionReview.intervalWordingSummary,
          ],
          snippet,
        ),
      );
    const materialImpactSamplingRefinementAuditPass =
      sessionReview.longTermMaterialImpactBand === testCase.expected.targetMaterialImpactBand &&
      testCase.expected.materialImpactSamplingRefinementAuditIncludes.every((snippet) =>
        includesInAny(
          [
            pilotReview.materialImpactSamplingAgingRefinementAudit.summary,
            pilotReview.materialImpactSamplingAgingRefinementAudit.aggregateSummary,
            ...pilotReview.materialImpactSamplingAgingRefinementAudit.findings,
            ...pilotReview.materialImpactSamplingAgingRefinementAudit.optimizationSuggestions,
            sessionReview.materialImpactSamplingAgingRefinementAuditSummary,
            sessionReview.longTermMaterialImpactSummary,
          ],
          snippet,
        ),
      );
    const sessionReviewPass =
      sessionReview.workspaceSizeBand === testCase.expected.workspaceSizeBand &&
      sessionReview.meetingShape === testCase.expected.targetMeetingShape &&
      sessionReview.riskBand === testCase.expected.targetRiskBand &&
      sessionReview.stabilityBand === testCase.expected.targetStabilityBand &&
      sessionReview.stabilityConfidenceBand === testCase.expected.targetStabilityConfidenceBand &&
      sessionReview.longTermMaterialImpactBand === testCase.expected.targetMaterialImpactBand &&
      testCase.expected.sessionReviewIncludes.every((snippet) =>
        includesInAny(
          [
            sessionReview.subgroupDriftLongTermSampleExpansionRefinementSummary,
            sessionReview.intervalWordingCrossReadoutRegressionRefinementSummary,
            sessionReview.materialImpactSamplingAgingRefinementAuditSummary,
            sessionReview.guidanceRefinementSummary,
          ],
          snippet,
        ),
      );

    const failures: string[] = [];
    if (!subgroupDriftExpansionRefinementPass) failures.push("subgroup drift sample expansion refinement regressed");
    if (!intervalWordingCrossReadoutRefinementPass) failures.push("interval wording cross-readout refinement regressed");
    if (!materialImpactSamplingRefinementAuditPass) failures.push("material impact sampling refinement audit regressed");
    if (!sessionReviewPass) failures.push("session-level PR41 pilot review regressed");

    results.push({
      id: testCase.id,
      label: testCase.label,
      passed: failures.length === 0,
      failures,
      subgroupDriftExpansionRefinementPass,
      intervalWordingCrossReadoutRefinementPass,
      materialImpactSamplingRefinementAuditPass,
      sessionReviewPass,
    });
  }

  const passedCases = results.filter((item) => item.passed).length;
  return {
    totalCases: results.length,
    passedCases,
    passRate: toRate(passedCases, results.length),
    subgroupDriftExpansionRefinementRate: toRate(
      results.filter((item) => item.subgroupDriftExpansionRefinementPass).length,
      results.length,
    ),
    intervalWordingCrossReadoutRefinementRate: toRate(
      results.filter((item) => item.intervalWordingCrossReadoutRefinementPass).length,
      results.length,
    ),
    materialImpactSamplingRefinementAuditRate: toRate(
      results.filter((item) => item.materialImpactSamplingRefinementAuditPass).length,
      results.length,
    ),
    sessionReviewRate: toRate(results.filter((item) => item.sessionReviewPass).length, results.length),
    cases: results,
  };
}
