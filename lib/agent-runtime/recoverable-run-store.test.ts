import { describe, expect, it } from "vitest";

import type { AgentStep } from "@/lib/agent-runtime/agent-loop";
import {
  AGENT_RUN_HEARTBEAT_INTERVAL_MS,
  AGENT_RUN_LEASE_DURATION_MS,
  InMemoryRecoverableAgentRunStore,
} from "@/lib/agent-runtime/recoverable-run-store";

const workspaceId = "workspace:one";
const agentRunId = "run:recoverable:one";

function at(milliseconds: number): string {
  return new Date(Date.parse("2026-07-12T00:00:00.000Z") + milliseconds).toISOString();
}

function step(index: number, observationRef = `obs:${index}`): AgentStep {
  return {
    index,
    stepId: `step:${agentRunId}:${index}`,
    decision: {
      kind: "call_tool",
      toolName: "read_ctx",
      argsRef: `args:${index}`,
    },
    toolResult: { status: "ok", observationRef },
    state: "observing",
  };
}

describe("InMemoryRecoverableAgentRunStore", () => {
  it("grants one 60-second lease, heartbeats at the 20-second cadence, and fences competitors", async () => {
    expect(AGENT_RUN_LEASE_DURATION_MS).toBe(60_000);
    expect(AGENT_RUN_HEARTBEAT_INTERVAL_MS).toBe(20_000);
    const store = new InMemoryRecoverableAgentRunStore();

    const first = await store.acquireLease({
      workspaceId,
      agentRunId,
      workerRef: "worker:a",
      now: at(0),
    });
    expect(first.acquired).toBe(true);
    if (!first.acquired) throw new Error("expected first lease");
    expect(first.handle.fencingEpoch).toBe(1);
    expect(first.lease.expiresAt).toBe(at(AGENT_RUN_LEASE_DURATION_MS));

    const competing = await store.acquireLease({
      workspaceId,
      agentRunId,
      workerRef: "worker:b",
      now: at(1_000),
    });
    expect(competing.acquired).toBe(false);

    const heartbeat = await store.heartbeatLease({
      handle: first.handle,
      now: at(AGENT_RUN_HEARTBEAT_INTERVAL_MS),
    });
    expect(heartbeat.expiresAt).toBe(
      at(AGENT_RUN_HEARTBEAT_INTERVAL_MS + AGENT_RUN_LEASE_DURATION_MS),
    );

    const stillBlocked = await store.acquireLease({
      workspaceId,
      agentRunId,
      workerRef: "worker:b",
      now: at(AGENT_RUN_LEASE_DURATION_MS + 1),
    });
    expect(stillBlocked.acquired).toBe(false);

    const takeover = await store.acquireLease({
      workspaceId,
      agentRunId,
      workerRef: "worker:b",
      now: at(
        AGENT_RUN_HEARTBEAT_INTERVAL_MS + AGENT_RUN_LEASE_DURATION_MS + 1,
      ),
    });
    expect(takeover.acquired).toBe(true);
    if (!takeover.acquired) throw new Error("expected takeover");
    expect(takeover.handle.fencingEpoch).toBe(2);

    await expect(
      store.heartbeatLease({ handle: first.handle, now: at(81_000) }),
    ).rejects.toThrow(/stale lease/i);
    await expect(
      store.appendStepWithLease({
        handle: first.handle,
        now: at(81_000),
        lifecycle: "observing",
        step: step(0),
      }),
    ).rejects.toThrow(/stale lease/i);
    await expect(
      store.writeCheckpoint({
        handle: first.handle,
        now: at(81_000),
        checkpointRef: "checkpoint:stale",
        nextStepIndex: 0,
        lifecycle: "created",
      }),
    ).rejects.toThrow(/stale lease/i);
  });

  it("persists scoped cancellation and keeps the first request authoritative", async () => {
    const store = new InMemoryRecoverableAgentRunStore();
    const first = await store.requestCancellation({
      workspaceId,
      agentRunId,
      requestedByRef: "operator:one",
      reasonCode: "operator_requested",
      now: at(5_000),
    });
    const duplicate = await store.requestCancellation({
      workspaceId,
      agentRunId,
      requestedByRef: "operator:two",
      reasonCode: "different_reason",
      now: at(6_000),
    });
    expect(duplicate).toEqual(first);
    expect((await store.getRecoveryState(workspaceId, agentRunId))?.cancellation).toEqual(
      first,
    );
    expect(await store.getRecoveryState("workspace:other", agentRunId)).toBeNull();
  });

  it("appends and checkpoints monotonically under the current fence", async () => {
    const store = new InMemoryRecoverableAgentRunStore();
    const acquisition = await store.acquireLease({
      workspaceId,
      agentRunId,
      workerRef: "worker:a",
      now: at(0),
    });
    if (!acquisition.acquired) throw new Error("expected lease");

    await store.appendStepWithLease({
      handle: acquisition.handle,
      now: at(1_000),
      lifecycle: "observing",
      step: step(0),
    });
    await store.writeCheckpoint({
      handle: acquisition.handle,
      now: at(2_000),
      checkpointRef: "checkpoint:one",
      nextStepIndex: 1,
      lifecycle: "observing",
    });

    const idempotent = await store.appendStepWithLease({
      handle: acquisition.handle,
      now: at(3_000),
      lifecycle: "observing",
      step: step(0),
    });
    expect(idempotent.steps).toHaveLength(1);
    await expect(
      store.appendStepWithLease({
        handle: acquisition.handle,
        now: at(3_000),
        lifecycle: "observing",
        step: step(0, "obs:conflict"),
      }),
    ).rejects.toThrow(/conflicting step/i);
    await expect(
      store.writeCheckpoint({
        handle: acquisition.handle,
        now: at(4_000),
        checkpointRef: "checkpoint:backward",
        nextStepIndex: 0,
        lifecycle: "observing",
      }),
    ).rejects.toThrow(/checkpoint/i);

    const recovery = await store.getRecoveryState(workspaceId, agentRunId);
    expect(recovery?.checkpoint).toMatchObject({
      checkpointRef: "checkpoint:one",
      nextStepIndex: 1,
      fencingEpoch: 1,
    });
  });

  it("persists at most three attempts per deterministic operation", async () => {
    const store = new InMemoryRecoverableAgentRunStore();
    const acquisition = await store.acquireLease({
      workspaceId,
      agentRunId,
      workerRef: "worker:a",
      now: at(0),
    });
    if (!acquisition.acquired) throw new Error("expected lease");

    for (let index = 1; index <= 3; index += 1) {
      await expect(
        store.reserveAttempt({
          handle: acquisition.handle,
          now: at(index * 1_000),
          operationRef: "planner:step:0",
          kind: "model",
        }),
      ).resolves.toMatchObject({ attemptCount: index });
    }
    await expect(
      store.reserveAttempt({
        handle: acquisition.handle,
        now: at(4_000),
        operationRef: "planner:step:0",
        kind: "model",
      }),
    ).rejects.toThrow(/attempt limit/i);
    expect(
      (await store.getRecoveryState(workspaceId, agentRunId))?.attempts,
    ).toEqual([
      {
        operationRef: "planner:step:0",
        kind: "model",
        attemptCount: 3,
        lastReservedAt: at(3_000),
      },
    ]);
  });
});
