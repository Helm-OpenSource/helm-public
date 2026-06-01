import { describe, expect, it } from "vitest";
import { evaluateAskHelmCaptureEligibility } from "./ask-helm-interaction-capture-thresholds";
import {
  ASK_HELM_INTERACTION_OFFLINE_EVAL_FIXTURES,
  ASK_HELM_INTERACTION_OFFLINE_EVAL_POSTURE,
  ASK_HELM_INTERACTION_OFFLINE_EVAL_REQUIRED_CATEGORIES,
  ASK_HELM_INTERACTION_OFFLINE_EVAL_RULE_VERSION,
  ASK_HELM_INTERACTION_OFFLINE_EVAL_RUNTIME_ADOPTION,
  evaluateAskHelmInteractionOfflineEval,
} from "./ask-helm-interaction-offline-eval";

const EXPECTED_CHECK_NAMES = [
  "rule_version_is_v1",
  "runtime_adoption_is_no_go",
  "all_required_fixture_categories_covered",
  "fixture_expected_statuses_match",
  "raw_audio_never_becomes_candidate",
  "unconfirmed_transcript_never_becomes_candidate",
  "cross_workspace_aggregation_rejected",
  "threshold_statuses_match_slice3",
  "dedupe_merge_folds_repeated_candidates",
  "promotion_targets_are_review_first",
  "workspace_review_visible_capability_gated",
  "redacted_exports_omit_raw_content",
  "no_forbidden_authority_wording",
  "deterministic_output_stable_when_input_reversed",
  "eligible_repeated_intent_attaches_to_existing_signal",
  "eligible_boundary_hit_attaches_to_existing_must_push",
  "privacy_violation_count_zero",
  "boundary_violation_count_zero",
] as const;

describe("Ask Helm interaction offline eval constants", () => {
  it("keeps Slice 4 planning-only with runtime adoption no-go", () => {
    expect(ASK_HELM_INTERACTION_OFFLINE_EVAL_RULE_VERSION).toBe(
      "ask-helm-interaction-offline-eval/v1",
    );
    expect(ASK_HELM_INTERACTION_OFFLINE_EVAL_POSTURE).toBe("Planning-Only");
    expect(ASK_HELM_INTERACTION_OFFLINE_EVAL_RUNTIME_ADOPTION).toBe("No-Go");
  });
});

describe("Ask Helm interaction offline eval fixture coverage", () => {
  it("covers all required synthetic fixture categories", () => {
    const categories = new Set(
      ASK_HELM_INTERACTION_OFFLINE_EVAL_FIXTURES.map((item) => item.category),
    );

    for (const category of ASK_HELM_INTERACTION_OFFLINE_EVAL_REQUIRED_CATEGORIES) {
      expect(categories.has(category), category).toBe(true);
    }
  });

  it("marks workspace_review_visible fixtures as capability gated", () => {
    const workspaceVisible = ASK_HELM_INTERACTION_OFFLINE_EVAL_FIXTURES.filter(
      (item) => item.metadata.requestedVisibility === "workspace_review_visible",
    );

    expect(workspaceVisible.length).toBeGreaterThan(0);
    expect(
      workspaceVisible.every(
        (item) => item.metadata.workspaceReviewVisibleCapabilityGated,
      ),
    ).toBe(true);
  });
});

describe("evaluateAskHelmInteractionOfflineEval privacy and boundary gates", () => {
  it("rejects raw audio and unconfirmed transcript before candidate creation", () => {
    const result = evaluateAskHelmInteractionOfflineEval();
    const rawAudio = result.outcomes.find(
      (item) => item.category === "raw_audio_rejected",
    );
    const unconfirmedTranscript = result.outcomes.find(
      (item) => item.category === "unconfirmed_transcript_rejected",
    );

    expect(rawAudio?.privacyDecision).toBe("privacy_rejected");
    expect(rawAudio?.rejectionReason).toBe("raw_audio_not_allowed");
    expect(rawAudio?.candidate).toBeUndefined();
    expect(unconfirmedTranscript?.privacyDecision).toBe("privacy_rejected");
    expect(unconfirmedTranscript?.rejectionReason).toBe(
      "unconfirmed_transcript_not_allowed",
    );
    expect(unconfirmedTranscript?.candidate).toBeUndefined();
  });

  it("rejects cross-workspace aggregation and active open-domain/cross-workspace candidates", () => {
    const result = evaluateAskHelmInteractionOfflineEval();
    const rejectedReasons = new Map(
      result.outcomes.map((item) => [item.category, item.rejectionReason]),
    );

    expect(rejectedReasons.get("cross_workspace_aggregation_rejected")).toBe(
      "cross_workspace_aggregation_not_allowed",
    );
    expect(rejectedReasons.get("open_domain_active_candidate_rejected")).toBe(
      "unsupported_open_domain_active_candidate_not_allowed",
    );
    expect(rejectedReasons.get("cross_workspace_active_candidate_rejected")).toBe(
      "cross_workspace_active_candidate_not_allowed",
    );
  });

  it("keeps unsupported open-domain boundary hits watch-only when no active candidate is requested", () => {
    const result = evaluateAskHelmInteractionOfflineEval();
    const watchOnly = result.outcomes.find(
      (item) => item.category === "unsupported_open_domain_watch_only",
    );

    expect(watchOnly?.privacyDecision).toBe("privacy_pass");
    expect(watchOnly?.thresholdResult?.status).toBe("watch_only");
    expect(watchOnly?.candidate).toBeUndefined();
  });
});

