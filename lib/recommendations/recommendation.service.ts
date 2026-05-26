import {
  ActionExecutionMode,
  ActionType,
  ActorType,
  ObjectType,
  RecommendationStatus,
  RiskLevel,
  type RecommendationLog,
} from "@prisma/client";
import { differenceInCalendarDays, endOfDay, isBefore, startOfDay, subDays } from "date-fns";
import { actionModeLabels } from "@/data/constants";
import { logEvent } from "@/lib/analytics";
import { writeAuditLog } from "@/lib/audit";
import { assertWorkspaceInsightServiceAccess } from "@/lib/auth/service-governance";
import { db } from "@/lib/db";
import {
  isWriteConflictError,
  runWithWriteConflictRetry,
} from "@/lib/db/conflict-aware-write";
import { enhanceRecommendationExplanationWithLLM } from "@/lib/llm-workflows/enhance-recommendation-explanation.workflow";
import { getActivePatternFacts } from "@/lib/evolution/evolution-insights.service";
import { buildMemoryRecommendationEvidence } from "@/lib/memory/memory-recommendation-bridge.service";
import { createGovernedAction } from "@/lib/policies/engine";
import type { MemoryActorContext, ObjectReference } from "@/lib/memory/shared";
import { jsonStringify, safeParseJson, trimText } from "@/lib/utils";
import { buildRecommendationExplanation } from "@/lib/recommendations/recommendation-explanation.service";
import { buildRecommendationPresentationPayload } from "@/lib/recommendations/recommendation-presentation";
import { readRecommendationPresentation } from "@/lib/recommendations/recommendation-presentation";
import { getRecommendationCandidates } from "@/lib/recommendations/recommendation-candidates.service";
import { rankRecommendationCandidates, summarizePreferenceSignals } from "@/lib/recommendations/recommendation-ranking.service";
import type {
  RecommendationEvidence,
  RecommendationObjectContext,
  RecommendationOutput,
} from "@/lib/recommendations/types";

type GenerateRecommendationsInput = MemoryActorContext & {
  objectType: ObjectType;
  objectId: string;
  limit?: number;
  persist?: boolean;
  captureTelemetry?: boolean;
  english?: boolean;
  llmEnhancement?: boolean;
};

type TodayFocusItem = RecommendationOutput & {
  objectLabel: string;
};

const RECOMMENDATION_PERSISTENCE_MAX_ATTEMPTS = 3;
const RECOMMENDATION_PERSISTENCE_RETRY_DELAY_MS = 25;

// Re-exported under the historical name so external callers / tests keep
// working; delegates to the centralized helper in lib/db/conflict-aware-write.
export const isRecommendationPersistenceConflict = isWriteConflictError;

function roleWeightFromTitle(title?: string | null) {
  const normalized = title?.toLowerCase() ?? "";
  if (/founder|ceo|coo|vp|head|负责人|总监|合伙人/.test(normalized)) return 92;
  if (/manager|lead|经理|招聘/.test(normalized)) return 76;
  return 58;
}

function normalizeDaysSince(date?: Date | null) {
  if (!date) return 7;
  return Math.max(0, differenceInCalendarDays(new Date(), date));
}

