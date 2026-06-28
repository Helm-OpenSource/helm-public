import { afterEach, describe, expect, it } from "vitest";

import type { AgentStep } from "@/lib/agent-runtime/agent-loop";
import {
  InMemoryAgentRunStore,
  getAgentRunStore,
  registerAgentRunStore,
  resetAgentRunStoreForTest,
} from "@/lib/agent-runtime/run-store";

function step(index: number): AgentStep {
  return {
    index,
    stepId: `step:run:w1:0001:${index}`,
    decision: { kind: "call_tool", toolName: "read_ctx", argsRef: `args:${index}` },
    toolResult: { status: "ok", observationRef: `obs:${index}` },
    state: "observing",
  };
}

afterEach(() => resetAgentRunStoreForTest());

describe("InMemoryAgentRunStore (Tier 1.1)", () => {
  it("creates a run on first append and appends subsequent steps in order", async () => {
    const store = new InMemoryAgentRunStore();
    await store.appendStep({ agentRunId: "r1", workspaceId: "w1", lifecycle: "observing", step: step(0) });
    const rec = await store.appendStep({ agentRunId: "r1", workspaceId: "w1", lifecycle: "deciding", step: step(1) });
    expect(rec.steps.map((s) => s.index)).toEqual([0, 1]);
    expect(rec.lifecycle).toBe("deciding");
  });

  it("is idempotent on stepId (at-least-once writer never duplicates a step)", async () => {
    const store = new InMemoryAgentRunStore();
    await store.appendStep({ agentRunId: "r1", workspaceId: "w1", lifecycle: "observing", step: step(0) });
    const rec = await store.appendStep({ agentRunId: "r1", workspaceId: "w1", lifecycle: "completed", step: step(0) });
    expect(rec.steps).toHaveLength(1);
    expect(rec.lifecycle).toBe("completed"); // lifecycle still advances
  });

  it("returns null for an absent run (honest, never fabricated)", async () => {
    const store = new InMemoryAgentRunStore();
    expect(await store.getRun("w1", "ghost")).toBeNull();
  });

  it("scopes reads by workspace", async () => {
    const store = new InMemoryAgentRunStore();
    await store.appendStep({ agentRunId: "r1", workspaceId: "w1", lifecycle: "observing", step: step(0) });
    await store.appendStep({ agentRunId: "r2", workspaceId: "w2", lifecycle: "observing", step: step(0) });
    expect((await store.listRuns("w1")).map((r) => r.agentRunId)).toEqual(["r1"]);
    expect(await store.getRun("w2", "r1")).toBeNull();
  });

  it("requires workspaceId, agentRunId, and a stepId", async () => {
    const store = new InMemoryAgentRunStore();
    await expect(store.appendStep({ agentRunId: "", workspaceId: "w1", lifecycle: "observing", step: step(0) })).rejects.toThrow();
    await expect(
      store.appendStep({ agentRunId: "r1", workspaceId: "w1", lifecycle: "observing", step: { ...step(0), stepId: "" } }),
    ).rejects.toThrow();
  });

  it("register/get seam swaps the active store and resets honestly", async () => {
    const custom = new InMemoryAgentRunStore();
    const previous = registerAgentRunStore(custom);
    expect(getAgentRunStore()).toBe(custom);
    registerAgentRunStore(previous);
    resetAgentRunStoreForTest();
    expect(getAgentRunStore()).not.toBe(custom);
  });
});
