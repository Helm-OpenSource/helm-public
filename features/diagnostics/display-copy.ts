import type {
  WorkspaceFirstLoopItem,
  WorkspaceFirstLoopModel,
  WorkspaceFirstLoopPrimaryAction,
  WorkspaceFirstLoopReturnReadback,
} from "@/lib/operating-system/first-loop";
import { formatSeededBusinessCopy } from "@/lib/presentation/seeded-business-copy";

const CHINESE_DIAGNOSTICS_STATUS_LABELS: Record<string, string> = {
  manual_retry_candidate: "人工确认后可重试",
  operator_review_required: "需要人工复核",
  blocked_no_auto_action: "已阻断自动动作",
  retry_manual_confirm: "人工确认后重试",
  merge_conflict_review: "冲突复核",
  source_data_repair: "源数据修复",
  inspect_audit_payload: "检查审计载荷",
  rebuild_from_source_then_retry: "从来源重建后重试",
  review_conflict_candidate: "复核冲突候选",
  repair_source_or_object: "修复来源或对象",
  inspect_failure_payload: "检查失败载荷",
  candidate_requires_operator_confirmation: "候选，需人工确认",
  not_retryable: "不可重试",
  requires_payload_or_conflict_review: "需载荷或冲突复核",
  manual_confirmation_required: "需人工确认",
  blocked_missing_retry_payload: "阻断：缺重试载荷",
  blocked_conflict_review_required: "阻断：需冲突复核",
  blocked_non_retryable: "阻断：不可重试",
  blocked_payload_inspection_required: "阻断：需检查载荷",
  manual_confirmed_rebuild_only: "仅人工确认重建",
  plan_only_pending_manual_confirmation: "计划已出，待人工确认",
  pending_manual_confirmation: "待人工确认",
  confirmed_ready_for_executor: "已确认，等待后续执行",
  missing_receipt: "缺复核凭证",
  invalid_receipt_payload: "凭证载荷异常",
  owner_assigned: "已分配负责人",
  owner_missing: "缺负责人",
  assign_owner_before_review: "先分配负责人再复核",
  record_retry_receipt: "记录重试凭证",
  confirm_or_dismiss_receipt: "确认或关闭凭证",
  ready_for_later_executor_after_manual_confirmation: "人工确认后交给后续执行",
  resolve_blocking_contract: "处理阻断契约",
  inspect_receipt_payload: "检查凭证载荷",
  no_action_dismissed: "已关闭，无动作",
  lock_reserved: "已记录逻辑锁",
  blocked_missing_receipt: "阻断：缺复核凭证",
  blocked_receipt_not_confirmed: "阻断：凭证未确认",
  blocked_missing_idempotency_lock: "阻断：缺幂等锁",
  blocked_idempotency_conflict: "阻断：幂等冲突",
  blocked_source_rebuild_required: "阻断：需重建来源",
  blocked_attempt_limit_reached: "阻断：达到尝试上限",
  blocked_attempt_payload_inspection: "阻断：需检查尝试载荷",
  missing_attempt: "缺尝试记录",
  invalid_attempt_payload: "尝试载荷异常",
  lock_available_for_manual_attempt: "可记录人工尝试锁",
  inspect_attempt_payload: "检查尝试载荷",
  blocked_missing_source: "阻断：缺来源",
  manual_rebuild_required: "需要人工重建",
  ready_for_manual_rebuild_review: "待人工重建复核",
  confirm_retry_receipt_before_attempt: "尝试前确认重试凭证",
  repair_retry_contract: "修复重试约束",
  rebuild_source_payload_before_attempt: "尝试前重建来源载荷",
  record_attempt_lock_after_manual_review: "人工复核后记录尝试锁",
  review_attempt_limit: "复核尝试上限",
  review_idempotency_conflict: "复核幂等冲突",
  bounded_exponential: "有界退避",
  llm_disabled: "智能服务停用",
  valid: "有效",
  empty: "空",
  malformed: "格式异常",
  blocked: "已阻断",
  dismissed: "已关闭",
  partial_failed: "部分失败",
  failed: "失败",
  success: "成功",
  completed: "完成",
  connected: "已连接",
  error: "异常",
  warning: "警告",
  missing_lock: "缺幂等锁",
  missing_source: "缺来源",
  missing_source_id: "缺来源编号",
};

const DIAGNOSTICS_FEATURE_FLAG_LABELS: Record<
  string,
  { en: string; zh: string }
