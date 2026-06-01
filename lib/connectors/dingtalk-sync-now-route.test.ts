import { beforeEach, describe, expect, it, vi } from "vitest";

const { actionsMock } = vi.hoisted(() => ({
  actionsMock: {
    syncDingTalkConnectorAction: vi.fn(),
  },
}));

vi.mock("@/features/connectors/actions", () => ({
  syncDingTalkConnectorAction: actionsMock.syncDingTalkConnectorAction,
}));

import { GET as syncDingTalkNowRoute } from "@/app/api/connectors/dingtalk/sync-now/route";

describe("dingtalk sync-now route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects success result to absolute settings URL", async () => {
    const successMessage = "钉钉 MCP 只读采集已部分完成：已写入 28 条资料，仍有 4 个范围尚未解析。";
    actionsMock.syncDingTalkConnectorAction.mockResolvedValue({
      ok: true,
      message: successMessage,
    });

    const response = await syncDingTalkNowRoute(
      new Request("http://localhost/api/connectors/dingtalk/sync-now"),
    );

    expect(response.status).toBe(307);
    const location = response.headers.get("location");
    expect(location).toBeTruthy();
    const redirectUrl = new URL(location!);
    expect(redirectUrl.origin).toBe("http://localhost");
    expect(redirectUrl.pathname).toBe("/settings");
    expect(redirectUrl.searchParams.get("tab")).toBe("connectors");
    expect(redirectUrl.searchParams.get("connector")).toBe("dingtalk");
    expect(redirectUrl.searchParams.get("status")).toBe("connected");
    expect(redirectUrl.searchParams.get("message")).toBe(successMessage);
  });

  it("redirects failure result to absolute settings URL", async () => {
    actionsMock.syncDingTalkConnectorAction.mockResolvedValue({
      ok: false,
      error: "DingTalk MCP sync failed",
    });

    const response = await syncDingTalkNowRoute(
      new Request("http://localhost/api/connectors/dingtalk/sync-now"),
    );

    expect(response.status).toBe(307);
    const location = response.headers.get("location");
    expect(location).toBeTruthy();
    const redirectUrl = new URL(location!);
    expect(redirectUrl.origin).toBe("http://localhost");
    expect(redirectUrl.pathname).toBe("/settings");
    expect(redirectUrl.searchParams.get("tab")).toBe("connectors");
    expect(redirectUrl.searchParams.get("connector")).toBe("dingtalk");
    expect(redirectUrl.searchParams.get("status")).toBe("error");
    expect(redirectUrl.searchParams.get("message")).toBe("DingTalk MCP sync failed");
  });
});
