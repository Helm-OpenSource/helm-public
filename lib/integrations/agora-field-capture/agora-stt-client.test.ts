import { describe, expect, it, vi } from "vitest";
import {
  AgoraSttClient,
  resolveAgoraSttConfig,
} from "@/lib/integrations/agora-field-capture/agora-stt-client";

describe("Agora STT config", () => {
  it("defaults to MOCK without requiring credentials", () => {
    expect(resolveAgoraSttConfig({})).toEqual({
      mode: "MOCK",
      appId: "mock-agora-app-id",
      baseUrl: "https://api.sd-rtn.com",
      tokenTtlSeconds: 3600,
    });
  });

  it("fails closed when REAL mode is missing server credentials", () => {
    expect(() =>
      resolveAgoraSttConfig({
        AGORA_STT_MODE: "REAL",
        AGORA_APP_ID: "app-id",
      }),
    ).toThrow(
      "AGORA_APP_CERTIFICATE, AGORA_CUSTOMER_ID, AGORA_CUSTOMER_SECRET, AGORA_STT_WEBHOOK_SECRET",
    );
  });

  it("rejects unknown modes instead of silently falling back", () => {
    expect(() => resolveAgoraSttConfig({ AGORA_STT_MODE: "LIVE" })).toThrow(
      "AGORA_STT_MODE must be MOCK or REAL",
    );
  });

  it("rejects a plaintext REAL endpoint before it can receive provider credentials", () => {
    expect(() =>
      resolveAgoraSttConfig({
        AGORA_STT_MODE: "REAL",
        AGORA_APP_ID: "app-id",
        AGORA_APP_CERTIFICATE: "app-certificate",
        AGORA_CUSTOMER_ID: "customer-id",
        AGORA_CUSTOMER_SECRET: "customer-secret",
        AGORA_STT_WEBHOOK_SECRET: "webhook-secret",
        AGORA_STT_BASE_URL: "http://example.com",
      }),
    ).toThrow("AGORA_STT_BASE_URL must use HTTPS");
  });
});

describe("Agora STT client", () => {
  const realConfig = resolveAgoraSttConfig({
    AGORA_STT_MODE: "REAL",
    AGORA_APP_ID: "app-id",
    AGORA_APP_CERTIFICATE: "app-certificate",
    AGORA_CUSTOMER_ID: "customer-id",
    AGORA_CUSTOMER_SECRET: "customer-secret",
    AGORA_STT_WEBHOOK_SECRET: "webhook-secret",
  });

  it("creates scoped publisher and bot tokens and starts STT server-side", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ agent_id: "agent-1", create_ts: 1234, status: "RUNNING" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const tokenBuilder = vi.fn((input: { uid: number }) => `token-${input.uid}`);
    const client = new AgoraSttClient(realConfig, {
      fetch: fetchMock,
      buildRtcToken: tokenBuilder,
    });

    const result = await client.start({
      taskName: "helm-field-session",
      channelName: "helm-field-channel",
      language: "zh-CN",
      publisherUid: 101,
      subscriberBotUid: 201,
      publisherBotUid: 301,
    });

    expect(result).toMatchObject({
      providerAgentId: "agent-1",
      providerStatus: "RUNNING",
      rtc: {
        appId: "app-id",
        channelName: "helm-field-channel",
        publisherUid: 101,
        publisherToken: "token-101",
        transcriptBotUid: 301,
      },
    });
    expect(tokenBuilder).toHaveBeenCalledTimes(3);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      "https://api.sd-rtn.com/cn/api/speech-to-text/v1/projects/app-id/join",
    );
    expect(init.method).toBe("POST");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect((init.headers as Record<string, string>).Authorization).toBe(
      `Basic ${Buffer.from("customer-id:customer-secret").toString("base64")}`,
    );
    expect(JSON.parse(String(init.body))).toEqual({
      languages: ["zh-CN"],
      name: "helm-field-session",
      maxIdleTime: 300,
      rtcConfig: {
        channelName: "helm-field-channel",
        subBotUid: "201",
        subBotToken: "token-201",
        pubBotUid: "301",
        pubBotToken: "token-301",
        subscribeAudioUids: ["101"],
        enableJsonProtocol: false,
      },
    });
  });

  it("uses the package's AccessToken2 builder with relative TTL semantics", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ agent_id: "agent-2", status: "RUNNING" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const accessToken2Config = resolveAgoraSttConfig({
      AGORA_STT_MODE: "REAL",
      AGORA_APP_ID: "a".repeat(32),
      AGORA_APP_CERTIFICATE: "b".repeat(32),
      AGORA_CUSTOMER_ID: "customer-id",
      AGORA_CUSTOMER_SECRET: "customer-secret",
      AGORA_STT_WEBHOOK_SECRET: "webhook-secret",
      AGORA_RTC_TOKEN_TTL_SECONDS: "3600",
    });
    const client = new AgoraSttClient(accessToken2Config, { fetch: fetchMock });

    const result = await client.start({
      taskName: "helm-field-access-token-2",
      channelName: "helm-field-access-token-2",
      language: "zh-CN",
      publisherUid: 101,
      subscriberBotUid: 201,
      publisherBotUid: 301,
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const rtcConfig = JSON.parse(String(init.body)).rtcConfig;
    expect(result.rtc.publisherToken).toMatch(/^007/);
    expect(rtcConfig.subBotToken).toMatch(/^007/);
    expect(rtcConfig.pubBotToken).toMatch(/^007/);
  });

  it("stops the exact provider task and rejects non-success responses", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ agent_id: "agent-1", status: "STOPPED" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ reason: "not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }),
      );
    const client = new AgoraSttClient(realConfig, {
      fetch: fetchMock,
      buildRtcToken: () => "unused",
    });

    await expect(client.stop("agent-1")).resolves.toMatchObject({
      providerAgentId: "agent-1",
      providerStatus: "STOPPED",
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://api.sd-rtn.com/cn/api/speech-to-text/v1/projects/app-id/agents/agent-1/leave",
    );
    await expect(client.stop("agent-missing")).rejects.toThrow(
      "Agora STT leave failed with HTTP 404",
    );
  });

  it("does not treat a non-terminal leave status as a completed stop", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ agent_id: "agent-1", status: "RUNNING" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const client = new AgoraSttClient(realConfig, {
      fetch: fetchMock,
      buildRtcToken: () => "unused",
    });

    await expect(client.stop("agent-1")).rejects.toThrow(
      "Agora STT leave returned unexpected status RUNNING",
    );
  });

  it("keeps MOCK explicit and never performs a network request", async () => {
    const fetchMock = vi.fn();
    const client = new AgoraSttClient(resolveAgoraSttConfig({}), {
      fetch: fetchMock,
      buildRtcToken: () => "unused",
    });

    const result = await client.start({
      taskName: "mock-task",
      channelName: "mock-channel",
      language: "zh-CN",
      publisherUid: 1,
      subscriberBotUid: 2,
      publisherBotUid: 3,
    });

    expect(result.providerAgentId).toMatch(/^mock-agent-/);
    expect(result.rtc.publisherToken).toBe("mock-rtc-token");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
