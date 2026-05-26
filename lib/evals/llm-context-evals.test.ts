import { describe, expect, it } from "vitest";
import {
  runLLMContextEval,
  type LLMContextEvalFixturePack,
} from "@/lib/evals/llm-context-evals";

describe("LLM context eval", () => {
  it("passes the checked-in context quality fixture pack", () => {
    const summary = runLLMContextEval();

    expect(summary.passed).toBe(true);
    expect(summary.totalCases).toBe(6);
    expect(summary.readyCases).toBe(summary.expectedReadyCases);
    expect(summary.averageReadyScore).toBeGreaterThanOrEqual(80);
    expect(summary.decisiveness.every((item) => item.passed)).toBe(true);
  });

  it("fails when a ready case loses its required business context", () => {
    const fixture = {
      version: "broken",
      status: "offline_evaluation_fixture",
      redactionPosture: "synthetic",
      boundary: "test-only",
      targets: {
        minimumReadyScore: 80,
        maximumReadyFailures: 0,
        minimumDecisiveScoreDelta: 25,
      },
      decisivenessPairs: [],
      cases: [
        {
          id: "BROKEN-READY-CONTEXT",
          promptBuilder: "briefing",
          taskType: "OPPORTUNITY_BRIEFING",
          expectedReady: true,
          input: {
            objectType: "OPPORTUNITY",
            objectLabel: "Atlas AI 续约",
            currentStage: null,
            recentFacts: [],
            openCommitments: [],
            activeBlockers: [],
            recentMeetings: [],
            recentThreads: [],
          },
          requirements: [
            {
              id: "advancement_evidence",
              description: "must include advancement evidence",
              markers: ["客户要求 5 月 8 日前确认安全审查材料", "法务 DPA 尚未确认"],
              minMatches: 1,
            },
          ],
        },
      ],
    } satisfies LLMContextEvalFixturePack;

    const summary = runLLMContextEval(fixture);

    expect(summary.passed).toBe(false);
    expect(summary.failures).toContainEqual({
      caseId: "BROKEN-READY-CONTEXT",
      reason: "readiness_expectation_mismatch",
    });
    expect(summary.failures).toContainEqual({
      caseId: "BROKEN-READY-CONTEXT",
      reason: "missing_required_context:advancement_evidence",
    });
  });
});
