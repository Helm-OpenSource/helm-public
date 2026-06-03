import {
  ActorType,
  ApprovalRequestStatus,
  ArtifactBundleStatus,
  ArtifactReviewStatus,
  MemoryItemKind,
  MemoryItemPromotionRule,
  MemoryItemRetention,
  MemoryItemScope,
  MemoryItemSensitivity,
  MemoryItemStatus,
  MemoryItemVerification,
  OpportunityStage,
  RiskLevel,
  RuntimeEventStatus,
  UsageType,
  WorkerRunStatus,
} from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import {
  ensureWorkspaceProcessingAllowed,
  recordUsageLedgerEntry,
} from "@/lib/billing/foundation";
import { db } from "@/lib/db";
import { resolveApprovalRule } from "@/lib/helm-v2/approval-matrix";
import {
  type ActionPackBundleContent,
  buildMeetingRuntimeMemoryContext,
  deriveShadowOpportunityUpdate,
  type MeetingFactsArtifact,
  type RiskFlagsArtifact,
} from "@/lib/helm-v2/meeting-action-pack-runtime";
import { jsonStringify, safeParseJson, trimText } from "@/lib/utils";

const OPPORTUNITY_JUDGE_AGENT = "opportunity-judge";
const DEFAULT_WORKSPACE_SUMMARY =
  "当前工作区以判断优先方式把会议、对象状态、审批和下一步收成同一条经营推进链。";
const SHADOW_ONLY_BOUNDARY_NOTE =
  "This layer only updates shadow opportunity posture after explicit review. Official CRM state stays unchanged.";
const SHADOW_APPROVAL_NOTE =
  "已确认只表示允许把判断消费进阴影摘要，不代表正式 CRM 已写回，也不代表形成外部承诺。";
const SHADOW_APPROVED_DOES_NOT_MEAN_NOTE =
  "已确认不等于正式 CRM 写回，不代表正式 CRM 已更新，也不代表形成对外承诺。";
const INSUFFICIENT_EVIDENCE_NOTE =
  "当前证据仍不足以支持阶段跨越，需要补足证据后再确认。";

type OpportunityJudgeMeeting = NonNullable<
  Awaited<ReturnType<typeof loadOpportunityJudgeMeeting>>
>;
type OpportunityJudgeReviewMode =
  | "confirm"
  | "edit_confirm"
  | "reject"
  | "keep_draft"
  | "block_boundary"
  | "insufficient_evidence";

type PersistedArtifact<TArtifact> = Omit<TArtifact, "confidence"> & {
  id: string;
  status: ArtifactBundleStatus;
  confidence: number | null;
  reviewedAt?: Date | null;
  confirmedAt?: Date | null;
  consumedAt?: Date | null;
};

type OpportunityJudgeSource = {
  meeting: OpportunityJudgeMeeting;
  meetingFacts: MeetingFactsArtifact;
  riskFlags: RiskFlagsArtifact;
  actionPack: ActionPackBundleContent;
  promotedMemory: Array<{
    id: string;
    summary: string;
    verification: string;
    status: string;
    meetingId: string | null;
    opportunityId: string | null;
    companyId: string | null;
  }>;
  timelineEntries: string[];
  evidenceRefs: string[];
  sourceProvenance: Array<Record<string, unknown>>;
  meetingFactsEventId: string | null;
};

export type OpportunityDecisionCriterion = {
  label: string;
  status: "confirmed" | "open" | "missing";
  source: "fact_derived" | "inferred";
  evidenceRefs: string[];
};

export type OpportunityJudgementBlocker = {
  label: string;
  severity: "low" | "medium" | "high";
  source: "fact_derived" | "inferred";
  evidenceRefs: string[];
};

export type OpportunityRiskFlag = {
  label: string;
  severity: "low" | "medium" | "high";
  reason: string;
  evidenceRefs: string[];
};

export type OpportunityDeltaArtifact = {
  artifactId: "opportunity_delta.json";
  stageShadowFrom: OpportunityStage;
  stageShadowTo: OpportunityStage;
  probabilityDelta: number;
  decisionCriteria: OpportunityDecisionCriterion[];
  championStatus: "missing" | "unclear" | "emerging" | "confirmed";
  blockers: OpportunityJudgementBlocker[];
  riskFlags: OpportunityRiskFlag[];
  nextBestAction: string;
  managerAttentionRequired: boolean;
  factDerived: string[];
  inferredAssumptions: string[];
  suggestionFields: string[];
  stageRationale: string;
  evidenceRefs: string[];
  sourceProvenance: Array<Record<string, unknown>>;
  confidence: number;
  openQuestions: string[];
  boundaryNotes: string[];
  recommendedNextAction: string;
  noOfficialWriteback: true;
};

export type ManagerAttentionFlag = {
  key:
    | "stage_ambiguity"
    | "missing_champion"
    | "budget_uncertainty"
    | "pricing_sensitivity"
    | "timeline_risk"
    | "dependency_risk"
    | "commitment_risk"
    | "escalation_candidate";
  severity: "low" | "medium" | "high";
  detail: string;
  evidenceRefs: string[];
};

export type ManagerAttentionFlagsArtifact = {
  artifactId: "manager_attention_flags.json";
  requiresManagerAttention: boolean;
  flags: ManagerAttentionFlag[];
  summary: string;
  evidenceRefs: string[];
  sourceProvenance: Array<Record<string, unknown>>;
  confidence: number;
  openQuestions: string[];
  boundaryNotes: string[];
};

export type NextStepBriefArtifact = {
  artifactId: "next_step_brief.md";
  markdown: string;
  audiences: Array<"operator" | "manager" | "seller_owner">;
  evidenceRefs: string[];
  sourceProvenance: Array<Record<string, unknown>>;
  confidence: number;
  openQuestions: string[];
  boundaryNotes: string[];
  recommendedNextAction: string;
};

export type OpportunityJudgementBundleArtifact = {
  artifactId: "opportunity_judgement_bundle.json";
  artifactList: Array<{
    artifactId: string;
    audience: "operator" | "manager" | "seller_owner" | "system";
    reviewRequired: boolean;
  }>;
  evidenceRefs: string[];
  sourceProvenance: Array<Record<string, unknown>>;
  confidence: number;
  openQuestions: string[];
  riskLevel: "low" | "medium" | "high";
  recommendedNextAction: string;
  reviewStatus:
    | "pending_review"
    | "kept_draft"
    | "approved_for_shadow_consume"
    | "rejected"
    | "blocked_by_boundary"
    | "insufficient_evidence";
  boundaryNotes: string[];
  approvedMeans: string;
  approvedDoesNotMean: string;
  noOfficialWriteback: true;
};

type OpportunityJudgeArtifactsResult = {
  opportunityDelta: OpportunityDeltaArtifact;
  nextStepBrief: NextStepBriefArtifact;
  managerAttentionFlags: ManagerAttentionFlagsArtifact;
  bundle: OpportunityJudgementBundleArtifact;
};

export type OpportunityJudgeRuntimeSummary = {
  latestOpportunityDeltaEvent: {
    id: string;
    status: RuntimeEventStatus;
    createdAt: Date;
    completedAt: Date | null;
    errorMessage: string | null;
  } | null;
  sourceMeetingFactsEvent: {
    id: string;
    status: RuntimeEventStatus;
    createdAt: Date;
    completedAt: Date | null;
  } | null;
  judgeRun: {
    id: string;
    status: WorkerRunStatus;
    confidence: number | null;
    openQuestions: string[];
    evidenceRefs: string[];
  } | null;
  approvalRequest: {
    id: string;
    status: ApprovalRequestStatus;
    approvalTier: string;
    requestedAction: string;
    requestedReason: string | null;
  } | null;
  artifactReview: {
    id: string;
    status: ArtifactReviewStatus;
    reviewedAt: Date | null;
    reviewNotes: string | null;
    decisionSummary: string | null;
  } | null;
  bundle: PersistedArtifact<OpportunityJudgementBundleArtifact> | null;
  opportunityDelta: PersistedArtifact<OpportunityDeltaArtifact> | null;
  nextStepBrief: PersistedArtifact<NextStepBriefArtifact> | null;
  managerAttentionFlags: PersistedArtifact<ManagerAttentionFlagsArtifact> | null;
  editorDraft: {
    deltaJson: string;
    nextStepBriefMarkdown: string;
    reviewNotes: string;
  } | null;
  currentShadow: {
    stage: OpportunityStage | null;
    riskLevel: RiskLevel | null;
    nextAction: string | null;
    blockersSummary: string | null;
    managerAttentionFlag: boolean;
    stageConfidence: number | null;
    updatedAt: Date | null;
    nextStepSummary: string | null;
  } | null;
};

export type OpportunityJudgeEvalCaseResult = {
  id: string;
  label: string;
  passed: boolean;
  failures: string[];
  stageJudgementPass: boolean;
  blockerRankingPass: boolean;
  nextBestActionPass: boolean;
  managerAttentionPass: boolean;
  shadowBoundaryPass: boolean;
  evidenceSufficiencyPass: boolean;
};

type OpportunityJudgeEvaluationResult = {
  stageJudgementPass: boolean;
  blockerRankingPass: boolean;
  nextBestActionPass: boolean;
  managerAttentionPass: boolean;
  shadowBoundaryPass: boolean;
  evidenceSufficiencyPass: boolean;
};

type ReviewEditsInput = {
  deltaJson?: string | null;
  nextStepBriefMarkdown?: string | null;
  reviewNotes?: string | null;
};

const STAGE_RANK: Record<OpportunityStage, number> = {
  NEW: 10,
  CONTACTED: 25,
  ADVANCING: 50,
  WAITING_THEM: 45,
  INTERNAL_SYNC: 40,
  DONE: 100,
  LOST: 0,
};

async function loadOpportunityJudgeMeeting(
  workspaceId: string,
  meetingId: string,
) {
  return db.meeting.findFirst({
    where: {
      workspaceId,
      id: meetingId,
    },
    include: {
      workspace: true,
      company: true,
      opportunity: true,
      contacts: true,
      note: true,
      owner: true,
    },
  });
}