async function loadRecommendationContext(workspaceId: string, objectType: ObjectType, objectId: string): Promise<RecommendationObjectContext> {
  switch (objectType) {
    case ObjectType.CONTACT: {
      const contact = await db.contact.findFirst({
        where: { workspaceId, id: objectId },
        include: {
          company: true,
          opportunities: {
            orderBy: [{ priorityScore: "desc" }, { updatedAt: "desc" }],
            take: 1,
          },
        },
      });

      if (!contact) throw new Error("Contact not found");

      return {
        workspaceId,
        objectType,
        objectId,
        objectLabel: contact.name,
        contactId: contact.id,
        companyId: contact.companyId,
        opportunityId: contact.opportunities[0]?.id,
        ownerId: contact.ownerId,
        daysSinceLastTouch: normalizeDaysSince(contact.lastInteractionAt),
        dueSoon: false,
        baseRiskLevel: contact.opportunities[0]?.riskLevel ?? RiskLevel.MEDIUM,
        priorityScore: contact.opportunities[0]?.priorityScore ?? Math.max(45, contact.relationshipTemperature),
        roleWeight: roleWeightFromTitle(contact.title),
        stageLabel: contact.relationshipStage,
        notes: contact.notes,
      };
    }
    case ObjectType.COMPANY: {
      const company = await db.company.findFirst({
        where: { workspaceId, id: objectId },
        include: {
          opportunities: {
            where: { stage: { notIn: ["DONE", "LOST"] } },
            orderBy: [{ priorityScore: "desc" }, { updatedAt: "desc" }],
            take: 2,
          },
          contacts: {
            where: { archivedAt: null },
            take: 5,
          },
        },
      });

      if (!company) throw new Error("Company not found");

      const topOpportunity = company.opportunities[0];
      return {
        workspaceId,
        objectType,
        objectId,
        objectLabel: company.name,
        companyId: company.id,
        opportunityId: topOpportunity?.id,
        ownerId: topOpportunity?.ownerId,
        daysSinceLastTouch: normalizeDaysSince(company.lastInteractionAt),
        dueSoon: Boolean(topOpportunity?.dueDate && isBefore(topOpportunity.dueDate, endOfDay(subDays(new Date(), -2)))),
        baseRiskLevel: topOpportunity?.riskLevel ?? RiskLevel.MEDIUM,
        priorityScore: topOpportunity?.priorityScore ?? Math.max(40, company.maturityScore),
        roleWeight: Math.max(...company.contacts.map((contact) => roleWeightFromTitle(contact.title)), 62),
        stageLabel: company.cooperationMaturity,
        notes: company.description,
      };
    }
    case ObjectType.OPPORTUNITY: {
      const opportunity = await db.opportunity.findFirst({
        where: { workspaceId, id: objectId },
        include: {
          company: true,
          contacts: true,
        },
      });

      if (!opportunity) throw new Error("Opportunity not found");

      return {
        workspaceId,
        objectType,
        objectId,
        objectLabel: opportunity.title,
        companyId: opportunity.companyId,
        contactId: opportunity.contacts[0]?.id,
        opportunityId: opportunity.id,
        ownerId: opportunity.ownerId,
        daysSinceLastTouch: normalizeDaysSince(opportunity.lastProgressAt ?? opportunity.updatedAt),
        dueSoon: Boolean(opportunity.dueDate && isBefore(opportunity.dueDate, endOfDay(subDays(new Date(), -2)))),
        baseRiskLevel: opportunity.riskLevel,
        priorityScore: opportunity.priorityScore,
        roleWeight: Math.max(...opportunity.contacts.map((contact) => roleWeightFromTitle(contact.title)), 68),
        stageLabel: opportunity.stage,
        notes: opportunity.nextAction,
      };
    }
    case ObjectType.MEETING: {
      const meeting = await db.meeting.findFirst({
        where: { workspaceId, id: objectId },
        include: {
          opportunity: true,
          contacts: true,
          note: true,
          company: true,
        },
      });

      if (!meeting) throw new Error("Meeting not found");

      return {
        workspaceId,
        objectType,
        objectId,
        objectLabel: meeting.title,
        companyId: meeting.companyId,
        contactId: meeting.contacts[0]?.id,
        opportunityId: meeting.opportunityId,
        meetingId: meeting.id,
        ownerId: meeting.ownerId,
        daysSinceLastTouch: normalizeDaysSince(meeting.startsAt),
        dueSoon: isBefore(meeting.startsAt, endOfDay(subDays(new Date(), -1))),
        baseRiskLevel: meeting.opportunity?.riskLevel ?? RiskLevel.MEDIUM,
        priorityScore: meeting.opportunity?.priorityScore ?? 72,
        roleWeight: Math.max(...meeting.contacts.map((contact) => roleWeightFromTitle(contact.title)), 70),
        stageLabel: meeting.opportunity?.stage ?? meeting.status,
        notes: meeting.note?.summary ?? meeting.agenda,
      };
    }
    default:
      throw new Error("Unsupported recommendation object type");
  }
}

async function loadRecommendationEvidence(
  workspaceId: string,
  objectRefs: ObjectReference[],
  primaryRef: ObjectReference,
): Promise<RecommendationEvidence> {
  return buildMemoryRecommendationEvidence({
    workspaceId,
    objectRefs,
    primaryRef,
  });
}

async function getObjectReferences(context: RecommendationObjectContext): Promise<ObjectReference[]> {
  return [
    { objectType: context.objectType, objectId: context.objectId },
    ...(context.contactId && context.objectType !== ObjectType.CONTACT ? [{ objectType: ObjectType.CONTACT, objectId: context.contactId }] : []),
    ...(context.companyId && context.objectType !== ObjectType.COMPANY ? [{ objectType: ObjectType.COMPANY, objectId: context.companyId }] : []),
    ...(context.opportunityId && context.objectType !== ObjectType.OPPORTUNITY ? [{ objectType: ObjectType.OPPORTUNITY, objectId: context.opportunityId }] : []),
    ...(context.meetingId && context.objectType !== ObjectType.MEETING ? [{ objectType: ObjectType.MEETING, objectId: context.meetingId }] : []),
  ];
}

