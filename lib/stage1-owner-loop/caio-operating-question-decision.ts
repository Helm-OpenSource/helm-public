import type {
  DecisionObject,
  DecisionRiskLevel,
} from "@/lib/agentos-decision-supervision/types";
import { canonicalJson, sha256 } from "@/lib/expert-capability/hashing";

import {
  validateCaioOperatingQuestionPortfolio,
  type CaioOperatingQuestionCandidate,
  type CaioOperatingQuestionPortfolio,
} from "./caio-operating-question";
import {
  validateCaioQuestionSelectionReceipt,
  validateCaioQuestionSelectionReceiptAgainstPortfolio,
  type CaioQuestionSelectionItem,
  type CaioQuestionSelectionReceipt,
} from "./caio-question-selection";
import type { EvidenceStatement } from "./types";

export type CaioSelectedOperatingQuestionDecisionProjection = {
  decision: DecisionObject;
  facts: EvidenceStatement[];
  inferences: EvidenceStatement[];
  unknowns: string[];
  risks: string[];
  candidateHash: string;
};

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
  if (!normalized) throw new Error(reason);
  return normalized;
}

function decisionRiskLevel(
  candidate: CaioOperatingQuestionCandidate,
): DecisionRiskLevel {
  if (candidate.scores.riskAndCost >= 67) return "high";
  if (candidate.scores.riskAndCost >= 34) return "medium";
  return "low";
}

function findSelectedQuestion(input: {
  portfolio: CaioOperatingQuestionPortfolio;
  selectionReceipt: CaioQuestionSelectionReceipt;
  questionId: string;
}): {
  candidate: CaioOperatingQuestionCandidate;
  selection: CaioQuestionSelectionItem;
} {
  const questionId = nonEmpty(
    input.questionId,
    "selected_operating_question_required",
  );
  const selection = input.selectionReceipt.selections.find(
    (item) => item.questionId === questionId,
  );
  const candidate = input.portfolio.candidates.find(
    (item) => item.questionId === questionId,
  );
  if (!selection || !candidate) {
    throw new Error("selected_operating_question_required");
  }
  return { candidate, selection };
}

export function projectCaioSelectedOperatingQuestionToDecision(input: {
  portfolio: CaioOperatingQuestionPortfolio;
  generationReceiptRef: string;
  selectionReceipt: CaioQuestionSelectionReceipt;
  questionId: string;
  knowledgeRefs: readonly string[];
}): CaioSelectedOperatingQuestionDecisionProjection {
  const portfolioValidation = validateCaioOperatingQuestionPortfolio(
    input.portfolio,
  );
  if (!portfolioValidation.valid) {
    throw new Error(
      `caio_question_portfolio_invalid:${portfolioValidation.errors.join(",")}`,
    );
  }
  const receiptValidation = validateCaioQuestionSelectionReceipt(
    input.selectionReceipt,
  );
  const receiptPortfolioValidation =
    validateCaioQuestionSelectionReceiptAgainstPortfolio(
      input.selectionReceipt,
      input.portfolio,
    );
  if (!receiptValidation.valid || !receiptPortfolioValidation.valid) {
    throw new Error(
      `caio_question_selection_receipt_invalid:${[
        ...receiptValidation.errors,
        ...receiptPortfolioValidation.errors,
      ].join(",")}`,
    );
  }
  const generationReceiptRef = nonEmpty(
    input.generationReceiptRef,
    "generation_receipt_ref_required",
  );
  const knowledgeRefs = uniqueSorted(input.knowledgeRefs);
  if (knowledgeRefs.length === 0) {
    throw new Error("governed_knowledge_ref_required");
  }
  const { candidate, selection } = findSelectedQuestion(input);
  const evidenceRefs = uniqueSorted([
    ...candidate.evidenceRefs,
    ...input.selectionReceipt.evidenceRefs,
  ]);
  if (evidenceRefs.length === 0) {
    throw new Error("selected_operating_question_evidence_required");
  }
  const decisionBasis = {
    portfolioRef: input.portfolio.portfolioId,
    portfolioHash: input.portfolio.contentHash,
    selectionReceiptRef: input.selectionReceipt.receiptId,
    selectionReceiptHash: input.selectionReceipt.contentHash,
    questionId: candidate.questionId,
    candidateHash: candidate.contentHash,
  };
  const decisionBasisHash = sha256(canonicalJson(decisionBasis));
  const decision: DecisionObject = {
    decisionId: `caio-operating-question-decision:${decisionBasisHash.slice(7, 31)}`,
    tenantRef: input.portfolio.workspaceRef,
    decisionType: "prioritization",
    businessQuestion:
      selection.questionOverride?.trim() || candidate.question,
    problemCategoryRef: `caio-operating-question:${candidate.businessDomain}`,
    contextRefs: uniqueSorted([
      input.portfolio.portfolioId,
      input.selectionReceipt.receiptId,
      ...candidate.impactObjectRefs,
      ...candidate.requiredDataRefs,
      ...candidate.dependencyRefs,
      ...candidate.firstNarrowLoop.observationRefs,
      ...selection.implementationScopeRefs,
    ]),
    knowledgeRefs,
    evidenceRefs,
    policyRefs: [input.portfolio.policyRef],
    receiptRefs: uniqueSorted([
      input.portfolio.gateReceiptRef,
      generationReceiptRef,
      input.selectionReceipt.receiptId,
    ]),
    alternatives: input.portfolio.candidates
      .filter((item) => item.questionId !== candidate.questionId)
      .map((item) => `${item.questionId}: ${item.question}`),
    recommendedOption:
      selection.goal?.trim() || candidate.firstNarrowLoop.objective,
    confidence: candidate.confidence,
    riskLevel: decisionRiskLevel(candidate),
    allowedActionLevel: "draft_task",
    ownerGate: "approval_required",
    expiryOrReviewAt: selection.endsAt,
    rollbackPath:
      "Return the selected operating question to observation; do not dispatch work without owner confirmation.",
  };
  return {
    decision,
    facts: candidate.facts,
    inferences: candidate.inferences,
    unknowns: candidate.unknowns,
    risks: candidate.risks,
    candidateHash: candidate.contentHash,
  };
}
