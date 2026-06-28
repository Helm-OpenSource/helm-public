/**
 * lib/agent-runtime/run-persistence.ts — wire the supervised loop to the durable store.
 *
 * Until now the agent-runtime primitives were isolated seams: runAgentLoop (Tier 1.2)
 * produced steps in memory and returned them, the AgentRunStore (Tier 1.1) sat empty
 * because nothing wrote to it, and buildWorkspaceRunReadout (Tier 2.4) therefore always
 * read nothing. The substrate was built but inert — no run was ever durable or queryable.
 *
 * This is the bridge that energizes the read side of the pipeline: persist a completed
 * AgentLoopResult into the run store so the observability readout reflects REAL runs. It
 * is the only place loop→store coupling lives, keeping runAgentLoop itself side-effect free.
 *
 * Append is idempotent on stepId (the store guarantees it), so re-persisting a run is safe
 * (at-least-once). The terminal lifecycle is reconciled even when the last recorded step's
 * state differs from the loop's finalState (e.g. max_steps_exceeded leaves the last step at
 * "observing" but the run failed).
 */

import type { AgentLoopResult } from "@/lib/agent-runtime/agent-loop";
import {
  getAgentRunStore,
  type AgentRunRecord,
  type AgentRunStore,
} from "@/lib/agent-runtime/run-store";

export async function persistAgentRunResult(input: {
  result: AgentLoopResult;
  workspaceId: string;
  store?: AgentRunStore;
}): Promise<AgentRunRecord | null> {
  const { result, workspaceId } = input;
  if (!workspaceId) throw new Error("persistAgentRunResult requires a workspaceId");
  if (!result?.agentRunId) throw new Error("persistAgentRunResult requires a result with an agentRunId");
  const store = input.store ?? getAgentRunStore();

  let record: AgentRunRecord | null = null;
  for (const step of result.steps) {
    record = await store.appendStep({
      agentRunId: result.agentRunId,
      workspaceId,
      lifecycle: step.state,
      step,
    });
  }

  // Reconcile the terminal lifecycle: a run can end in a state no single step carries
  // (max_steps_exceeded → failed). Re-append the last step (idempotent on stepId, so no
  // duplicate) to advance the record's lifecycle to the loop's authoritative finalState.
  if (record && result.steps.length > 0 && record.lifecycle !== result.finalState) {
    record = await store.appendStep({
      agentRunId: result.agentRunId,
      workspaceId,
      lifecycle: result.finalState,
      step: result.steps[result.steps.length - 1],
    });
  }

  return record;
}
