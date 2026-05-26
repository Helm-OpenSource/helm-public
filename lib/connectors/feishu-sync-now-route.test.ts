import { beforeEach, describe, expect, it, vi } from "vitest";

const { actionsMock } = vi.hoisted(() => ({
  actionsMock: {
    syncFeishuConnectorAction: vi.fn(),
  },
}));

vi.mock("@/features/connectors/actions", () => ({
  syncFeishuConnectorAction: actionsMock.syncFeishuConnectorAction,
}));

import { GET as syncFeishuNowRoute } from "@/app/api/connectors/feishu/sync-now/route";

describe("feishu sync-now route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects success result to absolute settings URL", async () => {
    const successMessage = "飞书多维表格只读采集已完成，生成 12 条已保存采集资料。";
    actionsMock.syncFeishuConnectorAction.mockResolvedValue({
      ok: true,
      message: successMessage,
    });

    const response = await syncFeishuNowRoute(
      new Request("http://localhost/api/connectors/feishu/sync-now"),
    );

    expect(response.status).toBe(307);
    const location = response.headers.get("location");
    expect(location).toBeTruthy();
    const redirectUrl = new URL(location!);
    expect(redirectUrl.origin).toBe("http://localhost");
    expect(redirectUrl.pathname).toBe("/settings");
    expect(redirectUrl.searchParams.get("tab")).toBe("connectors");
    expect(redirectUrl.searchParams.get("connector")).toBe("feishu");
    expect(redirectUrl.searchParams.get("status")).toBe("connected");
    expect(redirectUrl.searchParams.get("message")).toBe(successMessage);
  });

  it("redirects failure result to absolute settings URL", async () => {
    actionsMock.syncFeishuConnectorAction.mockResolvedValue({
      ok: false,
      error: "Feishu Bitable read-only ingest failed",
    });

    const response = await syncFeishuNowRoute(
      new Request("http://localhost/api/connectors/feishu/sync-now"),
    );

    expect(response.status).toBe(307);
    const location = response.headers.get("location");
    expect(location).toBeTruthy();
    const redirectUrl = new URL(location!);
    expect(redirectUrl.origin).toBe("http://localhost");
    expect(redirectUrl.pathname).toBe("/settings");
    expect(redirectUrl.searchParams.get("tab")).toBe("connectors");
    expect(redirectUrl.searchParams.get("connector")).toBe("feishu");
    expect(redirectUrl.searchParams.get("status")).toBe("error");
    expect(redirectUrl.searchParams.get("message")).toBe(
      "Feishu Bitable read-only ingest failed",
    );
  });
});
