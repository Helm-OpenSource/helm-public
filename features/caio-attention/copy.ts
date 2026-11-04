import type { CaioAttentionCategory, CaioAttentionSeverity } from "@/lib/caio-attention/contracts";
import type { CaioAttentionStatus } from "@/lib/caio-attention/state-machine";

import type { CaioAttentionCommandFailure, CaioAttentionDispositionOutcome, CaioAttentionViewerRole } from "./service-contract";
import type { CaioAttentionCommandField } from "./view-model";

type Pair = readonly [zh: string, en: string];
const pick = (english: boolean, pair: Pair) => (english ? pair[1] : pair[0]);

const STATUS: Record<CaioAttentionStatus, Pair> = {
  SUGGESTED: ["待确认", "Awaiting confirmation"],
  DEFERRED: ["已延期", "Deferred"],
  DISPATCHED: ["处置中", "In progress"],
  DISPOSITION_SUBMITTED: ["待复核", "Awaiting review"],
  DISMISSED: ["已驳回", "Dismissed"],
  CANCELLED: ["已撤销", "Cancelled"],
  CLOSED: ["已复核关闭", "Closed after review"],
};
const SEVERITY: Record<CaioAttentionSeverity, Pair> = { warning: ["警告", "Warning"], critical: ["严重", "Critical"] };
const CATEGORY: Record<CaioAttentionCategory, Pair> = {
  business: ["业务", "Business"],
  technical: ["技术", "Technical"],
  compliance: ["合规", "Compliance"],
};
const ROLE: Record<CaioAttentionViewerRole, Pair> = {
  owner: ["确认人", "Owner"],
  primary: ["主责", "Primary"],
  cc: ["知悉", "Informed"],
  escalation: ["升级人", "Escalation"],
  reviewer: ["复核人", "Reviewer"],
  admin: ["监督只读", "Supervisory read"],
};
const FIELD: Record<CaioAttentionCommandField, Pair> = {
  primaryUserId: ["主责", "Primary"],
  ccUserIds: ["知悉", "Informed"],
  escalationUserId: ["升级人", "Escalation"],
  reviewerUserIds: ["复核人", "Reviewers"],
  committedDueAt: ["处置期限", "Handling due"],
};

export const caioAttentionStatusLabel = (english: boolean, status: CaioAttentionStatus) => pick(english, STATUS[status]);
export const caioAttentionSeverityLabel = (english: boolean, severity: CaioAttentionSeverity) => pick(english, SEVERITY[severity]);
export const caioAttentionCategoryLabel = (english: boolean, category: CaioAttentionCategory) => pick(english, CATEGORY[category]);
export const caioAttentionRoleLabel = (english: boolean, role: CaioAttentionViewerRole) => pick(english, ROLE[role]);
export const caioAttentionFieldLabel = (english: boolean, field: CaioAttentionCommandField) => pick(english, FIELD[field]);

const OUTCOME: Record<CaioAttentionDispositionOutcome, Pair> = {
  handled: ["已处置", "Handled"],
  mitigated: ["已缓解，仍需观察", "Mitigated, still watching"],
  not_actionable: ["无需处置", "No action needed"],
};
const FAILURE: Record<CaioAttentionCommandFailure, Pair> = {
  not_found: ["事项不存在或你无权查看。", "The case does not exist or you cannot view it."],
  invalid_status: ["事项状态已变化，请刷新后重试。", "The case status changed; refresh and try again."],
  stale_command_version: ["命令版本已更新，请刷新后重试。", "The command was reissued; refresh and try again."],
  forbidden: ["你不能执行这个操作。", "You cannot perform this operation."],
  stale_reviewer_version: ["复核人名单已调整，请刷新后重试。", "The reviewer set changed; refresh and try again."],
  separation_of_duties: ["提交人、主责和知悉人不能复核。", "The submitter, the primary and informed people cannot review."],
  disposition_not_current: ["这份回执已不是当前有效回执。", "This receipt is no longer the current one."],
  validation_failed: ["填写内容不完整或格式不对。", "Some fields are missing or malformed."],
  intake_closed: ["入口闸门已暂停，暂时不能确认。", "Intake is paused, so confirmation is not possible now."],
  conflict: ["与其他操作冲突，请刷新后重试。", "Another change happened at the same time; refresh and try again."],
  service_unavailable: ["关注事项服务尚未启用，未做任何更改。", "The attention service is not enabled; nothing was changed."],
};

export const caioAttentionOutcomeLabel = (english: boolean, outcome: CaioAttentionDispositionOutcome) => pick(english, OUTCOME[outcome]);
export const caioAttentionFailureLabel = (english: boolean, reason: CaioAttentionCommandFailure) => pick(english, FAILURE[reason]);

/** Shell entry for the attention queue; shown only when `resolveCaioAttentionNavigation` allows it. */
export const CAIO_ATTENTION_DESTINATION = { href: "/caio/attention", labelZh: "运营关注事项", labelEn: "Attention cases" } as const;

