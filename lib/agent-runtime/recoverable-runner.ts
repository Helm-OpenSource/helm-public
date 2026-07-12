import {
  advanceAgentLoopStep,
  isTerminalAgentState,
  type AgentDecision,
  type AgentLifecycleState,
  type AgentLoopResult,
  type AgentLoopState,
  type AgentPlanner,
  type AgentRunContext,
  type AgentStep,
  type AgentToolResult,
} from "@/lib/agent-runtime/agent-loop";
import {
  AGENT_RUN_HEARTBEAT_INTERVAL_MS,
  AGENT_RUN_MAX_ATTEMPTS,
  AgentRunAttemptLimitError,
  StaleAgentRunLeaseError,
  type AgentRunAttemptKind,
  type AgentRunLeaseHandle,
  type RecoverableAgentRunStore,
} from "@/lib/agent-runtime/recoverable-run-store";

export type RecoverableAgentRunTerminationReason =
  | AgentLoopResult["terminationReason"]
  | "cancelled"
  | "lease_unavailable"
  | "lease_lost"
  | "retry_exhausted"
  | "already_terminal";

export type RecoverableAgentRunResult = Readonly<{
  agentRunId: string;
  workspaceId: string;
  finalState: AgentLifecycleState;
  steps: readonly AgentStep[];
  terminationReason: RecoverableAgentRunTerminationReason;
  fencingEpoch: number | null;
  checkpointRef: string | null;
}>;

export type AgentRunHeartbeatMonitor = Readonly<{
  assertHealthy(): void;
  stop(): Promise<void>;
}>;

export type AgentRunHeartbeatStarter = (input: {
  intervalMs: number;
  heartbeat: () => Promise<void>;
}) => AgentRunHeartbeatMonitor;

class RetryExhaustedError extends Error {
  constructor(
    readonly operationRef: string,
    options?: ErrorOptions,
  ) {
    super(`recoverable agent operation retry exhausted: ${operationRef}`, options);
    this.name = "RetryExhaustedError";
  }
}

function defaultHeartbeatStarter(input: {
  intervalMs: number;
  heartbeat: () => Promise<void>;
}): AgentRunHeartbeatMonitor {
  let heartbeatError: unknown = null;
  let pending = Promise.resolve();
  const timer = setInterval(() => {
    pending = pending
      .then(input.heartbeat)
      .catch((error: unknown) => {
        heartbeatError = error;
      });
  }, input.intervalMs);
  timer.unref?.();
  return {
    assertHealthy() {
      if (heartbeatError) throw heartbeatError;
    },
    async stop() {
      clearInterval(timer);
      await pending;
      if (heartbeatError) throw heartbeatError;
    },
  };
}

function checkpointRef(
  agentRunId: string,
  state: AgentLoopState,
): string {
  return `checkpoint:${agentRunId}:${state.steps.length}:${state.lifecycle}`;
}

function result(input: {
  ctx: AgentRunContext;
  state: AgentLoopState;
  terminationReason: RecoverableAgentRunTerminationReason;
  fencingEpoch: number | null;
  checkpointRef: string | null;
}): RecoverableAgentRunResult {
  return Object.freeze({
    agentRunId: input.ctx.agentRunId,
    workspaceId: input.ctx.workspaceId,
    finalState: input.state.lifecycle,
    steps: Object.freeze([...input.state.steps]),
    terminationReason: input.terminationReason,
    fencingEpoch: input.fencingEpoch,
    checkpointRef: input.checkpointRef,
  });
}

async function withPersistedAttempts<T>(input: {
  store: RecoverableAgentRunStore;
  handle: AgentRunLeaseHandle;
  operationRef: string;
  kind: AgentRunAttemptKind;
  clock: () => string;
  invoke: () => T | Promise<T>;
}): Promise<T> {
  for (;;) {
    let attemptCount: number;
    try {
      const attempt = await input.store.reserveAttempt({
        handle: input.handle,
        now: input.clock(),
        operationRef: input.operationRef,
        kind: input.kind,
      });
      attemptCount = attempt.attemptCount;
    } catch (error) {
      if (error instanceof AgentRunAttemptLimitError) {
        throw new RetryExhaustedError(input.operationRef, { cause: error });
      }
      throw error;
    }

    try {
      return await input.invoke();
    } catch (error) {
      if (attemptCount >= AGENT_RUN_MAX_ATTEMPTS) {
        throw new RetryExhaustedError(input.operationRef, { cause: error });
      }
    }
  }
}

