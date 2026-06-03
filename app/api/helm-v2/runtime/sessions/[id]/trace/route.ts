import { getCurrentWorkspace, requireCurrentUser } from "@/lib/auth/session";
import { getRuntimeSessionTrace } from "@/lib/helm-v2/runtime-upgrade";
import { resolveApiWorkspaceMessage } from "@/lib/i18n/api-message-locale";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireCurrentUser();
  const workspace = await getCurrentWorkspace();
  const { id } = await params;

  const trace = await getRuntimeSessionTrace(workspace.id, id);
  if (!trace) {
    return Response.json(
      {
        success: false,
        message: resolveApiWorkspaceMessage(workspace.defaultLocale, {
          zh: "运行时 session 不存在",
          en: "Runtime session not found",
        }),
      },
      { status: 404 },
    );
  }

  return Response.json({ success: true, data: trace });
}
