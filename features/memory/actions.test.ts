import { beforeEach, describe, expect, it, vi } from "vitest";
import { ActorType, WorkspaceRole } from "@prisma/client";

const {
  sessionMock,
  cacheMock,
  permissionsMock,
  distillationStoreMock,
  recommendationMock,
} = vi.hoisted(() => ({
  sessionMock: {
    getCurrentWorkspaceSession: vi.fn(),
    getCurrentWorkspace: vi.fn(),
    requireCurrentUser: vi.fn(),
  },
  cacheMock: {
    revalidatePath: vi.fn(),
  },
  permissionsMock: {
    canManageMemoryFacts: vi.fn(),
    canManageWorkspaceMemory: vi.fn(),
    getMemoryFactManagementDeniedMessage: vi.fn(),
    getMemoryManagementDeniedMessage: vi.fn(),
  },
  distillationStoreMock: {
    reviewMemoryDistillationCandidate: vi.fn(),
  },
  recommendationMock: {
    generateRecommendationsForObject: vi.fn(),
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: cacheMock.revalidatePath,
}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentWorkspaceSession: sessionMock.getCurrentWorkspaceSession,
  getCurrentWorkspace: sessionMock.getCurrentWorkspace,
  requireCurrentUser: sessionMock.requireCurrentUser,
}));

vi.mock("@/lib/memory/permissions", () => ({
  canManageMemoryFacts: permissionsMock.canManageMemoryFacts,
  canManageWorkspaceMemory: permissionsMock.canManageWorkspaceMemory,
  canExportMemory: vi.fn(),
  getMemoryFactManagementDeniedMessage:
    permissionsMock.getMemoryFactManagementDeniedMessage,
  getMemoryManagementDeniedMessage:
    permissionsMock.getMemoryManagementDeniedMessage,
}));

vi.mock("@/lib/memory/distillation-candidate-store", () => ({
  reviewMemoryDistillationCandidate:
    distillationStoreMock.reviewMemoryDistillationCandidate,
}));

vi.mock("@/lib/recommendations/recommendation.service", () => ({
  generateRecommendationsForObject:
    recommendationMock.generateRecommendationsForObject,
}));

vi.mock("@/lib/db", () => ({
  db: {
    memoryEntry: { findFirst: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("@/lib/audit", () => ({
  writeAuditLog: vi.fn(),
}));

vi.mock("@/lib/billing/foundation", () => ({
  ensureWorkspaceProcessingAllowed: vi.fn(),
  recordUsageLedgerEntry: vi.fn(),
}));

vi.mock("@/lib/memory/blocker.service", () => ({
  resolveBlocker: vi.fn(),
  updateBlockerStatus: vi.fn(),
}));

vi.mock("@/lib/memory/correction.service", () => ({
  correctMemoryFact: vi.fn(),
  deleteMemoryFact: vi.fn(),
  invalidateMemoryFact: vi.fn(),
}));

vi.mock("@/lib/memory/commitment.service", () => ({
  updateCommitmentStatus: vi.fn(),
}));

vi.mock("@/lib/memory/briefing.service", () => ({
  generateCompanyBriefingSnapshot: vi.fn(),
  generateContactBriefingSnapshot: vi.fn(),
  generateMeetingBriefingSnapshot: vi.fn(),
  generateOpportunityBriefingSnapshot: vi.fn(),
}));

import { reviewMemoryDistillationCandidateAction } from "@/features/memory/actions";

describe("memory distillation candidate review action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionMock.getCurrentWorkspaceSession.mockResolvedValue({
      user: { id: "user-1", name: "Reviewer" },
      membership: { role: WorkspaceRole.REVIEWER },
      workspace: { id: "workspace-1", defaultLocale: "en-US" },
    });
    permissionsMock.canManageMemoryFacts.mockReturnValue(true);
    permissionsMock.canManageWorkspaceMemory.mockReturnValue(true);
    permissionsMock.getMemoryFactManagementDeniedMessage.mockReturnValue(
      "Only owner, admin, operator or reviewer can manage workspace memory records.",
    );
    permissionsMock.getMemoryManagementDeniedMessage.mockReturnValue(
      "Only owner, admin, operator or reviewer can manage workspace memory records.",
    );
    distillationStoreMock.reviewMemoryDistillationCandidate.mockResolvedValue({
      id: "candidate-1",
    });
  });

  it("delegates the review decision to the candidate store without recommendation refresh", async () => {
    const result = await reviewMemoryDistillationCandidateAction({
      candidateId: "candidate-1",
      decision: "approve",
      reason: "Repeated in confirmed meeting memory.",
    });

    expect(result).toEqual({ ok: true });
    expect(distillationStoreMock.reviewMemoryDistillationCandidate).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      actorName: "Reviewer",
      actorUserId: "user-1",
      actorType: ActorType.USER,
      english: true,
      sourcePage: "/memory",
      candidateId: "candidate-1",
      decision: "approve",
      reason: "Repeated in confirmed meeting memory.",
    });
    expect(cacheMock.revalidatePath).toHaveBeenCalledWith("/memory");
    expect(recommendationMock.generateRecommendationsForObject).not.toHaveBeenCalled();
  });

  it("rejects invalid decisions before calling the store", async () => {
    const result = await reviewMemoryDistillationCandidateAction({
      candidateId: "candidate-1",
      decision: "promote" as "approve",
    });

    expect(result).toEqual({
      ok: false,
      error: "Invalid candidate review decision",
    });
    expect(distillationStoreMock.reviewMemoryDistillationCandidate).not.toHaveBeenCalled();
    expect(cacheMock.revalidatePath).not.toHaveBeenCalled();
  });

  it("keeps review behind existing memory management permission", async () => {
    permissionsMock.canManageMemoryFacts.mockReturnValue(false);

    const result = await reviewMemoryDistillationCandidateAction({
      candidateId: "candidate-1",
      decision: "defer",
    });

    expect(result).toEqual({
      ok: false,
      error:
        "Only owner, admin, operator or reviewer can manage workspace memory records.",
    });
    expect(distillationStoreMock.reviewMemoryDistillationCandidate).not.toHaveBeenCalled();
  });

  it("returns a bounded error when the store rejects the workspace-scoped review", async () => {
    distillationStoreMock.reviewMemoryDistillationCandidate.mockRejectedValue(
      new Error("Memory distillation candidate not found in workspace."),
    );

    const result = await reviewMemoryDistillationCandidateAction({
      candidateId: "candidate-missing",
      decision: "reject",
    });

    expect(result).toEqual({
      ok: false,
      error: "Unable to review this distillation candidate",
    });
    expect(cacheMock.revalidatePath).not.toHaveBeenCalled();
    expect(recommendationMock.generateRecommendationsForObject).not.toHaveBeenCalled();
  });
});
