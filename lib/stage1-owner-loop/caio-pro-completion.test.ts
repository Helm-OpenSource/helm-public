import { describe, expect, it } from "vitest";

import {
  CAIO_PRO_V1_ATTESTABLE_ITEMS,
  CAIO_PRO_V1_COMPLETION_ITEMS,
  CAIO_PRO_V1_FULL_FUNCTION_OPERATION_BOUNDARY,
  caioQuestionValueReceiptWindowSatisfied,
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
  type CaioProV1CompletionGateReceipt,
} from "./caio-pro-completion";
import {
  syntheticCaioProV1CompletionInput,
  syntheticCaioQuestionValueReceiptInput,
} from "./caio-pro-completion.test-fixtures";

function acceptanceInput(
  assessment = computeCaioProV1CompletionAssessment(
    syntheticCaioProV1CompletionInput(),
  ),
  previousReceipt: Parameters<
    typeof createCaioProV1CompletionAcceptanceReceipt
  >[0]["previousReceipt"] = null,
) {
  return {
    workspaceRef: assessment.workspaceRef,
    assessment,
    ceoPrincipalBindingRef: "binding:ceo:synthetic-completion",
    ceoPrincipalRef: "principal:ceo:synthetic-completion",
    actorUserRef: "user:ceo:synthetic-completion",
    idempotencyKey: "completion-accept-1",
    reasonCodes: ["site_deployment_reviewed"],
    evidenceRefs: ["evidence:completion-acceptance"],
    previousReceipt,
    recordedAt: "2026-06-07T01:00:00.000Z",
  };
}

describe("CaioQuestionValueReceipt", () => {
  it("creates and validates a compliant receipt", () => {
    const receipt = createCaioQuestionValueReceipt(
      syntheticCaioQuestionValueReceiptInput(),
    );
    expect(validateCaioQuestionValueReceipt(receipt)).toEqual({
      valid: true,
      errors: [],
    });
    expect(receipt.authorityEffect).toBe("none");
    expect(caioQuestionValueReceiptWindowSatisfied(receipt)).toBe(true);
  });

  it.each([
    ["token-usage-per-question", "token_usage"],
    ["模型输出数量", "model_output_count"],
    ["monthly report count", "report_count"],
    ["接了多少系统", "system_connection_count"],
    ["connected systems total", "system_connection_count"],
  ])(
    "refuses the forbidden value basis metric %s",
    (metricKey, code) => {
      const input = syntheticCaioQuestionValueReceiptInput();
      input.metricDefinitions[0].metricKey = metricKey;
      expect(() => createCaioQuestionValueReceipt(input)).toThrow(
        `value_receipt_forbidden_value_basis:${code}`,
      );
    },
  );

  it("refuses a forbidden basis hidden inside the definition text", () => {
    const input = syntheticCaioQuestionValueReceiptInput();
    input.metricDefinitions[0].definition =
      "Business value measured as 报告篇数 delivered per week";
    expect(() => createCaioQuestionValueReceipt(input)).toThrow(
      "value_receipt_forbidden_value_basis:report_count",
    );
  });

  it("refuses a quantified claim without currency or evidence", () => {
    const input = syntheticCaioQuestionValueReceiptInput();
    input.observedDelta.currency = null;
    expect(() => createCaioQuestionValueReceipt(input)).toThrow(
      "value_receipt_quantified_claim_unsupported",
    );
    const noEvidence = syntheticCaioQuestionValueReceiptInput();
    noEvidence.observedDelta.evidenceRefs = [];
    expect(() => createCaioQuestionValueReceipt(noEvidence)).toThrow(
      "value_receipt_quantified_claim_unsupported",
    );
  });

  it("refuses an empty unproven-parts list (honesty requirement)", () => {
    const input = syntheticCaioQuestionValueReceiptInput();
    input.unprovenParts = [];
    expect(() => createCaioQuestionValueReceipt(input)).toThrow(
      "value_receipt_unproven_parts_required",
    );
  });

  it("refuses a sub-30-day result window without a shortfall reason", () => {
    const input = syntheticCaioQuestionValueReceiptInput();
    input.resultWindow = {
      start: "2026-05-01T00:00:00.000Z",
      end: "2026-05-10T00:00:00.000Z",
    };
    expect(() => createCaioQuestionValueReceipt(input)).toThrow(
      "value_receipt_result_window_below_minimum",
    );
  });

  it("records a shortfall receipt but never window-satisfies it", () => {
    const input = syntheticCaioQuestionValueReceiptInput();
    input.resultWindow = {
      start: "2026-05-01T00:00:00.000Z",
      end: "2026-05-10T00:00:00.000Z",
    };
    input.resultWindowShortfallReason =
      "Synthetic pilot terminated early by the owner";
    const receipt = createCaioQuestionValueReceipt(input);
    expect(validateCaioQuestionValueReceipt(receipt).valid).toBe(true);
    expect(caioQuestionValueReceiptWindowSatisfied(receipt)).toBe(false);
  });

  it("never window-satisfies a >=30d receipt that still carries a shortfall reason", () => {
    const input = syntheticCaioQuestionValueReceiptInput();
    input.resultWindowShortfallReason = "Synthetic residual caveat";
    const receipt = createCaioQuestionValueReceipt(input);
    expect(caioQuestionValueReceiptWindowSatisfied(receipt)).toBe(false);
  });

  it("refuses tampered content hashes", () => {
    const receipt = createCaioQuestionValueReceipt(
      syntheticCaioQuestionValueReceiptInput(),
    );
    const tampered = {
      ...receipt,
      nextStepRecommendation: "tampered recommendation",
    };
    expect(
      validateCaioQuestionValueReceipt(tampered).errors,
    ).toContain("value_receipt_content_hash_mismatch");
  });
});

