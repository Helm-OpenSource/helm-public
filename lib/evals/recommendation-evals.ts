import { ActionType, ObjectType, RecommendationFeedbackType, RecommendationStatus, type PrismaClient } from "@prisma/client";
import { startOfDay, subDays } from "date-fns";
import recommendationGoldenCases from "@/evals/recommendation/golden-samples.json";
import { db } from "@/lib/db";
import { average, includesEvalText, includesInAny, toRate } from "@/lib/evals/shared";
import { safeParseJson } from "@/lib/utils";

type RecommendationGoldenCase = {
  id: string;
  objectType: ObjectType;
  objectLabel: string;
  actionType: ActionType;
  expectedTitleIncludes: string[];
  expectedDecisionRole: string;
  expectedDecisionLabel?: string;
  expectedPolicyResult?: string;
  expectedBlockerIncludes?: string[];
  expectedCommitmentIncludes?: string[];
  expectedEvidenceIncludes?: string[];
  expectedLearnedPatterns?: string[];
};

type RecommendationGoldenCaseResult = {
  id: string;
  objectLabel: string;
  actionType: ActionType;
  recommendationTitle: string | null;
  passed: boolean;
  failures: string[];
};

type RecommendationGoldenSummary = {
  totalCases: number;
  passedCases: number;
  passRate: number;
  cases: RecommendationGoldenCaseResult[];
};

export type RecommendationQualityOverview = {
  generated: number;
  accepted: number;
  rejected: number;
  editedApproved: number;
  actionCreated: number;
  explanationViewed: number;
  cardViewed: number;
  acceptanceRate: number;
  rejectionRate: number;
  actionCreationRate: number;
  explanationViewRate: number;
  editedApprovalRate: number;
  averageScore: number;
  byActionType: Array<{
    actionType: string;
    generated: number;
    accepted: number;
    rejected: number;
    editedApproved: number;
    actionCreated: number;
    acceptanceRate: number;
    rejectionRate: number;
  }>;
  weakestActionTypes: Array<{
    actionType: string;
    generated: number;
    acceptanceRate: number;
    rejectionRate: number;
    actionCreated: number;
  }>;
  goldenSummary: RecommendationGoldenSummary;
};

function extractRetrievalPackSelectedTitles(payload: Record<string, unknown>): string[] {
  const pack = payload.memoryRetrievalPack;
  if (!pack || typeof pack !== "object") return [];
  const selected = (pack as Record<string, unknown>).selected;
  if (!Array.isArray(selected)) return [];
  return selected.flatMap((item) => {
    if (item && typeof item === "object" && typeof (item as Record<string, unknown>).title === "string") {
      return [(item as Record<string, unknown>).title as string];
    }
    return [];
  });
}

function loadRecommendationGoldenCases() {
  return recommendationGoldenCases as RecommendationGoldenCase[];
}

async function resolveObjectId(prisma: PrismaClient, objectType: ObjectType, objectLabel: string) {
  switch (objectType) {
    case ObjectType.CONTACT: {
      const contact = await prisma.contact.findFirst({
        where: { name: objectLabel },
        select: { id: true, workspaceId: true },
      });
      return contact;
    }
    case ObjectType.COMPANY: {
      const company = await prisma.company.findFirst({
        where: { name: objectLabel },
        select: { id: true, workspaceId: true },
      });
      return company;
    }
    case ObjectType.OPPORTUNITY: {
      const opportunity = await prisma.opportunity.findFirst({
        where: { title: objectLabel },
        select: { id: true, workspaceId: true },
      });
      return opportunity;
    }
    case ObjectType.MEETING: {
      const meeting = await prisma.meeting.findFirst({
        where: { title: objectLabel },
        select: { id: true, workspaceId: true },
      });
      return meeting;
    }
    default:
      return null;
  }
}