> = {
  multilingualUi: { en: "Multilingual shell", zh: "多语言界面" },
  diagnosticsCenter: { en: "Diagnostics center", zh: "协同诊断中心" },
  crmFirstImports: { en: "CRM-first imports", zh: "客户关系系统优先导入" },
  captureAudio: { en: "Capture audio", zh: "现场采集" },
  llmEnhancement: { en: "LLM enhancement", zh: "智能增强" },
  evolutionSignals: { en: "Evolution signals", zh: "演进信号" },
  swarmReadOnlyWorkers: {
    en: "Swarm read-only workers",
    zh: "只读协作者",
  },
};

const CHINESE_DIAGNOSTICS_REPLACEMENTS: Array<[RegExp, string]> = [
  [/模型/g, "辅助服务"],
  [/Memory write failure/gi, "记忆写入失败"],
  [/Memory write retry/gi, "记忆写入重试"],
  [/Memory write/gi, "记忆写入"],
  [/and never retrying automatically/gi, "并且绝不自动重试"],
  [/read-only diagnostics/gi, "只读诊断"],
  [/read-only triage queue/gi, "只读分诊队列"],
  [/operator triage/gi, "操作人分诊"],
  [/later explicit review-first executor/gi, "后续显式先复核执行器"],
  [/retry execution/gi, "重试执行"],
  [/retrying automatically/gi, "自动重试"],
  [/bounded/gi, "有界"],
  [/receipt-oriented/gi, "凭证导向"],
  [/idempotency-keyed/gi, "幂等键约束"],
  [/manual-confirmed/gi, "人工确认"],
  [/backoff contract/gi, "退避约束"],
  [/attempt limit/gi, "尝试上限"],
  [/AuditLog-backed/gi, "审计日志支撑"],
  [/\bauthority\b/gi, "权限"],
  [/\bexecution\b/gi, "执行"],
  [/\bis\b/gi, "是"],
  [/review-before-commitment/gi, "先复核再承诺"],
  [/review-before-send/gi, "发送前复核"],
  [/review-first/gi, "先复核"],
  [/review-vs-promoted/gi, "复核与提升"],
  [/\breviews\b/gi, "复核"],
  [/\breview\b/gi, "复核"],
  [/ready-to-promote/gi, "待提升"],
  [/ready to scale/gi, "具备放量条件"],
  [/scale-ready/gi, "具备放量条件"],
  [/scale-readiness/gi, "放量就绪度"],
  [/whole-system readiness/gi, "整体系统就绪度"],
  [/\bMEETING\b/g, "会议"],
  [/\bmeeting\b/gi, "会议"],
  [/readiness posture/gi, "就绪姿态"],
  [/readiness grade/gi, "就绪等级"],
  [/readiness/gi, "就绪判断"],
  [/follow-through/gi, "后续动作"],
  [/write-back/gi, "写回"],
  [/first loop/gi, "首轮闭环"],
  [/first-loop/gi, "首轮闭环"],
  [/live signal/gi, "实时信号"],
  [/setup handoff/gi, "设置交接"],
  [/\bsetup\b/gi, "设置"],
  [/\bfocus areas\b/gi, "关注目标"],
  [/\bfocus area\b/gi, "关注目标"],
  [/\bfocus\b/gi, "重心"],
  [/\bcheckpoints\b/gi, "检查点"],
  [/\bcheckpoint\b/gi, "检查点"],
  [/handoff CTA/gi, "交接入口"],
  [/primary-action/gi, "主动作"],
  [/primary action/gi, "主动作"],
  [/Current single next action/gi, "当前唯一下一步"],
  [/canonical business-success proof/gi, "正式业务成效证明"],
  [/business success proof/gi, "业务成效证明"],
  [/audit-backed/gi, "有审计记录支撑"],
  [/Audit events/gi, "审计事件"],
  [/\baudit\b/gi, "审计"],
  [/\bproof\b/gi, "证明"],
  [/\btrace\b/gi, "轨迹"],
  [/\btraces\b/gi, "轨迹"],
  [/\breplay\b/gi, "回放"],
  [/\brecommendations\b/gi, "判断建议"],
  [/\brecommendation\b/gi, "判断建议"],
  [/\bblockers\b/gi, "阻塞"],
  [/\bblocker\b/gi, "阻塞"],
  [/\bcommitments\b/gi, "承诺"],
  [/\bcommitment\b/gi, "承诺"],
  [/\bworkflow\b/gi, "工作回路"],
  [/\boperator\b/gi, "操作人"],
  [/\bqueue\b/gi, "待处理队列"],
  [/\bhandoff\b/gi, "交接"],
  [/\bworker\b/gi, "协作者"],
  [/\bskills\b/gi, "能力"],
  [/\bskill\b/gi, "能力"],
  [/\bowner\b/gi, "负责人"],
  [/\bflow\b/gi, "流转"],
  [/\bruntime\b/gi, "运行层"],
  [/\btelemetry\b/gi, "使用信号"],
  [/\bmemory\b/gi, "记忆"],
  [/\bprompt\b/gi, "提示词"],
  [/\bproposal\b/gi, "方案"],
  [/\bpackage\b/gi, "打包方案"],
  [/\bpipeline\b/gi, "推进管线"],
  [/\bLLM\b/gi, "智能服务"],
  [/\bASR\b/gi, "转写"],
  [/\bfallback\b/gi, "备用路径"],
  [/\bprovider\b/gi, "服务来源"],
  [/\bproviders\b/gi, "服务来源"],
  [/\bopenai\b/gi, "智能服务"],
  [/gpt[\s-]*4[\s-]*1[\s-]*mini/gi, "默认模型"],
  [/\bcapture\b/gi, "采集"],
  [/\btranscript\b/gi, "转写文本"],
  [/\btokens\b/gi, "用量"],
  [/\btoken\b/gi, "用量"],
  [/\bcalls\b/gi, "调用"],
  [/\bcall\b/gi, "调用"],
  [/\bselected\b/gi, "入选"],
  [/\bomitted\b/gi, "省略"],
  [/\bstale\b/gi, "过期"],
  [/\bduplicate\b/gi, "重复"],
  [/\bsurface\b/gi, "页面"],
  [/\bpack\b/gi, "检索包"],
  [/\bpayload\b/gi, "载荷"],
  [/\bretry\b/gi, "重试"],
  [/\breceipt\b/gi, "凭证"],
  [/\bledger\b/gi, "台账"],
  [/\battempt\b/gi, "尝试"],
  [/\bcontract\b/gi, "约束"],
  [/\bsource\b/gi, "来源"],
  [/\bexecutor\b/gi, "执行器"],
  [/\bproxy\b/gi, "代理信号"],
  [/\bpilot\b/gi, "试点"],
  [/\bactivation\b/gi, "启用"],
  [/\bdraft\b/gi, "草稿"],
  [/\brich-vs-thin\b/gi, "信息层级"],
  [/\bwording\b/gi, "措辞"],
  [/\bhierarchy\b/gi, "层级"],
  [/\bclarity\b/gi, "清晰度"],
  [/\bposture\b/gi, "姿态"],
  [/\bobject\b/gi, "对象"],
  [/\bfacts\b/gi, "事实"],
  [/\bfact\b/gi, "事实"],
  [/\bhit\b/gi, "命中"],
  [/\bSUMMARY\b/g, "摘要"],
  [/NEXT STEP/g, "下一步"],
  [/RISK SIGNAL/g, "风险信号"],
  [/\bRELATIONSHIP\b/g, "关系"],
  [/\bPREFERENCE\b/g, "偏好"],
  [/\baction creation rate\b/gi, "动作生成率"],
  [/\baction creation\b/gi, "动作生成"],
  [/\ba\b/gi, ""],
  [/it does not/gi, "不会"],
  [/still requires/gi, "仍需要"],
  [/must not/gi, "不得"],
  [/\bstill\b/gi, "仍然"],
  [/\bweak\b/gi, "偏弱"],
  [/\bnot\b/gi, "未"],
  [/\bwithout\b/gi, "不会"],
  [/\bor\b/gi, "或"],
  [/\bcanonical\b/gi, "正式"],
  [/\bdetail\b/gi, "详情"],
  [/\bsample\b/gi, "样本"],
  [/\bneeds\b/gi, "需要"],
  [/\band\b/gi, "和"],
];

