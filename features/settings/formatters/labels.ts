import type {
  AccessState,
  CustomEngagementStatus,
  CustomEngagementType,
  ParticipantPortalAccessStatus,
  PartnerProgramStatus,
  PayoutProfileStatus,
  ProgramApplicationStatus,
  PublisherProfileStatus,
  RevenueBeneficiaryType,
  RevenueLedgerStatus,
  RevenueRuleCadence,
  RevenueRuleValueType,
  RevenueSourceType,
  SalesReferralStatus,
  SettlementBatchStatus,
  SettlementLineStatus,
} from "@prisma/client";

export const accessStateLabels: Record<AccessState, { zh: string; en: string }> = {
  TRIALING: { zh: "试用中", en: "Trialing" },
  ACTIVE: { zh: "已激活", en: "Active" },
  GRACE: { zh: "宽限期", en: "Grace" },
  READ_ONLY: { zh: "只读", en: "Read-only" },
  CANCELED: { zh: "已取消", en: "Canceled" },
};

export const usageTypeLabels: Record<string, { zh: string; en: string }> = {
  MEETING_PROCESSING: { zh: "会议处理", en: "Meeting processing" },
  MEETING_MEMORY_EXPORT: { zh: "会议记忆导出", en: "Meeting memory export" },
  CONNECTOR_SYNC: { zh: "连接同步", en: "Connector sync" },
  CRM_IMPORT: { zh: "客户关系系统 / 导入处理", en: "CRM / import processing" },
  CAPTURE_PROCESSING: { zh: "现场采集处理", en: "Capture processing" },
  RECOMMENDATION_GENERATION: { zh: "建议生成", en: "Recommendation generation" },
  BRIEFING_GENERATION: { zh: "简报生成", en: "Briefing generation" },
  PREMIUM_WORKER_INVOCATION: { zh: "增值能力调用", en: "Premium worker invocation" },
};

export const revenueSourceLabels: Record<RevenueSourceType, { zh: string; en: string }> = {
  ORGANIZATION_BASE_FEE: { zh: "组织基础费", en: "Organization base fee" },
  ACTIVE_SEAT: { zh: "额外活跃席位", en: "Additional active seat" },
  ADD_ON_WORKER: { zh: "增值能力收入", en: "Add-on worker revenue" },
  CUSTOM_IMPLEMENTATION: { zh: "定制实施收入", en: "Custom implementation revenue" },
  CUSTOM_MAINTENANCE: { zh: "定制维护收入", en: "Custom maintenance revenue" },
  SALES_REFERRAL: { zh: "销售转介绍收入", en: "Sales referral revenue" },
};

export const revenueBeneficiaryLabels: Record<RevenueBeneficiaryType, { zh: string; en: string }> = {
  PLATFORM: { zh: "平台", en: "Platform" },
  WORKER_PUBLISHER: { zh: "能力发布方", en: "Worker publisher" },
  SALES_REFERRAL: { zh: "销售转介绍方", en: "Sales referral beneficiary" },
  CUSTOM_SERVICES: { zh: "定制服务方", en: "Custom services beneficiary" },
};

export const revenueLedgerStatusLabels: Record<RevenueLedgerStatus, { zh: string; en: string }> = {
  PENDING: { zh: "待结算", en: "Pending" },
  APPROVED: { zh: "已批准", en: "Approved" },
  PAID: { zh: "已支付", en: "Paid" },
  REVERSED: { zh: "已冲回", en: "Reversed" },
};

export const revenueRuleCadenceLabels: Record<RevenueRuleCadence, { zh: string; en: string }> = {
  ONE_TIME: { zh: "一次性分成", en: "One-time split" },
  RECURRING: { zh: "持续分成", en: "Recurring split" },
};

export const revenueRuleValueLabels: Record<RevenueRuleValueType, { zh: string; en: string }> = {
  FIXED_PERCENT: { zh: "固定比例", en: "Fixed percent" },
  FIXED_AMOUNT: { zh: "固定金额", en: "Fixed amount" },
};

