import { describe, expect, it } from "vitest";

import { canonicalJson, sha256 } from "../expert-capability/hashing";
import {
  evaluateCaioOperatingQuestionGeneration,
  type CaioOperatingQuestionPortfolio,
} from "./caio-operating-question";
import {
  createCaioQuestionSelectionReceipt,
  validateCaioQuestionSelectionReceipt,
  validateCaioQuestionSelectionReceiptAgainstPortfolio,
  validateCaioQuestionSelectionReceiptAgainstPrevious,
  type CaioQuestionSelectionItem,
} from "./caio-question-selection";
import { syntheticOperatingQuestionGenerationInput } from "./caio-operating-question.test-fixtures";

const NOW = "2026-07-23T10:00:00.000Z";

function resignSelectionReceipt(
  receipt: ReturnType<typeof createCaioQuestionSelectionReceipt>,
) {
  const {
    receiptId: _receiptId,
    contentHash: _contentHash,
    ...basis
  } = receipt;
  const basisHash = sha256(canonicalJson(basis));
  const rebound = {
    ...basis,
    receiptId: `caio-question-selection:${basisHash.slice(7, 31)}`,
  };
  return {
    ...rebound,
    contentHash: sha256(canonicalJson(rebound)),
  };
}

function portfolio(): CaioOperatingQuestionPortfolio {
  const evaluation = evaluateCaioOperatingQuestionGeneration(
    syntheticOperatingQuestionGenerationInput(),
  );
  if (!evaluation.portfolio) {
    throw new Error("synthetic portfolio required");
  }
  return evaluation.portfolio;
}

function selection(
  questionId: string,
  priority: number,
): CaioQuestionSelectionItem {
  return {
    questionId,
    questionOverride: null,
    goal: `Validate ${questionId}`,
    successMetrics: [
      {
        metricKey: `metric:${questionId}`,
        target: "Improve against the governed baseline",
      },
    ],
    priority,
    implementationScopeRefs: [`scope:${questionId}`],
    ownerRef: "role:operating-owner",
    reviewerRef: "role:independent-reviewer",
    startsAt: "2026-07-24T00:00:00.000Z",
    endsAt: "2026-08-23T00:00:00.000Z",
    prohibitedActions: ["external_send_without_review"],
  };
}

function receiptInput(selections: readonly CaioQuestionSelectionItem[]) {
  return {
    portfolio: portfolio(),
    workspaceRef: "workspace:synthetic-caio",
    ceoPrincipalBindingRef: "caio-principal-binding:ceo",
    ceoPrincipalRef: "principal:ceo",
    actorUserRef: "user:ceo",
    idempotencyKey: "selection:synthetic-caio:1",
    previousReceipt: null,
    selections,
    reasonCodes: ["ceo_priority_reviewed"],
    evidenceRefs: ["evidence:ceo-selection"],
    selectedAt: NOW,
  };
}

