import { beforeEach, describe, expect, it, vi } from "vitest";

const { configMock, webhookMock, serviceMock } = vi.hoisted(() => ({
  configMock: { resolveAgoraSttConfig: vi.fn() },
  webhookMock: {
    readBoundedAgoraWebhookBody: vi.fn(),
    verifyAgoraWebhookSignature: vi.fn(),
  },
  serviceMock: {
    parseAgoraWebhookPayload: vi.fn(),
    processAgoraWebhook: vi.fn(),
  },
}));

vi.mock("@/lib/integrations/agora-field-capture/agora-stt-client", () => configMock);
vi.mock("@/lib/integrations/agora-field-capture/agora-webhook", () => webhookMock);
vi.mock("@/lib/integrations/agora-field-capture/agora-webhook.service", () => serviceMock);

import { POST } from "@/app/api/integrations/agora/stt/webhook/route";

function webhookRequest() {
  return new Request("http://localhost/api/integrations/agora/stt/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Agora-Signature-V2": "signature" },
    body: JSON.stringify({ noticeId: "notice-1" }),
  });
}

describe("Agora webhook route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configMock.resolveAgoraSttConfig.mockReturnValue({
      mode: "REAL",
      webhookSecret: "secret",
    });
    webhookMock.readBoundedAgoraWebhookBody.mockResolvedValue(
      Buffer.from('{"noticeId":"notice-1"}'),
    );
    webhookMock.verifyAgoraWebhookSignature.mockReturnValue(true);
    serviceMock.parseAgoraWebhookPayload.mockReturnValue({ noticeId: "notice-1" });
    serviceMock.processAgoraWebhook.mockResolvedValue({ duplicate: false });
  });

  it("returns a retryable server error when durable processing fails", async () => {
    serviceMock.processAgoraWebhook.mockRejectedValue(new Error("database unavailable"));

    const response = await POST(webhookRequest());

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      errorCode: "AGORA_WEBHOOK_PROCESSING_FAILED",
    });
  });

  it("keeps malformed signed envelopes as a non-retryable client error", async () => {
    serviceMock.parseAgoraWebhookPayload.mockImplementation(() => {
      throw new Error("invalid shape");
    });

    const response = await POST(webhookRequest());

    expect(response.status).toBe(400);
    expect(serviceMock.processAgoraWebhook).not.toHaveBeenCalled();
  });
});
