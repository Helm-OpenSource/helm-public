import type {
  AgentLifecycleState,
  AgentStep,
} from "@/lib/agent-runtime/agent-loop";
import { isTerminalAgentState } from "@/lib/agent-runtime/agent-loop";
import {
  InMemoryAgentRunStore,
  type AgentRunRecord,
  type AgentRunStore,
  type AppendAgentStepInput,
} from "@/lib/agent-runtime/run-store";

export const AGENT_RUN_LEASE_DURATION_MS = 60_000 as const;
export const AGENT_RUN_HEARTBEAT_INTERVAL_MS = 20_000 as const;
export const AGENT_RUN_MAX_ATTEMPTS = 3 as const;

export class StaleAgentRunLeaseError extends Error {
  constructor() {
    super("stale lease holder rejected by fencing epoch");
    this.name = "StaleAgentRunLeaseError";
  }
}

export class AgentRunAttemptLimitError extends Error {
  constructor(operationRef: string) {
    super(`recoverable agent run attempt limit exceeded: ${operationRef}`);
    this.name = "AgentRunAttemptLimitError";
  }
}

export type AgentRunLease = Readonly<{
  workerRef: string;
  fencingEpoch: number;
  acquiredAt: string;
  heartbeatAt: string;
  expiresAt: string;
}>;

export type AgentRunLeaseHandle = Readonly<{
  workspaceId: string;
  agentRunId: string;
  workerRef: string;
  fencingEpoch: number;
}>;

export type AgentRunCancellation = Readonly<{
  requestedByRef: string;
  reasonCode: string;
  requestedAt: string;
}>;

export type AgentRunCheckpoint = Readonly<{
  checkpointRef: string;
  nextStepIndex: number;
  lifecycle: AgentLifecycleState;
  writtenAt: string;
  fencingEpoch: number;
}>;

export type AgentRunAttemptKind = "model" | "read_tool";

export type AgentRunAttempt = Readonly<{
  operationRef: string;
  kind: AgentRunAttemptKind;
  attemptCount: number;
  lastReservedAt: string;
}>;

export type AgentRunRecoveryState = Readonly<{
  workspaceId: string;
  agentRunId: string;
  lifecycle: AgentLifecycleState;
  lease: AgentRunLease | null;
  fencingEpoch: number;
  cancellation: AgentRunCancellation | null;
  checkpoint: AgentRunCheckpoint | null;
  attempts: readonly AgentRunAttempt[];
}>;

export type AgentRunLeaseAcquisition =
  | Readonly<{
      acquired: true;
      handle: AgentRunLeaseHandle;
      lease: AgentRunLease;
    }>
  | Readonly<{
      acquired: false;
      handle: null;
      lease: AgentRunLease;
    }>;

export interface RecoverableAgentRunStore extends AgentRunStore {
  acquireLease(input: {
    workspaceId: string;
    agentRunId: string;
    workerRef: string;
    now: string;
  }): Promise<AgentRunLeaseAcquisition>;
  heartbeatLease(input: {
    handle: AgentRunLeaseHandle;
    now: string;
  }): Promise<AgentRunLease>;
  releaseLease(input: {
    handle: AgentRunLeaseHandle;
    now: string;
  }): Promise<void>;
  requestCancellation(input: {
    workspaceId: string;
    agentRunId: string;
    requestedByRef: string;
    reasonCode: string;
    now: string;
  }): Promise<AgentRunCancellation>;
  getRecoveryState(
    workspaceId: string,
    agentRunId: string,
  ): Promise<AgentRunRecoveryState | null>;
  reserveAttempt(input: {
    handle: AgentRunLeaseHandle;
    now: string;
    operationRef: string;
    kind: AgentRunAttemptKind;
  }): Promise<AgentRunAttempt>;
  appendStepWithLease(input: {
    handle: AgentRunLeaseHandle;
    now: string;
    lifecycle: AgentLifecycleState;
    step: AgentStep;
  }): Promise<AgentRunRecord>;
  setLifecycleWithLease(input: {
    handle: AgentRunLeaseHandle;
    now: string;
    lifecycle: AgentLifecycleState;
  }): Promise<AgentRunRecord>;
  writeCheckpoint(input: {
    handle: AgentRunLeaseHandle;
    now: string;
    checkpointRef: string;
    nextStepIndex: number;
    lifecycle: AgentLifecycleState;
  }): Promise<AgentRunCheckpoint>;
}

type MutableControlState = {
  workspaceId: string;
  agentRunId: string;
  lifecycle: AgentLifecycleState;
  lease: AgentRunLease | null;
  fencingEpoch: number;
  cancellation: AgentRunCancellation | null;
  checkpoint: AgentRunCheckpoint | null;
  attempts: Map<string, AgentRunAttempt>;
  order: number;
};

function controlKey(workspaceId: string, agentRunId: string): string {
  return `${workspaceId}::${agentRunId}`;
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
  if (!Number.isFinite(parsed) || !value.includes("T")) {
    throw new Error(`recoverable agent run requires an ISO timestamp for ${name}`);
  }
  return parsed;
}

