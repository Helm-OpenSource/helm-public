import { describe, expect, it } from "vitest";

import {
  HARNESS_P3_READINESS_EVIDENCE_SCHEMA_VERSION,
  computeHarnessP3ReadinessEvidenceContentHash,
  computeHarnessP3ReadinessReportContentHash,
  evaluateHarnessP3Readiness,
  type HarnessP3ReadinessEvidence,
} from "./p3-readiness";
import { syntheticCurrentP3ReadinessEvidence } from "./p3-readiness-fixtures";
import {
  validateHarnessP3ReadinessEvidence,
  validateHarnessP3ReadinessReport,
  validateHarnessP3ReadinessReportBinding,
} from "./p3-readiness-validators";

function restamp(
  evidence: Omit<HarnessP3ReadinessEvidence, "contentHash">,
): HarnessP3ReadinessEvidence {
  return {
    ...evidence,
    contentHash: computeHarnessP3ReadinessEvidenceContentHash(evidence),
  };
}

function matureEvidence(): HarnessP3ReadinessEvidence {
  const runs = Array.from({ length: 5 }, (_, index) => ({
    runId: `p3-run-${index + 1}`,
    candidateRevisionId: `oh-expert-v${2 + (index % 3)}`,
    heldoutSetRef: `heldout:p3-${index + 1}`,
    heldoutSetHash: `sha256:${String(index + 1).padStart(64, "0")}`,
    completedAt: `2026-07-${String(index + 1).padStart(2, "0")}T08:00:00.000Z`,
    sourceClasses:
      index < 2
        ? (["synthetic_public"] as const)
        : (["self_dogfood_health"] as const),
    businessObjectKinds: [
      `object:${["deal", "delivery", "review"][index % 3]}`,
    ],
    evidenceMode:
      index < 2
        ? ("synthetic_fixture" as const)
        : ("deidentified_operational_receipt" as const),
    heldoutLift: 0.08 + index * 0.01,
    expectedCalibrationError: 0.08,
    calibrationSampleCount: 25,
    evidenceCoverage: 0.95,
    reviewerCompleteness: 1,
    boundaryIncidentCount: 0,
    decision: "owner_review_candidate" as const,
    freshHeldoutConfirmed: true,
    weaknessEvidenceReproduced: true,
    ownerReviewReceiptRef: `owner-review:p3-${index + 1}`,
  }));
  const content = {
    schemaVersion: HARNESS_P3_READINESS_EVIDENCE_SCHEMA_VERSION,
    evidenceId: "p3-readiness:mature-shape",
    attestationMode: "owner_attested_operational" as const,
    operationalAttestation: {
      ownerReviewReceiptRef: "owner-attestation:p3-readiness-001",
      registrySnapshotHash: `sha256:${"8".repeat(64)}`,
      signedAt: "2026-07-12T07:30:00.000Z",
    },
    asOf: "2026-07-12T08:00:00.000Z",
    prerequisites: (["P0", "P1", "P2"] as const).map((phase, index) => ({
      phase,
      mergedToMain: true,
      gateRef: `gate:${phase.toLowerCase()}:merged`,
      gateHash: `sha256:${String(index + 11).padStart(64, "0")}`,
    })),
    evaluationWindow: {
      windowStart: "2026-07-01T00:00:00.000Z",
      windowEnd: "2026-07-12T08:00:00.000Z",
      complete: true,
      windowReceiptRef: "window:p3-readiness-001",
      totalCandidateRunCount: runs.length,
      runs,
    },
    feedbackSummary: {
      eligibleEditRejectCount: 40,
      promotedEvalCaseCount: 15,
      receiptRefs: ["feedback-window:p3-001", "feedback-window:p3-002"],
    },
    deidentifiedPromotions: Array.from({ length: 3 }, (_, index) => ({
      promotionId: `promotion:p3-${index + 1}`,
      sourceClass: "self_dogfood_health" as const,
      publicEligible: true,
      personAttributionRemoved: true,
      scannerResultHits: 0,
      humanSignoffRef: `human-signoff:p3-${index + 1}`,
      walledFromPerformanceEval: true,
      receiptHash: `sha256:${String(index + 21).padStart(64, "0")}`,
    })),
    rollbackDrills: Array.from({ length: 2 }, (_, index) => ({
      drillId: `rollback-drill:p3-${index + 1}`,
      candidateRevisionId: `oh-expert-v${index + 2}`,
      fallbackRevisionId: "oh-expert-v0",
      expectedManifestHash: `sha256:${String(index + 31).padStart(64, "0")}`,
      restoredManifestHash: `sha256:${String(index + 31).padStart(64, "0")}`,
      killSwitchActivated: true,
      ownerReviewed: true,
      ownerReviewReceiptRef: `owner-review:rollback-${index + 1}`,
      completedAt: `2026-07-${String(index + 8).padStart(2, "0")}T08:00:00.000Z`,
    })),
    protectedComponentMutationCount: 0,
    productionAuthorityGrantCount: 0,
  };
  return restamp(content);
}

