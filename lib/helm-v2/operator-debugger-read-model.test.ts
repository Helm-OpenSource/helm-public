import { describe, expect, it } from "vitest";
import { buildOperatorDebuggerReadModel } from "@/lib/helm-v2/operator-debugger-read-model";
import { buildRunThreadContract } from "@/lib/helm-v2/run-thread-contract";
import { buildRunThreadPersistedControlPlaneLifecycleSnapshot } from "@/lib/helm-v2/run-thread-persisted-control-plane-lifecycle";

describe("operator debugger read model", () => {
  it("builds debugger history and variable snapshot from the canonical run thread spine", () => {
    const baselineRunThread = buildRunThreadContract({
      id: "session_1",
      workspaceId: "workspace_1",
      sessionKey: "session::acme",
      status: "ACTIVE",
      currentStage: "review_confirmed",
      sourcePage: "/meetings/meeting_1",
      boundaryNote: "Review-first runtime only.",
      meetingId: "meeting_1",
      replayableEventLog: JSON.stringify([
        {
          at: "2026-04-11T08:05:00.000Z",
          type: "runtime.trace",
          stage: "meeting_ingest",
          summary: "Meeting ingest completed.",
        },
      ]),
      resumedFromKey: null,
      createdAt: new Date("2026-04-11T08:00:00.000Z"),
      updatedAt: new Date("2026-04-11T08:20:00.000Z"),
      closedAt: null,
      checkpoints: [
        {
          id: "checkpoint_1",
          checkpointKey: "checkpoint::acme",
          label: "meeting_review",
          status: "READY",
          summary: "Checkpoint is ready for replay.",
          createdAt: new Date("2026-04-11T08:10:00.000Z"),
          updatedAt: new Date("2026-04-11T08:10:00.000Z"),
        },
      ],
      handoffPackets: [
        {
          id: "handoff_1",
          packetKey: "handoff::session_1::verification",
          fromAgent: "meeting-analyst",
          toAgent: "verification-agent",
          goal: "Prepare the verification report for the confirmed facts slice.",
          approvalTier: "A1",
          checkpointRef: "checkpoint::acme",
          createdAt: new Date("2026-04-11T08:16:00.000Z"),
        },
      ],
      remediationTrace: [
        {
          id: "remediation_1",
          action: "SAVE_RECOVERY_CHECKPOINT",
          executionStatus: "REVIEW_REQUIRED",
          summary: "Checkpoint save still needs review.",
          rollbackAnchorSummary: "meeting_review · READY",
          triggeredBy: "verification-agent",
          createdAt: new Date("2026-04-11T08:18:00.000Z"),
        },
      ],
      resultAcknowledgements: [
        {
          id: "ack_1",
          source: "official_write",
          state: "acknowledged",
          summary: "Guarded official write crm.attach_note for opportunity:opp_1 is acknowledged.",
          timestamp: new Date("2026-04-11T08:18:30.000Z"),
        },
      ],
    });
    const runThread = buildRunThreadContract({
      id: "session_1",
      workspaceId: "workspace_1",
      sessionKey: "session::acme",
      status: "ACTIVE",
      currentStage: "review_confirmed",
      sourcePage: "/meetings/meeting_1",
      boundaryNote: "Review-first runtime only.",
      meetingId: "meeting_1",
      replayableEventLog: JSON.stringify([
        {
          at: "2026-04-11T08:05:00.000Z",
          type: "runtime.trace",
          stage: "meeting_ingest",
          summary: "Meeting ingest completed.",
        },
      ]),
      resumedFromKey: null,
      createdAt: new Date("2026-04-11T08:00:00.000Z"),
      updatedAt: new Date("2026-04-11T08:20:00.000Z"),
      closedAt: null,
      checkpoints: [
        {
          id: "checkpoint_1",
          checkpointKey: "checkpoint::acme",
          label: "meeting_review",
          status: "READY",
          summary: "Checkpoint is ready for replay.",
          createdAt: new Date("2026-04-11T08:10:00.000Z"),
          updatedAt: new Date("2026-04-11T08:10:00.000Z"),
        },
      ],
      handoffPackets: [
        {
          id: "handoff_1",
          packetKey: "handoff::session_1::verification",
          fromAgent: "meeting-analyst",
          toAgent: "verification-agent",
          goal: "Prepare the verification report for the confirmed facts slice.",
          approvalTier: "A1",
          checkpointRef: "checkpoint::acme",
          createdAt: new Date("2026-04-11T08:16:00.000Z"),
        },
      ],
      remediationTrace: [
        {
          id: "remediation_1",
          action: "SAVE_RECOVERY_CHECKPOINT",
          executionStatus: "REVIEW_REQUIRED",
          summary: "Checkpoint save still needs review.",
          rollbackAnchorSummary: "meeting_review · READY",
          triggeredBy: "verification-agent",
          createdAt: new Date("2026-04-11T08:18:00.000Z"),
        },
      ],
      resultAcknowledgements: [
        {
          id: "ack_1",
          source: "official_write",
          state: "acknowledged",
          summary: "Guarded official write crm.attach_note for opportunity:opp_1 is acknowledged.",
          timestamp: new Date("2026-04-11T08:18:30.000Z"),
        },
      ],
      persistedControlPlaneLifecycle: {
        snapshot: buildRunThreadPersistedControlPlaneLifecycleSnapshot(
          baselineRunThread,
          new Date("2026-04-11T08:19:00.000Z"),
          {
            refreshReason: "control_event",
            refreshSource: "operator.takeover.requested",
          },
        ),
        parseFailed: false,
      },
    });

    const debuggerReadModel = buildOperatorDebuggerReadModel({
      sessionLabel: "Acme review session",
      runThread,
      replayableEventLog: JSON.stringify([
        {
          at: "2026-04-11T08:05:00.000Z",
          type: "runtime.trace",
          stage: "meeting_ingest",
          summary: "Meeting ingest completed.",
        },
      ]),
      replay: {
        fidelityStatus: "WATCH",
        fidelityScore: 82,
        replaySummary: "Replay preserved key blockers but still needs operator confirmation on owner alignment.",
        checkpointId: "checkpoint_1",
        checkpointLabel: "meeting_review",
        updatedAt: new Date("2026-04-11T08:10:00.000Z"),
      },
      recovery: {
        state: "RECOVERABLE",
        failureTaxonomy: "REPLAY_DRIFT",
        summary: "Current replay is recoverable with a bounded checkpoint restore.",
        operatorAction: "Restore the latest checkpoint if the current continuity state should return to the last verified snapshot.",
        allowedActions: ["RESUME_CHECKPOINT"],
        reviewReasons: ["Replay fidelity is watch-level and still needs operator confirmation."],
        blockedReasons: [],
        rollbackAnchor: {
          checkpointId: "checkpoint_1",
          checkpointLabel: "meeting_review",
          checkpointStatus: "READY",
        },
      },
      notebookState: {
        objective: "Confirm the security review owner.",
        reviewState: "needs_review",
        confirmedFacts: ["Checklist stays internal."],
        blockers: ["Owner confirmation is still missing."],
        decisions: ["Alice owns the next step."],
        nextActions: ["Assign Alice to close the blocker."],
        openQuestions: ["Who confirms the deadline?"],
        boundaryNote: "Review-first runtime only.",
      },
      payloadState: {
        activeHandles: ["payload://meeting_note/1/summary"],
        prunedHandles: ["payload://meeting_transcript/1/transcript"],
        stateSource: "checkpoint_snapshot",
        stateSummary: "Checkpoint snapshot is active.",
      },
      verification: {
        status: "NEEDS_REVIEW",
        blockedReasons: ["Owner confirmation is still missing."],
      },
      contextEditEvents: [
        {
          id: "edit_1",
          strategy: "manual_budget_prune",
          beforeTokenCount: 140,
          afterTokenCount: 84,
          removedSummary: "Transcript overflow moved behind a handle.",
          createdAt: new Date("2026-04-11T08:12:00.000Z"),
        },
      ],
      remediationTrace: [
        {
          id: "remediation_1",
          action: "SAVE_RECOVERY_CHECKPOINT",
          executionStatus: "REVIEW_REQUIRED",
          summary: "Checkpoint save still needs review.",
          rollbackAnchorSummary: "meeting_review · READY",
          triggeredBy: "verification-agent",
          createdAt: new Date("2026-04-11T08:18:00.000Z"),
        },
      ],
      handoffPackets: [
        {
          id: "handoff_1",
          packetKey: "handoff::session_1::verification",
          fromAgent: "meeting-analyst",
          toAgent: "verification-agent",
          goal: "Prepare the verification report for the confirmed facts slice.",
          approvalTier: "A1",
          constraintsJson: JSON.stringify(["Do not widen customer-facing commitment wording."]),
          trustedRefs: JSON.stringify(["meeting:1", "artifact:meeting_facts"]),
          untrustedRefs: JSON.stringify(["draft:promise-language"]),
          requiredOutputs: JSON.stringify(["verification_report", "blocked_reasons"]),
          evidenceRefs: JSON.stringify(["meeting:1", "artifact:meeting_facts"]),
          notebookRef: "notebook_1",
          checkpointRef: "checkpoint_1",
          createdAt: new Date("2026-04-11T08:16:00.000Z"),
        },
      ],
      takeoverRequestEvent: {
        id: "takeover_request_1",
        action: "RESUME_CHECKPOINT",
        checkpointId: "checkpoint_1",
        checkpointKey: "checkpoint::acme",
        resumeToken: "checkpoint::acme",
        summary: "Operator takeover request already recorded for RESUME_CHECKPOINT on checkpoint::acme.",
        requestedBy: "founder@demo.com",
        sourcePage: "/meetings/meeting_1",
        createdAt: new Date("2026-04-11T08:19:00.000Z"),
      },
      takeoverAcknowledgementEvent: {
        id: "takeover_ack_1",
        requestEventId: "takeover_request_1",
        action: "RESUME_CHECKPOINT",
        checkpointId: "checkpoint_1",
        checkpointKey: "checkpoint::acme",
        resumeToken: "checkpoint::acme",
        summary: "Operator takeover acknowledgement recorded for RESUME_CHECKPOINT on checkpoint::acme.",
        acknowledgedBy: "founder@demo.com",
        sourcePage: "/meetings/meeting_1",
        createdAt: new Date("2026-04-11T08:19:30.000Z"),
      },
      takeoverStartEvent: {
        id: "takeover_start_1",
        requestEventId: "takeover_request_1",
        acknowledgementEventId: "takeover_ack_1",
        action: "RESUME_CHECKPOINT",
        checkpointId: "checkpoint_1",
        checkpointKey: "checkpoint::acme",
        resumeToken: "checkpoint::acme",
        summary: "Operator takeover started for RESUME_CHECKPOINT on checkpoint::acme.",
        startedBy: "founder@demo.com",
        sourcePage: "/meetings/meeting_1",
        createdAt: new Date("2026-04-11T08:19:45.000Z"),
      },
    });

    expect(debuggerReadModel.summary).toContain("session::acme");
    expect(debuggerReadModel.summary).toContain("result acknowledgement acknowledged");
    expect(debuggerReadModel.history[0]?.kind).toBe("result_acknowledged");
    expect(debuggerReadModel.history.some((item) => item.kind === "handoff_created")).toBe(true);
    expect(debuggerReadModel.history.some((item) => item.kind === "checkpoint_written")).toBe(true);
    expect(debuggerReadModel.history.some((item) => item.kind === "replay_event")).toBe(true);
    expect(debuggerReadModel.history.some((item) => item.kind === "result_acknowledged")).toBe(true);
    expect(debuggerReadModel.variableSnapshot.find((item) => item.key === "payload_state")?.value).toContain(
      "checkpoint_snapshot",
    );
    expect(debuggerReadModel.replayAssistance.fidelity).toBe("watch");
    expect(debuggerReadModel.traceContract.state).toBe("human_input_ready");
    expect(debuggerReadModel.traceContract.driver).toBe("human_input");
    expect(debuggerReadModel.traceContract.anchor).toBe("human_input");
    expect(debuggerReadModel.traceContract.checkpointKey).toBe("checkpoint::acme");
    expect(debuggerReadModel.traceContract.replayRequestMode).toBe("latest_checkpoint");
    expect(debuggerReadModel.traceContract.replayFidelity).toBe("watch");
    expect(debuggerReadModel.traceContract.humanInputRequestState).toBe("not_requestable");
    expect(debuggerReadModel.writeContract.state).toBe("human_input_active");
    expect(debuggerReadModel.writeContract.driver).toBe("human_input");
    expect(debuggerReadModel.writeContract.writeAnchor).toBe("human_input");
    expect(debuggerReadModel.writeContract.checkpointKey).toBe("checkpoint::acme");
    expect(debuggerReadModel.writeContract.traceContractState).toBe("human_input_ready");
    expect(debuggerReadModel.recoveryActionContract.state).toBe("active");
    expect(debuggerReadModel.recoveryActionContract.driver).toBe("takeover_activation");
    expect(debuggerReadModel.recoveryActionContract.action).toBe("RESUME_CHECKPOINT");
    expect(debuggerReadModel.recoveryActionContract.checkpointKey).toBe("checkpoint::acme");
    expect(debuggerReadModel.recoveryActionContract.latestRemediationExecutionStatus).toBe("REVIEW_REQUIRED");
    expect(debuggerReadModel.recoveryLifecycleContract.state).toBe("activation_lane");
    expect(debuggerReadModel.recoveryLifecycleContract.driver).toBe("takeover_activation");
    expect(debuggerReadModel.recoveryLifecycleContract.anchor).toBe("human_input");
    expect(debuggerReadModel.recoveryLifecycleContract.action).toBe("RESUME_CHECKPOINT");
    expect(debuggerReadModel.recoveryLifecycleContract.checkpointKey).toBe("checkpoint::acme");
    expect(debuggerReadModel.recoveryLifecycleContract.nextTransition).toBe("release_takeover");
    expect(debuggerReadModel.recoveryTransitionContract.state).toBe("transition_active");
    expect(debuggerReadModel.recoveryTransitionContract.driver).toBe("takeover_activation");
    expect(debuggerReadModel.recoveryTransitionContract.anchor).toBe("human_input");
    expect(debuggerReadModel.recoveryTransitionContract.transition).toBe("release_takeover");
    expect(debuggerReadModel.recoveryTransitionContract.recoveryLifecycleState).toBe(
      "activation_lane",
    );
    expect(debuggerReadModel.recoveryStateMachineContract.phase).toBe("takeover_activation");
    expect(debuggerReadModel.recoveryStateMachineContract.transitionState).toBe("active");
    expect(debuggerReadModel.recoveryStateMachineContract.currentTransition).toBe(
      "release_takeover",
    );
    expect(debuggerReadModel.recoveryStateMachineContract.allowedTransitions).toEqual([
      "release_takeover",
    ]);
    expect(debuggerReadModel.recoveryStateMachineContract.completedTransitions).toEqual([
      "request_takeover",
      "acknowledge_takeover",
      "start_takeover",
    ]);
    expect(debuggerReadModel.recoveryExecutionContract.state).toBe("active");
    expect(debuggerReadModel.recoveryExecutionContract.driver).toBe("takeover_activation");
    expect(debuggerReadModel.recoveryExecutionContract.anchor).toBe("human_input");
    expect(debuggerReadModel.recoveryExecutionContract.action).toBe("RESUME_CHECKPOINT");
    expect(debuggerReadModel.recoveryExecutionContract.currentTransition).toBe(
      "release_takeover",
    );
    expect(debuggerReadModel.recoveryExecutionContract.canExecute).toBe(false);
    expect(debuggerReadModel.recoveryExecutionContract.requiresReview).toBe(false);
    expect(debuggerReadModel.recoveryExecutionContract.checkpointKey).toBe(
      "checkpoint::acme",
    );
    expect(debuggerReadModel.persistedLifecycleTrace.state).toBe("aligned");
    expect(debuggerReadModel.persistedLifecycleTrace.anchor).toBe("human_input");
    expect(debuggerReadModel.persistedLifecycleTrace.checkpointKey).toBe("checkpoint::acme");
    expect(debuggerReadModel.persistedLifecycleTrace.resumeState).toBe("ready");
    expect(debuggerReadModel.persistedLifecycleTrace.replayRequestMode).toBe("latest_checkpoint");
    expect(debuggerReadModel.persistedLifecycleTrace.humanInputCheckpointState).toBe(
      "checkpoint_ready",
    );
    expect(debuggerReadModel.persistedLifecycleTrace.writeSideState).toBe("human_input_anchor_written");
    expect(debuggerReadModel.persistedLifecycleTrace.refreshReason).toBe("control_event");
    expect(debuggerReadModel.takeoverAssistance.posture).toBe("resume_ready");
    expect(debuggerReadModel.takeoverAssistance.recommendedAction).toBe("RESUME_CHECKPOINT");
    expect(debuggerReadModel.takeoverRequest.state).toBe("acknowledged");
    expect(debuggerReadModel.takeoverActivation.state).toBe("active");
    expect(debuggerReadModel.takeoverActivation.startedBy).toBe("founder@demo.com");
    expect(debuggerReadModel.takeoverRequest.requestedBy).toBe("founder@demo.com");
    expect(debuggerReadModel.takeoverRequest.acknowledgedBy).toBe("founder@demo.com");
    expect(debuggerReadModel.interruptReason.code).toBe("verification_blocked");
    expect(debuggerReadModel.resumeAsk.mode).toBe("resume_checkpoint");
    expect(debuggerReadModel.handoffPayload.state).toBe("ready");
    expect(debuggerReadModel.handoffPayload.toAgent).toBe("verification-agent");
    expect(debuggerReadModel.handoffPayload.checkpointKey).toBe("checkpoint::acme");
    expect(debuggerReadModel.humanInputCheckpoint.state).toBe("checkpoint_ready");
    expect(debuggerReadModel.humanInputRequest.state).toBe("not_requestable");
    expect(debuggerReadModel.variableSnapshot.find((item) => item.key === "interrupt_reason")?.value).toContain(
      "verification_blocked",
    );
    expect(debuggerReadModel.variableSnapshot.find((item) => item.key === "takeover_request")?.value).toContain(
      "acknowledged",
    );
    expect(
      debuggerReadModel.variableSnapshot.find(
        (item) => item.key === "debugger_recovery_transition_contract",
      )?.value,
    ).toContain("transition_active");
    expect(
      debuggerReadModel.variableSnapshot.find(
        (item) => item.key === "debugger_recovery_state_machine_contract",
      )?.value,
    ).toContain("takeover_activation · active · release_takeover");
    expect(
      debuggerReadModel.variableSnapshot.find((item) => item.key === "persisted_lifecycle_alignment")?.value,
    ).toContain("aligned");
    expect(
      debuggerReadModel.variableSnapshot.find((item) => item.key === "persisted_lifecycle_trace")?.value,
    ).toContain("ready/latest_checkpoint/checkpoint_ready");
    expect(
      debuggerReadModel.variableSnapshot.find((item) => item.key === "debugger_trace_contract")?.value,
    ).toContain("human_input_ready");
    expect(
      debuggerReadModel.variableSnapshot.find((item) => item.key === "debugger_write_contract")?.value,
    ).toContain("human_input_active");
    expect(
      debuggerReadModel.variableSnapshot.find(
        (item) => item.key === "debugger_recovery_lifecycle_contract",
      )?.value,
    ).toContain("activation_lane");
    expect(
      debuggerReadModel.variableSnapshot.find((item) => item.key === "persisted_lifecycle_alignment")?.value,
    ).toContain("human_input_anchor_written");
    expect(debuggerReadModel.variableSnapshot.find((item) => item.key === "takeover_activation")?.value).toContain(
      "active",
    );
    expect(debuggerReadModel.variableSnapshot.find((item) => item.key === "takeover_followthrough")?.value).toContain(
      "not_requestable",
    );
    expect(
      debuggerReadModel.variableSnapshot.find((item) => item.key === "result_acknowledgement")?.value,
    ).toContain("acknowledged");
    expect(debuggerReadModel.summary).toContain("result flow");
    expect(debuggerReadModel.summary).toContain("Trace contract human_input_ready/human_input/human_input");
    expect(debuggerReadModel.summary).toContain("write contract human_input_active/human_input/human_input");
    expect(debuggerReadModel.summary).toContain(
      "recovery lifecycle activation_lane/takeover_activation/human_input/release_takeover",
    );
    expect(debuggerReadModel.summary).toContain(
      "persisted lifecycle aligned/human_input/human_input_anchor_written/control_event",
    );
    expect(debuggerReadModel.summary).toContain("forward flow idle/0");
    expect(debuggerReadModel.summary).toContain("takeover follow-through not_requestable");
    expect(debuggerReadModel.summary).toContain("closeout flow idle/0");
    expect(debuggerReadModel.summary).toContain("closeout summary review_requestable/settlement_review");
    expect(debuggerReadModel.summary).toContain("closeout resolution not_available/no-decision");
    expect(debuggerReadModel.summary).toContain(
      "closeout resolution follow-through not_available/no-decision",
    );
    expect(debuggerReadModel.summary).toContain("closeout outcome not_available/no-decision");
    expect(debuggerReadModel.summary).toContain("close lifecycle inactive/closeout_summary");
    expect(debuggerReadModel.summary).toContain("close control review_requestable/closeout_summary");
    expect(debuggerReadModel.summary).toContain("close control flow review_requestable/close_control");
    expect(debuggerReadModel.summary).toContain("close decision flow review_requestable/close_control_flow");
    expect(debuggerReadModel.summary).toContain(
      "close decision control review_requestable/close_decision_flow",
    );
    expect(debuggerReadModel.summary).toContain(
      "close resolution not_ready/close_decision_control_summary",
    );
    expect(debuggerReadModel.summary).toContain(
      "close resolution forward review_requestable/close_decision_control_summary",
    );
    expect(debuggerReadModel.summary).toContain(
      "close resolution control not_ready/close_resolution_forward_summary",
    );
    expect(debuggerReadModel.summary).toContain(
      "close posture open/close_resolution_forward_summary",
    );
    expect(debuggerReadModel.summary).toContain(
      "close posture forward review_requestable/close_resolution_forward_summary",
    );
    expect(debuggerReadModel.summary).toContain("settlement review requestable");
    expect(debuggerReadModel.summary).toContain("closeout confirmation not_available");
    expect(debuggerReadModel.summary).toContain("closeout refresh not_requestable");
    expect(debuggerReadModel.summary).toContain("settlement flow ready_to_close/0");
    expect(debuggerReadModel.variableSnapshot.find((item) => item.key === "result_flow")?.value).toContain(
      "resolved",
    );
    expect(debuggerReadModel.variableSnapshot.find((item) => item.key === "forward_flow")?.value).toContain(
      "idle · 0 attention · no-owner",
    );
    expect(debuggerReadModel.variableSnapshot.find((item) => item.key === "closeout_flow")?.value).toContain(
      "idle · 0 open · 0 resolved",
    );
    expect(
      debuggerReadModel.variableSnapshot.find((item) => item.key === "closeout_summary")?.value,
    ).toContain("review_requestable · settlement_review");
    expect(
      debuggerReadModel.variableSnapshot.find((item) => item.key === "closeout_resolution")?.value,
    ).toContain("not_available · no-decision");
    expect(
      debuggerReadModel.variableSnapshot.find((item) => item.key === "closeout_resolution_followthrough")?.value,
    ).toContain("not_available · no-decision");
    expect(
      debuggerReadModel.variableSnapshot.find((item) => item.key === "closeout_outcome")?.value,
    ).toContain("not_available · no-decision");
    expect(
      debuggerReadModel.variableSnapshot.find((item) => item.key === "close_lifecycle")?.value,
    ).toContain("inactive · closeout_summary");
    expect(
      debuggerReadModel.variableSnapshot.find((item) => item.key === "close_control")?.value,
    ).toContain("review_requestable · closeout_summary");
    expect(
      debuggerReadModel.variableSnapshot.find((item) => item.key === "close_control_flow")?.value,
    ).toContain("review_requestable · close_control");
    expect(
      debuggerReadModel.variableSnapshot.find((item) => item.key === "close_decision_flow")?.value,
    ).toContain("review_requestable · close_control_flow");
    expect(
      debuggerReadModel.variableSnapshot.find((item) => item.key === "close_decision_control_summary")
        ?.value,
    ).toContain("review_requestable · close_decision_flow");
    expect(
      debuggerReadModel.variableSnapshot.find((item) => item.key === "close_resolution_summary")
        ?.value,
    ).toContain("not_ready · close_decision_control_summary");
    expect(
      debuggerReadModel.variableSnapshot.find(
        (item) => item.key === "close_resolution_forward_summary",
      )?.value,
    ).toContain("review_requestable · close_decision_control_summary");
    expect(
      debuggerReadModel.variableSnapshot.find(
        (item) => item.key === "close_resolution_control_summary",
      )?.value,
    ).toContain("not_ready · close_resolution_forward_summary");
    expect(
      debuggerReadModel.variableSnapshot.find((item) => item.key === "close_posture_summary")
        ?.value,
    ).toContain("open · close_resolution_forward_summary");
    expect(
      debuggerReadModel.variableSnapshot.find(
        (item) => item.key === "close_posture_forward_summary",
      )?.value,
    ).toContain("review_requestable · close_resolution_forward_summary");
    expect(debuggerReadModel.variableSnapshot.find((item) => item.key === "settlement_flow")?.value).toContain(
      "ready_to_close · 0 forward attention · 0 closeout open",
    );
    expect(debuggerReadModel.variableSnapshot.find((item) => item.key === "settlement_review")?.value).toContain(
      "requestable",
    );
    expect(
      debuggerReadModel.variableSnapshot.find((item) => item.key === "closeout_confirmation")?.value,
    ).toContain("not_available");
    expect(debuggerReadModel.variableSnapshot.find((item) => item.key === "closeout_refresh")?.value).toContain(
      "not_requestable",
    );
  });

  it("projects swarm spawn admission into the debugger contract", () => {
    const runThread = buildRunThreadContract({
      id: "session_swarm_debugger",
      workspaceId: "workspace_swarm",
      sessionKey: "session::swarm-debugger",
      status: "ACTIVE",
      currentStage: "review_confirmed",
      sourcePage: "/operating",
      boundaryNote: "Review-first runtime only.",
      replayableEventLog: "[]",
      resumedFromKey: null,
      swarmReadOnlyWorkersEnabled: true,
      swarmBudgetEnvelope: {
        budgetTokenLimit: 100,
        budgetTokenUsed: 52,
        usagePercent: 52,
        prunedTokenCount: 0,
        posture: "SAFE",
      },
      createdAt: new Date("2026-04-16T09:00:00.000Z"),
      updatedAt: new Date("2026-04-16T09:10:00.000Z"),
      closedAt: null,
      checkpoints: [],
      resultAcknowledgements: [],
    });

    const debuggerReadModel = buildOperatorDebuggerReadModel({
      sessionLabel: "Swarm debugger session",
      runThread,
      replayableEventLog: "[]",
      replay: null,
      recovery: {
        state: "STABLE",
        failureTaxonomy: "NONE",
        summary: "No recovery issue is active.",
        operatorAction: "Observe only.",
        allowedActions: [],
        reviewReasons: [],
        blockedReasons: [],
        rollbackAnchor: null,
      },
      notebookState: {
        objective: "Keep swarm admission explicit.",
        reviewState: "ready",
        confirmedFacts: [],
        blockers: [],
        decisions: [],
        nextActions: [],
        openQuestions: [],
        boundaryNote: "Review-first runtime only.",
      },
      payloadState: {
        activeHandles: [],
        prunedHandles: [],
        stateSource: "checkpoint_snapshot",
        stateSummary: "No payload drift is active.",
      },
      verification: null,
      contextEditEvents: [],
      remediationTrace: [],
      handoffPackets: [],
    });

    expect(debuggerReadModel.swarmSpawnContract.state).toBe("requestable");
    expect(debuggerReadModel.swarmSpawnContract.requestRecordState).toBe("not_requested");
    expect(debuggerReadModel.swarmSpawnContract.driver).toBe("admission_ready");
    expect(debuggerReadModel.swarmSpawnContract.workspaceFlagState).toBe("enabled");
    expect(debuggerReadModel.swarmSpawnContract.denyReason).toBeNull();
    expect(debuggerReadModel.swarmReadOnlyWorkerContract.state).toBe("ready");
    expect(debuggerReadModel.swarmReadOnlyWorkerContract.driver).toBe("allowlist_ready");
    expect(debuggerReadModel.swarmReadOnlyWorkerContract.requestLifecycleState).toBe("requestable");
    expect(debuggerReadModel.swarmReadOnlyWorkerContract.handoffPreviewState).toBe("preview_ready");
    expect(debuggerReadModel.swarmReadOnlyWorkerContract.allowlistedWorkers).toEqual([
      "search",
      "grep",
      "evidence_mining",
    ]);
    expect(
      debuggerReadModel.variableSnapshot.find(
        (item) => item.key === "debugger_swarm_spawn_contract",
      )?.value,
    ).toContain("requestable");
    expect(
      debuggerReadModel.variableSnapshot.find(
        (item) => item.key === "debugger_swarm_read_only_worker_contract",
      )?.value,
    ).toContain("search/grep/evidence_mining");
    expect(
      debuggerReadModel.variableSnapshot.find(
        (item) => item.key === "debugger_swarm_read_only_worker_contract",
      )?.value,
    ).toContain("requestable");
    expect(
      debuggerReadModel.variableSnapshot.find(
        (item) => item.key === "debugger_swarm_spawn_contract",
      )?.value,
    ).toContain("deny none");
    expect(debuggerReadModel.summary).toContain(
      "swarm spawn requestable/not_requested/admission_ready/enabled/SAFE",
    );
  });

  it("projects recorded swarm spawn requests into the debugger contract", () => {
    const runThread = buildRunThreadContract({
      id: "session_swarm_debugger_requested",
      workspaceId: "workspace_swarm",
      sessionKey: "session::swarm-debugger-requested",
      status: "ACTIVE",
      currentStage: "review_confirmed",
      sourcePage: "/operating",
      boundaryNote: "Review-first runtime only.",
      replayableEventLog: "[]",
      resumedFromKey: null,
      swarmReadOnlyWorkersEnabled: true,
      swarmBudgetEnvelope: {
        budgetTokenLimit: 100,
        budgetTokenUsed: 52,
        usagePercent: 52,
        prunedTokenCount: 0,
        posture: "SAFE",
      },
      createdAt: new Date("2026-04-16T09:00:00.000Z"),
      updatedAt: new Date("2026-04-16T09:12:00.000Z"),
      closedAt: null,
      checkpoints: [
        {
          id: "checkpoint_swarm_requested",
          checkpointKey: "checkpoint::swarm-requested",
          label: "swarm_request_anchor",
          status: "READY",
          summary: "Checkpoint anchor for swarm request.",
          createdAt: new Date("2026-04-16T09:01:00.000Z"),
          updatedAt: new Date("2026-04-16T09:01:00.000Z"),
        },
      ],
      swarmSpawnRequestEvent: {
        id: "swarm_request_1",
        taskClass: "read_only_worker",
        checkpointId: "checkpoint_swarm_requested",
        checkpointKey: "checkpoint::swarm-requested",
        summary: "Read-only swarm worker spawn request recorded for checkpoint::swarm-requested.",
        requestedBy: "founder@demo.com",
        sourcePage: "/meetings/meeting_swarm",
        createdAt: new Date("2026-04-16T09:02:00.000Z"),
      },
      resultAcknowledgements: [],
    });

    const debuggerReadModel = buildOperatorDebuggerReadModel({
      sessionLabel: "Swarm debugger requested session",
      runThread,
      replayableEventLog: "[]",
      replay: null,
      recovery: {
        state: "STABLE",
        failureTaxonomy: "NONE",
        summary: "No recovery issue is active.",
        operatorAction: "Observe only.",
        allowedActions: [],
        reviewReasons: [],
        blockedReasons: [],
        rollbackAnchor: null,
      },
      notebookState: {
        objective: "Keep swarm request records explicit.",
        reviewState: "ready",
        confirmedFacts: [],
        blockers: [],
        decisions: [],
        nextActions: [],
        openQuestions: [],
        boundaryNote: "Review-first runtime only.",
      },
      payloadState: {
        activeHandles: [],
        prunedHandles: [],
        stateSource: "checkpoint_snapshot",
        stateSummary: "No payload drift is active.",
      },
      verification: null,
      contextEditEvents: [],
      remediationTrace: [],
      handoffPackets: [],
    });

    expect(debuggerReadModel.swarmSpawnContract.state).toBe("requestable");
    expect(debuggerReadModel.swarmSpawnContract.requestRecordState).toBe("requested");
    expect(debuggerReadModel.swarmSpawnContract.driver).toBe("request_recorded");
    expect(debuggerReadModel.swarmSpawnContract.requestEventId).toBe("swarm_request_1");
    expect(debuggerReadModel.swarmSpawnContract.checkpointKey).toBe("checkpoint::swarm-requested");
    expect(debuggerReadModel.swarmSpawnContract.requestedBy).toBe("founder@demo.com");
    expect(debuggerReadModel.swarmReadOnlyWorkerContract.state).toBe("requested");
    expect(debuggerReadModel.swarmReadOnlyWorkerContract.driver).toBe("request_recorded");
    expect(debuggerReadModel.swarmReadOnlyWorkerContract.requestLifecycleState).toBe(
      "request_recorded",
    );
    expect(debuggerReadModel.swarmReadOnlyWorkerContract.handoffPreviewState).toBe(
      "request_recorded",
    );
    expect(debuggerReadModel.swarmReadOnlyWorkerContract.packetConsumptionIntentState).toBe(
      "selection_required",
    );
    expect(debuggerReadModel.swarmReadOnlyWorkerContract.artifactBundlePlaceholderState).toBe(
      "selection_required",
    );
    expect(debuggerReadModel.swarmReadOnlyWorkerContract.handoffConsumptionState).toBe(
      "selection_required",
    );
    expect(
      debuggerReadModel.swarmReadOnlyWorkerContract.artifactBundlePlaceholderRecordState,
    ).toBe("not_ready");
    expect(debuggerReadModel.swarmReadOnlyWorkerContract.handoffConsumptionRecordState).toBe(
      "not_ready",
    );
    expect(debuggerReadModel.swarmReadOnlyWorkerContract.executionPreflightState).toBe(
      "selection_required",
    );
    expect(debuggerReadModel.swarmReadOnlyWorkerContract.executionGuardContract.state).toBe(
      "blocked",
    );
    expect(debuggerReadModel.swarmReadOnlyWorkerContract.executionLifecycleContract.state).toBe(
      "selection_required",
    );
    expect(
      debuggerReadModel.swarmReadOnlyWorkerContract.executionGuardContract.missingRequirements,
    ).toEqual(["allowlisted lane selection is missing"]);
    expect(debuggerReadModel.swarmReadOnlyWorkerContract.requestEventId).toBe("swarm_request_1");
    expect(debuggerReadModel.swarmReadOnlyWorkerContract.requestedBy).toBe("founder@demo.com");
    expect(
      debuggerReadModel.variableSnapshot.find(
        (item) => item.key === "debugger_swarm_spawn_contract",
      )?.value,
    ).toContain("request requested");
    expect(
      debuggerReadModel.variableSnapshot.find(
        (item) => item.key === "debugger_swarm_read_only_worker_contract",
      )?.value,
    ).toContain("request_recorded");
    expect(debuggerReadModel.summary).toContain(
      "read-only worker requested/request_recorded/search/grep/evidence_mining",
    );
    expect(debuggerReadModel.summary).toContain("swarm spawn requestable/requested/request_recorded");
  });

  it("projects recorded read-only worker intent into the debugger contract", () => {
    const runThread = buildRunThreadContract({
      id: "session_swarm_debugger_intent",
      workspaceId: "workspace_swarm",
      sessionKey: "session::swarm-debugger-intent",
      status: "ACTIVE",
      currentStage: "review_confirmed",
      sourcePage: "/operating",
      boundaryNote: "Review-first runtime only.",
      replayableEventLog: "[]",
      resumedFromKey: null,
      swarmReadOnlyWorkersEnabled: true,
      swarmBudgetEnvelope: {
        budgetTokenLimit: 100,
        budgetTokenUsed: 52,
        usagePercent: 52,
        prunedTokenCount: 0,
        posture: "SAFE",
      },
      createdAt: new Date("2026-04-16T09:00:00.000Z"),
      updatedAt: new Date("2026-04-16T09:13:00.000Z"),
      closedAt: null,
      checkpoints: [
        {
          id: "checkpoint_swarm_intent",
          checkpointKey: "checkpoint::swarm-intent",
          label: "swarm_intent_anchor",
          status: "READY",
          summary: "Checkpoint anchor for swarm intent.",
          createdAt: new Date("2026-04-16T09:01:00.000Z"),
          updatedAt: new Date("2026-04-16T09:01:00.000Z"),
        },
      ],
      swarmSpawnRequestEvent: {
        id: "swarm_request_1",
        taskClass: "read_only_worker",
        checkpointId: "checkpoint_swarm_intent",
        checkpointKey: "checkpoint::swarm-intent",
        summary: "Read-only swarm worker spawn request recorded for checkpoint::swarm-intent.",
        requestedBy: "founder@demo.com",
        sourcePage: "/meetings/meeting_swarm",
        createdAt: new Date("2026-04-16T09:02:00.000Z"),
      },
      swarmReadOnlyWorkerIntentEvent: {
        id: "swarm_intent_1",
        workerKind: "grep",
        packetKey: "swarm::grep::checkpoint::swarm-intent",
        checkpointId: "checkpoint_swarm_intent",
        checkpointKey: "checkpoint::swarm-intent",
        artifactTypes: ["grep_hits.json", "worker_findings_bundle.json"],
        summary: "Read-only worker intent recorded for grep.",
        requestedBy: "founder@demo.com",
        sourcePage: "/meetings/meeting_swarm",
        createdAt: new Date("2026-04-16T09:03:00.000Z"),
      },
      resultAcknowledgements: [],
    });

    const debuggerReadModel = buildOperatorDebuggerReadModel({
      sessionLabel: "Swarm debugger intent session",
      runThread,
      replayableEventLog: "[]",
      replay: null,
      recovery: {
        state: "STABLE",
        failureTaxonomy: "NONE",
        summary: "No recovery issue is active.",
        operatorAction: "Observe only.",
        allowedActions: [],
        reviewReasons: [],
        blockedReasons: [],
        rollbackAnchor: null,
      },
      notebookState: {
        objective: "Keep swarm lane intent explicit.",
        reviewState: "ready",
        confirmedFacts: [],
        blockers: [],
        decisions: [],
        nextActions: [],
        openQuestions: [],
        boundaryNote: "Review-first runtime only.",
      },
      payloadState: {
        activeHandles: [],
        prunedHandles: [],
        stateSource: "checkpoint_snapshot",
        stateSummary: "No payload drift is active.",
      },
      verification: null,
      contextEditEvents: [],
      remediationTrace: [],
      handoffPackets: [],
    });

    expect(debuggerReadModel.swarmReadOnlyWorkerContract.driver).toBe("intent_recorded");
    expect(debuggerReadModel.swarmReadOnlyWorkerContract.packetConsumptionIntentState).toBe(
      "intent_recorded",
    );
    expect(debuggerReadModel.swarmReadOnlyWorkerContract.intentEventId).toBe("swarm_intent_1");
    expect(debuggerReadModel.swarmReadOnlyWorkerContract.selectedWorkerKind).toBe("grep");
    expect(debuggerReadModel.swarmReadOnlyWorkerContract.selectedPacketKey).toBe(
      "swarm::grep::checkpoint::swarm-intent",
    );
    expect(debuggerReadModel.swarmReadOnlyWorkerContract.artifactBundlePlaceholderState).toBe(
      "placeholder_ready",
    );
    expect(debuggerReadModel.swarmReadOnlyWorkerContract.placeholderBundleKey).toBe(
      "artifact-bundle::swarm::grep::checkpoint::swarm-intent",
    );
    expect(debuggerReadModel.swarmReadOnlyWorkerContract.handoffConsumptionState).toBe(
      "consumable",
    );
    expect(debuggerReadModel.swarmReadOnlyWorkerContract.handoffConsumerAgent).toBe(
      "lead-orchestrator",
    );
    expect(
      debuggerReadModel.swarmReadOnlyWorkerContract.artifactBundlePlaceholderRecordState,
    ).toBe("recordable");
    expect(debuggerReadModel.swarmReadOnlyWorkerContract.handoffConsumptionRecordState).toBe(
      "recordable",
    );
    expect(debuggerReadModel.swarmReadOnlyWorkerContract.executionPreflightState).toBe(
      "placeholder_record_required",
    );
    expect(debuggerReadModel.swarmReadOnlyWorkerContract.executionGuardContract.state).toBe(
      "blocked",
    );
    expect(debuggerReadModel.swarmReadOnlyWorkerContract.executionLifecycleContract.state).toBe(
      "placeholder_record_required",
    );
    expect(
      debuggerReadModel.swarmReadOnlyWorkerContract.executionGuardContract.missingRequirements,
    ).toEqual(["placeholder bundle record is missing"]);
    expect(
      debuggerReadModel.variableSnapshot.find(
        (item) => item.key === "debugger_swarm_read_only_worker_contract",
      )?.value,
    ).toContain("intent_recorded");
    expect(debuggerReadModel.swarmReadOnlyWorkerContract.outputAdoptionGuardContract.state).toBe(
      "blocked",
    );
    expect(
      debuggerReadModel.swarmReadOnlyWorkerContract.outputAdoptionLifecycleContract.state,
    ).toBe("blocked");
    expect(debuggerReadModel.summary).toContain(
      "read-only worker requested/intent_recorded/search/grep/evidence_mining/request_recorded/request_recorded/intent_recorded/placeholder_ready/not_ready/recordable/consumable/recordable/placeholder_record_required/placeholder_record_required/not_ready/execution_not_recorded/not_ready/blocked/not_ready/blocked/not_ready/materialization_not_recorded/blocked/blocked/guard_blocked/not_ready/output_not_consumable/not_ready/consumption_not_ready/blocked/not_ready/blocked/guard_blocked/not_ready/adoption_not_recorded/placeholder_record_required/blocked/grep",
    );
  });

  it("projects recorded placeholder materialization into the debugger contract", () => {
    const runThread = buildRunThreadContract({
      id: "session_swarm_debugger_placeholder",
      workspaceId: "workspace_swarm",
      sessionKey: "session::swarm-debugger-placeholder",
      status: "ACTIVE",
      currentStage: "review_confirmed",
      sourcePage: "/operating",
      boundaryNote: "Review-first runtime only.",
      replayableEventLog: "[]",
      resumedFromKey: null,
      swarmReadOnlyWorkersEnabled: true,
      swarmBudgetEnvelope: {
        budgetTokenLimit: 100,
        budgetTokenUsed: 52,
        usagePercent: 52,
        prunedTokenCount: 0,
        posture: "SAFE",
      },
      createdAt: new Date("2026-04-16T09:00:00.000Z"),
      updatedAt: new Date("2026-04-16T09:14:00.000Z"),
      closedAt: null,
      checkpoints: [
        {
          id: "checkpoint_swarm_placeholder",
          checkpointKey: "checkpoint::swarm-placeholder",
          label: "swarm_placeholder_anchor",
          status: "READY",
          summary: "Checkpoint anchor for swarm placeholder.",
          createdAt: new Date("2026-04-16T09:01:00.000Z"),
          updatedAt: new Date("2026-04-16T09:01:00.000Z"),
        },
      ],
      swarmSpawnRequestEvent: {
        id: "swarm_request_1",
        taskClass: "read_only_worker",
        checkpointId: "checkpoint_swarm_placeholder",
        checkpointKey: "checkpoint::swarm-placeholder",
        summary: "Read-only swarm worker spawn request recorded for checkpoint::swarm-placeholder.",
        requestedBy: "founder@demo.com",
        sourcePage: "/meetings/meeting_swarm",
        createdAt: new Date("2026-04-16T09:02:00.000Z"),
      },
      swarmReadOnlyWorkerIntentEvent: {
        id: "swarm_intent_1",
        workerKind: "grep",
        packetKey: "swarm::grep::checkpoint::swarm-placeholder",
        checkpointId: "checkpoint_swarm_placeholder",
        checkpointKey: "checkpoint::swarm-placeholder",
        artifactTypes: ["grep_hits.json", "worker_findings_bundle.json"],
        summary: "Read-only worker intent recorded for grep.",
        requestedBy: "founder@demo.com",
        sourcePage: "/meetings/meeting_swarm",
        createdAt: new Date("2026-04-16T09:03:00.000Z"),
      },
      swarmReadOnlyWorkerPlaceholderEvent: {
        id: "swarm_placeholder_1",
        workerKind: "grep",
        packetKey: "swarm::grep::checkpoint::swarm-placeholder",
        checkpointId: "checkpoint_swarm_placeholder",
        checkpointKey: "checkpoint::swarm-placeholder",
        placeholderBundleKey: "artifact-bundle::swarm::grep::checkpoint::swarm-placeholder",
        placeholderBundleTitle: "grep findings placeholder bundle",
        artifactTypes: [
          "grep_hits.json",
          "worker_findings_bundle.json",
          "worker_handoff_note.md",
        ],
        handoffConsumerAgent: "lead-orchestrator",
        handoffConsumptionGoal:
          "Run bounded grep-style evidence lookup anchored on checkpoint::swarm-placeholder and return typed findings only.",
        summary: "Read-only worker placeholder recorded for grep.",
        requestedBy: "founder@demo.com",
        sourcePage: "/operating",
        createdAt: new Date("2026-04-16T09:04:00.000Z"),
      },
      resultAcknowledgements: [],
    });

    const debuggerReadModel = buildOperatorDebuggerReadModel({
      sessionLabel: "Swarm debugger placeholder session",
      runThread,
      replayableEventLog: "[]",
      replay: null,
      recovery: {
        state: "STABLE",
        failureTaxonomy: "NONE",
        summary: "No recovery issue is active.",
        operatorAction: "Observe only.",
        allowedActions: [],
        reviewReasons: [],
        blockedReasons: [],
        rollbackAnchor: null,
      },
      notebookState: {
        objective: "Keep swarm placeholder review-first.",
        reviewState: "ready",
        confirmedFacts: [],
        blockers: [],
        decisions: [],
        nextActions: [],
        openQuestions: [],
        boundaryNote: "Review-first runtime only.",
      },
      payloadState: {
        activeHandles: [],
        prunedHandles: [],
        stateSource: "checkpoint_snapshot",
        stateSummary: "No payload drift is active.",
      },
      verification: null,
      contextEditEvents: [],
      remediationTrace: [],
      handoffPackets: [],
    });

    expect(
      debuggerReadModel.swarmReadOnlyWorkerContract.artifactBundlePlaceholderRecordState,
    ).toBe("recorded");
    expect(debuggerReadModel.swarmReadOnlyWorkerContract.handoffConsumptionRecordState).toBe(
      "recorded",
    );
    expect(debuggerReadModel.swarmReadOnlyWorkerContract.executionPreflightState).toBe("ready");
    expect(debuggerReadModel.swarmReadOnlyWorkerContract.placeholderRecordEventId).toBe(
      "swarm_placeholder_1",
    );
    expect(debuggerReadModel.swarmReadOnlyWorkerContract.placeholderRecordedBy).toBe(
      "founder@demo.com",
    );
    expect(debuggerReadModel.swarmReadOnlyWorkerContract.placeholderRecordSourcePage).toBe(
      "/operating",
    );
    expect(debuggerReadModel.swarmReadOnlyWorkerContract.executionRecordState).toBe("recordable");
    expect(debuggerReadModel.swarmReadOnlyWorkerContract.executionGuardContract.state).toBe(
      "allowed",
    );
    expect(debuggerReadModel.swarmReadOnlyWorkerContract.executionLifecycleContract.state).toBe(
      "recordable",
    );
    expect(debuggerReadModel.swarmReadOnlyWorkerContract.executionCandidateContract.state).toBe(
      "not_ready",
    );
    expect(debuggerReadModel.swarmReadOnlyWorkerContract.executionCandidateContract.driver).toBe(
      "execution_not_recorded",
    );
    expect(
      debuggerReadModel.swarmReadOnlyWorkerContract.executionCandidateContract
        .artifactMaterializationState,
    ).toBe("not_ready");
    expect(
      debuggerReadModel.swarmReadOnlyWorkerContract.artifactMaterializationGuardContract.state,
    ).toBe("blocked");
    expect(
      debuggerReadModel.swarmReadOnlyWorkerContract.artifactMaterializationGuardContract
        .missingRequirements,
    ).toEqual(["execution candidate is not ready"]);
    expect(
      debuggerReadModel.swarmReadOnlyWorkerContract.executionGuardContract.placeholderBundleKey,
    ).toBe("artifact-bundle::swarm::grep::checkpoint::swarm-placeholder");
  });

  it("projects recorded worker execution admission into the debugger contract", () => {
    const runThread = buildRunThreadContract({
      id: "session_swarm_debugger_execution",
      workspaceId: "workspace_swarm",
      sessionKey: "session::swarm-debugger-execution",
      status: "ACTIVE",
      currentStage: "review_confirmed",
      sourcePage: "/operating",
      boundaryNote: "Review-first runtime only.",
      replayableEventLog: "[]",
      resumedFromKey: null,
      swarmReadOnlyWorkersEnabled: true,
      swarmBudgetEnvelope: {
        budgetTokenLimit: 100,
        budgetTokenUsed: 52,
        usagePercent: 52,
        prunedTokenCount: 0,
        posture: "SAFE",
      },
      createdAt: new Date("2026-04-16T09:00:00.000Z"),
      updatedAt: new Date("2026-04-16T09:15:00.000Z"),
      closedAt: null,
      checkpoints: [
        {
          id: "checkpoint_swarm_execution",
          checkpointKey: "checkpoint::swarm-execution",
          label: "swarm_execution_anchor",
          status: "READY",
          summary: "Checkpoint anchor for swarm execution.",
          createdAt: new Date("2026-04-16T09:01:00.000Z"),
          updatedAt: new Date("2026-04-16T09:01:00.000Z"),
        },
      ],
      swarmSpawnRequestEvent: {
        id: "swarm_request_1",
        taskClass: "read_only_worker",
        checkpointId: "checkpoint_swarm_execution",
        checkpointKey: "checkpoint::swarm-execution",
        summary: "Read-only swarm worker spawn request recorded for checkpoint::swarm-execution.",
        requestedBy: "founder@demo.com",
        sourcePage: "/meetings/meeting_swarm",
        createdAt: new Date("2026-04-16T09:02:00.000Z"),
      },
      swarmReadOnlyWorkerIntentEvent: {
        id: "swarm_intent_1",
        workerKind: "grep",
        packetKey: "swarm::grep::checkpoint::swarm-execution",
        checkpointId: "checkpoint_swarm_execution",
        checkpointKey: "checkpoint::swarm-execution",
        artifactTypes: ["grep_hits.json", "worker_findings_bundle.json"],
        summary: "Read-only worker intent recorded for grep.",
        requestedBy: "founder@demo.com",
        sourcePage: "/meetings/meeting_swarm",
        createdAt: new Date("2026-04-16T09:03:00.000Z"),
      },
      swarmReadOnlyWorkerPlaceholderEvent: {
        id: "swarm_placeholder_1",
        workerKind: "grep",
        packetKey: "swarm::grep::checkpoint::swarm-execution",
        checkpointId: "checkpoint_swarm_execution",
        checkpointKey: "checkpoint::swarm-execution",
        placeholderBundleKey: "artifact-bundle::swarm::grep::checkpoint::swarm-execution",
        placeholderBundleTitle: "grep findings placeholder bundle",
        artifactTypes: [
          "grep_hits.json",
          "worker_findings_bundle.json",
          "worker_handoff_note.md",
        ],
        handoffConsumerAgent: "lead-orchestrator",
        handoffConsumptionGoal:
          "Run bounded grep-style evidence lookup anchored on checkpoint::swarm-execution and return typed findings only.",
        summary: "Read-only worker placeholder recorded for grep.",
        requestedBy: "founder@demo.com",
        sourcePage: "/operating",
        createdAt: new Date("2026-04-16T09:04:00.000Z"),
      },
      swarmReadOnlyWorkerExecutionEvent: {
        id: "swarm_execution_1",
        workerKind: "grep",
        packetKey: "swarm::grep::checkpoint::swarm-execution",
        checkpointId: "checkpoint_swarm_execution",
        checkpointKey: "checkpoint::swarm-execution",
        placeholderBundleKey: "artifact-bundle::swarm::grep::checkpoint::swarm-execution",
        artifactTypes: [
          "grep_hits.json",
          "worker_findings_bundle.json",
          "worker_handoff_note.md",
        ],
        handoffConsumerAgent: "lead-orchestrator",
        handoffConsumptionGoal:
          "Run bounded grep-style evidence lookup anchored on checkpoint::swarm-execution and return typed findings only.",
        summary: "Read-only worker execution slice recorded for grep.",
        requestedBy: "founder@demo.com",
        sourcePage: "/operating",
        createdAt: new Date("2026-04-16T09:05:00.000Z"),
      },
      resultAcknowledgements: [],
    });

    const debuggerReadModel = buildOperatorDebuggerReadModel({
      sessionLabel: "Swarm debugger execution session",
      runThread,
      replayableEventLog: "[]",
      replay: null,
      recovery: {
        state: "STABLE",
        failureTaxonomy: "NONE",
        summary: "No recovery issue is active.",
        operatorAction: "Observe only.",
        allowedActions: [],
        reviewReasons: [],
        blockedReasons: [],
        rollbackAnchor: null,
      },
      notebookState: {
        objective: "Keep swarm execution admission explicit.",
        reviewState: "ready",
        confirmedFacts: [],
        blockers: [],
        decisions: [],
        nextActions: [],
        openQuestions: [],
        boundaryNote: "Review-first runtime only.",
      },
      payloadState: {
        activeHandles: [],
        prunedHandles: [],
        stateSource: "checkpoint_snapshot",
        stateSummary: "No payload drift is active.",
      },
      verification: null,
      contextEditEvents: [],
      remediationTrace: [],
      handoffPackets: [],
    });

    expect(debuggerReadModel.swarmReadOnlyWorkerContract.executionRecordState).toBe("recorded");
    expect(debuggerReadModel.swarmReadOnlyWorkerContract.executionEventId).toBe(
      "swarm_execution_1",
    );
    expect(debuggerReadModel.swarmReadOnlyWorkerContract.executionGuardContract.state).toBe(
      "reused",
    );
    expect(debuggerReadModel.swarmReadOnlyWorkerContract.executionLifecycleContract.state).toBe(
      "recorded",
    );
    expect(debuggerReadModel.swarmReadOnlyWorkerContract.executionCandidateContract.state).toBe(
      "candidate_ready",
    );
    expect(debuggerReadModel.swarmReadOnlyWorkerContract.executionCandidateContract.driver).toBe(
      "execution_recorded",
    );
    expect(
      debuggerReadModel.swarmReadOnlyWorkerContract.executionCandidateContract
        .artifactMaterializationState,
    ).toBe("intent_ready");
    expect(
      debuggerReadModel.swarmReadOnlyWorkerContract.executionCandidateContract
        .materializationBundleKey,
    ).toBe("artifact-bundle::swarm::grep::checkpoint::swarm-execution");
    expect(
      debuggerReadModel.swarmReadOnlyWorkerContract.artifactMaterializationGuardContract.state,
    ).toBe("allowed");
    expect(
      debuggerReadModel.swarmReadOnlyWorkerContract.artifactMaterializationGuardContract
        .materializationBundleKey,
    ).toBe("artifact-bundle::swarm::grep::checkpoint::swarm-execution");
    expect(debuggerReadModel.swarmReadOnlyWorkerContract.artifactMaterializationRecordState).toBe(
      "recordable",
    );
    expect(
      debuggerReadModel.swarmReadOnlyWorkerContract.artifactMaterializationLifecycleContract.state,
    ).toBe("recordable");
    expect(debuggerReadModel.swarmReadOnlyWorkerContract.resultSideOutputContract.state).toBe(
      "not_ready",
    );
    expect(debuggerReadModel.swarmReadOnlyWorkerContract.resultSideOutputContract.driver).toBe(
      "materialization_not_recorded",
    );
    expect(debuggerReadModel.swarmReadOnlyWorkerContract.resultSideOutputGuardContract.state).toBe(
      "blocked",
    );
    expect(
      debuggerReadModel.swarmReadOnlyWorkerContract.resultSideOutputLifecycleContract.state,
    ).toBe("blocked");
    expect(debuggerReadModel.swarmReadOnlyWorkerContract.outputConsumptionContract.state).toBe(
      "not_ready",
    );
    expect(debuggerReadModel.swarmReadOnlyWorkerContract.resultAdoptionContract.state).toBe(
      "not_ready",
    );
    expect(debuggerReadModel.swarmReadOnlyWorkerContract.outputAdoptionGuardContract.state).toBe(
      "blocked",
    );
    expect(
      debuggerReadModel.swarmReadOnlyWorkerContract.outputAdoptionLifecycleContract.state,
    ).toBe("blocked");
    expect(
      debuggerReadModel.swarmReadOnlyWorkerContract.resultAdoptionResultSideContract.state,
    ).toBe("not_ready");
    expect(debuggerReadModel.summary).toContain(
      "read-only worker requested/execution_recorded/search/grep/evidence_mining/request_recorded/request_recorded/intent_recorded/placeholder_ready/recorded/recorded/consumable/recorded/recorded/recorded/candidate_ready/execution_recorded/intent_ready/allowed/recordable/recordable/not_ready/materialization_not_recorded/blocked/blocked/guard_blocked/not_ready/output_not_consumable/not_ready/consumption_not_ready/blocked/not_ready/blocked/guard_blocked/not_ready/adoption_not_recorded/ready/reused/grep",
    );
  });

  it("projects recorded artifact materialization into the debugger contract", () => {
    const runThread = buildRunThreadContract({
      id: "session_swarm_debugger_materialization",
      workspaceId: "workspace_swarm",
      sessionKey: "session::swarm-debugger-materialization",
      status: "ACTIVE",
      currentStage: "review_confirmed",
      sourcePage: "/operating",
      boundaryNote: "Review-first runtime only.",
      replayableEventLog: "[]",
      resumedFromKey: null,
      swarmReadOnlyWorkersEnabled: true,
      swarmBudgetEnvelope: {
        budgetTokenLimit: 100,
        budgetTokenUsed: 52,
        usagePercent: 52,
        prunedTokenCount: 0,
        posture: "SAFE",
      },
      createdAt: new Date("2026-04-16T09:00:00.000Z"),
      updatedAt: new Date("2026-04-16T09:16:00.000Z"),
      closedAt: null,
      checkpoints: [
        {
          id: "checkpoint_swarm_materialization",
          checkpointKey: "checkpoint::swarm-materialization",
          label: "swarm_materialization_anchor",
          status: "READY",
          summary: "Checkpoint anchor for swarm materialization.",
          createdAt: new Date("2026-04-16T09:01:00.000Z"),
          updatedAt: new Date("2026-04-16T09:01:00.000Z"),
        },
      ],
      swarmSpawnRequestEvent: {
        id: "swarm_request_1",
        taskClass: "read_only_worker",
        checkpointId: "checkpoint_swarm_materialization",
        checkpointKey: "checkpoint::swarm-materialization",
        summary:
          "Read-only swarm worker spawn request recorded for checkpoint::swarm-materialization.",
        requestedBy: "founder@demo.com",
        sourcePage: "/meetings/meeting_swarm",
        createdAt: new Date("2026-04-16T09:02:00.000Z"),
      },
      swarmReadOnlyWorkerIntentEvent: {
        id: "swarm_intent_1",
        workerKind: "grep",
        packetKey: "swarm::grep::checkpoint::swarm-materialization",
        checkpointId: "checkpoint_swarm_materialization",
        checkpointKey: "checkpoint::swarm-materialization",
        artifactTypes: ["grep_hits.json", "worker_findings_bundle.json"],
        summary: "Read-only worker intent recorded for grep.",
        requestedBy: "founder@demo.com",
        sourcePage: "/meetings/meeting_swarm",
        createdAt: new Date("2026-04-16T09:03:00.000Z"),
      },
      swarmReadOnlyWorkerPlaceholderEvent: {
        id: "swarm_placeholder_1",
        workerKind: "grep",
        packetKey: "swarm::grep::checkpoint::swarm-materialization",
        checkpointId: "checkpoint_swarm_materialization",
        checkpointKey: "checkpoint::swarm-materialization",
        placeholderBundleKey:
          "artifact-bundle::swarm::grep::checkpoint::swarm-materialization",
        placeholderBundleTitle: "grep findings placeholder bundle",
        artifactTypes: [
          "grep_hits.json",
          "worker_findings_bundle.json",
          "worker_handoff_note.md",
        ],
        handoffConsumerAgent: "lead-orchestrator",
        handoffConsumptionGoal:
          "Run bounded grep-style evidence lookup anchored on checkpoint::swarm-materialization and return typed findings only.",
        summary: "Read-only worker placeholder recorded for grep.",
        requestedBy: "founder@demo.com",
        sourcePage: "/operating",
        createdAt: new Date("2026-04-16T09:04:00.000Z"),
      },
      swarmReadOnlyWorkerExecutionEvent: {
        id: "swarm_execution_1",
        workerKind: "grep",
        packetKey: "swarm::grep::checkpoint::swarm-materialization",
        checkpointId: "checkpoint_swarm_materialization",
        checkpointKey: "checkpoint::swarm-materialization",
        placeholderBundleKey:
          "artifact-bundle::swarm::grep::checkpoint::swarm-materialization",
        artifactTypes: [
          "grep_hits.json",
          "worker_findings_bundle.json",
          "worker_handoff_note.md",
        ],
        handoffConsumerAgent: "lead-orchestrator",
        handoffConsumptionGoal:
          "Run bounded grep-style evidence lookup anchored on checkpoint::swarm-materialization and return typed findings only.",
        summary: "Read-only worker execution slice recorded for grep.",
        requestedBy: "founder@demo.com",
        sourcePage: "/operating",
        createdAt: new Date("2026-04-16T09:05:00.000Z"),
      },
      swarmReadOnlyWorkerMaterializationEvent: {
        id: "swarm_materialization_1",
        workerKind: "grep",
        packetKey: "swarm::grep::checkpoint::swarm-materialization",
        checkpointId: "checkpoint_swarm_materialization",
        checkpointKey: "checkpoint::swarm-materialization",
        materializationBundleKey:
          "artifact-bundle::swarm::grep::checkpoint::swarm-materialization",
        materializationBundleTitle: "grep findings placeholder bundle",
        artifactTypes: [
          "grep_hits.json",
          "worker_findings_bundle.json",
          "worker_handoff_note.md",
        ],
        handoffConsumerAgent: "lead-orchestrator",
        handoffConsumptionGoal:
          "Run bounded grep-style evidence lookup anchored on checkpoint::swarm-materialization and return typed findings only.",
        summary: "Read-only worker materialization slice recorded for grep.",
        requestedBy: "founder@demo.com",
        sourcePage: "/operating",
        createdAt: new Date("2026-04-16T09:06:00.000Z"),
      },
      resultAcknowledgements: [],
    });

    const debuggerReadModel = buildOperatorDebuggerReadModel({
      sessionLabel: "Swarm debugger materialization session",
      runThread,
      replayableEventLog: "[]",
      replay: null,
      recovery: {
        state: "STABLE",
        failureTaxonomy: "NONE",
        summary: "No recovery issue is active.",
        operatorAction: "Observe only.",
        allowedActions: [],
        reviewReasons: [],
        blockedReasons: [],
        rollbackAnchor: null,
      },
      notebookState: {
        objective: "Keep swarm materialization review-first.",
        reviewState: "ready",
        confirmedFacts: [],
        blockers: [],
        decisions: [],
        nextActions: [],
        openQuestions: [],
        boundaryNote: "Review-first runtime only.",
      },
      payloadState: {
        activeHandles: [],
        prunedHandles: [],
        stateSource: "checkpoint_snapshot",
        stateSummary: "No payload drift is active.",
      },
      verification: null,
      contextEditEvents: [],
      remediationTrace: [],
      handoffPackets: [],
    });

    expect(debuggerReadModel.swarmReadOnlyWorkerContract.artifactMaterializationRecordState).toBe(
      "recorded",
    );
    expect(debuggerReadModel.swarmReadOnlyWorkerContract.artifactMaterializationEventId).toBe(
      "swarm_materialization_1",
    );
    expect(debuggerReadModel.swarmReadOnlyWorkerContract.artifactMaterializedBy).toBe(
      "founder@demo.com",
    );
    expect(
      debuggerReadModel.swarmReadOnlyWorkerContract.artifactMaterializationSourcePage,
    ).toBe("/operating");
    expect(
      debuggerReadModel.swarmReadOnlyWorkerContract.artifactMaterializationLifecycleContract.state,
    ).toBe("recorded");
    expect(
      debuggerReadModel.swarmReadOnlyWorkerContract.artifactMaterializationLifecycleContract.driver,
    ).toBe("recorded");
    expect(debuggerReadModel.swarmReadOnlyWorkerContract.resultSideOutputContract.state).toBe(
      "output_ready",
    );
    expect(debuggerReadModel.swarmReadOnlyWorkerContract.resultSideOutputContract.driver).toBe(
      "materialization_recorded",
    );
    expect(debuggerReadModel.swarmReadOnlyWorkerContract.resultSideOutputGuardContract.state).toBe(
      "allowed",
    );
    expect(
      debuggerReadModel.swarmReadOnlyWorkerContract.resultSideOutputLifecycleContract.state,
    ).toBe("consumable");
    expect(debuggerReadModel.swarmReadOnlyWorkerContract.outputConsumptionContract.state).toBe(
      "consumable",
    );
    expect(debuggerReadModel.swarmReadOnlyWorkerContract.resultAdoptionContract.state).toBe(
      "adoption_ready",
    );
    expect(debuggerReadModel.swarmReadOnlyWorkerContract.outputAdoptionGuardContract.state).toBe(
      "allowed",
    );
    expect(debuggerReadModel.swarmReadOnlyWorkerContract.outputAdoptionRecordState).toBe(
      "recordable",
    );
    expect(
      debuggerReadModel.swarmReadOnlyWorkerContract.outputAdoptionLifecycleContract.state,
    ).toBe("recordable");
    expect(
      debuggerReadModel.swarmReadOnlyWorkerContract.resultAdoptionResultSideContract.state,
    ).toBe("not_ready");
    expect(
      debuggerReadModel.swarmReadOnlyWorkerContract.resultAdoptionResultSideContract.driver,
    ).toBe("adoption_not_recorded");
    expect(debuggerReadModel.summary).toContain(
      "read-only worker requested/execution_recorded/search/grep/evidence_mining/request_recorded/request_recorded/intent_recorded/placeholder_ready/recorded/recorded/consumable/recorded/recorded/recorded/candidate_ready/execution_recorded/intent_ready/allowed/recorded/recorded/output_ready/materialization_recorded/allowed/consumable/consumable/consumable/output_consumable/adoption_ready/consumption_ready/allowed/recordable/recordable/recordable/not_ready/adoption_not_recorded/ready/reused/grep",
    );
  });

  it("projects recorded output adoption into the debugger contract", () => {
    const runThread = buildRunThreadContract({
      id: "session_swarm_debugger_adoption",
      workspaceId: "workspace_swarm",
      sessionKey: "session::swarm-debugger-adoption",
      status: "ACTIVE",
      currentStage: "review_confirmed",
      sourcePage: "/operating",
      boundaryNote: "Review-first runtime only.",
      replayableEventLog: "[]",
      resumedFromKey: null,
      swarmReadOnlyWorkersEnabled: true,
      swarmBudgetEnvelope: {
        budgetTokenLimit: 100,
        budgetTokenUsed: 52,
        usagePercent: 52,
        prunedTokenCount: 0,
        posture: "SAFE",
      },
      createdAt: new Date("2026-04-16T09:00:00.000Z"),
      updatedAt: new Date("2026-04-16T09:17:00.000Z"),
      closedAt: null,
      checkpoints: [
        {
          id: "checkpoint_swarm_adoption",
          checkpointKey: "checkpoint::swarm-adoption",
          label: "swarm_adoption_anchor",
          status: "READY",
          summary: "Checkpoint anchor for swarm adoption.",
          createdAt: new Date("2026-04-16T09:01:00.000Z"),
          updatedAt: new Date("2026-04-16T09:01:00.000Z"),
        },
      ],
      swarmSpawnRequestEvent: {
        id: "swarm_request_1",
        taskClass: "read_only_worker",
        checkpointId: "checkpoint_swarm_adoption",
        checkpointKey: "checkpoint::swarm-adoption",
        summary: "Read-only swarm worker spawn request recorded for checkpoint::swarm-adoption.",
        requestedBy: "founder@demo.com",
        sourcePage: "/meetings/meeting_swarm",
        createdAt: new Date("2026-04-16T09:02:00.000Z"),
      },
      swarmReadOnlyWorkerIntentEvent: {
        id: "swarm_intent_1",
        workerKind: "grep",
        packetKey: "swarm::grep::checkpoint::swarm-adoption",
        checkpointId: "checkpoint_swarm_adoption",
        checkpointKey: "checkpoint::swarm-adoption",
        artifactTypes: ["grep_hits.json", "worker_findings_bundle.json"],
        summary: "Read-only worker intent recorded for grep.",
        requestedBy: "founder@demo.com",
        sourcePage: "/meetings/meeting_swarm",
        createdAt: new Date("2026-04-16T09:03:00.000Z"),
      },
      swarmReadOnlyWorkerPlaceholderEvent: {
        id: "swarm_placeholder_1",
        workerKind: "grep",
        packetKey: "swarm::grep::checkpoint::swarm-adoption",
        checkpointId: "checkpoint_swarm_adoption",
        checkpointKey: "checkpoint::swarm-adoption",
        placeholderBundleKey: "artifact-bundle::swarm::grep::checkpoint::swarm-adoption",
        placeholderBundleTitle: "grep findings placeholder bundle",
        artifactTypes: [
          "grep_hits.json",
          "worker_findings_bundle.json",
          "worker_handoff_note.md",
        ],
        handoffConsumerAgent: "lead-orchestrator",
        handoffConsumptionGoal:
          "Run bounded grep-style evidence lookup anchored on checkpoint::swarm-adoption and return typed findings only.",
        summary: "Read-only worker placeholder recorded for grep.",
        requestedBy: "founder@demo.com",
        sourcePage: "/operating",
        createdAt: new Date("2026-04-16T09:04:00.000Z"),
      },
      swarmReadOnlyWorkerExecutionEvent: {
        id: "swarm_execution_1",
        workerKind: "grep",
        packetKey: "swarm::grep::checkpoint::swarm-adoption",
        checkpointId: "checkpoint_swarm_adoption",
        checkpointKey: "checkpoint::swarm-adoption",
        placeholderBundleKey: "artifact-bundle::swarm::grep::checkpoint::swarm-adoption",
        artifactTypes: [
          "grep_hits.json",
          "worker_findings_bundle.json",
          "worker_handoff_note.md",
        ],
        handoffConsumerAgent: "lead-orchestrator",
        handoffConsumptionGoal:
          "Run bounded grep-style evidence lookup anchored on checkpoint::swarm-adoption and return typed findings only.",
        summary: "Read-only worker execution slice recorded for grep.",
        requestedBy: "founder@demo.com",
        sourcePage: "/operating",
        createdAt: new Date("2026-04-16T09:05:00.000Z"),
      },
      swarmReadOnlyWorkerMaterializationEvent: {
        id: "swarm_materialization_1",
        workerKind: "grep",
        packetKey: "swarm::grep::checkpoint::swarm-adoption",
        checkpointId: "checkpoint_swarm_adoption",
        checkpointKey: "checkpoint::swarm-adoption",
        materializationBundleKey: "artifact-bundle::swarm::grep::checkpoint::swarm-adoption",
        materializationBundleTitle: "grep findings placeholder bundle",
        artifactTypes: [
          "grep_hits.json",
          "worker_findings_bundle.json",
          "worker_handoff_note.md",
        ],
        handoffConsumerAgent: "lead-orchestrator",
        handoffConsumptionGoal:
          "Run bounded grep-style evidence lookup anchored on checkpoint::swarm-adoption and return typed findings only.",
        summary: "Read-only worker materialization slice recorded for grep.",
        requestedBy: "founder@demo.com",
        sourcePage: "/operating",
        createdAt: new Date("2026-04-16T09:06:00.000Z"),
      },
      swarmReadOnlyWorkerAdoptionEvent: {
        id: "swarm_adoption_1",
        workerKind: "grep",
        packetKey: "swarm::grep::checkpoint::swarm-adoption",
        checkpointId: "checkpoint_swarm_adoption",
        checkpointKey: "checkpoint::swarm-adoption",
        outputBundleKey: "artifact-bundle::swarm::grep::checkpoint::swarm-adoption",
        outputBundleTitle: "grep findings placeholder bundle",
        outputArtifactTypes: [
          "grep_hits.json",
          "worker_findings_bundle.json",
          "worker_handoff_note.md",
        ],
        handoffConsumerAgent: "lead-orchestrator",
        handoffConsumptionGoal:
          "Run bounded grep-style evidence lookup anchored on checkpoint::swarm-adoption and return typed findings only.",
        summary: "Read-only worker output adoption seam recorded for grep.",
        requestedBy: "founder@demo.com",
        sourcePage: "/operating",
        createdAt: new Date("2026-04-16T09:07:00.000Z"),
      },
      resultAcknowledgements: [],
    });

    const debuggerReadModel = buildOperatorDebuggerReadModel({
      sessionLabel: "Swarm debugger adoption session",
      runThread,
      replayableEventLog: "[]",
      replay: null,
      recovery: {
        state: "STABLE",
        failureTaxonomy: "NONE",
        summary: "No recovery issue is active.",
        operatorAction: "Observe only.",
        allowedActions: [],
        reviewReasons: [],
        blockedReasons: [],
        rollbackAnchor: null,
      },
      notebookState: {
        objective: "Keep swarm output adoption review-first.",
        reviewState: "ready",
        confirmedFacts: [],
        blockers: [],
        decisions: [],
        nextActions: [],
        openQuestions: [],
        boundaryNote: "Review-first runtime only.",
      },
      payloadState: {
        activeHandles: [],
        prunedHandles: [],
        stateSource: "checkpoint_snapshot",
        stateSummary: "No payload drift is active.",
      },
      verification: null,
      contextEditEvents: [],
      remediationTrace: [],
      handoffPackets: [],
    });

    expect(debuggerReadModel.swarmReadOnlyWorkerContract.outputAdoptionRecordState).toBe(
      "recorded",
    );
    expect(debuggerReadModel.swarmReadOnlyWorkerContract.outputAdoptionEventId).toBe(
      "swarm_adoption_1",
    );
    expect(debuggerReadModel.swarmReadOnlyWorkerContract.outputAdoptedBy).toBe(
      "founder@demo.com",
    );
    expect(debuggerReadModel.swarmReadOnlyWorkerContract.outputAdoptionSourcePage).toBe(
      "/operating",
    );
    expect(
      debuggerReadModel.swarmReadOnlyWorkerContract.outputAdoptionLifecycleContract.state,
    ).toBe("recorded");
    expect(
      debuggerReadModel.swarmReadOnlyWorkerContract.outputAdoptionLifecycleContract.driver,
    ).toBe("recorded");
    expect(
      debuggerReadModel.swarmReadOnlyWorkerContract.resultAdoptionResultSideContract.state,
    ).toBe("output_ready");
    expect(
      debuggerReadModel.swarmReadOnlyWorkerContract.resultAdoptionResultSideContract.driver,
    ).toBe("adoption_recorded");
    expect(debuggerReadModel.summary).toContain(
      "read-only worker requested/execution_recorded/search/grep/evidence_mining/request_recorded/request_recorded/intent_recorded/placeholder_ready/recorded/recorded/consumable/recorded/recorded/recorded/candidate_ready/execution_recorded/intent_ready/allowed/recorded/recorded/output_ready/materialization_recorded/allowed/consumable/consumable/consumable/output_consumable/adoption_ready/consumption_ready/allowed/recorded/recorded/recorded/output_ready/adoption_recorded/ready/reused/grep",
    );
  });

  it("distinguishes resume write anchors from replay trace anchors", () => {
    const baselineRunThread = buildRunThreadContract({
      id: "session_resume",
      workspaceId: "workspace_1",
      sessionKey: "session::resume",
      status: "ACTIVE",
      currentStage: "resumed:security_review",
      sourcePage: "/meetings/meeting_resume",
      boundaryNote: "Review-first runtime only.",
      meetingId: "meeting_resume",
      replayableEventLog: JSON.stringify([
        {
          at: "2026-04-12T09:00:00.000Z",
          type: "runtime.trace",
          stage: "meeting_ingest",
          summary: "Meeting ingest completed.",
        },
      ]),
      resumedFromKey: "checkpoint::resume",
      createdAt: new Date("2026-04-12T09:00:00.000Z"),
      updatedAt: new Date("2026-04-12T09:10:00.000Z"),
      closedAt: null,
      checkpoints: [
        {
          id: "checkpoint_resume",
          checkpointKey: "checkpoint::resume",
          label: "security_review",
          status: "RESUMED",
          summary: "Checkpoint resume is active.",
          createdAt: new Date("2026-04-12T09:02:00.000Z"),
          updatedAt: new Date("2026-04-12T09:08:00.000Z"),
        },
      ],
    });
    const runThread = buildRunThreadContract({
      id: "session_resume",
      workspaceId: "workspace_1",
      sessionKey: "session::resume",
      status: "ACTIVE",
      currentStage: "resumed:security_review",
      sourcePage: "/meetings/meeting_resume",
      boundaryNote: "Review-first runtime only.",
      meetingId: "meeting_resume",
      replayableEventLog: JSON.stringify([
        {
          at: "2026-04-12T09:00:00.000Z",
          type: "runtime.trace",
          stage: "meeting_ingest",
          summary: "Meeting ingest completed.",
        },
      ]),
      resumedFromKey: "checkpoint::resume",
      createdAt: new Date("2026-04-12T09:00:00.000Z"),
      updatedAt: new Date("2026-04-12T09:10:00.000Z"),
      closedAt: null,
      checkpoints: [
        {
          id: "checkpoint_resume",
          checkpointKey: "checkpoint::resume",
          label: "security_review",
          status: "RESUMED",
          summary: "Checkpoint resume is active.",
          createdAt: new Date("2026-04-12T09:02:00.000Z"),
          updatedAt: new Date("2026-04-12T09:08:00.000Z"),
        },
      ],
      persistedControlPlaneLifecycle: {
        snapshot: buildRunThreadPersistedControlPlaneLifecycleSnapshot(
          baselineRunThread,
          new Date("2026-04-12T09:09:00.000Z"),
          {
            refreshReason: "checkpoint_resume",
            refreshSource: "checkpoint::resume",
          },
        ),
        parseFailed: false,
      },
    });

    const debuggerReadModel = buildOperatorDebuggerReadModel({
      sessionLabel: "Resume session",
      runThread,
      replayableEventLog: JSON.stringify([
        {
          at: "2026-04-12T09:00:00.000Z",
          type: "runtime.trace",
          stage: "meeting_ingest",
          summary: "Meeting ingest completed.",
        },
      ]),
      replay: {
        fidelityStatus: "STRONG",
        fidelityScore: 96,
        replaySummary: "Replay stays aligned after resume.",
        checkpointId: "checkpoint_resume",
        checkpointLabel: "security_review",
        updatedAt: new Date("2026-04-12T09:08:00.000Z"),
      },
      recovery: {
        state: "STABLE",
        failureTaxonomy: "NONE",
        summary: "Resume stays bounded and aligned.",
        operatorAction: "Observe the resumed checkpoint anchor.",
        allowedActions: ["RESUME_CHECKPOINT"],
        reviewReasons: [],
        blockedReasons: [],
        rollbackAnchor: {
          checkpointId: "checkpoint_resume",
          checkpointLabel: "security_review",
          checkpointStatus: "RESUMED",
        },
      },
      notebookState: {
        objective: "Resume the bounded security review thread.",
        reviewState: "resumed",
        confirmedFacts: ["Security review stays bounded."],
        blockers: [],
        decisions: ["Replay and resume remain aligned."],
        nextActions: ["Observe the resumed checkpoint anchor."],
        openQuestions: [],
        boundaryNote: "Review-first runtime only.",
      },
      payloadState: {
        activeHandles: ["payload://meeting_note/resume/summary"],
        prunedHandles: [],
        stateSource: "checkpoint_snapshot",
        stateSummary: "Checkpoint snapshot remains active.",
      },
      verification: null,
      contextEditEvents: [],
      remediationTrace: [],
      handoffPackets: [],
    });

    expect(debuggerReadModel.traceContract.state).toBe("human_input_ready");
    expect(debuggerReadModel.traceContract.driver).toBe("human_input");
    expect(debuggerReadModel.traceContract.anchor).toBe("human_input");
    expect(debuggerReadModel.writeContract.state).toBe("resume_active");
    expect(debuggerReadModel.writeContract.driver).toBe("resume");
    expect(debuggerReadModel.writeContract.writeAnchor).toBe("resume");
    expect(debuggerReadModel.writeContract.checkpointKey).toBe("checkpoint::resume");
    expect(debuggerReadModel.writeContract.refreshReason).toBe("checkpoint_resume");
    expect(debuggerReadModel.recoveryActionContract.state).toBe("requestable");
    expect(debuggerReadModel.recoveryActionContract.driver).toBe("takeover_request");
    expect(debuggerReadModel.recoveryActionContract.action).toBe("RESUME_CHECKPOINT");
    expect(debuggerReadModel.recoveryActionContract.checkpointKey).toBe("checkpoint::resume");
    expect(debuggerReadModel.recoveryLifecycleContract.state).toBe("request_lane");
    expect(debuggerReadModel.recoveryLifecycleContract.driver).toBe("takeover_request");
    expect(debuggerReadModel.recoveryLifecycleContract.anchor).toBe("resume");
    expect(debuggerReadModel.recoveryLifecycleContract.nextTransition).toBe("request_takeover");
    expect(debuggerReadModel.recoveryTransitionContract.state).toBe("transition_ready");
    expect(debuggerReadModel.recoveryTransitionContract.driver).toBe("takeover_request");
    expect(debuggerReadModel.recoveryTransitionContract.anchor).toBe("resume");
    expect(debuggerReadModel.recoveryTransitionContract.transition).toBe("request_takeover");
    expect(debuggerReadModel.recoveryStateMachineContract.phase).toBe("takeover_request");
    expect(debuggerReadModel.recoveryStateMachineContract.transitionState).toBe("ready");
    expect(debuggerReadModel.recoveryStateMachineContract.currentTransition).toBe(
      "request_takeover",
    );
    expect(debuggerReadModel.recoveryStateMachineContract.completedTransitions).toEqual([]);
    expect(debuggerReadModel.recoveryExecutionContract.state).toBe("executable");
    expect(debuggerReadModel.recoveryExecutionContract.driver).toBe("takeover_request");
    expect(debuggerReadModel.recoveryExecutionContract.anchor).toBe("resume");
    expect(debuggerReadModel.recoveryExecutionContract.currentTransition).toBe(
      "request_takeover",
    );
    expect(debuggerReadModel.recoveryExecutionContract.canExecute).toBe(true);
    expect(debuggerReadModel.recoveryExecutionContract.requiresReview).toBe(false);
    expect(debuggerReadModel.recoveryExecutionContract.checkpointKey).toBe(
      "checkpoint::resume",
    );
    expect(debuggerReadModel.persistedLifecycleTrace.anchor).toBe("human_input");
    expect(
      debuggerReadModel.variableSnapshot.find((item) => item.key === "debugger_write_contract")?.value,
    ).toContain("resume_active");
    expect(debuggerReadModel.summary).toContain("write contract resume_active/resume/resume");
  });

  it("projects takeover release into the active-control read model without reviving request posture", () => {
    const runThread = buildRunThreadContract({
      id: "session_release_1",
      workspaceId: "workspace_1",
      sessionKey: "session::takeover-release",
      status: "ACTIVE",
      currentStage: "continuity_recovery",
      sourcePage: "/meetings/meeting_release_1",
      boundaryNote: "Review-first runtime only.",
      meetingId: "meeting_release_1",
      replayableEventLog: JSON.stringify([]),
      resumedFromKey: null,
      createdAt: new Date("2026-04-12T09:00:00.000Z"),
      updatedAt: new Date("2026-04-12T09:14:00.000Z"),
      closedAt: null,
      checkpoints: [
        {
          id: "checkpoint_release_1",
          checkpointKey: "checkpoint::takeover-release",
          label: "continuity_anchor",
          status: "READY",
          summary: "Checkpoint is still available for bounded review.",
          createdAt: new Date("2026-04-12T09:02:00.000Z"),
          updatedAt: new Date("2026-04-12T09:02:00.000Z"),
        },
      ],
      requestLifecycleEntries: [
        {
          id: "takeover_request_release_1",
          kind: "takeover_requested",
          label: "takeover requested · SAVE_RECOVERY_CHECKPOINT",
          summary: "Operator takeover request recorded for SAVE_RECOVERY_CHECKPOINT on checkpoint::takeover-release.",
          checkpointKey: "checkpoint::takeover-release",
          timestamp: new Date("2026-04-12T09:06:00.000Z"),
        },
        {
          id: "takeover_ack_release_1",
          kind: "takeover_request_acknowledged",
          label: "takeover acknowledged · SAVE_RECOVERY_CHECKPOINT",
          summary: "Operator takeover acknowledgement recorded for SAVE_RECOVERY_CHECKPOINT on checkpoint::takeover-release.",
          checkpointKey: "checkpoint::takeover-release",
          timestamp: new Date("2026-04-12T09:07:00.000Z"),
        },
        {
          id: "takeover_start_release_1",
          kind: "takeover_active",
          label: "takeover active · SAVE_RECOVERY_CHECKPOINT",
          summary: "Operator takeover started for SAVE_RECOVERY_CHECKPOINT on checkpoint::takeover-release.",
          actorName: "founder@demo.com",
          checkpointKey: "checkpoint::takeover-release",
          timestamp: new Date("2026-04-12T09:08:00.000Z"),
        },
        {
          id: "takeover_release_note_1",
          kind: "takeover_released",
          label: "takeover released · SAVE_RECOVERY_CHECKPOINT",
          summary: "Operator takeover released for SAVE_RECOVERY_CHECKPOINT on checkpoint::takeover-release.",
          actorName: "founder@demo.com",
          checkpointKey: "checkpoint::takeover-release",
          timestamp: new Date("2026-04-12T09:09:00.000Z"),
        },
      ],
    });

    const debuggerReadModel = buildOperatorDebuggerReadModel({
      sessionLabel: "Takeover release session",
      runThread,
      replayableEventLog: JSON.stringify([]),
      replay: null,
      recovery: {
        state: "RECOVERABLE",
        failureTaxonomy: "NO_RECOVERY_ANCHOR",
        summary: "Recoverable through explicit operator review.",
        operatorAction: "Save the recovery checkpoint explicitly.",
        allowedActions: ["SAVE_RECOVERY_CHECKPOINT"],
        reviewReasons: [],
        blockedReasons: [],
        rollbackAnchor: {
          checkpointId: "checkpoint_release_1",
          checkpointLabel: "continuity_anchor",
          checkpointStatus: "READY",
        },
      },
      notebookState: {
        objective: "Keep bounded operator control explicit.",
        reviewState: "needs_review",
        confirmedFacts: ["The boundary remains internal."],
        blockers: ["Operator control has to be released explicitly."],
        decisions: ["Do not auto-run the remediation path."],
        nextActions: ["Keep the checkpoint available for manual remediation."],
        openQuestions: ["Who should take control next?"],
        boundaryNote: "Review-first runtime only.",
      },
      payloadState: {
        activeHandles: [],
        prunedHandles: [],
        stateSource: "checkpoint_snapshot",
        stateSummary: "Checkpoint snapshot stays available.",
      },
      verification: {
        status: "NEEDS_REVIEW",
        blockedReasons: ["Explicit operator review is still required."],
      },
      contextEditEvents: [],
      remediationTrace: [],
      handoffPackets: [],
      takeoverRequestEvent: {
        id: "takeover_request_release_1",
        action: "SAVE_RECOVERY_CHECKPOINT",
        checkpointId: "checkpoint_release_1",
        checkpointKey: "checkpoint::takeover-release",
        resumeToken: "checkpoint::takeover-release",
        summary: "Operator takeover request already recorded for SAVE_RECOVERY_CHECKPOINT on checkpoint::takeover-release.",
        requestedBy: "founder@demo.com",
        sourcePage: "/meetings/meeting_release_1",
        createdAt: new Date("2026-04-12T09:06:00.000Z"),
      },
      takeoverAcknowledgementEvent: {
        id: "takeover_ack_release_1",
        requestEventId: "takeover_request_release_1",
        action: "SAVE_RECOVERY_CHECKPOINT",
        checkpointId: "checkpoint_release_1",
        checkpointKey: "checkpoint::takeover-release",
        resumeToken: "checkpoint::takeover-release",
        summary: "Operator takeover acknowledgement recorded for SAVE_RECOVERY_CHECKPOINT on checkpoint::takeover-release.",
        acknowledgedBy: "founder@demo.com",
        sourcePage: "/meetings/meeting_release_1",
        createdAt: new Date("2026-04-12T09:07:00.000Z"),
      },
      takeoverStartEvent: {
        id: "takeover_start_release_1",
        requestEventId: "takeover_request_release_1",
        acknowledgementEventId: "takeover_ack_release_1",
        action: "SAVE_RECOVERY_CHECKPOINT",
        checkpointId: "checkpoint_release_1",
        checkpointKey: "checkpoint::takeover-release",
        resumeToken: "checkpoint::takeover-release",
        summary: "Operator takeover started for SAVE_RECOVERY_CHECKPOINT on checkpoint::takeover-release.",
        startedBy: "founder@demo.com",
        sourcePage: "/meetings/meeting_release_1",
        createdAt: new Date("2026-04-12T09:08:00.000Z"),
      },
      takeoverReleaseEvent: {
        id: "takeover_release_event_1",
        requestEventId: "takeover_request_release_1",
        acknowledgementEventId: "takeover_ack_release_1",
        startEventId: "takeover_start_release_1",
        action: "SAVE_RECOVERY_CHECKPOINT",
        checkpointId: "checkpoint_release_1",
        checkpointKey: "checkpoint::takeover-release",
        resumeToken: "checkpoint::takeover-release",
        summary: "Operator takeover released for SAVE_RECOVERY_CHECKPOINT on checkpoint::takeover-release. Reason: Review handoff closed.",
        releaseReason: "Review handoff closed.",
        releasedBy: "founder@demo.com",
        sourcePage: "/meetings/meeting_release_1",
        createdAt: new Date("2026-04-12T09:09:00.000Z"),
      },
    });

    expect(debuggerReadModel.takeoverRequest.state).toBe("acknowledged");
    expect(debuggerReadModel.takeoverActivation.state).toBe("released");
    expect(debuggerReadModel.takeoverActivation.latestEventKind).toBe("released");
    expect(debuggerReadModel.takeoverActivation.currentOwner).toBeNull();
    expect(debuggerReadModel.takeoverActivation.releasedBy).toBe("founder@demo.com");
    expect(debuggerReadModel.takeoverActivation.releaseReason).toBe("Review handoff closed.");
    expect(debuggerReadModel.takeoverFollowThrough.state).toBe("requestable");
    expect(debuggerReadModel.recoveryActionContract.state).toBe("followthrough_requestable");
    expect(debuggerReadModel.recoveryActionContract.driver).toBe("takeover_followthrough");
    expect(debuggerReadModel.recoveryActionContract.action).toBe("SAVE_RECOVERY_CHECKPOINT");
    expect(debuggerReadModel.recoveryActionContract.checkpointKey).toBe(
      "checkpoint::takeover-release",
    );
    expect(debuggerReadModel.recoveryLifecycleContract.state).toBe("followthrough_lane");
    expect(debuggerReadModel.recoveryLifecycleContract.driver).toBe("takeover_followthrough");
    expect(debuggerReadModel.recoveryLifecycleContract.anchor).toBe("human_input");
    expect(debuggerReadModel.recoveryLifecycleContract.nextTransition).toBe(
      "request_followthrough",
    );
    expect(debuggerReadModel.recoveryTransitionContract.state).toBe("transition_ready");
    expect(debuggerReadModel.recoveryTransitionContract.driver).toBe("takeover_followthrough");
    expect(debuggerReadModel.recoveryTransitionContract.transition).toBe(
      "request_followthrough",
    );
    expect(debuggerReadModel.recoveryStateMachineContract.phase).toBe(
      "takeover_followthrough",
    );
    expect(debuggerReadModel.recoveryStateMachineContract.transitionState).toBe("ready");
    expect(debuggerReadModel.recoveryStateMachineContract.currentTransition).toBe(
      "request_followthrough",
    );
    expect(debuggerReadModel.recoveryStateMachineContract.completedTransitions).toEqual([
      "request_takeover",
      "acknowledge_takeover",
      "start_takeover",
      "release_takeover",
    ]);
    expect(debuggerReadModel.recoveryExecutionContract.state).toBe("executable");
    expect(debuggerReadModel.recoveryExecutionContract.driver).toBe("takeover_followthrough");
    expect(debuggerReadModel.recoveryExecutionContract.anchor).toBe("human_input");
    expect(debuggerReadModel.recoveryExecutionContract.currentTransition).toBe(
      "request_followthrough",
    );
    expect(debuggerReadModel.recoveryExecutionContract.canExecute).toBe(true);
    expect(debuggerReadModel.recoveryExecutionContract.requiresReview).toBe(false);
    expect(debuggerReadModel.recoveryExecutionContract.checkpointKey).toBe(
      "checkpoint::takeover-release",
    );
    expect(debuggerReadModel.takeoverFollowThrough.currentOwner).toBe("founder@demo.com");
    expect(debuggerReadModel.summary).toContain("active control released/released");
    expect(debuggerReadModel.variableSnapshot.find((item) => item.key === "active_control")?.value).toContain(
      "released · no-owner",
    );
    expect(debuggerReadModel.variableSnapshot.find((item) => item.key === "takeover_followthrough")?.value).toContain(
      "requestable",
    );
    expect(debuggerReadModel.variableSnapshot.find((item) => item.key === "forward_flow")?.value).toContain(
      "idle · 0 attention · no-owner",
    );
    expect(debuggerReadModel.variableSnapshot.find((item) => item.key === "closeout_flow")?.value).toContain(
      "idle · 0 open · 0 resolved",
    );
    expect(debuggerReadModel.variableSnapshot.find((item) => item.key === "settlement_flow")?.value).toContain(
      "active · 0 forward attention · 0 closeout open",
    );
    expect(debuggerReadModel.history[0]?.kind).toBe("takeover_released");
  });

  it("projects resolved takeover follow-through into the debugger read model after release", () => {
    const runThread = buildRunThreadContract({
      id: "session_followthrough_1",
      workspaceId: "workspace_1",
      sessionKey: "session::takeover-followthrough",
      status: "ACTIVE",
      currentStage: "review_confirmed",
      sourcePage: "/meetings/meeting_followthrough_1",
      boundaryNote: "Review-first runtime only.",
      meetingId: "meeting_followthrough_1",
      replayableEventLog: JSON.stringify([]),
      resumedFromKey: null,
      createdAt: new Date("2026-04-12T10:00:00.000Z"),
      updatedAt: new Date("2026-04-12T10:18:00.000Z"),
      closedAt: null,
      checkpoints: [
        {
          id: "checkpoint_followthrough_1",
          checkpointKey: "checkpoint::takeover-followthrough",
          label: "continuity_anchor",
          status: "READY",
          summary: "Checkpoint remains available for lifecycle closeout.",
          createdAt: new Date("2026-04-12T10:02:00.000Z"),
          updatedAt: new Date("2026-04-12T10:02:00.000Z"),
        },
      ],
      requestLifecycleEntries: [
        {
          id: "takeover_request_followthrough_1",
          kind: "takeover_requested",
          label: "takeover requested · SAVE_RECOVERY_CHECKPOINT",
          summary: "Operator takeover request recorded for SAVE_RECOVERY_CHECKPOINT on checkpoint::takeover-followthrough.",
          checkpointKey: "checkpoint::takeover-followthrough",
          timestamp: new Date("2026-04-12T10:04:00.000Z"),
        },
        {
          id: "takeover_ack_followthrough_1",
          kind: "takeover_request_acknowledged",
          label: "takeover acknowledged · SAVE_RECOVERY_CHECKPOINT",
          summary: "Operator takeover acknowledgement recorded for SAVE_RECOVERY_CHECKPOINT on checkpoint::takeover-followthrough.",
          checkpointKey: "checkpoint::takeover-followthrough",
          timestamp: new Date("2026-04-12T10:05:00.000Z"),
        },
        {
          id: "takeover_start_followthrough_1",
          kind: "takeover_active",
          label: "takeover active · SAVE_RECOVERY_CHECKPOINT",
          summary: "Operator takeover started for SAVE_RECOVERY_CHECKPOINT on checkpoint::takeover-followthrough.",
          actorName: "founder@demo.com",
          checkpointKey: "checkpoint::takeover-followthrough",
          timestamp: new Date("2026-04-12T10:06:00.000Z"),
        },
        {
          id: "takeover_release_followthrough_1",
          kind: "takeover_released",
          label: "takeover released · SAVE_RECOVERY_CHECKPOINT",
          summary: "Operator takeover released for SAVE_RECOVERY_CHECKPOINT on checkpoint::takeover-followthrough.",
          actorName: "founder@demo.com",
          checkpointKey: "checkpoint::takeover-followthrough",
          timestamp: new Date("2026-04-12T10:07:00.000Z"),
        },
        {
          id: "takeover_followthrough_request_1",
          kind: "takeover_followthrough_requested",
          label: "takeover follow-through requested · SAVE_RECOVERY_CHECKPOINT",
          summary: "Operator takeover follow-through requested for SAVE_RECOVERY_CHECKPOINT on checkpoint::takeover-followthrough.",
          actorName: "operator@demo.com",
          checkpointKey: "checkpoint::takeover-followthrough",
          timestamp: new Date("2026-04-12T10:08:00.000Z"),
        },
        {
          id: "takeover_followthrough_resolved_1",
          kind: "takeover_followthrough_resolved",
          label: "takeover follow-through resolved · SAVE_RECOVERY_CHECKPOINT",
          summary: "Operator takeover follow-through resolved for SAVE_RECOVERY_CHECKPOINT on checkpoint::takeover-followthrough.",
          actorName: "operator@demo.com",
          checkpointKey: "checkpoint::takeover-followthrough",
          timestamp: new Date("2026-04-12T10:10:00.000Z"),
        },
      ],
    });

    const debuggerReadModel = buildOperatorDebuggerReadModel({
      sessionLabel: "Takeover follow-through session",
      runThread,
      replayableEventLog: JSON.stringify([]),
      replay: null,
      recovery: {
        state: "RECOVERABLE",
        failureTaxonomy: "NO_RECOVERY_ANCHOR",
        summary: "Recoverable through explicit operator review.",
        operatorAction: "Save the recovery checkpoint explicitly.",
        allowedActions: ["SAVE_RECOVERY_CHECKPOINT"],
        reviewReasons: [],
        blockedReasons: [],
        rollbackAnchor: {
          checkpointId: "checkpoint_followthrough_1",
          checkpointLabel: "continuity_anchor",
          checkpointStatus: "READY",
        },
      },
      notebookState: {
        objective: "Keep lifecycle closeout explicit.",
        reviewState: "needs_review",
        confirmedFacts: ["The boundary remains internal."],
        blockers: ["Takeover closeout must be resolved explicitly."],
        decisions: ["Do not auto-close the thread."],
        nextActions: ["Resolve the takeover follow-through after review."],
        openQuestions: [],
        boundaryNote: "Review-first runtime only.",
      },
      payloadState: {
        activeHandles: [],
        prunedHandles: [],
        stateSource: "checkpoint_snapshot",
        stateSummary: "Checkpoint snapshot stays available.",
      },
      verification: null,
      contextEditEvents: [],
      remediationTrace: [],
      handoffPackets: [],
      takeoverRequestEvent: {
        id: "takeover_request_followthrough_1",
        action: "SAVE_RECOVERY_CHECKPOINT",
        checkpointId: "checkpoint_followthrough_1",
        checkpointKey: "checkpoint::takeover-followthrough",
        resumeToken: "checkpoint::takeover-followthrough",
        summary: "Operator takeover request recorded for SAVE_RECOVERY_CHECKPOINT on checkpoint::takeover-followthrough.",
        requestedBy: "founder@demo.com",
        sourcePage: "/meetings/meeting_followthrough_1",
        createdAt: new Date("2026-04-12T10:04:00.000Z"),
      },
      takeoverAcknowledgementEvent: {
        id: "takeover_ack_followthrough_1",
        requestEventId: "takeover_request_followthrough_1",
        action: "SAVE_RECOVERY_CHECKPOINT",
        checkpointId: "checkpoint_followthrough_1",
        checkpointKey: "checkpoint::takeover-followthrough",
        resumeToken: "checkpoint::takeover-followthrough",
        summary: "Operator takeover acknowledgement recorded for SAVE_RECOVERY_CHECKPOINT on checkpoint::takeover-followthrough.",
        acknowledgedBy: "founder@demo.com",
        sourcePage: "/meetings/meeting_followthrough_1",
        createdAt: new Date("2026-04-12T10:05:00.000Z"),
      },
      takeoverStartEvent: {
        id: "takeover_start_followthrough_1",
        requestEventId: "takeover_request_followthrough_1",
        acknowledgementEventId: "takeover_ack_followthrough_1",
        action: "SAVE_RECOVERY_CHECKPOINT",
        checkpointId: "checkpoint_followthrough_1",
        checkpointKey: "checkpoint::takeover-followthrough",
        resumeToken: "checkpoint::takeover-followthrough",
        summary: "Operator takeover started for SAVE_RECOVERY_CHECKPOINT on checkpoint::takeover-followthrough.",
        startedBy: "founder@demo.com",
        sourcePage: "/meetings/meeting_followthrough_1",
        createdAt: new Date("2026-04-12T10:06:00.000Z"),
      },
      takeoverReleaseEvent: {
        id: "takeover_release_followthrough_1",
        requestEventId: "takeover_request_followthrough_1",
        acknowledgementEventId: "takeover_ack_followthrough_1",
        startEventId: "takeover_start_followthrough_1",
        action: "SAVE_RECOVERY_CHECKPOINT",
        checkpointId: "checkpoint_followthrough_1",
        checkpointKey: "checkpoint::takeover-followthrough",
        resumeToken: "checkpoint::takeover-followthrough",
        summary: "Operator takeover released for SAVE_RECOVERY_CHECKPOINT on checkpoint::takeover-followthrough. Reason: Review handoff closed.",
        releaseReason: "Review handoff closed.",
        releasedBy: "founder@demo.com",
        sourcePage: "/meetings/meeting_followthrough_1",
        createdAt: new Date("2026-04-12T10:07:00.000Z"),
      },
      takeoverFollowThroughRequestEvent: {
        id: "takeover_followthrough_request_1",
        takeoverRequestEventId: "takeover_request_followthrough_1",
        acknowledgementEventId: "takeover_ack_followthrough_1",
        startEventId: "takeover_start_followthrough_1",
        releaseEventId: "takeover_release_followthrough_1",
        action: "SAVE_RECOVERY_CHECKPOINT",
        checkpointId: "checkpoint_followthrough_1",
        checkpointKey: "checkpoint::takeover-followthrough",
        resumeToken: "checkpoint::takeover-followthrough",
        summary: "Operator takeover follow-through requested for SAVE_RECOVERY_CHECKPOINT on checkpoint::takeover-followthrough.",
        nextAction: "Resolve the closeout after the checkpoint review is complete.",
        requestedBy: "operator@demo.com",
        sourcePage: "/meetings/meeting_followthrough_1",
        createdAt: new Date("2026-04-12T10:08:00.000Z"),
      },
      takeoverFollowThroughResolvedEvent: {
        id: "takeover_followthrough_resolved_1",
        requestEventId: "takeover_followthrough_request_1",
        takeoverRequestEventId: "takeover_request_followthrough_1",
        acknowledgementEventId: "takeover_ack_followthrough_1",
        startEventId: "takeover_start_followthrough_1",
        releaseEventId: "takeover_release_followthrough_1",
        action: "SAVE_RECOVERY_CHECKPOINT",
        checkpointId: "checkpoint_followthrough_1",
        checkpointKey: "checkpoint::takeover-followthrough",
        resumeToken: "checkpoint::takeover-followthrough",
        summary: "Operator takeover follow-through resolved for SAVE_RECOVERY_CHECKPOINT on checkpoint::takeover-followthrough.",
        nextAction: "Review the next bounded thread if another checkpoint restore is needed.",
        resolvedBy: "operator@demo.com",
        sourcePage: "/meetings/meeting_followthrough_1",
        createdAt: new Date("2026-04-12T10:10:00.000Z"),
      },
    });

    expect(debuggerReadModel.takeoverFollowThrough.state).toBe("resolved");
    expect(debuggerReadModel.recoveryActionContract.state).toBe("followthrough_resolved");
    expect(debuggerReadModel.recoveryActionContract.driver).toBe("takeover_followthrough");
    expect(debuggerReadModel.recoveryActionContract.action).toBe("SAVE_RECOVERY_CHECKPOINT");
    expect(debuggerReadModel.recoveryActionContract.checkpointKey).toBe(
      "checkpoint::takeover-followthrough",
    );
    expect(debuggerReadModel.recoveryLifecycleContract.state).toBe("followthrough_lane");
    expect(debuggerReadModel.recoveryLifecycleContract.driver).toBe("takeover_followthrough");
    expect(debuggerReadModel.recoveryLifecycleContract.nextTransition).toBe("observe");
    expect(debuggerReadModel.recoveryTransitionContract.state).toBe("transition_resolved");
    expect(debuggerReadModel.recoveryTransitionContract.driver).toBe(
      "takeover_followthrough",
    );
    expect(debuggerReadModel.recoveryTransitionContract.transition).toBe("observe");
    expect(debuggerReadModel.recoveryStateMachineContract.phase).toBe("observe");
    expect(debuggerReadModel.recoveryStateMachineContract.transitionState).toBe("resolved");
    expect(debuggerReadModel.recoveryStateMachineContract.currentTransition).toBe("observe");
    expect(debuggerReadModel.recoveryStateMachineContract.completedTransitions).toEqual([
      "request_takeover",
      "acknowledge_takeover",
      "start_takeover",
      "release_takeover",
      "request_followthrough",
      "resolve_followthrough",
      "observe",
    ]);
    expect(debuggerReadModel.recoveryExecutionContract.state).toBe("applied");
    expect(debuggerReadModel.recoveryExecutionContract.driver).toBe("takeover_followthrough");
    expect(debuggerReadModel.recoveryExecutionContract.anchor).toBe("human_input");
    expect(debuggerReadModel.recoveryExecutionContract.currentTransition).toBe("observe");
    expect(debuggerReadModel.recoveryExecutionContract.canExecute).toBe(false);
    expect(debuggerReadModel.recoveryExecutionContract.requiresReview).toBe(false);
    expect(debuggerReadModel.recoveryExecutionContract.checkpointKey).toBe(
      "checkpoint::takeover-followthrough",
    );
    expect(debuggerReadModel.takeoverFollowThrough.requestedBy).toBe("operator@demo.com");
    expect(debuggerReadModel.takeoverFollowThrough.resolvedBy).toBe("operator@demo.com");
    expect(debuggerReadModel.variableSnapshot.find((item) => item.key === "takeover_followthrough")?.value).toContain(
      "resolved",
    );
    expect(
      debuggerReadModel.variableSnapshot.find((item) => item.key === "debugger_recovery_action_contract")
        ?.value,
    ).toContain("followthrough_resolved");
    expect(debuggerReadModel.summary).toContain("takeover follow-through resolved");
    expect(debuggerReadModel.summary).toContain("closeout flow resolved/0");
    expect(debuggerReadModel.summary).toContain("closeout summary review_requestable/settlement_review");
    expect(debuggerReadModel.summary).toContain(
      "closeout resolution follow-through not_available/no-decision",
    );
    expect(debuggerReadModel.summary).toContain("closeout outcome not_available/no-decision");
    expect(debuggerReadModel.summary).toContain("settlement review requestable");
    expect(debuggerReadModel.summary).toContain("closeout confirmation not_available");
    expect(debuggerReadModel.summary).toContain("closeout refresh not_requestable");
    expect(debuggerReadModel.summary).toContain("settlement flow ready_to_close/0");
    expect(debuggerReadModel.variableSnapshot.find((item) => item.key === "closeout_flow")?.value).toContain(
      "resolved · 0 open · 1 resolved",
    );
    expect(
      debuggerReadModel.variableSnapshot.find((item) => item.key === "closeout_summary")?.value,
    ).toContain("review_requestable · settlement_review");
    expect(
      debuggerReadModel.variableSnapshot.find((item) => item.key === "closeout_resolution_followthrough")?.value,
    ).toContain("not_available · no-decision");
    expect(
      debuggerReadModel.variableSnapshot.find((item) => item.key === "closeout_outcome")?.value,
    ).toContain("not_available · no-decision");
    expect(debuggerReadModel.variableSnapshot.find((item) => item.key === "settlement_flow")?.value).toContain(
      "ready_to_close · 0 forward attention · 0 closeout open",
    );
    expect(debuggerReadModel.variableSnapshot.find((item) => item.key === "settlement_review")?.value).toContain(
      "requestable",
    );
    expect(
      debuggerReadModel.variableSnapshot.find((item) => item.key === "closeout_confirmation")?.value,
    ).toContain("not_available");
    expect(debuggerReadModel.variableSnapshot.find((item) => item.key === "closeout_refresh")?.value).toContain(
      "not_requestable",
    );
  });

  it("projects confirmed closeout truth into the debugger snapshot", () => {
    const runThread = buildRunThreadContract({
      id: "session_closeout_confirmation_1",
      workspaceId: "workspace_1",
      sessionKey: "session::closeout-confirmation",
      status: "ACTIVE",
      currentStage: "review_confirmed",
      sourcePage: "/meetings/meeting_closeout_confirmation_1",
      boundaryNote: "Review-first runtime only.",
      replayableEventLog: JSON.stringify([]),
      resumedFromKey: null,
      createdAt: new Date("2026-04-12T09:00:00.000Z"),
      updatedAt: new Date("2026-04-12T09:18:00.000Z"),
      closedAt: null,
      checkpoints: [
        {
          id: "checkpoint_closeout_confirmation_1",
          checkpointKey: "checkpoint::closeout-confirmation",
          label: "closeout_confirmation_anchor",
          status: "READY",
          summary: "Checkpoint remains available for explicit thread closeout confirmation.",
          createdAt: new Date("2026-04-12T09:02:00.000Z"),
          updatedAt: new Date("2026-04-12T09:02:00.000Z"),
        },
      ],
      resultAcknowledgements: [
        {
          id: "ack_closeout_confirmation_1",
          source: "official_followthrough",
          state: "follow_through_resolved",
          summary: "Official follow-through resolved after review.",
          timestamp: new Date("2026-04-12T09:04:00.000Z"),
        },
      ],
      settlementReviewEntries: [
        {
          id: "settlement_review_request_closeout_confirmation_1",
          kind: "settlement_review_requested",
          summary: "Settlement review requested for checkpoint::closeout-confirmation.",
          actorName: "operator@demo.com",
          checkpointId: "checkpoint_closeout_confirmation_1",
          checkpointKey: "checkpoint::closeout-confirmation",
          resumeToken: "checkpoint::closeout-confirmation",
          nextAction: "Resolve the explicit settlement review before the thread is closed.",
          sourcePage: "/meetings/meeting_closeout_confirmation_1",
          timestamp: new Date("2026-04-12T09:06:00.000Z"),
        },
        {
          id: "settlement_review_resolved_closeout_confirmation_1",
          kind: "settlement_review_resolved",
          summary: "Settlement review resolved for checkpoint::closeout-confirmation.",
          actorName: "reviewer@demo.com",
          checkpointId: "checkpoint_closeout_confirmation_1",
          checkpointKey: "checkpoint::closeout-confirmation",
          resumeToken: "checkpoint::closeout-confirmation",
          nextAction: "Confirm the thread-level closeout truth before the runtime session is closed.",
          sourcePage: "/meetings/meeting_closeout_confirmation_1",
          timestamp: new Date("2026-04-12T09:08:00.000Z"),
        },
      ],
      closeoutConfirmationEntries: [
        {
          id: "closeout_confirmation_event_1",
          kind: "closeout_confirmed",
          summary: "Thread-level closeout truth confirmed for checkpoint::closeout-confirmation.",
          actorName: "operator@demo.com",
          settlementReviewResolutionEventId: "settlement_review_resolved_closeout_confirmation_1",
          checkpointId: "checkpoint_closeout_confirmation_1",
          checkpointKey: "checkpoint::closeout-confirmation",
          resumeToken: "checkpoint::closeout-confirmation",
          nextAction:
            "Close the runtime session only when bounded operator review confirms the thread can be closed without implying broader authority.",
          sourcePage: "/meetings/meeting_closeout_confirmation_1",
          timestamp: new Date("2026-04-12T09:10:00.000Z"),
        },
      ],
    });

    const debuggerReadModel = buildOperatorDebuggerReadModel({
      sessionLabel: "Closeout confirmation session",
      runThread,
      replayableEventLog: "[]",
      replay: null,
      recovery: {
        state: "STABLE",
        failureTaxonomy: "NONE",
        summary: "Run thread is stable after settlement review.",
        operatorAction: "No additional bounded remediation is required.",
        allowedActions: [],
        reviewReasons: [],
        blockedReasons: [],
        rollbackAnchor: null,
      },
      notebookState: {
        objective: "Close the bounded review thread.",
        reviewState: "review_confirmed",
        confirmedFacts: [],
        blockers: [],
        decisions: [],
        nextActions: [],
        openQuestions: [],
        boundaryNote: "Review-first runtime only.",
      },
      payloadState: {
        activeHandles: [],
        prunedHandles: [],
        stateSource: "runtime",
        stateSummary: "No external payload drift.",
      },
      verification: null,
      contextEditEvents: [],
      remediationTrace: [],
      handoffPackets: [],
      takeoverRequestEvent: null,
      takeoverAcknowledgementEvent: null,
      takeoverStartEvent: null,
      takeoverReleaseEvent: null,
      takeoverFollowThroughRequestEvent: null,
      takeoverFollowThroughResolvedEvent: null,
      humanInputRequestEvent: null,
      humanInputAcknowledgementEvent: null,
    });

    expect(debuggerReadModel.summary).toContain("settlement review resolved");
    expect(debuggerReadModel.summary).toContain("closeout summary confirmed/closeout_confirmation");
    expect(debuggerReadModel.summary).toContain("closeout confirmation confirmed");
    expect(debuggerReadModel.summary).toContain(
      "closeout resolution follow-through not_available/no-decision",
    );
    expect(debuggerReadModel.summary).toContain("closeout refresh not_requestable");
    expect(
      debuggerReadModel.variableSnapshot.find((item) => item.key === "closeout_confirmation")?.value,
    ).toContain("confirmed · checkpoint::closeout-confirmation · operator@demo.com");
    expect(
      debuggerReadModel.variableSnapshot.find((item) => item.key === "closeout_summary")?.value,
    ).toContain("confirmed · closeout_confirmation · checkpoint::closeout-confirmation");
    expect(
      debuggerReadModel.variableSnapshot.find((item) => item.key === "closeout_resolution_followthrough")?.value,
    ).toContain("not_available · no-decision");
    expect(debuggerReadModel.variableSnapshot.find((item) => item.key === "closeout_refresh")?.value).toContain(
      "not_requestable",
    );
  });

  it("projects closeout resolution follow-through into the debugger snapshot", () => {
    const runThread = buildRunThreadContract({
      id: "session_closeout_resolution_followthrough_1",
      workspaceId: "workspace_1",
      sessionKey: "session::closeout-resolution-followthrough",
      status: "ACTIVE",
      currentStage: "review_confirmed",
      sourcePage: "/meetings/meeting_closeout_resolution_followthrough_1",
      boundaryNote: "Review-first runtime only.",
      replayableEventLog: "[]",
      resumedFromKey: null,
      createdAt: new Date("2026-04-12T09:00:00.000Z"),
      updatedAt: new Date("2026-04-12T09:18:00.000Z"),
      closedAt: null,
      checkpoints: [
        {
          id: "checkpoint_closeout_resolution_followthrough_1",
          checkpointKey: "checkpoint::closeout-resolution-followthrough",
          label: "closeout_resolution_followthrough_anchor",
          status: "READY",
          summary: "Checkpoint remains available for explicit closeout resolution follow-through.",
          createdAt: new Date("2026-04-12T09:02:00.000Z"),
          updatedAt: new Date("2026-04-12T09:02:00.000Z"),
        },
      ],
      resultAcknowledgements: [
        {
          id: "ack_closeout_resolution_followthrough_1",
          source: "official_followthrough",
          state: "follow_through_resolved",
          summary: "Official follow-through resolved after review.",
          timestamp: new Date("2026-04-12T09:04:00.000Z"),
        },
      ],
      settlementReviewEntries: [
        {
          id: "settlement_review_request_closeout_resolution_followthrough_1",
          kind: "settlement_review_requested",
          summary:
            "Settlement review requested for checkpoint::closeout-resolution-followthrough.",
          actorName: "operator@demo.com",
          checkpointId: "checkpoint_closeout_resolution_followthrough_1",
          checkpointKey: "checkpoint::closeout-resolution-followthrough",
          resumeToken: "checkpoint::closeout-resolution-followthrough",
          nextAction: "Resolve the explicit settlement review before the thread is closed.",
          sourcePage: "/meetings/meeting_closeout_resolution_followthrough_1",
          timestamp: new Date("2026-04-12T09:06:00.000Z"),
        },
        {
          id: "settlement_review_resolved_closeout_resolution_followthrough_1",
          kind: "settlement_review_resolved",
          summary:
            "Settlement review resolved for checkpoint::closeout-resolution-followthrough.",
          actorName: "reviewer@demo.com",
          checkpointId: "checkpoint_closeout_resolution_followthrough_1",
          checkpointKey: "checkpoint::closeout-resolution-followthrough",
          resumeToken: "checkpoint::closeout-resolution-followthrough",
          nextAction: "Confirm the thread-level closeout truth before the runtime session is closed.",
          sourcePage: "/meetings/meeting_closeout_resolution_followthrough_1",
          timestamp: new Date("2026-04-12T09:08:00.000Z"),
        },
      ],
      closeoutConfirmationEntries: [
        {
          id: "closeout_confirmation_closeout_resolution_followthrough_1",
          kind: "closeout_confirmed",
          summary:
            "Thread-level closeout truth confirmed for checkpoint::closeout-resolution-followthrough.",
          actorName: "operator@demo.com",
          settlementReviewResolutionEventId:
            "settlement_review_resolved_closeout_resolution_followthrough_1",
          checkpointId: "checkpoint_closeout_resolution_followthrough_1",
          checkpointKey: "checkpoint::closeout-resolution-followthrough",
          resumeToken: "checkpoint::closeout-resolution-followthrough",
          nextAction:
            "Close the runtime session only when bounded operator review confirms the thread can be closed without implying broader authority.",
          sourcePage: "/meetings/meeting_closeout_resolution_followthrough_1",
          timestamp: new Date("2026-04-12T09:10:00.000Z"),
        },
      ],
      closeoutResolutionEntries: [
        {
          id: "closeout_resolution_closeout_resolution_followthrough_1",
          kind: "closeout_resolution_recorded",
          decision: "close_thread",
          summary:
            "Explicit close-thread resolution recorded for checkpoint::closeout-resolution-followthrough.",
          actorName: "operator@demo.com",
          closeoutConfirmationEventId:
            "closeout_confirmation_closeout_resolution_followthrough_1",
          closeoutRefreshEventId: null,
          checkpointId: "checkpoint_closeout_resolution_followthrough_1",
          checkpointKey: "checkpoint::closeout-resolution-followthrough",
          resumeToken: "checkpoint::closeout-resolution-followthrough",
          nextAction:
            "Close the runtime session only when a separate bounded operator action explicitly executes the close.",
          sourcePage: "/meetings/meeting_closeout_resolution_followthrough_1",
          timestamp: new Date("2026-04-12T09:12:00.000Z"),
        },
      ],
      closeoutResolutionFollowThroughEntries: [
        {
          id: "closeout_resolution_followthrough_request_debugger_1",
          kind: "closeout_resolution_followthrough_requested",
          decision: "close_thread",
          summary:
            "Close-thread follow-through requested for checkpoint::closeout-resolution-followthrough.",
          actorName: "operator@demo.com",
          closeoutResolutionEventId:
            "closeout_resolution_closeout_resolution_followthrough_1",
          checkpointId: "checkpoint_closeout_resolution_followthrough_1",
          checkpointKey: "checkpoint::closeout-resolution-followthrough",
          resumeToken: "checkpoint::closeout-resolution-followthrough",
          nextAction:
            "Resolve the explicit close-thread follow-through before the thread is treated as lifecycle-settled.",
          sourcePage: "/meetings/meeting_closeout_resolution_followthrough_1",
          timestamp: new Date("2026-04-12T09:13:00.000Z"),
        },
        {
          id: "closeout_resolution_followthrough_resolved_debugger_1",
          kind: "closeout_resolution_followthrough_resolved",
          decision: "close_thread",
          summary:
            "Close-thread follow-through resolved for checkpoint::closeout-resolution-followthrough.",
          actorName: "reviewer@demo.com",
          requestEventId: "closeout_resolution_followthrough_request_debugger_1",
          closeoutResolutionEventId:
            "closeout_resolution_closeout_resolution_followthrough_1",
          checkpointId: "checkpoint_closeout_resolution_followthrough_1",
          checkpointKey: "checkpoint::closeout-resolution-followthrough",
          resumeToken: "checkpoint::closeout-resolution-followthrough",
          nextAction: "No further close-thread follow-through remains open on this resolution.",
          sourcePage: "/meetings/meeting_closeout_resolution_followthrough_1",
          timestamp: new Date("2026-04-12T09:14:00.000Z"),
        },
      ],
    });

    const debuggerReadModel = buildOperatorDebuggerReadModel({
      sessionLabel: "Closeout resolution follow-through session",
      runThread,
      replayableEventLog: "[]",
      replay: null,
      recovery: {
        state: "STABLE",
        failureTaxonomy: "NONE",
        summary: "Run thread is stable after explicit close-thread follow-through.",
        operatorAction: "No additional bounded remediation is required.",
        allowedActions: [],
        reviewReasons: [],
        blockedReasons: [],
        rollbackAnchor: null,
      },
      notebookState: {
        objective: "Keep closeout follow-through explicit.",
        reviewState: "review_confirmed",
        confirmedFacts: [],
        blockers: [],
        decisions: [],
        nextActions: [],
        openQuestions: [],
        boundaryNote: "Review-first runtime only.",
      },
      payloadState: {
        activeHandles: [],
        prunedHandles: [],
        stateSource: "runtime",
        stateSummary: "No external payload drift.",
      },
      verification: null,
      contextEditEvents: [],
      remediationTrace: [],
      handoffPackets: [],
      takeoverRequestEvent: null,
      takeoverAcknowledgementEvent: null,
      takeoverStartEvent: null,
      takeoverReleaseEvent: null,
      takeoverFollowThroughRequestEvent: null,
      takeoverFollowThroughResolvedEvent: null,
      humanInputRequestEvent: null,
      humanInputAcknowledgementEvent: null,
    });

    expect(debuggerReadModel.summary).toContain(
      "closeout resolution follow-through resolved/close_thread",
    );
    expect(debuggerReadModel.summary).toContain("closeout outcome close_pending/close_thread");
    expect(debuggerReadModel.summary).toContain("close request requestable");
    expect(debuggerReadModel.summary).toContain("close lifecycle close_requestable/close_request");
    expect(debuggerReadModel.summary).toContain("close control close_requestable/close_lifecycle");
    expect(debuggerReadModel.summary).toContain("close control flow close_requestable/close_control");
    expect(debuggerReadModel.summary).toContain("close decision flow close_requestable/close_request");
    expect(
      debuggerReadModel.summary,
    ).toContain("close decision control close_requestable/close_decision_flow");
    expect(debuggerReadModel.summary).toContain("close resolution ready_to_request_close/close_request");
    expect(
      debuggerReadModel.summary,
    ).toContain("close resolution forward ready_to_request_close/close_resolution_summary");
    expect(
      debuggerReadModel.summary,
    ).toContain("close resolution control ready_to_request_close/close_resolution_summary");
    expect(debuggerReadModel.summary).toContain(
      "close posture close_ready/close_resolution_control_summary",
    );
    expect(debuggerReadModel.summary).toContain(
      "close posture forward close_ready/close_posture_summary",
    );
    expect(
      debuggerReadModel.variableSnapshot.find((item) => item.key === "closeout_resolution_followthrough")?.value,
    ).toContain("resolved · close_thread · checkpoint::closeout-resolution-followthrough");
    expect(
      debuggerReadModel.variableSnapshot.find((item) => item.key === "closeout_outcome")?.value,
    ).toContain("close_pending · close_thread · checkpoint::closeout-resolution-followthrough");
    expect(
      debuggerReadModel.variableSnapshot.find((item) => item.key === "close_request")?.value,
    ).toContain("requestable · checkpoint::closeout-resolution-followthrough · no-owner");
    expect(
      debuggerReadModel.variableSnapshot.find((item) => item.key === "close_lifecycle")?.value,
    ).toContain("close_requestable · close_request · checkpoint::closeout-resolution-followthrough");
    expect(
      debuggerReadModel.variableSnapshot.find((item) => item.key === "close_control")?.value,
    ).toContain("close_requestable · close_lifecycle · checkpoint::closeout-resolution-followthrough");
    expect(
      debuggerReadModel.variableSnapshot.find((item) => item.key === "close_control_flow")?.value,
    ).toContain("close_requestable · close_control · checkpoint::closeout-resolution-followthrough");
    expect(
      debuggerReadModel.variableSnapshot.find((item) => item.key === "close_decision_flow")?.value,
    ).toContain("close_requestable · close_request · checkpoint::closeout-resolution-followthrough");
    expect(
      debuggerReadModel.variableSnapshot.find((item) => item.key === "close_decision_control_summary")
        ?.value,
    ).toContain(
      "close_requestable · close_decision_flow · checkpoint::closeout-resolution-followthrough",
    );
    expect(
      debuggerReadModel.variableSnapshot.find((item) => item.key === "close_resolution_summary")
        ?.value,
    ).toContain("ready_to_request_close · close_request · checkpoint::closeout-resolution-followthrough");
    expect(
      debuggerReadModel.variableSnapshot.find(
        (item) => item.key === "close_resolution_forward_summary",
      )?.value,
    ).toContain(
      "ready_to_request_close · close_resolution_summary · checkpoint::closeout-resolution-followthrough",
    );
    expect(
      debuggerReadModel.variableSnapshot.find(
        (item) => item.key === "close_resolution_control_summary",
      )?.value,
    ).toContain(
      "ready_to_request_close · close_resolution_summary · checkpoint::closeout-resolution-followthrough",
    );
    expect(
      debuggerReadModel.variableSnapshot.find((item) => item.key === "close_posture_summary")
        ?.value,
    ).toContain(
      "close_ready · close_resolution_control_summary · checkpoint::closeout-resolution-followthrough",
    );
    expect(
      debuggerReadModel.variableSnapshot.find(
        (item) => item.key === "close_posture_forward_summary",
      )?.value,
    ).toContain(
      "close_ready · close_posture_summary · checkpoint::closeout-resolution-followthrough",
    );
    expect(debuggerReadModel.variableSnapshot.find((item) => item.key === "closeout_flow")?.value).toContain(
      "resolved · 0 open · 2 resolved",
    );
    expect(debuggerReadModel.variableSnapshot.find((item) => item.key === "settlement_flow")?.value).toContain(
      "ready_to_close · 0 forward attention · 0 closeout open",
    );
  });

  it("keeps human input checkpoint unavailable when no checkpoint anchor exists", () => {
    const runThread = buildRunThreadContract({
      id: "session_2",
      workspaceId: "workspace_1",
      sessionKey: "session::no-anchor",
      status: "FAILED",
      currentStage: "failed",
      sourcePage: "/meetings/meeting_2",
      boundaryNote: "Review-first runtime only.",
      replayableEventLog: "[]",
      resumedFromKey: null,
      createdAt: new Date("2026-04-11T09:00:00.000Z"),
      updatedAt: new Date("2026-04-11T09:10:00.000Z"),
      closedAt: new Date("2026-04-11T09:10:00.000Z"),
      checkpoints: [],
    });

    const debuggerReadModel = buildOperatorDebuggerReadModel({
      sessionLabel: "No-anchor session",
      runThread,
      replayableEventLog: "[]",
      replay: null,
      recovery: {
        state: "BLOCKED",
        failureTaxonomy: "NO_RECOVERY_ANCHOR",
        summary: "Continuity is blocked because no recovery anchor exists.",
        operatorAction: "Do not attempt operator remediation here. Re-run the session or rebuild a safe checkpoint through a fresh runtime pass.",
        allowedActions: [],
        reviewReasons: [],
        blockedReasons: ["No trustworthy checkpoint anchor is available."],
        rollbackAnchor: null,
      },
      notebookState: {
        objective: "Recover the failed run.",
        reviewState: "failed",
        confirmedFacts: [],
        blockers: ["No checkpoint anchor exists."],
        decisions: [],
        nextActions: [],
        openQuestions: [],
        boundaryNote: "Review-first runtime only.",
      },
      payloadState: {
        activeHandles: [],
        prunedHandles: [],
        stateSource: "all_persisted",
        stateSummary: "All payloads remain active.",
      },
      verification: null,
      contextEditEvents: [],
      remediationTrace: [],
      handoffPackets: [],
    });

    expect(debuggerReadModel.history.some((item) => item.kind === "run_closed")).toBe(true);
    expect(debuggerReadModel.replayAssistance.fidelity).toBe("none");
    expect(debuggerReadModel.traceContract.state).toBe("backfill_required");
    expect(debuggerReadModel.traceContract.driver).toBe("persisted_lifecycle");
    expect(debuggerReadModel.traceContract.anchor).toBe("none");
    expect(debuggerReadModel.writeContract.state).toBe("backfill_required");
    expect(debuggerReadModel.writeContract.driver).toBe("persisted_lifecycle");
    expect(debuggerReadModel.writeContract.writeAnchor).toBe("none");
    expect(debuggerReadModel.recoveryActionContract.state).toBe("backfill_required");
    expect(debuggerReadModel.recoveryActionContract.driver).toBe("persisted_lifecycle");
    expect(debuggerReadModel.recoveryActionContract.action).toBeNull();
    expect(debuggerReadModel.recoveryLifecycleContract.state).toBe("backfill_required");
    expect(debuggerReadModel.recoveryLifecycleContract.driver).toBe("persisted_lifecycle");
    expect(debuggerReadModel.recoveryLifecycleContract.anchor).toBe("none");
    expect(debuggerReadModel.recoveryLifecycleContract.nextTransition).toBe("backfill_snapshot");
    expect(debuggerReadModel.recoveryTransitionContract.state).toBe("backfill_required");
    expect(debuggerReadModel.recoveryTransitionContract.driver).toBe("persisted_lifecycle");
    expect(debuggerReadModel.recoveryTransitionContract.transition).toBe(
      "backfill_snapshot",
    );
    expect(debuggerReadModel.recoveryStateMachineContract.phase).toBe("materialization");
    expect(debuggerReadModel.recoveryStateMachineContract.transitionState).toBe("required");
    expect(debuggerReadModel.recoveryStateMachineContract.currentTransition).toBe(
      "backfill_snapshot",
    );
    expect(debuggerReadModel.recoveryStateMachineContract.allowedTransitions).toEqual([
      "backfill_snapshot",
    ]);
    expect(debuggerReadModel.recoveryStateMachineContract.completedTransitions).toEqual([]);
    expect(debuggerReadModel.recoveryExecutionContract.state).toBe("backfill_required");
    expect(debuggerReadModel.recoveryExecutionContract.driver).toBe("persisted_lifecycle");
    expect(debuggerReadModel.recoveryExecutionContract.anchor).toBe("none");
    expect(debuggerReadModel.recoveryExecutionContract.currentTransition).toBe(
      "backfill_snapshot",
    );
    expect(debuggerReadModel.recoveryExecutionContract.canExecute).toBe(false);
    expect(debuggerReadModel.recoveryExecutionContract.requiresReview).toBe(false);
    expect(debuggerReadModel.recoveryExecutionContract.checkpointKey).toBeNull();
    expect(debuggerReadModel.takeoverAssistance.posture).toBe("blocked");
    expect(debuggerReadModel.interruptReason.code).toBe("run_failed");
    expect(debuggerReadModel.resumeAsk.mode).toBe("rerun_session");
    expect(debuggerReadModel.persistedLifecycleTrace.state).toBe("backfill_required");
    expect(debuggerReadModel.persistedLifecycleTrace.anchor).toBe("none");
    expect(debuggerReadModel.persistedLifecycleTrace.resumeState).toBe("not_available");
    expect(debuggerReadModel.persistedLifecycleTrace.replayRequestMode).toBe("none");
    expect(debuggerReadModel.persistedLifecycleTrace.humanInputCheckpointState).toBe(
      "not_available",
    );
    expect(debuggerReadModel.persistedLifecycleTrace.writeSideState).toBe("not_persisted");
    expect(debuggerReadModel.persistedLifecycleTrace.refreshReason).toBeNull();
    expect(debuggerReadModel.handoffPayload.state).toBe("not_available");
    expect(debuggerReadModel.humanInputCheckpoint.state).toBe("not_available");
    expect(debuggerReadModel.variableSnapshot.find((item) => item.key === "checkpoint_anchor")?.value).toBe(
      "none",
    );
  });

  it("derives a requestable human input checkpoint request when review needs an answer on the current anchor", () => {
    const runThread = buildRunThreadContract({
      id: "session_3",
      workspaceId: "workspace_1",
      sessionKey: "session::human-input",
      status: "ACTIVE",
      currentStage: "review_needed",
      sourcePage: "/meetings/meeting_3",
      boundaryNote: "Review-first runtime only.",
      replayableEventLog: "[]",
      resumedFromKey: null,
      createdAt: new Date("2026-04-11T10:00:00.000Z"),
      updatedAt: new Date("2026-04-11T10:05:00.000Z"),
      closedAt: null,
      checkpoints: [
        {
          id: "checkpoint_3",
          checkpointKey: "checkpoint::human-input",
          label: "review_hold",
          status: "READY",
          summary: "Checkpoint is ready for bounded human clarification.",
          createdAt: new Date("2026-04-11T10:02:00.000Z"),
          updatedAt: new Date("2026-04-11T10:02:00.000Z"),
        },
      ],
    });

    const debuggerReadModel = buildOperatorDebuggerReadModel({
      sessionLabel: "Human input session",
      runThread,
      replayableEventLog: "[]",
      replay: null,
      recovery: {
        state: "REVIEW_REQUIRED",
        failureTaxonomy: "PROTECTED_STATE_GAP",
        summary: "Review still needs one bounded operator answer.",
        operatorAction: "Capture the missing answer before bounded resume continues.",
        allowedActions: [],
        reviewReasons: ["One blocker still needs operator confirmation."],
        blockedReasons: [],
        rollbackAnchor: {
          checkpointId: "checkpoint_3",
          checkpointLabel: "review_hold",
          checkpointStatus: "READY",
        },
      },
      notebookState: {
        objective: "Close the blocker with one answer.",
        reviewState: "needs_review",
        confirmedFacts: ["Checklist remains internal."],
        blockers: ["Owner answer is still pending."],
        decisions: [],
        nextActions: ["Collect the missing owner answer."],
        openQuestions: ["Who signs off the blocker?"],
        boundaryNote: "Review-first runtime only.",
      },
      payloadState: {
        activeHandles: ["payload://meeting_note/3/summary"],
        prunedHandles: [],
        stateSource: "checkpoint_snapshot",
        stateSummary: "Checkpoint snapshot is active.",
      },
      verification: null,
      contextEditEvents: [],
      remediationTrace: [],
      handoffPackets: [],
      humanInputRequestEvent: {
        id: "human_input_request_1",
        checkpointId: "checkpoint_3",
        checkpointKey: "checkpoint::human-input",
        resumeToken: "checkpoint::human-input",
        prompt: "Capture human input against checkpoint::human-input before resuming: Who signs off the blocker?",
        summary: "Human input checkpoint request already recorded for checkpoint::human-input before bounded resume continues.",
        requestedBy: "founder@demo.com",
        sourcePage: "/meetings/meeting_3",
        createdAt: new Date("2026-04-11T10:03:00.000Z"),
      },
      humanInputAcknowledgementEvent: {
        id: "human_input_ack_1",
        requestEventId: "human_input_request_1",
        checkpointId: "checkpoint_3",
        checkpointKey: "checkpoint::human-input",
        resumeToken: "checkpoint::human-input",
        prompt: "Capture human input against checkpoint::human-input before resuming: Who signs off the blocker?",
        summary: "Human input checkpoint acknowledgement recorded for checkpoint::human-input.",
        acknowledgedBy: "founder@demo.com",
        sourcePage: "/meetings/meeting_3",
        createdAt: new Date("2026-04-11T10:03:30.000Z"),
      },
    });

    expect(debuggerReadModel.resumeAsk.mode).toBe("provide_human_input");
    expect(debuggerReadModel.humanInputCheckpoint.state).toBe("checkpoint_ready");
    expect(debuggerReadModel.humanInputRequest.state).toBe("acknowledged");
    expect(debuggerReadModel.humanInputRequest.checkpointKey).toBe("checkpoint::human-input");
    expect(debuggerReadModel.humanInputRequest.prompt).toContain("Who signs off the blocker?");
    expect(debuggerReadModel.humanInputRequest.acknowledgedBy).toBe("founder@demo.com");
    expect(debuggerReadModel.variableSnapshot.find((item) => item.key === "human_input_request")?.value).toContain(
      "acknowledged",
    );
  });

  it("surfaces swarm verification merge lane state in the debugger summary and snapshot", () => {
    const runThread = buildRunThreadContract({
      id: "session_swarm_merge_lane",
      workspaceId: "workspace_swarm",
      sessionKey: "session::swarm-merge-lane",
      status: "ACTIVE",
      currentStage: "review_confirmed",
      sourcePage: "/meetings/meeting_swarm",
      boundaryNote: "Review-first runtime only.",
      meetingId: "meeting_swarm",
      replayableEventLog: "[]",
      resumedFromKey: null,
      createdAt: new Date("2026-04-16T09:00:00.000Z"),
      updatedAt: new Date("2026-04-16T09:08:00.000Z"),
      closedAt: null,
      checkpoints: [
        {
          id: "checkpoint_swarm_merge_lane",
          checkpointKey: "checkpoint::swarm-merge-lane",
          label: "swarm_merge_lane_anchor",
          status: "READY",
          summary: "Checkpoint anchor for merge-lane verification.",
          createdAt: new Date("2026-04-16T09:01:00.000Z"),
          updatedAt: new Date("2026-04-16T09:01:00.000Z"),
        },
      ],
      swarmReadOnlyWorkersEnabled: true,
      swarmBudgetEnvelope: {
        budgetTokenLimit: 100,
        budgetTokenUsed: 52,
        usagePercent: 52,
        prunedTokenCount: 0,
        posture: "SAFE",
      },
      swarmSpawnRequestEvent: {
        id: "swarm_request_1",
        taskClass: "read_only_worker",
        checkpointId: "checkpoint_swarm_merge_lane",
        checkpointKey: "checkpoint::swarm-merge-lane",
        summary: "Read-only swarm worker spawn request recorded.",
        requestedBy: "founder@demo.com",
        sourcePage: "/meetings/meeting_swarm",
        createdAt: new Date("2026-04-16T09:02:00.000Z"),
      },
      swarmReadOnlyWorkerIntentEvent: {
        id: "swarm_intent_1",
        workerKind: "grep",
        packetKey: "swarm::grep::checkpoint::swarm-merge-lane",
        checkpointId: "checkpoint_swarm_merge_lane",
        checkpointKey: "checkpoint::swarm-merge-lane",
        artifactTypes: ["grep_hits.json", "worker_findings_bundle.json"],
        summary: "Read-only worker intent recorded for grep.",
        requestedBy: "founder@demo.com",
        sourcePage: "/meetings/meeting_swarm",
        createdAt: new Date("2026-04-16T09:03:00.000Z"),
      },
      swarmReadOnlyWorkerPlaceholderEvent: {
        id: "swarm_placeholder_1",
        workerKind: "grep",
        packetKey: "swarm::grep::checkpoint::swarm-merge-lane",
        checkpointId: "checkpoint_swarm_merge_lane",
        checkpointKey: "checkpoint::swarm-merge-lane",
        placeholderBundleKey: "artifact-bundle::swarm::grep::checkpoint::swarm-merge-lane",
        placeholderBundleTitle: "grep findings placeholder bundle",
        artifactTypes: [
          "grep_hits.json",
          "worker_findings_bundle.json",
          "worker_handoff_note.md",
        ],
        handoffConsumerAgent: "lead-orchestrator",
        handoffConsumptionGoal:
          "Run bounded grep-style evidence lookup anchored on checkpoint::swarm-merge-lane and return typed findings only.",
        summary: "Read-only worker placeholder recorded for grep.",
        requestedBy: "founder@demo.com",
        sourcePage: "/operating",
        createdAt: new Date("2026-04-16T09:04:00.000Z"),
      },
      swarmReadOnlyWorkerExecutionEvent: {
        id: "swarm_execution_1",
        workerKind: "grep",
        packetKey: "swarm::grep::checkpoint::swarm-merge-lane",
        checkpointId: "checkpoint_swarm_merge_lane",
        checkpointKey: "checkpoint::swarm-merge-lane",
        placeholderBundleKey: "artifact-bundle::swarm::grep::checkpoint::swarm-merge-lane",
        artifactTypes: [
          "grep_hits.json",
          "worker_findings_bundle.json",
          "worker_handoff_note.md",
        ],
        handoffConsumerAgent: "lead-orchestrator",
        handoffConsumptionGoal:
          "Run bounded grep-style evidence lookup anchored on checkpoint::swarm-merge-lane and return typed findings only.",
        summary: "Read-only worker execution slice recorded for grep.",
        requestedBy: "founder@demo.com",
        sourcePage: "/operating",
        createdAt: new Date("2026-04-16T09:05:00.000Z"),
      },
      swarmReadOnlyWorkerMaterializationEvent: {
        id: "swarm_materialization_1",
        workerKind: "grep",
        packetKey: "swarm::grep::checkpoint::swarm-merge-lane",
        checkpointId: "checkpoint_swarm_merge_lane",
        checkpointKey: "checkpoint::swarm-merge-lane",
        materializationBundleKey:
          "artifact-bundle::swarm::grep::checkpoint::swarm-merge-lane",
        materializationBundleTitle: "grep findings placeholder bundle",
        artifactTypes: [
          "grep_hits.json",
          "worker_findings_bundle.json",
          "worker_handoff_note.md",
        ],
        handoffConsumerAgent: "lead-orchestrator",
        handoffConsumptionGoal:
          "Run bounded grep-style evidence lookup anchored on checkpoint::swarm-merge-lane and return typed findings only.",
        summary: "Read-only worker materialization slice recorded for grep.",
        requestedBy: "founder@demo.com",
        sourcePage: "/operating",
        createdAt: new Date("2026-04-16T09:06:00.000Z"),
      },
      swarmReadOnlyWorkerAdoptionEvent: {
        id: "swarm_adoption_1",
        workerKind: "grep",
        packetKey: "swarm::grep::checkpoint::swarm-merge-lane",
        checkpointId: "checkpoint_swarm_merge_lane",
        checkpointKey: "checkpoint::swarm-merge-lane",
        outputBundleKey: "artifact-bundle::swarm::grep::checkpoint::swarm-merge-lane",
        outputBundleTitle: "grep findings placeholder bundle",
        outputArtifactTypes: [
          "grep_hits.json",
          "worker_findings_bundle.json",
          "worker_handoff_note.md",
        ],
        handoffConsumerAgent: "lead-orchestrator",
        handoffConsumptionGoal:
          "Run bounded grep-style evidence lookup anchored on checkpoint::swarm-merge-lane and return typed findings only.",
        summary: "Read-only worker output adoption seam recorded for grep.",
        requestedBy: "founder@demo.com",
        sourcePage: "/operating",
        createdAt: new Date("2026-04-16T09:07:00.000Z"),
      },
      verification: {
        status: "passed",
        blockedReasons: [],
        summary: "Verification passed with no open blocker.",
      },
      swarmVerificationMergeLaneEvent: {
        id: "swarm_merge_lane_1",
        mergeLaneTruth: "mergeable",
        checkpointId: "checkpoint_swarm_merge_lane",
        checkpointKey: "checkpoint::swarm-merge-lane",
        summary: "Swarm verification merge lane recorded for grep.",
        nextAction: "Hand the mergeable adoption slice to the reviewer-visible merge guard.",
        verifierSummary: "Verification passed with no open blocker.",
        disagreementSummary: null,
        arbiterReference: "review-first merge guard",
        requestedBy: "founder@demo.com",
        sourcePage: "/operating",
        createdAt: new Date("2026-04-16T09:08:00.000Z"),
      },
    });

    const debuggerReadModel = buildOperatorDebuggerReadModel({
      sessionLabel: "Swarm merge lane session",
      runThread,
      replayableEventLog: "[]",
      replay: {
        fidelityStatus: "STRONG",
        fidelityScore: 91,
        replaySummary: "Replay is aligned with the merge-lane checkpoint.",
        checkpointId: "checkpoint_swarm_merge_lane",
        checkpointLabel: "swarm_merge_lane_anchor",
        updatedAt: new Date("2026-04-16T09:08:00.000Z"),
      },
      recovery: {
        state: "STABLE",
        failureTaxonomy: "NONE",
        summary: "No recovery action is required.",
        operatorAction: "No recovery action is required.",
        allowedActions: [],
        reviewReasons: [],
        blockedReasons: [],
        rollbackAnchor: null,
      },
      notebookState: {
        objective: "Keep swarm verification merge lanes review-first.",
        reviewState: "confirmed",
        confirmedFacts: ["Adoption seam is explicit."],
        blockers: [],
        decisions: ["Merge lane must stay auditable."],
        nextActions: ["Keep the record seam reviewer-visible."],
        openQuestions: [],
        boundaryNote: "Review-first runtime only.",
      },
      payloadState: {
        activeHandles: [],
        prunedHandles: [],
        stateSource: "checkpoint_snapshot",
        stateSummary: "Checkpoint snapshot is active.",
      },
      verification: {
        status: "PASSED",
        blockedReasons: [],
      },
      contextEditEvents: [],
      remediationTrace: [],
      handoffPackets: [],
    });

    expect(debuggerReadModel.swarmVerificationMergeLaneContract.state).toBe("recorded");
    expect(debuggerReadModel.swarmVerificationMergeLaneContract.mergeLaneTruth).toBe(
      "mergeable",
    );
    expect(debuggerReadModel.swarmVerificationMergeLaneContract.recordEventId).toBe(
      "swarm_merge_lane_1",
    );
    expect(
      debuggerReadModel.variableSnapshot.find(
        (item) => item.key === "debugger_swarm_verification_merge_lane_contract",
      )?.value,
    ).toContain("recorded");
    expect(debuggerReadModel.summary).toContain("swarm merge lane recorded/recorded/mergeable");
  });
});
