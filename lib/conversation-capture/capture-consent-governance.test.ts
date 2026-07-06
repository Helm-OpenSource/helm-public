import { beforeEach, describe, expect, it, vi } from "vitest";

const { serviceGovernanceMock, dbMock } = vi.hoisted(() => ({
  serviceGovernanceMock: {
    assertWorkspaceCaptureServiceAccess: vi.fn(),
  },
  dbMock: {
    workspace: { findUnique: vi.fn() },
    captureSession: { create: vi.fn() },
    captureConsentRecord: { create: vi.fn() },
  },
}));

vi.mock("@/lib/auth/service-governance", () => ({
  assertWorkspaceCaptureServiceAccess:
    serviceGovernanceMock.assertWorkspaceCaptureServiceAccess,
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));

vi.mock("@/lib/audit", () => ({ writeAuditLog: vi.fn() }));
vi.mock("@/lib/analytics", () => ({ logEvent: vi.fn() }));

import { startCaptureSession } from "@/lib/conversation-capture/capture-session.service";

const BASE_INPUT = {
  workspaceId: "workspace-1",
  actorName: "Operator",
  actorUserId: "user-1",
  actorType: "USER" as const,
  title: "Customer call",
};

describe("capture consent governance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serviceGovernanceMock.assertWorkspaceCaptureServiceAccess.mockResolvedValue(
      undefined,
    );
    dbMock.captureSession.create.mockResolvedValue({
      id: "capture-1",
      title: "Customer call",
      objectType: null,
      objectId: null,
      sourceType: "MANUAL_CAPTURE",
    });
    dbMock.captureConsentRecord.create.mockResolvedValue({ id: "consent-1" });
  });

  it("fails closed when the workspace requires consent and none is confirmed", async () => {
    dbMock.workspace.findUnique.mockResolvedValue({
      captureConsentRequired: true,
    });

    await expect(
      startCaptureSession({ ...BASE_INPUT, english: false }),
    ).rejects.toThrow("必须先确认录音 / 转写授权并完成被录方告知");
    expect(dbMock.captureSession.create).not.toHaveBeenCalled();
    expect(dbMock.captureConsentRecord.create).not.toHaveBeenCalled();
  });

  it("fails closed when consent is confirmed but the counterparty was not notified", async () => {
    dbMock.workspace.findUnique.mockResolvedValue({
      captureConsentRequired: true,
    });

    await expect(
      startCaptureSession({
        ...BASE_INPUT,
        english: true,
        consent: { confirmed: true, counterpartyNotified: false },
      }),
    ).rejects.toThrow("Recording consent must be confirmed");
    expect(dbMock.captureSession.create).not.toHaveBeenCalled();
  });

  it("persists a consent record when consent is confirmed in a consent-required workspace", async () => {
    dbMock.workspace.findUnique.mockResolvedValue({
      captureConsentRequired: true,
    });

    const session = await startCaptureSession({
      ...BASE_INPUT,
      english: false,
      consent: {
        confirmed: true,
        counterpartyNotified: true,
        noticeTextVersion: "capture-consent-notice/v1",
      },
    });

    expect(session.id).toBe("capture-1");
    expect(dbMock.captureConsentRecord.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "workspace-1",
        captureSessionId: "capture-1",
        confirmedByName: "Operator",
        counterpartyNotified: true,
        noticeTextVersion: "capture-consent-notice/v1",
      }),
    });
  });

  it("still records voluntary consent when the workspace does not require it", async () => {
    dbMock.workspace.findUnique.mockResolvedValue({
      captureConsentRequired: false,
    });

    await startCaptureSession({
      ...BASE_INPUT,
      consent: { confirmed: true, counterpartyNotified: true },
    });

    expect(dbMock.captureConsentRecord.create).toHaveBeenCalledTimes(1);
  });

  it("starts without a consent record when the workspace does not require consent", async () => {
    dbMock.workspace.findUnique.mockResolvedValue({
      captureConsentRequired: false,
    });

    await startCaptureSession({ ...BASE_INPUT });

    expect(dbMock.captureSession.create).toHaveBeenCalledTimes(1);
    expect(dbMock.captureConsentRecord.create).not.toHaveBeenCalled();
  });
});
