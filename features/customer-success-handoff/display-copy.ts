import type {
  CustomerSuccessExternalDraftViewModel,
  CustomerSuccessHandoffPageModel,
  CustomerSuccessInternalActionViewModel,
  CustomerSuccessPolicyTag,
} from "@/features/customer-success-handoff/detail-model";
import type {
  PageDrilldownLink,
  PageEvidenceGroup,
  PageEvidenceTarget,
  PageNextAction,
  PageReportingProtocol,
  PageWorkerAssignment,
} from "@/lib/presentation/reporting-protocol";
import { formatSeededBusinessCopy } from "@/lib/presentation/seeded-business-copy";
import type {
  CrossDetailHandoff,
  UnifiedDetailNavigationLink,
  UnifiedDetailNavigationModel,
  UnifiedDetailNavigationNode,
} from "@/lib/presentation/unified-detail-navigation";

const ZH_DISPLAY_REPLACEMENTS: Array<[RegExp, string]> = [
  [
    /Helm v2 ingested ([^.。]+) into the meeting-to-action runtime\./gi,
    "会议推进链路已接入：$1。",
  ],
  [/Customer Success Queue \/ Inbox v1\.1/g, "客户成功接手队列"],
  [/Customer Success/g, "客户成功"],
  [/CUSTOMER SUCCESS/g, "客户成功"],
  [/Customer success chain \/ Queue and inbox/g, "客户成功推进链"],
  [/Customer success handoff/g, "客户成功接手"],
  [/customer success handoff/g, "客户成功接手"],
  [/Customer success/g, "客户成功"],
  [/customer success/g, "客户成功"],
  [/inbound reply/g, "客户回复"],
  [/Inbound reply/g, "客户回复"],
  [/clarification/g, "澄清"],
  [/Clarification/g, "澄清"],
  [/\brecommendations\b/g, "判断建议"],
  [/\brecommendation\b/g, "判断建议"],
  [
    /Waiting for the first meaningful external outcome after the human send handoff \/ manual send record\./gi,
    "正在等待人工发送交接或手动发送记录后的第一条有效外部反馈。",
  ],
  [/meaningful external outcome/g, "有效外部反馈"],
  [/Meaningful external outcome/g, "有效外部反馈"],
  [/meaningful external reply/g, "有效外部回复"],
  [/Meaningful external reply/g, "有效外部回复"],
  [/post-send outcome/g, "发送后反馈"],
  [/Post-send outcome/g, "发送后反馈"],
  [/post-send signal/g, "发送后信号"],
  [/Post-send signal/g, "发送后信号"],
  [/send handoff/g, "发送交接"],
  [/Send handoff/g, "发送交接"],
  [/manual send record/g, "手动发送记录"],
  [/Manual send record/g, "手动发送记录"],
  [/Review request detail/g, "复核请求详情"],
  [/review request detail/g, "复核请求详情"],
  [/Review request/g, "复核请求"],
  [/review request/g, "复核请求"],
  [/review-sensitive/g, "复核敏感"],
  [/Review-sensitive/g, "复核敏感"],
  [/pending review/g, "待复核"],
  [/Pending review/g, "待复核"],
  [/formal review/g, "正式复核"],
  [/Formal review/g, "正式复核"],
  [/success inbox/g, "客户成功收件箱"],
  [/Success inbox/g, "客户成功收件箱"],
  [/success memory \/ campaign/g, "成功记忆 / 主线"],
  [/Success memory \/ campaign/g, "成功记忆 / 主线"],
  [/success context/g, "客户成功上下文"],
  [/success queue/g, "客户成功队列"],
  [/success check/g, "成功复盘"],
  [/Success check/g, "成功复盘"],
  [/expansion review/g, "扩展复盘"],
  [/Expansion review/g, "扩展复盘"],
  [/review-before-send/g, "发送前复核"],
  [/Review-before-send/g, "发送前复核"],
  [/Review posture/g, "复核状态"],
  [/review posture/g, "复核状态"],
  [/Review outcome/g, "复核结果"],
  [/review outcome/g, "复核结果"],
  [/Reviewer provenance/g, "复核来源"],
  [/reviewer provenance/g, "复核来源"],
  [/Reviewed by/g, "复核人"],
  [/reviewer/g, "复核人"],
  [/review follow-through/g, "复核推进"],
  [/Review follow-through/g, "复核推进"],
  [/follow-through/g, "后续推进"],
  [/Follow-through/g, "后续推进"],
  [/follow-up/g, "跟进"],
  [/Follow-up/g, "跟进"],
  [/non-commitment/g, "非承诺"],
  [/Non-commitment/g, "非承诺"],
  [/commitment/g, "承诺"],
  [/Commitment/g, "承诺"],
  [/review hold(s)?/g, "复核暂缓"],
  [/Review hold(s)?/g, "复核暂缓"],
  [/review trace(s)?/g, "复核记录"],
  [/Review trace(s)?/g, "复核记录"],
  [/review line/g, "复核线"],
  [/Review line/g, "复核线"],
  [/review/g, "复核"],
  [/Review/g, "复核"],
  [/blocker/g, "阻塞"],
  [/Blocker/g, "阻塞"],
  [/issue follow-through/g, "问题推进"],
  [/Issue follow-through/g, "问题推进"],
  [/issue/g, "问题"],
  [/Issue/g, "问题"],
  [/escalation/g, "升级处理"],
  [/Escalation/g, "升级处理"],
  [/ownership/g, "接手责任"],
  [/Ownership/g, "接手责任"],
  [/owner/g, "负责人"],
  [/Owner/g, "负责人"],
  [/decision owner/g, "拍板负责人"],
  [/Decision owner/g, "拍板负责人"],
  [/decision posture/g, "拍板姿态"],
  [/Decision posture/g, "拍板姿态"],
  [/decision/g, "拍板"],
  [/Decision/g, "拍板"],
  [/handoff/g, "交接"],
  [/Handoff/g, "交接"],
  [/detail/g, "详情"],
  [/Detail/g, "详情"],
  [/queue item(s)?/g, "队列事项"],
  [/Queue item(s)?/g, "队列事项"],
  [/queue/g, "队列"],
  [/Queue/g, "队列"],
  [/inbox thread(s)?/g, "收件箱线程"],
  [/Inbox thread(s)?/g, "收件箱线程"],
  [/inbox/g, "收件箱"],
  [/Inbox/g, "收件箱"],
  [/memory fact(s)?/g, "记忆事实"],
  [/Memory fact(s)?/g, "记忆事实"],
  [/thread replay/g, "线程回放"],
  [/Thread replay/g, "线程回放"],
  [/risk pressure/g, "风险压力"],
  [/Risk pressure/g, "风险压力"],
  [/customer-visible wording/g, "客户可见表达"],
  [/customer-visible/g, "客户可见"],
  [/Customer-visible/g, "客户可见"],
  [/customer-facing/g, "面向客户"],
  [/customer-safe/g, "客户可发送"],
  [/safe outward posture/g, "安全对外状态"],
  [/promise wording/g, "承诺式表达"],
  [/Promise wording/g, "承诺式表达"],
  [/sendable/g, "可发送"],
  [/Sendable/g, "可发送"],
  [/outward wording/g, "对外表达"],
  [/wording/g, "措辞"],
  [/sendability/g, "可发送边界"],
  [/Sendability/g, "可发送边界"],
  [/send handoff/g, "发送交接"],
  [/Send handoff/g, "发送交接"],
  [/prerequisite/g, "前置条件"],
  [/Prerequisite/g, "前置条件"],
  [/external send/g, "对外发送"],
  [/External send/g, "对外发送"],
  [/external draft/g, "对外草稿"],
  [/External draft/g, "对外草稿"],
  [/internal action/g, "内部动作"],
  [/Internal action/g, "内部动作"],
  [/internal-only/g, "仅内部"],
  [/Internal-only/g, "仅内部"],
  [/internal/g, "内部"],
  [/Internal/g, "内部"],
  [/external/g, "对外"],
  [/External/g, "对外"],
  [/founder/g, "创始人"],
  [/Founder/g, "创始人"],
  [/sales/g, "销售"],
  [/Sales/g, "销售"],
  [/delivery/g, "交付"],
  [/Delivery/g, "交付"],
  [/proposal/g, "方案"],
  [/Proposal/g, "方案"],
  [/approval required/g, "需要批准"],
  [/Approval required/g, "需要批准"],
  [/advisory/g, "建议"],
  [/Advisory/g, "建议"],
  [/PLAYBOOK/g, "处理方式"],
  [/playbook/g, "处理方式"],
  [/Playbook/g, "处理方式"],
  [/POLICY/g, "治理边界"],
  [/policy/g, "治理边界"],
  [/Policy/g, "治理边界"],
  [/AUTHORITY/g, "授权边界"],
  [/authority/g, "授权边界"],
  [/Authority/g, "授权边界"],
  [/ATTENTION/g, "注意事项"],
  [/attention/g, "注意事项"],
  [/Attention/g, "注意事项"],
  [/draft/g, "草稿"],
  [/Draft/g, "草稿"],
  [/dependency/g, "依赖"],
  [/Dependency/g, "依赖"],
  [/boundary/g, "边界"],
  [/Boundary/g, "边界"],
  [/boundary-only/g, "仅边界"],
  [/Boundary-only/g, "仅边界"],
  [/routing cue/g, "路线提示"],
  [/Routing cue/g, "路线提示"],
  [/routing decision/g, "路线判断"],
  [/Routing decision/g, "路线判断"],
  [/canonical system of record/g, "正式记录源"],
  [/system of record/g, "记录源"],
  [/operational appendix/g, "操作依据附注"],
  [/Operational appendix/g, "操作依据附注"],
  [/operational surface/g, "操作面"],
  [/Operational surface/g, "操作面"],
  [/operating entry point/g, "经营入口"],
  [/Operating entry point/g, "经营入口"],
  [/outward move/g, "对外动作"],
  [/Outward move/g, "对外动作"],
  [/surface/g, "页面"],
  [/Surface/g, "页面"],
  [/accountable/g, "可追责"],
  [/Accountable/g, "可追责"],
  [/account/g, "账户"],
  [/Account/g, "账户"],
  [/company/g, "公司"],
  [/Company/g, "公司"],
  [/route/g, "路线"],
  [/Route/g, "路线"],
  [/routing/g, "路线"],
  [/Routing/g, "路线"],
  [/certainty/g, "确定性"],
  [/Certainty/g, "确定性"],
  [/readiness/g, "准备度"],
  [/Readiness/g, "准备度"],
  [/pressure/g, "压力"],
  [/Pressure/g, "压力"],
  [/dedicated/g, "专用"],
  [/Dedicated/g, "专用"],
  [/evidence/g, "证据"],
  [/Evidence/g, "证据"],
  [/expansion/g, "扩展"],
  [/Expansion/g, "扩展"],
  [/judgement-first/g, "判断优先"],
  [/Judgement-first/g, "判断优先"],
  [/output/g, "输出"],
  [/Output/g, "输出"],
  [/summary/g, "摘要"],
  [/Summary/g, "摘要"],
  [/renewal-risk/g, "续约风险"],
  [/Renewal-risk/g, "续约风险"],
  [/repair/g, "修复"],
  [/Repair/g, "修复"],
  [/next-step/g, "下一步"],
  [/Next-step/g, "下一步"],
  [/contained/g, "可控"],
  [/Contained/g, "可控"],
  [/artifact/g, "记录产物"],
  [/Artifact/g, "记录产物"],
  [/trace/g, "记录"],
  [/Trace/g, "记录"],
  [/audit/g, "审计"],
  [/Audit/g, "审计"],
  [/replay/g, "回放"],
  [/Replay/g, "回放"],
  [/provider/g, "服务方"],
  [/Provider/g, "服务方"],
  [/stage model/g, "阶段模型"],
  [/Stage model/g, "阶段模型"],
  [/stage/g, "阶段"],
  [/Stage/g, "阶段"],
  [/success/g, "成功"],
  [/Success/g, "成功"],
  [/WORKER/g, "协作助手"],
  [/worker/g, "协作助手"],
  [/Worker/g, "协作助手"],
  [/CONSTITUTION/g, "边界依据"],
  [/Constitution/g, "边界依据"],
  [/MEMORY/g, "记忆"],
  [/Memory/g, "记忆"],
  [/GOAL \/ CAMPAIGN/g, "目标主线"],
  [/Goal \/ Campaign/g, "目标主线"],
  [/ROLE \/ AUDIENCE/g, "角色与受众"],
  [/Role \/ Audience/g, "角色与受众"],
  [/audience mode/g, "受众模式"],
  [/Audience mode/g, "受众模式"],
  [/approval/g, "批准"],
  [/Approval/g, "批准"],
  [/approved/g, "已批准"],
  [/Approved/g, "已批准"],
  [/\blive\b/g, "实时"],
  [/\bLive\b/g, "实时"],
  [/\bactive\b/g, "活跃"],
  [/\bActive\b/g, "活跃"],
  [/thread/g, "线程"],
  [/Thread/g, "线程"],
  [/\bitem\b/g, "事项"],
  [/\bItem\b/g, "事项"],
  [/customer/g, "客户"],
  [/Customer/g, "客户"],
  [/orchestration/g, "编排"],
  [/Orchestration/g, "编排"],
  [/workflow/g, "流程"],
  [/Workflow/g, "流程"],
];

