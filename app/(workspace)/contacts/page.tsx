import Link from "next/link";
import { ArrowRight, Building2, Search, Users2 } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentWorkspace, requireCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatRoleDetailDisplayText } from "@/lib/presentation/role-detail-display-copy";
import { getWorkspaceStory } from "@/lib/presentation/workspace-story";
import {
  getDeploymentProfileDefaultLocaleCandidate,
  getRequestUiLocaleCandidate,
} from "@/lib/i18n/request-locale.server";
import { formatLocalizedDateLabel } from "@/lib/i18n/date-labels";
import { trimText } from "@/lib/utils";
import { normalizeWorkspaceUiConfig } from "@/lib/workspace-ops";

export default async function ContactsPage() {
  const workspace = await getCurrentWorkspace();
  await requireCurrentUser();
  const requestLocale = await getRequestUiLocaleCandidate();
  const uiConfig = normalizeWorkspaceUiConfig({
    ...workspace,
    requestLocale,
    deploymentProfileDefaultLocale: getDeploymentProfileDefaultLocaleCandidate(),
  });
  const english = uiConfig.locale === "en-US";
  const pageStory = getWorkspaceStory("contacts", uiConfig.locale, uiConfig.demoMode);
  const contacts = await db.contact.findMany({
    where: {
      workspaceId: workspace.id,
      archivedAt: null,
    },
    include: {
      company: true,
      opportunities: {
        where: {
          stage: {
            notIn: ["DONE", "LOST"],
          },
        },
        orderBy: { updatedAt: "desc" },
        take: 3,
      },
      owner: true,
    },
    orderBy: [{ lastInteractionAt: "desc" }, { updatedAt: "desc" }],
    take: 24,
  });
  const total = await db.contact.count({
    where: { workspaceId: workspace.id, archivedAt: null },
  });
  const withCompany = contacts.filter((contact) => contact.company).length;
  const withOpenOpportunity = contacts.filter(
    (contact) => contact.opportunities.length > 0,
  ).length;
  const staleThreshold = new Date();
  staleThreshold.setDate(staleThreshold.getDate() - 30);
  const needsAttention = contacts.filter(
    (contact) =>
      !contact.lastInteractionAt ||
      contact.lastInteractionAt.getTime() < staleThreshold.getTime(),
  ).length;
  const displayText = (value: string | null | undefined) =>
    formatRoleDetailDisplayText(value, english);

  return (
    <div className="space-y-6" data-source-page="/contacts">
      <PageHeader
        eyebrow={pageStory.eyebrow}
        title={
          english
            ? "Which person you should ping today — and what to say"
            : "今天该联系谁，第一句怎么说"
        }
        description={pageStory.description}
        actions={
          <>
            <Button variant="secondary" asChild>
              <Link href="/search">
                <Search className="h-4 w-4" />
                {english ? "Search objects" : "搜索对象"}
              </Link>
            </Button>
            <Button asChild>
              <Link href="/opportunities">
                {english ? "Open opportunities" : "打开机会面"}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={english ? "Customer contacts" : "客户联系人"}
          value={total}
          detail={english ? "People available to contact" : "可直接进入触达"}
        />
        <StatCard
          label={english ? "With company" : "已关联公司"}
          value={withCompany}
          detail={english ? "Loaded in this view" : "当前列表内"}
        />
        <StatCard
          label={english ? "With open opportunity" : "关联活跃机会"}
          value={withOpenOpportunity}
          detail={english ? "Revenue motion is already attached" : "已有收入推进线"}
        />
        <StatCard
          label={english ? "Needs relationship review" : "需关系复核"}
          value={needsAttention}
          detail={english ? "No recent interaction signal" : "近期互动信号不足"}
        />
      </div>

      <Card className="workspace-panel-muted">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users2 className="h-4 w-4 text-[var(--accent)]" />
            <CardTitle>
              {english ? "Relationship directory" : "联系人目录"}
            </CardTitle>
          </div>
          <CardDescription>
            {english
              ? "Sorted by who's gone cold longest, who's mid-deal, and who you owe a reply. Click in for a draftable opener."
              : "按「沉默最久 / 单子在跑 / 欠回复」排序。点进去就能拿到能直接发的开场话术草稿。"}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-2">
          {contacts.length ? (
            contacts.map((contact) => (
              <Link
                key={contact.id}
                href={`/contacts/${contact.id}`}
                aria-label={
                  english
                    ? `Open contact: ${contact.name}`
                    : `查看联系人：${contact.name}`
                }
                className="workspace-panel block rounded-2xl px-4 py-4 transition hover:border-[color:var(--border-strong)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-[color:var(--foreground)]">
                      {contact.name}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-[color:var(--muted)]">
                      {trimText(
                        [
                          displayText(contact.title),
                          contact.company?.name,
                          contact.owner?.name,
                        ]
                          .filter(Boolean)
                          .join(" · ") ||
                          (english
                            ? "No company or owner attached yet"
                            : "尚未关联公司或负责人"),
                        92,
                      )}
                    </p>
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-[color:var(--muted-foreground)]" />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge variant="info">
                    {contact.company
                      ? english
                        ? "Company linked"
                        : "已关联公司"
                      : english
                        ? "Company missing"
                        : "未关联公司"}
                  </Badge>
                  <Badge variant={contact.opportunities.length ? "success" : "neutral"}>
                    {english
                      ? `${contact.opportunities.length} open opportunities`
                      : `${contact.opportunities.length} 条活跃机会`}
                  </Badge>
                </div>
                <p className="mt-3 text-xs text-[color:var(--muted-foreground)]">
                  {contact.lastInteractionAt
                    ? english
                      ? `Last interaction ${formatLocalizedDateLabel(contact.lastInteractionAt, true)}`
                      : `最近互动 ${formatLocalizedDateLabel(contact.lastInteractionAt, false)}`
                    : english
                      ? "No recent interaction recorded"
                      : "暂无近期互动记录"}
                </p>
              </Link>
            ))
          ) : (
            <EmptyState
              title={english ? "No contacts yet" : "还没有联系人"}
              description={
                english
                  ? "Import CRM data or capture a meeting first, then this page becomes the relationship entry surface."
                  : "先接入联系人、公司或会议记录，这里会变成关系推进入口。"
              }
            />
          )}
        </CardContent>
      </Card>

      <Card className="workspace-panel-muted">
        <CardContent className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[color:var(--foreground)]">
              {english ? "Next relationship action" : "下一步处理关系"}
            </p>
            <p className="mt-1 text-sm leading-6 text-[color:var(--muted)]">
              {english
                ? "Use this page to pick who needs a touch today, then open the account or opportunity for the actual decision."
                : "先挑出今天该联系的人，再进入客户或机会页面处理真实判断。"}
            </p>
          </div>
          <Button variant="secondary" asChild>
            <Link href="/imports/crm">
              <Building2 className="h-4 w-4" />
              {english ? "Connect CRM data" : "连接客户关系系统数据"}
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
