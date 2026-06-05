import type {
  PageNextAction,
  PageReportingProtocol,
} from "@/lib/presentation/reporting-protocol";
import { createPageReportingProtocol } from "@/lib/presentation/reporting-protocol";
import { formatSeededBusinessCopy } from "@/lib/presentation/seeded-business-copy";
import {
  createUnifiedDetailNavigationModel,
  type CrossDetailHandoff,
  type CrossDetailHandoffVisibilityMode,
  type UnifiedDetailNavigationModel,
  type UnifiedDetailNodePriority,
} from "@/lib/presentation/unified-detail-navigation";
import { formatConversationChainDateLabel } from "@/features/conversation-chain-extension/conversation-chain-date-labels";
import { formatDateLabel, trimText } from "@/lib/utils";

type HeaderLink = {
  label: string;
  href: string;
  variant?: "default" | "secondary" | "ghost";
};

type EvidenceGroup = {
  groupId: string;
  label: string;
  items: string[];
};

type Chip = {
  label: string;
  tone: "sky" | "violet" | "amber" | "emerald";
};

type SecondarySummaryItem = {
  label: string;
  value: string;
};

export type ConversationChainExtensionPageModel = {
  rootDataAttributes: Record<string, string>;
  eyebrow: string;
  title: string;
  description: string;
  actions: HeaderLink[];
  briefingLabel: string;
  navigation: UnifiedDetailNavigationModel;
  protocol: PageReportingProtocol;
  chips: Chip[];
  secondarySummaryItems: SecondarySummaryItem[];
  boundaryLabel: string;
  actionLabel: string;
  evidenceLabel: string;
  evidenceCountLabel: string;
  evidenceGroups: EvidenceGroup[];
  stageBadge: string;
};

type StageLabels = Record<string, string>;

type CompanyDetailForChain = {
  id: string;
  name: string;
  industry: string | null;
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
    stage: string;
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
    updatedAt: Date;
  }>;
  commitments: Array<{
    id: string;
    title: string;
    status: string;
    overdueFlag: boolean;
    updatedAt: Date;
  }>;
  blockers: Array<{
    id: string;
    title: string;
    blockerText: string;
    severity: number;
    status: string;
    updatedAt: Date;
  }>;
  memoryEntries: Array<{
    id: string;
    title: string;
    content: string;
    createdAt: Date;
  }>;
  briefingSnapshot: {
    payload: {
      summary?: string;
      recommendedNextSteps?: string[];
    };
  } | null;
};

type ContactDetailForChain = {
  id: string;
  name: string;
  title: string | null;
  email: string | null;
  relationshipStage: string | null;
  relationshipWarmth: string;
  lastInteractionAt: Date | null;
  company: { id: string; name: string } | null;
  opportunities: Array<{
    id: string;
    title: string;
    stage: string;
    nextAction: string | null;
    company: { id: string; name: string } | null;
  }>;
  meetings: Array<{
    id: string;
    title: string;
    startsAt: Date;
    note: { summary: string | null } | null;
    opportunity: { title: string } | null;
  }>;
  memoryFacts: Array<{
    id: string;
    title: string;
    content: string;
    updatedAt: Date;
  }>;
  commitments: Array<{
    id: string;
    title: string;
    status: string;
    overdueFlag: boolean;
    updatedAt: Date;
  }>;
  blockers: Array<{
    id: string;
    title: string;
    blockerText: string;
    severity: number;
    status: string;
    updatedAt: Date;
  }>;
  memoryEntries: Array<{
    id: string;
    title: string;
    content: string;
    createdAt: Date;
  }>;
  briefingSnapshot: {
    payload: {
      summary?: string;
      recommendedNextSteps?: string[];
    };
  } | null;
};

type MeetingDetailForChain = {
  id: string;
  title: string;
  startsAt: Date;
  company: { id: string; name: string } | null;
  contacts: Array<{ id: string; name: string; title: string | null }>;
  opportunity: {
    id: string;
    title: string;
    stage: string;
    riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    nextAction: string | null;
    company: { id: string; name: string } | null;
  } | null;
  note: {
    summary: string | null;
    keyDecisions: string | null;
    confirmations: string | null;
  } | null;
  actionItems: Array<{
    id: string;
    title: string;
    status: string;
    dueDate: Date | null;
    updatedAt: Date;
    approvalTask: {
      status: "PENDING" | "EXECUTED" | "REJECTED" | "WITHDRAWN";
    } | null;
  }>;
  memoryFacts: Array<{
    id: string;
    title: string;
    content: string;
    updatedAt: Date;
  }>;
  commitments: Array<{
    id: string;
    title: string;
    status: string;
    overdueFlag: boolean;
    updatedAt: Date;
  }>;
  blockers: Array<{
    id: string;
    title: string;
    blockerText: string;
    severity: number;
    status: string;
    updatedAt: Date;
  }>;
  memoryEntries: Array<{
    id: string;
    title: string;
    content: string;
    createdAt: Date;
  }>;
  briefingSnapshot: {
    payload: {
      summary?: string;
      recommendedNextSteps?: string[];
    };
  } | null;
};

