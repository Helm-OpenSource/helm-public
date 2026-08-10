import { canonicalJson, sha256 } from "../expert-capability/hashing";
import {
  caioProPackOperatingInputSchema,
  type CaioProPackOperatingInput,
} from "./caio-pro-fde-cross-repo-contract";
import {
  CAIO_OPERATING_QUESTION_POLICY,
  computeCaioOperatingQuestionCompositeScore,
  validateCaioOperatingQuestionG0Context,
  type CaioOperatingQuestionCandidateDraft,
  type CaioOperatingQuestionG0Context,
  type CaioOperatingQuestionScores,
} from "./caio-operating-question";
import type { EvidenceFreshnessState } from "./types";

export type CaioOperatingQuestionTrustedEvidence = {
  evidenceRef: string;
  evidenceKind: string;
  freshness: EvidenceFreshnessState;
  capturedAt: string;
};

export const CAIO_OPERATING_QUESTION_PACK_DERIVATION_REVISION =
  "caio-operating-question-pack-derivation.v1" as const;

export type CaioOperatingQuestionPackDerivation = {
  candidates: CaioOperatingQuestionCandidateDraft[];
  eligibleCandidateInputRefs: string[];
  selectedCandidateInputRefs: string[];
  ineligibleCandidateInputRefs: string[];
};

const CANONICAL_UTC_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

function compareCodePoints(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareCodePoints);
}

