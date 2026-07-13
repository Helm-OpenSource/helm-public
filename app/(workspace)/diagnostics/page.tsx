import { DiagnosticsClient } from "@/features/diagnostics/diagnostics-client";
import { OperationSuggestionQueue } from "@/features/implementation/operation-suggestion-queue";
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
    </div>
  );
}
