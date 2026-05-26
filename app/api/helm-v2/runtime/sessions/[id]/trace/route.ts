import { getCurrentWorkspace, requireCurrentUser } from "@/lib/auth/session";
import { getRuntimeSessionTrace } from "@/lib/helm-v2/runtime-upgrade";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireCurrentUser();
  const workspace = await getCurrentWorkspace();
  const { id } = await params;

  const trace = await getRuntimeSessionTrace(workspace.id, id);
  if (!trace) {
    return Response.json({ success: false, message: "Runtime session not found" }, { status: 404 });
  }

  return Response.json({ success: true, data: trace });
}
