import "server-only";

// CAIO Pro V1 site-deployment completion gate store. This service persists
// the governed P4-P8 TODO checklist evidence (value receipts, retrospective,
// owner attestations), derives the database-derivable checklist items LIVE
// inside one SERIALIZABLE transaction, and mirrors the G0 gate ledger for
// CEO acceptance and revocation. Everything here is a governance RECORD:
// an accepted completion gate authorizes nothing — full-function operation
// is a separate owner action outside this module.

import {
  ActorType,
  ExecutionReceiptSubjectType,
  ExecutionReceiptVerificationState,
  MembershipStatus,
  MemoryStatus,
  Prisma,
} from "@prisma/client";
import type {
  CaioProV1CompletionGateReceipt as StoredCompletionGateReceiptRow,
  CaioProV1CompletionAssessment as StoredCompletionAssessmentRow,
  CaioProV1EvidenceAttestation as StoredAttestationRow,
  CaioProV1RetrospectiveReceipt as StoredRetrospectiveRow,
  CaioQuestionValueReceipt as StoredValueReceiptRow,
} from "@prisma/client";

import { writeAuditLog } from "@/lib/audit";
import {
  WORKSPACE_CAPABILITIES,
  workspaceRoleHasCapability,
} from "@/lib/auth/authorization";
import { assertWorkspacePolicyServiceAccess } from "@/lib/auth/service-governance";
import { db } from "@/lib/db";
import { runWithWriteConflictRetry } from "@/lib/db/conflict-aware-write";
import { canonicalJson, sha256 } from "@/lib/expert-capability/hashing";
import { jsonStringify, safeParseJson } from "@/lib/utils";

import { projectCaioInitializationAssessmentInput } from "./caio-initialization-assessment-projector";
import { computeCaioInitializationAssessment } from "./caio-initialization-gate";
import {
  loadCaioInitializationProjectionSnapshot,
  loadCurrentAcceptedCaioInitializationContextForRead,
} from "./caio-initialization-gate-store.service";
import {
  CAIO_PRO_V1_ATTESTABLE_ITEMS,
  CAIO_PRO_V1_COMPLETION_ASSESSMENT_SCHEMA_VERSION,
  computeCaioProV1CompletionAssessment,
  createCaioProV1CompletionAcceptanceReceipt,
  createCaioProV1CompletionRevocationReceipt,
  createCaioProV1EvidenceAttestation,
  createCaioProV1RetrospectiveReceipt,
  createCaioQuestionValueReceipt,
  validateCaioProV1CompletionAssessment,
  validateCaioProV1CompletionGateReceipt,
  validateCaioProV1EvidenceAttestation,
  validateCaioProV1RetrospectiveReceipt,
  validateCaioQuestionValueReceipt,
  type CaioProV1AttestableItemKey,
  type CaioProV1CompletionAssessment,
  type CaioProV1CompletionAssessmentInput,
  type CaioProV1CompletionGateReceipt,
  type CaioProV1CompletionGateReceiptStatus,
  type CaioProV1CompletionGateState,
  type CaioProV1CompletionItemAssessment,
  type CaioProV1EvidenceAttestation,
  type CaioProV1RetrospectiveReceipt,
  type CaioProV1RetrospectiveReceiptInput,
  type CaioProV1SupervisionChainEvidence,
  type CaioQuestionValueReceipt,
  type CaioQuestionValueReceiptInput,
} from "./caio-pro-completion";

type Tx = Prisma.TransactionClient;

const TRANSACTION_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 10_000,
  timeout: 30_000,
} as const;

const WRITE_RETRY_OPTIONS = {
  maxAttempts: 8,
  retryDelayMs: 50,
} as const;

export class CaioProCompletionStoreError extends Error {
  readonly reasons: readonly string[];

  constructor(message: string, reasons: readonly string[] = []) {
    super(reasons.length > 0 ? `${message}: ${reasons.join("; ")}` : message);
    this.name = "CaioProCompletionStoreError";
    this.reasons = reasons;
  }
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === "P2002"
  );
}

function nonEmpty(value: string, reason: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new CaioProCompletionStoreError(reason);
  }
  return normalized;
}

function uniqueSorted(values: readonly string[]): string[] {
  return [
    ...new Set(values.map((value) => value.trim()).filter(Boolean)),
  ].sort((left, right) => left.localeCompare(right));
}

function parseStrictStringArray(value: string): string[] | null {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) &&
      parsed.every((item) => typeof item === "string")
      ? parsed
      : null;
  } catch {
    return null;
  }
}

function hashRequest(value: unknown): string {
  try {
    return sha256(canonicalJson(value));
  } catch {
    throw new CaioProCompletionStoreError(
      "request_payload_not_canonicalizable",
    );
  }
}

async function assertPolicyAccess(input: {
  workspaceId: string;
  actorUserId: string;
  english?: boolean;
}): Promise<void> {
  nonEmpty(input.actorUserId, "signed_in_human_actor_required");
  await assertWorkspacePolicyServiceAccess({
    workspaceId: input.workspaceId,
    userId: input.actorUserId,
    actorType: ActorType.USER,
    english: input.english ?? false,
  });
}

async function assertPolicyAccessInTransaction(
  tx: Tx,
  input: {
    workspaceId: string;
    actorUserId: string;
  },
): Promise<void> {
  const membership = await tx.membership.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: input.workspaceId,
        userId: input.actorUserId,
      },
    },
    select: {
      role: true,
      status: true,
    },
  });
  if (
    !membership ||
    membership.status === MembershipStatus.INACTIVE ||
    !workspaceRoleHasCapability(
      membership.role,
      WORKSPACE_CAPABILITIES.MANAGE_POLICIES,
    )
  ) {
    throw new CaioProCompletionStoreError("workspace_policy_access_lost");
  }
}

