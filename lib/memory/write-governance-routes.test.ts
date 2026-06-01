import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  sessionMock,
  permissionsMock,
  ownershipMock,
  memoryFactServiceMock,
  correctionServiceMock,
  meetingMemoryPipelineMock,
  commitmentServiceMock,
  blockerServiceMock,
} = vi.hoisted(() => ({
  sessionMock: {
    getCurrentWorkspaceSession: vi.fn(),
    requireCurrentUser: vi.fn(),
    getCurrentWorkspace: vi.fn(),
  },
  permissionsMock: {
    canManageWorkspaceMemory: vi.fn(),
    getMemoryManagementDeniedMessage: vi.fn(),
  },
  ownershipMock: {
    assertWorkspaceObjectOwnership: vi.fn(),
    assertWorkspaceMemoryFactOwnership: vi.fn(),
    assertWorkspaceMeetingOwnership: vi.fn(),
    assertWorkspaceCommitmentOwnership: vi.fn(),
    assertWorkspaceBlockerOwnership: vi.fn(),
    assertWorkspaceRelatedObjectOwnership: vi.fn(),
    isWorkspaceOwnershipError: vi.fn(),
  },
  memoryFactServiceMock: {
    createMemoryFact: vi.fn(),
    getMemoryFacts: vi.fn(),
  },
  correctionServiceMock: {
    confirmMemoryFact: vi.fn(),
  },
  meetingMemoryPipelineMock: {
    processMeetingMemory: vi.fn(),
  },
  commitmentServiceMock: {
    createCommitment: vi.fn(),
    getCommitments: vi.fn(),
    updateCommitmentStatus: vi.fn(),
  },
  blockerServiceMock: {
    createBlocker: vi.fn(),
    getBlockers: vi.fn(),
    resolveBlocker: vi.fn(),
    updateBlockerStatus: vi.fn(),
  },
}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentWorkspaceSession: sessionMock.getCurrentWorkspaceSession,
  requireCurrentUser: sessionMock.requireCurrentUser,
  getCurrentWorkspace: sessionMock.getCurrentWorkspace,
}));

vi.mock("@/lib/memory/permissions", () => ({
  canManageWorkspaceMemory: permissionsMock.canManageWorkspaceMemory,
  getMemoryManagementDeniedMessage: permissionsMock.getMemoryManagementDeniedMessage,
}));

vi.mock("@/lib/auth/tenant-ownership", () => ({
  assertWorkspaceObjectOwnership: ownershipMock.assertWorkspaceObjectOwnership,
  assertWorkspaceMemoryFactOwnership: ownershipMock.assertWorkspaceMemoryFactOwnership,
  assertWorkspaceMeetingOwnership: ownershipMock.assertWorkspaceMeetingOwnership,
  assertWorkspaceCommitmentOwnership: ownershipMock.assertWorkspaceCommitmentOwnership,
  assertWorkspaceBlockerOwnership: ownershipMock.assertWorkspaceBlockerOwnership,
  assertWorkspaceRelatedObjectOwnership: ownershipMock.assertWorkspaceRelatedObjectOwnership,
  isWorkspaceOwnershipError: ownershipMock.isWorkspaceOwnershipError,
}));

vi.mock("@/lib/memory/memory-fact.service", () => ({
  createMemoryFact: memoryFactServiceMock.createMemoryFact,
  getMemoryFacts: memoryFactServiceMock.getMemoryFacts,
}));

vi.mock("@/lib/memory/correction.service", () => ({
  confirmMemoryFact: correctionServiceMock.confirmMemoryFact,
}));

vi.mock("@/lib/memory/meeting-memory-pipeline.service", () => ({
  processMeetingMemory: meetingMemoryPipelineMock.processMeetingMemory,
}));

vi.mock("@/lib/memory/commitment.service", () => ({
  createCommitment: commitmentServiceMock.createCommitment,
  getCommitments: commitmentServiceMock.getCommitments,
  updateCommitmentStatus: commitmentServiceMock.updateCommitmentStatus,
}));

vi.mock("@/lib/memory/blocker.service", () => ({
  createBlocker: blockerServiceMock.createBlocker,
  getBlockers: blockerServiceMock.getBlockers,
  resolveBlocker: blockerServiceMock.resolveBlocker,
  updateBlockerStatus: blockerServiceMock.updateBlockerStatus,
}));

