import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import {
  canManageWorkspaceCaptureSessions,
  getCaptureManagementDeniedMessage,
} from "@/lib/auth/capture-runtime-governance";
import { revokeCaptureAgentCredential } from "@/lib/integrations/agora-field-capture/capture-agent-auth.service";
import { isEnglishWorkspaceDefaultLocale } from "@/lib/i18n/api-message-locale";
import { errorResponse, successResponse } from "@/lib/memory/shared";
import { serverErrorMessage } from "@/lib/http/server-error";

export const runtime = "nodejs";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ credentialId: string }> },
) {
  const { user, membership, workspace } = await getCurrentWorkspaceSession();
  const english = isEnglishWorkspaceDefaultLocale(workspace.defaultLocale);
  if (!canManageWorkspaceCaptureSessions(membership.role)) {
    return errorResponse(
      getCaptureManagementDeniedMessage(english),
      "CAPTURE_GOVERNANCE_REQUIRED",
      403,
    );
  }
  const { credentialId } = await context.params;

  try {
    const result = await revokeCaptureAgentCredential({
      workspaceId: workspace.id,
      credentialId,
      actorUserId: user.id,
      actorName: user.name,
    });
    return successResponse(result, english ? "capture agent revoked" : "采集端凭证已吊销");
  } catch (error) {
    const message = serverErrorMessage(error, "Failed to revoke capture agent credential");
    return errorResponse(
      message,
      message.includes("active capture session")
        ? "CAPTURE_AGENT_SESSION_ACTIVE"
        : "CAPTURE_AGENT_REVOKE_FAILED",
      message.includes("active capture session") ? 409 : 404,
    );
  }
}
