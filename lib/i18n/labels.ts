import type { UiLocale } from "@/lib/i18n/config";
import { isEnglishLocale } from "@/lib/i18n/config";
import { getDemoAccountCards } from "@/lib/demo/demo-modes";

type Dictionary = Record<string, string>;

const zh = {
  roles: {
    OWNER: "组织所有者",
    BILLING_ADMIN: "计费管理员",
    ADMIN: "管理员",
    OPERATOR: "运营成员",
    REVIEWER: "评审成员",
    MEMBER: "成员",
  },
  stages: {
    NEW: "新机会",
    CONTACTED: "已接触",
    ADVANCING: "待推进",
    WAITING_THEM: "等待对方",
    INTERNAL_SYNC: "需内部协同",
    DONE: "已完成",
    LOST: "已失效",
  },
  opportunityTypes: {
    CLIENT: "客户机会",
    RECRUITING: "招聘机会",
    PARTNERSHIP: "合作机会",
    INTERNAL: "内部事项",
  },
  risks: {
    LOW: "低风险",
    MEDIUM: "中风险",
    HIGH: "高风险",
    CRITICAL: "关键风险",
  },
  warmth: {
    COLD: "冷",
    WARM: "暖",
    HOT: "热",
    CHAMPION: "关键支持者",
  },
  actionTypes: {
    DRAFT_EXTERNAL_EMAIL: "起草外发邮件",
    DRAFT_INTERNAL_NOTE: "起草内部纪要",
    CREATE_MEETING: "创建会议",
    UPDATE_OPPORTUNITY_STAGE: "更新机会阶段",
    CREATE_TASK: "创建待办",
    ASSIGN_OWNER: "指派负责人",
    CHANGE_DUE_DATE: "修改截止时间",
    SEND_MEETING_SUMMARY: "归档会议纪要",
    GENERATE_REPLY_DRAFT: "生成回复草稿",
    SCHEDULE_INTERVIEW: "安排面试",
  },
  actionChannels: {
    DRAFT_EXTERNAL_EMAIL: "外发动作",
    DRAFT_INTERNAL_NOTE: "内部动作",
    CREATE_MEETING: "内部动作",
    UPDATE_OPPORTUNITY_STAGE: "内部动作",
    CREATE_TASK: "内部动作",
    ASSIGN_OWNER: "内部动作",
    CHANGE_DUE_DATE: "内部动作",
    SEND_MEETING_SUMMARY: "内部动作",
    GENERATE_REPLY_DRAFT: "外发动作",
    SCHEDULE_INTERVIEW: "内部动作",
  },
  actionModes: {
    SUGGEST_ONLY: "仅建议",
    REQUIRES_APPROVAL: "需逐条审批",
    AUTO_WITHIN_THRESHOLD: "阈值内自动执行",
    FORBIDDEN: "禁止执行",
  },
  approvalStatuses: {
    PENDING: "待审批",
    EXECUTED: "已执行",
    REJECTED: "已拒绝",
    WITHDRAWN: "已撤回",
  },
  commitmentStatuses: {
    OPEN: "待兑现",
    IN_PROGRESS: "推进中",
    FULFILLED: "已兑现",
    CANCELED: "已取消",
    OVERDUE: "已逾期",
  },
  blockerStatuses: {
    OPEN: "待处理",
    MONITORING: "持续观察",
    RESOLVED: "已解决",
    IGNORED: "暂不处理",
  },
  captureStatuses: {
    RECORDING: "记录中",
    PROCESSING: "处理中",
    COMPLETED: "已完成",
    FAILED: "处理失败",
    CANCELED: "已取消",
  },
  captureSources: {
    MANUAL_CAPTURE: "手动记录",
    ZOOM: "Zoom",
    TENCENT_MEETING: "腾讯会议",
    CALL_CENTER: "电话 / Call Center",
    OPENCLAW: "OpenClaw",
    OTHER: "其他来源",
  },
  insights: {
    FACT: "关键事实",
    COMMITMENT: "承诺",
    BLOCKER: "阻塞",
    RISK: "风险",
    NEXT_ACTION: "下一步动作",
  },
  transcriptSources: {
    MANUAL_TEXT: "手工速记",
    OPENAI_ASR: "真实语音转写",
    FALLBACK_DEMO: "演示转写",
    EXTERNAL_INGEST: "外部转写",
  },
  threadStatuses: {
    OPEN: "开放",
    WAITING_US: "待我方回复",
    WAITING_THEM: "待对方回复",
    CLOSED: "已关闭",
  },
  eventLabels: {
    daily_login: "登录",
    dashboard_opened: "打开首页",
    meeting_opened: "打开会议页",
    action_items_generated: "生成行动项",
    approval_submitted: "发起审批",
    approval_approved: "批准审批",
    approval_rejected: "拒绝审批",
    opportunity_stage_changed: "机会推进",
    followup_draft_generated: "生成跟进草稿",
    policy_rule_changed: "修改策略",
    connector_connected: "连接连接器",
    connector_sync_triggered: "触发同步",
    csv_import_completed: "完成 CSV 导入",
    weekly_report_viewed: "查看周报",
    recommendation_explanation_refreshed: "刷新推荐解释",
    recommendation_generated: "生成建议",
    recommendation_card_viewed: "看到建议卡片",
    recommendation_explanation_viewed: "展开建议依据",
    recommendation_action_created: "按建议生成动作",
    recommendation_feedback_submitted: "提交建议反馈",
    recommendation_accepted: "采纳建议",
    recommendation_rejected: "拒绝建议",
    commitment_created: "新增承诺",
    commitment_status_updated: "更新承诺状态",
    commitment_fulfilled: "兑现承诺",
    blocker_created: "新增阻塞",
    blocker_resolved: "解决阻塞",
    blocker_status_updated: "更新阻塞状态",
    blocker_reopened: "重新打开阻塞",
    capture_started: "开始采集",
    capture_audio_uploaded: "上传录音",
    capture_processing_started: "开始处理采集",
    transcript_generated: "生成 transcript",
    conversation_insights_generated: "生成会话 insights",
    capture_memory_written: "采集写回记忆",
    capture_recommendations_refreshed: "采集刷新推荐",
    capture_actions_created: "采集生成动作",
    capture_processing_completed: "完成采集处理",
    conversation_capture_failed: "采集处理失败",
    openclaw_memory_sync_started: "OpenClaw 记忆同步开始",
    openclaw_memory_sync_completed: "OpenClaw 记忆同步完成",
    openclaw_memory_sync_failed: "OpenClaw 记忆同步失败",
  },
  llmTasks: {
    AUDIO_TRANSCRIPTION: "音频转写",
    MEETING_MEMORY_EXTRACTION: "会议结构化提取",
    CONTACT_BRIEFING: "联系人简报",
    COMPANY_BRIEFING: "公司简报",
    OPPORTUNITY_BRIEFING: "机会简报",
    MEETING_BRIEFING: "会议简报",
    RECOMMENDATION_EXPLANATION: "推荐解释增强",
  },
  llmFallbacks: {
    llm_disabled: "LLM 被关闭",
    provider_not_configured: "Provider 未配置",
    provider_error: "Provider 调用失败",
  },
  objectTypes: {
    CONTACT: "联系人",
    COMPANY: "公司",
    OPPORTUNITY: "机会",
    MEETING: "会议",
    WORKSPACE: "工作区",
    ACTION_ITEM: "动作",
    APPROVAL_TASK: "审批任务",
    POLICY_RULE: "策略规则",
    EMAIL_THREAD: "邮件线程",
  },
  memorySources: {
    MEETING_NOTE: "会议纪要",
    ACTION_ITEM: "会后动作",
    EMAIL_THREAD: "邮件线程",
    SYSTEM: "系统提取",
    OPENCLAW: "OpenClaw 导入",
  },
};

