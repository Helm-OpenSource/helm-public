"use client";

import Link from "next/link";
import { CustomerAssetFocusStrip } from "@/components/shared/customer-asset-focus-strip";
import { PageHeader } from "@/components/shared/page-header";
import { LazyDisclosure } from "@/components/shared/lazy-disclosure";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useWorkspaceUi } from "@/components/providers/workspace-ui-provider";
import {
  buildPilotReadinessModel,
  getOperatingSkillById,
  getOperatingSkillsForSurface,
  type WorkspaceFirstLoopModel,
} from "@/lib/operating-system";
import type { BusinessLoopGapSummary } from "@/lib/operating-system/operating-gap";
import { buildBusinessLoopGapReadout } from "@/lib/presentation/business-loop-gap-readout";
import { formatDateLabel } from "@/lib/utils";
import { formatDiagnosticsDateLabel } from "@/features/diagnostics/diagnostics-date-labels";
import { buildFirstLoopAdoptionReadout } from "@/features/diagnostics/first-loop-adoption";
import {
  buildDiagnosticsFirstLoopDisplayModel,
  formatDiagnosticsFeatureFlagLabel,
  formatDiagnosticsTechnicalKey,
  formatDiagnosticsVisibleText,
} from "@/features/diagnostics/display-copy";

type DiagnosticsClientProps = {
  data: {
    workspace: {
      name: string;
      locale: "zh-CN" | "en-US";
      pilotMode: boolean;
      captureConsentRequired: boolean;
      dataRetentionDays: number;
      featureFlags: Record<string, boolean>;
    };
    recommendationQuality: {
      goldenSummary: {
        passRate: number;
        totalCases: number;
        passedCases: number;
      };
      acceptanceRate: number;
      actionCreationRate: number;
      editedApprovalRate: number;
    };
    memoryQuality: {
      goldenSummary: {
        passRate: number;
        factHitRate: number;
        commitmentHitRate: number;
        blockerHitRate: number;
      };
      correctionRate: number;
    };
    llmOverview: {
      totalCalls: number;
      successCount: number;
      fallbackCount: number;
      averageLatencyMs: number;
      providerBreakdown: Array<{ providerModel: string; count: number }>;
      fallbackBreakdown: Array<{ reason: string; count: number }>;
    };
    captureOverview: {
      totalSessions: number;
      completedSessions: number;
      failedSessions: number;
      averageDurationSeconds: number;
      averageConfidence: number;
      transcriptSourceBreakdown: Array<{ sourceType: string; count: number }>;
      languageBreakdown: Array<{ language: string; count: number }>;
      providerBreakdown: Array<{ provider: string; count: number }>;
      recentFailures: Array<{
        id: string;
        title: string | null;
        errorMessage: string | null;
        createdAt: Date;
      }>;
    };
    memoryObservability: {
      factsCreatedCount: number;
      correctionsCount: number;
      activeFactsCount: number;
      confirmedActiveFactsCount: number;
      confirmationRate: number;
      factTypeBreakdown: Array<{ factType: string; count: number }>;
      extractionLlm: {
        totalCalls: number;
        fallbackCount: number;
        averageLatencyMs: number;
        totalPromptTokens: number;
        totalCompletionTokens: number;
        fallbackBreakdown: Array<{ reason: string; count: number }>;
      };
      briefingLlm: {
        totalCalls: number;
        fallbackCount: number;
        averageLatencyMs: number;
        totalPromptTokens: number;
        totalCompletionTokens: number;
        fallbackBreakdown: Array<{ reason: string; count: number }>;
      };
      memoryWriteFailureReview: {
        failureEventCount: number;
        sampledFailureEventCount: number;
        sampleLimit: number;
        isSampled: boolean;
        blockedBatchCount: number;
        partialFailedBatchCount: number;
        retryableFailureCount: number;
        nonRetryableFailureCount: number;
        operatorReviewRequiredCount: number;
        duplicateSuppressionCount: number;
        conflictCandidateCount: number;
        failureClassBreakdown: Array<{ failureClass: string; count: number }>;
        failureReasonBreakdown: Array<{ reason: string; count: number }>;
        recentFailures: Array<{
          id: string;
          targetType: string;
          targetId: string;
          meetingId: string | null;
          summary: string;
          createdAt: string;
          batchStatus: string;
          failurePolicy: string;
          attemptedFactCount: number;
          createdFactCount: number;
          failedFactCount: number;
          duplicateSuppressionCount: number;
          conflictCandidateCount: number;
          firstFailureClass: string | null;
          firstFailureReason: string | null;
          firstFailureTitle: string | null;
          firstFailureMessage: string | null;
          retryableFailureCount: number;
          nonRetryableFailureCount: number;
          operatorReviewRequiredCount: number;
          reviewPosture:
            | "manual_retry_candidate"
            | "operator_review_required"
            | "blocked_no_auto_action";
        }>;
        operatorQueue: {
          queueItemCount: number;
          visibleQueueItemCount: number;
          omittedQueueItemCount: number;
          itemLimit: number;
          hasMoreItems: boolean;
          retryCandidateCount: number;
          conflictReviewCount: number;
          sourceRepairCount: number;
          payloadReviewCount: number;
          items: Array<{
            id: string;
            auditId: string;
            targetType: string;
            targetId: string;
            meetingId: string | null;
            createdAt: string;
            title: string | null;
            objectType: string | null;
            objectId: string | null;
            factType: string | null;
            sourceType: string | null;
            sourceId: string | null;
            payloadStatus: "valid" | "empty" | "malformed";
            failureClass: string;
            reason: string;
            batchStatus: string;
            reviewPosture:
              | "retry_manual_confirm"
              | "merge_conflict_review"
              | "source_data_repair"
              | "inspect_audit_payload";
            nextAction:
              | "rebuild_from_source_then_retry"
              | "review_conflict_candidate"
              | "repair_source_or_object"
              | "inspect_failure_payload";
            retryReadiness:
              | "candidate_requires_operator_confirmation"
              | "not_retryable"
              | "requires_payload_or_conflict_review";
            canAutoRetry: false;
            boundaryNote: string;
          }>;
          boundaryNote: string;
        };
        retryContract: {
          contractItemCount: number;
          manualConfirmationRequiredCount: number;
          blockedMissingPayloadCount: number;
          blockedConflictReviewCount: number;
          blockedNonRetryableCount: number;
          blockedPayloadInspectionCount: number;
          executableAutomaticallyCount: 0;
          attemptLimit: number;
          backoffDelaysMinutes: number[];
          items: Array<{
            id: string;
            queueItemId: string;
            auditId: string;
            targetType: string;
            targetId: string;
            title: string | null;
            objectType: string | null;
            objectId: string | null;
            factType: string | null;
            sourceType: string | null;
            sourceId: string | null;
            failureClass: string;
            reason: string;
            reviewPosture:
              | "retry_manual_confirm"
              | "merge_conflict_review"
              | "source_data_repair"
              | "inspect_audit_payload";
            contractStatus:
              | "manual_confirmation_required"
              | "blocked_missing_retry_payload"
              | "blocked_conflict_review_required"
              | "blocked_non_retryable"
              | "blocked_payload_inspection_required";
            retryMode: "manual_confirmed_rebuild_only";
            canExecuteAutomatically: false;
            manualConfirmationRequired: true;
            idempotencyLockKey: string | null;
            missingInputs: string[];
            requiredManualChecks: string[];
            receiptDraft: {
              receiptVersion: "memory_write_retry_receipt_v1";
              receiptStatus:
                | "plan_only_pending_manual_confirmation"
                | "blocked";
              sourceAuditId: string;
              queueItemId: string;
              idempotencyLockKey: string | null;
              attemptLimit: number;
              plannedAttemptCount: 0;
              backoffPolicy: {
                strategy: "bounded_exponential";
                delaysMinutes: number[];
              };
              boundaryNote: string;
            };
            boundaryNote: string;
          }>;
          boundaryNote: string;
        };
        retryReceiptLedger: {
          ledgerItemCount: number;
          receiptAuditCount: number;
          persistedReceiptCount: number;
          missingReceiptCount: number;
          pendingManualConfirmationCount: number;
          confirmedReadyForExecutorCount: number;
          blockedReceiptCount: number;
          dismissedReceiptCount: number;
          invalidReceiptPayloadCount: number;
          ownerAssignedCount: number;
          ownerMissingCount: number;
          executableAutomaticallyCount: 0;
          items: Array<{
            id: string;
            retryContractItemId: string;
            queueItemId: string;
            auditId: string;
            targetType: string;
            targetId: string;
            title: string | null;
            objectType: string | null;
            objectId: string | null;
            factType: string | null;
            sourceType: string | null;
            sourceId: string | null;
            contractStatus:
              | "manual_confirmation_required"
              | "blocked_missing_retry_payload"
              | "blocked_conflict_review_required"
              | "blocked_non_retryable"
              | "blocked_payload_inspection_required";
            retryMode: "manual_confirmed_rebuild_only";
            idempotencyLockKey: string | null;
            ownerUserId: string | null;
            ownerName: string | null;
            ownerEmail: string | null;
            ownerLabel: string;
            ownerReviewStatus: "owner_assigned" | "owner_missing";
            receiptAuditId: string | null;
            receiptCreatedAt: string | null;
            receiptStatus:
              | "pending_manual_confirmation"
              | "confirmed_ready_for_executor"
              | "blocked"
              | "dismissed"
              | "missing_receipt"
              | "invalid_receipt_payload";
            receiptPayloadStatus: "valid" | "missing" | "malformed";
            attemptLimit: number;
            backoffDelaysMinutes: number[];
            plannedAttemptCount: number | null;
            missingInputs: string[];
            requiredManualChecks: string[];
            nextOperatorAction:
              | "assign_owner_before_review"
              | "record_retry_receipt"
              | "confirm_or_dismiss_receipt"
              | "ready_for_later_executor_after_manual_confirmation"
              | "resolve_blocking_contract"
              | "inspect_receipt_payload"
              | "no_action_dismissed";
            manualConfirmationRequired: true;
            canExecuteAutomatically: false;
            boundaryNote: string;
          }>;
          boundaryNote: string;
        };
        retryAttemptLedger: {
          ledgerItemCount: number;
          attemptAuditCount: number;
          persistedAttemptCount: number;
          invalidAttemptPayloadCount: number;
          unmatchedAttemptAuditCount: number;
          missingReceiptLockCount: number;
          receiptNotConfirmedCount: number;
          missingIdempotencyLockCount: number;
          idempotencyConflictCount: number;
          sourceRebuildRequiredCount: number;
          lockAvailableForManualAttemptCount: number;
          reservedLockCount: number;
          attemptLimitReachedCount: number;
          dismissedCount: number;
          executableAutomaticallyCount: 0;
          items: Array<{
            id: string;
            retryContractItemId: string;
            queueItemId: string;
            auditId: string;
            targetType: string;
            targetId: string;
            title: string | null;
            objectType: string | null;
            objectId: string | null;
            factType: string | null;
            sourceType: string | null;
            sourceId: string | null;
            receiptAuditId: string | null;
            receiptStatus:
              | "pending_manual_confirmation"
              | "confirmed_ready_for_executor"
              | "blocked"
              | "dismissed"
              | "missing_receipt"
              | "invalid_receipt_payload";
            receiptPayloadStatus: "valid" | "missing" | "malformed";
            idempotencyLockKey: string | null;
            ownerUserId: string | null;
            ownerName: string | null;
            ownerEmail: string | null;
            ownerLabel: string;
            attemptCount: number;
            attemptLimit: number;
            remainingAttemptCount: number;
            latestAttemptAuditId: string | null;
            latestAttemptCreatedAt: string | null;
            latestAttemptStatus:
              | "lock_reserved"
              | "blocked_missing_receipt"
              | "blocked_receipt_not_confirmed"
              | "blocked_missing_idempotency_lock"
              | "blocked_idempotency_conflict"
              | "blocked_source_rebuild_required"
              | "blocked_attempt_limit_reached"
              | "blocked_attempt_payload_inspection"
              | "dismissed"
              | "missing_attempt"
              | "invalid_attempt_payload";
            attemptPayloadStatus: "valid" | "missing" | "malformed";
            backoffDelaysMinutes: number[];
            nextBackoffDelayMinutes: number | null;
            idempotencyLockStatus:
              | "blocked_missing_receipt"
              | "blocked_receipt_not_confirmed"
              | "blocked_missing_idempotency_lock"
              | "blocked_idempotency_conflict"
              | "blocked_source_rebuild_required"
              | "lock_available_for_manual_attempt"
              | "lock_reserved"
              | "blocked_attempt_limit_reached"
              | "inspect_attempt_payload"
              | "dismissed";
            sourceRebuildGate: {
              gateVersion: "memory_write_retry_source_rebuild_gate_v1";
              gateStatus:
                | "blocked_missing_receipt"
                | "blocked_receipt_not_confirmed"
                | "blocked_missing_idempotency_lock"
                | "blocked_missing_source"
                | "manual_rebuild_required"
                | "ready_for_manual_rebuild_review"
                | "blocked_attempt_limit_reached"
                | "dismissed";
              receiptStatus:
                | "pending_manual_confirmation"
                | "confirmed_ready_for_executor"
                | "blocked"
                | "dismissed"
                | "missing_receipt"
                | "invalid_receipt_payload";
              sourceType: string | null;
              sourceId: string | null;
              missingInputs: string[];
              requiredManualChecks: string[];
              nextOperatorAction:
                | "record_retry_receipt"
                | "confirm_retry_receipt_before_attempt"
                | "repair_retry_contract"
                | "rebuild_source_payload_before_attempt"
                | "record_attempt_lock_after_manual_review"
                | "review_attempt_limit"
                | "review_idempotency_conflict"
                | "inspect_attempt_payload"
                | "no_action_dismissed";
              manualConfirmationRequired: true;
              canExecuteAutomatically: false;
              boundaryNote: string;
            };
            nextOperatorAction:
              | "record_retry_receipt"
              | "confirm_retry_receipt_before_attempt"
              | "repair_retry_contract"
              | "rebuild_source_payload_before_attempt"
              | "record_attempt_lock_after_manual_review"
              | "review_attempt_limit"
              | "review_idempotency_conflict"
              | "inspect_attempt_payload"
              | "no_action_dismissed";
            manualConfirmationRequired: true;
            canExecuteAutomatically: false;
            boundaryNote: string;
          }>;
          boundaryNote: string;
        };
        boundaryNote: string;
      };
      retrievalBaseline: {
        totalCandidateCount: number;
        selectedCandidateCount: number;
        omittedCandidateCount: number;
        staleSuppressionCandidateCount: number;
        duplicateCandidateCount: number;
        sourceEventCount: number;
        averageFactsPerSourceEvent: number;
        selectedRate: number;
        omittedRate: number;
        staleSuppressionRate: number;
        duplicateRate: number;
        selectedReasons: Array<{ reason: string; count: number }>;
        omittedReasons: Array<{ reason: string; count: number }>;
      };
      retrievalSurfaceTrace: {
        traceCount: number;
        totals: {
          candidateCount: number;
          selectedCount: number;
          omittedCount: number;
          fallbackCount: number;
          staleSuppressionCount: number;
          estimatedTokensUsed: number;
        };
        sourceBreakdown: Array<{ source: string; count: number }>;
        surfaceBreakdown: Array<{
          surface: string;
          traceCount: number;
          candidateCount: number;
          selectedCount: number;
          omittedCount: number;
          fallbackCount: number;
          staleSuppressionCount: number;
          estimatedTokensUsed: number;
          averageSelectedCount: number;
          averageOmittedCount: number;
          selectedReasons: Array<{ reason: string; count: number }>;
          omittedReasons: Array<{ reason: string; count: number }>;
        }>;
        recentTraceRefs: Array<{
          source: string;
          surface: string;
          objectType: string;
          objectId: string;
          selectedCount: number;
          omittedCount: number;
          fallbackUsed: boolean;
          createdAt: string | null;
        }>;
        boundaryNote: string;
      };
    };
    crmSources: Array<{
      id: string;
      sourceType: string;
      status: string;
      externalAccountLabel: string | null;
      lastSyncedAt: Date | null;
    }>;
    importJobs: Array<{
      id: string;
      jobType: string;
      status: string;
      successRecords: number;
      warningRecords: number;
      failedRecords: number;
      startedAt: Date;
      source: {
        sourceType: string;
        externalAccountLabel: string | null;
      };
    }>;
    identityReviewCount: number;
    pendingApprovals: number;
    recentAuditCount: number;
    firstLoopAdoption: {
      handoffEnteredCount: number;
      primaryActionOpenedCount: number;
      anchorSavedCount: number;
      anchorResumedCount: number;
      reviewCompletedCount: number;
      writeBackConfirmedCount: number;
      byUser: Array<{
        userId: string;
        actor: string;
        isCurrentUser: boolean;
        handoffEnteredCount: number;
        primaryActionOpenedCount: number;
        anchorSavedCount: number;
        anchorResumedCount: number;
        reviewCompletedCount: number;
        writeBackConfirmedCount: number;
        totalCount: number;
        posture:
          | "handoff-only"
          | "active"
          | "returning"
          | "reviewed"
          | "closed-loop";
        lastTouchedAt: Date;
      }>;
    };
  };
  businessLoopGapSummary: BusinessLoopGapSummary;
  firstLoopModel: WorkspaceFirstLoopModel;
};

