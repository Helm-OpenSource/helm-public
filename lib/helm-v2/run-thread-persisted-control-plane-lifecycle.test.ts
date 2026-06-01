import { describe, expect, it } from "vitest";

import { buildRunThreadContract } from "@/lib/helm-v2/run-thread-contract";
import {
  buildRunThreadPersistedControlPlaneLifecycle,
  buildRunThreadPersistedControlPlaneLifecycleSnapshot,
  diffRunThreadPersistedControlPlaneLifecycleSnapshot,
  parseRunThreadPersistedControlPlaneLifecycleSnapshot,
  shouldReuseRunThreadPersistedControlPlaneLifecycleSnapshot,
} from "@/lib/helm-v2/run-thread-persisted-control-plane-lifecycle";

function buildTestRunThread() {
  return buildRunThreadContract({
    id: "session_persisted_1",
    workspaceId: "workspace_persisted_1",
    sessionKey: "workspace_persisted_1:runtime-session:event_1",
    status: "ACTIVE",
    currentStage: "review_confirmed",
    sourcePage: "/meetings/meeting_persisted_1",
    boundaryNote: "Review-first runtime only.",
    meetingId: "meeting_persisted_1",
    replayableEventLog: JSON.stringify([{ stage: "meeting_ingest", at: "2026-04-13T01:00:00.000Z" }]),
    resumedFromKey: null,
    createdAt: new Date("2026-04-13T01:00:00.000Z"),
    updatedAt: new Date("2026-04-13T01:05:00.000Z"),
    closedAt: null,
    checkpoints: [
      {
        id: "checkpoint_persisted_1",
        checkpointKey: "checkpoint::persisted-1",
        label: "persisted_anchor",
        status: "READY",
        summary: "Checkpoint remains ready for bounded review.",
        createdAt: new Date("2026-04-13T01:02:00.000Z"),
        updatedAt: new Date("2026-04-13T01:02:00.000Z"),
      },
    ],
    resultAcknowledgements: [
      {
        id: "ack_persisted_1",
        source: "human_execution",
        state: "acknowledged",
        summary: "Human execution was acknowledged.",
        timestamp: new Date("2026-04-13T01:04:00.000Z"),
      },
    ],
  });
}

