import { ActionType, ActorType, NotificationType, ObjectType } from "@prisma/client";
import { logEvent } from "@/lib/analytics";
import { writeAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { refreshEvolutionState } from "@/lib/evolution/pattern-detection.service";
import { getOperatingSkillCatalog } from "@/lib/operating-system/skill-catalog";
import { safeParseJson } from "@/lib/utils";

type PatternLike = {
  id: string;
  workspaceId: string;
  scopeType: string;
  scopeId: string | null;
  patternType: string;
  patternKey: string;
  patternValue: string;
  confidence: number;
  evidenceCount: number;
  title: string | null;
  summary: string | null;
};

type CandidateCategory = "memory" | "execution" | "governance" | "diagnostics";
type CandidateBoundary = "internal_only" | "draft_only" | "review_required";
type CandidateEffectMode = "read_only" | "draft_only" | "internal_write";
type CandidateSurface =
  | "dashboard"
  | "meetings"
  | "approvals"
  | "opportunities"
  | "settings";
type CapabilityStage = "candidate_skill" | "probationary_skill";
type FormalReviewStatus = "NOT_READY" | "READY" | "QUEUED" | "HARDENING_REQUIRED";
type FormalReviewDecision =
  | "NONE"
  | "APPROVED_PENDING_PROMOTION"
  | "DEFERRED"
  | "REJECTED";

type FormalReviewChecklist = {
  catalogPatchReady: boolean;
  testsReady: boolean;
  guardsReady: boolean;
  docsReady: boolean;
  boundaryConfirmed: boolean;
};

type CandidateBlueprint = {
  key: string;
  name: string;
  category: CandidateCategory;
  boundary: CandidateBoundary;
  effectMode: CandidateEffectMode;
  defaultSurface: CandidateSurface;
  reads: string[];
  writes: string[];
  primaryActionTypes: ActionType[];
  primaryObjectTypes: Array<ObjectType | "WORKSPACE">;
  nonCommitmentNote: string;
  fallbackReason: string;
};

type SkillSuggestionSeed = {
  fingerprint: string;
  suggestionType: string;
  candidateSkillKey: string;
  candidateSkillName: string;
  candidateCategory: CandidateCategory;
  candidateBoundary: CandidateBoundary;
  candidateEffectMode: CandidateEffectMode;
  candidateDefaultSurface: CandidateSurface;
  title: string;
  reason: string;
  confidence: number;
  candidateSpecJson: string;
  evidenceSnapshot: string;
  sourcePatternFactIds: string;
  sourceRecommendationIds: string | null;
  nonCommitmentNote: string;
};

type AcceptedSkillSuggestionLike = {
  id: string;
  workspaceId: string;
  status: string;
  candidateSkillKey: string;
  candidateSkillName: string;
  candidateCategory: string;
  candidateBoundary: string;
  candidateEffectMode: string;
  candidateDefaultSurface: string;
  title: string;
  reason: string;
  confidence: number;
  candidateSpecJson: string;
  evidenceSnapshot: string | null;
  nonCommitmentNote: string;
  appliedTargetId: string | null;
  appliedEffectSummary: string | null;
  formalReviewStatus?: string | null;
  formalReviewQueuedAt?: Date | null;
  formalReviewSummary?: string | null;
  formalReviewDecision?: string | null;
  formalReviewDecisionByName?: string | null;
  formalReviewDecisionAt?: Date | null;
  formalReviewDecisionNote?: string | null;
  formalReviewChecklistJson?: string | null;
};

type PromotionSignal = {
  evidenceCount: number;
  revalidationCount: number;
  adoptionCount: number;
  dismissalCount: number;
  boundaryIncidentCount: number;
  calibrationScore: number;
  stage: CapabilityStage;
  formalReviewReady: boolean;
  formalReviewStatus: FormalReviewStatus;
};

const FORMAL_REVIEW_READY_MARKER = "formal review ready";
const FORMAL_REVIEW_CHECKLIST_KEYS: Array<keyof FormalReviewChecklist> = [
  "catalogPatchReady",
  "testsReady",
  "guardsReady",
  "docsReady",
  "boundaryConfirmed",
];
const EXISTING_SKILL_IDS = new Set<string>(getOperatingSkillCatalog().map((item) => item.id));

const CANDIDATE_BLUEPRINTS: Partial<Record<string, CandidateBlueprint>> = {
  approval_pattern: {
    key: "external-commitment-review-buffer",
    name: "外部承诺复核缓冲包",
    category: "governance",
    boundary: "review_required",
    effectMode: "draft_only",
    defaultSurface: "approvals",
    reads: ["policyRules", "recommendationLogs", "emailThreads", "memoryFacts"],
    writes: ["approvalTasks", "draftContent", "auditLogs"],
    primaryActionTypes: [ActionType.DRAFT_EXTERNAL_EMAIL, ActionType.GENERATE_REPLY_DRAFT],
    primaryObjectTypes: [ObjectType.CONTACT, ObjectType.COMPANY, ObjectType.OPPORTUNITY],
    nonCommitmentNote:
      "这只是一条复核优先 的候选能力，用来帮助人更稳地复核外部承诺类草稿，不代表 Helm 获得自动对外发送或自动承诺权限。",
    fallbackReason:
      "系统观察到外部承诺类动作持续保留人工审批，值得把这条复核姿态收成候选能力继续观察。",
  },
  communication_style_pattern: {
    key: "concise-followup-tone-pack",
    name: "简洁外发语气包",
    category: "execution",
    boundary: "draft_only",
    effectMode: "draft_only",
    defaultSurface: "approvals",
    reads: ["contact", "company", "emailThreads", "memoryFacts"],
    writes: ["draftContent", "approvalTasks", "auditLogs"],
    primaryActionTypes: [ActionType.DRAFT_EXTERNAL_EMAIL, ActionType.GENERATE_REPLY_DRAFT],
    primaryObjectTypes: [ObjectType.CONTACT, ObjectType.COMPANY, ObjectType.OPPORTUNITY],
    nonCommitmentNote:
      "这只是一条仅草稿的候选能力，用来偏向更简洁的外发草稿，不代表 Helm 可以绕过复核或直接替人发出外部消息。",
    fallbackReason:
      "系统观察到你更偏好简洁直接的外发文案，值得把这类草稿风格收成候选能力继续观察。",
  },
  followup_timing_pattern: {
    key: "meeting-followup-window-pack",
    name: "会后跟进窗口包",
    category: "execution",
    boundary: "review_required",
    effectMode: "internal_write",
    defaultSurface: "meetings",
    reads: ["meetingNote", "memoryFacts", "commitments", "blockers"],
    writes: ["actionItems", "approvalTasks", "auditLogs"],
    primaryActionTypes: [ActionType.CREATE_TASK, ActionType.ASSIGN_OWNER, ActionType.SEND_MEETING_SUMMARY],
    primaryObjectTypes: [ObjectType.MEETING, ObjectType.OPPORTUNITY],
    nonCommitmentNote:
      "这只是一条复核优先 的候选能力，用来把会后 24 小时窗口内更有效的推进姿态沉淀出来，不代表 Helm 自动生成外部承诺或替人决定下一步。",
    fallbackReason:
      "系统观察到会后 24 小时窗口的跟进行动更容易被采纳，值得把这条节奏沉淀为候选能力。",
  },
  blocker_pattern: {
    key: "budget-blocker-clarification-pack",
    name: "预算阻塞澄清包",
    category: "execution",
    boundary: "draft_only",
    effectMode: "draft_only",
    defaultSurface: "opportunities",
    reads: ["opportunity", "blockers", "memoryFacts", "meetings"],
    writes: ["draftContent", "actionItems", "auditLogs"],
    primaryActionTypes: [ActionType.CREATE_TASK, ActionType.DRAFT_EXTERNAL_EMAIL],
    primaryObjectTypes: [ObjectType.OPPORTUNITY, ObjectType.COMPANY],
    nonCommitmentNote:
      "这只是一条仅草稿的候选能力，用来把预算阻塞澄清、补材料和下一步建议写成可复核草稿，不代表 Helm 获得报价承诺或付款承诺权限。",
    fallbackReason:
      "系统观察到预算相关阻塞正在变成高频模式，值得把澄清与补位动作沉淀为候选能力。",
  },
  stalled_opportunity_pattern: {
    key: "stalled-opportunity-recovery-pack",
    name: "停滞机会恢复包",
    category: "execution",
    boundary: "review_required",
    effectMode: "internal_write",
    defaultSurface: "opportunities",
    reads: ["opportunity", "commitments", "blockers", "meetings", "memoryFacts"],
    writes: ["recommendationLogs", "actionItems", "auditLogs"],
    primaryActionTypes: [ActionType.CREATE_TASK, ActionType.ASSIGN_OWNER, ActionType.CHANGE_DUE_DATE],
    primaryObjectTypes: [ObjectType.OPPORTUNITY, ObjectType.COMPANY],
    nonCommitmentNote:
      "这只是一条复核优先 的候选能力，用来恢复停滞机会的内部推进，不代表 Helm 可以自动改阶段、自动承诺对外结果或自动写回高风险状态。",
    fallbackReason:
      "系统观察到停滞机会更容易掉速，值得把恢复动作沉淀为候选能力。",
  },
  contact_cooling_pattern: {
    key: "relationship-rewarm-pack",
    name: "关系回温包",
    category: "execution",
    boundary: "draft_only",
    effectMode: "draft_only",
    defaultSurface: "dashboard",
    reads: ["contact", "company", "emailThreads", "memoryFacts", "meetings"],
    writes: ["recommendationLogs", "draftContent", "auditLogs"],
    primaryActionTypes: [ActionType.DRAFT_EXTERNAL_EMAIL, ActionType.CREATE_MEETING],
    primaryObjectTypes: [ObjectType.CONTACT, ObjectType.COMPANY],
    nonCommitmentNote:
      "这只是一条仅草稿的候选能力，用来帮助关系回温和低阻力恢复触达，不代表 Helm 获得对外发送权限或替人决定承诺内容。",
    fallbackReason:
      "系统观察到关系超过 7 天未触达时更容易降温，值得把回温动作沉淀为候选能力。",
  },
};

function getSkillCapabilityKey(workspaceId: string, candidateSkillKey: string) {
  return `${workspaceId}:candidate-skill:${candidateSkillKey}`;
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function uniqueText(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))),
  );
}

