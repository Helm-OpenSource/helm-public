"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  BriefcaseBusiness,
  Bell,
  CalendarDays,
  CalendarPlus,
  Command,
  Compass,
  Inbox,
  LogOut,
  Menu,
  Plus,
  Rocket,
  Search,
  Smartphone,
  Target,
  UserPlus,
} from "lucide-react";
import { useWorkspaceUi } from "@/components/providers/workspace-ui-provider";
import { LocaleSwitcher } from "@/components/shared/locale-switcher";
import { toast } from "sonner";
import { CommandPalette } from "@/components/layout/command-palette";
import { formatShellAlertText } from "@/components/layout/alert-display-copy";
import { LiveRefreshStatus } from "@/components/shared/live-refresh-status";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { getDemoModeProfile } from "@/lib/demo/demo-modes";
import {
  getLocalizedOpportunityTypeLabels,
  getLocalizedRoleLabels,
} from "@/lib/i18n/labels";
import { StartRecordingButton } from "@/features/conversation-capture/start-recording-button";
import { logoutAction } from "@/features/auth/actions";
import { buildOpportunityAssetHref } from "@/features/business-assets/hrefs";
import {
  markNotificationReadAction,
  quickCreateContactAction,
  quickCreateMeetingAction,
} from "@/features/workspace/actions";
import { saveOpportunityAction } from "@/features/opportunities/actions";
import { buildSearchIntentHref } from "@/features/search/ask-helm-entry-routing";

type TopbarProps = {
  workspaceName: string;
  /** 租户品牌行覆盖;null → messages.shell.brand。 */
  brandLabel?: string | null;
  userName: string;
  roleLabel: string;
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
};

type OpportunityFormState = {
  title: string;
  type: "CLIENT" | "RECRUITING" | "PARTNERSHIP" | "INTERNAL";
  companyId: string;
  ownerId: string;
  nextAction: string;
  dueDate: string;
};

type ContactFormState = {
  name: string;
  title: string;
  email: string;
  companyId: string;
  ownerId: string;
};

type MeetingFormState = {
  title: string;
  agenda: string;
  startsAt: string;
  companyId: string;
  opportunityId: string;
  contactId: string;
  ownerId: string;
};

