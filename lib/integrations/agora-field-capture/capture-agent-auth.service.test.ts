import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock, governanceMock, auditMock } = vi.hoisted(() => ({
  dbMock: {
    captureAgentCredential: {
      create: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
  },
  governanceMock: {
    assertWorkspaceCaptureServiceAccess: vi.fn(),
  },
  auditMock: { safeWriteAuditLog: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/auth/service-governance", () => ({
  assertWorkspaceCaptureServiceAccess:
    governanceMock.assertWorkspaceCaptureServiceAccess,
}));
vi.mock("@/lib/audit", () => auditMock);

import {
  authenticateCaptureAgentAuthorization,
  issueCaptureAgentCredential,
} from "@/lib/integrations/agora-field-capture/capture-agent-auth.service";

describe("capture agent auth service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    governanceMock.assertWorkspaceCaptureServiceAccess.mockResolvedValue(undefined);
    auditMock.safeWriteAuditLog.mockResolvedValue({ id: "audit-1" });
  });

  it("requires workspace capture governance and returns the secret only at issuance", async () => {
    dbMock.captureAgentCredential.create.mockImplementation(async ({ data }) => ({
      id: "credential-1",
      ...data,
      createdAt: new Date("2026-07-18T00:00:00Z"),
    }));

    const result = await issueCaptureAgentCredential({
      workspaceId: "workspace-1",
      name: "Store pilot Mac",
      actorUserId: "user-1",
      actorName: "Owner",
      transcriptRetention: "DERIVED_ONLY",
      expiresAt: new Date("2026-08-18T00:00:00Z"),
    });

    expect(governanceMock.assertWorkspaceCaptureServiceAccess).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "workspace-1",
        userId: "user-1",
      }),
    );
    expect(result.token).toMatch(/^helm_capture_/);
    expect(result.credential).not.toHaveProperty("tokenHash");
    expect(dbMock.captureAgentCredential.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "workspace-1",
        createdByUserId: "user-1",
        transcriptRetention: "DERIVED_ONLY",
        tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    });
    expect(auditMock.safeWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "CAPTURE_AGENT_CREDENTIAL_ISSUED",
        targetId: "credential-1",
        payload: expect.not.objectContaining({ tokenHash: expect.anything() }),
      }),
    );
  });

  it("authenticates a valid active token without trusting workspace headers", async () => {
    const tokenModule = await import(
      "@/lib/integrations/agora-field-capture/capture-agent-token"
    );
    const token = tokenModule.issueCaptureAgentToken();
    dbMock.captureAgentCredential.findUnique.mockResolvedValue({
      id: "credential-1",
      workspaceId: "workspace-1",
      name: "Store pilot Mac",
      tokenPrefix: token.tokenPrefix,
      tokenHash: token.tokenHash,
      status: "ACTIVE",
      transcriptRetention: "DERIVED_ONLY",
      expiresAt: new Date("2026-08-18T00:00:00Z"),
      revokedAt: null,
    });
    dbMock.captureAgentCredential.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      authenticateCaptureAgentAuthorization(`Bearer ${token.token}`, {
        now: new Date("2026-07-18T00:00:00Z"),
        touch: true,
      }),
    ).resolves.toMatchObject({
      id: "credential-1",
      workspaceId: "workspace-1",
    });
    expect(dbMock.captureAgentCredential.updateMany).toHaveBeenCalledWith({
      where: { id: "credential-1", status: "ACTIVE", revokedAt: null },
      data: { lastSeenAt: new Date("2026-07-18T00:00:00Z") },
    });
  });

  it("returns one generic auth error for malformed, revoked, expired, and modified tokens", async () => {
    await expect(
      authenticateCaptureAgentAuthorization("Basic abc"),
    ).rejects.toMatchObject({ code: "CAPTURE_AGENT_UNAUTHORIZED" });

    const tokenModule = await import(
      "@/lib/integrations/agora-field-capture/capture-agent-token"
    );
    const token = tokenModule.issueCaptureAgentToken();
    dbMock.captureAgentCredential.findUnique.mockResolvedValue({
      id: "credential-1",
      workspaceId: "workspace-1",
      name: "Store pilot Mac",
      tokenPrefix: token.tokenPrefix,
      tokenHash: token.tokenHash,
      status: "REVOKED",
      transcriptRetention: "DERIVED_ONLY",
      expiresAt: null,
      revokedAt: new Date(),
    });
    await expect(
      authenticateCaptureAgentAuthorization(`Bearer ${token.token}`),
    ).rejects.toMatchObject({ code: "CAPTURE_AGENT_UNAUTHORIZED" });

    dbMock.captureAgentCredential.findUnique.mockResolvedValue({
      id: "credential-1",
      workspaceId: "workspace-1",
      name: "Store pilot Mac",
      tokenPrefix: token.tokenPrefix,
      tokenHash: token.tokenHash,
      status: "ACTIVE",
      transcriptRetention: "DERIVED_ONLY",
      expiresAt: new Date("2026-07-17T00:00:00Z"),
      revokedAt: null,
    });
    await expect(
      authenticateCaptureAgentAuthorization(`Bearer ${token.token}`, {
        now: new Date("2026-07-18T00:00:00Z"),
      }),
    ).rejects.toMatchObject({ code: "CAPTURE_AGENT_UNAUTHORIZED" });

    dbMock.captureAgentCredential.findUnique.mockResolvedValue({
      id: "credential-1",
      workspaceId: "workspace-1",
      name: "Store pilot Mac",
      tokenPrefix: token.tokenPrefix,
      tokenHash: token.tokenHash,
      status: "ACTIVE",
      transcriptRetention: "DERIVED_ONLY",
      expiresAt: null,
      revokedAt: null,
    });
    await expect(
      authenticateCaptureAgentAuthorization(
        `Bearer ${token.token.slice(0, -1)}x`,
      ),
    ).rejects.toMatchObject({ code: "CAPTURE_AGENT_UNAUTHORIZED" });
  });

  it("fails closed when revocation wins the touch race", async () => {
    const tokenModule = await import(
      "@/lib/integrations/agora-field-capture/capture-agent-token"
    );
    const token = tokenModule.issueCaptureAgentToken();
    dbMock.captureAgentCredential.findUnique.mockResolvedValue({
      id: "credential-1",
      workspaceId: "workspace-1",
      name: "Store pilot Mac",
      tokenPrefix: token.tokenPrefix,
      tokenHash: token.tokenHash,
      status: "ACTIVE",
      transcriptRetention: "DERIVED_ONLY",
      expiresAt: null,
      revokedAt: null,
    });
    dbMock.captureAgentCredential.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      authenticateCaptureAgentAuthorization(`Bearer ${token.token}`, {
        now: new Date("2026-07-18T00:00:00Z"),
        touch: true,
      }),
    ).rejects.toMatchObject({ code: "CAPTURE_AGENT_UNAUTHORIZED" });
  });
});