function mapRecommendationLog(log: RecommendationLog): RecommendationOutput {
  const payload = safeParseJson<Record<string, unknown> | null>(log.recommendationPayload, null);
  const appliedPolicyRules = safeParseJson<Array<{ name: string | null; mode: ActionExecutionMode | null; reason: string }>>(
    typeof payload?.appliedPolicyRules === "string" ? (payload.appliedPolicyRules as string) : JSON.stringify(payload?.appliedPolicyRules ?? []),
    [],
  );

  return {
    recommendationId: log.id,
    objectType: log.objectType,
    objectId: log.objectId,
    actionType: log.actionType,
    title: log.title,
    description: log.description,
    score: log.score,
    urgencyScore: log.urgencyScore,
    impactScore: log.impactScore,
    confidenceScore: log.confidenceScore,
    personalizationScore: log.personalizationScore,
    policyFitScore: log.policyFitScore,
    riskScore: log.riskScore,
    policyResult: log.policyResult,
    supportingFactIds: safeParseJson<string[]>(log.supportingFactIds, []),
    blockerIds: safeParseJson<string[]>(log.blockerIds, []),
    commitmentIds: safeParseJson<string[]>(log.commitmentIds, []),
    explanation: log.explanation,
    appliedPolicyRules,
    whyNotAutoExecute: typeof payload?.whyNotAutoExecute === "string" ? payload.whyNotAutoExecute : null,
    status: log.status,
    createdAt: log.createdAt,
    recommendationPayload: payload,
  };
}

async function persistRecommendations(input: {
  workspaceId: string;
  userId?: string | null;
  objectType: ObjectType;
  objectId: string;
  recommendations: Array<ReturnType<typeof buildRecommendationExplanation> & {
    actionType: ActionType;
    title: string;
    description: string;
    score: number;
    urgencyScore: number;
    impactScore: number;
    confidenceScore: number;
    personalizationScore: number;
    policyFitScore: number;
    riskScore: number;
    policyResult: ActionExecutionMode;
    payload: Record<string, unknown>;
  }>;
}) {
  return runWithWriteConflictRetry(
    () =>
      db.$transaction(async (tx) => {
        await tx.recommendationLog.updateMany({
          where: {
            workspaceId: input.workspaceId,
            userId: input.userId ?? null,
            objectType: input.objectType,
            objectId: input.objectId,
            status: RecommendationStatus.ACTIVE,
          },
          data: {
            status: RecommendationStatus.EXPIRED,
          },
        });

        const created = [];
        for (const recommendation of input.recommendations) {
          const record = await tx.recommendationLog.create({
            data: {
              workspaceId: input.workspaceId,
              userId: input.userId ?? undefined,
              objectType: input.objectType,
              objectId: input.objectId,
              actionType: recommendation.actionType,
              title: recommendation.title,
              description: recommendation.description,
              recommendationPayload: jsonStringify(recommendation.payload),
              score: recommendation.score,
              urgencyScore: recommendation.urgencyScore,
              impactScore: recommendation.impactScore,
              confidenceScore: recommendation.confidenceScore,
              personalizationScore: recommendation.personalizationScore,
              policyFitScore: recommendation.policyFitScore,
              riskScore: recommendation.riskScore,
              policyResult: recommendation.policyResult,
              supportingFactIds: jsonStringify(recommendation.supportingFactIds),
              blockerIds: jsonStringify(recommendation.blockerIds),
              commitmentIds: jsonStringify(recommendation.commitmentIds),
              explanation: recommendation.explanation,
            },
          });

          created.push(record);
        }

        return created;
      }),
    {
      maxAttempts: RECOMMENDATION_PERSISTENCE_MAX_ATTEMPTS,
      retryDelayMs: RECOMMENDATION_PERSISTENCE_RETRY_DELAY_MS,
    },
  );
}

