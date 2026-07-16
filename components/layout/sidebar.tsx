"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  BriefcaseBusiness,
  CalendarDays,
  CheckSquare,
  Compass,
  Inbox,
  MemoryStick,
  Mic,
  Orbit,
  ReceiptText,
  Settings,
  Smartphone,
  Sparkles,
  Target,
  Upload,
} from "lucide-react";
import { useWorkspaceUi } from "@/components/providers/workspace-ui-provider";
import { ExtensionNavIcon } from "@/components/layout/extension-nav-icon";
import { NavLink } from "@/components/layout/nav-link";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getDemoModeProfile } from "@/lib/demo/demo-modes";
import type { WorkspaceNavExtensionCluster } from "@/lib/extensions/registry";
import {
  getDestinationCatalog,
  type DestinationEntry,
} from "@/lib/shell/role-home";

const CATALOG_ICON_BY_PREFIX: Array<[string, React.ReactNode]> = [
  ["/dashboard", <Compass key="i" className="h-4 w-4" />],
  ["/approvals", <CheckSquare key="i" className="h-4 w-4" />],
  ["/opportunities", <Orbit key="i" className="h-4 w-4" />],
  ["/customer-success", <Activity key="i" className="h-4 w-4" />],
  ["/meetings", <CalendarDays key="i" className="h-4 w-4" />],
  ["/inbox", <Inbox key="i" className="h-4 w-4" />],
  ["/memory", <MemoryStick key="i" className="h-4 w-4" />],
  ["/reports", <ReceiptText key="i" className="h-4 w-4" />],
  ["/companies", <BriefcaseBusiness key="i" className="h-4 w-4" />],
  ["/search", <Sparkles key="i" className="h-4 w-4" />],
  ["/imports", <Upload key="i" className="h-4 w-4" />],
  ["/diagnostics", <Sparkles key="i" className="h-4 w-4" />],
];

function catalogIcon(href: string): React.ReactNode {
  const hit = CATALOG_ICON_BY_PREFIX.find(([prefix]) => href.startsWith(prefix));
  return hit ? hit[1] : <Target className="h-4 w-4" />;
}

function toNavItems(
  entries: ReadonlyArray<DestinationEntry>,
  english: boolean,
  excludeHrefs: ReadonlyArray<string> = [],
) {
  return entries
    .filter((entry) => !entry.href.startsWith("/settings"))
    .filter((entry) => !excludeHrefs.some((ex) => entry.href.startsWith(ex)))
    .map((entry) => ({
      // 保留目的地 query（如控制塔 escape /dashboard?stay=1），导航才能到达/留在控制塔；
      // 高亮判定按 pathname 在 isNavLinkActive 内部剥 query 处理，二者不再耦合。
      href: entry.href,
      icon: catalogIcon(entry.href),
      label: english ? entry.labelEn : entry.labelZh,
    }));
}

