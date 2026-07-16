import Link from "next/link";
import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import { logPageViewEvent } from "@/lib/analytics";
import {
  canManageWorkspaceInsights,
  getInsightGovernanceDeniedMessage,
} from "@/lib/auth/insight-governance";
import { getWorkspaceBusinessLoopGapReadout } from "@/lib/helm-v2/runtime-upgrade";
import { getWeeklyReports } from "@/lib/reports";
import { getLatestEngineeringDeliverySnapshot } from "@/lib/reports/engineering-delivery-review-refresh";
import { safeParseJson } from "@/lib/utils";
import { canViewEngineeringDeliveryReview } from "@/lib/workspace-identity";
import { ReportsClient } from "@/features/reports/reports-client";
import { getWorkspaceFirstLoopModel } from "@/lib/operating-system/first-loop-query";
import { normalizeWorkspaceUiConfig } from "@/lib/workspace-ops";
import {
  getDeploymentProfileDefaultLocaleCandidate,
  getRequestUiLocaleCandidate,
} from "@/lib/i18n/request-locale.server";
import { getFirstLoopAdoptionData } from "@/features/diagnostics/queries";
import { Button } from "@/components/ui/button";
import {
  logReportsExtensionPageView,
  resolveReportsExtensions,
  type ReportsExtensionTab,
} from "@/lib/extensions/registry";

type ReportsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function ReportsTabNav(input: {
  activeTab: string;
  extensionTabs: ReportsExtensionTab[];
  english: boolean;
}) {
  if (input.extensionTabs.length === 0) {
    return null;
  }

  const tabs: ReportsExtensionTab[] = [
    {
      key: "shared",
      label: input.english ? "Weekly operating review" : "本周经营复盘",
      href: "/reports",
    },
    ...input.extensionTabs,
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {tabs.map((tab) => (
        <Button key={tab.key} asChild variant={input.activeTab === tab.key ? "default" : "secondary"}>
          <Link href={tab.href}>{tab.label}</Link>
        </Button>
      ))}
      <Button asChild variant="ghost" size="sm" className="ml-auto">
        <Link href="/dashboard" data-testid="reports-daily-pulse-entry">
          {input.english ? "Today’s push →" : "今日推进 →"}
        </Link>
      </Button>
    </div>
  );
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const { membership, user, workspace } = await getCurrentWorkspaceSession();
  const requestLocale = await getRequestUiLocaleCandidate();
  const { locale } = normalizeWorkspaceUiConfig({
    ...workspace,
    requestLocale,
    deploymentProfileDefaultLocale: getDeploymentProfileDefaultLocaleCandidate(),
  });
  const english = locale === "en-US";
  const params = (await searchParams) ?? {};
  const requestedTab = Array.isArray(params.tab) ? params.tab[0] : params.tab;

  const reportsExtensions = await resolveReportsExtensions({
    workspace,
    english,
    requestedTab,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
    },
    membership: {
      id: membership.id,
      workspaceId: membership.workspaceId,
      role: membership.role,
      status: membership.status,
      rolePresetKey: membership.rolePresetKey,
      persona: membership.persona,
      title: membership.title,
    },
  });

  const activeTab = reportsExtensions.active
    ? reportsExtensions.tabs.find((tab) =>
        reportsExtensions.active &&
        // The route resolves activeTab key by matching href against an
        // extension tab; registry surfaces are keyed by tab.key.
        tab.href.includes(`tab=${requestedTab}`),
      )?.key ?? "shared"
    : "shared";

  if (reportsExtensions.active) {
    await logReportsExtensionPageView(reportsExtensions.active.pageViewEvent);

    return (
      <div className="workspace-surface-stack">
        <ReportsTabNav
          activeTab={activeTab}
          extensionTabs={reportsExtensions.tabs}
          english={english}
        />
        {reportsExtensions.active.surface}
      </div>
    );
  }

  const [
    reports,
    businessLoopGapReadout,
    engineeringDeliveryReview,
    firstLoopModel,
    firstLoopAdoption,
  ] = await Promise.all([
    getWeeklyReports(workspace.id),
    getWorkspaceBusinessLoopGapReadout(workspace.id),
    canViewEngineeringDeliveryReview(workspace)
      ? getLatestEngineeringDeliverySnapshot({ english })
      : Promise.resolve(null),
    getWorkspaceFirstLoopModel({
      workspaceId: workspace.id,
      currentUserId: user.id,
      locale,
      membershipRole: membership.role,
      profileType: workspace.profileType,
      focusAreasJson: workspace.focusAreas,
    }),
    getFirstLoopAdoptionData(workspace.id, { currentUserId: user.id }),
  ]);

  await logPageViewEvent({
    eventName: "weekly_report_viewed",
    sourcePage: "/reports",
    targetType: "Page",
    targetId: "/reports",
  });

  return (
    <div className="workspace-surface-stack">
      <ReportsTabNav
        activeTab="shared"
        extensionTabs={reportsExtensions.tabs}
        english={english}
      />
      <ReportsClient
        reports={reports.map((report) => ({
          ...report,
          payload: safeParseJson<Record<string, unknown>>(report.payload, {}),
        }))}
        businessLoopGapSummary={businessLoopGapReadout.businessLoopGapSummary}
        engineeringDeliveryReview={engineeringDeliveryReview}
        firstLoopModel={firstLoopModel}
        firstLoopAdoption={firstLoopAdoption}
        insightGovernance={{
          canManage: canManageWorkspaceInsights(membership.role),
          manageDeniedMessage: getInsightGovernanceDeniedMessage(english),
        }}
      />
    </div>
  );
}
