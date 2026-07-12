import { redirect } from "next/navigation";
import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import {
  parseWorkspaceFeatureFlags,
  resolveWorkspaceDefaultLandingPath,
} from "@/lib/workspace-ops";
import { getDemoModeProfiles } from "@/lib/demo/demo-modes";
import { getWorkspaceRolePresetDefinition } from "@/lib/definitions/workspace-role-preset-catalog";
import { buildCoreDefaultMainline } from "@/lib/shell/operating-mainline";
import { resolveNorthstarText } from "@/lib/shell/northstar-text";
import { resolveRoleLens } from "@/lib/shell/role-home";
import { loadDashboardPageData } from "@/features/dashboard/page-loader";
import { buildDashboardViewModel } from "@/features/dashboard/view-model";
import { ControlTowerView } from "@/features/dashboard/control-tower/control-tower-view";
import { LegacyHomeView } from "@/features/dashboard/legacy-home-view";
import { ConnectorBindingSuccessSheet } from "@/features/dashboard/connector-binding-success-sheet";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  // 优先级链（蓝图 §2.1）：①defaultLandingPath 决定落点 ②?stay=1 逃生口
  // ③controlTowerHome 内容开关 ④角色分流仅内容层视图选择（无 redirect）。
  const stayParam = Array.isArray(params.stay) ? params.stay[0] : params.stay;
  if (stayParam !== "1") {
    const { workspace } = await getCurrentWorkspaceSession();
    const landingPath = resolveWorkspaceDefaultLandingPath(workspace.configuration);
    if (landingPath) redirect(landingPath);
  }
  const entry = Array.isArray(params.entry) ? params.entry[0] : params.entry;
  const connectorBindingStatus =
    typeof params.connector_binding_status === "string"
      ? params.connector_binding_status
      : Array.isArray(params.connector_binding_status)
        ? params.connector_binding_status[0]
        : undefined;
  const connectorBindingMessage =
    typeof params.connector_binding_message === "string"
      ? params.connector_binding_message
      : Array.isArray(params.connector_binding_message)
        ? params.connector_binding_message[0]
        : undefined;
  const pageData = await loadDashboardPageData();
  const { locale, demoMode, english, workspace, membership } = pageData;

  const viewModel = buildDashboardViewModel({ pageData, entry });
  const featureFlags = parseWorkspaceFeatureFlags(workspace.featureFlagsJson);

  const demoQuickPathToMeetings = demoMode
    ? (getDemoModeProfiles(locale)
        .find((profile) => profile.mode === demoMode)
        ?.quickPath.find((item) => item.href === "/meetings") ?? null)
    : null;

  const connectorSheet = (
    <ConnectorBindingSuccessSheet
      english={english}
      status={connectorBindingStatus}
      message={connectorBindingMessage}
    />
  );

  if (!featureFlags.controlTowerHome) {
    return (
      <LegacyHomeView
        pageData={pageData}
        viewModel={viewModel}
        demoQuickPathToMeetings={demoQuickPathToMeetings}
        connectorSheet={connectorSheet}
      />
    );
  }

  // 角色 lens：授权先行（页面权限不受此影响）；custom preset 经 basePresetKey
  // 归并；解析失败落 GENERIC（fail-safe 向最低信息面）。
  const presetDefinition = getWorkspaceRolePresetDefinition(
    membership.rolePresetKey,
    workspace.configuration,
  );
  const basePresetKey = presetDefinition?.basePresetKey ?? null;
  const lens = resolveRoleLens(basePresetKey);

  // 主线计数语义（诚实口径，contract 级 countCaliber=daily_schedule）：
  // judgement/review = home-work-entry 的今日排片数（非全量积压，UI 显式标注）；
  // advance 尚无真实全量计数源 → pending_source，不用截断样本冒充。
  const workEntry = viewModel.dashboardHomeWorkEntry;
  const mainline = buildCoreDefaultMainline({
    asOf: new Date().toISOString(),
    english,
    counts: {
      judgementPending: workEntry.topWorkItems.length,
      reviewQueue: workEntry.reviewItems.length,
      advanceInFlight: null,
    },
  });

  return (
    <ControlTowerView
      english={english}
      lens={lens}
      basePresetKey={basePresetKey}
      mainline={mainline}
      northstarText={resolveNorthstarText(workspace.focusAreas, english)}
      viewModel={viewModel}
      tenantResourceImpactReadout={pageData.tenantResourceImpactReadout}
      connectorSheet={connectorSheet}
    />
  );
}