const en = {
  roles: {
    OWNER: "Owner",
    BILLING_ADMIN: "Billing admin",
    ADMIN: "Admin",
    OPERATOR: "Operator",
    REVIEWER: "Reviewer",
    MEMBER: "Member",
  },
  stages: {
    NEW: "New",
    CONTACTED: "Contacted",
    ADVANCING: "Advancing",
    WAITING_THEM: "Waiting on them",
    INTERNAL_SYNC: "Internal sync",
    DONE: "Done",
    LOST: "Lost",
  },
  opportunityTypes: {
    CLIENT: "Client opportunity",
    RECRUITING: "Recruiting",
    PARTNERSHIP: "Partnership",
    INTERNAL: "Internal",
  },
  risks: {
    LOW: "Low risk",
    MEDIUM: "Medium risk",
    HIGH: "High risk",
    CRITICAL: "Critical risk",
  },
  warmth: {
    COLD: "Cold",
    WARM: "Warm",
    HOT: "Hot",
    CHAMPION: "Champion",
  },
  actionTypes: {
    DRAFT_EXTERNAL_EMAIL: "Draft external email",
    DRAFT_INTERNAL_NOTE: "Draft internal note",
    CREATE_MEETING: "Create meeting",
    UPDATE_OPPORTUNITY_STAGE: "Update opportunity stage",
    CREATE_TASK: "Create task",
    ASSIGN_OWNER: "Assign owner",
    CHANGE_DUE_DATE: "Change due date",
    SEND_MEETING_SUMMARY: "Archive meeting summary",
    GENERATE_REPLY_DRAFT: "Generate reply draft",
    SCHEDULE_INTERVIEW: "Schedule interview",
  },
  actionChannels: {
    DRAFT_EXTERNAL_EMAIL: "External action",
    DRAFT_INTERNAL_NOTE: "Internal action",
    CREATE_MEETING: "Internal action",
    UPDATE_OPPORTUNITY_STAGE: "Internal action",
    CREATE_TASK: "Internal action",
    ASSIGN_OWNER: "Internal action",
    CHANGE_DUE_DATE: "Internal action",
    SEND_MEETING_SUMMARY: "Internal action",
    GENERATE_REPLY_DRAFT: "External action",
    SCHEDULE_INTERVIEW: "Internal action",
  },
  actionModes: {
    SUGGEST_ONLY: "Suggest only",
    REQUIRES_APPROVAL: "Requires approval",
    AUTO_WITHIN_THRESHOLD: "Auto within threshold",
    FORBIDDEN: "Forbidden",
  },
  approvalStatuses: {
    PENDING: "Pending",
    EXECUTED: "Executed",
    REJECTED: "Rejected",
    WITHDRAWN: "Withdrawn",
  },
  commitmentStatuses: {
    OPEN: "Open",
    IN_PROGRESS: "In progress",
    FULFILLED: "Fulfilled",
    CANCELED: "Canceled",
    OVERDUE: "Overdue",
  },
  blockerStatuses: {
    OPEN: "Open",
    MONITORING: "Monitoring",
    RESOLVED: "Resolved",
    IGNORED: "Ignored",
  },
  captureStatuses: {
    RECORDING: "Recording",
    PROCESSING: "Processing",
    COMPLETED: "Completed",
    FAILED: "Failed",
    CANCELED: "Canceled",
  },
  captureSources: {
    MANUAL_CAPTURE: "Manual capture",
    ZOOM: "Zoom",
    TENCENT_MEETING: "Tencent Meeting",
    CALL_CENTER: "Phone / Call Center",
    OPENCLAW: "OpenClaw",
    OTHER: "Other source",
  },
  insights: {
    FACT: "Fact",
    COMMITMENT: "Commitment",
    BLOCKER: "Blocker",
    RISK: "Risk",
    NEXT_ACTION: "Next action",
  },
  transcriptSources: {
    MANUAL_TEXT: "Manual text",
    OPENAI_ASR: "Live ASR",
    FALLBACK_DEMO: "Fallback transcript",
    EXTERNAL_INGEST: "External transcript",
  },
  threadStatuses: {
    OPEN: "Open",
    WAITING_US: "Waiting on us",
    WAITING_THEM: "Waiting on them",
    CLOSED: "Closed",
  },
  eventLabels: {
    daily_login: "Login",
    dashboard_opened: "Open dashboard",
    meeting_opened: "Open meeting",
    action_items_generated: "Generate actions",
    approval_submitted: "Submit approval",
    approval_approved: "Approve action",
    approval_rejected: "Reject action",
    opportunity_stage_changed: "Opportunity moved",
    followup_draft_generated: "Generate follow-up draft",
    policy_rule_changed: "Change policy",
    connector_connected: "Connector connected",
    connector_sync_triggered: "Trigger sync",
    csv_import_completed: "Complete CSV import",
    weekly_report_viewed: "View weekly report",
    recommendation_explanation_refreshed: "Refresh recommendation explanation",
    recommendation_generated: "Recommendation generated",
    recommendation_card_viewed: "Recommendation card viewed",
    recommendation_explanation_viewed: "Recommendation evidence viewed",
    recommendation_action_created: "Create action from recommendation",
    recommendation_feedback_submitted: "Submit recommendation feedback",
    recommendation_accepted: "Accept recommendation",
    recommendation_rejected: "Reject recommendation",
    commitment_created: "Commitment created",
    commitment_status_updated: "Commitment updated",
    commitment_fulfilled: "Commitment fulfilled",
    blocker_created: "Blocker created",
    blocker_resolved: "Blocker resolved",
    blocker_status_updated: "Blocker updated",
    blocker_reopened: "Blocker reopened",
    capture_started: "Capture started",
    capture_audio_uploaded: "Audio uploaded",
    capture_processing_started: "Capture processing started",
    transcript_generated: "Transcript generated",
    conversation_insights_generated: "Conversation insights generated",
    capture_memory_written: "Capture wrote memory",
    capture_recommendations_refreshed: "Capture refreshed recommendations",
    capture_actions_created: "Capture created actions",
    capture_processing_completed: "Capture completed",
    conversation_capture_failed: "Capture failed",
    openclaw_memory_sync_started: "OpenClaw memory sync started",
    openclaw_memory_sync_completed: "OpenClaw memory sync completed",
    openclaw_memory_sync_failed: "OpenClaw memory sync failed",
  },
  llmTasks: {
    AUDIO_TRANSCRIPTION: "Audio transcription",
    MEETING_MEMORY_EXTRACTION: "Meeting memory extraction",
    CONTACT_BRIEFING: "Contact briefing",
    COMPANY_BRIEFING: "Company briefing",
    OPPORTUNITY_BRIEFING: "Opportunity briefing",
    MEETING_BRIEFING: "Meeting briefing",
    RECOMMENDATION_EXPLANATION: "Recommendation explanation",
  },
  llmFallbacks: {
    llm_disabled: "LLM disabled",
    provider_not_configured: "Provider not configured",
    provider_error: "Provider error",
  },
  objectTypes: {
    CONTACT: "Contact",
    COMPANY: "Company",
    OPPORTUNITY: "Opportunity",
    MEETING: "Meeting",
    WORKSPACE: "Workspace",
    ACTION_ITEM: "Action item",
    APPROVAL_TASK: "Approval task",
    POLICY_RULE: "Policy rule",
    EMAIL_THREAD: "Email thread",
  },
  memorySources: {
    MEETING_NOTE: "Meeting note",
    ACTION_ITEM: "Post-meeting action",
    EMAIL_THREAD: "Email thread",
    SYSTEM: "System extracted",
    OPENCLAW: "OpenClaw imported",
  },
};

