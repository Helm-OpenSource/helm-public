import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import { canManageOpenClawRuntime, getOpenClawRuntimeDeniedMessage } from "@/lib/auth/openclaw-runtime-governance";
import { getOpenClawMemorySyncStatus, toOperatorSafeOpenClawMemorySyncStatus } from "@/lib/integrations/openclaw-memory";
import { isEnglishWorkspaceDefaultLocale } from "@/lib/i18n/api-message-locale";
import { errorResponse, successResponse } from "@/lib/memory/shared";

export async function GET() {
  const { membership, workspace } = await getCurrentWorkspaceSession();
  const english = isEnglishWorkspaceDefaultLocale(workspace.defaultLocale);

  if (!canManageOpenClawRuntime(membership.role)) {
    return errorResponse(getOpenClawRuntimeDeniedMessage(english), "OPENCLAW_RUNTIME_GOVERNANCE_REQUIRED", 403);
  }

  const status = await getOpenClawMemorySyncStatus(workspace.id);

  return successResponse(
    {
      provider: "OPENCLAW",
      status: toOperatorSafeOpenClawMemorySyncStatus(status),
    },
    "ok",
  );
}
