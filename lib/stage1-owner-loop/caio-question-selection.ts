import { z } from "zod";

import { canonicalJson, sha256 } from "../expert-capability/hashing";
import {
  CAIO_OPERATING_QUESTION_POLICY,
  validateCaioOperatingQuestionPortfolio,
  type CaioOperatingQuestionPortfolio,
} from "./caio-operating-question";

export const CAIO_QUESTION_SELECTION_RECEIPT_SCHEMA_VERSION =
  "helm.caio.question-selection-receipt.v1" as const;

export type CaioQuestionSelectionMetric = {
  metricKey: string;
  target: string;
};

export type CaioQuestionSelectionItem = {
  questionId: string;
  questionOverride: string | null;
  goal: string | null;
  successMetrics: CaioQuestionSelectionMetric[];
  priority: number;
  implementationScopeRefs: string[];
  ownerRef: string | null;
  reviewerRef: string | null;
  startsAt: string | null;
  endsAt: string | null;
  prohibitedActions: string[];
};

export type CaioQuestionSelectionReceipt = {
  schemaVersion: typeof CAIO_QUESTION_SELECTION_RECEIPT_SCHEMA_VERSION;
  receiptId: string;
  workspaceRef: string;
  portfolioRef: string;
  portfolioHash: string;
  gateReceiptRef: string;
  gateReceiptHash: string;
  ceoPrincipalBindingRef: string;
  ceoPrincipalRef: string;
  actorType: "USER";
  actorUserRef: string;
  idempotencyKey: string;
  previousReceiptRef: string | null;
  previousReceiptHash: string | null;
  sequence: number;
  selections: CaioQuestionSelectionItem[];
  selectedQuestionIds: string[];
  reasonCodes: string[];
  evidenceRefs: string[];
  selectedAt: string;
  authorityEffect: "none";
  workPacketEffect: "none";
  contentHash: string;
};

export type CaioQuestionSelectionValidation = {
  valid: boolean;
  errors: string[];
};

const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/;
const CANONICAL_UTC_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

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

function canonicalValuesMatch(left: unknown, right: unknown): boolean {
  return canonicalJson(left) === canonicalJson(right);
}

const canonicalUtcTimestampSchema = z
  .string()
  .refine(isCanonicalUtcTimestamp, "canonical UTC timestamp required");
const questionSelectionItemSchema: z.ZodType<CaioQuestionSelectionItem> = z
  .object({
    questionId: z.string(),
    questionOverride: z.string().nullable(),
    goal: z.string().nullable(),
    successMetrics: z.array(
      z
        .object({
          metricKey: z.string(),
          target: z.string(),
        })
        .strict(),
    ),
    priority: z.number(),
    implementationScopeRefs: z.array(z.string()),
    ownerRef: z.string().nullable(),
    reviewerRef: z.string().nullable(),
    startsAt: canonicalUtcTimestampSchema.nullable(),
    endsAt: canonicalUtcTimestampSchema.nullable(),
    prohibitedActions: z.array(z.string()),
  })
  .strict();

function normalizeSelection(
  selection: CaioQuestionSelectionItem,
): CaioQuestionSelectionItem {
  return {
    questionId: selection.questionId.trim(),
    questionOverride: selection.questionOverride?.trim() || null,
    goal: selection.goal?.trim() || null,
    successMetrics: selection.successMetrics
      .map((metric) => ({
        metricKey: metric.metricKey.trim(),
        target: metric.target.trim(),
      }))
      .sort(
        (left, right) =>
          compareCodePoints(left.metricKey, right.metricKey) ||
          compareCodePoints(left.target, right.target),
      ),
    priority: selection.priority,
    implementationScopeRefs: uniqueSorted(selection.implementationScopeRefs),
    ownerRef: selection.ownerRef?.trim() || null,
    reviewerRef: selection.reviewerRef?.trim() || null,
    startsAt: selection.startsAt,
    endsAt: selection.endsAt,
    prohibitedActions: uniqueSorted(selection.prohibitedActions),
  };
}

