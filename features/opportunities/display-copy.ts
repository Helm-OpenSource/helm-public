import type { ProactiveFlow } from "@/lib/presentation/proactive-mechanism";
import { formatSeededBusinessCopy } from "@/lib/presentation/seeded-business-copy";
import type {
  PageDrilldownLink,
  PageEvidenceGroup,
  PageEvidenceTarget,
  PageNextAction,
  PageReportingProtocol,
  PageWorkerAssignment,
} from "@/lib/presentation/reporting-protocol";

type OpportunityGuidanceItem = {
  title: string;
  body: string;
  href?: string;
  meta?: string;
};

const ZH_REPLACEMENTS: Array<[RegExp, string]> = [
  [
    /Helm v2 ingested ([^.。]+) into the meeting-to-action runtime\./gi,
    "会议推进链路已接入：$1。",
  ],
  [
    /Customer-visible language must remain review-before-send and non-commitment-only\./g,
    "客户可见表达必须保持发送前复核，并且只能作为非承诺表达。",
  ],
  [/Open opportunity replay/gi, "查看机会回放"],
  [/Open proposal page/gi, "打开方案页"],
  [/Open package page/gi, "打开方案包页"],
  [/Open current next step/gi, "查看当前下一步"],
  [/Open active due window/gi, "查看当前时间窗口"],
  [/Open latest audit event/gi, "查看最新审计事件"],
  [/Open prior audit event/gi, "查看前一条审计事件"],
  [/package-shaping/gi, "方案包整形"],
  [/proposal-shaping/gi, "方案整形"],
  [/proposal \/ package/gi, "方案/方案包"],
  [/package \/ proposal/gi, "方案包/方案"],
  [/review-before-send/gi, "发送前复核"],
  [/non-commitment-only/gi, "仅非承诺"],
  [/non-commitment/gi, "非承诺"],
  [/formal review/gi, "正式复核"],
  [/review-first/gi, "先复核"],
  [/decision-first/gi, "先判断"],
  [/owner-focused/gi, "负责人视角"],
  [/action workspace/gi, "动作处理区"],
  [/operating review/gi, "经营复盘"],
  [/operating surface/gi, "经营处理面"],
  [/operating sheet/gi, "经营处理单"],
  [/pipeline executor/gi, "机会执行器"],
  [/pipeline inventory/gi, "机会清单"],
  [/pipeline list/gi, "机会清单"],
  [/\bpipeline\b/gi, "机会清单"],
  [/customer-facing/gi, "面向客户"],
  [/customer-visible/gi, "客户可见"],
  [/\bcustomer\b/gi, "客户"],
  [/commitments/gi, "承诺"],
  [/commitment/gi, "承诺"],
  [/blockers/gi, "阻塞"],
  [/blocker/gi, "阻塞"],
  [/recommendations/gi, "建议"],
  [/recommendation/gi, "建议"],
  [/briefing snapshot/gi, "简报快照"],
  [/supporting facts/gi, "支撑事实"],
  [/facts/gi, "事实"],
  [/evidence bundle/gi, "证据包"],
  [/evidence drawer/gi, "依据来源"],
  [/evidence signals/gi, "证据信号"],
  [/\bevidence\b/gi, "证据"],
  [/Replay payload/gi, "回放载荷"],
  [/Audit payload/gi, "审计载荷"],
  [/Memory payload/gi, "记忆载荷"],
  [/Handoff payload/gi, "交接载荷"],
  [/\breplay\b/gi, "回放"],
  [/\baudit\b/gi, "审计"],
  [/\bmemory\b/gi, "记忆"],
  [/\bhandoff\b/gi, "交接"],
  [/\bflow\b/gi, "路径"],
  [/\bskill\b/gi, "能力"],
  [/\bworker\b/gi, "协作助手"],
  [/\boutput\b/gi, "输出"],
  [/\bowner\b/gi, "负责人"],
  [/\bSales\b/g, "销售"],
  [/\bsales\b/g, "销售"],
  [/\bDelivery\b/g, "交付"],
  [/\bdelivery\b/g, "交付"],
  [/\bFounder\b/g, "创始人"],
  [/\bfounder\b/g, "创始人"],
  [/\bOperator\b/g, "操作人"],
  [/\boperator\b/g, "操作人"],
  [/approval-required/gi, "需要审批"],
  [/approval required/gi, "需要审批"],
  [/approvals/gi, "审批中心"],
  [/approval/gi, "审批"],
  [/\breview\b/gi, "复核"],
  [/\bProposal\b/g, "方案"],
  [/\bproposal\b/g, "方案"],
  [/\bPackage\b/g, "方案包"],
  [/\bpackage\b/g, "方案包"],
  [/next actions/gi, "下一步动作"],
  [/next action/gi, "下一步动作"],
  [/\bfollow-up\b/gi, "跟进"],
  [/\bfollow-through\b/gi, "持续跟进"],
  [/\bframing\b/gi, "表达框架"],
  [/\bwording\b/gi, "措辞"],
  [/\bpromise\b/gi, "承诺"],
  [/\bscope\b/gi, "范围"],
  [/\bdependency\b/gi, "依赖"],
  [/\bboundary\b/gi, "边界"],
  [/\bpolicy\b/gi, "策略"],
  [/\bexternal\b/gi, "对外"],
  [/\binternal\b/gi, "内部"],
  [/\bdraft\b/gi, "草稿"],
  [/\btrust\b/gi, "信任"],
  [/\brisk\b/gi, "风险"],
  [/\bpressure\b/gi, "压力"],
  [/\bcontext\b/gi, "上下文"],
  [/\bcandidate\b/gi, "候选事项"],
  [/\bgovernance\b/gi, "治理"],
  [/\bruntime\b/gi, "运行记录"],
  [/\bingested\b/gi, "已接入"],
  [/\bpage\b/gi, "页"],
  [/\band\b/gi, "和"],
  [/\bwith\b/gi, "和"],
  [/\bwindow\b/gi, "窗口"],
  [/\blive\b/gi, "活跃"],
  [/\bstatic\b/gi, "静态"],
  [/\bCRM\b/g, "客户台账"],
  [/\bADVANCING\b/g, "推进中"],
  [/\bREADY\b/g, "已就绪"],
  [/\bSUGGEST_ONLY\b/g, "仅建议"],
  [/\bREQUIRES_APPROVAL\b/g, "需要审批"],
];