function createCandidateSpec(blueprint: CandidateBlueprint, patterns: PatternLike[]) {
  return JSON.stringify({
    reads: blueprint.reads,
    writes: blueprint.writes,
    resourceBindings: ["current_workspace", `surface:${blueprint.defaultSurface}`],
    primaryActionTypes: blueprint.primaryActionTypes,
    primaryObjectTypes: blueprint.primaryObjectTypes,
    sourcePatternTitles: uniqueText(patterns.map((pattern) => pattern.title ?? pattern.summary ?? pattern.patternType)),
    operatorReviewChecklist: [
      "确认这条能力仍然只是复核优先 / 非承诺的候选层。",
      "确认写入范围仍然只覆盖草稿、内部记录或审批入口。",
      "确认它还不需要进入正式静态能力目录。",
      "确认默认面与当前操作员工作流一致。",
    ],
  });
}

function createEvidenceSnapshot(patterns: PatternLike[], confidence: number) {
  return JSON.stringify({
    patternIds: patterns.map((pattern) => pattern.id),
    patternTypes: Array.from(new Set(patterns.map((pattern) => pattern.patternType))),
    patternKeys: Array.from(new Set(patterns.map((pattern) => pattern.patternKey))),
    patternValues: Array.from(new Set(patterns.map((pattern) => pattern.patternValue))),
    titles: uniqueText(patterns.map((pattern) => pattern.title ?? pattern.summary ?? pattern.patternType)),
    summaries: uniqueText(patterns.map((pattern) => pattern.summary)),
    evidenceCount: patterns.reduce((total, pattern) => total + pattern.evidenceCount, 0),
    confidence,
  });
}

function createReason(blueprint: CandidateBlueprint, patterns: PatternLike[]) {
  const lines = uniqueText(patterns.map((pattern) => pattern.summary));
  return lines.length ? lines.join(" ") : blueprint.fallbackReason;
}

function normalizeFormalReviewStatus(value: string | null | undefined): FormalReviewStatus {
  switch (value) {
    case "READY":
    case "QUEUED":
    case "HARDENING_REQUIRED":
      return value;
    default:
      return "NOT_READY";
  }
}

function resolveFormalReviewStatus(
  current: FormalReviewStatus,
  formalReviewReady: boolean,
): FormalReviewStatus {
  if (current === "QUEUED") return "QUEUED";
  if (current === "HARDENING_REQUIRED") {
    return formalReviewReady ? "READY" : "HARDENING_REQUIRED";
  }
  return formalReviewReady ? "READY" : "NOT_READY";
}

function normalizeFormalReviewDecision(value: string | null | undefined): FormalReviewDecision {
  switch (value) {
    case "APPROVED_PENDING_PROMOTION":
    case "DEFERRED":
    case "REJECTED":
      return value;
    default:
      return "NONE";
  }
}

function createDefaultFormalReviewChecklist(): FormalReviewChecklist {
  return {
    catalogPatchReady: false,
    testsReady: false,
    guardsReady: false,
    docsReady: false,
    boundaryConfirmed: false,
  };
}

function parseFormalReviewChecklist(value: string | null | undefined): FormalReviewChecklist {
  const raw = safeParseJson<Partial<Record<keyof FormalReviewChecklist, unknown>>>(
    value,
    createDefaultFormalReviewChecklist(),
  );
  const next = createDefaultFormalReviewChecklist();
  for (const key of FORMAL_REVIEW_CHECKLIST_KEYS) {
    next[key] = raw[key] === true;
  }
  return next;
}

function serializeFormalReviewChecklist(checklist: FormalReviewChecklist) {
  return JSON.stringify({
    catalogPatchReady: checklist.catalogPatchReady,
    testsReady: checklist.testsReady,
    guardsReady: checklist.guardsReady,
    docsReady: checklist.docsReady,
    boundaryConfirmed: checklist.boundaryConfirmed,
  });
}

function isFormalReviewChecklistComplete(checklist: FormalReviewChecklist) {
  return FORMAL_REVIEW_CHECKLIST_KEYS.every((key) => checklist[key]);
}

function summarizeFormalReviewChecklist(checklist: FormalReviewChecklist) {
  const ready: string[] = [];
  if (checklist.catalogPatchReady) ready.push("catalog");
  if (checklist.testsReady) ready.push("tests");
  if (checklist.guardsReady) ready.push("guards");
  if (checklist.docsReady) ready.push("docs");
  if (checklist.boundaryConfirmed) ready.push("boundary");
  return ready.length > 0 ? ready.join(" / ") : "none";
}

async function buildSuggestionSeeds(input: {
  workspaceId: string;
  patterns: PatternLike[];
}): Promise<SkillSuggestionSeed[]> {
  const buckets = new Map<string, { blueprint: CandidateBlueprint; patterns: PatternLike[] }>();

  for (const pattern of input.patterns) {
    const blueprint = CANDIDATE_BLUEPRINTS[pattern.patternType];
    if (!blueprint) continue;
    if (pattern.confidence < 70) continue;
    if (EXISTING_SKILL_IDS.has(blueprint.key)) continue;

    const fingerprint = `${input.workspaceId}:skill-candidate:${blueprint.key}`;
    const existing = buckets.get(fingerprint) ?? { blueprint, patterns: [] };
    existing.patterns.push(pattern);
    buckets.set(fingerprint, existing);
  }

  const seeds: SkillSuggestionSeed[] = [];
  for (const [fingerprint, bucket] of buckets.entries()) {
    const confidence = clamp(
      Math.max(...bucket.patterns.map((pattern) => pattern.confidence)) +
        Math.min(6, bucket.patterns.length * 2),
    );
    const evidenceSnapshot = createEvidenceSnapshot(bucket.patterns, confidence);
    const reason = createReason(bucket.blueprint, bucket.patterns);

    seeds.push({
      fingerprint,
      suggestionType: "NEW_SKILL_CANDIDATE",
      candidateSkillKey: bucket.blueprint.key,
      candidateSkillName: bucket.blueprint.name,
      candidateCategory: bucket.blueprint.category,
      candidateBoundary: bucket.blueprint.boundary,
      candidateEffectMode: bucket.blueprint.effectMode,
      candidateDefaultSurface: bucket.blueprint.defaultSurface,
      title: `建议把“${bucket.blueprint.name}”收成候选能力`,
      reason,
      confidence,
      candidateSpecJson: createCandidateSpec(bucket.blueprint, bucket.patterns),
      evidenceSnapshot,
      sourcePatternFactIds: JSON.stringify(bucket.patterns.map((pattern) => pattern.id)),
      sourceRecommendationIds: null,
      nonCommitmentNote: bucket.blueprint.nonCommitmentNote,
    });
  }

  return seeds;
}