describe("CaioProV1RetrospectiveReceipt", () => {
  it("creates a valid recommendations-only receipt", () => {
    const input = syntheticCaioProV1CompletionInput();
    const retrospective = input.retrospective;
    if (!retrospective) throw new Error("fixture retrospective required");
    expect(validateCaioProV1RetrospectiveReceipt(retrospective)).toEqual({
      valid: true,
      errors: [],
    });
    expect(retrospective.maturityPromotionEffect).toBe("none");
    expect(retrospective.authorityEffect).toBe("none");
  });

  it("refuses a tampered maturity promotion effect (never auto-promotes)", () => {
    const input = syntheticCaioProV1CompletionInput();
    const retrospective = input.retrospective;
    if (!retrospective) throw new Error("fixture retrospective required");
    const tampered = {
      ...retrospective,
      maturityPromotionEffect: "promote" as unknown as "none",
    };
    expect(
      validateCaioProV1RetrospectiveReceipt(tampered).errors,
    ).toContain("retrospective_promotion_boundary_invalid");
  });

  it("requires at least one maturity evaluation with evidence", () => {
    expect(() =>
      createCaioProV1RetrospectiveReceipt({
        workspaceRef: "workspace:synthetic-caio-completion",
        selectionReceiptRef: "caio-question-selection:synthetic-1",
        reusablePackAssetRefs: [],
        customerOverlayRefs: [],
        maturityEvaluations: [],
        overallRecommendation: "continue",
        recordedAt: "2026-06-06T18:00:00.000Z",
      }),
    ).toThrow("retrospective_maturity_evaluation_required");
  });
});

