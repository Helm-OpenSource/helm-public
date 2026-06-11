import { z } from "zod";
import { getCurrentWorkspace, requireCurrentUser } from "@/lib/auth/session";
import {
  isEnglishWorkspaceDefaultLocale,
  resolveApiValidationIssueMessage,
} from "@/lib/i18n/api-message-locale";
import { getProblemSpaceEdgeBrief } from "@/lib/helm-v2/runtime-upgrade";
import { serverErrorMessage } from "@/lib/http/server-error";

const briefAudienceSchema = z.enum(["IC", "DRI", "PLAYER_COACH"]);

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireCurrentUser();
  const workspace = await getCurrentWorkspace();
  const english = isEnglishWorkspaceDefaultLocale(workspace.defaultLocale);
  const { id } = await params;
  const url = new URL(request.url);
  const audience = briefAudienceSchema.safeParse(url.searchParams.get("audience") ?? "PLAYER_COACH");

  if (!audience.success) {
    return Response.json(
      {
        success: false,
        message: resolveApiValidationIssueMessage(
          workspace.defaultLocale,
          audience.error.issues[0]?.message,
          "invalidAudience",
        ),
      },
      { status: 400 },
    );
  }

  try {
    const result = await getProblemSpaceEdgeBrief({
      workspaceId: workspace.id,
      problemSpaceId: id,
      audience: audience.data,
    });

    return Response.json({ success: true, data: result });
  } catch (error) {
    return Response.json(
      {
        success: false,
        message: serverErrorMessage(
          error,
          english ? "Problem-space brief failed" : "问题空间简报生成失败",
        ),
      },
      { status: 500 },
    );
  }
}
