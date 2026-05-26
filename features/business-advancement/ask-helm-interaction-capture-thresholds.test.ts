import { describe, expect, it } from "vitest";
import {
  ABANDONED_NUMERIC_CONFIDENCE_THRESHOLD,
  ASK_HELM_CAPTURE_THRESHOLD_FIXTURES,
  ASK_HELM_INTERACTION_CAPTURE_THRESHOLDS_POSTURE,
  ASK_HELM_INTERACTION_CAPTURE_THRESHOLDS_RULE_VERSION,
  ASK_HELM_INTERACTION_CAPTURE_THRESHOLDS_RUNTIME_ADOPTION,
  REPEATED_INTENT_CANDIDATE_OCCURRENCES,
  REPEATED_INTENT_ROLLING_NATURAL_DAYS,
  REPEATED_INTENT_WATCH_ONLY_OCCURRENCES,
  containsForbiddenCaptureAuthorityWording,
  evaluateAskHelmCaptureEligibility,
  evaluateAskHelmCaptureThresholds,
  evaluateAskHelmCaptureThresholdsStrategy,
  type AskHelmCaptureEligibilityInput,
} from "./ask-helm-interaction-capture-thresholds";

const EXPECTED_CHECK_NAMES = [
  "rule_version_is_v1",
  "runtime_adoption_is_no_go",
  "all_candidate_kinds_modeled",
  "repeated_intent_3_in_7_days_eligible",
  "repeated_intent_2_in_7_days_watch_only",
  "cross_workspace_never_aggregates",
  "boundary_hit_review_reason_not_authority",
  "abandoned_high_confidence_with_followthrough_gap_eligible",
  "missing_telemetry_degrades_to_watch_only",
  "weekend_only_silence_degrades_to_watch_only",
  "plan_draft_handoff_require_explicit_user_request",
  "deterministic_ordering_stable_when_input_reversed",
  "no_forbidden_authority_wording",
  "no_task_commitment_assignment_created_automatically",
] as const;

const atlasRef = {
  objectType: "opportunity",
  objectId: "synthetic-opportunity-atlas-renewal",
  displayName: "Atlas Renewal",
};

describe("Ask Helm interaction capture thresholds constants", () => {
  it("keeps the rule planning-only and runtime adoption no-go", () => {
    expect(ASK_HELM_INTERACTION_CAPTURE_THRESHOLDS_RULE_VERSION).toBe(
      "ask-helm-interaction-capture-thresholds/v1",
    );
    expect(ASK_HELM_INTERACTION_CAPTURE_THRESHOLDS_POSTURE).toBe("Planning-Only");
    expect(ASK_HELM_INTERACTION_CAPTURE_THRESHOLDS_RUNTIME_ADOPTION).toBe("No-Go");
    expect(REPEATED_INTENT_ROLLING_NATURAL_DAYS).toBe(7);
    expect(REPEATED_INTENT_CANDIDATE_OCCURRENCES).toBe(3);
    expect(REPEATED_INTENT_WATCH_ONLY_OCCURRENCES).toBe(2);
    expect(ABANDONED_NUMERIC_CONFIDENCE_THRESHOLD).toBe(0.85);
  });
});

