import type {
  AskHelmGroundedObject,
  AskHelmNextStepTarget,
  AskHelmObjectType,
} from "@/features/search/ask-helm-interpreter";
import type { AskHelmIntentType } from "@/features/search/ask-helm-query-intent";
import type { AskHelmContextPacketMemorySummary } from "@/features/search/ask-helm-context-packet";
import { isEnglishLocale, type UiLocale } from "@/lib/i18n/config";
import { trimText } from "@/lib/utils";

export type AskHelmBusinessSignalKind =
  | "pending_review"
  | "overdue_followup"
  | "high_risk_opportunity"
  | "stale_opportunity"
  | "recent_memory";

export type AskHelmBusinessSignalReviewPosture =
  | "read_only"
  | "draft_only"
  | "review_required";

export type AskHelmBusinessSignalDraft = {
  id: string;
  kind: AskHelmBusinessSignalKind;
  title: string;
  reason: string;
  evidenceRefs: string[];
  primaryNextStep: AskHelmNextStepTarget;
  object?: AskHelmGroundedObject;
  reviewPosture: AskHelmBusinessSignalReviewPosture;
  boundaryNote: string;
  score: number;
};

export type AskHelmBusinessOpportunityRecord = {
  id: string;
  workspaceId?: string;
  title: string;
  stage: string;
  riskLevel: string;
  nextAction?: string | null;
  nextStepSummary?: string | null;
  dueDate?: Date | string | null;
  lastProgressAt?: Date | string | null;
  priorityScore?: number | null;
  shadowManagerAttentionFlag?: boolean | null;
  company?: { name: string } | null;
  owner?: { name: string; email?: string | null } | null;
};

export type AskHelmBusinessApprovalRecord = {
  id: string;
  isHighRisk?: boolean | null;
  reasoning?: string | null;
  createdAt?: Date | string | null;
  actionItem: {
    id: string;
    title: string;
    description?: string | null;
    aiReason?: string | null;
    riskLevel: string;
    dueDate?: Date | string | null;
    opportunityId?: string | null;
    contactId?: string | null;
    meetingId?: string | null;
    opportunity?: AskHelmBusinessOpportunityRecord | null;
    owner?: { name: string; email?: string | null } | null;
  };
};

export type AskHelmBusinessMemoryFactRecord = {
  id: string;
  workspaceId: string;
  objectType: string;
  objectId: string;
  factType: string;
  title: string;
  content: string;
  sourceType: string;
  sourceId: string;
  confidence: number;
  importance: number;
  freshnessScore: number;
  status: string;
  updatedAt?: Date | string | null;
};

export type AskHelmBusinessSignalBuilderInput = {
  workspaceId: string;
  locale?: UiLocale;
  now?: Date;
  opportunities?: AskHelmBusinessOpportunityRecord[];
  pendingApprovals?: AskHelmBusinessApprovalRecord[];
  memoryFacts?: AskHelmBusinessMemoryFactRecord[];
};

export type AskHelmBusinessSignalSelectionInput = {
  intentType: AskHelmIntentType;
  signals: AskHelmBusinessSignalDraft[];
  searchRelatedObjects: AskHelmGroundedObject[];
};

const OPEN_OPPORTUNITY_STAGES = new Set([
  "NEW",
  "CONTACTED",
  "ADVANCING",
  "WAITING_THEM",
  "INTERNAL_SYNC",
]);
const HIGH_RISK_LEVELS = new Set(["HIGH", "CRITICAL"]);
const MAX_SIGNALS = 5;
const STALE_PROGRESS_DAYS = 14;

export function buildAskHelmBusinessSignalsFromRecords(
  input: AskHelmBusinessSignalBuilderInput,
): AskHelmBusinessSignalDraft[] {
  const now = input.now ?? new Date();
  const english = input.locale ? isEnglishLocale(input.locale) : false;
  const signals: AskHelmBusinessSignalDraft[] = [];

  for (const approval of input.pendingApprovals ?? []) {
    signals.push(buildPendingReviewSignal(input.workspaceId, approval, english));
  }

  for (const opportunity of input.opportunities ?? []) {
    if (!OPEN_OPPORTUNITY_STAGES.has(opportunity.stage)) continue;

    if (isOverdue(opportunity.dueDate, now)) {
      signals.push(buildOverdueOpportunitySignal(input.workspaceId, opportunity, now, english));
      continue;
    }

    if (HIGH_RISK_LEVELS.has(opportunity.riskLevel)) {
      signals.push(buildHighRiskOpportunitySignal(input.workspaceId, opportunity, english));
      continue;
    }

    if (isStale(opportunity.lastProgressAt, now)) {
      signals.push(buildStaleOpportunitySignal(input.workspaceId, opportunity, now, english));
    }
  }

  for (const fact of input.memoryFacts ?? []) {
    const signal = buildRecentMemorySignal(input.workspaceId, fact, english);
    if (signal) signals.push(signal);
  }

  return dedupeSignals(signals)
    .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id))
    .slice(0, MAX_SIGNALS);
}

