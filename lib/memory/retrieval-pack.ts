import { MemoryStatus, SourceType, type MemoryFactType, type ObjectType } from "@prisma/client";

export type MemoryRetrievalSurface =
  | "briefing"
  | "recommendation"
  | "meeting_detail"
  | "runtime_review";

export type MemoryRetrievalPromotionPosture =
  | "confirmed_fact"
  | "observed_fact"
  | "system_inference"
  | "candidate"
  | "distillation_candidate";

export type MemoryRetrievalSelectedReason =
  | "confirmed_by_user"
  | "primary_object_match"
  | "high_importance"
  | "high_confidence"
  | "fresh_active_fact"
  | "budget_fit";

export type MemoryRetrievalOmittedReason =
  | "duplicate_candidate"
  | "inactive_or_invalid"
  | "stale_suppressed"
  | "low_trust"
  | "budget_item_limit"
  | "budget_token_limit";

export type MemoryRetrievalPackBudget = {
  maxItems: number;
  maxEstimatedTokens: number;
};

export type MemoryRetrievalPackCandidate = {
  id: string;
  objectType: ObjectType | string;
  objectId: string;
  factType?: MemoryFactType | string | null;
  title: string;
  content: string;
  normalizedValue?: string | null;
  sourceType: SourceType | string;
  sourceId: string;
  status: MemoryStatus | string;
  confidence: number;
  importance: number;
  freshnessScore: number;
  confirmedByUser: boolean;
  createdAt: Date;
  updatedAt: Date;
  promotionPosture?: MemoryRetrievalPromotionPosture;
  evidenceRefs?: string[];
};

export type MemoryRetrievalPackInput = {
  surface: MemoryRetrievalSurface;
  objectType: ObjectType | string;
  objectId: string;
  budget: MemoryRetrievalPackBudget;
  candidates: MemoryRetrievalPackCandidate[];
  now?: Date;
  fallbackReason?: string | null;
};

export type MemoryRetrievalSelectedItem = {
  candidate: MemoryRetrievalPackCandidate;
  selectedReason: MemoryRetrievalSelectedReason;
  score: number;
  estimatedTokens: number;
  trustScore: number;
  recencyScore: number;
  evidenceRefs: string[];
};

export type MemoryRetrievalOmittedItem = {
  candidate: MemoryRetrievalPackCandidate;
  omittedReason: MemoryRetrievalOmittedReason;
  score: number;
  estimatedTokens: number;
};