function parseArtifactPayload<T>(artifactsJson: string, fallback: T): T {
  const parsed = safeParseJson<Record<string, unknown>>(artifactsJson, {});
  if ("payload" in parsed) {
    return (parsed.payload as T) ?? fallback;
  }
  return (parsed as T) ?? fallback;
}

function parseBundlePayload<T>(artifactsJson: string, fallback: T): T {
  return safeParseJson<T>(artifactsJson, fallback);
}

function listUniqueStrings(...values: Array<string | null | undefined>) {
  return values
    .flatMap((value) => (value ?? "").split("\n").map((line) => line.trim()))
    .filter(Boolean)
    .filter((value, index, list) => list.indexOf(value) === index);
}

function highestSeverityValue(severity: "low" | "medium" | "high") {
  if (severity === "high") return 3;
  if (severity === "medium") return 2;
  return 1;
}

function deriveRiskLevel(flags: OpportunityRiskFlag[]) {
  if (flags.some((item) => item.severity === "high")) return RiskLevel.HIGH;
  if (flags.some((item) => item.severity === "medium")) return RiskLevel.MEDIUM;
  return RiskLevel.LOW;
}

function deriveBundleRiskLevel(
  flags: OpportunityRiskFlag[],
  managerFlags: ManagerAttentionFlag[],
) {
  if ([...flags, ...managerFlags].some((item) => item.severity === "high"))
    return "high" as const;
  if ([...flags, ...managerFlags].some((item) => item.severity === "medium"))
    return "medium" as const;
  return "low" as const;
}

function resolveOpportunityJudgeStage(input: {
  baseStage: OpportunityStage;
  allTexts: string;
}) {
  if (
    /内部对齐|内部优先级|资源冲突|法务|交付评审|资源协调/.test(input.allTexts)
  ) {
    return OpportunityStage.INTERNAL_SYNC;
  }
  if (
    /等待对方|等待客户|客户内部|采购评估|回去确认/.test(input.allTexts) &&
    !/ROI|联合评审|试点|采购推进窗口/.test(input.allTexts)
  ) {
    return OpportunityStage.WAITING_THEM;
  }
  return input.baseStage;
}

function resolveOpportunityJudgeNextAction(input: {
  allTexts: string;
  fallback: string;
}) {
  if (/ROI/.test(input.allTexts) && /联合评审/.test(input.allTexts)) {
    return "先发送 ROI 跟进内容，并锁定联合评审时间建议。";
  }
  if (/等待对方|等待客户|回去确认|采购评估/.test(input.allTexts)) {
    return "等待对方确认预算与采购优先级，再约下一次会。";
  }
  if (/内部对齐|法务|资源协调|交付评审/.test(input.allTexts)) {
    return "先整理内部阻塞，再决定是否对客户提供时间建议。";
  }
  return input.fallback;
}

function meetingEvidenceRefs(meeting: OpportunityJudgeMeeting) {
  const refs = [`meeting:${meeting.id}`];
  if (meeting.note) refs.push(`meeting-note:${meeting.note.id}`);
  if (meeting.opportunityId) refs.push(`opportunity:${meeting.opportunityId}`);
  if (meeting.companyId) refs.push(`company:${meeting.companyId}`);
  return refs;
}

function buildSourceProvenance(meeting: OpportunityJudgeMeeting) {
  return [
    {
      type: "meeting",
      id: meeting.id,
      trust: "TRUSTED",
    },
    ...(meeting.note
      ? [
          {
            type: "meeting_note",
            id: meeting.note.id,
            trust: "TRUSTED",
          },
        ]
      : []),
    ...(meeting.opportunityId
      ? [
          {
            type: "opportunity",
            id: meeting.opportunityId,
            trust: "SYSTEM_OF_RECORD",
          },
        ]
      : []),
  ];
}

function buildTimelineStrings(
  items: Array<{ summary: string; createdAt: Date }>,
) {
  return items
    .slice(0, 6)
    .map(
      (item) =>
        `${item.createdAt.toISOString()}: ${trimText(item.summary, 80)}`,
    );
}

function deriveChampionStatus(input: {
  facts: MeetingFactsArtifact;
  actionPack: ActionPackBundleContent;
}) {
  const haystack = [
    ...input.facts.facts.map((item) => `${item.title} ${item.content}`),
    ...input.facts.inferred.map((item) => `${item.summary} ${item.rationale}`),
    ...input.facts.ownerMap.map((item) => `${item.owner} ${item.action}`),
    input.actionPack.markdown,
  ].join("\n");

  if (
    /champion 已确认|champion confirmed|赞助人已明确|业务 owner 已明确|预算 owner 已明确/.test(
      haystack,
    )
  ) {
    return "confirmed" as const;
  }
  if (/champion|赞助人|owner|采购 owner|预算 owner/.test(haystack)) {
    return /未确认|缺少|unknown|不明确|待确认/.test(haystack)
      ? ("missing" as const)
      : ("emerging" as const);
  }
  if (/预算未确认|budget owner not confirmed|champion missing/.test(haystack)) {
    return "missing" as const;
  }
  return "unclear" as const;
}

function buildDecisionCriteria(input: {
  facts: MeetingFactsArtifact;
  actionPack: ActionPackBundleContent;
  evidenceRefs: string[];
}) {
  const criteria: OpportunityDecisionCriterion[] = [];

  for (const goal of input.facts.customerGoals.slice(0, 2)) {
    criteria.push({
      label: goal,
      status: "confirmed",
      source: "fact_derived",
      evidenceRefs: input.evidenceRefs,
    });
  }

  if (input.facts.promisesDetected.some((item) => /预算|budget/.test(item))) {
    criteria.push({
      label: "客户预算负责人与采购窗口仍需再次确认",
      status: "open",
      source: "inferred",
      evidenceRefs: input.evidenceRefs,
    });
  }

  for (const question of input.actionPack.openQuestions.slice(0, 2)) {
    criteria.push({
      label: question,
      status: "missing",
      source: "inferred",
      evidenceRefs: input.evidenceRefs,
    });
  }

  if (criteria.length === 0) {
    criteria.push({
      label: "当前还缺少足够的 decision criteria，需要先补充结构化会后确认。",
      status: "missing",
      source: "inferred",
      evidenceRefs: input.evidenceRefs,
    });
  }

  return criteria;
}

function buildBlockers(input: {
  facts: MeetingFactsArtifact;
  riskFlags: RiskFlagsArtifact;
  evidenceRefs: string[];
}) {
  const blockers: OpportunityJudgementBlocker[] = input.facts.blockers.map(
    (item) => ({
      label: item,
      severity: /法务|采购|预算|交付|timeline|时间/.test(item)
        ? "high"
        : "medium",
      source: "fact_derived",
      evidenceRefs: input.evidenceRefs,
    }),
  );

  if (blockers.length === 0 && input.riskFlags.flags.length > 0) {
    blockers.push({
      label:
        input.riskFlags.flags[0]?.reason ??
        "当前判断仍缺少足够阻塞证据。",
      severity: input.riskFlags.flags[0]?.severity ?? "medium",
      source: "inferred",
      evidenceRefs: input.evidenceRefs,
    });
  }

  return blockers.sort(
    (left, right) =>
      highestSeverityValue(right.severity) -
      highestSeverityValue(left.severity),
  );
}

function buildOpportunityRiskFlags(input: {
  riskFlags: RiskFlagsArtifact;
  blockers: OpportunityJudgementBlocker[];
  evidenceRefs: string[];
}) {
  const flags: OpportunityRiskFlag[] = input.riskFlags.flags.map((item) => ({
    label: item.label,
    severity: item.severity,
    reason: item.reason,
    evidenceRefs: item.evidence,
  }));

  if (
    input.blockers.some((item) => /预算|budget/.test(item.label)) &&
    !flags.some((item) => item.label === "budget_uncertainty")
  ) {
    flags.push({
      label: "budget_uncertainty",
      severity: "high",
      reason:
        "预算负责人或采购窗口仍未确认，当前不能把推进判断写成正式承诺。",
      evidenceRefs: input.evidenceRefs,
    });
  }

  if (
    input.blockers.some((item) => /timeline|交付|日期|上线/.test(item.label)) &&
    !flags.some((item) => item.label === "timeline_risk")
  ) {
    flags.push({
      label: "timeline_risk",
      severity: "medium",
      reason: "时间相关阻塞仍未收口，主管关注应继续保持打开。",
      evidenceRefs: input.evidenceRefs,
    });
  }

  return flags.sort(
    (left, right) =>
      highestSeverityValue(right.severity) -
      highestSeverityValue(left.severity),
  );
}

