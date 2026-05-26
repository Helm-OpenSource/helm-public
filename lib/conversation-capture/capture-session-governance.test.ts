import { beforeEach, describe, expect, it, vi } from "vitest";

const { serviceGovernanceMock } = vi.hoisted(() => ({
  serviceGovernanceMock: {
    assertWorkspaceCaptureServiceAccess: vi.fn(),
  },
}));

vi.mock("@/lib/auth/service-governance", () => ({
  assertWorkspaceCaptureServiceAccess: serviceGovernanceMock.assertWorkspaceCaptureServiceAccess,
}));

import { startCaptureSession, stopCaptureSession } from "@/lib/conversation-capture/capture-session.service";

describe("capture session service governance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("re-checks capture capability before starting a capture session", async () => {
    serviceGovernanceMock.assertWorkspaceCaptureServiceAccess.mockRejectedValueOnce(
      new Error("Only owner, admin, or operator can start, ingest, or process tenant-scoped capture sessions."),
    );

    await expect(
      startCaptureSession({
        workspaceId: "workspace-1",
        actorName: "Operator",
        actorUserId: "user-1",
        actorType: "USER",
        english: true,
        title: "Customer call",
      }),
    ).rejects.toThrow(
      "Only owner, admin, or operator can start, ingest, or process tenant-scoped capture sessions.",
    );
  });

  it("re-checks capture capability before stopping and processing a capture session", async () => {
    serviceGovernanceMock.assertWorkspaceCaptureServiceAccess.mockRejectedValueOnce(
      new Error("只有 owner、管理员或 operator 可以启动、导入或处理租户范围内的 capture session。"),
    );

    await expect(
      stopCaptureSession({
        workspaceId: "workspace-1",
        actorName: "Operator",
        actorUserId: "user-1",
        actorType: "USER",
        english: false,
        captureSessionId: "capture-1",
      }),
    ).rejects.toThrow("只有 owner、管理员或 operator 可以启动、导入或处理租户范围内的 capture session。");
  });
});