export async function generateRecommendationsForObject(input: GenerateRecommendationsInput) {
  await assertWorkspaceInsightServiceAccess({
    workspaceId: input.workspaceId,
    userId: input.actorUserId,
    actorType: input.actorType,
    english: input.english ?? false,
  });

  const context = await loadRecommendationContext(input.workspaceId, input.objectType, input.objectId);
  const objectRefs = await getObjectReferences(context);
  const evidence = await loadRecommendationEvidence(input.workspaceId, objectRefs, {
    objectType: input.objectType,
    objectId: input.objectId,
  });
  const [policies, preferenceSignals, patternFacts] = await Promise.all([
    db.policyRule.findMany({
      where: { workspaceId: input.workspaceId, enabled: true },
    }),
    db.preferenceSignal.findMany({
      where: {
        workspaceId: input.workspaceId,
        userId: input.actorUserId ?? undefined,
      },
      orderBy: { updatedAt: "desc" },
      take: 30,
    }),
    getActivePatternFacts({
      workspaceId: input.workspaceId,
      userId: input.actorUserId,
      limit: 12,
    }),
  ]);

  const candidates = getRecommendationCandidates({ context, evidence });
  const preferenceSummary = summarizePreferenceSignals(preferenceSignals);
  const ranked = rankRecommendationCandidates({
    context,
    evidence,
    candidates,
    policies,
    preferenceSummary,
    patternFacts: patternFacts.map((item) => ({
      id: item.id,
      scopeType: item.scopeType,
      scopeId: item.scopeId ?? null,
      patternType: item.patternType,
      patternKey: item.patternKey,
      patternValue: item.patternValue,
      confidence: item.confidence,
      evidenceCount: item.evidenceCount,
      title: item.title ?? null,
      summary: item.summary ?? null,
    })),
  });

  const limited = ranked.slice(0, input.limit ?? 3);
  const topCandidate = ranked[0] ?? limited[0] ?? null;
  const shouldEnhanceWithLLM = input.llmEnhancement ?? false;
  const withExplanation = await Promise.all(limited.map(async (item, rankIndex) => {
    const explanation = buildRecommendationExplanation({
      context,
      evidence,
      ranked: item,
    });
    const presentationPayload = buildRecommendationPresentationPayload({
      context,
      evidence,
      ranked: item,
      preferenceSummary,
      rankIndex,
      topCandidate: topCandidate ?? item,
    });
    const llmEnhanced = shouldEnhanceWithLLM
      ? await enhanceRecommendationExplanationWithLLM({
          workspaceId: input.workspaceId,
          userId: input.actorUserId,
          objectLabel: context.objectLabel,
          recommendationTitle: item.title,
          recommendationDescription: item.description,
          deterministicExplanation: explanation.explanation,
          policyResultLabel: actionModeLabels[item.policyResult],
          fallback: {
            explanation: explanation.explanation,
            whyNow: presentationPayload.whyNow,
            expectedImpact: presentationPayload.expectedImpact,
            ifNoAction: presentationPayload.ifNoAction,
            currentBlocker: presentationPayload.currentBlocker,
            currentCommitment: presentationPayload.currentCommitment,
            personalizationHint: presentationPayload.personalizationHint,
            learnedPatternSummary: presentationPayload.learnedPatternSummary,
            supportingHighlights: presentationPayload.supportingHighlights,
            evidenceSummary: presentationPayload.evidenceSummary,
          },
          briefingSummary: presentationPayload.briefingSummary,
        })
      : null;
    const llmPayload = llmEnhanced?.output;

    return {
      ...explanation,
      actionType: item.actionType,
      title: item.title,
      description: item.description,
      score: item.score,
      urgencyScore: item.urgencyScore,
      impactScore: item.impactScore,
      confidenceScore: item.confidenceScore,
      personalizationScore: item.personalizationScore,
      policyFitScore: item.policyFitScore,
      riskScore: item.riskScore,
      policyResult: item.policyResult,
      payload: {
        ...presentationPayload,
        ...(llmPayload
          ? {
              whyNow: llmPayload.whyNow,
              currentBlocker: llmPayload.currentBlocker,
              currentCommitment: llmPayload.currentCommitment,
              expectedImpact: llmPayload.expectedImpact,
              ifNoAction: llmPayload.ifNoAction,
              personalizationHint: llmPayload.personalizationHint,
              learnedPatternSummary: presentationPayload.learnedPatternSummary,
              supportingHighlights: llmPayload.supportingHighlights,
              evidenceSummary: llmPayload.evidenceSummary,
              llmMeta: {
                provider: llmEnhanced?.provider,
                model: llmEnhanced?.model,
                modelVersion: llmEnhanced?.modelVersion,
                modelRole: llmEnhanced?.modelRole,
                promptKey: llmEnhanced?.promptKey,
                promptVersion: llmEnhanced?.promptVersion,
                success: llmEnhanced?.success,
                fallbackUsed: llmEnhanced?.fallbackUsed,
                fallbackReason: llmEnhanced?.fallbackReason,
                latencyMs: llmEnhanced?.latencyMs,
                budgetTier: llmEnhanced?.budgetTier,
              },
            }
          : {}),
        aiReason: item.aiReason,
        draftContent: item.draftContent ?? null,
        metadata: item.metadata ?? null,
        resultPreview: item.resultPreview ?? null,
        objectLabel: context.objectLabel,
        appliedPolicyRules: explanation.appliedPolicyRules,
        whyNotAutoExecute: explanation.whyNotAutoExecute,
        riskLevel: item.riskLevel,
        llmEnhanced: Boolean(llmEnhanced && !llmEnhanced.fallbackUsed),
      },
      explanation: llmPayload?.explanation ?? explanation.explanation,
    };
  }));

  let logs: RecommendationLog[] = [];
  if (input.persist !== false) {
    logs = await persistRecommendations({
      workspaceId: input.workspaceId,
      userId: input.actorUserId,
      objectType: input.objectType,
      objectId: input.objectId,
      recommendations: withExplanation,
    });

    if (input.captureTelemetry !== false) {
      await writeAuditLog({
        workspaceId: input.workspaceId,
        userId: input.actorUserId,
        actor: input.actorName,
        actorType: input.actorUserId ? ActorType.USER : ActorType.SYSTEM,
        actionType: "RECOMMENDATION_GENERATED",
        targetType: input.objectType,
        targetId: input.objectId,
        relatedObjectType: input.objectType,
        relatedObjectId: input.objectId,
        sourcePage: input.sourcePage ?? undefined,
        summary: `系统为 ${context.objectLabel} 生成了 ${logs.length} 条下一步建议`,
        payload: {
          objectType: input.objectType,
          objectId: input.objectId,
          recommendationIds: logs.map((item) => item.id),
        },
      });
    }
  }

  if (input.captureTelemetry !== false) {
    await logEvent({
      workspaceId: input.workspaceId,
      userId: input.actorUserId,
      eventName: input.persist === false ? "recommendation_requested" : "recommendation_generated",
      eventCategory: "recommendation",
      targetType: input.objectType,
      targetId: input.objectId,
      metadata: {
        recommendationCount: withExplanation.length,
        supportingFactIds: evidence.supportingFactIds,
        blockerIds: evidence.blockerIds,
        commitmentIds: evidence.commitmentIds,
        briefingSnapshotId: evidence.briefingSnapshotId ?? null,
        retrievalPack: evidence.memoryRetrievalPack
          ? {
              selectedCount: evidence.memoryRetrievalPack.trace.selectedCount,
              omittedCount: evidence.memoryRetrievalPack.trace.omittedCount,
              fallbackUsed: evidence.memoryRetrievalPack.fallback.used,
              fallbackReason: evidence.memoryRetrievalPack.fallback.reason,
            }
          : null,
        patternFactIds: patternFacts.map((item) => item.id),
        primaryRecommendationTitle: withExplanation[0]?.title ?? null,
      },
      sourcePage: input.sourcePage ?? undefined,
    });
  }

  if (logs.length) {
    return logs.map(mapRecommendationLog);
  }

  return withExplanation.map((item, index) => ({
    recommendationId: `preview-${input.objectType}-${input.objectId}-${index + 1}`,
    objectType: input.objectType,
    objectId: input.objectId,
    actionType: item.actionType,
    title: item.title,
    description: item.description,
    score: item.score,
    urgencyScore: item.urgencyScore,
    impactScore: item.impactScore,
    confidenceScore: item.confidenceScore,
    personalizationScore: item.personalizationScore,
    policyFitScore: item.policyFitScore,
    riskScore: item.riskScore,
    policyResult: item.policyResult,
    supportingFactIds: item.supportingFactIds,
    blockerIds: item.blockerIds,
    commitmentIds: item.commitmentIds,
    explanation: item.explanation,
    appliedPolicyRules: item.appliedPolicyRules,
    whyNotAutoExecute: item.whyNotAutoExecute,
    status: RecommendationStatus.ACTIVE,
    createdAt: new Date(),
    recommendationPayload: item.payload,
  }));
}