export const publisherProfileStatusLabels: Record<PublisherProfileStatus, { zh: string; en: string }> = {
  ACTIVE: { zh: "生效中", en: "Active" },
  INACTIVE: { zh: "未生效", en: "Inactive" },
};

export const salesReferralStatusLabels: Record<SalesReferralStatus, { zh: string; en: string }> = {
  ACTIVE: { zh: "生效中", en: "Active" },
  INACTIVE: { zh: "未生效", en: "Inactive" },
  CANCELED: { zh: "已停用", en: "Canceled" },
};

export const customEngagementTypeLabels: Record<CustomEngagementType, { zh: string; en: string }> = {
  IMPLEMENTATION: { zh: "定制实施", en: "Implementation" },
  MAINTENANCE: { zh: "定制维护", en: "Maintenance" },
};

export const customEngagementStatusLabels: Record<CustomEngagementStatus, { zh: string; en: string }> = {
  ACTIVE: { zh: "生效中", en: "Active" },
  COMPLETED: { zh: "已完成", en: "Completed" },
  CANCELED: { zh: "已停用", en: "Canceled" },
};

export const payoutProfileStatusLabels: Record<PayoutProfileStatus, { zh: string; en: string }> = {
  ACTIVE: { zh: "资料可用", en: "Profile ready" },
  INACTIVE: { zh: "暂不使用", en: "Inactive" },
};

export const participantPortalStatusLabels: Record<ParticipantPortalAccessStatus, { zh: string; en: string }> = {
  INVITED: { zh: "已邀请", en: "Invited" },
  ACTIVE: { zh: "已激活", en: "Active" },
  SUSPENDED: { zh: "已暂停", en: "Suspended" },
  ARCHIVED: { zh: "已归档", en: "Archived" },
};

export const partnerProgramStatusLabels: Record<PartnerProgramStatus, { zh: string; en: string }> = {
  ACTIVE: { zh: "开放中", en: "Active" },
  PAUSED: { zh: "暂停中", en: "Paused" },
  ARCHIVED: { zh: "已归档", en: "Archived" },
};

export const programApplicationStatusLabels: Record<ProgramApplicationStatus, { zh: string; en: string }> = {
  SUBMITTED: { zh: "已提交", en: "Submitted" },
  ACCEPTED: { zh: "已接受", en: "Accepted" },
  REJECTED: { zh: "已拒绝", en: "Rejected" },
  WAITLISTED: { zh: "等待名单", en: "Waitlisted" },
  INVITED: { zh: "已发邀请", en: "Invited" },
};

export const settlementBatchStatusLabels: Record<SettlementBatchStatus, { zh: string; en: string }> = {
  DRAFT: { zh: "草稿", en: "Draft" },
  APPROVED: { zh: "已批准", en: "Approved" },
  EXPORTED: { zh: "已导出", en: "Exported" },
  CLOSED: { zh: "已关闭", en: "Closed" },
};

export const settlementLineStatusLabels: Record<SettlementLineStatus, { zh: string; en: string }> = {
  PENDING: { zh: "待结算", en: "Pending" },
  APPROVED: { zh: "已批准", en: "Approved" },
  EXPORTED: { zh: "已导出", en: "Exported" },
  PAID: { zh: "已支付", en: "Paid" },
  REVERSED: { zh: "已冲回", en: "Reversed" },
};

export const payoutRailReadinessStatusLabels = {
  NOT_READY: { zh: "暂不建议接支付通道", en: "Not ready for payout rails" },
  CONDITIONAL_GO: { zh: "仅建议做窄试点评估", en: "Conditional go for a narrow pilot" },
  READY_FOR_NARROW_PILOT: { zh: "可进入窄支付通道试点", en: "Ready for a narrow payout-rail pilot" },
} as const;

export const payoutRailReadinessBlockerLabels = {
  NO_ACTIVE_PAYOUT_PROFILES: {
    zh: "当前还没有生效中的受益方结算资料。",
    en: "No active beneficiary payout profiles are available yet.",
  },
  NO_SETTLEMENT_BATCH_HISTORY: {
    zh: "当前还没有结算批次历史。",
    en: "No settlement batch history exists yet.",
  },
  NO_EXPORTED_OR_CLOSED_BATCH_HISTORY: {
    zh: "当前还没有已导出 / 已关闭批次证据。",
    en: "There is no exported or closed settlement batch evidence yet.",
  },
  CURRENT_BATCH_MISSING_PAYOUT_PROFILES: {
    zh: "当前批次里仍有条目缺少可用的结算资料。",
    en: "The current batch still contains lines without a usable payout profile.",
  },
} as const;