export function buildCompanyConversationChainExtensionModel({
  company,
  english,
  stageLabels,
  pendingReviewRequestId,
  customerSuccessOpportunityId,
}: {
  company: CompanyDetailForChain;
  english: boolean;
  stageLabels: StageLabels;
  pendingReviewRequestId?: string | null;
  customerSuccessOpportunityId?: string | null;
}): ConversationChainExtensionPageModel {
  const topOpportunity = company.opportunities[0] ?? null;
  const topContact = company.contacts[0] ?? null;
  const topMeeting = company.meetings[0] ?? null;
  const topBlocker = company.blockers[0] ?? null;
  const overdueCommitment =
    company.commitments.find((item) => item.overdueFlag) ?? null;
  const briefingSummary = normalizeDisplayText(
    company.briefingSnapshot?.payload.summary,
    english,
  );
  const topOpportunityNextAction = normalizeDisplayText(
    topOpportunity?.nextAction,
    english,
  );
  const stageLabel =
    (topOpportunity ? stageLabels[topOpportunity.stage] : null) ??
    (english ? "Account routing" : "账户路由");
  const sendability = topOpportunity
    ? topBlocker || overdueCommitment
      ? "safe-with-boundary"
      : "customer-facing-with-boundary"
    : "internal-only";
  const priority = topBlocker || overdueCommitment ? "important" : "watch";

  const protocol = createPageReportingProtocol({
    pageJudgement: english
      ? "Use the company page as the account-routing detail before anyone jumps back into outreach, follow-up or review."
      : "当前应先把公司页当作账户路由详情，再决定下一步回到外联、跟进还是复核。",
    pageJudgementReason:
      briefingSummary ??
      (topOpportunity
        ? english
          ? `${company.name} already carries ${stageLabel} pressure, so this page now needs to tell the team which contact, meeting or follow-up path should take over next.`
          : `${company.name} 当前已经承载了「${stageLabel}」推进压力，所以这页现在要先告诉团队：下一步应该由哪个联系人、会议或跟进路径接手。`
        : english
          ? `${company.name} still reads as account preparation, so the company detail should stay internal-first until the next owner, contact and boundary are clear.`
          : `${company.name} 当前仍更像账户准备态，所以在负责人、联系人和边界说清楚前，公司详情应继续保持内部优先。`),
    pageWhyItMatters: [
      topContact
        ? english
          ? `${topContact.name} is already the warmest visible path on this account, so company judgement now directly affects who should own the next conversation.`
          : `${topContact.name} 已经是这个账户当前最值得继续推进的可见路径，所以公司判断现在会直接影响下一段沟通该由谁接手。`
        : english
          ? "There is still no obvious contact owner, so this page needs to keep the account route honest before the team widens outward communication."
          : "当前还没有明显的联系人负责人，所以在团队扩大对外沟通之前，这页需要先把账户路由说诚实。",
      topOpportunity
        ? english
          ? `The linked package / offer chain is already moving, so company detail can no longer stay as a static profile page.`
          : `当前已经挂着正在推进的方案包 / 报价链，所以公司详情不能再只是静态资料页。`
        : english
          ? "Without a live opportunity, this company detail should still push toward the next accountable contact or meeting instead of pretending commercial motion already exists."
          : "在没有活跃机会的情况下，公司详情也应该把团队推向下一个可负责的联系人或会议，而不是假装商业推进已经成立。",
      english
        ? "The current page already groups contacts, meetings, blockers, commitments and memory here, so the remaining work is choosing the right handoff, not rebuilding context."
        : "当前页已经把联系人、会议、阻塞、承诺和记忆收在这里，所以剩下真正的工作是选对交接，而不是重建上下文。",
    ],
    pageActionSummary: [
      english
        ? "The current account-routing view already groups the active opportunity, recent company memory and the warmest visible contact path."
        : "当前账户路由视图已经把活跃机会、最近公司记忆和最值得继续推进的联系人路径收在一起。",
      topMeeting
        ? english
          ? `The latest meeting (${topMeeting.title}) is already linked back to this account, so the company page can now hand work into meeting review instead of leaving it in notes.`
          : `最近一次会议（${topMeeting.title}）已经回挂到这个账户上，所以公司页现在可以把工作直接交给会议复核，而不是继续留在备注里。`
        : english
          ? "The account is already being kept in preparation mode without faking a meeting-based chain that does not yet exist."
          : "当前这个账户已经保持在准备态，没有假装已经存在会议驱动的详情链。",
      english
        ? "Boundary, next owner and the next likely contact handoff are already visible here before anyone turns this account into customer-facing momentum."
        : "在任何人把这个账户推向客户侧推进之前，边界、下一位负责人和下一位联系人交接都已经先在这里可见。",
    ],
    pageDecisionRequest: [
      english
        ? `Confirm whether ${topContact?.name ?? "the next owner"} should take the next outward move, or whether this account still belongs in internal-only preparation.`
        : `确认下一步是由 ${topContact?.name ?? "下一位负责人"} 接手对外动作，还是这个账户仍只适合停在仅内部准备。`,
      topOpportunity
        ? english
          ? "Confirm whether the next company-to-contact handoff can stay customer-facing-with-boundary, or whether it should step back into safe-with-boundary first."
          : "确认下一次公司到联系人的交接能否继续保持客户可见且带边界，还是需要退回带边界的安全口径。"
        : english
          ? "Confirm which accountable contact or meeting should create the first real commercial follow-through on this account."
          : "确认哪个可负责联系人或会议应该在这个账户上拉出第一条真正的商业推进。",
    ],
    pageNextAction: buildActions({
      primary: topContact
        ? {
            label: english ? "Open contact detail" : "打开联系人详情",
            href: `/contacts/${topContact.id}`,
          }
        : topOpportunity
          ? {
              label: english
                ? "Open conversation detail"
                : "打开沟通详情",
              href: `/conversations/${topOpportunity.id}`,
            }
          : {
              label: english
                ? "Stay on company detail"
                : "继续查看公司详情",
              href: `/companies/${company.id}`,
            },
      secondary: [
        topOpportunity
          ? {
              label: english ? "Open package detail" : "打开方案包详情",
              href: `/packages/${topOpportunity.id}`,
              variant: "secondary" as const,
            }
          : null,
        topMeeting
          ? {
              label: english ? "Open meeting detail" : "打开会议详情",
              href: `/meetings/${topMeeting.id}`,
              variant: "ghost" as const,
            }
          : null,
      ],
    }),
    pageBoundarySummary: [
      english
        ? "Company detail can route the account, but it still cannot quietly turn account context into proposal scope, delivery certainty or commitment."
        : "公司详情可以负责路由账户，但账户上下文不能被直接读成方案范围、交付确定性或承诺。",
      topBlocker
        ? english
          ? `Current blocker: ${trimText(topBlocker.blockerText, 92)}`
          : `当前卡点：${trimText(topBlocker.blockerText, 92)}`
        : english
          ? "If the next owner, contact or prerequisite is still unclear, keep this page internal-first."
          : "如果下一位负责人、联系人或前置条件仍不清楚，这页就继续保持内部优先。",
      english
        ? "Any customer-facing move that leaves company context must keep prerequisite, dependency and non-commitment cues visible."
        : "任何从公司页走向客户可见的动作，都必须继续带着前置条件、依赖和非承诺提示。",
    ],
    pageEvidenceSummary: [
      english
        ? `${company.memoryFacts.length} memory facts, ${company.blockers.length} blockers and ${company.commitments.length} commitments are grouped below without taking over the main narrative.`
        : `当前 ${company.memoryFacts.length} 条记忆事实、${company.blockers.length} 个阻塞和 ${company.commitments.length} 条承诺都已分组收在下方，不会反过来抢主叙事。`,
      english
        ? "Recent account memory, contact handoff cues and meeting traces remain available on demand."
        : "最近的账户记忆、联系人交接提示和会议记录会继续保留在附注层按需可看。",
    ],
    pageWorkerSummary: [
      english
        ? "Account routing keeps sales and delivery from widening communication before the right contact path is explicit."
        : "账户路由会防止销售和交付在联系人路径还没说清楚前，就过早扩大对外沟通。",
      english
        ? "Worker / pack / scenario cues stay attached here so the next contact or meeting handoff remains explainable."
        : "执行单元、材料包和场景提示会继续挂在这里，保证下一次联系人或会议交接仍然可解释。",
    ],
    pagePrioritySignal: english
      ? priority === "important"
        ? "Important transition"
        : "Watch the chain"
      : priority === "important"
        ? "重要切换"
        : "继续观察",
    pageEscalationHint: topOpportunity
      ? english
        ? "If anyone wants the account story to sound firmer than the current contact, blocker or prerequisite picture supports, step back into package or review first."
        : "如果任何人想把账户故事说得比当前联系人、阻塞或前置条件画面更实，就先退回方案包或复核。"
      : english
        ? "If the account still lacks a single owner, do not let this page drift into customer-facing certainty."
        : "如果这个账户仍缺少单一负责人，就不要让这页漂移成客户可见的确定性。",
  });

  const navigation = createUnifiedDetailNavigationModel({
    currentNode: {
      detailNodeType: "company-detail",
      detailNodeSummary: protocol.pageJudgement,
      detailNodeStage: stageLabel,
      detailNodeBoundary: protocol.pageBoundarySummary[0],
      detailNodeAudienceMode: english ? "Account handoff" : "账户交接",
      detailNodeSendabilityMode: sendability,
      detailNodeStrengthMode: english ? "Account routing" : "账户路由",
      detailNodePrev: topOpportunity
        ? {
            type: "package",
            href: `/packages/${topOpportunity.id}`,
            label: english ? "Package detail" : "方案包详情",
            summary: english
              ? "Return here when the account-level route needs to stay aligned with the active package."
              : "如果账户级路由需要继续与当前方案包对齐，就回到这里。",
          }
        : null,
      detailNodeNext: pendingReviewRequestId
        ? {
            type: "review-request-detail",
            href: `/review-requests/${pendingReviewRequestId}`,
            label: english ? "Review request detail" : "复核请求详情",
            summary: english
              ? "Move here when the account route now depends on approval-sensitive next steps."
              : "当账户路由已经开始依赖审批敏感的下一步动作时，就切到这里。",
          }
        : customerSuccessOpportunityId
          ? {
              type: "customer-success",
              href: `/customer-success/${customerSuccessOpportunityId}`,
              label: english ? "Customer success handoff" : "客户成功接手",
              summary: english
                ? "Move here when the account route should hand into dedicated success follow-through."
                : "当账户路由已经该交给专门的客户成功推进时，就切到这里。",
            }
          : topContact
            ? {
                type: "contact-detail",
                href: `/contacts/${topContact.id}`,
                label: english ? "Contact detail" : "联系人详情",
                summary: english
                  ? "Move here once the current chain makes clear which contact should carry the next outward move."
                  : "当当前链路已经明确由哪个联系人承接下一步对外动作，就切到这里。",
              }
            : topMeeting
              ? {
                  type: "meeting-detail",
                  href: `/meetings/${topMeeting.id}`,
                  label: english ? "Meeting detail" : "会议详情",
                  summary: english
                    ? "Move here when the next useful action now belongs in meeting follow-through."
                    : "如果下一步最有价值的动作已经转到会议后续推进，就切到这里。",
                }
              : null,
      detailNodeCurrentReason: protocol.pageJudgementReason,
      detailNodePriority: priority,
      detailNodeNavigationHint: english
        ? "Use this detail when the team must choose which account contact, meeting or package path should take the next conversation handoff."
        : "当团队需要决定下一次沟通交接应该交给联系人、会议还是方案路径时，停在这里。",
    },
    handoffs: compactHandoffs([
      topOpportunity
        ? {
            handoffSource: "package",
            handoffTarget: "company-detail",
            handoffReason: english
              ? "The account route now matters more than more package shaping, so the company context should come first before the next commercial move."
              : "当前更重要的是账户路由，而不是继续改方案包，所以在下一次商业动作前应先回到公司上下文。",
            handoffBoundary: protocol.pageBoundarySummary[0],
            handoffPrerequisite: protocol.pageBoundarySummary[1] ?? null,
            handoffDependency: protocol.pageBoundarySummary[2] ?? null,
            handoffRisk: english
              ? "If account context is skipped, the next outreach can outrun the real contact and blocker picture."
              : "如果跳过账户上下文，下一次外联很容易跑在真实的联系人和阻塞画面前面。",
            handoffDecisionRequest: protocol.pageDecisionRequest[0],
            handoffNextAction: protocol.pageNextAction[0].label,
            handoffWorkerSummary: protocol.pageWorkerSummary,
            handoffEvidenceSummary: protocol.pageEvidenceSummary,
            handoffVisibilityMode: toVisibilityMode(sendability),
            handoffHref: `/companies/${company.id}`,
          }
        : null,
      {
        handoffSource: "conversation",
        handoffTarget: "company-detail",
        handoffReason: english
          ? "The next conversation depends on account route, owner and contact reality, so the team should reset context here first."
          : "下一次沟通依赖账户路由、负责人和联系人现实，所以团队应该先回到这里重置上下文。",
        handoffBoundary: protocol.pageBoundarySummary[0],
        handoffPrerequisite: protocol.pageBoundarySummary[1] ?? null,
        handoffDependency: null,
        handoffRisk: english
          ? "Company detail must stay a routing page, not a place that silently manufactures certainty."
          : "公司详情必须继续是路由页，而不是一个悄悄制造确定性的地方。",
        handoffDecisionRequest: protocol.pageDecisionRequest[0],
        handoffNextAction: protocol.pageNextAction[0].label,
        handoffWorkerSummary: protocol.pageWorkerSummary,
        handoffEvidenceSummary: protocol.pageEvidenceSummary,
        handoffVisibilityMode: toVisibilityMode(sendability),
        handoffHref: `/companies/${company.id}`,
      },
      pendingReviewRequestId
        ? {
            handoffSource: "company-detail",
            handoffTarget: "review-request-detail",
            handoffReason: english
              ? "The account route now depends on an approval-sensitive next step, so the chain should step into review request before pretending the work is already clean."
              : "当前账户路由已经依赖审批敏感的下一步动作，所以这条链应该先切进复核请求，而不是假装工作已经足够干净。",
            handoffBoundary: protocol.pageBoundarySummary[0],
            handoffPrerequisite: protocol.pageBoundarySummary[1] ?? null,
            handoffDependency: protocol.pageBoundarySummary[2] ?? null,
            handoffRisk: english
              ? "If the team skips the review layer, the account route can overrun the real approval boundary."
              : "如果团队跳过复核层，账户路由就可能跑在真实审批边界前面。",
            handoffDecisionRequest: protocol.pageDecisionRequest[0],
            handoffNextAction: english
              ? "Open review request detail"
              : "打开复核请求详情",
            handoffWorkerSummary: protocol.pageWorkerSummary,
            handoffEvidenceSummary: protocol.pageEvidenceSummary,
            handoffVisibilityMode: "review-before-send",
            handoffHref: `/review-requests/${pendingReviewRequestId}`,
          }
        : null,
      customerSuccessOpportunityId
        ? {
            handoffSource: "company-detail",
            handoffTarget: "customer-success",
            handoffReason: english
              ? "The account route now needs dedicated customer success follow-through instead of staying as generic company context."
              : "当前账户路由已经需要专门的客户成功推进，而不是继续停在泛化公司上下文。",
            handoffBoundary: protocol.pageBoundarySummary[0],
            handoffPrerequisite: protocol.pageBoundarySummary[1] ?? null,
            handoffDependency: topOpportunityNextAction ?? null,
            handoffRisk: english
              ? "If company detail keeps acting as the success proxy, the real owner and next step stay implicit."
              : "如果公司详情继续充当客户成功代理，真正的负责人和下一步就会重新变成隐式。",
            handoffDecisionRequest: protocol.pageDecisionRequest[0],
            handoffNextAction: english
              ? "Open customer success handoff"
              : "打开客户成功交接",
            handoffWorkerSummary: protocol.pageWorkerSummary,
            handoffEvidenceSummary: protocol.pageEvidenceSummary,
            handoffVisibilityMode: "internal-only",
            handoffHref: `/customer-success/${customerSuccessOpportunityId}`,
          }
        : null,
      topContact
        ? {
            handoffSource: "company-detail",
            handoffTarget: "contact-detail",
            handoffReason: english
              ? "The current chain already shows which contact path matters most, so it should now narrow from the account into the actual relationship owner."
              : "当前链路已经显示出哪个联系人路径最值得推进，所以现在应该从账户收窄到真正的关系负责人。",
            handoffBoundary: protocol.pageBoundarySummary[0],
            handoffPrerequisite: null,
            handoffDependency: topOpportunityNextAction ?? null,
            handoffRisk: english
              ? "Do not move into contact outreach if the account still lacks an honest blocker and owner picture."
              : "如果账户层的阻塞和负责人画面还没说诚实，就不要急着切进联系人触达。",
            handoffDecisionRequest: protocol.pageDecisionRequest[0],
            handoffNextAction: english
              ? "Open contact detail"
              : "打开联系人详情",
            handoffWorkerSummary: protocol.pageWorkerSummary,
            handoffEvidenceSummary: protocol.pageEvidenceSummary,
            handoffVisibilityMode: toVisibilityMode(sendability),
            handoffHref: `/contacts/${topContact.id}`,
          }
        : null,
    ]),
  });

  return {
    rootDataAttributes: {
      "data-conversation-chain-extension-page": "true",
      "data-conversation-chain-extension-kind": "company-detail",
    },
    eyebrow: english
      ? "Conversation chain / Company detail"
      : "沟通链 / 公司详情",
    title: english
      ? `${company.name} company chain detail`
      : `${company.name} 公司链路详情`,
    description: english
      ? `${company.industry ?? "No industry"} · ${topContact?.name ?? "No key contact"} · ${stageLabel}`
      : `${company.industry ?? "未填写行业"} · ${topContact?.name ?? "暂无关键联系人"} · ${stageLabel}`,
    actions: compactLinks([
      pendingReviewRequestId
        ? {
            label: english
              ? "Open review request detail"
              : "打开复核请求详情",
            href: `/review-requests/${pendingReviewRequestId}`,
          }
        : customerSuccessOpportunityId
          ? {
              label: english
                ? "Open customer success handoff"
                : "打开客户成功交接",
              href: `/customer-success/${customerSuccessOpportunityId}`,
            }
          : topContact
            ? {
                label: english ? "Open contact detail" : "打开联系人详情",
                href: `/contacts/${topContact.id}`,
              }
            : null,
      customerSuccessOpportunityId && pendingReviewRequestId
        ? {
            label: english
              ? "Open customer success handoff"
              : "打开客户成功交接",
            href: `/customer-success/${customerSuccessOpportunityId}`,
            variant: "secondary" as const,
          }
        : topOpportunity
          ? {
              label: english ? "Open package detail" : "打开方案包详情",
              href: `/packages/${topOpportunity.id}`,
              variant: "secondary",
            }
          : null,
      topMeeting
        ? {
            label: english ? "Open meeting detail" : "打开会议详情",
            href: `/meetings/${topMeeting.id}`,
            variant: "ghost",
          }
        : null,
    ]),
    briefingLabel: english
      ? "Current company chain judgement"
      : "当前公司链路判断",
    navigation,
    protocol,
    chips: [
      {
        label: english ? "Account routing" : "账户路由",
        tone: "sky",
      },
      {
        label: formatSendabilityLabel(sendability, english),
        tone: sendability === "internal-only" ? "amber" : "emerald",
      },
      {
        label: topOpportunity ? stageLabel : english ? "prep-only" : "仅准备态",
        tone: "violet",
      },
    ],
    secondarySummaryItems: [
      {
        label: english ? "Current node" : "当前节点",
        value: english ? "Company detail" : "公司详情",
      },
      {
        label: english ? "Active stage" : "当前阶段",
        value: stageLabel,
      },
      {
        label: english ? "Key contact" : "关键联系人",
        value: topContact?.name ?? (english ? "Not assigned" : "未指定"),
      },
      {
        label: english ? "Open blockers" : "当前卡点",
        value: english
          ? `${company.blockers.length}`
          : `${company.blockers.length} 个`,
      },
      {
        label: english ? "Open commitments" : "开放承诺",
        value: english
          ? `${company.commitments.length}`
          : `${company.commitments.length} 条`,
      },
      {
        label: english ? "Recent meeting" : "最近会议",
        value: topMeeting?.title ?? (english ? "None yet" : "暂无"),
      },
    ],
    boundaryLabel: english ? "Boundary and account route" : "边界与账户路由",
    actionLabel: english ? "Available next actions" : "可直接执行的动作",
    evidenceLabel: english ? "Evidence drawer" : "证据抽屉",
    evidenceCountLabel: english
      ? `${
          buildEntityEvidenceGroups({
            english,
            entityName: company.name,
            summary: briefingSummary,
            blocker: topBlocker?.blockerText ?? null,
            nextAction: topOpportunityNextAction ?? null,
            latestMemory: company.memoryEntries[0]?.content ?? null,
            latestMeeting:
              normalizeDisplayText(topMeeting?.note?.summary, english) ?? null,
          }).length
        } grouped tracks`
      : `${
          buildEntityEvidenceGroups({
            english,
            entityName: company.name,
            summary: briefingSummary,
            blocker: topBlocker?.blockerText ?? null,
            nextAction: topOpportunityNextAction ?? null,
            latestMemory: company.memoryEntries[0]?.content ?? null,
            latestMeeting:
              normalizeDisplayText(topMeeting?.note?.summary, english) ?? null,
          }).length
        } 组依据`,
    evidenceGroups: buildEntityEvidenceGroups({
      english,
      entityName: company.name,
      summary: briefingSummary,
      blocker: topBlocker?.blockerText ?? null,
      nextAction: topOpportunityNextAction ?? null,
      latestMemory: company.memoryEntries[0]?.content ?? null,
      latestMeeting: normalizeDisplayText(topMeeting?.note?.summary, english) ?? null,
    }),
    stageBadge: topOpportunity
      ? `${stageLabel} · ${topOpportunity.riskLevel}`
      : english
        ? "Account preparation"
        : "账户准备态",
  };
}