describe("evaluateAskHelmInteractionOfflineEval threshold and merge behavior", () => {
  it("matches Slice 3 threshold statuses for every privacy-passed fixture", () => {
    const result = evaluateAskHelmInteractionOfflineEval();

    for (const outcome of result.outcomes) {
      if (outcome.privacyDecision !== "privacy_pass") {
        continue;
      }
      const fixture = ASK_HELM_INTERACTION_OFFLINE_EVAL_FIXTURES.find(
        (item) => item.fixtureId === outcome.fixtureId,
      );
      expect(fixture).toBeDefined();
      expect(outcome.thresholdResult?.status).toBe(
        evaluateAskHelmCaptureEligibility(fixture!.observation).status,
      );
    }
  });

  it("folds repeated eligible candidates through Slice 2 dedupe/merge", () => {
    const result = evaluateAskHelmInteractionOfflineEval();
    const folded = result.dedupeMergeResult.mergedCandidates.find((candidate) =>
      candidate.foldedCandidateIds.includes("AHI-OE-CAND-001"),
    );

    expect(folded?.occurrenceCount).toBe(2);
    expect(folded?.foldedCandidateIds).toEqual([
      "AHI-OE-CAND-001",
      "AHI-OE-CAND-002",
    ]);
  });

  it("routes repeated candidates to existing signal and boundary hit to existing Must Push", () => {
    const result = evaluateAskHelmInteractionOfflineEval();

    expect(result.dedupeMergeResult.advancementSignalAttachments).toHaveLength(1);
    expect(result.dedupeMergeResult.advancementSignalAttachments[0]).toMatchObject({
      signalId: "signal:atlas-repeated-intent",
      occurrenceCount: 2,
    });
    expect(result.dedupeMergeResult.mustPushAttachments).toHaveLength(1);
    expect(result.dedupeMergeResult.mustPushAttachments[0]).toMatchObject({
      itemId: "must-push:xinghe-boundary-review",
      occurrenceCount: 1,
    });
  });
});

describe("evaluateAskHelmInteractionOfflineEval review-first and export guarantees", () => {
  it("keeps all promotion targets review-first and temporary-review retained", () => {
    const result = evaluateAskHelmInteractionOfflineEval();
    const candidates = result.outcomes.flatMap((item) =>
      item.candidate ? [item.candidate] : [],
    );

    expect(candidates.length).toBeGreaterThan(0);
    expect(
      candidates.every(
        (candidate) =>
          candidate.promotionTarget !== "none" &&
          candidate.retentionPosture === "temporary_review_candidate" &&
          candidate.reviewPosture !== "read_only",
      ),
    ).toBe(true);
  });

  it("exports only redacted records without raw prompt, body, audio, or transcript fields", () => {
    const result = evaluateAskHelmInteractionOfflineEval();
    const forbiddenFields = [
      "rawPrompt",
      "rawBody",
      "rawAudio",
      "rawTranscript",
      "unconfirmedTranscript",
      "prompt",
      "body",
      "audio",
      "transcript",
    ];

    expect(result.redactedExports.length).toBe(result.summary.eligibleCandidateCount);
    for (const record of result.redactedExports) {
      expect(Object.keys(record).some((key) => forbiddenFields.includes(key))).toBe(
        false,
      );
      expect(record.redactionSummary).toContain("removed");
    }
  });

  it("does not emit forbidden authority wording", () => {
    const result = evaluateAskHelmInteractionOfflineEval();
    const serialized = JSON.stringify({
      outcomes: result.outcomes,
      attachments: [
        ...result.dedupeMergeResult.advancementSignalAttachments,
        ...result.dedupeMergeResult.mustPushAttachments,
      ],
    }).toLowerCase();

    expect(serialized).not.toContain("official write allowed");
    expect(serialized).not.toContain("external action authorized");
    expect(serialized).not.toContain("send allowed");
    expect(serialized).not.toContain("approval granted");
    expect(serialized).not.toContain("payment authorized");
    expect(serialized).not.toContain("bypass guard");
    expect(serialized).not.toContain("skip review");
    expect(serialized).not.toContain("formal skill promoted");
  });
});

describe("evaluateAskHelmInteractionOfflineEval summary", () => {
  it("returns all expected check names", () => {
    const result = evaluateAskHelmInteractionOfflineEval();
    const names = result.summary.checks.map((check) => check.name);

    expect(names).toHaveLength(EXPECTED_CHECK_NAMES.length);
    for (const expected of EXPECTED_CHECK_NAMES) {
      expect(names).toContain(expected);
    }
  });

  it("passes all checks and summarizes counts", () => {
    const result = evaluateAskHelmInteractionOfflineEval();

    expect(result.summary.allPass).toBe(true);
    expect(result.summary.eligibleCandidateCount).toBe(8);
    expect(result.summary.watchOnlyCount).toBe(4);
    expect(result.summary.rejectedCount).toBe(5);
    expect(result.summary.mergedCandidateCount).toBe(7);
    expect(result.summary.signalAttachmentCount).toBe(1);
    expect(result.summary.mustPushAttachmentCount).toBe(1);
    expect(result.summary.privacyViolationCount).toBe(0);
    expect(result.summary.boundaryViolationCount).toBe(0);
    expect(result.summary.runtimeAdoption).toBe("No-Go");

    for (const check of result.summary.checks) {
      expect(check.pass, `${check.name}: ${check.detail}`).toBe(true);
    }
  });

  it("is deterministic under reversed fixture input through the built-in check", () => {
    const result = evaluateAskHelmInteractionOfflineEval();
    const deterministicCheck = result.summary.checks.find(
      (check) => check.name === "deterministic_output_stable_when_input_reversed",
    );

    expect(deterministicCheck?.pass).toBe(true);
  });
});