const ZH_DISPLAY_CLEANUPS: Array<[RegExp, string]> = [
  [/\bQueue trace\b/g, "队列依据"],
  [/\bHandoff trace\b/g, "交接依据"],
  [/发送前 复核/g, "发送前复核"],
  [/客户 成功/g, "客户成功"],
  [/客户成功 队列/g, "客户成功队列"],
  [/客户成功 收件箱/g, "客户成功收件箱"],
  [/客户成功 链 \/ 队列 与 收件箱/g, "客户成功推进链"],
  [/客户成功 链/g, "客户成功链"],
  [/客户成功 接手面/g, "客户成功接手面"],
  [/客户成功 接手/g, "客户成功接手"],
  [/客户成功 队列/g, "客户成功队列"],
  [/客户成功 收件箱/g, "客户成功收件箱"],
  [/打开 客户成功/g, "打开客户成功"],
  [/打开 复核/g, "打开复核"],
  [/打开 扩展/g, "打开扩展"],
  [/打开 成功/g, "打开成功"],
  [/打开 方案/g, "打开方案"],
  [/共享 复核/g, "共享复核"],
  [/复核 暂停/g, "复核暂停"],
  [/当前 阻塞/g, "当前卡点"],
  [/当前阻塞/g, "当前卡点"],
  [/开放 承诺/g, "开放承诺"],
  [/账户 上下文/g, "账户上下文"],
  [/公司 详情/g, "公司详情"],
  [/客户成功 工作/g, "客户成功工作"],
  [/页面 上/g, "页面上"],
  [
    /承诺，也不等于自动 客户可发送 可发送边界/g,
    "承诺，也不等于自动满足客户可发送边界",
  ],
  [/阻塞 证据/g, "阻塞证据"],
  [/边界 记录/g, "边界记录"],
  [/可发送边界 记录/g, "可发送边界记录"],
  [/交接 证据/g, "交接证据"],
  [/客户可见 确定性/g, "客户可见确定性"],
  [/客户-success/g, "客户成功"],
  [/边界-only/g, "仅边界"],
  [/条 队列事项/g, "条队列事项"],
  [/条 收件箱 线程/g, "条收件箱线程"],
  [/打开 成功复盘/g, "打开成功复盘"],
  [/当前 复核 交接/g, "当前复核交接"],
  [/当前 客户成功 判断/g, "当前客户成功判断"],
  [/客户成功 当前/g, "客户成功当前"],
  [/客户成功 动作/g, "客户成功动作"],
  [/复核 压力/g, "复核压力"],
  [/依赖 压力/g, "依赖压力"],
  [/账户 路线/g, "账户路线"],
  [/复核 窗口/g, "复核窗口"],
  [/后续推进 变体/g, "后续推进变体"],
  [/用户已 复核/g, "用户已复核"],
  [/当前边界 POSTURE/g, "当前边界状态"],
  [/内部 备注/g, "内部备注"],
  [/内部提醒 记录产物/g, "内部提醒"],
  [/交接 后面/g, "交接后面"],
  [/边界、发送性与 非承诺/g, "边界、发送与非承诺"],
  [/这张面上/g, "这张页面上"],
  [/待复核结果面/g, "待复核结果"],
  [/复核 跟进/g, "复核推进"],
  [/后续推进 稳定/g, "后续推进稳定"],
  [/复核 暂缓/g, "复核暂缓"],
  [/复核 线/g, "复核线"],
  [/拍板 负责人/g, "拍板负责人"],
  [/拍板 姿态/g, "拍板姿态"],
  [/负责人ship/g, "接手责任"],
  [/负责人 ship/g, "接手责任"],
  [/接手 负责人/g, "接手负责人"],
  [/接手责任 压力/g, "接手压力"],
  [/接手责任 pressure/g, "接手压力"],
  [/widened pressure/g, "升级压力"],
  [/路线ing/g, "路线"],
  [/contained 问题/g, "可控问题"],
  [/raw 线程/g, "原始线程"],
  [/thin/g, "轻量"],
  [/\bcue\b/g, "提示"],
  [/context/g, "上下文"],
  [/baseline/g, "基线"],
  [/proxy/g, "替代判断"],
  [/platform/g, "平台"],
  [/workflow/g, "流程"],
  [/canonical/g, "正式"],
  [/posture/g, "姿态"],
  [/window/g, "窗口"],
  [/line/g, "线"],
  [/joint launch brief/g, "联合发布简报"],
  [/pilot rescue/g, "试点恢复"],
  [/Pilot rescue/g, "试点恢复"],
  [/materials/g, "材料"],
  [/note/g, "备注"],
  [/backing/g, "支持"],
  [/Outcome/g, "结果"],
  [/outcome/g, "结果"],
  [/dependencies/g, "依赖"],
  [/priority conflict/g, "优先级冲突"],
  [/v1\.1/g, ""],
  [/\s{2,}/g, " "],
];

