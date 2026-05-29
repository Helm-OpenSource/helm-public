import { LazyDisclosure } from "@/components/shared/lazy-disclosure";
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
      <LazyDisclosure
        data-testid="operating-phase2-fixture-banner"
        className="rounded-[24px] border border-[color:var(--border)] bg-[color:var(--background-elevated)] px-4 py-3 text-sm text-[color:var(--muted-foreground)]"
        title={english ? "Read-only data note" : "只读数据说明"}
      >
        <p className="mt-2 leading-6">
          {english
            ? `This board is a read-only demo of how business signals are collected, judged, and held before human review. It does not represent live customer data and will not trigger external action. Engineering evidence is tracked in docs/product/HELM_OPERATING_SIGNAL_FLOW_MAP_REQUIREMENTS.md.`
            : `这张总盘当前只用于演示经营信号怎样进入、判断、回收，并停在人工复核前；它不代表真实客户生产数据，也不会触发外部动作。工程验收依据记录在 docs/product/HELM_OPERATING_SIGNAL_FLOW_MAP_REQUIREMENTS.md。`}
        </p>
      </LazyDisclosure>
    </div>
  );
}
