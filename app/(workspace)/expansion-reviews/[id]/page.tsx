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
import { buildExpansionReviewDetailPageModel } from "@/features/expansion-review/detail-model";
import { ExpansionReviewDetailView } from "@/features/expansion-review/detail-view";

export default async function ExpansionReviewDetailPage({
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
    eventName: "expansion_review_detail_opened",
    sourcePage: `/expansion-reviews/${detail.id}`,
    targetType: "Opportunity",
    targetId: detail.id,
    metadata: {
      actor: user.id,
      mode: "expansion-review-detail",
    },
  });

  const model = buildExpansionReviewDetailPageModel({
    detail,
    company,
    reviewTasks,
    stageLabel: stageLabels[detail.stage],
    currentUserId: user.id,
    english,
  });

  return <ExpansionReviewDetailView model={model} english={english} />;
}
