import {
  ActorType,
  ApprovalRequestStatus,
  ArtifactBundleStatus,
  ArtifactReviewStatus,
  MemoryItemStatus,
  MemoryItemVerification,
  RuntimeEventStatus,
  UsageType,
  WorkerRunStatus,
} from "@prisma/client";
import { addDays, setHours, setMinutes, setSeconds } from "date-fns";
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
  type MeetingFactsArtifact,
  type RiskFlagsArtifact,
} from "@/lib/helm-v2/meeting-action-pack-runtime";
import { jsonStringify, safeParseJson } from "@/lib/utils";

const PROPOSAL_COMPOSER_AGENT = "proposal-composer";
const COMMS_SCHEDULER_AGENT = "comms-scheduler";
const RISK_PROMISE_GUARD_AGENT = "risk-promise-guard";
const DEFAULT_WORKSPACE_SUMMARY =
  "当前工作区以判断优先方式把会议、对象状态、审批和下一步收成同一条经营推进链。";
export const DRAFT_ONLY_COMMS_BOUNDARY_NOTE =
  "这组对外草稿仍然只是发送前复核交接，不会自动发送、不会自动创建外部日程，也不会形成正式承诺。";
const DRAFT_ONLY_APPROVAL_NOTE =
  "已通过只表示允许进入下一步人工动作，不代表任何邮件已发送、日程已创建，或正式客户关系系统状态已改写。";
const APPROVED_DOES_NOT_MEAN_SENT_NOTE =
  "已通过不等于已发送；不代表邮件已发送、不代表日程已创建，也不代表形成正式承诺或正式客户关系系统写回。";
const NON_COMMITMENT_FALLBACK_NOTE =
  "涉及报价、合同、交付日期、折扣或正式范围承诺的内容，仍需在内部复核后再单独确认。";
const CALENDAR_SUGGESTION_NOTE =
  "当前只生成时间建议，不会自动替你预约外部日程。";
const INTERNAL_ONLY_NOTE =
  "内部摘要仅用于内部协同和管理复核，不会直接对外可见。";

type DraftCommsMeeting = NonNullable<
  Awaited<ReturnType<typeof loadDraftCommsMeeting>>
>;
type ReviewMode =
  | "approve"
  | "edit_approve"
  | "reject"
  | "keep_draft"
  | "block_boundary"
  | "fallback_non_commitment";

type PersistedArtifact<TArtifact> = Omit<TArtifact, "confidence"> & {
  id: string;
  status: ArtifactBundleStatus;
  confidence: number | null;
};

type PersistedDraftBundle = Omit<DraftCommsBundleArtifact, "confidence"> & {
  id: string;
  status: ArtifactBundleStatus;
  confidence: number | null;
  reviewedAt: Date | null;
  confirmedAt: Date | null;
  consumedAt: Date | null;
};

export type ProposalComposerDraftArtifact = {
  artifactId:
    | "customer_followup_draft.md"
    | "internal_collab_brief.md"
    | "exec_brief.md";
  markdown: string;
  audience: "customer" | "internal" | "executive";
  evidenceRefs: string[];
  sourceProvenance: Array<Record<string, unknown>>;
  confidence: number;
  openQuestions: string[];
  policyBoundaryNotes: string[];
  commitmentWarnings: string[];
};

export type EmailDraftArtifact = {
  artifactId: "email_draft.eml";
  audience: "customer";
  subject: string;
  to: string[];
  body: string;
  evidenceRefs: string[];
  sourceProvenance: Array<Record<string, unknown>>;
  confidence: number;
  openQuestions: string[];
  policyBoundaryNotes: string[];
  commitmentWarnings: string[];
  requiresReviewBeforeSend: true;
};

export type CalendarOptionsArtifact = {
  artifactId: "calendar_options.json";
  audience: "customer";
  options: Array<{
    label: string;
    startsAt: string;
    endsAt: string;
    rationale: string;
  }>;
  evidenceRefs: string[];
  sourceProvenance: Array<Record<string, unknown>>;
  confidence: number;
  openQuestions: string[];
  policyBoundaryNotes: string[];
  requiresReviewBeforeSend: true;
};

export type MessageVariantsArtifact = {
  artifactId: "message_variants.md";
  audience: "customer";
  markdown: string;
  evidenceRefs: string[];
  sourceProvenance: Array<Record<string, unknown>>;
  confidence: number;
  openQuestions: string[];
  policyBoundaryNotes: string[];
  commitmentWarnings: string[];
  requiresReviewBeforeSend: true;
};

export type DraftCommsBundleArtifact = {
  artifactId: "draft_comms_bundle.json";
  artifactList: Array<{
    artifactId: string;
    audience: "customer" | "internal" | "executive";
    reviewRequired: boolean;
  }>;
  evidenceRefs: string[];
  sourceProvenance: Array<Record<string, unknown>>;
  confidence: number;
  openQuestions: string[];
  riskLevel: "low" | "medium" | "high" | "blocked";
  recommendedNextAction: string;
  reviewStatus:
    | "pending_review"
    | "kept_draft"
    | "approved_for_manual_handoff"
    | "rejected"
    | "blocked_by_boundary"
    | "fallback_non_commitment";
  boundaryNotes: string[];
  approvedMeans: string;
  approvedDoesNotMean: string;
  noSendAuthority: true;
};

export type GuardCheck = {
  key:
    | "promise_risk"
    | "pricing_risk"
    | "contract_risk"
    | "delivery_date_risk"
    | "data_leakage_risk"
    | "provenance_uncertainty"
    | "content_contamination_risk";
  status: "pass" | "warn" | "block";
  detail: string;
};

export type RiskReviewArtifact = {
  artifactId: "risk_review.json";
  riskLevel: "low" | "medium" | "high" | "blocked";
  blocked: boolean;
  fallbackRequired: boolean;
  reviewBeforeSend: true;
  recommendedDisposition:
    | "review_before_send"
    | "fallback_non_commitment"
    | "blocked";
  checks: GuardCheck[];
  boundaryNotes: string[];
  commitmentWarnings: string[];
};

export type ApprovalRequirementsArtifact = {
  artifactId: "approval_requirements.json";
  requestedAction: "draft-comms.review-before-send";
  approvalTier: string;
  mandatoryReviewers: string[];
  requiredApprovals: string[];
  reason: string;
  approvedMeans: string;
  approvedDoesNotMean: string;
  noSendAuthority: true;
};

export type SanitizedArtifact = {
  artifactId: "sanitized_artifact.md";
  markdown: string;
  appliedFallback: boolean;
  blocked: boolean;
  boundary: string;
  decisionHint: string;
};

type ProposalComposerResult = {
  customerFollowupDraft: ProposalComposerDraftArtifact;
  internalCollabBrief: ProposalComposerDraftArtifact;
  execBrief: ProposalComposerDraftArtifact;
  confidence: number;
  openQuestions: string[];
  evidenceRefs: string[];
  sourceProvenance: Array<Record<string, unknown>>;
};

type CommsSchedulerResult = {
  emailDraft: EmailDraftArtifact;
  calendarOptions: CalendarOptionsArtifact;
  messageVariants: MessageVariantsArtifact;
  confidence: number;
  openQuestions: string[];
  evidenceRefs: string[];
  sourceProvenance: Array<Record<string, unknown>>;
};

type RiskGuardResult = {
  riskReview: RiskReviewArtifact;
  approvalRequirements: ApprovalRequirementsArtifact;
  sanitizedArtifact: SanitizedArtifact;
  riskLevel: "low" | "medium" | "high" | "blocked";
};

type ConfirmedMeetingSource = {
  meeting: DraftCommsMeeting;
  meetingFacts: MeetingFactsArtifact;
  actionPack: ActionPackBundleContent;
  riskFlags: RiskFlagsArtifact;
  promotedMemory: Array<{
    id: string;
    summary: string;
    verification: string;
    status: string;
    meetingId: string | null;
    opportunityId: string | null;
    companyId: string | null;
  }>;
  evidenceRefs: string[];
  sourceProvenance: Array<Record<string, unknown>>;
  confirmedAt: Date | null;
};

