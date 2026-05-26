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
    runtimeOverview,
    english,
    locale,
    workspace,
    membership,
    accessState,
    canManageRuntime,
    canReviewRuntime,
    dingtalkWorkflowHealth,
    firstLoopModel,
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

  return (
    <div className="space-y-4">
      <div
        role="status"
        aria-live="polite"
        data-testid="operating-phase2-fixture-banner"
        className="rounded-md border border-[color:color-mix(in_oklab,var(--accent-warm)_38%,var(--border)_62%)] bg-[color:color-mix(in_oklab,var(--accent-warm)_12%,var(--surface)_88%)] px-4 py-3 text-sm text-[color:var(--foreground)]"
      >
        <strong className="font-semibold">
          {english ? "Phase 2 fixture demo" : "Phase 2 fixture 演示"}
        </strong>
        {english
          ? ` · /operating currently shows synthetic fixture data. DPO review and founder-attested 5-role signoff are recorded, but route adoption is still locked until Engineering / Product / Security / Operations per-role receipts are attached. The current shadow probe is Phase 1.5 day-2 dogfood proxy only. See docs/product/HELM_OPERATING_SIGNAL_FLOW_MAP_REQUIREMENTS.md.`
          : ` · /operating 当前为合成 fixture 数据，不代表真实租户业务流。DPO 复核与 founder-attested 5 角色签字已有记录，但 route adoption 仍需补齐 Engineering / Product / Security / Operations 四个 per-role receipt；当前 shadow probe 只作为 Phase 1.5 day-2 dogfood proxy。详见 docs/product/HELM_OPERATING_SIGNAL_FLOW_MAP_REQUIREMENTS.md。`}
      </div>
      <InternalOperatingHome
        model={model}
        runtimeOverview={runtimeOverview}
        english={english}
        locale={locale}
        canManageRuntime={canManageRuntime}
        canReviewRuntime={canReviewRuntime}
        firstLoopModel={firstLoopModel}
        tenantResourceImpactReadout={tenantResourceImpactReadout}
        operatingFoundationSummary={operatingFoundationSummary}
        dingtalkWorkflowHealth={dingtalkWorkflowHealth}
        canAccessTenantHealth={canAccessTenantHealthWorkspace(workspace)}
        isHelmReserved={isHelmReservedWorkspace(workspace)}
      />
    </div>
  );
}
