import type {
  ActionStatus,
  ApprovalStatus,
  OpportunityStage,
  OpportunityType,
  RiskLevel,
} from "@prisma/client";
import { opportunityTypeLabels, riskLabels, stageLabels } from "@/data/constants";
import {
  buildHighFrequencyActionTemplateHint,
  getHighFrequencyActionTemplate,
  type HighFrequencyActionTemplateKey,
} from "@/lib/operating-system/action-templates";
import type { GtmCapabilityPlanReadout } from "@/lib/gtm-capability-plan-readout";
import type { InternalCommercializationLifecycleReadout } from "@/lib/internal-commercialization/runtime";

export const internalOperatingRoles = [
  "founder",
  "sales",
  "delivery",
  "customer-success",
  "recruiting",
  "partner",
] as const;

export type InternalOperatingRole = (typeof internalOperatingRoles)[number];

export type InternalOperatingObjectKind =
  | "LEAD"
  | "CUSTOMER"
  | "CANDIDATE"
  | "PARTNER"
  | "WORKSTREAM";

export type InternalAttachment = {
  label: string;
  hint: string;
  href?: string;
};

export type InternalOperatingObjectCard = {
  id: string;
  kind: InternalOperatingObjectKind;
  kindLabel: string;
  title: string;
  subtitle: string;
  stage?: OpportunityStage;
  stageLabel: string;
  riskLabel: string;
  ownerLabel: string;
  currentJudgement: string;
  nextStep: string;
  riskBoundary: string;
  chainRelation: string;
  handoffRole: string;
  href: string;
  recentMeetings: InternalAttachment[];
  keyDecisions: InternalAttachment[];
  nextTasks: InternalAttachment[];
  keyRetros: InternalAttachment[];
  priorityScore: number;
};

export type InternalOperatingSection = {
  id: string;
  title: string;
  summary: string;
  actionLabel: string;
  actionHref: string;
  cards: InternalOperatingObjectCard[];
};

export type InternalOperatingHomeModel = {
  eyebrow: string;
  title: string;
  description: string;
  headline: string;
  summary: string;
  topJudgements: InternalAttachment[];
  topChains: InternalAttachment[];
  topDecisions: InternalAttachment[];
  immediateActions: InternalAttachment[];
  actionTemplates: InternalAttachment[];
  retroFeedback: InternalAttachment[];
  gtmCapabilityPlanReadout?: GtmCapabilityPlanReadout | null;
  internalCommercializationLifecycleReadout?: InternalCommercializationLifecycleReadout | null;
  sections: InternalOperatingSection[];
  roleSurfaces: {
    role: InternalOperatingRole;
    title: string;
    summary: string;
    href: string;
  }[];
};

export type InternalRoleSceneSection = {
  id: string;
  title: string;
  summary: string;
  items: InternalAttachment[];
};

export type InternalRoleSurfaceModel = {
  role: InternalOperatingRole;
  eyebrow: string;
  title: string;
  description: string;
  headline: string;
  summary: string;
  sceneSections: InternalRoleSceneSection[];
  topJudgements: InternalAttachment[];
  topHandoffs: InternalOperatingObjectCard[];
  immediateActions: InternalAttachment[];
  decisionsWaiting: InternalAttachment[];
  blockersToClear: InternalAttachment[];
  nextActions: InternalAttachment[];
  actionTemplates: InternalAttachment[];
  retroFeedback: InternalAttachment[];
  risks: InternalAttachment[];
  evidence: InternalAttachment[];
};

export type InternalOperatingRawOpportunity = {
  id: string;
  title: string;
  description: string | null;
  type: OpportunityType;
  stage: OpportunityStage;
  riskLevel: RiskLevel;
  nextAction: string | null;
  nextStepSummary: string | null;
  priorityScore: number;
  lossReason: string | null;
  company: { id: string; name: string } | null;
  owner: { id: string; name: string | null } | null;
  contacts: Array<{ id: string; name: string }>;
  meetings: Array<{
    id: string;
    title: string;
    startsAt: Date;
    note: {
      summary: string | null;
      keyDecisions: string | null;
    } | null;
  }>;
  actionItems: Array<{
    id: string;
    title: string;
    description: string | null;
    status: ActionStatus;
    approvalTask: {
      id: string;
      status: ApprovalStatus;
    } | null;
  }>;
  memoryEntries: Array<{
    id: string;
    title: string;
    content: string;
    createdAt: Date;
  }>;
};

export type InternalOperatingRawApproval = {
  id: string;
  status: ApprovalStatus;
  actionItem: {
    id: string;
    title: string;
    opportunityId: string | null;
  };
};

export type InternalOperatingRawAudit = {
  id: string;
  actionType: string;
  summary: string;
  targetId: string;
  relatedObjectId: string | null;
};

export type InternalOperatingFoundationInput = {
  opportunities: InternalOperatingRawOpportunity[];
  approvals: InternalOperatingRawApproval[];
  audits: InternalOperatingRawAudit[];
  gtmCapabilityPlanReadout?: GtmCapabilityPlanReadout | null;
  internalCommercializationLifecycleReadout?: InternalCommercializationLifecycleReadout | null;
  english: boolean;
};

