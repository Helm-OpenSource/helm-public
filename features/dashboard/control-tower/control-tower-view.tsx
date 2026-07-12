import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { OperatingFoundationSummaryCard } from "@/components/shared/operating-foundation-summary";
import { ProactiveMechanismPanel } from "@/components/shared/proactive-mechanism-panel";
import { ReportingProtocolPanel } from "@/components/shared/reporting-protocol-panel";
import { TenantResourceOperatingImpactPanel } from "@/components/shared/tenant-resource-operating-impact-panel";
import type { DashboardPageData } from "@/features/dashboard/page-loader";
import { DashboardHomeWorkEntrySurface } from "@/features/dashboard/home-work-entry-surface";
import { DashboardHomeImplementationConsolePanel } from "@/features/dashboard/home-implementation-console-panel";
import { MainlineStrip } from "@/features/dashboard/control-tower/mainline-strip";
import type { DashboardViewModel } from "@/features/dashboard/view-model";
import type { MainlineReadout } from "@/lib/shell/operating-mainline";
import {
  getDestinationCatalog,
  type RoleLens,
} from "@/lib/shell/role-home";

/**
 * 控制塔四段式 home（蓝图 §2，Phase 1）。
 *
 * 段序与红线：①主线只是顶部摘要（紧凑横条，移动端可横向滚动、不挤占首屏）；
 * **首个可操作区块 = ②需要你拍板**（升舱复用 home-work-entry，保留
 * #employee-assignment-actions 锚点契约）；③我的工位按角色 lens 渲染主区
 * ≤4 入口（内容层视图选择，无 redirect）；④待复核的系统改进候选默认折叠
 * （归并旧 dashboard 四说明面板；candidate 不自动晋升，review-first）。
 */
export function ControlTowerView({
  english,
  lens,
  mainline,
  viewModel,
  tenantResourceImpactReadout,
}: {
  english: boolean;
  lens: RoleLens;
  mainline: MainlineReadout;
  viewModel: Pick<
    DashboardViewModel,
    | "dashboardHomeWorkEntry"
    | "operatingFoundationSummary"
    | "dashboardProtocol"
    | "founderProactiveFlow"
  >;
  tenantResourceImpactReadout: DashboardPageData["tenantResourceImpactReadout"];
}) {
  const catalog = getDestinationCatalog(lens);
  const isManagement = lens === "control_tower";

  return (
    <div className="space-y-6" data-source-page="/dashboard" data-shell-view="control-tower">
      <PageHeader
        eyebrow={english ? "Control tower" : "控制塔"}
        title={
          english
            ? "What the system is advancing, and where it needs you"
            : "系统正在推进什么、哪里需要你拍板"
        }
        description={
          english
            ? "Suggestions only — nothing executes or sends without human review."
            : "全部为建议——未经人工复核不执行、不外发。"
        }
      />

      {/* 段① 经营主线（顶部摘要） */}
      <MainlineStrip readout={mainline} english={english} />

      {/* 段② 需要你拍板（首个可操作区块） */}
      <DashboardHomeWorkEntrySurface
        model={viewModel.dashboardHomeWorkEntry}
        english={english}
      />

      {/* 段③ 我的工位 */}
      <section
        aria-label={english ? "My desk" : "我的工位"}
        className="rounded-[28px] border border-[color:var(--border)] bg-[color:var(--surface)] px-5 py-4"
      >
        <h2 className="text-sm font-medium text-[color:var(--foreground)]">
          {english
            ? isManagement
              ? "Desks overview"
              : "My desk"
            : isManagement
              ? "工位总览"
              : "我的工位"}
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {catalog.primary.map((entry) => (
            <Link
              key={entry.href}
              href={entry.href}
              className="rounded-full border border-[color:var(--border)] px-3 py-1.5 text-sm text-[color:var(--foreground)] hover:bg-[color:var(--surface-subtle)]"
            >
              {english ? entry.labelEn : entry.labelZh}
            </Link>
          ))}
        </div>
        {catalog.secondary.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {catalog.secondary.map((entry) => (
              <Link
                key={entry.href}
                href={entry.href}
                className="rounded-full px-3 py-1 text-xs text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"
              >
                {english ? entry.labelEn : entry.labelZh}
              </Link>
            ))}
          </div>
        ) : null}
      </section>

      {/* 段④ 待复核的系统改进候选（默认折叠；归并旧四面板） */}
      <details className="group rounded-[28px] border border-[color:var(--border)] bg-[color:var(--surface)] px-5 py-4">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-[color:var(--foreground)] marker:content-none [&::-webkit-details-marker]:hidden">
          <span>
            {english
              ? "Improvement candidates pending review"
              : "待复核的系统改进候选"}
          </span>
          <span className="rounded-full border border-[color:var(--border)] px-2.5 py-1 text-xs text-[color:var(--muted-foreground)] transition group-open:bg-[color:var(--surface-subtle)]">
            {english ? "Details" : "详情"}
          </span>
        </summary>
        <div className="mt-5 space-y-5">
          <p className="text-xs text-[color:var(--muted-foreground)]">
            {english
              ? "Candidates never promote automatically; adoption is a human decision recorded in "
              : "候选不会自动晋升为正式记忆；采纳是人工决定，记录于 "}
            <Link href="/memory" className="underline">
              /memory
            </Link>
            。
          </p>
          <DashboardHomeImplementationConsolePanel english={english} />
          <OperatingFoundationSummaryCard
            label={viewModel.operatingFoundationSummary.label}
            title={viewModel.operatingFoundationSummary.title}
            summary={viewModel.operatingFoundationSummary.summary}
            items={viewModel.operatingFoundationSummary.items}
            connections={viewModel.operatingFoundationSummary.connections}
            note={viewModel.operatingFoundationSummary.note}
          />
          <ReportingProtocolPanel
            protocol={viewModel.dashboardProtocol}
            english={english}
          />
          <ProactiveMechanismPanel
            title={english ? "Prepared context" : "已准备的背景"}
            flows={[viewModel.founderProactiveFlow]}
            english={english}
          />
          {tenantResourceImpactReadout.totalResources > 0 ? (
            <TenantResourceOperatingImpactPanel
              readout={tenantResourceImpactReadout}
              english={english}
              surface="dashboard"
            />
          ) : null}
        </div>
      </details>
    </div>
  );
}
