import "server-only";

import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import { logPageViewEvent } from "@/lib/analytics";
import { resolveWorkspaceDemoMode } from "@/lib/demo/demo-modes";
import { getEvolutionInsights } from "@/lib/evolution/evolution-insights.service";
import {
  isEnglishLocale,
  resolveWorkspaceUiLocale,
} from "@/lib/i18n/config";
import {
  getDeploymentProfileDefaultLocaleCandidate,
  getRequestUiLocaleCandidate,
} from "@/lib/i18n/request-locale.server";
import { getWorkspaceStory } from "@/lib/presentation/workspace-story";
import {
  getEmptyTodayFocusRecommendations,
  getTodayFocusRecommendations,
} from "@/lib/recommendations/recommendation.service";
import { isWorkspaceServiceGovernanceError } from "@/lib/auth/service-governance";
import { getWorkspaceBusinessLoopGapReadout } from "@/lib/helm-v2/runtime-upgrade";
import { getWorkspaceFirstLoopModel } from "@/lib/operating-system/first-loop-query";
import { getWorkspaceTenantResourceOperatingImpactReadout } from "@/lib/tenant-resources/workspace-operating-impact-query";
import { getDashboardData } from "@/features/dashboard/queries";
import { getInternalOperatingWorkspaceData } from "@/features/internal-operating-workspace/queries";

export async function loadDashboardPageData() {
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
  const demoMode = resolveWorkspaceDemoMode(workspace.configuration);
  const pageStory = getWorkspaceStory("dashboard", locale, demoMode);

  const [
    data,
    todayFocus,
    evolution,
    operatingHome,
    businessLoopGapReadout,
    firstLoopModel,
    tenantResourceImpactReadout,
  ] = await Promise.all([
    getDashboardData(workspace.id, user.id),
    getTodayFocusRecommendations({
      workspaceId: workspace.id,
      actorName: user.name,
      actorUserId: user.id,
      actorType: "USER",
      sourcePage: "/dashboard",
      // Keep dashboard first paint stable even when model endpoints are unavailable or slow.
      llmEnhancement: false,
    }).catch((error) => {
      if (isWorkspaceServiceGovernanceError(error)) {
        return getEmptyTodayFocusRecommendations();
      }
      throw error;
    }),
    getEvolutionInsights({
      workspaceId: workspace.id,
      userId: user.id,
      limit: 3,
    }),
    getInternalOperatingWorkspaceData(workspace.id, english, {
      workspace,
      membershipRole: session.membership.role,
    }),
    getWorkspaceBusinessLoopGapReadout(workspace.id),
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
    eventName: "dashboard_opened",
    sourcePage: "/dashboard",
  });

  return {
    english,
    locale,
    demoMode,
    pageStory,
    data,
    todayFocus,
    evolution,
    operatingHome,
    businessLoopGapReadout,
    firstLoopModel,
    tenantResourceImpactReadout,
    user,
    workspace,
    membership: session.membership,
    accessState: session.accessState,
  };
}

export type DashboardPageData = Awaited<ReturnType<typeof loadDashboardPageData>>;
