import { z } from "zod";

import { canonicalJson, sha256 } from "@/lib/expert-capability/hashing";

import {
  validateCaioOperatingQuestionPortfolio,
  type CaioOperatingQuestionCandidate,
  type CaioOperatingQuestionPortfolio,
  type CaioOperatingQuestionValidationMetric,
} from "./caio-operating-question";
import {
  validateCaioQuestionSelectionReceipt,
  validateCaioQuestionSelectionReceiptAgainstPortfolio,
  type CaioQuestionSelectionMetric,
  type CaioQuestionSelectionReceipt,
} from "./caio-question-selection";

export const CAIO_OPERATING_QUESTION_IMPLEMENTATION_PLAN_SCHEMA_VERSION =
  "helm.caio.operating-question-implementation-plan.v1" as const;

export type CaioOperatingQuestionImplementationPlan = {
  schemaVersion: typeof CAIO_OPERATING_QUESTION_IMPLEMENTATION_PLAN_SCHEMA_VERSION;
  planId: string;
  workspaceRef: string;
  portfolioRef: string;
  portfolioHash: string;
  selectionReceiptRef: string;
  selectionReceiptHash: string;
  questionId: string;
  candidateHash: string;
  decisionRecordRef: string;
  status: "DRAFT";
  implementationReadiness: "needs_configuration";
  objective: string;
  baseline: {
    metrics: CaioOperatingQuestionValidationMetric[];
    evidenceRefs: string[];
    freshness: CaioOperatingQuestionCandidate["freshness"];
    confidence: CaioOperatingQuestionCandidate["confidence"];
    unknowns: string[];
    conflictCount: number;
  };
  target: {
    successMetrics: CaioQuestionSelectionMetric[];
  };
  adaptation: {
    implementationScopeRefs: string[];
    requiredDataRefs: string[];
    dependencyRefs: string[];
    packRefs: string[];
    overlayRefs: string[];
    connectorRefs: string[];
  };
  reporting: {
    cadences: ["daily", "weekly"];
    exceptionSignalRefs: string[];
  };
  governance: {
    decisionBoundary: string;
    prohibitedActions: string[];
  };
  execution: {
    workPacketCreation: "owner_confirmation_required";
    executionReceiptRequirement: string;
    independentReviewerRef: string | null;
  };
  modelGovernance: {
    modelRoutePolicyRef: string | null;
    dataDispositionRef: string | null;
  };
  people: {
    ownerRef: string | null;
    reviewerRef: string | null;
    escalationRef: string | null;
  };
  outcome: {
    successConditions: string[];
    failureConditions: string[];
    stopConditions: string[];
    rollbackConditions: string[];
  };
  review: {
    valueReviewPeriodDays: 30;
    startsAt: string | null;
    endsAt: string | null;
    method: string;
  };
  evidenceRefs: string[];
  auditRefs: string[];
  gapCodes: string[];
  authorityEffect: "none";
  workPacketEffect: "none";
  createdAt: string;
  contentHash: string;
};

export type CaioOperatingQuestionImplementationPlanValidation = {
  valid: boolean;
  errors: string[];
};

const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/;
const CANONICAL_UTC_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function compareCodePoints(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort(
    compareCodePoints,
  );
}

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

const validationMetricShapeSchema = z
  .object({
    metricKey: z.string(),
    description: z.string(),
    unit: z.string(),
    direction: z.string(),
    baselineWindowStart: z.string(),
    baselineWindowEnd: z.string(),
  })
  .strict();
const selectionMetricShapeSchema = z
  .object({
    metricKey: z.string(),
    target: z.string(),
  })
  .strict();