function selectionItemsAreValid(
  selections: readonly CaioQuestionSelectionItem[],
): boolean {
  return selections.every(
    (selection, index) =>
      isNonEmpty(selection.questionId) &&
      Number.isInteger(selection.priority) &&
      selection.priority === index + 1 &&
      new Set(
        selection.successMetrics.map((metric) => metric.metricKey),
      ).size === selection.successMetrics.length &&
      selection.successMetrics.every(
        (metric) => isNonEmpty(metric.metricKey) && isNonEmpty(metric.target),
      ) &&
      (selection.startsAt === null ||
        isCanonicalUtcTimestamp(selection.startsAt)) &&
      (selection.endsAt === null ||
        isCanonicalUtcTimestamp(selection.endsAt)) &&
      !(
        selection.startsAt !== null &&
        selection.endsAt !== null &&
        Date.parse(selection.startsAt) >= Date.parse(selection.endsAt)
      ),
  );
}

export function createCaioQuestionSelectionReceipt(input: {
  portfolio: CaioOperatingQuestionPortfolio;
  workspaceRef: string;
  ceoPrincipalBindingRef: string;
  ceoPrincipalRef: string;
  actorUserRef: string;
  idempotencyKey: string;
  previousReceipt: CaioQuestionSelectionReceipt | null;
  selections: unknown;
  reasonCodes: readonly string[];
  evidenceRefs: readonly string[];
  selectedAt: string;
}): CaioQuestionSelectionReceipt {
  const portfolioValidation = validateCaioOperatingQuestionPortfolio(
    input.portfolio,
  );
  if (!portfolioValidation.valid) {
    throw new Error(
      `caio_question_portfolio_invalid:${portfolioValidation.errors.join(",")}`,
    );
  }
  if (
    !isNonEmpty(input.workspaceRef) ||
    input.workspaceRef !== input.portfolio.workspaceRef ||
    !isNonEmpty(input.ceoPrincipalBindingRef) ||
    !isNonEmpty(input.ceoPrincipalRef) ||
    !isNonEmpty(input.actorUserRef) ||
    !isNonEmpty(input.idempotencyKey) ||
    !isCanonicalUtcTimestamp(input.selectedAt)
  ) {
    throw new Error("caio_question_selection_input_invalid");
  }
  const parsedSelections = z
    .array(questionSelectionItemSchema)
    .safeParse(input.selections);
  if (!parsedSelections.success) {
    throw new Error("caio_question_selection_item_invalid");
  }
  const selections = parsedSelections.data
    .map(normalizeSelection)
    .sort(
      (left, right) =>
        left.priority - right.priority ||
        compareCodePoints(left.questionId, right.questionId),
    );
  if (
    selections.length > CAIO_OPERATING_QUESTION_POLICY.maximumSelectionCount
  ) {
    throw new Error("caio_question_selection_limit_exceeded");
  }
  const selectedQuestionIds = selections.map(
    (selection) => selection.questionId,
  );
  if (new Set(selectedQuestionIds).size !== selectedQuestionIds.length) {
    throw new Error("caio_question_selection_duplicate");
  }
  const portfolioQuestionIds = new Set(
    input.portfolio.candidates.map((candidate) => candidate.questionId),
  );
  if (
    selectedQuestionIds.some(
      (questionId) => !portfolioQuestionIds.has(questionId),
    )
  ) {
    throw new Error("caio_question_selection_outside_portfolio");
  }
  if (!selectionItemsAreValid(selections)) {
    throw new Error("caio_question_selection_item_invalid");
  }
  const reasonCodes = uniqueSorted(input.reasonCodes);
  const evidenceRefs = uniqueSorted(input.evidenceRefs);
  if (reasonCodes.length === 0 || evidenceRefs.length === 0) {
    throw new Error("caio_question_selection_evidence_required");
  }
  if (
    input.previousReceipt !== null &&
    (!validateCaioQuestionSelectionReceipt(input.previousReceipt).valid ||
      !validateCaioQuestionSelectionReceiptAgainstPortfolio(
        input.previousReceipt,
        input.portfolio,
      ).valid ||
      input.previousReceipt.workspaceRef !== input.workspaceRef.trim() ||
      Date.parse(input.previousReceipt.selectedAt) >
        Date.parse(input.selectedAt))
  ) {
    throw new Error("caio_question_selection_previous_receipt_invalid");
  }
  const content = {
    schemaVersion: CAIO_QUESTION_SELECTION_RECEIPT_SCHEMA_VERSION,
    workspaceRef: input.workspaceRef.trim(),
    portfolioRef: input.portfolio.portfolioId,
    portfolioHash: input.portfolio.contentHash,
    gateReceiptRef: input.portfolio.gateReceiptRef,
    gateReceiptHash: input.portfolio.gateReceiptHash,
    ceoPrincipalBindingRef: input.ceoPrincipalBindingRef.trim(),
    ceoPrincipalRef: input.ceoPrincipalRef.trim(),
    actorType: "USER" as const,
    actorUserRef: input.actorUserRef.trim(),
    idempotencyKey: input.idempotencyKey.trim(),
    previousReceiptRef: input.previousReceipt?.receiptId ?? null,
    previousReceiptHash: input.previousReceipt?.contentHash ?? null,
    sequence: (input.previousReceipt?.sequence ?? 0) + 1,
    selections,
    selectedQuestionIds,
    reasonCodes,
    evidenceRefs,
    selectedAt: input.selectedAt,
    authorityEffect: "none" as const,
    workPacketEffect: "none" as const,
  };
  const basisHash = sha256(canonicalJson(content));
  const receipt = {
    ...content,
    receiptId: `caio-question-selection:${basisHash.slice(7, 31)}`,
  };
  return {
    ...receipt,
    contentHash: sha256(canonicalJson(receipt)),
  };
}

