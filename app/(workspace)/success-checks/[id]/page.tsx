import { notFound } from "next/navigation";
import {
  getApprovalTasksData,
  getCompanyDetailData,
  getOpportunityCommercialDetailData,
} from "@/data/queries";
import { logPageViewEvent } from "@/lib/analytics";
import { getCurrentWorkspace, requireCurrentUser } from "@/lib/auth/session";
import { isEnglishLocale } from "@/lib/i18n/config";
import { resolveWorkspaceUiLocaleForRequest } from "@/lib/i18n/request-locale.server";
import { getLocalizedStageLabels } from "@/lib/i18n/labels";
import { buildSuccessCheckDetailPageModel } from "@/features/success-check/detail-model";
import { SuccessCheckDetailView } from "@/features/success-check/detail-view";

export default async function SuccessCheckDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const workspace = await getCurrentWorkspace();
  const user = await requireCurrentUser();
  const locale = await resolveWorkspaceUiLocaleForRequest({
    workspaceDefaultLocale: workspace.defaultLocale,
  });
  const english = isEnglishLocale(locale);
  const [stageLabels, detail, approvalTasks] = await Promise.all([
    getLocalizedStageLabels(locale),
    getOpportunityCommercialDetailData(workspace.id, id),
    getApprovalTasksData(workspace.id),
  ]);

  if (!detail) return notFound();

  const company = detail.company
    ? await getCompanyDetailData(workspace.id, detail.company.id)
    : null;
  const reviewTasks = approvalTasks.filter(
    (task) => task.actionItem.opportunity?.id === detail.id,
  );

  await logPageViewEvent({
    eventName: "success_check_detail_opened",
    sourcePage: `/success-checks/${detail.id}`,
    targetType: "Opportunity",
    targetId: detail.id,
    metadata: {
      actor: user.id,
      mode: "success-check-detail",
    },
  });

  const model = buildSuccessCheckDetailPageModel({
    detail,
    company,
    reviewTasks,
    stageLabel: stageLabels[detail.stage],
    currentUserId: user.id,
    english,
  });

  return <SuccessCheckDetailView model={model} english={english} />;
}