function buildManagerAttentionFlags(input: {
  delta: ReturnType<typeof deriveShadowOpportunityUpdate>;
  decisionCriteria: OpportunityDecisionCriterion[];
  championStatus: OpportunityDeltaArtifact["championStatus"];
  blockers: OpportunityJudgementBlocker[];
  riskFlags: OpportunityRiskFlag[];
  evidenceRefs: string[];
}) {
  const flags: ManagerAttentionFlag[] = [];

  if (
    input.delta.managerAttentionReasons.length > 0 &&
    input.delta.shadowStageConfidence < 78
  ) {
    flags.push({
      key: "stage_ambiguity",
      severity: "medium",
      detail:
        "当前阶段仍带有未决问题，主管应先判断是否允许继续推进阴影阶段。",
      evidenceRefs: input.evidenceRefs,
    });
  }

  if (
    input.championStatus === "missing" ||
    input.championStatus === "unclear"
  ) {
    flags.push({
      key: "missing_champion",
      severity: "high",
      detail: "当前仍缺少明确 champion / 负责人，容易导致推进动作在客户侧失焦。",
      evidenceRefs: input.evidenceRefs,
    });
  }

  if (
    input.decisionCriteria.some(
      (item) => /预算|采购/.test(item.label) && item.status !== "confirmed",
    ) ||
    input.blockers.some((item) => /预算|采购/.test(item.label)) ||
    input.riskFlags.some((item) =>
      /budget|预算|采购/i.test(`${item.label} ${item.reason}`),
    )
  ) {
    flags.push({
      key: "budget_uncertainty",
      severity: "high",
      detail:
        "预算或采购 decision criteria 仍未确认，不适合把当前判断上升成正式承诺。",
      evidenceRefs: input.evidenceRefs,
    });
  }

  if (
    input.riskFlags.some((item) =>
      /price|报价|折扣|pricing/i.test(`${item.label} ${item.reason}`),
    )
  ) {
    flags.push({
      key: "pricing_sensitivity",
      severity: "medium",
      detail:
        "价格 / 折扣敏感项已经出现，需要 主管 复核措辞和让步边界。",
      evidenceRefs: input.evidenceRefs,
    });
  }

  if (
    input.blockers.some((item) =>
      /timeline|时间|交付|日期|窗口/.test(item.label),
    ) ||
    input.delta.shadowStage === OpportunityStage.WAITING_THEM
  ) {
    flags.push({
      key: "timeline_risk",
      severity: "medium",
      detail:
        "timeline / 交付风险已经出现，下一步动作必须保留边界备注。",
      evidenceRefs: input.evidenceRefs,
    });
  }

  if (
    input.blockers.length >= 2 ||
    input.delta.shadowStage === OpportunityStage.INTERNAL_SYNC
  ) {
    flags.push({
      key: "dependency_risk",
      severity: "medium",
      detail: "当前存在多重依赖阻塞，单靠销售负责人跟进可能无法收口。",
      evidenceRefs: input.evidenceRefs,
    });
  }

  if (
    input.riskFlags.some((item) =>
      /promise|交付|承诺/.test(`${item.label} ${item.reason}`),
    )
  ) {
    flags.push({
      key: "commitment_risk",
      severity: "high",
      detail:
        "当前措辞已接近承诺，需要先降回非承诺姿态。",
      evidenceRefs: input.evidenceRefs,
    });
  }

  if (
    input.delta.managerAttentionReasons.length >= 2 ||
    input.riskFlags.some((item) => item.severity === "high") ||
    flags.length >= 3
  ) {
    flags.push({
      key: "escalation_candidate",
      severity: "high",
      detail:
        "这条机会已经具备升级给 主管 /操作员共同复核的必要条件。",
      evidenceRefs: input.evidenceRefs,
    });
  }

  return flags.filter(
    (item, index, list) =>
      list.findIndex((candidate) => candidate.key === item.key) === index,
  );
}

function computeProbabilityDelta(input: {
  stageFrom: OpportunityStage;
  stageTo: OpportunityStage;
  blockers: OpportunityJudgementBlocker[];
  championStatus: OpportunityDeltaArtifact["championStatus"];
  decisionCriteria: OpportunityDecisionCriterion[];
}) {
  let delta = 0;

  if (STAGE_RANK[input.stageTo] > STAGE_RANK[input.stageFrom]) delta += 10;
  if (input.decisionCriteria.some((item) => item.status === "confirmed"))
    delta += 6;
  if (input.blockers.length >= 2) delta -= 10;
  if (input.championStatus === "missing") delta -= 8;
  if (input.championStatus === "confirmed") delta += 5;
  if (input.decisionCriteria.some((item) => item.status === "missing"))
    delta -= 6;

  return Math.max(-25, Math.min(25, delta));
}

function buildNextStepBrief(input: {
  meeting: OpportunityJudgeMeeting;
  deltaArtifact: OpportunityDeltaArtifact;
  managerAttention: ManagerAttentionFlagsArtifact;
}) {
  const managerSummary =
    input.managerAttention.flags.length > 0
      ? input.managerAttention.flags
          .map((item) => item.detail)
          .slice(0, 2)
          .join("；")
      : "当前无需额外 主管 升级，但仍建议保留仅阴影 复核。";

  const ownerName = input.meeting.owner?.name ?? "当前负责人";

  return {
    artifactId: "next_step_brief.md" as const,
    markdown: [
      `# ${input.meeting.opportunity?.title ?? input.meeting.title} next-step brief`,
      "",
      "## 当前判断",
      `- Shadow stage：${input.deltaArtifact.stageShadowFrom} -> ${input.deltaArtifact.stageShadowTo}`,
      `- Probability delta：${input.deltaArtifact.probabilityDelta >= 0 ? "+" : ""}${input.deltaArtifact.probabilityDelta}`,
      `- Champion status：${input.deltaArtifact.championStatus}`,
      "",
      "## 为什么重要",
      `- ${input.deltaArtifact.stageRationale}`,
      "",
      "## 当前卡点",
      ...(input.deltaArtifact.blockers.length > 0
        ? input.deltaArtifact.blockers.map((item) => `- ${item.label}`)
        : ["- 当前没有新增阻塞，但证据仍需继续累积。"]),
      "",
      "## 当前最值得推进的下一步",
      `- ${input.deltaArtifact.nextBestAction}`,
      "",
      "## 操作员 / 管理者 / 销售负责人",
      `- 操作员：先确认阻塞是否需要跨团队解除。`,
      `- 管理者：${managerSummary}`,
      `- 销售负责人：由 ${ownerName} 继续推进，但不得越过正式承诺边界。`,
      "",
      "## 边界",
      `- ${SHADOW_ONLY_BOUNDARY_NOTE}`,
      "- 这份摘要只服务于内部判断和下一步安排，不代表正式 CRM 已更新。",
    ].join("\n"),
    audiences: ["operator", "manager", "seller_owner"] as Array<
      "operator" | "manager" | "seller_owner"
    >,
    evidenceRefs: input.deltaArtifact.evidenceRefs,
    sourceProvenance: input.deltaArtifact.sourceProvenance,
    confidence: input.deltaArtifact.confidence,
    openQuestions: input.deltaArtifact.openQuestions,
    boundaryNotes: input.deltaArtifact.boundaryNotes,
    recommendedNextAction: input.deltaArtifact.nextBestAction,
  };
}

export function buildOpportunityJudgeArtifacts(input: {
  meeting: OpportunityJudgeMeeting;
  meetingFacts: MeetingFactsArtifact;
  riskFlags: RiskFlagsArtifact;
  actionPack: ActionPackBundleContent;
  relevantObjectMemory: string[];
  historicalTimeline: string[];
  evidenceRefs: string[];
  sourceProvenance: Array<Record<string, unknown>>;
}): OpportunityJudgeArtifactsResult {
  if (!input.meeting.opportunity) {
    throw new Error("Opportunity Judge requires a linked opportunity.");
  }

  const baseDelta = deriveShadowOpportunityUpdate({
    opportunity: input.meeting.opportunity,
    factsArtifact: input.meetingFacts,
    riskArtifact: input.riskFlags,
    actionPack: input.actionPack,
  });
  const allTexts = [
    ...input.meetingFacts.decisions,
    ...input.meetingFacts.blockers,
    ...input.meetingFacts.customerGoals,
    ...input.meetingFacts.promisesDetected,
    input.actionPack.markdown,
  ].join("\n");
  const resolvedShadowStage = resolveOpportunityJudgeStage({
    baseStage: baseDelta.shadowStage,
    allTexts,
  });
  const resolvedNextBestAction = resolveOpportunityJudgeNextAction({
    allTexts,
    fallback: baseDelta.shadowNextAction,
  });
  const resolvedDelta = {
    ...baseDelta,
    shadowStage: resolvedShadowStage,
    shadowNextAction: resolvedNextBestAction,
  };

  const stageFrom =
    input.meeting.opportunity.shadowStage ?? input.meeting.opportunity.stage;
  const decisionCriteria = buildDecisionCriteria({
    facts: input.meetingFacts,
    actionPack: input.actionPack,
    evidenceRefs: input.evidenceRefs,
  });
  const championStatus = deriveChampionStatus({
    facts: input.meetingFacts,
    actionPack: input.actionPack,
  });
  const blockers = buildBlockers({
    facts: input.meetingFacts,
    riskFlags: input.riskFlags,
    evidenceRefs: input.evidenceRefs,
  });
  const riskFlags = buildOpportunityRiskFlags({
    riskFlags: input.riskFlags,
    blockers,
    evidenceRefs: input.evidenceRefs,
  });
  const probabilityDelta = computeProbabilityDelta({
    stageFrom,
    stageTo: resolvedDelta.shadowStage,
    blockers,
    championStatus,
    decisionCriteria,
  });

  const factDerived = [
    ...input.meetingFacts.decisions.slice(0, 2),
    ...input.meetingFacts.nextActions.slice(0, 2),
    ...input.meetingFacts.customerGoals.slice(0, 2),
  ].filter(Boolean);

  const inferredAssumptions = [
    ...(resolvedDelta.managerAttentionReasons.length > 0
      ? resolvedDelta.managerAttentionReasons
      : []),
    ...(input.actionPack.openQuestions.length > 0
      ? input.actionPack.openQuestions.slice(0, 2)
      : []),
    ...(input.historicalTimeline.length > 0
      ? [
          `历史 timeline 当前主要指向：${trimText(input.historicalTimeline[0] ?? "", 80)}`,
        ]
      : []),
  ].filter(Boolean);

  const stageRationale = [
    `当前从 ${stageFrom} 判断到 ${resolvedDelta.shadowStage}。`,
    blockers.length > 0
      ? `主要卡点：${blockers
          .slice(0, 2)
          .map((item) => item.label)
          .join("；")}。`
      : "当前卡点仍可控。",
    input.relevantObjectMemory.length > 0
      ? `已复用 object 经营记忆：${trimText(input.relevantObjectMemory[0] ?? "", 56)}。`
      : "当前仍需继续补充 object 经营记忆。",
  ].join(" ");

  const openQuestions = listUniqueStrings(
    ...input.actionPack.openQuestions,
    ...(championStatus === "missing"
      ? ["当前 champion / 负责人仍不明确。"]
      : []),
    ...decisionCriteria
      .filter((item) => item.status !== "confirmed")
      .map((item) => item.label),
  );

  const boundaryNotes = [
    SHADOW_ONLY_BOUNDARY_NOTE,
    SHADOW_APPROVAL_NOTE,
    "主管关注只是注意力提示，不是最终决策。",
    ...(riskFlags.some((item) =>
      /price|pricing|交付|日期|contract|承诺/i.test(
        `${item.label} ${item.reason}`,
      ),
    )
      ? [
          "当前仍处在正式承诺边界之内，任何交付日期、价格或合同相关判断都不能上升为正式承诺。",
        ]
      : []),
  ];

  const deltaArtifact: OpportunityDeltaArtifact = {
    artifactId: "opportunity_delta.json",
    stageShadowFrom: stageFrom,
    stageShadowTo: resolvedDelta.shadowStage,
    probabilityDelta,
    decisionCriteria,
    championStatus,
    blockers,
    riskFlags,
    nextBestAction: resolvedDelta.shadowNextAction,
    managerAttentionRequired: resolvedDelta.shadowManagerAttentionFlag,
    factDerived,
    inferredAssumptions,
    suggestionFields: [
      "stageShadowTo",
      "nextBestAction",
      "managerAttentionRequired",
    ],
    stageRationale,
    evidenceRefs: input.evidenceRefs,
    sourceProvenance: input.sourceProvenance,
    confidence: resolvedDelta.shadowStageConfidence,
    openQuestions,
    boundaryNotes,
    recommendedNextAction: resolvedDelta.shadowNextAction,
    noOfficialWriteback: true,
  };

  const managerFlags = buildManagerAttentionFlags({
    delta: resolvedDelta,
    decisionCriteria,
    championStatus,
    blockers,
    riskFlags,
    evidenceRefs: input.evidenceRefs,
  });

  const managerAttention: ManagerAttentionFlagsArtifact = {
    artifactId: "manager_attention_flags.json",
    requiresManagerAttention: managerFlags.length > 0,
    flags: managerFlags,
    summary:
      managerFlags.length > 0
        ? managerFlags
            .map((item) => item.detail)
            .slice(0, 3)
            .join("；")
        : "当前没有新增 主管关注 标记，但仍建议保留仅阴影 复核。",
    evidenceRefs: input.evidenceRefs,
    sourceProvenance: input.sourceProvenance,
    confidence: deltaArtifact.confidence,
    openQuestions,
    boundaryNotes,
  };

  const nextStepBrief = buildNextStepBrief({
    meeting: input.meeting,
    deltaArtifact,
    managerAttention,
  });

  const bundle: OpportunityJudgementBundleArtifact = {
    artifactId: "opportunity_judgement_bundle.json",
    artifactList: [
      {
        artifactId: "opportunity_delta.json",
        audience: "system",
        reviewRequired: true,
      },
      {
        artifactId: "next_step_brief.md",
        audience: "manager",
        reviewRequired: true,
      },
      {
        artifactId: "manager_attention_flags.json",
        audience: "manager",
        reviewRequired: true,
      },
    ],
    evidenceRefs: input.evidenceRefs,
    sourceProvenance: input.sourceProvenance,
    confidence: Math.round(
      (deltaArtifact.confidence +
        nextStepBrief.confidence +
        managerAttention.confidence) /
        3,
    ),
    openQuestions,
    riskLevel: deriveBundleRiskLevel(riskFlags, managerFlags),
    recommendedNextAction: deltaArtifact.nextBestAction,
    reviewStatus: "pending_review",
    boundaryNotes,
    approvedMeans:
      "approved 只表示允许把判断 消费进阴影摘要，并供后续 展示面 / 时间线 / 检查点使用。",
    approvedDoesNotMean: SHADOW_APPROVED_DOES_NOT_MEAN_NOTE,
    noOfficialWriteback: true,
  };

  return {
    opportunityDelta: deltaArtifact,
    nextStepBrief,
    managerAttentionFlags: managerAttention,
    bundle,
  };
}

