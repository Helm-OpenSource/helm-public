import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import { resolveWorkspaceDefaultLandingPath } from "@/lib/workspace-ops";
import { OperatingFoundationSummaryCard } from "@/components/shared/operating-foundation-summary";
import { PageHeader } from "@/components/shared/page-header";
import { ProactiveMechanismPanel } from "@/components/shared/proactive-mechanism-panel";
import { ReportingProtocolPanel } from "@/components/shared/reporting-protocol-panel";
import { TenantResourceOperatingImpactPanel } from "@/components/shared/tenant-resource-operating-impact-panel";
import { Button } from "@/components/ui/button";
import { getDemoModeProfiles } from "@/lib/demo/demo-modes";
import { loadDashboardPageData } from "@/features/dashboard/page-loader";
import { buildDashboardViewModel } from "@/features/dashboard/view-model";
import { DashboardHomeWorkEntrySurface } from "@/features/dashboard/home-work-entry-surface";
import { DashboardHomeImplementationConsolePanel } from "@/features/dashboard/home-implementation-console-panel";
import { ConnectorBindingSuccessSheet } from "@/features/dashboard/connector-binding-success-sheet";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  // 工作区可配置默认落地页(如租户 OS 首页);?stay=1 为运营逃生口,保留原生 dashboard 可达。
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
  const {
    pageStory,
    tenantResourceImpactReadout,
    locale,
    demoMode,
    english,
  } = pageData;

  const viewModel = buildDashboardViewModel({ pageData, entry });
  const {
    operatingFoundationSummary,
    dashboardHomeWorkEntry,
    dashboardProtocol,
    founderProactiveFlow,
  } = viewModel;

  const demoQuickPathToMeetings = demoMode
    ? getDemoModeProfiles(locale)
        .find((profile) => profile.mode === demoMode)
        ?.quickPath.find((item) => item.href === "/meetings")
    : null;

  return (
    <div className="space-y-6" data-source-page="/dashboard">
      <ConnectorBindingSuccessSheet
        english={english}
        status={connectorBindingStatus}
        message={connectorBindingMessage}
      />

      <PageHeader
        eyebrow={pageStory.eyebrow}
        title={
          pageStory.title ??
          (english ? "Today's 3 calls that need you" : "今天必须由你拍板的 3 件事")
        }
        description={pageStory.description}
        actions={
          demoQuickPathToMeetings ? (
            <Button asChild size="sm" variant="secondary">
              <Link href={demoQuickPathToMeetings.href}>
                {demoQuickPathToMeetings.label}
              </Link>
            </Button>
          ) : null
        }
      />

      <DashboardHomeWorkEntrySurface
        model={dashboardHomeWorkEntry}
        english={english}
      />

      {tenantResourceImpactReadout.totalResources > 0 ? (
        <TenantResourceOperatingImpactPanel
          readout={tenantResourceImpactReadout}
          english={english}
          surface="dashboard"
        />
      ) : null}

      <details className="group rounded-[28px] border border-[color:var(--border)] bg-[color:var(--surface)] px-5 py-4">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-[color:var(--foreground)] marker:content-none [&::-webkit-details-marker]:hidden">
          <span>
            {english
              ? "Open customer assets, evidence and coordination context"
              : "展开客户资产变化、依据和协作背景"}
          </span>
          <span className="rounded-full border border-[color:var(--border)] px-2.5 py-1 text-xs text-[color:var(--muted-foreground)] transition group-open:bg-[color:var(--surface-subtle)]">
            {english ? "Details" : "详情"}
          </span>
        </summary>
        <div className="mt-5 space-y-5">
          <DashboardHomeImplementationConsolePanel english={english} />

          <OperatingFoundationSummaryCard
            label={operatingFoundationSummary.label}
            title={operatingFoundationSummary.title}
            summary={operatingFoundationSummary.summary}
            items={operatingFoundationSummary.items}
            connections={operatingFoundationSummary.connections}
            note={operatingFoundationSummary.note}
          />

          <ReportingProtocolPanel protocol={dashboardProtocol} english={english} />

          <ProactiveMechanismPanel
            title={english ? "Prepared context" : "已准备的背景"}
            flows={[founderProactiveFlow]}
            english={english}
          />
        </div>
      </details>
    </div>
  );
}
