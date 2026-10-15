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
    contact: { findMany: vi.fn() },
    company: { findMany: vi.fn() },
    opportunity: { findMany: vi.fn() },
    meeting: { findMany: vi.fn() },
    emailThread: { findMany: vi.fn() },
    emailMessage: { findMany: vi.fn() },
    meetingNote: { findMany: vi.fn() },
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
  attachMemoryFactContext,
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
  dbMock.contact.findMany.mockResolvedValue([]);
  dbMock.company.findMany.mockResolvedValue([]);
  dbMock.opportunity.findMany.mockResolvedValue([]);
  dbMock.meeting.findMany.mockResolvedValue([]);
  dbMock.emailThread.findMany.mockResolvedValue([]);
  dbMock.emailMessage.findMany.mockResolvedValue([]);
  dbMock.meetingNote.findMany.mockResolvedValue([]);
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
          status: {
            in: ["PENDING_VERIFICATION", "VERIFIED", "PROMOTED", "REJECTED"],
          },
        }),
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    );
  });

  // Write-on-verify (2026-08-22 second-round ruling): a "verify" decision
  // now lands the candidate on PROMOTED (memory written), not VERIFIED —
  // PROMOTED must be included in the query's status IN set so newly
  // decided rows still surface as a memberSignalDecisions entry.
  it("includes a PROMOTED candidate in memberSignalDecisions", async () => {
    const createdAt = new Date("2026-08-22T00:00:00.000Z");
    dbMock.memoryCandidate.findMany
      .mockResolvedValueOnce([]) // reflection candidates
      .mockResolvedValueOnce([
        {
          id: "member-candidate-promoted",
          candidateKey: "member-signal-memory:promoted",
          summary: "Member reported a signed renewal.",
          status: "PROMOTED",
          reviewerNote: null,
          sourceVerification: JSON.stringify({
            artifactReviewId: "review-3",
            reviewedByUserId: "user-1",
            reviewStatus: "CONFIRMED",
          }),
          sourceStatus: JSON.stringify({
            taint: "untrusted",
            evaluationUseProhibited: true,
            provenance: {
              memberRef: "member-3",
              signalReceiptRef: "receipt-3",
              gatewaySessionRef: "mgws-3",
            },
          }),
          evidenceRefs: null,
          createdAt,
        },
      ]);

    const data = await getMemoryData("workspace-1");

    expect(data.memberSignalDecisions).toEqual([
      expect.objectContaining({
        id: "member-candidate-promoted",
        status: "PROMOTED",
      }),
    ]);
    expect(dbMock.memoryCandidate.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          status: {
            in: ["PENDING_VERIFICATION", "VERIFIED", "PROMOTED", "REJECTED"],
          },
        }),
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

describe("memory fact object and source context", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDbMocks();
  });

  const fact = (
    overrides: Partial<{
      id: string;
      objectType: string;
      objectId: string;
      sourceType: string;
      sourceId: string;
    }>,
  ) => ({
    id: "fact-1",
    objectType: "CONTACT",
    objectId: "contact-1",
    sourceType: "SYSTEM_INFERENCE",
    sourceId: "inference-1",
    ...overrides,
  });

  it("does not query anything when there are no facts", async () => {
    await expect(attachMemoryFactContext("workspace-1", [])).resolves.toEqual([]);
    expect(dbMock.contact.findMany).not.toHaveBeenCalled();
    expect(dbMock.emailMessage.findMany).not.toHaveBeenCalled();
  });

  it("attaches the object's own name and page instead of its type", async () => {
    dbMock.contact.findMany.mockResolvedValue([{ id: "contact-1", name: "Vivian Chen" }]);
    dbMock.company.findMany.mockResolvedValue([{ id: "company-1", name: "Atlas AI" }]);
    dbMock.opportunity.findMany.mockResolvedValue([{ id: "opp-1", title: "Atlas renewal" }]);

    const [contactFact, companyFact, opportunityFact, missingFact] =
      await attachMemoryFactContext("workspace-1", [
        fact({}),
        fact({ id: "fact-2", objectType: "COMPANY", objectId: "company-1" }),
        fact({ id: "fact-3", objectType: "OPPORTUNITY", objectId: "opp-1" }),
        fact({ id: "fact-4", objectType: "CONTACT", objectId: "contact-gone" }),
      ]);

    expect(contactFact.object).toEqual({ name: "Vivian Chen", href: "/contacts/contact-1" });
    expect(companyFact.object).toEqual({ name: "Atlas AI", href: "/companies/company-1" });
    expect(opportunityFact.object).toEqual({
      name: "Atlas renewal",
      href: "/opportunities?opportunityId=opp-1",
    });
    expect(missingFact.object).toBeNull();
    // Every lookup is scoped to the workspace and selects only what renders.
    expect(dbMock.contact.findMany).toHaveBeenCalledWith({
      where: { workspaceId: "workspace-1", id: { in: ["contact-1", "contact-gone"] } },
      select: { id: true, name: true },
    });
  });

  it("resolves an email message source to its original body, scoped through the thread", async () => {
    const sentAt = new Date("2026-10-14T09:00:00Z");
    dbMock.emailMessage.findMany.mockResolvedValue([
      {
        id: "message-1",
        sender: "Vivian Chen",
        senderEmail: "vivian@atlas.test",
        body: "We need the security review before Friday.",
        sentAt,
        threadId: "thread-1",
        thread: { subject: "Security review" },
      },
    ]);

    const [withSource] = await attachMemoryFactContext("workspace-1", [
      fact({ sourceType: "EMAIL_MESSAGE", sourceId: "message-1" }),
    ]);

    expect(withSource.source).toEqual({
      kind: "EMAIL_MESSAGE",
      title: "Security review",
      author: "Vivian Chen",
      occurredAt: sentAt,
      text: "We need the security review before Friday.",
      href: "/inbox/thread-1",
    });
    expect(dbMock.emailMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["message-1"] }, thread: { workspaceId: "workspace-1" } },
      }),
    );
  });

  it("resolves a meeting-note source by meeting id or note id, falling back to the meeting link", async () => {
    const startsAt = new Date("2026-10-13T02:00:00Z");
    dbMock.meeting.findMany.mockResolvedValue([
      { id: "meeting-1", title: "Atlas weekly", startsAt },
      { id: "meeting-2", title: "Atlas kickoff", startsAt },
    ]);
    dbMock.meetingNote.findMany.mockResolvedValue([
      {
        id: "note-1",
        meetingId: "meeting-1",
        summary: "Budget approved; legal review next.",
        keyDecisions: null,
        liveTranscript: null,
        updatedAt: startsAt,
        meeting: { title: "Atlas weekly", startsAt },
      },
    ]);

    const [byMeetingId, byNoteId, noteMissing, otherSource] = await attachMemoryFactContext(
      "workspace-1",
      [
        fact({ sourceType: "MEETING_NOTE", sourceId: "meeting-1" }),
        fact({ id: "fact-2", sourceType: "MEETING_NOTE", sourceId: "note-1" }),
        fact({ id: "fact-3", sourceType: "MEETING_NOTE", sourceId: "meeting-2" }),
        fact({ id: "fact-4", sourceType: "CSV_IMPORT", sourceId: "row-9" }),
      ],
    );

    expect(byMeetingId.source).toMatchObject({
      kind: "MEETING_NOTE",
      title: "Atlas weekly",
      text: "Budget approved; legal review next.",
      href: "/meetings/meeting-1",
    });
    expect(byNoteId.source).toMatchObject({
      text: "Budget approved; legal review next.",
      href: "/meetings/meeting-1",
    });
    expect(noteMissing.source).toMatchObject({
      kind: "MEETING_NOTE",
      title: "Atlas kickoff",
      text: null,
      href: "/meetings/meeting-2",
    });
    // No resolver for CSV imports: the timeline shows the source type only.
    expect(otherSource.source).toBeNull();
    expect(dbMock.meetingNote.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          workspaceId: "workspace-1",
          OR: [
            { id: { in: ["meeting-1", "note-1", "meeting-2"] } },
            { meetingId: { in: ["meeting-1", "note-1", "meeting-2"] } },
          ],
        },
      }),
    );
  });
});
