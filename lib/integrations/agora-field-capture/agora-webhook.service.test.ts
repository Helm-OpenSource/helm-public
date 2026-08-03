import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    captureProviderWebhookReceipt: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    captureProviderSession: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));

import {
  parseAgoraWebhookPayload,
  processAgoraWebhook,
} from "@/lib/integrations/agora-field-capture/agora-webhook.service";

const joinedBody = Buffer.from(
  JSON.stringify({
    sid: "agent-1",
    noticeId: "notice-1",
    productId: 20,
    eventType: 101,
    notifyMs: 1784354400000,
    payload: {
      agent_id: "agent-1",
      channel: "channel-1",
      start_ts: 1784354400,
    },
  }),
);

describe("Agora webhook service", () => {
  beforeEach(() => vi.clearAllMocks());

  it("parses the official envelope and records only a fingerprint plus minimal routing fields", async () => {
    dbMock.captureProviderWebhookReceipt.findUnique.mockResolvedValue(null);
    dbMock.captureProviderSession.findFirst.mockResolvedValue({
      id: "provider-1",
      status: "STARTING",
    });
    dbMock.captureProviderWebhookReceipt.create.mockResolvedValue({
      id: "receipt-1",
    });
    dbMock.captureProviderSession.updateMany.mockResolvedValue({ count: 1 });
    dbMock.captureProviderWebhookReceipt.update.mockResolvedValue({
      id: "receipt-1",
    });

    const payload = parseAgoraWebhookPayload(joinedBody);
    await expect(processAgoraWebhook({ rawBody: joinedBody, payload })).resolves.toEqual({
      duplicate: false,
      noticeId: "notice-1",
      providerSessionId: "provider-1",
    });
    expect(dbMock.captureProviderWebhookReceipt.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        provider: "AGORA",
        noticeId: "notice-1",
        providerSessionId: "provider-1",
        providerAgentId: "agent-1",
        eventType: 101,
        payloadFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    }));
    expect(
      dbMock.captureProviderWebhookReceipt.create.mock.calls[0][0].data,
    ).not.toHaveProperty("payload");
    expect(dbMock.captureProviderSession.updateMany).toHaveBeenCalledWith({
      where: { id: "provider-1", status: "STARTING" },
      data: expect.objectContaining({ status: "RUNNING" }),
    });
  });

  it("treats noticeId replays as success without applying the event twice", async () => {
    dbMock.captureProviderWebhookReceipt.findUnique.mockResolvedValue({
      id: "receipt-1",
      providerSessionId: "provider-1",
      processedAt: new Date("2026-07-18T00:00:01Z"),
    });
    dbMock.captureProviderWebhookReceipt.update.mockResolvedValue({ id: "receipt-1" });

    await expect(
      processAgoraWebhook({
        rawBody: joinedBody,
        payload: parseAgoraWebhookPayload(joinedBody),
      }),
    ).resolves.toEqual({
      duplicate: true,
      noticeId: "notice-1",
      providerSessionId: "provider-1",
    });
    expect(dbMock.captureProviderSession.updateMany).not.toHaveBeenCalled();
    expect(dbMock.captureProviderWebhookReceipt.update).toHaveBeenCalledWith({
      where: { id: "receipt-1" },
      data: { duplicateReceptionCount: { increment: 1 } },
    });
  });

  it("resumes an unprocessed receipt instead of dropping the replay", async () => {
    dbMock.captureProviderWebhookReceipt.findUnique.mockResolvedValue({
      id: "receipt-1",
      providerSessionId: "provider-1",
      processedAt: null,
    });
    dbMock.captureProviderSession.findFirst.mockResolvedValue({
      id: "provider-1",
      status: "STARTING",
    });
    dbMock.captureProviderSession.updateMany.mockResolvedValue({ count: 1 });
    dbMock.captureProviderWebhookReceipt.update.mockResolvedValue({ id: "receipt-1" });

    await expect(
      processAgoraWebhook({
        rawBody: joinedBody,
        payload: parseAgoraWebhookPayload(joinedBody),
      }),
    ).resolves.toMatchObject({
      duplicate: true,
      resumed: true,
      providerSessionId: "provider-1",
    });
    expect(dbMock.captureProviderSession.updateMany).toHaveBeenCalledWith({
      where: { id: "provider-1", status: "STARTING" },
      data: expect.objectContaining({ status: "RUNNING" }),
    });
    expect(dbMock.captureProviderWebhookReceipt.update).toHaveBeenCalledWith({
      where: { id: "receipt-1" },
      data: { processedAt: expect.any(Date) },
    });
  });

  it("marks an unexpected agent-left event degraded but never rolls back terminal or stopping states", async () => {
    const leftBody = Buffer.from(
      JSON.stringify({
        sid: "agent-1",
        noticeId: "notice-2",
        productId: 20,
        eventType: 102,
        notifyMs: 1784354401000,
        payload: {
          agent_id: "agent-1",
          channel: "channel-1",
          status: "FAILED",
          message: "RTC connection error",
          stop_ts: 1784354401,
        },
      }),
    );
    dbMock.captureProviderWebhookReceipt.findUnique.mockResolvedValue(null);
    dbMock.captureProviderSession.findFirst.mockResolvedValue({
      id: "provider-1",
      status: "STOPPING",
    });
    dbMock.captureProviderWebhookReceipt.create.mockResolvedValue({
      id: "receipt-2",
    });
    dbMock.captureProviderSession.updateMany.mockResolvedValue({ count: 0 });
    dbMock.captureProviderWebhookReceipt.update.mockResolvedValue({ id: "receipt-2" });

    await processAgoraWebhook({
      rawBody: leftBody,
      payload: parseAgoraWebhookPayload(leftBody),
    });

    expect(dbMock.captureProviderSession.updateMany).toHaveBeenCalledWith({
      where: {
        id: "provider-1",
        status: { in: ["STARTING", "RUNNING"] },
      },
      data: expect.objectContaining({
        status: "DEGRADED",
        degradedReason: "AGORA_AGENT_LEFT_FAILED",
      }),
    });
  });

  it("rejects malformed envelopes and non-STT product IDs", () => {
    expect(() => parseAgoraWebhookPayload(Buffer.from("not-json"))).toThrow(
      "Agora webhook body is not valid JSON",
    );
    expect(() =>
      parseAgoraWebhookPayload(
        Buffer.from(
          JSON.stringify({
            sid: "agent-1",
            noticeId: "notice-1",
            productId: 1,
            eventType: 101,
            notifyMs: 1,
            payload: {},
          }),
        ),
      ),
    ).toThrow("Agora webhook body has an invalid shape");
  });
});
