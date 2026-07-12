import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { OperatingFoundationSummaryCard } from "@/components/shared/operating-foundation-summary";
import { ProactiveMechanismPanel } from "@/components/shared/proactive-mechanism-panel";
import { ReportingProtocolPanel } from "@/components/shared/reporting-protocol-panel";
import { TenantResourceOperatingImpactPanel } from "@/components/shared/tenant-resource-operating-impact-panel";
import { DashboardHomeWorkEntrySurface } from "@/features/dashboard/home-work-entry-surface";
import { DashboardHomeImplementationConsolePanel } from "@/features/dashboard/home-implementation-console-panel";
import { MainlineStrip } from "@/features/dashboard/control-tower/mainline-strip";
import type { DashboardPageData } from "@/features/dashboard/page-loader";
import type { DashboardViewModel } from "@/features/dashboard/view-model";
import type { MainlineReadout } from "@/lib/shell/operating-mainline";
import {
  getDestinationCatalog,
  type DestinationCatalog,
  type RoleLens,
} from "@/lib/shell/role-home";

/**
 * 控制塔内容层分流（蓝图 §2，Phase 1）——同一 URL、无 redirect：
 * - 管理角色（control_tower lens）：四段完整控制塔。段①主线为**纯展示摘要**
 *   （不可点击），首个可操作区块 = 段②"需要你拍板"。
 * - 一线角色（advance/delivery/review desk lens）：工位家视图——需拍板 +
 *   主区入口卡；不渲染主线卡带与改进候选（不给组合 KPI 面）。
 * - GENERIC（解析失败/无专属工位）：最低信息面——仅主区入口（搜索/收纳），
 *   不渲染需拍板 surface 与任何聚合读出。
 */
export function ControlTowerView({
  english,
  lens,
  basePresetKey,
  mainline,
  northstarText,
  viewModel,
  tenantResourceImpactReadout,
  connectorSheet,
}: {
  english: boolean;
  lens: RoleLens;
  basePresetKey: string | null;
  mainline: MainlineReadout;
  northstarText: string | null;
  viewModel: Pick<
    DashboardViewModel,
    | "dashboardHomeWorkEntry"
    | "operatingFoundationSummary"
    | "dashboardProtocol"
    | "founderProactiveFlow"
  >;
  tenantResourceImpactReadout: DashboardPageData["tenantResourceImpactReadout"];
  /** ConnectorBindingSuccessSheet，与旧版一致置于根节点内首位 */
  connectorSheet: React.ReactNode;
}) {
  const catalog = getDestinationCatalog(basePresetKey);

  if (lens === "generic") {
    return (
      <div className="space-y-6" data-source-page="/dashboard" data-shell-view="generic-home">
        {connectorSheet}
        <PageHeader
          eyebrow={english ? "Workspace" : "工作台"}
          title={english ? "Your workspace" : "你的工作台"}
          description={
            english
              ? "No dedicated desk is configured for your role yet."
              : "你的角色暂无专属工位（诚实标注）。"
          }
        />
        <DeskEntries catalog={catalog} english={english} />
      </div>
    );
  }

  if (lens !== "control_tower") {
    return (
      <div className="space-y-6" data-source-page="/dashboard" data-shell-view="workstation-home">
        {connectorSheet}
        <PageHeader
          eyebrow={english ? "My desk" : "我的工位"}
          title={
            english
              ? "Today's queue and calls that need you"
              : "今天的队列与需要你拍板的事"
          }
          description={
            english
              ? "Suggestions only — nothing executes or sends without human review."
              : "全部为建议——未经人工复核不执行、不外发。"
          }
        />
        {/* 工位家：首个可操作区块 = 需要你拍板 */}
        <DashboardHomeWorkEntrySurface
          model={viewModel.dashboardHomeWorkEntry}
          english={english}
        />
        <DeskEntries catalog={catalog} english={english} />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-source-page="/dashboard" data-shell-view="control-tower">
      {connectorSheet}
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

      {/* 段① 经营主线（北极星一行 + 纯展示卡带摘要，不可点击） */}
      <div className="space-y-2">
        <p className="text-xs text-[color:var(--muted-foreground)]">
          {northstarText ??
            (english ? (
              <>
                No north-star goal set —{" "}
                <Link href="/settings" className="underline">
                  configure in settings
                </Link>
              </>
            ) : (
              <>
                未设定北极星目标 ——{" "}
                <Link href="/settings" className="underline">
                  去设置
                </Link>
              </>
            ))}
        </p>
        <MainlineStrip readout={mainline} english={english} />
      </div>

      {/* 段② 需要你拍板（首个可操作区块） */}
      <DashboardHomeWorkEntrySurface
        model={viewModel.dashboardHomeWorkEntry}
        english={english}
      />

      {/* 段③ 我的工位 */}
      <section
        aria-label={english ? "Desks" : "工位"}
        className="rounded-[28px] border border-[color:var(--border)] bg-[color:var(--surface)] px-5 py-4"
      >
        <h2 className="text-sm font-medium text-[color:var(--foreground)]">
          {english ? "Desks overview" : "工位总览"}
        </h2>
        <DeskEntryPills catalog={catalog} english={english} />
      </section>

      {/* 段④ 待复核的系统改进候选（默认折叠；归并旧四面板 + 租户资源面板） */}
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

function DeskEntryPills({
  catalog,
  english,
}: {
  catalog: DestinationCatalog;
  english: boolean;
}) {
  return (
    <>
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
    </>
  );
}

function DeskEntries({
  catalog,
  english,
}: {
  catalog: DestinationCatalog;
  english: boolean;
}) {
  return (
    <section
      aria-label={english ? "My desk entries" : "工位入口"}
      className="rounded-[28px] border border-[color:var(--border)] bg-[color:var(--surface)] px-5 py-4"
    >
      <h2 className="text-sm font-medium text-[color:var(--foreground)]">
        {english ? "My desk" : "我的工位"}
      </h2>
      <DeskEntryPills catalog={catalog} english={english} />
    </section>
  );
}