function isCanonicalUtcTimestamp(value: string): boolean {
  return (
    CANONICAL_UTC_TIMESTAMP_PATTERN.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function combinedFreshness(
  evidence: readonly CaioOperatingQuestionTrustedEvidence[],
): EvidenceFreshnessState {
  if (evidence.some((entry) => entry.freshness === "stale")) return "stale";
  if (evidence.some((entry) => entry.freshness === "unknown")) {
    return "unknown";
  }
  return "fresh";
}

function deriveScores(input: {
  taxonomyCount: number;
  metricCount: number;
  ruleCount: number;
  evidenceCount: number;
  freshness: EvidenceFreshnessState;
}): CaioOperatingQuestionScores {
  return {
    businessValue: clampScore(
      50 + input.taxonomyCount * 7 + input.metricCount * 5,
    ),
    urgency:
      input.freshness === "stale"
        ? 75
        : input.freshness === "unknown"
          ? 45
          : 60,
    evidenceStrength: clampScore(45 + input.evidenceCount * 8),
    intervenability: clampScore(40 + input.ruleCount * 10),
    measurability: clampScore(50 + input.metricCount * 12),
    riskAndCost: clampScore(
      20 + input.taxonomyCount * 5 + input.metricCount * 4,
    ),
  };
}

export function canonicalizeCaioProPackOperatingInputForGeneration(
  input: CaioProPackOperatingInput,
): CaioProPackOperatingInput {
  return {
    ...input,
    evidenceBindings: [...input.evidenceBindings].sort((left, right) =>
      compareCodePoints(left.evidenceRef, right.evidenceRef),
    ),
    taxonomy: [...input.taxonomy].sort((left, right) =>
      compareCodePoints(left.taxonomyRef, right.taxonomyRef),
    ),
    metrics: input.metrics
      .map((metric) => ({
        ...metric,
        evidenceRefs: uniqueSorted(metric.evidenceRefs),
      }))
      .sort((left, right) =>
        compareCodePoints(left.metricRef, right.metricRef),
      ),
    evidenceApplicabilityRules: input.evidenceApplicabilityRules
      .map((rule) => ({
        ...rule,
        taxonomyRefs: uniqueSorted(rule.taxonomyRefs),
        acceptedEvidenceKinds: uniqueSorted(rule.acceptedEvidenceKinds),
      }))
      .sort((left, right) => compareCodePoints(left.ruleRef, right.ruleRef)),
    candidateInputs: input.candidateInputs
      .map((candidate) => ({
        ...candidate,
        taxonomyRefs: uniqueSorted(candidate.taxonomyRefs),
        metricRefs: uniqueSorted(candidate.metricRefs),
        evidenceRefs: uniqueSorted(candidate.evidenceRefs),
      }))
      .sort((left, right) =>
        compareCodePoints(left.candidateRef, right.candidateRef),
      ),
  };
}

export function deriveCaioOperatingQuestionCandidatesFromPackInput(input: {
  packOperatingInput: CaioProPackOperatingInput;
  portfolioRef: string;
  g0Context: CaioOperatingQuestionG0Context;
  trustedEvidence: readonly CaioOperatingQuestionTrustedEvidence[];
  baselineWindowEnd: string;
}): CaioOperatingQuestionPackDerivation {
  const parsedPackInput = caioProPackOperatingInputSchema.safeParse(
    input.packOperatingInput,
  );
  const contextValidation = validateCaioOperatingQuestionG0Context(
    input.g0Context,
  );
  if (
    !parsedPackInput.success ||
    !contextValidation.valid ||
    input.portfolioRef !== input.packOperatingInput.portfolioRef ||
    input.g0Context.workspaceRef !== input.packOperatingInput.workspaceRef ||
    !isCanonicalUtcTimestamp(input.baselineWindowEnd)
  ) {
    throw new Error("caio_pack_question_generation_context_invalid");
  }

  const packInput = canonicalizeCaioProPackOperatingInputForGeneration(
    parsedPackInput.data,
  );
  const g0EvidenceRefs = new Set(input.g0Context.evidenceRefs);
  const trustedEvidenceByRef = new Map<
    string,
    CaioOperatingQuestionTrustedEvidence
  >();
  for (const evidence of input.trustedEvidence) {
    if (
      trustedEvidenceByRef.has(evidence.evidenceRef) ||
      !g0EvidenceRefs.has(evidence.evidenceRef) ||
      !isCanonicalUtcTimestamp(evidence.capturedAt) ||
      Date.parse(evidence.capturedAt) >= Date.parse(input.baselineWindowEnd)
    ) {
      throw new Error("caio_pack_question_trusted_evidence_invalid");
    }
    trustedEvidenceByRef.set(evidence.evidenceRef, evidence);
  }

  const bindingByRef = new Map(
    packInput.evidenceBindings.map((binding) => [
      binding.evidenceRef,
      binding,
    ]),
  );
  const taxonomyByRef = new Map(
    packInput.taxonomy.map((taxonomy) => [taxonomy.taxonomyRef, taxonomy]),
  );
  const metricByRef = new Map(
    packInput.metrics.map((metric) => [metric.metricRef, metric]),
  );
  const rulesByTaxonomy = new Map<
    string,
    typeof packInput.evidenceApplicabilityRules
  >();
  for (const rule of packInput.evidenceApplicabilityRules) {
    for (const taxonomyRef of rule.taxonomyRefs) {
      const rules = rulesByTaxonomy.get(taxonomyRef) ?? [];
      rules.push(rule);
      rulesByTaxonomy.set(taxonomyRef, rules);
    }
  }

  const eligible: Array<{
    candidateInputRef: string;
    draft: CaioOperatingQuestionCandidateDraft;
  }> = [];
  const ineligible: string[] = [];
  for (const candidateInput of packInput.candidateInputs) {
    const taxonomies = candidateInput.taxonomyRefs.flatMap((ref) => {
      const taxonomy = taxonomyByRef.get(ref);
      return taxonomy ? [taxonomy] : [];
    });
    const metrics = candidateInput.metricRefs.flatMap((ref) => {
      const metric = metricByRef.get(ref);
      return metric ? [metric] : [];
    });
    const evidenceRefs = uniqueSorted([
      ...candidateInput.evidenceRefs,
      ...metrics.flatMap((metric) => metric.evidenceRefs),
    ]);
    const evidence = evidenceRefs.flatMap((ref) => {
      const trusted = trustedEvidenceByRef.get(ref);
      const binding = bindingByRef.get(ref);
      return trusted && binding && trusted.evidenceKind === binding.evidenceKind
        ? [trusted]
        : [];
    });
    const rules = uniqueSorted(
      taxonomies.flatMap((taxonomy) =>
        (rulesByTaxonomy.get(taxonomy.taxonomyRef) ?? []).flatMap((rule) =>
          evidence.some((entry) =>
            rule.acceptedEvidenceKinds.includes(entry.evidenceKind),
          )
            ? [rule.ruleRef]
            : [],
        ),
      ),
    );
    const everyTaxonomyCovered = taxonomies.every((taxonomy) => {
      const taxonomyRules = rulesByTaxonomy.get(taxonomy.taxonomyRef) ?? [];
      return evidence.every((entry) =>
        taxonomyRules.some((rule) =>
          rule.acceptedEvidenceKinds.includes(entry.evidenceKind),
        ),
      );
    });
    if (
      taxonomies.length !== candidateInput.taxonomyRefs.length ||
      metrics.length !== candidateInput.metricRefs.length ||
      evidence.length !== evidenceRefs.length ||
      rules.length === 0 ||
      !everyTaxonomyCovered
    ) {
      ineligible.push(candidateInput.candidateRef);
      continue;
    }

    const baselineWindowStart = evidence
      .map((entry) => entry.capturedAt)
      .sort(compareCodePoints)[0];
    if (
      !baselineWindowStart ||
      Date.parse(baselineWindowStart) >= Date.parse(input.baselineWindowEnd)
    ) {
      ineligible.push(candidateInput.candidateRef);
      continue;
    }
    const freshness = combinedFreshness(evidence);
    const scores = deriveScores({
      taxonomyCount: taxonomies.length,
      metricCount: metrics.length,
      ruleCount: rules.length,
      evidenceCount: evidence.length,
      freshness,
    });
    const taxonomyLabels = taxonomies.map((entry) => entry.label).join(" / ");
    const metricDescriptions = metrics
      .map((entry) => entry.definition)
      .join(" / ");
    const evidenceKinds = uniqueSorted(
      evidence.map((entry) => entry.evidenceKind),
    );
    const semanticBasisRefs = uniqueSorted([
      candidateInput.candidateRef,
      ...candidateInput.taxonomyRefs,
      ...taxonomies.map((taxonomy) => taxonomy.categoryRef),
      ...candidateInput.metricRefs,
      ...rules,
    ]);
    const questionBasisHash = sha256(
      canonicalJson({
        derivationRevision:
          CAIO_OPERATING_QUESTION_PACK_DERIVATION_REVISION,
        candidateInput,
        taxonomies,
        metrics,
        rules,
        evidenceKinds,
      }),
    );
    const candidateLabel = candidateInput.candidateRef.replace(
      /^candidate-input:/u,
      "",
    );
    eligible.push({
      candidateInputRef: candidateInput.candidateRef,
      draft: {
        questionId: `caio-pack-question:${questionBasisHash.slice(7, 31)}`,
        title: `${taxonomyLabels} review (${candidateLabel})`,
        question: `Which governed test should the owner review for ${taxonomyLabels} using ${metricDescriptions} under semantic basis ${candidateInput.candidateRef}?`,
        whyNow: `The accepted G0 scope contains ${evidence.length} bound evidence reference(s). Pack rationale: ${candidateInput.rationale}`,
        businessDomain: taxonomyLabels,
        impactObjectRefs: [input.portfolioRef],
        facts: [
          {
            statement: `The accepted G0 context contains ${evidence.length} Portfolio-scoped evidence reference(s) for the selected metrics.`,
            evidenceRefs,
            freshness,
          },
        ],
        inferences: [
          {
            statement: `Pack rules ${rules.join(", ")} mark evidence kinds ${evidenceKinds.join(", ")} as applicable to ${taxonomyLabels}; causal effect remains unverified.`,
            evidenceRefs,
            freshness,
          },
        ],
        unknowns: [
          "Causal contribution and expected business value remain unverified.",
        ],
        conflicts: [],
        evidenceRefs,
        freshness,
        confidence:
          freshness === "fresh" && evidence.length >= 2
            ? "high"
            : freshness === "unknown"
              ? "low"
              : "medium",
        valueHypothesis: {
          description: `Testing ${metricDescriptions} may clarify the operating decision for ${taxonomyLabels}.`,
          quantifiedValue: null,
          currency: null,
          evidenceRefs: [],
          unknownReason:
            "No governed monetary baseline or causal estimate is present in the scoped evidence.",
        },
        scores,
        validationMetrics: metrics.map((metric) => ({
          metricKey: metric.metricRef,
          description: metric.definition,
          unit: metric.unit,
          direction: "maintain" as const,
          baselineWindowStart,
          baselineWindowEnd: input.baselineWindowEnd,
        })),
        firstNarrowLoop: {
          objective: `Observe ${metricDescriptions} before any owner decision for ${taxonomyLabels}.`,
          observationRefs: uniqueSorted([
            packInput.evidenceSnapshotRef,
            ...evidenceRefs,
          ]),
          decisionBoundary:
            "Owner review is required before any decision or external action.",
          supervisionSignal: `Review changes in ${metrics.map((metric) => metric.unit).join(" / ")} for ${candidateInput.metricRefs.join(", ")}.`,
          receiptRequirement:
            "Record the next observation and any owner decision in canonical receipts.",
        },
        requiredDataRefs: evidenceRefs,
        dependencyRefs: semanticBasisRefs,
        risks: [
          "Evidence applicability does not establish causality or authorize action.",
        ],
        inactionConsequence:
          "The scoped operating uncertainty remains unresolved until the next governed review.",
      },
    });
  }

  const ranked = eligible.sort(
    (left, right) =>
      computeCaioOperatingQuestionCompositeScore(right.draft.scores) -
        computeCaioOperatingQuestionCompositeScore(left.draft.scores) ||
      compareCodePoints(left.candidateInputRef, right.candidateInputRef),
  );
  const selected = ranked.slice(
    0,
    CAIO_OPERATING_QUESTION_POLICY.requiredCandidateCount,
  );
  return {
    candidates: selected.map((entry) => entry.draft),
    eligibleCandidateInputRefs: uniqueSorted(
      eligible.map((entry) => entry.candidateInputRef),
    ),
    selectedCandidateInputRefs: selected.map(
      (entry) => entry.candidateInputRef,
    ),
    ineligibleCandidateInputRefs: uniqueSorted(ineligible),
  };
}
