import { describe, expect, it } from "vitest";
import { ADVANCEMENT_SIGNAL_FIXTURES } from "./fixtures";
import { FIXTURE_FEASIBILITY_MATRIX } from "./read-model-feasibility";
import {
  adaptFixtureToMustPushCandidate,
  buildMustPushAdapterResults,
  buildReviewRequiredActionFromFixture,
  selectTopMustPushItems,
  summarizeMustPushAdapter,
  type MustPushActiveCandidate,
  type MustPushDeferredCandidate,
} from "./must-push-adapter";

const FORBIDDEN_PRIMARY_ACTION_TERMS = [
  "auto",
  "execute",
  "approve",
  "send",
  "write",
  "commitment",
  "自动",
  "执行",
  "审批",
  "批准",
  "发送",
  "写入",
  "承诺",
] as const;

function isActive(result: unknown): result is MustPushActiveCandidate {
  return (
    typeof result === "object" &&
    result !== null &&
    "status" in result &&
    result.status === "active"
  );
}

function isDeferred(result: unknown): result is MustPushDeferredCandidate {
  return (
    typeof result === "object" &&
    result !== null &&
    "status" in result &&
    result.status === "deferred"
  );
}

function fixtureById(fixtureId: string) {
  const fixture = ADVANCEMENT_SIGNAL_FIXTURES.find(
    (candidate) => candidate.fixtureId === fixtureId
  );
  expect(fixture).toBeDefined();
  return fixture!;
}

function feasibilityById(fixtureId: string) {
  const feasibility = FIXTURE_FEASIBILITY_MATRIX.find(
    (candidate) => candidate.fixtureId === fixtureId
  );
  expect(feasibility).toBeDefined();
  return feasibility!;
}

