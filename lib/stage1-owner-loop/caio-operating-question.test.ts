import { describe, expect, it } from "vitest";

import { canonicalJson, sha256 } from "../expert-capability/hashing";
import {
  createCaioOperatingQuestionG0Context,
  createCaioOperatingQuestionGenerationReceipt,
  evaluateCaioOperatingQuestionGeneration,
  validateCaioOperatingQuestionGenerationReceipt,
  validateCaioOperatingQuestionGenerationReceiptAgainstPrevious,
  validateCaioOperatingQuestionGenerationReceiptAgainstPortfolio,
  validateCaioOperatingQuestionPortfolio,
  validateCaioOperatingQuestionPortfolioAgainstG0,
  validateCaioOperatingQuestionPortfolioAgainstPrevious,
  type CaioOperatingQuestionCandidateDraft,
  type CaioOperatingQuestionGenerationEvaluation,
  type CaioOperatingQuestionGenerationReceipt,
  type CaioOperatingQuestionPortfolio,
} from "./caio-operating-question";
import {
  SYNTHETIC_CAIO_EVIDENCE_REFS as EVIDENCE_REFS,
  syntheticOperatingQuestionCandidate as candidate,
  syntheticOperatingQuestionG0Context,
  syntheticOperatingQuestionG0Source,
  syntheticOperatingQuestionGenerationInput as generationInput,
} from "./caio-operating-question.test-fixtures";
import { createCaioInitializationRevocationReceipt } from "./caio-initialization-gate-receipt";

function resignPortfolio(
  portfolio: CaioOperatingQuestionPortfolio,
): CaioOperatingQuestionPortfolio {
  const {
    portfolioId: _portfolioId,
    contentHash: _contentHash,
    ...basis
  } = portfolio;
  const basisHash = sha256(canonicalJson(basis));
  const rebound = {
    ...basis,
    portfolioId: `caio-question-portfolio:${basisHash.slice(7, 31)}`,
  };
  return {
    ...rebound,
    contentHash: sha256(canonicalJson(rebound)),
  };
}

function resignGenerationReceipt(
  receipt: CaioOperatingQuestionGenerationReceipt,
): CaioOperatingQuestionGenerationReceipt {
  const {
    receiptId: _receiptId,
    contentHash: _contentHash,
    ...basis
  } = receipt;
  const basisHash = sha256(canonicalJson(basis));
  const rebound = {
    ...basis,
    receiptId: `caio-question-generation:${basisHash.slice(7, 31)}`,
  };
  return {
    ...rebound,
    contentHash: sha256(canonicalJson(rebound)),
  };
}

function generationReceiptInput(
  evaluation: CaioOperatingQuestionGenerationEvaluation,
  previousReceipt: CaioOperatingQuestionGenerationReceipt | null = null,
) {
  return {
    evaluation,
    previousReceipt,
    evidenceRefs: syntheticOperatingQuestionG0Context().evidenceRefs,
    recordedAt: "2026-07-23T10:00:00.000Z",
  };
}

