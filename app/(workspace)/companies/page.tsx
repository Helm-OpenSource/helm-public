import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { ArrowRight, Building2, Search } from "lucide-react";
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
import { getWorkspaceStory } from "@/lib/presentation/workspace-story";
import {
  getDeploymentProfileDefaultLocaleCandidate,
  getRequestUiLocaleCandidate,
} from "@/lib/i18n/request-locale.server";
import { formatLocalizedDateLabel } from "@/lib/i18n/date-labels";
import { trimText } from "@/lib/utils";
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
  const workspaceCompanyWhere: Prisma.CompanyWhereInput = {
    workspaceId: workspace.id,
  };
  const activeContactWhere: Prisma.ContactWhereInput = { archivedAt: null };
  const openOpportunityWhere: Prisma.OpportunityWhereInput = {
    stage: { notIn: ["DONE", "LOST"] },
  };
  const [companies, total, withContacts, withOpenOpportunity, needsDefinition] =
    await Promise.all([
      db.company.findMany({
        where: workspaceCompanyWhere,
        include: {
          meetings: {
            orderBy: { startsAt: "desc" },
            take: 1,
          },
          _count: {
            select: {
              contacts: { where: activeContactWhere },
              opportunities: { where: openOpportunityWhere },
            },
          },
        },
        orderBy: [{ lastInteractionAt: "desc" }, { updatedAt: "desc" }],
        take: 24,
      }),
      db.company.count({ where: workspaceCompanyWhere }),
      db.company.count({
        where: {
          ...workspaceCompanyWhere,
          contacts: { some: activeContactWhere },
        },
      }),
      db.company.count({
        where: {
          ...workspaceCompanyWhere,
          opportunities: { some: openOpportunityWhere },
        },
      }),
      db.company.count({
        where: {
          ...workspaceCompanyWhere,
          cooperationMaturity: null,
          recommendedPath: null,
        },
      }),
    ]);

  return (
    <div className="space-y-6" data-source-page="/companies">
      <PageHeader
        eyebrow={pageStory.eyebrow}
        title={english ? "Companies" : "公司"}
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
        />
        <StatCard
          label={english ? "With contacts" : "有关联联系人"}
          value={withContacts}
        />
        <StatCard
          label={english ? "With open opportunity" : "带活跃机会"}
          value={withOpenOpportunity}
        />
        <StatCard
          label={english ? "No maturity or path set" : "未填成熟度与路径"}
          value={needsDefinition}
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
                    {company.industry ||
                    company.website ||
                    company.cooperationMaturity ? (
                      <p className="mt-1 text-sm leading-6 text-[color:var(--muted)]">
                        {trimText(
                          [
                            company.industry,
                            company.website,
                            company.cooperationMaturity,
                          ]
                            .filter(Boolean)
                            .join(" · "),
                          104,
                        )}
                      </p>
                    ) : null}
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-[color:var(--muted-foreground)]" />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge variant={company._count.contacts ? "info" : "neutral"}>
                    {english
                      ? `${company._count.contacts} contacts`
                      : `${company._count.contacts} 位联系人`}
                  </Badge>
                  <Badge variant={company._count.opportunities ? "success" : "neutral"}>
                    {english
                      ? `${company._count.opportunities} open opportunities`
                      : `${company._count.opportunities} 条活跃机会`}
                  </Badge>
                </div>
                {company.meetings[0] ? (
                  <p className="mt-3 text-sm leading-6 text-[color:var(--foreground)]">
                    {english
                      ? `Latest meeting: ${company.meetings[0].title} · ${formatLocalizedDateLabel(company.meetings[0].startsAt, true)}`
                      : `最近会议：${company.meetings[0].title} · ${formatLocalizedDateLabel(company.meetings[0].startsAt, false)}`}
                  </p>
                ) : null}
                <p className="mt-3 text-xs text-[color:var(--muted-foreground)]">
                  {company.lastInteractionAt
                    ? english
                      ? `Last interaction ${formatLocalizedDateLabel(company.lastInteractionAt, true)}`
                      : `最近互动 ${formatLocalizedDateLabel(company.lastInteractionAt, false)}`
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
    </div>
  );
}
