import { describe, expect, it } from "vitest";
import {
  buildRuntimeServerMinimalSummary,
  buildRuntimeServerMinimalThread,
  completeRuntimeWorkerQueueItem,
  createRuntimeWorkerQueueState,
  deadLetterRuntimeWorkerQueueItem,
  enqueueRuntimeWorkerQueueItem,
  planRuntimeWorkerQueueTick,
  type RuntimeWorkerQueueItemInput,
} from "@/lib/runtime-server-minimal";

const now = "2026-04-24T00:00:00.000Z";

function buildThread() {
  return buildRuntimeServerMinimalThread({
    threadKey: "runtime-thread-1",
    surface: "/operating",
    generatedAt: now,
    events: [
      {
        eventKey: "lifecycle-1",
        kind: "lifecycle_event",
        threadKey: "runtime-thread-1",
        sourceRef: "run-thread:lifecycle",
        occurredAt: "2026-04-24T00:00:01.000Z",
        summary: "Run thread entered a reviewable local runtime state.",
        lifecycleState: "waiting_for_review",
      },
      {
        eventKey: "review-1",
        kind: "review_request",
        threadKey: "runtime-thread-1",
        sourceRef: "review:request",
        occurredAt: "2026-04-24T00:00:02.000Z",
        summary: "Operator review requested before lifecycle can continue.",
        reviewState: "requested",
      },
      {
        eventKey: "ack-1",
        kind: "acknowledgement",
        threadKey: "runtime-thread-1",
        sourceRef: "ack:receipt",
        occurredAt: "2026-04-24T00:00:03.000Z",
        summary: "Receipt was captured but official success is not confirmed.",
        acknowledgement: {
          acknowledgementStatus: "success",
          acknowledgementEventId: "workflow.acknowledgement",
          receiptRef: "receipt:ack-1",
          officialSuccess: false,
        },
      },
      {
        eventKey: "monitor-1",
        kind: "monitor_event",
        threadKey: "runtime-thread-1",
        sourceRef: "monitor:event",
        occurredAt: "2026-04-24T00:00:04.000Z",
        summary: "Monitor event should be reviewed before follow-through.",
        monitor: {
          severity: "escalate",
          reasonCode: "review_queue_drift",
          routeToReview: true,
        },
      },
      {
        eventKey: "handoff-1",
        kind: "handoff",
        threadKey: "runtime-thread-1",
        sourceRef: "handoff:packet",
        occurredAt: "2026-04-24T00:00:05.000Z",
        summary: "Handoff packet is ready for local operator decision.",
        handoff: {
          handoffId: "handoff.packet.created",
          target: "operator",
        },
      },
    ],
  });
}