describe("CaioProV1EvidenceAttestation", () => {
  it("refuses attestations for derivable items", () => {
    expect(() =>
      createCaioProV1EvidenceAttestation({
        workspaceRef: "workspace:synthetic-caio-completion",
        itemKey: "p5_g0_accepted" as never,
        version: 1,
        statement: "Synthetic invalid attestation",
        evidenceRefs: ["evidence:invalid"],
        ceoPrincipalBindingRef: "binding-1",
        ceoPrincipalRef: "ceo-1",
        actorUserRef: "user-1",
        recordedByPrincipalKind: "ceo",
        recordedByPrincipalRef: "ceo-1",
        recordedByBindingRef: "binding-1",
        recordedAt: "2026-06-06T12:00:00.000Z",
      }),
    ).toThrow("attestation_item_key_not_attestable");
  });

  it("creates and validates attestations for every attestable item", () => {
    for (const itemKey of CAIO_PRO_V1_ATTESTABLE_ITEMS) {
      const attestation = createCaioProV1EvidenceAttestation({
        workspaceRef: "workspace:synthetic-caio-completion",
        itemKey,
        version: 2,
        statement: `Synthetic statement for ${itemKey}`,
        evidenceRefs: [`evidence:${itemKey}`],
        ceoPrincipalBindingRef: "binding-1",
        ceoPrincipalRef: "ceo-1",
        actorUserRef: "user-1",
        recordedByPrincipalKind: "ceo",
        recordedByPrincipalRef: "ceo-1",
        recordedByBindingRef: "binding-1",
        recordedAt: "2026-06-06T12:00:00.000Z",
      });
      expect(validateCaioProV1EvidenceAttestation(attestation).valid).toBe(
        true,
      );
    }
  });

  it("accepts a bound FDE recorder as a distinct seat and refuses forgeries", () => {
    const base = {
      workspaceRef: "workspace:synthetic-caio-completion",
      itemKey: CAIO_PRO_V1_ATTESTABLE_ITEMS[0],
      version: 3,
      statement: "Recorded by the field deployment engineer",
      evidenceRefs: ["evidence:fde-recorded"],
      ceoPrincipalBindingRef: "binding-1",
      ceoPrincipalRef: "ceo-1",
      actorUserRef: "fde-user-1",
      recordedAt: "2026-06-06T12:00:00.000Z",
    } as const;
    const fdeAttestation = createCaioProV1EvidenceAttestation({
      ...base,
      recordedByPrincipalKind: "fde",
      recordedByPrincipalRef: "fde-1",
      recordedByBindingRef: "binding-fde-1",
    });
    expect(validateCaioProV1EvidenceAttestation(fdeAttestation).valid).toBe(
      true,
    );
    // an FDE recorder can never claim the CEO seat ref
    expect(() =>
      createCaioProV1EvidenceAttestation({
        ...base,
        recordedByPrincipalKind: "fde",
        recordedByPrincipalRef: "ceo-1",
        recordedByBindingRef: "binding-fde-1",
      }),
    ).toThrow("attestation_fde_recorder_invalid");
    // a CEO recorder must reference their own seat exactly
    expect(() =>
      createCaioProV1EvidenceAttestation({
        ...base,
        recordedByPrincipalKind: "ceo",
        recordedByPrincipalRef: "someone-else",
        recordedByBindingRef: "binding-1",
      }),
    ).toThrow("attestation_recorder_seat_mismatch");
  });
});