const zhSetup = {
  personaOptions: ["销售负责人", "猎头顾问", "创始人 / COO", "顾问 / 服务商"],
  connectorOptions: ["HubSpot", "Salesforce", "阿里邮箱", "CRM / 会议历史导入"],
  focusOptions: ["客户跟进", "招聘推进", "合作拓展", "内部事项"],
  strategyOptions: [
    "对外邮件默认需审批",
    "内部纪要按规则发送",
    "会议纪要自动生成待办",
    "高风险机会变更需再次确认",
  ],
};

const enSetup = {
  personaOptions: [
    "Sales lead",
    "Recruiter",
    "Founder / COO",
    "Consultant / Services",
  ],
  connectorOptions: [
    "HubSpot",
    "Salesforce",
    "Aliyun Mail",
    "CRM / meeting history import",
  ],
  focusOptions: [
    "Client follow-up",
    "Hiring pipeline",
    "Partnerships",
    "Internal work",
  ],
  strategyOptions: [
    "External emails require approval by default",
    "Internal summaries can auto-send",
    "Meeting summaries create tasks automatically",
    "High-risk opportunity changes require reconfirmation",
  ],
};

const zhPolicyGuides = {
  DRAFT_EXTERNAL_EMAIL: {
    summary: "对外措辞会直接影响成交、合作与候选人体验，默认逐条审批最稳妥。",
    recommended: "推荐默认：需逐条审批，只有低风险场景再考虑放开。",
    example: "示例：销售跟进草稿会先进入审批，高风险机会仍必须人工确认。",
  },
  DRAFT_INTERNAL_NOTE: {
    summary: "内部纪要主要影响团队对齐，适合在阈值内自动执行。",
    recommended: "推荐默认：阈值内自动执行。",
    example: "示例：会后纪要可自动分发给内部负责人，但关键风险项仍会保留提醒。",
  },
  CREATE_MEETING: {
    summary: "建会属于低风险节奏动作，自动化价值高。",
    recommended: "推荐默认：阈值内自动执行。",
    example: "示例：联系人跟进会议可自动创建占位并写入时间线。",
  },
  UPDATE_OPPORTUNITY_STAGE: {
    summary: "机会阶段更新应该跟随真实进展，但错误更新会影响判断。",
    recommended: "推荐默认：中风险及以下自动执行。",
    example: "示例：会后将“待推进”更新为“等待对方”，会同步写入审计日志。",
  },
  CREATE_TASK: {
    summary: "待办创建的风险较低，重点是确保别漏动作。",
    recommended: "推荐默认：阈值内自动执行。",
    example: "示例：从邮件线程生成待办后，会出现在时间线与工作台里。",
  },
  ASSIGN_OWNER: {
    summary: "负责人变更会影响协作责任，建议保留人工把关。",
    recommended: "推荐默认：需逐条审批。",
    example: "示例：高风险项目的负责人调整需要审批并留下变更记录。",
  },
  CHANGE_DUE_DATE: {
    summary: "改截止时间是常见动作，但会直接影响节奏判断。",
    recommended: "推荐默认：中风险及以下自动执行。",
    example: "示例：会后统一顺延 2 天会立即回写机会和审计日志。",
  },
  SEND_MEETING_SUMMARY: {
    summary: "纪要是会后闭环关键动作，内部发送适合自动化。",
    recommended: "推荐默认：阈值内自动执行。",
    example: "示例：内部纪要可直接发送，对外纪要仍可被策略拦截进审批。",
  },
  GENERATE_REPLY_DRAFT: {
    summary: "回复草稿通常直接面向客户或合作方，建议先审后发。",
    recommended: "推荐默认：需逐条审批。",
    example: "示例：收件箱线程回复会先形成草稿，再送入审批中心。",
  },
  SCHEDULE_INTERVIEW: {
    summary: "面试安排关联候选人体验与多方时间，建议保留审批。",
    recommended: "推荐默认：需逐条审批。",
    example: "示例：候选人后续面试动作会生成会议占位，并保留审批记录。",
  },
} as const;