export function formatCustomerSuccessDisplayText(
  value: string,
  english: boolean,
) {
  if (english) return value;

  let formatted = value;
  for (const [pattern, replacement] of ZH_DISPLAY_REPLACEMENTS) {
    formatted = formatted.replace(pattern, replacement);
  }
  for (const [pattern, replacement] of ZH_DISPLAY_CLEANUPS) {
    formatted = formatted.replace(pattern, replacement);
  }

  return formatSeededBusinessCopy(formatted, english).trim();
}

export function formatCustomerSuccessHandoffDetailModel(
  model: CustomerSuccessHandoffPageModel,
  english: boolean,
): CustomerSuccessHandoffPageModel {
  if (english) return model;

  const evidenceGroups = formatEvidenceGroupsForDetail(model, english);

  return {
    ...model,
    eyebrow: formatCustomerSuccessDisplayText(model.eyebrow, english),
    title: formatCustomerSuccessDisplayText(model.title, english),
    description: formatCustomerSuccessDisplayText(model.description, english),
    actions: model.actions.map((action) => ({
      ...action,
      label: formatCustomerSuccessDisplayText(action.label, english),
    })),
    briefingLabel: formatCustomerSuccessDisplayText(
      model.briefingLabel,
      english,
    ),
    navigation: formatNavigation(model.navigation, english),
    protocol: formatProtocol(model.protocol, english),
    chips: model.chips.map((chip) => ({
      ...chip,
      label: formatCustomerSuccessDisplayText(chip.label, english),
    })),
    secondarySummaryItems: compactSecondarySummaryItems(
      model.secondarySummaryItems,
      english,
    ),
    recentChangesLabel: formatCustomerSuccessDisplayText(
      model.recentChangesLabel,
      english,
    ),
    recentChangesItems: [],
    resurfaceReasonLabel: formatCustomerSuccessDisplayText(
      model.resurfaceReasonLabel,
      english,
    ),
    resurfaceReasonItems: [],
    processAdvisoryLabel: formatCustomerSuccessDisplayText(
      model.processAdvisoryLabel,
      english,
    ),
    processAdvisoryItems: [],
    policyLabel: formatCustomerSuccessDisplayText(model.policyLabel, english),
    policyItems: [],
    externalDraftsLabel: formatCustomerSuccessDisplayText(
      model.externalDraftsLabel,
      english,
    ),
    externalDrafts: model.externalDrafts.map((draft) =>
      formatExternalDraft(draft, english),
    ),
    actionSummaryLabel: formatCustomerSuccessDisplayText(
      model.actionSummaryLabel,
      english,
    ),
    decisionRequestLabel: formatCustomerSuccessDisplayText(
      model.decisionRequestLabel,
      english,
    ),
    decisionLabel: formatCustomerSuccessDisplayText(
      model.decisionLabel,
      english,
    ),
    decisionItems: [],
    boundaryLabel: formatCustomerSuccessDisplayText(
      model.boundaryLabel,
      english,
    ),
    evidenceSummaryLabel: formatCustomerSuccessDisplayText(
      model.evidenceSummaryLabel,
      english,
    ),
    actionLabel: formatCustomerSuccessDisplayText(model.actionLabel, english),
    internalActionsLabel: formatCustomerSuccessDisplayText(
      model.internalActionsLabel,
      english,
    ),
    internalActions: model.internalActions.map((action) =>
      formatInternalAction(action, english),
    ),
    progressTraceLabel: formatCustomerSuccessDisplayText(
      model.progressTraceLabel,
      english,
    ),
    progressTraceItems: [],
    evidenceLabel: formatCustomerSuccessDisplayText(
      model.evidenceLabel,
      english,
    ),
    evidenceCountLabel: `${evidenceGroups.length} 组依据`,
    evidenceGroups,
    stageBadge: formatCustomerSuccessDisplayText(model.stageBadge, english),
  };
}

