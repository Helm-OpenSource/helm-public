import { beforeEach, describe, expect, it, vi } from "vitest";

const { serviceGovernanceMock, ownershipMock, dbMock } = vi.hoisted(() => ({
  serviceGovernanceMock: {
    assertWorkspaceMemoryServiceAccess: vi.fn(),
  },
  ownershipMock: {
    assertWorkspaceRelatedObjectOwnership: vi.fn(),
    assertWorkspaceCommitmentOwnership: vi.fn(),
    assertWorkspaceBlockerOwnership: vi.fn(),
  },
  dbMock: {
    memoryFact: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    commitment: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
    blocker: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
    meeting: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    briefingSnapshot: {
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth/service-governance", () => ({
  assertWorkspaceMemoryServiceAccess: serviceGovernanceMock.assertWorkspaceMemoryServiceAccess,
}));

vi.mock("@/lib/auth/tenant-ownership", () => ({
  assertWorkspaceRelatedObjectOwnership: ownershipMock.assertWorkspaceRelatedObjectOwnership,
  assertWorkspaceCommitmentOwnership: ownershipMock.assertWorkspaceCommitmentOwnership,
  assertWorkspaceBlockerOwnership: ownershipMock.assertWorkspaceBlockerOwnership,
}));

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

import { createMemoryFact } from "@/lib/memory/memory-fact.service";
import { createCommitment, updateCommitmentStatus } from "@/lib/memory/commitment.service";
import { createBlocker, updateBlockerStatus } from "@/lib/memory/blocker.service";
import { generateMeetingBriefingSnapshot } from "@/lib/memory/briefing.service";
import { processMeetingMemory } from "@/lib/memory/meeting-memory-pipeline.service";

describe("memory service governance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serviceGovernanceMock.assertWorkspaceMemoryServiceAccess.mockResolvedValue(null);
    ownershipMock.assertWorkspaceRelatedObjectOwnership.mockResolvedValue(undefined);
    ownershipMock.assertWorkspaceCommitmentOwnership.mockResolvedValue(undefined);
    ownershipMock.assertWorkspaceBlockerOwnership.mockResolvedValue(undefined);
  });

  it("re-checks workspace memory capability before creating a memory fact", async () => {
    serviceGovernanceMock.assertWorkspaceMemoryServiceAccess.mockRejectedValueOnce(
      new Error("Only owner, admin, reviewer or operator can manage workspace memory facts."),
    );

    await expect(
      createMemoryFact({
        workspaceId: "workspace-1",
        actorName: "Owner",
        actorUserId: "user-1",
        actorType: "USER",
        objectType: "COMPANY",
        objectId: "company-1",
        factType: "SUMMARY",
        title: "Fact",
        content: "Fact content",
        sourceType: "MEETING_NOTE",
        sourceId: "meeting-1",
      }),
    ).rejects.toThrow("Only owner, admin, reviewer or operator can manage workspace memory facts.");

    expect(serviceGovernanceMock.assertWorkspaceMemoryServiceAccess).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      userId: "user-1",
      actorType: "USER",
      english: false,
    });
    expect(dbMock.memoryFact.create).not.toHaveBeenCalled();
  });

  it("requires related object ownership before creating a commitment", async () => {
    ownershipMock.assertWorkspaceRelatedObjectOwnership.mockRejectedValueOnce(
      new Error("opportunity not found in active workspace"),
    );

    await expect(
      createCommitment({
        workspaceId: "workspace-1",
        actorName: "Owner",
        actorUserId: "user-1",
        actorType: "USER",
        relatedOpportunityId: "opp-1",
        title: "Commitment",
        commitmentText: "Do the thing",
        sourceType: "MEETING_NOTE",
        sourceId: "meeting-1",
      }),
    ).rejects.toThrow("opportunity not found in active workspace");

    expect(serviceGovernanceMock.assertWorkspaceMemoryServiceAccess).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      userId: "user-1",
      actorType: "USER",
      english: false,
    });
    expect(ownershipMock.assertWorkspaceRelatedObjectOwnership).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      contactId: undefined,
      companyId: undefined,
      opportunityId: "opp-1",
      meetingId: undefined,
    });
    expect(dbMock.commitment.create).not.toHaveBeenCalled();
  });

  it("requires commitment ownership before updating commitment status", async () => {
    ownershipMock.assertWorkspaceCommitmentOwnership.mockRejectedValueOnce(
      new Error("commitment not found in active workspace"),
    );

    await expect(
      updateCommitmentStatus({
        workspaceId: "workspace-1",
        actorName: "Owner",
        actorUserId: "user-1",
        actorType: "USER",
        commitmentId: "commitment-1",
        status: "FULFILLED",
      }),
    ).rejects.toThrow("commitment not found in active workspace");

    expect(ownershipMock.assertWorkspaceCommitmentOwnership).toHaveBeenCalledWith(
      "workspace-1",
      "commitment-1",
    );
    expect(dbMock.commitment.findFirst).not.toHaveBeenCalled();
  });

  it("requires related object ownership before creating a blocker", async () => {
    ownershipMock.assertWorkspaceRelatedObjectOwnership.mockRejectedValueOnce(
      new Error("meeting not found in active workspace"),
    );

    await expect(
      createBlocker({
        workspaceId: "workspace-1",
        actorName: "Owner",
        actorUserId: "user-1",
        actorType: "USER",
        relatedMeetingId: "meeting-1",
        title: "Blocker",
        blockerType: "legal",
        blockerText: "Blocked",
        sourceType: "MEETING_NOTE",
        sourceId: "meeting-1",
      }),
    ).rejects.toThrow("meeting not found in active workspace");

    expect(ownershipMock.assertWorkspaceRelatedObjectOwnership).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      contactId: undefined,
      companyId: undefined,
      opportunityId: undefined,
      meetingId: "meeting-1",
    });
    expect(dbMock.blocker.create).not.toHaveBeenCalled();
  });

  it("requires blocker ownership before updating blocker status", async () => {
    ownershipMock.assertWorkspaceBlockerOwnership.mockRejectedValueOnce(
      new Error("blocker not found in active workspace"),
    );

    await expect(
      updateBlockerStatus({
        workspaceId: "workspace-1",
        actorName: "Owner",
        actorUserId: "user-1",
        actorType: "USER",
        blockerId: "blocker-1",
        status: "RESOLVED",
      }),
    ).rejects.toThrow("blocker not found in active workspace");

    expect(ownershipMock.assertWorkspaceBlockerOwnership).toHaveBeenCalledWith(
      "workspace-1",
      "blocker-1",
    );
    expect(dbMock.blocker.findFirst).not.toHaveBeenCalled();
  });

  it("re-checks workspace memory capability before generating briefing snapshots", async () => {
    serviceGovernanceMock.assertWorkspaceMemoryServiceAccess.mockRejectedValueOnce(
      new Error("只有组织负责人、管理员、运营角色或复核人可以管理工作区记忆记录。"),
    );

    await expect(
      generateMeetingBriefingSnapshot({
        workspaceId: "workspace-1",
        actorName: "Owner",
        actorUserId: "user-1",
        actorType: "USER",
        meetingId: "meeting-1",
      }),
    ).rejects.toThrow("只有组织负责人、管理员、运营角色或复核人可以管理工作区记忆记录。");

    expect(dbMock.meeting.findFirst).not.toHaveBeenCalled();
  });

  it("re-checks workspace memory capability before processing meeting memory", async () => {
    serviceGovernanceMock.assertWorkspaceMemoryServiceAccess.mockRejectedValueOnce(
      new Error("Only owner, admin, reviewer or operator can manage workspace memory facts."),
    );

    await expect(
      processMeetingMemory({
        workspaceId: "workspace-1",
        actorName: "Owner",
        actorUserId: "user-1",
        actorType: "USER",
        meetingId: "meeting-1",
      }),
    ).rejects.toThrow("Only owner, admin, reviewer or operator can manage workspace memory facts.");

    expect(dbMock.meeting.findFirst).not.toHaveBeenCalled();
  });
});