describe("CAIO operating question portfolio", () => {
  it("creates exactly ten ranked, evidence-bound candidates", () => {
    const result = evaluateCaioOperatingQuestionGeneration(generationInput());

    expect(result.status).toBe("generated");
    expect(result.gapCodes).toEqual([]);
    expect(result.portfolio?.candidates).toHaveLength(10);
    expect(result.portfolio?.candidates.map((item) => item.rank)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
    expect(
      result.portfolio
        ? validateCaioOperatingQuestionPortfolio(result.portfolio)
        : null,
    ).toEqual({ valid: true, errors: [] });
    expect(
      result.portfolio
        ? validateCaioOperatingQuestionPortfolioAgainstG0(
            result.portfolio,
            syntheticOperatingQuestionG0Context(),
          )
        : null,
    ).toEqual({ valid: true, errors: [] });
    expect(result.portfolio?.authorityEffect).toBe("none");
  });

  it.each([9, 11])(
    "returns an insufficient-evidence result for %s candidates",
    (count) => {
      const result = evaluateCaioOperatingQuestionGeneration(
        generationInput(
          Array.from({ length: count }, (_, index) => candidate(index)),
        ),
      );

      expect(result.status).toBe("insufficient_evidence");
      expect(result.portfolio).toBeNull();
      expect(result.gapCodes).toContain("candidate_count_not_ten");
    },
  );

  it.each([
    {
      name: "duplicate ids",
      mutate: (candidates: CaioOperatingQuestionCandidateDraft[]) => {
        candidates[1].questionId = candidates[0].questionId;
      },
      gap: "candidate_id_not_unique",
    },
    {
      name: "duplicate titles",
      mutate: (candidates: CaioOperatingQuestionCandidateDraft[]) => {
        candidates[1].title = candidates[0].title;
      },
      gap: "candidate_title_not_unique",
    },
    {
      name: "duplicate questions",
      mutate: (candidates: CaioOperatingQuestionCandidateDraft[]) => {
        candidates[1].question = candidates[0].question;
      },
      gap: "candidate_question_not_unique",
    },
  ])("rejects $name", ({ mutate, gap }) => {
    const candidates = Array.from({ length: 10 }, (_, index) =>
      candidate(index),
    );
    mutate(candidates);

    const result = evaluateCaioOperatingQuestionGeneration(
      generationInput(candidates),
    );

    expect(result.status).toBe("insufficient_evidence");
    expect(result.gapCodes).toContain(gap);
  });

  it("rejects evidence that is outside the accepted G0 basis", () => {
    const candidates = Array.from({ length: 10 }, (_, index) =>
      candidate(index),
    );
    candidates[0] = candidate(0, {
      evidenceRefs: ["evidence:invented"],
      facts: [
        {
          statement: "Invented fact",
          evidenceRefs: ["evidence:invented"],
          freshness: "fresh",
        },
      ],
      inferences: [
        {
          statement: "Invented inference",
          evidenceRefs: ["evidence:invented"],
          freshness: "fresh",
        },
      ],
    });

    const result = evaluateCaioOperatingQuestionGeneration(
      generationInput(candidates),
    );

    expect(result.status).toBe("insufficient_evidence");
    expect(result.gapCodes).toContain("candidate_1:evidence_outside_g0_basis");
  });

  it("rejects undeclared statement evidence", () => {
    const candidates = Array.from({ length: 10 }, (_, index) =>
      candidate(index),
    );
    candidates[0].facts[0].evidenceRefs = [EVIDENCE_REFS[1]];

    const result = evaluateCaioOperatingQuestionGeneration(
      generationInput(candidates),
    );

    expect(result.gapCodes).toContain("candidate_1:evidence_not_declared");
  });

  it("rejects template placeholders instead of filling the portfolio", () => {
    const candidates = Array.from({ length: 10 }, (_, index) =>
      candidate(index),
    );
    candidates[0].question = "TODO: replace this question";

    const result = evaluateCaioOperatingQuestionGeneration(
      generationInput(candidates),
    );

    expect(result.status).toBe("insufficient_evidence");
    expect(result.gapCodes).toContain(
      "candidate_1:template_placeholder_present",
    );
  });

  it("rejects template placeholders hidden in supporting evidence text", () => {
    const candidates = Array.from({ length: 10 }, (_, index) =>
      candidate(index),
    );
    candidates[0].facts[0].statement = "TODO: replace supporting evidence";

    const result = evaluateCaioOperatingQuestionGeneration(
      generationInput(candidates),
    );

    expect(result.status).toBe("insufficient_evidence");
    expect(result.gapCodes).toContain(
      "candidate_1:template_placeholder_present",
    );
  });

  it("requires evidence for a quantified value claim", () => {
    const candidates = Array.from({ length: 10 }, (_, index) =>
      candidate(index),
    );
    candidates[0].valueHypothesis = {
      description: "A monetary value claim",
      quantifiedValue: 1_000_000,
      currency: "CNY",
      evidenceRefs: [],
      unknownReason: null,
    };

    const result = evaluateCaioOperatingQuestionGeneration(
      generationInput(candidates),
    );

    expect(result.gapCodes).toContain(
      "candidate_1:quantified_value_evidence_required",
    );
  });

  it("requires an explicit unknown reason when value cannot be quantified", () => {
    const candidates = Array.from({ length: 10 }, (_, index) =>
      candidate(index),
    );
    candidates[0].valueHypothesis.unknownReason = null;

    const result = evaluateCaioOperatingQuestionGeneration(
      generationInput(candidates),
    );

    expect(result.gapCodes).toContain(
      "candidate_1:value_unknown_reason_required",
    );
  });

  it("produces a generated receipt without granting authority", () => {
    const evaluation =
      evaluateCaioOperatingQuestionGeneration(generationInput());
    const receipt = createCaioOperatingQuestionGenerationReceipt(
      generationReceiptInput(evaluation),
    );

    expect(receipt.status).toBe("generated");
    expect(receipt.portfolioRef).toBe(evaluation.portfolio?.portfolioId);
    expect(receipt.authorityEffect).toBe("none");
    expect(validateCaioOperatingQuestionGenerationReceipt(receipt)).toEqual({
      valid: true,
      errors: [],
    });
  });

  it("does not let a generated portfolio be rebound to another context", () => {
    const evaluation =
      evaluateCaioOperatingQuestionGeneration(generationInput());
    const reboundEvaluation = {
      ...evaluation,
      workspaceRef: "workspace:another",
    };

    expect(() =>
      createCaioOperatingQuestionGenerationReceipt(
        generationReceiptInput(reboundEvaluation),
      ),
    ).toThrow("caio_question_generation_receipt_binding_invalid");
  });

  it("produces a gap receipt and no portfolio when evidence is insufficient", () => {
    const evaluation = evaluateCaioOperatingQuestionGeneration(
      generationInput([candidate(0)]),
    );
    const receipt = createCaioOperatingQuestionGenerationReceipt(
      generationReceiptInput(evaluation),
    );

    expect(receipt.status).toBe("insufficient_evidence");
    expect(receipt.portfolioRef).toBeNull();
    expect(receipt.gapCodes).toContain("candidate_count_not_ten");
    expect(validateCaioOperatingQuestionGenerationReceipt(receipt)).toEqual({
      valid: true,
      errors: [],
    });
  });

  it("does not create a generated receipt when the evaluation still has gaps", () => {
    const evaluation =
      evaluateCaioOperatingQuestionGeneration(generationInput());

    expect(() =>
      createCaioOperatingQuestionGenerationReceipt(
        generationReceiptInput({
          ...evaluation,
          gapCodes: ["unexpected_gap"],
        }),
      ),
    ).toThrow("caio_question_generated_gap_not_allowed");
  });

  it("does not create an insufficient-evidence receipt with only blank gaps", () => {
    const evaluation = evaluateCaioOperatingQuestionGeneration(
      generationInput([candidate(0)]),
    );

    expect(() =>
      createCaioOperatingQuestionGenerationReceipt(
        generationReceiptInput({
          ...evaluation,
          gapCodes: [""],
        }),
      ),
    ).toThrow("caio_question_insufficient_evidence_gap_required");
  });

  it("detects a tampered ranked candidate", () => {
    const result = evaluateCaioOperatingQuestionGeneration(generationInput());
    if (!result.portfolio) {
      throw new Error("generated portfolio required");
    }
    const tampered = structuredClone(result.portfolio);
    tampered.candidates[0].rank = 10;

    expect(validateCaioOperatingQuestionPortfolio(tampered).errors).toEqual(
      expect.arrayContaining([
        "portfolio_governance_or_ranking_invalid",
        "portfolio_candidate_hash_invalid",
        "portfolio_content_hash_invalid",
      ]),
    );
  });

  it("is deterministic when the generator returns the same candidates in another order", () => {
    const candidates = Array.from({ length: 10 }, (_, index) =>
      candidate(index),
    );
    const forward = evaluateCaioOperatingQuestionGeneration(
      generationInput(candidates),
    );
    const reversed = evaluateCaioOperatingQuestionGeneration(
      generationInput([...candidates].reverse()),
    );

    expect(reversed.generationInputHash).toBe(forward.generationInputHash);
    expect(reversed.portfolio?.portfolioId).toBe(
      forward.portfolio?.portfolioId,
    );
    expect(reversed.portfolio?.contentHash).toBe(
      forward.portfolio?.contentHash,
    );
  });

  it("rejects a re-signed portfolio whose evidence set is not the candidate union", () => {
    const result = evaluateCaioOperatingQuestionGeneration(generationInput());
    if (!result.portfolio) {
      throw new Error("generated portfolio required");
    }
    const tampered = resignPortfolio({
      ...result.portfolio,
      evidenceRefs: [
        ...result.portfolio.evidenceRefs,
        "evidence:not-used-by-any-candidate",
      ],
    });

    expect(validateCaioOperatingQuestionPortfolio(tampered).errors).toContain(
      "portfolio_evidence_union_invalid",
    );
  });

  it("rejects a re-signed portfolio whose candidate order ignores scores", () => {
    const result = evaluateCaioOperatingQuestionGeneration(generationInput());
    if (!result.portfolio) {
      throw new Error("generated portfolio required");
    }
    const candidates = structuredClone(result.portfolio.candidates);
    [candidates[0], candidates[9]] = [candidates[9], candidates[0]];
    for (const [index, item] of candidates.entries()) {
      const { contentHash: _contentHash, ...content } = item;
      const rebound = { ...content, rank: index + 1 };
      candidates[index] = {
        ...rebound,
        contentHash: sha256(canonicalJson(rebound)),
      };
    }
    const tampered = resignPortfolio({
      ...result.portfolio,
      candidates,
    });

    expect(validateCaioOperatingQuestionPortfolio(tampered).errors).toContain(
      "portfolio_candidate_order_invalid",
    );
  });

  it("rejects a portfolio id that is changed and then re-hashed", () => {
    const result = evaluateCaioOperatingQuestionGeneration(generationInput());
    if (!result.portfolio) {
      throw new Error("generated portfolio required");
    }
    const changedIdentity = {
      ...result.portfolio,
      portfolioId: "caio-question-portfolio:forged",
    };
    const { contentHash: _ignored, ...content } = changedIdentity;
    const tampered = {
      ...changedIdentity,
      contentHash: sha256(canonicalJson(content)),
    };

    expect(validateCaioOperatingQuestionPortfolio(tampered).errors).toContain(
      "portfolio_id_invalid",
    );
  });

  it("rejects an unknown generation status even when the receipt is re-signed", () => {
    const evaluation =
      evaluateCaioOperatingQuestionGeneration(generationInput());
    const receipt = createCaioOperatingQuestionGenerationReceipt(
      generationReceiptInput(evaluation),
    );
    const tampered = resignGenerationReceipt({
      ...receipt,
      status: "unknown" as never,
    });

    expect(
      validateCaioOperatingQuestionGenerationReceipt(tampered).errors,
    ).toContain("generation_receipt_status_invalid");
  });

  it("rejects a generation receipt id that is changed and then re-hashed", () => {
    const evaluation =
      evaluateCaioOperatingQuestionGeneration(generationInput());
    const receipt = createCaioOperatingQuestionGenerationReceipt(
      generationReceiptInput(evaluation),
    );
    const changedIdentity = {
      ...receipt,
      receiptId: "caio-question-generation:forged",
    };
    const { contentHash: _ignored, ...content } = changedIdentity;
    const tampered = {
      ...changedIdentity,
      contentHash: sha256(canonicalJson(content)),
    };

    expect(
      validateCaioOperatingQuestionGenerationReceipt(tampered).errors,
    ).toContain("generation_receipt_id_invalid");
  });

  it("rejects a fully re-signed generation receipt rebound to another portfolio", () => {
    const evaluation =
      evaluateCaioOperatingQuestionGeneration(generationInput());
    if (!evaluation.portfolio) {
      throw new Error("generated portfolio required");
    }
    const receipt = createCaioOperatingQuestionGenerationReceipt(
      generationReceiptInput(evaluation),
    );
    const rebound = resignGenerationReceipt({
      ...receipt,
      portfolioRef: "caio-question-portfolio:nonexistent",
      portfolioHash: `sha256:${"f".repeat(64)}`,
    });

    expect(validateCaioOperatingQuestionGenerationReceipt(rebound).valid).toBe(
      true,
    );
    expect(
      validateCaioOperatingQuestionGenerationReceiptAgainstPortfolio(
        rebound,
        evaluation.portfolio,
      ).errors,
    ).toContain("generation_receipt_portfolio_binding_invalid");
  });

  it("rejects a revoked G0 receipt before question generation", () => {
    const source = syntheticOperatingQuestionG0Source();
    const revoked = createCaioInitializationRevocationReceipt({
      workspaceRef: source.assessment.workspaceRef,
      assessment: source.assessment,
      mandateRef: source.assessment.mandateRef,
      ceoPrincipalBindingRef: source.gateReceipt.ceoPrincipalBindingRef,
      ceoPrincipalRef: source.gateReceipt.ceoPrincipalRef,
      actorUserRef: source.gateReceipt.actorUserRef,
      idempotencyKey: "revoke:synthetic-caio:v1",
      evidenceRefs: ["evidence:ceo-revoked-g0"],
      previousReceipt: {
        receiptId: source.gateReceipt.receiptId,
        contentHash: source.gateReceipt.contentHash,
        sequence: source.gateReceipt.sequence,
        resultingStatus: source.gateReceipt.resultingStatus,
        assessmentRef: source.gateReceipt.assessmentRef,
        recordedAt: source.gateReceipt.recordedAt,
      },
      recordedAt: "2026-07-23T08:30:00.000Z",
      acceptedExceptionRefs: [],
      reasonCodes: ["owner_revoked_scope"],
    });

    expect(() =>
      createCaioOperatingQuestionG0Context({
        ...source,
        gateReceipt: revoked,
        currentHead: {
          currentReceiptRef: revoked.receiptId,
          currentReceiptHash: revoked.contentHash,
          currentAssessmentRef: source.assessment.assessmentId,
          sequence: revoked.sequence,
        },
      }),
    ).toThrow("caio_operating_question_g0_not_accepted");
  });

  it("returns a fail-closed gap for malformed model output", () => {
    const malformed = Array.from({ length: 10 }, (_, index) =>
      candidate(index),
    ) as Array<Record<string, unknown>>;
    malformed[0] = { ...malformed[0], facts: undefined };

    const result = evaluateCaioOperatingQuestionGeneration(
      generationInput(malformed),
    );

    expect(result.status).toBe("insufficient_evidence");
    expect(result.portfolio).toBeNull();
    expect(result.gapCodes).toContain("candidate_payload_invalid");
  });

  it("rejects a non-canonical timestamp", () => {
    const result = evaluateCaioOperatingQuestionGeneration({
      ...generationInput(),
      generatedAt: "2026-07-23 09:00:00Z",
    });

    expect(result.status).toBe("insufficient_evidence");
    expect(result.gapCodes).toContain("generation_context_invalid");
  });

  it("does not let an insufficient result be rebound to another context", () => {
    const evaluation = evaluateCaioOperatingQuestionGeneration(
      generationInput([candidate(0)]),
    );
    const reboundEvaluation = {
      ...evaluation,
      workspaceRef: "workspace:another",
    };

    expect(() =>
      createCaioOperatingQuestionGenerationReceipt(
        generationReceiptInput(reboundEvaluation),
      ),
    ).toThrow("caio_question_generation_receipt_binding_invalid");
  });

  it("detects a fully re-signed evidence forgery against trusted G0", () => {
    const result = evaluateCaioOperatingQuestionGeneration(generationInput());
    if (!result.portfolio) {
      throw new Error("generated portfolio required");
    }
    const candidates = structuredClone(result.portfolio.candidates);
    const first = candidates[0];
    const { contentHash: _contentHash, ...candidateBasis } = first;
    const forgedCandidateBasis = {
      ...candidateBasis,
      facts: candidateBasis.facts.map((fact) => ({
        ...fact,
        evidenceRefs: ["evidence:forged"],
      })),
      inferences: candidateBasis.inferences.map((inference) => ({
        ...inference,
        evidenceRefs: ["evidence:forged"],
      })),
      evidenceRefs: ["evidence:forged"],
    };
    candidates[0] = {
      ...forgedCandidateBasis,
      contentHash: sha256(canonicalJson(forgedCandidateBasis)),
    };
    const forged = resignPortfolio({
      ...result.portfolio,
      candidates,
      evidenceRefs: [
        "evidence:forged",
        ...result.portfolio.evidenceRefs.filter(
          (ref) => !first.evidenceRefs.includes(ref),
        ),
      ].sort(),
    });

    expect(validateCaioOperatingQuestionPortfolio(forged).valid).toBe(true);
    expect(
      validateCaioOperatingQuestionPortfolioAgainstG0(
        forged,
        syntheticOperatingQuestionG0Context(),
      ).errors,
    ).toContain("portfolio_evidence_outside_g0_basis");
  });

  it("creates an explicit append-only portfolio and generation receipt chain", () => {
    const firstEvaluation =
      evaluateCaioOperatingQuestionGeneration(generationInput());
    if (!firstEvaluation.portfolio) {
      throw new Error("first portfolio required");
    }
    const firstReceipt = createCaioOperatingQuestionGenerationReceipt(
      generationReceiptInput(firstEvaluation),
    );
    const secondEvaluation = evaluateCaioOperatingQuestionGeneration({
      ...generationInput(),
      generationKey: "generation:synthetic-caio:2",
      generatedAt: "2026-07-23T11:00:00.000Z",
      previousPortfolio: firstEvaluation.portfolio,
    });
    if (!secondEvaluation.portfolio) {
      throw new Error("second portfolio required");
    }
    const secondReceipt = createCaioOperatingQuestionGenerationReceipt({
      ...generationReceiptInput(secondEvaluation, firstReceipt),
      recordedAt: "2026-07-23T12:00:00.000Z",
    });

    expect(secondEvaluation.portfolio.sequence).toBe(2);
    expect(secondEvaluation.portfolio.previousPortfolioRef).toBe(
      firstEvaluation.portfolio.portfolioId,
    );
    expect(
      validateCaioOperatingQuestionPortfolioAgainstPrevious(
        secondEvaluation.portfolio,
        firstEvaluation.portfolio,
      ),
    ).toEqual({ valid: true, errors: [] });
    expect(secondReceipt.sequence).toBe(2);
    expect(secondReceipt.previousReceiptRef).toBe(firstReceipt.receiptId);
    expect(
      validateCaioOperatingQuestionGenerationReceiptAgainstPrevious(
        secondReceipt,
        firstReceipt,
      ),
    ).toEqual({ valid: true, errors: [] });
  });

  it("does not continue a portfolio chain across different accepted G0 contexts", () => {
    const firstEvaluation =
      evaluateCaioOperatingQuestionGeneration(generationInput());
    if (!firstEvaluation.portfolio) {
      throw new Error("first portfolio required");
    }
    const foreignPrevious = resignPortfolio({
      ...firstEvaluation.portfolio,
      gateReceiptRef: "gate:other",
      gateReceiptHash: `sha256:${"e".repeat(64)}`,
      assessmentRef: "assessment:other",
      assessmentHash: `sha256:${"d".repeat(64)}`,
      g0ContextHash: `sha256:${"c".repeat(64)}`,
      evidenceUniverseHash: `sha256:${"b".repeat(64)}`,
    });
    const result = evaluateCaioOperatingQuestionGeneration({
      ...generationInput(),
      generationKey: "generation:synthetic-caio:cross-g0",
      previousPortfolio: foreignPrevious,
    });

    expect(result.status).toBe("insufficient_evidence");
    expect(result.gapCodes).toContain("previous_portfolio_invalid");
  });

  it("uses a locale-independent code-point tie break", () => {
    const ids = ["问题-z", "question-a", "é-question", "e-question"];
    const candidates = Array.from({ length: 10 }, (_, index) => {
      const item = candidate(index);
      item.questionId = ids[index] ?? `question-${index}`;
      item.scores = { ...candidate(0).scores };
      return item;
    });
    const forward = evaluateCaioOperatingQuestionGeneration(
      generationInput(candidates),
    );
    const reversed = evaluateCaioOperatingQuestionGeneration(
      generationInput([...candidates].reverse()),
    );

    expect(forward.status).toBe("generated");
    expect(
      reversed.portfolio?.candidates.map((item) => item.questionId),
    ).toEqual(forward.portfolio?.candidates.map((item) => item.questionId));
  });
});