function formatProtocol(
  protocol: PageReportingProtocol,
  english: boolean,
): PageReportingProtocol {
  return {
    ...protocol,
    pageJudgement: formatCustomerSuccessDisplayText(
      protocol.pageJudgement,
      english,
    ),
    pageJudgementReason: formatCustomerSuccessDisplayText(
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
      ? formatCustomerSuccessDisplayText(protocol.pageEscalationHint, english)
      : protocol.pageEscalationHint,
    pagePrioritySignal: protocol.pagePrioritySignal
      ? formatCustomerSuccessDisplayText(protocol.pagePrioritySignal, english)
      : protocol.pagePrioritySignal,
    pageEvidenceLinks: protocol.pageEvidenceLinks?.map((link) =>
      formatEvidenceLink(link, english),
    ),
    pageEvidenceGroups: protocol.pageEvidenceGroups?.map((group) =>
      formatPageEvidenceGroup(group, english),
    ),
  };
}

function formatNavigation(
  navigation: UnifiedDetailNavigationModel,
  english: boolean,
): UnifiedDetailNavigationModel {
  return {
    currentNode: formatNavigationNode(navigation.currentNode, english),
    handoffs: navigation.handoffs.map((handoff) =>
      formatHandoff(handoff, english),
    ),
  };
}

function formatNavigationNode(
  node: UnifiedDetailNavigationNode,
  english: boolean,
): UnifiedDetailNavigationNode {
  return {
    ...node,
    detailNodeSummary: formatCustomerSuccessDisplayText(
      node.detailNodeSummary,
      english,
    ),
    detailNodeStage: formatCustomerSuccessDisplayText(
      node.detailNodeStage,
      english,
    ),
    detailNodeBoundary: formatCustomerSuccessDisplayText(
      node.detailNodeBoundary,
      english,
    ),
    detailNodeAudienceMode: formatCustomerSuccessDisplayText(
      node.detailNodeAudienceMode,
      english,
    ),
    detailNodeSendabilityMode: node.detailNodeSendabilityMode
      ? formatCustomerSuccessDisplayText(
          node.detailNodeSendabilityMode,
          english,
        )
      : node.detailNodeSendabilityMode,
    detailNodeStrengthMode: node.detailNodeStrengthMode
      ? formatCustomerSuccessDisplayText(node.detailNodeStrengthMode, english)
      : node.detailNodeStrengthMode,
    detailNodePrev: node.detailNodePrev
      ? formatNavigationLink(node.detailNodePrev, english)
      : null,
    detailNodeNext: node.detailNodeNext
      ? formatNavigationLink(node.detailNodeNext, english)
      : null,
    detailNodeCurrentReason: formatCustomerSuccessDisplayText(
      node.detailNodeCurrentReason,
      english,
    ),
    detailNodeNavigationHint: formatCustomerSuccessDisplayText(
      node.detailNodeNavigationHint,
      english,
    ),
  };
}

function formatNavigationLink(
  link: UnifiedDetailNavigationLink,
  english: boolean,
): UnifiedDetailNavigationLink {
  return {
    ...link,
    label: formatCustomerSuccessDisplayText(link.label, english),
    summary: formatCustomerSuccessDisplayText(link.summary, english),
  };
}

function formatHandoff(
  handoff: CrossDetailHandoff,
  english: boolean,
): CrossDetailHandoff {
  return {
    ...handoff,
    handoffReason: formatCustomerSuccessDisplayText(
      handoff.handoffReason,
      english,
    ),
    handoffBoundary: formatCustomerSuccessDisplayText(
      handoff.handoffBoundary,
      english,
    ),
    handoffPrerequisite: handoff.handoffPrerequisite
      ? formatCustomerSuccessDisplayText(handoff.handoffPrerequisite, english)
      : handoff.handoffPrerequisite,
    handoffDependency: handoff.handoffDependency
      ? formatCustomerSuccessDisplayText(handoff.handoffDependency, english)
      : handoff.handoffDependency,
    handoffRisk: formatCustomerSuccessDisplayText(handoff.handoffRisk, english),
    handoffDecisionRequest: formatCustomerSuccessDisplayText(
      handoff.handoffDecisionRequest,
      english,
    ),
    handoffNextAction: formatCustomerSuccessDisplayText(
      handoff.handoffNextAction,
      english,
    ),
    handoffWorkerSummary: formatTextList(handoff.handoffWorkerSummary, english),
    handoffEvidenceSummary: formatTextList(
      handoff.handoffEvidenceSummary,
      english,
    ),
  };
}

function compactSecondarySummaryItems(
  items: CustomerSuccessHandoffPageModel["secondarySummaryItems"],
  english: boolean,
) {
  const formattedItems = items.map((item) => ({
    label: formatCustomerSuccessDisplayText(item.label, english),
    value: formatCustomerSuccessDisplayText(item.value, english),
  }));
  const preferredLabels = [
    "当前阶段",
    "接手负责人",
    "最近一次显式用户触点",
    "发送边界",
  ];

  return preferredLabels
    .map((label) => formattedItems.find((item) => item.label === label))
    .filter((item): item is (typeof formattedItems)[number] => Boolean(item));
}

function formatInternalAction(
  action: CustomerSuccessInternalActionViewModel,
  english: boolean,
): CustomerSuccessInternalActionViewModel {
  return {
    ...action,
    title: formatCustomerSuccessDisplayText(action.title, english),
    summary: formatCustomerSuccessDisplayText(action.summary, english),
    stateLabel: formatCustomerSuccessDisplayText(action.stateLabel, english),
    actionTypeLabel: formatCustomerSuccessDisplayText(
      action.actionTypeLabel,
      english,
    ),
    internalOnlyLabel: formatCustomerSuccessDisplayText(
      action.internalOnlyLabel,
      english,
    ),
    approvalSummary: formatNullableText(action.approvalSummary, english),
    executionSummary: formatNullableText(action.executionSummary, english),
    resultSummary: formatNullableText(action.resultSummary, english),
    policyLabels: action.policyLabels.map((label) =>
      formatPolicyTag(label, english),
    ),
  };
}

function formatExternalDraft(
  draft: CustomerSuccessExternalDraftViewModel,
  english: boolean,
): CustomerSuccessExternalDraftViewModel {
  return {
    ...draft,
    kindLabel: formatCustomerSuccessDisplayText(draft.kindLabel, english),
    title: formatCustomerSuccessDisplayText(draft.title, english),
    summary: formatCustomerSuccessDisplayText(draft.summary, english),
    intent: formatCustomerSuccessDisplayText(draft.intent, english),
    whyNow: formatCustomerSuccessDisplayText(draft.whyNow, english),
    reviewStateLabel: formatCustomerSuccessDisplayText(
      draft.reviewStateLabel,
      english,
    ),
    unresolved: formatCustomerSuccessDisplayText(draft.unresolved, english),
    overstateRisk: formatCustomerSuccessDisplayText(
      draft.overstateRisk,
      english,
    ),
    policyCueLabels: draft.policyCueLabels.map((label) =>
      formatPolicyTag(label, english),
    ),
    queueStatusLabel: formatCustomerSuccessDisplayText(
      draft.queueStatusLabel,
      english,
    ),
    queueSummary: formatCustomerSuccessDisplayText(draft.queueSummary, english),
    queueBlockedSummary: formatCustomerSuccessDisplayText(
      draft.queueBlockedSummary,
      english,
    ),
    reviewOutcome: {
      ...draft.reviewOutcome,
      cueLabels: draft.reviewOutcome.cueLabels.map((label) =>
        formatPolicyTag(label, english),
      ),
      reviewPosture: formatCustomerSuccessDisplayText(
        draft.reviewOutcome.reviewPosture,
        english,
      ),
      reviewerIdentity: formatNullableText(
        draft.reviewOutcome.reviewerIdentity,
        english,
      ),
      revisionRequest: formatNullableText(
        draft.reviewOutcome.revisionRequest,
        english,
      ),
      sendHandoff: formatNullableText(draft.reviewOutcome.sendHandoff, english),
      manualSendRecorded: formatNullableText(
        draft.reviewOutcome.manualSendRecorded,
        english,
      ),
      helmBoundaryReminder: formatCustomerSuccessDisplayText(
        draft.reviewOutcome.helmBoundaryReminder,
        english,
      ),
      queueStatusLabel: formatCustomerSuccessDisplayText(
        draft.reviewOutcome.queueStatusLabel,
        english,
      ),
      queueSummary: formatCustomerSuccessDisplayText(
        draft.reviewOutcome.queueSummary,
        english,
      ),
      queueHandoffSummary: formatNullableText(
        draft.reviewOutcome.queueHandoffSummary,
        english,
      ),
    },
    postSendOutcome: draft.postSendOutcome
      ? {
          ...draft.postSendOutcome,
          cueLabels: draft.postSendOutcome.cueLabels.map((label) =>
            formatPolicyTag(label, english),
          ),
          currentPosture: formatCustomerSuccessDisplayText(
            draft.postSendOutcome.currentPosture,
            english,
          ),
          firstOutcomeSummary: formatNullableText(
            draft.postSendOutcome.firstOutcomeSummary,
            english,
          ),
          whatChanged: formatCustomerSuccessDisplayText(
            draft.postSendOutcome.whatChanged,
            english,
          ),
          unresolved: formatCustomerSuccessDisplayText(
            draft.postSendOutcome.unresolved,
            english,
          ),
          overstateRisk: formatCustomerSuccessDisplayText(
            draft.postSendOutcome.overstateRisk,
            english,
          ),
          queueStatusLabel: formatCustomerSuccessDisplayText(
            draft.postSendOutcome.queueStatusLabel,
            english,
          ),
          queueSummary: formatCustomerSuccessDisplayText(
            draft.postSendOutcome.queueSummary,
            english,
          ),
          queueBlockedSummary: formatCustomerSuccessDisplayText(
            draft.postSendOutcome.queueBlockedSummary,
            english,
          ),
          deltaSummary: formatCustomerSuccessDisplayText(
            draft.postSendOutcome.deltaSummary,
            english,
          ),
          resurfaceReason: formatCustomerSuccessDisplayText(
            draft.postSendOutcome.resurfaceReason,
            english,
          ),
          progressSummary: formatCustomerSuccessDisplayText(
            draft.postSendOutcome.progressSummary,
            english,
          ),
        }
      : null,
  };
}

function formatEvidenceGroupsForDetail(
  model: CustomerSuccessHandoffPageModel,
  english: boolean,
) {
  const formattedGroups = model.evidenceGroups.map((group) => ({
    ...group,
    label: formatCustomerSuccessDisplayText(group.label, english),
    items: formatTextList(group.items, english),
  }));
  const appendixItems = [
    ...model.recentChangesItems,
    ...model.resurfaceReasonItems,
    ...model.processAdvisoryItems,
    ...model.policyItems,
    ...model.decisionItems,
    ...model.progressTraceItems,
  ];

  if (!appendixItems.length) {
    return formattedGroups;
  }

  return [
    {
      groupId: "governance-progress-appendix",
      label: "治理和进度附注",
      items: formatTextList(appendixItems, english),
    },
    ...formattedGroups,
  ];
}

function formatNextAction(
  action: PageNextAction,
  english: boolean,
): PageNextAction {
  return {
    ...action,
    label: formatCustomerSuccessDisplayText(action.label, english),
  };
}

function formatEvidenceLink(
  link: PageDrilldownLink,
  english: boolean,
): PageDrilldownLink {
  return {
    ...link,
    label: formatCustomerSuccessDisplayText(link.label, english),
  };
}

function formatWorkerAssignment(
  assignment: PageWorkerAssignment,
  english: boolean,
): PageWorkerAssignment {
  return {
    ...assignment,
    title: formatCustomerSuccessDisplayText(assignment.title, english),
    summary: formatCustomerSuccessDisplayText(assignment.summary, english),
    items: formatTextList(assignment.items, english),
    chips: assignment.chips?.map((chip) =>
      formatCustomerSuccessDisplayText(chip, english),
    ),
  };
}

function formatPageEvidenceGroup(
  group: PageEvidenceGroup,
  english: boolean,
): PageEvidenceGroup {
  return {
    ...group,
    label: formatCustomerSuccessDisplayText(group.label, english),
    items: group.items.map((item) =>
      typeof item === "string"
        ? formatCustomerSuccessDisplayText(item, english)
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
    label: formatCustomerSuccessDisplayText(target.label, english),
    summary: target.summary
      ? formatCustomerSuccessDisplayText(target.summary, english)
      : target.summary,
  };
}

function formatPolicyTag(
  tag: CustomerSuccessPolicyTag,
  english: boolean,
): CustomerSuccessPolicyTag {
  return {
    ...tag,
    label: formatCustomerSuccessDisplayText(tag.label, english),
  };
}

function formatTextList(values: string[], english: boolean) {
  return values.map((value) =>
    formatCustomerSuccessDisplayText(value, english),
  );
}

function formatNullableText(value: string | null, english: boolean) {
  return value == null
    ? value
    : formatCustomerSuccessDisplayText(value, english);
}
