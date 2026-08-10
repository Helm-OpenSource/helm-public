import { describe, expect, it } from "vitest";

import {
  CAIO_PRO_COMPLETION_EVALUATOR_INTERFACE,
  CAIO_PRO_FDE_CROSS_REPO_INTERFACE_CONTRACT_HASH,
  CAIO_PRO_FDE_CROSS_REPO_INTERFACE_CONTRACT_REF,
  CAIO_PRO_FDE_CROSS_REPO_INTERFACE_VERSION,
  CAIO_PRO_PACK_OPERATING_INPUT_SCHEMA_VERSION,
  type CaioProPackOperatingInput,
} from "./caio-pro-fde-cross-repo-contract";
import {
  deriveCaioOperatingQuestionCandidatesFromPackInput,
  type CaioOperatingQuestionTrustedEvidence,
} from "./caio-operating-question-pack-generator";
import {
  syntheticOperatingQuestionG0Context,
  syntheticOperatingQuestionG0Source,
  SYNTHETIC_CAIO_EVIDENCE_REFS,
} from "./caio-operating-question.test-fixtures";

function packOperatingInput(count = 10): CaioProPackOperatingInput {
  const evidenceRefs = SYNTHETIC_CAIO_EVIDENCE_REFS.slice(0, count);
  return {
    schemaVersion: CAIO_PRO_PACK_OPERATING_INPUT_SCHEMA_VERSION,
    interfaceVersion: CAIO_PRO_FDE_CROSS_REPO_INTERFACE_VERSION,
    contractRef: CAIO_PRO_FDE_CROSS_REPO_INTERFACE_CONTRACT_REF,
    contractHash: CAIO_PRO_FDE_CROSS_REPO_INTERFACE_CONTRACT_HASH,
    evaluatorRevision:
      CAIO_PRO_COMPLETION_EVALUATOR_INTERFACE.evaluatorRevision,
    evaluatorContractRef:
      CAIO_PRO_COMPLETION_EVALUATOR_INTERFACE.evaluatorContractRef,
    evaluatorContractHash:
      CAIO_PRO_COMPLETION_EVALUATOR_INTERFACE.evaluatorContractHash,
    workspaceRef: "workspace:synthetic-caio",
    portfolioRef: "opportunity:portfolio-1",
    evidenceSnapshotRef: "observation-run:run-1",
    evidenceBindings: evidenceRefs.map((evidenceRef) => ({
      evidenceRef,
      evidenceKind: "source_observation",
    })),
    taxonomy: evidenceRefs.map((_, index) => ({
      taxonomyRef: `taxonomy:operating-risk-${index + 1}`,
      categoryRef: `category:delivery-risk-${index + 1}`,
      label: `Delivery risk ${index + 1}`,
    })),
    metrics: evidenceRefs.map((evidenceRef, index) => ({
      metricRef: `metric:on-time-completion-${index + 1}`,
      definition: `Share completed inside operating window ${index + 1}.`,
      unit: "percent",
      evidenceRefs: [evidenceRef],
    })),
    evidenceApplicabilityRules: evidenceRefs.map((_, index) => ({
      ruleRef: `evidence-rule:delivery-risk-${index + 1}`,
      taxonomyRefs: [`taxonomy:operating-risk-${index + 1}`],
      acceptedEvidenceKinds: ["source_observation"],
    })),
    candidateInputs: evidenceRefs.map((evidenceRef, index) => ({
      candidateRef: `candidate-input:delivery-risk-${index + 1}`,
      taxonomyRefs: [`taxonomy:operating-risk-${index + 1}`],
      metricRefs: [`metric:on-time-completion-${index + 1}`],
      evidenceRefs: [evidenceRef],
      rationale: `Review governed delivery evidence ${index + 1}.`,
    })),
    authorityEffect: "none",
  };
}

function trustedEvidence(): CaioOperatingQuestionTrustedEvidence[] {
  const source = syntheticOperatingQuestionG0Source();
  const freshnessBySource = new Map(
    source.assessmentInput.sources.map((entry) => [
      entry.sourceRef,
      entry.freshness,
    ]),
  );
  return source.assessmentInput.evidenceTraces.map((trace) => ({
    evidenceRef: trace.evidenceRef,
    evidenceKind: "source_observation",
    freshness: freshnessBySource.get(trace.sourceRef) ?? "unknown",
    capturedAt: trace.capturedAt,
  }));
}

function derive(packInput: CaioProPackOperatingInput) {
  return deriveCaioOperatingQuestionCandidatesFromPackInput({
    packOperatingInput: packInput,
    portfolioRef: packInput.portfolioRef,
    g0Context: syntheticOperatingQuestionG0Context(),
    trustedEvidence: trustedEvidence(),
    baselineWindowEnd: "2026-07-23T07:00:00.000Z",
  });
}

