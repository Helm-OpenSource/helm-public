import { describe, expect, it } from "vitest";
import {
  buildMemoryEvalCategorySummary,
  countDuplicateMemoryEvalCandidates,
  countDuplicateMemoryEvalFacts,
  runMemoryDistillationCandidateEval,
  type MemoryCaseResult,
} from "@/lib/evals/memory-evals";

function result(overrides: Partial<MemoryCaseResult>): MemoryCaseResult {
  return {
    id: "case-1",
    meetingTitle: "Meeting",
    passed: true,
    factHits: 1,
    factTotal: 1,
    commitmentHits: 1,
    commitmentTotal: 1,
    blockerHits: 0,
    blockerTotal: 0,
    missingFacts: [],
    missingCommitments: [],
    missingBlockers: [],
    misattributedFacts: [],
    misattributedCommitments: [],
    misattributedBlockers: [],
    duplicateFacts: 0,
    duplicateCommitments: 0,
    duplicateBlockers: 0,
    ...overrides,
  };
}

describe("memory eval categories", () => {
  it("counts normalized duplicate memory candidates", () => {
    expect(
      countDuplicateMemoryEvalCandidates([
        "Send proposal draft",
        "send   proposal draft",
        "发送 方案 初稿",
        "发送方案初稿",
      ]),
    ).toBe(2);
  });

  it("ignores aggregate meeting summary facts when counting duplicates", () => {
    expect(
      countDuplicateMemoryEvalFacts([
        { title: "Q1销售会议摘要", content: "overview of Q1" },
        { title: "Q1销售会议摘要", content: "overview of Q1" },
        { title: "某次会议摘要", content: "another summary" },
        { title: null, content: null, normalizedValue: JSON.stringify({ meetingId: "m1", contactIds: ["c1"] }) },
        { title: null, content: null, normalizedValue: JSON.stringify({ meetingId: "m2", opportunityId: "o1" }) },
      ]),
    ).toBe(0);
  });

  it("counts true granular duplicate facts", () => {
    expect(
      countDuplicateMemoryEvalFacts([
        { title: "Send proposal", content: "send proposal draft" },
        { title: "Send proposal", content: "send proposal draft" },
        { title: "Follow up", content: "follow up on contract" },
      ]),
    ).toBe(1);
  });

  it("separates relevance, attribution stability, and duplicate / omission failures", () => {
    const summary = buildMemoryEvalCategorySummary([
      result({ id: "clean" }),
      result({
        id: "missing",
        passed: false,
        missingFacts: ["customer payment cycle"],
      }),
      result({
        id: "misattributed",
        passed: false,
        misattributedCommitments: ["send draft"],
      }),
      result({
        id: "duplicate",
        passed: false,
        duplicateFacts: 1,
      }),
    ]);

    expect(summary).toEqual([
      {
        id: "relevance",
        label: "Expected memory relevance",
        passedCases: 3,
        totalCases: 4,
        passRate: 75,
        failedCaseIds: ["missing"],
      },
      {
        id: "stability",
        label: "Attribution stability",
        passedCases: 3,
        totalCases: 4,
        passRate: 75,
        failedCaseIds: ["misattributed"],
      },
      {
        id: "duplicate_omission",
        label: "Duplicate / omission guard",
        passedCases: 2,
        totalCases: 4,
        passRate: 50,
        failedCaseIds: ["missing", "duplicate"],
      },
    ]);
  });
});

describe("runMemoryDistillationCandidateEval", () => {
  it("returns a summary with at least 3 cases", () => {
    const summary = runMemoryDistillationCandidateEval();
    expect(summary.totalCases).toBeGreaterThanOrEqual(3);
  });

  it("all fixture cases pass", () => {
    const summary = runMemoryDistillationCandidateEval();
    expect(summary.passedCases).toBe(summary.totalCases);
    expect(summary.passRate).toBe(100);
    for (const c of summary.cases) {
      expect(c.passed, `case ${c.id} should pass but failedReason: ${c.failedReason ?? "none"}`).toBe(true);
    }
  });

  it("repeated-facts case produces 1 candidate and 0 omitted", () => {
    const summary = runMemoryDistillationCandidateEval();
    const c = summary.cases.find((x) => x.id === "repeated-facts-candidate");
    expect(c).toBeDefined();
    expect(c!.candidateCount).toBe(1);
    expect(c!.omittedCount).toBe(0);
    expect(c!.missingBoundarySnippets).toHaveLength(0);
  });

  it("unique-fact case produces 0 candidates and 0 omitted", () => {
    const summary = runMemoryDistillationCandidateEval();
    const c = summary.cases.find((x) => x.id === "unique-fact-no-candidate");
    expect(c).toBeDefined();
    expect(c!.candidateCount).toBe(0);
    expect(c!.omittedCount).toBe(0);
  });

  it("prior-reject case produces 0 candidates and 1 omitted with rejected_by_review", () => {
    const summary = runMemoryDistillationCandidateEval();
    const c = summary.cases.find((x) => x.id === "prior-reject-omits-candidate");
    expect(c).toBeDefined();
    expect(c!.candidateCount).toBe(0);
    expect(c!.omittedCount).toBe(1);
  });

  it("prior-defer case produces 0 candidates and 1 omitted with deferred_by_review", () => {
    const summary = runMemoryDistillationCandidateEval();
    const c = summary.cases.find((x) => x.id === "prior-defer-omits-candidate");
    expect(c).toBeDefined();
    expect(c!.candidateCount).toBe(0);
    expect(c!.omittedCount).toBe(1);
  });

  it("summary shape includes totalCases, passedCases, passRate, and cases array", () => {
    const summary = runMemoryDistillationCandidateEval();
    expect(typeof summary.totalCases).toBe("number");
    expect(typeof summary.passedCases).toBe("number");
    expect(typeof summary.passRate).toBe("number");
    expect(Array.isArray(summary.cases)).toBe(true);
    for (const c of summary.cases) {
      expect(typeof c.id).toBe("string");
      expect(typeof c.passed).toBe("boolean");
      expect(typeof c.candidateCount).toBe("number");
      expect(typeof c.omittedCount).toBe("number");
      expect(Array.isArray(c.missingBoundarySnippets)).toBe(true);
    }
  });
});
