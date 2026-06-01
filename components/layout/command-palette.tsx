"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  CheckSquare,
  Compass,
  FileBarChart2,
  Orbit,
  Plus,
  Search,
  Target,
  Upload,
  UserRoundPlus,
  Users,
} from "lucide-react";
import { useWorkspaceUi } from "@/components/providers/workspace-ui-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatShellAlertText } from "@/components/layout/alert-display-copy";
import {
  buildCustomerAssetHref,
  buildOpportunityAssetHref,
} from "@/features/business-assets/hrefs";
import { buildAskHelmHref } from "@/features/search/ask-helm-entry-routing";
import { formatDateLabel, trimText } from "@/lib/utils";

type QuickCreateData = {
  companies: Array<{ id: string; name: string }>;
  contacts: Array<{ id: string; name: string }>;
  opportunities: Array<{ id: string; title: string }>;
  meetings: Array<{ id: string; title: string; startsAt: Date }>;
};

type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceName: string;
  alerts: Array<{
    id: string;
    type: "approval" | "risk" | "meeting" | "notification";
    title: string;
    body: string;
    url: string;
    createdAt: Date;
  }>;
  quickCreateData: QuickCreateData;
  onQuickCreate: (tab: "opportunity" | "contact" | "meeting") => void;
};

export function CommandPalette({
  open,
  onOpenChange,
  workspaceName,
  alerts,
  quickCreateData,
  onQuickCreate,
}: CommandPaletteProps) {
  const router = useRouter();
  const { locale } = useWorkspaceUi();
  const english = locale === "en-US";
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenChange(!open);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onOpenChange, open]);

  const normalized = query.trim().toLowerCase();
  const rawQuery = query.trim();

  const quickActions = [
    ...(rawQuery
        ? [
          {
            id: "ask-helm-query",
            label: english ? `Ask workspace: ${rawQuery}` : `问当前工作区：${rawQuery}`,
            description: english
              ? "Use the governed, read-only workspace answer path instead of plain object lookup."
              : "走受控只读的工作区问答路径，而不是只做对象搜索。",
            icon: Search,
            run: () => router.push(buildAskHelmHref(rawQuery)),
          },
        ]
      : []),
    {
      id: "dashboard",
      label: english ? "Open today focus" : "查看今日重点",
      description: english ? "Go back to the dashboard and inspect the highest-priority items for today." : "回到首页，看今天最值得推进的事项。",
      icon: Compass,
      run: () => router.push("/dashboard"),
    },
    {
      id: "approvals",
      label: english ? "Open approvals" : "进入审批中心",
      description: english ? "Review external messages and high-risk actions." : "处理外发消息和高风险动作。",
      icon: CheckSquare,
      run: () => router.push("/approvals"),
    },
    {
      id: "create-opportunity",
      label: english ? "Create opportunity" : "新建机会",
      description: english ? "Bring a new lead or project into the operating rhythm." : "把新线索或新项目纳入经营节奏。",
      icon: Target,
      run: () => onQuickCreate("opportunity"),
    },
    {
      id: "create-contact",
      label: english ? "Create contact" : "新建联系人",
      description: english ? "Add a key relationship so follow-up can continue cleanly." : "补齐关键关系人，便于后续跟进。",
      icon: UserRoundPlus,
      run: () => onQuickCreate("contact"),
    },
    {
      id: "create-meeting",
      label: english ? "Create meeting" : "新建会议",
      description: english ? "Schedule a sync and connect pre/post-meeting actions immediately." : "直接安排同步，把会前会后动作接上。",
      icon: CalendarDays,
      run: () => onQuickCreate("meeting"),
    },
    {
      id: "analytics",
      label: english ? "Open analytics" : "查看使用分析",
      description: english ? "Check whether logins, approvals, stage moves and drafts are actually being used." : "看看登录、审批、推进和草稿生成是否真的被用起来。",
      icon: FileBarChart2,
      run: () => router.push("/analytics"),
    },
    {
      id: "reports",
      label: english ? "Open weekly report" : "查看管理者周报",
      description: english ? "Review this week’s momentum and risk with the owner or manager." : "适合和负责人一起看本周推进与风险。",
      icon: CheckSquare,
      run: () => router.push("/reports"),
    },
    {
      id: "imports",
      label: english ? "Import CSV" : "导入 CSV 数据",
      description: english ? "Bring contacts, opportunities and meeting notes into Helm quickly." : "把联系人、机会和会议纪要快速导入进来。",
      icon: Upload,
      run: () => router.push("/imports"),
    },
  ].filter((item) => {
    if (!normalized) return true;
    return `${item.label} ${item.description}`.toLowerCase().includes(normalized);
  });

  const entityResults = useMemo(() => {
    const contactItems = quickCreateData.contacts
      .filter((item) => !normalized || item.name.toLowerCase().includes(normalized))
      .slice(0, 5)
      .map((item) => ({
        id: `contact-${item.id}`,
        title: item.name,
        description: english ? "Contact" : "联系人",
        href: `/contacts/${item.id}`,
        icon: Users,
      }));

    const companyItems = quickCreateData.companies
      .filter((item) => !normalized || item.name.toLowerCase().includes(normalized))
      .slice(0, 4)
      .map((item) => ({
        id: `company-${item.id}`,
        title: item.name,
        description: english ? "Customer asset" : "客户资产",
        href: buildCustomerAssetHref(item.id, "command-palette"),
        icon: Orbit,
      }));

    const opportunityItems = quickCreateData.opportunities
      .filter((item) => !normalized || item.title.toLowerCase().includes(normalized))
      .slice(0, 5)
      .map((item) => ({
        id: `opportunity-${item.id}`,
        title: item.title,
        description: english ? "Opportunity asset" : "机会资产",
        href: buildOpportunityAssetHref(item.id, "command-palette"),
        icon: Target,
      }));

    const meetingItems = quickCreateData.meetings
      .filter((item) => !normalized || item.title.toLowerCase().includes(normalized))
      .slice(0, 4)
      .map((item) => ({
        id: `meeting-${item.id}`,
        title: item.title,
        description: english ? `Meeting · ${formatDateLabel(item.startsAt)}` : `会议 · ${formatDateLabel(item.startsAt)}`,
        href: `/meetings/${item.id}`,
        icon: CalendarDays,
      }));

    return [...contactItems, ...companyItems, ...opportunityItems, ...meetingItems].slice(0, 10);
  }, [english, normalized, quickCreateData.companies, quickCreateData.contacts, quickCreateData.meetings, quickCreateData.opportunities]);

  const highlightAlerts = alerts
    .filter((alert) => !normalized || `${alert.title} ${alert.body}`.toLowerCase().includes(normalized))
    .slice(0, 4);

  const runAndClose = (run: () => void) => {
    onOpenChange(false);
    run();
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) setQuery("");
        onOpenChange(nextOpen);
      }}
    >
      <SheetContent
        className="max-w-[760px] p-0"
        closeLabel={english ? "Close command palette" : "关闭命令面板"}
      >
        <SheetHeader className="border-b border-[color:var(--border)] px-5 py-5 dark:border-white/10">
          <SheetTitle>{english ? "Command palette" : "命令面板"}</SheetTitle>
          <SheetDescription>{english ? "Jump to any object, inspect today’s priorities or trigger key actions from anywhere." : "从任何页面直接跳转对象、查看今日重点，或发起关键动作。"}</SheetDescription>
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <Badge variant="approval">{workspaceName}</Badge>
              <Badge variant="neutral">Cmd/Ctrl + K</Badge>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--muted-foreground)]" />
              <Input
                autoFocus
                className="pl-9"
                placeholder={english ? "Search contacts, companies, opportunities, meetings, or run an action" : "搜索联系人、公司、机会、会议，或直接执行动作"}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          </div>
        </SheetHeader>

        <div className="max-h-[calc(100vh-150px)] space-y-6 overflow-y-auto p-5">
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[color:var(--foreground)]">{english ? "Suggested jumps" : "推荐动作"}</p>
                <p className="text-sm text-[color:var(--muted-foreground)]">{english ? "Put the highest-value destinations first so the next move stays close." : "把今天最关键的动作放在最前面，少绕路就能进入下一步。"}</p>
              </div>
              {!normalized ? (
                <Button size="sm" variant="secondary" onClick={() => runAndClose(() => router.push("/search"))}>
                  <Plus className="h-4 w-4" />
                  {english ? "Open search" : "进入全局搜索"}
                </Button>
              ) : null}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {quickActions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => runAndClose(action.run)}
                  className="rounded-[22px] border border-[color:var(--border)] bg-[color:color-mix(in_oklab,var(--surface)_92%,white_8%)] px-4 py-4 text-left shadow-sm transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)]"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
                      <action.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium text-[color:var(--foreground)]">{action.label}</p>
                      <p className="mt-1 text-sm leading-6 text-[color:var(--muted-foreground)]">{action.description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <div>
              <p className="text-sm font-semibold text-[color:var(--foreground)]">{english ? "Jump straight to objects" : "对象直达"}</p>
              <p className="text-sm text-[color:var(--muted-foreground)]">{english ? "Open the contacts, opportunities and meetings already in motion without extra clicks." : "快速打开正在推进的联系人、机会和会议，少绕一步。"}</p>
            </div>
            {entityResults.length ? (
              <div className="space-y-2">
                {entityResults.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => runAndClose(() => router.push(item.href))}
                    className="flex w-full items-center justify-between gap-3 rounded-2xl border border-[color:var(--border)] bg-[color:color-mix(in_oklab,var(--surface)_92%,white_8%)] px-4 py-3 text-left transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[color:color-mix(in_oklab,var(--surface-subtle)_88%,var(--background)_12%)] text-[color:color-mix(in_oklab,var(--foreground)_72%,transparent)]">
                        <item.icon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-medium text-[color:var(--foreground)]">{item.title}</p>
                        <p className="text-sm text-[color:var(--muted-foreground)]">{item.description}</p>
                      </div>
                    </div>
                    <span className="text-xs font-medium text-[var(--accent)]">{english ? "Open" : "打开"}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="workspace-panel-muted rounded-[22px] border-dashed px-4 py-6">
                <p className="font-medium text-[color:var(--foreground)]">{english ? "No matching object found" : "没有找到匹配对象"}</p>
                <p className="mt-2 text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {english ? "Open global search to see more results, or use quick create to add the missing object." : "可以直接进入全局搜索查看更多结果，或用快速创建补齐这个对象。"}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => runAndClose(() => router.push(`/search?q=${encodeURIComponent(query.trim())}`))}>
                    {english ? "Open global search" : "去全局搜索"}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => runAndClose(() => router.push(`/search?mode=ask&q=${encodeURIComponent(query.trim())}`))}>
                    {english ? "Ask workspace" : "问当前工作区"}
                  </Button>
                </div>
              </div>
            )}
          </section>

          <section className="space-y-3">
            <div>
              <p className="text-sm font-semibold text-[color:var(--foreground)]">{english ? "What deserves attention now" : "当前最值得关注"}</p>
              <p className="text-sm text-[color:var(--muted-foreground)]">{english ? "Put approvals, high-risk items and today’s meetings on one layer so the next review stays clear." : "把待审批、高风险和今日会议放在一层，方便直接进入下一次复核。"}</p>
            </div>
            {highlightAlerts.length ? (
              <div className="space-y-2">
                {highlightAlerts.map((alert) => (
                  <button
                    key={alert.id}
                    type="button"
                    onClick={() => runAndClose(() => router.push(alert.url))}
                    className="w-full rounded-2xl border border-[color:var(--border)] bg-[color:color-mix(in_oklab,var(--surface)_92%,white_8%)] px-4 py-4 text-left transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)]"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={alert.type === "approval" ? "approval" : alert.type === "risk" ? "danger" : "info"}>
                        {alert.type === "approval" ? (english ? "Pending approval" : "待审批") : alert.type === "risk" ? (english ? "High risk" : "高风险") : alert.type === "meeting" ? (english ? "Meeting today" : "今日会议") : (english ? "System alert" : "系统提醒")}
                      </Badge>
                    </div>
                    <p className="mt-3 font-medium text-[color:var(--foreground)]">
                      {formatShellAlertText(alert.title, english)}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[color:var(--muted-foreground)]">{trimText(formatShellAlertText(alert.body, english), 110)}</p>
                  </button>
                ))}
              </div>
            ) : (
              <div className="workspace-panel-muted rounded-[22px] border-dashed px-4 py-6 text-sm leading-6 text-[color:var(--muted-foreground)]">
                {english ? "There is no new alert right now. Go back to the dashboard and keep moving the three most important items for today." : "当前没有新的提醒。你可以回到今日工作台，继续推进今天最重要的三件事。"}
              </div>
            )}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
