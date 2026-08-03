import {
  authenticateCaptureAgentAuthorization,
  isCaptureAgentAuthorizationError,
} from "@/lib/integrations/agora-field-capture/capture-agent-auth.service";
import { resolveAgoraSttConfig } from "@/lib/integrations/agora-field-capture/agora-stt-client";
import { errorResponse, successResponse } from "@/lib/memory/shared";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await authenticateCaptureAgentAuthorization(
      request.headers.get("authorization"),
      { touch: true },
    );
  } catch (error) {
    if (isCaptureAgentAuthorizationError(error)) {
      return errorResponse(error.message, error.code, 401);
    }
    throw error;
  }

  try {
    const config = resolveAgoraSttConfig();
    return successResponse(
      {
        protocolVersion: "agora-field-capture/v1",
        provider: "AGORA",
        mode: config.mode,
        rtcAppId: config.appId,
        supportedLanguages: ["zh-CN", "en-US"],
        consentNoticeVersion: "field-capture-consent/v1",
        rawAudioAcceptedByHelm: false,
        rawAudioStoredByHelm: false,
      },
      "field capture bootstrap loaded",
    );
  } catch {
    return errorResponse(
      "Agora field capture is not configured",
      "AGORA_FIELD_CAPTURE_NOT_CONFIGURED",
      503,
    );
  }
}
