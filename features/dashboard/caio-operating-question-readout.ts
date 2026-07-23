import {
  ActorType,
  type CaioOperatingQuestionDecisionBinding as StoredDecisionBindingRow,
  type CaioOperatingQuestionGenerationReceipt as StoredGenerationReceiptRow,
  type CaioOperatingQuestionImplementationPlan as StoredImplementationPlanRow,
  type CaioOperatingQuestionPortfolio as StoredPortfolioRow,
  type CaioQuestionSelectionReceipt as StoredSelectionReceiptRow,
} from "@prisma/client";
import {
  validateCaioInitializationAssessment,
  type CaioInitializationAssessment,
} from "@/lib/stage1-owner-loop/caio-initialization-gate";
import {
  validateCaioInitializationGateReceipt,
  type CaioInitializationGateReceipt,
} from "@/lib/stage1-owner-loop/caio-initialization-gate-receipt";
import {
  validateCaioOperatingQuestionImplementationPlan,
  validateCaioOperatingQuestionImplementationPlanAgainstContext,
  type CaioOperatingQuestionImplementationPlan,
} from "@/lib/stage1-owner-loop/caio-operating-question-implementation-plan";
import {
  validateCaioOperatingQuestionGenerationReceipt,
  validateCaioOperatingQuestionGenerationReceiptAgainstPortfolio,
  validateCaioOperatingQuestionPortfolio,
  type CaioOperatingQuestionGenerationReceipt,
  type CaioOperatingQuestionPortfolio,
} from "@/lib/stage1-owner-loop/caio-operating-question";
import {
  validateCaioQuestionSelectionReceipt,
  validateCaioQuestionSelectionReceiptAgainstPortfolio,
  type CaioQuestionSelectionReceipt,
} from "@/lib/stage1-owner-loop/caio-question-selection";
import { canonicalJson } from "@/lib/expert-capability/hashing";
import { safeParseJson } from "@/lib/utils";

export type CaioOperatingQuestionPortfolioHeadReadRow = {
  initializationGateReceiptId: string;
  initializationAssessmentId: string;
  currentGenerationReceiptId: string;
  currentPortfolioId: string | null;
  generationSequence: number;
  portfolioSequence: number;
  version: number;
  updatedAt: Date;
  currentGenerationReceipt: StoredGenerationReceiptRow;
  currentPortfolio: StoredPortfolioRow | null;
};

export type CaioQuestionSelectionHeadReadRow = {
  currentPortfolioId: string;
  currentGateReceiptId: string;
  currentReceiptId: string;
  sequence: number;
  version: number;
  updatedAt: Date;
  currentReceipt: StoredSelectionReceiptRow & {
    decisionBindings: Array<
      StoredDecisionBindingRow & {
        implementationPlan: StoredImplementationPlanRow | null;
      }
    >;
  };
};

export type CaioCurrentAcceptedG0ReadContext = {
  assessment: CaioInitializationAssessment;
  receipt: CaioInitializationGateReceipt;
};

export type CaioOperatingQuestionReadout = {
  asOf: string | null;
  state:
    | "not_generated"
    | "awaiting_selection"
    | "selection_deferred"
    | "binding_incomplete"
    | "planning_incomplete"
    | "selected"
    | "last_valid_portfolio_stale"
    | "insufficient_evidence"
    | "invalid_evidence";
  boundary: "read_only";
  portfolioId: string | null;
  portfolioGeneratedAt: string | null;
  generationReceiptId: string | null;
  generationSequence: number;
  portfolioSequence: number;
  generationStatus: "generated" | "insufficient_evidence" | null;
  gapCodes: string[];
  selectionReceiptId: string | null;
  selectionSequence: number;
  selectedQuestionIds: string[];
  decisionBindingCount: number;
  implementationPlanCount: number;
  candidates: Array<{
    questionId: string;
    rank: number;
    title: string;
    question: string;
    businessDomain: string;
    compositeScore: number;
    evidenceCount: number;
    selected: boolean;
    decisionRecordId: string | null;
    implementationPlanId: string | null;
    implementationReadiness: string | null;
    implementationGapCodes: string[];
  }>;
};

