import type { CaioAttentionCategory, CaioAttentionSeverity } from "@/lib/caio-attention/contracts";
import type { CaioAttentionStatus } from "@/lib/caio-attention/state-machine";

import type { CaioAttentionViewerRole } from "./service-contract";
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
    notBusinessOutcome: t(
      "关闭只表示运营处置已经复核，不计入业务成果。",
      "Closing only records that the operating handling was reviewed; it is not a business outcome.",
    ),
  };
}

export type CaioAttentionCopy = ReturnType<typeof caioAttentionCopy>;
