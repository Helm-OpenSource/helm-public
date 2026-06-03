import {
  ActorType,
  ApprovalRequestStatus,
  ArtifactReviewStatus,
  HumanActionExecutionAckStatus,
  HumanActionExecutionProofType,
  HumanActionExecutionStatus,
  HumanActionExecutionType,
  MemoryItemKind,
  MemoryItemPromotionRule,
  MemoryItemRetention,
  MemoryItemScope,
  MemoryItemSensitivity,
  MemoryItemStatus,
  MemoryItemVerification,
  RiskLevel,
} from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import {
  type DraftCommsBundleArtifact,
  type EmailDraftArtifact,
  type ProposalComposerDraftArtifact,
  type RiskReviewArtifact,
  type SanitizedArtifact,
  type CalendarOptionsArtifact,
} from "@/lib/helm-v2/draft-comms-handoff-runtime";
import {
  type ManagerAttentionFlagsArtifact,
  type NextStepBriefArtifact,
  type OpportunityDeltaArtifact,
  type OpportunityJudgementBundleArtifact,
} from "@/lib/helm-v2/opportunity-judge-runtime";
import { EXECUTION_SECTION_MARKER, mergeManagedSummarySection } from "@/lib/helm-v2/managed-summary-section";
import { jsonStringify, safeParseJson, trimText } from "@/lib/utils";

const EXECUTION_SURFACE_BOUNDARY_NOTE =
  "This is a human execution entry only. Helm still has no send authority, no auto booking, and no official CRM write authority.";
const EXECUTION_APPROVED_NOTE =
  "已批准只表示允许你人工执行下一步，不代表系统已发送、已预约、已承诺，或正式 CRM 已更新。";
const EXECUTION_PROOF_NOTE =
  "执行证明只表示 Helm 已记录人工动作与确认；除非另有明确回执，它不自动代表外部结果已经发生。";
const EXECUTION_HUMAN_ONLY_NOTE = "这是人工执行入口，不是自动执行入口。";
const EXECUTION_HUMAN_WRITER = "human-action-execution";

export type HumanActionExecutionActionType =
  | "manual_email_send"
  | "manual_calendar_send"
  | "manual_customer_followup"
  | "manual_internal_collab"
  | "manual_exec_brief_share"
  | "manual_crm_step"
  | "manual_handoff_delivery"
  | "manual_handoff_customer_success";

export type HumanActionExecutionProofTypeValue =
  | "manual_sent"
  | "manual_scheduled"
  | "manual_shared_internal"
  | "manual_crm_step_done"
  | "manual_handoff_done"
  | "blocked"
  | "deferred";

export type HumanActionExecutionAudience =
  | "customer"
  | "internal"
  | "executive"
  | "pipeline"
  | "delivery"
  | "customer_success";

export type HumanActionExecutionContract = {
  actionType: HumanActionExecutionActionType;
  executionSourceArtifact: string;
  sourceArtifactType: string;
  sourceArtifactTitle: string;
  sourceArtifactSummary: string;
  audience: HumanActionExecutionAudience;
  executionOwnerId?: string | null;
  executionOwnerName?: string | null;
  executionIntent: string;
  executionBoundary: string;
  executionPrerequisite?: string | null;
  executionDependency?: string | null;
  executionRiskLevel: "low" | "medium" | "high" | "critical";
  approvalContext: string;
  riskReviewSummary?: string | null;
  executionAcknowledgementStatus: "pending" | "acknowledged" | "blocked" | "deferred";
  executionProofType?: HumanActionExecutionProofTypeValue | null;
  executionProofPayload?: Record<string, unknown> | null;
  executionWritebackTarget: Array<"audit_trail" | "object_summary" | "checkpoint_memory" | "role_handoff_summary">;
  evidenceRefs: string[];
  sourceProvenance: Array<Record<string, unknown>>;
  boundaryTrace: string[];
};

export type HumanActionExecutionBundle = {
  artifactId: "human_action_execution_bundle.json";
  boundaryNotes: string[];
  approvedMeans: string;
  approvedDoesNotMean: string;
  humanOnly: string;
  proofDoesNotMean: string;
  readyCount: number;
  executedCount: number;
  blockedCount: number;
  deferredCount: number;
  recommendedNextAction: string;
};

export type HumanActionExecutionRuntimeAction = Omit<
  HumanActionExecutionContract,
  "executionAcknowledgementStatus" | "executionProofType" | "executionProofPayload"
> & {
  id: string;
  status: HumanActionExecutionStatus;
  executionAcknowledgementStatus: HumanActionExecutionAckStatus;
  executionProofType: HumanActionExecutionProofType | null;
  executionProofPayload: Record<string, unknown> | null;
  executedByName: string | null;
  executedAt: Date | null;
  proofNote: string | null;
  externalReference: string | null;
  whatWasNotDone: string | null;
  followThroughStatus: string | null;
  writebackSummary: string | null;
};

type HumanActionExecutionBundleInput = {
  executionIntent: string;
  boundaryTrace: string[];
};

export type HumanActionExecutionRuntimeActionRow = {
  id: string;
  sourceArtifactType: string;
  sourceArtifactTitle: string;
  sourceArtifactSummary: string;
  actionType: HumanActionExecutionType;
  audience: string;
  executionOwnerId: string | null;
  executionOwnerName: string | null;
  executionIntent: string;
  executionBoundary: string;
  executionPrerequisite: string | null;
  executionDependency: string | null;
  executionRiskLevel: RiskLevel;
  approvalContext: string;
  riskReviewSummary: string | null;
  acknowledgementStatus: HumanActionExecutionAckStatus;
  status: HumanActionExecutionStatus;
  executionProofType: HumanActionExecutionProofType | null;
  executionProofPayload: string | null;
  executionWritebackTarget: string;
  evidenceRefs: string | null;
  sourceProvenance: string | null;
  boundaryTrace: string | null;
  executedByName: string | null;
  executedAt: Date | null;
  proofNote: string | null;
  externalReference: string | null;
  whatWasNotDone: string | null;
  followThroughStatus: string | null;
  writebackSummary: string | null;
};

export type HumanActionExecutionRuntimeSummary = {
  bundle: HumanActionExecutionBundle | null;
  approvedSources: {
    draftCommsApproved: boolean;
    opportunityJudgementApproved: boolean;
    handoffArtifactsAvailable: number;
  };
  actions: HumanActionExecutionRuntimeAction[];
  latestWriteback: {
    meetingPostMeetingSummary: string | null;
    opportunityNextStepSummary: string | null;
    latestCheckpoint: {
      id: string;
      kind: MemoryItemKind;
      summary: string;
      createdAt: Date;
    } | null;
  };
};

export type HumanActionExecutionAckMode =
  | "mark_sent_manually"
  | "mark_scheduled_manually"
  | "mark_shared_internally"
  | "mark_crm_step_done"
  | "mark_handoff_done"
  | "mark_blocked"
  | "mark_deferred";

type DraftCommsApprovedSource = {
  bundle: DraftCommsBundleArtifact;
  bundleId: string;
  customerFollowupDraft: ProposalComposerDraftArtifact | null;
  internalCollabBrief: ProposalComposerDraftArtifact | null;
  execBrief: ProposalComposerDraftArtifact | null;
  emailDraft: EmailDraftArtifact | null;
  calendarOptions: CalendarOptionsArtifact | null;
  sanitizedArtifact: SanitizedArtifact | null;
  riskReview: RiskReviewArtifact | null;
};