export const payoutRailReadinessWatchpointLabels = {
  NO_MANUAL_COMPLETION_EVIDENCE: {
    zh: "当前还没有带导出证据的已支付 / 已冲回手工结算完成证据。",
    en: "There is no export-backed paid / reversed manual-settlement completion evidence yet.",
  },
  NO_INVITED_OR_ACTIVE_PARTICIPANTS: {
    zh: "当前还没有已邀请 / 已激活的参与方访问证据。",
    en: "There is no invited / active participant-access evidence yet.",
  },
  NO_REVERSAL_EVIDENCE: {
    zh: "当前还没有冲回证据，后续接支付通道时仍应保留手工回退。",
    en: "There is no reversal evidence yet, so any future rail should still keep a manual fallback.",
  },
  PAID_WITHOUT_EXPORT_ANOMALIES: {
    zh: "当前仍有已支付但缺少导出证据的条目，进入任何支付通道讨论前应先完成审计。",
    en: "Some paid lines still lack export evidence, so they should be audited before any payout-rail discussion continues.",
  },
} as const;

export const payoutRailPilotCohortStatusLabels = {
  HOLD_MANUAL: { zh: "继续保持手工结算", en: "Keep settlement manual" },
  READY_TO_SELECT_COHORT: { zh: "可进入试点人群选择", en: "Ready to select one cohort" },
  READY_FOR_OPERATOR_DRY_RUN: {
    zh: "可进入运营试跑",
    en: "Ready for operator dry run",
  },
} as const;

export const payoutRailPilotChecklistLabels = {
  READINESS_GATE_GREEN: {
    zh: "准备度闸门已转绿",
    en: "Readiness gate is green",
  },
  CN_ONLY_SCOPE: {
    zh: "当前仍保持中国区单区域试点",
    en: "Pilot still stays inside one China region",
  },
  SINGLE_BENEFICIARY_CLASS: {
    zh: "只保留一个受益方类别",
    en: "Only one beneficiary class stays in scope",
  },
  SINGLE_PAYOUT_METHOD: {
    zh: "只保留一种结算方式标签",
    en: "Only one payout method label stays in scope",
  },
  SINGLE_CURRENCY: {
    zh: "只保留单一币种",
    en: "Only one currency stays in scope",
  },
  FULL_PAYOUT_PROFILE_COVERAGE: {
    zh: "试点人群已补齐结算资料覆盖",
    en: "The cohort has full payout-profile coverage",
  },
  FULL_PARTICIPANT_ACCESS_COVERAGE: {
    zh: "试点人群已补齐参与方访问覆盖",
    en: "The cohort has full participant-access coverage",
  },
  TWO_SETTLEMENT_CYCLES: {
    zh: "至少已有两轮结算周期证据",
    en: "At least two settlement cycles are visible",
  },
  COMPLETION_AND_REVERSAL_EVIDENCE: {
    zh: "已支付 / 已冲回证据都已存在",
    en: "Both paid and reversed evidence already exist",
  },
  NO_OPEN_EXCEPTIONS: {
    zh: "当前试点人群没有开放异常项",
    en: "The cohort has no open exceptions",
  },
} as const;

