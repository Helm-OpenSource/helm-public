import { z } from "zod";
import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import { isEnglishWorkspaceDefaultLocale } from "@/lib/i18n/api-message-locale";
import {
  canManageWorkspaceRuntime,
  getRuntimeManagementDeniedMessage,
} from "@/lib/auth/capture-runtime-governance";
import { assertWorkspaceRuntimeSessionOwnership, isWorkspaceOwnershipError } from "@/lib/auth/tenant-ownership";
import { pruneRuntimeSessionContext } from "@/lib/helm-v2/runtime-upgrade";
import { serverErrorMessage } from "@/lib/http/server-error";

const pruneSchema = z.object({
  sessionId: z.string().min(1),
  targetTokenBudget: z.number().int().positive().optional(),
});

export async function POST(request: Request) {
  const { membership, workspace } = await getCurrentWorkspaceSession();
  const english = isEnglishWorkspaceDefaultLocale(workspace.defaultLocale);
  const payload = pruneSchema.safeParse(await request.json().catch(() => ({})));

  if (!payload.success) {
    return Response.json({ success: false, message: payload.error.issues[0]?.message ?? "参数不完整" }, { status: 400 });
  }

  if (!canManageWorkspaceRuntime(membership.role)) {
    return Response.json({ success: false, message: getRuntimeManagementDeniedMessage(english) }, { status: 403 });
  }

  try {
    await assertWorkspaceRuntimeSessionOwnership(workspace.id, payload.data.sessionId);

    const result = await pruneRuntimeSessionContext({
      workspaceId: workspace.id,
      sessionId: payload.data.sessionId,
      targetTokenBudget: payload.data.targetTokenBudget,
    });

    return Response.json({ success: true, data: result });
  } catch (error) {
    return Response.json(
      { success: false, message: isWorkspaceOwnershipError(error) ? error.message : serverErrorMessage(error, "Context prune failed") },
      { status: isWorkspaceOwnershipError(error) ? 404 : 500 },
    );
  }
}
