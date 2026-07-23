import { describe, expect, it } from "vitest";

import { validateDecisionObject } from "@/lib/agentos-decision-supervision/contract";

import {
  evaluateCaioOperatingQuestionGeneration,
  type CaioOperatingQuestionPortfolio,
} from "./caio-operating-question";
import {
  projectCaioSelectedOperatingQuestionToDecision,
} from "./caio-operating-question-decision";
import {
  syntheticOperatingQuestionGenerationInput,
} from "./caio-operating-question.test-fixtures";
import {
  createCaioQuestionSelectionReceipt,
  type CaioQuestionSelectionReceipt,
} from "./caio-question-selection";

function generatedPortfolio(): CaioOperatingQuestionPortfolio {
  const evaluation = evaluateCaioOperatingQuestionGeneration(
    syntheticOperatingQuestionGenerationInput(),
  );
  if (!evaluation.portfolio) {
    throw new Error("synthetic portfolio required");
  }
  return evaluation.portfolio;
}

function selectedReceipt(
  portfolio: CaioOperatingQuestionPortfolio,
): CaioQuestionSelectionReceipt {
  return createCaioQuestionSelectionReceipt({
    portfolio,
    workspaceRef: portfolio.workspaceRef,
    ceoPrincipalBindingRef: "binding:ceo:synthetic-caio",
    ceoPrincipalRef: "principal:ceo:synthetic-caio",
    actorUserRef: "user:ceo:synthetic-caio",
    idempotencyKey: "selection:synthetic-caio:decision",
    previousReceipt: null,
    selections: [
      {
        questionId: portfolio.candidates[0].questionId,
        questionOverride: "Which selected constraint should the CEO govern first?",
        goal: "Validate the selected operating constraint",
        successMetrics: [
          {
            metricKey: "metric-1",
            target: "Improve from the governed baseline",
          },
        ],
        priority: 1,
        implementationScopeRefs: ["scope:review-only"],
        ownerRef: null,
        reviewerRef: null,
        startsAt: null,
        endsAt: "2026-08-23T09:00:00.000Z",
        prohibitedActions: ["external_side_effect"],
      },
    ],
    reasonCodes: ["ceo_selected_operating_focus"],
    evidenceRefs: [portfolio.candidates[0].evidenceRefs[0]],
    selectedAt: "2026-07-23T10:00:00.000Z",
  });
}

describe("CAIO selected operating question DecisionRecord projection", () => {
  it("projects one selected question into the canonical DecisionObject boundary", () => {
    const portfolio = generatedPortfolio();
    const selectionReceipt = selectedReceipt(portfolio);

    const projected = projectCaioSelectedOperatingQuestionToDecision({
      portfolio,
      generationReceiptRef: "caio-question-generation:synthetic",
      selectionReceipt,
      questionId: selectionReceipt.selectedQuestionIds[0],
      knowledgeRefs: [
        "memory-fact:operating-system",
        "artifact:temporal-context:operating-system",
      ],
    });

    expect(validateDecisionObject(projected.decision)).toMatchObject({
      valid: true,
      maxActionLevel: "draft_task",
    });
    expect(projected.decision).toMatchObject({
      tenantRef: portfolio.workspaceRef,
      decisionType: "prioritization",
      businessQuestion:
        "Which selected constraint should the CEO govern first?",
      allowedActionLevel: "draft_task",
      ownerGate: "approval_required",
      expiryOrReviewAt: "2026-08-23T09:00:00.000Z",
    });
    expect(projected.decision.receiptRefs).toEqual(
      expect.arrayContaining([
        portfolio.gateReceiptRef,
        selectionReceipt.receiptId,
        "caio-question-generation:synthetic",
      ]),
    );
    expect(projected.candidateHash).toBe(
      portfolio.candidates[0].contentHash,
    );
    expect(projected.facts).toEqual(portfolio.candidates[0].facts);
  });

  it("is deterministic and never creates an execution or authority object", () => {
    const portfolio = generatedPortfolio();
    const selectionReceipt = selectedReceipt(portfolio);
    const input = {
      portfolio,
      generationReceiptRef: "caio-question-generation:synthetic",
      selectionReceipt,
      questionId: selectionReceipt.selectedQuestionIds[0],
      knowledgeRefs: ["memory-fact:operating-system"],
    };

    const first = projectCaioSelectedOperatingQuestionToDecision(input);
    const second = projectCaioSelectedOperatingQuestionToDecision(input);

    expect(second).toEqual(first);
    expect(first.decision.decisionId).toBe(second.decision.decisionId);
    expect(first).not.toHaveProperty("workPacket");
    expect(first).not.toHaveProperty("authorityEffect");
  });

  it("rejects unselected questions and missing governed knowledge", () => {
    const portfolio = generatedPortfolio();
    const selectionReceipt = selectedReceipt(portfolio);

    expect(() =>
      projectCaioSelectedOperatingQuestionToDecision({
        portfolio,
        generationReceiptRef: "caio-question-generation:synthetic",
        selectionReceipt,
        questionId: portfolio.candidates[1].questionId,
        knowledgeRefs: ["memory-fact:operating-system"],
      }),
    ).toThrow("selected_operating_question_required");
    expect(() =>
      projectCaioSelectedOperatingQuestionToDecision({
        portfolio,
        generationReceiptRef: "caio-question-generation:synthetic",
        selectionReceipt,
        questionId: selectionReceipt.selectedQuestionIds[0],
        knowledgeRefs: [],
      }),
    ).toThrow("governed_knowledge_ref_required");
  });
});
