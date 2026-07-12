import { isDeepStrictEqual } from "node:util";

import { db } from "@/lib/db";
import {
  isAgentLifecycleState,
  isTerminalAgentState,
  type AgentLifecycleState,
  type AgentStep,
} from "@/lib/agent-runtime/agent-loop";
import {
  MysqlAgentRunStore,
  buildAgentRunTableNames,
} from "@/lib/agent-runtime/agent-run-store-mysql";
import {
  AGENT_RUN_LEASE_DURATION_MS,
  AGENT_RUN_MAX_ATTEMPTS,
  AgentRunAttemptLimitError,
  StaleAgentRunLeaseError,
  type AgentRunAttempt,
  type AgentRunAttemptKind,
  type AgentRunCancellation,
  type AgentRunCheckpoint,
  type AgentRunLease,
  type AgentRunLeaseAcquisition,
  type AgentRunLeaseHandle,
  type AgentRunRecoveryState,
  type RecoverableAgentRunStore,
} from "@/lib/agent-runtime/recoverable-run-store";
import {
  registerAgentRunStore,
  type AgentRunRecord,
  type AgentRunStore,
  type AppendAgentStepInput,
} from "@/lib/agent-runtime/run-store";

type SqlExecutor = {
  $queryRawUnsafe<T = unknown>(
    query: string,
    ...values: unknown[]
  ): Promise<T>;
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<unknown>;
};

type TransactionalSqlExecutor = SqlExecutor & {
  $transaction<T>(callback: (transaction: SqlExecutor) => Promise<T>): Promise<T>;
};

export type MysqlRecoverableAgentRunTableNames = Readonly<{
  runs: string;
  steps: string;
  attempts: string;
}>;

type ControlRow = {
  lifecycle: string;
  lease_owner_ref: string | null;
  lease_acquired_at_ms: number | bigint | null;
  lease_heartbeat_at_ms: number | bigint | null;
  lease_expires_at_ms: number | bigint | null;
  fencing_epoch: number | bigint;
  cancel_requested_by_ref: string | null;
  cancel_reason_code: string | null;
  cancel_requested_at_ms: number | bigint | null;
  checkpoint_ref: string | null;
  checkpoint_next_step_index: number | null;
  checkpoint_lifecycle: string | null;
  checkpoint_written_at_ms: number | bigint | null;
  checkpoint_fencing_epoch: number | bigint | null;
};

type AttemptRow = {
  operation_ref: string;
  attempt_kind: string;
  attempt_count: number;
  last_reserved_at_ms: number | bigint;
};

function sanitizeTableIdentifier(raw: string): string {
  if (!/^[a-z][a-z0-9_]*$/.test(raw)) {
    throw new Error(`unsafe recoverable agent-run table identifier: ${raw}`);
  }
  return raw;
}

export function buildRecoverableAgentRunTableNames(
  tenantKey = process.env.AGENT_RUN_STORE_TABLE_TENANT_KEY ?? "helm",
): MysqlRecoverableAgentRunTableNames {
  const base = buildAgentRunTableNames(tenantKey);
  return Object.freeze({
    ...base,
    attempts: `\`${sanitizeTableIdentifier(`${tenantKey}_agent_run_attempts`)}\``,
  });
}

function assertReference(name: string, value: string): void {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > 256 ||
    /\s/.test(value)
  ) {
    throw new Error(`recoverable agent run requires a reference-only ${name}`);
  }
}

function timestampMs(name: string, value: string): number {
  const parsed = Date.parse(value);
  if (
    !Number.isFinite(parsed) ||
    !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value)
  ) {
    throw new Error(`recoverable agent run requires an ISO timestamp for ${name}`);
  }
  return parsed;
}

function timestamp(value: number | bigint | null): string | null {
  if (value === null) return null;
  return new Date(Number(value)).toISOString();
}

function numeric(value: number | bigint | null): number {
  return value === null ? 0 : Number(value);
}

function sameStep(left: AgentStep, right: AgentStep): boolean {
  return isDeepStrictEqual(left, right);
}

