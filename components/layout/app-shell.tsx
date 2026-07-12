import { WorkspaceUiProvider } from "@/components/providers/workspace-ui-provider";
import { DemoTourBanner } from "@/components/layout/demo-tour-banner";
import { ShellChromeGate } from "@/components/layout/shell-chrome-gate";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import type { DemoMode } from "@/lib/demo/demo-modes";
import type { WorkspaceNavExtensionCluster } from "@/lib/extensions/registry";
import type { UiLocale } from "@/lib/i18n/config";
import type { ShellChromeProfile } from "@/lib/shell/shell-chrome";
import type { WorkspaceFeatureFlags } from "@/lib/workspace-ops";

type AppShellProps = {
  workspaceName: string;
  userName: string;
  roleLabel: string;
  locale: UiLocale;
  pilotMode: boolean;
  captureConsentRequired: boolean;
  dataRetentionDays: number;
  featureFlags: WorkspaceFeatureFlags;
  demoMode: DemoMode | null;
  canAccessTenantHealth: boolean;
  isHelmReserved: boolean;
  pendingApprovals: number;
  notificationCount: number;
  alerts: Array<{
    id: string;
    type: "approval" | "risk" | "meeting" | "notification";
    title: string;
    body: string;
    url: string;
    createdAt: Date;
  }>;
  quickCreateData: {
    companies: Array<{ id: string; name: string }>;
    contacts: Array<{ id: string; name: string }>;
    opportunities: Array<{ id: string; title: string }>;
    meetings: Array<{ id: string; title: string; startsAt: Date }>;
    memberships: Array<{
      id: string;
      role: string;
      user: { id: string; name: string };
    }>;
  };
  navExtensionClusters: ReadonlyArray<WorkspaceNavExtensionCluster>;
  shellChromeProfiles: ReadonlyArray<ShellChromeProfile>;
  children: React.ReactNode;
};

export function AppShell({
  workspaceName,
  userName,
  roleLabel,
  locale,
  pilotMode,
  captureConsentRequired,
  dataRetentionDays,
  featureFlags,
  demoMode,
  canAccessTenantHealth,
  isHelmReserved,
  pendingApprovals,
  notificationCount,
  alerts,
  quickCreateData,
  navExtensionClusters,
  shellChromeProfiles,
  children,
}: AppShellProps) {
  const resolvedDemoMode = demoMode ?? "default";
  const experienceMode = demoMode ? "demo" : "use";

  return (
    <WorkspaceUiProvider
      locale={locale}
      pilotMode={pilotMode}
      captureConsentRequired={captureConsentRequired}
      dataRetentionDays={dataRetentionDays}
      featureFlags={featureFlags}
      demoMode={demoMode}
      canAccessTenantHealth={canAccessTenantHealth}
      isHelmReserved={isHelmReserved}
    >
      <div
        className="demo-shell flex min-h-screen min-w-0 max-w-full overflow-x-hidden bg-transparent"
        data-demo-mode={resolvedDemoMode}
        data-experience-mode={experienceMode}
      >
        {shellChromeProfiles.length === 0 ? (
          <Sidebar
            workspaceName={workspaceName}
            pendingApprovals={pendingApprovals}
            navExtensionClusters={navExtensionClusters}
          />
        ) : (
          <ShellChromeGate profiles={shellChromeProfiles}>
            <Sidebar
              workspaceName={workspaceName}
              pendingApprovals={pendingApprovals}
              navExtensionClusters={navExtensionClusters}
            />
          </ShellChromeGate>
        )}
        <div className="min-w-0 flex-1 overflow-x-hidden px-0 pb-6">
          <Topbar
            workspaceName={workspaceName}
            userName={userName}
            roleLabel={roleLabel}
            notificationCount={notificationCount}
            alerts={alerts}
            quickCreateData={quickCreateData}
          />
          <main className="mx-auto flex min-w-0 w-full max-w-[1580px] flex-col gap-6 px-4 pt-5 lg:px-8 lg:pt-6">
            {false ? <DemoTourBanner /> : null}
            {children}
          </main>
        </div>
      </div>
    </WorkspaceUiProvider>
  );
}