type OpportunityJudgementApprovedSource = {
  bundle: OpportunityJudgementBundleArtifact;
  bundleId: string;
  opportunityDelta: OpportunityDeltaArtifact;
  nextStepBrief: NextStepBriefArtifact;
  managerAttentionFlags: ManagerAttentionFlagsArtifact;
};

type HandoffApprovedSource = {
  bundleId: string;
  artifactType: "handoff_pack.md" | "first_14_day_plan.md";
  title: string;
  summary: string;
  targetAudience: "delivery" | "customer_success";
  evidenceRefs: string[];
  sourceProvenance: Array<Record<string, unknown>>;
};

type ExecutionMeeting = NonNullable<Awaited<ReturnType<typeof loadExecutionMeeting>>>;

type Sprint5EvaluationResult = {
  executionPathConsistencyPass: boolean;
  proofWritebackConsistencyPass: boolean;
  approvalBoundaryConsistencyPass: boolean;
  manualAcknowledgementPass: boolean;
  roleHandoffPass: boolean;
};

function listUniqueStrings(values: Array<string | null | undefined>) {
  return values
    .map((value) => value?.trim())
    .filter(Boolean)
    .filter((value, index, list) => list.indexOf(value!) === index) as string[];
}

function riskLevelToLabel(level: RiskLevel | "low" | "medium" | "high" | "critical" | "blocked") {
  if (level === "critical" || level === RiskLevel.CRITICAL) return "critical" as const;
  if (level === "high" || level === RiskLevel.HIGH || level === "blocked") return "high" as const;
  if (level === "medium" || level === RiskLevel.MEDIUM) return "medium" as const;
  return "low" as const;
}

function levelToPrismaRisk(level: HumanActionExecutionContract["executionRiskLevel"]) {
  if (level === "critical") return RiskLevel.CRITICAL;
  if (level === "high") return RiskLevel.HIGH;
  if (level === "medium") return RiskLevel.MEDIUM;
  return RiskLevel.LOW;
}

function parseJson<T>(value: string | null | undefined, fallback: T) {
  return safeParseJson<T>(value, fallback);
}

function parseBundlePayload<T>(artifactsJson: string | null | undefined, fallback: T) {
  if (!artifactsJson) return fallback;
  return safeParseJson<T>(artifactsJson, fallback);
}

function parseNestedBundlePayload<T>(artifactsJson: string | null | undefined, fallback: T) {
  if (!artifactsJson) return fallback;
  const parsed = safeParseJson<{ payload?: T } & Partial<T>>(artifactsJson, {});
  if (parsed && typeof parsed === "object" && "payload" in parsed && parsed.payload) {
    return parsed.payload;
  }
  return parsed as T;
}

function mergeManagedSection(base: string | null | undefined, lines: string[]) {
  return mergeManagedSummarySection(base, EXECUTION_SECTION_MARKER, lines);
}

function formatExecutionLine(action: HumanActionExecutionRuntimeAction) {
  const when = action.executedAt ? action.executedAt.toISOString() : "pending";
  const subject = action.executionOwnerName ? `${action.executionOwnerName} / ${action.audience}` : action.audience;
  const statusLabel =
    action.status === HumanActionExecutionStatus.EXECUTED
      ? action.actionType === "manual_email_send" || action.actionType === "manual_customer_followup"
        ? "已人工发送"
        : action.actionType === "manual_calendar_send"
          ? "已人工发送时间建议"
          : action.actionType === "manual_crm_step"
            ? "已人工完成 CRM 步骤"
            : action.actionType === "manual_handoff_delivery" || action.actionType === "manual_handoff_customer_success"
              ? "已人工完成交接"
              : "已人工完成内部共享"
      : action.status === HumanActionExecutionStatus.BLOCKED
        ? "已人工标记为受阻"
        : action.status === HumanActionExecutionStatus.DEFERRED
          ? "已人工标记为暂缓"
          : "待人工执行";
  const tail =
    action.status === HumanActionExecutionStatus.EXECUTED
      ? "仅表示人工动作已被 Helm 记录，不自动代表外部结果已经发生。"
      : action.status === HumanActionExecutionStatus.BLOCKED
        ? "当前仍停在人工执行前，不代表系统已执行。"
        : action.status === HumanActionExecutionStatus.DEFERRED
          ? "当前仍停在人工执行前，不代表系统已执行。"
          : "approved 只表示允许人工下一步，不代表系统已发送、已预约或已写 正式 CRM。";
  return `- [${when}] ${subject} · ${statusLabel} · ${action.followThroughStatus ?? action.status}。${tail}`;
}

function buildDefaultWhatWasNotDone(actionType: HumanActionExecutionActionType) {
  switch (actionType) {
    case "manual_email_send":
    case "manual_customer_followup":
      return "未自动形成任何价格、合同、交付日期或正式范围承诺。";
    case "manual_calendar_send":
      return "未自动替你创建外部日程，仅记录已人工发送时间建议。";
    case "manual_crm_step":
      return "未自动替你写 正式 CRM；如果外部系统已更新，仍需明确回执。";
    default:
      return "未自动触发任何外部发送、外部预约或 正式系统写回。";
  }
}

function buildExecutionProofPayload(input: {
  action: HumanActionExecutionRuntimeAction;
  mode: HumanActionExecutionAckMode;
  note?: string | null;
  externalReference?: string | null;
  whatWasNotDone?: string | null;
  followThroughStatus?: string | null;
  acknowledgedAt: Date;
}) {
  return {
    mode: input.mode,
    actionType: input.action.actionType,
    sourceArtifactType: input.action.sourceArtifactType,
    acknowledgedAt: input.acknowledgedAt.toISOString(),
    note: input.note?.trim() || null,
    externalReference: input.externalReference?.trim() || null,
    whatWasNotDone: input.whatWasNotDone?.trim() || buildDefaultWhatWasNotDone(input.action.actionType),
    followThroughStatus: input.followThroughStatus?.trim() || null,
    executionOnly: true,
    externalOutcomeKnown: false,
    approvedMeans: EXECUTION_APPROVED_NOTE,
    approvedDoesNotMean: EXECUTION_PROOF_NOTE,
  };
}

function buildExecutionWritebackSummary(input: {
  action: HumanActionExecutionRuntimeAction;
  mode: HumanActionExecutionAckMode;
  executedByName: string;
  acknowledgedAt: Date;
  followThroughStatus?: string | null;
}) {
  const actor = input.executedByName;
  const when = input.acknowledgedAt.toISOString();
  const statusLine = input.followThroughStatus?.trim() ? `当前跟进状态：${input.followThroughStatus?.trim()}。` : "";

  switch (input.mode) {
    case "mark_sent_manually":
      return `[${when}] ${actor} 已人工发送这条客户可见草稿。${statusLine}仅表示人工发送动作已记录，不自动代表客户已回复或已接受。`;
    case "mark_scheduled_manually":
      return `[${when}] ${actor} 已人工发送时间建议 / 排期步骤。${statusLine}仅表示人工排期动作已记录，不自动代表外部日程已创建成功。`;
    case "mark_shared_internally":
      return `[${when}] ${actor} 已人工完成内部共享。${statusLine}仅表示内部协同动作已记录，不代表任何外部承诺已形成。`;
    case "mark_crm_step_done":
      return `[${when}] ${actor} 已人工完成 CRM / 管线步骤。${statusLine}仅表示人工步骤已记录，不自动代表正式 CRM 已同步成功。`;
    case "mark_handoff_done":
      return `[${when}] ${actor} 已人工完成交接。${statusLine}仅表示交接动作已记录，不自动代表下游已完全接收或外部结果已成立。`;
    case "mark_blocked":
      return `[${when}] ${actor} 将该动作标记为受阻。${statusLine}仍停在人工执行前，不代表系统已替你完成任何动作。`;
    case "mark_deferred":
      return `[${when}] ${actor} 将该动作标记为暂缓。${statusLine}仍停在人工执行前，不代表系统已替你完成任何动作。`;
  }
}