function rowLease(row: ControlRow): AgentRunLease | null {
  const acquiredAt = timestamp(row.lease_acquired_at_ms);
  const heartbeatAt = timestamp(row.lease_heartbeat_at_ms);
  const expiresAt = timestamp(row.lease_expires_at_ms);
  const populated = [
    row.lease_owner_ref,
    row.lease_acquired_at_ms,
    row.lease_heartbeat_at_ms,
    row.lease_expires_at_ms,
  ].filter((value) => value !== null).length;
  if (populated === 0) {
    return null;
  }
  if (
    populated !== 4 ||
    !row.lease_owner_ref ||
    !acquiredAt ||
    !heartbeatAt ||
    !expiresAt
  ) {
    throw new Error("corrupt recoverable agent lease row");
  }
  const fencingEpoch = numeric(row.fencing_epoch);
  if (!Number.isSafeInteger(fencingEpoch) || fencingEpoch < 1) {
    throw new Error("corrupt recoverable agent fencing epoch");
  }
  return Object.freeze({
    workerRef: row.lease_owner_ref,
    fencingEpoch,
    acquiredAt,
    heartbeatAt,
    expiresAt,
  });
}

function rowCancellation(row: ControlRow): AgentRunCancellation | null {
  const requestedAt = timestamp(row.cancel_requested_at_ms);
  const populated = [
    row.cancel_requested_by_ref,
    row.cancel_reason_code,
    row.cancel_requested_at_ms,
  ].filter((value) => value !== null).length;
  if (populated === 0) {
    return null;
  }
  if (
    populated !== 3 ||
    !row.cancel_requested_by_ref ||
    !row.cancel_reason_code ||
    !requestedAt
  ) {
    throw new Error("corrupt recoverable agent cancellation row");
  }
  return Object.freeze({
    requestedByRef: row.cancel_requested_by_ref,
    reasonCode: row.cancel_reason_code,
    requestedAt,
  });
}

function rowCheckpoint(row: ControlRow): AgentRunCheckpoint | null {
  const writtenAt = timestamp(row.checkpoint_written_at_ms);
  const populated = [
    row.checkpoint_ref,
    row.checkpoint_next_step_index,
    row.checkpoint_lifecycle,
    row.checkpoint_written_at_ms,
    row.checkpoint_fencing_epoch,
  ].filter((value) => value !== null).length;
  if (populated === 0) {
    return null;
  }
  if (
    populated !== 5 ||
    !row.checkpoint_ref ||
    row.checkpoint_next_step_index === null ||
    !isAgentLifecycleState(row.checkpoint_lifecycle) ||
    !writtenAt ||
    row.checkpoint_fencing_epoch === null ||
    !Number.isInteger(Number(row.checkpoint_next_step_index)) ||
    Number(row.checkpoint_next_step_index) < 0
  ) {
    throw new Error("corrupt recoverable agent checkpoint row");
  }
  return Object.freeze({
    checkpointRef: row.checkpoint_ref,
    nextStepIndex: Number(row.checkpoint_next_step_index),
    lifecycle: row.checkpoint_lifecycle,
    writtenAt,
    fencingEpoch: numeric(row.checkpoint_fencing_epoch),
  });
}

function sameLease(
  row: ControlRow,
  handle: AgentRunLeaseHandle,
  nowMs: number,
): boolean {
  return (
    row.lease_owner_ref === handle.workerRef &&
    numeric(row.fencing_epoch) === handle.fencingEpoch &&
    row.lease_expires_at_ms !== null &&
    nowMs < numeric(row.lease_expires_at_ms)
  );
}

function isDuplicateKeyError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    /duplicate entry/i.test(message) ||
    /\b1062\b/.test(message) ||
    /unique constraint/i.test(message) ||
    /\bP2002\b/.test(message)
  );
}

