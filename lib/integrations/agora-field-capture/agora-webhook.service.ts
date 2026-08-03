import { createHash } from "node:crypto";
import {
  CaptureProvider,
  CaptureProviderSessionStatus,
} from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";

const webhookPayloadSchema = z.object({
  sid: z.string().trim().min(1).max(191),
  noticeId: z.string().trim().min(1).max(191),
  productId: z.literal(20),
  eventType: z.number().int().nonnegative(),
  notifyMs: z.number().int().nonnegative(),
  payload: z.record(z.string(), z.unknown()),
});

export type AgoraWebhookPayload = z.infer<typeof webhookPayloadSchema>;

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function parseAgoraWebhookPayload(rawBody: Buffer): AgoraWebhookPayload {
  let candidate: unknown;
  try {
    candidate = JSON.parse(rawBody.toString("utf8"));
  } catch {
    throw new Error("Agora webhook body is not valid JSON");
  }
  const parsed = webhookPayloadSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new Error("Agora webhook body has an invalid shape");
  }
  return parsed.data;
}

export async function processAgoraWebhook(input: {
  rawBody: Buffer;
  payload: AgoraWebhookPayload;
}) {
  let existing = await db.captureProviderWebhookReceipt.findUnique({
    where: {
      provider_noticeId: {
        provider: CaptureProvider.AGORA,
        noticeId: input.payload.noticeId,
      },
    },
    select: { id: true, providerSessionId: true, processedAt: true },
  });
  if (existing) {
    await db.captureProviderWebhookReceipt.update({
      where: { id: existing.id },
      data: { duplicateReceptionCount: { increment: 1 } },
    });
    if (existing.processedAt) {
      return {
        duplicate: true,
        noticeId: input.payload.noticeId,
        providerSessionId: existing.providerSessionId,
      };
    }
  }

  const providerAgentId =
    optionalString(input.payload.payload.agent_id) ?? input.payload.sid;
  const channelName = optionalString(input.payload.payload.channel);
  const providerSession = await db.captureProviderSession.findFirst({
    where: existing?.providerSessionId
      ? {
          id: existing.providerSessionId,
          provider: CaptureProvider.AGORA,
        }
      : {
          provider: CaptureProvider.AGORA,
          OR: [
            { providerAgentId },
            ...(channelName ? [{ channelName }] : []),
          ],
        },
    select: { id: true, status: true },
  });
  const payloadFingerprint = createHash("sha256")
    .update(input.rawBody)
    .digest("hex");

  let receiptId = existing?.id ?? null;
  let resumed = Boolean(existing);
  if (!receiptId) {
    try {
      const created = await db.captureProviderWebhookReceipt.create({
        data: {
          provider: CaptureProvider.AGORA,
          noticeId: input.payload.noticeId,
          providerSessionId: providerSession?.id,
          providerAgentId,
          productId: input.payload.productId,
          eventType: input.payload.eventType,
          notifyMs: String(input.payload.notifyMs),
          payloadFingerprint,
        },
        select: { id: true },
      });
      receiptId = created.id;
    } catch (error) {
      if ((error as { code?: string })?.code !== "P2002") throw error;
      existing = await db.captureProviderWebhookReceipt.findUnique({
        where: {
          provider_noticeId: {
            provider: CaptureProvider.AGORA,
            noticeId: input.payload.noticeId,
          },
        },
        select: { id: true, providerSessionId: true, processedAt: true },
      });
      if (!existing) throw error;
      await db.captureProviderWebhookReceipt.update({
        where: { id: existing.id },
        data: { duplicateReceptionCount: { increment: 1 } },
      });
      if (existing.processedAt) {
        return {
          duplicate: true,
          noticeId: input.payload.noticeId,
          providerSessionId: existing.providerSessionId,
        };
      }
      receiptId = existing.id;
      resumed = true;
    }
  }

  if (!receiptId) {
    throw new Error("Agora webhook receipt could not be claimed");
  }
  if (providerSession && !existing?.providerSessionId) {
    await db.captureProviderWebhookReceipt.update({
      where: { id: receiptId },
      data: { providerSessionId: providerSession.id },
    });
  }

  if (providerSession && input.payload.eventType === 101) {
    const startTs = Number(input.payload.payload.start_ts);
    await db.captureProviderSession.updateMany({
      where: {
        id: providerSession.id,
        status: CaptureProviderSessionStatus.STARTING,
      },
      data: {
        status: CaptureProviderSessionStatus.RUNNING,
        startedAt:
          Number.isFinite(startTs) && startTs > 0
            ? new Date(startTs * (startTs < 10_000_000_000 ? 1000 : 1))
            : undefined,
      },
    });
  }

  if (providerSession && input.payload.eventType === 102) {
    const providerStatus = optionalString(input.payload.payload.status);
    const providerMessage = optionalString(input.payload.payload.message);
    await db.captureProviderSession.updateMany({
      where: {
        id: providerSession.id,
        status: {
          in: [
            CaptureProviderSessionStatus.STARTING,
            CaptureProviderSessionStatus.RUNNING,
          ],
        },
      },
      data: {
        status: CaptureProviderSessionStatus.DEGRADED,
        degradedReason:
          providerStatus === "FAILED"
            ? "AGORA_AGENT_LEFT_FAILED"
            : "AGORA_AGENT_LEFT_UNEXPECTEDLY",
        errorMessage: providerMessage ?? "Agora STT agent left before Helm finalized the session",
      },
    });
  }

  await db.captureProviderWebhookReceipt.update({
    where: { id: receiptId },
    data: { processedAt: new Date() },
  });

  return {
    duplicate: resumed,
    ...(resumed ? { resumed: true } : {}),
    noticeId: input.payload.noticeId,
    providerSessionId: providerSession?.id ?? null,
  };
}