function candidateFor(
  packInput: CaioProPackOperatingInput,
  candidateInputRef: string,
) {
  const candidate = derive(packInput).candidates.find((entry) =>
    entry.dependencyRefs.includes(candidateInputRef),
  );
  if (!candidate) throw new Error(`candidate not derived: ${candidateInputRef}`);
  return candidate;
}

describe("CAIO operating question Pack generator", () => {
  it("derives exactly ten Core-owned drafts with auditable semantic basis refs", () => {
    const result = derive(packOperatingInput());

    expect(result.candidates).toHaveLength(10);
    expect(result.eligibleCandidateInputRefs).toHaveLength(10);
    for (const candidate of result.candidates) {
      expect(candidate.facts).not.toHaveLength(0);
      expect(candidate.inferences).not.toHaveLength(0);
      expect(candidate.validationMetrics).not.toHaveLength(0);
      expect(candidate.firstNarrowLoop.observationRefs).not.toHaveLength(0);
      expect(candidate.dependencyRefs).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/^candidate-input:/u),
          expect.stringMatching(/^taxonomy:/u),
          expect.stringMatching(/^category:/u),
          expect.stringMatching(/^metric:/u),
          expect.stringMatching(/^evidence-rule:/u),
        ]),
      );
    }
  });

  it("makes taxonomy, metric, rule and candidate-input semantics observable", () => {
    const base = packOperatingInput();
    const candidateInputRef = "candidate-input:delivery-risk-1";
    const baseline = candidateFor(base, candidateInputRef);

    const taxonomyChanged = structuredClone(base);
    taxonomyChanged.taxonomy[0].label = "Fulfilment reliability";
    expect(candidateFor(taxonomyChanged, candidateInputRef).title).not.toBe(
      baseline.title,
    );

    const metricChanged = structuredClone(base);
    metricChanged.candidateInputs[0].metricRefs = [
      "metric:on-time-completion-1",
      "metric:on-time-completion-2",
    ];
    expect(
      candidateFor(metricChanged, candidateInputRef).validationMetrics,
    ).not.toEqual(baseline.validationMetrics);
    expect(
      candidateFor(metricChanged, candidateInputRef).scores,
    ).not.toEqual(baseline.scores);

    const rankChanged = structuredClone(base);
    rankChanged.candidateInputs[1].metricRefs = [
      "metric:on-time-completion-1",
      "metric:on-time-completion-2",
    ];
    expect(derive(rankChanged).selectedCandidateInputRefs[0]).toBe(
      "candidate-input:delivery-risk-2",
    );

    const ruleChanged = structuredClone(base);
    ruleChanged.evidenceApplicabilityRules[0].ruleRef =
      "evidence-rule:delivery-reliability-1";
    expect(
      candidateFor(ruleChanged, candidateInputRef).dependencyRefs,
    ).not.toEqual(baseline.dependencyRefs);

    const candidateInputChanged = structuredClone(base);
    candidateInputChanged.candidateInputs[0].rationale =
      "Review the accepted evidence before narrowing the next loop.";
    expect(
      candidateFor(candidateInputChanged, candidateInputRef).whyNow,
    ).not.toBe(baseline.whyNow);
  });

  it("excludes candidate inputs without complete trusted evidence", () => {
    const packInput = packOperatingInput();
    const evidence = trustedEvidence().slice(0, 9);

    const result = deriveCaioOperatingQuestionCandidatesFromPackInput({
      packOperatingInput: packInput,
      portfolioRef: packInput.portfolioRef,
      g0Context: syntheticOperatingQuestionG0Context(),
      trustedEvidence: evidence,
      baselineWindowEnd: "2026-07-23T07:00:00.000Z",
    });

    expect(result.candidates).toHaveLength(9);
    expect(result.ineligibleCandidateInputRefs).toEqual([
      "candidate-input:delivery-risk-10",
    ]);
  });

  it("excludes evidence-kind drift instead of trusting the Pack label alone", () => {
    const packInput = packOperatingInput();
    const evidence = trustedEvidence();
    evidence[9] = { ...evidence[9], evidenceKind: "verified_receipt" };

    const result = deriveCaioOperatingQuestionCandidatesFromPackInput({
      packOperatingInput: packInput,
      portfolioRef: packInput.portfolioRef,
      g0Context: syntheticOperatingQuestionG0Context(),
      trustedEvidence: evidence,
      baselineWindowEnd: "2026-07-23T07:00:00.000Z",
    });

    expect(result.ineligibleCandidateInputRefs).toContain(
      "candidate-input:delivery-risk-10",
    );
    expect(result.candidates).toHaveLength(9);
  });
});