export function Sidebar({
  workspaceName,
  brandLabel = null,
  pendingApprovals,
  navExtensionClusters = [],
  basePresetKey = null,
}: {
  workspaceName: string;
  /** 租户品牌行覆盖;null → messages.shell.brand。 */
  brandLabel?: string | null;
  pendingApprovals: number;
  navExtensionClusters?: ReadonlyArray<WorkspaceNavExtensionCluster>;
  basePresetKey?: string | null;
}) {
  const {
    locale,
    messages,
    pilotMode,
    featureFlags,
    demoMode,
    canAccessTenantHealth,
    isHelmReserved,
  } = useWorkspaceUi();
  const pathname = usePathname();
  const english = locale === "en-US";
  const demoProfile = demoMode ? getDemoModeProfile(demoMode, locale) : null;
  const demoShellCopy =
    demoProfile?.mode === "sales"
      ? english
        ? "Customer trials, recovery deals, and security reviews are ranked as today's next moves."
        : "客户试点、老单恢复、安全评审，已经排成今天的推进动作。"
      : demoProfile?.mode === "recruiter"
        ? english
          ? "Candidate cooling, overdue feedback, and role pressure are ranked for today's delivery."
          : "候选人降温、反馈逾期、职位压力，已经排成今天的交付动作。"
        : demoProfile?.mode === "founder"
          ? english
            ? "Founder decisions, customer follow-up, and team handoff are ranked for today."
            : "创始人决策、客户跟进、团队交接，已经排成今天的处理顺序。"
          : null;
  const operatingNavExclusions = [
    ...(canAccessTenantHealth ? ["/operating/tenant-health"] : []),
    ...(isHelmReserved ? ["/operating/gtm-leads"] : []),
  ];
  const settingsLinks = [
    {
      href: "/imports",
      label: messages.shell.nav.imports,
      icon: <Upload className="h-4 w-4" />,
    },
    {
      href: "/capture",
      label: messages.shell.nav.capture,
      icon: <Mic className="h-4 w-4" />,
    },
    {
      href: "/analytics",
      label: messages.shell.nav.analytics,
      icon: <BarChart3 className="h-4 w-4" />,
    },
    ...(featureFlags.diagnosticsCenter
      ? [
          {
            href: "/diagnostics",
            label: messages.shell.nav.diagnostics,
            icon: <Sparkles className="h-4 w-4" />,
          },
        ]
      : []),
  ];
  const settingsActive =
    pathname === "/settings" ||
    settingsLinks.some((item) => pathname.startsWith(item.href));
  const navSections = [
    {
      key: "today",
      label: english ? "What needs attention" : "今天要处理",
      items: [
        {
          href: "/dashboard",
          icon: <BarChart3 className="h-4 w-4" />,
          label: messages.shell.nav.dashboard,
        },
        {
          href: "/operating",
          icon: <BriefcaseBusiness className="h-4 w-4" />,
          label: messages.shell.nav.operating,
          activeDescendantExclusions: operatingNavExclusions,
        },
      ],
    },
    {
      key: "work",
      label: english ? "Customer assets" : "客户资产",
      items: [
        ...(isHelmReserved
          ? [
              {
                href: "/operating/gtm-leads",
                icon: <Target className="h-4 w-4" />,
                label: messages.shell.nav.gtmLeads,
              },
            ]
          : []),
        {
          href: "/opportunities",
          icon: <Orbit className="h-4 w-4" />,
          label: messages.shell.nav.opportunities,
        },
        {
          href: "/meetings",
          icon: <CalendarDays className="h-4 w-4" />,
          label: messages.shell.nav.meetings,
        },
        {
          href: "/inbox",
          icon: <Inbox className="h-4 w-4" />,
          label: messages.shell.nav.inbox,
        },
        ...(canAccessTenantHealth
          ? [
              {
                href: "/operating/tenant-health",
                icon: <Activity className="h-4 w-4" />,
                label: messages.shell.nav.tenantHealth,
              },
            ]
          : []),
      ],
    },
    {
      key: "review",
      label: english ? "Review and records" : "复核与记录",
      items: [
        {
          href: "/approvals",
          icon: <CheckSquare className="h-4 w-4" />,
          label: messages.shell.nav.approvals,
        },
        {
          href: "/memory",
          icon: <MemoryStick className="h-4 w-4" />,
          label: messages.shell.nav.memory,
        },
        {
          href: "/reports",
          icon: <ReceiptText className="h-4 w-4" />,
          label: messages.shell.nav.reports,
        },
        {
          href: "/mobile",
          icon: <Smartphone className="h-4 w-4" />,
          label: messages.shell.nav.mobile,
        },
      ],
    },
  ];

  // 控制塔模式：导航改消费逐 preset 目的地目录三层（主区/次区/收纳），
  // 收敛固定三段陈列（蓝图批1）。navExtensionClusters/设置区不变；
  // 收纳层与既有设置区链接去重（settingsLinks 已含 imports/diagnostics 等），
  // 去重后为空则整段省略，避免双入口。
  const settingsHrefs = settingsLinks.map((item) => item.href);
  const catalog = featureFlags.controlTowerHome
    ? getDestinationCatalog(basePresetKey)
    : null;
  const drawerItems = catalog
    ? toNavItems(catalog.drawer, english, settingsHrefs)
    : [];
  const renderedSections = catalog
    ? [
        {
          key: "primary",
          label: english ? "Daily core" : "主区",
          items: toNavItems(catalog.primary, english),
        },
        ...(catalog.secondary.length > 0
          ? [
              {
                key: "secondary",
                label: english ? "Periodic" : "次区",
                items: toNavItems(catalog.secondary, english),
              },
            ]
          : []),
        ...(drawerItems.length > 0
          ? [
              {
                key: "drawer",
                label: english ? "Drawer" : "收纳",
                items: drawerItems,
              },
            ]
          : []),
      ].map((section) => ({
        ...section,
        items: section.items.map((item) => ({
          ...item,
          activeDescendantExclusions: undefined as string[] | undefined,
        })),
      }))
    : navSections;

  return (
    <aside className="sticky top-0 hidden h-screen w-[288px] shrink-0 px-4 py-4 lg:flex">
      <div className="workspace-shell-panel flex h-full w-full flex-col rounded-[32px] border px-4 py-5">
        <Link href="/dashboard" className="mb-7 flex items-center gap-3 px-1">
          <div className="flex h-11 w-11 items-center justify-center rounded-[20px] bg-[color:var(--accent)] text-[color:var(--accent-foreground)] shadow-[0_20px_40px_-28px_rgba(25,70,80,0.72)]">
            <Compass className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-tight text-[color:var(--foreground)]">
              {brandLabel ?? messages.shell.brand}
            </p>
            <p className="text-xs demo-mode-soft-text">{workspaceName}</p>
          </div>
        </Link>

        <div
          className={cn(
            "mb-4 rounded-[22px] border p-3 shadow-[var(--mode-card-shadow)]",
            demoProfile ? "demo-shell-panel text-white" : "workspace-panel",
          )}
        >
          <div className="flex flex-wrap items-center gap-2">
            <p
              className={cn(
                "text-xs font-medium",
                demoProfile ? "text-white/85" : "text-[color:var(--muted-foreground)]",
              )}
            >
              {demoProfile
                ? english
                  ? "Customer scenario"
                  : "客户推进样例"
                : english
                  ? "Operating layer"
                  : "经营控制层"}
            </p>
            {pilotMode ? (
              <Badge
                variant="neutral"
                className={cn(
                  demoProfile
                    ? "bg-white/22 text-white ring-1 ring-white/40"
                    : "demo-mode-badge",
                )}
              >
                {messages.shell.pilotBadge}
              </Badge>
            ) : null}
          </div>
          <p
            className={cn(
              "mt-2 text-base font-semibold tracking-tight",
              demoProfile ? "text-white" : "text-[color:var(--foreground)]",
            )}
          >
            {demoShellCopy ?? messages.shell.shellHeadline}
          </p>
        </div>

        <nav className="flex flex-1 flex-col gap-4 overflow-y-auto pr-1">
          {renderedSections.map((section) => (
            <div key={section.key} className="space-y-1">
              <p className="px-1 pb-1 text-xs font-medium text-[color:var(--muted-foreground)]">
                {section.label}
              </p>
              {section.items.map((item) => (
                <NavLink
                  key={item.href}
                  href={item.href}
                  icon={item.icon}
                  label={item.label}
                  activeDescendantExclusions={item.activeDescendantExclusions}
                />
              ))}
            </div>
          ))}

          {navExtensionClusters.length > 0 ? (
            <div
              className="mt-4 space-y-2"
              data-testid="workspace-nav-extensions"
            >
              <p className="px-1 pb-1 text-xs font-medium text-[color:var(--muted-foreground)]">
                {english ? "Extensions" : "扩展"}
              </p>
              {navExtensionClusters.map((cluster) =>
                cluster.items.map((item) => (
                  <NavLink
                    key={item.key}
                    href={item.href}
                    icon={<ExtensionNavIcon iconKey={item.iconKey} />}
                    label={item.label}
                    trailing={
                      // "muted" (e.g. the ubiquitous 只读) is the default read-only
                      // state — noise, not signal — so we suppress its pill entirely.
                      // Only informative tones (live / planned / blocked) render.
                      item.statusBadge && item.statusBadge.tone !== "muted" ? (
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[11px] font-medium",
                            item.statusBadge.tone === "live" &&
                              "bg-[color:var(--status-success-bg)] text-[color:var(--status-success-text)]",
                            item.statusBadge.tone === "planned" &&
                              "bg-[color:var(--status-warning-bg)] text-[color:var(--status-warning-text)]",
                            item.statusBadge.tone === "blocked" &&
                              "bg-[color:var(--status-danger-bg)] text-[color:var(--status-danger-text)]",
                          )}
                        >
                          {item.statusBadge.label}
                        </span>
                      ) : undefined
                    }
                  />
                )),
              )}
            </div>
          ) : null}

          <div className="mt-3 workspace-panel-muted rounded-[26px] p-3">
            <Link
              href="/settings"
              className={cn(
                "flex items-center gap-3 rounded-[20px] px-3 py-2.5 text-sm font-medium transition",
                settingsActive
                  ? "theme-primary-action"
                  : "text-[color:var(--foreground)] hover:bg-[color:var(--surface-subtle)]",
              )}
            >
              <Settings className="h-4 w-4" />
              <span>{messages.shell.nav.settings}</span>
            </Link>
            <div className="mt-2 space-y-1">
              {settingsLinks.map((item) => {
                const active =
                  pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-[18px] px-3 py-2 text-sm transition",
                      active
                        ? "bg-[color:color-mix(in_oklab,var(--surface)_88%,white_12%)] text-[color:var(--foreground)] shadow-[0_14px_28px_-26px_rgba(15,23,42,0.65)]"
                        : "text-[color:var(--muted-foreground)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--foreground)]",
                    )}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </nav>

        <div className="workspace-panel mt-6 rounded-[26px] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[color:var(--foreground)]">
                {messages.shell.pendingApprovals}
              </p>
              <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
                {messages.shell.pendingApprovalsBody}
              </p>
            </div>
            <Badge variant="approval">{pendingApprovals}</Badge>
          </div>
          <Link
            href="/approvals"
            className="demo-mode-link mt-4 inline-flex items-center gap-2 text-sm font-medium transition hover:brightness-90"
          >
            <Sparkles className="h-4 w-4" />
            {messages.shell.viewQueue}
          </Link>
          <p className="mt-3 text-xs text-[color:var(--muted-foreground)]">
            {english
              ? "Command palette: Cmd/Ctrl + K"
              : "命令面板：Cmd/Ctrl + K"}
          </p>
        </div>
      </div>
    </aside>
  );
}
