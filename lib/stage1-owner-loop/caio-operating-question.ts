import { z } from "zod";

import { canonicalJson, sha256 } from "../expert-capability/hashing";
import {
  computeCaioInitializationAssessment,
  validateCaioInitializationAssessment,
  type CaioInitializationAssessment,
  type CaioInitializationAssessmentInput,
  type CaioInitializationException,
} from "./caio-initialization-gate";
import {
  validateCaioInitializationGateReceipt,
  type CaioInitializationGateReceipt,
} from "./caio-initialization-gate-receipt";
import {
  EVIDENCE_FRESHNESS_STATES,
  type EvidenceConflict,
  type EvidenceFreshnessState,
  type EvidenceStatement,
} from "./types";

export const CAIO_OPERATING_QUESTION_PORTFOLIO_SCHEMA_VERSION =
  "helm.caio.operating-question-portfolio.v1" as const;
export const CAIO_OPERATING_QUESTION_GENERATION_RECEIPT_SCHEMA_VERSION =
  "helm.caio.operating-question-generation-receipt.v1" as const;
export const CAIO_OPERATING_QUESTION_GENERATOR_REVISION =
  "caio-operating-question-generator.v1" as const;
export const CAIO_OPERATING_QUESTION_G0_CONTEXT_SCHEMA_VERSION =
  "helm.caio.operating-question-g0-context.v1" as const;

const operatingQuestionPolicyContent = {
  policyRef: "policy:caio-operating-question-v1" as const,
  requiredCandidateCount: 10,
  maximumSelectionCount: 3,
  scoreWeights: {
    businessValue: 25,
    urgency: 20,
    evidenceStrength: 20,
    intervenability: 15,
    measurability: 15,
    inverseRiskAndCost: 5,
  },
  authorityEffect: "none" as const,
};

export const CAIO_OPERATING_QUESTION_POLICY = {
  ...operatingQuestionPolicyContent,
  policyHash: sha256(canonicalJson(operatingQuestionPolicyContent)),
};

export type CaioOperatingQuestionScores = {
  businessValue: number;
  urgency: number;
  evidenceStrength: number;
  intervenability: number;
  measurability: number;
  riskAndCost: number;
};

export type CaioOperatingQuestionValueHypothesis = {
  description: string;
  quantifiedValue: number | null;
  currency: string | null;
  evidenceRefs: string[];
  unknownReason: string | null;
};

export type CaioOperatingQuestionValidationMetric = {
  metricKey: string;
  description: string;
  unit: string;
  direction: "increase" | "decrease" | "maintain";
  baselineWindowStart: string;
  baselineWindowEnd: string;
};

export type CaioOperatingQuestionNarrowLoop = {
  objective: string;
  observationRefs: string[];
  decisionBoundary: string;
  supervisionSignal: string;
  receiptRequirement: string;
};

export type CaioOperatingQuestionCandidateDraft = {
  questionId: string;
  title: string;
  question: string;
  whyNow: string;
  businessDomain: string;
  impactObjectRefs: string[];
  facts: EvidenceStatement[];
  inferences: EvidenceStatement[];
  unknowns: string[];
  conflicts: EvidenceConflict[];
  evidenceRefs: string[];
  freshness: EvidenceFreshnessState;
  confidence: "low" | "medium" | "high";
  valueHypothesis: CaioOperatingQuestionValueHypothesis;
  scores: CaioOperatingQuestionScores;
  validationMetrics: CaioOperatingQuestionValidationMetric[];
  firstNarrowLoop: CaioOperatingQuestionNarrowLoop;
  requiredDataRefs: string[];
  dependencyRefs: string[];
  risks: string[];
  inactionConsequence: string;
};

export type CaioOperatingQuestionCandidate =
  CaioOperatingQuestionCandidateDraft & {
    rank: number;
    compositeScore: number;
    contentHash: string;
  };

export type CaioOperatingQuestionG0Context = {
  schemaVersion: typeof CAIO_OPERATING_QUESTION_G0_CONTEXT_SCHEMA_VERSION;
  workspaceRef: string;
  gateReceiptRef: string;
  gateReceiptHash: string;
  gateSequence: number;
  assessmentRef: string;
  assessmentHash: string;
  assessmentBasisHash: string;
  evidenceRefs: string[];
  evidenceUniverseHash: string;
  authorityEffect: "none";
  contentHash: string;
};

export type CaioOperatingQuestionCurrentGateHead = {
  currentReceiptRef: string;
  currentReceiptHash: string;
  currentAssessmentRef: string;
  sequence: number;
};

export type CaioOperatingQuestionPortfolio = {
  schemaVersion: typeof CAIO_OPERATING_QUESTION_PORTFOLIO_SCHEMA_VERSION;
  portfolioId: string;
  workspaceRef: string;
  gateReceiptRef: string;
  gateReceiptHash: string;
  assessmentRef: string;
  assessmentHash: string;
  g0ContextHash: string;
  evidenceUniverseHash: string;
  generationKey: string;
  generationInputHash: string;
  generatorRevision: typeof CAIO_OPERATING_QUESTION_GENERATOR_REVISION;
  generatorRef: string;
  modelRef: string;
  policyRef: typeof CAIO_OPERATING_QUESTION_POLICY.policyRef;
  policyHash: string;
  previousPortfolioRef: string | null;
  previousPortfolioHash: string | null;
  sequence: number;
  candidates: CaioOperatingQuestionCandidate[];
  evidenceRefs: string[];
  generatedAt: string;
  auditRefs: string[];
  authorityEffect: "none";
  contentHash: string;
};

export type CaioOperatingQuestionGenerationStatus =
  "generated" | "insufficient_evidence";

export type CaioOperatingQuestionGenerationEvaluation = {
  status: CaioOperatingQuestionGenerationStatus;
  g0Context: CaioOperatingQuestionG0Context;
  workspaceRef: string;
  gateReceiptRef: string;
  gateReceiptHash: string;
  assessmentRef: string;
  assessmentHash: string;
  g0ContextHash: string;
  evidenceUniverseHash: string;
  generationKey: string;
  generationInputHash: string;
  gapCodes: string[];
  portfolio: CaioOperatingQuestionPortfolio | null;
};

export type CaioOperatingQuestionGenerationReceipt = {
  schemaVersion: typeof CAIO_OPERATING_QUESTION_GENERATION_RECEIPT_SCHEMA_VERSION;
  receiptId: string;
  workspaceRef: string;
  gateReceiptRef: string;
  gateReceiptHash: string;
  assessmentRef: string;
  assessmentHash: string;
  g0ContextHash: string;
  evidenceUniverseHash: string;
  generationKey: string;
  generationInputHash: string;
  status: CaioOperatingQuestionGenerationStatus;
  portfolioRef: string | null;
  portfolioHash: string | null;
  evidenceRefs: string[];
  gapCodes: string[];
  generatorRevision: typeof CAIO_OPERATING_QUESTION_GENERATOR_REVISION;
  policyRef: typeof CAIO_OPERATING_QUESTION_POLICY.policyRef;
  policyHash: string;
  previousReceiptRef: string | null;
  previousReceiptHash: string | null;
  sequence: number;
  recordedAt: string;
  authorityEffect: "none";
  contentHash: string;
};

export type CaioOperatingQuestionValidation = {
  valid: boolean;
  errors: string[];
};

const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/;
const CANONICAL_UTC_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const TEMPLATE_PATTERN =
  /(?:\b(?:todo|tbd|placeholder|example)\b|待补充|待填写|模板占位|\{\{[^}]+\}\}|<[^>]+>)/iu;

function isNonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && SHA256_PATTERN.test(value);
}

