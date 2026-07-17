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
import { resolveAssetScopedNorthstarText } from "@/lib/shell/northstar-text";
import {
  getDestinationCatalog,
  type DestinationCatalog,
  type RoleLens,
} from "@/lib/shell/role-home";

/**
 * 控制塔内容层分流（蓝图 §2，Phase 1）——同一 URL、无 redirect：
 * - 管理角色（control_tower lens）：按关心程度三层——①需要你处理（拍板 +
 *   异常收件箱，唯一可被"消化"的内容）②经营态势（北极星一行 + 主线摘要 +
 *   KPI，纯只读）③工位总览与折叠收纳。可操作内容置顶，只读态势居次。
 * - 一线角色（advance/delivery/review desk lens）：工位家视图——需拍板 +
 *   主区入口卡；不渲染主线卡带与改进候选（不给组合 KPI 面）。
 * - GENERIC（解析失败/无专属工位）：最低信息面——仅主区入口（搜索/收纳），
 *   不渲染需拍板 surface 与任何聚合读出。
 * northstarKpiSlot/attentionSlot 由页面注入（二者是独立异步 server component，
 * 在此处只决定版面位置）：控制塔 lens 内嵌入对应层；其余 lens 维持旧行为置尾。
 */
export function ControlTowerView({
  english,
  lens,
  basePresetKey,
  workstationHomeEntry,
  mainline,
  northstarText,
  viewModel,
  tenantResourceImpactReadout,
  connectorSheet,
  northstarKpiSlot,
  attentionSlot,
}: {
  english: boolean;
  lens: RoleLens;
  basePresetKey: string | null;
  workstationHomeEntry?: { href: string; label: string } | null;
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
  /** 北极星 KPI 面板（read-only），版面位置由本组件按 lens 决定 */
  northstarKpiSlot: React.ReactNode;
  /** 异常工作台 · Agent 收件箱（read-only），版面位置由本组件按 lens 决定 */
  attentionSlot: React.ReactNode;
}) {
  const catalog = withPrimaryWorkstationEntry(
    getDestinationCatalog(basePresetKey),
    workstationHomeEntry,
  );
  const scopedNorthstarText = resolveAssetScopedNorthstarText(
    northstarText,
    mainline.assetScope,
  );

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
        {northstarKpiSlot}
        {attentionSlot}
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
        {northstarKpiSlot}
        {attentionSlot}
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
      <AssetScopeSwitch
        control={mainline.assetScope}
        english={english}
      />

      {/* 层① 需要你处理——首屏即可操作：先拍板，后异常收件箱。
          这是首页唯一能被用户"消化掉"的内容，权重最高。 */}
      <DashboardHomeWorkEntrySurface
        model={viewModel.dashboardHomeWorkEntry}
        english={english}
      />
      {attentionSlot}

      {/* 层② 经营态势（纯只读）——北极星一行 + 主线卡带摘要 + KPI 面板
          归并为一层，回答"整体推进得怎么样"，居可操作内容之后。 */}
      <section
        aria-label={english ? "Operating picture" : "经营态势"}
        className="space-y-2"
      >
        <p className="text-xs text-[color:var(--muted-foreground)]">
          {scopedNorthstarText ??
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
        {northstarKpiSlot}
      </section>

      {/* 层③ 我的工位（导航层） */}
      <section
        aria-label={english ? "Desks" : "工位"}
        className="rounded-[28px] border border-[color:var(--border)] bg-[color:var(--surface)] px-5 py-4"
      >
        <h2 className="text-sm font-medium text-[color:var(--foreground)]">
          {english ? "Desks overview" : "工位总览"}
        </h2>
        <DeskEntryPills catalog={catalog} english={english} />
      </section>

      {/* 层④ 收纳——待复核的系统改进候选（默认折叠；归并旧四面板 + 租户资源面板） */}
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

function AssetScopeSwitch({
  control,
  english,
}: {
  control: MainlineReadout["assetScope"];
  english: boolean;
}) {
  if (!control || control.options.length < 2) return null;
  return (
    <nav
      aria-label={english ? "Operating asset" : "运营资产"}
      className="flex flex-wrap items-center gap-2 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-xs"
      data-shell-asset-scope
    >
      <span className="font-medium text-[color:var(--foreground)]">
        {control.label}
      </span>
      {control.options.map((option) => (
        <Link
          key={option.value}
          href={option.href}
          aria-current={option.current ? "page" : undefined}
          className={
            "rounded-md border px-2.5 py-1 transition " +
            (option.current
              ? "border-[color:var(--accent)] bg-[color:var(--accent)] text-[color:var(--accent-foreground)]"
              : "border-[color:var(--border)] text-[color:var(--foreground)] hover:bg-[color:var(--surface-subtle)]")
          }
        >
          {option.label}
        </Link>
      ))}
      {control.defaulted ? (
        <span className="text-[color:var(--muted-foreground)]">
          {english
            ? "Unknown asset was reset to the default."
            : "未知资产参数已回退到默认资产。"}
        </span>
      ) : null}
    </nav>
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

function withPrimaryWorkstationEntry(
  catalog: DestinationCatalog,
  entry: { href: string; label: string } | null | undefined,
): DestinationCatalog {
  if (!entry) return catalog;
  const primary = [
    {
      href: entry.href,
      labelZh: entry.label,
      labelEn: entry.label,
    },
    ...catalog.primary.filter((item) => item.href !== entry.href),
  ].slice(0, 4);
  return {
    primary,
    secondary: catalog.secondary,
    drawer: catalog.drawer,
  };
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