async function getPromotionSignal(
  suggestion: Pick<
    AcceptedSkillSuggestionLike,
    "id" | "workspaceId" | "confidence" | "evidenceSnapshot" | "formalReviewStatus"
  >,
): Promise<PromotionSignal> {
  const evidence = safeParseJson<{ evidenceCount?: number }>(suggestion.evidenceSnapshot, {});
  const evidenceCount =
    typeof evidence.evidenceCount === "number" && Number.isFinite(evidence.evidenceCount)
      ? evidence.evidenceCount
      : 0;
  const [revalidationCount, adoptionCount, dismissalCount, boundaryIncidentCount] = await Promise.all([
    db.eventLog.count({
      where: {
        workspaceId: suggestion.workspaceId,
        targetType: "SkillSuggestion",
        targetId: suggestion.id,
        eventName: {
          in: ["skill_suggestion_created", "skill_suggestion_updated"],
        },
      },
    }),
    db.eventLog.count({
      where: {
        workspaceId: suggestion.workspaceId,
        targetType: "SkillSuggestion",
        targetId: suggestion.id,
        eventName: "skill_suggestion_accepted",
      },
    }),
    db.eventLog.count({
      where: {
        workspaceId: suggestion.workspaceId,
        targetType: "SkillSuggestion",
        targetId: suggestion.id,
        eventName: "skill_suggestion_dismissed",
      },
    }),
    db.eventLog.count({
      where: {
        workspaceId: suggestion.workspaceId,
        targetType: "SkillSuggestion",
        targetId: suggestion.id,
        eventName: {
          in: ["skill_formal_review_returned", "skill_formal_review_rejected"],
        },
      },
    }),
  ]);

  const calibrationScore = clamp(
    suggestion.confidence * 0.55 +
      Math.min(24, evidenceCount * 3) +
      Math.min(24, Math.max(0, revalidationCount - 1) * 6) +
      Math.min(8, adoptionCount * 8) -
      Math.min(12, dismissalCount * 12) -
      Math.min(18, boundaryIncidentCount * 14),
  );
  const stage: CapabilityStage =
    calibrationScore >= 72 &&
    evidenceCount >= 6 &&
    revalidationCount >= 2 &&
    adoptionCount >= 1
      ? "probationary_skill"
      : "candidate_skill";
  const formalReviewReady =
    stage === "probationary_skill" &&
    calibrationScore >= 88 &&
    evidenceCount >= 8 &&
    revalidationCount >= 3;
  const formalReviewStatus = resolveFormalReviewStatus(
    normalizeFormalReviewStatus(suggestion.formalReviewStatus),
    formalReviewReady,
  );

  return {
    evidenceCount,
    revalidationCount,
    adoptionCount,
    dismissalCount,
    boundaryIncidentCount,
    calibrationScore,
    stage,
    formalReviewReady,
    formalReviewStatus,
  };
}

function getStageLabel(stage: CapabilityStage) {
  return stage === "probationary_skill" ? "观察期能力" : "候选能力";
}

function buildCapabilityDescription(suggestion: AcceptedSkillSuggestionLike, signal: PromotionSignal) {
  return `${suggestion.reason} 当前按${getStageLabel(signal.stage)}方式沉淀，类别 ${suggestion.candidateCategory}，默认面为 ${suggestion.candidateDefaultSurface}。校准分 ${signal.calibrationScore}，证据 ${signal.evidenceCount}，持续复现 ${signal.revalidationCount}。`;
}

function buildCapabilityBoundaryNote(suggestion: AcceptedSkillSuggestionLike, signal: PromotionSignal) {
  const stageLine =
    signal.stage === "probationary_skill"
      ? "这条能力已经进入观察期能力层，会继续积累证据和复核备注。"
      : "这条能力目前仍停留在候选能力层，只作为复核优先的候选能力观察。";
  const calibrationLine = `当前校准信号：采纳 ${signal.adoptionCount}、驳回 ${signal.dismissalCount}、边界事件 ${signal.boundaryIncidentCount}。`;
  const decision = normalizeFormalReviewDecision(suggestion.formalReviewDecision);
  const reviewLine =
    decision === "APPROVED_PENDING_PROMOTION"
      ? "它已经通过正式复核，但仍只是待晋升批准状态，必须人工补静态能力目录、测试、守卫和文档后才可能成为正式能力。"
      : decision === "DEFERRED"
        ? "它已被正式复核暂缓，当前仍停留在人工治理层，等待复核人重新入队或补充前置材料。"
        : decision === "REJECTED"
          ? "它已被正式复核拒绝，当前不会自动进入正式晋升，也不会因此获得任何执行权限。"
      : signal.formalReviewStatus === "QUEUED"
      ? "它已经进入正式复核队列，但仍然只是人工评审项，不代表已经成为正式系统能力。"
      : signal.formalReviewStatus === "HARDENING_REQUIRED"
        ? "它曾被正式复核退回加固，会继续在候选/观察层积累证据与边界说明。"
        : signal.formalReviewReady
          ? "它已达到正式复核就绪状态，但仍需要人工补静态能力目录、测试、守卫和文档后才能成为正式系统能力。"
          : "它还没有进入正式复核队列，也不会自动获得路由、发送、承诺或正式写入权限。";
  const formalLine = signal.formalReviewReady
    ? `当前已达到 ${FORMAL_REVIEW_READY_MARKER} 判断阈值。`
    : "当前仍未达到正式复核就绪阈值。";

  return `${stageLine} ${calibrationLine} ${suggestion.nonCommitmentNote} ${reviewLine} ${formalLine}`;
}

function buildAppliedEffectSummary(skillName: string, signal: PromotionSignal) {
  const base =
    signal.stage === "probationary_skill"
      ? `已把“${skillName}”提升为观察期能力，会继续积累证据但仍不进入正式能力目录或执行路由。`
      : `已把“${skillName}”收口为复核优先的候选能力，会继续积累证据但不会自动变成正式能力。`;

  const calibration = `当前校准分 ${signal.calibrationScore}，复现 ${signal.revalidationCount} 次，边界事件 ${signal.boundaryIncidentCount} 次。`;
  return signal.formalReviewReady
    ? `${base} ${calibration} 当前已达到 ${FORMAL_REVIEW_READY_MARKER} 状态，但仍需要人工写入静态能力目录、测试和文档。`
    : `${base} ${calibration}`;
}

function buildFormalReviewSummary(
  skillName: string,
  signal: PromotionSignal,
  decision: FormalReviewDecision = "NONE",
) {
  if (decision === "APPROVED_PENDING_PROMOTION") {
    return `“${skillName}”已通过正式复核，当前只进入待晋升批准状态，仍需人工补静态能力目录、测试、守卫和文档。`;
  }
  if (decision === "DEFERRED") {
    return `“${skillName}”已被正式复核暂缓，当前保留在人工治理层，等待复核人重新入队或补充说明。`;
  }
  if (decision === "REJECTED") {
    return `“${skillName}”已被正式复核拒绝，当前不会进入正式能力晋升，需要后续重新判断是否值得再入队。`;
  }
  if (signal.formalReviewStatus === "QUEUED") {
    return `“${skillName}”已进入正式复核队列，下一步仍是人工决定是否补能力目录、测试、守卫和文档。`;
  }
  if (signal.formalReviewStatus === "HARDENING_REQUIRED") {
    return `“${skillName}”已从正式复核返回加固，会继续记录边界事件并在证据更稳后重新进入队列。`;
  }
  if (signal.formalReviewReady) {
    return `“${skillName}”已达到 ${FORMAL_REVIEW_READY_MARKER}，可以进入人工正式复核队列，但仍不是正式能力。`;
  }
  return `“${skillName}”当前仍在${getStageLabel(signal.stage)}校准期，暂未进入正式复核队列。`;
}