function isCanonicalUtcTimestamp(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !CANONICAL_UTC_TIMESTAMP_PATTERN.test(value)
  ) {
    return false;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function compareCodePoints(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort(
    compareCodePoints,
  );
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/gu, " ");
}

function normalizedKey(value: string): string {
  return normalizeText(value).toLocaleLowerCase("en-US");
}

function canonicalValuesMatch(left: unknown, right: unknown): boolean {
  return canonicalJson(left) === canonicalJson(right);
}

const canonicalUtcTimestampSchema = z
  .string()
  .refine(isCanonicalUtcTimestamp, "canonical UTC timestamp required");
const evidenceStatementSchema = z
  .object({
    statement: z.string(),
    evidenceRefs: z.array(z.string()),
    freshness: z.enum(EVIDENCE_FRESHNESS_STATES),
  })
  .strict();
const evidenceConflictSchema = z
  .object({
    description: z.string(),
    evidenceRefs: z.array(z.string()),
  })
  .strict();
const operatingQuestionScoresSchema = z
  .object({
    businessValue: z.number(),
    urgency: z.number(),
    evidenceStrength: z.number(),
    intervenability: z.number(),
    measurability: z.number(),
    riskAndCost: z.number(),
  })
  .strict();
const operatingQuestionValueHypothesisSchema = z
  .object({
    description: z.string(),
    quantifiedValue: z.number().finite().nullable(),
    currency: z.string().nullable(),
    evidenceRefs: z.array(z.string()),
    unknownReason: z.string().nullable(),
  })
  .strict();
const operatingQuestionValidationMetricSchema = z
  .object({
    metricKey: z.string(),
    description: z.string(),
    unit: z.string(),
    direction: z.enum(["increase", "decrease", "maintain"]),
    baselineWindowStart: canonicalUtcTimestampSchema,
    baselineWindowEnd: canonicalUtcTimestampSchema,
  })
  .strict();
const operatingQuestionNarrowLoopSchema = z
  .object({
    objective: z.string(),
    observationRefs: z.array(z.string()),
    decisionBoundary: z.string(),
    supervisionSignal: z.string(),
    receiptRequirement: z.string(),
  })
  .strict();
const operatingQuestionCandidateDraftSchema: z.ZodType<CaioOperatingQuestionCandidateDraft> =
  z
    .object({
      questionId: z.string(),
      title: z.string(),
      question: z.string(),
      whyNow: z.string(),
      businessDomain: z.string(),
      impactObjectRefs: z.array(z.string()),
      facts: z.array(evidenceStatementSchema),
      inferences: z.array(evidenceStatementSchema),
      unknowns: z.array(z.string()),
      conflicts: z.array(evidenceConflictSchema),
      evidenceRefs: z.array(z.string()),
      freshness: z.enum(EVIDENCE_FRESHNESS_STATES),
      confidence: z.enum(["low", "medium", "high"]),
      valueHypothesis: operatingQuestionValueHypothesisSchema,
      scores: operatingQuestionScoresSchema,
      validationMetrics: z.array(operatingQuestionValidationMetricSchema),
      firstNarrowLoop: operatingQuestionNarrowLoopSchema,
      requiredDataRefs: z.array(z.string()),
      dependencyRefs: z.array(z.string()),
      risks: z.array(z.string()),
      inactionConsequence: z.string(),
    })
    .strict();

function hashUnknown(value: unknown): string {
  try {
    const canonical = canonicalJson(value);
    return sha256(
      typeof canonical === "string"
        ? canonical
        : canonicalJson({ unsupportedValueType: typeof value }),
    );
  } catch {
    return sha256(canonicalJson({ unhashableValueType: typeof value }));
  }
}

function exceptionRefs(
  exception: CaioInitializationException | null,
): string[] {
  if (!exception) return [];
  return [
    exception.exceptionRef,
    exception.riskOwnerRef,
    ...exception.evidenceRefs,
  ];
}

function initializationEvidenceUniverse(input: {
  assessmentInput: CaioInitializationAssessmentInput;
  assessment: CaioInitializationAssessment;
  gateReceipt: CaioInitializationGateReceipt;
}): string[] {
  const { assessmentInput, assessment, gateReceipt } = input;
  return uniqueSorted([
    ...assessmentInput.assets.flatMap((asset) => [
      asset.assetRef,
      asset.authorizationReceiptRef ?? "",
      asset.connectionReceiptRef ?? "",
      asset.initializationReceiptRef ?? "",
      ...asset.observationRunRefs,
      ...asset.schemaMappingRefs,
      ...asset.companyMemoryBindings.map((binding) => binding.ref),
      asset.temporalContextSnapshotRef ?? "",
      ...exceptionRefs(asset.exception),
    ]),
    ...assessmentInput.sources.flatMap((source) => [
      source.sourceRef,
      source.assetRef,
      source.latestRunRef ?? "",
      ...exceptionRefs(source.exception),
    ]),
    ...assessmentInput.evidenceTraces.flatMap((trace) => [
      trace.evidenceRef,
      trace.sourceRef,
      trace.assetRef,
      trace.observationRunRef,
      trace.authorizationReceiptRef,
      trace.connectionReceiptRef,
      trace.initializationReceiptRef,
    ]),
    assessmentInput.knowledge.memoryRebuildReceiptRef ?? "",
    assessmentInput.knowledge.temporalContextArtifactRef ?? "",
    ...assessment.checks.flatMap((check) => check.evidenceRefs),
    ...assessment.exceptionRefs,
    ...gateReceipt.evidenceRefs,
    gateReceipt.inventoryConfirmationRef ?? "",
    gateReceipt.customerAcceptanceRef ?? "",
    ...gateReceipt.acceptedExceptionRefs,
  ]);
}

export function createCaioOperatingQuestionG0Context(input: {
  assessmentInput: CaioInitializationAssessmentInput;
  assessment: CaioInitializationAssessment;
  gateReceipt: CaioInitializationGateReceipt;
  currentHead: CaioOperatingQuestionCurrentGateHead;
}): CaioOperatingQuestionG0Context {
  const computedAssessment = computeCaioInitializationAssessment(
    input.assessmentInput,
  );
  const assessmentValidation = validateCaioInitializationAssessment(
    input.assessment,
  );
  const receiptValidation = validateCaioInitializationGateReceipt(
    input.gateReceipt,
  );
  if (
    !assessmentValidation.valid ||
    computedAssessment.contentHash !== input.assessment.contentHash ||
    computedAssessment.basisHash !== input.assessment.basisHash
  ) {
    throw new Error("caio_operating_question_g0_assessment_invalid");
  }
  if (!receiptValidation.valid) {
    throw new Error("caio_operating_question_g0_receipt_invalid");
  }
  if (
    input.gateReceipt.action !== "accept" ||
    input.gateReceipt.resultingStatus !== "accepted" ||
    input.assessment.decision !== "ready_for_owner_acceptance"
  ) {
    throw new Error("caio_operating_question_g0_not_accepted");
  }
  if (
    input.gateReceipt.workspaceRef !== input.assessment.workspaceRef ||
    input.gateReceipt.assessmentRef !== input.assessment.assessmentId ||
    input.gateReceipt.assessmentHash !== input.assessment.contentHash ||
    input.gateReceipt.basisHash !== input.assessment.basisHash ||
    input.currentHead.currentReceiptRef !== input.gateReceipt.receiptId ||
    input.currentHead.currentReceiptHash !== input.gateReceipt.contentHash ||
    input.currentHead.currentAssessmentRef !== input.assessment.assessmentId ||
    input.currentHead.sequence !== input.gateReceipt.sequence
  ) {
    throw new Error("caio_operating_question_g0_head_binding_invalid");
  }
  if (
    !isCanonicalUtcTimestamp(input.assessment.evaluatedAt) ||
    !isCanonicalUtcTimestamp(input.gateReceipt.recordedAt)
  ) {
    throw new Error("caio_operating_question_g0_timestamp_invalid");
  }
  const evidenceRefs = initializationEvidenceUniverse(input);
  if (evidenceRefs.length === 0) {
    throw new Error("caio_operating_question_g0_evidence_empty");
  }
  const content = {
    schemaVersion: CAIO_OPERATING_QUESTION_G0_CONTEXT_SCHEMA_VERSION,
    workspaceRef: input.assessment.workspaceRef,
    gateReceiptRef: input.gateReceipt.receiptId,
    gateReceiptHash: input.gateReceipt.contentHash,
    gateSequence: input.gateReceipt.sequence,
    assessmentRef: input.assessment.assessmentId,
    assessmentHash: input.assessment.contentHash,
    assessmentBasisHash: input.assessment.basisHash,
    evidenceRefs,
    evidenceUniverseHash: sha256(canonicalJson(evidenceRefs)),
    authorityEffect: "none" as const,
  };
  return {
    ...content,
    contentHash: sha256(canonicalJson(content)),
  };
}

