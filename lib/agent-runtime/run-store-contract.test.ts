import { describe, expect, it } from "vitest";

import type { AgentStep } from "@/lib/agent-runtime/agent-loop";
import { InMemoryAgentRunStore, type AgentRunStore } from "@/lib/agent-runtime/run-store";
import { MysqlAgentRunStore } from "@/lib/agent-runtime/agent-run-store-mysql";

// Cycle-3 contract-parity gap (sweep finding): InMemoryAgentRunStore and MysqlAgentRunStore
// were each tested in isolation, but nothing proved they honor the SAME AgentRunStore
// contract. This runs an identical operation sequence through both and asserts equivalent
// observable results — the guard against the two impls silently diverging (e.g. the
// idempotency-scope divergence Codex caught earlier).

// Minimal fake Prisma client simulating the two tables (same shape as agent-run-store-mysql.test.ts).
function fakeClient() {
  const runs: Record<string, unknown>[] = [];
  const steps: Record<string, unknown>[] = [];
  let runSeq = 0;
  return {
    async $queryRawUnsafe<T = unknown>(query: string, ...v: unknown[]): Promise<T> {
      if (query.includes("FROM `helm_agent_runs`") && query.includes("lifecycle")) {
        return runs.filter((r) => r.workspace_id === v[0] && r.agent_run_id === v[1]) as T;
      }
      if (query.includes("agent_run_id FROM `helm_agent_runs`")) {
        return runs.filter((r) => r.workspace_id === v[0]) as T;
      }
      if (query.includes("step_id FROM `helm_agent_run_steps`") && query.includes("LIMIT 1")) {
        return steps.filter((r) => r.workspace_id === v[0] && r.agent_run_id === v[1] && r.step_id === v[2]) as T;
      }
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

const step = (runId: string, index: number, over: Partial<AgentStep> = {}): AgentStep => ({
  index,
  stepId: `step:${runId}:${index}`,
  decision: { kind: "call_tool", toolName: "read_ctx", argsRef: `args:${runId}:${index}` },
  toolResult: { status: "ok", observationRef: `obs:${runId}:${index}` },
  state: "observing",
  ...over,
});

// One identical sequence exercised against any AgentRunStore; returns a normalized snapshot.
async function runSequence(store: AgentRunStore) {
  // run r1 in w1: two steps, lifecycle advances to completed
  await store.appendStep({ agentRunId: "r1", workspaceId: "w1", lifecycle: "observing", step: step("r1", 0) });
  await store.appendStep({ agentRunId: "r1", workspaceId: "w1", lifecycle: "completed", step: step("r1", 1) });
  // idempotent re-append of r1 step 0 (must not duplicate)
  await store.appendStep({ agentRunId: "r1", workspaceId: "w1", lifecycle: "completed", step: step("r1", 0) });
  // run r2 in w1 reusing the SAME literal stepId pattern as r1 (per-run scope: must persist)
  await store.appendStep({ agentRunId: "r2", workspaceId: "w1", lifecycle: "awaiting_review", step: { ...step("r2", 0), stepId: "step:r1:0" } });
  // a different workspace must stay isolated
  await store.appendStep({ agentRunId: "r1", workspaceId: "w2", lifecycle: "observing", step: step("r1", 0) });

  const w1List = await store.listRuns("w1");
  const w2List = await store.listRuns("w2");
  const r1 = await store.getRun("w1", "r1");
  const missing = await store.getRun("w1", "ghost");
  return {
    w1Runs: w1List.map((r) => ({ id: r.agentRunId, lifecycle: r.lifecycle, steps: r.steps.length })),
    w2Runs: w2List.map((r) => ({ id: r.agentRunId, lifecycle: r.lifecycle, steps: r.steps.length })),
    r1Steps: r1?.steps.map((s) => ({ index: s.index, stepId: s.stepId })) ?? null,
    missingIsNull: missing === null,
  };
}

describe("AgentRunStore contract parity (Cycle-3)", () => {
  it("InMemory and Mysql produce equivalent observable results for the same sequence", async () => {
    const inMemory = await runSequence(new InMemoryAgentRunStore());
    const mysql = await runSequence(new MysqlAgentRunStore(fakeClient()));
    expect(mysql).toEqual(inMemory);
  });

  it("the equivalence covers the contract-critical invariants (anchored, not just mutual)", async () => {
    const snap = await runSequence(new InMemoryAgentRunStore());
    // r1 deduped to 2 steps; r2 persisted despite reusing r1's literal stepId (per-run scope)
    expect(snap.w1Runs).toEqual([
      { id: "r1", lifecycle: "completed", steps: 2 },
      { id: "r2", lifecycle: "awaiting_review", steps: 1 },
    ]);
    // workspace isolation: w2 has its own r1
    expect(snap.w2Runs).toEqual([{ id: "r1", lifecycle: "observing", steps: 1 }]);
    expect(snap.missingIsNull).toBe(true);
  });
});
