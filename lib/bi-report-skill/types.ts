export const biReportSeverities = ["CLEAR", "WATCH", "WARN", "ALERT", "CRITICAL"] as const;
export const biReportDeliveryChannels = ["DINGTALK_GROUP_WEBHOOK", "DINGTALK_APP_MESSAGE"] as const;
export const biReportDeliveryStatuses = ["PENDING", "SENT", "FAILED", "SKIPPED"] as const;

export type BiReportSeverity = (typeof biReportSeverities)[number];
export type BiReportDeliveryChannel = (typeof biReportDeliveryChannels)[number];
export type BiReportDeliveryStatus = (typeof biReportDeliveryStatuses)[number];
export type BiReportContinuityStatus = "first_seen" | "recurring" | "worsening" | "recovering";
export type BiReportFeedbackStatus = "accepted" | "corrected" | "rejected";
export type BiReportMetricFormat = "integer" | "decimal" | "currency" | "percent";
export type BiReportSchemaColumnType = "string" | "date" | "integer" | "decimal" | "boolean";
export type BiReportComparisonOperator = "<" | "<=" | ">" | ">=" | "=";
export type BiReportRowValue = string | number | boolean | null;
export type BiReportRow = Record<string, BiReportRowValue>;

export type BiReportSkillParameter = {
  name: string;
  type: "string" | "date" | "integer" | "decimal" | "boolean";
  required: boolean;
  description?: string;
};

export type BiReportSkillManifest = {
  skillKey: string;
  name: string;
  version: string;
  sourceType: string;
  analysisMode: string;
  defaultSchedule: string;
  timezone: string;
  supportedDeliveryChannels: BiReportDeliveryChannel[];
  parameters: BiReportSkillParameter[];
  silencePolicy?: string;
  boundaries: string[];
};

export type BiReportSchemaColumn = {
  name: string;
  type: BiReportSchemaColumnType;
  required: boolean;
  label?: string;
  description?: string;
};

export type BiReportSchemaDefinition = {
  version: string;
  type: "table";
  primaryKey?: string[];
  columns: BiReportSchemaColumn[];
};

export type BiReportAggregationDefinition =
  | {
      key: string;
      label: string;
      type: "sum";
      field: string;
      format?: BiReportMetricFormat;
    }
  | {
      key: string;
      label: string;
      type: "ratio";
      numerator: string;
      denominator: string;
      format?: BiReportMetricFormat;
    }
  | {
      key: string;
      label: string;
      type: "pct_change";
      current: string;
      previous: string;
      format?: BiReportMetricFormat;
    }
  | {
      key: string;
      label: string;
      type: "ranking_count";
      rankingKey: string;
      format?: BiReportMetricFormat;
    };

export type BiReportRankingDefinition =
  | {
      key: string;
      label?: string;
      type: "row_pct_change";
      dimensionField: string;
      currentField: string;
      previousField: string;
      order: "asc" | "desc";
      take: number;
      includeFields?: string[];
    }
  | {
      key: string;
      label?: string;
      type: "row_ratio_threshold";
      dimensionField: string;
      numeratorField: string;
      denominatorField: string;
      threshold: number;
      order: "asc" | "desc";
      take: number;
      includeFields?: string[];
    };

export type BiReportMetricDefinition = {
  version: string;
  aggregations: BiReportAggregationDefinition[];
  rankings?: BiReportRankingDefinition[];
  displayOrder?: string[];
};

export type BiReportCriteriaRule = {
  id: string;
  severity: BiReportSeverity;
  metricKey: string;
  operator: BiReportComparisonOperator;
  threshold: number;
  title: string;
  reason: string;
};

export type BiReportResultCriteria = {
  version: string;
  severityOrder?: BiReportSeverity[];
  summaryMetricKeys: string[];
  rules: BiReportCriteriaRule[];
  silenceThreshold?: BiReportSeverity;
  maxFindings?: number;
};

export type BiReportSkillPack = {
  baseDir: string;
  manifest: BiReportSkillManifest;
  querySql: string;
  schema: BiReportSchemaDefinition;
  metrics: BiReportMetricDefinition;
  resultCriteria: BiReportResultCriteria;
  promptTemplate: string;
  messageTemplate: string;
};