export function validateCaioOperatingQuestionG0Context(
  context: CaioOperatingQuestionG0Context,
): CaioOperatingQuestionValidation {
  const errors: string[] = [];
  if (
    context.schemaVersion !==
      CAIO_OPERATING_QUESTION_G0_CONTEXT_SCHEMA_VERSION ||
    context.authorityEffect !== "none"
  ) {
    errors.push("g0_context_version_or_boundary_invalid");
  }
  if (
    !isNonEmpty(context.workspaceRef) ||
    !isNonEmpty(context.gateReceiptRef) ||
    !isSha256(context.gateReceiptHash) ||
    !Number.isInteger(context.gateSequence) ||
    context.gateSequence < 1 ||
    !isNonEmpty(context.assessmentRef) ||
    !isSha256(context.assessmentHash) ||
    !isSha256(context.assessmentBasisHash) ||
    !isSha256(context.evidenceUniverseHash)
  ) {
    errors.push("g0_context_required_field_invalid");
  }
  const expectedEvidenceRefs = uniqueSorted(context.evidenceRefs);
  if (
    expectedEvidenceRefs.length === 0 ||
    !canonicalValuesMatch(context.evidenceRefs, expectedEvidenceRefs) ||
    context.evidenceUniverseHash !== sha256(canonicalJson(expectedEvidenceRefs))
  ) {
    errors.push("g0_context_evidence_invalid");
  }
  const { contentHash, ...content } = context;
  if (
    !isSha256(contentHash) ||
    contentHash !== sha256(canonicalJson(content))
  ) {
    errors.push("g0_context_content_hash_invalid");
  }
  return { valid: errors.length === 0, errors: uniqueSorted(errors) };
}

function normalizeStatement(statement: EvidenceStatement): EvidenceStatement {
  return {
    statement: normalizeText(statement.statement),
    evidenceRefs: uniqueSorted(statement.evidenceRefs),
    freshness: statement.freshness,
  };
}

function normalizeConflict(conflict: EvidenceConflict): EvidenceConflict {
  return {
    description: normalizeText(conflict.description),
    evidenceRefs: uniqueSorted(conflict.evidenceRefs),
  };
}

function scoreIsValid(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 100;
}

function compositeScore(scores: CaioOperatingQuestionScores): number {
  const weights = CAIO_OPERATING_QUESTION_POLICY.scoreWeights;
  const weighted =
    scores.businessValue * weights.businessValue +
    scores.urgency * weights.urgency +
    scores.evidenceStrength * weights.evidenceStrength +
    scores.intervenability * weights.intervenability +
    scores.measurability * weights.measurability +
    (100 - scores.riskAndCost) * weights.inverseRiskAndCost;
  return Math.round(weighted) / 100;
}

function candidateEvidenceRefs(
  candidate: CaioOperatingQuestionCandidateDraft,
): string[] {
  return uniqueSorted([
    ...candidate.evidenceRefs,
    ...candidate.facts.flatMap((statement) => statement.evidenceRefs),
    ...candidate.inferences.flatMap((statement) => statement.evidenceRefs),
    ...candidate.conflicts.flatMap((conflict) => conflict.evidenceRefs),
    ...candidate.valueHypothesis.evidenceRefs,
  ]);
}

function normalizeCandidate(
  candidate: CaioOperatingQuestionCandidateDraft,
): CaioOperatingQuestionCandidateDraft {
  return {
    questionId: candidate.questionId.trim(),
    title: normalizeText(candidate.title),
    question: normalizeText(candidate.question),
    whyNow: normalizeText(candidate.whyNow),
    businessDomain: normalizeText(candidate.businessDomain),
    impactObjectRefs: uniqueSorted(candidate.impactObjectRefs),
    facts: candidate.facts.map(normalizeStatement),
    inferences: candidate.inferences.map(normalizeStatement),
    unknowns: uniqueSorted(candidate.unknowns),
    conflicts: candidate.conflicts.map(normalizeConflict),
    evidenceRefs: uniqueSorted(candidate.evidenceRefs),
    freshness: candidate.freshness,
    confidence: candidate.confidence,
    valueHypothesis: {
      description: normalizeText(candidate.valueHypothesis.description),
      quantifiedValue: candidate.valueHypothesis.quantifiedValue,
      currency: candidate.valueHypothesis.currency?.trim() || null,
      evidenceRefs: uniqueSorted(candidate.valueHypothesis.evidenceRefs),
      unknownReason: candidate.valueHypothesis.unknownReason?.trim() || null,
    },
    scores: { ...candidate.scores },
    validationMetrics: candidate.validationMetrics
      .map((metric) => ({
        metricKey: metric.metricKey.trim(),
        description: normalizeText(metric.description),
        unit: normalizeText(metric.unit),
        direction: metric.direction,
        baselineWindowStart: metric.baselineWindowStart,
        baselineWindowEnd: metric.baselineWindowEnd,
      }))
      .sort((left, right) =>
        compareCodePoints(left.metricKey, right.metricKey),
      ),
    firstNarrowLoop: {
      objective: normalizeText(candidate.firstNarrowLoop.objective),
      observationRefs: uniqueSorted(candidate.firstNarrowLoop.observationRefs),
      decisionBoundary: normalizeText(
        candidate.firstNarrowLoop.decisionBoundary,
      ),
      supervisionSignal: normalizeText(
        candidate.firstNarrowLoop.supervisionSignal,
      ),
      receiptRequirement: normalizeText(
        candidate.firstNarrowLoop.receiptRequirement,
      ),
    },
    requiredDataRefs: uniqueSorted(candidate.requiredDataRefs),
    dependencyRefs: uniqueSorted(candidate.dependencyRefs),
    risks: uniqueSorted(candidate.risks),
    inactionConsequence: normalizeText(candidate.inactionConsequence),
  };
}

function candidateDraftFromFinal(
  candidate: CaioOperatingQuestionCandidate,
): CaioOperatingQuestionCandidateDraft {
  const {
    rank: _rank,
    compositeScore: _compositeScore,
    contentHash: _contentHash,
    ...draft
  } = candidate;
  return draft;
}

function sortCandidatesForGenerationHash(
  candidates: readonly CaioOperatingQuestionCandidateDraft[],
): CaioOperatingQuestionCandidateDraft[] {
  return candidates
    .map(normalizeCandidate)
    .sort(
      (left, right) =>
        compareCodePoints(
          normalizedKey(left.questionId),
          normalizedKey(right.questionId),
        ) || compareCodePoints(canonicalJson(left), canonicalJson(right)),
    );
}

