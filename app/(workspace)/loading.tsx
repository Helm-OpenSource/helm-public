import { PageSkeleton } from "@/components/shared/page-skeleton";
import { resolveRequestUiLocale } from "@/lib/i18n/request-locale.server";

export default async function WorkspaceLoading() {
  const locale = await resolveRequestUiLocale();
  const english = locale === "en-US";

  return (
    <PageSkeleton
      columns={3}
      rows={6}
      testId="workspace-route-loading"
      eyebrow={english ? "Workspace route" : "工作区页面"}
      title={english ? "Opening the workspace surface" : "正在打开工作区页面"}
      description={
        english
          ? "Pulling today's calls, review posture, and the context behind each."
          : "正在汇总今天要拍板的事、复核姿态、以及每条背后的依据。"
      }
      assurance={
        english
          ? "This loading screen does not approve, send, write externally, or change high-risk state."
          : "这个加载页面不会审批、发送、对外写入或修改高风险状态。"
      }
      actions={[
        {
          href: "",
          label: english ? "Retry current page" : "重试当前页面",
        },
        {
          href: "/search",
          label: english ? "Open global search" : "打开全局搜索",
        },
        {
          href: "/dashboard",
          label: english ? "Open dashboard" : "打开目标推进台",
        },
        {
          href: "/approvals#approval-queue",
          label: english ? "Open review queue" : "查看复核队列",
        },
      ]}
    />
  );
}
