/**
 * lib/agent-runtime/agent-run-store-mysql.ts — durable AgentRunStore (Tier 1.1, "一切之母").
 *
 * The in-memory AgentRunStore (run-store.ts) is the reference impl + honest default; this is
 * the DURABLE backing the AgentOS review (P-C / Tier 1.1) called the foundation: until runs
 * persist across process/request boundaries, the observability readout (Tier 2.4) and the
 * cockpit live-read stay honest-empty. This makes them real.
 *
 * Mirrors the established durable-store pattern (MysqlNpaSeatOpsRepository): raw
 * $queryRawUnsafe/$executeRawUnsafe, find-then-insert idempotency, and a duplicate-key race
 * on the unique index degrades to a dedupe read — the same stepId NEVER produces two rows.
 * Two tables: agent_runs (per-run lifecycle, insertion order) + agent_run_steps (append-only
 * steps, unique on (workspace_id, step_id)). Workspace-scoped on every query.
 *
 * Reference-only: only ids / enums / reference tokens are persisted (the loop already forbids
 * inline content in argsRef/resultRef/reasonCode/observationRef) — no PII, no raw values.
 * Schema lives in agent-run-store-schema.sql (migration); this repo assumes the tables exist.
 */

import { db } from "@/lib/db";
import type {
  AgentLifecycleState,
  AgentDecision,
  AgentStep,
  AgentToolResult,
} from "@/lib/agent-runtime/agent-loop";
import {
  registerAgentRunStore,
  type AgentRunRecord,
  type AgentRunStore,
  type AppendAgentStepInput,
} from "@/lib/agent-runtime/run-store";

function sanitizeTableIdentifier(raw: string): string {
  if (!/^[a-z][a-z0-9_]*$/.test(raw)) {
    throw new Error(`unsafe agent-run table identifier: ${raw}`);
  }
  return raw;
}

/** Table names, tenant-prefixed + backtick-quoted (identifier injection-safe). */
export function buildAgentRunTableNames(
  tenantKey = process.env.AGENT_RUN_STORE_TABLE_TENANT_KEY ?? "helm",
): { runs: string; steps: string } {
  return {
    runs: `\`${sanitizeTableIdentifier(`${tenantKey}_agent_runs`)}\``,
    steps: `\`${sanitizeTableIdentifier(`${tenantKey}_agent_run_steps`)}\``,
  };
}

type RawRunRow = { lifecycle: string };
type RawStepRow = {
  step_index: number;
  step_id: string;
  decision_kind: string;
  tool_name: string | null;
  decision_ref: string | null;
  tool_status: string | null;
  observation_ref: string | null;
  error_code: string | null;
  state: string;
};

function decisionToColumns(decision: AgentDecision): {
  kind: string;
  toolName: string | null;
  ref: string | null;
} {
  if (decision.kind === "call_tool") return { kind: "call_tool", toolName: decision.toolName, ref: decision.argsRef };
  if (decision.kind === "finish") return { kind: "finish", toolName: null, ref: decision.resultRef ?? null };
  return { kind: "await_review", toolName: null, ref: decision.reasonCode };
}

function rowToStep(row: RawStepRow): AgentStep {
  let decision: AgentDecision;
  if (row.decision_kind === "call_tool") {
    decision = { kind: "call_tool", toolName: row.tool_name ?? "", argsRef: row.decision_ref ?? "" };
  } else if (row.decision_kind === "await_review") {
    decision = { kind: "await_review", reasonCode: row.decision_ref ?? "" };
  } else {
    decision = row.decision_ref ? { kind: "finish", resultRef: row.decision_ref } : { kind: "finish" };
  }
  const toolResult: AgentToolResult | undefined = row.tool_status
    ? {
        status: row.tool_status === "error" ? "error" : "ok",
        observationRef: row.observation_ref ?? "",
        ...(row.error_code ? { errorCode: row.error_code } : {}),
      }
    : undefined;
  return Object.freeze({
    index: Number(row.step_index),
    stepId: row.step_id,
    decision,
    ...(toolResult ? { toolResult } : {}),
    state: row.state as AgentLifecycleState,
  });
}

export class MysqlAgentRunStore implements AgentRunStore {
  constructor(
    private readonly client: Pick<typeof db, "$queryRawUnsafe" | "$executeRawUnsafe"> = db,
    private readonly tables = buildAgentRunTableNames(),
  ) {}

  private async readRunLifecycle(workspaceId: string, agentRunId: string): Promise<string | null> {
    const rows = await this.client.$queryRawUnsafe<RawRunRow[]>(
      `SELECT lifecycle FROM ${this.tables.runs} WHERE workspace_id = ? AND agent_run_id = ? LIMIT 1`,
      workspaceId,
      agentRunId,
    );
    return rows[0]?.lifecycle ?? null;
  }

