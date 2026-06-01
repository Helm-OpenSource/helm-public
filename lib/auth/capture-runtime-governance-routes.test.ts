import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  sessionMock,
  governanceMock,
  ownershipMock,
  billingMock,
  captureServiceMock,
  runtimeMock,
} = vi.hoisted(() => ({
  sessionMock: {
    getCurrentWorkspaceSession: vi.fn(),
  },
  governanceMock: {
    canManageWorkspaceCaptureSessions: vi.fn(),
    canManageWorkspaceRuntime: vi.fn(),
    canReviewWorkspaceRuntime: vi.fn(),
    getCaptureManagementDeniedMessage: vi.fn(),
    getRuntimeManagementDeniedMessage: vi.fn(),
    getRuntimeReviewDeniedMessage: vi.fn(),
  },
  ownershipMock: {
    assertWorkspaceObjectOwnership: vi.fn(),
    assertWorkspaceMeetingOwnership: vi.fn(),
    assertWorkspaceMemoryCandidateOwnership: vi.fn(),
    isWorkspaceOwnershipError: vi.fn(),
  },
  billingMock: {
    ensureWorkspaceProcessingAllowed: vi.fn(),
    recordUsageLedgerEntry: vi.fn(),
  },
  captureServiceMock: {
    startCaptureSession: vi.fn(),
  },
  runtimeMock: {
    acceptReflectionCandidate: vi.fn(),
    dismissReflectionCandidate: vi.fn(),
    ingestMeetingEndedRuntime: vi.fn(),
  },
}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentWorkspaceSession: sessionMock.getCurrentWorkspaceSession,
}));

vi.mock("@/lib/auth/capture-runtime-governance", () => ({
  canManageWorkspaceCaptureSessions: governanceMock.canManageWorkspaceCaptureSessions,
  canManageWorkspaceRuntime: governanceMock.canManageWorkspaceRuntime,
  canReviewWorkspaceRuntime: governanceMock.canReviewWorkspaceRuntime,
  getCaptureManagementDeniedMessage: governanceMock.getCaptureManagementDeniedMessage,
  getRuntimeManagementDeniedMessage: governanceMock.getRuntimeManagementDeniedMessage,
  getRuntimeReviewDeniedMessage: governanceMock.getRuntimeReviewDeniedMessage,
}));

vi.mock("@/lib/auth/tenant-ownership", () => ({
  assertWorkspaceObjectOwnership: ownershipMock.assertWorkspaceObjectOwnership,
  assertWorkspaceMeetingOwnership: ownershipMock.assertWorkspaceMeetingOwnership,
  assertWorkspaceMemoryCandidateOwnership: ownershipMock.assertWorkspaceMemoryCandidateOwnership,
  isWorkspaceOwnershipError: ownershipMock.isWorkspaceOwnershipError,
}));

vi.mock("@/lib/billing/foundation", () => ({
  ensureWorkspaceProcessingAllowed: billingMock.ensureWorkspaceProcessingAllowed,
  recordUsageLedgerEntry: billingMock.recordUsageLedgerEntry,
}));

vi.mock("@/lib/conversation-capture/capture-session.service", () => ({
  startCaptureSession: captureServiceMock.startCaptureSession,
}));

vi.mock("@/lib/helm-v2/meeting-action-pack-runtime", () => ({
  ingestMeetingEndedRuntime: runtimeMock.ingestMeetingEndedRuntime,
}));

vi.mock("@/lib/helm-v2/runtime-upgrade", () => ({
  acceptReflectionCandidate: runtimeMock.acceptReflectionCandidate,
  dismissReflectionCandidate: runtimeMock.dismissReflectionCandidate,
}));

import { POST as startCaptureRoute } from "@/app/api/conversation-capture/start/route";
import { POST as acceptReflectionCandidateRoute } from "@/app/api/helm-v2/runtime/reflection/candidates/[id]/accept/route";
import { POST as dismissReflectionCandidateRoute } from "@/app/api/helm-v2/runtime/reflection/candidates/[id]/dismiss/route";
import { POST as runtimeMeetingEndedRoute } from "@/app/api/runtime/events/meeting-ended/route";