export async function runRecommendationGoldenEval(prisma: PrismaClient = db): Promise<RecommendationGoldenSummary> {
  const cases = loadRecommendationGoldenCases();
  const results: RecommendationGoldenCaseResult[] = [];

  for (const item of cases) {
    const objectRef = await resolveObjectId(prisma, item.objectType, item.objectLabel);
    if (!objectRef) {
      results.push({
        id: item.id,
        objectLabel: item.objectLabel,
        actionType: item.actionType,
        recommendationTitle: null,
        passed: false,
        failures: ["对象不存在"],
      });
      continue;
    }

    const recommendation = await prisma.recommendationLog.findFirst({
      where: {
        workspaceId: objectRef.workspaceId,
        objectType: item.objectType,
        objectId: objectRef.id,
        actionType: item.actionType,
      },
      orderBy: { createdAt: "desc" },
      select: {
        title: true,
        explanation: true,
        policyResult: true,
        recommendationPayload: true,
      },
    });

    if (!recommendation) {
      results.push({
        id: item.id,
        objectLabel: item.objectLabel,
        actionType: item.actionType,
        recommendationTitle: null,
        passed: false,
        failures: ["未找到对应 recommendation"],
      });
      continue;
    }

    const payload = safeParseJson<Record<string, unknown>>(recommendation.recommendationPayload, {});
    const supportPool = [
      recommendation.title,
      recommendation.explanation,
      typeof payload.currentBlocker === "string" ? payload.currentBlocker : null,
      typeof payload.currentCommitment === "string" ? payload.currentCommitment : null,
      typeof payload.tradeoffSummary === "string" ? payload.tradeoffSummary : null,
      typeof payload.evidenceLead === "string" ? payload.evidenceLead : null,
      ...(Array.isArray(payload.supportingHighlights) ? payload.supportingHighlights.map((value) => String(value)) : []),
      ...(Array.isArray(payload.learnedPatternSummary) ? payload.learnedPatternSummary.map((value) => String(value)) : []),
      ...extractRetrievalPackSelectedTitles(payload),
    ];

    const failures: string[] = [];

    for (const expected of item.expectedTitleIncludes) {
      if (!includesEvalText(recommendation.title, expected)) {
        failures.push(`标题未包含：${expected}`);
      }
    }

    if (String(payload.decisionRole ?? "") !== item.expectedDecisionRole) {
      failures.push(`decisionRole 不匹配：${String(payload.decisionRole ?? "缺失")}`);
    }

    if (item.expectedDecisionLabel && String(payload.decisionLabel ?? "") !== item.expectedDecisionLabel) {
      failures.push(`decisionLabel 不匹配：${String(payload.decisionLabel ?? "缺失")}`);
    }

    if (item.expectedPolicyResult && recommendation.policyResult !== item.expectedPolicyResult) {
      failures.push(`policyResult 不匹配：${recommendation.policyResult}`);
    }

    for (const expected of item.expectedBlockerIncludes ?? []) {
      if (!includesInAny(supportPool, expected)) {
        failures.push(`未引用阻塞：${expected}`);
      }
    }

    for (const expected of item.expectedCommitmentIncludes ?? []) {
      if (!includesInAny(supportPool, expected)) {
        failures.push(`未引用承诺：${expected}`);
      }
    }

    for (const expected of item.expectedEvidenceIncludes ?? []) {
      if (!includesInAny(supportPool, expected)) {
        failures.push(`未引用 supporting evidence：${expected}`);
      }
    }

    for (const expected of item.expectedLearnedPatterns ?? []) {
      if (!includesInAny(supportPool, expected)) {
        failures.push(`未引用 learned pattern：${expected}`);
      }
    }

    results.push({
      id: item.id,
      objectLabel: item.objectLabel,
      actionType: item.actionType,
      recommendationTitle: recommendation.title,
      passed: failures.length === 0,
      failures,
    });
  }

  const passedCases = results.filter((result) => result.passed).length;

  return {
    totalCases: results.length,
    passedCases,
    passRate: toRate(passedCases, results.length),
    cases: results,
  };
}

