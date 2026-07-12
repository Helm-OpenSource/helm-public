import Link from "next/link";
import { OperatingFoundationSummaryCard } from "@/components/shared/operating-foundation-summary";
import { PageHeader } from "@/components/shared/page-header";
import { ProactiveMechanismPanel } from "@/components/shared/proactive-mechanism-panel";
import { ReportingProtocolPanel } from "@/components/shared/reporting-protocol-panel";
import { TenantResourceOperatingImpactPanel } from "@/components/shared/tenant-resource-operating-impact-panel";
import { Button } from "@/components/ui/button";
import { DashboardHomeWorkEntrySurface } from "@/features/dashboard/home-work-entry-surface";
import { DashboardHomeImplementationConsolePanel } from "@/features/dashboard/home-implementation-console-panel";
import type { DashboardPageData } from "@/features/dashboard/page-loader";
import type { DashboardViewModel } from "@/features/dashboard/view-model";

/**
 * 旧版 dashboard 视图（controlTowerHome 关闭时的回滚态）。
 * 内容与拆分前的 /dashboard 完全一致；仅从 page 抽出为组件。
 */
export function LegacyHomeView({
  pageData,
  viewModel,
  demoQuickPathToMeetings,
}: {
  pageData: Pick<
    DashboardPageData,
    "english" | "pageStory" | "tenantResourceImpactReadout"
  >;
  viewModel: Pick<
    DashboardViewModel,
    | "dashboardHomeWorkEntry"
    | "operatingFoundationSummary"
    | "dashboardProtocol"
    | "founderProactiveFlow"
  >;
  demoQuickPathToMeetings: { href: string; label: string } | null;
}) {
  const { english, pageStory, tenantResourceImpactReadout } = pageData;
  const {
    operatingFoundationSummary,
    dashboardHomeWorkEntry,
    dashboardProtocol,
    founderProactiveFlow,
  } = viewModel;

  return (
    <div className="space-y-6" data-source-page="/dashboard">
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