const enPolicyGuides = {
  DRAFT_EXTERNAL_EMAIL: {
    summary:
      "External wording directly affects win rate, partnership trust and candidate experience, so per-action approval is the safest default.",
    recommended:
      "Recommended default: require approval, and only relax it for low-risk cases.",
    example:
      "Example: a sales follow-up draft routes into approvals first, and high-risk opportunities still require a human check.",
  },
  DRAFT_INTERNAL_NOTE: {
    summary:
      "Internal notes mainly affect team alignment, so they are good candidates for threshold-based auto-execution.",
    recommended: "Recommended default: auto within threshold.",
    example:
      "Example: a post-meeting summary can be distributed internally automatically while key risk items still stay visible.",
  },
  CREATE_MEETING: {
    summary:
      "Creating meetings is usually a low-risk pacing action with high automation value.",
    recommended: "Recommended default: auto within threshold.",
    example:
      "Example: a follow-up meeting for a contact can be created automatically and written into the timeline.",
  },
  UPDATE_OPPORTUNITY_STAGE: {
    summary:
      "Opportunity stage updates should follow real progress, but a wrong update will distort judgement.",
    recommended: "Recommended default: auto-execute for medium risk and below.",
    example:
      'Example: moving an opportunity to "Waiting on them" after a meeting also writes an audit entry.',
  },
  CREATE_TASK: {
    summary:
      "Creating tasks is low risk; the priority is making sure next steps are never missed.",
    recommended: "Recommended default: auto within threshold.",
    example:
      "Example: a task created from an email thread immediately appears in the timeline and work queue.",
  },
  ASSIGN_OWNER: {
    summary:
      "Reassigning ownership changes accountability, so it is better to keep a human in the loop.",
    recommended: "Recommended default: require approval.",
    example:
      "Example: changing the owner of a high-risk project requires approval and leaves a clear change record.",
  },
  CHANGE_DUE_DATE: {
    summary:
      "Changing due dates is common, but it directly affects pacing judgement.",
    recommended: "Recommended default: auto-execute for medium risk and below.",
    example:
      "Example: pushing a deadline by two days after a meeting immediately updates the opportunity and audit trail.",
  },
  SEND_MEETING_SUMMARY: {
    summary:
      "Meeting summaries are core to post-meeting follow-through, and internal sends are good automation candidates.",
    recommended: "Recommended default: auto within threshold.",
    example:
      "Example: an internal summary can send directly, while external summaries can still be intercepted into approvals.",
  },
  GENERATE_REPLY_DRAFT: {
    summary:
      "Reply drafts usually face customers or partners directly, so they should be reviewed first.",
    recommended: "Recommended default: require approval.",
    example:
      "Example: an inbox reply draft is created first, then routed into the approval center.",
  },
  SCHEDULE_INTERVIEW: {
    summary:
      "Interview scheduling affects candidate experience and multiple calendars, so approval is the safer default.",
    recommended: "Recommended default: require approval.",
    example:
      "Example: a follow-up interview action creates a meeting placeholder and keeps an approval record.",
  },
} as const;

