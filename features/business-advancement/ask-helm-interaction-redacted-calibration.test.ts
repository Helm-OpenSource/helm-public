import { describe, expect, it } from "vitest";

import {
  ASK_HELM_INTERACTION_REDACTED_CALIBRATION_MIN_ROWS,
  ASK_HELM_INTERACTION_REDACTED_CALIBRATION_NEXT_ALLOWED_WORK,
  ASK_HELM_INTERACTION_REDACTED_CALIBRATION_POSTURE,
  ASK_HELM_INTERACTION_REDACTED_CALIBRATION_RULE_VERSION,
  ASK_HELM_INTERACTION_REDACTED_CALIBRATION_RUNTIME_ADOPTION,
  DEFAULT_ASK_HELM_INTERACTION_REDACTED_CALIBRATION_EVALUATION,
  DEFAULT_ASK_HELM_INTERACTION_REDACTED_CALIBRATION_INPUT,
  LOCAL_ASK_HELM_INTERACTION_REDACTED_CALIBRATION_INPUT,
  POSITIVE_ASK_HELM_INTERACTION_REDACTED_CALIBRATION_INPUT,
  evaluateAskHelmInteractionRedactedCalibration,
  type AskHelmInteractionRedactedCalibrationInput,
  type AskHelmInteractionRedactedCalibrationRow,
} from "./ask-helm-interaction-redacted-calibration";

function liveSnapshot(
  patch: Partial<AskHelmInteractionRedactedCalibrationInput> = {},
): AskHelmInteractionRedactedCalibrationInput {
  return {
    ...POSITIVE_ASK_HELM_INTERACTION_REDACTED_CALIBRATION_INPUT,
    ...patch,
    rows:
      patch.rows ??
      POSITIVE_ASK_HELM_INTERACTION_REDACTED_CALIBRATION_INPUT.rows,
  };
}

describe("Ask Helm interaction redacted calibration constants", () => {
  it("keeps the contract evidence-only and runtime No-Go", () => {
    expect(ASK_HELM_INTERACTION_REDACTED_CALIBRATION_RULE_VERSION).toBe(
      "ask-helm-interaction-redacted-calibration/v1",
    );
    expect(ASK_HELM_INTERACTION_REDACTED_CALIBRATION_POSTURE).toBe(
      "Evidence-Contract-Ready",
    );
    expect(ASK_HELM_INTERACTION_REDACTED_CALIBRATION_RUNTIME_ADOPTION).toBe(
      "No-Go",
    );
  });

  it("requires explicit row volume", () => {
    expect(ASK_HELM_INTERACTION_REDACTED_CALIBRATION_MIN_ROWS).toBe(12);
  });

  it("allows manual review next, not production adoption", () => {
    const lower =
      ASK_HELM_INTERACTION_REDACTED_CALIBRATION_NEXT_ALLOWED_WORK.toLowerCase();
    expect(lower).toContain("manual runtime adoption review");
    expect(lower).toContain("not production adoption");
  });
});

describe("Ask Helm interaction redacted calibration default posture", () => {
  it("does not validate synthetic fixtures as real data", () => {
    expect(DEFAULT_ASK_HELM_INTERACTION_REDACTED_CALIBRATION_EVALUATION.sampleKind).toBe(
      "synthetic_fixture",
    );
    expect(DEFAULT_ASK_HELM_INTERACTION_REDACTED_CALIBRATION_EVALUATION.realDataValidated).toBe(
      false,
    );
    expect(
      DEFAULT_ASK_HELM_INTERACTION_REDACTED_CALIBRATION_EVALUATION
        .productionCalibrationComplete,
    ).toBe(false);
    expect(DEFAULT_ASK_HELM_INTERACTION_REDACTED_CALIBRATION_EVALUATION.blockers).toContain(
      "sample_kind_is_redacted_real_interaction_snapshot",
    );
  });

  it("does not validate local development snapshots as real data", () => {
    const result = evaluateAskHelmInteractionRedactedCalibration(
      LOCAL_ASK_HELM_INTERACTION_REDACTED_CALIBRATION_INPUT,
    );

    expect(result.sampleKind).toBe("local_development_snapshot");
    expect(result.realDataValidated).toBe(false);
    expect(result.productionCalibrationComplete).toBe(false);
    expect(result.blockers).toContain(
      "sample_kind_is_redacted_real_interaction_snapshot",
    );
  });
});

describe("Ask Helm interaction redacted calibration positive redacted snapshot", () => {
  const result = evaluateAskHelmInteractionRedactedCalibration(liveSnapshot());

  it("validates a redacted real interaction snapshot without changing runtime posture", () => {
    expect(result.sampleKind).toBe("redacted_real_interaction_snapshot");
    expect(result.realDataValidated).toBe(true);
    expect(result.productionCalibrationComplete).toBe(true);
    expect(result.runtimeAdoption).toBe("No-Go");
    expect(result.blockers).toHaveLength(0);
  });

  it("covers candidate, watch-only, and rejected outcomes", () => {
    expect(result.eligibleCandidateCount).toBeGreaterThanOrEqual(7);
    expect(result.watchOnlyCount).toBeGreaterThanOrEqual(3);
    expect(result.rejectedCount).toBeGreaterThanOrEqual(3);
    expect(result.boundaryRejectionCount).toBeGreaterThanOrEqual(2);
  });

  it("folds duplicate interaction assets through the existing dedupe seam", () => {
    const candidateCount = result.outcomes.filter((outcome) => outcome.candidate).length;
    expect(result.dedupeMergeResult.mergedCandidates.length).toBeLessThan(
      candidateCount,
    );
    expect(
      result.dedupeMergeResult.mergedCandidates.some(
        (candidate) => candidate.occurrenceCount > 1,
      ),
    ).toBe(true);
  });

  it("keeps redaction and authority boundaries visible", () => {
    expect(result.redactionViolationCount).toBe(0);
    expect(result.redactionContract.join("\n").toLowerCase()).toContain(
      "no raw prompt",
    );
    expect(result.checks.find((check) => check.name === "no_execution_or_formal_skill_authority_granted")?.pass).toBe(
      true,
    );
  });
});