export type BiReportDeliveryTarget = {
  channel: BiReportDeliveryChannel;
  targetType: string;
  targetKey: string;
};

export type BiReportSignalRoutingSupervisorMapping = {
  orgName?: string;
  empName?: string;
  empId?: number;
  helmUserId?: string;
  userName?: string;
  userEmail?: string;
  notificationTargetKey?: string;
};

export type BiReportSignalRoutingApproverMapping = {
  helmUserId?: string;
  userName?: string;
  userEmail?: string;
  rolePresetKey?: string;
};

export type BiReportSignalRoutingConfig = {
  strategy?: "seat_supervisor_mapping";
  supervisorMappings?: BiReportSignalRoutingSupervisorMapping[];
  approverMappings?: BiReportSignalRoutingApproverMapping[];
  requireOwnerForCritical?: boolean;
  requireApproverForCritical?: boolean;
  requireNotificationTargetForCritical?: boolean;
};

export type BiReportSubscriptionConfig = {
  name: string;
  extensionKey?: string;
  skillKey: string;
  skillVersion: string;
  enabled: boolean;
  scheduleCron: string;
  timezone: string;
  sqlParams: Record<string, string>;
  deliveryTargets: BiReportDeliveryTarget[];
  signalRouting?: BiReportSignalRoutingConfig;
  silencePolicy?: {
    mode?: string;
  };
  dedupeWindowMinutes?: number;
};

export type BiReportSummaryMetric = {
  key: string;
  label: string;
  value: number;
  format: BiReportMetricFormat;
};

export type BiReportRankingItem = {
  label: string;
  score: number;
  fields: Record<string, BiReportRowValue>;
};

export type BiReportComputedMetrics = {
  metricsByKey: Record<string, number>;
  summaryMetrics: BiReportSummaryMetric[];
  rankings: Record<string, BiReportRankingItem[]>;
};

export type BiReportEvaluation = {
  severity: BiReportSeverity;
  matchedRules: BiReportCriteriaRule[];
  topFindings: string[];
  shouldSend: boolean;
  silenceThreshold: BiReportSeverity;
};

export type BiReportAnalysisOutput = {
  headline: string;
  summary: string;
  findings: string[];
  possibleCauses: string[];
  recommendedActions: string[];
  confidence?: number | null;
  continuityStatus?: BiReportContinuityStatus;
  historicalContext?: string | null;
  feedbackContext?: string | null;
  boundaryNote: string;
  generationMode?: "fallback" | "llm_enhanced";
  llmMeta?: Record<string, unknown> | null;
};

export type BiReportAnalysisReviewOutput = {
  approved: boolean;
  issueCodes: BiReportReviewIssueCode[];
  issueNotes?: string[] | null;
  rewrittenHeadline?: string | null;
  rewrittenPossibleCauses?: string[] | null;
  rewrittenRecommendedActions?: string[] | null;
};

export const biReportReviewIssueCodes = [
  "SPECULATION_AS_FACT",
  "OUT_OF_EVIDENCE_SCOPE",
  "BOUNDARY_VIOLATION",
  "OVERSTRONG_ACTION",
] as const;

export type BiReportReviewIssueCode = (typeof biReportReviewIssueCodes)[number];

export type BiReportDeliveryPreview = {
  channel: BiReportDeliveryChannel;
  targetType: string;
  targetKey: string;
  status: BiReportDeliveryStatus;
  requestBody?: string | null;
  responseBody?: string | null;
};

export type BiReportRunMemoryEntry = {
  id: string;
  workspaceId: string;
  extensionKey: string | null;
  skillKey: string;
  skillVersion: string;
  windowLabel: string;
  severity: BiReportSeverity | null;
  shouldSend: boolean;
  summaryMetrics: BiReportSummaryMetric[];
  topFindings: string[];
  analysisSummary: string;
  continuityStatus: BiReportContinuityStatus | null;
  historicalContext: string | null;
  createdAt: string;
};

