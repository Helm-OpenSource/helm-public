import { describe, expect, it } from "vitest";

import {
  CAIO_INITIALIZATION_ASSESSMENT_SCHEMA_VERSION,
  computeCaioInitializationAssessment,
} from "./caio-initialization-gate";
import {
  createCaioInitializationAcceptanceReceipt,
  createCaioInitializationRevocationReceipt,
  validateCaioInitializationGateReceipt,
} from "./caio-initialization-gate-receipt";

const HASH_A = `sha256:${"a".repeat(64)}`;
const HASH_B = `sha256:${"b".repeat(64)}`;
const HASH_C = `sha256:${"c".repeat(64)}`;

function readyAssessment() {
  return computeCaioInitializationAssessment({
    schemaVersion: CAIO_INITIALIZATION_ASSESSMENT_SCHEMA_VERSION,
    workspaceRef: "workspace:synthetic",
    mandateRef: "mandate:synthetic",
    evaluatedAt: "2026-07-23T08:00:00.000Z",
    assets: [
      {
        assetRef: "asset:crm",
        inventoryStatus: "inventoried",
        classificationStatus: "classified",
        sensitivity: "confidential",
        processingDisposition: "local_only",
        authorizationStatus: "authorized",
        authorizationReceiptRef: "receipt:authorization:crm",
        technicalFeasibility: "feasible",
        connectionStatus: "connected",
        connectionReceiptRef: "receipt:connection:crm",
        initializationStatus: "initialized",
        initializationReceiptRef: "receipt:initialization:crm",
        observationRunRefs: ["run:crm"],
        schemaMappingRefs: ["artifact:schema-map:crm"],
        companyMemoryBindings: [
          { ref: "memory-fact:crm", contentHash: HASH_A },
        ],
        temporalContextSnapshotRef: "artifact:context:enterprise",
        exception: null,
      },
    ],
    sources: [
      {
        sourceRef: "source:crm",
        assetRef: "asset:crm",
        compatibilityMode: false,
        sourceStatus: "active",
        accessMode: "read_only_api",
        latestRunRef: "run:crm",
        latestRunStatus: "succeeded",
        latestRunOutcome: "success",
        freshness: "fresh",
        exception: null,
      },
    ],
    evidenceTraces: [
      {
        evidenceRef: "evidence:owner-answer:crm",
        sourceRef: "source:crm",
        assetRef: "asset:crm",
        observationRunRef: "run:crm",
        authorizationReceiptRef: "receipt:authorization:crm",
        connectionReceiptRef: "receipt:connection:crm",
        initializationReceiptRef: "receipt:initialization:crm",
        sensitivity: "confidential",
        outputType: "owner_answer",
        capturedAt: "2026-07-23T07:00:00.000Z",
        resolved: true,
        traceHash: HASH_A,
      },
    ],
    knowledge: {
      memoryRebuildReceiptRef: "receipt:memory-rebuild:enterprise",
      memoryRootHash: HASH_A,
      temporalContextArtifactRef: "artifact:context:enterprise",
      temporalContextInputHash: HASH_B,
      temporalContextSnapshotHash: HASH_C,
      temporalContextReplayRootHash: HASH_A,
      temporalContextReplayValid: true,
    },
    registeredWritePathCount: 0,
  });
}

function acceptanceInput() {
  return {
    workspaceRef: "workspace:synthetic",
    assessment: readyAssessment(),
    mandateRef: "mandate:synthetic",
    ceoPrincipalBindingRef: "binding:ceo:synthetic",
    ceoPrincipalRef: "ceo-synthetic",
    actorUserRef: "user:ceo",
    idempotencyKey: "accept:synthetic:v1",
    evidenceRefs: ["evidence:ceo-review:synthetic"],
    previousReceipt: null,
    recordedAt: "2026-07-23T09:00:00.000Z",
    inventoryConfirmationRef: "confirmation:inventory:synthetic",
    customerAcceptanceRef: "acceptance:ceo:synthetic",
    acceptedExceptionRefs: [],
    reasonCodes: ["owner_scope_confirmed"],
  } as const;
}

