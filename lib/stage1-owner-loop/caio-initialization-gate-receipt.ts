import { canonicalJson, sha256 } from "../expert-capability/hashing";
import {
  validateCaioInitializationAssessment,
  type CaioInitializationAssessment,
} from "./caio-initialization-gate";

export const CAIO_INITIALIZATION_GATE_RECEIPT_SCHEMA_VERSION =
  "helm.caio.initialization-gate-receipt.v1" as const;

export type CaioInitializationGateReceiptAction = "accept" | "revoke";
export type CaioInitializationGateStatus = "accepted" | "revoked";

export type CaioInitializationGateReceipt = {
  schemaVersion: typeof CAIO_INITIALIZATION_GATE_RECEIPT_SCHEMA_VERSION;
  receiptId: string;
  workspaceRef: string;
  assessmentRef: string;
  assessmentHash: string;
  mandateRef: string;
  ceoPrincipalBindingRef: string;
  ceoPrincipalRef: string;
  previousReceiptRef: string | null;
  previousReceiptHash: string | null;
  sequence: number;
  idempotencyKey: string;
  action: CaioInitializationGateReceiptAction;
  resultingStatus: CaioInitializationGateStatus;
  actorType: "USER";
  actorUserRef: string;
  inventoryConfirmationRef: string | null;
  customerAcceptanceRef: string | null;
  acceptedExceptionRefs: string[];
  reasonCodes: string[];
  evidenceRefs: string[];
  basisHash: string;
  recordedAt: string;
  authorityEffect: "none";
  contentHash: string;
};

export type CaioInitializationGateReceiptValidation = {
  valid: boolean;
  errors: string[];
};

const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/;

function isNonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && SHA256_PATTERN.test(value);
}

function uniqueSorted(values: readonly string[]): string[] {
  return [
    ...new Set(values.map((value) => value.trim()).filter(Boolean)),
  ].sort((left, right) => left.localeCompare(right));
}

function sameStrings(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return canonicalJson(uniqueSorted(left)) === canonicalJson(uniqueSorted(right));
}

type PreviousReceiptBinding = {
  receiptId: string;
  contentHash: string;
  sequence: number;
  resultingStatus: CaioInitializationGateStatus;
} | null;

type CommonReceiptInput = {
  workspaceRef: string;
  assessment: CaioInitializationAssessment;
  mandateRef: string;
  ceoPrincipalBindingRef: string;
  ceoPrincipalRef: string;
  actorUserRef: string;
  idempotencyKey: string;
  evidenceRefs: readonly string[];
  previousReceipt: PreviousReceiptBinding;
  recordedAt: string;
};

function commonSeed(input: CommonReceiptInput) {
  const assessmentValidation = validateCaioInitializationAssessment(
    input.assessment,
  );
  if (!assessmentValidation.valid) {
    throw new Error(
      `caio_initialization_assessment_invalid:${assessmentValidation.errors.join(",")}`,
    );
  }
  if (
    !isNonEmpty(input.workspaceRef) ||
    input.workspaceRef !== input.assessment.workspaceRef ||
    !isNonEmpty(input.mandateRef) ||
    input.mandateRef !== input.assessment.mandateRef ||
    !isNonEmpty(input.ceoPrincipalBindingRef) ||
    !isNonEmpty(input.ceoPrincipalRef) ||
    !isNonEmpty(input.actorUserRef) ||
    !isNonEmpty(input.idempotencyKey) ||
    !Number.isFinite(Date.parse(input.recordedAt))
  ) {
    throw new Error("caio_initialization_gate_receipt_input_invalid");
  }
  if (
    input.previousReceipt !== null &&
    (!isNonEmpty(input.previousReceipt.receiptId) ||
      !isSha256(input.previousReceipt.contentHash) ||
      !Number.isInteger(input.previousReceipt.sequence) ||
      input.previousReceipt.sequence < 1)
  ) {
    throw new Error("caio_initialization_gate_previous_receipt_invalid");
  }
  const sequence = (input.previousReceipt?.sequence ?? 0) + 1;
  return {
    schemaVersion: CAIO_INITIALIZATION_GATE_RECEIPT_SCHEMA_VERSION,
    workspaceRef: input.workspaceRef.trim(),
    assessmentRef: input.assessment.assessmentId,
    assessmentHash: input.assessment.contentHash,
    mandateRef: input.mandateRef.trim(),
    ceoPrincipalBindingRef: input.ceoPrincipalBindingRef.trim(),
    ceoPrincipalRef: input.ceoPrincipalRef.trim(),
    previousReceiptRef: input.previousReceipt?.receiptId ?? null,
    previousReceiptHash: input.previousReceipt?.contentHash ?? null,
    sequence,
    idempotencyKey: input.idempotencyKey.trim(),
    actorType: "USER" as const,
    actorUserRef: input.actorUserRef.trim(),
    evidenceRefs: uniqueSorted(input.evidenceRefs),
    basisHash: input.assessment.basisHash,
    recordedAt: input.recordedAt,
    authorityEffect: "none" as const,
  };
}

function finalizeReceipt(
  seed: Omit<CaioInitializationGateReceipt, "receiptId" | "contentHash">,
): CaioInitializationGateReceipt {
  const seedHash = sha256(canonicalJson(seed));
  const content = {
    ...seed,
    receiptId: `caio-g0-gate:${seedHash.slice(7, 31)}`,
  };
  return {
    ...content,
    contentHash: sha256(canonicalJson(content)),
  };
}