describe("computeCaioProV1CompletionAssessment", () => {
  it("is deterministic and ready when every item is satisfied", () => {
    const first = computeCaioProV1CompletionAssessment(
      syntheticCaioProV1CompletionInput(),
    );
    const second = computeCaioProV1CompletionAssessment(
      syntheticCaioProV1CompletionInput(),
    );
    expect(first.contentHash).toBe(second.contentHash);
    expect(first.decision).toBe("ready_for_owner_acceptance");
    expect(first.missingItemKeys).toEqual([]);
    expect(first.items.map((item) => item.itemKey)).toEqual([
      ...CAIO_PRO_V1_COMPLETION_ITEMS,
    ]);
    expect(first.fullFunctionOperation).toBe(
      CAIO_PRO_V1_FULL_FUNCTION_OPERATION_BOUNDARY,
    );
    expect(validateCaioProV1CompletionAssessment(first)).toEqual({
      valid: true,
      errors: [],
    });
  });

  it.each([...CAIO_PRO_V1_ATTESTABLE_ITEMS])(
    "goes not_ready when the %s attestation is missing",
    (itemKey) => {
      const input = syntheticCaioProV1CompletionInput();
      input.attestations = input.attestations.filter(
        (attestation) => attestation.itemKey !== itemKey,
      );
      const assessment = computeCaioProV1CompletionAssessment(input);
      expect(assessment.decision).toBe("not_ready");
      expect(assessment.missingItemKeys).toEqual([itemKey]);
    },
  );

  it("goes not_ready when asset states are incomplete", () => {
    const input = syntheticCaioProV1CompletionInput();
    input.catalog.completeStateCount = input.catalog.assetCount - 1;
    const assessment = computeCaioProV1CompletionAssessment(input);
    expect(assessment.missingItemKeys).toContain("p4_asset_states_complete");
    expect(assessment.decision).toBe("not_ready");
  });

  it("goes not_ready when the accepted G0 gate is not current", () => {
    const input = syntheticCaioProV1CompletionInput();
    input.g0.gateCurrentlyAccepted = false;
    const assessment = computeCaioProV1CompletionAssessment(input);
    expect(assessment.missingItemKeys).toContain("p5_g0_accepted");
    // The portfolio and selection items depend on the accepted G0 binding.
    expect(assessment.missingItemKeys).toContain("p6_portfolio_generated");
  });

  it("goes not_ready when a selected question lacks an implementation plan", () => {
    const input = syntheticCaioProV1CompletionInput();
    input.implementationPlans = input.implementationPlans.slice(0, 1);
    const assessment = computeCaioProV1CompletionAssessment(input);
    expect(assessment.missingItemKeys).toEqual([
      "p6_implementation_plans_materialized",
    ]);
    const item = assessment.items.find(
      (candidate) =>
        candidate.itemKey === "p6_implementation_plans_materialized",
    );
    expect(item?.reasonCodes).toContain(
      "implementation_plan_missing:question-2",
    );
  });

  it("goes not_ready when no selected question closes the supervision chain", () => {
    const input = syntheticCaioProV1CompletionInput();
    input.supervisionChains = [];
    const assessment = computeCaioProV1CompletionAssessment(input);
    expect(assessment.missingItemKeys).toEqual([
      "p7_supervision_chain_closed",
    ]);
  });

  it("goes not_ready when a value receipt is missing or shortfallen", () => {
    const missing = syntheticCaioProV1CompletionInput();
    missing.valueReceipts = missing.valueReceipts.slice(0, 1);
    expect(
      computeCaioProV1CompletionAssessment(missing).missingItemKeys,
    ).toEqual(["p7_value_receipts_recorded"]);

    const shortfall = syntheticCaioProV1CompletionInput();
    const receiptInput = syntheticCaioQuestionValueReceiptInput("question-2");
    receiptInput.resultWindow = {
      start: "2026-05-01T00:00:00.000Z",
      end: "2026-05-10T00:00:00.000Z",
    };
    receiptInput.resultWindowShortfallReason =
      "Synthetic early termination — no shortcut through the 30-day gate";
    shortfall.valueReceipts = [
      shortfall.valueReceipts[0],
      createCaioQuestionValueReceipt(receiptInput),
    ];
    expect(
      computeCaioProV1CompletionAssessment(shortfall).missingItemKeys,
    ).toEqual(["p7_value_receipts_recorded"]);
  });

  it("treats a zero-question selection as vacuous for P7 but still requires the retrospective", () => {
    const input = syntheticCaioProV1CompletionInput();
    input.selection.selectedQuestionIds = [];
    input.implementationPlans = [];
    input.supervisionChains = [];
    input.valueReceipts = [];
    const withRetrospective =
      computeCaioProV1CompletionAssessment(input);
    expect(withRetrospective.decision).toBe("ready_for_owner_acceptance");
    const p7 = withRetrospective.items.find(
      (item) => item.itemKey === "p7_value_receipts_recorded",
    );
    expect(p7?.reasonCodes).toContain("vacuously_satisfied_zero_selection");

    const withoutRetrospective = syntheticCaioProV1CompletionInput();
    withoutRetrospective.selection.selectedQuestionIds = [];
    withoutRetrospective.implementationPlans = [];
    withoutRetrospective.supervisionChains = [];
    withoutRetrospective.valueReceipts = [];
    withoutRetrospective.retrospective = null;
    expect(
      computeCaioProV1CompletionAssessment(withoutRetrospective)
        .missingItemKeys,
    ).toEqual(["p8_retrospective_recorded"]);
  });

  it("goes not_ready when the retrospective binds a different selection", () => {
    const input = syntheticCaioProV1CompletionInput();
    if (!input.retrospective) throw new Error("fixture required");
    input.retrospective = createCaioProV1RetrospectiveReceipt({
      workspaceRef: input.retrospective.workspaceRef,
      selectionReceiptRef: "caio-question-selection:another",
      reusablePackAssetRefs: input.retrospective.reusablePackAssetRefs,
      customerOverlayRefs: input.retrospective.customerOverlayRefs,
      maturityEvaluations: input.retrospective.maturityEvaluations,
      overallRecommendation: input.retrospective.overallRecommendation,
      recordedAt: input.retrospective.recordedAt,
    });
    expect(
      computeCaioProV1CompletionAssessment(input).missingItemKeys,
    ).toEqual(["p8_retrospective_recorded"]);
  });
});

