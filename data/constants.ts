export const demoAccounts = [
  {
    email: "saleslead@demo.com",
    name: "周玥",
    roleLabel: "评审成员",
    description: "演示中国企业软件销售转化、会后推进和外发复核",
  },
  {
    email: "founder@demo.com",
    name: "林舟",
    roleLabel: "组织所有者",
    description: "查看经营者工作台、多线协同和复核总览",
  },
  {
    email: "recruiter@demo.com",
    name: "沈乔",
    roleLabel: "评审成员",
    description: "演示职位推进、候选人面试安排和时间线更新",
  },
] as const;

export const roleLabels = {
  OWNER: "组织所有者",
  BILLING_ADMIN: "计费管理员",
  ADMIN: "管理员",
  OPERATOR: "运营成员",
  REVIEWER: "评审成员",
  MEMBER: "成员",
} as const;

export const stageLabels = {
  NEW: "新机会",
  CONTACTED: "已接触",
  ADVANCING: "待推进",
  WAITING_THEM: "等待对方",
  INTERNAL_SYNC: "需内部协同",
  DONE: "已完成",
  LOST: "已失效",
} as const;

export const opportunityTypeLabels = {
  CLIENT: "客户机会",
  RECRUITING: "招聘机会",
  PARTNERSHIP: "合作机会",
  INTERNAL: "内部事项",
} as const;

export const riskLabels = {
  LOW: "低风险",
  MEDIUM: "中风险",
  HIGH: "高风险",
  CRITICAL: "关键风险",
} as const;

export const riskTone = {
  LOW: "bg-[color:var(--status-success-bg)] text-[color:var(--status-success-text)] ring-[color:var(--status-success-border)]",
  MEDIUM: "bg-[color:var(--status-warning-bg)] text-[color:var(--status-warning-text)] ring-[color:var(--status-warning-border)]",
  HIGH: "bg-[color:var(--status-warning-bg)] text-[color:var(--status-warning-text)] ring-[color:var(--status-warning-border)]",
  CRITICAL: "bg-[color:var(--status-danger-bg)] text-[color:var(--status-danger-text)] ring-[color:var(--status-danger-border)]",
} as const;

export const warmthLabels = {
  COLD: "冷",
  WARM: "暖",
  HOT: "热",
  CHAMPION: "关键支持者",
} as const;

export const actionTypeLabels = {
  DRAFT_EXTERNAL_EMAIL: "起草外发邮件",
  DRAFT_INTERNAL_NOTE: "起草内部纪要",
  CREATE_MEETING: "创建会议",
  UPDATE_OPPORTUNITY_STAGE: "更新机会阶段",
  CREATE_TASK: "创建待办",
  ASSIGN_OWNER: "指派负责人",
  CHANGE_DUE_DATE: "修改截止时间",
  SEND_MEETING_SUMMARY: "发送会议纪要",
  GENERATE_REPLY_DRAFT: "生成回复草稿",
  SCHEDULE_INTERVIEW: "安排面试",
} as const;

export const actionTypeChannel = {
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
} as const;

export const actionModeLabels = {
  SUGGEST_ONLY: "仅建议",
  REQUIRES_APPROVAL: "需逐条审批",
  AUTO_WITHIN_THRESHOLD: "阈值内自动执行",
  FORBIDDEN: "禁止执行",
} as const;

export const approvalStatusLabels = {
  PENDING: "待审批",
  EXECUTED: "已执行",
  REJECTED: "已拒绝",
  WITHDRAWN: "已撤回",
} as const;

export const commitmentStatusLabels = {
  OPEN: "待兑现",
  IN_PROGRESS: "推进中",
  FULFILLED: "已兑现",
  CANCELED: "已取消",
  OVERDUE: "已逾期",
} as const;

export const blockerStatusLabels = {
  OPEN: "待处理",
  MONITORING: "持续观察",
  RESOLVED: "已解决",
  IGNORED: "暂不处理",
} as const;

export const captureStatusLabels = {
  RECORDING: "记录中",
  PROCESSING: "处理中",
  COMPLETED: "已完成",
  FAILED: "处理失败",
  CANCELED: "已取消",
} as const;

export const captureSourceLabels = {
  MANUAL_CAPTURE: "手动记录",
  ZOOM: "Zoom",
  TENCENT_MEETING: "腾讯会议",
  CALL_CENTER: "电话 / Call Center",
  OTHER: "其他来源",
} as const;

export const conversationInsightLabels = {
  FACT: "关键事实",
  COMMITMENT: "承诺",
  BLOCKER: "阻塞",
  RISK: "风险",
  NEXT_ACTION: "下一步动作",
} as const;

export const transcriptSourceLabels = {
  MANUAL_TEXT: "手工速记",
  OPENAI_ASR: "真实语音转写",
  FALLBACK_DEMO: "演示转写",
  EXTERNAL_INGEST: "外部转写",
} as const;

export const policyDefaults = {
  DRAFT_EXTERNAL_EMAIL: {
    mode: "REQUIRES_APPROVAL",
    riskThreshold: "LOW",
  },
  DRAFT_INTERNAL_NOTE: {
    mode: "AUTO_WITHIN_THRESHOLD",
    riskThreshold: "HIGH",
  },
  CREATE_MEETING: {
    mode: "AUTO_WITHIN_THRESHOLD",
    riskThreshold: "MEDIUM",
  },
  UPDATE_OPPORTUNITY_STAGE: {
    mode: "AUTO_WITHIN_THRESHOLD",
    riskThreshold: "MEDIUM",
  },
  CREATE_TASK: {
    mode: "AUTO_WITHIN_THRESHOLD",
    riskThreshold: "HIGH",
  },
  ASSIGN_OWNER: {
    mode: "REQUIRES_APPROVAL",
    riskThreshold: "MEDIUM",
  },
  CHANGE_DUE_DATE: {
    mode: "AUTO_WITHIN_THRESHOLD",
    riskThreshold: "MEDIUM",
  },
  SEND_MEETING_SUMMARY: {
    mode: "AUTO_WITHIN_THRESHOLD",
    riskThreshold: "HIGH",
  },
  GENERATE_REPLY_DRAFT: {
    mode: "REQUIRES_APPROVAL",
    riskThreshold: "LOW",
  },
  SCHEDULE_INTERVIEW: {
    mode: "REQUIRES_APPROVAL",
    riskThreshold: "MEDIUM",
  },
} as const;

export const policyRecommendations = {
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

export const threadStatusLabels = {
  OPEN: "开放",
  WAITING_US: "待我方回复",
  WAITING_THEM: "待对方回复",
  CLOSED: "已关闭",
} as const;

export const personaOptions = [
  "销售负责人",
  "猎头顾问",
  "创始人 / COO",
  "顾问 / 服务商",
];
export const connectorOptions = [
  "Gmail",
  "Calendar",
  "Zoom / Meet",
  "上传历史纪要",
];
export const focusOptions = ["客户跟进", "招聘推进", "合作拓展", "内部事项"];
export const strategyOptions = [
  "对外邮件默认需审批",
  "内部纪要按规则发送",
  "创建日程可自动执行",
  "更新机会状态可自动执行",
];