export const payoutRailPilotNextMoveLabels = {
  KEEP_MANUAL_SETTLEMENT: {
    zh: "继续诚实跑手工结算，不要提前碰支付通道。",
    en: "Keep running manual settlement honestly before touching payout rails.",
  },
  CHOOSE_ONE_BENEFICIARY_CLASS: {
    zh: "先手工选定一个受益方类别，不要把试点一开始就放大成多类并行。",
    en: "Choose one beneficiary class first instead of widening the pilot to multiple classes.",
  },
  NORMALIZE_PAYOUT_METHOD_SCOPE: {
    zh: "先把结算方式标签收敛成一种，再谈支付通道试跑。",
    en: "Normalize to one payout method label before any rail dry run begins.",
  },
  CAPTURE_SECOND_SETTLEMENT_CYCLE: {
    zh: "再补一轮结算周期证据，不要只凭单轮样本决定。",
    en: "Capture another settlement cycle before deciding from a single sample.",
  },
  CLEAR_OPEN_EXCEPTIONS: {
    zh: "先清掉开放的结算异常，再进入试点人群讨论。",
    en: "Clear open settlement exceptions before discussing a pilot cohort.",
  },
  RUN_OFF_PLATFORM_DRY_RUN: {
    zh: "按当前导出契约做一次站外试跑，但仍保留手工回退。",
    en: "Run one off-platform dry run using the current export contract while keeping manual fallback.",
  },
} as const;

export const settlementOpsNextMoveLabels = {
  ADD_ACTIVE_PAYOUT_PROFILES: {
    zh: "先补齐生效中的结算资料，再让更多条目进入可结算姿态。",
    en: "Add active payout profiles first so more lines can safely enter settlement posture.",
  },
  ISSUE_PARTICIPANT_ACCESS: {
    zh: "为还没有已邀请 / 已激活访问的受益方发出受控参与方访问。",
    en: "Issue controlled participant access for beneficiaries that still lack invited / active access.",
  },
  CREATE_FIRST_SETTLEMENT_BATCH: {
    zh: "先创建第一条月度结算批次，把待结算条目正式拉进手工结算流程。",
    en: "Create the first monthly settlement batch so payable-later lines actually enter the manual settlement path.",
  },
  EXPORT_FIRST_SETTLEMENT_BATCH: {
    zh: "把第一条批次真正导出或关闭，补齐已导出 / 已关闭证据。",
    en: "Export or close the first batch so exported / closed settlement evidence becomes real.",
  },
  CAPTURE_MANUAL_COMPLETION_EVIDENCE: {
    zh: "至少完成一条带导出证据的已支付或已冲回条目，证明手工结算不是纸面存在。",
    en: "Complete at least one export-backed paid or reversed line so manual settlement is proven in operation, not only in structure.",
  },
  AUDIT_PAID_WITHOUT_EXPORT: {
    zh: "先审计已支付但缺少导出证据的条目，再把它们误当成结算完成证明。",
    en: "Audit paid lines that still lack export evidence before treating them as settlement completion proof.",
  },
} as const;

export const settlementExceptionTypeLabels = {
  MISSING_PAYOUT_PROFILE: {
    zh: "缺少结算资料",
    en: "Missing payout profile",
  },
  INACTIVE_PAYOUT_PROFILE: {
    zh: "结算资料未生效",
    en: "Inactive payout profile",
  },
  SUSPENDED_PARTICIPANT_ACCESS: {
    zh: "参与方访问已暂停",
    en: "Suspended participant access",
  },
  ARCHIVED_PARTICIPANT_ACCESS: {
    zh: "参与方访问已归档",
    en: "Archived participant access",
  },
  EXPORTED_NOT_SETTLED: {
    zh: "已导出但未结清",
    en: "Exported but not settled",
  },
  PAID_WITHOUT_EXPORT: {
    zh: "已支付但缺少导出证据",
    en: "Paid without export evidence",
  },
} as const;

export const settlementExceptionNextMoveLabels = {
  ADD_OR_REACTIVATE_PAYOUT_PROFILE: {
    zh: "补齐或重新启用结算资料",
    en: "Add or reactivate payout profile",
  },
  RESTORE_PARTICIPANT_ACCESS: {
    zh: "恢复参与方访问",
    en: "Restore participant access",
  },
  COMPLETE_EXPORTED_LINES: {
    zh: "完成已导出条目的已支付 / 已冲回更新",
    en: "Complete paid / reversed updates for exported lines",
  },
  AUDIT_PAID_WITHOUT_EXPORT: {
    zh: "审计缺少导出证据的已支付条目",
    en: "Audit paid lines that lack exported evidence",
  },
} as const;