export function validateCaioQuestionSelectionReceipt(
  receipt: CaioQuestionSelectionReceipt,
): CaioQuestionSelectionValidation {
  const errors: string[] = [];
  if (
    receipt.schemaVersion !== CAIO_QUESTION_SELECTION_RECEIPT_SCHEMA_VERSION
  ) {
    errors.push("selection_receipt_schema_version_invalid");
  }
  if (
    !isNonEmpty(receipt.receiptId) ||
    !isNonEmpty(receipt.workspaceRef) ||
    !isNonEmpty(receipt.portfolioRef) ||
    !isSha256(receipt.portfolioHash) ||
    !isNonEmpty(receipt.gateReceiptRef) ||
    !isSha256(receipt.gateReceiptHash) ||
    !isNonEmpty(receipt.ceoPrincipalBindingRef) ||
    !isNonEmpty(receipt.ceoPrincipalRef) ||
    !isNonEmpty(receipt.actorUserRef) ||
    !isNonEmpty(receipt.idempotencyKey) ||
    !isCanonicalUtcTimestamp(receipt.selectedAt)
  ) {
    errors.push("selection_receipt_required_field_invalid");
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
    errors.push("selection_receipt_chain_invalid");
  }
  if (
    receipt.actorType !== "USER" ||
    receipt.authorityEffect !== "none" ||
    receipt.workPacketEffect !== "none"
  ) {
    errors.push("selection_receipt_governance_boundary_invalid");
  }
  if (
    receipt.selections.length >
      CAIO_OPERATING_QUESTION_POLICY.maximumSelectionCount ||
    receipt.selectedQuestionIds.length !== receipt.selections.length ||
    canonicalJson(receipt.selectedQuestionIds) !==
      canonicalJson(
        receipt.selections.map((selection) => selection.questionId),
      ) ||
    new Set(receipt.selectedQuestionIds).size !==
      receipt.selectedQuestionIds.length
  ) {
    errors.push("selection_receipt_selection_invalid");
  }
  if (!selectionItemsAreValid(receipt.selections)) {
    errors.push("selection_receipt_item_invalid");
  }
  if (
    uniqueSorted(receipt.reasonCodes).length === 0 ||
    uniqueSorted(receipt.evidenceRefs).length === 0
  ) {
    errors.push("selection_receipt_evidence_required");
  }
  const normalizedSelections = receipt.selections
    .map(normalizeSelection)
    .sort(
      (left, right) =>
        left.priority - right.priority ||
        compareCodePoints(left.questionId, right.questionId),
    );
  if (
    !canonicalValuesMatch(receipt.selections, normalizedSelections) ||
    !canonicalValuesMatch(
      receipt.reasonCodes,
      uniqueSorted(receipt.reasonCodes),
    ) ||
    !canonicalValuesMatch(
      receipt.evidenceRefs,
      uniqueSorted(receipt.evidenceRefs),
    )
  ) {
    errors.push("selection_receipt_canonical_form_invalid");
  }
  const { receiptId, contentHash, ...receiptBasis } = receipt;
  const expectedReceiptBasisHash = sha256(canonicalJson(receiptBasis));
  if (
    receiptId !==
    `caio-question-selection:${expectedReceiptBasisHash.slice(7, 31)}`
  ) {
    errors.push("selection_receipt_id_invalid");
  }
  if (
    !isSha256(contentHash) ||
    contentHash !== sha256(canonicalJson({ ...receiptBasis, receiptId }))
  ) {
    errors.push("selection_receipt_content_hash_invalid");
  }
  return {
    valid: errors.length === 0,
    errors: uniqueSorted(errors),
  };
}

