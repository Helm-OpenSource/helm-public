import "server-only";

import { ObjectType } from "@prisma/client";
import { db } from "@/lib/db";
import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import {
  getDeploymentProfileDefaultLocaleCandidate,
  getRequestUiLocaleCandidate,
} from "@/lib/i18n/request-locale.server";
import {
  getLocalizedBlockerStatusLabels,
  getLocalizedCommitmentStatusLabels,
  getLocalizedRiskLabels,
  getLocalizedStageLabels,
} from "@/lib/i18n/labels";
import { normalizeWorkspaceUiConfig } from "@/lib/workspace-ops";
import { formatDateLabel, formatRelative, trimText } from "@/lib/utils";
import {
  buildBusinessAssetJudgementChain,
  formatBusinessAssetTypeLabel,
  type BusinessAssetJudgementChain,
} from "@/features/business-assets/display-copy";
import {
  formatBusinessAssetDateLabel,
  formatBusinessAssetRelativeLabel,
} from "@/features/business-assets/business-asset-date-labels";
import {
  buildCommitmentAssetHref,
  buildCustomerAssetHref,
  buildOpportunityAssetHref,
  buildRiskAssetHref,
  normalizeBusinessAssetType,
  type BusinessAssetType,
} from "@/features/business-assets/hrefs";

export type BusinessAssetDetailModel = {
  type: BusinessAssetType;
  id: string;
  title: string;
  eyebrow: string;
  question: string;
  statusLabel: string;
  urgencyLabel: string;
  summary: string;
  primaryAction: {
    label: string;
    href: string;
  };
  secondaryActions: Array<{
    label: string;
    href: string;
  }>;
  metrics: Array<{
    label: string;
    value: string;
  }>;
  judgementChain: BusinessAssetJudgementChain;
  signals: Array<{
    label: string;
    title: string;
    body: string;
    meta: string;
    href?: string;
  }>;
  relationships: Array<{
    label: string;
    value: string;
    description: string;
    href: string;
  }>;
  evidence: Array<{
    title: string;
    body: string;
    meta: string;
    href?: string;
  }>;
  boundary: string;
};

export async function loadBusinessAssetDetailPageData(input: {
  assetType: string;
  assetId: string;
}) {
  const type = normalizeBusinessAssetType(input.assetType);
  if (!type) {
    return null;
  }

  const session = await getCurrentWorkspaceSession();
  const { workspace } = session;
  const requestLocale = await getRequestUiLocaleCandidate();
  const { locale } = normalizeWorkspaceUiConfig({
    ...workspace,
    requestLocale,
    deploymentProfileDefaultLocale:
      getDeploymentProfileDefaultLocaleCandidate(),
  });
  const english = locale === "en-US";
  const labelSets = {
    stages: getLocalizedStageLabels(locale),
    risks: getLocalizedRiskLabels(locale),
    commitments: getLocalizedCommitmentStatusLabels(locale),
    blockers: getLocalizedBlockerStatusLabels(locale),
  };

  const model =
    type === "customer"
      ? await loadCustomerAssetModel({
          workspaceId: workspace.id,
          id: input.assetId,
          english,
          labelSets,
        })
      : type === "opportunity"
        ? await loadOpportunityAssetModel({
            workspaceId: workspace.id,
            id: input.assetId,
            english,
            labelSets,
          })
        : type === "commitment"
          ? await loadCommitmentAssetModel({
              workspaceId: workspace.id,
              id: input.assetId,
              english,
              labelSets,
            })
          : await loadRiskAssetModel({
              workspaceId: workspace.id,
              id: input.assetId,
              english,
              labelSets,
            });

  if (!model) {
    return null;
  }

  return { english, model };
}

type LoaderContext = {
  workspaceId: string;
  id: string;
  english: boolean;
  labelSets: {
    stages: Record<string, string>;
    risks: Record<string, string>;
    commitments: Record<string, string>;
    blockers: Record<string, string>;
  };
};