function validateCandidate(
  candidate: CaioOperatingQuestionCandidateDraft,
  allowedEvidenceRefs: ReadonlySet<string>,
  index: number,
): string[] {
  const errors: string[] = [];
  const prefix = `candidate_${index + 1}`;
  const requiredText = [
    candidate.questionId,
    candidate.title,
    candidate.question,
    candidate.whyNow,
    candidate.businessDomain,
    candidate.valueHypothesis.description,
    candidate.firstNarrowLoop.objective,
    candidate.firstNarrowLoop.decisionBoundary,
    candidate.firstNarrowLoop.supervisionSignal,
    candidate.firstNarrowLoop.receiptRequirement,
    candidate.inactionConsequence,
  ];
  const supportingText = [
    ...candidate.facts.map((statement) => statement.statement),
    ...candidate.inferences.map((statement) => statement.statement),
    ...candidate.unknowns,
    ...candidate.conflicts.map((conflict) => conflict.description),
    ...candidate.validationMetrics.flatMap((metric) => [
      metric.description,
      metric.unit,
    ]),
    ...candidate.risks,
    candidate.valueHypothesis.unknownReason ?? "",
  ];
  if (requiredText.some((value) => !isNonEmpty(value))) {
    errors.push(`${prefix}:required_text_missing`);
  }
  if (
    [...requiredText, ...supportingText].some(
      (value) => isNonEmpty(value) && TEMPLATE_PATTERN.test(value),
    )
  ) {
    errors.push(`${prefix}:template_placeholder_present`);
  }
  if (candidate.impactObjectRefs.length === 0) {
    errors.push(`${prefix}:impact_object_required`);
  }
  if (candidate.facts.length === 0) {
    errors.push(`${prefix}:fact_required`);
  }
  if (candidate.inferences.length === 0) {
    errors.push(`${prefix}:inference_required`);
  }
  if (candidate.unknowns.length === 0) {
    errors.push(`${prefix}:unknown_required`);
  }
  if (candidate.evidenceRefs.length === 0) {
    errors.push(`${prefix}:evidence_required`);
  }
  for (const statement of [...candidate.facts, ...candidate.inferences]) {
    if (
      !isNonEmpty(statement.statement) ||
      statement.evidenceRefs.length === 0 ||
      !EVIDENCE_FRESHNESS_STATES.includes(statement.freshness)
    ) {
      errors.push(`${prefix}:evidence_statement_invalid`);
    }
  }
  for (const conflict of candidate.conflicts) {
    if (
      !isNonEmpty(conflict.description) ||
      uniqueSorted(conflict.evidenceRefs).length < 2
    ) {
      errors.push(`${prefix}:conflict_invalid`);
    }
  }
  if (!EVIDENCE_FRESHNESS_STATES.includes(candidate.freshness)) {
    errors.push(`${prefix}:freshness_invalid`);
  }
  if (!["low", "medium", "high"].includes(candidate.confidence)) {
    errors.push(`${prefix}:confidence_invalid`);
  }
  if (
    candidate.valueHypothesis.quantifiedValue === null &&
    !isNonEmpty(candidate.valueHypothesis.unknownReason)
  ) {
    errors.push(`${prefix}:value_unknown_reason_required`);
  }
  if (
    candidate.valueHypothesis.quantifiedValue !== null &&
    (!Number.isFinite(candidate.valueHypothesis.quantifiedValue) ||
      candidate.valueHypothesis.quantifiedValue < 0 ||
      !isNonEmpty(candidate.valueHypothesis.currency) ||
      candidate.valueHypothesis.evidenceRefs.length === 0)
  ) {
    errors.push(`${prefix}:quantified_value_evidence_required`);
  }
  if (!Object.values(candidate.scores).every(scoreIsValid)) {
    errors.push(`${prefix}:score_invalid`);
  }
  if (candidate.validationMetrics.length === 0) {
    errors.push(`${prefix}:validation_metric_required`);
  }
  for (const metric of candidate.validationMetrics) {
    if (
      !isNonEmpty(metric.metricKey) ||
      !isNonEmpty(metric.description) ||
      !isNonEmpty(metric.unit) ||
      !["increase", "decrease", "maintain"].includes(metric.direction) ||
      !isCanonicalUtcTimestamp(metric.baselineWindowStart) ||
      !isCanonicalUtcTimestamp(metric.baselineWindowEnd) ||
      Date.parse(metric.baselineWindowStart) >=
        Date.parse(metric.baselineWindowEnd)
    ) {
      errors.push(`${prefix}:validation_metric_invalid`);
    }
  }
  if (candidate.firstNarrowLoop.observationRefs.length === 0) {
    errors.push(`${prefix}:narrow_loop_observation_required`);
  }
  const declaredEvidence = new Set(candidate.evidenceRefs);
  for (const ref of candidateEvidenceRefs(candidate)) {
    if (!declaredEvidence.has(ref)) {
      errors.push(`${prefix}:evidence_not_declared`);
    }
  }
  for (const ref of candidate.evidenceRefs) {
    if (!allowedEvidenceRefs.has(ref)) {
      errors.push(`${prefix}:evidence_outside_g0_basis`);
    }
  }
  return uniqueSorted(errors);
}

function finalizeCandidate(
  candidate: CaioOperatingQuestionCandidateDraft,
  rank: number,
): CaioOperatingQuestionCandidate {
  const content = {
    ...candidate,
    rank,
    compositeScore: compositeScore(candidate.scores),
  };
  return {
    ...content,
    contentHash: sha256(canonicalJson(content)),
  };
}

function generationInputHash(input: {
  g0Context: CaioOperatingQuestionG0Context;
  generationKey: string;
  generatorRef: string;
  modelRef: string;
  candidatePayloadHash: string;
  previousPortfolioRef: string | null;
  previousPortfolioHash: string | null;
  previousPortfolioSequence: number;
}): string {
  return sha256(
    canonicalJson({
      g0ContextHash: input.g0Context.contentHash,
      evidenceUniverseHash: input.g0Context.evidenceUniverseHash,
      generationKey: input.generationKey.trim(),
      generatorRevision: CAIO_OPERATING_QUESTION_GENERATOR_REVISION,
      generatorRef: input.generatorRef.trim(),
      modelRef: input.modelRef.trim(),
      policyRef: CAIO_OPERATING_QUESTION_POLICY.policyRef,
      policyHash: CAIO_OPERATING_QUESTION_POLICY.policyHash,
      candidatePayloadHash: input.candidatePayloadHash,
      previousPortfolioRef: input.previousPortfolioRef,
      previousPortfolioHash: input.previousPortfolioHash,
      previousPortfolioSequence: input.previousPortfolioSequence,
    }),
  );
}

