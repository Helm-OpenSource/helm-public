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
  type ArtifactBundle,
  type MemoryItem,
  type Opportunity,
} from "@prisma/client";
import { generateOpportunitySignals, generatePostMeetingActionSuggestions } from "@/lib/ai";
import { writeAuditLog } from "@/lib/audit";
import { ensureWorkspaceProcessingAllowed, recordUsageLedgerEntry } from "@/lib/billing/foundation";
import { db } from "@/lib/db";
import { resolveApprovalRule } from "@/lib/helm-v2/approval-matrix";
import {
  getMeetingRuntimeUpgradeSummary,
  syncMeetingRuntimeUpgradeIngest,
  syncMeetingRuntimeUpgradeReview,
} from "@/lib/helm-v2/runtime-upgrade";
import { jsonStringify, safeParseJson, trimText } from "@/lib/utils";

const MEETING_ANALYST_AGENT = "meeting-analyst";
const OPPORTUNITY_JUDGE_AGENT = "opportunity-judge";
const DEFAULT_WORKSPACE_SUMMARY = "当前工作区以判断优先方式把会议、对象状态、审批和下一步收成同一条经营推进链。";
const ACTION_PACK_BOUNDARY_NOTE_CN = "这份动作资料仍然只是草稿建议套件，不会自动外发、不会形成对外承诺，也不会写入正式客户关系系统状态。";
const SHADOW_BOUNDARY_NOTE = "Only shadow fields are updated in Sprint 2. Official opportunity state stays unchanged.";

type MeetingRuntimeMeeting = NonNullable<Awaited<ReturnType<typeof loadMeetingRuntimeMeeting>>>;

export type MeetingFactItem = {
  id: string;
  title: string;
  content: string;
  objectType: "MEETING" | "OPPORTUNITY" | "COMPANY";
  objectId: string;
  confidence: number;
  evidence: string[];
};

export type MeetingInferenceItem = {
  id: string;
  summary: string;
  rationale: string;
  confidence: number;
  evidence: string[];
};

export type MeetingRiskFlag = {
  label: string;
  severity: "low" | "medium" | "high";
  reason: string;
  evidence: string[];
  promiseRisk: boolean;
};

export type MeetingFactsArtifact = {
  attendees: string[];
  agenda: string[];
  facts: MeetingFactItem[];
  inferred: MeetingInferenceItem[];
  decisions: string[];
  blockers: string[];
  customerGoals: string[];
  promisesDetected: string[];
  nextActions: string[];
  ownerMap: Array<{ owner: string; action: string }>;
  followupDeadlines: string[];
};

export type ActionPackBundleContent = {
  artifactId: "action_pack.md";
  markdown: string;
  boundary: string;
  recommendedNextAction: string;
  openQuestions: string[];
};

export type RiskFlagsArtifact = {
  flags: MeetingRiskFlag[];
  boundaryNotes: string[];
  requiresPromiseGuardReview: boolean;
};

type MemoryDraftLine = {
  kind: "fact" | "inference" | "checkpoint";
  summary: string;
  objectType: "MEETING" | "OPPORTUNITY" | "COMPANY";
  objectId: string;
  verification: "draft" | "inferred";
  promotionRule: "human_confirmed" | "none";
  payload: Record<string, unknown>;
  confidence: number;
  evidence: string[];
};

type OpportunityShadowDelta = {
  shadowStage: OpportunityStage;
  shadowRiskLevel: RiskLevel;
  shadowNextAction: string;
  shadowBlockersSummary: string;
  shadowManagerAttentionFlag: boolean;
  shadowStageConfidence: number;
  managerAttentionReasons: string[];
};

type MeetingAnalystResult = {
  factsArtifact: MeetingFactsArtifact;
  riskArtifact: RiskFlagsArtifact;
  actionPack: ActionPackBundleContent;
  memoryDraftLines: MemoryDraftLine[];
  evidenceRefs: string[];
  sourceProvenance: Array<Record<string, unknown>>;
  confidence: number;
  openQuestions: string[];
};

type ConfirmMode = "confirm" | "edit_confirm" | "reject" | "keep_draft";

type ReviewEditsInput = {
  factsJson?: string | null;
  actionPackMarkdown?: string | null;
  reviewNotes?: string | null;
};

export type MeetingRuntimeSummary = {
  latestMeetingEndedEvent: {
    id: string;
    status: RuntimeEventStatus;
    createdAt: Date;
    completedAt: Date | null;
    errorMessage: string | null;
  } | null;
  latestMeetingFactsEvent: {
    id: string;
    status: RuntimeEventStatus;
    createdAt: Date;
    completedAt: Date | null;
    errorMessage: string | null;
  } | null;
  analystRun: {
    id: string;
    status: WorkerRunStatus;
    confidence: number | null;
    openQuestions: string[];
    evidenceRefs: string[];
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
  } | null;
  factsArtifact: (MeetingFactsArtifact & { id: string; status: ArtifactBundleStatus; confidence: number | null }) | null;
  riskArtifact: (RiskFlagsArtifact & { id: string; status: ArtifactBundleStatus; confidence: number | null }) | null;
  actionPack: (ActionPackBundleContent & { id: string; status: ArtifactBundleStatus; confidence: number | null }) | null;
  memoryDraftArtifact: {
    id: string;
    status: ArtifactBundleStatus;
    jsonl: string;
  } | null;
  editorDraft: {
    factsJson: string;
    actionPackMarkdown: string;
    reviewNotes: string;
  } | null;
  promotedMemory: Array<{
    id: string;
    kind: MemoryItemKind;
    summary: string;
    verification: MemoryItemVerification;
    promotedAt: Date | null;
  }>;
  draftMemory: Array<{
    id: string;
    kind: MemoryItemKind;
    summary: string;
    verification: MemoryItemVerification;
    status: MemoryItemStatus;
  }>;
  opportunityShadow: {
    stage: OpportunityStage | null;
    riskLevel: RiskLevel | null;
    nextAction: string | null;
    blockersSummary: string | null;
    managerAttentionFlag: boolean;
    stageConfidence: number | null;
    updatedAt: Date | null;
  } | null;
  v21: Awaited<ReturnType<typeof getMeetingRuntimeUpgradeSummary>> | null;
};

