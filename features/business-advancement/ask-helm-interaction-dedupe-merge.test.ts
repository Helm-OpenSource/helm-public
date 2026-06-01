import { describe, expect, it } from "vitest";
import {
  ASK_HELM_INTERACTION_DEDUPE_FIXTURES,
  ASK_HELM_INTERACTION_DEDUPE_MERGE_POSTURE,
  ASK_HELM_INTERACTION_DEDUPE_MERGE_RULE_VERSION,
  ASK_HELM_INTERACTION_DEDUPE_MERGE_RUNTIME_ADOPTION,
  EXISTING_ADVANCEMENT_SIGNAL_DEDUPE_FIXTURES,
  EXISTING_MUST_PUSH_DEDUPE_FIXTURES,
  buildAskHelmInteractionAssetFingerprint,
  evaluateAskHelmInteractionDedupeMergeStrategy,
  mergeAndRouteAskHelmInteractionAssets,
  mergeAskHelmInteractionAssetCandidates,
  type AskHelmInteractionAssetCandidate,
} from "./ask-helm-interaction-dedupe-merge";

const EXPECTED_CHECK_NAMES = [
  "rule_version_is_v1",
  "runtime_adoption_is_no_go",
  "duplicate_repeated_intent_folded_by_fingerprint",
  "cross_workspace_candidate_not_merged",
  "existing_advancement_signal_receives_evidence_attachment",
  "existing_must_push_receives_supporting_evidence",
  "boundary_hit_stays_review_reason_not_authority",
  "strictest_risk_boundary_and_seen_timestamps_preserved",
  "unmatched_plan_candidate_remains_reviewable",
  "fingerprint_output_stable_when_input_reversed",
  "no_forbidden_authority_wording",
  "merged_candidates_remain_review_first_candidates",
] as const;

describe("Ask Helm interaction dedupe / merge constants", () => {
  it("keeps the rule planning-only and runtime adoption no-go", () => {
    expect(ASK_HELM_INTERACTION_DEDUPE_MERGE_RULE_VERSION).toBe(
      "ask-helm-interaction-dedupe-merge/v1",
    );
    expect(ASK_HELM_INTERACTION_DEDUPE_MERGE_POSTURE).toBe("Planning-Only");
    expect(ASK_HELM_INTERACTION_DEDUPE_MERGE_RUNTIME_ADOPTION).toBe("No-Go");
  });
});

describe("buildAskHelmInteractionAssetFingerprint", () => {
  it("uses workspace, actor, intent, normalized object refs, capture reason, and day bucket", () => {
    const fixture = ASK_HELM_INTERACTION_DEDUPE_FIXTURES[0];
    const fingerprint = buildAskHelmInteractionAssetFingerprint(fixture);

    expect(fingerprint).toContain("workspace:workspace-alpha");
    expect(fingerprint).toContain("actor:user:synthetic-operator");
    expect(fingerprint).toContain("intent:today_priority");
    expect(fingerprint).toContain("opportunity:synthetic-opportunity-atlas-renewal");
    expect(fingerprint).toContain("reason:repeated_today_priority");
    expect(fingerprint).toContain("day:2026-04-27");
  });

  it("sorts object refs so equivalent multi-object candidates fingerprint deterministically", () => {
    const base = ASK_HELM_INTERACTION_DEDUPE_FIXTURES[0];
    const left: AskHelmInteractionAssetCandidate = {
      ...base,
      objectRefs: [
        { objectType: "company", objectId: "B", displayName: "B" },
        { objectType: "company", objectId: "A", displayName: "A" },
      ],
    };
    const right: AskHelmInteractionAssetCandidate = {
      ...base,
      objectRefs: [...left.objectRefs].reverse(),
    };

    expect(buildAskHelmInteractionAssetFingerprint(left)).toBe(
      buildAskHelmInteractionAssetFingerprint(right),
    );
  });
});

describe("mergeAskHelmInteractionAssetCandidates", () => {
  it("folds duplicate same-workspace repeated intents into one candidate", () => {
    const merged = mergeAskHelmInteractionAssetCandidates(
      ASK_HELM_INTERACTION_DEDUPE_FIXTURES,
    );
    const folded = merged.find((candidate) =>
      candidate.foldedCandidateIds.includes("AHI-DM-001"),
    );

    expect(folded).toBeDefined();
    expect(folded?.occurrenceCount).toBe(2);
    expect(folded?.foldedCandidateIds).toEqual(["AHI-DM-001", "AHI-DM-002"]);
    expect(folded?.supportingInteractions).toHaveLength(2);
  });

  it("does not merge candidates across workspace boundaries", () => {
    const merged = mergeAskHelmInteractionAssetCandidates(
      ASK_HELM_INTERACTION_DEDUPE_FIXTURES,
    );
    const beta = merged.find((candidate) =>
      candidate.foldedCandidateIds.includes("AHI-DM-003"),
    );

    expect(beta).toBeDefined();
    expect(beta?.workspaceId).toBe("workspace-beta");
    expect(beta?.occurrenceCount).toBe(1);
  });

  it("keeps strictest risk, boundary note, firstCapturedAt, and lastSeenAt", () => {
    const merged = mergeAskHelmInteractionAssetCandidates(
      ASK_HELM_INTERACTION_DEDUPE_FIXTURES,
    );
    const folded = merged.find((candidate) =>
      candidate.foldedCandidateIds.includes("AHI-DM-001"),
    );

    expect(folded?.riskLevel).toBe("high");
    expect(folded?.boundaryNote).toContain("not create duplicate Must Push");
    expect(folded?.firstCapturedAt).toBe("2026-04-27T02:00:00.000Z");
    expect(folded?.lastSeenAt).toBe("2026-04-27T05:00:00.000Z");
  });
});

