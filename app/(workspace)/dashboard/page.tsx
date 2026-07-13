import { redirect } from "next/navigation";
import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import {
  parseWorkspaceFeatureFlags,
  resolveWorkspaceDefaultLandingPath,
} from "@/lib/workspace-ops";
import { getDemoModeProfiles } from "@/lib/demo/demo-modes";
import { resolveMemberBasePresetKey } from "@/lib/definitions/workspace-role-preset-catalog";
import { resolveNorthstarText } from "@/lib/shell/northstar-text";
import {
  resolveShellMainline,
  SHELL_MAINLINE_SURFACE_KEY,
} from "@/lib/shell/resolve-shell-experience";
import { resolveWorkspaceSurfaceBinding } from "@/lib/shell/surface-binding-store";
import { resolveRoleLens } from "@/lib/shell/role-home";
import { loadDashboardPageData } from "@/features/dashboard/page-loader";
import { buildDashboardViewModel } from "@/features/dashboard/view-model";
import { ControlTowerView } from "@/features/dashboard/control-tower/control-tower-view";
import { AttentionInbox } from "@/features/exceptions/attention-inbox";
import { NorthstarKpiPanel } from "@/features/northstar/northstar-kpi-panel";
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

  // 角色 lens：授权先行（页面权限不受此影响）；custom preset 经 basePresetKey 归并；
  // 无 preset 受控兜底(OWNER→控制塔,其余→GENERIC),与 layout/sidebar 同一 helper 防漂移
  // (CodeX 运行审计 P1:OWNER 无 preset 曾落空白 generic)。
  const basePresetKey = resolveMemberBasePresetKey({
    rolePresetKey: membership.rolePresetKey,
    workspaceRole: membership.role,
    rawConfiguration: workspace.configuration,
  });
  const lens = resolveRoleLens(basePresetKey);

  // 主线计数语义（诚实口径，contract 级 countCaliber=daily_schedule）：
  // judgement/review = home-work-entry 的今日排片数（非全量积压，UI 显式标注）；
  // advance 尚无真实全量计数源 → pending_source，不用截断样本冒充。
  const workEntry = viewModel.dashboardHomeWorkEntry;
  // 经营主线经统一读侧入口（蓝图 §4.4）：注册的 mainline provider 按绑定授权
  // 模型（§4.3）至多选一。绑定从持久化的 WorkspaceSurfaceBinding 读取；无绑定/失效/
  // 越权/版本不兼容 → selectSingleWinner fail-open 回 Core default（与既有直接 build 一致）。
  const mainlineBinding = await resolveWorkspaceSurfaceBinding(
    workspace.id,
    SHELL_MAINLINE_SURFACE_KEY,
  );
  const { readout: mainline } = await resolveShellMainline({
    workspace,
    english,
    binding: mainlineBinding,
    coreDefault: {
      asOf: new Date().toISOString(),
      english,
      counts: {
        judgementPending: workEntry.topWorkItems.length,
        reviewQueue: workEntry.reviewItems.length,
        advanceInFlight: null,
      },
    },
  });

  return (
    <div className="space-y-8">
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
      {/* 北极星 KPI(read-only)——northstarKpiSources surface 首个 Core 消费者;经营控制塔指标行。
          金额只给分档、三态禁造数;无 provider 时一行诚实说明,不占版面。 */}
      <NorthstarKpiPanel workspace={workspace} english={english} />
      {/* 异常工作台 · Agent 收件箱(read-only)——attention surface 首个 Core 消费者。
          控制塔操作者首页之下即异常台;只汇集与导航,不代执行;无 provider 时诚实空态。 */}
      <AttentionInbox workspace={workspace} english={english} />
    </div>
  );
}