async function loadMeetingRuntimeMeeting(workspaceId: string, meetingId: string) {
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

function listLines(...values: Array<string | null | undefined>) {
  return values
    .flatMap((value) =>
      (value ?? "")
        .split("\n")
        .map((line) => line.trim()),
    )
    .filter(Boolean)
    .filter((value, index, list) => list.indexOf(value) === index);
}

function meetingEvidenceRefs(meeting: MeetingRuntimeMeeting) {
  const refs = [`meeting:${meeting.id}`];
  if (meeting.note) refs.push(`meeting-note:${meeting.note.id}`);
  if (meeting.opportunityId) refs.push(`opportunity:${meeting.opportunityId}`);
  if (meeting.companyId) refs.push(`company:${meeting.companyId}`);
  return refs;
}

function buildTrustedContext(meeting: MeetingRuntimeMeeting) {
  return {
    workspace: {
      id: meeting.workspaceId,
      name: meeting.workspace.name,
      summary: meeting.workspace.description ?? DEFAULT_WORKSPACE_SUMMARY,
    },
    calendar: {
      meetingId: meeting.id,
      title: meeting.title,
      startsAt: meeting.startsAt.toISOString(),
      endsAt: meeting.endsAt.toISOString(),
      attendees: meeting.contacts.map((contact) => contact.name),
      owner: meeting.owner?.name ?? "未指定",
    },
    objectGraph: {
      company: meeting.company ? { id: meeting.company.id, name: meeting.company.name } : null,
      opportunity: meeting.opportunity
        ? {
            id: meeting.opportunity.id,
            title: meeting.opportunity.title,
            stage: meeting.opportunity.stage,
            riskLevel: meeting.opportunity.riskLevel,
            nextAction: meeting.opportunity.nextAction,
          }
        : null,
    },
  };
}

function buildUntrustedContext(meeting: MeetingRuntimeMeeting) {
  return {
    note: meeting.note
      ? {
          attendeesSummary: meeting.note.attendeesSummary,
          relationshipSummary: meeting.note.relationshipSummary,
          previousConclusion: meeting.note.previousConclusion,
          meetingGoal: meeting.note.meetingGoal,
          riskAlerts: meeting.note.riskAlerts,
          summary: meeting.note.summary,
          keyDecisions: meeting.note.keyDecisions,
          confirmations: meeting.note.confirmations,
          liveTranscript: meeting.note.liveTranscript,
        }
      : null,
  };
}

function buildSourceProvenance(meeting: MeetingRuntimeMeeting) {
  return [
    {
      ref: `calendar:${meeting.id}`,
      sourceType: "calendar",
      trust: "TRUSTED",
      detail: "Meeting metadata and attendees from the calendar-backed meeting object.",
    },
    ...(meeting.note
      ? [
          {
            ref: `meeting-note:${meeting.note.id}`,
            sourceType: "meeting",
            trust: "TRUSTED",
            detail: "Structured meeting note fields already attached to the meeting object.",
          },
          {
            ref: `meeting-note-freeform:${meeting.note.id}`,
            sourceType: "document",
            trust: "UNTRUSTED",
            detail: "Freeform note/transcript text still needs human confirmation before promotion.",
          },
        ]
      : []),
  ];
}

function buildFactItems(meeting: MeetingRuntimeMeeting, evidenceRefs: string[]): MeetingFactItem[] {
  const note = meeting.note;
  if (!note) return [];

  const items: MeetingFactItem[] = [];
  const pushFact = (input: {
    id: string;
    title: string;
    content: string;
    objectType: "MEETING" | "OPPORTUNITY" | "COMPANY";
    objectId: string | null | undefined;
    confidence: number;
  }) => {
    if (!input.objectId || !input.content.trim()) return;
    items.push({
      id: input.id,
      title: trimText(input.title, 48),
      content: input.content.trim(),
      objectType: input.objectType,
      objectId: input.objectId,
      confidence: input.confidence,
      evidence: evidenceRefs,
    });
  };

  pushFact({
    id: "meeting-summary",
    title: `${meeting.title} 摘要`,
    content: note.summary ?? `${meeting.title} 已结束，当前已形成可供人工确认的行动包。`,
    objectType: "MEETING",
    objectId: meeting.id,
    confidence: note.summary ? 88 : 74,
  });

  for (const [index, line] of listLines(note.keyDecisions, note.confirmations).slice(0, 4).entries()) {
    pushFact({
      id: `decision-${index + 1}`,
      title: `会议结论 ${index + 1}`,
      content: line,
      objectType: meeting.opportunityId ? "OPPORTUNITY" : "MEETING",
      objectId: meeting.opportunityId ?? meeting.id,
      confidence: 82,
    });
  }

  for (const [index, line] of listLines(note.meetingGoal, note.previousConclusion).slice(0, 3).entries()) {
    pushFact({
      id: `goal-${index + 1}`,
      title: `客户目标 ${index + 1}`,
      content: line,
      objectType: meeting.companyId ? "COMPANY" : "MEETING",
      objectId: meeting.companyId ?? meeting.id,
      confidence: 76,
    });
  }

  return items.filter((item, index, list) => list.findIndex((candidate) => candidate.content === item.content) === index);
}

function buildInferenceItems(meeting: MeetingRuntimeMeeting, evidenceRefs: string[]): MeetingInferenceItem[] {
  const note = meeting.note;
  if (!note) return [];

  const inferred: MeetingInferenceItem[] = [];
  const pushInference = (summary: string, rationale: string, confidence: number) => {
    if (!summary.trim()) return;
    inferred.push({
      id: `inf_${inferred.length + 1}`,
      summary: summary.trim(),
      rationale: rationale.trim(),
      confidence,
      evidence: evidenceRefs,
    });
  };

  for (const line of listLines(note.riskAlerts).slice(0, 2)) {
    pushInference(line, "从风险提醒或会中风险提示里抽出的推断，仍需人工确认后才能提升。", 62);
  }

  if (note.relationshipSummary) {
    pushInference(
      trimText(note.relationshipSummary, 72),
      "关系判断来自会后总结，不直接写成正式对象状态。",
      58,
    );
  }

  if (meeting.opportunity?.riskLevel === RiskLevel.HIGH || meeting.opportunity?.riskLevel === RiskLevel.CRITICAL) {
    pushInference("当前机会风险需要管理者关注。", "机会原始风险等级较高，会议动作资料需要更强人工确认。", 68);
  }

  return inferred.filter((item, index, list) => list.findIndex((candidate) => candidate.summary === item.summary) === index);
}

function buildRiskFlags(meeting: MeetingRuntimeMeeting, facts: MeetingFactItem[], inferred: MeetingInferenceItem[]): MeetingRiskFlag[] {
  const note = meeting.note;
  const risks: MeetingRiskFlag[] = [];
  const pushRisk = (label: string, severity: "low" | "medium" | "high", reason: string, promiseRisk = false) => {
    if (!label.trim()) return;
    risks.push({
      label: label.trim(),
      severity,
      reason,
      evidence: meetingEvidenceRefs(meeting),
      promiseRisk,
    });
  };

  for (const line of listLines(note?.riskAlerts).slice(0, 3)) {
    const promiseRisk = /报价|合同|交付|上线|承诺|折扣|期限/.test(line);
    pushRisk(line, promiseRisk ? "high" : "medium", "来自会议备注的风险提醒或潜在承诺线索。", promiseRisk);
  }

  for (const item of inferred) {
    pushRisk(item.summary, item.confidence >= 65 ? "medium" : "low", item.rationale, false);
  }

  if (facts.some((fact) => /预算|采购|法务|审批/.test(fact.content))) {
    pushRisk("存在预算 / 采购 / 法务类外部依赖。", "high", "会议事实已经指向外部依赖，不应把建议误读成承诺。", true);
  }

  return risks.filter((risk, index, list) => list.findIndex((candidate) => candidate.label === risk.label) === index);
}

function detectPromises(meeting: MeetingRuntimeMeeting, facts: MeetingFactItem[], risks: MeetingRiskFlag[]) {
  const lines = listLines(meeting.note?.confirmations, meeting.note?.keyDecisions, meeting.note?.summary);
  const promiseLines = lines.filter((line) => /报价|合同|交付|上线|承诺|折扣|时间表|里程碑/.test(line));
  if (!promiseLines.length && risks.some((risk) => risk.promiseRisk)) {
    promiseLines.push("会后材料涉及价格、交付或正式承诺，需要 Risk & 承诺 Guard 后续介入。");
  }
  return promiseLines.slice(0, 3);
}

function buildOwnerMap(meeting: MeetingRuntimeMeeting, nextActions: string[]) {
  const owner = meeting.owner?.name ?? "待指定负责人";
  return nextActions.slice(0, 3).map((action) => ({ owner, action }));
}

function buildFollowupDeadlines(meeting: MeetingRuntimeMeeting, nextActions: string[]) {
  if (!nextActions.length) return [];
  const within24h = meeting.opportunity ? "24 小时内完成第一轮跟进草稿" : "24 小时内补全会议事实确认";
  return [within24h, "确认负责人与截止时间后再进入下一层执行消费。"];
}

export function buildMeetingAnalystArtifacts(meeting: MeetingRuntimeMeeting): MeetingAnalystResult {
  const evidenceRefs = meetingEvidenceRefs(meeting);
  const sourceProvenance = buildSourceProvenance(meeting);
  const facts = buildFactItems(meeting, evidenceRefs);
  const inferred = buildInferenceItems(meeting, evidenceRefs);
  const decisions = facts.filter((item) => item.id.startsWith("decision-")).map((item) => item.content);
  const blockers = listLines(meeting.note?.riskAlerts).slice(0, 3);
  const customerGoals = facts.filter((item) => item.id.startsWith("goal-")).map((item) => item.content);
  const nextActions = generatePostMeetingActionSuggestions({
    opportunity: meeting.opportunity
      ? {
          type: meeting.opportunity.type,
          stage: meeting.opportunity.stage,
          riskLevel: meeting.opportunity.riskLevel,
          nextAction: meeting.opportunity.nextAction,
        }
      : null,
    note: meeting.note,
  })
    .filter(Boolean)
    .slice(0, 4);
  const risks = buildRiskFlags(meeting, facts, inferred);
  const promisesDetected = detectPromises(meeting, facts, risks);
  const openQuestions = [
    ...(meeting.opportunityId ? [] : ["当前会议还没有关联机会，阴影判断只能停在会议 / 公司层。"]),
    ...(meeting.companyId ? [] : ["当前会议还没有关联公司，客户目标需要人工补足。"]),
    ...(nextActions.length ? [] : ["当前还没有形成明确下一步，需要人工补写。"]),
  ];
  const ownerMap = buildOwnerMap(meeting, nextActions);
  const followupDeadlines = buildFollowupDeadlines(meeting, nextActions);
  const factsArtifact: MeetingFactsArtifact = {
    attendees: meeting.contacts.map((contact) => contact.name),
    agenda: listLines(meeting.agenda, meeting.note?.meetingGoal).slice(0, 3),
    facts,
    inferred,
    decisions,
    blockers,
    customerGoals,
    promisesDetected,
    nextActions,
    ownerMap,
    followupDeadlines,
  };
  const riskArtifact: RiskFlagsArtifact = {
    flags: risks,
    boundaryNotes: [ACTION_PACK_BOUNDARY_NOTE_CN, "事实与推导继续分层保存；推导默认不晋升。"],
    requiresPromiseGuardReview: risks.some((risk) => risk.promiseRisk),
  };
  const recommendedNextAction = nextActions[0] ?? meeting.opportunity?.nextAction ?? "先由人工确认会议事实，再决定下一步。";
  const actionPackMarkdown = [
    `# ${meeting.title} action pack`,
    "",
    "## 当前判断",
    facts[0]?.content ?? "当前已抽出会议摘要，等待人工确认。",
    "",
    "## 为什么是现在",
    blockers[0] ?? "会后的 24 小时是把会议结论转成可执行动作的最佳窗口。",
    "",
    "## 当前最该推进的一步",
    `- ${recommendedNextAction}`,
    ...nextActions.slice(1).map((action) => `- ${action}`),
    "",
    "## 边界说明",
    `- ${ACTION_PACK_BOUNDARY_NOTE_CN}`,
    `- ${SHADOW_BOUNDARY_NOTE}`,
    "",
    "## 未决问题",
    ...(openQuestions.length ? openQuestions.map((item) => `- ${item}`) : ["- 暂无额外未决问题。"]),
  ].join("\n");

  const memoryDraftLines: MemoryDraftLine[] = [
    ...facts.map((fact) => ({
      kind: "fact" as const,
      summary: fact.content,
      objectType: fact.objectType,
      objectId: fact.objectId,
      verification: "draft" as const,
      promotionRule: "human_confirmed" as const,
      payload: {
        title: fact.title,
        content: fact.content,
      },
      confidence: fact.confidence,
      evidence: fact.evidence,
    })),
    ...inferred.map((item) => ({
      kind: "inference" as const,
      summary: item.summary,
      objectType: meeting.opportunityId ? "OPPORTUNITY" as const : "MEETING" as const,
      objectId: meeting.opportunityId ?? meeting.id,
      verification: "inferred" as const,
      promotionRule: "none" as const,
      payload: {
        rationale: item.rationale,
      },
      confidence: item.confidence,
      evidence: item.evidence,
    })),
    {
      kind: "checkpoint" as const,
      summary: recommendedNextAction,
      objectType: meeting.opportunityId ? "OPPORTUNITY" as const : "MEETING" as const,
      objectId: meeting.opportunityId ?? meeting.id,
      verification: "draft" as const,
      promotionRule: "human_confirmed" as const,
      payload: {
        boundary: SHADOW_BOUNDARY_NOTE,
        openQuestions,
      },
      confidence: 84,
      evidence: evidenceRefs,
    },
  ];

  return {
    factsArtifact,
    riskArtifact,
    actionPack: {
      artifactId: "action_pack.md",
      markdown: actionPackMarkdown,
      boundary: ACTION_PACK_BOUNDARY_NOTE_CN,
      recommendedNextAction,
      openQuestions,
    },
    memoryDraftLines,
    evidenceRefs,
    sourceProvenance,
    confidence: Math.max(72, Math.min(92, 70 + facts.length * 3 + (meeting.note?.summary ? 6 : 0))),
    openQuestions,
  };
}

function serializeMemoryDraftJsonl(lines: MemoryDraftLine[]) {
  return lines.map((line) => JSON.stringify(line)).join("\n");
}

function parseActionPackMarkdown(markdown: string) {
  const bullets = markdown
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.replace(/^- /, "").trim());
  return bullets[0] ?? "先由人工确认动作资料，再决定下一步。";
}

