/**
 * lib/agent-runtime/run-observability.ts — live "what is running / why" readout (Tier 2.4 / P-C).
 *
 * The AgentOS review (P-C / 2.4) found Helm has no single view of what is happening at
 * runtime and why: state was fragmented and the gate/governance read-models had no real
 * store to read. With the durable run store (Tier 1.1, run-store.ts) now holding every
 * supervised-loop run (Tier 1.2), this is the observability projection over it — the
 * console keystone, reading the REAL store rather than an honest-empty stub.
 *
 * Pure summarizer (summarizeAgentRuns) + a live builder (buildWorkspaceRunReadout) that
 * pulls from the registered AgentRunStore. Surfaces the operationally important slice: how
 * many runs sit in each lifecycle state, and which runs NEED ATTENTION (awaiting_review /
 * blocked / failed) with their last recorded step. Deterministic, workspace-scoped,
 * reference-only (it only echoes ids the loop already minted — no PII, no wall clock).
 */

import {
  AGENT_LIFECYCLE_STATES,
  type AgentLifecycleState,
} from "@/lib/agent-runtime/agent-loop";
import { getAgentRunStore, type AgentRunRecord } from "@/lib/agent-runtime/run-store";

/** Lifecycle states that an operator must look at (a human gate or a failure). */
const ATTENTION_STATES: ReadonlySet<AgentLifecycleState> = new Set([
  "awaiting_review",
  "blocked",
  "failed",
]);

export type AgentRunAttentionItem = Readonly<{
  agentRunId: string;
  lifecycle: AgentLifecycleState;
  /** Id of the last recorded step (a reference, never inline content). */
  lastStepId: string | null;
  stepCount: number;
}>;

export type AgentRunsSummary = Readonly<{
  workspaceId: string;
  totalRuns: number;
  byLifecycle: Readonly<Record<AgentLifecycleState, number>>;
  /** Runs needing a human (awaiting_review) or signalling a failure (blocked/failed). */
  attention: readonly AgentRunAttentionItem[];
}>;

function emptyByLifecycle(): Record<AgentLifecycleState, number> {
  const counts = {} as Record<AgentLifecycleState, number>;
  for (const state of AGENT_LIFECYCLE_STATES) counts[state] = 0;
  return counts;
}

/** Pure: summarize a set of runs (already scoped to one workspace). */
export function summarizeAgentRuns(
  workspaceId: string,
  runs: readonly AgentRunRecord[],
): AgentRunsSummary {
  const byLifecycle = emptyByLifecycle();
  const attention: AgentRunAttentionItem[] = [];
  for (const run of runs) {
    byLifecycle[run.lifecycle] += 1;
    if (ATTENTION_STATES.has(run.lifecycle)) {
      const lastStep = run.steps[run.steps.length - 1];
      attention.push({
        agentRunId: run.agentRunId,
        lifecycle: run.lifecycle,
        lastStepId: lastStep ? lastStep.stepId : null,
        stepCount: run.steps.length,
      });
    }
  }
  return Object.freeze({
    workspaceId,
    totalRuns: runs.length,
    byLifecycle: Object.freeze(byLifecycle),
    attention: Object.freeze(attention),
  });
}

/** Live: build the run readout for a workspace from the registered store. */
export async function buildWorkspaceRunReadout(workspaceId: string): Promise<AgentRunsSummary> {
  if (!workspaceId) throw new Error("run readout requires a workspaceId");
  const runs = await getAgentRunStore().listRuns(workspaceId);
  return summarizeAgentRuns(workspaceId, runs);
}