describe("CAIO CEO question selection", () => {
  it("allows an explicit zero-question selection without creating work", () => {
    const receipt = createCaioQuestionSelectionReceipt(receiptInput([]));

    expect(receipt.selections).toEqual([]);
    expect(receipt.selectedQuestionIds).toEqual([]);
    expect(receipt.authorityEffect).toBe("none");
    expect(receipt.workPacketEffect).toBe("none");
    expect(validateCaioQuestionSelectionReceipt(receipt)).toEqual({
      valid: true,
      errors: [],
    });
  });

  it("rejects duplicate success-metric keys instead of hashing input order", () => {
    const duplicateMetrics = selection(
      portfolio().candidates[0].questionId,
      1,
    );
    duplicateMetrics.successMetrics = [
      { metricKey: "metric:duplicate", target: "first" },
      { metricKey: "metric:duplicate", target: "second" },
    ];

    expect(() =>
      createCaioQuestionSelectionReceipt(receiptInput([duplicateMetrics])),
    ).toThrow("caio_question_selection_item_invalid");
  });

  it("allows up to three portfolio questions and normalizes priority order", () => {
    const candidateIds = portfolio()
      .candidates.slice(0, 3)
      .map((candidate) => candidate.questionId);
    const receipt = createCaioQuestionSelectionReceipt(
      receiptInput([
        selection(candidateIds[1], 2),
        selection(candidateIds[0], 1),
        selection(candidateIds[2], 3),
      ]),
    );

    expect(receipt.selectedQuestionIds).toEqual(candidateIds);
    expect(validateCaioQuestionSelectionReceipt(receipt)).toEqual({
      valid: true,
      errors: [],
    });
  });

  it("rejects more than three selections", () => {
    const candidateIds = portfolio()
      .candidates.slice(0, 4)
      .map((candidate) => candidate.questionId);

    expect(() =>
      createCaioQuestionSelectionReceipt(
        receiptInput(
          candidateIds.map((questionId, index) =>
            selection(questionId, index + 1),
          ),
        ),
      ),
    ).toThrow("caio_question_selection_limit_exceeded");
  });

  it("rejects duplicate and out-of-portfolio question ids", () => {
    const questionId = portfolio().candidates[0].questionId;

    expect(() =>
      createCaioQuestionSelectionReceipt(
        receiptInput([selection(questionId, 1), selection(questionId, 2)]),
      ),
    ).toThrow("caio_question_selection_duplicate");
    expect(() =>
      createCaioQuestionSelectionReceipt(
        receiptInput([selection("question:not-in-portfolio", 1)]),
      ),
    ).toThrow("caio_question_selection_outside_portfolio");
  });

  it("rejects non-contiguous priorities and invalid time windows", () => {
    const questionId = portfolio().candidates[0].questionId;
    expect(() =>
      createCaioQuestionSelectionReceipt(
        receiptInput([selection(questionId, 2)]),
      ),
    ).toThrow("caio_question_selection_item_invalid");

    const invalidWindow = selection(questionId, 1);
    invalidWindow.startsAt = "2026-08-24T00:00:00.000Z";
    invalidWindow.endsAt = "2026-08-23T00:00:00.000Z";
    expect(() =>
      createCaioQuestionSelectionReceipt(receiptInput([invalidWindow])),
    ).toThrow("caio_question_selection_item_invalid");
  });

  it("appends a new immutable selection version", () => {
    const selectedPortfolio = portfolio();
    const first = createCaioQuestionSelectionReceipt({
      ...receiptInput([
        selection(selectedPortfolio.candidates[0].questionId, 1),
      ]),
      portfolio: selectedPortfolio,
    });
    const second = createCaioQuestionSelectionReceipt({
      ...receiptInput([]),
      portfolio: selectedPortfolio,
      idempotencyKey: "selection:synthetic-caio:2",
      previousReceipt: first,
      selectedAt: "2026-07-23T11:00:00.000Z",
    });

    expect(second.sequence).toBe(2);
    expect(second.previousReceiptRef).toBe(first.receiptId);
    expect(second.selectedQuestionIds).toEqual([]);
    expect(validateCaioQuestionSelectionReceipt(second)).toEqual({
      valid: true,
      errors: [],
    });
  });

  it("rejects a previous selection from a different portfolio", () => {
    const selectedPortfolio = portfolio();
    const first = createCaioQuestionSelectionReceipt({
      ...receiptInput([]),
      portfolio: selectedPortfolio,
    });

    expect(() =>
      createCaioQuestionSelectionReceipt({
        ...receiptInput([]),
        idempotencyKey: "selection:synthetic-caio:2",
        previousReceipt: {
          ...first,
          portfolioRef: "portfolio:different",
        },
      }),
    ).toThrow("caio_question_selection_previous_receipt_invalid");
  });

  it("detects a tampered selection receipt", () => {
    const receipt = createCaioQuestionSelectionReceipt(receiptInput([]));
    const tampered = {
      ...receipt,
      workPacketEffect: "created" as never,
    };

    expect(validateCaioQuestionSelectionReceipt(tampered).errors).toEqual(
      expect.arrayContaining([
        "selection_receipt_governance_boundary_invalid",
        "selection_receipt_content_hash_invalid",
      ]),
    );
  });

  it("rejects a re-signed receipt with a non-contiguous priority", () => {
    const questionId = portfolio().candidates[0].questionId;
    const receipt = createCaioQuestionSelectionReceipt(
      receiptInput([selection(questionId, 1)]),
    );
    const tampered = resignSelectionReceipt({
      ...receipt,
      selections: [{ ...receipt.selections[0], priority: 2 }],
    });

    expect(validateCaioQuestionSelectionReceipt(tampered).errors).toContain(
      "selection_receipt_item_invalid",
    );
  });

  it("rejects non-canonical evidence arrays after re-signing", () => {
    const receipt = createCaioQuestionSelectionReceipt(receiptInput([]));
    const tampered = resignSelectionReceipt({
      ...receipt,
      evidenceRefs: ["evidence:z", "evidence:a"],
    });

    expect(validateCaioQuestionSelectionReceipt(tampered).errors).toContain(
      "selection_receipt_canonical_form_invalid",
    );
  });

  it("rejects a selection receipt id that is changed and then re-hashed", () => {
    const receipt = createCaioQuestionSelectionReceipt(receiptInput([]));
    const changedIdentity = {
      ...receipt,
      receiptId: "caio-question-selection:forged",
    };
    const { contentHash: _ignored, ...content } = changedIdentity;
    const tampered = {
      ...changedIdentity,
      contentHash: sha256(canonicalJson(content)),
    };

    expect(validateCaioQuestionSelectionReceipt(tampered).errors).toContain(
      "selection_receipt_id_invalid",
    );
  });

  it("rejects a fully re-signed selection outside the trusted portfolio", () => {
    const selectedPortfolio = portfolio();
    const receipt = createCaioQuestionSelectionReceipt({
      ...receiptInput([]),
      portfolio: selectedPortfolio,
    });
    const tampered = resignSelectionReceipt({
      ...receipt,
      selections: [selection("question:forged", 1)],
      selectedQuestionIds: ["question:forged"],
    });

    expect(validateCaioQuestionSelectionReceipt(tampered).valid).toBe(true);
    expect(
      validateCaioQuestionSelectionReceiptAgainstPortfolio(
        tampered,
        selectedPortfolio,
      ).errors,
    ).toContain("selection_receipt_question_outside_portfolio");
  });

  it("validates an append-only selection against the trusted predecessor", () => {
    const selectedPortfolio = portfolio();
    const first = createCaioQuestionSelectionReceipt({
      ...receiptInput([]),
      portfolio: selectedPortfolio,
    });
    const second = createCaioQuestionSelectionReceipt({
      ...receiptInput([]),
      portfolio: selectedPortfolio,
      idempotencyKey: "selection:synthetic-caio:2",
      previousReceipt: first,
      selectedAt: "2026-07-23T11:00:00.000Z",
    });
    const forged = resignSelectionReceipt({
      ...second,
      previousReceiptRef: "selection:nonexistent",
    });

    expect(
      validateCaioQuestionSelectionReceiptAgainstPrevious(forged, first).errors,
    ).toContain("selection_receipt_predecessor_binding_invalid");
  });

  it("rejects non-canonical CEO selection timestamps", () => {
    const input = {
      ...receiptInput([]),
      selectedAt: "2026-07-23 10:00:00Z",
    };

    expect(() => createCaioQuestionSelectionReceipt(input)).toThrow(
      "caio_question_selection_input_invalid",
    );
  });
});
