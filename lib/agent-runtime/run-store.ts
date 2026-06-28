/**
 * lib/agent-runtime/run-store.ts — durable agent-run state store seam (Tier 1.1 / P-C).
 *
 * The AgentOS review (P-C) found Helm has no durable runtime state: ActionIntent /
 * WorkerObservationEvent / agent runs never persist (worker-modes is type-only), so there
 * is no single "what is happening / why" view and nothing for an observability console to
 * read. The supervised loop (Tier 1.2, agent-loop.ts) now PRODUCES a typed run record per
 * step; this is the seam that lets a host PERSIST and QUERY it.
 *
 * Seam pattern (consistent with event-bus / outbox): an AgentRunStore interface + an
 * in-memory default + register/get/reset so a host can swap a Prisma/durable store. The
 * pack's Prisma blueprint (GOVERNED_EXECUTION_RUNTIME_STATE_STORE_BLUEPRINT_V1) binds the
 * real implementation; Core only owns the contract + an honest in-memory default. PURELY
 * ADDITIVE — nothing in Core calls it until something records a run.
 *
 * Safety rails match the rest of Helm: append-only step log keyed by deterministic
 * (workspaceId, agentRunId); idempotent appends (same stepId is a no-op, never a
 * duplicate); workspace-scoped reads; reference-only payloads already enforced upstream by
 * the loop. No wall-clock, no UUID minted here.
 */

import type { AgentLifecycleState, AgentStep } from "@/lib/agent-runtime/agent-loop";

export type AgentRunRecord = Readonly<{
  agentRunId: string;
  workspaceId: string;
  lifecycle: AgentLifecycleState;
  steps: readonly AgentStep[];
}>;

export type AppendAgentStepInput = Readonly<{
  agentRunId: string;
  workspaceId: string;
  lifecycle: AgentLifecycleState;
  step: AgentStep;
}>;

export interface AgentRunStore {
  /** Append one step to a run (creating the run on first append). Idempotent on stepId. */
  appendStep(input: AppendAgentStepInput): Promise<AgentRunRecord>;
  /** Load a run within a workspace, or null when absent (honest — never fabricated). */
  getRun(workspaceId: string, agentRunId: string): Promise<AgentRunRecord | null>;
  /** List runs in a workspace, ordered by first-seen. */
  listRuns(workspaceId: string): Promise<readonly AgentRunRecord[]>;
}

function runKey(workspaceId: string, agentRunId: string): string {
  return `${workspaceId}::${agentRunId}`;
}

/**
 * In-process append-only store. A run is keyed by (workspaceId, agentRunId); appends are
 * idempotent on stepId so an at-least-once writer never duplicates a step. Insertion order
 * is preserved for both steps and runs.
 */
export class InMemoryAgentRunStore implements AgentRunStore {
  private readonly runs = new Map<string, { record: AgentRunRecord; stepIds: Set<string>; order: number }>();
  private nextOrder = 0;

  async appendStep(input: AppendAgentStepInput): Promise<AgentRunRecord> {
    if (!input.workspaceId || !input.agentRunId) {
      throw new Error("agent run store requires workspaceId and agentRunId");
    }
    if (!input.step?.stepId) throw new Error("agent run store requires a step with a stepId");
    const key = runKey(input.workspaceId, input.agentRunId);
    const existing = this.runs.get(key);
    if (!existing) {
      const record: AgentRunRecord = Object.freeze({
        agentRunId: input.agentRunId,
        workspaceId: input.workspaceId,
        lifecycle: input.lifecycle,
        steps: Object.freeze([input.step]),
      });
      this.runs.set(key, { record, stepIds: new Set([input.step.stepId]), order: this.nextOrder++ });
      return record;
    }
    if (existing.stepIds.has(input.step.stepId)) {
      // idempotent: same step id already recorded — advance lifecycle only, no duplicate.
      const record = Object.freeze({ ...existing.record, lifecycle: input.lifecycle });
      existing.record = record;
      return record;
    }
    existing.stepIds.add(input.step.stepId);
    const record: AgentRunRecord = Object.freeze({
      agentRunId: existing.record.agentRunId,
      workspaceId: existing.record.workspaceId,
      lifecycle: input.lifecycle,
      steps: Object.freeze([...existing.record.steps, input.step]),
    });
    existing.record = record;
    return record;
  }

  async getRun(workspaceId: string, agentRunId: string): Promise<AgentRunRecord | null> {
    return this.runs.get(runKey(workspaceId, agentRunId))?.record ?? null;
  }

  async listRuns(workspaceId: string): Promise<readonly AgentRunRecord[]> {
    return [...this.runs.values()]
      .filter((entry) => entry.record.workspaceId === workspaceId)
      .sort((a, b) => a.order - b.order)
      .map((entry) => entry.record);
  }
}

// --- registration seam: host can swap a durable/Prisma-backed store -------------

let activeStore: AgentRunStore = new InMemoryAgentRunStore();

export function registerAgentRunStore(store: AgentRunStore): AgentRunStore {
  const previous = activeStore;
  activeStore = store;
  return previous;
}

export function getAgentRunStore(): AgentRunStore {
  return activeStore;
}

export function resetAgentRunStoreForTest(): void {
  activeStore = new InMemoryAgentRunStore();
}
