import { buildWorkspaceOperatingFoundationSummary } from "@/lib/operating-system";
import {
  canAccessTenantHealthWorkspace,
  isHelmReservedWorkspace,
} from "@/lib/workspace-identity";
import { InternalOperatingHome } from "@/features/internal-operating-workspace/internal-operating-home";
import { loadInternalOperatingHomePageData } from "@/features/internal-operating-workspace/page-loader";

export default async function InternalOperatingHomePage() {
  const {
    model,
    reviewActions,
    runtimeOverview,
    english,
    locale,
    workspace,
    membership,
    accessState,
    canManageRuntime,
    canReviewRuntime,
    dingtalkWorkflowHealth,
    tenantResourceImpactReadout,
  } =
    await loadInternalOperatingHomePageData();
  const operatingFoundationSummary = buildWorkspaceOperatingFoundationSummary({
    locale,
    workspaceName: workspace.name,
    membershipRole: membership.role,
    accessState,
    profileType: workspace.profileType,
    focusAreasJson: workspace.focusAreas,
    topJudgements: model.topJudgements.map((item) => item.label),
    topPriorityHref: model.topJudgements.find((item) => item.href)?.href ?? "/dashboard",
    currentPage: "operating",
  });

  // The read-only note lives inside the home's single system judgement block.
  return (
    <InternalOperatingHome
      model={model}
      reviewActions={reviewActions}
      runtimeOverview={runtimeOverview}
      english={english}
      canManageRuntime={canManageRuntime}
      canReviewRuntime={canReviewRuntime}
      tenantResourceImpactReadout={tenantResourceImpactReadout}
      operatingFoundationSummary={operatingFoundationSummary}
      dingtalkWorkflowHealth={dingtalkWorkflowHealth}
      canAccessTenantHealth={canAccessTenantHealthWorkspace(workspace)}
      isHelmReserved={isHelmReservedWorkspace(workspace)}
    />
  );
}