export function buildContactConversationChainExtensionModel({
  contact,
  english,
  stageLabels,
}: {
  contact: ContactDetailForChain;
  english: boolean;
  stageLabels: StageLabels;
}): ConversationChainExtensionPageModel {
  const topOpportunity = contact.opportunities[0] ?? null;
  const latestMeeting = contact.meetings[0] ?? null;
  const topBlocker = contact.blockers[0] ?? null;
  const overdueCommitment =
    contact.commitments.find((item) => item.overdueFlag) ?? null;
  const briefingSummary = normalizeDisplayText(
    contact.briefingSnapshot?.payload.summary,
    english,
  );
  const topOpportunityNextAction = normalizeDisplayText(
    topOpportunity?.nextAction,
    english,
  );
  const stageLabel =
    formatContactRelationshipStage(contact.relationshipStage, english) ??
    (topOpportunity ? stageLabels[topOpportunity.stage] : null) ??
    (english ? "Relationship routing" : "关系路由");
  const sendability =
    topOpportunity && !topBlocker
      ? overdueCommitment
        ? "safe-with-boundary"
        : "customer-facing-with-boundary"
      : topOpportunity
        ? "safe-with-boundary"
        : "internal-only";
  const priority: UnifiedDetailNodePriority =
    topBlocker || overdueCommitment ? "important" : "watch";

  const protocol = createPageReportingProtocol({
    pageJudgement: english
      ? "Use the contact page as the relationship-routing detail before the next follow-up, meeting or conversation hop."
      : "当前应先把联系人页当作关系路由详情，再决定下一次跟进、会议还是沟通交接。",
    pageJudgementReason:
      briefingSummary ??
      (topOpportunity
        ? english
          ? `${contact.name} already sits on the live commercial thread, so the contact page now needs to decide who follows up, with what boundary, and through which next scene.`
          : `${contact.name} 当前已经挂在活跃商业线索上，所以联系人页现在要决定下一步由谁跟进、带着什么边界、切进哪个场景。`
        : english
          ? `${contact.name} still reads as relationship preparation, so the page should stay honest about warmth, risk and ownership before any stronger outward claim appears.`
          : `${contact.name} 当前仍更像关系准备态，所以在任何更强的对外判断出现前，这页要先把关系温度、风险和负责人说诚实。`),
    pageWhyItMatters: [
      topOpportunity
        ? english
          ? `${contact.name} is already tied to ${topOpportunity.title}, so this page now directly changes whether the next move should become sales follow-up, meeting review or broader conversation.`
          : `${contact.name} 已经挂在 ${topOpportunity.title} 上，所以这页现在会直接改变下一步该切到销售跟进、会议复核还是更宽的沟通。`
        : english
          ? "Without a live opportunity, this page should still narrow toward the next accountable interaction instead of leaving the relationship in generic notes."
          : "即使当前还没有活跃机会，这页也应该继续收窄到下一次可负责的互动，而不是把关系留在泛化备注里。",
      topBlocker
        ? english
          ? `The current blocker (${topBlocker.title}) means the next contact move must stay visibly reversible.`
          : `当前卡点（${topBlocker.title}）意味着下一次联系人动作必须继续保持显式可回退。`
        : english
          ? "The contact page now has enough history to route the next move without inventing certainty."
          : "当前联系人页已经积累了足够历史，可以在不虚构确定性的前提下路由下一步。",
      english
        ? "The current page already groups relationship history, meetings, blockers, commitments and memory here, so the remaining work is choosing the right handoff."
        : "当前页已经把关系历史、会议、阻塞、承诺和记忆收在这里，所以剩下真正的工作是选对交接。",
    ],
    pageActionSummary: [
      english
        ? "The current follow-through view already gathers the relationship stage, recent meetings and the most relevant blocker / commitment context."
        : "当前后续推进视图已经把关系阶段、最近会议以及最相关的阻塞 / 承诺上下文收在一起。",
      latestMeeting
        ? english
          ? `The last meeting (${latestMeeting.title}) is still linked, so this page can route directly into meeting or follow-up detail without rebuilding context.`
          : `最近一次会议（${latestMeeting.title}）仍然挂在这里，所以这页可以直接把链路送进会议或跟进详情，不需要重建上下文。`
        : english
          ? "The contact still stays ready for the next accountable touch instead of letting the page fill with empty activity."
          : "即使还没有最近会议，这个联系人也先保持在可承接下一次负责触达的状态，而不是拿空活动把页面填满。",
      english
        ? "Boundary, sendability and the next likely owner are already visible before anyone turns this relationship detail into customer-facing certainty."
        : "在任何人把这张关系详情说成客户侧确定性前，边界、发送条件和下一位可能接手的人都已经先挂在前台。",
    ],
    pageDecisionRequest: [
      english
        ? `Confirm whether ${contact.name} should move into follow-up now, or whether the next safe move still belongs in meeting review or internal preparation.`
        : `确认 ${contact.name} 现在是否应该切进跟进，还是下一次安全动作仍应该停在会议复核或内部准备。`,
      english
        ? "Confirm whether the next relationship move can stay customer-facing-with-boundary, or whether it must step back into non-commitment first."
        : "确认下一次关系动作现在能否保持面向客户但带边界，还是必须先退回非承诺口径。",
    ],
    pageNextAction: buildActions({
      primary: topOpportunity
        ? {
            label: english ? "Open sales follow-up" : "打开销售跟进",
            href: `/sales-followups/${topOpportunity.id}`,
          }
        : latestMeeting
          ? {
              label: english ? "Open meeting detail" : "打开会议详情",
              href: `/meetings/${latestMeeting.id}`,
            }
          : {
              label: english
                ? "Stay on contact detail"
                : "继续查看联系人详情",
              href: `/contacts/${contact.id}`,
            },
      secondary: [
        contact.company
          ? {
              label: english ? "Open company detail" : "打开公司详情",
              href: `/companies/${contact.company.id}`,
              variant: "secondary" as const,
            }
          : null,
        topOpportunity
          ? {
              label: english
                ? "Open conversation detail"
                : "打开沟通详情",
              href: `/conversations/${topOpportunity.id}`,
              variant: "ghost" as const,
            }
          : null,
      ],
    }),
    pageBoundarySummary: [
      english
        ? "Contact detail can route relationship motion, but it still cannot quietly turn warmth, access or a good meeting into commitment."
        : "联系人详情可以负责路由关系推进，但关系热度、触达便利或一次顺利会议都不能被直接读成承诺。",
      topBlocker
        ? english
          ? `Current blocker: ${trimText(topBlocker.blockerText, 92)}`
          : `当前卡点：${trimText(topBlocker.blockerText, 92)}`
        : english
          ? "If the next role, meeting or package dependency is still unclear, keep this contact move reversible."
          : "如果下一步角色、会议或方案包依赖仍不清楚，就让这次联系人动作继续保持可回退。",
      english
        ? "Any outreach that leaves this page must keep boundary, prerequisite, dependency and non-commitment visible."
        : "任何从这页往外走的触达都必须继续把边界、前置条件、依赖和非承诺挂在前台。",
    ],
    pageEvidenceSummary: [
      english
        ? `${contact.memoryFacts.length} memory facts, ${contact.meetings.length} meetings and ${contact.commitments.length} commitments are grouped below without interrupting the main narrative.`
        : `当前 ${contact.memoryFacts.length} 条记忆事实、${contact.meetings.length} 场会议和 ${contact.commitments.length} 条承诺都已分组收在下方，不会打断主叙事。`,
      english
        ? "Relationship memory, follow-up cues and meeting traces remain available on demand."
        : "关系记忆、跟进提示和会议记录会继续保留在附注层按需可看。",
    ],
    pageWorkerSummary: [
      english
        ? "Relationship routing keeps sales from skipping over trust pressure and keeps delivery from inheriting a contact path that was never clarified."
        : "关系路由会防止销售跳过信任压力，也会防止交付接手一条从未说清楚的联系人路径。",
      english
        ? "Worker / pack / scenario cues stay visible so the next follow-up or meeting handoff remains explainable."
        : "执行单元、材料包和场景提示会继续可见，保证下一次跟进或会议交接仍然可解释。",
    ],
    pagePrioritySignal: english
      ? priority === "important"
        ? "Important transition"
        : "Watch the chain"
      : priority === "important"
        ? "重要切换"
        : "继续观察",
    pageEscalationHint: topOpportunity
      ? english
        ? "If anyone wants this relationship move to sound firmer than the current blocker, dependency or trust picture supports, step back into review first."
        : "如果任何人想让这次关系动作比当前卡点、依赖或信任画面更实，就先退回复核。"
      : english
        ? "Without a linked opportunity, do not let this page pretend the next move is already commercially committed."
        : "在没有关联机会的情况下，不要让这页假装下一步已经形成商业承诺。",
  });

  const navigation = createUnifiedDetailNavigationModel({
    currentNode: {
      detailNodeType: "contact-detail",
      detailNodeSummary: protocol.pageJudgement,
      detailNodeStage: stageLabel,
      detailNodeBoundary: protocol.pageBoundarySummary[0],
      detailNodeAudienceMode: english ? "Relationship routing" : "关系路由",
      detailNodeSendabilityMode: sendability,
      detailNodeStrengthMode: english ? "Contact follow-through" : "联系人跟进",
      detailNodePrev: contact.company
        ? {
            type: "company-detail",
            href: `/companies/${contact.company.id}`,
            label: english ? "Company detail" : "公司详情",
            summary: english
              ? "Return here if the account route still needs to settle before the next relationship move."
              : "如果账户路由在下一次关系动作前仍需要先稳定，就回到这里。",
          }
        : null,
      detailNodeNext: topOpportunity
        ? {
            type: "sales-follow-up",
            href: `/sales-followups/${topOpportunity.id}`,
            label: english ? "Sales follow-up detail" : "销售跟进详情",
            summary: english
              ? "Move here once the relationship route is clear enough for the next follow-up wording."
              : "当关系路由已经清楚到足以决定下一次跟进措辞时，切到这里。",
          }
        : latestMeeting
          ? {
              type: "meeting-detail",
              href: `/meetings/${latestMeeting.id}`,
              label: english ? "Meeting detail" : "会议详情",
              summary: english
                ? "Move here once the next useful action is meeting follow-through instead of generic relationship review."
                : "如果下一步最有价值的动作已经转成会议后续推进，而不是泛化关系复核，就切到这里。",
            }
          : null,
      detailNodeCurrentReason: protocol.pageJudgementReason,
      detailNodePriority: priority,
      detailNodeNavigationHint: english
        ? "Use this detail when the team must decide which contact scene should carry the next follow-up, meeting or conversation handoff."
        : "当团队需要决定下一次跟进、会议或沟通交接该由哪个联系人场景承接时，停在这里。",
    },
    handoffs: compactHandoffs([
      contact.company
        ? {
            handoffSource: "company-detail",
            handoffTarget: "contact-detail",
            handoffReason: english
              ? "The account route is now clear enough to narrow down into the actual relationship owner."
              : "当前账户路由已经够清楚，现在应该收窄到真正的关系负责人。",
            handoffBoundary: protocol.pageBoundarySummary[0],
            handoffPrerequisite: protocol.pageBoundarySummary[1] ?? null,
            handoffDependency: topOpportunityNextAction ?? null,
            handoffRisk: english
              ? "Do not hand work into contact outreach if the account still lacks an honest boundary picture."
              : "如果账户层的边界图景还没说诚实，就不要急着把工作交给联系人触达。",
            handoffDecisionRequest: protocol.pageDecisionRequest[0],
            handoffNextAction: protocol.pageNextAction[0].label,
            handoffWorkerSummary: protocol.pageWorkerSummary,
            handoffEvidenceSummary: protocol.pageEvidenceSummary,
            handoffVisibilityMode: toVisibilityMode(sendability),
            handoffHref: `/contacts/${contact.id}`,
          }
        : null,
      topOpportunity
        ? {
            handoffSource: "conversation",
            handoffTarget: "contact-detail",
            handoffReason: english
              ? "The next conversation now depends on the actual relationship owner, not only the general commercial frame."
              : "下一次沟通现在依赖真正的关系负责人，而不只是泛化商业框架。",
            handoffBoundary: protocol.pageBoundarySummary[0],
            handoffPrerequisite: protocol.pageBoundarySummary[1] ?? null,
            handoffDependency: topOpportunityNextAction ?? null,
            handoffRisk: english
              ? "Contact detail must stay relationship-first, otherwise the next follow-up can sound stronger than trust has earned."
              : "联系人详情必须继续以关系为先，否则下一次跟进很容易比真实信任画面说得更实。",
            handoffDecisionRequest: protocol.pageDecisionRequest[0],
            handoffNextAction: protocol.pageNextAction[0].label,
            handoffWorkerSummary: protocol.pageWorkerSummary,
            handoffEvidenceSummary: protocol.pageEvidenceSummary,
            handoffVisibilityMode: toVisibilityMode(sendability),
            handoffHref: `/contacts/${contact.id}`,
          }
        : null,
      topOpportunity
        ? {
            handoffSource: "contact-detail",
            handoffTarget: "sales-follow-up",
            handoffReason: english
              ? "The relationship route is clear enough to decide the next sales follow-up wording."
              : "当前关系路由已经够清楚，可以直接决定下一次销售跟进措辞。",
            handoffBoundary: protocol.pageBoundarySummary[0],
            handoffPrerequisite: null,
            handoffDependency: topOpportunityNextAction ?? null,
            handoffRisk: english
              ? "Do not let follow-up wording outrun the actual relationship warmth, blocker or open commitment picture."
              : "不要让跟进措辞跑在真实关系温度、阻塞或开放承诺画面前面。",
            handoffDecisionRequest: protocol.pageDecisionRequest[1],
            handoffNextAction: english
              ? "Open sales follow-up"
              : "打开销售跟进",
            handoffWorkerSummary: protocol.pageWorkerSummary,
            handoffEvidenceSummary: protocol.pageEvidenceSummary,
            handoffVisibilityMode: toVisibilityMode(sendability),
            handoffHref: `/sales-followups/${topOpportunity.id}`,
          }
        : latestMeeting
          ? {
              handoffSource: "contact-detail",
              handoffTarget: "meeting-detail",
              handoffReason: english
                ? "The next useful move belongs in meeting follow-through before any stronger outward wording is chosen."
                : "在决定更强的对外措辞前，下一步最有价值的动作先属于会议后续推进。",
              handoffBoundary: protocol.pageBoundarySummary[0],
              handoffPrerequisite: null,
              handoffDependency: null,
              handoffRisk: english
                ? "Do not jump straight into outreach if the meeting trace still holds the unresolved next-step context."
                : "如果未解决的下一步上下文还留在会议记录里，就不要直接跳进对外触达。",
              handoffDecisionRequest: protocol.pageDecisionRequest[0],
              handoffNextAction: english
                ? "Open meeting detail"
                : "打开会议详情",
              handoffWorkerSummary: protocol.pageWorkerSummary,
              handoffEvidenceSummary: protocol.pageEvidenceSummary,
              handoffVisibilityMode: toVisibilityMode(sendability),
              handoffHref: `/meetings/${latestMeeting.id}`,
            }
          : null,
    ]),
  });

  return {
    rootDataAttributes: {
      "data-conversation-chain-extension-page": "true",
      "data-conversation-chain-extension-kind": "contact-detail",
    },
    eyebrow: english
      ? "Conversation chain / Contact detail"
      : "沟通链 / 联系人详情",
    title: english
      ? `${contact.name} contact chain detail`
      : `${contact.name} 联系人链路详情`,
    description: english
      ? `${contact.company?.name ?? "No linked company"} · ${contact.email ?? "No email"} · ${stageLabel}`
      : `${contact.company?.name ?? "未关联公司"} · ${contact.email ?? "无邮箱"} · ${stageLabel}`,
    actions: compactLinks([
      topOpportunity
        ? {
            label: english ? "Open sales follow-up" : "打开销售跟进",
            href: `/sales-followups/${topOpportunity.id}`,
          }
        : latestMeeting
          ? {
              label: english ? "Open meeting detail" : "打开会议详情",
              href: `/meetings/${latestMeeting.id}`,
            }
          : null,
      contact.company
        ? {
            label: english ? "Open company detail" : "打开公司详情",
            href: `/companies/${contact.company.id}`,
            variant: "secondary",
          }
        : null,
      topOpportunity
        ? {
            label: english
              ? "Open conversation detail"
              : "打开沟通详情",
            href: `/conversations/${topOpportunity.id}`,
            variant: "ghost",
          }
        : null,
    ]),
    briefingLabel: english
      ? "Current contact chain judgement"
      : "当前联系人链路判断",
    navigation,
    protocol,
    chips: [
      {
        label: english ? "Relationship routing" : "关系路由",
        tone: "sky",
      },
      {
        label: formatSendabilityLabel(sendability, english),
        tone: sendability === "internal-only" ? "amber" : "emerald",
      },
      {
        label: stageLabel,
        tone: "violet",
      },
    ],
    secondarySummaryItems: [
      {
        label: english ? "Current node" : "当前节点",
        value: english ? "Contact detail" : "联系人详情",
      },
      {
        label: english ? "Relationship stage" : "关系阶段",
        value: stageLabel,
      },
      {
        label: english ? "Linked company" : "关联公司",
        value: contact.company?.name ?? (english ? "None" : "暂无"),
      },
      {
        label: english ? "Latest meeting" : "最近会议",
        value: latestMeeting?.title ?? (english ? "None yet" : "暂无"),
      },
      {
        label: english ? "Open blockers" : "当前卡点",
        value: english
          ? `${contact.blockers.length}`
          : `${contact.blockers.length} 个`,
      },
      {
        label: english ? "Last interaction" : "最近互动",
        value: contact.lastInteractionAt
          ? formatConversationChainDateLabel(
              contact.lastInteractionAt,
              english,
              formatDateLabel,
            )
          : english
            ? "No interaction yet"
            : "暂无互动",
      },
    ],
    boundaryLabel: english
      ? "Boundary and relationship route"
      : "边界与关系路由",
    actionLabel: english ? "Available next actions" : "可直接执行的动作",
    evidenceLabel: english ? "Evidence drawer" : "证据抽屉",
    evidenceCountLabel: english
      ? `${
          buildEntityEvidenceGroups({
            english,
            entityName: contact.name,
            summary: briefingSummary,
            blocker: topBlocker?.blockerText ?? null,
            nextAction: topOpportunityNextAction ?? null,
            latestMemory: contact.memoryEntries[0]?.content ?? null,
            latestMeeting:
              normalizeDisplayText(latestMeeting?.note?.summary, english) ??
              latestMeeting?.opportunity?.title ??
              null,
          }).length
        } grouped tracks`
      : `${
          buildEntityEvidenceGroups({
            english,
            entityName: contact.name,
            summary: briefingSummary,
            blocker: topBlocker?.blockerText ?? null,
            nextAction: topOpportunityNextAction ?? null,
            latestMemory: contact.memoryEntries[0]?.content ?? null,
            latestMeeting:
              normalizeDisplayText(latestMeeting?.note?.summary, english) ??
              latestMeeting?.opportunity?.title ??
              null,
          }).length
        } 组依据`,
    evidenceGroups: buildEntityEvidenceGroups({
      english,
      entityName: contact.name,
      summary: briefingSummary,
      blocker: topBlocker?.blockerText ?? null,
      nextAction: topOpportunityNextAction ?? null,
      latestMemory: contact.memoryEntries[0]?.content ?? null,
      latestMeeting:
        normalizeDisplayText(latestMeeting?.note?.summary, english) ??
        latestMeeting?.opportunity?.title ??
        null,
    }),
    stageBadge: topOpportunity
      ? (stageLabels[topOpportunity.stage] ?? stageLabel)
      : english
        ? "Relationship review"
        : "关系复核",
  };
}