describe("run thread persisted control-plane lifecycle", () => {
  it("round-trips a persisted lifecycle snapshot and reports a synced state", () => {
    const runThread = buildTestRunThread();
    const snapshot = buildRunThreadPersistedControlPlaneLifecycleSnapshot(
      runThread,
      new Date("2026-04-13T01:06:00.000Z"),
      {
        refreshReason: "control_event",
        refreshSource: "operator.takeover.requested",
      },
    );
    const parsed = parseRunThreadPersistedControlPlaneLifecycleSnapshot(JSON.stringify(snapshot));
    const summary = buildRunThreadPersistedControlPlaneLifecycle({
      runThread,
      snapshot: parsed,
    });

    expect(parsed?.schemaVersion).toBe("helm-v2-run-thread-control-plane-lifecycle-v1");
    expect(parsed?.stageKey).toBe("review_confirmed");
    expect(parsed?.resumeState).toBe("ready");
    expect(parsed?.latestCheckpointState).toBe("ready");
    expect(parsed?.latestCheckpointKey).toBe("checkpoint::persisted-1");
    expect(parsed?.checkpointLineageDepth).toBe(1);
    expect(parsed?.replayRequestMode).toBe("latest_checkpoint");
    expect(parsed?.replayCheckpointKey).toBe("checkpoint::persisted-1");
    expect(parsed?.replayEventLogEntries).toBe(1);
    expect(parsed?.humanInputCheckpointState).toBe("checkpoint_ready");
    expect(parsed?.humanInputCheckpointKey).toBe("checkpoint::persisted-1");
    expect(parsed?.lastRefreshReason).toBe("control_event");
    expect(parsed?.lastRefreshSource).toBe("operator.takeover.requested");
    expect(parsed?.writeAnchor).toBe("human_input");
    expect(parsed?.writeCheckpointKey).toBe("checkpoint::persisted-1");
    expect(summary.state).toBe("synced");
    expect(summary.guardPolicy.state).toBe("reuse_current_snapshot");
    expect(summary.guardPolicy.shouldReuseSnapshot).toBe(true);
    expect(summary.guardPolicy.shouldPersistSnapshot).toBe(false);
    expect(summary.writeSide.state).toBe("human_input_anchor_written");
    expect(summary.writeSide.refreshReason).toBe("control_event");
    expect(summary.snapshot?.closePostureState).toBe(runThread.closePostureSummary.state);
    expect(summary.snapshot?.sourceUpdatedAt.toISOString()).toBe("2026-04-13T01:05:00.000Z");
    expect(summary.compactionPolicy.state).toBe("current");
    expect(summary.reconciliationPolicy.state).toBe("steady");
    expect(summary.repairPolicy.state).toBe("not_required");
  });

  it("flags drift when the persisted lifecycle snapshot no longer matches current control truth", () => {
    const runThread = buildTestRunThread();
    const snapshot = buildRunThreadPersistedControlPlaneLifecycleSnapshot(runThread);
    const drifted = {
      ...snapshot,
      closePostureState: "closed" as const,
      closeResolutionState: "closed" as const,
      replayRequestMode: "resume_anchor" as const,
      replayCheckpointKey: "checkpoint::persisted-resume" as const,
      checkpointLineageDepth: 2,
    };

    const driftKeys = diffRunThreadPersistedControlPlaneLifecycleSnapshot({
      runThread,
      snapshot: drifted,
    });
    const summary = buildRunThreadPersistedControlPlaneLifecycle({
      runThread,
      snapshot: drifted,
    });

    expect(driftKeys).toContain("closePostureState");
    expect(driftKeys).toContain("closeResolutionState");
    expect(driftKeys).toContain("replayRequestMode");
    expect(driftKeys).toContain("replayCheckpointKey");
    expect(driftKeys).toContain("checkpointLineageDepth");
    expect(summary.state).toBe("drifted");
    expect(summary.driftKeys).toContain("closePostureState");
    expect(summary.guardPolicy.state).toBe("rewrite_required");
    expect(summary.guardPolicy.shouldReuseSnapshot).toBe(false);
    expect(summary.guardPolicy.shouldPersistSnapshot).toBe(true);
    expect(summary.compactionPolicy.state).toBe("replace_required");
    expect(summary.reconciliationPolicy.state).toBe("refresh_required");
    expect(summary.repairPolicy.state).toBe("rewrite_drifted_snapshot");
  });

  it("marks materially aligned but older persisted snapshots as compacted and reusable", () => {
    const runThread = buildTestRunThread();
    const snapshot = buildRunThreadPersistedControlPlaneLifecycleSnapshot(
      {
        ...runThread,
        updatedAt: new Date("2026-04-13T01:04:00.000Z"),
      },
      new Date("2026-04-13T01:04:30.000Z"),
    );
    const summary = buildRunThreadPersistedControlPlaneLifecycle({
      runThread,
      snapshot,
    });

    expect(summary.state).toBe("synced");
    expect(summary.guardPolicy.state).toBe("reuse_compacted_snapshot");
    expect(summary.guardPolicy.shouldReuseSnapshot).toBe(true);
    expect(summary.guardPolicy.shouldPersistSnapshot).toBe(false);
    expect(summary.compactionPolicy.state).toBe("compacted");
    expect(summary.reconciliationPolicy.state).toBe("steady");
    expect(summary.repairPolicy.state).toBe("not_required");
    expect(
      shouldReuseRunThreadPersistedControlPlaneLifecycleSnapshot({
        runThread,
        snapshot,
        parseFailed: false,
      }),
    ).toBe(true);
  });

  it("falls back to event truth when the persisted snapshot cannot be parsed", () => {
    const runThread = buildTestRunThread();
    const summary = buildRunThreadPersistedControlPlaneLifecycle({
      runThread,
      snapshot: null,
      parseFailed: true,
    });

    expect(summary.state).toBe("invalid");
    expect(summary.guardPolicy.state).toBe("fallback_to_event_truth");
    expect(summary.guardPolicy.shouldReuseSnapshot).toBe(false);
    expect(summary.guardPolicy.shouldPersistSnapshot).toBe(true);
    expect(summary.compactionPolicy.state).toBe("invalid");
    expect(summary.reconciliationPolicy.state).toBe("fallback_to_event_truth");
    expect(summary.repairPolicy.state).toBe("rewrite_invalid_snapshot");
    expect(
      shouldReuseRunThreadPersistedControlPlaneLifecycleSnapshot({
        runThread,
        snapshot: null,
        parseFailed: true,
      }),
    ).toBe(false);
  });

  it("keeps missing persisted lifecycle repair bounded to the next safe refresh", () => {
    const runThread = buildTestRunThread();
    const summary = buildRunThreadPersistedControlPlaneLifecycle({
      runThread,
      snapshot: null,
      parseFailed: false,
    });

    expect(summary.state).toBe("missing");
    expect(summary.guardPolicy.state).toBe("backfill_required");
    expect(summary.guardPolicy.shouldReuseSnapshot).toBe(false);
    expect(summary.guardPolicy.shouldPersistSnapshot).toBe(true);
    expect(summary.compactionPolicy.state).toBe("backfill_required");
    expect(summary.reconciliationPolicy.state).toBe("backfill_required");
    expect(summary.repairPolicy.state).toBe("backfill_on_next_refresh");
    expect(summary.repairPolicy.nextAction).toContain("Backfill the first persisted lifecycle snapshot");
  });

  it("keeps older v1 snapshots readable when replay and recovery anchor fields are absent", () => {
    const runThread = buildTestRunThread();
    const snapshot = buildRunThreadPersistedControlPlaneLifecycleSnapshot(runThread);
    const legacyPayload = JSON.parse(JSON.stringify(snapshot)) as Record<string, unknown>;
    delete legacyPayload.resumeState;
    delete legacyPayload.latestCheckpointState;
    delete legacyPayload.latestCheckpointKey;
    delete legacyPayload.latestCheckpointResumeToken;
    delete legacyPayload.checkpointLineageDepth;
    delete legacyPayload.replayRequestMode;
    delete legacyPayload.replayCheckpointKey;
    delete legacyPayload.replayResumeToken;
    delete legacyPayload.replayEventLogEntries;
    delete legacyPayload.humanInputCheckpointState;
    delete legacyPayload.humanInputCheckpointKey;
    delete legacyPayload.lastRefreshReason;
    delete legacyPayload.lastRefreshSource;
    delete legacyPayload.writeAnchor;
    delete legacyPayload.writeCheckpointKey;
    delete legacyPayload.writeResumeToken;

    const parsed = parseRunThreadPersistedControlPlaneLifecycleSnapshot(JSON.stringify(legacyPayload));

    expect(parsed?.resumeState).toBe("not_available");
    expect(parsed?.latestCheckpointState).toBe("not_available");
    expect(parsed?.checkpointLineageDepth).toBe(0);
    expect(parsed?.replayRequestMode).toBe("none");
    expect(parsed?.replayEventLogEntries).toBe(0);
    expect(parsed?.humanInputCheckpointState).toBe("not_available");
    expect(parsed?.humanInputCheckpointKey).toBeNull();
    expect(parsed?.lastRefreshReason).toBeNull();
    expect(parsed?.writeAnchor).toBe("none");
    expect(parsed?.writeCheckpointKey).toBeNull();
  });

  it("captures checkpoint resume as an explicit persisted write-side anchor", () => {
    const runThread = buildTestRunThread();
    const snapshot = buildRunThreadPersistedControlPlaneLifecycleSnapshot(
      {
        ...runThread,
        resume: {
          ...runThread.resume,
          resumedFromCheckpointId: "checkpoint_persisted_1",
          resumedFromCheckpointKey: "checkpoint::persisted-1",
          resumeToken: "checkpoint::persisted-1",
        },
        humanInputCheckpoint: {
          ...runThread.humanInputCheckpoint,
          state: "not_available",
          checkpointId: null,
          checkpointKey: null,
          summary: "No human input checkpoint is active.",
        },
      },
      new Date("2026-04-13T01:06:00.000Z"),
      {
        refreshReason: "checkpoint_resume",
        refreshSource: "checkpoint::persisted-1",
      },
    );
    const summary = buildRunThreadPersistedControlPlaneLifecycle({
      runThread: {
        ...runThread,
        resume: {
          ...runThread.resume,
          resumedFromCheckpointId: "checkpoint_persisted_1",
          resumedFromCheckpointKey: "checkpoint::persisted-1",
          resumeToken: "checkpoint::persisted-1",
        },
        humanInputCheckpoint: {
          ...runThread.humanInputCheckpoint,
          state: "not_available",
          checkpointId: null,
          checkpointKey: null,
          summary: "No human input checkpoint is active.",
        },
      },
      snapshot,
    });

    expect(snapshot.lastRefreshReason).toBe("checkpoint_resume");
    expect(snapshot.writeAnchor).toBe("resume");
    expect(snapshot.writeCheckpointKey).toBe("checkpoint::persisted-1");
    expect(summary.writeSide.state).toBe("resume_anchor_written");
    expect(summary.writeSide.refreshSource).toBe("checkpoint::persisted-1");
  });
});