describe("capture/runtime governance routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionMock.getCurrentWorkspaceSession.mockResolvedValue({
      user: { id: "user-1", name: "Owner" },
      membership: { role: "MEMBER" },
      workspace: { id: "workspace-1", defaultLocale: "en-US" },
    });
    governanceMock.canManageWorkspaceCaptureSessions.mockReturnValue(false);
    governanceMock.canManageWorkspaceRuntime.mockReturnValue(false);
    governanceMock.canReviewWorkspaceRuntime.mockReturnValue(false);
    governanceMock.getCaptureManagementDeniedMessage.mockReturnValue("capture denied");
    governanceMock.getRuntimeManagementDeniedMessage.mockReturnValue("runtime denied");
    governanceMock.getRuntimeReviewDeniedMessage.mockReturnValue("runtime review denied");
    ownershipMock.assertWorkspaceObjectOwnership.mockResolvedValue(undefined);
    ownershipMock.assertWorkspaceMeetingOwnership.mockResolvedValue(undefined);
    ownershipMock.assertWorkspaceMemoryCandidateOwnership.mockResolvedValue(undefined);
    ownershipMock.isWorkspaceOwnershipError.mockImplementation(
      (error: unknown) =>
        error instanceof Error &&
        (error.message === "contact not found in active workspace" ||
          error.message === "meeting not found in active workspace" ||
          error.message === "memory candidate not found in active workspace"),
    );
    billingMock.ensureWorkspaceProcessingAllowed.mockResolvedValue(undefined);
    billingMock.recordUsageLedgerEntry.mockResolvedValue(undefined);
  });

  it("rejects capture start without capture capability", async () => {
    const response = await startCaptureRoute(
      new Request("http://localhost/api/conversation-capture/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "Kickoff capture",
          objectType: "CONTACT",
          objectId: "contact-1",
        }),
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      message: "capture denied",
    });
    expect(captureServiceMock.startCaptureSession).not.toHaveBeenCalled();
  });

  it("returns 404 when linked capture object is outside the active workspace", async () => {
    governanceMock.canManageWorkspaceCaptureSessions.mockReturnValue(true);
    ownershipMock.assertWorkspaceObjectOwnership.mockRejectedValue(
      new Error("contact not found in active workspace"),
    );

    const response = await startCaptureRoute(
      new Request("http://localhost/api/conversation-capture/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "Kickoff capture",
          objectType: "CONTACT",
          objectId: "contact-1",
        }),
      }),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      message: "contact not found in active workspace",
    });
    expect(captureServiceMock.startCaptureSession).not.toHaveBeenCalled();
  });

  it("rejects runtime ingest without runtime capability", async () => {
    const response = await runtimeMeetingEndedRoute(
      new Request("http://localhost/api/runtime/events/meeting-ended", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ meetingId: "meeting-1" }),
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      message: "runtime denied",
    });
    expect(runtimeMock.ingestMeetingEndedRuntime).not.toHaveBeenCalled();
  });

  it("rejects reflection candidate dismissal without runtime capability", async () => {
    const response = await dismissReflectionCandidateRoute(
      new Request("http://localhost/api/helm-v2/runtime/reflection/candidates/candidate-1/dismiss", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "candidate-1" }) },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      message: "runtime denied",
    });
    expect(runtimeMock.dismissReflectionCandidate).not.toHaveBeenCalled();
  });

  it("rejects reflection candidate acceptance without runtime review capability", async () => {
    const response = await acceptReflectionCandidateRoute(
      new Request("http://localhost/api/helm-v2/runtime/reflection/candidates/candidate-1/accept", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "candidate-1" }) },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      message: "runtime review denied",
    });
    expect(runtimeMock.acceptReflectionCandidate).not.toHaveBeenCalled();
  });

  it("guards reflection candidate dismissal by workspace ownership", async () => {
    governanceMock.canManageWorkspaceRuntime.mockReturnValue(true);
    ownershipMock.assertWorkspaceMemoryCandidateOwnership.mockRejectedValue(
      new Error("memory candidate not found in active workspace"),
    );

    const response = await dismissReflectionCandidateRoute(
      new Request("http://localhost/api/helm-v2/runtime/reflection/candidates/candidate-1/dismiss", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "candidate-1" }) },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      message: "memory candidate not found in active workspace",
    });
    expect(runtimeMock.dismissReflectionCandidate).not.toHaveBeenCalled();
  });

  it("guards reflection candidate acceptance by workspace ownership", async () => {
    governanceMock.canReviewWorkspaceRuntime.mockReturnValue(true);
    ownershipMock.assertWorkspaceMemoryCandidateOwnership.mockRejectedValue(
      new Error("memory candidate not found in active workspace"),
    );

    const response = await acceptReflectionCandidateRoute(
      new Request("http://localhost/api/helm-v2/runtime/reflection/candidates/candidate-1/accept", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "candidate-1" }) },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      message: "memory candidate not found in active workspace",
    });
    expect(runtimeMock.acceptReflectionCandidate).not.toHaveBeenCalled();
  });

  it("guards runtime ingest by meeting ownership before mutation", async () => {
    governanceMock.canManageWorkspaceRuntime.mockReturnValue(true);
    runtimeMock.ingestMeetingEndedRuntime.mockResolvedValue({ sessionId: "runtime-1" });

    const response = await runtimeMeetingEndedRoute(
      new Request("http://localhost/api/runtime/events/meeting-ended", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ meetingId: "meeting-1" }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { sessionId: "runtime-1" },
    });
    expect(ownershipMock.assertWorkspaceMeetingOwnership).toHaveBeenCalledWith("workspace-1", "meeting-1");
    expect(runtimeMock.ingestMeetingEndedRuntime).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      meetingId: "meeting-1",
      actorName: "Owner",
      actorUserId: "user-1",
      sourcePage: "/meetings/meeting-1",
      force: false,
    });
  });

  it("dismisses reflection candidates inside the active workspace", async () => {
    governanceMock.canManageWorkspaceRuntime.mockReturnValue(true);
    runtimeMock.dismissReflectionCandidate.mockResolvedValue({ id: "candidate-1" });

    const response = await dismissReflectionCandidateRoute(
      new Request("http://localhost/api/helm-v2/runtime/reflection/candidates/candidate-1/dismiss", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "candidate-1" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { id: "candidate-1" },
    });
    expect(ownershipMock.assertWorkspaceMemoryCandidateOwnership).toHaveBeenCalledWith(
      "workspace-1",
      "candidate-1",
    );
    expect(runtimeMock.dismissReflectionCandidate).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      candidateId: "candidate-1",
      userId: "user-1",
      actorName: "Owner",
      sourcePage: "/operating",
    });
  });

  it("accepts reflection candidates inside the active workspace", async () => {
    governanceMock.canReviewWorkspaceRuntime.mockReturnValue(true);
    runtimeMock.acceptReflectionCandidate.mockResolvedValue({ id: "candidate-1" });

    const response = await acceptReflectionCandidateRoute(
      new Request("http://localhost/api/helm-v2/runtime/reflection/candidates/candidate-1/accept", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "candidate-1" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { id: "candidate-1" },
    });
    expect(ownershipMock.assertWorkspaceMemoryCandidateOwnership).toHaveBeenCalledWith(
      "workspace-1",
      "candidate-1",
    );
    expect(runtimeMock.acceptReflectionCandidate).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      candidateId: "candidate-1",
      userId: "user-1",
      actorName: "Owner",
      sourcePage: "/operating",
    });
  });
});
