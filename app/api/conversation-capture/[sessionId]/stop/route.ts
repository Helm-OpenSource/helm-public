import { ActorType, UsageType } from "@prisma/client";
import { z } from "zod";
import { ensureWorkspaceProcessingAllowed, recordUsageLedgerEntry } from "@/lib/billing/foundation";
import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import {
  canManageWorkspaceCaptureSessions,
  getCaptureManagementDeniedMessage,
} from "@/lib/auth/capture-runtime-governance";
import { assertWorkspaceCaptureSessionOwnership, isWorkspaceOwnershipError } from "@/lib/auth/tenant-ownership";
import { stopCaptureSession } from "@/lib/conversation-capture/capture-session.service";
import { isEnglishWorkspaceDefaultLocale } from "@/lib/i18n/api-message-locale";
import { errorResponse, successResponse } from "@/lib/memory/shared";

const schema = z.object({
  transcriptText: z.string().trim().optional().nullable(),
  title: z.string().trim().optional().nullable(),
});

export async function POST(
  request: Request,
  context: {
    params: Promise<{ sessionId: string }>;
  },
) {
  const { user, membership, workspace } = await getCurrentWorkspaceSession();
  const english = isEnglishWorkspaceDefaultLocale(workspace.defaultLocale);

  if (!canManageWorkspaceCaptureSessions(membership.role)) {
    return errorResponse(getCaptureManagementDeniedMessage(english), "CAPTURE_GOVERNANCE_REQUIRED", 403);
  }

  await ensureWorkspaceProcessingAllowed({
    workspaceId: workspace.id,
    english,
    operation: "CAPTURE_STOP",
  });
  const params = await context.params;
  const contentType = request.headers.get("content-type") ?? "";
  let body: Record<string, unknown> | null = null;
  let audioFile: File | null = null;

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData().catch(() => null);
    if (formData) {
      const maybeFile = formData.get("audio");
      audioFile = maybeFile instanceof File ? maybeFile : null;
      body = {
        transcriptText: typeof formData.get("transcriptText") === "string" ? formData.get("transcriptText") : null,
        title: typeof formData.get("title") === "string" ? formData.get("title") : null,
      };
    }
  } else {
    body = await request.json().catch(() => null);
  }

  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return errorResponse(english ? "Please provide the fields required to stop capture" : "请补充结束记录所需的信息", "INVALID_CAPTURE_STOP", 400);
  }

  try {
    await assertWorkspaceCaptureSessionOwnership(workspace.id, params.sessionId);

    const result = await stopCaptureSession({
      workspaceId: workspace.id,
      actorName: user.name,
      actorUserId: user.id,
      actorType: ActorType.USER,
      english,
      sourcePage: "/capture",
      captureSessionId: params.sessionId,
      transcriptText: parsed.data.transcriptText,
      audioFile,
      title: parsed.data.title,
    });

    await recordUsageLedgerEntry({
      workspaceId: workspace.id,
      userId: user.id,
      usageType: UsageType.CAPTURE_PROCESSING,
      sourcePage: "/capture",
      metadata: {
        captureSessionId: params.sessionId,
        operation: "stop_capture",
        transcriptProvided: Boolean(parsed.data.transcriptText),
        audioUploaded: Boolean(audioFile),
      },
    });

    return successResponse(result, english ? "capture session processed" : "会议记录已处理");
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : english ? "Failed to stop and process capture" : "结束记录失败",
      isWorkspaceOwnershipError(error) ? "CAPTURE_NOT_FOUND" : "CAPTURE_PROCESS_FAILED",
      isWorkspaceOwnershipError(error) ? 404 : 500,
    );
  }
}