async function loadCustomerAssetModel({
  workspaceId,
  id,
  english,
  labelSets,
}: LoaderContext): Promise<BusinessAssetDetailModel | null> {
  const company = await db.company.findFirst({
    where: { id, workspaceId },
    include: {
      contacts: { orderBy: { updatedAt: "desc" }, take: 5 },
      opportunities: {
        orderBy: [{ priorityScore: "desc" }, { updatedAt: "desc" }],
        take: 6,
        include: { owner: true },
      },
      meetings: { orderBy: { startsAt: "desc" }, take: 4 },
      commitments: {
        orderBy: [{ overdueFlag: "desc" }, { updatedAt: "desc" }],
        take: 5,
        include: {
          ownerUser: true,
          relatedContact: true,
          relatedOpportunity: true,
          relatedMeeting: true,
        },
      },
      blockers: {
        orderBy: [{ severity: "desc" }, { updatedAt: "desc" }],
        take: 5,
        include: {
          relatedContact: true,
          relatedOpportunity: true,
          relatedMeeting: true,
        },
      },
      memoryEntries: { orderBy: { createdAt: "desc" }, take: 5 },
    },
  });

  if (!company) return null;

  const facts = await loadMemoryFacts(workspaceId, ObjectType.COMPANY, company.id);
  const openBlockers = company.blockers.filter((item) => item.status !== "RESOLVED");
  const openCommitments = company.commitments.filter(
    (item) => item.status !== "FULFILLED" && item.status !== "CANCELED",
  );
  const leadOpportunity = company.opportunities[0] ?? null;
  const leadSignal =
    openBlockers[0]?.title ??
    openCommitments[0]?.title ??
    facts[0]?.title ??
    leadOpportunity?.title ??
    (english ? "No urgent customer signal" : "暂无紧急客户信号");
  const judgement = openBlockers[0]
    ? english
      ? "The account is blocked before it can move faster"
      : "这个客户要先解除阻塞，才能继续加速"
    : openCommitments[0]
      ? english
        ? "The account still depends on an open promise"
        : "这个客户当前主要受未兑现承诺影响"
      : leadOpportunity
        ? english
          ? "The account is still moving through its lead opportunity"
          : "这个客户仍由主机会带动推进"
        : english
          ? "The account needs a concrete next business touch"
          : "这个客户需要一个明确的下一次业务触达";
  const nextAction =
    company.recommendedPath ??
    leadOpportunity?.nextAction ??
    openBlockers[0]?.title ??
    openCommitments[0]?.title ??
    (english ? "Pick one owner and one next customer touch." : "先确定一位负责人和一个下一次客户触达。");

  return {
    type: "customer",
    id: company.id,
    title: company.name,
    eyebrow: formatBusinessAssetTypeLabel("customer", english),
    question: english
      ? "Should this customer move, wait for review, or be de-risked first?"
      : "这个客户今天该继续推进、等待复核，还是先降风险？",
    statusLabel:
      company.cooperationMaturity ??
      (english ? "Needs business judgement" : "待经营判断"),
    urgencyLabel: openBlockers.length
      ? english
        ? `${openBlockers.length} active risk(s)`
        : `${openBlockers.length} 个风险待处理`
      : openCommitments.length
        ? english
          ? `${openCommitments.length} open promise(s)`
          : `${openCommitments.length} 条承诺待兑现`
        : english
          ? "No urgent blocker"
          : "暂无紧急阻塞",
    summary: english
      ? `${company.name} has ${company.opportunities.length} active opportunity candidate(s), ${company.contacts.length} contact(s), and ${facts.length} reusable business memory fact(s).`
      : `${company.name} 现在关联 ${company.opportunities.length} 条机会、${company.contacts.length} 位联系人、${facts.length} 条可复用经营记忆。`,
    primaryAction: {
      label: leadOpportunity
        ? english
          ? "Open lead opportunity"
          : "打开主机会"
        : english
          ? "Open customer record"
          : "打开客户台账",
      href: leadOpportunity
        ? buildOpportunityAssetHref(leadOpportunity.id, "customer-asset")
        : `/companies/${company.id}`,
    },
    secondaryActions: [
      { label: english ? "Open memory" : "查看记忆", href: `/memory?objectType=COMPANY&objectId=${company.id}` },
      { label: english ? "Open customer record" : "打开客户台账", href: `/companies/${company.id}` },
    ],
    metrics: [
      { label: english ? "Opportunities" : "机会", value: String(company.opportunities.length) },
      { label: english ? "Contacts" : "联系人", value: String(company.contacts.length) },
      { label: english ? "Open promises" : "待兑现承诺", value: String(openCommitments.length) },
      { label: english ? "Active risks" : "待处理风险", value: String(openBlockers.length) },
    ],
    judgementChain: buildBusinessAssetJudgementChain({
      english,
      signal: leadSignal,
      judgement,
      action: nextAction,
      needsReview: openBlockers.some((item) => item.severity >= 70),
      learningTarget: english ? "customer memory" : "客户资产记忆",
    }),
    signals: [
      ...openBlockers.map((item) =>
        signalItem({
          label: english ? "Risk" : "风险",
          title: item.title,
          body: item.blockerText,
          meta: labelSets.blockers[item.status] ?? item.status,
          href: buildRiskAssetHref(item.id, "customer-asset"),
        }),
      ),
      ...openCommitments.map((item) =>
        signalItem({
          label: english ? "Promise" : "承诺",
          title: item.title,
          body: item.commitmentText,
          meta: labelSets.commitments[item.status] ?? item.status,
          href: buildCommitmentAssetHref(item.id, "customer-asset"),
        }),
      ),
      ...facts.map((item) =>
        signalItem({
          label: english ? "Memory" : "记忆",
          title: item.title,
          body: item.content,
          meta: `${item.confidence}%`,
        }),
      ),
    ].slice(0, 8),
    relationships: [
      ...company.opportunities.slice(0, 3).map((item) => ({
        label: english ? "Opportunity" : "机会",
        value: item.title,
        description:
          item.nextAction ??
          (english ? "Use this opportunity to judge account momentum." : "用这条机会判断客户推进势能。"),
        href: buildOpportunityAssetHref(item.id, "customer-asset"),
      })),
      ...company.contacts.slice(0, 2).map((item) => ({
        label: english ? "Contact" : "联系人",
        value: item.name,
        description:
          item.title ??
          (english ? "Relationship continuity signal." : "关系连续性信号。"),
        href: `/contacts/${item.id}`,
      })),
    ],
    evidence: [
      ...facts.map((item) => ({
        title: item.title,
        body: item.content,
        meta: `${english ? "Updated" : "更新于"} ${businessAssetDateLabel(item.updatedAt, english)}`,
      })),
      ...company.memoryEntries.map((item) => ({
        title: item.title,
        body: item.content,
        meta: `${english ? "Recorded" : "记录于"} ${businessAssetDateLabel(item.createdAt, english)}`,
      })),
    ].slice(0, 6),
    boundary: standardBoundary(english),
  };
}

