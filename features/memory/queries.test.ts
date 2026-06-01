import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectType } from "@prisma/client";
import type { MemoryDistillationCandidateStatus } from "@prisma/client";

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    memoryEntry: { findMany: vi.fn() },
    memoryFact: { findMany: vi.fn() },
    commitment: { findMany: vi.fn() },
    blocker: { findMany: vi.fn() },
    memoryCorrection: { findMany: vi.fn() },
    auditLog: { findMany: vi.fn() },
    externalMemoryRecord: { findMany: vi.fn() },
    memoryCandidate: { findMany: vi.fn() },
    memoryDistillationCandidate: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

vi.mock("@/lib/helm-v2/runtime-upgrade", () => ({
  buildReflectionCandidateReadout: vi.fn(),
}));

import {
  buildMemoryDistillationCandidateWhere,
  buildMemoryEntrySourceWhere,
  getMemoryData,
} from "@/features/memory/queries";

const DISTILLATION_CANDIDATE_STATUS = {
  PENDING_REVIEW: "PENDING_REVIEW",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  DEFERRED: "DEFERRED",
} as const satisfies Record<string, MemoryDistillationCandidateStatus>;

function resetDbMocks() {
  dbMock.memoryEntry.findMany.mockResolvedValue([]);
  dbMock.memoryFact.findMany.mockResolvedValue([]);
  dbMock.commitment.findMany.mockResolvedValue([]);
  dbMock.blocker.findMany.mockResolvedValue([]);
  dbMock.memoryCorrection.findMany.mockResolvedValue([]);
  dbMock.auditLog.findMany.mockResolvedValue([]);
  dbMock.externalMemoryRecord.findMany.mockResolvedValue([]);
  dbMock.memoryCandidate.findMany.mockResolvedValue([]);
  dbMock.memoryDistillationCandidate.findMany.mockResolvedValue([]);
}

describe("memory source filter helper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDbMocks();
  });

  it("builds OPENCLAW filter", () => {
    expect(buildMemoryEntrySourceWhere("OPENCLAW")).toEqual({
      source: { startsWith: "OPENCLAW:" },
    });
  });

  it("builds HELM filter", () => {
    expect(buildMemoryEntrySourceWhere("HELM")).toEqual({
      NOT: { source: { startsWith: "OPENCLAW:" } },
    });
  });

  it("builds ALL filter", () => {
    expect(buildMemoryEntrySourceWhere("ALL")).toEqual({
      NOT: { source: { startsWith: "OPENCLAW:" } },
    });
  });

  it("defaults unknown source filters to ALL without including legacy OpenClaw memory", () => {
    expect(buildMemoryEntrySourceWhere("UNKNOWN")).toEqual({
      NOT: { source: { startsWith: "OPENCLAW:" } },
    });
  });
});

