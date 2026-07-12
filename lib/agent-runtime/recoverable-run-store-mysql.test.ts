import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import type { AgentStep } from "@/lib/agent-runtime/agent-loop";
import {
  buildRecoverableAgentRunTableNames,
  MysqlRecoverableAgentRunStore,
} from "@/lib/agent-runtime/recoverable-run-store-mysql";
import {
  InMemoryRecoverableAgentRunStore,
  type RecoverableAgentRunStore,
} from "@/lib/agent-runtime/recoverable-run-store";

type Row = Record<string, unknown>;

function fakeTransactionalClient() {
  const runs: Row[] = [];
  const steps: Row[] = [];
  const attempts: Row[] = [];
  let runSeq = 0;
  let attemptSeq = 0;
  let transactionCalls = 0;

  const client = {
    runs,
    steps,
    attempts,
    get transactionCalls() {
      return transactionCalls;
    },
    async $transaction<T>(callback: (transaction: typeof client) => Promise<T>) {
      transactionCalls += 1;
      return callback(client);
    },
    async $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T> {
      if (
        query.includes("lease_owner_ref") &&
        query.includes("FROM `helm_agent_runs`")
      ) {
        return runs.filter(
          (row) =>
            row.workspace_id === values[0] && row.agent_run_id === values[1],
        ) as T;
      }
      if (
        query.includes("SELECT lifecycle FROM `helm_agent_runs`")
      ) {
        return runs
          .filter(
            (row) =>
              row.workspace_id === values[0] && row.agent_run_id === values[1],
          )
          .map((row) => ({ lifecycle: row.lifecycle })) as T;
      }
      if (query.includes("agent_run_id FROM `helm_agent_runs`")) {
        return runs
          .filter((row) => row.workspace_id === values[0])
          .sort((left, right) => Number(left.seq) - Number(right.seq))
          .map((row) => ({ agent_run_id: row.agent_run_id })) as T;
      }
      if (query.includes("FROM `helm_agent_run_attempts`")) {
        const scoped = attempts
          .filter(
            (row) =>
              row.workspace_id === values[0] && row.agent_run_id === values[1],
          )
          .sort((left, right) => Number(left.seq) - Number(right.seq));
        return (query.includes("operation_ref = ?")
          ? scoped.filter((row) => row.operation_ref === values[2])
          : scoped) as T;
      }
      if (
        query.includes("step_id FROM `helm_agent_run_steps`") &&
        query.includes("LIMIT 1")
      ) {
        return steps.filter(
          (row) =>
            row.workspace_id === values[0] &&
            row.agent_run_id === values[1] &&
            row.step_id === values[2],
        ) as T;
      }
      if (query.includes("FROM `helm_agent_run_steps`")) {
        return steps
          .filter(
            (row) =>
              row.workspace_id === values[0] && row.agent_run_id === values[1],
          )
          .sort(
            (left, right) => Number(left.step_index) - Number(right.step_index),
          ) as T;
      }
      throw new Error(`unhandled fake query: ${query}`);
    },
    async $executeRawUnsafe(query: string, ...values: unknown[]): Promise<unknown> {
      const run = (workspaceId: unknown, agentRunId: unknown) =>
        runs.find(
          (row) =>
            row.workspace_id === workspaceId && row.agent_run_id === agentRunId,
        );

      if (query.includes("recoverable:ensure-run")) {
        runs.push({
          seq: runSeq++,
          workspace_id: values[0],
          agent_run_id: values[1],
          lifecycle: values[2],
          lease_owner_ref: null,
          lease_acquired_at_ms: null,
          lease_heartbeat_at_ms: null,
          lease_expires_at_ms: null,
          fencing_epoch: 0,
          cancel_requested_by_ref: null,
          cancel_reason_code: null,
          cancel_requested_at_ms: null,
          checkpoint_ref: null,
          checkpoint_next_step_index: null,
          checkpoint_lifecycle: null,
          checkpoint_written_at_ms: null,
          checkpoint_fencing_epoch: null,
        });
        return 1;
      }
      if (query.includes("recoverable:acquire-lease")) {
        const row = run(values[5], values[6]);
        if (!row) return 0;
        row.lease_owner_ref = values[0];
        row.lease_acquired_at_ms = values[1];
        row.lease_heartbeat_at_ms = values[2];
        row.lease_expires_at_ms = values[3];
        row.fencing_epoch = values[4];
        return 1;
      }
      if (query.includes("recoverable:heartbeat-lease")) {
        const row = run(values[2], values[3]);
        if (!row) return 0;
        row.lease_heartbeat_at_ms = values[0];
        row.lease_expires_at_ms = values[1];
        return 1;
      }
      if (query.includes("recoverable:release-lease")) {
        const row = run(values[0], values[1]);
        if (!row) return 0;
        row.lease_owner_ref = null;
        row.lease_acquired_at_ms = null;
        row.lease_heartbeat_at_ms = null;
        row.lease_expires_at_ms = null;
        return 1;
      }
      if (query.includes("recoverable:request-cancel")) {
        const row = run(values[3], values[4]);
        if (!row) return 0;
        row.cancel_requested_by_ref = values[0];
        row.cancel_reason_code = values[1];
        row.cancel_requested_at_ms = values[2];
        return 1;
      }
      if (query.includes("recoverable:insert-attempt")) {
        attempts.push({
          seq: attemptSeq++,
          workspace_id: values[0],
          agent_run_id: values[1],
          operation_ref: values[2],
          attempt_kind: values[3],
          attempt_count: values[4],
          last_reserved_at_ms: values[5],
        });
        return 1;
      }
      if (query.includes("recoverable:update-attempt")) {
        const row = attempts.find(
          (candidate) =>
            candidate.workspace_id === values[2] &&
            candidate.agent_run_id === values[3] &&
            candidate.operation_ref === values[4],
        );
        if (!row) return 0;
        row.attempt_count = values[0];
        row.last_reserved_at_ms = values[1];
        return 1;
      }
      if (query.includes("recoverable:stamp-step-fence")) {
        const row = steps.find(
          (candidate) =>
            candidate.workspace_id === values[1] &&
            candidate.agent_run_id === values[2] &&
            candidate.step_id === values[3],
        );
        if (!row) return 0;
        row.fencing_epoch ??= values[0];
        return 1;
      }
      if (query.includes("recoverable:set-lifecycle")) {
        const row = run(values[1], values[2]);
        if (!row) return 0;
        row.lifecycle = values[0];
        return 1;
      }
      if (query.includes("recoverable:write-checkpoint")) {
        const row = run(values[6], values[7]);
        if (!row) return 0;
        row.checkpoint_ref = values[0];
        row.checkpoint_next_step_index = values[1];
        row.checkpoint_lifecycle = values[2];
        row.checkpoint_written_at_ms = values[3];
        row.checkpoint_fencing_epoch = values[4];
        row.lifecycle = values[5];
        return 1;
      }

      if (query.includes("INSERT INTO `helm_agent_runs`")) {
        runs.push({
          seq: runSeq++,
          workspace_id: values[0],
          agent_run_id: values[1],
          lifecycle: values[2],
          lease_owner_ref: null,
          lease_acquired_at_ms: null,
          lease_heartbeat_at_ms: null,
          lease_expires_at_ms: null,
          fencing_epoch: 0,
          cancel_requested_by_ref: null,
          cancel_reason_code: null,
          cancel_requested_at_ms: null,
          checkpoint_ref: null,
          checkpoint_next_step_index: null,
          checkpoint_lifecycle: null,
          checkpoint_written_at_ms: null,
          checkpoint_fencing_epoch: null,
        });
        return 1;
      }
      if (query.includes("UPDATE `helm_agent_runs` SET lifecycle")) {
        const row = run(values[1], values[2]);
        if (!row) return 0;
        row.lifecycle = values[0];
        return 1;
      }
      if (query.includes("INSERT INTO `helm_agent_run_steps`")) {
        steps.push({
          workspace_id: values[0],
          agent_run_id: values[1],
          step_id: values[2],
          step_index: values[3],
          decision_kind: values[4],
          tool_name: values[5],
          decision_ref: values[6],
          tool_status: values[7],
          observation_ref: values[8],
          error_code: values[9],
          state: values[10],
          fencing_epoch: null,
        });
        return 1;
      }
      throw new Error(`unhandled fake execute: ${query}`);
    },
  };
  return client;
}

