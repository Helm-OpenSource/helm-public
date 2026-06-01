import { describe, expect, it } from "vitest";

import type { EvidenceBundle, EvidenceRef } from "./contract";
import {
  computeEvidenceOverlapRatio,
  detectIntentCollision,
  INTENT_COLLISION_HEURISTIC_VERSION,
  INTENT_COLLISION_OVERLAP_THRESHOLD,
  type IntentCollisionCandidate,
} from "./intent-collision";

function makeRef(
  type: EvidenceRef["type"],
  snippetHash: string,
  collectedAt = "2026-05-20T12:00:00.000Z",
): EvidenceRef {
  return { type, sourceId: `${type}-${snippetHash}`, snippetHash, collectedAt };
}

const NOW = new Date("2026-05-21T12:00:00.000Z");

describe("computeEvidenceOverlapRatio (Jaccard)", () => {
  it("returns 1 for identical bundles", () => {
    const bundle: EvidenceBundle = [
      makeRef("git_commit", "h1"),
      makeRef("email_message", "h2"),
    ];
    expect(computeEvidenceOverlapRatio(bundle, bundle)).toBe(1);
  });

  it("returns 0 for disjoint bundles", () => {
    const a: EvidenceBundle = [makeRef("git_commit", "h1")];
    const b: EvidenceBundle = [makeRef("git_commit", "h2")];
    expect(computeEvidenceOverlapRatio(a, b)).toBe(0);
  });

  it("returns 0 for two empty bundles", () => {
    expect(computeEvidenceOverlapRatio([], [])).toBe(0);
  });

  it("returns 0 when one bundle is empty", () => {
    expect(
      computeEvidenceOverlapRatio([], [makeRef("git_commit", "h1")]),
    ).toBe(0);
  });

  it("computes 1/3 for two-vs-two with one shared ref", () => {
    const a: EvidenceBundle = [
      makeRef("git_commit", "h1"),
      makeRef("email_message", "h2"),
    ];
    const b: EvidenceBundle = [
      makeRef("git_commit", "h1"),
      makeRef("meeting_segment", "h3"),
    ];
    // intersection = 1 (git_commit:h1), union = 3
    expect(computeEvidenceOverlapRatio(a, b)).toBeCloseTo(1 / 3, 5);
  });

  it("keys on type + snippetHash, not type alone", () => {
    const a: EvidenceBundle = [makeRef("git_commit", "h1")];
    const b: EvidenceBundle = [makeRef("git_commit", "h2")]; // same type, different hash
    expect(computeEvidenceOverlapRatio(a, b)).toBe(0);
  });
});

