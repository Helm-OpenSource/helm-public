import { ActorType, SourceType } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  serviceGovernanceMock,
  ownershipMock,
  dbMock,
  deltaMock,
  evolutionMock,
  sharedMock,
  memoryFactMock,
} = vi.hoisted(() => ({
  serviceGovernanceMock: {
    assertWorkspaceMemoryServiceAccess: vi.fn(),
  },
  ownershipMock: {
    assertWorkspaceBlockerOwnership: vi.fn(),
    assertWorkspaceRelatedObjectOwnership: vi.fn(),
  },
  dbMock: {
    blocker: {
      create: vi.fn(),
    },
  },
  deltaMock: {
    recordBlockerDelta: vi.fn(),
  },
  evolutionMock: {
    refreshEvolutionState: vi.fn(),
  },
  sharedMock: {
    writeMemoryAuditAndEvent: vi.fn(),
  },
  memoryFactMock: {
    createMemoryFact: vi.fn(),
  },
}));

vi.mock("@/lib/auth/service-governance", () => ({
  assertWorkspaceMemoryServiceAccess: serviceGovernanceMock.assertWorkspaceMemoryServiceAccess,
}));

vi.mock("@/lib/auth/tenant-ownership", () => ({
  assertWorkspaceBlockerOwnership: ownershipMock.assertWorkspaceBlockerOwnership,
  assertWorkspaceRelatedObjectOwnership: ownershipMock.assertWorkspaceRelatedObjectOwnership,
}));

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

vi.mock("@/lib/evolution/delta-event.service", () => ({
  recordBlockerDelta: deltaMock.recordBlockerDelta,
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

vi.mock("@/lib/memory/memory-fact.service", () => ({
  createMemoryFact: memoryFactMock.createMemoryFact,
}));

import { createBlocker } from "@/lib/memory/blocker.service";

describe("blocker service seed batch suppression", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serviceGovernanceMock.assertWorkspaceMemoryServiceAccess.mockResolvedValue(undefined);
    ownershipMock.assertWorkspaceRelatedObjectOwnership.mockResolvedValue(undefined);
    dbMock.blocker.create.mockResolvedValue({
      id: "blocker-1",
      workspaceId: "workspace-1",
      title: "Budget unclear",
      blockerType: "budget",
      blockerText: "Budget remains unclear.",
      relatedOpportunityId: "opp-1",
      relatedContactId: null,
      severity: 80,
      sourceType: SourceType.MEETING_NOTE,
    });
    sharedMock.writeMemoryAuditAndEvent.mockResolvedValue(undefined);
    memoryFactMock.createMemoryFact.mockResolvedValue(undefined);
    deltaMock.recordBlockerDelta.mockResolvedValue(undefined);
    evolutionMock.refreshEvolutionState.mockResolvedValue(undefined);
  });

  it("skips evolution refresh when suppressEvolutionRefresh is true", async () => {
    await createBlocker({
      workspaceId: "workspace-1",
      actorName: "Seeder",
      actorUserId: "user-1",
      actorType: ActorType.SYSTEM,
      sourcePage: "/seed",
      suppressEvolutionRefresh: true,
      title: "Budget unclear",
      blockerType: "budget",
      blockerText: "Budget remains unclear.",
      sourceType: SourceType.MEETING_NOTE,
      sourceId: "meeting-1",
      relatedOpportunityId: "opp-1",
    });

    expect(deltaMock.recordBlockerDelta).toHaveBeenCalled();
    expect(evolutionMock.refreshEvolutionState).not.toHaveBeenCalled();
  });
});
