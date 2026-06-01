import { getCurrentWorkspace, requireCurrentUser } from "@/lib/auth/session";
import { getPlayerCoachQueue } from "@/lib/helm-v2/runtime-upgrade";

export async function GET() {
  await requireCurrentUser();
  const workspace = await getCurrentWorkspace();
  const data = await getPlayerCoachQueue(workspace.id);
  return Response.json({ success: true, data });
}
