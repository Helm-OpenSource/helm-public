import { afterEach, describe, expect, it } from "vitest";

import type { AgentStep } from "@/lib/agent-runtime/agent-loop";
import {
  buildWorkspaceRunReadout,
  summarizeAgentRuns,
} from "@/lib/agent-runtime/run-observability";
import { InMemoryAgentRunStore, registerAgentRunStore, resetAgentRunStoreForTest } from "@/lib/agent-runtime/run-store";
import type { AgentRunRecord } from "@/lib/agent-runtime/run-store";

function step(index: number): AgentStep {
  return {
    index,
    stepId: `step:r:w1:${index}`,
    decision: { kind: "call_tool", toolName: "read_ctx", argsRef: `args:${index}` },
    state: "observing",
  };
}

function run(id: string, lifecycle: AgentRunRecord["lifecycle"], steps: AgentStep[]): AgentRunRecord {
  return { agentRunId: id, workspaceId: "w1", lifecycle, steps };
}

afterEach(() => resetAgentRunStoreForTest());

describe("summarizeAgentRuns (Tier 2.4)", () => {
  it("counts runs by lifecycle and surfaces attention runs with their last step", () => {
    const summary = summarizeAgentRuns("w1", [
      run("r1", "completed", [step(0), step(1)]),
      run("r2", "awaiting_review", [step(0)]),
      run("r3", "blocked", [step(0)]),
      run("r4", "failed", [step(0), step(1), step(2)]),
      run("r5", "completed", [step(0)]),
    ]);
    expect(summary.totalRuns).toBe(5);
    expect(summary.byLifecycle.completed).toBe(2);
    expect(summary.byLifecycle.awaiting_review).toBe(1);
    expect(summary.byLifecycle.blocked).toBe(1);
    expect(summary.byLifecycle.failed).toBe(1);
    expect(summary.byLifecycle.deciding).toBe(0);

    expect(summary.attention.map((a) => a.agentRunId)).toEqual(["r2", "r3", "r4"]);
    const failed = summary.attention.find((a) => a.agentRunId === "r4");
    expect(failed?.lifecycle).toBe("failed");
    expect(failed?.lastStepId).toBe("step:r:w1:2");
    expect(failed?.stepCount).toBe(3);
  });

  it("is honest on an empty workspace", () => {
    const summary = summarizeAgentRuns("w1", []);
    expect(summary.totalRuns).toBe(0);
    expect(summary.attention).toEqual([]);
    expect(Object.values(summary.byLifecycle).every((n) => n === 0)).toBe(true);
  });

  it("reports a null lastStepId when an attention run has no steps", () => {
    const summary = summarizeAgentRuns("w1", [run("r1", "blocked", [])]);
    expect(summary.attention[0].lastStepId).toBeNull();
    expect(summary.attention[0].stepCount).toBe(0);
  });
});

describe("buildWorkspaceRunReadout (Tier 2.4 live)", () => {
  it("projects the real registered store, scoped to the workspace", async () => {
    const store = new InMemoryAgentRunStore();
    await store.appendStep({ agentRunId: "r1", workspaceId: "w1", lifecycle: "awaiting_review", step: step(0) });
    await store.appendStep({ agentRunId: "r2", workspaceId: "w2", lifecycle: "completed", step: step(0) });
    registerAgentRunStore(store);

    const readout = await buildWorkspaceRunReadout("w1");
    expect(readout.totalRuns).toBe(1);
    expect(readout.attention.map((a) => a.agentRunId)).toEqual(["r1"]);
  });

  it("requires a workspaceId", async () => {
    await expect(buildWorkspaceRunReadout("")).rejects.toThrow(/workspaceId/);
  });
});