function select(locale: UiLocale) {
  return isEnglishLocale(locale) ? en : zh;
}

function copyMap(map: Dictionary): Dictionary {
  return { ...map };
}

export function getLocalizedRoleLabels(locale: UiLocale) {
  return copyMap(select(locale).roles);
}

export function getLocalizedStageLabels(locale: UiLocale) {
  return copyMap(select(locale).stages);
}

export function getLocalizedOpportunityTypeLabels(locale: UiLocale) {
  return copyMap(select(locale).opportunityTypes);
}

export function getLocalizedRiskLabels(locale: UiLocale) {
  return copyMap(select(locale).risks);
}

export function getLocalizedWarmthLabels(locale: UiLocale) {
  return copyMap(select(locale).warmth);
}

export function getLocalizedActionTypeLabels(locale: UiLocale) {
  return copyMap(select(locale).actionTypes);
}

export function getLocalizedActionTypeChannelLabels(locale: UiLocale) {
  return copyMap(select(locale).actionChannels);
}

export function getLocalizedActionModeLabels(locale: UiLocale) {
  return copyMap(select(locale).actionModes);
}

export function getLocalizedApprovalStatusLabels(locale: UiLocale) {
  return copyMap(select(locale).approvalStatuses);
}

export function getLocalizedCommitmentStatusLabels(locale: UiLocale) {
  return copyMap(select(locale).commitmentStatuses);
}