export async function getRecommendationExplanation(workspaceId: string, recommendationId: string) {
  const log = await db.recommendationLog.findFirst({
    where: { workspaceId, id: recommendationId },
  });

  if (!log) {
    throw new Error("Recommendation not found");
  }

  const supportingFactIds = safeParseJson<string[]>(log.supportingFactIds, []);
  const blockerIds = safeParseJson<string[]>(log.blockerIds, []);
  const commitmentIds = safeParseJson<string[]>(log.commitmentIds, []);
  const payload = safeParseJson<Record<string, unknown> | null>(log.recommendationPayload, null);

  const [supportingFacts, blockers, commitments] = await Promise.all([
    db.memoryFact.findMany({
      where: { workspaceId, id: { in: supportingFactIds } },
      orderBy: [{ importance: "desc" }, { updatedAt: "desc" }],
    }),
    db.blocker.findMany({
      where: { workspaceId, id: { in: blockerIds } },
      orderBy: [{ severity: "desc" }],
    }),
    db.commitment.findMany({
      where: { workspaceId, id: { in: commitmentIds } },
      orderBy: [{ dueDate: "asc" }],
    }),
  ]);

  return {
    recommendation: mapRecommendationLog(log),
    supportingFacts,
    blockers,
    commitments,
    appliedPolicies: Array.isArray(payload?.appliedPolicyRules) ? payload.appliedPolicyRules : [],
  };
}