const ZH_CLEANUPS: Array<[RegExp, string]> = [
  [/发送前 复核/g, "发送前复核"],
  [/正式 复核/g, "正式复核"],
  [/先 复核/g, "先复核"],
  [/先 判断/g, "先判断"],
  [/方案包 整形/g, "方案包整形"],
  [/方案 整形/g, "方案整形"],
  [/方案\s+\/\s+方案包/g, "方案/方案包"],
  [/销售\s+\/\s+交付/g, "销售/交付"],
  [/复核 包/g, "复核包"],
  [/复核 队列/g, "复核队列"],
  [/复核 备注/g, "复核备注"],
  [/发送前复核 和 非承诺/g, "发送前复核和非承诺"],
  [/客户 可见/g, "客户可见"],
  [/面向 客户/g, "面向客户"],
  [/对外 承诺/g, "对外承诺"],
  [/对外 动作/g, "对外动作"],
  [/内部 澄清/g, "内部澄清"],
  [/动作 处理区/g, "动作处理区"],
  [/机会清单 压力/g, "机会压力"],
  [/机会清单 清单/g, "机会清单"],
  [/方案包 页面/g, "方案包页"],
  [/方案 页面/g, "方案页"],
  [/打开 方案包/g, "打开方案包"],
  [/打开 方案/g, "打开方案"],
  [/回放、记忆 和 审批/g, "回放、记忆和审批"],
  [/回放 载荷/g, "回放载荷"],
  [/审计 载荷/g, "审计载荷"],
  [/记忆 载荷/g, "记忆载荷"],
  [/交接 载荷/g, "交接载荷"],
  [/路径：/g, "路径："],
  [/能力：/g, "能力："],
  [/协作助手：/g, "协作助手："],
  [/客户台账 表格/g, "客户台账"],
  [/台账 面板/g, "台账面板"],
  [/判断 面/g, "判断面"],
  [/经营 处理/g, "经营处理"],
  [/经营 常规/g, "经营常规"],
  [/事件性 汇报/g, "事件性汇报"],
  [/周期性 汇报/g, "周期性汇报"],
  [/请求式 汇报/g, "请求式汇报"],
  [/\s{2,}/g, " "],
];

