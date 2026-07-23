import "server-only";

import {
  ActorType,
  MembershipStatus,
  Prisma,
} from "@prisma/client";
import type {
  CaioOperatingQuestionGenerationReceipt as StoredGenerationReceiptRow,
  CaioOperatingQuestionImplementationPlan as StoredImplementationPlanRow,
  CaioOperatingQuestionPortfolio as StoredPortfolioRow,
  CaioOperatingQuestionPortfolioHead as StoredPortfolioHeadRow,
  CaioQuestionSelectionHead as StoredSelectionHeadRow,
  CaioQuestionSelectionReceipt as StoredSelectionReceiptRow,
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

import {
  loadCurrentAcceptedCaioInitializationContextForUpdate,
  type CurrentAcceptedCaioInitializationContext,
} from "./caio-initialization-gate-store.service";
import { projectCaioSelectedOperatingQuestionToDecision } from "./caio-operating-question-decision";
import {
  createCaioOperatingQuestionImplementationPlan,
  validateCaioOperatingQuestionImplementationPlan,
  validateCaioOperatingQuestionImplementationPlanAgainstContext,
  type CaioOperatingQuestionImplementationPlan,
} from "./caio-operating-question-implementation-plan";
import {
  createCaioOperatingQuestionG0Context,
  createCaioOperatingQuestionGenerationReceipt,
  evaluateCaioOperatingQuestionGeneration,
  validateCaioOperatingQuestionGenerationReceipt,
  validateCaioOperatingQuestionGenerationReceiptAgainstG0,
  validateCaioOperatingQuestionGenerationReceiptAgainstPortfolio,
  validateCaioOperatingQuestionGenerationReceiptAgainstPrevious,
  validateCaioOperatingQuestionPortfolio,
  validateCaioOperatingQuestionPortfolioAgainstG0,
  validateCaioOperatingQuestionPortfolioAgainstPrevious,
  type CaioOperatingQuestionG0Context,
  type CaioOperatingQuestionGenerationReceipt,
  type CaioOperatingQuestionPortfolio,
} from "./caio-operating-question";
import { createStage1DecisionRecordInTransaction } from "./decision-follow-through.service";
import {
  createCaioQuestionSelectionReceipt,
  validateCaioQuestionSelectionReceipt,
  validateCaioQuestionSelectionReceiptAgainstPortfolio,
  validateCaioQuestionSelectionReceiptAgainstPrevious,
  type CaioQuestionSelectionReceipt,
} from "./caio-question-selection";

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

type TrustedOperatingQuestionContext = {
  initialization: CurrentAcceptedCaioInitializationContext;
  g0Context: CaioOperatingQuestionG0Context;
};

type CurrentGenerationState = {
  head: StoredPortfolioHeadRow | null;
  previousReceipt: CaioOperatingQuestionGenerationReceipt | null;
  previousPortfolio: CaioOperatingQuestionPortfolio | null;
};

type CurrentSelectionState = {
  head: StoredSelectionHeadRow | null;
  previousReceipt: CaioQuestionSelectionReceipt | null;
};

export class CaioOperatingQuestionStoreError extends Error {
  readonly reasons: readonly string[];

  constructor(message: string, reasons: readonly string[] = []) {
    super(reasons.length > 0 ? `${message}: ${reasons.join("; ")}` : message);
    this.name = "CaioOperatingQuestionStoreError";
    this.reasons = reasons;
  }
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

function nonEmpty(value: string, reason: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new CaioOperatingQuestionStoreError(reason);
  }
  return normalized;
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

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return canonicalJson(uniqueSorted(left)) === canonicalJson(uniqueSorted(right));
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === "P2002"
  );
}

