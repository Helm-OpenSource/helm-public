import { getCurrentWorkspace, requireCurrentUser } from "@/lib/auth/session";
import { getRuntimeCacheHealth } from "@/lib/helm-v2/runtime-upgrade";

export async function GET() {
  await requireCurrentUser();
  const workspace = await getCurrentWorkspace();
  const data = await getRuntimeCacheHealth(workspace.id);

  return Response.json({ success: true, data });
}