export function caioAttentionCopy(english: boolean) {
  const t = (zh: string, en: string) => (english ? en : zh);
  return {
    eyebrow: t("CAIO 运营关注事项", "CAIO operating attention"),
    queueTitle: t("关注事项队列", "Attention queue"),
    queueDescription: t(
      "系统只给建议；确认、处置和复核关闭都由真人完成。本页不外发任何消息。",
      "The system only suggests. People confirm, handle and close each case after review. Nothing is sent outside.",
    ),
    mineTitle: t("我的关注事项", "My attention cases"),
    mineDescription: t(
      "一把手确认后，你作为主责、知悉、升级人或复核人参与的事项。",
      "Cases the owner confirmed where you are the primary, informed, escalation person or a reviewer.",
    ),
    empty: t("目前没有你可以查看的关注事项。", "There are no attention cases you can view."),
    unavailable: t("关注事项服务尚未启用，本页暂无数据。", "The attention service is not enabled yet, so there is nothing to show."),
    shortNo: t("编号", "No."),
    status: t("状态", "Status"),
    severity: t("严重度", "Severity"),
    category: t("类别", "Category"),
    detector: t("探测器", "Detector"),
    object: t("对象", "Object"),
    enterprise: t("委托企业", "Enterprise"),
    createdAt: t("生成时间", "Suggested at"),
    dispatchedAt: t("派发时间", "Dispatched at"),
    dueAt: t("处置期限", "Handling due"),
    yourRoles: t("你的角色", "Your role"),
    routingBlocked: t("预填不满足派发条件，确认前需修改", "Prefill cannot be dispatched as is; edit before confirming"),
    previous: t("上一页", "Previous"),
    next: t("下一页", "Next"),
    pageOf: (page: number, count: number) => t(`第 ${page} / ${count} 页`, `Page ${page} of ${count}`),
    viewQueue: t("全部队列", "Full queue"),
    viewMine: t("我的关注事项", "My cases"),
    none: t("无", "None"),
    prefillTitle: t("系统预填（仅建议）", "System prefill (suggestion only)"),
    commandTitle: t("一把手确认的命令", "Owner-confirmed command"),
    commandVersion: (version: number) => t(`第 ${version} 版`, `Version ${version}`),
    diffTitle: t("与预填的差异", "Changes from the prefill"),
    noDiff: t("与预填一致", "Same as the prefill"),
    dispositionsTitle: t("处置回执", "Disposition receipts"),
    reviewsTitle: t("复核记录", "Reviews"),
    eventsTitle: t("事件记录", "Event log"),
    superseded: t("已被新命令版本取代", "Superseded by a newer command"),
    evidence: t("证据", "Evidence"),
    actionTaken: t("已采取的处置", "Action taken"),
    note: t("备注", "Note"),
    outcome: t("结论", "Outcome"),
    decision: (accept: boolean) => (accept ? t("通过", "Accepted") : t("退回", "Returned")),
    nextStepsTitle: t("你可以做的下一步", "What you can do next"),
    confirmTitle: t("确认入列（可修改预填）", "Confirm and dispatch (prefill is editable)"),
    confirmHint: t(
      "确认后才会派发给主责并通知相关人；系统不会替你确认。",
      "Nothing is dispatched or notified until you confirm; the system never confirms for you.",
    ),
    confirmSubmit: t("确认派发", "Confirm and dispatch"),
    reissueTitle: t("重新下达命令（新版本）", "Issue a new command version"),
    reissueHint: t(
      "新版本生效后，旧版本的主责不能再提交回执，未复核的回执标记为已取代。",
      "Once issued, the previous primary can no longer submit, and an unreviewed receipt is marked superseded.",
    ),
    reissueSubmit: t("下达新版本", "Issue new version"),
    diffFromCurrentTitle: t("与当前命令的差异", "Changes from the current command"),
    dismissTitle: t("驳回建议", "Dismiss the suggestion"),
    deferTitle: t("延期", "Defer"),
    deferUntil: t("延期到", "Defer until"),
    cancelTitle: t("撤销事项", "Cancel the case"),
    assignReviewersTitle: t("调整复核人", "Change reviewers"),
    reasonRequired: t("原因（必填）", "Reason (required)"),
    reasonOptional: t("原因（可选）", "Reason (optional)"),
    ackSubmit: t("我已收到，正在处理", "Acknowledge"),
    noteTitle: t("补充说明", "Add a note"),
    noteSubmit: t("提交说明", "Submit note"),
    dispositionTitle: t("提交处置回执", "Submit a disposition receipt"),
    disposedAt: t("处置完成时间", "Handled at"),
    evidenceHint: t("每行一条证据引用，格式为 类型:编号，不填网址。", "One evidence reference per line as kind:id; no URLs."),
    dispositionSubmit: t("提交回执", "Submit receipt"),
    reviewTitle: t("复核当前回执", "Review the current receipt"),
    attestHint: t("逐条勾选你已核实的外部证据。", "Tick each external evidence item you have verified."),
    reviewNote: t("复核结论（必填）", "Review conclusion (required)"),
    reviewAccept: t("复核通过并关闭", "Accept and close"),
    reviewReturn: t("退回主责", "Return to the primary"),
    submitting: t("提交中…", "Submitting…"),
    saved: t("已提交。", "Submitted."),
    notBusinessOutcome: t(
      "关闭只表示运营处置已经复核，不计入业务成果。",
      "Closing only records that the operating handling was reviewed; it is not a business outcome.",
    ),
  };
}

export type CaioAttentionCopy = ReturnType<typeof caioAttentionCopy>;
