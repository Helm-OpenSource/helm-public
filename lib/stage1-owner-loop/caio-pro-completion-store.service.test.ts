import {
  MembershipStatus,
  WorkspaceRole,
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock, auditMock, policyAccessMock } = vi.hoisted(() => {
  const client = {
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
    membership: { findUnique: vi.fn() },
    dataAssetCatalogEntry: { findMany: vi.fn() },
    dataAssetStageReceipt: { findMany: vi.fn() },
    observationSource: { findMany: vi.fn() },
    observationSourceRun: { findMany: vi.fn() },
    memoryFact: { findMany: vi.fn(), findFirst: vi.fn() },
    artifactBundle: { findMany: vi.fn() },
    caioActiveMandateClaim: { findFirst: vi.fn() },
    caioGuardianStopRecord: { count: vi.fn() },
    caioPrincipalBinding: { findFirst: vi.fn() },
    caioInitializationGateHead: { findUnique: vi.fn() },
    caioInitializationGateReceipt: { findFirst: vi.fn() },
    caioInitializationAssessment: { findFirst: vi.fn() },
    caioOperatingQuestionPortfolioHead: { findUnique: vi.fn() },
    caioOperatingQuestionPortfolio: { findFirst: vi.fn() },
    caioQuestionSelectionHead: { findUnique: vi.fn() },
    caioQuestionSelectionReceipt: { findFirst: vi.fn() },
    caioOperatingQuestionDecisionBinding: { findUnique: vi.fn() },
    caioOperatingQuestionImplementationPlan: { findFirst: vi.fn() },
    decisionRecord: { findFirst: vi.fn() },
    decisionWorkPacketClaim: { findUnique: vi.fn() },
    executionReceipt: { findUnique: vi.fn() },
    caioProV1EvidenceAttestation: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    caioQuestionValueReceipt: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    caioProV1RetrospectiveReceipt: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    caioProV1CompletionAssessment: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    caioProV1CompletionGateReceipt: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    caioProV1CompletionGateHead: {
      findUnique: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
  };
  return {
    dbMock: client,
    auditMock: { writeAuditLog: vi.fn() },
    policyAccessMock: { assertWorkspacePolicyServiceAccess: vi.fn() },
  };
});

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/audit", () => ({
  writeAuditLog: auditMock.writeAuditLog,
}));
vi.mock("@/lib/auth/service-governance", () => ({
  assertWorkspacePolicyServiceAccess:
    policyAccessMock.assertWorkspacePolicyServiceAccess,
}));

import {
  acceptCaioProV1CompletionGate,
  CaioProCompletionStoreError,
  getCaioProV1CompletionStatus,
  recordCaioProV1CompletionAssessment,
  recordCaioProV1EvidenceAttestation,
  recordCaioQuestionValueReceipt,
} from "./caio-pro-completion-store.service";
import { computeCaioProV1CompletionAssessment } from "./caio-pro-completion";
import {
  syntheticCaioProV1CompletionInput,
  syntheticCaioQuestionValueReceiptInput,
} from "./caio-pro-completion.test-fixtures";

const NOW = new Date("2026-07-26T08:00:00.000Z");
// Matches the synthetic fixture workspaceRef ("workspace:<id>").
const WORKSPACE_ID = "synthetic-caio-completion";