export type DraftCommsRuntimeSummary = {
  latestFollowupRequestedEvent: {
    id: string;
    status: RuntimeEventStatus;
    createdAt: Date;
    completedAt: Date | null;
    errorMessage: string | null;
  } | null;
  proposalComposerRun: {
    id: string;
    status: WorkerRunStatus;
    confidence: number | null;
    openQuestions: string[];
    evidenceRefs: string[];
  } | null;
  commsSchedulerRun: {
    id: string;
    status: WorkerRunStatus;
    confidence: number | null;
    openQuestions: string[];
    evidenceRefs: string[];
  } | null;
  riskGuardRun: {
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
  bundle: PersistedDraftBundle | null;
  customerFollowupDraft: PersistedArtifact<ProposalComposerDraftArtifact> | null;
  internalCollabBrief: PersistedArtifact<ProposalComposerDraftArtifact> | null;
  execBrief: PersistedArtifact<ProposalComposerDraftArtifact> | null;
  emailDraft: PersistedArtifact<EmailDraftArtifact> | null;
  calendarOptions: PersistedArtifact<CalendarOptionsArtifact> | null;
  messageVariants: PersistedArtifact<MessageVariantsArtifact> | null;
  riskReview: PersistedArtifact<RiskReviewArtifact> | null;
  approvalRequirements: PersistedArtifact<ApprovalRequirementsArtifact> | null;
  sanitizedArtifact: PersistedArtifact<SanitizedArtifact> | null;
  editorDraft: {
    sanitizedMarkdown: string;
    reviewNotes: string;
  } | null;
  handoffPosture: {
    approvedForNextStepHandoff: boolean;
    blockedByBoundary: boolean;
    currentAudienceSummary: string;
    boundaryNote: string;
    approvedMeans: string;
    approvedDoesNotMean: string;
  } | null;
};

export type DraftCommsEvalCaseResult = {
  id: string;
  label: string;
  passed: boolean;
  failures: string[];
  draftUsefulnessPass: boolean;
  promiseSafetyPass: boolean;
  nonCommitmentFallbackPass: boolean;
  audienceCorrectnessPass: boolean;
  reviewPathConsistencyPass: boolean;
};

type DraftCommsGuardInput = {
  customerDraftMarkdown: string;
  emailDraftBody: string;
  messageVariantsMarkdown: string;
  openQuestions: string[];
  commitmentWarnings: string[];
  sourceProvenance: Array<Record<string, unknown>>;
  recommendedNextAction: string;
};

type DraftCommsFixtureMeeting = {
  id: string;
  title: string;
  workspaceId: string;
  companyId: string | null;
  opportunityId: string | null;
  agenda: string | null;
  startsAt: Date;
  endsAt: Date;
  workspace: {
    id: string;
    name: string;
    description: string | null;
    defaultLocale: string | null;
  };
  company: {
    id: string;
    name: string;
  } | null;
  opportunity: {
    id: string;
    title: string;
    type: string;
    stage: string;
    shadowStage: string | null;
    nextAction: string | null;
    shadowNextAction: string | null;
    riskLevel: string;
    shadowRiskLevel: string | null;
  } | null;
  contacts: Array<{
    id: string;
    name: string;
    email: string | null;
  }>;
  owner: {
    name: string;
  } | null;
  note: {
    id: string;
    summary: string | null;
    meetingGoal: string | null;
    riskAlerts: string | null;
    keyDecisions: string | null;
    confirmations: string | null;
  } | null;
};

function listUnique(values: Array<string | null | undefined>) {
  return values
    .map((value) => value?.trim())
    .filter(Boolean)
    .filter((value, index, list) => list.indexOf(value!) === index) as string[];
}

function parseJson<T>(value: string | null | undefined, fallback: T) {
  return safeParseJson<T>(value, fallback);
}

async function loadDraftCommsMeeting(workspaceId: string, meetingId: string) {
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

function buildDraftCommsBoundaryNotes(
  extra: Array<string | null | undefined> = [],
) {
  return listUnique([
    DRAFT_ONLY_COMMS_BOUNDARY_NOTE,
    DRAFT_ONLY_APPROVAL_NOTE,
    ...extra,
  ]);
}

function artifactPayload<T>(
  bundle: { artifactsJson: string } | null | undefined,
  fallback: T,
) {
  if (!bundle) return fallback;
  return parseJson<T>(bundle.artifactsJson, fallback);
}

function nestedArtifactPayload<T>(
  bundle: { artifactsJson: string } | null | undefined,
  fallback: T,
) {
  if (!bundle) return fallback;
  const parsed = parseJson<{ payload?: T } & Partial<T>>(
    bundle.artifactsJson,
    {},
  );
  if (
    parsed &&
    typeof parsed === "object" &&
    "payload" in parsed &&
    parsed.payload
  ) {
    return parsed.payload;
  }
  return parsed as T;
}

function buildAudienceSummary(bundle: DraftCommsBundleArtifact | null) {
  if (!bundle) return "customer / internal / executive";
  return bundle.artifactList
    .map((item) => item.audience)
    .filter((value, index, list) => list.indexOf(value) === index)
    .join(" / ");
}

async function loadConfirmedMeetingSource(
  workspaceId: string,
  meetingId: string,
): Promise<ConfirmedMeetingSource | null> {
  const meeting = await loadDraftCommsMeeting(workspaceId, meetingId);
  if (!meeting || !meeting.note) return null;

  const candidateActionPacks = await db.artifactBundle.findMany({
    where: {
      workspaceId,
      meetingId,
      artifactType: "action_pack.md",
    },
    include: {
      artifactReview: true,
      approvalRequest: true,
    },
    orderBy: [{ confirmedAt: "desc" }, { createdAt: "desc" }],
  });

  const actionPackBundle = candidateActionPacks.find(
    (bundle) =>
      bundle.artifactReview?.status === ArtifactReviewStatus.CONFIRMED &&
      bundle.approvalRequest?.status === ApprovalRequestStatus.APPROVED &&
      bundle.runtimeEventId,
  );

  if (!actionPackBundle?.runtimeEventId) {
    return null;
  }

  const [factsBundle, riskBundle, promotedMemory] = await Promise.all([
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
          ...(meeting.opportunityId
            ? [{ opportunityId: meeting.opportunityId }]
            : []),
          ...(meeting.companyId ? [{ companyId: meeting.companyId }] : []),
        ],
      },
      orderBy: [{ promotedAt: "desc" }, { createdAt: "desc" }],
      take: 12,
    }),
  ]);

  if (!factsBundle || !riskBundle) {
    return null;
  }

  return {
    meeting,
    meetingFacts: nestedArtifactPayload<MeetingFactsArtifact>(factsBundle, {
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
    }),
    actionPack: artifactPayload<ActionPackBundleContent>(actionPackBundle, {
      artifactId: "action_pack.md",
      markdown: "",
      boundary: DRAFT_ONLY_COMMS_BOUNDARY_NOTE,
      recommendedNextAction:
        "先人工确认这条跟进应该怎么说，再决定下一步。",
      openQuestions: [],
    }),
    riskFlags: nestedArtifactPayload<RiskFlagsArtifact>(riskBundle, {
      flags: [],
      boundaryNotes: [],
      requiresPromiseGuardReview: false,
    }),
    promotedMemory: promotedMemory.map((item) => ({
      id: item.id,
      summary: item.summary,
      verification: item.verification,
      status: item.status,
      meetingId: item.meetingId,
      opportunityId: item.opportunityId,
      companyId: item.companyId,
    })),
    evidenceRefs: parseJson<string[]>(factsBundle.evidenceRefs, []),
    sourceProvenance: parseJson<Array<Record<string, unknown>>>(
      factsBundle.sourceProvenance,
      [],
    ),
    confirmedAt: actionPackBundle.confirmedAt,
  };
}