export function formatDiagnosticsVisibleText(
  value: string | null | undefined,
  english: boolean,
) {
  if (!value) return "";
  if (english) return value;

  const formatted = CHINESE_DIAGNOSTICS_REPLACEMENTS.reduce(
    (current, [pattern, replacement]) => current.replace(pattern, replacement),
    value,
  );

  return formatSeededBusinessCopy(formatted, english);
}

export function formatDiagnosticsTechnicalKey(
  value: string | null | undefined,
  english: boolean,
) {
  if (!value) return "";
  if (english) return value;

  const normalized = value.trim();
  const statusLabel =
    CHINESE_DIAGNOSTICS_STATUS_LABELS[normalized] ??
    CHINESE_DIAGNOSTICS_STATUS_LABELS[normalized.toLowerCase()] ??
    CHINESE_DIAGNOSTICS_STATUS_LABELS[
      normalized.replace(/-/g, "_").toLowerCase()
    ];

  if (statusLabel) {
    return statusLabel;
  }

  const readable = normalized
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_./:-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return formatDiagnosticsVisibleText(readable, english);
}

export function formatDiagnosticsFeatureFlagLabel(
  value: string | null | undefined,
  english: boolean,
) {
  if (!value) return "";

  const label = DIAGNOSTICS_FEATURE_FLAG_LABELS[value.trim()];
  if (label) return english ? label.en : label.zh;

  return formatDiagnosticsTechnicalKey(value, english);
}

