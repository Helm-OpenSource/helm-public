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
import {
  buildCustomerFacingOfferPageContract,
} from "@/features/customer-facing-offer-external-proposal/detail-model";
import { CustomerFacingOfferExternalProposalDetailView } from "@/features/customer-facing-offer-external-proposal/detail-view";
import { buildProposalPackageCommercialDetail } from "@/features/proposal-package/detail-model";

export default async function CustomerFacingOfferDetailPage({
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
    eventName: "customer_facing_offer_detail_opened",
    sourcePage: `/offers/${detail.id}`,
    targetType: "Opportunity",
    targetId: detail.id,
    metadata: {
      actor: user.id,
      mode: "customer-offer",
    },
  });

  const commercialDetail = buildProposalPackageCommercialDetail(detail, {
    stageLabel: stageLabels[detail.stage],
    riskLabel: riskLabels[detail.riskLevel],
  });
  const contract = buildCustomerFacingOfferPageContract({
    detail: commercialDetail,
    english,
  });

  return (
    <CustomerFacingOfferExternalProposalDetailView
      mode="customer-offer"
      detail={commercialDetail}
      english={english}
      contract={contract}
    />
  );
}
