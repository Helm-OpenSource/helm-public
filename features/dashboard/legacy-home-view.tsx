import Link from "next/link";
import { OperatingFoundationSummaryCard } from "@/components/shared/operating-foundation-summary";
import { PageHeader } from "@/components/shared/page-header";
import { ProactiveMechanismPanel } from "@/components/shared/proactive-mechanism-panel";
import { ReportingProtocolPanel } from "@/components/shared/reporting-protocol-panel";
import { TenantResourceOperatingImpactPanel } from "@/components/shared/tenant-resource-operating-impact-panel";
import { Button } from "@/components/ui/button";
import { DashboardHomeWorkEntrySurface } from "@/features/dashboard/home-work-entry-surface";
import { DashboardHomeImplementationConsolePanel } from "@/features/dashboard/home-implementation-console-panel";
import { Stage1OwnerLoopConsole } from "@/features/dashboard/stage1-owner-loop-console";
import type { DashboardPageData } from "@/features/dashboard/page-loader";
import type { DashboardViewModel } from "@/features/dashboard/view-model";

/**
 * 旧版 dashboard 视图（controlTowerHome 关闭时的回滚态）。
 * 2026-10-15 起按对象优先：资源影响与背景面板折进工作入口末尾唯一的系统判断块。
 * Object-first since 2026-10-15: resource impact and context panels fold into
 * the work entry's single closing system judgement block.
 */
export function LegacyHomeView({
  pageData,
  viewModel,
  demoQuickPathToMeetings,
  connectorSheet,
}: {
  pageData: Pick<
    DashboardPageData,
    | "english"
    | "pageStory"
    | "tenantResourceImpactReadout"
    | "stage1OwnerLoopReadout"
  >;
  viewModel: Pick<
    DashboardViewModel,
    | "dashboardHomeWorkEntry"
    | "operatingFoundationSummary"
    | "dashboardProtocol"
    | "founderProactiveFlow"
  >;
  demoQuickPathToMeetings: { href: string; label: string } | null;
  /** 原 page 中 ConnectorBindingSuccessSheet 位于根节点内首位；层级保持原样 */
  connectorSheet: React.ReactNode;
}) {
  const {
    english,
    pageStory,
    tenantResourceImpactReadout,
    stage1OwnerLoopReadout,
  } = pageData;
  const {
    operatingFoundationSummary,
    dashboardHomeWorkEntry,
    dashboardProtocol,
    founderProactiveFlow,
  } = viewModel;

  return (
    <div className="space-y-6" data-source-page="/dashboard">
      {connectorSheet}

      <PageHeader
        eyebrow={pageStory.eyebrow}
        title={pageStory.title ?? (english ? "Today's work" : "今天的工作")}
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
        supplementary={
          <>
            {tenantResourceImpactReadout.totalResources > 0 ? (
              <TenantResourceOperatingImpactPanel
                readout={tenantResourceImpactReadout}
                english={english}
                surface="dashboard"
              />
            ) : null}
            <DashboardHomeImplementationConsolePanel english={english} />
            <OperatingFoundationSummaryCard
              label={operatingFoundationSummary.label}
              title={operatingFoundationSummary.title}
              summary={operatingFoundationSummary.summary}
              items={operatingFoundationSummary.items}
              connections={operatingFoundationSummary.connections}
              note={operatingFoundationSummary.note}
            />
            <ReportingProtocolPanel
              protocol={dashboardProtocol}
              english={english}
            />
            <ProactiveMechanismPanel
              title={english ? "Prepared context" : "已准备的背景"}
              flows={[founderProactiveFlow]}
              english={english}
            />
          </>
        }
      />

      {stage1OwnerLoopReadout ? (
        <Stage1OwnerLoopConsole
          readout={stage1OwnerLoopReadout}
          english={english}
        />
      ) : null}
    </div>
  );
}