export function evaluateCaioOperatingQuestionGeneration(input: {
  g0Context: CaioOperatingQuestionG0Context;
  generationKey: string;
  generatorRef: string;
  modelRef: string;
  candidates: unknown;
  generatedAt: string;
  auditRefs: readonly string[];
  previousPortfolio: CaioOperatingQuestionPortfolio | null;
}): CaioOperatingQuestionGenerationEvaluation {
  const parsedCandidates = z
    .array(operatingQuestionCandidateDraftSchema)
    .safeParse(input.candidates);
  const normalizedCandidates = parsedCandidates.success
    ? parsedCandidates.data.map(normalizeCandidate)
    : [];
  const candidatePayloadHash = parsedCandidates.success
    ? sha256(
        canonicalJson(sortCandidatesForGenerationHash(normalizedCandidates)),
      )
    : hashUnknown(input.candidates);
  const previousValidation = input.previousPortfolio
    ? validateCaioOperatingQuestionPortfolio(input.previousPortfolio)
    : null;
  const previousPortfolioValid =
    input.previousPortfolio === null ||
    Boolean(
      previousValidation?.valid &&
      input.previousPortfolio.workspaceRef === input.g0Context.workspaceRef &&
      input.previousPortfolio.gateReceiptRef ===
        input.g0Context.gateReceiptRef &&
      input.previousPortfolio.gateReceiptHash ===
        input.g0Context.gateReceiptHash &&
      input.previousPortfolio.assessmentRef ===
        input.g0Context.assessmentRef &&
      input.previousPortfolio.assessmentHash ===
        input.g0Context.assessmentHash &&
      input.previousPortfolio.g0ContextHash === input.g0Context.contentHash &&
      input.previousPortfolio.evidenceUniverseHash ===
        input.g0Context.evidenceUniverseHash &&
      isCanonicalUtcTimestamp(input.previousPortfolio.generatedAt) &&
      isCanonicalUtcTimestamp(input.generatedAt) &&
      Date.parse(input.previousPortfolio.generatedAt) <=
        Date.parse(input.generatedAt),
    );
  const inputHash = generationInputHash({
    g0Context: input.g0Context,
    generationKey: input.generationKey,
    generatorRef: input.generatorRef,
    modelRef: input.modelRef,
    candidatePayloadHash,
    previousPortfolioRef: input.previousPortfolio?.portfolioId ?? null,
    previousPortfolioHash: input.previousPortfolio?.contentHash ?? null,
    previousPortfolioSequence: input.previousPortfolio?.sequence ?? 0,
  });
  const gaps: string[] = [];
  const contextValidation = validateCaioOperatingQuestionG0Context(
    input.g0Context,
  );
  if (
    !contextValidation.valid ||
    !isNonEmpty(input.generationKey) ||
    !isNonEmpty(input.generatorRef) ||
    !isNonEmpty(input.modelRef) ||
    !isCanonicalUtcTimestamp(input.generatedAt)
  ) {
    gaps.push("generation_context_invalid");
  }
  if (!parsedCandidates.success) {
    gaps.push("candidate_payload_invalid");
  }
  if (
    (Array.isArray(input.candidates) ? input.candidates.length : 0) !==
    CAIO_OPERATING_QUESTION_POLICY.requiredCandidateCount
  ) {
    gaps.push("candidate_count_not_ten");
  }
  if (input.g0Context.evidenceRefs.length === 0) {
    gaps.push("g0_evidence_universe_empty");
  }
  if (uniqueSorted(input.auditRefs).length === 0) {
    gaps.push("audit_ref_required");
  }
  if (!previousPortfolioValid) {
    gaps.push("previous_portfolio_invalid");
  }
  const ids = normalizedCandidates.map((candidate) =>
    normalizedKey(candidate.questionId),
  );
  const titles = normalizedCandidates.map((candidate) =>
    normalizedKey(candidate.title),
  );
  const questions = normalizedCandidates.map((candidate) =>
    normalizedKey(candidate.question),
  );
  if (new Set(ids).size !== ids.length) {
    gaps.push("candidate_id_not_unique");
  }
  if (new Set(titles).size !== titles.length) {
    gaps.push("candidate_title_not_unique");
  }
  if (new Set(questions).size !== questions.length) {
    gaps.push("candidate_question_not_unique");
  }
  const allowedEvidence = new Set(input.g0Context.evidenceRefs);
  normalizedCandidates.forEach((candidate, index) => {
    gaps.push(...validateCandidate(candidate, allowedEvidence, index));
  });
  const evaluationContext = {
    g0Context: input.g0Context,
    workspaceRef: input.g0Context.workspaceRef,
    gateReceiptRef: input.g0Context.gateReceiptRef,
    gateReceiptHash: input.g0Context.gateReceiptHash,
    assessmentRef: input.g0Context.assessmentRef,
    assessmentHash: input.g0Context.assessmentHash,
    g0ContextHash: input.g0Context.contentHash,
    evidenceUniverseHash: input.g0Context.evidenceUniverseHash,
    generationKey: input.generationKey.trim(),
    generationInputHash: inputHash,
  };
  const gapCodes = uniqueSorted(gaps);
  if (gapCodes.length > 0) {
    return {
      status: "insufficient_evidence",
      ...evaluationContext,
      gapCodes,
      portfolio: null,
    };
  }

  const ranked = [...normalizedCandidates]
    .sort(
      (left, right) =>
        compositeScore(right.scores) - compositeScore(left.scores) ||
        compareCodePoints(left.questionId, right.questionId),
    )
    .map((candidate, index) => finalizeCandidate(candidate, index + 1));
  const content = {
    schemaVersion: CAIO_OPERATING_QUESTION_PORTFOLIO_SCHEMA_VERSION,
    workspaceRef: input.g0Context.workspaceRef,
    gateReceiptRef: input.g0Context.gateReceiptRef,
    gateReceiptHash: input.g0Context.gateReceiptHash,
    assessmentRef: input.g0Context.assessmentRef,
    assessmentHash: input.g0Context.assessmentHash,
    g0ContextHash: input.g0Context.contentHash,
    evidenceUniverseHash: input.g0Context.evidenceUniverseHash,
    generationKey: input.generationKey.trim(),
    generationInputHash: inputHash,
    generatorRevision: CAIO_OPERATING_QUESTION_GENERATOR_REVISION,
    generatorRef: input.generatorRef.trim(),
    modelRef: input.modelRef.trim(),
    policyRef: CAIO_OPERATING_QUESTION_POLICY.policyRef,
    policyHash: CAIO_OPERATING_QUESTION_POLICY.policyHash,
    previousPortfolioRef: input.previousPortfolio?.portfolioId ?? null,
    previousPortfolioHash: input.previousPortfolio?.contentHash ?? null,
    sequence: (input.previousPortfolio?.sequence ?? 0) + 1,
    candidates: ranked,
    evidenceRefs: uniqueSorted(
      ranked.flatMap((candidate) => candidate.evidenceRefs),
    ),
    generatedAt: input.generatedAt,
    auditRefs: uniqueSorted(input.auditRefs),
    authorityEffect: "none" as const,
  };
  const basisHash = sha256(canonicalJson(content));
  const portfolio = {
    ...content,
    portfolioId: `caio-question-portfolio:${basisHash.slice(7, 31)}`,
  };
  return {
    status: "generated",
    ...evaluationContext,
    gapCodes: [],
    portfolio: {
      ...portfolio,
      contentHash: sha256(canonicalJson(portfolio)),
    },
  };
}

