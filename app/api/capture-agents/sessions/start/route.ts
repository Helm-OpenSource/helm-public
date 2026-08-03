import { z } from "zod";
import {
  authenticateCaptureAgentAuthorization,
  isCaptureAgentAuthorizationError,
} from "@/lib/integrations/agora-field-capture/capture-agent-auth.service";
import {
  AgoraFieldCaptureService,
  isFieldCaptureServiceError,
} from "@/lib/integrations/agora-field-capture/field-capture.service";
import { hasJsonContentType } from "@/lib/integrations/agora-field-capture/request-boundary";
import { errorResponse, successResponse } from "@/lib/memory/shared";

export const runtime = "nodejs";

const schema = z.object({
  title: z.string().trim().min(1).max(120),
  language: z.enum(["zh-CN", "en-US"]).default("zh-CN"),
  consent: z.object({
    confirmed: z.literal(true),
    counterpartyNotified: z.literal(true),
    noticeTextVersion: z.string().trim().min(1).max(80),
  }),
});

export async function POST(request: Request) {
  let credential;
  try {
    credential = await authenticateCaptureAgentAuthorization(
      request.headers.get("authorization"),
      { touch: true },
    );
  } catch (error) {
    if (isCaptureAgentAuthorizationError(error)) {
      return errorResponse(error.message, error.code, 401);
    }
    throw error;
  }
  if (!hasJsonContentType(request)) {
    return errorResponse(
      "Field capture accepts JSON control data only; audio must go directly to Agora RTC",
      "UNSUPPORTED_MEDIA_TYPE",
      415,
    );
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse(
      "Field capture requires a title plus confirmed consent and counterparty notice",
      "INVALID_FIELD_CAPTURE_START",
      400,
    );
  }

  try {
    const result = await new AgoraFieldCaptureService().start({
      credential,
      ...parsed.data,
    });
    return successResponse(result, "field capture started");
  } catch (error) {
    if (isFieldCaptureServiceError(error)) {
      return errorResponse(error.message, error.code, error.httpStatus);
    }
    return errorResponse("Field capture could not be started", "FIELD_CAPTURE_START_FAILED", 500);
  }
}