async function loadConfirmedMeetingSource(
  workspaceId: string,
  meetingId: string,
  sourceMeetingFactsEventId?: string | null,
) {
  const meeting = await loadOpportunityJudgeMeeting(workspaceId, meetingId);
  if (!meeting?.opportunity || !meeting.note) {
    throw new Error(
      "Opportunity Judge requires a meeting with note and linked opportunity.",
    );
  }

  const actionPackBundle = await db.artifactBundle.findFirst({
    where: {
      workspaceId,
      meetingId,
      artifactType: "action_pack.md",
    },
    orderBy: { createdAt: "desc" },
    include: {
      artifactReview: true,
    },
  });

  if (
    !actionPackBundle?.runtimeEventId ||
    actionPackBundle.artifactReview?.status !== ArtifactReviewStatus.CONFIRMED
  ) {
    throw new Error(
      "Meeting facts must be human-confirmed before Opportunity Judge can run.",
    );
  }

  const [
    factsBundle,
    riskBundle,
    promotedMemory,
    timelineEntries,
    meetingFactsEvent,
  ] = await Promise.all([
    db.artifactBundle.findFirst({
      where: {
        workspaceId,
        runtimeEventId: actionPackBundle.runtimeEventId,
        artifactType: "meeting_facts.json",
      },
      orderBy: { createdAt: "desc" },
    }),
    db.artifactBundle.findFirst({
      where: {
        workspaceId,
        runtimeEventId: actionPackBundle.runtimeEventId,
        artifactType: "risk_flags.json",
      },
      orderBy: { createdAt: "desc" },
    }),
    db.memoryItem.findMany({
      where: {
        workspaceId,
        status: MemoryItemStatus.PROMOTED,
        OR: [
          { meetingId },
          { opportunityId: meeting.opportunityId ?? undefined },
          { companyId: meeting.companyId ?? undefined },
        ],
      },
      orderBy: [{ promotedAt: "desc" }, { createdAt: "desc" }],
      take: 10,
    }),
    db.auditLog.findMany({
      where: {
        workspaceId,
        OR: [
          { targetId: meeting.opportunityId ?? undefined },
          { relatedObjectId: meeting.opportunityId ?? undefined },
          { targetId: meetingId },
        ],
      },
      orderBy: { createdAt: "desc" },
      select: {
        summary: true,
        createdAt: true,
      },
      take: 6,
    }),
    sourceMeetingFactsEventId
      ? db.runtimeEvent.findUnique({
          where: { id: sourceMeetingFactsEventId },
        })
      : db.runtimeEvent.findFirst({
          where: {
            workspaceId,
            meetingId,
            eventType: "meeting.facts_created",
          },
          orderBy: { createdAt: "desc" },
        }),
  ]);

  if (!factsBundle || !riskBundle) {
    throw new Error("Confirmed meeting facts artifacts are incomplete.");
  }

  return {
    meeting,
    meetingFacts: parseArtifactPayload<MeetingFactsArtifact>(
      factsBundle.artifactsJson,
      {
        attendees: [],
        agenda: [],
        facts: [],
        inferred: [],
        decisions: [],
        blockers: [],
        customerGoals: [],
        promisesDetected: [],
        nextActions: [],
        ownerMap: [],
        followupDeadlines: [],
      },
    ),
    riskFlags: parseArtifactPayload<RiskFlagsArtifact>(
      riskBundle.artifactsJson,
      {
        flags: [],
        boundaryNotes: [],
        requiresPromiseGuardReview: false,
      },
    ),
    actionPack: parseBundlePayload<ActionPackBundleContent>(
      actionPackBundle.artifactsJson,
      {
        artifactId: "action_pack.md",
        markdown: "",
        boundary: "",
        recommendedNextAction: "",
        openQuestions: [],
      },
    ),
    promotedMemory: promotedMemory.map((item) => ({
      id: item.id,
      summary: item.summary,
      verification: item.verification,
      status: item.status,
      meetingId: item.meetingId,
      opportunityId: item.opportunityId,
      companyId: item.companyId,
    })),
    timelineEntries: buildTimelineStrings(timelineEntries),
    evidenceRefs: meetingEvidenceRefs(meeting),
    sourceProvenance: buildSourceProvenance(meeting),
    meetingFactsEventId: meetingFactsEvent?.id ?? null,
  } satisfies OpportunityJudgeSource;
}