function freezeLease(lease: AgentRunLease): AgentRunLease {
  return Object.freeze({ ...lease });
}

function sameStep(left: AgentStep, right: AgentStep): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export class InMemoryRecoverableAgentRunStore
  implements RecoverableAgentRunStore
{
  private readonly base = new InMemoryAgentRunStore();
  private readonly controls = new Map<string, MutableControlState>();
  private nextOrder = 0;

  private ensureControl(
    workspaceId: string,
    agentRunId: string,
    lifecycle: AgentLifecycleState = "created",
  ): MutableControlState {
    assertReference("workspaceId", workspaceId);
    assertReference("agentRunId", agentRunId);
    const key = controlKey(workspaceId, agentRunId);
    const existing = this.controls.get(key);
    if (existing) return existing;
    const control: MutableControlState = {
      workspaceId,
      agentRunId,
      lifecycle,
      lease: null,
      fencingEpoch: 0,
      cancellation: null,
      checkpoint: null,
      attempts: new Map(),
      order: this.nextOrder++,
    };
    this.controls.set(key, control);
    return control;
  }

  private requireCurrentLease(
    handle: AgentRunLeaseHandle,
    now: string,
  ): { control: MutableControlState; lease: AgentRunLease; nowMs: number } {
    const nowMs = timestampMs("now", now);
    const control = this.controls.get(
      controlKey(handle.workspaceId, handle.agentRunId),
    );
    const lease = control?.lease;
    if (
      !control ||
      !lease ||
      lease.workerRef !== handle.workerRef ||
      lease.fencingEpoch !== handle.fencingEpoch ||
      nowMs >= timestampMs("lease.expiresAt", lease.expiresAt)
    ) {
      throw new StaleAgentRunLeaseError();
    }
    return { control, lease, nowMs };
  }

  async appendStep(input: AppendAgentStepInput): Promise<AgentRunRecord> {
    const control = this.ensureControl(
      input.workspaceId,
      input.agentRunId,
      input.lifecycle,
    );
    const record = await this.base.appendStep(input);
    control.lifecycle = input.lifecycle;
    return Object.freeze({ ...record, lifecycle: control.lifecycle });
  }

  async getRun(
    workspaceId: string,
    agentRunId: string,
  ): Promise<AgentRunRecord | null> {
    const control = this.controls.get(controlKey(workspaceId, agentRunId));
    const base = await this.base.getRun(workspaceId, agentRunId);
    if (!control) return base;
    return Object.freeze({
      agentRunId,
      workspaceId,
      lifecycle: control.lifecycle,
      steps: base?.steps ?? Object.freeze([]),
    });
  }

  async listRuns(workspaceId: string): Promise<readonly AgentRunRecord[]> {
    const controls = [...this.controls.values()]
      .filter((control) => control.workspaceId === workspaceId)
      .sort((left, right) => left.order - right.order);
    const records: AgentRunRecord[] = [];
    for (const control of controls) {
      const record = await this.getRun(workspaceId, control.agentRunId);
      if (record) records.push(record);
    }
    return Object.freeze(records);
  }

  async acquireLease(input: {
    workspaceId: string;
    agentRunId: string;
    workerRef: string;
    now: string;
  }): Promise<AgentRunLeaseAcquisition> {
    assertReference("workerRef", input.workerRef);
    const nowMs = timestampMs("now", input.now);
    const control = this.ensureControl(input.workspaceId, input.agentRunId);
    if (
      control.lease &&
      nowMs < timestampMs("lease.expiresAt", control.lease.expiresAt)
    ) {
      return Object.freeze({
        acquired: false as const,
        handle: null,
        lease: freezeLease(control.lease),
      });
    }

    control.fencingEpoch += 1;
    const lease = freezeLease({
      workerRef: input.workerRef,
      fencingEpoch: control.fencingEpoch,
      acquiredAt: input.now,
      heartbeatAt: input.now,
      expiresAt: new Date(nowMs + AGENT_RUN_LEASE_DURATION_MS).toISOString(),
    });
    control.lease = lease;
    const handle: AgentRunLeaseHandle = Object.freeze({
      workspaceId: input.workspaceId,
      agentRunId: input.agentRunId,
      workerRef: input.workerRef,
      fencingEpoch: lease.fencingEpoch,
    });
    return Object.freeze({ acquired: true as const, handle, lease });
  }

  async heartbeatLease(input: {
    handle: AgentRunLeaseHandle;
    now: string;
  }): Promise<AgentRunLease> {
    const { control, lease, nowMs } = this.requireCurrentLease(
      input.handle,
      input.now,
    );
    const next = freezeLease({
      ...lease,
      heartbeatAt: input.now,
      expiresAt: new Date(nowMs + AGENT_RUN_LEASE_DURATION_MS).toISOString(),
    });
    control.lease = next;
    return next;
  }

  async releaseLease(input: {
    handle: AgentRunLeaseHandle;
    now: string;
  }): Promise<void> {
    const { control } = this.requireCurrentLease(input.handle, input.now);
    control.lease = null;
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
    timestampMs("now", input.now);
    const control = this.ensureControl(input.workspaceId, input.agentRunId);
    if (control.cancellation) return control.cancellation;
    control.cancellation = Object.freeze({
      requestedByRef: input.requestedByRef,
      reasonCode: input.reasonCode,
      requestedAt: input.now,
    });
    return control.cancellation;
  }

  async getRecoveryState(
    workspaceId: string,
    agentRunId: string,
  ): Promise<AgentRunRecoveryState | null> {
    const control = this.controls.get(controlKey(workspaceId, agentRunId));
    if (!control) return null;
    return Object.freeze({
      workspaceId,
      agentRunId,
      lifecycle: control.lifecycle,
      lease: control.lease ? freezeLease(control.lease) : null,
      fencingEpoch: control.fencingEpoch,
      cancellation: control.cancellation
        ? Object.freeze({ ...control.cancellation })
        : null,
      checkpoint: control.checkpoint
        ? Object.freeze({ ...control.checkpoint })
        : null,
      attempts: Object.freeze(
        [...control.attempts.values()].map((attempt) =>
          Object.freeze({ ...attempt }),
        ),
      ),
    });
  }

  async reserveAttempt(input: {
    handle: AgentRunLeaseHandle;
    now: string;
    operationRef: string;
    kind: AgentRunAttemptKind;
  }): Promise<AgentRunAttempt> {
    assertReference("operationRef", input.operationRef);
    const { control } = this.requireCurrentLease(input.handle, input.now);
    const existing = control.attempts.get(input.operationRef);
    if (existing && existing.kind !== input.kind) {
      throw new Error("recoverable agent run attempt kind mismatch");
    }
    if (existing && existing.attemptCount >= AGENT_RUN_MAX_ATTEMPTS) {
      throw new AgentRunAttemptLimitError(input.operationRef);
    }
    const attempt = Object.freeze({
      operationRef: input.operationRef,
      kind: input.kind,
      attemptCount: (existing?.attemptCount ?? 0) + 1,
      lastReservedAt: input.now,
    });
    control.attempts.set(input.operationRef, attempt);
    return attempt;
  }

  async appendStepWithLease(input: {
    handle: AgentRunLeaseHandle;
    now: string;
    lifecycle: AgentLifecycleState;
    step: AgentStep;
  }): Promise<AgentRunRecord> {
    const { control } = this.requireCurrentLease(input.handle, input.now);
    const current = await this.getRun(
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
    const record = await this.base.appendStep({
      workspaceId: input.handle.workspaceId,
      agentRunId: input.handle.agentRunId,
      lifecycle: input.lifecycle,
      step: input.step,
    });
    control.lifecycle = input.lifecycle;
    return Object.freeze({ ...record, lifecycle: control.lifecycle });
  }

  async setLifecycleWithLease(input: {
    handle: AgentRunLeaseHandle;
    now: string;
    lifecycle: AgentLifecycleState;
  }): Promise<AgentRunRecord> {
    const { control } = this.requireCurrentLease(input.handle, input.now);
    control.lifecycle = input.lifecycle;
    const record = await this.getRun(
      input.handle.workspaceId,
      input.handle.agentRunId,
    );
    if (!record) throw new Error("recoverable agent run vanished");
    return record;
  }

  async writeCheckpoint(input: {
    handle: AgentRunLeaseHandle;
    now: string;
    checkpointRef: string;
    nextStepIndex: number;
    lifecycle: AgentLifecycleState;
  }): Promise<AgentRunCheckpoint> {
    assertReference("checkpointRef", input.checkpointRef);
    const { control } = this.requireCurrentLease(input.handle, input.now);
    const record = await this.getRun(
      input.handle.workspaceId,
      input.handle.agentRunId,
    );
    if (!Number.isInteger(input.nextStepIndex) || input.nextStepIndex < 0) {
      throw new Error("recoverable agent run checkpoint index is invalid");
    }
    if (input.nextStepIndex !== (record?.steps.length ?? 0)) {
      throw new Error("recoverable agent run checkpoint does not match persisted steps");
    }
    if (
      control.checkpoint &&
      input.nextStepIndex < control.checkpoint.nextStepIndex
    ) {
      throw new Error("recoverable agent run checkpoint cannot move backward");
    }
    if (
      control.checkpoint &&
      input.nextStepIndex === control.checkpoint.nextStepIndex &&
      (input.checkpointRef !== control.checkpoint.checkpointRef ||
        input.lifecycle !== control.checkpoint.lifecycle) &&
      !(
        !isTerminalAgentState(control.checkpoint.lifecycle) &&
        isTerminalAgentState(input.lifecycle)
      )
    ) {
      throw new Error("conflicting checkpoint at the same step index");
    }
    const checkpoint = Object.freeze({
      checkpointRef: input.checkpointRef,
      nextStepIndex: input.nextStepIndex,
      lifecycle: input.lifecycle,
      writtenAt: input.now,
      fencingEpoch: input.handle.fencingEpoch,
    });
    control.checkpoint = checkpoint;
    control.lifecycle = input.lifecycle;
    return checkpoint;
  }
}