function armDefaultMocks(): void {
  policyAccessMock.assertWorkspacePolicyServiceAccess.mockResolvedValue(
    undefined,
  );
  auditMock.writeAuditLog.mockResolvedValue(undefined);
  dbMock.$transaction.mockImplementation(
    async (callback: (tx: typeof dbMock) => Promise<unknown>) =>
      callback(dbMock),
  );
  dbMock.$queryRaw.mockImplementation(
    async (strings: TemplateStringsArray) => {
      const query = strings.join("");
      if (query.includes("CaioProV1CompletionGateHead")) return [];
      return [{ id: WORKSPACE_ID }];
    },
  );
  dbMock.membership.findUnique.mockResolvedValue({
    role: WorkspaceRole.OWNER,
    status: MembershipStatus.ACTIVE,
  });
  // Empty live-evidence projection by default.
  dbMock.dataAssetCatalogEntry.findMany.mockResolvedValue([]);
  dbMock.dataAssetStageReceipt.findMany.mockResolvedValue([]);
  dbMock.observationSource.findMany.mockResolvedValue([]);
  dbMock.observationSourceRun.findMany.mockResolvedValue([]);
  dbMock.memoryFact.findMany.mockResolvedValue([]);
  dbMock.artifactBundle.findMany.mockResolvedValue([]);
  dbMock.caioActiveMandateClaim.findFirst.mockResolvedValue(null);
  dbMock.caioInitializationGateHead.findUnique.mockResolvedValue(null);
  dbMock.caioOperatingQuestionPortfolioHead.findUnique.mockResolvedValue(
    null,
  );
  dbMock.caioQuestionSelectionHead.findUnique.mockResolvedValue(null);
  dbMock.caioProV1EvidenceAttestation.findUnique.mockResolvedValue(null);
  dbMock.caioProV1EvidenceAttestation.findFirst.mockResolvedValue(null);
  dbMock.caioProV1EvidenceAttestation.findMany.mockResolvedValue([]);
  dbMock.caioProV1EvidenceAttestation.create.mockImplementation(
    async (args: { data: Record<string, unknown> }) => args.data,
  );
  dbMock.caioQuestionValueReceipt.findUnique.mockResolvedValue(null);
  dbMock.caioQuestionValueReceipt.findFirst.mockResolvedValue(null);
  dbMock.caioQuestionValueReceipt.findMany.mockResolvedValue([]);
  dbMock.caioQuestionValueReceipt.create.mockImplementation(
    async (args: { data: Record<string, unknown> }) => args.data,
  );
  dbMock.caioProV1RetrospectiveReceipt.findUnique.mockResolvedValue(null);
  dbMock.caioProV1RetrospectiveReceipt.findFirst.mockResolvedValue(null);
  dbMock.caioProV1CompletionAssessment.findUnique.mockResolvedValue(null);
  dbMock.caioProV1CompletionAssessment.findFirst.mockResolvedValue(null);
  dbMock.caioProV1CompletionAssessment.create.mockImplementation(
    async (args: { data: Record<string, unknown> }) => args.data,
  );
  dbMock.caioProV1CompletionGateReceipt.findUnique.mockResolvedValue(null);
  dbMock.caioProV1CompletionGateReceipt.findFirst.mockResolvedValue(null);
  dbMock.caioProV1CompletionGateHead.findUnique.mockResolvedValue(null);
  dbMock.caioPrincipalBinding.findFirst.mockResolvedValue({
    id: "binding-1",
    workspaceId: WORKSPACE_ID,
    userId: "owner-1",
    principalRef: "ceo-1",
    principalKind: "ceo",
    revokedAt: null,
  });
}

function selectionContextMocks(): void {
  dbMock.caioQuestionSelectionHead.findUnique.mockResolvedValue({
    workspaceId: WORKSPACE_ID,
    currentPortfolioId: "portfolio-1",
    currentGateReceiptId: "gate-1",
    currentReceiptId: "selection-1",
    sequence: 1,
    version: 1,
  });
  dbMock.caioQuestionSelectionReceipt.findFirst.mockResolvedValue({
    id: "selection-1",
    workspaceId: WORKSPACE_ID,
    portfolioId: "portfolio-1",
    selectedQuestionIds: JSON.stringify(["question-1", "question-2"]),
    receiptJson: JSON.stringify({ portfolioHash: "sha256:portfolio" }),
  });
  dbMock.caioOperatingQuestionPortfolio.findFirst.mockResolvedValue({
    id: "portfolio-1",
    contentHash: "sha256:portfolio",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  armDefaultMocks();
});

describe("recordCaioProV1EvidenceAttestation", () => {
  const baseInput = {
    workspaceId: WORKSPACE_ID,
    actorUserId: "owner-1",
    ceoPrincipalRef: "ceo-1",
    itemKey: "p3_device_security_accepted" as const,
    statement: "Synthetic device security acceptance walkthrough completed",
    evidenceRefs: ["evidence:device-security"],
    idempotencyKey: "attest-1",
    now: NOW,
  };

  it("refuses derivable item keys fail-closed", async () => {
    await expect(
      recordCaioProV1EvidenceAttestation({
        ...baseInput,
        itemKey: "p5_g0_accepted" as never,
      }),
    ).rejects.toThrow("attestation_item_key_not_attestable");
  });

  it("requires a live CEO principal binding", async () => {
    dbMock.caioPrincipalBinding.findFirst.mockResolvedValue(null);
    await expect(
      recordCaioProV1EvidenceAttestation(baseInput),
    ).rejects.toThrow("live_ceo_principal_binding_required");
  });

  it("records an attestation with an in-transaction audit row", async () => {
    const result = await recordCaioProV1EvidenceAttestation(baseInput);
    expect(result.replayed).toBe(false);
    expect(result.attestation.itemKey).toBe("p3_device_security_accepted");
    expect(result.attestation.version).toBe(1);
    expect(result.attestation.authorityEffect).toBe("none");
    expect(dbMock.caioProV1EvidenceAttestation.create).toHaveBeenCalledTimes(
      1,
    );
    expect(auditMock.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "CAIO_PRO_V1_EVIDENCE_ATTESTED",
      }),
      { client: dbMock },
    );
  });

  it("supersedes by version instead of mutating earlier attestations", async () => {
    dbMock.caioProV1EvidenceAttestation.findFirst.mockResolvedValue({
      version: 3,
    });
    const result = await recordCaioProV1EvidenceAttestation(baseInput);
    expect(result.attestation.version).toBe(4);
  });

  it("replays an identical payload and refuses a divergent one", async () => {
    const first = await recordCaioProV1EvidenceAttestation(baseInput);
    const createdData = dbMock.caioProV1EvidenceAttestation.create.mock
      .calls[0][0].data as Record<string, unknown>;
    dbMock.caioProV1EvidenceAttestation.findUnique.mockResolvedValue({
      ...createdData,
      recordedAt: NOW,
      createdAt: NOW,
    });
    const replay = await recordCaioProV1EvidenceAttestation(baseInput);
    expect(replay.replayed).toBe(true);
    expect(replay.attestation.contentHash).toBe(
      first.attestation.contentHash,
    );
    await expect(
      recordCaioProV1EvidenceAttestation({
        ...baseInput,
        statement: "A divergent statement under the same key",
      }),
    ).rejects.toThrow("idempotency_key_payload_conflict");
  });

  it("never echoes attestation content in error messages", async () => {
    dbMock.caioProV1EvidenceAttestation.findUnique.mockResolvedValue({
      requestHash: "sha256:different",
    });
    const error = await recordCaioProV1EvidenceAttestation(baseInput).catch(
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(CaioProCompletionStoreError);
    expect((error as Error).message).not.toContain(baseInput.statement);
  });
});