describe("evaluateAskHelmCaptureEligibility repeated intent", () => {
  it("qualifies 3 same-workspace occurrences inside rolling 7 natural days", () => {
    const result = evaluateAskHelmCaptureEligibility(
      ASK_HELM_CAPTURE_THRESHOLD_FIXTURES[0],
    );

    expect(result.status).toBe("eligible_candidate");
    expect(result.occurrenceCount).toBe(3);
    expect(result.promotionTarget).toBe("AdvancementSignal");
  });

  it("keeps 2 same-workspace occurrences watch-only", () => {
    const result = evaluateAskHelmCaptureEligibility(
      ASK_HELM_CAPTURE_THRESHOLD_FIXTURES[1],
    );

    expect(result.status).toBe("watch_only");
    expect(result.occurrenceCount).toBe(2);
    expect(result.promotionTarget).toBe("none");
  });

  it("never aggregates cross-workspace occurrences into the threshold", () => {
    const result = evaluateAskHelmCaptureEligibility(
      ASK_HELM_CAPTURE_THRESHOLD_FIXTURES[0],
    );

    expect(result.countedOccurrenceIds).not.toContain("occ-beta-001");
    expect(result.occurrenceCount).toBe(3);
  });

  it("excludes occurrences outside the 7 natural day window", () => {
    const input: AskHelmCaptureEligibilityInput = {
      observationId: "AHI-CT-OLD",
      workspaceId: "workspace-alpha",
      actorScope: "user:synthetic-operator",
      kind: "repeated_intent",
      intentType: "today_priority",
      objectRef: atlasRef,
      observedAt: "2026-04-27T10:00:00.000Z",
      repeatedIntentOccurrences: [
        {
          occurrenceId: "old-001",
          workspaceId: "workspace-alpha",
          actorScope: "user:synthetic-operator",
          intentType: "today_priority",
          objectRef: atlasRef,
          occurredAt: "2026-04-20T10:00:00.000Z",
        },
        {
          occurrenceId: "fresh-001",
          workspaceId: "workspace-alpha",
          actorScope: "user:synthetic-operator",
          intentType: "today_priority",
          objectRef: atlasRef,
          occurredAt: "2026-04-26T10:00:00.000Z",
        },
        {
          occurrenceId: "fresh-002",
          workspaceId: "workspace-alpha",
          actorScope: "user:synthetic-operator",
          intentType: "today_priority",
          objectRef: atlasRef,
          occurredAt: "2026-04-27T10:00:00.000Z",
        },
      ],
    };

    const result = evaluateAskHelmCaptureEligibility(input);

    expect(result.status).toBe("watch_only");
    expect(result.countedOccurrenceIds).toEqual(["fresh-001", "fresh-002"]);
  });
});

describe("evaluateAskHelmCaptureEligibility boundary hits", () => {
  it("qualifies a blocked official write request as review-required evidence only", () => {
    const result = evaluateAskHelmCaptureEligibility(
      ASK_HELM_CAPTURE_THRESHOLD_FIXTURES[2],
    );

    expect(result.status).toBe("eligible_candidate");
    expect(result.reviewPosture).toBe("review_required");
    expect(result.promotionTarget).toBe("ReviewRequiredAction");
    expect(result.authorityGuard).toBe("review_reason_only_not_authority");
    expect(result.boundaryNote.toLowerCase()).toContain("not authority");
  });

  it("keeps unsupported open-domain boundary hits watch-only", () => {
    const result = evaluateAskHelmCaptureEligibility({
      observationId: "AHI-CT-OPEN",
      workspaceId: "workspace-alpha",
      actorScope: "user:synthetic-operator",
      kind: "boundary_hit",
      intentType: "unsupported_open_domain",
      observedAt: "2026-04-27T11:00:00.000Z",
      boundaryRequestKind: "unsupported_open_domain",
      boundaryBlocked: true,
    });

    expect(result.status).toBe("watch_only");
    expect(result.promotionTarget).toBe("none");
  });
});

describe("evaluateAskHelmCaptureEligibility abandoned high-confidence answer", () => {
  it("qualifies numeric confidence at the 0.85 edge with grounding and no follow-through", () => {
    const result = evaluateAskHelmCaptureEligibility(
      ASK_HELM_CAPTURE_THRESHOLD_FIXTURES[3],
    );

    expect(result.status).toBe("eligible_candidate");
    expect(result.promotionTarget).toBe("MemoryWritebackCandidate");
  });

  it("qualifies deterministic confidence high when other prerequisites hold", () => {
    const result = evaluateAskHelmCaptureEligibility({
      ...ASK_HELM_CAPTURE_THRESHOLD_FIXTURES[3],
      observationId: "AHI-CT-HIGH",
      answerConfidence: undefined,
      deterministicConfidence: "high",
    });

    expect(result.status).toBe("eligible_candidate");
  });

  it("rejects high-confidence answers missing required grounding", () => {
    const result = evaluateAskHelmCaptureEligibility({
      ...ASK_HELM_CAPTURE_THRESHOLD_FIXTURES[3],
      observationId: "AHI-CT-MISSING-GROUNDING",
      evidenceRefs: [],
    });

    expect(result.status).toBe("not_eligible");
  });

  it("rejects high-confidence answers missing an explicit next step", () => {
    const result = evaluateAskHelmCaptureEligibility({
      ...ASK_HELM_CAPTURE_THRESHOLD_FIXTURES[3],
      observationId: "AHI-CT-MISSING-NEXT-STEP",
      hasNextStep: false,
    });

    expect(result.status).toBe("not_eligible");
  });

  it("degrades missing telemetry to watch-only", () => {
    const result = evaluateAskHelmCaptureEligibility(
      ASK_HELM_CAPTURE_THRESHOLD_FIXTURES[4],
    );

    expect(result.status).toBe("watch_only");
  });

  it("degrades weekend-only silence to watch-only", () => {
    const result = evaluateAskHelmCaptureEligibility(
      ASK_HELM_CAPTURE_THRESHOLD_FIXTURES[5],
    );

    expect(result.status).toBe("watch_only");
  });
});