async function persistOpportunityJudgeArtifacts(input: {
  workspaceId: string;
  runtimeEventId: string;
  workerRunId: string;
  source: OpportunityJudgeSource;
  artifacts: OpportunityJudgeArtifactsResult;
}) {
  const common = {
    workspaceId: input.workspaceId,
    runtimeEventId: input.runtimeEventId,
    workerRunId: input.workerRunId,
    meetingId: input.source.meeting.id,
    opportunityId: input.source.meeting.opportunityId ?? undefined,
    companyId: input.source.meeting.companyId ?? undefined,
    evidenceRefs: jsonStringify(input.artifacts.bundle.evidenceRefs),
    sourceProvenance: jsonStringify(input.artifacts.bundle.sourceProvenance),
    confidence: input.artifacts.bundle.confidence,
    openQuestions: jsonStringify(input.artifacts.bundle.openQuestions),
  };

  const deltaBundle = await db.artifactBundle.create({
    data: {
      ...common,
      artifactType: "opportunity_delta.json",
      title: `${input.source.meeting.opportunity?.title ?? input.source.meeting.title} opportunity delta`,
      summary:
        "机会判断已生成阶段 / 阻塞 / 下一步最佳动作的阴影差异，但仍需单独复核。",
      approvalTier: resolveApprovalRule("opportunity.shadow_update").tier,
      reviewPosture: "requires_shadow_review",
      artifactsJson: jsonStringify(input.artifacts.opportunityDelta),
    },
  });

  const briefBundle = await db.artifactBundle.create({
    data: {
      ...common,
      artifactType: "next_step_brief.md",
      title: `${input.source.meeting.opportunity?.title ?? input.source.meeting.title} next-step brief`,
      summary:
        "下一步摘要 已生成，面向操作员/ 主管 / 销售负责人，仍保持仅内部姿态。",
      approvalTier: resolveApprovalRule("opportunity.shadow_update").tier,
      reviewPosture: "requires_shadow_review",
      artifactsJson: jsonStringify(input.artifacts.nextStepBrief),
    },
  });

  const flagsBundle = await db.artifactBundle.create({
    data: {
      ...common,
      artifactType: "manager_attention_flags.json",
      title: `${input.source.meeting.opportunity?.title ?? input.source.meeting.title} manager attention flags`,
      summary:
        "主管关注标记已生成，但关注仍不等于最终决策。",
      approvalTier: resolveApprovalRule("opportunity.shadow_update").tier,
      reviewPosture: "requires_shadow_review",
      artifactsJson: jsonStringify(input.artifacts.managerAttentionFlags),
    },
  });

  const bundle = await db.artifactBundle.create({
    data: {
      ...common,
      artifactType: "opportunity_judgement_bundle.json",
      title: `${input.source.meeting.opportunity?.title ?? input.source.meeting.title} opportunity judgement bundle`,
      summary:
        "机会判断套件 已就绪：stage差异、主管关注和下一步摘要 已进入独立复核。",
      approvalTier: resolveApprovalRule("opportunity.shadow_update").tier,
      reviewPosture: "requires_shadow_review",
      artifactsJson: jsonStringify(input.artifacts.bundle),
    },
  });

  const approvalRequest = await db.approvalRequest.create({
    data: {
      workspaceId: input.workspaceId,
      runtimeEventId: input.runtimeEventId,
      workerRunId: input.workerRunId,
      artifactBundleId: bundle.id,
      requestedAction: "opportunity-judgement.review",
      approvalTier: resolveApprovalRule("opportunity.shadow_update").tier,
      status: ApprovalRequestStatus.PENDING,
      requestedBy: OPPORTUNITY_JUDGE_AGENT,
      requestedReason:
        "Shadow delta, blockers, next-step brief and manager attention must be reviewed before any shadow consume.",
    },
  });

  const artifactReview = await db.artifactReview.create({
    data: {
      workspaceId: input.workspaceId,
      runtimeEventId: input.runtimeEventId,
      artifactBundleId: bundle.id,
      approvalRequestId: approvalRequest.id,
      status: ArtifactReviewStatus.PENDING,
      editedPayload: jsonStringify({
        deltaJson: jsonStringify(input.artifacts.opportunityDelta),
        nextStepBriefMarkdown: input.artifacts.nextStepBrief.markdown,
      }),
    },
  });

  return {
    deltaBundle,
    briefBundle,
    flagsBundle,
    bundle,
    approvalRequest,
    artifactReview,
  };
}

export async function runOpportunityJudgeRuntime(input: {
  workspaceId: string;
  meetingId: string;
  actorName: string;
  actorUserId?: string | null;
  sourcePage?: string;
  force?: boolean;
  sourceMeetingFactsEventId?: string | null;
}) {
  const source = await loadConfirmedMeetingSource(
    input.workspaceId,
    input.meetingId,
    input.sourceMeetingFactsEventId,
  );
  const english = source.meeting.workspace.defaultLocale === "en-US";

  await ensureWorkspaceProcessingAllowed({
    workspaceId: input.workspaceId,
    english,
    operation: "RECOMMENDATION_GENERATION",
  });

  const latestExistingBundle = await db.artifactBundle.findFirst({
    where: {
      workspaceId: input.workspaceId,
      meetingId: input.meetingId,
      artifactType: "opportunity_judgement_bundle.json",
    },
    include: {
      runtimeEvent: true,
      artifactReview: true,
    },
    orderBy: { createdAt: "desc" },
  });

  if (
    latestExistingBundle &&
    !input.force &&
    latestExistingBundle.runtimeEvent?.status ===
      RuntimeEventStatus.COMPLETED &&
    latestExistingBundle.artifactReview?.status !==
      ArtifactReviewStatus.REJECTED
  ) {
    return {
      reused: true,
      runtimeEventId: latestExistingBundle.runtimeEventId,
      artifactBundleId: latestExistingBundle.id,
    };
  }

  const trustedContext = jsonStringify({
    workspaceSummary:
      source.meeting.workspace.description ?? DEFAULT_WORKSPACE_SUMMARY,
    meetingTitle: source.meeting.title,
    opportunityTitle: source.meeting.opportunity?.title ?? null,
    currentShadowStage:
      source.meeting.opportunity?.shadowStage ??
      source.meeting.opportunity?.stage ??
      null,
    promotedMemory: source.promotedMemory.map((item) => item.summary),
  });

  const runtimeEvent = await db.runtimeEvent.create({
    data: {
      workspaceId: input.workspaceId,
      meetingId: input.meetingId,
      opportunityId: source.meeting.opportunityId ?? undefined,
      companyId: source.meeting.companyId ?? undefined,
      relatedObjectType: "Opportunity",
      relatedObjectId: source.meeting.opportunityId ?? undefined,
      eventType: "opportunity.delta_created",
      status: RuntimeEventStatus.RUNNING,
      trustedContext,
      untrustedContext: jsonStringify({
        sourceMeetingFactsEventId: source.meetingFactsEventId,
      }),
      payload: jsonStringify({
        sourceMeetingFactsEventId: source.meetingFactsEventId,
        meetingId: input.meetingId,
      }),
      sourceProvenance: jsonStringify(source.sourceProvenance),
      triggeredBy: input.actorUserId ? "human" : "system",
      startedAt: new Date(),
    },
  });

  try {
    const workerRun = await db.workerRun.create({
      data: {
        workspaceId: input.workspaceId,
        runtimeEventId: runtimeEvent.id,
        meetingId: source.meeting.id,
        opportunityId: source.meeting.opportunityId ?? undefined,
        companyId: source.meeting.companyId ?? undefined,
        agentId: OPPORTUNITY_JUDGE_AGENT,
        status: WorkerRunStatus.RUNNING,
        inputSummary:
          "Consume confirmed meeting facts and derive a reviewable opportunity shadow delta.",
        startedAt: new Date(),
      },
    });

    const memoryContext = buildMeetingRuntimeMemoryContext({
      workspaceSummary:
        source.meeting.workspace.description ?? DEFAULT_WORKSPACE_SUMMARY,
      meetingTitle: source.meeting.title,
      opportunityTitle: source.meeting.opportunity?.title ?? null,
      memoryItems: source.promotedMemory.map((item) => ({
        summary: item.summary,
        status: item.status as MemoryItemStatus,
        verification: item.verification as MemoryItemVerification,
        meetingId: item.meetingId,
        opportunityId: item.opportunityId,
        companyId: item.companyId,
      })),
    });

    const artifacts = buildOpportunityJudgeArtifacts({
      meeting: source.meeting,
      meetingFacts: source.meetingFacts,
      riskFlags: source.riskFlags,
      actionPack: source.actionPack,
      relevantObjectMemory: memoryContext,
      historicalTimeline: source.timelineEntries,
      evidenceRefs: source.evidenceRefs,
      sourceProvenance: source.sourceProvenance,
    });

    const persisted = await persistOpportunityJudgeArtifacts({
      workspaceId: input.workspaceId,
      runtimeEventId: runtimeEvent.id,
      workerRunId: workerRun.id,
      source,
      artifacts,
    });

    await db.workerRun.update({
      where: { id: workerRun.id },
      data: {
        status: WorkerRunStatus.COMPLETED,
        confidence: artifacts.bundle.confidence,
        outputSummary: `Proposed shadow stage ${artifacts.opportunityDelta.stageShadowTo}, next action ${artifacts.opportunityDelta.nextBestAction}`,
        evidenceRefs: jsonStringify(artifacts.bundle.evidenceRefs),
        sourceProvenance: jsonStringify(artifacts.bundle.sourceProvenance),
        openQuestions: jsonStringify(artifacts.bundle.openQuestions),
        completedAt: new Date(),
      },
    });

    await db.runtimeEvent.update({
      where: { id: runtimeEvent.id },
      data: {
        status: RuntimeEventStatus.COMPLETED,
        completedAt: new Date(),
      },
    });

    await writeAuditLog({
      workspaceId: input.workspaceId,
      userId: input.actorUserId ?? undefined,
      actor: input.actorName,
      actorType: input.actorUserId ? ActorType.USER : ActorType.SYSTEM,
      actionType: "HELM_V2_OPPORTUNITY_JUDGEMENT_CREATED",
      targetType: "Opportunity",
      targetId: source.meeting.opportunityId ?? input.meetingId,
      summary: `Opportunity Judge prepared a reviewable shadow delta for ${source.meeting.opportunity?.title ?? source.meeting.title}.`,
      payload: {
        runtimeEventId: runtimeEvent.id,
        artifactBundleId: persisted.bundle.id,
        recommendedNextAction: artifacts.bundle.recommendedNextAction,
        boundary: SHADOW_ONLY_BOUNDARY_NOTE,
      },
      sourcePage: input.sourcePage ?? `/meetings/${input.meetingId}`,
      relatedObjectType: "Meeting",
      relatedObjectId: input.meetingId,
    });

    await recordUsageLedgerEntry({
      workspaceId: input.workspaceId,
      userId: input.actorUserId ?? undefined,
      usageType: UsageType.RECOMMENDATION_GENERATION,
      sourcePage: input.sourcePage ?? `/meetings/${input.meetingId}`,
      metadata: {
        meetingId: input.meetingId,
        operation: "opportunity_judge_runtime",
      },
    });

    return {
      reused: false,
      runtimeEventId: runtimeEvent.id,
      artifactBundleId: persisted.bundle.id,
    };
  } catch (error) {
    await db.runtimeEvent.update({
      where: { id: runtimeEvent.id },
      data: {
        status: RuntimeEventStatus.FAILED,
        errorMessage:
          error instanceof Error
            ? error.message
            : "Opportunity Judge runtime failed",
        failedAt: new Date(),
      },
    });
    throw error;
  }
}

