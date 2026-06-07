import {
  parseJudgementCandidate,
  parseLLMContextPacket,
  type JudgementCandidate,
  type LLMCriticResult,
  type LLMContextPacket,
} from "@/lib/llm/intelligence-contracts";
import { reviewJudgementBoundaryWithLLM } from "@/lib/llm-workflows/review-judgement-boundary.workflow";
import type { JudgementBoundaryEgressPolicy } from "@/lib/llm-workflows/review-judgement-boundary.workflow";
import type {
  RankedRecommendationCandidate,
  RecommendationEvidence,
  RecommendationObjectContext,
} from "@/lib/recommendations/types";

export interface RecommendationCriticInput {
  workspaceId: string;
  userId?: string | null;
  context: RecommendationObjectContext;
  evidence: RecommendationEvidence;
  ranked: RankedRecommendationCandidate;
  egressPolicy?: JudgementBoundaryEgressPolicy;
  traceId?: string;
}

export interface RecommendationCriticAdvisory {
  ranked: RankedRecommendationCandidate;
  contextPacket: LLMContextPacket;
  judgementCandidate: JudgementCandidate;
  criticResult: LLMCriticResult;
}

function getRecommendationRef(input: RecommendationCriticInput): string {
  return `${input.context.objectType}:${input.context.objectId}:${input.ranked.actionType}`;
}

export function buildRecommendationCriticContextPacket(
  input: RecommendationCriticInput,
): LLMContextPacket {
  const { context, evidence, ranked } = input;
  const recommendationRef = getRecommendationRef(input);

  return parseLLMContextPacket({
    packetId: `recommendation:${recommendationRef}:critic`,
    workspaceId: input.workspaceId,
    objectRef: {
      objectType: "recommendation",
      objectId: recommendationRef,
      label: ranked.title,
    },
    timeline: [
      ...(evidence.recentMeetings ?? []).map((meeting) => ({
        occurredAt: "not_captured",
        eventType: "meeting",
        summary: meeting.summary ?? meeting.title,
        evidenceRefIds: [`meeting:${meeting.id}`],
      })),
      ...(evidence.recentThreads ?? []).map((thread) => ({
        occurredAt: "not_captured",
        eventType: "thread",
        summary: thread.snippet ?? thread.subject,
        evidenceRefIds: [`thread:${thread.id}`],
      })),
    ],
    evidenceRefs: [
      ...evidence.supportingFacts.map((fact) => ({
        refId: `fact:${fact.id}`,
        sourceType: "supporting_fact",
        summary: `${fact.title}: ${fact.content}`,
      })),
      ...(evidence.recentMeetings ?? []).map((meeting) => ({
        refId: `meeting:${meeting.id}`,
        sourceType: "meeting",
        summary: meeting.summary ?? meeting.title,
      })),
      ...(evidence.recentThreads ?? []).map((thread) => ({
        refId: `thread:${thread.id}`,
        sourceType: "thread",
        summary: thread.snippet ?? thread.subject,
      })),
    ],
    signals: evidence.supportingFacts.map((fact) => ({
      signalId: `signal:${fact.id}`,
      family: "recommendation_supporting_fact",
      summary: `${fact.title}: ${fact.content}`,
      strength: Math.max(0, Math.min(100, Math.round(fact.confidence * 100))),
      evidenceRefIds: [`fact:${fact.id}`],
    })),
    commitments: evidence.commitments.map((commitment) => ({
      commitmentId: `commitment:${commitment.id}`,
      summary: `${commitment.title}: ${commitment.commitmentText}`,
      dueAt: commitment.dueDate?.toISOString(),
      evidenceRefIds: [`commitment:${commitment.id}`],
    })),
    blockers: evidence.blockers.map((blocker) => ({
      blockerId: `blocker:${blocker.id}`,
      summary: `${blocker.title}: ${blocker.blockerText}`,
      severity: "medium",
      evidenceRefIds: [`blocker:${blocker.id}`],
    })),
    policySnapshot: {
      objectType: context.objectType,
      objectId: context.objectId,
      rankingScore: ranked.score,
      policyResult: ranked.policyResult,
      policyReason: ranked.policyReason,
      policyFitScore: ranked.policyFitScore,
      whyNotAutoExecute: ranked.whyNotAutoExecute ?? null,
      riskLevel: ranked.riskLevel,
      autoExecute: false,
      deterministicRankPreserved: true,
    },
    permissions: {
      allowedUses: ["advisory_to_human", "evidence_gap_review", "counterargument_review"],
      forbiddenUses: [
        "external_send",
        "writeback",
        "connector_activation",
        "approval_task_creation",
        "recommendation_feedback_creation",
        "preference_signal_creation",
        "pattern_fact_creation",
      ],
      requiredHumanReview: true,
    },
    privacyClass: "private_runtime",
    tokenBudget: {
      maxInputTokens: 1800,
      maxOutputTokens: 700,
    },
    missingEvidence: evidence.blockers.map((blocker) => ({
      gapId: `gap:${blocker.id}`,
      summary: `${blocker.title}: ${blocker.blockerText}`,
      neededFor: "recommendation_critic",
      severity: "medium",
    })),
    boundaryNotes: [
      "Recommendation critic is advisory-to-human only.",
      "Critic output must not create RecommendationFeedback, PreferenceSignal, or PatternFact.",
      "Deterministic ranking score is preserved.",
    ],
  });
}

export function buildRecommendationJudgementCandidate(
  input: RecommendationCriticInput,
  contextPacket: LLMContextPacket,
): JudgementCandidate {
  const recommendationRef = getRecommendationRef(input);

  return parseJudgementCandidate({
    candidateId: `recommendation:${recommendationRef}:critic-candidate`,
    packetId: contextPacket.packetId,
    workspaceId: input.workspaceId,
    targetObjectRef: {
      objectType: "recommendation",
      objectId: recommendationRef,
    },
    judgementType: "recommendation_critic",
    reviewState: "candidate",
    confidence: input.ranked.confidenceScore,
    summary: `Review recommendation evidence and boundary posture for: ${input.ranked.title}`,
    rationale: [input.ranked.aiReason, input.ranked.policyReason].filter(
      (item) => item.trim().length > 0,
    ),
    evidenceRefIds: contextPacket.evidenceRefs.map((ref) => ref.refId),
    missingEvidenceIds: contextPacket.missingEvidence.map((gap) => gap.gapId),
    boundaryNotes: contextPacket.boundaryNotes,
  });
}

export async function reviewRecommendationCandidateWithLLM(
  input: RecommendationCriticInput,
): Promise<RecommendationCriticAdvisory> {
  const contextPacket = buildRecommendationCriticContextPacket(input);
  const judgementCandidate = buildRecommendationJudgementCandidate(input, contextPacket);
  const criticResult = await reviewJudgementBoundaryWithLLM({
    workspaceId: input.workspaceId,
    userId: input.userId,
    contextPacket,
    candidate: judgementCandidate,
    egressPolicy: input.egressPolicy,
    traceId: input.traceId,
  });

  return {
    ranked: input.ranked,
    contextPacket,
    judgementCandidate,
    criticResult,
  };
}