export async function refreshRecommendationExplanationWithLLM(input: {
  workspaceId: string;
  recommendationId: string;
  userId?: string | null;
  force?: boolean;
}) {
  const details = await getRecommendationExplanation(input.workspaceId, input.recommendationId);
  const payload =
    typeof details.recommendation.recommendationPayload === "string"
      ? safeParseJson<Record<string, unknown>>(details.recommendation.recommendationPayload, {})
      : ((details.recommendation.recommendationPayload as Record<string, unknown> | null) ?? {});
  const llmEnhanced = payload.llmEnhanced === true;

  if (llmEnhanced && !input.force) {
    return details;
  }

  const presentation = readRecommendationPresentation(details.recommendation);
  const enhanced = await enhanceRecommendationExplanationWithLLM({
    workspaceId: input.workspaceId,
    userId: input.userId,
    objectLabel: (details.recommendation.recommendationPayload?.objectLabel as string | undefined) ?? details.recommendation.title,
    recommendationTitle: details.recommendation.title,
    recommendationDescription: details.recommendation.description,
    deterministicExplanation: details.recommendation.explanation,
    policyResultLabel: actionModeLabels[details.recommendation.policyResult],
    fallback: {
      explanation: details.recommendation.explanation,
      whyNow: presentation.whyNow,
      expectedImpact: presentation.expectedImpact,
      ifNoAction: presentation.ifNoAction,
      currentBlocker: presentation.currentBlocker,
      currentCommitment: presentation.currentCommitment,
      personalizationHint: presentation.personalizationHint,
      supportingHighlights: presentation.supportingHighlights,
      evidenceSummary: presentation.evidenceSummary,
    },
    briefingSummary: presentation.briefingSummary,
  });

  const nextPayload = {
    ...payload,
    whyNow: enhanced.output.whyNow,
    currentBlocker: enhanced.output.currentBlocker,
    currentCommitment: enhanced.output.currentCommitment,
    expectedImpact: enhanced.output.expectedImpact,
    ifNoAction: enhanced.output.ifNoAction,
    personalizationHint: enhanced.output.personalizationHint,
    supportingHighlights: enhanced.output.supportingHighlights,
    evidenceSummary: enhanced.output.evidenceSummary,
    llmMeta: {
      provider: enhanced.provider,
      model: enhanced.model,
      modelVersion: enhanced.modelVersion,
      modelRole: enhanced.modelRole,
      promptKey: enhanced.promptKey,
      promptVersion: enhanced.promptVersion,
      success: enhanced.success,
      fallbackUsed: enhanced.fallbackUsed,
      fallbackReason: enhanced.fallbackReason,
      latencyMs: enhanced.latencyMs,
      budgetTier: enhanced.budgetTier,
    },
    llmEnhanced: !enhanced.fallbackUsed,
  };

  await db.recommendationLog.update({
    where: { id: input.recommendationId },
    data: {
      explanation: enhanced.output.explanation,
      recommendationPayload: jsonStringify(nextPayload),
    },
  });

  return getRecommendationExplanation(input.workspaceId, input.recommendationId);
}