export function buildMeetingConversationChainExtensionModel({
  meeting,
  english,
  stageLabels,
}: {
  meeting: MeetingDetailForChain;
  english: boolean;
  stageLabels: StageLabels;
}): ConversationChainExtensionPageModel {
  const nextDetailType =
    meeting.opportunity && (meeting.note?.summary || meeting.blockers.length)
      ? "delivery-review"
      : meeting.opportunity
        ? "delivery-walkthrough"
        : null;
  const nextDetailLabel =
    nextDetailType === "delivery-review"
      ? english
        ? "delivery review"
        : "交付复核"
      : nextDetailType === "delivery-walkthrough"
        ? english
          ? "delivery walkthrough"
          : "交付走查"
        : english
          ? "internal follow-through"
          : "内部后续推进";
  const stageLabel =
    (meeting.opportunity ? stageLabels[meeting.opportunity.stage] : null) ??
    (english ? "Meeting follow-through" : "会议跟进");
  const sendability = meeting.opportunity
    ? meeting.blockers.length
      ? "safe-with-boundary"
      : "customer-facing-with-boundary"
    : "internal-only";
  const priority: UnifiedDetailNodePriority =
    meeting.opportunity?.riskLevel === "CRITICAL" || meeting.blockers.length
      ? "urgent"
      : meeting.opportunity
        ? "important"
        : "watch";
  const topBlocker = meeting.blockers[0] ?? null;
  const briefingSummary = normalizeDisplayText(
    meeting.briefingSnapshot?.payload.summary,
    english,
  );
  const meetingOpportunityNextAction = normalizeDisplayText(
    meeting.opportunity?.nextAction,
    english,
  );
  const meetingNextNode = meeting.opportunity
    ? nextDetailType === "delivery-review"
      ? {
          type: "delivery-review" as const,
          href: `/delivery-reviews/${meeting.opportunity.id}`,
          label: english ? "Delivery review detail" : "交付复核详情",
          summary: english
            ? "Move here once the meeting has enough summary and risk context to support a review handoff."
            : "当会议已经积累了足够的摘要和风险上下文，可以承接复核交接时，切到这里。",
        }
      : {
          type: "delivery-walkthrough" as const,
          href: `/delivery-walkthroughs/${meeting.opportunity.id}`,
          label: english
            ? "Delivery walkthrough detail"
            : "交付走查详情",
          summary: english
            ? "Move here once the next useful action belongs in walkthrough or activation explanation."
            : "如果下一步最有价值的动作属于走查或激活说明，就切到这里。",
        }
    : null;
  const meetingToDeliveryHandoff = meeting.opportunity
    ? nextDetailType === "delivery-review"
      ? {
          handoffSource: "meeting-detail" as const,
          handoffTarget: "delivery-review" as const,
          handoffReason: english
            ? "The meeting has enough context to pass work into delivery-side review instead of keeping it trapped in notes."
            : "这场会议已经积累了足够上下文，可以把工作交给交付侧复核，而不是继续把它困在会议记录里。",
          handoffBoundary: "",
          handoffPrerequisite: null as string | null,
          handoffDependency: meetingOpportunityNextAction ?? null,
          handoffRisk: english
            ? "Do not let a delivery review handoff outrun blocker, prerequisite or sendability reality."
            : "不要让交付复核交接跑在阻塞、前提或发送边界现实前面。",
          handoffDecisionRequest: "",
          handoffNextAction: "",
          handoffWorkerSummary: [] as string[],
          handoffEvidenceSummary: [] as string[],
          handoffVisibilityMode: "internal-only" as const,
          handoffHref: `/delivery-reviews/${meeting.opportunity.id}`,
        }
      : {
          handoffSource: "meeting-detail" as const,
          handoffTarget: "delivery-walkthrough" as const,
          handoffReason: english
            ? "The meeting has enough context to pass work into delivery-side walkthrough instead of keeping it trapped in notes."
            : "这场会议已经积累了足够上下文，可以把工作交给交付侧走查，而不是继续把它困在会议记录里。",
          handoffBoundary: "",
          handoffPrerequisite: null as string | null,
          handoffDependency: meetingOpportunityNextAction ?? null,
          handoffRisk: english
            ? "Do not let a delivery walkthrough handoff outrun blocker, prerequisite or sendability reality."
            : "不要让交付走查交接跑在阻塞、前提或发送边界现实前面。",
          handoffDecisionRequest: "",
          handoffNextAction: "",
          handoffWorkerSummary: [] as string[],
          handoffEvidenceSummary: [] as string[],
          handoffVisibilityMode: "internal-only" as const,
          handoffHref: `/delivery-walkthroughs/${meeting.opportunity.id}`,
        }
    : null;

  const protocol = createPageReportingProtocol({
    pageJudgement: english
      ? "Use the meeting page as the follow-through detail before the chain jumps into delivery review, walkthrough or the next conversation ask."
      : "当前应先把会议页当作后续推进详情，再决定链路切进交付复核、交付走查还是下一次沟通请求。",
    pageJudgementReason:
      briefingSummary ??
      (meeting.opportunity
        ? english
          ? `${meeting.title} already affects ${meeting.opportunity.title}, so this page now needs to decide which review or walkthrough node should take over next.`
          : `${meeting.title} 当前已经直接影响 ${meeting.opportunity.title}，所以这页现在要决定下一步该由哪个复核或走查节点接手。`
        : english
          ? `${meeting.title} still mainly behaves like internal preparation, so the page should keep the chain honest before anyone treats the meeting like delivered certainty.`
          : `${meeting.title} 当前仍主要表现为内部准备，所以在任何人把会议说成已交付确定性前，这页要先把链路说诚实。`),
    pageWhyItMatters: [
      meeting.opportunity
        ? english
          ? `This meeting is already tied to ${meeting.opportunity.title}, so the next review or walkthrough decision now directly changes commercial continuity.`
          : `这场会议已经挂在 ${meeting.opportunity.title} 上，所以接下来选复核还是走查，会直接改变商业推进连续性。`
        : english
          ? "Without a linked opportunity, meeting detail still matters because it decides whether next-step context should stay internal or route into another accountable node."
          : "即使当前没有关联机会，会议详情也很重要，因为它会决定下一步上下文是继续停在内部，还是交给另一个负责节点。",
      topBlocker
        ? english
          ? `The current blocker (${topBlocker.title}) means this meeting cannot be retold as smooth progress without boundary.`
          : `当前卡点（${topBlocker.title}）意味着这场会议不能在没有边界的情况下被重讲成顺利推进。`
        : english
          ? "The meeting page now has enough action, note and memory context to route the next move without pretending the answer is already final."
          : "当前会议页已经积累了足够的行动、记录和记忆上下文，可以在不假装结论已经最终确定的前提下路由下一步。",
      english
        ? "The current page already groups summary, action items, blockers, commitments and meeting memory here, so the remaining work is choosing the right next detail."
        : "当前页已经把摘要、行动项、阻塞、承诺和会议记忆收在这里，所以剩下真正的工作是选对下一张详情页。",
    ],
    pageActionSummary: [
      english
        ? "The current follow-through surface already groups meeting summary, action items, blockers and approval-sensitive next steps."
        : "当前后续推进面已经把会议摘要、行动项、阻塞和审批敏感下一步收在一起。",
      meeting.note?.summary
        ? english
          ? "The meeting summary is already explicit, so the chain can now choose review or walkthrough without replaying the whole note first."
          : "会议摘要已经明确，所以链路现在可以直接选择复核还是走查，而不用先重放整份记录。"
        : english
          ? "Even without a finished summary, the meeting is already kept in an honest internal-prep state instead of faking a finished outcome."
          : "即使还没有完整摘要，这场会议也已经保持在诚实的内部准备状态，而不是假装结果已经收口。",
      english
        ? "Boundary, sendability and the next accountable handoff are already visible before anyone turns the meeting into a customer-facing claim."
        : "在任何人把会议说成客户可见承诺前，边界、发送边界和下一位负责交接人都已经先挂在前台。",
    ],
    pageDecisionRequest: [
      english
        ? `Confirm whether ${meeting.title} should now move into ${nextDetailLabel} next.`
        : `确认 ${meeting.title} 现在下一步应该切进「${nextDetailLabel}」。`,
      english
        ? "Confirm whether the next move can stay customer-facing-with-boundary, or whether this meeting still belongs in internal-only or review-before-send."
        : "确认下一步现在能否保持客户可见且带边界，还是这场会议仍应该停在内部处理或发送前复核。",
    ],
    pageNextAction: buildActions({
      primary: meeting.opportunity
        ? nextDetailType === "delivery-review"
          ? {
              label: english ? "Open delivery review" : "打开交付复核",
              href: `/delivery-reviews/${meeting.opportunity.id}`,
            }
          : {
              label: english ? "Open delivery walkthrough" : "打开交付走查",
              href: `/delivery-walkthroughs/${meeting.opportunity.id}`,
            }
        : meeting.company
          ? {
              label: english ? "Open company detail" : "打开公司详情",
              href: `/companies/${meeting.company.id}`,
            }
          : {
              label: english ? "Stay on meeting detail" : "继续查看会议详情",
              href: `/meetings/${meeting.id}`,
            },
      secondary: [
        meeting.contacts[0]
          ? {
              label: english ? "Open contact detail" : "打开联系人详情",
              href: `/contacts/${meeting.contacts[0].id}`,
              variant: "secondary" as const,
            }
          : null,
        meeting.opportunity
          ? {
              label: english ? "Open conversation detail" : "打开沟通详情",
              href: `/conversations/${meeting.opportunity.id}`,
              variant: "ghost" as const,
            }
          : null,
      ],
    }),
    pageBoundarySummary: [
      english
        ? "Meeting detail can route follow-through, but it still cannot quietly turn a meeting note, action item or positive reaction into commitment."
        : "会议详情可以负责路由后续推进，但会议记录、行动项或积极反馈不能被直接读成承诺。",
      topBlocker
        ? english
          ? `Current blocker: ${trimText(topBlocker.blockerText, 92)}`
          : `当前卡点：${trimText(topBlocker.blockerText, 92)}`
        : english
          ? "If next-step ownership, prerequisite or delivery boundary is still unclear, keep this page visibly reversible."
          : "如果下一步负责人、前提或交付边界仍不清楚，就让这页继续保持显式可回退。",
      english
        ? "Any outward retell that leaves this page must keep prerequisite, dependency, risk and non-commitment visible."
        : "任何从这页往外走的转述，都必须继续把前提、依赖、风险和非承诺挂在前台。",
    ],
    pageEvidenceSummary: [
      english
        ? `${meeting.actionItems.length} action items, ${meeting.memoryFacts.length} memory facts and ${meeting.blockers.length} blockers are grouped below without interrupting the main narrative.`
        : `当前 ${meeting.actionItems.length} 条行动项、${meeting.memoryFacts.length} 条记忆事实和 ${meeting.blockers.length} 个阻塞都已分组收在下方，不会打断主叙事。`,
      english
        ? "Meeting summary, worker preparation and handoff traces remain available on demand."
        : "会议摘要、工作准备和交接记录会继续保留在附注层按需可看。",
    ],
    pageWorkerSummary: [
      english
        ? "Meeting follow-through keeps sales, delivery and review from inheriting a next step that is still trapped in notes."
        : "会议后续推进会防止销售、交付和复核接手一条还困在会议记录里的下一步。",
      english
        ? "Worker / pack / scenario cues stay visible so the next review or walkthrough handoff remains explainable."
        : "工作项、依据包和场景提示会继续可见，保证下一次复核或走查交接仍然可解释。",
    ],
    pagePrioritySignal: english
      ? priority === "urgent"
        ? "Urgent handoff"
        : priority === "important"
          ? "Important transition"
          : "Watch the chain"
      : priority === "urgent"
        ? "紧急交接"
        : priority === "important"
          ? "重要切换"
          : "继续观察",
    pageEscalationHint: meeting.opportunity
      ? english
        ? "If anyone wants this meeting to imply firmer scope, timing or delivery certainty than the current note supports, escalate into review first."
        : "如果任何人想让这场会议暗示出比当前记录支撑更强的范围、时间或交付确定性，就先升级进复核。"
      : english
        ? "Without a linked opportunity, do not let this page pretend a commercial next step is already committed."
        : "在没有关联机会的情况下，不要让这页假装商业下一步已经承诺。",
  });

  const meetingHandoffs = compactHandoffs([
    meeting.contacts[0]
      ? {
          handoffSource: "contact-detail",
          handoffTarget: "meeting-detail",
          handoffReason: english
            ? "The relationship route is clear enough to move into concrete meeting follow-through."
            : "当前关系路由已经够清楚，现在应该切进具体的会议后续推进。",
          handoffBoundary: protocol.pageBoundarySummary[0],
          handoffPrerequisite: protocol.pageBoundarySummary[1] ?? null,
          handoffDependency: meetingOpportunityNextAction ?? null,
          handoffRisk: english
            ? "Do not retell a meeting more confidently than the actual summary, blocker and commitment picture supports."
            : "不要把会议讲得比真实的摘要、阻塞和承诺画面更有把握。",
          handoffDecisionRequest: protocol.pageDecisionRequest[0],
          handoffNextAction: protocol.pageNextAction[0].label,
          handoffWorkerSummary: protocol.pageWorkerSummary,
          handoffEvidenceSummary: protocol.pageEvidenceSummary,
          handoffVisibilityMode: toVisibilityMode(sendability),
          handoffHref: `/meetings/${meeting.id}`,
        }
      : null,
    meeting.company
      ? {
          handoffSource: "company-detail",
          handoffTarget: "meeting-detail",
          handoffReason: english
            ? "The account route now needs concrete meeting evidence before the next commercial judgement."
            : "当前账户路由在做下一次商业判断前，需要更具体的会议证据。",
          handoffBoundary: protocol.pageBoundarySummary[0],
          handoffPrerequisite: protocol.pageBoundarySummary[1] ?? null,
          handoffDependency: meetingOpportunityNextAction ?? null,
          handoffRisk: english
            ? "Meeting detail must stay a follow-through page, not a place that silently manufactures delivery certainty."
            : "会议详情必须继续是一张后续推进页，而不是一个悄悄制造交付确定性的地方。",
          handoffDecisionRequest: protocol.pageDecisionRequest[0],
          handoffNextAction: protocol.pageNextAction[0].label,
          handoffWorkerSummary: protocol.pageWorkerSummary,
          handoffEvidenceSummary: protocol.pageEvidenceSummary,
          handoffVisibilityMode: toVisibilityMode(sendability),
          handoffHref: `/meetings/${meeting.id}`,
        }
      : null,
    meetingToDeliveryHandoff
      ? {
          ...meetingToDeliveryHandoff,
          handoffBoundary: protocol.pageBoundarySummary[0],
          handoffDecisionRequest: protocol.pageDecisionRequest[1],
          handoffNextAction: protocol.pageNextAction[0].label,
          handoffWorkerSummary: protocol.pageWorkerSummary,
          handoffEvidenceSummary: protocol.pageEvidenceSummary,
          handoffVisibilityMode: toVisibilityMode(sendability),
        }
      : null,
  ]);

  const navigation = createUnifiedDetailNavigationModel({
    currentNode: {
      detailNodeType: "meeting-detail",
      detailNodeSummary: protocol.pageJudgement,
      detailNodeStage: stageLabel,
      detailNodeBoundary: protocol.pageBoundarySummary[0],
      detailNodeAudienceMode: english ? "Meeting follow-through" : "会议跟进",
      detailNodeSendabilityMode: sendability,
      detailNodeStrengthMode: english ? "Review routing" : "复核路由",
      detailNodePrev: meeting.contacts[0]
        ? {
            type: "contact-detail",
            href: `/contacts/${meeting.contacts[0].id}`,
            label: english ? "Contact detail" : "联系人详情",
            summary: english
              ? "Return here if the next move still depends on relationship routing before review or walkthrough."
              : "如果下一步在进入复核或走查前仍依赖关系路由，就回到这里。",
          }
        : meeting.company
          ? {
              type: "company-detail",
              href: `/companies/${meeting.company.id}`,
              label: english ? "Company detail" : "公司详情",
              summary: english
                ? "Return here if the account route still matters more than meeting follow-through."
                : "如果当前比会议后续推进更重要的仍是账户路由，就回到这里。",
            }
          : null,
      detailNodeNext: meetingNextNode,
      detailNodeCurrentReason: protocol.pageJudgementReason,
      detailNodePriority: priority,
      detailNodeNavigationHint: english
        ? "Use this detail when the team must decide whether the meeting should now flow into review, walkthrough or another accountable conversation node."
        : "当团队需要决定这场会议下一步该流向复核、走查，或其他可追踪沟通节点时，停在这里。",
    },
    handoffs:
      meetingHandoffs.length > 0
        ? meetingHandoffs
        : [
            {
              handoffSource: "meeting-detail",
              handoffTarget: "meeting-detail",
              handoffReason: english
                ? "No linked contact, company or delivery node is available yet, so the chain stays on meeting detail until a valid handoff target appears."
                : "当前还没有可用的联系人、公司或交付节点，所以链路先停在会议详情，直到出现有效交接目标。",
              handoffBoundary: protocol.pageBoundarySummary[0],
              handoffPrerequisite: protocol.pageBoundarySummary[1] ?? null,
              handoffDependency: null,
              handoffRisk: english
                ? "Do not interpret this fallback as a commitment signal; it only preserves an honest internal follow-through state."
                : "不要把这个兜底解读成承诺信号；它只是在保持诚实的内部后续推进状态。",
              handoffDecisionRequest: protocol.pageDecisionRequest[0],
              handoffNextAction: protocol.pageNextAction[0].label,
              handoffWorkerSummary: protocol.pageWorkerSummary,
              handoffEvidenceSummary: protocol.pageEvidenceSummary,
              handoffVisibilityMode: toVisibilityMode(sendability),
              handoffHref: `/meetings/${meeting.id}`,
            },
          ],
  });

  return {
    rootDataAttributes: {
      "data-conversation-chain-extension-page": "true",
      "data-conversation-chain-extension-kind": "meeting-detail",
    },
    eyebrow: english
      ? "Conversation chain / Meeting detail"
      : "沟通链 / 会议详情",
    title: english
      ? `${meeting.title} meeting chain detail`
      : `${meeting.title} 会议链路详情`,
    description: english
      ? `${meeting.company?.name ?? "No linked company"} · ${meeting.contacts[0]?.name ?? "No linked contact"} · ${stageLabel}`
      : `${meeting.company?.name ?? "未关联公司"} · ${meeting.contacts[0]?.name ?? "暂无关联联系人"} · ${stageLabel}`,
    actions: compactLinks([
      meeting.opportunity
        ? nextDetailType === "delivery-review"
          ? {
              label: english ? "Open delivery review" : "打开交付复核",
              href: `/delivery-reviews/${meeting.opportunity.id}`,
            }
          : {
              label: english ? "Open delivery walkthrough" : "打开交付走查",
              href: `/delivery-walkthroughs/${meeting.opportunity.id}`,
            }
        : null,
      meeting.contacts[0]
        ? {
            label: english ? "Open contact detail" : "打开联系人详情",
            href: `/contacts/${meeting.contacts[0].id}`,
            variant: "secondary",
          }
        : null,
      meeting.opportunity
        ? {
            label: english ? "Open conversation detail" : "打开沟通详情",
            href: `/conversations/${meeting.opportunity.id}`,
            variant: "ghost",
          }
        : null,
    ]),
    briefingLabel: english
      ? "Current meeting chain judgement"
      : "当前会议链路判断",
    navigation,
    protocol,
    chips: [
      {
        label: english ? "Meeting follow-through" : "会议跟进",
        tone: "sky",
      },
      {
        label: formatSendabilityLabel(sendability, english),
        tone: sendability === "internal-only" ? "amber" : "emerald",
      },
      {
        label:
          nextDetailType === "delivery-review"
            ? english
              ? "review route"
              : "复核路径"
            : nextDetailType === "delivery-walkthrough"
              ? english
                ? "walkthrough route"
                : "走查路径"
              : english
                ? "internal prep"
                : "内部准备",
        tone: "violet",
      },
    ],
    secondarySummaryItems: [
      {
        label: english ? "Current node" : "当前节点",
        value: english ? "Meeting detail" : "会议详情",
      },
      {
        label: english ? "Active stage" : "当前阶段",
        value: stageLabel,
      },
      {
        label: english ? "Linked company" : "关联公司",
        value: meeting.company?.name ?? (english ? "None" : "暂无"),
      },
      {
        label: english ? "Primary contact" : "主要联系人",
        value: meeting.contacts[0]?.name ?? (english ? "None" : "暂无"),
      },
      {
        label: english ? "Action items" : "行动项",
        value: english
          ? `${meeting.actionItems.length}`
          : `${meeting.actionItems.length} 条`,
      },
      {
        label: english ? "Meeting date" : "会议时间",
        value: formatConversationChainDateLabel(
          meeting.startsAt,
          english,
          formatDateLabel,
        ),
      },
    ],
    boundaryLabel: english
      ? "Boundary and meeting follow-through"
      : "边界与会议跟进",
    actionLabel: english ? "Available next actions" : "可直接执行的动作",
    evidenceLabel: english ? "Evidence drawer" : "证据抽屉",
    evidenceCountLabel: english
      ? `${
          buildEntityEvidenceGroups({
            english,
            entityName: meeting.title,
            summary:
              normalizeDisplayText(meeting.note?.summary, english) ??
              briefingSummary,
            blocker: topBlocker?.blockerText ?? null,
            nextAction: meetingOpportunityNextAction ?? null,
            latestMemory: meeting.memoryEntries[0]?.content ?? null,
            latestMeeting:
              meeting.note?.confirmations ?? meeting.note?.keyDecisions ?? null,
          }).length
        } grouped tracks`
      : `${
          buildEntityEvidenceGroups({
            english,
            entityName: meeting.title,
            summary:
              normalizeDisplayText(meeting.note?.summary, english) ??
              briefingSummary,
            blocker: topBlocker?.blockerText ?? null,
            nextAction: meetingOpportunityNextAction ?? null,
            latestMemory: meeting.memoryEntries[0]?.content ?? null,
            latestMeeting:
              meeting.note?.confirmations ?? meeting.note?.keyDecisions ?? null,
          }).length
        } 组依据`,
    evidenceGroups: buildEntityEvidenceGroups({
      english,
      entityName: meeting.title,
      summary:
        normalizeDisplayText(meeting.note?.summary, english) ?? briefingSummary,
      blocker: topBlocker?.blockerText ?? null,
      nextAction: meetingOpportunityNextAction ?? null,
      latestMemory: meeting.memoryEntries[0]?.content ?? null,
      latestMeeting:
        meeting.note?.confirmations ?? meeting.note?.keyDecisions ?? null,
    }),
    stageBadge: meeting.opportunity
      ? `${stageLabel} · ${meeting.opportunity.riskLevel}`
      : english
        ? "Meeting prep"
        : "会议准备态",
  };
}

