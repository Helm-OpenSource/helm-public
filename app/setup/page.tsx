import { redirect } from "next/navigation";
import { AccessState } from "@prisma/client";
import { WorkspaceUiProvider } from "@/components/providers/workspace-ui-provider";
import { normalizeWorkspaceUiConfig } from "@/lib/workspace-ops";
import { getCurrentWorkspaceSession, getCurrentUser } from "@/lib/auth/session";
import { buildTrialOnboardingSurfaceData } from "@/lib/auth/trial-onboarding";
import { TrialOnboardingSurface } from "@/features/auth/trial-onboarding-surface";
import { SetupWizard } from "@/features/settings/setup-wizard";
import { FirstLoopSurfaceSummary } from "@/components/shared/first-loop-surface-summary";
import {
  getDeploymentProfileDefaultLocaleCandidate,
  getRequestUiLocaleCandidate,
} from "@/lib/i18n/request-locale.server";
import { findMembershipsWithExistingUsers } from "@/lib/auth/membership-with-user";
import { getWorkspaceFirstLoopModel } from "@/lib/operating-system/first-loop-query";

export default async function SetupPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  const requestLocale = await getRequestUiLocaleCandidate();
  const params = (await searchParams) ?? {};
  const onboarding = Array.isArray(params.onboarding) ? params.onboarding[0] : params.onboarding;

  if (!user) {
    redirect("/login?next=/setup");
  }

  const session = await getCurrentWorkspaceSession();
  const workspaceUiConfig = normalizeWorkspaceUiConfig({
    ...session.workspace,
    requestLocale,
    deploymentProfileDefaultLocale: getDeploymentProfileDefaultLocaleCandidate(),
  });
  const english = workspaceUiConfig.locale === "en-US";
  const shouldShowTrialOnboarding =
    !workspaceUiConfig.demoMode && (onboarding === "trial" || !session.workspace.profileType);
  const onboardingData = shouldShowTrialOnboarding
      ? await buildTrialOnboardingSurfaceData({
        workspaceId: session.workspace.id,
        role: session.membership.role,
        locale: workspaceUiConfig.locale,
        accessState:
          session.accessState ??
          session.workspace.trialState?.status ??
          AccessState.TRIALING,
        organizationName: session.workspace.name ?? (english ? "Helm Team" : "Helm 团队"),
      })
    : null;
  const firstLoopModel = await getWorkspaceFirstLoopModel({
    workspaceId: session.workspace.id,
    currentUserId: session.user.id,
    locale: workspaceUiConfig.locale,
    membershipRole: session.membership.role,
    profileType: session.workspace.profileType,
    focusAreasJson: session.workspace.focusAreas,
  });
  const teamMembers = await findMembershipsWithExistingUsers({
    where: {
      workspaceId: session.workspace.id,
    },
    orderBy: [
      { status: "asc" },
      { createdAt: "asc" },
    ],
  });

  return (
    <WorkspaceUiProvider
      locale={workspaceUiConfig.locale}
      pilotMode={workspaceUiConfig.pilotMode}
      captureConsentRequired={workspaceUiConfig.captureConsentRequired}
      dataRetentionDays={workspaceUiConfig.dataRetentionDays}
      featureFlags={workspaceUiConfig.featureFlags}
      demoMode={workspaceUiConfig.demoMode}
    >
      <div className="space-y-8">
        {onboardingData ? (
          <div className="px-6 pt-8 lg:px-10">
            <div className="mx-auto max-w-6xl">
              <TrialOnboardingSurface locale={workspaceUiConfig.locale} data={onboardingData} />
            </div>
          </div>
        ) : null}
        <div className="px-6 lg:px-10">
          <div className="mx-auto max-w-6xl">
            <FirstLoopSurfaceSummary
              model={firstLoopModel}
              english={english}
              eyebrow={english ? "Setup → first card on screen" : "初始化 → 屏幕上的第一张判断卡"}
            />
          </div>
        </div>
        <SetupWizard
          workspaceName={session.workspace.name ?? (english ? "Helm workspace" : "Helm 工作区")}
          locale={workspaceUiConfig.locale}
          teamMembers={teamMembers}
        />
      </div>
    </WorkspaceUiProvider>
  );
}