export async function createActionFromRecommendation(input: MemoryActorContext & {
  recommendationId: string;
}) {
  const log = await db.recommendationLog.findUnique({
    where: { id: input.recommendationId },
  });

  if (!log) {
    throw new Error("Recommendation not found");
  }

  const context = await loadRecommendationContext(input.workspaceId, log.objectType, log.objectId);
  const payload = safeParseJson<Record<string, unknown>>(log.recommendationPayload, {});
  const riskLevel = (payload.riskLevel as RiskLevel | undefined) ?? context.baseRiskLevel;

  const result = await createGovernedAction({
    workspaceId: input.workspaceId,
    actorName: input.actorName,
    actorUserId: input.actorUserId,
    actorType: input.actorType,
    english: input.english,
    actionType: log.actionType,
    title: log.title,
    description: log.description,
    aiReason: typeof payload.aiReason === "string" ? payload.aiReason : log.explanation,
    draftContent: typeof payload.draftContent === "string" ? payload.draftContent : undefined,
    riskLevel,
    meetingId: context.meetingId ?? undefined,
    opportunityId: context.opportunityId ?? undefined,
    contactId: context.contactId ?? undefined,
    ownerId: context.ownerId ?? input.actorUserId ?? undefined,
    metadata: typeof payload.metadata === "object" && payload.metadata ? (payload.metadata as Record<string, unknown>) : undefined,
    resultPreview: typeof payload.resultPreview === "string" ? payload.resultPreview : undefined,
    recommendationLogId: log.id,
  });

  await writeAuditLog({
    workspaceId: input.workspaceId,
    userId: input.actorUserId,
    actor: input.actorName,
    actorType: input.actorUserId ? ActorType.USER : ActorType.SYSTEM,
    actionType: "RECOMMENDATION_ACTION_CREATED",
    targetType: "RecommendationLog",
    targetId: log.id,
    relatedObjectType: log.objectType,
    relatedObjectId: log.objectId,
    sourcePage: input.sourcePage ?? undefined,
    summary: `已按 recommendation 生成动作：${trimText(log.title, 32)}`,
    payload: {
      actionItemId: result.actionItemId,
      approvalTaskId: result.approvalTaskId ?? null,
      status: result.status,
      reason: result.reason,
    },
  });

  await logEvent({
    workspaceId: input.workspaceId,
    userId: input.actorUserId,
    eventName: "recommendation_action_created",
    eventCategory: "recommendation",
    targetType: "RecommendationLog",
    targetId: log.id,
    metadata: {
      actionItemId: result.actionItemId,
      approvalTaskId: result.approvalTaskId ?? null,
      status: result.status,
      policyResult: log.policyResult,
    },
    sourcePage: input.sourcePage ?? undefined,
  });

  return result;
}

