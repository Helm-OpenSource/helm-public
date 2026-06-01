import { beforeEach, describe, expect, it, vi } from "vitest";
import { ActorType, MemoryFactType, ObjectType, SourceType } from "@prisma/client";
import { type CreateFactInput } from "@/lib/memory/memory-fact.service";

const {
  serviceGovernanceMock,
  dbMock,
  llmWorkflowMock,
  memoryFactServiceMock,
  commitmentServiceMock,
  blockerServiceMock,
  briefingServiceMock,
  sharedMock,
  extractionMock,
  distillationCandidateStoreMock,
} = vi.hoisted(() => ({
  serviceGovernanceMock: {
    assertWorkspaceMemoryServiceAccess: vi.fn(),
  },
  dbMock: {
    meeting: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    memoryFact: {
      findMany: vi.fn(),
    },
    commitment: {
      findMany: vi.fn(),
    },
    blocker: {
      findMany: vi.fn(),
    },
    actionItem: {
      create: vi.fn(),
    },
    memoryEntry: {
      create: vi.fn(),
    },
    memoryLink: {
      create: vi.fn(),
    },
    company: {
      update: vi.fn(),
    },
    opportunity: {
      update: vi.fn(),
    },
    contact: {
      updateMany: vi.fn(),
    },
  },
  llmWorkflowMock: {
    processMeetingMemoryWithLLM: vi.fn(),
  },
  memoryFactServiceMock: {
    createMemoryFactsWithWriteResult: vi.fn(),
  },
  commitmentServiceMock: {
    createCommitment: vi.fn(),
  },
  blockerServiceMock: {
    createBlocker: vi.fn(),
  },
  briefingServiceMock: {
    generateMeetingBriefingSnapshot: vi.fn(),
  },
  sharedMock: {
    writeMemoryAuditAndEvent: vi.fn(),
  },
  extractionMock: {
    extractMeetingFactDrafts: vi.fn(),
    extractMeetingCommitmentDrafts: vi.fn(),
    extractMeetingBlockerDrafts: vi.fn(),
  },
  distillationCandidateStoreMock: {
    syncMemoryDistillationCandidatesForObject: vi.fn(),
  },
}));

vi.mock("@/lib/auth/service-governance", () => ({
  assertWorkspaceMemoryServiceAccess: serviceGovernanceMock.assertWorkspaceMemoryServiceAccess,
}));

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

vi.mock("@/lib/llm-workflows/process-meeting-memory.workflow", () => ({
  processMeetingMemoryWithLLM: llmWorkflowMock.processMeetingMemoryWithLLM,
}));

vi.mock("@/lib/memory/memory-fact.service", async (importOriginal) => ({
  ...((await importOriginal()) as object),
  createMemoryFactsWithWriteResult: memoryFactServiceMock.createMemoryFactsWithWriteResult,
}));

vi.mock("@/lib/memory/commitment.service", () => ({
  createCommitment: commitmentServiceMock.createCommitment,
}));

vi.mock("@/lib/memory/blocker.service", () => ({
  createBlocker: blockerServiceMock.createBlocker,
}));

vi.mock("@/lib/memory/briefing.service", () => ({
  generateMeetingBriefingSnapshot: briefingServiceMock.generateMeetingBriefingSnapshot,
}));

vi.mock("@/lib/memory/shared", () => ({
  writeMemoryAuditAndEvent: sharedMock.writeMemoryAuditAndEvent,
}));

vi.mock("@/lib/memory/fact-extraction.service", () => ({
  extractMeetingFactDrafts: extractionMock.extractMeetingFactDrafts,
}));

vi.mock("@/lib/memory/commitment-extraction.service", () => ({
  extractMeetingCommitmentDrafts: extractionMock.extractMeetingCommitmentDrafts,
}));

vi.mock("@/lib/memory/blocker-extraction.service", () => ({
  extractMeetingBlockerDrafts: extractionMock.extractMeetingBlockerDrafts,
}));

vi.mock("@/lib/memory/distillation-candidate-store", () => ({
  syncMemoryDistillationCandidatesForObject: distillationCandidateStoreMock.syncMemoryDistillationCandidatesForObject,
}));

vi.mock("@/lib/ai", () => ({
  generatePostMeetingActionSuggestions: vi.fn(() => []),
}));