describe("recordCaioQuestionValueReceipt", () => {
  const baseInput = {
    workspaceId: WORKSPACE_ID,
    actorUserId: "owner-1",
    payload: (() => {
      const {
        workspaceRef: _workspaceRef,
        selectionReceiptRef: _selectionReceiptRef,
        recordedAt: _recordedAt,
        ...payload
      } = syntheticCaioQuestionValueReceiptInput("question-1");
      return payload;
    })(),
    idempotencyKey: "value-1",
    now: NOW,
  };

  it("requires a current CEO selection", async () => {
    await expect(recordCaioQuestionValueReceipt(baseInput)).rejects.toThrow(
      "current_question_selection_required",
    );
  });

  it("refuses questions outside the current selection", async () => {
    selectionContextMocks();
    await expect(
      recordCaioQuestionValueReceipt({
        ...baseInput,
        payload: { ...baseInput.payload, questionId: "question-99" },
      }),
    ).rejects.toThrow("question_not_in_current_selection");
  });

  it("records a receipt bound to the current selection", async () => {
    selectionContextMocks();
    const result = await recordCaioQuestionValueReceipt(baseInput);
    expect(result.replayed).toBe(false);
    expect(result.receipt.selectionReceiptRef).toBe("selection-1");
    expect(result.receipt.workspaceRef).toBe(`workspace:${WORKSPACE_ID}`);
    expect(auditMock.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "CAIO_QUESTION_VALUE_RECEIPT_RECORDED",
      }),
      { client: dbMock },
    );
  });

  it("refuses forbidden value bases through the contract layer", async () => {
    selectionContextMocks();
    await expect(
      recordCaioQuestionValueReceipt({
        ...baseInput,
        payload: {
          ...baseInput.payload,
          metricDefinitions: [
            {
              metricKey: "token-usage",
              definition: "tokens consumed per month",
              dataSourceRefs: ["evidence:tokens"],
            },
          ],
        },
      }),
    ).rejects.toThrow("value_receipt_forbidden_value_basis:token_usage");
  });
});

