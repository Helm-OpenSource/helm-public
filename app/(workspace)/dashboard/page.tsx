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
  resolveShellAttention,
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
import type { ShellRuntimeContext } from "@/lib/extensions/registry-types";
import {
  attachRoleAnomalyProgress,
  resolveRoleAttentionCategory,
} from "@/features/dashboard/role-anomaly-progress";
import { resolveMemberRoleHome } from "@/lib/shell/member-role-home";

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  // 优先级链（蓝图 §2.1）：①defaultLandingPath 决定落点 ②?stay=1 逃生口
  // ③controlTowerHome 内容开关 ④角色分流仅内容层视图选择（无 redirect）。
  const stayParam = firstParam(params.stay);
  if (stayParam !== "1") {
    const { workspace } = await getCurrentWorkspaceSession();
    const landingPath = resolveWorkspaceDefaultLandingPath(
      workspace.configuration,
    );
    if (landingPath) redirect(landingPath);
  }
  const entry = firstParam(params.entry);
  const assetScope = firstParam(params.assetScope)?.trim() || null;
  const runtimeContext: ShellRuntimeContext = { assetScope };
  const connectorBindingStatus = firstParam(params.connector_binding_status);
  const connectorBindingMessage = firstParam(params.connector_binding_message);
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
  const roleHome = await resolveMemberRoleHome({
    workspace,
    membership,
    basePresetKey,
    english,
  });
  const roleHomeDestination = roleHome.destination;
  const lens =
    roleHomeDestination.kind === "control_tower"
      ? "control_tower"
      : roleHomeDestination.kind === "workstation"
        ? "delivery_desk"
        : resolveRoleLens(basePresetKey);
  const catalogPresetKey =
    roleHomeDestination.kind === "control_tower" && !basePresetKey
      ? "FOUNDER_CEO"
      : roleHomeDestination.kind === "workstation" && !basePresetKey
        ? "GENERAL_OPERATOR"
        : basePresetKey;
  const workstationHomeEntry = roleHome.workstation;

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
  const attentionRoleCategory = resolveRoleAttentionCategory({
    rolePresetKey: membership.rolePresetKey,
    basePresetKey,
    workspaceRole: membership.role,
  });
  const [{ readout: mainline }, attentionResolution] = await Promise.all([
    resolveShellMainline({
      workspace,
      english,
      binding: mainlineBinding,
      runtimeContext,
      coreDefault: {
        asOf: new Date().toISOString(),
        english,
        counts: {
          judgementPending: workEntry.topWorkItems.length,
          reviewQueue: workEntry.reviewItems.length,
          advanceInFlight: null,
        },
      },
    }),
    resolveShellAttention({
      workspace,
      english,
      roleCategory: attentionRoleCategory,
      runtimeContext,
    }),
  ]);
  const roleAwareWorkEntry = attachRoleAnomalyProgress({
    model: workEntry,
    attentionItems: attentionResolution.items,
    english,
  });
  const roleAwareViewModel = {
    ...viewModel,
    dashboardHomeWorkEntry: roleAwareWorkEntry,
  };

  // 北极星 KPI(read-only)——northstarKpiSources surface 首个 Core 消费者;
  // 金额只给分档、三态禁造数;无 provider 时一行诚实说明,不占版面。
  // 异常工作台 · Agent 收件箱(read-only)——attention surface 首个 Core 消费者;
  // 只汇集与导航,不代执行;无 provider 时诚实空态。
  // 二者版面位置由 ControlTowerView 按 lens 决定:控制塔 lens 下异常台紧随
  // "等你拍板"(可操作内容置顶)、KPI 归入经营态势层;其余 lens 维持置尾。
  return (
    <ControlTowerView
      english={english}
      lens={lens}
      basePresetKey={catalogPresetKey}
      workstationHomeEntry={
        workstationHomeEntry?.href
          ? {
              key: workstationHomeEntry.key,
              href: workstationHomeEntry.href,
              label: workstationHomeEntry.label,
            }
          : null
      }
      mainline={mainline}
      northstarText={resolveNorthstarText(workspace.focusAreas, english)}
      viewModel={roleAwareViewModel}
      tenantResourceImpactReadout={pageData.tenantResourceImpactReadout}
      stage1OwnerLoopReadout={pageData.stage1OwnerLoopReadout}
      connectorSheet={connectorSheet}
      northstarKpiSlot={
        <NorthstarKpiPanel
          workspace={workspace}
          english={english}
          runtimeContext={runtimeContext}
        />
      }
      attentionSlot={
        <AttentionInbox
          workspace={workspace}
          english={english}
          roleCategory={attentionRoleCategory}
          runtimeContext={runtimeContext}
          items={attentionResolution.items}
        />
      }
    />
  );
}
