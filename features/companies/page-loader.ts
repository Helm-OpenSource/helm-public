import "server-only";

import { getCurrentWorkspace, requireCurrentUser } from "@/lib/auth/session";
import { logPageViewEvent } from "@/lib/analytics";
import { getApprovalTasksData } from "@/features/approvals/queries";
import { getCompanyDetailData } from "@/features/companies/queries";
import { generateRecommendationsForObject } from "@/lib/recommendations/recommendation.service";
import { isWorkspaceServiceGovernanceError } from "@/lib/auth/service-governance";
import { isEnglishLocale } from "@/lib/i18n/config";
import { resolveWorkspaceUiLocaleForRequest } from "@/lib/i18n/request-locale.server";
import { getLocalizedStageLabels } from "@/lib/i18n/labels";

export async function loadCompanyDetailPageData(companyId: string) {
  const workspace = await getCurrentWorkspace();
  const user = await requireCurrentUser();
  const locale = await resolveWorkspaceUiLocaleForRequest({
    workspaceDefaultLocale: workspace.defaultLocale,
  });
  const english = isEnglishLocale(locale);
  const [stageLabels, company, recommendations, approvalTasks] = await Promise.all([
    getLocalizedStageLabels(locale),
    getCompanyDetailData(workspace.id, companyId),
    generateRecommendationsForObject({
      workspaceId: workspace.id,
      actorName: user.name,
      actorUserId: user.id,
      actorType: "USER",
      sourcePage: `/companies/${companyId}`,
      objectType: "COMPANY",
      objectId: companyId,
      english,
      llmEnhancement: false,
    }).catch((error) => {
      if (isWorkspaceServiceGovernanceError(error)) {
        return [];
      }
      throw error;
    }),
    getApprovalTasksData(workspace.id),
  ]);

  if (!company) {
    return null;
  }

  await logPageViewEvent({
    eventName: "company_opened",
    sourcePage: `/companies/${company.id}`,
    targetType: "Company",
    targetId: company.id,
  });

  return {
    approvalTasks,
    company,
    english,
    recommendations,
    stageLabels,
  };
}