const workspaceId = "workspace:one";
const agentRunId = "run:mysql:recoverable";
const baseTime = Date.parse("2026-07-12T00:00:00.000Z");

function at(milliseconds: number): string {
  return new Date(baseTime + milliseconds).toISOString();
}

function step(observationRef = "obs:one"): AgentStep {
  return {
    index: 0,
    stepId: `step:${agentRunId}:0`,
    decision: {
      kind: "call_tool",
      toolName: "read_ctx",
      argsRef: "args:one",
    },
    toolResult: { status: "ok", observationRef },
    state: "observing",
  };
}

async function exerciseStore(store: RecoverableAgentRunStore) {
  const first = await store.acquireLease({
    workspaceId,
    agentRunId,
    workerRef: "worker:first",
    now: at(0),
  });
  if (!first.acquired) throw new Error("expected first lease");
  const contender = await store.acquireLease({
    workspaceId,
    agentRunId,
    workerRef: "worker:contender",
    now: at(1_000),
  });
  await store.heartbeatLease({ handle: first.handle, now: at(20_000) });
  await store.reserveAttempt({
    handle: first.handle,
    now: at(21_000),
    operationRef: "planner:step:0",
    kind: "model",
  });
  await store.appendStepWithLease({
    handle: first.handle,
    now: at(22_000),
    lifecycle: "observing",
    step: step(),
  });
  await store.writeCheckpoint({
    handle: first.handle,
    now: at(23_000),
    checkpointRef: `checkpoint:${agentRunId}:1:observing`,
    nextStepIndex: 1,
    lifecycle: "observing",
  });
  await store.requestCancellation({
    workspaceId,
    agentRunId,
    requestedByRef: "operator:one",
    reasonCode: "operator_requested",
    now: at(24_000),
  });
  const takeover = await store.acquireLease({
    workspaceId,
    agentRunId,
    workerRef: "worker:replacement",
    now: at(81_000),
  });
  if (!takeover.acquired) throw new Error("expected replacement lease");
  let staleRejected = false;
  try {
    await store.appendStepWithLease({
      handle: first.handle,
      now: at(81_001),
      lifecycle: "observing",
      step: step("obs:stale"),
    });
  } catch {
    staleRejected = true;
  }
  const run = await store.getRun(workspaceId, agentRunId);
  const recovery = await store.getRecoveryState(workspaceId, agentRunId);
  return {
    contenderAcquired: contender.acquired,
    takeoverEpoch: takeover.handle.fencingEpoch,
    staleRejected,
    run: run
      ? {
          lifecycle: run.lifecycle,
          steps: run.steps,
        }
      : null,
    recovery: recovery
      ? {
          lifecycle: recovery.lifecycle,
          lease: recovery.lease,
          fencingEpoch: recovery.fencingEpoch,
          cancellation: recovery.cancellation,
          checkpoint: recovery.checkpoint,
          attempts: recovery.attempts,
        }
      : null,
  };
}

