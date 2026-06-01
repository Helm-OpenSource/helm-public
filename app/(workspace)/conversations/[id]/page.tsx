import { notFound } from "next/navigation";
import { getOpportunityCommercialDetailData } from "@/data/queries";
import { logPageViewEvent } from "@/lib/analytics";
import { getCurrentWorkspace, requireCurrentUser } from "@/lib/auth/session";
import { isEnglishLocale } from "@/lib/i18n/config";
import { resolveWorkspaceUiLocaleForRequest } from "@/lib/i18n/request-locale.server";
import {
  getLocalizedRiskLabels,
  getLocalizedStageLabels,
} from "@/lib/i18n/labels";
import { buildProposalPackageCommercialDetail } from "@/features/proposal-package/detail-model";
import { buildConversationDetailPageContract } from "@/features/conversation-detail/detail-model";
import { ConversationDetailView } from "@/features/conversation-detail/detail-view";

export default async function ConversationDetailPage({
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
  const [stageLabels, riskLabels, detail] = await Promise.all([
    getLocalizedStageLabels(locale),
    getLocalizedRiskLabels(locale),
    getOpportunityCommercialDetailData(workspace.id, id),
  ]);

  if (!detail) return notFound();

  await logPageViewEvent({
    eventName: "conversation_detail_opened",
    sourcePage: `/conversations/${detail.id}`,
    targetType: "Opportunity",
    targetId: detail.id,
    metadata: {
      actor: user.id,
      mode: "conversation-detail",
    },
  });

  const commercialDetail = buildProposalPackageCommercialDetail(detail, {
    stageLabel: stageLabels[detail.stage],
    riskLabel: riskLabels[detail.riskLevel],
  });
  const contract = buildConversationDetailPageContract({
    detail: commercialDetail,
    english,
  });

  return (
    <ConversationDetailView
      detail={commercialDetail}
      english={english}
      contract={contract}
    />
  );
}