const implementationPlanShapeSchema = z
  .object({
    schemaVersion: z.string(),
    planId: z.string(),
    workspaceRef: z.string(),
    portfolioRef: z.string(),
    portfolioHash: z.string(),
    selectionReceiptRef: z.string(),
    selectionReceiptHash: z.string(),
    questionId: z.string(),
    candidateHash: z.string(),
    decisionRecordRef: z.string(),
    status: z.string(),
    implementationReadiness: z.string(),
    objective: z.string(),
    baseline: z
      .object({
        metrics: z.array(validationMetricShapeSchema),
        evidenceRefs: z.array(z.string()),
        freshness: z.string(),
        confidence: z.string(),
        unknowns: z.array(z.string()),
        conflictCount: z.number(),
      })
      .strict(),
    target: z
      .object({
        successMetrics: z.array(selectionMetricShapeSchema),
      })
      .strict(),
    adaptation: z
      .object({
        implementationScopeRefs: z.array(z.string()),
        requiredDataRefs: z.array(z.string()),
        dependencyRefs: z.array(z.string()),
        packRefs: z.array(z.string()),
        overlayRefs: z.array(z.string()),
        connectorRefs: z.array(z.string()),
      })
      .strict(),
    reporting: z
      .object({
        cadences: z.array(z.string()),
        exceptionSignalRefs: z.array(z.string()),
      })
      .strict(),
    governance: z
      .object({
        decisionBoundary: z.string(),
        prohibitedActions: z.array(z.string()),
      })
      .strict(),
    execution: z
      .object({
        workPacketCreation: z.string(),
        executionReceiptRequirement: z.string(),
        independentReviewerRef: z.string().nullable(),
      })
      .strict(),
    modelGovernance: z
      .object({
        modelRoutePolicyRef: z.string().nullable(),
        dataDispositionRef: z.string().nullable(),
      })
      .strict(),
    people: z
      .object({
        ownerRef: z.string().nullable(),
        reviewerRef: z.string().nullable(),
        escalationRef: z.string().nullable(),
      })
      .strict(),
    outcome: z
      .object({
        successConditions: z.array(z.string()),
        failureConditions: z.array(z.string()),
        stopConditions: z.array(z.string()),
        rollbackConditions: z.array(z.string()),
      })
      .strict(),
    review: z
      .object({
        valueReviewPeriodDays: z.number(),
        startsAt: z.string().nullable(),
        endsAt: z.string().nullable(),
        method: z.string(),
      })
      .strict(),
    evidenceRefs: z.array(z.string()),
    auditRefs: z.array(z.string()),
    gapCodes: z.array(z.string()),
    authorityEffect: z.string(),
    workPacketEffect: z.string(),
    createdAt: z.string(),
    contentHash: z.string(),
  })
  .strict();

function parseImplementationPlanShape(
  value: unknown,
): CaioOperatingQuestionImplementationPlan | null {
  const parsed = implementationPlanShapeSchema.safeParse(value);
  return parsed.success
    ? (parsed.data as CaioOperatingQuestionImplementationPlan)
    : null;
}

function selectedContext(input: {
  portfolio: CaioOperatingQuestionPortfolio;
  selectionReceipt: CaioQuestionSelectionReceipt;
  questionId: string;
}): {
  candidate: CaioOperatingQuestionCandidate;
  selection: CaioQuestionSelectionReceipt["selections"][number];
} {
  const questionId = input.questionId.trim();
  const candidate = input.portfolio.candidates.find(
    (item) => item.questionId === questionId,
  );
  const selection = input.selectionReceipt.selections.find(
    (item) => item.questionId === questionId,
  );
  if (!questionId || !candidate || !selection) {
    throw new Error("selected_operating_question_required");
  }
  return { candidate, selection };
}

function implementationGapCodes(input: {
  successMetricCount: number;
  ownerRef: string | null;
  reviewerRef: string | null;
}): string[] {
  return uniqueSorted([
    "pack_mapping_required",
    "overlay_mapping_required",
    "connector_mapping_required",
    "model_route_policy_required",
    "data_disposition_required",
    "escalation_route_required",
    "failure_condition_required",
    "stop_condition_required",
    "rollback_condition_required",
    ...(input.successMetricCount === 0 ? ["success_metric_required"] : []),
    ...(input.ownerRef ? [] : ["operating_owner_required"]),
    ...(input.reviewerRef ? [] : ["independent_reviewer_required"]),
  ]);
}

