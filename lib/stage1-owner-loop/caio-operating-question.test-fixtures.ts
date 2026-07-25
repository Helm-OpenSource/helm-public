import {
  CAIO_INITIALIZATION_ASSESSMENT_SCHEMA_VERSION,
  computeCaioInitializationAssessment,
  type CaioInitializationAssessmentInput,
} from "./caio-initialization-gate";
import { createCaioInitializationAcceptanceReceipt } from "./caio-initialization-gate-receipt";
import {
  createCaioOperatingQuestionG0Context,
  type CaioOperatingQuestionCandidateDraft,
} from "./caio-operating-question";

export const SYNTHETIC_CAIO_QUESTION_NOW = "2026-07-23T09:00:00.000Z";
const HASH_A = `sha256:${"a".repeat(64)}`;
const HASH_B = `sha256:${"b".repeat(64)}`;
const HASH_C = `sha256:${"c".repeat(64)}`;
export const SYNTHETIC_CAIO_EVIDENCE_REFS = Array.from(
  { length: 12 },
  (_, index) => `evidence:operating:${index + 1}`,
);

export function syntheticOperatingQuestionG0Input(): CaioInitializationAssessmentInput {
  return {
    schemaVersion: CAIO_INITIALIZATION_ASSESSMENT_SCHEMA_VERSION,
    workspaceRef: "workspace:synthetic-caio",
    mandateRef: "mandate:synthetic-caio",
    evaluatedAt: "2026-07-23T07:00:00.000Z",
    assets: [
      {
        assetRef: "asset:operating-system",
        inventoryStatus: "inventoried",
        classificationStatus: "classified",
        sensitivity: "confidential",
        processingDisposition: "local_only",
        authorizationStatus: "authorized",
        authorizationReceiptRef: "receipt:authorization:operating-system",
        technicalFeasibility: "feasible",
        connectionStatus: "connected",
        connectionReceiptRef: "receipt:connection:operating-system",
        initializationStatus: "initialized",
        initializationReceiptRef: "receipt:initialization:operating-system",
        observationRunRefs: ["run:operating-system"],
        schemaMappingRefs: ["schema-map:operating-system:v1"],
        companyMemoryBindings: [
          {
            ref: "memory-fact:operating-system",
            contentHash: HASH_A,
          },
        ],
        temporalContextSnapshotRef:
          "artifact:temporal-context:operating-system",
        exception: null,
      },
    ],
    sources: [
      {
        sourceRef: "source:operating-system",
        assetRef: "asset:operating-system",
        compatibilityMode: false,
        sourceStatus: "active",
        accessMode: "read_only_api",
        latestRunRef: "run:operating-system",
        latestRunStatus: "succeeded",
        latestRunOutcome: "success",
        freshness: "fresh",
        exception: null,
      },
    ],
    evidenceTraces: SYNTHETIC_CAIO_EVIDENCE_REFS.map((evidenceRef, index) => ({
      evidenceRef,
      sourceRef: "source:operating-system",
      assetRef: "asset:operating-system",
      observationRunRef: "run:operating-system",
      authorizationReceiptRef: "receipt:authorization:operating-system",
      connectionReceiptRef: "receipt:connection:operating-system",
      initializationReceiptRef: "receipt:initialization:operating-system",
      sensitivity: "confidential" as const,
      outputType: (
        ["owner_answer", "operating_brief", "supervision_signal"] as const
      )[index % 3],
      capturedAt: new Date(Date.UTC(2026, 6, 23, 6, index)).toISOString(),
      resolved: true,
      traceHash: HASH_A,
    })),
    knowledge: {
      memoryRebuildReceiptRef: "receipt:memory-rebuild:operating-system",
      memoryRootHash: HASH_A,
      temporalContextArtifactRef: "artifact:temporal-context:operating-system",
      temporalContextInputHash: HASH_B,
      temporalContextSnapshotHash: HASH_C,
      temporalContextReplayRootHash: HASH_A,
      temporalContextReplayValid: true,
    },
    registeredWritePathCount: 0,
  };
}