async function loadOpportunityAssetModel({
  workspaceId,
  id,
  english,
  labelSets,
}: LoaderContext): Promise<BusinessAssetDetailModel | null> {
  const opportunity = await db.opportunity.findFirst({
    where: { id, workspaceId },
    include: {
      company: true,
      owner: true,
      contacts: { orderBy: { updatedAt: "desc" }, take: 4 },
      meetings: { orderBy: { startsAt: "desc" }, take: 4 },
      commitments: {
        orderBy: [{ overdueFlag: "desc" }, { updatedAt: "desc" }],
        take: 5,
        include: {
          ownerUser: true,
          relatedContact: true,
          relatedCompany: true,
          relatedMeeting: true,
        },
      },
      blockers: {
        orderBy: [{ severity: "desc" }, { updatedAt: "desc" }],
        take: 5,
        include: {
          relatedContact: true,
          relatedCompany: true,
          relatedMeeting: true,
        },
      },
      actionItems: { orderBy: { updatedAt: "desc" }, take: 5 },
      memoryEntries: { orderBy: { createdAt: "desc" }, take: 4 },
    },
  });

  if (!opportunity) return null;

  const facts = await loadMemoryFacts(
    workspaceId,
    ObjectType.OPPORTUNITY,
    opportunity.id,
  );
  const openBlockers = opportunity.blockers.filter((item) => item.status !== "RESOLVED");
  const openCommitments = opportunity.commitments.filter(
    (item) => item.status !== "FULFILLED" && item.status !== "CANCELED",
  );
  const pendingActionCount = opportunity.actionItems.filter((item) =>
    ["PENDING_APPROVAL", "TODO", "IN_PROGRESS"].includes(item.status),
  ).length;
  const leadSignal =
    openBlockers[0]?.title ??
    openCommitments.find((item) => item.overdueFlag)?.title ??
    facts[0]?.title ??
    opportunity.nextAction ??
    (english ? "No strong signal yet" : "暂无强信号");
  const judgement =
    opportunity.riskLevel === "CRITICAL" || opportunity.riskLevel === "HIGH"
      ? english
        ? "The opportunity is in a risk window and should not be pushed blindly"
        : "这条机会处在风险窗口，不能盲目加速"
      : openCommitments.length
        ? english
          ? "The opportunity depends on fulfilling the current promise"
          : "这条机会当前主要取决于承诺是否兑现"
        : english
          ? "The opportunity is still movable if the next step becomes concrete"
          : "只要下一步足够具体，这条机会仍可继续推进";
  const nextAction =
    opportunity.nextAction ??
    openCommitments[0]?.title ??
    openBlockers[0]?.title ??
    (english ? "Confirm one follow-up, owner, and due date." : "确认一个跟进动作、一位负责人和一个截止时间。");

  return {
    type: "opportunity",
    id: opportunity.id,
    title: opportunity.title,
    eyebrow: formatBusinessAssetTypeLabel("opportunity", english),
    question: english
      ? "Should this opportunity be pushed, reviewed, delegated, or cooled down?"
      : "这条机会今天该推进、复核、委派，还是收口降温？",
    statusLabel: `${labelSets.stages[opportunity.stage] ?? opportunity.stage} · ${labelSets.risks[opportunity.riskLevel] ?? opportunity.riskLevel}`,
    urgencyLabel: openBlockers.length
      ? english
        ? `${openBlockers.length} active risk(s)`
        : `${openBlockers.length} 个风险待处理`
      : pendingActionCount
        ? english
          ? `${pendingActionCount} action(s) waiting`
          : `${pendingActionCount} 个动作待处理`
        : english
          ? "No dominant risk"
          : "暂无主导风险",
    summary: english
      ? `${opportunity.company?.name ?? "No linked customer"} · ${opportunity.owner?.name ?? "Unassigned"} · updated ${businessAssetRelativeLabel(opportunity.updatedAt, english)}.`
      : `${opportunity.company?.name ?? "未关联客户"} · ${opportunity.owner?.name ?? "未分配负责人"} · ${formatRelative(opportunity.updatedAt)}更新。`,
    primaryAction: {
      label: english ? "Open handling desk" : "打开处理工作区",
      href: `/opportunities?opportunityId=${opportunity.id}#opportunity-action-workspace`,
    },
    secondaryActions: [
      { label: english ? "Open memory" : "查看记忆", href: `/memory?objectType=OPPORTUNITY&objectId=${opportunity.id}` },
      { label: english ? "Open opportunity board" : "打开机会面", href: `/opportunities?opportunityId=${opportunity.id}` },
    ],
    metrics: [
      { label: english ? "Owner" : "负责人", value: opportunity.owner?.name ?? (english ? "Unassigned" : "未分配") },
      { label: english ? "Due date" : "截止时间", value: businessAssetDateLabel(opportunity.dueDate, english) },
      { label: english ? "Open promises" : "待兑现承诺", value: String(openCommitments.length) },
      { label: english ? "Active risks" : "待处理风险", value: String(openBlockers.length) },
    ],
    judgementChain: buildBusinessAssetJudgementChain({
      english,
      signal: leadSignal,
      judgement,
      action: nextAction,
      needsReview:
        opportunity.riskLevel === "CRITICAL" ||
        opportunity.riskLevel === "HIGH" ||
        openBlockers.some((item) => item.severity >= 70),
      learningTarget: english ? "opportunity memory" : "机会资产记忆",
    }),
    signals: [
      ...openBlockers.map((item) =>
        signalItem({
          label: english ? "Risk" : "风险",
          title: item.title,
          body: item.blockerText,
          meta: labelSets.blockers[item.status] ?? item.status,
          href: buildRiskAssetHref(item.id, "opportunity-asset"),
        }),
      ),
      ...openCommitments.map((item) =>
        signalItem({
          label: english ? "Promise" : "承诺",
          title: item.title,
          body: item.commitmentText,
          meta: labelSets.commitments[item.status] ?? item.status,
          href: buildCommitmentAssetHref(item.id, "opportunity-asset"),
        }),
      ),
      ...facts.map((item) =>
        signalItem({
          label: english ? "Memory" : "记忆",
          title: item.title,
          body: item.content,
          meta: `${item.confidence}%`,
        }),
      ),
    ].slice(0, 8),
    relationships: [
      opportunity.company
        ? {
            label: english ? "Customer" : "客户",
            value: opportunity.company.name,
            description: english
              ? "Open the account-level state behind this opportunity."
              : "查看这条机会背后的客户级状态。",
            href: buildCustomerAssetHref(opportunity.company.id, "opportunity-asset"),
          }
        : undefined,
      ...opportunity.contacts.slice(0, 2).map((item) => ({
        label: english ? "Contact" : "联系人",
        value: item.name,
        description:
          item.title ??
          (english ? "Relationship context for the next move." : "下一步动作的关系上下文。"),
        href: `/contacts/${item.id}`,
      })),
      ...opportunity.meetings.slice(0, 2).map((item) => ({
        label: english ? "Meeting" : "会议",
        value: item.title,
        description: `${english ? "Starts" : "时间"} ${businessAssetDateLabel(item.startsAt, english)}`,
        href: `/meetings/${item.id}`,
      })),
    ].filter((item): item is BusinessAssetDetailModel["relationships"][number] => Boolean(item)),
    evidence: [
      ...facts.map((item) => ({
        title: item.title,
        body: item.content,
        meta: `${english ? "Updated" : "更新于"} ${businessAssetDateLabel(item.updatedAt, english)}`,
      })),
      ...opportunity.memoryEntries.map((item) => ({
        title: item.title,
        body: item.content,
        meta: `${english ? "Recorded" : "记录于"} ${businessAssetDateLabel(item.createdAt, english)}`,
      })),
    ].slice(0, 6),
    boundary: standardBoundary(english),
  };
}