describe("memory distillation candidate query contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDbMocks();
  });

  it("builds object-scoped PENDING_REVIEW candidate filters", () => {
    expect(
      buildMemoryDistillationCandidateWhere({
        workspaceId: "workspace-1",
        query: "renewal",
        objectLevel: "MEETING",
        objectType: ObjectType.MEETING,
        objectId: "meeting-1",
        statuses: [DISTILLATION_CANDIDATE_STATUS.PENDING_REVIEW],
      }),
    ).toEqual({
      workspaceId: "workspace-1",
      status: { in: [DISTILLATION_CANDIDATE_STATUS.PENDING_REVIEW] },
      objectType: ObjectType.MEETING,
      objectId: "meeting-1",
      OR: [
        { title: { contains: "renewal" } },
        { summary: { contains: "renewal" } },
        { groupKey: { contains: "renewal" } },
      ],
    });
  });

  it("returns pending and reviewed distillation candidates only for non-OPENCLAW sources", async () => {
    const latestSourceAt = new Date("2026-04-27T01:00:00.000Z");
    const updatedAt = new Date("2026-04-27T02:00:00.000Z");
    dbMock.memoryDistillationCandidate.findMany
      .mockResolvedValueOnce([
        {
          id: "candidate-pending",
          objectType: ObjectType.MEETING,
          objectId: "meeting-1",
          factType: "SUMMARY",
          title: "Repeated renewal ask",
          summary: "The same renewal ask appeared repeatedly.",
          sourceFactIds: "[\"fact-1\",\"fact-2\"]",
          evidenceRefs: "[\"meeting-note-1\"]",
          sourceRefs: "[]",
          repeatCount: 2,
          confidence: 88,
          reviewPosture: "review_required",
          status: DISTILLATION_CANDIDATE_STATUS.PENDING_REVIEW,
          boundaryNote: "Review decision only.",
          createdFrom: "repeated_normalized_fact",
          latestSourceAt,
          decisionReason: null,
          decidedAt: null,
          createdAt: latestSourceAt,
          updatedAt,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "candidate-approved",
          objectType: ObjectType.MEETING,
          objectId: "meeting-1",
          factType: "SUMMARY",
          title: "Approved renewal ask",
          summary: "A reviewed candidate remains auditable.",
          sourceFactIds: "[]",
          evidenceRefs: "[]",
          sourceRefs: "[]",
          repeatCount: 3,
          confidence: 91,
          reviewPosture: "review_required",
          status: DISTILLATION_CANDIDATE_STATUS.APPROVED,
          boundaryNote: "Review decision only.",
          createdFrom: "repeated_normalized_fact",
          latestSourceAt,
          decisionReason: "Looks correct.",
          decidedAt: updatedAt,
          createdAt: latestSourceAt,
          updatedAt,
        },
      ]);

    const data = await getMemoryData("workspace-1", {
      source: "HELM",
      objectType: ObjectType.MEETING,
      objectId: "meeting-1",
    });

    expect(data.distillationCandidates).toEqual([
      expect.objectContaining({
        id: "candidate-pending",
        sourceFactIds: ["fact-1", "fact-2"],
        evidenceRefs: ["meeting-note-1"],
      }),
    ]);
    expect(data.distillationDecisions).toEqual([
      expect.objectContaining({
        id: "candidate-approved",
        status: DISTILLATION_CANDIDATE_STATUS.APPROVED,
      }),
    ]);
    expect(dbMock.memoryDistillationCandidate.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          workspaceId: "workspace-1",
          objectType: ObjectType.MEETING,
          objectId: "meeting-1",
          status: { in: [DISTILLATION_CANDIDATE_STATUS.PENDING_REVIEW] },
        }),
        orderBy: [
          { latestSourceAt: "desc" },
          { createdAt: "desc" },
          { id: "asc" },
        ],
      }),
    );
    expect(dbMock.memoryDistillationCandidate.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          status: {
            in: [
              DISTILLATION_CANDIDATE_STATUS.APPROVED,
              DISTILLATION_CANDIDATE_STATUS.REJECTED,
              DISTILLATION_CANDIDATE_STATUS.DEFERRED,
            ],
          },
        }),
        orderBy: [
          { decidedAt: "desc" },
          { updatedAt: "desc" },
          { id: "asc" },
        ],
      }),
    );

    await getMemoryData("workspace-1", { source: "OPENCLAW" });
    expect(dbMock.memoryDistillationCandidate.findMany).toHaveBeenCalledTimes(2);
  });
});