function shortText(value: string | null | undefined, fallback: string, max = 88) {
  const text = value?.trim();
  if (!text) return fallback;
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function riskWeight(risk: RiskLevel) {
  switch (risk) {
    case "CRITICAL":
      return 40;
    case "HIGH":
      return 28;
    case "MEDIUM":
      return 14;
    default:
      return 6;
  }
}

function stagePriority(stage: OpportunityStage) {
  switch (stage) {
    case "INTERNAL_SYNC":
      return 18;
    case "WAITING_THEM":
      return 16;
    case "ADVANCING":
      return 14;
    case "CONTACTED":
      return 10;
    case "NEW":
      return 8;
    case "LOST":
      return 2;
    default:
      return 4;
  }
}

function compareByPriority(
  left: { priorityScore?: number },
  right: { priorityScore?: number },
) {
  return (right.priorityScore ?? 0) - (left.priorityScore ?? 0);
}

function roleLabel(role: InternalOperatingRole, english: boolean) {
  const labels = {
    founder: english ? "Founder" : "创始人",
    sales: english ? "Sales" : "销售",
    delivery: english ? "Delivery" : "交付",
    "customer-success": english ? "Customer success" : "客户成功",
    recruiting: english ? "Recruiting" : "招聘",
    partner: english ? "Partner" : "伙伴",
  } as const;
  return labels[role];
}

function titleForRole(role: InternalOperatingRole, english: boolean) {
  const labels = {
    founder: english ? "Founder operating handoff" : "创始人接手面",
    sales: english ? "Sales operating handoff" : "销售接手面",
    delivery: english ? "Delivery operating handoff" : "交付接手面",
    "customer-success": english ? "Customer success handoff" : "客户成功接手面",
    recruiting: english ? "Recruiting handoff" : "招聘接手面",
    partner: english ? "Partner handoff" : "伙伴接手面",
  } as const;
  return labels[role];
}

function summaryForRole(role: InternalOperatingRole, english: boolean) {
  const labels = {
    founder: english
      ? "Focus on strategic decisions, blockers, key accounts, hiring and partner leverage."
      : "集中看战略拍板、关键阻塞、关键客户、关键人才和关键伙伴。",
    sales: english
      ? "Focus on lead movement, follow-up quality, proposal readiness and conversion."
      : "集中看线索推进、跟进质量、方案准备度和转化阻塞。",
    delivery: english
      ? "Focus on walkthroughs, reviews, activation friction and risk clarification."
      : "集中看走查、复核、激活阻力和风险澄清。",
    "customer-success": english
      ? "Focus on follow-through, success checks, issue follow-through and expansion pressure."
      : "集中看客户跟进、成功检查、问题推进和扩展压力。",
    recruiting: english
      ? "Focus on candidate pipeline, role fit, next interview and offer timing."
      : "集中看候选人管线、角色匹配、下一轮面试和录用时机。",
    partner: english
      ? "Focus on partner fit, custom delivery leverage, customer connection and dependency risk."
      : "集中看伙伴匹配、定制交付杠杆、客户连接和依赖风险。",
  } as const;
  return labels[role];
}

function getKindFromOpportunity(
  opportunity: InternalOperatingRawOpportunity,
): InternalOperatingObjectKind | null {
  if (opportunity.type === "CLIENT") {
    return opportunity.stage === "NEW" || opportunity.stage === "CONTACTED"
      ? "LEAD"
      : "CUSTOMER";
  }
  if (opportunity.type === "RECRUITING") return "CANDIDATE";
  if (opportunity.type === "PARTNERSHIP") return "PARTNER";
  return null;
}

function kindLabel(kind: InternalOperatingObjectKind, english: boolean) {
  const labels = {
    LEAD: english ? "Lead" : "线索",
    CUSTOMER: english ? "Customer / Account" : "客户 / 账户",
    CANDIDATE: english ? "Candidate" : "候选人",
    PARTNER: english ? "Partner" : "伙伴",
    WORKSTREAM: english ? "Workstream" : "经营主线",
  } as const;
  return labels[kind];
}

function preferredHref(
  opportunity: InternalOperatingRawOpportunity,
  kind: InternalOperatingObjectKind,
) {
  if (kind === "LEAD") return `/proposals/${opportunity.id}`;
  if (kind === "CUSTOMER") {
    if (opportunity.stage === "WAITING_THEM") return `/customer-success/${opportunity.id}`;
    if (opportunity.stage === "INTERNAL_SYNC") return `/sendability/${opportunity.id}`;
    return `/follow-ups/${opportunity.id}`;
  }
  if (kind === "CANDIDATE") {
    return opportunity.meetings[0]
      ? `/meetings/${opportunity.meetings[0].id}`
      : "/opportunities";
  }
  if (kind === "PARTNER") return `/founder-conversations/${opportunity.id}`;
  return "/dashboard";
}

function defaultBoundary(
  kind: InternalOperatingObjectKind,
  english: boolean,
) {
  const labels = {
    LEAD: english
      ? "External promise and commercial positioning still need sendability and review boundaries."
      : "对外承诺和商业定位仍要先经过可发送检查与人工复核。",
    CUSTOMER: english
      ? "Customer-facing commitments remain bounded by review, sendability and delivery readiness."
      : "面向客户的承诺仍受复核、可发送状态和交付准备度共同约束。",
    CANDIDATE: english
      ? "Candidate-facing tempo should stay aligned with approval, scheduling and offer boundary."
      : "面对候选人的推进节奏仍要受审批、排期和 offer 边界约束。",
    PARTNER: english
      ? "Partner-facing commitments should stay inside founder and delivery alignment."
      : "面对伙伴的承诺仍要收在创始人和交付的统一口径内。",
    WORKSTREAM: english
      ? "This is an operating rhythm lane, not a standalone system of record."
      : "这是一条经营主线，不是另一套独立系统。",
  } as const;
  return labels[kind];
}

function chainRelation(
  kind: InternalOperatingObjectKind,
  english: boolean,
) {
  const labels = {
    LEAD: english
      ? "Connects signup signal, proposal, follow-up and conversion."
      : "串联注册信号、方案推进、后续跟进和转化。",
    CUSTOMER: english
      ? "Connects proposal, offer, review request, customer success and renew path."
      : "串联方案、报价、复核申请、客户成功和续费路径。",
    CANDIDATE: english
      ? "Connects role demand, interview meeting, next interview and offer timing."
      : "串联岗位需求、面试会议、下一轮面试和录用节奏。",
    PARTNER: english
      ? "Connects custom delivery, customer connection and partner dependency."
      : "串联定制交付、客户连接和伙伴依赖。",
    WORKSTREAM: english
      ? "Connects meetings, approvals, tasks and retros back into the operating chain."
      : "把会议、审批、任务和复盘重新挂回经营主线。",
  } as const;
  return labels[kind];
}

function defaultHandoffRole(
  kind: InternalOperatingObjectKind,
  opportunity: InternalOperatingRawOpportunity,
  english: boolean,
) {
  if (kind === "LEAD") return roleLabel("sales", english);
  if (kind === "CUSTOMER") {
    return opportunity.stage === "WAITING_THEM"
      ? roleLabel("customer-success", english)
      : opportunity.stage === "INTERNAL_SYNC"
        ? roleLabel("delivery", english)
        : roleLabel("sales", english);
  }
  if (kind === "CANDIDATE") return roleLabel("recruiting", english);
  if (kind === "PARTNER") return roleLabel("partner", english);
  return roleLabel("founder", english);
}

function buildMeetingAttachments(
  opportunity: InternalOperatingRawOpportunity,
  english: boolean,
) {
  return opportunity.meetings.slice(0, 2).map((meeting) => ({
    label: meeting.title,
    hint:
      shortText(
        meeting.note?.summary ?? meeting.note?.keyDecisions,
        english ? "Recent meeting signal" : "最近会议信号",
        70,
      ),
    href: `/meetings/${meeting.id}`,
  }));
}

function buildDecisionAttachments(
  opportunity: InternalOperatingRawOpportunity,
  audits: InternalOperatingRawAudit[],
  english: boolean,
) {
  const approvalDecisions = opportunity.actionItems
    .filter((item) => item.approvalTask)
    .slice(0, 2)
    .map((item) => ({
      label: item.title,
      hint: item.approvalTask?.status === "PENDING"
        ? english
          ? "Waiting for approval"
          : "等待审批"
        : english
          ? "Approval result captured"
          : "已记录审批结果",
      href: item.approvalTask
        ? `/review-requests/${item.approvalTask.id}`
        : "/approvals",
    }));

  const auditDecisions = audits
    .filter(
      (audit) =>
        audit.targetId === opportunity.id ||
        audit.relatedObjectId === opportunity.id,
    )
    .slice(0, Math.max(0, 2 - approvalDecisions.length))
    .map((audit) => ({
      label: shortText(audit.summary, english ? "Decision trace" : "决策回写", 40),
      hint: shortText(audit.actionType, english ? "Audit trail" : "审计回放", 40),
      href: "/approvals",
    }));

  return [...approvalDecisions, ...auditDecisions];
}

function buildTaskAttachments(
  opportunity: InternalOperatingRawOpportunity,
  english: boolean,
) {
  return opportunity.actionItems.slice(0, 3).map((item) => ({
    label: item.title,
    hint:
      item.status === "PENDING_APPROVAL"
        ? english
          ? "Pending approval"
          : "待审批"
        : item.status === "EXECUTED"
          ? english
            ? "Already executed"
            : "已执行"
          : shortText(item.description, english ? "Next task" : "下一步任务", 48),
    href: item.approvalTask ? `/review-requests/${item.approvalTask.id}` : "/approvals",
  }));
}

function buildRetroAttachments(
  opportunity: InternalOperatingRawOpportunity,
  english: boolean,
) {
  return opportunity.memoryEntries.slice(0, 2).map((entry) => ({
    label: entry.title,
    hint: shortText(entry.content, english ? "Memory and retro trace" : "记忆与复盘依据", 72),
    href: `/memory?objectType=OPPORTUNITY&objectId=${opportunity.id}`,
  }));
}

function buildObjectJudgement(
  opportunity: InternalOperatingRawOpportunity,
  kind: InternalOperatingObjectKind,
  english: boolean,
) {
  if (kind === "LEAD") {
    return english
      ? `${opportunity.title} is still a live lead lane, but it needs a tighter commercial next move before momentum slips.`
      : `${opportunity.title} 仍是一条活跃线索，但现在需要更明确的商业下一步，否则推进节奏会继续变慢。`;
  }
  if (kind === "CUSTOMER") {
    return english
      ? `${opportunity.title} has moved beyond lead discovery and now needs coordinated follow-through across sales, delivery and success.`
      : `${opportunity.title} 已经不只是线索发现，而是进入销售、交付、客户成功共同接力的后续推进阶段。`;
  }
  if (kind === "CANDIDATE") {
    return english
      ? `${opportunity.title} is a live candidate chain and timing discipline matters as much as judgement quality.`
      : `${opportunity.title} 是一条真实候选人推进链，时序纪律和判断质量同样重要。`;
  }
  if (kind === "PARTNER") {
    return english
      ? `${opportunity.title} is a leverage opportunity, but value only materializes if scope, dependency and timing stay explicit.`
      : `${opportunity.title} 是一条杠杆型伙伴机会，但定制范围、依赖条件和时间窗口必须保持清楚。`;
  }
  return english
    ? `${opportunity.title} is the workstream that ties daily coordination back to business judgement.`
    : `${opportunity.title} 是把日常协同重新挂回经营判断的主线。`;
}

function buildObjectCard(
  opportunity: InternalOperatingRawOpportunity,
  kind: InternalOperatingObjectKind,
  audits: InternalOperatingRawAudit[],
  english: boolean,
): InternalOperatingObjectCard {
  const ownerLabel = opportunity.owner?.name ?? (english ? "Unassigned" : "待指派");
  const subtitleParts = [
    opportunity.company?.name,
    opportunityTypeLabels[opportunity.type],
    opportunity.contacts[0]?.name,
  ].filter(Boolean);
  const computedPriority =
    opportunity.priorityScore + riskWeight(opportunity.riskLevel) + stagePriority(opportunity.stage);

  return {
    id: opportunity.id,
    kind,
    kindLabel: kindLabel(kind, english),
    title: opportunity.title,
    subtitle: subtitleParts.join(" / ") || (english ? "Operating object" : "经营对象"),
    stage: opportunity.stage,
    stageLabel: stageLabels[opportunity.stage],
    riskLabel: riskLabels[opportunity.riskLevel],
    ownerLabel,
    currentJudgement: buildObjectJudgement(opportunity, kind, english),
    nextStep: shortText(
      opportunity.nextAction ?? opportunity.nextStepSummary,
      english ? "Clarify the next move and assign the owner." : "先把下一步说清楚，并明确负责人。",
      110,
    ),
    riskBoundary: defaultBoundary(kind, english),
    chainRelation: chainRelation(kind, english),
    handoffRole: defaultHandoffRole(kind, opportunity, english),
    href: preferredHref(opportunity, kind),
    recentMeetings: buildMeetingAttachments(opportunity, english),
    keyDecisions: buildDecisionAttachments(opportunity, audits, english),
    nextTasks: buildTaskAttachments(opportunity, english),
    keyRetros: buildRetroAttachments(opportunity, english),
    priorityScore: computedPriority,
  };
}

function buildWorkstreamCard(
  id: string,
  title: string,
  source: InternalOperatingRawOpportunity[],
  english: boolean,
  href: string,
  owner: string,
  summary: string,
  boundary: string,
) {
  const topSource = [...source].sort((left, right) =>
    compareByPriority(
      { priorityScore: left.priorityScore + riskWeight(left.riskLevel) },
      { priorityScore: right.priorityScore + riskWeight(right.riskLevel) },
    ),
  )[0];

  const meetings = topSource ? buildMeetingAttachments(topSource, english) : [];
  const tasks = topSource ? buildTaskAttachments(topSource, english) : [];
  const retros = topSource ? buildRetroAttachments(topSource, english) : [];

  return {
    id,
    kind: "WORKSTREAM" as const,
    kindLabel: kindLabel("WORKSTREAM", english),
    title,
    subtitle: english
      ? `${source.length} linked objects in the lane`
      : `当前主线下有 ${source.length} 条关联对象`,
    stage: topSource?.stage,
    stageLabel: english ? "Cross-chain lane" : "跨链经营主线",
    riskLabel: riskLabels[
      source.some((item) => item.riskLevel === "CRITICAL")
        ? "CRITICAL"
        : source.some((item) => item.riskLevel === "HIGH")
          ? "HIGH"
          : "MEDIUM"
    ],
    ownerLabel: owner,
    currentJudgement: summary,
    nextStep: topSource?.nextAction
      ? shortText(topSource.nextAction, english ? "Advance the lane owner next move." : "推进这条主线的下一步。")
      : english
        ? "Advance the highest-friction object in this lane."
        : "优先推进这条主线里阻力最大的对象。",
    riskBoundary: boundary,
    chainRelation: chainRelation("WORKSTREAM", english),
    handoffRole: owner,
    href,
    recentMeetings: meetings,
    keyDecisions: tasks.slice(0, 2),
    nextTasks: tasks,
    keyRetros: retros,
    priorityScore:
      source.reduce(
        (sum, item) => sum + item.priorityScore + riskWeight(item.riskLevel),
        0,
      ) + source.length * 2,
  };
}

function sectionSummary(
  label: string,
  cards: InternalOperatingObjectCard[],
  english: boolean,
) {
  if (!cards.length) {
    return english
      ? `${label} is quiet right now.`
      : `${label} 当前没有需要优先收口的对象。`;
  }
  const top = cards[0];
  return english
    ? `${label} is led by ${top.title}. The current handoff sits with ${top.handoffRole}.`
    : `${label} 当前由 ${top.title} 领头推进，接手角色是 ${top.handoffRole}。`;
}

function buildSections(
  objectCards: InternalOperatingObjectCard[],
  workstreamCards: InternalOperatingObjectCard[],
  english: boolean,
) {
  const leads = objectCards
    .filter((card) => card.kind === "LEAD" || card.kind === "CUSTOMER")
    .sort(compareByPriority)
    .slice(0, 3);
  const candidates = objectCards
    .filter((card) => card.kind === "CANDIDATE")
    .sort(compareByPriority)
    .slice(0, 3);
  const partners = objectCards
    .filter((card) => card.kind === "PARTNER")
    .sort(compareByPriority)
    .slice(0, 2);
  const revenueWorkstream = workstreamCards.find((item) => item.id === "workstream-revenue");
  const productWorkstream = workstreamCards.find((item) => item.id === "workstream-product");
  const recruitingWorkstream = workstreamCards.find((item) => item.id === "workstream-recruiting");
  const partnerWorkstream = workstreamCards.find((item) => item.id === "workstream-partner");

  return [
    {
      id: "lead-revenue",
      title: english ? "Leads and revenue movement" : "线索与收入推进",
      summary: sectionSummary(english ? "Lead and revenue lane" : "线索与收入链", leads, english),
      actionLabel: english ? "Open sales handoff" : "去销售接手面",
      actionHref: "/operating/roles/sales",
      cards: revenueWorkstream ? [revenueWorkstream, ...leads.slice(0, 2)] : leads.slice(0, 3),
    },
    {
      id: "product-delivery",
      title: english ? "Product and delivery movement" : "产品与交付推进",
      summary: productWorkstream?.currentJudgement ??
        (english ? "Pull product and delivery tension back into one decision lane." : "把产品与交付分歧收回同一条决策主线。"),
      actionLabel: english ? "Open founder handoff" : "去创始人接手面",
      actionHref: "/operating/roles/founder",
      cards: productWorkstream
        ? [productWorkstream, ...leads.filter((card) => card.stage === "INTERNAL_SYNC").slice(0, 1)]
        : [],
    },
    {
      id: "recruiting-organization",
      title: english ? "Recruiting and organization movement" : "招聘与组织推进",
      summary: sectionSummary(english ? "Hiring lane" : "招聘链", candidates, english),
      actionLabel: english ? "Open recruiting handoff" : "去招聘接手面",
      actionHref: "/operating/roles/recruiting",
      cards: recruitingWorkstream
        ? [recruitingWorkstream, ...candidates.slice(0, 2)]
        : candidates.slice(0, 3),
    },
    {
      id: "partner-custom",
      title: english ? "Partners and custom delivery" : "伙伴与定制交付推进",
      summary: sectionSummary(english ? "Partner lane" : "伙伴链", partners, english),
      actionLabel: english ? "Open partner handoff" : "去伙伴接手面",
      actionHref: "/operating/roles/partner",
      cards: partnerWorkstream ? [partnerWorkstream, ...partners.slice(0, 1)] : partners,
    },
  ].filter((section) => section.cards.length > 0);
}

function buildRoleSurfaceEntries(english: boolean) {
  return internalOperatingRoles.map((role) => ({
    role,
    title: titleForRole(role, english),
    summary: summaryForRole(role, english),
    href: `/operating/roles/${role}`,
  }));
}

function attachmentFromCard(
  card: InternalOperatingObjectCard,
  hint?: string,
): InternalAttachment {
  return {
    label: card.title,
    hint: hint ?? card.currentJudgement,
    href: card.href,
  };
}

function variantRouteAttachments(
  cards: InternalOperatingObjectCard[],
  routePrefix: string,
  hintBuilder: (card: InternalOperatingObjectCard) => string,
): InternalAttachment[] {
  return cards
    .filter((card) => card.kind !== "WORKSTREAM")
    .slice(0, 3)
    .map((card) => ({
      label: card.title,
      hint: hintBuilder(card),
      href: `${routePrefix}/${card.id}`,
    }));
}

function compactCards(
  cards: Array<InternalOperatingObjectCard | undefined>,
): InternalOperatingObjectCard[] {
  return cards.filter(
    (card): card is InternalOperatingObjectCard => Boolean(card),
  );
}

function withFallbackAttachments(
  primary: InternalAttachment[],
  fallback: InternalAttachment[],
) {
  return primary.length > 0 ? primary : fallback;
}

function buildActionTemplateAttachments(
  keys: HighFrequencyActionTemplateKey[],
  english: boolean,
) {
  return keys
    .map((key) => getHighFrequencyActionTemplate(key, english))
    .filter((template): template is NonNullable<typeof template> => Boolean(template))
    .map((template) => ({
      label: template.title,
      hint: buildHighFrequencyActionTemplateHint(template, english),
      href: template.href,
    }));
}

function roleActionTemplateKeys(
  role: InternalOperatingRole,
): HighFrequencyActionTemplateKey[] {
  if (role === "founder") {
    return ["review-request", "proposal-offer-next-step", "next-meeting"];
  }
  if (role === "sales") {
    return ["follow-up", "proposal-offer-next-step", "review-request"];
  }
  if (role === "delivery") {
    return ["next-meeting", "review-request", "proposal-offer-next-step"];
  }
  if (role === "customer-success") {
    return ["escalation", "review-request", "follow-up"];
  }
  if (role === "recruiting") {
    return ["recruiting-next-step", "next-meeting", "review-request"];
  }
  return ["partner-follow-through", "review-request", "next-meeting"];
}

function sceneSection(
  id: string,
  title: string,
  summary: string,
  items: InternalAttachment[],
): InternalRoleSceneSection {
  return {
    id,
    title,
    summary,
    items: items.slice(0, 3),
  };
}

function roleHeadline(role: InternalOperatingRole, english: boolean) {
  const labels = {
    founder: english
      ? "Founder should decide the operating shape of the week, not manually inspect every object."
      : "创始人现在最该决定的是这周的经营形状，而不是手动检查每一条对象。",
    sales: english
      ? "Sales should move live leads, follow-ups and conversion blockers without re-reading the whole workspace."
      : "销售现在最该推进的是活跃线索、后续跟进和转化阻塞，而不是重新读完整个工作区。",
    delivery: english
      ? "Delivery should reduce activation friction, walkthrough risk and package ambiguity before momentum slips."
      : "交付现在最该做的是在机会掉温前收掉激活阻力、走查风险和方案歧义。",
    "customer-success": english
      ? "Customer success should keep follow-through, expansion and issue pressure on one visible line."
      : "客户成功现在最该把后续推进、扩展机会和问题压力收在同一条线上。",
    recruiting: english
      ? "Recruiting should keep candidate fit, interview timing and offer readiness on one disciplined chain."
      : "招聘现在最该把候选人匹配度、面试节奏和 offer 就绪度收在同一条纪律链上。",
    partner: english
      ? "Partner work should stay grounded in fit, customer matching, custom scope and dependency risk."
      : "伙伴合作现在最该把匹配度、客户匹配、定制范围和依赖风险摆到台前。",
  } as const;

  return labels[role];
}

function roleSummary(role: InternalOperatingRole, english: boolean) {
  const labels = {
    founder: english
      ? "Use this surface to keep strategic focus, key decisions, blockers, top customer movement, hiring need and partner leverage on one founder-ready brief."
      : "这张接手面把战略焦点、关键拍板、阻塞、重点客户、关键招聘需求和伙伴杠杆收成一张创始人简报。",
    sales: english
      ? "Use this surface to keep top leads, follow-ups, proposal / offer moves, objections and conversion blockers in one sales tempo."
      : "这张接手面把重点线索、后续跟进、方案 / 报价动作、异议和转化阻塞收成一条销售节奏。",
    delivery: english
      ? "Use this surface to keep walkthroughs, activation, package clarification and risk clarification visible before customer-facing work drifts."
      : "这张接手面把走查、激活推进、范围澄清和风险澄清提前摆到台前，避免客户侧推进飘掉。",
    "customer-success": english
      ? "Use this surface to keep success follow-through, expansion review and issue follow-through moving without hunting across queues."
      : "这张接手面把客户跟进、扩展机会复核和问题跟进收在一起，不需要到处翻队列。",
    recruiting: english
      ? "Use this surface to keep candidate fit, next interview timing and offer readiness on one recruiting picture."
      : "这张接手面把候选人匹配度、下一轮面试节奏和 offer 就绪度收成一张招聘总图。",
    partner: english
      ? "Use this surface to keep partner fit, custom delivery leverage, customer matching and dependency risk visible in one place."
      : "这张接手面把伙伴匹配度、定制交付杠杆、客户匹配和依赖风险放在同一处。",
  } as const;

  return labels[role];
}

function buildRoleSceneSections(
  role: InternalOperatingRole,
  objects: InternalOperatingObjectCard[],
  workstreams: InternalOperatingObjectCard[],
  selected: InternalOperatingObjectCard[],
  english: boolean,
) {
  const customers = objects
    .filter((item) => item.kind === "CUSTOMER" || item.kind === "LEAD")
    .sort(compareByPriority);
  const candidates = objects
    .filter((item) => item.kind === "CANDIDATE")
    .sort(compareByPriority);
  const partners = objects
    .filter((item) => item.kind === "PARTNER")
    .sort(compareByPriority);
  const productLane = workstreams.find((item) => item.id === "workstream-product");
  const revenueLane = workstreams.find((item) => item.id === "workstream-revenue");
  const recruitingLane = workstreams.find((item) => item.id === "workstream-recruiting");
  const partnerLane = workstreams.find((item) => item.id === "workstream-partner");

  if (role === "founder") {
    return [
      sceneSection(
        "strategic-focus",
        english ? "Strategic focus" : "本周经营焦点",
        english
          ? "Keep product, revenue and internal pacing on one shared founder line."
          : "把产品、收入和内部节奏收回同一条创始人主线。",
        compactCards([productLane ?? revenueLane]).map((item) =>
          attachmentFromCard(item, item.currentJudgement),
        ),
      ),
      sceneSection(
        "key-decision",
        english ? "Key decision" : "关键拍板",
        english
          ? "These are the moves that still need founder-level decision shape."
          : "这些动作仍需要创始人级别的拍板。",
        withFallbackAttachments(
          selected.flatMap((item) => item.keyDecisions).slice(0, 3),
          selected.slice(0, 2).map((item) => attachmentFromCard(item, item.nextStep)),
        ),
      ),
      sceneSection(
        "blockage-review",
        english ? "Blockage review" : "阻塞复核",
        english
          ? "High-risk blockers should be explicit before they spread into more lanes."
          : "高风险阻塞要先说清楚，避免继续扩散到更多主线。",
        withFallbackAttachments(
          selected
            .filter(
              (item) =>
                item.riskLabel === riskLabels.HIGH ||
                item.riskLabel === riskLabels.CRITICAL,
            )
            .map((item) => attachmentFromCard(item, item.riskBoundary)),
          selected.slice(0, 2).map((item) => attachmentFromCard(item, item.riskBoundary)),
        ),
      ),
      sceneSection(
        "top-customer",
        english ? "Top customer" : "重点客户",
        english
          ? "Keep the highest-leverage customer chain close to the founder line."
          : "把杠杆最高的客户链保持在创始人视野里。",
        customers.slice(0, 2).map((item) => attachmentFromCard(item)),
      ),
      sceneSection(
        "top-hiring-need",
        english ? "Top hiring need" : "关键招聘需求",
        english
          ? "Hiring pressure should stay visible when it changes delivery or product pace."
          : "会影响交付和产品节奏的招聘压力必须保持可见。",
        compactCards([recruitingLane, ...candidates.slice(0, 1)])
          .map((item) => attachmentFromCard(item)),
      ),
      sceneSection(
        "top-partner-move",
        english ? "Top partner move" : "重点伙伴动作",
        english
          ? "Partner leverage matters only when the next move stays explicit."
          : "伙伴杠杆只有在下一步保持显式时才有价值。",
        compactCards([partnerLane, ...partners.slice(0, 1)])
          .map((item) => attachmentFromCard(item)),
      ),
      sceneSection(
        "founder-qa-variants",
        english ? "Founder Q&A variants" : "创始人答疑场景",
        english
          ? "Open the thinner founder Q&A detail when the current item needs why-now, scope, customer value, boundary, objection-style framing, or review-before-send preparation."
          : "当当前事项需要解释为什么是现在、客户价值、范围、边界、异议回应或发送前准备时，直接打开创始人答疑场景。",
        variantRouteAttachments(selected, "/founder-qa", (item) =>
          english
            ? `Use founder Q&A to clarify strategic question, scope, boundary, review-before-send, and internal-only prep around ${item.title}.`
            : `用创始人答疑场景收细 ${item.title} 的战略问题、范围、边界、发送前准备和仅内部可见说明。`,
        ),
      ),
    ].filter((section) => section.items.length > 0);
  }

  if (role === "sales") {
    return [
      sceneSection(
        "top-leads",
        english ? "Top leads" : "重点线索",
        english
          ? "These are the lead lanes most likely to convert if moved now."
          : "这些线索是现在最值得推进、最可能转化的对象。",
        withFallbackAttachments(
          customers
            .filter((item) => item.kind === "LEAD")
            .slice(0, 3)
            .map((item) => attachmentFromCard(item)),
          customers.slice(0, 3).map((item) => attachmentFromCard(item)),
        ),
      ),
      sceneSection(
        "top-followups",
        english ? "Top follow-ups" : "重点跟进",
        english
          ? "Follow-up quality matters because missed next steps kill conversion tempo."
          : "跟进质量决定转化节奏，错过下一步最容易让链路冷掉。",
        selected.map((item) => attachmentFromCard(item, item.nextStep)),
      ),
      sceneSection(
        "top-proposal-offer-moves",
        english ? "Top proposal / offer moves" : "重点方案 / 报价动作",
        english
          ? "Commercial next moves should keep proposal, offer and sendability on one line."
          : "商业下一步要把方案、报价和可发送状态收在同一条线上。",
        customers
          .filter(
            (item) =>
              item.stage === "ADVANCING" || item.stage === "INTERNAL_SYNC",
          )
          .slice(0, 3)
          .map((item) => attachmentFromCard(item, item.chainRelation)),
      ),
      sceneSection(
        "top-objection-clarification",
        english ? "Top objection / clarification" : "重点异议澄清",
        english
          ? "Clarify objections before the lead chain stalls into waiting mode."
          : "在线索彻底进入等待状态之前，先把异议和澄清点摆清楚。",
        withFallbackAttachments(
          customers
            .filter(
              (item) =>
                item.stage === "WAITING_THEM" ||
                item.riskLabel === riskLabels.HIGH ||
                item.riskLabel === riskLabels.CRITICAL,
            )
            .slice(0, 3)
            .map((item) => attachmentFromCard(item, item.riskBoundary)),
          selected.slice(0, 2).map((item) => attachmentFromCard(item, item.riskBoundary)),
        ),
      ),
      sceneSection(
        "top-conversion-blockers",
        english ? "Top conversion blockers" : "重点转化阻塞",
        english
          ? "These blockers are the ones most likely to slow conversion this week."
          : "这些是最可能拖慢本周转化的关键阻塞。",
        withFallbackAttachments(
          compactCards([revenueLane, ...customers])
            .filter(
              (item) =>
                item.riskLabel === riskLabels.HIGH ||
                item.riskLabel === riskLabels.CRITICAL,
            )
            .slice(0, 3)
            .map((item) => attachmentFromCard(item, item.riskBoundary)),
          compactCards([revenueLane, ...selected])
            .slice(0, 3)
            .map((item) => attachmentFromCard(item, item.riskBoundary)),
        ),
      ),
      sceneSection(
        "sales-followup-variants",
        english ? "Sales follow-up variants" : "销售跟进场景",
        english
          ? "Go directly into the thinner follow-up detail for post-first-contact, post-demo, review-before-send, and non-commitment-safe progression."
          : "直接进入更细的销售跟进场景，处理初次接触后、演示后、发送前复核和“不是承诺”的推进表达。",
        variantRouteAttachments(customers, "/sales-followups", (item) =>
          english
            ? `Use sales follow-up variants to shape the next external move for ${item.title} without losing prerequisite, dependency, or non-commitment clarity.`
            : `用销售跟进场景收细 ${item.title} 的对外下一步，同时不丢前提、依赖和“不是承诺”的边界。`,
        ),
      ),
      sceneSection(
        "sales-objection-variants",
        english ? "Sales objection variants" : "销售异议处理场景",
        english
          ? "Open objection detail when the chain needs objection reply, proposal clarification, boundary clarification, or internal-only prep before the next send."
          : "当链路需要回应异议、解释方案、澄清边界或做仅内部准备时，直接打开销售异议处理场景。",
        variantRouteAttachments(customers, "/sales-objections", (item) =>
          english
            ? `Use sales objection variants to clarify objection, prerequisite, dependency, and review-before-send posture for ${item.title}.`
            : `用销售异议处理场景收细 ${item.title} 的异议、前提、依赖与发送前复核状态。`,
        ),
      ),
    ].filter((section) => section.items.length > 0);
  }

  if (role === "delivery") {
    return [
      sceneSection(
        "walkthrough",
        english ? "Walkthrough" : "客户走查",
        english
          ? "Recent customer-facing meetings should feed directly back into delivery judgement."
          : "最近的客户侧会议必须直接回写到交付判断里。",
        withFallbackAttachments(
          selected
            .flatMap((item) => item.recentMeetings)
            .slice(0, 3),
          selected.slice(0, 2).map((item) => attachmentFromCard(item)),
        ),
      ),
      sceneSection(
        "activation",
        english ? "Activation" : "激活推进",
        english
          ? "Activation pressure lives where customer momentum meets internal readiness."
          : "激活压力通常出现在客户推进热度和内部准备度的交界处。",
        withFallbackAttachments(
          customers
            .filter((item) => item.stage === "ADVANCING")
            .slice(0, 3)
            .map((item) => attachmentFromCard(item)),
          selected.slice(0, 3).map((item) => attachmentFromCard(item)),
        ),
      ),
      sceneSection(
        "proposal-review",
        english ? "Proposal review" : "方案复核",
        english
          ? "Proposal review should reduce ambiguity before delivery inherits the chain."
          : "方案复核的作用是先把歧义收掉，再让交付真正接手。",
        selected
          .flatMap((item) => item.keyDecisions)
          .slice(0, 3),
      ),
      sceneSection(
        "package-clarification",
        english ? "Package clarification" : "范围澄清",
        english
          ? "Clarify package edges where delivery readiness and commercial promise may drift apart."
          : "在交付准备度和商业承诺可能分叉的地方，先把范围边界摆清楚。",
        withFallbackAttachments(
          customers
            .filter((item) => item.stage === "INTERNAL_SYNC")
            .slice(0, 3)
            .map((item) => attachmentFromCard(item, item.chainRelation)),
          selected.slice(0, 3).map((item) => attachmentFromCard(item, item.chainRelation)),
        ),
      ),
      sceneSection(
        "risk-clarification",
        english ? "Risk clarification" : "风险澄清",
        english
          ? "High-risk objects need explicit clarification before delivery pushes ahead."
          : "高风险对象必须先完成澄清，交付才能继续向前推。",
        withFallbackAttachments(
          selected
            .filter(
              (item) =>
                item.riskLabel === riskLabels.HIGH ||
                item.riskLabel === riskLabels.CRITICAL,
            )
            .map((item) => attachmentFromCard(item, item.riskBoundary)),
          selected.slice(0, 2).map((item) => attachmentFromCard(item, item.riskBoundary)),
        ),
      ),
      sceneSection(
        "next-step-delivery-move",
        english ? "Next-step delivery move" : "下一步交付动作",
        english
          ? "These are the delivery moves that should happen next, not later."
          : "这些是交付现在就该做、而不是以后再看的动作。",
        selected.map((item) => attachmentFromCard(item, item.nextStep)),
      ),
      sceneSection(
        "delivery-walkthrough-variants",
        english ? "Delivery walkthrough variants" : "交付走查场景",
        english
          ? "Open walkthrough detail when onboarding, activation confirmation, boundary explanation, or internal-only prep needs a thinner delivery-specific layer."
          : "当入门走查、激活确认、边界解释或仅内部准备需要更细的交付层时，直接打开交付走查场景。",
        variantRouteAttachments(selected, "/delivery-walkthroughs", (item) =>
          english
            ? `Use delivery walkthrough variants to guide onboarding, activation confirmation, and next-step framing for ${item.title}.`
            : `用交付走查场景收细 ${item.title} 的入门走查、激活确认和下一步表述。`,
        ),
      ),
      sceneSection(
        "delivery-review-variants",
        english ? "Delivery review variants" : "交付复核场景",
        english
          ? "Open review detail when proposal review, package clarification, risk clarification, or review-before-send needs a thinner delivery review layer."
          : "当方案复核、范围澄清、风险澄清或发送前复核需要更细的交付复核层时，直接打开交付复核场景。",
        variantRouteAttachments(selected, "/delivery-reviews", (item) =>
          english
            ? `Use delivery review variants to clarify package, risk, boundary, and review posture for ${item.title}.`
            : `用交付复核场景收细 ${item.title} 的范围、风险、边界与复核状态。`,
        ),
      ),
    ].filter((section) => section.items.length > 0);
  }

  if (role === "customer-success") {
    return [
      sceneSection(
        "success-follow-through",
        english ? "Success follow-through" : "客户跟进推进",
        english
          ? "Customer success starts from disciplined follow-through, not from queue reading."
          : "客户成功的起点应该是有纪律的后续推进，而不是读队列。",
        selected.map((item) => attachmentFromCard(item, item.nextStep)),
      ),
      sceneSection(
        "expansion-review",
        english ? "Expansion review" : "扩展机会复核",
        english
          ? "Keep expansion pressure visible where customer momentum is already strong."
          : "在客户热度已经形成的地方，把扩展压力清楚摆出来。",
        withFallbackAttachments(
          customers
            .filter((item) => item.stage === "ADVANCING" || item.stage === "WAITING_THEM")
            .slice(0, 3)
            .map((item) => attachmentFromCard(item, item.chainRelation)),
          selected.slice(0, 3).map((item) => attachmentFromCard(item, item.chainRelation)),
        ),
      ),
      sceneSection(
        "issue-follow-through",
        english ? "Issue follow-through" : "问题跟进",
        english
          ? "Issue pressure should stay explicit before it degrades trust or renewal tempo."
          : "问题压力必须保持清楚，避免继续伤害客户信任和续费节奏。",
        withFallbackAttachments(
          selected
            .filter(
              (item) =>
                item.riskLabel === riskLabels.HIGH ||
                item.riskLabel === riskLabels.CRITICAL,
            )
            .map((item) => attachmentFromCard(item, item.riskBoundary)),
          selected.slice(0, 2).map((item) => attachmentFromCard(item, item.riskBoundary)),
        ),
      ),
      sceneSection(
        "customer-success-issue-escalation-variants",
        english
          ? "Customer success issue / escalation variants"
          : "客户成功问题 / 升级场景",
        english
          ? "Open the customer success handoff detail when follow-through pressure splits into issue repair, escalation, boundary-only response, or internal-only success prep."
          : "当后续推进压力分成问题修复、升级处理、仅说明边界或仅内部准备时，直接打开客户成功处理场景。",
        variantRouteAttachments(selected, "/customer-success", (item) =>
          english
            ? `Use customer success handoff to distinguish issue follow-through, escalation, review-before-send, and boundary-only response for ${item.title}.`
            : `用客户成功处理场景区分 ${item.title} 的问题跟进、升级处理、发送前复核与仅说明边界。`,
        ),
      ),
      sceneSection(
        "success-issue-variants",
        english ? "Success issue variants" : "客户问题处理场景",
        english
          ? "Open customer success handoff detail when the next move must distinguish blocked issue resolution, customer-visible clarification, review-before-send response, or internal-only issue prep."
          : "当下一步必须区分问题卡住、面向客户的解释、发送前复核回复或仅内部问题准备时，直接打开客户问题处理场景。",
        variantRouteAttachments(selected, "/customer-success", (item) =>
          english
            ? `Use customer success handoff to separate success issue follow-through, blocked issue resolution, customer-visible clarification, and boundary-only response for ${item.title}.`
            : `用客户问题处理场景收细 ${item.title} 的问题跟进、卡住的问题处理、面向客户的解释与仅说明边界。`,
        ),
      ),
      sceneSection(
        "escalation-variants",
        english ? "Escalation variants" : "升级处理场景",
        english
          ? "Open customer success handoff detail when issue pressure widens into founder-escalated, sales-escalated, delivery-escalated, dependency-blocked, or boundary-blocked escalation handling."
          : "当问题压力扩大成创始人升级、销售升级、交付升级、依赖阻塞或边界阻塞时，直接打开升级处理场景。",
        variantRouteAttachments(selected, "/customer-success", (item) =>
          english
            ? `Use customer success handoff to distinguish escalation-triggered follow-through, founder / sales / delivery escalations, and blocked escalation posture for ${item.title}.`
            : `用升级处理场景区分 ${item.title} 的升级触发跟进、创始人 / 销售 / 交付升级与受阻升级状态。`,
        ),
      ),
      sceneSection(
        "success-check-variants",
        english ? "Success check variants" : "成功复盘场景",
        english
          ? "Open success check detail when follow-through is stabilizing and the next move needs customer-safe confirmation instead of widened escalation."
          : "当后续推进开始稳定、下一步需要对客户安全的确认而不是继续升级时，直接打开成功复盘场景。",
        variantRouteAttachments(selected, "/success-checks", (item) =>
          english
            ? `Use success check detail to keep ${item.title} moving with disciplined follow-through and review-before-send-safe success wording.`
            : `用成功复盘场景让 ${item.title} 继续前进，同时保留有纪律的跟进和发送前复核的安全表达。`,
        ),
      ),
      sceneSection(
        "renewal-expansion-risk-variants",
        english
          ? "Renewal / expansion risk variants"
          : "续费 / 扩展风险场景",
        english
          ? "Open success check or expansion review when renewal risk clarification, blocked expansion, or non-commitment fallback needs a thinner customer-success-specific layer."
          : "当续费风险澄清、扩展受阻或“不是承诺”的兜底表达需要更细层时，直接打开成功复盘或扩展机会复核。",
        [
          ...variantRouteAttachments(selected, "/success-checks", (item) =>
            english
              ? `Use success check detail to keep renewal risk clarification and disciplined follow-through explicit for ${item.title}.`
              : `用成功复盘场景收细 ${item.title} 的续费风险澄清与有纪律的后续推进。`,
          ),
          ...variantRouteAttachments(selected, "/expansion-reviews", (item) =>
            english
              ? `Use expansion review detail to separate blocked expansion, review-before-send expansion clarification, and non-commitment fallback for ${item.title}.`
              : `用扩展机会复核区分 ${item.title} 的扩展受阻、发送前复核的扩展解释与“不是承诺”的兜底表达。`,
          ),
        ],
      ),
      sceneSection(
        "expansion-review-variants",
        english ? "Expansion review variants" : "扩展机会复核场景",
        english
          ? "Open expansion review detail when blocked expansion, renewal risk clarification, or widened commercial pressure needs a thinner success-specific layer."
          : "当扩展受阻、续费风险澄清或更宽的商业压力需要客户成功专项处理时，直接打开扩展机会复核场景。",
        variantRouteAttachments(selected, "/expansion-reviews", (item) =>
          english
            ? `Use expansion review detail to clarify blocked expansion, renewal risk, and next-step ownership for ${item.title}.`
            : `用扩展机会复核场景收细 ${item.title} 的扩展受阻、续费风险和下一步负责人。`,
        ),
      ),
    ].filter((section) => section.items.length > 0);
  }

  if (role === "recruiting") {
    return [
      sceneSection(
      "candidate-fit",
      english ? "Candidate fit" : "候选人匹配度",
        english
          ? "Fit judgement should stay visible before the team over-commits interview time."
          : "在团队继续投入面试时间前，候选人匹配度判断必须保持清楚。",
        candidates.slice(0, 3).map((item) => attachmentFromCard(item)),
      ),
      sceneSection(
      "next-interview",
      english ? "Next interview" : "下一轮面试",
        english
          ? "Interview timing should stay concrete, not implied."
          : "面试时间窗口要保持具体，而不是停留在暗示里。",
        [
          ...selected.flatMap((item) => item.recentMeetings),
          ...selected.map((item) => attachmentFromCard(item, item.nextStep)),
        ].slice(0, 3),
      ),
      sceneSection(
      "offer-readiness",
      english ? "Offer readiness" : "录用就绪度",
        english
          ? "Offer readiness depends on disciplined next steps, not just positive sentiment."
          : "录用就绪度取决于有纪律的下一步，不只是情绪上感觉不错。",
        compactCards([recruitingLane, ...candidates])
          .slice(0, 3)
          .map((item) => attachmentFromCard(item, item.nextStep)),
      ),
    ].filter((section) => section.items.length > 0);
  }

  return [
    sceneSection(
      "partner-fit",
      english ? "Partner fit" : "伙伴匹配度",
      english
        ? "Partner fit should stay grounded in capability and concrete leverage."
        : "伙伴匹配必须落在真实能力和明确杠杆上。",
      partners.slice(0, 3).map((item) => attachmentFromCard(item)),
    ),
    sceneSection(
      "custom-delivery",
      english ? "Custom delivery" : "定制交付",
      english
        ? "Custom delivery leverage matters only when scope stays explicit."
        : "定制交付只有在范围清楚时才会形成真正杠杆。",
      compactCards([partnerLane, ...partners])
        .slice(0, 3)
        .map((item) => attachmentFromCard(item, item.chainRelation)),
    ),
    sceneSection(
      "customer-matching",
      english ? "Customer matching" : "客户匹配",
      english
        ? "Partner value compounds when the customer matching path is explicit."
        : "只有客户匹配路径清楚，伙伴价值才会真正累积。",
      [...partners, ...customers]
        .slice(0, 3)
        .map((item) => attachmentFromCard(item, item.nextStep)),
    ),
    sceneSection(
      "dependency-risk",
      english ? "Dependency risk" : "依赖风险",
      english
        ? "Dependency risk should stay visible before the team over-commits partner-facing promises."
        : "在团队继续对外承诺前，依赖风险必须保持清楚。",
      withFallbackAttachments(
        compactCards([partnerLane, ...partners])
          .filter(
            (item) =>
              item.riskLabel === riskLabels.HIGH ||
              item.riskLabel === riskLabels.CRITICAL,
          )
          .slice(0, 3)
          .map((item) => attachmentFromCard(item, item.riskBoundary)),
        compactCards([partnerLane, ...partners])
          .slice(0, 2)
            .map((item) => attachmentFromCard(item, item.riskBoundary)),
        ),
      ),
    ].filter((section) => section.items.length > 0);
  }

export function buildInternalOperatingHomeModel({
  opportunities,
  approvals,
  audits,
  gtmCapabilityPlanReadout,
  internalCommercializationLifecycleReadout,
  english,
}: InternalOperatingFoundationInput): InternalOperatingHomeModel {
  const objectCards = opportunities
    .map((opportunity) => {
      const kind = getKindFromOpportunity(opportunity);
      return kind ? buildObjectCard(opportunity, kind, audits, english) : null;
    })
    .filter((item): item is InternalOperatingObjectCard => Boolean(item))
    .sort(compareByPriority);

  const clientOpportunities = opportunities.filter((item) => item.type === "CLIENT");
  const recruitingOpportunities = opportunities.filter((item) => item.type === "RECRUITING");
  const partnerOpportunities = opportunities.filter((item) => item.type === "PARTNERSHIP");
  const internalOpportunities = opportunities.filter((item) => item.type === "INTERNAL");

  const workstreamCards = [
    buildWorkstreamCard(
      "workstream-revenue",
      english ? "Revenue operating workstream" : "收入推进主线",
      clientOpportunities.filter((item) => item.stage !== "LOST" && item.stage !== "DONE"),
      english,
      "/operating/roles/sales",
      roleLabel("sales", english),
      english
        ? "Revenue work is no longer just a pipeline list. It needs proposals, follow-up, sendability and renew cues to stay on one line."
        : "收入推进不能只看管道列表，还要把方案、跟进、可发送边界和续费信号放在同一条线上。",
      english
        ? "External commitment stays bounded by sendability, review request and payment readiness."
        : "对外承诺仍然受可发送状态、复核请求和支付准备度共同约束。",
    ),
    buildWorkstreamCard(
      "workstream-product",
      english ? "Product and delivery workstream" : "产品与交付主线",
      internalOpportunities.length
        ? internalOpportunities
        : clientOpportunities.filter((item) => item.stage === "INTERNAL_SYNC"),
      english,
      "/operating/roles/founder",
      roleLabel("founder", english),
      english
        ? "Product rhythm matters because it shapes what the team can safely promise, deliver and learn from."
        : "产品节奏会直接决定团队现在能安全承诺什么、交付什么、学到什么。",
      english
        ? "This lane should stay decision-first and must not drift into a standalone PM platform."
        : "这条主线必须先服务经营判断，不能滑成另一套项目管理平台。",
    ),
    buildWorkstreamCard(
      "workstream-recruiting",
      english ? "Recruiting workstream" : "招聘推进主线",
      recruitingOpportunities.filter((item) => item.stage !== "LOST" && item.stage !== "DONE"),
      english,
      "/operating/roles/recruiting",
      roleLabel("recruiting", english),
      english
        ? "Hiring movement depends on interview timing, role fit and disciplined follow-through."
        : "招聘推进的成败取决于面试节奏、角色匹配和有纪律的后续推进。",
      english
        ? "Candidate-facing tempo must stay explicit and should not become uncontrolled outreach."
        : "候选人侧节奏必须保持清楚，不能变成不受控的外部联系。",
    ),
    buildWorkstreamCard(
      "workstream-partner",
      english ? "Partner and custom workstream" : "伙伴与定制交付主线",
      partnerOpportunities.filter((item) => item.stage !== "LOST" && item.stage !== "DONE"),
      english,
      "/operating/roles/partner",
      roleLabel("partner", english),
      english
        ? "Partner motion only compounds when custom delivery scope and customer connection stay grounded."
        : "伙伴合作只有在定制交付范围和客户连接都清楚时，才会真正产生杠杆。",
      english
        ? "This is not a marketplace lane. It stays bounded by capability, dependency and review."
        : "这不是伙伴市场，而是受能力、依赖和复核共同约束的合作链。",
    ),
  ].filter((item) => item.recentMeetings.length || item.nextTasks.length || item.keyRetros.length || item.subtitle);

  const sections = buildSections(objectCards, workstreamCards, english);

  const topJudgements = objectCards.slice(0, 3).map((card) => ({
    label: card.title,
    hint: card.currentJudgement,
    href: card.href,
  }));
  const topChains = sections.slice(0, 3).map((section) => ({
    label: section.title,
    hint: section.summary,
    href: section.actionHref,
  }));
  const topDecisions = approvals.slice(0, 3).map((approval) => ({
    label: approval.actionItem.title,
    hint:
      approval.status === "PENDING"
        ? english
          ? "Decision still waiting"
          : "当前仍在等待拍板"
        : english
          ? "Decision already recorded"
          : "已经记录决策结果",
    href:
      approval.actionItem.opportunityId != null
        ? `/review-requests/${approval.id}`
        : "/approvals",
  }));

  const immediateActions = objectCards.slice(0, 3).map((card) => ({
    label: card.nextStep,
    hint: english
      ? `${card.handoffRole} should move ${card.title} next.`
      : `${card.handoffRole} 现在最该先推进 ${card.title}。`,
    href: card.href,
  }));

  const actionTemplates = buildActionTemplateAttachments(
    [
      "follow-up",
      "review-request",
      "escalation",
      "next-meeting",
      "proposal-offer-next-step",
      "recruiting-next-step",
      "partner-follow-through",
    ],
    english,
  ).slice(0, 4);

  const retroFeedback = withFallbackAttachments(
    objectCards
      .flatMap((card) => {
        const feedback: InternalAttachment[] = [];

        if (card.recentMeetings[0]) {
          feedback.push({
            label: english
              ? `${card.title} meeting -> memory`
              : `${card.title} 会议回写到记忆`,
            hint: card.recentMeetings[0].hint,
            href: card.recentMeetings[0].href,
          });
        }

        if (card.keyDecisions[0]) {
          feedback.push({
            label: english
              ? `${card.title} decision -> campaign`
              : `${card.title} 决策回写到主战场`,
            hint: card.keyDecisions[0].hint,
            href: card.keyDecisions[0].href,
          });
        }

        if (card.keyRetros[0]) {
          feedback.push({
            label: english
              ? `${card.title} result -> object summary`
              : `${card.title} 结果回写到对象摘要`,
            hint: card.keyRetros[0].hint,
            href: card.keyRetros[0].href,
          });
        }

        return feedback;
      })
      .slice(0, 3),
    [
      {
        label: english ? "Meeting / review -> memory" : "会议 / 复核回写到记忆",
        hint: english
          ? "Write the latest meeting or review result back into memory before the team re-judges the same chain."
          : "先把最新会议或复核结果回挂到经营记忆，再让团队继续判断同一条链。",
        href: "/memory",
      },
      {
        label: english ? "Decision / blocker -> campaign" : "决策 / 阻塞回写到主战场",
        hint: english
          ? "Keep campaign pressure honest by writing cleared blockers and new decisions back into the current war."
          : "把已清掉的阻塞和新决策回挂到当前主战役里，保持推进压力真实可读。",
        href: "/operating",
      },
      {
        label: english
          ? "Follow-through result -> object summary"
          : "推进结果 → 对象摘要",
        hint: english
          ? "Update the object summary instead of making the team rediscover the same result elsewhere."
          : "直接更新对象摘要，不要让团队在别处重新发现同一个结果。",
        href: "/operating",
      },
    ],
  );

  return {
    eyebrow: english ? "Internal operating workspace" : "团队经营总盘",
    title: english ? "Run Helm inside Helm" : "把今天最重要的业务推进到前面",
    description: english
      ? "Bring leads, customers, candidates, partners and workstreams back into one judgement-first operating surface."
      : "把线索、客户、候选人、伙伴和内部推进主线收回一张先判断、再行动的经营总盘。",
    headline: english
      ? "Today the team needs one operating picture instead of five disconnected object lists."
      : "今天团队最需要的不是 5 组对象列表，而是一张能直接推动业务的统一总盘。",
    summary: english
      ? "This home compresses sales, product, recruiting, partner and delivery movement back into one current judgement, with next action, owner, boundary and trace visible."
      : "这个首页把销售、产品、招聘、伙伴和交付的推进压回同一张总盘，并把下一步动作、负责人、边界和依据一起摆到前台。",
    topJudgements,
    topChains,
    topDecisions,
    immediateActions,
    actionTemplates,
    retroFeedback,
    gtmCapabilityPlanReadout,
    internalCommercializationLifecycleReadout,
    sections,
    roleSurfaces: buildRoleSurfaceEntries(english),
  };
}

function selectRoleCards(
  role: InternalOperatingRole,
  objects: InternalOperatingObjectCard[],
  workstreams: InternalOperatingObjectCard[],
) {
  const customers = objects.filter((item) => item.kind === "CUSTOMER" || item.kind === "LEAD");
  const candidates = objects.filter((item) => item.kind === "CANDIDATE");
  const partners = objects.filter((item) => item.kind === "PARTNER");
  const revenueLane = workstreams.find((item) => item.id === "workstream-revenue");
  const productLane = workstreams.find((item) => item.id === "workstream-product");
  const recruitingLane = workstreams.find((item) => item.id === "workstream-recruiting");
  const partnerLane = workstreams.find((item) => item.id === "workstream-partner");

  if (role === "founder") {
    return [
      ...(productLane ? [productLane] : []),
      ...(partnerLane ? [partnerLane] : []),
      ...customers.slice(0, 2),
      ...partners.slice(0, 1),
    ].sort(compareByPriority);
  }
  if (role === "sales") {
    return [
      ...(revenueLane ? [revenueLane] : []),
      ...customers.slice(0, 3),
    ].sort(compareByPriority);
  }
  if (role === "delivery") {
    return [
      ...(productLane ? [productLane] : []),
      ...customers
        .filter((item) => item.stage === "INTERNAL_SYNC" || item.stage === "ADVANCING")
        .slice(0, 3),
    ].sort(compareByPriority);
  }
  if (role === "customer-success") {
    return customers
      .filter((item) => item.stage === "WAITING_THEM" || item.stage === "ADVANCING")
      .slice(0, 3)
      .sort(compareByPriority);
  }
  if (role === "recruiting") {
    return [
      ...(recruitingLane ? [recruitingLane] : []),
      ...candidates.slice(0, 3),
    ].sort(compareByPriority);
  }
  return [
    ...(partnerLane ? [partnerLane] : []),
    ...partners.slice(0, 3),
  ].sort(compareByPriority);
}

export function buildInternalRoleSurfaceModel(
  role: InternalOperatingRole,
  input: InternalOperatingFoundationInput,
): InternalRoleSurfaceModel {
  const home = buildInternalOperatingHomeModel(input);
  const cards = home.sections.flatMap((section) => section.cards);
  const workstreams = cards.filter((item) => item.kind === "WORKSTREAM");
  const objects = cards.filter((item) => item.kind !== "WORKSTREAM");
  const selected = selectRoleCards(role, objects, workstreams).slice(0, 4);
  const sceneSections = buildRoleSceneSections(
    role,
    objects,
    workstreams,
    selected,
    input.english,
  );
  const risks = selected
    .filter((item) => item.riskLabel === riskLabels.HIGH || item.riskLabel === riskLabels.CRITICAL)
    .slice(0, 3)
    .map((item) => ({
      label: item.title,
      hint: item.riskBoundary,
      href: item.href,
    }));
  const immediateActions = selected.slice(0, 3).map((item) => ({
    label: item.nextStep,
    hint: input.english
      ? `${item.handoffRole} should pick this up now because ${item.currentJudgement}`
      : `${item.handoffRole} 现在就该接手这件事，因为 ${item.currentJudgement}`,
    href: item.href,
  }));
  const decisionsWaiting = withFallbackAttachments(
    selected
      .flatMap((item) =>
        item.keyDecisions.map((decision) => ({
          label: decision.label,
          hint: input.english
            ? `${item.title} still needs an explicit decision owner before the lane can move cleanly.`
            : `${item.title} 仍需要明确拍板负责人，这条链才能继续干净推进。`,
          href: decision.href ?? item.href,
        })),
      )
      .slice(0, 3),
    selected.slice(0, 3).map((item) => ({
      label: item.title,
      hint: input.english
        ? `Decision waiting: ${item.riskBoundary}`
        : `待决策：${item.riskBoundary}`,
      href: item.href,
    })),
  );
  const blockersToClear = withFallbackAttachments(
    selected
      .filter(
        (item) =>
          item.riskLabel === riskLabels.HIGH ||
          item.riskLabel === riskLabels.CRITICAL ||
          item.stage === "WAITING_THEM" ||
          item.stage === "INTERNAL_SYNC",
      )
      .slice(0, 3)
      .map((item) => ({
        label: item.title,
        hint: input.english
          ? `${item.riskBoundary} Next clear move: ${item.nextStep}`
          : `${item.riskBoundary} 先清掉这里，再做：${item.nextStep}`,
        href: item.href,
      })),
    risks,
  );
  const evidence = selected
    .flatMap((item) => [...item.recentMeetings, ...item.keyDecisions, ...item.keyRetros])
    .slice(0, 5);
  const actionTemplates = buildActionTemplateAttachments(
    roleActionTemplateKeys(role),
    input.english,
  );
  const retroFeedback = withFallbackAttachments(
    selected
      .flatMap((item) => {
        const feedback: InternalAttachment[] = [];

        if (item.recentMeetings[0]) {
          feedback.push({
            label: input.english
              ? `${item.title} meeting -> memory`
              : `${item.title} 会议结果回写到记忆`,
            hint: item.recentMeetings[0].hint,
            href: item.recentMeetings[0].href,
          });
        }

        if (item.keyDecisions[0]) {
          feedback.push({
            label: input.english
              ? `${item.title} decision -> campaign`
              : `${item.title} 新决策回写到当前主战场`,
            hint: item.keyDecisions[0].hint,
            href: item.keyDecisions[0].href,
          });
        }

        if (item.keyRetros[0]) {
          feedback.push({
            label: input.english
              ? `${item.title} retro -> summary`
              : `${item.title} 复盘结果回写到对象摘要`,
            hint: item.keyRetros[0].hint,
            href: item.keyRetros[0].href,
          });
        }

        return feedback;
      })
      .slice(0, 3),
    [
      {
        label: input.english ? "Meeting / review -> memory" : "会议 / 复盘结果回写到记忆",
        hint: input.english
          ? "Write the latest review or meeting result back so the next owner does not need to rediscover it."
          : "先把最新会议或复盘结果回写进去，让下一位接手的人不用重新发现一次。",
        href: "/memory",
      },
      {
        label: input.english ? "Decision / blocker -> campaign" : "阻塞变化 / 新决策回写到当前主战场",
        hint: input.english
          ? "Keep campaign pressure honest by updating blockers and decision state together."
          : "把阻塞变化和新决策一起回挂，保持当前主战场判断真实。",
        href: "/operating",
      },
      {
        label: input.english
          ? "Follow-through result -> object summary"
          : "推进结果回写到对象摘要",
        hint: input.english
          ? "Update the object summary fast so the role handoff stays shorter next time."
          : "更快更新对象摘要，让下一次接手更短、更顺。",
        href: "/operating",
      },
    ],
  );

  return {
    role,
    eyebrow: input.english ? "Role handoff surface" : "角色接手总盘",
    title: titleForRole(role, input.english),
    description: summaryForRole(role, input.english),
    headline: roleHeadline(role, input.english),
    summary: roleSummary(role, input.english),
    sceneSections,
    topJudgements: selected.slice(0, 3).map((item) => ({
      label: item.title,
      hint: item.currentJudgement,
      href: item.href,
    })),
    topHandoffs: selected.slice(0, 3),
    immediateActions,
    decisionsWaiting,
    blockersToClear,
    nextActions: immediateActions,
    actionTemplates,
    retroFeedback,
    risks,
    evidence,
  };
}