describe("CAIO initialization CEO gate receipt", () => {
  it("creates a hash-bound first acceptance without granting authority", () => {
    const receipt = createCaioInitializationAcceptanceReceipt(
      acceptanceInput(),
    );

    expect(receipt.action).toBe("accept");
    expect(receipt.resultingStatus).toBe("accepted");
    expect(receipt.sequence).toBe(1);
    expect(receipt.previousReceiptRef).toBeNull();
    expect(receipt.authorityEffect).toBe("none");
    expect(validateCaioInitializationGateReceipt(receipt)).toEqual({
      valid: true,
      errors: [],
    });
  });

  it("rejects machine-not-ready assessments", () => {
    const input = acceptanceInput();
    input.assessment = {
      ...input.assessment,
      decision: "not_ready",
      failures: ["asset_catalog_empty"],
    };

    expect(() =>
      createCaioInitializationAcceptanceReceipt(input),
    ).toThrow("caio_initialization_assessment_invalid");
  });

  it("requires the CEO to acknowledge the complete exception set", () => {
    const input = acceptanceInput();
    input.assessment = {
      ...input.assessment,
      exceptionRefs: ["exception:source:erp"],
    };

    expect(() =>
      createCaioInitializationAcceptanceReceipt(input),
    ).toThrow("caio_initialization_assessment_invalid");
  });

  it("chains revocation to the accepted receipt and retains no authority", () => {
    const accepted = createCaioInitializationAcceptanceReceipt(
      acceptanceInput(),
    );
    const revoked = createCaioInitializationRevocationReceipt({
      ...acceptanceInput(),
      idempotencyKey: "revoke:synthetic:v1",
      previousReceipt: {
        receiptId: accepted.receiptId,
        contentHash: accepted.contentHash,
        sequence: accepted.sequence,
        resultingStatus: accepted.resultingStatus,
        assessmentRef: accepted.assessmentRef,
        recordedAt: accepted.recordedAt,
      },
      acceptedExceptionRefs: accepted.acceptedExceptionRefs,
      reasonCodes: ["owner_revoked_initialization_acceptance"],
      evidenceRefs: ["evidence:ceo-revocation:synthetic"],
      recordedAt: "2026-07-23T10:00:00.000Z",
    });

    expect(revoked.sequence).toBe(2);
    expect(revoked.previousReceiptRef).toBe(accepted.receiptId);
    expect(revoked.previousReceiptHash).toBe(accepted.contentHash);
    expect(revoked.resultingStatus).toBe("revoked");
    expect(revoked.authorityEffect).toBe("none");
    expect(validateCaioInitializationGateReceipt(revoked).valid).toBe(true);
  });

  it("does not accept twice without an intervening revocation", () => {
    const accepted = createCaioInitializationAcceptanceReceipt(
      acceptanceInput(),
    );

    expect(() =>
      createCaioInitializationAcceptanceReceipt({
        ...acceptanceInput(),
        previousReceipt: {
          receiptId: accepted.receiptId,
          contentHash: accepted.contentHash,
          sequence: accepted.sequence,
          resultingStatus: "accepted",
          assessmentRef: accepted.assessmentRef,
          recordedAt: accepted.recordedAt,
        },
      }),
    ).toThrow("caio_initialization_gate_already_accepted");
  });

  it("treats revocation as terminal for the same assessment version", () => {
    const accepted = createCaioInitializationAcceptanceReceipt(
      acceptanceInput(),
    );
    const revoked = createCaioInitializationRevocationReceipt({
      ...acceptanceInput(),
      idempotencyKey: "revoke:synthetic:v1",
      previousReceipt: {
        receiptId: accepted.receiptId,
        contentHash: accepted.contentHash,
        sequence: accepted.sequence,
        resultingStatus: accepted.resultingStatus,
        assessmentRef: accepted.assessmentRef,
        recordedAt: accepted.recordedAt,
      },
      acceptedExceptionRefs: accepted.acceptedExceptionRefs,
      reasonCodes: ["owner_revoked_initialization_acceptance"],
      evidenceRefs: ["evidence:ceo-revocation:synthetic"],
      recordedAt: "2026-07-23T10:00:00.000Z",
    });

    expect(() =>
      createCaioInitializationAcceptanceReceipt({
        ...acceptanceInput(),
        idempotencyKey: "accept:synthetic:v2",
        previousReceipt: {
          receiptId: revoked.receiptId,
          contentHash: revoked.contentHash,
          sequence: revoked.sequence,
          resultingStatus: revoked.resultingStatus,
          assessmentRef: revoked.assessmentRef,
          recordedAt: revoked.recordedAt,
        },
        recordedAt: "2026-07-23T11:00:00.000Z",
      }),
    ).toThrow(
      "caio_initialization_revoked_assessment_requires_newer_reassessment",
    );
  });

  it("detects receipt tampering", () => {
    const receipt = createCaioInitializationAcceptanceReceipt(
      acceptanceInput(),
    );

    expect(
      validateCaioInitializationGateReceipt({
        ...receipt,
        customerAcceptanceRef: "acceptance:tampered",
      }).errors,
    ).toContain("gate_receipt_content_hash_mismatch");
  });
});