export type BiReportRunExecutionHint = {
  runId: string;
  skillKey: string;
  startedAt: string;
  finishedAt: string | null;
  generationMode: "fallback" | "llm_enhanced" | null;
  promptKey: string | null;
  promptVersion: string | null;
  model: string | null;
  modelVersion: string | null;
  reviewApproved: boolean | null;
  reviewIssueCount: number;
  reviewIssueCodes: BiReportReviewIssueCode[];
  reviewIssueNotes: string[];
  reviewRewritten: boolean;
  sendDecisionReason:
    | "criteria_not_met"
    | "criteria_met"
    | "severity_escalated"
    | "worsening"
    | "duplicate_within_dedupe_window"
    | null;
  sendSuppressed: boolean;
  dedupeWindowMinutes: number | null;
  queryWarnings: string[];
};

export type BiReportRunFailureStage =
  | "query"
  | "analysis"
  | "delivery"
  | "persistence"
  | "authorization"
  | "unknown";

export type BiReportRunReadoutSummary = {
  runId: string;
  skillKey: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "COMPLETED_WITH_WARNINGS" | "FAILED" | "SKIPPED";
  severity: BiReportSeverity | null;
  rowCount: number;
  scheduledFor: string;
  startedAt: string;
  finishedAt: string | null;
  errorSummary: string | null;
  failureStage: BiReportRunFailureStage | null;
  actionableReason: string | null;
  impactsSignalGeneration: boolean;
  nextStep: string | null;
};

export type BiReportReviewIssueStat = {
  code: BiReportReviewIssueCode;
  count: number;
};

export type BiReportQueryWarningStat = {
  warning: string;
  count: number;
};

export type BiReportTrendDirection = "up" | "down" | "flat" | "insufficient_data";
export type BiReportBusinessSignalStatus =
  | "open"
  | "triaged"
  | "actioned"
  | "resolved"
  | "dismissed";