type DiagnosticsOperatingConnection = {
  label: string;
  value: string;
  description: string;
  href?: string;
};

export function DiagnosticsClient({
  data,
  businessLoopGapSummary,
  firstLoopModel,
}: DiagnosticsClientProps) {
  const { messages, locale } = useWorkspaceUi();
  const english = locale === "en-US";
  const dateLabel = (value: Date | string | null | undefined) =>
    formatDiagnosticsDateLabel(value, english, formatDateLabel);
  const diagnosticsText = (value: string | null | undefined) =>
    formatDiagnosticsVisibleText(value, english);
  const diagnosticsKey = (value: string | null | undefined) =>
    formatDiagnosticsTechnicalKey(value, english);
  const readiness = buildPilotReadinessModel(data, english);
  const diagnosticsSkills = getOperatingSkillsForSurface("diagnostics");
  const meetingEntryStatus =
    data.captureOverview.completedSessions > 0
      ? "ready"
      : data.captureOverview.totalSessions > 0
        ? "watch"
        : "blocked";
  const meetingFollowThroughStatus =
    data.recommendationQuality.actionCreationRate >= 50
      ? "ready"
      : data.recommendationQuality.actionCreationRate >= 25
        ? "watch"
        : "blocked";
  const meetingMemoryStatus =
    data.memoryQuality.goldenSummary.commitmentHitRate >= 60 &&
    data.memoryQuality.goldenSummary.blockerHitRate >= 60
      ? "ready"
      : data.memoryQuality.goldenSummary.commitmentHitRate >= 35 ||
          data.memoryQuality.goldenSummary.blockerHitRate >= 35
        ? "watch"
        : "blocked";
  const meetingBoundaryStatus =
    data.pendingApprovals > 0 || data.recentAuditCount > 0 ? "ready" : "watch";
  const meetingReadyCount = [
    meetingEntryStatus,
    meetingFollowThroughStatus,
    meetingMemoryStatus,
    meetingBoundaryStatus,
  ].filter((status) => status === "ready").length;
  const meetingWorkflowReadiness =
    meetingReadyCount >= 3
      ? {
          status: "ready" as const,
          label: english
            ? "Meeting follow-through readiness"
            : "会议推进就绪度",
          headline: english
            ? "The meeting loop is now showing enough grounded proxy signals to keep expanding inside controlled pilot use."
            : "这条会议主回路已经出现足够多的有依据代理信号，可以继续在受控试点里放大。",
        }
      : meetingReadyCount >= 1
        ? {
            status: "watch" as const,
            label: english
              ? "Meeting follow-through readiness"
              : "会议推进就绪度",
            headline: english
              ? "The meeting loop is visible, but it still needs more stable capture, memory or follow-through signals before it reads as ready to scale."
              : "会议主回路已经可见，但采集、记忆或会后动作信号还需要更稳定，才能读成可放量。",
          }
        : {
            status: "blocked" as const,
            label: english
              ? "Meeting follow-through readiness"
              : "会议推进就绪度",
            headline: english
              ? "The meeting loop still looks too weak at the current proxy level to justify scale-readiness language."
              : "当前代理信号下，这条会议主回路还太弱，不足以支持规模化就绪表述。",
          };
  const meetingWorkflowSignals = [
    {
      id: "input-availability",
      label: english ? "Input availability" : "输入可用性",
      status: meetingEntryStatus,
      summary:
        meetingEntryStatus === "ready"
          ? english
            ? `${data.captureOverview.completedSessions} completed capture sessions already prove that meetings can enter the loop as real operating objects.`
            : `当前已有 ${data.captureOverview.completedSessions} 条完成的会议采集，说明会议已经能作为真实经营对象进入这条回路。`
          : meetingEntryStatus === "watch"
            ? english
              ? `${data.captureOverview.totalSessions} capture sessions exist, but completion still needs to become steadier before this reads as a strong wedge.`
              : `当前已有 ${data.captureOverview.totalSessions} 条会议采集，但完成度还需要更稳定，这条入口才能读成强切口。`
            : english
              ? "No capture-backed meeting entry is visible yet, so the meeting push still lacks a strong live entry signal."
              : "当前还没有采集支撑的会议入口，所以会议推进还缺少强实时入口信号。",
      blocker:
        meetingEntryStatus === "ready"
          ? null
          : english
            ? "Meeting entry is still too weak or too unstable, so users may not read it as a daily operating entrance."
            : "会议入口当前还不够强或不够稳定，用户未必会把它读成日常推进入口。",
      fix:
        meetingEntryStatus === "ready"
          ? null
          : english
            ? "Make the primary meeting entry impossible to miss."
            : "让主会议入口一眼可见。",
    },
    {
      id: "output-generation",
      label: english ? "Output generation coverage" : "输出生成覆盖",
      status: meetingFollowThroughStatus,
      summary:
        meetingFollowThroughStatus === "ready"
          ? english
            ? `${data.recommendationQuality.actionCreationRate}% action creation suggests the system is already turning judgement into executable next steps often enough to keep the loop alive.`
            : `当前动作生成率 ${data.recommendationQuality.actionCreationRate}%，判断已经能较稳定地转成下一步。`
          : meetingFollowThroughStatus === "watch"
            ? english
              ? `${data.recommendationQuality.actionCreationRate}% action creation means the loop is visible, but post-meeting follow-through still needs stronger conversion.`
              : `当前动作生成率 ${data.recommendationQuality.actionCreationRate}%，主回路已可见，但会后跟进还要更稳定。`
            : english
              ? "Action creation is still too weak to describe the meeting loop as scale-ready."
              : "当前动作生成仍然太弱，还不能判断会议回路可放量。",
      blocker:
        meetingFollowThroughStatus === "ready"
          ? null
          : english
            ? "Meeting judgement is still not converting into enough draft or next-step output."
            : "会议判断还没有稳定转成足够多的 draft 或下一步动作。",
      fix:
        meetingFollowThroughStatus === "ready"
          ? null
          : english
            ? "Make the next step read as the default move after a meeting."
            : "让会后下一步读起来像默认动作。",
    },
    {
      id: "governance-coverage",
      label: english ? "Human confirmation" : "人工确认",
      status: meetingBoundaryStatus,
      summary:
        data.pendingApprovals > 0
          ? english
            ? `${data.pendingApprovals} pending approvals keep the trust boundary explicit, so the meeting loop is not drifting into silent execution.`
            : `当前有 ${data.pendingApprovals} 条动作等待人工确认。`
          : english
            ? `${data.recentAuditCount} recent audit events still keep the loop reviewable, even though there is no pending approval pressure right now.`
            : `最近仍有 ${data.recentAuditCount} 条审计事件可回放。`,
      blocker:
        meetingBoundaryStatus === "ready"
          ? null
          : english
            ? "Boundary posture is not visible enough yet, so the loop could still be misread as silent workflow control."
            : "人工确认位置还不够清楚，容易被误读成静默流程。",
      fix:
        meetingBoundaryStatus === "ready"
          ? null
          : english
            ? "Keep the review boundary clear before widening the pilot."
            : "先把人工确认点摆清楚，再扩大试点范围。",
    },
    {
      id: "memory-writeback",
      label: english ? "Memory writeback coverage" : "记忆写回覆盖",
      status: meetingMemoryStatus,
      summary:
        meetingMemoryStatus === "ready"
          ? english
            ? `Commitment hit ${data.memoryQuality.goldenSummary.commitmentHitRate}% and blocker hit ${data.memoryQuality.goldenSummary.blockerHitRate}% show that post-meeting state is increasingly landing in memory instead of staying in notes.`
            : `当前承诺识别 ${data.memoryQuality.goldenSummary.commitmentHitRate}%、卡点识别 ${data.memoryQuality.goldenSummary.blockerHitRate}% ，会后状态已经进入记忆。`
          : meetingMemoryStatus === "watch"
            ? english
              ? "Memory is already carrying part of the meeting state, but commitment/blocker promotion still needs to become more stable."
              : "记忆已经开始承接一部分会议状态，但承诺 / 阻塞的提升还需要更稳定。"
            : english
              ? "Meeting outcomes are not yet promoting into memory strongly enough."
              : "当前会议产出还没有足够稳定地提升进记忆层。",
      blocker:
        meetingMemoryStatus === "ready"
          ? null
          : english
            ? "Meeting outcomes still do not write back into memory clearly enough."
            : "会议产出写回记忆层的清晰度还不够稳定。",
      fix:
        meetingMemoryStatus === "ready"
          ? null
          : english
            ? "Clarify why meeting memory was promoted and which object state changed."
            : "继续把“为什么被提升为会议记忆、改了哪层对象状态”解释得更清楚。",
    },
  ] as const;
  const meetingWorkflowGrade =
    meetingReadyCount >= 3
      ? {
          label: english ? "Ready" : "就绪",
          status: "ready" as const,
        }
      : meetingReadyCount >= 1
        ? {
            label: english ? "Partly-ready" : "部分就绪",
            status: "watch" as const,
          }
        : {
            label: english ? "Not-ready" : "未就绪",
            status: "danger" as const,
          };
  const meetingWorkflowBlockers = meetingWorkflowSignals
    .filter((signal) => signal.blocker)
    .map((signal) => signal.blocker as string)
    .slice(0, 5);
  const meetingWorkflowNextFixes = meetingWorkflowSignals
    .filter((signal) => signal.fix)
    .map((signal) => signal.fix as string)
    .slice(0, 3);
  const meetingMemoryDependency =
    meetingMemoryStatus === "ready"
      ? {
          label: english
            ? "Meeting memory is helping readiness"
            : "会议记忆正在帮助 就绪度",
          summary: english
            ? "The current proxy set says meeting-derived facts, commitments and blockers are already landing clearly enough to make the loop feel reusable."
            : "会议衍生出的事实、承诺和阻塞已经进入记忆层。",
          fix: english
            ? "No dominant memory-clarity fix is visible right now."
            : "当前还没有明显占主导的记忆清晰度窄修项。",
        }
      : meetingMemoryStatus === "watch"
        ? {
            label: english
              ? "Pending-review meeting memory is still lowering readiness"
              : "仍有待复核的会议记忆在拉低 就绪度",
            summary: english
              ? "Part of the meeting output is already writing back, but some items still read as ready-to-promote or pending-review, so the loop is not yet fully self-explanatory."
              : "部分会议产出已经开始写回，但还有一些项目仍更像“可继续提升”或“待复核”，所以这条回路还不够完全自解释。",
            fix: english
              ? "Make promotion versus review-hold reasons easier to read."
              : "把“为什么提升、为什么仍留在复核后面”讲清楚。",
          }
        : {
            label: english
              ? "Meeting memory conflict is blocking readiness"
              : "会议记忆冲突正在阻塞 就绪度",
            summary: english
              ? "The current proxy set still reads meeting memory as too weak or too conflicted, so the workflow cannot yet rely on it as a stable writeback layer."
              : "会议记忆还太弱或冲突太重，暂时不能当成稳定写回层。",
            fix: english
              ? "Do not expand scope yet. First clarify the memory writeback explanation and the review-vs-promoted boundary."
              : "先不要扩范围，先把写回原因和待确认原因说清楚。",
          };
  const copy = {
    openSettings: english ? "Open pilot settings" : "打开试点设置",
    locale: english ? "Locale" : "界面语言",
    retention: english ? "Retention" : "保留策略",
    pendingApprovals: english ? "Pending approvals" : "待复核动作",
    qualityDescription: english
      ? "Recommendation and memory quality baselines decide whether this pilot can safely expand."
      : "判断建议与记忆的黄金样本、执行质量，会决定试点是否可以继续放量。",
    integrationDescription: english
      ? "CRM and identity-binding stability is the main trial-readiness signal for Salesforce / HubSpot customers."
      : "客户关系系统和对象绑定是否已经足够稳定，是 Salesforce / HubSpot 客户试点能否顺滑推进的关键。",
    unnamedCrm: english ? "Unnamed CRM account" : "未命名客户关系系统账号",
    lastSync: english ? "Last sync" : "最近同步",
    noCrmTitle: english
      ? "No CRM source connected yet"
      : "还没有连接任何客户关系系统来源",
    noCrmDescription: english
      ? "Connect HubSpot or Salesforce first so the pilot has enough real operating data."
      : "先连接 HubSpot 或 Salesforce，让试点拥有足够真实的经营数据。",
    llmAsrDescription: english
      ? "Check provider stability, fallback frequency, and which transcript path capture currently depends on."
      : "这里先看智能服务是否稳定、备用路径是否频繁触发，以及采集后的转写文本目前主要来自哪条输入链。",
    llmCalls: english ? "LLM calls" : "智能调用",
    llmFallback: english ? "LLM fallback" : "智能备用路径",
    captureSessions: english ? "Capture sessions" : "采集会话",
    captureConfidence: english ? "Avg capture confidence" : "平均采集置信度",
    llmProviders: english ? "LLM providers" : "智能服务来源",
    transcriptSources: english ? "Transcript sources" : "转写文本来源",
    llmFallbackReasons: english ? "LLM fallback reasons" : "智能备用路径原因",
    captureLanguages: english ? "Capture languages" : "采集语言",
    memoryFacts14d: english ? "Memory facts (14d)" : "记忆事实（14天）",
    memoryCorrections14d: english
      ? "Memory corrections (14d)"
      : "记忆修正（14天）",
    memoryConfirmedActive: english
      ? "Confirmed active facts"
      : "已确认活跃事实",
    memoryExtractionFallback: english
      ? "Memory extraction fallback"
      : "记忆提取备用路径",
    memoryFactTypes: english ? "Memory fact types" : "记忆事实类型",
    memoryLlmWorkload: english ? "Memory LLM workload" : "记忆智能负载",
    noMemoryFactTypes: english ? "No memory facts yet" : "还没有记忆事实",
    noMemoryLlmWorkload: english
      ? "No memory LLM workload yet"
      : "还没有记忆智能负载",
    noLlmTraffic: english ? "No LLM traffic yet" : "还没有智能调用",
    noTranscriptSource: english
      ? "No transcript source yet"
      : "还没有转写文本来源",
    noFallbacks: english ? "No fallback recorded" : "当前没有回退记录",
    noLanguages: english
      ? "No transcript language recorded"
      : "还没有记录转写文本语言",
    jobsDescription: english
      ? "Use recent import jobs and capture failures as operating evidence instead of relying on gut feel."
      : "用最近导入任务和采集失败来判断试点是不是处在“可继续跑”的状态，而不是靠感觉。",
    noImportJobTitle: english ? "No import job yet" : "还没有导入任务",
    noImportJobDescription: english
      ? "Once CRM-first migration runs, this becomes the main operating evidence for the pilot."
      : "当客户关系系统优先迁移开始运行后，这里会成为试点最重要的运营证据之一。",
    recentCaptureFailures: english
      ? "Recent capture failures"
      : "最近的采集失败",
    workspaceControlsTitle: english
      ? "Workspace operational controls"
      : "工作区运营控制",
    workspaceControlsDescription: english
      ? "Flags that decide what the pilot looks like."
      : "决定试点形态的开关。",
    pilotMode: english ? "Pilot mode" : "试点模式",
    consentRequired: english ? "Consent required" : "采集授权要求",
    auditEvents: english ? "Audit events (14d)" : "近 14 天审计事件",
    meetingWorkflowDescription: english
      ? "Start with whether the meeting loop is stable enough to keep piloting."
      : "先看会议回路是否足够稳定，值得继续试点。",
  };
  const memoryLlmWorkloadItems = [
    english
      ? `Extraction · calls ${data.memoryObservability.extractionLlm.totalCalls} · fallback ${data.memoryObservability.extractionLlm.fallbackCount} · avg ${data.memoryObservability.extractionLlm.averageLatencyMs}ms · tokens ${data.memoryObservability.extractionLlm.totalPromptTokens + data.memoryObservability.extractionLlm.totalCompletionTokens}`
      : `提取 · 调用 ${data.memoryObservability.extractionLlm.totalCalls} · 备用路径 ${data.memoryObservability.extractionLlm.fallbackCount} · 平均 ${data.memoryObservability.extractionLlm.averageLatencyMs}ms · 用量 ${data.memoryObservability.extractionLlm.totalPromptTokens + data.memoryObservability.extractionLlm.totalCompletionTokens}`,
    english
      ? `Briefing · calls ${data.memoryObservability.briefingLlm.totalCalls} · fallback ${data.memoryObservability.briefingLlm.fallbackCount} · avg ${data.memoryObservability.briefingLlm.averageLatencyMs}ms · tokens ${data.memoryObservability.briefingLlm.totalPromptTokens + data.memoryObservability.briefingLlm.totalCompletionTokens}`
      : `简报 · 调用 ${data.memoryObservability.briefingLlm.totalCalls} · 备用路径 ${data.memoryObservability.briefingLlm.fallbackCount} · 平均 ${data.memoryObservability.briefingLlm.averageLatencyMs}ms · 用量 ${data.memoryObservability.briefingLlm.totalPromptTokens + data.memoryObservability.briefingLlm.totalCompletionTokens}`,
  ];
  const memoryRetrievalBaselineItems = [
    `${english ? "Selected proxy" : "入选代理信号"} · ${data.memoryObservability.retrievalBaseline.selectedCandidateCount}/${data.memoryObservability.retrievalBaseline.totalCandidateCount} (${data.memoryObservability.retrievalBaseline.selectedRate}%)`,
    `${english ? "Omitted proxy" : "省略代理信号"} · ${data.memoryObservability.retrievalBaseline.omittedCandidateCount} (${data.memoryObservability.retrievalBaseline.omittedRate}%)`,
    `${english ? "Stale suppression candidates" : "过期抑制候选"} · ${data.memoryObservability.retrievalBaseline.staleSuppressionCandidateCount} (${data.memoryObservability.retrievalBaseline.staleSuppressionRate}%)`,
    `${english ? "Duplicate candidates" : "重复候选"} · ${data.memoryObservability.retrievalBaseline.duplicateCandidateCount} (${data.memoryObservability.retrievalBaseline.duplicateRate}%)`,
    `${english ? "Facts per source event" : "每个来源事件事实数"} · ${data.memoryObservability.retrievalBaseline.averageFactsPerSourceEvent}`,
  ];
  const memoryRetrievalSurfaceTraceItems = [
    `${english ? "Surface traces" : "页面检索轨迹"} · ${data.memoryObservability.retrievalSurfaceTrace.traceCount}`,
    `${english ? "Selected by pack" : "检索包入选"} · ${data.memoryObservability.retrievalSurfaceTrace.totals.selectedCount}/${data.memoryObservability.retrievalSurfaceTrace.totals.candidateCount}`,
    `${english ? "Omitted by pack" : "检索包省略"} · ${data.memoryObservability.retrievalSurfaceTrace.totals.omittedCount}`,
    `${english ? "Fallback traces" : "备用路径轨迹"} · ${data.memoryObservability.retrievalSurfaceTrace.totals.fallbackCount}`,
    `${english ? "Stale suppressed by pack" : "检索包过期抑制"} · ${data.memoryObservability.retrievalSurfaceTrace.totals.staleSuppressionCount}`,
    `${english ? "Estimated tokens used" : "估算用量"} · ${data.memoryObservability.retrievalSurfaceTrace.totals.estimatedTokensUsed}`,
  ];
  const memoryRetrievalSurfaceBreakdownItems =
    data.memoryObservability.retrievalSurfaceTrace.surfaceBreakdown.map(
      (item) =>
        english
          ? `${item.surface} · traces ${item.traceCount} · selected ${item.selectedCount} · omitted ${item.omittedCount} · fallback ${item.fallbackCount}`
          : `${diagnosticsKey(item.surface)} · 轨迹 ${item.traceCount} · 入选 ${item.selectedCount} · 省略 ${item.omittedCount} · 备用路径 ${item.fallbackCount}`,
    );
  const memoryRetrievalTraceSourceItems =
    data.memoryObservability.retrievalSurfaceTrace.sourceBreakdown.map(
      (item) => `${diagnosticsKey(item.source)} · ${item.count}`,
    );
  const recentRetrievalTraceItems =
    data.memoryObservability.retrievalSurfaceTrace.recentTraceRefs.map(
      (item) =>
        english
          ? `${item.surface} · ${item.objectType}:${item.objectId} · selected ${item.selectedCount} · omitted ${item.omittedCount}${item.fallbackUsed ? " · fallback" : ""}`
          : `${diagnosticsKey(item.surface)} · ${diagnosticsKey(item.objectType)}:${diagnosticsKey(item.objectId)} · 入选 ${item.selectedCount} · 省略 ${item.omittedCount}${item.fallbackUsed ? " · 备用路径" : ""}`,
    );
  const memoryFallbackReasonItems = [
    ...data.memoryObservability.extractionLlm.fallbackBreakdown.map(
      (item) =>
        `${english ? "Extraction" : "提取"} · ${diagnosticsKey(item.reason)} · ${item.count}`,
    ),
    ...data.memoryObservability.briefingLlm.fallbackBreakdown.map(
      (item) =>
        `${english ? "Briefing" : "简报"} · ${diagnosticsKey(item.reason)} · ${item.count}`,
    ),
  ];
  const memoryWriteFailureReviewItems = [
    `${english ? "Failure events in window" : "窗口内失败事件"} · ${data.memoryObservability.memoryWriteFailureReview.failureEventCount}`,
    `${english ? "Recent sample" : "最近样本"} · ${data.memoryObservability.memoryWriteFailureReview.sampledFailureEventCount}/${data.memoryObservability.memoryWriteFailureReview.sampleLimit}${data.memoryObservability.memoryWriteFailureReview.isSampled ? (english ? " · sampled" : " · 样本") : ""}`,
    `${english ? "Blocked batches in sample" : "样本阻断批次"} · ${data.memoryObservability.memoryWriteFailureReview.blockedBatchCount}`,
    `${english ? "Partial failed batches in sample" : "样本部分失败批次"} · ${data.memoryObservability.memoryWriteFailureReview.partialFailedBatchCount}`,
    `${english ? "Retryable failures" : "可人工重试失败"} · ${data.memoryObservability.memoryWriteFailureReview.retryableFailureCount}`,
    `${english ? "Operator review required" : "需要人工复核"} · ${data.memoryObservability.memoryWriteFailureReview.operatorReviewRequiredCount}`,
    `${english ? "Duplicate suppressions" : "重复抑制"} · ${data.memoryObservability.memoryWriteFailureReview.duplicateSuppressionCount}`,
    `${english ? "Conflict candidates" : "冲突候选"} · ${data.memoryObservability.memoryWriteFailureReview.conflictCandidateCount}`,
  ];
  const memoryWriteFailureClassItems =
    data.memoryObservability.memoryWriteFailureReview.failureClassBreakdown.map(
      (item) => `${diagnosticsKey(item.failureClass)} · ${item.count}`,
    );
  const memoryWriteFailureReasonItems =
    data.memoryObservability.memoryWriteFailureReview.failureReasonBreakdown.map(
      (item) => `${diagnosticsKey(item.reason)} · ${item.count}`,
    );
  const recentMemoryWriteFailureItems =
    data.memoryObservability.memoryWriteFailureReview.recentFailures.map(
      (item) =>
        english
          ? `${dateLabel(item.createdAt)} · ${item.batchStatus} · ${item.targetType}:${item.targetId} · ${item.firstFailureReason ?? "unknown"} · ${item.reviewPosture}`
          : `${formatDateLabel(item.createdAt)} · ${diagnosticsKey(item.batchStatus)} · ${diagnosticsKey(item.targetType)}:${diagnosticsKey(item.targetId)} · ${diagnosticsKey(item.firstFailureReason ?? "unknown")} · ${diagnosticsKey(item.reviewPosture)}`,
    );
  const memoryWriteFailureBoundaryItems = [
    diagnosticsText(
      data.memoryObservability.memoryWriteFailureReview.boundaryNote,
    ),
  ];
  const memoryWriteOperatorQueueItems = [
    `${english ? "Queue items" : "队列项"} · ${data.memoryObservability.memoryWriteFailureReview.operatorQueue.queueItemCount}`,
    `${english ? "Visible items" : "当前展示"} · ${data.memoryObservability.memoryWriteFailureReview.operatorQueue.visibleQueueItemCount}/${data.memoryObservability.memoryWriteFailureReview.operatorQueue.itemLimit}`,
    `${english ? "Omitted by limit" : "因上限省略"} · ${data.memoryObservability.memoryWriteFailureReview.operatorQueue.omittedQueueItemCount}`,
    `${english ? "Has more items" : "仍有未展示项"} · ${data.memoryObservability.memoryWriteFailureReview.operatorQueue.hasMoreItems ? (english ? "yes" : "是") : english ? "no" : "否"}`,
    `${english ? "Manual retry candidates" : "人工确认重试候选"} · ${data.memoryObservability.memoryWriteFailureReview.operatorQueue.retryCandidateCount}`,
    `${english ? "Conflict reviews" : "冲突复核"} · ${data.memoryObservability.memoryWriteFailureReview.operatorQueue.conflictReviewCount}`,
    `${english ? "Source repairs" : "源数据修复"} · ${data.memoryObservability.memoryWriteFailureReview.operatorQueue.sourceRepairCount}`,
    `${english ? "Payload inspections" : "载荷检查"} · ${data.memoryObservability.memoryWriteFailureReview.operatorQueue.payloadReviewCount}`,
  ];
  const recentMemoryWriteOperatorQueueItems =
    data.memoryObservability.memoryWriteFailureReview.operatorQueue.items.map(
      (item) =>
        english
          ? `${dateLabel(item.createdAt)} · ${item.reviewPosture} · ${item.nextAction} · ${item.payloadStatus} · ${item.reason} · ${item.objectType ?? item.targetType}:${item.objectId ?? item.targetId}`
          : `${formatDateLabel(item.createdAt)} · ${diagnosticsKey(item.reviewPosture)} · ${diagnosticsKey(item.nextAction)} · ${diagnosticsKey(item.payloadStatus)} · ${diagnosticsKey(item.reason)} · ${diagnosticsKey(item.objectType ?? item.targetType)}:${diagnosticsKey(item.objectId ?? item.targetId)}`,
    );
  const memoryWriteOperatorQueueBoundaryItems = [
    diagnosticsText(
      data.memoryObservability.memoryWriteFailureReview.operatorQueue
        .boundaryNote,
    ),
  ];
  const memoryWriteRetryContractItems = [
    `${english ? "Contract items" : "约束项"} · ${data.memoryObservability.memoryWriteFailureReview.retryContract.contractItemCount}`,
    `${english ? "Manual confirmation required" : "需要人工确认"} · ${data.memoryObservability.memoryWriteFailureReview.retryContract.manualConfirmationRequiredCount}`,
    `${english ? "Blocked: missing payload" : "阻断：缺重试载荷"} · ${data.memoryObservability.memoryWriteFailureReview.retryContract.blockedMissingPayloadCount}`,
    `${english ? "Blocked: conflict review" : "阻断：冲突复核"} · ${data.memoryObservability.memoryWriteFailureReview.retryContract.blockedConflictReviewCount}`,
    `${english ? "Blocked: non-retryable" : "阻断：不可重试"} · ${data.memoryObservability.memoryWriteFailureReview.retryContract.blockedNonRetryableCount}`,
    `${english ? "Blocked: payload inspection" : "阻断：载荷检查"} · ${data.memoryObservability.memoryWriteFailureReview.retryContract.blockedPayloadInspectionCount}`,
    `${english ? "Automatic execution" : "自动执行"} · ${data.memoryObservability.memoryWriteFailureReview.retryContract.executableAutomaticallyCount}`,
    `${english ? "Attempt limit" : "尝试上限"} · ${data.memoryObservability.memoryWriteFailureReview.retryContract.attemptLimit}`,
    `${english ? "Backoff minutes" : "退避分钟"} · ${data.memoryObservability.memoryWriteFailureReview.retryContract.backoffDelaysMinutes.join(" / ")}`,
  ];
  const recentMemoryWriteRetryContractItems =
    data.memoryObservability.memoryWriteFailureReview.retryContract.items.map(
      (item) =>
        english
          ? `${item.contractStatus} · ${item.retryMode} · ${item.receiptDraft.receiptStatus} · ${item.idempotencyLockKey ?? "missing-lock"} · ${item.requiredManualChecks.join(" / ")}`
          : `${diagnosticsKey(item.contractStatus)} · ${diagnosticsKey(item.retryMode)} · ${diagnosticsKey(item.receiptDraft.receiptStatus)} · ${diagnosticsKey(item.idempotencyLockKey ?? "missing-lock")} · ${item.requiredManualChecks.map(diagnosticsKey).join(" / ")}`,
    );
  const memoryWriteRetryContractBoundaryItems = [
    diagnosticsText(
      data.memoryObservability.memoryWriteFailureReview.retryContract
        .boundaryNote,
    ),
  ];
  const memoryWriteRetryReceiptLedgerItems = [
    `${english ? "Ledger items" : "台账项"} · ${data.memoryObservability.memoryWriteFailureReview.retryReceiptLedger.ledgerItemCount}`,
    `${english ? "Receipt audits" : "凭证审计"} · ${data.memoryObservability.memoryWriteFailureReview.retryReceiptLedger.receiptAuditCount}`,
    `${english ? "Persisted receipts" : "已持久化凭证"} · ${data.memoryObservability.memoryWriteFailureReview.retryReceiptLedger.persistedReceiptCount}`,
    `${english ? "Missing receipts" : "缺凭证"} · ${data.memoryObservability.memoryWriteFailureReview.retryReceiptLedger.missingReceiptCount}`,
    `${english ? "Pending manual confirmation" : "待人工确认"} · ${data.memoryObservability.memoryWriteFailureReview.retryReceiptLedger.pendingManualConfirmationCount}`,
    `${english ? "Confirmed for later executor" : "已确认给后续执行"} · ${data.memoryObservability.memoryWriteFailureReview.retryReceiptLedger.confirmedReadyForExecutorCount}`,
    `${english ? "Owner assigned" : "有负责人"} · ${data.memoryObservability.memoryWriteFailureReview.retryReceiptLedger.ownerAssignedCount}`,
    `${english ? "Owner missing" : "缺负责人"} · ${data.memoryObservability.memoryWriteFailureReview.retryReceiptLedger.ownerMissingCount}`,
    `${english ? "Automatic execution" : "自动执行"} · ${data.memoryObservability.memoryWriteFailureReview.retryReceiptLedger.executableAutomaticallyCount}`,
  ];
  const recentMemoryWriteRetryReceiptLedgerItems =
    data.memoryObservability.memoryWriteFailureReview.retryReceiptLedger.items.map(
      (item) =>
        english
          ? `${item.receiptStatus} · ${item.ownerLabel} · ${item.nextOperatorAction} · ${item.contractStatus} · ${item.idempotencyLockKey ?? "missing-lock"}`
          : `${diagnosticsKey(item.receiptStatus)} · ${diagnosticsText(item.ownerLabel)} · ${diagnosticsKey(item.nextOperatorAction)} · ${diagnosticsKey(item.contractStatus)} · ${diagnosticsKey(item.idempotencyLockKey ?? "missing-lock")}`,
    );
  const memoryWriteRetryReceiptLedgerBoundaryItems = [
    diagnosticsText(
      data.memoryObservability.memoryWriteFailureReview.retryReceiptLedger
        .boundaryNote,
    ),
  ];
  const memoryWriteRetryAttemptLedgerItems = [
    `${english ? "Ledger items" : "台账项"} · ${data.memoryObservability.memoryWriteFailureReview.retryAttemptLedger.ledgerItemCount}`,
    `${english ? "Attempt audits" : "尝试审计"} · ${data.memoryObservability.memoryWriteFailureReview.retryAttemptLedger.attemptAuditCount}`,
    `${english ? "Persisted attempts" : "已持久化尝试"} · ${data.memoryObservability.memoryWriteFailureReview.retryAttemptLedger.persistedAttemptCount}`,
    `${english ? "Unmatched attempts" : "未匹配尝试"} · ${data.memoryObservability.memoryWriteFailureReview.retryAttemptLedger.unmatchedAttemptAuditCount}`,
    `${english ? "Invalid attempt payloads" : "异常尝试载荷"} · ${data.memoryObservability.memoryWriteFailureReview.retryAttemptLedger.invalidAttemptPayloadCount}`,
    `${english ? "Missing receipt locks" : "缺凭证锁"} · ${data.memoryObservability.memoryWriteFailureReview.retryAttemptLedger.missingReceiptLockCount}`,
    `${english ? "Receipt not confirmed" : "凭证未确认"} · ${data.memoryObservability.memoryWriteFailureReview.retryAttemptLedger.receiptNotConfirmedCount}`,
    `${english ? "Source rebuild required" : "需要来源重建"} · ${data.memoryObservability.memoryWriteFailureReview.retryAttemptLedger.sourceRebuildRequiredCount}`,
    `${english ? "Idempotency conflicts" : "幂等冲突"} · ${data.memoryObservability.memoryWriteFailureReview.retryAttemptLedger.idempotencyConflictCount}`,
    `${english ? "Lock available for manual attempt" : "人工尝试锁可记录"} · ${data.memoryObservability.memoryWriteFailureReview.retryAttemptLedger.lockAvailableForManualAttemptCount}`,
    `${english ? "Reserved logical locks" : "已记录逻辑锁"} · ${data.memoryObservability.memoryWriteFailureReview.retryAttemptLedger.reservedLockCount}`,
    `${english ? "Attempt limit reached" : "达到尝试上限"} · ${data.memoryObservability.memoryWriteFailureReview.retryAttemptLedger.attemptLimitReachedCount}`,
    `${english ? "Automatic execution" : "自动执行"} · ${data.memoryObservability.memoryWriteFailureReview.retryAttemptLedger.executableAutomaticallyCount}`,
  ];
  const recentMemoryWriteRetryAttemptLedgerItems =
    data.memoryObservability.memoryWriteFailureReview.retryAttemptLedger.items.map(
      (item) =>
        english
          ? `${item.idempotencyLockStatus} · attempts ${item.attemptCount}/${item.attemptLimit} · next ${item.nextOperatorAction} · gate ${item.sourceRebuildGate.gateStatus} · backoff ${item.nextBackoffDelayMinutes ?? "none"}m`
          : `${diagnosticsKey(item.idempotencyLockStatus)} · 尝试 ${item.attemptCount}/${item.attemptLimit} · 下一步 ${diagnosticsKey(item.nextOperatorAction)} · 门槛 ${diagnosticsKey(item.sourceRebuildGate.gateStatus)} · 退避 ${item.nextBackoffDelayMinutes ?? "无"}m`,
    );
  const memoryWriteRetryAttemptSourceGateItems =
    data.memoryObservability.memoryWriteFailureReview.retryAttemptLedger.items.map(
      (item) =>
        english
          ? `${item.sourceRebuildGate.gateStatus} · ${item.sourceType ?? "missing-source"}:${item.sourceId ?? "missing-source-id"} · missing ${item.sourceRebuildGate.missingInputs.join(" / ") || "none"} · owner ${item.ownerLabel}`
          : `${diagnosticsKey(item.sourceRebuildGate.gateStatus)} · ${diagnosticsKey(item.sourceType ?? "missing-source")}:${diagnosticsKey(item.sourceId ?? "missing-source-id")} · 缺少 ${item.sourceRebuildGate.missingInputs.map(diagnosticsKey).join(" / ") || "无"} · 负责人 ${diagnosticsText(item.ownerLabel)}`,
    );
  const memoryWriteRetryAttemptLedgerBoundaryItems = [
    diagnosticsText(
      data.memoryObservability.memoryWriteFailureReview.retryAttemptLedger
        .boundaryNote,
    ),
  ];
  const diagnosticsGuidanceRecommendations = [
    {
      title:
        meetingEntryStatus === "ready"
          ? english
            ? "Open the live meeting loop before scanning the rest of diagnostics"
            : "先打开活跃会议回路，再看其余诊断项"
          : english
            ? "Strengthen the meeting entry signal first"
            : "先补强会议入口信号",
      body:
        meetingEntryStatus === "ready"
          ? english
            ? `${data.captureOverview.completedSessions} completed capture sessions already prove the loop is live. Use that live loop as the first operating wedge.`
            : `当前已有 ${data.captureOverview.completedSessions} 条完成的会议采集，说明这条回路已经活起来。先把它当成第一条经营切口。`
          : english
            ? "Diagnostics should first answer whether meetings can even enter the loop as real operating objects. Without that, the rest of the page is secondary."
            : "诊断页首先要回答会议是否已经能作为真实经营对象进入回路。没有这条入口，其余区块都应排在后面。",
      href: "/meetings",
      meta:
        meetingWorkflowGrade.label ?? (english ? "Meeting loop" : "会议回路"),
    },
    {
      title:
        meetingFollowThroughStatus === "ready"
          ? english
            ? "Use approvals as the visible follow-through boundary"
            : "把审批当成可见的跟进闭环边界"
          : english
            ? "Repair follow-through inside the review boundary"
            : "先在复核边界内修后续动作",
      body:
        meetingFollowThroughStatus === "ready"
          ? english
            ? "Action creation is already visible. Keep the loop honest by reading stronger moves through review instead of treating them like silent automation."
            : "动作生成已经可见。继续让更强动作通过复核显性流动，不要把它误读成静默自动化。"
          : english
            ? "The meeting loop still needs stronger action conversion. Narrow the next fix inside review rather than widening scope."
            : "会议回路仍需更强的动作转化。先在复核内收窄下一步修正，不要急着扩大范围。",
      href: "/approvals#meeting-follow-through-review",
      meta: english ? "Review-first boundary" : "先复核边界",
    },
    data.identityReviewCount > 0 ||
    (data.crmSources.length === 0 && data.importJobs.length === 0)
      ? {
          title: english
            ? "Clear CRM and identity binding debt before widening the pilot"
            : "先清客户关系系统与身份绑定债，再扩大试点",
          body: english
            ? `There are ${data.identityReviewCount} identity-review items and ${data.crmSources.length} connected CRM sources visible. Fix the binding debt before reading the pilot as more stable than it is.`
            : `当前可见 ${data.identityReviewCount} 条身份复核项，以及 ${data.crmSources.length} 个已连接客户关系系统来源。先清绑定债，再把试点读成更稳定的系统。`,
          href: "/imports/crm",
          meta: english ? "Ingress / identity debt" : "接入 / 身份债",
        }
      : {
          title: english
            ? "Keep memory writeback visible while readiness rises"
            : "在就绪判断抬升时保持记忆写回可见",
          body: english
            ? "Meeting memory is already influencing readiness. Keep that writeback layer readable before you widen pilot messaging."
            : "会议记忆已经在影响就绪判断。先保持这层写回可读，再扩大试点口径。",
          href: "/memory?dimension=MEETING",
          meta: meetingMemoryDependency.label,
        },
  ];
  const diagnosticsGuidanceReminders = [
    {
      title: english ? "Current readiness grade" : "当前就绪等级",
      body: diagnosticsText(meetingWorkflowReadiness.headline),
      meta: diagnosticsText(meetingWorkflowGrade.label),
    },
    {
      title: english ? "Top blocker" : "当前主要阻塞",
      body:
        meetingWorkflowBlockers[0] ??
        (english
          ? "No dominant blocker is visible in the current proxy set."
          : "当前代理信号里还没有出现主导性阻塞。"),
      meta:
        meetingWorkflowNextFixes[0] ??
        (english ? "No dominant next fix" : "当前没有主导性修正项"),
    },
    {
      title: english ? "Boundary posture" : "当前边界姿态",
      body:
        data.pendingApprovals > 0
          ? english
            ? `${data.pendingApprovals} pending approvals are still keeping stronger moves inside review-first posture.`
            : `当前有 ${data.pendingApprovals} 条待复核动作，说明更强动作仍保持在先复核姿态内。`
          : english
            ? `${data.recentAuditCount} recent audit events keep the loop reviewable even without pending approval pressure.`
            : `当前虽没有待复核压力，但最近的 ${data.recentAuditCount} 条审计事件仍让这条回路保持可复盘。`,
      meta: english ? "Controlled trial" : "受控试点",
    },
  ];
  const businessLoopGapReadout = buildBusinessLoopGapReadout({
    english,
    businessLoopGapSummary,
  });
  const firstLoopAdoptionReadout = buildFirstLoopAdoptionReadout({
    adoption: data.firstLoopAdoption,
    english,
  });
  const diagnosticsFirstLoopModel = buildDiagnosticsFirstLoopDisplayModel(
    firstLoopModel,
    english,
  );
  const _diagnosticsOperatingSnapshot = {
    objectState: english
      ? `${meetingWorkflowGrade.label} · ${data.captureOverview.completedSessions} completed capture sessions · ${data.pendingApprovals} pending approvals`
      : `${meetingWorkflowGrade.label} · ${data.captureOverview.completedSessions} 条已完成采集 · ${data.pendingApprovals} 条待复核动作`,
    blocker: diagnosticsText(
      businessLoopGapReadout.blocker
        ? businessLoopGapReadout.blocker
        : (meetingWorkflowBlockers[0] ??
            (english
              ? "No dominant blocker is visible in the current proxy set."
              : "当前代理信号里还没有出现主导性阻塞项。")),
    ),
    pendingDecision: diagnosticsText(
      businessLoopGapReadout.pendingDecision ??
        diagnosticsGuidanceRecommendations[0]?.title ??
        (english
          ? "Decide whether the meeting loop is strong enough to keep piloting."
          : "判断会议主回路是否已经足够稳定，值得继续试点。"),
    ),
    nextAction: diagnosticsText(
      businessLoopGapReadout.nextAction ??
        meetingWorkflowNextFixes[0] ??
        (english
          ? "Open the meeting loop and review the current follow-through boundary."
          : "打开会议主回路，先看当前后续动作。"),
    ),
  };
  const diagnosticsOperatingConnectionsRaw: Array<
    DiagnosticsOperatingConnection | undefined
  > = [
    businessLoopGapReadout.connection,
    {
      label: english ? "First-loop proof" : "首轮闭环证明",
      value: diagnosticsText(firstLoopAdoptionReadout.connectionValue),
      description: diagnosticsText(
        `${firstLoopAdoptionReadout.summary} ${english ? `Current next action: ${diagnosticsFirstLoopModel.primaryAction.label}.` : `当前下一步：${diagnosticsFirstLoopModel.primaryAction.label}。`}`,
      ),
      href: diagnosticsFirstLoopModel.primaryAction.href,
    },
    {
      label: english ? "Meeting loop" : "会议主回路",
      value: diagnosticsText(meetingWorkflowReadiness.label),
      description: diagnosticsText(meetingWorkflowReadiness.headline),
      href: "/meetings",
    },
    {
      label: english ? "Human confirmation" : "人工确认",
      value: english
        ? `${data.pendingApprovals} pending approvals`
        : `${data.pendingApprovals} 条待复核动作`,
      description: diagnosticsText(
        diagnosticsGuidanceReminders[2]?.body ??
          (english
            ? "Review-first posture is still active."
            : "先复核状态仍然有效。"),
      ),
      href: "/approvals#meeting-follow-through-review",
    },
    {
      label: english ? "Meeting memory" : "会议记忆",
      value: diagnosticsText(meetingMemoryDependency.label),
      description: diagnosticsText(meetingMemoryDependency.summary),
      href: "/memory?dimension=MEETING",
    },
    {
      label: english ? "Ingress debt" : "接入债",
      value: english
        ? `${data.identityReviewCount} identity reviews`
        : `${data.identityReviewCount} 条身份复核`,
      description: diagnosticsText(
        english
          ? `${data.crmSources.length} connected CRM sources still shape readiness posture.`
          : `${data.crmSources.length} 个已连接客户关系系统来源仍在影响就绪姿态。`,
      ),
      href: "/imports/crm",
    },
  ];
  const _diagnosticsOperatingConnections = diagnosticsOperatingConnectionsRaw
    .filter((item): item is DiagnosticsOperatingConnection => Boolean(item))
    .map((item) => ({
      ...item,
      label: diagnosticsText(item.label),
      value: diagnosticsText(item.value),
      description: diagnosticsText(item.description),
    }));
  const diagnosticsAssetFocusItems = [
    {
      label: english ? "Object state" : "对象状态",
      value: _diagnosticsOperatingSnapshot.objectState,
      detail: diagnosticsText(meetingWorkflowReadiness.headline),
      href: "/meetings",
      tone:
        meetingWorkflowGrade.status === "ready"
          ? "success"
          : meetingWorkflowGrade.status === "watch"
            ? "warning"
            : "danger",
    },
    {
      label: english ? "Blocker" : "阻塞",
      value: _diagnosticsOperatingSnapshot.blocker,
      detail: english
        ? "Clear this before reading lower-level checks."
        : "先处理这一条，再读下层检查。",
      href: businessLoopGapReadout.connection?.href,
      tone: businessLoopGapReadout.blocker ? "warning" : "success",
    },
    {
      label: english ? "Pending decision" : "待决策",
      value: _diagnosticsOperatingSnapshot.pendingDecision,
      detail: diagnosticsText(firstLoopAdoptionReadout.nextAttention),
      href: diagnosticsFirstLoopModel.primaryAction.href,
      tone: "warning",
    },
    {
      label: english ? "Next action" : "下一步动作",
      value: _diagnosticsOperatingSnapshot.nextAction,
      detail: english
        ? `${data.pendingApprovals} review item(s) still require human confirmation.`
        : `${data.pendingApprovals} 条事项仍需要人工确认。`,
      href:
        data.pendingApprovals > 0
          ? "/approvals#meeting-follow-through-review"
          : diagnosticsFirstLoopModel.primaryAction.href,
      tone: "info",
    },
  ] as const;
  const _visibleDiagnosticsGuidanceRecommendations =
    diagnosticsGuidanceRecommendations.map((item) => ({
      ...item,
      title: diagnosticsText(item.title),
      body: diagnosticsText(item.body),
      meta: diagnosticsText(item.meta),
    }));
  const _visibleDiagnosticsGuidanceReminders = diagnosticsGuidanceReminders.map(
    (item) => ({
      ...item,
      title: diagnosticsText(item.title),
      body: diagnosticsText(item.body),
      meta: diagnosticsText(item.meta),
    }),
  );

  return (
    <div className="workspace-surface-stack">
      <PageHeader
        eyebrow={messages.diagnostics.eyebrow}
        title={messages.diagnostics.title}
        description={messages.diagnostics.description}
        actions={
          <>
            <Button variant="secondary" asChild>
              <Link href="/settings?tab=pilot">{copy.openSettings}</Link>
            </Button>
            <Button asChild>
              <Link href="/imports/crm">{messages.crm.firstImport}</Link>
            </Button>
          </>
        }
      />

      <CustomerAssetFocusStrip
        eyebrow={english ? "Readiness asset" : "就绪资产"}
        title={
          english
            ? "Start with whether the customer loop can move today."
            : "先判断客户回路今天能不能继续动。"
        }
        summary={
          english
            ? "The useful readout is the strongest business blocker, the waiting decision, and the next route."
            : "有效读数是最强经营阻塞、待判断事项和下一步路径。"
        }
        items={[...diagnosticsAssetFocusItems]}
        primaryAction={{
          label: english ? "Open next check" : "打开下一项",
          href: diagnosticsFirstLoopModel.primaryAction.href,
        }}
        secondaryAction={{
          label: english ? "Open pending review" : "打开待复核",
          href: "/approvals#meeting-follow-through-review",
        }}
      />

      <LazyDisclosure title={english ? "Reference: meeting loop readiness" : "引用：会议回路就绪度"}>
        <Card id="meeting-workflow-readiness" className="workspace-panel">
          <CardHeader>
            <CardTitle>
              {english ? "Meeting Workflow Readiness" : "会议协同回路就绪度"}
            </CardTitle>
            <CardDescription>{copy.meetingWorkflowDescription}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[1.02fr_0.98fr]">
            <div className="theme-surface-panel rounded-2xl px-5 py-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={
                    meetingWorkflowGrade.status === "ready"
                      ? "success"
                      : meetingWorkflowGrade.status === "watch"
                        ? "warning"
                        : "danger"
                  }
                >
                  {meetingWorkflowGrade.label}
                </Badge>
                <Badge variant="approval">
                  {english ? "Meeting loop only" : "只看会议回路"}
                </Badge>
              </div>
              <p className="mt-3 text-lg font-semibold text-[color:var(--foreground)]">
                {diagnosticsText(meetingWorkflowReadiness.headline)}
              </p>
              <details className="mt-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2">
                <summary className="cursor-pointer list-none text-xs font-semibold text-[color:var(--muted)] marker:content-none [&::-webkit-details-marker]:hidden">
                  {english ? "Judgement scope" : "判断口径"}
                </summary>
                <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                  {english
                    ? "This card only judges whether the meeting to follow-through to memory to boundary loop is stable enough to keep piloting. It does not imply send authority, workflow control or whole-system readiness."
                    : "这张卡只判断会议、后续动作和记忆回流是否足够稳定。"}
                </p>
              </details>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" asChild>
                  <Link href="/meetings">
                    {english ? "Open meeting loop" : "打开会议与推进"}
                  </Link>
                </Button>
                <Button size="sm" variant="secondary" asChild>
                  <Link href="/approvals#meeting-follow-through-review">
                    {english ? "Open pending checks" : "查看待确认动作"}
                  </Link>
                </Button>
                <Button size="sm" variant="secondary" asChild>
                  <Link href="/memory?dimension=MEETING">
                    {english ? "Open meeting memory" : "查看经营记忆"}
                  </Link>
                </Button>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="theme-surface-panel rounded-2xl px-4 py-4">
                <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                  {english ? "Top blockers" : "当前主要阻塞"}
                </p>
                <div className="mt-3 space-y-2">
                  {meetingWorkflowBlockers.length ? (
                    meetingWorkflowBlockers.map((blocker) => (
                      <p
                        key={blocker}
                        className="text-sm leading-6 text-[color:var(--muted)]"
                      >
                        {diagnosticsText(blocker)}
                      </p>
                    ))
                  ) : (
                    <p className="text-sm leading-6 text-[color:var(--muted)]">
                      {english
                        ? "No dominant blocker is visible in the current proxy set."
                        : "当前代理信号里还没有出现主导性阻塞项。"}
                    </p>
                  )}
                </div>
              </div>
              <div className="theme-surface-panel rounded-2xl px-4 py-4">
                <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                  {english
                    ? "Suggested next narrow fixes"
                    : "下一步措辞 / 层级 / 清晰度修正"}
                </p>
                <div className="mt-3 space-y-2">
                  {meetingWorkflowNextFixes.length ? (
                    meetingWorkflowNextFixes.map((fix) => (
                      <p key={fix} className="text-sm leading-6 text-[color:var(--muted)]">
                        {diagnosticsText(fix)}
                      </p>
                    ))
                  ) : (
                    <p className="text-sm leading-6 text-[color:var(--muted)]">
                      {english
                        ? "No wording / hierarchy / clarity fix is currently dominant at the proxy level."
                        : "当前代理信号下，还没有明显占主导的措辞 / 层级 / 清晰度修正项。"}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="theme-surface-panel-soft rounded-2xl px-4 py-4">
            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
              {english
                ? "Meeting memory readiness dependency"
                : "会议记忆对就绪判断的影响"}
            </p>
            <p className="mt-2 text-sm font-medium leading-6 text-[color:var(--foreground)]">
              {diagnosticsText(meetingMemoryDependency.label)}
            </p>
            <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
              {diagnosticsText(meetingMemoryDependency.summary)}
            </p>
            <p className="mt-2 text-sm leading-6 text-[color:var(--muted-foreground)]">
              {diagnosticsText(meetingMemoryDependency.fix)}
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {meetingWorkflowSignals.map((signal) => (
              <WorkflowGate
                key={signal.id}
                label={diagnosticsText(signal.label)}
                status={signal.status}
                summary={diagnosticsText(signal.summary)}
                english={english}
              />
            ))}
          </div>
          </CardContent>
        </Card>
      </LazyDisclosure>

      <LazyDisclosure title={english ? "Reference: pilot readiness judgement" : "引用：试点就绪判断"}>
        <Card className="workspace-panel">
          <CardHeader>
            <CardTitle>
              {english ? "Pilot readiness judgement" : "试点就绪判断"}
            </CardTitle>
            <CardDescription>
              {diagnosticsText(readiness.summary)}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="theme-surface-panel rounded-2xl px-5 py-5">
            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
              {english ? "Current stage" : "当前阶段"}
            </p>
            <p className="mt-2 text-3xl font-semibold text-[color:var(--foreground)]">
              {readiness.score}
            </p>
            <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
              {diagnosticsText(readiness.headline)}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {readiness.recommendedSkillIds.map((skillId) => (
                <Badge key={skillId} variant="info">
                  {diagnosticsText(
                    getOperatingSkillById(skillId)?.name ?? skillId,
                  )}
                </Badge>
              ))}
            </div>
          </div>
          <div className="grid gap-3">
            {readiness.gates.map((gate) => (
              <div
                key={gate.id}
                className="theme-surface-panel rounded-2xl px-4 py-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-[color:var(--foreground)]">
                    {diagnosticsText(gate.label)}
                  </p>
                  <Badge
                    variant={
                      gate.status === "ready"
                        ? "success"
                        : gate.status === "watch"
                          ? "warning"
                          : "danger"
                    }
                  >
                    {gate.status === "ready"
                      ? english
                        ? "Ready"
                        : "就绪"
                      : gate.status === "watch"
                        ? english
                          ? "Watch"
                          : "观察"
                        : english
                          ? "Blocked"
                          : "阻塞"}
                  </Badge>
                </div>
                <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                  {diagnosticsText(gate.summary)}
                </p>
              </div>
            ))}
          </div>
          </CardContent>
        </Card>
      </LazyDisclosure>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Metric
          label={english ? "First-loop progress" : "首轮闭环进度"}
          value={`${firstLoopModel.completedCount}/${firstLoopModel.totalCount}`}
        />
        <Metric
          label={messages.diagnostics.readiness}
          value={data.workspace.pilotMode ? "ON" : "OFF"}
        />
        <Metric label={copy.locale} value={data.workspace.locale} />
        <Metric
          label={copy.retention}
          value={`${data.workspace.dataRetentionDays}d`}
        />
        <Metric
          label={copy.pendingApprovals}
          value={String(data.pendingApprovals)}
        />
        <Metric
          label={english ? "Return anchor" : "回访点"}
          value={
            firstLoopModel.hasExplicitAnchor
              ? english
                ? "Saved"
                : "已保存"
              : english
                ? "Current"
                : "当前"
          }
        />
        <Metric
          label={english ? "Next action" : "下一步"}
          value={
            firstLoopModel.primaryAction.stepId === "anchor"
              ? english
                ? "Resume"
                : "回访"
              : firstLoopModel.primaryAction.stepId === "review"
                ? english
                  ? "Review"
                  : "复核"
                : firstLoopModel.primaryAction.stepId === "write-back"
                  ? english
                    ? "Write-back"
                    : "写回"
                  : english
                    ? "Action"
                    : "行动"
          }
        />
      </div>

      <Card className="workspace-panel">
        <CardHeader>
          <CardTitle>
            {english
              ? "First-loop activation / proof readout"
              : "首轮闭环启用证明"}
          </CardTitle>
          <CardDescription>
            {english
              ? "Keep one support-only readout for where the workspace is getting stuck: handoff, review, or write-back."
              : "保留一条仅供判断的读数，直接回答工作区现在卡在交接、复核还是写回。"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={getAdoptionReadoutVariant(
                firstLoopAdoptionReadout.status,
              )}
            >
              {diagnosticsText(firstLoopAdoptionReadout.stageLabel)}
            </Badge>
            <Badge variant="neutral">
              {english
                ? `${firstLoopModel.completedCount}/${firstLoopModel.totalCount} checkpoints in the modeled loop`
                : `${firstLoopModel.completedCount}/${firstLoopModel.totalCount} 个建模检查点`}
            </Badge>
          </div>
          <div className="space-y-2">
            <p className="text-base font-semibold text-[color:var(--foreground)]">
              {diagnosticsText(firstLoopAdoptionReadout.title)}
            </p>
            <p className="text-sm leading-6 text-[color:var(--muted)]">
              {diagnosticsText(firstLoopAdoptionReadout.summary)}
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="theme-surface-panel rounded-2xl px-4 py-4">
              <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                {english ? "Current user" : "当前用户"}
              </p>
              <p className="mt-2 text-sm leading-6 text-[color:var(--foreground)]">
                {diagnosticsText(firstLoopAdoptionReadout.currentUserLine)}
              </p>
            </div>
            <div className="theme-surface-panel rounded-2xl px-4 py-4">
              <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                {english ? "Workspace trace" : "工作区轨迹"}
              </p>
              <p className="mt-2 text-sm leading-6 text-[color:var(--foreground)]">
                {diagnosticsText(firstLoopAdoptionReadout.workspaceLine)}
              </p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="theme-surface-panel rounded-2xl px-4 py-4">
              <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                {english ? "Next attention" : "下一步先看"}
              </p>
              <p className="mt-2 text-sm leading-6 text-[color:var(--foreground)]">
                {diagnosticsText(firstLoopAdoptionReadout.nextAttention)}
              </p>
            </div>
            <div className="theme-surface-panel rounded-2xl px-4 py-4">
              <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                {english ? "Boundary" : "边界"}
              </p>
              <p className="mt-2 text-sm leading-6 text-[color:var(--foreground)]">
                {diagnosticsText(firstLoopAdoptionReadout.proofNote)}
              </p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Metric
              label={english ? "Handoff entries" : "交接进入"}
              value={String(data.firstLoopAdoption.handoffEnteredCount)}
            />
            <Metric
              label={english ? "Action opens / resumes" : "动作打开 / 回访"}
              value={String(
                data.firstLoopAdoption.primaryActionOpenedCount +
                  data.firstLoopAdoption.anchorResumedCount,
              )}
            />
            <Metric
              label={english ? "Review completions" : "复核完成"}
              value={String(data.firstLoopAdoption.reviewCompletedCount)}
            />
            <Metric
              label={english ? "Write-back confirmations" : "写回确认"}
              value={String(data.firstLoopAdoption.writeBackConfirmedCount)}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="workspace-panel">
        <CardHeader>
          <CardTitle>
            {english
              ? "Detailed first-loop adoption trace"
              : "详细首轮闭环采纳轨迹"}
          </CardTitle>
          <CardDescription>
            {english
              ? "Keep the full handoff, action, anchor, review, and write-back counts visible here when you need deeper replay."
              : "当你需要更深的回放时，再回到这里查看完整的交接、动作、锚点、复核和写回计数。"}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <Metric
            label={english ? "Handoff entries" : "交接进入"}
            value={String(data.firstLoopAdoption.handoffEnteredCount)}
          />
          <Metric
            label={english ? "Primary action opens" : "主动作打开"}
            value={String(data.firstLoopAdoption.primaryActionOpenedCount)}
          />
          <Metric
            label={english ? "Anchor saves" : "锚点保存"}
            value={String(data.firstLoopAdoption.anchorSavedCount)}
          />
          <Metric
            label={english ? "Anchor resumes" : "锚点回访"}
            value={String(data.firstLoopAdoption.anchorResumedCount)}
          />
          <Metric
            label={english ? "Review completions" : "复核完成"}
            value={String(data.firstLoopAdoption.reviewCompletedCount)}
          />
          <Metric
            label={english ? "Write-back confirmations" : "写回确认"}
            value={String(data.firstLoopAdoption.writeBackConfirmedCount)}
          />
        </CardContent>
      </Card>

      <Card className="workspace-panel">
        <CardHeader>
          <CardTitle>
            {english ? "First-loop adoption by user" : "按用户看首轮闭环采纳"}
          </CardTitle>
          <CardDescription>
            {english
              ? "Use this to separate who only entered the handoff, who opened the first action, who finished review, and who really closed the loop through memory write-back."
              : "用这张卡区分谁只进入了交接、谁打开了第一动作、谁完成了复核，以及谁真的走到了记忆写回。"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.firstLoopAdoption.byUser.length ? (
            data.firstLoopAdoption.byUser.map((item) => (
              <div
                key={item.userId}
                className="theme-surface-panel rounded-2xl px-4 py-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-[color:var(--foreground)]">{item.actor}</p>
                      {item.isCurrentUser ? (
                        <Badge variant="info">
                          {english ? "You" : "当前用户"}
                        </Badge>
                      ) : null}
                      <Badge variant={getAdoptionPostureVariant(item.posture)}>
                        {getAdoptionPostureLabel(item.posture, english)}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
                      {english
                        ? `Last touched ${dateLabel(item.lastTouchedAt)}`
                        : `最近一次动作：${formatDateLabel(item.lastTouchedAt)}`}
                    </p>
                  </div>
                  <Badge variant="neutral">
                    {english
                      ? `${item.totalCount} traces`
                      : `${item.totalCount} 条轨迹`}
                  </Badge>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                  <Metric
                    label={english ? "Handoffs" : "交接"}
                    value={String(item.handoffEnteredCount)}
                  />
                  <Metric
                    label={english ? "Action opens" : "动作打开"}
                    value={String(item.primaryActionOpenedCount)}
                  />
                  <Metric
                    label={english ? "Anchor saves" : "锚点保存"}
                    value={String(item.anchorSavedCount)}
                  />
                  <Metric
                    label={english ? "Anchor resumes" : "锚点回访"}
                    value={String(item.anchorResumedCount)}
                  />
                  <Metric
                    label={english ? "Reviews" : "复核完成"}
                    value={String(item.reviewCompletedCount)}
                  />
                  <Metric
                    label={english ? "Write-backs" : "写回确认"}
                    value={String(item.writeBackConfirmedCount)}
                  />
                </div>
              </div>
            ))
          ) : (
            <EmptyState
              title={
                english
                  ? "No per-user first-loop trace yet"
                  : "还没有按用户聚合的首轮闭环轨迹"
              }
              description={
                english
                  ? "Once users enter the setup handoff, open the first action, and save or resume anchors, the adoption trail will show up here."
                  : "当用户进入设置交接、打开第一动作，并保存或回访点后，这里会自动出现采纳轨迹。"
              }
            />
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{messages.diagnostics.quality}</CardTitle>
            <CardDescription>{copy.qualityDescription}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Metric
              label={english ? "Recommendation golden" : "判断建议黄金样本"}
              value={`${data.recommendationQuality.goldenSummary.passRate}%`}
            />
            <Metric
              label={english ? "Recommendation accept" : "判断建议采纳"}
              value={`${data.recommendationQuality.acceptanceRate}%`}
            />
            <Metric
              label={english ? "Recommendation action" : "判断建议转动作"}
              value={`${data.recommendationQuality.actionCreationRate}%`}
            />
            <Metric
              label={english ? "Edited approval" : "复核后调整"}
              value={`${data.recommendationQuality.editedApprovalRate}%`}
            />
            <Metric
              label={english ? "Memory golden" : "记忆黄金样本"}
              value={`${data.memoryQuality.goldenSummary.passRate}%`}
            />
            <Metric
              label={english ? "Memory fact hit" : "记忆事实命中"}
              value={`${data.memoryQuality.goldenSummary.factHitRate}%`}
            />
            <Metric
              label={english ? "Commitment hit" : "承诺命中"}
              value={`${data.memoryQuality.goldenSummary.commitmentHitRate}%`}
            />
            <Metric
              label={english ? "Blocker hit" : "卡点识别"}
              value={`${data.memoryQuality.goldenSummary.blockerHitRate}%`}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{messages.diagnostics.integrations}</CardTitle>
            <CardDescription>{copy.integrationDescription}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-4 md:grid-cols-2">
              <Metric
                label={english ? "Connected CRM" : "已连接客户关系系统"}
                value={String(data.crmSources.length)}
              />
              <Metric
                label={english ? "Needs review" : "需要复核"}
                value={String(data.identityReviewCount)}
              />
            </div>
            {data.crmSources.length ? (
              data.crmSources.map((source) => (
                <div
                  key={source.id}
                  className="theme-surface-panel rounded-2xl px-4 py-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-[color:var(--foreground)]">
                        {diagnosticsKey(source.sourceType)}
                      </p>
                      <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
                        {source.externalAccountLabel ?? copy.unnamedCrm}
                      </p>
                    </div>
                    <Badge
                      variant={
                        source.status === "CONNECTED"
                          ? "success"
                          : source.status === "ERROR"
                            ? "danger"
                            : "warning"
                      }
                    >
                      {diagnosticsKey(source.status)}
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs text-[color:var(--muted-foreground)]">
                    {copy.lastSync} {dateLabel(source.lastSyncedAt)}
                  </p>
                </div>
              ))
            ) : (
              <EmptyState
                title={copy.noCrmTitle}
                description={copy.noCrmDescription}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{messages.diagnostics.llmAsr}</CardTitle>
            <CardDescription>{copy.llmAsrDescription}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Metric
                label={copy.llmCalls}
                value={String(data.llmOverview.totalCalls)}
              />
              <Metric
                label={copy.llmFallback}
                value={String(data.llmOverview.fallbackCount)}
              />
              <Metric
                label={copy.captureSessions}
                value={String(data.captureOverview.totalSessions)}
              />
              <Metric
                label={copy.captureConfidence}
                value={`${data.captureOverview.averageConfidence}`}
              />
              <Metric
                label={copy.memoryFacts14d}
                value={String(data.memoryObservability.factsCreatedCount)}
              />
              <Metric
                label={copy.memoryCorrections14d}
                value={String(data.memoryObservability.correctionsCount)}
              />
              <Metric
                label={copy.memoryConfirmedActive}
                value={`${data.memoryObservability.confirmedActiveFactsCount}/${data.memoryObservability.activeFactsCount} (${data.memoryObservability.confirmationRate}%)`}
              />
              <Metric
                label={copy.memoryExtractionFallback}
                value={String(
                  data.memoryObservability.extractionLlm.fallbackCount,
                )}
              />
              <Metric
                label={english ? "Memory selected proxy" : "记忆入选代理信号"}
                value={`${data.memoryObservability.retrievalBaseline.selectedCandidateCount}/${data.memoryObservability.retrievalBaseline.totalCandidateCount}`}
              />
              <Metric
                label={english ? "Stale suppressed proxy" : "过期抑制代理信号"}
                value={String(
                  data.memoryObservability.retrievalBaseline
                    .staleSuppressionCandidateCount,
                )}
              />
              <Metric
                label={english ? "Duplicate memory proxy" : "重复记忆代理信号"}
                value={String(
                  data.memoryObservability.retrievalBaseline
                    .duplicateCandidateCount,
                )}
              />
              <Metric
                label={english ? "Facts / source event" : "每来源事件事实数"}
                value={String(
                  data.memoryObservability.retrievalBaseline
                    .averageFactsPerSourceEvent,
                )}
              />
              <Metric
                label={english ? "Surface pack traces" : "页面检索包轨迹"}
                value={String(
                  data.memoryObservability.retrievalSurfaceTrace.traceCount,
                )}
              />
              <Metric
                label={
                  english ? "Pack selected / omitted" : "检索包入选 / 省略"
                }
                value={`${data.memoryObservability.retrievalSurfaceTrace.totals.selectedCount}/${data.memoryObservability.retrievalSurfaceTrace.totals.omittedCount}`}
              />
              <Metric
                label={english ? "Pack fallback traces" : "检索包备用路径轨迹"}
                value={String(
                  data.memoryObservability.retrievalSurfaceTrace.totals
                    .fallbackCount,
                )}
              />
              <Metric
                label={english ? "Fact write failures" : "事实写入失败事件"}
                value={String(
                  data.memoryObservability.memoryWriteFailureReview
                    .failureEventCount,
                )}
              />
              <Metric
                label={english ? "Blocked write batches" : "样本阻断写入批次"}
                value={String(
                  data.memoryObservability.memoryWriteFailureReview
                    .blockedBatchCount,
                )}
              />
              <Metric
                label={english ? "Manual retry candidates" : "人工重试候选"}
                value={String(
                  data.memoryObservability.memoryWriteFailureReview
                    .retryableFailureCount,
                )}
              />
              <Metric
                label={english ? "Operator review writes" : "人工复核写入"}
                value={String(
                  data.memoryObservability.memoryWriteFailureReview
                    .operatorReviewRequiredCount,
                )}
              />
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              <Block
                title={copy.llmProviders}
                items={data.llmOverview.providerBreakdown.map(
                  (item) =>
                    `${diagnosticsKey(item.providerModel)} · ${item.count}`,
                )}
                empty={copy.noLlmTraffic}
              />
              <Block
                title={copy.transcriptSources}
                items={data.captureOverview.transcriptSourceBreakdown.map(
                  (item) =>
                    `${diagnosticsKey(item.sourceType)} · ${item.count}`,
                )}
                empty={copy.noTranscriptSource}
              />
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              <Block
                title={copy.llmFallbackReasons}
                items={data.llmOverview.fallbackBreakdown.map(
                  (item) => `${diagnosticsKey(item.reason)} · ${item.count}`,
                )}
                empty={copy.noFallbacks}
              />
              <Block
                title={copy.captureLanguages}
                items={data.captureOverview.languageBreakdown.map(
                  (item) => `${diagnosticsKey(item.language)} · ${item.count}`,
                )}
                empty={copy.noLanguages}
              />
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              <Block
                title={copy.memoryFactTypes}
                items={data.memoryObservability.factTypeBreakdown.map(
                  (item) => `${diagnosticsKey(item.factType)} · ${item.count}`,
                )}
                empty={copy.noMemoryFactTypes}
              />
              <Block
                title={copy.memoryLlmWorkload}
                items={memoryLlmWorkloadItems}
                empty={copy.noMemoryLlmWorkload}
              />
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              <Block
                title={
                  english
                    ? "Memory retrieval baseline proxy"
                    : "记忆检索基线代理信号"
                }
                items={memoryRetrievalBaselineItems}
                empty={
                  english
                    ? "No memory retrieval baseline yet"
                    : "还没有记忆检索基线"
                }
              />
              <Block
                title={
                  english
                    ? "Memory retrieval surface trace"
                    : "记忆检索页面轨迹"
                }
                items={memoryRetrievalSurfaceTraceItems}
                empty={
                  english
                    ? "No surface retrieval trace yet"
                    : "还没有页面检索轨迹"
                }
              />
            </div>
            <div className="grid gap-4 xl:grid-cols-3">
              <Block
                title={
                  english ? "Pack trace by surface" : "按页面汇总检索包轨迹"
                }
                items={memoryRetrievalSurfaceBreakdownItems}
                empty={
                  english ? "No surface pack trace yet" : "还没有页面检索包轨迹"
                }
              />
              <Block
                title={english ? "Pack trace sources" : "检索包轨迹来源"}
                items={memoryRetrievalTraceSourceItems}
                empty={
                  english ? "No pack trace source yet" : "还没有检索包轨迹来源"
                }
              />
              <Block
                title={english ? "Recent pack traces" : "最近检索包轨迹"}
                items={recentRetrievalTraceItems}
                empty={
                  english ? "No recent pack trace yet" : "还没有最近检索包轨迹"
                }
              />
            </div>
            <div className="grid gap-4 xl:grid-cols-3">
              <Block
                title={
                  english
                    ? "Memory LLM fallback reasons"
                    : "记忆智能备用路径原因"
                }
                items={memoryFallbackReasonItems}
                empty={
                  english
                    ? "No memory LLM fallback reasons"
                    : "当前没有记忆智能备用路径原因"
                }
              />
              <Block
                title={
                  english ? "Memory write failure review" : "记忆写入失败复盘"
                }
                items={memoryWriteFailureReviewItems}
                empty={
                  english ? "No memory write failures" : "当前没有记忆写入失败"
                }
              />
              <Block
                title={english ? "Memory write boundary" : "记忆写入边界"}
                items={memoryWriteFailureBoundaryItems}
                empty={
                  english
                    ? "No memory write boundary note"
                    : "当前没有记忆写入边界说明"
                }
              />
            </div>
            <div className="grid gap-4 xl:grid-cols-3">
              <Block
                title={
                  english
                    ? "Memory write operator queue"
                    : "记忆写入人工处理队列"
                }
                items={memoryWriteOperatorQueueItems}
                empty={
                  english
                    ? "No write operator queue item"
                    : "当前没有写入人工处理队列项"
                }
              />
              <Block
                title={
                  english ? "Recent operator queue items" : "最近人工处理队列项"
                }
                items={recentMemoryWriteOperatorQueueItems}
                empty={
                  english
                    ? "No recent operator queue item"
                    : "当前没有最近人工处理队列项"
                }
              />
              <Block
                title={english ? "Operator queue boundary" : "人工处理队列边界"}
                items={memoryWriteOperatorQueueBoundaryItems}
                empty={
                  english
                    ? "No operator queue boundary note"
                    : "当前没有人工处理队列边界说明"
                }
              />
            </div>
            <div className="grid gap-4 xl:grid-cols-3">
              <Block
                title={
                  english ? "Memory write retry contract" : "记忆写入重试约束"
                }
                items={memoryWriteRetryContractItems}
                empty={
                  english ? "No retry contract item" : "当前没有重试约束项"
                }
              />
              <Block
                title={
                  english ? "Recent retry contract items" : "最近重试约束项"
                }
                items={recentMemoryWriteRetryContractItems}
                empty={
                  english
                    ? "No recent retry contract item"
                    : "当前没有最近重试约束项"
                }
              />
              <Block
                title={english ? "Retry contract boundary" : "重试约束边界"}
                items={memoryWriteRetryContractBoundaryItems}
                empty={
                  english
                    ? "No retry contract boundary note"
                    : "当前没有重试约束边界说明"
                }
              />
            </div>
            <div className="grid gap-4 xl:grid-cols-3">
              <Block
                title={
                  english ? "Memory write retry receipts" : "记忆写入重试凭证"
                }
                items={memoryWriteRetryReceiptLedgerItems}
                empty={
                  english
                    ? "No retry receipt ledger item"
                    : "当前没有重试凭证台账项"
                }
              />
              <Block
                title={
                  english ? "Owner-aware receipt review" : "带负责人的凭证复核"
                }
                items={recentMemoryWriteRetryReceiptLedgerItems}
                empty={
                  english
                    ? "No owner-aware receipt review item"
                    : "当前没有带负责人的凭证复核项"
                }
              />
              <Block
                title={english ? "Retry receipt boundary" : "重试凭证边界"}
                items={memoryWriteRetryReceiptLedgerBoundaryItems}
                empty={
                  english
                    ? "No retry receipt boundary note"
                    : "当前没有重试凭证边界说明"
                }
              />
            </div>
            <div className="grid gap-4 xl:grid-cols-3">
              <Block
                title={
                  english
                    ? "Memory write retry attempt gate"
                    : "记忆写入重试尝试门槛"
                }
                items={memoryWriteRetryAttemptLedgerItems}
                empty={
                  english
                    ? "No retry attempt ledger item"
                    : "当前没有重试尝试台账项"
                }
              />
              <Block
                title={
                  english ? "Recent retry attempt locks" : "最近重试尝试锁"
                }
                items={recentMemoryWriteRetryAttemptLedgerItems}
                empty={english ? "No retry attempt lock" : "当前没有重试尝试锁"}
              />
              <Block
                title={
                  english ? "Retry source rebuild gate" : "重试来源重建门槛"
                }
                items={memoryWriteRetryAttemptSourceGateItems}
                empty={
                  english
                    ? "No source rebuild gate item"
                    : "当前没有来源重建门槛项"
                }
              />
            </div>
            <div className="grid gap-4 xl:grid-cols-3">
              <Block
                title={english ? "Retry attempt boundary" : "重试尝试边界"}
                items={memoryWriteRetryAttemptLedgerBoundaryItems}
                empty={
                  english
                    ? "No retry attempt boundary note"
                    : "当前没有重试尝试边界说明"
                }
              />
            </div>
            <div className="grid gap-4 xl:grid-cols-3">
              <Block
                title={
                  english ? "Recent write failure classes" : "最近写入失败类别"
                }
                items={memoryWriteFailureClassItems}
                empty={
                  english ? "No write failure class" : "当前没有写入失败类别"
                }
              />
              <Block
                title={
                  english ? "Recent write failure reasons" : "最近写入失败原因"
                }
                items={memoryWriteFailureReasonItems}
                empty={
                  english ? "No write failure reason" : "当前没有写入失败原因"
                }
              />
              <Block
                title={
                  english ? "Recent write failure batches" : "最近写入失败批次"
                }
                items={recentMemoryWriteFailureItems}
                empty={
                  english
                    ? "No recent write failure batch"
                    : "当前没有最近写入失败批次"
                }
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{messages.diagnostics.recentJobs}</CardTitle>
            <CardDescription>{copy.jobsDescription}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.importJobs.length ? (
              data.importJobs.map((job) => (
                <div
                  key={job.id}
                  className="theme-surface-panel rounded-2xl px-4 py-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-[color:var(--foreground)]">
                        {diagnosticsKey(job.source.sourceType)} ·{" "}
                        {diagnosticsKey(job.jobType)}
                      </p>
                      <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
                        {job.source.externalAccountLabel ??
                          (english ? "Unnamed source" : "未命名来源")}{" "}
                        · {dateLabel(job.startedAt)}
                      </p>
                    </div>
                    <Badge
                      variant={
                        job.status.includes("FAILED")
                          ? "danger"
                          : job.status.includes("WARNING")
                            ? "warning"
                            : "success"
                      }
                    >
                      {diagnosticsKey(job.status)}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm text-[color:var(--muted)]">
                    {english
                      ? `success=${job.successRecords} · warning=${job.warningRecords} · failed=${job.failedRecords}`
                      : `成功=${job.successRecords} · 警告=${job.warningRecords} · 失败=${job.failedRecords}`}
                  </p>
                </div>
              ))
            ) : (
              <EmptyState
                title={copy.noImportJobTitle}
                description={copy.noImportJobDescription}
              />
            )}

            {data.captureOverview.recentFailures.length ? (
              <div className="rounded-2xl border border-[color:var(--status-warning-border)] bg-[color:var(--status-warning-bg)] px-4 py-4">
                <p className="font-medium text-[color:var(--status-warning-text)]">
                  {copy.recentCaptureFailures}
                </p>
                <div className="mt-3 space-y-2 text-sm text-[color:var(--status-warning-text)]">
                  {data.captureOverview.recentFailures.map((item) => (
                    <p key={item.id}>
                      {diagnosticsText(
                        item.title ??
                          (english ? "Untitled capture" : "未命名采集"),
                      )}{" "}
                      ·{" "}
                      {diagnosticsText(
                        item.errorMessage ??
                          (english ? "Unknown error" : "未知错误"),
                      )}
                    </p>
                  ))}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {english
              ? "Standardized skills already online"
              : "当前已经在线的标准化能力"}
          </CardTitle>
          <CardDescription>
            {english
              ? "Diagnostics is not just a metrics page. It should tell you which standardized operating skills are already safe enough to trust."
              : "诊断页不只是指标表，还要说清现在到底有哪些标准化经营能力已经足够值得信任。"}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 xl:grid-cols-2">
          {diagnosticsSkills.map((skill) => (
            <div
              key={skill.id}
              className="theme-surface-panel rounded-2xl px-4 py-4"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium text-[color:var(--foreground)]">
                  {diagnosticsText(skill.name)}
                </p>
                <Badge variant="info">
                  {skill.defaultBoundary === "auto"
                    ? english
                      ? "Auto"
                      : "自动"
                    : skill.defaultBoundary === "approval"
                      ? english
                        ? "Approval"
                        : "审批"
                      : english
                        ? "Manual"
                        : "人工"}
                </Badge>
              </div>
              <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                {diagnosticsText(skill.summary)}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{copy.workspaceControlsTitle}</CardTitle>
          <CardDescription>{copy.workspaceControlsDescription}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <Metric
            label={copy.pilotMode}
            value={
              data.workspace.pilotMode
                ? english
                  ? "Enabled"
                  : "开启"
                : english
                  ? "Disabled"
                  : "关闭"
            }
          />
          <Metric
            label={copy.consentRequired}
            value={
              data.workspace.captureConsentRequired
                ? english
                  ? "Yes"
                  : "是"
                : english
                  ? "No"
                  : "否"
            }
          />
          <Metric
            label={copy.auditEvents}
            value={String(data.recentAuditCount)}
          />
          {Object.entries(data.workspace.featureFlags).map(([key, value]) => (
            <Metric
              key={key}
              label={formatDiagnosticsFeatureFlagLabel(key, english)}
              value={value ? (english ? "On" : "开") : english ? "Off" : "关"}
            />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="theme-surface-panel min-w-0 max-w-full rounded-2xl px-4 py-4">
      <p className="break-words text-xs font-medium text-[color:var(--muted-foreground)]">
        {label}
      </p>
      <p className="mt-2 break-words text-sm font-semibold text-[color:var(--foreground)]">
        {value}
      </p>
    </div>
  );
}

function getAdoptionReadoutVariant(
  status: "blocked" | "watch" | "ready" | "done",
) {
  switch (status) {
    case "blocked":
      return "danger" as const;
    case "watch":
      return "info" as const;
    case "ready":
      return "warning" as const;
    case "done":
      return "success" as const;
  }
}

function getAdoptionPostureVariant(
  posture: "handoff-only" | "active" | "returning" | "reviewed" | "closed-loop",
) {
  switch (posture) {
    case "handoff-only":
      return "info" as const;
    case "active":
      return "warning" as const;
    case "returning":
      return "info" as const;
    case "reviewed":
      return "success" as const;
    case "closed-loop":
      return "success" as const;
  }
}

function getAdoptionPostureLabel(
  posture: "handoff-only" | "active" | "returning" | "reviewed" | "closed-loop",
  english: boolean,
) {
  switch (posture) {
    case "handoff-only":
      return english ? "Handoff only" : "只进入交接";
    case "active":
      return english ? "Action active" : "已打开动作";
    case "returning":
      return english ? "Returning" : "已回访";
    case "reviewed":
      return english ? "Reviewed" : "已完成复核";
    case "closed-loop":
      return english ? "Closed loop" : "已形成闭环";
  }
}

function WorkflowGate({
  label,
  status,
  summary,
  english,
}: {
  label: string;
  status: "ready" | "watch" | "blocked";
  summary: string;
  english: boolean;
}) {
  return (
    <div className="theme-surface-panel min-w-0 max-w-full rounded-2xl px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="min-w-0 break-words font-medium text-[color:var(--foreground)]">
          {label}
        </p>
        <Badge
          variant={
            status === "ready"
              ? "success"
              : status === "watch"
                ? "warning"
                : "danger"
          }
        >
          {status === "ready"
            ? english
              ? "Ready"
              : "就绪"
            : status === "watch"
              ? english
                ? "Watch"
                : "观察"
              : english
                ? "Blocked"
                : "阻塞"}
        </Badge>
      </div>
      <p className="mt-2 break-words text-sm leading-6 text-[color:var(--muted)]">
        {summary}
      </p>
    </div>
  );
}

function Block({
  title,
  items,
  empty,
}: {
  title: string;
  items: string[];
  empty: string;
}) {
  return (
    <div className="theme-surface-panel min-w-0 max-w-full overflow-hidden rounded-2xl px-4 py-4">
      <p className="break-words text-sm font-semibold text-[color:var(--foreground)]">
        {title}
      </p>
      <div className="mt-3 space-y-2 text-sm text-[color:var(--muted)]">
        {items.length ? (
          items.map((item) => (
            <p key={item} className="break-words leading-6">
              {item}
            </p>
          ))
        ) : (
          <p className="break-words text-[color:var(--muted-foreground)]">{empty}</p>
        )}
      </div>
    </div>
  );
}
