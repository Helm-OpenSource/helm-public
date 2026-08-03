import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, serviceMock } = vi.hoisted(() => ({
  authMock: {
    authenticateCaptureAgentAuthorization: vi.fn(),
    isCaptureAgentAuthorizationError: vi.fn(),
  },
  serviceMock: {
    start: vi.fn(),
    ingestSegments: vi.fn(),
    stop: vi.fn(),
  },
}));

vi.mock("@/lib/integrations/agora-field-capture/capture-agent-auth.service", () => ({
  authenticateCaptureAgentAuthorization:
    authMock.authenticateCaptureAgentAuthorization,
  isCaptureAgentAuthorizationError: authMock.isCaptureAgentAuthorizationError,
}));
vi.mock("@/lib/integrations/agora-field-capture/field-capture.service", () => ({
  AgoraFieldCaptureService: class {
    start = serviceMock.start;
    ingestSegments = serviceMock.ingestSegments;
    stop = serviceMock.stop;
  },
  isFieldCaptureServiceError: (error: { fieldCapture?: boolean }) =>
    Boolean(error?.fieldCapture),
}));

import { POST as startRoute } from "@/app/api/capture-agents/sessions/start/route";
import { POST as segmentsRoute } from "@/app/api/capture-agents/sessions/[providerSessionId]/segments/route";
import { POST as stopRoute } from "@/app/api/capture-agents/sessions/[providerSessionId]/stop/route";

const credential = {
  id: "credential-1",
  workspaceId: "workspace-1",
  name: "Store pilot Mac",
  tokenPrefix: "public-prefix-1",
  transcriptRetention: "DERIVED_ONLY",
};

describe("field capture agent routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.authenticateCaptureAgentAuthorization.mockResolvedValue(credential);
    authMock.isCaptureAgentAuthorizationError.mockReturnValue(false);
  });

  it("starts only with explicit consent and returns service RTC material", async () => {
    serviceMock.start.mockResolvedValue({ providerSessionId: "provider-1" });
    const response = await startRoute(
      new Request("http://localhost/api/capture-agents/sessions/start", {
        method: "POST",
        headers: {
          Authorization: "Bearer valid-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "Store floor pilot",
          language: "zh-CN",
          consent: {
            confirmed: true,
            counterpartyNotified: true,
            noticeTextVersion: "field-capture-consent/v1",
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(serviceMock.start).toHaveBeenCalledWith(
      expect.objectContaining({ credential, title: "Store floor pilot" }),
    );
  });

  it("rejects audio uploads on the field-control route", async () => {
    const response = await startRoute(
      new Request("http://localhost/api/capture-agents/sessions/start", {
        method: "POST",
        headers: {
          Authorization: "Bearer valid-token",
          "Content-Type": "audio/wav",
        },
        body: Buffer.from("RIFF-not-real-audio"),
      }),
    );

    expect(response.status).toBe(415);
    expect(await response.json()).toMatchObject({
      errorCode: "UNSUPPORTED_MEDIA_TYPE",
    });
    expect(serviceMock.start).not.toHaveBeenCalled();
  });

  it("accepts final segments and rejects interim transcript text", async () => {
    serviceMock.ingestSegments.mockResolvedValue({ accepted: 1, duplicates: 0 });
    const context = { params: Promise.resolve({ providerSessionId: "provider-1" }) };
    const base = {
      sourceUid: "101",
      sentenceId: "1",
      text: "需要试一下小一码",
      textTsMs: "1784354400123",
      durationMs: 1800,
      language: "zh-CN",
    };
    const finalResponse = await segmentsRoute(
      new Request("http://localhost/segments", {
        method: "POST",
        headers: {
          Authorization: "Bearer valid-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ segments: [{ ...base, isFinal: true }] }),
      }),
      context,
    );
    expect(finalResponse.status).toBe(200);

    const interimResponse = await segmentsRoute(
      new Request("http://localhost/segments", {
        method: "POST",
        headers: {
          Authorization: "Bearer valid-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ segments: [{ ...base, isFinal: false }] }),
      }),
      context,
    );
    expect(interimResponse.status).toBe(400);
    expect(serviceMock.ingestSegments).toHaveBeenCalledTimes(1);
  });

  it("stops only the session owned by the authenticated capture credential", async () => {
    serviceMock.stop.mockResolvedValue({ status: "STOPPED" });
    const response = await stopRoute(
      new Request("http://localhost/stop", {
        method: "POST",
        headers: { Authorization: "Bearer valid-token" },
      }),
      { params: Promise.resolve({ providerSessionId: "provider-1" }) },
    );

    expect(response.status).toBe(200);
    expect(serviceMock.stop).toHaveBeenCalledWith({
      credential,
      providerSessionId: "provider-1",
    });
  });

  it("rejects any payload on the stop control route", async () => {
    const response = await stopRoute(
      new Request("http://localhost/stop", {
        method: "POST",
        headers: {
          Authorization: "Bearer valid-token",
          "Content-Type": "audio/wav",
        },
        body: Buffer.from("RIFF-not-real-audio"),
      }),
      { params: Promise.resolve({ providerSessionId: "provider-1" }) },
    );

    expect(response.status).toBe(415);
    expect(await response.json()).toMatchObject({
      errorCode: "UNSUPPORTED_MEDIA_TYPE",
    });
    expect(serviceMock.stop).not.toHaveBeenCalled();
  });

  it("returns a generic 401 before parsing attacker-controlled bodies", async () => {
    const authError = Object.assign(new Error("invalid"), {
      code: "CAPTURE_AGENT_UNAUTHORIZED",
    });
    authMock.authenticateCaptureAgentAuthorization.mockRejectedValue(authError);
    authMock.isCaptureAgentAuthorizationError.mockReturnValue(true);

    const response = await startRoute(
      new Request("http://localhost/start", {
        method: "POST",
        headers: { Authorization: "Bearer bad-token" },
        body: "not-json",
      }),
    );
    expect(response.status).toBe(401);
    expect(serviceMock.start).not.toHaveBeenCalled();
  });
});
