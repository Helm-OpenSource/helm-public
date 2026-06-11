import { ActorType, CaptureSourceType, ObjectType, UsageType } from "@prisma/client";
import { z } from "zod";
import { ensureWorkspaceProcessingAllowed, recordUsageLedgerEntry } from "@/lib/billing/foundation";
import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import {
  canManageWorkspaceCaptureSessions,
  getCaptureManagementDeniedMessage,
} from "@/lib/auth/capture-runtime-governance";
import { assertWorkspaceObjectOwnership, isWorkspaceOwnershipError } from "@/lib/auth/tenant-ownership";
import { startCaptureSession } from "@/lib/conversation-capture/capture-session.service";
import { isEnglishWorkspaceDefaultLocale } from "@/lib/i18n/api-message-locale";
import { errorResponse, successResponse } from "@/lib/memory/shared";
import { serverErrorMessage } from "@/lib/http/server-error";

const schema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  objectType: z.nativeEnum(ObjectType).optional().nullable(),
  objectId: z.string().trim().optional().nullable(),
  sourceType: z.nativeEnum(CaptureSourceType).optional(),
  sourceId: z.string().trim().optional().nullable(),
});

export async function POST(request: Request) {
  const { user, membership, workspace } = await getCurrentWorkspaceSession();
  const english = isEnglishWorkspaceDefaultLocale(workspace.defaultLocale);

  if (!canManageWorkspaceCaptureSessions(membership.role)) {
    return errorResponse(getCaptureManagementDeniedMessage(english), "CAPTURE_GOVERNANCE_REQUIRED", 403);
  }

  await ensureWorkspaceProcessingAllowed({
    workspaceId: workspace.id,
    english,
    operation: "CAPTURE_START",
  });
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return errorResponse(english ? "Please provide a session title or linked context first" : "请先补充会话标题或上下文信息", "INVALID_CAPTURE_INPUT", 400);
  }

  try {
    if (parsed.data.objectType && parsed.data.objectId) {
      await assertWorkspaceObjectOwnership({
        workspaceId: workspace.id,
        objectType: parsed.data.objectType,
        objectId: parsed.data.objectId,
      });
    }

    const session = await startCaptureSession({
      workspaceId: workspace.id,
      actorName: user.name,
      actorUserId: user.id,
      actorType: ActorType.USER,
      english,
      sourcePage: "/capture",
      title: parsed.data.title,
      objectType: parsed.data.objectType ?? null,
      objectId: parsed.data.objectId ?? null,
      sourceType: parsed.data.sourceType,
      sourceId: parsed.data.sourceId ?? null,
    });

    await recordUsageLedgerEntry({
      workspaceId: workspace.id,
      userId: user.id,
      usageType: UsageType.CAPTURE_PROCESSING,
      sourcePage: "/capture",
      metadata: {
        captureSessionId: session.id,
        operation: "start_capture",
        objectType: parsed.data.objectType ?? null,
        objectId: parsed.data.objectId ?? null,
      },
    });

    return successResponse(session, english ? "capture session started" : "会议记录已开始");
  } catch (error) {
    return errorResponse(
      isWorkspaceOwnershipError(error) ? error.message : serverErrorMessage(error, english ? "Failed to start capture session" : "启动会议记录失败"),
      isWorkspaceOwnershipError(error) ? "OBJECT_NOT_FOUND" : "CAPTURE_START_FAILED",
      isWorkspaceOwnershipError(error) ? 404 : 500,
    );
  }
}
