import { afterEach, describe, expect, it } from "vitest";

import {
  registerAgentTool,
  resetAgentToolsForTest,
  type AgentStep,
} from "@/lib/agent-runtime/agent-loop";
import {
  AGENT_RUN_HEARTBEAT_INTERVAL_MS,
  InMemoryRecoverableAgentRunStore,
} from "@/lib/agent-runtime/recoverable-run-store";
import { runRecoverableAgentLoop } from "@/lib/agent-runtime/recoverable-runner";

const workspaceId = "workspace:one";
const agentRunId = "run:recoverable:runner";
const baseTime = Date.parse("2026-07-12T00:00:00.000Z");

function at(milliseconds: number): string {
  return new Date(baseTime + milliseconds).toISOString();
}

const ctx = {
  workspaceId,
  agentRunId,
  maxSteps: 8,
};

function persistedReadStep(index: number): AgentStep {
  return {
    index,
    stepId: `step:${agentRunId}:${index}`,
    decision: {
      kind: "call_tool",
      toolName: "read_ctx",
      argsRef: `args:${index}`,
    },
    toolResult: { status: "ok", observationRef: `obs:${index}` },
    state: "observing",
  };
}

class AtomicProgressOnlyStore extends InMemoryRecoverableAgentRunStore {
  override async appendStepWithLease(): Promise<never> {
    throw new Error("runner used non-atomic append path");
  }

  override async setLifecycleWithLease(): Promise<never> {
    throw new Error("runner used non-atomic lifecycle path");
  }

  override async writeCheckpoint(): Promise<never> {
    throw new Error("runner used non-atomic checkpoint path");
  }
}

afterEach(() => resetAgentToolsForTest());