describe("runtime server minimal", () => {
  it("builds a shared local runtime seam across lifecycle, review, acknowledgement, monitor, and handoff", () => {
    const thread = buildThread();

    expect(thread.posture).toBe("review_required");
    expect(thread.lifecycle.state).toBe("waiting_for_review");
    expect(thread.reviewRequest.state).toBe("requested");
    expect(thread.acknowledgement.state).toBe("received");
    expect(thread.acknowledgement.officialSuccess).toBe(false);
    expect(thread.monitor).toMatchObject({
      severity: "escalate",
      routeToReview: true,
      reasonCodes: ["review_queue_drift"],
    });
    expect(thread.handoff).toMatchObject({
      state: "ready",
      handoffId: "handoff.packet.created",
      target: "operator",
    });
    expect(thread.sourceChain.map((step) => step.step)).toEqual([
      "lifecycle_event",
      "review_request",
      "acknowledgement",
      "monitor_event",
      "handoff",
      "worker_queue",
      "authority_boundary",
    ]);
    expect(thread.workerQueueCandidates.map((item) => item.kind)).toEqual([
      "lifecycle_projection",
      "review_request_projection",
      "acknowledgement_reconciliation",
      "monitor_event_projection",
      "handoff_projection",
    ]);
    expect(thread.boundaryNotes).toContain(
      "运行时 server minimal 不创建 remote execution plane",
    );
  });

  it("keeps acknowledgement separate from official success unless receipt truth confirms success", () => {
    const thread = buildRuntimeServerMinimalThread({
      threadKey: "runtime-thread-ack",
      surface: "local_harness",
      generatedAt: now,
      events: [
        {
          eventKey: "lifecycle-1",
          kind: "lifecycle_event",
          threadKey: "runtime-thread-ack",
          sourceRef: "run-thread:lifecycle",
          summary: "Thread is running.",
          lifecycleState: "running",
        },
        {
          eventKey: "ack-1",
          kind: "acknowledgement",
          threadKey: "runtime-thread-ack",
          sourceRef: "ack:receipt",
          summary: "Success receipt captured.",
          acknowledgement: {
            acknowledgementStatus: "success",
            receiptRef: "receipt:ack-1",
            officialSuccess: true,
          },
        },
      ],
    });

    expect(thread.acknowledgement.state).toBe("success_confirmed");
    expect(thread.acknowledgement.officialSuccess).toBe(true);
    expect(thread.posture).toBe("ready");
  });

  it("enqueues local runtime worker items idempotently", () => {
    const thread = buildThread();
    const queue = createRuntimeWorkerQueueState();
    const first = enqueueRuntimeWorkerQueueItem(queue, thread.workerQueueCandidates[0]);
    const duplicate = enqueueRuntimeWorkerQueueItem(first.state, thread.workerQueueCandidates[0]);

    expect(first.admission).toMatchObject({
      outcome: "accepted",
      queueDepth: 1,
    });
    expect(duplicate.admission).toMatchObject({
      outcome: "duplicate",
      queueDepth: 1,
    });
    expect(duplicate.state.pending).toHaveLength(1);
    expect(duplicate.state.duplicateKeys).toEqual([thread.workerQueueCandidates[0].idempotencyKey]);
  });

  it("plans a narrow worker tick without executing external side effects", () => {
    const thread = buildThread();
    let queue = createRuntimeWorkerQueueState();
    for (const item of thread.workerQueueCandidates) {
      queue = enqueueRuntimeWorkerQueueItem(queue, item).state;
    }

    const tick = planRuntimeWorkerQueueTick(queue, {
      now,
      leaseToken: "lease:review",
      leaseMs: 60_000,
    });

    expect(tick.tick.mode).toBe("operator_review");
    expect(tick.tick.item).toMatchObject({
      kind: "review_request_projection",
      status: "leased",
      leaseToken: "lease:review",
    });
    expect(tick.tick.forbiddenActions).toEqual([
      "remote_execution",
      "real_sandbox",
      "swarm_ui",
      "external_side_effect",
    ]);
    expect(tick.state.pending).toHaveLength(4);
    expect(tick.state.leased).toHaveLength(1);
  });

  it("blocks remote execution, real sandbox, swarm UI, and external side effect queue items", () => {
    const unsupportedEffects: RuntimeWorkerQueueItemInput["effect"][] = [
      "remote_execution",
      "real_sandbox",
      "swarm_ui",
      "external_side_effect",
    ];

    let queue = createRuntimeWorkerQueueState();
    for (const effect of unsupportedEffects) {
      queue = enqueueRuntimeWorkerQueueItem(queue, {
        itemKey: `unsupported-${effect}`,
        idempotencyKey: `unsupported-${effect}`,
        threadKey: "runtime-thread-1",
        sourceEventKey: `event-${effect}`,
        kind: "lifecycle_projection",
        effect,
        summary: `Unsupported ${effect}`,
      }).state;
    }

    expect(queue.pending).toHaveLength(0);
    expect(queue.blocked).toHaveLength(4);
    expect(queue.blocked.map((item) => item.blockedReason).join("\n")).toContain(
      "remote execution plane",
    );
    expect(queue.blocked.map((item) => item.blockedReason).join("\n")).toContain(
      "real sandbox",
    );
    expect(queue.blocked.map((item) => item.blockedReason).join("\n")).toContain(
      "swarm UI",
    );
    expect(queue.blocked.map((item) => item.blockedReason).join("\n")).toContain(
      "external side effects",
    );
  });

  it("completes and dead-letters only leased or local queue items", () => {
    const thread = buildThread();
    const queue = enqueueRuntimeWorkerQueueItem(
      createRuntimeWorkerQueueState(),
      thread.workerQueueCandidates[0],
    ).state;
    const tick = planRuntimeWorkerQueueTick(queue, {
      now,
      leaseToken: "lease:lifecycle",
    });
    const complete = completeRuntimeWorkerQueueItem(tick.state, {
      itemKey: tick.tick.item?.itemKey ?? "",
      leaseToken: "lease:lifecycle",
      completedAt: now,
      resultSummary: "Projected lifecycle locally.",
    });

    expect(complete.completed).toBe(true);
    expect(complete.state.completed).toHaveLength(1);
    expect(complete.state.completed[0]).toMatchObject({
      status: "completed",
      resultSummary: "Projected lifecycle locally.",
    });

    const deadLetter = deadLetterRuntimeWorkerQueueItem(queue, {
      itemKey: thread.workerQueueCandidates[0].itemKey,
      reason: "projection payload invalid",
    });

    expect(deadLetter.deadLetter).toHaveLength(1);
    expect(deadLetter.deadLetter[0]).toMatchObject({
      status: "dead_letter",
      blockedReason: "projection payload invalid",
    });
  });

  it("summarizes thread posture and queue counts for closeout reporting", () => {
    const reviewThread = buildThread();
    const blockedThread = buildRuntimeServerMinimalThread({
      threadKey: "runtime-thread-blocked",
      surface: "/operating",
      generatedAt: now,
      events: [
        {
          eventKey: "monitor-1",
          kind: "monitor_event",
          threadKey: "runtime-thread-blocked",
          sourceRef: "monitor:event",
          summary: "Monitor cannot run without lifecycle truth.",
          monitor: {
            severity: "blocked",
            reasonCode: "lifecycle_missing",
          },
        },
      ],
    });
    const queue = enqueueRuntimeWorkerQueueItem(
      createRuntimeWorkerQueueState(),
      reviewThread.workerQueueCandidates[0],
    ).state;

    const summary = buildRuntimeServerMinimalSummary({
      generatedAt: now,
      threads: [reviewThread, blockedThread],
      queueState: queue,
    });

    expect(summary).toMatchObject({
      totalThreads: 2,
      postureCounts: {
        ready: 0,
        review_required: 1,
        blocked: 1,
      },
      queueCounts: {
        pending: 1,
        leased: 0,
        completed: 0,
        dead_letter: 0,
        blocked: 0,
      },
      reviewThreadKeys: ["runtime-thread-1"],
      blockedThreadKeys: ["runtime-thread-blocked"],
    });
    expect(summary.primaryNextMove).toContain("Map the shared lifecycle event");
    expect(summary.boundaryNotes).toContain("执行队列不执行外部副作用");
  });
});