function actionTypeFromPrisma(value: HumanActionExecutionType): HumanActionExecutionActionType {
  return value.toLowerCase() as HumanActionExecutionActionType;
}

function actionTypeToPrisma(value: HumanActionExecutionActionType): HumanActionExecutionType {
  return value.toUpperCase() as HumanActionExecutionType;
}

function buildApprovalContextForDraft(reviewStatus: DraftCommsBundleArtifact["reviewStatus"]) {
  return reviewStatus === "fallback_non_commitment"
    ? "draft 已通过复核-before-send，并切到非承诺兜底；仅允许人工下一步。"
    : "draft 已通过复核-before-send；仅允许人工下一步。";
}

function buildApprovalContextForShadow() {
  return "manual shadow 判断已确认并 消费进阴影摘要；这仍然不代表 正式 CRM 已写回。";
}

async function loadExecutionMeeting(workspaceId: string, meetingId: string) {
  return db.meeting.findFirst({
    where: {
      workspaceId,
      id: meetingId,
    },
    include: {
      workspace: true,
      company: true,
      opportunity: true,
      owner: true,
      note: true,
    },
  });
}

async function loadApprovedDraftCommsSource(workspaceId: string, meetingId: string): Promise<DraftCommsApprovedSource | null> {
  const masterBundle = await db.artifactBundle.findFirst({
    where: {
      workspaceId,
      meetingId,
      artifactType: "draft_comms_bundle.json",
    },
    include: {
      artifactReview: true,
      approvalRequest: true,
    },
    orderBy: { createdAt: "desc" },
  });

  if (
    !masterBundle?.artifactReview ||
    !masterBundle.approvalRequest ||
    masterBundle.artifactReview.status !== ArtifactReviewStatus.CONFIRMED ||
    masterBundle.approvalRequest.status !== ApprovalRequestStatus.APPROVED
  ) {
    return null;
  }

  const bundle = parseBundlePayload<DraftCommsBundleArtifact>(masterBundle.artifactsJson, {
    artifactId: "draft_comms_bundle.json",
    artifactList: [],
    evidenceRefs: [],
    sourceProvenance: [],
    confidence: 0,
    openQuestions: [],
    riskLevel: "medium",
    recommendedNextAction: "",
    reviewStatus: "pending_review",
    boundaryNotes: [],
    approvedMeans: "",
    approvedDoesNotMean: "",
    noSendAuthority: true,
  });

  if (bundle.reviewStatus !== "approved_for_manual_handoff" && bundle.reviewStatus !== "fallback_non_commitment") {
    return null;
  }

  const related = await db.artifactBundle.findMany({
    where: {
      runtimeEventId: masterBundle.runtimeEventId ?? undefined,
    },
    orderBy: { createdAt: "asc" },
  });

  const findBundle = (artifactType: string) => related.find((item) => item.artifactType === artifactType) ?? null;

  return {
    bundle,
    bundleId: masterBundle.id,
    customerFollowupDraft: parseNestedBundlePayload<ProposalComposerDraftArtifact | null>(
      findBundle("customer_followup_draft.md")?.artifactsJson,
      null,
    ),
    internalCollabBrief: parseNestedBundlePayload<ProposalComposerDraftArtifact | null>(
      findBundle("internal_collab_brief.md")?.artifactsJson,
      null,
    ),
    execBrief: parseNestedBundlePayload<ProposalComposerDraftArtifact | null>(findBundle("exec_brief.md")?.artifactsJson, null),
    emailDraft: parseNestedBundlePayload<EmailDraftArtifact | null>(findBundle("email_draft.eml")?.artifactsJson, null),
    calendarOptions: parseNestedBundlePayload<CalendarOptionsArtifact | null>(
      findBundle("calendar_options.json")?.artifactsJson,
      null,
    ),
    sanitizedArtifact: parseBundlePayload<SanitizedArtifact | null>(findBundle("sanitized_artifact.md")?.artifactsJson, null),
    riskReview: parseNestedBundlePayload<RiskReviewArtifact | null>(findBundle("risk_review.json")?.artifactsJson, null),
  };
}