function mapReviewModeToBundleStatus(
  mode: OpportunityJudgeReviewMode,
): OpportunityJudgementBundleArtifact["reviewStatus"] {
  if (mode === "confirm" || mode === "edit_confirm")
    return "approved_for_shadow_consume";
  if (mode === "keep_draft") return "kept_draft";
  if (mode === "block_boundary") return "blocked_by_boundary";
  if (mode === "insufficient_evidence") return "insufficient_evidence";
  return "rejected";
}

function mapReviewModeToArtifactStatus(mode: OpportunityJudgeReviewMode) {
  if (mode === "confirm" || mode === "edit_confirm")
    return ArtifactBundleStatus.CONFIRMED;
  if (mode === "reject" || mode === "block_boundary")
    return ArtifactBundleStatus.REJECTED;
  return ArtifactBundleStatus.REVIEWED;
}

async function updateReviewableBundles(input: {
  runtimeEventId: string;
  reviewedAt: Date;
  mode: OpportunityJudgeReviewMode;
  opportunityDelta: OpportunityDeltaArtifact;
  nextStepBrief: NextStepBriefArtifact;
}) {
  const bundles = await db.artifactBundle.findMany({
    where: {
      runtimeEventId: input.runtimeEventId,
      artifactType: {
        in: [
          "opportunity_delta.json",
          "next_step_brief.md",
          "manager_attention_flags.json",
          "opportunity_judgement_bundle.json",
        ],
      },
    },
  });

  for (const bundle of bundles) {
    const status = mapReviewModeToArtifactStatus(input.mode);
    let artifactsJson = bundle.artifactsJson;

    if (bundle.artifactType === "opportunity_delta.json") {
      artifactsJson = jsonStringify(input.opportunityDelta);
    }
    if (bundle.artifactType === "next_step_brief.md") {
      artifactsJson = jsonStringify(input.nextStepBrief);
    }
    if (bundle.artifactType === "opportunity_judgement_bundle.json") {
      const existing = parseBundlePayload<OpportunityJudgementBundleArtifact>(
        bundle.artifactsJson,
        {
          artifactId: "opportunity_judgement_bundle.json",
          artifactList: [],
          evidenceRefs: [],
          sourceProvenance: [],
          confidence: 0,
          openQuestions: [],
          riskLevel: "low",
          recommendedNextAction: "",
          reviewStatus: "pending_review",
          boundaryNotes: [],
          approvedMeans: "",
          approvedDoesNotMean: "",
          noOfficialWriteback: true,
        },
      );

      artifactsJson = jsonStringify({
        ...existing,
        reviewStatus: mapReviewModeToBundleStatus(input.mode),
        recommendedNextAction: input.opportunityDelta.nextBestAction,
        openQuestions: input.opportunityDelta.openQuestions,
        boundaryNotes:
          input.mode === "insufficient_evidence"
            ? [...existing.boundaryNotes, INSUFFICIENT_EVIDENCE_NOTE]
            : existing.boundaryNotes,
      } satisfies OpportunityJudgementBundleArtifact);
    }

    await db.artifactBundle.update({
      where: { id: bundle.id },
      data: {
        status,
        reviewedAt: input.reviewedAt,
        confirmedAt:
          input.mode === "confirm" || input.mode === "edit_confirm"
            ? input.reviewedAt
            : bundle.confirmedAt,
        reviewPosture:
          input.mode === "confirm" || input.mode === "edit_confirm"
            ? "confirmed_for_shadow_consume"
            : input.mode === "block_boundary"
              ? "blocked_by_boundary"
              : input.mode === "insufficient_evidence"
                ? "insufficient_evidence"
                : input.mode === "keep_draft"
                  ? "kept_as_draft"
                  : "rejected_by_human",
        artifactsJson,
      },
    });
  }
}

async function consumeReviewedOpportunityJudgement(input: {
  workspaceId: string;
  meetingId: string;
  reviewerId: string;
  reviewerName: string;
  sourcePage?: string;
  opportunityDeltaBundleId: string;
  bundleArtifactId: string;
  opportunityDelta: OpportunityDeltaArtifact;
  nextStepBrief: NextStepBriefArtifact;
  managerAttentionFlags: ManagerAttentionFlagsArtifact;
  meeting: OpportunityJudgeMeeting;
}) {
  const now = new Date();
  const riskLevel = deriveRiskLevel(input.opportunityDelta.riskFlags);
  const blockerSummary =
    input.opportunityDelta.blockers.length > 0
      ? input.opportunityDelta.blockers
          .map((item) => item.label)
          .slice(0, 3)
          .join("；")
      : "当前没有新增阻塞，但仍需继续收集证据。";

  const managerAttentionSummary =
    input.managerAttentionFlags.flags.length > 0
      ? input.managerAttentionFlags.flags
          .map((item) => item.detail)
          .slice(0, 2)
          .join("；")
      : "当前没有新增 主管 升级信号。";

  await db.opportunity.update({
    where: { id: input.meeting.opportunityId ?? undefined },
    data: {
      shadowStage: input.opportunityDelta.stageShadowTo,
      shadowRiskLevel: riskLevel,
      shadowNextAction: input.opportunityDelta.nextBestAction,
      shadowBlockersSummary: blockerSummary,
      shadowManagerAttentionFlag:
        input.opportunityDelta.managerAttentionRequired,
      shadowStageConfidence: input.opportunityDelta.confidence,
      shadowUpdatedAt: now,
      nextStepSummary: `当前判断：${input.opportunityDelta.stageRationale} 下一步：${input.opportunityDelta.nextBestAction}。主管关注：${managerAttentionSummary}`,
      lastProgressAt: now,
    },
  });

  await db.memoryItem.create({
    data: {
      workspaceId: input.workspaceId,
      artifactBundleId: input.opportunityDeltaBundleId,
      meetingId: input.meetingId,
      opportunityId: input.meeting.opportunityId ?? undefined,
      companyId: input.meeting.companyId ?? undefined,
      objectType: "OPPORTUNITY",
      objectId: input.meeting.opportunityId ?? undefined,
      kind: MemoryItemKind.CHECKPOINT,
      scope: MemoryItemScope.OBJECT,
      namespace: "opportunity",
      status: MemoryItemStatus.PROMOTED,
      verification: MemoryItemVerification.HUMAN_CONFIRMED,
      sensitivity: MemoryItemSensitivity.INTERNAL,
      retention: MemoryItemRetention.DAYS_30,
      promotionRule: MemoryItemPromotionRule.HUMAN_CONFIRMED,
      writer: OPPORTUNITY_JUDGE_AGENT,
      summary: input.opportunityDelta.nextBestAction,
      payload: jsonStringify({
        shadowStage: input.opportunityDelta.stageShadowTo,
        stageRationale: input.opportunityDelta.stageRationale,
        managerAttentionSummary,
        decisionCriteria: input.opportunityDelta.decisionCriteria,
        boundary: SHADOW_ONLY_BOUNDARY_NOTE,
      }),
      sourceProvenance: jsonStringify(input.opportunityDelta.sourceProvenance),
      evidenceRefs: jsonStringify(input.opportunityDelta.evidenceRefs),
      confidence: input.opportunityDelta.confidence,
      confirmedAt: now,
      promotedAt: now,
      lastValidatedAt: now,
    },
  });

  await db.artifactBundle.updateMany({
    where: {
      id: {
        in: [input.opportunityDeltaBundleId, input.bundleArtifactId],
      },
    },
    data: {
      status: ArtifactBundleStatus.CONSUMED,
      consumedAt: now,
      reviewPosture: "consumed_into_shadow_summary",
    },
  });

  await db.artifactBundle.updateMany({
    where: {
      workspaceId: input.workspaceId,
      meetingId: input.meetingId,
      artifactType: {
        in: ["next_step_brief.md", "manager_attention_flags.json"],
      },
    },
    data: {
      status: ArtifactBundleStatus.CONSUMED,
      consumedAt: now,
      reviewPosture: "consumed_into_shadow_summary",
    },
  });

  await writeAuditLog({
    workspaceId: input.workspaceId,
    userId: input.reviewerId,
    actor: input.reviewerName,
    actorType: ActorType.USER,
    actionType: "HELM_V2_OPPORTUNITY_JUDGEMENT_CONSUMED",
    targetType: "Opportunity",
    targetId: input.meeting.opportunityId ?? input.meetingId,
    summary: `Opportunity judgement for ${input.meeting.opportunity?.title ?? input.meeting.title} was confirmed into shadow summary only.`,
    payload: {
      nextBestAction: input.opportunityDelta.nextBestAction,
      managerAttentionSummary,
      boundary: SHADOW_ONLY_BOUNDARY_NOTE,
    },
    sourcePage: input.sourcePage ?? `/meetings/${input.meetingId}`,
    relatedObjectType: "Meeting",
    relatedObjectId: input.meetingId,
  });
}

