import { addDays, subDays } from "date-fns";
import { ActorType, ObjectType, RecommendationFeedbackType } from "@prisma/client";
import { logEvent } from "@/lib/analytics";
import { writeAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { applyPatternPreferences } from "@/lib/evolution/preference-updater.service";
import { syncSkillSuggestions } from "@/lib/evolution/skill-suggestion.service";
import { syncStrategySuggestions } from "@/lib/evolution/strategy-suggestion.service";

const LOOKBACK_DAYS = 14;

type RefreshInput = {
  workspaceId: string;
  actorId?: string | null;
  actorType?: ActorType | string | null;
  sourcePage?: string | null;
  trigger?: string | null;
};

type PatternDraft = {
  scopeType: string;
  scopeId?: string | null;
  patternType: string;
  patternKey: string;
  patternValue: string;
  confidence: number;
  evidenceCount: number;
  title: string;
  summary: string;
  evidenceSnapshot: Record<string, unknown>;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function fingerprint(input: PatternDraft, workspaceId: string) {
  return [workspaceId, input.scopeType, input.scopeId ?? "workspace", input.patternType, input.patternKey, input.patternValue].join(":");
}

async function persistPatternFact(workspaceId: string, pattern: PatternDraft) {
  const nextFingerprint = fingerprint(pattern, workspaceId);
  const existing = await db.patternFact.findUnique({
    where: { fingerprint: nextFingerprint },
  });

  const changed =
    !existing ||
    existing.confidence !== pattern.confidence ||
    existing.evidenceCount !== pattern.evidenceCount ||
    existing.summary !== pattern.summary;

  const record = existing
    ? await db.patternFact.update({
        where: { id: existing.id },
        data: {
          confidence: pattern.confidence,
          evidenceCount: pattern.evidenceCount,
          title: pattern.title,
          summary: pattern.summary,
          evidenceSnapshot: JSON.stringify(pattern.evidenceSnapshot),
          status: "ACTIVE",
          lastDetectedAt: new Date(),
        },
      })
    : await db.patternFact.create({
        data: {
          workspaceId,
          fingerprint: nextFingerprint,
          scopeType: pattern.scopeType,
          scopeId: pattern.scopeId ?? undefined,
          patternType: pattern.patternType,
          patternKey: pattern.patternKey,
          patternValue: pattern.patternValue,
          confidence: pattern.confidence,
          evidenceCount: pattern.evidenceCount,
          title: pattern.title,
          summary: pattern.summary,
          evidenceSnapshot: JSON.stringify(pattern.evidenceSnapshot),
        },
      });

  if (changed) {
    await writeAuditLog({
      workspaceId,
      actor: "Adaptive Evolution",
      actorType: ActorType.SYSTEM,
      actionType: existing ? "PATTERN_FACT_UPDATED" : "PATTERN_FACT_CREATED",
      targetType: "PatternFact",
      targetId: record.id,
      summary: record.title ?? record.summary ?? "系统识别出新的稳定规律",
      payload: {
        patternType: record.patternType,
        patternKey: record.patternKey,
        patternValue: record.patternValue,
        confidence: record.confidence,
        evidenceCount: record.evidenceCount,
      },
      relatedObjectType: record.scopeType,
      relatedObjectId: record.scopeId,
    });

    await logEvent({
      workspaceId,
      eventName: existing ? "pattern_fact_updated" : "pattern_fact_created",
      eventCategory: "evolution",
      targetType: "PatternFact",
      targetId: record.id,
      metadata: {
        patternType: record.patternType,
        patternKey: record.patternKey,
        patternValue: record.patternValue,
        confidence: record.confidence,
        evidenceCount: record.evidenceCount,
      },
    });
  }

  return record;
}

function looksLikeBudget(text?: string | null) {
  const normalized = String(text ?? "").toLowerCase();
  return /(budget|付款|预算|采购评估|payment)/i.test(normalized);
}

async function detectPatterns(workspaceId: string): Promise<PatternDraft[]> {
  const windowStart = subDays(new Date(), LOOKBACK_DAYS);

  const [feedbacks, blockers, opportunities, meetings, contacts] = await Promise.all([
    db.recommendationFeedback.findMany({
      where: {
        workspaceId,
        createdAt: { gte: windowStart },
      },
      include: {
        recommendationLog: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    db.blocker.findMany({
      where: {
        workspaceId,
        createdAt: { gte: windowStart },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.opportunity.findMany({
      where: {
        workspaceId,
        stage: { notIn: ["DONE", "LOST"] },
      },
      orderBy: { updatedAt: "desc" },
    }),
    db.meeting.findMany({
      where: {
        workspaceId,
        startsAt: { gte: subDays(new Date(), 21) },
      },
      orderBy: { startsAt: "desc" },
    }),
    db.contact.findMany({
      where: {
        workspaceId,
        archivedAt: null,
        relationshipWarmth: {
          in: ["WARM", "HOT", "CHAMPION"],
        },
      },
      include: {
        company: true,
      },
      orderBy: {
        lastInteractionAt: "asc",
      },
    }),
  ]);

  const patterns: PatternDraft[] = [];
  const userFeedbackBuckets = new Map<string, typeof feedbacks>();

  for (const feedback of feedbacks) {
    if (!feedback.userId) continue;
    const bucket = userFeedbackBuckets.get(feedback.userId) ?? [];
    bucket.push(feedback);
    userFeedbackBuckets.set(feedback.userId, bucket);
  }

  for (const [userId, entries] of userFeedbackBuckets.entries()) {
    const outboundApprovals = entries.filter(
      (feedback) =>
        feedback.recommendationLog.actionType === "DRAFT_EXTERNAL_EMAIL" &&
        (feedback.feedbackType === RecommendationFeedbackType.APPROVED ||
          feedback.feedbackType === RecommendationFeedbackType.EDITED_AND_APPROVED) &&
        feedback.recommendationLog.policyResult !== "AUTO_WITHIN_THRESHOLD",
    );

    if (outboundApprovals.length >= 3) {
      patterns.push({
        scopeType: "USER",
        scopeId: userId,
        patternType: "approval_pattern",
        patternKey: "external_commitment",
        patternValue: "approval_required",
        confidence: clamp(62 + outboundApprovals.length * 6),
        evidenceCount: outboundApprovals.length,
        title: "系统观察到你会保留外发承诺类动作的人工审批",
        summary: "最近多次对外发承诺类动作保留人工审批，建议后续继续走审批链。",
        evidenceSnapshot: {
          feedbackIds: outboundApprovals.slice(0, 5).map((item) => item.id),
          actionType: "DRAFT_EXTERNAL_EMAIL",
        },
      });
    }

    const editedOutbound = entries.filter((feedback) =>
      feedback.recommendationLog.actionType === "DRAFT_EXTERNAL_EMAIL" &&
      feedback.feedbackType === RecommendationFeedbackType.EDITED_AND_APPROVED,
    );

    if (editedOutbound.length >= 3) {
      patterns.push({
        scopeType: "USER",
        scopeId: userId,
        patternType: "communication_style_pattern",
        patternKey: "outbound_message",
        patternValue: "concise_draft_preferred",
        confidence: clamp(64 + editedOutbound.length * 7),
        evidenceCount: editedOutbound.length,
        title: "系统观察到你更偏好简洁直接的外发文案",
        summary: "最近多次将外发消息改短后再批准，后续推荐会优先给出更简洁的草稿。",
        evidenceSnapshot: {
          feedbackIds: editedOutbound.slice(0, 5).map((item) => item.id),
          actionType: "DRAFT_EXTERNAL_EMAIL",
        },
      });
    }

    const meetingFollowups = entries.filter(
      (feedback) =>
        feedback.recommendationLog.objectType === ObjectType.MEETING &&
        (feedback.feedbackType === RecommendationFeedbackType.APPROVED ||
          feedback.feedbackType === RecommendationFeedbackType.EDITED_AND_APPROVED ||
          feedback.feedbackType === RecommendationFeedbackType.AUTO_EXECUTED),
    );

    const acceptedWithin24 = meetingFollowups.filter((feedback) => {
      const meeting = meetings.find((item) => item.id === feedback.recommendationLog.objectId);
      if (!meeting) return false;
      return feedback.createdAt <= addDays(meeting.startsAt, 1);
    });

    if (acceptedWithin24.length >= 2 && acceptedWithin24.length >= Math.ceil(meetingFollowups.length / 2)) {
      patterns.push({
        scopeType: "USER",
        scopeId: userId,
        patternType: "followup_timing_pattern",
        patternKey: "meeting_followup",
        patternValue: "within_24h_preferred",
        confidence: clamp(60 + acceptedWithin24.length * 8),
        evidenceCount: acceptedWithin24.length,
        title: "系统观察到会后 24 小时内的跟进更容易被采纳",
        summary: "你的团队在会后 24 小时内推进 follow-up 的采纳率更高，相关动作会被提前。",
        evidenceSnapshot: {
          feedbackIds: acceptedWithin24.map((item) => item.id),
          comparedCount: meetingFollowups.length,
        },
      });
    }
  }

  const budgetBlockers = blockers.filter((blocker) => looksLikeBudget(`${blocker.blockerType} ${blocker.title} ${blocker.blockerText}`));
  if (budgetBlockers.length >= 2) {
    patterns.push({
      scopeType: "WORKSPACE",
      patternType: "blocker_pattern",
      patternKey: "budget",
      patternValue: "high_frequency",
      confidence: clamp(58 + budgetBlockers.length * 8),
      evidenceCount: budgetBlockers.length,
      title: "预算相关阻塞在当前工作区中明显增多",
      summary: "最近两周里，预算与付款节奏相关阻塞已成为高频模式，风险提示和推进排序需要更前置。",
      evidenceSnapshot: {
        blockerIds: budgetBlockers.map((item) => item.id),
      },
    });
  }

  const staleByStage = new Map<string, typeof opportunities>();
  for (const opportunity of opportunities) {
    const lastProgressAt = opportunity.lastProgressAt ?? opportunity.updatedAt;
    if (lastProgressAt > subDays(new Date(), 5)) continue;
    const bucket = staleByStage.get(opportunity.stage) ?? [];
    bucket.push(opportunity);
    staleByStage.set(opportunity.stage, bucket);
  }

  for (const [stage, staleOpportunities] of staleByStage.entries()) {
    if (staleOpportunities.length < 2) continue;
    patterns.push({
      scopeType: "WORKSPACE",
      patternType: "stalled_opportunity_pattern",
      patternKey: stage,
      patternValue: "at_risk_after_5d",
      confidence: clamp(55 + staleOpportunities.length * 7),
      evidenceCount: staleOpportunities.length,
      title: `${stage} 阶段的机会超过 5 天未推进时容易掉速`,
      summary: `系统观察到 ${stage} 阶段的机会一旦超过 5 天未推进，就更容易进入停滞或降温窗口。`,
      evidenceSnapshot: {
        opportunityIds: staleOpportunities.map((item) => item.id),
      },
    });
  }

  const staleOpportunities = opportunities.filter((opportunity) => {
    if (!opportunity.lastProgressAt) return false;
    const stalledDays = Math.floor((Date.now() - opportunity.lastProgressAt.getTime()) / (24 * 60 * 60 * 1000));
    return opportunity.stage !== "DONE" && opportunity.stage !== "LOST" && stalledDays >= 5;
  });

  const stalledBuckets = staleOpportunities.reduce<Map<string, typeof staleOpportunities>>((acc, opportunity) => {
    const bucket = acc.get(opportunity.stage) ?? [];
    bucket.push(opportunity);
    acc.set(opportunity.stage, bucket);
    return acc;
  }, new Map());

  for (const [stage, stageOpportunities] of stalledBuckets.entries()) {
    if (stageOpportunities.length < 2) continue;
    patterns.push({
      scopeType: "WORKSPACE",
      patternType: "stalled_opportunity_pattern",
      patternKey: stage,
      patternValue: "stalled_after_5d",
      confidence: clamp(60 + stageOpportunities.length * 8),
      evidenceCount: stageOpportunities.length,
      title: `系统观察到 ${stage} 阶段的机会超过 5 天未推进时更容易掉速`,
      summary: `${stage} 阶段最近出现 ${stageOpportunities.length} 条停滞机会，建议把这类对象的风险前置。`,
      evidenceSnapshot: {
        opportunityIds: stageOpportunities.slice(0, 6).map((item) => item.id),
        stage,
      },
    });
  }

  const coolingContacts = contacts.filter((contact) => {
    if (!contact.lastInteractionAt) return false;
    const daysSinceTouch = Math.floor((Date.now() - contact.lastInteractionAt.getTime()) / (24 * 60 * 60 * 1000));
    return daysSinceTouch >= 7;
  });

  if (coolingContacts.length >= 2) {
    patterns.push({
      scopeType: "WORKSPACE",
      patternType: "contact_cooling_pattern",
      patternKey: "relationship_followup",
      patternValue: "within_48h_recovery",
      confidence: clamp(58 + coolingContacts.length * 7),
      evidenceCount: coolingContacts.length,
      title: "系统观察到温关系超过 7 天未触达时更容易降温",
      summary: `最近有 ${coolingContacts.length} 位暖关系联系人超过 7 天没有互动，建议把关系恢复动作提前。`,
      evidenceSnapshot: {
        contactIds: coolingContacts.slice(0, 6).map((item) => item.id),
        companyIds: coolingContacts.map((item) => item.companyId).filter(Boolean),
      },
    });
  }

  return patterns;
}

export async function refreshEvolutionState(input: RefreshInput) {
  const drafts = await detectPatterns(input.workspaceId);
  const records = [];

  for (const draft of drafts) {
    records.push(await persistPatternFact(input.workspaceId, draft));
  }

  await applyPatternPreferences({
    workspaceId: input.workspaceId,
    patterns: records.map((record) => ({
      ...record,
      scopeId: record.scopeId ?? null,
      title: record.title ?? null,
      summary: record.summary ?? null,
    })),
  });

  await syncStrategySuggestions({
    workspaceId: input.workspaceId,
    patterns: records.map((record) => ({
      ...record,
      scopeId: record.scopeId ?? null,
      title: record.title ?? null,
      summary: record.summary ?? null,
    })),
  });

  await syncSkillSuggestions({
    workspaceId: input.workspaceId,
    patterns: records.map((record) => ({
      ...record,
      scopeId: record.scopeId ?? null,
      title: record.title ?? null,
      summary: record.summary ?? null,
    })),
  });

  await logEvent({
    workspaceId: input.workspaceId,
    userId: input.actorId ?? undefined,
    eventName: "evolution_state_refreshed",
    eventCategory: "evolution",
    targetType: "Workspace",
    targetId: input.workspaceId,
    metadata: {
      trigger: input.trigger ?? null,
      patternCount: records.length,
    },
    sourcePage: input.sourcePage ?? undefined,
  });

  return records;
}
