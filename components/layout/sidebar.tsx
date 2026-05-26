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

export function Sidebar({
  workspaceName,
  pendingApprovals,
  navExtensionClusters = [],
}: {
  workspaceName: string;
  pendingApprovals: number;
  navExtensionClusters?: ReadonlyArray<WorkspaceNavExtensionCluster>;
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
      href: "/inbox",
      label: messages.shell.nav.inbox,
      icon: <Inbox className="h-4 w-4" />,
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

  return (
    <aside className="sticky top-0 hidden h-screen w-[288px] shrink-0 px-4 py-4 lg:flex">
      <div className="workspace-shell-panel flex h-full w-full flex-col rounded-[32px] border px-4 py-5">
        <Link href="/dashboard" className="mb-7 flex items-center gap-3 px-1">
          <div className="flex h-11 w-11 items-center justify-center rounded-[20px] bg-[color:var(--accent)] text-[color:var(--accent-foreground)] shadow-[0_20px_40px_-28px_rgba(25,70,80,0.72)]">
            <Compass className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-tight text-[color:var(--foreground)]">
              {messages.shell.brand}
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
                ? demoProfile.badge
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
            {demoProfile ? demoProfile.title : messages.shell.shellHeadline}
          </p>
        </div>

        <nav className="flex flex-1 flex-col gap-3 overflow-y-auto pr-1">
          <div className="px-1 pb-1">
            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
              {english ? "Decision loop" : "经营循环"}
            </p>
          </div>
          <NavLink
            href="/dashboard"
            icon={<BarChart3 className="h-4 w-4" />}
            label={messages.shell.nav.dashboard}
          />
          <NavLink
            href="/operating"
            icon={<BriefcaseBusiness className="h-4 w-4" />}
            label={messages.shell.nav.operating}
            activeDescendantExclusions={operatingNavExclusions}
          />
          {canAccessTenantHealth ? (
            <NavLink
              href="/operating/tenant-health"
              icon={<Activity className="h-4 w-4" />}
              label={messages.shell.nav.tenantHealth}
            />
          ) : null}
          {isHelmReserved ? (
            <NavLink
              href="/operating/gtm-leads"
              icon={<Target className="h-4 w-4" />}
              label={messages.shell.nav.gtmLeads}
            />
          ) : null}
          <NavLink
            href="/opportunities"
            icon={<Orbit className="h-4 w-4" />}
            label={messages.shell.nav.opportunities}
          />
          <NavLink
            href="/meetings"
            icon={<CalendarDays className="h-4 w-4" />}
            label={messages.shell.nav.meetings}
          />
          <NavLink
            href="/approvals"
            icon={<CheckSquare className="h-4 w-4" />}
            label={messages.shell.nav.approvals}
          />
          <NavLink
            href="/memory"
            icon={<MemoryStick className="h-4 w-4" />}
            label={messages.shell.nav.memory}
          />
          <NavLink
            href="/reports"
            icon={<ReceiptText className="h-4 w-4" />}
            label={messages.shell.nav.reports}
          />
          <NavLink
            href="/mobile"
            icon={<Smartphone className="h-4 w-4" />}
            label={english ? "Mobile" : "移动端"}
          />

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