function emptyReadout(
  state: CaioOperatingQuestionReadout["state"],
): CaioOperatingQuestionReadout {
  return {
    asOf: null,
    state,
    boundary: "read_only",
    portfolioId: null,
    portfolioGeneratedAt: null,
    generationReceiptId: null,
    generationSequence: 0,
    portfolioSequence: 0,
    generationStatus: null,
    gapCodes: [],
    selectionReceiptId: null,
    selectionSequence: 0,
    selectedQuestionIds: [],
    decisionBindingCount: 0,
    implementationPlanCount: 0,
    candidates: [],
  };
}

function parseStringArray(value: string): string[] | null {
  const parsed = safeParseJson<unknown>(value, null);
  return Array.isArray(parsed) &&
    parsed.every((item) => typeof item === "string")
    ? parsed
    : null;
}

function sameStrings(
  left: readonly string[],
  right: readonly string[],
): boolean {
  const normalize = (values: readonly string[]) =>
    [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort();
  return canonicalJson(normalize(left)) === canonicalJson(normalize(right));
}

function parseCurrentAcceptedG0(
  input: CaioCurrentAcceptedG0ReadContext,
): {
  assessment: CaioInitializationAssessment;
  receipt: CaioInitializationGateReceipt;
} | null {
  const { assessment, receipt } = input;
  try {
    if (
      !validateCaioInitializationAssessment(assessment).valid ||
      !validateCaioInitializationGateReceipt(receipt).valid ||
      receipt.assessmentHash !== assessment.contentHash ||
      receipt.basisHash !== assessment.basisHash ||
      receipt.action !== "accept" ||
      receipt.resultingStatus !== "accepted" ||
      receipt.assessmentRef !== assessment.assessmentId ||
      receipt.mandateRef !== assessment.mandateRef ||
      receipt.workspaceRef !== assessment.workspaceRef
    ) {
      return null;
    }
    return { assessment, receipt };
  } catch {
    return null;
  }
}

function parseGenerationReceipt(
  head: CaioOperatingQuestionPortfolioHeadReadRow,
): CaioOperatingQuestionGenerationReceipt | null {
  const row = head.currentGenerationReceipt;
  const receipt =
    safeParseJson<CaioOperatingQuestionGenerationReceipt | null>(
      row.receiptJson,
      null,
    );
  const evidenceRefs = parseStringArray(row.evidenceRefs);
  const gapCodes = parseStringArray(row.gapCodes);
  if (!receipt || !evidenceRefs || !gapCodes) {
    return null;
  }
  try {
    if (
      !validateCaioOperatingQuestionGenerationReceipt(receipt).valid ||
      receipt.receiptId !== row.id ||
      receipt.workspaceRef !== `workspace:${row.workspaceId}` ||
      receipt.gateReceiptRef !== row.initializationGateReceiptId ||
      receipt.assessmentRef !== row.initializationAssessmentId ||
      receipt.portfolioRef !== row.portfolioId ||
      receipt.previousReceiptRef !== row.previousReceiptId ||
      receipt.previousReceiptHash !== row.previousReceiptHash ||
      receipt.sequence !== row.sequence ||
      receipt.sequence !== head.generationSequence ||
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
      receipt.recordedAt !== row.recordedAt.toISOString() ||
      head.currentGenerationReceiptId !== row.id ||
      head.initializationGateReceiptId !==
        row.initializationGateReceiptId ||
      head.initializationAssessmentId !== row.initializationAssessmentId
    ) {
      return null;
    }
    return receipt;
  } catch {
    return null;
  }
}

function parsePortfolio(
  head: CaioOperatingQuestionPortfolioHeadReadRow,
): CaioOperatingQuestionPortfolio | null {
  if (!head.currentPortfolio) return null;
  const row = head.currentPortfolio;
  const portfolio = safeParseJson<CaioOperatingQuestionPortfolio | null>(
    row.portfolioJson,
    null,
  );
  const evidenceRefs = parseStringArray(row.evidenceRefs);
  const auditRefs = parseStringArray(row.auditRefs);
  if (!portfolio || !evidenceRefs || !auditRefs) {
    return null;
  }
  try {
    if (
      !validateCaioOperatingQuestionPortfolio(portfolio).valid ||
      portfolio.portfolioId !== row.id ||
      portfolio.workspaceRef !== `workspace:${row.workspaceId}` ||
      portfolio.gateReceiptRef !== row.initializationGateReceiptId ||
      portfolio.assessmentRef !== row.initializationAssessmentId ||
      portfolio.previousPortfolioRef !== row.previousPortfolioId ||
      portfolio.sequence !== row.sequence ||
      portfolio.sequence !== head.portfolioSequence ||
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
      portfolio.generatedAt !== row.generatedAt.toISOString() ||
      head.currentPortfolioId !== row.id ||
      head.initializationGateReceiptId !==
        row.initializationGateReceiptId ||
      head.initializationAssessmentId !== row.initializationAssessmentId
    ) {
      return null;
    }
    return portfolio;
  } catch {
    return null;
  }
}

function parseSelectionReceipt(input: {
  head: CaioQuestionSelectionHeadReadRow;
  portfolio: CaioOperatingQuestionPortfolio;
}): CaioQuestionSelectionReceipt | null {
  const row = input.head.currentReceipt;
  const receipt = safeParseJson<CaioQuestionSelectionReceipt | null>(
    row.receiptJson,
    null,
  );
  const selections = safeParseJson<unknown[] | null>(
    row.selectionsJson,
    null,
  );
  const selectedQuestionIds = parseStringArray(row.selectedQuestionIds);
  const reasonCodes = parseStringArray(row.reasonCodes);
  const evidenceRefs = parseStringArray(row.evidenceRefs);
  if (
    !receipt ||
    !selections ||
    !selectedQuestionIds ||
    !reasonCodes ||
    !evidenceRefs
  ) {
    return null;
  }
  try {
    if (
      !validateCaioQuestionSelectionReceipt(receipt).valid ||
      !validateCaioQuestionSelectionReceiptAgainstPortfolio(
        receipt,
        input.portfolio,
      ).valid ||
      receipt.receiptId !== row.id ||
      receipt.receiptId !== input.head.currentReceiptId ||
      receipt.workspaceRef !== `workspace:${row.workspaceId}` ||
      receipt.portfolioRef !== row.portfolioId ||
      receipt.portfolioRef !== input.head.currentPortfolioId ||
      receipt.gateReceiptRef !== row.initializationGateReceiptId ||
      receipt.gateReceiptRef !== input.head.currentGateReceiptId ||
      receipt.ceoPrincipalBindingRef !== row.ceoPrincipalBindingId ||
      receipt.previousReceiptRef !== row.previousReceiptId ||
      receipt.previousReceiptHash !== row.previousReceiptHash ||
      receipt.sequence !== row.sequence ||
      receipt.sequence !== input.head.sequence ||
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
      return null;
    }
    return receipt;
  } catch {
    return null;
  }
}

function parseImplementationPlan(input: {
  row: StoredImplementationPlanRow;
  binding: StoredDecisionBindingRow;
  portfolio: CaioOperatingQuestionPortfolio;
  selectionReceipt: CaioQuestionSelectionReceipt;
}): CaioOperatingQuestionImplementationPlan | null {
  const plan =
    safeParseJson<CaioOperatingQuestionImplementationPlan | null>(
      input.row.planJson,
      null,
    );
  const gapCodes = parseStringArray(input.row.gapCodes);
  if (!plan || !gapCodes) return null;
  try {
    if (
      !validateCaioOperatingQuestionImplementationPlan(plan).valid ||
      !validateCaioOperatingQuestionImplementationPlanAgainstContext(
        plan,
        {
          portfolio: input.portfolio,
          selectionReceipt: input.selectionReceipt,
          decisionRecordRef: input.binding.decisionRecordId,
        },
      ).valid ||
      plan.planId !== input.row.id ||
      plan.workspaceRef !== `workspace:${input.row.workspaceId}` ||
      plan.portfolioRef !== input.row.portfolioId ||
      plan.selectionReceiptRef !== input.row.selectionReceiptId ||
      plan.questionId !== input.row.questionId ||
      plan.candidateHash !== input.row.candidateHash ||
      plan.decisionRecordRef !== input.row.decisionRecordId ||
      input.row.workspaceId !== input.binding.workspaceId ||
      input.row.selectionReceiptId !==
        input.binding.selectionReceiptId ||
      input.row.portfolioId !== input.binding.portfolioId ||
      input.row.questionId !== input.binding.questionId ||
      input.row.candidateHash !== input.binding.candidateHash ||
      input.row.decisionBindingId !== input.binding.id ||
      input.row.decisionRecordId !== input.binding.decisionRecordId ||
      input.row.actorUserId !== input.binding.actorUserId ||
      plan.status !== input.row.status ||
      plan.implementationReadiness !==
        input.row.implementationReadiness ||
      canonicalJson(plan.gapCodes) !== canonicalJson(gapCodes) ||
      plan.authorityEffect !== input.row.authorityEffect ||
      plan.workPacketEffect !== input.row.workPacketEffect ||
      plan.createdAt !== input.row.plannedAt.toISOString() ||
      plan.contentHash !== input.row.contentHash
    ) {
      return null;
    }
    return plan;
  } catch {
    return null;
  }
}

export function buildCaioOperatingQuestionReadout(input: {
  now: Date;
  currentG0Context: CaioCurrentAcceptedG0ReadContext | null;
  portfolioHead: CaioOperatingQuestionPortfolioHeadReadRow | null;
  selectionHead: CaioQuestionSelectionHeadReadRow | null;
}): CaioOperatingQuestionReadout {
  if (!input.portfolioHead) return emptyReadout("not_generated");
  if (!input.currentG0Context) return emptyReadout("invalid_evidence");
  const currentG0 = parseCurrentAcceptedG0(input.currentG0Context);
  if (
    !currentG0 ||
    input.portfolioHead.initializationGateReceiptId !==
      currentG0.receipt.receiptId ||
    input.portfolioHead.initializationAssessmentId !==
      currentG0.assessment.assessmentId
  ) {
    return emptyReadout("invalid_evidence");
  }
  const generationReceipt = parseGenerationReceipt(input.portfolioHead);
  if (!generationReceipt) return emptyReadout("invalid_evidence");
  const portfolio = parsePortfolio(input.portfolioHead);
  if (
    generationReceipt.gateReceiptRef !== currentG0.receipt.receiptId ||
    generationReceipt.gateReceiptHash !== currentG0.receipt.contentHash ||
    generationReceipt.assessmentRef !==
      currentG0.assessment.assessmentId ||
    generationReceipt.assessmentHash !==
      currentG0.assessment.contentHash ||
    (portfolio !== null &&
      (portfolio.gateReceiptRef !== currentG0.receipt.receiptId ||
        portfolio.gateReceiptHash !== currentG0.receipt.contentHash ||
        portfolio.assessmentRef !== currentG0.assessment.assessmentId ||
        portfolio.assessmentHash !== currentG0.assessment.contentHash))
  ) {
    return emptyReadout("invalid_evidence");
  }
  if (generationReceipt.status === "generated") {
    if (
      !portfolio ||
      !validateCaioOperatingQuestionGenerationReceiptAgainstPortfolio(
        generationReceipt,
        portfolio,
      ).valid
    ) {
      return emptyReadout("invalid_evidence");
    }
  } else if (
    !validateCaioOperatingQuestionGenerationReceiptAgainstPortfolio(
      generationReceipt,
      null,
    ).valid ||
    (portfolio !== null &&
      portfolio.sequence >= generationReceipt.sequence) ||
    (portfolio === null && input.portfolioHead.portfolioSequence !== 0)
  ) {
    return emptyReadout("invalid_evidence");
  }
  if (!portfolio) {
    return {
      ...emptyReadout("insufficient_evidence"),
      asOf: input.portfolioHead.updatedAt.toISOString(),
      generationReceiptId: generationReceipt.receiptId,
      generationSequence: input.portfolioHead.generationSequence,
      generationStatus: generationReceipt.status,
      gapCodes: generationReceipt.gapCodes,
    };
  }

  let selectionReceipt: CaioQuestionSelectionReceipt | null = null;
  if (
    input.selectionHead?.currentPortfolioId === portfolio.portfolioId
  ) {
    selectionReceipt = parseSelectionReceipt({
      head: input.selectionHead,
      portfolio,
    });
    if (!selectionReceipt) return emptyReadout("invalid_evidence");
  }
  const selectedQuestionIds = selectionReceipt?.selectedQuestionIds ?? [];
  const selectedQuestionIdSet = new Set(selectedQuestionIds);
  const candidateHashByQuestionId = new Map(
    portfolio.candidates.map((candidate) => [
      candidate.questionId,
      candidate.contentHash,
    ]),
  );
  const bindingByQuestionId = new Map<
    string,
    {
      decisionRecordId: string;
      implementationPlan: CaioOperatingQuestionImplementationPlan | null;
    }
  >();
  const currentBindings = selectionReceipt
    ? (input.selectionHead?.currentReceipt.decisionBindings ?? [])
    : [];
  for (const binding of currentBindings) {
    if (!selectionReceipt) return emptyReadout("invalid_evidence");
    if (
      bindingByQuestionId.has(binding.questionId) ||
      !selectedQuestionIdSet.has(binding.questionId) ||
      candidateHashByQuestionId.get(binding.questionId) !==
        binding.candidateHash ||
      !binding.id.trim() ||
      !binding.decisionRecordId.trim() ||
      binding.workspaceId !==
        input.selectionHead?.currentReceipt.workspaceId ||
      binding.selectionReceiptId !== selectionReceipt.receiptId ||
      binding.portfolioId !== portfolio.portfolioId ||
      binding.actorUserId !== selectionReceipt.actorUserRef
    ) {
      return emptyReadout("invalid_evidence");
    }
    const implementationPlan = binding.implementationPlan
      ? parseImplementationPlan({
          row: binding.implementationPlan,
          binding,
          portfolio,
          selectionReceipt,
        })
      : null;
    if (binding.implementationPlan && !implementationPlan) {
      return emptyReadout("invalid_evidence");
    }
    bindingByQuestionId.set(
      binding.questionId,
      {
        decisionRecordId: binding.decisionRecordId,
        implementationPlan,
      },
    );
  }
  const implementationPlanCount = [...bindingByQuestionId.values()].filter(
    (binding) => binding.implementationPlan !== null,
  ).length;
  let state: CaioOperatingQuestionReadout["state"] =
    "awaiting_selection";
  if (generationReceipt.status === "insufficient_evidence") {
    state = "last_valid_portfolio_stale";
  } else if (selectionReceipt && selectedQuestionIds.length === 0) {
    state = "selection_deferred";
  } else if (
    selectionReceipt &&
    bindingByQuestionId.size < selectedQuestionIds.length
  ) {
    state = "binding_incomplete";
  } else if (
    selectionReceipt &&
    implementationPlanCount < selectedQuestionIds.length
  ) {
    state = "planning_incomplete";
  } else if (selectionReceipt) {
    state = "selected";
  }
  return {
    asOf: input.portfolioHead.updatedAt.toISOString(),
    state,
    boundary: "read_only",
    portfolioId: portfolio.portfolioId,
    portfolioGeneratedAt: portfolio.generatedAt,
    generationReceiptId: generationReceipt.receiptId,
    generationSequence: input.portfolioHead.generationSequence,
    portfolioSequence: input.portfolioHead.portfolioSequence,
    generationStatus: generationReceipt.status,
    gapCodes: generationReceipt.gapCodes,
    selectionReceiptId: selectionReceipt?.receiptId ?? null,
    selectionSequence: selectionReceipt?.sequence ?? 0,
    selectedQuestionIds,
    decisionBindingCount: bindingByQuestionId.size,
    implementationPlanCount,
    candidates: portfolio.candidates.map((candidate) => ({
      questionId: candidate.questionId,
      rank: candidate.rank,
      title: candidate.title,
      question: candidate.question,
      businessDomain: candidate.businessDomain,
      compositeScore: candidate.compositeScore,
      evidenceCount: candidate.evidenceRefs.length,
      selected: selectedQuestionIdSet.has(candidate.questionId),
      decisionRecordId:
        bindingByQuestionId.get(candidate.questionId)?.decisionRecordId ??
        null,
      implementationPlanId:
        bindingByQuestionId.get(candidate.questionId)?.implementationPlan
          ?.planId ?? null,
      implementationReadiness:
        bindingByQuestionId.get(candidate.questionId)?.implementationPlan
          ?.implementationReadiness ?? null,
      implementationGapCodes:
        bindingByQuestionId.get(candidate.questionId)?.implementationPlan
          ?.gapCodes ?? [],
    })),
  };
}