function hashRequest(value: unknown): string {
  try {
    return sha256(canonicalJson(value));
  } catch {
    throw new CaioOperatingQuestionStoreError(
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
    throw new CaioOperatingQuestionStoreError(
      "workspace_policy_access_lost",
    );
  }
}

function parseStoredPortfolio(
  row: StoredPortfolioRow,
): CaioOperatingQuestionPortfolio {
  const portfolio = safeParseJson<CaioOperatingQuestionPortfolio | null>(
    row.portfolioJson,
    null,
  );
  const evidenceRefs = parseStrictStringArray(row.evidenceRefs);
  const auditRefs = parseStrictStringArray(row.auditRefs);
  if (!portfolio || !evidenceRefs || !auditRefs) {
    throw new CaioOperatingQuestionStoreError(
      "stored_question_portfolio_json_invalid",
    );
  }
  const validation = validateCaioOperatingQuestionPortfolio(portfolio);
  if (
    !validation.valid ||
    portfolio.portfolioId !== row.id ||
    portfolio.workspaceRef !== `workspace:${row.workspaceId}` ||
    portfolio.gateReceiptRef !== row.initializationGateReceiptId ||
    portfolio.assessmentRef !== row.initializationAssessmentId ||
    portfolio.previousPortfolioRef !== row.previousPortfolioId ||
    portfolio.sequence !== row.sequence ||
    portfolio.generationKey !== row.generationKey ||
    portfolio.generationInputHash !== row.generationInputHash ||
    portfolio.generatorRevision !== row.generatorRevision ||
    portfolio.generatorRef !== row.generatorRef ||
    portfolio.modelRef !== row.modelRef ||
    portfolio.policyRef !== row.policyRef ||
    portfolio.policyHash !== row.policyHash ||
    portfolio.g0ContextHash !== row.g0ContextHash ||
    portfolio.evidenceUniverseHash !== row.evidenceUniverseHash ||
    !sameStrings(portfolio.evidenceRefs, evidenceRefs) ||
    !sameStrings(portfolio.auditRefs, auditRefs) ||
    portfolio.contentHash !== row.contentHash ||
    portfolio.authorityEffect !== row.authorityEffect ||
    portfolio.generatedAt !== row.generatedAt.toISOString()
  ) {
    throw new CaioOperatingQuestionStoreError(
      "stored_question_portfolio_binding_invalid",
      validation.errors,
    );
  }
  return portfolio;
}

function parseStoredGenerationReceipt(
  row: StoredGenerationReceiptRow,
): CaioOperatingQuestionGenerationReceipt {
  const receipt =
    safeParseJson<CaioOperatingQuestionGenerationReceipt | null>(
      row.receiptJson,
      null,
    );
  const evidenceRefs = parseStrictStringArray(row.evidenceRefs);
  const gapCodes = parseStrictStringArray(row.gapCodes);
  if (!receipt || !evidenceRefs || !gapCodes) {
    throw new CaioOperatingQuestionStoreError(
      "stored_question_generation_receipt_json_invalid",
    );
  }
  const validation = validateCaioOperatingQuestionGenerationReceipt(receipt);
  if (
    !validation.valid ||
    receipt.receiptId !== row.id ||
    receipt.workspaceRef !== `workspace:${row.workspaceId}` ||
    receipt.gateReceiptRef !== row.initializationGateReceiptId ||
    receipt.assessmentRef !== row.initializationAssessmentId ||
    receipt.portfolioRef !== row.portfolioId ||
    receipt.previousReceiptRef !== row.previousReceiptId ||
    receipt.previousReceiptHash !== row.previousReceiptHash ||
    receipt.sequence !== row.sequence ||
    receipt.generationKey !== row.generationKey ||
    receipt.generationInputHash !== row.generationInputHash ||
    receipt.status !== row.status ||
    !sameStrings(receipt.evidenceRefs, evidenceRefs) ||
    !sameStrings(receipt.gapCodes, gapCodes) ||
    receipt.generatorRevision !== row.generatorRevision ||
    receipt.policyRef !== row.policyRef ||
    receipt.policyHash !== row.policyHash ||
    receipt.contentHash !== row.contentHash ||
    receipt.authorityEffect !== row.authorityEffect ||
    receipt.recordedAt !== row.recordedAt.toISOString()
  ) {
    throw new CaioOperatingQuestionStoreError(
      "stored_question_generation_receipt_binding_invalid",
      validation.errors,
    );
  }
  return receipt;
}

function parseStoredSelectionReceipt(
  row: StoredSelectionReceiptRow,
): CaioQuestionSelectionReceipt {
  const receipt = safeParseJson<CaioQuestionSelectionReceipt | null>(
    row.receiptJson,
    null,
  );
  const selections = safeParseJson<unknown[] | null>(row.selectionsJson, null);
  const selectedQuestionIds = parseStrictStringArray(row.selectedQuestionIds);
  const reasonCodes = parseStrictStringArray(row.reasonCodes);
  const evidenceRefs = parseStrictStringArray(row.evidenceRefs);
  if (
    !receipt ||
    !selections ||
    !selectedQuestionIds ||
    !reasonCodes ||
    !evidenceRefs
  ) {
    throw new CaioOperatingQuestionStoreError(
      "stored_question_selection_receipt_json_invalid",
    );
  }
  const validation = validateCaioQuestionSelectionReceipt(receipt);
  if (
    !validation.valid ||
    receipt.receiptId !== row.id ||
    receipt.workspaceRef !== `workspace:${row.workspaceId}` ||
    receipt.portfolioRef !== row.portfolioId ||
    receipt.gateReceiptRef !== row.initializationGateReceiptId ||
    receipt.ceoPrincipalBindingRef !== row.ceoPrincipalBindingId ||
    receipt.previousReceiptRef !== row.previousReceiptId ||
    receipt.previousReceiptHash !== row.previousReceiptHash ||
    receipt.sequence !== row.sequence ||
    receipt.idempotencyKey !== row.idempotencyKey ||
    row.actorType !== ActorType.USER ||
    receipt.actorUserRef !== row.actorUserId ||
    receipt.ceoPrincipalRef !== row.ceoPrincipalRef ||
    canonicalJson(receipt.selections) !== canonicalJson(selections) ||
    !sameStrings(receipt.selectedQuestionIds, selectedQuestionIds) ||
    !sameStrings(receipt.reasonCodes, reasonCodes) ||
    !sameStrings(receipt.evidenceRefs, evidenceRefs) ||
    receipt.contentHash !== row.contentHash ||
    receipt.authorityEffect !== row.authorityEffect ||
    receipt.workPacketEffect !== row.workPacketEffect ||
    receipt.selectedAt !== row.selectedAt.toISOString()
  ) {
    throw new CaioOperatingQuestionStoreError(
      "stored_question_selection_receipt_binding_invalid",
      validation.errors,
    );
  }
  return receipt;
}

function parseStoredImplementationPlan(
  row: StoredImplementationPlanRow,
  input: {
    portfolio: CaioOperatingQuestionPortfolio;
    selectionReceipt: CaioQuestionSelectionReceipt;
    decisionBindingId: string;
    decisionRecordId: string;
    actorUserId: string;
    questionId: string;
    candidateHash: string;
  },
): CaioOperatingQuestionImplementationPlan {
  const plan =
    safeParseJson<CaioOperatingQuestionImplementationPlan | null>(
      row.planJson,
      null,
    );
  const gapCodes = parseStrictStringArray(row.gapCodes);
  if (!plan || !gapCodes) {
    throw new CaioOperatingQuestionStoreError(
      "stored_question_implementation_plan_json_invalid",
    );
  }
  const validation =
    validateCaioOperatingQuestionImplementationPlan(plan);
  const contextValidation =
    validateCaioOperatingQuestionImplementationPlanAgainstContext(plan, {
      portfolio: input.portfolio,
      selectionReceipt: input.selectionReceipt,
      decisionRecordRef: input.decisionRecordId,
    });
  if (
    !validation.valid ||
    !contextValidation.valid ||
    plan.planId !== row.id ||
    plan.workspaceRef !== `workspace:${row.workspaceId}` ||
    plan.portfolioRef !== row.portfolioId ||
    plan.selectionReceiptRef !== row.selectionReceiptId ||
    plan.questionId !== row.questionId ||
    plan.candidateHash !== row.candidateHash ||
    plan.decisionRecordRef !== row.decisionRecordId ||
    row.workspaceId !==
      input.portfolio.workspaceRef.replace("workspace:", "") ||
    row.selectionReceiptId !== input.selectionReceipt.receiptId ||
    row.portfolioId !== input.portfolio.portfolioId ||
    row.questionId !== input.questionId ||
    row.candidateHash !== input.candidateHash ||
    row.decisionBindingId !== input.decisionBindingId ||
    row.decisionRecordId !== input.decisionRecordId ||
    row.actorUserId !== input.actorUserId ||
    plan.status !== row.status ||
    plan.implementationReadiness !== row.implementationReadiness ||
    canonicalJson(plan.gapCodes) !== canonicalJson(gapCodes) ||
    plan.authorityEffect !== row.authorityEffect ||
    plan.workPacketEffect !== row.workPacketEffect ||
    plan.createdAt !== row.plannedAt.toISOString() ||
    plan.contentHash !== row.contentHash
  ) {
    throw new CaioOperatingQuestionStoreError(
      "stored_question_implementation_plan_binding_invalid",
      uniqueSorted([
        ...validation.errors,
        ...contextValidation.errors,
      ]),
    );
  }
  return plan;
}

async function loadTrustedContextForUpdate(
  tx: Tx,
  input: {
    workspaceId: string;
    at: Date;
  },
): Promise<TrustedOperatingQuestionContext> {
  const initialization =
    await loadCurrentAcceptedCaioInitializationContextForUpdate(tx, input);
  const g0Context = createCaioOperatingQuestionG0Context({
    assessmentInput: initialization.assessmentInput,
    assessment: initialization.assessment,
    gateReceipt: initialization.receipt,
    currentHead: initialization.head,
  });
  return { initialization, g0Context };
}

async function readPortfolioHeadForUpdate(
  tx: Tx,
  workspaceId: string,
): Promise<StoredPortfolioHeadRow | null> {
  const rows = await tx.$queryRaw<StoredPortfolioHeadRow[]>`
    SELECT workspaceId, initializationGateReceiptId,
           initializationAssessmentId, currentGenerationReceiptId,
           currentPortfolioId, generationSequence, portfolioSequence,
           version, updatedAt
    FROM CaioOperatingQuestionPortfolioHead
    WHERE workspaceId = ${workspaceId}
    FOR UPDATE`;
  return rows[0] ?? null;
}

async function readSelectionHeadForUpdate(
  tx: Tx,
  workspaceId: string,
): Promise<StoredSelectionHeadRow | null> {
  const rows = await tx.$queryRaw<StoredSelectionHeadRow[]>`
    SELECT workspaceId, currentPortfolioId, currentGateReceiptId,
           currentReceiptId, sequence, version, updatedAt
    FROM CaioQuestionSelectionHead
    WHERE workspaceId = ${workspaceId}
    FOR UPDATE`;
  return rows[0] ?? null;
}

async function assertPortfolioChainIntegrity(
  tx: Tx,
  input: {
    workspaceId: string;
    gateReceiptId: string;
    g0Context: CaioOperatingQuestionG0Context;
    headPortfolio: CaioOperatingQuestionPortfolio;
  },
): Promise<void> {
  const visited = new Set<string>();
  let current = input.headPortfolio;
  while (true) {
    if (visited.has(current.portfolioId)) {
      throw new CaioOperatingQuestionStoreError(
        "question_portfolio_chain_cycle",
      );
    }
    visited.add(current.portfolioId);
    const contextValidation = validateCaioOperatingQuestionPortfolioAgainstG0(
      current,
      input.g0Context,
    );
    if (!contextValidation.valid) {
      throw new CaioOperatingQuestionStoreError(
        "question_portfolio_g0_binding_invalid",
        contextValidation.errors,
      );
    }
    if (current.sequence === 1) {
      const rootValidation =
        validateCaioOperatingQuestionPortfolioAgainstPrevious(current, null);
      if (!rootValidation.valid) {
        throw new CaioOperatingQuestionStoreError(
          "question_portfolio_chain_root_invalid",
          rootValidation.errors,
        );
      }
      return;
    }
    if (!current.previousPortfolioRef || !current.previousPortfolioHash) {
      throw new CaioOperatingQuestionStoreError(
        "question_portfolio_predecessor_missing",
      );
    }
    const previousRow = await tx.caioOperatingQuestionPortfolio.findFirst({
      where: {
        id: current.previousPortfolioRef,
        workspaceId: input.workspaceId,
        initializationGateReceiptId: input.gateReceiptId,
      },
    });
    if (!previousRow) {
      throw new CaioOperatingQuestionStoreError(
        "question_portfolio_predecessor_missing",
      );
    }
    const previous = parseStoredPortfolio(previousRow);
    const chainValidation =
      validateCaioOperatingQuestionPortfolioAgainstPrevious(
        current,
        previous,
      );
    if (
      !chainValidation.valid ||
      previous.contentHash !== current.previousPortfolioHash
    ) {
      throw new CaioOperatingQuestionStoreError(
        "question_portfolio_chain_invalid",
        chainValidation.errors,
      );
    }
    current = previous;
  }
}

async function assertGenerationReceiptChainIntegrity(
  tx: Tx,
  input: {
    workspaceId: string;
    gateReceiptId: string;
    g0Context: CaioOperatingQuestionG0Context;
    headReceipt: CaioOperatingQuestionGenerationReceipt;
  },
): Promise<void> {
  const visited = new Set<string>();
  let current = input.headReceipt;
  while (true) {
    if (visited.has(current.receiptId)) {
      throw new CaioOperatingQuestionStoreError(
        "question_generation_receipt_chain_cycle",
      );
    }
    visited.add(current.receiptId);
    const contextValidation =
      validateCaioOperatingQuestionGenerationReceiptAgainstG0(
        current,
        input.g0Context,
      );
    if (!contextValidation.valid) {
      throw new CaioOperatingQuestionStoreError(
        "question_generation_receipt_g0_binding_invalid",
        contextValidation.errors,
      );
    }
    if (current.sequence === 1) {
      const rootValidation =
        validateCaioOperatingQuestionGenerationReceiptAgainstPrevious(
          current,
          null,
        );
      if (!rootValidation.valid) {
        throw new CaioOperatingQuestionStoreError(
          "question_generation_receipt_chain_root_invalid",
          rootValidation.errors,
        );
      }
      return;
    }
    if (!current.previousReceiptRef || !current.previousReceiptHash) {
      throw new CaioOperatingQuestionStoreError(
        "question_generation_receipt_predecessor_missing",
      );
    }
    const previousRow =
      await tx.caioOperatingQuestionGenerationReceipt.findFirst({
        where: {
          id: current.previousReceiptRef,
          workspaceId: input.workspaceId,
          initializationGateReceiptId: input.gateReceiptId,
        },
      });
    if (!previousRow) {
      throw new CaioOperatingQuestionStoreError(
        "question_generation_receipt_predecessor_missing",
      );
    }
    const previous = parseStoredGenerationReceipt(previousRow);
    const chainValidation =
      validateCaioOperatingQuestionGenerationReceiptAgainstPrevious(
        current,
        previous,
      );
    if (
      !chainValidation.valid ||
      previous.contentHash !== current.previousReceiptHash
    ) {
      throw new CaioOperatingQuestionStoreError(
        "question_generation_receipt_chain_invalid",
        chainValidation.errors,
      );
    }
    current = previous;
  }
}

async function loadCurrentGenerationState(
  tx: Tx,
  input: {
    workspaceId: string;
    trusted: TrustedOperatingQuestionContext;
  },
): Promise<CurrentGenerationState> {
  const head = await readPortfolioHeadForUpdate(tx, input.workspaceId);
  if (
    !head ||
    head.initializationGateReceiptId !==
      input.trusted.g0Context.gateReceiptRef
  ) {
    return {
      head,
      previousReceipt: null,
      previousPortfolio: null,
    };
  }
  if (
    head.initializationAssessmentId !==
      input.trusted.g0Context.assessmentRef
  ) {
    throw new CaioOperatingQuestionStoreError(
      "question_portfolio_head_assessment_invalid",
    );
  }
  const receiptRow =
    await tx.caioOperatingQuestionGenerationReceipt.findFirst({
      where: {
        id: head.currentGenerationReceiptId,
        workspaceId: input.workspaceId,
        initializationGateReceiptId: head.initializationGateReceiptId,
      },
    });
  if (!receiptRow) {
    throw new CaioOperatingQuestionStoreError(
      "question_portfolio_head_receipt_missing",
    );
  }
  const previousReceipt = parseStoredGenerationReceipt(receiptRow);
  if (previousReceipt.sequence !== head.generationSequence) {
    throw new CaioOperatingQuestionStoreError(
      "question_portfolio_head_receipt_binding_invalid",
    );
  }
  await assertGenerationReceiptChainIntegrity(tx, {
    workspaceId: input.workspaceId,
    gateReceiptId: head.initializationGateReceiptId,
    g0Context: input.trusted.g0Context,
    headReceipt: previousReceipt,
  });
  let previousPortfolio: CaioOperatingQuestionPortfolio | null = null;
  if (head.currentPortfolioId) {
    const portfolioRow = await tx.caioOperatingQuestionPortfolio.findFirst({
      where: {
        id: head.currentPortfolioId,
        workspaceId: input.workspaceId,
        initializationGateReceiptId: head.initializationGateReceiptId,
      },
    });
    if (!portfolioRow) {
      throw new CaioOperatingQuestionStoreError(
        "question_portfolio_head_portfolio_missing",
      );
    }
    previousPortfolio = parseStoredPortfolio(portfolioRow);
    if (previousPortfolio.sequence !== head.portfolioSequence) {
      throw new CaioOperatingQuestionStoreError(
        "question_portfolio_head_portfolio_binding_invalid",
      );
    }
    await assertPortfolioChainIntegrity(tx, {
      workspaceId: input.workspaceId,
      gateReceiptId: head.initializationGateReceiptId,
      g0Context: input.trusted.g0Context,
      headPortfolio: previousPortfolio,
    });
  } else if (head.portfolioSequence !== 0) {
    throw new CaioOperatingQuestionStoreError(
      "question_portfolio_head_sequence_invalid",
    );
  }
  if (
    previousReceipt.status === "generated" &&
    previousReceipt.portfolioRef !== previousPortfolio?.portfolioId
  ) {
    throw new CaioOperatingQuestionStoreError(
      "question_portfolio_head_outcome_binding_invalid",
    );
  }
  return { head, previousReceipt, previousPortfolio };
}

async function updatePortfolioHead(
  tx: Tx,
  input: {
    workspaceId: string;
    gateReceiptId: string;
    assessmentId: string;
    generationReceipt: CaioOperatingQuestionGenerationReceipt;
    portfolio: CaioOperatingQuestionPortfolio | null;
    previousPortfolio: CaioOperatingQuestionPortfolio | null;
    previousHead: StoredPortfolioHeadRow | null;
  },
): Promise<void> {
  const currentPortfolio = input.portfolio ?? input.previousPortfolio;
  if (!input.previousHead) {
    await tx.caioOperatingQuestionPortfolioHead.create({
      data: {
        workspaceId: input.workspaceId,
        initializationGateReceiptId: input.gateReceiptId,
        initializationAssessmentId: input.assessmentId,
        currentGenerationReceiptId: input.generationReceipt.receiptId,
        currentPortfolioId: currentPortfolio?.portfolioId ?? null,
        generationSequence: input.generationReceipt.sequence,
        portfolioSequence: currentPortfolio?.sequence ?? 0,
        version: 1,
      },
    });
    return;
  }
  const updated = await tx.caioOperatingQuestionPortfolioHead.updateMany({
    where: {
      workspaceId: input.workspaceId,
      initializationGateReceiptId:
        input.previousHead.initializationGateReceiptId,
      currentGenerationReceiptId:
        input.previousHead.currentGenerationReceiptId,
      currentPortfolioId: input.previousHead.currentPortfolioId,
      generationSequence: input.previousHead.generationSequence,
      portfolioSequence: input.previousHead.portfolioSequence,
      version: input.previousHead.version,
    },
    data: {
      initializationGateReceiptId: input.gateReceiptId,
      initializationAssessmentId: input.assessmentId,
      currentGenerationReceiptId: input.generationReceipt.receiptId,
      currentPortfolioId: currentPortfolio?.portfolioId ?? null,
      generationSequence: input.generationReceipt.sequence,
      portfolioSequence: currentPortfolio?.sequence ?? 0,
      version: { increment: 1 },
    },
  });
  if (updated.count !== 1) {
    throw new CaioOperatingQuestionStoreError(
      "question_portfolio_head_concurrent_update",
    );
  }
}

export async function generateCaioOperatingQuestionPortfolio(input: {
  workspaceId: string;
  actorUserId: string;
  generationKey: string;
  generatorRef: string;
  modelRef: string;
  candidates: unknown;
  auditRefs: string[];
  now?: Date;
  english?: boolean;
}): Promise<{
  receipt: CaioOperatingQuestionGenerationReceipt;
  portfolio: CaioOperatingQuestionPortfolio | null;
  replayed: boolean;
}> {
  await assertPolicyAccess(input);
  const generationKey = nonEmpty(
    input.generationKey,
    "generation_key_required",
  );
  const generatorRef = nonEmpty(input.generatorRef, "generator_ref_required");
  const modelRef = nonEmpty(input.modelRef, "model_ref_required");
  const auditRefs = uniqueSorted(input.auditRefs);
  if (auditRefs.length === 0) {
    throw new CaioOperatingQuestionStoreError("audit_ref_required");
  }
  const now = input.now ?? new Date();
  return runWithWriteConflictRetry(
    () =>
      db.$transaction(async (tx) => {
        const trusted = await loadTrustedContextForUpdate(tx, {
          workspaceId: input.workspaceId,
          at: now,
        });
        await assertPolicyAccessInTransaction(tx, input);
        const state = await loadCurrentGenerationState(tx, {
          workspaceId: input.workspaceId,
          trusted,
        });
        const requestHash = hashRequest({
          g0ContextHash: trusted.g0Context.contentHash,
          generationKey,
          generatorRef,
          modelRef,
          candidates: input.candidates,
          auditRefs,
        });
        const existing =
          await tx.caioOperatingQuestionGenerationReceipt.findUnique({
            where: {
              workspaceId_initializationGateReceiptId_generationKey: {
                workspaceId: input.workspaceId,
                initializationGateReceiptId:
                  trusted.g0Context.gateReceiptRef,
                generationKey,
              },
            },
          });
        if (existing) {
          if (existing.requestHash !== requestHash) {
            throw new CaioOperatingQuestionStoreError(
              "generation_key_payload_conflict",
            );
          }
          if (
            !state.head ||
            state.head.currentGenerationReceiptId !== existing.id
          ) {
            throw new CaioOperatingQuestionStoreError(
              "generation_receipt_no_longer_current",
            );
          }
          const receipt = parseStoredGenerationReceipt(existing);
          const receiptValidation =
            validateCaioOperatingQuestionGenerationReceiptAgainstG0(
              receipt,
              trusted.g0Context,
            );
          if (!receiptValidation.valid) {
            throw new CaioOperatingQuestionStoreError(
              "stored_question_generation_receipt_g0_invalid",
              receiptValidation.errors,
            );
          }
          const portfolio =
            receipt.portfolioRef === null
              ? null
              : state.previousPortfolio?.portfolioId === receipt.portfolioRef
                ? state.previousPortfolio
                : null;
          if (receipt.portfolioRef !== null && !portfolio) {
            throw new CaioOperatingQuestionStoreError(
              "generation_receipt_portfolio_missing",
            );
          }
          const outcomeValidation =
            validateCaioOperatingQuestionGenerationReceiptAgainstPortfolio(
              receipt,
              portfolio,
            );
          if (!outcomeValidation.valid) {
            throw new CaioOperatingQuestionStoreError(
              "generation_receipt_portfolio_binding_invalid",
              outcomeValidation.errors,
            );
          }
          return { receipt, portfolio, replayed: true };
        }
        const evaluation = evaluateCaioOperatingQuestionGeneration({
          g0Context: trusted.g0Context,
          generationKey,
          generatorRef,
          modelRef,
          candidates: input.candidates,
          generatedAt: now.toISOString(),
          auditRefs,
          previousPortfolio: state.previousPortfolio,
        });
        const portfolio = evaluation.portfolio;
        if (portfolio) {
          const portfolioValidation =
            validateCaioOperatingQuestionPortfolioAgainstPrevious(
              portfolio,
              state.previousPortfolio,
            );
          if (!portfolioValidation.valid) {
            throw new CaioOperatingQuestionStoreError(
              "computed_question_portfolio_chain_invalid",
              portfolioValidation.errors,
            );
          }
          await tx.caioOperatingQuestionPortfolio.create({
            data: {
              id: portfolio.portfolioId,
              workspaceId: input.workspaceId,
              initializationGateReceiptId:
                trusted.g0Context.gateReceiptRef,
              initializationAssessmentId:
                trusted.g0Context.assessmentRef,
              previousPortfolioId: portfolio.previousPortfolioRef,
              sequence: portfolio.sequence,
              generationKey: portfolio.generationKey,
              generationInputHash: portfolio.generationInputHash,
              generatorRevision: portfolio.generatorRevision,
              generatorRef: portfolio.generatorRef,
              modelRef: portfolio.modelRef,
              policyRef: portfolio.policyRef,
              policyHash: portfolio.policyHash,
              g0ContextHash: portfolio.g0ContextHash,
              evidenceUniverseHash: portfolio.evidenceUniverseHash,
              evidenceRefs: jsonStringify(portfolio.evidenceRefs),
              auditRefs: jsonStringify(portfolio.auditRefs),
              portfolioJson: jsonStringify(portfolio),
              contentHash: portfolio.contentHash,
              authorityEffect: portfolio.authorityEffect,
              generatedAt: new Date(portfolio.generatedAt),
            },
          });
        }
        const receipt = createCaioOperatingQuestionGenerationReceipt({
          evaluation,
          previousReceipt: state.previousReceipt,
          evidenceRefs:
            portfolio?.evidenceRefs ?? trusted.g0Context.evidenceRefs,
          recordedAt: now.toISOString(),
        });
        const outcomeValidation =
          validateCaioOperatingQuestionGenerationReceiptAgainstPortfolio(
            receipt,
            portfolio,
          );
        if (!outcomeValidation.valid) {
          throw new CaioOperatingQuestionStoreError(
            "computed_generation_receipt_portfolio_binding_invalid",
            outcomeValidation.errors,
          );
        }
        try {
          await tx.caioOperatingQuestionGenerationReceipt.create({
            data: {
              id: receipt.receiptId,
              workspaceId: input.workspaceId,
              initializationGateReceiptId:
                trusted.g0Context.gateReceiptRef,
              initializationAssessmentId:
                trusted.g0Context.assessmentRef,
              portfolioId: receipt.portfolioRef,
              previousReceiptId: receipt.previousReceiptRef,
              previousReceiptHash: receipt.previousReceiptHash,
              sequence: receipt.sequence,
              generationKey: receipt.generationKey,
              requestHash,
              generationInputHash: receipt.generationInputHash,
              status: receipt.status,
              evidenceRefs: jsonStringify(receipt.evidenceRefs),
              gapCodes: jsonStringify(receipt.gapCodes),
              generatorRevision: receipt.generatorRevision,
              policyRef: receipt.policyRef,
              policyHash: receipt.policyHash,
              receiptJson: jsonStringify(receipt),
              contentHash: receipt.contentHash,
              authorityEffect: receipt.authorityEffect,
              recordedAt: new Date(receipt.recordedAt),
            },
          });
        } catch (error) {
          if (isUniqueConstraintViolation(error)) {
            throw new CaioOperatingQuestionStoreError(
              "question_generation_concurrent_conflict",
            );
          }
          throw error;
        }
        await updatePortfolioHead(tx, {
          workspaceId: input.workspaceId,
          gateReceiptId: trusted.g0Context.gateReceiptRef,
          assessmentId: trusted.g0Context.assessmentRef,
          generationReceipt: receipt,
          portfolio,
          previousPortfolio: state.previousPortfolio,
          previousHead: state.head,
        });
        await writeAuditLog(
          {
            workspaceId: input.workspaceId,
            userId: input.actorUserId,
            actor: input.actorUserId,
            actorType: ActorType.USER,
            actionType: "CAIO_OPERATING_QUESTIONS_GENERATED",
            targetType: "CaioOperatingQuestionGenerationReceipt",
            targetId: receipt.receiptId,
            summary:
              "CAIO operating questions evaluated against the current accepted G0 evidence (review only; grants nothing)",
            relatedObjectType: portfolio
              ? "CaioOperatingQuestionPortfolio"
              : "CaioInitializationGateReceipt",
            relatedObjectId:
              portfolio?.portfolioId ?? trusted.g0Context.gateReceiptRef,
            payload: {
              status: receipt.status,
              generationKey: receipt.generationKey,
              portfolioRef: receipt.portfolioRef,
              gapCodes: receipt.gapCodes,
              authorityEffect: receipt.authorityEffect,
            },
          },
          { client: tx },
        );
        return { receipt, portfolio, replayed: false };
      }, TRANSACTION_OPTIONS),
    WRITE_RETRY_OPTIONS,
  );
}

async function assertSelectionChainIntegrity(
  tx: Tx,
  input: {
    workspaceId: string;
    portfolio: CaioOperatingQuestionPortfolio;
    headReceipt: CaioQuestionSelectionReceipt;
  },
): Promise<void> {
  const visited = new Set<string>();
  let current = input.headReceipt;
  while (true) {
    if (visited.has(current.receiptId)) {
      throw new CaioOperatingQuestionStoreError(
        "question_selection_receipt_chain_cycle",
      );
    }
    visited.add(current.receiptId);
    const portfolioValidation =
      validateCaioQuestionSelectionReceiptAgainstPortfolio(
        current,
        input.portfolio,
      );
    if (!portfolioValidation.valid) {
      throw new CaioOperatingQuestionStoreError(
        "question_selection_portfolio_binding_invalid",
        portfolioValidation.errors,
      );
    }
    if (current.sequence === 1) {
      const rootValidation =
        validateCaioQuestionSelectionReceiptAgainstPrevious(current, null);
      if (!rootValidation.valid) {
        throw new CaioOperatingQuestionStoreError(
          "question_selection_chain_root_invalid",
          rootValidation.errors,
        );
      }
      return;
    }
    if (!current.previousReceiptRef || !current.previousReceiptHash) {
      throw new CaioOperatingQuestionStoreError(
        "question_selection_predecessor_missing",
      );
    }
    const previousRow = await tx.caioQuestionSelectionReceipt.findFirst({
      where: {
        id: current.previousReceiptRef,
        workspaceId: input.workspaceId,
        portfolioId: input.portfolio.portfolioId,
      },
    });
    if (!previousRow) {
      throw new CaioOperatingQuestionStoreError(
        "question_selection_predecessor_missing",
      );
    }
    const previous = parseStoredSelectionReceipt(previousRow);
    const chainValidation =
      validateCaioQuestionSelectionReceiptAgainstPrevious(current, previous);
    if (
      !chainValidation.valid ||
      previous.contentHash !== current.previousReceiptHash
    ) {
      throw new CaioOperatingQuestionStoreError(
        "question_selection_chain_invalid",
        chainValidation.errors,
      );
    }
    current = previous;
  }
}

async function loadCurrentSelectionState(
  tx: Tx,
  input: {
    workspaceId: string;
    portfolio: CaioOperatingQuestionPortfolio;
  },
): Promise<CurrentSelectionState> {
  const head = await readSelectionHeadForUpdate(tx, input.workspaceId);
  if (!head || head.currentPortfolioId !== input.portfolio.portfolioId) {
    return { head, previousReceipt: null };
  }
  if (
    head.currentGateReceiptId !== input.portfolio.gateReceiptRef
  ) {
    throw new CaioOperatingQuestionStoreError(
      "question_selection_head_gate_invalid",
    );
  }
  const receiptRow = await tx.caioQuestionSelectionReceipt.findFirst({
    where: {
      id: head.currentReceiptId,
      workspaceId: input.workspaceId,
      portfolioId: input.portfolio.portfolioId,
    },
  });
  if (!receiptRow) {
    throw new CaioOperatingQuestionStoreError(
      "question_selection_head_receipt_missing",
    );
  }
  const previousReceipt = parseStoredSelectionReceipt(receiptRow);
  if (previousReceipt.sequence !== head.sequence) {
    throw new CaioOperatingQuestionStoreError(
      "question_selection_head_receipt_binding_invalid",
    );
  }
  await assertSelectionChainIntegrity(tx, {
    workspaceId: input.workspaceId,
    portfolio: input.portfolio,
    headReceipt: previousReceipt,
  });
  return { head, previousReceipt };
}

async function updateSelectionHead(
  tx: Tx,
  input: {
    workspaceId: string;
    portfolio: CaioOperatingQuestionPortfolio;
    receipt: CaioQuestionSelectionReceipt;
    previousHead: StoredSelectionHeadRow | null;
  },
): Promise<void> {
  if (!input.previousHead) {
    await tx.caioQuestionSelectionHead.create({
      data: {
        workspaceId: input.workspaceId,
        currentPortfolioId: input.portfolio.portfolioId,
        currentGateReceiptId: input.portfolio.gateReceiptRef,
        currentReceiptId: input.receipt.receiptId,
        sequence: input.receipt.sequence,
        version: 1,
      },
    });
    return;
  }
  const updated = await tx.caioQuestionSelectionHead.updateMany({
    where: {
      workspaceId: input.workspaceId,
      currentPortfolioId: input.previousHead.currentPortfolioId,
      currentGateReceiptId: input.previousHead.currentGateReceiptId,
      currentReceiptId: input.previousHead.currentReceiptId,
      sequence: input.previousHead.sequence,
      version: input.previousHead.version,
    },
    data: {
      currentPortfolioId: input.portfolio.portfolioId,
      currentGateReceiptId: input.portfolio.gateReceiptRef,
      currentReceiptId: input.receipt.receiptId,
      sequence: input.receipt.sequence,
      version: { increment: 1 },
    },
  });
  if (updated.count !== 1) {
    throw new CaioOperatingQuestionStoreError(
      "question_selection_head_concurrent_update",
    );
  }
}

function governedKnowledgeRefs(
  initialization: CurrentAcceptedCaioInitializationContext,
): string[] {
  const refs = [
    ...initialization.assessmentInput.assets.flatMap((asset) =>
      asset.companyMemoryBindings.map((binding) => binding.ref),
    ),
    initialization.assessmentInput.knowledge.temporalContextArtifactRef,
  ];
  return uniqueSorted(
    refs.filter((ref): ref is string => typeof ref === "string"),
  );
}

export async function selectCaioOperatingQuestions(input: {
  workspaceId: string;
  expectedPortfolioId: string;
  actorUserId: string;
  ceoPrincipalRef: string;
  idempotencyKey: string;
  selections: unknown;
  reasonCodes: string[];
  evidenceRefs: string[];
  now?: Date;
  english?: boolean;
}): Promise<{
  receipt: CaioQuestionSelectionReceipt;
  portfolio: CaioOperatingQuestionPortfolio;
  replayed: boolean;
}> {
  await assertPolicyAccess(input);
  const expectedPortfolioId = nonEmpty(
    input.expectedPortfolioId,
    "expected_portfolio_id_required",
  );
  const ceoPrincipalRef = nonEmpty(
    input.ceoPrincipalRef,
    "ceo_principal_ref_required",
  );
  const idempotencyKey = nonEmpty(
    input.idempotencyKey,
    "idempotency_key_required",
  );
  const reasonCodes = uniqueSorted(input.reasonCodes);
  const evidenceRefs = uniqueSorted(input.evidenceRefs);
  const now = input.now ?? new Date();
  return runWithWriteConflictRetry(
    () =>
      db.$transaction(async (tx) => {
        const trusted = await loadTrustedContextForUpdate(tx, {
          workspaceId: input.workspaceId,
          at: now,
        });
        await assertPolicyAccessInTransaction(tx, input);
        if (
          trusted.initialization.receipt.ceoPrincipalRef !== ceoPrincipalRef ||
          trusted.initialization.receipt.actorUserRef !== input.actorUserId
        ) {
          throw new CaioOperatingQuestionStoreError(
            "current_g0_ceo_actor_required",
          );
        }
        const liveBinding = await tx.caioPrincipalBinding.findFirst({
          where: {
            id: trusted.initialization.receipt.ceoPrincipalBindingRef,
            workspaceId: input.workspaceId,
            userId: input.actorUserId,
            principalRef: ceoPrincipalRef,
            principalKind: "ceo",
            revokedAt: null,
          },
        });
        if (!liveBinding) {
          throw new CaioOperatingQuestionStoreError(
            "live_ceo_principal_binding_required",
          );
        }
        const portfolioHead = await readPortfolioHeadForUpdate(
          tx,
          input.workspaceId,
        );
        if (
          !portfolioHead ||
          portfolioHead.initializationGateReceiptId !==
            trusted.g0Context.gateReceiptRef ||
          portfolioHead.currentPortfolioId !== expectedPortfolioId
        ) {
          throw new CaioOperatingQuestionStoreError(
            "current_question_portfolio_required",
          );
        }
        const portfolioRow = await tx.caioOperatingQuestionPortfolio.findFirst({
          where: {
            id: expectedPortfolioId,
            workspaceId: input.workspaceId,
            initializationGateReceiptId:
              trusted.g0Context.gateReceiptRef,
          },
        });
        if (!portfolioRow) {
          throw new CaioOperatingQuestionStoreError(
            "current_question_portfolio_missing",
          );
        }
        const portfolio = parseStoredPortfolio(portfolioRow);
        const portfolioValidation =
          validateCaioOperatingQuestionPortfolioAgainstG0(
            portfolio,
            trusted.g0Context,
          );
        if (!portfolioValidation.valid) {
          throw new CaioOperatingQuestionStoreError(
            "current_question_portfolio_invalid",
            portfolioValidation.errors,
          );
        }
        await assertPortfolioChainIntegrity(tx, {
          workspaceId: input.workspaceId,
          gateReceiptId: trusted.g0Context.gateReceiptRef,
          g0Context: trusted.g0Context,
          headPortfolio: portfolio,
        });
        const allowedEvidenceRefs = new Set(portfolio.evidenceRefs);
        if (
          evidenceRefs.length === 0 ||
          evidenceRefs.some((ref) => !allowedEvidenceRefs.has(ref))
        ) {
          throw new CaioOperatingQuestionStoreError(
            "selection_evidence_outside_current_portfolio",
          );
        }
        const state = await loadCurrentSelectionState(tx, {
          workspaceId: input.workspaceId,
          portfolio,
        });
        const requestHash = hashRequest({
          portfolioRef: portfolio.portfolioId,
          portfolioHash: portfolio.contentHash,
          ceoPrincipalBindingRef: liveBinding.id,
          ceoPrincipalRef,
          actorUserRef: input.actorUserId,
          idempotencyKey,
          selections: input.selections,
          reasonCodes,
          evidenceRefs,
        });
        const existing = await tx.caioQuestionSelectionReceipt.findUnique({
          where: {
            workspaceId_portfolioId_idempotencyKey: {
              workspaceId: input.workspaceId,
              portfolioId: portfolio.portfolioId,
              idempotencyKey,
            },
          },
        });
        if (existing) {
          if (existing.requestHash !== requestHash) {
            throw new CaioOperatingQuestionStoreError(
              "idempotency_key_payload_conflict",
            );
          }
          if (
            !state.head ||
            state.head.currentReceiptId !== existing.id
          ) {
            throw new CaioOperatingQuestionStoreError(
              "selection_receipt_no_longer_current",
            );
          }
          const receipt = parseStoredSelectionReceipt(existing);
          return { receipt, portfolio, replayed: true };
        }
        const receipt = createCaioQuestionSelectionReceipt({
          portfolio,
          workspaceRef: `workspace:${input.workspaceId}`,
          ceoPrincipalBindingRef: liveBinding.id,
          ceoPrincipalRef,
          actorUserRef: input.actorUserId,
          idempotencyKey,
          previousReceipt: state.previousReceipt,
          selections: input.selections,
          reasonCodes,
          evidenceRefs,
          selectedAt: now.toISOString(),
        });
        try {
          await tx.caioQuestionSelectionReceipt.create({
            data: {
              id: receipt.receiptId,
              workspaceId: input.workspaceId,
              portfolioId: portfolio.portfolioId,
              initializationGateReceiptId:
                portfolio.gateReceiptRef,
              ceoPrincipalBindingId: liveBinding.id,
              previousReceiptId: receipt.previousReceiptRef,
              previousReceiptHash: receipt.previousReceiptHash,
              sequence: receipt.sequence,
              idempotencyKey,
              requestHash,
              actorType: ActorType.USER,
              actorUserId: input.actorUserId,
              ceoPrincipalRef,
              selectionsJson: jsonStringify(receipt.selections),
              selectedQuestionIds: jsonStringify(
                receipt.selectedQuestionIds,
              ),
              reasonCodes: jsonStringify(receipt.reasonCodes),
              evidenceRefs: jsonStringify(receipt.evidenceRefs),
              receiptJson: jsonStringify(receipt),
              contentHash: receipt.contentHash,
              authorityEffect: receipt.authorityEffect,
              workPacketEffect: receipt.workPacketEffect,
              selectedAt: new Date(receipt.selectedAt),
            },
          });
        } catch (error) {
          if (isUniqueConstraintViolation(error)) {
            throw new CaioOperatingQuestionStoreError(
              "question_selection_concurrent_conflict",
            );
          }
          throw error;
        }
        await updateSelectionHead(tx, {
          workspaceId: input.workspaceId,
          portfolio,
          receipt,
          previousHead: state.head,
        });
        await writeAuditLog(
          {
            workspaceId: input.workspaceId,
            userId: input.actorUserId,
            actor: ceoPrincipalRef,
            actorType: ActorType.USER,
            actionType: "CAIO_OPERATING_QUESTIONS_SELECTED",
            targetType: "CaioQuestionSelectionReceipt",
            targetId: receipt.receiptId,
            summary:
              "CEO selected zero to three CAIO operating questions for implementation planning (selection only; no work dispatched)",
            relatedObjectType: "CaioOperatingQuestionPortfolio",
            relatedObjectId: portfolio.portfolioId,
            payload: {
              selectedQuestionIds: receipt.selectedQuestionIds,
              authorityEffect: receipt.authorityEffect,
              workPacketEffect: receipt.workPacketEffect,
            },
          },
          { client: tx },
        );
        return { receipt, portfolio, replayed: false };
      }, TRANSACTION_OPTIONS),
    WRITE_RETRY_OPTIONS,
  );
}

async function materializeOperatingQuestionImplementationPlan(
  tx: Tx,
  input: {
    workspaceId: string;
    portfolio: CaioOperatingQuestionPortfolio;
    selectionReceipt: CaioQuestionSelectionReceipt;
    questionId: string;
    decisionBindingId: string;
    decisionRecordId: string;
    actorUserId: string;
    ceoPrincipalRef: string;
  },
): Promise<{
  plan: CaioOperatingQuestionImplementationPlan;
  replayed: boolean;
}> {
  const plan = createCaioOperatingQuestionImplementationPlan({
    portfolio: input.portfolio,
    selectionReceipt: input.selectionReceipt,
    questionId: input.questionId,
    decisionRecordRef: input.decisionRecordId,
  });
  const existing =
    await tx.caioOperatingQuestionImplementationPlan.findFirst({
      where: {
        OR: [
          { id: plan.planId },
          { decisionBindingId: input.decisionBindingId },
          { decisionRecordId: input.decisionRecordId },
          {
            workspaceId: input.workspaceId,
            selectionReceiptId: input.selectionReceipt.receiptId,
            questionId: input.questionId,
          },
        ],
      },
    });
  if (existing) {
    return {
      plan: parseStoredImplementationPlan(existing, {
        portfolio: input.portfolio,
        selectionReceipt: input.selectionReceipt,
        decisionBindingId: input.decisionBindingId,
        decisionRecordId: input.decisionRecordId,
        actorUserId: input.actorUserId,
        questionId: input.questionId,
        candidateHash: plan.candidateHash,
      }),
      replayed: true,
    };
  }
  await tx.caioOperatingQuestionImplementationPlan.create({
    data: {
      id: plan.planId,
      workspaceId: input.workspaceId,
      selectionReceiptId: input.selectionReceipt.receiptId,
      portfolioId: input.portfolio.portfolioId,
      questionId: input.questionId,
      candidateHash: plan.candidateHash,
      decisionBindingId: input.decisionBindingId,
      decisionRecordId: input.decisionRecordId,
      planJson: jsonStringify(plan),
      contentHash: plan.contentHash,
      status: plan.status,
      implementationReadiness: plan.implementationReadiness,
      gapCodes: jsonStringify(plan.gapCodes),
      authorityEffect: plan.authorityEffect,
      workPacketEffect: plan.workPacketEffect,
      actorUserId: input.actorUserId,
      plannedAt: new Date(plan.createdAt),
    },
  });
  await writeAuditLog(
    {
      workspaceId: input.workspaceId,
      userId: input.actorUserId,
      actor: input.ceoPrincipalRef,
      actorType: ActorType.USER,
      actionType:
        "CAIO_OPERATING_QUESTION_IMPLEMENTATION_PLAN_MATERIALIZED",
      targetType: "CaioOperatingQuestionImplementationPlan",
      targetId: plan.planId,
      summary:
        "Selected CAIO operating question materialized as a canonical implementation-planning draft (no authority granted; no work dispatched)",
      relatedObjectType: "DecisionRecord",
      relatedObjectId: input.decisionRecordId,
      payload: {
        selectionReceiptId: input.selectionReceipt.receiptId,
        portfolioId: input.portfolio.portfolioId,
        questionId: input.questionId,
        implementationReadiness: plan.implementationReadiness,
        gapCodes: plan.gapCodes,
        authorityEffect: plan.authorityEffect,
        workPacketEffect: plan.workPacketEffect,
      },
    },
    { client: tx },
  );
  return { plan, replayed: false };
}

// Converts the current CEO selection into the existing DecisionRecord runtime
// model and its canonical implementation-planning draft. This is still
// review-only: it creates no confirmation, Work Packet, approval task,
// authority grant, or external side effect.
export async function bindCurrentCaioQuestionSelectionToDecisionRecords(input: {
  workspaceId: string;
  expectedSelectionReceiptId: string;
  actorUserId: string;
  ceoPrincipalRef: string;
  now?: Date;
  english?: boolean;
}): Promise<{
  selectionReceipt: CaioQuestionSelectionReceipt;
  bindings: Array<{
    bindingId: string;
    questionId: string;
    decisionRecordId: string;
    implementationPlanId: string;
    implementationPlanReplayed: boolean;
    replayed: boolean;
  }>;
}> {
  await assertPolicyAccess(input);
  const expectedSelectionReceiptId = nonEmpty(
    input.expectedSelectionReceiptId,
    "expected_selection_receipt_id_required",
  );
  const ceoPrincipalRef = nonEmpty(
    input.ceoPrincipalRef,
    "ceo_principal_ref_required",
  );
  const now = input.now ?? new Date();
  return runWithWriteConflictRetry(
    () =>
      db.$transaction(async (tx) => {
        const trusted = await loadTrustedContextForUpdate(tx, {
          workspaceId: input.workspaceId,
          at: now,
        });
        await assertPolicyAccessInTransaction(tx, input);
        if (
          trusted.initialization.receipt.ceoPrincipalRef !== ceoPrincipalRef ||
          trusted.initialization.receipt.actorUserRef !== input.actorUserId
        ) {
          throw new CaioOperatingQuestionStoreError(
            "current_g0_ceo_actor_required",
          );
        }
        const liveBinding = await tx.caioPrincipalBinding.findFirst({
          where: {
            id: trusted.initialization.receipt.ceoPrincipalBindingRef,
            workspaceId: input.workspaceId,
            userId: input.actorUserId,
            principalRef: ceoPrincipalRef,
            principalKind: "ceo",
            revokedAt: null,
          },
        });
        if (!liveBinding) {
          throw new CaioOperatingQuestionStoreError(
            "live_ceo_principal_binding_required",
          );
        }
        const portfolioHead = await readPortfolioHeadForUpdate(
          tx,
          input.workspaceId,
        );
        if (
          !portfolioHead ||
          portfolioHead.initializationGateReceiptId !==
            trusted.g0Context.gateReceiptRef ||
          !portfolioHead.currentPortfolioId
        ) {
          throw new CaioOperatingQuestionStoreError(
            "current_question_portfolio_required",
          );
        }
        const portfolioRow =
          await tx.caioOperatingQuestionPortfolio.findFirst({
            where: {
              id: portfolioHead.currentPortfolioId,
              workspaceId: input.workspaceId,
              initializationGateReceiptId:
                trusted.g0Context.gateReceiptRef,
            },
          });
        if (!portfolioRow) {
          throw new CaioOperatingQuestionStoreError(
            "current_question_portfolio_missing",
          );
        }
        const portfolio = parseStoredPortfolio(portfolioRow);
        await assertPortfolioChainIntegrity(tx, {
          workspaceId: input.workspaceId,
          gateReceiptId: trusted.g0Context.gateReceiptRef,
          g0Context: trusted.g0Context,
          headPortfolio: portfolio,
        });
        const generationReceiptRow =
          await tx.caioOperatingQuestionGenerationReceipt.findFirst({
            where: {
              portfolioId: portfolio.portfolioId,
              workspaceId: input.workspaceId,
              initializationGateReceiptId:
                trusted.g0Context.gateReceiptRef,
            },
          });
        if (!generationReceiptRow) {
          throw new CaioOperatingQuestionStoreError(
            "portfolio_generation_receipt_missing",
          );
        }
        const generationReceipt =
          parseStoredGenerationReceipt(generationReceiptRow);
        const generationOutcomeValidation =
          validateCaioOperatingQuestionGenerationReceiptAgainstPortfolio(
            generationReceipt,
            portfolio,
          );
        if (!generationOutcomeValidation.valid) {
          throw new CaioOperatingQuestionStoreError(
            "portfolio_generation_receipt_invalid",
            generationOutcomeValidation.errors,
          );
        }
        const selectionHead = await readSelectionHeadForUpdate(
          tx,
          input.workspaceId,
        );
        if (
          !selectionHead ||
          selectionHead.currentPortfolioId !== portfolio.portfolioId ||
          selectionHead.currentGateReceiptId !==
            trusted.g0Context.gateReceiptRef ||
          selectionHead.currentReceiptId !== expectedSelectionReceiptId
        ) {
          throw new CaioOperatingQuestionStoreError(
            "current_question_selection_required",
          );
        }
        const selectionReceiptRow =
          await tx.caioQuestionSelectionReceipt.findFirst({
            where: {
              id: expectedSelectionReceiptId,
              workspaceId: input.workspaceId,
              portfolioId: portfolio.portfolioId,
            },
          });
        if (!selectionReceiptRow) {
          throw new CaioOperatingQuestionStoreError(
            "current_question_selection_missing",
          );
        }
        const selectionReceipt =
          parseStoredSelectionReceipt(selectionReceiptRow);
        if (
          selectionReceipt.actorUserRef !== input.actorUserId ||
          selectionReceipt.ceoPrincipalRef !== ceoPrincipalRef ||
          selectionReceipt.ceoPrincipalBindingRef !== liveBinding.id
        ) {
          throw new CaioOperatingQuestionStoreError(
            "current_question_selection_ceo_binding_invalid",
          );
        }
        await assertSelectionChainIntegrity(tx, {
          workspaceId: input.workspaceId,
          portfolio,
          headReceipt: selectionReceipt,
        });
        const knowledgeRefs = governedKnowledgeRefs(
          trusted.initialization,
        );
        const bindings: Array<{
          bindingId: string;
          questionId: string;
          decisionRecordId: string;
          implementationPlanId: string;
          implementationPlanReplayed: boolean;
          replayed: boolean;
        }> = [];
        for (const questionId of selectionReceipt.selectedQuestionIds) {
          const projection =
            projectCaioSelectedOperatingQuestionToDecision({
              portfolio,
              generationReceiptRef: generationReceipt.receiptId,
              selectionReceipt,
              questionId,
              knowledgeRefs,
            });
          const decisionResult =
            await createStage1DecisionRecordInTransaction(tx, {
              workspaceId: input.workspaceId,
              decision: projection.decision,
              facts: projection.facts,
              inferences: projection.inferences,
              unknowns: projection.unknowns,
              risks: projection.risks,
              actorName: ceoPrincipalRef,
              actorUserId: input.actorUserId,
              actorType: ActorType.USER,
              english: input.english,
            });
          const existingBinding =
            await tx.caioOperatingQuestionDecisionBinding.findUnique({
              where: {
                workspaceId_selectionReceiptId_questionId: {
                  workspaceId: input.workspaceId,
                  selectionReceiptId: selectionReceipt.receiptId,
                  questionId,
                },
              },
            });
          let binding = existingBinding;
          let bindingReplayed = true;
          if (existingBinding) {
            if (
              existingBinding.portfolioId !== portfolio.portfolioId ||
              existingBinding.candidateHash !== projection.candidateHash ||
              existingBinding.decisionRecordId !== decisionResult.record.id ||
              existingBinding.actorUserId !== input.actorUserId
            ) {
              throw new CaioOperatingQuestionStoreError(
                "question_decision_binding_conflict",
              );
            }
          } else {
            bindingReplayed = false;
            const bindingBasisHash = sha256(
              canonicalJson({
                workspaceId: input.workspaceId,
                selectionReceiptId: selectionReceipt.receiptId,
                portfolioId: portfolio.portfolioId,
                questionId,
                candidateHash: projection.candidateHash,
                decisionRecordId: decisionResult.record.id,
                actorUserId: input.actorUserId,
              }),
            );
            const bindingId = `caio-question-decision-binding:${bindingBasisHash.slice(7, 31)}`;
            binding =
              await tx.caioOperatingQuestionDecisionBinding.create({
                data: {
                  id: bindingId,
                  workspaceId: input.workspaceId,
                  selectionReceiptId: selectionReceipt.receiptId,
                  portfolioId: portfolio.portfolioId,
                  questionId,
                  candidateHash: projection.candidateHash,
                  decisionRecordId: decisionResult.record.id,
                  actorUserId: input.actorUserId,
                },
              });
            await writeAuditLog(
              {
                workspaceId: input.workspaceId,
                userId: input.actorUserId,
                actor: ceoPrincipalRef,
                actorType: ActorType.USER,
                actionType:
                  "CAIO_OPERATING_QUESTION_DECISION_BOUND",
                targetType:
                  "CaioOperatingQuestionDecisionBinding",
                targetId: binding.id,
                summary:
                  "Selected CAIO operating question bound to the canonical DecisionRecord (review only; no work dispatched)",
                relatedObjectType: "DecisionRecord",
                relatedObjectId: decisionResult.record.id,
                payload: {
                  selectionReceiptId: selectionReceipt.receiptId,
                  portfolioId: portfolio.portfolioId,
                  questionId,
                  authorityEffect: "none",
                  workPacketEffect: "none",
                },
              },
              { client: tx },
            );
          }
          if (!binding) {
            throw new CaioOperatingQuestionStoreError(
              "question_decision_binding_missing",
            );
          }
          const implementationPlanResult =
            await materializeOperatingQuestionImplementationPlan(tx, {
              workspaceId: input.workspaceId,
              portfolio,
              selectionReceipt,
              questionId,
              decisionBindingId: binding.id,
              decisionRecordId: decisionResult.record.id,
              actorUserId: input.actorUserId,
              ceoPrincipalRef,
            });
          bindings.push({
            bindingId: binding.id,
            questionId,
            decisionRecordId: decisionResult.record.id,
            implementationPlanId:
              implementationPlanResult.plan.planId,
            implementationPlanReplayed:
              implementationPlanResult.replayed,
            replayed:
              decisionResult.replayed &&
              bindingReplayed &&
              implementationPlanResult.replayed,
          });
        }
        return { selectionReceipt, bindings };
      }, TRANSACTION_OPTIONS),
    WRITE_RETRY_OPTIONS,
  );
}