export class MysqlRecoverableAgentRunStore
  implements RecoverableAgentRunStore
{
  private readonly base: MysqlAgentRunStore;

  constructor(
    private readonly client: TransactionalSqlExecutor = db as unknown as TransactionalSqlExecutor,
    private readonly tables: MysqlRecoverableAgentRunTableNames =
      buildRecoverableAgentRunTableNames(),
  ) {
    this.base = new MysqlAgentRunStore(client as never, {
      runs: tables.runs,
      steps: tables.steps,
    });
  }

  private async readControl(
    executor: SqlExecutor,
    workspaceId: string,
    agentRunId: string,
    lock = false,
  ): Promise<ControlRow | null> {
    const rows = await executor.$queryRawUnsafe<ControlRow[]>(
      `SELECT lifecycle, lease_owner_ref, lease_acquired_at_ms, lease_heartbeat_at_ms,
              lease_expires_at_ms, fencing_epoch, cancel_requested_by_ref,
              cancel_reason_code, cancel_requested_at_ms, checkpoint_ref,
              checkpoint_next_step_index, checkpoint_lifecycle,
              checkpoint_written_at_ms, checkpoint_fencing_epoch
       FROM ${this.tables.runs}
       WHERE workspace_id = ? AND agent_run_id = ? LIMIT 1${lock ? " FOR UPDATE" : ""}`,
      workspaceId,
      agentRunId,
    );
    return rows[0] ?? null;
  }

  private async ensureRun(
    executor: SqlExecutor,
    workspaceId: string,
    agentRunId: string,
  ): Promise<ControlRow> {
    assertReference("workspaceId", workspaceId);
    assertReference("agentRunId", agentRunId);
    const existing = await this.readControl(
      executor,
      workspaceId,
      agentRunId,
      true,
    );
    if (existing) return existing;
    try {
      await executor.$executeRawUnsafe(
        `INSERT INTO ${this.tables.runs}
           (workspace_id, agent_run_id, lifecycle, fencing_epoch)
         VALUES (?,?,?,0) /* recoverable:ensure-run */`,
        workspaceId,
        agentRunId,
        "created",
      );
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
    }
    const created = await this.readControl(
      executor,
      workspaceId,
      agentRunId,
      true,
    );
    if (!created) throw new Error("recoverable agent run could not be initialized");
    return created;
  }

  private requireLease(
    row: ControlRow,
    handle: AgentRunLeaseHandle,
    now: string,
  ): number {
    const nowMs = timestampMs("now", now);
    if (!sameLease(row, handle, nowMs)) throw new StaleAgentRunLeaseError();
    return nowMs;
  }

  async appendStep(input: AppendAgentStepInput): Promise<AgentRunRecord> {
    return this.base.appendStep(input);
  }

  async getRun(
    workspaceId: string,
    agentRunId: string,
  ): Promise<AgentRunRecord | null> {
    return this.base.getRun(workspaceId, agentRunId);
  }

  async listRuns(workspaceId: string): Promise<readonly AgentRunRecord[]> {
    return this.base.listRuns(workspaceId);
  }

  async acquireLease(input: {
    workspaceId: string;
    agentRunId: string;
    workerRef: string;
    now: string;
  }): Promise<AgentRunLeaseAcquisition> {
    assertReference("workerRef", input.workerRef);
    const nowMs = timestampMs("now", input.now);
    return this.client.$transaction(async (transaction) => {
      const row = await this.ensureRun(
        transaction,
        input.workspaceId,
        input.agentRunId,
      );
      const currentLease = rowLease(row);
      if (
        currentLease &&
        nowMs < timestampMs("lease.expiresAt", currentLease.expiresAt)
      ) {
        return Object.freeze({
          acquired: false as const,
          handle: null,
          lease: currentLease,
        });
      }

      const fencingEpoch = numeric(row.fencing_epoch) + 1;
      const expiresAtMs = nowMs + AGENT_RUN_LEASE_DURATION_MS;
      await transaction.$executeRawUnsafe(
        `UPDATE ${this.tables.runs}
         SET lease_owner_ref = ?, lease_acquired_at_ms = ?,
             lease_heartbeat_at_ms = ?, lease_expires_at_ms = ?, fencing_epoch = ?
         WHERE workspace_id = ? AND agent_run_id = ? /* recoverable:acquire-lease */`,
        input.workerRef,
        nowMs,
        nowMs,
        expiresAtMs,
        fencingEpoch,
        input.workspaceId,
        input.agentRunId,
      );
      const lease: AgentRunLease = Object.freeze({
        workerRef: input.workerRef,
        fencingEpoch,
        acquiredAt: input.now,
        heartbeatAt: input.now,
        expiresAt: new Date(expiresAtMs).toISOString(),
      });
      const handle: AgentRunLeaseHandle = Object.freeze({
        workspaceId: input.workspaceId,
        agentRunId: input.agentRunId,
        workerRef: input.workerRef,
        fencingEpoch,
      });
      return Object.freeze({ acquired: true as const, handle, lease });
    });
  }

  async heartbeatLease(input: {
    handle: AgentRunLeaseHandle;
    now: string;
  }): Promise<AgentRunLease> {
    return this.client.$transaction(async (transaction) => {
      const row = await this.readControl(
        transaction,
        input.handle.workspaceId,
        input.handle.agentRunId,
        true,
      );
      if (!row) throw new StaleAgentRunLeaseError();
      const nowMs = this.requireLease(row, input.handle, input.now);
      const expiresAtMs = nowMs + AGENT_RUN_LEASE_DURATION_MS;
      await transaction.$executeRawUnsafe(
        `UPDATE ${this.tables.runs}
         SET lease_heartbeat_at_ms = ?, lease_expires_at_ms = ?
         WHERE workspace_id = ? AND agent_run_id = ?
         /* recoverable:heartbeat-lease */`,
        nowMs,
        expiresAtMs,
        input.handle.workspaceId,
        input.handle.agentRunId,
      );
      const current = rowLease(row);
      if (!current) throw new StaleAgentRunLeaseError();
      return Object.freeze({
        ...current,
        heartbeatAt: input.now,
        expiresAt: new Date(expiresAtMs).toISOString(),
      });
    });
  }

  async releaseLease(input: {
    handle: AgentRunLeaseHandle;
    now: string;
  }): Promise<void> {
    await this.client.$transaction(async (transaction) => {
      const row = await this.readControl(
        transaction,
        input.handle.workspaceId,
        input.handle.agentRunId,
        true,
      );
      if (!row) throw new StaleAgentRunLeaseError();
      this.requireLease(row, input.handle, input.now);
      await transaction.$executeRawUnsafe(
        `UPDATE ${this.tables.runs}
         SET lease_owner_ref = NULL, lease_acquired_at_ms = NULL,
             lease_heartbeat_at_ms = NULL, lease_expires_at_ms = NULL
         WHERE workspace_id = ? AND agent_run_id = ?
         /* recoverable:release-lease */`,
        input.handle.workspaceId,
        input.handle.agentRunId,
      );
    });
  }

  async requestCancellation(input: {
    workspaceId: string;
    agentRunId: string;
    requestedByRef: string;
    reasonCode: string;
    now: string;
  }): Promise<AgentRunCancellation> {
    assertReference("requestedByRef", input.requestedByRef);
    assertReference("reasonCode", input.reasonCode);
    const nowMs = timestampMs("now", input.now);
    return this.client.$transaction(async (transaction) => {
      const row = await this.ensureRun(
        transaction,
        input.workspaceId,
        input.agentRunId,
      );
      const existing = rowCancellation(row);
      if (existing) return existing;
      await transaction.$executeRawUnsafe(
        `UPDATE ${this.tables.runs}
         SET cancel_requested_by_ref = ?, cancel_reason_code = ?,
             cancel_requested_at_ms = ?
         WHERE workspace_id = ? AND agent_run_id = ?
         /* recoverable:request-cancel */`,
        input.requestedByRef,
        input.reasonCode,
        nowMs,
        input.workspaceId,
        input.agentRunId,
      );
      return Object.freeze({
        requestedByRef: input.requestedByRef,
        reasonCode: input.reasonCode,
        requestedAt: input.now,
      });
    });
  }

  async getRecoveryState(
    workspaceId: string,
    agentRunId: string,
  ): Promise<AgentRunRecoveryState | null> {
    const row = await this.readControl(
      this.client,
      workspaceId,
      agentRunId,
    );
    if (!row) return null;
    const attemptRows = await this.client.$queryRawUnsafe<AttemptRow[]>(
      `SELECT operation_ref, attempt_kind, attempt_count, last_reserved_at_ms
       FROM ${this.tables.attempts}
       WHERE workspace_id = ? AND agent_run_id = ? ORDER BY seq ASC`,
      workspaceId,
      agentRunId,
    );
    if (!isAgentLifecycleState(row.lifecycle)) {
      throw new Error("corrupt recoverable agent lifecycle");
    }
    const attempts: AgentRunAttempt[] = attemptRows.map((attempt) => {
      const attemptCount = Number(attempt.attempt_count);
      const reservedAtMs = numeric(attempt.last_reserved_at_ms);
      if (
        (attempt.attempt_kind !== "model" &&
          attempt.attempt_kind !== "read_tool") ||
        !Number.isInteger(attemptCount) ||
        attemptCount < 1 ||
        attemptCount > AGENT_RUN_MAX_ATTEMPTS ||
        !Number.isFinite(reservedAtMs)
      ) {
        throw new Error("corrupt recoverable agent attempt row");
      }
      return Object.freeze({
        operationRef: attempt.operation_ref,
        kind: attempt.attempt_kind,
        attemptCount,
        lastReservedAt: new Date(reservedAtMs).toISOString(),
      });
    });
    return Object.freeze({
      workspaceId,
      agentRunId,
      lifecycle: row.lifecycle,
      lease: rowLease(row),
      fencingEpoch: numeric(row.fencing_epoch),
      cancellation: rowCancellation(row),
      checkpoint: rowCheckpoint(row),
      attempts: Object.freeze(attempts),
    });
  }

  async reserveAttempt(input: {
    handle: AgentRunLeaseHandle;
    now: string;
    operationRef: string;
    kind: AgentRunAttemptKind;
  }): Promise<AgentRunAttempt> {
    assertReference("operationRef", input.operationRef);
    return this.client.$transaction(async (transaction) => {
      const row = await this.readControl(
        transaction,
        input.handle.workspaceId,
        input.handle.agentRunId,
        true,
      );
      if (!row) throw new StaleAgentRunLeaseError();
      const nowMs = this.requireLease(row, input.handle, input.now);
      const attempts = await transaction.$queryRawUnsafe<AttemptRow[]>(
        `SELECT operation_ref, attempt_kind, attempt_count, last_reserved_at_ms
         FROM ${this.tables.attempts}
         WHERE workspace_id = ? AND agent_run_id = ? AND operation_ref = ?
         LIMIT 1 FOR UPDATE`,
        input.handle.workspaceId,
        input.handle.agentRunId,
        input.operationRef,
      );
      const existing = attempts[0];
      if (existing && existing.attempt_kind !== input.kind) {
        throw new Error("recoverable agent run attempt kind mismatch");
      }
      if (existing && Number(existing.attempt_count) >= AGENT_RUN_MAX_ATTEMPTS) {
        throw new AgentRunAttemptLimitError(input.operationRef);
      }
      const attemptCount = Number(existing?.attempt_count ?? 0) + 1;
      if (existing) {
        await transaction.$executeRawUnsafe(
          `UPDATE ${this.tables.attempts}
           SET attempt_count = ?, last_reserved_at_ms = ?
           WHERE workspace_id = ? AND agent_run_id = ? AND operation_ref = ?
           /* recoverable:update-attempt */`,
          attemptCount,
          nowMs,
          input.handle.workspaceId,
          input.handle.agentRunId,
          input.operationRef,
        );
      } else {
        await transaction.$executeRawUnsafe(
          `INSERT INTO ${this.tables.attempts}
             (workspace_id, agent_run_id, operation_ref, attempt_kind,
              attempt_count, last_reserved_at_ms)
           VALUES (?,?,?,?,?,?) /* recoverable:insert-attempt */`,
          input.handle.workspaceId,
          input.handle.agentRunId,
          input.operationRef,
          input.kind,
          attemptCount,
          nowMs,
        );
      }
      return Object.freeze({
        operationRef: input.operationRef,
        kind: input.kind,
        attemptCount,
        lastReservedAt: input.now,
      });
    });
  }

  async appendStepWithLease(input: {
    handle: AgentRunLeaseHandle;
    now: string;
    lifecycle: AgentLifecycleState;
    step: AgentStep;
  }): Promise<AgentRunRecord> {
    return this.client.$transaction(async (transaction) => {
      const row = await this.readControl(
        transaction,
        input.handle.workspaceId,
        input.handle.agentRunId,
        true,
      );
      if (!row) throw new StaleAgentRunLeaseError();
      this.requireLease(row, input.handle, input.now);
      const transactionalBase = new MysqlAgentRunStore(transaction as never, {
        runs: this.tables.runs,
        steps: this.tables.steps,
      });
      const current = await transactionalBase.getRun(
        input.handle.workspaceId,
        input.handle.agentRunId,
      );
      const existing = current?.steps.find(
        (candidate) => candidate.stepId === input.step.stepId,
      );
      if (existing && !sameStep(existing, input.step)) {
        throw new Error("conflicting step payload for an existing stepId");
      }
      if (!existing && input.step.index !== (current?.steps.length ?? 0)) {
        throw new Error("recoverable agent run step index is not contiguous");
      }
      const record = await transactionalBase.appendStep({
        workspaceId: input.handle.workspaceId,
        agentRunId: input.handle.agentRunId,
        lifecycle: input.lifecycle,
        step: input.step,
      });
      await transaction.$executeRawUnsafe(
        `UPDATE ${this.tables.steps}
         SET fencing_epoch = COALESCE(fencing_epoch, ?)
         WHERE workspace_id = ? AND agent_run_id = ? AND step_id = ?
         /* recoverable:stamp-step-fence */`,
        input.handle.fencingEpoch,
        input.handle.workspaceId,
        input.handle.agentRunId,
        input.step.stepId,
      );
      return record;
    });
  }

  async setLifecycleWithLease(input: {
    handle: AgentRunLeaseHandle;
    now: string;
    lifecycle: AgentLifecycleState;
  }): Promise<AgentRunRecord> {
    return this.client.$transaction(async (transaction) => {
      const row = await this.readControl(
        transaction,
        input.handle.workspaceId,
        input.handle.agentRunId,
        true,
      );
      if (!row) throw new StaleAgentRunLeaseError();
      this.requireLease(row, input.handle, input.now);
      await transaction.$executeRawUnsafe(
        `UPDATE ${this.tables.runs} SET lifecycle = ?
         WHERE workspace_id = ? AND agent_run_id = ?
         /* recoverable:set-lifecycle */`,
        input.lifecycle,
        input.handle.workspaceId,
        input.handle.agentRunId,
      );
      const transactionalBase = new MysqlAgentRunStore(transaction as never, {
        runs: this.tables.runs,
        steps: this.tables.steps,
      });
      const record = await transactionalBase.getRun(
        input.handle.workspaceId,
        input.handle.agentRunId,
      );
      if (!record) throw new Error("recoverable agent run vanished");
      return record;
    });
  }

  async writeCheckpoint(input: {
    handle: AgentRunLeaseHandle;
    now: string;
    checkpointRef: string;
    nextStepIndex: number;
    lifecycle: AgentLifecycleState;
  }): Promise<AgentRunCheckpoint> {
    assertReference("checkpointRef", input.checkpointRef);
    return this.client.$transaction(async (transaction) => {
      const row = await this.readControl(
        transaction,
        input.handle.workspaceId,
        input.handle.agentRunId,
        true,
      );
      if (!row) throw new StaleAgentRunLeaseError();
      const nowMs = this.requireLease(row, input.handle, input.now);
      if (!Number.isInteger(input.nextStepIndex) || input.nextStepIndex < 0) {
        throw new Error("recoverable agent run checkpoint index is invalid");
      }
      const transactionalBase = new MysqlAgentRunStore(transaction as never, {
        runs: this.tables.runs,
        steps: this.tables.steps,
      });
      const record = await transactionalBase.getRun(
        input.handle.workspaceId,
        input.handle.agentRunId,
      );
      if (input.nextStepIndex !== (record?.steps.length ?? 0)) {
        throw new Error("recoverable agent run checkpoint does not match persisted steps");
      }
      const existing = rowCheckpoint(row);
      if (existing && input.nextStepIndex < existing.nextStepIndex) {
        throw new Error("recoverable agent run checkpoint cannot move backward");
      }
      if (
        existing &&
        input.nextStepIndex === existing.nextStepIndex &&
        (input.checkpointRef !== existing.checkpointRef ||
          input.lifecycle !== existing.lifecycle) &&
        !(
          !isTerminalAgentState(existing.lifecycle) &&
          isTerminalAgentState(input.lifecycle)
        )
      ) {
        throw new Error("conflicting checkpoint at the same step index");
      }
      await transaction.$executeRawUnsafe(
        `UPDATE ${this.tables.runs}
         SET checkpoint_ref = ?, checkpoint_next_step_index = ?,
             checkpoint_lifecycle = ?, checkpoint_written_at_ms = ?,
             checkpoint_fencing_epoch = ?, lifecycle = ?
         WHERE workspace_id = ? AND agent_run_id = ?
         /* recoverable:write-checkpoint */`,
        input.checkpointRef,
        input.nextStepIndex,
        input.lifecycle,
        nowMs,
        input.handle.fencingEpoch,
        input.lifecycle,
        input.handle.workspaceId,
        input.handle.agentRunId,
      );
      return Object.freeze({
        checkpointRef: input.checkpointRef,
        nextStepIndex: input.nextStepIndex,
        lifecycle: input.lifecycle,
        writtenAt: input.now,
        fencingEpoch: input.handle.fencingEpoch,
      });
    });
  }
}

export function registerMysqlRecoverableAgentRunStore(
  store: MysqlRecoverableAgentRunStore = new MysqlRecoverableAgentRunStore(),
): AgentRunStore {
  return registerAgentRunStore(store);
}