export function formatOpportunityDisplayText(value: string, english: boolean) {
  if (english) return value;

  let formatted = value;
  for (const [pattern, replacement] of ZH_REPLACEMENTS) {
    formatted = formatted.replace(pattern, replacement);
  }
  for (const [pattern, replacement] of ZH_CLEANUPS) {
    formatted = formatted.replace(pattern, replacement);
  }

  return formatSeededBusinessCopy(formatted, english);
}

export function formatOpportunityGuidanceItems(
  items: OpportunityGuidanceItem[],
  english: boolean,
) {
  return items.map((item) => ({
    ...item,
    title: formatOpportunityDisplayText(item.title, english),
    body: formatOpportunityDisplayText(item.body, english),
    meta: item.meta
      ? formatOpportunityDisplayText(item.meta, english)
      : item.meta,
  }));
}

export function formatOpportunityReportingProtocol(
  protocol: PageReportingProtocol,
  english: boolean,
): PageReportingProtocol {
  if (english) return protocol;

  return {
    ...protocol,
    pageJudgement: formatOpportunityDisplayText(
      protocol.pageJudgement,
      english,
    ),
    pageJudgementReason: formatOpportunityDisplayText(
      protocol.pageJudgementReason,
      english,
    ),
    pageWhyItMatters: formatTextList(protocol.pageWhyItMatters, english),
    pageActionSummary: formatTextList(protocol.pageActionSummary, english),
    pageDecisionRequest: formatTextList(protocol.pageDecisionRequest, english),
    pageNextAction: protocol.pageNextAction.map((action) =>
      formatNextAction(action, english),
    ),
    pageBoundarySummary: formatTextList(protocol.pageBoundarySummary, english),
    pageEvidenceSummary: formatTextList(protocol.pageEvidenceSummary, english),
    pageWorkerSummary: formatTextList(protocol.pageWorkerSummary, english),
    pageWorkerAssignments: protocol.pageWorkerAssignments?.map((assignment) =>
      formatWorkerAssignment(assignment, english),
    ),
    pageEscalationHint: protocol.pageEscalationHint
      ? formatOpportunityDisplayText(protocol.pageEscalationHint, english)
      : protocol.pageEscalationHint,
    pagePrioritySignal: protocol.pagePrioritySignal
      ? formatOpportunityDisplayText(protocol.pagePrioritySignal, english)
      : protocol.pagePrioritySignal,
    pageEvidenceLinks: protocol.pageEvidenceLinks?.map((link) =>
      formatDrilldownLink(link, english),
    ),
    pageEvidenceGroups: protocol.pageEvidenceGroups?.map((group) =>
      formatEvidenceGroup(group, english),
    ),
  };
}