import { processMeetingMemory } from "@/lib/memory/meeting-memory-pipeline.service";

function factDraft(): CreateFactInput {
  return {
    workspaceId: "workspace-1",
    actorName: "Owner",
    actorUserId: "user-1",
    actorType: ActorType.USER,
    objectType: ObjectType.OPPORTUNITY,
    objectId: "opp-1",
    factType: MemoryFactType.NEXT_STEP,
    title: "Send proposal",
    content: "Send the proposal by Wednesday.",
    sourceType: SourceType.MEETING_NOTE,
    sourceId: "meeting-1",
  };
}

describe("meeting memory pipeline write failure boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serviceGovernanceMock.assertWorkspaceMemoryServiceAccess.mockResolvedValue(undefined);
    dbMock.meeting.findFirst.mockResolvedValue({
      id: "meeting-1",
      title: "Pipeline failure meeting",
      startsAt: new Date("2026-04-21T09:00:00.000Z"),
      companyId: "company-1",
      opportunityId: "opp-1",
      ownerId: "user-1",
      contacts: [{ id: "contact-1", name: "Vivian" }],
      note: {
        summary: "Summary",
        keyDecisions: "Decision",
        confirmations: "Confirmation",
      },
      opportunity: {
        id: "opp-1",
        title: "Opportunity",
        type: "SALES",
        stage: "DISCOVERY",
        riskLevel: "MEDIUM",
        nextAction: "Follow up",
      },
      company: {
        id: "company-1",
        name: "Acme",
      },
      actionItems: [],
    });
    dbMock.memoryFact.findMany.mockResolvedValue([]);
    dbMock.commitment.findMany.mockResolvedValue([]);
    dbMock.blocker.findMany.mockResolvedValue([]);
    extractionMock.extractMeetingFactDrafts.mockReturnValue([factDraft()]);
    extractionMock.extractMeetingCommitmentDrafts.mockReturnValue([]);
    extractionMock.extractMeetingBlockerDrafts.mockReturnValue([]);
    distillationCandidateStoreMock.syncMemoryDistillationCandidatesForObject.mockResolvedValue({
      candidateCount: 1,
      createdCount: 1,
      updatedCount: 0,
      omittedCount: 0,
      skippedReviewedCount: 0,
      boundaryNote:
        "Memory distillation sync only persists review-required candidate records. It does not write MemoryFact, does not auto-promote memory, and does not change recommendation ranking.",
    });
    llmWorkflowMock.processMeetingMemoryWithLLM.mockResolvedValue({
      output: {
        summary: "Summary",
        facts: [factDraft()],
        commitments: [],
        blockers: [],
        candidateActions: [],
      },
      provider: "fallback",
      model: "fallback",
      fallbackUsed: true,
      success: true,
    });
    sharedMock.writeMemoryAuditAndEvent.mockResolvedValue(undefined);
  });

  it("writes failure audit and stops before downstream timeline or briefing writes", async () => {
    memoryFactServiceMock.createMemoryFactsWithWriteResult.mockResolvedValue({
      created: [],
      failures: [
        {
          failureClass: "retryable",
          reason: "database_unavailable",
          message: "Can't reach database server",
          title: "Send proposal",
          objectType: ObjectType.OPPORTUNITY,
          objectId: "opp-1",
          factType: MemoryFactType.NEXT_STEP,
          sourceType: SourceType.MEETING_NOTE,
          sourceId: "meeting-1",
          retryable: true,
          operatorReviewRequired: false,
        },
      ],
      summary: {
        inputFactCount: 1,
        attemptedFactCount: 1,
        createdFactCount: 0,
        failedFactCount: 1,
        retryableFailureCount: 1,
        nonRetryableFailureCount: 0,
        operatorReviewRequiredCount: 0,
        writeMode: "sequential_guarded_batch",
        failurePolicy: "fail_fast",
        status: "blocked",
        boundaryNote: "classification only",
      },
    });

    await expect(
      processMeetingMemory({
        workspaceId: "workspace-1",
        actorName: "Owner",
        actorUserId: "user-1",
        actorType: ActorType.USER,
        meetingId: "meeting-1",
      }),
    ).rejects.toThrow("会议记忆事实写入失败");

    expect(sharedMock.writeMemoryAuditAndEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "MEETING_MEMORY_FACT_WRITE_FAILED",
        eventName: "meeting_memory_fact_write_failed",
        metadata: expect.objectContaining({
          memoryWriteBatch: expect.objectContaining({
            failedFactCount: 1,
            retryableFailureCount: 1,
            status: "blocked",
          }),
          factWriteFailures: [
            expect.objectContaining({
              failureClass: "retryable",
              reason: "database_unavailable",
            }),
          ],
        }),
      }),
    );
    expect(commitmentServiceMock.createCommitment).not.toHaveBeenCalled();
    expect(blockerServiceMock.createBlocker).not.toHaveBeenCalled();
    expect(dbMock.memoryEntry.create).not.toHaveBeenCalled();
    expect(briefingServiceMock.generateMeetingBriefingSnapshot).not.toHaveBeenCalled();
    expect(dbMock.meeting.update).not.toHaveBeenCalled();
    expect(distillationCandidateStoreMock.syncMemoryDistillationCandidatesForObject).not.toHaveBeenCalled();
  });

  it("forwards suppressEvolutionRefresh to commitment and blocker writes in batch mode", async () => {
    const commitmentDraft = {
      workspaceId: "workspace-1",
      actorName: "Owner",
      actorUserId: "user-1",
      actorType: ActorType.USER,
      sourcePage: "/seed",
      title: "Lock next step",
      commitmentText: "Lock the next step by Wednesday.",
      sourceType: SourceType.MEETING_NOTE,
      sourceId: "meeting-1",
    };
    const blockerDraft = {
      workspaceId: "workspace-1",
      actorName: "Owner",
      actorUserId: "user-1",
      actorType: ActorType.USER,
      sourcePage: "/seed",
      title: "Budget unclear",
      blockerType: "budget",
      blockerText: "Budget remains unclear.",
      sourceType: SourceType.MEETING_NOTE,
      sourceId: "meeting-1",
    };
    extractionMock.extractMeetingCommitmentDrafts.mockReturnValue([commitmentDraft]);
    extractionMock.extractMeetingBlockerDrafts.mockReturnValue([blockerDraft]);
    const createdFact = {
      id: "fact-1",
      objectType: ObjectType.OPPORTUNITY,
      objectId: "opp-1",
    };
    memoryFactServiceMock.createMemoryFactsWithWriteResult.mockResolvedValue({
      created: [createdFact],
      failures: [],
      summary: {
        inputFactCount: 1,
        attemptedFactCount: 1,
        createdFactCount: 0,
        failedFactCount: 0,
        retryableFailureCount: 0,
        nonRetryableFailureCount: 0,
        operatorReviewRequiredCount: 0,
        writeMode: "sequential_guarded_batch",
        failurePolicy: "fail_fast",
        status: "complete",
        boundaryNote: "classification only",
      },
    });
    commitmentServiceMock.createCommitment.mockResolvedValue({ id: "commitment-1" });
    blockerServiceMock.createBlocker.mockResolvedValue({ id: "blocker-1" });
    llmWorkflowMock.processMeetingMemoryWithLLM.mockResolvedValue({
      output: {
        summary: "Summary",
        facts: [factDraft()],
        commitments: [commitmentDraft],
        blockers: [blockerDraft],
        candidateActions: [],
      },
      provider: "fallback",
      model: "fallback",
      fallbackUsed: true,
      success: true,
    });
    dbMock.actionItem.create.mockResolvedValue({ id: "action-1" });
    briefingServiceMock.generateMeetingBriefingSnapshot.mockResolvedValue({
      snapshot: { id: "briefing-1" },
      payload: { summary: "Summary" },
    });
    dbMock.meeting.update.mockResolvedValue({ id: "meeting-1" });
    dbMock.memoryEntry.create.mockResolvedValue({ id: "entry-1" });
    dbMock.memoryLink.create.mockResolvedValue({ id: "link-1" });
    dbMock.company.update.mockResolvedValue({ id: "company-1" });
    dbMock.opportunity.update.mockResolvedValue({ id: "opp-1" });
    dbMock.contact.updateMany.mockResolvedValue({ count: 1 });

    const result = await processMeetingMemory({
      workspaceId: "workspace-1",
      actorName: "Owner",
      actorUserId: "user-1",
      actorType: ActorType.USER,
      sourcePage: "/seed",
      meetingId: "meeting-1",
      suppressEvolutionRefresh: true,
    });

    expect(commitmentServiceMock.createCommitment).toHaveBeenCalledWith(
      expect.objectContaining({
        suppressEvolutionRefresh: true,
      }),
    );
    expect(blockerServiceMock.createBlocker).toHaveBeenCalledWith(
      expect.objectContaining({
        suppressEvolutionRefresh: true,
      }),
    );
    expect(distillationCandidateStoreMock.syncMemoryDistillationCandidatesForObject).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "workspace-1",
        actorName: "Owner",
        actorUserId: "user-1",
        actorType: ActorType.USER,
        sourcePage: "/seed",
        objectType: ObjectType.OPPORTUNITY,
        objectId: "opp-1",
      }),
    );
    expect(sharedMock.writeMemoryAuditAndEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "MEETING_MEMORY_PROCESSED",
        metadata: expect.objectContaining({
          distillationCandidateSync: expect.objectContaining({
            objectCount: 1,
            createdCount: 1,
            updatedCount: 0,
            omittedCount: 0,
            skippedReviewedCount: 0,
            failureCount: 0,
            boundaryNote: expect.stringContaining("review-required candidate records"),
          }),
        }),
      }),
    );
    expect(result.distillationCandidateSync).toEqual(
      expect.objectContaining({
        objectCount: 1,
        createdCount: 1,
        failureCount: 0,
        boundaryNote: expect.stringContaining("does not write canonical facts"),
      }),
    );
  });

  it("continues the meeting memory pipeline when distillation candidate sync fails", async () => {
    const createdFact = {
      id: "fact-1",
      objectType: ObjectType.OPPORTUNITY,
      objectId: "opp-1",
    };
    memoryFactServiceMock.createMemoryFactsWithWriteResult.mockResolvedValue({
      created: [createdFact],
      failures: [],
      summary: {
        inputFactCount: 1,
        attemptedFactCount: 1,
        createdFactCount: 1,
        failedFactCount: 0,
        retryableFailureCount: 0,
        nonRetryableFailureCount: 0,
        operatorReviewRequiredCount: 0,
        writeMode: "sequential_guarded_batch",
        failurePolicy: "fail_fast",
        status: "complete",
        boundaryNote: "classification only",
      },
    });
    distillationCandidateStoreMock.syncMemoryDistillationCandidatesForObject.mockRejectedValue(
      new Error("distillation store unavailable"),
    );
    briefingServiceMock.generateMeetingBriefingSnapshot.mockResolvedValue({
      snapshot: { id: "briefing-1" },
      payload: { summary: "Summary" },
    });
    dbMock.meeting.update.mockResolvedValue({ id: "meeting-1" });
    dbMock.memoryEntry.create.mockResolvedValue({ id: "entry-1" });
    dbMock.company.update.mockResolvedValue({ id: "company-1" });
    dbMock.opportunity.update.mockResolvedValue({ id: "opp-1" });
    dbMock.contact.updateMany.mockResolvedValue({ count: 1 });

    const result = await processMeetingMemory({
      workspaceId: "workspace-1",
      actorName: "Owner",
      actorUserId: "user-1",
      actorType: ActorType.USER,
      sourcePage: "/seed",
      meetingId: "meeting-1",
    });

    expect(briefingServiceMock.generateMeetingBriefingSnapshot).toHaveBeenCalled();
    expect(sharedMock.writeMemoryAuditAndEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "MEETING_MEMORY_PROCESSED",
        metadata: expect.objectContaining({
          distillationCandidateSync: expect.objectContaining({
            objectCount: 1,
            failureCount: 1,
            failures: [
              expect.objectContaining({
                objectType: ObjectType.OPPORTUNITY,
                objectId: "opp-1",
                reason: "distillation store unavailable",
              }),
            ],
          }),
        }),
      }),
    );
    expect(result.distillationCandidateSync).toEqual(
      expect.objectContaining({
        objectCount: 1,
        failureCount: 1,
        createdCount: 0,
        boundaryNote: expect.stringContaining("does not change recommendation ranking"),
      }),
    );
  });
});
