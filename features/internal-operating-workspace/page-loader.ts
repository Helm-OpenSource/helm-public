import { resolveGroupScopeUserIds } from "@/lib/auth/group-scope";
import "server-only";

import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import { logPageViewEvent } from "@/lib/analytics";
import {
  canManageWorkspaceRuntime,
  canReviewWorkspaceRuntime,
} from "@/lib/auth/capture-runtime-governance";
import {
  isEnglishLocale,
  resolveWorkspaceUiLocale,
} from "@/lib/i18n/config";
import {
  getDeploymentProfileDefaultLocaleCandidate,
  getRequestUiLocaleCandidate,
} from "@/lib/i18n/request-locale.server";
import {
  getDingTalkWorkflowHealth,
  getInternalOperatingRuntimeOverview,
  getInternalOperatingRoleData,
  getInternalOperatingWorkspaceData,
} from "@/features/internal-operating-workspace/queries";
import {
  internalOperatingRoles,
  type InternalOperatingRole,
} from "@/lib/internal-operating-workspace";
import { getWorkspaceFirstLoopModel } from "@/lib/operating-system/first-loop-query";
import { getWorkspaceTenantResourceOperatingImpactReadout } from "@/lib/tenant-resources/workspace-operating-impact-query";

export async function loadInternalOperatingHomePageData() {
  const requestLocale = await getRequestUiLocaleCandidate();
  const session = await getCurrentWorkspaceSession();
  const workspace = session.workspace;
  const locale = resolveWorkspaceUiLocale({
    requestLocale,
    workspaceDefaultLocale: workspace.defaultLocale,
    deploymentProfileDefaultLocale: getDeploymentProfileDefaultLocaleCandidate(),
  });
  const english = isEnglishLocale(locale);
  const user = session.user;
  const groupScopeUserIds = await resolveGroupScopeUserIds({
    workspaceId: workspace.id,
    membership: {
      userId: session.membership.userId,
      role: session.membership.role,
      groupTag: session.membership.groupTag ?? null,
    },
  });
  const [
    model,
    runtimeOverview,
    dingtalkWorkflowHealth,
    firstLoopModel,
    tenantResourceImpactReadout,
  ] = await Promise.all([
    getInternalOperatingWorkspaceData(workspace.id, english, {
      workspace,
      membershipRole: session.membership.role,
      groupScopeUserIds,
    }),
    getInternalOperatingRuntimeOverview(workspace.id),
    getDingTalkWorkflowHealth(workspace.id),
    getWorkspaceFirstLoopModel({
      workspaceId: workspace.id,
      currentUserId: user.id,
      locale,
      membershipRole: session.membership.role,
      profileType: workspace.profileType,
      focusAreasJson: workspace.focusAreas,
    }),
    getWorkspaceTenantResourceOperatingImpactReadout({
      workspaceId: workspace.id,
      actorUserId: user.id,
      workspaceClass: workspace.workspaceClass,
      membershipRole: session.membership.role,
      english,
    }),
  ]);

  await logPageViewEvent({
    eventName: "internal_operating_home_opened",
    sourcePage: "/operating",
    targetType: "Workspace",
    targetId: workspace.id,
    metadata: {
      actor: user.id,
      mode: "internal-operating-home",
    },
  });

  return {
    english,
    locale,
    workspace,
    user,
    membership: session.membership,
    accessState: session.accessState,
    canManageRuntime: canManageWorkspaceRuntime(session.membership.role),
    canReviewRuntime: canReviewWorkspaceRuntime(session.membership.role),
    firstLoopModel,
    tenantResourceImpactReadout,
    model,
    runtimeOverview,
    dingtalkWorkflowHealth,
  };
}

export async function loadInternalOperatingRolePageData(
  role: string,
) {
  const requestLocale = await getRequestUiLocaleCandidate();
  const session = await getCurrentWorkspaceSession();
  const workspace = session.workspace;
  const locale = resolveWorkspaceUiLocale({
    requestLocale,
    workspaceDefaultLocale: workspace.defaultLocale,
    deploymentProfileDefaultLocale: getDeploymentProfileDefaultLocaleCandidate(),
  });
  const english = isEnglishLocale(locale);
  const user = session.user;
  const normalizedRole = internalOperatingRoles.find((item) => item === role);

  if (!normalizedRole) {
    return null;
  }

  const model = await getInternalOperatingRoleData(
    workspace.id,
    normalizedRole as InternalOperatingRole,
    english,
  );

  await logPageViewEvent({
    eventName: "internal_operating_role_surface_opened",
    sourcePage: `/operating/roles/${normalizedRole}`,
    targetType: "Workspace",
    targetId: workspace.id,
    metadata: {
      actor: user.id,
      role: normalizedRole,
      mode: "internal-operating-role-surface",
    },
  });

  return {
    english,
    locale,
    workspace,
    user,
    membership: session.membership,
    accessState: session.accessState,
    model,
  };
}
