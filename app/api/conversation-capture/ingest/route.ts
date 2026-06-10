import { ActorType, CaptureSourceType, ObjectType } from "@prisma/client";
import { z } from "zod";
import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import {
  canManageWorkspaceCaptureSessions,
  getCaptureManagementDeniedMessage,
} from "@/lib/auth/capture-runtime-governance";
import { assertWorkspaceObjectOwnership, isWorkspaceOwnershipError } from "@/lib/auth/tenant-ownership";
import { ingestConversationCapture } from "@/lib/conversation-capture/capture-session.service";
import { isEnglishWorkspaceDefaultLocale } from "@/lib/i18n/api-message-locale";
import { errorResponse, successResponse } from "@/lib/memory/shared";
import { serverErrorMessage } from "@/lib/http/server-error";

const schema = z.object({
  title: z.string().trim().min(1).max(120),
  transcriptText: z.string().trim().min(10),
  transcriptSegments: z
    .array(
      z.object({
        speaker: z.string().trim().min(1).max(80),
        startedAt: z.number().int().min(0),
        endedAt: z.number().int().min(0),
        text: z.string().trim().min(1),
      }),
    )
    .optional()
    .nullable(),
  transcriptLanguage: z.string().trim().min(2).max(32).optional().nullable(),
  transcriptConfidence: z.number().int().min(0).max(100).optional().nullable(),
  transcriptProvider: z.string().trim().min(1).max(80).optional().nullable(),
  transcriptModel: z.string().trim().min(1).max(120).optional().nullable(),
  objectType: z.nativeEnum(ObjectType).optional().nullable(),
  objectId: z.string().trim().optional().nullable(),
  sourceType: z.nativeEnum(CaptureSourceType).default(CaptureSourceType.OTHER),
  sourceId: z.string().trim().optional().nullable(),
});

export async function POST(request: Request) {
  const { user, membership, workspace } = await getCurrentWorkspaceSession();
  const english = isEnglishWorkspaceDefaultLocale(workspace.defaultLocale);
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return errorResponse(english ? "Please provide transcript text and a title" : "请提供 transcript 文本与标题", "INVALID_CAPTURE_INGEST", 400);
  }

  if (!canManageWorkspaceCaptureSessions(membership.role)) {
    return errorResponse(getCaptureManagementDeniedMessage(english), "CAPTURE_GOVERNANCE_REQUIRED", 403);
  }

  try {
    if (parsed.data.objectType && parsed.data.objectId) {
      await assertWorkspaceObjectOwnership({
        workspaceId: workspace.id,
        objectType: parsed.data.objectType,
        objectId: parsed.data.objectId,
      });
    }

    const result = await ingestConversationCapture({
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
      transcriptText: parsed.data.transcriptText,
      transcriptSegments: parsed.data.transcriptSegments ?? null,
      transcriptLanguage: parsed.data.transcriptLanguage ?? null,
      transcriptConfidence: parsed.data.transcriptConfidence ?? null,
      transcriptProvider: parsed.data.transcriptProvider ?? null,
      transcriptModel: parsed.data.transcriptModel ?? null,
    });

    return successResponse(result, "capture ingested");
  } catch (error) {
    return errorResponse(
      isWorkspaceOwnershipError(error) ? error.message : serverErrorMessage(error, english ? "Failed to ingest external conversation" : "外部会话导入失败"),
      isWorkspaceOwnershipError(error) ? "OBJECT_NOT_FOUND" : "CAPTURE_INGEST_FAILED",
      isWorkspaceOwnershipError(error) ? 404 : 500,
    );
  }
}
