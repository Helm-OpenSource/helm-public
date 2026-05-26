import { ActorType, CommitmentStatus, SourceType } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  serviceGovernanceMock,
  ownershipMock,
  dbMock,
  deltaMock,
  evolutionMock,
  sharedMock,
} = vi.hoisted(() => ({
  serviceGovernanceMock: {
    assertWorkspaceMemoryServiceAccess: vi.fn(),
  },
  ownershipMock: {
    assertWorkspaceCommitmentOwnership: vi.fn(),
    assertWorkspaceRelatedObjectOwnership: vi.fn(),
  },
  dbMock: {
    commitment: {
      create: vi.fn(),
    },
  },
  deltaMock: {
    recordCommitmentDelta: vi.fn(),
  },
  evolutionMock: {
    refreshEvolutionState: vi.fn(),
  },
  sharedMock: {
    writeMemoryAuditAndEvent: vi.fn(),
  },
}));

vi.mock("@/lib/auth/service-governance", () => ({
  assertWorkspaceMemoryServiceAccess: serviceGovernanceMock.assertWorkspaceMemoryServiceAccess,
}));

vi.mock("@/lib/auth/tenant-ownership", () => ({
  assertWorkspaceCommitmentOwnership: ownershipMock.assertWorkspaceCommitmentOwnership,
  assertWorkspaceRelatedObjectOwnership: ownershipMock.assertWorkspaceRelatedObjectOwnership,
}));

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

vi.mock("@/lib/evolution/delta-event.service", () => ({
  recordCommitmentDelta: deltaMock.recordCommitmentDelta,
}));

vi.mock("@/lib/evolution/pattern-detection.service", () => ({
  refreshEvolutionState: evolutionMock.refreshEvolutionState,
}));

vi.mock("@/lib/memory/shared", async () => {
  const actual = await vi.importActual<typeof import("@/lib/memory/shared")>("@/lib/memory/shared");
  return {
    ...actual,
    writeMemoryAuditAndEvent: sharedMock.writeMemoryAuditAndEvent,
  };
});

import { createCommitment } from "@/lib/memory/commitment.service";

describe("commitment service seed batch suppression", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serviceGovernanceMock.assertWorkspaceMemoryServiceAccess.mockResolvedValue(undefined);
    ownershipMock.assertWorkspaceRelatedObjectOwnership.mockResolvedValue(undefined);
    dbMock.commitment.create.mockResolvedValue({
      id: "commitment-1",
      workspaceId: "workspace-1",
      title: "Send proposal",
      commitmentText: "Send proposal by Wednesday.",
      relatedOpportunityId: "opp-1",
      relatedContactId: null,
      dueDate: null,
      status: CommitmentStatus.OPEN,
    });
    sharedMock.writeMemoryAuditAndEvent.mockResolvedValue(undefined);
    deltaMock.recordCommitmentDelta.mockResolvedValue(undefined);
    evolutionMock.refreshEvolutionState.mockResolvedValue(undefined);
  });

  it("skips evolution refresh when suppressEvolutionRefresh is true", async () => {
    await createCommitment({
      workspaceId: "workspace-1",
      actorName: "Seeder",
      actorUserId: "user-1",
      actorType: ActorType.SYSTEM,
      sourcePage: "/seed",
      suppressEvolutionRefresh: true,
      title: "Send proposal",
      commitmentText: "Send proposal by Wednesday.",
      sourceType: SourceType.MEETING_NOTE,
      sourceId: "meeting-1",
      relatedOpportunityId: "opp-1",
    });

    expect(deltaMock.recordCommitmentDelta).toHaveBeenCalled();
    expect(evolutionMock.refreshEvolutionState).not.toHaveBeenCalled();
  });
});