async function reconcileAcceptedSkillCapability(input: {
  workspaceId: string;
  suggestion: AcceptedSkillSuggestionLike;
}) {
  const capabilityKey = getSkillCapabilityKey(input.workspaceId, input.suggestion.candidateSkillKey);
  const existing = await db.capabilityCatalogEntry.findUnique({
    where: { capabilityKey },
  });
  const desired = await getPromotionSignal(input.suggestion);
  const nextStage: CapabilityStage =
    existing?.stage === "probationary_skill" ? "probationary_skill" : desired.stage;
  const nextSignal = {
    ...desired,
    stage: nextStage,
  };

  const entry = await db.capabilityCatalogEntry.upsert({
    where: { capabilityKey },
    update: {
      name: input.suggestion.candidateSkillName,
      stage: nextSignal.stage,
      description: buildCapabilityDescription(input.suggestion, nextSignal),
      loadPolicy: "on_demand",
      reviewRequired: true,
      boundaryNote: buildCapabilityBoundaryNote(input.suggestion, nextSignal),
    },
    create: {
      workspaceId: input.workspaceId,
      capabilityKey,
      name: input.suggestion.candidateSkillName,
      stage: nextSignal.stage,
      description: buildCapabilityDescription(input.suggestion, nextSignal),
      loadPolicy: "on_demand",
      reviewRequired: true,
      boundaryNote: buildCapabilityBoundaryNote(input.suggestion, nextSignal),
    },
  });

  if (existing && existing.stage !== entry.stage) {
    await writeAuditLog({
      workspaceId: input.workspaceId,
      actor: "Adaptive Evolution",
      actorType: ActorType.SYSTEM,
      actionType: "SKILL_CAPABILITY_PROMOTED",
      targetType: "CapabilityCatalogEntry",
      targetId: entry.id,
      summary: `候选能力晋级：${entry.name}`,
      payload: {
        capabilityKey,
        previousStage: existing.stage,
        nextStage: entry.stage,
        evidenceCount: nextSignal.evidenceCount,
        confidence: input.suggestion.confidence,
      },
      sourcePage: "/settings",
    });

    await logEvent({
      workspaceId: input.workspaceId,
      eventName: "skill_capability_promoted",
      eventCategory: "evolution",
      targetType: "CapabilityCatalogEntry",
      targetId: entry.id,
      metadata: {
        capabilityKey,
        previousStage: existing.stage,
        nextStage: entry.stage,
      },
      sourcePage: "/settings",
    });
  }

  const nextSummary = buildAppliedEffectSummary(input.suggestion.candidateSkillName, nextSignal);
  const nextFormalReviewSummary = buildFormalReviewSummary(
    input.suggestion.candidateSkillName,
    nextSignal,
    normalizeFormalReviewDecision(input.suggestion.formalReviewDecision),
  );
  if (
    input.suggestion.appliedTargetId !== entry.id ||
    input.suggestion.appliedEffectSummary !== nextSummary ||
    normalizeFormalReviewStatus(input.suggestion.formalReviewStatus) !== nextSignal.formalReviewStatus ||
    input.suggestion.formalReviewSummary !== nextFormalReviewSummary
  ) {
    await db.skillSuggestion.update({
      where: { id: input.suggestion.id },
      data: {
        appliedTargetType: "CapabilityCatalogEntry",
        appliedTargetId: entry.id,
        appliedEffectSummary: nextSummary,
        formalReviewStatus: nextSignal.formalReviewStatus,
        formalReviewSummary: nextFormalReviewSummary,
      },
    });
  }

  return {
    entry,
    summary: nextSummary,
    stage: entry.stage,
    formalReviewReady: nextSignal.formalReviewReady,
  };
}

export async function syncSkillSuggestions(input: {
  workspaceId: string;
  patterns: PatternLike[];
}) {
  const seeds = await buildSuggestionSeeds(input);
  const seen = new Set(seeds.map((seed) => seed.fingerprint));
  const existingOpen = await db.skillSuggestion.findMany({
    where: {
      workspaceId: input.workspaceId,
      status: "OPEN",
    },
  });
  const results = [];

  for (const seed of seeds) {
    const existing = await db.skillSuggestion.findUnique({
      where: { fingerprint: seed.fingerprint },
    });
    const changed =
      !existing ||
      existing.title !== seed.title ||
      existing.reason !== seed.reason ||
      existing.confidence !== seed.confidence ||
      existing.candidateSpecJson !== seed.candidateSpecJson ||
      existing.candidateBoundary !== seed.candidateBoundary ||
      existing.candidateEffectMode !== seed.candidateEffectMode ||
      existing.candidateDefaultSurface !== seed.candidateDefaultSurface ||
      existing.evidenceSnapshot !== seed.evidenceSnapshot;

    const nextStatus =
      existing?.status === "EXPIRED"
        ? "OPEN"
        : existing?.status ?? "OPEN";

    const suggestion = existing
      ? await db.skillSuggestion.update({
          where: { id: existing.id },
          data: {
            suggestionType: seed.suggestionType,
            candidateSkillKey: seed.candidateSkillKey,
            candidateSkillName: seed.candidateSkillName,
            candidateCategory: seed.candidateCategory,
            candidateBoundary: seed.candidateBoundary,
            candidateEffectMode: seed.candidateEffectMode,
            candidateDefaultSurface: seed.candidateDefaultSurface,
            title: seed.title,
            reason: seed.reason,
            confidence: seed.confidence,
            candidateSpecJson: seed.candidateSpecJson,
            evidenceSnapshot: seed.evidenceSnapshot,
            sourcePatternFactIds: seed.sourcePatternFactIds,
            sourceRecommendationIds: seed.sourceRecommendationIds ?? undefined,
            nonCommitmentNote: seed.nonCommitmentNote,
            status: nextStatus,
          },
        })
      : await db.skillSuggestion.create({
          data: {
            workspaceId: input.workspaceId,
            fingerprint: seed.fingerprint,
            suggestionType: seed.suggestionType,
            candidateSkillKey: seed.candidateSkillKey,
            candidateSkillName: seed.candidateSkillName,
            candidateCategory: seed.candidateCategory,
            candidateBoundary: seed.candidateBoundary,
            candidateEffectMode: seed.candidateEffectMode,
            candidateDefaultSurface: seed.candidateDefaultSurface,
            title: seed.title,
            reason: seed.reason,
            confidence: seed.confidence,
            candidateSpecJson: seed.candidateSpecJson,
            evidenceSnapshot: seed.evidenceSnapshot,
            sourcePatternFactIds: seed.sourcePatternFactIds,
            sourceRecommendationIds: seed.sourceRecommendationIds ?? undefined,
            nonCommitmentNote: seed.nonCommitmentNote,
          },
        });

    if (changed) {
      await writeAuditLog({
        workspaceId: input.workspaceId,
        actor: "Adaptive Evolution",
        actorType: ActorType.SYSTEM,
        actionType: existing ? "SKILL_SUGGESTION_UPDATED" : "SKILL_SUGGESTION_CREATED",
        targetType: "SkillSuggestion",
        targetId: suggestion.id,
        summary: suggestion.title,
        payload: {
          candidateSkillKey: suggestion.candidateSkillKey,
          candidateBoundary: suggestion.candidateBoundary,
          candidateEffectMode: suggestion.candidateEffectMode,
          confidence: suggestion.confidence,
        },
        sourcePage: "/settings",
      });

      await logEvent({
        workspaceId: input.workspaceId,
        eventName: existing ? "skill_suggestion_updated" : "skill_suggestion_created",
        eventCategory: "evolution",
        targetType: "SkillSuggestion",
        targetId: suggestion.id,
        metadata: {
          candidateSkillKey: suggestion.candidateSkillKey,
          candidateBoundary: suggestion.candidateBoundary,
          candidateEffectMode: suggestion.candidateEffectMode,
          confidence: suggestion.confidence,
        },
        sourcePage: "/settings",
      });
    }

    if (suggestion.status === "ACCEPTED") {
      await reconcileAcceptedSkillCapability({
        workspaceId: input.workspaceId,
        suggestion,
      });
    }

    results.push(suggestion);
  }

  for (const suggestion of existingOpen) {
    if (seen.has(suggestion.fingerprint)) continue;
    await db.skillSuggestion.update({
      where: { id: suggestion.id },
      data: { status: "EXPIRED" },
    });
  }

  return results;
}

