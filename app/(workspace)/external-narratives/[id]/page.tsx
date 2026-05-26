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
import { buildExternalNarrativeDetailPageContract } from "@/features/external-narrative-detail/detail-model";
import { ExternalNarrativeDetailView } from "@/features/external-narrative-detail/detail-view";

export default async function ExternalNarrativeDetailPage({
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
    eventName: "external_narrative_detail_opened",
    sourcePage: `/external-narratives/${detail.id}`,
    targetType: "Opportunity",
    targetId: detail.id,
    metadata: {
      actor: user.id,
      mode: "external-narrative-detail",
    },
  });

  const commercialDetail = buildProposalPackageCommercialDetail(detail, {
    stageLabel: stageLabels[detail.stage],
    riskLabel: riskLabels[detail.riskLevel],
  });
  const contract = buildExternalNarrativeDetailPageContract({
    detail: commercialDetail,
    english,
  });

  return (
    <ExternalNarrativeDetailView
      detail={commercialDetail}
      english={english}
      contract={contract}
    />
  );
}
