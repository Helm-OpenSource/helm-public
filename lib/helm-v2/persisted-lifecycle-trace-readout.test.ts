import { describe, expect, it } from "vitest";
import { buildPersistedLifecycleTraceReadout } from "@/lib/helm-v2/persisted-lifecycle-trace-readout";

describe("buildPersistedLifecycleTraceReadout", () => {
  it("keeps provenance and reference summaries explicit when trace context exists", () => {
    const readout = buildPersistedLifecycleTraceReadout({
      state: "aligned",
      anchor: "human_input",
      checkpointId: "checkpoint_123",
      checkpointKey: "checkpoint::acme",
      resumeToken: "resume::acme",
      resumeState: "ready",
      replayRequestMode: "latest_checkpoint",
      humanInputCheckpointState: "checkpoint_ready",
      persistedLifecycleState: "synced",
      writeSideState: "human_input_anchor_written",
      refreshReason: "control_event",
      refreshSource: "operator.takeover.requested",
      compactionState: "current",
      reconciliationState: "steady",
      checkpointLineageDepth: 2,
      replayEventLogEntries: 4,
      summary: "Persisted lifecycle trace stays aligned.",
      nextAction: null,
      boundaryNote: "No control-plane widening.",
    });

    expect(readout.referenceSummary).toContain("id checkpoint_123");
    expect(readout.referenceSummary).toContain("key checkpoint::acme");
    expect(readout.referenceSummary).toContain("resume resume::acme");
    expect(readout.provenanceSummary).toContain("refresh control_event");
    expect(readout.provenanceSummary).toContain("source operator.takeover.requested");
    expect(readout.integritySummary).toContain("lifecycle synced");
    expect(readout.integritySummary).toContain("write human_input_anchor_written");
    expect(readout.integritySummary).toContain("compact current");
    expect(readout.integritySummary).toContain("reconcile steady");
    expect(readout.integritySummary).toContain("2 checkpoint anchor(s)");
    expect(readout.integritySummary).toContain("4 replay event(s)");
    expect(readout.compactSummary).toContain("aligned");
    expect(readout.compactSummary).toContain("human_input");
  });

  it("stays compact when only state and anchor are available", () => {
    const readout = buildPersistedLifecycleTraceReadout({
      state: "refresh_required",
      anchor: "checkpoint",
      checkpointId: null,
      checkpointKey: null,
      resumeToken: null,
      resumeState: "not_available",
      replayRequestMode: "none",
      humanInputCheckpointState: "not_available",
      persistedLifecycleState: "missing",
      writeSideState: "not_persisted",
      refreshReason: null,
      refreshSource: null,
      compactionState: "backfill_required",
      reconciliationState: "backfill_required",
      checkpointLineageDepth: 0,
      replayEventLogEntries: 0,
      summary: "Persisted lifecycle trace needs a refresh.",
      nextAction: "Refresh the persisted trace before comparing anchors.",
      boundaryNote: "Read-only debugging only.",
    });

    expect(readout.referenceSummary).toBeNull();
    expect(readout.provenanceSummary).toBeNull();
    expect(readout.integritySummary).toBe(
      "lifecycle missing · write not_persisted · compact backfill_required · reconcile backfill_required · 0 checkpoint anchor(s) · 0 replay event(s)",
    );
    expect(readout.compactSummary).toBe("refresh_required · checkpoint");
  });
});
