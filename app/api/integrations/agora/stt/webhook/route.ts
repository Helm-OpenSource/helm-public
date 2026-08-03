import { resolveAgoraSttConfig } from "@/lib/integrations/agora-field-capture/agora-stt-client";
import {
  readBoundedAgoraWebhookBody,
  verifyAgoraWebhookSignature,
} from "@/lib/integrations/agora-field-capture/agora-webhook";
import { hasJsonContentType } from "@/lib/integrations/agora-field-capture/request-boundary";
import {
  parseAgoraWebhookPayload,
  processAgoraWebhook,
} from "@/lib/integrations/agora-field-capture/agora-webhook.service";
import { errorResponse, successResponse } from "@/lib/memory/shared";

export const runtime = "nodejs";
const MAX_WEBHOOK_BYTES = 256 * 1024;

export async function POST(request: Request) {
  let config;
  try {
    config = resolveAgoraSttConfig();
  } catch {
    return errorResponse("Agora STT webhook is not configured", "AGORA_STT_NOT_CONFIGURED", 503);
  }
  if (config.mode !== "REAL") {
    return errorResponse("Agora STT webhook is disabled in MOCK mode", "AGORA_STT_MOCK_MODE", 503);
  }
  if (!hasJsonContentType(request)) {
    return errorResponse("Agora webhook requires application/json", "INVALID_AGORA_WEBHOOK", 415);
  }

  let rawBody: Buffer;
  try {
    rawBody = await readBoundedAgoraWebhookBody(request, MAX_WEBHOOK_BYTES);
  } catch {
    return errorResponse("Agora webhook body size is invalid", "INVALID_AGORA_WEBHOOK", 400);
  }
  if (!rawBody.length) {
    return errorResponse("Agora webhook body size is invalid", "INVALID_AGORA_WEBHOOK", 400);
  }
  if (
    !verifyAgoraWebhookSignature({
      rawBody,
      secret: config.webhookSecret,
      signatureV2: request.headers.get("agora-signature-v2"),
    })
  ) {
    return errorResponse("Agora webhook signature is invalid", "INVALID_AGORA_SIGNATURE", 401);
  }

  let payload;
  try {
    payload = parseAgoraWebhookPayload(rawBody);
  } catch {
    return errorResponse("Agora webhook body could not be parsed", "INVALID_AGORA_WEBHOOK", 400);
  }

  try {
    const result = await processAgoraWebhook({ rawBody, payload });
    return successResponse(result, "agora webhook accepted");
  } catch {
    return errorResponse(
      "Agora webhook could not be durably processed; retry is required",
      "AGORA_WEBHOOK_PROCESSING_FAILED",
      503,
    );
  }
}
