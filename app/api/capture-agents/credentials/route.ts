import { CaptureTranscriptRetentionMode } from "@prisma/client";
import { addDays } from "date-fns";
import { z } from "zod";
import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import {
  canManageWorkspaceCaptureSessions,
  getCaptureManagementDeniedMessage,
} from "@/lib/auth/capture-runtime-governance";
import { db } from "@/lib/db";
import { issueCaptureAgentCredential } from "@/lib/integrations/agora-field-capture/capture-agent-auth.service";
import { hasJsonContentType } from "@/lib/integrations/agora-field-capture/request-boundary";
import { isEnglishWorkspaceDefaultLocale } from "@/lib/i18n/api-message-locale";
import { errorResponse, successResponse } from "@/lib/memory/shared";
import { serverErrorMessage } from "@/lib/http/server-error";

export const runtime = "nodejs";

const schema = z.object({
  name: z.string().trim().min(1).max(80),
  transcriptRetention: z
    .nativeEnum(CaptureTranscriptRetentionMode)
    .default(CaptureTranscriptRetentionMode.DERIVED_ONLY),
  expiresInDays: z.number().int().min(1).max(90).default(30),
});

export async function GET() {
  const { membership, workspace } = await getCurrentWorkspaceSession();
  const english = isEnglishWorkspaceDefaultLocale(workspace.defaultLocale);
  if (!canManageWorkspaceCaptureSessions(membership.role)) {
    return errorResponse(
      getCaptureManagementDeniedMessage(english),
      "CAPTURE_GOVERNANCE_REQUIRED",
      403,
    );
  }

  const credentials = await db.captureAgentCredential.findMany({
    where: { workspaceId: workspace.id },
    select: {
      id: true,
      name: true,
      tokenPrefix: true,
      status: true,
      transcriptRetention: true,
      expiresAt: true,
      revokedAt: true,
      lastSeenAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
  return successResponse(credentials, english ? "capture agents listed" : "采集端列表已读取");
}

export async function POST(request: Request) {
  const { user, membership, workspace } = await getCurrentWorkspaceSession();
  const english = isEnglishWorkspaceDefaultLocale(workspace.defaultLocale);
  if (!canManageWorkspaceCaptureSessions(membership.role)) {
    return errorResponse(
      getCaptureManagementDeniedMessage(english),
      "CAPTURE_GOVERNANCE_REQUIRED",
      403,
    );
  }
  if (!hasJsonContentType(request)) {
    return errorResponse("Capture agent provisioning requires application/json", "UNSUPPORTED_MEDIA_TYPE", 415);
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse("Invalid capture agent provisioning request", "INVALID_CAPTURE_AGENT_INPUT", 400);
  }

  try {
    const result = await issueCaptureAgentCredential({
      workspaceId: workspace.id,
      name: parsed.data.name,
      actorUserId: user.id,
      actorName: user.name,
      transcriptRetention: parsed.data.transcriptRetention,
      expiresAt: addDays(new Date(), parsed.data.expiresInDays),
    });
    return successResponse(
      result,
      english
        ? "Capture agent credential issued. The token is shown once."
        : "采集端凭证已签发，token 只显示一次。",
    );
  } catch (error) {
    return errorResponse(
      serverErrorMessage(error, "Failed to issue capture agent credential"),
      "CAPTURE_AGENT_ISSUE_FAILED",
      500,
    );
  }
}
