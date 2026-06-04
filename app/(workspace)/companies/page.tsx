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
import { getWorkspaceStory } from "@/lib/presentation/workspace-story";
import {
  getDeploymentProfileDefaultLocaleCandidate,
  getRequestUiLocaleCandidate,
} from "@/lib/i18n/request-locale.server";
import { formatDateLabel, trimText } from "@/lib/utils";
import { normalizeWorkspaceUiConfig } from "@/lib/workspace-ops";

export default async function CompaniesPage() {
  const workspace = await getCurrentWorkspace();
  await requireCurrentUser();
  const requestLocale = await getRequestUiLocaleCandidate();
  const uiConfig = normalizeWorkspaceUiConfig({
    ...workspace,
    requestLocale,
    deploymentProfileDefaultLocale: getDeploymentProfileDefaultLocaleCandidate(),
  });
  const english = uiConfig.locale === "en-US";
  const pageStory = getWorkspaceStory("companies", uiConfig.locale, uiConfig.demoMode);
  const companies = await db.company.findMany({
    where: {
      workspaceId: workspace.id,
    },
    include: {
      contacts: {
        orderBy: { lastInteractionAt: "desc" },
        take: 3,
      },
      opportunities: {
        where: {
          stage: {
            notIn: ["DONE", "LOST"],
          },
        },
        orderBy: { updatedAt: "desc" },
        take: 3,
      },
      meetings: {
        orderBy: { startsAt: "desc" },
        take: 1,
      },
    },
    orderBy: [{ lastInteractionAt: "desc" }, { updatedAt: "desc" }],
    take: 24,
  });
  const total = await db.company.count({
    where: { workspaceId: workspace.id },
  });
  const withContacts = companies.filter(
    (company) => company.contacts.length > 0,
  ).length;
  const withOpenOpportunity = companies.filter(
    (company) => company.opportunities.length > 0,
  ).length;
  const needsDefinition = companies.filter(
    (company) => !company.cooperationMaturity && !company.recommendedPath,
  ).length;

  return (
    <div className="space-y-6" data-source-page="/companies">
      <PageHeader
        eyebrow={pageStory.eyebrow}
        title={
          english
            ? "Which account is going to slip if you don't touch it this week"
            : "这周不动一下、就要凉的客户在这里"
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
              <Link href="/contacts">
                {english ? "Open contacts" : "打开联系人"}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={english ? "Customer accounts" : "客户账户"}
          value={total}
          detail={english ? "Accounts available to act on" : "可直接进入推进"}
        />
        <StatCard
          label={english ? "With contacts" : "有关联联系人"}
          value={withContacts}
          detail={english ? "Loaded in this view" : "当前列表内"}
        />
        <StatCard
          label={english ? "With open opportunity" : "带活跃机会"}
          value={withOpenOpportunity}
          detail={english ? "Revenue motion is already attached" : "已有收入推进线"}
        />
        <StatCard
          label={english ? "Need next touch" : "待补下一步"}
          value={needsDefinition}
          detail={english ? "No clear next contact path yet" : "还没写清下一次触达"}
        />
      </div>

      <Card className="workspace-panel-muted">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-[var(--accent)]" />
            <CardTitle>
              {english ? "Company directory" : "公司目录"}
            </CardTitle>
          </div>
          <CardDescription>
            {english
              ? "Top of the list needs you most."
              : "最上面那家最需要你介入。"}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-2">
          {companies.length ? (
            companies.map((company) => (
              <Link
                key={company.id}
                href={`/companies/${company.id}`}
                aria-label={
                  english
                    ? `Open company: ${company.name}`
                    : `查看公司：${company.name}`
                }
                className="workspace-panel block rounded-2xl px-4 py-4 transition hover:border-[color:var(--border-strong)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-[color:var(--foreground)]">
                      {company.name}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-[color:var(--muted)]">
                      {trimText(
                        [
                          company.industry,
                          company.cooperationMaturity ??
                            (english ? "Maturity needs review" : "成熟度待判断"),
                          company.recommendedPath,
                        ]
                          .filter(Boolean)
                          .join(" · "),
                        104,
                      )}
                    </p>
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-[color:var(--muted-foreground)]" />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge variant={company.contacts.length ? "info" : "neutral"}>
                    {english
                      ? `${company.contacts.length} key contacts`
                      : `${company.contacts.length} 位关键联系人`}
                  </Badge>
                  <Badge variant={company.opportunities.length ? "success" : "neutral"}>
                    {english
                      ? `${company.opportunities.length} open opportunities`
                      : `${company.opportunities.length} 条活跃机会`}
                  </Badge>
                  {company.meetings[0] ? (
                    <Badge variant="approval">
                      {english ? "Recent meeting" : "已有近期会议"}
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-3 text-xs text-[color:var(--muted-foreground)]">
                  {company.lastInteractionAt
                    ? english
                      ? `Last interaction ${formatDateLabel(company.lastInteractionAt)}`
                      : `最近互动 ${formatDateLabel(company.lastInteractionAt)}`
                    : english
                      ? "No recent interaction recorded"
                      : "暂无近期互动记录"}
                </p>
              </Link>
            ))
          ) : (
            <EmptyState
              title={english ? "No companies yet" : "还没有公司"}
              description={
                english
                  ? "Import CRM data or capture from a meeting — companies will appear here."
                  : "导入客户关系系统数据或从会议带入——公司会出现在这里。"
              }
            />
          )}
        </CardContent>
      </Card>

      <Card className="workspace-panel-muted">
        <CardContent className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[color:var(--foreground)]">
              {english ? "Next account action" : "下一步处理客户"}
            </p>
            <p className="mt-1 text-sm leading-6 text-[color:var(--muted)]">
              {english
                ? "Open the pipeline only after the account that needs contact today is clear."
                : "先确定今天要碰哪家客户，再进入机会面处理金额、阶段和负责人。"}
            </p>
          </div>
          <Button variant="secondary" asChild>
            <Link href="/opportunities">
              <Users2 className="h-4 w-4" />
              {english ? "Open the deal pipeline" : "打开销售管线"}
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