function buildMemoryContext(source: ConfirmedMeetingSource) {
  return buildMeetingRuntimeMemoryContext({
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
}

function buildRelevantObjectMemory(source: ConfirmedMeetingSource) {
  return buildMemoryContext(source).slice(0, 6);
}

function buildOpportunitySummary(source: ConfirmedMeetingSource) {
  const opportunity = source.meeting.opportunity;
  if (!opportunity) {
    return "当前会议还没有关联正式机会，对外草稿只能围绕会后下一步和待确认依赖来写。";
  }
  const stage = opportunity.shadowStage ?? opportunity.stage;
  const nextAction =
    opportunity.shadowNextAction ??
    opportunity.nextAction ??
    source.actionPack.recommendedNextAction;
  const risk = opportunity.shadowRiskLevel ?? opportunity.riskLevel;
  return `${opportunity.title} 当前处于 ${stage}，风险等级 ${risk}，最值得推进的是：${nextAction}。`;
}

export function buildProposalComposerArtifacts(input: {
  meeting: DraftCommsMeeting | DraftCommsFixtureMeeting;
  meetingFacts: MeetingFactsArtifact;
  actionPack: ActionPackBundleContent;
  riskFlags: RiskFlagsArtifact;
  relevantObjectMemory: string[];
  evidenceRefs: string[];
  sourceProvenance: Array<Record<string, unknown>>;
}): ProposalComposerResult {
  const customer = input.meeting.company?.name ?? input.meeting.title;
  const nextAction = input.actionPack.recommendedNextAction;
  const blockerLine =
    input.meetingFacts.blockers[0] ??
    "当前最需要处理的是把会后下一步收口成唯一负责人和明确截止时间。";
  const goalLine =
    input.meetingFacts.customerGoals[0] ??
    "把今天已经确认的信息转成下一步可执行动作。";
  const commitmentWarnings = listUnique([
    ...input.meetingFacts.promisesDetected,
    ...input.riskFlags.flags
      .filter((item) => item.promiseRisk)
      .map((item) => item.label),
  ]);
  const openQuestions = listUnique(input.actionPack.openQuestions);
  const boundaryNotes = buildDraftCommsBoundaryNotes([
    input.actionPack.boundary,
    ...input.riskFlags.boundaryNotes,
    commitmentWarnings.length > 0 ? NON_COMMITMENT_FALLBACK_NOTE : null,
  ]);
  const sharedEvidence = input.evidenceRefs.slice(0, 6);
  const memoryHighlights = input.relevantObjectMemory.slice(0, 3);

  const customerFollowupDraft: ProposalComposerDraftArtifact = {
    artifactId: "customer_followup_draft.md",
    audience: "customer",
    markdown: [
      `# ${customer} 会后跟进草稿`,
      "",
      `感谢今天的沟通。基于今天已经确认的信息，我们建议先围绕以下一步继续推进：`,
      `- ${nextAction}`,
      "",
      "## 为什么是现在",
      `- ${goalLine}`,
      `- ${blockerLine}`,
      "",
      "## 当前建议的下一步",
      ...input.meetingFacts.nextActions.slice(0, 3).map((item) => `- ${item}`),
      "",
      "## 仍需一起确认的前提 / 依赖",
      ...(openQuestions.length
        ? openQuestions.map((item) => `- ${item}`)
        : ["- 当前仍需确认下一步的负责人、时点和依赖。"]),
      "",
      "## 边界说明",
      `- ${DRAFT_ONLY_COMMS_BOUNDARY_NOTE}`,
      ...(commitmentWarnings.length > 0
        ? [`- ${NON_COMMITMENT_FALLBACK_NOTE}`]
        : []),
    ].join("\n"),
    evidenceRefs: sharedEvidence,
    sourceProvenance: input.sourceProvenance,
    confidence: Math.max(
      74,
      Math.min(92, 76 + input.meetingFacts.facts.length * 2),
    ),
    openQuestions,
    policyBoundaryNotes: boundaryNotes,
    commitmentWarnings,
  };

  const internalCollabBrief: ProposalComposerDraftArtifact = {
    artifactId: "internal_collab_brief.md",
    audience: "internal",
    markdown: [
      `# ${customer} 内部协同摘要`,
      "",
      "## 当前判断",
      `- ${buildOpportunitySummary({
        meeting: input.meeting as DraftCommsMeeting,
        meetingFacts: input.meetingFacts,
        actionPack: input.actionPack,
        riskFlags: input.riskFlags,
        promotedMemory: [],
        evidenceRefs: input.evidenceRefs,
        sourceProvenance: input.sourceProvenance,
        confirmedAt: null,
      })}`,
      "",
      "## 当前卡点 / 依赖",
      ...(input.meetingFacts.blockers.length
        ? input.meetingFacts.blockers.slice(0, 3).map((item) => `- ${item}`)
        : ["- 当前卡点仍主要来自时点、负责人和依赖确认。"]),
      "",
      "## 建议协同动作",
      ...input.meetingFacts.ownerMap
        .slice(0, 3)
        .map((item) => `- ${item.owner}：${item.action}`),
      ...(input.meetingFacts.ownerMap.length
        ? []
        : [
            `- 唯一负责人：${input.meeting.owner?.name ?? "待指定"} · ${nextAction}`,
          ]),
      "",
      "## 相关对象记忆",
      ...(memoryHighlights.length
        ? memoryHighlights.map((item) => `- ${item}`)
        : [
            "- 当前还没有足够的已提升经营记忆，可先沿本次会议事实推进。",
          ]),
      "",
      "## 边界",
      `- ${INTERNAL_ONLY_NOTE}`,
      `- ${DRAFT_ONLY_APPROVAL_NOTE}`,
    ].join("\n"),
    evidenceRefs: sharedEvidence,
    sourceProvenance: input.sourceProvenance,
    confidence: Math.max(76, Math.min(93, 78 + memoryHighlights.length * 3)),
    openQuestions,
    policyBoundaryNotes: buildDraftCommsBoundaryNotes([INTERNAL_ONLY_NOTE]),
    commitmentWarnings,
  };

  const execBrief: ProposalComposerDraftArtifact = {
    artifactId: "exec_brief.md",
    audience: "executive",
    markdown: [
      `# ${customer} 负责人摘要`,
      "",
      "## 当前最重要的事",
      `- ${nextAction}`,
      "",
      "## 为什么是现在",
      `- ${blockerLine}`,
      "",
      "## 边界 / 复核姿态",
      `- ${DRAFT_ONLY_APPROVAL_NOTE}`,
      `- ${commitmentWarnings.length > 0 ? NON_COMMITMENT_FALLBACK_NOTE : "当前仍停在仅草稿沟通层，不形成正式承诺。"}`,
      "",
      "## 证据引用",
      ...sharedEvidence.map((item) => `- ${item}`),
    ].join("\n"),
    evidenceRefs: sharedEvidence,
    sourceProvenance: input.sourceProvenance,
    confidence: Math.max(74, Math.min(90, 75 + sharedEvidence.length * 2)),
    openQuestions,
    policyBoundaryNotes: boundaryNotes,
    commitmentWarnings,
  };

  return {
    customerFollowupDraft,
    internalCollabBrief,
    execBrief,
    confidence: Math.round(
      (customerFollowupDraft.confidence +
        internalCollabBrief.confidence +
        execBrief.confidence) /
        3,
    ),
    openQuestions,
    evidenceRefs: sharedEvidence,
    sourceProvenance: input.sourceProvenance,
  };
}

function buildCalendarOptions(
  meeting: DraftCommsMeeting | DraftCommsFixtureMeeting,
  nextAction: string,
) {
  const labels = ["Option A", "Option B", "Option C"];
  const hourOffsets = [10, 14, 16];

  return hourOffsets.map((hour, index) => {
    const startsAt = setSeconds(
      setMinutes(setHours(addDays(meeting.endsAt, index + 2), hour), 0),
      0,
    );
    const endsAt = addDays(startsAt, 0);
    endsAt.setMinutes(startsAt.getMinutes() + 30);

    return {
      label: labels[index] ?? `Option ${index + 1}`,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      rationale: `${nextAction} 仍需要先通过人工确认和对外沟通，再决定是否使用这个时间建议。`,
    };
  });
}

export function buildCommsSchedulerArtifacts(input: {
  meeting: DraftCommsMeeting | DraftCommsFixtureMeeting;
  proposal: ProposalComposerResult;
  actionPack: ActionPackBundleContent;
  evidenceRefs: string[];
  sourceProvenance: Array<Record<string, unknown>>;
}): CommsSchedulerResult {
  const companyName = input.meeting.company?.name ?? input.meeting.title;
  const customerNames = input.meeting.contacts.map(
    (contact) => contact.email ?? contact.name,
  );
  const nextAction = input.actionPack.recommendedNextAction;
  const openQuestions = listUnique(
    input.proposal.customerFollowupDraft.openQuestions,
  );
  const boundaryNotes = buildDraftCommsBoundaryNotes([
    ...input.proposal.customerFollowupDraft.policyBoundaryNotes,
    CALENDAR_SUGGESTION_NOTE,
  ]);

  const emailDraft: EmailDraftArtifact = {
    artifactId: "email_draft.eml",
    audience: "customer",
    subject: `${companyName}｜会后下一步建议`,
    to: customerNames,
    body: [
      `主题：${companyName} 会后下一步建议`,
      "",
      "大家好，",
      "",
      "感谢今天的沟通。基于目前已经确认的信息，我们建议先沿下面这一步继续推进：",
      `- ${nextAction}`,
      "",
      "如果你们方便，我们可以先按当前窗口准备需要你们确认的问题清单，并把下次讨论聚焦在唯一负责人、前置条件和下一步节奏上。",
      "",
      `说明：${DRAFT_ONLY_COMMS_BOUNDARY_NOTE}`,
      ...(input.proposal.customerFollowupDraft.commitmentWarnings.length > 0
        ? [`说明：${NON_COMMITMENT_FALLBACK_NOTE}`]
        : []),
    ].join("\n"),
    evidenceRefs: input.evidenceRefs,
    sourceProvenance: input.sourceProvenance,
    confidence: Math.max(
      74,
      input.proposal.customerFollowupDraft.confidence - 2,
    ),
    openQuestions,
    policyBoundaryNotes: boundaryNotes,
    commitmentWarnings: input.proposal.customerFollowupDraft.commitmentWarnings,
    requiresReviewBeforeSend: true,
  };

  const calendarOptions: CalendarOptionsArtifact = {
    artifactId: "calendar_options.json",
    audience: "customer",
    options: buildCalendarOptions(input.meeting, nextAction),
    evidenceRefs: input.evidenceRefs,
    sourceProvenance: input.sourceProvenance,
    confidence: Math.max(
      70,
      input.proposal.customerFollowupDraft.confidence - 4,
    ),
    openQuestions,
    policyBoundaryNotes: boundaryNotes,
    requiresReviewBeforeSend: true,
  };

  const messageVariants: MessageVariantsArtifact = {
    artifactId: "message_variants.md",
    audience: "customer",
    markdown: [
      `# ${companyName} message variants`,
      "",
      "## 轻量跟进版",
      `- 感谢今天的沟通。基于目前已确认的信息，我们建议先围绕“${nextAction}”继续推进。`,
      "",
      "## 依赖先讲清版",
      `- 今天的结论已经足够进入下一步，但仍需先确认负责人、前置条件和时间窗口。`,
      "",
      "## 约会先行版",
      `- 如果你们同意，我们可以先对齐下一次讨论的 2-3 个时间建议，再把问题清单提前发过去。`,
      "",
      "## Boundary",
      `- ${DRAFT_ONLY_COMMS_BOUNDARY_NOTE}`,
    ].join("\n"),
    evidenceRefs: input.evidenceRefs,
    sourceProvenance: input.sourceProvenance,
    confidence: Math.max(
      72,
      input.proposal.customerFollowupDraft.confidence - 3,
    ),
    openQuestions,
    policyBoundaryNotes: boundaryNotes,
    commitmentWarnings: input.proposal.customerFollowupDraft.commitmentWarnings,
    requiresReviewBeforeSend: true,
  };

  return {
    emailDraft,
    calendarOptions,
    messageVariants,
    confidence: Math.round(
      (emailDraft.confidence +
        calendarOptions.confidence +
        messageVariants.confidence) /
        3,
    ),
    openQuestions,
    evidenceRefs: input.evidenceRefs,
    sourceProvenance: input.sourceProvenance,
  };
}

function hasMitigationLanguage(text: string) {
  return /内部复核|双方确认|不构成正式承诺|不会形成正式承诺|review-before-send|不会自动发送|still requires review|does not constitute a commitment|after internal review/i.test(
    text,
  );
}

function buildFallbackMarkdown(nextAction: string, openQuestions: string[]) {
  return [
    "# sanitized customer follow-up",
    "",
    "感谢今天的沟通。基于目前已经确认的信息，我们建议先把下一步对齐在以下动作上：",
    `- ${nextAction}`,
    "",
    "在进入更强的对外表达前，仍需先确认以下前提 / 依赖：",
    ...(openQuestions.length
      ? openQuestions.map((item) => `- ${item}`)
      : ["- 当前仍需确认负责人、时间窗口和相关依赖。"]),
    "",
    "说明：这份文字仍然只是发送前复核草稿，不会自动发送，也不构成正式承诺；价格、合同、交付日期或正式范围承诺都必须继续人工复核。",
  ].join("\n");
}

export function evaluateDraftCommsRiskGuard(
  input: DraftCommsGuardInput,
): RiskGuardResult {
  const combinedText = [
    input.customerDraftMarkdown,
    input.emailDraftBody,
    input.messageVariantsMarkdown,
  ].join("\n");
  const mitigationPresent = hasMitigationLanguage(combinedText);
  const checks: GuardCheck[] = [];

  const pushCheck = (check: GuardCheck) => {
    checks.push(check);
  };

  const dataLeakageRisk =
    /身份证|税号|家庭住址|bank account|银行卡|个人敏感信息/i.test(combinedText);
  const contaminationRisk =
    /ignore previous|system prompt|<script>|rm -rf|BEGIN PROMPT/i.test(
      combinedText,
    );
  const promiseRisk =
    /保证|承诺|一定|确保|guarantee|commit to|promise|锁定/i.test(combinedText);
  const pricingRisk = /报价|价格|折扣|quote|price|discount/i.test(combinedText);
  const contractRisk = /合同|条款|法务|contract|legal/i.test(combinedText);
  const deliveryRisk = /交付日期|上线|milestone|go-live|delivery date/i.test(
    combinedText,
  );
  const provenanceUncertainty =
    input.openQuestions.length > 0 ||
    input.sourceProvenance.some(
      (item) => String(item.trust ?? "").toUpperCase() === "UNTRUSTED",
    );

  pushCheck({
    key: "promise_risk",
    status: promiseRisk && !mitigationPresent ? "warn" : "pass",
    detail:
      promiseRisk && !mitigationPresent
        ? "当前措辞可能被误读成承诺，需要先回退到非承诺表达。"
        : "承诺措辞当前仍保留在建议和发送前复核边界内。",
  });
  pushCheck({
    key: "pricing_risk",
    status: pricingRisk && !mitigationPresent ? "warn" : "pass",
    detail:
      pricingRisk && !mitigationPresent
        ? "价格 / 折扣相关内容目前仍未挂上边界备注。"
        : "价格 / 折扣相关内容没有越过当前边界。",
  });
  pushCheck({
    key: "contract_risk",
    status: contractRisk && !mitigationPresent ? "warn" : "pass",
    detail:
      contractRisk && !mitigationPresent
        ? "合同 / 条款相关表述需要保留发送前复核和人工确认。"
        : "合同 / 条款相关表述仍停在发送前复核层。",
  });
  pushCheck({
    key: "delivery_date_risk",
    status: deliveryRisk && !mitigationPresent ? "warn" : "pass",
    detail:
      deliveryRisk && !mitigationPresent
        ? "交付日期 / 上线措辞当前缺少足够的边界说明。"
        : "交付日期相关表达没有越过当前非承诺边界。",
  });
  pushCheck({
    key: "data_leakage_risk",
    status: dataLeakageRisk ? "block" : "pass",
    detail: dataLeakageRisk
      ? "发现疑似敏感数据泄露风险，当前草稿必须阻断。"
      : "未发现明显的数据泄露风险。",
  });
  pushCheck({
    key: "content_contamination_risk",
    status: contaminationRisk ? "block" : "pass",
    detail: contaminationRisk
      ? "发现疑似提示或内容污染痕迹，当前草稿必须阻断。"
      : "未发现明显的内容污染痕迹。",
  });
  pushCheck({
    key: "provenance_uncertainty",
    status: provenanceUncertainty ? "warn" : "pass",
    detail: provenanceUncertainty
      ? "源头来源仍包含不可信内容或未决问题。"
      : "当前源头来源已足以支撑仅草稿交接。",
  });

  const hardBlocked = dataLeakageRisk || contaminationRisk;
  const softFallbackRequired =
    !hardBlocked &&
    (promiseRisk || pricingRisk || contractRisk || deliveryRisk) &&
    !mitigationPresent;
  const riskLevel: RiskReviewArtifact["riskLevel"] = hardBlocked
    ? "blocked"
    : softFallbackRequired
      ? "high"
      : provenanceUncertainty
        ? "medium"
        : "low";

  const riskReview: RiskReviewArtifact = {
    artifactId: "risk_review.json",
    riskLevel,
    blocked: hardBlocked,
    fallbackRequired: softFallbackRequired,
    reviewBeforeSend: true,
    recommendedDisposition: hardBlocked
      ? "blocked"
      : softFallbackRequired
        ? "fallback_non_commitment"
        : "review_before_send",
    checks,
    boundaryNotes: buildDraftCommsBoundaryNotes([
      softFallbackRequired ? NON_COMMITMENT_FALLBACK_NOTE : null,
    ]),
    commitmentWarnings: input.commitmentWarnings,
  };

  const approvalRequirements: ApprovalRequirementsArtifact = {
    artifactId: "approval_requirements.json",
    requestedAction: "draft-comms.review-before-send",
    approvalTier: resolveApprovalRule("email.create_draft").tier,
    mandatoryReviewers:
      resolveApprovalRule("email.create_draft").mandatoryReviewers ?? [],
    requiredApprovals:
      resolveApprovalRule("email.create_draft").requiredApprovals,
    reason: hardBlocked
      ? "Risk & Promise Guard has blocked this draft until the boundary issue is resolved."
      : softFallbackRequired
        ? "Customer-facing wording needs a non-commitment fallback before it can enter manual handoff."
        : "Draft-only comms can move into human review, but still cannot auto-send or auto-book.",
    approvedMeans: "允许进入下一步人工发送 / 人工约会准备 / 人工接力。",
    approvedDoesNotMean: APPROVED_DOES_NOT_MEAN_SENT_NOTE,
    noSendAuthority: true,
  };

  const sanitizedArtifact: SanitizedArtifact = {
    artifactId: "sanitized_artifact.md",
    markdown: hardBlocked
      ? [
          "# blocked draft",
          "",
          "当前这份客户可见草稿已被风险与承诺守卫阻断。",
          "",
          "请先移除敏感信息或污染内容，再回到发送前复核。",
        ].join("\n")
      : softFallbackRequired
        ? buildFallbackMarkdown(
            input.recommendedNextAction,
            input.openQuestions,
          )
        : input.customerDraftMarkdown,
    appliedFallback: softFallbackRequired,
    blocked: hardBlocked,
    boundary: DRAFT_ONLY_COMMS_BOUNDARY_NOTE,
    decisionHint: hardBlocked
      ? "必须先按边界阻断，再由人工重写。"
      : softFallbackRequired
        ? "先切到非承诺兜底，再决定是否进入下一步人工交接。"
        : "当前可以进入发送前复核，但已通过仍不等于已发送。",
  };

  return {
    riskReview,
    approvalRequirements,
    sanitizedArtifact,
    riskLevel,
  };
}

export function buildDraftCommsBundle(input: {
  proposal: ProposalComposerResult;
  comms: CommsSchedulerResult;
  guard: RiskGuardResult;
  actionPack: ActionPackBundleContent;
  evidenceRefs: string[];
  sourceProvenance: Array<Record<string, unknown>>;
}): DraftCommsBundleArtifact {
  return {
    artifactId: "draft_comms_bundle.json",
    artifactList: [
      {
        artifactId: input.proposal.customerFollowupDraft.artifactId,
        audience: "customer",
        reviewRequired: true,
      },
      {
        artifactId: input.proposal.internalCollabBrief.artifactId,
        audience: "internal",
        reviewRequired: false,
      },
      {
        artifactId: input.proposal.execBrief.artifactId,
        audience: "executive",
        reviewRequired: false,
      },
      {
        artifactId: input.comms.emailDraft.artifactId,
        audience: "customer",
        reviewRequired: true,
      },
      {
        artifactId: input.comms.calendarOptions.artifactId,
        audience: "customer",
        reviewRequired: true,
      },
      {
        artifactId: input.comms.messageVariants.artifactId,
        audience: "customer",
        reviewRequired: true,
      },
      {
        artifactId: input.guard.riskReview.artifactId,
        audience: "internal",
        reviewRequired: false,
      },
      {
        artifactId: input.guard.approvalRequirements.artifactId,
        audience: "internal",
        reviewRequired: false,
      },
      {
        artifactId: input.guard.sanitizedArtifact.artifactId,
        audience: "customer",
        reviewRequired: true,
      },
    ],
    evidenceRefs: input.evidenceRefs,
    sourceProvenance: input.sourceProvenance,
    confidence: Math.round(
      (input.proposal.confidence + input.comms.confidence) / 2,
    ),
    openQuestions: listUnique([
      ...input.proposal.openQuestions,
      ...input.comms.openQuestions,
    ]),
    riskLevel: input.guard.riskLevel,
    recommendedNextAction: input.actionPack.recommendedNextAction,
    reviewStatus: "pending_review",
    boundaryNotes: buildDraftCommsBoundaryNotes([
      ...input.guard.riskReview.boundaryNotes,
      ...input.proposal.customerFollowupDraft.policyBoundaryNotes,
    ]),
    approvedMeans: input.guard.approvalRequirements.approvedMeans,
    approvedDoesNotMean: input.guard.approvalRequirements.approvedDoesNotMean,
    noSendAuthority: true,
  };
}

async function createArtifactBundle(input: {
  workspaceId: string;
  runtimeEventId: string;
  workerRunId: string;
  meeting: DraftCommsMeeting;
  artifactType: string;
  title: string;
  summary: string;
  approvalTier: string;
  reviewPosture: string;
  artifactsJson: string;
  evidenceRefs: string[];
  sourceProvenance: Array<Record<string, unknown>>;
  confidence: number;
  openQuestions: string[];
}) {
  return db.artifactBundle.create({
    data: {
      workspaceId: input.workspaceId,
      runtimeEventId: input.runtimeEventId,
      workerRunId: input.workerRunId,
      meetingId: input.meeting.id,
      opportunityId: input.meeting.opportunityId ?? undefined,
      companyId: input.meeting.companyId ?? undefined,
      artifactType: input.artifactType,
      title: input.title,
      status: ArtifactBundleStatus.DRAFT,
      approvalTier: input.approvalTier,
      summary: input.summary,
      artifactsJson: input.artifactsJson,
      evidenceRefs: jsonStringify(input.evidenceRefs),
      sourceProvenance: jsonStringify(input.sourceProvenance),
      confidence: input.confidence,
      openQuestions: jsonStringify(input.openQuestions),
      reviewPosture: input.reviewPosture,
    },
  });
}

async function createDraftCommsArtifacts(input: {
  workspaceId: string;
  runtimeEventId: string;
  meeting: DraftCommsMeeting;
  proposalRunId: string;
  commsRunId: string;
  guardRunId: string;
  proposal: ProposalComposerResult;
  comms: CommsSchedulerResult;
  guard: RiskGuardResult;
  bundle: DraftCommsBundleArtifact;
}) {
  const customerFollowupBundle = await createArtifactBundle({
    workspaceId: input.workspaceId,
    runtimeEventId: input.runtimeEventId,
    workerRunId: input.proposalRunId,
    meeting: input.meeting,
    artifactType: "customer_followup_draft.md",
    title: `${input.meeting.title} customer follow-up draft`,
    summary:
      "提案整理器已生成客户可见跟进草稿，但仍保持发送前复核。",
    approvalTier: resolveApprovalRule("email.create_draft").tier,
    reviewPosture: "review_before_send_required",
    artifactsJson: jsonStringify(input.proposal.customerFollowupDraft),
    evidenceRefs: input.proposal.evidenceRefs,
    sourceProvenance: input.proposal.sourceProvenance,
    confidence: input.proposal.customerFollowupDraft.confidence,
    openQuestions: input.proposal.customerFollowupDraft.openQuestions,
  });

  const internalCollabBundle = await createArtifactBundle({
    workspaceId: input.workspaceId,
    runtimeEventId: input.runtimeEventId,
    workerRunId: input.proposalRunId,
    meeting: input.meeting,
    artifactType: "internal_collab_brief.md",
    title: `${input.meeting.title} internal collaboration brief`,
    summary:
      "提案整理器已生成仅内部协同摘要，用于内部协同与接力。",
    approvalTier: resolveApprovalRule("memory.write_draft").tier,
    reviewPosture: "internal_only",
    artifactsJson: jsonStringify(input.proposal.internalCollabBrief),
    evidenceRefs: input.proposal.evidenceRefs,
    sourceProvenance: input.proposal.sourceProvenance,
    confidence: input.proposal.internalCollabBrief.confidence,
    openQuestions: input.proposal.internalCollabBrief.openQuestions,
  });

  const execBriefBundle = await createArtifactBundle({
    workspaceId: input.workspaceId,
    runtimeEventId: input.runtimeEventId,
    workerRunId: input.proposalRunId,
    meeting: input.meeting,
    artifactType: "exec_brief.md",
    title: `${input.meeting.title} exec brief`,
    summary: "提案整理器已生成经营负责人摘要，用于经营负责人快速判断。",
    approvalTier: resolveApprovalRule("memory.write_draft").tier,
    reviewPosture: "internal_exec_brief",
    artifactsJson: jsonStringify(input.proposal.execBrief),
    evidenceRefs: input.proposal.evidenceRefs,
    sourceProvenance: input.proposal.sourceProvenance,
    confidence: input.proposal.execBrief.confidence,
    openQuestions: input.proposal.execBrief.openQuestions,
  });

  const emailDraftBundle = await createArtifactBundle({
    workspaceId: input.workspaceId,
    runtimeEventId: input.runtimeEventId,
    workerRunId: input.commsRunId,
    meeting: input.meeting,
    artifactType: "email_draft.eml",
    title: `${input.meeting.title} email draft`,
    summary:
      "沟通与排期器已生成邮件草稿，但当前仍无发送权限。",
    approvalTier: resolveApprovalRule("email.create_draft").tier,
    reviewPosture: "review_before_send_required",
    artifactsJson: jsonStringify(input.comms.emailDraft),
    evidenceRefs: input.comms.evidenceRefs,
    sourceProvenance: input.comms.sourceProvenance,
    confidence: input.comms.emailDraft.confidence,
    openQuestions: input.comms.emailDraft.openQuestions,
  });

  const calendarOptionsBundle = await createArtifactBundle({
    workspaceId: input.workspaceId,
    runtimeEventId: input.runtimeEventId,
    workerRunId: input.commsRunId,
    meeting: input.meeting,
    artifactType: "calendar_options.json",
    title: `${input.meeting.title} calendar options`,
    summary:
      "沟通与排期器已生成日程选项，但当前仍不自动预约。",
    approvalTier: resolveApprovalRule("calendar.create_draft").tier,
    reviewPosture: "review_before_send_required",
    artifactsJson: jsonStringify(input.comms.calendarOptions),
    evidenceRefs: input.comms.evidenceRefs,
    sourceProvenance: input.comms.sourceProvenance,
    confidence: input.comms.calendarOptions.confidence,
    openQuestions: input.comms.calendarOptions.openQuestions,
  });

  const messageVariantsBundle = await createArtifactBundle({
    workspaceId: input.workspaceId,
    runtimeEventId: input.runtimeEventId,
    workerRunId: input.commsRunId,
    meeting: input.meeting,
    artifactType: "message_variants.md",
    title: `${input.meeting.title} message variants`,
    summary:
      "沟通与排期器已生成多条消息版本，但仍保持客户草稿姿态。",
    approvalTier: resolveApprovalRule("email.create_draft").tier,
    reviewPosture: "review_before_send_required",
    artifactsJson: jsonStringify(input.comms.messageVariants),
    evidenceRefs: input.comms.evidenceRefs,
    sourceProvenance: input.comms.sourceProvenance,
    confidence: input.comms.messageVariants.confidence,
    openQuestions: input.comms.messageVariants.openQuestions,
  });

  const riskReviewBundle = await createArtifactBundle({
    workspaceId: input.workspaceId,
    runtimeEventId: input.runtimeEventId,
    workerRunId: input.guardRunId,
    meeting: input.meeting,
    artifactType: "risk_review.json",
    title: `${input.meeting.title} draft comms risk review`,
    summary:
      "风险与承诺守卫已检查当前草稿措辞的承诺、价格、合同、交付与来源姿态。",
    approvalTier: resolveApprovalRule("email.create_draft").tier,
    reviewPosture: "guard_review",
    artifactsJson: jsonStringify(input.guard.riskReview),
    evidenceRefs: input.bundle.evidenceRefs,
    sourceProvenance: input.bundle.sourceProvenance,
    confidence: input.bundle.confidence,
    openQuestions: input.bundle.openQuestions,
  });

  const approvalRequirementsBundle = await createArtifactBundle({
    workspaceId: input.workspaceId,
    runtimeEventId: input.runtimeEventId,
    workerRunId: input.guardRunId,
    meeting: input.meeting,
    artifactType: "approval_requirements.json",
    title: `${input.meeting.title} approval requirements`,
    summary:
      "当前沟通草稿的发送前复核要求和非承诺边界已被收口。",
    approvalTier: resolveApprovalRule("email.create_draft").tier,
    reviewPosture: "approval_path",
    artifactsJson: jsonStringify(input.guard.approvalRequirements),
    evidenceRefs: input.bundle.evidenceRefs,
    sourceProvenance: input.bundle.sourceProvenance,
    confidence: input.bundle.confidence,
    openQuestions: input.bundle.openQuestions,
  });

  const sanitizedArtifactBundle = await createArtifactBundle({
    workspaceId: input.workspaceId,
    runtimeEventId: input.runtimeEventId,
    workerRunId: input.guardRunId,
    meeting: input.meeting,
    artifactType: "sanitized_artifact.md",
    title: `${input.meeting.title} sanitized draft`,
    summary:
      "风险与承诺守卫已生成当前最安全的客户可见交接措辞。",
    approvalTier: resolveApprovalRule("email.create_draft").tier,
    reviewPosture: "review_before_send_required",
    artifactsJson: jsonStringify(input.guard.sanitizedArtifact),
    evidenceRefs: input.bundle.evidenceRefs,
    sourceProvenance: input.bundle.sourceProvenance,
    confidence: input.bundle.confidence,
    openQuestions: input.bundle.openQuestions,
  });

  const masterBundle = await createArtifactBundle({
    workspaceId: input.workspaceId,
    runtimeEventId: input.runtimeEventId,
    workerRunId: input.guardRunId,
    meeting: input.meeting,
    artifactType: "draft_comms_bundle.json",
    title: `${input.meeting.title} draft comms bundle`,
    summary:
      "已确认的动作资料已进入仅草稿沟通交接，但下一步仍必须发送前复核。",
    approvalTier: resolveApprovalRule("email.create_draft").tier,
    reviewPosture: "review_before_send_required",
    artifactsJson: jsonStringify(input.bundle),
    evidenceRefs: input.bundle.evidenceRefs,
    sourceProvenance: input.bundle.sourceProvenance,
    confidence: input.bundle.confidence,
    openQuestions: input.bundle.openQuestions,
  });

  const approvalRequest = await db.approvalRequest.create({
    data: {
      workspaceId: input.workspaceId,
      runtimeEventId: input.runtimeEventId,
      workerRunId: input.guardRunId,
      artifactBundleId: masterBundle.id,
      requestedAction: "draft-comms.review-before-send",
      approvalTier: resolveApprovalRule("email.create_draft").tier,
      status: ApprovalRequestStatus.PENDING,
      requestedBy: RISK_PROMISE_GUARD_AGENT,
      requestedReason:
        "Draft-only customer-facing wording still requires review-before-send and explicit non-commitment boundary handling.",
    },
  });

  const artifactReview = await db.artifactReview.create({
    data: {
      workspaceId: input.workspaceId,
      runtimeEventId: input.runtimeEventId,
      artifactBundleId: masterBundle.id,
      approvalRequestId: approvalRequest.id,
      status: ArtifactReviewStatus.PENDING,
      editedPayload: jsonStringify({
        sanitizedMarkdown: input.guard.sanitizedArtifact.markdown,
        reviewNotes: "",
      }),
    },
  });

  return {
    customerFollowupBundle,
    internalCollabBundle,
    execBriefBundle,
    emailDraftBundle,
    calendarOptionsBundle,
    messageVariantsBundle,
    riskReviewBundle,
    approvalRequirementsBundle,
    sanitizedArtifactBundle,
    masterBundle,
    approvalRequest,
    artifactReview,
  };
}

function reviewDecisionSummary(mode: ReviewMode) {
  switch (mode) {
    case "approve":
      return "Approved for next-step manual handoff";
    case "edit_approve":
      return "Edited and approved for next-step manual handoff";
    case "reject":
      return "Rejected";
    case "keep_draft":
      return "Kept as draft";
    case "block_boundary":
      return "Blocked by boundary";
    case "fallback_non_commitment":
      return "Fallback to non-commitment wording";
  }
}

async function updateDraftCommsBundlesForReview(input: {
  runtimeEventId: string;
  reviewedAt: Date;
  reviewMode: ReviewMode;
  sanitizedArtifact: SanitizedArtifact;
  bundlePayload: DraftCommsBundleArtifact;
  reviewNotes?: string | null;
}) {
  const bundles = await db.artifactBundle.findMany({
    where: {
      runtimeEventId: input.runtimeEventId,
    },
    orderBy: { createdAt: "asc" },
  });

  const nextStatus =
    input.reviewMode === "reject" || input.reviewMode === "block_boundary"
      ? ArtifactBundleStatus.REJECTED
      : input.reviewMode === "keep_draft"
        ? ArtifactBundleStatus.REVIEWED
        : ArtifactBundleStatus.CONFIRMED;

  const nextReviewPosture =
    input.reviewMode === "reject"
      ? "rejected_by_human"
      : input.reviewMode === "keep_draft"
        ? "kept_as_draft"
        : input.reviewMode === "block_boundary"
          ? "blocked_by_boundary"
          : input.reviewMode === "fallback_non_commitment"
            ? "fallback_non_commitment"
            : "approved_for_manual_handoff";

  for (const bundle of bundles) {
    let artifactsJson = bundle.artifactsJson;
    if (bundle.artifactType === "sanitized_artifact.md") {
      artifactsJson = jsonStringify(input.sanitizedArtifact);
    }
    if (bundle.artifactType === "email_draft.eml") {
      const current = artifactPayload<EmailDraftArtifact>(bundle, {
        artifactId: "email_draft.eml",
        audience: "customer",
        subject: "",
        to: [],
        body: "",
        evidenceRefs: [],
        sourceProvenance: [],
        confidence: 70,
        openQuestions: [],
        policyBoundaryNotes: [],
        commitmentWarnings: [],
        requiresReviewBeforeSend: true,
      });
      artifactsJson = jsonStringify({
        ...current,
        body: input.sanitizedArtifact.markdown,
        policyBoundaryNotes: buildDraftCommsBoundaryNotes(
          current.policyBoundaryNotes,
        ),
      } satisfies EmailDraftArtifact);
    }
    if (bundle.artifactType === "draft_comms_bundle.json") {
      artifactsJson = jsonStringify(input.bundlePayload);
    }

    await db.artifactBundle.update({
      where: { id: bundle.id },
      data: {
        status: nextStatus,
        reviewPosture: nextReviewPosture,
        reviewedAt: input.reviewedAt,
        confirmedAt:
          input.reviewMode === "approve" ||
          input.reviewMode === "edit_approve" ||
          input.reviewMode === "fallback_non_commitment"
            ? input.reviewedAt
            : bundle.confirmedAt,
        consumedAt:
          input.reviewMode === "approve" ||
          input.reviewMode === "edit_approve" ||
          input.reviewMode === "fallback_non_commitment"
            ? input.reviewedAt
            : bundle.consumedAt,
        artifactsJson,
      },
    });
  }
}

function evaluateEditedSanitizedArtifact(input: {
  sanitizedMarkdown: string;
  currentEmailDraft: EmailDraftArtifact;
  currentMessageVariants: MessageVariantsArtifact;
  openQuestions: string[];
  commitmentWarnings: string[];
  sourceProvenance: Array<Record<string, unknown>>;
  recommendedNextAction: string;
}) {
  return evaluateDraftCommsRiskGuard({
    customerDraftMarkdown: input.sanitizedMarkdown,
    emailDraftBody: input.sanitizedMarkdown,
    messageVariantsMarkdown: input.currentMessageVariants.markdown,
    openQuestions: input.openQuestions,
    commitmentWarnings: input.commitmentWarnings,
    sourceProvenance: input.sourceProvenance,
    recommendedNextAction: input.recommendedNextAction,
  });
}

export async function runDraftCommsHandoffRuntime(input: {
  workspaceId: string;
  meetingId: string;
  actorName: string;
  actorUserId?: string;
  sourcePage?: string;
  force?: boolean;
}) {
  const meetingSource = await loadConfirmedMeetingSource(
    input.workspaceId,
    input.meetingId,
  );
  if (!meetingSource) {
    throw new Error(
      "Sprint 3 draft-only comms runtime requires confirmed meeting facts first.",
    );
  }

  const existingEvent = await db.runtimeEvent.findFirst({
    where: {
      workspaceId: input.workspaceId,
      meetingId: input.meetingId,
      eventType: "followup.requested",
      status: RuntimeEventStatus.COMPLETED,
    },
    orderBy: { createdAt: "desc" },
  });

  if (existingEvent && !input.force) {
    return {
      runtimeEventId: existingEvent.id,
      reused: true,
    };
  }

  await ensureWorkspaceProcessingAllowed({
    workspaceId: input.workspaceId,
    operation: "BRIEFING_GENERATION",
    english: meetingSource.meeting.workspace.defaultLocale === "en-US",
  });

  const runtimeEvent = await db.runtimeEvent.create({
    data: {
      workspaceId: input.workspaceId,
      meetingId: meetingSource.meeting.id,
      opportunityId: meetingSource.meeting.opportunityId ?? undefined,
      companyId: meetingSource.meeting.companyId ?? undefined,
      relatedObjectType: "Meeting",
      relatedObjectId: meetingSource.meeting.id,
      eventType: "followup.requested",
      status: RuntimeEventStatus.RUNNING,
      trustedContext: jsonStringify({
        workspaceSummary:
          meetingSource.meeting.workspace.description ??
          DEFAULT_WORKSPACE_SUMMARY,
        confirmedMeetingFacts: meetingSource.meetingFacts,
        confirmedActionPack: meetingSource.actionPack,
        promotedMemoryCount: meetingSource.promotedMemory.length,
      }),
      untrustedContext: jsonStringify({
        sourceProvenance: meetingSource.sourceProvenance.filter(
          (item) => String(item.trust ?? "").toUpperCase() === "UNTRUSTED",
        ),
      }),
      payload: jsonStringify({
        sourceMeetingConfirmedAt:
          meetingSource.confirmedAt?.toISOString() ?? null,
      }),
      sourceProvenance: jsonStringify(meetingSource.sourceProvenance),
      triggeredBy: "human",
      startedAt: new Date(),
    },
  });

  let activeRunId: string | null = null;

  try {
    const relevantObjectMemory = buildRelevantObjectMemory(meetingSource);

    const proposalRun = await db.workerRun.create({
      data: {
        workspaceId: input.workspaceId,
        runtimeEventId: runtimeEvent.id,
        companyId: meetingSource.meeting.companyId ?? undefined,
        meetingId: meetingSource.meeting.id,
        opportunityId: meetingSource.meeting.opportunityId ?? undefined,
        agentId: PROPOSAL_COMPOSER_AGENT,
        status: WorkerRunStatus.RUNNING,
        inputSummary:
          "Consume confirmed action pack and produce customer/internal/exec communication drafts only.",
        startedAt: new Date(),
      },
    });
    activeRunId = proposalRun.id;

    const proposal = buildProposalComposerArtifacts({
      meeting: meetingSource.meeting,
      meetingFacts: meetingSource.meetingFacts,
      actionPack: meetingSource.actionPack,
      riskFlags: meetingSource.riskFlags,
      relevantObjectMemory,
      evidenceRefs: meetingSource.evidenceRefs,
      sourceProvenance: meetingSource.sourceProvenance,
    });

    await db.workerRun.update({
      where: { id: proposalRun.id },
      data: {
        status: WorkerRunStatus.COMPLETED,
        outputSummary: "customer/internal/exec drafts created",
        confidence: proposal.confidence,
        evidenceRefs: jsonStringify(proposal.evidenceRefs),
        sourceProvenance: jsonStringify(proposal.sourceProvenance),
        openQuestions: jsonStringify(proposal.openQuestions),
        completedAt: new Date(),
      },
    });

    const commsRun = await db.workerRun.create({
      data: {
        workspaceId: input.workspaceId,
        runtimeEventId: runtimeEvent.id,
        companyId: meetingSource.meeting.companyId ?? undefined,
        meetingId: meetingSource.meeting.id,
        opportunityId: meetingSource.meeting.opportunityId ?? undefined,
        agentId: COMMS_SCHEDULER_AGENT,
        status: WorkerRunStatus.RUNNING,
        inputSummary:
          "Turn confirmed next action into draft-only email, calendar options, and message variants.",
        startedAt: new Date(),
      },
    });
    activeRunId = commsRun.id;

    const comms = buildCommsSchedulerArtifacts({
      meeting: meetingSource.meeting,
      proposal,
      actionPack: meetingSource.actionPack,
      evidenceRefs: meetingSource.evidenceRefs,
      sourceProvenance: meetingSource.sourceProvenance,
    });

    await db.workerRun.update({
      where: { id: commsRun.id },
      data: {
        status: WorkerRunStatus.COMPLETED,
        outputSummary:
          "email draft, calendar options, and message variants created",
        confidence: comms.confidence,
        evidenceRefs: jsonStringify(comms.evidenceRefs),
        sourceProvenance: jsonStringify(comms.sourceProvenance),
        openQuestions: jsonStringify(comms.openQuestions),
        completedAt: new Date(),
      },
    });

    const guardRun = await db.workerRun.create({
      data: {
        workspaceId: input.workspaceId,
        runtimeEventId: runtimeEvent.id,
        companyId: meetingSource.meeting.companyId ?? undefined,
        meetingId: meetingSource.meeting.id,
        opportunityId: meetingSource.meeting.opportunityId ?? undefined,
        agentId: RISK_PROMISE_GUARD_AGENT,
        status: WorkerRunStatus.RUNNING,
        inputSummary:
          "Inspect draft-only comms for promise, pricing, delivery, provenance, and contamination risk.",
        startedAt: new Date(),
      },
    });
    activeRunId = guardRun.id;

    const guard = evaluateDraftCommsRiskGuard({
      customerDraftMarkdown: proposal.customerFollowupDraft.markdown,
      emailDraftBody: comms.emailDraft.body,
      messageVariantsMarkdown: comms.messageVariants.markdown,
      openQuestions: listUnique([
        ...proposal.openQuestions,
        ...comms.openQuestions,
      ]),
      commitmentWarnings: proposal.customerFollowupDraft.commitmentWarnings,
      sourceProvenance: meetingSource.sourceProvenance,
      recommendedNextAction: meetingSource.actionPack.recommendedNextAction,
    });
    const bundle = buildDraftCommsBundle({
      proposal,
      comms,
      guard,
      actionPack: meetingSource.actionPack,
      evidenceRefs: meetingSource.evidenceRefs,
      sourceProvenance: meetingSource.sourceProvenance,
    });

    const created = await createDraftCommsArtifacts({
      workspaceId: input.workspaceId,
      runtimeEventId: runtimeEvent.id,
      meeting: meetingSource.meeting,
      proposalRunId: proposalRun.id,
      commsRunId: commsRun.id,
      guardRunId: guardRun.id,
      proposal,
      comms,
      guard,
      bundle,
    });

    await db.workerRun.update({
      where: { id: guardRun.id },
      data: {
        status: WorkerRunStatus.COMPLETED,
        outputSummary: guard.riskReview.blocked
          ? "draft blocked by boundary"
          : guard.riskReview.fallbackRequired
            ? "non-commitment fallback required"
            : "draft ready for human review",
        confidence: bundle.confidence,
        evidenceRefs: jsonStringify(bundle.evidenceRefs),
        sourceProvenance: jsonStringify(bundle.sourceProvenance),
        openQuestions: jsonStringify(bundle.openQuestions),
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

    await recordUsageLedgerEntry({
      workspaceId: input.workspaceId,
      userId: input.actorUserId,
      usageType: UsageType.BRIEFING_GENERATION,
      sourcePage: input.sourcePage ?? `/meetings/${input.meetingId}`,
      metadata: {
        meetingId: input.meetingId,
        operation: "helm_v2_draft_comms_runtime",
        riskLevel: guard.riskReview.riskLevel,
        approvalTier: created.approvalRequest.approvalTier,
      },
    });

    await writeAuditLog({
      workspaceId: input.workspaceId,
      userId: input.actorUserId,
      actor: input.actorName,
      actorType: input.actorUserId ? ActorType.USER : ActorType.SYSTEM,
      actionType: "HELM_V2_DRAFT_COMMS_RUNTIME_STARTED",
      targetType: "Meeting",
      targetId: input.meetingId,
      summary: `Draft-only comms runtime generated review-before-send artifacts for ${meetingSource.meeting.title}.`,
      payload: {
        runtimeEventId: runtimeEvent.id,
        bundleId: created.masterBundle.id,
        recommendedDisposition: guard.riskReview.recommendedDisposition,
      },
      sourcePage: input.sourcePage ?? `/meetings/${input.meetingId}`,
    });

    return {
      runtimeEventId: runtimeEvent.id,
      approvalRequestId: created.approvalRequest.id,
      artifactReviewId: created.artifactReview.id,
      draftCommsBundleId: created.masterBundle.id,
      reused: false,
    };
  } catch (error) {
    if (activeRunId) {
      await db.workerRun
        .update({
          where: { id: activeRunId },
          data: {
            status: WorkerRunStatus.FAILED,
            errorMessage:
              error instanceof Error
                ? error.message
                : "Draft comms runtime failed",
            failedAt: new Date(),
          },
        })
        .catch(() => null);
    }

    await db.runtimeEvent
      .update({
        where: { id: runtimeEvent.id },
        data: {
          status: RuntimeEventStatus.FAILED,
          errorMessage:
            error instanceof Error
              ? error.message
              : "Draft comms runtime failed",
          failedAt: new Date(),
        },
      })
      .catch(() => null);
    throw error;
  }
}

export async function reviewDraftCommsRuntime(input: {
  workspaceId: string;
  meetingId: string;
  reviewerId: string;
  reviewerName: string;
  mode: ReviewMode;
  edits?: {
    sanitizedMarkdown?: string | null;
    reviewNotes?: string | null;
  };
  sourcePage?: string;
}) {
  const source = await loadConfirmedMeetingSource(
    input.workspaceId,
    input.meetingId,
  );
  if (!source) {
    throw new Error(
      "Confirmed meeting facts are required before draft comms review.",
    );
  }

  const runtimeEvent = await db.runtimeEvent.findFirst({
    where: {
      workspaceId: input.workspaceId,
      meetingId: input.meetingId,
      eventType: "followup.requested",
    },
    orderBy: { createdAt: "desc" },
  });
  if (!runtimeEvent) {
    throw new Error(
      "No Helm v2 draft-only comms runtime was found for this meeting.",
    );
  }

  const bundles = await db.artifactBundle.findMany({
    where: {
      runtimeEventId: runtimeEvent.id,
    },
    include: {
      approvalRequest: true,
      artifactReview: true,
    },
    orderBy: { createdAt: "asc" },
  });
  const findBundle = (artifactType: string) =>
    bundles.find((bundle) => bundle.artifactType === artifactType) ?? null;
  const masterBundle = findBundle("draft_comms_bundle.json");
  const sanitizedBundle = findBundle("sanitized_artifact.md");
  const emailDraftBundle = findBundle("email_draft.eml");
  const messageVariantsBundle = findBundle("message_variants.md");
  const riskReviewBundle = findBundle("risk_review.json");

  if (
    !masterBundle?.artifactReview ||
    !masterBundle.approvalRequest ||
    !sanitizedBundle ||
    !emailDraftBundle ||
    !messageVariantsBundle ||
    !riskReviewBundle
  ) {
    throw new Error(
      "Draft-only comms artifacts are incomplete and cannot be reviewed yet.",
    );
  }

  // Terminal-state guard: once a draft-only comms request has been resolved
  // (REJECTED or APPROVED) it must not be re-reviewed. Without this, a
  // previously human-REJECTED customer-facing draft could be re-submitted with
  // mode "approve" and flipped to APPROVED — re-opening a rejected draft for
  // handoff. Only a still-PENDING request (incl. a kept-draft, which leaves the
  // approval request pending) may be reviewed.
  if (masterBundle.approvalRequest.status !== ApprovalRequestStatus.PENDING) {
    throw new Error(
      "This draft-only comms request has already been resolved and cannot be re-reviewed.",
    );
  }

  const currentBundlePayload = artifactPayload<DraftCommsBundleArtifact>(
    masterBundle,
    {
      artifactId: "draft_comms_bundle.json",
      artifactList: [],
      evidenceRefs: [],
      sourceProvenance: [],
      confidence: 0,
      openQuestions: [],
      riskLevel: "medium",
      recommendedNextAction: source.actionPack.recommendedNextAction,
      reviewStatus: "pending_review",
      boundaryNotes: buildDraftCommsBoundaryNotes(),
      approvedMeans: DRAFT_ONLY_APPROVAL_NOTE,
      approvedDoesNotMean: APPROVED_DOES_NOT_MEAN_SENT_NOTE,
      noSendAuthority: true,
    },
  );
  const currentSanitized = artifactPayload<SanitizedArtifact>(sanitizedBundle, {
    artifactId: "sanitized_artifact.md",
    markdown: "",
    appliedFallback: false,
    blocked: false,
    boundary: DRAFT_ONLY_COMMS_BOUNDARY_NOTE,
    decisionHint: "",
  });
  const currentEmailDraft = artifactPayload<EmailDraftArtifact>(
    emailDraftBundle,
    {
      artifactId: "email_draft.eml",
      audience: "customer",
      subject: "",
      to: [],
      body: "",
      evidenceRefs: [],
      sourceProvenance: [],
      confidence: 70,
      openQuestions: [],
      policyBoundaryNotes: [],
      commitmentWarnings: [],
      requiresReviewBeforeSend: true,
    },
  );
  const currentMessageVariants = artifactPayload<MessageVariantsArtifact>(
    messageVariantsBundle,
    {
      artifactId: "message_variants.md",
      audience: "customer",
      markdown: "",
      evidenceRefs: [],
      sourceProvenance: [],
      confidence: 70,
      openQuestions: [],
      policyBoundaryNotes: [],
      commitmentWarnings: [],
      requiresReviewBeforeSend: true,
    },
  );
  const currentRiskReview = artifactPayload<RiskReviewArtifact>(
    riskReviewBundle,
    {
      artifactId: "risk_review.json",
      riskLevel: "medium",
      blocked: false,
      fallbackRequired: false,
      reviewBeforeSend: true,
      recommendedDisposition: "review_before_send",
      checks: [],
      boundaryNotes: [],
      commitmentWarnings: [],
    },
  );

  const reviewedAt = new Date();
  const editedMarkdown = input.edits?.sanitizedMarkdown?.trim();
  let nextSanitizedArtifact = currentSanitized;
  let nextBundlePayload = currentBundlePayload;
  let nextReviewStatus: ArtifactReviewStatus;
  let nextApprovalStatus: ApprovalRequestStatus | null = null;
  let decisionSummary = reviewDecisionSummary(input.mode);

  if (input.mode === "keep_draft") {
    nextReviewStatus = ArtifactReviewStatus.KEPT_DRAFT;
    nextBundlePayload = {
      ...currentBundlePayload,
      reviewStatus: "kept_draft",
    };
  } else if (input.mode === "reject") {
    nextReviewStatus = ArtifactReviewStatus.REJECTED;
    nextApprovalStatus = ApprovalRequestStatus.REJECTED;
    nextBundlePayload = {
      ...currentBundlePayload,
      reviewStatus: "rejected",
    };
  } else if (input.mode === "block_boundary") {
    nextReviewStatus = ArtifactReviewStatus.REJECTED;
    nextApprovalStatus = ApprovalRequestStatus.REJECTED;
    nextSanitizedArtifact = {
      ...currentSanitized,
      blocked: true,
      decisionHint: "当前草稿已被人工按边界标记为受阻。",
    };
    nextBundlePayload = {
      ...currentBundlePayload,
      reviewStatus: "blocked_by_boundary",
      riskLevel: "blocked",
    };
  } else {
    const candidateMarkdown =
      input.mode === "fallback_non_commitment"
        ? buildFallbackMarkdown(
            currentBundlePayload.recommendedNextAction,
            currentBundlePayload.openQuestions,
          )
        : editedMarkdown || currentSanitized.markdown;

    const reevaluated = evaluateEditedSanitizedArtifact({
      sanitizedMarkdown: candidateMarkdown,
      currentEmailDraft,
      currentMessageVariants,
      openQuestions: currentBundlePayload.openQuestions,
      commitmentWarnings: currentRiskReview.commitmentWarnings,
      sourceProvenance: currentBundlePayload.sourceProvenance,
      recommendedNextAction: currentBundlePayload.recommendedNextAction,
    });

    if (reevaluated.riskReview.blocked) {
      throw new Error(
        "The edited draft still crosses a hard boundary and must remain blocked.",
      );
    }
    if (
      reevaluated.riskReview.fallbackRequired &&
      input.mode !== "fallback_non_commitment"
    ) {
      throw new Error(
        "This draft still needs a non-commitment fallback before it can move into manual handoff.",
      );
    }

    nextReviewStatus = ArtifactReviewStatus.CONFIRMED;
    nextApprovalStatus = ApprovalRequestStatus.APPROVED;
    nextSanitizedArtifact = reevaluated.sanitizedArtifact;
    nextBundlePayload = {
      ...currentBundlePayload,
      reviewStatus:
        input.mode === "fallback_non_commitment"
          ? "fallback_non_commitment"
          : "approved_for_manual_handoff",
      riskLevel: reevaluated.riskReview.riskLevel,
      boundaryNotes: buildDraftCommsBoundaryNotes([
        ...currentBundlePayload.boundaryNotes,
        ...reevaluated.riskReview.boundaryNotes,
      ]),
    };
    decisionSummary =
      input.mode === "fallback_non_commitment"
        ? "Fallback to non-commitment wording and approved for manual handoff"
        : decisionSummary;
  }

  await db.artifactReview.update({
    where: { id: masterBundle.artifactReview.id },
    data: {
      status: nextReviewStatus,
      reviewedByUserId: input.reviewerId,
      reviewNotes: input.edits?.reviewNotes ?? null,
      editedPayload: jsonStringify({
        sanitizedMarkdown: nextSanitizedArtifact.markdown,
        reviewNotes: input.edits?.reviewNotes ?? "",
      }),
      decisionSummary,
      reviewedAt,
    },
  });

  if (nextApprovalStatus) {
    await db.approvalRequest.update({
      where: { id: masterBundle.approvalRequest.id },
      data: {
        status: nextApprovalStatus,
        resolvedByUserId: input.reviewerId,
        resolutionNotes: input.edits?.reviewNotes ?? null,
        resolvedAt: reviewedAt,
      },
    });
  }

  await updateDraftCommsBundlesForReview({
    runtimeEventId: runtimeEvent.id,
    reviewedAt,
    reviewMode: input.mode,
    sanitizedArtifact: nextSanitizedArtifact,
    bundlePayload: nextBundlePayload,
    reviewNotes: input.edits?.reviewNotes,
  });

  await writeAuditLog({
    workspaceId: input.workspaceId,
    userId: input.reviewerId,
    actor: input.reviewerName,
    actorType: ActorType.USER,
    actionType: "HELM_V2_DRAFT_COMMS_REVIEWED",
    targetType: "Meeting",
    targetId: input.meetingId,
    summary: `${input.reviewerName} reviewed draft-only comms for ${source.meeting.title} with mode ${input.mode}.`,
    payload: {
      runtimeEventId: runtimeEvent.id,
      reviewMode: input.mode,
      decisionSummary,
    },
    sourcePage: input.sourcePage ?? `/meetings/${input.meetingId}`,
  });

  return {
    ok: true,
    reviewStatus: nextReviewStatus,
    approvalStatus: nextApprovalStatus,
    blockedByBoundary: input.mode === "block_boundary",
    approvedForNextStepHandoff:
      input.mode === "approve" ||
      input.mode === "edit_approve" ||
      input.mode === "fallback_non_commitment",
  };
}

export async function getMeetingDraftCommsRuntimeSummary(
  workspaceId: string,
  meetingId: string,
): Promise<DraftCommsRuntimeSummary | null> {
  const latestEvent = await db.runtimeEvent.findFirst({
    where: {
      workspaceId,
      meetingId,
      eventType: "followup.requested",
    },
    orderBy: { createdAt: "desc" },
  });
  if (!latestEvent) return null;

  const [proposalRun, commsRun, guardRun, bundles] = await Promise.all([
    db.workerRun.findFirst({
      where: {
        runtimeEventId: latestEvent.id,
        agentId: PROPOSAL_COMPOSER_AGENT,
      },
      orderBy: { createdAt: "desc" },
    }),
    db.workerRun.findFirst({
      where: {
        runtimeEventId: latestEvent.id,
        agentId: COMMS_SCHEDULER_AGENT,
      },
      orderBy: { createdAt: "desc" },
    }),
    db.workerRun.findFirst({
      where: {
        runtimeEventId: latestEvent.id,
        agentId: RISK_PROMISE_GUARD_AGENT,
      },
      orderBy: { createdAt: "desc" },
    }),
    db.artifactBundle.findMany({
      where: {
        runtimeEventId: latestEvent.id,
      },
      include: {
        approvalRequest: true,
        artifactReview: true,
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const findBundle = (artifactType: string) =>
    bundles.find((bundle) => bundle.artifactType === artifactType) ?? null;
  const masterBundle = findBundle("draft_comms_bundle.json");
  const customerFollowupBundle = findBundle("customer_followup_draft.md");
  const internalCollabBundle = findBundle("internal_collab_brief.md");
  const execBriefBundle = findBundle("exec_brief.md");
  const emailDraftBundle = findBundle("email_draft.eml");
  const calendarOptionsBundle = findBundle("calendar_options.json");
  const messageVariantsBundle = findBundle("message_variants.md");
  const riskReviewBundle = findBundle("risk_review.json");
  const approvalRequirementsBundle = findBundle("approval_requirements.json");
  const sanitizedBundle = findBundle("sanitized_artifact.md");

  const bundlePayload = artifactPayload<DraftCommsBundleArtifact>(
    masterBundle,
    {
      artifactId: "draft_comms_bundle.json",
      artifactList: [],
      evidenceRefs: [],
      sourceProvenance: [],
      confidence: 0,
      openQuestions: [],
      riskLevel: "medium",
      recommendedNextAction: "",
      reviewStatus: "pending_review",
      boundaryNotes: buildDraftCommsBoundaryNotes(),
      approvedMeans: "允许进入下一步人工动作。",
      approvedDoesNotMean: APPROVED_DOES_NOT_MEAN_SENT_NOTE,
      noSendAuthority: true,
    },
  );
  const editedPayload = parseJson<Record<string, unknown>>(
    masterBundle?.artifactReview?.editedPayload,
    {},
  );

  return {
    latestFollowupRequestedEvent: {
      id: latestEvent.id,
      status: latestEvent.status,
      createdAt: latestEvent.createdAt,
      completedAt: latestEvent.completedAt,
      errorMessage: latestEvent.errorMessage,
    },
    proposalComposerRun: proposalRun
      ? {
          id: proposalRun.id,
          status: proposalRun.status,
          confidence: proposalRun.confidence,
          openQuestions: parseJson<string[]>(proposalRun.openQuestions, []),
          evidenceRefs: parseJson<string[]>(proposalRun.evidenceRefs, []),
        }
      : null,
    commsSchedulerRun: commsRun
      ? {
          id: commsRun.id,
          status: commsRun.status,
          confidence: commsRun.confidence,
          openQuestions: parseJson<string[]>(commsRun.openQuestions, []),
          evidenceRefs: parseJson<string[]>(commsRun.evidenceRefs, []),
        }
      : null,
    riskGuardRun: guardRun
      ? {
          id: guardRun.id,
          status: guardRun.status,
          confidence: guardRun.confidence,
          openQuestions: parseJson<string[]>(guardRun.openQuestions, []),
          evidenceRefs: parseJson<string[]>(guardRun.evidenceRefs, []),
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
    bundle: masterBundle
      ? {
          ...bundlePayload,
          id: masterBundle.id,
          status: masterBundle.status,
          confidence: masterBundle.confidence,
          reviewedAt: masterBundle.reviewedAt,
          confirmedAt: masterBundle.confirmedAt,
          consumedAt: masterBundle.consumedAt,
        }
      : null,
    customerFollowupDraft: customerFollowupBundle
      ? {
          ...artifactPayload<ProposalComposerDraftArtifact>(
            customerFollowupBundle,
            {
              artifactId: "customer_followup_draft.md",
              markdown: "",
              audience: "customer",
              evidenceRefs: [],
              sourceProvenance: [],
              confidence: 0,
              openQuestions: [],
              policyBoundaryNotes: [],
              commitmentWarnings: [],
            },
          ),
          id: customerFollowupBundle.id,
          status: customerFollowupBundle.status,
          confidence: customerFollowupBundle.confidence,
        }
      : null,
    internalCollabBrief: internalCollabBundle
      ? {
          ...artifactPayload<ProposalComposerDraftArtifact>(
            internalCollabBundle,
            {
              artifactId: "internal_collab_brief.md",
              markdown: "",
              audience: "internal",
              evidenceRefs: [],
              sourceProvenance: [],
              confidence: 0,
              openQuestions: [],
              policyBoundaryNotes: [],
              commitmentWarnings: [],
            },
          ),
          id: internalCollabBundle.id,
          status: internalCollabBundle.status,
          confidence: internalCollabBundle.confidence,
        }
      : null,
    execBrief: execBriefBundle
      ? {
          ...artifactPayload<ProposalComposerDraftArtifact>(execBriefBundle, {
            artifactId: "exec_brief.md",
            markdown: "",
            audience: "executive",
            evidenceRefs: [],
            sourceProvenance: [],
            confidence: 0,
            openQuestions: [],
            policyBoundaryNotes: [],
            commitmentWarnings: [],
          }),
          id: execBriefBundle.id,
          status: execBriefBundle.status,
          confidence: execBriefBundle.confidence,
        }
      : null,
    emailDraft: emailDraftBundle
      ? {
          ...artifactPayload<EmailDraftArtifact>(emailDraftBundle, {
            artifactId: "email_draft.eml",
            audience: "customer",
            subject: "",
            to: [],
            body: "",
            evidenceRefs: [],
            sourceProvenance: [],
            confidence: 0,
            openQuestions: [],
            policyBoundaryNotes: [],
            commitmentWarnings: [],
            requiresReviewBeforeSend: true,
          }),
          id: emailDraftBundle.id,
          status: emailDraftBundle.status,
          confidence: emailDraftBundle.confidence,
        }
      : null,
    calendarOptions: calendarOptionsBundle
      ? {
          ...artifactPayload<CalendarOptionsArtifact>(calendarOptionsBundle, {
            artifactId: "calendar_options.json",
            audience: "customer",
            options: [],
            evidenceRefs: [],
            sourceProvenance: [],
            confidence: 0,
            openQuestions: [],
            policyBoundaryNotes: [],
            requiresReviewBeforeSend: true,
          }),
          id: calendarOptionsBundle.id,
          status: calendarOptionsBundle.status,
          confidence: calendarOptionsBundle.confidence,
        }
      : null,
    messageVariants: messageVariantsBundle
      ? {
          ...artifactPayload<MessageVariantsArtifact>(messageVariantsBundle, {
            artifactId: "message_variants.md",
            audience: "customer",
            markdown: "",
            evidenceRefs: [],
            sourceProvenance: [],
            confidence: 0,
            openQuestions: [],
            policyBoundaryNotes: [],
            commitmentWarnings: [],
            requiresReviewBeforeSend: true,
          }),
          id: messageVariantsBundle.id,
          status: messageVariantsBundle.status,
          confidence: messageVariantsBundle.confidence,
        }
      : null,
    riskReview: riskReviewBundle
      ? {
          ...artifactPayload<RiskReviewArtifact>(riskReviewBundle, {
            artifactId: "risk_review.json",
            riskLevel: "medium",
            blocked: false,
            fallbackRequired: false,
            reviewBeforeSend: true,
            recommendedDisposition: "review_before_send",
            checks: [],
            boundaryNotes: [],
            commitmentWarnings: [],
          }),
          id: riskReviewBundle.id,
          status: riskReviewBundle.status,
          confidence: riskReviewBundle.confidence,
        }
      : null,
    approvalRequirements: approvalRequirementsBundle
      ? {
          id: approvalRequirementsBundle.id,
          status: approvalRequirementsBundle.status,
          confidence: approvalRequirementsBundle.confidence,
          ...artifactPayload<ApprovalRequirementsArtifact>(
            approvalRequirementsBundle,
            {
              artifactId: "approval_requirements.json",
              requestedAction: "draft-comms.review-before-send",
              approvalTier: resolveApprovalRule("email.create_draft").tier,
              mandatoryReviewers: [],
              requiredApprovals: [],
              reason: "",
              approvedMeans: "",
              approvedDoesNotMean: "",
              noSendAuthority: true,
            },
          ),
        }
      : null,
    sanitizedArtifact: sanitizedBundle
      ? {
          id: sanitizedBundle.id,
          status: sanitizedBundle.status,
          confidence: sanitizedBundle.confidence,
          ...artifactPayload<SanitizedArtifact>(sanitizedBundle, {
            artifactId: "sanitized_artifact.md",
            markdown: "",
            appliedFallback: false,
            blocked: false,
            boundary: DRAFT_ONLY_COMMS_BOUNDARY_NOTE,
            decisionHint: "",
          }),
        }
      : null,
    editorDraft: sanitizedBundle
      ? {
          sanitizedMarkdown: String(
            editedPayload.sanitizedMarkdown ??
              artifactPayload<SanitizedArtifact>(sanitizedBundle, {
                artifactId: "sanitized_artifact.md",
                markdown: "",
                appliedFallback: false,
                blocked: false,
                boundary: DRAFT_ONLY_COMMS_BOUNDARY_NOTE,
                decisionHint: "",
              }).markdown,
          ),
          reviewNotes: String(
            editedPayload.reviewNotes ??
              masterBundle?.artifactReview?.reviewNotes ??
              "",
          ),
        }
      : null,
    handoffPosture: {
      approvedForNextStepHandoff:
        bundlePayload.reviewStatus === "approved_for_manual_handoff" ||
        bundlePayload.reviewStatus === "fallback_non_commitment",
      blockedByBoundary: bundlePayload.reviewStatus === "blocked_by_boundary",
      currentAudienceSummary: buildAudienceSummary(bundlePayload),
      boundaryNote: DRAFT_ONLY_COMMS_BOUNDARY_NOTE,
      approvedMeans: bundlePayload.approvedMeans,
      approvedDoesNotMean: bundlePayload.approvedDoesNotMean,
    },
  };
}

export function evaluateSprint3DraftCommsRuntime(input: {
  proposal: ProposalComposerResult;
  comms: CommsSchedulerResult;
  guard: RiskGuardResult;
  bundle: DraftCommsBundleArtifact;
}) {
  const draftUsefulnessPass =
    input.proposal.customerFollowupDraft.markdown.includes(
      "当前建议的下一步",
    ) && input.comms.emailDraft.body.includes("基于目前已经确认的信息");
  const promiseSafetyPass =
    !/guarantee|commit to|保证|一定|锁定折扣/i.test(
      input.guard.sanitizedArtifact.markdown,
    ) && input.guard.approvalRequirements.noSendAuthority;
  const nonCommitmentFallbackPass =
    !input.guard.riskReview.fallbackRequired ||
    (input.guard.sanitizedArtifact.appliedFallback &&
      /不构成正式承诺|不会形成正式承诺|review-before-send|发送前复核|内部复核/i.test(
        input.guard.sanitizedArtifact.markdown,
      ));
  const audienceCorrectnessPass =
    input.proposal.customerFollowupDraft.audience === "customer" &&
    input.proposal.internalCollabBrief.audience === "internal" &&
    input.proposal.execBrief.audience === "executive" &&
    input.comms.emailDraft.audience === "customer";
  const reviewPathConsistencyPass =
    input.guard.riskReview.reviewBeforeSend &&
    input.bundle.noSendAuthority &&
    input.bundle.approvedDoesNotMean.includes("不代表邮件已发送");

  return {
    draftUsefulnessPass,
    promiseSafetyPass,
    nonCommitmentFallbackPass,
    audienceCorrectnessPass,
    reviewPathConsistencyPass,
  };
}