export async function getRecommendationQualityOverview(workspaceId: string, windowStart = startOfDay(subDays(new Date(), 29)), prisma: PrismaClient = db): Promise<RecommendationQualityOverview> {
  const [recommendations, eventLogs, goldenSummary] = await Promise.all([
    prisma.recommendationLog.findMany({
      where: {
        workspaceId,
        createdAt: {
          gte: windowStart,
        },
      },
      include: {
        feedbacks: true,
      },
    }),
    prisma.eventLog.findMany({
      where: {
        workspaceId,
        createdAt: {
          gte: windowStart,
        },
        eventCategory: "recommendation",
      },
      select: {
        eventName: true,
        metadata: true,
      },
    }),
    runRecommendationGoldenEval(prisma),
  ]);

  const generated = recommendations.length;
  const accepted = recommendations.filter(
    (item) => item.status === RecommendationStatus.ACCEPTED || item.status === RecommendationStatus.EXECUTED,
  ).length;
  const rejected = recommendations.filter((item) => item.status === RecommendationStatus.REJECTED).length;
  const editedApproved = recommendations.reduce((sum, item) => {
    return sum + item.feedbacks.filter((feedback) => feedback.feedbackType === RecommendationFeedbackType.EDITED_AND_APPROVED).length;
  }, 0);
  const actionCreated = eventLogs.filter((event) => event.eventName === "recommendation_action_created").length;
  const explanationViewed = eventLogs.filter((event) => event.eventName === "recommendation_explanation_viewed").length;
  const cardViewed = eventLogs.filter((event) => event.eventName === "recommendation_card_viewed").length;

  const groupedByActionType = Array.from(
    recommendations.reduce((acc, recommendation) => {
      const current = acc.get(recommendation.actionType) ?? {
        actionType: recommendation.actionType,
        generated: 0,
        accepted: 0,
        rejected: 0,
        editedApproved: 0,
        scores: [] as number[],
      };

      current.generated += 1;
      current.scores.push(recommendation.score);
      if (
        recommendation.status === RecommendationStatus.ACCEPTED ||
        recommendation.status === RecommendationStatus.EXECUTED
      ) {
        current.accepted += 1;
      }
      if (recommendation.status === RecommendationStatus.REJECTED) {
        current.rejected += 1;
      }
      current.editedApproved += recommendation.feedbacks.filter((feedback) => feedback.feedbackType === RecommendationFeedbackType.EDITED_AND_APPROVED).length;

      acc.set(recommendation.actionType, current);
      return acc;
    }, new Map<string, { actionType: string; generated: number; accepted: number; rejected: number; editedApproved: number; scores: number[] }>() ).values(),
  ).map((item) => {
    const actionCreatedCount = eventLogs.filter((event) => {
      if (event.eventName !== "recommendation_action_created") return false;
      const metadata = safeParseJson<Record<string, unknown> | null>(event.metadata, null);
      return metadata?.actionType === item.actionType;
    }).length;

    return {
      actionType: item.actionType,
      generated: item.generated,
      accepted: item.accepted,
      rejected: item.rejected,
      editedApproved: item.editedApproved,
      actionCreated: actionCreatedCount,
      acceptanceRate: toRate(item.accepted, item.generated),
      rejectionRate: toRate(item.rejected, item.generated),
      averageScore: average(item.scores),
    };
  }).sort((left, right) => right.generated - left.generated);

  return {
    generated,
    accepted,
    rejected,
    editedApproved,
    actionCreated,
    explanationViewed,
    cardViewed,
    acceptanceRate: toRate(accepted, generated),
    rejectionRate: toRate(rejected, generated),
    actionCreationRate: toRate(actionCreated, generated),
    explanationViewRate: toRate(explanationViewed, generated),
    editedApprovalRate: toRate(editedApproved, generated),
    averageScore: average(recommendations.map((item) => item.score)),
    byActionType: groupedByActionType.map((item) => ({
      actionType: item.actionType,
      generated: item.generated,
      accepted: item.accepted,
      rejected: item.rejected,
      editedApproved: item.editedApproved,
      actionCreated: item.actionCreated,
      acceptanceRate: item.acceptanceRate,
      rejectionRate: item.rejectionRate,
    })),
    weakestActionTypes: [...groupedByActionType]
      .filter((item) => item.generated > 0)
      .sort((left, right) => {
        if (left.acceptanceRate === right.acceptanceRate) return right.rejectionRate - left.rejectionRate;
        return left.acceptanceRate - right.acceptanceRate;
      })
      .slice(0, 3)
      .map((item) => ({
        actionType: item.actionType,
        generated: item.generated,
        acceptanceRate: item.acceptanceRate,
        rejectionRate: item.rejectionRate,
        actionCreated: item.actionCreated,
      })),
    goldenSummary,
  };
}