export function createCaioOperatingQuestionGenerationReceipt(input: {
  evaluation: CaioOperatingQuestionGenerationEvaluation;
  previousReceipt: CaioOperatingQuestionGenerationReceipt | null;
  evidenceRefs: readonly string[];
  recordedAt: string;
}): CaioOperatingQuestionGenerationReceipt {
  const contextValidation = validateCaioOperatingQuestionG0Context(
    input.evaluation.g0Context,
  );
  if (
    !contextValidation.valid ||
    !isCanonicalUtcTimestamp(input.recordedAt) ||
    !["generated", "insufficient_evidence"].includes(input.evaluation.status)
  ) {
    throw new Error("caio_question_generation_receipt_input_invalid");
  }
  if (
    input.evaluation.workspaceRef !== input.evaluation.g0Context.workspaceRef ||
    input.evaluation.gateReceiptRef !==
      input.evaluation.g0Context.gateReceiptRef ||
    input.evaluation.gateReceiptHash !==
      input.evaluation.g0Context.gateReceiptHash ||
    input.evaluation.assessmentRef !==
      input.evaluation.g0Context.assessmentRef ||
    input.evaluation.assessmentHash !==
      input.evaluation.g0Context.assessmentHash ||
    input.evaluation.g0ContextHash !== input.evaluation.g0Context.contentHash ||
    input.evaluation.evidenceUniverseHash !==
      input.evaluation.g0Context.evidenceUniverseHash ||
    !isNonEmpty(input.evaluation.generationKey)
  ) {
    throw new Error("caio_question_generation_receipt_binding_invalid");
  }
  if (input.evaluation.status === "generated" && !input.evaluation.portfolio) {
    throw new Error("caio_question_generated_portfolio_required");
  }
  if (
    input.evaluation.status === "generated" &&
    input.evaluation.portfolio !== null &&
    (!validateCaioOperatingQuestionPortfolioAgainstG0(
      input.evaluation.portfolio,
      input.evaluation.g0Context,
    ).valid ||
      input.evaluation.portfolio.workspaceRef !==
        input.evaluation.workspaceRef ||
      input.evaluation.portfolio.gateReceiptRef !==
        input.evaluation.gateReceiptRef ||
      input.evaluation.portfolio.gateReceiptHash !==
        input.evaluation.gateReceiptHash ||
      input.evaluation.portfolio.generationKey !==
        input.evaluation.generationKey ||
      input.evaluation.portfolio.generationInputHash !==
        input.evaluation.generationInputHash)
  ) {
    throw new Error("caio_question_generation_receipt_binding_invalid");
  }
  if (
    input.evaluation.status === "insufficient_evidence" &&
    (input.evaluation.portfolio ||
      uniqueSorted(input.evaluation.gapCodes).length === 0)
  ) {
    throw new Error("caio_question_insufficient_evidence_gap_required");
  }
  if (
    input.evaluation.status === "generated" &&
    uniqueSorted(input.evaluation.gapCodes).length > 0
  ) {
    throw new Error("caio_question_generated_gap_not_allowed");
  }
  const evidenceRefs = uniqueSorted(input.evidenceRefs);
  const allowedEvidenceRefs = new Set(input.evaluation.g0Context.evidenceRefs);
  if (
    !isSha256(input.evaluation.generationInputHash) ||
    evidenceRefs.length === 0 ||
    evidenceRefs.some((ref) => !allowedEvidenceRefs.has(ref)) ||
    (input.evaluation.portfolio !== null &&
      input.evaluation.portfolio.evidenceRefs.some(
        (ref) => !evidenceRefs.includes(ref),
      ))
  ) {
    throw new Error("caio_question_generation_receipt_evidence_invalid");
  }
  if (
    input.previousReceipt !== null &&
    (!validateCaioOperatingQuestionGenerationReceipt(input.previousReceipt)
      .valid ||
      input.previousReceipt.workspaceRef !== input.evaluation.workspaceRef ||
      input.previousReceipt.gateReceiptRef !==
        input.evaluation.gateReceiptRef ||
      input.previousReceipt.gateReceiptHash !==
        input.evaluation.gateReceiptHash ||
      input.previousReceipt.assessmentRef !== input.evaluation.assessmentRef ||
      input.previousReceipt.assessmentHash !==
        input.evaluation.assessmentHash ||
      input.previousReceipt.g0ContextHash !== input.evaluation.g0ContextHash ||
      Date.parse(input.previousReceipt.recordedAt) >
        Date.parse(input.recordedAt))
  ) {
    throw new Error("caio_question_generation_previous_receipt_invalid");
  }
  const content = {
    schemaVersion: CAIO_OPERATING_QUESTION_GENERATION_RECEIPT_SCHEMA_VERSION,
    workspaceRef: input.evaluation.workspaceRef,
    gateReceiptRef: input.evaluation.gateReceiptRef,
    gateReceiptHash: input.evaluation.gateReceiptHash,
    assessmentRef: input.evaluation.assessmentRef,
    assessmentHash: input.evaluation.assessmentHash,
    g0ContextHash: input.evaluation.g0ContextHash,
    evidenceUniverseHash: input.evaluation.evidenceUniverseHash,
    generationKey: input.evaluation.generationKey,
    generationInputHash: input.evaluation.generationInputHash,
    status: input.evaluation.status,
    portfolioRef: input.evaluation.portfolio?.portfolioId ?? null,
    portfolioHash: input.evaluation.portfolio?.contentHash ?? null,
    evidenceRefs,
    gapCodes: uniqueSorted(input.evaluation.gapCodes),
    generatorRevision: CAIO_OPERATING_QUESTION_GENERATOR_REVISION,
    policyRef: CAIO_OPERATING_QUESTION_POLICY.policyRef,
    policyHash: CAIO_OPERATING_QUESTION_POLICY.policyHash,
    previousReceiptRef: input.previousReceipt?.receiptId ?? null,
    previousReceiptHash: input.previousReceipt?.contentHash ?? null,
    sequence: (input.previousReceipt?.sequence ?? 0) + 1,
    recordedAt: input.recordedAt,
    authorityEffect: "none" as const,
  };
  const basisHash = sha256(canonicalJson(content));
  const receipt = {
    ...content,
    receiptId: `caio-question-generation:${basisHash.slice(7, 31)}`,
  };
  const result = {
    ...receipt,
    contentHash: sha256(canonicalJson(receipt)),
  };
  const validation = validateCaioOperatingQuestionGenerationReceipt(result);
  if (!validation.valid) {
    throw new Error(
      `caio_question_generation_receipt_invalid:${validation.errors.join(",")}`,
    );
  }
  return result;
}