export function createCaioInitializationAcceptanceReceipt(
  input: CommonReceiptInput & {
    inventoryConfirmationRef: string;
    customerAcceptanceRef: string;
    acceptedExceptionRefs: readonly string[];
    reasonCodes: readonly string[];
  },
): CaioInitializationGateReceipt {
  const common = commonSeed(input);
  if (input.assessment.decision !== "ready_for_owner_acceptance") {
    throw new Error("caio_initialization_assessment_not_ready");
  }
  if (
    input.previousReceipt !== null &&
    input.previousReceipt.resultingStatus !== "revoked"
  ) {
    throw new Error("caio_initialization_gate_already_accepted");
  }
  if (
    !isNonEmpty(input.inventoryConfirmationRef) ||
    !isNonEmpty(input.customerAcceptanceRef) ||
    uniqueSorted(input.reasonCodes).length === 0 ||
    uniqueSorted(input.evidenceRefs).length === 0
  ) {
    throw new Error("caio_initialization_acceptance_evidence_required");
  }
  if (
    !sameStrings(
      input.acceptedExceptionRefs,
      input.assessment.exceptionRefs,
    )
  ) {
    throw new Error("caio_initialization_exception_acknowledgement_mismatch");
  }
  return finalizeReceipt({
    ...common,
    action: "accept",
    resultingStatus: "accepted",
    inventoryConfirmationRef: input.inventoryConfirmationRef.trim(),
    customerAcceptanceRef: input.customerAcceptanceRef.trim(),
    acceptedExceptionRefs: uniqueSorted(input.acceptedExceptionRefs),
    reasonCodes: uniqueSorted(input.reasonCodes),
  });
}

export function createCaioInitializationRevocationReceipt(
  input: CommonReceiptInput & {
    acceptedExceptionRefs: readonly string[];
    reasonCodes: readonly string[];
  },
): CaioInitializationGateReceipt {
  const common = commonSeed(input);
  if (
    input.previousReceipt === null ||
    input.previousReceipt.resultingStatus !== "accepted"
  ) {
    throw new Error("caio_initialization_gate_not_accepted");
  }
  if (
    uniqueSorted(input.reasonCodes).length === 0 ||
    uniqueSorted(input.evidenceRefs).length === 0
  ) {
    throw new Error("caio_initialization_revocation_evidence_required");
  }
  return finalizeReceipt({
    ...common,
    action: "revoke",
    resultingStatus: "revoked",
    inventoryConfirmationRef: null,
    customerAcceptanceRef: null,
    acceptedExceptionRefs: uniqueSorted(input.acceptedExceptionRefs),
    reasonCodes: uniqueSorted(input.reasonCodes),
  });
}

export function validateCaioInitializationGateReceipt(
  receipt: CaioInitializationGateReceipt,
): CaioInitializationGateReceiptValidation {
  const errors: string[] = [];
  if (
    receipt.schemaVersion !==
    CAIO_INITIALIZATION_GATE_RECEIPT_SCHEMA_VERSION
  ) {
    errors.push("gate_receipt_schema_version_invalid");
  }
  if (
    !isNonEmpty(receipt.receiptId) ||
    !isNonEmpty(receipt.workspaceRef) ||
    !isNonEmpty(receipt.assessmentRef) ||
    !isSha256(receipt.assessmentHash) ||
    !isNonEmpty(receipt.mandateRef) ||
    !isNonEmpty(receipt.ceoPrincipalBindingRef) ||
    !isNonEmpty(receipt.ceoPrincipalRef) ||
    !isNonEmpty(receipt.actorUserRef) ||
    !isNonEmpty(receipt.idempotencyKey) ||
    !isSha256(receipt.basisHash) ||
    !Number.isFinite(Date.parse(receipt.recordedAt))
  ) {
    errors.push("gate_receipt_required_field_invalid");
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
    errors.push("gate_receipt_chain_binding_invalid");
  }
  if (
    receipt.actorType !== "USER" ||
    receipt.authorityEffect !== "none"
  ) {
    errors.push("gate_receipt_governance_boundary_invalid");
  }
  if (
    receipt.action === "accept" &&
    (receipt.resultingStatus !== "accepted" ||
      !isNonEmpty(receipt.inventoryConfirmationRef) ||
      !isNonEmpty(receipt.customerAcceptanceRef))
  ) {
    errors.push("gate_acceptance_shape_invalid");
  }
  if (
    receipt.action === "revoke" &&
    (receipt.resultingStatus !== "revoked" ||
      receipt.inventoryConfirmationRef !== null ||
      receipt.customerAcceptanceRef !== null)
  ) {
    errors.push("gate_revocation_shape_invalid");
  }
  if (
    uniqueSorted(receipt.reasonCodes).length === 0 ||
    uniqueSorted(receipt.evidenceRefs).length === 0
  ) {
    errors.push("gate_receipt_evidence_required");
  }
  const { contentHash: _contentHash, ...content } = receipt;
  if (receipt.contentHash !== sha256(canonicalJson(content))) {
    errors.push("gate_receipt_content_hash_mismatch");
  }
  return { valid: errors.length === 0, errors: [...new Set(errors)] };
}
