import { randomUUID } from "node:crypto";
import {
  ActorType,
  MemoryItemStatus,
  MemoryItemVerification,
  ObjectType,
  RuntimeEventStatus,
  type ArtifactBundle,
  type MemoryItem,
} from "@prisma/client";
import { logEvent } from "@/lib/analytics";
import { writeAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import type {
  HelmV21BenchmarkExecutionAcknowledgement,
  HelmV21BenchmarkExecutionFollowThrough,
  HelmV21BenchmarkExecutionRequest,
  HelmV21BenchmarkMatrixReadModel,
  HelmV21BenchmarkMatrixLayerId,
  HelmV21BenchmarkRecordedGateOutcome,
  HelmV21BenchmarkRecordedRun,
  HelmV21EnvironmentContractReadModel,
  HelmV21ConsolidationQueueAuditSummary,
  HelmV21CoordinationOutcome,
  HelmV21CompositionFailureClass,
  HelmV21EdgeBriefAudience,
  HelmV21HandoffPayloadSkeleton,
  HelmV21HumanInputCheckpointRequest,
  HelmV21InterruptReason,
  HelmV21OperatorDebuggerReplayFidelity,
  HelmV21OperatorDebuggerReadModel,
  HelmV21OperatorDebuggerTakeoverPosture,
  HelmV21OperatorDebuggerTakeoverRequest,
  HelmV21PersistedPayload,
  HelmV21ProjectSkillLibraryReadModel,
  HelmV21ResumeAsk,
  HelmV21RuntimeOperatorControlSummary,
  HelmV21RuntimeSwarmOperatorControlSurface,
  HelmV21RuntimeOperatorActionSummary,
  HelmV21RuntimeOperatorActionCueSummary,
  HelmV21RuntimeOperatorCueSummary,
  HelmV21RuntimeOperatorNextMoveSummary,
  HelmV21RuntimeOperatorProgressSummary,
  HelmV21RuntimeOperatorReviewActionSummary,
  HelmV21RuntimeOperatorReviewControlCueSummary,
  HelmV21RuntimeOperatorReviewSummary,
  HelmV21RuntimeOperatorStartPointSummary,
  HelmV21RuntimeOperatorWorkSummary,
  HelmV21RuntimePostureSnapshot,
  HelmV21RunThreadContract,
  HelmV21RunThreadHumanInputCheckpoint,
  HelmV21RunThreadPersistedControlPlaneLifecycleRefreshReason,
  HelmV21RunThreadPersistedControlPlaneLifecycleSnapshot,
  HelmV21VerificationDecision,
  HelmV2AgentId,
  HelmV2ApprovalTier,
} from "@/lib/helm-v2/contracts";
import { buildBenchmarkMatrixReadModel } from "@/lib/helm-v2/benchmark-matrix";
import { buildConsolidationQueueAuditSummary } from "@/lib/helm-v2/consolidation-queue-audit-summary";
import { buildRuntimeOperatorActionSummary } from "@/lib/helm-v2/runtime-operator-action-summary";
import { buildRuntimeOperatorActionCueSummary } from "@/lib/helm-v2/runtime-operator-action-cue-summary";
import { buildRuntimeOperatorCueSummary } from "@/lib/helm-v2/runtime-operator-cue-summary";
import { buildRuntimeOperatorControlSummary } from "@/lib/helm-v2/runtime-operator-control-summary";
import { buildRuntimeSwarmOperatorControlSurface } from "@/lib/helm-v2/swarm-operator-control-surface";
import { buildRuntimeOperatorNextMoveSummary } from "@/lib/helm-v2/runtime-operator-next-move-summary";
import { buildRuntimeOperatorProgressSummary } from "@/lib/helm-v2/runtime-operator-progress-summary";
import { buildRuntimeOperatorReviewActionSummary } from "@/lib/helm-v2/runtime-operator-review-action-summary";
import { buildRuntimeOperatorReviewControlCueSummary } from "@/lib/helm-v2/runtime-operator-review-control-cue-summary";
import { buildRuntimeOperatorReviewSummary } from "@/lib/helm-v2/runtime-operator-review-summary";
import { buildRuntimeOperatorStartPointSummary } from "@/lib/helm-v2/runtime-operator-start-point-summary";
import { buildRuntimeOperatorWorkSummary } from "@/lib/helm-v2/runtime-operator-work-summary";
import {
  buildRunThreadPersistedControlPlaneLifecycle,
  buildRunThreadPersistedControlPlaneLifecycleSnapshot,
  diffRunThreadPersistedControlPlaneLifecycleWriteSide,
  parseRunThreadPersistedControlPlaneLifecycleSnapshot,
} from "@/lib/helm-v2/run-thread-persisted-control-plane-lifecycle";
import {
  buildOperatingGapQueue,
  summarizeOperatingGaps,
  summarizeBusinessLoopGaps,
  type OperatingGap,
  type BusinessLoopGapSummary,
  type OperatingGapSummary,
} from "@/lib/operating-system/operating-gap";
import { buildRunThreadContract } from "@/lib/helm-v2/run-thread-contract";
import {
  buildOperatorDebuggerHandoffPayload,
  buildOperatorDebuggerInterruptReason,
  buildOperatorDebuggerReadModel,
  buildOperatorDebuggerResumeAsk,
} from "@/lib/helm-v2/operator-debugger-read-model";
import { buildOperatorDebuggerRecoveryExecutionGuardContract } from "@/lib/helm-v2/operator-debugger-recovery-execution-guard";
import { getRicherOfficialActionCoverageCatalog } from "@/lib/helm-v2/official-system-integration-runtime";
import {
  buildBudgetPosture,
  buildContinuitySnapshot,
  buildResumeFidelity,
  buildRuntimeContinuityOperatorArtifacts,
  buildRuntimeContinuityRecovery,
  buildRuntimeContinuityRisk,
  buildRuntimeNotebookState,
  buildRuntimePayloadHandleState,
  buildRuntimeRollbackAnchor,
  formatContinuityRemediationActionLabel,
  parseContinuitySnapshot,
  selectRuntimeContinuityCheckpoint,
} from "@/lib/helm-v2/runtime-upgrade-continuity";
import {
  buildCoordinationTraceBridge,
  buildProblemSpaceBriefContent,
  buildProblemSpaceConflictSummary,
  buildProblemSpaceDrafts,
  buildProblemSpaceDriSummary,
  buildProblemSpaceGroundingSummary,
  buildProblemSpaceTruthPosture,
  deriveCoordinationOutcome,
  mapCoordinationOutcomeToInitiativeStatus,
  mapCoordinationOutcomeToProblemSpaceStatus,
  mapProblemSpaceStatusToCoordinationOutcome,
} from "@/lib/helm-v2/runtime-upgrade-problem-space";
import {
  buildMetricDate,
  buildRuntimeHandoffPacketContract,
  mapRunThreadLifecycleHandoffPacket,
  mapRunThreadLifecycleRemediationEntry,
  mapRuntimeHandoffPacketState,
  normalizeRuntimeAgentId,
  normalizeRuntimeApprovalTier,
} from "@/lib/helm-v2/runtime-upgrade-handoff";
import {
  buildRunThreadCloseoutConfirmationLifecycleInputs,
  buildRunThreadCloseoutRefreshLifecycleInputs,
  buildRunThreadCloseoutResolutionFollowThroughLifecycleInputs,
  buildRunThreadCloseoutResolutionLifecycleInputs,
  buildRunThreadCloseRequestLifecycleInputs,
  buildRunThreadRequestLifecycleInputs,
  buildRunThreadResultAcknowledgementInputs,
  buildRunThreadSettlementLifecycleInputs,
  buildRuntimePostureSnapshot,
  formatRuntimePostureSnapshotSummary,
} from "@/lib/helm-v2/runtime-upgrade-lifecycle";
import {
  buildRuntimeContinuityBandAdjustmentRationale,
  buildRuntimeContinuityConfidenceSummary,
  buildRuntimeContinuityFailureClassSopTemplate,
  buildRuntimeContinuityIntervalWordingSummary,
  buildRuntimeContinuityMeetingFrequencyBandMap,
  buildRuntimeContinuitySampleCoverageSummary,
  buildRuntimeContinuitySopStepReviews,
  buildRuntimeContinuityStabilitySummary,
  buildRuntimeContinuityStabilityVarianceSummary,
  buildRuntimeContinuityTrendMetrics,
  getRuntimeContinuityDriftState,
  getRuntimeContinuityConfidenceInterval,
  getRuntimeContinuityFailureHistoryBand,
  getRuntimeContinuityGuidanceStatus,
  getRuntimeContinuityMeetingShape,
  getRuntimeContinuityParticipantRolePosture,
  getRuntimeContinuityPilotConfidenceBand,
  getRuntimeContinuityPilotRiskBand,
  getRuntimeContinuityPilotThreshold,
  getRuntimeContinuitySampleCoverageBand,
  getRuntimeContinuitySessionDensityBand,
  getRuntimeContinuityStabilityAwareConfidenceBand,
  getRuntimeContinuityStabilityBand,
  getRuntimeContinuityStabilityConfidenceBand,
  getRuntimeContinuityStabilityScore,
  getRuntimeContinuityStabilityThreshold,
  getRuntimeContinuityStabilityVariance,
  getRuntimeContinuitySopStepReviewTarget,
  getRuntimeContinuityTopFailureClass,
  getRuntimeContinuityWorkspaceSizeBand,
} from "@/lib/helm-v2/runtime-upgrade-continuity-analytics";
import { buildRuntimeContinuityCalibrationReadouts } from "@/lib/helm-v2/runtime-upgrade-continuity-calibration";
import { buildRuntimeContinuitySynthesis } from "@/lib/helm-v2/runtime-upgrade-continuity-synthesis";
import { buildRuntimeContinuityThresholdRevisions } from "@/lib/helm-v2/runtime-upgrade-continuity-thresholds";
import { buildRuntimeContinuityIntervalWordingReview } from "@/lib/helm-v2/runtime-upgrade-continuity-wording";
import {
  buildPruneTraceEntries,
  buildRuntimeContinuityState,
  parseRuntimeRemediationTrace,
} from "@/lib/helm-v2/runtime-upgrade-state";
import {
  DEFAULT_TOKEN_BUDGET,
  buildPersistedPayloadDraft,
  buildVerificationDecision,
  selectPayloadsForBudget,
  toPersistedPayloadContract,
  type PersistedPayloadDraft,
} from "@/lib/helm-v2/runtime-upgrade-payloads";
export {
  buildPersistedPayloadDraft,
  buildVerificationDecision,
  estimateTokenCount,
  selectPayloadsForBudget,
  toPersistedPayloadContract,
} from "@/lib/helm-v2/runtime-upgrade-payloads";
import {
  ACTIVE_RUNTIME_JOB_STATUSES,
  REFLECTION_JOB_TYPES,
  buildConsolidationLifecycleOutputSummary,
  buildPromotedRuntimeFacts,
  buildReflectionJobInputSummary,
  buildReflectionJobOutputSummary,
  buildReflectionLifecycleOutputSummary,
  buildReflectionMemoryCandidateContract,
  buildRuntimeJobEventPrefix,
  buildRuntimeMemoryPromotionKey,
  isActiveRuntimeJobStatus,
  isReflectionJobType,
  isReflectionMemoryCandidate,
  parseRuntimeStringList,
} from "@/lib/helm-v2/runtime-upgrade-reflection";
export {
  buildPromotedRuntimeFacts,
  buildReflectionJobOutputSummary,
  buildReflectionMemoryCandidateContract,
  isReflectionMemoryCandidate,
} from "@/lib/helm-v2/runtime-upgrade-reflection";
export {
  buildBudgetPosture,
  buildContinuitySnapshot,
  buildResumeFidelity,
  buildRuntimeContinuityCalibration,
  buildRuntimeContinuityEvidenceSurface,
  buildRuntimeContinuityRecovery,
  buildRuntimeContinuityRisk,
  buildRuntimeContinuityRunbook,
  buildRuntimeNotebookState,
  buildRuntimePayloadHandleState,
  buildRuntimeRemediationAnalytics,
  buildRuntimeRemediationEffectiveness,
  classifyPayloadStateSourceRisk,
  classifyReplayFidelityStatus,
  parseContinuitySnapshot,
} from "@/lib/helm-v2/runtime-upgrade-continuity";
export {
  buildCoordinationTraceBridge,
  buildEdgeBriefMarkdown,
  buildProblemSpaceDrafts,
  deriveCoordinationOutcome,
} from "@/lib/helm-v2/runtime-upgrade-problem-space";
export type { CoordinationTraceBridge } from "@/lib/helm-v2/runtime-upgrade-problem-space";
export {
  buildRuntimePostureSnapshot,
  formatRuntimePostureSnapshotSummary,
} from "@/lib/helm-v2/runtime-upgrade-lifecycle";
export { buildPruneTraceEntries } from "@/lib/helm-v2/runtime-upgrade-state";
import { buildEnvironmentContractReadModel } from "@/lib/worker-skill-resource/environment-contract";
import { buildProjectSkillLibraryReadModel } from "@/lib/worker-skill-resource/project-skill-library";
import { jsonStringify, safeParseJson, trimText } from "@/lib/utils";
import { parseWorkspaceFeatureFlags } from "@/lib/workspace-ops";

const RUNTIME_BOUNDARY_NOTE =
  "Helm v2.1 runtime remains review-first: context is selectively loaded, verification is explicit, and no high-risk external send or official write is auto-approved here.";
const CONSOLIDATION_BOUNDARY_NOTE =
  "Consolidation jobs stay candidate-only and auditable. They do not rewrite canonical memory without an explicit review path.";
const REFLECTION_BOUNDARY_NOTE =
  "Reflection stays review-first and evidence-first. It can compact trusted runtime state into notebook-friendly carry-forward context, but it does not auto-promote memory, rewrite canonical truth, or send anything externally.";
const PAUSEABLE_RUNTIME_JOB_STATUSES = new Set<string>(["QUEUED", "RUNNING"]);
const RESUMABLE_RUNTIME_JOB_STATUSES = new Set<string>(["PAUSED"]);
const SWARM_SPAWN_REQUESTED_EVENT_TYPE = "swarm.spawn.requested" as const;
const SWARM_READ_ONLY_WORKER_INTENT_RECORDED_EVENT_TYPE =
  "swarm.read-only-worker.intent.recorded" as const;
const SWARM_READ_ONLY_WORKER_PLACEHOLDER_RECORDED_EVENT_TYPE =
  "swarm.read-only-worker.placeholder.recorded" as const;
const SWARM_READ_ONLY_WORKER_EXECUTION_RECORDED_EVENT_TYPE =
  "swarm.read-only-worker.execution.recorded" as const;
const SWARM_READ_ONLY_WORKER_MATERIALIZATION_RECORDED_EVENT_TYPE =
  "swarm.read-only-worker.materialization.recorded" as const;
const SWARM_READ_ONLY_WORKER_ADOPTION_RECORDED_EVENT_TYPE =
  "swarm.read-only-worker.adoption.recorded" as const;
const SWARM_VERIFICATION_MERGE_LANE_RECORDED_EVENT_TYPE =
  "swarm.verification-merge-lane.recorded" as const;
const OPERATOR_TAKEOVER_REQUEST_EVENT_TYPE = "operator.takeover.requested" as const;
const OPERATOR_TAKEOVER_ACKNOWLEDGED_EVENT_TYPE = "operator.takeover.acknowledged" as const;
const OPERATOR_TAKEOVER_STARTED_EVENT_TYPE = "operator.takeover.started" as const;
const OPERATOR_TAKEOVER_RELEASED_EVENT_TYPE = "operator.takeover.released" as const;
const OPERATOR_TAKEOVER_FOLLOW_THROUGH_REQUESTED_EVENT_TYPE =
  "operator.takeover.followthrough.requested" as const;
const OPERATOR_TAKEOVER_FOLLOW_THROUGH_RESOLVED_EVENT_TYPE =
  "operator.takeover.followthrough.resolved" as const;
const HUMAN_INPUT_CHECKPOINT_REQUEST_EVENT_TYPE = "human-input.checkpoint.requested" as const;
const HUMAN_INPUT_CHECKPOINT_ACKNOWLEDGED_EVENT_TYPE =
  "human-input.checkpoint.acknowledged" as const;
const RUN_THREAD_SETTLEMENT_REVIEW_REQUESTED_EVENT_TYPE =
  "run-thread.settlement.review.requested" as const;
const RUN_THREAD_SETTLEMENT_REVIEW_RESOLVED_EVENT_TYPE =
  "run-thread.settlement.review.resolved" as const;
const RUN_THREAD_CLOSEOUT_CONFIRMED_EVENT_TYPE =
  "run-thread.closeout.confirmed" as const;
const RUN_THREAD_CLOSEOUT_REFRESH_REQUESTED_EVENT_TYPE =
  "run-thread.closeout.refresh.requested" as const;
const RUN_THREAD_CLOSEOUT_RESOLUTION_RECORDED_EVENT_TYPE =
  "run-thread.closeout.resolution.recorded" as const;
const RUN_THREAD_CLOSEOUT_RESOLUTION_FOLLOW_THROUGH_REQUESTED_EVENT_TYPE =
  "run-thread.closeout.resolution.followthrough.requested" as const;
const RUN_THREAD_CLOSEOUT_RESOLUTION_FOLLOW_THROUGH_RESOLVED_EVENT_TYPE =
  "run-thread.closeout.resolution.followthrough.resolved" as const;
const RUN_THREAD_CLOSE_REQUESTED_EVENT_TYPE = "run-thread.close.requested" as const;
const BENCHMARK_MATRIX_RUN_REQUESTED_EVENT_TYPE = "benchmark.matrix.run.requested" as const;
const BENCHMARK_MATRIX_RUN_RECORDED_EVENT_TYPE = "benchmark.matrix.run.recorded" as const;
const BENCHMARK_MATRIX_RUN_ACKNOWLEDGED_EVENT_TYPE = "benchmark.matrix.run.acknowledged" as const;
const BENCHMARK_MATRIX_RUN_FOLLOW_THROUGH_REQUESTED_EVENT_TYPE =
  "benchmark.matrix.run.followthrough.requested" as const;
const BENCHMARK_MATRIX_RUN_FOLLOW_THROUGH_RESOLVED_EVENT_TYPE =
  "benchmark.matrix.run.followthrough.resolved" as const;
const BENCHMARK_MATRIX_EVENT_TYPES = [
  BENCHMARK_MATRIX_RUN_REQUESTED_EVENT_TYPE,
  BENCHMARK_MATRIX_RUN_RECORDED_EVENT_TYPE,
  BENCHMARK_MATRIX_RUN_ACKNOWLEDGED_EVENT_TYPE,
  BENCHMARK_MATRIX_RUN_FOLLOW_THROUGH_REQUESTED_EVENT_TYPE,
  BENCHMARK_MATRIX_RUN_FOLLOW_THROUGH_RESOLVED_EVENT_TYPE,
] as const;
const DEBUGGER_REQUEST_EVENT_TYPES = [
  SWARM_SPAWN_REQUESTED_EVENT_TYPE,
  SWARM_READ_ONLY_WORKER_INTENT_RECORDED_EVENT_TYPE,
  SWARM_READ_ONLY_WORKER_PLACEHOLDER_RECORDED_EVENT_TYPE,
  SWARM_READ_ONLY_WORKER_EXECUTION_RECORDED_EVENT_TYPE,
  SWARM_READ_ONLY_WORKER_MATERIALIZATION_RECORDED_EVENT_TYPE,
  SWARM_READ_ONLY_WORKER_ADOPTION_RECORDED_EVENT_TYPE,
  SWARM_VERIFICATION_MERGE_LANE_RECORDED_EVENT_TYPE,
  OPERATOR_TAKEOVER_REQUEST_EVENT_TYPE,
  OPERATOR_TAKEOVER_ACKNOWLEDGED_EVENT_TYPE,
  OPERATOR_TAKEOVER_STARTED_EVENT_TYPE,
  OPERATOR_TAKEOVER_RELEASED_EVENT_TYPE,
  OPERATOR_TAKEOVER_FOLLOW_THROUGH_REQUESTED_EVENT_TYPE,
  OPERATOR_TAKEOVER_FOLLOW_THROUGH_RESOLVED_EVENT_TYPE,
  HUMAN_INPUT_CHECKPOINT_REQUEST_EVENT_TYPE,
  HUMAN_INPUT_CHECKPOINT_ACKNOWLEDGED_EVENT_TYPE,
] as const;
const RUN_THREAD_SETTLEMENT_REVIEW_EVENT_TYPES = [
  RUN_THREAD_SETTLEMENT_REVIEW_REQUESTED_EVENT_TYPE,
  RUN_THREAD_SETTLEMENT_REVIEW_RESOLVED_EVENT_TYPE,
] as const;
const RUN_THREAD_CLOSEOUT_EVENT_TYPES = [
  RUN_THREAD_CLOSEOUT_CONFIRMED_EVENT_TYPE,
  RUN_THREAD_CLOSEOUT_REFRESH_REQUESTED_EVENT_TYPE,
  RUN_THREAD_CLOSEOUT_RESOLUTION_RECORDED_EVENT_TYPE,
  RUN_THREAD_CLOSEOUT_RESOLUTION_FOLLOW_THROUGH_REQUESTED_EVENT_TYPE,
  RUN_THREAD_CLOSEOUT_RESOLUTION_FOLLOW_THROUGH_RESOLVED_EVENT_TYPE,
  RUN_THREAD_CLOSE_REQUESTED_EVENT_TYPE,
] as const;
const RUNTIME_SESSION_CONTROL_EVENT_TYPES = [
  ...DEBUGGER_REQUEST_EVENT_TYPES,
  ...RUN_THREAD_SETTLEMENT_REVIEW_EVENT_TYPES,
  ...RUN_THREAD_CLOSEOUT_EVENT_TYPES,
] as const;
const RUNTIME_SESSION_PERSISTED_CONTROL_EVENT_TYPES = [
  OPERATOR_TAKEOVER_REQUEST_EVENT_TYPE,
  OPERATOR_TAKEOVER_ACKNOWLEDGED_EVENT_TYPE,
  OPERATOR_TAKEOVER_STARTED_EVENT_TYPE,
  OPERATOR_TAKEOVER_RELEASED_EVENT_TYPE,
  OPERATOR_TAKEOVER_FOLLOW_THROUGH_REQUESTED_EVENT_TYPE,
  OPERATOR_TAKEOVER_FOLLOW_THROUGH_RESOLVED_EVENT_TYPE,
  HUMAN_INPUT_CHECKPOINT_REQUEST_EVENT_TYPE,
  HUMAN_INPUT_CHECKPOINT_ACKNOWLEDGED_EVENT_TYPE,
  ...RUN_THREAD_SETTLEMENT_REVIEW_EVENT_TYPES,
  ...RUN_THREAD_CLOSEOUT_EVENT_TYPES,
] as const;
const RUNTIME_SESSION_PERSISTED_CONTROL_EVENT_TYPE_SET = new Set<string>(
  RUNTIME_SESSION_PERSISTED_CONTROL_EVENT_TYPES,
);

function readPersistedRunThreadControlPlaneLifecycle(session: {
  controlPlaneLifecycleJson?: string | null;
}): {
  snapshot: HelmV21RunThreadPersistedControlPlaneLifecycleSnapshot | null;
  parseFailed: boolean;
} {
  const raw = session.controlPlaneLifecycleJson ?? null;
  const snapshot = parseRunThreadPersistedControlPlaneLifecycleSnapshot(raw);
  return {
    snapshot,
    parseFailed: Boolean(raw) && !snapshot,
  };
}

function isRuntimeSessionControlPlaneLifecycleEventType(eventType: string) {
  return RUNTIME_SESSION_PERSISTED_CONTROL_EVENT_TYPE_SET.has(eventType);
}

async function persistRuntimeSessionControlPlaneLifecycleSnapshot(input: {
  workspaceId: string;
  sessionId: string;
  refreshReason: HelmV21RunThreadPersistedControlPlaneLifecycleRefreshReason;
  refreshSource?: string | null;
}) {
  const trace = await getRuntimeSessionTrace(input.workspaceId, input.sessionId);
  if (!trace) return null;

  const persisted = await db.runtimeSession.findUnique({
    where: { id: input.sessionId },
    select: {
      controlPlaneLifecycleJson: true,
    },
  });
  const existing = persisted
    ? readPersistedRunThreadControlPlaneLifecycle(persisted)
    : { snapshot: null, parseFailed: false };
  const existingLifecycle = buildRunThreadPersistedControlPlaneLifecycle({
    runThread: trace.runThread,
    snapshot: existing.snapshot,
    parseFailed: existing.parseFailed,
  });
  const writeSideDriftKeys = diffRunThreadPersistedControlPlaneLifecycleWriteSide({
    runThread: trace.runThread,
    snapshot: existing.snapshot,
    refreshReason: input.refreshReason,
    refreshSource: input.refreshSource ?? null,
  });
  if (
    existingLifecycle.guardPolicy.shouldReuseSnapshot &&
    existing.snapshot &&
    writeSideDriftKeys.length === 0
  ) {
    return existing.snapshot;
  }

  const snapshot = buildRunThreadPersistedControlPlaneLifecycleSnapshot(trace.runThread, new Date(), {
    refreshReason: input.refreshReason,
    refreshSource: input.refreshSource ?? null,
  });
  if (existingLifecycle.guardPolicy.shouldPersistSnapshot || writeSideDriftKeys.length > 0) {
    await db.runtimeSession.update({
      where: { id: input.sessionId },
      data: {
        controlPlaneLifecycleJson: jsonStringify(snapshot),
        controlPlaneLifecycleUpdatedAt: snapshot.persistedAt,
      },
    });
  }
  return snapshot;
}

type MeetingRuntimeUpgradeMeeting = {
  id: string;
  workspaceId: string;
  companyId?: string | null;
  opportunityId?: string | null;
  ownerId?: string | null;
  title: string;
  agenda?: string | null;
  workspace: {
    id: string;
    name: string;
    description?: string | null;
  };
  opportunity?: {
    id: string;
    title: string;
    nextAction?: string | null;
    ownerId?: string | null;
  } | null;
  company?: {
    id: string;
    name: string;
  } | null;
  note?: {
    id: string;
    liveTranscript?: string | null;
    summary?: string | null;
    keyDecisions?: string | null;
    confirmations?: string | null;
    meetingGoal?: string | null;
  } | null;
};

type WorldModelInput = {
  meetingTitle: string;
  workspaceName: string;
  companyName?: string | null;
  opportunityTitle?: string | null;
  confirmedFacts: string[];
  blockers: string[];
  recommendedNextAction?: string | null;
  truthScore: number;
};

type RuntimeUpgradeSummary = {
  session: {
    id: string;
    status: string;
    currentStage: string;
    budgetTokenLimit: number;
    budgetTokenUsed: number;
    loadedTokenCount: number;
    prunedTokenCount: number;
  };
  runThread: HelmV21RunThreadContract;
  debugger: HelmV21OperatorDebuggerReadModel;
  continuity: {
    budgetPosture: {
      state: "SAFE" | "WATCH" | "PRUNE" | "COMPACT";
      usagePercent: number;
      summary: string;
      reason: string;
      savingsSummary: string;
    };
    notebookState: {
      objective: string;
      relevantObjects: string[];
      confirmedFacts: string[];
      blockers: string[];
      decisions: string[];
      nextActions: string[];
      openQuestions: string[];
      evidenceRefs: string[];
      reviewState: string;
      boundaryNote: string;
    } | null;
    replay: {
      checkpointId: string;
      checkpointLabel: string;
      replaySummary: string;
      fidelityStatus: "STRONG" | "WATCH" | "WEAK";
      fidelityScore: number;
      preserved: string[];
      missing: string[];
      updatedAt: Date;
    } | null;
    recovery: {
      state: "STABLE" | "RECOVERABLE" | "REVIEW_REQUIRED" | "BLOCKED";
      failureTaxonomy:
        | "NONE"
        | "NO_RECOVERY_ANCHOR"
        | "BUDGET_PRESSURE"
        | "PAYLOAD_STATE_DRIFT"
        | "REPLAY_DRIFT"
        | "PROTECTED_STATE_GAP";
      summary: string;
      operatorAction: string;
      allowedActions: Array<"SAVE_RECOVERY_CHECKPOINT" | "RESUME_CHECKPOINT" | "REPRUNE_CONTEXT">;
      reviewReasons: string[];
      blockedReasons: string[];
      rollbackAnchor:
        | {
            checkpointId: string;
            checkpointLabel: string;
            checkpointStatus: string;
          }
        | null;
    };
    calibration: {
      pilotBasis: string;
      rawState: "STABLE" | "RECOVERABLE" | "REVIEW_REQUIRED" | "BLOCKED";
      calibratedState: "STABLE" | "RECOVERABLE" | "REVIEW_REQUIRED" | "BLOCKED";
      confidence: "HIGH" | "MEDIUM" | "LOW";
      stateAdjusted: boolean;
      summary: string;
      reasons: string[];
    };
    pruneTrace: Array<{
      id: string;
      strategy: string;
      posture: "WATCH" | "PRUNE" | "COMPACT";
      reason: string;
      beforeTokenCount: number;
      afterTokenCount: number;
      tokensSaved: number;
      replacementSummary: string;
      protectedItems: string[];
      removedPayloads: Array<{
        handle: string;
        label: string;
        summary: string;
        estimatedTokens: number;
        sourceType: string;
      }>;
      createdAt: Date;
    }>;
    remediationTrace: Array<{
      id: string;
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
      triggeredBy: string;
      createdAt: Date;
    }>;
    analytics: {
      totalAttempts: number;
      appliedCount: number;
      reviewRequiredCount: number;
      blockedCount: number;
      latestAction: "SAVE_RECOVERY_CHECKPOINT" | "RESUME_CHECKPOINT" | "REPRUNE_CONTEXT" | null;
      latestAttemptAt: Date | null;
      repeatPattern: {
        status:
          | "NONE"
          | "REPEATED_BLOCKED_ACTION"
          | "REPEATED_REVIEW_REQUIRED"
          | "REPEATED_REPRUNE_LOOP"
          | "REPEATED_INEFFECTIVE_ACTION";
        summary: string;
      };
    };
    effectiveness: {
      pilotBasis: string;
      latestOutcome: "NONE" | "EFFECTIVE" | "PARTIAL" | "INEFFECTIVE" | "NO_SIGNAL";
      latestSummary: string;
      effectiveCount: number;
      partialCount: number;
      ineffectiveCount: number;
      noSignalCount: number;
      escalationNeeded: boolean;
      escalationSummary: string;
    };
    evidence: {
      summary: string;
      items: string[];
    };
    runbook: {
      title: string;
      summary: string;
      steps: string[];
      boundaryNote: string;
    };
    pilotReview: {
      pilotBasis: string;
      failureTaxonomy:
        | "NONE"
        | "NO_RECOVERY_ANCHOR"
        | "BUDGET_PRESSURE"
        | "PAYLOAD_STATE_DRIFT"
        | "REPLAY_DRIFT"
        | "PROTECTED_STATE_GAP";
      confidenceBand: "HIGH" | "MEDIUM" | "LOW";
      riskBand: "LOW" | "WATCH" | "HIGH";
      recommendedIneffectiveThreshold: number;
      topTierFailureClass: boolean;
      workspaceSizeBand: "SMALL" | "GROWING" | "LARGE";
      meetingShape: "LEAN_MEETING" | "LONG_CONTEXT_MEETING" | "RESUMED_MEETING";
      sessionDensityBand: "LIGHT" | "STEADY" | "HEAVY";
      meetingFrequencyBand: "SPORADIC" | "RECURRING" | "HIGH_CADENCE";
      failureHistoryBand: "FIRST_SIGNAL" | "REPEATED_FAILURE" | "CHRONIC_REPEAT";
      participantRolePosture: "EXEC_SPONSORED" | "OPERATOR_LED" | "MIXED_STAKEHOLDERS" | "UNKNOWN";
      classSummary: string;
      driftSummary: string;
      longHorizonSummary: string;
      adjustmentSummary: string;
      cohortSummary: string;
      thresholdRevisionSummary: string;
      operatorHandlingSummary: string;
      varianceSummary: string;
      subgroupSummary: string;
      refinedCalibrationSummary: string;
      driftSynthesisSummary: string;
      sopEffectivenessSummary: string;
      sampleCoverageBand: "NARROW" | "QUALIFIED" | "BROAD";
      sampleCoverageSummary: string;
      stabilityBand: "UNSTABLE" | "WATCH" | "STABLE";
      stabilityConfidenceBand: "HIGH" | "MEDIUM" | "LOW";
      stabilitySummary: string;
      stabilityVarianceSummary: string;
      stabilityScaleUpSummary: string;
      stabilityScaleUpRecheckSummary: string;
      subgroupStabilityDriftSummary: string;
      subgroupCohortAgingSummary: string;
      subgroupDriftAgingScaleUpSummary: string;
      subgroupDriftLongTermCohortAgingSummary: string;
      subgroupDriftLongTermSampleExpansionSummary: string;
      subgroupDriftLongTermSampleExpansionRefinementSummary: string;
      confidenceInterval: "WIDE" | "GUARDED" | "SETTLED";
      confidenceAdjustmentRationale: string;
      intervalWordingSummary: string;
      intervalWordingDriftSummary: string;
      wordingDriftTrackingSummary: string;
      intervalConsistencyGuidanceSummary: string;
      intervalWordingAgingSummary: string;
      intervalWordingRegressionSummary: string;
      intervalWordingConsistencyAuditSummary: string;
      intervalWordingRegressionAuditSummary: string;
      intervalWordingCrossReadoutAuditSummary: string;
      intervalWordingCrossReadoutRegressionRefinementSummary: string;
      outcomeCorrelationBand: "AT_RISK" | "WATCH" | "STABLE";
      longTermOutcomeSummary: string;
      longTermSopImpactSummary: string;
      longTermMaterialImpactBand: "HIGH" | "WATCH" | "LOW";
      longTermMaterialImpactSummary: string;
      longTermMaterialImpactReviewSummary: string;
      longTermMaterialImpactAuditSummary: string;
      materialImpactPatternAgingSummary: string;
      materialImpactSamplingSummary: string;
      materialImpactSamplingAgingSummary: string;
      materialImpactAgingRefinementSummary: string;
      materialImpactSamplingAgingAuditSummary: string;
      materialImpactSamplingAgingRefinementAuditSummary: string;
      guidanceRefinementSummary: string;
    };
    sop: {
      title: string;
      summary: string;
      evidenceChecklist: string[];
      escalationRule: string;
      commonPitfalls: string[];
      boundaryNote: string;
    };
  };
  payloads: {
    total: number;
    handles: string[];
    activeHandles: string[];
    estimatedTokens: number;
    prunedHandles: string[];
    stateDerivation: string;
    items: Array<{
      handle: string;
      label: string;
      sourceType: string;
      loadPolicy: string;
      preview: string;
      summary: string;
      estimatedTokens: number;
      loadedByDefault: boolean;
      activeInContext: boolean;
    }>;
  };
  notebook: {
    summary: string;
    decisionSummary: string | null;
    blockerSummary: string | null;
    pendingQuestions: string[];
  } | null;
  latestCheckpoint: {
    id: string;
    label: string;
    status: string;
    summary: string;
    createdAt: Date;
  } | null;
  verification: {
    status: string;
    truthScore: number;
    summary: string;
    blockedReasons: string[];
    boundaryNotes: string[];
  } | null;
  promotionQueue: {
    candidates: number;
    promoted: number;
    deferred: number;
    rejected: number;
  };
  promotionDecisions: Array<{
    id: string;
    summary: string;
    disposition: string;
    rationale: string;
    sourceClasses: string[];
    evidenceRefs: string[];
    confidence: number | null;
    verificationStatus: string | null;
    verificationSummary: string | null;
    blockedReasons: string[];
    truthConflictStatus: "NONE" | "OPEN" | "RESOLVED";
    truthConflictSummary: string | null;
  }>;
  truthConflicts: Array<{
    id: string;
    summary: string;
    status: string;
  }>;
  problemSpaces: Array<{
    id: string;
    title: string;
    summary: string;
    nextStep: string;
    status: string;
    ownerHint: string | null;
    groundingSummary: string;
    driSummary: string | null;
    conflictSummary: string | null;
  }>;
  edgeBriefs: Array<{
    id: string;
    title: string;
    audience: string;
    summary: string;
    problemSpaceTitle: string | null;
    truthPosture: string;
  }>;
  compositionFailures: Array<{
    id: string;
    failureClass: string;
    summary: string;
    resolved: boolean;
    problemSpaceTitle: string | null;
  }>;
  signals: Array<{
    id: string;
    signalType: string;
    sourceType: string;
    signalSummary: string;
    truthWeight: number;
    createdAt: Date;
  }>;
  worldModels: Array<{
    id: string;
    summary: string;
    createdAt: Date;
  }>;
  artifactVersions: Array<{
    id: string;
    artifactType: string;
    versionNumber: number;
    reviewPosture: string | null;
    createdAt: Date;
  }>;
  capabilities: Array<{
    id: string;
    name: string;
    stage: string;
    description: string;
    loadPolicy: string;
    reviewRequired: boolean;
  }>;
  projectSkillLibrary: HelmV21ProjectSkillLibraryReadModel;
  environmentContract: HelmV21EnvironmentContractReadModel;
  benchmarkMatrix: HelmV21BenchmarkMatrixReadModel;
  operatorControlSummary: HelmV21RuntimeOperatorControlSummary;
  swarmOperatorControlSurface: HelmV21RuntimeSwarmOperatorControlSurface;
  operatorActionSummary: HelmV21RuntimeOperatorActionSummary;
  operatorProgressSummary: HelmV21RuntimeOperatorProgressSummary;
  handoffPackets: Array<{
    id: string;
    fromAgent: string;
    toAgent: string;
    goal: string;
    approvalTier: string;
    createdAt: Date;
  }>;
  initiativeRuns: Array<{
    id: string;
    title: string;
    summary: string;
    status: string;
    targetOutcome: string;
    createdAt: Date;
  }>;
  coordinationMetrics: {
    metricDate: Date | null;
    actionReady: number;
    reviewNeeded: number;
    waitingOnSignal: number;
    waitingOnAuthority: number;
    capabilityGap: number;
  };
  coordinationTrace: {
    summary: string;
    boundaryNote: string;
    humanExecution: {
      total: number;
      ready: number;
      executed: number;
      blocked: number;
      deferred: number;
    };
    officialFollowThrough: {
      total: number;
      open: number;
      unresolved: number;
      resolved: number;
    };
    items: Array<{
      id: string;
      title: string;
      posture: string;
      summary: string;
      linkageSummary: string;
      humanExecutionSummary: string | null;
      officialFollowThroughSummary: string | null;
      driSummary: string | null;
      updatedAt: Date;
    }>;
  };
  cacheHealth: {
    entries: number;
    hitRate: number;
    tokensSaved: number;
  };
  consolidation: {
    activeJobs: number;
    auditSummary: HelmV21ConsolidationQueueAuditSummary;
    latestJob: {
      id: string;
      jobType: string;
      status: string;
      inputSummary: string;
      outputSummary: string | null;
      reviewPosture: string;
      meetingId: string | null;
      createdAt: Date;
      pausedAt: Date | null;
      completedAt: Date | null;
    } | null;
    recentJobs: Array<{
      id: string;
      jobType: string;
      status: string;
      inputSummary: string;
      outputSummary: string | null;
      meetingId: string | null;
      createdAt: Date;
      pausedAt: Date | null;
      completedAt: Date | null;
    }>;
  };
  reflection: {
    activeJobs: number;
    latestJob: {
      id: string;
      jobType: string;
      status: string;
      inputSummary: string;
      outputSummary: string | null;
      reviewPosture: string;
      createdAt: Date;
      pausedAt: Date | null;
      completedAt: Date | null;
    } | null;
    recentJobs: Array<{
      id: string;
      jobType: string;
      status: string;
      inputSummary: string;
      outputSummary: string | null;
      createdAt: Date;
      pausedAt: Date | null;
      completedAt: Date | null;
    }>;
    recentCandidates: Array<{
      id: string;
      title: string;
      summary: string;
      reviewPosture: string;
      evidenceSummary: string;
      sourceClasses: string[];
      status: string;
      sessionId: string;
      sessionLabel: string;
      href: string;
      createdAt: Date;
    }>;
  };
};

export type WorkspaceRuntimeOperatorOverview = {
  boundaryNote: string;
  summary: {
    totalSessions: number;
    activeSessions: number;
    reviewQueue: number;
    operatingGapQueue: number;
    promotionQueue: number;
    reflectionCarryForward: number;
    openProblemSpaces: number;
    unresolvedCompositionFailures: number;
    criticalOperatingGaps: number;
    reflectionQueue: number;
    consolidationQueue: number;
    cacheHitRate: number;
    tokensSaved: number;
    pruneSessions: number;
    compactSessions: number;
    weakReplaySessions: number;
    highRiskContinuitySessions: number;
    checkpointDerivedContinuitySessions: number;
    recoverableContinuitySessions: number;
    reviewRequiredContinuitySessions: number;
    blockedContinuitySessions: number;
    remediationAttemptedContinuitySessions: number;
    repeatPatternContinuitySessions: number;
    lowConfidenceContinuitySessions: number;
    ineffectiveContinuitySessions: number;
  };
  operatingGapSummary: OperatingGapSummary;
  businessLoopGapSummary: BusinessLoopGapSummary;
  operatingGaps: OperatingGap[];
  verificationQueue: Array<{
    id: string;
    source: "verification_report" | "truth_conflict" | "swarm_merge_lane";
    title: string;
    summary: string;
    status: string;
    truthScore: number | null;
    sessionId: string;
    sessionLabel: string;
    href: string;
    createdAt: Date;
  }>;
  promotionQueue: Array<{
    id: string;
    source: "memory_candidate" | "memory_promotion";
    title: string;
    summary: string;
    status: string;
    rationale: string;
    sourceClasses: string[];
    truthConflictOpen: boolean;
    sessionId: string;
    sessionLabel: string;
    href: string;
    createdAt: Date;
  }>;
  reflectionCandidates: Array<{
    id: string;
    title: string;
    summary: string;
    reviewPosture: string;
    evidenceSummary: string;
    sourceClasses: string[];
    status: string;
    sessionId: string;
    sessionLabel: string;
    href: string;
    createdAt: Date;
  }>;
  problemSpaces: Array<{
    id: string;
    title: string;
    summary: string;
    nextStep: string;
    status: string;
    ownerHint: string | null;
    groundingSummary: string;
    driSummary: string | null;
    conflictSummary: string | null;
    href: string;
    updatedAt: Date;
  }>;
  playerCoachQueue: Array<{
    id: string;
    title: string;
    summary: string;
    problemSpaceId: string | null;
    problemSpaceTitle: string | null;
    groundingSummary: string | null;
    truthPosture: string | null;
    driSummary: string | null;
    href: string;
    updatedAt: Date;
  }>;
  compositionFailures: Array<{
    id: string;
    failureClass: string;
    summary: string;
    sessionLabel: string;
    problemSpaceTitle: string | null;
    href: string;
    createdAt: Date;
  }>;
  reflectionJobs: Array<{
    id: string;
    jobType: string;
    status: string;
    inputSummary: string;
    outputSummary: string | null;
    reviewPosture: string;
    href: string;
    createdAt: Date;
    pausedAt: Date | null;
    completedAt: Date | null;
  }>;
  consolidationJobs: Array<{
    id: string;
    jobType: string;
    status: string;
    inputSummary: string;
    outputSummary: string | null;
    reviewPosture: string;
    meetingId: string | null;
    href: string;
    createdAt: Date;
    pausedAt: Date | null;
    completedAt: Date | null;
  }>;
  consolidationAuditSummary: HelmV21ConsolidationQueueAuditSummary;
  signals: Array<{
    id: string;
    signalType: string;
    sourceType: string;
    signalSummary: string;
    truthWeight: number;
    href: string;
    createdAt: Date;
  }>;
  capabilities: Array<{
    id: string;
    name: string;
    stage: string;
    description: string;
    loadPolicy: string;
    reviewRequired: boolean;
  }>;
  projectSkillLibrary: HelmV21ProjectSkillLibraryReadModel;
  environmentContract: HelmV21EnvironmentContractReadModel;
  benchmarkMatrix: HelmV21BenchmarkMatrixReadModel;
  operatorControlSummary: HelmV21RuntimeOperatorControlSummary;
  swarmOperatorControlSurface: HelmV21RuntimeSwarmOperatorControlSurface;
  operatorActionSummary: HelmV21RuntimeOperatorActionSummary;
  operatorReviewSummary: HelmV21RuntimeOperatorReviewSummary;
  operatorReviewActionSummary: HelmV21RuntimeOperatorReviewActionSummary;
  operatorCueSummary: HelmV21RuntimeOperatorCueSummary;
  operatorNextMoveSummary: HelmV21RuntimeOperatorNextMoveSummary;
  operatorActionCueSummary: HelmV21RuntimeOperatorActionCueSummary;
  operatorReviewControlCueSummary: HelmV21RuntimeOperatorReviewControlCueSummary;
  operatorStartPointSummary: HelmV21RuntimeOperatorStartPointSummary;
  operatorWorkSummary: HelmV21RuntimeOperatorWorkSummary;
  handoffPackets: Array<{
    id: string;
    title: string;
    summary: string;
    fromAgent: string;
    toAgent: string;
    approvalTier: string;
    href: string;
    createdAt: Date;
  }>;
  initiativeRuns: Array<{
    id: string;
    title: string;
    summary: string;
    status: string;
    targetOutcome: string;
    href: string;
    createdAt: Date;
  }>;
  coordinationTraceQueue: Array<{
    id: string;
    title: string;
    summary: string;
    posture: string;
    linkageSummary: string;
    humanExecutionSummary: string | null;
    officialFollowThroughSummary: string | null;
    href: string;
    updatedAt: Date;
  }>;
  continuityQueue: Array<{
    id: string;
    meetingId: string | null;
    title: string;
    summary: string;
    runThread: HelmV21RunThreadContract;
    interruptReasonState: HelmV21InterruptReason["state"];
    interruptReasonCode: HelmV21InterruptReason["code"];
    resumeAskMode: HelmV21ResumeAsk["mode"];
    handoffPayloadState: HelmV21HandoffPayloadSkeleton["state"];
    handoffTargetAgent: HelmV2AgentId | null;
    debuggerReplayFidelity: HelmV21OperatorDebuggerReplayFidelity;
    debuggerTraceContractState: HelmV21OperatorDebuggerReadModel["traceContract"]["state"];
    debuggerTraceContractDriver: HelmV21OperatorDebuggerReadModel["traceContract"]["driver"];
    debuggerTraceContractAnchor: HelmV21OperatorDebuggerReadModel["traceContract"]["anchor"];
    debuggerTraceContractCheckpointKey: string | null;
    debuggerTraceContractSummary: string;
    debuggerWriteContractState: HelmV21OperatorDebuggerReadModel["writeContract"]["state"];
    debuggerWriteContractDriver: HelmV21OperatorDebuggerReadModel["writeContract"]["driver"];
    debuggerWriteContractAnchor: HelmV21OperatorDebuggerReadModel["writeContract"]["writeAnchor"];
    debuggerWriteContractCheckpointKey: string | null;
    debuggerWriteContractSummary: string;
    debuggerSwarmSpawnContractState:
      HelmV21OperatorDebuggerReadModel["swarmSpawnContract"]["state"];
    debuggerSwarmSpawnContractDriver:
      HelmV21OperatorDebuggerReadModel["swarmSpawnContract"]["driver"];
    debuggerSwarmSpawnContractDenyReason:
      HelmV21OperatorDebuggerReadModel["swarmSpawnContract"]["denyReason"];
    debuggerSwarmSpawnContractSummary: string;
    debuggerRecoveryActionContractState:
      HelmV21OperatorDebuggerReadModel["recoveryActionContract"]["state"];
    debuggerRecoveryActionContractDriver:
      HelmV21OperatorDebuggerReadModel["recoveryActionContract"]["driver"];
    debuggerRecoveryActionContractAction:
      HelmV21OperatorDebuggerReadModel["recoveryActionContract"]["action"];
    debuggerRecoveryActionContractCheckpointKey: string | null;
    debuggerRecoveryActionContractSummary: string;
    debuggerRecoveryLifecycleContractState:
      HelmV21OperatorDebuggerReadModel["recoveryLifecycleContract"]["state"];
    debuggerRecoveryLifecycleContractDriver:
      HelmV21OperatorDebuggerReadModel["recoveryLifecycleContract"]["driver"];
    debuggerRecoveryLifecycleContractAnchor:
      HelmV21OperatorDebuggerReadModel["recoveryLifecycleContract"]["anchor"];
    debuggerRecoveryLifecycleContractTransition:
      HelmV21OperatorDebuggerReadModel["recoveryLifecycleContract"]["nextTransition"];
    debuggerRecoveryLifecycleContractSummary: string;
    debuggerRecoveryTransitionContractState:
      HelmV21OperatorDebuggerReadModel["recoveryTransitionContract"]["state"];
    debuggerRecoveryTransitionContractDriver:
      HelmV21OperatorDebuggerReadModel["recoveryTransitionContract"]["driver"];
    debuggerRecoveryTransitionContractAnchor:
      HelmV21OperatorDebuggerReadModel["recoveryTransitionContract"]["anchor"];
    debuggerRecoveryTransitionContractTransition:
      HelmV21OperatorDebuggerReadModel["recoveryTransitionContract"]["transition"];
    debuggerRecoveryTransitionContractSummary: string;
    debuggerRecoveryStateMachinePhase:
      HelmV21OperatorDebuggerReadModel["recoveryStateMachineContract"]["phase"];
    debuggerRecoveryStateMachineTransitionState:
      HelmV21OperatorDebuggerReadModel["recoveryStateMachineContract"]["transitionState"];
    debuggerRecoveryStateMachineCurrentTransition:
      HelmV21OperatorDebuggerReadModel["recoveryStateMachineContract"]["currentTransition"];
    debuggerRecoveryStateMachineSummary: string;
    debuggerRecoveryExecutionContractState:
      HelmV21OperatorDebuggerReadModel["recoveryExecutionContract"]["state"];
    debuggerRecoveryExecutionContractTransition:
      HelmV21OperatorDebuggerReadModel["recoveryExecutionContract"]["currentTransition"];
    debuggerRecoveryExecutionContractCanExecute: boolean;
    debuggerRecoveryExecutionContractSummary: string;
    debuggerPersistedLifecycleTrace: HelmV21OperatorDebuggerReadModel["persistedLifecycleTrace"];
    debuggerPersistedLifecycleTraceState:
      HelmV21OperatorDebuggerReadModel["persistedLifecycleTrace"]["state"];
    debuggerPersistedLifecycleTraceAnchor:
      HelmV21OperatorDebuggerReadModel["persistedLifecycleTrace"]["anchor"];
    debuggerTakeoverAssistance: HelmV21OperatorDebuggerReadModel["takeoverAssistance"];
    debuggerTakeoverPosture: HelmV21OperatorDebuggerTakeoverPosture;
    debuggerTakeoverSummary: string;
    debuggerTakeoverRequest: HelmV21OperatorDebuggerTakeoverRequest;
    debuggerTakeoverRequestState: HelmV21OperatorDebuggerTakeoverRequest["state"];
    debuggerTakeoverActivation: HelmV21OperatorDebuggerReadModel["takeoverActivation"];
    debuggerTakeoverActivationState: HelmV21OperatorDebuggerReadModel["takeoverActivation"]["state"];
    debuggerTakeoverFollowThrough: HelmV21OperatorDebuggerReadModel["takeoverFollowThrough"];
    debuggerTakeoverFollowThroughState:
      HelmV21OperatorDebuggerReadModel["takeoverFollowThrough"]["state"];
    debuggerTakeoverOwner: string | null;
    debuggerLatestRemediationTrace: {
      id: string;
      action: string;
      executionStatus: string;
      summary: string;
      rollbackAnchorSummary: string | null;
      triggeredBy: string | null;
      createdAt: Date;
    } | null;
    debuggerHumanInputState: HelmV21RunThreadHumanInputCheckpoint["state"];
    debuggerHumanInputRequestState: HelmV21HumanInputCheckpointRequest["state"];
    operatorActionSummary: HelmV21RuntimeOperatorActionSummary;
    operatorProgressSummary: HelmV21RuntimeOperatorProgressSummary;
    posture: "SAFE" | "WATCH" | "PRUNE" | "COMPACT";
    replayStatus: "STRONG" | "WATCH" | "WEAK" | "NONE";
    payloadStateSource: RuntimePayloadHandleState["stateSource"];
    riskLevel: RuntimeContinuityRiskLevel;
    riskSummary: string;
    recoveryState: "STABLE" | "RECOVERABLE" | "REVIEW_REQUIRED" | "BLOCKED";
    failureTaxonomy:
      | "NONE"
      | "NO_RECOVERY_ANCHOR"
      | "BUDGET_PRESSURE"
      | "PAYLOAD_STATE_DRIFT"
      | "REPLAY_DRIFT"
      | "PROTECTED_STATE_GAP";
    recoverySummary: string;
    rollbackAnchorLabel: string | null;
    checkpointSummary: string | null;
    pruneSummary: string | null;
    remediationAttempts: number;
    repeatPatternStatus:
      | "NONE"
      | "REPEATED_BLOCKED_ACTION"
      | "REPEATED_REVIEW_REQUIRED"
      | "REPEATED_REPRUNE_LOOP"
      | "REPEATED_INEFFECTIVE_ACTION";
    repeatPatternSummary: string;
    calibrationConfidence: "HIGH" | "MEDIUM" | "LOW";
    calibrationSummary: string;
    latestEffectiveness: "NONE" | "EFFECTIVE" | "PARTIAL" | "INEFFECTIVE" | "NO_SIGNAL";
    effectivenessSummary: string;
    meetingShape: "LEAN_MEETING" | "LONG_CONTEXT_MEETING" | "RESUMED_MEETING";
    sessionDensityBand: "LIGHT" | "STEADY" | "HEAVY";
    meetingFrequencyBand: "SPORADIC" | "RECURRING" | "HIGH_CADENCE";
    failureHistoryBand: "FIRST_SIGNAL" | "REPEATED_FAILURE" | "CHRONIC_REPEAT";
    participantRolePosture: "EXEC_SPONSORED" | "OPERATOR_LED" | "MIXED_STAKEHOLDERS" | "UNKNOWN";
    guidanceStatus:
      | "MATCHED_GUIDANCE"
      | "SKIPPED_GUIDANCE"
      | "INEFFECTIVE_AFTER_GUIDANCE"
      | "NEEDS_MORE_EVIDENCE";
    guidanceSummary: string;
    pilotRiskBand: "LOW" | "WATCH" | "HIGH";
    pilotConfidenceBand: "HIGH" | "MEDIUM" | "LOW";
    pilotThreshold: number;
    pilotSampleCoverageBand: "NARROW" | "QUALIFIED" | "BROAD";
    pilotStabilityBand: "UNSTABLE" | "WATCH" | "STABLE";
    pilotStabilityConfidenceBand: "HIGH" | "MEDIUM" | "LOW";
    pilotConfidenceInterval: "WIDE" | "GUARDED" | "SETTLED";
    pilotOutcomeCorrelationBand: "AT_RISK" | "WATCH" | "STABLE";
    pilotLongTermMaterialImpactBand: "HIGH" | "WATCH" | "LOW";
    pilotReviewSummary: string;
    sopTitle: string;
    evidenceSummary: string;
    runbookTitle: string;
    href: string;
    updatedAt: Date;
  }>;
  continuityPilotReview: {
    pilotBasis: string;
    totalPilotCases: number;
    workspaceCohort: {
      sizeBand: "SMALL" | "GROWING" | "LARGE";
      totalSessions: number;
      pilotCaseRate: number;
      summary: string;
    };
    cohortFamilies: Array<{
      cohortKey: string;
      workspaceSizeBand: "SMALL" | "GROWING" | "LARGE";
      meetingShape: "LEAN_MEETING" | "LONG_CONTEXT_MEETING" | "RESUMED_MEETING";
      failureTaxonomy:
        | "NO_RECOVERY_ANCHOR"
        | "BUDGET_PRESSURE"
        | "PAYLOAD_STATE_DRIFT"
        | "REPLAY_DRIFT"
        | "PROTECTED_STATE_GAP";
      sessionCount: number;
      sessionRate: number;
      remediationSuccessRate: number;
      driftRate: number;
      repeatPatternRate: number;
      confidenceBand: "HIGH" | "MEDIUM" | "LOW";
      riskBand: "LOW" | "WATCH" | "HIGH";
      recommendedIneffectiveThreshold: number;
      sampleCoverageBand: "NARROW" | "QUALIFIED" | "BROAD";
      sampleCoverageSummary: string;
      stabilityBand: "UNSTABLE" | "WATCH" | "STABLE";
      stabilityConfidenceBand: "HIGH" | "MEDIUM" | "LOW";
      stabilitySummary: string;
      stabilityVarianceSummary: string;
      summary: string;
      recalibrationSummary: string;
      longHorizonSummary: string;
    }>;
    failureDistribution: Array<{
      failureTaxonomy:
        | "NO_RECOVERY_ANCHOR"
        | "BUDGET_PRESSURE"
        | "PAYLOAD_STATE_DRIFT"
        | "REPLAY_DRIFT"
        | "PROTECTED_STATE_GAP";
      sessionCount: number;
      sessionRate: number;
      ineffectiveRate: number;
      repeatPatternRate: number;
      lowConfidenceRate: number;
      driftRate: number;
      confidenceBand: "HIGH" | "MEDIUM" | "LOW";
      recommendedIneffectiveThreshold: number;
      sampleCoverageBand: "NARROW" | "QUALIFIED" | "BROAD";
      sampleCoverageSummary: string;
      stabilityBand: "UNSTABLE" | "WATCH" | "STABLE";
      stabilityConfidenceBand: "HIGH" | "MEDIUM" | "LOW";
      stabilitySummary: string;
      stabilityVarianceSummary: string;
      topTierFailureClass: boolean;
      summary: string;
      adjustmentSummary: string;
      driftSummary: string;
    }>;
    meetingShapeCohorts: Array<{
      meetingShape: "LEAN_MEETING" | "LONG_CONTEXT_MEETING" | "RESUMED_MEETING";
      sessionCount: number;
      sessionRate: number;
      topFailureClass:
        | "NO_RECOVERY_ANCHOR"
        | "BUDGET_PRESSURE"
        | "PAYLOAD_STATE_DRIFT"
        | "REPLAY_DRIFT"
        | "PROTECTED_STATE_GAP"
        | null;
      remediationSuccessRate: number;
      driftRate: number;
      repeatIneffectiveRate: number;
      confidenceBand: "HIGH" | "MEDIUM" | "LOW";
      recommendedIneffectiveThreshold: number;
      sampleCoverageBand: "NARROW" | "QUALIFIED" | "BROAD";
      sampleCoverageSummary: string;
      stabilityBand: "UNSTABLE" | "WATCH" | "STABLE";
      stabilityConfidenceBand: "HIGH" | "MEDIUM" | "LOW";
      stabilitySummary: string;
      stabilityVarianceSummary: string;
      summary: string;
      thresholdSummary: string;
      driftSummary: string;
    }>;
    sessionDensityCohorts: Array<{
      sessionDensityBand: "LIGHT" | "STEADY" | "HEAVY";
      sessionCount: number;
      sessionRate: number;
      topFailureClass:
        | "NO_RECOVERY_ANCHOR"
        | "BUDGET_PRESSURE"
        | "PAYLOAD_STATE_DRIFT"
        | "REPLAY_DRIFT"
        | "PROTECTED_STATE_GAP"
        | null;
      remediationSuccessRate: number;
      driftRate: number;
      confidenceBand: "HIGH" | "MEDIUM" | "LOW";
      riskBand: "LOW" | "WATCH" | "HIGH";
      recommendedIneffectiveThreshold: number;
      sampleCoverageBand: "NARROW" | "QUALIFIED" | "BROAD";
      sampleCoverageSummary: string;
      stabilityBand: "UNSTABLE" | "WATCH" | "STABLE";
      stabilityConfidenceBand: "HIGH" | "MEDIUM" | "LOW";
      stabilitySummary: string;
      stabilityVarianceSummary: string;
      summary: string;
      calibrationSummary: string;
      driftSummary: string;
    }>;
    meetingFrequencyCohorts: Array<{
      meetingFrequencyBand: "SPORADIC" | "RECURRING" | "HIGH_CADENCE";
      sessionCount: number;
      sessionRate: number;
      topFailureClass:
        | "NO_RECOVERY_ANCHOR"
        | "BUDGET_PRESSURE"
        | "PAYLOAD_STATE_DRIFT"
        | "REPLAY_DRIFT"
        | "PROTECTED_STATE_GAP"
        | null;
      remediationSuccessRate: number;
      driftRate: number;
      confidenceBand: "HIGH" | "MEDIUM" | "LOW";
      riskBand: "LOW" | "WATCH" | "HIGH";
      recommendedIneffectiveThreshold: number;
      sampleCoverageBand: "NARROW" | "QUALIFIED" | "BROAD";
      sampleCoverageSummary: string;
      stabilityBand: "UNSTABLE" | "WATCH" | "STABLE";
      stabilityConfidenceBand: "HIGH" | "MEDIUM" | "LOW";
      stabilitySummary: string;
      stabilityVarianceSummary: string;
      summary: string;
      calibrationSummary: string;
      driftSummary: string;
    }>;
    failureHistoryCohorts: Array<{
      failureHistoryBand: "FIRST_SIGNAL" | "REPEATED_FAILURE" | "CHRONIC_REPEAT";
      sessionCount: number;
      sessionRate: number;
      topFailureClass:
        | "NO_RECOVERY_ANCHOR"
        | "BUDGET_PRESSURE"
        | "PAYLOAD_STATE_DRIFT"
        | "REPLAY_DRIFT"
        | "PROTECTED_STATE_GAP"
        | null;
      reviewRequiredRate: number;
      ineffectiveAfterGuidanceRate: number;
      confidenceBand: "HIGH" | "MEDIUM" | "LOW";
      riskBand: "LOW" | "WATCH" | "HIGH";
      recommendedIneffectiveThreshold: number;
      sampleCoverageBand: "NARROW" | "QUALIFIED" | "BROAD";
      sampleCoverageSummary: string;
      stabilityBand: "UNSTABLE" | "WATCH" | "STABLE";
      stabilityConfidenceBand: "HIGH" | "MEDIUM" | "LOW";
      stabilitySummary: string;
      stabilityVarianceSummary: string;
      summary: string;
      varianceSummary: string;
    }>;
    participantRoleCohorts: Array<{
      participantRolePosture: "EXEC_SPONSORED" | "OPERATOR_LED" | "MIXED_STAKEHOLDERS" | "UNKNOWN";
      sessionCount: number;
      sessionRate: number;
      topFailureClass:
        | "NO_RECOVERY_ANCHOR"
        | "BUDGET_PRESSURE"
        | "PAYLOAD_STATE_DRIFT"
        | "REPLAY_DRIFT"
        | "PROTECTED_STATE_GAP"
        | null;
      remediationSuccessRate: number;
      driftRate: number;
      confidenceBand: "HIGH" | "MEDIUM" | "LOW";
      riskBand: "LOW" | "WATCH" | "HIGH";
      recommendedIneffectiveThreshold: number;
      sampleCoverageBand: "NARROW" | "QUALIFIED" | "BROAD";
      sampleCoverageSummary: string;
      stabilityBand: "UNSTABLE" | "WATCH" | "STABLE";
      stabilityConfidenceBand: "HIGH" | "MEDIUM" | "LOW";
      stabilitySummary: string;
      stabilityVarianceSummary: string;
      summary: string;
      calibrationSummary: string;
      driftSummary: string;
    }>;
    remediationPostureCohorts: Array<{
      recoveryState: "STABLE" | "RECOVERABLE" | "REVIEW_REQUIRED" | "BLOCKED";
      latestEffectiveness: "NONE" | "EFFECTIVE" | "PARTIAL" | "INEFFECTIVE" | "NO_SIGNAL";
      sessionCount: number;
      sessionRate: number;
      topFailureClass:
        | "NO_RECOVERY_ANCHOR"
        | "BUDGET_PRESSURE"
        | "PAYLOAD_STATE_DRIFT"
        | "REPLAY_DRIFT"
        | "PROTECTED_STATE_GAP"
        | null;
      driftRate: number;
      reviewRequiredRate: number;
      confidenceBand: "HIGH" | "MEDIUM" | "LOW";
      riskBand: "LOW" | "WATCH" | "HIGH";
      recommendedIneffectiveThreshold: number;
      sampleCoverageBand: "NARROW" | "QUALIFIED" | "BROAD";
      sampleCoverageSummary: string;
      stabilityBand: "UNSTABLE" | "WATCH" | "STABLE";
      stabilityConfidenceBand: "HIGH" | "MEDIUM" | "LOW";
      stabilitySummary: string;
      stabilityVarianceSummary: string;
      summary: string;
      varianceSummary: string;
    }>;
    remediationOutcomeReview: Array<{
      outcome: "NONE" | "EFFECTIVE" | "PARTIAL" | "INEFFECTIVE" | "NO_SIGNAL";
      sessionCount: number;
      sessionRate: number;
      topFailureClass:
        | "NO_RECOVERY_ANCHOR"
        | "BUDGET_PRESSURE"
        | "PAYLOAD_STATE_DRIFT"
        | "REPLAY_DRIFT"
        | "PROTECTED_STATE_GAP"
        | null;
      driftRate: number;
      summary: string;
    }>;
    topFailureClasses: Array<{
      failureTaxonomy:
        | "NO_RECOVERY_ANCHOR"
        | "BUDGET_PRESSURE"
        | "PAYLOAD_STATE_DRIFT"
        | "REPLAY_DRIFT"
        | "PROTECTED_STATE_GAP";
      sessionCount: number;
      sessionRate: number;
      ineffectiveRate: number;
      repeatPatternRate: number;
      lowConfidenceRate: number;
      driftRate: number;
      confidenceBand: "HIGH" | "MEDIUM" | "LOW";
      recommendedIneffectiveThreshold: number;
      stabilityBand: "UNSTABLE" | "WATCH" | "STABLE";
      stabilityConfidenceBand: "HIGH" | "MEDIUM" | "LOW";
      stabilitySummary: string;
      stabilityVarianceSummary: string;
      topTierFailureClass: boolean;
      summary: string;
      adjustmentSummary: string;
      driftSummary: string;
    }>;
    calibrationProfile: {
      defaultIneffectiveThreshold: number;
      confidenceBandSummary: string;
      riskBandSummary: string;
      summary: string;
      classAdjustments: string[];
      revisedHighlights: string[];
    };
    subgroupCalibration: {
      summary: string;
      cohortHighlights: string[];
    };
    sampleReview: {
      summary: string;
      aggregateSummary: string;
      cohortHighlights: string[];
    };
    stabilityReview: {
      stabilityThreshold: number;
      stableSubgroups: number;
      watchSubgroups: number;
      unstableSubgroups: number;
      summary: string;
      aggregateSummary: string;
      subgroupHighlights: string[];
    };
    stabilityRecheck: {
      summary: string;
      aggregateSummary: string;
      highlights: string[];
    };
    stabilityScaleUp: {
      summary: string;
      aggregateSummary: string;
      findings: string[];
    };
    stabilityScaleUpRecheck: {
      summary: string;
      aggregateSummary: string;
      findings: string[];
    };
    subgroupStabilityDriftReview: {
      summary: string;
      aggregateSummary: string;
      findings: string[];
    };
    subgroupCohortAgingReview: {
      summary: string;
      aggregateSummary: string;
      findings: string[];
    };
    subgroupDriftAgingScaleUpReview: {
      summary: string;
      aggregateSummary: string;
      findings: string[];
    };
    subgroupDriftLongTermCohortAgingReview: {
      summary: string;
      aggregateSummary: string;
      findings: string[];
    };
    subgroupDriftLongTermSampleExpansionReview: {
      summary: string;
      aggregateSummary: string;
      findings: string[];
    };
    subgroupDriftLongTermSampleExpansionRefinementReview: {
      summary: string;
      aggregateSummary: string;
      findings: string[];
    };
    confidenceSimplification: {
      summary: string;
      aggregateSummary: string;
      highlights: string[];
    };
    intervalWordingConsistency: {
      summary: string;
      aggregateSummary: string;
      highlights: string[];
    };
    intervalWordingDriftAudit: {
      summary: string;
      aggregateSummary: string;
      findings: string[];
    };
    wordingDriftTracking: {
      driftRate: number;
      summary: string;
      aggregateSummary: string;
      findings: string[];
    };
    intervalConsistencyGuidance: {
      summary: string;
      aggregateSummary: string;
      guidelines: string[];
    };
    intervalWordingAgingAudit: {
      regressionRate: number;
      summary: string;
      aggregateSummary: string;
      findings: string[];
    };
    intervalWordingCrossSurfaceRegressionReview: {
      regressionRate: number;
      summary: string;
      aggregateSummary: string;
      findings: string[];
      adjustmentRecommendations: string[];
    };
    intervalWordingCrossSurfaceConsistencyAudit: {
      regressionRate: number;
      summary: string;
      aggregateSummary: string;
      findings: string[];
      adjustmentRecommendations: string[];
    };
    intervalWordingCrossSurfaceRegressionAudit: {
      regressionRate: number;
      summary: string;
      aggregateSummary: string;
      findings: string[];
      adjustmentRecommendations: string[];
    };
    intervalWordingCrossReadoutRegressionAudit: {
      regressionRate: number;
      summary: string;
      aggregateSummary: string;
      findings: string[];
      adjustmentRecommendations: string[];
    };
    intervalWordingCrossReadoutRegressionRefinement: {
      regressionRate: number;
      summary: string;
      aggregateSummary: string;
      findings: string[];
      adjustmentRecommendations: string[];
    };
    drift: {
      improvingSessions: number;
      stableSessions: number;
      driftingSessions: number;
      repeatedIneffectiveSessions: number;
      driftRate: number;
      recentDriftRate: number;
      middleDriftRate: number;
      olderDriftRate: number;
      oldestDriftRate: number;
      longHorizonDriftRate: number;
      driftRateDelta: number;
      recentRepeatIneffectiveRate: number;
      longHorizonRepeatIneffectiveRate: number;
      longHorizonEffectivenessRate: number;
      effectivenessChange: number;
      materiallyDriftingCohorts: string[];
      summary: string;
    };
    driftSynthesis: {
      summary: string;
      panels: string[];
    };
    longTermOutcomeCorrelation: {
      summary: string;
      aggregateSummary: string;
      panels: string[];
    };
    thresholdRevisions: Array<{
      scope: string;
      scopeType:
        | "failure_class"
        | "meeting_shape"
        | "cohort_family"
        | "remediation_posture"
        | "session_density"
        | "meeting_frequency"
        | "failure_history"
        | "participant_role";
      recommendedIneffectiveThreshold: number;
      confidenceBand: "HIGH" | "MEDIUM" | "LOW";
      riskBand: "LOW" | "WATCH" | "HIGH";
      sampleCoverageBand: "NARROW" | "QUALIFIED" | "BROAD";
      sampleCoverageSummary: string;
      stabilityBand: "UNSTABLE" | "WATCH" | "STABLE";
      stabilityConfidenceBand: "HIGH" | "MEDIUM" | "LOW";
      confidenceInterval: "WIDE" | "GUARDED" | "SETTLED";
      bandAdjustmentRationale: string;
      intervalWordingSummary: string;
      confidenceSummary: string;
      summary: string;
    }>;
    operatorHandlingEffectiveness: {
      matchedGuidanceRate: number;
      skippedGuidanceRate: number;
      ineffectiveAfterGuidanceRate: number;
      reviewEscalationRate: number;
      outcomeVarianceSummary: string;
      stepReviews: Array<{
        stepId:
          | "ANCHOR_CHECK"
          | "PRUNE_TRACE_REVIEW"
          | "HANDLE_LINEAGE_REVIEW"
          | "REPLAY_GAP_REVIEW"
          | "PROTECTED_FIELD_REVIEW";
        label: string;
        applicableCases: number;
        matchedGuidanceRate: number;
        skippedGuidanceRate: number;
        ineffectiveAfterHitRate: number;
        effectiveOutcomeRate: number;
        reviewRequiredOutcomeRate: number;
        sampleCoverageBand: "NARROW" | "QUALIFIED" | "BROAD";
        stabilityBand: "UNSTABLE" | "WATCH" | "STABLE";
        stabilityConfidenceBand: "HIGH" | "MEDIUM" | "LOW";
        confidenceInterval: "WIDE" | "GUARDED" | "SETTLED";
        bandAdjustmentRationale: string;
        intervalWordingSummary: string;
        recentEffectiveOutcomeRate: number;
        olderEffectiveOutcomeRate: number;
        longHorizonEffectiveOutcomeRate: number;
        outcomeDelta: number;
        correlationBand: "AT_RISK" | "WATCH" | "STABLE";
        correlationSummary: string;
        longTermImpactSummary: string;
        materialImpactBand: "HIGH" | "WATCH" | "LOW";
        materialImpactSummary: string;
        summary: string;
        improvementHint: string;
      }>;
      summary: string;
      highlights: string[];
    };
    sopEffectivenessSynthesis: {
      summary: string;
      aggregateSummary: string;
      highlights: string[];
    };
    longTermSopImpact: {
      summary: string;
      aggregateSummary: string;
      highlights: string[];
    };
    longTermOutcomeReview: {
      summary: string;
      aggregateSummary: string;
      highlights: string[];
    };
    longTermMaterialImpactReview: {
      summary: string;
      aggregateSummary: string;
      findings: string[];
    };
    longTermMaterialImpactAudit: {
      summary: string;
      aggregateSummary: string;
      impactPatterns: string[];
      optimizationHints: string[];
    };
    materialImpactPatternAgingReview: {
      summary: string;
      aggregateSummary: string;
      patterns: string[];
      optimizationHints: string[];
    };
    materialImpactSamplingReview: {
      summary: string;
      aggregateSummary: string;
      findings: string[];
      optimizationHints: string[];
    };
    materialImpactSamplingAgingReview: {
      summary: string;
      aggregateSummary: string;
      findings: string[];
      optimizationHints: string[];
    };
    materialImpactSamplingAgingRefinement: {
      summary: string;
      aggregateSummary: string;
      findings: string[];
      optimizationHints: string[];
    };
    materialImpactSamplingAgingAudit: {
      summary: string;
      aggregateSummary: string;
      findings: string[];
      optimizationSuggestions: string[];
    };
    materialImpactSamplingAgingRefinementAudit: {
      summary: string;
      aggregateSummary: string;
      findings: string[];
      optimizationSuggestions: string[];
    };
    guidanceRefinement: {
      summary: string;
      highlights: string[];
    };
    sopHighlights: string[];
  };
  coordinationMetrics: {
    metricDate: Date | null;
    actionReady: number;
    reviewNeeded: number;
    waitingOnSignal: number;
    waitingOnAuthority: number;
    capabilityGap: number;
  };
  cacheHealth: {
    entries: number;
    hitRate: number;
    tokensSaved: number;
  };
};

export type WorkspaceBusinessLoopGapReadout = {
  operatingGaps: OperatingGap[];
  operatingGapSummary: OperatingGapSummary;
  businessLoopGapSummary: BusinessLoopGapSummary;
};

type WorkspaceRuntimeOperatorOverviewInput = {
  workspaceId: string;
  swarmReadOnlyWorkersEnabled?: boolean;
  sessionCounts: {
    total: number;
    active: number;
  };
  queueCounts: {
    verification: number;
    promotion: number;
    reflectionCarryForward: number;
    openProblemSpaces: number;
    unresolvedCompositionFailures: number;
    reflectionQueue: number;
    consolidationQueue: number;
  };
  verificationReports: Array<{
    id: string;
    reportType: string;
    status: string;
    truthScore: number;
    summary: string;
    createdAt: Date;
    runtimeSession: {
      id: string;
      label: string;
      meetingId: string | null;
    };
  }>;
  truthConflicts: Array<{
    id: string;
    status: string;
    summary: string;
    subjectKey: string;
    createdAt: Date;
    runtimeSession: {
      id: string;
      label: string;
      meetingId: string | null;
    };
  }>;
  memoryCandidates: Array<{
    id: string;
    status: string;
    summary: string;
    reviewerNote: string | null;
    sourceVerification: string;
    sourceStatus: string;
    evidenceRefs: string | null;
    confidence: number | null;
    memoryItemId?: string | null;
    createdAt: Date;
    runtimeSession: {
      id: string;
      label: string;
      meetingId: string | null;
    };
  }>;
  memoryPromotions: Array<{
    id: string;
    memoryCandidateId?: string | null;
    memoryItemId?: string | null;
    status: string;
    rationale: string;
    createdAt: Date;
    runtimeSession: {
      id: string;
      label: string;
      meetingId: string | null;
    };
  }>;
  problemSpaces: Array<{
    id: string;
    title: string;
    summary: string;
    nextStep: string;
    status: string;
    ownerHint: string | null;
    evidenceRefs: string | null;
    updatedAt: Date;
    meetingId: string | null;
    opportunityId: string | null;
    companyId: string | null;
    driAssignments: Array<{
      assignedUserName: string | null;
      assignedByName: string | null;
      note: string | null;
    }>;
    runtimeSession: {
      meetingId: string | null;
    };
  }>;
  playerCoachBriefs: Array<{
    id: string;
    title: string;
    summary: string;
    updatedAt: Date;
    problemSpaceId: string | null;
    runtimeSession: {
      meetingId: string | null;
    };
    problemSpace: {
      id: string;
      title: string;
      meetingId: string | null;
      status: string;
      ownerHint: string | null;
      evidenceRefs: string | null;
      driAssignments: Array<{
        assignedUserName: string | null;
        assignedByName: string | null;
        note: string | null;
      }>;
    } | null;
  }>;
  compositionFailures: Array<{
    id: string;
    failureClass: string;
    summary: string;
    problemSpace: {
      title: string;
    } | null;
    createdAt: Date;
    runtimeSession: {
      id: string;
      label: string;
      meetingId: string | null;
    };
  }>;
  consolidationJobs: Array<{
    id: string;
    jobType: string;
    status: string;
    inputSummary: string;
    outputSummary: string | null;
    reviewPosture: string;
    createdAt: Date;
    pausedAt: Date | null;
    completedAt: Date | null;
    runtimeSession: {
      meetingId: string | null;
    } | null;
  }>;
  signals: Array<{
    id: string;
    signalType: string;
    sourceType: string;
    signalSummary: string;
    truthWeight: number;
    createdAt: Date;
    runtimeSession: {
      meetingId: string | null;
    };
  }>;
  capabilities: Array<{
    id: string;
    name: string;
    stage: string;
    description: string;
    loadPolicy: string;
    reviewRequired: boolean;
    boundaryNote?: string | null;
  }>;
  connectors: Array<{
    id: string;
    provider: string;
    status: string;
    lastSyncedAt: Date | null;
    lastSyncStatus: string | null;
    lastSyncMessage: string | null;
  }>;
  handoffPackets: Array<{
    id: string;
    goal: string;
    approvalTier: string;
    fromAgent: string;
    toAgent: string;
    createdAt: Date;
    runtimeSession: {
      meetingId: string | null;
    };
  }>;
  initiativeRuns: Array<{
    id: string;
    title: string;
    summary: string;
    status: string;
    targetOutcome: string;
    createdAt: Date;
    runtimeSession: {
      meetingId: string | null;
    };
  }>;
  humanExecutions: Array<{
    id: string;
    meetingId: string;
    opportunityId: string | null;
    companyId: string | null;
    status: string;
    executionAcknowledgementStatus: string;
    executionIntent: string;
    executionOwnerName: string | null;
    followThroughStatus: string | null;
    executedAt: Date | null;
    updatedAt: Date;
  }>;
  officialWriteIntents: Array<{
    id: string;
    meetingId: string;
    opportunityId: string | null;
    companyId: string | null;
    writeActionType: string;
    officialObjectRef: string;
    writeExecutionStatus: string;
    writeAcknowledgementStatus: string;
    acknowledgedAt: Date | null;
    updatedAt: Date;
  }>;
  limitedAutoIntents: Array<{
    id: string;
    meetingId: string;
    opportunityId: string | null;
    companyId: string | null;
    limitedAutoActionType: string;
    officialObjectRef: string;
    limitedAutoExecutionStatus: string;
    limitedAutoAckStatus: string;
    acknowledgedAt: Date | null;
    updatedAt: Date;
  }>;
  officialFollowThrough: Array<{
    id: string;
    meetingId: string;
    opportunityId: string | null;
    companyId: string | null;
    followThroughStatus: string;
    followThroughResolutionStatus: string;
    followThroughOwnerName: string | null;
    followThroughNextAction: string | null;
    followThroughSummary: string | null;
    updatedAt: Date;
  }>;
  coordinationMetrics: {
    metricDate: Date;
    actionReadyCount: number;
    reviewNeededCount: number;
    waitingOnSignalCount: number;
    waitingOnAuthorityCount: number;
    capabilityGapCount: number;
  } | null;
  cacheTelemetry: Array<{
    cacheStatus: string;
    tokensSaved: number;
  }>;
  benchmarkMatrixRuns?: HelmV21BenchmarkRecordedRun[];
  benchmarkExecutionRequests?: HelmV21BenchmarkExecutionRequest[];
  benchmarkExecutionAcknowledgements?: HelmV21BenchmarkExecutionAcknowledgement[];
  benchmarkExecutionFollowThrough?: HelmV21BenchmarkExecutionFollowThrough[];
  runtimeSessions?: Array<{
    id: string;
    workspaceId: string;
    label: string;
    sessionKey: string;
    status: string;
    currentStage: string;
    sourcePage: string | null;
    boundaryNote: string;
    replayableEventLog: string | null;
    meetingId: string | null;
    opportunityId?: string | null;
    companyId?: string | null;
    budgetTokenLimit: number;
    budgetTokenUsed: number;
    prunedTokenCount: number;
    resumedFromKey: string | null;
    controlPlaneLifecycleJson?: string | null;
    controlPlaneLifecycleUpdatedAt?: Date | null;
    createdAt: Date;
    updatedAt: Date;
    closedAt: Date | null;
    meetingStartsAt?: Date | null;
    meetingFrequencyBand?: "SPORADIC" | "RECURRING" | "HIGH_CADENCE";
    participantRolePosture?: "EXEC_SPONSORED" | "OPERATOR_LED" | "MIXED_STAKEHOLDERS" | "UNKNOWN";
    contextEditEvents: Array<{
      id: string;
      strategy: string;
      beforeTokenCount: number;
      afterTokenCount: number;
      removedHandles: string | null;
      removedSummary: string | null;
      createdAt: Date;
    }>;
    checkpoints: Array<{
      id: string;
      checkpointKey: string;
      label: string;
      status: string;
      summary: string;
      snapshotJson: string;
      createdAt: Date;
      updatedAt: Date;
    }>;
    notebook: {
      sessionSummary: string;
      decisionSummary: string | null;
      blockerSummary: string | null;
      pendingQuestions: string | null;
      openLoopSummary: string | null;
      boundaryNote: string;
    } | null;
    problemSpaces: Array<{
      title: string;
      nextStep: string;
      status: string;
      ownerHint: string | null;
      evidenceRefs: string | null;
    }>;
    memoryCandidates: Array<{
      id?: string | null;
      summary: string;
      status: string;
      evidenceRefs: string | null;
      sourceVerification: string;
    }>;
    memoryPromotions: Array<{
      memoryCandidateId: string | null;
      status: string;
    }>;
    verificationReports: Array<{
      status: string;
      summary: string;
      blockedReasons: string;
    }>;
    truthConflicts?: Array<{
      id: string;
      status: string;
      summary: string;
    }>;
    handoffPackets: Array<{
      id: string;
      packetKey: string;
      fromAgent: HelmV2AgentId;
      toAgent: HelmV2AgentId;
      goal: string;
      approvalTier: HelmV2ApprovalTier;
      constraintsJson: string | null;
      trustedRefs: string | null;
      untrustedRefs: string | null;
      requiredOutputs: string | null;
      evidenceRefs: string | null;
      notebookRef: string | null;
      checkpointRef: string | null;
      createdAt: Date;
    }>;
    persistedPayloadHandles: string[];
    remediationEvents?: Array<{
      id: string;
      eventType: string;
      payload: string | null;
      trustedContext: string | null;
      triggeredBy: string;
      createdAt: Date;
    }>;
    requestEvents?: Array<{
      id: string;
      eventType: string;
      payload: string | null;
      trustedContext: string | null;
      triggeredBy: string;
      createdAt: Date;
    }>;
  }>;
};

type WorkspaceBusinessLoopGapReadoutInput = {
  workspaceId: string;
  truthConflicts: Array<{
    id: string;
    status: string;
    summary: string;
    subjectKey: string;
    createdAt: Date;
    runtimeSession: {
      meetingId: string | null;
    };
  }>;
  problemSpaces: Array<{
    id: string;
    title: string;
    summary: string;
    nextStep: string;
    status: string;
    ownerHint: string | null;
    evidenceRefs: string | null;
    updatedAt: Date;
    meetingId: string | null;
    runtimeSession: {
      meetingId: string | null;
    };
  }>;
  compositionFailures: Array<{
    id: string;
    failureClass: string;
    summary: string;
    problemSpace: {
      title: string;
    } | null;
    createdAt: Date;
    runtimeSession: {
      meetingId: string | null;
    };
  }>;
  coordinationMetrics: {
    metricDate: Date;
  } | null;
};

function buildRuntimePostureFromDebuggerState(input: {
  runThread: HelmV21RunThreadContract;
  recovery: RuntimeRecoveryState;
  notebookState: RuntimeNotebookState;
  verification: {
    status: string;
    blockedReasons: string[];
  } | null;
  handoffPackets: RuntimeDebuggerHandoffPacket[];
}): HelmV21RuntimePostureSnapshot {
  return buildRuntimePostureSnapshot({
    runThread: input.runThread,
    interruptReason: buildOperatorDebuggerInterruptReason({
      runThread: input.runThread,
      recovery: input.recovery,
      verification: input.verification,
    }),
    resumeAsk: buildOperatorDebuggerResumeAsk({
      runThread: input.runThread,
      recovery: input.recovery,
      notebookState: input.notebookState,
      verification: input.verification,
    }),
    handoffPayload: buildOperatorDebuggerHandoffPayload({
      runThread: input.runThread,
      handoffPackets: input.handoffPackets,
    }),
  });
}

async function upsertRuntimeHandoffPacket(input: {
  workspaceId: string;
  runtimeSessionId: string;
  problemSpaceId?: string | null;
  packetKey: string;
  fromAgent: HelmV2AgentId;
  toAgent: HelmV2AgentId;
  goal: string;
  constraints: string[];
  trustedRefs: string[];
  untrustedRefs: string[];
  requiredOutputs: string[];
  evidenceRefs: string[];
  notebookRef?: string | null;
  checkpointRef?: string | null;
  approvalTier: HelmV2ApprovalTier;
}) {
  const contract = buildRuntimeHandoffPacketContract({
    handoffId: input.packetKey,
    packetKey: input.packetKey,
    fromAgent: input.fromAgent,
    toAgent: input.toAgent,
    goal: input.goal,
    objectRefs: {
      workspaceId: input.workspaceId,
    },
    constraints: input.constraints,
    trustedRefs: input.trustedRefs,
    untrustedRefs: input.untrustedRefs,
    requiredOutputs: input.requiredOutputs,
    evidenceRefs: input.evidenceRefs,
    notebookRef: input.notebookRef,
    checkpointRef: input.checkpointRef,
    approvalTier: input.approvalTier,
  });
  const record = await db.handoffPacket.upsert({
    where: { packetKey: input.packetKey },
    update: {
      problemSpaceId: input.problemSpaceId ?? null,
      fromAgent: contract.fromAgent,
      toAgent: contract.toAgent,
      goal: contract.goal,
      constraintsJson: jsonStringify(contract.constraints),
      trustedRefs: jsonStringify(contract.trustBoundary.trusted),
      untrustedRefs: jsonStringify(contract.trustBoundary.untrusted),
      requiredOutputs: jsonStringify(contract.requiredOutputs),
      evidenceRefs: jsonStringify(contract.evidenceRefs),
      notebookRef: contract.notebookRef ?? null,
      checkpointRef: contract.checkpointRef ?? null,
      approvalTier: contract.approvalTier,
    },
    create: {
      workspaceId: input.workspaceId,
      runtimeSessionId: input.runtimeSessionId,
      problemSpaceId: input.problemSpaceId ?? null,
      packetKey: input.packetKey,
      fromAgent: contract.fromAgent,
      toAgent: contract.toAgent,
      goal: contract.goal,
      constraintsJson: jsonStringify(contract.constraints),
      trustedRefs: jsonStringify(contract.trustBoundary.trusted),
      untrustedRefs: jsonStringify(contract.trustBoundary.untrusted),
      requiredOutputs: jsonStringify(contract.requiredOutputs),
      evidenceRefs: jsonStringify(contract.evidenceRefs),
      notebookRef: contract.notebookRef ?? null,
      checkpointRef: contract.checkpointRef ?? null,
      approvalTier: contract.approvalTier,
    },
  });

  return {
    record,
    contract: {
      ...contract,
      handoffId: record.id,
      objectRefs: {
        ...contract.objectRefs,
        handoffId: record.id,
      },
    },
  };
}

async function syncProblemSpaceRuntimeObjects(input: {
  workspaceId: string;
  runtimeSessionId: string;
  problemSpace: {
    id: string;
    title: string;
    summary: string;
    nextStep: string;
    ownerHint?: string | null;
  };
  meetingId?: string | null;
  assignedUserId?: string | null;
  assignedUserName?: string | null;
  assignedByUserId?: string | null;
  assignedByName: string;
  assignmentNote?: string | null;
  evidenceRefs: string[];
  coordinationOutcome: HelmV21CoordinationOutcome;
}) {
  const assignmentKey = `${input.workspaceId}:dri:${input.problemSpace.id}`;
  const assignment = await db.driAssignment.upsert({
    where: { assignmentKey },
    update: {
      assignedUserId: input.assignedUserId ?? undefined,
      assignedUserName: input.assignedUserName ?? undefined,
      assignedByUserId: input.assignedByUserId ?? undefined,
      assignedByName: input.assignedByName,
      note: input.assignmentNote ?? undefined,
    },
    create: {
      workspaceId: input.workspaceId,
      problemSpaceId: input.problemSpace.id,
      assignmentKey,
      assignedUserId: input.assignedUserId ?? undefined,
      assignedUserName: input.assignedUserName ?? undefined,
      assignedByUserId: input.assignedByUserId ?? undefined,
      assignedByName: input.assignedByName,
      note: input.assignmentNote ?? undefined,
    },
  });
  await createRuntimeUpgradeEvent({
    workspaceId: input.workspaceId,
    meetingId: input.meetingId ?? null,
    relatedObjectType: "ProblemSpace",
    relatedObjectId: input.problemSpace.id,
    eventType: "dri.assigned",
    payload: {
      problemSpaceId: input.problemSpace.id,
      assignedUserName: input.assignedUserName ?? input.problemSpace.ownerHint ?? null,
      assignedByName: input.assignedByName,
      note: assignment.note ?? null,
    },
    trustedContext: {
      runtimeSessionId: input.runtimeSessionId,
    },
    triggeredBy: "handoff-manager",
  });

  for (const audience of ["IC", "DRI", "PLAYER_COACH"] as const) {
    const briefKey = `${input.workspaceId}:edge-brief:${input.problemSpace.id}:${audience}`;
    const briefContent = buildProblemSpaceBriefContent({
      audience,
      problemSpace: input.problemSpace,
      evidenceRefs: input.evidenceRefs,
      coordinationOutcome: input.coordinationOutcome,
      assignedUserName: assignment.assignedUserName ?? input.assignedUserName ?? input.problemSpace.ownerHint,
      assignedByName: assignment.assignedByName ?? input.assignedByName,
      assignmentNote: assignment.note ?? input.assignmentNote,
    });
    const brief = await db.edgeBrief.upsert({
      where: { briefKey },
      update: {
        audience,
        title: `${input.problemSpace.title} (${audience})`,
        summary: briefContent.summary,
        markdown: briefContent.markdown,
      },
      create: {
        workspaceId: input.workspaceId,
        runtimeSessionId: input.runtimeSessionId,
        problemSpaceId: input.problemSpace.id,
        briefKey,
        audience,
        title: `${input.problemSpace.title} (${audience})`,
        summary: briefContent.summary,
        markdown: briefContent.markdown,
      },
    });
    await createRuntimeUpgradeEvent({
      workspaceId: input.workspaceId,
      meetingId: input.meetingId ?? null,
      relatedObjectType: "EdgeBrief",
      relatedObjectId: brief.id,
      eventType: "edge-brief.generated",
      payload: {
        audience,
        problemSpaceId: input.problemSpace.id,
        coordinationOutcome: input.coordinationOutcome,
      },
      trustedContext: {
        runtimeSessionId: input.runtimeSessionId,
      },
      triggeredBy: "handoff-manager",
    });
  }

  const initiativeKey = `${input.workspaceId}:initiative:${input.problemSpace.id}`;
  const initiative = await db.initiativeRun.upsert({
    where: { initiativeKey },
    update: {
      title: input.problemSpace.title,
      summary: input.problemSpace.summary,
      status: mapCoordinationOutcomeToInitiativeStatus(input.coordinationOutcome),
      targetOutcome: input.problemSpace.nextStep,
      boundaryNote: RUNTIME_BOUNDARY_NOTE,
    },
    create: {
      workspaceId: input.workspaceId,
      runtimeSessionId: input.runtimeSessionId,
      problemSpaceId: input.problemSpace.id,
      initiativeKey,
      title: input.problemSpace.title,
      summary: input.problemSpace.summary,
      status: mapCoordinationOutcomeToInitiativeStatus(input.coordinationOutcome),
      targetOutcome: input.problemSpace.nextStep,
      boundaryNote: RUNTIME_BOUNDARY_NOTE,
    },
  });
  await createRuntimeUpgradeEvent({
    workspaceId: input.workspaceId,
    meetingId: input.meetingId ?? null,
    relatedObjectType: "InitiativeRun",
    relatedObjectId: initiative.id,
    eventType: "problem-space.created",
    payload: {
      problemSpaceId: input.problemSpace.id,
      initiativeRunId: initiative.id,
      coordinationOutcome: input.coordinationOutcome,
    },
    trustedContext: {
      runtimeSessionId: input.runtimeSessionId,
    },
    triggeredBy: "helm-core",
  });

  const { record: handoff, contract: handoffContract } = await upsertRuntimeHandoffPacket({
    workspaceId: input.workspaceId,
    runtimeSessionId: input.runtimeSessionId,
    problemSpaceId: input.problemSpace.id,
    packetKey: `${input.workspaceId}:handoff:${input.problemSpace.id}:coordination`,
    fromAgent: "lead-orchestrator",
    toAgent: "handoff-manager",
    goal: `Turn ${input.problemSpace.title} into bounded DRI and edge-ready follow-through.`,
    constraints: [
      "review-first",
      "no auto-send",
      "no broad auto-write",
      "edge briefs remain internal-only",
    ],
    trustedRefs: input.evidenceRefs,
    untrustedRefs: [],
    requiredOutputs: ["problem_space", "dri_assignment", "edge_brief"],
    evidenceRefs: input.evidenceRefs,
    approvalTier: "A1",
  });
  await createRuntimeUpgradeEvent({
    workspaceId: input.workspaceId,
    meetingId: input.meetingId ?? null,
    relatedObjectType: "HandoffPacket",
    relatedObjectId: handoff.id,
    eventType: "handoff.packet.created",
    payload: {
      problemSpaceId: input.problemSpace.id,
      fromAgent: handoff.fromAgent,
      toAgent: handoff.toAgent,
      approvalTier: handoff.approvalTier,
      handoff: handoffContract,
    },
    trustedContext: {
      runtimeSessionId: input.runtimeSessionId,
    },
    triggeredBy: "handoff-manager",
  });
}

async function refreshRuntimeCoordinationMetrics(workspaceId: string) {
  const metricDate = buildMetricDate();
  const [
    activeSessions,
    reviewReports,
    watchingProblemSpaces,
    truthConflicts,
    activeInitiatives,
    waitingOnSignalInitiatives,
    waitingOnAuthorityInitiatives,
    capabilityGapInitiatives,
    openProblemSpaces,
  ] = await Promise.all([
    db.runtimeSession.count({
      where: {
        workspaceId,
        status: {
          in: [
            "ACTIVE",
            "AWAITING_WORKER",
            "AWAITING_REVIEW",
            "AWAITING_APPROVAL",
            "COMPACTING",
            "CHECKPOINTED",
            "BLOCKED",
          ],
        },
      },
    }),
    db.verificationReport.count({
      where: {
        workspaceId,
        status: { not: "PASSED" },
      },
    }),
    db.problemSpace.count({
      where: {
        workspaceId,
        status: "WATCHING",
      },
    }),
    db.truthConflict.count({
      where: {
        workspaceId,
        status: "OPEN",
      },
    }),
    db.initiativeRun.count({
      where: {
        workspaceId,
        status: "ACTIVE",
      },
    }),
    db.initiativeRun.count({
      where: {
        workspaceId,
        status: "WAITING_ON_SIGNAL",
      },
    }),
    db.initiativeRun.count({
      where: {
        workspaceId,
        status: "WAITING_ON_AUTHORITY",
      },
    }),
    db.initiativeRun.count({
      where: {
        workspaceId,
        status: "CAPABILITY_GAP",
      },
    }),
    db.problemSpace.count({
      where: {
        workspaceId,
        status: {
          notIn: ["RESOLVED", "RETIRED"],
        },
      },
    }),
  ]);

  return db.coordinationMetricsDaily.upsert({
    where: {
      workspaceId_metricDate: {
        workspaceId,
        metricDate,
      },
    },
    update: {
      activeSessions,
      actionReadyCount: activeInitiatives,
      reviewNeededCount: reviewReports + watchingProblemSpaces,
      waitingOnSignalCount: waitingOnSignalInitiatives + truthConflicts,
      waitingOnAuthorityCount: waitingOnAuthorityInitiatives,
      capabilityGapCount: capabilityGapInitiatives,
      openProblemSpaces,
    },
    create: {
      workspaceId,
      metricDate,
      activeSessions,
      actionReadyCount: activeInitiatives,
      reviewNeededCount: reviewReports + watchingProblemSpaces,
      waitingOnSignalCount: waitingOnSignalInitiatives + truthConflicts,
      waitingOnAuthorityCount: waitingOnAuthorityInitiatives,
      capabilityGapCount: capabilityGapInitiatives,
      openProblemSpaces,
    },
  });
}

export function classifyCompositionFailure(input: {
  verificationStatus?: HelmV21VerificationDecision["status"] | null;
  prunedTokenCount?: number;
  blockedByPolicy?: boolean;
  blockedByAuthority?: boolean;
  hasTruthConflict?: boolean;
  lowConfidence?: boolean;
  missingTool?: boolean;
}): HelmV21CompositionFailureClass | null {
  if (input.blockedByPolicy) return "POLICY_BLOCK";
  if (input.missingTool) return "TOOL_MISS";
  if (input.blockedByAuthority) return "AUTHORITY_GAP";
  if (input.hasTruthConflict) return "SIGNAL_GAP";
  if (input.lowConfidence) return "CONFIDENCE_GAP";
  if (input.verificationStatus === "blocked" || input.verificationStatus === "needs_review") return "VERIFICATION_FAIL";
  if ((input.prunedTokenCount ?? 0) > 0) return "CONTEXT_MISS";
  return null;
}

export function buildWorldModelSummary(input: WorldModelInput) {
  return trimText(
    [
      `${input.workspaceName} is advancing "${input.meetingTitle}".`,
      input.companyName ? `Customer: ${input.companyName}.` : null,
      input.opportunityTitle ? `Opportunity: ${input.opportunityTitle}.` : null,
      input.confirmedFacts.length > 0 ? `Confirmed facts: ${input.confirmedFacts.join("；")}.` : null,
      input.blockers.length > 0 ? `Blockers: ${input.blockers.join("；")}.` : null,
      input.recommendedNextAction ? `Next step: ${input.recommendedNextAction}.` : null,
      `Truth score: ${input.truthScore}.`,
    ]
      .filter(Boolean)
      .join(" "),
    500,
  );
}

export function buildRuntimeCacheHealth(
  input: Array<{ cacheStatus: string; tokensSaved: number }> | null | undefined,
) {
  const items = input ?? [];
  const entries = items.length;
  const hits = items.filter((item) => item.cacheStatus === "hit").length;
  const tokensSaved = items.reduce((sum, item) => sum + item.tokensSaved, 0);
  return {
    entries,
    hitRate: entries === 0 ? 0 : Math.round((hits / entries) * 100),
    tokensSaved,
  };
}

type RuntimeBudgetPosture = RuntimeUpgradeSummary["continuity"]["budgetPosture"];
type RuntimeNotebookState = NonNullable<RuntimeUpgradeSummary["continuity"]["notebookState"]>;
type RuntimeRecoveryState = RuntimeUpgradeSummary["continuity"]["recovery"];
type RuntimeRecoveryCalibration = RuntimeUpgradeSummary["continuity"]["calibration"];
type RuntimeRemediationTraceEntry = RuntimeUpgradeSummary["continuity"]["remediationTrace"][number];
type RuntimeRemediationAnalytics = RuntimeUpgradeSummary["continuity"]["analytics"];
type RuntimeRemediationEffectiveness = RuntimeUpgradeSummary["continuity"]["effectiveness"];
type RuntimeContinuityEvidenceSurface = RuntimeUpgradeSummary["continuity"]["evidence"];
type RuntimeContinuityPilotSessionReview = RuntimeUpgradeSummary["continuity"]["pilotReview"];
type RuntimeContinuitySop = RuntimeUpgradeSummary["continuity"]["sop"];
type RuntimeContinuityFailureTaxonomy = RuntimeRecoveryState["failureTaxonomy"];
type WorkspaceContinuityQueueItem = WorkspaceRuntimeOperatorOverview["continuityQueue"][number];
type WorkspaceContinuityPilotReview = WorkspaceRuntimeOperatorOverview["continuityPilotReview"];
type WorkspaceContinuityPilotClassReview = WorkspaceContinuityPilotReview["failureDistribution"][number];
type RuntimeContinuityMeetingShape = WorkspaceContinuityQueueItem["meetingShape"];
type RuntimeContinuitySessionDensityBand = WorkspaceContinuityQueueItem["sessionDensityBand"];
type RuntimeContinuityMeetingFrequencyBand = WorkspaceContinuityQueueItem["meetingFrequencyBand"];
type RuntimeContinuityFailureHistoryBand = WorkspaceContinuityQueueItem["failureHistoryBand"];
type RuntimeContinuityParticipantRolePosture = WorkspaceContinuityQueueItem["participantRolePosture"];
type RuntimeContinuityWorkspaceSizeBand = WorkspaceContinuityPilotReview["workspaceCohort"]["sizeBand"];
type RuntimeContinuitySampleCoverageBand = WorkspaceContinuityQueueItem["pilotSampleCoverageBand"];
type RuntimeDebuggerHandoffPacket = Parameters<typeof buildOperatorDebuggerHandoffPayload>[0]["handoffPackets"][number];

type RuntimeContinuitySnapshot = {
  objective: string;
  relevantObjects: string[];
  confirmedFacts: string[];
  blockers: string[];
  decisions: string[];
  nextActions: string[];
  openQuestions: string[];
  evidenceRefs: string[];
  reviewState: string;
  boundaryNote: string;
  budgetState: RuntimeBudgetPosture["state"];
  loadedHandles: string[];
  prunedHandles: string[];
};

type RuntimePayloadHandleState = {
  activeHandles: string[];
  prunedHandles: string[];
  stateSource: "checkpoint_snapshot" | "checkpoint_plus_edits" | "latest_prune_edit" | "all_persisted";
  stateSummary: string;
};

type RuntimeContinuityRiskLevel = "LOW" | "WATCH" | "HIGH";
type RuntimeContinuityRemediationAction = "SAVE_RECOVERY_CHECKPOINT" | "RESUME_CHECKPOINT" | "REPRUNE_CONTEXT";
type RuntimeRemediationEffectivenessOutcome = RuntimeRemediationEffectiveness["latestOutcome"];

const CONTINUITY_RECOVERY_CALIBRATION_PROFILE = {
  pilotBasis: "Helm v2.2 continuity recovery pilot cohort 2026-04",
  tightenToReviewRequiredAfterIneffectiveCount: 2,
  tightenToReviewRequiredRepeatPatterns: [
    "REPEATED_REVIEW_REQUIRED",
    "REPEATED_REPRUNE_LOOP",
    "REPEATED_INEFFECTIVE_ACTION",
  ] as const,
};

const CONTINUITY_PILOT_EFFECTIVENESS_REVIEW_PROFILE = {
  pilotBasis: "Helm v2.2 continuity effectiveness review cohort 2026-04",
  lowBandDriftRate: 50,
  lowBandLongHorizonDriftRate: 50,
  lowBandIneffectiveRate: 35,
  lowBandRepeatPatternRate: 35,
  lowBandConfidenceRate: 45,
  lowBandSkippedGuidanceRate: 35,
  lowBandIneffectiveAfterGuidanceRate: 25,
  mediumBandDriftRate: 25,
  mediumBandLongHorizonDriftRate: 25,
  mediumBandIneffectiveRate: 15,
  mediumBandRepeatPatternRate: 15,
  mediumBandConfidenceRate: 20,
  mediumBandSkippedGuidanceRate: 20,
  mediumBandIneffectiveAfterGuidanceRate: 10,
  defaultIneffectiveThreshold: CONTINUITY_RECOVERY_CALIBRATION_PROFILE.tightenToReviewRequiredAfterIneffectiveCount,
  earlyIneffectiveThreshold: 1,
  topFailureClassCount: 3,
};

function buildRuntimeRollbackAnchorLabel(anchor: RuntimeRecoveryState["rollbackAnchor"]) {
  return anchor ? `${anchor.checkpointLabel} · ${anchor.checkpointStatus}` : null;
}

type RuntimeDebuggerRequestEventRecord = {
  id: string;
  eventType: string;
  payload: string | null;
  trustedContext: string | null;
  triggeredBy: string;
  createdAt: Date;
  relatedObjectId?: string | null;
};

type RuntimeBenchmarkMatrixEventRecord = {
  id: string;
  eventType: string;
  payload: string | null;
  trustedContext: string | null;
  triggeredBy: string;
  createdAt: Date;
};

function isRuntimeSessionControlEventType(eventType: string) {
  return RUNTIME_SESSION_CONTROL_EVENT_TYPES.includes(
    eventType as (typeof RUNTIME_SESSION_CONTROL_EVENT_TYPES)[number],
  );
}

function parseRuntimeDebuggerRequestSourcePage(trustedContext: string | null) {
  const parsed = safeParseJson<Record<string, unknown> | null>(trustedContext, null);
  return typeof parsed?.sourcePage === "string" ? parsed.sourcePage : null;
}

function normalizeRunThreadVerificationStatus(value: unknown) {
  if (value === "PASSED" || value === "passed") return "passed" as const;
  if (value === "NEEDS_REVIEW" || value === "needs_review") return "needs_review" as const;
  if (value === "BLOCKED" || value === "blocked") return "blocked" as const;
  return null;
}

function normalizeRunThreadTruthConflictState(value: unknown) {
  if (value === "OPEN" || value === "open") return "open" as const;
  if (value === "RESOLVED" || value === "resolved") return "resolved" as const;
  if (value === "SUPPRESSED" || value === "suppressed") return "suppressed" as const;
  return null;
}

function normalizeTakeoverRequestAction(value: unknown): HelmV21OperatorDebuggerTakeoverRequest["action"] {
  return value === "SAVE_RECOVERY_CHECKPOINT" ||
    value === "RESUME_CHECKPOINT" ||
    value === "REPRUNE_CONTEXT"
    ? value
    : null;
}

function parseRuntimeSwarmSpawnRequestedEvent(
  events: RuntimeDebuggerRequestEventRecord[],
): {
  id: string;
  taskClass: "read_only_worker";
  checkpointId: string | null;
  checkpointKey: string | null;
  summary: string;
  requestedBy: string;
  sourcePage: string | null;
  createdAt: Date;
} | null {
  for (const event of events) {
    if (event.eventType !== SWARM_SPAWN_REQUESTED_EVENT_TYPE) continue;
    const payload = safeParseJson<Record<string, unknown>>(event.payload, {});
    if (payload.taskClass !== "read_only_worker") continue;
    return {
      id: event.id,
      taskClass: "read_only_worker",
      checkpointId: typeof payload.checkpointId === "string" ? payload.checkpointId : null,
      checkpointKey: typeof payload.checkpointKey === "string" ? payload.checkpointKey : null,
      summary: typeof payload.summary === "string" ? payload.summary : "",
      requestedBy: event.triggeredBy,
      sourcePage: parseRuntimeDebuggerRequestSourcePage(event.trustedContext),
      createdAt: event.createdAt,
    };
  }
  return null;
}

function parseRuntimeSwarmReadOnlyWorkerIntentRecordedEvent(
  events: RuntimeDebuggerRequestEventRecord[],
): {
  id: string;
  workerKind: "search" | "grep" | "evidence_mining";
  packetKey: string;
  checkpointId: string | null;
  checkpointKey: string | null;
  artifactTypes: string[];
  summary: string;
  requestedBy: string;
  sourcePage: string | null;
  createdAt: Date;
} | null {
  for (const event of events) {
    if (event.eventType !== SWARM_READ_ONLY_WORKER_INTENT_RECORDED_EVENT_TYPE) continue;
    const payload = safeParseJson<Record<string, unknown>>(event.payload, {});
    if (
      payload.workerKind !== "search" &&
      payload.workerKind !== "grep" &&
      payload.workerKind !== "evidence_mining"
    ) {
      continue;
    }
    return {
      id: event.id,
      workerKind: payload.workerKind,
      packetKey: typeof payload.packetKey === "string" ? payload.packetKey : "",
      checkpointId: typeof payload.checkpointId === "string" ? payload.checkpointId : null,
      checkpointKey: typeof payload.checkpointKey === "string" ? payload.checkpointKey : null,
      artifactTypes: Array.isArray(payload.artifactTypes)
        ? payload.artifactTypes.filter((item): item is string => typeof item === "string")
        : [],
      summary: typeof payload.summary === "string" ? payload.summary : "",
      requestedBy: event.triggeredBy,
      sourcePage: parseRuntimeDebuggerRequestSourcePage(event.trustedContext),
      createdAt: event.createdAt,
    };
  }
  return null;
}

function parseRuntimeSwarmReadOnlyWorkerPlaceholderRecordedEvent(
  events: RuntimeDebuggerRequestEventRecord[],
): {
  id: string;
  workerKind: "search" | "grep" | "evidence_mining";
  packetKey: string;
  checkpointId: string | null;
  checkpointKey: string | null;
  placeholderBundleKey: string;
  placeholderBundleTitle: string;
  artifactTypes: string[];
  handoffConsumerAgent: "lead-orchestrator";
  handoffConsumptionGoal: string | null;
  summary: string;
  requestedBy: string;
  sourcePage: string | null;
  createdAt: Date;
} | null {
  for (const event of events) {
    if (event.eventType !== SWARM_READ_ONLY_WORKER_PLACEHOLDER_RECORDED_EVENT_TYPE) continue;
    const payload = safeParseJson<Record<string, unknown>>(event.payload, {});
    if (
      payload.workerKind !== "search" &&
      payload.workerKind !== "grep" &&
      payload.workerKind !== "evidence_mining"
    ) {
      continue;
    }
    if (payload.handoffConsumerAgent !== "lead-orchestrator") continue;
    return {
      id: event.id,
      workerKind: payload.workerKind,
      packetKey: typeof payload.packetKey === "string" ? payload.packetKey : "",
      checkpointId: typeof payload.checkpointId === "string" ? payload.checkpointId : null,
      checkpointKey: typeof payload.checkpointKey === "string" ? payload.checkpointKey : null,
      placeholderBundleKey:
        typeof payload.placeholderBundleKey === "string" ? payload.placeholderBundleKey : "",
      placeholderBundleTitle:
        typeof payload.placeholderBundleTitle === "string" ? payload.placeholderBundleTitle : "",
      artifactTypes: Array.isArray(payload.artifactTypes)
        ? payload.artifactTypes.filter((item): item is string => typeof item === "string")
        : [],
      handoffConsumerAgent: "lead-orchestrator",
      handoffConsumptionGoal:
        typeof payload.handoffConsumptionGoal === "string" ? payload.handoffConsumptionGoal : null,
      summary: typeof payload.summary === "string" ? payload.summary : "",
      requestedBy: event.triggeredBy,
      sourcePage: parseRuntimeDebuggerRequestSourcePage(event.trustedContext),
      createdAt: event.createdAt,
    };
  }
  return null;
}

function parseRuntimeSwarmReadOnlyWorkerExecutionRecordedEvent(
  events: RuntimeDebuggerRequestEventRecord[],
): {
  id: string;
  workerKind: "search" | "grep" | "evidence_mining";
  packetKey: string;
  checkpointId: string | null;
  checkpointKey: string | null;
  placeholderBundleKey: string;
  artifactTypes: string[];
  handoffConsumerAgent: "lead-orchestrator";
  handoffConsumptionGoal: string | null;
  summary: string;
  requestedBy: string;
  sourcePage: string | null;
  createdAt: Date;
} | null {
  for (const event of events) {
    if (event.eventType !== SWARM_READ_ONLY_WORKER_EXECUTION_RECORDED_EVENT_TYPE) continue;
    const payload = safeParseJson<Record<string, unknown>>(event.payload, {});
    if (
      payload.workerKind !== "search" &&
      payload.workerKind !== "grep" &&
      payload.workerKind !== "evidence_mining"
    ) {
      continue;
    }
    if (payload.handoffConsumerAgent !== "lead-orchestrator") continue;
    return {
      id: event.id,
      workerKind: payload.workerKind,
      packetKey: typeof payload.packetKey === "string" ? payload.packetKey : "",
      checkpointId: typeof payload.checkpointId === "string" ? payload.checkpointId : null,
      checkpointKey: typeof payload.checkpointKey === "string" ? payload.checkpointKey : null,
      placeholderBundleKey:
        typeof payload.placeholderBundleKey === "string" ? payload.placeholderBundleKey : "",
      artifactTypes: Array.isArray(payload.artifactTypes)
        ? payload.artifactTypes.filter((item): item is string => typeof item === "string")
        : [],
      handoffConsumerAgent: "lead-orchestrator",
      handoffConsumptionGoal:
        typeof payload.handoffConsumptionGoal === "string" ? payload.handoffConsumptionGoal : null,
      summary: typeof payload.summary === "string" ? payload.summary : "",
      requestedBy: event.triggeredBy,
      sourcePage: parseRuntimeDebuggerRequestSourcePage(event.trustedContext),
      createdAt: event.createdAt,
    };
  }
  return null;
}

function parseRuntimeSwarmReadOnlyWorkerMaterializationRecordedEvent(
  events: RuntimeDebuggerRequestEventRecord[],
): {
  id: string;
  workerKind: "search" | "grep" | "evidence_mining";
  packetKey: string;
  checkpointId: string | null;
  checkpointKey: string | null;
  materializationBundleKey: string;
  materializationBundleTitle: string;
  artifactTypes: string[];
  handoffConsumerAgent: "lead-orchestrator";
  handoffConsumptionGoal: string | null;
  summary: string;
  requestedBy: string;
  sourcePage: string | null;
  createdAt: Date;
} | null {
  for (const event of events) {
    if (event.eventType !== SWARM_READ_ONLY_WORKER_MATERIALIZATION_RECORDED_EVENT_TYPE) continue;
    const payload = safeParseJson<Record<string, unknown>>(event.payload, {});
    if (
      payload.workerKind !== "search" &&
      payload.workerKind !== "grep" &&
      payload.workerKind !== "evidence_mining"
    ) {
      continue;
    }
    if (payload.handoffConsumerAgent !== "lead-orchestrator") continue;
    return {
      id: event.id,
      workerKind: payload.workerKind,
      packetKey: typeof payload.packetKey === "string" ? payload.packetKey : "",
      checkpointId: typeof payload.checkpointId === "string" ? payload.checkpointId : null,
      checkpointKey: typeof payload.checkpointKey === "string" ? payload.checkpointKey : null,
      materializationBundleKey:
        typeof payload.materializationBundleKey === "string" ? payload.materializationBundleKey : "",
      materializationBundleTitle:
        typeof payload.materializationBundleTitle === "string"
          ? payload.materializationBundleTitle
          : "",
      artifactTypes: Array.isArray(payload.artifactTypes)
        ? payload.artifactTypes.filter((item): item is string => typeof item === "string")
        : [],
      handoffConsumerAgent: "lead-orchestrator",
      handoffConsumptionGoal:
        typeof payload.handoffConsumptionGoal === "string" ? payload.handoffConsumptionGoal : null,
      summary: typeof payload.summary === "string" ? payload.summary : "",
      requestedBy: event.triggeredBy,
      sourcePage: parseRuntimeDebuggerRequestSourcePage(event.trustedContext),
      createdAt: event.createdAt,
    };
  }
  return null;
}

function parseRuntimeSwarmReadOnlyWorkerAdoptionRecordedEvent(
  events: RuntimeDebuggerRequestEventRecord[],
): {
  id: string;
  workerKind: "search" | "grep" | "evidence_mining";
  packetKey: string;
  checkpointId: string | null;
  checkpointKey: string | null;
  outputBundleKey: string;
  outputBundleTitle: string;
  outputArtifactTypes: string[];
  handoffConsumerAgent: "lead-orchestrator";
  handoffConsumptionGoal: string | null;
  summary: string;
  requestedBy: string;
  sourcePage: string | null;
  createdAt: Date;
} | null {
  for (const event of events) {
    if (event.eventType !== SWARM_READ_ONLY_WORKER_ADOPTION_RECORDED_EVENT_TYPE) continue;
    const payload = safeParseJson<Record<string, unknown>>(event.payload, {});
    if (
      payload.workerKind !== "search" &&
      payload.workerKind !== "grep" &&
      payload.workerKind !== "evidence_mining"
    ) {
      continue;
    }
    if (payload.handoffConsumerAgent !== "lead-orchestrator") continue;
    return {
      id: event.id,
      workerKind: payload.workerKind,
      packetKey: typeof payload.packetKey === "string" ? payload.packetKey : "",
      checkpointId: typeof payload.checkpointId === "string" ? payload.checkpointId : null,
      checkpointKey: typeof payload.checkpointKey === "string" ? payload.checkpointKey : null,
      outputBundleKey: typeof payload.outputBundleKey === "string" ? payload.outputBundleKey : "",
      outputBundleTitle:
        typeof payload.outputBundleTitle === "string" ? payload.outputBundleTitle : "",
      outputArtifactTypes: Array.isArray(payload.outputArtifactTypes)
        ? payload.outputArtifactTypes.filter((item): item is string => typeof item === "string")
        : [],
      handoffConsumerAgent: "lead-orchestrator",
      handoffConsumptionGoal:
        typeof payload.handoffConsumptionGoal === "string" ? payload.handoffConsumptionGoal : null,
      summary: typeof payload.summary === "string" ? payload.summary : "",
      requestedBy: event.triggeredBy,
      sourcePage: parseRuntimeDebuggerRequestSourcePage(event.trustedContext),
      createdAt: event.createdAt,
    };
  }
  return null;
}

function parseRuntimeSwarmVerificationMergeLaneRecordedEvent(
  events: RuntimeDebuggerRequestEventRecord[],
): {
  id: string;
  mergeLaneTruth: "mergeable" | "rework_required" | "human_review_required";
  checkpointId: string | null;
  checkpointKey: string | null;
  summary: string;
  nextAction: string | null;
  verifierSummary: string | null;
  disagreementSummary: string | null;
  arbiterReference: string | null;
  requestedBy: string;
  sourcePage: string | null;
  createdAt: Date;
} | null {
  for (const event of events) {
    if (event.eventType !== SWARM_VERIFICATION_MERGE_LANE_RECORDED_EVENT_TYPE) continue;
    const payload = safeParseJson<Record<string, unknown>>(event.payload, {});
    if (
      payload.mergeLaneTruth !== "mergeable" &&
      payload.mergeLaneTruth !== "rework_required" &&
      payload.mergeLaneTruth !== "human_review_required"
    ) {
      continue;
    }
    return {
      id: event.id,
      mergeLaneTruth: payload.mergeLaneTruth,
      checkpointId: typeof payload.checkpointId === "string" ? payload.checkpointId : null,
      checkpointKey: typeof payload.checkpointKey === "string" ? payload.checkpointKey : null,
      summary: typeof payload.summary === "string" ? payload.summary : "",
      nextAction: typeof payload.nextAction === "string" ? payload.nextAction : null,
      verifierSummary:
        typeof payload.verifierSummary === "string" ? payload.verifierSummary : null,
      disagreementSummary:
        typeof payload.disagreementSummary === "string" ? payload.disagreementSummary : null,
      arbiterReference:
        typeof payload.arbiterReference === "string" ? payload.arbiterReference : null,
      requestedBy: event.triggeredBy,
      sourcePage: parseRuntimeDebuggerRequestSourcePage(event.trustedContext),
      createdAt: event.createdAt,
    };
  }
  return null;
}

function parseRuntimeTakeoverRequestEvent(
  events: RuntimeDebuggerRequestEventRecord[],
): {
  id: string;
  action: NonNullable<HelmV21OperatorDebuggerTakeoverRequest["action"]>;
  checkpointId: string | null;
  checkpointKey: string | null;
  resumeToken: string | null;
  summary: string;
  requestedBy: string;
  sourcePage: string | null;
  createdAt: Date;
} | null {
  for (const event of events) {
    if (event.eventType !== OPERATOR_TAKEOVER_REQUEST_EVENT_TYPE) continue;
    const payload = safeParseJson<Record<string, unknown>>(event.payload, {});
    const action = normalizeTakeoverRequestAction(payload.action);
    if (!action) continue;
    return {
      id: event.id,
      action,
      checkpointId: typeof payload.checkpointId === "string" ? payload.checkpointId : null,
      checkpointKey: typeof payload.checkpointKey === "string" ? payload.checkpointKey : null,
      resumeToken: typeof payload.resumeToken === "string" ? payload.resumeToken : null,
      summary: typeof payload.summary === "string" ? payload.summary : "",
      requestedBy: event.triggeredBy,
      sourcePage: parseRuntimeDebuggerRequestSourcePage(event.trustedContext),
      createdAt: event.createdAt,
    };
  }
  return null;
}

function parseRuntimeTakeoverAcknowledgementEvent(
  events: RuntimeDebuggerRequestEventRecord[],
): {
  id: string;
  requestEventId: string | null;
  action: NonNullable<HelmV21OperatorDebuggerTakeoverRequest["action"]>;
  checkpointId: string | null;
  checkpointKey: string | null;
  resumeToken: string | null;
  summary: string;
  acknowledgedBy: string;
  sourcePage: string | null;
  createdAt: Date;
} | null {
  for (const event of events) {
    if (event.eventType !== OPERATOR_TAKEOVER_ACKNOWLEDGED_EVENT_TYPE) continue;
    const payload = safeParseJson<Record<string, unknown>>(event.payload, {});
    const action = normalizeTakeoverRequestAction(payload.action);
    if (!action) continue;
    return {
      id: event.id,
      requestEventId: typeof payload.requestEventId === "string" ? payload.requestEventId : null,
      action,
      checkpointId: typeof payload.checkpointId === "string" ? payload.checkpointId : null,
      checkpointKey: typeof payload.checkpointKey === "string" ? payload.checkpointKey : null,
      resumeToken: typeof payload.resumeToken === "string" ? payload.resumeToken : null,
      summary: typeof payload.summary === "string" ? payload.summary : "",
      acknowledgedBy: event.triggeredBy,
      sourcePage: parseRuntimeDebuggerRequestSourcePage(event.trustedContext),
      createdAt: event.createdAt,
    };
  }
  return null;
}

function parseRuntimeTakeoverStartedEvent(
  events: RuntimeDebuggerRequestEventRecord[],
): {
  id: string;
  requestEventId: string | null;
  acknowledgementEventId: string | null;
  action: NonNullable<HelmV21OperatorDebuggerTakeoverRequest["action"]>;
  checkpointId: string | null;
  checkpointKey: string | null;
  resumeToken: string | null;
  summary: string;
  startedBy: string;
  sourcePage: string | null;
  createdAt: Date;
} | null {
  for (const event of events) {
    if (event.eventType !== OPERATOR_TAKEOVER_STARTED_EVENT_TYPE) continue;
    const payload = safeParseJson<Record<string, unknown>>(event.payload, {});
    const action = normalizeTakeoverRequestAction(payload.action);
    if (!action) continue;
    return {
      id: event.id,
      requestEventId: typeof payload.requestEventId === "string" ? payload.requestEventId : null,
      acknowledgementEventId:
        typeof payload.acknowledgementEventId === "string" ? payload.acknowledgementEventId : null,
      action,
      checkpointId: typeof payload.checkpointId === "string" ? payload.checkpointId : null,
      checkpointKey: typeof payload.checkpointKey === "string" ? payload.checkpointKey : null,
      resumeToken: typeof payload.resumeToken === "string" ? payload.resumeToken : null,
      summary: typeof payload.summary === "string" ? payload.summary : "",
      startedBy: event.triggeredBy,
      sourcePage: parseRuntimeDebuggerRequestSourcePage(event.trustedContext),
      createdAt: event.createdAt,
    };
  }
  return null;
}

function parseRuntimeTakeoverReleasedEvent(
  events: RuntimeDebuggerRequestEventRecord[],
): {
  id: string;
  requestEventId: string | null;
  acknowledgementEventId: string | null;
  startEventId: string | null;
  action: NonNullable<HelmV21OperatorDebuggerTakeoverRequest["action"]>;
  checkpointId: string | null;
  checkpointKey: string | null;
  resumeToken: string | null;
  summary: string;
  releaseReason: string;
  releasedBy: string;
  sourcePage: string | null;
  createdAt: Date;
} | null {
  for (const event of events) {
    if (event.eventType !== OPERATOR_TAKEOVER_RELEASED_EVENT_TYPE) continue;
    const payload = safeParseJson<Record<string, unknown>>(event.payload, {});
    const action = normalizeTakeoverRequestAction(payload.action);
    const releaseReason =
      typeof payload.releaseReason === "string" ? payload.releaseReason.trim() : "";
    if (!action || !releaseReason) continue;
    return {
      id: event.id,
      requestEventId: typeof payload.requestEventId === "string" ? payload.requestEventId : null,
      acknowledgementEventId:
        typeof payload.acknowledgementEventId === "string" ? payload.acknowledgementEventId : null,
      startEventId: typeof payload.startEventId === "string" ? payload.startEventId : null,
      action,
      checkpointId: typeof payload.checkpointId === "string" ? payload.checkpointId : null,
      checkpointKey: typeof payload.checkpointKey === "string" ? payload.checkpointKey : null,
      resumeToken: typeof payload.resumeToken === "string" ? payload.resumeToken : null,
      summary: typeof payload.summary === "string" ? payload.summary : "",
      releaseReason,
      releasedBy: event.triggeredBy,
      sourcePage: parseRuntimeDebuggerRequestSourcePage(event.trustedContext),
      createdAt: event.createdAt,
    };
  }
  return null;
}

function parseRuntimeTakeoverFollowThroughRequestedEvent(
  events: RuntimeDebuggerRequestEventRecord[],
): {
  id: string;
  takeoverRequestEventId: string | null;
  acknowledgementEventId: string | null;
  startEventId: string | null;
  releaseEventId: string | null;
  action: NonNullable<HelmV21OperatorDebuggerTakeoverRequest["action"]>;
  checkpointId: string | null;
  checkpointKey: string | null;
  resumeToken: string | null;
  summary: string;
  nextAction: string | null;
  requestedBy: string;
  sourcePage: string | null;
  createdAt: Date;
} | null {
  for (const event of events) {
    if (event.eventType !== OPERATOR_TAKEOVER_FOLLOW_THROUGH_REQUESTED_EVENT_TYPE) continue;
    const payload = safeParseJson<Record<string, unknown>>(event.payload, {});
    const action = normalizeTakeoverRequestAction(payload.action);
    if (!action) continue;
    return {
      id: event.id,
      takeoverRequestEventId:
        typeof payload.takeoverRequestEventId === "string" ? payload.takeoverRequestEventId : null,
      acknowledgementEventId:
        typeof payload.acknowledgementEventId === "string" ? payload.acknowledgementEventId : null,
      startEventId: typeof payload.startEventId === "string" ? payload.startEventId : null,
      releaseEventId: typeof payload.releaseEventId === "string" ? payload.releaseEventId : null,
      action,
      checkpointId: typeof payload.checkpointId === "string" ? payload.checkpointId : null,
      checkpointKey: typeof payload.checkpointKey === "string" ? payload.checkpointKey : null,
      resumeToken: typeof payload.resumeToken === "string" ? payload.resumeToken : null,
      summary: typeof payload.summary === "string" ? payload.summary : "",
      nextAction: typeof payload.nextAction === "string" ? payload.nextAction : null,
      requestedBy: event.triggeredBy,
      sourcePage: parseRuntimeDebuggerRequestSourcePage(event.trustedContext),
      createdAt: event.createdAt,
    };
  }
  return null;
}

function parseRuntimeTakeoverFollowThroughResolvedEvent(
  events: RuntimeDebuggerRequestEventRecord[],
): {
  id: string;
  requestEventId: string | null;
  takeoverRequestEventId: string | null;
  acknowledgementEventId: string | null;
  startEventId: string | null;
  releaseEventId: string | null;
  action: NonNullable<HelmV21OperatorDebuggerTakeoverRequest["action"]>;
  checkpointId: string | null;
  checkpointKey: string | null;
  resumeToken: string | null;
  summary: string;
  nextAction: string | null;
  resolvedBy: string;
  sourcePage: string | null;
  createdAt: Date;
} | null {
  for (const event of events) {
    if (event.eventType !== OPERATOR_TAKEOVER_FOLLOW_THROUGH_RESOLVED_EVENT_TYPE) continue;
    const payload = safeParseJson<Record<string, unknown>>(event.payload, {});
    const action = normalizeTakeoverRequestAction(payload.action);
    if (!action) continue;
    return {
      id: event.id,
      requestEventId: typeof payload.requestEventId === "string" ? payload.requestEventId : null,
      takeoverRequestEventId:
        typeof payload.takeoverRequestEventId === "string" ? payload.takeoverRequestEventId : null,
      acknowledgementEventId:
        typeof payload.acknowledgementEventId === "string" ? payload.acknowledgementEventId : null,
      startEventId: typeof payload.startEventId === "string" ? payload.startEventId : null,
      releaseEventId: typeof payload.releaseEventId === "string" ? payload.releaseEventId : null,
      action,
      checkpointId: typeof payload.checkpointId === "string" ? payload.checkpointId : null,
      checkpointKey: typeof payload.checkpointKey === "string" ? payload.checkpointKey : null,
      resumeToken: typeof payload.resumeToken === "string" ? payload.resumeToken : null,
      summary: typeof payload.summary === "string" ? payload.summary : "",
      nextAction: typeof payload.nextAction === "string" ? payload.nextAction : null,
      resolvedBy: event.triggeredBy,
      sourcePage: parseRuntimeDebuggerRequestSourcePage(event.trustedContext),
      createdAt: event.createdAt,
    };
  }
  return null;
}

function parseRuntimeSettlementReviewRequestedEvent(
  events: RuntimeDebuggerRequestEventRecord[],
): {
  id: string;
  checkpointId: string | null;
  checkpointKey: string | null;
  resumeToken: string | null;
  summary: string;
  nextAction: string | null;
  requestedBy: string;
  sourcePage: string | null;
  createdAt: Date;
} | null {
  for (const event of events) {
    if (event.eventType !== RUN_THREAD_SETTLEMENT_REVIEW_REQUESTED_EVENT_TYPE) continue;
    const payload = safeParseJson<Record<string, unknown>>(event.payload, {});
    return {
      id: event.id,
      checkpointId: typeof payload.checkpointId === "string" ? payload.checkpointId : null,
      checkpointKey: typeof payload.checkpointKey === "string" ? payload.checkpointKey : null,
      resumeToken: typeof payload.resumeToken === "string" ? payload.resumeToken : null,
      summary: typeof payload.summary === "string" ? payload.summary : "",
      nextAction: typeof payload.nextAction === "string" ? payload.nextAction : null,
      requestedBy: event.triggeredBy,
      sourcePage: parseRuntimeDebuggerRequestSourcePage(event.trustedContext),
      createdAt: event.createdAt,
    };
  }
  return null;
}

function parseRuntimeSettlementReviewResolvedEvent(
  events: RuntimeDebuggerRequestEventRecord[],
): {
  id: string;
  requestEventId: string | null;
  checkpointId: string | null;
  checkpointKey: string | null;
  resumeToken: string | null;
  summary: string;
  nextAction: string | null;
  resolvedBy: string;
  sourcePage: string | null;
  createdAt: Date;
} | null {
  for (const event of events) {
    if (event.eventType !== RUN_THREAD_SETTLEMENT_REVIEW_RESOLVED_EVENT_TYPE) continue;
    const payload = safeParseJson<Record<string, unknown>>(event.payload, {});
    return {
      id: event.id,
      requestEventId: typeof payload.requestEventId === "string" ? payload.requestEventId : null,
      checkpointId: typeof payload.checkpointId === "string" ? payload.checkpointId : null,
      checkpointKey: typeof payload.checkpointKey === "string" ? payload.checkpointKey : null,
      resumeToken: typeof payload.resumeToken === "string" ? payload.resumeToken : null,
      summary: typeof payload.summary === "string" ? payload.summary : "",
      nextAction: typeof payload.nextAction === "string" ? payload.nextAction : null,
      resolvedBy: event.triggeredBy,
      sourcePage: parseRuntimeDebuggerRequestSourcePage(event.trustedContext),
      createdAt: event.createdAt,
    };
  }
  return null;
}

function parseRuntimeCloseoutConfirmedEvent(
  events: RuntimeDebuggerRequestEventRecord[],
): {
  id: string;
  settlementReviewResolutionEventId: string | null;
  checkpointId: string | null;
  checkpointKey: string | null;
  resumeToken: string | null;
  summary: string;
  nextAction: string | null;
  confirmedBy: string;
  sourcePage: string | null;
  createdAt: Date;
} | null {
  for (const event of events) {
    if (event.eventType !== RUN_THREAD_CLOSEOUT_CONFIRMED_EVENT_TYPE) continue;
    const payload = safeParseJson<Record<string, unknown>>(event.payload, {});
    return {
      id: event.id,
      settlementReviewResolutionEventId:
        typeof payload.settlementReviewResolutionEventId === "string"
          ? payload.settlementReviewResolutionEventId
          : null,
      checkpointId: typeof payload.checkpointId === "string" ? payload.checkpointId : null,
      checkpointKey: typeof payload.checkpointKey === "string" ? payload.checkpointKey : null,
      resumeToken: typeof payload.resumeToken === "string" ? payload.resumeToken : null,
      summary: typeof payload.summary === "string" ? payload.summary : "",
      nextAction: typeof payload.nextAction === "string" ? payload.nextAction : null,
      confirmedBy: event.triggeredBy,
      sourcePage: parseRuntimeDebuggerRequestSourcePage(event.trustedContext),
      createdAt: event.createdAt,
    };
  }
  return null;
}

function parseRuntimeCloseoutRefreshRequestedEvent(
  events: RuntimeDebuggerRequestEventRecord[],
): {
  id: string;
  confirmationEventId: string | null;
  checkpointId: string | null;
  checkpointKey: string | null;
  resumeToken: string | null;
  summary: string;
  nextAction: string | null;
  requestedBy: string;
  sourcePage: string | null;
  createdAt: Date;
} | null {
  for (const event of events) {
    if (event.eventType !== RUN_THREAD_CLOSEOUT_REFRESH_REQUESTED_EVENT_TYPE) continue;
    const payload = safeParseJson<Record<string, unknown>>(event.payload, {});
    return {
      id: event.id,
      confirmationEventId:
        typeof payload.confirmationEventId === "string" ? payload.confirmationEventId : null,
      checkpointId: typeof payload.checkpointId === "string" ? payload.checkpointId : null,
      checkpointKey: typeof payload.checkpointKey === "string" ? payload.checkpointKey : null,
      resumeToken: typeof payload.resumeToken === "string" ? payload.resumeToken : null,
      summary: typeof payload.summary === "string" ? payload.summary : "",
      nextAction: typeof payload.nextAction === "string" ? payload.nextAction : null,
      requestedBy: event.triggeredBy,
      sourcePage: parseRuntimeDebuggerRequestSourcePage(event.trustedContext),
      createdAt: event.createdAt,
    };
  }
  return null;
}

function parseRuntimeCloseoutResolutionRecordedEvent(
  events: RuntimeDebuggerRequestEventRecord[],
): {
  id: string;
  decision: "close_thread" | "keep_open";
  closeoutConfirmationEventId: string | null;
  closeoutRefreshEventId: string | null;
  checkpointId: string | null;
  checkpointKey: string | null;
  resumeToken: string | null;
  summary: string;
  nextAction: string | null;
  resolvedBy: string;
  sourcePage: string | null;
  createdAt: Date;
} | null {
  for (const event of events) {
    if (event.eventType !== RUN_THREAD_CLOSEOUT_RESOLUTION_RECORDED_EVENT_TYPE) continue;
    const payload = safeParseJson<Record<string, unknown>>(event.payload, {});
    const decision =
      payload.decision === "close_thread" || payload.decision === "keep_open"
        ? payload.decision
        : null;
    if (!decision) continue;
    return {
      id: event.id,
      decision,
      closeoutConfirmationEventId:
        typeof payload.closeoutConfirmationEventId === "string"
          ? payload.closeoutConfirmationEventId
          : null,
      closeoutRefreshEventId:
        typeof payload.closeoutRefreshEventId === "string"
          ? payload.closeoutRefreshEventId
          : null,
      checkpointId: typeof payload.checkpointId === "string" ? payload.checkpointId : null,
      checkpointKey: typeof payload.checkpointKey === "string" ? payload.checkpointKey : null,
      resumeToken: typeof payload.resumeToken === "string" ? payload.resumeToken : null,
      summary: typeof payload.summary === "string" ? payload.summary : "",
      nextAction: typeof payload.nextAction === "string" ? payload.nextAction : null,
      resolvedBy: event.triggeredBy,
      sourcePage: parseRuntimeDebuggerRequestSourcePage(event.trustedContext),
      createdAt: event.createdAt,
    };
  }
  return null;
}

function parseRuntimeCloseoutResolutionFollowThroughRequestedEvent(
  events: RuntimeDebuggerRequestEventRecord[],
): {
  id: string;
  closeoutResolutionEventId: string | null;
  decision: "close_thread" | "keep_open";
  checkpointId: string | null;
  checkpointKey: string | null;
  resumeToken: string | null;
  summary: string;
  nextAction: string | null;
  requestedBy: string;
  sourcePage: string | null;
  createdAt: Date;
} | null {
  for (const event of events) {
    if (event.eventType !== RUN_THREAD_CLOSEOUT_RESOLUTION_FOLLOW_THROUGH_REQUESTED_EVENT_TYPE) continue;
    const payload = safeParseJson<Record<string, unknown>>(event.payload, {});
    const decision =
      payload.decision === "close_thread" || payload.decision === "keep_open"
        ? payload.decision
        : null;
    if (!decision) continue;
    return {
      id: event.id,
      closeoutResolutionEventId:
        typeof payload.closeoutResolutionEventId === "string"
          ? payload.closeoutResolutionEventId
          : null,
      decision,
      checkpointId: typeof payload.checkpointId === "string" ? payload.checkpointId : null,
      checkpointKey: typeof payload.checkpointKey === "string" ? payload.checkpointKey : null,
      resumeToken: typeof payload.resumeToken === "string" ? payload.resumeToken : null,
      summary: typeof payload.summary === "string" ? payload.summary : "",
      nextAction: typeof payload.nextAction === "string" ? payload.nextAction : null,
      requestedBy: event.triggeredBy,
      sourcePage: parseRuntimeDebuggerRequestSourcePage(event.trustedContext),
      createdAt: event.createdAt,
    };
  }
  return null;
}

function parseRuntimeCloseoutResolutionFollowThroughResolvedEvent(
  events: RuntimeDebuggerRequestEventRecord[],
): {
  id: string;
  requestEventId: string | null;
  closeoutResolutionEventId: string | null;
  decision: "close_thread" | "keep_open";
  checkpointId: string | null;
  checkpointKey: string | null;
  resumeToken: string | null;
  summary: string;
  nextAction: string | null;
  resolvedBy: string;
  sourcePage: string | null;
  createdAt: Date;
} | null {
  for (const event of events) {
    if (event.eventType !== RUN_THREAD_CLOSEOUT_RESOLUTION_FOLLOW_THROUGH_RESOLVED_EVENT_TYPE) continue;
    const payload = safeParseJson<Record<string, unknown>>(event.payload, {});
    const decision =
      payload.decision === "close_thread" || payload.decision === "keep_open"
        ? payload.decision
        : null;
    if (!decision) continue;
    return {
      id: event.id,
      requestEventId: typeof payload.requestEventId === "string" ? payload.requestEventId : null,
      closeoutResolutionEventId:
        typeof payload.closeoutResolutionEventId === "string"
          ? payload.closeoutResolutionEventId
          : null,
      decision,
      checkpointId: typeof payload.checkpointId === "string" ? payload.checkpointId : null,
      checkpointKey: typeof payload.checkpointKey === "string" ? payload.checkpointKey : null,
      resumeToken: typeof payload.resumeToken === "string" ? payload.resumeToken : null,
      summary: typeof payload.summary === "string" ? payload.summary : "",
      nextAction: typeof payload.nextAction === "string" ? payload.nextAction : null,
      resolvedBy: event.triggeredBy,
      sourcePage: parseRuntimeDebuggerRequestSourcePage(event.trustedContext),
      createdAt: event.createdAt,
    };
  }
  return null;
}

function parseRuntimeCloseRequestedEvent(
  events: RuntimeDebuggerRequestEventRecord[],
): {
  id: string;
  closeoutResolutionEventId: string | null;
  closeoutResolutionFollowThroughEventId: string | null;
  checkpointId: string | null;
  checkpointKey: string | null;
  resumeToken: string | null;
  summary: string;
  nextAction: string | null;
  requestedBy: string;
  sourcePage: string | null;
  createdAt: Date;
} | null {
  for (const event of events) {
    if (event.eventType !== RUN_THREAD_CLOSE_REQUESTED_EVENT_TYPE) continue;
    const payload = safeParseJson<Record<string, unknown>>(event.payload, {});
    return {
      id: event.id,
      closeoutResolutionEventId:
        typeof payload.closeoutResolutionEventId === "string"
          ? payload.closeoutResolutionEventId
          : null,
      closeoutResolutionFollowThroughEventId:
        typeof payload.closeoutResolutionFollowThroughEventId === "string"
          ? payload.closeoutResolutionFollowThroughEventId
          : null,
      checkpointId: typeof payload.checkpointId === "string" ? payload.checkpointId : null,
      checkpointKey: typeof payload.checkpointKey === "string" ? payload.checkpointKey : null,
      resumeToken: typeof payload.resumeToken === "string" ? payload.resumeToken : null,
      summary: typeof payload.summary === "string" ? payload.summary : "",
      nextAction: typeof payload.nextAction === "string" ? payload.nextAction : null,
      requestedBy: event.triggeredBy,
      sourcePage: parseRuntimeDebuggerRequestSourcePage(event.trustedContext),
      createdAt: event.createdAt,
    };
  }
  return null;
}

function parseRuntimeHumanInputCheckpointRequestEvent(
  events: RuntimeDebuggerRequestEventRecord[],
): {
  id: string;
  checkpointId: string | null;
  checkpointKey: string | null;
  resumeToken: string | null;
  prompt: string;
  summary: string;
  requestedBy: string;
  sourcePage: string | null;
  createdAt: Date;
} | null {
  for (const event of events) {
    if (event.eventType !== HUMAN_INPUT_CHECKPOINT_REQUEST_EVENT_TYPE) continue;
    const payload = safeParseJson<Record<string, unknown>>(event.payload, {});
    const prompt = typeof payload.prompt === "string" ? payload.prompt : "";
    if (!prompt) continue;
    return {
      id: event.id,
      checkpointId: typeof payload.checkpointId === "string" ? payload.checkpointId : null,
      checkpointKey: typeof payload.checkpointKey === "string" ? payload.checkpointKey : null,
      resumeToken: typeof payload.resumeToken === "string" ? payload.resumeToken : null,
      prompt,
      summary: typeof payload.summary === "string" ? payload.summary : "",
      requestedBy: event.triggeredBy,
      sourcePage: parseRuntimeDebuggerRequestSourcePage(event.trustedContext),
      createdAt: event.createdAt,
    };
  }
  return null;
}

function parseRuntimeHumanInputCheckpointAcknowledgementEvent(
  events: RuntimeDebuggerRequestEventRecord[],
): {
  id: string;
  requestEventId: string | null;
  checkpointId: string | null;
  checkpointKey: string | null;
  resumeToken: string | null;
  prompt: string;
  summary: string;
  acknowledgedBy: string;
  sourcePage: string | null;
  createdAt: Date;
} | null {
  for (const event of events) {
    if (event.eventType !== HUMAN_INPUT_CHECKPOINT_ACKNOWLEDGED_EVENT_TYPE) continue;
    const payload = safeParseJson<Record<string, unknown>>(event.payload, {});
    const prompt = typeof payload.prompt === "string" ? payload.prompt : "";
    if (!prompt) continue;
    return {
      id: event.id,
      requestEventId: typeof payload.requestEventId === "string" ? payload.requestEventId : null,
      checkpointId: typeof payload.checkpointId === "string" ? payload.checkpointId : null,
      checkpointKey: typeof payload.checkpointKey === "string" ? payload.checkpointKey : null,
      resumeToken: typeof payload.resumeToken === "string" ? payload.resumeToken : null,
      prompt,
      summary: typeof payload.summary === "string" ? payload.summary : "",
      acknowledgedBy: event.triggeredBy,
      sourcePage: parseRuntimeDebuggerRequestSourcePage(event.trustedContext),
      createdAt: event.createdAt,
    };
  }
  return null;
}

function normalizeBenchmarkGateRecordedStatus(
  value: unknown,
): HelmV21BenchmarkRecordedGateOutcome["status"] | null {
  return value === "pass" || value === "warning" || value === "fail" ? value : null;
}

function normalizeBenchmarkMatrixLayerId(value: unknown): HelmV21BenchmarkMatrixLayerId | null {
  return value === "runtime_eval" ||
    value === "adapter_conformance" ||
    value === "boundary_regression" ||
    value === "operator_usability"
    ? value
    : null;
}

function parseRuntimeBenchmarkMatrixRunEvents(
  events: RuntimeBenchmarkMatrixEventRecord[],
): HelmV21BenchmarkRecordedRun[] {
  return events
    .filter((event) => event.eventType === BENCHMARK_MATRIX_RUN_RECORDED_EVENT_TYPE)
    .map((event) => {
      const payload = safeParseJson<Record<string, unknown>>(event.payload, {});
      const trustedContext = safeParseJson<Record<string, unknown> | null>(event.trustedContext, null);
      const outcomes = Array.isArray(payload.outcomes)
        ? payload.outcomes
            .map((item) => {
              if (!item || typeof item !== "object") return null;
              const candidate = item as Record<string, unknown>;
              const layerId = normalizeBenchmarkMatrixLayerId(candidate.layerId);
              const gateId = typeof candidate.gateId === "string" ? candidate.gateId : null;
              const status = normalizeBenchmarkGateRecordedStatus(candidate.status);
              const summary = typeof candidate.summary === "string" ? candidate.summary : null;
              if (!layerId || !gateId || !status || !summary) {
                return null;
              }
              return {
                layerId,
                gateId,
                status,
                summary,
                evidenceRefs: Array.isArray(candidate.evidenceRefs)
                  ? candidate.evidenceRefs.filter((ref): ref is string => typeof ref === "string")
                  : [],
              };
            })
            .filter((item): item is HelmV21BenchmarkRecordedGateOutcome => Boolean(item))
        : [];

      return {
        benchmarkRunId:
          typeof payload.benchmarkRunId === "string" && payload.benchmarkRunId.trim().length > 0
            ? payload.benchmarkRunId
            : event.id,
        runLabel: typeof payload.runLabel === "string" ? payload.runLabel : null,
        commandSource:
          trustedContext && typeof trustedContext.commandSource === "string"
            ? trustedContext.commandSource
            : null,
        notes: typeof payload.notes === "string" ? payload.notes : null,
        recordedAt: event.createdAt,
        recordedBy: event.triggeredBy,
        sourcePage:
          trustedContext && typeof trustedContext.sourcePage === "string"
            ? trustedContext.sourcePage
            : null,
        outcomes,
      };
    })
    .filter((item) => item.outcomes.length > 0)
    .sort((left, right) => right.recordedAt.getTime() - left.recordedAt.getTime());
}

function parseRuntimeBenchmarkMatrixRunRequestEvents(
  events: RuntimeBenchmarkMatrixEventRecord[],
): HelmV21BenchmarkExecutionRequest[] {
  return events
    .filter((event) => event.eventType === BENCHMARK_MATRIX_RUN_REQUESTED_EVENT_TYPE)
    .map((event) => {
      const payload = safeParseJson<Record<string, unknown>>(event.payload, {});
      const trustedContext = safeParseJson<Record<string, unknown> | null>(event.trustedContext, null);
      const requestedLayerIds = Array.isArray(payload.requestedLayerIds)
        ? payload.requestedLayerIds
            .map((item) => normalizeBenchmarkMatrixLayerId(item))
            .filter((item): item is HelmV21BenchmarkMatrixLayerId => Boolean(item))
        : [];
      const requestedGateIds = Array.isArray(payload.requestedGateIds)
        ? payload.requestedGateIds.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        : [];

      return {
        state: "requested" as const,
        requestEventId: event.id,
        requestKey: typeof payload.requestKey === "string" ? payload.requestKey : null,
        requestedLayerIds,
        requestedGateIds,
        summary:
          typeof payload.summary === "string" && payload.summary.trim().length > 0
            ? payload.summary
            : "Benchmark rerun has been requested and is waiting on manual execution.",
        requestedAt: event.createdAt,
        requestedBy: event.triggeredBy,
        sourcePage:
          trustedContext && typeof trustedContext.sourcePage === "string" ? trustedContext.sourcePage : null,
        commandSource:
          trustedContext && typeof trustedContext.commandSource === "string"
            ? trustedContext.commandSource
            : null,
        boundaryNote:
          "Benchmark execution request stays operator-visible only. It does not auto-run benchmark commands or expand runtime authority.",
      };
    })
    .sort((left, right) => (right.requestedAt?.getTime() ?? 0) - (left.requestedAt?.getTime() ?? 0));
}

function parseRuntimeBenchmarkMatrixRunAcknowledgementEvents(
  events: RuntimeBenchmarkMatrixEventRecord[],
): HelmV21BenchmarkExecutionAcknowledgement[] {
  return events
    .filter((event) => event.eventType === BENCHMARK_MATRIX_RUN_ACKNOWLEDGED_EVENT_TYPE)
    .map((event) => {
      const payload = safeParseJson<Record<string, unknown>>(event.payload, {});
      const trustedContext = safeParseJson<Record<string, unknown> | null>(event.trustedContext, null);
      return {
        state: "acknowledged" as const,
        acknowledgementEventId: event.id,
        benchmarkRunId: typeof payload.benchmarkRunId === "string" ? payload.benchmarkRunId : null,
        requestEventId: typeof payload.requestEventId === "string" ? payload.requestEventId : null,
        runLabel: typeof payload.runLabel === "string" ? payload.runLabel : null,
        summary:
          typeof payload.summary === "string" && payload.summary.trim().length > 0
            ? payload.summary
            : "Benchmark run acknowledgement was recorded after operator review.",
        recordedAt: null,
        recordedBy: null,
        acknowledgedAt: event.createdAt,
        acknowledgedBy: event.triggeredBy,
        sourcePage:
          trustedContext && typeof trustedContext.sourcePage === "string" ? trustedContext.sourcePage : null,
        commandSource:
          trustedContext && typeof trustedContext.commandSource === "string"
            ? trustedContext.commandSource
            : null,
        boundaryNote:
          "Benchmark acknowledgement stays review-first and confirms visible benchmark evidence only. It does not create a new execution plane.",
      };
    })
    .filter((item) => Boolean(item.benchmarkRunId))
    .sort((left, right) => (right.acknowledgedAt?.getTime() ?? 0) - (left.acknowledgedAt?.getTime() ?? 0));
}

function parseRuntimeBenchmarkMatrixFollowThroughEvents(
  events: RuntimeBenchmarkMatrixEventRecord[],
): HelmV21BenchmarkExecutionFollowThrough[] {
  const records = events.reduce<HelmV21BenchmarkExecutionFollowThrough[]>((acc, event) => {
      const payload = safeParseJson<Record<string, unknown>>(event.payload, {});
      const trustedContext = safeParseJson<Record<string, unknown> | null>(event.trustedContext, null);
      const benchmarkRunId =
        typeof payload.benchmarkRunId === "string" ? payload.benchmarkRunId : null;
      if (!benchmarkRunId) {
        return acc;
      }

      if (event.eventType === BENCHMARK_MATRIX_RUN_FOLLOW_THROUGH_REQUESTED_EVENT_TYPE) {
        acc.push({
          state: "open",
          requestEventId: event.id,
          resolutionEventId: null,
          benchmarkRunId,
          acknowledgementEventId:
            typeof payload.acknowledgementEventId === "string" ? payload.acknowledgementEventId : null,
          runLabel: typeof payload.runLabel === "string" ? payload.runLabel : null,
          summary:
            typeof payload.summary === "string" && payload.summary.trim().length > 0
              ? payload.summary
              : "Benchmark follow-through is open and waiting on the next control-plane step.",
          nextAction:
            typeof payload.nextAction === "string" && payload.nextAction.trim().length > 0
              ? payload.nextAction
              : null,
          requestedAt: event.createdAt,
          requestedBy: event.triggeredBy,
          resolvedAt: null,
          resolvedBy: null,
          sourcePage:
            trustedContext && typeof trustedContext.sourcePage === "string"
              ? trustedContext.sourcePage
              : null,
          commandSource:
            trustedContext && typeof trustedContext.commandSource === "string"
              ? trustedContext.commandSource
              : null,
          boundaryNote:
            "Benchmark follow-through stays operator-visible and manual. It does not create an automatic benchmark execution plane.",
        });
        return acc;
      }

      if (event.eventType === BENCHMARK_MATRIX_RUN_FOLLOW_THROUGH_RESOLVED_EVENT_TYPE) {
        acc.push({
          state: "resolved",
          requestEventId:
            typeof payload.requestEventId === "string" ? payload.requestEventId : null,
          resolutionEventId: event.id,
          benchmarkRunId,
          acknowledgementEventId:
            typeof payload.acknowledgementEventId === "string" ? payload.acknowledgementEventId : null,
          runLabel: typeof payload.runLabel === "string" ? payload.runLabel : null,
          summary:
            typeof payload.summary === "string" && payload.summary.trim().length > 0
              ? payload.summary
              : "Benchmark follow-through was resolved after operator review.",
          nextAction:
            typeof payload.nextAction === "string" && payload.nextAction.trim().length > 0
              ? payload.nextAction
              : null,
          requestedAt: null,
          requestedBy: null,
          resolvedAt: event.createdAt,
          resolvedBy: event.triggeredBy,
          sourcePage:
            trustedContext && typeof trustedContext.sourcePage === "string"
              ? trustedContext.sourcePage
              : null,
          commandSource:
            trustedContext && typeof trustedContext.commandSource === "string"
              ? trustedContext.commandSource
              : null,
          boundaryNote:
            "Benchmark follow-through stays operator-visible and manual. It does not create an automatic benchmark execution plane.",
        });
        return acc;
      }

      return acc;
    }, []);

  return records.sort((left, right) => {
      const leftTime = (left.resolvedAt ?? left.requestedAt)?.getTime() ?? 0;
      const rightTime = (right.resolvedAt ?? right.requestedAt)?.getTime() ?? 0;
      return rightTime - leftTime;
    });
}

function toRuntimePercent(count: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((count / total) * 100);
}

export function buildRuntimeContinuityPilotEffectivenessReview(
  entries: WorkspaceContinuityQueueItem[],
  options: {
    workspaceSessionCount?: number;
  } = {},
): WorkspaceContinuityPilotReview {
  const workspaceSessionCount = options.workspaceSessionCount ?? entries.length;
  const workspaceSizeBand = getRuntimeContinuityWorkspaceSizeBand(workspaceSessionCount);
  const pilotCases = entries.filter(
    (item) =>
      item.failureTaxonomy !== "NONE" ||
      item.recoveryState !== "STABLE" ||
      item.remediationAttempts > 0 ||
      item.repeatPatternStatus !== "NONE",
  );
  const reviewableFailureCases = pilotCases.filter(
    (
      item,
    ): item is WorkspaceContinuityQueueItem & {
      failureTaxonomy: Exclude<RuntimeContinuityFailureTaxonomy, "NONE">;
    } => item.failureTaxonomy !== "NONE",
  );
  const grouped = new Map<Exclude<RuntimeContinuityFailureTaxonomy, "NONE">, typeof reviewableFailureCases>();

  for (const item of reviewableFailureCases) {
    const list = grouped.get(item.failureTaxonomy) ?? [];
    list.push(item);
    grouped.set(item.failureTaxonomy, list);
  }

  const buildAggregateMetrics = (items: WorkspaceContinuityQueueItem[]) => {
    const sessionCount = items.length;
    const driftingCount = items.filter((item) => getRuntimeContinuityDriftState(item) === "DRIFTING").length;
    const ineffectiveCount = items.filter((item) => item.latestEffectiveness === "INEFFECTIVE").length;
    const repeatPatternCount = items.filter((item) => item.repeatPatternStatus !== "NONE").length;
    const lowConfidenceCount = items.filter((item) => item.calibrationConfidence === "LOW").length;
    const remediationSuccessRate = toRuntimePercent(
      items.filter((item) => item.latestEffectiveness === "EFFECTIVE" || item.latestEffectiveness === "PARTIAL").length,
      Math.max(sessionCount, 1),
    );
    const reviewRequiredRate = toRuntimePercent(
      items.filter((item) => item.recoveryState === "REVIEW_REQUIRED" || item.recoveryState === "BLOCKED").length,
      Math.max(sessionCount, 1),
    );
    const sessionRate = toRuntimePercent(sessionCount, Math.max(pilotCases.length, 1));
    const driftRate = toRuntimePercent(driftingCount, Math.max(sessionCount, 1));
    const ineffectiveRate = toRuntimePercent(ineffectiveCount, Math.max(sessionCount, 1));
    const repeatPatternRate = toRuntimePercent(repeatPatternCount, Math.max(sessionCount, 1));
    const lowConfidenceRate = toRuntimePercent(lowConfidenceCount, Math.max(sessionCount, 1));
    const guidanceStatuses = items.map((item) => getRuntimeContinuityGuidanceStatus(item).status);
    const skippedGuidanceRate = toRuntimePercent(
      guidanceStatuses.filter((status) => status === "SKIPPED_GUIDANCE").length,
      Math.max(sessionCount, 1),
    );
    const ineffectiveAfterGuidanceRate = toRuntimePercent(
      guidanceStatuses.filter((status) => status === "INEFFECTIVE_AFTER_GUIDANCE").length,
      Math.max(sessionCount, 1),
    );
    const trendMetrics = buildRuntimeContinuityTrendMetrics(items);
    const sampleCoverageBand = getRuntimeContinuitySampleCoverageBand(sessionCount, Math.max(pilotCases.length, 1));
    const baseConfidenceBand = getRuntimeContinuityPilotConfidenceBand({
      driftRate,
      longHorizonDriftRate: trendMetrics.longHorizonDriftRate,
      ineffectiveRate,
      repeatPatternRate,
      lowConfidenceRate,
      skippedGuidanceRate,
      ineffectiveAfterGuidanceRate,
    }, CONTINUITY_PILOT_EFFECTIVENESS_REVIEW_PROFILE);
    const stabilityThreshold = getRuntimeContinuityStabilityThreshold(sampleCoverageBand);
    const stabilityScore = getRuntimeContinuityStabilityScore({
      sampleCoverageBand,
      driftRate,
      longHorizonDriftRate: trendMetrics.longHorizonDriftRate,
      repeatPatternRate,
      reviewRequiredRate,
      skippedGuidanceRate,
      ineffectiveAfterGuidanceRate,
      effectivenessChange: trendMetrics.effectivenessChange,
    });
    const stabilityBand = getRuntimeContinuityStabilityBand(stabilityScore, stabilityThreshold);
    const confidenceBand = getRuntimeContinuityStabilityAwareConfidenceBand(
      baseConfidenceBand,
      sampleCoverageBand,
      stabilityBand,
    );
    const confidenceInterval = getRuntimeContinuityConfidenceInterval({
      confidenceBand,
      sampleCoverageBand,
      stabilityBand,
    });
    const stabilityVariance = getRuntimeContinuityStabilityVariance({
      driftRateDelta: trendMetrics.driftRateDelta,
      effectivenessChange: trendMetrics.effectivenessChange,
      repeatPatternRate,
      ineffectiveAfterGuidanceRate,
    });
    const stabilityConfidenceBand = getRuntimeContinuityStabilityConfidenceBand({
      sampleCoverageBand,
      stabilityBand,
      stabilityVariance,
    });
    const riskBand = getRuntimeContinuityPilotRiskBand(confidenceBand);
    const recommendedIneffectiveThreshold = getRuntimeContinuityPilotThreshold(
      confidenceBand,
      CONTINUITY_PILOT_EFFECTIVENESS_REVIEW_PROFILE,
    );
    const confidenceSummary = buildRuntimeContinuityConfidenceSummary({
      confidenceBand,
      riskBand,
      driftRate,
      longHorizonDriftRate: trendMetrics.longHorizonDriftRate,
      skippedGuidanceRate,
      ineffectiveAfterGuidanceRate,
    });

    return {
      sessionCount,
      sessionRate,
      remediationSuccessRate,
      reviewRequiredRate,
      driftRate,
      ineffectiveRate,
      repeatPatternRate,
      lowConfidenceRate,
      skippedGuidanceRate,
      ineffectiveAfterGuidanceRate,
      sampleCoverageBand,
      stabilityVariance,
      stabilityConfidenceBand,
      rawConfidenceBand: baseConfidenceBand,
      confidenceBand,
      confidenceInterval,
      riskBand,
      recommendedIneffectiveThreshold,
      stabilityThreshold,
      stabilityScore,
      stabilityBand,
      confidenceSummary,
      trendMetrics,
    };
  };

  const buildAdjustmentSummary = (
    scope: string,
    confidenceBand: WorkspaceContinuityPilotClassReview["confidenceBand"],
  ) =>
    confidenceBand === "LOW"
      ? `${scope} is a low-band failure class in current pilot review. Treat repeated ineffective recovery as an early review signal and keep operator confidence conservative.`
      : confidenceBand === "MEDIUM"
        ? `${scope} is a watch-level failure class. Keep the current threshold, but require explicit evidence review before repeating the same remediation.`
        : `${scope} is currently inside acceptable pilot bounds; the current remediation threshold remains appropriate.`;

  const buildThresholdSummary = (
    scope: string,
    confidenceBand: WorkspaceContinuityPilotClassReview["confidenceBand"],
    recommendedIneffectiveThreshold: number,
    sampleCoverageBand: RuntimeContinuitySampleCoverageBand,
  ) => {
    const sampleNote =
      sampleCoverageBand === "NARROW"
        ? " Current pilot sample is still narrow, so keep this threshold advisory and review-first."
        : sampleCoverageBand === "QUALIFIED"
          ? " Current pilot sample is qualified enough for operator guidance, but not broad enough to relax review posture."
          : " Current pilot sample is broad enough to keep this threshold visible with stronger operator confidence.";
    const baseSummary =
      confidenceBand === "LOW"
        ? `${scope} should tighten to threshold ${recommendedIneffectiveThreshold} until more pilot recovery evidence lands.`
        : confidenceBand === "MEDIUM"
          ? `${scope} keeps threshold ${recommendedIneffectiveThreshold}, but repeated remediation should still force explicit evidence review.`
          : `${scope} is currently stable enough to keep threshold ${recommendedIneffectiveThreshold}.`;
    return `${baseSummary}${sampleNote}`;
  };

  const buildLongHorizonSummary = (scope: string, trendMetrics: ReturnType<typeof buildRuntimeContinuityTrendMetrics>) => {
    if (trendMetrics.longHorizonDriftRate >= 50) {
      return `${scope} keeps drifting across the longer pilot horizon (${trendMetrics.longHorizonDriftRate}% drift).`;
    }
    if (trendMetrics.driftRateDelta >= 15) {
      return `${scope} drift is worsening in the newer pilot window.`;
    }
    if (trendMetrics.driftRateDelta <= -15) {
      return `${scope} drift is easing versus older pilot cases.`;
    }
    if (trendMetrics.effectivenessChange >= 15) {
      return `${scope} is showing stronger remediation effectiveness than the older pilot window.`;
    }
    if (trendMetrics.effectivenessChange <= -15) {
      return `${scope} is losing remediation effectiveness versus the older pilot window.`;
    }
    return `${scope} stays broadly flat across the longer pilot horizon.`;
  };

  const failureDistribution = Array.from(grouped.entries())
    .map(([failureTaxonomy, items]) => {
      const metrics = buildAggregateMetrics(items);

      return {
        failureTaxonomy,
        sessionCount: metrics.sessionCount,
        sessionRate: metrics.sessionRate,
        ineffectiveRate: metrics.ineffectiveRate,
        repeatPatternRate: metrics.repeatPatternRate,
        lowConfidenceRate: metrics.lowConfidenceRate,
        driftRate: metrics.driftRate,
        rawConfidenceBand: metrics.rawConfidenceBand,
        confidenceBand: metrics.confidenceBand,
        confidenceInterval: metrics.confidenceInterval,
        recommendedIneffectiveThreshold: metrics.recommendedIneffectiveThreshold,
        sampleCoverageBand: metrics.sampleCoverageBand,
        sampleCoverageSummary: buildRuntimeContinuitySampleCoverageSummary(
          failureTaxonomy,
          metrics.sampleCoverageBand,
          metrics.sessionCount,
          metrics.sessionRate,
        ),
        stabilityBand: metrics.stabilityBand,
        stabilityConfidenceBand: metrics.stabilityConfidenceBand,
        stabilitySummary: buildRuntimeContinuityStabilitySummary(failureTaxonomy, {
          stabilityBand: metrics.stabilityBand,
          stabilityScore: metrics.stabilityScore,
          stabilityThreshold: metrics.stabilityThreshold,
          sampleCoverageBand: metrics.sampleCoverageBand,
          longHorizonDriftRate: metrics.trendMetrics.longHorizonDriftRate,
          repeatPatternRate: metrics.repeatPatternRate,
          effectivenessChange: metrics.trendMetrics.effectivenessChange,
        }),
        stabilityVarianceSummary: buildRuntimeContinuityStabilityVarianceSummary(failureTaxonomy, {
          stabilityVariance: metrics.stabilityVariance,
          stabilityConfidenceBand: metrics.stabilityConfidenceBand,
          sampleCoverageBand: metrics.sampleCoverageBand,
          stabilityBand: metrics.stabilityBand,
        }),
        topTierFailureClass: false,
        summary: `${failureTaxonomy} appears in ${metrics.sessionCount} pilot case(s) (${metrics.sessionRate}%) with ${metrics.driftRate}% drifting posture and ${metrics.ineffectiveRate}% ineffective latest outcomes.`,
        adjustmentSummary: buildAdjustmentSummary(failureTaxonomy, metrics.confidenceBand),
        driftSummary:
          metrics.trendMetrics.driftRateDelta >= 15
            ? `${failureTaxonomy} drift is worsening across newer pilot cases.`
            : metrics.trendMetrics.driftRateDelta <= -15
              ? `${failureTaxonomy} drift is easing across newer pilot cases.`
              : metrics.driftRate >= 50
                ? `${failureTaxonomy} is still drifting across most reviewed pilot cases.`
                : metrics.driftRate >= 25
                  ? `${failureTaxonomy} shows mixed drift and needs operator attention.`
                  : `${failureTaxonomy} is comparatively stable inside the current pilot sample.`,
      };
    })
    .sort((left, right) => {
      if (right.sessionCount !== left.sessionCount) return right.sessionCount - left.sessionCount;
      if (right.driftRate !== left.driftRate) return right.driftRate - left.driftRate;
      return right.ineffectiveRate - left.ineffectiveRate;
    });

  const topFailureClasses = failureDistribution
    .map((item, index) => ({
      ...item,
      topTierFailureClass: index < CONTINUITY_PILOT_EFFECTIVENESS_REVIEW_PROFILE.topFailureClassCount,
    }))
    .slice(0, CONTINUITY_PILOT_EFFECTIVENESS_REVIEW_PROFILE.topFailureClassCount);
  const distributionWithTier = failureDistribution.map((item) => ({
    ...item,
    topTierFailureClass: topFailureClasses.some((topItem) => topItem.failureTaxonomy === item.failureTaxonomy),
  }));
  const improvingSessions = pilotCases.filter((item) => getRuntimeContinuityDriftState(item) === "IMPROVING").length;
  const stableSessions = pilotCases.filter((item) => getRuntimeContinuityDriftState(item) === "STABLE").length;
  const driftingSessions = pilotCases.filter((item) => getRuntimeContinuityDriftState(item) === "DRIFTING").length;
  const repeatedIneffectiveSessions = pilotCases.filter(
    (item) => item.repeatPatternStatus === "REPEATED_INEFFECTIVE_ACTION",
  ).length;
  const trendMetrics = buildRuntimeContinuityTrendMetrics(pilotCases);
  const driftRate = toRuntimePercent(driftingSessions, Math.max(pilotCases.length, 1));
  const lowBandClasses = distributionWithTier.filter((item) => item.confidenceBand === "LOW").length;
  const mediumBandClasses = distributionWithTier.filter((item) => item.confidenceBand === "MEDIUM").length;
  const highBandClasses = distributionWithTier.filter((item) => item.confidenceBand === "HIGH").length;
  const highRiskClasses = distributionWithTier.filter(
    (item) => getRuntimeContinuityPilotRiskBand(item.confidenceBand) === "HIGH",
  ).length;
  const watchRiskClasses = distributionWithTier.filter(
    (item) => getRuntimeContinuityPilotRiskBand(item.confidenceBand) === "WATCH",
  ).length;
  const lowRiskClasses = distributionWithTier.filter(
    (item) => getRuntimeContinuityPilotRiskBand(item.confidenceBand) === "LOW",
  ).length;
  const defaultIneffectiveThreshold =
    highRiskClasses > 0 ||
    trendMetrics.longHorizonDriftRate >= CONTINUITY_PILOT_EFFECTIVENESS_REVIEW_PROFILE.lowBandLongHorizonDriftRate
      ? CONTINUITY_PILOT_EFFECTIVENESS_REVIEW_PROFILE.earlyIneffectiveThreshold
      : CONTINUITY_PILOT_EFFECTIVENESS_REVIEW_PROFILE.defaultIneffectiveThreshold;
  const meetingShapeGrouped = new Map<RuntimeContinuityMeetingShape, WorkspaceContinuityQueueItem[]>();
  for (const item of pilotCases) {
    const meetingShape = getRuntimeContinuityMeetingShape(item);
    const list = meetingShapeGrouped.get(meetingShape) ?? [];
    list.push(item);
    meetingShapeGrouped.set(meetingShape, list);
  }
  const meetingShapeCohorts = Array.from(meetingShapeGrouped.entries())
    .map(([meetingShape, items]) => {
      const metrics = buildAggregateMetrics(items);
      const repeatIneffectiveRate = toRuntimePercent(
        items.filter((item) => item.repeatPatternStatus === "REPEATED_INEFFECTIVE_ACTION").length,
        Math.max(items.length, 1),
      );
      return {
        meetingShape,
        sessionCount: metrics.sessionCount,
        sessionRate: metrics.sessionRate,
        topFailureClass: getRuntimeContinuityTopFailureClass(items),
        remediationSuccessRate: metrics.remediationSuccessRate,
        driftRate: metrics.driftRate,
        repeatIneffectiveRate,
        rawConfidenceBand: metrics.rawConfidenceBand,
        confidenceBand: metrics.confidenceBand,
        confidenceInterval: metrics.confidenceInterval,
        recommendedIneffectiveThreshold: metrics.recommendedIneffectiveThreshold,
        sampleCoverageBand: metrics.sampleCoverageBand,
        sampleCoverageSummary: buildRuntimeContinuitySampleCoverageSummary(
          `${meetingShape} meeting shape`,
          metrics.sampleCoverageBand,
          metrics.sessionCount,
          metrics.sessionRate,
        ),
        stabilityBand: metrics.stabilityBand,
        stabilityConfidenceBand: metrics.stabilityConfidenceBand,
        stabilitySummary: buildRuntimeContinuityStabilitySummary(`${meetingShape} meeting shape`, {
          stabilityBand: metrics.stabilityBand,
          stabilityScore: metrics.stabilityScore,
          stabilityThreshold: metrics.stabilityThreshold,
          sampleCoverageBand: metrics.sampleCoverageBand,
          longHorizonDriftRate: metrics.trendMetrics.longHorizonDriftRate,
          repeatPatternRate: repeatIneffectiveRate,
          effectivenessChange: metrics.trendMetrics.effectivenessChange,
        }),
        stabilityVarianceSummary: buildRuntimeContinuityStabilityVarianceSummary(`${meetingShape} meeting shape`, {
          stabilityVariance: metrics.stabilityVariance,
          stabilityConfidenceBand: metrics.stabilityConfidenceBand,
          sampleCoverageBand: metrics.sampleCoverageBand,
          stabilityBand: metrics.stabilityBand,
        }),
        summary: `${meetingShape} covers ${metrics.sessionCount} pilot case(s) (${metrics.sessionRate}%) with ${metrics.remediationSuccessRate}% remediation success and ${metrics.driftRate}% drift.`,
        thresholdSummary: buildThresholdSummary(
          meetingShape,
          metrics.confidenceBand,
          metrics.recommendedIneffectiveThreshold,
          metrics.sampleCoverageBand,
        ),
        driftSummary:
          metrics.trendMetrics.driftRateDelta >= 15
            ? `${meetingShape} drift is rising in newer pilot cases.`
            : metrics.trendMetrics.driftRateDelta <= -15
              ? `${meetingShape} drift is easing in newer pilot cases.`
              : `${meetingShape} drift is broadly flat across the current pilot sample.`,
      };
    })
    .sort((left, right) => {
      if (right.sessionCount !== left.sessionCount) return right.sessionCount - left.sessionCount;
      if (right.driftRate !== left.driftRate) return right.driftRate - left.driftRate;
      return right.repeatIneffectiveRate - left.repeatIneffectiveRate;
    });
  const sessionDensityGrouped = new Map<RuntimeContinuitySessionDensityBand, WorkspaceContinuityQueueItem[]>();
  const meetingFrequencyGrouped = new Map<RuntimeContinuityMeetingFrequencyBand, WorkspaceContinuityQueueItem[]>();
  const failureHistoryGrouped = new Map<RuntimeContinuityFailureHistoryBand, WorkspaceContinuityQueueItem[]>();
  const participantRoleGrouped = new Map<RuntimeContinuityParticipantRolePosture, WorkspaceContinuityQueueItem[]>();
  for (const item of pilotCases) {
    const densityItems = sessionDensityGrouped.get(item.sessionDensityBand) ?? [];
    densityItems.push(item);
    sessionDensityGrouped.set(item.sessionDensityBand, densityItems);

    const cadenceItems = meetingFrequencyGrouped.get(item.meetingFrequencyBand) ?? [];
    cadenceItems.push(item);
    meetingFrequencyGrouped.set(item.meetingFrequencyBand, cadenceItems);

    const historyItems = failureHistoryGrouped.get(item.failureHistoryBand) ?? [];
    historyItems.push(item);
    failureHistoryGrouped.set(item.failureHistoryBand, historyItems);

    const participantItems = participantRoleGrouped.get(item.participantRolePosture) ?? [];
    participantItems.push(item);
    participantRoleGrouped.set(item.participantRolePosture, participantItems);
  }
  const sessionDensityCohorts = Array.from(sessionDensityGrouped.entries())
    .map(([sessionDensityBand, items]) => {
      const metrics = buildAggregateMetrics(items);
      return {
        sessionDensityBand,
        sessionCount: metrics.sessionCount,
        sessionRate: metrics.sessionRate,
        topFailureClass: getRuntimeContinuityTopFailureClass(items),
        remediationSuccessRate: metrics.remediationSuccessRate,
        driftRate: metrics.driftRate,
        rawConfidenceBand: metrics.rawConfidenceBand,
        confidenceBand: metrics.confidenceBand,
        confidenceInterval: metrics.confidenceInterval,
        riskBand: metrics.riskBand,
        recommendedIneffectiveThreshold: metrics.recommendedIneffectiveThreshold,
        sampleCoverageBand: metrics.sampleCoverageBand,
        sampleCoverageSummary: buildRuntimeContinuitySampleCoverageSummary(
          `${sessionDensityBand} session density`,
          metrics.sampleCoverageBand,
          metrics.sessionCount,
          metrics.sessionRate,
        ),
        stabilityBand: metrics.stabilityBand,
        stabilityConfidenceBand: metrics.stabilityConfidenceBand,
        stabilitySummary: buildRuntimeContinuityStabilitySummary(`${sessionDensityBand} session density`, {
          stabilityBand: metrics.stabilityBand,
          stabilityScore: metrics.stabilityScore,
          stabilityThreshold: metrics.stabilityThreshold,
          sampleCoverageBand: metrics.sampleCoverageBand,
          longHorizonDriftRate: metrics.trendMetrics.longHorizonDriftRate,
          repeatPatternRate: metrics.repeatPatternRate,
          effectivenessChange: metrics.trendMetrics.effectivenessChange,
        }),
        stabilityVarianceSummary: buildRuntimeContinuityStabilityVarianceSummary(`${sessionDensityBand} session density`, {
          stabilityVariance: metrics.stabilityVariance,
          stabilityConfidenceBand: metrics.stabilityConfidenceBand,
          sampleCoverageBand: metrics.sampleCoverageBand,
          stabilityBand: metrics.stabilityBand,
        }),
        summary: `${sessionDensityBand} session density covers ${metrics.sessionCount} pilot case(s) (${metrics.sessionRate}%) with ${metrics.remediationSuccessRate}% remediation success and ${metrics.driftRate}% drift.`,
        calibrationSummary: buildThresholdSummary(
          `${sessionDensityBand} session density`,
          metrics.confidenceBand,
          metrics.recommendedIneffectiveThreshold,
          metrics.sampleCoverageBand,
        ),
        driftSummary: buildLongHorizonSummary(`${sessionDensityBand} session density`, metrics.trendMetrics),
      };
    })
    .sort((left, right) => {
      if (right.sessionCount !== left.sessionCount) return right.sessionCount - left.sessionCount;
      if (right.driftRate !== left.driftRate) return right.driftRate - left.driftRate;
      return right.remediationSuccessRate - left.remediationSuccessRate;
    });
  const meetingFrequencyCohorts = Array.from(meetingFrequencyGrouped.entries())
    .map(([meetingFrequencyBand, items]) => {
      const metrics = buildAggregateMetrics(items);
      return {
        meetingFrequencyBand,
        sessionCount: metrics.sessionCount,
        sessionRate: metrics.sessionRate,
        topFailureClass: getRuntimeContinuityTopFailureClass(items),
        remediationSuccessRate: metrics.remediationSuccessRate,
        driftRate: metrics.driftRate,
        rawConfidenceBand: metrics.rawConfidenceBand,
        confidenceBand: metrics.confidenceBand,
        confidenceInterval: metrics.confidenceInterval,
        riskBand: metrics.riskBand,
        recommendedIneffectiveThreshold: metrics.recommendedIneffectiveThreshold,
        sampleCoverageBand: metrics.sampleCoverageBand,
        sampleCoverageSummary: buildRuntimeContinuitySampleCoverageSummary(
          `${meetingFrequencyBand} meeting cadence`,
          metrics.sampleCoverageBand,
          metrics.sessionCount,
          metrics.sessionRate,
        ),
        stabilityBand: metrics.stabilityBand,
        stabilityConfidenceBand: metrics.stabilityConfidenceBand,
        stabilitySummary: buildRuntimeContinuityStabilitySummary(`${meetingFrequencyBand} meeting cadence`, {
          stabilityBand: metrics.stabilityBand,
          stabilityScore: metrics.stabilityScore,
          stabilityThreshold: metrics.stabilityThreshold,
          sampleCoverageBand: metrics.sampleCoverageBand,
          longHorizonDriftRate: metrics.trendMetrics.longHorizonDriftRate,
          repeatPatternRate: metrics.repeatPatternRate,
          effectivenessChange: metrics.trendMetrics.effectivenessChange,
        }),
        stabilityVarianceSummary: buildRuntimeContinuityStabilityVarianceSummary(`${meetingFrequencyBand} meeting cadence`, {
          stabilityVariance: metrics.stabilityVariance,
          stabilityConfidenceBand: metrics.stabilityConfidenceBand,
          sampleCoverageBand: metrics.sampleCoverageBand,
          stabilityBand: metrics.stabilityBand,
        }),
        summary: `${meetingFrequencyBand} meeting cadence covers ${metrics.sessionCount} pilot case(s) (${metrics.sessionRate}%) with ${metrics.remediationSuccessRate}% remediation success and ${metrics.driftRate}% drift.`,
        calibrationSummary: buildThresholdSummary(
          `${meetingFrequencyBand} meeting cadence`,
          metrics.confidenceBand,
          metrics.recommendedIneffectiveThreshold,
          metrics.sampleCoverageBand,
        ),
        driftSummary: buildLongHorizonSummary(`${meetingFrequencyBand} meeting cadence`, metrics.trendMetrics),
      };
    })
    .sort((left, right) => {
      if (right.sessionCount !== left.sessionCount) return right.sessionCount - left.sessionCount;
      if (right.driftRate !== left.driftRate) return right.driftRate - left.driftRate;
      return right.remediationSuccessRate - left.remediationSuccessRate;
    });
  const failureHistoryCohorts = Array.from(failureHistoryGrouped.entries())
    .map(([failureHistoryBand, items]) => {
      const metrics = buildAggregateMetrics(items);
      return {
        failureHistoryBand,
        sessionCount: metrics.sessionCount,
        sessionRate: metrics.sessionRate,
        topFailureClass: getRuntimeContinuityTopFailureClass(items),
        reviewRequiredRate: metrics.reviewRequiredRate,
        ineffectiveAfterGuidanceRate: metrics.ineffectiveAfterGuidanceRate,
        rawConfidenceBand: metrics.rawConfidenceBand,
        confidenceBand: metrics.confidenceBand,
        confidenceInterval: metrics.confidenceInterval,
        riskBand: metrics.riskBand,
        recommendedIneffectiveThreshold: metrics.recommendedIneffectiveThreshold,
        sampleCoverageBand: metrics.sampleCoverageBand,
        sampleCoverageSummary: buildRuntimeContinuitySampleCoverageSummary(
          `${failureHistoryBand} failure history`,
          metrics.sampleCoverageBand,
          metrics.sessionCount,
          metrics.sessionRate,
        ),
        stabilityBand: metrics.stabilityBand,
        stabilityConfidenceBand: metrics.stabilityConfidenceBand,
        stabilitySummary: buildRuntimeContinuityStabilitySummary(`${failureHistoryBand} failure history`, {
          stabilityBand: metrics.stabilityBand,
          stabilityScore: metrics.stabilityScore,
          stabilityThreshold: metrics.stabilityThreshold,
          sampleCoverageBand: metrics.sampleCoverageBand,
          longHorizonDriftRate: metrics.trendMetrics.longHorizonDriftRate,
          repeatPatternRate: metrics.repeatPatternRate,
          reviewRequiredRate: metrics.reviewRequiredRate,
          effectivenessChange: metrics.trendMetrics.effectivenessChange,
        }),
        stabilityVarianceSummary: buildRuntimeContinuityStabilityVarianceSummary(`${failureHistoryBand} failure history`, {
          stabilityVariance: metrics.stabilityVariance,
          stabilityConfidenceBand: metrics.stabilityConfidenceBand,
          sampleCoverageBand: metrics.sampleCoverageBand,
          stabilityBand: metrics.stabilityBand,
        }),
        summary: `${failureHistoryBand} failure history covers ${metrics.sessionCount} pilot case(s) (${metrics.sessionRate}%) with ${metrics.reviewRequiredRate}% review-required posture and ${metrics.ineffectiveAfterGuidanceRate}% ineffective-after-guidance.`,
        varianceSummary:
          failureHistoryBand === "CHRONIC_REPEAT"
            ? `${failureHistoryBand} should stay on explicit review-first handling because repeated ineffective or looping remediation is already part of the local history.`
            : failureHistoryBand === "REPEATED_FAILURE"
              ? `${failureHistoryBand} still needs tighter evidence review before repeating the same bounded remediation.`
              : `${failureHistoryBand} currently reflects first-signal handling only; do not overfit this subgroup before more pilot evidence lands.`,
      };
    })
    .sort((left, right) => {
      const bandPriority = {
        CHRONIC_REPEAT: 3,
        REPEATED_FAILURE: 2,
        FIRST_SIGNAL: 1,
      } as const;
      if (bandPriority[right.failureHistoryBand] !== bandPriority[left.failureHistoryBand]) {
        return bandPriority[right.failureHistoryBand] - bandPriority[left.failureHistoryBand];
      }
      if (right.sessionCount !== left.sessionCount) return right.sessionCount - left.sessionCount;
      if (right.reviewRequiredRate !== left.reviewRequiredRate) return right.reviewRequiredRate - left.reviewRequiredRate;
      return right.ineffectiveAfterGuidanceRate - left.ineffectiveAfterGuidanceRate;
    });
  const participantRoleCohorts = Array.from(participantRoleGrouped.entries())
    .map(([participantRolePosture, items]) => {
      const metrics = buildAggregateMetrics(items);
      return {
        participantRolePosture,
        sessionCount: metrics.sessionCount,
        sessionRate: metrics.sessionRate,
        topFailureClass: getRuntimeContinuityTopFailureClass(items),
        remediationSuccessRate: metrics.remediationSuccessRate,
        driftRate: metrics.driftRate,
        rawConfidenceBand: metrics.rawConfidenceBand,
        confidenceBand: metrics.confidenceBand,
        confidenceInterval: metrics.confidenceInterval,
        riskBand: metrics.riskBand,
        recommendedIneffectiveThreshold: metrics.recommendedIneffectiveThreshold,
        sampleCoverageBand: metrics.sampleCoverageBand,
        sampleCoverageSummary: buildRuntimeContinuitySampleCoverageSummary(
          `${participantRolePosture} participant posture`,
          metrics.sampleCoverageBand,
          metrics.sessionCount,
          metrics.sessionRate,
        ),
        stabilityBand: metrics.stabilityBand,
        stabilityConfidenceBand: metrics.stabilityConfidenceBand,
        stabilitySummary: buildRuntimeContinuityStabilitySummary(`${participantRolePosture} participant posture`, {
          stabilityBand: metrics.stabilityBand,
          stabilityScore: metrics.stabilityScore,
          stabilityThreshold: metrics.stabilityThreshold,
          sampleCoverageBand: metrics.sampleCoverageBand,
          longHorizonDriftRate: metrics.trendMetrics.longHorizonDriftRate,
          repeatPatternRate: metrics.repeatPatternRate,
          effectivenessChange: metrics.trendMetrics.effectivenessChange,
        }),
        stabilityVarianceSummary: buildRuntimeContinuityStabilityVarianceSummary(`${participantRolePosture} participant posture`, {
          stabilityVariance: metrics.stabilityVariance,
          stabilityConfidenceBand: metrics.stabilityConfidenceBand,
          sampleCoverageBand: metrics.sampleCoverageBand,
          stabilityBand: metrics.stabilityBand,
        }),
        summary: `${participantRolePosture} participant posture covers ${metrics.sessionCount} pilot case(s) (${metrics.sessionRate}%) with ${metrics.remediationSuccessRate}% remediation success and ${metrics.driftRate}% drift.`,
        calibrationSummary: buildThresholdSummary(
          `${participantRolePosture} participant posture`,
          metrics.confidenceBand,
          metrics.recommendedIneffectiveThreshold,
          metrics.sampleCoverageBand,
        ),
        driftSummary: buildLongHorizonSummary(`${participantRolePosture} participant posture`, metrics.trendMetrics),
      };
    })
    .sort((left, right) => {
      if (right.sessionCount !== left.sessionCount) return right.sessionCount - left.sessionCount;
      if (right.driftRate !== left.driftRate) return right.driftRate - left.driftRate;
      return right.remediationSuccessRate - left.remediationSuccessRate;
    });
  const cohortFamilyGrouped = new Map<
    string,
    Array<
      WorkspaceContinuityQueueItem & {
        failureTaxonomy: Exclude<RuntimeContinuityFailureTaxonomy, "NONE">;
      }
    >
  >();
  for (const item of reviewableFailureCases) {
    const cohortKey = `${workspaceSizeBand} · ${item.meetingShape} · ${item.failureTaxonomy}`;
    const list = cohortFamilyGrouped.get(cohortKey) ?? [];
    list.push(item);
    cohortFamilyGrouped.set(cohortKey, list);
  }
  const cohortFamiliesRaw = Array.from(cohortFamilyGrouped.entries())
    .map(([cohortKey, items]) => {
      const metrics = buildAggregateMetrics(items);
      return {
        cohortKey,
        workspaceSizeBand,
        meetingShape: items[0]?.meetingShape ?? "LEAN_MEETING",
        failureTaxonomy: items[0]?.failureTaxonomy ?? "BUDGET_PRESSURE",
        sessionCount: metrics.sessionCount,
        sessionRate: metrics.sessionRate,
        remediationSuccessRate: metrics.remediationSuccessRate,
        driftRate: metrics.driftRate,
        repeatPatternRate: metrics.repeatPatternRate,
        rawConfidenceBand: metrics.rawConfidenceBand,
        confidenceBand: metrics.confidenceBand,
        confidenceInterval: metrics.confidenceInterval,
        riskBand: metrics.riskBand,
        recommendedIneffectiveThreshold: metrics.recommendedIneffectiveThreshold,
        sampleCoverageBand: metrics.sampleCoverageBand,
        sampleCoverageSummary: buildRuntimeContinuitySampleCoverageSummary(
          cohortKey,
          metrics.sampleCoverageBand,
          metrics.sessionCount,
          metrics.sessionRate,
        ),
        stabilityBand: metrics.stabilityBand,
        stabilityConfidenceBand: metrics.stabilityConfidenceBand,
        stabilitySummary: buildRuntimeContinuityStabilitySummary(cohortKey, {
          stabilityBand: metrics.stabilityBand,
          stabilityScore: metrics.stabilityScore,
          stabilityThreshold: metrics.stabilityThreshold,
          sampleCoverageBand: metrics.sampleCoverageBand,
          longHorizonDriftRate: metrics.trendMetrics.longHorizonDriftRate,
          repeatPatternRate: metrics.repeatPatternRate,
          effectivenessChange: metrics.trendMetrics.effectivenessChange,
        }),
        stabilityVarianceSummary: buildRuntimeContinuityStabilityVarianceSummary(cohortKey, {
          stabilityVariance: metrics.stabilityVariance,
          stabilityConfidenceBand: metrics.stabilityConfidenceBand,
          sampleCoverageBand: metrics.sampleCoverageBand,
          stabilityBand: metrics.stabilityBand,
        }),
        summary: `${cohortKey} appears in ${metrics.sessionCount} pilot case(s) (${metrics.sessionRate}%) with ${metrics.remediationSuccessRate}% remediation success and ${metrics.driftRate}% drift.`,
        recalibrationSummary:
          metrics.riskBand === "HIGH"
            ? `${cohortKey} should stay on threshold ${metrics.recommendedIneffectiveThreshold} and bias toward earlier review because drift or guidance slippage remains concentrated here.`
            : metrics.riskBand === "WATCH"
              ? `${cohortKey} stays on threshold ${metrics.recommendedIneffectiveThreshold}, but retrying the same remediation still needs explicit evidence review.`
              : `${cohortKey} currently stays inside the low-risk pilot cohort band.`,
        longHorizonSummary: buildLongHorizonSummary(cohortKey, metrics.trendMetrics),
        trendMetrics: metrics.trendMetrics,
      };
    })
    .sort((left, right) => {
      if (right.sessionCount !== left.sessionCount) return right.sessionCount - left.sessionCount;
      if (right.driftRate !== left.driftRate) return right.driftRate - left.driftRate;
      return right.repeatPatternRate - left.repeatPatternRate;
    });
  const cohortFamilies = cohortFamiliesRaw.map((item) => ({
    cohortKey: item.cohortKey,
    workspaceSizeBand: item.workspaceSizeBand,
    meetingShape: item.meetingShape,
    failureTaxonomy: item.failureTaxonomy,
    sessionCount: item.sessionCount,
    sessionRate: item.sessionRate,
    remediationSuccessRate: item.remediationSuccessRate,
    driftRate: item.driftRate,
    repeatPatternRate: item.repeatPatternRate,
    confidenceBand: item.confidenceBand,
    riskBand: item.riskBand,
    recommendedIneffectiveThreshold: item.recommendedIneffectiveThreshold,
    sampleCoverageBand: item.sampleCoverageBand,
    sampleCoverageSummary: item.sampleCoverageSummary,
    stabilityBand: item.stabilityBand,
    stabilityConfidenceBand: item.stabilityConfidenceBand,
    stabilitySummary: item.stabilitySummary,
    stabilityVarianceSummary: item.stabilityVarianceSummary,
    summary: item.summary,
    recalibrationSummary: item.recalibrationSummary,
    longHorizonSummary: item.longHorizonSummary,
  }));
  const remediationPostureGrouped = new Map<string, WorkspaceContinuityQueueItem[]>();
  for (const item of pilotCases) {
    const postureKey = `${item.recoveryState} · ${item.latestEffectiveness}`;
    const list = remediationPostureGrouped.get(postureKey) ?? [];
    list.push(item);
    remediationPostureGrouped.set(postureKey, list);
  }
  const remediationPostureCohorts = Array.from(remediationPostureGrouped.entries())
    .map(([postureKey, items]) => {
      const metrics = buildAggregateMetrics(items);
      return {
        recoveryState: items[0]?.recoveryState ?? "STABLE",
        latestEffectiveness: items[0]?.latestEffectiveness ?? "NONE",
        sessionCount: metrics.sessionCount,
        sessionRate: metrics.sessionRate,
        topFailureClass: getRuntimeContinuityTopFailureClass(items),
        driftRate: metrics.driftRate,
        reviewRequiredRate: metrics.reviewRequiredRate,
        rawConfidenceBand: metrics.rawConfidenceBand,
        confidenceBand: metrics.confidenceBand,
        confidenceInterval: metrics.confidenceInterval,
        riskBand: metrics.riskBand,
        recommendedIneffectiveThreshold: metrics.recommendedIneffectiveThreshold,
        sampleCoverageBand: metrics.sampleCoverageBand,
        sampleCoverageSummary: buildRuntimeContinuitySampleCoverageSummary(
          postureKey,
          metrics.sampleCoverageBand,
          metrics.sessionCount,
          metrics.sessionRate,
        ),
        stabilityBand: metrics.stabilityBand,
        stabilityConfidenceBand: metrics.stabilityConfidenceBand,
        stabilitySummary: buildRuntimeContinuityStabilitySummary(postureKey, {
          stabilityBand: metrics.stabilityBand,
          stabilityScore: metrics.stabilityScore,
          stabilityThreshold: metrics.stabilityThreshold,
          sampleCoverageBand: metrics.sampleCoverageBand,
          longHorizonDriftRate: metrics.trendMetrics.longHorizonDriftRate,
          repeatPatternRate: metrics.repeatPatternRate,
          reviewRequiredRate: metrics.reviewRequiredRate,
          effectivenessChange: metrics.trendMetrics.effectivenessChange,
        }),
        stabilityVarianceSummary: buildRuntimeContinuityStabilityVarianceSummary(postureKey, {
          stabilityVariance: metrics.stabilityVariance,
          stabilityConfidenceBand: metrics.stabilityConfidenceBand,
          sampleCoverageBand: metrics.sampleCoverageBand,
          stabilityBand: metrics.stabilityBand,
        }),
        summary: `${postureKey} covers ${metrics.sessionCount} pilot case(s) (${metrics.sessionRate}%) with ${metrics.driftRate}% drift and ${metrics.reviewRequiredRate}% ending in explicit review posture.`,
        varianceSummary:
          metrics.ineffectiveAfterGuidanceRate >= 25
            ? `${postureKey} still shows outcomes degrading after guidance; tighten evidence review before retrying the same path.`
            : metrics.skippedGuidanceRate >= 25
              ? `${postureKey} still reflects skipped guidance often enough to explain part of the operator outcome variance.`
              : `${postureKey} is broadly aligned with the current bounded SOP posture.`,
      };
    })
    .sort((left, right) => {
      if (right.sessionCount !== left.sessionCount) return right.sessionCount - left.sessionCount;
      if (right.driftRate !== left.driftRate) return right.driftRate - left.driftRate;
      return right.reviewRequiredRate - left.reviewRequiredRate;
    });
  const remediationOutcomeReview = (
    ["EFFECTIVE", "PARTIAL", "INEFFECTIVE", "NO_SIGNAL"] as Array<RuntimeRemediationEffectivenessOutcome>
  )
    .map((outcome) => {
      const items = pilotCases.filter((item) => item.latestEffectiveness === outcome);
      if (!items.length) return null;
      return {
        outcome,
        sessionCount: items.length,
        sessionRate: toRuntimePercent(items.length, Math.max(pilotCases.length, 1)),
        topFailureClass: getRuntimeContinuityTopFailureClass(items),
        driftRate: toRuntimePercent(
          items.filter((item) => getRuntimeContinuityDriftState(item) === "DRIFTING").length,
          items.length,
        ),
        summary: `${outcome} appears in ${items.length} pilot case(s); top failure class is ${getRuntimeContinuityTopFailureClass(items) ?? "NONE"} and drift remains visible in ${toRuntimePercent(
          items.filter((item) => getRuntimeContinuityDriftState(item) === "DRIFTING").length,
          items.length,
        )}% of them.`,
      };
    })
    .filter(Boolean) as WorkspaceContinuityPilotReview["remediationOutcomeReview"];
  const workspacePilotCaseRate = toRuntimePercent(pilotCases.length, Math.max(workspaceSessionCount, 1));
  const handlingStatuses = pilotCases.map((item) => getRuntimeContinuityGuidanceStatus(item));
  const matchedGuidanceCount = handlingStatuses.filter((item) => item.status === "MATCHED_GUIDANCE").length;
  const skippedGuidanceCount = handlingStatuses.filter((item) => item.status === "SKIPPED_GUIDANCE").length;
  const ineffectiveAfterGuidanceCount = handlingStatuses.filter((item) => item.status === "INEFFECTIVE_AFTER_GUIDANCE").length;
  const matchedGuidanceRate = toRuntimePercent(matchedGuidanceCount, Math.max(pilotCases.length, 1));
  const skippedGuidanceRate = toRuntimePercent(skippedGuidanceCount, Math.max(pilotCases.length, 1));
  const ineffectiveAfterGuidanceRate = toRuntimePercent(ineffectiveAfterGuidanceCount, Math.max(pilotCases.length, 1));
  const reviewEscalationRate = toRuntimePercent(
    pilotCases.filter((item) => item.recoveryState === "REVIEW_REQUIRED" || item.recoveryState === "BLOCKED").length,
    Math.max(pilotCases.length, 1),
  );
  const thresholdRevisions = buildRuntimeContinuityThresholdRevisions({
    distributionWithTier,
    meetingShapeCohorts,
    cohortFamilies: cohortFamiliesRaw,
    sessionDensityCohorts,
    meetingFrequencyCohorts,
    failureHistoryCohorts,
    participantRoleCohorts,
    remediationPostureCohorts,
    skippedGuidanceRate,
    ineffectiveAfterGuidanceRate,
  });
  const stepReviews = buildRuntimeContinuitySopStepReviews(pilotCases);
  const effectiveOutcomeRate = toRuntimePercent(
    pilotCases.filter((item) => item.latestEffectiveness === "EFFECTIVE" || item.latestEffectiveness === "PARTIAL").length,
    Math.max(pilotCases.length, 1),
  );
  const outcomeVarianceSummary =
    skippedGuidanceRate >= 25
      ? "SOP variance is still driven more by skipped guidance than by the threshold profile; keep skipped steps explicit in the runbook."
      : ineffectiveAfterGuidanceRate >= 25
        ? "Operators are often following the SOP, but outcomes still degrade afterward; tighten evidence requirements before retrying the same step."
        : Math.abs(matchedGuidanceRate - effectiveOutcomeRate) >= 20
          ? "Guidance hit-rate and final operator outcomes still diverge across the current pilot sample; keep calibration conservative."
          : "SOP hit-rate and final operator outcomes stay reasonably aligned across the current pilot sample.";
  const stabilitySignals = [
    ...cohortFamilies,
    ...sessionDensityCohorts,
    ...meetingFrequencyCohorts,
    ...failureHistoryCohorts,
    ...participantRoleCohorts,
    ...remediationPostureCohorts,
  ];
  const stabilityScaleUpSignals = [...stabilitySignals, ...meetingShapeCohorts, ...distributionWithTier];
  const describeStabilityScaleUpScope = (item: (typeof stabilityScaleUpSignals)[number]) => {
    if ("cohortKey" in item) return item.cohortKey;
    if ("meetingShape" in item) return item.meetingShape;
    if ("sessionDensityBand" in item) return `${item.sessionDensityBand} session density`;
    if ("meetingFrequencyBand" in item) return `${item.meetingFrequencyBand} meeting cadence`;
    if ("failureHistoryBand" in item) return `${item.failureHistoryBand} failure history`;
    if ("participantRolePosture" in item) return `${item.participantRolePosture} participant posture`;
    if ("recoveryState" in item) return `${item.recoveryState} · ${item.latestEffectiveness}`;
    return item.failureTaxonomy;
  };
  const stabilityThreshold = getRuntimeContinuityStabilityThreshold("QUALIFIED");
  const highStabilityConfidenceCount = stabilitySignals.filter((item) => item.stabilityConfidenceBand === "HIGH").length;
  const mediumStabilityConfidenceCount = stabilitySignals.filter((item) => item.stabilityConfidenceBand === "MEDIUM").length;
  const lowStabilityConfidenceCount = stabilitySignals.filter((item) => item.stabilityConfidenceBand === "LOW").length;
  const stabilityRecheckHighlights = [
    stabilitySignals.find((item) => item.stabilityConfidenceBand === "LOW")?.stabilityVarianceSummary ?? null,
    stabilitySignals.find((item) => item.stabilityConfidenceBand === "MEDIUM")?.stabilityVarianceSummary ?? null,
    stabilitySignals.find((item) => item.stabilityConfidenceBand === "HIGH")?.stabilityVarianceSummary ?? null,
  ].filter(Boolean) as string[];
  const stabilityRecheckSummary =
    lowStabilityConfidenceCount > 0
      ? "Subgroup stability recheck still shows low-confidence pockets, so pilot guidance should remain explicit about variance and subgroup risk."
      : mediumStabilityConfidenceCount > 0
        ? "Subgroup stability recheck is mostly holding, but some cohorts still carry enough variance that operators should keep the review posture conservative."
        : "Subgroup stability recheck now looks broadly consistent across the current pilot sample, with no major low-confidence subgroup still dominating the readout.";
  const stabilityRecheckAggregateSummary = `${highStabilityConfidenceCount} high / ${mediumStabilityConfidenceCount} medium / ${lowStabilityConfidenceCount} low stability-confidence subgroup readout(s) are currently visible.`;
  const broadStableScaleUpCount = stabilityScaleUpSignals.filter(
    (item) => item.sampleCoverageBand === "BROAD" && item.stabilityBand === "STABLE",
  ).length;
  const qualifiedStableScaleUpCount = stabilityScaleUpSignals.filter(
    (item) => item.sampleCoverageBand === "QUALIFIED" && item.stabilityBand === "STABLE",
  ).length;
  const fragileScaleUpCount = stabilityScaleUpSignals.filter(
    (item) =>
      item.sampleCoverageBand === "NARROW" ||
      item.stabilityBand !== "STABLE" ||
      item.stabilityConfidenceBand === "LOW",
  ).length;
  const stabilityScaleUpFindings = [
    stabilityScaleUpSignals.find(
      (item) => item.sampleCoverageBand !== "NARROW" && item.stabilityBand === "STABLE",
    ),
    stabilityScaleUpSignals.find(
      (item) =>
        item.sampleCoverageBand !== "NARROW" &&
        item.stabilityBand === "WATCH" &&
        item.stabilityConfidenceBand !== "LOW",
    ),
    stabilityScaleUpSignals.find(
      (item) => item.sampleCoverageBand === "NARROW" || item.stabilityConfidenceBand === "LOW",
    ),
    stabilityScaleUpSignals.find((item) => item.stabilityBand === "UNSTABLE"),
  ]
    .filter(Boolean)
    .map((item) => {
      const signal = item as (typeof stabilityScaleUpSignals)[number];
      return `${describeStabilityScaleUpScope(signal)}: ${signal.stabilityBand === "STABLE" ? signal.stabilitySummary : signal.stabilityVarianceSummary}`;
    })
    .filter((item, index, list) => list.indexOf(item) === index)
    .slice(0, 4) as string[];
  const stabilityScaleUpSummary =
    broadStableScaleUpCount > 0 && fragileScaleUpCount <= broadStableScaleUpCount
      ? "Subgroup stability scale-up now reaches broader-sample cohort, meeting-shape, and failure-class readouts without widening authority, so operators can separate steadier subgroups from narrow side signals."
      : fragileScaleUpCount > 0
        ? "Subgroup stability scale-up now spans more cohort, meeting-shape, and failure-class readouts, but fragile or narrow-sample pockets still require conservative operator wording."
        : "Subgroup stability scale-up is active, but the current pilot sample still does not provide enough broader-sample signals to tighten the operator readout.";
  const stabilityScaleUpAggregateSummary = `${broadStableScaleUpCount} broad stable / ${qualifiedStableScaleUpCount} qualified stable / ${fragileScaleUpCount} still-fragile scale-up subgroup readout(s) are currently visible.`;
  const stableScaleUpRecheckCount = stabilityScaleUpSignals.filter(
    (item) =>
      item.sampleCoverageBand !== "NARROW" &&
      item.stabilityBand === "STABLE" &&
      item.stabilityConfidenceBand !== "LOW",
  ).length;
  const varianceCarryingScaleUpCount = stabilityScaleUpSignals.filter(
    (item) =>
      item.stabilityBand !== "STABLE" ||
      item.stabilityConfidenceBand === "LOW" ||
      item.sampleCoverageBand === "NARROW",
  ).length;
  const stabilityScaleUpRecheckFindings = [
    stabilityScaleUpSignals.find(
      (item) =>
        item.sampleCoverageBand === "BROAD" &&
        item.stabilityBand === "STABLE" &&
        item.stabilityConfidenceBand !== "LOW",
    ),
    stabilityScaleUpSignals.find(
      (item) =>
        item.sampleCoverageBand !== "NARROW" &&
        item.stabilityBand === "WATCH" &&
        item.stabilityConfidenceBand !== "LOW",
    ),
    stabilityScaleUpSignals.find((item) => item.stabilityConfidenceBand === "LOW"),
    stabilityScaleUpSignals.find((item) => item.sampleCoverageBand === "NARROW"),
  ]
    .filter(Boolean)
    .map((item) => {
      const signal = item as (typeof stabilityScaleUpSignals)[number];
      const signalSummary =
        signal.stabilityBand === "STABLE" && signal.stabilityConfidenceBand !== "LOW"
          ? signal.stabilitySummary
          : signal.stabilityVarianceSummary;
      return `${describeStabilityScaleUpScope(signal)}: scale-up recheck keeps ${signal.sampleCoverageBand.toLowerCase()} support with ${signal.stabilityBand.toLowerCase()} stability. ${signalSummary}`;
    })
    .filter((item, index, list) => list.indexOf(item) === index)
    .slice(0, 4) as string[];
  const stabilityScaleUpRecheckSummary =
    stableScaleUpRecheckCount > 0 && varianceCarryingScaleUpCount <= stableScaleUpRecheckCount
      ? "Scale-up recheck keeps the larger-sample subgroup readout comparatively stable, so operators can reuse the current continuity guidance without pretending it is production telemetry."
      : stableScaleUpRecheckCount > 0
        ? "Scale-up recheck keeps broader-sample subgroup guidance visible, but variance-carrying cohorts still require conservative wording and explicit local evidence."
        : "Scale-up recheck is active, but current pilot coverage still does not support a materially tighter subgroup readout.";
  const stabilityScaleUpRecheckAggregateSummary = `${stableScaleUpRecheckCount} broader-sample stable / ${varianceCarryingScaleUpCount} variance-carrying scale-up recheck signal(s) are currently visible.`;
  const steadySubgroupDriftCount = cohortFamiliesRaw.filter(
    (item) =>
      item.sampleCoverageBand !== "NARROW" &&
      item.stabilityBand === "STABLE" &&
      item.stabilityConfidenceBand !== "LOW" &&
      item.trendMetrics.longHorizonDriftRate < 50 &&
      item.trendMetrics.driftRateDelta < 15,
  ).length;
  const driftingSubgroupDriftCount = cohortFamiliesRaw.filter(
    (item) =>
      item.trendMetrics.longHorizonDriftRate >= 50 ||
      item.trendMetrics.driftRateDelta >= 15 ||
      item.stabilityBand === "UNSTABLE" ||
      item.stabilityConfidenceBand === "LOW",
  ).length;
  const watchSubgroupDriftCount = Math.max(
    cohortFamiliesRaw.length - steadySubgroupDriftCount - driftingSubgroupDriftCount,
    0,
  );
  const subgroupStabilityDriftFindings = [
    cohortFamiliesRaw.find(
      (item) =>
        item.sampleCoverageBand === "BROAD" &&
        item.stabilityBand === "STABLE" &&
        item.stabilityConfidenceBand !== "LOW" &&
        item.trendMetrics.longHorizonDriftRate < 50,
    ),
    cohortFamiliesRaw.find(
      (item) =>
        item.sampleCoverageBand !== "NARROW" &&
        item.stabilityBand === "WATCH" &&
        item.trendMetrics.longHorizonDriftRate < 50,
    ),
    cohortFamiliesRaw.find(
      (item) =>
        item.trendMetrics.longHorizonDriftRate >= 50 || item.trendMetrics.driftRateDelta >= 15,
    ),
    cohortFamiliesRaw.find(
      (item) => item.sampleCoverageBand === "NARROW" || item.stabilityConfidenceBand === "LOW",
    ),
  ]
    .filter(Boolean)
    .map((item) => {
      const cohort = item as (typeof cohortFamiliesRaw)[number];
      const driftPosture =
        cohort.trendMetrics.longHorizonDriftRate >= 50 || cohort.trendMetrics.driftRateDelta >= 15
          ? "active"
          : cohort.stabilityBand === "STABLE" && cohort.stabilityConfidenceBand !== "LOW"
            ? "contained"
            : "mixed";
      return `${cohort.cohortKey}: subgroup drift stays ${driftPosture} across the longer review window. ${cohort.longHorizonSummary}`;
    })
    .filter((item, index, list) => list.indexOf(item) === index)
    .slice(0, 4) as string[];
  const subgroupStabilityDriftSummary =
    steadySubgroupDriftCount > 0 && driftingSubgroupDriftCount <= steadySubgroupDriftCount
      ? "Subgroup stability drift review stays comparatively steady across the longer pilot horizon, so the current subgroup guidance remains reusable without pretending it is production telemetry."
      : driftingSubgroupDriftCount > 0
        ? "Subgroup stability drift review still sees long-horizon drift pockets across the current cohort families, so subgroup guidance must remain conservative and evidence-first."
        : "Subgroup stability drift review is active, but the current pilot sample still does not provide enough longer-horizon subgroup evidence to tighten the readout.";
  const subgroupStabilityDriftAggregateSummary = `${steadySubgroupDriftCount} steady / ${watchSubgroupDriftCount} watch / ${driftingSubgroupDriftCount} drifting subgroup aging signal(s) are currently visible across the longer continuity review horizon.`;
  const stableCohortAgingCount = cohortFamiliesRaw.filter(
    (item) =>
      item.sampleCoverageBand !== "NARROW" &&
      item.stabilityBand === "STABLE" &&
      item.stabilityConfidenceBand !== "LOW" &&
      item.trendMetrics.longHorizonDriftRate < 50 &&
      item.trendMetrics.oldestDriftRate < 50 &&
      item.trendMetrics.effectivenessChange >= -15,
  ).length;
  const driftingCohortAgingCount = cohortFamiliesRaw.filter(
    (item) =>
      item.trendMetrics.longHorizonDriftRate >= 50 ||
      item.trendMetrics.oldestDriftRate >= 50 ||
      item.trendMetrics.driftRateDelta >= 15 ||
      item.trendMetrics.effectivenessChange <= -15 ||
      item.stabilityBand === "UNSTABLE" ||
      item.stabilityConfidenceBand === "LOW",
  ).length;
  const watchCohortAgingCount = Math.max(
    cohortFamiliesRaw.length - stableCohortAgingCount - driftingCohortAgingCount,
    0,
  );
  const subgroupCohortAgingFindings = [
    cohortFamiliesRaw.find(
      (item) =>
        item.sampleCoverageBand === "BROAD" &&
        item.stabilityBand === "STABLE" &&
        item.stabilityConfidenceBand !== "LOW" &&
        item.trendMetrics.longHorizonDriftRate < 50 &&
        item.trendMetrics.oldestDriftRate < 50,
    ),
    cohortFamiliesRaw.find(
      (item) =>
        item.sampleCoverageBand !== "NARROW" &&
        item.stabilityBand === "WATCH" &&
        item.trendMetrics.longHorizonDriftRate < 50,
    ),
    cohortFamiliesRaw.find(
      (item) =>
        item.trendMetrics.longHorizonDriftRate >= 50 ||
        item.trendMetrics.oldestDriftRate >= 50 ||
        item.trendMetrics.driftRateDelta >= 15 ||
        item.trendMetrics.effectivenessChange <= -15,
    ),
    cohortFamiliesRaw.find(
      (item) => item.sampleCoverageBand === "NARROW" || item.stabilityConfidenceBand === "LOW",
    ),
  ]
    .filter(Boolean)
    .map((item) => {
      const cohort = item as (typeof cohortFamiliesRaw)[number];
      const agingPosture =
        cohort.trendMetrics.longHorizonDriftRate >= 50 ||
        cohort.trendMetrics.oldestDriftRate >= 50 ||
        cohort.trendMetrics.driftRateDelta >= 15 ||
        cohort.trendMetrics.effectivenessChange <= -15
          ? "aging with visible drift"
          : cohort.stabilityBand === "STABLE" && cohort.stabilityConfidenceBand !== "LOW"
            ? "holding comparatively steady"
            : "still mixed";
      return `${cohort.cohortKey}: cohort aging comparison shows this subgroup ${agingPosture}. ${cohort.longHorizonSummary}`;
    })
    .filter((item, index, list) => list.indexOf(item) === index)
    .slice(0, 4) as string[];
  const subgroupCohortAgingSummary =
    stableCohortAgingCount > 0 && driftingCohortAgingCount <= stableCohortAgingCount
      ? "Long-term cohort aging review keeps subgroup drift anchored to wider cohort comparisons, so operators can see which cohort families are holding, which are mixed, and which still need conservative wording."
      : driftingCohortAgingCount > 0
        ? "Long-term cohort aging review still sees drift pockets or effectiveness decay across visible cohort families, so subgroup guidance must stay conservative and evidence-first."
        : "Long-term cohort aging review is active, but the current pilot sample still does not support a sharper subgroup aging readout.";
  const subgroupCohortAgingAggregateSummary = `${stableCohortAgingCount} holding / ${watchCohortAgingCount} watch / ${driftingCohortAgingCount} aging-drift cohort signal(s) are currently visible across the long-term continuity cohort review.`;
  const broadHoldingSubgroupDriftAgingCount = cohortFamiliesRaw.filter(
    (item) =>
      item.sampleCoverageBand === "BROAD" &&
      item.stabilityBand === "STABLE" &&
      item.stabilityConfidenceBand !== "LOW" &&
      item.trendMetrics.longHorizonDriftRate < 50 &&
      item.trendMetrics.oldestDriftRate < 50 &&
      item.trendMetrics.effectivenessChange >= -15,
  ).length;
  const subgroupDriftAgingRiskCount = cohortFamiliesRaw.filter(
    (item) =>
      item.trendMetrics.longHorizonDriftRate >= 50 ||
      item.trendMetrics.oldestDriftRate >= 50 ||
      item.trendMetrics.driftRateDelta >= 15 ||
      item.trendMetrics.effectivenessChange <= -15 ||
      item.stabilityBand === "UNSTABLE" ||
      item.stabilityConfidenceBand === "LOW",
  ).length;
  const subgroupDriftAgingWatchCount = Math.max(
    cohortFamiliesRaw.length - broadHoldingSubgroupDriftAgingCount - subgroupDriftAgingRiskCount,
    0,
  );
  const subgroupDriftAgingScaleUpFindings = [
    cohortFamiliesRaw.find(
      (item) =>
        item.sampleCoverageBand === "BROAD" &&
        item.stabilityBand === "STABLE" &&
        item.stabilityConfidenceBand !== "LOW" &&
        item.trendMetrics.longHorizonDriftRate < 50 &&
        item.trendMetrics.oldestDriftRate < 50,
    ),
    cohortFamiliesRaw.find(
      (item) =>
        item.sampleCoverageBand !== "NARROW" &&
        item.stabilityBand === "WATCH" &&
        item.trendMetrics.longHorizonDriftRate < 50 &&
        item.trendMetrics.oldestDriftRate < 50,
    ),
    cohortFamiliesRaw.find(
      (item) =>
        item.trendMetrics.longHorizonDriftRate >= 50 ||
        item.trendMetrics.oldestDriftRate >= 50 ||
        item.trendMetrics.driftRateDelta >= 15 ||
        item.trendMetrics.effectivenessChange <= -15,
    ),
    cohortFamiliesRaw.find(
      (item) => item.sampleCoverageBand === "NARROW" || item.stabilityConfidenceBand === "LOW",
    ),
  ]
    .filter(Boolean)
    .map((item) => {
      const cohort = item as (typeof cohortFamiliesRaw)[number];
      const agingPosture =
        cohort.trendMetrics.longHorizonDriftRate >= 50 ||
        cohort.trendMetrics.oldestDriftRate >= 50 ||
        cohort.trendMetrics.driftRateDelta >= 15 ||
        cohort.trendMetrics.effectivenessChange <= -15
          ? "aging-drift"
          : cohort.sampleCoverageBand === "BROAD" &&
              cohort.stabilityBand === "STABLE" &&
              cohort.stabilityConfidenceBand !== "LOW"
            ? "broad holding"
            : "watch";
      return `${cohort.cohortKey}: subgroup drift aging scale-up review keeps this cohort in ${agingPosture} posture. ${cohort.longHorizonSummary}`;
    })
    .filter((item, index, list) => list.indexOf(item) === index)
    .slice(0, 4) as string[];
  const subgroupDriftAgingScaleUpSummary =
    broadHoldingSubgroupDriftAgingCount > 0 && subgroupDriftAgingRiskCount <= broadHoldingSubgroupDriftAgingCount
      ? "Subgroup drift aging scale-up review keeps larger-sample cohort aging visible without flattening subgroup differences, so broad holding cohorts and aging-drift cohorts stay separately readable."
      : subgroupDriftAgingRiskCount > 0
        ? "Subgroup drift aging scale-up review still sees aging-drift cohorts inside the broader sample window, so subgroup guidance must stay conservative and evidence-first."
        : "Subgroup drift aging scale-up review is active, but the current pilot sample still does not support a sharper long-horizon subgroup aging readout.";
  const subgroupDriftAgingScaleUpAggregateSummary = `${broadHoldingSubgroupDriftAgingCount} broad-holding / ${subgroupDriftAgingWatchCount} watch / ${subgroupDriftAgingRiskCount} aging-drift cohort signal(s) are currently visible in the scale-up aging review.`;
  const subgroupDriftLongTermHoldingCount = cohortFamiliesRaw.filter(
    (item) =>
      item.sampleCoverageBand !== "NARROW" &&
      item.stabilityBand === "STABLE" &&
      item.stabilityConfidenceBand !== "LOW" &&
      item.trendMetrics.longHorizonDriftRate < 40 &&
      item.trendMetrics.oldestDriftRate < 40 &&
      item.trendMetrics.effectivenessChange >= -10,
  ).length;
  const subgroupDriftLongTermRiskCount = cohortFamiliesRaw.filter(
    (item) =>
      item.trendMetrics.longHorizonDriftRate >= 50 ||
      item.trendMetrics.oldestDriftRate >= 50 ||
      item.trendMetrics.effectivenessChange <= -15 ||
      item.trendMetrics.driftRateDelta >= 15 ||
      item.stabilityBand === "UNSTABLE",
  ).length;
  const subgroupDriftLongTermWatchCount = Math.max(
    cohortFamiliesRaw.length - subgroupDriftLongTermHoldingCount - subgroupDriftLongTermRiskCount,
    0,
  );
  const subgroupDriftLongTermCohortAgingFindings = [
    cohortFamiliesRaw.find(
      (item) =>
        item.sampleCoverageBand !== "NARROW" &&
        item.stabilityBand === "STABLE" &&
        item.stabilityConfidenceBand !== "LOW" &&
        item.trendMetrics.longHorizonDriftRate < 40 &&
        item.trendMetrics.oldestDriftRate < 40,
    ),
    cohortFamiliesRaw.find(
      (item) =>
        item.sampleCoverageBand !== "NARROW" &&
        item.stabilityBand === "WATCH" &&
        item.trendMetrics.longHorizonDriftRate < 50 &&
        item.trendMetrics.oldestDriftRate < 50,
    ),
    cohortFamiliesRaw.find(
      (item) =>
        item.trendMetrics.longHorizonDriftRate >= 50 ||
        item.trendMetrics.oldestDriftRate >= 50 ||
        item.trendMetrics.effectivenessChange <= -15 ||
        item.trendMetrics.driftRateDelta >= 15,
    ),
    cohortFamiliesRaw.find(
      (item) => item.sampleCoverageBand === "NARROW" || item.stabilityConfidenceBand === "LOW",
    ),
  ]
    .filter(Boolean)
    .map((item) => {
      const cohort = item as (typeof cohortFamiliesRaw)[number];
      const agingPosture =
        cohort.trendMetrics.longHorizonDriftRate >= 50 ||
        cohort.trendMetrics.oldestDriftRate >= 50 ||
        cohort.trendMetrics.effectivenessChange <= -15 ||
        cohort.trendMetrics.driftRateDelta >= 15
          ? "aging-drift"
          : cohort.sampleCoverageBand !== "NARROW" &&
              cohort.stabilityBand === "STABLE" &&
              cohort.stabilityConfidenceBand !== "LOW"
            ? "holding"
            : "watch";
      return `${cohort.cohortKey}: subgroup drift long-term cohort aging review keeps this cohort in ${agingPosture} posture across the wider horizon. ${cohort.longHorizonSummary}`;
    })
    .filter((item, index, list) => list.indexOf(item) === index)
    .slice(0, 4) as string[];
  const subgroupDriftLongTermCohortAgingSummary =
    subgroupDriftLongTermHoldingCount > 0 &&
    subgroupDriftLongTermRiskCount <= subgroupDriftLongTermHoldingCount
      ? "Subgroup drift long-term cohort aging review keeps broader holding cohorts and aging-drift cohorts separately visible across the wider pilot horizon, so larger-sample stability does not flatten subgroup variance."
      : subgroupDriftLongTermRiskCount > 0
        ? "Subgroup drift long-term cohort aging review still sees aging-drift cohorts or weakening effectiveness across the wider pilot horizon, so subgroup guidance must stay conservative and evidence-first."
        : "Subgroup drift long-term cohort aging review is active, but the current pilot sample still does not support a sharper longer-horizon subgroup aging readout.";
  const subgroupDriftLongTermCohortAgingAggregateSummary = `${subgroupDriftLongTermHoldingCount} holding / ${subgroupDriftLongTermWatchCount} watch / ${subgroupDriftLongTermRiskCount} aging-drift cohort signal(s) are currently visible in the long-term cohort aging review.`;
  const subgroupDriftLongTermSampleExpansionHoldingCount = cohortFamiliesRaw.filter(
    (item) =>
      item.sampleCoverageBand === "BROAD" &&
      item.trendMetrics.longHorizonDriftRate < 45 &&
      item.trendMetrics.oldestDriftRate < 45 &&
      item.trendMetrics.effectivenessChange >= -5,
  ).length;
  const subgroupDriftLongTermSampleExpansionRiskCount = cohortFamiliesRaw.filter(
    (item) =>
      item.sampleCoverageBand === "NARROW" ||
      item.trendMetrics.longHorizonDriftRate >= 55 ||
      item.trendMetrics.oldestDriftRate >= 55 ||
      item.trendMetrics.effectivenessChange <= -15 ||
      item.trendMetrics.driftRateDelta >= 15,
  ).length;
  const subgroupDriftLongTermSampleExpansionWatchCount = Math.max(
    cohortFamiliesRaw.length -
      subgroupDriftLongTermSampleExpansionHoldingCount -
      subgroupDriftLongTermSampleExpansionRiskCount,
    0,
  );
  const subgroupDriftLongTermSampleExpansionFindings = [
    cohortFamiliesRaw.find(
      (item) =>
        item.sampleCoverageBand === "BROAD" &&
        item.trendMetrics.longHorizonDriftRate < 45 &&
        item.trendMetrics.oldestDriftRate < 45 &&
        item.trendMetrics.effectivenessChange >= -5,
    ),
    cohortFamiliesRaw.find(
      (item) =>
        item.sampleCoverageBand !== "NARROW" &&
        item.stabilityBand !== "UNSTABLE" &&
        item.trendMetrics.longHorizonDriftRate < 55 &&
        item.trendMetrics.oldestDriftRate < 55,
    ),
    cohortFamiliesRaw.find(
      (item) =>
        item.sampleCoverageBand === "NARROW" ||
        item.trendMetrics.longHorizonDriftRate >= 55 ||
        item.trendMetrics.oldestDriftRate >= 55 ||
        item.trendMetrics.effectivenessChange <= -15 ||
        item.trendMetrics.driftRateDelta >= 15,
    ),
    cohortFamiliesRaw.find(
      (item) =>
        item.sampleCoverageBand === "QUALIFIED" &&
        item.trendMetrics.longHorizonDriftRate < 55 &&
        item.trendMetrics.oldestDriftRate < 55,
    ),
  ]
    .filter(Boolean)
    .map((item) => {
      const cohort = item as (typeof cohortFamiliesRaw)[number];
      const expansionPosture =
        cohort.sampleCoverageBand === "NARROW" ||
        cohort.trendMetrics.longHorizonDriftRate >= 55 ||
        cohort.trendMetrics.oldestDriftRate >= 55 ||
        cohort.trendMetrics.effectivenessChange <= -15 ||
        cohort.trendMetrics.driftRateDelta >= 15
          ? "expansion-risk"
          : cohort.sampleCoverageBand === "BROAD" &&
              cohort.trendMetrics.longHorizonDriftRate < 45 &&
              cohort.trendMetrics.oldestDriftRate < 45 &&
              cohort.trendMetrics.effectivenessChange >= -5
            ? "expanded-holding"
            : "expanded-watch";
      return `${cohort.cohortKey}: subgroup drift long-term sample expansion review keeps this cohort in ${expansionPosture} posture across the broader long-horizon sample. ${cohort.longHorizonSummary}`;
    })
    .filter((item, index, list) => list.indexOf(item) === index)
    .slice(0, 4) as string[];
  const subgroupDriftLongTermSampleExpansionSummary =
    subgroupDriftLongTermSampleExpansionHoldingCount > 0 &&
    subgroupDriftLongTermSampleExpansionRiskCount <= subgroupDriftLongTermSampleExpansionHoldingCount
      ? "Subgroup drift long-term sample expansion review keeps broader-sample holding cohorts, watch pockets, and drift pockets explicitly separated across the larger horizon, so operators can see where stability still depends on sample support."
      : subgroupDriftLongTermSampleExpansionRiskCount > 0
        ? "Subgroup drift long-term sample expansion review still shows narrow-support or drift-heavy pockets across the larger horizon, so subgroup guidance must stay conservative and evidence-first."
        : "Subgroup drift long-term sample expansion review is active, but the current pilot sample still does not support a sharper long-horizon drift expansion readout.";
  const subgroupDriftLongTermSampleExpansionAggregateSummary = `${subgroupDriftLongTermSampleExpansionHoldingCount} expanded-holding / ${subgroupDriftLongTermSampleExpansionWatchCount} expanded-watch / ${subgroupDriftLongTermSampleExpansionRiskCount} expansion-risk cohort signal(s) are currently visible in the long-term sample expansion review.`;
  const subgroupDriftLongTermSampleExpansionRefinementHoldingCount = cohortFamiliesRaw.filter(
    (item) =>
      item.sampleCoverageBand === "BROAD" &&
      item.stabilityBand === "STABLE" &&
      item.stabilityConfidenceBand !== "LOW" &&
      item.trendMetrics.longHorizonDriftRate < 40 &&
      item.trendMetrics.oldestDriftRate < 45 &&
      item.trendMetrics.effectivenessChange >= -10,
  ).length;
  const subgroupDriftLongTermSampleExpansionRefinementRiskCount = cohortFamiliesRaw.filter(
    (item) =>
      item.sampleCoverageBand === "NARROW" ||
      item.stabilityConfidenceBand === "LOW" ||
      item.trendMetrics.longHorizonDriftRate >= 55 ||
      item.trendMetrics.oldestDriftRate >= 55 ||
      item.trendMetrics.driftRateDelta >= 15 ||
      item.trendMetrics.effectivenessChange <= -15,
  ).length;
  const subgroupDriftLongTermSampleExpansionRefinementWatchCount = Math.max(
    cohortFamiliesRaw.length -
      subgroupDriftLongTermSampleExpansionRefinementHoldingCount -
      subgroupDriftLongTermSampleExpansionRefinementRiskCount,
    0,
  );
  const subgroupDriftLongTermSampleExpansionRefinementFindings = [
    cohortFamiliesRaw.find(
      (item) =>
        item.sampleCoverageBand === "BROAD" &&
        item.stabilityBand === "STABLE" &&
        item.stabilityConfidenceBand !== "LOW" &&
        item.trendMetrics.longHorizonDriftRate < 40 &&
        item.trendMetrics.oldestDriftRate < 45 &&
        item.trendMetrics.effectivenessChange >= -10,
    ),
    cohortFamiliesRaw.find(
      (item) =>
        item.sampleCoverageBand !== "NARROW" &&
        item.stabilityBand !== "UNSTABLE" &&
        item.stabilityConfidenceBand !== "LOW" &&
        item.trendMetrics.longHorizonDriftRate < 55 &&
        item.trendMetrics.oldestDriftRate < 55,
    ),
    cohortFamiliesRaw.find(
      (item) =>
        item.sampleCoverageBand === "NARROW" ||
        item.stabilityConfidenceBand === "LOW" ||
        item.trendMetrics.longHorizonDriftRate >= 55 ||
        item.trendMetrics.oldestDriftRate >= 55 ||
        item.trendMetrics.driftRateDelta >= 15 ||
        item.trendMetrics.effectivenessChange <= -15,
    ),
  ]
    .filter(Boolean)
    .map((item) => {
      const cohort = item as (typeof cohortFamiliesRaw)[number];
      const refinementPosture =
        cohort.sampleCoverageBand === "BROAD" &&
        cohort.stabilityBand === "STABLE" &&
        cohort.stabilityConfidenceBand !== "LOW" &&
        cohort.trendMetrics.longHorizonDriftRate < 40 &&
        cohort.trendMetrics.oldestDriftRate < 45 &&
        cohort.trendMetrics.effectivenessChange >= -10
          ? "deep-support"
          : cohort.sampleCoverageBand === "NARROW" ||
              cohort.stabilityConfidenceBand === "LOW" ||
              cohort.trendMetrics.longHorizonDriftRate >= 55 ||
              cohort.trendMetrics.oldestDriftRate >= 55 ||
              cohort.trendMetrics.driftRateDelta >= 15 ||
              cohort.trendMetrics.effectivenessChange <= -15
            ? "fragile-support"
            : "mixed-support";
      return `${cohort.cohortKey}: sample expansion refinement keeps this cohort in ${refinementPosture} posture across the broader long-horizon sample. ${cohort.longHorizonSummary}`;
    })
    .filter((item, index, list) => list.indexOf(item) === index)
    .slice(0, 4) as string[];
  const subgroupDriftLongTermSampleExpansionRefinementSummary =
    subgroupDriftLongTermSampleExpansionRefinementHoldingCount > 0 &&
    subgroupDriftLongTermSampleExpansionRefinementRiskCount <=
      subgroupDriftLongTermSampleExpansionRefinementHoldingCount
      ? "Subgroup drift long-term sample expansion refinement keeps deep-support, mixed-support, and fragile-support cohorts explicitly separated across the larger horizon, so operators can see where sample depth still matters."
      : subgroupDriftLongTermSampleExpansionRefinementRiskCount > 0
        ? "Subgroup drift long-term sample expansion refinement still sees fragile-support or drift-heavy pockets across the larger horizon, so subgroup guidance must stay conservative and evidence-first."
        : "Subgroup drift long-term sample expansion refinement is active, but the current pilot sample still does not support a sharper long-horizon sample-depth readout.";
  const subgroupDriftLongTermSampleExpansionRefinementAggregateSummary = `${subgroupDriftLongTermSampleExpansionRefinementHoldingCount} deep-support / ${subgroupDriftLongTermSampleExpansionRefinementWatchCount} mixed-support / ${subgroupDriftLongTermSampleExpansionRefinementRiskCount} fragile-support cohort signal(s) are currently visible in the long-term sample expansion refinement review.`;
  const intervalWordingReview = buildRuntimeContinuityIntervalWordingReview({
    thresholdRevisions,
    stepReviews,
  });
  const materiallyDriftingCohorts = cohortFamiliesRaw
    .filter(
      (item) =>
        item.driftRate >= 50 ||
        item.trendMetrics.longHorizonDriftRate >= 50 ||
        item.trendMetrics.driftRateDelta >= 15,
    )
    .slice(0, 3)
    .map((item) => `${item.cohortKey}: ${item.longHorizonSummary}`);
  const calibrationReadouts = buildRuntimeContinuityCalibrationReadouts({
    defaultIneffectiveThreshold,
    earlyIneffectiveThreshold: CONTINUITY_PILOT_EFFECTIVENESS_REVIEW_PROFILE.earlyIneffectiveThreshold,
    lowBandClasses,
    mediumBandClasses,
    highBandClasses,
    highRiskClasses,
    watchRiskClasses,
    lowRiskClasses,
    topFailureClasses,
    thresholdRevisions,
    sessionDensityCalibrationHeadline: sessionDensityCohorts[0]
      ? `session density ${sessionDensityCohorts[0].sessionDensityBand}: ${sessionDensityCohorts[0].calibrationSummary}`
      : null,
    meetingFrequencyCalibrationHeadline: meetingFrequencyCohorts[0]
      ? `meeting cadence ${meetingFrequencyCohorts[0].meetingFrequencyBand}: ${meetingFrequencyCohorts[0].calibrationSummary}`
      : null,
    failureHistoryCalibrationHeadline: failureHistoryCohorts[0]
      ? `failure history ${failureHistoryCohorts[0].failureHistoryBand}: ${failureHistoryCohorts[0].varianceSummary}`
      : null,
    participantRoleCalibrationHeadline: participantRoleCohorts[0]
      ? `participant posture ${participantRoleCohorts[0].participantRolePosture}: ${participantRoleCohorts[0].calibrationSummary}`
      : null,
    stabilityThreshold,
    stabilitySignals,
    sessionDensityDriftHeadline: sessionDensityCohorts[0]
      ? `session density ${sessionDensityCohorts[0].sessionDensityBand}: ${sessionDensityCohorts[0].driftSummary}`
      : null,
    meetingFrequencyDriftHeadline: meetingFrequencyCohorts[0]
      ? `meeting cadence ${meetingFrequencyCohorts[0].meetingFrequencyBand}: ${meetingFrequencyCohorts[0].driftSummary}`
      : null,
    participantRoleDriftHeadline: participantRoleCohorts[0]
      ? `participant posture ${participantRoleCohorts[0].participantRolePosture}: ${participantRoleCohorts[0].driftSummary}`
      : null,
    materiallyDriftingCohorts,
    longHorizonDriftRate: trendMetrics.longHorizonDriftRate,
  });
  const continuitySynthesis = buildRuntimeContinuitySynthesis({
    stepReviews,
    failureHistoryHeadline: failureHistoryCohorts[0]
      ? `${failureHistoryCohorts[0].failureHistoryBand}: ${failureHistoryCohorts[0].varianceSummary}`
      : null,
    thresholdRevisionHeadline: calibrationReadouts.thresholdRevisionHeadline,
    stabilityReviewHeadline: calibrationReadouts.stabilityReviewHeadline,
  });

  return {
    pilotBasis: CONTINUITY_PILOT_EFFECTIVENESS_REVIEW_PROFILE.pilotBasis,
    totalPilotCases: pilotCases.length,
    workspaceCohort: {
      sizeBand: workspaceSizeBand,
      totalSessions: workspaceSessionCount,
      pilotCaseRate: workspacePilotCaseRate,
      summary: `${workspaceSizeBand} pilot workspace with ${workspaceSessionCount} continuity session(s); ${workspacePilotCaseRate}% of them currently enter the reviewed continuity pilot cohort.`,
    },
    cohortFamilies,
    failureDistribution: distributionWithTier,
    meetingShapeCohorts,
    sessionDensityCohorts,
    meetingFrequencyCohorts,
    failureHistoryCohorts,
    participantRoleCohorts,
    remediationPostureCohorts,
    remediationOutcomeReview,
    topFailureClasses,
    calibrationProfile: calibrationReadouts.calibrationProfile,
    subgroupCalibration: calibrationReadouts.subgroupCalibration,
    sampleReview: calibrationReadouts.sampleReview,
    stabilityReview: calibrationReadouts.stabilityReview,
    stabilityRecheck: {
      summary: stabilityRecheckSummary,
      aggregateSummary: stabilityRecheckAggregateSummary,
      highlights: stabilityRecheckHighlights,
    },
    stabilityScaleUp: {
      summary: stabilityScaleUpSummary,
      aggregateSummary: stabilityScaleUpAggregateSummary,
      findings: stabilityScaleUpFindings,
    },
    stabilityScaleUpRecheck: {
      summary: stabilityScaleUpRecheckSummary,
      aggregateSummary: stabilityScaleUpRecheckAggregateSummary,
      findings: stabilityScaleUpRecheckFindings,
    },
    subgroupStabilityDriftReview: {
      summary: subgroupStabilityDriftSummary,
      aggregateSummary: subgroupStabilityDriftAggregateSummary,
      findings: subgroupStabilityDriftFindings,
    },
    subgroupCohortAgingReview: {
      summary: subgroupCohortAgingSummary,
      aggregateSummary: subgroupCohortAgingAggregateSummary,
      findings: subgroupCohortAgingFindings,
    },
    subgroupDriftAgingScaleUpReview: {
      summary: subgroupDriftAgingScaleUpSummary,
      aggregateSummary: subgroupDriftAgingScaleUpAggregateSummary,
      findings: subgroupDriftAgingScaleUpFindings,
    },
    subgroupDriftLongTermCohortAgingReview: {
      summary: subgroupDriftLongTermCohortAgingSummary,
      aggregateSummary: subgroupDriftLongTermCohortAgingAggregateSummary,
      findings: subgroupDriftLongTermCohortAgingFindings,
    },
    subgroupDriftLongTermSampleExpansionReview: {
      summary: subgroupDriftLongTermSampleExpansionSummary,
      aggregateSummary: subgroupDriftLongTermSampleExpansionAggregateSummary,
      findings: subgroupDriftLongTermSampleExpansionFindings,
    },
    subgroupDriftLongTermSampleExpansionRefinementReview: {
      summary: subgroupDriftLongTermSampleExpansionRefinementSummary,
      aggregateSummary: subgroupDriftLongTermSampleExpansionRefinementAggregateSummary,
      findings: subgroupDriftLongTermSampleExpansionRefinementFindings,
    },
    confidenceSimplification: intervalWordingReview.confidenceSimplification,
    intervalWordingConsistency: intervalWordingReview.intervalWordingConsistency,
    intervalWordingDriftAudit: intervalWordingReview.intervalWordingDriftAudit,
    wordingDriftTracking: intervalWordingReview.wordingDriftTracking,
    intervalConsistencyGuidance: intervalWordingReview.intervalConsistencyGuidance,
    intervalWordingAgingAudit: intervalWordingReview.intervalWordingAgingAudit,
    intervalWordingCrossSurfaceRegressionReview:
      intervalWordingReview.intervalWordingCrossSurfaceRegressionReview,
    intervalWordingCrossSurfaceConsistencyAudit:
      intervalWordingReview.intervalWordingCrossSurfaceConsistencyAudit,
    intervalWordingCrossSurfaceRegressionAudit:
      intervalWordingReview.intervalWordingCrossSurfaceRegressionAudit,
    intervalWordingCrossReadoutRegressionAudit:
      intervalWordingReview.intervalWordingCrossReadoutRegressionAudit,
    intervalWordingCrossReadoutRegressionRefinement:
      intervalWordingReview.intervalWordingCrossReadoutRegressionRefinement,
    drift: {
      improvingSessions,
      stableSessions,
      driftingSessions,
      repeatedIneffectiveSessions,
      driftRate,
      recentDriftRate: trendMetrics.recentDriftRate,
      middleDriftRate: trendMetrics.middleDriftRate,
      olderDriftRate: trendMetrics.olderDriftRate,
      oldestDriftRate: trendMetrics.oldestDriftRate,
      longHorizonDriftRate: trendMetrics.longHorizonDriftRate,
      driftRateDelta: trendMetrics.driftRateDelta,
      recentRepeatIneffectiveRate: trendMetrics.recentRepeatIneffectiveRate,
      longHorizonRepeatIneffectiveRate: trendMetrics.longHorizonRepeatIneffectiveRate,
      longHorizonEffectivenessRate: trendMetrics.longHorizonEffectivenessRate,
      effectivenessChange: trendMetrics.effectivenessChange,
      materiallyDriftingCohorts,
      summary:
        trendMetrics.longHorizonDriftRate >= 50
          ? "Long-horizon pilot drift remains high; operators should bias toward review and evidence collection before repeating the same remediation posture."
          : trendMetrics.driftRateDelta >= 15
            ? "Newer pilot continuity cases are drifting more often than older reviewed cases; keep thresholds conservative and bias toward review."
            : trendMetrics.driftRateDelta <= -15
              ? "Newer pilot continuity cases are drifting less than older reviewed cases, but the operator should still confirm repeat-pattern posture before reusing the same remediation."
              : driftRate >= 25
                ? "Pilot drift is mixed across the longer horizon. Some scenarios are stabilizing, but repeated ineffective recovery still needs explicit review."
                : "Most reviewed pilot continuity cases are either stable or improving across the current longer pilot horizon.",
    },
    driftSynthesis: calibrationReadouts.driftSynthesis,
    longTermOutcomeCorrelation: continuitySynthesis.longTermOutcomeCorrelation,
    thresholdRevisions,
    operatorHandlingEffectiveness: {
      matchedGuidanceRate,
      skippedGuidanceRate,
      ineffectiveAfterGuidanceRate,
      reviewEscalationRate,
      outcomeVarianceSummary,
      stepReviews,
      summary:
        matchedGuidanceCount < Math.max(skippedGuidanceCount, ineffectiveAfterGuidanceCount)
          ? "Operator handling remains mixed across the current pilot sample; too many cases still skip guidance or stay ineffective after it."
          : skippedGuidanceCount > ineffectiveAfterGuidanceCount
            ? "Operators are still skipping part of the current SOP guidance in a visible minority of pilot cases; review-first escalation needs to stay explicit."
            : ineffectiveAfterGuidanceCount > 0
            ? "Most operator paths match the current SOP, but some still end in ineffective outcomes and should keep conservative thresholds."
            : "Most current pilot cases match the intended SOP handling, and no major guidance-skipping pattern is visible.",
      highlights: [
        `${matchedGuidanceCount} case(s) followed guidance and then improved or held the reviewed posture.`,
        skippedGuidanceCount
          ? `${skippedGuidanceCount} case(s) appear to skip escalation or bounded-remediation guidance.`
          : null,
        ineffectiveAfterGuidanceCount
          ? `${ineffectiveAfterGuidanceCount} case(s) followed guidance but still stayed ineffective.`
          : null,
        reviewEscalationRate
          ? `${reviewEscalationRate}% of reviewed pilot cases currently sit in review-required or blocked recovery posture.`
          : null,
        ...stepReviews.slice(0, 2).map((item) => `${item.label}: ${item.improvementHint}`),
      ].filter(Boolean) as string[],
    },
    sopEffectivenessSynthesis: continuitySynthesis.sopEffectivenessSynthesis,
    longTermSopImpact: continuitySynthesis.longTermSopImpact,
    longTermOutcomeReview: continuitySynthesis.longTermOutcomeReview,
    longTermMaterialImpactReview: continuitySynthesis.longTermMaterialImpactReview,
    longTermMaterialImpactAudit: continuitySynthesis.longTermMaterialImpactAudit,
    materialImpactPatternAgingReview: continuitySynthesis.materialImpactPatternAgingReview,
    materialImpactSamplingReview: continuitySynthesis.materialImpactSamplingReview,
    materialImpactSamplingAgingReview: continuitySynthesis.materialImpactSamplingAgingReview,
    materialImpactSamplingAgingRefinement:
      continuitySynthesis.materialImpactSamplingAgingRefinement,
    materialImpactSamplingAgingAudit: continuitySynthesis.materialImpactSamplingAgingAudit,
    materialImpactSamplingAgingRefinementAudit:
      continuitySynthesis.materialImpactSamplingAgingRefinementAudit,
    guidanceRefinement: continuitySynthesis.guidanceRefinement,
    sopHighlights: topFailureClasses.map((item) => {
      const template = buildRuntimeContinuityFailureClassSopTemplate(item.failureTaxonomy);
      return `${item.failureTaxonomy}: ${template.summary}`;
    }),
  };
}

export function buildRuntimeContinuityPilotSessionReview(input: {
  recovery: RuntimeRecoveryState;
  calibration: RuntimeRecoveryCalibration;
  analytics: RuntimeRemediationAnalytics;
  effectiveness: RuntimeRemediationEffectiveness;
  pilotReview?: WorkspaceContinuityPilotReview | null;
  cohortContext?: {
    workspaceSizeBand: RuntimeContinuityWorkspaceSizeBand;
    meetingShape: RuntimeContinuityMeetingShape;
    sessionDensityBand?: RuntimeContinuitySessionDensityBand;
    meetingFrequencyBand?: RuntimeContinuityMeetingFrequencyBand;
    failureHistoryBand?: RuntimeContinuityFailureHistoryBand;
    participantRolePosture?: RuntimeContinuityParticipantRolePosture;
  };
}): RuntimeContinuityPilotSessionReview {
  const classReview =
    input.recovery.failureTaxonomy === "NONE"
      ? null
      : input.pilotReview?.failureDistribution.find((item) => item.failureTaxonomy === input.recovery.failureTaxonomy) ??
        null;
  const workspaceSizeBand = input.cohortContext?.workspaceSizeBand ?? input.pilotReview?.workspaceCohort.sizeBand ?? "SMALL";
  const meetingShape = input.cohortContext?.meetingShape ?? "LEAN_MEETING";
  const sessionDensityBand = input.cohortContext?.sessionDensityBand ?? "LIGHT";
  const meetingFrequencyBand = input.cohortContext?.meetingFrequencyBand ?? "SPORADIC";
  const failureHistoryBand = input.cohortContext?.failureHistoryBand ?? "FIRST_SIGNAL";
  const participantRolePosture = input.cohortContext?.participantRolePosture ?? "UNKNOWN";
  const meetingShapeReview =
    input.pilotReview?.meetingShapeCohorts.find((item) => item.meetingShape === meetingShape) ?? null;
  const sessionDensityReview =
    input.pilotReview?.sessionDensityCohorts.find((item) => item.sessionDensityBand === sessionDensityBand) ?? null;
  const meetingFrequencyReview =
    input.pilotReview?.meetingFrequencyCohorts.find((item) => item.meetingFrequencyBand === meetingFrequencyBand) ?? null;
  const failureHistoryReview =
    input.pilotReview?.failureHistoryCohorts.find((item) => item.failureHistoryBand === failureHistoryBand) ?? null;
  const participantRoleReview =
    input.pilotReview?.participantRoleCohorts.find((item) => item.participantRolePosture === participantRolePosture) ?? null;
  const cohortFamilyKey =
    input.recovery.failureTaxonomy === "NONE"
      ? null
      : `${workspaceSizeBand} · ${meetingShape} · ${input.recovery.failureTaxonomy}`;
  const cohortFamilyReview =
    cohortFamilyKey && input.pilotReview
      ? input.pilotReview.cohortFamilies.find((item) => item.cohortKey === cohortFamilyKey) ?? null
      : null;
  const remediationPostureReview =
    input.pilotReview?.remediationPostureCohorts.find(
      (item) => item.recoveryState === input.recovery.state && item.latestEffectiveness === input.effectiveness.latestOutcome,
    ) ?? null;
  const localGuidance = getRuntimeContinuityGuidanceStatus({
    failureTaxonomy: input.recovery.failureTaxonomy,
    recoveryState: input.recovery.state,
    latestEffectiveness: input.effectiveness.latestOutcome,
    repeatPatternStatus: input.analytics.repeatPattern.status,
  });
  const confidenceBand = classReview?.confidenceBand ?? input.calibration.confidence;
  const riskBand = getRuntimeContinuityPilotRiskBand(confidenceBand);
  const recommendedIneffectiveThreshold =
    cohortFamilyReview?.recommendedIneffectiveThreshold ??
    classReview?.recommendedIneffectiveThreshold ??
    meetingShapeReview?.recommendedIneffectiveThreshold ??
    CONTINUITY_PILOT_EFFECTIVENESS_REVIEW_PROFILE.defaultIneffectiveThreshold;
  const topTierFailureClass = classReview?.topTierFailureClass ?? false;
  const thresholdRevision =
    input.pilotReview?.thresholdRevisions.find((item) => item.scope === cohortFamilyKey) ??
    input.pilotReview?.thresholdRevisions.find(
      (item) => item.scopeType === "session_density" && item.scope === sessionDensityBand,
    ) ??
    input.pilotReview?.thresholdRevisions.find(
      (item) => item.scopeType === "meeting_frequency" && item.scope === meetingFrequencyBand,
    ) ??
    input.pilotReview?.thresholdRevisions.find(
      (item) => item.scopeType === "failure_history" && item.scope === failureHistoryBand,
    ) ??
    input.pilotReview?.thresholdRevisions.find(
      (item) => item.scopeType === "participant_role" && item.scope === participantRolePosture,
    ) ??
    input.pilotReview?.thresholdRevisions.find(
      (item) => item.scope === `${input.recovery.state} · ${input.effectiveness.latestOutcome}`,
    ) ??
    input.pilotReview?.thresholdRevisions.find((item) => item.scope === input.recovery.failureTaxonomy) ??
    input.pilotReview?.thresholdRevisions.find((item) => item.scope === meetingShape) ??
    null;
  const targetStep = getRuntimeContinuitySopStepReviewTarget(input.recovery.failureTaxonomy);
  const stepReview =
    targetStep && input.pilotReview
      ? input.pilotReview.operatorHandlingEffectiveness.stepReviews.find((item) => item.stepId === targetStep.stepId) ?? null
      : null;
  const sampleCoverageBand =
    thresholdRevision?.sampleCoverageBand ??
    cohortFamilyReview?.sampleCoverageBand ??
    sessionDensityReview?.sampleCoverageBand ??
    meetingFrequencyReview?.sampleCoverageBand ??
    failureHistoryReview?.sampleCoverageBand ??
    participantRoleReview?.sampleCoverageBand ??
    classReview?.sampleCoverageBand ??
    stepReview?.sampleCoverageBand ??
    "NARROW";
  const sampleCoverageSummary =
    thresholdRevision?.sampleCoverageSummary ??
    cohortFamilyReview?.sampleCoverageSummary ??
    sessionDensityReview?.sampleCoverageSummary ??
    meetingFrequencyReview?.sampleCoverageSummary ??
    failureHistoryReview?.sampleCoverageSummary ??
    participantRoleReview?.sampleCoverageSummary ??
    classReview?.sampleCoverageSummary ??
    buildRuntimeContinuitySampleCoverageSummary(
      cohortFamilyKey ?? meetingShape,
      sampleCoverageBand,
      cohortFamilyReview?.sessionCount ??
        sessionDensityReview?.sessionCount ??
        meetingFrequencyReview?.sessionCount ??
        failureHistoryReview?.sessionCount ??
        participantRoleReview?.sessionCount ??
        classReview?.sessionCount ??
        0,
      cohortFamilyReview?.sessionRate ??
        sessionDensityReview?.sessionRate ??
        meetingFrequencyReview?.sessionRate ??
        failureHistoryReview?.sessionRate ??
        participantRoleReview?.sessionRate ??
        classReview?.sessionRate ??
        0,
    );
  const stabilityBand =
    thresholdRevision?.stabilityBand ??
    cohortFamilyReview?.stabilityBand ??
    sessionDensityReview?.stabilityBand ??
    meetingFrequencyReview?.stabilityBand ??
    failureHistoryReview?.stabilityBand ??
    participantRoleReview?.stabilityBand ??
    remediationPostureReview?.stabilityBand ??
    classReview?.stabilityBand ??
    stepReview?.stabilityBand ??
    "WATCH";
  const stabilitySummary =
    cohortFamilyReview?.stabilitySummary ??
    sessionDensityReview?.stabilitySummary ??
    meetingFrequencyReview?.stabilitySummary ??
    failureHistoryReview?.stabilitySummary ??
    participantRoleReview?.stabilitySummary ??
    remediationPostureReview?.stabilitySummary ??
    classReview?.stabilitySummary ??
    stepReview?.longTermImpactSummary ??
    buildRuntimeContinuityStabilitySummary(cohortFamilyKey ?? meetingShape, {
      stabilityBand,
      stabilityScore: stabilityBand === "STABLE" ? 75 : stabilityBand === "WATCH" ? 60 : 40,
      stabilityThreshold: getRuntimeContinuityStabilityThreshold(sampleCoverageBand),
      sampleCoverageBand,
      longHorizonDriftRate: input.pilotReview?.drift.longHorizonDriftRate ?? input.analytics.totalAttempts * 10,
      repeatPatternRate: input.analytics.repeatPattern.status === "NONE" ? 0 : 25,
    });
  const stabilityConfidenceBand =
    thresholdRevision?.stabilityConfidenceBand ??
    cohortFamilyReview?.stabilityConfidenceBand ??
    sessionDensityReview?.stabilityConfidenceBand ??
    meetingFrequencyReview?.stabilityConfidenceBand ??
    failureHistoryReview?.stabilityConfidenceBand ??
    participantRoleReview?.stabilityConfidenceBand ??
    remediationPostureReview?.stabilityConfidenceBand ??
    classReview?.stabilityConfidenceBand ??
    stepReview?.stabilityConfidenceBand ??
    getRuntimeContinuityStabilityConfidenceBand({
      sampleCoverageBand,
      stabilityBand,
      stabilityVariance: input.analytics.repeatPattern.status === "NONE" ? 10 : 25,
    });
  const stabilityVarianceSummary =
    cohortFamilyReview?.stabilityVarianceSummary ??
    sessionDensityReview?.stabilityVarianceSummary ??
    meetingFrequencyReview?.stabilityVarianceSummary ??
    failureHistoryReview?.stabilityVarianceSummary ??
    participantRoleReview?.stabilityVarianceSummary ??
    remediationPostureReview?.stabilityVarianceSummary ??
    classReview?.stabilityVarianceSummary ??
    buildRuntimeContinuityStabilityVarianceSummary(cohortFamilyKey ?? meetingShape, {
      stabilityVariance: input.analytics.repeatPattern.status === "NONE" ? 10 : 25,
      stabilityConfidenceBand,
      sampleCoverageBand,
      stabilityBand,
    });
  const stabilityScaleUpSummary = trimText(
    cohortFamilyReview
      ? `${cohortFamilyReview.cohortKey} is part of the current larger-sample stability scale-up. ${input.pilotReview?.stabilityScaleUp.summary ?? ""}`
      : meetingShapeReview
        ? `${meetingShapeReview.meetingShape} is part of the current larger-sample stability scale-up. ${input.pilotReview?.stabilityScaleUp.summary ?? ""}`
        : input.pilotReview?.stabilityScaleUp.summary ??
          "No broader stability scale-up signal is visible yet beyond the current subgroup review.",
    260,
  );
  const stabilityScaleUpRecheckSummary = trimText(
    cohortFamilyReview
      ? `${cohortFamilyReview.cohortKey} is part of the current scale-up recheck. ${input.pilotReview?.stabilityScaleUpRecheck.summary ?? ""}`
      : meetingShapeReview
        ? `${meetingShapeReview.meetingShape} is part of the current scale-up recheck. ${input.pilotReview?.stabilityScaleUpRecheck.summary ?? ""}`
        : input.pilotReview?.stabilityScaleUpRecheck.summary ??
          "No larger-sample scale-up recheck signal is visible yet beyond the current subgroup review.",
    260,
  );
  const subgroupStabilityDriftSummary = trimText(
    cohortFamilyReview
      ? `${cohortFamilyReview.cohortKey} stays inside the current subgroup drift review. ${input.pilotReview?.subgroupStabilityDriftReview.summary ?? ""}`
      : meetingShapeReview
        ? `${meetingShapeReview.meetingShape} stays inside the current subgroup drift review. ${input.pilotReview?.subgroupStabilityDriftReview.summary ?? ""}`
        : input.pilotReview?.subgroupStabilityDriftReview.summary ??
          "No longer-horizon subgroup drift review is visible yet beyond the current scale-up recheck.",
    260,
  );
  const subgroupCohortAgingSummary = trimText(
    cohortFamilyReview
      ? `${cohortFamilyReview.cohortKey} now maps to the current cohort aging comparison. ${input.pilotReview?.subgroupCohortAgingReview.summary ?? ""}`
      : meetingShapeReview
        ? `${meetingShapeReview.meetingShape} now maps to the current cohort aging comparison. ${input.pilotReview?.subgroupCohortAgingReview.summary ?? ""}`
        : input.pilotReview?.subgroupCohortAgingReview.summary ??
          "No longer-term cohort aging review is visible yet beyond the current subgroup drift review.",
    260,
  );
  const subgroupDriftAgingScaleUpSummary = trimText(
    cohortFamilyReview
      ? `${cohortFamilyReview.cohortKey} now sits inside the larger cohort aging scale-up review. ${input.pilotReview?.subgroupDriftAgingScaleUpReview.summary ?? ""}`
      : meetingShapeReview
        ? `${meetingShapeReview.meetingShape} now sits inside the larger cohort aging scale-up review. ${input.pilotReview?.subgroupDriftAgingScaleUpReview.summary ?? ""}`
        : input.pilotReview?.subgroupDriftAgingScaleUpReview.summary ??
          "No larger-sample subgroup drift aging scale-up review is visible yet beyond the current cohort aging comparison.",
    260,
  );
  const subgroupDriftLongTermCohortAgingSummary = trimText(
    cohortFamilyReview
      ? `${cohortFamilyReview.cohortKey} now sits inside the longer-horizon cohort aging review. ${input.pilotReview?.subgroupDriftLongTermCohortAgingReview.summary ?? ""}`
      : meetingShapeReview
        ? `${meetingShapeReview.meetingShape} now sits inside the longer-horizon cohort aging review. ${input.pilotReview?.subgroupDriftLongTermCohortAgingReview.summary ?? ""}`
        : input.pilotReview?.subgroupDriftLongTermCohortAgingReview.summary ??
          "No longer-horizon subgroup drift cohort aging review is visible yet beyond the current aging scale-up readout.",
    260,
  );
  const subgroupDriftLongTermSampleExpansionSummary = trimText(
    cohortFamilyReview
      ? `${cohortFamilyReview.cohortKey} now sits inside the long-term sample expansion review. ${input.pilotReview?.subgroupDriftLongTermSampleExpansionReview.summary ?? ""}`
      : meetingShapeReview
        ? `${meetingShapeReview.meetingShape} now sits inside the long-term sample expansion review. ${input.pilotReview?.subgroupDriftLongTermSampleExpansionReview.summary ?? ""}`
        : input.pilotReview?.subgroupDriftLongTermSampleExpansionReview.summary ??
          "No long-term sample expansion review is visible yet beyond the current longer-horizon cohort aging readout.",
    260,
  );
  const subgroupDriftLongTermSampleExpansionRefinementSummary = trimText(
    cohortFamilyReview
      ? `${cohortFamilyReview.cohortKey} now sits inside the long-term sample expansion refinement review. ${input.pilotReview?.subgroupDriftLongTermSampleExpansionRefinementReview.summary ?? ""}`
      : meetingShapeReview
        ? `${meetingShapeReview.meetingShape} now sits inside the long-term sample expansion refinement review. ${input.pilotReview?.subgroupDriftLongTermSampleExpansionRefinementReview.summary ?? ""}`
        : input.pilotReview?.subgroupDriftLongTermSampleExpansionRefinementReview.summary ??
          "No long-term sample expansion refinement review is visible yet beyond the current sample expansion readout.",
    260,
  );
  const confidenceInterval =
    stepReview?.confidenceInterval ??
    thresholdRevision?.confidenceInterval ??
    getRuntimeContinuityConfidenceInterval({
      confidenceBand,
      sampleCoverageBand,
      stabilityBand,
    });
  const confidenceAdjustmentRationale =
    stepReview?.bandAdjustmentRationale ??
    thresholdRevision?.bandAdjustmentRationale ??
    buildRuntimeContinuityBandAdjustmentRationale(cohortFamilyKey ?? meetingShape, {
      rawConfidenceBand: input.calibration.confidence,
      confidenceBand,
      confidenceInterval,
      sampleCoverageBand,
      stabilityBand,
    });
  const intervalWordingSummary =
    stepReview?.intervalWordingSummary ??
    thresholdRevision?.intervalWordingSummary ??
    buildRuntimeContinuityIntervalWordingSummary(cohortFamilyKey ?? meetingShape, confidenceInterval);
  const intervalWordingDriftSummary = trimText(
    stepReview && thresholdRevision && stepReview.confidenceInterval !== thresholdRevision.confidenceInterval
      ? `${stepReview.label} currently provides the more specific interval wording readout for this session, but both readouts still map back to the canonical ${confidenceInterval.toLowerCase()} interval wording. ${input.pilotReview?.intervalWordingDriftAudit.summary ?? ""}`
      : `This session currently uses the canonical ${confidenceInterval.toLowerCase()} interval wording readout with no additional drift signal visible. ${input.pilotReview?.intervalWordingDriftAudit.summary ?? ""}`,
    260,
  );
  const wordingDriftTrackingSummary = trimText(
    input.pilotReview?.wordingDriftTracking.summary ??
      "No wording drift tracking summary is visible yet beyond the current interval wording audit.",
    260,
  );
  const intervalConsistencyGuidanceSummary = trimText(
    input.pilotReview?.intervalConsistencyGuidance.summary ??
      "No interval consistency guidance is visible yet beyond the current canonical interval wording readout.",
    260,
  );
  const intervalWordingAgingSummary = trimText(
    stepReview && thresholdRevision && stepReview.confidenceInterval !== thresholdRevision.confidenceInterval
      ? `${stepReview.label} still owns the more specific interval wording for this session. ${input.pilotReview?.intervalWordingAgingAudit.summary ?? ""}`
      : input.pilotReview?.intervalWordingAgingAudit.summary ??
        `This session still maps to the canonical ${confidenceInterval.toLowerCase()} interval wording with no additional aging regression visible.`,
    260,
  );
  const intervalWordingRegressionSummary = trimText(
    stepReview
      ? `${stepReview.label} now sits inside the cross-surface interval wording regression review. ${input.pilotReview?.intervalWordingCrossSurfaceRegressionReview.summary ?? ""}`
      : input.pilotReview?.intervalWordingCrossSurfaceRegressionReview.summary ??
        `This session still maps to the canonical ${confidenceInterval.toLowerCase()} interval wording across meeting detail, queue, operator panel, and runbook.`,
    260,
  );
  const intervalWordingConsistencyAuditSummary = trimText(
    stepReview
      ? `${stepReview.label} now sits inside the cross-surface interval wording consistency audit. ${input.pilotReview?.intervalWordingCrossSurfaceConsistencyAudit.summary ?? ""}`
      : input.pilotReview?.intervalWordingCrossSurfaceConsistencyAudit.summary ??
        `This session still maps to the canonical ${confidenceInterval.toLowerCase()} interval wording across continuity-facing surfaces with no additional consistency drift visible.`,
    260,
  );
  const intervalWordingRegressionAuditSummary = trimText(
    stepReview
      ? `${stepReview.label} now sits inside the cross-surface interval wording regression audit. ${input.pilotReview?.intervalWordingCrossSurfaceRegressionAudit.summary ?? ""}`
      : input.pilotReview?.intervalWordingCrossSurfaceRegressionAudit.summary ??
        `This session still maps to the canonical ${confidenceInterval.toLowerCase()} interval wording across continuity-facing readouts with no additional regression audit signal visible.`,
    260,
  );
  const intervalWordingCrossReadoutAuditSummary = trimText(
    stepReview
      ? `${stepReview.label} now sits inside the cross-readout interval wording regression audit. ${input.pilotReview?.intervalWordingCrossReadoutRegressionAudit.summary ?? ""}`
      : input.pilotReview?.intervalWordingCrossReadoutRegressionAudit.summary ??
        `This session still maps to the canonical ${confidenceInterval.toLowerCase()} interval wording across threshold, step, and guidance readouts with no additional cross-readout regression signal visible.`,
    260,
  );
  const intervalWordingCrossReadoutRegressionRefinementSummary = trimText(
    stepReview
      ? `${stepReview.label} now sits inside the cross-readout interval wording regression refinement. ${input.pilotReview?.intervalWordingCrossReadoutRegressionRefinement.summary ?? ""}`
      : input.pilotReview?.intervalWordingCrossReadoutRegressionRefinement.summary ??
        `This session still maps to the canonical ${confidenceInterval.toLowerCase()} interval wording across threshold, step, guidance, session summary, queue summary, and operator card readouts with no additional refinement signal visible.`,
    260,
  );
  const outcomeCorrelationBand = stepReview?.correlationBand ?? "WATCH";
  const longTermOutcomeSummary =
    stepReview?.correlationSummary ??
    input.pilotReview?.longTermOutcomeCorrelation.summary ??
    "Long-term outcome correlation is still advisory for this session; keep local evidence visible before repeating the same remediation.";
  const longTermSopImpactSummary =
    stepReview?.longTermImpactSummary ??
    input.pilotReview?.longTermSopImpact.summary ??
    "Long-term SOP impact is still advisory for this session; keep operator evidence and subgroup stability visible before reusing the same step.";
  const longTermMaterialImpactBand =
    stepReview?.materialImpactBand ??
    (outcomeCorrelationBand === "AT_RISK"
      ? "HIGH"
      : sampleCoverageBand === "NARROW"
        ? "LOW"
        : "WATCH");
  const longTermMaterialImpactSummary =
    stepReview?.materialImpactSummary ??
    input.pilotReview?.longTermOutcomeReview.summary ??
    "Long-term outcome material impact is still advisory for this session; keep local evidence and subgroup stability visible before reusing the same step.";
  const longTermMaterialImpactReviewSummary = trimText(
    stepReview
      ? `${stepReview.label}: ${stepReview.materialImpactSummary} ${input.pilotReview?.longTermMaterialImpactReview.summary ?? ""}`
      : input.pilotReview?.longTermMaterialImpactReview.summary ??
        "No broader long-term material impact review is visible yet beyond the current session-local outcome readout.",
    260,
  );
  const longTermMaterialImpactAuditSummary = trimText(
    stepReview
      ? `${stepReview.label}: ${stepReview.longTermImpactSummary} ${input.pilotReview?.longTermMaterialImpactAudit.summary ?? ""}`
      : input.pilotReview?.longTermMaterialImpactAudit.summary ??
        "No broader long-term material impact audit is visible yet beyond the current session-local outcome readout.",
    260,
  );
  const materialImpactPatternAgingSummary = trimText(
    stepReview
      ? `${stepReview.label}: ${stepReview.longTermImpactSummary} ${input.pilotReview?.materialImpactPatternAgingReview.summary ?? ""}`
      : input.pilotReview?.materialImpactPatternAgingReview.summary ??
        "No material impact aging review is visible yet beyond the current session-local outcome readout.",
    260,
  );
  const materialImpactSamplingSummary = trimText(
    stepReview
      ? `${stepReview.label}: ${stepReview.materialImpactSummary} ${input.pilotReview?.materialImpactSamplingReview.summary ?? ""}`
      : input.pilotReview?.materialImpactSamplingReview.summary ??
        "No material impact sampling review is visible yet beyond the current session-local outcome readout.",
    260,
  );
  const materialImpactSamplingAgingSummary = trimText(
    stepReview
      ? `${stepReview.label}: ${stepReview.longTermImpactSummary} ${input.pilotReview?.materialImpactSamplingAgingReview.summary ?? ""}`
      : input.pilotReview?.materialImpactSamplingAgingReview.summary ??
        "No material impact sampling aging review is visible yet beyond the current session-local outcome readout.",
    260,
  );
  const materialImpactAgingRefinementSummary = trimText(
    stepReview
      ? `${stepReview.label}: ${stepReview.longTermImpactSummary} ${input.pilotReview?.materialImpactSamplingAgingRefinement.summary ?? ""}`
      : input.pilotReview?.materialImpactSamplingAgingRefinement.summary ??
        "No material impact aging refinement review is visible yet beyond the current session-local outcome readout.",
    260,
  );
  const materialImpactSamplingAgingAuditSummary = trimText(
    stepReview
      ? `${stepReview.label}: ${stepReview.longTermImpactSummary} ${input.pilotReview?.materialImpactSamplingAgingAudit.summary ?? ""}`
      : input.pilotReview?.materialImpactSamplingAgingAudit.summary ??
        "No material impact sampling aging audit is visible yet beyond the current session-local outcome readout.",
    260,
  );
  const materialImpactSamplingAgingRefinementAuditSummary = trimText(
    stepReview
      ? `${stepReview.label}: ${stepReview.longTermImpactSummary} ${input.pilotReview?.materialImpactSamplingAgingRefinementAudit.summary ?? ""}`
      : input.pilotReview?.materialImpactSamplingAgingRefinementAudit.summary ??
        "No material impact sampling aging refinement audit is visible yet beyond the current session-local outcome readout.",
    260,
  );
  const guidanceRefinementSummary =
    stepReview?.improvementHint ??
    input.pilotReview?.guidanceRefinement.summary ??
    "No sharper SOP refinement is available yet beyond the current review-first runbook.";

  return {
    pilotBasis: input.pilotReview?.pilotBasis ?? CONTINUITY_PILOT_EFFECTIVENESS_REVIEW_PROFILE.pilotBasis,
    failureTaxonomy: input.recovery.failureTaxonomy,
    confidenceBand,
    riskBand,
    recommendedIneffectiveThreshold,
    topTierFailureClass,
    workspaceSizeBand,
    meetingShape,
    sessionDensityBand,
    meetingFrequencyBand,
    failureHistoryBand,
    participantRolePosture,
    classSummary:
      classReview?.summary ??
      (input.recovery.failureTaxonomy === "NONE"
        ? "This continuity workflow is not currently attached to a named failure class in pilot review."
        : `${input.recovery.failureTaxonomy} is not yet a top-tier reviewed failure class, so current operator judgement should lean on the session-local evidence surface.`),
    driftSummary:
      classReview?.driftSummary ??
      (input.analytics.repeatPattern.status !== "NONE" || input.effectiveness.latestOutcome === "INEFFECTIVE"
        ? "This session still shows local drift signals and should stay operator-owned."
        : "No stronger drift signal is present than the session-local evidence currently shows."),
    longHorizonSummary:
      cohortFamilyReview?.longHorizonSummary ??
      (remediationPostureReview
        ? remediationPostureReview.varianceSummary
        : input.recovery.failureTaxonomy === "NONE"
          ? "No stronger long-horizon cohort signal is available yet, so this session still relies on local continuity evidence."
          : `${input.recovery.failureTaxonomy} still needs more long-horizon pilot evidence before the drift posture is fully calibrated.`),
    adjustmentSummary:
      classReview?.adjustmentSummary ??
      (input.recovery.failureTaxonomy === "NONE"
        ? "No failure-class adjustment is currently needed beyond the session-local calibration."
        : `Keep ${input.recovery.failureTaxonomy} under ${confidenceBand.toLowerCase()}-band handling until more pilot evidence is available.`),
    cohortSummary:
      cohortFamilyReview?.summary ??
      meetingShapeReview?.summary ??
      `${meetingShape} currently sits inside a ${workspaceSizeBand.toLowerCase()} pilot workspace; keep this session inside continuity-first operator handling until a larger cohort says otherwise.`,
    thresholdRevisionSummary:
      thresholdRevision?.summary ??
      cohortFamilyReview?.recalibrationSummary ??
      meetingShapeReview?.thresholdSummary ??
      `Current cohort keeps threshold ${recommendedIneffectiveThreshold} for ${meetingShape} inside a ${workspaceSizeBand.toLowerCase()} pilot workspace.`,
    operatorHandlingSummary:
      input.pilotReview?.operatorHandlingEffectiveness.summary
        ? `${localGuidance.summary} ${input.pilotReview.operatorHandlingEffectiveness.summary}`
        : localGuidance.summary,
    varianceSummary:
      remediationPostureReview?.varianceSummary ??
      input.pilotReview?.operatorHandlingEffectiveness.outcomeVarianceSummary ??
      "Current SOP variance still needs more pilot evidence before it can be interpreted confidently.",
    subgroupSummary: trimText(
      [
        `session density ${sessionDensityBand}`,
        sessionDensityReview?.summary,
        `meeting cadence ${meetingFrequencyBand}`,
        meetingFrequencyReview?.summary,
        `failure history ${failureHistoryBand}`,
        failureHistoryReview?.summary,
        `participant posture ${participantRolePosture}`,
        participantRoleReview?.summary,
      ]
        .filter(Boolean)
        .join(" "),
      260,
    ),
    refinedCalibrationSummary:
      input.pilotReview?.subgroupCalibration.summary ??
      thresholdRevision?.confidenceSummary ??
      sessionDensityReview?.calibrationSummary ??
      meetingFrequencyReview?.calibrationSummary ??
      participantRoleReview?.calibrationSummary ??
      "No subgroup-specific calibration synthesis is available yet; stay on the current bounded threshold.",
    driftSynthesisSummary:
      input.pilotReview?.driftSynthesis.summary ??
      sessionDensityReview?.driftSummary ??
      meetingFrequencyReview?.driftSummary ??
      participantRoleReview?.driftSummary ??
      "No subgroup-specific drift synthesis is available yet; rely on the current session-local drift posture.",
    sopEffectivenessSummary:
      input.pilotReview?.sopEffectivenessSynthesis.summary ??
      failureHistoryReview?.varianceSummary ??
      input.pilotReview?.operatorHandlingEffectiveness.outcomeVarianceSummary ??
      "No subgroup-specific SOP effectiveness synthesis is available yet; keep operator handling evidence-first.",
    sampleCoverageBand,
    sampleCoverageSummary,
    stabilityBand,
    stabilityConfidenceBand,
    stabilitySummary,
    stabilityVarianceSummary,
    stabilityScaleUpSummary,
    stabilityScaleUpRecheckSummary,
    subgroupStabilityDriftSummary,
    subgroupCohortAgingSummary,
    subgroupDriftAgingScaleUpSummary,
    subgroupDriftLongTermCohortAgingSummary,
    subgroupDriftLongTermSampleExpansionSummary,
    subgroupDriftLongTermSampleExpansionRefinementSummary,
    confidenceInterval,
    confidenceAdjustmentRationale,
    intervalWordingSummary,
    intervalWordingDriftSummary,
    wordingDriftTrackingSummary,
    intervalConsistencyGuidanceSummary,
    intervalWordingAgingSummary,
    intervalWordingRegressionSummary,
    intervalWordingConsistencyAuditSummary,
    intervalWordingRegressionAuditSummary,
    intervalWordingCrossReadoutAuditSummary,
    intervalWordingCrossReadoutRegressionRefinementSummary,
    outcomeCorrelationBand,
    longTermOutcomeSummary,
    longTermSopImpactSummary,
    longTermMaterialImpactBand,
    longTermMaterialImpactSummary,
    longTermMaterialImpactReviewSummary,
    longTermMaterialImpactAuditSummary,
    materialImpactPatternAgingSummary,
    materialImpactSamplingSummary,
    materialImpactSamplingAgingSummary,
    materialImpactAgingRefinementSummary,
    materialImpactSamplingAgingAuditSummary,
    materialImpactSamplingAgingRefinementAuditSummary,
    guidanceRefinementSummary,
  };
}

export function buildRuntimeContinuitySop(input: {
  recovery: RuntimeRecoveryState;
  analytics: RuntimeRemediationAnalytics;
  effectiveness: RuntimeRemediationEffectiveness;
  evidence: RuntimeContinuityEvidenceSurface;
  pilotReview: RuntimeContinuityPilotSessionReview;
}): RuntimeContinuitySop {
  const template = buildRuntimeContinuityFailureClassSopTemplate(input.recovery.failureTaxonomy);
  return {
    title: template.title,
    summary: trimText(
      `${template.summary} ${input.pilotReview.adjustmentSummary} ${input.pilotReview.varianceSummary} ${input.effectiveness.escalationNeeded ? input.effectiveness.escalationSummary : input.evidence.summary}`,
      260,
    ),
    evidenceChecklist: template.evidenceChecklist.slice(0, 4),
    escalationRule:
      input.effectiveness.latestOutcome === "INEFFECTIVE" || input.analytics.repeatPattern.status !== "NONE"
        ? `${template.escalationRule} Current pilot review also shows repeated or ineffective remediation pressure.`
        : template.escalationRule,
    commonPitfalls: template.commonPitfalls.slice(0, 3),
    boundaryNote:
      "Operator workflow only. SOP guidance does not expand send authority, execution authority, or broad write authority.",
  };
}

function buildWorkspaceRuntimeContinuityQueueItem(
  session: NonNullable<WorkspaceRuntimeOperatorOverviewInput["runtimeSessions"]>[number],
  pilotReview?: WorkspaceContinuityPilotReview | null,
  executionTrace?: {
    capabilities: WorkspaceRuntimeOperatorOverviewInput["capabilities"];
    connectors: WorkspaceRuntimeOperatorOverviewInput["connectors"];
    humanExecutions: WorkspaceRuntimeOperatorOverviewInput["humanExecutions"];
    officialWriteIntents: WorkspaceRuntimeOperatorOverviewInput["officialWriteIntents"];
    limitedAutoIntents: WorkspaceRuntimeOperatorOverviewInput["limitedAutoIntents"];
    officialFollowThrough: WorkspaceRuntimeOperatorOverviewInput["officialFollowThrough"];
    benchmarkMatrixRuns: WorkspaceRuntimeOperatorOverviewInput["benchmarkMatrixRuns"];
    benchmarkExecutionRequests: WorkspaceRuntimeOperatorOverviewInput["benchmarkExecutionRequests"];
    benchmarkExecutionAcknowledgements:
      WorkspaceRuntimeOperatorOverviewInput["benchmarkExecutionAcknowledgements"];
    benchmarkExecutionFollowThrough:
      WorkspaceRuntimeOperatorOverviewInput["benchmarkExecutionFollowThrough"];
  },
  swarmReadOnlyWorkersEnabled = false,
): WorkspaceContinuityQueueItem {
  const latestCheckpoint = selectRuntimeContinuityCheckpoint(session.checkpoints, session.resumedFromKey);
  const remediationTrace = parseRuntimeRemediationTrace(session.remediationEvents ?? []);
  const controlEvents = session.requestEvents ?? [];
  const swarmSpawnRequestEvent = parseRuntimeSwarmSpawnRequestedEvent(controlEvents);
  const swarmReadOnlyWorkerIntentEvent =
    parseRuntimeSwarmReadOnlyWorkerIntentRecordedEvent(controlEvents);
  const swarmReadOnlyWorkerPlaceholderEvent =
    parseRuntimeSwarmReadOnlyWorkerPlaceholderRecordedEvent(controlEvents);
  const swarmReadOnlyWorkerExecutionEvent =
    parseRuntimeSwarmReadOnlyWorkerExecutionRecordedEvent(controlEvents);
  const swarmReadOnlyWorkerMaterializationEvent =
    parseRuntimeSwarmReadOnlyWorkerMaterializationRecordedEvent(controlEvents);
  const swarmReadOnlyWorkerAdoptionEvent =
    parseRuntimeSwarmReadOnlyWorkerAdoptionRecordedEvent(controlEvents);
  const swarmVerificationMergeLaneEvent =
    parseRuntimeSwarmVerificationMergeLaneRecordedEvent(controlEvents);
  const takeoverRequestEvent = parseRuntimeTakeoverRequestEvent(controlEvents);
  const takeoverAcknowledgementEvent = parseRuntimeTakeoverAcknowledgementEvent(controlEvents);
  const takeoverStartedEvent = parseRuntimeTakeoverStartedEvent(controlEvents);
  const takeoverReleasedEvent = parseRuntimeTakeoverReleasedEvent(controlEvents);
  const takeoverFollowThroughRequestEvent =
    parseRuntimeTakeoverFollowThroughRequestedEvent(controlEvents);
  const takeoverFollowThroughResolvedEvent =
    parseRuntimeTakeoverFollowThroughResolvedEvent(controlEvents);
  const settlementReviewRequestedEvent =
    parseRuntimeSettlementReviewRequestedEvent(controlEvents);
  const settlementReviewResolvedEvent =
    parseRuntimeSettlementReviewResolvedEvent(controlEvents);
  const closeoutConfirmedEvent = parseRuntimeCloseoutConfirmedEvent(controlEvents);
  const closeoutRefreshRequestedEvent =
    parseRuntimeCloseoutRefreshRequestedEvent(controlEvents);
  const closeoutResolutionRecordedEvent =
    parseRuntimeCloseoutResolutionRecordedEvent(controlEvents);
  const closeoutResolutionFollowThroughRequestedEvent =
    parseRuntimeCloseoutResolutionFollowThroughRequestedEvent(controlEvents);
  const closeoutResolutionFollowThroughResolvedEvent =
    parseRuntimeCloseoutResolutionFollowThroughResolvedEvent(controlEvents);
  const closeRequestRequestedEvent = parseRuntimeCloseRequestedEvent(controlEvents);
  const humanInputRequestEvent = parseRuntimeHumanInputCheckpointRequestEvent(controlEvents);
  const humanInputAcknowledgementEvent =
    parseRuntimeHumanInputCheckpointAcknowledgementEvent(controlEvents);
  const runThreadHandoffPackets = session.handoffPackets.map((item) =>
    mapRunThreadLifecycleHandoffPacket(item),
  );
  const budgetPosture = buildBudgetPosture({
    budgetTokenLimit: session.budgetTokenLimit,
    budgetTokenUsed: session.budgetTokenUsed,
    prunedTokenCount: session.prunedTokenCount,
    latestCheckpointStatus: latestCheckpoint?.status,
    resumedFromKey: session.resumedFromKey,
  });
  const runThread = buildRunThreadContract({
    id: session.id,
    workspaceId: session.workspaceId,
    sessionKey: session.sessionKey,
    status: session.status,
    currentStage: session.currentStage,
    sourcePage: session.sourcePage,
    boundaryNote: session.boundaryNote,
    meetingId: session.meetingId,
    opportunityId: session.opportunityId,
    companyId: session.companyId,
    swarmReadOnlyWorkersEnabled,
    swarmBudgetEnvelope: {
      budgetTokenLimit: session.budgetTokenLimit,
      budgetTokenUsed: session.budgetTokenUsed,
      usagePercent: budgetPosture.usagePercent,
      prunedTokenCount: session.prunedTokenCount,
      posture: budgetPosture.state,
    },
    replayableEventLog: session.replayableEventLog,
    resumedFromKey: session.resumedFromKey,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    closedAt: session.closedAt,
    checkpoints: session.checkpoints.map((item) => ({
      id: item.id,
      checkpointKey: item.checkpointKey,
      label: item.label,
      status: item.status,
      summary: item.summary,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    })),
    persistedControlPlaneLifecycle: readPersistedRunThreadControlPlaneLifecycle(session),
    handoffPackets: runThreadHandoffPackets,
    remediationTrace: remediationTrace.map((item) => mapRunThreadLifecycleRemediationEntry(item)),
    swarmSpawnRequestEvent,
    swarmReadOnlyWorkerIntentEvent,
    swarmReadOnlyWorkerPlaceholderEvent,
    swarmReadOnlyWorkerExecutionEvent,
    swarmReadOnlyWorkerMaterializationEvent,
    swarmReadOnlyWorkerAdoptionEvent,
    swarmVerificationMergeLaneEvent,
    verification: session.verificationReports[0]
      ? {
          status:
            normalizeRunThreadVerificationStatus(session.verificationReports[0].status) ??
            "needs_review",
          blockedReasons: safeParseJson<string[]>(
            session.verificationReports[0].blockedReasons,
            [],
          ),
          summary: session.verificationReports[0].summary,
        }
      : null,
    truthConflicts: (session.truthConflicts ?? []).map((item) => ({
      status: normalizeRunThreadTruthConflictState(item.status) ?? "open",
      summary: item.summary,
    })),
    requestLifecycleEntries: buildRunThreadRequestLifecycleInputs({
      takeoverRequestEvent,
      takeoverAcknowledgementEvent,
      takeoverStartedEvent,
      takeoverReleasedEvent,
      takeoverFollowThroughRequestEvent,
      takeoverFollowThroughResolvedEvent,
      humanInputRequestEvent,
      humanInputAcknowledgementEvent,
    }),
    settlementReviewEntries: buildRunThreadSettlementLifecycleInputs({
      settlementReviewRequestedEvent,
      settlementReviewResolvedEvent,
    }),
    closeoutConfirmationEntries: buildRunThreadCloseoutConfirmationLifecycleInputs({
      closeoutConfirmedEvent,
    }),
    closeoutRefreshEntries: buildRunThreadCloseoutRefreshLifecycleInputs({
      closeoutRefreshRequestedEvent,
    }),
    closeoutResolutionEntries: buildRunThreadCloseoutResolutionLifecycleInputs({
      closeoutResolutionRecordedEvent,
    }),
    closeoutResolutionFollowThroughEntries:
      buildRunThreadCloseoutResolutionFollowThroughLifecycleInputs({
        closeoutResolutionFollowThroughRequestedEvent,
        closeoutResolutionFollowThroughResolvedEvent,
      }),
    closeRequestEntries: buildRunThreadCloseRequestLifecycleInputs({
      closeRequestRequestedEvent,
    }),
    resultAcknowledgements: executionTrace
      ? buildRunThreadResultAcknowledgementInputs({
          context: {
            meetingId: session.meetingId,
            opportunityId: session.opportunityId,
            companyId: session.companyId,
          },
          humanExecutions: executionTrace.humanExecutions,
          officialWriteIntents: executionTrace.officialWriteIntents,
          limitedAutoIntents: executionTrace.limitedAutoIntents,
          officialFollowThrough: executionTrace.officialFollowThrough,
        })
      : [],
  });
  const notebookState = buildRuntimeNotebookState({
    sessionLabel: session.label,
    sessionStatus: session.status,
    boundaryNote: RUNTIME_BOUNDARY_NOTE,
    notebook: session.notebook,
    verification: session.verificationReports[0]
      ? {
          status: session.verificationReports[0].status.toLowerCase(),
          blockedReasons: safeParseJson<string[]>(session.verificationReports[0].blockedReasons, []),
        }
      : null,
    problemSpaces: session.problemSpaces.map((item) => ({
      title: item.title,
      nextStep: item.nextStep,
      status: item.status,
      ownerHint: item.ownerHint,
      evidenceRefs: parseRuntimeStringList(item.evidenceRefs),
    })),
    promotedFacts: buildPromotedRuntimeFacts(session.memoryCandidates, session.memoryPromotions),
    truthConflicts: [],
  });
  const payloadState = buildRuntimePayloadHandleState({
    persistedHandles: session.persistedPayloadHandles,
    latestCheckpoint: latestCheckpoint
      ? {
          snapshotJson: latestCheckpoint.snapshotJson,
          updatedAt: latestCheckpoint.updatedAt,
        }
      : null,
    edits: session.contextEditEvents,
  });
  const replay = latestCheckpoint
    ? buildResumeFidelity({
        checkpointId: latestCheckpoint.id,
        checkpointLabel: latestCheckpoint.label,
        checkpointStatus: latestCheckpoint.status,
        updatedAt: latestCheckpoint.updatedAt,
        savedState: parseContinuitySnapshot(latestCheckpoint.snapshotJson),
        liveState: notebookState,
        livePayloadState: {
          activeHandles: payloadState.activeHandles,
          prunedHandles: payloadState.prunedHandles,
          budgetState: budgetPosture.state,
          stateSource: payloadState.stateSource,
        },
      })
    : null;
  const replayStatus: WorkspaceContinuityQueueItem["replayStatus"] =
    replay?.fidelityStatus === "STRONG"
      ? "STRONG"
      : replay?.fidelityStatus === "WATCH"
        ? "WATCH"
        : replay?.fidelityStatus === "WEAK"
          ? "WEAK"
          : "NONE";
  const pruneTrace = buildPruneTraceEntries({
    edits: session.contextEditEvents,
    payloads: [],
    notebookState,
    budgetPosture,
  });
  const continuityRisk = buildRuntimeContinuityRisk({
    budgetPosture: budgetPosture.state,
    replayStatus: replay?.fidelityStatus ?? null,
    payloadStateSource: payloadState.stateSource,
    hasPruneTrace: pruneTrace.length > 0,
  });
  const recovery = buildRuntimeContinuityRecovery({
    budgetPosture,
    replay,
    payloadState,
    latestCheckpoint: latestCheckpoint
      ? {
          id: latestCheckpoint.id,
          label: latestCheckpoint.label,
          status: latestCheckpoint.status,
        }
      : null,
    persistedPayloadCount: session.persistedPayloadHandles.length,
    pruneTraceCount: pruneTrace.length,
  });
  const operatorArtifacts = buildRuntimeContinuityOperatorArtifacts({
    replay,
    recovery,
    risk: continuityRisk,
    payloadState,
    notebookState,
    pruneTrace,
    remediationTrace,
  });
  const debuggerReadModel = buildOperatorDebuggerReadModel({
    sessionLabel: session.label,
    runThread,
    replayableEventLog: session.replayableEventLog,
    replay,
    recovery: operatorArtifacts.recovery,
    notebookState,
    payloadState,
    verification: session.verificationReports[0]
      ? {
          status: session.verificationReports[0].status,
          blockedReasons: safeParseJson<string[]>(session.verificationReports[0].blockedReasons, []),
        }
      : null,
    contextEditEvents: [],
    remediationTrace: remediationTrace.map((item) => ({
      id: item.id,
      action: item.action,
      executionStatus: item.executionStatus,
      summary: item.summary,
      rollbackAnchorSummary: item.rollbackAnchorSummary,
      triggeredBy: item.triggeredBy,
      createdAt: item.createdAt,
    })),
    handoffPackets: session.handoffPackets.map((item) => mapRuntimeHandoffPacketState(item)),
    takeoverRequestEvent,
    takeoverAcknowledgementEvent,
    takeoverStartEvent: takeoverStartedEvent,
    takeoverReleaseEvent: takeoverReleasedEvent,
    takeoverFollowThroughRequestEvent,
    takeoverFollowThroughResolvedEvent,
    humanInputRequestEvent,
    humanInputAcknowledgementEvent,
  });
  const projectSkillLibrary = buildProjectSkillLibraryReadModel({
    capabilitySignals: (executionTrace?.capabilities ?? []).map((item) => ({
      id: item.id,
      name: item.name,
      stage: item.stage,
      description: item.description,
      loadPolicy: item.loadPolicy,
      reviewRequired: item.reviewRequired,
      boundaryNote: item.boundaryNote,
    })),
  });
  const environmentContract = buildEnvironmentContractReadModel({
    projectSkillLibrary,
    connectors: (executionTrace?.connectors ?? []).map((item) => ({
      id: item.id,
      provider: String(item.provider),
      status: String(item.status),
      lastSyncedAt: item.lastSyncedAt ?? null,
      lastSyncStatus: item.lastSyncStatus ?? null,
      lastSyncMessage: item.lastSyncMessage ?? null,
    })),
    officialActionCoverage: getRicherOfficialActionCoverageCatalog().map((item) => ({
      actionType: item.actionType,
      defaultPath: item.defaultPath,
      limitedAutoStatus: item.limitedAutoStatus,
      executableLimitedAuto: item.executableLimitedAuto,
      boundaryReason: item.boundaryReason,
    })),
    officialWriteIntents: (executionTrace?.officialWriteIntents ?? []).map((item) => ({
      ...item,
      actionType: String(item.writeActionType),
      acknowledgementStatus: String(item.writeAcknowledgementStatus).toUpperCase(),
    })),
    limitedAutoIntents: (executionTrace?.limitedAutoIntents ?? []).map((item) => ({
      ...item,
      actionType: String(item.limitedAutoActionType),
      acknowledgementStatus: String(item.limitedAutoAckStatus).toUpperCase(),
    })),
    officialFollowThrough: (executionTrace?.officialFollowThrough ?? []).map((item) => ({
      ...item,
      followThroughStatus: String(item.followThroughStatus).toUpperCase(),
      followThroughResolutionStatus: String(item.followThroughResolutionStatus).toUpperCase(),
    })),
    humanExecutionCount: executionTrace?.humanExecutions.length ?? 0,
    officialFollowThroughCount: executionTrace?.officialFollowThrough.length ?? 0,
  });
  const benchmarkMatrix = buildBenchmarkMatrixReadModel({
    recordedRuns: executionTrace?.benchmarkMatrixRuns ?? [],
    executionRequests: executionTrace?.benchmarkExecutionRequests ?? [],
    executionAcknowledgements: executionTrace?.benchmarkExecutionAcknowledgements ?? [],
    executionFollowThrough: executionTrace?.benchmarkExecutionFollowThrough ?? [],
  });
  const operatorControlSummary = buildRuntimeOperatorControlSummary({
    environmentContract,
    benchmarkMatrix,
  });
  const operatorProgressSummary = buildRuntimeOperatorProgressSummary({
    requestPosture: runThread.requestPosture,
    takeoverActivation: debuggerReadModel.takeoverActivation,
    operatorControlSummary,
    closePostureForwardSummary: runThread.closePostureForwardSummary,
  });
  const operatorActionSummary = buildRuntimeOperatorActionSummary({
    operatorProgressSummary,
    requestPosture: runThread.requestPosture,
    takeoverActivation: debuggerReadModel.takeoverActivation,
    closePostureForwardSummary: runThread.closePostureForwardSummary,
  });
  operatorActionSummary.focusTitle = session.label;
  operatorActionSummary.focusHref = buildRuntimeSessionHref(session.meetingId);
  const meetingShape = getRuntimeContinuityMeetingShape({
    posture: budgetPosture.state,
    replayStatus,
    payloadStateSource: payloadState.stateSource,
  });
  const sessionDensityBand = getRuntimeContinuitySessionDensityBand({
    posture: budgetPosture.state,
    budgetTokenLimit: session.budgetTokenLimit,
    budgetTokenUsed: session.budgetTokenUsed,
    prunedTokenCount: session.prunedTokenCount,
  });
  const guidance = getRuntimeContinuityGuidanceStatus({
    failureTaxonomy: operatorArtifacts.recovery.failureTaxonomy,
    recoveryState: operatorArtifacts.recovery.state,
    latestEffectiveness: operatorArtifacts.effectiveness.latestOutcome,
    repeatPatternStatus: operatorArtifacts.analytics.repeatPattern.status,
  });
  const failureHistoryBand = getRuntimeContinuityFailureHistoryBand({
    remediationAttempts: operatorArtifacts.analytics.totalAttempts,
    repeatPatternStatus: operatorArtifacts.analytics.repeatPattern.status,
  });
  const sessionPilotReview = buildRuntimeContinuityPilotSessionReview({
    recovery: operatorArtifacts.recovery,
    calibration: operatorArtifacts.calibration,
    analytics: operatorArtifacts.analytics,
    effectiveness: operatorArtifacts.effectiveness,
    pilotReview,
    cohortContext: {
      workspaceSizeBand: pilotReview?.workspaceCohort.sizeBand ?? "SMALL",
      meetingShape,
      sessionDensityBand,
      meetingFrequencyBand: session.meetingFrequencyBand ?? "SPORADIC",
      failureHistoryBand,
      participantRolePosture: session.participantRolePosture ?? "UNKNOWN",
    },
  });
  const sop = buildRuntimeContinuitySop({
    recovery: operatorArtifacts.recovery,
    analytics: operatorArtifacts.analytics,
    effectiveness: operatorArtifacts.effectiveness,
    evidence: operatorArtifacts.evidence,
    pilotReview: sessionPilotReview,
  });

  return {
    id: session.id,
    meetingId: session.meetingId,
    title: session.label,
    summary: trimText(
      `${budgetPosture.summary} Objective: ${notebookState.objective} Review state: ${notebookState.reviewState}.`,
      220,
    ),
    runThread,
    interruptReasonState: debuggerReadModel.interruptReason.state,
    interruptReasonCode: debuggerReadModel.interruptReason.code,
    resumeAskMode: debuggerReadModel.resumeAsk.mode,
    handoffPayloadState: debuggerReadModel.handoffPayload.state,
    handoffTargetAgent: debuggerReadModel.handoffPayload.toAgent,
    debuggerReplayFidelity: debuggerReadModel.replayAssistance.fidelity,
    debuggerTraceContractState: debuggerReadModel.traceContract.state,
    debuggerTraceContractDriver: debuggerReadModel.traceContract.driver,
    debuggerTraceContractAnchor: debuggerReadModel.traceContract.anchor,
    debuggerTraceContractCheckpointKey: debuggerReadModel.traceContract.checkpointKey,
    debuggerTraceContractSummary: debuggerReadModel.traceContract.summary,
    debuggerWriteContractState: debuggerReadModel.writeContract.state,
    debuggerWriteContractDriver: debuggerReadModel.writeContract.driver,
    debuggerWriteContractAnchor: debuggerReadModel.writeContract.writeAnchor,
    debuggerWriteContractCheckpointKey: debuggerReadModel.writeContract.checkpointKey,
    debuggerWriteContractSummary: debuggerReadModel.writeContract.summary,
    debuggerSwarmSpawnContractState: debuggerReadModel.swarmSpawnContract.state,
    debuggerSwarmSpawnContractDriver: debuggerReadModel.swarmSpawnContract.driver,
    debuggerSwarmSpawnContractDenyReason: debuggerReadModel.swarmSpawnContract.denyReason,
    debuggerSwarmSpawnContractSummary: debuggerReadModel.swarmSpawnContract.summary,
    debuggerRecoveryActionContractState: debuggerReadModel.recoveryActionContract.state,
    debuggerRecoveryActionContractDriver: debuggerReadModel.recoveryActionContract.driver,
    debuggerRecoveryActionContractAction: debuggerReadModel.recoveryActionContract.action,
    debuggerRecoveryActionContractCheckpointKey:
      debuggerReadModel.recoveryActionContract.checkpointKey,
    debuggerRecoveryActionContractSummary: debuggerReadModel.recoveryActionContract.summary,
    debuggerRecoveryLifecycleContractState: debuggerReadModel.recoveryLifecycleContract.state,
    debuggerRecoveryLifecycleContractDriver: debuggerReadModel.recoveryLifecycleContract.driver,
    debuggerRecoveryLifecycleContractAnchor: debuggerReadModel.recoveryLifecycleContract.anchor,
    debuggerRecoveryLifecycleContractTransition:
      debuggerReadModel.recoveryLifecycleContract.nextTransition,
    debuggerRecoveryLifecycleContractSummary: debuggerReadModel.recoveryLifecycleContract.summary,
    debuggerRecoveryTransitionContractState: debuggerReadModel.recoveryTransitionContract.state,
    debuggerRecoveryTransitionContractDriver: debuggerReadModel.recoveryTransitionContract.driver,
    debuggerRecoveryTransitionContractAnchor: debuggerReadModel.recoveryTransitionContract.anchor,
    debuggerRecoveryTransitionContractTransition:
      debuggerReadModel.recoveryTransitionContract.transition,
    debuggerRecoveryTransitionContractSummary: debuggerReadModel.recoveryTransitionContract.summary,
    debuggerRecoveryStateMachinePhase: debuggerReadModel.recoveryStateMachineContract.phase,
    debuggerRecoveryStateMachineTransitionState:
      debuggerReadModel.recoveryStateMachineContract.transitionState,
    debuggerRecoveryStateMachineCurrentTransition:
      debuggerReadModel.recoveryStateMachineContract.currentTransition,
    debuggerRecoveryStateMachineSummary: debuggerReadModel.recoveryStateMachineContract.summary,
    debuggerRecoveryExecutionContractState: debuggerReadModel.recoveryExecutionContract.state,
    debuggerRecoveryExecutionContractTransition:
      debuggerReadModel.recoveryExecutionContract.currentTransition,
    debuggerRecoveryExecutionContractCanExecute:
      debuggerReadModel.recoveryExecutionContract.canExecute,
    debuggerRecoveryExecutionContractSummary:
      debuggerReadModel.recoveryExecutionContract.summary,
    debuggerPersistedLifecycleTrace: debuggerReadModel.persistedLifecycleTrace,
    debuggerPersistedLifecycleTraceState: debuggerReadModel.persistedLifecycleTrace.state,
    debuggerPersistedLifecycleTraceAnchor: debuggerReadModel.persistedLifecycleTrace.anchor,
    debuggerTakeoverAssistance: debuggerReadModel.takeoverAssistance,
    debuggerTakeoverPosture: debuggerReadModel.takeoverAssistance.posture,
    debuggerTakeoverSummary: debuggerReadModel.takeoverAssistance.summary,
    debuggerTakeoverRequest: debuggerReadModel.takeoverRequest,
    debuggerTakeoverRequestState: debuggerReadModel.takeoverRequest.state,
    debuggerTakeoverActivation: debuggerReadModel.takeoverActivation,
    debuggerTakeoverActivationState: debuggerReadModel.takeoverActivation.state,
    debuggerTakeoverFollowThrough: debuggerReadModel.takeoverFollowThrough,
    debuggerTakeoverFollowThroughState: debuggerReadModel.takeoverFollowThrough.state,
    debuggerTakeoverOwner: debuggerReadModel.takeoverActivation.currentOwner,
    debuggerLatestRemediationTrace: remediationTrace[0]
      ? {
          id: remediationTrace[0].id,
          action: remediationTrace[0].action,
          executionStatus: remediationTrace[0].executionStatus,
          summary: remediationTrace[0].summary,
          rollbackAnchorSummary: remediationTrace[0].rollbackAnchorSummary,
          triggeredBy: remediationTrace[0].triggeredBy ?? null,
          createdAt: remediationTrace[0].createdAt,
        }
      : null,
    debuggerHumanInputState: debuggerReadModel.humanInputCheckpoint.state,
    debuggerHumanInputRequestState: debuggerReadModel.humanInputRequest.state,
    operatorActionSummary,
    operatorProgressSummary,
    posture: budgetPosture.state,
    replayStatus,
    payloadStateSource: payloadState.stateSource,
    riskLevel: continuityRisk.level,
    riskSummary: continuityRisk.summary,
    recoveryState: operatorArtifacts.recovery.state,
    failureTaxonomy: operatorArtifacts.recovery.failureTaxonomy,
    recoverySummary: operatorArtifacts.recovery.summary,
    rollbackAnchorLabel: buildRuntimeRollbackAnchorLabel(operatorArtifacts.recovery.rollbackAnchor),
    checkpointSummary: replay
      ? `${replay.fidelityStatus} · ${replay.fidelityScore}% · ${replay.replaySummary}`
      : latestCheckpoint
        ? `${latestCheckpoint.label} · ${latestCheckpoint.status}`
        : null,
    pruneSummary: pruneTrace[0] ? `${pruneTrace[0].reason} Saved ${pruneTrace[0].tokensSaved} tokens.` : null,
    remediationAttempts: operatorArtifacts.analytics.totalAttempts,
    repeatPatternStatus: operatorArtifacts.analytics.repeatPattern.status,
    repeatPatternSummary: operatorArtifacts.analytics.repeatPattern.summary,
    calibrationConfidence: operatorArtifacts.calibration.confidence,
    calibrationSummary: operatorArtifacts.calibration.summary,
    latestEffectiveness: operatorArtifacts.effectiveness.latestOutcome,
    effectivenessSummary: operatorArtifacts.effectiveness.latestSummary,
    meetingShape,
    sessionDensityBand,
    meetingFrequencyBand: session.meetingFrequencyBand ?? "SPORADIC",
    failureHistoryBand,
    participantRolePosture: session.participantRolePosture ?? "UNKNOWN",
    guidanceStatus: guidance.status,
    guidanceSummary: guidance.summary,
    pilotRiskBand: sessionPilotReview.riskBand,
    pilotConfidenceBand: sessionPilotReview.confidenceBand,
    pilotThreshold: sessionPilotReview.recommendedIneffectiveThreshold,
    pilotSampleCoverageBand: sessionPilotReview.sampleCoverageBand,
    pilotStabilityBand: sessionPilotReview.stabilityBand,
    pilotStabilityConfidenceBand: sessionPilotReview.stabilityConfidenceBand,
    pilotConfidenceInterval: sessionPilotReview.confidenceInterval,
    pilotOutcomeCorrelationBand: sessionPilotReview.outcomeCorrelationBand,
    pilotLongTermMaterialImpactBand: sessionPilotReview.longTermMaterialImpactBand,
    pilotReviewSummary: trimText(
      `${sessionPilotReview.failureTaxonomy} pilot review: scale-up recheck ${sessionPilotReview.stabilityBand}/${sessionPilotReview.stabilityConfidenceBand}; subgroup drift ${pilotReview?.drift.longHorizonDriftRate ?? 0}% long-horizon; cohort aging ${pilotReview?.subgroupCohortAgingReview.findings.length ?? 0} signal(s); aging scale-up ${pilotReview?.subgroupDriftAgingScaleUpReview.findings.length ?? 0} signal(s); long-term aging ${pilotReview?.subgroupDriftLongTermCohortAgingReview.findings.length ?? 0} signal(s); sample expansion ${pilotReview?.subgroupDriftLongTermSampleExpansionReview.findings.length ?? 0} signal(s); sample refinement ${pilotReview?.subgroupDriftLongTermSampleExpansionRefinementReview.findings.length ?? 0} signal(s); wording aging ${sessionPilotReview.confidenceInterval}/${pilotReview?.intervalWordingAgingAudit.regressionRate ?? 0}%; wording regression ${pilotReview?.intervalWordingCrossSurfaceRegressionReview.regressionRate ?? 0}%; wording consistency ${pilotReview?.intervalWordingCrossSurfaceConsistencyAudit.regressionRate ?? 0}%; wording audit ${pilotReview?.intervalWordingCrossSurfaceRegressionAudit.regressionRate ?? 0}%; readout audit ${pilotReview?.intervalWordingCrossReadoutRegressionAudit.regressionRate ?? 0}%; readout refinement ${pilotReview?.intervalWordingCrossReadoutRegressionRefinement.regressionRate ?? 0}%; long-term SOP ${sessionPilotReview.outcomeCorrelationBand}; impact aging ${sessionPilotReview.longTermMaterialImpactBand}; impact sampling ${pilotReview?.materialImpactSamplingReview.findings.length ?? 0} signal(s); sampling aging ${pilotReview?.materialImpactSamplingAgingReview.findings.length ?? 0} signal(s); impact refinement ${pilotReview?.materialImpactSamplingAgingRefinement.findings.length ?? 0} signal(s); impact audit ${pilotReview?.materialImpactSamplingAgingAudit.findings.length ?? 0} signal(s); impact refinement audit ${pilotReview?.materialImpactSamplingAgingRefinementAudit.findings.length ?? 0} signal(s). ${sessionPilotReview.guidanceRefinementSummary}`,
      560,
    ),
    sopTitle: sop.title,
    evidenceSummary: operatorArtifacts.evidence.summary,
    runbookTitle: operatorArtifacts.runbook.title,
    href: buildRuntimeSessionHref(session.meetingId),
    updatedAt:
      [session.updatedAt, latestCheckpoint?.updatedAt, pruneTrace[0]?.createdAt, operatorArtifacts.analytics.latestAttemptAt]
        .filter((item): item is Date => Boolean(item))
        .sort((left, right) => right.getTime() - left.getTime())[0] ?? session.updatedAt,
  };
}

type RuntimeContinuityInputSessionSeed = Omit<
  NonNullable<WorkspaceRuntimeOperatorOverviewInput["runtimeSessions"]>[number],
  "meetingStartsAt" | "meetingFrequencyBand" | "participantRolePosture"
>;

type RuntimeContinuityMeetingMetadata = {
  startsAt: Date;
  attendeesSummary: string | null;
  contactTitles: string[];
};

async function loadRuntimeContinuityMeetingMetadataMap(meetingIds: string[]) {
  if (!meetingIds.length) {
    return new Map<string, RuntimeContinuityMeetingMetadata>();
  }

  const meetings = await db.meeting.findMany({
    where: {
      id: {
        in: meetingIds,
      },
    },
    select: {
      id: true,
      startsAt: true,
      contacts: {
        select: {
          title: true,
        },
      },
      note: {
        select: {
          attendeesSummary: true,
        },
      },
    },
  });

  return new Map<string, RuntimeContinuityMeetingMetadata>(
    meetings.map((meeting) => [
      meeting.id,
      {
        startsAt: meeting.startsAt,
        attendeesSummary: meeting.note?.attendeesSummary ?? null,
        contactTitles: meeting.contacts.map((contact) => contact.title).filter((item): item is string => Boolean(item)),
      },
    ]),
  );
}

function finalizeRuntimeContinuityInputSessions(
  sessions: RuntimeContinuityInputSessionSeed[],
  meetingMetadataById: Map<string, RuntimeContinuityMeetingMetadata>,
): NonNullable<WorkspaceRuntimeOperatorOverviewInput["runtimeSessions"]> {
  const enriched = sessions.map((session) => {
    const meetingMetadata = session.meetingId ? meetingMetadataById.get(session.meetingId) ?? null : null;
    return {
      ...session,
      meetingStartsAt: meetingMetadata?.startsAt ?? null,
      participantRolePosture: getRuntimeContinuityParticipantRolePosture({
        attendeesSummary: meetingMetadata?.attendeesSummary ?? null,
        contactTitles: meetingMetadata?.contactTitles ?? [],
      }),
    };
  });
  const frequencyBandMap = buildRuntimeContinuityMeetingFrequencyBandMap(
    enriched.map((session) => ({
      id: session.id,
      companyId: session.companyId,
      opportunityId: session.opportunityId,
      updatedAt: session.updatedAt,
      meetingStartsAt: session.meetingStartsAt,
    })),
  );

  return enriched.map((session) => ({
    ...session,
    meetingStartsAt: session.meetingStartsAt,
    meetingFrequencyBand: frequencyBandMap.get(session.id) ?? "SPORADIC",
    participantRolePosture: session.participantRolePosture,
  }));
}

async function getRuntimeContinuityTraceCohortMetadata(input: {
  workspaceId: string;
  sessionId: string;
  meetingId: string | null;
  opportunityId: string | null;
  companyId: string | null;
  updatedAt: Date;
}) {
  const relatedFilter = input.opportunityId
    ? { opportunityId: input.opportunityId }
    : input.companyId
      ? { companyId: input.companyId }
      : { id: input.sessionId };
  const peerSessions = await db.runtimeSession.findMany({
    where: {
      workspaceId: input.workspaceId,
      OR: [{ id: input.sessionId }, relatedFilter],
    },
    select: {
      id: true,
      meetingId: true,
      opportunityId: true,
      companyId: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 24,
  });
  const meetingMetadataById = await loadRuntimeContinuityMeetingMetadataMap(
    peerSessions.map((session) => session.meetingId).filter((item): item is string => Boolean(item)),
  );
  const frequencyBandMap = buildRuntimeContinuityMeetingFrequencyBandMap(
    peerSessions.map((session) => ({
      id: session.id,
      companyId: session.companyId,
      opportunityId: session.opportunityId,
      updatedAt: session.updatedAt,
      meetingStartsAt: session.meetingId ? (meetingMetadataById.get(session.meetingId)?.startsAt ?? null) : null,
    })),
  );
  const currentMeetingMetadata = input.meetingId ? meetingMetadataById.get(input.meetingId) ?? null : null;

  return {
    meetingFrequencyBand: frequencyBandMap.get(input.sessionId) ?? "SPORADIC",
    participantRolePosture: getRuntimeContinuityParticipantRolePosture({
      attendeesSummary: currentMeetingMetadata?.attendeesSummary ?? null,
      contactTitles: currentMeetingMetadata?.contactTitles ?? [],
    }),
  };
}

function buildEvidenceSourceClasses(input: {
  sourceVerification: string;
  sourceStatus: string;
  evidenceRefs: string[];
}) {
  const sourceClasses = new Set<string>();

  if (input.sourceVerification === "human_confirmed_reflection") {
    sourceClasses.add("human_confirmed_reflection");
  } else if (input.sourceVerification === MemoryItemVerification.HUMAN_CONFIRMED) {
    sourceClasses.add("human_confirmed");
  } else if (input.sourceVerification === MemoryItemVerification.INFERRED) {
    sourceClasses.add("inferred");
  } else {
    sourceClasses.add("draft_fact");
  }

  if (input.sourceStatus === "trusted_runtime_compaction") {
    sourceClasses.add("trusted_runtime_compaction");
  } else if (input.sourceStatus === MemoryItemStatus.PROMOTED) {
    sourceClasses.add("promoted_memory");
  } else if (input.sourceStatus === MemoryItemStatus.DRAFT) {
    sourceClasses.add("draft_memory");
  } else if (input.sourceStatus === MemoryItemStatus.DEPRECATED) {
    sourceClasses.add("deprecated_memory");
  }

  for (const ref of input.evidenceRefs) {
    const prefix = ref.split(":")[0]?.trim();
    if (!prefix) continue;
    sourceClasses.add(prefix);
  }

  return Array.from(sourceClasses);
}

export function deriveVerifiedMemoryCandidateDisposition(input: {
  reviewMode: "confirm" | "edit_confirm" | "reject" | "keep_draft";
  sourceStatus: MemoryItemStatus;
  sourceVerification: MemoryItemVerification;
  verificationStatus: HelmV21VerificationDecision["status"];
  hasTruthConflict: boolean;
}) {
  if (input.reviewMode === "reject") return "REJECTED" as const;
  if (input.sourceStatus === MemoryItemStatus.PROMOTED) return "PROMOTED" as const;
  if (input.sourceVerification === MemoryItemVerification.INFERRED) return "DEFERRED" as const;
  if (input.reviewMode === "keep_draft") return "DEFERRED" as const;
  if (input.verificationStatus !== "passed" || input.hasTruthConflict) return "DEFERRED" as const;
  return "REJECTED" as const;
}

function buildVerifiedMemoryCandidateRationale(input: {
  disposition: "PROMOTED" | "REJECTED" | "DEFERRED";
  sourceVerification: MemoryItemVerification;
  verification: HelmV21VerificationDecision;
  hasTruthConflict: boolean;
  reviewMode: "confirm" | "edit_confirm" | "reject" | "keep_draft";
}) {
  if (input.disposition === "PROMOTED") {
    return "Human-confirmed object fact or checkpoint passed verification and is eligible for durable promotion in this slice.";
  }

  if (input.disposition === "REJECTED") {
    return input.reviewMode === "reject"
      ? "The human review rejected this meeting-derived line, so it stays out of promoted memory."
      : "This draft fact was not selected into the confirmed set, so it is rejected instead of being silently promoted.";
  }

  if (input.sourceVerification === MemoryItemVerification.INFERRED) {
    return "This line stays deferred because it is inferred and still needs stronger grounding before promotion.";
  }

  if (input.hasTruthConflict || input.verification.status !== "passed") {
    return trimText(
      input.verification.blockedReasons.join(" ") ||
        "This line stays deferred because verification or truth conflict posture is still unresolved.",
      220,
    );
  }

  return "This line remains deferred because the operator kept the slice in draft posture.";
}

function normalizeRuntimePromotionDisposition(status?: string | null) {
  if (status === "PROMOTED") return "PROMOTED" as const;
  if (status === "REJECTED") return "REJECTED" as const;
  return "DEFERRED" as const;
}

function toVisibleTruthConflictStatus(status?: string | null): "NONE" | "OPEN" | "RESOLVED" {
  if (status === "OPEN") return "OPEN";
  if (!status) return "NONE";
  return "RESOLVED";
}

function buildRuntimeSessionHref(meetingId?: string | null) {
  return meetingId ? `/meetings/${meetingId}` : "/operating";
}

export function buildRuntimeJobQueueReadout(input: {
  id: string;
  jobType: string;
  status: string;
  inputSummary: string;
  outputSummary?: string | null;
  reviewPosture: string;
  createdAt: Date;
  pausedAt?: Date | null;
  completedAt?: Date | null;
  runtimeSession?: {
    meetingId?: string | null;
  } | null;
}) {
  return {
    id: input.id,
    jobType: input.jobType,
    status: input.status,
    inputSummary: input.inputSummary,
    outputSummary: input.outputSummary ?? null,
    reviewPosture: input.reviewPosture,
    meetingId: input.runtimeSession?.meetingId ?? null,
    href: buildRuntimeSessionHref(input.runtimeSession?.meetingId),
    createdAt: input.createdAt,
    pausedAt: input.pausedAt ?? null,
    completedAt: input.completedAt ?? null,
  };
}

export function buildReflectionCandidateReadout(input: {
  id: string;
  status: string;
  summary: string;
  reviewerNote: string | null;
  sourceVerification: string;
  sourceStatus: string;
  evidenceRefs: string | null;
  createdAt: Date;
  runtimeSession: {
    id: string;
    label: string;
    meetingId: string | null;
  };
}) {
  const evidenceRefs = parseRuntimeStringList(input.evidenceRefs);
  const sourceClasses = buildEvidenceSourceClasses({
    sourceVerification: input.sourceVerification,
    sourceStatus: input.sourceStatus,
    evidenceRefs,
  });
  const evidenceSummary =
    evidenceRefs.length > 0
      ? `Evidence refs: ${evidenceRefs.slice(0, 3).join(" · ")}${evidenceRefs.length > 3 ? " ..." : ""}`
      : "Evidence refs stay attached to the runtime trace.";

  return {
    id: input.id,
    title: `${input.runtimeSession.label} carry-forward`,
    summary: input.summary,
    reviewPosture:
      input.reviewerNote ??
      "Review-safe carry-forward context derived from trusted runtime state. Separate review is still required before any memory truth promotion.",
    evidenceSummary,
    sourceClasses,
    status: input.status,
    sessionId: input.runtimeSession.id,
    sessionLabel: input.runtimeSession.label,
    href: buildRuntimeSessionHref(input.runtimeSession.meetingId),
    createdAt: input.createdAt,
  };
}

export function buildWorkspaceRuntimeOperatorOverview(
  input: WorkspaceRuntimeOperatorOverviewInput,
): WorkspaceRuntimeOperatorOverview {
  const cacheHealth = buildRuntimeCacheHealth(input.cacheTelemetry);
  const truthConflictSessions = new Set(
    input.truthConflicts.filter((item) => item.status === "OPEN").map((item) => item.runtimeSession.id),
  );
  const promotionByCandidateId = new Map(
    input.memoryPromotions
      .filter((item) => item.memoryCandidateId)
      .map((item) => [item.memoryCandidateId as string, item]),
  );
  const reflectionCandidates = input.memoryCandidates
    .filter((item) => isReflectionMemoryCandidate(item) && item.status === "VERIFIED")
    .map((item) => buildReflectionCandidateReadout(item))
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
    .slice(0, 6);
  const verificationQueue = [
    ...input.verificationReports.map((item) => ({
      id: item.id,
      source: "verification_report" as const,
      title: `${item.runtimeSession.label} verification`,
      summary: item.summary,
      status: item.status,
      truthScore: item.truthScore,
      sessionId: item.runtimeSession.id,
      sessionLabel: item.runtimeSession.label,
      href: buildRuntimeSessionHref(item.runtimeSession.meetingId),
      createdAt: item.createdAt,
    })),
    ...input.truthConflicts.map((item) => ({
      id: item.id,
      source: "truth_conflict" as const,
      title: `${item.runtimeSession.label} truth conflict`,
      summary: item.summary,
      status: item.status,
      truthScore: null,
      sessionId: item.runtimeSession.id,
      sessionLabel: item.runtimeSession.label,
      href: buildRuntimeSessionHref(item.runtimeSession.meetingId),
      createdAt: item.createdAt,
    })),
  ]
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
    .slice(0, 8);

  const promotionQueue = [
    ...input.memoryCandidates
      .filter((item) => !isReflectionMemoryCandidate(item) || item.status !== "VERIFIED")
      .map((item) => {
      const evidenceRefs = parseRuntimeStringList(item.evidenceRefs);
      const promotion = promotionByCandidateId.get(item.id);
      const disposition = normalizeRuntimePromotionDisposition(promotion?.status ?? item.status);
      const isReflection = isReflectionMemoryCandidate(item);
      return {
        id: item.id,
        source: promotion ? ("memory_promotion" as const) : ("memory_candidate" as const),
        title: isReflection
          ? `${item.runtimeSession.label} reflection carry-forward`
          : `${item.runtimeSession.label} memory candidate`,
        summary: item.summary,
        status: disposition,
        rationale: promotion?.rationale ?? item.reviewerNote ?? item.summary,
        sourceClasses: buildEvidenceSourceClasses({
          sourceVerification: item.sourceVerification,
          sourceStatus: item.sourceStatus,
          evidenceRefs,
        }),
        truthConflictOpen: truthConflictSessions.has(item.runtimeSession.id),
        sessionId: item.runtimeSession.id,
        sessionLabel: item.runtimeSession.label,
        href: buildRuntimeSessionHref(item.runtimeSession.meetingId),
        createdAt: promotion?.createdAt ?? item.createdAt,
      };
    }),
  ]
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
    .slice(0, 8);
  const problemSpaceQueue = input.problemSpaces.map((item) => {
    const coordinationOutcome = mapProblemSpaceStatusToCoordinationOutcome(item.status);
    const latestAssignment = item.driAssignments[0] ?? null;
    return {
      id: item.id,
      title: item.title,
      summary: item.summary,
      nextStep: item.nextStep,
      status: item.status,
      ownerHint: item.ownerHint,
      groundingSummary: buildProblemSpaceGroundingSummary({
        evidenceRefs: parseRuntimeStringList(item.evidenceRefs),
        coordinationOutcome,
      }),
      driSummary: latestAssignment
        ? buildProblemSpaceDriSummary({
            assignedUserName: latestAssignment.assignedUserName ?? item.ownerHint,
            assignedByName: latestAssignment.assignedByName,
            assignmentNote: latestAssignment.note,
            coordinationOutcome,
          })
        : null,
      conflictSummary: buildProblemSpaceConflictSummary(coordinationOutcome),
      href: buildRuntimeSessionHref(item.meetingId ?? item.runtimeSession.meetingId),
      updatedAt: item.updatedAt,
    };
  });
  const { operatingGaps, operatingGapSummary, businessLoopGapSummary } =
    buildWorkspaceBusinessLoopGapReadout(input);
  const reflectionJobs = input.consolidationJobs.filter((item) => isReflectionJobType(item.jobType));
  const consolidationJobs = input.consolidationJobs.filter((item) => !isReflectionJobType(item.jobType));
  const reflectionJobReadouts = reflectionJobs.map((item) => buildRuntimeJobQueueReadout(item));
  const consolidationJobReadouts = consolidationJobs.map((item) => buildRuntimeJobQueueReadout(item));
  const consolidationAuditSummary = buildConsolidationQueueAuditSummary({
    jobs: consolidationJobReadouts,
  });
  const coordinationTrace = buildCoordinationTraceBridge({
    problemSpaces: input.problemSpaces.map((item) => ({
      id: item.id,
      title: item.title,
      status: item.status,
      ownerHint: item.ownerHint,
      evidenceRefs: parseRuntimeStringList(item.evidenceRefs),
      meetingId: item.meetingId ?? item.runtimeSession.meetingId,
      opportunityId: item.opportunityId,
      companyId: item.companyId,
      updatedAt: item.updatedAt,
      driAssignments: item.driAssignments,
    })),
    humanExecutions: input.humanExecutions,
    officialFollowThrough: input.officialFollowThrough,
  });
  const baseContinuityQueue = (input.runtimeSessions ?? []).map((session) =>
    buildWorkspaceRuntimeContinuityQueueItem(session, undefined, {
      capabilities: input.capabilities,
      connectors: input.connectors,
      humanExecutions: input.humanExecutions,
      officialWriteIntents: input.officialWriteIntents,
      limitedAutoIntents: input.limitedAutoIntents,
      officialFollowThrough: input.officialFollowThrough,
      benchmarkMatrixRuns: input.benchmarkMatrixRuns ?? [],
      benchmarkExecutionRequests: input.benchmarkExecutionRequests ?? [],
      benchmarkExecutionAcknowledgements: input.benchmarkExecutionAcknowledgements ?? [],
      benchmarkExecutionFollowThrough: input.benchmarkExecutionFollowThrough ?? [],
    }, input.swarmReadOnlyWorkersEnabled ?? false),
  );
  const continuityPilotReview = buildRuntimeContinuityPilotEffectivenessReview(baseContinuityQueue, {
    workspaceSessionCount: input.sessionCounts.total,
  });
  const continuityQueue = (input.runtimeSessions ?? [])
    .map((session) =>
      buildWorkspaceRuntimeContinuityQueueItem(session, continuityPilotReview, {
        capabilities: input.capabilities,
        connectors: input.connectors,
        humanExecutions: input.humanExecutions,
        officialWriteIntents: input.officialWriteIntents,
        limitedAutoIntents: input.limitedAutoIntents,
        officialFollowThrough: input.officialFollowThrough,
        benchmarkMatrixRuns: input.benchmarkMatrixRuns ?? [],
        benchmarkExecutionRequests: input.benchmarkExecutionRequests ?? [],
        benchmarkExecutionAcknowledgements: input.benchmarkExecutionAcknowledgements ?? [],
        benchmarkExecutionFollowThrough: input.benchmarkExecutionFollowThrough ?? [],
      }, input.swarmReadOnlyWorkersEnabled ?? false),
    )
    .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())
    .slice(0, 6);
  const combinedVerificationQueue = [
    ...verificationQueue,
    ...continuityQueue
      .filter((item) => item.runThread.swarmVerificationMergeLaneContract.state !== "not_ready")
      .map((item) => ({
        id:
          item.runThread.swarmVerificationMergeLaneContract.recordEventId ??
          `swarm-merge-lane:${item.id}:${item.runThread.swarmVerificationMergeLaneContract.mergeLaneTruth ?? "unknown"}`,
        source: "swarm_merge_lane" as const,
        title: `${item.title} swarm merge lane`,
        summary: item.runThread.swarmVerificationMergeLaneContract.summary,
        status:
          item.runThread.swarmVerificationMergeLaneContract.mergeLaneTruth === "mergeable"
            ? "PASSED"
            : item.runThread.swarmVerificationMergeLaneContract.mergeLaneTruth ===
                "rework_required"
              ? "BLOCKED"
              : "NEEDS_REVIEW",
        truthScore: null,
        sessionId: item.id,
        sessionLabel: item.title,
        href: item.href,
        createdAt:
          item.runThread.swarmVerificationMergeLaneContract.recordedAt ??
          item.runThread.updatedAt,
      })),
  ]
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
    .slice(0, 8);
  const projectSkillLibrary = buildProjectSkillLibraryReadModel({
    capabilitySignals: input.capabilities.map((item) => ({
      id: item.id,
      name: item.name,
      stage: item.stage,
      description: item.description,
      loadPolicy: item.loadPolicy,
      reviewRequired: item.reviewRequired,
      boundaryNote: item.boundaryNote ?? RUNTIME_BOUNDARY_NOTE,
    })),
  });
  const environmentOfficialWriteIntents = input.officialWriteIntents.map((item) => ({
    ...item,
    actionType: item.writeActionType,
    acknowledgementStatus: item.writeAcknowledgementStatus,
  }));
  const environmentLimitedAutoIntents = input.limitedAutoIntents.map((item) => ({
    ...item,
    actionType: item.limitedAutoActionType,
    acknowledgementStatus: item.limitedAutoAckStatus,
  }));
  const environmentContract = buildEnvironmentContractReadModel({
    projectSkillLibrary,
    connectors: input.connectors,
    officialActionCoverage: getRicherOfficialActionCoverageCatalog().map((item) => ({
      actionType: item.actionType,
      defaultPath: item.defaultPath,
      limitedAutoStatus: item.limitedAutoStatus,
      executableLimitedAuto: item.executableLimitedAuto,
      boundaryReason: item.boundaryReason,
    })),
    officialWriteIntents: environmentOfficialWriteIntents,
    limitedAutoIntents: environmentLimitedAutoIntents,
    officialFollowThrough: input.officialFollowThrough,
    humanExecutionCount: input.humanExecutions.length,
    officialFollowThroughCount: input.officialFollowThrough.length,
  });
  const benchmarkMatrix = buildBenchmarkMatrixReadModel({
    recordedRuns: input.benchmarkMatrixRuns,
    executionRequests: input.benchmarkExecutionRequests,
    executionAcknowledgements: input.benchmarkExecutionAcknowledgements,
    executionFollowThrough: input.benchmarkExecutionFollowThrough,
  });
  const operatorControlSummary = buildRuntimeOperatorControlSummary({
    environmentContract,
    benchmarkMatrix,
  });
  const swarmOperatorControlSurface = buildRuntimeSwarmOperatorControlSurface({
    items: continuityQueue.map((item) => ({
      id: item.id,
      meetingId: item.meetingId,
      title: item.title,
      href: item.href,
      updatedAt: item.updatedAt,
      latestCheckpointId: item.runThread.latestCheckpoint?.checkpointId ?? null,
      latestCheckpointKey: item.runThread.latestCheckpoint?.checkpointKey ?? null,
      resumeState: item.runThread.resume.state,
      resumeAskMode: item.resumeAskMode,
      interruptReasonState: item.interruptReasonState,
      recoveryState: item.recoveryState,
      humanInputCheckpointState: item.runThread.humanInputCheckpoint.state,
      humanInputCheckpointId: item.runThread.humanInputCheckpoint.checkpointId,
      humanInputCheckpointKey: item.runThread.humanInputCheckpoint.checkpointKey,
      humanInputRequestState: item.debuggerHumanInputRequestState,
      closeRequestState: item.runThread.closeRequest.state,
      closeRequestCheckpointId: item.runThread.closeRequest.checkpointId,
      closeRequestCheckpointKey: item.runThread.closeRequest.checkpointKey,
      takeoverRequestState: item.debuggerTakeoverRequestState,
      takeoverActivationState: item.debuggerTakeoverActivationState,
      takeoverFollowThroughState: item.debuggerTakeoverFollowThroughState,
      takeoverOwner: item.debuggerTakeoverOwner,
      swarmBudgetPosture: item.runThread.swarmSpawnBudgetEnvelope.budgetPosture,
      swarmSpawnDenyReason: item.debuggerSwarmSpawnContractDenyReason,
      repeatPatternStatus: item.repeatPatternStatus,
    })),
  });
  const operatorReviewSummary = buildRuntimeOperatorReviewSummary({
    verificationQueue: combinedVerificationQueue.map((item) => ({
      title: item.title,
      href: item.href,
      createdAt: item.createdAt,
    })),
    promotionQueue: promotionQueue.map((item) => ({
      title: item.title,
      href: item.href,
      createdAt: item.createdAt,
    })),
    reflectionCandidates: reflectionCandidates.map((item) => ({
      title: item.title,
      href: item.href,
      createdAt: item.createdAt,
    })),
    reflectionJobs: reflectionJobs.map((item) => ({
      inputSummary: item.inputSummary,
      href: buildRuntimeSessionHref(item.runtimeSession?.meetingId),
      createdAt: item.createdAt,
    })),
    consolidationJobs: consolidationJobs.map((item) => ({
      inputSummary: item.inputSummary,
      href: buildRuntimeSessionHref(item.runtimeSession?.meetingId),
      createdAt: item.createdAt,
    })),
  });
  const operatorReviewActionSummary = buildRuntimeOperatorReviewActionSummary({
    operatorReviewSummary,
  });
  const overviewOperatorActionSource =
    continuityQueue.find(
      (item) =>
        item.operatorActionSummary.state !== "keep_review_gated" &&
        item.operatorActionSummary.state !== "observe",
    ) ?? continuityQueue[0] ?? null;
  const operatorActionSummary: HelmV21RuntimeOperatorActionSummary = overviewOperatorActionSource
    ? overviewOperatorActionSource.operatorActionSummary
    : operatorReviewActionSummary.state !== "hold_review_gated"
      ? {
          state: operatorReviewActionSummary.state,
          driver: "review_queue",
          progressState: "review_gated",
          requestTakeoverState: "not_requested",
          requestHumanInputState: "not_requested",
          takeoverActivationState: "inactive",
          operatorControlState: operatorControlSummary.state,
          closePostureState: "open",
          focusTitle: operatorReviewActionSummary.focusTitle,
          focusHref: operatorReviewActionSummary.focusHref,
          checkpointKey: null,
          currentOwner: null,
          summary: operatorReviewActionSummary.summary,
          nextAction:
            operatorReviewActionSummary.nextAction ??
            "Resolve the visible review-first queue before widening operator attention.",
          latestUpdatedAt:
            operatorReviewActionSummary.latestUpdatedAt ?? operatorControlSummary.latestUpdatedAt,
          boundaryNote:
            "Operator action summary stays read-only, review-first, and boundary-first. It compresses the next bounded operator action from request posture, takeover activation, operator control, close posture, and review queues without widening authority or creating a workflow engine.",
        }
    : {
        state:
          operatorControlSummary.state === "execution_pending"
            ? "acknowledge_execution"
            : operatorControlSummary.state === "execution_review"
              ? "review_execution"
              : operatorControlSummary.state === "execution_follow_through"
                ? "resolve_execution_followthrough"
                : operatorControlSummary.state === "benchmark_requested"
                  ? "run_benchmark"
                  : operatorControlSummary.state === "benchmark_review"
                    ? "acknowledge_benchmark"
                    : operatorControlSummary.state === "benchmark_follow_through"
                      ? "resolve_benchmark_followthrough"
                      : "keep_review_gated",
        driver:
          operatorControlSummary.state === "review_gated" || operatorControlSummary.state === "boundary_only"
            ? "steady_state"
            : "operator_control",
        progressState:
          operatorControlSummary.state === "review_gated" || operatorControlSummary.state === "boundary_only"
            ? "review_gated"
            : "operator_control_attention",
        requestTakeoverState: "not_requested",
        requestHumanInputState: "not_requested",
        takeoverActivationState: "inactive",
        operatorControlState: operatorControlSummary.state,
        closePostureState: "open",
        focusTitle: null,
        focusHref: null,
        checkpointKey: null,
        currentOwner: null,
        summary:
          operatorControlSummary.state === "review_gated" || operatorControlSummary.state === "boundary_only"
            ? "No urgent bounded operator action is open at the workspace level, so the current action is to keep review-first posture explicit."
            : operatorControlSummary.summary,
        nextAction:
          operatorControlSummary.nextAction ??
          "Keep the workspace in bounded, review-first posture until the operator explicitly advances a specific thread.",
        latestUpdatedAt: operatorControlSummary.latestUpdatedAt,
        boundaryNote:
          "Operator action summary stays read-only, review-first, and boundary-first. It compresses the next bounded operator action from request posture, takeover activation, operator control, and close posture without widening authority or creating a workflow engine.",
      };
  const operatorWorkSummary = buildRuntimeOperatorWorkSummary({
    operatorActionSummary,
    operatorControlSummary,
    operatorReviewActionSummary,
    continuityQueue: continuityQueue.map((item) => ({
      title: item.title,
      href: item.href,
      updatedAt: item.updatedAt,
      operatorActionSummary: item.operatorActionSummary,
    })),
    criticalOperatingGapCount: operatingGapSummary.escalationRequired,
  });
  const operatorCueSummary = buildRuntimeOperatorCueSummary({
    operatorWorkSummary,
    operatorActionSummary,
    operatorControlSummary,
    operatorReviewSummary,
    operatorReviewActionSummary,
  });
  const operatorNextMoveSummary = buildRuntimeOperatorNextMoveSummary({
    operatorCueSummary,
    operatorWorkSummary,
    operatorActionSummary,
    operatorReviewActionSummary,
  });
  const operatorActionCueSummary = buildRuntimeOperatorActionCueSummary({
    operatorCueSummary,
    operatorNextMoveSummary,
    operatorControlSummary,
    operatorReviewActionSummary,
  });
  const operatorReviewControlCueSummary = buildRuntimeOperatorReviewControlCueSummary({
    operatorCueSummary,
    operatorActionCueSummary,
    operatorControlSummary,
    operatorReviewSummary,
    operatorReviewActionSummary,
  });
  const operatorStartPointSummary = buildRuntimeOperatorStartPointSummary({
    operatorActionCueSummary,
    operatorReviewControlCueSummary,
  });

  return {
    boundaryNote: RUNTIME_BOUNDARY_NOTE,
    summary: {
      totalSessions: input.sessionCounts.total,
      activeSessions: input.sessionCounts.active,
      reviewQueue: input.queueCounts.verification,
      operatingGapQueue: operatingGapSummary.totalOpen,
      promotionQueue: input.queueCounts.promotion,
      reflectionCarryForward: input.queueCounts.reflectionCarryForward,
      openProblemSpaces: input.queueCounts.openProblemSpaces,
      unresolvedCompositionFailures: input.queueCounts.unresolvedCompositionFailures,
      criticalOperatingGaps: operatingGaps.filter((item) => item.severity === "critical").length,
      reflectionQueue: input.queueCounts.reflectionQueue,
      consolidationQueue: input.queueCounts.consolidationQueue,
      cacheHitRate: cacheHealth.hitRate,
      tokensSaved: cacheHealth.tokensSaved,
      pruneSessions: continuityQueue.filter((item) => item.posture === "PRUNE").length,
      compactSessions: continuityQueue.filter((item) => item.posture === "COMPACT").length,
      weakReplaySessions: continuityQueue.filter((item) => item.replayStatus === "WEAK").length,
      highRiskContinuitySessions: continuityQueue.filter((item) => item.riskLevel === "HIGH").length,
      checkpointDerivedContinuitySessions: continuityQueue.filter((item) =>
        item.payloadStateSource === "checkpoint_snapshot" || item.payloadStateSource === "checkpoint_plus_edits",
      ).length,
      recoverableContinuitySessions: continuityQueue.filter((item) => item.recoveryState === "RECOVERABLE").length,
      reviewRequiredContinuitySessions: continuityQueue.filter((item) => item.recoveryState === "REVIEW_REQUIRED").length,
      blockedContinuitySessions: continuityQueue.filter((item) => item.recoveryState === "BLOCKED").length,
      remediationAttemptedContinuitySessions: continuityQueue.filter((item) => item.remediationAttempts > 0).length,
      repeatPatternContinuitySessions: continuityQueue.filter((item) => item.repeatPatternStatus !== "NONE").length,
      lowConfidenceContinuitySessions: continuityQueue.filter((item) => item.calibrationConfidence === "LOW").length,
      ineffectiveContinuitySessions: continuityQueue.filter((item) => item.latestEffectiveness === "INEFFECTIVE").length,
    },
    operatingGapSummary,
    businessLoopGapSummary,
    operatingGaps,
    verificationQueue: combinedVerificationQueue,
    promotionQueue,
    reflectionCandidates,
    problemSpaces: problemSpaceQueue,
    playerCoachQueue: input.playerCoachBriefs.map((item) => {
      const coordinationOutcome = item.problemSpace
        ? mapProblemSpaceStatusToCoordinationOutcome(item.problemSpace.status)
        : null;
      const latestAssignment = item.problemSpace?.driAssignments[0] ?? null;
      return {
        id: item.id,
        title: item.title,
        summary: item.summary,
        problemSpaceId: item.problemSpaceId,
        problemSpaceTitle: item.problemSpace?.title ?? null,
        groundingSummary:
          item.problemSpace && coordinationOutcome
            ? buildProblemSpaceGroundingSummary({
                evidenceRefs: parseRuntimeStringList(item.problemSpace.evidenceRefs),
                coordinationOutcome,
              })
            : null,
        truthPosture: coordinationOutcome ? buildProblemSpaceTruthPosture(coordinationOutcome) : null,
        driSummary:
          item.problemSpace && coordinationOutcome && latestAssignment
            ? buildProblemSpaceDriSummary({
                assignedUserName: latestAssignment.assignedUserName ?? item.problemSpace.ownerHint,
                assignedByName: latestAssignment.assignedByName,
                assignmentNote: latestAssignment.note,
                coordinationOutcome,
              })
            : null,
        href: buildRuntimeSessionHref(item.problemSpace?.meetingId ?? item.runtimeSession.meetingId),
        updatedAt: item.updatedAt,
      };
    }),
    compositionFailures: input.compositionFailures.map((item) => ({
      id: item.id,
      failureClass: item.failureClass,
      summary: item.summary,
      sessionLabel: item.runtimeSession.label,
      problemSpaceTitle: item.problemSpace?.title ?? null,
      href: buildRuntimeSessionHref(item.runtimeSession.meetingId),
      createdAt: item.createdAt,
    })),
    reflectionJobs: reflectionJobReadouts,
    consolidationJobs: consolidationJobReadouts,
    consolidationAuditSummary,
    signals: input.signals.map((item) => ({
      id: item.id,
      signalType: item.signalType,
      sourceType: item.sourceType,
      signalSummary: item.signalSummary,
      truthWeight: item.truthWeight,
      href: buildRuntimeSessionHref(item.runtimeSession.meetingId),
      createdAt: item.createdAt,
    })),
    capabilities: input.capabilities.map((item) => ({
      id: item.id,
      name: item.name,
      stage: item.stage,
      description: item.description,
      loadPolicy: item.loadPolicy,
      reviewRequired: item.reviewRequired,
    })),
    projectSkillLibrary,
    environmentContract,
    benchmarkMatrix,
    operatorControlSummary,
    swarmOperatorControlSurface,
    operatorActionSummary,
    operatorReviewSummary,
    operatorReviewActionSummary,
    operatorCueSummary,
    operatorNextMoveSummary,
    operatorActionCueSummary,
    operatorReviewControlCueSummary,
    operatorStartPointSummary,
    operatorWorkSummary,
    handoffPackets: input.handoffPackets.map((item) => ({
      id: item.id,
      title: `${item.fromAgent} -> ${item.toAgent}`,
      summary: item.goal,
      fromAgent: normalizeRuntimeAgentId(item.fromAgent),
      toAgent: normalizeRuntimeAgentId(item.toAgent),
      approvalTier: normalizeRuntimeApprovalTier(item.approvalTier),
      href: buildRuntimeSessionHref(item.runtimeSession.meetingId),
      createdAt: item.createdAt,
    })),
    initiativeRuns: input.initiativeRuns.map((item) => ({
      id: item.id,
      title: item.title,
      summary: item.summary,
      status: item.status,
      targetOutcome: item.targetOutcome,
      href: buildRuntimeSessionHref(item.runtimeSession.meetingId),
      createdAt: item.createdAt,
    })),
    coordinationTraceQueue: coordinationTrace.items.slice(0, 6).map((item) => ({
      id: item.id,
      title: item.title,
      summary: item.summary,
      posture: item.posture,
      linkageSummary: item.linkageSummary,
      humanExecutionSummary: item.humanExecutionSummary,
      officialFollowThroughSummary: item.officialFollowThroughSummary,
      href: problemSpaceQueue.find((problemSpace) => problemSpace.id === item.id)?.href ?? "/operating",
      updatedAt: item.updatedAt,
    })),
    continuityQueue,
    continuityPilotReview,
    coordinationMetrics: input.coordinationMetrics
      ? {
          metricDate: input.coordinationMetrics.metricDate,
          actionReady: input.coordinationMetrics.actionReadyCount,
          reviewNeeded: input.coordinationMetrics.reviewNeededCount,
          waitingOnSignal: input.coordinationMetrics.waitingOnSignalCount,
          waitingOnAuthority: input.coordinationMetrics.waitingOnAuthorityCount,
          capabilityGap: input.coordinationMetrics.capabilityGapCount,
        }
      : {
          metricDate: null,
          actionReady: 0,
          reviewNeeded: 0,
          waitingOnSignal: 0,
          waitingOnAuthority: 0,
          capabilityGap: 0,
        },
    cacheHealth,
  };
}

export function buildWorkspaceBusinessLoopGapReadout(
  input: WorkspaceBusinessLoopGapReadoutInput,
): WorkspaceBusinessLoopGapReadout {
  const operatingGaps = buildOperatingGapQueue({
    workspaceId: input.workspaceId,
    coordinationMetrics: input.coordinationMetrics
      ? {
          workspaceId: input.workspaceId,
          metricDate: input.coordinationMetrics.metricDate,
          href: "/reports",
        }
      : null,
    truthConflicts: input.truthConflicts.map((item) => ({
      id: item.id,
      workspaceId: input.workspaceId,
      summary: item.summary,
      status: item.status as "OPEN" | "RESOLVED" | "SUPPRESSED",
      subjectKey: item.subjectKey,
      href: buildRuntimeSessionHref(item.runtimeSession.meetingId),
      createdAt: item.createdAt,
    })),
    problemSpaces: input.problemSpaces.map((item) => ({
      id: item.id,
      workspaceId: input.workspaceId,
      title: item.title,
      summary: item.summary,
      nextStep: item.nextStep,
      status: item.status as
        | "DETECTED"
        | "SCOPED"
        | "OPEN"
        | "ASSIGNED"
        | "ACTIVE"
        | "BLOCKED"
        | "WATCHING"
        | "WAITING_ON_SIGNAL"
        | "WAITING_ON_AUTHORITY"
        | "RESOLVED"
        | "RETIRED",
      ownerHint: item.ownerHint,
      evidenceRefs: parseRuntimeStringList(item.evidenceRefs),
      href: buildRuntimeSessionHref(item.meetingId ?? item.runtimeSession.meetingId),
      updatedAt: item.updatedAt,
    })),
    compositionFailures: input.compositionFailures.map((item) => ({
      id: item.id,
      workspaceId: input.workspaceId,
      failureClass: item.failureClass as HelmV21CompositionFailureClass,
      summary: item.summary,
      problemSpaceTitle: item.problemSpace?.title ?? null,
      href: buildRuntimeSessionHref(item.runtimeSession.meetingId),
      createdAt: item.createdAt,
    })),
  });

  return {
    operatingGaps,
    operatingGapSummary: summarizeOperatingGaps(operatingGaps),
    businessLoopGapSummary: summarizeBusinessLoopGaps(operatingGaps),
  };
}

async function getWorkspaceContinuityPilotReview(workspaceId: string) {
  const [workspaceSessionCount, runtimeSessions] = await Promise.all([
    db.runtimeSession.count({
      where: { workspaceId },
    }),
    db.runtimeSession.findMany({
      where: { workspaceId },
      include: {
        persistedPayloads: {
          select: {
            handle: true,
          },
        },
        contextEditEvents: {
          orderBy: { createdAt: "asc" },
          take: 24,
        },
        checkpoints: {
          orderBy: { createdAt: "desc" },
          take: 2,
        },
        notebook: true,
        problemSpaces: {
          orderBy: { createdAt: "desc" },
          take: 3,
        },
        memoryCandidates: {
          orderBy: { createdAt: "desc" },
          take: 12,
        },
        memoryPromotions: {
          where: {
            status: "PROMOTED",
          },
          orderBy: { createdAt: "desc" },
          take: 12,
        },
        verificationReports: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        handoffPackets: {
          orderBy: { createdAt: "desc" },
          take: 4,
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 12,
    }),
  ]);

  if (!runtimeSessions.length) {
    return buildRuntimeContinuityPilotEffectivenessReview([], {
      workspaceSessionCount,
    });
  }

  const runtimeSessionLifecycleEvents = await db.runtimeEvent.findMany({
    where: {
      workspaceId,
      relatedObjectType: "RuntimeSession",
      relatedObjectId: {
        in: runtimeSessions.map((session) => session.id),
      },
      OR: [
        {
          eventType: {
            startsWith: "continuity.remediation.",
          },
        },
        {
          eventType: {
            in: [...RUNTIME_SESSION_CONTROL_EVENT_TYPES],
          },
        },
      ],
    },
    select: {
      id: true,
      eventType: true,
      payload: true,
      trustedContext: true,
      triggeredBy: true,
      createdAt: true,
      relatedObjectId: true,
    },
    orderBy: { createdAt: "desc" },
    take: 96,
  });
  const remediationEventsBySessionId = new Map<string, Array<(typeof runtimeSessionLifecycleEvents)[number]>>();
  const requestEventsBySessionId = new Map<string, Array<(typeof runtimeSessionLifecycleEvents)[number]>>();
  for (const event of runtimeSessionLifecycleEvents) {
    if (!event.relatedObjectId) continue;
    if (event.eventType.startsWith("continuity.remediation.")) {
      const list = remediationEventsBySessionId.get(event.relatedObjectId) ?? [];
      list.push(event);
      remediationEventsBySessionId.set(event.relatedObjectId, list);
      continue;
    }
    if (isRuntimeSessionControlEventType(event.eventType)) {
      const list = requestEventsBySessionId.get(event.relatedObjectId) ?? [];
      list.push(event);
      requestEventsBySessionId.set(event.relatedObjectId, list);
    }
  }
  const meetingMetadataById = await loadRuntimeContinuityMeetingMetadataMap(
    runtimeSessions.map((session) => session.meetingId).filter((item): item is string => Boolean(item)),
  );
  const continuityInputSessions = finalizeRuntimeContinuityInputSessions(
    runtimeSessions.map((session) => ({
      id: session.id,
      workspaceId: session.workspaceId,
      label: session.label,
      sessionKey: session.sessionKey,
      status: session.status,
      currentStage: session.currentStage,
      sourcePage: session.sourcePage,
      boundaryNote: session.boundaryNote,
      replayableEventLog: session.replayableEventLog,
      meetingId: session.meetingId,
      opportunityId: session.opportunityId,
      companyId: session.companyId,
      budgetTokenLimit: session.budgetTokenLimit,
      budgetTokenUsed: session.budgetTokenUsed,
      prunedTokenCount: session.prunedTokenCount,
      resumedFromKey: session.resumedFromKey,
      controlPlaneLifecycleJson: session.controlPlaneLifecycleJson,
      controlPlaneLifecycleUpdatedAt: session.controlPlaneLifecycleUpdatedAt,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      closedAt: session.closedAt,
      contextEditEvents: session.contextEditEvents.map((item) => ({
        id: item.id,
        strategy: item.strategy,
        beforeTokenCount: item.beforeTokenCount,
        afterTokenCount: item.afterTokenCount,
        removedHandles: item.removedHandles,
        removedSummary: item.removedSummary,
        createdAt: item.createdAt,
      })),
      checkpoints: session.checkpoints.map((item) => ({
        id: item.id,
        checkpointKey: item.checkpointKey,
        label: item.label,
        status: item.status,
        summary: item.summary,
        snapshotJson: item.snapshotJson,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
      notebook: session.notebook
        ? {
            sessionSummary: session.notebook.sessionSummary,
            decisionSummary: session.notebook.decisionSummary,
            blockerSummary: session.notebook.blockerSummary,
            pendingQuestions: session.notebook.pendingQuestions,
            openLoopSummary: session.notebook.openLoopSummary,
            boundaryNote: session.notebook.boundaryNote,
          }
        : null,
      problemSpaces: session.problemSpaces.map((item) => ({
        title: item.title,
        nextStep: item.nextStep,
        status: item.status,
        ownerHint: item.ownerHint,
        evidenceRefs: item.evidenceRefs,
      })),
      memoryCandidates: session.memoryCandidates.map((item) => ({
        id: item.id,
        summary: item.summary,
        status: item.status,
        evidenceRefs: item.evidenceRefs,
        sourceVerification: item.sourceVerification,
      })),
      memoryPromotions: session.memoryPromotions.map((item) => ({
        memoryCandidateId: item.memoryCandidateId,
        status: item.status,
      })),
      verificationReports: session.verificationReports.map((item) => ({
        status: item.status,
        summary: item.summary,
        blockedReasons: item.blockedReasons ?? "[]",
      })),
      handoffPackets: session.handoffPackets.map((item) => ({
        id: item.id,
        packetKey: item.packetKey,
        fromAgent: normalizeRuntimeAgentId(item.fromAgent),
        toAgent: normalizeRuntimeAgentId(item.toAgent),
        goal: item.goal,
        approvalTier: normalizeRuntimeApprovalTier(item.approvalTier),
        constraintsJson: item.constraintsJson,
        trustedRefs: item.trustedRefs,
        untrustedRefs: item.untrustedRefs,
        requiredOutputs: item.requiredOutputs,
        evidenceRefs: item.evidenceRefs,
        notebookRef: item.notebookRef,
        checkpointRef: item.checkpointRef,
        createdAt: item.createdAt,
      })),
      persistedPayloadHandles: session.persistedPayloads.map((item) => item.handle),
      remediationEvents: (remediationEventsBySessionId.get(session.id) ?? []).map((event) => ({
        id: event.id,
        eventType: event.eventType,
        payload: event.payload,
        trustedContext: event.trustedContext,
        triggeredBy: event.triggeredBy,
        createdAt: event.createdAt,
      })),
      requestEvents: (requestEventsBySessionId.get(session.id) ?? []).map((event) => ({
        id: event.id,
        eventType: event.eventType,
        payload: event.payload,
        trustedContext: event.trustedContext,
        triggeredBy: event.triggeredBy,
        createdAt: event.createdAt,
      })),
    })),
    meetingMetadataById,
  );
  const continuityQueue = continuityInputSessions.map((session) =>
    buildWorkspaceRuntimeContinuityQueueItem(
      session,
      undefined,
      undefined,
      false,
    ),
  );

  return buildRuntimeContinuityPilotEffectivenessReview(continuityQueue, {
    workspaceSessionCount,
  });
}

function collectMeetingPayloadDrafts(meeting: MeetingRuntimeUpgradeMeeting) {
  const noteId = meeting.note?.id ?? meeting.id;
  return [
    buildPersistedPayloadDraft({
      key: `${meeting.workspaceId}:${meeting.id}:agenda`,
      sourceType: "meeting_note",
      sourceId: noteId,
      label: "Meeting agenda and goal",
      loadPolicy: "always_on",
      text: [meeting.agenda, meeting.note?.meetingGoal].filter(Boolean).join("\n"),
      loadedByDefault: true,
    }),
    buildPersistedPayloadDraft({
      key: `${meeting.workspaceId}:${meeting.id}:summary`,
      sourceType: "meeting_note",
      sourceId: noteId,
      label: "Meeting summary",
      loadPolicy: "always_on",
      text: meeting.note?.summary ?? "",
      loadedByDefault: true,
    }),
    buildPersistedPayloadDraft({
      key: `${meeting.workspaceId}:${meeting.id}:decisions`,
      sourceType: "meeting_note",
      sourceId: noteId,
      label: "Decisions and confirmations",
      loadPolicy: "stage_triggered",
      text: [meeting.note?.keyDecisions, meeting.note?.confirmations].filter(Boolean).join("\n"),
      loadedByDefault: true,
    }),
    buildPersistedPayloadDraft({
      key: `${meeting.workspaceId}:${meeting.id}:transcript`,
      sourceType: "meeting_transcript",
      sourceId: noteId,
      label: "Live transcript",
      loadPolicy: "on_demand",
      text: meeting.note?.liveTranscript ?? "",
      loadedByDefault: false,
    }),
  ].filter((item): item is PersistedPayloadDraft => Boolean(item));
}

function buildArtifactBundlePayloadText(bundle: ArtifactBundle) {
  const parsed = safeParseJson<Record<string, unknown>>(bundle.artifactsJson, {});
  if (bundle.artifactType === "action_pack.md") {
    return trimText(String(parsed.markdown ?? bundle.summary ?? ""), 12000);
  }
  const payload = safeParseJson<Record<string, unknown>>(jsonStringify(parsed.payload ?? parsed), {});
  if (bundle.artifactType === "meeting_facts.json") {
    const facts = safeParseJson<Array<{ content?: string; title?: string }>>(jsonStringify(payload.facts ?? []), []);
    const blockers = safeParseJson<string[]>(jsonStringify(payload.blockers ?? []), []);
    const nextActions = safeParseJson<string[]>(jsonStringify(payload.nextActions ?? []), []);
    const followupDeadlines = safeParseJson<string[]>(jsonStringify(payload.followupDeadlines ?? []), []);
    return trimText(
      [
        facts.map((item) => item.content ?? item.title).filter(Boolean).join("\n"),
        blockers.length > 0 ? `Blockers:\n${blockers.join("\n")}` : null,
        nextActions.length > 0 ? `Next actions:\n${nextActions.join("\n")}` : null,
        followupDeadlines.length > 0 ? `Follow-up deadlines:\n${followupDeadlines.join("\n")}` : null,
      ]
        .filter(Boolean)
        .join("\n\n"),
      12000,
    );
  }
  return trimText(jsonStringify(parsed), 12000);
}

type AdjacentEmailThread = {
  id: string;
  subject: string;
  counterpart: string;
  summary: string | null;
  messages: Array<{
    sender: string;
    snippet: string | null;
    body: string;
    isInbound: boolean;
    sentAt: Date;
  }>;
};

function buildEmailThreadPayloadText(thread: AdjacentEmailThread) {
  const messageLines = [...thread.messages]
    .sort((left, right) => left.sentAt.getTime() - right.sentAt.getTime())
    .slice(-4)
    .map((message) =>
      [
        message.isInbound ? "Inbound" : "Outbound",
        message.sender,
        message.snippet ?? trimText(message.body.replace(/\s+/g, " "), 220),
      ]
        .filter(Boolean)
        .join(": "),
    );

  return trimText(
    [
      `Subject: ${thread.subject}`,
      `Counterpart: ${thread.counterpart}`,
      thread.summary ? `Summary: ${thread.summary}` : null,
      messageLines.length > 0 ? `Recent messages:\n${messageLines.join("\n")}` : null,
    ]
      .filter(Boolean)
      .join("\n\n"),
    12000,
  );
}

function collectAdjacentPayloadDrafts(input: {
  workspaceId: string;
  meeting: MeetingRuntimeUpgradeMeeting;
  artifactBundles?: ArtifactBundle[];
  emailThreads?: AdjacentEmailThread[];
}) {
  return [
    ...(input.artifactBundles ?? []).map((bundle) =>
      buildPersistedPayloadDraft({
        key: `${input.workspaceId}:${input.meeting.id}:artifact:${bundle.id}`,
        sourceType: "artifact",
        sourceId: bundle.id,
        label: `${bundle.artifactType} reference`,
        loadPolicy: "on_demand",
        text: buildArtifactBundlePayloadText(bundle),
        loadedByDefault: false,
      }),
    ),
    ...(input.emailThreads ?? []).map((thread) =>
      buildPersistedPayloadDraft({
        key: `${input.workspaceId}:${input.meeting.id}:email-thread:${thread.id}`,
        sourceType: "email_thread",
        sourceId: thread.id,
        label: `Email thread · ${thread.subject}`,
        loadPolicy: "on_demand",
        text: buildEmailThreadPayloadText(thread),
        loadedByDefault: false,
      }),
    ),
  ].filter((item): item is PersistedPayloadDraft => Boolean(item));
}

async function seedCapabilityCatalog(workspaceId: string) {
  const capabilities = [
    {
      key: `${workspaceId}:token-budget-governor`,
      name: "Token Budget Governor",
      stage: "runtime",
      description: "Keeps context inside a managed token budget and prunes overflow into handles.",
      loadPolicy: "always_on",
    },
    {
      key: `${workspaceId}:verification-agent`,
      name: "Verification Agent",
      stage: "verification",
      description: "Produces source-grounded verification reports before silent trust upgrade.",
      loadPolicy: "stage_triggered",
    },
    {
      key: `${workspaceId}:problem-space-generator`,
      name: "Problem Space Generator",
      stage: "coordination",
      description: "Turns confirmed runtime output into reviewable problem spaces, DRI cues, and edge briefs.",
      loadPolicy: "on_demand",
    },
    {
      key: `${workspaceId}:handoff-bus`,
      name: "Handoff Bus",
      stage: "coordination",
      description: "Logs explicit lead-to-worker and worker-to-worker handoff packets instead of relying on hidden conversational carry-over.",
      loadPolicy: "stage_triggered",
    },
    {
      key: `${workspaceId}:coordination-metrics`,
      name: "Coordination Metrics",
      stage: "coordination",
      description: "Keeps action-ready, review-needed, waiting, and capability-gap telemetry visible at the workspace level.",
      loadPolicy: "always_on",
    },
  ];

  for (const capability of capabilities) {
    await db.capabilityCatalogEntry.upsert({
      where: { capabilityKey: capability.key },
      update: {
        name: capability.name,
        stage: capability.stage,
        description: capability.description,
        loadPolicy: capability.loadPolicy,
        reviewRequired: true,
        boundaryNote: RUNTIME_BOUNDARY_NOTE,
      },
      create: {
        workspaceId,
        capabilityKey: capability.key,
        name: capability.name,
        stage: capability.stage,
        description: capability.description,
        loadPolicy: capability.loadPolicy,
        reviewRequired: true,
        boundaryNote: RUNTIME_BOUNDARY_NOTE,
      },
    });
  }
}

async function ensureRuntimeSession(input: {
  workspaceId: string;
  runtimeEventId: string;
  meeting: MeetingRuntimeUpgradeMeeting;
  sourcePage?: string;
  stage: string;
}) {
  const sessionKey = `${input.workspaceId}:runtime-session:${input.runtimeEventId}`;
  return db.runtimeSession.upsert({
    where: { sessionKey },
    update: {
      currentStage: input.stage,
      sourcePage: input.sourcePage ?? `/meetings/${input.meeting.id}`,
      boundaryNote: RUNTIME_BOUNDARY_NOTE,
      status: "ACTIVE",
    },
    create: {
      workspaceId: input.workspaceId,
      runtimeEventId: input.runtimeEventId,
      meetingId: input.meeting.id,
      opportunityId: input.meeting.opportunityId ?? undefined,
      companyId: input.meeting.companyId ?? undefined,
      sessionKey,
      label: `${input.meeting.title} runtime session`,
      status: "ACTIVE",
      currentStage: input.stage,
      sourcePage: input.sourcePage ?? `/meetings/${input.meeting.id}`,
      boundaryNote: RUNTIME_BOUNDARY_NOTE,
      budgetTokenLimit: DEFAULT_TOKEN_BUDGET,
      replayableEventLog: jsonStringify([{ stage: input.stage, at: new Date().toISOString() }]),
    },
  });
}

async function createRuntimeUpgradeEvent(input: {
  workspaceId: string;
  meetingId?: string | null;
  opportunityId?: string | null;
  companyId?: string | null;
  relatedObjectType: string;
  relatedObjectId: string;
  eventType: string;
  payload?: Record<string, unknown>;
  trustedContext?: Record<string, unknown>;
  untrustedContext?: Record<string, unknown>;
  sourceProvenance?: Array<Record<string, unknown>>;
  triggeredBy: string;
}) {
  const now = new Date();
  const event = await db.runtimeEvent.create({
    data: {
      workspaceId: input.workspaceId,
      meetingId: input.meetingId ?? undefined,
      opportunityId: input.opportunityId ?? undefined,
      companyId: input.companyId ?? undefined,
      relatedObjectType: input.relatedObjectType,
      relatedObjectId: input.relatedObjectId,
      eventType: input.eventType,
      status: RuntimeEventStatus.COMPLETED,
      trustedContext: input.trustedContext ? jsonStringify(input.trustedContext) : null,
      untrustedContext: input.untrustedContext ? jsonStringify(input.untrustedContext) : null,
      payload: input.payload ? jsonStringify(input.payload) : null,
      sourceProvenance: input.sourceProvenance ? jsonStringify(input.sourceProvenance) : null,
      triggeredBy: input.triggeredBy,
      startedAt: now,
      completedAt: now,
    },
  });
  if (
    input.relatedObjectType === "RuntimeSession" &&
    isRuntimeSessionControlPlaneLifecycleEventType(input.eventType)
  ) {
    await persistRuntimeSessionControlPlaneLifecycleSnapshot({
      workspaceId: input.workspaceId,
      sessionId: input.relatedObjectId,
      refreshReason: "control_event",
      refreshSource: input.eventType,
    });
  }
  return event;
}

function buildNotebookPersistenceFromContinuitySnapshot(snapshot: RuntimeContinuitySnapshot) {
  return {
    sessionSummary: trimText(
      [
        `Objective: ${snapshot.objective}.`,
        snapshot.confirmedFacts.length > 0 ? `Confirmed facts: ${snapshot.confirmedFacts.slice(0, 2).join(" / ")}.` : null,
        snapshot.blockers.length > 0 ? `Blockers: ${snapshot.blockers.slice(0, 2).join(" / ")}.` : null,
        `Review posture: ${snapshot.reviewState}.`,
      ]
        .filter(Boolean)
        .join(" "),
      420,
    ),
    decisionSummary: snapshot.decisions.join("；") || null,
    blockerSummary: snapshot.blockers.join("；") || null,
    pendingQuestions: jsonStringify(snapshot.openQuestions),
    openLoopSummary: snapshot.nextActions.join("；") || snapshot.objective,
    boundaryNote: snapshot.boundaryNote,
  };
}

async function buildRuntimeReflectionPayload(input: {
  workspaceId: string;
  runtimeSessionId: string;
  trigger: "manual_operator_queue" | "meeting_human_confirmed";
}) {
  const session = await db.runtimeSession.findFirst({
    where: {
      workspaceId: input.workspaceId,
      id: input.runtimeSessionId,
    },
    include: {
      notebook: true,
      checkpoints: {
        orderBy: { updatedAt: "desc" },
        take: 1,
      },
      persistedPayloads: {
        select: {
          handle: true,
        },
      },
      contextEditEvents: {
        orderBy: { createdAt: "asc" },
        select: {
          removedHandles: true,
          createdAt: true,
        },
      },
      verificationReports: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      truthConflicts: {
        orderBy: { createdAt: "desc" },
      },
      problemSpaces: {
        orderBy: { updatedAt: "desc" },
        take: 4,
      },
      memoryCandidates: {
        orderBy: { createdAt: "desc" },
        take: 12,
      },
      memoryPromotions: {
        orderBy: { createdAt: "desc" },
        take: 12,
      },
    },
  });
  if (!session) {
    throw new Error("No runtime session found for reflection.");
  }

  const [meeting, opportunity, company] = await Promise.all([
    session.meetingId
      ? db.meeting.findFirst({
          where: {
            workspaceId: input.workspaceId,
            id: session.meetingId,
          },
          select: {
            id: true,
            title: true,
          },
        })
      : null,
    session.opportunityId
      ? db.opportunity.findFirst({
          where: {
            workspaceId: input.workspaceId,
            id: session.opportunityId,
          },
          select: {
            id: true,
            title: true,
          },
        })
      : null,
    session.companyId
      ? db.company.findFirst({
          where: {
            workspaceId: input.workspaceId,
            id: session.companyId,
          },
          select: {
            id: true,
            name: true,
          },
        })
      : null,
  ]);

  const activeCheckpoint = selectRuntimeContinuityCheckpoint(session.checkpoints, session.resumedFromKey);
  const budgetPosture = buildBudgetPosture({
    budgetTokenLimit: session.budgetTokenLimit,
    budgetTokenUsed: session.budgetTokenUsed,
    prunedTokenCount: session.prunedTokenCount,
    latestCheckpointStatus: activeCheckpoint?.status,
  });
  const payloadState = buildRuntimePayloadHandleState({
    persistedHandles: session.persistedPayloads.map((item) => item.handle),
    latestCheckpoint: activeCheckpoint
      ? {
          snapshotJson: activeCheckpoint.snapshotJson,
          updatedAt: activeCheckpoint.updatedAt,
        }
      : null,
    edits: session.contextEditEvents,
  });
  const notebookState = buildRuntimeNotebookState({
    sessionLabel: session.label,
    sessionStatus: session.status,
    boundaryNote: session.boundaryNote,
    meetingLabel: meeting?.title ?? null,
    opportunityLabel: opportunity?.title ?? null,
    companyLabel: company?.name ?? null,
    notebook: session.notebook
      ? {
          sessionSummary: session.notebook.sessionSummary,
          decisionSummary: session.notebook.decisionSummary,
          blockerSummary: session.notebook.blockerSummary,
          pendingQuestions: session.notebook.pendingQuestions,
          openLoopSummary: session.notebook.openLoopSummary,
          boundaryNote: session.notebook.boundaryNote,
        }
      : null,
    verification: session.verificationReports[0]
      ? {
          status: session.verificationReports[0].status.toLowerCase(),
          blockedReasons: parseRuntimeStringList(session.verificationReports[0].blockedReasons),
        }
      : null,
    problemSpaces: session.problemSpaces.map((item) => ({
      title: item.title,
      nextStep: item.nextStep,
      status: item.status,
      ownerHint: item.ownerHint,
      evidenceRefs: parseRuntimeStringList(item.evidenceRefs),
    })),
    promotedFacts: buildPromotedRuntimeFacts(session.memoryCandidates, session.memoryPromotions),
    truthConflicts: (session.truthConflicts ?? []).map((item) => ({
      status: item.status,
      summary: item.summary,
    })),
  });

  const continuitySnapshot: RuntimeContinuitySnapshot = {
    ...notebookState,
    budgetState: budgetPosture.state,
    loadedHandles: payloadState.activeHandles,
    prunedHandles: payloadState.prunedHandles,
  };

  return {
    session,
    meeting,
    opportunity,
    company,
    notebookState,
    notebookPersistence: buildNotebookPersistenceFromContinuitySnapshot(continuitySnapshot),
    memoryCandidatePersistence: buildReflectionMemoryCandidateContract({
      meetingLabel: meeting?.title ?? session.label,
      notebookState,
    }),
    inputSummary: buildReflectionJobInputSummary({
      sessionLabel: session.label,
      trigger: input.trigger,
    }),
    outputSummary: buildReflectionJobOutputSummary({
      meetingLabel: meeting?.title ?? session.label,
      notebookState,
    }),
  };
}

async function queueReflectionJobForRuntimeSession(input: {
  workspaceId: string;
  runtimeSessionId: string;
  trigger: "manual_operator_queue" | "meeting_human_confirmed";
}) {
  const reflection = await buildRuntimeReflectionPayload(input);
  const jobType = "meeting_reflection";
  const jobKey = `${input.workspaceId}:reflection:${reflection.session.id}:${input.trigger}`;

  const notebook = await db.sessionNotebook.upsert({
    where: { runtimeSessionId: reflection.session.id },
    update: reflection.notebookPersistence,
    create: {
      workspaceId: input.workspaceId,
      runtimeSessionId: reflection.session.id,
      ...reflection.notebookPersistence,
    },
  });
  const reflectionCandidateKey = `${input.workspaceId}:memory-candidate:reflection:${reflection.session.id}`;
  const existingReflectionCandidate = await db.memoryCandidate.findUnique({
    where: { candidateKey: reflectionCandidateKey },
    select: { id: true },
  });
  const reflectionCandidate = existingReflectionCandidate
    ? await db.memoryCandidate.update({
        where: { id: existingReflectionCandidate.id },
        data: {
          runtimeEventId: null,
          meetingId: reflection.session.meetingId ?? undefined,
          memoryItemId: undefined,
          artifactBundleId: undefined,
          summary: reflection.memoryCandidatePersistence.summary,
          sourceVerification: reflection.memoryCandidatePersistence.sourceVerification,
          sourceStatus: reflection.memoryCandidatePersistence.sourceStatus,
          status: reflection.memoryCandidatePersistence.status,
          reviewerNote: reflection.memoryCandidatePersistence.reviewerNote,
          evidenceRefs: reflection.memoryCandidatePersistence.evidenceRefs,
          confidence: reflection.memoryCandidatePersistence.confidence,
        },
      })
    : await db.memoryCandidate.create({
        data: {
          workspaceId: input.workspaceId,
          runtimeSessionId: reflection.session.id,
          meetingId: reflection.session.meetingId ?? undefined,
          candidateKey: reflectionCandidateKey,
          summary: reflection.memoryCandidatePersistence.summary,
          sourceVerification: reflection.memoryCandidatePersistence.sourceVerification,
          sourceStatus: reflection.memoryCandidatePersistence.sourceStatus,
          status: reflection.memoryCandidatePersistence.status,
          reviewerNote: reflection.memoryCandidatePersistence.reviewerNote,
          evidenceRefs: reflection.memoryCandidatePersistence.evidenceRefs,
          confidence: reflection.memoryCandidatePersistence.confidence,
        },
      });

  const job = await db.consolidationJob.upsert({
    where: { jobKey },
    update: {
      status: "QUEUED",
      inputSummary: reflection.inputSummary,
      outputSummary: reflection.outputSummary,
      reviewPosture: REFLECTION_BOUNDARY_NOTE,
      pausedAt: null,
      completedAt: null,
    },
    create: {
      workspaceId: input.workspaceId,
      runtimeSessionId: reflection.session.id,
      jobKey,
      jobType,
      status: "QUEUED",
      inputSummary: reflection.inputSummary,
      outputSummary: reflection.outputSummary,
      reviewPosture: REFLECTION_BOUNDARY_NOTE,
    },
  });
  await createRuntimeUpgradeEvent({
    workspaceId: input.workspaceId,
    meetingId: reflection.session.meetingId ?? null,
    opportunityId: reflection.session.opportunityId ?? null,
    companyId: reflection.session.companyId ?? null,
    relatedObjectType: "MemoryCandidate",
    relatedObjectId: reflectionCandidate.id,
    eventType: existingReflectionCandidate ? "memory-candidate.refreshed" : "memory-candidate.created",
    payload: {
      status: reflectionCandidate.status,
      source: "reflection",
      candidateKey: reflectionCandidateKey,
    },
    trustedContext: {
      runtimeSessionId: reflection.session.id,
    },
    triggeredBy: "helm-core",
  });

  await createRuntimeUpgradeEvent({
    workspaceId: input.workspaceId,
    meetingId: reflection.session.meetingId ?? null,
    opportunityId: reflection.session.opportunityId ?? null,
    companyId: reflection.session.companyId ?? null,
    relatedObjectType: "SessionNotebook",
    relatedObjectId: notebook.id,
    eventType: "session-notebook.updated",
    payload: {
      summary: notebook.sessionSummary,
      blockerSummary: notebook.blockerSummary,
      source: "reflection",
      trigger: input.trigger,
    },
    trustedContext: {
      runtimeSessionId: reflection.session.id,
    },
    triggeredBy: "helm-core",
  });

  await createRuntimeUpgradeEvent({
    workspaceId: input.workspaceId,
    meetingId: reflection.session.meetingId ?? null,
    opportunityId: reflection.session.opportunityId ?? null,
    companyId: reflection.session.companyId ?? null,
    relatedObjectType: "ConsolidationJob",
    relatedObjectId: job.id,
    eventType: `${buildRuntimeJobEventPrefix(job.jobType)}.proposed`,
    payload: {
      status: job.status,
      jobType: job.jobType,
      trigger: input.trigger,
      candidateId: reflectionCandidate.id,
      source: input.trigger === "manual_operator_queue" ? "manual_operator_queue" : "human_confirmed_review",
    },
    trustedContext: {
      runtimeSessionId: reflection.session.id,
    },
    triggeredBy: "helm-core",
  });

  await refreshRuntimeCoordinationMetrics(input.workspaceId);

  return job;
}

async function createContinuityRecoveryCheckpoint(input: {
  workspaceId: string;
  runtimeSessionId: string;
  label: string;
  summary: string;
  continuitySnapshot: RuntimeContinuitySnapshot;
  tokenCount: number;
}) {
  const checkpointKey = `${input.workspaceId}:checkpoint:${input.runtimeSessionId}:${input.label}:${Date.now().toString(36)}:${crypto
    .randomUUID()
    .slice(0, 8)}`;
  const checkpoint = await db.sessionCheckpoint.create({
    data: {
      workspaceId: input.workspaceId,
      runtimeSessionId: input.runtimeSessionId,
      checkpointKey,
      label: input.label,
      status: "READY",
      summary: input.summary,
      snapshotJson: jsonStringify({
        continuityState: input.continuitySnapshot,
      }),
      tokenCount: input.tokenCount,
    },
  });
  await persistRuntimeSessionControlPlaneLifecycleSnapshot({
    workspaceId: input.workspaceId,
    sessionId: input.runtimeSessionId,
    refreshReason: "continuity_checkpoint",
    refreshSource: input.label,
  });
  return checkpoint;
}

async function recordArtifactVersions(input: {
  workspaceId: string;
  artifactBundles: ArtifactBundle[];
}) {
  for (const bundle of input.artifactBundles) {
    const existingCount = await db.artifactVersion.count({
      where: {
        workspaceId: input.workspaceId,
        artifactBundleId: bundle.id,
      },
    });
    const versionNumber = existingCount + 1;
    const versionKey = `${input.workspaceId}:artifact-version:${bundle.id}:${versionNumber}`;
    await db.artifactVersion.upsert({
      where: { versionKey },
      update: {
        artifactType: bundle.artifactType,
        reviewPosture: bundle.reviewPosture,
        snapshotJson: bundle.artifactsJson,
      },
      create: {
        workspaceId: input.workspaceId,
        artifactBundleId: bundle.id,
        versionKey,
        versionNumber,
        artifactType: bundle.artifactType,
        reviewPosture: bundle.reviewPosture,
        snapshotJson: bundle.artifactsJson,
      },
    });
  }
}

export async function syncMeetingRuntimeUpgradeIngest(input: {
  workspaceId: string;
  runtimeEventId: string;
  meeting: MeetingRuntimeUpgradeMeeting;
  sourcePage?: string;
  artifactBundles?: ArtifactBundle[];
}) {
  await seedCapabilityCatalog(input.workspaceId);
  const session = await ensureRuntimeSession({
    workspaceId: input.workspaceId,
    runtimeEventId: input.runtimeEventId,
    meeting: input.meeting,
    sourcePage: input.sourcePage,
    stage: "meeting_ingest",
  });

  const emailThreadScopes: Array<{ opportunityId: string } | { companyId: string }> = [];
  if (input.meeting.opportunityId) emailThreadScopes.push({ opportunityId: input.meeting.opportunityId });
  if (input.meeting.companyId) emailThreadScopes.push({ companyId: input.meeting.companyId });
  const adjacentEmailThreads = emailThreadScopes.length
    ? await db.emailThread.findMany({
        where: {
          workspaceId: input.workspaceId,
          OR: emailThreadScopes,
        },
        include: {
          messages: {
            orderBy: { sentAt: "desc" },
            take: 4,
          },
        },
        orderBy: { updatedAt: "desc" },
        take: 2,
      })
    : [];

  const payloadDrafts = [
    ...collectMeetingPayloadDrafts(input.meeting),
    ...collectAdjacentPayloadDrafts({
      workspaceId: input.workspaceId,
      meeting: input.meeting,
      artifactBundles: input.artifactBundles,
      emailThreads: adjacentEmailThreads.map((thread) => ({
        id: thread.id,
        subject: thread.subject,
        counterpart: thread.counterpart,
        summary: thread.summary,
        messages: thread.messages.map((message) => ({
          sender: message.sender,
          snippet: message.snippet,
          body: message.body,
          isInbound: message.isInbound,
          sentAt: message.sentAt,
        })),
      })),
    }),
  ];
  const payloads = payloadDrafts.map(toPersistedPayloadContract);
  const payloadTextByKey = new Map(payloadDrafts.map((item) => [item.payloadKey, item.text]));
  const decision = selectPayloadsForBudget(payloads, session.budgetTokenLimit);
  const budgetPosture = buildBudgetPosture({
    budgetTokenLimit: session.budgetTokenLimit,
    budgetTokenUsed: decision.tokenBudgetUsed,
    prunedTokenCount: decision.prunedTokenCount,
  });

  for (const payload of payloads) {
    await db.persistedPayload.upsert({
      where: { payloadKey: payload.payloadKey },
      update: {
        preview: payload.preview,
        summary: payload.summary,
        payloadText: payloadTextByKey.get(payload.payloadKey) ?? null,
        byteSize: payload.byteSize,
        estimatedTokens: payload.estimatedTokens,
        loadedByDefault: payload.loadedByDefault,
        loadPolicy: payload.loadPolicy,
        label: payload.label,
      },
      create: {
        workspaceId: input.workspaceId,
        runtimeSessionId: session.id,
        runtimeEventId: input.runtimeEventId,
        meetingId: input.meeting.id,
        opportunityId: input.meeting.opportunityId ?? undefined,
        companyId: input.meeting.companyId ?? undefined,
        payloadKey: payload.payloadKey,
        sourceType: payload.sourceType,
        sourceId: payload.sourceId,
        loadPolicy: payload.loadPolicy,
        label: payload.label,
        handle: payload.handle,
        preview: payload.preview,
        summary: payload.summary,
        payloadText: payloadTextByKey.get(payload.payloadKey) ?? null,
        byteSize: payload.byteSize,
        estimatedTokens: payload.estimatedTokens,
        loadedByDefault: payload.loadedByDefault,
      },
    });
  }

  if (decision.prunedHandles.length > 0) {
    const editKey = `${input.workspaceId}:context-edit:${session.id}:meeting_ingest:${Date.now().toString(36)}:${crypto
      .randomUUID()
      .slice(0, 8)}`;
    const prunedPayloads = payloads.filter((item) => decision.prunedHandles.includes(item.handle));
    await db.contextEditEvent.create({
      data: {
        workspaceId: input.workspaceId,
        runtimeSessionId: session.id,
        editKey,
        strategy: "token_budget_governor",
        beforeTokenCount: payloads.reduce((sum, item) => sum + item.estimatedTokens, 0),
        afterTokenCount: decision.tokenBudgetUsed,
        removedHandles: jsonStringify(decision.prunedHandles),
        removedSummary: trimText(
          [
            `Pruned ${decision.prunedHandles.length} bulky payload handle(s) to stay under the current meeting ingest token budget.`,
            prunedPayloads.length > 0
              ? `Externalized: ${prunedPayloads.map((item) => `${item.label} (${item.summary})`).slice(0, 2).join(" / ")}.`
              : null,
            "Boundary note, current objective, and review posture remain protected in notebook/checkpoint state.",
          ]
            .filter(Boolean)
            .join(" "),
          400,
        ),
        boundaryNote: RUNTIME_BOUNDARY_NOTE,
      },
    });
  }

  const continuitySnapshot = buildContinuitySnapshot({
    sessionLabel: session.label,
    sessionStatus: "AWAITING_REVIEW",
    boundaryNote: RUNTIME_BOUNDARY_NOTE,
    meetingLabel: input.meeting.title,
    opportunityLabel: input.meeting.opportunity?.title,
    companyLabel: input.meeting.company?.name,
    notebook: {
      sessionSummary: input.meeting.note?.summary ?? `Meeting runtime session for ${input.meeting.title} is active.`,
      decisionSummary: trimText(input.meeting.note?.keyDecisions ?? "", 220) || null,
      blockerSummary: null,
      pendingQuestions: jsonStringify([]),
      openLoopSummary: input.meeting.opportunity?.nextAction ?? `Review ${input.meeting.title} and confirm what is safe to carry forward.`,
      boundaryNote: RUNTIME_BOUNDARY_NOTE,
    },
    verification: null,
    problemSpaces: [],
    promotedFacts: [],
    truthConflicts: [],
    budgetPosture,
    loadedHandles: decision.loadedHandles,
    prunedHandles: decision.prunedHandles,
  });

  const notebookSummary = trimText(
    [
      `Objective: ${continuitySnapshot.objective}.`,
      continuitySnapshot.relevantObjects.length > 0 ? `Relevant objects: ${continuitySnapshot.relevantObjects.join(" / ")}.` : null,
      continuitySnapshot.decisions.length > 0 ? `Decisions: ${continuitySnapshot.decisions.join(" / ")}.` : null,
      `Review posture: ${continuitySnapshot.reviewState}.`,
    ]
      .filter(Boolean)
      .join(" "),
    500,
  );

  await db.sessionNotebook.upsert({
    where: { runtimeSessionId: session.id },
    update: {
      sessionSummary: notebookSummary,
      decisionSummary: continuitySnapshot.decisions.join("；") || null,
      blockerSummary: continuitySnapshot.blockers.join("；") || null,
      pendingQuestions: jsonStringify(continuitySnapshot.openQuestions),
      openLoopSummary: continuitySnapshot.objective,
      boundaryNote: RUNTIME_BOUNDARY_NOTE,
    },
    create: {
      workspaceId: input.workspaceId,
      runtimeSessionId: session.id,
      sessionSummary: notebookSummary,
      decisionSummary: continuitySnapshot.decisions.join("；") || null,
      blockerSummary: continuitySnapshot.blockers.join("；") || null,
      pendingQuestions: jsonStringify(continuitySnapshot.openQuestions),
      openLoopSummary: continuitySnapshot.objective,
      boundaryNote: RUNTIME_BOUNDARY_NOTE,
    },
  });

  const checkpointKey = `${input.workspaceId}:checkpoint:${input.runtimeEventId}:meeting_ingest`;
  const checkpoint = await db.sessionCheckpoint.upsert({
    where: { checkpointKey },
    update: {
      label: "meeting_ingest",
      status: "READY",
      summary: `${budgetPosture.state}: initial runtime ingest completed with selective context loading and persisted payload handles.`,
      snapshotJson: jsonStringify({
        continuityState: continuitySnapshot,
        budgetPosture,
        loadedHandles: decision.loadedHandles,
        prunedHandles: decision.prunedHandles,
      }),
      tokenCount: decision.tokenBudgetUsed,
    },
    create: {
      workspaceId: input.workspaceId,
      runtimeSessionId: session.id,
      checkpointKey,
      label: "meeting_ingest",
      status: "READY",
      summary: `${budgetPosture.state}: initial runtime ingest completed with selective context loading and persisted payload handles.`,
      snapshotJson: jsonStringify({
        continuityState: continuitySnapshot,
        budgetPosture,
        loadedHandles: decision.loadedHandles,
        prunedHandles: decision.prunedHandles,
      }),
      tokenCount: decision.tokenBudgetUsed,
    },
  });

  const cacheKey = `${input.workspaceId}:cache:${input.runtimeEventId}:meeting_ingest`;
  const notebook = await db.sessionNotebook.findUnique({
    where: { runtimeSessionId: session.id },
  });

  await db.promptCacheTelemetry.upsert({
    where: { cacheKey },
    update: {
      promptLabel: "meeting_ingest",
      cacheStatus: decision.prunedHandles.length > 0 ? "partial" : "hit",
      tokensBefore: payloads.reduce((sum, item) => sum + item.estimatedTokens, 0),
      tokensAfter: decision.tokenBudgetUsed,
      tokensSaved: Math.max(0, payloads.reduce((sum, item) => sum + item.estimatedTokens, 0) - decision.tokenBudgetUsed),
    },
    create: {
      workspaceId: input.workspaceId,
      runtimeSessionId: session.id,
      cacheKey,
      promptLabel: "meeting_ingest",
      cacheStatus: decision.prunedHandles.length > 0 ? "partial" : "hit",
      tokensBefore: payloads.reduce((sum, item) => sum + item.estimatedTokens, 0),
      tokensAfter: decision.tokenBudgetUsed,
      tokensSaved: Math.max(0, payloads.reduce((sum, item) => sum + item.estimatedTokens, 0) - decision.tokenBudgetUsed),
    },
  });

  await db.runtimeSession.update({
    where: { id: session.id },
    data: {
      status: "AWAITING_REVIEW",
      budgetTokenUsed: decision.tokenBudgetUsed,
      loadedTokenCount: decision.tokenBudgetUsed,
      prunedTokenCount: decision.prunedTokenCount,
      replayableEventLog: jsonStringify([
        {
          stage: "meeting_ingest",
          at: new Date().toISOString(),
          loadedHandles: decision.loadedHandles,
          budgetPosture: budgetPosture.state,
          objective: continuitySnapshot.objective,
        },
      ]),
    },
  });
  await persistRuntimeSessionControlPlaneLifecycleSnapshot({
    workspaceId: input.workspaceId,
    sessionId: session.id,
    refreshReason: "meeting_ingest",
    refreshSource: "meeting_ingest",
  });

  await db.signalEvent.upsert({
    where: { signalKey: `${input.workspaceId}:signal:${input.runtimeEventId}:meeting_ingest` },
    update: {
      signalSummary: `Meeting ingest for ${input.meeting.title} persisted ${payloads.length} payload handles.`,
      normalizedPayload: jsonStringify(decision),
      truthWeight: 70,
    },
    create: {
      workspaceId: input.workspaceId,
      runtimeSessionId: session.id,
      meetingId: input.meeting.id,
      opportunityId: input.meeting.opportunityId ?? undefined,
      companyId: input.meeting.companyId ?? undefined,
      signalKey: `${input.workspaceId}:signal:${input.runtimeEventId}:meeting_ingest`,
      signalType: "meeting_ingest",
      sourceType: "meeting_note",
      signalSummary: `Meeting ingest for ${input.meeting.title} persisted ${payloads.length} payload handles.`,
      normalizedPayload: jsonStringify(decision),
      truthWeight: 70,
    },
  });

  if (input.artifactBundles?.length) {
    await recordArtifactVersions({
      workspaceId: input.workspaceId,
      artifactBundles: input.artifactBundles,
    });
  }

  await createRuntimeUpgradeEvent({
    workspaceId: input.workspaceId,
    meetingId: input.meeting.id,
    opportunityId: input.meeting.opportunityId,
    companyId: input.meeting.companyId,
    relatedObjectType: "RuntimeSession",
    relatedObjectId: session.id,
    eventType: "meeting-ended.ingest",
    payload: {
      runtimeEventId: input.runtimeEventId,
      sessionId: session.id,
      payloadCount: payloads.length,
      loadedHandles: decision.loadedHandles.length,
      prunedHandles: decision.prunedHandles.length,
    },
    trustedContext: {
      sessionId: session.id,
      checkpointId: checkpoint.id,
      notebookId: notebook?.id ?? null,
    },
    sourceProvenance: [{ type: "runtime_session", id: session.id }],
    triggeredBy: "helm-core",
  });
  await createRuntimeUpgradeEvent({
    workspaceId: input.workspaceId,
    meetingId: input.meeting.id,
    opportunityId: input.meeting.opportunityId,
    companyId: input.meeting.companyId,
    relatedObjectType: "SessionCheckpoint",
    relatedObjectId: checkpoint.id,
    eventType: "session-checkpoint.created",
    payload: {
      label: checkpoint.label,
      tokenCount: checkpoint.tokenCount,
    },
    trustedContext: {
      runtimeSessionId: session.id,
    },
    triggeredBy: "helm-core",
  });
  await createRuntimeUpgradeEvent({
    workspaceId: input.workspaceId,
    meetingId: input.meeting.id,
    opportunityId: input.meeting.opportunityId,
    companyId: input.meeting.companyId,
    relatedObjectType: "SignalEvent",
    relatedObjectId: session.id,
    eventType: "signal.ingested",
    payload: {
      signalType: "meeting_ingest",
      truthWeight: 70,
    },
    trustedContext: {
      runtimeSessionId: session.id,
    },
    triggeredBy: "helm-core",
  });
  if (notebook) {
    await createRuntimeUpgradeEvent({
      workspaceId: input.workspaceId,
      meetingId: input.meeting.id,
      opportunityId: input.meeting.opportunityId,
      companyId: input.meeting.companyId,
      relatedObjectType: "SessionNotebook",
      relatedObjectId: notebook.id,
      eventType: "session-notebook.updated",
      payload: {
        summary: notebook.sessionSummary,
      },
      trustedContext: {
        runtimeSessionId: session.id,
      },
      triggeredBy: "helm-core",
    });
  }
  if (input.artifactBundles?.length) {
    await createRuntimeUpgradeEvent({
      workspaceId: input.workspaceId,
      meetingId: input.meeting.id,
      opportunityId: input.meeting.opportunityId,
      companyId: input.meeting.companyId,
      relatedObjectType: "ArtifactBundle",
      relatedObjectId: input.artifactBundles[0].id,
      eventType: "meeting-artifact.persisted",
      payload: {
        artifactBundleIds: input.artifactBundles.map((item) => item.id),
        artifactCount: input.artifactBundles.length,
      },
      trustedContext: {
        runtimeSessionId: session.id,
      },
      triggeredBy: "helm-core",
    });
  }

  await refreshRuntimeCoordinationMetrics(input.workspaceId);

  return getMeetingRuntimeUpgradeSummary(input.workspaceId, input.meeting.id);
}

export async function syncMeetingRuntimeUpgradeReview(input: {
  workspaceId: string;
  runtimeEventId: string;
  meeting: MeetingRuntimeUpgradeMeeting;
  reviewMode: "confirm" | "edit_confirm" | "reject" | "keep_draft";
  factsBundle: ArtifactBundle;
  riskBundle: ArtifactBundle | null;
  actionPackBundle: ArtifactBundle;
  memoryItems: MemoryItem[];
  reviewedAt: Date;
  reviewerId?: string | null;
  reviewerName: string;
  sourcePage?: string | null;
}) {
  const session = await ensureRuntimeSession({
    workspaceId: input.workspaceId,
    runtimeEventId: input.runtimeEventId,
    meeting: input.meeting,
    stage: input.reviewMode === "reject" ? "review_rejected" : "review_confirmed",
  });

  const factsPayload = safeParseJson<Record<string, unknown>>(input.factsBundle.artifactsJson, {});
  const facts = safeParseJson<Array<{ title?: string; content?: string; evidence?: string[] }>>(
    jsonStringify((factsPayload.payload as Record<string, unknown> | undefined)?.facts ?? []),
    [],
  );
  const decisions = safeParseJson<string[]>(
    jsonStringify((factsPayload.payload as Record<string, unknown> | undefined)?.decisions ?? []),
    [],
  );
  const blockers = safeParseJson<string[]>(
    jsonStringify((factsPayload.payload as Record<string, unknown> | undefined)?.blockers ?? []),
    [],
  );
  const nextActions = safeParseJson<string[]>(
    jsonStringify((factsPayload.payload as Record<string, unknown> | undefined)?.nextActions ?? []),
    [],
  );
  const ownerMap = safeParseJson<Array<{ owner?: string; action?: string }>>(
    jsonStringify((factsPayload.payload as Record<string, unknown> | undefined)?.ownerMap ?? []),
    [],
  );
  const followupDeadlines = safeParseJson<string[]>(
    jsonStringify((factsPayload.payload as Record<string, unknown> | undefined)?.followupDeadlines ?? []),
    [],
  );
  const inferred = safeParseJson<Array<Record<string, unknown>>>(
    jsonStringify((factsPayload.payload as Record<string, unknown> | undefined)?.inferred ?? []),
    [],
  );
  const riskPayload = safeParseJson<Record<string, unknown>>(input.riskBundle?.artifactsJson, {});
  const riskFlags = safeParseJson<Array<{ severity?: "low" | "medium" | "high"; promiseRisk?: boolean; reason?: string }>>(
    jsonStringify((riskPayload.payload as Record<string, unknown> | undefined)?.flags ?? []),
    [],
  );
  const actionPackPayload = safeParseJson<Record<string, unknown>>(input.actionPackBundle.artifactsJson, {});
  const recommendedNextAction = String(actionPackPayload.recommendedNextAction ?? "");
  const promotedMemory = input.memoryItems.filter((item) => item.status === MemoryItemStatus.PROMOTED);
  const budgetPosture = buildBudgetPosture({
    budgetTokenLimit: session.budgetTokenLimit,
    budgetTokenUsed: session.budgetTokenUsed,
    prunedTokenCount: session.prunedTokenCount,
  });

  const verification = buildVerificationDecision({
    facts,
    inferredCount: inferred.length,
    riskFlags,
    promotedMemoryCount: promotedMemory.length,
  });
  const conflictNeeded = verification.status !== "passed" || riskFlags.some((item) => item.promiseRisk);

  const reportKey = `${input.workspaceId}:verification:${input.runtimeEventId}:meeting_review`;
  const verificationReport = await db.verificationReport.upsert({
    where: { reportKey },
    update: {
      runtimeEventId: input.runtimeEventId,
      artifactBundleId: input.actionPackBundle.id,
      reportType: "meeting_review",
      status:
        verification.status === "passed" ? "PASSED" : verification.status === "blocked" ? "BLOCKED" : "NEEDS_REVIEW",
      truthScore: verification.truthScore,
      summary: verification.summary,
      blockedReasons: jsonStringify(verification.blockedReasons),
      boundaryNotes: jsonStringify(verification.boundaryNotes),
      evidenceRefs: jsonStringify(facts.flatMap((fact) => fact.evidence ?? [])),
    },
    create: {
      workspaceId: input.workspaceId,
      runtimeSessionId: session.id,
      runtimeEventId: input.runtimeEventId,
      artifactBundleId: input.actionPackBundle.id,
      reportKey,
      reportType: "meeting_review",
      status:
        verification.status === "passed" ? "PASSED" : verification.status === "blocked" ? "BLOCKED" : "NEEDS_REVIEW",
      truthScore: verification.truthScore,
      summary: verification.summary,
      blockedReasons: jsonStringify(verification.blockedReasons),
      boundaryNotes: jsonStringify(verification.boundaryNotes),
      evidenceRefs: jsonStringify(facts.flatMap((fact) => fact.evidence ?? [])),
    },
  });
  if (verification.status !== "passed") {
    await createRuntimeUpgradeEvent({
      workspaceId: input.workspaceId,
      meetingId: input.meeting.id,
      opportunityId: input.meeting.opportunityId,
      companyId: input.meeting.companyId,
      relatedObjectType: "VerificationReport",
      relatedObjectId: verificationReport.id,
      eventType: "verification.failed",
      payload: {
        truthScore: verification.truthScore,
        blockedReasons: verification.blockedReasons,
      },
      trustedContext: {
        runtimeSessionId: session.id,
      },
      triggeredBy: "verification-agent",
    });
  }

  const createdCandidateIds: string[] = [];
  const promotedCandidateIds: string[] = [];
  const continuityCandidates: Array<{
    id: string;
    status: string;
    summary: string;
    evidenceRefs: string | null;
  }> = [];
  const continuityPromotions: Array<{
    memoryCandidateId: string;
    status: string;
  }> = [];
  for (const item of input.memoryItems) {
    const candidateKey = `${input.workspaceId}:memory-candidate:${item.id}`;
    const candidateStatus = deriveVerifiedMemoryCandidateDisposition({
      reviewMode: input.reviewMode,
      sourceStatus: item.status,
      sourceVerification: item.verification,
      verificationStatus: verification.status,
      hasTruthConflict: conflictNeeded,
    });
    const candidateRationale = buildVerifiedMemoryCandidateRationale({
      disposition: candidateStatus,
      sourceVerification: item.verification,
      verification,
      hasTruthConflict: conflictNeeded,
      reviewMode: input.reviewMode,
    });

    const candidate = await db.memoryCandidate.upsert({
      where: { candidateKey },
      update: {
        runtimeEventId: input.runtimeEventId,
        meetingId: input.meeting.id,
        memoryItemId: item.id,
        artifactBundleId: item.artifactBundleId ?? undefined,
        summary: item.summary,
        sourceVerification: item.verification,
        sourceStatus: item.status,
        status: candidateStatus,
        reviewerNote: candidateRationale,
        evidenceRefs: item.evidenceRefs,
        confidence: item.confidence,
      },
      create: {
        workspaceId: input.workspaceId,
        runtimeSessionId: session.id,
        runtimeEventId: input.runtimeEventId,
        meetingId: input.meeting.id,
        memoryItemId: item.id,
        artifactBundleId: item.artifactBundleId ?? undefined,
        candidateKey,
        summary: item.summary,
        sourceVerification: item.verification,
        sourceStatus: item.status,
        status: candidateStatus,
        reviewerNote: candidateRationale,
        evidenceRefs: item.evidenceRefs,
        confidence: item.confidence,
      },
    });
    createdCandidateIds.push(candidate.id);
    continuityCandidates.push({
      id: candidate.id,
      status: candidate.status,
      summary: candidate.summary,
      evidenceRefs: candidate.evidenceRefs,
    });

    if (candidateStatus === "PROMOTED" || candidateStatus === "DEFERRED" || candidateStatus === "REJECTED") {
      const promotionKey = `${input.workspaceId}:memory-promotion:${item.id}`;
      const promotionStatus =
        candidateStatus === "PROMOTED" ? "PROMOTED" : candidateStatus === "REJECTED" ? "REJECTED" : "DEFERRED";
      await db.memoryPromotion.upsert({
        where: { promotionKey },
        update: {
          memoryCandidateId: candidate.id,
          memoryItemId: item.id,
          status: promotionStatus,
          rationale: candidateRationale,
        },
        create: {
          workspaceId: input.workspaceId,
          runtimeSessionId: session.id,
          memoryCandidateId: candidate.id,
          memoryItemId: item.id,
          promotionKey,
          status: promotionStatus,
          rationale: candidateRationale,
        },
      });
      continuityPromotions.push({
        memoryCandidateId: candidate.id,
        status: promotionStatus,
      });
      if (candidateStatus === "PROMOTED") {
        promotedCandidateIds.push(candidate.id);
      }
    }
  }
  if (createdCandidateIds.length > 0) {
    await createRuntimeUpgradeEvent({
      workspaceId: input.workspaceId,
      meetingId: input.meeting.id,
      opportunityId: input.meeting.opportunityId,
      companyId: input.meeting.companyId,
      relatedObjectType: "RuntimeSession",
      relatedObjectId: session.id,
      eventType: "memory-candidate.created",
      payload: {
        candidateIds: createdCandidateIds,
      },
      trustedContext: {
        runtimeSessionId: session.id,
      },
      triggeredBy: "helm-core",
    });
  }
  if (promotedCandidateIds.length > 0) {
    await createRuntimeUpgradeEvent({
      workspaceId: input.workspaceId,
      meetingId: input.meeting.id,
      opportunityId: input.meeting.opportunityId,
      companyId: input.meeting.companyId,
      relatedObjectType: "RuntimeSession",
      relatedObjectId: session.id,
      eventType: "memory-promotion.approved",
      payload: {
        candidateIds: promotedCandidateIds,
      },
      trustedContext: {
        runtimeSessionId: session.id,
      },
      triggeredBy: "verification-agent",
    });
  }

  const coordinationOutcome = deriveCoordinationOutcome({
    verificationStatus: verification.status,
    hasTruthConflict: conflictNeeded,
    keptDraft: input.reviewMode === "keep_draft",
  });
  if (conflictNeeded) {
    const conflictKey = `${input.workspaceId}:truth-conflict:${input.runtimeEventId}:meeting_review`;
    await db.truthConflict.upsert({
      where: { conflictKey },
      update: {
        subjectKey: `${input.meeting.id}:meeting_review`,
        preferredSource: "human_confirmed",
        conflictingSource: riskFlags.some((item) => item.promiseRisk) ? "promise_sensitive_signal" : "inferred_signal",
        summary: trimText(verification.blockedReasons.join(" "), 220) || "Meeting review still contains unresolved verification-sensitive signals.",
        status: verification.status === "passed" ? "RESOLVED" : "OPEN",
      },
      create: {
        workspaceId: input.workspaceId,
        runtimeSessionId: session.id,
        conflictKey,
        subjectKey: `${input.meeting.id}:meeting_review`,
        preferredSource: "human_confirmed",
        conflictingSource: riskFlags.some((item) => item.promiseRisk) ? "promise_sensitive_signal" : "inferred_signal",
        summary: trimText(verification.blockedReasons.join(" "), 220) || "Meeting review still contains unresolved verification-sensitive signals.",
        status: verification.status === "passed" ? "RESOLVED" : "OPEN",
      },
    });
    await createRuntimeUpgradeEvent({
      workspaceId: input.workspaceId,
      meetingId: input.meeting.id,
      opportunityId: input.meeting.opportunityId,
      companyId: input.meeting.companyId,
      relatedObjectType: "RuntimeSession",
      relatedObjectId: session.id,
      eventType: "truth-conflict.detected",
      payload: {
        blockedReasons: verification.blockedReasons,
      },
      trustedContext: {
        runtimeSessionId: session.id,
      },
      triggeredBy: "verification-agent",
    });
  }

  const worldModelSummary = buildWorldModelSummary({
    meetingTitle: input.meeting.title,
    workspaceName: input.meeting.workspace.name,
    companyName: input.meeting.company?.name,
    opportunityTitle: input.meeting.opportunity?.title,
    confirmedFacts: facts.map((fact) => String(fact.content ?? "")).filter(Boolean),
    blockers,
    recommendedNextAction,
    truthScore: verification.truthScore,
  });
  const failureClass = classifyCompositionFailure({
    verificationStatus: verification.status,
    prunedTokenCount: session.prunedTokenCount,
    blockedByAuthority: coordinationOutcome === "waiting_on_authority",
    hasTruthConflict: coordinationOutcome === "waiting_on_signal",
    lowConfidence: verification.status === "needs_review" && verification.truthScore < 60,
  });

  const snapshotKey = `${input.workspaceId}:world-model:${input.runtimeEventId}:meeting_review`;
  const worldModel = await db.worldModelSnapshot.upsert({
    where: { snapshotKey },
    update: {
      meetingId: input.meeting.id,
      opportunityId: input.meeting.opportunityId ?? undefined,
      companyId: input.meeting.companyId ?? undefined,
      summary: worldModelSummary,
      snapshotJson: jsonStringify({
        facts,
        blockers,
        recommendedNextAction,
        verification,
      }),
    },
    create: {
      workspaceId: input.workspaceId,
      runtimeSessionId: session.id,
      meetingId: input.meeting.id,
      opportunityId: input.meeting.opportunityId ?? undefined,
      companyId: input.meeting.companyId ?? undefined,
      snapshotKey,
      summary: worldModelSummary,
      snapshotJson: jsonStringify({
        facts,
        blockers,
        recommendedNextAction,
        verification,
      }),
    },
  });
  await createRuntimeUpgradeEvent({
    workspaceId: input.workspaceId,
    meetingId: input.meeting.id,
    opportunityId: input.meeting.opportunityId,
    companyId: input.meeting.companyId,
    relatedObjectType: "WorldModelSnapshot",
    relatedObjectId: worldModel.id,
    eventType: "world-model.updated",
    payload: {
      truthScore: verification.truthScore,
      snapshotKey,
    },
    trustedContext: {
      runtimeSessionId: session.id,
    },
    triggeredBy: "helm-core",
  });

  const problemDrafts = buildProblemSpaceDrafts({
    meetingId: input.meeting.id,
    meetingTitle: input.meeting.title,
    recommendedNextAction,
    blockers,
    verification,
    ownerHint: input.reviewerName,
    evidenceRefs: facts.flatMap((fact) => fact.evidence ?? []),
    allowOperationalProblemSpaces:
      input.reviewMode !== "reject" &&
      input.reviewMode !== "keep_draft" &&
      verification.status === "passed" &&
      !conflictNeeded &&
      promotedCandidateIds.length > 0 &&
      facts.some((fact) => (fact.evidence?.length ?? 0) > 0),
  });

  for (const draft of problemDrafts) {
    const problem = await db.problemSpace.upsert({
      where: { problemKey: `${input.workspaceId}:problem-space:${draft.problemKey}` },
      update: {
        meetingId: input.meeting.id,
        opportunityId: input.meeting.opportunityId ?? undefined,
        companyId: input.meeting.companyId ?? undefined,
        sourceWorldModelKey: snapshotKey,
        title: draft.title,
        summary: draft.summary,
        nextStep: draft.nextStep,
        status:
          input.reviewMode === "reject"
            ? "WATCHING"
            : mapCoordinationOutcomeToProblemSpaceStatus({
                title: draft.title,
                outcome: coordinationOutcome,
              }),
        evidenceRefs: jsonStringify(draft.evidenceRefs),
        ownerHint: draft.ownerHint ?? null,
      },
      create: {
        workspaceId: input.workspaceId,
        runtimeSessionId: session.id,
        meetingId: input.meeting.id,
        opportunityId: input.meeting.opportunityId ?? undefined,
        companyId: input.meeting.companyId ?? undefined,
        sourceWorldModelKey: snapshotKey,
        problemKey: `${input.workspaceId}:problem-space:${draft.problemKey}`,
        title: draft.title,
        summary: draft.summary,
        nextStep: draft.nextStep,
        status:
          input.reviewMode === "reject"
            ? "WATCHING"
            : mapCoordinationOutcomeToProblemSpaceStatus({
                title: draft.title,
                outcome: coordinationOutcome,
              }),
        evidenceRefs: jsonStringify(draft.evidenceRefs),
        ownerHint: draft.ownerHint ?? null,
      },
    });
    await createRuntimeUpgradeEvent({
      workspaceId: input.workspaceId,
      meetingId: input.meeting.id,
      opportunityId: input.meeting.opportunityId,
      companyId: input.meeting.companyId,
      relatedObjectType: "ProblemSpace",
      relatedObjectId: problem.id,
      eventType: "problem-space.created",
      payload: {
        title: problem.title,
        nextStep: problem.nextStep,
        sourceWorldModelKey: snapshotKey,
      },
      trustedContext: {
        runtimeSessionId: session.id,
      },
      triggeredBy: "helm-core",
    });

    await syncProblemSpaceRuntimeObjects({
      workspaceId: input.workspaceId,
      runtimeSessionId: session.id,
      problemSpace: problem,
      meetingId: input.meeting.id,
      assignedUserId: input.meeting.ownerId ?? input.meeting.opportunity?.ownerId ?? null,
      assignedUserName: input.reviewerName,
      assignedByName: input.reviewerName,
      assignmentNote: "Default DRI hint follows the current meeting review owner until reassigned.",
      evidenceRefs: draft.evidenceRefs,
      coordinationOutcome:
        draft.title === "Truth boundary review" && coordinationOutcome === "action_ready"
          ? "review_needed"
          : coordinationOutcome,
    });
    if (draft.title === "Truth boundary review" && failureClass) {
      await db.compositionFailure.updateMany({
        where: {
          workspaceId: input.workspaceId,
          runtimeSessionId: session.id,
          failureClass,
          problemSpaceId: null,
        },
        data: {
          problemSpaceId: problem.id,
        },
      });
    }
  }

  const [existingPayloadHandles, contextEditHistory, latestCheckpointForSnapshot] = await Promise.all([
    db.persistedPayload.findMany({
      where: {
        workspaceId: input.workspaceId,
        runtimeSessionId: session.id,
      },
      select: {
        handle: true,
      },
    }),
    db.contextEditEvent.findMany({
      where: {
        workspaceId: input.workspaceId,
        runtimeSessionId: session.id,
      },
      orderBy: { createdAt: "asc" },
      select: {
        removedHandles: true,
        createdAt: true,
      },
    }),
    db.sessionCheckpoint.findFirst({
      where: {
        workspaceId: input.workspaceId,
        runtimeSessionId: session.id,
      },
      orderBy: { updatedAt: "desc" },
      select: {
        snapshotJson: true,
        updatedAt: true,
      },
    }),
  ]);
  const payloadStateForSnapshot = buildRuntimePayloadHandleState({
    persistedHandles: existingPayloadHandles.map((item) => item.handle),
    latestCheckpoint: latestCheckpointForSnapshot
      ? {
          snapshotJson: latestCheckpointForSnapshot.snapshotJson,
          updatedAt: latestCheckpointForSnapshot.updatedAt,
        }
      : null,
    edits: contextEditHistory,
  });
  const loadedHandles = payloadStateForSnapshot.activeHandles;
  const removedHandles = payloadStateForSnapshot.prunedHandles;
  const continuitySnapshot = buildContinuitySnapshot({
    sessionLabel: session.label,
    sessionStatus:
      input.reviewMode === "keep_draft"
        ? "AWAITING_REVIEW"
        : input.reviewMode === "reject" || verification.status === "blocked"
          ? "BLOCKED"
          : "COMPLETED",
    boundaryNote: RUNTIME_BOUNDARY_NOTE,
    meetingLabel: input.meeting.title,
    opportunityLabel: input.meeting.opportunity?.title,
    companyLabel: input.meeting.company?.name,
    notebook: {
      sessionSummary: trimText(worldModelSummary, 500),
      decisionSummary: [...decisions, recommendedNextAction].filter(Boolean).join("；") || null,
      blockerSummary: blockers.join("；") || null,
      pendingQuestions: jsonStringify(verification.blockedReasons),
      openLoopSummary: [
        recommendedNextAction,
        ...nextActions,
        ...ownerMap
          .map((item) => [item.owner, item.action].filter(Boolean).join(" -> "))
          .filter(Boolean),
        ...followupDeadlines.map((item) => `Due: ${item}`),
      ]
        .filter(Boolean)
        .join("；"),
      boundaryNote: RUNTIME_BOUNDARY_NOTE,
    },
    verification: {
      status: verification.status,
      blockedReasons: verification.blockedReasons,
    },
    problemSpaces: problemDrafts.map((draft) => ({
      title: draft.title,
      nextStep: draft.nextStep,
      status:
        input.reviewMode === "reject"
          ? "WATCHING"
          : mapCoordinationOutcomeToProblemSpaceStatus({
              title: draft.title,
              outcome: coordinationOutcome,
            }),
      ownerHint: draft.ownerHint,
      evidenceRefs: draft.evidenceRefs,
    })),
    promotedFacts: buildPromotedRuntimeFacts(continuityCandidates, continuityPromotions),
    truthConflicts: conflictNeeded
      ? [
          {
            status: verification.status === "passed" ? "RESOLVED" : "OPEN",
            summary:
              trimText(verification.blockedReasons.join(" "), 220) ||
              "Meeting review still contains unresolved verification-sensitive signals.",
          },
        ]
      : [],
    budgetPosture,
    loadedHandles,
    prunedHandles: removedHandles,
  });

  if (failureClass) {
    const failureKey = `${input.workspaceId}:composition-failure:${input.runtimeEventId}:${failureClass}`;
    const compositionFailure = await db.compositionFailure.upsert({
      where: { failureKey },
      update: {
        meetingId: input.meeting.id,
        failureClass,
        summary:
          failureClass === "VERIFICATION_FAIL"
            ? verification.summary
            : "Context pruning removed some payload handles from the active prompt window, so operator trace remains the source of truth for omitted details.",
        detailsJson: jsonStringify({
          verification,
          prunedTokenCount: session.prunedTokenCount,
        }),
        resolved: verification.status === "passed",
      },
      create: {
        workspaceId: input.workspaceId,
        runtimeSessionId: session.id,
        meetingId: input.meeting.id,
        failureKey,
        failureClass,
        summary:
          failureClass === "VERIFICATION_FAIL"
            ? verification.summary
            : "Context pruning removed some payload handles from the active prompt window, so operator trace remains the source of truth for omitted details.",
        detailsJson: jsonStringify({
          verification,
          prunedTokenCount: session.prunedTokenCount,
        }),
        resolved: verification.status === "passed",
      },
    });
    await createRuntimeUpgradeEvent({
      workspaceId: input.workspaceId,
      meetingId: input.meeting.id,
      opportunityId: input.meeting.opportunityId,
      companyId: input.meeting.companyId,
      relatedObjectType: "CompositionFailure",
      relatedObjectId: compositionFailure.id,
      eventType: "composition.failed",
      payload: {
        failureClass,
        summary: compositionFailure.summary,
      },
      trustedContext: {
        runtimeSessionId: session.id,
      },
      triggeredBy: "helm-core",
    });
  }

  const reviewCheckpointKey = `${input.workspaceId}:checkpoint:${input.runtimeEventId}:meeting_review`;
  const reviewCheckpoint = await db.sessionCheckpoint.upsert({
    where: { checkpointKey: reviewCheckpointKey },
    update: {
      label: "meeting_review",
      status: "READY",
      summary: `${budgetPosture.state}: ${verification.summary}`,
      snapshotJson: jsonStringify({
        continuityState: continuitySnapshot,
        budgetPosture,
        reviewMode: input.reviewMode,
        verification,
        recommendedNextAction,
      }),
      tokenCount: session.budgetTokenUsed,
    },
    create: {
      workspaceId: input.workspaceId,
      runtimeSessionId: session.id,
      checkpointKey: reviewCheckpointKey,
      label: "meeting_review",
      status: "READY",
      summary: `${budgetPosture.state}: ${verification.summary}`,
      snapshotJson: jsonStringify({
        continuityState: continuitySnapshot,
        budgetPosture,
        reviewMode: input.reviewMode,
        verification,
        recommendedNextAction,
      }),
      tokenCount: session.budgetTokenUsed,
    },
  });

  const notebook = await db.sessionNotebook.upsert({
    where: { runtimeSessionId: session.id },
    update: {
      sessionSummary: trimText(
        [
          `Objective: ${continuitySnapshot.objective}.`,
          continuitySnapshot.confirmedFacts.length > 0
            ? `Confirmed facts: ${continuitySnapshot.confirmedFacts.slice(0, 2).join(" / ")}.`
            : null,
          continuitySnapshot.blockers.length > 0 ? `Blockers: ${continuitySnapshot.blockers.join(" / ")}.` : null,
          `Review posture: ${continuitySnapshot.reviewState}.`,
        ]
          .filter(Boolean)
          .join(" "),
        500,
      ),
      decisionSummary: continuitySnapshot.decisions.join("；") || null,
      blockerSummary: continuitySnapshot.blockers.join("；") || null,
      pendingQuestions: jsonStringify(continuitySnapshot.openQuestions),
      openLoopSummary: continuitySnapshot.nextActions.join("；") || continuitySnapshot.objective,
      boundaryNote: RUNTIME_BOUNDARY_NOTE,
    },
    create: {
      workspaceId: input.workspaceId,
      runtimeSessionId: session.id,
      sessionSummary: trimText(
        [
          `Objective: ${continuitySnapshot.objective}.`,
          continuitySnapshot.confirmedFacts.length > 0
            ? `Confirmed facts: ${continuitySnapshot.confirmedFacts.slice(0, 2).join(" / ")}.`
            : null,
          continuitySnapshot.blockers.length > 0 ? `Blockers: ${continuitySnapshot.blockers.join(" / ")}.` : null,
          `Review posture: ${continuitySnapshot.reviewState}.`,
        ]
          .filter(Boolean)
          .join(" "),
        500,
      ),
      decisionSummary: continuitySnapshot.decisions.join("；") || null,
      blockerSummary: continuitySnapshot.blockers.join("；") || null,
      pendingQuestions: jsonStringify(continuitySnapshot.openQuestions),
      openLoopSummary: continuitySnapshot.nextActions.join("；") || continuitySnapshot.objective,
      boundaryNote: RUNTIME_BOUNDARY_NOTE,
    },
  });
  await createRuntimeUpgradeEvent({
    workspaceId: input.workspaceId,
    meetingId: input.meeting.id,
    opportunityId: input.meeting.opportunityId,
    companyId: input.meeting.companyId,
    relatedObjectType: "SessionCheckpoint",
    relatedObjectId: reviewCheckpoint.id,
    eventType: "session-checkpoint.created",
    payload: {
      label: reviewCheckpoint.label,
      summary: reviewCheckpoint.summary,
    },
    trustedContext: {
      runtimeSessionId: session.id,
    },
    triggeredBy: "helm-core",
  });
  await createRuntimeUpgradeEvent({
    workspaceId: input.workspaceId,
    meetingId: input.meeting.id,
    opportunityId: input.meeting.opportunityId,
    companyId: input.meeting.companyId,
    relatedObjectType: "SessionNotebook",
    relatedObjectId: notebook.id,
    eventType: "session-notebook.updated",
    payload: {
      summary: notebook.sessionSummary,
      blockerSummary: notebook.blockerSummary,
    },
    trustedContext: {
      runtimeSessionId: session.id,
    },
    triggeredBy: "helm-core",
  });

  const reviewCacheKey = `${input.workspaceId}:cache:${input.runtimeEventId}:meeting_review`;
  await db.promptCacheTelemetry.upsert({
    where: { cacheKey: reviewCacheKey },
    update: {
      promptLabel: "meeting_review",
      cacheStatus: verification.status === "passed" ? "hit" : "partial",
      tokensBefore: session.budgetTokenUsed + session.prunedTokenCount,
      tokensAfter: session.budgetTokenUsed,
      tokensSaved: session.prunedTokenCount,
    },
    create: {
      workspaceId: input.workspaceId,
      runtimeSessionId: session.id,
      cacheKey: reviewCacheKey,
      promptLabel: "meeting_review",
      cacheStatus: verification.status === "passed" ? "hit" : "partial",
      tokensBefore: session.budgetTokenUsed + session.prunedTokenCount,
      tokensAfter: session.budgetTokenUsed,
      tokensSaved: session.prunedTokenCount,
    },
  });

  const consolidationLifecycleAt = new Date();
  const consolidationJob = await db.consolidationJob.upsert({
    where: { jobKey: `${input.workspaceId}:consolidation:${input.runtimeEventId}` },
    update: {
      status: input.reviewMode === "reject" ? "PAUSED" : "QUEUED",
      inputSummary: `Post-review consolidation for ${input.meeting.title}`,
      outputSummary: buildConsolidationLifecycleOutputSummary({
        lifecycleState: input.reviewMode === "reject" ? "paused" : "queued",
        source: input.reviewMode === "reject" ? "review_rejected" : "review_confirmed",
      }),
      reviewPosture: CONSOLIDATION_BOUNDARY_NOTE,
      pausedAt: input.reviewMode === "reject" ? consolidationLifecycleAt : null,
      completedAt: null,
    },
    create: {
      workspaceId: input.workspaceId,
      runtimeSessionId: session.id,
      jobKey: `${input.workspaceId}:consolidation:${input.runtimeEventId}`,
      jobType: "meeting_review_consolidation",
      status: input.reviewMode === "reject" ? "PAUSED" : "QUEUED",
      inputSummary: `Post-review consolidation for ${input.meeting.title}`,
      outputSummary: buildConsolidationLifecycleOutputSummary({
        lifecycleState: input.reviewMode === "reject" ? "paused" : "queued",
        source: input.reviewMode === "reject" ? "review_rejected" : "review_confirmed",
      }),
      reviewPosture: CONSOLIDATION_BOUNDARY_NOTE,
      pausedAt: input.reviewMode === "reject" ? consolidationLifecycleAt : null,
    },
  });
  await writeAuditLog({
    workspaceId: input.workspaceId,
    userId: input.reviewerId ?? null,
    actor: input.reviewerName,
    actorType: input.reviewerId ? ActorType.USER : ActorType.SYSTEM,
    actionType:
      input.reviewMode === "reject"
        ? "RUNTIME_CONSOLIDATION_JOB_PAUSED"
        : "RUNTIME_CONSOLIDATION_JOB_QUEUED",
    targetType: "ConsolidationJob",
    targetId: consolidationJob.id,
    summary:
      input.reviewMode === "reject"
        ? `Paused post-review candidate-only consolidation for ${input.meeting.title}.`
        : `Queued post-review candidate-only consolidation for ${input.meeting.title}.`,
    payload: {
      runtimeSessionId: session.id,
      meetingId: input.meeting.id,
      jobType: consolidationJob.jobType,
      queueLifecycleState: input.reviewMode === "reject" ? "paused" : "queued",
      rollbackMode: "fallback_to_single_agent",
      reviewMode: input.reviewMode,
    },
    sourcePage: input.sourcePage ?? `/meetings/${input.meeting.id}`,
    relatedObjectType: ObjectType.MEETING,
    relatedObjectId: input.meeting.id,
  });
  await logEvent({
    workspaceId: input.workspaceId,
    userId: input.reviewerId ?? null,
    eventName:
      input.reviewMode === "reject"
        ? "runtime_consolidation_job_paused"
        : "runtime_consolidation_job_queued",
    eventCategory: "helm_v2_runtime",
    targetType: "ConsolidationJob",
    targetId: consolidationJob.id,
    metadata: {
      runtimeSessionId: session.id,
      meetingId: input.meeting.id,
      jobType: consolidationJob.jobType,
      queueLifecycleState: input.reviewMode === "reject" ? "paused" : "queued",
      rollbackMode: "fallback_to_single_agent",
      reviewMode: input.reviewMode,
    },
    sourcePage: input.sourcePage ?? `/meetings/${input.meeting.id}`,
  });
  await createRuntimeUpgradeEvent({
    workspaceId: input.workspaceId,
    meetingId: input.meeting.id,
    opportunityId: input.meeting.opportunityId,
    companyId: input.meeting.companyId,
    relatedObjectType: "ConsolidationJob",
    relatedObjectId: consolidationJob.id,
    eventType:
      input.reviewMode === "reject"
        ? `${buildRuntimeJobEventPrefix(consolidationJob.jobType)}.paused`
        : `${buildRuntimeJobEventPrefix(consolidationJob.jobType)}.queued`,
    payload: {
      status: consolidationJob.status,
      jobType: consolidationJob.jobType,
      queueLifecycleState: input.reviewMode === "reject" ? "paused" : "queued",
      rollbackMode: "fallback_to_single_agent",
      reviewMode: input.reviewMode,
    },
    trustedContext: {
      runtimeSessionId: session.id,
      actorUserId: input.reviewerId ?? null,
    },
    untrustedContext: {
      sourcePage: input.sourcePage ?? `/meetings/${input.meeting.id}`,
    },
    triggeredBy: input.reviewerName,
  });
  if (input.reviewMode === "confirm" || input.reviewMode === "edit_confirm") {
    await queueReflectionJobForRuntimeSession({
      workspaceId: input.workspaceId,
      runtimeSessionId: session.id,
      trigger: "meeting_human_confirmed",
    });
  }

  const { record: verificationHandoff, contract: verificationHandoffContract } = await upsertRuntimeHandoffPacket({
    workspaceId: input.workspaceId,
    runtimeSessionId: session.id,
    packetKey: `${input.workspaceId}:handoff:${input.runtimeEventId}:verification`,
    fromAgent: "lead-orchestrator",
    toAgent: "verification-agent",
    goal: `Verify the runtime review for ${input.meeting.title} before quiet promotion or downstream trust upgrade.`,
    constraints: [
      "review-first",
      "verification is not autonomous decision authority",
      "no auto-send",
      "no broad auto-write",
    ],
    trustedRefs: facts.flatMap((fact) => fact.evidence ?? []),
    untrustedRefs: riskFlags.map((item) => item.reason).filter((item): item is string => Boolean(item)),
    requiredOutputs: ["verification_report", "blocked_reasons", "recommended_disposition"],
    evidenceRefs: facts.flatMap((fact) => fact.evidence ?? []),
    notebookRef: notebook.id,
    checkpointRef: reviewCheckpoint.id,
    approvalTier: "A1",
  });
  await createRuntimeUpgradeEvent({
    workspaceId: input.workspaceId,
    meetingId: input.meeting.id,
    opportunityId: input.meeting.opportunityId,
    companyId: input.meeting.companyId,
    relatedObjectType: "HandoffPacket",
    relatedObjectId: verificationHandoff.id,
    eventType: "handoff.packet.created",
    payload: {
      fromAgent: verificationHandoff.fromAgent,
      toAgent: verificationHandoff.toAgent,
      approvalTier: verificationHandoff.approvalTier,
      handoff: verificationHandoffContract,
    },
    trustedContext: {
      runtimeSessionId: session.id,
    },
    triggeredBy: "lead-orchestrator",
  });

  await db.runtimeSession.update({
    where: { id: session.id },
    data: {
      currentStage: input.reviewMode === "reject" ? "review_rejected" : "review_confirmed",
      status:
        input.reviewMode === "keep_draft"
          ? "AWAITING_REVIEW"
          : input.reviewMode === "reject" || verification.status === "blocked"
            ? "BLOCKED"
            : "COMPLETED",
      replayableEventLog: jsonStringify([
        { stage: "meeting_ingest", at: session.createdAt.toISOString() },
        {
          stage: input.reviewMode === "reject" ? "review_rejected" : "review_confirmed",
          at: input.reviewedAt.toISOString(),
          budgetPosture: budgetPosture.state,
          objective: continuitySnapshot.objective,
          reviewState: continuitySnapshot.reviewState,
        },
      ]),
      closedAt: input.reviewMode === "keep_draft" ? null : input.reviewedAt,
    },
  });
  await persistRuntimeSessionControlPlaneLifecycleSnapshot({
    workspaceId: input.workspaceId,
    sessionId: session.id,
    refreshReason: "verification_review",
    refreshSource: input.reviewMode,
  });

  await refreshRuntimeCoordinationMetrics(input.workspaceId);

  return {
    verificationReportId: verificationReport.id,
    sessionId: session.id,
  };
}

export async function pruneRuntimeSessionContext(input: {
  workspaceId: string;
  sessionId: string;
  targetTokenBudget?: number;
}) {
  const session = await db.runtimeSession.findFirst({
    where: {
      workspaceId: input.workspaceId,
      id: input.sessionId,
    },
    include: {
      persistedPayloads: true,
      notebook: true,
      checkpoints: { orderBy: { createdAt: "desc" }, take: 1 },
      problemSpaces: {
        orderBy: { createdAt: "desc" },
        take: 4,
      },
      memoryCandidates: {
        orderBy: { createdAt: "desc" },
        take: 12,
      },
      memoryPromotions: {
        where: {
          status: "PROMOTED",
        },
        orderBy: { createdAt: "desc" },
        take: 12,
      },
      verificationReports: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      truthConflicts: {
        orderBy: { createdAt: "desc" },
        take: 3,
      },
    },
  });

  if (!session) {
    throw new Error("Runtime session not found.");
  }

  const contracts = session.persistedPayloads.map((payload) => ({
    payloadKey: payload.payloadKey,
    handle: payload.handle,
    sourceType: payload.sourceType as HelmV21PersistedPayload["sourceType"],
    sourceId: payload.sourceId,
    label: payload.label,
    loadPolicy: payload.loadPolicy as HelmV21PersistedPayload["loadPolicy"],
    preview: payload.preview,
    summary: payload.summary,
    byteSize: payload.byteSize,
    estimatedTokens: payload.estimatedTokens,
    loadedByDefault: payload.loadedByDefault,
  }));
  const decision = selectPayloadsForBudget(contracts, input.targetTokenBudget ?? session.budgetTokenLimit);
  const activeCheckpoint = selectRuntimeContinuityCheckpoint(session.checkpoints, session.resumedFromKey);
  const budgetPosture = buildBudgetPosture({
    budgetTokenLimit: decision.tokenBudgetLimit,
    budgetTokenUsed: decision.tokenBudgetUsed,
    prunedTokenCount: decision.prunedTokenCount,
    latestCheckpointStatus: activeCheckpoint?.status,
    resumedFromKey: session.resumedFromKey,
  });
  const notebookState = buildRuntimeNotebookState({
    sessionLabel: session.label,
    sessionStatus: session.status,
    boundaryNote: session.boundaryNote,
    notebook: session.notebook
      ? {
          sessionSummary: session.notebook.sessionSummary,
          decisionSummary: session.notebook.decisionSummary,
          blockerSummary: session.notebook.blockerSummary,
          pendingQuestions: session.notebook.pendingQuestions,
          openLoopSummary: session.notebook.openLoopSummary,
          boundaryNote: session.notebook.boundaryNote,
        }
      : null,
    verification: session.verificationReports[0]
      ? {
          status: session.verificationReports[0].status.toLowerCase(),
          blockedReasons: safeParseJson<string[]>(session.verificationReports[0].blockedReasons, []),
        }
      : null,
    problemSpaces: session.problemSpaces.map((item) => ({
      title: item.title,
      nextStep: item.nextStep,
      status: item.status,
      ownerHint: item.ownerHint,
      evidenceRefs: parseRuntimeStringList(item.evidenceRefs),
    })),
    promotedFacts: buildPromotedRuntimeFacts(session.memoryCandidates, session.memoryPromotions),
    truthConflicts: (session.truthConflicts ?? []).map((item) => ({
      status: item.status,
      summary: item.summary,
    })),
  });
  const removedPayloads = contracts.filter((item) => decision.prunedHandles.includes(item.handle));

  const editKey = `${input.workspaceId}:context-edit:${session.id}:manual_budget_prune:${Date.now().toString(36)}:${crypto
    .randomUUID()
    .slice(0, 8)}`;
  await db.contextEditEvent.create({
    data: {
      workspaceId: input.workspaceId,
      runtimeSessionId: session.id,
      editKey,
      strategy: "manual_budget_prune",
      beforeTokenCount: contracts.reduce((sum, item) => sum + item.estimatedTokens, 0),
      afterTokenCount: decision.tokenBudgetUsed,
      removedHandles: jsonStringify(decision.prunedHandles),
      removedSummary: trimText(
        [
          `Session prune kept ${decision.loadedHandles.length} handle(s) and pruned ${decision.prunedHandles.length}.`,
          removedPayloads.length > 0
            ? `Replaced: ${removedPayloads.map((item) => `${item.label} (${item.summary})`).slice(0, 2).join(" / ")}.`
            : null,
          notebookState.blockers.length > 0 ? `Protected blockers: ${notebookState.blockers.slice(0, 2).join(" / ")}.` : null,
          notebookState.nextActions.length > 0 ? `Protected next actions: ${notebookState.nextActions.slice(0, 2).join(" / ")}.` : null,
          "Policy boundary notes remain preserved in notebook/checkpoint state.",
        ]
          .filter(Boolean)
          .join(" "),
        420,
      ),
      boundaryNote: RUNTIME_BOUNDARY_NOTE,
    },
  });

  await db.runtimeSession.update({
    where: { id: session.id },
    data: {
      budgetTokenLimit: decision.tokenBudgetLimit,
      budgetTokenUsed: decision.tokenBudgetUsed,
      loadedTokenCount: decision.tokenBudgetUsed,
      prunedTokenCount: decision.prunedTokenCount,
    },
  });
  await persistRuntimeSessionControlPlaneLifecycleSnapshot({
    workspaceId: input.workspaceId,
    sessionId: session.id,
    refreshReason: "context_edit",
    refreshSource: "manual_budget_prune",
  });

  await createRuntimeUpgradeEvent({
    workspaceId: input.workspaceId,
    meetingId: session.meetingId,
    opportunityId: session.opportunityId,
    companyId: session.companyId,
    relatedObjectType: "RuntimeSession",
    relatedObjectId: session.id,
    eventType: "context-edit.applied",
    payload: {
      tokenBudgetLimit: decision.tokenBudgetLimit,
      prunedHandles: decision.prunedHandles,
      prunedTokenCount: decision.prunedTokenCount,
    },
    trustedContext: {
      runtimeSessionId: session.id,
    },
    triggeredBy: "helm-core",
  });
  await refreshRuntimeCoordinationMetrics(input.workspaceId);

  return {
    ...decision,
    budgetPosture,
    removedPayloads: removedPayloads.map((item) => ({
      handle: item.handle,
      label: item.label,
      summary: item.summary,
      estimatedTokens: item.estimatedTokens,
      sourceType: item.sourceType,
    })),
    protectedItems: [
      notebookState.boundaryNote,
      ...notebookState.blockers,
      ...notebookState.decisions,
      ...notebookState.nextActions,
    ]
      .filter(Boolean)
      .slice(0, 8),
  };
}

export async function resumeRuntimeCheckpoint(input: {
  workspaceId: string;
  sessionId: string;
  checkpointId: string;
  sourcePage?: string | null;
}) {
  const checkpoint = await db.sessionCheckpoint.findFirst({
    where: {
      workspaceId: input.workspaceId,
      id: input.checkpointId,
      runtimeSessionId: input.sessionId,
    },
    include: {
      runtimeSession: {
        include: {
          persistedPayloads: { orderBy: { createdAt: "asc" } },
          contextEditEvents: { orderBy: { createdAt: "asc" } },
          notebook: true,
          problemSpaces: {
            orderBy: { createdAt: "desc" },
            take: 4,
          },
          memoryCandidates: {
            orderBy: { createdAt: "desc" },
            take: 12,
          },
          memoryPromotions: {
            where: {
              status: "PROMOTED",
            },
            orderBy: { createdAt: "desc" },
            take: 12,
          },
          verificationReports: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
          handoffPackets: {
            orderBy: { createdAt: "desc" },
          },
          truthConflicts: {
            orderBy: { createdAt: "desc" },
            take: 3,
          },
          checkpoints: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      },
    },
  });
  if (!checkpoint) {
    throw new Error("Runtime checkpoint not found.");
  }
  const savedState = parseContinuitySnapshot(checkpoint.snapshotJson);

  const resumedCheckpoint = await db.sessionCheckpoint.update({
    where: { id: checkpoint.id },
    data: {
      status: "RESUMED",
    },
  });

  const resumedSession = await db.runtimeSession.update({
    where: { id: checkpoint.runtimeSessionId },
    data: {
      currentStage: `resumed:${checkpoint.label}`,
      resumedFromKey: checkpoint.checkpointKey,
      status: "ACTIVE",
    },
  });
  const resumedPersistedControlPlaneLifecycle =
    await persistRuntimeSessionControlPlaneLifecycleSnapshot({
      workspaceId: input.workspaceId,
      sessionId: checkpoint.runtimeSessionId,
      refreshReason: "checkpoint_resume",
      refreshSource: checkpoint.checkpointKey,
    });
  const restoredNotebook = savedState ? buildNotebookPersistenceFromContinuitySnapshot(savedState) : null;
  if (restoredNotebook) {
    await db.sessionNotebook.upsert({
      where: { runtimeSessionId: checkpoint.runtimeSessionId },
      update: restoredNotebook,
      create: {
        workspaceId: input.workspaceId,
        runtimeSessionId: checkpoint.runtimeSessionId,
        ...restoredNotebook,
      },
    });
  }
  const liveState = buildRuntimeNotebookState({
    sessionLabel: resumedSession.label,
    sessionStatus: "ACTIVE",
    boundaryNote: resumedSession.boundaryNote,
    notebook: restoredNotebook
      ? {
          sessionSummary: restoredNotebook.sessionSummary,
          decisionSummary: restoredNotebook.decisionSummary,
          blockerSummary: restoredNotebook.blockerSummary,
          pendingQuestions: restoredNotebook.pendingQuestions,
          openLoopSummary: restoredNotebook.openLoopSummary,
          boundaryNote: restoredNotebook.boundaryNote,
        }
      : checkpoint.runtimeSession?.notebook
        ? {
            sessionSummary: checkpoint.runtimeSession.notebook.sessionSummary,
            decisionSummary: checkpoint.runtimeSession.notebook.decisionSummary,
            blockerSummary: checkpoint.runtimeSession.notebook.blockerSummary,
            pendingQuestions: checkpoint.runtimeSession.notebook.pendingQuestions,
            openLoopSummary: checkpoint.runtimeSession.notebook.openLoopSummary,
            boundaryNote: checkpoint.runtimeSession.notebook.boundaryNote,
          }
        : null,
    verification: checkpoint.runtimeSession?.verificationReports[0]
      ? {
          status: checkpoint.runtimeSession.verificationReports[0].status.toLowerCase(),
          blockedReasons: safeParseJson<string[]>(checkpoint.runtimeSession.verificationReports[0].blockedReasons, []),
        }
      : null,
    problemSpaces: checkpoint.runtimeSession?.problemSpaces.map((item) => ({
      title: item.title,
      nextStep: item.nextStep,
      status: item.status,
      ownerHint: item.ownerHint,
      evidenceRefs: parseRuntimeStringList(item.evidenceRefs),
    })) ?? [],
    promotedFacts: buildPromotedRuntimeFacts(
      checkpoint.runtimeSession?.memoryCandidates ?? [],
      checkpoint.runtimeSession?.memoryPromotions ?? [],
    ),
    truthConflicts: (checkpoint.runtimeSession?.truthConflicts ?? []).map((item) => ({
      status: item.status,
      summary: item.summary,
    })) ?? [],
  });
  const replay = buildResumeFidelity({
    checkpointId: resumedCheckpoint.id,
    checkpointLabel: resumedCheckpoint.label,
    checkpointStatus: resumedCheckpoint.status,
    updatedAt: resumedCheckpoint.updatedAt,
    savedState,
    liveState,
    livePayloadState: checkpoint.runtimeSession
      ? (() => {
          const payloadState = buildRuntimePayloadHandleState({
            persistedHandles: checkpoint.runtimeSession.persistedPayloads.map((item) => item.handle),
            latestCheckpoint: {
              snapshotJson: resumedCheckpoint.snapshotJson,
              updatedAt: resumedCheckpoint.updatedAt,
            },
            edits: checkpoint.runtimeSession.contextEditEvents,
          });
          return {
            activeHandles: payloadState.activeHandles,
            prunedHandles: payloadState.prunedHandles,
            stateSource: payloadState.stateSource,
            budgetState: buildBudgetPosture({
              budgetTokenLimit: checkpoint.runtimeSession.budgetTokenLimit,
              budgetTokenUsed: checkpoint.runtimeSession.budgetTokenUsed,
              prunedTokenCount: checkpoint.runtimeSession.prunedTokenCount,
              latestCheckpointStatus: resumedCheckpoint.status,
              resumedFromKey: checkpoint.checkpointKey,
            }).state,
          };
        })()
      : null,
  });

  await createRuntimeUpgradeEvent({
    workspaceId: input.workspaceId,
    meetingId: checkpoint.runtimeSession?.meetingId ?? null,
    opportunityId: checkpoint.runtimeSession?.opportunityId ?? null,
    companyId: checkpoint.runtimeSession?.companyId ?? null,
    relatedObjectType: "SessionCheckpoint",
    relatedObjectId: checkpoint.id,
    eventType: "session-compaction.requested",
    payload: {
      checkpointKey: checkpoint.checkpointKey,
      resumedLabel: checkpoint.label,
      replaySummary: replay?.replaySummary ?? "Checkpoint resume is active, but fidelity details are unavailable.",
      fidelityStatus: replay?.fidelityStatus ?? "WEAK",
      fidelityScore: replay?.fidelityScore ?? 0,
    },
    trustedContext: {
      runtimeSessionId: checkpoint.runtimeSessionId,
      sourcePage: input.sourcePage ?? null,
    },
    triggeredBy: "helm-core",
  });
  await refreshRuntimeCoordinationMetrics(input.workspaceId);

  const runThread = buildRunThreadContract({
    id: resumedSession.id,
    workspaceId: resumedSession.workspaceId,
    sessionKey: resumedSession.sessionKey,
    status: resumedSession.status,
    currentStage: resumedSession.currentStage,
    sourcePage: resumedSession.sourcePage,
    boundaryNote: resumedSession.boundaryNote,
    meetingId: resumedSession.meetingId,
    opportunityId: resumedSession.opportunityId,
    companyId: resumedSession.companyId,
    replayableEventLog: resumedSession.replayableEventLog,
    resumedFromKey: resumedSession.resumedFromKey,
    createdAt: resumedSession.createdAt,
    updatedAt: resumedSession.updatedAt,
    closedAt: resumedSession.closedAt,
    checkpoints: [
      {
        id: resumedCheckpoint.id,
        checkpointKey: checkpoint.checkpointKey,
        label: resumedCheckpoint.label,
        status: resumedCheckpoint.status,
        summary: resumedCheckpoint.summary,
        createdAt: resumedCheckpoint.createdAt,
        updatedAt: resumedCheckpoint.updatedAt,
      },
      ...(checkpoint.runtimeSession?.checkpoints ?? []).map((item) => ({
        id: item.id,
        checkpointKey: item.checkpointKey,
        label: item.label,
        status: item.status,
        summary: item.summary,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
    ],
    persistedControlPlaneLifecycle: {
      snapshot: resumedPersistedControlPlaneLifecycle,
      parseFailed: false,
    },
    handoffPackets: (checkpoint.runtimeSession?.handoffPackets ?? []).map((item) =>
      mapRunThreadLifecycleHandoffPacket(item),
    ),
  });
  const continuityState = buildRuntimeContinuityState({
    sessionLabel: resumedSession.label,
    sessionStatus: resumedSession.status,
    boundaryNote: resumedSession.boundaryNote,
    notebook: restoredNotebook
      ? {
          sessionSummary: restoredNotebook.sessionSummary,
          decisionSummary: restoredNotebook.decisionSummary,
          blockerSummary: restoredNotebook.blockerSummary,
          pendingQuestions: restoredNotebook.pendingQuestions,
          openLoopSummary: restoredNotebook.openLoopSummary,
          boundaryNote: restoredNotebook.boundaryNote,
        }
      : checkpoint.runtimeSession?.notebook
        ? {
            sessionSummary: checkpoint.runtimeSession.notebook.sessionSummary,
            decisionSummary: checkpoint.runtimeSession.notebook.decisionSummary,
            blockerSummary: checkpoint.runtimeSession.notebook.blockerSummary,
            pendingQuestions: checkpoint.runtimeSession.notebook.pendingQuestions,
            openLoopSummary: checkpoint.runtimeSession.notebook.openLoopSummary,
            boundaryNote: checkpoint.runtimeSession.notebook.boundaryNote,
          }
        : null,
    verification: checkpoint.runtimeSession?.verificationReports[0]
      ? {
          status: checkpoint.runtimeSession.verificationReports[0].status,
          blockedReasons: safeParseJson<string[]>(checkpoint.runtimeSession.verificationReports[0].blockedReasons, []),
        }
      : null,
    problemSpaces:
      checkpoint.runtimeSession?.problemSpaces.map((item) => ({
        title: item.title,
        nextStep: item.nextStep,
        status: item.status,
        ownerHint: item.ownerHint,
        evidenceRefs: parseRuntimeStringList(item.evidenceRefs),
      })) ?? [],
    promotedFacts: buildPromotedRuntimeFacts(
      checkpoint.runtimeSession?.memoryCandidates ?? [],
      checkpoint.runtimeSession?.memoryPromotions ?? [],
    ),
    truthConflicts:
      (checkpoint.runtimeSession?.truthConflicts ?? []).map((item) => ({
        status: item.status,
        summary: item.summary,
      })) ?? [],
    budgetTokenLimit: checkpoint.runtimeSession?.budgetTokenLimit ?? resumedSession.budgetTokenLimit,
    budgetTokenUsed: checkpoint.runtimeSession?.budgetTokenUsed ?? resumedSession.budgetTokenUsed,
    prunedTokenCount: checkpoint.runtimeSession?.prunedTokenCount ?? resumedSession.prunedTokenCount,
    latestCheckpoint: resumedCheckpoint
      ? {
          id: resumedCheckpoint.id,
          label: resumedCheckpoint.label,
          status: resumedCheckpoint.status,
          summary: resumedCheckpoint.summary,
          snapshotJson: resumedCheckpoint.snapshotJson,
          updatedAt: resumedCheckpoint.updatedAt,
        }
      : null,
    resumedFromKey: resumedSession.resumedFromKey,
    persistedPayloads:
      checkpoint.runtimeSession?.persistedPayloads.map((item) => ({
        handle: item.handle,
        label: item.label,
        summary: item.summary,
        estimatedTokens: item.estimatedTokens,
        sourceType: item.sourceType,
      })) ?? [],
    contextEditEvents:
      checkpoint.runtimeSession?.contextEditEvents.map((item) => ({
        id: item.id,
        strategy: item.strategy,
        beforeTokenCount: item.beforeTokenCount,
        afterTokenCount: item.afterTokenCount,
        removedHandles: item.removedHandles,
        removedSummary: item.removedSummary,
        createdAt: item.createdAt,
      })) ?? [],
  });
  const posture = buildRuntimePostureFromDebuggerState({
    runThread,
    recovery: continuityState.recovery,
    notebookState: continuityState.notebookState,
    verification: checkpoint.runtimeSession?.verificationReports[0]
      ? {
          status: checkpoint.runtimeSession.verificationReports[0].status,
          blockedReasons: safeParseJson<string[]>(checkpoint.runtimeSession.verificationReports[0].blockedReasons, []),
        }
      : null,
    handoffPackets: (checkpoint.runtimeSession?.handoffPackets ?? []).map((item) => mapRuntimeHandoffPacketState(item)),
  });

  return {
    checkpointId: resumedCheckpoint.id,
    checkpointKey: resumedCheckpoint.checkpointKey,
    label: resumedCheckpoint.label,
    replay,
    runThread,
    posture,
  };
}

export async function runRuntimeContinuityRemediation(input: {
  workspaceId: string;
  sessionId: string;
  action: RuntimeContinuityRemediationAction;
  actorName: string;
  actorUserId?: string | null;
  sourcePage?: string | null;
}) {
  const loadSession = () =>
    db.runtimeSession.findFirst({
      where: {
        workspaceId: input.workspaceId,
        id: input.sessionId,
      },
      include: {
        persistedPayloads: { orderBy: { createdAt: "asc" } },
        contextEditEvents: { orderBy: { createdAt: "asc" } },
        notebook: true,
        checkpoints: { orderBy: { createdAt: "desc" } },
        problemSpaces: {
          orderBy: { createdAt: "desc" },
          take: 4,
        },
        memoryCandidates: {
          orderBy: { createdAt: "desc" },
          take: 12,
        },
        memoryPromotions: {
          where: {
            status: "PROMOTED",
          },
          orderBy: { createdAt: "desc" },
          take: 12,
        },
        verificationReports: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        handoffPackets: {
          orderBy: { createdAt: "desc" },
        },
        truthConflicts: {
          orderBy: { createdAt: "desc" },
          take: 3,
        },
      },
    });

  const session = await loadSession();
  if (!session) {
    throw new Error("Runtime session not found.");
  }

  const deriveContinuity = async (targetSession: NonNullable<Awaited<ReturnType<typeof loadSession>>>) => {
    const verification = targetSession.verificationReports[0]
      ? {
          status: targetSession.verificationReports[0].status,
          blockedReasons: safeParseJson<string[]>(targetSession.verificationReports[0].blockedReasons, []),
        }
      : null;
    const activeCheckpoint = selectRuntimeContinuityCheckpoint(
      targetSession.checkpoints,
      targetSession.resumedFromKey,
    );
    const continuityState = buildRuntimeContinuityState({
      sessionLabel: targetSession.label,
      sessionStatus: targetSession.status,
      boundaryNote: targetSession.boundaryNote,
      notebook: targetSession.notebook
        ? {
            sessionSummary: targetSession.notebook.sessionSummary,
            decisionSummary: targetSession.notebook.decisionSummary,
            blockerSummary: targetSession.notebook.blockerSummary,
            pendingQuestions: targetSession.notebook.pendingQuestions,
            openLoopSummary: targetSession.notebook.openLoopSummary,
            boundaryNote: targetSession.notebook.boundaryNote,
          }
        : null,
      verification: verification
        ? {
            status: verification.status.toLowerCase(),
            blockedReasons: verification.blockedReasons,
          }
        : null,
      problemSpaces: targetSession.problemSpaces.map((item) => ({
        title: item.title,
        nextStep: item.nextStep,
        status: item.status,
        ownerHint: item.ownerHint,
        evidenceRefs: parseRuntimeStringList(item.evidenceRefs),
      })),
      promotedFacts: buildPromotedRuntimeFacts(targetSession.memoryCandidates, targetSession.memoryPromotions),
      truthConflicts: (targetSession.truthConflicts ?? []).map((item) => ({
        status: item.status,
        summary: item.summary,
      })),
      budgetTokenLimit: targetSession.budgetTokenLimit,
      budgetTokenUsed: targetSession.budgetTokenUsed,
      prunedTokenCount: targetSession.prunedTokenCount,
      latestCheckpoint: activeCheckpoint
        ? {
            id: activeCheckpoint.id,
            label: activeCheckpoint.label,
            status: activeCheckpoint.status,
            summary: activeCheckpoint.summary,
            snapshotJson: activeCheckpoint.snapshotJson,
            updatedAt: activeCheckpoint.updatedAt,
          }
        : null,
      resumedFromKey: targetSession.resumedFromKey,
      persistedPayloads: targetSession.persistedPayloads.map((item) => ({
        handle: item.handle,
        label: item.label,
        summary: item.summary,
        estimatedTokens: item.estimatedTokens,
        sourceType: item.sourceType,
      })),
      contextEditEvents: targetSession.contextEditEvents.map((item) => ({
        id: item.id,
        strategy: item.strategy,
        beforeTokenCount: item.beforeTokenCount,
        afterTokenCount: item.afterTokenCount,
        removedHandles: item.removedHandles,
        removedSummary: item.removedSummary,
        createdAt: item.createdAt,
      })),
    });
    const remediationEvents = await db.runtimeEvent.findMany({
      where: {
        workspaceId: input.workspaceId,
        relatedObjectType: "RuntimeSession",
        relatedObjectId: targetSession.id,
        eventType: {
          startsWith: "continuity.remediation.",
        },
      },
      orderBy: { createdAt: "desc" },
      take: 6,
    });
    const remediationTrace = parseRuntimeRemediationTrace(remediationEvents);
    const operatorArtifacts = buildRuntimeContinuityOperatorArtifacts({
      replay: continuityState.replay,
      recovery: continuityState.recovery,
      risk: continuityState.risk,
      payloadState: continuityState.payloadState,
      notebookState: continuityState.notebookState,
      pruneTrace: continuityState.pruneTrace,
      remediationTrace,
    });

    return {
      ...continuityState,
      verification,
      recovery: operatorArtifacts.recovery,
      remediationTrace,
      operatorArtifacts,
    };
  };

  const beforeContinuity = await deriveContinuity(session);
  const requestedAction = formatContinuityRemediationActionLabel(input.action);
  const buildSessionRunThread = (targetSession: NonNullable<Awaited<ReturnType<typeof loadSession>>>) =>
    buildRunThreadContract({
      id: targetSession.id,
      workspaceId: targetSession.workspaceId,
      sessionKey: targetSession.sessionKey,
      status: targetSession.status,
      currentStage: targetSession.currentStage,
      sourcePage: targetSession.sourcePage,
      boundaryNote: targetSession.boundaryNote,
      meetingId: targetSession.meetingId,
      opportunityId: targetSession.opportunityId,
      companyId: targetSession.companyId,
      replayableEventLog: targetSession.replayableEventLog,
      resumedFromKey: targetSession.resumedFromKey,
      createdAt: targetSession.createdAt,
      updatedAt: targetSession.updatedAt,
      closedAt: targetSession.closedAt,
      checkpoints: targetSession.checkpoints.map((item) => ({
        id: item.id,
        checkpointKey: item.checkpointKey,
        label: item.label,
        status: item.status,
        summary: item.summary,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
      handoffPackets: targetSession.handoffPackets.map((item) => mapRunThreadLifecycleHandoffPacket(item)),
    });
  const buildSessionPosture = (
    targetSession: NonNullable<Awaited<ReturnType<typeof loadSession>>>,
    continuity: Awaited<ReturnType<typeof deriveContinuity>>,
  ) =>
    buildRuntimePostureFromDebuggerState({
      runThread: buildSessionRunThread(targetSession),
      recovery: continuity.recovery,
      notebookState: continuity.notebookState,
      verification: continuity.verification,
      handoffPackets: targetSession.handoffPackets.map((item) => mapRuntimeHandoffPacketState(item)),
    });

  const recordTrace = async (
    executionStatus: RuntimeRemediationTraceEntry["executionStatus"],
    afterState: {
      session: NonNullable<Awaited<ReturnType<typeof loadSession>>>;
      continuity: Awaited<ReturnType<typeof deriveContinuity>>;
    } = {
      session,
      continuity: beforeContinuity,
    },
  ) => {
    const beforePosture = buildSessionPosture(session, beforeContinuity);
    const afterPosture = buildSessionPosture(afterState.session, afterState.continuity);
    const beforeSummary = formatRuntimePostureSnapshotSummary(beforePosture);
    const afterSummary = formatRuntimePostureSnapshotSummary(afterPosture);
    const rollbackAnchor = afterState.continuity.recovery.rollbackAnchor ?? beforeContinuity.recovery.rollbackAnchor;
    const summary =
      executionStatus === "APPLIED"
        ? `Applied ${requestedAction}. ${afterSummary}.`
        : executionStatus === "REVIEW_REQUIRED"
          ? `${requestedAction} stayed review-required. ${afterSummary}.`
          : `${requestedAction} was blocked. ${afterSummary}.`;

    const event = await createRuntimeUpgradeEvent({
      workspaceId: input.workspaceId,
      meetingId: afterState.session.meetingId,
      opportunityId: afterState.session.opportunityId,
      companyId: afterState.session.companyId,
      relatedObjectType: "RuntimeSession",
      relatedObjectId: afterState.session.id,
      eventType: `continuity.remediation.${executionStatus.toLowerCase()}`,
      payload: {
        action: input.action,
        executionStatus,
        summary,
        beforeSummary,
        afterSummary,
        beforePosture,
        afterPosture,
        before: {
          riskLevel: beforeContinuity.risk.level,
          recoveryState: beforeContinuity.recovery.state,
          failureTaxonomy: beforeContinuity.recovery.failureTaxonomy,
        },
        after: {
          riskLevel: afterState.continuity.risk.level,
          recoveryState: afterState.continuity.recovery.state,
          failureTaxonomy: afterState.continuity.recovery.failureTaxonomy,
        },
        rollbackAnchor,
      },
      trustedContext: {
        runtimeSessionId: afterState.session.id,
        actorUserId: input.actorUserId ?? null,
        sourcePage: input.sourcePage ?? null,
      },
      triggeredBy: input.actorName,
    });

    return {
      traceEventId: event.id,
      executionStatus,
      summary,
      beforePosture,
      afterPosture,
      before: {
        recoveryState: beforeContinuity.recovery.state,
        failureTaxonomy: beforeContinuity.recovery.failureTaxonomy,
        summary: beforeSummary,
      },
      after: {
        recoveryState: afterState.continuity.recovery.state,
        failureTaxonomy: afterState.continuity.recovery.failureTaxonomy,
        summary: afterSummary,
      },
      rollbackAnchor,
    };
  };

  if (beforeContinuity.recovery.state === "BLOCKED") {
    return recordTrace("BLOCKED");
  }

  if (beforeContinuity.recovery.state === "REVIEW_REQUIRED") {
    return recordTrace("REVIEW_REQUIRED");
  }

  if (!beforeContinuity.recovery.allowedActions.includes(input.action)) {
    return recordTrace("BLOCKED");
  }

  const resumeCheckpointId =
    input.action === "RESUME_CHECKPOINT"
      ? selectRuntimeContinuityCheckpoint(session.checkpoints, session.resumedFromKey)?.id ?? null
      : null;
  let rollbackAnchor = beforeContinuity.recovery.rollbackAnchor;
  if (input.action !== "SAVE_RECOVERY_CHECKPOINT") {
    const rollbackSnapshot: RuntimeContinuitySnapshot = {
      ...beforeContinuity.notebookState,
      budgetState: beforeContinuity.budgetPosture.state,
      loadedHandles: beforeContinuity.payloadState.activeHandles,
      prunedHandles: beforeContinuity.payloadState.prunedHandles,
    };
    const preActionCheckpoint = await createContinuityRecoveryCheckpoint({
      workspaceId: input.workspaceId,
      runtimeSessionId: session.id,
      label: `operator_pre_${input.action.toLowerCase()}`,
      summary: `Rollback anchor before ${requestedAction}.`,
      continuitySnapshot: rollbackSnapshot,
      tokenCount: session.budgetTokenUsed,
    });
    rollbackAnchor = buildRuntimeRollbackAnchor({
      id: preActionCheckpoint.id,
      label: preActionCheckpoint.label,
      status: preActionCheckpoint.status,
    });
  }

  if (input.action === "SAVE_RECOVERY_CHECKPOINT") {
    const continuitySnapshot: RuntimeContinuitySnapshot = {
      ...beforeContinuity.notebookState,
      budgetState: beforeContinuity.budgetPosture.state,
      loadedHandles: beforeContinuity.payloadState.activeHandles,
      prunedHandles: beforeContinuity.payloadState.prunedHandles,
    };
    const createdCheckpoint = await createContinuityRecoveryCheckpoint({
      workspaceId: input.workspaceId,
      runtimeSessionId: session.id,
      label: "operator_recovery_anchor",
      summary: `Operator recovery checkpoint saved from ${beforeContinuity.recovery.state.toLowerCase()} continuity posture.`,
      continuitySnapshot,
      tokenCount: session.budgetTokenUsed,
    });
    rollbackAnchor = buildRuntimeRollbackAnchor({
      id: createdCheckpoint.id,
      label: createdCheckpoint.label,
      status: createdCheckpoint.status,
    });
  } else if (input.action === "RESUME_CHECKPOINT") {
    if (!resumeCheckpointId) {
      return recordTrace("BLOCKED");
    }
    await resumeRuntimeCheckpoint({
      workspaceId: input.workspaceId,
      sessionId: session.id,
      checkpointId: resumeCheckpointId,
      sourcePage: session.sourcePage,
    });
  } else {
    if (!session.persistedPayloads.length) {
      return recordTrace("BLOCKED");
    }
    await pruneRuntimeSessionContext({
      workspaceId: input.workspaceId,
      sessionId: session.id,
      targetTokenBudget: session.budgetTokenLimit,
    });
  }

  const refreshedSession = await loadSession();
  if (!refreshedSession) {
    throw new Error("Runtime session disappeared after remediation.");
  }
  const afterContinuity = await deriveContinuity(refreshedSession);
  const tracedAfterContinuity = {
    ...afterContinuity,
    recovery: rollbackAnchor
      ? {
          ...afterContinuity.recovery,
          rollbackAnchor,
        }
      : afterContinuity.recovery,
  };
  const afterTrace = await recordTrace("APPLIED", {
    session: refreshedSession,
    continuity: tracedAfterContinuity,
  });
  await refreshRuntimeCoordinationMetrics(input.workspaceId);
  return afterTrace;
}

export async function requestRuntimeOperatorTakeover(input: {
  workspaceId: string;
  sessionId: string;
  actorName: string;
  actorUserId?: string | null;
  sourcePage?: string | null;
}) {
  const trace = await getRuntimeSessionTrace(input.workspaceId, input.sessionId);
  if (!trace) {
    throw new Error("Runtime session not found.");
  }

  const request = trace.debugger.takeoverRequest;
  const guard = buildOperatorDebuggerRecoveryExecutionGuardContract({
    move: "request_takeover",
    ...trace.debugger,
  });
  if (guard.state === "reused") {
    return {
      reused: true,
      requestEventId: request.requestEventId,
      state: request.state,
      action: request.action,
      checkpointKey: request.checkpointKey,
      resumeToken: request.resumeToken,
      summary: request.summary,
      requestedAt: request.requestedAt,
    };
  }
  const fallbackAllowed = request.state === "requestable" && Boolean(request.action);
  if (guard.state !== "allowed" && !fallbackAllowed) {
    throw new Error(guard.summary);
  }

  const event = await createRuntimeUpgradeEvent({
    workspaceId: input.workspaceId,
    meetingId: trace.runThread.objectRefs.meetingId,
    opportunityId: trace.runThread.objectRefs.opportunityId,
    companyId: trace.runThread.objectRefs.companyId,
    relatedObjectType: "RuntimeSession",
    relatedObjectId: trace.runThread.runId,
    eventType: OPERATOR_TAKEOVER_REQUEST_EVENT_TYPE,
    payload: {
      action: request.action,
      checkpointId: request.checkpointId,
      checkpointKey: request.checkpointKey,
      resumeToken: request.resumeToken,
      summary: request.summary,
    },
    trustedContext: {
      runtimeSessionId: trace.runThread.runId,
      actorUserId: input.actorUserId ?? null,
      sourcePage: input.sourcePage ?? null,
    },
    triggeredBy: input.actorName,
  });

  return {
    reused: false,
    requestEventId: event.id,
    state: "requested" as const,
    action: request.action,
    checkpointKey: request.checkpointKey,
    resumeToken: request.resumeToken,
    summary: request.summary,
    requestedAt: event.createdAt,
  };
}

export async function requestRuntimeSwarmSpawn(input: {
  workspaceId: string;
  sessionId: string;
  actorName: string;
  actorUserId?: string | null;
  sourcePage?: string | null;
}) {
  const trace = await getRuntimeSessionTrace(input.workspaceId, input.sessionId);
  if (!trace) {
    throw new Error("Runtime session not found.");
  }

  const request = trace.runThread.swarmSpawnRequest;
  const contract = trace.runThread.swarmSpawnContract;
  if (request.requestRecordState === "requested") {
    return {
      reused: true,
      requestEventId: request.requestEventId,
      taskClass: request.taskClass,
      checkpointKey: request.checkpointKey,
      summary: request.summary,
      requestedAt: request.requestedAt,
    };
  }

  if (contract.state !== "requestable") {
    throw new Error(contract.denySummary ?? contract.summary);
  }

  const summary = trimText(
    request.checkpointKey
      ? `Read-only swarm worker spawn request recorded for ${request.checkpointKey}.`
      : "Read-only swarm worker spawn request recorded for the current run thread.",
    220,
  );
  const event = await createRuntimeUpgradeEvent({
    workspaceId: input.workspaceId,
    meetingId: trace.runThread.objectRefs.meetingId,
    opportunityId: trace.runThread.objectRefs.opportunityId,
    companyId: trace.runThread.objectRefs.companyId,
    relatedObjectType: "RuntimeSession",
    relatedObjectId: trace.runThread.runId,
    eventType: SWARM_SPAWN_REQUESTED_EVENT_TYPE,
    payload: {
      taskClass: request.taskClass,
      checkpointId: request.checkpointId,
      checkpointKey: request.checkpointKey,
      summary,
    },
    trustedContext: {
      runtimeSessionId: trace.runThread.runId,
      actorUserId: input.actorUserId ?? null,
      sourcePage: input.sourcePage ?? null,
    },
    triggeredBy: input.actorName,
  });

  return {
    reused: false,
    requestEventId: event.id,
    taskClass: request.taskClass,
    checkpointKey: request.checkpointKey,
    summary,
    requestedAt: event.createdAt,
  };
}

export async function recordRuntimeSwarmReadOnlyWorkerIntent(input: {
  workspaceId: string;
  sessionId: string;
  workerKind: "search" | "grep" | "evidence_mining";
  actorName: string;
  actorUserId?: string | null;
  sourcePage?: string | null;
}) {
  const trace = await getRuntimeSessionTrace(input.workspaceId, input.sessionId);
  if (!trace) {
    throw new Error("Runtime session not found.");
  }

  const contract = trace.runThread.swarmReadOnlyWorkerContract;
  if (contract.packetConsumptionIntentState === "intent_recorded") {
    return {
      reused: true,
      intentEventId: contract.intentEventId,
      workerKind: contract.selectedWorkerKind,
      packetKey: contract.selectedPacketKey,
      artifactTypes: contract.selectedArtifactTypes,
      checkpointKey: contract.checkpointKey,
      summary: contract.packetConsumptionIntentSummary,
      intentRecordedAt: contract.intentRecordedAt,
    };
  }

  if (contract.state !== "requested") {
    throw new Error(contract.packetConsumptionIntentSummary || contract.summary);
  }

  const selectedLane = contract.lanePreviews.find((item) => item.workerKind === input.workerKind);
  if (!selectedLane) {
    throw new Error("Selected read-only worker lane is not allowlisted.");
  }

  const summary = trimText(
    `Read-only worker intent recorded for ${selectedLane.workerKind} on ${selectedLane.packetKey}. Later fan-out must stay artifact-first and review-first.`,
    220,
  );

  const event = await createRuntimeUpgradeEvent({
    workspaceId: input.workspaceId,
    meetingId: trace.runThread.objectRefs.meetingId,
    opportunityId: trace.runThread.objectRefs.opportunityId,
    companyId: trace.runThread.objectRefs.companyId,
    relatedObjectType: "RuntimeSession",
    relatedObjectId: trace.runThread.runId,
    eventType: SWARM_READ_ONLY_WORKER_INTENT_RECORDED_EVENT_TYPE,
    payload: {
      workerKind: selectedLane.workerKind,
      packetKey: selectedLane.packetKey,
      checkpointId: trace.runThread.swarmSpawnContract.checkpointId,
      checkpointKey: trace.runThread.swarmSpawnContract.checkpointKey,
      artifactTypes: selectedLane.artifactTypes,
      summary,
    },
    trustedContext: {
      runtimeSessionId: trace.runThread.runId,
      actorUserId: input.actorUserId ?? null,
      sourcePage: input.sourcePage ?? null,
    },
    triggeredBy: input.actorName,
  });

  return {
    reused: false,
    intentEventId: event.id,
    workerKind: selectedLane.workerKind,
    packetKey: selectedLane.packetKey,
    artifactTypes: selectedLane.artifactTypes,
    checkpointKey: trace.runThread.swarmSpawnContract.checkpointKey,
    summary,
    intentRecordedAt: event.createdAt,
  };
}

export async function recordRuntimeSwarmReadOnlyWorkerPlaceholder(input: {
  workspaceId: string;
  sessionId: string;
  actorName: string;
  actorUserId?: string | null;
  sourcePage?: string | null;
}) {
  const trace = await getRuntimeSessionTrace(input.workspaceId, input.sessionId);
  if (!trace) {
    throw new Error("Runtime session not found.");
  }

  const contract = trace.runThread.swarmReadOnlyWorkerContract;
  if (contract.artifactBundlePlaceholderRecordState === "recorded") {
    return {
      reused: true,
      placeholderRecordEventId: contract.placeholderRecordEventId,
      workerKind: contract.selectedWorkerKind,
      packetKey: contract.selectedPacketKey,
      placeholderBundleKey: contract.placeholderBundleKey,
      checkpointKey: contract.checkpointKey,
      summary: contract.artifactBundlePlaceholderRecordSummary,
      placeholderRecordedAt: contract.placeholderRecordedAt,
    };
  }

  if (contract.artifactBundlePlaceholderRecordState !== "recordable") {
    throw new Error(contract.artifactBundlePlaceholderRecordSummary || contract.summary);
  }

  if (
    !contract.selectedWorkerKind ||
    !contract.selectedPacketKey ||
    !contract.placeholderBundleKey ||
    !contract.placeholderBundleTitle
  ) {
    throw new Error("Selected read-only worker lane is missing placeholder details.");
  }

  const summary = trimText(
    `Read-only worker placeholder recorded for ${contract.selectedWorkerKind} on ${contract.selectedPacketKey}. Later fan-out must still stay artifact-first and review-first.`,
    220,
  );

  const event = await createRuntimeUpgradeEvent({
    workspaceId: input.workspaceId,
    meetingId: trace.runThread.objectRefs.meetingId,
    opportunityId: trace.runThread.objectRefs.opportunityId,
    companyId: trace.runThread.objectRefs.companyId,
    relatedObjectType: "RuntimeSession",
    relatedObjectId: trace.runThread.runId,
    eventType: SWARM_READ_ONLY_WORKER_PLACEHOLDER_RECORDED_EVENT_TYPE,
    payload: {
      workerKind: contract.selectedWorkerKind,
      packetKey: contract.selectedPacketKey,
      checkpointId: trace.runThread.swarmSpawnContract.checkpointId,
      checkpointKey: trace.runThread.swarmSpawnContract.checkpointKey,
      placeholderBundleKey: contract.placeholderBundleKey,
      placeholderBundleTitle: contract.placeholderBundleTitle,
      artifactTypes: contract.placeholderArtifactTypes,
      handoffConsumerAgent: contract.handoffConsumerAgent,
      handoffConsumptionGoal: contract.handoffConsumptionGoal,
      summary,
    },
    trustedContext: {
      runtimeSessionId: trace.runThread.runId,
      actorUserId: input.actorUserId ?? null,
      sourcePage: input.sourcePage ?? null,
    },
    triggeredBy: input.actorName,
  });

  return {
    reused: false,
    placeholderRecordEventId: event.id,
    workerKind: contract.selectedWorkerKind,
    packetKey: contract.selectedPacketKey,
    placeholderBundleKey: contract.placeholderBundleKey,
    checkpointKey: trace.runThread.swarmSpawnContract.checkpointKey,
    summary,
    placeholderRecordedAt: event.createdAt,
  };
}

export async function recordRuntimeSwarmReadOnlyWorkerExecution(input: {
  workspaceId: string;
  sessionId: string;
  actorName: string;
  actorUserId?: string | null;
  sourcePage?: string | null;
}) {
  const trace = await getRuntimeSessionTrace(input.workspaceId, input.sessionId);
  if (!trace) {
    throw new Error("Runtime session not found.");
  }

  const contract = trace.runThread.swarmReadOnlyWorkerContract;
  const guard = contract.executionGuardContract;
  if (guard.state === "reused") {
    return {
      reused: true,
      executionEventId: contract.executionEventId,
      workerKind: contract.selectedWorkerKind,
      packetKey: contract.selectedPacketKey,
      placeholderBundleKey: contract.placeholderBundleKey,
      checkpointKey: contract.checkpointKey,
      summary: contract.executionRecordSummary,
      executionRecordedAt: contract.executionRecordedAt,
    };
  }

  if (guard.state !== "allowed") {
    throw new Error(guard.summary);
  }

  if (
    !contract.selectedWorkerKind ||
    !contract.selectedPacketKey ||
    !contract.placeholderBundleKey ||
    !contract.handoffConsumerAgent
  ) {
    throw new Error("Selected read-only worker lane is missing execution admission details.");
  }

  const summary = trimText(
    `Read-only worker execution slice recorded for ${contract.selectedWorkerKind} on ${contract.selectedPacketKey}. Later fan-out must still stay artifact-first, review-first, and bounded to the selected lane.`,
    220,
  );

  const event = await createRuntimeUpgradeEvent({
    workspaceId: input.workspaceId,
    meetingId: trace.runThread.objectRefs.meetingId,
    opportunityId: trace.runThread.objectRefs.opportunityId,
    companyId: trace.runThread.objectRefs.companyId,
    relatedObjectType: "RuntimeSession",
    relatedObjectId: trace.runThread.runId,
    eventType: SWARM_READ_ONLY_WORKER_EXECUTION_RECORDED_EVENT_TYPE,
    payload: {
      workerKind: contract.selectedWorkerKind,
      packetKey: contract.selectedPacketKey,
      checkpointId: trace.runThread.swarmSpawnContract.checkpointId,
      checkpointKey: trace.runThread.swarmSpawnContract.checkpointKey,
      placeholderBundleKey: contract.placeholderBundleKey,
      artifactTypes: contract.placeholderArtifactTypes,
      handoffConsumerAgent: contract.handoffConsumerAgent,
      handoffConsumptionGoal: contract.handoffConsumptionGoal,
      summary,
    },
    trustedContext: {
      runtimeSessionId: trace.runThread.runId,
      actorUserId: input.actorUserId ?? null,
      sourcePage: input.sourcePage ?? null,
    },
    triggeredBy: input.actorName,
  });

  return {
    reused: false,
    executionEventId: event.id,
    workerKind: contract.selectedWorkerKind,
    packetKey: contract.selectedPacketKey,
    placeholderBundleKey: contract.placeholderBundleKey,
    checkpointKey: trace.runThread.swarmSpawnContract.checkpointKey,
    summary,
    executionRecordedAt: event.createdAt,
  };
}

export async function recordRuntimeSwarmReadOnlyWorkerMaterialization(input: {
  workspaceId: string;
  sessionId: string;
  actorName: string;
  actorUserId?: string | null;
  sourcePage?: string | null;
}) {
  const trace = await getRuntimeSessionTrace(input.workspaceId, input.sessionId);
  if (!trace) {
    throw new Error("Runtime session not found.");
  }

  const contract = trace.runThread.swarmReadOnlyWorkerContract;
  const guard = contract.artifactMaterializationGuardContract;
  if (contract.artifactMaterializationRecordState === "recorded") {
    return {
      reused: true,
      artifactMaterializationEventId: contract.artifactMaterializationEventId,
      workerKind: contract.selectedWorkerKind,
      packetKey: contract.selectedPacketKey,
      materializationBundleKey: guard.materializationBundleKey,
      checkpointKey: contract.checkpointKey,
      summary: contract.artifactMaterializationRecordSummary,
      artifactMaterializedAt: contract.artifactMaterializedAt,
    };
  }

  if (guard.state !== "allowed" || contract.artifactMaterializationRecordState !== "recordable") {
    throw new Error(guard.summary || contract.artifactMaterializationRecordSummary || contract.summary);
  }

  if (
    !contract.selectedWorkerKind ||
    !contract.selectedPacketKey ||
    !guard.materializationBundleKey ||
    !guard.materializationBundleTitle ||
    !contract.handoffConsumerAgent
  ) {
    throw new Error("Selected read-only worker lane is missing artifact materialization details.");
  }

  const summary = trimText(
    `Read-only worker materialization slice recorded for ${contract.selectedWorkerKind} on ${contract.selectedPacketKey}. Later fan-out must still emit artifact refs only and stay review-first.`,
    220,
  );

  const event = await createRuntimeUpgradeEvent({
    workspaceId: input.workspaceId,
    meetingId: trace.runThread.objectRefs.meetingId,
    opportunityId: trace.runThread.objectRefs.opportunityId,
    companyId: trace.runThread.objectRefs.companyId,
    relatedObjectType: "RuntimeSession",
    relatedObjectId: trace.runThread.runId,
    eventType: SWARM_READ_ONLY_WORKER_MATERIALIZATION_RECORDED_EVENT_TYPE,
    payload: {
      workerKind: contract.selectedWorkerKind,
      packetKey: contract.selectedPacketKey,
      checkpointId: trace.runThread.swarmSpawnContract.checkpointId,
      checkpointKey: trace.runThread.swarmSpawnContract.checkpointKey,
      materializationBundleKey: guard.materializationBundleKey,
      materializationBundleTitle: guard.materializationBundleTitle,
      artifactTypes: guard.materializationArtifactTypes,
      handoffConsumerAgent: contract.handoffConsumerAgent,
      handoffConsumptionGoal: contract.handoffConsumptionGoal,
      summary,
    },
    trustedContext: {
      runtimeSessionId: trace.runThread.runId,
      actorUserId: input.actorUserId ?? null,
      sourcePage: input.sourcePage ?? null,
    },
    triggeredBy: input.actorName,
  });

  return {
    reused: false,
    artifactMaterializationEventId: event.id,
    workerKind: contract.selectedWorkerKind,
    packetKey: contract.selectedPacketKey,
    materializationBundleKey: guard.materializationBundleKey,
    checkpointKey: trace.runThread.swarmSpawnContract.checkpointKey,
    summary,
    artifactMaterializedAt: event.createdAt,
  };
}

export async function recordRuntimeSwarmReadOnlyWorkerAdoption(input: {
  workspaceId: string;
  sessionId: string;
  actorName: string;
  actorUserId?: string | null;
  sourcePage?: string | null;
}) {
  const trace = await getRuntimeSessionTrace(input.workspaceId, input.sessionId);
  if (!trace) {
    throw new Error("Runtime session not found.");
  }

  const contract = trace.runThread.swarmReadOnlyWorkerContract;
  const guard = contract.outputAdoptionGuardContract;
  if (contract.outputAdoptionRecordState === "recorded") {
    return {
      reused: true,
      outputAdoptionEventId: contract.outputAdoptionEventId,
      workerKind: contract.selectedWorkerKind,
      packetKey: contract.selectedPacketKey,
      outputBundleKey: contract.resultAdoptionContract.outputBundleKey,
      checkpointKey: contract.checkpointKey,
      summary: contract.outputAdoptionRecordSummary,
      outputAdoptedAt: contract.outputAdoptedAt,
    };
  }

  if (guard.state !== "allowed" || contract.outputAdoptionRecordState !== "recordable") {
    throw new Error(guard.summary || contract.outputAdoptionRecordSummary || contract.summary);
  }

  if (
    !contract.selectedWorkerKind ||
    !contract.selectedPacketKey ||
    !contract.resultAdoptionContract.outputBundleKey ||
    !contract.resultAdoptionContract.outputBundleTitle ||
    !contract.handoffConsumerAgent
  ) {
    throw new Error("Selected read-only worker lane is missing output adoption details.");
  }

  const summary = trimText(
    `Read-only worker output adoption seam recorded for ${contract.selectedWorkerKind} on ${contract.selectedPacketKey}. Later result handling must stay bounded to typed output refs and remain review-first.`,
    220,
  );

  const event = await createRuntimeUpgradeEvent({
    workspaceId: input.workspaceId,
    meetingId: trace.runThread.objectRefs.meetingId,
    opportunityId: trace.runThread.objectRefs.opportunityId,
    companyId: trace.runThread.objectRefs.companyId,
    relatedObjectType: "RuntimeSession",
    relatedObjectId: trace.runThread.runId,
    eventType: SWARM_READ_ONLY_WORKER_ADOPTION_RECORDED_EVENT_TYPE,
    payload: {
      workerKind: contract.selectedWorkerKind,
      packetKey: contract.selectedPacketKey,
      checkpointId: trace.runThread.swarmSpawnContract.checkpointId,
      checkpointKey: trace.runThread.swarmSpawnContract.checkpointKey,
      outputBundleKey: contract.resultAdoptionContract.outputBundleKey,
      outputBundleTitle: contract.resultAdoptionContract.outputBundleTitle,
      outputArtifactTypes: contract.resultAdoptionContract.outputArtifactTypes,
      handoffConsumerAgent: contract.handoffConsumerAgent,
      handoffConsumptionGoal: contract.handoffConsumptionGoal,
      summary,
    },
    trustedContext: {
      runtimeSessionId: trace.runThread.runId,
      actorUserId: input.actorUserId ?? null,
      sourcePage: input.sourcePage ?? null,
    },
    triggeredBy: input.actorName,
  });

  return {
    reused: false,
    outputAdoptionEventId: event.id,
    workerKind: contract.selectedWorkerKind,
    packetKey: contract.selectedPacketKey,
    outputBundleKey: contract.resultAdoptionContract.outputBundleKey,
    checkpointKey: trace.runThread.swarmSpawnContract.checkpointKey,
    summary,
    outputAdoptedAt: event.createdAt,
  };
}

export async function recordRuntimeSwarmVerificationMergeLane(input: {
  workspaceId: string;
  sessionId: string;
  actorName: string;
  actorUserId?: string | null;
  sourcePage?: string | null;
}) {
  const trace = await getRuntimeSessionTrace(input.workspaceId, input.sessionId);
  if (!trace) {
    throw new Error("Runtime session not found.");
  }

  const contract = trace.runThread.swarmVerificationMergeLaneContract;
  if (contract.state === "recorded") {
    return {
      reused: true,
      recordEventId: contract.recordEventId,
      mergeLaneTruth: contract.mergeLaneTruth,
      checkpointKey: contract.checkpointKey,
      summary: contract.summary,
      recordedAt: contract.recordedAt,
    };
  }

  if (contract.state !== "recordable" || !contract.mergeLaneTruth) {
    throw new Error(contract.summary);
  }

  const event = await createRuntimeUpgradeEvent({
    workspaceId: input.workspaceId,
    meetingId: trace.runThread.objectRefs.meetingId,
    opportunityId: trace.runThread.objectRefs.opportunityId,
    companyId: trace.runThread.objectRefs.companyId,
    relatedObjectType: "RuntimeSession",
    relatedObjectId: trace.runThread.runId,
    eventType: SWARM_VERIFICATION_MERGE_LANE_RECORDED_EVENT_TYPE,
    payload: {
      mergeLaneTruth: contract.mergeLaneTruth,
      checkpointId: contract.checkpointId,
      checkpointKey: contract.checkpointKey,
      summary: contract.summary,
      nextAction: contract.nextAction,
      verifierSummary: contract.verifierSummary,
      disagreementSummary: contract.disagreementSummary,
      arbiterReference: contract.arbiterReference,
    },
    trustedContext: {
      runtimeSessionId: trace.runThread.runId,
      actorUserId: input.actorUserId ?? null,
      sourcePage: input.sourcePage ?? null,
    },
    triggeredBy: input.actorName,
  });

  return {
    reused: false,
    recordEventId: event.id,
    mergeLaneTruth: contract.mergeLaneTruth,
    checkpointKey: contract.checkpointKey,
    summary: contract.summary,
    recordedAt: event.createdAt,
  };
}

export async function requestRuntimeHumanInputCheckpoint(input: {
  workspaceId: string;
  sessionId: string;
  actorName: string;
  actorUserId?: string | null;
  sourcePage?: string | null;
}) {
  const trace = await getRuntimeSessionTrace(input.workspaceId, input.sessionId);
  if (!trace) {
    throw new Error("Runtime session not found.");
  }

  const request = trace.debugger.humanInputRequest;
  const guard = buildOperatorDebuggerRecoveryExecutionGuardContract({
    move: "request_human_input",
    ...trace.debugger,
  });
  if (guard.state === "reused") {
    return {
      reused: true,
      requestEventId: request.requestEventId,
      state: request.state,
      checkpointKey: request.checkpointKey,
      resumeToken: request.resumeToken,
      prompt: request.prompt,
      summary: request.summary,
      requestedAt: request.requestedAt,
    };
  }
  const fallbackAllowed =
    request.state === "requestable" &&
    Boolean(request.prompt) &&
    Boolean(request.checkpointKey);
  if (guard.state !== "allowed" && !fallbackAllowed) {
    throw new Error(guard.summary);
  }

  const event = await createRuntimeUpgradeEvent({
    workspaceId: input.workspaceId,
    meetingId: trace.runThread.objectRefs.meetingId,
    opportunityId: trace.runThread.objectRefs.opportunityId,
    companyId: trace.runThread.objectRefs.companyId,
    relatedObjectType: "RuntimeSession",
    relatedObjectId: trace.runThread.runId,
    eventType: HUMAN_INPUT_CHECKPOINT_REQUEST_EVENT_TYPE,
    payload: {
      checkpointId: request.checkpointId,
      checkpointKey: request.checkpointKey,
      resumeToken: request.resumeToken,
      prompt: request.prompt,
      summary: request.summary,
    },
    trustedContext: {
      runtimeSessionId: trace.runThread.runId,
      actorUserId: input.actorUserId ?? null,
      sourcePage: input.sourcePage ?? null,
    },
    triggeredBy: input.actorName,
  });

  return {
    reused: false,
    requestEventId: event.id,
    state: "requested" as const,
    checkpointKey: request.checkpointKey,
    resumeToken: request.resumeToken,
    prompt: request.prompt,
    summary: request.summary,
    requestedAt: event.createdAt,
  };
}

export async function acknowledgeRuntimeOperatorTakeoverRequest(input: {
  workspaceId: string;
  sessionId: string;
  actorName: string;
  actorUserId?: string | null;
  sourcePage?: string | null;
}) {
  const trace = await getRuntimeSessionTrace(input.workspaceId, input.sessionId);
  if (!trace) {
    throw new Error("Runtime session not found.");
  }

  const request = trace.debugger.takeoverRequest;
  const guard = buildOperatorDebuggerRecoveryExecutionGuardContract({
    move: "acknowledge_takeover",
    ...trace.debugger,
  });
  if (guard.state === "reused") {
    return {
      reused: true,
      requestEventId: request.requestEventId,
      acknowledgementEventId: request.acknowledgementEventId,
      state: request.state,
      action: request.action,
      checkpointKey: request.checkpointKey,
      resumeToken: request.resumeToken,
      summary: request.summary,
      acknowledgedAt: request.acknowledgedAt,
    };
  }
  const fallbackAllowed =
    request.state === "requested" &&
    Boolean(request.requestEventId) &&
    Boolean(request.action);
  if (guard.state !== "allowed" && !fallbackAllowed) {
    throw new Error(guard.summary);
  }

  const summary =
    request.summary ||
    `Operator takeover acknowledgement recorded for ${request.action} on ${request.checkpointKey ?? "the current thread anchor"}.`;
  const event = await createRuntimeUpgradeEvent({
    workspaceId: input.workspaceId,
    meetingId: trace.runThread.objectRefs.meetingId,
    opportunityId: trace.runThread.objectRefs.opportunityId,
    companyId: trace.runThread.objectRefs.companyId,
    relatedObjectType: "RuntimeSession",
    relatedObjectId: trace.runThread.runId,
    eventType: OPERATOR_TAKEOVER_ACKNOWLEDGED_EVENT_TYPE,
    payload: {
      requestEventId: request.requestEventId,
      action: request.action,
      checkpointId: request.checkpointId,
      checkpointKey: request.checkpointKey,
      resumeToken: request.resumeToken,
      summary,
    },
    trustedContext: {
      runtimeSessionId: trace.runThread.runId,
      actorUserId: input.actorUserId ?? null,
      sourcePage: input.sourcePage ?? null,
    },
    triggeredBy: input.actorName,
  });

  return {
    reused: false,
    requestEventId: request.requestEventId,
    acknowledgementEventId: event.id,
    state: "acknowledged" as const,
    action: request.action,
    checkpointKey: request.checkpointKey,
    resumeToken: request.resumeToken,
    summary,
    acknowledgedAt: event.createdAt,
  };
}

export async function startRuntimeOperatorTakeover(input: {
  workspaceId: string;
  sessionId: string;
  actorName: string;
  actorUserId?: string | null;
  sourcePage?: string | null;
}) {
  const trace = await getRuntimeSessionTrace(input.workspaceId, input.sessionId);
  if (!trace) {
    throw new Error("Runtime session not found.");
  }

  const request = trace.debugger.takeoverRequest;
  const activation = trace.debugger.takeoverActivation;
  const guard = buildOperatorDebuggerRecoveryExecutionGuardContract({
    move: "start_takeover",
    ...trace.debugger,
  });
  if (guard.state === "reused") {
    return {
      reused: true,
      requestEventId: activation.requestEventId,
      acknowledgementEventId: activation.acknowledgementEventId,
      startEventId: activation.startEventId,
      state: activation.state,
      action: activation.action,
      checkpointKey: activation.checkpointKey,
      resumeToken: activation.resumeToken,
      summary: activation.summary,
      startedAt: activation.startedAt,
    };
  }
  const fallbackAllowed =
    request.state === "acknowledged" &&
    Boolean(request.requestEventId) &&
    Boolean(request.acknowledgementEventId) &&
    Boolean(request.action);
  if (guard.state !== "allowed" && !fallbackAllowed) {
    throw new Error(guard.summary);
  }

  const summary =
    activation.summary && activation.summary !== "Operator takeover has not been started on this run thread yet."
      ? activation.summary
      : `Operator takeover started for ${request.action} on ${request.checkpointKey ?? "the current thread anchor"}.`;
  const event = await createRuntimeUpgradeEvent({
    workspaceId: input.workspaceId,
    meetingId: trace.runThread.objectRefs.meetingId,
    opportunityId: trace.runThread.objectRefs.opportunityId,
    companyId: trace.runThread.objectRefs.companyId,
    relatedObjectType: "RuntimeSession",
    relatedObjectId: trace.runThread.runId,
    eventType: OPERATOR_TAKEOVER_STARTED_EVENT_TYPE,
    payload: {
      requestEventId: request.requestEventId,
      acknowledgementEventId: request.acknowledgementEventId,
      action: request.action,
      checkpointId: request.checkpointId,
      checkpointKey: request.checkpointKey,
      resumeToken: request.resumeToken,
      summary,
    },
    trustedContext: {
      runtimeSessionId: trace.runThread.runId,
      actorUserId: input.actorUserId ?? null,
      sourcePage: input.sourcePage ?? null,
    },
    triggeredBy: input.actorName,
  });

  return {
    reused: false,
    requestEventId: request.requestEventId,
    acknowledgementEventId: request.acknowledgementEventId,
    startEventId: event.id,
    state: "active" as const,
    action: request.action,
    checkpointKey: request.checkpointKey,
    resumeToken: request.resumeToken,
    summary,
    startedAt: event.createdAt,
  };
}

export async function releaseRuntimeOperatorTakeover(input: {
  workspaceId: string;
  sessionId: string;
  actorName: string;
  actorUserId?: string | null;
  sourcePage?: string | null;
  releaseReason?: string | null;
}) {
  const trace = await getRuntimeSessionTrace(input.workspaceId, input.sessionId);
  if (!trace) {
    throw new Error("Runtime session not found.");
  }

  const activation = trace.debugger.takeoverActivation;
  const guard = buildOperatorDebuggerRecoveryExecutionGuardContract({
    move: "release_takeover",
    ...trace.debugger,
  });
  if (guard.state === "reused") {
    return {
      reused: true,
      requestEventId: activation.requestEventId,
      acknowledgementEventId: activation.acknowledgementEventId,
      startEventId: activation.startEventId,
      releaseEventId: activation.releaseEventId,
      state: activation.state,
      action: activation.action,
      checkpointKey: activation.checkpointKey,
      resumeToken: activation.resumeToken,
      summary: activation.summary,
      releasedAt: activation.releasedAt,
      releaseReason: activation.releaseReason,
    };
  }
  const fallbackAllowed =
    activation.state === "active" &&
    Boolean(activation.startEventId) &&
    Boolean(activation.action);
  if (guard.state !== "allowed" && !fallbackAllowed) {
    throw new Error(guard.summary);
  }

  const releaseReason =
    input.releaseReason?.trim() || "Bounded operator control is released after review handoff.";
  const summary =
    activation.summary && activation.summary !== "Operator takeover has not been started on this run thread yet."
      ? `Operator takeover released for ${activation.action} on ${activation.checkpointKey ?? "the current thread anchor"}. Reason: ${releaseReason}.`
      : `Operator takeover released for ${activation.action} on ${activation.checkpointKey ?? "the current thread anchor"}. Reason: ${releaseReason}.`;
  const event = await createRuntimeUpgradeEvent({
    workspaceId: input.workspaceId,
    meetingId: trace.runThread.objectRefs.meetingId,
    opportunityId: trace.runThread.objectRefs.opportunityId,
    companyId: trace.runThread.objectRefs.companyId,
    relatedObjectType: "RuntimeSession",
    relatedObjectId: trace.runThread.runId,
    eventType: OPERATOR_TAKEOVER_RELEASED_EVENT_TYPE,
    payload: {
      requestEventId: activation.requestEventId,
      acknowledgementEventId: activation.acknowledgementEventId,
      startEventId: activation.startEventId,
      action: activation.action,
      checkpointId: activation.checkpointId,
      checkpointKey: activation.checkpointKey,
      resumeToken: activation.resumeToken,
      releaseReason,
      summary,
    },
    trustedContext: {
      runtimeSessionId: trace.runThread.runId,
      actorUserId: input.actorUserId ?? null,
      sourcePage: input.sourcePage ?? null,
    },
    triggeredBy: input.actorName,
  });

  return {
    reused: false,
    requestEventId: activation.requestEventId,
    acknowledgementEventId: activation.acknowledgementEventId,
    startEventId: activation.startEventId,
    releaseEventId: event.id,
    state: "released" as const,
    action: activation.action,
    checkpointKey: activation.checkpointKey,
    resumeToken: activation.resumeToken,
    summary,
    releasedAt: event.createdAt,
    releaseReason,
  };
}

export async function requestRuntimeOperatorTakeoverFollowThrough(input: {
  workspaceId: string;
  sessionId: string;
  actorName: string;
  actorUserId?: string | null;
  sourcePage?: string | null;
  nextAction?: string | null;
  summary?: string | null;
}) {
  const trace = await getRuntimeSessionTrace(input.workspaceId, input.sessionId);
  if (!trace) {
    throw new Error("Runtime session not found.");
  }

  const followThrough = trace.debugger.takeoverFollowThrough;
  const guard = buildOperatorDebuggerRecoveryExecutionGuardContract({
    move: "request_followthrough",
    ...trace.debugger,
  });
  if (guard.state === "reused") {
    return {
      reused: true,
      requestEventId: followThrough.requestEventId,
      resolutionEventId: followThrough.resolutionEventId,
      state: followThrough.state,
      action: followThrough.action,
      checkpointKey: followThrough.checkpointKey,
      resumeToken: followThrough.resumeToken,
      summary: followThrough.summary,
      requestedAt: followThrough.requestedAt,
      resolvedAt: followThrough.resolvedAt,
    };
  }
  if (guard.state !== "allowed") {
    throw new Error(guard.summary);
  }

  const nextAction = trimText(input.nextAction, 220) || followThrough.nextAction;
  const summary =
    trimText(input.summary, 280) ||
    followThrough.summary ||
    `Operator takeover follow-through requested for ${followThrough.action} on ${followThrough.checkpointKey ?? "the current thread anchor"}.`;

  const event = await createRuntimeUpgradeEvent({
    workspaceId: input.workspaceId,
    meetingId: trace.runThread.objectRefs.meetingId,
    opportunityId: trace.runThread.objectRefs.opportunityId,
    companyId: trace.runThread.objectRefs.companyId,
    relatedObjectType: "RuntimeSession",
    relatedObjectId: trace.runThread.runId,
    eventType: OPERATOR_TAKEOVER_FOLLOW_THROUGH_REQUESTED_EVENT_TYPE,
    payload: {
      takeoverRequestEventId: followThrough.takeoverRequestEventId,
      acknowledgementEventId: followThrough.acknowledgementEventId,
      startEventId: followThrough.startEventId,
      releaseEventId: followThrough.releaseEventId,
      action: followThrough.action,
      checkpointId: followThrough.checkpointId,
      checkpointKey: followThrough.checkpointKey,
      resumeToken: followThrough.resumeToken,
      summary,
      nextAction,
    },
    trustedContext: {
      runtimeSessionId: trace.runThread.runId,
      actorUserId: input.actorUserId ?? null,
      sourcePage: input.sourcePage ?? null,
    },
    triggeredBy: input.actorName,
  });

  return {
    reused: false,
    requestEventId: event.id,
    resolutionEventId: null,
    state: "open" as const,
    action: followThrough.action,
    checkpointKey: followThrough.checkpointKey,
    resumeToken: followThrough.resumeToken,
    summary,
    requestedAt: event.createdAt,
  };
}

export async function resolveRuntimeOperatorTakeoverFollowThrough(input: {
  workspaceId: string;
  sessionId: string;
  actorName: string;
  actorUserId?: string | null;
  sourcePage?: string | null;
  nextAction?: string | null;
  summary?: string | null;
}) {
  const trace = await getRuntimeSessionTrace(input.workspaceId, input.sessionId);
  if (!trace) {
    throw new Error("Runtime session not found.");
  }

  const followThrough = trace.debugger.takeoverFollowThrough;
  const guard = buildOperatorDebuggerRecoveryExecutionGuardContract({
    move: "resolve_followthrough",
    ...trace.debugger,
  });
  if (guard.state === "reused") {
    return {
      reused: true,
      requestEventId: followThrough.requestEventId,
      resolutionEventId: followThrough.resolutionEventId,
      state: followThrough.state,
      action: followThrough.action,
      checkpointKey: followThrough.checkpointKey,
      resumeToken: followThrough.resumeToken,
      summary: followThrough.summary,
      resolvedAt: followThrough.resolvedAt,
    };
  }
  if (guard.state !== "allowed") {
    throw new Error(guard.summary);
  }

  const nextAction = trimText(input.nextAction, 220) || followThrough.nextAction;
  const summary =
    trimText(input.summary, 280) ||
    `Operator takeover follow-through resolved for ${followThrough.action} on ${followThrough.checkpointKey ?? "the current thread anchor"}.`;

  const event = await createRuntimeUpgradeEvent({
    workspaceId: input.workspaceId,
    meetingId: trace.runThread.objectRefs.meetingId,
    opportunityId: trace.runThread.objectRefs.opportunityId,
    companyId: trace.runThread.objectRefs.companyId,
    relatedObjectType: "RuntimeSession",
    relatedObjectId: trace.runThread.runId,
    eventType: OPERATOR_TAKEOVER_FOLLOW_THROUGH_RESOLVED_EVENT_TYPE,
    payload: {
      requestEventId: followThrough.requestEventId,
      takeoverRequestEventId: followThrough.takeoverRequestEventId,
      acknowledgementEventId: followThrough.acknowledgementEventId,
      startEventId: followThrough.startEventId,
      releaseEventId: followThrough.releaseEventId,
      action: followThrough.action,
      checkpointId: followThrough.checkpointId,
      checkpointKey: followThrough.checkpointKey,
      resumeToken: followThrough.resumeToken,
      summary,
      nextAction,
    },
    trustedContext: {
      runtimeSessionId: trace.runThread.runId,
      actorUserId: input.actorUserId ?? null,
      sourcePage: input.sourcePage ?? followThrough.sourcePage ?? null,
    },
    triggeredBy: input.actorName,
  });

  return {
    reused: false,
    requestEventId: followThrough.requestEventId,
    resolutionEventId: event.id,
    state: "resolved" as const,
    action: followThrough.action,
    checkpointKey: followThrough.checkpointKey,
    resumeToken: followThrough.resumeToken,
    summary,
    resolvedAt: event.createdAt,
  };
}

export async function requestRuntimeRunThreadSettlementReview(input: {
  workspaceId: string;
  sessionId: string;
  actorName: string;
  actorUserId?: string | null;
  sourcePage?: string | null;
  nextAction?: string | null;
  summary?: string | null;
}) {
  const trace = await getRuntimeSessionTrace(input.workspaceId, input.sessionId);
  if (!trace) {
    throw new Error("Runtime session not found.");
  }

  const settlementReview = trace.runThread.settlementReview;
  if (settlementReview.state === "requested" || settlementReview.state === "resolved") {
    return {
      reused: true,
      requestEventId: settlementReview.requestEventId,
      resolutionEventId: settlementReview.resolutionEventId,
      state: settlementReview.state,
      checkpointKey: settlementReview.checkpointKey,
      resumeToken: settlementReview.resumeToken,
      summary: settlementReview.summary,
      requestedAt: settlementReview.requestedAt,
      resolvedAt: settlementReview.resolvedAt,
    };
  }
  if (settlementReview.state !== "requestable") {
    throw new Error("Settlement review is not currently requestable on this run thread.");
  }

  const nextAction = trimText(input.nextAction, 220) || settlementReview.nextAction;
  const summary =
    trimText(input.summary, 280) ||
    settlementReview.summary ||
    `Settlement review requested for ${settlementReview.checkpointKey ?? "the current thread anchor"}.`;
  const event = await createRuntimeUpgradeEvent({
    workspaceId: input.workspaceId,
    meetingId: trace.runThread.objectRefs.meetingId,
    opportunityId: trace.runThread.objectRefs.opportunityId,
    companyId: trace.runThread.objectRefs.companyId,
    relatedObjectType: "RuntimeSession",
    relatedObjectId: trace.runThread.runId,
    eventType: RUN_THREAD_SETTLEMENT_REVIEW_REQUESTED_EVENT_TYPE,
    payload: {
      checkpointId: settlementReview.checkpointId,
      checkpointKey: settlementReview.checkpointKey,
      resumeToken: settlementReview.resumeToken,
      summary,
      nextAction,
    },
    trustedContext: {
      runtimeSessionId: trace.runThread.runId,
      actorUserId: input.actorUserId ?? null,
      sourcePage: input.sourcePage ?? null,
    },
    triggeredBy: input.actorName,
  });

  return {
    reused: false,
    requestEventId: event.id,
    resolutionEventId: null,
    state: "requested" as const,
    checkpointKey: settlementReview.checkpointKey,
    resumeToken: settlementReview.resumeToken,
    summary,
    requestedAt: event.createdAt,
    resolvedAt: null,
  };
}

export async function resolveRuntimeRunThreadSettlementReview(input: {
  workspaceId: string;
  sessionId: string;
  actorName: string;
  actorUserId?: string | null;
  sourcePage?: string | null;
  nextAction?: string | null;
  summary?: string | null;
}) {
  const trace = await getRuntimeSessionTrace(input.workspaceId, input.sessionId);
  if (!trace) {
    throw new Error("Runtime session not found.");
  }

  const settlementReview = trace.runThread.settlementReview;
  if (settlementReview.state === "resolved") {
    return {
      reused: true,
      requestEventId: settlementReview.requestEventId,
      resolutionEventId: settlementReview.resolutionEventId,
      state: settlementReview.state,
      checkpointKey: settlementReview.checkpointKey,
      resumeToken: settlementReview.resumeToken,
      summary: settlementReview.summary,
      resolvedAt: settlementReview.resolvedAt,
    };
  }
  if (settlementReview.state !== "requested" || !settlementReview.requestEventId) {
    throw new Error("No open settlement review is currently waiting for resolution.");
  }

  const nextAction = trimText(input.nextAction, 220) || settlementReview.nextAction;
  const summary =
    trimText(input.summary, 280) ||
    `Settlement review resolved for ${settlementReview.checkpointKey ?? "the current thread anchor"}.`;
  const event = await createRuntimeUpgradeEvent({
    workspaceId: input.workspaceId,
    meetingId: trace.runThread.objectRefs.meetingId,
    opportunityId: trace.runThread.objectRefs.opportunityId,
    companyId: trace.runThread.objectRefs.companyId,
    relatedObjectType: "RuntimeSession",
    relatedObjectId: trace.runThread.runId,
    eventType: RUN_THREAD_SETTLEMENT_REVIEW_RESOLVED_EVENT_TYPE,
    payload: {
      requestEventId: settlementReview.requestEventId,
      checkpointId: settlementReview.checkpointId,
      checkpointKey: settlementReview.checkpointKey,
      resumeToken: settlementReview.resumeToken,
      summary,
      nextAction,
    },
    trustedContext: {
      runtimeSessionId: trace.runThread.runId,
      actorUserId: input.actorUserId ?? null,
      sourcePage: input.sourcePage ?? settlementReview.sourcePage ?? null,
    },
    triggeredBy: input.actorName,
  });

  return {
    reused: false,
    requestEventId: settlementReview.requestEventId,
    resolutionEventId: event.id,
    state: "resolved" as const,
    checkpointKey: settlementReview.checkpointKey,
    resumeToken: settlementReview.resumeToken,
    summary,
    resolvedAt: event.createdAt,
  };
}

export async function confirmRuntimeRunThreadCloseout(input: {
  workspaceId: string;
  sessionId: string;
  actorName: string;
  actorUserId?: string | null;
  sourcePage?: string | null;
  nextAction?: string | null;
  summary?: string | null;
}) {
  const trace = await getRuntimeSessionTrace(input.workspaceId, input.sessionId);
  if (!trace) {
    throw new Error("Runtime session not found.");
  }

  const closeoutConfirmation = trace.runThread.closeoutConfirmation;
  if (closeoutConfirmation.state === "confirmed") {
    return {
      reused: true,
      confirmationEventId: closeoutConfirmation.confirmationEventId,
      state: closeoutConfirmation.state,
      checkpointKey: closeoutConfirmation.checkpointKey,
      resumeToken: closeoutConfirmation.resumeToken,
      summary: closeoutConfirmation.summary,
      confirmedAt: closeoutConfirmation.confirmedAt,
    };
  }
  if (
    closeoutConfirmation.state !== "confirmable" &&
    closeoutConfirmation.state !== "stale"
  ) {
    throw new Error("Thread-level closeout truth is not currently confirmable.");
  }

  const nextAction = trimText(input.nextAction, 220) || closeoutConfirmation.nextAction;
  const summary =
    trimText(input.summary, 280) ||
    closeoutConfirmation.summary ||
    `Thread-level closeout truth confirmed for ${closeoutConfirmation.checkpointKey ?? "the current thread anchor"}.`;
  const event = await createRuntimeUpgradeEvent({
    workspaceId: input.workspaceId,
    meetingId: trace.runThread.objectRefs.meetingId,
    opportunityId: trace.runThread.objectRefs.opportunityId,
    companyId: trace.runThread.objectRefs.companyId,
    relatedObjectType: "RuntimeSession",
    relatedObjectId: trace.runThread.runId,
    eventType: RUN_THREAD_CLOSEOUT_CONFIRMED_EVENT_TYPE,
    payload: {
      settlementReviewResolutionEventId:
        closeoutConfirmation.settlementReviewResolutionEventId,
      checkpointId: closeoutConfirmation.checkpointId,
      checkpointKey: closeoutConfirmation.checkpointKey,
      resumeToken: closeoutConfirmation.resumeToken,
      summary,
      nextAction,
    },
    trustedContext: {
      runtimeSessionId: trace.runThread.runId,
      actorUserId: input.actorUserId ?? null,
      sourcePage: input.sourcePage ?? closeoutConfirmation.sourcePage ?? null,
    },
    triggeredBy: input.actorName,
  });

  return {
    reused: false,
    confirmationEventId: event.id,
    state: "confirmed" as const,
    checkpointKey: closeoutConfirmation.checkpointKey,
    resumeToken: closeoutConfirmation.resumeToken,
    summary,
    confirmedAt: event.createdAt,
  };
}

export async function requestRuntimeRunThreadCloseoutRefresh(input: {
  workspaceId: string;
  sessionId: string;
  actorName: string;
  actorUserId?: string | null;
  sourcePage?: string | null;
  nextAction?: string | null;
  summary?: string | null;
}) {
  const trace = await getRuntimeSessionTrace(input.workspaceId, input.sessionId);
  if (!trace) {
    throw new Error("Runtime session not found.");
  }

  const closeoutRefresh = trace.runThread.closeoutRefresh;
  if (closeoutRefresh.state === "open" || closeoutRefresh.state === "resolved") {
    return {
      reused: true,
      requestEventId: closeoutRefresh.requestEventId,
      confirmationEventId: closeoutRefresh.confirmationEventId,
      state: closeoutRefresh.state,
      checkpointKey: closeoutRefresh.checkpointKey,
      resumeToken: closeoutRefresh.resumeToken,
      summary: closeoutRefresh.summary,
      requestedAt: closeoutRefresh.requestedAt,
      resolvedAt: closeoutRefresh.resolvedAt,
    };
  }
  if (closeoutRefresh.state !== "requestable") {
    throw new Error("Closeout refresh is not currently requestable on this run thread.");
  }

  const nextAction = trimText(input.nextAction, 220) || closeoutRefresh.nextAction;
  const summary =
    trimText(input.summary, 280) ||
    closeoutRefresh.summary ||
    `Closeout refresh requested for ${closeoutRefresh.checkpointKey ?? "the current thread anchor"}.`;

  const event = await createRuntimeUpgradeEvent({
    workspaceId: input.workspaceId,
    meetingId: trace.runThread.objectRefs.meetingId,
    opportunityId: trace.runThread.objectRefs.opportunityId,
    companyId: trace.runThread.objectRefs.companyId,
    relatedObjectType: "RuntimeSession",
    relatedObjectId: trace.runThread.runId,
    eventType: RUN_THREAD_CLOSEOUT_REFRESH_REQUESTED_EVENT_TYPE,
    payload: {
      confirmationEventId: closeoutRefresh.confirmationEventId,
      checkpointId: closeoutRefresh.checkpointId,
      checkpointKey: closeoutRefresh.checkpointKey,
      resumeToken: closeoutRefresh.resumeToken,
      summary,
      nextAction,
    },
    trustedContext: {
      runtimeSessionId: trace.runThread.runId,
      actorUserId: input.actorUserId ?? null,
      sourcePage: input.sourcePage ?? closeoutRefresh.sourcePage ?? null,
    },
    triggeredBy: input.actorName,
  });

  return {
    reused: false,
    requestEventId: event.id,
    confirmationEventId: closeoutRefresh.confirmationEventId,
    state: "open" as const,
    checkpointKey: closeoutRefresh.checkpointKey,
    resumeToken: closeoutRefresh.resumeToken,
    summary,
    requestedAt: event.createdAt,
    resolvedAt: null,
  };
}

export async function recordRuntimeRunThreadCloseoutResolution(input: {
  workspaceId: string;
  sessionId: string;
  actorName: string;
  actorUserId?: string | null;
  sourcePage?: string | null;
  decision: "close_thread" | "keep_open";
  nextAction?: string | null;
  summary?: string | null;
}) {
  const trace = await getRuntimeSessionTrace(input.workspaceId, input.sessionId);
  if (!trace) {
    throw new Error("Runtime session not found.");
  }

  const closeoutSummary = trace.runThread.closeoutSummary;
  const closeoutResolution = trace.runThread.closeoutResolution;
  if (
    closeoutResolution.state === "close_recorded" &&
    input.decision === "close_thread"
  ) {
    return {
      reused: true,
      resolutionEventId: closeoutResolution.resolutionEventId,
      decision: input.decision,
      state: closeoutResolution.state,
      checkpointKey: closeoutResolution.checkpointKey,
      resumeToken: closeoutResolution.resumeToken,
      summary: closeoutResolution.summary,
      resolvedAt: closeoutResolution.resolvedAt,
    };
  }
  if (
    closeoutResolution.state === "keep_open_recorded" &&
    input.decision === "keep_open"
  ) {
    return {
      reused: true,
      resolutionEventId: closeoutResolution.resolutionEventId,
      decision: input.decision,
      state: closeoutResolution.state,
      checkpointKey: closeoutResolution.checkpointKey,
      resumeToken: closeoutResolution.resumeToken,
      summary: closeoutResolution.summary,
      resolvedAt: closeoutResolution.resolvedAt,
    };
  }
  if (closeoutSummary.state !== "confirmed") {
    throw new Error("Explicit closeout resolution can only be recorded after closeout truth is confirmed.");
  }

  const nextAction =
    trimText(input.nextAction, 220) ||
    (input.decision === "close_thread"
      ? "Close the runtime session only when a separate bounded operator action explicitly executes the close."
      : "Keep the thread open until a newer closeout truth justifies a different explicit decision.");
  const summary =
    trimText(input.summary, 280) ||
    (input.decision === "close_thread"
      ? `Explicit close-thread resolution recorded for ${closeoutSummary.checkpointKey ?? "the current thread anchor"}.`
      : `Explicit keep-open resolution recorded for ${closeoutSummary.checkpointKey ?? "the current thread anchor"}.`);

  const event = await createRuntimeUpgradeEvent({
    workspaceId: input.workspaceId,
    meetingId: trace.runThread.objectRefs.meetingId,
    opportunityId: trace.runThread.objectRefs.opportunityId,
    companyId: trace.runThread.objectRefs.companyId,
    relatedObjectType: "RuntimeSession",
    relatedObjectId: trace.runThread.runId,
    eventType: RUN_THREAD_CLOSEOUT_RESOLUTION_RECORDED_EVENT_TYPE,
    payload: {
      decision: input.decision,
      closeoutConfirmationEventId: closeoutResolution.closeoutConfirmationEventId,
      closeoutRefreshEventId: closeoutResolution.closeoutRefreshEventId,
      checkpointId: closeoutResolution.checkpointId,
      checkpointKey: closeoutResolution.checkpointKey,
      resumeToken: closeoutResolution.resumeToken,
      summary,
      nextAction,
    },
    trustedContext: {
      runtimeSessionId: trace.runThread.runId,
      actorUserId: input.actorUserId ?? null,
      sourcePage: input.sourcePage ?? closeoutResolution.sourcePage ?? null,
    },
    triggeredBy: input.actorName,
  });

  return {
    reused: false,
    resolutionEventId: event.id,
    decision: input.decision,
    state: input.decision === "close_thread" ? ("close_recorded" as const) : ("keep_open_recorded" as const),
    checkpointKey: closeoutResolution.checkpointKey,
    resumeToken: closeoutResolution.resumeToken,
    summary,
    resolvedAt: event.createdAt,
  };
}

export async function requestRuntimeRunThreadCloseoutResolutionFollowThrough(input: {
  workspaceId: string;
  sessionId: string;
  actorName: string;
  actorUserId?: string | null;
  sourcePage?: string | null;
  nextAction?: string | null;
  summary?: string | null;
}) {
  const trace = await getRuntimeSessionTrace(input.workspaceId, input.sessionId);
  if (!trace) {
    throw new Error("Runtime session not found.");
  }

  const followThrough = trace.runThread.closeoutResolutionFollowThrough;
  const resolution = trace.runThread.closeoutResolution;
  if (followThrough.state === "open" || followThrough.state === "resolved") {
    return {
      reused: true,
      requestEventId: followThrough.requestEventId,
      resolutionEventId: followThrough.resolutionEventId,
      decision: followThrough.decision,
      state: followThrough.state,
      checkpointKey: followThrough.checkpointKey,
      resumeToken: followThrough.resumeToken,
      summary: followThrough.summary,
      requestedAt: followThrough.requestedAt,
      resolvedAt: followThrough.resolvedAt,
    };
  }

  const resolutionIsCurrent =
    resolution.state === "close_recorded" || resolution.state === "keep_open_recorded";
  if (
    (followThrough.state !== "requestable" && followThrough.state !== "stale") ||
    !resolutionIsCurrent ||
    !resolution.resolutionEventId
  ) {
    throw new Error(
      "No explicit closeout resolution follow-through is currently requestable on this run thread.",
    );
  }

  const decision = resolution.decision ?? followThrough.decision;
  if (!decision) {
    throw new Error("Closeout resolution follow-through requires an explicit close-thread or keep-open decision.");
  }

  const nextAction = trimText(input.nextAction, 220) || followThrough.nextAction;
  const summary =
    trimText(input.summary, 280) ||
    followThrough.summary ||
    (decision === "close_thread"
      ? `Close-thread follow-through requested for ${followThrough.checkpointKey ?? "the current thread anchor"}.`
      : `Keep-open follow-through requested for ${followThrough.checkpointKey ?? "the current thread anchor"}.`);

  const event = await createRuntimeUpgradeEvent({
    workspaceId: input.workspaceId,
    meetingId: trace.runThread.objectRefs.meetingId,
    opportunityId: trace.runThread.objectRefs.opportunityId,
    companyId: trace.runThread.objectRefs.companyId,
    relatedObjectType: "RuntimeSession",
    relatedObjectId: trace.runThread.runId,
    eventType: RUN_THREAD_CLOSEOUT_RESOLUTION_FOLLOW_THROUGH_REQUESTED_EVENT_TYPE,
    payload: {
      decision,
      closeoutResolutionEventId:
        resolution.resolutionEventId ?? followThrough.closeoutResolutionEventId,
      checkpointId: followThrough.checkpointId ?? resolution.checkpointId,
      checkpointKey: followThrough.checkpointKey ?? resolution.checkpointKey,
      resumeToken: followThrough.resumeToken ?? resolution.resumeToken,
      summary,
      nextAction,
    },
    trustedContext: {
      runtimeSessionId: trace.runThread.runId,
      actorUserId: input.actorUserId ?? null,
      sourcePage: input.sourcePage ?? followThrough.sourcePage ?? resolution.sourcePage ?? null,
    },
    triggeredBy: input.actorName,
  });

  return {
    reused: false,
    requestEventId: event.id,
    resolutionEventId: null,
    decision,
    state: "open" as const,
    checkpointKey: followThrough.checkpointKey ?? resolution.checkpointKey,
    resumeToken: followThrough.resumeToken ?? resolution.resumeToken,
    summary,
    requestedAt: event.createdAt,
    resolvedAt: null,
  };
}

export async function resolveRuntimeRunThreadCloseoutResolutionFollowThrough(input: {
  workspaceId: string;
  sessionId: string;
  actorName: string;
  actorUserId?: string | null;
  sourcePage?: string | null;
  nextAction?: string | null;
  summary?: string | null;
}) {
  const trace = await getRuntimeSessionTrace(input.workspaceId, input.sessionId);
  if (!trace) {
    throw new Error("Runtime session not found.");
  }

  const followThrough = trace.runThread.closeoutResolutionFollowThrough;
  if (followThrough.state === "resolved") {
    return {
      reused: true,
      requestEventId: followThrough.requestEventId,
      resolutionEventId: followThrough.resolutionEventId,
      decision: followThrough.decision,
      state: followThrough.state,
      checkpointKey: followThrough.checkpointKey,
      resumeToken: followThrough.resumeToken,
      summary: followThrough.summary,
      resolvedAt: followThrough.resolvedAt,
    };
  }
  if (followThrough.state !== "open" || !followThrough.requestEventId || !followThrough.decision) {
    throw new Error(
      "No explicit closeout resolution follow-through is currently open on this run thread.",
    );
  }

  const nextAction = trimText(input.nextAction, 220) || followThrough.nextAction;
  const summary =
    trimText(input.summary, 280) ||
    (followThrough.decision === "close_thread"
      ? `Close-thread follow-through resolved for ${followThrough.checkpointKey ?? "the current thread anchor"}.`
      : `Keep-open follow-through resolved for ${followThrough.checkpointKey ?? "the current thread anchor"}.`);

  const event = await createRuntimeUpgradeEvent({
    workspaceId: input.workspaceId,
    meetingId: trace.runThread.objectRefs.meetingId,
    opportunityId: trace.runThread.objectRefs.opportunityId,
    companyId: trace.runThread.objectRefs.companyId,
    relatedObjectType: "RuntimeSession",
    relatedObjectId: trace.runThread.runId,
    eventType: RUN_THREAD_CLOSEOUT_RESOLUTION_FOLLOW_THROUGH_RESOLVED_EVENT_TYPE,
    payload: {
      requestEventId: followThrough.requestEventId,
      decision: followThrough.decision,
      closeoutResolutionEventId: followThrough.closeoutResolutionEventId,
      checkpointId: followThrough.checkpointId,
      checkpointKey: followThrough.checkpointKey,
      resumeToken: followThrough.resumeToken,
      summary,
      nextAction,
    },
    trustedContext: {
      runtimeSessionId: trace.runThread.runId,
      actorUserId: input.actorUserId ?? null,
      sourcePage: input.sourcePage ?? followThrough.sourcePage ?? null,
    },
    triggeredBy: input.actorName,
  });

  return {
    reused: false,
    requestEventId: followThrough.requestEventId,
    resolutionEventId: event.id,
    decision: followThrough.decision,
    state: "resolved" as const,
    checkpointKey: followThrough.checkpointKey,
    resumeToken: followThrough.resumeToken,
    summary,
    resolvedAt: event.createdAt,
  };
}

export async function requestRuntimeRunThreadClose(input: {
  workspaceId: string;
  sessionId: string;
  actorName: string;
  actorUserId?: string | null;
  sourcePage?: string | null;
  nextAction?: string | null;
  summary?: string | null;
}) {
  const trace = await getRuntimeSessionTrace(input.workspaceId, input.sessionId);
  if (!trace) {
    throw new Error("Runtime session not found.");
  }

  const closeRequest = trace.runThread.closeRequest;
  if (closeRequest.state === "open" || closeRequest.state === "resolved") {
    return {
      reused: true,
      requestEventId: closeRequest.requestEventId,
      state: closeRequest.state,
      checkpointKey: closeRequest.checkpointKey,
      resumeToken: closeRequest.resumeToken,
      summary: closeRequest.summary,
      requestedAt: closeRequest.requestedAt,
      resolvedAt: closeRequest.resolvedAt,
    };
  }
  if (closeRequest.state !== "requestable" && closeRequest.state !== "stale") {
    throw new Error("Explicit bounded runtime close is not currently requestable on this run thread.");
  }

  const nextAction = trimText(input.nextAction, 220) || closeRequest.nextAction;
  const summary =
    trimText(input.summary, 280) ||
    closeRequest.summary ||
    `Explicit runtime close requested for ${closeRequest.checkpointKey ?? "the current thread anchor"}.`;

  const event = await createRuntimeUpgradeEvent({
    workspaceId: input.workspaceId,
    meetingId: trace.runThread.objectRefs.meetingId,
    opportunityId: trace.runThread.objectRefs.opportunityId,
    companyId: trace.runThread.objectRefs.companyId,
    relatedObjectType: "RuntimeSession",
    relatedObjectId: trace.runThread.runId,
    eventType: RUN_THREAD_CLOSE_REQUESTED_EVENT_TYPE,
    payload: {
      closeoutResolutionEventId: closeRequest.closeoutResolutionEventId,
      closeoutResolutionFollowThroughEventId:
        closeRequest.closeoutResolutionFollowThroughEventId,
      checkpointId: closeRequest.checkpointId,
      checkpointKey: closeRequest.checkpointKey,
      resumeToken: closeRequest.resumeToken,
      summary,
      nextAction,
    },
    trustedContext: {
      runtimeSessionId: trace.runThread.runId,
      actorUserId: input.actorUserId ?? null,
      sourcePage: input.sourcePage ?? closeRequest.sourcePage ?? null,
    },
    triggeredBy: input.actorName,
  });

  return {
    reused: false,
    requestEventId: event.id,
    state: "open" as const,
    checkpointKey: closeRequest.checkpointKey,
    resumeToken: closeRequest.resumeToken,
    summary,
    requestedAt: event.createdAt,
    resolvedAt: null,
  };
}

export async function acknowledgeRuntimeHumanInputCheckpointRequest(input: {
  workspaceId: string;
  sessionId: string;
  actorName: string;
  actorUserId?: string | null;
  sourcePage?: string | null;
}) {
  const trace = await getRuntimeSessionTrace(input.workspaceId, input.sessionId);
  if (!trace) {
    throw new Error("Runtime session not found.");
  }

  const request = trace.debugger.humanInputRequest;
  const guard = buildOperatorDebuggerRecoveryExecutionGuardContract({
    move: "acknowledge_human_input",
    ...trace.debugger,
  });
  if (guard.state === "reused") {
    return {
      reused: true,
      requestEventId: request.requestEventId,
      acknowledgementEventId: request.acknowledgementEventId,
      state: request.state,
      checkpointKey: request.checkpointKey,
      resumeToken: request.resumeToken,
      prompt: request.prompt,
      summary: request.summary,
      acknowledgedAt: request.acknowledgedAt,
    };
  }
  const fallbackAllowed =
    request.state === "requested" &&
    Boolean(request.requestEventId) &&
    Boolean(request.prompt);
  if (guard.state !== "allowed" && !fallbackAllowed) {
    throw new Error(guard.summary);
  }

  const summary =
    request.summary ||
    `Human input checkpoint acknowledgement recorded for ${request.checkpointKey ?? "the current checkpoint anchor"}.`;
  const event = await createRuntimeUpgradeEvent({
    workspaceId: input.workspaceId,
    meetingId: trace.runThread.objectRefs.meetingId,
    opportunityId: trace.runThread.objectRefs.opportunityId,
    companyId: trace.runThread.objectRefs.companyId,
    relatedObjectType: "RuntimeSession",
    relatedObjectId: trace.runThread.runId,
    eventType: HUMAN_INPUT_CHECKPOINT_ACKNOWLEDGED_EVENT_TYPE,
    payload: {
      requestEventId: request.requestEventId,
      checkpointId: request.checkpointId,
      checkpointKey: request.checkpointKey,
      resumeToken: request.resumeToken,
      prompt: request.prompt,
      summary,
    },
    trustedContext: {
      runtimeSessionId: trace.runThread.runId,
      actorUserId: input.actorUserId ?? null,
      sourcePage: input.sourcePage ?? null,
    },
    triggeredBy: input.actorName,
  });

  return {
    reused: false,
    requestEventId: request.requestEventId,
    acknowledgementEventId: event.id,
    state: "acknowledged" as const,
    checkpointKey: request.checkpointKey,
    resumeToken: request.resumeToken,
    prompt: request.prompt,
    summary,
    acknowledgedAt: event.createdAt,
  };
}

function getBenchmarkMatrixGateCatalog() {
  const matrix = buildBenchmarkMatrixReadModel();
  return {
    validLayerIds: new Set(matrix.layers.map((layer) => layer.layerId)),
    validGateIds: new Set(matrix.layers.flatMap((layer) => layer.gates.map((gate) => gate.gateId))),
    validGateKeys: new Set(
      matrix.layers.flatMap((layer) => layer.gates.map((gate) => `${layer.layerId}:${gate.gateId}`)),
    ),
  };
}

function normalizeBenchmarkExecutionRequestScope(input: {
  requestedLayerIds?: HelmV21BenchmarkMatrixLayerId[];
  requestedGateIds?: string[];
}) {
  const catalog = getBenchmarkMatrixGateCatalog();
  const requestedLayerIds = [...new Set(input.requestedLayerIds ?? [])];
  const requestedGateIds = [...new Set(input.requestedGateIds ?? [])];

  for (const layerId of requestedLayerIds) {
    if (!catalog.validLayerIds.has(layerId)) {
      throw new Error(`Unknown benchmark matrix layer: ${layerId}`);
    }
  }
  for (const gateId of requestedGateIds) {
    if (!catalog.validGateIds.has(gateId)) {
      throw new Error(`Unknown benchmark matrix gate: ${gateId}`);
    }
  }

  return {
    requestedLayerIds,
    requestedGateIds,
  };
}

export async function requestRuntimeBenchmarkMatrixRun(input: {
  workspaceId: string;
  actorName: string;
  actorUserId?: string | null;
  sourcePage?: string | null;
  commandSource?: string | null;
  requestKey?: string | null;
  requestedLayerIds?: HelmV21BenchmarkMatrixLayerId[];
  requestedGateIds?: string[];
  summary?: string | null;
}) {
  const { requestedLayerIds, requestedGateIds } = normalizeBenchmarkExecutionRequestScope({
    requestedLayerIds: input.requestedLayerIds,
    requestedGateIds: input.requestedGateIds,
  });
  const requestKey =
    input.requestKey && input.requestKey.trim().length > 0
      ? input.requestKey
      : `benchmark_request_${randomUUID()}`;
  const summary =
    input.summary?.trim() ||
    `Benchmark rerun requested for ${requestedLayerIds.length} layer(s) and ${requestedGateIds.length} gate(s).`;

  const event = await createRuntimeUpgradeEvent({
    workspaceId: input.workspaceId,
    relatedObjectType: "Workspace",
    relatedObjectId: input.workspaceId,
    eventType: BENCHMARK_MATRIX_RUN_REQUESTED_EVENT_TYPE,
    payload: {
      requestKey,
      requestedLayerIds,
      requestedGateIds,
      summary,
    },
    trustedContext: {
      actorUserId: input.actorUserId ?? null,
      sourcePage: input.sourcePage ?? null,
      commandSource: input.commandSource ?? "benchmark:runtime-substrate",
    },
    triggeredBy: input.actorName,
  });

  return {
    requestKey,
    requestEventId: event.id,
    requestedAt: event.createdAt,
    requestedLayerCount: requestedLayerIds.length,
    requestedGateCount: requestedGateIds.length,
  };
}

export async function recordRuntimeBenchmarkMatrixRun(input: {
  workspaceId: string;
  actorName: string;
  actorUserId?: string | null;
  sourcePage?: string | null;
  commandSource?: string | null;
  benchmarkRunId?: string | null;
  runLabel?: string | null;
  notes?: string | null;
  outcomes: HelmV21BenchmarkRecordedGateOutcome[];
}) {
  if (input.outcomes.length === 0) {
    throw new Error("At least one benchmark gate outcome is required.");
  }

  const validGateKeys = new Set(
    buildBenchmarkMatrixReadModel().layers.flatMap((layer) =>
      layer.gates.map((gate) => `${layer.layerId}:${gate.gateId}`),
    ),
  );
  const normalizedOutcomes = input.outcomes.map((item) => {
    const gateKey = `${item.layerId}:${item.gateId}`;
    if (!validGateKeys.has(gateKey)) {
      throw new Error(`Unknown benchmark gate outcome: ${gateKey}`);
    }
    return {
      layerId: item.layerId,
      gateId: item.gateId,
      status: item.status,
      summary: trimText(item.summary, 220),
      evidenceRefs: item.evidenceRefs.slice(0, 6),
    };
  });

  const benchmarkRunId =
    input.benchmarkRunId && input.benchmarkRunId.trim().length > 0
      ? input.benchmarkRunId
      : `benchmark_run_${randomUUID()}`;

  const event = await createRuntimeUpgradeEvent({
    workspaceId: input.workspaceId,
    relatedObjectType: "Workspace",
    relatedObjectId: input.workspaceId,
    eventType: BENCHMARK_MATRIX_RUN_RECORDED_EVENT_TYPE,
    payload: {
      benchmarkRunId,
      runLabel: input.runLabel ?? null,
      notes: input.notes ?? null,
      outcomes: normalizedOutcomes,
    },
    trustedContext: {
      actorUserId: input.actorUserId ?? null,
      sourcePage: input.sourcePage ?? null,
      commandSource: input.commandSource ?? null,
    },
    triggeredBy: input.actorName,
  });

  return {
    benchmarkRunId,
    runtimeEventId: event.id,
    recordedAt: event.createdAt,
    outcomeCount: normalizedOutcomes.length,
  };
}

export async function acknowledgeRuntimeBenchmarkMatrixRun(input: {
  workspaceId: string;
  actorName: string;
  benchmarkRunId: string;
  actorUserId?: string | null;
  sourcePage?: string | null;
  commandSource?: string | null;
  requestEventId?: string | null;
  summary?: string | null;
}) {
  const benchmarkEvents = await db.runtimeEvent.findMany({
    where: {
      workspaceId: input.workspaceId,
      relatedObjectType: "Workspace",
      relatedObjectId: input.workspaceId,
      eventType: {
        in: [...BENCHMARK_MATRIX_EVENT_TYPES],
      },
    },
    select: {
      id: true,
      eventType: true,
      payload: true,
      trustedContext: true,
      triggeredBy: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 48,
  });
  const recordedRuns = parseRuntimeBenchmarkMatrixRunEvents(benchmarkEvents);
  const existingAcknowledgements =
    parseRuntimeBenchmarkMatrixRunAcknowledgementEvents(benchmarkEvents);
  const benchmarkRun =
    recordedRuns.find((item) => item.benchmarkRunId === input.benchmarkRunId) ?? null;
  if (!benchmarkRun) {
    throw new Error(`Benchmark run ${input.benchmarkRunId} was not found.`);
  }

  const existingAcknowledgement =
    existingAcknowledgements.find((item) => item.benchmarkRunId === input.benchmarkRunId) ?? null;
  if (existingAcknowledgement) {
    return {
      reused: true,
      acknowledgementEventId: existingAcknowledgement.acknowledgementEventId,
      benchmarkRunId: existingAcknowledgement.benchmarkRunId,
      state: existingAcknowledgement.state,
      acknowledgedAt: existingAcknowledgement.acknowledgedAt,
    };
  }

  const inferredRequestEventId =
    input.requestEventId ??
    (parseRuntimeBenchmarkMatrixRunRequestEvents(benchmarkEvents).find((item) =>
      item.requestedAt && benchmarkRun.recordedAt
        ? item.requestedAt.getTime() <= benchmarkRun.recordedAt.getTime()
        : false,
    )?.requestEventId ?? null);
  const summary =
    input.summary?.trim() ||
    `Benchmark run ${benchmarkRun.runLabel ?? benchmarkRun.benchmarkRunId} acknowledged after operator review.`;

  const event = await createRuntimeUpgradeEvent({
    workspaceId: input.workspaceId,
    relatedObjectType: "Workspace",
    relatedObjectId: input.workspaceId,
    eventType: BENCHMARK_MATRIX_RUN_ACKNOWLEDGED_EVENT_TYPE,
    payload: {
      benchmarkRunId: benchmarkRun.benchmarkRunId,
      requestEventId: inferredRequestEventId,
      runLabel: benchmarkRun.runLabel ?? null,
      summary,
    },
    trustedContext: {
      actorUserId: input.actorUserId ?? null,
      sourcePage: input.sourcePage ?? benchmarkRun.sourcePage ?? null,
      commandSource: input.commandSource ?? benchmarkRun.commandSource ?? "benchmark:runtime-substrate",
    },
    triggeredBy: input.actorName,
  });

  return {
    reused: false,
    acknowledgementEventId: event.id,
    benchmarkRunId: benchmarkRun.benchmarkRunId,
    state: "acknowledged" as const,
    acknowledgedAt: event.createdAt,
  };
}

export async function requestRuntimeBenchmarkMatrixFollowThrough(input: {
  workspaceId: string;
  actorName: string;
  benchmarkRunId: string;
  actorUserId?: string | null;
  sourcePage?: string | null;
  commandSource?: string | null;
  acknowledgementEventId?: string | null;
  nextAction?: string | null;
  summary?: string | null;
}) {
  const benchmarkEvents = await db.runtimeEvent.findMany({
    where: {
      workspaceId: input.workspaceId,
      relatedObjectType: "Workspace",
      relatedObjectId: input.workspaceId,
      eventType: {
        in: [...BENCHMARK_MATRIX_EVENT_TYPES],
      },
    },
    select: {
      id: true,
      eventType: true,
      payload: true,
      trustedContext: true,
      triggeredBy: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 64,
  });
  const recordedRuns = parseRuntimeBenchmarkMatrixRunEvents(benchmarkEvents);
  const acknowledgements =
    parseRuntimeBenchmarkMatrixRunAcknowledgementEvents(benchmarkEvents);
  const followThrough = parseRuntimeBenchmarkMatrixFollowThroughEvents(benchmarkEvents);
  const benchmarkRun =
    recordedRuns.find((item) => item.benchmarkRunId === input.benchmarkRunId) ?? null;
  if (!benchmarkRun) {
    throw new Error(`Benchmark run ${input.benchmarkRunId} was not found.`);
  }
  const acknowledgement =
    acknowledgements.find((item) => item.benchmarkRunId === input.benchmarkRunId) ?? null;
  if (!acknowledgement) {
    throw new Error(
      `Benchmark run ${input.benchmarkRunId} must be acknowledged before follow-through can be requested.`,
    );
  }

  const runHistory = followThrough.filter((item) => item.benchmarkRunId === input.benchmarkRunId);
  const latestOpen =
    runHistory.find((item) => item.state === "open" && item.requestEventId) ?? null;
  const latestResolved =
    runHistory.find((item) => item.state === "resolved" && item.resolutionEventId) ?? null;
  if ((latestOpen?.requestedAt?.getTime() ?? 0) > (latestResolved?.resolvedAt?.getTime() ?? 0)) {
    return {
      reused: true,
      requestEventId: latestOpen?.requestEventId ?? null,
      benchmarkRunId: latestOpen?.benchmarkRunId ?? input.benchmarkRunId,
      acknowledgementEventId:
        latestOpen?.acknowledgementEventId ?? acknowledgement.acknowledgementEventId,
      state: latestOpen?.state ?? ("open" as const),
      requestedAt: latestOpen?.requestedAt ?? null,
    };
  }

  const nextAction = trimText(input.nextAction, 220);
  const summary =
    trimText(input.summary, 280) ||
    `Benchmark follow-through requested for ${benchmarkRun.runLabel ?? benchmarkRun.benchmarkRunId}.`;

  const event = await createRuntimeUpgradeEvent({
    workspaceId: input.workspaceId,
    relatedObjectType: "Workspace",
    relatedObjectId: input.workspaceId,
    eventType: BENCHMARK_MATRIX_RUN_FOLLOW_THROUGH_REQUESTED_EVENT_TYPE,
    payload: {
      benchmarkRunId: benchmarkRun.benchmarkRunId,
      acknowledgementEventId:
        input.acknowledgementEventId ?? acknowledgement.acknowledgementEventId,
      runLabel: benchmarkRun.runLabel ?? null,
      summary,
      nextAction,
    },
    trustedContext: {
      actorUserId: input.actorUserId ?? null,
      sourcePage: input.sourcePage ?? acknowledgement.sourcePage ?? benchmarkRun.sourcePage ?? null,
      commandSource:
        input.commandSource ??
        acknowledgement.commandSource ??
        benchmarkRun.commandSource ??
        "benchmark:runtime-substrate",
    },
    triggeredBy: input.actorName,
  });

  return {
    reused: false,
    requestEventId: event.id,
    benchmarkRunId: benchmarkRun.benchmarkRunId,
    acknowledgementEventId: input.acknowledgementEventId ?? acknowledgement.acknowledgementEventId,
    state: "open" as const,
    requestedAt: event.createdAt,
  };
}

export async function resolveRuntimeBenchmarkMatrixFollowThrough(input: {
  workspaceId: string;
  actorName: string;
  benchmarkRunId: string;
  actorUserId?: string | null;
  sourcePage?: string | null;
  commandSource?: string | null;
  requestEventId?: string | null;
  nextAction?: string | null;
  summary?: string | null;
}) {
  const benchmarkEvents = await db.runtimeEvent.findMany({
    where: {
      workspaceId: input.workspaceId,
      relatedObjectType: "Workspace",
      relatedObjectId: input.workspaceId,
      eventType: {
        in: [...BENCHMARK_MATRIX_EVENT_TYPES],
      },
    },
    select: {
      id: true,
      eventType: true,
      payload: true,
      trustedContext: true,
      triggeredBy: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 64,
  });
  const recordedRuns = parseRuntimeBenchmarkMatrixRunEvents(benchmarkEvents);
  const acknowledgements =
    parseRuntimeBenchmarkMatrixRunAcknowledgementEvents(benchmarkEvents);
  const followThrough = parseRuntimeBenchmarkMatrixFollowThroughEvents(benchmarkEvents);
  const benchmarkRun =
    recordedRuns.find((item) => item.benchmarkRunId === input.benchmarkRunId) ?? null;
  if (!benchmarkRun) {
    throw new Error(`Benchmark run ${input.benchmarkRunId} was not found.`);
  }
  const acknowledgement =
    acknowledgements.find((item) => item.benchmarkRunId === input.benchmarkRunId) ?? null;
  if (!acknowledgement) {
    throw new Error(
      `Benchmark run ${input.benchmarkRunId} must be acknowledged before follow-through can be resolved.`,
    );
  }

  const runHistory = followThrough.filter((item) => item.benchmarkRunId === input.benchmarkRunId);
  const latestOpen = input.requestEventId
    ? runHistory.find((item) => item.state === "open" && item.requestEventId === input.requestEventId) ?? null
    : runHistory.find((item) => item.state === "open" && item.requestEventId) ?? null;
  const latestResolved = input.requestEventId
    ? runHistory.find((item) => item.state === "resolved" && item.requestEventId === input.requestEventId) ?? null
    : runHistory.find((item) => item.state === "resolved" && item.resolutionEventId) ?? null;

  if (!latestOpen || (latestResolved?.resolvedAt?.getTime() ?? 0) >= (latestOpen.requestedAt?.getTime() ?? 0)) {
    if (latestResolved) {
      return {
        reused: true,
        requestEventId: latestResolved.requestEventId,
        resolutionEventId: latestResolved.resolutionEventId,
        benchmarkRunId: latestResolved.benchmarkRunId,
        state: latestResolved.state,
        resolvedAt: latestResolved.resolvedAt,
      };
    }
    throw new Error(
      `Benchmark run ${input.benchmarkRunId} does not have an open follow-through request to resolve.`,
    );
  }

  const nextAction = trimText(input.nextAction, 220);
  const summary =
    trimText(input.summary, 280) ||
    `Benchmark follow-through resolved for ${benchmarkRun.runLabel ?? benchmarkRun.benchmarkRunId}.`;

  const event = await createRuntimeUpgradeEvent({
    workspaceId: input.workspaceId,
    relatedObjectType: "Workspace",
    relatedObjectId: input.workspaceId,
    eventType: BENCHMARK_MATRIX_RUN_FOLLOW_THROUGH_RESOLVED_EVENT_TYPE,
    payload: {
      benchmarkRunId: benchmarkRun.benchmarkRunId,
      requestEventId: latestOpen.requestEventId,
      acknowledgementEventId:
        latestOpen.acknowledgementEventId ?? acknowledgement.acknowledgementEventId,
      runLabel: benchmarkRun.runLabel ?? null,
      summary,
      nextAction,
    },
    trustedContext: {
      actorUserId: input.actorUserId ?? null,
      sourcePage:
        input.sourcePage ?? latestOpen.sourcePage ?? acknowledgement.sourcePage ?? benchmarkRun.sourcePage ?? null,
      commandSource:
        input.commandSource ??
        latestOpen.commandSource ??
        acknowledgement.commandSource ??
        benchmarkRun.commandSource ??
        "benchmark:runtime-substrate",
    },
    triggeredBy: input.actorName,
  });

  return {
    reused: false,
    requestEventId: latestOpen.requestEventId,
    resolutionEventId: event.id,
    benchmarkRunId: benchmarkRun.benchmarkRunId,
    state: "resolved" as const,
    resolvedAt: event.createdAt,
  };
}

export async function runMeetingRuntimeVerificationPass(input: {
  workspaceId: string;
  meetingId: string;
}) {
  const meeting = await db.meeting.findFirst({
    where: {
      workspaceId: input.workspaceId,
      id: input.meetingId,
    },
    include: {
      workspace: true,
      opportunity: true,
      company: true,
      note: true,
    },
  });
  if (!meeting) {
    throw new Error("Meeting not found.");
  }

  const runtimeEvent = await db.runtimeEvent.findFirst({
    where: {
      workspaceId: input.workspaceId,
      meetingId: input.meetingId,
      eventType: "meeting.ended",
    },
    orderBy: { createdAt: "desc" },
  });
  if (!runtimeEvent) {
    throw new Error("No meeting runtime event found.");
  }

  const [factsBundle, riskBundle, actionPackBundle, memoryItems] = await Promise.all([
    db.artifactBundle.findFirst({
      where: { workspaceId: input.workspaceId, runtimeEventId: runtimeEvent.id, artifactType: "meeting_facts.json" },
      orderBy: { createdAt: "desc" },
    }),
    db.artifactBundle.findFirst({
      where: { workspaceId: input.workspaceId, runtimeEventId: runtimeEvent.id, artifactType: "risk_flags.json" },
      orderBy: { createdAt: "desc" },
    }),
    db.artifactBundle.findFirst({
      where: { workspaceId: input.workspaceId, runtimeEventId: runtimeEvent.id, artifactType: "action_pack.md" },
      orderBy: { createdAt: "desc" },
    }),
    db.memoryItem.findMany({
      where: {
        workspaceId: input.workspaceId,
        runtimeEventId: runtimeEvent.id,
      },
    }),
  ]);

  if (!factsBundle || !actionPackBundle) {
    throw new Error("Meeting runtime artifacts are incomplete.");
  }

  return syncMeetingRuntimeUpgradeReview({
    workspaceId: input.workspaceId,
    runtimeEventId: runtimeEvent.id,
    meeting,
    reviewMode: "confirm",
    factsBundle,
    riskBundle,
    actionPackBundle,
    memoryItems,
    reviewedAt: new Date(),
    reviewerId: null,
    reviewerName: "verification-agent",
    sourcePage: "/operating",
  });
}

export async function ingestRuntimeSignals(input: {
  workspaceId: string;
  meetingId?: string;
  opportunityId?: string;
  companyId?: string;
  signals: Array<{
    signalType: string;
    sourceType: string;
    sourceId: string;
    signalSummary: string;
    normalizedPayload?: Record<string, unknown>;
    truthWeight?: number;
  }>;
}) {
  const session = await db.runtimeSession.findFirst({
    where: {
      workspaceId: input.workspaceId,
      meetingId: input.meetingId ?? undefined,
    },
    orderBy: { createdAt: "desc" },
  });
  if (!session) {
    throw new Error("No active runtime session found for signal ingest.");
  }

  const created = [];
  for (const signal of input.signals) {
    const signalKey = `${input.workspaceId}:signal:${session.id}:${signal.signalType}:${signal.sourceId}`;
    const item = await db.signalEvent.upsert({
      where: { signalKey },
      update: {
        signalSummary: signal.signalSummary,
        normalizedPayload: signal.normalizedPayload ? jsonStringify(signal.normalizedPayload) : null,
        truthWeight: signal.truthWeight ?? 50,
      },
      create: {
        workspaceId: input.workspaceId,
        runtimeSessionId: session.id,
        meetingId: input.meetingId,
        opportunityId: input.opportunityId,
        companyId: input.companyId,
        signalKey,
        signalType: signal.signalType,
        sourceType: signal.sourceType,
        signalSummary: signal.signalSummary,
        normalizedPayload: signal.normalizedPayload ? jsonStringify(signal.normalizedPayload) : null,
        truthWeight: signal.truthWeight ?? 50,
      },
    });
    created.push(item);
    await createRuntimeUpgradeEvent({
      workspaceId: input.workspaceId,
      meetingId: input.meetingId ?? null,
      opportunityId: input.opportunityId ?? null,
      companyId: input.companyId ?? null,
      relatedObjectType: "SignalEvent",
      relatedObjectId: item.id,
      eventType: "signal.ingested",
      payload: {
        signalType: item.signalType,
        sourceType: item.sourceType,
        truthWeight: item.truthWeight,
      },
      trustedContext: {
        runtimeSessionId: session.id,
      },
      triggeredBy: "helm-core",
    });
  }

  await refreshRuntimeCoordinationMetrics(input.workspaceId);

  return created;
}

export async function promoteRuntimeMemory(input: {
  workspaceId: string;
  meetingId: string;
}) {
  const session = await db.runtimeSession.findFirst({
    where: {
      workspaceId: input.workspaceId,
      meetingId: input.meetingId,
    },
    orderBy: { createdAt: "desc" },
  });
  if (!session) {
    throw new Error("No runtime session found.");
  }

  const candidates = await db.memoryCandidate.findMany({
    where: {
      workspaceId: input.workspaceId,
      runtimeSessionId: session.id,
    },
  });

  let createdPromotions = 0;
  for (const candidate of candidates) {
    const promotionKey = `${input.workspaceId}:memory-promotion:${candidate.memoryItemId ?? candidate.id}`;
    const decisionStatus =
      candidate.status === "PROMOTED"
        ? "PROMOTED"
        : candidate.status === "REJECTED"
          ? "REJECTED"
          : "DEFERRED";
    const rationale =
      candidate.reviewerNote ??
      (decisionStatus === "PROMOTED"
        ? "Candidate was already promoted during human confirm and is now reflected in the explicit promotion ledger."
        : decisionStatus === "REJECTED"
          ? "Candidate was rejected during review and remains out of promoted memory."
          : "Candidate stays deferred because the current meeting loop still lacks enough source-grounded confidence for quiet promotion.");

    const existing = await db.memoryPromotion.findUnique({ where: { promotionKey } });
    const promotion = existing
      ? await db.memoryPromotion.update({
          where: { id: existing.id },
          data: {
            memoryCandidateId: candidate.id,
            memoryItemId: candidate.memoryItemId ?? undefined,
            status: decisionStatus,
            rationale,
          },
        })
      : await db.memoryPromotion.create({
          data: {
            workspaceId: input.workspaceId,
            runtimeSessionId: session.id,
            memoryCandidateId: candidate.id,
            memoryItemId: candidate.memoryItemId ?? undefined,
            promotionKey,
            status: decisionStatus,
            rationale,
          },
        });
    createdPromotions += existing ? 0 : 1;
    if (decisionStatus === "PROMOTED") {
      await createRuntimeUpgradeEvent({
        workspaceId: input.workspaceId,
        meetingId: input.meetingId,
        relatedObjectType: "MemoryPromotion",
        relatedObjectId: promotion.id,
        eventType: "memory-promotion.approved",
        payload: {
          memoryCandidateId: candidate.id,
          memoryItemId: candidate.memoryItemId ?? null,
        },
        trustedContext: {
          runtimeSessionId: session.id,
        },
        triggeredBy: "verification-agent",
      });
    }
  }

  await refreshRuntimeCoordinationMetrics(input.workspaceId);

  return {
    createdPromotions,
    totalCandidates: candidates.length,
  };
}

export async function getRuntimeSessionTrace(workspaceId: string, sessionId: string) {
  const [workspace, session] = await Promise.all([
    db.workspace.findUnique({
      where: { id: workspaceId },
      select: { featureFlagsJson: true },
    }),
    db.runtimeSession.findFirst({
      where: {
        workspaceId,
        id: sessionId,
      },
      include: {
        persistedPayloads: { orderBy: { createdAt: "asc" } },
        contextEditEvents: { orderBy: { createdAt: "asc" } },
        notebook: true,
        checkpoints: { orderBy: { createdAt: "desc" } },
        verificationReports: { orderBy: { createdAt: "desc" } },
        memoryCandidates: { orderBy: { createdAt: "desc" } },
        memoryPromotions: { orderBy: { createdAt: "desc" } },
        signalEvents: { orderBy: { createdAt: "desc" } },
        truthConflicts: { orderBy: { createdAt: "desc" } },
        worldModelSnapshots: { orderBy: { createdAt: "desc" } },
        problemSpaces: { orderBy: { createdAt: "desc" } },
        edgeBriefs: { orderBy: { createdAt: "desc" } },
        compositionFailures: { orderBy: { createdAt: "desc" } },
        promptCacheTelemetry: { orderBy: { createdAt: "desc" } },
        consolidationJobs: { orderBy: { createdAt: "desc" } },
        handoffPackets: { orderBy: { createdAt: "desc" } },
        initiativeRuns: { orderBy: { createdAt: "desc" } },
      },
    }),
  ]);
  if (!session) return null;
  const workspaceFeatureFlags = parseWorkspaceFeatureFlags(workspace?.featureFlagsJson);

  const artifactBundles = session.meetingId
    ? await db.artifactBundle.findMany({
        where: {
          workspaceId,
          meetingId: session.meetingId,
        },
        orderBy: { createdAt: "desc" },
        take: 12,
      })
    : [];
  const [
    artifactVersions,
    capabilities,
    coordinationMetrics,
    humanExecutions,
    officialWriteIntents,
    limitedAutoIntents,
    officialFollowThrough,
    connectors,
    remediationEvents,
    benchmarkMatrixEvents,
    workspacePilotReview,
    traceCohortMetadata,
  ] =
    await Promise.all([
    artifactBundles.length
      ? db.artifactVersion.findMany({
          where: {
            workspaceId,
            artifactBundleId: {
              in: artifactBundles.map((item) => item.id),
            },
          },
          orderBy: { createdAt: "desc" },
          take: 12,
        })
      : Promise.resolve([]),
    db.capabilityCatalogEntry.findMany({
      where: { workspaceId },
      orderBy: [{ stage: "asc" }, { name: "asc" }],
      take: 12,
    }),
    db.coordinationMetricsDaily.findFirst({
      where: { workspaceId },
      orderBy: { metricDate: "desc" },
    }),
    session.meetingId
      ? db.humanActionExecution.findMany({
          where: {
            workspaceId,
            meetingId: session.meetingId,
          },
          select: {
            id: true,
            meetingId: true,
            opportunityId: true,
            companyId: true,
            status: true,
            acknowledgementStatus: true,
            executionIntent: true,
            executionOwnerName: true,
            followThroughStatus: true,
            executedAt: true,
            updatedAt: true,
          },
          orderBy: { updatedAt: "desc" },
          take: 8,
        })
      : Promise.resolve([]),
    session.meetingId
      ? db.officialWriteIntent.findMany({
          where: {
            workspaceId,
            meetingId: session.meetingId,
          },
          select: {
            id: true,
            meetingId: true,
            opportunityId: true,
            companyId: true,
            writeActionType: true,
            officialObjectRef: true,
            writeExecutionStatus: true,
            writeAcknowledgementStatus: true,
            acknowledgedAt: true,
            updatedAt: true,
          },
          orderBy: { updatedAt: "desc" },
          take: 8,
        })
      : Promise.resolve([]),
    session.meetingId
      ? db.limitedAutoIntent.findMany({
          where: {
            workspaceId,
            meetingId: session.meetingId,
          },
          select: {
            id: true,
            meetingId: true,
            opportunityId: true,
            companyId: true,
            limitedAutoActionType: true,
            officialObjectRef: true,
            limitedAutoExecutionStatus: true,
            limitedAutoAckStatus: true,
            acknowledgedAt: true,
            updatedAt: true,
          },
          orderBy: { updatedAt: "desc" },
          take: 8,
        })
      : Promise.resolve([]),
    session.meetingId
      ? db.officialFollowThrough.findMany({
          where: {
            workspaceId,
            meetingId: session.meetingId,
          },
          select: {
            id: true,
            meetingId: true,
            opportunityId: true,
            companyId: true,
            followThroughStatus: true,
            followThroughResolutionStatus: true,
            followThroughSummary: true,
            followThroughNextAction: true,
            updatedAt: true,
          },
          orderBy: { updatedAt: "desc" },
          take: 8,
        })
      : Promise.resolve([]),
    db.connector.findMany({
      where: { workspaceId },
      select: {
        id: true,
        provider: true,
        status: true,
        lastSyncedAt: true,
        lastSyncStatus: true,
        lastSyncMessage: true,
      },
      orderBy: [{ provider: "asc" }, { updatedAt: "desc" }],
      take: 12,
    }),
    db.runtimeEvent.findMany({
      where: {
        workspaceId,
        relatedObjectType: "RuntimeSession",
        relatedObjectId: session.id,
        OR: [
          {
            eventType: {
              startsWith: "continuity.remediation.",
            },
          },
          {
            eventType: {
              in: [...RUNTIME_SESSION_CONTROL_EVENT_TYPES],
            },
          },
        ],
      },
      select: {
        id: true,
        eventType: true,
        payload: true,
        trustedContext: true,
        triggeredBy: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
    db.runtimeEvent.findMany({
      where: {
        workspaceId,
        relatedObjectType: "Workspace",
        relatedObjectId: workspaceId,
        eventType: {
          in: [...BENCHMARK_MATRIX_EVENT_TYPES],
        },
      },
      select: {
        id: true,
        eventType: true,
        payload: true,
        trustedContext: true,
        triggeredBy: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    getWorkspaceContinuityPilotReview(workspaceId),
    getRuntimeContinuityTraceCohortMetadata({
      workspaceId,
      sessionId: session.id,
      meetingId: session.meetingId,
      opportunityId: session.opportunityId,
      companyId: session.companyId,
      updatedAt: session.updatedAt,
    }),
  ]);
  const benchmarkMatrixRuns = parseRuntimeBenchmarkMatrixRunEvents(benchmarkMatrixEvents);
  const benchmarkExecutionRequests =
    parseRuntimeBenchmarkMatrixRunRequestEvents(benchmarkMatrixEvents);
  const benchmarkExecutionAcknowledgements =
    parseRuntimeBenchmarkMatrixRunAcknowledgementEvents(benchmarkMatrixEvents);
  const benchmarkExecutionFollowThrough =
    parseRuntimeBenchmarkMatrixFollowThroughEvents(benchmarkMatrixEvents);
  const latestCheckpoint = selectRuntimeContinuityCheckpoint(session.checkpoints, session.resumedFromKey);
  const swarmBudgetPosture = buildBudgetPosture({
    budgetTokenLimit: session.budgetTokenLimit,
    budgetTokenUsed: session.budgetTokenUsed,
    prunedTokenCount: session.prunedTokenCount,
    latestCheckpointStatus: latestCheckpoint?.status,
    resumedFromKey: session.resumedFromKey,
  });
  const continuityState = buildRuntimeContinuityState({
    sessionLabel: session.label,
    sessionStatus: session.status,
    boundaryNote: session.boundaryNote,
    notebook: session.notebook
      ? {
          sessionSummary: session.notebook.sessionSummary,
          decisionSummary: session.notebook.decisionSummary,
          blockerSummary: session.notebook.blockerSummary,
          pendingQuestions: session.notebook.pendingQuestions,
          openLoopSummary: session.notebook.openLoopSummary,
          boundaryNote: session.notebook.boundaryNote,
        }
      : null,
    verification: session.verificationReports[0]
      ? {
          status: session.verificationReports[0].status.toLowerCase(),
          blockedReasons: safeParseJson<string[]>(session.verificationReports[0].blockedReasons, []),
        }
      : null,
    problemSpaces: session.problemSpaces.map((item) => ({
      title: item.title,
      nextStep: item.nextStep,
      status: item.status,
      ownerHint: item.ownerHint,
      evidenceRefs: parseRuntimeStringList(item.evidenceRefs),
    })),
    promotedFacts: buildPromotedRuntimeFacts(session.memoryCandidates, session.memoryPromotions),
    truthConflicts: (session.truthConflicts ?? []).map((item) => ({
      status: item.status,
      summary: item.summary,
    })),
    budgetTokenLimit: session.budgetTokenLimit,
    budgetTokenUsed: session.budgetTokenUsed,
    prunedTokenCount: session.prunedTokenCount,
    latestCheckpoint: latestCheckpoint
      ? {
          id: latestCheckpoint.id,
          label: latestCheckpoint.label,
          status: latestCheckpoint.status,
          summary: latestCheckpoint.summary,
          snapshotJson: latestCheckpoint.snapshotJson,
          updatedAt: latestCheckpoint.updatedAt,
        }
      : null,
    resumedFromKey: session.resumedFromKey,
    persistedPayloads: session.persistedPayloads.map((item) => ({
      handle: item.handle,
      label: item.label,
      summary: item.summary,
      estimatedTokens: item.estimatedTokens,
      sourceType: item.sourceType,
    })),
    contextEditEvents: session.contextEditEvents.map((item) => ({
      id: item.id,
      strategy: item.strategy,
      beforeTokenCount: item.beforeTokenCount,
      afterTokenCount: item.afterTokenCount,
      removedHandles: item.removedHandles,
      removedSummary: item.removedSummary,
      createdAt: item.createdAt,
    })),
  });
  const remediationTrace = parseRuntimeRemediationTrace(
    remediationEvents.filter((event) => event.eventType.startsWith("continuity.remediation.")),
  );
  const controlEvents = remediationEvents.filter((event) =>
    isRuntimeSessionControlEventType(event.eventType),
  );
  const swarmSpawnRequestEvent = parseRuntimeSwarmSpawnRequestedEvent(controlEvents);
  const swarmReadOnlyWorkerIntentEvent =
    parseRuntimeSwarmReadOnlyWorkerIntentRecordedEvent(controlEvents);
  const swarmReadOnlyWorkerPlaceholderEvent =
    parseRuntimeSwarmReadOnlyWorkerPlaceholderRecordedEvent(controlEvents);
  const swarmReadOnlyWorkerExecutionEvent =
    parseRuntimeSwarmReadOnlyWorkerExecutionRecordedEvent(controlEvents);
  const swarmReadOnlyWorkerMaterializationEvent =
    parseRuntimeSwarmReadOnlyWorkerMaterializationRecordedEvent(controlEvents);
  const swarmReadOnlyWorkerAdoptionEvent =
    parseRuntimeSwarmReadOnlyWorkerAdoptionRecordedEvent(controlEvents);
  const swarmVerificationMergeLaneEvent =
    parseRuntimeSwarmVerificationMergeLaneRecordedEvent(controlEvents);
  const takeoverRequestEvent = parseRuntimeTakeoverRequestEvent(controlEvents);
  const takeoverAcknowledgementEvent = parseRuntimeTakeoverAcknowledgementEvent(controlEvents);
  const takeoverStartedEvent = parseRuntimeTakeoverStartedEvent(controlEvents);
  const takeoverReleasedEvent = parseRuntimeTakeoverReleasedEvent(controlEvents);
  const takeoverFollowThroughRequestEvent =
    parseRuntimeTakeoverFollowThroughRequestedEvent(controlEvents);
  const takeoverFollowThroughResolvedEvent =
    parseRuntimeTakeoverFollowThroughResolvedEvent(controlEvents);
  const settlementReviewRequestedEvent =
    parseRuntimeSettlementReviewRequestedEvent(controlEvents);
  const settlementReviewResolvedEvent =
    parseRuntimeSettlementReviewResolvedEvent(controlEvents);
  const closeoutConfirmedEvent = parseRuntimeCloseoutConfirmedEvent(controlEvents);
  const closeoutRefreshRequestedEvent =
    parseRuntimeCloseoutRefreshRequestedEvent(controlEvents);
  const closeoutResolutionRecordedEvent =
    parseRuntimeCloseoutResolutionRecordedEvent(controlEvents);
  const closeoutResolutionFollowThroughRequestedEvent =
    parseRuntimeCloseoutResolutionFollowThroughRequestedEvent(controlEvents);
  const closeoutResolutionFollowThroughResolvedEvent =
    parseRuntimeCloseoutResolutionFollowThroughResolvedEvent(controlEvents);
  const closeRequestRequestedEvent = parseRuntimeCloseRequestedEvent(controlEvents);
  const humanInputRequestEvent = parseRuntimeHumanInputCheckpointRequestEvent(controlEvents);
  const humanInputAcknowledgementEvent =
    parseRuntimeHumanInputCheckpointAcknowledgementEvent(controlEvents);
  const operatorArtifacts = buildRuntimeContinuityOperatorArtifacts({
    replay: continuityState.replay,
    recovery: continuityState.recovery,
    risk: continuityState.risk,
    payloadState: continuityState.payloadState,
    notebookState: continuityState.notebookState,
    pruneTrace: continuityState.pruneTrace,
    remediationTrace,
  });
  const continuityMeetingShape = getRuntimeContinuityMeetingShape({
    posture: continuityState.budgetPosture.state,
    replayStatus:
      continuityState.replay?.fidelityStatus === "STRONG"
        ? "STRONG"
        : continuityState.replay?.fidelityStatus === "WATCH"
          ? "WATCH"
          : continuityState.replay?.fidelityStatus === "WEAK"
            ? "WEAK"
            : "NONE",
    payloadStateSource: continuityState.payloadState.stateSource,
  });
  const pilotReview = buildRuntimeContinuityPilotSessionReview({
    recovery: operatorArtifacts.recovery,
    calibration: operatorArtifacts.calibration,
    analytics: operatorArtifacts.analytics,
    effectiveness: operatorArtifacts.effectiveness,
    pilotReview: workspacePilotReview,
    cohortContext: {
      workspaceSizeBand: workspacePilotReview?.workspaceCohort.sizeBand ?? "SMALL",
      meetingShape: continuityMeetingShape,
      sessionDensityBand: getRuntimeContinuitySessionDensityBand({
        posture: continuityState.budgetPosture.state,
        budgetTokenLimit: session.budgetTokenLimit,
        budgetTokenUsed: session.budgetTokenUsed,
        prunedTokenCount: session.prunedTokenCount,
      }),
      meetingFrequencyBand: traceCohortMetadata.meetingFrequencyBand,
      failureHistoryBand: getRuntimeContinuityFailureHistoryBand({
        remediationAttempts: operatorArtifacts.analytics.totalAttempts,
        repeatPatternStatus: operatorArtifacts.analytics.repeatPattern.status,
      }),
      participantRolePosture: traceCohortMetadata.participantRolePosture,
    },
  });
  const sop = buildRuntimeContinuitySop({
    recovery: operatorArtifacts.recovery,
    analytics: operatorArtifacts.analytics,
    effectiveness: operatorArtifacts.effectiveness,
    evidence: operatorArtifacts.evidence,
    pilotReview,
  });
  const runThread = buildRunThreadContract({
    id: session.id,
    workspaceId: session.workspaceId,
    sessionKey: session.sessionKey,
    status: session.status,
    currentStage: session.currentStage,
    sourcePage: session.sourcePage,
    boundaryNote: session.boundaryNote,
    meetingId: session.meetingId,
    opportunityId: session.opportunityId,
    companyId: session.companyId,
    swarmReadOnlyWorkersEnabled: workspaceFeatureFlags.swarmReadOnlyWorkers,
    swarmBudgetEnvelope: {
      budgetTokenLimit: session.budgetTokenLimit,
      budgetTokenUsed: session.budgetTokenUsed,
      usagePercent: swarmBudgetPosture.usagePercent,
      prunedTokenCount: session.prunedTokenCount,
      posture: swarmBudgetPosture.state,
    },
    replayableEventLog: session.replayableEventLog,
    resumedFromKey: session.resumedFromKey,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    closedAt: session.closedAt,
    checkpoints: session.checkpoints.map((item) => ({
      id: item.id,
      checkpointKey: item.checkpointKey,
      label: item.label,
      status: item.status,
      summary: item.summary,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    })),
    persistedControlPlaneLifecycle: readPersistedRunThreadControlPlaneLifecycle(session),
    handoffPackets: session.handoffPackets.map((item) => mapRunThreadLifecycleHandoffPacket(item)),
    remediationTrace: remediationTrace.map((item) => mapRunThreadLifecycleRemediationEntry(item)),
    swarmSpawnRequestEvent,
    swarmReadOnlyWorkerIntentEvent,
    swarmReadOnlyWorkerPlaceholderEvent,
    swarmReadOnlyWorkerExecutionEvent,
    swarmReadOnlyWorkerMaterializationEvent,
    swarmReadOnlyWorkerAdoptionEvent,
    swarmVerificationMergeLaneEvent,
    verification: session.verificationReports[0]
      ? {
          status:
            normalizeRunThreadVerificationStatus(session.verificationReports[0].status) ??
            "needs_review",
          blockedReasons: safeParseJson<string[]>(
            session.verificationReports[0].blockedReasons,
            [],
          ),
          summary: session.verificationReports[0].summary,
        }
      : null,
    truthConflicts: (session.truthConflicts ?? []).map((item) => ({
      status: normalizeRunThreadTruthConflictState(item.status) ?? "open",
      summary: item.summary,
    })),
    requestLifecycleEntries: buildRunThreadRequestLifecycleInputs({
      takeoverRequestEvent,
      takeoverAcknowledgementEvent,
      takeoverStartedEvent,
      takeoverReleasedEvent,
      takeoverFollowThroughRequestEvent,
      takeoverFollowThroughResolvedEvent,
      humanInputRequestEvent,
      humanInputAcknowledgementEvent,
    }),
    settlementReviewEntries: buildRunThreadSettlementLifecycleInputs({
      settlementReviewRequestedEvent,
      settlementReviewResolvedEvent,
    }),
    closeoutConfirmationEntries: buildRunThreadCloseoutConfirmationLifecycleInputs({
      closeoutConfirmedEvent,
    }),
    closeoutRefreshEntries: buildRunThreadCloseoutRefreshLifecycleInputs({
      closeoutRefreshRequestedEvent,
    }),
    closeoutResolutionEntries: buildRunThreadCloseoutResolutionLifecycleInputs({
      closeoutResolutionRecordedEvent,
    }),
    closeoutResolutionFollowThroughEntries:
      buildRunThreadCloseoutResolutionFollowThroughLifecycleInputs({
        closeoutResolutionFollowThroughRequestedEvent,
        closeoutResolutionFollowThroughResolvedEvent,
      }),
    closeRequestEntries: buildRunThreadCloseRequestLifecycleInputs({
      closeRequestRequestedEvent,
    }),
    resultAcknowledgements: buildRunThreadResultAcknowledgementInputs({
      context: {
        meetingId: session.meetingId,
        opportunityId: session.opportunityId,
        companyId: session.companyId,
      },
      humanExecutions: humanExecutions.map((item) => ({
        ...item,
        status: String(item.status).toUpperCase(),
        executionAcknowledgementStatus: String(item.acknowledgementStatus).toUpperCase(),
      })),
      officialWriteIntents: officialWriteIntents.map((item) => ({
        ...item,
        writeActionType: String(item.writeActionType),
        writeExecutionStatus: String(item.writeExecutionStatus).toUpperCase(),
        writeAcknowledgementStatus: String(item.writeAcknowledgementStatus).toUpperCase(),
      })),
      limitedAutoIntents: limitedAutoIntents.map((item) => ({
        ...item,
        limitedAutoActionType: String(item.limitedAutoActionType),
        limitedAutoExecutionStatus: String(item.limitedAutoExecutionStatus).toUpperCase(),
        limitedAutoAckStatus: String(item.limitedAutoAckStatus).toUpperCase(),
      })),
      officialFollowThrough: officialFollowThrough.map((item) => ({
        ...item,
        followThroughStatus: String(item.followThroughStatus).toUpperCase(),
        followThroughResolutionStatus: String(item.followThroughResolutionStatus).toUpperCase(),
      })),
    }),
  });
  const debuggerReadModel = buildOperatorDebuggerReadModel({
    sessionLabel: session.label,
    runThread,
    replayableEventLog: session.replayableEventLog,
    replay: continuityState.replay,
    recovery: operatorArtifacts.recovery,
    notebookState: continuityState.notebookState,
    payloadState: continuityState.payloadState,
    verification: session.verificationReports[0]
      ? {
          status: session.verificationReports[0].status,
          blockedReasons: safeParseJson<string[]>(session.verificationReports[0].blockedReasons, []),
        }
      : null,
    contextEditEvents: session.contextEditEvents.map((item) => ({
      id: item.id,
      strategy: item.strategy,
      beforeTokenCount: item.beforeTokenCount,
      afterTokenCount: item.afterTokenCount,
      removedSummary: item.removedSummary,
      createdAt: item.createdAt,
    })),
    remediationTrace: remediationTrace.map((item) => ({
      id: item.id,
      action: item.action,
      executionStatus: item.executionStatus,
      summary: item.summary,
      rollbackAnchorSummary: item.rollbackAnchorSummary,
      triggeredBy: item.triggeredBy,
      createdAt: item.createdAt,
    })),
    handoffPackets: session.handoffPackets.map((item) => ({
      id: item.id,
      packetKey: item.packetKey,
      fromAgent: normalizeRuntimeAgentId(item.fromAgent),
      toAgent: normalizeRuntimeAgentId(item.toAgent),
      goal: item.goal,
      approvalTier: normalizeRuntimeApprovalTier(item.approvalTier),
      constraintsJson: item.constraintsJson,
      trustedRefs: item.trustedRefs,
      untrustedRefs: item.untrustedRefs,
      requiredOutputs: item.requiredOutputs,
      evidenceRefs: item.evidenceRefs,
      notebookRef: item.notebookRef,
      checkpointRef: item.checkpointRef,
      createdAt: item.createdAt,
    })),
    takeoverRequestEvent,
    takeoverAcknowledgementEvent,
    takeoverStartEvent: takeoverStartedEvent,
    takeoverReleaseEvent: takeoverReleasedEvent,
    takeoverFollowThroughRequestEvent,
    takeoverFollowThroughResolvedEvent,
    humanInputRequestEvent,
    humanInputAcknowledgementEvent,
  });
  const projectSkillLibrary = buildProjectSkillLibraryReadModel({
    capabilitySignals: capabilities.map((item) => ({
      id: item.id,
      name: item.name,
      stage: item.stage,
      description: item.description,
      loadPolicy: item.loadPolicy,
      reviewRequired: item.reviewRequired,
      boundaryNote: item.boundaryNote,
    })),
  });
  const environmentContract = buildEnvironmentContractReadModel({
    projectSkillLibrary,
    connectors: connectors.map((item) => ({
      id: item.id,
      provider: String(item.provider),
      status: String(item.status),
      lastSyncedAt: item.lastSyncedAt ?? null,
      lastSyncStatus: item.lastSyncStatus ?? null,
      lastSyncMessage: item.lastSyncMessage ?? null,
    })),
    officialActionCoverage: getRicherOfficialActionCoverageCatalog().map((item) => ({
      actionType: item.actionType,
      defaultPath: item.defaultPath,
      limitedAutoStatus: item.limitedAutoStatus,
      executableLimitedAuto: item.executableLimitedAuto,
      boundaryReason: item.boundaryReason,
    })),
    officialWriteIntents: officialWriteIntents.map((item) => ({
      ...item,
      actionType: String(item.writeActionType),
      acknowledgementStatus: String(item.writeAcknowledgementStatus).toUpperCase(),
    })),
    limitedAutoIntents: limitedAutoIntents.map((item) => ({
      ...item,
      actionType: String(item.limitedAutoActionType),
      acknowledgementStatus: String(item.limitedAutoAckStatus).toUpperCase(),
    })),
    officialFollowThrough: officialFollowThrough.map((item) => ({
      ...item,
      followThroughStatus: String(item.followThroughStatus).toUpperCase(),
      followThroughResolutionStatus: String(item.followThroughResolutionStatus).toUpperCase(),
    })),
    humanExecutionCount: humanExecutions.length,
    officialFollowThroughCount: officialFollowThrough.length,
  });
  const benchmarkMatrix = buildBenchmarkMatrixReadModel({
    recordedRuns: benchmarkMatrixRuns,
    executionRequests: benchmarkExecutionRequests,
    executionAcknowledgements: benchmarkExecutionAcknowledgements,
    executionFollowThrough: benchmarkExecutionFollowThrough,
  });
  const operatorControlSummary = buildRuntimeOperatorControlSummary({
    environmentContract,
    benchmarkMatrix,
  });
  const swarmOperatorControlSurface = buildRuntimeSwarmOperatorControlSurface({
    items: [
      {
        id: session.id,
        meetingId: session.meetingId,
        title: session.label,
        href: buildRuntimeSessionHref(session.meetingId),
        updatedAt: session.updatedAt,
        latestCheckpointId: latestCheckpoint?.id ?? null,
        latestCheckpointKey: latestCheckpoint?.checkpointKey ?? null,
        resumeState: runThread.resume.state,
        resumeAskMode: debuggerReadModel.resumeAsk.mode,
        interruptReasonState: debuggerReadModel.interruptReason.state,
        recoveryState: continuityState.recovery.state,
        humanInputCheckpointState: runThread.humanInputCheckpoint.state,
        humanInputCheckpointId: runThread.humanInputCheckpoint.checkpointId,
        humanInputCheckpointKey: runThread.humanInputCheckpoint.checkpointKey,
        humanInputRequestState: debuggerReadModel.humanInputRequest.state,
        closeRequestState: runThread.closeRequest.state,
        closeRequestCheckpointId: runThread.closeRequest.checkpointId,
        closeRequestCheckpointKey: runThread.closeRequest.checkpointKey,
        takeoverRequestState: debuggerReadModel.takeoverRequest.state,
        takeoverActivationState: debuggerReadModel.takeoverActivation.state,
        takeoverFollowThroughState: debuggerReadModel.takeoverFollowThrough.state,
        takeoverOwner: debuggerReadModel.takeoverActivation.currentOwner,
        swarmBudgetPosture: runThread.swarmSpawnBudgetEnvelope.budgetPosture,
        swarmSpawnDenyReason: debuggerReadModel.swarmSpawnContract.denyReason,
        repeatPatternStatus: operatorArtifacts.analytics.repeatPattern.status,
      },
    ],
  });
  const operatorProgressSummary = buildRuntimeOperatorProgressSummary({
    requestPosture: runThread.requestPosture,
    takeoverActivation: debuggerReadModel.takeoverActivation,
    operatorControlSummary,
    closePostureForwardSummary: runThread.closePostureForwardSummary,
  });
  const operatorActionSummary = buildRuntimeOperatorActionSummary({
    operatorProgressSummary,
    requestPosture: runThread.requestPosture,
    takeoverActivation: debuggerReadModel.takeoverActivation,
    closePostureForwardSummary: runThread.closePostureForwardSummary,
  });
  operatorActionSummary.focusTitle = session.label;
  operatorActionSummary.focusHref = buildRuntimeSessionHref(session.meetingId);

  return {
    ...session,
    runThread,
    debugger: debuggerReadModel,
    artifactVersions,
    capabilities,
    projectSkillLibrary,
    environmentContract,
    benchmarkMatrix,
    operatorControlSummary,
    swarmOperatorControlSurface,
    operatorActionSummary,
    operatorProgressSummary,
    coordinationMetrics,
    derivedContinuity: {
      budgetPosture: continuityState.budgetPosture,
      notebookState: continuityState.notebookState,
      replay: continuityState.replay,
      recovery: operatorArtifacts.recovery,
      calibration: operatorArtifacts.calibration,
      pruneTrace: continuityState.pruneTrace,
      remediationTrace,
      analytics: operatorArtifacts.analytics,
      effectiveness: operatorArtifacts.effectiveness,
      evidence: operatorArtifacts.evidence,
      runbook: operatorArtifacts.runbook,
      pilotReview,
      sop,
      payloadState: {
        activeHandles: continuityState.payloadState.activeHandles,
        prunedHandles: continuityState.payloadState.prunedHandles,
        stateDerivation: continuityState.payloadState.stateSummary,
      },
      payloads: session.persistedPayloads.map((item) => ({
        handle: item.handle,
        label: item.label,
        preview: item.preview,
        summary: item.summary,
        loadPolicy: item.loadPolicy,
        sourceType: item.sourceType,
        estimatedTokens: item.estimatedTokens,
        activeInContext: continuityState.payloadState.activeHandles.includes(item.handle),
      })),
    },
  };
}

export async function createRuntimeProblemSpace(input: {
  workspaceId: string;
  sessionId?: string;
  meetingId?: string;
  title: string;
  summary: string;
  nextStep: string;
  ownerHint?: string | null;
  assignedUserId?: string | null;
  assignedUserName?: string | null;
  assignedByUserId?: string | null;
  assignedByName: string;
  evidenceRefs?: string[];
  status?: "DETECTED" | "SCOPED" | "WATCHING" | "WAITING_ON_SIGNAL" | "WAITING_ON_AUTHORITY";
}) {
  const runtimeSession = input.sessionId
    ? await db.runtimeSession.findFirst({
        where: {
          workspaceId: input.workspaceId,
          id: input.sessionId,
        },
      })
    : await db.runtimeSession.findFirst({
        where: {
          workspaceId: input.workspaceId,
          meetingId: input.meetingId ?? undefined,
        },
        orderBy: { createdAt: "desc" },
      });
  if (!runtimeSession) {
    throw new Error("No runtime session found for problem-space creation.");
  }

  const evidenceRefs = Array.from(new Set((input.evidenceRefs ?? []).map((item) => item.trim()).filter(Boolean)));
  const requestedStatus = input.status ?? "SCOPED";
  const requiresGroundedEvidence = requestedStatus === "DETECTED" || requestedStatus === "SCOPED";
  if (requiresGroundedEvidence && evidenceRefs.length === 0) {
    throw new Error("Verified coordination problem spaces need evidence refs unless they stay in waiting/review posture.");
  }

  const keySuffix = crypto.randomUUID().slice(0, 8);
  const problemKey = `${input.workspaceId}:problem-space:manual:${runtimeSession.id}:${keySuffix}`;
  const problemSpace = await db.problemSpace.create({
    data: {
      workspaceId: input.workspaceId,
      runtimeSessionId: runtimeSession.id,
      meetingId: runtimeSession.meetingId ?? undefined,
      opportunityId: runtimeSession.opportunityId ?? undefined,
      companyId: runtimeSession.companyId ?? undefined,
      sourceWorldModelKey: null,
      problemKey,
      title: trimText(input.title, 120),
      summary: trimText(input.summary, 400),
      nextStep: trimText(input.nextStep, 220),
      status: requestedStatus,
      evidenceRefs: jsonStringify(evidenceRefs),
      ownerHint: input.ownerHint ?? input.assignedUserName ?? null,
    },
  });
  await createRuntimeUpgradeEvent({
    workspaceId: input.workspaceId,
    meetingId: runtimeSession.meetingId ?? null,
    opportunityId: runtimeSession.opportunityId ?? null,
    companyId: runtimeSession.companyId ?? null,
    relatedObjectType: "ProblemSpace",
    relatedObjectId: problemSpace.id,
    eventType: "problem-space.created",
    payload: {
      title: problemSpace.title,
      nextStep: problemSpace.nextStep,
      status: problemSpace.status,
      source: "manual_operator_create",
    },
    trustedContext: {
      runtimeSessionId: runtimeSession.id,
    },
    triggeredBy: "handoff-manager",
  });

  const coordinationOutcome =
    input.status === "WAITING_ON_AUTHORITY"
      ? "waiting_on_authority"
      : input.status === "WAITING_ON_SIGNAL"
        ? "waiting_on_signal"
      : input.status === "WATCHING"
        ? "review_needed"
        : "action_ready";
  await syncProblemSpaceRuntimeObjects({
    workspaceId: input.workspaceId,
    runtimeSessionId: runtimeSession.id,
    problemSpace,
    meetingId: runtimeSession.meetingId,
    assignedUserId: input.assignedUserId ?? null,
    assignedUserName: input.assignedUserName ?? input.ownerHint ?? null,
    assignedByUserId: input.assignedByUserId ?? null,
    assignedByName: input.assignedByName,
    assignmentNote: "Manually created from the runtime operator surface using explicit grounded evidence or review posture.",
    evidenceRefs,
    coordinationOutcome,
  });

  await refreshRuntimeCoordinationMetrics(input.workspaceId);

  return problemSpace;
}

export async function confirmRuntimeArtifact(input: {
  workspaceId: string;
  artifactBundleId: string;
  reviewerName: string;
  reviewerUserId?: string | null;
  decision?: "confirm" | "reject" | "keep_draft";
  reviewNotes?: string | null;
}) {
  const bundle = await db.artifactBundle.findFirst({
    where: {
      workspaceId: input.workspaceId,
      id: input.artifactBundleId,
    },
    include: {
      artifactReview: true,
    },
  });
  if (!bundle) {
    throw new Error("Artifact bundle not found.");
  }

  const runtimeSession =
    (bundle.runtimeEventId
      ? await db.runtimeSession.findFirst({
          where: {
            workspaceId: input.workspaceId,
            runtimeEventId: bundle.runtimeEventId,
          },
          orderBy: { createdAt: "desc" },
        })
      : null) ??
    (bundle.meetingId
      ? await db.runtimeSession.findFirst({
          where: {
            workspaceId: input.workspaceId,
            meetingId: bundle.meetingId,
          },
          orderBy: { createdAt: "desc" },
        })
      : null);
  if (!runtimeSession) {
    throw new Error("No runtime session found for artifact confirmation.");
  }

  const decision = input.decision ?? "confirm";
  const reviewStatus =
    decision === "confirm" ? "CONFIRMED" : decision === "reject" ? "REJECTED" : "KEPT_DRAFT";
  const review = bundle.artifactReview
    ? await db.artifactReview.update({
        where: { id: bundle.artifactReview.id },
        data: {
          status: reviewStatus,
          reviewedByUserId: input.reviewerUserId ?? undefined,
          reviewNotes: input.reviewNotes ?? undefined,
          decisionSummary:
            decision === "confirm"
              ? "Artifact confirmed for runtime trace and reviewable lineage."
              : decision === "reject"
                ? "Artifact rejected and held out of downstream quiet promotion."
                : "Artifact remains draft-only and reviewable.",
          reviewedAt: new Date(),
        },
      })
    : await db.artifactReview.create({
        data: {
          workspaceId: input.workspaceId,
          runtimeEventId: bundle.runtimeEventId ?? undefined,
          artifactBundleId: bundle.id,
          status: reviewStatus,
          reviewedByUserId: input.reviewerUserId ?? undefined,
          reviewNotes: input.reviewNotes ?? undefined,
          decisionSummary:
            decision === "confirm"
              ? "Artifact confirmed for runtime trace and reviewable lineage."
              : decision === "reject"
                ? "Artifact rejected and held out of downstream quiet promotion."
                : "Artifact remains draft-only and reviewable.",
          reviewedAt: new Date(),
        },
      });

  const updatedBundle = await db.artifactBundle.update({
    where: { id: bundle.id },
    data: {
      status: decision === "confirm" ? "CONFIRMED" : decision === "reject" ? "REJECTED" : "REVIEWED",
      reviewPosture:
        decision === "confirm"
          ? "confirmed_for_runtime_trace"
          : decision === "reject"
            ? "rejected_by_runtime_review"
            : "kept_draft_for_runtime_review",
      reviewedAt: new Date(),
      confirmedAt: decision === "confirm" ? new Date() : null,
    },
  });

  const reportKey = `${input.workspaceId}:verification:artifact:${bundle.id}`;
  const verificationReport = await db.verificationReport.upsert({
    where: { reportKey },
    update: {
      artifactBundleId: bundle.id,
      runtimeEventId: bundle.runtimeEventId ?? undefined,
      reportType: "artifact_confirm",
      status: decision === "confirm" ? "PASSED" : decision === "reject" ? "BLOCKED" : "NEEDS_REVIEW",
      truthScore: decision === "confirm" ? 90 : decision === "reject" ? 35 : 60,
      summary:
        decision === "confirm"
          ? `${bundle.artifactType} was confirmed after explicit review.`
          : decision === "reject"
            ? `${bundle.artifactType} was rejected and held out of downstream runtime trust upgrade.`
            : `${bundle.artifactType} remains draft-only and still needs explicit review.`,
      blockedReasons:
        decision === "confirm"
          ? jsonStringify([])
          : jsonStringify([
              decision === "reject"
                ? "Artifact review rejected this bundle."
                : "Artifact remains in draft posture and is not treated as confirmed output.",
            ]),
      boundaryNotes: jsonStringify([
        "Artifact confirmation does not grant auto-send or official write authority.",
        "Confirmed means reviewable runtime lineage only unless a separate approval path exists.",
      ]),
      evidenceRefs: jsonStringify([`artifact:${bundle.id}`]),
    },
    create: {
      workspaceId: input.workspaceId,
      runtimeSessionId: runtimeSession.id,
      runtimeEventId: bundle.runtimeEventId ?? undefined,
      artifactBundleId: bundle.id,
      reportKey,
      reportType: "artifact_confirm",
      status: decision === "confirm" ? "PASSED" : decision === "reject" ? "BLOCKED" : "NEEDS_REVIEW",
      truthScore: decision === "confirm" ? 90 : decision === "reject" ? 35 : 60,
      summary:
        decision === "confirm"
          ? `${bundle.artifactType} was confirmed after explicit review.`
          : decision === "reject"
            ? `${bundle.artifactType} was rejected and held out of downstream runtime trust upgrade.`
            : `${bundle.artifactType} remains draft-only and still needs explicit review.`,
      blockedReasons:
        decision === "confirm"
          ? jsonStringify([])
          : jsonStringify([
              decision === "reject"
                ? "Artifact review rejected this bundle."
                : "Artifact remains in draft posture and is not treated as confirmed output.",
            ]),
      boundaryNotes: jsonStringify([
        "Artifact confirmation does not grant auto-send or official write authority.",
        "Confirmed means reviewable runtime lineage only unless a separate approval path exists.",
      ]),
      evidenceRefs: jsonStringify([`artifact:${bundle.id}`]),
    },
  });

  await recordArtifactVersions({
    workspaceId: input.workspaceId,
    artifactBundles: [updatedBundle],
  });
  if (decision === "confirm") {
    await createRuntimeUpgradeEvent({
      workspaceId: input.workspaceId,
      meetingId: runtimeSession.meetingId ?? null,
      opportunityId: runtimeSession.opportunityId ?? null,
      companyId: runtimeSession.companyId ?? null,
      relatedObjectType: "ArtifactBundle",
      relatedObjectId: updatedBundle.id,
      eventType: "meeting-artifact.persisted",
      payload: {
        artifactType: updatedBundle.artifactType,
        reviewStatus,
        decision,
      },
      trustedContext: {
        runtimeSessionId: runtimeSession.id,
        verificationReportId: verificationReport.id,
      },
      sourceProvenance: [{ type: "artifact_bundle", id: updatedBundle.id }],
      triggeredBy: "verification-agent",
    });
  } else {
    await createRuntimeUpgradeEvent({
      workspaceId: input.workspaceId,
      meetingId: runtimeSession.meetingId ?? null,
      opportunityId: runtimeSession.opportunityId ?? null,
      companyId: runtimeSession.companyId ?? null,
      relatedObjectType: "VerificationReport",
      relatedObjectId: verificationReport.id,
      eventType: "verification.failed",
      payload: {
        artifactBundleId: updatedBundle.id,
        artifactType: updatedBundle.artifactType,
        reviewStatus,
        decision,
      },
      trustedContext: {
        runtimeSessionId: runtimeSession.id,
      },
      sourceProvenance: [{ type: "artifact_bundle", id: updatedBundle.id }],
      triggeredBy: "verification-agent",
    });
  }

  const { record: handoff, contract: handoffContract } = await upsertRuntimeHandoffPacket({
    workspaceId: input.workspaceId,
    runtimeSessionId: runtimeSession.id,
    packetKey: `${input.workspaceId}:handoff:artifact:${bundle.id}`,
    fromAgent: "lead-orchestrator",
    toAgent: "verification-agent",
    goal: `Confirm artifact lineage for ${bundle.artifactType} without widening external authority.`,
    constraints: [
      "review-first",
      "confirmed artifact does not imply send authority",
      "official write remains separately gated",
    ],
    trustedRefs: [`artifact:${bundle.id}`],
    untrustedRefs: [],
    requiredOutputs: ["artifact_review", "artifact_version", "verification_report"],
    evidenceRefs: [`artifact:${bundle.id}`],
    approvalTier: "A1",
  });
  await createRuntimeUpgradeEvent({
    workspaceId: input.workspaceId,
    meetingId: runtimeSession.meetingId ?? null,
    opportunityId: runtimeSession.opportunityId ?? null,
    companyId: runtimeSession.companyId ?? null,
    relatedObjectType: "HandoffPacket",
    relatedObjectId: handoff.id,
    eventType: "handoff.packet.created",
    payload: {
      fromAgent: handoff.fromAgent,
      toAgent: handoff.toAgent,
      approvalTier: handoff.approvalTier,
      artifactBundleId: updatedBundle.id,
      handoff: handoffContract,
    },
    trustedContext: {
      runtimeSessionId: runtimeSession.id,
      verificationReportId: verificationReport.id,
    },
    triggeredBy: "lead-orchestrator",
  });

  await refreshRuntimeCoordinationMetrics(input.workspaceId);

  return {
    artifactReviewId: review.id,
    status: review.status,
  };
}

export async function listProblemSpacesForWorkspace(input: {
  workspaceId: string;
  meetingId?: string;
}) {
  return db.problemSpace.findMany({
    where: {
      workspaceId: input.workspaceId,
      meetingId: input.meetingId ?? undefined,
    },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
  });
}

export async function assignProblemSpaceDri(input: {
  workspaceId: string;
  problemSpaceId: string;
  assignedUserId?: string | null;
  assignedUserName?: string | null;
  assignedByUserId?: string | null;
  assignedByName: string;
  note?: string | null;
}) {
  const problemSpace = await db.problemSpace.findFirst({
    where: {
      workspaceId: input.workspaceId,
      id: input.problemSpaceId,
    },
  });
  if (!problemSpace) {
    throw new Error("Problem space not found.");
  }

  const assignmentKey = `${input.workspaceId}:dri:${problemSpace.id}`;
  const assignment = await db.driAssignment.upsert({
    where: { assignmentKey },
    update: {
      assignedUserId: input.assignedUserId ?? undefined,
      assignedUserName: input.assignedUserName ?? undefined,
      assignedByUserId: input.assignedByUserId ?? undefined,
      assignedByName: input.assignedByName,
      note:
        input.note ??
        (input.assignedUserId || input.assignedUserName
          ? "Explicit DRI assignment refreshed from the runtime operator surface."
          : "DRI assignment cleared from the runtime operator surface."),
    },
    create: {
      workspaceId: input.workspaceId,
      problemSpaceId: problemSpace.id,
      assignmentKey,
      assignedUserId: input.assignedUserId ?? undefined,
      assignedUserName: input.assignedUserName ?? undefined,
      assignedByUserId: input.assignedByUserId ?? undefined,
      assignedByName: input.assignedByName,
      note:
        input.note ??
        (input.assignedUserId || input.assignedUserName
          ? "Explicit DRI assignment refreshed from the runtime operator surface."
          : "DRI assignment cleared from the runtime operator surface."),
    },
  });

  await db.problemSpace.update({
    where: { id: problemSpace.id },
    data: {
      status: input.assignedUserId || input.assignedUserName ? "ACTIVE" : problemSpace.status,
      ownerHint: input.assignedUserName ?? problemSpace.ownerHint,
    },
  });

  await db.initiativeRun.updateMany({
    where: {
      workspaceId: input.workspaceId,
      problemSpaceId: problemSpace.id,
    },
    data: {
      status: input.assignedUserId || input.assignedUserName ? "ACTIVE" : "DETECTED",
    },
  });
  await createRuntimeUpgradeEvent({
    workspaceId: input.workspaceId,
    meetingId: problemSpace.meetingId ?? null,
    opportunityId: problemSpace.opportunityId ?? null,
    companyId: problemSpace.companyId ?? null,
    relatedObjectType: "DriAssignment",
    relatedObjectId: assignment.id,
    eventType: "dri.assigned",
    payload: {
      problemSpaceId: problemSpace.id,
      assignedUserName: input.assignedUserName ?? null,
      assignedByName: input.assignedByName,
      note: assignment.note ?? null,
    },
    trustedContext: {
      runtimeSessionId: problemSpace.runtimeSessionId,
    },
    triggeredBy: "handoff-manager",
  });

  const evidenceRefs = parseRuntimeStringList(problemSpace.evidenceRefs);
  const coordinationOutcome = mapProblemSpaceStatusToCoordinationOutcome(problemSpace.status);
  for (const audience of ["IC", "DRI", "PLAYER_COACH"] as const) {
    const briefKey = `${input.workspaceId}:edge-brief:${problemSpace.id}:${audience}`;
    const briefContent = buildProblemSpaceBriefContent({
      audience,
      problemSpace,
      evidenceRefs,
      coordinationOutcome,
      assignedUserName: assignment.assignedUserName ?? problemSpace.ownerHint,
      assignedByName: assignment.assignedByName ?? input.assignedByName,
      assignmentNote: assignment.note,
    });
    await db.edgeBrief.upsert({
      where: { briefKey },
      update: {
        audience,
        title: `${problemSpace.title} (${audience})`,
        summary: briefContent.summary,
        markdown: briefContent.markdown,
      },
      create: {
        workspaceId: input.workspaceId,
        runtimeSessionId: problemSpace.runtimeSessionId,
        problemSpaceId: problemSpace.id,
        briefKey,
        audience,
        title: `${problemSpace.title} (${audience})`,
        summary: briefContent.summary,
        markdown: briefContent.markdown,
      },
    });
  }

  await refreshRuntimeCoordinationMetrics(input.workspaceId);

  return assignment;
}

export async function getProblemSpaceEdgeBrief(input: {
  workspaceId: string;
  problemSpaceId: string;
  audience: HelmV21EdgeBriefAudience;
}) {
  const problemSpace = await db.problemSpace.findFirst({
    where: {
      workspaceId: input.workspaceId,
      id: input.problemSpaceId,
    },
  });
  if (!problemSpace) {
    throw new Error("Problem space not found.");
  }

  const briefKey = `${input.workspaceId}:edge-brief:${problemSpace.id}:${input.audience}`;
  const assignment = await db.driAssignment.findFirst({
    where: {
      workspaceId: input.workspaceId,
      problemSpaceId: problemSpace.id,
    },
    orderBy: { createdAt: "desc" },
  });
  const briefContent = buildProblemSpaceBriefContent({
    audience: input.audience,
    problemSpace,
    evidenceRefs: parseRuntimeStringList(problemSpace.evidenceRefs),
    coordinationOutcome: mapProblemSpaceStatusToCoordinationOutcome(problemSpace.status),
    assignedUserName: assignment?.assignedUserName ?? problemSpace.ownerHint,
    assignedByName: assignment?.assignedByName ?? null,
    assignmentNote: assignment?.note ?? null,
  });
  return db.edgeBrief.upsert({
    where: { briefKey },
    update: {
      audience: input.audience,
      title: `${problemSpace.title} (${input.audience})`,
      summary: briefContent.summary,
      markdown: briefContent.markdown,
    },
    create: {
      workspaceId: input.workspaceId,
      runtimeSessionId: problemSpace.runtimeSessionId,
      problemSpaceId: problemSpace.id,
      briefKey,
      audience: input.audience,
      title: `${problemSpace.title} (${input.audience})`,
      summary: briefContent.summary,
      markdown: briefContent.markdown,
    },
  });
}

export async function getPlayerCoachQueue(workspaceId: string) {
  const briefs = await db.edgeBrief.findMany({
    where: {
      workspaceId,
      audience: "PLAYER_COACH",
    },
    include: {
      problemSpace: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 12,
  });

  return briefs.map((brief) => ({
    id: brief.id,
    title: brief.title,
    summary: brief.summary,
    problemSpaceId: brief.problemSpaceId,
    problemSpaceTitle: brief.problemSpace?.title ?? null,
  }));
}

export async function getRuntimeCacheHealth(workspaceId: string) {
  const items = await db.promptCacheTelemetry.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return buildRuntimeCacheHealth(items);
}

export async function getWorkspaceRuntimeOperatorOverview(
  workspaceId: string,
): Promise<WorkspaceRuntimeOperatorOverview> {
  const [
    workspace,
    totalSessions,
    activeSessions,
    verificationCount,
    truthConflictCount,
    promotionCandidateCount,
    reflectionCarryForwardCount,
    openProblemSpacesCount,
    unresolvedCompositionFailuresCount,
    reflectionQueueCount,
    consolidationQueueCount,
    verificationReports,
    truthConflicts,
    memoryCandidates,
    memoryPromotions,
    problemSpaces,
    playerCoachBriefs,
    compositionFailures,
    consolidationJobs,
    signals,
    capabilities,
    connectors,
    handoffPackets,
    initiativeRuns,
    humanExecutions,
    officialWriteIntents,
    limitedAutoIntents,
    officialFollowThrough,
    coordinationMetrics,
    cacheTelemetry,
    runtimeSessions,
    benchmarkMatrixEvents,
  ] = await Promise.all([
    db.workspace.findUnique({
      where: { id: workspaceId },
      select: { featureFlagsJson: true },
    }),
    db.runtimeSession.count({
      where: { workspaceId },
    }),
    db.runtimeSession.count({
      where: {
        workspaceId,
        status: {
          in: [
            "ACTIVE",
            "AWAITING_WORKER",
            "AWAITING_REVIEW",
            "AWAITING_APPROVAL",
            "COMPACTING",
            "CHECKPOINTED",
            "BLOCKED",
          ],
        },
      },
    }),
    db.verificationReport.count({
      where: {
        workspaceId,
        status: { not: "PASSED" },
      },
    }),
    db.truthConflict.count({
      where: {
        workspaceId,
        status: "OPEN",
      },
    }),
    db.memoryCandidate.count({
      where: {
        workspaceId,
        status: {
          in: ["PENDING_VERIFICATION", "DEFERRED", "REJECTED", "PROMOTED"],
        },
      },
    }),
    db.memoryCandidate.count({
      where: {
        workspaceId,
        status: "VERIFIED",
        OR: [
          { sourceVerification: "human_confirmed_reflection" },
          { sourceStatus: "trusted_runtime_compaction" },
        ],
      },
    }),
    db.problemSpace.count({
      where: {
        workspaceId,
        status: { notIn: ["RESOLVED", "RETIRED"] },
      },
    }),
    db.compositionFailure.count({
      where: {
        workspaceId,
        resolved: false,
      },
    }),
    db.consolidationJob.count({
      where: {
        workspaceId,
        jobType: {
          in: [...REFLECTION_JOB_TYPES],
        },
        status: {
          in: [...ACTIVE_RUNTIME_JOB_STATUSES],
        },
      },
    }),
    db.consolidationJob.count({
      where: {
        workspaceId,
        jobType: {
          notIn: [...REFLECTION_JOB_TYPES],
        },
        status: {
          in: [...ACTIVE_RUNTIME_JOB_STATUSES],
        },
      },
    }),
    db.verificationReport.findMany({
      where: {
        workspaceId,
        status: { not: "PASSED" },
      },
      include: {
        runtimeSession: {
          select: {
            id: true,
            label: true,
            meetingId: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    db.truthConflict.findMany({
      where: {
        workspaceId,
        status: "OPEN",
      },
      include: {
        runtimeSession: {
          select: {
            id: true,
            label: true,
            meetingId: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    db.memoryCandidate.findMany({
      where: {
        workspaceId,
        status: {
          in: ["PENDING_VERIFICATION", "DEFERRED", "REJECTED", "PROMOTED", "VERIFIED"],
        },
      },
      select: {
        id: true,
        status: true,
        summary: true,
        reviewerNote: true,
        sourceVerification: true,
        sourceStatus: true,
        evidenceRefs: true,
        confidence: true,
        memoryItemId: true,
        createdAt: true,
        runtimeSession: {
          select: {
            id: true,
            label: true,
            meetingId: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    db.memoryPromotion.findMany({
      where: {
        workspaceId,
      },
      select: {
        id: true,
        memoryCandidateId: true,
        memoryItemId: true,
        status: true,
        rationale: true,
        createdAt: true,
        runtimeSession: {
          select: {
            id: true,
            label: true,
            meetingId: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    db.problemSpace.findMany({
      where: {
        workspaceId,
        status: { notIn: ["RESOLVED", "RETIRED"] },
      },
      select: {
        id: true,
        title: true,
        summary: true,
        nextStep: true,
        status: true,
        ownerHint: true,
        evidenceRefs: true,
        updatedAt: true,
        meetingId: true,
        opportunityId: true,
        companyId: true,
        driAssignments: {
          orderBy: { updatedAt: "desc" },
          take: 1,
          select: {
            assignedUserName: true,
            assignedByName: true,
            note: true,
          },
        },
        runtimeSession: {
          select: {
            meetingId: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 6,
    }),
    db.edgeBrief.findMany({
      where: {
        workspaceId,
        audience: "PLAYER_COACH",
      },
      include: {
        runtimeSession: {
          select: {
            meetingId: true,
          },
        },
        problemSpace: {
          select: {
            id: true,
            title: true,
            meetingId: true,
            status: true,
            ownerHint: true,
            evidenceRefs: true,
            driAssignments: {
              orderBy: { updatedAt: "desc" },
              take: 1,
              select: {
                assignedUserName: true,
                assignedByName: true,
                note: true,
              },
            },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 6,
    }),
    db.compositionFailure.findMany({
      where: {
        workspaceId,
        resolved: false,
      },
      include: {
        problemSpace: {
          select: {
            title: true,
          },
        },
        runtimeSession: {
          select: {
            id: true,
            label: true,
            meetingId: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    db.consolidationJob.findMany({
      where: {
        workspaceId,
        status: {
          in: [...ACTIVE_RUNTIME_JOB_STATUSES],
        },
      },
      include: {
        runtimeSession: {
          select: {
            meetingId: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
    db.signalEvent.findMany({
      where: { workspaceId },
      include: {
        runtimeSession: {
          select: {
            meetingId: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    db.capabilityCatalogEntry.findMany({
      where: { workspaceId },
      orderBy: [{ stage: "asc" }, { name: "asc" }],
      take: 6,
    }),
    db.connector.findMany({
      where: { workspaceId },
      select: {
        id: true,
        provider: true,
        status: true,
        lastSyncedAt: true,
        lastSyncStatus: true,
        lastSyncMessage: true,
      },
      orderBy: [{ provider: "asc" }, { updatedAt: "desc" }],
      take: 12,
    }),
    db.handoffPacket.findMany({
      where: { workspaceId },
      include: {
        runtimeSession: {
          select: {
            meetingId: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    db.initiativeRun.findMany({
      where: {
        workspaceId,
        status: {
          notIn: ["RESOLVED", "RETIRED"],
        },
      },
      include: {
        runtimeSession: {
          select: {
            meetingId: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    db.humanActionExecution.findMany({
      where: { workspaceId },
      select: {
        id: true,
        meetingId: true,
        opportunityId: true,
        companyId: true,
        status: true,
        acknowledgementStatus: true,
        executionIntent: true,
        executionOwnerName: true,
        followThroughStatus: true,
        executedAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 24,
    }),
    db.officialWriteIntent.findMany({
      where: { workspaceId },
      select: {
        id: true,
        meetingId: true,
        opportunityId: true,
        companyId: true,
        writeActionType: true,
        officialObjectRef: true,
        writeExecutionStatus: true,
        writeAcknowledgementStatus: true,
        acknowledgedAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 24,
    }),
    db.limitedAutoIntent.findMany({
      where: { workspaceId },
      select: {
        id: true,
        meetingId: true,
        opportunityId: true,
        companyId: true,
        limitedAutoActionType: true,
        officialObjectRef: true,
        limitedAutoExecutionStatus: true,
        limitedAutoAckStatus: true,
        acknowledgedAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 24,
    }),
    db.officialFollowThrough.findMany({
      where: { workspaceId },
      select: {
        id: true,
        meetingId: true,
        opportunityId: true,
        companyId: true,
        followThroughStatus: true,
        followThroughResolutionStatus: true,
        followThroughOwnerName: true,
        followThroughNextAction: true,
        followThroughSummary: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 24,
    }),
    db.coordinationMetricsDaily.findFirst({
      where: { workspaceId },
      orderBy: { metricDate: "desc" },
    }),
    db.promptCacheTelemetry.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    db.runtimeSession.findMany({
      where: { workspaceId },
      include: {
        persistedPayloads: {
          select: {
            handle: true,
          },
        },
        contextEditEvents: {
          orderBy: { createdAt: "asc" },
          take: 24,
        },
        checkpoints: {
          orderBy: { createdAt: "desc" },
          take: 2,
        },
        notebook: true,
        problemSpaces: {
          orderBy: { createdAt: "desc" },
          take: 3,
        },
        memoryCandidates: {
          orderBy: { createdAt: "desc" },
          take: 12,
        },
        memoryPromotions: {
          where: {
            status: "PROMOTED",
          },
          orderBy: { createdAt: "desc" },
          take: 12,
        },
        verificationReports: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        handoffPackets: {
          orderBy: { createdAt: "desc" },
          take: 4,
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 8,
    }),
    db.runtimeEvent.findMany({
      where: {
        workspaceId,
        relatedObjectType: "Workspace",
        relatedObjectId: workspaceId,
        eventType: {
          in: [...BENCHMARK_MATRIX_EVENT_TYPES],
        },
      },
      select: {
        id: true,
        eventType: true,
        payload: true,
        trustedContext: true,
        triggeredBy: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
  ]);
  const workspaceFeatureFlags = parseWorkspaceFeatureFlags(workspace?.featureFlagsJson);

  const runtimeSessionLifecycleEvents = runtimeSessions.length
    ? await db.runtimeEvent.findMany({
        where: {
          workspaceId,
          relatedObjectType: "RuntimeSession",
          relatedObjectId: {
            in: runtimeSessions.map((session) => session.id),
          },
          OR: [
            {
              eventType: {
                startsWith: "continuity.remediation.",
              },
            },
            {
              eventType: {
                in: [...RUNTIME_SESSION_CONTROL_EVENT_TYPES],
              },
            },
          ],
        },
        select: {
          id: true,
          eventType: true,
          payload: true,
          trustedContext: true,
          triggeredBy: true,
          createdAt: true,
          relatedObjectId: true,
        },
        orderBy: { createdAt: "desc" },
        take: 64,
      })
    : [];
  const benchmarkMatrixRuns = parseRuntimeBenchmarkMatrixRunEvents(benchmarkMatrixEvents);
  const benchmarkExecutionRequests =
    parseRuntimeBenchmarkMatrixRunRequestEvents(benchmarkMatrixEvents);
  const benchmarkExecutionAcknowledgements =
    parseRuntimeBenchmarkMatrixRunAcknowledgementEvents(benchmarkMatrixEvents);
  const benchmarkExecutionFollowThrough =
    parseRuntimeBenchmarkMatrixFollowThroughEvents(benchmarkMatrixEvents);
  const remediationEventsBySessionId = new Map<string, Array<(typeof runtimeSessionLifecycleEvents)[number]>>();
  const requestEventsBySessionId = new Map<string, Array<(typeof runtimeSessionLifecycleEvents)[number]>>();
  for (const event of runtimeSessionLifecycleEvents) {
    if (!event.relatedObjectId) continue;
    if (event.eventType.startsWith("continuity.remediation.")) {
      const list = remediationEventsBySessionId.get(event.relatedObjectId) ?? [];
      list.push(event);
      remediationEventsBySessionId.set(event.relatedObjectId, list);
      continue;
    }
    if (isRuntimeSessionControlEventType(event.eventType)) {
      const list = requestEventsBySessionId.get(event.relatedObjectId) ?? [];
      list.push(event);
      requestEventsBySessionId.set(event.relatedObjectId, list);
    }
  }
  const meetingMetadataById = await loadRuntimeContinuityMeetingMetadataMap(
    runtimeSessions.map((session) => session.meetingId).filter((item): item is string => Boolean(item)),
  );
  const continuityInputSessions = finalizeRuntimeContinuityInputSessions(
    runtimeSessions.map((session) => ({
      id: session.id,
      workspaceId: session.workspaceId,
      label: session.label,
      sessionKey: session.sessionKey,
      status: session.status,
      currentStage: session.currentStage,
      sourcePage: session.sourcePage,
      boundaryNote: session.boundaryNote,
      replayableEventLog: session.replayableEventLog,
      meetingId: session.meetingId,
      opportunityId: session.opportunityId,
      companyId: session.companyId,
      budgetTokenLimit: session.budgetTokenLimit,
      budgetTokenUsed: session.budgetTokenUsed,
      prunedTokenCount: session.prunedTokenCount,
      resumedFromKey: session.resumedFromKey,
      controlPlaneLifecycleJson: session.controlPlaneLifecycleJson,
      controlPlaneLifecycleUpdatedAt: session.controlPlaneLifecycleUpdatedAt,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      closedAt: session.closedAt,
      contextEditEvents: session.contextEditEvents.map((item) => ({
        id: item.id,
        strategy: item.strategy,
        beforeTokenCount: item.beforeTokenCount,
        afterTokenCount: item.afterTokenCount,
        removedHandles: item.removedHandles,
        removedSummary: item.removedSummary,
        createdAt: item.createdAt,
      })),
      checkpoints: session.checkpoints.map((item) => ({
        id: item.id,
        checkpointKey: item.checkpointKey,
        label: item.label,
        status: item.status,
        summary: item.summary,
        snapshotJson: item.snapshotJson,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
      notebook: session.notebook
        ? {
            sessionSummary: session.notebook.sessionSummary,
            decisionSummary: session.notebook.decisionSummary,
            blockerSummary: session.notebook.blockerSummary,
            pendingQuestions: session.notebook.pendingQuestions,
            openLoopSummary: session.notebook.openLoopSummary,
            boundaryNote: session.notebook.boundaryNote,
          }
        : null,
      problemSpaces: session.problemSpaces.map((item) => ({
        title: item.title,
        nextStep: item.nextStep,
        status: item.status,
        ownerHint: item.ownerHint,
        evidenceRefs: item.evidenceRefs,
      })),
      memoryCandidates: session.memoryCandidates.map((item) => ({
        id: item.id,
        summary: item.summary,
        status: item.status,
        evidenceRefs: item.evidenceRefs,
        sourceVerification: item.sourceVerification,
      })),
      memoryPromotions: session.memoryPromotions.map((item) => ({
        memoryCandidateId: item.memoryCandidateId,
        status: item.status,
      })),
      verificationReports: session.verificationReports.map((item) => ({
        status: item.status,
        summary: item.summary,
        blockedReasons: item.blockedReasons ?? "[]",
      })),
      handoffPackets: session.handoffPackets.map((item) => ({
        id: item.id,
        packetKey: item.packetKey,
        fromAgent: normalizeRuntimeAgentId(item.fromAgent),
        toAgent: normalizeRuntimeAgentId(item.toAgent),
        goal: item.goal,
        approvalTier: normalizeRuntimeApprovalTier(item.approvalTier),
        constraintsJson: item.constraintsJson,
        trustedRefs: item.trustedRefs,
        untrustedRefs: item.untrustedRefs,
        requiredOutputs: item.requiredOutputs,
        evidenceRefs: item.evidenceRefs,
        notebookRef: item.notebookRef,
        checkpointRef: item.checkpointRef,
        createdAt: item.createdAt,
      })),
      persistedPayloadHandles: session.persistedPayloads.map((item) => item.handle),
      remediationEvents: (remediationEventsBySessionId.get(session.id) ?? []).map((event) => ({
        id: event.id,
        eventType: event.eventType,
        payload: event.payload,
        trustedContext: event.trustedContext,
        triggeredBy: event.triggeredBy,
        createdAt: event.createdAt,
      })),
      requestEvents: (requestEventsBySessionId.get(session.id) ?? []).map((event) => ({
        id: event.id,
        eventType: event.eventType,
        payload: event.payload,
        trustedContext: event.trustedContext,
        triggeredBy: event.triggeredBy,
        createdAt: event.createdAt,
      })),
    })),
    meetingMetadataById,
  );

  return buildWorkspaceRuntimeOperatorOverview({
    workspaceId,
    swarmReadOnlyWorkersEnabled: workspaceFeatureFlags.swarmReadOnlyWorkers,
    sessionCounts: {
      total: totalSessions,
      active: activeSessions,
    },
    queueCounts: {
      verification: verificationCount + truthConflictCount,
      promotion: promotionCandidateCount,
      reflectionCarryForward: reflectionCarryForwardCount,
      openProblemSpaces: openProblemSpacesCount,
      unresolvedCompositionFailures: unresolvedCompositionFailuresCount,
      reflectionQueue: reflectionQueueCount,
      consolidationQueue: consolidationQueueCount,
    },
    verificationReports,
    truthConflicts,
    memoryCandidates,
    memoryPromotions,
    problemSpaces,
    playerCoachBriefs,
    compositionFailures,
    consolidationJobs,
    signals,
    capabilities,
    connectors: connectors.map((item) => ({
      id: item.id,
      provider: String(item.provider),
      status: String(item.status),
      lastSyncedAt: item.lastSyncedAt ?? null,
      lastSyncStatus: item.lastSyncStatus ?? null,
      lastSyncMessage: item.lastSyncMessage ?? null,
    })),
    handoffPackets,
    initiativeRuns,
    humanExecutions: humanExecutions.map((item) => ({
      ...item,
      status: String(item.status).toUpperCase(),
      executionAcknowledgementStatus: String(item.acknowledgementStatus).toUpperCase(),
    })),
    officialWriteIntents: officialWriteIntents.map((item) => ({
      ...item,
      writeActionType: String(item.writeActionType),
      writeExecutionStatus: String(item.writeExecutionStatus).toUpperCase(),
      writeAcknowledgementStatus: String(item.writeAcknowledgementStatus).toUpperCase(),
    })),
    limitedAutoIntents: limitedAutoIntents.map((item) => ({
      ...item,
      limitedAutoActionType: String(item.limitedAutoActionType),
      limitedAutoExecutionStatus: String(item.limitedAutoExecutionStatus).toUpperCase(),
      limitedAutoAckStatus: String(item.limitedAutoAckStatus).toUpperCase(),
    })),
    officialFollowThrough: officialFollowThrough.map((item) => ({
      ...item,
      followThroughStatus: String(item.followThroughStatus).toUpperCase(),
      followThroughResolutionStatus: String(item.followThroughResolutionStatus).toUpperCase(),
    })),
    coordinationMetrics,
    cacheTelemetry,
    benchmarkMatrixRuns,
    benchmarkExecutionRequests,
    benchmarkExecutionAcknowledgements,
    benchmarkExecutionFollowThrough,
    runtimeSessions: continuityInputSessions,
  });
}

export async function getWorkspaceBusinessLoopGapReadout(
  workspaceId: string,
): Promise<WorkspaceBusinessLoopGapReadout> {
  const [truthConflicts, problemSpaces, compositionFailures, coordinationMetrics] =
    await Promise.all([
      db.truthConflict.findMany({
        where: {
          workspaceId,
          status: "OPEN",
        },
        include: {
          runtimeSession: {
            select: {
              id: true,
              label: true,
              meetingId: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 12,
      }),
      db.problemSpace.findMany({
        where: {
          workspaceId,
          status: { notIn: ["RESOLVED", "RETIRED"] },
        },
        select: {
          id: true,
          title: true,
          summary: true,
          nextStep: true,
          status: true,
          ownerHint: true,
          evidenceRefs: true,
          updatedAt: true,
          meetingId: true,
          runtimeSession: {
            select: {
              meetingId: true,
            },
          },
        },
        orderBy: { updatedAt: "desc" },
        take: 12,
      }),
      db.compositionFailure.findMany({
        where: {
          workspaceId,
          resolved: false,
        },
        include: {
          problemSpace: {
            select: {
              title: true,
            },
          },
          runtimeSession: {
            select: {
              id: true,
              label: true,
              meetingId: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 12,
      }),
      db.coordinationMetricsDaily.findFirst({
        where: { workspaceId },
        orderBy: { metricDate: "desc" },
      }),
    ]);

  return buildWorkspaceBusinessLoopGapReadout({
    workspaceId,
    truthConflicts,
    problemSpaces,
    compositionFailures,
    coordinationMetrics,
  });
}

export async function queueConsolidationJob(input: {
  workspaceId: string;
  meetingId: string;
  actorUserId?: string | null;
  actorName?: string | null;
  sourcePage?: string | null;
}) {
  const session = await db.runtimeSession.findFirst({
    where: {
      workspaceId: input.workspaceId,
      meetingId: input.meetingId,
    },
    orderBy: { createdAt: "desc" },
  });
  if (!session) {
    throw new Error("No runtime session found for consolidation.");
  }

  const existingJob = await db.consolidationJob.findUnique({
    where: { jobKey: `${input.workspaceId}:consolidation:${session.id}:manual` },
    select: { id: true, status: true },
  });
  const job = await db.consolidationJob.upsert({
    where: { jobKey: `${input.workspaceId}:consolidation:${session.id}:manual` },
    update: {
      status: "QUEUED",
      inputSummary: `Manual consolidation requested for runtime session ${session.id}.`,
      outputSummary: buildConsolidationLifecycleOutputSummary({
        lifecycleState: "queued",
        source: "manual_operator_queue",
      }),
      reviewPosture: CONSOLIDATION_BOUNDARY_NOTE,
      pausedAt: null,
      completedAt: null,
    },
    create: {
      workspaceId: input.workspaceId,
      runtimeSessionId: session.id,
      jobKey: `${input.workspaceId}:consolidation:${session.id}:manual`,
      jobType: "manual_runtime_consolidation",
      status: "QUEUED",
      inputSummary: `Manual consolidation requested for runtime session ${session.id}.`,
      outputSummary: buildConsolidationLifecycleOutputSummary({
        lifecycleState: "queued",
        source: "manual_operator_queue",
      }),
      reviewPosture: CONSOLIDATION_BOUNDARY_NOTE,
    },
  });
  await writeAuditLog({
    workspaceId: input.workspaceId,
    userId: input.actorUserId ?? null,
    actor: input.actorName ?? "helm-core",
    actorType: input.actorUserId ? ActorType.USER : ActorType.SYSTEM,
    actionType: "RUNTIME_CONSOLIDATION_JOB_QUEUED",
    targetType: "ConsolidationJob",
    targetId: job.id,
    summary: `Queued candidate-only consolidation for runtime session ${session.id}.`,
    payload: {
      runtimeSessionId: session.id,
      meetingId: session.meetingId,
      jobType: job.jobType,
      previousStatus: existingJob?.status ?? null,
      nextStatus: job.status,
      queueLifecycleState: "queued",
      rollbackMode: "fallback_to_single_agent",
    },
    sourcePage: input.sourcePage ?? "/operating",
    relatedObjectType: session.meetingId ? ObjectType.MEETING : null,
    relatedObjectId: session.meetingId,
  });
  await logEvent({
    workspaceId: input.workspaceId,
    userId: input.actorUserId ?? null,
    eventName: "runtime_consolidation_job_queued",
    eventCategory: "helm_v2_runtime",
    targetType: "ConsolidationJob",
    targetId: job.id,
    metadata: {
      runtimeSessionId: session.id,
      meetingId: session.meetingId,
      jobType: job.jobType,
      queueLifecycleState: "queued",
      rollbackMode: "fallback_to_single_agent",
    },
    sourcePage: input.sourcePage ?? "/operating",
  });
  await createRuntimeUpgradeEvent({
    workspaceId: input.workspaceId,
    meetingId: session.meetingId ?? null,
    opportunityId: session.opportunityId ?? null,
    companyId: session.companyId ?? null,
    relatedObjectType: "ConsolidationJob",
    relatedObjectId: job.id,
    eventType: `${buildRuntimeJobEventPrefix(job.jobType)}.queued`,
    payload: {
      status: job.status,
      jobType: job.jobType,
      queueLifecycleState: "queued",
      rollbackMode: "fallback_to_single_agent",
      source: "manual_operator_queue",
    },
    trustedContext: {
      runtimeSessionId: session.id,
      actorUserId: input.actorUserId ?? null,
    },
    untrustedContext: {
      sourcePage: input.sourcePage ?? "/operating",
    },
    triggeredBy: input.actorName ?? "helm-core",
  });

  await refreshRuntimeCoordinationMetrics(input.workspaceId);

  return job;
}

export async function queueReflectionJob(input: {
  workspaceId: string;
  meetingId: string;
  trigger?: "manual_operator_queue" | "meeting_human_confirmed";
}) {
  const session = await db.runtimeSession.findFirst({
    where: {
      workspaceId: input.workspaceId,
      meetingId: input.meetingId,
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
    },
  });
  if (!session) {
    throw new Error("No runtime session found for reflection.");
  }

  return queueReflectionJobForRuntimeSession({
    workspaceId: input.workspaceId,
    runtimeSessionId: session.id,
    trigger: input.trigger ?? "manual_operator_queue",
  });
}

export async function dismissReflectionCandidate(input: {
  workspaceId: string;
  candidateId: string;
  userId: string;
  actorName: string;
  sourcePage: string;
}) {
  const candidate = await db.memoryCandidate.findFirst({
    where: {
      workspaceId: input.workspaceId,
      id: input.candidateId,
    },
    include: {
      runtimeSession: {
        select: {
          id: true,
          label: true,
          meetingId: true,
        },
      },
    },
  });

  if (!candidate) {
    throw new Error("Reflection carry-forward candidate not found.");
  }

  if (!isReflectionMemoryCandidate(candidate)) {
    throw new Error("Only reflection carry-forward candidates can be dismissed here.");
  }

  if (candidate.status !== "VERIFIED") {
    return candidate;
  }

  const dismissalNote = trimText(
    [
      candidate.reviewerNote?.trim(),
      "Operator dismissed this reflection carry-forward candidate. It remains auditable, but it is no longer surfaced as an active carry-forward item.",
    ]
      .filter(Boolean)
      .join(" "),
    280,
  );

  const updated = await db.memoryCandidate.update({
    where: { id: candidate.id },
    data: {
      status: "REJECTED",
      reviewerNote: dismissalNote,
    },
    include: {
      runtimeSession: {
        select: {
          id: true,
          label: true,
          meetingId: true,
        },
      },
    },
  });
  await db.memoryPromotion.upsert({
    where: {
      promotionKey: buildRuntimeMemoryPromotionKey({
        workspaceId: input.workspaceId,
        candidateId: updated.id,
        memoryItemId: updated.memoryItemId,
      }),
    },
    update: {
      memoryCandidateId: updated.id,
      memoryItemId: updated.memoryItemId ?? undefined,
      status: "REJECTED",
      rationale: dismissalNote ?? updated.summary,
    },
    create: {
      workspaceId: input.workspaceId,
      runtimeSessionId: updated.runtimeSessionId,
      memoryCandidateId: updated.id,
      memoryItemId: updated.memoryItemId ?? undefined,
      promotionKey: buildRuntimeMemoryPromotionKey({
        workspaceId: input.workspaceId,
        candidateId: updated.id,
        memoryItemId: updated.memoryItemId,
      }),
      status: "REJECTED",
      rationale: dismissalNote ?? updated.summary,
    },
  });

  await writeAuditLog({
    workspaceId: input.workspaceId,
    userId: input.userId,
    actor: input.actorName,
    actorType: ActorType.USER,
    actionType: "RUNTIME_REFLECTION_CARRY_FORWARD_DISMISSED",
    targetType: "MemoryCandidate",
    targetId: updated.id,
    summary: `Dismissed reflection carry-forward candidate for ${updated.runtimeSession.label}.`,
    payload: {
      runtimeSessionId: updated.runtimeSession.id,
      candidateKey: updated.candidateKey,
      previousStatus: candidate.status,
      nextStatus: updated.status,
      sourceVerification: updated.sourceVerification,
      sourceStatus: updated.sourceStatus,
    },
    sourcePage: input.sourcePage,
    relatedObjectType: updated.meetingId ? ObjectType.MEETING : null,
    relatedObjectId: updated.meetingId ?? null,
  });

  await logEvent({
    workspaceId: input.workspaceId,
    userId: input.userId,
    eventName: "runtime_reflection_carry_forward_dismissed",
    eventCategory: "helm_v2_runtime",
    targetType: "MemoryCandidate",
    targetId: updated.id,
    metadata: {
      runtimeSessionId: updated.runtimeSession.id,
      meetingId: updated.meetingId,
      previousStatus: candidate.status,
      nextStatus: updated.status,
    },
    sourcePage: input.sourcePage,
  });

  return updated;
}

export async function acceptReflectionCandidate(input: {
  workspaceId: string;
  candidateId: string;
  userId: string;
  actorName: string;
  sourcePage: string;
}) {
  const candidate = await db.memoryCandidate.findFirst({
    where: {
      workspaceId: input.workspaceId,
      id: input.candidateId,
    },
    include: {
      runtimeSession: {
        select: {
          id: true,
          label: true,
          meetingId: true,
        },
      },
    },
  });

  if (!candidate) {
    throw new Error("Reflection carry-forward candidate not found.");
  }

  if (!isReflectionMemoryCandidate(candidate)) {
    throw new Error("Only reflection carry-forward candidates can be accepted here.");
  }

  if (candidate.status === "PROMOTED") {
    return candidate;
  }

  if (candidate.status !== "VERIFIED") {
    throw new Error("Only active verified reflection carry-forward candidates can be accepted here.");
  }

  const acceptanceNote = trimText(
    [
      candidate.reviewerNote?.trim(),
      "Operator accepted this reflection carry-forward candidate into the explicit runtime promotion ledger. It remains auditable carry-forward context and can inform later memory work, but it still does not silently rewrite canonical truth.",
    ]
      .filter(Boolean)
      .join(" "),
    280,
  );

  const updated = await db.memoryCandidate.update({
    where: { id: candidate.id },
    data: {
      status: "PROMOTED",
      reviewerNote: acceptanceNote,
    },
    include: {
      runtimeSession: {
        select: {
          id: true,
          label: true,
          meetingId: true,
        },
      },
    },
  });
  await db.memoryPromotion.upsert({
    where: {
      promotionKey: buildRuntimeMemoryPromotionKey({
        workspaceId: input.workspaceId,
        candidateId: updated.id,
        memoryItemId: updated.memoryItemId,
      }),
    },
    update: {
      memoryCandidateId: updated.id,
      memoryItemId: updated.memoryItemId ?? undefined,
      status: "PROMOTED",
      rationale: acceptanceNote ?? updated.summary,
    },
    create: {
      workspaceId: input.workspaceId,
      runtimeSessionId: updated.runtimeSessionId,
      memoryCandidateId: updated.id,
      memoryItemId: updated.memoryItemId ?? undefined,
      promotionKey: buildRuntimeMemoryPromotionKey({
        workspaceId: input.workspaceId,
        candidateId: updated.id,
        memoryItemId: updated.memoryItemId,
      }),
      status: "PROMOTED",
      rationale: acceptanceNote ?? updated.summary,
    },
  });

  await writeAuditLog({
    workspaceId: input.workspaceId,
    userId: input.userId,
    actor: input.actorName,
    actorType: ActorType.USER,
    actionType: "RUNTIME_REFLECTION_CARRY_FORWARD_ACCEPTED",
    targetType: "MemoryCandidate",
    targetId: updated.id,
    summary: `Accepted reflection carry-forward candidate for ${updated.runtimeSession.label}.`,
    payload: {
      runtimeSessionId: updated.runtimeSession.id,
      candidateKey: updated.candidateKey,
      previousStatus: candidate.status,
      nextStatus: updated.status,
      sourceVerification: updated.sourceVerification,
      sourceStatus: updated.sourceStatus,
    },
    sourcePage: input.sourcePage,
    relatedObjectType: updated.meetingId ? ObjectType.MEETING : null,
    relatedObjectId: updated.meetingId ?? null,
  });

  await logEvent({
    workspaceId: input.workspaceId,
    userId: input.userId,
    eventName: "runtime_reflection_carry_forward_accepted",
    eventCategory: "helm_v2_runtime",
    targetType: "MemoryCandidate",
    targetId: updated.id,
    metadata: {
      runtimeSessionId: updated.runtimeSession.id,
      meetingId: updated.meetingId,
      previousStatus: candidate.status,
      nextStatus: updated.status,
    },
    sourcePage: input.sourcePage,
  });

  return updated;
}

export async function updateConsolidationJobStatus(input: {
  workspaceId: string;
  jobId: string;
  mode: "pause" | "resume";
  actorUserId?: string | null;
  actorName?: string | null;
  sourcePage?: string | null;
}) {
  const job = await db.consolidationJob.findFirst({
    where: {
      workspaceId: input.workspaceId,
      id: input.jobId,
    },
  });
  if (!job) {
    throw new Error("Consolidation job not found.");
  }
  if (input.mode === "pause" && !PAUSEABLE_RUNTIME_JOB_STATUSES.has(job.status)) {
    throw new Error(`Only queued or running jobs can be paused. Current status: ${job.status}.`);
  }
  if (input.mode === "resume" && !RESUMABLE_RUNTIME_JOB_STATUSES.has(job.status)) {
    throw new Error(`Only paused jobs can be resumed. Current status: ${job.status}.`);
  }

  const now = new Date();
  const isReflectionJob = isReflectionJobType(job.jobType);
  const updated = await db.consolidationJob.update({
    where: { id: job.id },
    data:
      input.mode === "pause"
        ? {
            status: "PAUSED",
            pausedAt: now,
            outputSummary: isReflectionJob
              ? buildReflectionLifecycleOutputSummary({
                  lifecycleState: "paused",
                })
              : buildConsolidationLifecycleOutputSummary({
                  lifecycleState: "paused",
                  source: "manual_operator_queue",
                }),
          }
        : {
            status: "QUEUED",
            pausedAt: null,
            completedAt: null,
            outputSummary: isReflectionJob
              ? buildReflectionLifecycleOutputSummary({
                  lifecycleState: "resumed",
                })
              : buildConsolidationLifecycleOutputSummary({
                  lifecycleState: "resumed",
                  source: "operating_resume",
                }),
          },
  });
  const session = updated.runtimeSessionId
    ? await db.runtimeSession.findFirst({
        where: {
          workspaceId: input.workspaceId,
          id: updated.runtimeSessionId,
        },
        select: {
          id: true,
          meetingId: true,
          opportunityId: true,
          companyId: true,
        },
      })
    : null;
  await writeAuditLog({
    workspaceId: input.workspaceId,
    userId: input.actorUserId ?? null,
    actor: input.actorName ?? "helm-core",
    actorType: input.actorUserId ? ActorType.USER : ActorType.SYSTEM,
    actionType:
      isReflectionJob
        ? input.mode === "pause"
          ? "RUNTIME_REFLECTION_JOB_PAUSED"
          : "RUNTIME_REFLECTION_JOB_RESUMED"
        : input.mode === "pause"
          ? "RUNTIME_CONSOLIDATION_JOB_PAUSED"
          : "RUNTIME_CONSOLIDATION_JOB_RESUMED",
    targetType: "ConsolidationJob",
    targetId: updated.id,
    summary:
      isReflectionJob
        ? input.mode === "pause"
          ? `Paused reflection for runtime session ${updated.runtimeSessionId ?? "unknown"}.`
          : `Resumed reflection for runtime session ${updated.runtimeSessionId ?? "unknown"}.`
        : input.mode === "pause"
          ? `Paused candidate-only consolidation for runtime session ${updated.runtimeSessionId ?? "unknown"}.`
          : `Resumed candidate-only consolidation for runtime session ${updated.runtimeSessionId ?? "unknown"}.`,
    payload: {
      runtimeSessionId: updated.runtimeSessionId,
      meetingId: session?.meetingId ?? null,
      jobType: updated.jobType,
      previousStatus: job.status,
      nextStatus: updated.status,
      queueLifecycleState: input.mode === "pause" ? "paused" : "resumed",
      ...(isReflectionJob ? {} : { rollbackMode: "fallback_to_single_agent" }),
    },
    sourcePage: input.sourcePage ?? "/operating",
    relatedObjectType: session?.meetingId ? ObjectType.MEETING : null,
    relatedObjectId: session?.meetingId ?? null,
  });
  await logEvent({
    workspaceId: input.workspaceId,
    userId: input.actorUserId ?? null,
    eventName:
      isReflectionJob
        ? input.mode === "pause"
          ? "runtime_reflection_job_paused"
          : "runtime_reflection_job_resumed"
        : input.mode === "pause"
          ? "runtime_consolidation_job_paused"
          : "runtime_consolidation_job_resumed",
    eventCategory: "helm_v2_runtime",
    targetType: "ConsolidationJob",
    targetId: updated.id,
    metadata: {
      runtimeSessionId: updated.runtimeSessionId,
      meetingId: session?.meetingId ?? null,
      jobType: updated.jobType,
      queueLifecycleState: input.mode === "pause" ? "paused" : "resumed",
      ...(isReflectionJob ? {} : { rollbackMode: "fallback_to_single_agent" }),
    },
    sourcePage: input.sourcePage ?? "/operating",
  });
  await createRuntimeUpgradeEvent({
    workspaceId: input.workspaceId,
    meetingId: session?.meetingId ?? null,
    opportunityId: session?.opportunityId ?? null,
    companyId: session?.companyId ?? null,
    relatedObjectType: "ConsolidationJob",
    relatedObjectId: updated.id,
    eventType:
      input.mode === "resume"
        ? `${buildRuntimeJobEventPrefix(updated.jobType)}.resumed`
        : `${buildRuntimeJobEventPrefix(updated.jobType)}.paused`,
    payload: {
      status: updated.status,
      jobType: updated.jobType,
      mode: input.mode,
      queueLifecycleState: input.mode === "pause" ? "paused" : "resumed",
      ...(isReflectionJob ? {} : { rollbackMode: "fallback_to_single_agent" }),
    },
    trustedContext: {
      runtimeSessionId: updated.runtimeSessionId,
      actorUserId: input.actorUserId ?? null,
    },
    untrustedContext: {
      sourcePage: input.sourcePage ?? "/operating",
    },
    triggeredBy: input.actorName ?? "helm-core",
  });

  await refreshRuntimeCoordinationMetrics(input.workspaceId);

  return updated;
}

async function listRuntimeJobsForWorkspace(
  workspaceId: string,
  kind: "reflection" | "consolidation",
) {
  const jobs = await db.consolidationJob.findMany({
    where: {
      workspaceId,
      jobType:
        kind === "reflection"
          ? {
              in: [...REFLECTION_JOB_TYPES],
            }
          : {
              notIn: [...REFLECTION_JOB_TYPES],
            },
    },
    include: {
      runtimeSession: {
        select: {
          id: true,
          label: true,
          meetingId: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 12,
  });

  return jobs.map((job) => ({
    ...buildRuntimeJobQueueReadout(job),
    runtimeSessionId: job.runtimeSessionId,
    runtimeSessionLabel: job.runtimeSession?.label ?? null,
  }));
}

export async function listConsolidationJobsForWorkspace(workspaceId: string) {
  return listRuntimeJobsForWorkspace(workspaceId, "consolidation");
}

export async function listReflectionJobsForWorkspace(workspaceId: string) {
  return listRuntimeJobsForWorkspace(workspaceId, "reflection");
}

export async function getMeetingRuntimeUpgradeSummary(
  workspaceId: string,
  meetingId: string,
): Promise<RuntimeUpgradeSummary | null> {
  const [workspace, session] = await Promise.all([
    db.workspace.findUnique({
      where: { id: workspaceId },
      select: { featureFlagsJson: true },
    }),
    db.runtimeSession.findFirst({
      where: {
        workspaceId,
        meetingId,
      },
      include: {
        persistedPayloads: { orderBy: { createdAt: "asc" } },
        contextEditEvents: { orderBy: { createdAt: "desc" } },
        notebook: true,
        checkpoints: { orderBy: { createdAt: "desc" } },
        verificationReports: { orderBy: { createdAt: "desc" } },
        memoryCandidates: { orderBy: { createdAt: "desc" } },
        memoryPromotions: { orderBy: { createdAt: "desc" } },
        signalEvents: { orderBy: { createdAt: "desc" } },
        truthConflicts: { orderBy: { createdAt: "desc" } },
        worldModelSnapshots: { orderBy: { createdAt: "desc" } },
        problemSpaces: { orderBy: { createdAt: "desc" } },
        edgeBriefs: { orderBy: { createdAt: "desc" } },
        compositionFailures: { orderBy: { createdAt: "desc" } },
        promptCacheTelemetry: { orderBy: { createdAt: "desc" } },
        consolidationJobs: { orderBy: { createdAt: "desc" } },
        handoffPackets: { orderBy: { createdAt: "desc" } },
        initiativeRuns: { orderBy: { createdAt: "desc" } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  if (!session) return null;
  const workspaceFeatureFlags = parseWorkspaceFeatureFlags(workspace?.featureFlagsJson);

  const artifactBundles = await db.artifactBundle.findMany({
    where: {
      workspaceId,
      meetingId,
      artifactType: {
        in: ["meeting_facts.json", "risk_flags.json", "action_pack.md", "memory_draft.jsonl"],
      },
    },
    orderBy: { createdAt: "desc" },
    take: 8,
  });
  const artifactVersions = artifactBundles.length
    ? await db.artifactVersion.findMany({
        where: {
          workspaceId,
          artifactBundleId: {
            in: artifactBundles.map((item) => item.id),
          },
        },
        orderBy: [{ createdAt: "desc" }],
        take: 8,
      })
    : [];
  const capabilities = await db.capabilityCatalogEntry.findMany({
    where: { workspaceId },
    orderBy: [{ stage: "asc" }, { name: "asc" }],
    take: 6,
  });
  const coordinationMetrics = await db.coordinationMetricsDaily.findFirst({
    where: { workspaceId },
    orderBy: { metricDate: "desc" },
  });
  const [
    problemSpaces,
    edgeBriefs,
    compositionFailures,
    humanExecutions,
    officialWriteIntents,
    limitedAutoIntents,
    officialFollowThrough,
    connectors,
    remediationEvents,
    benchmarkMatrixEvents,
    workspacePilotReview,
    traceCohortMetadata,
  ] = await Promise.all([
    db.problemSpace.findMany({
      where: {
        workspaceId,
        runtimeSessionId: session.id,
      },
      include: {
        driAssignments: {
          orderBy: { updatedAt: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    db.edgeBrief.findMany({
      where: {
        workspaceId,
        runtimeSessionId: session.id,
      },
      include: {
        problemSpace: true,
      },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    db.compositionFailure.findMany({
      where: {
        workspaceId,
        runtimeSessionId: session.id,
      },
      include: {
        problemSpace: true,
      },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    db.humanActionExecution.findMany({
      where: {
        workspaceId,
        meetingId,
      },
      select: {
        id: true,
        meetingId: true,
        opportunityId: true,
        companyId: true,
        status: true,
        acknowledgementStatus: true,
        executionIntent: true,
        executionOwnerName: true,
        followThroughStatus: true,
        executedAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 8,
    }),
    db.officialWriteIntent.findMany({
      where: {
        workspaceId,
        meetingId,
      },
      select: {
        id: true,
        meetingId: true,
        opportunityId: true,
        companyId: true,
        writeActionType: true,
        officialObjectRef: true,
        writeExecutionStatus: true,
        writeAcknowledgementStatus: true,
        acknowledgedAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 8,
    }),
    db.limitedAutoIntent.findMany({
      where: {
        workspaceId,
        meetingId,
      },
      select: {
        id: true,
        meetingId: true,
        opportunityId: true,
        companyId: true,
        limitedAutoActionType: true,
        officialObjectRef: true,
        limitedAutoExecutionStatus: true,
        limitedAutoAckStatus: true,
        acknowledgedAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 8,
    }),
    db.officialFollowThrough.findMany({
      where: {
        workspaceId,
        meetingId,
      },
      select: {
        id: true,
        meetingId: true,
        opportunityId: true,
        companyId: true,
        followThroughStatus: true,
        followThroughResolutionStatus: true,
        followThroughOwnerName: true,
        followThroughNextAction: true,
        followThroughSummary: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 8,
    }),
    db.connector.findMany({
      where: { workspaceId },
      select: {
        id: true,
        provider: true,
        status: true,
        lastSyncedAt: true,
        lastSyncStatus: true,
        lastSyncMessage: true,
      },
      orderBy: [{ provider: "asc" }, { updatedAt: "desc" }],
      take: 12,
    }),
    db.runtimeEvent.findMany({
      where: {
        workspaceId,
        relatedObjectType: "RuntimeSession",
        relatedObjectId: session.id,
        OR: [
          {
            eventType: {
              startsWith: "continuity.remediation.",
            },
          },
          {
            eventType: {
              in: [...RUNTIME_SESSION_CONTROL_EVENT_TYPES],
            },
          },
        ],
      },
      select: {
        id: true,
        eventType: true,
        payload: true,
        trustedContext: true,
        triggeredBy: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
    db.runtimeEvent.findMany({
      where: {
        workspaceId,
        relatedObjectType: "Workspace",
        relatedObjectId: workspaceId,
        eventType: {
          in: [...BENCHMARK_MATRIX_EVENT_TYPES],
        },
      },
      select: {
        id: true,
        eventType: true,
        payload: true,
        trustedContext: true,
        triggeredBy: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    getWorkspaceContinuityPilotReview(workspaceId),
    getRuntimeContinuityTraceCohortMetadata({
      workspaceId,
      sessionId: session.id,
      meetingId: session.meetingId,
      opportunityId: session.opportunityId,
      companyId: session.companyId,
      updatedAt: session.updatedAt,
    }),
  ]);
  const benchmarkMatrixRuns = parseRuntimeBenchmarkMatrixRunEvents(benchmarkMatrixEvents);
  const benchmarkExecutionRequests =
    parseRuntimeBenchmarkMatrixRunRequestEvents(benchmarkMatrixEvents);
  const benchmarkExecutionAcknowledgements =
    parseRuntimeBenchmarkMatrixRunAcknowledgementEvents(benchmarkMatrixEvents);
  const benchmarkExecutionFollowThrough =
    parseRuntimeBenchmarkMatrixFollowThroughEvents(benchmarkMatrixEvents);

  const latestVerification = session.verificationReports[0];
  const latestCheckpoint = selectRuntimeContinuityCheckpoint(session.checkpoints, session.resumedFromKey);
  const swarmBudgetPosture = buildBudgetPosture({
    budgetTokenLimit: session.budgetTokenLimit,
    budgetTokenUsed: session.budgetTokenUsed,
    prunedTokenCount: session.prunedTokenCount,
    latestCheckpointStatus: latestCheckpoint?.status,
    resumedFromKey: session.resumedFromKey,
  });
  const truthConflicts = session.truthConflicts ?? [];
  const latestTruthConflict = truthConflicts[0];
  const cacheHealth = buildRuntimeCacheHealth(session.promptCacheTelemetry);
  const coordinationTrace = buildCoordinationTraceBridge({
    problemSpaces: problemSpaces.map((item) => ({
      id: item.id,
      title: item.title,
      status: item.status,
      ownerHint: item.ownerHint,
      evidenceRefs: parseRuntimeStringList(item.evidenceRefs),
      meetingId: item.meetingId,
      opportunityId: item.opportunityId,
      companyId: item.companyId,
      updatedAt: item.updatedAt,
      driAssignments: item.driAssignments.map((assignment) => ({
        assignedUserName: assignment.assignedUserName,
        assignedByName: assignment.assignedByName,
        note: assignment.note,
      })),
    })),
    humanExecutions: humanExecutions.map((item) => ({
      ...item,
      status: String(item.status).toUpperCase(),
    })),
    officialFollowThrough: officialFollowThrough.map((item) => ({
      ...item,
      followThroughStatus: String(item.followThroughStatus).toUpperCase(),
      followThroughResolutionStatus: String(item.followThroughResolutionStatus).toUpperCase(),
    })),
  });
  const promotionByCandidateId = new Map(
    session.memoryPromotions
      .filter((item) => item.memoryCandidateId)
      .map((item) => [item.memoryCandidateId as string, item]),
  );
  const blockedReasons = latestVerification ? safeParseJson<string[]>(latestVerification.blockedReasons, []) : [];
  const allPromotionDecisions = session.memoryCandidates
    .map((item) => {
      const promotion = promotionByCandidateId.get(item.id);
      const evidenceRefs = parseRuntimeStringList(item.evidenceRefs);
      const disposition = normalizeRuntimePromotionDisposition(promotion?.status ?? item.status);
      return {
        id: item.id,
        summary: item.summary,
        disposition,
        rationale: promotion?.rationale ?? item.reviewerNote ?? item.summary,
        sourceClasses: buildEvidenceSourceClasses({
          sourceVerification: item.sourceVerification,
          sourceStatus: item.sourceStatus,
          evidenceRefs,
        }),
        evidenceRefs,
        confidence: item.confidence,
        verificationStatus: latestVerification?.status ?? null,
        verificationSummary: latestVerification?.summary ?? null,
        blockedReasons,
        truthConflictStatus: toVisibleTruthConflictStatus(latestTruthConflict?.status),
        truthConflictSummary: latestTruthConflict?.summary ?? null,
        createdAt: promotion?.createdAt ?? item.createdAt,
      };
    })
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
  const promotionDecisions = allPromotionDecisions.slice(0, 6);
  const continuityState = buildRuntimeContinuityState({
    sessionLabel: session.label,
    sessionStatus: session.status,
    boundaryNote: session.boundaryNote,
    notebook: session.notebook
      ? {
          sessionSummary: session.notebook.sessionSummary,
          decisionSummary: session.notebook.decisionSummary,
          blockerSummary: session.notebook.blockerSummary,
          pendingQuestions: session.notebook.pendingQuestions,
          openLoopSummary: session.notebook.openLoopSummary,
          boundaryNote: session.notebook.boundaryNote,
        }
      : null,
    verification: latestVerification
      ? {
          status: latestVerification.status.toLowerCase(),
          blockedReasons: safeParseJson<string[]>(latestVerification.blockedReasons, []),
        }
      : null,
    problemSpaces: problemSpaces.map((item) => ({
      title: item.title,
      nextStep: item.nextStep,
      status: item.status,
      ownerHint: item.ownerHint,
      evidenceRefs: parseRuntimeStringList(item.evidenceRefs),
    })),
    promotedFacts: buildPromotedRuntimeFacts(session.memoryCandidates, session.memoryPromotions),
    truthConflicts: truthConflicts.map((item) => ({
      status: item.status,
      summary: item.summary,
    })),
    budgetTokenLimit: session.budgetTokenLimit,
    budgetTokenUsed: session.budgetTokenUsed,
    prunedTokenCount: session.prunedTokenCount,
    latestCheckpoint: latestCheckpoint
      ? {
          id: latestCheckpoint.id,
          label: latestCheckpoint.label,
          status: latestCheckpoint.status,
          summary: latestCheckpoint.summary,
          snapshotJson: latestCheckpoint.snapshotJson,
          updatedAt: latestCheckpoint.updatedAt,
        }
      : null,
    resumedFromKey: session.resumedFromKey,
    persistedPayloads: session.persistedPayloads.map((item) => ({
      handle: item.handle,
      label: item.label,
      summary: item.summary,
      estimatedTokens: item.estimatedTokens,
      sourceType: item.sourceType,
    })),
    contextEditEvents: session.contextEditEvents.map((item) => ({
      id: item.id,
      strategy: item.strategy,
      beforeTokenCount: item.beforeTokenCount,
      afterTokenCount: item.afterTokenCount,
      removedHandles: item.removedHandles,
      removedSummary: item.removedSummary,
      createdAt: item.createdAt,
    })),
  });
  const remediationTrace = parseRuntimeRemediationTrace(
    remediationEvents.filter((event) => event.eventType.startsWith("continuity.remediation.")),
  );
  const controlEvents = remediationEvents.filter((event) =>
    isRuntimeSessionControlEventType(event.eventType),
  );
  const swarmSpawnRequestEvent = parseRuntimeSwarmSpawnRequestedEvent(controlEvents);
  const swarmReadOnlyWorkerIntentEvent =
    parseRuntimeSwarmReadOnlyWorkerIntentRecordedEvent(controlEvents);
  const swarmReadOnlyWorkerPlaceholderEvent =
    parseRuntimeSwarmReadOnlyWorkerPlaceholderRecordedEvent(controlEvents);
  const swarmReadOnlyWorkerExecutionEvent =
    parseRuntimeSwarmReadOnlyWorkerExecutionRecordedEvent(controlEvents);
  const swarmReadOnlyWorkerMaterializationEvent =
    parseRuntimeSwarmReadOnlyWorkerMaterializationRecordedEvent(controlEvents);
  const swarmReadOnlyWorkerAdoptionEvent =
    parseRuntimeSwarmReadOnlyWorkerAdoptionRecordedEvent(controlEvents);
  const swarmVerificationMergeLaneEvent =
    parseRuntimeSwarmVerificationMergeLaneRecordedEvent(controlEvents);
  const takeoverRequestEvent = parseRuntimeTakeoverRequestEvent(controlEvents);
  const takeoverAcknowledgementEvent = parseRuntimeTakeoverAcknowledgementEvent(controlEvents);
  const takeoverStartedEvent = parseRuntimeTakeoverStartedEvent(controlEvents);
  const takeoverReleasedEvent = parseRuntimeTakeoverReleasedEvent(controlEvents);
  const takeoverFollowThroughRequestEvent =
    parseRuntimeTakeoverFollowThroughRequestedEvent(controlEvents);
  const takeoverFollowThroughResolvedEvent =
    parseRuntimeTakeoverFollowThroughResolvedEvent(controlEvents);
  const settlementReviewRequestedEvent =
    parseRuntimeSettlementReviewRequestedEvent(controlEvents);
  const settlementReviewResolvedEvent =
    parseRuntimeSettlementReviewResolvedEvent(controlEvents);
  const closeoutConfirmedEvent = parseRuntimeCloseoutConfirmedEvent(controlEvents);
  const closeoutRefreshRequestedEvent =
    parseRuntimeCloseoutRefreshRequestedEvent(controlEvents);
  const closeoutResolutionRecordedEvent =
    parseRuntimeCloseoutResolutionRecordedEvent(controlEvents);
  const closeoutResolutionFollowThroughRequestedEvent =
    parseRuntimeCloseoutResolutionFollowThroughRequestedEvent(controlEvents);
  const closeoutResolutionFollowThroughResolvedEvent =
    parseRuntimeCloseoutResolutionFollowThroughResolvedEvent(controlEvents);
  const closeRequestRequestedEvent = parseRuntimeCloseRequestedEvent(controlEvents);
  const humanInputRequestEvent = parseRuntimeHumanInputCheckpointRequestEvent(controlEvents);
  const humanInputAcknowledgementEvent =
    parseRuntimeHumanInputCheckpointAcknowledgementEvent(controlEvents);
  const operatorArtifacts = buildRuntimeContinuityOperatorArtifacts({
    replay: continuityState.replay,
    recovery: continuityState.recovery,
    risk: continuityState.risk,
    payloadState: continuityState.payloadState,
    notebookState: continuityState.notebookState,
    pruneTrace: continuityState.pruneTrace,
    remediationTrace,
  });
  const continuityMeetingShape = getRuntimeContinuityMeetingShape({
    posture: continuityState.budgetPosture.state,
    replayStatus:
      continuityState.replay?.fidelityStatus === "STRONG"
        ? "STRONG"
        : continuityState.replay?.fidelityStatus === "WATCH"
          ? "WATCH"
          : continuityState.replay?.fidelityStatus === "WEAK"
            ? "WEAK"
            : "NONE",
    payloadStateSource: continuityState.payloadState.stateSource,
  });
  const pilotReview = buildRuntimeContinuityPilotSessionReview({
    recovery: operatorArtifacts.recovery,
    calibration: operatorArtifacts.calibration,
    analytics: operatorArtifacts.analytics,
    effectiveness: operatorArtifacts.effectiveness,
    pilotReview: workspacePilotReview,
    cohortContext: {
      workspaceSizeBand: workspacePilotReview?.workspaceCohort.sizeBand ?? "SMALL",
      meetingShape: continuityMeetingShape,
      sessionDensityBand: getRuntimeContinuitySessionDensityBand({
        posture: continuityState.budgetPosture.state,
        budgetTokenLimit: session.budgetTokenLimit,
        budgetTokenUsed: session.budgetTokenUsed,
        prunedTokenCount: session.prunedTokenCount,
      }),
      meetingFrequencyBand: traceCohortMetadata.meetingFrequencyBand,
      failureHistoryBand: getRuntimeContinuityFailureHistoryBand({
        remediationAttempts: operatorArtifacts.analytics.totalAttempts,
        repeatPatternStatus: operatorArtifacts.analytics.repeatPattern.status,
      }),
      participantRolePosture: traceCohortMetadata.participantRolePosture,
    },
  });
  const sop = buildRuntimeContinuitySop({
    recovery: operatorArtifacts.recovery,
    analytics: operatorArtifacts.analytics,
    effectiveness: operatorArtifacts.effectiveness,
    evidence: operatorArtifacts.evidence,
    pilotReview,
  });
  const activeHandles = new Set(continuityState.payloadState.activeHandles);
  const reflectionJobs = session.consolidationJobs.filter((item) => isReflectionJobType(item.jobType));
  const consolidationJobs = session.consolidationJobs.filter((item) => !isReflectionJobType(item.jobType));
  const consolidationJobReadouts = consolidationJobs.map((item) => buildRuntimeJobQueueReadout(item));
  const consolidationAuditSummary = buildConsolidationQueueAuditSummary({
    jobs: consolidationJobReadouts,
  });
  const reflectionCandidates = session.memoryCandidates
    .filter((item) => isReflectionMemoryCandidate(item))
    .map((item) =>
      buildReflectionCandidateReadout({
        id: item.id,
        status: item.status,
        summary: item.summary,
        reviewerNote: item.reviewerNote,
        sourceVerification: item.sourceVerification,
        sourceStatus: item.sourceStatus,
        evidenceRefs: item.evidenceRefs,
        createdAt: item.createdAt,
        runtimeSession: {
          id: session.id,
          label: session.label,
          meetingId: session.meetingId,
        },
      }),
    )
    .slice(0, 4);
  const runThread = buildRunThreadContract({
    id: session.id,
    workspaceId: session.workspaceId,
    sessionKey: session.sessionKey,
    status: session.status,
    currentStage: session.currentStage,
    sourcePage: session.sourcePage,
    boundaryNote: session.boundaryNote,
    meetingId: session.meetingId,
    opportunityId: session.opportunityId,
    companyId: session.companyId,
    swarmReadOnlyWorkersEnabled: workspaceFeatureFlags.swarmReadOnlyWorkers,
    swarmBudgetEnvelope: {
      budgetTokenLimit: session.budgetTokenLimit,
      budgetTokenUsed: session.budgetTokenUsed,
      usagePercent: swarmBudgetPosture.usagePercent,
      prunedTokenCount: session.prunedTokenCount,
      posture: swarmBudgetPosture.state,
    },
    replayableEventLog: session.replayableEventLog,
    resumedFromKey: session.resumedFromKey,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    closedAt: session.closedAt,
    checkpoints: session.checkpoints.map((item) => ({
      id: item.id,
      checkpointKey: item.checkpointKey,
      label: item.label,
      status: item.status,
      summary: item.summary,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    })),
    persistedControlPlaneLifecycle: readPersistedRunThreadControlPlaneLifecycle(session),
    handoffPackets: session.handoffPackets.map((item) => mapRunThreadLifecycleHandoffPacket(item)),
    remediationTrace: remediationTrace.map((item) => mapRunThreadLifecycleRemediationEntry(item)),
    swarmSpawnRequestEvent,
    swarmReadOnlyWorkerIntentEvent,
    swarmReadOnlyWorkerPlaceholderEvent,
    swarmReadOnlyWorkerExecutionEvent,
    swarmReadOnlyWorkerMaterializationEvent,
    swarmReadOnlyWorkerAdoptionEvent,
    swarmVerificationMergeLaneEvent,
    verification: latestVerification
      ? {
          status: normalizeRunThreadVerificationStatus(latestVerification.status) ?? "needs_review",
          blockedReasons: safeParseJson<string[]>(latestVerification.blockedReasons, []),
          summary: latestVerification.summary,
        }
      : null,
    truthConflicts: (session.truthConflicts ?? []).map((item) => ({
      status: normalizeRunThreadTruthConflictState(item.status) ?? "open",
      summary: item.summary,
    })),
    requestLifecycleEntries: buildRunThreadRequestLifecycleInputs({
      takeoverRequestEvent,
      takeoverAcknowledgementEvent,
      takeoverStartedEvent,
      takeoverReleasedEvent,
      takeoverFollowThroughRequestEvent,
      takeoverFollowThroughResolvedEvent,
      humanInputRequestEvent,
      humanInputAcknowledgementEvent,
    }),
    settlementReviewEntries: buildRunThreadSettlementLifecycleInputs({
      settlementReviewRequestedEvent,
      settlementReviewResolvedEvent,
    }),
    closeoutConfirmationEntries: buildRunThreadCloseoutConfirmationLifecycleInputs({
      closeoutConfirmedEvent,
    }),
    closeoutRefreshEntries: buildRunThreadCloseoutRefreshLifecycleInputs({
      closeoutRefreshRequestedEvent,
    }),
    closeoutResolutionEntries: buildRunThreadCloseoutResolutionLifecycleInputs({
      closeoutResolutionRecordedEvent,
    }),
    closeoutResolutionFollowThroughEntries:
      buildRunThreadCloseoutResolutionFollowThroughLifecycleInputs({
        closeoutResolutionFollowThroughRequestedEvent,
        closeoutResolutionFollowThroughResolvedEvent,
      }),
    closeRequestEntries: buildRunThreadCloseRequestLifecycleInputs({
      closeRequestRequestedEvent,
    }),
    resultAcknowledgements: buildRunThreadResultAcknowledgementInputs({
      context: {
        meetingId: session.meetingId,
        opportunityId: session.opportunityId,
        companyId: session.companyId,
      },
      humanExecutions: humanExecutions.map((item) => ({
        ...item,
        status: String(item.status).toUpperCase(),
        executionAcknowledgementStatus: String(item.acknowledgementStatus).toUpperCase(),
      })),
      officialWriteIntents: officialWriteIntents.map((item) => ({
        ...item,
        writeActionType: String(item.writeActionType),
        writeExecutionStatus: String(item.writeExecutionStatus).toUpperCase(),
        writeAcknowledgementStatus: String(item.writeAcknowledgementStatus).toUpperCase(),
      })),
      limitedAutoIntents: limitedAutoIntents.map((item) => ({
        ...item,
        limitedAutoActionType: String(item.limitedAutoActionType),
        limitedAutoExecutionStatus: String(item.limitedAutoExecutionStatus).toUpperCase(),
        limitedAutoAckStatus: String(item.limitedAutoAckStatus).toUpperCase(),
      })),
      officialFollowThrough: officialFollowThrough.map((item) => ({
        ...item,
        followThroughStatus: String(item.followThroughStatus).toUpperCase(),
        followThroughResolutionStatus: String(item.followThroughResolutionStatus).toUpperCase(),
      })),
    }),
  });
  const debuggerReadModel = buildOperatorDebuggerReadModel({
    sessionLabel: session.label,
    runThread,
    replayableEventLog: session.replayableEventLog,
    replay: continuityState.replay,
    recovery: operatorArtifacts.recovery,
    notebookState: continuityState.notebookState,
    payloadState: continuityState.payloadState,
    verification: latestVerification
      ? {
          status: latestVerification.status,
          blockedReasons: safeParseJson<string[]>(latestVerification.blockedReasons, []),
        }
      : null,
    contextEditEvents: session.contextEditEvents.map((item) => ({
      id: item.id,
      strategy: item.strategy,
      beforeTokenCount: item.beforeTokenCount,
      afterTokenCount: item.afterTokenCount,
      removedSummary: item.removedSummary,
      createdAt: item.createdAt,
    })),
    remediationTrace: remediationTrace.map((item) => ({
      id: item.id,
      action: item.action,
      executionStatus: item.executionStatus,
      summary: item.summary,
      rollbackAnchorSummary: item.rollbackAnchorSummary,
      triggeredBy: item.triggeredBy,
      createdAt: item.createdAt,
    })),
    handoffPackets: session.handoffPackets.map((item) => ({
      id: item.id,
      packetKey: item.packetKey,
      fromAgent: normalizeRuntimeAgentId(item.fromAgent),
      toAgent: normalizeRuntimeAgentId(item.toAgent),
      goal: item.goal,
      approvalTier: normalizeRuntimeApprovalTier(item.approvalTier),
      constraintsJson: item.constraintsJson,
      trustedRefs: item.trustedRefs,
      untrustedRefs: item.untrustedRefs,
      requiredOutputs: item.requiredOutputs,
      evidenceRefs: item.evidenceRefs,
      notebookRef: item.notebookRef,
      checkpointRef: item.checkpointRef,
      createdAt: item.createdAt,
    })),
    takeoverRequestEvent,
    takeoverAcknowledgementEvent,
    takeoverStartEvent: takeoverStartedEvent,
    takeoverReleaseEvent: takeoverReleasedEvent,
    takeoverFollowThroughRequestEvent,
    takeoverFollowThroughResolvedEvent,
    humanInputRequestEvent,
    humanInputAcknowledgementEvent,
  });
  const projectSkillLibrary = buildProjectSkillLibraryReadModel({
    capabilitySignals: capabilities.map((item) => ({
      id: item.id,
      name: item.name,
      stage: item.stage,
      description: item.description,
      loadPolicy: item.loadPolicy,
      reviewRequired: item.reviewRequired,
      boundaryNote: item.boundaryNote,
    })),
  });
  const environmentContract = buildEnvironmentContractReadModel({
    projectSkillLibrary,
    connectors: connectors.map((item) => ({
      id: item.id,
      provider: String(item.provider),
      status: String(item.status),
      lastSyncedAt: item.lastSyncedAt ?? null,
      lastSyncStatus: item.lastSyncStatus ?? null,
      lastSyncMessage: item.lastSyncMessage ?? null,
    })),
    officialActionCoverage: getRicherOfficialActionCoverageCatalog().map((item) => ({
      actionType: item.actionType,
      defaultPath: item.defaultPath,
      limitedAutoStatus: item.limitedAutoStatus,
      executableLimitedAuto: item.executableLimitedAuto,
      boundaryReason: item.boundaryReason,
    })),
    officialWriteIntents: officialWriteIntents.map((item) => ({
      ...item,
      actionType: String(item.writeActionType),
      acknowledgementStatus: String(item.writeAcknowledgementStatus).toUpperCase(),
    })),
    limitedAutoIntents: limitedAutoIntents.map((item) => ({
      ...item,
      actionType: String(item.limitedAutoActionType),
      acknowledgementStatus: String(item.limitedAutoAckStatus).toUpperCase(),
    })),
    officialFollowThrough: officialFollowThrough.map((item) => ({
      ...item,
      followThroughStatus: String(item.followThroughStatus).toUpperCase(),
      followThroughResolutionStatus: String(item.followThroughResolutionStatus).toUpperCase(),
    })),
    humanExecutionCount: humanExecutions.length,
    officialFollowThroughCount: officialFollowThrough.length,
  });
  const benchmarkMatrix = buildBenchmarkMatrixReadModel({
    recordedRuns: benchmarkMatrixRuns,
    executionRequests: benchmarkExecutionRequests,
    executionAcknowledgements: benchmarkExecutionAcknowledgements,
    executionFollowThrough: benchmarkExecutionFollowThrough,
  });
  const operatorControlSummary = buildRuntimeOperatorControlSummary({
    environmentContract,
    benchmarkMatrix,
  });
  const swarmOperatorControlSurface = buildRuntimeSwarmOperatorControlSurface({
    items: [
      {
        id: session.id,
        meetingId: session.meetingId,
        title: session.label,
        href: buildRuntimeSessionHref(session.meetingId),
        updatedAt: session.updatedAt,
        latestCheckpointId: latestCheckpoint?.id ?? null,
        latestCheckpointKey: latestCheckpoint?.checkpointKey ?? null,
        resumeState: runThread.resume.state,
        resumeAskMode: debuggerReadModel.resumeAsk.mode,
        interruptReasonState: debuggerReadModel.interruptReason.state,
        recoveryState: continuityState.recovery.state,
        humanInputCheckpointState: runThread.humanInputCheckpoint.state,
        humanInputCheckpointId: runThread.humanInputCheckpoint.checkpointId,
        humanInputCheckpointKey: runThread.humanInputCheckpoint.checkpointKey,
        humanInputRequestState: debuggerReadModel.humanInputRequest.state,
        closeRequestState: runThread.closeRequest.state,
        closeRequestCheckpointId: runThread.closeRequest.checkpointId,
        closeRequestCheckpointKey: runThread.closeRequest.checkpointKey,
        takeoverRequestState: debuggerReadModel.takeoverRequest.state,
        takeoverActivationState: debuggerReadModel.takeoverActivation.state,
        takeoverFollowThroughState: debuggerReadModel.takeoverFollowThrough.state,
        takeoverOwner: debuggerReadModel.takeoverActivation.currentOwner,
        swarmBudgetPosture: runThread.swarmSpawnBudgetEnvelope.budgetPosture,
        swarmSpawnDenyReason: debuggerReadModel.swarmSpawnContract.denyReason,
        repeatPatternStatus: operatorArtifacts.analytics.repeatPattern.status,
      },
    ],
  });
  const operatorProgressSummary = buildRuntimeOperatorProgressSummary({
    requestPosture: runThread.requestPosture,
    takeoverActivation: debuggerReadModel.takeoverActivation,
    operatorControlSummary,
    closePostureForwardSummary: runThread.closePostureForwardSummary,
  });
  const operatorActionSummary = buildRuntimeOperatorActionSummary({
    operatorProgressSummary,
    requestPosture: runThread.requestPosture,
    takeoverActivation: debuggerReadModel.takeoverActivation,
    closePostureForwardSummary: runThread.closePostureForwardSummary,
  });
  operatorActionSummary.focusTitle = session.label;
  operatorActionSummary.focusHref = buildRuntimeSessionHref(session.meetingId);

  return {
    session: {
      id: session.id,
      status: session.status,
      currentStage: session.currentStage,
      budgetTokenLimit: session.budgetTokenLimit,
      budgetTokenUsed: session.budgetTokenUsed,
      loadedTokenCount: session.loadedTokenCount,
      prunedTokenCount: session.prunedTokenCount,
    },
    runThread,
    debugger: debuggerReadModel,
    continuity: {
      budgetPosture: continuityState.budgetPosture,
      notebookState: continuityState.notebookState,
      replay: continuityState.replay,
      recovery: operatorArtifacts.recovery,
      calibration: operatorArtifacts.calibration,
      pruneTrace: continuityState.pruneTrace,
      remediationTrace,
      analytics: operatorArtifacts.analytics,
      effectiveness: operatorArtifacts.effectiveness,
      evidence: operatorArtifacts.evidence,
      runbook: operatorArtifacts.runbook,
      pilotReview,
      sop,
    },
    payloads: {
      total: session.persistedPayloads.length,
      handles: session.persistedPayloads.map((item) => item.handle),
      activeHandles: continuityState.payloadState.activeHandles,
      estimatedTokens: session.persistedPayloads.reduce((sum, item) => sum + item.estimatedTokens, 0),
      prunedHandles: continuityState.payloadState.prunedHandles,
      stateDerivation: continuityState.payloadState.stateSummary,
      items: session.persistedPayloads.map((item) => ({
        handle: item.handle,
        label: item.label,
        sourceType: item.sourceType,
        loadPolicy: item.loadPolicy,
        preview: item.preview,
        summary: item.summary,
        estimatedTokens: item.estimatedTokens,
        loadedByDefault: item.loadedByDefault,
        activeInContext: activeHandles.has(item.handle),
      })),
    },
    notebook: session.notebook
      ? {
          summary: session.notebook.sessionSummary,
          decisionSummary: session.notebook.decisionSummary,
          blockerSummary: session.notebook.blockerSummary,
          pendingQuestions: safeParseJson<string[]>(session.notebook.pendingQuestions, []),
        }
      : null,
    latestCheckpoint: latestCheckpoint
      ? {
          id: latestCheckpoint.id,
          label: latestCheckpoint.label,
          status: latestCheckpoint.status,
          summary: latestCheckpoint.summary,
          createdAt: latestCheckpoint.createdAt,
        }
      : null,
    verification: latestVerification
      ? {
          status: latestVerification.status,
          truthScore: latestVerification.truthScore,
          summary: latestVerification.summary,
          blockedReasons: safeParseJson<string[]>(latestVerification.blockedReasons, []),
          boundaryNotes: safeParseJson<string[]>(latestVerification.boundaryNotes, []),
        }
      : null,
    promotionQueue: {
      candidates: session.memoryCandidates.length,
      promoted: allPromotionDecisions.filter((item) => item.disposition === "PROMOTED").length,
      deferred: allPromotionDecisions.filter((item) => item.disposition === "DEFERRED").length,
      rejected: allPromotionDecisions.filter((item) => item.disposition === "REJECTED").length,
    },
    promotionDecisions,
    truthConflicts: truthConflicts.slice(0, 3).map((item) => ({
      id: item.id,
      summary: item.summary,
      status: item.status,
    })),
    problemSpaces: problemSpaces.map((item) => {
      const coordinationOutcome = mapProblemSpaceStatusToCoordinationOutcome(item.status);
      const latestAssignment = item.driAssignments[0] ?? null;
      return {
        id: item.id,
        title: item.title,
        summary: item.summary,
        nextStep: item.nextStep,
        status: item.status,
        ownerHint: item.ownerHint,
        groundingSummary: buildProblemSpaceGroundingSummary({
          evidenceRefs: parseRuntimeStringList(item.evidenceRefs),
          coordinationOutcome,
        }),
        driSummary: latestAssignment
          ? buildProblemSpaceDriSummary({
              assignedUserName: latestAssignment.assignedUserName ?? item.ownerHint,
              assignedByName: latestAssignment.assignedByName,
              assignmentNote: latestAssignment.note,
              coordinationOutcome,
            })
          : null,
        conflictSummary: buildProblemSpaceConflictSummary(coordinationOutcome),
      };
    }),
    edgeBriefs: edgeBriefs.map((item) => ({
      id: item.id,
      title: item.title,
      audience: item.audience,
      summary: item.summary,
      problemSpaceTitle: item.problemSpace?.title ?? null,
      truthPosture: item.problemSpace
        ? buildProblemSpaceTruthPosture(mapProblemSpaceStatusToCoordinationOutcome(item.problemSpace.status))
        : buildProblemSpaceTruthPosture("review_needed"),
    })),
    compositionFailures: compositionFailures.map((item) => ({
      id: item.id,
      failureClass: item.failureClass,
      summary: item.summary,
      resolved: item.resolved,
      problemSpaceTitle: item.problemSpace?.title ?? null,
    })),
    signals: session.signalEvents.slice(0, 6).map((item) => ({
      id: item.id,
      signalType: item.signalType,
      sourceType: item.sourceType,
      signalSummary: item.signalSummary,
      truthWeight: item.truthWeight,
      createdAt: item.createdAt,
    })),
    worldModels: session.worldModelSnapshots.slice(0, 4).map((item) => ({
      id: item.id,
      summary: item.summary,
      createdAt: item.createdAt,
    })),
    artifactVersions: artifactVersions.slice(0, 6).map((item) => ({
      id: item.id,
      artifactType: item.artifactType,
      versionNumber: item.versionNumber,
      reviewPosture: item.reviewPosture ?? null,
      createdAt: item.createdAt,
    })),
    capabilities: capabilities.map((item) => ({
      id: item.id,
      name: item.name,
      stage: item.stage,
      description: item.description,
      loadPolicy: item.loadPolicy,
      reviewRequired: item.reviewRequired,
    })),
    projectSkillLibrary,
    environmentContract,
    benchmarkMatrix,
    operatorControlSummary,
    swarmOperatorControlSurface,
    operatorActionSummary,
    operatorProgressSummary,
    handoffPackets: session.handoffPackets.slice(0, 6).map((item) => ({
      id: item.id,
      fromAgent: normalizeRuntimeAgentId(item.fromAgent),
      toAgent: normalizeRuntimeAgentId(item.toAgent),
      goal: item.goal,
      approvalTier: normalizeRuntimeApprovalTier(item.approvalTier),
      createdAt: item.createdAt,
    })),
    initiativeRuns: session.initiativeRuns.slice(0, 6).map((item) => ({
      id: item.id,
      title: item.title,
      summary: item.summary,
      status: item.status,
      targetOutcome: item.targetOutcome,
      createdAt: item.createdAt,
    })),
    coordinationMetrics: coordinationMetrics
      ? {
          metricDate: coordinationMetrics.metricDate,
          actionReady: coordinationMetrics.actionReadyCount,
          reviewNeeded: coordinationMetrics.reviewNeededCount,
          waitingOnSignal: coordinationMetrics.waitingOnSignalCount,
          waitingOnAuthority: coordinationMetrics.waitingOnAuthorityCount,
          capabilityGap: coordinationMetrics.capabilityGapCount,
        }
      : {
          metricDate: null,
          actionReady: 0,
          reviewNeeded: 0,
          waitingOnSignal: 0,
          waitingOnAuthority: 0,
          capabilityGap: 0,
    },
    coordinationTrace,
    cacheHealth,
    reflection: {
      activeJobs: reflectionJobs.filter((item) => isActiveRuntimeJobStatus(item.status)).length,
      latestJob: reflectionJobs[0]
        ? {
            id: reflectionJobs[0].id,
            jobType: reflectionJobs[0].jobType,
            status: reflectionJobs[0].status,
            inputSummary: reflectionJobs[0].inputSummary,
            outputSummary: reflectionJobs[0].outputSummary,
            reviewPosture: reflectionJobs[0].reviewPosture,
            createdAt: reflectionJobs[0].createdAt,
            pausedAt: reflectionJobs[0].pausedAt,
            completedAt: reflectionJobs[0].completedAt,
          }
        : null,
      recentJobs: reflectionJobs.slice(0, 4).map((item) => ({
        id: item.id,
        jobType: item.jobType,
        status: item.status,
        inputSummary: item.inputSummary,
        outputSummary: item.outputSummary,
        createdAt: item.createdAt,
        pausedAt: item.pausedAt,
        completedAt: item.completedAt,
      })),
      recentCandidates: reflectionCandidates,
    },
    consolidation: {
      activeJobs: consolidationJobs.filter((item) => isActiveRuntimeJobStatus(item.status)).length,
      auditSummary: consolidationAuditSummary,
      latestJob: consolidationJobs[0]
        ? {
            id: consolidationJobs[0].id,
            jobType: consolidationJobs[0].jobType,
            status: consolidationJobs[0].status,
            inputSummary: consolidationJobs[0].inputSummary,
            outputSummary: consolidationJobs[0].outputSummary,
            reviewPosture: consolidationJobs[0].reviewPosture,
            meetingId: session.meetingId,
            createdAt: consolidationJobs[0].createdAt,
            pausedAt: consolidationJobs[0].pausedAt,
            completedAt: consolidationJobs[0].completedAt,
          }
        : null,
      recentJobs: consolidationJobReadouts.slice(0, 4).map((item) => ({
        id: item.id,
        jobType: item.jobType,
        status: item.status,
        inputSummary: item.inputSummary,
        outputSummary: item.outputSummary,
        meetingId: item.meetingId,
        createdAt: item.createdAt,
        pausedAt: item.pausedAt,
        completedAt: item.completedAt,
      })),
    },
  };
}
