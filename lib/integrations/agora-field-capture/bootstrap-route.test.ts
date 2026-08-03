import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, configMock } = vi.hoisted(() => ({
  authMock: {
    authenticateCaptureAgentAuthorization: vi.fn(),
    isCaptureAgentAuthorizationError: vi.fn(),
  },
  configMock: { resolveAgoraSttConfig: vi.fn() },
}));

vi.mock("@/lib/integrations/agora-field-capture/capture-agent-auth.service", () =>
  authMock,
);
vi.mock("@/lib/integrations/agora-field-capture/agora-stt-client", () =>
  configMock,
);

import { GET } from "@/app/api/capture-agents/bootstrap/route";

describe("capture agent bootstrap route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.authenticateCaptureAgentAuthorization.mockResolvedValue({
      id: "credential-1",
    });
    authMock.isCaptureAgentAuthorizationError.mockReturnValue(false);
    configMock.resolveAgoraSttConfig.mockReturnValue({
      mode: "REAL",
      appId: "public-app-id",
    });
  });

  it("returns only public RTC initialization material", async () => {
    const response = await GET(
      new Request("http://localhost/api/capture-agents/bootstrap", {
        headers: { Authorization: "Bearer scoped-device-token" },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({
      provider: "AGORA",
      mode: "REAL",
      rtcAppId: "public-app-id",
      rawAudioAcceptedByHelm: false,
      rawAudioStoredByHelm: false,
    });
    expect(JSON.stringify(body)).not.toContain("certificate");
    expect(JSON.stringify(body)).not.toContain("customerSecret");
  });

  it("fails closed when server-side Agora configuration is invalid", async () => {
    configMock.resolveAgoraSttConfig.mockImplementation(() => {
      throw new Error("missing secret");
    });

    const response = await GET(
      new Request("http://localhost/api/capture-agents/bootstrap", {
        headers: { Authorization: "Bearer scoped-device-token" },
      }),
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      errorCode: "AGORA_FIELD_CAPTURE_NOT_CONFIGURED",
    });
  });
});