export function syntheticOperatingQuestionG0Source() {
  const assessmentInput = syntheticOperatingQuestionG0Input();
  const assessment = computeCaioInitializationAssessment(assessmentInput);
  const gateReceipt = createCaioInitializationAcceptanceReceipt({
    workspaceRef: assessment.workspaceRef,
    assessment,
    mandateRef: assessment.mandateRef,
    ceoPrincipalBindingRef: "binding:ceo:synthetic-caio",
    ceoPrincipalRef: "principal:ceo:synthetic-caio",
    actorUserRef: "user:ceo:synthetic-caio",
    idempotencyKey: "accept:synthetic-caio:v1",
    evidenceRefs: ["evidence:ceo-reviewed-g0"],
    previousReceipt: null,
    recordedAt: "2026-07-23T08:00:00.000Z",
    inventoryConfirmationRef: "confirmation:inventory:synthetic-caio",
    customerAcceptanceRef: "acceptance:ceo:synthetic-caio",
    acceptedExceptionRefs: [],
    reasonCodes: ["owner_scope_confirmed"],
  });
  return {
    assessmentInput,
    assessment,
    gateReceipt,
    currentHead: {
      currentReceiptRef: gateReceipt.receiptId,
      currentReceiptHash: gateReceipt.contentHash,
      currentAssessmentRef: assessment.assessmentId,
      sequence: gateReceipt.sequence,
    },
  };
}

export function syntheticOperatingQuestionG0Context() {
  return createCaioOperatingQuestionG0Context(
    syntheticOperatingQuestionG0Source(),
  );
}

export function syntheticOperatingQuestionCandidate(
  index: number,
  overrides: Partial<CaioOperatingQuestionCandidateDraft> = {},
): CaioOperatingQuestionCandidateDraft {
  const evidenceRef =
    SYNTHETIC_CAIO_EVIDENCE_REFS[index % SYNTHETIC_CAIO_EVIDENCE_REFS.length];
  return {
    questionId: `operating-question-${index + 1}`,
    title: `Operating focus ${index + 1}`,
    question: `Which operating constraint ${index + 1} most affects the next review window?`,
    whyNow: `Current evidence ${index + 1} shows a measurable deviation that needs CEO review.`,
    businessDomain: index % 2 === 0 ? "sales" : "delivery",
    impactObjectRefs: [`operating-object:${index + 1}`],
    facts: [
      {
        statement: `Observed fact ${index + 1}`,
        evidenceRefs: [evidenceRef],
        freshness: "fresh",
      },
    ],
    inferences: [
      {
        statement: `Governed inference ${index + 1}`,
        evidenceRefs: [evidenceRef],
        freshness: "fresh",
      },
    ],
    unknowns: [`Unknown causal factor ${index + 1}`],
    conflicts: [],
    evidenceRefs: [evidenceRef],
    freshness: "fresh",
    confidence: "high",
    valueHypothesis: {
      description: `Reducing constraint ${index + 1} may improve the selected operating metric.`,
      quantifiedValue: null,
      currency: null,
      evidenceRefs: [],
      unknownReason:
        "A governed baseline has not yet established monetary value.",
    },
    scores: {
      businessValue: 80 - index,
      urgency: 70 - index,
      evidenceStrength: 90 - index,
      intervenability: 75 - index,
      measurability: 85 - index,
      riskAndCost: 20 + index,
    },
    validationMetrics: [
      {
        metricKey: `metric-${index + 1}`,
        description: `Synthetic operating metric ${index + 1}`,
        unit: "percent",
        direction: "increase",
        baselineWindowStart: "2026-07-01T00:00:00.000Z",
        baselineWindowEnd: "2026-07-22T00:00:00.000Z",
      },
    ],
    firstNarrowLoop: {
      objective: `Validate operating focus ${index + 1}`,
      observationRefs: [`observation-window:${index + 1}`],
      decisionBoundary: "CEO confirms any operating decision.",
      supervisionSignal: `supervision-signal:${index + 1}`,
      receiptRequirement: "Execution outcome must have an evidence receipt.",
    },
    requiredDataRefs: [],
    dependencyRefs: [],
    risks: [`Risk ${index + 1}`],
    inactionConsequence: `The observed deviation ${index + 1} may continue without review.`,
    ...overrides,
  };
}

export function syntheticOperatingQuestionGenerationInput(
  candidates: unknown = Array.from({ length: 10 }, (_, index) =>
    syntheticOperatingQuestionCandidate(index),
  ),
) {
  return {
    g0Context: syntheticOperatingQuestionG0Context(),
    generationKey: "generation:synthetic-caio:1",
    generatorRef: "generator:caio-operating-question",
    modelRef: "model:synthetic-local",
    candidates,
    generatedAt: SYNTHETIC_CAIO_QUESTION_NOW,
    auditRefs: ["audit:question-generation:1"],
    previousPortfolio: null,
  };
}