export function validateCaioOperatingQuestionPortfolio(
  portfolio: CaioOperatingQuestionPortfolio,
): CaioOperatingQuestionValidation {
  const errors: string[] = [];
  if (
    portfolio.schemaVersion !==
      CAIO_OPERATING_QUESTION_PORTFOLIO_SCHEMA_VERSION ||
    portfolio.generatorRevision !==
      CAIO_OPERATING_QUESTION_GENERATOR_REVISION ||
    portfolio.policyRef !== CAIO_OPERATING_QUESTION_POLICY.policyRef ||
    portfolio.policyHash !== CAIO_OPERATING_QUESTION_POLICY.policyHash
  ) {
    errors.push("portfolio_version_or_policy_invalid");
  }
  if (
    !isNonEmpty(portfolio.portfolioId) ||
    !isNonEmpty(portfolio.workspaceRef) ||
    !isNonEmpty(portfolio.gateReceiptRef) ||
    !isSha256(portfolio.gateReceiptHash) ||
    !isNonEmpty(portfolio.assessmentRef) ||
    !isSha256(portfolio.assessmentHash) ||
    !isSha256(portfolio.g0ContextHash) ||
    !isSha256(portfolio.evidenceUniverseHash) ||
    !isNonEmpty(portfolio.generationKey) ||
    !isSha256(portfolio.generationInputHash) ||
    !isNonEmpty(portfolio.generatorRef) ||
    !isNonEmpty(portfolio.modelRef) ||
    !isCanonicalUtcTimestamp(portfolio.generatedAt)
  ) {
    errors.push("portfolio_required_field_invalid");
  }
  if (
    !Number.isInteger(portfolio.sequence) ||
    portfolio.sequence < 1 ||
    (portfolio.sequence === 1 &&
      (portfolio.previousPortfolioRef !== null ||
        portfolio.previousPortfolioHash !== null)) ||
    (portfolio.sequence > 1 &&
      (!isNonEmpty(portfolio.previousPortfolioRef) ||
        !isSha256(portfolio.previousPortfolioHash)))
  ) {
    errors.push("portfolio_chain_invalid");
  }
  if (
    portfolio.candidates.length !==
    CAIO_OPERATING_QUESTION_POLICY.requiredCandidateCount
  ) {
    errors.push("portfolio_candidate_count_invalid");
  }
  if (
    portfolio.authorityEffect !== "none" ||
    portfolio.candidates.some(
      (candidate, index) =>
        candidate.rank !== index + 1 ||
        candidate.compositeScore !== compositeScore(candidate.scores),
    )
  ) {
    errors.push("portfolio_governance_or_ranking_invalid");
  }
  const candidateDrafts = portfolio.candidates.map(candidateDraftFromFinal);
  const candidateIds = candidateDrafts.map((candidate) =>
    normalizedKey(candidate.questionId),
  );
  const candidateTitles = candidateDrafts.map((candidate) =>
    normalizedKey(candidate.title),
  );
  const candidateQuestions = candidateDrafts.map((candidate) =>
    normalizedKey(candidate.question),
  );
  if (new Set(candidateIds).size !== candidateIds.length) {
    errors.push("portfolio_candidate_id_not_unique");
  }
  if (
    new Set(candidateTitles).size !== candidateTitles.length ||
    new Set(candidateQuestions).size !== candidateQuestions.length
  ) {
    errors.push("portfolio_candidate_content_not_unique");
  }
  const allowedEvidenceRefs = new Set(portfolio.evidenceRefs);
  if (
    candidateDrafts.some(
      (candidate, index) =>
        validateCandidate(candidate, allowedEvidenceRefs, index).length > 0 ||
        !canonicalValuesMatch(candidate, normalizeCandidate(candidate)),
    )
  ) {
    errors.push("portfolio_candidate_semantics_invalid");
  }
  const expectedOrder = [...candidateDrafts]
    .sort(
      (left, right) =>
        compositeScore(right.scores) - compositeScore(left.scores) ||
        compareCodePoints(left.questionId, right.questionId),
    )
    .map((candidate) => candidate.questionId);
  if (
    !canonicalValuesMatch(
      portfolio.candidates.map((candidate) => candidate.questionId),
      expectedOrder,
    )
  ) {
    errors.push("portfolio_candidate_order_invalid");
  }
  const expectedEvidenceRefs = uniqueSorted(
    candidateDrafts.flatMap((candidate) => candidate.evidenceRefs),
  );
  if (!canonicalValuesMatch(portfolio.evidenceRefs, expectedEvidenceRefs)) {
    errors.push("portfolio_evidence_union_invalid");
  }
  if (
    !canonicalValuesMatch(
      portfolio.auditRefs,
      uniqueSorted(portfolio.auditRefs),
    ) ||
    portfolio.auditRefs.length === 0
  ) {
    errors.push("portfolio_audit_refs_invalid");
  }
  for (const candidate of portfolio.candidates) {
    const { contentHash, ...content } = candidate;
    if (
      !isSha256(contentHash) ||
      contentHash !== sha256(canonicalJson(content))
    ) {
      errors.push("portfolio_candidate_hash_invalid");
    }
  }
  const { portfolioId, contentHash, ...portfolioBasis } = portfolio;
  const expectedPortfolioBasisHash = sha256(canonicalJson(portfolioBasis));
  if (
    portfolioId !==
    `caio-question-portfolio:${expectedPortfolioBasisHash.slice(7, 31)}`
  ) {
    errors.push("portfolio_id_invalid");
  }
  if (
    !isSha256(contentHash) ||
    contentHash !== sha256(canonicalJson({ ...portfolioBasis, portfolioId }))
  ) {
    errors.push("portfolio_content_hash_invalid");
  }
  return { valid: errors.length === 0, errors: uniqueSorted(errors) };
}

export function validateCaioOperatingQuestionPortfolioAgainstG0(
  portfolio: CaioOperatingQuestionPortfolio,
  context: CaioOperatingQuestionG0Context,
): CaioOperatingQuestionValidation {
  const errors = [
    ...validateCaioOperatingQuestionPortfolio(portfolio).errors,
    ...validateCaioOperatingQuestionG0Context(context).errors,
  ];
  if (
    portfolio.workspaceRef !== context.workspaceRef ||
    portfolio.gateReceiptRef !== context.gateReceiptRef ||
    portfolio.gateReceiptHash !== context.gateReceiptHash ||
    portfolio.assessmentRef !== context.assessmentRef ||
    portfolio.assessmentHash !== context.assessmentHash ||
    portfolio.g0ContextHash !== context.contentHash ||
    portfolio.evidenceUniverseHash !== context.evidenceUniverseHash
  ) {
    errors.push("portfolio_g0_binding_invalid");
  }
  const allowedEvidenceRefs = new Set(context.evidenceRefs);
  if (portfolio.evidenceRefs.some((ref) => !allowedEvidenceRefs.has(ref))) {
    errors.push("portfolio_evidence_outside_g0_basis");
  }
  const candidatePayloadHash = sha256(
    canonicalJson(
      sortCandidatesForGenerationHash(
        portfolio.candidates.map(candidateDraftFromFinal),
      ),
    ),
  );
  const expectedGenerationInputHash = generationInputHash({
    g0Context: context,
    generationKey: portfolio.generationKey,
    generatorRef: portfolio.generatorRef,
    modelRef: portfolio.modelRef,
    candidatePayloadHash,
    previousPortfolioRef: portfolio.previousPortfolioRef,
    previousPortfolioHash: portfolio.previousPortfolioHash,
    previousPortfolioSequence: portfolio.sequence - 1,
  });
  if (portfolio.generationInputHash !== expectedGenerationInputHash) {
    errors.push("portfolio_generation_input_binding_invalid");
  }
  return { valid: errors.length === 0, errors: uniqueSorted(errors) };
}

export function validateCaioOperatingQuestionPortfolioAgainstPrevious(
  portfolio: CaioOperatingQuestionPortfolio,
  previousPortfolio: CaioOperatingQuestionPortfolio | null,
): CaioOperatingQuestionValidation {
  const errors = [...validateCaioOperatingQuestionPortfolio(portfolio).errors];
  if (previousPortfolio === null) {
    if (
      portfolio.sequence !== 1 ||
      portfolio.previousPortfolioRef !== null ||
      portfolio.previousPortfolioHash !== null
    ) {
      errors.push("portfolio_predecessor_binding_invalid");
    }
  } else {
    errors.push(
      ...validateCaioOperatingQuestionPortfolio(previousPortfolio).errors,
    );
    if (
      portfolio.workspaceRef !== previousPortfolio.workspaceRef ||
      portfolio.gateReceiptRef !== previousPortfolio.gateReceiptRef ||
      portfolio.gateReceiptHash !== previousPortfolio.gateReceiptHash ||
      portfolio.assessmentRef !== previousPortfolio.assessmentRef ||
      portfolio.assessmentHash !== previousPortfolio.assessmentHash ||
      portfolio.g0ContextHash !== previousPortfolio.g0ContextHash ||
      portfolio.evidenceUniverseHash !==
        previousPortfolio.evidenceUniverseHash ||
      portfolio.sequence !== previousPortfolio.sequence + 1 ||
      portfolio.previousPortfolioRef !== previousPortfolio.portfolioId ||
      portfolio.previousPortfolioHash !== previousPortfolio.contentHash ||
      Date.parse(portfolio.generatedAt) <
        Date.parse(previousPortfolio.generatedAt)
    ) {
      errors.push("portfolio_predecessor_binding_invalid");
    }
  }
  return { valid: errors.length === 0, errors: uniqueSorted(errors) };
}