export async function listSkillSuggestions(workspaceId: string, status?: string) {
  return db.skillSuggestion.findMany({
    where: {
      workspaceId,
      ...(status ? { status } : {}),
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
}

export async function getOpenSkillSuggestions(workspaceId: string) {
  return db.skillSuggestion.findMany({
    where: {
      workspaceId,
      status: "OPEN",
    },
    orderBy: [{ confidence: "desc" }, { createdAt: "desc" }],
    take: 6,
  });
}

export async function getRecentSkillAdoptions(workspaceId: string, limit = 4) {
  const suggestions = await db.skillSuggestion.findMany({
    where: {
      workspaceId,
      status: "ACCEPTED",
      appliedAt: { not: null },
    },
    select: {
      id: true,
      title: true,
      candidateSkillKey: true,
      candidateSkillName: true,
      confidence: true,
      evidenceSnapshot: true,
      appliedEffectSummary: true,
      appliedAt: true,
      confirmedAt: true,
      formalReviewStatus: true,
      formalReviewQueuedAt: true,
      formalReviewSummary: true,
      formalReviewDecision: true,
      formalReviewDecisionByName: true,
      formalReviewDecisionAt: true,
      formalReviewDecisionNote: true,
      formalReviewChecklistJson: true,
    },
    orderBy: [{ appliedAt: "desc" }, { confirmedAt: "desc" }],
    take: limit,
  });

  const capabilityKeys = suggestions.map((item) => getSkillCapabilityKey(workspaceId, item.candidateSkillKey));
  const capabilityEntries = capabilityKeys.length
    ? await db.capabilityCatalogEntry.findMany({
        where: {
          workspaceId,
          capabilityKey: {
            in: capabilityKeys,
          },
        },
      })
    : [];
  const capabilityMap = new Map(capabilityEntries.map((entry) => [entry.capabilityKey, entry]));

  return Promise.all(suggestions.map(async (item) => {
    const capability = capabilityMap.get(getSkillCapabilityKey(workspaceId, item.candidateSkillKey));
    const signal = await getPromotionSignal({
      id: item.id,
      workspaceId,
      confidence: item.confidence,
      evidenceSnapshot: item.evidenceSnapshot,
      formalReviewStatus: item.formalReviewStatus,
    });
    return {
      ...item,
      capabilityStage: capability?.stage ?? "candidate_skill",
      formalPromotionReady: signal.formalReviewReady,
      formalReviewStatus: signal.formalReviewStatus,
      formalReviewSummary: item.formalReviewSummary,
      formalReviewQueuedAt: item.formalReviewQueuedAt,
      formalReviewDecision: normalizeFormalReviewDecision(item.formalReviewDecision),
      formalReviewDecisionByName: item.formalReviewDecisionByName,
      formalReviewDecisionAt: item.formalReviewDecisionAt,
      formalReviewDecisionNote: item.formalReviewDecisionNote,
      formalReviewChecklist: parseFormalReviewChecklist(item.formalReviewChecklistJson),
      calibrationScore: signal.calibrationScore,
      evidenceCount: signal.evidenceCount,
      revalidationCount: signal.revalidationCount,
      adoptionCount: signal.adoptionCount,
      dismissalCount: signal.dismissalCount,
      boundaryIncidentCount: signal.boundaryIncidentCount,
    };
  }));
}

async function createCandidateCapability(input: {
  workspaceId: string;
  suggestion: AcceptedSkillSuggestionLike;
}) {
  const capabilityKey = getSkillCapabilityKey(input.workspaceId, input.suggestion.candidateSkillKey);
  const baseSignal = await getPromotionSignal(input.suggestion);
  const signal: PromotionSignal = {
    ...baseSignal,
    stage: "candidate_skill",
    formalReviewReady: false,
    formalReviewStatus: "NOT_READY",
  };

  const entry = await db.capabilityCatalogEntry.upsert({
    where: { capabilityKey },
    update: {
      name: input.suggestion.candidateSkillName,
      stage: "candidate_skill",
      description: buildCapabilityDescription(input.suggestion, signal),
      loadPolicy: "on_demand",
      reviewRequired: true,
      boundaryNote: buildCapabilityBoundaryNote(input.suggestion, signal),
    },
    create: {
      workspaceId: input.workspaceId,
      capabilityKey,
      name: input.suggestion.candidateSkillName,
      stage: "candidate_skill",
      description: buildCapabilityDescription(input.suggestion, signal),
      loadPolicy: "on_demand",
      reviewRequired: true,
      boundaryNote: buildCapabilityBoundaryNote(input.suggestion, signal),
    },
  });

  return {
    entry,
    summary: buildAppliedEffectSummary(input.suggestion.candidateSkillName, signal),
  };
}

export async function getFormalSkillReviewQueue(workspaceId: string, limit = 6) {
  const suggestions = await db.skillSuggestion.findMany({
    where: {
      workspaceId,
      status: "ACCEPTED",
      formalReviewDecision: "NONE",
      formalReviewStatus: {
        in: ["READY", "QUEUED", "HARDENING_REQUIRED"],
      },
    },
    select: {
      id: true,
      workspaceId: true,
      title: true,
      candidateSkillKey: true,
      candidateSkillName: true,
      confidence: true,
      evidenceSnapshot: true,
      appliedEffectSummary: true,
      appliedAt: true,
      confirmedAt: true,
      formalReviewStatus: true,
      formalReviewQueuedAt: true,
      formalReviewSummary: true,
      formalReviewDecision: true,
      formalReviewDecisionByName: true,
      formalReviewDecisionAt: true,
      formalReviewDecisionNote: true,
      formalReviewChecklistJson: true,
    },
    orderBy: [{ formalReviewQueuedAt: "desc" }, { appliedAt: "desc" }, { confirmedAt: "desc" }],
    take: limit,
  });

  const capabilityKeys = suggestions.map((item) => getSkillCapabilityKey(workspaceId, item.candidateSkillKey));
  const capabilityEntries = capabilityKeys.length
    ? await db.capabilityCatalogEntry.findMany({
        where: {
          workspaceId,
          capabilityKey: {
            in: capabilityKeys,
          },
        },
      })
    : [];
  const capabilityMap = new Map(capabilityEntries.map((entry) => [entry.capabilityKey, entry]));

  return Promise.all(
    suggestions.map(async (item) => {
      const signal = await getPromotionSignal(item);
      const capability = capabilityMap.get(getSkillCapabilityKey(workspaceId, item.candidateSkillKey));
      return {
        ...item,
        capabilityStage: capability?.stage ?? signal.stage,
        formalPromotionReady: signal.formalReviewReady,
        calibrationScore: signal.calibrationScore,
        evidenceCount: signal.evidenceCount,
        revalidationCount: signal.revalidationCount,
        adoptionCount: signal.adoptionCount,
        dismissalCount: signal.dismissalCount,
        boundaryIncidentCount: signal.boundaryIncidentCount,
        formalReviewStatus: signal.formalReviewStatus,
        formalReviewDecision: normalizeFormalReviewDecision(item.formalReviewDecision),
        formalReviewDecisionByName: item.formalReviewDecisionByName,
        formalReviewDecisionAt: item.formalReviewDecisionAt,
        formalReviewDecisionNote: item.formalReviewDecisionNote,
        formalReviewChecklist: parseFormalReviewChecklist(item.formalReviewChecklistJson),
      };
    }),
  );
}

export async function getRecentFormalReviewDecisions(workspaceId: string, limit = 6) {
  const suggestions = await db.skillSuggestion.findMany({
    where: {
      workspaceId,
      status: "ACCEPTED",
      formalReviewDecision: {
        in: ["APPROVED_PENDING_PROMOTION", "DEFERRED", "REJECTED"],
      },
    },
    select: {
      id: true,
      workspaceId: true,
      title: true,
      candidateSkillKey: true,
      candidateSkillName: true,
      confidence: true,
      evidenceSnapshot: true,
      appliedEffectSummary: true,
      appliedAt: true,
      confirmedAt: true,
      formalReviewStatus: true,
      formalReviewQueuedAt: true,
      formalReviewSummary: true,
      formalReviewDecision: true,
      formalReviewDecisionByName: true,
      formalReviewDecisionAt: true,
      formalReviewDecisionNote: true,
      formalReviewChecklistJson: true,
    },
    orderBy: [{ formalReviewDecisionAt: "desc" }, { updatedAt: "desc" }],
    take: limit,
  });

  const capabilityKeys = suggestions.map((item) => getSkillCapabilityKey(workspaceId, item.candidateSkillKey));
  const capabilityEntries = capabilityKeys.length
    ? await db.capabilityCatalogEntry.findMany({
        where: {
          workspaceId,
          capabilityKey: {
            in: capabilityKeys,
          },
        },
      })
    : [];
  const capabilityMap = new Map(capabilityEntries.map((entry) => [entry.capabilityKey, entry]));

  return Promise.all(
    suggestions.map(async (item) => {
      const signal = await getPromotionSignal(item);
      const capability = capabilityMap.get(getSkillCapabilityKey(workspaceId, item.candidateSkillKey));
      return {
        ...item,
        capabilityStage: capability?.stage ?? signal.stage,
        formalPromotionReady: signal.formalReviewReady,
        calibrationScore: signal.calibrationScore,
        evidenceCount: signal.evidenceCount,
        revalidationCount: signal.revalidationCount,
        adoptionCount: signal.adoptionCount,
        dismissalCount: signal.dismissalCount,
        boundaryIncidentCount: signal.boundaryIncidentCount,
        formalReviewStatus: signal.formalReviewStatus,
        formalReviewDecision: normalizeFormalReviewDecision(item.formalReviewDecision),
        formalReviewDecisionByName: item.formalReviewDecisionByName,
        formalReviewDecisionAt: item.formalReviewDecisionAt,
        formalReviewDecisionNote: item.formalReviewDecisionNote,
        formalReviewChecklist: parseFormalReviewChecklist(item.formalReviewChecklistJson),
      };
    }),
  );
}

export async function acceptSkillSuggestion(input: {
  workspaceId: string;
  suggestionId: string;
  userId: string;
  actorName: string;
}) {
  const suggestion = await db.skillSuggestion.findFirst({
    where: {
      workspaceId: input.workspaceId,
      id: input.suggestionId,
    },
  });

  if (!suggestion) {
    throw new Error("候选能力建议不存在");
  }

  if (suggestion.status !== "OPEN") {
    return suggestion;
  }

  const effect = await createCandidateCapability({
    workspaceId: input.workspaceId,
    suggestion,
  });

  const updated = await db.skillSuggestion.update({
    where: { id: suggestion.id },
    data: {
      status: "ACCEPTED",
      confirmedByUserId: input.userId,
      confirmedAt: new Date(),
      appliedTargetType: "CapabilityCatalogEntry",
      appliedTargetId: effect.entry.id,
      appliedEffectSummary: effect.summary,
      appliedAt: new Date(),
    },
  });

  await db.notification.create({
    data: {
      workspaceId: input.workspaceId,
      userId: input.userId,
      type: NotificationType.UPDATE,
      title: "候选能力已进入 capability catalog",
      body: effect.summary,
      url: "/settings?tab=policies",
    },
  });

  await writeAuditLog({
    workspaceId: input.workspaceId,
    userId: input.userId,
    actor: input.actorName,
    actorType: ActorType.USER,
    actionType: "SKILL_SUGGESTION_ACCEPTED",
    targetType: "SkillSuggestion",
    targetId: updated.id,
    summary: `采纳候选能力建议：${updated.title}`,
    payload: {
      candidateSkillKey: updated.candidateSkillKey,
      candidateBoundary: updated.candidateBoundary,
      candidateEffectMode: updated.candidateEffectMode,
      appliedTargetType: updated.appliedTargetType,
      appliedTargetId: updated.appliedTargetId,
      appliedEffectSummary: updated.appliedEffectSummary,
    },
    sourcePage: "/settings",
  });

  await logEvent({
    workspaceId: input.workspaceId,
    userId: input.userId,
    eventName: "skill_suggestion_accepted",
    eventCategory: "evolution",
    targetType: "SkillSuggestion",
    targetId: updated.id,
    metadata: {
      candidateSkillKey: updated.candidateSkillKey,
      candidateBoundary: updated.candidateBoundary,
      candidateEffectMode: updated.candidateEffectMode,
      appliedTargetType: updated.appliedTargetType,
      appliedTargetId: updated.appliedTargetId,
    },
    sourcePage: "/settings",
  });

  await logEvent({
    workspaceId: input.workspaceId,
    userId: input.userId,
    eventName: "skill_suggestion_applied",
    eventCategory: "evolution",
    targetType: "CapabilityCatalogEntry",
    targetId: effect.entry.id,
    metadata: {
      suggestionId: updated.id,
      candidateSkillKey: updated.candidateSkillKey,
      effectSummary: effect.summary,
    },
    sourcePage: "/settings",
  });

  try {
    await refreshEvolutionState({
      workspaceId: input.workspaceId,
      actorId: input.userId,
      actorType: ActorType.USER,
      sourcePage: "/settings",
      trigger: "skill_suggestion_accepted",
    });
  } catch (error) {
    console.error("skill suggestion evolution refresh failed", error);
  }

  return updated;
}

export async function dismissSkillSuggestion(input: {
  workspaceId: string;
  suggestionId: string;
  userId: string;
  actorName: string;
}) {
  const suggestion = await db.skillSuggestion.findFirst({
    where: {
      workspaceId: input.workspaceId,
      id: input.suggestionId,
    },
  });

  if (!suggestion) {
    throw new Error("候选能力建议不存在");
  }

  if (suggestion.status !== "OPEN") {
    return suggestion;
  }

  const updated = await db.skillSuggestion.update({
    where: { id: suggestion.id },
    data: {
      status: "DISMISSED",
      confirmedByUserId: input.userId,
      confirmedAt: new Date(),
    },
  });

  await writeAuditLog({
    workspaceId: input.workspaceId,
    userId: input.userId,
    actor: input.actorName,
    actorType: ActorType.USER,
    actionType: "SKILL_SUGGESTION_DISMISSED",
    targetType: "SkillSuggestion",
    targetId: updated.id,
    summary: `忽略候选能力建议：${updated.title}`,
    payload: {
      candidateSkillKey: updated.candidateSkillKey,
      candidateBoundary: updated.candidateBoundary,
      candidateEffectMode: updated.candidateEffectMode,
    },
    sourcePage: "/settings",
  });

  await logEvent({
    workspaceId: input.workspaceId,
    userId: input.userId,
    eventName: "skill_suggestion_dismissed",
    eventCategory: "evolution",
    targetType: "SkillSuggestion",
    targetId: updated.id,
    metadata: {
      candidateSkillKey: updated.candidateSkillKey,
      candidateBoundary: updated.candidateBoundary,
      candidateEffectMode: updated.candidateEffectMode,
    },
    sourcePage: "/settings",
  });

  try {
    await refreshEvolutionState({
      workspaceId: input.workspaceId,
      actorId: input.userId,
      actorType: ActorType.USER,
      sourcePage: "/settings",
      trigger: "skill_suggestion_dismissed",
    });
  } catch (error) {
    console.error("skill suggestion dismissal refresh failed", error);
  }

  return updated;
}

async function refreshSkillFormalReviewState(input: {
  workspaceId: string;
  userId: string;
  trigger: string;
  errorLabel: string;
}) {
  try {
    await refreshEvolutionState({
      workspaceId: input.workspaceId,
      actorId: input.userId,
      actorType: ActorType.USER,
      sourcePage: "/settings",
      trigger: input.trigger,
    });
  } catch (error) {
    console.error(input.errorLabel, error);
  }
}

async function getAcceptedSkillSuggestionOrThrow(input: {
  workspaceId: string;
  suggestionId: string;
}) {
  const suggestion = await db.skillSuggestion.findFirst({
    where: {
      workspaceId: input.workspaceId,
      id: input.suggestionId,
    },
  });

  if (!suggestion) {
    throw new Error("候选能力建议不存在");
  }

  if (suggestion.status !== "ACCEPTED") {
    throw new Error("只有已收敛的候选能力才能参与 正式复核工作流");
  }

  return suggestion;
}

function buildFormalReviewDecisionSummary(input: {
  skillName: string;
  decision: FormalReviewDecision;
  note?: string | null;
  checklist: FormalReviewChecklist;
}) {
  const checklistSummary = summarizeFormalReviewChecklist(input.checklist);
  const noteLine = input.note ? ` 说明：${input.note}` : "";

  if (input.decision === "APPROVED_PENDING_PROMOTION") {
    return `“${input.skillName}”已通过正式复核，并进入待晋升批准状态。当前清单：${checklistSummary}。它仍不是正式能力，下一步仍需人工补能力目录、测试、守卫和文档。${noteLine}`;
  }

  if (input.decision === "DEFERRED") {
    return `“${input.skillName}”已被正式复核暂缓。当前清单：${checklistSummary}。这代表仍保留在人工治理层，等待后续补充说明或重新入队。${noteLine}`;
  }

  return `“${input.skillName}”已被正式复核拒绝。当前清单：${checklistSummary}。它不会自动进入正式晋升，后续只能在重新判断后再次入队。${noteLine}`;
}

export async function queueSkillFormalReview(input: {
  workspaceId: string;
  suggestionId: string;
  userId: string;
  actorName: string;
}) {
  const suggestion = await getAcceptedSkillSuggestionOrThrow(input);

  const signal = await getPromotionSignal(suggestion);
  if (!signal.formalReviewReady) {
    throw new Error("这条能力还没有达到正式复核就绪条件");
  }

  if (normalizeFormalReviewDecision(suggestion.formalReviewDecision) === "APPROVED_PENDING_PROMOTION") {
    throw new Error("这条能力已经通过正式复核，当前等待人工正式晋升");
  }

  if (normalizeFormalReviewStatus(suggestion.formalReviewStatus) === "QUEUED") {
    return suggestion;
  }

  const queuedAt = new Date();
  const summary = `“${suggestion.candidateSkillName}”已进入正式复核队列，后续仍需人工决定是否补能力目录、测试、守卫和文档。`;
  const updated = await db.skillSuggestion.update({
    where: { id: suggestion.id },
    data: {
      formalReviewStatus: "QUEUED",
      formalReviewQueuedByUserId: input.userId,
      formalReviewQueuedAt: queuedAt,
      formalReviewSummary: summary,
      formalReviewDecision: "NONE",
      formalReviewDecisionByUserId: null,
      formalReviewDecisionByName: null,
      formalReviewDecisionAt: null,
      formalReviewDecisionNote: null,
      formalReviewChecklistJson: null,
    },
  });

  await db.notification.create({
    data: {
      workspaceId: input.workspaceId,
      userId: input.userId,
      type: NotificationType.UPDATE,
      title: "候选能力已进入正式复核队列",
      body: summary,
      url: "/settings?tab=policies",
    },
  });

  await writeAuditLog({
    workspaceId: input.workspaceId,
    userId: input.userId,
    actor: input.actorName,
    actorType: ActorType.USER,
    actionType: "SKILL_FORMAL_REVIEW_QUEUED",
    targetType: "SkillSuggestion",
    targetId: updated.id,
    summary,
    payload: {
      candidateSkillKey: updated.candidateSkillKey,
      formalReviewStatus: "QUEUED",
      queuedAt: queuedAt.toISOString(),
    },
    sourcePage: "/settings",
  });

  await logEvent({
    workspaceId: input.workspaceId,
    userId: input.userId,
    eventName: "skill_formal_review_queued",
    eventCategory: "evolution",
    targetType: "SkillSuggestion",
    targetId: updated.id,
    metadata: {
      candidateSkillKey: updated.candidateSkillKey,
      queuedAt: queuedAt.toISOString(),
    },
    sourcePage: "/settings",
  });

  await refreshSkillFormalReviewState({
    workspaceId: input.workspaceId,
    userId: input.userId,
    trigger: "skill_formal_review_queued",
    errorLabel: "skill formal review queue refresh failed",
  });

  return updated;
}

export async function returnSkillFormalReviewForHardening(input: {
  workspaceId: string;
  suggestionId: string;
  userId: string;
  actorName: string;
}) {
  const suggestion = await getAcceptedSkillSuggestionOrThrow(input);

  if (normalizeFormalReviewStatus(suggestion.formalReviewStatus) !== "QUEUED") {
    throw new Error("只有已入队的正式复核项才能退回加固");
  }

  const summary = `“${suggestion.candidateSkillName}”已从正式复核队列返回加固，会继续记录边界事件并等待更稳的证据。`;
  const updated = await db.skillSuggestion.update({
    where: { id: suggestion.id },
    data: {
      formalReviewStatus: "HARDENING_REQUIRED",
      formalReviewQueuedByUserId: null,
      formalReviewQueuedAt: null,
      formalReviewSummary: summary,
      formalReviewDecision: "NONE",
      formalReviewDecisionByUserId: null,
      formalReviewDecisionByName: null,
      formalReviewDecisionAt: null,
      formalReviewDecisionNote: null,
      formalReviewChecklistJson: null,
    },
  });

  await writeAuditLog({
    workspaceId: input.workspaceId,
    userId: input.userId,
    actor: input.actorName,
    actorType: ActorType.USER,
    actionType: "SKILL_FORMAL_REVIEW_RETURNED",
    targetType: "SkillSuggestion",
    targetId: updated.id,
    summary,
    payload: {
      candidateSkillKey: updated.candidateSkillKey,
      formalReviewStatus: "HARDENING_REQUIRED",
    },
    sourcePage: "/settings",
  });

  await logEvent({
    workspaceId: input.workspaceId,
    userId: input.userId,
    eventName: "skill_formal_review_returned",
    eventCategory: "evolution",
    targetType: "SkillSuggestion",
    targetId: updated.id,
    metadata: {
      candidateSkillKey: updated.candidateSkillKey,
      formalReviewStatus: "HARDENING_REQUIRED",
    },
    sourcePage: "/settings",
  });

  await db.notification.create({
    data: {
      workspaceId: input.workspaceId,
      userId: input.userId,
      type: NotificationType.UPDATE,
      title: "候选能力已返回加固",
      body: summary,
      url: "/settings?tab=policies",
    },
  });

  await refreshSkillFormalReviewState({
    workspaceId: input.workspaceId,
    userId: input.userId,
    trigger: "skill_formal_review_returned",
    errorLabel: "skill formal review return refresh failed",
  });

  return updated;
}

export async function approveSkillFormalReview(input: {
  workspaceId: string;
  suggestionId: string;
  userId: string;
  actorName: string;
  reviewNote?: string | null;
  checklist: FormalReviewChecklist;
}) {
  const suggestion = await getAcceptedSkillSuggestionOrThrow(input);
  if (normalizeFormalReviewStatus(suggestion.formalReviewStatus) !== "QUEUED") {
    throw new Error("只有已入队的正式复核项才能批准");
  }
  if (!isFormalReviewChecklistComplete(input.checklist)) {
    throw new Error("批准正式复核前必须完成能力目录、测试、守卫、文档和边界清单");
  }

  const decidedAt = new Date();
  const summary = buildFormalReviewDecisionSummary({
    skillName: suggestion.candidateSkillName,
    decision: "APPROVED_PENDING_PROMOTION",
    note: input.reviewNote,
    checklist: input.checklist,
  });
  const updated = await db.skillSuggestion.update({
    where: { id: suggestion.id },
    data: {
      formalReviewStatus: "READY",
      formalReviewSummary: summary,
      formalReviewDecision: "APPROVED_PENDING_PROMOTION",
      formalReviewDecisionByUserId: input.userId,
      formalReviewDecisionByName: input.actorName,
      formalReviewDecisionAt: decidedAt,
      formalReviewDecisionNote: input.reviewNote ?? null,
      formalReviewChecklistJson: serializeFormalReviewChecklist(input.checklist),
    },
  });

  await db.notification.create({
    data: {
      workspaceId: input.workspaceId,
      userId: input.userId,
      type: NotificationType.UPDATE,
      title: "候选能力已通过正式复核",
      body: summary,
      url: "/settings?tab=policies",
    },
  });

  await writeAuditLog({
    workspaceId: input.workspaceId,
    userId: input.userId,
    actor: input.actorName,
    actorType: ActorType.USER,
    actionType: "SKILL_FORMAL_REVIEW_APPROVED",
    targetType: "SkillSuggestion",
    targetId: updated.id,
    summary,
    payload: {
      candidateSkillKey: updated.candidateSkillKey,
      formalReviewDecision: "APPROVED_PENDING_PROMOTION",
      checklist: input.checklist,
      note: input.reviewNote ?? null,
      decidedAt: decidedAt.toISOString(),
    },
    sourcePage: "/settings",
  });

  await logEvent({
    workspaceId: input.workspaceId,
    userId: input.userId,
    eventName: "skill_formal_review_approved",
    eventCategory: "evolution",
    targetType: "SkillSuggestion",
    targetId: updated.id,
    metadata: {
      candidateSkillKey: updated.candidateSkillKey,
      formalReviewDecision: "APPROVED_PENDING_PROMOTION",
      checklist: input.checklist,
    },
    sourcePage: "/settings",
  });

  await refreshSkillFormalReviewState({
    workspaceId: input.workspaceId,
    userId: input.userId,
    trigger: "skill_formal_review_approved",
    errorLabel: "skill formal review approval refresh failed",
  });

  return updated;
}

export async function deferSkillFormalReview(input: {
  workspaceId: string;
  suggestionId: string;
  userId: string;
  actorName: string;
  reviewNote?: string | null;
  checklist: FormalReviewChecklist;
}) {
  const suggestion = await getAcceptedSkillSuggestionOrThrow(input);
  if (normalizeFormalReviewStatus(suggestion.formalReviewStatus) !== "QUEUED") {
    throw new Error("只有已入队的正式复核项才能暂缓");
  }
  if (!input.reviewNote?.trim()) {
    throw new Error("暂缓正式复核时必须填写复核备注");
  }

  const decidedAt = new Date();
  const summary = buildFormalReviewDecisionSummary({
    skillName: suggestion.candidateSkillName,
    decision: "DEFERRED",
    note: input.reviewNote,
    checklist: input.checklist,
  });
  const updated = await db.skillSuggestion.update({
    where: { id: suggestion.id },
    data: {
      formalReviewStatus: "READY",
      formalReviewSummary: summary,
      formalReviewDecision: "DEFERRED",
      formalReviewDecisionByUserId: input.userId,
      formalReviewDecisionByName: input.actorName,
      formalReviewDecisionAt: decidedAt,
      formalReviewDecisionNote: input.reviewNote,
      formalReviewChecklistJson: serializeFormalReviewChecklist(input.checklist),
    },
  });

  await db.notification.create({
    data: {
      workspaceId: input.workspaceId,
      userId: input.userId,
      type: NotificationType.UPDATE,
      title: "候选能力正式复核已暂缓",
      body: summary,
      url: "/settings?tab=policies",
    },
  });

  await writeAuditLog({
    workspaceId: input.workspaceId,
    userId: input.userId,
    actor: input.actorName,
    actorType: ActorType.USER,
    actionType: "SKILL_FORMAL_REVIEW_DEFERRED",
    targetType: "SkillSuggestion",
    targetId: updated.id,
    summary,
    payload: {
      candidateSkillKey: updated.candidateSkillKey,
      formalReviewDecision: "DEFERRED",
      checklist: input.checklist,
      note: input.reviewNote,
      decidedAt: decidedAt.toISOString(),
    },
    sourcePage: "/settings",
  });

  await logEvent({
    workspaceId: input.workspaceId,
    userId: input.userId,
    eventName: "skill_formal_review_deferred",
    eventCategory: "evolution",
    targetType: "SkillSuggestion",
    targetId: updated.id,
    metadata: {
      candidateSkillKey: updated.candidateSkillKey,
      formalReviewDecision: "DEFERRED",
      checklist: input.checklist,
    },
    sourcePage: "/settings",
  });

  await refreshSkillFormalReviewState({
    workspaceId: input.workspaceId,
    userId: input.userId,
    trigger: "skill_formal_review_deferred",
    errorLabel: "skill formal review defer refresh failed",
  });

  return updated;
}

export async function rejectSkillFormalReview(input: {
  workspaceId: string;
  suggestionId: string;
  userId: string;
  actorName: string;
  reviewNote?: string | null;
  checklist: FormalReviewChecklist;
}) {
  const suggestion = await getAcceptedSkillSuggestionOrThrow(input);
  if (normalizeFormalReviewStatus(suggestion.formalReviewStatus) !== "QUEUED") {
    throw new Error("只有已入队的正式复核项才能拒绝");
  }
  if (!input.reviewNote?.trim()) {
    throw new Error("拒绝正式复核时必须填写复核备注");
  }

  const decidedAt = new Date();
  const summary = buildFormalReviewDecisionSummary({
    skillName: suggestion.candidateSkillName,
    decision: "REJECTED",
    note: input.reviewNote,
    checklist: input.checklist,
  });
  const updated = await db.skillSuggestion.update({
    where: { id: suggestion.id },
    data: {
      formalReviewStatus: "READY",
      formalReviewSummary: summary,
      formalReviewDecision: "REJECTED",
      formalReviewDecisionByUserId: input.userId,
      formalReviewDecisionByName: input.actorName,
      formalReviewDecisionAt: decidedAt,
      formalReviewDecisionNote: input.reviewNote,
      formalReviewChecklistJson: serializeFormalReviewChecklist(input.checklist),
    },
  });

  await db.notification.create({
    data: {
      workspaceId: input.workspaceId,
      userId: input.userId,
      type: NotificationType.UPDATE,
      title: "候选能力正式复核已拒绝",
      body: summary,
      url: "/settings?tab=policies",
    },
  });

  await writeAuditLog({
    workspaceId: input.workspaceId,
    userId: input.userId,
    actor: input.actorName,
    actorType: ActorType.USER,
    actionType: "SKILL_FORMAL_REVIEW_REJECTED",
    targetType: "SkillSuggestion",
    targetId: updated.id,
    summary,
    payload: {
      candidateSkillKey: updated.candidateSkillKey,
      formalReviewDecision: "REJECTED",
      checklist: input.checklist,
      note: input.reviewNote,
      decidedAt: decidedAt.toISOString(),
    },
    sourcePage: "/settings",
  });

  await logEvent({
    workspaceId: input.workspaceId,
    userId: input.userId,
    eventName: "skill_formal_review_rejected",
    eventCategory: "evolution",
    targetType: "SkillSuggestion",
    targetId: updated.id,
    metadata: {
      candidateSkillKey: updated.candidateSkillKey,
      formalReviewDecision: "REJECTED",
      checklist: input.checklist,
    },
    sourcePage: "/settings",
  });

  await refreshSkillFormalReviewState({
    workspaceId: input.workspaceId,
    userId: input.userId,
    trigger: "skill_formal_review_rejected",
    errorLabel: "skill formal review rejection refresh failed",
  });

  return updated;
}