export function deriveShadowOpportunityUpdate(input: {
  opportunity: Opportunity;
  factsArtifact: MeetingFactsArtifact;
  riskArtifact: RiskFlagsArtifact;
  actionPack: ActionPackBundleContent;
}): OpportunityShadowDelta {
  const allTexts = [
    ...input.factsArtifact.decisions,
    ...input.factsArtifact.customerGoals,
    ...input.factsArtifact.blockers,
    ...input.factsArtifact.promisesDetected,
    input.actionPack.markdown,
  ].join("\n");

  let shadowStage = input.opportunity.stage;
  if (/采购|proposal|试点|联合评审|ROI|报价/.test(allTexts)) {
    shadowStage = OpportunityStage.ADVANCING;
  } else if (/等待对方|客户内部|采购评估|回去确认/.test(allTexts)) {
    shadowStage = OpportunityStage.WAITING_THEM;
  } else if (/内部对齐|内部优先级|资源冲突|法务|交付评审|资源协调/.test(allTexts)) {
    shadowStage = OpportunityStage.INTERNAL_SYNC;
  } else if (input.opportunity.stage === OpportunityStage.NEW) {
    shadowStage = OpportunityStage.CONTACTED;
  }

  const riskSignals = generateOpportunitySignals({
    type: input.opportunity.type,
    stage: shadowStage,
    riskLevel: input.opportunity.riskLevel,
    nextAction: input.opportunity.nextAction,
  });

  const shadowRiskLevel =
    input.riskArtifact.flags.some((item) => item.severity === "high")
      ? RiskLevel.HIGH
      : input.factsArtifact.blockers.length >= 2
        ? RiskLevel.MEDIUM
        : input.opportunity.riskLevel;

  const shadowNextAction =
    input.factsArtifact.nextActions[0] ??
    parseActionPackMarkdown(input.actionPack.markdown) ??
    riskSignals.nextMove;

  const managerAttentionReasons = [
    ...(shadowRiskLevel === RiskLevel.HIGH || shadowRiskLevel === RiskLevel.CRITICAL ? ["风险等级仍然偏高。"] : []),
    ...(input.factsArtifact.blockers.length >= 2 ? ["阻塞项已超过 2 个，需要经理关注。"] : []),
    ...(input.actionPack.openQuestions.length > 0 ? ["动作资料仍带有未决问题。"] : []),
  ];

  return {
    shadowStage,
    shadowRiskLevel,
    shadowNextAction,
    shadowBlockersSummary:
      input.factsArtifact.blockers.slice(0, 3).join("；") || riskSignals.riskHints[0] || "暂无新增阻塞，总体继续沿会议动作资料推进。",
    shadowManagerAttentionFlag: managerAttentionReasons.length > 0,
    shadowStageConfidence: Math.max(68, Math.min(90, 72 + input.factsArtifact.decisions.length * 4)),
    managerAttentionReasons,
  };
}