export function createCaioOperatingQuestionImplementationPlan(input: {
  portfolio: CaioOperatingQuestionPortfolio;
  selectionReceipt: CaioQuestionSelectionReceipt;
  questionId: string;
  decisionRecordRef: string;
}): CaioOperatingQuestionImplementationPlan {
  const portfolioValidation = validateCaioOperatingQuestionPortfolio(
    input.portfolio,
  );
  const selectionValidation = validateCaioQuestionSelectionReceipt(
    input.selectionReceipt,
  );
  const selectionPortfolioValidation =
    validateCaioQuestionSelectionReceiptAgainstPortfolio(
      input.selectionReceipt,
      input.portfolio,
    );
  if (
    !portfolioValidation.valid ||
    !selectionValidation.valid ||
    !selectionPortfolioValidation.valid
  ) {
    throw new Error("implementation_plan_source_invalid");
  }
  const decisionRecordRef = input.decisionRecordRef.trim();
  if (!decisionRecordRef) {
    throw new Error("decision_record_ref_required");
  }
  const { candidate, selection } = selectedContext(input);
  const successConditions = selection.successMetrics.map(
    (metric) => `${metric.metricKey}:${metric.target}`,
  );
  const content = {
    schemaVersion: CAIO_OPERATING_QUESTION_IMPLEMENTATION_PLAN_SCHEMA_VERSION,
    workspaceRef: input.portfolio.workspaceRef,
    portfolioRef: input.portfolio.portfolioId,
    portfolioHash: input.portfolio.contentHash,
    selectionReceiptRef: input.selectionReceipt.receiptId,
    selectionReceiptHash: input.selectionReceipt.contentHash,
    questionId: candidate.questionId,
    candidateHash: candidate.contentHash,
    decisionRecordRef,
    status: "DRAFT" as const,
    implementationReadiness: "needs_configuration" as const,
    objective: selection.goal?.trim() || candidate.firstNarrowLoop.objective,
    baseline: {
      metrics: candidate.validationMetrics,
      evidenceRefs: uniqueSorted(candidate.evidenceRefs),
      freshness: candidate.freshness,
      confidence: candidate.confidence,
      unknowns: uniqueSorted(candidate.unknowns),
      conflictCount: candidate.conflicts.length,
    },
    target: {
      successMetrics: selection.successMetrics,
    },
    adaptation: {
      implementationScopeRefs: uniqueSorted(selection.implementationScopeRefs),
      requiredDataRefs: uniqueSorted(candidate.requiredDataRefs),
      dependencyRefs: uniqueSorted(candidate.dependencyRefs),
      packRefs: [],
      overlayRefs: [],
      connectorRefs: [],
    },
    reporting: {
      cadences: ["daily", "weekly"] as ["daily", "weekly"],
      exceptionSignalRefs: uniqueSorted([
        candidate.firstNarrowLoop.supervisionSignal,
      ]),
    },
    governance: {
      decisionBoundary: candidate.firstNarrowLoop.decisionBoundary,
      prohibitedActions: uniqueSorted(selection.prohibitedActions),
    },
    execution: {
      workPacketCreation: "owner_confirmation_required" as const,
      executionReceiptRequirement: candidate.firstNarrowLoop.receiptRequirement,
      independentReviewerRef: selection.reviewerRef,
    },
    modelGovernance: {
      modelRoutePolicyRef: null,
      dataDispositionRef: null,
    },
    people: {
      ownerRef: selection.ownerRef,
      reviewerRef: selection.reviewerRef,
      escalationRef: null,
    },
    outcome: {
      successConditions,
      failureConditions: [],
      stopConditions: [],
      rollbackConditions: [],
    },
    review: {
      valueReviewPeriodDays: 30 as const,
      startsAt: selection.startsAt,
      endsAt: selection.endsAt,
      method:
        "Compare the governed baseline and result windows, verify execution receipts independently, and record evidence-backed value, failure, stop, and rollback outcomes.",
    },
    evidenceRefs: uniqueSorted([
      ...candidate.evidenceRefs,
      ...input.selectionReceipt.evidenceRefs,
    ]),
    auditRefs: uniqueSorted(input.portfolio.auditRefs),
    gapCodes: implementationGapCodes({
      successMetricCount: selection.successMetrics.length,
      ownerRef: selection.ownerRef,
      reviewerRef: selection.reviewerRef,
    }),
    authorityEffect: "none" as const,
    workPacketEffect: "none" as const,
    createdAt: input.selectionReceipt.selectedAt,
  };
  const basisHash = sha256(canonicalJson(content));
  const plan = {
    ...content,
    planId: `caio-operating-question-plan:${basisHash.slice(7, 31)}`,
  };
  return {
    ...plan,
    contentHash: sha256(canonicalJson(plan)),
  };
}

