import { describe, expect, it } from "vitest";

import type { AgentStep } from "@/lib/agent-runtime/agent-loop";
import { buildAgentRunTableNames, MysqlAgentRunStore } from "@/lib/agent-runtime/agent-run-store-mysql";

// Fake Prisma client simulating the two tables via in-memory rows + substring-matched SQL,
// mirroring the MysqlNpaSeatOpsRepository test pattern. Enough to exercise the repo's
// find-then-insert idempotency, lifecycle upsert, ordering, and AgentStep round-trip.
function fakeClient() {
  const runs: Record<string, unknown>[] = [];
  const steps: Record<string, unknown>[] = [];
  let runSeq = 0;
  return {
    runs,
    steps,
    async $queryRawUnsafe<T = unknown>(query: string, ...v: unknown[]): Promise<T> {
      if (query.includes("FROM `helm_agent_runs`") && query.includes("lifecycle")) {
        return runs.filter((r) => r.workspace_id === v[0] && r.agent_run_id === v[1]) as T;
      }
      if (query.includes("agent_run_id FROM `helm_agent_runs`")) {
        return runs.filter((r) => r.workspace_id === v[0]) as T; // already in insertion order
      }
      if (query.includes("step_id FROM `helm_agent_run_steps`") && query.includes("LIMIT 1")) {
        return steps.filter((r) => r.workspace_id === v[0] && r.step_id === v[1]) as T;
      }
      // read steps for a run, ordered by index
      return steps
        .filter((r) => r.workspace_id === v[0] && r.agent_run_id === v[1])
        .sort((a, b) => Number(a.step_index) - Number(b.step_index)) as T;
    },
    async $executeRawUnsafe(query: string, ...v: unknown[]): Promise<unknown> {
      if (query.includes("INSERT INTO `helm_agent_runs`")) {
        runs.push({ seq: runSeq++, workspace_id: v[0], agent_run_id: v[1], lifecycle: v[2] });
      } else if (query.includes("UPDATE `helm_agent_runs`")) {
        for (const r of runs) if (r.workspace_id === v[1] && r.agent_run_id === v[2]) r.lifecycle = v[0];
      } else if (query.includes("INSERT INTO `helm_agent_run_steps`")) {
        steps.push({
          workspace_id: v[0], agent_run_id: v[1], step_id: v[2], step_index: v[3], decision_kind: v[4],
          tool_name: v[5], decision_ref: v[6], tool_status: v[7], observation_ref: v[8], error_code: v[9], state: v[10],
        });
      }
      return 1;
    },
  };
}

const step = (index: number, over: Partial<AgentStep> = {}): AgentStep => ({
  index,
  stepId: `step:run:w1:${index}`,
  decision: { kind: "call_tool", toolName: "read_ctx", argsRef: `args:${index}` },
  toolResult: { status: "ok", observationRef: `obs:${index}` },
  state: "observing",
  ...over,
});

describe("MysqlAgentRunStore (Tier 1.1 durable)", () => {
  it("uses sanitized, tenant-prefixed table names", () => {
    expect(buildAgentRunTableNames("helm")).toEqual({ runs: "`helm_agent_runs`", steps: "`helm_agent_run_steps`" });
    expect(() => buildAgentRunTableNames("bad name; DROP")).toThrow(/unsafe/);
  });

  it("creates a run on first append and appends steps in order, advancing lifecycle", async () => {
    const c = fakeClient();
    const store = new MysqlAgentRunStore(c);
    await store.appendStep({ agentRunId: "r1", workspaceId: "w1", lifecycle: "observing", step: step(0) });
    const rec = await store.appendStep({ agentRunId: "r1", workspaceId: "w1", lifecycle: "completed", step: step(1) });
    expect(rec.steps.map((s) => s.index)).toEqual([0, 1]);
    expect(rec.lifecycle).toBe("completed");
    expect(c.runs).toHaveLength(1); // one run row, lifecycle updated in place
  });

  it("is idempotent on stepId (re-append does not duplicate)", async () => {
    const c = fakeClient();
    const store = new MysqlAgentRunStore(c);
    await store.appendStep({ agentRunId: "r1", workspaceId: "w1", lifecycle: "observing", step: step(0) });
    const rec = await store.appendStep({ agentRunId: "r1", workspaceId: "w1", lifecycle: "completed", step: step(0) });
    expect(rec.steps).toHaveLength(1);
    expect(rec.lifecycle).toBe("completed"); // lifecycle still advances
    expect(c.steps).toHaveLength(1);
  });

  it("round-trips all decision kinds + toolResult faithfully", async () => {
    const c = fakeClient();
    const store = new MysqlAgentRunStore(c);
    await store.appendStep({ agentRunId: "r1", workspaceId: "w1", lifecycle: "observing", step: step(0) });
    await store.appendStep({
      agentRunId: "r1", workspaceId: "w1", lifecycle: "awaiting_review",
      step: { index: 1, stepId: "step:run:w1:1", decision: { kind: "await_review", reasonCode: "needs_human" }, state: "awaiting_review" },
    });
    await store.appendStep({
      agentRunId: "r1", workspaceId: "w1", lifecycle: "completed",
      step: { index: 2, stepId: "step:run:w1:2", decision: { kind: "finish", resultRef: "result:done" }, state: "completed" },
    });
    const rec = await store.getRun("w1", "r1");
    expect(rec?.steps[0].decision).toEqual({ kind: "call_tool", toolName: "read_ctx", argsRef: "args:0" });
    expect(rec?.steps[0].toolResult).toEqual({ status: "ok", observationRef: "obs:0" });
    expect(rec?.steps[1].decision).toEqual({ kind: "await_review", reasonCode: "needs_human" });
    expect(rec?.steps[1].toolResult).toBeUndefined();
    expect(rec?.steps[2].decision).toEqual({ kind: "finish", resultRef: "result:done" });
  });

  it("scopes reads by workspace; absent run → null", async () => {
    const c = fakeClient();
    const store = new MysqlAgentRunStore(c);
    await store.appendStep({ agentRunId: "r1", workspaceId: "w1", lifecycle: "observing", step: step(0) });
    await store.appendStep({ agentRunId: "r2", workspaceId: "w2", lifecycle: "observing", step: step(0) });
    expect((await store.listRuns("w1")).map((r) => r.agentRunId)).toEqual(["r1"]);
    expect(await store.getRun("w2", "r1")).toBeNull();
  });

  it("fails closed on missing workspaceId / agentRunId / stepId", async () => {
    const store = new MysqlAgentRunStore(fakeClient());
    await expect(store.appendStep({ agentRunId: "", workspaceId: "w1", lifecycle: "observing", step: step(0) })).rejects.toThrow();
    await expect(
      store.appendStep({ agentRunId: "r1", workspaceId: "w1", lifecycle: "observing", step: { ...step(0), stepId: "" } }),
    ).rejects.toThrow();
  });
});