export function buildAskHelmMemorySummariesFromFacts(
  facts: AskHelmBusinessMemoryFactRecord[],
): AskHelmContextPacketMemorySummary[] {
  return facts.flatMap((fact) => {
    const objectType = toAskHelmObjectType(fact.objectType);
    if (!objectType) return [];

    return [
      {
        id: fact.id,
        workspaceId: fact.workspaceId,
        assetType: toMemoryAssetType(fact.factType),
        status: fact.status === "ACTIVE" ? "reviewed_active" : "candidate",
        objectRefs: [{ type: objectType, id: fact.objectId }],
        evidenceRefs: [
          `memory_fact:${fact.id}`,
          `${objectType}:${fact.objectId}`,
          `${fact.sourceType}:${fact.sourceId}`,
        ],
        summaryToken: `${fact.title}: ${trimText(fact.content, 120)}`,
        freshness: fact.freshnessScore >= 60 ? "fresh" : "stale",
        sourceStrength:
          fact.confidence >= 75 ? "strong" : fact.confidence >= 50 ? "medium" : "weak",
        contradictionStatus: fact.status === "INVALID" ? "confirmed" : "none",
      },
    ];
  });
}

export function mergeAskHelmGroundedObjects(
  objects: AskHelmGroundedObject[],
): AskHelmGroundedObject[] {
  const seen = new Set<string>();
  const merged: AskHelmGroundedObject[] = [];

  for (const object of objects) {
    const key = `${object.objectType}:${object.objectId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(object);
  }

  return merged;
}

export function summarizeAskHelmBusinessSignals(
  signals: AskHelmBusinessSignalDraft[],
  limit = 5,
): string[] {
  return signals.slice(0, limit).map((signal) => signal.title);
}

export function pickAskHelmTopBusinessSignal(
  signals: AskHelmBusinessSignalDraft[],
): AskHelmBusinessSignalDraft | undefined {
  return signals[0];
}

export function selectAskHelmBusinessSignalsForQuestion({
  signals,
  searchRelatedObjects,
}: AskHelmBusinessSignalSelectionInput): AskHelmBusinessSignalDraft[] {
  if (!signals.length) return [];

  const searchObjectKeys = new Set(
    searchRelatedObjects.map((object) => `${object.objectType}:${object.objectId}`),
  );
  const matchedSignals = signals.filter((signal) => {
    if (!signal.object) return false;
    return searchObjectKeys.has(`${signal.object.objectType}:${signal.object.objectId}`);
  });

  if (matchedSignals.length) return matchedSignals;

  if (searchObjectKeys.size > 0) {
    return [];
  }

  return signals;
}

function buildPendingReviewSignal(
  workspaceId: string,
  approval: AskHelmBusinessApprovalRecord,
  english: boolean,
): AskHelmBusinessSignalDraft {
  const item = approval.actionItem;
  const object = item.opportunity
    ? opportunityToGroundedObject(item.opportunity)
    : undefined;
  const title = english
    ? approval.isHighRisk
      ? `High-risk review pending: ${item.title}`
      : `Review pending: ${item.title}`
    : approval.isHighRisk
      ? `高风险复核待处理：${item.title}`
      : `复核待处理：${item.title}`;

  return {
    id: `approval:${approval.id}`,
    kind: "pending_review",
    title,
    reason:
      approval.reasoning ??
      item.aiReason ??
      item.description ??
      (english
        ? "A review item is waiting for human confirmation. Check the evidence and boundary before continuing."
        : "存在等待人工确认的复核项，需要先看证据与边界再继续推进。"),
    evidenceRefs: [
      `workspace:${workspaceId}`,
      `approval:${approval.id}`,
      `action_item:${item.id}`,
      ...(item.opportunityId ? [`opportunity:${item.opportunityId}`] : []),
      ...(item.contactId ? [`contact:${item.contactId}`] : []),
      ...(item.meetingId ? [`meeting:${item.meetingId}`] : []),
    ],
    primaryNextStep: {
      type: "page_target",
      target: "/approvals",
      label: english ? "Open the review page" : "打开复核页面确认",
    },
    object,
    reviewPosture: "review_required",
    boundaryNote: english
      ? "This is a review signal draft. It only indicates that human confirmation is required; it does not auto-approve, send, commit, or write back to an official system."
      : "这是复核信号草稿，只提示需要人工确认；不会自动批准、发送、承诺或写回正式系统。",
    score: approval.isHighRisk || HIGH_RISK_LEVELS.has(item.riskLevel) ? 100 : 92,
  };
}

function buildOverdueOpportunitySignal(
  workspaceId: string,
  opportunity: AskHelmBusinessOpportunityRecord,
  now: Date,
  english: boolean,
): AskHelmBusinessSignalDraft {
  const days = daysSince(opportunity.dueDate, now);
  const object = opportunityToGroundedObject(opportunity);

  return {
    id: `opportunity-overdue:${opportunity.id}`,
    kind: "overdue_followup",
    title: english
      ? `${opportunityLabel(opportunity)} is ${formatEnglishDayCount(Math.max(days, 1))} past its follow-up window`
      : `${opportunityLabel(opportunity)} 已超过推进时间 ${Math.max(days, 1)} 天`,
    reason:
      opportunity.nextAction ??
      opportunity.nextStepSummary ??
      (english
        ? "The opportunity has an overdue next step. Confirm customer waiting state, internal owner, and whether review escalation is needed."
        : "机会存在到期未承接的下一步，需要确认客户等待、内部负责人和是否升级复核。"),
    evidenceRefs: [`workspace:${workspaceId}`, `opportunity:${opportunity.id}`],
    primaryNextStep: {
      type: "page_target",
      target: "/operating",
      label: english ? "Open the operating workspace" : "打开经营总盘承接",
    },
    object,
    reviewPosture: HIGH_RISK_LEVELS.has(opportunity.riskLevel)
      ? "review_required"
      : "draft_only",
    boundaryNote: english
      ? "This is an operating progress signal draft. It suggests a handoff and review path; it is not a formal commitment to the customer or team."
      : "这是经营推进信号草稿，只建议承接和复核路径；不等于对客户或团队的正式承诺。",
    score:
      88 +
      Math.min(days, 10) +
      (HIGH_RISK_LEVELS.has(opportunity.riskLevel) ? 6 : 0),
  };
}

function buildHighRiskOpportunitySignal(
  workspaceId: string,
  opportunity: AskHelmBusinessOpportunityRecord,
  english: boolean,
): AskHelmBusinessSignalDraft {
  const object = opportunityToGroundedObject(opportunity);

  return {
    id: `opportunity-risk:${opportunity.id}`,
    kind: "high_risk_opportunity",
    title: english
      ? `${opportunityLabel(opportunity)} needs manager attention`
      : `${opportunityLabel(opportunity)} 需要主管关注`,
    reason:
      opportunity.nextAction ??
      opportunity.nextStepSummary ??
      (english
        ? "The opportunity risk level is high. Check blockers, customer expectations, and whether the next step needs review."
        : "机会风险等级较高，需要核对阻塞、客户预期和下一步是否需要复核。"),
    evidenceRefs: [`workspace:${workspaceId}`, `opportunity:${opportunity.id}`],
    primaryNextStep: {
      type: "page_target",
      target: "/operating",
      label: english ? "Open the operating workspace" : "打开经营总盘确认风险",
    },
    object,
    reviewPosture: "review_required",
    boundaryNote: english
      ? "High-risk opportunities only create review priority. They do not auto-escalate, commit, send externally, or modify CRM/official status."
      : "高风险机会只生成复核优先级，不自动升级、承诺、外发或修改 CRM/正式状态。",
    score: opportunity.riskLevel === "CRITICAL" ? 94 : 88,
  };
}

function buildStaleOpportunitySignal(
  workspaceId: string,
  opportunity: AskHelmBusinessOpportunityRecord,
  now: Date,
  english: boolean,
): AskHelmBusinessSignalDraft {
  const days = daysSince(opportunity.lastProgressAt, now);
  const object = opportunityToGroundedObject(opportunity);

  return {
    id: `opportunity-stale:${opportunity.id}`,
    kind: "stale_opportunity",
    title: english
      ? `${opportunityLabel(opportunity)} has had no new progress for ${formatEnglishDayCount(Math.max(days, STALE_PROGRESS_DAYS))}`
      : `${opportunityLabel(opportunity)} ${Math.max(days, STALE_PROGRESS_DAYS)} 天未见新进展`,
    reason:
      opportunity.nextAction ??
      opportunity.nextStepSummary ??
      (english
        ? "The opportunity has no recent progress record. Confirm whether this is customer silence, an internal blocker, or a downgrade candidate."
        : "机会长期没有进展记录，需要判断是客户沉默、内部卡点还是应降级处理。"),
    evidenceRefs: [`workspace:${workspaceId}`, `opportunity:${opportunity.id}`],
    primaryNextStep: {
      type: "page_target",
      target: "/operating",
      label: english ? "Open the operating workspace" : "打开经营总盘跟进",
    },
    object,
    reviewPosture: "draft_only",
    boundaryNote: english
      ? "Silence signals only indicate that the reason should be checked. They do not auto-change opportunity stage or send externally before human confirmation."
      : "沉默信号只提示需要核实原因；在人工确认前不自动改变机会阶段或对外发送。",
    score: 74 + Math.min(Math.floor(days / 3), 8),
  };
}

function buildRecentMemorySignal(
  workspaceId: string,
  fact: AskHelmBusinessMemoryFactRecord,
  english: boolean,
): AskHelmBusinessSignalDraft | null {
  const objectType = toAskHelmObjectType(fact.objectType);
  if (!objectType || fact.status !== "ACTIVE") return null;
  if (fact.importance < 70 && fact.factType !== "BLOCKER" && fact.factType !== "COMMITMENT") {
    return null;
  }

  return {
    id: `memory-fact:${fact.id}`,
    kind: "recent_memory",
    title: english ? `Memory prompt: ${fact.title}` : `记忆提示：${fact.title}`,
    reason: trimText(fact.content, 120),
    evidenceRefs: [
      `workspace:${workspaceId}`,
      `memory_fact:${fact.id}`,
      `${objectType}:${fact.objectId}`,
    ],
    primaryNextStep: {
      type: "page_target",
      target: "/memory",
      label: english ? "Open operating memory" : "打开经营记忆核对",
    },
    object: {
      objectType,
      objectId: fact.objectId,
      displayName: fact.title,
      status: fact.factType,
      deepLink: objectDeepLink(objectType, fact.objectId),
    },
    reviewPosture: fact.factType === "BLOCKER" ? "review_required" : "read_only",
    boundaryNote: english
      ? "Memory prompts must defer to reviewed facts. If they conflict with current object state, correct them on the memory page first."
      : "记忆提示必须以已复核事实为准；如与当前对象状态冲突，应先在记忆页更正。",
    score:
      58 +
      Math.min(Math.floor(fact.importance / 10), 10) +
      (fact.factType === "BLOCKER" ? 10 : 0),
  };
}

function opportunityToGroundedObject(
  opportunity: AskHelmBusinessOpportunityRecord,
): AskHelmGroundedObject {
  return {
    objectType: "opportunity",
    objectId: opportunity.id,
    displayName: opportunityLabel(opportunity),
    status: opportunity.stage,
    deepLink: `/opportunities?opportunityId=${opportunity.id}`,
  };
}

function opportunityLabel(opportunity: AskHelmBusinessOpportunityRecord) {
  return opportunity.company?.name
    ? `${opportunity.company.name} · ${opportunity.title}`
    : opportunity.title;
}

function formatEnglishDayCount(days: number) {
  return `${days} ${days === 1 ? "day" : "days"}`;
}

function objectDeepLink(type: AskHelmObjectType, id: string) {
  switch (type) {
    case "contact":
      return `/contacts/${id}`;
    case "company":
      return `/companies/${id}`;
    case "meeting":
      return `/meetings/${id}`;
    case "opportunity":
      return `/opportunities?opportunityId=${id}`;
  }
}

function toAskHelmObjectType(value: string): AskHelmObjectType | null {
  if (value === "CONTACT") return "contact";
  if (value === "COMPANY") return "company";
  if (value === "OPPORTUNITY") return "opportunity";
  if (value === "MEETING") return "meeting";
  return null;
}

function toMemoryAssetType(
  factType: string,
): AskHelmContextPacketMemorySummary["assetType"] {
  if (factType === "BLOCKER" || factType === "RISK_SIGNAL") return "boundary";
  if (factType === "COMMITMENT") return "decision";
  if (factType === "NEXT_STEP") return "intent";
  if (factType === "POLICY_PATTERN" || factType === "ACTION_PATTERN") {
    return "pattern";
  }
  if (factType === "STAGE_SIGNAL") return "judgement";
  return "fact";
}

function isOverdue(value: Date | string | null | undefined, now: Date) {
  const date = toDate(value);
  return Boolean(date && date.getTime() < now.getTime());
}

function isStale(value: Date | string | null | undefined, now: Date) {
  const date = toDate(value);
  if (!date) return false;
  return daysSince(date, now) >= STALE_PROGRESS_DAYS;
}

function daysSince(value: Date | string | null | undefined, now: Date) {
  const date = toDate(value);
  if (!date) return 0;
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / 86_400_000));
}

function toDate(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? null : date;
}

function dedupeSignals(signals: AskHelmBusinessSignalDraft[]) {
  const bestByKey = new Map<string, AskHelmBusinessSignalDraft>();

  for (const signal of signals) {
    const key = signal.object
      ? `${signal.object.objectType}:${signal.object.objectId}`
      : signal.id;
    const previous = bestByKey.get(key);
    if (!previous || signal.score > previous.score) {
      bestByKey.set(key, signal);
    }
  }

  return Array.from(bestByKey.values());
}