describe("evaluateAskHelmCaptureEligibility plan/draft/handoff", () => {
  it("requires explicit user generation/save/queue/handoff requests", () => {
    const results = evaluateAskHelmCaptureThresholds({
      observations: ASK_HELM_CAPTURE_THRESHOLD_FIXTURES,
    });
    const byId = new Map(results.map((item) => [item.observationId, item]));

    expect(byId.get("AHI-CT-007")?.status).toBe("eligible_candidate");
    expect(byId.get("AHI-CT-008")?.status).toBe("eligible_candidate");
    expect(byId.get("AHI-CT-009")?.status).toBe("eligible_candidate");
    expect(byId.get("AHI-CT-010")?.status).toBe("eligible_candidate");
    expect(byId.get("AHI-CT-011")?.status).toBe("not_eligible");
  });

  it("does not create task, commitment, or assignment authority", () => {
    const results = evaluateAskHelmCaptureThresholds({
      observations: ASK_HELM_CAPTURE_THRESHOLD_FIXTURES,
    });
    const eligibleNotes = results
      .filter((item) => item.status === "eligible_candidate")
      .map((item) => item.boundaryNote.toLowerCase());

    expect(eligibleNotes.every((note) => note.includes("review"))).toBe(true);
    expect(eligibleNotes.some((note) => note.includes("official write"))).toBe(
      true,
    );
  });
});

describe("evaluateAskHelmCaptureThresholds", () => {
  it("returns deterministic ordering when input is reversed", () => {
    const forward = evaluateAskHelmCaptureThresholds({
      observations: ASK_HELM_CAPTURE_THRESHOLD_FIXTURES,
    });
    const reversed = evaluateAskHelmCaptureThresholds({
      observations: [...ASK_HELM_CAPTURE_THRESHOLD_FIXTURES].reverse(),
    });

    expect(forward.map((item) => item.observationId)).toEqual(
      reversed.map((item) => item.observationId),
    );
    expect(forward.map((item) => item.status)).toEqual(
      reversed.map((item) => item.status),
    );
  });

  it("does not emit forbidden authority wording", () => {
    const results = evaluateAskHelmCaptureThresholds({
      observations: ASK_HELM_CAPTURE_THRESHOLD_FIXTURES,
    });

    expect(
      results.some((item) =>
        containsForbiddenCaptureAuthorityWording(
          [item.boundaryNote, ...item.reasons].join(" "),
        ),
      ),
    ).toBe(false);
  });
});

describe("evaluateAskHelmCaptureThresholdsStrategy", () => {
  it("returns all expected check names", () => {
    const summary = evaluateAskHelmCaptureThresholdsStrategy();
    const names = summary.checks.map((check) => check.name);

    expect(names).toHaveLength(EXPECTED_CHECK_NAMES.length);
    for (const expected of EXPECTED_CHECK_NAMES) {
      expect(names).toContain(expected);
    }
  });

  it("passes all checks and summarizes outcomes", () => {
    const summary = evaluateAskHelmCaptureThresholdsStrategy();

    expect(summary.allPass).toBe(true);
    expect(summary.eligibleCandidateCount).toBe(7);
    expect(summary.watchOnlyCount).toBe(3);
    expect(summary.notEligibleCount).toBe(1);
    expect(summary.runtimeAdoption).toBe("No-Go");
    for (const check of summary.checks) {
      expect(check.pass, `${check.name}: ${check.detail}`).toBe(true);
    }
  });
});
