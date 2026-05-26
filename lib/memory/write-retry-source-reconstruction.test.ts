import { ActorType, MemoryFactType, ObjectType, SourceType } from "@prisma/client";
import { describe, expect, it } from "vitest";
import type { ExistingMemoryFactForWriteGuard } from "@/lib/memory/write-dedupe";
import {
  buildMemoryWriteRetrySourceReconstructionProof,
  type MemoryWriteRetrySourceReconstructionMeeting,
} from "@/lib/memory/write-retry-source-reconstruction";
import type { MemoryWriteRetryAttemptLedgerItem } from "@/lib/memory/write-retry-attempt-ledger";

function attemptItem(overrides: Partial<MemoryWriteRetryAttemptLedgerItem> = {}): MemoryWriteRetryAttemptLedgerItem {
  return {
    id: "retryable-audit:0:retry-contract:retry-receipt:retry-attempt",
    retryContractItemId: "retryable-audit:0:retry-contract",
    queueItemId: "retryable-audit:0",
    auditId: "retryable-audit",
    targetType: "Meeting",
    targetId: "meeting-1",
    title: "预算复盘 会议摘要",
    objectType: "MEETING",
    objectId: "meeting-1",
    factType: "SUMMARY",
    sourceType: "MEETING_NOTE",
    sourceId: "meeting-1",
    receiptAuditId: "receipt-audit-1",
    receiptStatus: "confirmed_ready_for_executor",
    receiptPayloadStatus: "valid",
    idempotencyLockKey: "memory-write-retry:meeting:meeting-1:summary:meeting-note:meeting-1:budget",
    ownerUserId: "user-1",
    ownerName: "Ada Chen",
    ownerEmail: "ada@example.com",
    ownerLabel: "Ada Chen",
    attemptCount: 0,
    attemptLimit: 3,
    remainingAttemptCount: 3,
    latestAttemptAuditId: "attempt-audit-1",
    latestAttemptCreatedAt: "2026-04-21T04:00:00.000Z",
    latestAttemptStatus: "lock_reserved",
    attemptPayloadStatus: "valid",
    backoffDelaysMinutes: [0, 5, 15],
    nextBackoffDelayMinutes: 0,
    idempotencyLockStatus: "lock_available_for_manual_attempt",
    sourceRebuildGate: {
      gateVersion: "memory_write_retry_source_rebuild_gate_v1",
      gateStatus: "ready_for_manual_rebuild_review",
      receiptStatus: "confirmed_ready_for_executor",
      sourceType: "MEETING_NOTE",
      sourceId: "meeting-1",
      missingInputs: [],
      requiredManualChecks: ["confirm_same_workspace_object_and_source", "check_existing_duplicate_or_conflict"],
      nextOperatorAction: "record_attempt_lock_after_manual_review",
      manualConfirmationRequired: true,
      canExecuteAutomatically: false,
      boundaryNote: "Source gate is review only.",
    },
    nextOperatorAction: "record_attempt_lock_after_manual_review",
    manualConfirmationRequired: true,
    canExecuteAutomatically: false,
    boundaryNote: "Attempt ledger is review only.",
    ...overrides,
  };
}

function meeting(overrides: Partial<MemoryWriteRetrySourceReconstructionMeeting> = {}): MemoryWriteRetrySourceReconstructionMeeting {
  return {
    id: "meeting-1",
    title: "预算复盘",
    startsAt: new Date("2026-04-21T02:00:00.000Z"),
    companyId: "company-1",
    opportunityId: "opp-1",
    contacts: [{ id: "contact-1", name: "Lin" }],
    note: {
      id: "note-1",
      relationshipSummary: null,
      previousConclusion: null,
      meetingGoal: null,
      recommendedQuestions: null,
      riskAlerts: null,
      liveTranscript: null,
      summary: "客户确认续约预算将在下周三前完成内部审批。",
      keyDecisions: null,
      confirmations: null,
      updatedAt: new Date("2026-04-21T02:30:00.000Z"),
    },
    ...overrides,
  };
}

function existingFact(overrides: Partial<ExistingMemoryFactForWriteGuard> = {}): ExistingMemoryFactForWriteGuard {
  return {
    id: "fact-1",
    workspaceId: "workspace-1",
    objectType: ObjectType.MEETING,
    objectId: "meeting-1",
    factType: MemoryFactType.SUMMARY,
    title: "预算复盘 会议摘要",
    content: "客户确认续约预算将在下周三前完成内部审批。",
    sourceType: SourceType.MEETING_NOTE,
    sourceId: "meeting-1",
    normalizedValue: JSON.stringify({
      meetingId: "meeting-1",
    }),
    ...overrides,
  };
}