export function validateCaioOperatingQuestionImplementationPlan(
  value: unknown,
): CaioOperatingQuestionImplementationPlanValidation {
  const plan = parseImplementationPlanShape(value);
  if (!plan) {
    return {
      valid: false,
      errors: ["implementation_plan_shape_invalid"],
    };
  }
  const errors: string[] = [];
  if (
    plan.schemaVersion !==
    CAIO_OPERATING_QUESTION_IMPLEMENTATION_PLAN_SCHEMA_VERSION
  ) {
    errors.push("implementation_plan_schema_version_invalid");
  }
  if (
    !isNonEmpty(plan.planId) ||
    !isNonEmpty(plan.workspaceRef) ||
    !isNonEmpty(plan.portfolioRef) ||
    !isSha256(plan.portfolioHash) ||
    !isNonEmpty(plan.selectionReceiptRef) ||
    !isSha256(plan.selectionReceiptHash) ||
    !isNonEmpty(plan.questionId) ||
    !isSha256(plan.candidateHash) ||
    !isNonEmpty(plan.decisionRecordRef) ||
    !isNonEmpty(plan.objective) ||
    !isCanonicalUtcTimestamp(plan.createdAt)
  ) {
    errors.push("implementation_plan_required_field_invalid");
  }
  if (
    plan.status !== "DRAFT" ||
    plan.implementationReadiness !== "needs_configuration" ||
    plan.authorityEffect !== "none" ||
    plan.workPacketEffect !== "none" ||
    plan.execution.workPacketCreation !== "owner_confirmation_required"
  ) {
    errors.push("implementation_plan_governance_boundary_invalid");
  }
  if (
    plan.review.valueReviewPeriodDays !== 30 ||
    (plan.review.startsAt !== null &&
      !isCanonicalUtcTimestamp(plan.review.startsAt)) ||
    (plan.review.endsAt !== null &&
      !isCanonicalUtcTimestamp(plan.review.endsAt)) ||
    (plan.review.startsAt !== null &&
      plan.review.endsAt !== null &&
      Date.parse(plan.review.startsAt) >= Date.parse(plan.review.endsAt)) ||
    !isNonEmpty(plan.review.method)
  ) {
    errors.push("implementation_plan_review_invalid");
  }
  if (
    canonicalJson(plan.reporting.cadences) !==
      canonicalJson(["daily", "weekly"]) ||
    plan.reporting.exceptionSignalRefs.length === 0 ||
    !isNonEmpty(plan.governance.decisionBoundary) ||
    !isNonEmpty(plan.execution.executionReceiptRequirement)
  ) {
    errors.push("implementation_plan_loop_invalid");
  }
  if (
    plan.baseline.metrics.length === 0 ||
    plan.baseline.evidenceRefs.length === 0 ||
    plan.evidenceRefs.length === 0 ||
    plan.baseline.conflictCount < 0 ||
    !Number.isInteger(plan.baseline.conflictCount)
  ) {
    errors.push("implementation_plan_evidence_invalid");
  }
  const canonicalArrays: Array<[readonly string[], string]> = [
    [plan.baseline.evidenceRefs, "baseline_evidence"],
    [plan.baseline.unknowns, "baseline_unknowns"],
    [plan.adaptation.implementationScopeRefs, "implementation_scope"],
    [plan.adaptation.requiredDataRefs, "required_data"],
    [plan.adaptation.dependencyRefs, "dependencies"],
    [plan.adaptation.packRefs, "pack_refs"],
    [plan.adaptation.overlayRefs, "overlay_refs"],
    [plan.adaptation.connectorRefs, "connector_refs"],
    [plan.reporting.exceptionSignalRefs, "exception_signals"],
    [plan.governance.prohibitedActions, "prohibited_actions"],
    [plan.outcome.successConditions, "success_conditions"],
    [plan.outcome.failureConditions, "failure_conditions"],
    [plan.outcome.stopConditions, "stop_conditions"],
    [plan.outcome.rollbackConditions, "rollback_conditions"],
    [plan.evidenceRefs, "evidence_refs"],
    [plan.auditRefs, "audit_refs"],
    [plan.gapCodes, "gap_codes"],
  ];
  if (
    canonicalArrays.some(
      ([values]) =>
        canonicalJson(values) !== canonicalJson(uniqueSorted(values)),
    )
  ) {
    errors.push("implementation_plan_canonical_form_invalid");
  }
  const { planId, contentHash, ...planBasis } = plan;
  const expectedBasisHash = sha256(canonicalJson(planBasis));
  if (
    planId !== `caio-operating-question-plan:${expectedBasisHash.slice(7, 31)}`
  ) {
    errors.push("implementation_plan_id_invalid");
  }
  if (
    !isSha256(contentHash) ||
    contentHash !== sha256(canonicalJson({ ...planBasis, planId }))
  ) {
    errors.push("implementation_plan_content_hash_invalid");
  }
  return {
    valid: errors.length === 0,
    errors: uniqueSorted(errors),
  };
}

export function validateCaioOperatingQuestionImplementationPlanAgainstContext(
  value: unknown,
  input: {
    portfolio: CaioOperatingQuestionPortfolio;
    selectionReceipt: CaioQuestionSelectionReceipt;
    decisionRecordRef: string;
  },
): CaioOperatingQuestionImplementationPlanValidation {
  const errors = [
    ...validateCaioOperatingQuestionImplementationPlan(value).errors,
  ];
  const plan = parseImplementationPlanShape(value);
  if (!plan) {
    errors.push("implementation_plan_context_binding_invalid");
    return {
      valid: false,
      errors: uniqueSorted(errors),
    };
  }
  try {
    const expected = createCaioOperatingQuestionImplementationPlan({
      ...input,
      questionId: plan.questionId,
    });
    if (canonicalJson(plan) !== canonicalJson(expected)) {
      errors.push("implementation_plan_context_binding_invalid");
    }
  } catch {
    errors.push("implementation_plan_context_binding_invalid");
  }
  return {
    valid: errors.length === 0,
    errors: uniqueSorted(errors),
  };
}
