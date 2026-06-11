import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import { isEnglishWorkspaceDefaultLocale } from "@/lib/i18n/api-message-locale";
import {
  canReviewWorkspaceRuntime,
  getRuntimeReviewDeniedMessage,
} from "@/lib/auth/capture-runtime-governance";
import {
  assertWorkspaceMemoryCandidateOwnership,
  isWorkspaceOwnershipError,
} from "@/lib/auth/tenant-ownership";
import { acceptReflectionCandidate } from "@/lib/helm-v2/runtime-upgrade";
import { serverErrorMessage } from "@/lib/http/server-error";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, membership, workspace } = await getCurrentWorkspaceSession();
  const english = isEnglishWorkspaceDefaultLocale(workspace.defaultLocale);
  const { id } = await params;

  if (!canReviewWorkspaceRuntime(membership.role)) {
    return Response.json({ success: false, message: getRuntimeReviewDeniedMessage(english) }, { status: 403 });
  }

  try {
    await assertWorkspaceMemoryCandidateOwnership(workspace.id, id);

    const data = await acceptReflectionCandidate({
      workspaceId: workspace.id,
      candidateId: id,
      userId: user.id,
      actorName: user.name,
      sourcePage: "/operating",
    });

    return Response.json({ success: true, data });
  } catch (error) {
    return Response.json(
      {
        success: false,
        message: isWorkspaceOwnershipError(error) ? error.message : serverErrorMessage(error, "Reflection candidate accept failed"),
      },
      { status: isWorkspaceOwnershipError(error) ? 404 : 500 },
    );
  }
}
