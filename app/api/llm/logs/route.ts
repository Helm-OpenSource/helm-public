import { subDays } from "date-fns";
import { getCurrentWorkspace, requireCurrentUser } from "@/lib/auth/session";
import { getLLMOverview } from "@/lib/observability/llm-metrics.service";
import { isEnglishWorkspaceDefaultLocale } from "@/lib/i18n/api-message-locale";

export async function GET(request: Request) {
  let english = false;

  try {
    await requireCurrentUser();
    const workspace = await getCurrentWorkspace();
    english = isEnglishWorkspaceDefaultLocale(workspace.defaultLocale);
    const { searchParams } = new URL(request.url);
    const days = Number(searchParams.get("days") ?? "7");
    const since = Number.isFinite(days) && days > 0 ? subDays(new Date(), days) : undefined;
    const overview = await getLLMOverview(workspace.id, since);

    return Response.json({
      success: true,
      data: overview,
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        message: error instanceof Error
          ? error.message
          : english
            ? "Failed to read LLM call logs"
            : "读取 LLM 调用日志失败",
      },
      { status: 500 },
    );
  }
}