async function loadApprovedOpportunityJudgementSource(workspaceId: string, meetingId: string): Promise<OpportunityJudgementApprovedSource | null> {
  const masterBundle = await db.artifactBundle.findFirst({
    where: {
      workspaceId,
      meetingId,
      artifactType: "opportunity_judgement_bundle.json",
    },
    include: {
      artifactReview: true,
      approvalRequest: true,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!masterBundle?.artifactReview || masterBundle.artifactReview.status !== ArtifactReviewStatus.CONFIRMED) {
    return null;
  }

  const bundle = parseBundlePayload<OpportunityJudgementBundleArtifact>(masterBundle.artifactsJson, {
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
  });

  if (bundle.reviewStatus !== "approved_for_shadow_consume") {
    return null;
  }

  const related = await db.artifactBundle.findMany({
    where: {
      runtimeEventId: masterBundle.runtimeEventId ?? undefined,
    },
    orderBy: { createdAt: "asc" },
  });
  const findBundle = (artifactType: string) => related.find((item) => item.artifactType === artifactType) ?? null;
  const delta = findBundle("opportunity_delta.json");
  const brief = findBundle("next_step_brief.md");
  const flags = findBundle("manager_attention_flags.json");
  if (!delta || !brief || !flags) return null;

  return {
    bundle,
    bundleId: masterBundle.id,
    opportunityDelta: parseBundlePayload<OpportunityDeltaArtifact>(delta.artifactsJson, {
      artifactId: "opportunity_delta.json",
      stageShadowFrom: "CONTACTED",
      stageShadowTo: "CONTACTED",
      probabilityDelta: 0,
      decisionCriteria: [],
      championStatus: "unclear",
      blockers: [],
      riskFlags: [],
      nextBestAction: "",
      managerAttentionRequired: false,
      factDerived: [],
      inferredAssumptions: [],
      suggestionFields: [],
      stageRationale: "",
      evidenceRefs: [],
      sourceProvenance: [],
      confidence: 0,
      openQuestions: [],
      boundaryNotes: [],
      recommendedNextAction: "",
      noOfficialWriteback: true,
    }),
    nextStepBrief: parseBundlePayload<NextStepBriefArtifact>(brief.artifactsJson, {
      artifactId: "next_step_brief.md",
      markdown: "",
      audiences: ["operator", "manager", "seller_owner"],
      evidenceRefs: [],
      sourceProvenance: [],
      confidence: 0,
      openQuestions: [],
      boundaryNotes: [],
      recommendedNextAction: "",
    }),
    managerAttentionFlags: parseBundlePayload<ManagerAttentionFlagsArtifact>(flags.artifactsJson, {
      artifactId: "manager_attention_flags.json",
      requiresManagerAttention: false,
      flags: [],
      summary: "",
      evidenceRefs: [],
      sourceProvenance: [],
      confidence: 0,
      openQuestions: [],
      boundaryNotes: [],
    }),
  };
}

async function loadApprovedHandoffSources(workspaceId: string, meetingId: string): Promise<HandoffApprovedSource[]> {
  const bundles = await db.artifactBundle.findMany({
    where: {
      workspaceId,
      meetingId,
      artifactType: {
        in: ["handoff_pack.md", "first_14_day_plan.md"],
      },
      status: {
        in: ["CONFIRMED", "CONSUMED"],
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return bundles.map((bundle) => {
    const payload = parseBundlePayload<Record<string, unknown>>(bundle.artifactsJson, {});
    const summary = typeof payload.markdown === "string" ? payload.markdown : typeof payload.summary === "string" ? payload.summary : bundle.summary ?? bundle.title;
    return {
      bundleId: bundle.id,
      artifactType: bundle.artifactType as "handoff_pack.md" | "first_14_day_plan.md",
      title: bundle.title,
      summary: trimText(summary, 220),
      targetAudience:
        /customer success|csm|续费|扩展/i.test(bundle.title) || /customer success|csm/i.test(summary)
          ? "customer_success"
          : "delivery",
      evidenceRefs: parseJson<string[]>(bundle.evidenceRefs, []),
      sourceProvenance: parseJson<Array<Record<string, unknown>>>(bundle.sourceProvenance, []),
    };
  });
}

function buildDraftExecutionContracts(input: {
  meeting: ExecutionMeeting;
  draftSource: DraftCommsApprovedSource;
}): HumanActionExecutionContract[] {
  const ownerName = input.meeting.owner?.name ?? "当前负责人";
  const ownerId = input.meeting.ownerId ?? null;
  const baseBoundary = listUniqueStrings([
    EXECUTION_SURFACE_BOUNDARY_NOTE,
    EXECUTION_APPROVED_NOTE,
    EXECUTION_PROOF_NOTE,
    ...(input.draftSource.bundle.boundaryNotes ?? []),
  ]);
  const prerequisite = input.draftSource.bundle.openQuestions.length
    ? input.draftSource.bundle.openQuestions.slice(0, 3).join("；")
    : "复核-before-send 已通过，仍需人工决定具体时点、对象和渠道。";
  const dependency = input.draftSource.riskReview?.checks
    ?.filter((item) => item.status !== "pass")
    .map((item) => item.detail)
    .slice(0, 2)
    .join("；") ?? null;
  const riskSummary = input.draftSource.riskReview
    ? `${input.draftSource.riskReview.riskLevel} · ${input.draftSource.riskReview.recommendedDisposition}`
    : `${input.draftSource.bundle.riskLevel} · review_before_send`;
  const actions: HumanActionExecutionContract[] = [];

  if (input.draftSource.emailDraft) {
    actions.push({
      actionType: "manual_email_send",
      executionSourceArtifact: "email_draft.eml",
      sourceArtifactType: "email_draft.eml",
      sourceArtifactTitle: input.draftSource.emailDraft.subject,
      sourceArtifactSummary: trimText(input.draftSource.emailDraft.body, 200),
      audience: "customer",
      executionOwnerId: ownerId,
      executionOwnerName: ownerName,
      executionIntent: "按已复核的邮件草稿进行人工发送。",
      executionBoundary: "这仍然是人工发送，不是系统代发；已批准不等于已发送，也不等于形成正式承诺。",
      executionPrerequisite: prerequisite,
      executionDependency: dependency,
      executionRiskLevel: riskLevelToLabel(input.draftSource.bundle.riskLevel),
      approvalContext: buildApprovalContextForDraft(input.draftSource.bundle.reviewStatus),
      riskReviewSummary: riskSummary,
      executionAcknowledgementStatus: "pending",
      executionWritebackTarget: ["audit_trail", "object_summary", "checkpoint_memory"],
      evidenceRefs: input.draftSource.emailDraft.evidenceRefs,
      sourceProvenance: input.draftSource.emailDraft.sourceProvenance,
      boundaryTrace: baseBoundary,
    });
  } else if (input.draftSource.sanitizedArtifact) {
    actions.push({
      actionType: "manual_customer_followup",
      executionSourceArtifact: "sanitized_artifact.md",
      sourceArtifactType: "sanitized_artifact.md",
      sourceArtifactTitle: "Customer follow-up wording",
      sourceArtifactSummary: trimText(input.draftSource.sanitizedArtifact.markdown, 200),
      audience: "customer",
      executionOwnerId: ownerId,
      executionOwnerName: ownerName,
      executionIntent: "用已复核的非承诺措辞进行人工对外跟进。",
      executionBoundary: "这仍然只是人工跟进措辞，不是系统自动对外发送，也不是正式承诺。",
      executionPrerequisite: prerequisite,
      executionDependency: dependency,
      executionRiskLevel: riskLevelToLabel(input.draftSource.bundle.riskLevel),
      approvalContext: buildApprovalContextForDraft(input.draftSource.bundle.reviewStatus),
      riskReviewSummary: riskSummary,
      executionAcknowledgementStatus: "pending",
      executionWritebackTarget: ["audit_trail", "object_summary", "checkpoint_memory"],
      evidenceRefs: input.draftSource.bundle.evidenceRefs,
      sourceProvenance: input.draftSource.bundle.sourceProvenance,
      boundaryTrace: baseBoundary,
    });
  }

  if (input.draftSource.calendarOptions) {
    actions.push({
      actionType: "manual_calendar_send",
      executionSourceArtifact: "calendar_options.json",
      sourceArtifactType: "calendar_options.json",
      sourceArtifactTitle: "Calendar options",
      sourceArtifactSummary: input.draftSource.calendarOptions.options.map((item) => item.label).slice(0, 3).join("；"),
      audience: "customer",
      executionOwnerId: ownerId,
      executionOwnerName: ownerName,
      executionIntent: "按已复核的时间建议进行人工 scheduling。",
      executionBoundary: "这仍然只是人工发送时间建议，不是系统自动预约外部日程。",
      executionPrerequisite: prerequisite,
      executionDependency: dependency,
      executionRiskLevel: riskLevelToLabel(input.draftSource.bundle.riskLevel),
      approvalContext: buildApprovalContextForDraft(input.draftSource.bundle.reviewStatus),
      riskReviewSummary: riskSummary,
      executionAcknowledgementStatus: "pending",
      executionWritebackTarget: ["audit_trail", "object_summary", "checkpoint_memory"],
      evidenceRefs: input.draftSource.calendarOptions.evidenceRefs,
      sourceProvenance: input.draftSource.calendarOptions.sourceProvenance,
      boundaryTrace: baseBoundary,
    });
  }

  if (input.draftSource.internalCollabBrief) {
    actions.push({
      actionType: "manual_internal_collab",
      executionSourceArtifact: "internal_collab_brief.md",
      sourceArtifactType: "internal_collab_brief.md",
      sourceArtifactTitle: "Internal collaboration brief",
      sourceArtifactSummary: trimText(input.draftSource.internalCollabBrief.markdown, 180),
      audience: "internal",
      executionOwnerId: ownerId,
      executionOwnerName: ownerName,
      executionIntent: "把内部协同摘要共享给相关负责人 / 复核人。",
      executionBoundary: "仅内部交接；不会自动对外可见，也不会形成客户承诺。",
      executionPrerequisite: "草稿已通过发送前复核，当前只允许内部共享。",
      executionDependency: dependency,
      executionRiskLevel: riskLevelToLabel(input.draftSource.bundle.riskLevel),
      approvalContext: buildApprovalContextForDraft(input.draftSource.bundle.reviewStatus),
      riskReviewSummary: "internal-only",
      executionAcknowledgementStatus: "pending",
      executionWritebackTarget: ["audit_trail", "object_summary", "checkpoint_memory"],
      evidenceRefs: input.draftSource.internalCollabBrief.evidenceRefs,
      sourceProvenance: input.draftSource.internalCollabBrief.sourceProvenance,
      boundaryTrace: listUniqueStrings([...baseBoundary, "内部摘要只允许人工内部执行。"]),
    });
  }

  if (input.draftSource.execBrief) {
    actions.push({
      actionType: "manual_exec_brief_share",
      executionSourceArtifact: "exec_brief.md",
      sourceArtifactType: "exec_brief.md",
      sourceArtifactTitle: "Executive brief",
      sourceArtifactSummary: trimText(input.draftSource.execBrief.markdown, 180),
      audience: "executive",
      executionOwnerId: ownerId,
      executionOwnerName: ownerName,
      executionIntent: "把管理层摘要共享给主管 / 管理层。",
      executionBoundary: "这仍然只是内部摘要共享，不是对外发送，也不会触发正式系统写回。",
      executionPrerequisite: "草稿已通过发送前复核，当前只允许内部共享。",
      executionDependency: dependency,
      executionRiskLevel: riskLevelToLabel(input.draftSource.bundle.riskLevel),
      approvalContext: buildApprovalContextForDraft(input.draftSource.bundle.reviewStatus),
      riskReviewSummary: "internal-only",
      executionAcknowledgementStatus: "pending",
      executionWritebackTarget: ["audit_trail", "object_summary", "checkpoint_memory"],
      evidenceRefs: input.draftSource.execBrief.evidenceRefs,
      sourceProvenance: input.draftSource.execBrief.sourceProvenance,
      boundaryTrace: listUniqueStrings([...baseBoundary, "管理层摘要只允许人工内部执行。"]),
    });
  }

  return actions;
}

function buildShadowExecutionContracts(input: {
  meeting: ExecutionMeeting;
  opportunitySource: OpportunityJudgementApprovedSource;
}): HumanActionExecutionContract[] {
  if (!input.meeting.opportunityId) return [] as HumanActionExecutionContract[];
  const ownerName = input.meeting.owner?.name ?? "当前负责人";
  const ownerId = input.meeting.ownerId ?? null;
  const delta = input.opportunitySource.opportunityDelta;
  const flagsSummary =
    input.opportunitySource.managerAttentionFlags.flags.map((item) => item.detail).slice(0, 2).join("；") ||
    "当前没有新增 主管关注。";

  return [
    {
      actionType: "manual_crm_step",
      executionSourceArtifact: "next_step_brief.md",
      sourceArtifactType: "next_step_brief.md",
      sourceArtifactTitle: "Manual CRM / pipeline step",
      sourceArtifactSummary: trimText(input.opportunitySource.nextStepBrief.markdown, 220),
      audience: "pipeline",
      executionOwnerId: ownerId,
      executionOwnerName: ownerName,
      executionIntent: `按已确认阴影判断手工推进 CRM / 管线下一步：${delta.nextBestAction}`,
      executionBoundary: "这仍然只是人工 CRM / 管线步骤，不是 Helm 自动正式写回。",
      executionPrerequisite: delta.openQuestions.length
        ? delta.openQuestions.slice(0, 3).join("；")
        : "阴影判断已确认；当前仍需人工决定是否以及如何反映到外部系统。",
      executionDependency: flagsSummary,
      executionRiskLevel: riskLevelToLabel(delta.riskFlags.some((item) => item.severity === "high") ? "high" : "medium"),
      approvalContext: buildApprovalContextForShadow(),
      riskReviewSummary: delta.stageRationale,
      executionAcknowledgementStatus: "pending",
      executionWritebackTarget: ["audit_trail", "object_summary", "checkpoint_memory"],
      evidenceRefs: delta.evidenceRefs,
      sourceProvenance: delta.sourceProvenance,
      boundaryTrace: listUniqueStrings([
        EXECUTION_SURFACE_BOUNDARY_NOTE,
        EXECUTION_APPROVED_NOTE,
        "已确认的阴影差异只进入阴影摘要，不授予正式 CRM 写回权限。",
      ]),
    },
  ];
}

function buildHandoffExecutionContracts(input: {
  meeting: ExecutionMeeting;
  handoffSources: HandoffApprovedSource[];
}): HumanActionExecutionContract[] {
  const ownerName = input.meeting.owner?.name ?? "当前负责人";
  const ownerId = input.meeting.ownerId ?? null;
  return input.handoffSources.map((source) => ({
    actionType:
      source.targetAudience === "customer_success"
        ? ("manual_handoff_customer_success" as const)
        : ("manual_handoff_delivery" as const),
    executionSourceArtifact: source.artifactType,
    sourceArtifactType: source.artifactType,
    sourceArtifactTitle: source.title,
    sourceArtifactSummary: source.summary,
    audience: source.targetAudience,
    executionOwnerId: ownerId,
    executionOwnerName: ownerName,
    executionIntent:
      source.targetAudience === "customer_success"
        ? "按已准备好的交接制品，手工把上下文交给客户成功。"
        : "按已准备好的交接制品，手工把上下文交给交付 / 实施。",
    executionBoundary: "这仍然只是人工交接，不是系统自动完成交接、也不是下游已自动接收。",
    executionPrerequisite: "交接制品已就绪；仍需人工确认接手对象、时间和责任边界。",
    executionDependency: "当前交接仍依赖人工交接确认，不自动形成下游承诺。",
    executionRiskLevel: "medium",
    approvalContext: "交接制品已准备好进入人工交接；仍由人工完成交接动作。",
    riskReviewSummary: "handoff remains human-confirmed and internal-only",
    executionAcknowledgementStatus: "pending",
    executionWritebackTarget: ["audit_trail", "object_summary", "checkpoint_memory", "role_handoff_summary"],
    evidenceRefs: source.evidenceRefs,
    sourceProvenance: source.sourceProvenance,
    boundaryTrace: listUniqueStrings([
      EXECUTION_SURFACE_BOUNDARY_NOTE,
      EXECUTION_APPROVED_NOTE,
      "交接完成只表示人工完成交接，不自动代表下游已经完全接收。",
    ]),
  }));
}

export function buildHumanActionExecutionContracts(input: {
  meetingTitle: string;
  meetingOwnerId?: string | null;
  meetingOwnerName?: string | null;
  draftSource?: DraftCommsApprovedSource | null;
  opportunitySource?: OpportunityJudgementApprovedSource | null;
  handoffSources?: HandoffApprovedSource[];
}) {
  const meeting = {
    title: input.meetingTitle,
    ownerId: input.meetingOwnerId ?? null,
    owner: input.meetingOwnerName ? { name: input.meetingOwnerName } : null,
    opportunityId: "virtual",
  } as unknown as ExecutionMeeting;

  return [
    ...(input.draftSource ? buildDraftExecutionContracts({ meeting, draftSource: input.draftSource }) : []),
    ...(input.opportunitySource ? buildShadowExecutionContracts({ meeting, opportunitySource: input.opportunitySource }) : []),
    ...buildHandoffExecutionContracts({ meeting, handoffSources: input.handoffSources ?? [] }),
  ];
}

function buildBundleFromActions(actions: HumanActionExecutionBundleInput[]) {
  return {
    artifactId: "human_action_execution_bundle.json",
    boundaryNotes: listUniqueStrings([
      EXECUTION_SURFACE_BOUNDARY_NOTE,
      EXECUTION_APPROVED_NOTE,
      EXECUTION_PROOF_NOTE,
      ...actions.flatMap((item) => item.boundaryTrace),
    ]),
    approvedMeans: EXECUTION_APPROVED_NOTE,
    approvedDoesNotMean: "已批准不等于已执行，不等于已发送、已预约或已承诺，也不等于正式 CRM 已更新。",
    humanOnly: EXECUTION_HUMAN_ONLY_NOTE,
    proofDoesNotMean: EXECUTION_PROOF_NOTE,
    readyCount: actions.length,
    executedCount: 0,
    blockedCount: 0,
    deferredCount: 0,
    recommendedNextAction: actions[0]?.executionIntent ?? "先选择一条已通过动作，再由人工执行并留下证明。",
  } satisfies HumanActionExecutionBundle;
}

function parseExecutionWritebackTargets(value: string) {
  return parseJson<Array<"audit_trail" | "object_summary" | "checkpoint_memory" | "role_handoff_summary">>(value, []);
}

function toRuntimeAction(row: HumanActionExecutionRuntimeActionRow): HumanActionExecutionRuntimeAction {
  return {
    id: row.id,
    actionType: actionTypeFromPrisma(row.actionType),
    executionSourceArtifact: row.sourceArtifactType,
    sourceArtifactType: row.sourceArtifactType,
    sourceArtifactTitle: row.sourceArtifactTitle,
    sourceArtifactSummary: row.sourceArtifactSummary,
    audience: row.audience as HumanActionExecutionAudience,
    executionOwnerId: row.executionOwnerId,
    executionOwnerName: row.executionOwnerName,
    executionIntent: row.executionIntent,
    executionBoundary: row.executionBoundary,
    executionPrerequisite: row.executionPrerequisite,
    executionDependency: row.executionDependency,
    executionRiskLevel: riskLevelToLabel(row.executionRiskLevel),
    approvalContext: row.approvalContext,
    riskReviewSummary: row.riskReviewSummary,
    executionAcknowledgementStatus: row.acknowledgementStatus,
    executionProofType: row.executionProofType,
    executionProofPayload: row.executionProofPayload ? parseJson<Record<string, unknown>>(row.executionProofPayload, {}) : null,
    executionWritebackTarget: parseExecutionWritebackTargets(row.executionWritebackTarget),
    evidenceRefs: parseJson<string[]>(row.evidenceRefs, []),
    sourceProvenance: parseJson<Array<Record<string, unknown>>>(row.sourceProvenance, []),
    boundaryTrace: parseJson<string[]>(row.boundaryTrace, []),
    status: row.status,
    executedByName: row.executedByName,
    executedAt: row.executedAt,
    proofNote: row.proofNote,
    externalReference: row.externalReference,
    whatWasNotDone: row.whatWasNotDone,
    followThroughStatus: row.followThroughStatus,
    writebackSummary: row.writebackSummary,
  };
}

export async function syncMeetingHumanActionExecutionRuntime(input: {
  workspaceId: string;
  meetingId: string;
  actorName: string;
  actorUserId?: string;
  sourcePage?: string;
  force?: boolean;
}) {
  const meeting = await loadExecutionMeeting(input.workspaceId, input.meetingId);
  if (!meeting) {
    throw new Error("Meeting not found for human execution surface.");
  }

  const [draftSource, opportunitySource, handoffSources] = await Promise.all([
    loadApprovedDraftCommsSource(input.workspaceId, input.meetingId),
    loadApprovedOpportunityJudgementSource(input.workspaceId, input.meetingId),
    loadApprovedHandoffSources(input.workspaceId, input.meetingId),
  ]);

  const contracts = [
    ...(draftSource ? buildDraftExecutionContracts({ meeting, draftSource }) : []),
    ...(opportunitySource ? buildShadowExecutionContracts({ meeting, opportunitySource }) : []),
    ...buildHandoffExecutionContracts({ meeting, handoffSources }),
  ];

  if (contracts.length === 0) {
    return {
      ok: true,
      actionCount: 0,
      reused: true,
    };
  }

  for (const contract of contracts) {
    const sourceArtifactBundleId =
      contract.actionType === "manual_crm_step"
        ? opportunitySource?.bundleId
        : contract.actionType === "manual_handoff_delivery" || contract.actionType === "manual_handoff_customer_success"
          ? handoffSources.find((source) =>
              (source.targetAudience === "delivery" && contract.actionType === "manual_handoff_delivery") ||
              (source.targetAudience === "customer_success" && contract.actionType === "manual_handoff_customer_success"),
            )?.bundleId
          : draftSource?.bundleId;

    await db.humanActionExecution.upsert({
      where: {
        workspaceId_meetingId_actionType: {
          workspaceId: input.workspaceId,
          meetingId: input.meetingId,
          actionType: actionTypeToPrisma(contract.actionType),
        },
      },
      create: {
        workspaceId: input.workspaceId,
        meetingId: input.meetingId,
        opportunityId: meeting.opportunityId ?? undefined,
        companyId: meeting.companyId ?? undefined,
        sourceArtifactBundleId,
        sourceArtifactType: contract.sourceArtifactType,
        sourceArtifactTitle: contract.sourceArtifactTitle,
        sourceArtifactSummary: contract.sourceArtifactSummary,
        actionType: actionTypeToPrisma(contract.actionType),
        audience: contract.audience,
        executionOwnerId: contract.executionOwnerId ?? undefined,
        executionOwnerName: contract.executionOwnerName ?? undefined,
        executionIntent: contract.executionIntent,
        executionBoundary: contract.executionBoundary,
        executionPrerequisite: contract.executionPrerequisite ?? undefined,
        executionDependency: contract.executionDependency ?? undefined,
        executionRiskLevel: levelToPrismaRisk(contract.executionRiskLevel),
        approvalContext: contract.approvalContext,
        riskReviewSummary: contract.riskReviewSummary ?? undefined,
        executionWritebackTarget: jsonStringify(contract.executionWritebackTarget),
        evidenceRefs: jsonStringify(contract.evidenceRefs),
        sourceProvenance: jsonStringify(contract.sourceProvenance),
        boundaryTrace: jsonStringify(contract.boundaryTrace),
      },
      update: {
        sourceArtifactBundleId,
        sourceArtifactType: contract.sourceArtifactType,
        sourceArtifactTitle: contract.sourceArtifactTitle,
        sourceArtifactSummary: contract.sourceArtifactSummary,
        audience: contract.audience,
        executionOwnerId: contract.executionOwnerId ?? undefined,
        executionOwnerName: contract.executionOwnerName ?? undefined,
        executionIntent: contract.executionIntent,
        executionBoundary: contract.executionBoundary,
        executionPrerequisite: contract.executionPrerequisite ?? undefined,
        executionDependency: contract.executionDependency ?? undefined,
        executionRiskLevel: levelToPrismaRisk(contract.executionRiskLevel),
        approvalContext: contract.approvalContext,
        riskReviewSummary: contract.riskReviewSummary ?? undefined,
        executionWritebackTarget: jsonStringify(contract.executionWritebackTarget),
        evidenceRefs: jsonStringify(contract.evidenceRefs),
        sourceProvenance: jsonStringify(contract.sourceProvenance),
        boundaryTrace: jsonStringify(contract.boundaryTrace),
      },
    });
  }

  await writeAuditLog({
    workspaceId: input.workspaceId,
    userId: input.actorUserId,
    actor: input.actorName,
    actorType: input.actorUserId ? ActorType.USER : ActorType.SYSTEM,
    actionType: "HELM_V2_HUMAN_ACTION_EXECUTION_READY",
    targetType: "Meeting",
    targetId: input.meetingId,
    summary: `Human execution surface for ${meeting.title} now has ${contracts.length} ready action(s).`,
    payload: {
      actionTypes: contracts.map((item) => item.actionType),
      draftCommsApproved: Boolean(draftSource),
      opportunityJudgementApproved: Boolean(opportunitySource),
      handoffArtifactsAvailable: handoffSources.length,
    },
    sourcePage: input.sourcePage ?? `/meetings/${input.meetingId}`,
    relatedObjectType: "Opportunity",
    relatedObjectId: meeting.opportunityId ?? undefined,
  });

  return {
    ok: true,
    actionCount: contracts.length,
    reused: false,
  };
}

function expectedPrimaryAckMode(actionType: HumanActionExecutionActionType): HumanActionExecutionAckMode {
  switch (actionType) {
    case "manual_email_send":
    case "manual_customer_followup":
      return "mark_sent_manually";
    case "manual_calendar_send":
      return "mark_scheduled_manually";
    case "manual_internal_collab":
    case "manual_exec_brief_share":
      return "mark_shared_internally";
    case "manual_crm_step":
      return "mark_crm_step_done";
    case "manual_handoff_delivery":
    case "manual_handoff_customer_success":
      return "mark_handoff_done";
  }
}

function validateAckMode(actionType: HumanActionExecutionActionType, mode: HumanActionExecutionAckMode) {
  if (mode === "mark_blocked" || mode === "mark_deferred") return;
  const expected = expectedPrimaryAckMode(actionType);
  if (mode !== expected) {
    throw new Error(`Action ${actionType} must use ${expected} instead of ${mode}.`);
  }
}

function mapAckModeToProofType(mode: HumanActionExecutionAckMode) {
  switch (mode) {
    case "mark_sent_manually":
      return HumanActionExecutionProofType.MANUAL_SENT;
    case "mark_scheduled_manually":
      return HumanActionExecutionProofType.MANUAL_SCHEDULED;
    case "mark_shared_internally":
      return HumanActionExecutionProofType.MANUAL_SHARED_INTERNAL;
    case "mark_crm_step_done":
      return HumanActionExecutionProofType.MANUAL_CRM_STEP_DONE;
    case "mark_handoff_done":
      return HumanActionExecutionProofType.MANUAL_HANDOFF_DONE;
    case "mark_blocked":
      return HumanActionExecutionProofType.BLOCKED;
    case "mark_deferred":
      return HumanActionExecutionProofType.DEFERRED;
  }
}

function mapAckModeToStatus(mode: HumanActionExecutionAckMode) {
  switch (mode) {
    case "mark_blocked":
      return {
        status: HumanActionExecutionStatus.BLOCKED,
        ack: HumanActionExecutionAckStatus.BLOCKED,
      };
    case "mark_deferred":
      return {
        status: HumanActionExecutionStatus.DEFERRED,
        ack: HumanActionExecutionAckStatus.DEFERRED,
      };
    default:
      return {
        status: HumanActionExecutionStatus.EXECUTED,
        ack: HumanActionExecutionAckStatus.ACKNOWLEDGED,
      };
  }
}

async function writeExecutionWritebacks(input: {
  execution: HumanActionExecutionRuntimeAction;
  workspaceId: string;
  meetingId: string;
  opportunityId?: string | null;
  companyId?: string | null;
  reviewerId: string;
  reviewerName: string;
  mode: HumanActionExecutionAckMode;
  proofPayload: Record<string, unknown>;
  writebackSummary: string;
  acknowledgedAt: Date;
  sourcePage?: string;
}) {
  await writeAuditLog({
    workspaceId: input.workspaceId,
    userId: input.reviewerId,
    actor: input.reviewerName,
    actorType: ActorType.USER,
    actionType: "HELM_V2_HUMAN_ACTION_EXECUTION_ACKNOWLEDGED",
    targetType: "Meeting",
    targetId: input.meetingId,
    summary: input.writebackSummary,
    payload: {
      actionType: input.execution.actionType,
      mode: input.mode,
      sourceArtifactType: input.execution.sourceArtifactType,
      executionOnly: true,
    },
    sourcePage: input.sourcePage ?? `/meetings/${input.meetingId}`,
    relatedObjectType: "Opportunity",
    relatedObjectId: input.opportunityId ?? undefined,
  });

  await db.memoryItem.create({
    data: {
      workspaceId: input.workspaceId,
      meetingId: input.meetingId,
      opportunityId: input.opportunityId ?? undefined,
      companyId: input.companyId ?? undefined,
      objectType: input.opportunityId ? "OPPORTUNITY" : "MEETING",
      objectId: input.opportunityId ?? input.meetingId,
      kind:
        input.execution.actionType === "manual_handoff_delivery" || input.execution.actionType === "manual_handoff_customer_success"
          ? MemoryItemKind.HANDOFF
          : MemoryItemKind.CHECKPOINT,
      scope: MemoryItemScope.OBJECT,
      namespace:
        input.execution.actionType === "manual_handoff_delivery" || input.execution.actionType === "manual_handoff_customer_success"
          ? "handoff"
          : "task",
      status: MemoryItemStatus.PROMOTED,
      verification: MemoryItemVerification.HUMAN_CONFIRMED,
      sensitivity: MemoryItemSensitivity.INTERNAL,
      retention:
        input.execution.actionType === "manual_handoff_delivery" || input.execution.actionType === "manual_handoff_customer_success"
          ? MemoryItemRetention.DAYS_90
          : MemoryItemRetention.DAYS_30,
      promotionRule: MemoryItemPromotionRule.HUMAN_CONFIRMED,
      writer: EXECUTION_HUMAN_WRITER,
      summary: input.writebackSummary,
      payload: jsonStringify({
        proofPayload: input.proofPayload,
        boundary: input.execution.executionBoundary,
        whatThisDoesNotDo: EXECUTION_PROOF_NOTE,
      }),
      sourceProvenance: jsonStringify(input.execution.sourceProvenance),
      evidenceRefs: jsonStringify(input.execution.evidenceRefs),
      confidence: 100,
      confirmedAt: input.acknowledgedAt,
      promotedAt: input.acknowledgedAt,
      lastValidatedAt: input.acknowledgedAt,
    },
  });

  const allActions = await db.humanActionExecution.findMany({
    where: {
      workspaceId: input.workspaceId,
      meetingId: input.meetingId,
    },
    orderBy: [{ executedAt: "desc" }, { updatedAt: "desc" }],
  });

  const runtimeActions = allActions.map((item) => toRuntimeAction(item));
  const lines = runtimeActions.slice(0, 6).map((item) => formatExecutionLine(item));
  const meetingSummary = mergeManagedSection(
    (await db.meeting.findUnique({
      where: { id: input.meetingId },
      select: { postMeetingSummary: true },
    }))?.postMeetingSummary,
    lines,
  );

  await db.meeting.update({
    where: { id: input.meetingId },
    data: {
      postMeetingSummary: meetingSummary,
    },
  });

  let opportunitySummary: string | null = null;
  if (input.opportunityId) {
    const currentOpportunity = await db.opportunity.findUnique({
      where: { id: input.opportunityId },
      select: { nextStepSummary: true },
    });
    opportunitySummary = mergeManagedSection(currentOpportunity?.nextStepSummary, lines);
    await db.opportunity.update({
      where: { id: input.opportunityId },
      data: {
        nextStepSummary: opportunitySummary,
      },
    });
  }

  return {
    meetingSummary,
    opportunitySummary,
  };
}

export async function acknowledgeHumanActionExecution(input: {
  workspaceId: string;
  meetingId: string;
  executionId: string;
  reviewerId: string;
  reviewerName: string;
  mode: HumanActionExecutionAckMode;
  note?: string | null;
  externalReference?: string | null;
  whatWasNotDone?: string | null;
  followThroughStatus?: string | null;
  sourcePage?: string;
}) {
  const row = await db.humanActionExecution.findFirst({
    where: {
      workspaceId: input.workspaceId,
      meetingId: input.meetingId,
      id: input.executionId,
    },
  });

  if (!row) {
    throw new Error("Human action execution record not found.");
  }

  const action = toRuntimeAction(row);
  validateAckMode(action.actionType, input.mode);

  const acknowledgedAt = new Date();
  const { status, ack } = mapAckModeToStatus(input.mode);
  const proofPayload = buildExecutionProofPayload({
    action,
    mode: input.mode,
    note: input.note,
    externalReference: input.externalReference,
    whatWasNotDone: input.whatWasNotDone,
    followThroughStatus: input.followThroughStatus,
    acknowledgedAt,
  });
  const writebackSummary = buildExecutionWritebackSummary({
    action,
    mode: input.mode,
    executedByName: input.reviewerName,
    acknowledgedAt,
    followThroughStatus: input.followThroughStatus,
  });

  await db.humanActionExecution.update({
    where: { id: row.id },
    data: {
      status,
      acknowledgementStatus: ack,
      executionProofType: mapAckModeToProofType(input.mode),
      executionProofPayload: jsonStringify(proofPayload),
      proofNote: input.note?.trim() || null,
      externalReference: input.externalReference?.trim() || null,
      executedByUserId: input.reviewerId,
      executedByName: input.reviewerName,
      executedAt: acknowledgedAt,
      whatWasNotDone: (input.whatWasNotDone?.trim() || buildDefaultWhatWasNotDone(action.actionType)) ?? null,
      followThroughStatus: input.followThroughStatus?.trim() || null,
      writebackSummary,
    },
  });

  const writeback = await writeExecutionWritebacks({
    execution: action,
    workspaceId: input.workspaceId,
    meetingId: input.meetingId,
    opportunityId: row.opportunityId,
    companyId: row.companyId,
    reviewerId: input.reviewerId,
    reviewerName: input.reviewerName,
    mode: input.mode,
    proofPayload,
    writebackSummary,
    acknowledgedAt,
    sourcePage: input.sourcePage,
  });

  await db.humanActionExecution.update({
    where: { id: row.id },
    data: {
      auditLoggedAt: acknowledgedAt,
      checkpointWrittenAt: acknowledgedAt,
      summaryWrittenAt: acknowledgedAt,
      writebackSummary: writebackSummary,
    },
  });

  return {
    ok: true,
    status,
    acknowledgementStatus: ack,
    writebackSummary,
    meetingSummary: writeback.meetingSummary,
    opportunitySummary: writeback.opportunitySummary,
  };
}

export async function getMeetingHumanActionExecutionSummary(
  workspaceId: string,
  meetingId: string,
): Promise<HumanActionExecutionRuntimeSummary | null> {
  const meeting = await loadExecutionMeeting(workspaceId, meetingId);
  if (!meeting) return null;

  const [actions, draftSource, opportunitySource, handoffSources, latestCheckpoint] = await Promise.all([
    db.humanActionExecution.findMany({
      where: {
        workspaceId,
        meetingId,
      },
      orderBy: [{ executedAt: "desc" }, { createdAt: "asc" }],
    }),
    loadApprovedDraftCommsSource(workspaceId, meetingId),
    loadApprovedOpportunityJudgementSource(workspaceId, meetingId),
    loadApprovedHandoffSources(workspaceId, meetingId),
    db.memoryItem.findFirst({
      where: {
        workspaceId,
        meetingId,
        writer: EXECUTION_HUMAN_WRITER,
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        kind: true,
        summary: true,
        createdAt: true,
      },
    }),
  ]);

  if (actions.length === 0 && !draftSource && !opportunitySource && handoffSources.length === 0) {
    return null;
  }

  const runtimeActions = actions.map((item) => toRuntimeAction(item));
  const bundle = buildBundleFromActions(
    runtimeActions.map((item) => ({
      executionIntent: item.executionIntent,
      boundaryTrace: item.boundaryTrace,
    })),
  );

  const executedCount = runtimeActions.filter((item) => item.status === HumanActionExecutionStatus.EXECUTED).length;
  const blockedCount = runtimeActions.filter((item) => item.status === HumanActionExecutionStatus.BLOCKED).length;
  const deferredCount = runtimeActions.filter((item) => item.status === HumanActionExecutionStatus.DEFERRED).length;

  return {
    bundle: {
      ...bundle,
      readyCount: runtimeActions.filter((item) => item.status === HumanActionExecutionStatus.READY).length,
      executedCount,
      blockedCount,
      deferredCount,
      recommendedNextAction:
        runtimeActions.find((item) => item.status === HumanActionExecutionStatus.READY)?.executionIntent ?? bundle.recommendedNextAction,
    },
    approvedSources: {
      draftCommsApproved: Boolean(draftSource),
      opportunityJudgementApproved: Boolean(opportunitySource),
      handoffArtifactsAvailable: handoffSources.length,
    },
    actions: runtimeActions,
    latestWriteback: {
      meetingPostMeetingSummary: meeting.postMeetingSummary,
      opportunityNextStepSummary: meeting.opportunity?.nextStepSummary ?? null,
      latestCheckpoint,
    },
  };
}

export function evaluateSprint5HumanActionExecution(input: {
  contracts: HumanActionExecutionContract[];
  primaryActionType: HumanActionExecutionActionType;
  acknowledgementMode: HumanActionExecutionAckMode;
}) {
  const primary = input.contracts.find((item) => item.actionType === input.primaryActionType);
  if (!primary) {
    return {
      executionPathConsistencyPass: false,
      proofWritebackConsistencyPass: false,
      approvalBoundaryConsistencyPass: false,
      manualAcknowledgementPass: false,
      roleHandoffPass: input.contracts.every((item) => !item.actionType.startsWith("manual_handoff_")),
    } satisfies Sprint5EvaluationResult;
  }

  const executionPathConsistencyPass =
    primary.approvalContext.includes("人工") || primary.approvalContext.includes("manual") || primary.approvalContext.includes("shadow");
  const proofWritebackConsistencyPass =
    primary.executionWritebackTarget.includes("audit_trail") &&
    primary.executionWritebackTarget.includes("checkpoint_memory") &&
    primary.executionWritebackTarget.includes("object_summary");
  const approvalBoundaryConsistencyPass =
    primary.executionBoundary.includes("人工") &&
    primary.executionBoundary.includes("不") &&
    primary.boundaryTrace.some((item) => item.includes("official CRM") || item.includes("send authority"));
  const manualAcknowledgementPass = expectedPrimaryAckMode(primary.actionType) === input.acknowledgementMode;
  const roleHandoffPass = input.contracts
    .filter((item) => item.actionType === "manual_handoff_delivery" || item.actionType === "manual_handoff_customer_success")
    .every((item) => item.executionWritebackTarget.includes("role_handoff_summary"));

  return {
    executionPathConsistencyPass,
    proofWritebackConsistencyPass,
    approvalBoundaryConsistencyPass,
    manualAcknowledgementPass,
    roleHandoffPass,
  } satisfies Sprint5EvaluationResult;
}
