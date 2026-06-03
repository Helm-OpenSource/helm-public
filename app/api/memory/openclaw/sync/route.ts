import { ActorType } from "@prisma/client";
import { z } from "zod";
import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import { canManageOpenClawRuntime, getOpenClawRuntimeDeniedMessage } from "@/lib/auth/openclaw-runtime-governance";
import {
  buildOpenClawOperatorSafeErrorSummary,
  syncOpenClawMemory,
} from "@/lib/integrations/openclaw-memory";
import { isEnglishWorkspaceDefaultLocale } from "@/lib/i18n/api-message-locale";
import { errorResponse, successResponse } from "@/lib/memory/shared";

const schema = z.object({
  sourceMode: z.enum(["lancedb", "backup_jsonl"]).optional(),
  maxItems: z.number().int().min(1).max(20000).optional(),
});

export async function POST(request: Request) {
  const { user, membership, workspace } = await getCurrentWorkspaceSession();
  const english = isEnglishWorkspaceDefaultLocale(workspace.defaultLocale);

  if (!canManageOpenClawRuntime(membership.role)) {
    return errorResponse(getOpenClawRuntimeDeniedMessage(english), "OPENCLAW_RUNTIME_GOVERNANCE_REQUIRED", 403);
  }

  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? "Invalid sync payload", "INVALID_PAYLOAD", 400);
  }

  try {
    const stats = await syncOpenClawMemory({
      workspaceId: workspace.id,
      sourcePage: "/memory",
      trigger: "manual",
      actorName: user.name,
      actorType: ActorType.USER,
      actorUserId: user.id,
      sourceMode: parsed.data.sourceMode,
      maxItems: parsed.data.maxItems,
    });

    return successResponse(
      stats,
      english ? "OpenClaw memory sync completed" : "OpenClaw 记忆同步已完成",
    );
  } catch (error) {
    const safeMessage =
      buildOpenClawOperatorSafeErrorSummary(error instanceof Error ? error.message : String(error)) ??
      "OpenClaw memory sync failed";

    return errorResponse(
      safeMessage,
      "OPENCLAW_MEMORY_SYNC_FAILED",
      500,
    );
  }
}
