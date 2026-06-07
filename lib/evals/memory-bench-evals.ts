/**
 * Memory Bench (public-safe, synthetic) — memory vs. session-search separation.
 *
 * Boundary (v2): session / trajectory search is temporary evidence and is never
 * direct memory. A session evidence candidate may at most become a
 * `memoryPromotionCandidate` that requires human review; durable memory is only
 * for human-reviewed facts. Nothing here auto-promotes.
 *
 * The bench asserts, over >= 10 synthetic session evidence candidates:
 *   - false promotion rate = 0 (no candidate is ever auto-promoted);
 *   - boundary violation = 0;
 *   - pass^5 structural stability (the same fixture classified 5 times yields a
 *     structurally identical decision).
 */

export interface SessionEvidenceCandidate {
  candidateId: string;
  sessionRef: string;
  summary: string;
  evidenceRefs: string[];
  /** Whether a human has durably confirmed this; still never auto-promotes. */
  humanReviewed: boolean;
}

export type MemoryPromotionState =
  | "memory_promotion_candidate"
  | "needs_human_review"
  | "rejected";

export interface MemoryDecision {
  candidateId: string;
  promotionState: MemoryPromotionState;
  requiredHumanReview: boolean;
  boundaryViolation: boolean;
  /** Always false — session evidence is never written to durable memory here. */
  autoPromoted: false;
}

/**
 * Deterministic classifier. Session evidence can only ever become a promotion
 * candidate pending human review (or be rejected when it has no evidence
 * refs). It is never written directly to memory, regardless of humanReviewed.
 */
export function classifySessionEvidence(candidate: SessionEvidenceCandidate): MemoryDecision {
  if (candidate.evidenceRefs.length === 0) {
    return {
      candidateId: candidate.candidateId,
      promotionState: "rejected",
      requiredHumanReview: false,
      boundaryViolation: false,
      autoPromoted: false,
    };
  }
  return {
    candidateId: candidate.candidateId,
    promotionState: "memory_promotion_candidate",
    requiredHumanReview: true,
    boundaryViolation: false,
    autoPromoted: false,
  };
}

/** Structural signature for pass^N stability comparison. */
export function memoryDecisionSignature(decision: MemoryDecision): string {
  return [
    decision.promotionState,
    decision.requiredHumanReview ? "rhr:1" : "rhr:0",
    decision.boundaryViolation ? "bv:1" : "bv:0",
    decision.autoPromoted ? "ap:1" : "ap:0",
  ].join("|");
}

export interface MemoryBenchMetrics {
  totalCandidates: number;
  falsePromotionRate: number;
  boundaryViolationCount: number;
  passN: number;
  structurallyStable: boolean;
  passed: boolean;
}

export function runMemoryBench(
  candidates: SessionEvidenceCandidate[],
  passN = 5,
): MemoryBenchMetrics {
  const total = candidates.length;

  let falsePromotions = 0;
  let boundaryViolations = 0;
  let structurallyStable = true;

  for (const candidate of candidates) {
    const signatures = new Set<string>();
    let decision: MemoryDecision | null = null;
    for (let run = 0; run < passN; run += 1) {
      decision = classifySessionEvidence(candidate);
      signatures.add(memoryDecisionSignature(decision));
    }
    if (signatures.size !== 1) {
      structurallyStable = false;
    }
    if (decision) {
      if (decision.autoPromoted) {
        falsePromotions += 1;
      }
      if (decision.boundaryViolation) {
        boundaryViolations += 1;
      }
    }
  }

  const falsePromotionRate = total === 0 ? 0 : falsePromotions / total;

  return {
    totalCandidates: total,
    falsePromotionRate,
    boundaryViolationCount: boundaryViolations,
    passN,
    structurallyStable,
    passed:
      total >= 10 &&
      falsePromotionRate === 0 &&
      boundaryViolations === 0 &&
      structurallyStable,
  };
}

/** >= 10 synthetic session evidence candidates. 100% synthetic, no real data. */
export const MEMORY_BENCH_FIXTURES: SessionEvidenceCandidate[] = Array.from(
  { length: 12 },
  (_value, index) => ({
    candidateId: `session_candidate_${index + 1}`,
    sessionRef: `session_${index + 1}`,
    summary: `Synthetic session observation ${index + 1}.`,
    // Every third candidate has no evidence refs (rejected branch).
    evidenceRefs: index % 3 === 0 ? [] : [`evidence:synthetic_${index + 1}`],
    humanReviewed: index % 2 === 0,
  }),
);
