import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    externalAgentConnection: { findUnique: vi.fn(), update: vi.fn() },
    membership: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ db: dbMock }));

import { QODERWORK_PROVIDER_ID, authenticateQoderWorkConnection } from "@/lib/integrations/qoderwork/connection-service";
import { __resetPackRegistryForTest, registerPackContributions } from "@/lib/extensions/registry-contract";

describe("QoderWork connection and the external member prefix lock", () => {
  const token = "hqw_" + "A".repeat(43);
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("HELM_QODERWORK_MCP_ENABLED", "true");
    __resetPackRegistryForTest();
    registerPackContributions("demo-pack", { externalMemberSurfaces: [{ scope: "partner-portal", landingPath: "/ext-demo/portal", pathPrefixes: ["/ext-demo/portal"] }] });
    dbMock.externalAgentConnection.findUnique.mockResolvedValue({
      id: "conn-1", providerId: QODERWORK_PROVIDER_ID, revokedAt: null, expiresAt: new Date(Date.now() + 3_600_000),
      workspaceId: "workspace-1", userId: "user-1",
      workspace: { featureFlagsJson: JSON.stringify({ qoderworkOwnerLoopMcp: true }) },
      observationProgram: { workspaceId: "workspace-1", status: "ACTIVE", expiresAt: new Date(Date.now() + 3_600_000) },
    });
    dbMock.externalAgentConnection.update.mockResolvedValue({});
  });
  afterEach(() => { vi.unstubAllEnvs(); __resetPackRegistryForTest(); });

  it("refuses a connection whose member is external, even one issued before the scope was written", async () => {
    dbMock.membership.findUnique.mockResolvedValue({ accessScope: "partner-portal" });
    await expect(authenticateQoderWorkConnection(token)).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    expect(dbMock.externalAgentConnection.update).toHaveBeenCalledWith({ where: { id: "conn-1" }, data: { lastFailureCode: "EXTERNAL_MEMBER" } });
  });

  it("refuses an unregistered scope value as well", async () => {
    dbMock.membership.findUnique.mockResolvedValue({ accessScope: "some-future-scope" });
    await expect(authenticateQoderWorkConnection(token)).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });
});