function buildActions({
  primary,
  secondary,
}: {
  primary: PageNextAction;
  secondary: Array<PageNextAction | null>;
}) {
  return [
    primary,
    ...secondary.filter((item): item is PageNextAction => Boolean(item)),
  ];
}

function compactLinks(links: Array<HeaderLink | null>) {
  return links.filter((item): item is HeaderLink => Boolean(item));
}

function compactHandoffs(handoffs: Array<CrossDetailHandoff | null>) {
  return handoffs.filter((item): item is CrossDetailHandoff => Boolean(item));
}

function normalizeDisplayText(value: string | null | undefined, english: boolean) {
  if (!value) return undefined;
  const normalized = value
    .replace(/。{2,}/g, "。")
    .replace(/\.。/g, "。")
    .replace(/！。/g, "！")
    .replace(/？。/g, "？")
    .trim();

  return formatSeededBusinessCopy(normalized, english);
}

function formatContactRelationshipStage(
  stage: string | null | undefined,
  english: boolean,
) {
  if (!stage) return null;
  const normalized = stage.trim();
  const labels: Record<string, { en: string; zh: string }> = {
    active: { en: "Active", zh: "活跃" },
    warm: { en: "Warm", zh: "升温" },
    cold: { en: "Cold", zh: "冷淡" },
    dormant: { en: "Dormant", zh: "沉睡" },
    evaluating: { en: "Evaluating", zh: "评估中" },
    blocked: { en: "Blocked", zh: "受阻" },
    new: { en: "New", zh: "新关系" },
  };
  const label = labels[normalized.toLowerCase()];
  if (label) return english ? label.en : label.zh;
  return english ? normalized : normalized.replace(/[-_]/g, " ");
}