describe("mergeAndRouteAskHelmInteractionAssets", () => {
  it("attaches existing AdvancementSignal candidates as evidence instead of duplicate active signals", () => {
    const result = mergeAndRouteAskHelmInteractionAssets({
      candidates: ASK_HELM_INTERACTION_DEDUPE_FIXTURES,
      existingSignals: EXISTING_ADVANCEMENT_SIGNAL_DEDUPE_FIXTURES,
      existingMustPushItems: EXISTING_MUST_PUSH_DEDUPE_FIXTURES,
    });

    expect(result.advancementSignalAttachments).toHaveLength(1);
    expect(result.advancementSignalAttachments[0]).toMatchObject({
      signalId: "signal-existing-atlas-repeated-intent",
      occurrenceCount: 2,
    });
    expect(result.newReviewableCandidates.some((candidate) =>
      candidate.foldedCandidateIds.includes("AHI-DM-001"),
    )).toBe(false);
  });

  it("attaches existing MustPushItem candidates as supporting evidence without changing active status", () => {
    const result = mergeAndRouteAskHelmInteractionAssets({
      candidates: ASK_HELM_INTERACTION_DEDUPE_FIXTURES,
      existingSignals: EXISTING_ADVANCEMENT_SIGNAL_DEDUPE_FIXTURES,
      existingMustPushItems: EXISTING_MUST_PUSH_DEDUPE_FIXTURES,
    });

    expect(result.mustPushAttachments).toHaveLength(1);
    expect(result.mustPushAttachments[0]).toMatchObject({
      itemId: "must-push:existing-xinghe-boundary-hit",
      occurrenceCount: 2,
    });
    expect(result.newReviewableCandidates.some((candidate) =>
      candidate.foldedCandidateIds.includes("AHI-DM-004"),
    )).toBe(false);
  });

  it("keeps unmatched reviewable candidates for later review", () => {
    const result = mergeAndRouteAskHelmInteractionAssets({
      candidates: ASK_HELM_INTERACTION_DEDUPE_FIXTURES,
      existingSignals: EXISTING_ADVANCEMENT_SIGNAL_DEDUPE_FIXTURES,
      existingMustPushItems: EXISTING_MUST_PUSH_DEDUPE_FIXTURES,
    });

    expect(
      result.newReviewableCandidates
        .map((candidate) => candidate.candidateId)
        .sort(),
    ).toEqual(["AHI-DM-003", "AHI-DM-006"]);
  });

  it("keeps boundary hits as review reason and not authority", () => {
    const result = mergeAndRouteAskHelmInteractionAssets({
      candidates: ASK_HELM_INTERACTION_DEDUPE_FIXTURES,
      existingSignals: EXISTING_ADVANCEMENT_SIGNAL_DEDUPE_FIXTURES,
      existingMustPushItems: EXISTING_MUST_PUSH_DEDUPE_FIXTURES,
    });
    const boundary = result.mergedCandidates.find((candidate) =>
      candidate.foldedCandidateIds.includes("AHI-DM-004"),
    );

    expect(boundary?.assetType).toBe("boundary_hit_candidate");
    expect(boundary?.promotionTarget).toBe("ReviewRequiredAction");
    expect(boundary?.boundaryNote.toLowerCase()).toContain("no official write");
    expect(boundary?.boundaryNote.toLowerCase()).toContain("no guard bypass");
  });

  it("returns deterministic fingerprints when input order is reversed", () => {
    const forward = mergeAndRouteAskHelmInteractionAssets({
      candidates: ASK_HELM_INTERACTION_DEDUPE_FIXTURES,
      existingSignals: EXISTING_ADVANCEMENT_SIGNAL_DEDUPE_FIXTURES,
      existingMustPushItems: EXISTING_MUST_PUSH_DEDUPE_FIXTURES,
    });
    const reversed = mergeAndRouteAskHelmInteractionAssets({
      candidates: [...ASK_HELM_INTERACTION_DEDUPE_FIXTURES].reverse(),
      existingSignals: EXISTING_ADVANCEMENT_SIGNAL_DEDUPE_FIXTURES,
      existingMustPushItems: EXISTING_MUST_PUSH_DEDUPE_FIXTURES,
    });

    expect(forward.mergedCandidates.map((candidate) => candidate.assetFingerprint)).toEqual(
      reversed.mergedCandidates.map((candidate) => candidate.assetFingerprint),
    );
  });
});

describe("evaluateAskHelmInteractionDedupeMergeStrategy", () => {
  it("returns all expected check names", () => {
    const summary = evaluateAskHelmInteractionDedupeMergeStrategy();
    const names = summary.checks.map((check) => check.name);

    expect(names).toHaveLength(EXPECTED_CHECK_NAMES.length);
    for (const expected of EXPECTED_CHECK_NAMES) {
      expect(names).toContain(expected);
    }
  });

  it("passes all checks", () => {
    const summary = evaluateAskHelmInteractionDedupeMergeStrategy();

    expect(summary.allPass).toBe(true);
    for (const check of summary.checks) {
      expect(check.pass, `${check.name}: ${check.detail}`).toBe(true);
    }
  });

  it("summarizes merged, new, signal attachment, and must-push attachment counts", () => {
    const summary = evaluateAskHelmInteractionDedupeMergeStrategy();

    expect(summary.mergedCandidateCount).toBe(4);
    expect(summary.newReviewableCandidateCount).toBe(2);
    expect(summary.signalAttachmentCount).toBe(1);
    expect(summary.mustPushAttachmentCount).toBe(1);
    expect(summary.runtimeAdoption).toBe("No-Go");
  });
});