export function validateCaioQuestionSelectionReceiptAgainstPortfolio(
  receipt: CaioQuestionSelectionReceipt,
  portfolio: CaioOperatingQuestionPortfolio,
): CaioQuestionSelectionValidation {
  const errors = [
    ...validateCaioQuestionSelectionReceipt(receipt).errors,
    ...validateCaioOperatingQuestionPortfolio(portfolio).errors,
  ];
  if (
    receipt.workspaceRef !== portfolio.workspaceRef ||
    receipt.portfolioRef !== portfolio.portfolioId ||
    receipt.portfolioHash !== portfolio.contentHash ||
    receipt.gateReceiptRef !== portfolio.gateReceiptRef ||
    receipt.gateReceiptHash !== portfolio.gateReceiptHash
  ) {
    errors.push("selection_receipt_portfolio_binding_invalid");
  }
  const portfolioQuestionIds = new Set(
    portfolio.candidates.map((candidate) => candidate.questionId),
  );
  if (
    receipt.selectedQuestionIds.some(
      (questionId) => !portfolioQuestionIds.has(questionId),
    )
  ) {
    errors.push("selection_receipt_question_outside_portfolio");
  }
  return {
    valid: errors.length === 0,
    errors: uniqueSorted(errors),
  };
}

export function validateCaioQuestionSelectionReceiptAgainstPrevious(
  receipt: CaioQuestionSelectionReceipt,
  previousReceipt: CaioQuestionSelectionReceipt | null,
): CaioQuestionSelectionValidation {
  const errors = [...validateCaioQuestionSelectionReceipt(receipt).errors];
  if (previousReceipt === null) {
    if (
      receipt.sequence !== 1 ||
      receipt.previousReceiptRef !== null ||
      receipt.previousReceiptHash !== null
    ) {
      errors.push("selection_receipt_predecessor_binding_invalid");
    }
  } else {
    errors.push(
      ...validateCaioQuestionSelectionReceipt(previousReceipt).errors,
    );
    if (
      receipt.workspaceRef !== previousReceipt.workspaceRef ||
      receipt.portfolioRef !== previousReceipt.portfolioRef ||
      receipt.portfolioHash !== previousReceipt.portfolioHash ||
      receipt.sequence !== previousReceipt.sequence + 1 ||
      receipt.previousReceiptRef !== previousReceipt.receiptId ||
      receipt.previousReceiptHash !== previousReceipt.contentHash ||
      Date.parse(receipt.selectedAt) < Date.parse(previousReceipt.selectedAt)
    ) {
      errors.push("selection_receipt_predecessor_binding_invalid");
    }
  }
  return {
    valid: errors.length === 0,
    errors: uniqueSorted(errors),
  };
}
