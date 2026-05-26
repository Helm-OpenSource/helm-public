import { type MemoryFact } from "@prisma/client";
import {
  buildMemoryRetrievalPack,
  type MemoryRetrievalPack,
  type MemoryRetrievalPackBudget,
  type MemoryRetrievalPackCandidate,
  type MemoryRetrievalSelectedReason,
  type MemoryRetrievalOmittedReason,
  type MemoryRetrievalSurface,
} from "@/lib/memory/retrieval-pack";

export type MemoryFactForRetrievalPack = Pick<
  MemoryFact,
  | "id"
  | "objectType"
  | "objectId"
  | "factType"
  | "title"
  | "content"
  | "normalizedValue"
  | "sourceType"
  | "sourceId"
  | "status"
  | "confidence"
  | "importance"
  | "freshnessScore"
  | "confirmedByUser"
  | "createdAt"
  | "updatedAt"
>;

export type MemoryRetrievalPackSurfaceTrace = {
  surface: MemoryRetrievalSurface;
  objectType: string;
  objectId: string;
  budget: MemoryRetrievalPackBudget;
  fallback: {
    used: boolean;
    reason: string | null;
  };
  selected: Array<{
    id: string;
    title: string;
    objectType: string;
    objectId: string;
    selectedReason: MemoryRetrievalSelectedReason;
    score: number;
    estimatedTokens: number;
    trustScore: number;
    recencyScore: number;
    evidenceRefs: string[];
  }>;
  omitted: Array<{
    id: string;
    title: string;
    objectType: string;
    objectId: string;
    omittedReason: MemoryRetrievalOmittedReason;
    score: number;
    estimatedTokens: number;
  }>;
  trace: {
    candidateCount: number;
    selectedCount: number;
    omittedCount: number;
    estimatedTokensUsed: number;
    estimatedTokensRemaining: number;
    selectedReasons: Array<{ reason: MemoryRetrievalSelectedReason; count: number }>;
    omittedReasons: Array<{ reason: MemoryRetrievalOmittedReason; count: number }>;
    staleSuppressionRefs: string[];
    evidenceRefs: string[];
    boundaryNote: string;
  };
};

export const MEMORY_RETRIEVAL_PACK_SURFACE_BUDGETS: Record<
  MemoryRetrievalSurface,
  MemoryRetrievalPackBudget
> = {
  briefing: {
    maxItems: 10,
    maxEstimatedTokens: 900,
  },
  recommendation: {
    maxItems: 8,
    maxEstimatedTokens: 720,
  },
  meeting_detail: {
    maxItems: 12,
    maxEstimatedTokens: 1100,
  },
  runtime_review: {
    maxItems: 8,
    maxEstimatedTokens: 720,
  },
};

export function getMemoryRetrievalPackBudget(surface: MemoryRetrievalSurface) {
  return MEMORY_RETRIEVAL_PACK_SURFACE_BUDGETS[surface];
}

function memoryFactToRetrievalCandidate(fact: MemoryFactForRetrievalPack): MemoryRetrievalPackCandidate {
  return {
    id: fact.id,
    objectType: fact.objectType,
    objectId: fact.objectId,
    factType: fact.factType,
    title: fact.title,
    content: fact.content,
    normalizedValue: fact.normalizedValue,
    sourceType: fact.sourceType,
    sourceId: fact.sourceId,
    status: fact.status,
    confidence: fact.confidence,
    importance: fact.importance,
    freshnessScore: fact.freshnessScore,
    confirmedByUser: fact.confirmedByUser,
    createdAt: fact.createdAt,
    updatedAt: fact.updatedAt,
    evidenceRefs: [`memoryFact:${fact.id}`, `${fact.sourceType}:${fact.sourceId}`],
  };
}

export function selectMemoryFactsFromRetrievalPack(
  facts: MemoryFactForRetrievalPack[],
  pack: MemoryRetrievalPack,
) {
  const byId = new Map(facts.map((fact) => [fact.id, fact] as const));
  return pack.selected
    .map((item) => byId.get(item.candidate.id))
    .filter((fact): fact is MemoryFactForRetrievalPack => Boolean(fact));
}

export function summarizeMemoryRetrievalPack(
  pack: MemoryRetrievalPack,
): MemoryRetrievalPackSurfaceTrace {
  return {
    surface: pack.surface,
    objectType: String(pack.objectType),
    objectId: pack.objectId,
    budget: pack.budget,
    fallback: pack.fallback,
    selected: pack.selected.map((item) => ({
      id: item.candidate.id,
      title: item.candidate.title,
      objectType: String(item.candidate.objectType),
      objectId: item.candidate.objectId,
      selectedReason: item.selectedReason,
      score: item.score,
      estimatedTokens: item.estimatedTokens,
      trustScore: item.trustScore,
      recencyScore: item.recencyScore,
      evidenceRefs: item.evidenceRefs,
    })),
    omitted: pack.omitted.map((item) => ({
      id: item.candidate.id,
      title: item.candidate.title,
      objectType: String(item.candidate.objectType),
      objectId: item.candidate.objectId,
      omittedReason: item.omittedReason,
      score: item.score,
      estimatedTokens: item.estimatedTokens,
    })),
    trace: pack.trace,
  };
}

export function buildMemoryFactRetrievalPack(args: {
  surface: MemoryRetrievalSurface;
  objectType: MemoryFactForRetrievalPack["objectType"] | string;
  objectId: string;
  facts: MemoryFactForRetrievalPack[];
  budget?: MemoryRetrievalPackBudget;
  now?: Date;
  fallbackReason?: string | null;
}) {
  const pack = buildMemoryRetrievalPack({
    surface: args.surface,
    objectType: args.objectType,
    objectId: args.objectId,
    budget: args.budget ?? getMemoryRetrievalPackBudget(args.surface),
    now: args.now,
    fallbackReason: args.fallbackReason,
    candidates: args.facts.map(memoryFactToRetrievalCandidate),
  });

  return {
    pack,
    selectedFacts: selectMemoryFactsFromRetrievalPack(args.facts, pack),
    trace: summarizeMemoryRetrievalPack(pack),
  };
}