describe("recordCaioProV1CompletionAssessment", () => {
  it("derives a not_ready assessment from empty live evidence", async () => {
    const result = await recordCaioProV1CompletionAssessment({
      workspaceId: WORKSPACE_ID,
      actorUserId: "owner-1",
      evaluationKey: "completion-eval-1",
      now: NOW,
    });
    expect(result.replayed).toBe(false);
    expect(result.assessment.decision).toBe("not_ready");
    expect(result.assessment.missingItemKeys.length).toBeGreaterThan(0);
    expect(result.assessment.fullFunctionOperation).toBe(
      "not_authorized_by_this_receipt",
    );
    expect(dbMock.caioProV1CompletionAssessment.create).toHaveBeenCalledTimes(
      1,
    );
  });

  it("replays a stored assessment by evaluation key", async () => {
    const stored = computeCaioProV1CompletionAssessment(
      syntheticCaioProV1CompletionInput(),
    );
    dbMock.caioProV1CompletionAssessment.findUnique.mockResolvedValue({
      id: stored.assessmentId,
      workspaceId: WORKSPACE_ID,
      evaluationKey: "completion-eval-1",
      schemaVersion: stored.schemaVersion,
      evaluatorRevision: stored.evaluatorRevision,
      basisHash: stored.basisHash,
      decision: stored.decision.toUpperCase(),
      inputJson: JSON.stringify({
        input: syntheticCaioProV1CompletionInput(),
      }),
      assessmentJson: JSON.stringify(stored),
      contentHash: stored.contentHash,
      authorityEffect: stored.authorityEffect,
      evaluatedAt: new Date(stored.evaluatedAt),
      createdAt: NOW,
    });
    const result = await recordCaioProV1CompletionAssessment({
      workspaceId: WORKSPACE_ID,
      actorUserId: "owner-1",
      evaluationKey: "completion-eval-1",
      now: NOW,
    });
    expect(result.replayed).toBe(true);
    expect(result.assessment.contentHash).toBe(stored.contentHash);
    expect(
      dbMock.caioProV1CompletionAssessment.create,
    ).not.toHaveBeenCalled();
  });
});

describe("acceptCaioProV1CompletionGate", () => {
  it("refuses acceptance when the live evidence no longer supports the stored assessment", async () => {
    const stored = computeCaioProV1CompletionAssessment(
      syntheticCaioProV1CompletionInput(),
    );
    dbMock.caioProV1CompletionAssessment.findFirst.mockResolvedValue({
      id: stored.assessmentId,
      workspaceId: WORKSPACE_ID,
      evaluationKey: "completion-eval-1",
      schemaVersion: stored.schemaVersion,
      evaluatorRevision: stored.evaluatorRevision,
      basisHash: stored.basisHash,
      decision: stored.decision.toUpperCase(),
      inputJson: JSON.stringify({
        input: syntheticCaioProV1CompletionInput(),
      }),
      assessmentJson: JSON.stringify(stored),
      contentHash: stored.contentHash,
      authorityEffect: stored.authorityEffect,
      evaluatedAt: new Date(stored.evaluatedAt),
      createdAt: NOW,
    });
    // The live projection is empty, so the recomputed assessment is
    // not_ready and cannot match the stored ready basis.
    await expect(
      acceptCaioProV1CompletionGate({
        workspaceId: WORKSPACE_ID,
        actorUserId: "owner-1",
        ceoPrincipalRef: "ceo-1",
        assessmentId: stored.assessmentId,
        idempotencyKey: "accept-1",
        reasonCodes: ["site_deployment_reviewed"],
        evidenceRefs: ["evidence:acceptance"],
        now: NOW,
      }),
    ).rejects.toThrow("completion_assessment_stale_reassessment_required");
    expect(dbMock.caioProV1CompletionGateReceipt.create).not.toHaveBeenCalled();
    expect(dbMock.caioProV1CompletionGateHead.create).not.toHaveBeenCalled();
  });

  it("refuses acceptance of an unknown assessment", async () => {
    await expect(
      acceptCaioProV1CompletionGate({
        workspaceId: WORKSPACE_ID,
        actorUserId: "owner-1",
        ceoPrincipalRef: "ceo-1",
        assessmentId: "missing-assessment",
        idempotencyKey: "accept-1",
        reasonCodes: ["site_deployment_reviewed"],
        evidenceRefs: ["evidence:acceptance"],
        now: NOW,
      }),
    ).rejects.toThrow("completion_assessment_not_found");
  });
});

describe("getCaioProV1CompletionStatus", () => {
  it("reports not_ready with the full TODO list before any evidence exists", async () => {
    const status = await getCaioProV1CompletionStatus({
      workspaceId: WORKSPACE_ID,
      actorUserId: "owner-1",
      now: NOW,
    });
    expect(status.state).toBe("not_ready");
    expect(status.receipt).toBeNull();
    expect(status.items).toHaveLength(13);
    expect(status.missingItemKeys).toContain("p4_asset_inventory_confirmed");
    expect(status.missingItemKeys).toContain("p5_g0_accepted");
    expect(status.missingItemKeys).toContain("p8_retrospective_recorded");
  });
});