// One workspace lock serializes completion-ledger transitions; SERIALIZABLE
// isolation makes concurrent evidence writes conflict instead of letting an
// acceptance commit against a mixed before/after snapshot.
async function lockWorkspace(tx: Tx, workspaceId: string): Promise<void> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM Workspace WHERE id = ${workspaceId} FOR UPDATE`;
  if (rows.length !== 1) {
    throw new CaioProCompletionStoreError("workspace_not_found");
  }
}

// FDE seam: a bound field deployment engineer may RECORD evidence on the
// CEO's behalf (installation, maintenance, upgrade and P4-P8 follow-
// through). Acceptance and revocation stay CEO-only — recording is
// delegable, signing is not.
async function assertLiveFdeBinding(
  tx: Tx,
  input: {
    workspaceId: string;
    actorUserId: string;
    fdePrincipalRef: string;
  },
) {
  const binding = await tx.caioPrincipalBinding.findFirst({
    where: {
      workspaceId: input.workspaceId,
      userId: input.actorUserId,
      principalRef: input.fdePrincipalRef,
      principalKind: "fde",
      revokedAt: null,
    },
  });
  if (!binding) {
    throw new CaioProCompletionStoreError(
      "live_fde_principal_binding_required",
    );
  }
  return binding;
}

// The accountable CEO SEAT must exist (a live ceo binding row for the
// given principal ref, whoever holds it) even when an FDE records.
async function requireLiveCeoSeat(
  tx: Tx,
  input: { workspaceId: string; ceoPrincipalRef: string },
) {
  const seat = await tx.caioPrincipalBinding.findFirst({
    where: {
      workspaceId: input.workspaceId,
      principalRef: input.ceoPrincipalRef,
      principalKind: "ceo",
      revokedAt: null,
    },
  });
  if (!seat) {
    throw new CaioProCompletionStoreError(
      "live_ceo_principal_binding_required",
    );
  }
  return seat;
}

async function assertLiveCeoBinding(
  tx: Tx,
  input: {
    workspaceId: string;
    actorUserId: string;
    ceoPrincipalRef: string;
  },
) {
  const binding = await tx.caioPrincipalBinding.findFirst({
    where: {
      workspaceId: input.workspaceId,
      userId: input.actorUserId,
      principalRef: input.ceoPrincipalRef,
      principalKind: "ceo",
      revokedAt: null,
    },
  });
  if (!binding) {
    throw new CaioProCompletionStoreError(
      "live_ceo_principal_binding_required",
    );
  }
  return binding;
}

// ---------------------------------------------------------------------------
// Stored-row parsers (fail-closed binding verification; codes only, never
// stored content, in error messages).
// ---------------------------------------------------------------------------

function parseStoredValueReceipt(
  row: StoredValueReceiptRow,
): CaioQuestionValueReceipt {
  const receipt = safeParseJson<CaioQuestionValueReceipt | null>(
    row.receiptJson,
    null,
  );
  if (!receipt) {
    throw new CaioProCompletionStoreError(
      "stored_value_receipt_json_invalid",
    );
  }
  const validation = validateCaioQuestionValueReceipt(receipt);
  if (
    !validation.valid ||
    receipt.receiptId !== row.id ||
    receipt.workspaceRef !== `workspace:${row.workspaceId}` ||
    receipt.selectionReceiptRef !== row.selectionReceiptId ||
    receipt.questionId !== row.questionId ||
    receipt.contentHash !== row.contentHash ||
    receipt.authorityEffect !== row.authorityEffect ||
    receipt.recordedAt !== row.recordedAt.toISOString()
  ) {
    throw new CaioProCompletionStoreError(
      "stored_value_receipt_binding_invalid",
      validation.errors,
    );
  }
  return receipt;
}

function parseStoredRetrospective(
  row: StoredRetrospectiveRow,
): CaioProV1RetrospectiveReceipt {
  const receipt = safeParseJson<CaioProV1RetrospectiveReceipt | null>(
    row.receiptJson,
    null,
  );
  if (!receipt) {
    throw new CaioProCompletionStoreError(
      "stored_retrospective_json_invalid",
    );
  }
  const validation = validateCaioProV1RetrospectiveReceipt(receipt);
  if (
    !validation.valid ||
    receipt.receiptId !== row.id ||
    receipt.workspaceRef !== `workspace:${row.workspaceId}` ||
    receipt.selectionReceiptRef !== row.selectionReceiptId ||
    receipt.contentHash !== row.contentHash ||
    receipt.authorityEffect !== row.authorityEffect ||
    receipt.recordedAt !== row.recordedAt.toISOString()
  ) {
    throw new CaioProCompletionStoreError(
      "stored_retrospective_binding_invalid",
      validation.errors,
    );
  }
  return receipt;
}

function parseStoredAttestation(
  row: StoredAttestationRow,
): CaioProV1EvidenceAttestation {
  const attestation = safeParseJson<CaioProV1EvidenceAttestation | null>(
    row.attestationJson,
    null,
  );
  if (!attestation) {
    throw new CaioProCompletionStoreError(
      "stored_attestation_json_invalid",
    );
  }
  const validation = validateCaioProV1EvidenceAttestation(attestation);
  const rowEvidenceRefs = parseStrictStringArray(row.evidenceRefs);
  if (
    !validation.valid ||
    !rowEvidenceRefs ||
    attestation.attestationId !== row.id ||
    attestation.workspaceRef !== `workspace:${row.workspaceId}` ||
    attestation.itemKey !== row.itemKey ||
    attestation.version !== row.version ||
    attestation.ceoPrincipalBindingRef !== row.ceoPrincipalBindingId ||
    attestation.ceoPrincipalRef !== row.ceoPrincipalRef ||
    row.actorType !== ActorType.USER ||
    attestation.actorUserRef !== row.actorUserId ||
    attestation.statement !== row.statement ||
    canonicalJson(attestation.evidenceRefs) !==
      canonicalJson(uniqueSorted(rowEvidenceRefs)) ||
    attestation.contentHash !== row.contentHash ||
    attestation.authorityEffect !== row.authorityEffect ||
    attestation.recordedAt !== row.recordedAt.toISOString()
  ) {
    throw new CaioProCompletionStoreError(
      "stored_attestation_binding_invalid",
      validation.errors,
    );
  }
  return attestation;
}

type StoredCompletionAssessmentEnvelope = {
  input: CaioProV1CompletionAssessmentInput;
};

function parseStoredCompletionAssessment(
  row: StoredCompletionAssessmentRow,
): CaioProV1CompletionAssessment {
  const assessment = safeParseJson<CaioProV1CompletionAssessment | null>(
    row.assessmentJson,
    null,
  );
  if (!assessment) {
    throw new CaioProCompletionStoreError(
      "stored_completion_assessment_json_invalid",
    );
  }
  const validation = validateCaioProV1CompletionAssessment(assessment);
  if (
    !validation.valid ||
    assessment.assessmentId !== row.id ||
    assessment.workspaceRef !== `workspace:${row.workspaceId}` ||
    assessment.schemaVersion !== row.schemaVersion ||
    assessment.evaluatorRevision !== row.evaluatorRevision ||
    assessment.basisHash !== row.basisHash ||
    assessment.decision.toUpperCase() !== row.decision ||
    assessment.contentHash !== row.contentHash ||
    assessment.authorityEffect !== row.authorityEffect ||
    assessment.evaluatedAt !== row.evaluatedAt.toISOString()
  ) {
    throw new CaioProCompletionStoreError(
      "stored_completion_assessment_binding_invalid",
      validation.errors,
    );
  }
  const envelope = safeParseJson<unknown>(row.inputJson, null);
  if (
    !envelope ||
    typeof envelope !== "object" ||
    !("input" in envelope)
  ) {
    throw new CaioProCompletionStoreError(
      "stored_completion_assessment_input_invalid",
    );
  }
  let reproduced: CaioProV1CompletionAssessment;
  try {
    reproduced = computeCaioProV1CompletionAssessment(
      (envelope as StoredCompletionAssessmentEnvelope).input,
    );
  } catch {
    throw new CaioProCompletionStoreError(
      "stored_completion_assessment_input_invalid",
    );
  }
  if (
    reproduced.assessmentId !== assessment.assessmentId ||
    reproduced.contentHash !== assessment.contentHash ||
    reproduced.basisHash !== assessment.basisHash
  ) {
    throw new CaioProCompletionStoreError(
      "stored_completion_assessment_input_binding_invalid",
    );
  }
  return assessment;
}

function parseStoredCompletionGateReceipt(
  row: StoredCompletionGateReceiptRow,
): CaioProV1CompletionGateReceipt {
  const receipt = safeParseJson<CaioProV1CompletionGateReceipt | null>(
    row.receiptJson,
    null,
  );
  if (!receipt) {
    throw new CaioProCompletionStoreError(
      "stored_completion_gate_receipt_invalid",
    );
  }
  const reasonCodes = parseStrictStringArray(row.reasonCodes);
  const evidenceRefs = parseStrictStringArray(row.evidenceRefs);
  const validation = validateCaioProV1CompletionGateReceipt(receipt);
  if (
    !validation.valid ||
    !reasonCodes ||
    !evidenceRefs ||
    receipt.receiptId !== row.id ||
    receipt.workspaceRef !== `workspace:${row.workspaceId}` ||
    receipt.assessmentRef !== row.assessmentId ||
    receipt.ceoPrincipalBindingRef !== row.ceoPrincipalBindingId ||
    receipt.previousReceiptRef !== row.previousReceiptId ||
    receipt.previousReceiptHash !== row.previousReceiptHash ||
    receipt.sequence !== row.sequence ||
    receipt.idempotencyKey !== row.idempotencyKey ||
    receipt.action.toUpperCase() !== row.action ||
    receipt.resultingStatus.toUpperCase() !== row.resultingStatus ||
    row.actorType !== ActorType.USER ||
    receipt.actorUserRef !== row.actorUserId ||
    receipt.ceoPrincipalRef !== row.ceoPrincipalRef ||
    canonicalJson(receipt.reasonCodes) !==
      canonicalJson(uniqueSorted(reasonCodes)) ||
    canonicalJson(receipt.evidenceRefs) !==
      canonicalJson(uniqueSorted(evidenceRefs)) ||
    receipt.basisHash !== row.basisHash ||
    receipt.contentHash !== row.contentHash ||
    receipt.authorityEffect !== row.authorityEffect ||
    receipt.fullFunctionOperation !== row.fullFunctionOperation ||
    receipt.recordedAt !== row.recordedAt.toISOString()
  ) {
    throw new CaioProCompletionStoreError(
      "stored_completion_gate_receipt_binding_invalid",
      validation.errors,
    );
  }
  return receipt;
}

// ---------------------------------------------------------------------------
// Current selection context.
// ---------------------------------------------------------------------------

type CurrentSelectionContext = {
  selectionReceiptId: string;
  selectedQuestionIds: string[];
  portfolioId: string;
  portfolioContentHash: string;
  portfolioHashBound: boolean;
};

async function loadCurrentSelectionContext(
  tx: Tx,
  workspaceId: string,
): Promise<CurrentSelectionContext | null> {
  const head = await tx.caioQuestionSelectionHead.findUnique({
    where: { workspaceId },
  });
  if (!head) return null;
  const [receiptRow, portfolioRow] = await Promise.all([
    tx.caioQuestionSelectionReceipt.findFirst({
      where: {
        id: head.currentReceiptId,
        workspaceId,
        portfolioId: head.currentPortfolioId,
      },
    }),
    tx.caioOperatingQuestionPortfolio.findFirst({
      where: {
        id: head.currentPortfolioId,
        workspaceId,
      },
      select: { id: true, contentHash: true },
    }),
  ]);
  if (!receiptRow || !portfolioRow) {
    throw new CaioProCompletionStoreError(
      "question_selection_head_binding_invalid",
    );
  }
  const selectedQuestionIds = parseStrictStringArray(
    receiptRow.selectedQuestionIds,
  );
  const receiptJson = safeParseJson<{ portfolioHash?: unknown } | null>(
    receiptRow.receiptJson,
    null,
  );
  if (!selectedQuestionIds || !receiptJson) {
    throw new CaioProCompletionStoreError(
      "stored_question_selection_receipt_json_invalid",
    );
  }
  return {
    selectionReceiptId: receiptRow.id,
    selectedQuestionIds: uniqueSorted(selectedQuestionIds),
    portfolioId: portfolioRow.id,
    portfolioContentHash: portfolioRow.contentHash,
    portfolioHashBound: receiptJson.portfolioHash === portfolioRow.contentHash,
  };
}

// ---------------------------------------------------------------------------
// Live evidence projection: derives every database-derivable checklist item
// inside the caller's transaction. The evaluator judges; this function only
// gathers raw evidence.
// ---------------------------------------------------------------------------

async function buildCompletionEvidenceProjection(
  tx: Tx,
  input: {
    workspaceId: string;
    now: Date;
  },
): Promise<CaioProV1CompletionAssessmentInput> {
  const { workspaceId, now } = input;

  const attestationRows = await tx.caioProV1EvidenceAttestation.findMany({
    where: { workspaceId },
    orderBy: [{ itemKey: "asc" }, { version: "asc" }],
  });
  const attestations = attestationRows.map(parseStoredAttestation);

  // p4_asset_states_complete reuses the G0 catalog projection helpers so the
  // completion gate and the G0 gate can never disagree about asset-state
  // completeness.
  const mandateClaim = await tx.caioActiveMandateClaim.findFirst({
    where: { workspaceId },
    select: { mandateRecordId: true },
  });
  const snapshot = await loadCaioInitializationProjectionSnapshot(tx, {
    workspaceId,
    mandateRecordId: mandateClaim?.mandateRecordId ?? "mandate:unclaimed",
    evaluatedAt: now,
  });
  const liveG0 = computeCaioInitializationAssessment(
    projectCaioInitializationAssessmentInput(snapshot).input,
  );
  const catalog = {
    assetCount: liveG0.metrics.catalogAssetCount,
    completeStateCount: liveG0.metrics.completeAssetStateCount,
    evidenceRefs: snapshot.assets.map((asset) => asset.id),
  };

  // p5_g0_accepted: the accepted G0 head with LIVE re-verified evidence.
  // The shared loader replays the stored assessment against the live
  // projection and degrades to null on any mismatch.
  const acceptedG0 =
    await loadCurrentAcceptedCaioInitializationContextForRead(tx, {
      workspaceId,
      at: now,
    });

  const portfolioHead = await tx.caioOperatingQuestionPortfolioHead.findUnique(
    { where: { workspaceId } },
  );
  let portfolioEvidence: CaioProV1CompletionAssessmentInput["portfolio"] = {
    currentPortfolioRef: null,
    candidateCount: null,
    boundGateReceiptRef: null,
  };
  if (portfolioHead?.currentPortfolioId) {
    const portfolioRow = await tx.caioOperatingQuestionPortfolio.findFirst({
      where: {
        id: portfolioHead.currentPortfolioId,
        workspaceId,
      },
      select: { id: true, portfolioJson: true },
    });
    if (!portfolioRow) {
      throw new CaioProCompletionStoreError(
        "question_portfolio_head_portfolio_missing",
      );
    }
    const portfolioJson = safeParseJson<{ candidates?: unknown } | null>(
      portfolioRow.portfolioJson,
      null,
    );
    portfolioEvidence = {
      currentPortfolioRef: portfolioRow.id,
      candidateCount: Array.isArray(portfolioJson?.candidates)
        ? portfolioJson.candidates.length
        : null,
      boundGateReceiptRef: portfolioHead.initializationGateReceiptId,
    };
  }

  const selectionContext = await loadCurrentSelectionContext(tx, workspaceId);
  const selectionEvidence: CaioProV1CompletionAssessmentInput["selection"] =
    selectionContext
      ? {
          currentSelectionReceiptRef: selectionContext.selectionReceiptId,
          selectedQuestionIds: selectionContext.selectedQuestionIds,
          portfolioRef: selectionContext.portfolioId,
          portfolioHashBound: selectionContext.portfolioHashBound,
        }
      : {
          currentSelectionReceiptRef: null,
          selectedQuestionIds: [],
          portfolioRef: null,
          portfolioHashBound: false,
        };

  const implementationPlans: CaioProV1CompletionAssessmentInput["implementationPlans"] =
    [];
  const supervisionChains: CaioProV1SupervisionChainEvidence[] = [];
  if (selectionContext) {
    for (const questionId of selectionContext.selectedQuestionIds) {
      const binding =
        await tx.caioOperatingQuestionDecisionBinding.findUnique({
          where: {
            workspaceId_selectionReceiptId_questionId: {
              workspaceId,
              selectionReceiptId: selectionContext.selectionReceiptId,
              questionId,
            },
          },
        });
      const plan = await tx.caioOperatingQuestionImplementationPlan.findFirst(
        {
          where: {
            workspaceId,
            selectionReceiptId: selectionContext.selectionReceiptId,
            questionId,
          },
          select: { id: true, decisionRecordId: true },
        },
      );
      implementationPlans.push({
        questionId,
        decisionRecordRef: binding?.decisionRecordId ?? null,
        implementationPlanRef: plan?.id ?? null,
      });
      if (!binding) continue;

      const decisionRecord = await tx.decisionRecord.findFirst({
        where: { id: binding.decisionRecordId, workspaceId },
        select: {
          id: true,
          decisionKey: true,
          evaluationJson: true,
          evaluatedAt: true,
        },
      });
      if (!decisionRecord) continue;
      const claim = await tx.decisionWorkPacketClaim.findUnique({
        where: { decisionRecordId: decisionRecord.id },
        select: { workspaceId: true, actionItemId: true },
      });
      const actionItemId =
        claim && claim.workspaceId === workspaceId
          ? claim.actionItemId
          : null;
      let verifiedExecutionReceiptRef: string | null = null;
      let observedMemoryCandidateRef: string | null = null;
      if (actionItemId) {
        const executionReceipt = await tx.executionReceipt.findUnique({
          where: {
            subjectType_subjectId: {
              subjectType: ExecutionReceiptSubjectType.ACTION_ITEM,
              subjectId: actionItemId,
            },
          },
          select: {
            id: true,
            workspaceId: true,
            verificationState: true,
          },
        });
        if (
          executionReceipt &&
          executionReceipt.workspaceId === workspaceId &&
          executionReceipt.verificationState ===
            ExecutionReceiptVerificationState.VERIFIED
        ) {
          verifiedExecutionReceiptRef = executionReceipt.id;
        }
        const memoryCandidate = await tx.memoryFact.findFirst({
          where: {
            workspaceId,
            objectId: actionItemId,
            sourceId: {
              in: [
                `evaluation:${decisionRecord.decisionKey.trim()}`,
                `evaluation:${decisionRecord.id}`,
              ],
            },
            status: MemoryStatus.OBSERVED,
            confirmedByUser: false,
          },
          select: { id: true },
        });
        if (memoryCandidate) {
          observedMemoryCandidateRef = `memory-fact:${memoryCandidate.id}`;
        }
      }
      supervisionChains.push({
        questionId,
        decisionRecordRef: decisionRecord.id,
        dispatchedWorkPacketRef: actionItemId,
        verifiedExecutionReceiptRef,
        evaluationRecordedAt:
          decisionRecord.evaluationJson !== null &&
          decisionRecord.evaluatedAt !== null
            ? decisionRecord.evaluatedAt.toISOString()
            : null,
        observedMemoryCandidateRef,
      });
    }
  }

  let valueReceipts: CaioQuestionValueReceipt[] = [];
  let retrospective: CaioProV1RetrospectiveReceipt | null = null;
  if (selectionContext) {
    const valueRows = await tx.caioQuestionValueReceipt.findMany({
      where: {
        workspaceId,
        selectionReceiptId: selectionContext.selectionReceiptId,
      },
      orderBy: [{ questionId: "asc" }, { version: "asc" }],
    });
    const latestByQuestion = new Map<string, StoredValueReceiptRow>();
    for (const row of valueRows) {
      const current = latestByQuestion.get(row.questionId);
      if (!current || row.version > current.version) {
        latestByQuestion.set(row.questionId, row);
      }
    }
    valueReceipts = [...latestByQuestion.values()].map(
      parseStoredValueReceipt,
    );
    const retrospectiveRow = await tx.caioProV1RetrospectiveReceipt.findFirst(
      {
        where: {
          workspaceId,
          selectionReceiptId: selectionContext.selectionReceiptId,
        },
        orderBy: { version: "desc" },
      },
    );
    retrospective = retrospectiveRow
      ? parseStoredRetrospective(retrospectiveRow)
      : null;
  }

  return {
    schemaVersion: CAIO_PRO_V1_COMPLETION_ASSESSMENT_SCHEMA_VERSION,
    workspaceRef: `workspace:${workspaceId}`,
    evaluatedAt: now.toISOString(),
    attestations,
    catalog,
    g0: acceptedG0
      ? {
          acceptedGateReceiptRef: acceptedG0.receipt.receiptId,
          acceptedAssessmentRef: acceptedG0.assessment.assessmentId,
          gateCurrentlyAccepted: true,
        }
      : {
          acceptedGateReceiptRef: null,
          acceptedAssessmentRef: null,
          gateCurrentlyAccepted: false,
        },
    portfolio: portfolioEvidence,
    selection: selectionEvidence,
    implementationPlans,
    supervisionChains,
    valueReceipts,
    retrospective,
  };
}

async function computeLiveCompletionAssessment(
  tx: Tx,
  input: { workspaceId: string; now: Date },
): Promise<{
  projection: CaioProV1CompletionAssessmentInput;
  assessment: CaioProV1CompletionAssessment;
}> {
  const projection = await buildCompletionEvidenceProjection(tx, input);
  const assessment = computeCaioProV1CompletionAssessment(projection);
  const validation = validateCaioProV1CompletionAssessment(assessment);
  if (!validation.valid) {
    throw new CaioProCompletionStoreError(
      "computed_completion_assessment_invalid",
      validation.errors,
    );
  }
  return { projection, assessment };
}

// ---------------------------------------------------------------------------
// Evidence attestations (append-only; later versions supersede).
// ---------------------------------------------------------------------------

export async function recordCaioProV1EvidenceAttestation(input: {
  workspaceId: string;
  actorUserId: string;
  ceoPrincipalRef: string;
  // When present, the acting user is a bound FDE recording on the CEO's
  // behalf; when absent, the acting user must be the bound CEO themself.
  recorderFdePrincipalRef?: string;
  itemKey: CaioProV1AttestableItemKey;
  statement: string;
  evidenceRefs: string[];
  idempotencyKey: string;
  now?: Date;
  english?: boolean;
}): Promise<{
  attestation: CaioProV1EvidenceAttestation;
  replayed: boolean;
}> {
  await assertPolicyAccess(input);
  if (
    !(CAIO_PRO_V1_ATTESTABLE_ITEMS as readonly string[]).includes(
      input.itemKey,
    )
  ) {
    throw new CaioProCompletionStoreError(
      "attestation_item_key_not_attestable",
    );
  }
  const ceoPrincipalRef = nonEmpty(
    input.ceoPrincipalRef,
    "ceo_principal_ref_required",
  );
  const idempotencyKey = nonEmpty(
    input.idempotencyKey,
    "idempotency_key_required",
  );
  const statement = nonEmpty(input.statement, "attestation_statement_required");
  const evidenceRefs = uniqueSorted(input.evidenceRefs);
  if (evidenceRefs.length === 0) {
    throw new CaioProCompletionStoreError("attestation_evidence_required");
  }
  const now = input.now ?? new Date();
  return runWithWriteConflictRetry(
    () =>
      db.$transaction(async (tx) => {
        await lockWorkspace(tx, input.workspaceId);
        await assertPolicyAccessInTransaction(tx, input);
        const fdePrincipalRef = input.recorderFdePrincipalRef?.trim();
        let binding;
        let recordedByPrincipalKind: "ceo" | "fde";
        let recorderBinding;
        if (fdePrincipalRef) {
          recorderBinding = await assertLiveFdeBinding(tx, {
            workspaceId: input.workspaceId,
            actorUserId: input.actorUserId,
            fdePrincipalRef,
          });
          binding = await requireLiveCeoSeat(tx, {
            workspaceId: input.workspaceId,
            ceoPrincipalRef,
          });
          recordedByPrincipalKind = "fde";
        } else {
          binding = await assertLiveCeoBinding(tx, {
            workspaceId: input.workspaceId,
            actorUserId: input.actorUserId,
            ceoPrincipalRef,
          });
          recorderBinding = binding;
          recordedByPrincipalKind = "ceo";
        }
        const recordedByPrincipalRef = fdePrincipalRef ?? ceoPrincipalRef;
        const requestHash = hashRequest({
          itemKey: input.itemKey,
          statement,
          evidenceRefs,
          ceoPrincipalBindingRef: binding.id,
          ceoPrincipalRef,
          actorUserRef: input.actorUserId,
          recordedByPrincipalKind,
          recordedByPrincipalRef,
          recordedByBindingRef: recorderBinding.id,
        });
        const existing = await tx.caioProV1EvidenceAttestation.findUnique({
          where: {
            workspaceId_idempotencyKey: {
              workspaceId: input.workspaceId,
              idempotencyKey,
            },
          },
        });
        if (existing) {
          if (existing.requestHash !== requestHash) {
            throw new CaioProCompletionStoreError(
              "idempotency_key_payload_conflict",
            );
          }
          return {
            attestation: parseStoredAttestation(existing),
            replayed: true,
          };
        }
        const latest = await tx.caioProV1EvidenceAttestation.findFirst({
          where: { workspaceId: input.workspaceId, itemKey: input.itemKey },
          orderBy: { version: "desc" },
          select: { version: true },
        });
        const attestation = createCaioProV1EvidenceAttestation({
          workspaceRef: `workspace:${input.workspaceId}`,
          itemKey: input.itemKey,
          version: (latest?.version ?? 0) + 1,
          statement,
          evidenceRefs,
          ceoPrincipalBindingRef: binding.id,
          ceoPrincipalRef,
          actorUserRef: input.actorUserId,
          recordedByPrincipalKind,
          recordedByPrincipalRef,
          recordedByBindingRef: recorderBinding.id,
          recordedAt: now.toISOString(),
        });
        try {
          await tx.caioProV1EvidenceAttestation.create({
            data: {
              id: attestation.attestationId,
              workspaceId: input.workspaceId,
              itemKey: attestation.itemKey,
              version: attestation.version,
              ceoPrincipalBindingId: binding.id,
              ceoPrincipalRef,
              actorType: ActorType.USER,
              actorUserId: input.actorUserId,
              statement: attestation.statement,
              evidenceRefs: jsonStringify(attestation.evidenceRefs),
              idempotencyKey,
              requestHash,
              attestationJson: jsonStringify(attestation),
              contentHash: attestation.contentHash,
              authorityEffect: attestation.authorityEffect,
              recordedAt: new Date(attestation.recordedAt),
            },
          });
        } catch (error) {
          if (isUniqueConstraintViolation(error)) {
            throw new CaioProCompletionStoreError(
              "attestation_concurrent_conflict",
            );
          }
          throw error;
        }
        await writeAuditLog(
          {
            workspaceId: input.workspaceId,
            userId: input.actorUserId,
            actor: ceoPrincipalRef,
            actorType: ActorType.USER,
            actionType: "CAIO_PRO_V1_EVIDENCE_ATTESTED",
            targetType: "CaioProV1EvidenceAttestation",
            targetId: attestation.attestationId,
            summary:
              "Owner recorded a CAIO Pro V1 completion-checklist evidence attestation (governance record only; grants nothing)",
            payload: {
              itemKey: attestation.itemKey,
              version: attestation.version,
              evidenceRefs: attestation.evidenceRefs,
              authorityEffect: attestation.authorityEffect,
            },
          },
          { client: tx },
        );
        return { attestation, replayed: false };
      }, TRANSACTION_OPTIONS),
    WRITE_RETRY_OPTIONS,
  );
}

// ---------------------------------------------------------------------------
// Value receipts and retrospective (append-only, bound to the CURRENT CEO
// selection).
// ---------------------------------------------------------------------------

export type CaioQuestionValueReceiptPayload = Omit<
  CaioQuestionValueReceiptInput,
  "workspaceRef" | "selectionReceiptRef" | "recordedAt"
>;

export async function recordCaioQuestionValueReceipt(input: {
  workspaceId: string;
  actorUserId: string;
  payload: CaioQuestionValueReceiptPayload;
  idempotencyKey: string;
  now?: Date;
  english?: boolean;
}): Promise<{
  receipt: CaioQuestionValueReceipt;
  replayed: boolean;
}> {
  await assertPolicyAccess(input);
  const idempotencyKey = nonEmpty(
    input.idempotencyKey,
    "idempotency_key_required",
  );
  const now = input.now ?? new Date();
  return runWithWriteConflictRetry(
    () =>
      db.$transaction(async (tx) => {
        await lockWorkspace(tx, input.workspaceId);
        await assertPolicyAccessInTransaction(tx, input);
        const selection = await loadCurrentSelectionContext(
          tx,
          input.workspaceId,
        );
        if (!selection) {
          throw new CaioProCompletionStoreError(
            "current_question_selection_required",
          );
        }
        if (
          !selection.selectedQuestionIds.includes(
            input.payload.questionId.trim(),
          )
        ) {
          throw new CaioProCompletionStoreError(
            "question_not_in_current_selection",
          );
        }
        const requestHash = hashRequest({
          selectionReceiptRef: selection.selectionReceiptId,
          payload: input.payload,
          actorUserRef: input.actorUserId,
        });
        const existing = await tx.caioQuestionValueReceipt.findUnique({
          where: {
            workspaceId_idempotencyKey: {
              workspaceId: input.workspaceId,
              idempotencyKey,
            },
          },
        });
        if (existing) {
          if (existing.requestHash !== requestHash) {
            throw new CaioProCompletionStoreError(
              "idempotency_key_payload_conflict",
            );
          }
          return {
            receipt: parseStoredValueReceipt(existing),
            replayed: true,
          };
        }
        let receipt: CaioQuestionValueReceipt;
        try {
          receipt = createCaioQuestionValueReceipt({
            ...input.payload,
            workspaceRef: `workspace:${input.workspaceId}`,
            selectionReceiptRef: selection.selectionReceiptId,
            recordedAt: now.toISOString(),
          });
        } catch (error) {
          throw new CaioProCompletionStoreError(
            error instanceof Error
              ? error.message
              : "caio_question_value_receipt_invalid",
          );
        }
        const latest = await tx.caioQuestionValueReceipt.findFirst({
          where: {
            workspaceId: input.workspaceId,
            selectionReceiptId: selection.selectionReceiptId,
            questionId: receipt.questionId,
          },
          orderBy: { version: "desc" },
          select: { version: true },
        });
        try {
          await tx.caioQuestionValueReceipt.create({
            data: {
              id: receipt.receiptId,
              workspaceId: input.workspaceId,
              selectionReceiptId: selection.selectionReceiptId,
              questionId: receipt.questionId,
              version: (latest?.version ?? 0) + 1,
              idempotencyKey,
              requestHash,
              receiptJson: jsonStringify(receipt),
              contentHash: receipt.contentHash,
              authorityEffect: receipt.authorityEffect,
              recordedAt: new Date(receipt.recordedAt),
            },
          });
        } catch (error) {
          if (isUniqueConstraintViolation(error)) {
            throw new CaioProCompletionStoreError(
              "value_receipt_concurrent_conflict",
            );
          }
          throw error;
        }
        await writeAuditLog(
          {
            workspaceId: input.workspaceId,
            userId: input.actorUserId,
            actor: input.actorUserId,
            actorType: ActorType.USER,
            actionType: "CAIO_QUESTION_VALUE_RECEIPT_RECORDED",
            targetType: "CaioQuestionValueReceipt",
            targetId: receipt.receiptId,
            summary:
              "Single-question 30-day value receipt recorded (evidence record only; grants nothing)",
            payload: {
              questionId: receipt.questionId,
              selectionReceiptRef: receipt.selectionReceiptRef,
              ownerConclusion: receipt.ownerConclusion,
              valueClasses: receipt.valueClasses,
              authorityEffect: receipt.authorityEffect,
            },
          },
          { client: tx },
        );
        return { receipt, replayed: false };
      }, TRANSACTION_OPTIONS),
    WRITE_RETRY_OPTIONS,
  );
}

export type CaioProV1RetrospectivePayload = Omit<
  CaioProV1RetrospectiveReceiptInput,
  "workspaceRef" | "selectionReceiptRef" | "recordedAt"
>;

export async function recordCaioProV1RetrospectiveReceipt(input: {
  workspaceId: string;
  actorUserId: string;
  payload: CaioProV1RetrospectivePayload;
  idempotencyKey: string;
  now?: Date;
  english?: boolean;
}): Promise<{
  receipt: CaioProV1RetrospectiveReceipt;
  replayed: boolean;
}> {
  await assertPolicyAccess(input);
  const idempotencyKey = nonEmpty(
    input.idempotencyKey,
    "idempotency_key_required",
  );
  const now = input.now ?? new Date();
  return runWithWriteConflictRetry(
    () =>
      db.$transaction(async (tx) => {
        await lockWorkspace(tx, input.workspaceId);
        await assertPolicyAccessInTransaction(tx, input);
        const selection = await loadCurrentSelectionContext(
          tx,
          input.workspaceId,
        );
        if (!selection) {
          throw new CaioProCompletionStoreError(
            "current_question_selection_required",
          );
        }
        const requestHash = hashRequest({
          selectionReceiptRef: selection.selectionReceiptId,
          payload: input.payload,
          actorUserRef: input.actorUserId,
        });
        const existing = await tx.caioProV1RetrospectiveReceipt.findUnique({
          where: {
            workspaceId_idempotencyKey: {
              workspaceId: input.workspaceId,
              idempotencyKey,
            },
          },
        });
        if (existing) {
          if (existing.requestHash !== requestHash) {
            throw new CaioProCompletionStoreError(
              "idempotency_key_payload_conflict",
            );
          }
          return {
            receipt: parseStoredRetrospective(existing),
            replayed: true,
          };
        }
        let receipt: CaioProV1RetrospectiveReceipt;
        try {
          receipt = createCaioProV1RetrospectiveReceipt({
            ...input.payload,
            workspaceRef: `workspace:${input.workspaceId}`,
            selectionReceiptRef: selection.selectionReceiptId,
            recordedAt: now.toISOString(),
          });
        } catch (error) {
          throw new CaioProCompletionStoreError(
            error instanceof Error
              ? error.message
              : "caio_pro_v1_retrospective_receipt_invalid",
          );
        }
        const latest = await tx.caioProV1RetrospectiveReceipt.findFirst({
          where: {
            workspaceId: input.workspaceId,
            selectionReceiptId: selection.selectionReceiptId,
          },
          orderBy: { version: "desc" },
          select: { version: true },
        });
        try {
          await tx.caioProV1RetrospectiveReceipt.create({
            data: {
              id: receipt.receiptId,
              workspaceId: input.workspaceId,
              selectionReceiptId: selection.selectionReceiptId,
              version: (latest?.version ?? 0) + 1,
              idempotencyKey,
              requestHash,
              receiptJson: jsonStringify(receipt),
              contentHash: receipt.contentHash,
              authorityEffect: receipt.authorityEffect,
              recordedAt: new Date(receipt.recordedAt),
            },
          });
        } catch (error) {
          if (isUniqueConstraintViolation(error)) {
            throw new CaioProCompletionStoreError(
              "retrospective_concurrent_conflict",
            );
          }
          throw error;
        }
        await writeAuditLog(
          {
            workspaceId: input.workspaceId,
            userId: input.actorUserId,
            actor: input.actorUserId,
            actorType: ActorType.USER,
            actionType: "CAIO_PRO_V1_RETROSPECTIVE_RECORDED",
            targetType: "CaioProV1RetrospectiveReceipt",
            targetId: receipt.receiptId,
            summary:
              "CAIO Pro V1 retrospective recorded (recommendations only; maturity never auto-promotes)",
            payload: {
              selectionReceiptRef: receipt.selectionReceiptRef,
              overallRecommendation: receipt.overallRecommendation,
              maturityPromotionEffect: receipt.maturityPromotionEffect,
              authorityEffect: receipt.authorityEffect,
            },
          },
          { client: tx },
        );
        return { receipt, replayed: false };
      }, TRANSACTION_OPTIONS),
    WRITE_RETRY_OPTIONS,
  );
}

// ---------------------------------------------------------------------------
// Completion assessment (append-only, derived live in-transaction).
// ---------------------------------------------------------------------------

export async function recordCaioProV1CompletionAssessment(input: {
  workspaceId: string;
  actorUserId: string;
  evaluationKey: string;
  now?: Date;
  english?: boolean;
}): Promise<{
  assessment: CaioProV1CompletionAssessment;
  replayed: boolean;
}> {
  await assertPolicyAccess(input);
  const evaluationKey = nonEmpty(
    input.evaluationKey,
    "evaluation_key_required",
  );
  const now = input.now ?? new Date();
  return runWithWriteConflictRetry(
    () =>
      db.$transaction(async (tx) => {
        await lockWorkspace(tx, input.workspaceId);
        await assertPolicyAccessInTransaction(tx, input);
        const existing = await tx.caioProV1CompletionAssessment.findUnique({
          where: {
            workspaceId_evaluationKey: {
              workspaceId: input.workspaceId,
              evaluationKey,
            },
          },
        });
        if (existing) {
          return {
            assessment: parseStoredCompletionAssessment(existing),
            replayed: true,
          };
        }
        const { projection, assessment } =
          await computeLiveCompletionAssessment(tx, {
            workspaceId: input.workspaceId,
            now,
          });
        await tx.caioProV1CompletionAssessment.create({
          data: {
            id: assessment.assessmentId,
            workspaceId: input.workspaceId,
            evaluationKey,
            schemaVersion: assessment.schemaVersion,
            evaluatorRevision: assessment.evaluatorRevision,
            basisHash: assessment.basisHash,
            decision: assessment.decision.toUpperCase(),
            inputJson: jsonStringify({
              input: projection,
            } satisfies StoredCompletionAssessmentEnvelope),
            assessmentJson: jsonStringify(assessment),
            contentHash: assessment.contentHash,
            authorityEffect: assessment.authorityEffect,
            evaluatedAt: now,
          },
        });
        await writeAuditLog(
          {
            workspaceId: input.workspaceId,
            userId: input.actorUserId,
            actor: input.actorUserId,
            actorType: ActorType.USER,
            actionType: "CAIO_PRO_V1_COMPLETION_ASSESSED",
            targetType: "CaioProV1CompletionAssessment",
            targetId: assessment.assessmentId,
            summary:
              "CAIO Pro V1 site-deployment completion checklist evaluated from live evidence (review state only; grants nothing)",
            payload: {
              decision: assessment.decision,
              basisHash: assessment.basisHash,
              missingItemKeys: assessment.missingItemKeys,
              authorityEffect: assessment.authorityEffect,
              fullFunctionOperation: assessment.fullFunctionOperation,
            },
          },
          { client: tx },
        );
        return { assessment, replayed: false };
      }, TRANSACTION_OPTIONS),
    WRITE_RETRY_OPTIONS,
  );
}

// ---------------------------------------------------------------------------
// Completion gate accept / revoke (mirrors the G0 gate ledger).
// ---------------------------------------------------------------------------

type CompletionGateHeadRow = {
  workspaceId: string;
  currentAssessmentId: string;
  currentReceiptId: string;
  sequence: number;
  version: number;
};

// FOR UPDATE row lock BEFORE the guarded updateMany CAS: Prisma compiles a
// guarded updateMany into SELECT + UPDATE-by-id, which is not atomic on its
// own (see #340). The prior lock makes the guard sound.
async function readCompletionHeadForUpdate(
  tx: Tx,
  workspaceId: string,
): Promise<CompletionGateHeadRow | null> {
  const rows = await tx.$queryRaw<CompletionGateHeadRow[]>`
    SELECT workspaceId, currentAssessmentId, currentReceiptId, sequence, version
    FROM CaioProV1CompletionGateHead
    WHERE workspaceId = ${workspaceId}
    FOR UPDATE`;
  return rows[0] ?? null;
}

function assertCompletionHeadReceiptBinding(
  head: CompletionGateHeadRow,
  receipt: CaioProV1CompletionGateReceipt,
): void {
  if (
    receipt.receiptId !== head.currentReceiptId ||
    receipt.assessmentRef !== head.currentAssessmentId ||
    receipt.sequence !== head.sequence
  ) {
    throw new CaioProCompletionStoreError(
      "completion_gate_head_binding_invalid",
    );
  }
}

function assertCompletionReceiptAssessmentBinding(
  receipt: CaioProV1CompletionGateReceipt,
  assessment: CaioProV1CompletionAssessment,
): void {
  if (
    receipt.assessmentRef !== assessment.assessmentId ||
    receipt.assessmentHash !== assessment.contentHash ||
    receipt.basisHash !== assessment.basisHash ||
    receipt.workspaceRef !== assessment.workspaceRef
  ) {
    throw new CaioProCompletionStoreError(
      "completion_gate_receipt_assessment_binding_invalid",
    );
  }
}

async function assertCompletionReceiptChainIntegrity(
  tx: Tx,
  workspaceId: string,
  headReceipt: CaioProV1CompletionGateReceipt,
): Promise<void> {
  const visited = new Set<string>();
  let current = headReceipt;
  while (true) {
    if (visited.has(current.receiptId)) {
      throw new CaioProCompletionStoreError(
        "completion_gate_receipt_chain_cycle",
      );
    }
    visited.add(current.receiptId);
    if (current.sequence === 1) {
      if (
        current.previousReceiptRef !== null ||
        current.previousReceiptHash !== null
      ) {
        throw new CaioProCompletionStoreError(
          "completion_gate_receipt_chain_root_invalid",
        );
      }
      return;
    }
    if (!current.previousReceiptRef || !current.previousReceiptHash) {
      throw new CaioProCompletionStoreError(
        "completion_gate_receipt_chain_predecessor_missing",
      );
    }
    const previousRow = await tx.caioProV1CompletionGateReceipt.findFirst({
      where: {
        id: current.previousReceiptRef,
        workspaceId,
      },
    });
    if (!previousRow) {
      throw new CaioProCompletionStoreError(
        "completion_gate_receipt_chain_predecessor_missing",
      );
    }
    const previous = parseStoredCompletionGateReceipt(previousRow);
    if (previous.contentHash !== current.previousReceiptHash) {
      throw new CaioProCompletionStoreError(
        "completion_gate_receipt_chain_hash_mismatch",
      );
    }
    if (previous.sequence !== current.sequence - 1) {
      throw new CaioProCompletionStoreError(
        "completion_gate_receipt_chain_sequence_mismatch",
      );
    }
    if (Date.parse(previous.recordedAt) > Date.parse(current.recordedAt)) {
      throw new CaioProCompletionStoreError(
        "completion_gate_receipt_chain_time_invalid",
      );
    }
    current = previous;
  }
}

function assertCompletionAssessmentStillCurrent(input: {
  stored: CaioProV1CompletionAssessment;
  current: CaioProV1CompletionAssessment;
}): void {
  if (
    input.current.decision !== "ready_for_owner_acceptance" ||
    input.current.basisHash !== input.stored.basisHash ||
    input.current.evaluatorRevision !== input.stored.evaluatorRevision
  ) {
    throw new CaioProCompletionStoreError(
      "completion_assessment_stale_reassessment_required",
      input.current.missingItemKeys,
    );
  }
}

async function assertCompletionReplayIsCurrentHead(
  tx: Tx,
  input: {
    workspaceId: string;
    receipt: CaioProV1CompletionGateReceipt;
    assessment: CaioProV1CompletionAssessment;
  },
): Promise<void> {
  const head = await readCompletionHeadForUpdate(tx, input.workspaceId);
  if (
    !head ||
    input.receipt.receiptId !== head.currentReceiptId ||
    input.receipt.assessmentRef !== head.currentAssessmentId ||
    input.receipt.sequence !== head.sequence
  ) {
    throw new CaioProCompletionStoreError(
      "idempotency_receipt_no_longer_current",
    );
  }
  assertCompletionReceiptAssessmentBinding(input.receipt, input.assessment);
  await assertCompletionReceiptChainIntegrity(
    tx,
    input.workspaceId,
    input.receipt,
  );
}

async function updateCompletionHead(
  tx: Tx,
  input: {
    workspaceId: string;
    assessmentId: string;
    receiptId: string;
    sequence: number;
    previous: CompletionGateHeadRow | null;
  },
): Promise<void> {
  if (!input.previous) {
    await tx.caioProV1CompletionGateHead.create({
      data: {
        workspaceId: input.workspaceId,
        currentAssessmentId: input.assessmentId,
        currentReceiptId: input.receiptId,
        sequence: input.sequence,
        version: 1,
      },
    });
    return;
  }
  const updated = await tx.caioProV1CompletionGateHead.updateMany({
    where: {
      workspaceId: input.workspaceId,
      currentReceiptId: input.previous.currentReceiptId,
      sequence: input.previous.sequence,
      version: input.previous.version,
    },
    data: {
      currentAssessmentId: input.assessmentId,
      currentReceiptId: input.receiptId,
      sequence: input.sequence,
      version: { increment: 1 },
    },
  });
  if (updated.count !== 1) {
    throw new CaioProCompletionStoreError(
      "completion_gate_head_concurrent_update",
    );
  }
}

async function persistCompletionReceipt(
  tx: Tx,
  input: {
    workspaceId: string;
    assessmentId: string;
    ceoPrincipalBindingId: string;
    actorUserId: string;
    receipt: CaioProV1CompletionGateReceipt;
  },
) {
  return tx.caioProV1CompletionGateReceipt.create({
    data: {
      id: input.receipt.receiptId,
      workspaceId: input.workspaceId,
      assessmentId: input.assessmentId,
      ceoPrincipalBindingId: input.ceoPrincipalBindingId,
      previousReceiptId: input.receipt.previousReceiptRef,
      previousReceiptHash: input.receipt.previousReceiptHash,
      sequence: input.receipt.sequence,
      idempotencyKey: input.receipt.idempotencyKey,
      action: input.receipt.action.toUpperCase(),
      resultingStatus: input.receipt.resultingStatus.toUpperCase(),
      actorType: ActorType.USER,
      actorUserId: input.actorUserId,
      ceoPrincipalRef: input.receipt.ceoPrincipalRef,
      reasonCodes: jsonStringify(input.receipt.reasonCodes),
      evidenceRefs: jsonStringify(input.receipt.evidenceRefs),
      basisHash: input.receipt.basisHash,
      receiptJson: jsonStringify(input.receipt),
      contentHash: input.receipt.contentHash,
      authorityEffect: input.receipt.authorityEffect,
      fullFunctionOperation: input.receipt.fullFunctionOperation,
      recordedAt: new Date(input.receipt.recordedAt),
    },
  });
}

function equivalentCompletionReplay(
  receipt: CaioProV1CompletionGateReceipt,
  input: {
    action: "accept" | "revoke";
    actorUserId: string;
    ceoPrincipalRef: string;
    reasonCodes: readonly string[];
    evidenceRefs: readonly string[];
    assessmentId?: string;
  },
): boolean {
  return (
    receipt.action === input.action &&
    (input.assessmentId === undefined ||
      receipt.assessmentRef === input.assessmentId) &&
    receipt.actorUserRef === input.actorUserId &&
    receipt.ceoPrincipalRef === input.ceoPrincipalRef &&
    canonicalJson(receipt.reasonCodes) ===
      canonicalJson(uniqueSorted(input.reasonCodes)) &&
    canonicalJson(receipt.evidenceRefs) ===
      canonicalJson(uniqueSorted(input.evidenceRefs))
  );
}

async function loadPreviousCompletionReceiptForHead(
  tx: Tx,
  workspaceId: string,
  head: CompletionGateHeadRow | null,
): Promise<CaioProV1CompletionGateReceipt | null> {
  if (!head) return null;
  const previousRow = await tx.caioProV1CompletionGateReceipt.findFirst({
    where: {
      id: head.currentReceiptId,
      workspaceId,
    },
  });
  if (!previousRow) {
    throw new CaioProCompletionStoreError(
      "completion_gate_head_receipt_missing",
    );
  }
  const previous = parseStoredCompletionGateReceipt(previousRow);
  assertCompletionHeadReceiptBinding(head, previous);
  const previousAssessmentRow =
    await tx.caioProV1CompletionAssessment.findFirst({
      where: {
        id: head.currentAssessmentId,
        workspaceId,
      },
    });
  if (!previousAssessmentRow) {
    throw new CaioProCompletionStoreError(
      "completion_gate_head_assessment_missing",
    );
  }
  assertCompletionReceiptAssessmentBinding(
    previous,
    parseStoredCompletionAssessment(previousAssessmentRow),
  );
  await assertCompletionReceiptChainIntegrity(tx, workspaceId, previous);
  return previous;
}

export async function acceptCaioProV1CompletionGate(input: {
  workspaceId: string;
  assessmentId: string;
  actorUserId: string;
  ceoPrincipalRef: string;
  idempotencyKey: string;
  reasonCodes: string[];
  evidenceRefs: string[];
  now?: Date;
  english?: boolean;
}): Promise<{
  receipt: CaioProV1CompletionGateReceipt;
  replayed: boolean;
}> {
  await assertPolicyAccess(input);
  const idempotencyKey = nonEmpty(
    input.idempotencyKey,
    "idempotency_key_required",
  );
  const now = input.now ?? new Date();
  return runWithWriteConflictRetry(
    () =>
      db.$transaction(async (tx) => {
        await lockWorkspace(tx, input.workspaceId);
        await assertPolicyAccessInTransaction(tx, input);
        const assessmentRow =
          await tx.caioProV1CompletionAssessment.findFirst({
            where: {
              id: input.assessmentId,
              workspaceId: input.workspaceId,
            },
          });
        if (!assessmentRow) {
          throw new CaioProCompletionStoreError(
            "completion_assessment_not_found",
          );
        }
        const assessment = parseStoredCompletionAssessment(assessmentRow);
        const binding = await assertLiveCeoBinding(tx, {
          workspaceId: input.workspaceId,
          actorUserId: input.actorUserId,
          ceoPrincipalRef: input.ceoPrincipalRef,
        });
        const existing =
          await tx.caioProV1CompletionGateReceipt.findUnique({
            where: {
              workspaceId_idempotencyKey: {
                workspaceId: input.workspaceId,
                idempotencyKey,
              },
            },
          });
        if (existing) {
          const receipt = parseStoredCompletionGateReceipt(existing);
          if (
            !equivalentCompletionReplay(receipt, {
              action: "accept",
              actorUserId: input.actorUserId,
              ceoPrincipalRef: input.ceoPrincipalRef,
              reasonCodes: input.reasonCodes,
              evidenceRefs: input.evidenceRefs,
              assessmentId: input.assessmentId,
            })
          ) {
            throw new CaioProCompletionStoreError(
              "idempotency_key_payload_conflict",
            );
          }
          await assertCompletionReplayIsCurrentHead(tx, {
            workspaceId: input.workspaceId,
            receipt,
            assessment,
          });
          return { receipt, replayed: true };
        }
        // Acceptance requires basis-hash equality against a LIVE recomputed
        // assessment: acceptance can never outrun the evidence.
        const { assessment: current } = await computeLiveCompletionAssessment(
          tx,
          { workspaceId: input.workspaceId, now },
        );
        assertCompletionAssessmentStillCurrent({
          stored: assessment,
          current,
        });
        const head = await readCompletionHeadForUpdate(
          tx,
          input.workspaceId,
        );
        const previous = await loadPreviousCompletionReceiptForHead(
          tx,
          input.workspaceId,
          head,
        );
        const receipt = createCaioProV1CompletionAcceptanceReceipt({
          workspaceRef: `workspace:${input.workspaceId}`,
          assessment,
          ceoPrincipalBindingRef: binding.id,
          ceoPrincipalRef: input.ceoPrincipalRef,
          actorUserRef: input.actorUserId,
          idempotencyKey,
          reasonCodes: input.reasonCodes,
          evidenceRefs: input.evidenceRefs,
          previousReceipt: previous
            ? {
                receiptId: previous.receiptId,
                contentHash: previous.contentHash,
                sequence: previous.sequence,
                resultingStatus: previous.resultingStatus,
                assessmentRef: previous.assessmentRef,
                recordedAt: previous.recordedAt,
              }
            : null,
          recordedAt: now.toISOString(),
        });
        try {
          await persistCompletionReceipt(tx, {
            workspaceId: input.workspaceId,
            assessmentId: assessmentRow.id,
            ceoPrincipalBindingId: binding.id,
            actorUserId: input.actorUserId,
            receipt,
          });
        } catch (error) {
          if (isUniqueConstraintViolation(error)) {
            throw new CaioProCompletionStoreError(
              "completion_gate_receipt_concurrent_conflict",
            );
          }
          throw error;
        }
        await updateCompletionHead(tx, {
          workspaceId: input.workspaceId,
          assessmentId: assessmentRow.id,
          receiptId: receipt.receiptId,
          sequence: receipt.sequence,
          previous: head,
        });
        await writeAuditLog(
          {
            workspaceId: input.workspaceId,
            userId: input.actorUserId,
            actor: input.ceoPrincipalRef,
            actorType: ActorType.USER,
            actionType: "CAIO_PRO_V1_COMPLETION_GATE_ACCEPTED",
            targetType: "CaioProV1CompletionGateReceipt",
            targetId: receipt.receiptId,
            summary:
              "CEO accepted the CAIO Pro V1 site-deployment completion evidence (governance receipt only; full-function operation is NOT authorized by this receipt)",
            relatedObjectType: "CaioProV1CompletionAssessment",
            relatedObjectId: assessmentRow.id,
            payload: {
              basisHash: receipt.basisHash,
              authorityEffect: receipt.authorityEffect,
              fullFunctionOperation: receipt.fullFunctionOperation,
            },
          },
          { client: tx },
        );
        return { receipt, replayed: false };
      }, TRANSACTION_OPTIONS),
    WRITE_RETRY_OPTIONS,
  );
}

export async function revokeCaioProV1CompletionGate(input: {
  workspaceId: string;
  actorUserId: string;
  ceoPrincipalRef: string;
  idempotencyKey: string;
  reasonCodes: string[];
  evidenceRefs: string[];
  now?: Date;
  english?: boolean;
}): Promise<{
  receipt: CaioProV1CompletionGateReceipt;
  replayed: boolean;
}> {
  await assertPolicyAccess(input);
  const idempotencyKey = nonEmpty(
    input.idempotencyKey,
    "idempotency_key_required",
  );
  const now = input.now ?? new Date();
  return runWithWriteConflictRetry(
    () =>
      db.$transaction(async (tx) => {
        await lockWorkspace(tx, input.workspaceId);
        await assertPolicyAccessInTransaction(tx, input);
        const binding = await assertLiveCeoBinding(tx, {
          workspaceId: input.workspaceId,
          actorUserId: input.actorUserId,
          ceoPrincipalRef: input.ceoPrincipalRef,
        });
        const existing =
          await tx.caioProV1CompletionGateReceipt.findUnique({
            where: {
              workspaceId_idempotencyKey: {
                workspaceId: input.workspaceId,
                idempotencyKey,
              },
            },
          });
        if (existing) {
          const receipt = parseStoredCompletionGateReceipt(existing);
          if (
            !equivalentCompletionReplay(receipt, {
              action: "revoke",
              actorUserId: input.actorUserId,
              ceoPrincipalRef: input.ceoPrincipalRef,
              reasonCodes: input.reasonCodes,
              evidenceRefs: input.evidenceRefs,
            })
          ) {
            throw new CaioProCompletionStoreError(
              "idempotency_key_payload_conflict",
            );
          }
          const replayAssessmentRow =
            await tx.caioProV1CompletionAssessment.findFirst({
              where: {
                id: receipt.assessmentRef,
                workspaceId: input.workspaceId,
              },
            });
          if (!replayAssessmentRow) {
            throw new CaioProCompletionStoreError(
              "completion_gate_head_assessment_missing",
            );
          }
          await assertCompletionReplayIsCurrentHead(tx, {
            workspaceId: input.workspaceId,
            receipt,
            assessment: parseStoredCompletionAssessment(replayAssessmentRow),
          });
          return { receipt, replayed: true };
        }
        const head = await readCompletionHeadForUpdate(
          tx,
          input.workspaceId,
        );
        if (!head) {
          throw new CaioProCompletionStoreError(
            "accepted_completion_gate_not_found",
          );
        }
        const previous = await loadPreviousCompletionReceiptForHead(
          tx,
          input.workspaceId,
          head,
        );
        if (!previous) {
          throw new CaioProCompletionStoreError(
            "completion_gate_head_receipt_missing",
          );
        }
        const assessmentRow =
          await tx.caioProV1CompletionAssessment.findFirst({
            where: {
              id: head.currentAssessmentId,
              workspaceId: input.workspaceId,
            },
          });
        if (!assessmentRow) {
          throw new CaioProCompletionStoreError(
            "completion_gate_head_assessment_missing",
          );
        }
        const assessment = parseStoredCompletionAssessment(assessmentRow);
        const receipt = createCaioProV1CompletionRevocationReceipt({
          workspaceRef: `workspace:${input.workspaceId}`,
          assessment,
          ceoPrincipalBindingRef: binding.id,
          ceoPrincipalRef: input.ceoPrincipalRef,
          actorUserRef: input.actorUserId,
          idempotencyKey,
          reasonCodes: input.reasonCodes,
          evidenceRefs: input.evidenceRefs,
          previousReceipt: {
            receiptId: previous.receiptId,
            contentHash: previous.contentHash,
            sequence: previous.sequence,
            resultingStatus: previous.resultingStatus,
            assessmentRef: previous.assessmentRef,
            recordedAt: previous.recordedAt,
          },
          recordedAt: now.toISOString(),
        });
        try {
          await persistCompletionReceipt(tx, {
            workspaceId: input.workspaceId,
            assessmentId: assessmentRow.id,
            ceoPrincipalBindingId: binding.id,
            actorUserId: input.actorUserId,
            receipt,
          });
        } catch (error) {
          if (isUniqueConstraintViolation(error)) {
            throw new CaioProCompletionStoreError(
              "completion_gate_receipt_concurrent_conflict",
            );
          }
          throw error;
        }
        await updateCompletionHead(tx, {
          workspaceId: input.workspaceId,
          assessmentId: assessmentRow.id,
          receiptId: receipt.receiptId,
          sequence: receipt.sequence,
          previous: head,
        });
        await writeAuditLog(
          {
            workspaceId: input.workspaceId,
            userId: input.actorUserId,
            actor: input.ceoPrincipalRef,
            actorType: ActorType.USER,
            actionType: "CAIO_PRO_V1_COMPLETION_GATE_REVOKED",
            targetType: "CaioProV1CompletionGateReceipt",
            targetId: receipt.receiptId,
            summary:
              "CEO revoked the CAIO Pro V1 completion acceptance (safety action; the site-deployment-complete claim is withdrawn)",
            relatedObjectType: "CaioProV1CompletionAssessment",
            relatedObjectId: assessmentRow.id,
            payload: {
              previousReceiptRef: receipt.previousReceiptRef,
              reasonCodes: receipt.reasonCodes,
              authorityEffect: receipt.authorityEffect,
              fullFunctionOperation: receipt.fullFunctionOperation,
            },
          },
          { client: tx },
        );
        return { receipt, replayed: false };
      }, TRANSACTION_OPTIONS),
    WRITE_RETRY_OPTIONS,
  );
}

// ---------------------------------------------------------------------------
// Status readout — the 初始化后待办事项 (post-initialization TODO) list.
// ---------------------------------------------------------------------------

export type CaioProV1CompletionStatus = {
  state: CaioProV1CompletionGateState;
  items: CaioProV1CompletionItemAssessment[];
  missingItemKeys: CaioProV1CompletionAssessment["missingItemKeys"];
  liveAssessment: CaioProV1CompletionAssessment;
  receipt: CaioProV1CompletionGateReceipt | null;
  staleReasons: string[];
};

export async function getCaioProV1CompletionStatus(input: {
  workspaceId: string;
  actorUserId: string;
  now?: Date;
  english?: boolean;
}): Promise<CaioProV1CompletionStatus> {
  await assertPolicyAccess(input);
  const now = input.now ?? new Date();
  return db.$transaction(async (tx) => {
    const { assessment: live } = await computeLiveCompletionAssessment(tx, {
      workspaceId: input.workspaceId,
      now,
    });
    const preAcceptanceState: CaioProV1CompletionGateState =
      live.decision === "ready_for_owner_acceptance"
        ? "ready_for_owner_acceptance"
        : "not_ready";
    const head = await tx.caioProV1CompletionGateHead.findUnique({
      where: { workspaceId: input.workspaceId },
    });
    if (!head) {
      return {
        state: preAcceptanceState,
        items: live.items,
        missingItemKeys: live.missingItemKeys,
        liveAssessment: live,
        receipt: null,
        staleReasons: [],
      };
    }
    const [receiptRow, assessmentRow] = await Promise.all([
      tx.caioProV1CompletionGateReceipt.findFirst({
        where: {
          id: head.currentReceiptId,
          workspaceId: input.workspaceId,
        },
      }),
      tx.caioProV1CompletionAssessment.findFirst({
        where: {
          id: head.currentAssessmentId,
          workspaceId: input.workspaceId,
        },
      }),
    ]);
    if (!receiptRow || !assessmentRow) {
      throw new CaioProCompletionStoreError(
        "completion_gate_head_binding_invalid",
      );
    }
    const receipt = parseStoredCompletionGateReceipt(receiptRow);
    const stored = parseStoredCompletionAssessment(assessmentRow);
    assertCompletionHeadReceiptBinding(
      {
        workspaceId: head.workspaceId,
        currentAssessmentId: head.currentAssessmentId,
        currentReceiptId: head.currentReceiptId,
        sequence: head.sequence,
        version: head.version,
      },
      receipt,
    );
    assertCompletionReceiptAssessmentBinding(receipt, stored);
    await assertCompletionReceiptChainIntegrity(
      tx,
      input.workspaceId,
      receipt,
    );
    if (receipt.resultingStatus === ("revoked" satisfies CaioProV1CompletionGateReceiptStatus)) {
      return {
        state: "revoked",
        items: live.items,
        missingItemKeys: live.missingItemKeys,
        liveAssessment: live,
        receipt,
        staleReasons: [],
      };
    }
    const liveBinding = await tx.caioPrincipalBinding.findFirst({
      where: {
        id: receipt.ceoPrincipalBindingRef,
        workspaceId: input.workspaceId,
        userId: receipt.actorUserRef,
        principalRef: receipt.ceoPrincipalRef,
        principalKind: "ceo",
        revokedAt: null,
      },
      select: { id: true },
    });
    const staleReasons = uniqueSorted([
      ...(liveBinding ? [] : ["ceo_principal_binding_not_live"]),
      ...(live.basisHash === stored.basisHash &&
      live.decision === "ready_for_owner_acceptance"
        ? []
        : [
            "completion_assessment_basis_changed",
            ...live.missingItemKeys,
          ]),
    ]);
    // An accepted gate whose live evidence no longer matches fail-closes:
    // "site deployment complete" cannot survive drifting evidence.
    return {
      state: staleReasons.length === 0 ? "accepted" : preAcceptanceState,
      items: live.items,
      missingItemKeys: live.missingItemKeys,
      liveAssessment: live,
      receipt,
      staleReasons,
    };
  }, TRANSACTION_OPTIONS);
}