export async function getTodayFocusRecommendations(
  input: MemoryActorContext & {
    llmEnhancement?: boolean;
  },
) {
  const [opportunities, meetings, overdueCommitments, openBlockers] = await Promise.all([
    db.opportunity.findMany({
      where: {
        workspaceId: input.workspaceId,
        stage: { notIn: ["DONE", "LOST"] },
      },
      orderBy: [{ priorityScore: "desc" }, { updatedAt: "asc" }],
      take: 6,
    }),
    db.meeting.findMany({
      where: {
        workspaceId: input.workspaceId,
        startsAt: {
          gte: startOfDay(new Date()),
          lte: endOfDay(new Date()),
        },
      },
      orderBy: { startsAt: "asc" },
      take: 3,
    }),
    db.commitment.findMany({
      where: {
        workspaceId: input.workspaceId,
        overdueFlag: true,
        status: { in: ["OPEN", "IN_PROGRESS", "OVERDUE"] },
      },
      orderBy: [{ dueDate: "asc" }],
      take: 5,
    }),
    db.blocker.findMany({
      where: {
        workspaceId: input.workspaceId,
        status: { in: ["OPEN", "MONITORING"] },
      },
      orderBy: [{ severity: "desc" }, { updatedAt: "desc" }],
      take: 5,
    }),
  ]);

  const objectRefs = [
    ...opportunities.map((item) => ({ objectType: ObjectType.OPPORTUNITY, objectId: item.id })),
    ...meetings.map((item) => ({ objectType: ObjectType.MEETING, objectId: item.id })),
    ...overdueCommitments
      .map((item) => item.relatedOpportunityId ?? item.relatedContactId ?? item.relatedMeetingId ?? null)
      .filter(Boolean)
      .map((id) => ({
        objectType: overdueCommitments.find((item) => (item.relatedOpportunityId ?? item.relatedContactId ?? item.relatedMeetingId) === id)?.relatedOpportunityId
          ? ObjectType.OPPORTUNITY
          : overdueCommitments.find((item) => (item.relatedOpportunityId ?? item.relatedContactId ?? item.relatedMeetingId) === id)?.relatedContactId
            ? ObjectType.CONTACT
            : ObjectType.MEETING,
        objectId: id as string,
      })),
  ].filter((item, index, self) => self.findIndex((entry) => entry.objectType === item.objectType && entry.objectId === item.objectId) === index);

  const rankedGroups = await Promise.all(
    objectRefs.slice(0, 8).map(async (ref) => {
      const recommendations = await generateRecommendationsForObject({
        ...input,
        objectType: ref.objectType,
        objectId: ref.objectId,
        limit: 1,
        persist: false,
        captureTelemetry: false,
      });
      return recommendations[0] ?? null;
    }),
  );

  const topPriorities = rankedGroups
    .filter(Boolean)
    .sort((left, right) => (right?.score ?? 0) - (left?.score ?? 0))
    .slice(0, 5) as TodayFocusItem[];

  const objectTitles = new Map<string, string>();
  for (const opportunity of opportunities) objectTitles.set(`OPPORTUNITY:${opportunity.id}`, opportunity.title);
  for (const meeting of meetings) objectTitles.set(`MEETING:${meeting.id}`, meeting.title);

  const topPrioritiesWithLabel = topPriorities.map((item) => ({
    ...item,
    objectLabel: objectTitles.get(`${item.objectType}:${item.objectId}`) ?? item.title,
  }));

  const shouldEnhanceWithLLM = input.llmEnhancement ?? false;
  const enhancedTopPriorities = shouldEnhanceWithLLM
    ? await Promise.all(
      topPrioritiesWithLabel.map(async (item, index) => {
        if (index >= 3) return item;

        const presentation = readRecommendationPresentation(item);
        const enhanced = await enhanceRecommendationExplanationWithLLM({
          workspaceId: input.workspaceId,
          userId: input.actorUserId,
          objectLabel: item.objectLabel,
          recommendationTitle: item.title,
          recommendationDescription: item.description,
          deterministicExplanation: item.explanation,
          policyResultLabel: actionModeLabels[item.policyResult],
          fallback: {
            explanation: item.explanation,
            whyNow: presentation.whyNow,
            expectedImpact: presentation.expectedImpact,
            ifNoAction: presentation.ifNoAction,
            currentBlocker: presentation.currentBlocker,
            currentCommitment: presentation.currentCommitment,
            personalizationHint: presentation.personalizationHint,
            learnedPatternSummary: presentation.learnedPatternSummary,
            supportingHighlights: presentation.supportingHighlights,
            evidenceSummary: presentation.evidenceSummary,
          },
          briefingSummary: presentation.briefingSummary,
        });

        const currentPayload =
          typeof item.recommendationPayload === "string"
            ? safeParseJson<Record<string, unknown>>(item.recommendationPayload, {})
            : (item.recommendationPayload ?? {});

        return {
          ...item,
          explanation: enhanced.output.explanation,
          recommendationPayload: {
            ...currentPayload,
            whyNow: enhanced.output.whyNow,
            currentBlocker: enhanced.output.currentBlocker,
            currentCommitment: enhanced.output.currentCommitment,
            expectedImpact: enhanced.output.expectedImpact,
            ifNoAction: enhanced.output.ifNoAction,
            personalizationHint: enhanced.output.personalizationHint,
            learnedPatternSummary: presentation.learnedPatternSummary,
            supportingHighlights: enhanced.output.supportingHighlights,
            evidenceSummary: enhanced.output.evidenceSummary,
            llmMeta: {
              provider: enhanced.provider,
              model: enhanced.model,
              modelVersion: enhanced.modelVersion,
              modelRole: enhanced.modelRole,
              promptKey: enhanced.promptKey,
              promptVersion: enhanced.promptVersion,
              success: enhanced.success,
              fallbackUsed: enhanced.fallbackUsed,
              fallbackReason: enhanced.fallbackReason,
              latencyMs: enhanced.latencyMs,
              budgetTier: enhanced.budgetTier,
            },
            llmEnhanced: !enhanced.fallbackUsed,
          },
        };
      }),
    )
    : topPrioritiesWithLabel;

  await logEvent({
    workspaceId: input.workspaceId,
    userId: input.actorUserId,
    eventName: "today_focus_generated",
    eventCategory: "recommendation",
    targetType: "Workspace",
    targetId: input.workspaceId,
    metadata: {
      count: topPrioritiesWithLabel.length,
      overdueCommitmentCount: overdueCommitments.length,
      openHighRiskCount: openBlockers.filter((item) => item.severity >= 70).length,
    },
    sourcePage: input.sourcePage ?? "/dashboard",
  });

  return {
    topPriorities: enhancedTopPriorities,
    highRiskItems: enhancedTopPriorities.filter((item) => item.riskScore >= 65 || item.policyResult === ActionExecutionMode.REQUIRES_APPROVAL),
    overdueCommitments,
    stalledOpportunities: opportunities.filter((item) => normalizeDaysSince(item.lastProgressAt ?? item.updatedAt) >= 5).slice(0, 4),
    suggestedActions: enhancedTopPriorities.slice(0, 3),
  };
}

export function getEmptyTodayFocusRecommendations() {
  return {
    topPriorities: [],
    highRiskItems: [],
    overdueCommitments: [],
    stalledOpportunities: [],
    suggestedActions: [],
  };
}