export type BiReportBusinessSignalRecord = {
  id: string;
  workspaceId: string;
  sourceRunId: string;
  skillKey: string;
  signalType: string;
  signalKey: string;
  title: string;
  summary: string;
  severity: BiReportSeverity;
  continuityStatus: BiReportContinuityStatus | null;
  dimensions: Record<string, unknown> | null;
  metrics: Record<string, unknown> | null;
  evidence: Record<string, unknown> | null;
  recommendedActions: string[];
  status: BiReportBusinessSignalStatus;
  ownerUserId: string | null;
  ownerUserName: string | null;
  ownerUserEmail: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BiReportSignalNotificationStatus =
  | "pending"
  | "processing"
  | "sent"
  | "failed"
  | "received"
  | "deferred"
  | "transferred";

export type BiReportSignalNotificationRecord = {
  id: string;
  workspaceId: string;
  signalId: string;
  targetUserId: string | null;
  channel: string;
  targetKey: string;
  status: BiReportSignalNotificationStatus;
  providerMessageId: string | null;
  errorMessage: string | null;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BiReportBusinessHandoffTargetType = "recommendation" | "action_item" | "approval";
export type BiReportBusinessHandoffPriority = "low" | "medium" | "high";
export type BiReportBusinessHandoffDecisionStatus = "open" | "accepted" | "dismissed";
export type BiReportHandoffExecutionLogStage = "plan" | "result";

export type BiReportBusinessHandoffDraft = {
  targetType: BiReportBusinessHandoffTargetType;
  title: string;
  summary: string;
  priority: BiReportBusinessHandoffPriority;
  ownerUserId: string | null;
  ownerUserName: string | null;
  sourceSignalId: string;
};

export type BiReportBusinessHandoffDecisionRecord = {
  id: string;
  workspaceId: string;
  signalId: string;
  targetType: string;
  status: BiReportBusinessHandoffDecisionStatus;
  reviewedByUserId: string | null;
  reviewComment: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BiReportBusinessHandoffMaterializationRecord = {
  decisionId: string;
  signalId: string;
  actionItemId: string;
  actionItemTitle: string;
  actionStatus: string;
  approvalTaskId: string | null;
  approvalStatus: string | null;
  href: string;
  createdAt: string;
  ownerUserName: string | null;
};

export type BiReportHandoffExecutionLogRecord = {
  id: string;
  workspaceId: string;
  signalId: string;
  decisionId: string;
  actionItemId: string | null;
  approvalTaskId: string | null;
  stage: BiReportHandoffExecutionLogStage;
  authorUserId: string;
  summary: string;
  details: Record<string, unknown> | null;
  isEffective: boolean | null;
  followUpNeeded: boolean | null;
  createdAt: string;
  updatedAt: string;
};

export type BiReportRiskTrend = {
  label: string;
  latestWindowCount: number;
  baselineWindowCount: number;
  trend: BiReportTrendDirection;
};

export type BiReportEffectivenessSummary = {
  runCount: number;
  sendCount: number;
  sendRate: number;
  suppressedCount: number;
  feedbackCount: number;
  falsePositiveCount: number;
  falsePositiveRate: number | null;
  actionableFeedbackCount: number;
  actionEffectiveCount: number;
  actionEffectiveRate: number | null;
  ruleAdjustmentCount: number;
};

export type BiReportRuleOptimizationSuggestionLevel = "info" | "warning" | "action";
export type BiReportRuleOptimizationCategory =
  | "threshold_review"
  | "query_governance"
  | "feedback_backfill"
  | "send_policy"
  | "reviewer_tuning"
  | "action_playbook";
export type BiReportRuleOptimizationPriority = "high" | "medium" | "low";
export type BiReportRuleOptimizationBucket = "immediate" | "this_week" | "observe";

export type BiReportRuleOptimizationSuggestion = {
  id: string;
  category: BiReportRuleOptimizationCategory;
  title: string;
  reason: string;
  evidenceCount: number;
  level: BiReportRuleOptimizationSuggestionLevel;
  priority: BiReportRuleOptimizationPriority;
  bucket: BiReportRuleOptimizationBucket;
  latestEvidenceAt: string | null;
};

export type BiReportSimilarCasePreview = {
  windowLabel: string | null;
  severity: BiReportSeverity | null;
  confirmedCause: string | null;
  confirmedAction: string | null;
  falsePositiveSignal: boolean;
  latestPlanSummary: string | null;
  latestResultSummary: string | null;
  latestExecutionEffective: boolean | null;
};

export type BiReportRecentRunContext = {
  recentRuns: BiReportRunMemoryEntry[];
  continuityStatus: BiReportContinuityStatus;
  historicalContext: string | null;
};

export type BiReportSendDecision = {
  shouldSend: boolean;
  reason:
    | "criteria_not_met"
    | "criteria_met"
    | "severity_escalated"
    | "worsening"
    | "duplicate_within_dedupe_window";
  dedupeWindowMinutes: number;
};

export type BiReportFeedbackMemoryEntry = {
  id: string;
  workspaceId: string;
  extensionKey: string | null;
  skillKey: string;
  skillVersion: string;
  windowLabel: string | null;
  feedbackStatus: BiReportFeedbackStatus;
  confirmedCause: string | null;
  confirmedAction: string | null;
  isFalsePositive: boolean | null;
  actionEffective: boolean | null;
  needsRuleAdjustment: boolean | null;
  resolutionOutcome: string | null;
  note: string | null;
  createdAt: string;
};

export type BiReportRecentFeedbackContext = {
  recentFeedbacks: BiReportFeedbackMemoryEntry[];
  feedbackContext: string | null;
  confirmedCauseHints: string[];
  confirmedActionHints: string[];
  falsePositiveSignal: boolean;
  ruleAdjustmentSignal: boolean;
};

export type BiReportSimilarCaseContext = {
  relatedRuns: BiReportRunMemoryEntry[];
  relatedFeedbacks: BiReportFeedbackMemoryEntry[];
  caseContext: string | null;
};

export type PreparedBiReportDryRun = {
  skill: BiReportSkillPack;
  subscription: BiReportSubscriptionConfig;
  rows: BiReportRow[];
  computed: BiReportComputedMetrics;
  evaluation: BiReportEvaluation;
  recentRunContext: BiReportRecentRunContext;
  recentFeedbackContext: BiReportRecentFeedbackContext;
  similarCaseContext: BiReportSimilarCaseContext;
  analysis: BiReportAnalysisOutput;
  message: string;
  windowLabel: string;
};