describe("buildMustPushAdapterResults", () => {
  const results = buildMustPushAdapterResults(
    ADVANCEMENT_SIGNAL_FIXTURES,
    FIXTURE_FEASIBILITY_MATRIX
  );

  it("processes all 20 fixtures", () => {
    expect(results).toHaveLength(20);
  });

  it("defers every future_only fixture", () => {
    const futureOnlyIds = FIXTURE_FEASIBILITY_MATRIX.filter(
      (row) => row.feasibilityStatus === "future_only"
    ).map((row) => row.fixtureId);

    for (const fixtureId of futureOnlyIds) {
      const result = results.find((candidate) => candidate.fixtureId === fixtureId);
      expect(result, `${fixtureId}: missing adapter result`).toBeDefined();
      expect(isDeferred(result)).toBe(true);
      expect((result as MustPushDeferredCandidate).reason).toBe("future_only");
    }
  });

  it("does not generate active candidates for blocked posture", () => {
    const blocked = results.find((candidate) => candidate.fixtureId === "AS-FX-015");
    expect(blocked).toBeDefined();
    expect(isDeferred(blocked)).toBe(true);
    expect((blocked as MustPushDeferredCandidate).reason).toBe("blocked_boundary");
  });

  it("creates active candidates for current and thin rows that are not blocked", () => {
    const active = results.filter(isActive);
    expect(active).toHaveLength(14);

    for (const candidate of active) {
      expect(candidate.feasibilityStatus).not.toBe("future_only");
      expect(candidate.item.reviewPosture).not.toBe("blocked");
    }
  });

  it("keeps every active candidate fully grounded and reviewable", () => {
    const active = results.filter(isActive);

    for (const candidate of active) {
      expect(candidate.item.itemId).toBe(`must-push:${candidate.fixtureId}`);
      expect(candidate.item.title.trim()).not.toBe("");
      expect(candidate.item.reason.trim()).not.toBe("");
      expect(candidate.item.evidenceRefs.length).toBeGreaterThan(0);
      expect(candidate.item.primaryAction.trim()).not.toBe("");
      expect(candidate.item.boundaryNote.trim()).not.toBe("");
      expect(candidate.item.sourceSummary.trim()).not.toBe("");
      expect(["low", "medium", "high"]).toContain(candidate.item.riskLevel);
      expect(Number.isInteger(candidate.item.sortKey)).toBe(true);
    }
  });

  it("attaches a deterministic owner suggestion to every active candidate (P0-REQ-02)", () => {
    const active = results.filter(isActive);
    expect(active.length).toBeGreaterThan(0);

    // ownerSuggestion is a hint, not an action. The forbidden-action verbs check
    // applies to primaryAction; for the rationale we only block authority-claiming
    // verbs like auto / 自动 to keep the suggestion non-binding.
    const FORBIDDEN_OWNER_RATIONALE_TERMS = [
      "auto_execute",
      "auto execute",
      "auto-execute",
      "auto_send",
      "auto send",
      "auto-send",
      "auto_approve",
      "auto approve",
      "auto-approve",
      "official_write",
      "official write",
      "auto_write",
      "auto write",
      "auto-write",
      "自动执行",
      "自动发送",
      "自动审批",
      "自动批准",
      "自动写入",
    ] as const;

    for (const candidate of active) {
      expect(
        candidate.item.ownerSuggestion,
        `${candidate.fixtureId}: missing ownerSuggestion`,
      ).toBeDefined();
      expect(candidate.item.ownerSuggestion?.role.trim()).not.toBe("");
      expect(candidate.item.ownerSuggestion?.rationale.trim()).not.toBe("");
      const lower = (candidate.item.ownerSuggestion?.rationale ?? "").toLowerCase();
      for (const term of FORBIDDEN_OWNER_RATIONALE_TERMS) {
        expect(
          lower.includes(term),
          `${candidate.fixtureId}: ownerSuggestion rationale contains forbidden term "${term}"`,
        ).toBe(false);
      }
    }
  });

  it("derives owner suggestion deterministically from signal+posture (P0-REQ-02)", () => {
    const normalActive = buildMustPushAdapterResults(
      ADVANCEMENT_SIGNAL_FIXTURES,
      FIXTURE_FEASIBILITY_MATRIX,
    ).filter(isActive);
    const reversedActive = buildMustPushAdapterResults(
      [...ADVANCEMENT_SIGNAL_FIXTURES].reverse(),
      FIXTURE_FEASIBILITY_MATRIX,
    ).filter(isActive);

    const normalById = new Map(normalActive.map((c) => [c.fixtureId, c]));
    for (const candidate of reversedActive) {
      const baseline = normalById.get(candidate.fixtureId);
      expect(baseline).toBeDefined();
      expect(candidate.item.ownerSuggestion).toEqual(baseline!.item.ownerSuggestion);
    }
  });

  it("does not expose LLM final ranking in any candidate", () => {
    for (const result of results) {
      const serialized = JSON.stringify(result).toLowerCase();
      expect(serialized.includes("llm")).toBe(false);
    }
  });

  it("keeps active primary actions away from forbidden execution language", () => {
    for (const candidate of results.filter(isActive)) {
      const action = candidate.item.primaryAction.toLowerCase();
      for (const term of FORBIDDEN_PRIMARY_ACTION_TERMS) {
        expect(
          action.includes(term),
          `${candidate.fixtureId}: primaryAction contains forbidden term "${term}"`
        ).toBe(false);
      }
    }
  });
});

describe("adaptFixtureToMustPushCandidate", () => {
  it("adapts a current read-model fixture into an active candidate", () => {
    const result = adaptFixtureToMustPushCandidate(
      fixtureById("AS-FX-001"),
      feasibilityById("AS-FX-001"),
      0
    );

    expect(isActive(result)).toBe(true);
    expect((result as MustPushActiveCandidate).item.itemId).toBe("must-push:AS-FX-001");
  });

  it("defers a future-only fixture with a reason", () => {
    const result = adaptFixtureToMustPushCandidate(
      fixtureById("AS-FX-010"),
      feasibilityById("AS-FX-010"),
      9
    );

    expect(isDeferred(result)).toBe(true);
    expect((result as MustPushDeferredCandidate).reason).toBe("future_only");
  });
});

