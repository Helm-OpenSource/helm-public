// Synthetic fixtures for the CAIO Pro V1 completion gate. Every string is
// synthetic; nothing here is customer, production, or value evidence.

import {
  CAIO_PRO_V1_ATTESTABLE_ITEMS,
  CAIO_PRO_V1_COMPLETION_ASSESSMENT_SCHEMA_VERSION,
  createCaioProV1EvidenceAttestation,
  createCaioProV1RetrospectiveReceipt,
  createCaioQuestionValueReceipt,
  type CaioProV1CompletionAssessmentInput,
  type CaioQuestionValueReceiptInput,
} from "./caio-pro-completion";

const WORKSPACE_REF = "workspace:synthetic-caio-completion";
const SELECTION_REF = "caio-question-selection:synthetic-1";
const PORTFOLIO_REF = "caio-question-portfolio:synthetic-1";
const GATE_RECEIPT_REF = "caio-g0-gate:synthetic-1";
const G0_ASSESSMENT_REF = "caio-g0-assessment:synthetic-1";
const QUESTION_IDS = ["question-1", "question-2"] as const;

export function syntheticCaioQuestionValueReceiptInput(
  questionId: string = QUESTION_IDS[0],
): CaioQuestionValueReceiptInput {
  return {
    workspaceRef: WORKSPACE_REF,
    selectionReceiptRef: SELECTION_REF,
    questionId,
    baselineWindow: {
      start: "2026-04-01T00:00:00.000Z",
      end: "2026-05-01T00:00:00.000Z",
    },
    resultWindow: {
      start: "2026-05-01T00:00:00.000Z",
      end: "2026-06-05T00:00:00.000Z",
    },
    resultWindowShortfallReason: null,
    metricDefinitions: [
      {
        metricKey: `governed-baseline-${questionId}`,
        definition:
          "Synthetic governed operating baseline observed from the evidence window",
        dataSourceRefs: [`evidence:caio-completion:${questionId}`],
      },
    ],
    observedDelta: {
      description: "Synthetic observed improvement against the baseline",
      quantifiedValue: 1200,
      currency: "CNY",
      confidence: "medium",
      evidenceRefs: [`evidence:caio-completion:delta:${questionId}`],
    },
    adviceRefs: [`caio-advice:synthetic:${questionId}`],
    decisionRefs: [`decision-record:synthetic:${questionId}`],
    executionReceiptRefs: [`execution-receipt:synthetic:${questionId}`],
    acceptanceReceiptRefs: [`acceptance-receipt:synthetic:${questionId}`],
    counterfactualNotes:
      "Synthetic counterfactual: part of the delta may have occurred without the intervention",
    externalFactorNotes:
      "Synthetic external factor: seasonal demand shifted during the result window",
    valueClasses: ["efficiency"],
    unprovenParts: [
      "Causality between the advice chain and the full delta is unproven",
    ],
    nextStepRecommendation:
      "Continue observation for one more governed window before any expansion",
    ownerConclusion: "continue",
    recordedAt: "2026-06-06T00:00:00.000Z",
  };
}

export function syntheticCaioProV1CompletionInput(): CaioProV1CompletionAssessmentInput {
  return {
    schemaVersion: CAIO_PRO_V1_COMPLETION_ASSESSMENT_SCHEMA_VERSION,
    workspaceRef: WORKSPACE_REF,
    evaluatedAt: "2026-06-07T00:00:00.000Z",
    attestations: CAIO_PRO_V1_ATTESTABLE_ITEMS.map((itemKey) =>
      createCaioProV1EvidenceAttestation({
        workspaceRef: WORKSPACE_REF,
        itemKey,
        version: 1,
        statement: `Synthetic owner attestation for ${itemKey}`,
        evidenceRefs: [`evidence:attestation:${itemKey}`],
        ceoPrincipalBindingRef: "binding:ceo:synthetic-completion",
        ceoPrincipalRef: "principal:ceo:synthetic-completion",
        actorUserRef: "user:ceo:synthetic-completion",
    recordedByPrincipalKind: "ceo" as const,
    recordedByPrincipalRef: "principal:ceo:synthetic-completion",
    recordedByBindingRef: "binding:ceo:synthetic-completion",
        recordedAt: "2026-06-06T12:00:00.000Z",
      }),
    ),
    catalog: {
      assetCount: 12,
      completeStateCount: 12,
      evidenceRefs: ["evidence:catalog:synthetic"],
    },
    g0: {
      acceptedGateReceiptRef: GATE_RECEIPT_REF,
      acceptedAssessmentRef: G0_ASSESSMENT_REF,
      gateCurrentlyAccepted: true,
    },
    portfolio: {
      currentPortfolioRef: PORTFOLIO_REF,
      candidateCount: 10,
      boundGateReceiptRef: GATE_RECEIPT_REF,
    },
    selection: {
      currentSelectionReceiptRef: SELECTION_REF,
      selectedQuestionIds: [...QUESTION_IDS],
      portfolioRef: PORTFOLIO_REF,
      portfolioHashBound: true,
    },
    implementationPlans: QUESTION_IDS.map((questionId) => ({
      questionId,
      decisionRecordRef: `decision-record:synthetic:${questionId}`,
      implementationPlanRef: `implementation-plan:synthetic:${questionId}`,
    })),
    supervisionChains: [
      {
        questionId: QUESTION_IDS[0],
        decisionRecordRef: `decision-record:synthetic:${QUESTION_IDS[0]}`,
        dispatchedWorkPacketRef: "action-item:synthetic-1",
        verifiedExecutionReceiptRef: "execution-receipt:synthetic-1",
        evaluationRecordedAt: "2026-06-05T12:00:00.000Z",
        observedMemoryCandidateRef: "memory-fact:synthetic-1",
      },
    ],
    valueReceipts: QUESTION_IDS.map((questionId) =>
      createCaioQuestionValueReceipt(
        syntheticCaioQuestionValueReceiptInput(questionId),
      ),
    ),
    retrospective: createCaioProV1RetrospectiveReceipt({
      workspaceRef: WORKSPACE_REF,
      selectionReceiptRef: SELECTION_REF,
      reusablePackAssetRefs: ["pack-asset:synthetic-governed-baseline"],
      customerOverlayRefs: ["overlay-ref:synthetic-customer-rules"],
      maturityEvaluations: [
        {
          actionCategory: "operating_review",
          recommendation: "advise",
          evidenceRefs: ["evidence:retrospective:operating-review"],
        },
      ],
      overallRecommendation: "continue",
      recordedAt: "2026-06-06T18:00:00.000Z",
    }),
  };
}