async function createRuntimeArtifacts(input: {
  workspaceId: string;
  runtimeEventId: string;
  workerRunId: string;
  meeting: MeetingRuntimeMeeting;
  analyst: MeetingAnalystResult;
}) {
  const common = {
    workspaceId: input.workspaceId,
    runtimeEventId: input.runtimeEventId,
    workerRunId: input.workerRunId,
    meetingId: input.meeting.id,
    opportunityId: input.meeting.opportunityId ?? undefined,
    companyId: input.meeting.companyId ?? undefined,
    evidenceRefs: jsonStringify(input.analyst.evidenceRefs),
    sourceProvenance: jsonStringify(input.analyst.sourceProvenance),
    confidence: input.analyst.confidence,
    openQuestions: jsonStringify(input.analyst.openQuestions),
  };

  const factsBundle = await db.artifactBundle.create({
    data: {
      ...common,
      artifactType: "meeting_facts.json",
      title: `${input.meeting.title} structured meeting facts`,
      summary: "会议分析已把会议摘要、决策、阻塞、客户目标和下一步拆成结构化事实 / 推导。",
      approvalTier: resolveApprovalRule("meeting.parse").tier,
      reviewPosture: "human_confirm_required",
      artifactsJson: jsonStringify({
        artifactId: "meeting_facts.json",
        payload: input.analyst.factsArtifact,
      }),
    },
  });

  const riskBundle = await db.artifactBundle.create({
    data: {
      ...common,
      artifactType: "risk_flags.json",
      title: `${input.meeting.title} risk flags`,
      summary: "潜在承诺、边界风险和未决问题已被抽出，但仍保持草稿姿态。",
      approvalTier: resolveApprovalRule("meeting.parse").tier,
      reviewPosture: "draft_risk_only",
      artifactsJson: jsonStringify({
        artifactId: "risk_flags.json",
        payload: input.analyst.riskArtifact,
      }),
    },
  });

  const actionPackBundle = await db.artifactBundle.create({
    data: {
      ...common,
      artifactType: "action_pack.md",
      title: `${input.meeting.title} action pack`,
      summary: "草稿动作资料已生成，但仍需人工确认才能触发经营记忆晋升和阴影更新。",
      approvalTier: resolveApprovalRule("memory.write_draft").tier,
      reviewPosture: "requires_human_confirm",
      artifactsJson: jsonStringify(input.analyst.actionPack),
    },
  });

  const memoryDraftBundle = await db.artifactBundle.create({
    data: {
      ...common,
      artifactType: "memory_draft.jsonl",
      title: `${input.meeting.title} memory draft`,
      summary: "会议分析生成的草稿经营记忆话术；事实 / 推导 / 检查点已分层。",
      approvalTier: resolveApprovalRule("memory.write_draft").tier,
      reviewPosture: "draft_only",
      artifactsJson: jsonStringify({
        artifactId: "memory_draft.jsonl",
        jsonl: serializeMemoryDraftJsonl(input.analyst.memoryDraftLines),
      }),
    },
  });

  const draftItems = await Promise.all(
    input.analyst.memoryDraftLines.map((line) =>
      db.memoryItem.create({
        data: {
          workspaceId: input.workspaceId,
          runtimeEventId: input.runtimeEventId,
          workerRunId: input.workerRunId,
          artifactBundleId: line.kind === "checkpoint" ? actionPackBundle.id : factsBundle.id,
          meetingId: input.meeting.id,
          opportunityId: input.meeting.opportunityId ?? undefined,
          companyId: input.meeting.companyId ?? undefined,
          objectType: line.objectType,
          objectId: line.objectId,
          kind: line.kind === "checkpoint" ? MemoryItemKind.CHECKPOINT : MemoryItemKind.OBJECT_FACT,
          scope: MemoryItemScope.OBJECT,
          namespace:
            line.objectType === "OPPORTUNITY"
              ? "opportunity"
              : line.objectType === "COMPANY"
                ? "customer"
                : "meeting",
          status: MemoryItemStatus.DRAFT,
          verification:
            line.verification === "inferred" ? MemoryItemVerification.INFERRED : MemoryItemVerification.DRAFT,
          sensitivity: MemoryItemSensitivity.INTERNAL,
          retention: line.kind === "checkpoint" ? MemoryItemRetention.DAYS_30 : MemoryItemRetention.UNTIL_VERIFIED,
          promotionRule:
            line.promotionRule === "human_confirmed"
              ? MemoryItemPromotionRule.HUMAN_CONFIRMED
              : MemoryItemPromotionRule.NONE,
          writer: MEETING_ANALYST_AGENT,
          summary: line.summary,
          payload: jsonStringify(line.payload),
          sourceProvenance: jsonStringify(input.analyst.sourceProvenance),
          evidenceRefs: jsonStringify(line.evidence),
          confidence: Math.round(line.confidence),
        },
      }),
    ),
  );

  const approvalRequest = await db.approvalRequest.create({
    data: {
      workspaceId: input.workspaceId,
      runtimeEventId: input.runtimeEventId,
      workerRunId: input.workerRunId,
      artifactBundleId: actionPackBundle.id,
      requestedAction: "meeting-facts.confirm",
      approvalTier: resolveApprovalRule("memory.write_draft").tier,
      status: ApprovalRequestStatus.PENDING,
      requestedBy: MEETING_ANALYST_AGENT,
      requestedReason: "Meeting facts and action pack need human confirm before memory promotion or shadow update.",
    },
  });

  const artifactReview = await db.artifactReview.create({
    data: {
      workspaceId: input.workspaceId,
      runtimeEventId: input.runtimeEventId,
      artifactBundleId: actionPackBundle.id,
      approvalRequestId: approvalRequest.id,
      status: ArtifactReviewStatus.PENDING,
      editedPayload: jsonStringify({
        facts: input.analyst.factsArtifact.facts,
        actionPackMarkdown: input.analyst.actionPack.markdown,
      }),
    },
  });

  return {
    factsBundle,
    riskBundle,
    actionPackBundle,
    memoryDraftBundle,
    draftItems,
    approvalRequest,
    artifactReview,
  };
}

function getLatestArtifactPayload<T>(bundle: ArtifactBundle | null | undefined, fallback: T): T {
  if (!bundle) return fallback;
  const parsed = safeParseJson<Record<string, unknown>>(bundle.artifactsJson, {});
  if ("payload" in parsed) {
    return (parsed.payload as T) ?? fallback;
  }
  return (parsed as T) ?? fallback;
}

async function updateBundlesForReview(input: {
  meetingEndedEventId: string;
  reviewerId: string;
  reviewMode: ConfirmMode;
  reviewedAt: Date;
  factsArtifact: MeetingFactsArtifact;
  actionPack: ActionPackBundleContent;
  reviewNotes?: string | null;
}) {
  const meetingEndedBundles = await db.artifactBundle.findMany({
    where: {
      runtimeEventId: input.meetingEndedEventId,
    },
  });

  for (const bundle of meetingEndedBundles) {
    let status = bundle.status;
    let reviewPosture = bundle.reviewPosture;
    if (input.reviewMode === "reject") {
      status = ArtifactBundleStatus.REJECTED;
      reviewPosture = "rejected_by_human";
    } else if (input.reviewMode === "keep_draft") {
      status = ArtifactBundleStatus.REVIEWED;
      reviewPosture = "kept_as_draft";
    } else {
      status = ArtifactBundleStatus.CONFIRMED;
      reviewPosture = "confirmed_by_human";
    }

    let artifactsJson = bundle.artifactsJson;
    if (bundle.artifactType === "meeting_facts.json") {
      artifactsJson = jsonStringify({
        artifactId: "meeting_facts.json",
        payload: input.factsArtifact,
      });
    }
    if (bundle.artifactType === "action_pack.md") {
      artifactsJson = jsonStringify(input.actionPack);
    }
    if (bundle.artifactType === "memory_draft.jsonl" && input.reviewMode !== "reject") {
      const existing = safeParseJson<Record<string, unknown>>(bundle.artifactsJson, {});
      artifactsJson = jsonStringify({
        artifactId: "memory_draft.jsonl",
        jsonl: typeof existing.jsonl === "string" ? existing.jsonl : "",
      });
    }

    await db.artifactBundle.update({
      where: { id: bundle.id },
      data: {
        status,
        reviewPosture,
        reviewedAt: input.reviewedAt,
        confirmedAt: input.reviewMode === "confirm" || input.reviewMode === "edit_confirm" ? input.reviewedAt : bundle.confirmedAt,
        artifactsJson,
        openQuestions:
          bundle.artifactType === "action_pack.md"
            ? jsonStringify(input.actionPack.openQuestions)
            : bundle.openQuestions,
      },
    });
  }
}

