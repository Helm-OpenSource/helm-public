import { afterEach, describe, expect, it } from "vitest";

import {
  buildSequencePlanner,
  registerAgentTool,
  resetAgentToolsForTest,
  runAgentLoop,
} from "@/lib/agent-runtime/agent-loop";
import { buildWorkspaceRunReadout } from "@/lib/agent-runtime/run-observability";
import {
  InMemoryAgentRunStore,
  getAgentRunStore,
  registerAgentRunStore,
  resetAgentRunStoreForTest,
} from "@/lib/agent-runtime/run-store";
import { persistAgentRunResult } from "@/lib/agent-runtime/run-persistence";

const ctx = { agentRunId: "run:triage:w1:0001", workspaceId: "w1", maxSteps: 8 };

afterEach(() => {
  resetAgentToolsForTest();
  resetAgentRunStoreForTest();
});

describe("persistAgentRunResult (Tier 1.1↔1.2↔2.4 pipeline)", () => {
  it("persists a completed run end-to-end so the observability readout sees it", async () => {
    registerAgentTool({ name: "read_ctx", riskLevel: "read", invoke: () => ({ status: "ok", observationRef: "obs:1" }) });
    const result = await runAgentLoop({
      ctx,
      plan: buildSequencePlanner([
        { kind: "call_tool", toolName: "read_ctx", argsRef: "args:1" },
        { kind: "finish", resultRef: "result:done" },
      ]),
    });
    expect(result.finalState).toBe("completed");

    const store = new InMemoryAgentRunStore();
    registerAgentRunStore(store);
    const record = await persistAgentRunResult({ result, workspaceId: "w1", store });

    expect(record?.lifecycle).toBe("completed");
    expect(record?.steps).toHaveLength(2);

    // 2.4 readout now reflects a REAL run, not an empty stub.
    const readout = await buildWorkspaceRunReadout("w1");
    expect(readout.totalRuns).toBe(1);
    expect(readout.byLifecycle.completed).toBe(1);
  });

  it("reconciles a terminal lifecycle no single step carries (max_steps_exceeded → failed)", async () => {
    registerAgentTool({ name: "read_ctx", riskLevel: "read", invoke: () => ({ status: "ok", observationRef: "obs:x" }) });
    const result = await runAgentLoop({
      ctx: { ...ctx, maxSteps: 2 },
      plan: () => ({ kind: "call_tool", toolName: "read_ctx", argsRef: "args:loop" }),
    });
    expect(result.finalState).toBe("failed");
    expect(result.steps.every((s) => s.state === "observing")).toBe(true); // no step is "failed"

    const store = new InMemoryAgentRunStore();
    registerAgentRunStore(store);
    const record = await persistAgentRunResult({ result, workspaceId: "w1", store });
    expect(record?.lifecycle).toBe("failed"); // reconciled to the loop's authoritative finalState
    expect(record?.steps).toHaveLength(2); // idempotent re-append did not duplicate
  });

  it("surfaces an awaiting_review run in the readout attention queue", async () => {
    registerAgentTool({ name: "commit", riskLevel: "repo_write", invoke: () => ({ status: "ok", observationRef: "obs:c" }) });
    const result = await runAgentLoop({
      ctx,
      plan: () => ({ kind: "call_tool", toolName: "commit", argsRef: "args:diff" }),
    });
    expect(result.finalState).toBe("awaiting_review");

    registerAgentRunStore(new InMemoryAgentRunStore());
    await persistAgentRunResult({ result, workspaceId: "w1" }); // default store via getAgentRunStore()

    const readout = await buildWorkspaceRunReadout("w1");
    expect(readout.attention.map((a) => a.agentRunId)).toContain("run:triage:w1:0001");
    expect(readout.attention[0].lifecycle).toBe("awaiting_review");
  });

  it("is idempotent: re-persisting the same run does not duplicate steps", async () => {
    registerAgentTool({ name: "read_ctx", riskLevel: "read", invoke: () => ({ status: "ok", observationRef: "obs:1" }) });
    const result = await runAgentLoop({ ctx, plan: buildSequencePlanner([{ kind: "finish" }]) });
    const store = new InMemoryAgentRunStore();
    registerAgentRunStore(store);
    await persistAgentRunResult({ result, workspaceId: "w1", store });
    const record = await persistAgentRunResult({ result, workspaceId: "w1", store });
    expect(record?.steps).toHaveLength(1);
    expect((await getAgentRunStore().listRuns("w1"))).toHaveLength(1);
  });

  it("uses result.workspaceId as the single source of truth (no param needed)", async () => {
    const result = await runAgentLoop({ ctx, plan: buildSequencePlanner([{ kind: "finish" }]) });
    expect(result.workspaceId).toBe("w1"); // carried from ctx
    const store = new InMemoryAgentRunStore();
    registerAgentRunStore(store);
    const record = await persistAgentRunResult({ result, store }); // no workspaceId param
    expect(record?.workspaceId).toBe("w1");
  });

  it("tenant-isolation guard: a w1 run cannot be persisted to w2 (fail-closed)", async () => {
    const result = await runAgentLoop({ ctx, plan: buildSequencePlanner([{ kind: "finish" }]) });
    expect(result.workspaceId).toBe("w1");
    await expect(persistAgentRunResult({ result, workspaceId: "w2" })).rejects.toThrow(/tenant mismatch/);
    // and the w2 store must stay empty — nothing leaked across the tenant boundary
    const w2store = new InMemoryAgentRunStore();
    registerAgentRunStore(w2store);
    await persistAgentRunResult({ result, workspaceId: "w2" }).catch(() => {});
    expect(await buildWorkspaceRunReadout("w2")).toMatchObject({ totalRuns: 0 });
  });
});
