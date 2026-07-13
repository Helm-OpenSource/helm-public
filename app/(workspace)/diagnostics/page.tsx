import { DiagnosticsClient } from "@/features/diagnostics/diagnostics-client";
import { OperationSuggestionQueue } from "@/features/implementation/operation-suggestion-queue";
import { RunTrajectoryAuditView } from "@/features/audit/run-trajectory-audit-view";
import { WorkspaceRoutingView } from "@/features/workspace-routing/workspace-routing-view";
import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import { getWorkspaceBusinessLoopGapReadout } from "@/lib/helm-v2/runtime-upgrade";
import { getDiagnosticsData } from "@/features/diagnostics/queries";
import { getWorkspaceFirstLoopModel } from "@/lib/operating-system/first-loop-query";
import { normalizeWorkspaceUiConfig } from "@/lib/workspace-ops";
import {
  getDeploymentProfileDefaultLocaleCandidate,
  getRequestUiLocaleCandidate,
} from "@/lib/i18n/request-locale.server";

export default async function DiagnosticsPage() {
  const { membership, user, workspace } = await getCurrentWorkspaceSession();
  const requestLocale = await getRequestUiLocaleCandidate();
  const { locale } = normalizeWorkspaceUiConfig({
    ...workspace,
    requestLocale,
    deploymentProfileDefaultLocale: getDeploymentProfileDefaultLocaleCandidate(),
  });
  const [data, businessLoopGapReadout, firstLoopModel] = await Promise.all([
    getDiagnosticsData(workspace.id, { currentUserId: user.id }),
    getWorkspaceBusinessLoopGapReadout(workspace.id),
    getWorkspaceFirstLoopModel({
      workspaceId: workspace.id,
      currentUserId: user.id,
      locale,
      membershipRole: membership.role,
      profileType: workspace.profileType,
      focusAreasJson: workspace.focusAreas,
    }),
  ]);

  return (
    <div className="space-y-8">
      <DiagnosticsClient
        data={data}
        businessLoopGapSummary={businessLoopGapReadout.businessLoopGapSummary}
        firstLoopModel={firstLoopModel}
      />
      {/* 实施队列 · 变更包(read-only)——operation-suggestion surface 首个 Core 消费者。
          诊断(L0)之下即实施变更包(L1),契合方法论 §8;无 provider 时诚实空态。 */}
      <OperationSuggestionQueue workspace={workspace} english={locale === "en-US"} />
      {/* 回执与审计 · 运行轨迹(read-only)——run-trajectory-audit surface 首个 Core 消费者。
          与实施队列同处 L0-L2 治理簇;语义事件非模型思维(§7);无 provider 时诚实空态。 */}
      <RunTrajectoryAuditView workspace={workspace} english={locale === "en-US"} />
      {/* 工位与角色路由(read-only)——roleHomeRouting + workstations surface 首个 Core 消费者;IA 可见性面。 */}
      <WorkspaceRoutingView workspace={workspace} english={locale === "en-US"} />
    </div>
  );
}