export type MemoryRetrievalPack = {
  surface: MemoryRetrievalSurface;
  objectType: ObjectType | string;
  objectId: string;
  budget: MemoryRetrievalPackBudget;
  selected: MemoryRetrievalSelectedItem[];
  omitted: MemoryRetrievalOmittedItem[];
  fallback: {
    used: boolean;
    reason: string | null;
  };
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

const STALE_FRESHNESS_THRESHOLD = 35;
const LOW_TRUST_THRESHOLD = 45;
const ACTIVE_MEMORY_STATUSES = new Set<string>([MemoryStatus.ACTIVE, MemoryStatus.OBSERVED]);

function normalizeMemoryValue(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function estimateTokens(candidate: MemoryRetrievalPackCandidate) {
  const text = [candidate.title, candidate.content].filter(Boolean).join("\n");
  return Math.max(1, Math.ceil(text.length / 4));
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function resolvePromotionPosture(candidate: MemoryRetrievalPackCandidate): MemoryRetrievalPromotionPosture {
  if (candidate.promotionPosture) return candidate.promotionPosture;
  if (candidate.confirmedByUser) return "confirmed_fact";
  if (candidate.sourceType === SourceType.SYSTEM_INFERENCE) return "system_inference";
  if (candidate.status === MemoryStatus.OBSERVED) return "observed_fact";
  return "candidate";
}

function buildDuplicateKey(candidate: MemoryRetrievalPackCandidate) {
  const normalized =
    normalizeMemoryValue(candidate.normalizedValue) ||
    normalizeMemoryValue(candidate.content) ||
    normalizeMemoryValue(candidate.title);
  return [
    candidate.objectType,
    candidate.objectId,
    candidate.factType ?? "UNKNOWN",
    normalized || candidate.id,
  ].join(":");
}

function buildTrustScore(candidate: MemoryRetrievalPackCandidate) {
  const confirmedBoost = candidate.confirmedByUser ? 18 : 0;
  const posture = resolvePromotionPosture(candidate);
  const posturePenalty =
    posture === "system_inference" || posture === "candidate" || posture === "distillation_candidate"
      ? 12
      : 0;
  return clampScore(candidate.confidence + confirmedBoost - posturePenalty);
}

function buildRecencyScore(candidate: MemoryRetrievalPackCandidate, now: Date) {
  const ageDays = Math.max(
    0,
    (now.getTime() - candidate.updatedAt.getTime()) / (24 * 60 * 60 * 1000),
  );
  const agePenalty = Math.min(35, Math.floor(ageDays / 7) * 5);
  return clampScore(candidate.freshnessScore - agePenalty);
}

function scoreCandidate(candidate: MemoryRetrievalPackCandidate, input: MemoryRetrievalPackInput) {
  const trustScore = buildTrustScore(candidate);
  const recencyScore = buildRecencyScore(candidate, input.now ?? new Date());
  const primaryObjectBoost =
    candidate.objectType === input.objectType && candidate.objectId === input.objectId ? 12 : 0;
  const confirmedBoost = candidate.confirmedByUser ? 8 : 0;
  const posture = resolvePromotionPosture(candidate);
  const inferredPenalty =
    posture === "system_inference" || posture === "candidate" || posture === "distillation_candidate"
      ? 18
      : 0;

  return Math.round(
    candidate.importance * 0.42 +
      trustScore * 0.32 +
      recencyScore * 0.2 +
      primaryObjectBoost +
      confirmedBoost -
      inferredPenalty,
  );
}

function resolveSelectedReason(
  candidate: MemoryRetrievalPackCandidate,
  input: MemoryRetrievalPackInput,
): MemoryRetrievalSelectedReason {
  if (candidate.confirmedByUser) return "confirmed_by_user";
  if (candidate.objectType === input.objectType && candidate.objectId === input.objectId) {
    return "primary_object_match";
  }
  if (candidate.importance >= 75) return "high_importance";
  if (candidate.confidence >= 75) return "high_confidence";
  if (candidate.freshnessScore >= 75) return "fresh_active_fact";
  return "budget_fit";
}

function resolvePreBudgetOmissionReason(
  candidate: MemoryRetrievalPackCandidate,
  duplicateIds: Set<string>,
) {
  if (duplicateIds.has(candidate.id)) return "duplicate_candidate" as const;
  if (!ACTIVE_MEMORY_STATUSES.has(String(candidate.status))) return "inactive_or_invalid" as const;
  if (candidate.freshnessScore < STALE_FRESHNESS_THRESHOLD) return "stale_suppressed" as const;
  if (!candidate.confirmedByUser && candidate.confidence < LOW_TRUST_THRESHOLD) return "low_trust" as const;
  return null;
}

function incrementCounter<T extends string>(counter: Map<T, number>, key: T) {
  counter.set(key, (counter.get(key) ?? 0) + 1);
}

function counterToArray<T extends string>(counter: Map<T, number>) {
  return Array.from(counter)
    .map(([reason, count]) => ({ reason, count }))
    .sort((left, right) => right.count - left.count || left.reason.localeCompare(right.reason));
}

function collectDuplicateIds(candidates: MemoryRetrievalPackCandidate[], input: MemoryRetrievalPackInput) {
  const duplicateIds = new Set<string>();
  const groups = candidates.reduce((acc, candidate) => {
    const key = buildDuplicateKey(candidate);
    const group = acc.get(key) ?? [];
    group.push(candidate);
    acc.set(key, group);
    return acc;
  }, new Map<string, MemoryRetrievalPackCandidate[]>());

  for (const group of groups.values()) {
    if (group.length <= 1) continue;
    const [, ...duplicates] = [...group].sort((left, right) => {
      const scoreDelta = scoreCandidate(right, input) - scoreCandidate(left, input);
      if (scoreDelta !== 0) return scoreDelta;
      return right.updatedAt.getTime() - left.updatedAt.getTime();
    });
    for (const duplicate of duplicates) {
      duplicateIds.add(duplicate.id);
    }
  }

  return duplicateIds;
}

function normalizeBudget(budget: MemoryRetrievalPackBudget) {
  return {
    maxItems: Math.max(0, Math.floor(budget.maxItems)),
    maxEstimatedTokens: Math.max(0, Math.floor(budget.maxEstimatedTokens)),
  };
}

export function buildMemoryRetrievalPack(input: MemoryRetrievalPackInput): MemoryRetrievalPack {
  const budget = normalizeBudget(input.budget);
  const selectedReasons = new Map<MemoryRetrievalSelectedReason, number>();
  const omittedReasons = new Map<MemoryRetrievalOmittedReason, number>();
  const omitted: MemoryRetrievalOmittedItem[] = [];
  const selected: MemoryRetrievalSelectedItem[] = [];
  const duplicateIds = collectDuplicateIds(input.candidates, input);
  let estimatedTokensUsed = 0;

  const fallbackReason =
    input.fallbackReason ??
    (budget.maxItems <= 0 || budget.maxEstimatedTokens <= 0
      ? "invalid_or_empty_budget"
      : null);

  const candidatesWithScores = input.candidates
    .map((candidate) => ({
      candidate,
      score: scoreCandidate(candidate, input),
      estimatedTokens: estimateTokens(candidate),
      trustScore: buildTrustScore(candidate),
      recencyScore: buildRecencyScore(candidate, input.now ?? new Date()),
    }))
    .sort((left, right) => {
      const scoreDelta = right.score - left.score;
      if (scoreDelta !== 0) return scoreDelta;
      const updatedDelta = right.candidate.updatedAt.getTime() - left.candidate.updatedAt.getTime();
      if (updatedDelta !== 0) return updatedDelta;
      return right.candidate.id.localeCompare(left.candidate.id);
    });

  if (fallbackReason) {
    for (const item of candidatesWithScores) {
      omitted.push({
        candidate: item.candidate,
        omittedReason: "budget_item_limit",
        score: item.score,
        estimatedTokens: item.estimatedTokens,
      });
      incrementCounter(omittedReasons, "budget_item_limit");
    }
  } else {
    for (const item of candidatesWithScores) {
      const preBudgetOmission = resolvePreBudgetOmissionReason(item.candidate, duplicateIds);
      if (preBudgetOmission) {
        omitted.push({
          candidate: item.candidate,
          omittedReason: preBudgetOmission,
          score: item.score,
          estimatedTokens: item.estimatedTokens,
        });
        incrementCounter(omittedReasons, preBudgetOmission);
        continue;
      }

      if (selected.length >= budget.maxItems) {
        omitted.push({
          candidate: item.candidate,
          omittedReason: "budget_item_limit",
          score: item.score,
          estimatedTokens: item.estimatedTokens,
        });
        incrementCounter(omittedReasons, "budget_item_limit");
        continue;
      }

      if (estimatedTokensUsed + item.estimatedTokens > budget.maxEstimatedTokens) {
        omitted.push({
          candidate: item.candidate,
          omittedReason: "budget_token_limit",
          score: item.score,
          estimatedTokens: item.estimatedTokens,
        });
        incrementCounter(omittedReasons, "budget_token_limit");
        continue;
      }

      const selectedReason = resolveSelectedReason(item.candidate, input);
      selected.push({
        candidate: item.candidate,
        selectedReason,
        score: item.score,
        estimatedTokens: item.estimatedTokens,
        trustScore: item.trustScore,
        recencyScore: item.recencyScore,
        evidenceRefs: item.candidate.evidenceRefs ?? [`${item.candidate.sourceType}:${item.candidate.sourceId}`],
      });
      estimatedTokensUsed += item.estimatedTokens;
      incrementCounter(selectedReasons, selectedReason);
    }
  }

  const evidenceRefs = Array.from(
    new Set(selected.flatMap((item) => item.evidenceRefs)),
  );
  const staleSuppressionRefs = omitted
    .filter((item) => item.omittedReason === "stale_suppressed")
    .map((item) => item.candidate.id);

  return {
    surface: input.surface,
    objectType: input.objectType,
    objectId: input.objectId,
    budget,
    selected,
    omitted,
    fallback: {
      used: Boolean(fallbackReason),
      reason: fallbackReason,
    },
    trace: {
      candidateCount: input.candidates.length,
      selectedCount: selected.length,
      omittedCount: omitted.length,
      estimatedTokensUsed,
      estimatedTokensRemaining: Math.max(0, budget.maxEstimatedTokens - estimatedTokensUsed),
      selectedReasons: counterToArray(selectedReasons),
      omittedReasons: counterToArray(omittedReasons),
      staleSuppressionRefs,
      evidenceRefs,
      boundaryNote:
        "Retrieval pack selection is evidence packaging only; it does not change recommendation ranking, approval ownership, or commitment authority.",
    },
  };
}