async function loadCommitmentAssetModel({
  workspaceId,
  id,
  english,
  labelSets,
}: LoaderContext): Promise<BusinessAssetDetailModel | null> {
  const commitment = await db.commitment.findFirst({
    where: { id, workspaceId },
    include: {
      ownerUser: true,
      relatedContact: true,
      relatedCompany: true,
      relatedOpportunity: true,
      relatedMeeting: true,
    },
  });

  if (!commitment) return null;

  const relatedObject = commitment.relatedOpportunity
    ? {
        label: english ? "Opportunity" : "机会",
        value: commitment.relatedOpportunity.title,
        href: buildOpportunityAssetHref(commitment.relatedOpportunity.id, "commitment-asset"),
      }
    : commitment.relatedCompany
      ? {
          label: english ? "Customer" : "客户",
          value: commitment.relatedCompany.name,
          href: buildCustomerAssetHref(commitment.relatedCompany.id, "commitment-asset"),
        }
      : commitment.relatedContact
        ? {
            label: english ? "Contact" : "联系人",
            value: commitment.relatedContact.name,
            href: `/contacts/${commitment.relatedContact.id}`,
          }
        : commitment.relatedMeeting
          ? {
              label: english ? "Meeting" : "会议",
              value: commitment.relatedMeeting.title,
              href: `/meetings/${commitment.relatedMeeting.id}`,
            }
          : null;
  const isOpen =
    commitment.status !== "FULFILLED" && commitment.status !== "CANCELED";
  const nextAction = commitment.overdueFlag
    ? english
      ? "Confirm whether this promise can still be fulfilled today."
      : "先确认这条承诺今天还能不能兑现。"
    : isOpen
      ? english
        ? "Keep the promise owner and due date visible until it is closed."
        : "在关闭前，把承诺负责人和截止时间保持可见。"
      : english
        ? "Use this promise as evidence for future judgement."
        : "把这条承诺作为后续判断依据。";

  return {
    type: "commitment",
    id: commitment.id,
    title: commitment.title,
    eyebrow: formatBusinessAssetTypeLabel("commitment", english),
    question: english
      ? "Is this promise fulfilled, overdue, or still shaping the next customer move?"
      : "这条承诺是已兑现、已逾期，还是仍在影响下一步客户动作？",
    statusLabel: labelSets.commitments[commitment.status] ?? commitment.status,
    urgencyLabel: commitment.overdueFlag
      ? english
        ? "Overdue"
        : "已逾期"
      : businessAssetDateLabel(commitment.dueDate, english),
    summary: trimText(commitment.commitmentText, 180),
    primaryAction: {
      label: relatedObject
        ? english
          ? `Open ${relatedObject.label.toLowerCase()}`
          : `打开${relatedObject.label}`
        : english
          ? "Open memory"
          : "查看记忆",
      href: relatedObject?.href ?? "/memory",
    },
    secondaryActions: [
      { label: english ? "Open memory" : "查看记忆", href: "/memory" },
      ...(relatedObject ? [{ label: english ? "Open linked object" : "打开关联对象", href: relatedObject.href }] : []),
    ],
    metrics: [
      { label: english ? "Owner" : "负责人", value: commitment.ownerUser?.name ?? (english ? "Unassigned" : "未分配") },
      { label: english ? "Due date" : "截止时间", value: businessAssetDateLabel(commitment.dueDate, english) },
      { label: english ? "Confidence" : "置信度", value: `${commitment.confidence}%` },
      { label: english ? "Updated" : "最后更新", value: businessAssetRelativeLabel(commitment.updatedAt, english) },
    ],
    judgementChain: buildBusinessAssetJudgementChain({
      english,
      signal: commitment.commitmentText,
      judgement: commitment.overdueFlag
        ? english
          ? "This promise is now a trust risk"
          : "这条承诺现在已经变成信任风险"
        : isOpen
          ? english
            ? "This promise is still shaping the next move"
            : "这条承诺仍在影响下一步推进"
          : english
            ? "This promise can be reused as closed evidence"
            : "这条承诺可作为已关闭证据复用",
      action: nextAction,
      needsReview: commitment.overdueFlag,
      learningTarget: english ? "promise history" : "承诺履约记录",
    }),
    signals: [
      signalItem({
        label: english ? "Promise" : "承诺",
        title: commitment.title,
        body: commitment.commitmentText,
        meta: labelSets.commitments[commitment.status] ?? commitment.status,
      }),
    ],
    relationships: relatedObject
      ? [
          {
            ...relatedObject,
            description: english
              ? "This is the business object currently shaped by the promise."
              : "这是当前被这条承诺影响的经营对象。",
          },
        ]
      : [],
    evidence: [
      {
        title: commitment.title,
        body: commitment.commitmentText,
        meta: `${english ? "Source" : "来源"} ${commitment.sourceType}`,
      },
    ],
    boundary: standardBoundary(english),
  };
}