export function formatOpportunityProactiveFlow(
  flow: ProactiveFlow,
  english: boolean,
): ProactiveFlow {
  if (english) return flow;

  return {
    ...flow,
    flowTitle: formatOpportunityDisplayText(flow.flowTitle, english),
    triggerCondition: formatOpportunityDisplayText(
      flow.triggerCondition,
      english,
    ),
    activeReport: {
      ...flow.activeReport,
      activeReportSummary: formatOpportunityDisplayText(
        flow.activeReport.activeReportSummary,
        english,
      ),
      activeReportReason: formatOpportunityDisplayText(
        flow.activeReport.activeReportReason,
        english,
      ),
      activeReportBoundary: formatTextList(
        flow.activeReport.activeReportBoundary,
        english,
      ),
      activeReportDecisionRequest: flow.activeReport.activeReportDecisionRequest
        ? formatOpportunityDisplayText(
            flow.activeReport.activeReportDecisionRequest,
            english,
          )
        : flow.activeReport.activeReportDecisionRequest,
      activeReportWorkerSummary: formatTextList(
        flow.activeReport.activeReportWorkerSummary,
        english,
      ),
      activeReportEvidenceSummary: formatTextList(
        flow.activeReport.activeReportEvidenceSummary,
        english,
      ),
      activeReportPreparationSummary: formatTextList(
        flow.activeReport.activeReportPreparationSummary,
        english,
      ),
    },
    collaboration: {
      ...flow.collaboration,
      collaborationRequest: formatOpportunityDisplayText(
        flow.collaboration.collaborationRequest,
        english,
      ),
      collaborationSummary: formatOpportunityDisplayText(
        flow.collaboration.collaborationSummary,
        english,
      ),
      collaborationReason: formatOpportunityDisplayText(
        flow.collaboration.collaborationReason,
        english,
      ),
      collaborationBoundary: formatTextList(
        flow.collaboration.collaborationBoundary,
        english,
      ),
      collaborationOwner: formatOpportunityDisplayText(
        flow.collaboration.collaborationOwner,
        english,
      ),
      collaborationWorkerAssignment: formatTextList(
        flow.collaboration.collaborationWorkerAssignment,
        english,
      ),
      collaborationEscalationHint: flow.collaboration
        .collaborationEscalationHint
        ? formatOpportunityDisplayText(
            flow.collaboration.collaborationEscalationHint,
            english,
          )
        : flow.collaboration.collaborationEscalationHint,
      collaborationDecisionRequest: flow.collaboration
        .collaborationDecisionRequest
        ? formatOpportunityDisplayText(
            flow.collaboration.collaborationDecisionRequest,
            english,
          )
        : flow.collaboration.collaborationDecisionRequest,
      collaborationNextStep: formatTextList(
        flow.collaboration.collaborationNextStep,
        english,
      ),
    },
    helmCanDo: formatTextList(flow.helmCanDo, english),
    helmSuggestsOnly: formatTextList(flow.helmSuggestsOnly, english),
    humanDecisionRequired: formatTextList(flow.humanDecisionRequired, english),
    humanLeadRequired: formatTextList(flow.humanLeadRequired, english),
    nextActions: flow.nextActions.map((action) =>
      formatNextAction(action, english),
    ),
    evidenceLinks: flow.evidenceLinks?.map((link) =>
      formatDrilldownLink(link, english),
    ),
  };
}

function formatTextList(values: string[], english: boolean) {
  return values.map((value) => formatOpportunityDisplayText(value, english));
}

function formatNextAction(
  action: PageNextAction,
  english: boolean,
): PageNextAction {
  return {
    ...action,
    label: formatOpportunityDisplayText(action.label, english),
  };
}

function formatDrilldownLink(
  link: PageDrilldownLink,
  english: boolean,
): PageDrilldownLink {
  return {
    ...link,
    label: formatOpportunityDisplayText(link.label, english),
  };
}

function formatWorkerAssignment(
  assignment: PageWorkerAssignment,
  english: boolean,
): PageWorkerAssignment {
  return {
    ...assignment,
    title: formatOpportunityDisplayText(assignment.title, english),
    summary: formatOpportunityDisplayText(assignment.summary, english),
    items: formatTextList(assignment.items, english),
    chips: assignment.chips?.map((chip) =>
      formatOpportunityDisplayText(chip, english),
    ),
  };
}

function formatEvidenceGroup(
  group: PageEvidenceGroup,
  english: boolean,
): PageEvidenceGroup {
  return {
    ...group,
    label: formatOpportunityDisplayText(group.label, english),
    items: group.items.map((item) =>
      typeof item === "string"
        ? formatOpportunityDisplayText(item, english)
        : formatEvidenceTarget(item, english),
    ),
  };
}

function formatEvidenceTarget(
  target: PageEvidenceTarget,
  english: boolean,
): PageEvidenceTarget {
  return {
    ...target,
    label: formatOpportunityDisplayText(target.label, english),
    summary: target.summary
      ? formatOpportunityDisplayText(target.summary, english)
      : target.summary,
  };
}
