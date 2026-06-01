import {
  ActorType,
  MemoryDistillationCandidateStatus,
  MemoryFactType,
  MemoryStatus,
  ObjectType,
  SourceType,
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock, serviceGovernanceMock, sharedMock } = vi.hoisted(() => ({
  dbMock: {
    memoryFact: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    memoryDistillationCandidate: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
  serviceGovernanceMock: {
    assertWorkspaceMemoryServiceAccess: vi.fn(),
  },
  sharedMock: {
    writeMemoryAuditAndEvent: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

vi.mock("@/lib/auth/service-governance", () => ({
  assertWorkspaceMemoryServiceAccess: serviceGovernanceMock.assertWorkspaceMemoryServiceAccess,
}));

vi.mock("@/lib/memory/shared", async () => {
  const actual = await vi.importActual<typeof import("@/lib/memory/shared")>("@/lib/memory/shared");
  return {
    ...actual,
    writeMemoryAuditAndEvent: sharedMock.writeMemoryAuditAndEvent,
  };
});

import {
  reviewMemoryDistillationCandidate,
  syncMemoryDistillationCandidatesForObject,
} from "@/lib/memory/distillation-candidate-store";

const groupKey = "OPPORTUNITY|opp-1|RISK_SIGNAL|budget risk";

function makeFact(overrides: Record<string, unknown> = {}) {
  return {
    id: "fact-1",
    workspaceId: "workspace-1",
    objectType: ObjectType.OPPORTUNITY,
    objectId: "opp-1",
    factType: MemoryFactType.RISK_SIGNAL,
    title: "Budget risk",
    content: "Budget is at risk.",
    normalizedValue: JSON.stringify({ factKey: "budget-risk" }),
    sourceType: SourceType.MEETING_NOTE,
    sourceId: "meeting-1",
    confidence: 70,
    importance: 70,
    freshnessScore: 50,
    status: MemoryStatus.ACTIVE,
    confirmedByUser: false,
    createdBySystem: true,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

function makeExistingCandidate(overrides: Record<string, unknown> = {}) {
  return {
    id: "candidate-1",
    workspaceId: "workspace-1",
    groupKey,
    objectType: ObjectType.OPPORTUNITY,
    objectId: "opp-1",
    factType: MemoryFactType.RISK_SIGNAL,
    title: "Budget risk",
    summary: "Repeated fact observed 2 times.",
    sourceFactIds: JSON.stringify(["fact-1", "fact-2"]),
    evidenceRefs: JSON.stringify([]),
    sourceRefs: JSON.stringify(["MEETING_NOTE:meeting-1", "MEETING_NOTE:meeting-2"]),
    repeatCount: 2,
    confidence: 70,
    reviewPosture: "review_required",
    status: MemoryDistillationCandidateStatus.PENDING_REVIEW,
    boundaryNote: "boundary",
    createdFrom: "repeated_normalized_fact",
    latestSourceAt: new Date("2026-01-02T00:00:00Z"),
    decisionReason: null,
    decidedAt: null,
    decidedByUserId: null,
    auditPayload: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-02T00:00:00Z"),
    ...overrides,
  };
}

function syncInput() {
  return {
    workspaceId: "workspace-1",
    actorName: "Memory Agent",
    actorUserId: "user-1",
    actorType: ActorType.USER,
    objectType: ObjectType.OPPORTUNITY,
    objectId: "opp-1",
    sourcePage: "/memory",
  };
}

describe("distillation candidate store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serviceGovernanceMock.assertWorkspaceMemoryServiceAccess.mockResolvedValue(undefined);
    sharedMock.writeMemoryAuditAndEvent.mockResolvedValue(undefined);
    dbMock.memoryFact.findMany.mockResolvedValue([
      makeFact({ id: "fact-1", sourceId: "meeting-1", createdAt: new Date("2026-01-01T00:00:00Z") }),
      makeFact({ id: "fact-2", sourceId: "meeting-2", createdAt: new Date("2026-01-02T00:00:00Z") }),
    ]);
    dbMock.memoryDistillationCandidate.findMany.mockResolvedValue([]);
    dbMock.memoryDistillationCandidate.create.mockResolvedValue(makeExistingCandidate());
    dbMock.memoryDistillationCandidate.update.mockResolvedValue(makeExistingCandidate());
    dbMock.memoryDistillationCandidate.findFirst.mockResolvedValue(makeExistingCandidate());
  });

  it("creates a new pending review candidate for repeated active object facts", async () => {
    const summary = await syncMemoryDistillationCandidatesForObject(syncInput());

    expect(serviceGovernanceMock.assertWorkspaceMemoryServiceAccess).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      userId: "user-1",
      actorType: ActorType.USER,
      english: false,
    });
    expect(dbMock.memoryFact.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          workspaceId: "workspace-1",
          objectType: ObjectType.OPPORTUNITY,
          objectId: "opp-1",
          status: { in: [MemoryStatus.ACTIVE, MemoryStatus.OBSERVED] },
        }),
        take: 80,
      }),
    );
    expect(dbMock.memoryDistillationCandidate.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "workspace-1",
        groupKey,
        status: MemoryDistillationCandidateStatus.PENDING_REVIEW,
        sourceFactIds: JSON.stringify(["fact-1", "fact-2"], null, 2),
        repeatCount: 2,
      }),
    });
    expect(dbMock.memoryDistillationCandidate.update).not.toHaveBeenCalled();
    expect(dbMock.memoryFact.create).not.toHaveBeenCalled();
    expect(summary).toMatchObject({
      candidateCount: 1,
      createdCount: 1,
      updatedCount: 0,
      omittedCount: 0,
      skippedReviewedCount: 0,
    });
    expect(sharedMock.writeMemoryAuditAndEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          boundaryNote: expect.stringContaining("does not write MemoryFact"),
        }),
      }),
    );
  });

  it("updates evidence and counts for an existing pending review candidate", async () => {
    dbMock.memoryDistillationCandidate.findMany.mockResolvedValue([
      makeExistingCandidate({ id: "candidate-pending", status: MemoryDistillationCandidateStatus.PENDING_REVIEW }),
    ]);

    const summary = await syncMemoryDistillationCandidatesForObject(syncInput());

    expect(dbMock.memoryDistillationCandidate.create).not.toHaveBeenCalled();
    expect(dbMock.memoryDistillationCandidate.update).toHaveBeenCalledWith({
      where: { id: "candidate-pending" },
      data: expect.objectContaining({
        sourceFactIds: JSON.stringify(["fact-1", "fact-2"], null, 2),
        sourceRefs: JSON.stringify(["MEETING_NOTE:meeting-1", "MEETING_NOTE:meeting-2"], null, 2),
        repeatCount: 2,
        confidence: 70,
      }),
    });
    expect(summary).toMatchObject({ createdCount: 0, updatedCount: 1, skippedReviewedCount: 0 });
  });

  it("degrades gracefully when distillation candidate table is missing", async () => {
    dbMock.memoryDistillationCandidate.findMany.mockRejectedValue(
      new Error("The table `memorydistillationcandidate` does not exist in the current database."),
    );

    const summary = await syncMemoryDistillationCandidatesForObject(syncInput());

    expect(summary).toMatchObject({
      candidateCount: 0,
      createdCount: 0,
      updatedCount: 0,
      omittedCount: 0,
      skippedReviewedCount: 0,
    });
    expect(summary.boundaryNote).toContain("table is unavailable");
    expect(sharedMock.writeMemoryAuditAndEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          tableMissing: true,
        }),
      }),
    );
    expect(dbMock.memoryDistillationCandidate.create).not.toHaveBeenCalled();
    expect(dbMock.memoryDistillationCandidate.update).not.toHaveBeenCalled();
  });

  it("omits a rejected reviewed candidate and does not regenerate it", async () => {
    dbMock.memoryDistillationCandidate.findMany.mockResolvedValue([
      makeExistingCandidate({
        id: "candidate-rejected",
        status: MemoryDistillationCandidateStatus.REJECTED,
        decidedAt: new Date("2026-01-03T00:00:00Z"),
      }),
    ]);

    const summary = await syncMemoryDistillationCandidatesForObject(syncInput());

    expect(dbMock.memoryDistillationCandidate.create).not.toHaveBeenCalled();
    expect(dbMock.memoryDistillationCandidate.update).not.toHaveBeenCalled();
    expect(summary).toMatchObject({
      candidateCount: 0,
      omittedCount: 1,
      skippedReviewedCount: 1,
    });
  });

  it("omits a deferred reviewed candidate and does not regenerate it", async () => {
    dbMock.memoryDistillationCandidate.findMany.mockResolvedValue([
      makeExistingCandidate({
        id: "candidate-deferred",
        status: MemoryDistillationCandidateStatus.DEFERRED,
        decidedAt: new Date("2026-01-03T00:00:00Z"),
      }),
    ]);

    const summary = await syncMemoryDistillationCandidatesForObject(syncInput());

    expect(dbMock.memoryDistillationCandidate.create).not.toHaveBeenCalled();
    expect(dbMock.memoryDistillationCandidate.update).not.toHaveBeenCalled();
    expect(summary).toMatchObject({
      candidateCount: 0,
      omittedCount: 1,
      skippedReviewedCount: 1,
    });
  });

  it("does not reset an approved reviewed candidate back to pending", async () => {
    dbMock.memoryDistillationCandidate.findMany.mockResolvedValue([
      makeExistingCandidate({
        id: "candidate-approved",
        status: MemoryDistillationCandidateStatus.APPROVED,
        decidedAt: new Date("2026-01-03T00:00:00Z"),
      }),
    ]);

    const summary = await syncMemoryDistillationCandidatesForObject(syncInput());

    expect(dbMock.memoryDistillationCandidate.create).not.toHaveBeenCalled();
    expect(dbMock.memoryDistillationCandidate.update).not.toHaveBeenCalled();
    expect(summary).toMatchObject({
      candidateCount: 1,
      skippedReviewedCount: 1,
    });
  });

  it("review reject updates only candidate decision fields and does not create memory facts", async () => {
    await reviewMemoryDistillationCandidate({
      workspaceId: "workspace-1",
      actorName: "Reviewer",
      actorUserId: "user-1",
      actorType: ActorType.USER,
      candidateId: "candidate-1",
      decision: "reject",
      reason: "Too broad",
    });

    expect(serviceGovernanceMock.assertWorkspaceMemoryServiceAccess).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      userId: "user-1",
      actorType: ActorType.USER,
      english: false,
    });
    expect(dbMock.memoryDistillationCandidate.findFirst).toHaveBeenCalledWith({
      where: {
        id: "candidate-1",
        workspaceId: "workspace-1",
      },
    });
    expect(dbMock.memoryDistillationCandidate.update).toHaveBeenCalledWith({
      where: { id: "candidate-1" },
      data: expect.objectContaining({
        status: MemoryDistillationCandidateStatus.REJECTED,
        decisionReason: "Too broad",
        decidedByUserId: "user-1",
      }),
    });
    expect(dbMock.memoryFact.create).not.toHaveBeenCalled();
    expect(sharedMock.writeMemoryAuditAndEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          boundaryNote: "Memory distillation review decision does not promote memory or execute actions.",
        }),
      }),
    );
  });

  it("review approve records the decision but does not promote a canonical MemoryFact", async () => {
    await reviewMemoryDistillationCandidate({
      workspaceId: "workspace-1",
      actorName: "Reviewer",
      actorUserId: "user-1",
      actorType: ActorType.USER,
      candidateId: "candidate-1",
      decision: "approve",
    });

    expect(dbMock.memoryDistillationCandidate.update).toHaveBeenCalledWith({
      where: { id: "candidate-1" },
      data: expect.objectContaining({
        status: MemoryDistillationCandidateStatus.APPROVED,
        decisionReason: null,
      }),
    });
    expect(dbMock.memoryFact.create).not.toHaveBeenCalled();
  });
});