async function loadRiskAssetModel({
  workspaceId,
  id,
  english,
  labelSets,
}: LoaderContext): Promise<BusinessAssetDetailModel | null> {
  const blocker = await db.blocker.findFirst({
    where: { id, workspaceId },
    include: {
      relatedContact: true,
      relatedCompany: true,
      relatedOpportunity: true,
      relatedMeeting: true,
    },
  });

  if (!blocker) return null;

  const relatedObject = blocker.relatedOpportunity
    ? {
        label: english ? "Opportunity" : "机会",
        value: blocker.relatedOpportunity.title,
        href: buildOpportunityAssetHref(blocker.relatedOpportunity.id, "risk-asset"),
      }
    : blocker.relatedCompany
      ? {
          label: english ? "Customer" : "客户",
          value: blocker.relatedCompany.name,
          href: buildCustomerAssetHref(blocker.relatedCompany.id, "risk-asset"),
        }
      : blocker.relatedContact
        ? {
            label: english ? "Contact" : "联系人",
            value: blocker.relatedContact.name,
            href: `/contacts/${blocker.relatedContact.id}`,
          }
        : blocker.relatedMeeting
          ? {
              label: english ? "Meeting" : "会议",
              value: blocker.relatedMeeting.title,
              href: `/meetings/${blocker.relatedMeeting.id}`,
            }
          : null;
  const nextAction =
    blocker.status === "RESOLVED"
      ? english
        ? "Keep it as evidence and watch whether the same risk returns."
        : "作为证据保留，并观察同类风险是否反复出现。"
      : blocker.severity >= 70
        ? english
          ? "Name the owner, unblock path, and review point before any stronger move."
          : "先明确负责人、解除路径和复核点，再推进更强动作。"
        : english
          ? "Monitor it and decide whether it blocks today's next move."
          : "先持续观察，并判断它是否阻塞今天的下一步。";

  return {
    type: "risk",
    id: blocker.id,
    title: blocker.title,
    eyebrow: formatBusinessAssetTypeLabel("risk", english),
    question: english
      ? "Does this risk block today's move, or only need monitoring?"
      : "这个风险会阻塞今天的动作，还是只需要持续观察？",
    statusLabel: labelSets.blockers[blocker.status] ?? blocker.status,
    urgencyLabel: english ? `Severity ${blocker.severity}` : `压力 ${blocker.severity}`,
    summary: trimText(blocker.blockerText, 180),
    primaryAction: {
      label: relatedObject
        ? english
          ? `Open ${relatedObject.label.toLowerCase()}`
          : `打开${relatedObject.label}`
        : english
          ? "Open memory"
          : "查看记忆",
      href: relatedObject?.href ?? "/memory",
    },
    secondaryActions: [
      { label: english ? "Open memory" : "查看记忆", href: "/memory" },
      ...(relatedObject ? [{ label: english ? "Open linked object" : "打开关联对象", href: relatedObject.href }] : []),
    ],
    metrics: [
      { label: english ? "Status" : "状态", value: labelSets.blockers[blocker.status] ?? blocker.status },
      { label: english ? "Pressure" : "压力", value: String(blocker.severity) },
      { label: english ? "First seen" : "首次出现", value: businessAssetDateLabel(blocker.firstSeenAt, english) },
      { label: english ? "Updated" : "最后更新", value: businessAssetRelativeLabel(blocker.updatedAt, english) },
    ],
    judgementChain: buildBusinessAssetJudgementChain({
      english,
      signal: blocker.blockerText,
      judgement:
        blocker.severity >= 70
          ? english
            ? "This risk can slow or stop the linked business object"
            : "这个风险会拖慢或阻断关联经营对象"
          : english
            ? "This risk is visible but not yet dominant"
            : "这个风险已经可见，但还不是主导压力",
      action: nextAction,
      needsReview: blocker.severity >= 70 && blocker.status !== "RESOLVED",
      learningTarget: english ? "risk history" : "风险处理记录",
    }),
    signals: [
      signalItem({
        label: english ? "Risk" : "风险",
        title: blocker.title,
        body: blocker.blockerText,
        meta: labelSets.blockers[blocker.status] ?? blocker.status,
      }),
    ],
    relationships: relatedObject
      ? [
          {
            ...relatedObject,
            description: english
              ? "This is the business object currently affected by the risk."
              : "这是当前被这个风险影响的经营对象。",
          },
        ]
      : [],
    evidence: [
      {
        title: blocker.title,
        body: blocker.blockerText,
        meta: `${english ? "Source" : "来源"} ${blocker.sourceType}`,
      },
    ],
    boundary: standardBoundary(english),
  };
}

async function loadMemoryFacts(
  workspaceId: string,
  objectType: ObjectType,
  objectId: string,
) {
  return db.memoryFact.findMany({
    where: { workspaceId, objectType, objectId },
    orderBy: [{ importance: "desc" }, { updatedAt: "desc" }],
    take: 6,
  });
}

function signalItem(input: {
  label: string;
  title: string;
  body: string;
  meta: string;
  href?: string;
}) {
  return {
    ...input,
    title: trimText(input.title, 92),
    body: trimText(input.body, 140),
  };
}

function businessAssetDateLabel(
  value: Date | string | null | undefined,
  english: boolean,
) {
  return formatBusinessAssetDateLabel(value, english, formatDateLabel);
}

function businessAssetRelativeLabel(
  value: Date | string | null | undefined,
  english: boolean,
) {
  return formatBusinessAssetRelativeLabel(value, english, formatRelative);
}

function standardBoundary(english: boolean) {
  return english
    ? "This page prepares judgement and drafts. It does not send messages, change external systems, or create customer commitments by itself."
    : "这一页只准备判断和草稿，不会自动外发、改写外部系统，也不会自行形成客户承诺。";
}
