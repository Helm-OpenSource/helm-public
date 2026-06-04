"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Building2,
  BriefcaseBusiness,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { RecommendationJudgementCard } from "@/components/recommendations/recommendation-judgement-card";
import { useWorkspaceUi } from "@/components/providers/workspace-ui-provider";
import { BlockerCard } from "@/components/shared/blocker-card";
import { CommitmentCard } from "@/components/shared/commitment-card";
import { EmptyState } from "@/components/shared/empty-state";
import { HomeSurfaceArrivalBanner } from "@/components/shared/home-surface-arrival-banner";
import { ObjectContextOperatingSummary } from "@/components/shared/object-context-operating-summary";
import { PageHeader } from "@/components/shared/page-header";
import { RiskBadge } from "@/components/shared/risk-badge";
import { StageBadge } from "@/components/shared/status-badges";
import { WorkspaceGuidancePanel } from "@/components/shared/workspace-guidance-panel";
import { WorkspaceSurfacePreferences } from "@/components/shared/workspace-surface-preferences";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { opportunityTypeLabels, stageLabels } from "@/data/constants";
import {
  getLocalizedMemorySourceLabels,
  getLocalizedOpportunityTypeLabels,
} from "@/lib/i18n/labels";
import { getWorkspaceStory } from "@/lib/presentation/workspace-story";
import { formatDateLabel, trimText } from "@/lib/utils";
import {
  createCompanyQuickOpportunityAction,
  generateCompanyBriefAction,
} from "@/features/companies/actions";
import { buildOpportunityAssetHref } from "@/features/business-assets/hrefs";
import { generateObjectBriefingAction } from "@/features/memory/actions";
import { createActionFromRecommendationAction } from "@/features/recommendations/actions";
import { StartRecordingButton } from "@/features/conversation-capture/start-recording-button";
import { CompanyDefinitionCard } from "@/features/companies/company-definition-card";
import { formatRoleDetailDisplayText } from "@/lib/presentation/role-detail-display-copy";

type CompanyDetailClientProps = {
  company: {
    id: string;
    name: string;
    industry: string | null;
    website: string | null;
    description: string | null;
    definitionSuggestionJson: string | null;
    definitionAcceptedJson: string | null;
    cooperationMaturity: string | null;
    recommendedPath: string | null;
    contacts: Array<{
      id: string;
      name: string;
      title: string | null;
      relationshipWarmth: string;
      lastInteractionAt: Date | null;
    }>;
    opportunities: Array<{
      id: string;
      title: string;
      type: keyof typeof opportunityTypeLabels;
      stage: keyof typeof stageLabels;
      riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
      nextAction: string | null;
    }>;
    meetings: Array<{
      id: string;
      title: string;
      startsAt: Date;
      note: { summary: string | null } | null;
    }>;
    memoryFacts: Array<{
      id: string;
      title: string;
      content: string;
      confidence: number;
      updatedAt: Date;
    }>;
    commitments: Array<{
      id: string;
      title: string;
      commitmentText: string;
      status: string;
      dueDate: Date | null;
      overdueFlag: boolean;
      sourceType: string;
      updatedAt: Date;
      ownerUser: { name: string } | null;
      relatedContact: { id: string; name: string } | null;
      relatedOpportunity: { id: string; title: string } | null;
      relatedMeeting: { id: string; title: string } | null;
    }>;
    blockers: Array<{
      id: string;
      title: string;
      blockerType: string;
      blockerText: string;
      severity: number;
      status: string;
      firstSeenAt: Date;
      updatedAt: Date;
      relatedContact: { id: string; name: string } | null;
      relatedOpportunity: { id: string; title: string } | null;
      relatedMeeting: { id: string; title: string } | null;
    }>;
    memoryEntries: Array<{
      id: string;
      title: string;
      content: string;
      createdAt: Date;
    }>;
    briefingSnapshot: {
      id: string;
      payload: {
        summary?: string;
        activeBlockers?: Array<Record<string, unknown>>;
        openCommitments?: Array<Record<string, unknown>>;
        recommendedNextSteps?: string[];
      };
    } | null;
  };
  recentInteractionCount: number;
  recommendations: Array<{
    recommendationId: string;
    title: string;
    description: string;
    score: number;
    policyResult:
      | "SUGGEST_ONLY"
      | "REQUIRES_APPROVAL"
      | "AUTO_WITHIN_THRESHOLD"
      | "FORBIDDEN";
    explanation: string;
    supportingFactIds: string[];
    blockerIds: string[];
    commitmentIds: string[];
    whyNotAutoExecute?: string | null;
    recommendationPayload?: Record<string, unknown> | null;
    appliedPolicyRules?: Array<{
      name: string | null;
      mode:
        | "SUGGEST_ONLY"
        | "REQUIRES_APPROVAL"
        | "AUTO_WITHIN_THRESHOLD"
        | "FORBIDDEN"
        | null;
      reason: string;
    }>;
  }>;
};