import { POST as createMemoryFactRoute } from "@/app/api/memory/facts/route";
import { POST as confirmMemoryFactRoute } from "@/app/api/memory/facts/[id]/confirm/route";
import { POST as processMeetingMemoryRoute } from "@/app/api/memory/meetings/[meetingId]/process/route";
import { POST as processImportedMeetingNotesRoute } from "@/app/api/memory/imports/meeting-notes/process/route";
import { POST as createCommitmentRoute } from "@/app/api/commitments/route";
import { POST as updateCommitmentStatusRoute } from "@/app/api/commitments/[id]/status/route";
import { POST as createBlockerRoute } from "@/app/api/blockers/route";
import { POST as resolveBlockerRoute } from "@/app/api/blockers/[id]/resolve/route";
import { POST as updateBlockerStatusRoute } from "@/app/api/blockers/[id]/status/route";
import { POST as llmMeetingMemoryRoute } from "@/app/api/llm/meetings/[meetingId]/process-memory/route";

describe("memory write governance routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionMock.getCurrentWorkspaceSession.mockResolvedValue({
      user: { id: "user-1", name: "Owner" },
      membership: { role: "MEMBER" },
      workspace: { id: "workspace-1", defaultLocale: "en-US" },
    });
    sessionMock.requireCurrentUser.mockResolvedValue({ id: "user-1", name: "Owner" });
    sessionMock.getCurrentWorkspace.mockResolvedValue({ id: "workspace-1", defaultLocale: "en-US" });
    permissionsMock.getMemoryManagementDeniedMessage.mockReturnValue("denied");
    ownershipMock.assertWorkspaceObjectOwnership.mockResolvedValue(undefined);
    ownershipMock.assertWorkspaceMemoryFactOwnership.mockResolvedValue(undefined);
    ownershipMock.assertWorkspaceMeetingOwnership.mockResolvedValue(undefined);
    ownershipMock.assertWorkspaceCommitmentOwnership.mockResolvedValue(undefined);
    ownershipMock.assertWorkspaceBlockerOwnership.mockResolvedValue(undefined);
    ownershipMock.assertWorkspaceRelatedObjectOwnership.mockResolvedValue(undefined);
    ownershipMock.isWorkspaceOwnershipError.mockImplementation(
      (error: unknown) =>
        error instanceof Error &&
        [
          "meeting not found in active workspace",
          "memory fact not found in active workspace",
          "commitment not found in active workspace",
          "blocker not found in active workspace",
          "contact not found in active workspace",
          "company not found in active workspace",
          "opportunity not found in active workspace",
        ].includes(error.message),
    );
  });

  it("rejects memory-domain write routes without workspace memory capability", async () => {
    permissionsMock.canManageWorkspaceMemory.mockReturnValue(false);

    const responses = await Promise.all([
      createMemoryFactRoute(
        new Request("http://localhost/api/memory/facts", {
          method: "POST",
          body: JSON.stringify({
            objectType: "MEETING",
            objectId: "meeting-1",
            factType: "SUMMARY",
            title: "Fact",
            content: "content",
            sourceType: "MEETING_NOTE",
            sourceId: "manual-1",
          }),
          headers: { "content-type": "application/json" },
        }),
      ),
      confirmMemoryFactRoute(new Request("http://localhost/api/memory/facts/fact-1/confirm", { method: "POST" }), {
        params: Promise.resolve({ id: "fact-1" }),
      }),
      processMeetingMemoryRoute(
        new Request("http://localhost/api/memory/meetings/meeting-1/process", {
          method: "POST",
          body: JSON.stringify({ force: true }),
          headers: { "content-type": "application/json" },
        }),
        {
          params: Promise.resolve({ meetingId: "meeting-1" }),
        },
      ),
      processImportedMeetingNotesRoute(
        new Request("http://localhost/api/memory/imports/meeting-notes/process", {
          method: "POST",
          body: JSON.stringify({ meetingId: "meeting-1", force: true }),
          headers: { "content-type": "application/json" },
        }),
      ),
      createCommitmentRoute(
        new Request("http://localhost/api/commitments", {
          method: "POST",
          body: JSON.stringify({
            title: "Commitment",
            commitmentText: "Do the thing",
            sourceType: "MEETING_NOTE",
            sourceId: "meeting-1",
          }),
          headers: { "content-type": "application/json" },
        }),
      ),
      updateCommitmentStatusRoute(
        new Request("http://localhost/api/commitments/commitment-1/status", {
          method: "POST",
          body: JSON.stringify({ status: "OPEN" }),
          headers: { "content-type": "application/json" },
        }),
        {
          params: Promise.resolve({ id: "commitment-1" }),
        },
      ),
      createBlockerRoute(
        new Request("http://localhost/api/blockers", {
          method: "POST",
          body: JSON.stringify({
            title: "Blocker",
            blockerType: "RISK",
            blockerText: "Blocked",
            sourceType: "MEETING_NOTE",
            sourceId: "meeting-1",
            severity: 80,
          }),
          headers: { "content-type": "application/json" },
        }),
      ),
      resolveBlockerRoute(
        new Request("http://localhost/api/blockers/blocker-1/resolve", {
          method: "POST",
          body: JSON.stringify({ resolutionNote: "resolved" }),
          headers: { "content-type": "application/json" },
        }),
        {
          params: Promise.resolve({ id: "blocker-1" }),
        },
      ),
      updateBlockerStatusRoute(
        new Request("http://localhost/api/blockers/blocker-1/status", {
          method: "POST",
          body: JSON.stringify({ status: "OPEN" }),
          headers: { "content-type": "application/json" },
        }),
        {
          params: Promise.resolve({ id: "blocker-1" }),
        },
      ),
      llmMeetingMemoryRoute(
        new Request("http://localhost/api/llm/meetings/meeting-1/process-memory", { method: "POST" }),
        {
          params: Promise.resolve({ meetingId: "meeting-1" }),
        },
      ),
    ]);

    for (const response of responses) {
      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toMatchObject({
        success: false,
      });
    }

    expect(memoryFactServiceMock.createMemoryFact).not.toHaveBeenCalled();
    expect(correctionServiceMock.confirmMemoryFact).not.toHaveBeenCalled();
    expect(meetingMemoryPipelineMock.processMeetingMemory).not.toHaveBeenCalled();
    expect(commitmentServiceMock.createCommitment).not.toHaveBeenCalled();
    expect(commitmentServiceMock.updateCommitmentStatus).not.toHaveBeenCalled();
    expect(blockerServiceMock.createBlocker).not.toHaveBeenCalled();
    expect(blockerServiceMock.resolveBlocker).not.toHaveBeenCalled();
    expect(blockerServiceMock.updateBlockerStatus).not.toHaveBeenCalled();
  });

  it("returns 400 on invalid JSON payload once capability is present", async () => {
    permissionsMock.canManageWorkspaceMemory.mockReturnValue(true);

    const response = await createCommitmentRoute(
      new Request("http://localhost/api/commitments", {
        method: "POST",
        body: "{",
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      errorCode: "INVALID_REQUEST",
    });
    expect(commitmentServiceMock.createCommitment).not.toHaveBeenCalled();
  });

  it("uses workspace default locale for commitment status fallback errors", async () => {
    permissionsMock.canManageWorkspaceMemory.mockReturnValue(true);
    commitmentServiceMock.updateCommitmentStatus.mockRejectedValue(null);

    const response = await updateCommitmentStatusRoute(
      new Request("http://localhost/api/commitments/commitment-1/status", {
        method: "POST",
        body: JSON.stringify({ status: "IN_PROGRESS" }),
        headers: { "content-type": "application/json" },
      }),
      {
        params: Promise.resolve({ id: "commitment-1" }),
      },
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      errorCode: "UPDATE_FAILED",
      message: "Failed to update commitment",
    });
    expect(ownershipMock.assertWorkspaceCommitmentOwnership).toHaveBeenCalledWith(
      "workspace-1",
      "commitment-1",
    );
  });

  it("uses workspace default locale for blocker create fallback errors", async () => {
    permissionsMock.canManageWorkspaceMemory.mockReturnValue(true);
    blockerServiceMock.createBlocker.mockRejectedValue(null);

    const response = await createBlockerRoute(
      new Request("http://localhost/api/blockers", {
        method: "POST",
        body: JSON.stringify({
          title: "Blocker",
          blockerType: "RISK",
          blockerText: "Blocked",
          sourceType: "MEETING_NOTE",
          sourceId: "meeting-1",
        }),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      errorCode: "CREATE_FAILED",
      message: "Failed to create blocker",
    });
    expect(ownershipMock.assertWorkspaceRelatedObjectOwnership).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      contactId: undefined,
      companyId: undefined,
      opportunityId: undefined,
      meetingId: undefined,
    });
  });

  it("allows a write path once capability is present", async () => {
    permissionsMock.canManageWorkspaceMemory.mockReturnValue(true);
    memoryFactServiceMock.createMemoryFact.mockResolvedValue({
      id: "fact-1",
      objectType: "MEETING",
      objectId: "meeting-1",
      factType: "SUMMARY",
      title: "Fact",
      status: "ACTIVE",
    });

    const response = await createMemoryFactRoute(
      new Request("http://localhost/api/memory/facts", {
        method: "POST",
        body: JSON.stringify({
          objectType: "MEETING",
          objectId: "meeting-1",
          factType: "SUMMARY",
          title: "Fact",
          content: "content",
          sourceType: "MEETING_NOTE",
          sourceId: "manual-1",
        }),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        id: "fact-1",
      },
    });
    expect(memoryFactServiceMock.createMemoryFact).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "workspace-1",
        actorUserId: "user-1",
      }),
    );
    expect(ownershipMock.assertWorkspaceObjectOwnership).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      objectType: "MEETING",
      objectId: "meeting-1",
    });
  });
});
