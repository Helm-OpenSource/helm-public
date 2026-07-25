import { describe, expect, it } from "vitest";

import {
  createCaioOperatingQuestionImplementationPlan,
  validateCaioOperatingQuestionImplementationPlan,
} from "./caio-operating-question-implementation-plan";
import {
  evaluateCaioOperatingQuestionGeneration,
  type CaioOperatingQuestionPortfolio,
} from "./caio-operating-question";
import {
  createCaioQuestionSelectionReceipt,
  type CaioQuestionSelectionReceipt,
} from "./caio-question-selection";
import {
  SYNTHETIC_CAIO_EVIDENCE_REFS,
  syntheticOperatingQuestionGenerationInput,
} from "./caio-operating-question.test-fixtures";

const DECISION_RECORD_REF = "decision-record:synthetic-caio:1";

function portfolioFixture(): CaioOperatingQuestionPortfolio {
  const evaluation = evaluateCaioOperatingQuestionGeneration(
    syntheticOperatingQuestionGenerationInput(),
  );
  if (!evaluation.portfolio) {
    throw new Error("synthetic portfolio required");
  }
  return evaluation.portfolio;
}

function selectionFixture(
  portfolio: CaioOperatingQuestionPortfolio,
): CaioQuestionSelectionReceipt {
  const candidate = portfolio.candidates[0];
  return createCaioQuestionSelectionReceipt({
    portfolio,
    workspaceRef: portfolio.workspaceRef,
    ceoPrincipalBindingRef: "binding:ceo:synthetic-caio",
    ceoPrincipalRef: "principal:ceo:synthetic-caio",
    actorUserRef: "user:ceo:synthetic-caio",
    idempotencyKey: "selection:synthetic-caio:implementation-plan",
    previousReceipt: null,
    selections: [
      {
        questionId: candidate.questionId,
        questionOverride:
          "Which governed sales constraint should we address first?",
        goal: "Improve the selected governed operating metric",
        successMetrics: [
          {
            metricKey: candidate.validationMetrics[0].metricKey,
            target: "Improve from the accepted baseline",
          },
        ],
        priority: 1,
        implementationScopeRefs: ["scope:operating-question:synthetic"],
        ownerRef: "role:operating-owner",
        reviewerRef: "role:independent-reviewer",
        startsAt: "2026-07-24T00:00:00.000Z",
        endsAt: "2026-08-23T00:00:00.000Z",
        prohibitedActions: ["external_send_without_review"],
      },
    ],
    reasonCodes: ["ceo_selected_operating_focus"],
    evidenceRefs: [SYNTHETIC_CAIO_EVIDENCE_REFS[0]],
    selectedAt: "2026-07-23T10:00:00.000Z",
  });
}

describe("CAIO operating-question implementation plan", () => {
  it("materializes one canonical planning draft without authority or Work Packet effects", () => {
    const portfolio = portfolioFixture();
    const selectionReceipt = selectionFixture(portfolio);
    const questionId = selectionReceipt.selectedQuestionIds[0];

    const plan = createCaioOperatingQuestionImplementationPlan({
      portfolio,
      selectionReceipt,
      questionId,
      decisionRecordRef: DECISION_RECORD_REF,
    });

    expect(plan).toMatchObject({
      workspaceRef: portfolio.workspaceRef,
      portfolioRef: portfolio.portfolioId,
      selectionReceiptRef: selectionReceipt.receiptId,
      questionId,
      decisionRecordRef: DECISION_RECORD_REF,
      status: "DRAFT",
      implementationReadiness: "needs_configuration",
      authorityEffect: "none",
      workPacketEffect: "none",
      review: {
        valueReviewPeriodDays: 30,
        startsAt: "2026-07-24T00:00:00.000Z",
        endsAt: "2026-08-23T00:00:00.000Z",
      },
      execution: {
        workPacketCreation: "owner_confirmation_required",
        executionReceiptRequirement:
          portfolio.candidates[0].firstNarrowLoop.receiptRequirement,
        independentReviewerRef: "role:independent-reviewer",
      },
    });
    expect(plan.baseline.metrics).toEqual(
      portfolio.candidates[0].validationMetrics,
    );
    expect(plan.target.successMetrics).toEqual(
      selectionReceipt.selections[0].successMetrics,
    );
    expect(plan.gapCodes).toEqual([
      "connector_mapping_required",
      "data_disposition_required",
      "escalation_route_required",
      "failure_condition_required",
      "model_route_policy_required",
      "overlay_mapping_required",
      "pack_mapping_required",
      "rollback_condition_required",
      "stop_condition_required",
    ]);
    expect(validateCaioOperatingQuestionImplementationPlan(plan)).toEqual({
      valid: true,
      errors: [],
    });
  });

  it("rejects a question that the CEO did not select", () => {
    const portfolio = portfolioFixture();
    const selectionReceipt = selectionFixture(portfolio);

    expect(() =>
      createCaioOperatingQuestionImplementationPlan({
        portfolio,
        selectionReceipt,
        questionId: portfolio.candidates[1].questionId,
        decisionRecordRef: DECISION_RECORD_REF,
      }),
    ).toThrow("selected_operating_question_required");
  });

  it("detects a tampered decision binding or governance effect", () => {
    const portfolio = portfolioFixture();
    const selectionReceipt = selectionFixture(portfolio);
    const plan = createCaioOperatingQuestionImplementationPlan({
      portfolio,
      selectionReceipt,
      questionId: selectionReceipt.selectedQuestionIds[0],
      decisionRecordRef: DECISION_RECORD_REF,
    });

    const validation = validateCaioOperatingQuestionImplementationPlan({
      ...plan,
      decisionRecordRef: "decision-record:tampered",
      workPacketEffect: "created" as never,
    });

    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain(
      "implementation_plan_governance_boundary_invalid",
    );
    expect(validation.errors).toContain(
      "implementation_plan_content_hash_invalid",
    );
  });

  it.each([
    ["an empty object", {}],
    [
      "a null review object",
      (() => {
        const portfolio = portfolioFixture();
        const selectionReceipt = selectionFixture(portfolio);
        return {
          ...createCaioOperatingQuestionImplementationPlan({
            portfolio,
            selectionReceipt,
            questionId: selectionReceipt.selectedQuestionIds[0],
            decisionRecordRef: DECISION_RECORD_REF,
          }),
          review: null,
        };
      })(),
    ],
    [
      "a non-array evidenceRefs value",
      (() => {
        const portfolio = portfolioFixture();
        const selectionReceipt = selectionFixture(portfolio);
        return {
          ...createCaioOperatingQuestionImplementationPlan({
            portfolio,
            selectionReceipt,
            questionId: selectionReceipt.selectedQuestionIds[0],
            decisionRecordRef: DECISION_RECORD_REF,
          }),
          evidenceRefs: "evidence:not-an-array",
        };
      })(),
    ],
  ])("fails closed for %s without throwing", (_label, malformedPlan) => {
    expect(() =>
      validateCaioOperatingQuestionImplementationPlan(malformedPlan),
    ).not.toThrow();
    expect(
      validateCaioOperatingQuestionImplementationPlan(malformedPlan),
    ).toEqual({
      valid: false,
      errors: ["implementation_plan_shape_invalid"],
    });
  });
});