export async function reviewOpportunityJudgeRuntime(input: {
  workspaceId: string;
  meetingId: string;
  reviewerId: string;
  reviewerName: string;
  mode: OpportunityJudgeReviewMode;
  edits?: ReviewEditsInput;
  sourcePage?: string;
}) {
  const meeting = await loadOpportunityJudgeMeeting(
    input.workspaceId,
    input.meetingId,
  );
  if (!meeting?.opportunity) {
    throw new Error(
      "Opportunity judgement review requires a meeting linked to an opportunity.",
    );
  }

  const bundleArtifact = await db.artifactBundle.findFirst({
    where: {
      workspaceId: input.workspaceId,
      meetingId: input.meetingId,
      artifactType: "opportunity_judgement_bundle.json",
    },
    orderBy: { createdAt: "desc" },
    include: {
      artifactReview: true,
      approvalRequest: true,
    },
  });

  if (!bundleArtifact?.artifactReview?.id) {
    throw new Error(
      "No opportunity judgement review was found for this meeting.",
    );
  }

  const [deltaBundle, briefBundle, flagsBundle] = await Promise.all([
    db.artifactBundle.findFirst({
      where: {
        workspaceId: input.workspaceId,
        runtimeEventId: bundleArtifact.runtimeEventId ?? undefined,
        artifactType: "opportunity_delta.json",
      },
      orderBy: { createdAt: "desc" },
    }),
    db.artifactBundle.findFirst({
      where: {
        workspaceId: input.workspaceId,
        runtimeEventId: bundleArtifact.runtimeEventId ?? undefined,
        artifactType: "next_step_brief.md",
      },
      orderBy: { createdAt: "desc" },
    }),
    db.artifactBundle.findFirst({
      where: {
        workspaceId: input.workspaceId,
        runtimeEventId: bundleArtifact.runtimeEventId ?? undefined,
        artifactType: "manager_attention_flags.json",
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!deltaBundle || !briefBundle || !flagsBundle) {
    throw new Error(
      "Opportunity judgement artifacts are incomplete and cannot be reviewed yet.",
    );
  }

  const currentDelta = parseBundlePayload<OpportunityDeltaArtifact>(
    deltaBundle.artifactsJson,
    {
      artifactId: "opportunity_delta.json",
      stageShadowFrom:
        meeting.opportunity.shadowStage ?? meeting.opportunity.stage,
      stageShadowTo:
        meeting.opportunity.shadowStage ?? meeting.opportunity.stage,
      probabilityDelta: 0,
      decisionCriteria: [],
      championStatus: "unclear",
      blockers: [],
      riskFlags: [],
      nextBestAction:
        meeting.opportunity.shadowNextAction ??
        meeting.opportunity.nextAction ??
        "先补足证据，再决定下一步。",
      managerAttentionRequired: false,
      factDerived: [],
      inferredAssumptions: [],
      suggestionFields: [],
      stageRationale: "",
      evidenceRefs: [],
      sourceProvenance: [],
      confidence: 0,
      openQuestions: [],
      boundaryNotes: [SHADOW_ONLY_BOUNDARY_NOTE],
      recommendedNextAction: "",
      noOfficialWriteback: true,
    },
  );
  const currentBrief = parseBundlePayload<NextStepBriefArtifact>(
    briefBundle.artifactsJson,
    {
      artifactId: "next_step_brief.md",
      markdown: "",
      audiences: ["operator", "manager", "seller_owner"],
      evidenceRefs: [],
      sourceProvenance: [],
      confidence: 0,
      openQuestions: [],
      boundaryNotes: [SHADOW_ONLY_BOUNDARY_NOTE],
      recommendedNextAction: "",
    },
  );
  const currentFlags = parseBundlePayload<ManagerAttentionFlagsArtifact>(
    flagsBundle.artifactsJson,
    {
      artifactId: "manager_attention_flags.json",
      requiresManagerAttention: false,
      flags: [],
      summary: "",
      evidenceRefs: [],
      sourceProvenance: [],
      confidence: 0,
      openQuestions: [],
      boundaryNotes: [SHADOW_ONLY_BOUNDARY_NOTE],
    },
  );

  const editedDelta = safeParseJson<Partial<OpportunityDeltaArtifact>>(
    input.edits?.deltaJson,
    {},
  );
  const nextDelta: OpportunityDeltaArtifact =
    input.mode === "edit_confirm"
      ? {
          ...currentDelta,
          ...editedDelta,
          decisionCriteria:
            editedDelta.decisionCriteria ?? currentDelta.decisionCriteria,
          blockers: editedDelta.blockers ?? currentDelta.blockers,
          riskFlags: editedDelta.riskFlags ?? currentDelta.riskFlags,
          boundaryNotes:
            editedDelta.boundaryNotes ?? currentDelta.boundaryNotes,
          sourceProvenance:
            editedDelta.sourceProvenance ?? currentDelta.sourceProvenance,
          evidenceRefs: editedDelta.evidenceRefs ?? currentDelta.evidenceRefs,
          openQuestions:
            editedDelta.openQuestions ?? currentDelta.openQuestions,
          noOfficialWriteback: true as const,
        }
      : currentDelta;
  const nextBrief =
    input.mode === "edit_confirm" && input.edits?.nextStepBriefMarkdown
      ? {
          ...currentBrief,
          markdown: input.edits.nextStepBriefMarkdown,
          recommendedNextAction: nextDelta.nextBestAction,
          boundaryNotes: nextDelta.boundaryNotes,
        }
      : currentBrief;

  const reviewedAt = new Date();
  const reviewStatus =
    input.mode === "confirm" || input.mode === "edit_confirm"
      ? ArtifactReviewStatus.CONFIRMED
      : input.mode === "reject" || input.mode === "block_boundary"
        ? ArtifactReviewStatus.REJECTED
        : ArtifactReviewStatus.KEPT_DRAFT;

  await db.artifactReview.update({
    where: { id: bundleArtifact.artifactReview.id },
    data: {
      status: reviewStatus,
      reviewedByUserId: input.reviewerId,
      reviewNotes: input.edits?.reviewNotes ?? null,
      editedPayload: jsonStringify({
        deltaJson: jsonStringify(nextDelta),
        nextStepBriefMarkdown: nextBrief.markdown,
      }),
      decisionSummary:
        input.mode === "block_boundary"
          ? "Blocked by boundary"
          : input.mode === "insufficient_evidence"
            ? "Kept as draft due to insufficient evidence"
            : input.mode === "reject"
              ? "Opportunity judgement rejected"
              : input.mode === "keep_draft"
                ? "Opportunity judgement kept as draft"
                : "Opportunity judgement confirmed for shadow consume",
      reviewedAt,
    },
  });

  if (
    bundleArtifact.approvalRequest &&
    (input.mode === "confirm" ||
      input.mode === "edit_confirm" ||
      input.mode === "reject" ||
      input.mode === "block_boundary")
  ) {
    await db.approvalRequest.update({
      where: { id: bundleArtifact.approvalRequest.id },
      data: {
        status:
          input.mode === "confirm" || input.mode === "edit_confirm"
            ? ApprovalRequestStatus.APPROVED
            : ApprovalRequestStatus.REJECTED,
        resolvedByUserId: input.reviewerId,
        resolutionNotes: input.edits?.reviewNotes ?? null,
        resolvedAt: reviewedAt,
      },
    });
  }

  await updateReviewableBundles({
    runtimeEventId: bundleArtifact.runtimeEventId ?? "",
    reviewedAt,
    mode: input.mode,
    opportunityDelta: nextDelta,
    nextStepBrief: nextBrief,
  });

  const auditAction =
    input.mode === "confirm" || input.mode === "edit_confirm"
      ? "HELM_V2_OPPORTUNITY_JUDGEMENT_CONFIRMED"
      : input.mode === "block_boundary"
        ? "HELM_V2_OPPORTUNITY_JUDGEMENT_BLOCKED"
        : input.mode === "insufficient_evidence"
          ? "HELM_V2_OPPORTUNITY_JUDGEMENT_INSUFFICIENT_EVIDENCE"
          : input.mode === "keep_draft"
            ? "HELM_V2_OPPORTUNITY_JUDGEMENT_KEPT_DRAFT"
            : "HELM_V2_OPPORTUNITY_JUDGEMENT_REJECTED";

  await writeAuditLog({
    workspaceId: input.workspaceId,
    userId: input.reviewerId,
    actor: input.reviewerName,
    actorType: ActorType.USER,
    actionType: auditAction,
    targetType: "Opportunity",
    targetId: meeting.opportunityId ?? input.meetingId,
    summary:
      input.mode === "confirm" || input.mode === "edit_confirm"
        ? `Opportunity judgement for ${meeting.opportunity.title} was confirmed into shadow consume.`
        : input.mode === "block_boundary"
          ? `Opportunity judgement for ${meeting.opportunity.title} was blocked by boundary.`
          : input.mode === "insufficient_evidence"
            ? `Opportunity judgement for ${meeting.opportunity.title} stayed draft due to insufficient evidence.`
            : input.mode === "keep_draft"
              ? `Opportunity judgement for ${meeting.opportunity.title} was intentionally kept as draft.`
              : `Opportunity judgement for ${meeting.opportunity.title} was rejected.`,
    payload: {
      runtimeEventId: bundleArtifact.runtimeEventId,
      reviewMode: input.mode,
    },
    sourcePage: input.sourcePage ?? `/meetings/${input.meetingId}`,
    relatedObjectType: "Meeting",
    relatedObjectId: input.meetingId,
  });

  if (input.mode === "confirm" || input.mode === "edit_confirm") {
    await consumeReviewedOpportunityJudgement({
      workspaceId: input.workspaceId,
      meetingId: input.meetingId,
      reviewerId: input.reviewerId,
      reviewerName: input.reviewerName,
      sourcePage: input.sourcePage,
      opportunityDeltaBundleId: deltaBundle.id,
      bundleArtifactId: bundleArtifact.id,
      opportunityDelta: nextDelta,
      nextStepBrief: nextBrief,
      managerAttentionFlags: currentFlags,
      meeting,
    });
  }

  return {
    ok: true,
    reviewStatus,
    approvalStatus:
      input.mode === "confirm" || input.mode === "edit_confirm"
        ? ApprovalRequestStatus.APPROVED
        : input.mode === "reject" || input.mode === "block_boundary"
          ? ApprovalRequestStatus.REJECTED
          : (bundleArtifact.approvalRequest?.status ??
            ApprovalRequestStatus.PENDING),
    shadowConsumed: input.mode === "confirm" || input.mode === "edit_confirm",
    blockedByBoundary: input.mode === "block_boundary",
    insufficientEvidence: input.mode === "insufficient_evidence",
  };
}

export async function getMeetingOpportunityJudgeRuntimeSummary(
  workspaceId: string,
  meetingId: string,
): Promise<OpportunityJudgeRuntimeSummary | null> {
  const meeting = await loadOpportunityJudgeMeeting(workspaceId, meetingId);
  if (!meeting?.opportunity) return null;

  const [sourceMeetingFactsEvent, latestOpportunityDeltaEvent] =
    await Promise.all([
      db.runtimeEvent.findFirst({
        where: {
          workspaceId,
          meetingId,
          eventType: "meeting.facts_created",
        },
        orderBy: { createdAt: "desc" },
      }),
      db.runtimeEvent.findFirst({
        where: {
          workspaceId,
          meetingId,
          eventType: "opportunity.delta_created",
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

  if (!latestOpportunityDeltaEvent) return null;

  const [judgeRun, bundles] = await Promise.all([
    db.workerRun.findFirst({
      where: {
        runtimeEventId: latestOpportunityDeltaEvent.id,
        agentId: OPPORTUNITY_JUDGE_AGENT,
      },
      orderBy: { createdAt: "desc" },
    }),
    db.artifactBundle.findMany({
      where: {
        workspaceId,
        runtimeEventId: latestOpportunityDeltaEvent.id,
      },
      include: {
        approvalRequest: true,
        artifactReview: true,
      },
      orderBy: [{ createdAt: "asc" }],
    }),
  ]);

  const findBundle = (artifactType: string) =>
    bundles.find((bundle) => bundle.artifactType === artifactType) ?? null;
  const deltaBundle = findBundle("opportunity_delta.json");
  const briefBundle = findBundle("next_step_brief.md");
  const flagsBundle = findBundle("manager_attention_flags.json");
  const masterBundle = findBundle("opportunity_judgement_bundle.json");

  const editedPayload = safeParseJson<Record<string, unknown>>(
    masterBundle?.artifactReview?.editedPayload,
    {},
  );
  const currentDelta = deltaBundle
    ? parseBundlePayload<OpportunityDeltaArtifact>(deltaBundle.artifactsJson, {
        artifactId: "opportunity_delta.json",
        stageShadowFrom:
          meeting.opportunity.shadowStage ?? meeting.opportunity.stage,
        stageShadowTo:
          meeting.opportunity.shadowStage ?? meeting.opportunity.stage,
        probabilityDelta: 0,
        decisionCriteria: [],
        championStatus: "unclear",
        blockers: [],
        riskFlags: [],
        nextBestAction:
          meeting.opportunity.shadowNextAction ??
          meeting.opportunity.nextAction ??
          "",
        managerAttentionRequired: false,
        factDerived: [],
        inferredAssumptions: [],
        suggestionFields: [],
        stageRationale: "",
        evidenceRefs: [],
        sourceProvenance: [],
        confidence: 0,
        openQuestions: [],
        boundaryNotes: [SHADOW_ONLY_BOUNDARY_NOTE],
        recommendedNextAction: "",
        noOfficialWriteback: true,
      })
    : null;
  const currentBrief = briefBundle
    ? parseBundlePayload<NextStepBriefArtifact>(briefBundle.artifactsJson, {
        artifactId: "next_step_brief.md",
        markdown: "",
        audiences: ["operator", "manager", "seller_owner"],
        evidenceRefs: [],
        sourceProvenance: [],
        confidence: 0,
        openQuestions: [],
        boundaryNotes: [SHADOW_ONLY_BOUNDARY_NOTE],
        recommendedNextAction: "",
      })
    : null;
  const currentFlags = flagsBundle
    ? parseBundlePayload<ManagerAttentionFlagsArtifact>(
        flagsBundle.artifactsJson,
        {
          artifactId: "manager_attention_flags.json",
          requiresManagerAttention: false,
          flags: [],
          summary: "",
          evidenceRefs: [],
          sourceProvenance: [],
          confidence: 0,
          openQuestions: [],
          boundaryNotes: [SHADOW_ONLY_BOUNDARY_NOTE],
        },
      )
    : null;
  const currentBundle = masterBundle
    ? parseBundlePayload<OpportunityJudgementBundleArtifact>(
        masterBundle.artifactsJson,
        {
          artifactId: "opportunity_judgement_bundle.json",
          artifactList: [],
          evidenceRefs: [],
          sourceProvenance: [],
          confidence: 0,
          openQuestions: [],
          riskLevel: "low",
          recommendedNextAction: "",
          reviewStatus: "pending_review",
          boundaryNotes: [SHADOW_ONLY_BOUNDARY_NOTE],
          approvedMeans: "",
          approvedDoesNotMean: "",
          noOfficialWriteback: true,
        },
      )
    : null;

  return {
    latestOpportunityDeltaEvent: {
      id: latestOpportunityDeltaEvent.id,
      status: latestOpportunityDeltaEvent.status,
      createdAt: latestOpportunityDeltaEvent.createdAt,
      completedAt: latestOpportunityDeltaEvent.completedAt,
      errorMessage: latestOpportunityDeltaEvent.errorMessage,
    },
    sourceMeetingFactsEvent: sourceMeetingFactsEvent
      ? {
          id: sourceMeetingFactsEvent.id,
          status: sourceMeetingFactsEvent.status,
          createdAt: sourceMeetingFactsEvent.createdAt,
          completedAt: sourceMeetingFactsEvent.completedAt,
        }
      : null,
    judgeRun: judgeRun
      ? {
          id: judgeRun.id,
          status: judgeRun.status,
          confidence: judgeRun.confidence,
          openQuestions: safeParseJson<string[]>(judgeRun.openQuestions, []),
          evidenceRefs: safeParseJson<string[]>(judgeRun.evidenceRefs, []),
        }
      : null,
    approvalRequest: masterBundle?.approvalRequest
      ? {
          id: masterBundle.approvalRequest.id,
          status: masterBundle.approvalRequest.status,
          approvalTier: masterBundle.approvalRequest.approvalTier,
          requestedAction: masterBundle.approvalRequest.requestedAction,
          requestedReason: masterBundle.approvalRequest.requestedReason,
        }
      : null,
    artifactReview: masterBundle?.artifactReview
      ? {
          id: masterBundle.artifactReview.id,
          status: masterBundle.artifactReview.status,
          reviewedAt: masterBundle.artifactReview.reviewedAt,
          reviewNotes: masterBundle.artifactReview.reviewNotes,
          decisionSummary: masterBundle.artifactReview.decisionSummary,
        }
      : null,
    bundle:
      masterBundle && currentBundle
        ? {
            id: masterBundle.id,
            status: masterBundle.status,
            reviewedAt: masterBundle.reviewedAt,
            confirmedAt: masterBundle.confirmedAt,
            consumedAt: masterBundle.consumedAt,
            ...currentBundle,
          }
        : null,
    opportunityDelta:
      deltaBundle && currentDelta
        ? {
            id: deltaBundle.id,
            status: deltaBundle.status,
            reviewedAt: deltaBundle.reviewedAt,
            confirmedAt: deltaBundle.confirmedAt,
            consumedAt: deltaBundle.consumedAt,
            ...currentDelta,
          }
        : null,
    nextStepBrief:
      briefBundle && currentBrief
        ? {
            id: briefBundle.id,
            status: briefBundle.status,
            reviewedAt: briefBundle.reviewedAt,
            confirmedAt: briefBundle.confirmedAt,
            consumedAt: briefBundle.consumedAt,
            ...currentBrief,
          }
        : null,
    managerAttentionFlags:
      flagsBundle && currentFlags
        ? {
            id: flagsBundle.id,
            status: flagsBundle.status,
            reviewedAt: flagsBundle.reviewedAt,
            confirmedAt: flagsBundle.confirmedAt,
            consumedAt: flagsBundle.consumedAt,
            ...currentFlags,
          }
        : null,
    editorDraft:
      currentDelta && currentBrief
        ? {
            deltaJson: String(
              editedPayload.deltaJson ?? jsonStringify(currentDelta),
            ),
            nextStepBriefMarkdown: String(
              editedPayload.nextStepBriefMarkdown ?? currentBrief.markdown,
            ),
            reviewNotes: masterBundle?.artifactReview?.reviewNotes ?? "",
          }
        : null,
    currentShadow: {
      stage: meeting.opportunity.shadowStage,
      riskLevel: meeting.opportunity.shadowRiskLevel,
      nextAction: meeting.opportunity.shadowNextAction,
      blockersSummary: meeting.opportunity.shadowBlockersSummary,
      managerAttentionFlag: meeting.opportunity.shadowManagerAttentionFlag,
      stageConfidence: meeting.opportunity.shadowStageConfidence,
      updatedAt: meeting.opportunity.shadowUpdatedAt,
      nextStepSummary: meeting.opportunity.nextStepSummary,
    },
  };
}

export function evaluateSprint4OpportunityJudgeRuntime(input: {
  delta: OpportunityDeltaArtifact;
  managerAttention: ManagerAttentionFlagsArtifact;
  nextStepBrief: NextStepBriefArtifact;
  bundle: OpportunityJudgementBundleArtifact;
}) {
  const stageJudgementPass =
    Boolean(input.delta.stageShadowTo) &&
    Boolean(input.delta.stageRationale) &&
    input.delta.stageShadowTo !== OpportunityStage.LOST;
  const blockerRankingPass =
    input.delta.blockers.length === 0 ||
    input.delta.blockers.every((item, index, list) =>
      index === 0
        ? true
        : highestSeverityValue(list[index - 1]!.severity) >=
          highestSeverityValue(item.severity),
    );
  const nextBestActionPass =
    Boolean(input.delta.nextBestAction) &&
    input.nextStepBrief.markdown.includes(input.delta.nextBestAction);
  const managerAttentionPass =
    !input.delta.managerAttentionRequired ||
    (input.managerAttention.flags.length > 0 &&
      input.managerAttention.summary.length > 0);
  const shadowBoundaryPass =
    input.bundle.noOfficialWriteback &&
    input.bundle.boundaryNotes.some((item) =>
      item.includes("Official CRM state stays unchanged"),
    );
  const evidenceSufficiencyPass =
    input.delta.evidenceRefs.length > 0 &&
    input.delta.blockers.every((item) => item.evidenceRefs.length > 0) &&
    input.managerAttention.flags.every((item) => item.evidenceRefs.length > 0);

  return {
    stageJudgementPass,
    blockerRankingPass,
    nextBestActionPass,
    managerAttentionPass,
    shadowBoundaryPass,
    evidenceSufficiencyPass,
  } satisfies OpportunityJudgeEvaluationResult;
}