describe("Ask Helm interaction redacted calibration blockers", () => {
  it("fails when raw content is retained in the snapshot", () => {
    const result = evaluateAskHelmInteractionRedactedCalibration(
      liveSnapshot({
        rows: POSITIVE_ASK_HELM_INTERACTION_REDACTED_CALIBRATION_INPUT.rows.map(
          (row) =>
            row.rowId === "AHI-RC-001"
              ? { ...row, rawPromptRetained: true }
              : row,
        ),
      }),
    );

    expect(result.realDataValidated).toBe(false);
    expect(result.redactionViolationCount).toBe(1);
    expect(result.blockers).toContain(
      "redaction_contract_no_raw_content_retained",
    );
  });

  it("fails when dynamic raw payload fields are present even if booleans are false", () => {
    const result = evaluateAskHelmInteractionRedactedCalibration(
      liveSnapshot({
        rows: POSITIVE_ASK_HELM_INTERACTION_REDACTED_CALIBRATION_INPUT.rows.map(
          (row) =>
            row.rowId === "AHI-RC-001"
              ? ({
                  ...row,
                  rawPromptRetained: false,
                  rawPrompt: "raw customer prompt must not be accepted",
                } as AskHelmInteractionRedactedCalibrationRow)
              : row,
        ),
      }),
    );

    expect(result.realDataValidated).toBe(false);
    expect(result.redactionViolationCount).toBe(1);
    expect(result.outcomes.find((outcome) => outcome.rowId === "AHI-RC-001")?.rejectionReason).toBe(
      "raw_payload_field_retained",
    );
    expect(result.blockers).toContain(
      "redaction_contract_no_raw_content_retained",
    );
  });

  it("fails on common raw and sensitive JSON key variants", () => {
    const result = evaluateAskHelmInteractionRedactedCalibration(
      liveSnapshot({
        rows: POSITIVE_ASK_HELM_INTERACTION_REDACTED_CALIBRATION_INPUT.rows.map(
          (row) =>
            row.rowId === "AHI-RC-001"
              ? ({
                  ...row,
                  rawPromptRetained: false,
                  raw_payload: {
                    prompt: "raw prompt must not be accepted",
                    body: "raw answer body must not be accepted",
                    transcript: "full transcript must not be accepted",
                    accessToken: "token must not be accepted",
                    secretKey: "secret must not be accepted",
                  },
                } as AskHelmInteractionRedactedCalibrationRow)
              : row,
        ),
      }),
    );

    expect(result.realDataValidated).toBe(false);
    expect(result.redactionViolationCount).toBe(1);
    expect(result.outcomes.find((outcome) => outcome.rowId === "AHI-RC-001")?.rejectionReason).toBe(
      "raw_payload_field_retained",
    );
    expect(result.blockers).toContain(
      "redaction_contract_no_raw_content_retained",
    );
  });

  it("fails when required privacy and boundary rejection paths are missing", () => {
    const result = evaluateAskHelmInteractionRedactedCalibration(
      liveSnapshot({
        rows: POSITIVE_ASK_HELM_INTERACTION_REDACTED_CALIBRATION_INPUT.rows.filter(
          (row) =>
            !["AHI-RC-005", "AHI-RC-012", "AHI-RC-013"].includes(row.rowId),
        ),
      }),
    );

    expect(result.realDataValidated).toBe(false);
    expect(result.blockers).toContain(
      "privacy_and_boundary_rejection_paths_covered",
    );
  });

  it("fails when explicit plan, review packet, and handoff coverage is incomplete", () => {
    const result = evaluateAskHelmInteractionRedactedCalibration(
      liveSnapshot({
        rows: POSITIVE_ASK_HELM_INTERACTION_REDACTED_CALIBRATION_INPUT.rows.filter(
          (row) => row.rowId !== "AHI-RC-011",
        ),
      }),
    );

    expect(result.realDataValidated).toBe(false);
    expect(result.blockers).toContain(
      "explicit_plan_review_packet_handoff_covered",
    );
  });

  it("fails when workspace review visibility is not capability gated", () => {
    const result = evaluateAskHelmInteractionRedactedCalibration(
      liveSnapshot({
        rows: POSITIVE_ASK_HELM_INTERACTION_REDACTED_CALIBRATION_INPUT.rows.map(
          (row) =>
            row.rowId === "AHI-RC-004"
              ? { ...row, workspaceReviewVisibleCapabilityGated: false }
              : row,
        ),
      }),
    );

    expect(result.realDataValidated).toBe(false);
    expect(result.blockers).toContain(
      "workspace_review_visible_is_capability_gated",
    );
  });

  it("fails when row volume falls below the calibration minimum", () => {
    const result = evaluateAskHelmInteractionRedactedCalibration(
      liveSnapshot({
        rows: DEFAULT_ASK_HELM_INTERACTION_REDACTED_CALIBRATION_INPUT.rows.slice(
          0,
          ASK_HELM_INTERACTION_REDACTED_CALIBRATION_MIN_ROWS - 1,
        ),
      }),
    );

    expect(result.realDataValidated).toBe(false);
    expect(result.blockers).toContain("minimum_redacted_row_volume");
  });
});
