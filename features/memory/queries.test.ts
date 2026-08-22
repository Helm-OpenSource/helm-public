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
  buildEvidenceSourceClasses: vi.fn(),
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
      NOT: {
        OR: [
          { source: { startsWith: "OPENCLAW:" } },
          { source: { startsWith: "QODERWORK:" } },
        ],
      },
    });
  });

  it("builds ALL filter", () => {
    expect(buildMemoryEntrySourceWhere("ALL")).toEqual({
      NOT: {
        OR: [
          { source: { startsWith: "OPENCLAW:" } },
          { source: { startsWith: "QODERWORK:" } },
        ],
      },
    });
  });

  it("builds QODERWORK external-candidate-only filter", () => {
    expect(buildMemoryEntrySourceWhere("QODERWORK")).toEqual({
      source: { startsWith: "QODERWORK:" },
    });
  });

  it("defaults unknown source filters to ALL without including external formal memory", () => {
    expect(buildMemoryEntrySourceWhere("UNKNOWN")).toEqual({
      NOT: {
        OR: [
          { source: { startsWith: "OPENCLAW:" } },
          { source: { startsWith: "QODERWORK:" } },
        ],
      },
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

describe("member signal memory candidate query contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDbMocks();
  });

  // db.memoryCandidate.findMany now backs TWO different queries inside
  // getMemoryData (reflection candidates, called first, then member-
  // anchored candidates, called second) — a single mockResolvedValue would
  // return the same rows to both, so this test sequences them explicitly
  // with mockResolvedValueOnce rather than relying on the shared default.
  it("splits member-anchored candidates into memberSignalPending and memberSignalDecisions by status", async () => {
    const createdAt = new Date("2026-08-19T00:00:00.000Z");
    dbMock.memoryCandidate.findMany
      .mockResolvedValueOnce([]) // reflection candidates (runtimeSession-anchored) — not under test here
      .mockResolvedValueOnce([
        {
          id: "member-candidate-pending",
          candidateKey: "member-signal-memory:pending",
          summary: "Member reported a blocked renewal.",
          status: "PENDING_VERIFICATION",
          reviewerNote: null,
          sourceVerification: JSON.stringify({
            artifactReviewId: "review-1",
            reviewedByUserId: "user-1",
            reviewStatus: "CONFIRMED",
          }),
          sourceStatus: JSON.stringify({
            taint: "untrusted",
            evaluationUseProhibited: true,
            provenance: {
              memberRef: "member-1",
              signalReceiptRef: "receipt-1",
              gatewaySessionRef: "mgws-1",
            },
          }),
          evidenceRefs: null,
          createdAt,
        },
        {
          id: "member-candidate-verified",
          candidateKey: "member-signal-memory:verified",
          summary: "Member confirmed a follow-up call.",
          status: "VERIFIED",
          reviewerNote: "Confirmed with the account owner.",
          sourceVerification: JSON.stringify({
            artifactReviewId: "review-2",
            reviewedByUserId: "user-1",
            reviewStatus: "CONFIRMED",
          }),
          sourceStatus: JSON.stringify({
            taint: "untrusted",
            evaluationUseProhibited: true,
            provenance: {
              memberRef: "member-2",
              signalReceiptRef: "receipt-2",
              gatewaySessionRef: "mgws-2",
            },
          }),
          evidenceRefs: null,
          createdAt,
        },
      ]);

    const data = await getMemoryData("workspace-1");

    expect(data.memberSignalPending).toEqual([
      expect.objectContaining({
        id: "member-candidate-pending",
        status: "PENDING_VERIFICATION",
        corrupt: false,
        taint: "untrusted",
        evaluationUseProhibited: true,
        provenance: {
          memberRef: "member-1",
          signalReceiptRef: "receipt-1",
          gatewaySessionRef: "mgws-1",
        },
      }),
    ]);
    expect(data.memberSignalDecisions).toEqual([
      expect.objectContaining({
        id: "member-candidate-verified",
        status: "VERIFIED",
        reviewerNote: "Confirmed with the account owner.",
      }),
    ]);

    expect(dbMock.memoryCandidate.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          workspaceId: "workspace-1",
          memberGatewaySessionRef: { not: null },
          status: { in: ["PENDING_VERIFICATION", "VERIFIED", "REJECTED"] },
        }),
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    );
  });

  it("marks a candidate corrupt when sourceStatus fails to parse, withholding taint/evaluationUseProhibited/provenance", async () => {
    const createdAt = new Date("2026-08-19T00:00:00.000Z");
    dbMock.memoryCandidate.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "member-candidate-corrupt",
          candidateKey: "member-signal-memory:corrupt",
          summary: "Tampered row.",
          status: "PENDING_VERIFICATION",
          reviewerNote: null,
          sourceVerification: "{}",
          sourceStatus: "not-json",
          evidenceRefs: null,
          createdAt,
        },
      ]);

    const data = await getMemoryData("workspace-1");

    expect(data.memberSignalPending).toEqual([
      expect.objectContaining({
        id: "member-candidate-corrupt",
        corrupt: true,
        taint: null,
        evaluationUseProhibited: null,
        provenance: null,
      }),
    ]);
  });
});