describe("memory write retry source reconstruction proof", () => {
  it("reconstructs one matching MemoryFact candidate only after source and actor proof are present", () => {
    const proof = buildMemoryWriteRetrySourceReconstructionProof({
      workspaceId: "workspace-1",
      actorName: "Ada Chen",
      actorUserId: "user-1",
      actorType: ActorType.USER,
      item: attemptItem(),
      meeting: meeting(),
      existingFacts: [],
      failureAuditCreatedAt: new Date("2026-04-21T03:00:00.000Z"),
      generatedAt: new Date("2026-04-21T04:00:00.000Z"),
    });

    expect(proof).toMatchObject({
      proofStatus: "ready_for_executor",
      candidateCount: 1,
      sourceType: "MEETING_NOTE",
      sourceId: "meeting-1",
      manualConfirmationRequired: true,
      canExecuteAutomatically: false,
    });
    expect(proof.contentBasis).toContain("summary");
    expect(proof.reconstructedFact).toMatchObject({
      workspaceId: "workspace-1",
      actorName: "Ada Chen",
      objectType: ObjectType.MEETING,
      objectId: "meeting-1",
      factType: MemoryFactType.SUMMARY,
      sourceType: SourceType.MEETING_NOTE,
      sourceId: "meeting-1",
      title: "预算复盘 会议摘要",
      content: "客户确认续约预算将在下周三前完成内部审批。",
    });
    expect(proof.writeKeyHash).toHaveLength(64);
    expect(proof.contentHash).toHaveLength(64);
  });

  it("blocks when the source meeting note is missing", () => {
    const proof = buildMemoryWriteRetrySourceReconstructionProof({
      workspaceId: "workspace-1",
      actorName: "Ada Chen",
      item: attemptItem(),
      meeting: meeting({ note: null }),
      existingFacts: [],
    });

    expect(proof).toMatchObject({
      proofStatus: "blocked_missing_source",
      reconstructedFact: null,
      canExecuteAutomatically: false,
    });
  });

  it("blocks source proof when the note changed after the failure audit", () => {
    const proof = buildMemoryWriteRetrySourceReconstructionProof({
      workspaceId: "workspace-1",
      actorName: "Ada Chen",
      item: attemptItem(),
      meeting: meeting({
        note: {
          ...meeting().note!,
          updatedAt: new Date("2026-04-21T05:00:00.000Z"),
        },
      }),
      existingFacts: [],
      failureAuditCreatedAt: new Date("2026-04-21T04:00:00.000Z"),
    });

    expect(proof).toMatchObject({
      proofStatus: "blocked_source_changed_since_failure",
      reconstructedFact: null,
    });
    expect(proof.requiredManualChecks).toContain("review_source_version_after_failure");
  });

  it("blocks generic fallback content instead of treating it as reliable source proof", () => {
    const proof = buildMemoryWriteRetrySourceReconstructionProof({
      workspaceId: "workspace-1",
      actorName: "Ada Chen",
      item: attemptItem(),
      meeting: meeting({
        note: {
          ...meeting().note!,
          summary: null,
          keyDecisions: null,
          confirmations: null,
          liveTranscript: null,
        },
      }),
      existingFacts: [],
    });

    expect(proof).toMatchObject({
      proofStatus: "blocked_unreliable_source_content",
      reconstructedFact: null,
      missingInputs: ["reliable_source_content"],
      canExecuteAutomatically: false,
    });
  });

  it("blocks duplicate reconstructed facts through the existing write plan dry run", () => {
    const proof = buildMemoryWriteRetrySourceReconstructionProof({
      workspaceId: "workspace-1",
      actorName: "Ada Chen",
      item: attemptItem(),
      meeting: meeting(),
      existingFacts: [existingFact()],
    });

    expect(proof).toMatchObject({
      proofStatus: "blocked_duplicate_suppressed",
      reconstructedFact: null,
      canExecuteAutomatically: false,
      writePlanSummary: {
        duplicateSuppressedCount: 1,
      },
    });
    expect(proof.duplicateSuppressions[0]).toMatchObject({
      reason: "existing_duplicate",
      matchingFactId: "fact-1",
    });
  });

  it("requires explicit actor context and a supported MEETING_NOTE source", () => {
    const noActorProof = buildMemoryWriteRetrySourceReconstructionProof({
      workspaceId: "workspace-1",
      actorName: "",
      item: attemptItem(),
      meeting: meeting(),
      existingFacts: [],
    });
    const unsupportedProof = buildMemoryWriteRetrySourceReconstructionProof({
      workspaceId: "workspace-1",
      actorName: "Ada Chen",
      item: attemptItem({
        sourceType: "EMAIL",
        sourceId: "email-1",
      }),
      meeting: meeting(),
      existingFacts: [],
    });

    expect(noActorProof.proofStatus).toBe("blocked_missing_actor_context");
    expect(unsupportedProof.proofStatus).toBe("blocked_unsupported_source");
    expect(noActorProof.canExecuteAutomatically).toBe(false);
    expect(unsupportedProof.canExecuteAutomatically).toBe(false);
  });
});
