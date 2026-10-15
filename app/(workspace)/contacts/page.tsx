import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { ArrowRight, Building2, Search, Users2 } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
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
  const activeContactWhere: Prisma.ContactWhereInput = {
    workspaceId: workspace.id,
    archivedAt: null,
  };
  const openOpportunityWhere: Prisma.OpportunityWhereInput = {
    stage: { notIn: ["DONE", "LOST"] },
  };
  const staleThreshold = new Date();
  staleThreshold.setDate(staleThreshold.getDate() - 30);
  const [contacts, total, withCompany, withOpenOpportunity, needsAttention] =
    await Promise.all([
      db.contact.findMany({
        where: activeContactWhere,
        include: {
          company: true,
          owner: true,
          _count: {
            select: {
              opportunities: { where: openOpportunityWhere },
            },
          },
        },
        orderBy: [{ lastInteractionAt: "desc" }, { updatedAt: "desc" }],
        take: 24,
      }),
      db.contact.count({ where: activeContactWhere }),
      db.contact.count({
        where: { ...activeContactWhere, companyId: { not: null } },
      }),
      db.contact.count({
        where: {
          ...activeContactWhere,
          opportunities: { some: openOpportunityWhere },
        },
      }),
      db.contact.count({
        where: {
          ...activeContactWhere,
          OR: [
            { lastInteractionAt: null },
            { lastInteractionAt: { lt: staleThreshold } },
          ],
        },
      }),
    ]);
  const displayText = (value: string | null | undefined) =>
    formatRoleDetailDisplayText(value, english);

  return (
    <div className="space-y-6" data-source-page="/contacts">
      <PageHeader
        eyebrow={pageStory.eyebrow}
        title={english ? "Contacts" : "联系人"}
        actions={
          <>
            <Button variant="secondary" asChild>
              <Link href="/search">
                <Search className="h-4 w-4" />
                {english ? "Search objects" : "搜索对象"}
              </Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link href="/imports/crm">
                <Building2 className="h-4 w-4" />
                {english ? "Connect CRM data" : "连接客户关系系统数据"}
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
        />
        <StatCard
          label={english ? "With company" : "已关联公司"}
          value={withCompany}
        />
        <StatCard
          label={english ? "With open opportunity" : "关联活跃机会"}
          value={withOpenOpportunity}
        />
        <StatCard
          label={english ? "No interaction in 30 days" : "30 天无互动"}
          value={needsAttention}
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
                    {contact.phone || contact.email ? (
                      <p className="mt-1 break-all text-sm leading-6 text-[color:var(--foreground)]">
                        {[contact.phone, contact.email]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    ) : null}
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
                  <Badge variant={contact._count.opportunities ? "success" : "neutral"}>
                    {english
                      ? `${contact._count.opportunities} open opportunities`
                      : `${contact._count.opportunities} 条活跃机会`}
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
    </div>
  );
}