describe("memory distillation candidate query contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDbMocks();
  });

  it("builds object-scoped PENDING_REVIEW candidate filters", () => {
    expect(
      buildMemoryDistillationCandidateWhere({
        workspaceId: "workspace-1",
        query: "renewal",
        objectLevel: "MEETING",
        objectType: ObjectType.MEETING,
        objectId: "meeting-1",
        statuses: [DISTILLATION_CANDIDATE_STATUS.PENDING_REVIEW],
      }),
    ).toEqual({
      workspaceId: "workspace-1",
      status: { in: [DISTILLATION_CANDIDATE_STATUS.PENDING_REVIEW] },
      objectType: ObjectType.MEETING,
      objectId: "meeting-1",
      OR: [
        { title: { contains: "renewal" } },
        { summary: { contains: "renewal" } },
        { groupKey: { contains: "renewal" } },
      ],
    });
  });

  it("returns pending and reviewed distillation candidates only for non-OPENCLAW sources", async () => {
    const latestSourceAt = new Date("2026-04-27T01:00:00.000Z");
    const updatedAt = new Date("2026-04-27T02:00:00.000Z");
    dbMock.memoryDistillationCandidate.findMany
      .mockResolvedValueOnce([
        {
          id: "candidate-pending",
          objectType: ObjectType.MEETING,
          objectId: "meeting-1",
          factType: "SUMMARY",
          title: "Repeated renewal ask",
          summary: "The same renewal ask appeared repeatedly.",
          sourceFactIds: "[\"fact-1\",\"fact-2\"]",
          evidenceRefs: "[\"meeting-note-1\"]",
          sourceRefs: "[]",
          repeatCount: 2,
          confidence: 88,
          reviewPosture: "review_required",
          status: DISTILLATION_CANDIDATE_STATUS.PENDING_REVIEW,
          boundaryNote: "Review decision only.",
          createdFrom: "repeated_normalized_fact",
          latestSourceAt,
          decisionReason: null,
          decidedAt: null,
          createdAt: latestSourceAt,
          updatedAt,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "candidate-approved",
          objectType: ObjectType.MEETING,
          objectId: "meeting-1",
          factType: "SUMMARY",
          title: "Approved renewal ask",
          summary: "A reviewed candidate remains auditable.",
          sourceFactIds: "[]",
          evidenceRefs: "[]",
          sourceRefs: "[]",
          repeatCount: 3,
          confidence: 91,
          reviewPosture: "review_required",
          status: DISTILLATION_CANDIDATE_STATUS.APPROVED,
          boundaryNote: "Review decision only.",
          createdFrom: "repeated_normalized_fact",
          latestSourceAt,
          decisionReason: "Looks correct.",
          decidedAt: updatedAt,
          createdAt: latestSourceAt,
          updatedAt,
        },
      ]);

    const data = await getMemoryData("workspace-1", {
      source: "HELM",
      objectType: ObjectType.MEETING,
      objectId: "meeting-1",
    });

    expect(data.distillationCandidates).toEqual([
      expect.objectContaining({
        id: "candidate-pending",
        sourceFactIds: ["fact-1", "fact-2"],
        evidenceRefs: ["meeting-note-1"],
      }),
    ]);
    expect(data.distillationDecisions).toEqual([
      expect.objectContaining({
        id: "candidate-approved",
        status: DISTILLATION_CANDIDATE_STATUS.APPROVED,
      }),
    ]);
    expect(dbMock.memoryDistillationCandidate.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          workspaceId: "workspace-1",
          objectType: ObjectType.MEETING,
          objectId: "meeting-1",
          status: { in: [DISTILLATION_CANDIDATE_STATUS.PENDING_REVIEW] },
        }),
        orderBy: [
          { latestSourceAt: "desc" },
          { createdAt: "desc" },
          { id: "asc" },
        ],
      }),
    );
    expect(dbMock.memoryDistillationCandidate.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          status: {
            in: [
              DISTILLATION_CANDIDATE_STATUS.APPROVED,
              DISTILLATION_CANDIDATE_STATUS.REJECTED,
              DISTILLATION_CANDIDATE_STATUS.DEFERRED,
            ],
          },
        }),
        orderBy: [
          { decidedAt: "desc" },
          { updatedAt: "desc" },
          { id: "asc" },
        ],
      }),
    );

    await getMemoryData("workspace-1", { source: "OPENCLAW" });
    expect(dbMock.memoryDistillationCandidate.findMany).toHaveBeenCalledTimes(2);
  });
});
