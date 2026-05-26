import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConnectorStatus, RuntimeEventStatus } from "@prisma/client";
import { storeConnectorToken } from "@/lib/connectors/token-store";

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    connector: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    runtimeEvent: {
      create: vi.fn(),
      update: vi.fn(),
    },
    runtimeSession: {
      upsert: vi.fn(),
    },
    sessionNotebook: {
      upsert: vi.fn(),
    },
    persistedPayload: {
      upsert: vi.fn(),
    },
    connectorIngestionRecord: {
      createMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

import { syncFeishuReadonlyConnector } from "@/lib/connectors/feishu-ingestion";

function buildConnector() {
  return {
    id: "connector-1",
    workspaceId: "workspace-1",
    userId: "user-1",
    provider: "FEISHU",
    status: "CONNECTED",
    accessToken: storeConnectorToken("user-access-token"),
    metadata: JSON.stringify({
      lastCallbackResult: {
        status: "SUCCESS",
        failurePosture: "CLEAR",
        recordedAt: "2026-05-20T08:00:00.000Z",
        message: "connected",
        providerEmail: "owner@helm.so",
        providerMobile: "13800138000",
        providerNick: "Owner",
        providerAvatarUrl: null,
        providerOpenId: "ou_feishu_1",
        providerUnionId: "on_union_1",
        providerUserId: "feishu-user-1",
        matchedWorkspaceUserEmail: "owner@helm.so",
        tenantKey: "tenant-key-1",
      },
    }),
  };
}

describe("feishu readonly ingestion seam", () => {
  const originalFetch = global.fetch;
  const originalAppId = process.env.FEISHU_APP_ID;
  const originalAppSecret = process.env.FEISHU_APP_SECRET;
  const originalBitableAppToken = process.env.FEISHU_BITABLE_APP_TOKEN;
  const originalBitableTableId = process.env.FEISHU_BITABLE_TABLE_ID;
  const originalBitableViewId = process.env.FEISHU_BITABLE_VIEW_ID;

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    process.env.FEISHU_APP_ID = "cli_app_123";
    process.env.FEISHU_APP_SECRET = "secret-1";
    process.env.FEISHU_BITABLE_APP_TOKEN = "appb123";
    process.env.FEISHU_BITABLE_TABLE_ID = "tbl123";
    process.env.FEISHU_BITABLE_VIEW_ID = "vew123";

    dbMock.connector.findUnique.mockResolvedValue(buildConnector());
    dbMock.runtimeEvent.create.mockResolvedValue({
      id: "runtime-event-1",
      status: RuntimeEventStatus.COMPLETED,
    });
    dbMock.runtimeEvent.update.mockResolvedValue({
      id: "runtime-event-1",
      status: RuntimeEventStatus.COMPLETED,
    });
    dbMock.runtimeSession.upsert.mockResolvedValue({
      id: "runtime-session-1",
    });
    dbMock.sessionNotebook.upsert.mockResolvedValue({
      id: "notebook-1",
    });
    dbMock.persistedPayload.upsert.mockResolvedValue({
      id: "payload-1",
    });
    dbMock.connectorIngestionRecord.createMany.mockResolvedValue({ count: 1 });
    dbMock.connector.update.mockResolvedValue({
      id: "connector-1",
      status: ConnectorStatus.CONNECTED,
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.FEISHU_APP_ID = originalAppId;
    process.env.FEISHU_APP_SECRET = originalAppSecret;
    process.env.FEISHU_BITABLE_APP_TOKEN = originalBitableAppToken;
    process.env.FEISHU_BITABLE_TABLE_ID = originalBitableTableId;
    process.env.FEISHU_BITABLE_VIEW_ID = originalBitableViewId;
  });

  it("persists bitable payloads through the verified read-only seam", async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: 0,
            msg: "ok",
            tenant_access_token: "tenant-token-1",
            expire: 7200,
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: 0,
            msg: "ok",
            data: {
              items: [
                {
                  record_id: "rec1",
                  fields: {
                    Name: "ACME Weekly Review",
                    Status: "Open",
                  },
                },
                {
                  record_id: "rec2",
                  fields: {
                    Name: "Beta Follow-up",
                    Score: 90,
                  },
                },
              ],
              has_more: false,
            },
          }),
        ),
      );

    const result = await syncFeishuReadonlyConnector({
      workspaceId: "workspace-1",
      userId: "user-1",
      english: true,
      sourcePage: "/settings",
      triggeredBy: "Owner",
    });

    expect(result.status).toBe("SUCCESS");
    expect(result.ingestResult.persistedPayloadCount).toBe(2);
    expect(result.ingestResult.scopeResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          scope: "BITABLE",
          status: "INGESTED",
          persistedPayloadCount: 2,
        }),
      ]),
    );
    expect(dbMock.persistedPayload.upsert).toHaveBeenCalledTimes(2);
    expect(dbMock.connectorIngestionRecord.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            sourceType: "bitable_record",
            sourceScope: "WORKSPACE:BITABLE",
          }),
        ]),
      }),
    );
  });

  it("records an unresolved posture when bitable binding env is missing", async () => {
    delete process.env.FEISHU_BITABLE_APP_TOKEN;
    delete process.env.FEISHU_BITABLE_TABLE_ID;

    const result = await syncFeishuReadonlyConnector({
      workspaceId: "workspace-1",
      userId: "user-1",
      english: true,
      sourcePage: "/settings",
      triggeredBy: "Owner",
    });

    expect(result.status).toBe("UNRESOLVED");
    expect(result.ingestResult.scopeResults[0]).toEqual(
      expect.objectContaining({
        scope: "BITABLE",
        status: "UNRESOLVED",
      }),
    );
    expect(dbMock.persistedPayload.upsert).not.toHaveBeenCalled();
    expect(dbMock.connector.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: ConnectorStatus.ERROR,
          lastSyncStatus: "未解析",
        }),
      }),
    );
  });
});