function formatDiagnosticsLoopItem(
  item: WorkspaceFirstLoopItem,
  english: boolean,
): WorkspaceFirstLoopItem {
  return {
    ...item,
    label: formatDiagnosticsVisibleText(item.label, english),
    summary: formatDiagnosticsVisibleText(item.summary, english),
  };
}

function formatDiagnosticsPrimaryAction(
  action: WorkspaceFirstLoopPrimaryAction,
  english: boolean,
): WorkspaceFirstLoopPrimaryAction {
  return {
    ...action,
    label: formatDiagnosticsVisibleText(action.label, english),
    summary: formatDiagnosticsVisibleText(action.summary, english),
    ctaLabel: formatDiagnosticsVisibleText(action.ctaLabel, english),
  };
}

function formatDiagnosticsReturnReadback(
  readback: WorkspaceFirstLoopReturnReadback,
  english: boolean,
): WorkspaceFirstLoopReturnReadback {
  return {
    ...readback,
    label: formatDiagnosticsVisibleText(readback.label, english),
    summary: formatDiagnosticsVisibleText(readback.summary, english),
    ctaLabel: formatDiagnosticsVisibleText(readback.ctaLabel, english),
  };
}

export function buildDiagnosticsFirstLoopDisplayModel(
  model: WorkspaceFirstLoopModel,
  english: boolean,
): WorkspaceFirstLoopModel {
  const roleGoal = formatDiagnosticsLoopItem(model.roleGoal, english);
  const firstSignal = formatDiagnosticsLoopItem(model.firstSignal, english);
  const firstSuggestion = formatDiagnosticsLoopItem(
    model.firstSuggestion,
    english,
  );
  const reviewCheckpoint = formatDiagnosticsLoopItem(
    model.reviewCheckpoint,
    english,
  );
  const followThrough = formatDiagnosticsLoopItem(model.followThrough, english);
  const memoryWriteBack = formatDiagnosticsLoopItem(
    model.memoryWriteBack,
    english,
  );
  const nextAnchor = formatDiagnosticsLoopItem(model.nextAnchor, english);
  const itemsById = new Map(
    [
      roleGoal,
      firstSignal,
      firstSuggestion,
      reviewCheckpoint,
      followThrough,
      memoryWriteBack,
      nextAnchor,
    ].map((item) => [item.id, item]),
  );

  return {
    ...model,
    stageLabel: formatDiagnosticsVisibleText(model.stageLabel, english),
    title: formatDiagnosticsVisibleText(model.title, english),
    summary: formatDiagnosticsVisibleText(model.summary, english),
    progressLabel: formatDiagnosticsVisibleText(model.progressLabel, english),
    boundary: formatDiagnosticsVisibleText(model.boundary, english),
    primaryAction: formatDiagnosticsPrimaryAction(model.primaryAction, english),
    returnReadback: formatDiagnosticsReturnReadback(
      model.returnReadback,
      english,
    ),
    roleGoal,
    firstSignal,
    firstSuggestion,
    reviewCheckpoint,
    followThrough,
    memoryWriteBack,
    nextAnchor,
    steps: model.steps.map(
      (item) =>
        itemsById.get(item.id) ?? formatDiagnosticsLoopItem(item, english),
    ),
  };
}