export function CompanyDetailClient({
  company,
  recentInteractionCount,
  recommendations,
}: CompanyDetailClientProps) {
  const router = useRouter();
  const { locale, demoMode } = useWorkspaceUi();
  const english = locale === "en-US";
  const text = (value: string | null | undefined) =>
    formatRoleDetailDisplayText(value, english);
  const pageStory = getWorkspaceStory("companies", locale, demoMode);
  const opportunityTypeLabelsByLocale =
    getLocalizedOpportunityTypeLabels(locale);
  const memorySourceLabels = getLocalizedMemorySourceLabels(locale);
  const [, startTransition] = useTransition();
  const [brief, setBrief] = useState("");
  const briefingPayload = company.briefingSnapshot?.payload;
  const displayBriefingSummary = briefingPayload?.summary
    ? text(briefingPayload.summary)
    : null;
  const topBlocker = company.blockers[0];
  const topCommitment =
    company.commitments.find((item) => item.overdueFlag) ??
    company.commitments[0];
  const keyContactNames = company.contacts
    .slice(0, 3)
    .map((contact) => contact.name)
    .join("、");
  const companyMomentum = buildCompanyMomentum({
    companyName: company.name,
    english,
    activeOpportunityCount: company.opportunities.length,
    contactCount: company.contacts.length,
    recentInteractionCount,
    recommendationCount: recommendations.length,
    topBlocker,
    topCommitment,
  });
  const noPushImpact = topBlocker
    ? english
      ? `If "${topBlocker.title}" is not addressed this week, this account will stay stuck in observation mode and the team will struggle to judge whether to keep investing or close it down early.`
      : `如果本周不先处理“${topBlocker.title}”，这个账户会继续停在观察态，团队很难判断该继续投入还是及时收口。`
    : english
      ? "If this account is not pushed forward this week, it will stay at the current maturity level and future momentum will become more expensive."
      : "如果本周不推进，这个账户会继续停在当前成熟度，后续推进成本会明显升高。";
  const companyOperatingTitle = english
    ? `${company.name} should read as an account in motion, not a static company record`
    : `${company.name} 现在应该被读成在推进中的账户，而不是静态公司档案`;
  const companyOperatingItems = [
    {
      label: english ? "Object state" : "当前对象状态",
      value: `${company.cooperationMaturity ?? (english ? "Needs review" : "待判断")} · ${english ? `${company.opportunities.length} active opportunities` : `${company.opportunities.length} 条活跃机会`} · ${english ? `${company.contacts.length} key contacts` : `${company.contacts.length} 位关键联系人`}`,
    },
    {
      label: english ? "Single next step" : "最重要下一步",
      value:
        briefingPayload?.recommendedNextSteps?.[0] ??
        company.recommendedPath ??
        topCommitment?.title ??
        topBlocker?.title ??
        (english
          ? "Clarify one owner and one next account push."
          : "先明确一位负责人和一个账户级下一推。"),
    },
    {
      label: english ? "Boundary posture" : "当前边界状态",
      value: recommendations.some(
        (item) => item.policyResult === "REQUIRES_APPROVAL",
      )
        ? english
          ? "At least one account-level move is already touching a review boundary, so expansion still needs explicit approval visibility."
          : "当前至少有一条账户级动作已经触到复核边界，所以扩张推进仍需显式审批可见性。"
        : topBlocker
          ? english
            ? "Account friction is still visible, so the system should reduce coordination drag before pushing a stronger external move."
            : "当前账户阻力仍然可见，所以系统应先降低协同阻力，再推进更强的外部动作。"
          : english
            ? "The account can continue inside the object loop for now, while higher-risk moves still need a visible review boundary."
            : "当前账户可以继续留在对象主回路内推进，但更高风险动作仍然需要可见复核边界。",
    },
    {
      label: english ? "Source context" : "支撑上下文",
      value:
        company.memoryFacts[0]?.content ??
        topCommitment?.commitmentText ??
        topBlocker?.blockerText ??
        displayBriefingSummary ??
        (english
          ? "Meetings, memory and recent account activity already explain why this account deserves attention now."
          : "会议、记忆和最近账户互动已经能解释为什么这家公司现在值得处理。"),
    },
  ];
  const companyOperatingConnections = [
    company.contacts[0]
      ? {
          label: english ? "Key contact" : "关键联系人",
          value: company.contacts[0].name,
          description: english
            ? "Relationship continuity on this person will decide whether the account can keep moving."
            : "这位联系人的关系连续性会决定这个账户能不能继续往前走。",
          href: `/contacts/${company.contacts[0].id}`,
        }
      : undefined,
    company.opportunities[0]
      ? {
          label: english ? "Active opportunity" : "活跃机会",
          value: company.opportunities[0].title,
          description: english
            ? "Use the lead opportunity to judge whether this account is still warming or starting to cool."
            : "这条主机会最能说明这个账户是在继续升温还是开始变冷。",
          href: buildOpportunityAssetHref(company.opportunities[0].id, "company-detail"),
        }
      : undefined,
    company.meetings[0]
      ? {
          label: english ? "Recent meeting" : "最近会议",
          value: company.meetings[0].title,
          description: english
            ? "The latest meeting is usually the fastest way to explain what changed on this account."
            : "最近一次会议通常是解释账户变化的最快入口。",
          href: `/meetings/${company.meetings[0].id}`,
        }
      : undefined,
    recommendations.some((item) => item.policyResult === "REQUIRES_APPROVAL")
      ? {
          label: english ? "Review handoff" : "复核去向",
          value: english
            ? "At least one account move is already waiting in approvals."
            : "当前至少有一条账户动作已经进入复核队列。",
          description: english
            ? "Use the formal review surface before treating this account push as approved."
            : "先经过正式复核，再把账户推进读成已确认动作。",
          href: "/approvals",
        }
      : company.memoryFacts[0]
        ? {
            label: english ? "Memory source" : "记忆依据",
            value: company.memoryFacts[0].title,
            description: trimText(company.memoryFacts[0].content, 72),
            href: `/memory?objectType=COMPANY&objectId=${company.id}`,
          }
        : topCommitment
          ? {
              label: english ? "Commitment chain" : "承诺链",
              value: topCommitment.title,
              description: trimText(topCommitment.commitmentText, 72),
              href: `/memory?objectType=COMPANY&objectId=${company.id}`,
            }
          : topBlocker
            ? {
                label: english ? "Blocker source" : "阻塞依据",
                value: topBlocker.title,
                description: trimText(topBlocker.blockerText, 72),
                href: `/memory?objectType=COMPANY&objectId=${company.id}`,
              }
            : undefined,
  ].filter(
    (
      item,
    ): item is {
      label: string;
      value: string;
      description: string;
      href: string;
    } => Boolean(item),
  );
  const companyGuidanceRecommendations = [
    topBlocker
      ? {
          title: english
            ? "Resolve the account blocker first"
            : "先处理账户阻塞",
          body: english
            ? `The account is still blocked by "${topBlocker.title}", so the next move should reduce coordination drag before pushing externally.`
            : `当前账户仍被“${topBlocker.title}”卡住，下一步应先降低协同摩擦，再决定是否对外推进。`,
          href: `/memory?objectType=COMPANY&objectId=${company.id}`,
          meta: english ? "Blocker pressure" : "阻塞压力",
        }
      : undefined,
    company.opportunities[0]
      ? {
          title: english
            ? "Use the lead opportunity as the account anchor"
            : "以主机会作为账户锚点",
          body: english
            ? `Keep "${company.opportunities[0].title}" coherent before opening another path.`
            : `先让“${company.opportunities[0].title}”保持同向，再考虑拆出新的推进路径。`,
          href: buildOpportunityAssetHref(company.opportunities[0].id, "company-detail"),
          meta: english ? "Opportunity anchor" : "机会锚点",
        }
      : undefined,
    company.contacts[0]
      ? {
          title: english
            ? "Validate the owner through the key contact"
            : "先通过关键联系人验证负责人",
          body: english
            ? `Use ${company.contacts[0].name}'s continuity to judge whether the account is actually warming.`
            : `先看 ${company.contacts[0].name} 的关系连续性，确认这个账户是否真的在升温。`,
          href: `/contacts/${company.contacts[0].id}`,
          meta: english ? "Owner validation" : "负责人验证",
        }
      : undefined,
  ].filter(
    (
      item,
    ): item is {
      title: string;
      body: string;
      href: string;
      meta: string;
    } => Boolean(item),
  );
  const companyGuidanceReminders = [
    {
      title: english ? "Current account judgement" : "当前账户判断",
      body: companyMomentum.summary,
      meta: english ? "Momentum" : "势能",
    },
    {
      title: english ? "If we do not push now" : "如果现在不推进",
      body: noPushImpact,
      meta: english ? "Cost of waiting" : "等待代价",
    },
    displayBriefingSummary
      ? {
          title: english ? "Object-level summary exists" : "已有对象级摘要",
          body: trimText(displayBriefingSummary, 112),
          meta: english ? "Memory brief" : "记忆摘要",
        }
      : undefined,
  ].filter(
    (
      item,
    ): item is {
      title: string;
      body: string;
      meta: string;
    } => Boolean(item),
  );

  function runAction(
    fn: () => Promise<{
      ok: boolean;
      error?: string;
      opportunityId?: string;
      brief?: string;
    }>,
    success: string,
    pushTo?: string,
  ) {
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        toast.error(result.error ?? (english ? "Action failed" : "操作失败"));
        return;
      }
      if (result.brief) setBrief(result.brief);
      toast.success(success);
      if (pushTo) router.push(pushTo);
      router.refresh();
    });
  }

  const companySecondaryContext = (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_360px]">
      <WorkspaceGuidancePanel
        eyebrow={english ? "Account guidance" : "账户引导"}
        title={
          english
            ? "Read the company as an account in motion, not a static profile."
            : "先把公司读成持续推进中的账户，而不是静态资料。"
        }
        summary={
          english
            ? "This surface should explain whether the account is warming, what is blocking it, and which next move can improve confidence without overselling progress."
            : "先确认账户是否真的在升温、当前被什么拖住，以及哪一步动作能提高判断信心而不夸大进展。"
        }
        recommendations={companyGuidanceRecommendations}
        reminders={companyGuidanceReminders}
        recommendationsLabel={english ? "Recommended next moves" : "建议先处理"}
        remindersLabel={english ? "Account reminders" : "账户提醒"}
        boundaryLabel={english ? "Boundary" : "边界"}
        boundary={
          english
            ? "This page can prepare account briefs, recommendation follow-through and object memory, but it still does not turn momentum into an approved external commitment."
            : "这个页面可以准备账户简报、建议动作推进和对象记忆，但不会默认把势能写成已批准的外部承诺。"
        }
      />
      <div className="workspace-surface-stack">
        <WorkspaceSurfacePreferences />
        <Card className="workspace-form-assist workspace-panel-muted">
          <CardContent className="space-y-3 py-5">
            <p className="workspace-eyebrow">
              {english ? "Account assist" : "账户辅助"}
            </p>
            <p className="text-lg font-semibold tracking-tight text-[color:var(--foreground)]">
              {english
                ? "Use quick account actions before expanding the work graph."
                : "先用快捷账户动作收敛判断，再扩大推进图谱。"}
            </p>
            <p className="text-sm leading-7 text-[color:var(--muted-foreground)]">
              {english
                ? "Refresh the account summary, generate a company brief, then open the lead opportunity or memory page only when the context is clear."
                : "先刷新账户摘要、生成公司简报，再在上下文清晰时进入主机会或记忆页。"}
            </p>
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  runAction(
                    () => generateObjectBriefingAction("COMPANY", company.id),
                    english ? "Company summary refreshed" : "公司摘要已刷新",
                  )
                }
              >
                <Sparkles className="h-4 w-4" />
                {english ? "Refresh summary" : "刷新摘要"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  runAction(
                    () => generateCompanyBriefAction(company.id),
                    english ? "Company brief generated" : "已生成公司简报",
                  )
                }
              >
                <Sparkles className="h-4 w-4" />
                {english ? "Generate brief" : "生成简报"}
              </Button>
              <Button type="button" variant="secondary" asChild>
                <Link
                  href={`/memory?objectType=COMPANY&objectId=${company.id}`}
                >
                  {english ? "Open memory" : "查看记忆"}
                </Link>
              </Button>
              {company.opportunities[0] ? (
                <Button type="button" variant="secondary" asChild>
                  <Link
                    href={buildOpportunityAssetHref(
                      company.opportunities[0].id,
                      "company-detail",
                    )}
                  >
                    {english ? "Open lead opportunity" : "查看主机会"}
                  </Link>
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  return (
    <div className="workspace-surface-stack">
      <PageHeader
        showBreadcrumb={false}
        titleAs="h2"
        eyebrow={pageStory.eyebrow}
        title={company.name}
        description={text(
          `${pageStory.description} · ${english ? "Current maturity" : "当前成熟度"}：${company.cooperationMaturity ?? (english ? "Needs review" : "待判断")}`,
        )}
        actions={
          <>
            <StartRecordingButton
              variant="secondary"
              objectType="COMPANY"
              objectId={company.id}
              objectLabel={company.name}
              defaultTitle={
                english
                  ? `${company.name} live capture`
                  : `${company.name} 现场记录`
              }
            />
            <Button
              onClick={() =>
                runAction(
                  () => createCompanyQuickOpportunityAction(company.id),
                  english ? "Company opportunity created" : "已创建公司机会",
                  "/opportunities",
                )
              }
            >
              <BriefcaseBusiness className="h-4 w-4" />
              {english ? "New opportunity" : "新建机会"}
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                runAction(
                  () => generateCompanyBriefAction(company.id),
                  english ? "Company brief generated" : "已生成公司简报",
                )
              }
            >
              <Sparkles className="h-4 w-4" />
              {english ? "Generate company brief" : "生成公司简报"}
            </Button>
          </>
        }
      />

      <HomeSurfaceArrivalBanner
        kind="detail"
        english={english}
        contract={{
          ownership: english
            ? "Company detail owns the current account state, next-step judgement and account workspace."
            : "公司详情面负责当前账户状态、下一步判断和账户工作区。",
          nextStep: english
            ? "Start in the account workspace, then decide whether the next move belongs in a lead opportunity, memory, or follow-through."
            : "先从账户工作区开始，再决定下一步应该落在主机会、记忆还是后续推进。",
          boundary: english
            ? "This page can shape account judgement and recommendation follow-through, but it still does not grant external commitment authority."
            : "这个页面可以整形账户判断和建议动作跟进，但不会获得对外承诺权限。",
        }}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric
          label={english ? "Maturity" : "合作成熟度"}
          value={
            text(
              company.cooperationMaturity ??
                (english ? "Needs review" : "待判断"),
            )
          }
        />
        <Metric
          label={english ? "Key contacts" : "关键联系人"}
          value={
            english
              ? `${company.contacts.length}`
              : `${company.contacts.length} 位`
          }
        />
        <Metric
          label={english ? "Active opportunities" : "活跃机会"}
          value={
            english
              ? `${company.opportunities.length}`
              : `${company.opportunities.length} 条`
          }
        />
        <Metric
          label={english ? "Current blockers" : "当前卡点"}
          value={
            english
              ? `${company.blockers.length}`
              : `${company.blockers.length} 个`
          }
        />
      </div>

      <div id="company-workspace">
        <ObjectContextOperatingSummary
          label={english ? "Account operating summary" : "账户操作摘要"}
          title={text(companyOperatingTitle)}
          summary={text(companyMomentum.summary)}
          items={companyOperatingItems.map((item) => ({
            label: text(item.label),
            value: text(item.value),
          }))}
          connectionsLabel={english ? "Connected loop" : "关联对象与回路"}
          connections={companyOperatingConnections.map((connection) => ({
            ...connection,
            label: text(connection.label),
            value: text(connection.value),
            description: connection.description
              ? text(connection.description)
              : connection.description,
          }))}
        />
      </div>

      {companySecondaryContext}

      <Card className={demoMode ? "workspace-panel-muted" : undefined}>
        <CardContent
          className={`grid gap-4 py-5 ${demoMode ? "xl:grid-cols-[1.05fr_repeat(4,minmax(0,0.82fr))]" : "xl:grid-cols-4"}`}
        >
          {demoMode ? (
            <div className="space-y-2">
              <Badge variant="approval">{english ? "Account Intelligence" : "账户判断"}</Badge>
              <p className="text-lg font-semibold text-[color:var(--foreground)]">
                {english
                  ? "The company page compresses key contacts, momentum path and the last 30 days of activity into one account view."
                  : "公司页负责把关键联系人、推进路径和最近 30 天互动浓缩成一张账号视图。"}
              </p>
              <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                {english
                  ? "Use it to explain whether the account is warming, blocked or worth deeper investment, instead of only showing static profile fields."
                  : "适合在客户演示里解释“这个账户现在是升温、受阻还是值得继续加码”，而不是只看静态资料。"}
              </p>
            </div>
          ) : null}
          <Info
            label={english ? "Account momentum" : "账户势能"}
            value={text(companyMomentum.label)}
          />
          <Info
            label={english ? "Key contacts" : "关键联系人"}
            value={keyContactNames || (english ? "To be identified" : "待识别")}
          />
          <Info
            label={english ? "Main blocker" : "当前最大卡点"}
            value={
              topBlocker
                ? trimText(topBlocker.title, 28)
                : english
                  ? "No major blocker"
                  : "暂无显著阻塞"
            }
          />
          <Info
            label={english ? "Open commitments" : "未兑现承诺"}
            value={
              english
                ? `${company.commitments.filter((item) => item.status !== "FULFILLED").length}`
                : `${company.commitments.filter((item) => item.status !== "FULFILLED").length} 条`
            }
          />
          <Info
            label={english ? "Company memory" : "公司记忆"}
            value={
              english
                ? `${company.memoryEntries.length + company.memoryFacts.length}`
                : `${company.memoryEntries.length + company.memoryFacts.length} 条`
            }
          />
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.96fr_0.9fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>
                {english ? "Company profile" : "公司基础信息"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <CompanyDefinitionCard
                locale={locale}
                company={{
                  id: company.id,
                  name: company.name,
                  website: company.website,
                  definitionSuggestionJson: company.definitionSuggestionJson,
                  definitionAcceptedJson: company.definitionAcceptedJson,
                }}
              />
              <div className="grid gap-4 md:grid-cols-2">
                <Info
                  label={english ? "Industry" : "行业"}
                  value={company.industry ?? (english ? "Not set" : "未填写")}
                />
                <Info
                  label={english ? "Website" : "官网"}
                  value={company.website ?? (english ? "Not set" : "未填写")}
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Info
                  label={english ? "Cooperation maturity" : "合作成熟度"}
                  value={
                    text(
                      company.cooperationMaturity ??
                        (english ? "Needs review" : "待判断"),
                    )
                  }
                />
              </div>
              <div className="workspace-panel-muted rounded-2xl p-4">
                <p className="text-sm font-medium text-[color:var(--foreground)]">
                  {english ? "Account momentum judgement" : "账户势能判断"}
                </p>
                <p className="mt-2 text-sm leading-7 text-[color:var(--foreground)]">
                  {text(companyMomentum.summary)}
                </p>
                <p className="mt-2 text-xs leading-6 text-[color:var(--muted-foreground)]">
                  {text(companyMomentum.focusLine)}
                </p>
              </div>
              <div className="workspace-panel-muted rounded-2xl p-4">
                <p className="text-sm font-medium text-[color:var(--foreground)]">
                  {english ? "Recommended path" : "下一步建议"}
                </p>
                <p className="mt-2 text-sm leading-7 text-[color:var(--muted)]">
                  {text(
                    company.recommendedPath ??
                      (english
                        ? "Identify the single owner first, then schedule the next high-leverage push."
                        : "先识别唯一负责人，再安排下一次关键推进动作。"),
                  )}
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="theme-surface-panel rounded-2xl p-4">
                  <p className="text-sm font-medium text-[color:var(--foreground)]">
                    {english ? "Main blocker" : "当前最大卡点"}
                  </p>
                  <p className="mt-2 text-sm leading-7 text-[color:var(--muted)]">
                    {text(
                      topBlocker
                        ? trimText(topBlocker.blockerText, 110)
                        : english
                          ? "There is no structured blocker yet, so it is still worth widening interaction and validating the real source of friction."
                          : "当前没有结构化阻塞，适合继续扩大互动和验证真实推进阻力。",
                    )}
                  </p>
                </div>
                <div className="rounded-2xl border border-[color:var(--status-warning-border)] bg-[color:var(--status-warning-bg)]/60 p-4">
                  <p className="text-sm font-medium text-[color:var(--foreground)]">
                    {english ? "If we do not push this week" : "如果本周不推进"}
                  </p>
                  <p className="mt-2 text-sm leading-7 text-[color:var(--foreground)]">
                    {text(noPushImpact)}
                  </p>
                </div>
              </div>
              <div className="theme-surface-panel rounded-2xl p-4">
                <p className="text-sm font-medium text-[color:var(--foreground)]">
                  {english ? "Last 30 days of activity" : "最近 30 天互动摘要"}
                </p>
                <p className="mt-2 text-sm leading-7 text-[color:var(--muted)]">
                  {english
                    ? `In the last 30 days there were ${recentInteractionCount} explicit interactions, covering ${company.meetings.length} meetings, ${company.memoryEntries.length} work-memory entries and ${company.opportunities.length} active business lines.`
                    : `最近 30 天共有 ${recentInteractionCount} 次明确互动，覆盖 ${company.meetings.length} 场会议、${company.memoryEntries.length} 条工作记忆和 ${company.opportunities.length} 条业务推进线。`}
                </p>
              </div>
              <div className="theme-surface-panel rounded-2xl p-4">
                <p className="text-sm font-medium text-[color:var(--foreground)]">
                  {english ? "Key memory summary" : "关键记忆摘要"}
                </p>
                <div className="mt-3 space-y-3">
                  {company.memoryFacts.length ? (
                    company.memoryFacts.slice(0, 3).map((fact) => (
                      <div
                        key={fact.id}
                        className="workspace-panel rounded-2xl px-4 py-3"
                      >
                        <p className="text-sm font-medium text-[color:var(--foreground)]">
                          {text(fact.title)}
                        </p>
                        <p className="mt-1 text-sm text-[color:var(--muted)]">
                          {trimText(text(fact.content), 96)}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-[color:var(--muted-foreground)]">
                      {english
                        ? "There is no structured company memory yet."
                        : "当前还没有结构化公司记忆。"}
                    </p>
                  )}
                </div>
              </div>
              <div className="workspace-panel-muted rounded-2xl p-4">
                <p className="text-sm font-medium text-[color:var(--foreground)]">
                  {english ? "Recommended path forward" : "推荐推进路径"}
                </p>
                <div className="mt-3 space-y-3">
                  {recommendations.length ? (
                    recommendations.slice(0, 2).map((item, index) => (
                      <RecommendationJudgementCard
                        key={item.recommendationId}
                        recommendation={item}
                        emphasis={index === 0 ? "featured" : "quiet"}
                        summaryLabel={
                          index === 0
                            ? english
                              ? "Primary account recommendation"
                              : "账户主推荐"
                            : english
                              ? "Alternate move"
                              : "备选推进动作"
                        }
                        sourcePage={`/companies/${company.id}`}
                        cta={
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() =>
                              runAction(
                                () =>
                                  createActionFromRecommendationAction(
                                    item.recommendationId,
                                    `/companies/${company.id}`,
                                  ),
                                english
                                  ? "Action created from recommendation"
                                  : "已按建议生成动作",
                                "/approvals",
                              )
                            }
                          >
                            {english
                              ? "Create action from recommendation"
                              : "按建议生成动作"}
                          </Button>
                        }
                        secondaryCta={
                          <Button size="sm" variant="ghost" asChild>
                            <Link
                              href={`/memory?objectType=COMPANY&objectId=${company.id}`}
                            >
                              {english ? "View object memory" : "查看对象记忆"}
                            </Link>
                          </Button>
                        }
                      />
                    ))
                  ) : (
                    <p className="text-sm text-[color:var(--muted-foreground)]">
                      {english
                        ? "There is not enough evidence yet to generate a company-level recommendation."
                        : "当前还没有足够证据生成公司级建议。"}
                    </p>
                  )}
                </div>
              </div>
              {brief ? (
                <div className="workspace-panel-muted rounded-2xl p-4">
                  <p className="text-sm font-medium text-[color:var(--foreground)]">
                    {english ? "Company brief" : "公司级简报"}
                  </p>
                  <pre className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[color:var(--muted)]">
                    {text(brief)}
                  </pre>
                </div>
              ) : null}
              <div className="theme-surface-panel rounded-2xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-medium text-[color:var(--foreground)]">
                    {english ? "Object-level summary" : "对象级工作摘要"}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        runAction(
                          () =>
                            generateObjectBriefingAction("COMPANY", company.id),
                          english
                            ? "Company summary refreshed"
                            : "公司摘要已刷新",
                        )
                      }
                    >
                      <Sparkles className="h-4 w-4" />
                      {english ? "Refresh summary" : "刷新摘要"}
                    </Button>
                    <Button size="sm" variant="ghost" asChild>
                      <Link
                        href={`/memory?objectType=COMPANY&objectId=${company.id}`}
                      >
                        {english ? "Open memory" : "查看记忆"}
                      </Link>
                    </Button>
                  </div>
                </div>
                <p className="mt-3 text-sm leading-7 text-[color:var(--muted)]">
                  {displayBriefingSummary ??
                    (english
                      ? "The system condenses company memory, open commitments, active blockers and recent interactions into one account summary you can speak to directly."
                      : "公司级记忆、开放承诺、当前卡点和最近互动会收敛成一段可直接讲述的账户摘要。")}
                </p>
                {briefingPayload?.recommendedNextSteps?.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {briefingPayload.recommendedNextSteps
                      .slice(0, 2)
                      .map((item) => (
                        <Badge key={item} variant="info">
                          {text(item)}
                        </Badge>
                      ))}
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{english ? "Recent meetings" : "最近会议"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {company.meetings.length ? (
                company.meetings.map((meeting) => (
                  <Link
                    key={meeting.id}
                    href={`/meetings/${meeting.id}`}
                    aria-label={meeting.title}
                    className="block rounded-2xl border border-[color:var(--border)] px-4 py-4 transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)]"
                  >
                    <p className="font-medium text-[color:var(--foreground)]">
                      {meeting.title}
                    </p>
                    <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
                      {formatDateLabel(meeting.startsAt)}
                    </p>
                    <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
                      {trimText(
                        text(
                          meeting.note?.summary ??
                            (english ? "Open meeting detail" : "查看会议详情"),
                        ),
                        96,
                      )}
                    </p>
                  </Link>
                ))
              ) : (
                <EmptyState
                  title={
                    english
                      ? "No company-related meetings yet"
                      : "还没有公司相关会议"
                  }
                  description={
                    english
                      ? "New meetings, notes and follow-up actions will make this page feel more like a real account view."
                      : "新会议、会后纪要和后续动作会帮助公司页更像真实账户视图。"
                  }
                />
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>
                {english ? "Current commitments" : "当前承诺"}
              </CardTitle>
              <CardDescription>
                {english
                  ? "What's still open."
                  : "还没兑现的承诺。"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {company.commitments.length ? (
                company.commitments.map((commitment) => (
                  <CommitmentCard
                    key={commitment.id}
                    commitment={{
                      ...commitment,
                      sourceLabel: describeCommitmentSource(
                        commitment.sourceType,
                        memorySourceLabels,
                      ),
                      ownerName: commitment.ownerUser?.name ?? null,
                      targetLabel:
                        commitment.relatedOpportunity?.title ??
                        commitment.relatedMeeting?.title ??
                        commitment.relatedContact?.name ??
                        company.name,
                    }}
                    compact
                  />
                ))
              ) : (
                <EmptyState
                  title={
                    english
                      ? "No company-level commitments"
                      : "当前没有公司级承诺"
                  }
                  description={
                    english
                      ? "Commitments from meetings show up here."
                      : "会议里形成的承诺会出现在这里。"
                  }
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                {english ? "High-risk blockers" : "高风险阻塞"}
              </CardTitle>
              <CardDescription>
                {english
                  ? "What's keeping this account stuck."
                  : "正在压住这家账户的阻塞。"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {company.blockers.length ? (
                company.blockers.map((blocker) => (
                  <BlockerCard
                    key={blocker.id}
                    blocker={{
                      ...blocker,
                      targetLabel:
                        blocker.relatedOpportunity?.title ??
                        blocker.relatedMeeting?.title ??
                        blocker.relatedContact?.name ??
                        company.name,
                    }}
                    compact
                  />
                ))
              ) : (
                <EmptyState
                  title={
                    english
                      ? "No high-risk blocker right now"
                      : "当前没有高风险阻塞"
                  }
                  description={
                    english
                      ? "Budget, resourcing and external push blockers will surface here first."
                      : "预算、资源和对外推进阻塞会优先出现在这里。"
                  }
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                {english ? "Linked contacts" : "关联联系人"}
              </CardTitle>
              <CardDescription>
                {english
                  ? "Who can move the next step."
                  : "谁能推动下一步。"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {company.contacts.length ? (
                company.contacts.map((contact) => (
                  <Link
                    key={contact.id}
                    href={`/contacts/${contact.id}`}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-[color:var(--border)] px-4 py-4 transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)]"
                  >
                    <div>
                      <p className="font-medium text-[color:var(--foreground)]">
                        {contact.name}
                      </p>
                      <p className="text-sm text-[color:var(--muted-foreground)]">
                        {contact.title ??
                          (english ? "No title yet" : "未填写职位")}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-[color:var(--muted-foreground)]" />
                  </Link>
                ))
              ) : (
                <EmptyState
                  title={
                    english ? "No linked contacts yet" : "还没有关联联系人"
                  }
                  description={
                    english
                      ? "Add key contacts to see who can push next."
                      : "补齐关键联系人，就能看到下一步推谁。"
                  }
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                {english ? "Linked opportunities" : "关联机会"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {company.opportunities.length ? (
                company.opportunities.map((opportunity) => (
                  <Link
                    key={opportunity.id}
                    href={buildOpportunityAssetHref(opportunity.id, "company-detail")}
                    aria-label={opportunity.title}
                    className="block rounded-2xl border border-[color:var(--border)] px-4 py-4 transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)]"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-[color:var(--foreground)]">
                        {opportunity.title}
                      </p>
                      <Badge variant="default">
                        {opportunityTypeLabelsByLocale[opportunity.type]}
                      </Badge>
                      <StageBadge stage={opportunity.stage} />
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <p className="text-sm text-[color:var(--muted-foreground)]">
                        {trimText(text(opportunity.nextAction), 88)}
                      </p>
                      <RiskBadge risk={opportunity.riskLevel} />
                    </div>
                  </Link>
                ))
              ) : (
                <EmptyState
                  title={
                    english ? "No linked opportunities yet" : "还没有关联机会"
                  }
                  description={
                    english
                      ? "Create one from this page."
                      : "可以在这里直接新建一个。"
                  }
                />
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="theme-judgement-panel">
            <CardHeader>
              <CardTitle>
                {english ? "Account momentum judgement" : "账户势能判断"}
              </CardTitle>
              <CardDescription>
                {english
                  ? "Who to push next, and why now."
                  : "下一个推谁，为什么是现在。"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="theme-judgement-panel-inset rounded-2xl p-4">
                <div className="flex items-start gap-3">
                  <Building2 className="mt-0.5 h-4 w-4 text-[color:var(--accent)]" />
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-[color:var(--foreground)]">
                      {companyMomentum.label}
                    </p>
                    <p className="text-sm leading-6 text-[color:var(--muted)]">
                      {companyMomentum.summary}
                    </p>
                  </div>
                </div>
              </div>
              <div className="theme-judgement-panel-inset rounded-2xl px-4 py-3 text-sm leading-6 text-[color:var(--muted)]">
                {topCommitment
                  ? english
                    ? `Most urgent commitment: "${topCommitment.title}". Suggestions tied to it are ranked first.`
                    : `最急的承诺：「${topCommitment.title}」。相关建议已经排在最前。`
                  : english
                    ? "There is no dominant overdue commitment right now, so the team can invest effort into restoring account heat and the next push."
                    : "当前没有突出的逾期承诺，可以先把资源投入到恢复账户热度和下一次推进。"}
              </div>
              <div className="theme-judgement-panel-inset rounded-2xl px-4 py-3 text-sm leading-6 text-[color:var(--muted)]">
                {companyMomentum.focusLine}
              </div>
              <Button
                className="theme-primary-action w-full justify-start"
                onClick={() =>
                  document
                    .getElementById("company-history")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
              >
                {english ? "View all interactions" : "查看全部互动"}
              </Button>
            </CardContent>
          </Card>

          <Card id="company-history">
            <CardHeader>
              <CardTitle>{english ? "All interactions" : "全部互动"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {company.memoryEntries.length ? (
                company.memoryEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="theme-surface-panel rounded-2xl px-4 py-4"
                  >
                    <p className="font-medium text-[color:var(--foreground)]">
                      {text(entry.title)}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[color:var(--muted-foreground)]">
                      {trimText(text(entry.content), 120)}
                    </p>
                    <p className="mt-2 text-xs text-[color:var(--muted-foreground)]">
                      {formatDateLabel(entry.createdAt)}
                    </p>
                  </div>
                ))
              ) : (
                <EmptyState
                  title={english ? "No company memory yet" : "还没有公司级记忆"}
                  description={
                    english
                      ? "Meeting notes, interaction summaries and progress checkpoints will accumulate into company memory over time."
                      : "会议纪要、互动总结和推进节点会逐步沉淀成公司级工作记忆。"
                  }
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="workspace-panel rounded-2xl px-4 py-3">
      <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
        {label}
      </p>
      <p className="mt-2 break-words text-sm font-medium text-[color:var(--foreground)]">
        {value}
      </p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="space-y-2 py-5">
        <p className="text-sm text-[color:var(--muted-foreground)]">{label}</p>
        <p className="break-words text-xl font-semibold text-[color:var(--foreground)]">
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function describeCommitmentSource(
  sourceType: string,
  labels: Record<string, string>,
) {
  return labels[sourceType] ?? labels.SYSTEM ?? sourceType;
}

function buildCompanyMomentum({
  companyName,
  english,
  activeOpportunityCount,
  contactCount,
  recentInteractionCount,
  recommendationCount,
  topBlocker,
  topCommitment,
}: {
  companyName: string;
  english: boolean;
  activeOpportunityCount: number;
  contactCount: number;
  recentInteractionCount: number;
  recommendationCount: number;
  topBlocker?: {
    title: string;
    blockerText: string;
    severity: number;
    status: string;
  };
  topCommitment?: {
    title: string;
    overdueFlag: boolean;
    status: string;
  };
}) {
  if (
    topBlocker &&
    topBlocker.status !== "RESOLVED" &&
    topBlocker.severity >= 75
  ) {
    return {
      label: english ? "Momentum blocked" : "推进受阻",
      summary: english
        ? `${companyName} does not lack actions right now. It has a high-severity blocker that is still unresolved. Adding more actions will keep losing leverage until that blocker is cleared.`
        : `${companyName} 当前不是缺动作，而是有高严重度阻塞没被清掉。继续堆新动作的收益会下降，先解卡点更值。`,
      focusLine: english
        ? `Center the next push around "${topBlocker.title}" and close the missing decision context before adding more meetings, pricing or partnership moves.`
        : `优先围绕“${topBlocker.title}”补齐决策信息，再推进新的会议、报价或合作动作。`,
    };
  }

  if (topCommitment?.overdueFlag) {
    return {
      label: english ? "Commitment pressure rising" : "兑现压力上升",
      summary: english
        ? `${companyName} is in a "fulfill commitments before expanding" window. The biggest relationship risk right now is not moving slowly, but failing to close what was already promised.`
        : `${companyName} 已经进入“承诺先兑现、再扩大推进”的窗口。现在最容易伤害关系的不是慢，而是答应过的事没有准时闭环。`,
      focusLine: english
        ? `Close "${topCommitment.title}" first, then move the next recommendation to the front. That will fit the current relationship tempo better.`
        : `先把“${topCommitment.title}”收口，再把推荐动作推到前台，会更符合当前关系节奏。`,
    };
  }

  if (
    activeOpportunityCount > 0 &&
    recentInteractionCount >= 4 &&
    recommendationCount > 0
  ) {
    return {
      label: english ? "Warming window" : "处于升温窗口",
      summary: english
        ? `${companyName} has had dense recent interactions, and the system can already produce stable next-step recommendations. That usually means the account is ready for a more forceful push.`
        : `${companyName} 最近互动足够密集，也已经能稳定给出下一步判断建议，说明这个账户具备继续加码推进的条件。`,
      focusLine: english
        ? "Execute the strongest current recommendation first and try to turn the warming state into a clear next stage."
        : "优先把当前最强建议执行掉，争取把升温状态转成明确下一阶段。",
    };
  }

  if (contactCount === 0 || activeOpportunityCount === 0) {
    return {
      label: english ? "Foundation incomplete" : "基础关系待补齐",
      summary: english
        ? `${companyName} is still missing either key contacts or a clear opportunity anchor, so recommendations will stay conservative.`
        : `${companyName} 目前的推进判断还缺关键联系人或明确机会对象，能给出的判断建议会偏保守。`,
      focusLine: english
        ? "Fill in the key contacts and single owner first, then recommendations and briefs will become much stronger."
        : "先补齐关键联系人和唯一负责人，再让判断建议与简报更快长出来。",
    };
  }

  return {
    label: english ? "Stable observation" : "稳定观察中",
    summary: english
      ? `${companyName} has no obvious high-risk blocker, but it also does not yet show a strong warming signal. Low-friction progress and continued observation are the right posture.`
      : `${companyName} 当前没有明显高危阻塞，也没有足够强的升温信号，适合继续做低摩擦推进并观察反馈。`,
    focusLine: english
      ? "Keep lightweight follow-up going and continue feeding new meetings, threads and commitments back into this account view."
      : "保持轻量跟进，把新的会议、邮件线程和承诺继续沉淀进这个账户视图。",
  };
}