describe("MysqlRecoverableAgentRunStore", () => {
  it("matches the in-memory recoverable contract under lease takeover", async () => {
    const client = fakeTransactionalClient();
    const mysql = await exerciseStore(
      new MysqlRecoverableAgentRunStore(client as never),
    );
    const memory = await exerciseStore(new InMemoryRecoverableAgentRunStore());
    expect(mysql).toEqual(memory);
    expect(client.transactionCalls).toBeGreaterThan(0);
    expect(client.steps[0]?.fencing_epoch).toBe(1);
  });

  it("rejects a conflicting idempotency replay inside the fenced transaction", async () => {
    const client = fakeTransactionalClient();
    const store = new MysqlRecoverableAgentRunStore(client as never);
    const acquired = await store.acquireLease({
      workspaceId,
      agentRunId,
      workerRef: "worker:first",
      now: at(0),
    });
    if (!acquired.acquired) throw new Error("expected lease");
    await store.appendStepWithLease({
      handle: acquired.handle,
      now: at(1_000),
      lifecycle: "observing",
      step: step(),
    });
    await expect(
      store.appendStepWithLease({
        handle: acquired.handle,
        now: at(2_000),
        lifecycle: "observing",
        step: step("obs:conflict"),
      }),
    ).rejects.toThrow(/conflicting step/i);
    expect(client.steps).toHaveLength(1);
  });

  it("sanitizes table names and ships fresh plus upgrade schema", () => {
    expect(buildRecoverableAgentRunTableNames("helm")).toEqual({
      runs: "`helm_agent_runs`",
      steps: "`helm_agent_run_steps`",
      attempts: "`helm_agent_run_attempts`",
    });
    expect(() => buildRecoverableAgentRunTableNames("bad;drop")).toThrow(/unsafe/);
    const fresh = readFileSync(
      "lib/agent-runtime/agent-run-store-schema.sql",
      "utf8",
    );
    const migration = readFileSync(
      "lib/agent-runtime/agent-run-store-recoverable-migration.sql",
      "utf8",
    );
    for (const marker of [
      "lease_owner_ref",
      "lease_expires_at_ms",
      "fencing_epoch",
      "checkpoint_ref",
      "cancel_requested_by_ref",
      "agent_run_attempts",
    ]) {
      expect(fresh).toContain(marker);
      expect(migration).toContain(marker);
    }
  });

  it("fails closed on partial lease and unknown persisted enums", async () => {
    const client = fakeTransactionalClient();
    const store = new MysqlRecoverableAgentRunStore(client as never);
    const acquired = await store.acquireLease({
      workspaceId,
      agentRunId,
      workerRef: "worker:first",
      now: at(0),
    });
    if (!acquired.acquired) throw new Error("expected lease");
    const row = client.runs[0];

    row.lease_expires_at_ms = null;
    await expect(
      store.acquireLease({
        workspaceId,
        agentRunId,
        workerRef: "worker:second",
        now: at(61_000),
      }),
    ).rejects.toThrow(/corrupt recoverable agent lease/i);

    row.lease_owner_ref = null;
    row.lease_acquired_at_ms = null;
    row.lease_heartbeat_at_ms = null;
    row.lifecycle = "unknown_state";
    await expect(store.getRecoveryState(workspaceId, agentRunId)).rejects.toThrow(
      /lifecycle/i,
    );

    row.lifecycle = "created";
    client.attempts.push({
      seq: 1,
      workspace_id: workspaceId,
      agent_run_id: agentRunId,
      operation_ref: "planner:step:0",
      attempt_kind: "side_effect",
      attempt_count: 1,
      last_reserved_at_ms: baseTime,
    });
    await expect(store.getRecoveryState(workspaceId, agentRunId)).rejects.toThrow(
      /attempt row/i,
    );
  });
});
