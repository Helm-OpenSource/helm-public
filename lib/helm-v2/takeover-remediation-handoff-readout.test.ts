import { describe, expect, it } from "vitest";
import { buildTakeoverRemediationHandoffReadout } from "@/lib/helm-v2/takeover-remediation-handoff-readout";

describe("buildTakeoverRemediationHandoffReadout", () => {
  it("keeps takeover and remediation provenance explicit when a bounded handoff is active", () => {
    const readout = buildTakeoverRemediationHandoffReadout({
      takeoverAssistance: {
        posture: "checkpoint_ready",
        recommendedAction: "SAVE_RECOVERY_CHECKPOINT",
        summary: "Operator takeover can stay bounded on the visible checkpoint anchor.",
        checklist: ["Checkpoint anchor is visible."],
        boundaryNote: "Review-first only.",
      },
      takeoverRequest: {
        state: "acknowledged",
        requestEventId: "request_1",
        acknowledgementEventId: "ack_1",
        action: "SAVE_RECOVERY_CHECKPOINT",
        checkpointId: "checkpoint_1",
        checkpointKey: "checkpoint::alpha",
        resumeToken: "resume::alpha",
        requestedAt: new Date("2026-04-22T02:00:00.000Z"),
        requestedBy: "operator@demo.com",
        sourcePage: "/operating",
        acknowledgedAt: new Date("2026-04-22T02:02:00.000Z"),
        acknowledgedBy: "founder@demo.com",
        summary: "Takeover request is acknowledged and waiting for explicit start.",
        boundaryNote: "Request lane only.",
      },
      takeoverActivation: {
        state: "active",
        startEventId: "start_1",
        releaseEventId: null,
        requestEventId: "request_1",
        acknowledgementEventId: "ack_1",
        action: "SAVE_RECOVERY_CHECKPOINT",
        checkpointId: "checkpoint_1",
        checkpointKey: "checkpoint::alpha",
        resumeToken: "resume::alpha",
        currentOwner: "operator@demo.com",
        latestEventKind: "started",
        startedAt: new Date("2026-04-22T02:03:00.000Z"),
        startedBy: "operator@demo.com",
        releasedAt: null,
        releasedBy: null,
        releaseReason: null,
        sourcePage: "/meetings/meeting_alpha",
        summary: "Takeover is active on checkpoint::alpha.",
        boundaryNote: "Bounded activation only.",
      },
      takeoverFollowThrough: {
        state: "requestable",
        requestEventId: null,
        resolutionEventId: null,
        takeoverRequestEventId: "request_1",
        acknowledgementEventId: "ack_1",
        startEventId: "start_1",
        releaseEventId: null,
        action: "SAVE_RECOVERY_CHECKPOINT",
        checkpointId: "checkpoint_1",
        checkpointKey: "checkpoint::alpha",
        resumeToken: "resume::alpha",
        currentOwner: "operator@demo.com",
        summary: "Follow-through can be requested after takeover release.",
        nextAction: "Request closeout when operator control is released.",
        requestedAt: null,
        requestedBy: null,
        resolvedAt: null,
        resolvedBy: null,
        sourcePage: "/operating",
        boundaryNote: "Follow-through stays manual.",
      },
      recoveryLifecycleContract: {
        state: "activation_lane",
        driver: "takeover_activation",
        nextTransition: "release_takeover",
        summary: "Debugger recovery lifecycle is on the activation lane.",
      },
      latestRemediation: {
        id: "remediation_1",
        action: "SAVE_RECOVERY_CHECKPOINT",
        executionStatus: "APPLIED",
        summary: "Checkpoint save already completed.",
        rollbackAnchorSummary: "rollback anchor checkpoint::alpha",
        triggeredBy: "operator@demo.com",
        createdAt: new Date("2026-04-22T02:04:00.000Z"),
      },
    });

    expect(readout.compactSummary).toContain("lane activation_lane");
    expect(readout.compactSummary).toContain("takeover checkpoint_ready");
    expect(readout.requestSummary).toContain("requested by operator@demo.com");
    expect(readout.requestSummary).toContain("acknowledged by founder@demo.com");
    expect(readout.activationSummary).toContain("owner operator@demo.com");
    expect(readout.followThroughSummary).toContain("Follow-through can be requested");
    expect(readout.remediationSummary).toContain("APPLIED SAVE_RECOVERY_CHECKPOINT");
    expect(readout.provenanceSummary).toContain("request /operating");
    expect(readout.provenanceSummary).toContain("activation /meetings/meeting_alpha");
  });

  it("stays compact when only thin takeover states are visible", () => {
    const readout = buildTakeoverRemediationHandoffReadout({
      takeoverAssistance: {
        posture: "blocked",
        recommendedAction: null,
        summary: "Takeover is blocked until a trustworthy anchor exists.",
        checklist: [],
        boundaryNote: "Review-first only.",
      },
      takeoverRequest: {
        state: "not_requestable",
        requestEventId: null,
        acknowledgementEventId: null,
        action: null,
        checkpointId: null,
        checkpointKey: null,
        resumeToken: null,
        requestedAt: null,
        requestedBy: null,
        sourcePage: null,
        acknowledgedAt: null,
        acknowledgedBy: null,
        summary: "No takeover request exists.",
        boundaryNote: "No request lane.",
      },
      takeoverActivation: {
        state: "inactive",
        startEventId: null,
        releaseEventId: null,
        requestEventId: null,
        acknowledgementEventId: null,
        action: null,
        checkpointId: null,
        checkpointKey: null,
        resumeToken: null,
        currentOwner: null,
        latestEventKind: "none",
        startedAt: null,
        startedBy: null,
        releasedAt: null,
        releasedBy: null,
        releaseReason: null,
        sourcePage: null,
        summary: "Takeover has not started.",
        boundaryNote: "No activation lane.",
      },
      takeoverFollowThrough: {
        state: "not_requestable",
        requestEventId: null,
        resolutionEventId: null,
        takeoverRequestEventId: null,
        acknowledgementEventId: null,
        startEventId: null,
        releaseEventId: null,
        action: null,
        checkpointId: null,
        checkpointKey: null,
        resumeToken: null,
        currentOwner: null,
        summary: "No follow-through lane is open.",
        nextAction: null,
        requestedAt: null,
        requestedBy: null,
        resolvedAt: null,
        resolvedBy: null,
        sourcePage: null,
        boundaryNote: "No follow-through lane.",
      },
      recoveryLifecycleContract: {
        state: "observe",
        driver: "observe",
        nextTransition: "observe",
        summary: "Debugger recovery lifecycle is currently observing.",
      },
      latestRemediation: null,
    });

    expect(readout.compactSummary).toBe(
      "lane observe · takeover blocked · request not_requestable · activation inactive · follow-through not_requestable",
    );
    expect(readout.remediationSummary).toBeNull();
    expect(readout.provenanceSummary).toBeNull();
    expect(readout.assistanceSummary).toBe("Takeover is blocked until a trustworthy anchor exists.");
  });
});
