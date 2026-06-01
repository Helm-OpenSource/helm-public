import { notFound } from "next/navigation";
import { getCurrentWorkspace, requireCurrentUser } from "@/lib/auth/session";
import { logPageViewEvent } from "@/lib/analytics";
import { getOpportunityCommercialDetailData } from "@/data/queries";
import { isEnglishLocale } from "@/lib/i18n/config";
import { resolveWorkspaceUiLocaleForRequest } from "@/lib/i18n/request-locale.server";
import {
  getLocalizedRiskLabels,
  getLocalizedStageLabels,
} from "@/lib/i18n/labels";
import {
  buildProposalPackageCommercialDetail,
  buildProposalPageContract,
} from "@/features/proposal-package/detail-model";
import { ProposalPackageDetailView } from "@/features/proposal-package/proposal-package-detail-view";

export default async function ProposalDetailPage({
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
    eventName: "proposal_detail_opened",
    sourcePage: `/proposals/${detail.id}`,
    targetType: "Opportunity",
    targetId: detail.id,
    metadata: {
      actor: user.id,
      mode: "proposal",
    },
  });

  const commercialDetail = buildProposalPackageCommercialDetail(detail, {
    stageLabel: stageLabels[detail.stage],
    riskLabel: riskLabels[detail.riskLevel],
  });
  const contract = buildProposalPageContract({
    detail: commercialDetail,
    english,
  });

  return (
    <ProposalPackageDetailView
      mode="proposal"
      detail={commercialDetail}
      english={english}
      contract={contract}
    />
  );
}