async function updateMemoryItemsForReview(input: {
  meetingEndedEventId: string;
  reviewedAt: Date;
  reviewMode: ConfirmMode;
  confirmedFacts: MeetingFactItem[];
  actionPack: ActionPackBundleContent;
}) {
  const items = await db.memoryItem.findMany({
    where: {
      runtimeEventId: input.meetingEndedEventId,
    },
  });

  const confirmedFactTexts = new Set(input.confirmedFacts.map((fact) => fact.content));

  for (const item of items) {
    if (input.reviewMode === "reject") {
      await db.memoryItem.update({
        where: { id: item.id },
        data: {
          status: MemoryItemStatus.DEPRECATED,
          verification: MemoryItemVerification.DEPRECATED,
          deprecatedAt: input.reviewedAt,
          lastValidatedAt: input.reviewedAt,
        },
      });
      continue;
    }

    if (input.reviewMode === "keep_draft") {
      await db.memoryItem.update({
        where: { id: item.id },
        data: {
          lastValidatedAt: input.reviewedAt,
        },
      });
      continue;
    }

    const payload = safeParseJson<Record<string, unknown>>(item.payload, {});
    const isCheckpoint = item.kind === MemoryItemKind.CHECKPOINT;
    const isConfirmedFact =
      item.kind === MemoryItemKind.OBJECT_FACT &&
      item.verification === MemoryItemVerification.DRAFT &&
      confirmedFactTexts.has(String(payload.content ?? item.summary));

    if (isCheckpoint || isConfirmedFact) {
      const nextPayload =
        isCheckpoint
          ? {
              ...payload,
              summary: input.actionPack.recommendedNextAction,
              openQuestions: input.actionPack.openQuestions,
              boundary: SHADOW_BOUNDARY_NOTE,
            }
          : payload;

      await db.memoryItem.update({
        where: { id: item.id },
        data: {
          status: MemoryItemStatus.PROMOTED,
          verification: MemoryItemVerification.HUMAN_CONFIRMED,
          payload: jsonStringify(nextPayload),
          confirmedAt: input.reviewedAt,
          promotedAt: input.reviewedAt,
          lastValidatedAt: input.reviewedAt,
        },
      });
      continue;
    }

    await db.memoryItem.update({
      where: { id: item.id },
      data: {
        lastValidatedAt: input.reviewedAt,
      },
    });
  }
}

async function createConfirmedMeetingFactsEvent(input: {
  workspaceId: string;
  meeting: MeetingRuntimeMeeting;
  sourceEventId: string;
  reviewerId: string;
  reviewerName: string;
  confirmedFactsArtifact: MeetingFactsArtifact;
  sourceBundles: {
    factsBundleId: string;
    actionPackBundleId: string;
  };
}) {
  const runtimeEvent = await db.runtimeEvent.create({
    data: {
      workspaceId: input.workspaceId,
      meetingId: input.meeting.id,
      opportunityId: input.meeting.opportunity?.id ?? undefined,
      companyId: input.meeting.companyId ?? undefined,
      relatedObjectType: input.meeting.opportunity ? "Opportunity" : "Meeting",
      relatedObjectId: input.meeting.opportunity?.id ?? input.meeting.id,
      eventType: "meeting.facts_created",
      status: RuntimeEventStatus.COMPLETED,
      trustedContext: jsonStringify(buildTrustedContext(input.meeting)),
      untrustedContext: jsonStringify({
        sourceEventId: input.sourceEventId,
      }),
      payload: jsonStringify({
        sourceEventId: input.sourceEventId,
        sourceArtifactIds: input.sourceBundles,
        factCount: input.confirmedFactsArtifact.facts.length,
      }),
      sourceProvenance: jsonStringify(buildSourceProvenance(input.meeting)),
      triggeredBy: "human",
      startedAt: new Date(),
      completedAt: new Date(),
    },
  });

  await writeAuditLog({
    workspaceId: input.workspaceId,
    userId: input.reviewerId,
    actor: input.reviewerName,
    actorType: ActorType.USER,
    actionType: "HELM_V2_MEETING_FACTS_READY_FOR_OPPORTUNITY_JUDGE",
    targetType: input.meeting.opportunity ? "Opportunity" : "Meeting",
    targetId: input.meeting.opportunity?.id ?? input.meeting.id,
    summary: input.meeting.opportunity
      ? `Confirmed meeting facts for ${input.meeting.title} are now ready for downstream opportunity judgement review.`
      : `Confirmed meeting facts for ${input.meeting.title} were promoted, but there is no linked opportunity for downstream judgement.`,
    payload: {
      sourceEventId: input.sourceEventId,
      sourceArtifactIds: input.sourceBundles,
      boundary: "Confirmed facts stay distinct from downstream opportunity judgement review.",
    },
    sourcePage: `/meetings/${input.meeting.id}`,
    relatedObjectType: "Meeting",
    relatedObjectId: input.meeting.id,
  });

  return runtimeEvent.id;
}

