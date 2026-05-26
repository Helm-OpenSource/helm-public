import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  dingtalk: {
    fetchDingTalkAppAccessToken: vi.fn(),
    getDingTalkAppMessageConfig: vi.fn(),
  },
  mcp: {
    resolveDingTalkUserIdByUnionId: vi.fn(),
  },
}));

vi.mock("@/lib/connectors/dingtalk", () => ({
  fetchDingTalkAppAccessToken: mocks.dingtalk.fetchDingTalkAppAccessToken,
  getDingTalkAppMessageConfig: mocks.dingtalk.getDingTalkAppMessageConfig,
}));

vi.mock("@/lib/connectors/dingtalk-mcp-client", () => ({
  resolveDingTalkUserIdByUnionId: mocks.mcp.resolveDingTalkUserIdByUnionId,
}));

import { sendBiReportToDingTalkAppMessage } from "@/lib/bi-report-skill/delivery/dingtalk-app-message";

describe("bi report DingTalk app message delivery", () => {
  const originalUnionEnv = process.env.BI_REPORT_DINGTALK_MANAGER_UNION_ID;
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.dingtalk.getDingTalkAppMessageConfig.mockReturnValue({
      clientId: "client-id",
      clientSecret: "client-secret",
      agentId: "123456",
    });
    mocks.dingtalk.fetchDingTalkAppAccessToken.mockResolvedValue({
      accessToken: "token-1",
      expireInSeconds: 7200,
    });
    mocks.mcp.resolveDingTalkUserIdByUnionId.mockResolvedValue("user-123");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    global.fetch = originalFetch;
    if (originalUnionEnv === undefined) {
      delete process.env.BI_REPORT_DINGTALK_MANAGER_UNION_ID;
    } else {
      process.env.BI_REPORT_DINGTALK_MANAGER_UNION_ID = originalUnionEnv;
    }
  });

  it("returns dry-run preview for unionId targets without calling fetch", async () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as typeof fetch;
    mocks.dingtalk.getDingTalkAppMessageConfig.mockReturnValue({
      clientId: "client-id",
      clientSecret: "client-secret",
      agentId: null,
    });

    const result = await sendBiReportToDingTalkAppMessage({
      targetType: "unionId",
      targetKey: "env:BI_REPORT_DINGTALK_MANAGER_UNION_ID",
      message: "hello",
      dryRun: true,
    });

    expect(mocks.mcp.resolveDingTalkUserIdByUnionId).not.toHaveBeenCalled();
    expect(result.status).toBe("SKIPPED");
    expect(result.responseBody).toBe("dry-run");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sends a real app message when dryRun is false", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response('{"errcode":0,"errmsg":"ok","task_id":1}', {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ) as typeof fetch;

    const result = await sendBiReportToDingTalkAppMessage({
      targetType: "userId",
      targetKey: "user-456",
      message: "hello",
      dryRun: false,
    });

    expect(mocks.dingtalk.fetchDingTalkAppAccessToken).toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("https://oapi.dingtalk.com/topapi/message/corpconversation/asyncsend_v2"),
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(result.status).toBe("SENT");
  });

  it("fails fast when app message config is incomplete", async () => {
    mocks.dingtalk.getDingTalkAppMessageConfig.mockReturnValue({
      clientId: "client-id",
      clientSecret: "client-secret",
      agentId: null,
    });

    const result = await sendBiReportToDingTalkAppMessage({
      targetType: "userId",
      targetKey: "user-456",
      message: "hello",
      dryRun: false,
    });

    expect(result.status).toBe("FAILED");
    expect(result.responseBody).toContain("DINGTALK_AGENT_ID");
  });
});
