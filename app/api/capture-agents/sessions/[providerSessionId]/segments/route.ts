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
  segments: z
    .array(
      z.object({
        sourceUid: z.string().regex(/^\d{1,20}$/),
        sentenceId: z.string().regex(/^\d{1,20}$/),
        text: z.string().trim().min(1).max(4000),
        textTsMs: z.string().regex(/^\d{1,20}$/),
        durationMs: z.number().int().min(0).max(3_600_000),
        language: z.string().trim().min(2).max(32),
        isFinal: z.literal(true),
      }),
    )
    .min(1)
    .max(100),
});

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
  if (!hasJsonContentType(request)) {
    return errorResponse(
      "Field capture accepts final transcript JSON only; audio must go directly to Agora RTC",
      "UNSUPPORTED_MEDIA_TYPE",
      415,
    );
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse(
      "Only bounded final Agora transcript segments are accepted",
      "INVALID_FINAL_TRANSCRIPT_SEGMENTS",
      400,
    );
  }
  const { providerSessionId } = await context.params;

  try {
    const result = await new AgoraFieldCaptureService().ingestSegments({
      credential,
      providerSessionId,
      segments: parsed.data.segments,
    });
    return successResponse(result, "final transcript segments accepted");
  } catch (error) {
    if (isFieldCaptureServiceError(error)) {
      return errorResponse(error.message, error.code, error.httpStatus);
    }
    return errorResponse(
      "Final transcript segments could not be accepted",
      "FINAL_TRANSCRIPT_INGEST_FAILED",
      500,
    );
  }
}