export function getLocalizedBlockerStatusLabels(locale: UiLocale) {
  return copyMap(select(locale).blockerStatuses);
}

export function getLocalizedCaptureStatusLabels(locale: UiLocale) {
  return copyMap(select(locale).captureStatuses);
}

export function getLocalizedCaptureSourceLabels(locale: UiLocale) {
  return copyMap(select(locale).captureSources);
}

export function getLocalizedConversationInsightLabels(locale: UiLocale) {
  return copyMap(select(locale).insights);
}

export function getLocalizedTranscriptSourceLabels(locale: UiLocale) {
  return copyMap(select(locale).transcriptSources);
}

export function getLocalizedThreadStatusLabels(locale: UiLocale) {
  return copyMap(select(locale).threadStatuses);
}

export function getLocalizedEventLabels(locale: UiLocale) {
  return copyMap(select(locale).eventLabels);
}

export function getLocalizedLlmTaskLabels(locale: UiLocale) {
  return copyMap(select(locale).llmTasks);
}

export function getLocalizedLlmFallbackLabels(locale: UiLocale) {
  return copyMap(select(locale).llmFallbacks);
}

export function getLocalizedObjectTypeLabels(locale: UiLocale) {
  return copyMap(select(locale).objectTypes);
}

export function getLocalizedMemorySourceLabels(locale: UiLocale) {
  return copyMap(select(locale).memorySources);
}

export function getLocalizedDemoAccounts(locale: UiLocale) {
  return getDemoAccountCards(locale);
}

export function getLocalizedSetupOptions(locale: UiLocale) {
  return isEnglishLocale(locale) ? enSetup : zhSetup;
}

export function getLocalizedPolicyGuides(locale: UiLocale) {
  return isEnglishLocale(locale) ? enPolicyGuides : zhPolicyGuides;
}