describe("selectTopMustPushItems", () => {
  it("returns at most 5 top items by default", () => {
    const results = buildMustPushAdapterResults(
      ADVANCEMENT_SIGNAL_FIXTURES,
      FIXTURE_FEASIBILITY_MATRIX
    );

    expect(selectTopMustPushItems(results)).toHaveLength(5);
  });

  it("returns a stable 3-5 item compression result when requested", () => {
    const results = buildMustPushAdapterResults(
      ADVANCEMENT_SIGNAL_FIXTURES,
      FIXTURE_FEASIBILITY_MATRIX
    );
    const topThree = selectTopMustPushItems(results, 3);

    expect(topThree).toHaveLength(3);
    expect(topThree.map((item) => item.itemId)).toEqual([
      "must-push:AS-FX-002",
      "must-push:AS-FX-009",
      "must-push:AS-FX-020",
    ]);
  });

  it("is deterministic even when input order changes", () => {
    const normalResults = buildMustPushAdapterResults(
      ADVANCEMENT_SIGNAL_FIXTURES,
      FIXTURE_FEASIBILITY_MATRIX
    );
    const reversedResults = buildMustPushAdapterResults(
      [...ADVANCEMENT_SIGNAL_FIXTURES].reverse(),
      FIXTURE_FEASIBILITY_MATRIX
    );

    expect(selectTopMustPushItems(normalResults, 5).map((item) => item.itemId)).toEqual(
      selectTopMustPushItems(reversedResults, 5).map((item) => item.itemId)
    );
  });
});

describe("summarizeMustPushAdapter", () => {
  it("summarizes total, active, deferred, and top items", () => {
    const summary = summarizeMustPushAdapter(
      ADVANCEMENT_SIGNAL_FIXTURES,
      FIXTURE_FEASIBILITY_MATRIX
    );

    expect(summary.total).toBe(20);
    expect(summary.active).toBe(14);
    expect(summary.deferred).toBe(6);
    expect(summary.topItems).toHaveLength(5);
    expect(summary.results).toHaveLength(20);
  });
});

describe("buildReviewRequiredActionFromFixture (P0-REQ-04)", () => {
  const ALLOWED_BLOCKED_ACTION_TYPES = [
    "official_write",
    "outbound_send",
    "approval_commit",
    "settlement_commit",
    "ownership_change",
    "policy_exception",
  ] as const;

  it("returns undefined for read_only postures", () => {
    const readOnlyFixture = ADVANCEMENT_SIGNAL_FIXTURES.find(
      (f) => f.expectedReviewPosture === "read_only",
    );
    if (readOnlyFixture) {
      expect(buildReviewRequiredActionFromFixture(readOnlyFixture)).toBeUndefined();
    }
  });

  it("populates every required reviewer field for non-read-only postures", () => {
    const gated = ADVANCEMENT_SIGNAL_FIXTURES.filter(
      (f) => f.expectedReviewPosture !== "read_only",
    );
    expect(gated.length).toBeGreaterThan(0);

    for (const fixture of gated) {
      const action = buildReviewRequiredActionFromFixture(fixture);
      expect(action, `${fixture.fixtureId}: missing review action`).toBeDefined();
      expect(action!.actionId).toBe(`review-required:${fixture.fixtureId}`);
      expect(action!.linkedSignalId).toBe(fixture.fixtureId);
      expect(action!.requiredReviewerRole?.trim()).not.toBe("");
      expect(action!.reason?.trim()).not.toBe("");
      expect((action!.evidenceRefs ?? []).length).toBeGreaterThan(0);
      expect(action!.blockedActionType).toBeDefined();
      expect(ALLOWED_BLOCKED_ACTION_TYPES).toContain(action!.blockedActionType!);
      expect((action!.escalationPath ?? []).length).toBeGreaterThanOrEqual(2);
      // Required reviewer must be the head of the escalation chain.
      expect(action!.escalationPath?.[0]).toBe(action!.requiredReviewerRole);
      expect(action!.reviewPosture).not.toBe("read_only");
    }
  });

  it("never grants execution authority through actionType", () => {
    const safeVerbs = ["view", "prepare", "review", "assign", "confirm", "explain", "open"] as const;
    for (const fixture of ADVANCEMENT_SIGNAL_FIXTURES) {
      const action = buildReviewRequiredActionFromFixture(fixture);
      if (!action) continue;
      expect(safeVerbs).toContain(action.actionType);
    }
  });

  it("derives review action deterministically", () => {
    const a = ADVANCEMENT_SIGNAL_FIXTURES.map(buildReviewRequiredActionFromFixture);
    const b = [...ADVANCEMENT_SIGNAL_FIXTURES]
      .reverse()
      .map(buildReviewRequiredActionFromFixture)
      .reverse();
    expect(a).toEqual(b);
  });
});