export function Topbar({
  workspaceName,
  brandLabel = null,
  userName,
  roleLabel,
  notificationCount,
  alerts,
  quickCreateData,
}: TopbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const {
    locale,
    messages,
    featureFlags,
    demoMode,
    canAccessTenantHealth,
    isHelmReserved,
  } = useWorkspaceUi();
  const english = locale === "en-US";
  const demoProfile = demoMode ? getDemoModeProfile(demoMode, locale) : null;
  const opportunityTypeLabels = getLocalizedOpportunityTypeLabels(locale);
  const roleLabels = getLocalizedRoleLabels(locale);
  const [pending, startTransition] = useTransition();
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [quickCreateTab, setQuickCreateTab] = useState<
    "opportunity" | "contact" | "meeting"
  >("opportunity");
  const [commandOpen, setCommandOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [topbarSearchQuery, setTopbarSearchQuery] = useState("");
  const [loggingOut, startLogoutTransition] = useTransition();
  const [opportunityForm, setOpportunityForm] = useState<OpportunityFormState>({
    title: "",
    type: "CLIENT",
    companyId: "",
    ownerId: quickCreateData.memberships[0]?.user.id ?? "",
    nextAction: "",
    dueDate: "",
  });
  const [contactForm, setContactForm] = useState<ContactFormState>({
    name: "",
    title: "",
    email: "",
    companyId: "",
    ownerId: quickCreateData.memberships[0]?.user.id ?? "",
  });
  const [meetingForm, setMeetingForm] = useState<MeetingFormState>({
    title: "",
    agenda: "",
    startsAt: "",
    companyId: "",
    opportunityId: "",
    contactId: "",
    ownerId: quickCreateData.memberships[0]?.user.id ?? "",
  });

  const handleAlertClick = (alert: TopbarProps["alerts"][number]) => {
    startTransition(async () => {
      if (
        alert.type === "notification" &&
        alert.id.startsWith("notification-")
      ) {
        const notificationId = alert.id.replace("notification-", "");
        await markNotificationReadAction(notificationId);
      }
      setNotificationOpen(false);
      router.push(alert.url);
      router.refresh();
    });
  };

  const submitTopbarSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    router.push(buildSearchIntentHref(topbarSearchQuery));
  };

  const submitOpportunity = () => {
    startTransition(async () => {
      const result = await saveOpportunityAction({
        title: opportunityForm.title,
        type: opportunityForm.type,
        stage: "NEW",
        riskLevel: "MEDIUM",
        nextAction:
          opportunityForm.nextAction ||
          (english ? "Confirm the first operating move" : "确认首轮推进动作"),
        dueDate: opportunityForm.dueDate,
        companyId: opportunityForm.companyId,
        ownerId: opportunityForm.ownerId,
        lossReason: "",
      });

      if (!result.ok || !result.id) {
        toast.error(
          result.error ??
            (english ? "Failed to create opportunity" : "机会创建失败"),
        );
        return;
      }

      toast.success(english ? "Opportunity created" : "已创建机会");
      setQuickCreateOpen(false);
      setOpportunityForm({
        title: "",
        type: "CLIENT",
        companyId: "",
        ownerId: quickCreateData.memberships[0]?.user.id ?? "",
        nextAction: "",
        dueDate: "",
      });
      router.push(buildOpportunityAssetHref(result.id, "quick-create"));
      router.refresh();
    });
  };

  const submitContact = () => {
    startTransition(async () => {
      const result = await quickCreateContactAction(contactForm);
      if (!result.ok || !result.contactId) {
        toast.error(
          result.error ??
            (english ? "Failed to create contact" : "联系人创建失败"),
        );
        return;
      }

      toast.success(english ? "Contact created" : "已创建联系人");
      setQuickCreateOpen(false);
      setContactForm({
        name: "",
        title: "",
        email: "",
        companyId: "",
        ownerId: quickCreateData.memberships[0]?.user.id ?? "",
      });
      router.push(`/contacts/${result.contactId}`);
      router.refresh();
    });
  };

  const submitMeeting = () => {
    startTransition(async () => {
      const result = await quickCreateMeetingAction(meetingForm);
      if (!result.ok || !result.meetingId) {
        toast.error(
          result.error ??
            (english ? "Failed to create meeting" : "会议创建失败"),
        );
        return;
      }

      toast.success(english ? "Meeting created" : "已创建会议");
      setQuickCreateOpen(false);
      setMeetingForm({
        title: "",
        agenda: "",
        startsAt: "",
        companyId: "",
        opportunityId: "",
        contactId: "",
        ownerId: quickCreateData.memberships[0]?.user.id ?? "",
      });
      router.push(`/meetings/${result.meetingId}`);
      router.refresh();
    });
  };

  const openQuickCreate = (tab: "opportunity" | "contact" | "meeting") => {
    setQuickCreateTab(tab);
    setCommandOpen(false);
    setQuickCreateOpen(true);
  };

  const handleLogout = () => {
    startLogoutTransition(async () => {
      const result = await logoutAction();
      if (!result.ok) {
        toast.error(
          english
            ? "Failed to sign out. Please try again."
            : "退出失败，请稍后再试。",
        );
        return;
      }

      toast.success(
        english
          ? "Signed out. You can now sign in again or start a trial."
          : "已退出。现在可以重新登录，或开始新的试用。",
      );
      setMobileNavOpen(false);
      // Force a full document navigation after logout to avoid intermittent
      // app-router manifest misses on the public login route during e2e/start.
      window.location.replace("/login");
    });
  };

  const alertGroups = [
    {
      key: "approval",
      title: english ? "Needs approval" : "待审批",
      description: english
        ? "These actions affect external communication or high-risk objects directly."
        : "这些动作会直接影响对外沟通或高风险对象。",
    },
    {
      key: "risk",
      title: english ? "High-risk opportunities" : "高风险机会",
      description: english
        ? "Close red items first before the operating rhythm slips further."
        : "优先收口红色项目，避免节奏继续走弱。",
    },
    {
      key: "meeting",
      title: english ? "Today's meetings" : "今日会议",
      description: english
        ? "Briefings are ready, so you can jump straight into the meeting page."
        : "会前简报已准备好，可以直接进入会议页。",
    },
    {
      key: "notification",
      title: english ? "System alerts" : "系统提醒",
      description: english
        ? "Includes policy changes, budget signals and workspace notifications."
        : "包括策略变化、预算提醒和工作区通知。",
    },
  ] as const;

  const primaryNavSections = [
    {
      key: "today",
      label: english ? "What needs attention" : "今天要处理",
      items: [
        {
          href: "/dashboard",
          label: messages.shell.nav.dashboard,
          icon: <Target className="h-4 w-4" />,
        },
        {
          href: "/operating",
          label: messages.shell.nav.operating,
          icon: <BriefcaseBusiness className="h-4 w-4" />,
        },
      ],
    },
    {
      key: "customer-work",
      label: english ? "Customer assets" : "客户资产",
      items: [
        ...(isHelmReserved
          ? [
              {
                href: "/operating/gtm-leads",
                label: messages.shell.nav.gtmLeads,
                icon: <Target className="h-4 w-4" />,
              },
            ]
          : []),
        {
          href: "/opportunities",
          label: messages.shell.nav.opportunities,
          icon: <Compass className="h-4 w-4" />,
        },
        {
          href: "/meetings",
          label: messages.shell.nav.meetings,
          icon: <CalendarDays className="h-4 w-4" />,
        },
        {
          href: "/inbox",
          label: messages.shell.nav.inbox,
          icon: <Inbox className="h-4 w-4" />,
        },
        ...(canAccessTenantHealth
          ? [
              {
                href: "/operating/tenant-health",
                label: messages.shell.nav.tenantHealth,
                icon: <Activity className="h-4 w-4" />,
              },
            ]
          : []),
      ],
    },
    {
      key: "review-memory",
      label: english ? "Review and records" : "复核与记录",
      items: [
        {
          href: "/approvals",
          label: messages.shell.nav.approvals,
          icon: <Bell className="h-4 w-4" />,
        },
        {
          href: "/memory",
          label: messages.shell.nav.memory,
          icon: <Command className="h-4 w-4" />,
        },
        {
          href: "/reports",
          label: messages.shell.nav.reports,
          icon: <Rocket className="h-4 w-4" />,
        },
        {
          href: "/mobile",
          label: messages.shell.nav.mobile,
          icon: <Smartphone className="h-4 w-4" />,
        },
      ],
    },
  ];
  const settingsNavItems = [
    { href: "/settings", label: messages.shell.nav.settings },
    { href: "/imports", label: messages.shell.nav.imports },
    { href: "/capture", label: messages.shell.nav.capture },
    { href: "/analytics", label: messages.shell.nav.analytics },
    ...(featureFlags.diagnosticsCenter
      ? [{ href: "/diagnostics", label: messages.shell.nav.diagnostics }]
      : []),
  ];
  const compactMobileSurface = pathname === "/mobile";

  return (
    <>
      <div
        className={`sticky top-0 z-20 min-w-0 max-w-full px-4 pt-4 backdrop-blur lg:px-8 ${
          compactMobileSurface ? "hidden md:block" : ""
        }`}
      >
        <div className="workspace-shell-panel flex min-w-0 max-w-full flex-col gap-3 rounded-[30px] border px-4 py-3 xl:flex-row xl:items-center xl:justify-between xl:gap-4">
          <div className="flex min-w-0 w-full items-center gap-3 xl:flex-1">
            <Button
              size="icon"
              variant="secondary"
              className="lg:hidden"
              aria-label={
                english ? "Open workspace navigation" : "打开工作区导航"
              }
              title={english ? "Open workspace navigation" : "打开工作区导航"}
              onClick={() => setMobileNavOpen(true)}
            >
              <Menu className="h-4 w-4" />
            </Button>

            <form
              onSubmit={submitTopbarSearch}
              className="relative hidden min-w-0 flex-1 md:block xl:max-w-[640px]"
            >
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--muted-foreground)]" />
              <Input
                className="pl-9"
                name="q"
                placeholder={messages.shell.searchPlaceholder}
                value={topbarSearchQuery}
                onChange={(event) => setTopbarSearchQuery(event.target.value)}
              />
            </form>
          </div>

          <div className="relative z-10 flex min-w-0 w-full shrink-0 flex-wrap items-center justify-end gap-2 md:gap-2.5 xl:ml-auto xl:w-auto xl:flex-none xl:flex-nowrap">
            <Button
              asChild
              size="icon"
              variant="secondary"
              className="md:hidden"
            >
              <Link
                href="/search"
                aria-label={english ? "Open global search" : "打开全局搜索"}
                title={english ? "Open global search" : "打开全局搜索"}
              >
                <Search className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="icon"
              variant="default"
              className="md:hidden"
            >
              <Link
                href="/mobile"
                aria-label={messages.shell.nav.mobile}
                title={english ? "Open mobile work surface" : "打开移动工作入口"}
              >
                <Smartphone className="h-4 w-4" />
              </Link>
            </Button>
            {demoProfile ? (
              <Button
                asChild
                size="icon"
                variant="ghost"
                className="hidden text-[color:var(--mode-link)] hover:text-[color:var(--mode-link)] 2xl:inline-flex"
                aria-label={messages.shell.demoEntry}
                title={`${messages.shell.demoEntry} · ${messages.shell.trialSignup}`}
              >
                <Link href="/demo">
                  <Compass className="h-4 w-4" />
                </Link>
              </Button>
            ) : null}
            <Button
              size="icon"
              variant="secondary"
              className="hidden 2xl:inline-flex"
              aria-label={`${messages.shell.commandPalette} (⌘K)`}
              title={`${messages.shell.commandPalette} · ⌘K`}
              onClick={() => setCommandOpen(true)}
            >
              <Command className="h-4 w-4" />
            </Button>
            <LiveRefreshStatus />
            <LocaleSwitcher iconOnly className="hidden lg:block" />
            <StartRecordingButton
              variant="default"
              size="icon"
              className="theme-primary-action shadow-sm"
              labelClassName="hidden"
              title={messages.capture.start}
              ariaLabel={messages.capture.start}
            />
            <Button
              size="icon"
              variant="secondary"
              aria-label={messages.shell.quickCreate}
              title={messages.shell.quickCreate}
              onClick={() => openQuickCreate("opportunity")}
            >
              <Plus className="h-4 w-4" />
            </Button>
            <ThemeToggle locale={locale} />
            <Button
              size="icon"
              variant="secondary"
              className="relative"
              aria-label={messages.shell.notifications}
              title={messages.shell.notifications}
              onClick={() => setNotificationOpen(true)}
            >
              <Bell className="h-4 w-4" />
              {notificationCount > 0 ? (
                <Badge className="pointer-events-none absolute right-0.5 top-0.5 h-5 min-w-5 justify-center rounded-full bg-[color:var(--accent-danger)] px-1 text-[10px] leading-none text-white">
                  {notificationCount}
                </Badge>
              ) : null}
            </Button>
            <div
              className="workspace-panel-muted flex shrink-0 items-center gap-2.5 rounded-[22px] px-2.5 py-1.5"
              title={
                demoProfile
                  ? `${workspaceName} · ${demoProfile.accountRoleLabel}`
                  : `${workspaceName} · ${messages.shell.workspaceTagline}`
              }
            >
              <Avatar className="h-9 w-9">
                <AvatarFallback name={userName} />
              </Avatar>
              <div className="hidden min-w-0 leading-tight md:block">
                <p className="truncate whitespace-nowrap text-sm font-semibold text-[color:var(--foreground)]">
                  {userName}
                </p>
                <p className="truncate whitespace-nowrap text-[11px] text-[color:var(--muted-foreground)]">
                  {workspaceName} · {roleLabel}
                </p>
              </div>
            </div>
            <Button
              size="icon"
              variant="secondary"
              aria-label={english ? "Sign out" : "退出"}
              title={english ? "Sign out" : "退出"}
              onClick={handleLogout}
              disabled={loggingOut}
              data-testid="global-logout"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <Sheet open={notificationOpen} onOpenChange={setNotificationOpen}>
        <SheetContent
          className="max-w-[420px]"
          closeLabel={english ? "Close notification center" : "关闭通知中心"}
        >
          <SheetHeader>
            <SheetTitle>
              {english ? "Notification center" : "通知中心"}
            </SheetTitle>
            <SheetDescription>
              {english
                ? "Review approval pressure, risk signals and policy changes without leaving the current workspace."
                : "在不离开当前工作区的情况下查看审批压力、风险信号和策略变化。"}
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-3 p-5">
            {alerts.length ? (
              alertGroups.map((group) => {
                const groupAlerts = alerts.filter(
                  (alert) => alert.type === group.key,
                );

                if (!groupAlerts.length) return null;

                return (
                  <section key={group.key} className="space-y-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            group.key === "approval"
                              ? "approval"
                              : group.key === "risk"
                                ? "danger"
                                : "info"
                          }
                        >
                          {group.title}
                        </Badge>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-[color:var(--muted-foreground)]">
                        {group.description}
                      </p>
                    </div>
                    {groupAlerts.map((alert) => (
                      <button
                        key={alert.id}
                        type="button"
                        onClick={() => handleAlertClick(alert)}
                        className="w-full rounded-2xl border border-[color:var(--border)] px-4 py-4 text-left transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)]"
                      >
                        <p className="font-medium text-[color:var(--foreground)]">
                          {formatShellAlertText(alert.title, english)}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-[color:var(--muted-foreground)]">
                          {formatShellAlertText(alert.body, english)}
                        </p>
                      </button>
                    ))}
                  </section>
                );
              })
            ) : (
              <div className="theme-surface-panel-dashed rounded-2xl px-4 py-8 text-center text-sm text-[color:var(--muted-foreground)]">
                {english
                  ? "No new alerts right now. Approvals, risk signals and policy changes will collect here."
                  : "当前没有新的提醒。待审批、高风险和策略变化会汇总到这里。"}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={quickCreateOpen} onOpenChange={setQuickCreateOpen}>
        <SheetContent
          className="max-w-[560px]"
          closeLabel={english ? "Close quick create" : "关闭快速创建"}
        >
          <SheetHeader>
            <SheetTitle>
              {english ? "Global quick create" : "全局快速创建"}
            </SheetTitle>
            <SheetDescription>
              {english
                ? "Create opportunities, contacts and meetings from any page so the next move lands in the system immediately."
                : "从任何页面直接补齐机会、联系人和会议，把下一步动作放进系统。"}
            </SheetDescription>
          </SheetHeader>
          <Tabs
            value={quickCreateTab}
            onValueChange={(value) =>
              setQuickCreateTab(value as typeof quickCreateTab)
            }
            className="p-5"
          >
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="opportunity">
                {english ? "Opportunity" : "新建机会"}
              </TabsTrigger>
              <TabsTrigger value="contact">
                {english ? "Contact" : "新建联系人"}
              </TabsTrigger>
              <TabsTrigger value="meeting">
                {english ? "Meeting" : "新建会议"}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="opportunity" className="space-y-4 pt-4">
              <Input
                value={opportunityForm.title}
                onChange={(event) =>
                  setOpportunityForm((state) => ({
                    ...state,
                    title: event.target.value,
                  }))
                }
                placeholder={english ? "Opportunity title" : "机会标题"}
              />
              <div className="grid gap-4 md:grid-cols-2">
                <Select
                  value={opportunityForm.type}
                  onValueChange={(value) =>
                    setOpportunityForm((state) => ({
                      ...state,
                      type: value as OpportunityFormState["type"],
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={english ? "Opportunity type" : "机会类型"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(opportunityTypeLabels).map(
                      ([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
                <Select
                  value={opportunityForm.ownerId}
                  onValueChange={(value) =>
                    setOpportunityForm((state) => ({
                      ...state,
                      ownerId: value,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={english ? "Owner" : "负责人"} />
                  </SelectTrigger>
                  <SelectContent>
                    {quickCreateData.memberships.map((membership) => (
                      <SelectItem
                        key={membership.user.id}
                        value={membership.user.id}
                      >
                        {membership.user.name} ·{" "}
                        {roleLabels[membership.role as keyof typeof roleLabels]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Select
                value={opportunityForm.companyId || "__none__"}
                onValueChange={(value) =>
                  setOpportunityForm((state) => ({
                    ...state,
                    companyId: value === "__none__" ? "" : value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={english ? "Linked company" : "关联公司"}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">
                    {english ? "No company yet" : "暂不关联公司"}
                  </SelectItem>
                  {quickCreateData.companies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Textarea
                value={opportunityForm.nextAction}
                onChange={(event) =>
                  setOpportunityForm((state) => ({
                    ...state,
                    nextAction: event.target.value,
                  }))
                }
                placeholder={english ? "Next step" : "下一步动作"}
              />
              <Input
                type="datetime-local"
                value={opportunityForm.dueDate}
                onChange={(event) =>
                  setOpportunityForm((state) => ({
                    ...state,
                    dueDate: event.target.value,
                  }))
                }
              />
              <Button
                className="w-full"
                disabled={pending}
                onClick={submitOpportunity}
              >
                <Target className="h-4 w-4" />
                {english ? "Create and open opportunity" : "创建并进入机会详情"}
              </Button>
            </TabsContent>

            <TabsContent value="contact" className="space-y-4 pt-4">
              <Input
                value={contactForm.name}
                onChange={(event) =>
                  setContactForm((state) => ({
                    ...state,
                    name: event.target.value,
                  }))
                }
                placeholder={english ? "Contact name" : "联系人姓名"}
              />
              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  value={contactForm.title}
                  onChange={(event) =>
                    setContactForm((state) => ({
                      ...state,
                      title: event.target.value,
                    }))
                  }
                  placeholder={english ? "Title" : "职位"}
                />
                <Input
                  value={contactForm.email}
                  onChange={(event) =>
                    setContactForm((state) => ({
                      ...state,
                      email: event.target.value,
                    }))
                  }
                  placeholder={english ? "Email" : "邮箱"}
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Select
                  value={contactForm.companyId || "__none__"}
                  onValueChange={(value) =>
                    setContactForm((state) => ({
                      ...state,
                      companyId: value === "__none__" ? "" : value,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={english ? "Linked company" : "关联公司"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">
                      {english ? "Independent contact" : "独立联系人"}
                    </SelectItem>
                    {quickCreateData.companies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={contactForm.ownerId}
                  onValueChange={(value) =>
                    setContactForm((state) => ({ ...state, ownerId: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={english ? "Owner" : "负责人"} />
                  </SelectTrigger>
                  <SelectContent>
                    {quickCreateData.memberships.map((membership) => (
                      <SelectItem
                        key={membership.user.id}
                        value={membership.user.id}
                      >
                        {membership.user.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="w-full"
                disabled={pending}
                onClick={submitContact}
              >
                <UserPlus className="h-4 w-4" />
                {english ? "Create and open contact" : "创建并进入联系人档案"}
              </Button>
            </TabsContent>

            <TabsContent value="meeting" className="space-y-4 pt-4">
              <Input
                value={meetingForm.title}
                onChange={(event) =>
                  setMeetingForm((state) => ({
                    ...state,
                    title: event.target.value,
                  }))
                }
                placeholder={english ? "Meeting title" : "会议标题"}
              />
              <Textarea
                value={meetingForm.agenda}
                onChange={(event) =>
                  setMeetingForm((state) => ({
                    ...state,
                    agenda: event.target.value,
                  }))
                }
                placeholder={english ? "Goal / agenda" : "会议目标 / 议程"}
              />
              <Input
                type="datetime-local"
                value={meetingForm.startsAt}
                onChange={(event) =>
                  setMeetingForm((state) => ({
                    ...state,
                    startsAt: event.target.value,
                  }))
                }
              />
              <div className="grid gap-4 md:grid-cols-2">
                <Select
                  value={meetingForm.companyId || "__none__"}
                  onValueChange={(value) =>
                    setMeetingForm((state) => ({
                      ...state,
                      companyId: value === "__none__" ? "" : value,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={english ? "Linked company" : "关联公司"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">
                      {english ? "No company yet" : "暂不关联公司"}
                    </SelectItem>
                    {quickCreateData.companies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={meetingForm.opportunityId || "__none__"}
                  onValueChange={(value) =>
                    setMeetingForm((state) => ({
                      ...state,
                      opportunityId: value === "__none__" ? "" : value,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={english ? "Linked opportunity" : "关联机会"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">
                      {english ? "No opportunity yet" : "暂不关联机会"}
                    </SelectItem>
                    {quickCreateData.opportunities.map((opportunity) => (
                      <SelectItem key={opportunity.id} value={opportunity.id}>
                        {opportunity.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Select
                  value={meetingForm.contactId || "__none__"}
                  onValueChange={(value) =>
                    setMeetingForm((state) => ({
                      ...state,
                      contactId: value === "__none__" ? "" : value,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={english ? "Linked contact" : "关联联系人"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">
                      {english ? "No contact yet" : "暂不关联联系人"}
                    </SelectItem>
                    {quickCreateData.contacts.map((contact) => (
                      <SelectItem key={contact.id} value={contact.id}>
                        {contact.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={meetingForm.ownerId}
                  onValueChange={(value) =>
                    setMeetingForm((state) => ({ ...state, ownerId: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={english ? "Owner" : "负责人"} />
                  </SelectTrigger>
                  <SelectContent>
                    {quickCreateData.memberships.map((membership) => (
                      <SelectItem
                        key={membership.user.id}
                        value={membership.user.id}
                      >
                        {membership.user.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="w-full"
                disabled={pending}
                onClick={submitMeeting}
              >
                <CalendarPlus className="h-4 w-4" />
                {english ? "Create and open meeting" : "创建并生成会议入口"}
              </Button>
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent
          className="max-w-[320px]"
          closeLabel={english ? "Close navigation" : "关闭导航"}
        >
          <SheetHeader>
            <SheetTitle>{brandLabel ?? messages.shell.brand}</SheetTitle>
            <SheetDescription>
              {english
                ? "Navigate today, customer work, reviews, memory and the workspace foundation."
                : "进入今天要处理的事、客户资产、复核记录和工作区设置。"}
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-3 p-5">
            <div className="demo-shell-panel rounded-2xl border border-[color:var(--mode-card-border)] p-4 text-[color:var(--accent-foreground)]">
              <p className="text-sm font-semibold">{workspaceName}</p>
              <p className="mt-1 text-sm text-white/70">
                {messages.shell.shellHeadline}
              </p>
            </div>
            <div className="space-y-2">
              {primaryNavSections.map((section) => (
                <div key={section.key} className="space-y-2">
                  <p className="px-1 text-xs font-medium text-[color:var(--muted-foreground)]">
                    {section.label}
                  </p>
                  {section.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="flex items-center gap-3 rounded-2xl border border-[color:var(--border)] px-4 py-3 text-sm font-medium text-[color:var(--foreground)] transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)]"
                      onClick={() => setMobileNavOpen(false)}
                    >
                      {item.icon}
                      {item.label}
                    </Link>
                  ))}
                </div>
              ))}
            </div>
            <div className="workspace-panel-muted space-y-2 rounded-2xl p-3">
              <div className="space-y-1 px-1">
                <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                  {messages.shell.nav.settings}
                </p>
                <p className="text-sm text-[color:var(--muted-foreground)]">
                  {english
                    ? "Data sources, field notes, outcome change and readiness checks stay here as the foundation."
                    : "数据接入、现场记录、效果变化和就绪检查统一留在基础层。"}
                </p>
              </div>
              {settingsNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block rounded-2xl border border-[color:var(--border)] bg-[color:color-mix(in_oklab,var(--surface)_92%,white_8%)] px-4 py-3 text-sm font-medium text-[color:var(--foreground)] transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)]"
                  onClick={() => setMobileNavOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
            </div>
            <div className="workspace-panel-muted rounded-2xl px-4 py-4">
              <p className="font-medium text-[color:var(--foreground)]">{userName}</p>
              <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">{roleLabel}</p>
              <p className="mt-3 text-sm text-[color:var(--muted-foreground)]">
                {messages.shell.mobileCurrentActions}
                {english ? ": " : "："}
                {notificationCount}
              </p>
              <Button
                variant="secondary"
                className="mt-4 w-full"
                onClick={handleLogout}
                disabled={loggingOut}
                data-testid="mobile-global-logout"
              >
                <LogOut className="h-4 w-4" />
                {loggingOut
                  ? english
                    ? "Signing out..."
                    : "退出中..."
                  : english
                    ? "Sign out of this workspace"
                    : "退出当前工作区"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <CommandPalette
        open={commandOpen}
        onOpenChange={setCommandOpen}
        workspaceName={workspaceName}
        alerts={alerts}
        quickCreateData={quickCreateData}
        onQuickCreate={openQuickCreate}
      />
    </>
  );
}