  private async readSteps(workspaceId: string, agentRunId: string): Promise<AgentStep[]> {
    const rows = await this.client.$queryRawUnsafe<RawStepRow[]>(
      `SELECT step_index, step_id, decision_kind, tool_name, decision_ref, tool_status, observation_ref, error_code, state
       FROM ${this.tables.steps} WHERE workspace_id = ? AND agent_run_id = ? ORDER BY step_index ASC`,
      workspaceId,
      agentRunId,
    );
    return rows.map(rowToStep);
  }

  async appendStep(input: AppendAgentStepInput): Promise<AgentRunRecord> {
    if (!input.workspaceId || !input.agentRunId) {
      throw new Error("agent run store requires workspaceId and agentRunId");
    }
    if (!input.step?.stepId) throw new Error("agent run store requires a step with a stepId");

    // 1) upsert the run lifecycle (insert on first sight, else advance lifecycle).
    const existingLifecycle = await this.readRunLifecycle(input.workspaceId, input.agentRunId);
    if (existingLifecycle === null) {
      try {
        await this.client.$executeRawUnsafe(
          `INSERT INTO ${this.tables.runs} (workspace_id, agent_run_id, lifecycle) VALUES (?,?,?)`,
          input.workspaceId,
          input.agentRunId,
          input.lifecycle,
        );
      } catch {
        // concurrent first-insert race on unique (workspace_id, agent_run_id) → fall through to update
        await this.client.$executeRawUnsafe(
          `UPDATE ${this.tables.runs} SET lifecycle = ? WHERE workspace_id = ? AND agent_run_id = ?`,
          input.lifecycle,
          input.workspaceId,
          input.agentRunId,
        );
      }
    } else {
      await this.client.$executeRawUnsafe(
        `UPDATE ${this.tables.runs} SET lifecycle = ? WHERE workspace_id = ? AND agent_run_id = ?`,
        input.lifecycle,
        input.workspaceId,
        input.agentRunId,
      );
    }

    // 2) append the step, idempotent on (workspace_id, step_id).
    const stepExists = await this.client.$queryRawUnsafe<{ step_id: string }[]>(
      `SELECT step_id FROM ${this.tables.steps} WHERE workspace_id = ? AND step_id = ? LIMIT 1`,
      input.workspaceId,
      input.step.stepId,
    );
    if (!stepExists[0]) {
      const cols = decisionToColumns(input.step.decision);
      const tr = input.step.toolResult;
      try {
        await this.client.$executeRawUnsafe(
          `INSERT INTO ${this.tables.steps} (
            workspace_id, agent_run_id, step_id, step_index, decision_kind, tool_name,
            decision_ref, tool_status, observation_ref, error_code, state
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
          input.workspaceId,
          input.agentRunId,
          input.step.stepId,
          input.step.index,
          cols.kind,
          cols.toolName,
          cols.ref,
          tr?.status ?? null,
          tr?.observationRef ?? null,
          tr?.errorCode ?? null,
          input.step.state,
        );
      } catch {
        // duplicate-key race on (workspace_id, step_id): another writer won — keep the survivor.
      }
    }

    const record = await this.getRun(input.workspaceId, input.agentRunId);
    if (!record) throw new Error("agent run store: run vanished immediately after append");
    return record;
  }

  async getRun(workspaceId: string, agentRunId: string): Promise<AgentRunRecord | null> {
    const lifecycle = await this.readRunLifecycle(workspaceId, agentRunId);
    if (lifecycle === null) return null;
    const steps = await this.readSteps(workspaceId, agentRunId);
    return Object.freeze({ agentRunId, workspaceId, lifecycle: lifecycle as AgentLifecycleState, steps: Object.freeze(steps) });
  }

  async listRuns(workspaceId: string): Promise<readonly AgentRunRecord[]> {
    const rows = await this.client.$queryRawUnsafe<{ agent_run_id: string }[]>(
      `SELECT agent_run_id FROM ${this.tables.runs} WHERE workspace_id = ? ORDER BY seq ASC`,
      workspaceId,
    );
    const records: AgentRunRecord[] = [];
    for (const row of rows) {
      const record = await this.getRun(workspaceId, row.agent_run_id);
      if (record) records.push(record);
    }
    return records;
  }
}

/**
 * Bind the durable MySQL store as the active AgentRunStore (the activation seam — call from
 * composition once the schema is migrated). After this, persistAgentRunResult / the worker-run
 * convergence bridge write durably, and the observability readout / cockpit read real runs.
 */
export function registerMysqlAgentRunStore(
  store: MysqlAgentRunStore = new MysqlAgentRunStore(),
): AgentRunStore {
  return registerAgentRunStore(store);
}