export function validateCaioOperatingQuestionGenerationReceipt(
  receipt: CaioOperatingQuestionGenerationReceipt,
): CaioOperatingQuestionValidation {
  const errors: string[] = [];
  if (
    receipt.schemaVersion !==
      CAIO_OPERATING_QUESTION_GENERATION_RECEIPT_SCHEMA_VERSION ||
    receipt.generatorRevision !== CAIO_OPERATING_QUESTION_GENERATOR_REVISION ||
    receipt.policyRef !== CAIO_OPERATING_QUESTION_POLICY.policyRef ||
    receipt.policyHash !== CAIO_OPERATING_QUESTION_POLICY.policyHash
  ) {
    errors.push("generation_receipt_version_or_policy_invalid");
  }
  if (
    !isNonEmpty(receipt.receiptId) ||
    !isNonEmpty(receipt.workspaceRef) ||
    !isNonEmpty(receipt.gateReceiptRef) ||
    !isSha256(receipt.gateReceiptHash) ||
    !isNonEmpty(receipt.assessmentRef) ||
    !isSha256(receipt.assessmentHash) ||
    !isSha256(receipt.g0ContextHash) ||
    !isSha256(receipt.evidenceUniverseHash) ||
    !isNonEmpty(receipt.generationKey) ||
    !isSha256(receipt.generationInputHash) ||
    !isCanonicalUtcTimestamp(receipt.recordedAt)
  ) {
    errors.push("generation_receipt_required_field_invalid");
  }
  if (
    !Number.isInteger(receipt.sequence) ||
    receipt.sequence < 1 ||
    (receipt.sequence === 1 &&
      (receipt.previousReceiptRef !== null ||
        receipt.previousReceiptHash !== null)) ||
    (receipt.sequence > 1 &&
      (!isNonEmpty(receipt.previousReceiptRef) ||
        !isSha256(receipt.previousReceiptHash)))
  ) {
    errors.push("generation_receipt_chain_invalid");
  }
  if (!["generated", "insufficient_evidence"].includes(receipt.status)) {
    errors.push("generation_receipt_status_invalid");
  }
  if (
    receipt.authorityEffect !== "none" ||
    (receipt.status === "generated" &&
      (!isNonEmpty(receipt.portfolioRef) ||
        !isSha256(receipt.portfolioHash) ||
        receipt.gapCodes.length > 0)) ||
    (receipt.status === "insufficient_evidence" &&
      (receipt.portfolioRef !== null ||
        receipt.portfolioHash !== null ||
        receipt.gapCodes.length === 0))
  ) {
    errors.push("generation_receipt_outcome_invalid");
  }
  if (
    receipt.evidenceRefs.length === 0 ||
    !canonicalValuesMatch(
      receipt.evidenceRefs,
      uniqueSorted(receipt.evidenceRefs),
    ) ||
    !canonicalValuesMatch(receipt.gapCodes, uniqueSorted(receipt.gapCodes))
  ) {
    errors.push("generation_receipt_canonical_form_invalid");
  }
  const { receiptId, contentHash, ...receiptBasis } = receipt;
  const expectedReceiptBasisHash = sha256(canonicalJson(receiptBasis));
  if (
    receiptId !==
    `caio-question-generation:${expectedReceiptBasisHash.slice(7, 31)}`
  ) {
    errors.push("generation_receipt_id_invalid");
  }
  if (
    !isSha256(contentHash) ||
    contentHash !== sha256(canonicalJson({ ...receiptBasis, receiptId }))
  ) {
    errors.push("generation_receipt_content_hash_invalid");
  }
  return { valid: errors.length === 0, errors: uniqueSorted(errors) };
}

export function validateCaioOperatingQuestionGenerationReceiptAgainstG0(
  receipt: CaioOperatingQuestionGenerationReceipt,
  context: CaioOperatingQuestionG0Context,
): CaioOperatingQuestionValidation {
  const errors = [
    ...validateCaioOperatingQuestionGenerationReceipt(receipt).errors,
    ...validateCaioOperatingQuestionG0Context(context).errors,
  ];
  if (
    receipt.workspaceRef !== context.workspaceRef ||
    receipt.gateReceiptRef !== context.gateReceiptRef ||
    receipt.gateReceiptHash !== context.gateReceiptHash ||
    receipt.assessmentRef !== context.assessmentRef ||
    receipt.assessmentHash !== context.assessmentHash ||
    receipt.g0ContextHash !== context.contentHash ||
    receipt.evidenceUniverseHash !== context.evidenceUniverseHash
  ) {
    errors.push("generation_receipt_g0_binding_invalid");
  }
  const allowedEvidenceRefs = new Set(context.evidenceRefs);
  if (receipt.evidenceRefs.some((ref) => !allowedEvidenceRefs.has(ref))) {
    errors.push("generation_receipt_evidence_outside_g0_basis");
  }
  return { valid: errors.length === 0, errors: uniqueSorted(errors) };
}

export function validateCaioOperatingQuestionGenerationReceiptAgainstPortfolio(
  receipt: CaioOperatingQuestionGenerationReceipt,
  portfolio: CaioOperatingQuestionPortfolio | null,
): CaioOperatingQuestionValidation {
  const errors = [
    ...validateCaioOperatingQuestionGenerationReceipt(receipt).errors,
  ];
  if (receipt.status === "insufficient_evidence") {
    if (portfolio !== null) {
      errors.push("generation_receipt_unexpected_portfolio");
    }
    return { valid: errors.length === 0, errors: uniqueSorted(errors) };
  }
  if (portfolio === null) {
    errors.push("generation_receipt_portfolio_missing");
    return { valid: false, errors: uniqueSorted(errors) };
  }
  errors.push(...validateCaioOperatingQuestionPortfolio(portfolio).errors);
  if (
    receipt.workspaceRef !== portfolio.workspaceRef ||
    receipt.gateReceiptRef !== portfolio.gateReceiptRef ||
    receipt.gateReceiptHash !== portfolio.gateReceiptHash ||
    receipt.assessmentRef !== portfolio.assessmentRef ||
    receipt.assessmentHash !== portfolio.assessmentHash ||
    receipt.g0ContextHash !== portfolio.g0ContextHash ||
    receipt.evidenceUniverseHash !== portfolio.evidenceUniverseHash ||
    receipt.generationKey !== portfolio.generationKey ||
    receipt.generationInputHash !== portfolio.generationInputHash ||
    receipt.portfolioRef !== portfolio.portfolioId ||
    receipt.portfolioHash !== portfolio.contentHash ||
    portfolio.evidenceRefs.some((ref) => !receipt.evidenceRefs.includes(ref))
  ) {
    errors.push("generation_receipt_portfolio_binding_invalid");
  }
  return { valid: errors.length === 0, errors: uniqueSorted(errors) };
}

export function validateCaioOperatingQuestionGenerationReceiptAgainstPrevious(
  receipt: CaioOperatingQuestionGenerationReceipt,
  previousReceipt: CaioOperatingQuestionGenerationReceipt | null,
): CaioOperatingQuestionValidation {
  const errors = [
    ...validateCaioOperatingQuestionGenerationReceipt(receipt).errors,
  ];
  if (previousReceipt === null) {
    if (
      receipt.sequence !== 1 ||
      receipt.previousReceiptRef !== null ||
      receipt.previousReceiptHash !== null
    ) {
      errors.push("generation_receipt_predecessor_binding_invalid");
    }
  } else {
    errors.push(
      ...validateCaioOperatingQuestionGenerationReceipt(previousReceipt).errors,
    );
    if (
      receipt.workspaceRef !== previousReceipt.workspaceRef ||
      receipt.gateReceiptRef !== previousReceipt.gateReceiptRef ||
      receipt.gateReceiptHash !== previousReceipt.gateReceiptHash ||
      receipt.assessmentRef !== previousReceipt.assessmentRef ||
      receipt.assessmentHash !== previousReceipt.assessmentHash ||
      receipt.g0ContextHash !== previousReceipt.g0ContextHash ||
      receipt.sequence !== previousReceipt.sequence + 1 ||
      receipt.previousReceiptRef !== previousReceipt.receiptId ||
      receipt.previousReceiptHash !== previousReceipt.contentHash ||
      Date.parse(receipt.recordedAt) < Date.parse(previousReceipt.recordedAt)
    ) {
      errors.push("generation_receipt_predecessor_binding_invalid");
    }
  }
  return { valid: errors.length === 0, errors: uniqueSorted(errors) };
}