export async function ingestMeetingEndedRuntime(input: {
  workspaceId: string;
  meetingId: string;
  actorName: string;
  actorUserId?: string | null;
  sourcePage?: string;
  force?: boolean;
}) {
  const meeting = await loadMeetingRuntimeMeeting(input.workspaceId, input.meetingId);
  if (!meeting || !meeting.note) {
    throw new Error("Meeting note is required before Helm v2 runtime ingest can start.");
  }

  await ensureWorkspaceProcessingAllowed({
    workspaceId: input.workspaceId,
    english: meeting.workspace.defaultLocale === "en-US",
    operation: "MEETING_MEMORY_PROCESSING",
  });

  if (!input.force) {
    const existing = await db.runtimeEvent.findFirst({
      where: {
        workspaceId: input.workspaceId,
        meetingId: input.meetingId,
        eventType: "meeting.ended",
        status: {
          in: [RuntimeEventStatus.QUEUED, RuntimeEventStatus.RUNNING],
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if (existing) {
      return { runtimeEventId: existing.id, reused: true };
    }
  }

  const runtimeEvent = await db.runtimeEvent.create({
    data: {
      workspaceId: input.workspaceId,
      meetingId: meeting.id,
      opportunityId: meeting.opportunityId ?? undefined,
      companyId: meeting.companyId ?? undefined,
      relatedObjectType: "Meeting",
      relatedObjectId: meeting.id,
      eventType: "meeting.ended",
      status: RuntimeEventStatus.RUNNING,
      trustedContext: jsonStringify(buildTrustedContext(meeting)),
      untrustedContext: jsonStringify(buildUntrustedContext(meeting)),
      payload: jsonStringify({
        sourcePage: input.sourcePage ?? `/meetings/${meeting.id}`,
      }),
      sourceProvenance: jsonStringify(buildSourceProvenance(meeting)),
      triggeredBy: "human",
      startedAt: new Date(),
    },
  });

  try {
    const workerRun = await db.workerRun.create({
      data: {
        workspaceId: input.workspaceId,
        runtimeEventId: runtimeEvent.id,
        companyId: meeting.companyId ?? undefined,
        meetingId: meeting.id,
        opportunityId: meeting.opportunityId ?? undefined,
        agentId: MEETING_ANALYST_AGENT,
        status: WorkerRunStatus.RUNNING,
        inputSummary: "Convert the ended meeting into structured facts, draft memory, and a human-reviewable action pack.",
        startedAt: new Date(),
      },
    });

    const analyst = buildMeetingAnalystArtifacts(meeting);
    const created = await createRuntimeArtifacts({
      workspaceId: input.workspaceId,
      runtimeEventId: runtimeEvent.id,
      workerRunId: workerRun.id,
      meeting,
      analyst,
    });

    await db.workerRun.update({
      where: { id: workerRun.id },
      data: {
        status: WorkerRunStatus.COMPLETED,
        outputSummary: `Created meeting_facts.json, risk_flags.json, action_pack.md, memory_draft.jsonl for ${meeting.title}.`,
        evidenceRefs: jsonStringify(analyst.evidenceRefs),
        sourceProvenance: jsonStringify(analyst.sourceProvenance),
        confidence: analyst.confidence,
        openQuestions: jsonStringify(analyst.openQuestions),
        completedAt: new Date(),
      },
    });

    await syncMeetingRuntimeUpgradeIngest({
      workspaceId: input.workspaceId,
      runtimeEventId: runtimeEvent.id,
      meeting,
      sourcePage: input.sourcePage,
      artifactBundles: [created.factsBundle, created.riskBundle, created.actionPackBundle, created.memoryDraftBundle],
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
      usageType: UsageType.MEETING_PROCESSING,
      sourcePage: input.sourcePage ?? `/meetings/${meeting.id}`,
      metadata: {
        meetingId: meeting.id,
        operation: "helm_v2_meeting_ended_ingest",
        artifactBundleIds: [
          created.factsBundle.id,
          created.riskBundle.id,
          created.actionPackBundle.id,
          created.memoryDraftBundle.id,
        ],
      },
    });

    await writeAuditLog({
      workspaceId: input.workspaceId,
      userId: input.actorUserId,
      actor: input.actorName,
      actorType: ActorType.USER,
      actionType: "HELM_V2_MEETING_RUNTIME_INGESTED",
      targetType: "Meeting",
      targetId: meeting.id,
      summary: `Helm v2 ingested ${meeting.title} into the meeting-to-action runtime.`,
      payload: {
        runtimeEventId: runtimeEvent.id,
        artifactBundleIds: [
          created.factsBundle.id,
          created.riskBundle.id,
          created.actionPackBundle.id,
          created.memoryDraftBundle.id,
        ],
      },
      sourcePage: input.sourcePage ?? `/meetings/${meeting.id}`,
      relatedObjectType: "Opportunity",
      relatedObjectId: meeting.opportunityId ?? undefined,
    });

    return {
      runtimeEventId: runtimeEvent.id,
      workerRunId: workerRun.id,
      approvalRequestId: created.approvalRequest.id,
      artifactReviewId: created.artifactReview.id,
      actionPackBundleId: created.actionPackBundle.id,
      reused: false,
    };
  } catch (error) {
    await db.runtimeEvent.update({
      where: { id: runtimeEvent.id },
      data: {
        status: RuntimeEventStatus.FAILED,
        errorMessage: error instanceof Error ? error.message : "Meeting Analyst runtime failed",
        failedAt: new Date(),
      },
    });
    throw error;
  }
}

export async function confirmMeetingFactsRuntime(input: {
  workspaceId: string;
  meetingId: string;
  reviewerId: string;
  reviewerName: string;
  mode: ConfirmMode;
  edits?: ReviewEditsInput;
  sourcePage?: string;
}) {
  const meeting = await loadMeetingRuntimeMeeting(input.workspaceId, input.meetingId);
  if (!meeting || !meeting.note) {
    throw new Error("Meeting note is required before review.");
  }

  const actionPackBundle = await db.artifactBundle.findFirst({
    where: {
      workspaceId: input.workspaceId,
      meetingId: input.meetingId,
      artifactType: "action_pack.md",
    },
    orderBy: { createdAt: "desc" },
    include: {
      artifactReview: true,
      approvalRequest: true,
      runtimeEvent: true,
    },
  });

  if (!actionPackBundle?.artifactReview?.id || !actionPackBundle.runtimeEventId) {
    throw new Error("No pending Helm v2 action pack review was found for this meeting.");
  }

  const factsBundle = await db.artifactBundle.findFirst({
    where: {
      workspaceId: input.workspaceId,
      runtimeEventId: actionPackBundle.runtimeEventId,
      artifactType: "meeting_facts.json",
    },
    orderBy: { createdAt: "desc" },
  });
  const riskBundle = await db.artifactBundle.findFirst({
    where: {
      workspaceId: input.workspaceId,
      runtimeEventId: actionPackBundle.runtimeEventId,
      artifactType: "risk_flags.json",
    },
    orderBy: { createdAt: "desc" },
  });

  if (!factsBundle || !riskBundle || !actionPackBundle.approvalRequest) {
    throw new Error("Meeting runtime artifacts are incomplete and cannot be reviewed yet.");
  }

  const currentFacts = getLatestArtifactPayload<MeetingFactsArtifact>(factsBundle, {
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
  });
  const currentActionPack = safeParseJson<ActionPackBundleContent>(actionPackBundle.artifactsJson, {
    artifactId: "action_pack.md",
    markdown: "",
    boundary: ACTION_PACK_BOUNDARY_NOTE_CN,
    recommendedNextAction: "先由人工确认动作资料，再决定下一步。",
    openQuestions: [],
  });

  const nextFacts =
    input.mode === "edit_confirm" && input.edits?.factsJson
      ? {
          ...currentFacts,
          facts: safeParseJson<MeetingFactItem[]>(input.edits.factsJson, currentFacts.facts),
        }
      : currentFacts;
  const nextActionPack =
    input.mode === "edit_confirm" && input.edits?.actionPackMarkdown
      ? {
          ...currentActionPack,
          markdown: input.edits.actionPackMarkdown,
          recommendedNextAction: parseActionPackMarkdown(input.edits.actionPackMarkdown),
        }
      : currentActionPack;
  const reviewedAt = new Date();

  await db.artifactReview.update({
    where: { id: actionPackBundle.artifactReview.id },
    data: {
      status:
        input.mode === "reject"
          ? ArtifactReviewStatus.REJECTED
          : input.mode === "keep_draft"
            ? ArtifactReviewStatus.KEPT_DRAFT
            : ArtifactReviewStatus.CONFIRMED,
      reviewedByUserId: input.reviewerId,
      reviewNotes: input.edits?.reviewNotes ?? null,
      editedPayload: jsonStringify({
        facts: nextFacts.facts,
        actionPackMarkdown: nextActionPack.markdown,
      }),
      decisionSummary:
        input.mode === "reject"
          ? "Review rejected"
          : input.mode === "keep_draft"
            ? "Review kept as draft"
            : "Meeting facts confirmed and ready for downstream opportunity judgement",
      reviewedAt,
    },
  });

  if (input.mode === "keep_draft") {
    await updateBundlesForReview({
      meetingEndedEventId: actionPackBundle.runtimeEventId,
      reviewerId: input.reviewerId,
      reviewMode: input.mode,
      reviewedAt,
      factsArtifact: nextFacts,
      actionPack: nextActionPack,
      reviewNotes: input.edits?.reviewNotes,
    });

    await writeAuditLog({
      workspaceId: input.workspaceId,
      userId: input.reviewerId,
      actor: input.reviewerName,
      actorType: ActorType.USER,
      actionType: "HELM_V2_MEETING_FACTS_KEPT_DRAFT",
      targetType: "Meeting",
      targetId: input.meetingId,
      summary: `Meeting facts for ${meeting.title} were reviewed and intentionally kept as draft.`,
      payload: {
        runtimeEventId: actionPackBundle.runtimeEventId,
      },
      sourcePage: input.sourcePage ?? `/meetings/${input.meetingId}`,
    });

    const updatedBundles = await db.artifactBundle.findMany({
      where: {
        workspaceId: input.workspaceId,
        runtimeEventId: actionPackBundle.runtimeEventId,
        artifactType: {
          in: ["meeting_facts.json", "risk_flags.json", "action_pack.md"],
        },
      },
    });
    const updatedMemoryItems = await db.memoryItem.findMany({
      where: {
        workspaceId: input.workspaceId,
        runtimeEventId: actionPackBundle.runtimeEventId,
      },
    });

    await syncMeetingRuntimeUpgradeReview({
      workspaceId: input.workspaceId,
      runtimeEventId: actionPackBundle.runtimeEventId,
      meeting,
      reviewMode: input.mode,
      factsBundle: updatedBundles.find((bundle) => bundle.artifactType === "meeting_facts.json") ?? factsBundle,
      riskBundle: updatedBundles.find((bundle) => bundle.artifactType === "risk_flags.json") ?? riskBundle,
      actionPackBundle: updatedBundles.find((bundle) => bundle.artifactType === "action_pack.md") ?? actionPackBundle,
      memoryItems: updatedMemoryItems,
      reviewedAt,
      reviewerId: input.reviewerId,
      reviewerName: input.reviewerName,
      sourcePage: input.sourcePage ?? `/meetings/${input.meetingId}`,
    });

    return {
      ok: true,
      opportunityJudgeTriggered: false,
      reviewStatus: ArtifactReviewStatus.KEPT_DRAFT,
    };
  }

  await db.approvalRequest.update({
    where: { id: actionPackBundle.approvalRequest.id },
    data: {
      status: input.mode === "reject" ? ApprovalRequestStatus.REJECTED : ApprovalRequestStatus.APPROVED,
      resolvedByUserId: input.reviewerId,
      resolutionNotes: input.edits?.reviewNotes ?? null,
      resolvedAt: reviewedAt,
    },
  });

  await updateBundlesForReview({
    meetingEndedEventId: actionPackBundle.runtimeEventId,
    reviewerId: input.reviewerId,
    reviewMode: input.mode,
    reviewedAt,
    factsArtifact: nextFacts,
    actionPack: nextActionPack,
    reviewNotes: input.edits?.reviewNotes,
  });

  await updateMemoryItemsForReview({
    meetingEndedEventId: actionPackBundle.runtimeEventId,
    reviewedAt,
    reviewMode: input.mode,
    confirmedFacts: nextFacts.facts,
    actionPack: nextActionPack,
  });

  const auditAction =
    input.mode === "reject" ? "HELM_V2_MEETING_FACTS_REJECTED" : "HELM_V2_MEETING_FACTS_CONFIRMED";
  const auditSummary =
    input.mode === "reject"
      ? `Meeting facts for ${meeting.title} were rejected and kept out of promotion.`
      : `Meeting facts for ${meeting.title} were confirmed, promoted, and prepared for downstream judgement.`;

  await writeAuditLog({
    workspaceId: input.workspaceId,
    userId: input.reviewerId,
    actor: input.reviewerName,
    actorType: ActorType.USER,
    actionType: auditAction,
    targetType: "Meeting",
    targetId: input.meetingId,
    summary: auditSummary,
    payload: {
      runtimeEventId: actionPackBundle.runtimeEventId,
      reviewMode: input.mode,
    },
    sourcePage: input.sourcePage ?? `/meetings/${input.meetingId}`,
  });

  if (input.mode === "reject") {
    const updatedBundles = await db.artifactBundle.findMany({
      where: {
        workspaceId: input.workspaceId,
        runtimeEventId: actionPackBundle.runtimeEventId,
        artifactType: {
          in: ["meeting_facts.json", "risk_flags.json", "action_pack.md"],
        },
      },
    });
    const updatedMemoryItems = await db.memoryItem.findMany({
      where: {
        workspaceId: input.workspaceId,
        runtimeEventId: actionPackBundle.runtimeEventId,
      },
    });
    await syncMeetingRuntimeUpgradeReview({
      workspaceId: input.workspaceId,
      runtimeEventId: actionPackBundle.runtimeEventId,
      meeting,
      reviewMode: input.mode,
      factsBundle: updatedBundles.find((bundle) => bundle.artifactType === "meeting_facts.json") ?? factsBundle,
      riskBundle: updatedBundles.find((bundle) => bundle.artifactType === "risk_flags.json") ?? riskBundle,
      actionPackBundle: updatedBundles.find((bundle) => bundle.artifactType === "action_pack.md") ?? actionPackBundle,
      memoryItems: updatedMemoryItems,
      reviewedAt,
      reviewerId: input.reviewerId,
      reviewerName: input.reviewerName,
      sourcePage: input.sourcePage ?? `/meetings/${input.meetingId}`,
    });
    return {
      ok: true,
      opportunityJudgeTriggered: false,
      reviewStatus: ArtifactReviewStatus.REJECTED,
    };
  }

  const meetingFactsEventId = await createConfirmedMeetingFactsEvent({
    workspaceId: input.workspaceId,
    meeting,
    sourceEventId: actionPackBundle.runtimeEventId,
    reviewerId: input.reviewerId,
    reviewerName: input.reviewerName,
    confirmedFactsArtifact: nextFacts,
    sourceBundles: {
      factsBundleId: factsBundle.id,
      actionPackBundleId: actionPackBundle.id,
    },
  });

  const updatedBundles = await db.artifactBundle.findMany({
    where: {
      workspaceId: input.workspaceId,
      runtimeEventId: actionPackBundle.runtimeEventId,
      artifactType: {
        in: ["meeting_facts.json", "risk_flags.json", "action_pack.md"],
      },
    },
  });
  const updatedMemoryItems = await db.memoryItem.findMany({
    where: {
      workspaceId: input.workspaceId,
      runtimeEventId: actionPackBundle.runtimeEventId,
    },
  });

  await syncMeetingRuntimeUpgradeReview({
    workspaceId: input.workspaceId,
    runtimeEventId: actionPackBundle.runtimeEventId,
    meeting,
    reviewMode: input.mode,
    factsBundle: updatedBundles.find((bundle) => bundle.artifactType === "meeting_facts.json") ?? factsBundle,
    riskBundle: updatedBundles.find((bundle) => bundle.artifactType === "risk_flags.json") ?? riskBundle,
    actionPackBundle: updatedBundles.find((bundle) => bundle.artifactType === "action_pack.md") ?? actionPackBundle,
    memoryItems: updatedMemoryItems,
    reviewedAt,
    reviewerId: input.reviewerId,
    reviewerName: input.reviewerName,
    sourcePage: input.sourcePage ?? `/meetings/${input.meetingId}`,
  });

  let opportunityJudgeTriggered = false;

  if (meeting.opportunityId) {
    const { runOpportunityJudgeRuntime } = await import("@/lib/helm-v2/opportunity-judge-runtime");
    const result = await runOpportunityJudgeRuntime({
      workspaceId: input.workspaceId,
      meetingId: input.meetingId,
      actorName: input.reviewerName,
      actorUserId: input.reviewerId,
      sourcePage: input.sourcePage ?? `/meetings/${input.meetingId}`,
      force: false,
      sourceMeetingFactsEventId: meetingFactsEventId,
    });
    opportunityJudgeTriggered = Boolean(result.runtimeEventId);
  }

  return {
    ok: true,
    opportunityJudgeTriggered,
    reviewStatus: ArtifactReviewStatus.CONFIRMED,
  };
}

export async function getMeetingRuntimeSummary(workspaceId: string, meetingId: string): Promise<MeetingRuntimeSummary | null> {
  const meeting = await loadMeetingRuntimeMeeting(workspaceId, meetingId);
  if (!meeting) return null;

  const [meetingEndedEvent, meetingFactsEvent] = await Promise.all([
    db.runtimeEvent.findFirst({
      where: {
        workspaceId,
        meetingId,
        eventType: "meeting.ended",
      },
      orderBy: { createdAt: "desc" },
    }),
    db.runtimeEvent.findFirst({
      where: {
        workspaceId,
        meetingId,
        eventType: "meeting.facts_created",
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!meetingEndedEvent) {
    return null;
  }

  const [analystRun, judgeRun, bundles, memoryItems, v21] = await Promise.all([
    db.workerRun.findFirst({
      where: {
        runtimeEventId: meetingEndedEvent.id,
        agentId: MEETING_ANALYST_AGENT,
      },
      orderBy: { createdAt: "desc" },
    }),
    meetingFactsEvent
      ? db.workerRun.findFirst({
          where: {
            runtimeEventId: meetingFactsEvent.id,
            agentId: OPPORTUNITY_JUDGE_AGENT,
          },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve(null),
    db.artifactBundle.findMany({
      where: {
        workspaceId,
        OR: [
          { runtimeEventId: meetingEndedEvent.id },
          ...(meetingFactsEvent ? [{ runtimeEventId: meetingFactsEvent.id }] : []),
        ],
      },
      include: {
        approvalRequest: true,
        artifactReview: true,
      },
      orderBy: [{ createdAt: "asc" }],
    }),
    db.memoryItem.findMany({
      where: {
        workspaceId,
        OR: [
          { runtimeEventId: meetingEndedEvent.id },
          ...(meetingFactsEvent ? [{ runtimeEventId: meetingFactsEvent.id }] : []),
        ],
      },
      orderBy: [{ createdAt: "asc" }],
    }),
    getMeetingRuntimeUpgradeSummary(workspaceId, meetingId),
  ]);

  const findBundle = (artifactType: string) => bundles.find((bundle) => bundle.artifactType === artifactType) ?? null;
  const factsBundle = findBundle("meeting_facts.json");
  const riskBundle = findBundle("risk_flags.json");
  const actionPackBundle = findBundle("action_pack.md");
  const memoryDraftBundle = findBundle("memory_draft.jsonl");

  const editedPayload = safeParseJson<Record<string, unknown>>(actionPackBundle?.artifactReview?.editedPayload, {});
  const actionPackContent = actionPackBundle
    ? safeParseJson<ActionPackBundleContent>(actionPackBundle.artifactsJson, {
        artifactId: "action_pack.md",
        markdown: "",
        boundary: ACTION_PACK_BOUNDARY_NOTE_CN,
        recommendedNextAction: "",
        openQuestions: [],
      })
    : null;
  const factsContent = factsBundle ? getLatestArtifactPayload<MeetingFactsArtifact>(factsBundle, {
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
  }) : null;

  return {
    latestMeetingEndedEvent: {
      id: meetingEndedEvent.id,
      status: meetingEndedEvent.status,
      createdAt: meetingEndedEvent.createdAt,
      completedAt: meetingEndedEvent.completedAt,
      errorMessage: meetingEndedEvent.errorMessage,
    },
    latestMeetingFactsEvent: meetingFactsEvent
      ? {
          id: meetingFactsEvent.id,
          status: meetingFactsEvent.status,
          createdAt: meetingFactsEvent.createdAt,
          completedAt: meetingFactsEvent.completedAt,
          errorMessage: meetingFactsEvent.errorMessage,
        }
      : null,
    analystRun: analystRun
      ? {
          id: analystRun.id,
          status: analystRun.status,
          confidence: analystRun.confidence,
          openQuestions: safeParseJson<string[]>(analystRun.openQuestions, []),
          evidenceRefs: safeParseJson<string[]>(analystRun.evidenceRefs, []),
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
    approvalRequest: actionPackBundle?.approvalRequest
      ? {
          id: actionPackBundle.approvalRequest.id,
          status: actionPackBundle.approvalRequest.status,
          approvalTier: actionPackBundle.approvalRequest.approvalTier,
          requestedAction: actionPackBundle.approvalRequest.requestedAction,
          requestedReason: actionPackBundle.approvalRequest.requestedReason,
        }
      : null,
    artifactReview: actionPackBundle?.artifactReview
      ? {
          id: actionPackBundle.artifactReview.id,
          status: actionPackBundle.artifactReview.status,
          reviewedAt: actionPackBundle.artifactReview.reviewedAt,
          reviewNotes: actionPackBundle.artifactReview.reviewNotes,
        }
      : null,
    factsArtifact: factsBundle && factsContent
      ? {
          id: factsBundle.id,
          status: factsBundle.status,
          confidence: factsBundle.confidence,
          ...factsContent,
        }
      : null,
    riskArtifact: riskBundle
      ? {
          id: riskBundle.id,
          status: riskBundle.status,
          confidence: riskBundle.confidence,
          ...getLatestArtifactPayload<RiskFlagsArtifact>(riskBundle, {
            flags: [],
            boundaryNotes: [],
            requiresPromiseGuardReview: false,
          }),
        }
      : null,
    actionPack: actionPackBundle && actionPackContent
      ? {
          id: actionPackBundle.id,
          status: actionPackBundle.status,
          confidence: actionPackBundle.confidence,
          ...actionPackContent,
        }
      : null,
    memoryDraftArtifact: memoryDraftBundle
      ? {
          id: memoryDraftBundle.id,
          status: memoryDraftBundle.status,
          jsonl: String(safeParseJson<Record<string, unknown>>(memoryDraftBundle.artifactsJson, {}).jsonl ?? ""),
        }
      : null,
    editorDraft: factsContent && actionPackContent
      ? {
          factsJson: jsonStringify((editedPayload.facts as MeetingFactItem[]) ?? factsContent.facts),
          actionPackMarkdown: String(editedPayload.actionPackMarkdown ?? actionPackContent.markdown),
          reviewNotes: actionPackBundle?.artifactReview?.reviewNotes ?? "",
        }
      : null,
    promotedMemory: memoryItems
      .filter((item) => item.status === MemoryItemStatus.PROMOTED)
      .map((item) => ({
        id: item.id,
        kind: item.kind,
        summary: item.summary,
        verification: item.verification,
        promotedAt: item.promotedAt,
      })),
    draftMemory: memoryItems
      .filter((item) => item.status !== MemoryItemStatus.PROMOTED)
      .map((item) => ({
        id: item.id,
        kind: item.kind,
        summary: item.summary,
        verification: item.verification,
        status: item.status,
      })),
    opportunityShadow: meeting.opportunity
      ? {
          stage: meeting.opportunity.shadowStage,
          riskLevel: meeting.opportunity.shadowRiskLevel,
          nextAction: meeting.opportunity.shadowNextAction,
          blockersSummary: meeting.opportunity.shadowBlockersSummary,
          managerAttentionFlag: meeting.opportunity.shadowManagerAttentionFlag,
          stageConfidence: meeting.opportunity.shadowStageConfidence,
          updatedAt: meeting.opportunity.shadowUpdatedAt,
        }
      : null,
    v21,
  };
}

export function buildMeetingRuntimeMemoryContext(input: {
  workspaceSummary?: string | null;
  meetingTitle: string;
  opportunityTitle?: string | null;
  memoryItems: Array<Pick<MemoryItem, "summary" | "status" | "verification" | "meetingId" | "opportunityId" | "companyId">>;
}) {
  return [
    input.workspaceSummary ?? DEFAULT_WORKSPACE_SUMMARY,
    `当前会议：${input.meetingTitle}`,
    ...(input.opportunityTitle ? [`当前机会：${input.opportunityTitle}`] : []),
    ...input.memoryItems
      .filter((item) => item.status === MemoryItemStatus.PROMOTED && item.verification !== MemoryItemVerification.DEPRECATED)
      .map((item) => item.summary),
  ];
}

export function evaluateSprint2MeetingRuntime(input: {
  meeting: MeetingRuntimeMeeting;
  analyst: MeetingAnalystResult;
  delta: OpportunityShadowDelta;
  runtimeContext: string[];
}) {
  const extractionScore = Math.min(
    100,
    input.analyst.factsArtifact.facts.length * 20 +
      input.analyst.factsArtifact.nextActions.length * 10 +
      input.analyst.factsArtifact.decisions.length * 10,
  );
  const promiseSafety = input.analyst.actionPack.markdown.includes(ACTION_PACK_BOUNDARY_NOTE_CN) && !/自动发送|自动承诺/.test(input.analyst.actionPack.markdown);
  const memoryRelevance = input.runtimeContext.some((item) => item.includes(input.meeting.title)) && input.runtimeContext.length <= 8;
  const shadowJudgement = Boolean(input.delta.shadowNextAction) && Boolean(input.delta.shadowStageConfidence);

  return {
    extractionScore,
    promiseSafetyPass: promiseSafety,
    memoryRelevancePass: memoryRelevance,
    shadowJudgementPass: shadowJudgement,
    auditTraceable: input.analyst.evidenceRefs.length > 0,
  };
}