function mutateEvidence(
  evidence: HarnessP3ReadinessEvidence,
  mutate: (draft: Omit<HarnessP3ReadinessEvidence, "contentHash">) => void,
): HarnessP3ReadinessEvidence {
  const { contentHash: _hash, ...content } = structuredClone(evidence);
  mutate(content);
  return restamp(content);
}

describe("operating harness P3 data readiness", () => {
  it("keeps the current public synthetic evidence explicitly not ready", () => {
    const evidence = syntheticCurrentP3ReadinessEvidence();
    const report = evaluateHarnessP3Readiness(evidence);

    expect(validateHarnessP3ReadinessEvidence(evidence).ok).toBe(true);
    expect(report.decision).toBe("not_ready");
    expect(report.failures).toEqual(
      expect.arrayContaining([
        "operational_attestation_missing",
        "prerequisites_not_merged",
        "insufficient_independent_heldout_sets",
        "insufficient_feedback_volume",
        "insufficient_deidentified_promotions",
        "insufficient_rollback_drills",
      ]),
    );
    expect(report.ownerApprovalRecorded).toBe(false);
    expect(report.implementationTriggered).toBe(false);
    expect(report.productionAuthorityGranted).toBe(false);
    expect(validateHarnessP3ReadinessReport(report).ok).toBe(true);
  });

  it("returns only ready-for-design-review when every data gate is satisfied", () => {
    const report = evaluateHarnessP3Readiness(matureEvidence());

    expect(report.decision).toBe("ready_for_p3_design_review");
    expect(report.failures).toEqual([]);
    expect(report.metrics.distinctHeldoutSetCount).toBe(5);
    expect(report.metrics.distinctCandidateRevisionCount).toBe(3);
    expect(report.metrics.operationalDeidentifiedRunCount).toBe(3);
    expect(report.metrics.feedbackToEvalConversionRate).toBeCloseTo(0.375);
    expect(report.ownerReviewRequired).toBe(true);
    expect(report.ownerApprovalRecorded).toBe(false);
    expect(report.implementationTriggered).toBe(false);
    expect(report.productionAuthorityGranted).toBe(false);
    expect(validateHarnessP3ReadinessReport(report)).toEqual({ ok: true, errors: [] });
  });

  it("is data-gated rather than calendar-gated", () => {
    const current = syntheticCurrentP3ReadinessEvidence();
    const future = mutateEvidence(current, (draft) => {
      draft.asOf = "2030-01-01T00:00:00.000Z";
      draft.evaluationWindow.windowEnd = draft.asOf;
    });

    expect(evaluateHarnessP3Readiness(future).decision).toBe("not_ready");
  });

  it("rejects fleet or OSS evidence from the improvement corpus", () => {
    const evidence = mutateEvidence(matureEvidence(), (draft) => {
      draft.evaluationWindow.runs[0].sourceClasses = ["fleet_customer_health"];
    });

    expect(evaluateHarnessP3Readiness(evidence).failures).toContain(
      "customer_or_oss_source_in_improvement",
    );
  });

  it("keeps boundary incidents and protected mutations as hard vetoes", () => {
    const evidence = mutateEvidence(matureEvidence(), (draft) => {
      draft.evaluationWindow.runs[2].boundaryIncidentCount = 1;
      draft.protectedComponentMutationCount = 1;
    });
    const report = evaluateHarnessP3Readiness(evidence);

    expect(report.failures).toEqual(
      expect.arrayContaining([
        "boundary_incident_present",
        "protected_component_mutation_present",
      ]),
    );
    expect(report.decision).toBe("not_ready");
  });

  it("requires stable recent lift, calibration, evidence, and complete review", () => {
    const evidence = mutateEvidence(matureEvidence(), (draft) => {
      const qualityFailure = draft.evaluationWindow.runs.at(-2)!;
      qualityFailure.expectedCalibrationError = 0.2;
      qualityFailure.evidenceCoverage = 0.7;
      qualityFailure.reviewerCompleteness = 0.9;
      const recentNonPass = draft.evaluationWindow.runs.at(-1)!;
      recentNonPass.heldoutLift = 0.01;
      recentNonPass.decision = "inconclusive";
    });
    const report = evaluateHarnessP3Readiness(evidence);

    expect(report.failures).toEqual(
      expect.arrayContaining([
        "heldout_lift_not_stable",
        "calibration_error_above_limit",
        "evidence_coverage_below_floor",
        "reviewer_completeness_below_one",
        "recent_candidate_not_pass",
      ]),
    );
  });

  it("does not let rejected runs pad calibration samples or dilute ECE", () => {
    const evidence = mutateEvidence(matureEvidence(), (draft) => {
      for (const run of draft.evaluationWindow.runs) {
        run.calibrationSampleCount = 0;
        run.expectedCalibrationError = 0.15;
      }
      draft.evaluationWindow.runs.unshift({
        ...structuredClone(draft.evaluationWindow.runs[0]),
        runId: "p3-run-calibration-padding",
        candidateRevisionId: "oh-expert-padding",
        heldoutSetRef: "heldout:p3-padding",
        heldoutSetHash: `sha256:${"7".repeat(64)}`,
        completedAt: "2026-07-01T01:00:00.000Z",
        decision: "rejected",
        ownerReviewReceiptRef: null,
        calibrationSampleCount: 1000,
        expectedCalibrationError: 0,
      });
      draft.evaluationWindow.totalCandidateRunCount =
        draft.evaluationWindow.runs.length;
    });
    const report = evaluateHarnessP3Readiness(evidence);

    expect(report.decision).toBe("not_ready");
    expect(report.metrics.calibrationSampleCount).toBe(0);
    expect(report.failures).toEqual(
      expect.arrayContaining([
        "calibration_sample_insufficient",
        "calibration_error_above_limit",
      ]),
    );
  });

  it("requires feedback volume and feedback-to-eval conversion", () => {
    const evidence = mutateEvidence(matureEvidence(), (draft) => {
      draft.feedbackSummary.eligibleEditRejectCount = 40;
      draft.feedbackSummary.promotedEvalCaseCount = 2;
    });
    const report = evaluateHarnessP3Readiness(evidence);

    expect(report.failures).toEqual(
      expect.arrayContaining([
        "insufficient_promoted_eval_cases",
        "feedback_to_eval_conversion_below_floor",
      ]),
    );
  });

  it("requires human-reviewed de-identification and successful rollback drills", () => {
    const evidence = mutateEvidence(matureEvidence(), (draft) => {
      draft.deidentifiedPromotions[0].personAttributionRemoved = false;
      draft.rollbackDrills[0].restoredManifestHash =
        `sha256:${"9".repeat(64)}`;
      draft.rollbackDrills[1].ownerReviewed = false;
    });
    const report = evaluateHarnessP3Readiness(evidence);

    expect(report.failures).toEqual(
      expect.arrayContaining([
        "deidentified_promotion_gate_failed",
        "rollback_drill_failed",
        "insufficient_rollback_drills",
      ]),
    );
  });

  it("rejects reused promotion and cross-category owner-review receipts", () => {
    const evidence = mutateEvidence(matureEvidence(), (draft) => {
      draft.deidentifiedPromotions[1].receiptHash =
        draft.deidentifiedPromotions[0].receiptHash;
      draft.deidentifiedPromotions[1].humanSignoffRef =
        draft.deidentifiedPromotions[0].humanSignoffRef;
      draft.rollbackDrills[0].ownerReviewReceiptRef =
        draft.evaluationWindow.runs[0].ownerReviewReceiptRef!;
    });
    const validation = validateHarnessP3ReadinessEvidence(evidence);

    expect(validation.errors).toEqual(
      expect.arrayContaining([
        `duplicate_p3_promotion_receipt:${evidence.deidentifiedPromotions[0].receiptHash}`,
        `duplicate_p3_promotion_signoff:${evidence.deidentifiedPromotions[0].humanSignoffRef}`,
        `cross_category_owner_review_receipt_reused:${evidence.evaluationWindow.runs[0].ownerReviewReceiptRef}`,
      ]),
    );
    expect(evaluateHarnessP3Readiness(evidence).failures).toContain("input_invalid");
  });

  it("requires a complete evidence window and derived counts", () => {
    const evidence = mutateEvidence(matureEvidence(), (draft) => {
      draft.evaluationWindow.complete = false;
      draft.evaluationWindow.totalCandidateRunCount += 2;
    });
    const report = evaluateHarnessP3Readiness(evidence);

    expect(report.failures).toContain("evidence_window_incomplete");
    expect(report.metrics.evaluatedRunCount).toBe(5);
  });

  it("fails closed on malformed or private evidence", () => {
    const malformed = {
      ...matureEvidence(),
      customerName: "Private Customer",
    };
    const report = evaluateHarnessP3Readiness(malformed);

    expect(report.decision).toBe("not_ready");
    expect(report.failures).toContain("input_invalid");
    expect(report.validationErrors).toEqual(
      expect.arrayContaining([
        "forbidden_key_present:customerName",
        "invalid_p3_readiness_evidence:root:unrecognized_keys",
      ]),
    );
    expect(validateHarnessP3ReadinessReport(report).ok).toBe(true);
  });

  it("detects a restamped report that claims implementation or production authority", () => {
    const report = evaluateHarnessP3Readiness(matureEvidence());
    const { contentHash: _hash, ...content } = report;
    const tamperedContent = {
      ...content,
      ownerApprovalRecorded: true,
      implementationTriggered: true,
      productionAuthorityGranted: true,
    };
    const tampered = {
      ...tamperedContent,
      contentHash: computeHarnessP3ReadinessReportContentHash(tamperedContent as never),
    };

    expect(validateHarnessP3ReadinessReport(tampered).ok).toBe(false);
  });

  it("recomputes a readiness report from its bound evidence", () => {
    const evidence = matureEvidence();
    const report = evaluateHarnessP3Readiness(evidence);
    const changedEvidence = mutateEvidence(evidence, (draft) => {
      draft.evaluationWindow.runs.at(-1)!.heldoutLift = 0.01;
    });

    expect(
      validateHarnessP3ReadinessReportBinding({ report, evidence }),
    ).toEqual({ ok: true, errors: [] });
    expect(
      validateHarnessP3ReadinessReportBinding({ report, evidence: changedEvidence }).errors,
    ).toContain("p3_readiness_report_not_reproducible_from_evidence");
  });
});
