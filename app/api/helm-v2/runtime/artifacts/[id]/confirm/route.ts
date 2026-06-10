import { z } from "zod";
import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import {
  isEnglishWorkspaceDefaultLocale,
  resolveApiValidationIssueMessage,
} from "@/lib/i18n/api-message-locale";
import {
  canReviewWorkspaceRuntime,
  getRuntimeReviewDeniedMessage,
} from "@/lib/auth/capture-runtime-governance";
import { assertWorkspaceRuntimeArtifactOwnership, isWorkspaceOwnershipError } from "@/lib/auth/tenant-ownership";
import { confirmRuntimeArtifact } from "@/lib/helm-v2/runtime-upgrade";
import { serverErrorMessage } from "@/lib/http/server-error";

const confirmSchema = z.object({
  decision: z.enum(["confirm", "reject", "keep_draft"]).optional(),
  reviewNotes: z.string().optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, membership, workspace } = await getCurrentWorkspaceSession();
  const english = isEnglishWorkspaceDefaultLocale(workspace.defaultLocale);
  const { id } = await params;
  const payload = confirmSchema.safeParse(await request.json().catch(() => ({})));

  if (!payload.success) {
    return Response.json(
      {
        success: false,
        message: resolveApiValidationIssueMessage(workspace.defaultLocale, payload.error.issues[0]?.message),
      },
      { status: 400 },
    );
  }

  if (!canReviewWorkspaceRuntime(membership.role)) {
    return Response.json({ success: false, message: getRuntimeReviewDeniedMessage(english) }, { status: 403 });
  }

  try {
    await assertWorkspaceRuntimeArtifactOwnership(workspace.id, id);

    const result = await confirmRuntimeArtifact({
      workspaceId: workspace.id,
      artifactBundleId: id,
      reviewerName: user.name,
      reviewerUserId: user.id,
      decision: payload.data.decision,
      reviewNotes: payload.data.reviewNotes,
    });

    return Response.json({ success: true, data: result });
  } catch (error) {
    return Response.json(
      { success: false, message: isWorkspaceOwnershipError(error) ? error.message : serverErrorMessage(error, "Artifact confirmation failed") },
      { status: isWorkspaceOwnershipError(error) ? 404 : 500 },
    );
  }
}