describe("runRecoverableAgentLoop", () => {
  it("retries a read tool at most three times and persists one completed step", async () => {
    const store = new InMemoryRecoverableAgentRunStore();
    let invocations = 0;
    let heartbeatInterval = 0;
    registerAgentTool({
      name: "read_ctx",
      riskLevel: "read",
      invoke: () => {
        invocations += 1;
        if (invocations < 3) throw new Error("transient read failure");
        return { status: "ok", observationRef: "obs:read:success" };
      },
    });

    const result = await runRecoverableAgentLoop({
      ctx,
      workerRef: "worker:one",
      store,
      clock: () => at(1_000),
      plan: (state) =>
        state.steps.length === 0
          ? { kind: "call_tool", toolName: "read_ctx", argsRef: "args:read" }
          : { kind: "finish", resultRef: "result:done" },
      startHeartbeat: ({ intervalMs }) => {
        heartbeatInterval = intervalMs;
        return { assertHealthy: () => {}, stop: async () => {} };
      },
    });

    expect(heartbeatInterval).toBe(AGENT_RUN_HEARTBEAT_INTERVAL_MS);
    expect(result.terminationReason).toBe("finished");
    expect(result.finalState).toBe("completed");
    expect(result.steps).toHaveLength(2);
    expect(invocations).toBe(3);
    expect((await store.getRun(workspaceId, agentRunId))?.steps).toHaveLength(2);

    const attempts = (
      await store.getRecoveryState(workspaceId, agentRunId)
    )?.attempts;
    expect(attempts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          operationRef: "planner:step:0",
          kind: "model",
          attemptCount: 1,
        }),
        expect.objectContaining({
          operationRef: "read-tool:step:0:read_ctx",
          kind: "read_tool",
          attemptCount: 3,
        }),
        expect.objectContaining({
          operationRef: "planner:step:1",
          kind: "model",
          attemptCount: 1,
        }),
      ]),
    );
    expect((await store.getRecoveryState(workspaceId, agentRunId))?.lease).toBeNull();
  });

  it("routes local-draft tools to review without invoking them", async () => {
    const store = new InMemoryRecoverableAgentRunStore();
    let invoked = false;
    registerAgentTool({
      name: "draft_note",
      riskLevel: "local_draft",
      invoke: () => {
        invoked = true;
        return { status: "ok", observationRef: "obs:draft" };
      },
    });
    const result = await runRecoverableAgentLoop({
      ctx,
      workerRef: "worker:one",
      store,
      clock: () => at(1_000),
      plan: () => ({
        kind: "call_tool",
        toolName: "draft_note",
        argsRef: "args:draft",
      }),
    });
    expect(result.terminationReason).toBe("await_review");
    expect(result.finalState).toBe("awaiting_review");
    expect(invoked).toBe(false);
    expect(
      (await store.getRecoveryState(workspaceId, agentRunId))?.attempts.some(
        ({ kind }) => kind === "read_tool",
      ),
    ).toBe(false);
  });

  it("honors a cancellation request before planning and checkpoints the blocked state", async () => {
    const store = new AtomicProgressOnlyStore();
    await store.requestCancellation({
      workspaceId,
      agentRunId,
      requestedByRef: "operator:one",
      reasonCode: "operator_requested",
      now: at(0),
    });
    let planned = false;
    const result = await runRecoverableAgentLoop({
      ctx,
      workerRef: "worker:one",
      store,
      clock: () => at(1_000),
      plan: () => {
        planned = true;
        return { kind: "finish" };
      },
    });
    expect(result.terminationReason).toBe("cancelled");
    expect(result.finalState).toBe("blocked");
    expect(result.steps).toHaveLength(0);
    expect(planned).toBe(false);
    expect((await store.getRecoveryState(workspaceId, agentRunId))?.checkpoint).toMatchObject(
      { nextStepIndex: 0, lifecycle: "blocked" },
    );
  });

  it("persists normal steps without using the split append/checkpoint path", async () => {
    const store = new AtomicProgressOnlyStore();
    const result = await runRecoverableAgentLoop({
      ctx,
      workerRef: "worker:atomic",
      store,
      clock: () => at(1_000),
      plan: () => ({ kind: "finish", resultRef: "result:atomic" }),
    });

    expect(result.terminationReason).toBe("finished");
    expect(result.steps).toHaveLength(1);
    expect((await store.getRecoveryState(workspaceId, agentRunId))?.checkpoint).toMatchObject(
      { nextStepIndex: 1, lifecycle: "completed" },
    );
  });

  it("resumes from the last checkpoint after lease expiry and fences the crashed worker", async () => {
    const store = new InMemoryRecoverableAgentRunStore();
    const crashed = await store.acquireLease({
      workspaceId,
      agentRunId,
      workerRef: "worker:crashed",
      now: at(0),
    });
    if (!crashed.acquired) throw new Error("expected crashed worker lease");
    await store.appendStepWithLease({
      handle: crashed.handle,
      now: at(1_000),
      lifecycle: "observing",
      step: persistedReadStep(0),
    });
    await store.writeCheckpoint({
      handle: crashed.handle,
      now: at(2_000),
      checkpointRef: `checkpoint:${agentRunId}:1:observing`,
      nextStepIndex: 1,
      lifecycle: "observing",
    });

    const resumed = await runRecoverableAgentLoop({
      ctx,
      workerRef: "worker:replacement",
      store,
      clock: () => at(61_000),
      plan: (state) => {
        expect(state.steps).toHaveLength(1);
        return { kind: "finish", resultRef: "result:resumed" };
      },
    });
    expect(resumed.terminationReason).toBe("finished");
    expect(resumed.finalState).toBe("completed");
    expect(resumed.fencingEpoch).toBe(2);
    expect(resumed.steps).toHaveLength(2);

    await expect(
      store.appendStepWithLease({
        handle: crashed.handle,
        now: at(61_001),
        lifecycle: "observing",
        step: persistedReadStep(1),
      }),
    ).rejects.toThrow(/stale lease/i);

    const duplicateDelivery = await runRecoverableAgentLoop({
      ctx,
      workerRef: "worker:duplicate-delivery",
      store,
      clock: () => at(62_000),
      plan: () => {
        throw new Error("terminal run must not plan again");
      },
    });
    expect(duplicateDelivery.terminationReason).toBe("already_terminal");
    expect((await store.getRun(workspaceId, agentRunId))?.steps).toHaveLength(2);
  });

  it("fails closed after three planner failures and records a terminal checkpoint", async () => {
    const store = new InMemoryRecoverableAgentRunStore();
    let planned = 0;
    const result = await runRecoverableAgentLoop({
      ctx,
      workerRef: "worker:one",
      store,
      clock: () => at(1_000),
      plan: () => {
        planned += 1;
        throw new Error("provider timeout");
      },
    });
    expect(planned).toBe(3);
    expect(result.terminationReason).toBe("retry_exhausted");
    expect(result.finalState).toBe("failed");
    expect(result.steps).toHaveLength(0);
    expect((await store.getRecoveryState(workspaceId, agentRunId))?.checkpoint).toMatchObject(
      { nextStepIndex: 0, lifecycle: "failed" },
    );
  });

  it("does no work when another worker owns an active lease", async () => {
    const store = new InMemoryRecoverableAgentRunStore();
    await store.acquireLease({
      workspaceId,
      agentRunId,
      workerRef: "worker:owner",
      now: at(0),
    });
    let planned = false;
    const result = await runRecoverableAgentLoop({
      ctx,
      workerRef: "worker:contender",
      store,
      clock: () => at(1_000),
      plan: () => {
        planned = true;
        return { kind: "finish" };
      },
    });
    expect(result.terminationReason).toBe("lease_unavailable");
    expect(planned).toBe(false);
  });
});
