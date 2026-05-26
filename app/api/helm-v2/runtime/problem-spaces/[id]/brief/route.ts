import { z } from "zod";
import { getCurrentWorkspace, requireCurrentUser } from "@/lib/auth/session";
import { getProblemSpaceEdgeBrief } from "@/lib/helm-v2/runtime-upgrade";

const briefAudienceSchema = z.enum(["IC", "DRI", "PLAYER_COACH"]);

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireCurrentUser();
  const workspace = await getCurrentWorkspace();
  const { id } = await params;
  const url = new URL(request.url);
  const audience = briefAudienceSchema.safeParse(url.searchParams.get("audience") ?? "PLAYER_COACH");

  if (!audience.success) {
    return Response.json({ success: false, message: audience.error.issues[0]?.message ?? "受众不合法" }, { status: 400 });
  }

  try {
    const result = await getProblemSpaceEdgeBrief({
      workspaceId: workspace.id,
      problemSpaceId: id,
      audience: audience.data,
    });

    return Response.json({ success: true, data: result });
  } catch (error) {
    return Response.json({ success: false, message: error instanceof Error ? error.message : "Problem-space brief failed" }, { status: 500 });
  }
}