function formatSendabilityLabel(sendability: string, english: boolean) {
  if (english) return sendability;
  if (sendability === "customer-facing-with-boundary") {
    return "面向客户但带边界";
  }
  if (sendability === "safe-with-boundary") {
    return "带边界可推进";
  }
  if (sendability === "review-before-send") {
    return "发送前复核";
  }
  if (sendability === "boundary-only") {
    return "仅边界说明";
  }
  if (sendability === "customer-facing") {
    return "面向客户";
  }
  if (sendability === "internal-only") {
    return "仅内部";
  }
  return sendability;
}

function buildEntityEvidenceGroups({
  english,
  entityName,
  summary,
  blocker,
  nextAction,
  latestMemory,
  latestMeeting,
}: {
  english: boolean;
  entityName: string;
  summary: string | null | undefined;
  blocker: string | null;
  nextAction: string | null;
  latestMemory: string | null;
  latestMeeting: string | null;
}) {
  return [
    {
      groupId: "replay",
      label: english ? "Replay" : "回放",
      items: [
        summary ??
          (english
            ? `${entityName} already has a replayable judgement summary for the next chain handoff.`
            : `${entityName} 当前已经有一条可复述的判断摘要，可供下一次链路交接复用。`),
      ],
    },
    {
      groupId: "memory",
      label: english ? "Memory" : "记忆",
      items: [
        latestMemory ??
          (english
            ? "Recent memory is still thin, so the chain stays honest instead of inventing context."
            : "最近记忆仍然偏薄，所以这条链会继续保持诚实，而不是虚构上下文。"),
      ],
    },
    {
      groupId: "boundary_trace",
      label: english ? "Boundary trace" : "边界记录",
      items: [
        blocker ??
          (english
            ? "No dominant blocker is currently outranking the chain, but the page still keeps non-commitment visible."
            : "当前没有单一阻塞压过整条链，但页面仍继续把非承诺提示挂在前台。"),
      ],
    },
    {
      groupId: "worker_output",
      label: english ? "Worker output" : "工作输出",
      items: [
        nextAction ??
          (english
            ? "The next action is still being prepared, so the handoff stays explicit instead of pretending execution is already settled."
            : "下一步动作仍在准备中，所以交接会继续显式说出来，而不是假装执行已经收口。"),
      ],
    },
    {
      groupId: "historical_changes",
      label: english ? "Historical changes" : "历史变化",
      items: [
        latestMeeting ??
          (english
            ? "The latest chain change is still captured as meeting / review context and remains available on demand."
            : "最近一次链路变化仍保留在会议 / 复核上下文里，可继续按需查看。"),
      ],
    },
  ];
}

function toVisibilityMode(
  sendability: string,
): CrossDetailHandoffVisibilityMode {
  if (sendability === "customer-facing-with-boundary") {
    return "customer-facing-with-boundary";
  }
  if (sendability === "review-before-send") {
    return "review-before-send";
  }
  if (sendability === "boundary-only") {
    return "boundary-only";
  }
  if (sendability === "customer-facing") {
    return "customer-facing";
  }
  return "internal-only";
}
