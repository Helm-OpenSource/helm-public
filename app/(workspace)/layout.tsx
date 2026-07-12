import { AppShell } from "@/components/layout/app-shell";
import { getWorkspaceLayoutData } from "@/features/workspace/queries";
import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import { resolveWorkspaceNavExtensions } from "@/lib/extensions/registry";
import { resolveWorkspaceUiLocale } from "@/lib/i18n/config";
import {
  getDeploymentProfileDefaultLocaleCandidate,
  getRequestUiLocaleCandidate,
} from "@/lib/i18n/request-locale.server";
import { getLocalizedRoleLabels } from "@/lib/i18n/labels";
import {
  canAccessTenantHealthWorkspace,
  isHelmReservedWorkspace,
} from "@/lib/workspace-identity";
import { getWorkspaceRolePresetDefinition } from "@/lib/definitions/workspace-role-preset-catalog";
import { resolveRoleLens, type RoleLens } from "@/lib/shell/role-home";
import {
  parseShellChromeProfiles,
  type ShellChromeProfile,
} from "@/lib/shell/shell-chrome";
import { normalizeWorkspaceUiConfig } from "@/lib/workspace-ops";
import { DatabaseConnectionBanner } from "@/components/shared/database-connection-banner";

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let shellProps:
    | {
        workspaceName: string;
        userName: string;
        roleLabel: string;
        locale: ReturnType<typeof normalizeWorkspaceUiConfig>["locale"];
        pilotMode: ReturnType<typeof normalizeWorkspaceUiConfig>["pilotMode"];
        captureConsentRequired: ReturnType<typeof normalizeWorkspaceUiConfig>["captureConsentRequired"];
        dataRetentionDays: ReturnType<typeof normalizeWorkspaceUiConfig>["dataRetentionDays"];
        featureFlags: ReturnType<typeof normalizeWorkspaceUiConfig>["featureFlags"];
        demoMode: ReturnType<typeof normalizeWorkspaceUiConfig>["demoMode"];
        canAccessTenantHealth: boolean;
        isHelmReserved: boolean;
        pendingApprovals: number;
        notificationCount: number;
        alerts: Awaited<ReturnType<typeof getWorkspaceLayoutData>>["alerts"];
        quickCreateData: Awaited<ReturnType<typeof getWorkspaceLayoutData>>["quickCreateData"];
        navExtensionClusters: Awaited<
          ReturnType<typeof resolveWorkspaceNavExtensions>
        >["clusters"];
        shellChromeProfiles: ReadonlyArray<ShellChromeProfile>;
        roleLens: RoleLens;
      }
    | null = null;
  let databaseErrorMessage: string | null = null;
  const requestLocale = await getRequestUiLocaleCandidate();

  try {
    const session = await getCurrentWorkspaceSession();
    const { user, workspace, membership } = session;

    const layoutData = await getWorkspaceLayoutData(workspace.id, user.id);
    const workspaceUiConfig = normalizeWorkspaceUiConfig({
      ...workspace,
      requestLocale,
      deploymentProfileDefaultLocale: getDeploymentProfileDefaultLocaleCandidate(),
    });
    const roleLabels = getLocalizedRoleLabels(workspaceUiConfig.locale);
    const english = workspaceUiConfig.locale === "en-US";
    const navExtensions = await resolveWorkspaceNavExtensions({
      workspace,
      english,
    });

    shellProps = {
      workspaceName: workspace.name,
      userName: user.name,
      roleLabel:
        (layoutData.membership ? roleLabels[layoutData.membership.role] : roleLabels[membership.role]) ??
        (english ? "Member" : "成员"),
      locale: workspaceUiConfig.locale,
      pilotMode: workspaceUiConfig.pilotMode,
      captureConsentRequired: workspaceUiConfig.captureConsentRequired,
      dataRetentionDays: workspaceUiConfig.dataRetentionDays,
      featureFlags: workspaceUiConfig.featureFlags,
      demoMode: workspaceUiConfig.demoMode,
      canAccessTenantHealth: canAccessTenantHealthWorkspace(workspace),
      isHelmReserved: isHelmReservedWorkspace(workspace),
      pendingApprovals: layoutData.pendingApprovals,
      notificationCount: layoutData.notificationCount,
      alerts: layoutData.alerts,
      quickCreateData: layoutData.quickCreateData,
      navExtensionClusters: navExtensions.clusters,
      shellChromeProfiles: parseShellChromeProfiles(workspace.configuration),
      // 角色 lens 仅用于导航目录（授权先行，导航不授权）；解析失败落 GENERIC。
      roleLens: resolveRoleLens(
        getWorkspaceRolePresetDefinition(
          membership.rolePresetKey,
          workspace.configuration,
        )?.basePresetKey ?? null,
      ),
    };
  } catch (error) {
    // 检查是否是数据库连接错误
    if (error instanceof Error && error.message.includes("Can't reach database server")) {
      databaseErrorMessage = error.message;
    } else {
      // 其他错误仍然抛出让错误边界处理
      throw error;
    }
  }

  if (databaseErrorMessage) {
    const offlineLocale = resolveWorkspaceUiLocale({
      requestLocale,
      deploymentProfileDefaultLocale: getDeploymentProfileDefaultLocaleCandidate(),
    });
    const offlineEnglish = offlineLocale === "en-US";
    return (
      <div className="min-h-screen bg-gradient-to-br from-[color:var(--surface-subtle)] to-[color:var(--surface-subtle)] dark:from-[color:var(--dark-inset-bg)] dark:to-black">
        <DatabaseConnectionBanner
          error={databaseErrorMessage}
          english={offlineEnglish}
        />
        <div className="mt-4 px-4 lg:px-8">{children}</div>
      </div>
    );
  }

  if (!shellProps) {
    throw new Error("Workspace layout props were not resolved.");
  }

  return <AppShell {...shellProps}>{children}</AppShell>;
}