describe("CaioProV1CompletionGateReceipt", () => {
  it("accepts only a ready assessment and freezes the full-function literal", () => {
    const receipt = createCaioProV1CompletionAcceptanceReceipt(
      acceptanceInput(),
    );
    expect(receipt.resultingStatus).toBe("accepted");
    expect(receipt.authorityEffect).toBe("none");
    expect(receipt.fullFunctionOperation).toBe(
      "not_authorized_by_this_receipt",
    );
    expect(validateCaioProV1CompletionGateReceipt(receipt)).toEqual({
      valid: true,
      errors: [],
    });
  });

  it("refuses acceptance against a not_ready assessment", () => {
    const input = syntheticCaioProV1CompletionInput();
    input.attestations = input.attestations.slice(1);
    const notReady = computeCaioProV1CompletionAssessment(input);
    expect(notReady.decision).toBe("not_ready");
    expect(() =>
      createCaioProV1CompletionAcceptanceReceipt(acceptanceInput(notReady)),
    ).toThrow("caio_pro_v1_completion_assessment_not_ready");
  });

  it("refuses a tampered-ready assessment through validation", () => {
    const input = syntheticCaioProV1CompletionInput();
    input.attestations = input.attestations.slice(1);
    const notReady = computeCaioProV1CompletionAssessment(input);
    const tampered = {
      ...notReady,
      decision: "ready_for_owner_acceptance" as const,
    };
    expect(() =>
      createCaioProV1CompletionAcceptanceReceipt(acceptanceInput(tampered)),
    ).toThrow("caio_pro_v1_completion_assessment_invalid");
  });

  it("refuses a tampered fullFunctionOperation literal", () => {
    const receipt = createCaioProV1CompletionAcceptanceReceipt(
      acceptanceInput(),
    );
    const tampered = {
      ...receipt,
      fullFunctionOperation:
        "activated" as unknown as CaioProV1CompletionGateReceipt["fullFunctionOperation"],
    };
    expect(
      validateCaioProV1CompletionGateReceipt(tampered).errors,
    ).toContain("completion_gate_receipt_governance_boundary_invalid");
  });

  it("chains revocation after acceptance and treats revoked as terminal per version", () => {
    const assessment = computeCaioProV1CompletionAssessment(
      syntheticCaioProV1CompletionInput(),
    );
    const accepted = createCaioProV1CompletionAcceptanceReceipt(
      acceptanceInput(assessment),
    );
    const revoked = createCaioProV1CompletionRevocationReceipt({
      ...acceptanceInput(assessment, {
        receiptId: accepted.receiptId,
        contentHash: accepted.contentHash,
        sequence: accepted.sequence,
        resultingStatus: accepted.resultingStatus,
        assessmentRef: accepted.assessmentRef,
        recordedAt: accepted.recordedAt,
      }),
      idempotencyKey: "completion-revoke-1",
      recordedAt: "2026-06-07T02:00:00.000Z",
    });
    expect(revoked.resultingStatus).toBe("revoked");
    expect(revoked.sequence).toBe(2);
    expect(revoked.previousReceiptHash).toBe(accepted.contentHash);

    // Re-acceptance with the SAME assessment version must be refused.
    expect(() =>
      createCaioProV1CompletionAcceptanceReceipt({
        ...acceptanceInput(assessment, {
          receiptId: revoked.receiptId,
          contentHash: revoked.contentHash,
          sequence: revoked.sequence,
          resultingStatus: revoked.resultingStatus,
          assessmentRef: revoked.assessmentRef,
          recordedAt: revoked.recordedAt,
        }),
        idempotencyKey: "completion-accept-2",
        recordedAt: "2026-06-07T03:00:00.000Z",
      }),
    ).toThrow("caio_pro_v1_completion_revoked_requires_newer_reassessment");
  });

  it("refuses double acceptance", () => {
    const assessment = computeCaioProV1CompletionAssessment(
      syntheticCaioProV1CompletionInput(),
    );
    const accepted = createCaioProV1CompletionAcceptanceReceipt(
      acceptanceInput(assessment),
    );
    expect(() =>
      createCaioProV1CompletionAcceptanceReceipt(
        acceptanceInput(assessment, {
          receiptId: accepted.receiptId,
          contentHash: accepted.contentHash,
          sequence: accepted.sequence,
          resultingStatus: accepted.resultingStatus,
          assessmentRef: accepted.assessmentRef,
          recordedAt: accepted.recordedAt,
        }),
      ),
    ).toThrow("caio_pro_v1_completion_gate_already_accepted");
  });

  it("refuses revocation when the gate is not accepted", () => {
    expect(() =>
      createCaioProV1CompletionRevocationReceipt(acceptanceInput()),
    ).toThrow("caio_pro_v1_completion_gate_not_accepted");
  });
});
