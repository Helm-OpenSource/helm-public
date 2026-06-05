const askObjectTypeLabels: Record<string, { zh: string; en: string }> = {
  contact: { zh: "联系人", en: "Contact" },
  company: { zh: "公司", en: "Company" },
  opportunity: { zh: "机会", en: "Opportunity" },
  meeting: { zh: "会议", en: "Meeting" },
};

const askStageLabels: Record<string, { zh: string; en: string }> = {
  NEW: { zh: "新机会", en: "New" },
  CONTACTED: { zh: "已接触", en: "Contacted" },
  ADVANCING: { zh: "待推进", en: "Advancing" },
  WAITING_THEM: { zh: "等待对方", en: "Waiting on them" },
  INTERNAL_SYNC: { zh: "需内部协同", en: "Internal sync" },
  DONE: { zh: "已完成", en: "Done" },
  LOST: { zh: "已失效", en: "Lost" },
};

const askSourceLabels: Record<string, { zh: string; en: string }> = {
  object_search: { zh: "对象搜索", en: "Object search" },
  memory_summary: { zh: "记忆摘要", en: "Memory summary" },
  workspace_context: { zh: "工作区上下文", en: "Workspace context" },
  knowledge_pack: { zh: "页面职责说明", en: "Knowledge pack" },
};

const askBoundaryLabels: Record<string, { zh: string; en: string }> = {
  review_required: { zh: "需要复核", en: "Review required" },
  read_only: { zh: "只读解释", en: "Read-only" },
  draft_only: { zh: "仅草稿", en: "Draft only" },
  execution_denied: { zh: "禁止执行", en: "Execution denied" },
  cross_workspace_denied: {
    zh: "禁止跨工作区",
    en: "Cross-workspace denied",
  },
  transcript_confirmation_required: {
    zh: "需确认转写",
    en: "Transcript confirmation required",
  },
  suggestion_not_commitment: {
    zh: "建议不等于承诺",
    en: "Suggestion, not commitment",
  },
  out_of_scope: { zh: "超出当前范围", en: "Out of scope" },
};

const askIntentLabels: Record<string, { zh: string; en: string }> = {
  object_search: { zh: "对象查找", en: "Object search" },
  object_recent: { zh: "最近对象", en: "Recent objects" },
  current_status: { zh: "当前状态", en: "Current status" },
  today_priority: { zh: "今日优先级", en: "Today priority" },
  why_recommendation: { zh: "建议原因", en: "Why this recommendation" },
  why_blocked: { zh: "阻塞原因", en: "Why blocked" },
  how_to_use: { zh: "使用说明", en: "How to use" },
  definition_diff: { zh: "定义差异", en: "Definition difference" },
  next_step_page: { zh: "下一步页面", en: "Next page" },
  next_step_object: { zh: "下一步对象", en: "Next object" },
  plan_breakdown: { zh: "行动拆解", en: "Action plan" },
  prepare_draft: { zh: "准备草稿", en: "Prepare draft" },
  prepare_review_packet: { zh: "准备复核包", en: "Prepare review packet" },
  queue_internal_followup: { zh: "内部跟进候选", en: "Internal follow-up" },
  request_handoff: { zh: "请求交接", en: "Request handoff" },
  request_execution: { zh: "执行请求", en: "Execution request" },
  review_required_execution: {
    zh: "高风险执行复核",
    en: "Review-required execution",
  },
  submit_business_signal: { zh: "上报经营信号", en: "Submit business signal" },
  cross_workspace_denied: {
    zh: "禁止跨工作区",
    en: "Cross-workspace denied",
  },
  unsupported_open_domain: { zh: "不支持开放搜索", en: "Unsupported open-domain" },
  unsupported_chitchat: { zh: "不支持闲聊", en: "Unsupported chitchat" },
  out_of_scope: { zh: "超出当前范围", en: "Out of scope" },
};

function pickLabel(value: string, english: boolean, labels: Record<string, { zh: string; en: string }>) {
  const normalizedValue = value.trim();
  const label =
    labels[value] ??
    labels[normalizedValue.toLowerCase()] ??
    Object.values(labels).find(
      (candidate) =>
        candidate.zh === normalizedValue ||
        candidate.en.toLowerCase() === normalizedValue.toLowerCase(),
    );
  if (label) return english ? label.en : label.zh;

  return value.replaceAll("_", " ");
}

export function formatAskHelmObjectTypeLabel(type: string, english: boolean) {
  return pickLabel(type, english, askObjectTypeLabels);
}

export function formatAskHelmRelatedObjectStatus(
  objectType: string,
  status: string,
  english: boolean,
) {
  if (!status) return english ? "No status" : "暂无状态";

  if (objectType === "opportunity") {
    return pickLabel(status, english, askStageLabels);
  }

  if (/^(contact|company|opportunity|meeting)$/i.test(status)) {
    return formatAskHelmObjectTypeLabel(status, english);
  }

  return status;
}

export function formatAskHelmRetrievalSourceLabel(
  source: string,
  english: boolean,
) {
  return pickLabel(source, english, askSourceLabels);
}

export function formatAskHelmBoundaryTypeLabel(type: string, english: boolean) {
  return pickLabel(type, english, askBoundaryLabels);
}

export function formatAskHelmIntentTypeLabel(type: string, english: boolean) {
  return pickLabel(type, english, askIntentLabels);
}
