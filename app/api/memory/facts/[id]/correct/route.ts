import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import { assertWorkspaceMemoryFactOwnership, isWorkspaceOwnershipError } from "@/lib/auth/tenant-ownership";
import {
  isEnglishWorkspaceDefaultLocale,
  resolveApiValidationIssueMessage,
} from "@/lib/i18n/api-message-locale";
import { correctMemoryFact } from "@/lib/memory/correction.service";
import { errorResponse, successResponse } from "@/lib/memory/shared";
import { correctMemoryFactSchema } from "@/lib/memory/schemas";
import { canManageMemoryFacts, getMemoryFactManagementDeniedMessage } from "@/lib/memory/permissions";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentWorkspaceSession();
  const { user, membership, workspace } = session;
  const { id } = await params;
  const english = isEnglishWorkspaceDefaultLocale(workspace.defaultLocale);
  const payload = correctMemoryFactSchema.safeParse(await request.json());

  if (!payload.success) {
    return errorResponse(
      resolveApiValidationIssueMessage(workspace.defaultLocale, payload.error.issues[0]?.message),
    );
  }

  if (!canManageMemoryFacts(membership.role)) {
    return errorResponse(
      getMemoryFactManagementDeniedMessage(english),
      "FORBIDDEN",
      403,
    );
  }

  try {
    await assertWorkspaceMemoryFactOwnership(workspace.id, id);

    const result = await correctMemoryFact({
      workspaceId: workspace.id,
      actorName: user.name,
      actorUserId: user.id,
      actorType: "USER",
      sourcePage: "/memory",
      memoryFactId: id,
      correctionType: payload.data.correctionType,
      afterValue: payload.data.afterValue,
      reason: payload.data.reason,
    });

    return successResponse(
      {
        memoryFactId: result.fact.id,
        correctionId: result.correction.id,
        updatedContent: result.fact.content,
      },
      english ? "Memory fact corrected" : "记忆事实已修正",
    );
  } catch (error) {
    return errorResponse(
      error instanceof Error
        ? error.message
        : english
          ? "Failed to correct memory fact"
          : "记忆修正失败",
      isWorkspaceOwnershipError(error) ? "FACT_NOT_FOUND" : "CORRECTION_FAILED",
      isWorkspaceOwnershipError(error) ? 404 : 500,
    );
  }
}