function assertRecoveryConsistency(input: {
  state: AgentLoopState;
  checkpoint:
    | {
        nextStepIndex: number;
        lifecycle: AgentLifecycleState;
      }
    | null;
}): void {
  if (input.state.steps.length > 0 && !input.checkpoint) {
    throw new Error("recoverable agent run has persisted steps without a checkpoint");
  }
  if (
    input.checkpoint &&
    (input.checkpoint.nextStepIndex !== input.state.steps.length ||
      input.checkpoint.lifecycle !== input.state.lifecycle)
  ) {
    throw new Error("recoverable agent run checkpoint is inconsistent with persisted state");
  }
}

export async function runRecoverableAgentLoop(input: {
  ctx: AgentRunContext;
  plan: AgentPlanner;
  workerRef: string;
  store: RecoverableAgentRunStore;
  clock?: () => string;
  startHeartbeat?: AgentRunHeartbeatStarter;
}): Promise<RecoverableAgentRunResult> {
  const { ctx, plan, store } = input;
  const clock = input.clock ?? (() => new Date().toISOString());
  const existing = await store.getRun(ctx.workspaceId, ctx.agentRunId);
  const recovery = await store.getRecoveryState(ctx.workspaceId, ctx.agentRunId);
  const initialState: AgentLoopState = existing
    ? { steps: [...existing.steps], lifecycle: existing.lifecycle }
    : { steps: [], lifecycle: "created" };
  assertRecoveryConsistency({
    state: initialState,
    checkpoint: recovery?.checkpoint ?? null,
  });
  if (isTerminalAgentState(initialState.lifecycle)) {
    return result({
      ctx,
      state: initialState,
      terminationReason: "already_terminal",
      fencingEpoch: recovery?.fencingEpoch ?? null,
      checkpointRef: recovery?.checkpoint?.checkpointRef ?? null,
    });
  }

  const acquisition = await store.acquireLease({
    workspaceId: ctx.workspaceId,
    agentRunId: ctx.agentRunId,
    workerRef: input.workerRef,
    now: clock(),
  });
  if (!acquisition.acquired) {
    return result({
      ctx,
      state: initialState,
      terminationReason: "lease_unavailable",
      fencingEpoch: acquisition.lease.fencingEpoch,
      checkpointRef: recovery?.checkpoint?.checkpointRef ?? null,
    });
  }

  const handle = acquisition.handle;
  const leasedRecord = await store.getRun(ctx.workspaceId, ctx.agentRunId);
  const leasedRecovery = await store.getRecoveryState(
    ctx.workspaceId,
    ctx.agentRunId,
  );
  let state: AgentLoopState = leasedRecord
    ? { steps: [...leasedRecord.steps], lifecycle: leasedRecord.lifecycle }
    : { steps: [], lifecycle: "created" };
  assertRecoveryConsistency({
    state,
    checkpoint: leasedRecovery?.checkpoint ?? null,
  });
  if (isTerminalAgentState(state.lifecycle)) {
    await store.releaseLease({ handle, now: clock() });
    return result({
      ctx,
      state,
      terminationReason: "already_terminal",
      fencingEpoch: handle.fencingEpoch,
      checkpointRef: leasedRecovery?.checkpoint?.checkpointRef ?? null,
    });
  }
  let outcome: RecoverableAgentRunResult | null = null;
  let activeCheckpointRef = leasedRecovery?.checkpoint?.checkpointRef ?? null;
  let heartbeat: AgentRunHeartbeatMonitor;
  try {
    heartbeat = (input.startHeartbeat ?? defaultHeartbeatStarter)({
      intervalMs: AGENT_RUN_HEARTBEAT_INTERVAL_MS,
      heartbeat: async () => {
        await store.heartbeatLease({ handle, now: clock() });
      },
    });
  } catch (error) {
    await store.releaseLease({ handle, now: clock() });
    throw error;
  }

  try {
    for (;;) {
      heartbeat.assertHealthy();
      const currentRecovery = await store.getRecoveryState(
        ctx.workspaceId,
        ctx.agentRunId,
      );
      if (currentRecovery?.cancellation) {
        state = { steps: [...state.steps], lifecycle: "blocked" };
        await store.setLifecycleWithLease({
          handle,
          now: clock(),
          lifecycle: state.lifecycle,
        });
        activeCheckpointRef = checkpointRef(ctx.agentRunId, state);
        await store.writeCheckpoint({
          handle,
          now: clock(),
          checkpointRef: activeCheckpointRef,
          nextStepIndex: state.steps.length,
          lifecycle: state.lifecycle,
        });
        outcome = result({
          ctx,
          state,
          terminationReason: "cancelled",
          fencingEpoch: handle.fencingEpoch,
          checkpointRef: activeCheckpointRef,
        });
        break;
      }

      let advanced;
      try {
        advanced = await advanceAgentLoopStep({
          ctx,
          plan,
          state,
          canInvokeTool: (tool) => tool.riskLevel === "read",
          executePlanner: ({ plan: planner, state: plannerState, ctx: plannerCtx }) =>
            withPersistedAttempts<AgentDecision>({
              store,
              handle,
              operationRef: `planner:step:${plannerState.steps.length}`,
              kind: "model",
              clock,
              invoke: () => planner(plannerState, plannerCtx),
            }),
          executeTool: ({ tool, invocation, ctx: toolCtx }) =>
            withPersistedAttempts<AgentToolResult>({
              store,
              handle,
              operationRef: `read-tool:step:${state.steps.length}:${tool.name}`,
              kind: "read_tool",
              clock,
              invoke: async () => {
                if (tool.riskLevel !== "read") {
                  throw new Error("recoverable runner cannot execute a non-read tool");
                }
                const toolResult = await tool.invoke(invocation, toolCtx);
                if (toolResult.status === "error") {
                  throw new Error(
                    `read tool failed: ${toolResult.errorCode ?? "unknown_error"}`,
                  );
                }
                return toolResult;
              },
            }),
        });
      } catch (error) {
        if (!(error instanceof RetryExhaustedError)) throw error;
        state = { steps: [...state.steps], lifecycle: "failed" };
        await store.setLifecycleWithLease({
          handle,
          now: clock(),
          lifecycle: state.lifecycle,
        });
        activeCheckpointRef = checkpointRef(ctx.agentRunId, state);
        await store.writeCheckpoint({
          handle,
          now: clock(),
          checkpointRef: activeCheckpointRef,
          nextStepIndex: state.steps.length,
          lifecycle: state.lifecycle,
        });
        outcome = result({
          ctx,
          state,
          terminationReason: "retry_exhausted",
          fencingEpoch: handle.fencingEpoch,
          checkpointRef: activeCheckpointRef,
        });
        break;
      }

      heartbeat.assertHealthy();
      if (advanced.step) {
        await store.appendStepWithLease({
          handle,
          now: clock(),
          lifecycle: advanced.state.lifecycle,
          step: advanced.step,
        });
      } else {
        await store.setLifecycleWithLease({
          handle,
          now: clock(),
          lifecycle: advanced.state.lifecycle,
        });
      }
      state = advanced.state;
      activeCheckpointRef = checkpointRef(ctx.agentRunId, state);
      await store.writeCheckpoint({
        handle,
        now: clock(),
        checkpointRef: activeCheckpointRef,
        nextStepIndex: state.steps.length,
        lifecycle: state.lifecycle,
      });
      if (!advanced.terminal) continue;
      outcome = result({
        ctx,
        state,
        terminationReason: advanced.terminal.terminationReason,
        fencingEpoch: handle.fencingEpoch,
        checkpointRef: activeCheckpointRef,
      });
      break;
    }
  } catch (error) {
    if (error instanceof StaleAgentRunLeaseError) {
      outcome = result({
        ctx,
        state,
        terminationReason: "lease_lost",
        fencingEpoch: handle.fencingEpoch,
        checkpointRef: activeCheckpointRef,
      });
    } else {
      throw error;
    }
  } finally {
    try {
      await heartbeat.stop();
    } catch (error) {
      if (!(error instanceof StaleAgentRunLeaseError)) throw error;
    }
    if (outcome?.terminationReason !== "lease_lost") {
      try {
        await store.releaseLease({ handle, now: clock() });
      } catch (error) {
        if (!(error instanceof StaleAgentRunLeaseError)) throw error;
      }
    }
  }

  if (!outcome) throw new Error("recoverable agent loop ended without an outcome");
  return outcome;
}
