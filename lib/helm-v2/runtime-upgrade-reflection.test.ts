import { describe, expect, it } from "vitest";

import {
  buildPromotedRuntimeFacts,
  buildReflectionJobOutputSummary,
  buildReflectionMemoryCandidateContract,
  isReflectionMemoryCandidate,
} from "@/lib/helm-v2/runtime-upgrade-reflection";

const notebookState = {
  objective: "Preserve verified follow-through",
  confirmedFacts: ["Owner confirmed the next step"],
  blockers: ["External send remains approval-gated"],
  nextActions: ["Prepare a review packet"],
  evidenceRefs: ["evidence://meeting/1"],
};

describe("runtime upgrade reflection", () => {
  it("builds review-first reflection output and candidate contracts", () => {
    const output = buildReflectionJobOutputSummary({
      meetingLabel: "Weekly review",
      notebookState,
    });
    const candidate = buildReflectionMemoryCandidateContract({
      meetingLabel: "Weekly review",
      notebookState,
    });

    expect(output).toContain("Weekly review");
    expect(output).toContain("does not auto-promote memory");
    expect(candidate.status).toBe("VERIFIED");
    expect(JSON.parse(candidate.evidenceRefs)).toEqual(["evidence://meeting/1"]);
    expect(isReflectionMemoryCandidate(candidate)).toBe(true);
  });

  it("returns promoted facts from direct and persisted promotion states", () => {
    expect(
      buildPromotedRuntimeFacts(
        [
          { id: "direct", status: "PROMOTED", summary: "Direct", evidenceRefs: ["e1"] },
          { id: "linked", status: "VERIFIED", summary: "Linked", evidenceRefs: '["e2"]' },
          { id: "pending", status: "VERIFIED", summary: "Pending", evidenceRefs: null },
        ],
        [{ memoryCandidateId: "linked", status: "PROMOTED" }],
      ),
    ).toEqual([
      { summary: "Direct", evidenceRefs: ["e1"] },
      { summary: "Linked", evidenceRefs: ["e2"] },
    ]);
  });

  it("fails closed to empty evidence refs when persisted JSON is invalid", () => {
    expect(
      buildPromotedRuntimeFacts([
        {
          id: "invalid-json",
          status: "PROMOTED",
          summary: "Still promoted",
          evidenceRefs: "not-json",
        },
      ]),
    ).toEqual([{ summary: "Still promoted", evidenceRefs: [] }]);
  });

  it("keeps reflection output and candidate summaries within their limits", () => {
    const longNotebookState = {
      ...notebookState,
      objective: "x".repeat(700),
    };
    const output = buildReflectionJobOutputSummary({
      meetingLabel: "Long review",
      notebookState: longNotebookState,
    });
    const candidate = buildReflectionMemoryCandidateContract({
      meetingLabel: "Long review",
      notebookState: longNotebookState,
    });

    expect(output).toHaveLength(503);
    expect(output).toMatch(/\.\.\.$/);
    expect(candidate.summary).toHaveLength(423);
    expect(candidate.summary).toMatch(/\.\.\.$/);
  });
});