describe("detectIntentCollision", () => {
  function buildCandidate(
    overrides: Partial<IntentCollisionCandidate>,
  ): IntentCollisionCandidate {
    return {
      manualActionItemId: "manual-1",
      ownerUserId: "owner-A",
      evidenceBundle: [makeRef("git_commit", "h1"), makeRef("email_message", "h2")],
      createdAt: new Date("2026-05-19T12:00:00.000Z"),
      ...overrides,
    };
  }

  it("fires when owner matches, overlap ≥ 0.5, within 7 days", () => {
    const candidate = buildCandidate({});
    const result = detectIntentCollision({
      proposed: {
        ownerUserId: "owner-A",
        evidenceBundle: [
          makeRef("git_commit", "h1"),
          makeRef("email_message", "h2"),
        ],
      },
      recentManualCandidates: [candidate],
      now: NOW,
    });
    expect(result).not.toBeNull();
    expect(result?.collidedWithActionItemId).toBe("manual-1");
    expect(result?.evidenceOverlapRatio).toBe(1);
    expect(result?.heuristicVersion).toBe(INTENT_COLLISION_HEURISTIC_VERSION);
  });

  it("silent when owner differs", () => {
    const candidate = buildCandidate({ ownerUserId: "owner-B" });
    const result = detectIntentCollision({
      proposed: {
        ownerUserId: "owner-A",
        evidenceBundle: [makeRef("git_commit", "h1")],
      },
      recentManualCandidates: [candidate],
      now: NOW,
    });
    expect(result).toBeNull();
  });

  it("silent when overlap is below the threshold", () => {
    const candidate = buildCandidate({});
    const result = detectIntentCollision({
      proposed: {
        ownerUserId: "owner-A",
        evidenceBundle: [
          makeRef("meeting_segment", "h_other_1"),
          makeRef("meeting_segment", "h_other_2"),
          makeRef("git_commit", "h1"),
        ],
      },
      recentManualCandidates: [candidate],
      now: NOW,
    });
    // intersection = 1 (git_commit:h1), union = 4 → 0.25 < 0.5
    expect(result).toBeNull();
  });

  it("silent when candidate is older than the 7-day window", () => {
    const candidate = buildCandidate({
      createdAt: new Date("2026-05-13T11:59:00.000Z"), // > 7 days ago
    });
    const result = detectIntentCollision({
      proposed: {
        ownerUserId: "owner-A",
        evidenceBundle: candidate.evidenceBundle,
      },
      recentManualCandidates: [candidate],
      now: NOW,
    });
    expect(result).toBeNull();
  });

  it("fires at exact 7-day boundary", () => {
    const candidate = buildCandidate({
      createdAt: new Date(NOW.getTime() - 7 * 24 * 3600 * 1000),
    });
    const result = detectIntentCollision({
      proposed: {
        ownerUserId: "owner-A",
        evidenceBundle: candidate.evidenceBundle,
      },
      recentManualCandidates: [candidate],
      now: NOW,
    });
    expect(result).not.toBeNull();
  });

  it("silent when candidate's createdAt is in the future (negative age)", () => {
    const candidate = buildCandidate({
      createdAt: new Date(NOW.getTime() + 60 * 1000),
    });
    const result = detectIntentCollision({
      proposed: {
        ownerUserId: "owner-A",
        evidenceBundle: candidate.evidenceBundle,
      },
      recentManualCandidates: [candidate],
      now: NOW,
    });
    expect(result).toBeNull();
  });

  it("returns the first matching candidate (deterministic)", () => {
    const candidateA = buildCandidate({ manualActionItemId: "manual-A" });
    const candidateB = buildCandidate({ manualActionItemId: "manual-B" });
    const result = detectIntentCollision({
      proposed: {
        ownerUserId: "owner-A",
        evidenceBundle: candidateA.evidenceBundle,
      },
      recentManualCandidates: [candidateA, candidateB],
      now: NOW,
    });
    expect(result?.collidedWithActionItemId).toBe("manual-A");
  });

  it("respects custom threshold", () => {
    const candidate = buildCandidate({});
    // With overlap 1/3 ~= 0.33, default threshold rejects, lowered accepts
    const proposed = {
      ownerUserId: "owner-A",
      evidenceBundle: [
        makeRef("git_commit", "h1"),
        makeRef("meeting_segment", "h_extra"),
        makeRef("meeting_segment", "h_extra_2"),
      ],
    };
    const resultDefault = detectIntentCollision({
      proposed,
      recentManualCandidates: [candidate],
      now: NOW,
    });
    expect(resultDefault).toBeNull();

    const resultRelaxed = detectIntentCollision({
      proposed,
      recentManualCandidates: [candidate],
      now: NOW,
      overlapThreshold: 0.2,
    });
    expect(resultRelaxed).not.toBeNull();
  });

  it("threshold default is 0.5", () => {
    expect(INTENT_COLLISION_OVERLAP_THRESHOLD).toBe(0.5);
  });

  it("produces flag without ceoVerdict (verdict is set at CEO action time)", () => {
    const candidate = buildCandidate({});
    const result = detectIntentCollision({
      proposed: {
        ownerUserId: "owner-A",
        evidenceBundle: candidate.evidenceBundle,
      },
      recentManualCandidates: [candidate],
      now: NOW,
    });
    expect(result?.ceoVerdict).toBeUndefined();
  });
});
