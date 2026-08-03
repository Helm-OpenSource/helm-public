import {
  authenticateCaptureAgentAuthorization,
  isCaptureAgentAuthorizationError,
} from "@/lib/integrations/agora-field-capture/capture-agent-auth.service";
import {
  AgoraFieldCaptureService,
  isFieldCaptureServiceError,
} from "@/lib/integrations/agora-field-capture/field-capture.service";
import { hasRequestPayload } from "@/lib/integrations/agora-field-capture/request-boundary";
import { errorResponse, successResponse } from "@/lib/memory/shared";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ providerSessionId: string }> },
) {
  let credential;
  try {
    credential = await authenticateCaptureAgentAuthorization(
      request.headers.get("authorization"),
    );
  } catch (error) {
    if (isCaptureAgentAuthorizationError(error)) {
      return errorResponse(error.message, error.code, 401);
    }
    throw error;
  }
  if (hasRequestPayload(request)) {
    return errorResponse(
      "Field capture stop accepts no request payload; audio must go directly to Agora RTC",
      "UNSUPPORTED_MEDIA_TYPE",
      415,
    );
  }
  const { providerSessionId } = await context.params;

  try {
    const result = await new AgoraFieldCaptureService().stop({
      credential,
      providerSessionId,
    });
    return successResponse(result, "field capture stopped and analysis completed");
  } catch (error) {
    if (isFieldCaptureServiceError(error)) {
      return errorResponse(error.message, error.code, error.httpStatus);
    }
    return errorResponse("Field capture could not be stopped", "FIELD_CAPTURE_STOP_FAILED", 500);
  }
}
