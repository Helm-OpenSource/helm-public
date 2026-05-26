import { describe, expect, it } from "vitest";
import { buildRunThreadContract } from "@/lib/helm-v2/run-thread-contract";

describe("run thread contract", () => {
  it("freezes canonical ids and resume token from the latest ready checkpoint", () => {
    const contract = buildRunThreadContract({
      id: "session_1",
      workspaceId: "workspace_1",
      sessionKey: "workspace_1:runtime-session:event_1",
      status: "ACTIVE",
      currentStage: "verification_review",
      sourcePage: "/meetings/meeting_1",
      boundaryNote: "Review-first runtime only.",
      meetingId: "meeting_1",
      opportunityId: "opp_1",
      companyId: "company_1",
      replayableEventLog: JSON.stringify([
        { stage: "meeting_ingest", at: "2026-04-11T08:00:00.000Z" },
        { stage: "verification_review", at: "2026-04-11T08:15:00.000Z" },
      ]),
      resumedFromKey: null,
      createdAt: new Date("2026-04-11T08:00:00.000Z"),
      updatedAt: new Date("2026-04-11T08:15:00.000Z"),
      closedAt: null,
      checkpoints: [
        {
          id: "checkpoint_1",
          checkpointKey: "workspace_1:checkpoint:1",
          label: "post_verification",
          status: "READY",
          summary: "Verification completed and ready to resume.",
          createdAt: new Date("2026-04-11T08:10:00.000Z"),
          updatedAt: new Date("2026-04-11T08:12:00.000Z"),
        },
      ],
      handoffPackets: [
        {
          id: "handoff_1",
          packetKey: "handoff::session_1::verification",
          fromAgent: "meeting-analyst",
          toAgent: "verification-agent",
          goal: "Prepare the verification report.",
          approvalTier: "A1",
          checkpointRef: "workspace_1:checkpoint:1",
          createdAt: new Date("2026-04-11T08:13:00.000Z"),
        },
      ],
      remediationTrace: [
        {
          id: "remediation_1",
          action: "SAVE_RECOVERY_CHECKPOINT",
          executionStatus: "REVIEW_REQUIRED",
          summary: "Checkpoint save still needs review.",
          rollbackAnchorSummary: "post_verification · READY",
          triggeredBy: "verification-agent",
          createdAt: new Date("2026-04-11T08:14:00.000Z"),
        },
      ],
      requestLifecycleEntries: [
        {
          id: "takeover_request_1",
          kind: "takeover_requested",
          label: "takeover requested · RESUME_CHECKPOINT",
          summary: "Operator takeover request recorded for RESUME_CHECKPOINT on workspace_1:checkpoint:1.",
          checkpointKey: "workspace_1:checkpoint:1",
          timestamp: new Date("2026-04-11T08:14:15.000Z"),
        },
        {
          id: "takeover_ack_1",
          kind: "takeover_request_acknowledged",
          label: "takeover acknowledged · RESUME_CHECKPOINT",
          summary: "Operator takeover acknowledgement recorded for RESUME_CHECKPOINT on workspace_1:checkpoint:1.",
          checkpointKey: "workspace_1:checkpoint:1",
          timestamp: new Date("2026-04-11T08:14:30.000Z"),
        },
        {
          id: "takeover_start_1",
          kind: "takeover_active",
          label: "takeover active · RESUME_CHECKPOINT",
          summary: "Operator takeover started for RESUME_CHECKPOINT on workspace_1:checkpoint:1.",
          actorName: "founder@demo.com",
          checkpointKey: "workspace_1:checkpoint:1",
          timestamp: new Date("2026-04-11T08:14:35.000Z"),
        },
        {
          id: "human_input_request_1",
          kind: "human_input_requested",
          label: "human input requested",
          summary: "Human input checkpoint request recorded for workspace_1:checkpoint:1.",
          checkpointKey: "workspace_1:checkpoint:1",
          timestamp: new Date("2026-04-11T08:14:40.000Z"),
        },
        {
          id: "human_input_ack_1",
          kind: "human_input_request_acknowledged",
          label: "human input acknowledged",
          summary: "Human input checkpoint acknowledgement recorded for workspace_1:checkpoint:1.",
          checkpointKey: "workspace_1:checkpoint:1",
          timestamp: new Date("2026-04-11T08:14:45.000Z"),
        },
      ],
      resultAcknowledgements: [
        {
          id: "ack_0",
          source: "human_execution",
          state: "pending",
          summary: "Human execution proof is still pending acknowledgement.",
          timestamp: new Date("2026-04-11T08:15:00.000Z"),
        },
        {
          id: "ack_1",
          source: "official_write",
          state: "acknowledged",
          summary: "Guarded official write crm.attach_note for opportunity:opp_1 is acknowledged.",
          timestamp: new Date("2026-04-11T08:15:30.000Z"),
        },
        {
          id: "ack_2",
          source: "official_followthrough",
          state: "follow_through_open",
          summary: "Official follow-through is open and still needs a final confirmation note.",
          timestamp: new Date("2026-04-11T08:15:45.000Z"),
        },
      ],
    });

    expect(contract.runId).toBe("session_1");
    expect(contract.threadId).toBe("workspace_1:runtime-session:event_1");
    expect(contract.lifecycle).toBe("checkpoint_ready");
    expect(contract.stageKey).toBe("verification_review");
    expect(contract.latestCheckpoint?.checkpointId).toBe("checkpoint_1");
    expect(contract.latestCheckpoint?.resumeToken).toBe("workspace_1:checkpoint:1");
    expect(contract.resume.state).toBe("ready");
    expect(contract.resume.resumeToken).toBe("workspace_1:checkpoint:1");
    expect(contract.replay.eventLogEntries).toBe(2);
    expect(contract.replay.lastEventAt).toBe("2026-04-11T08:15:00.000Z");
    expect(contract.requestPosture.takeoverState).toBe("acknowledged");
    expect(contract.requestPosture.humanInputState).toBe("acknowledged");
    expect(contract.requestPosture.activeRequestCount).toBe(0);
    expect(contract.requestPosture.acknowledgedRequestCount).toBe(2);
    expect(contract.requestPosture.latestLifecycleKind).toBe("human_input_request_acknowledged");
    expect(contract.resultAcknowledgement.state).toBe("follow_through_open");
    expect(contract.resultAcknowledgement.source).toBe("official_followthrough");
    expect(contract.resultFlow.trackedSourceCount).toBe(3);
    expect(contract.resultFlow.requiresOperatorAttentionCount).toBe(2);
    expect(contract.resultFlow.resolvedCount).toBe(1);
    expect(contract.resultFlow.latestSource).toBe("official_followthrough");
    expect(contract.resultFlow.latestState).toBe("follow_through_open");
    expect(contract.resultFlow.counts.pending).toBe(1);
    expect(contract.resultFlow.counts.acknowledged).toBe(1);
    expect(contract.resultFlow.counts.followThroughOpen).toBe(1);
    expect(contract.resultFlow.sourceEntries[0]?.source).toBe("official_followthrough");
    expect(contract.resultFlow.sourceEntries[1]?.source).toBe("official_write");
    expect(contract.resultFlow.sourceEntries[2]?.source).toBe("human_execution");
    expect(contract.closeoutFlow.state).toBe("open");
    expect(contract.closeoutFlow.latestSource).toBe("official_followthrough");
    expect(contract.closeoutFlow.openCount).toBe(1);
    expect(contract.closeoutFlow.resolvedCount).toBe(0);
    expect(contract.closeoutFlow.sourceEntries[0]?.source).toBe("official_followthrough");
    expect(contract.settlementReview.state).toBe("not_available");
    expect(contract.settlementFlow.state).toBe("closeout_open");
    expect(contract.settlementFlow.driver).toBe("closeout_flow");
    expect(contract.settlementFlow.forwardAttentionCount).toBe(3);
    expect(contract.settlementFlow.openCloseoutCount).toBe(1);
    expect(contract.settlementFlow.resolvedCloseoutCount).toBe(0);
    expect(contract.settlementFlow.nextAction).toContain("final confirmation note");
    expect(contract.forwardFlow.state).toBe("active_control");
    expect(contract.forwardFlow.currentOwner).toBe("founder@demo.com");
    expect(contract.forwardFlow.attentionCount).toBe(3);
    expect(contract.forwardFlow.attentionSources).toEqual([
      "active_control",
      "official_followthrough",
      "human_execution",
    ]);
    expect(contract.forwardFlow.nextAction).toContain("Keep bounded operator control");
    expect(contract.checkpointLineage[0]?.lineageRole).toBe("latest");
    expect(contract.replayRequest.mode).toBe("latest_checkpoint");
    expect(contract.replayRequest.checkpointKey).toBe("workspace_1:checkpoint:1");
    expect(contract.humanInputCheckpoint.state).toBe("checkpoint_ready");
    expect(contract.humanInputCheckpoint.checkpointKey).toBe("workspace_1:checkpoint:1");
    expect(contract.lifecycleLog[0]?.kind).toBe("result_acknowledged");
    expect(contract.lifecycleLog.some((item) => item.kind === "takeover_requested")).toBe(true);
    expect(contract.lifecycleLog.some((item) => item.kind === "takeover_request_acknowledged")).toBe(true);
    expect(contract.lifecycleLog.some((item) => item.kind === "takeover_active")).toBe(true);
    expect(contract.lifecycleLog.some((item) => item.kind === "human_input_requested")).toBe(true);
    expect(contract.lifecycleLog.some((item) => item.kind === "human_input_request_acknowledged")).toBe(true);
    expect(contract.lifecycleLog.some((item) => item.kind === "continuity_remediation")).toBe(true);
    expect(contract.lifecycleLog.some((item) => item.kind === "handoff_created")).toBe(true);
    expect(contract.lifecycleLog.some((item) => item.kind === "checkpoint_written")).toBe(true);
    expect(contract.closeControlFlow.state).toBe("closeout_open");
    expect(contract.closeControlFlow.driver).toBe("settlement_flow");
    expect(contract.closeControlFlow.forwardState).toBe("active_control");
    expect(contract.closeControlFlow.settlementState).toBe("closeout_open");
    expect(contract.closeControlFlow.forwardAttentionCount).toBe(3);
    expect(contract.closeControlFlow.openCloseoutCount).toBe(1);
    expect(contract.closeDecisionFlow.state).toBe("active");
    expect(contract.closeDecisionFlow.driver).toBe("close_control_flow");
    expect(contract.closeDecisionFlow.controlState).toBe("closeout_open");
    expect(contract.closeDecisionFlow.outcomeState).toBe("not_available");
    expect(contract.closeDecisionFlow.closeRequestState).toBe("not_available");
    expect(contract.closeDecisionControlSummary.state).toBe("closeout_open");
    expect(contract.closeDecisionControlSummary.driver).toBe("close_control_flow");
    expect(contract.closeDecisionControlSummary.decisionState).toBe("active");
    expect(contract.closeDecisionControlSummary.controlState).toBe("closeout_open");
    expect(contract.closeResolutionSummary.state).toBe("not_ready");
    expect(contract.closeResolutionSummary.driver).toBe("close_decision_control_summary");
    expect(contract.closeResolutionForwardSummary.state).toBe("closeout_open");
    expect(contract.closeResolutionForwardSummary.driver).toBe("settlement_flow");
    expect(contract.closeResolutionControlSummary.state).toBe("not_ready");
    expect(contract.closeResolutionControlSummary.driver).toBe("close_resolution_forward_summary");
    expect(contract.closePostureSummary.state).toBe("open");
    expect(contract.closePostureSummary.driver).toBe("close_resolution_forward_summary");
    expect(contract.closePostureForwardSummary.state).toBe("closeout_open");
    expect(contract.closePostureForwardSummary.driver).toBe("settlement_flow");
    expect(contract.persistedControlPlaneLifecycle.state).toBe("missing");
    expect(contract.persistedControlPlaneLifecycle.guardPolicy.state).toBe("backfill_required");
    expect(contract.persistedControlPlaneLifecycle.compactionPolicy.state).toBe("backfill_required");
    expect(contract.persistedControlPlaneLifecycle.reconciliationPolicy.state).toBe("backfill_required");
    expect(contract.persistedControlPlaneLifecycle.repairPolicy.state).toBe("backfill_on_next_refresh");
    expect(contract.persistedControlPlaneLifecycle.writeSide.state).toBe("not_persisted");
  });

  it("derives swarm spawn admission from the workspace flag and budget envelope", () => {
    const baseInput: Parameters<typeof buildRunThreadContract>[0] = {
      id: "session_swarm_1",
      workspaceId: "workspace_swarm",
      sessionKey: "session::swarm-1",
      status: "ACTIVE",
      currentStage: "review_confirmed",
      sourcePage: "/operating",
      boundaryNote: "Review-first runtime only.",
      replayableEventLog: "[]",
      resumedFromKey: null,
      createdAt: new Date("2026-04-16T08:00:00.000Z"),
      updatedAt: new Date("2026-04-16T08:05:00.000Z"),
      closedAt: null,
      checkpoints: [],
    };

    const flagBlocked = buildRunThreadContract({
      ...baseInput,
      swarmReadOnlyWorkersEnabled: false,
      swarmBudgetEnvelope: {
        budgetTokenLimit: 100,
        budgetTokenUsed: 45,
        usagePercent: 45,
        prunedTokenCount: 0,
        posture: "SAFE",
      },
    });
    expect(flagBlocked.swarmSpawnBudgetEnvelope.state).toBe("within_headroom");
    expect(flagBlocked.swarmSpawnRequest.state).toBe("blocked_flag");
    expect(flagBlocked.swarmSpawnRequest.denyReason).toBe("workspace_flag_disabled");
    expect(flagBlocked.swarmSpawnContract.state).toBe("blocked_flag");
    expect(flagBlocked.swarmSpawnContract.denyReason).toBe("workspace_flag_disabled");
    expect(flagBlocked.swarmReadOnlyWorkerContract.state).toBe("blocked");
    expect(flagBlocked.swarmReadOnlyWorkerContract.requestLifecycleState).toBe("blocked");
    expect(flagBlocked.swarmReadOnlyWorkerContract.handoffPreviewState).toBe("not_ready");
    expect(flagBlocked.swarmReadOnlyWorkerContract.executionGuardContract.state).toBe("blocked");
    expect(flagBlocked.swarmReadOnlyWorkerContract.executionLifecycleContract.state).toBe(
      "blocked",
    );
    expect(flagBlocked.swarmReadOnlyWorkerContract.executionLifecycleContract.driver).toBe(
      "admission_blocked",
    );
    expect(
      flagBlocked.swarmReadOnlyWorkerContract.executionGuardContract.missingRequirements,
    ).toContain("swarm spawn admission is not requestable");
    expect(flagBlocked.swarmReadOnlyWorkerContract.allowlistedWorkers).toEqual([
      "search",
      "grep",
      "evidence_mining",
    ]);

    const budgetBlocked = buildRunThreadContract({
      ...baseInput,
      swarmReadOnlyWorkersEnabled: true,
      swarmBudgetEnvelope: {
        budgetTokenLimit: 100,
        budgetTokenUsed: 84,
        usagePercent: 84,
        prunedTokenCount: 28,
        posture: "PRUNE",
      },
    });
    expect(budgetBlocked.swarmSpawnBudgetEnvelope.state).toBe("blocked_budget");
    expect(budgetBlocked.swarmSpawnRequest.state).toBe("blocked_budget");
    expect(budgetBlocked.swarmSpawnRequest.denyReason).toBe("budget_posture_prune");
    expect(budgetBlocked.swarmSpawnContract.budgetPosture).toBe("PRUNE");
    expect(budgetBlocked.swarmSpawnContract.denyReason).toBe("budget_posture_prune");
    expect(budgetBlocked.swarmReadOnlyWorkerContract.state).toBe("blocked");

    const requestable = buildRunThreadContract({
      ...baseInput,
      swarmReadOnlyWorkersEnabled: true,
      swarmBudgetEnvelope: {
        budgetTokenLimit: 100,
        budgetTokenUsed: 62,
        usagePercent: 62,
        prunedTokenCount: 0,
        posture: "WATCH",
      },
    });
    expect(requestable.swarmSpawnBudgetEnvelope.state).toBe("within_headroom");
    expect(requestable.swarmSpawnRequest.state).toBe("requestable");
    expect(requestable.swarmSpawnRequest.denyReason).toBeNull();
    expect(requestable.swarmSpawnContract.state).toBe("requestable");
    expect(requestable.swarmSpawnContract.workspaceFlagState).toBe("enabled");
    expect(requestable.swarmSpawnContract.denyReason).toBeNull();
    expect(requestable.swarmReadOnlyWorkerContract.state).toBe("ready");
    expect(requestable.swarmReadOnlyWorkerContract.requestLifecycleState).toBe("requestable");
    expect(requestable.swarmReadOnlyWorkerContract.handoffPreviewState).toBe("preview_ready");
    expect(requestable.swarmReadOnlyWorkerContract.executionLifecycleContract.state).toBe(
      "request_required",
    );
    expect(requestable.swarmReadOnlyWorkerContract.artifactPolicy).toBe("artifact_first");
    expect(requestable.swarmReadOnlyWorkerContract.transcriptPolicy).toBe("no_transcript_merge");
    expect(requestable.swarmReadOnlyWorkerContract.lanePreviews).toHaveLength(3);
    expect(requestable.swarmReadOnlyWorkerContract.previewPacketKeys).toHaveLength(3);
    expect(requestable.swarmReadOnlyWorkerContract.lanePreviews[0]?.handoffPacket.toAgent).toBe(
      "swarm-search-worker",
    );

    const requested = buildRunThreadContract({
      ...baseInput,
      swarmReadOnlyWorkersEnabled: true,
      swarmBudgetEnvelope: {
        budgetTokenLimit: 100,
        budgetTokenUsed: 52,
        usagePercent: 52,
        prunedTokenCount: 0,
        posture: "SAFE",
      },
      checkpoints: [
        {
          id: "checkpoint_swarm_1",
          checkpointKey: "checkpoint::swarm",
          label: "swarm_anchor",
          status: "READY",
          summary: "Swarm request can anchor on the latest checkpoint.",
          createdAt: new Date("2026-04-16T08:01:00.000Z"),
          updatedAt: new Date("2026-04-16T08:01:00.000Z"),
        },
      ],
      swarmSpawnRequestEvent: {
        id: "swarm_request_1",
        taskClass: "read_only_worker",
        checkpointId: "checkpoint_swarm_1",
        checkpointKey: "checkpoint::swarm",
        summary: "Read-only swarm worker spawn request recorded for checkpoint::swarm.",
        requestedBy: "founder@demo.com",
        sourcePage: "/meetings/meeting_swarm",
        createdAt: new Date("2026-04-16T08:02:00.000Z"),
      },
    });
    expect(requested.swarmSpawnRequest.state).toBe("requestable");
    expect(requested.swarmSpawnRequest.requestRecordState).toBe("requested");
    expect(requested.swarmSpawnRequest.requestEventId).toBe("swarm_request_1");
    expect(requested.swarmSpawnRequest.checkpointKey).toBe("checkpoint::swarm");
    expect(requested.swarmSpawnRequest.requestedBy).toBe("founder@demo.com");
    expect(requested.swarmSpawnContract.state).toBe("requestable");
    expect(requested.swarmSpawnContract.requestRecordState).toBe("requested");
    expect(requested.swarmSpawnContract.requestEventId).toBe("swarm_request_1");
    expect(requested.swarmSpawnContract.summary).toContain("request already recorded");
    expect(requested.swarmReadOnlyWorkerContract.state).toBe("requested");
    expect(requested.swarmReadOnlyWorkerContract.requestLifecycleState).toBe("request_recorded");
    expect(requested.swarmReadOnlyWorkerContract.handoffPreviewState).toBe("request_recorded");
    expect(requested.swarmReadOnlyWorkerContract.packetConsumptionIntentState).toBe(
      "selection_required",
    );
    expect(requested.swarmReadOnlyWorkerContract.requestEventId).toBe("swarm_request_1");
    expect(requested.swarmReadOnlyWorkerContract.requestedBy).toBe("founder@demo.com");
    expect(requested.swarmReadOnlyWorkerContract.sourcePage).toBe("/meetings/meeting_swarm");
    expect(requested.swarmReadOnlyWorkerContract.summary).toContain("Later fan-out");
    expect(requested.swarmReadOnlyWorkerContract.packetConsumptionIntentSummary).toContain(
      "not recorded yet",
    );
    expect(requested.swarmReadOnlyWorkerContract.artifactBundlePlaceholderState).toBe(
      "selection_required",
    );
    expect(requested.swarmReadOnlyWorkerContract.handoffConsumptionState).toBe(
      "selection_required",
    );
    expect(requested.swarmReadOnlyWorkerContract.artifactBundlePlaceholderRecordState).toBe(
      "not_ready",
    );
    expect(requested.swarmReadOnlyWorkerContract.handoffConsumptionRecordState).toBe(
      "not_ready",
    );
    expect(requested.swarmReadOnlyWorkerContract.executionPreflightState).toBe(
      "selection_required",
    );
    expect(requested.swarmReadOnlyWorkerContract.executionGuardContract.state).toBe("blocked");
    expect(requested.swarmReadOnlyWorkerContract.executionGuardContract.missingRequirements).toEqual(
      ["allowlisted lane selection is missing"],
    );
    expect(requested.swarmReadOnlyWorkerContract.executionLifecycleContract.state).toBe(
      "selection_required",
    );

    const selectedLane = buildRunThreadContract({
      ...baseInput,
      swarmReadOnlyWorkersEnabled: true,
      swarmBudgetEnvelope: {
        budgetTokenLimit: 100,
        budgetTokenUsed: 52,
        usagePercent: 52,
        prunedTokenCount: 0,
        posture: "SAFE",
      },
      checkpoints: [
        {
          id: "checkpoint_swarm_1",
          checkpointKey: "checkpoint::swarm",
          label: "swarm_anchor",
          status: "READY",
          summary: "Swarm request can anchor on the latest checkpoint.",
          createdAt: new Date("2026-04-16T08:01:00.000Z"),
          updatedAt: new Date("2026-04-16T08:01:00.000Z"),
        },
      ],
      swarmSpawnRequestEvent: {
        id: "swarm_request_1",
        taskClass: "read_only_worker",
        checkpointId: "checkpoint_swarm_1",
        checkpointKey: "checkpoint::swarm",
        summary: "Read-only swarm worker spawn request recorded for checkpoint::swarm.",
        requestedBy: "founder@demo.com",
        sourcePage: "/meetings/meeting_swarm",
        createdAt: new Date("2026-04-16T08:02:00.000Z"),
      },
      swarmReadOnlyWorkerIntentEvent: {
        id: "swarm_intent_1",
        workerKind: "grep",
        packetKey: "swarm::grep::checkpoint::swarm",
        checkpointId: "checkpoint_swarm_1",
        checkpointKey: "checkpoint::swarm",
        artifactTypes: ["grep_hits.json", "worker_findings_bundle.json"],
        summary: "Read-only worker intent recorded for grep.",
        requestedBy: "founder@demo.com",
        sourcePage: "/meetings/meeting_swarm",
        createdAt: new Date("2026-04-16T08:03:00.000Z"),
      },
    });
    expect(selectedLane.swarmReadOnlyWorkerContract.packetConsumptionIntentState).toBe(
      "intent_recorded",
    );
    expect(selectedLane.swarmReadOnlyWorkerContract.intentEventId).toBe("swarm_intent_1");
    expect(selectedLane.swarmReadOnlyWorkerContract.selectedWorkerKind).toBe("grep");
    expect(selectedLane.swarmReadOnlyWorkerContract.selectedPacketKey).toBe(
      "swarm::grep::checkpoint::swarm",
    );
    expect(selectedLane.swarmReadOnlyWorkerContract.selectedArtifactTypes).toEqual([
      "grep_hits.json",
      "worker_findings_bundle.json",
    ]);
    expect(selectedLane.swarmReadOnlyWorkerContract.artifactBundlePlaceholderState).toBe(
      "placeholder_ready",
    );
    expect(selectedLane.swarmReadOnlyWorkerContract.placeholderBundleKey).toBe(
      "artifact-bundle::swarm::grep::checkpoint::swarm",
    );
    expect(selectedLane.swarmReadOnlyWorkerContract.placeholderArtifactTypes).toEqual([
      "grep_hits.json",
      "worker_findings_bundle.json",
      "worker_handoff_note.md",
    ]);
    expect(selectedLane.swarmReadOnlyWorkerContract.handoffConsumptionState).toBe("consumable");
    expect(selectedLane.swarmReadOnlyWorkerContract.handoffConsumerAgent).toBe(
      "lead-orchestrator",
    );
    expect(selectedLane.swarmReadOnlyWorkerContract.artifactBundlePlaceholderRecordState).toBe(
      "recordable",
    );
    expect(selectedLane.swarmReadOnlyWorkerContract.handoffConsumptionRecordState).toBe(
      "recordable",
    );
    expect(selectedLane.swarmReadOnlyWorkerContract.executionPreflightState).toBe(
      "placeholder_record_required",
    );
    expect(selectedLane.swarmReadOnlyWorkerContract.executionGuardContract.state).toBe("blocked");
    expect(
      selectedLane.swarmReadOnlyWorkerContract.executionGuardContract.missingRequirements,
    ).toEqual(["placeholder bundle record is missing"]);
    expect(selectedLane.swarmReadOnlyWorkerContract.executionLifecycleContract.state).toBe(
      "placeholder_record_required",
    );

    const recordedPlaceholder = buildRunThreadContract({
      ...baseInput,
      swarmReadOnlyWorkersEnabled: true,
      swarmBudgetEnvelope: {
        budgetTokenLimit: 100,
        budgetTokenUsed: 52,
        usagePercent: 52,
        prunedTokenCount: 0,
        posture: "SAFE",
      },
      checkpoints: [
        {
          id: "checkpoint_swarm_1",
          checkpointKey: "checkpoint::swarm",
          label: "swarm_anchor",
          status: "READY",
          summary: "Swarm request can anchor on the latest checkpoint.",
          createdAt: new Date("2026-04-16T08:01:00.000Z"),
          updatedAt: new Date("2026-04-16T08:01:00.000Z"),
        },
      ],
      swarmSpawnRequestEvent: {
        id: "swarm_request_1",
        taskClass: "read_only_worker",
        checkpointId: "checkpoint_swarm_1",
        checkpointKey: "checkpoint::swarm",
        summary: "Read-only swarm worker spawn request recorded for checkpoint::swarm.",
        requestedBy: "founder@demo.com",
        sourcePage: "/meetings/meeting_swarm",
        createdAt: new Date("2026-04-16T08:02:00.000Z"),
      },
      swarmReadOnlyWorkerIntentEvent: {
        id: "swarm_intent_1",
        workerKind: "grep",
        packetKey: "swarm::grep::checkpoint::swarm",
        checkpointId: "checkpoint_swarm_1",
        checkpointKey: "checkpoint::swarm",
        artifactTypes: ["grep_hits.json", "worker_findings_bundle.json"],
        summary: "Read-only worker intent recorded for grep.",
        requestedBy: "founder@demo.com",
        sourcePage: "/meetings/meeting_swarm",
        createdAt: new Date("2026-04-16T08:03:00.000Z"),
      },
      swarmReadOnlyWorkerPlaceholderEvent: {
        id: "swarm_placeholder_1",
        workerKind: "grep",
        packetKey: "swarm::grep::checkpoint::swarm",
        checkpointId: "checkpoint_swarm_1",
        checkpointKey: "checkpoint::swarm",
        placeholderBundleKey: "artifact-bundle::swarm::grep::checkpoint::swarm",
        placeholderBundleTitle: "grep findings placeholder bundle",
        artifactTypes: [
          "grep_hits.json",
          "worker_findings_bundle.json",
          "worker_handoff_note.md",
        ],
        handoffConsumerAgent: "lead-orchestrator",
        handoffConsumptionGoal:
          "Run bounded grep-style evidence lookup anchored on checkpoint::swarm and return typed findings only.",
        summary: "Read-only worker placeholder recorded for grep.",
        requestedBy: "founder@demo.com",
        sourcePage: "/operating",
        createdAt: new Date("2026-04-16T08:04:00.000Z"),
      },
    });
    expect(
      recordedPlaceholder.swarmReadOnlyWorkerContract.artifactBundlePlaceholderRecordState,
    ).toBe("recorded");
    expect(recordedPlaceholder.swarmReadOnlyWorkerContract.handoffConsumptionRecordState).toBe(
      "recorded",
    );
    expect(recordedPlaceholder.swarmReadOnlyWorkerContract.executionPreflightState).toBe("ready");
    expect(recordedPlaceholder.swarmReadOnlyWorkerContract.placeholderRecordEventId).toBe(
      "swarm_placeholder_1",
    );
    expect(recordedPlaceholder.swarmReadOnlyWorkerContract.placeholderRecordedBy).toBe(
      "founder@demo.com",
    );
    expect(recordedPlaceholder.swarmReadOnlyWorkerContract.placeholderRecordSourcePage).toBe(
      "/operating",
    );
    expect(recordedPlaceholder.swarmReadOnlyWorkerContract.executionRecordState).toBe(
      "recordable",
    );
    expect(recordedPlaceholder.swarmReadOnlyWorkerContract.executionGuardContract.state).toBe(
      "allowed",
    );
    expect(recordedPlaceholder.swarmReadOnlyWorkerContract.executionLifecycleContract.state).toBe(
      "recordable",
    );
    expect(recordedPlaceholder.swarmReadOnlyWorkerContract.executionLifecycleContract.driver).toBe(
      "recordable",
    );
    expect(recordedPlaceholder.swarmReadOnlyWorkerContract.executionCandidateContract.state).toBe(
      "not_ready",
    );
    expect(recordedPlaceholder.swarmReadOnlyWorkerContract.executionCandidateContract.driver).toBe(
      "execution_not_recorded",
    );
    expect(
      recordedPlaceholder.swarmReadOnlyWorkerContract.executionCandidateContract
        .artifactMaterializationState,
    ).toBe("not_ready");
    expect(
      recordedPlaceholder.swarmReadOnlyWorkerContract.artifactMaterializationGuardContract.state,
    ).toBe("blocked");
    expect(
      recordedPlaceholder.swarmReadOnlyWorkerContract.artifactMaterializationGuardContract
        .missingRequirements,
    ).toEqual(["execution candidate is not ready"]);
    expect(
      recordedPlaceholder.swarmReadOnlyWorkerContract.executionGuardContract.missingRequirements,
    ).toEqual([]);
    expect(
      recordedPlaceholder.swarmReadOnlyWorkerContract.executionGuardContract.placeholderBundleKey,
    ).toBe("artifact-bundle::swarm::grep::checkpoint::swarm");

    const recordedExecution = buildRunThreadContract({
      ...baseInput,
      swarmReadOnlyWorkersEnabled: true,
      swarmBudgetEnvelope: {
        budgetTokenLimit: 100,
        budgetTokenUsed: 52,
        usagePercent: 52,
        prunedTokenCount: 0,
        posture: "SAFE",
      },
      checkpoints: [
        {
          id: "checkpoint_swarm_1",
          checkpointKey: "checkpoint::swarm",
          label: "swarm_anchor",
          status: "READY",
          summary: "Swarm request can anchor on the latest checkpoint.",
          createdAt: new Date("2026-04-16T08:01:00.000Z"),
          updatedAt: new Date("2026-04-16T08:01:00.000Z"),
        },
      ],
      swarmSpawnRequestEvent: {
        id: "swarm_request_1",
        taskClass: "read_only_worker",
        checkpointId: "checkpoint_swarm_1",
        checkpointKey: "checkpoint::swarm",
        summary: "Read-only swarm worker spawn request recorded for checkpoint::swarm.",
        requestedBy: "founder@demo.com",
        sourcePage: "/meetings/meeting_swarm",
        createdAt: new Date("2026-04-16T08:02:00.000Z"),
      },
      swarmReadOnlyWorkerIntentEvent: {
        id: "swarm_intent_1",
        workerKind: "grep",
        packetKey: "swarm::grep::checkpoint::swarm",
        checkpointId: "checkpoint_swarm_1",
        checkpointKey: "checkpoint::swarm",
        artifactTypes: ["grep_hits.json", "worker_findings_bundle.json"],
        summary: "Read-only worker intent recorded for grep.",
        requestedBy: "founder@demo.com",
        sourcePage: "/meetings/meeting_swarm",
        createdAt: new Date("2026-04-16T08:03:00.000Z"),
      },
      swarmReadOnlyWorkerPlaceholderEvent: {
        id: "swarm_placeholder_1",
        workerKind: "grep",
        packetKey: "swarm::grep::checkpoint::swarm",
        checkpointId: "checkpoint_swarm_1",
        checkpointKey: "checkpoint::swarm",
        placeholderBundleKey: "artifact-bundle::swarm::grep::checkpoint::swarm",
        placeholderBundleTitle: "grep findings placeholder bundle",
        artifactTypes: [
          "grep_hits.json",
          "worker_findings_bundle.json",
          "worker_handoff_note.md",
        ],
        handoffConsumerAgent: "lead-orchestrator",
        handoffConsumptionGoal:
          "Run bounded grep-style evidence lookup anchored on checkpoint::swarm and return typed findings only.",
        summary: "Read-only worker placeholder recorded for grep.",
        requestedBy: "founder@demo.com",
        sourcePage: "/operating",
        createdAt: new Date("2026-04-16T08:04:00.000Z"),
      },
      swarmReadOnlyWorkerExecutionEvent: {
        id: "swarm_execution_1",
        workerKind: "grep",
        packetKey: "swarm::grep::checkpoint::swarm",
        checkpointId: "checkpoint_swarm_1",
        checkpointKey: "checkpoint::swarm",
        placeholderBundleKey: "artifact-bundle::swarm::grep::checkpoint::swarm",
        artifactTypes: [
          "grep_hits.json",
          "worker_findings_bundle.json",
          "worker_handoff_note.md",
        ],
        handoffConsumerAgent: "lead-orchestrator",
        handoffConsumptionGoal:
          "Run bounded grep-style evidence lookup anchored on checkpoint::swarm and return typed findings only.",
        summary: "Read-only worker execution slice recorded for grep.",
        requestedBy: "founder@demo.com",
        sourcePage: "/operating",
        createdAt: new Date("2026-04-16T08:05:00.000Z"),
      },
    });
    expect(recordedExecution.swarmReadOnlyWorkerContract.executionRecordState).toBe("recorded");
    expect(recordedExecution.swarmReadOnlyWorkerContract.executionEventId).toBe(
      "swarm_execution_1",
    );
    expect(recordedExecution.swarmReadOnlyWorkerContract.executionRecordedBy).toBe(
      "founder@demo.com",
    );
    expect(recordedExecution.swarmReadOnlyWorkerContract.executionRecordSourcePage).toBe(
      "/operating",
    );
    expect(recordedExecution.swarmReadOnlyWorkerContract.executionGuardContract.state).toBe(
      "reused",
    );
    expect(recordedExecution.swarmReadOnlyWorkerContract.executionLifecycleContract.state).toBe(
      "recorded",
    );
    expect(recordedExecution.swarmReadOnlyWorkerContract.executionLifecycleContract.driver).toBe(
      "recorded",
    );
    expect(recordedExecution.swarmReadOnlyWorkerContract.executionCandidateContract.state).toBe(
      "candidate_ready",
    );
    expect(recordedExecution.swarmReadOnlyWorkerContract.executionCandidateContract.driver).toBe(
      "execution_recorded",
    );
    expect(
      recordedExecution.swarmReadOnlyWorkerContract.executionCandidateContract
        .artifactMaterializationState,
    ).toBe("intent_ready");
    expect(
      recordedExecution.swarmReadOnlyWorkerContract.executionCandidateContract
        .materializationBundleKey,
    ).toBe("artifact-bundle::swarm::grep::checkpoint::swarm");
    expect(
      recordedExecution.swarmReadOnlyWorkerContract.executionCandidateContract
        .materializationArtifactTypes,
    ).toEqual([
      "grep_hits.json",
      "worker_findings_bundle.json",
      "worker_handoff_note.md",
    ]);
    expect(
      recordedExecution.swarmReadOnlyWorkerContract.artifactMaterializationGuardContract.state,
    ).toBe("allowed");
    expect(
      recordedExecution.swarmReadOnlyWorkerContract.artifactMaterializationGuardContract
        .materializationBundleKey,
    ).toBe("artifact-bundle::swarm::grep::checkpoint::swarm");
    expect(
      recordedExecution.swarmReadOnlyWorkerContract.artifactMaterializationRecordState,
    ).toBe("recordable");
    expect(
      recordedExecution.swarmReadOnlyWorkerContract.artifactMaterializationLifecycleContract.state,
    ).toBe("recordable");
    expect(
      recordedExecution.swarmReadOnlyWorkerContract.artifactMaterializationLifecycleContract.driver,
    ).toBe("recordable");
    expect(recordedExecution.swarmReadOnlyWorkerContract.resultSideOutputContract.state).toBe(
      "not_ready",
    );
    expect(recordedExecution.swarmReadOnlyWorkerContract.resultSideOutputContract.driver).toBe(
      "materialization_not_recorded",
    );
    expect(
      recordedExecution.swarmReadOnlyWorkerContract.resultSideOutputContract.outputBundleKey,
    ).toBe("artifact-bundle::swarm::grep::checkpoint::swarm");
    expect(
      recordedExecution.swarmReadOnlyWorkerContract.resultSideOutputGuardContract.state,
    ).toBe("blocked");
    expect(
      recordedExecution.swarmReadOnlyWorkerContract.resultSideOutputGuardContract
        .missingRequirements,
    ).toEqual(["result-side output is not ready"]);
    expect(
      recordedExecution.swarmReadOnlyWorkerContract.resultSideOutputLifecycleContract.state,
    ).toBe("blocked");
    expect(
      recordedExecution.swarmReadOnlyWorkerContract.resultSideOutputLifecycleContract.driver,
    ).toBe("guard_blocked");
    expect(recordedExecution.swarmReadOnlyWorkerContract.outputConsumptionContract.state).toBe(
      "not_ready",
    );
    expect(recordedExecution.swarmReadOnlyWorkerContract.outputConsumptionContract.driver).toBe(
      "output_not_consumable",
    );
    expect(recordedExecution.swarmReadOnlyWorkerContract.resultAdoptionContract.state).toBe(
      "not_ready",
    );
    expect(recordedExecution.swarmReadOnlyWorkerContract.resultAdoptionContract.driver).toBe(
      "consumption_not_ready",
    );
    expect(
      recordedExecution.swarmReadOnlyWorkerContract.outputAdoptionGuardContract.state,
    ).toBe("blocked");
    expect(
      recordedExecution.swarmReadOnlyWorkerContract.outputAdoptionGuardContract
        .missingRequirements,
    ).toEqual(["result adoption is not ready"]);
    expect(
      recordedExecution.swarmReadOnlyWorkerContract.outputAdoptionLifecycleContract.state,
    ).toBe("blocked");
    expect(
      recordedExecution.swarmReadOnlyWorkerContract.outputAdoptionLifecycleContract.driver,
    ).toBe("guard_blocked");
    expect(
      recordedExecution.swarmReadOnlyWorkerContract.resultAdoptionResultSideContract.state,
    ).toBe("not_ready");
    expect(
      recordedExecution.swarmReadOnlyWorkerContract.resultAdoptionResultSideContract.driver,
    ).toBe("adoption_not_recorded");
    expect(
      recordedExecution.swarmReadOnlyWorkerContract.artifactMaterializationGuardContract
        .missingRequirements,
    ).toEqual([]);

    const recordedMaterialization = buildRunThreadContract({
      ...baseInput,
      swarmReadOnlyWorkersEnabled: true,
      swarmBudgetEnvelope: {
        budgetTokenLimit: 100,
        budgetTokenUsed: 52,
        usagePercent: 52,
        prunedTokenCount: 0,
        posture: "SAFE",
      },
      checkpoints: [
        {
          id: "checkpoint_swarm_1",
          checkpointKey: "checkpoint::swarm",
          label: "swarm_anchor",
          status: "READY",
          summary: "Swarm request can anchor on the latest checkpoint.",
          createdAt: new Date("2026-04-16T08:01:00.000Z"),
          updatedAt: new Date("2026-04-16T08:01:00.000Z"),
        },
      ],
      swarmSpawnRequestEvent: {
        id: "swarm_request_1",
        taskClass: "read_only_worker",
        checkpointId: "checkpoint_swarm_1",
        checkpointKey: "checkpoint::swarm",
        summary: "Read-only swarm worker spawn request recorded for checkpoint::swarm.",
        requestedBy: "founder@demo.com",
        sourcePage: "/meetings/meeting_swarm",
        createdAt: new Date("2026-04-16T08:02:00.000Z"),
      },
      swarmReadOnlyWorkerIntentEvent: {
        id: "swarm_intent_1",
        workerKind: "grep",
        packetKey: "swarm::grep::checkpoint::swarm",
        checkpointId: "checkpoint_swarm_1",
        checkpointKey: "checkpoint::swarm",
        artifactTypes: ["grep_hits.json", "worker_findings_bundle.json"],
        summary: "Read-only worker intent recorded for grep.",
        requestedBy: "founder@demo.com",
        sourcePage: "/meetings/meeting_swarm",
        createdAt: new Date("2026-04-16T08:03:00.000Z"),
      },
      swarmReadOnlyWorkerPlaceholderEvent: {
        id: "swarm_placeholder_1",
        workerKind: "grep",
        packetKey: "swarm::grep::checkpoint::swarm",
        checkpointId: "checkpoint_swarm_1",
        checkpointKey: "checkpoint::swarm",
        placeholderBundleKey: "artifact-bundle::swarm::grep::checkpoint::swarm",
        placeholderBundleTitle: "grep findings placeholder bundle",
        artifactTypes: [
          "grep_hits.json",
          "worker_findings_bundle.json",
          "worker_handoff_note.md",
        ],
        handoffConsumerAgent: "lead-orchestrator",
        handoffConsumptionGoal:
          "Run bounded grep-style evidence lookup anchored on checkpoint::swarm and return typed findings only.",
        summary: "Read-only worker placeholder recorded for grep.",
        requestedBy: "founder@demo.com",
        sourcePage: "/operating",
        createdAt: new Date("2026-04-16T08:04:00.000Z"),
      },
      swarmReadOnlyWorkerExecutionEvent: {
        id: "swarm_execution_1",
        workerKind: "grep",
        packetKey: "swarm::grep::checkpoint::swarm",
        checkpointId: "checkpoint_swarm_1",
        checkpointKey: "checkpoint::swarm",
        placeholderBundleKey: "artifact-bundle::swarm::grep::checkpoint::swarm",
        artifactTypes: [
          "grep_hits.json",
          "worker_findings_bundle.json",
          "worker_handoff_note.md",
        ],
        handoffConsumerAgent: "lead-orchestrator",
        handoffConsumptionGoal:
          "Run bounded grep-style evidence lookup anchored on checkpoint::swarm and return typed findings only.",
        summary: "Read-only worker execution slice recorded for grep.",
        requestedBy: "founder@demo.com",
        sourcePage: "/operating",
        createdAt: new Date("2026-04-16T08:05:00.000Z"),
      },
      swarmReadOnlyWorkerMaterializationEvent: {
        id: "swarm_materialization_1",
        workerKind: "grep",
        packetKey: "swarm::grep::checkpoint::swarm",
        checkpointId: "checkpoint_swarm_1",
        checkpointKey: "checkpoint::swarm",
        materializationBundleKey: "artifact-bundle::swarm::grep::checkpoint::swarm",
        materializationBundleTitle: "grep findings placeholder bundle",
        artifactTypes: [
          "grep_hits.json",
          "worker_findings_bundle.json",
          "worker_handoff_note.md",
        ],
        handoffConsumerAgent: "lead-orchestrator",
        handoffConsumptionGoal:
          "Run bounded grep-style evidence lookup anchored on checkpoint::swarm and return typed findings only.",
        summary: "Read-only worker materialization slice recorded for grep.",
        requestedBy: "founder@demo.com",
        sourcePage: "/operating",
        createdAt: new Date("2026-04-16T08:06:00.000Z"),
      },
    });
    expect(
      recordedMaterialization.swarmReadOnlyWorkerContract.artifactMaterializationRecordState,
    ).toBe("recorded");
    expect(
      recordedMaterialization.swarmReadOnlyWorkerContract.artifactMaterializationEventId,
    ).toBe("swarm_materialization_1");
    expect(
      recordedMaterialization.swarmReadOnlyWorkerContract.artifactMaterializedBy,
    ).toBe("founder@demo.com");
    expect(
      recordedMaterialization.swarmReadOnlyWorkerContract.artifactMaterializationSourcePage,
    ).toBe("/operating");
    expect(
      recordedMaterialization.swarmReadOnlyWorkerContract.artifactMaterializationLifecycleContract
        .state,
    ).toBe("recorded");
    expect(
      recordedMaterialization.swarmReadOnlyWorkerContract.artifactMaterializationLifecycleContract
        .driver,
    ).toBe("recorded");
    expect(
      recordedMaterialization.swarmReadOnlyWorkerContract.resultSideOutputContract.state,
    ).toBe("output_ready");
    expect(
      recordedMaterialization.swarmReadOnlyWorkerContract.resultSideOutputContract.driver,
    ).toBe("materialization_recorded");
    expect(
      recordedMaterialization.swarmReadOnlyWorkerContract.resultSideOutputContract.outputBundleKey,
    ).toBe("artifact-bundle::swarm::grep::checkpoint::swarm");
    expect(
      recordedMaterialization.swarmReadOnlyWorkerContract.resultSideOutputContract
        .outputArtifactTypes,
    ).toEqual(["grep_hits.json", "worker_findings_bundle.json", "worker_handoff_note.md"]);
    expect(
      recordedMaterialization.swarmReadOnlyWorkerContract.resultSideOutputGuardContract.state,
    ).toBe("allowed");
    expect(
      recordedMaterialization.swarmReadOnlyWorkerContract.resultSideOutputLifecycleContract.state,
    ).toBe("consumable");
    expect(
      recordedMaterialization.swarmReadOnlyWorkerContract.resultSideOutputLifecycleContract.driver,
    ).toBe("consumable");
    expect(
      recordedMaterialization.swarmReadOnlyWorkerContract.outputConsumptionContract.state,
    ).toBe("consumable");
    expect(
      recordedMaterialization.swarmReadOnlyWorkerContract.outputConsumptionContract.driver,
    ).toBe("output_consumable");
    expect(recordedMaterialization.swarmReadOnlyWorkerContract.resultAdoptionContract.state).toBe(
      "adoption_ready",
    );
    expect(recordedMaterialization.swarmReadOnlyWorkerContract.resultAdoptionContract.driver).toBe(
      "consumption_ready",
    );
    expect(
      recordedMaterialization.swarmReadOnlyWorkerContract.outputAdoptionGuardContract.state,
    ).toBe("allowed");
    expect(
      recordedMaterialization.swarmReadOnlyWorkerContract.outputAdoptionRecordState,
    ).toBe("recordable");
    expect(
      recordedMaterialization.swarmReadOnlyWorkerContract.outputAdoptionLifecycleContract.state,
    ).toBe("recordable");
    expect(
      recordedMaterialization.swarmReadOnlyWorkerContract.outputAdoptionLifecycleContract.driver,
    ).toBe("recordable");
    expect(
      recordedMaterialization.swarmReadOnlyWorkerContract.resultAdoptionResultSideContract.state,
    ).toBe("not_ready");
    expect(
      recordedMaterialization.swarmReadOnlyWorkerContract.resultAdoptionResultSideContract.driver,
    ).toBe("adoption_not_recorded");

    const recordedAdoption = buildRunThreadContract({
      ...baseInput,
      swarmReadOnlyWorkersEnabled: true,
      swarmBudgetEnvelope: {
        budgetTokenLimit: 100,
        budgetTokenUsed: 52,
        usagePercent: 52,
        prunedTokenCount: 0,
        posture: "SAFE",
      },
      checkpoints: [
        {
          id: "checkpoint_swarm_1",
          checkpointKey: "checkpoint::swarm",
          label: "swarm_anchor",
          status: "READY",
          summary: "Swarm request can anchor on the latest checkpoint.",
          createdAt: new Date("2026-04-16T08:01:00.000Z"),
          updatedAt: new Date("2026-04-16T08:01:00.000Z"),
        },
      ],
      swarmSpawnRequestEvent: {
        id: "swarm_request_1",
        taskClass: "read_only_worker",
        checkpointId: "checkpoint_swarm_1",
        checkpointKey: "checkpoint::swarm",
        summary: "Read-only swarm worker spawn request recorded for checkpoint::swarm.",
        requestedBy: "founder@demo.com",
        sourcePage: "/meetings/meeting_swarm",
        createdAt: new Date("2026-04-16T08:02:00.000Z"),
      },
      swarmReadOnlyWorkerIntentEvent: {
        id: "swarm_intent_1",
        workerKind: "grep",
        packetKey: "swarm::grep::checkpoint::swarm",
        checkpointId: "checkpoint_swarm_1",
        checkpointKey: "checkpoint::swarm",
        artifactTypes: ["grep_hits.json", "worker_findings_bundle.json"],
        summary: "Read-only worker intent recorded for grep.",
        requestedBy: "founder@demo.com",
        sourcePage: "/meetings/meeting_swarm",
        createdAt: new Date("2026-04-16T08:03:00.000Z"),
      },
      swarmReadOnlyWorkerPlaceholderEvent: {
        id: "swarm_placeholder_1",
        workerKind: "grep",
        packetKey: "swarm::grep::checkpoint::swarm",
        checkpointId: "checkpoint_swarm_1",
        checkpointKey: "checkpoint::swarm",
        placeholderBundleKey: "artifact-bundle::swarm::grep::checkpoint::swarm",
        placeholderBundleTitle: "grep findings placeholder bundle",
        artifactTypes: [
          "grep_hits.json",
          "worker_findings_bundle.json",
          "worker_handoff_note.md",
        ],
        handoffConsumerAgent: "lead-orchestrator",
        handoffConsumptionGoal:
          "Run bounded grep-style evidence lookup anchored on checkpoint::swarm and return typed findings only.",
        summary: "Read-only worker placeholder recorded for grep.",
        requestedBy: "founder@demo.com",
        sourcePage: "/operating",
        createdAt: new Date("2026-04-16T08:04:00.000Z"),
      },
      swarmReadOnlyWorkerExecutionEvent: {
        id: "swarm_execution_1",
        workerKind: "grep",
        packetKey: "swarm::grep::checkpoint::swarm",
        checkpointId: "checkpoint_swarm_1",
        checkpointKey: "checkpoint::swarm",
        placeholderBundleKey: "artifact-bundle::swarm::grep::checkpoint::swarm",
        artifactTypes: [
          "grep_hits.json",
          "worker_findings_bundle.json",
          "worker_handoff_note.md",
        ],
        handoffConsumerAgent: "lead-orchestrator",
        handoffConsumptionGoal:
          "Run bounded grep-style evidence lookup anchored on checkpoint::swarm and return typed findings only.",
        summary: "Read-only worker execution slice recorded for grep.",
        requestedBy: "founder@demo.com",
        sourcePage: "/operating",
        createdAt: new Date("2026-04-16T08:05:00.000Z"),
      },
      swarmReadOnlyWorkerMaterializationEvent: {
        id: "swarm_materialization_1",
        workerKind: "grep",
        packetKey: "swarm::grep::checkpoint::swarm",
        checkpointId: "checkpoint_swarm_1",
        checkpointKey: "checkpoint::swarm",
        materializationBundleKey: "artifact-bundle::swarm::grep::checkpoint::swarm",
        materializationBundleTitle: "grep findings placeholder bundle",
        artifactTypes: [
          "grep_hits.json",
          "worker_findings_bundle.json",
          "worker_handoff_note.md",
        ],
        handoffConsumerAgent: "lead-orchestrator",
        handoffConsumptionGoal:
          "Run bounded grep-style evidence lookup anchored on checkpoint::swarm and return typed findings only.",
        summary: "Read-only worker materialization slice recorded for grep.",
        requestedBy: "founder@demo.com",
        sourcePage: "/operating",
        createdAt: new Date("2026-04-16T08:06:00.000Z"),
      },
      swarmReadOnlyWorkerAdoptionEvent: {
        id: "swarm_adoption_1",
        workerKind: "grep",
        packetKey: "swarm::grep::checkpoint::swarm",
        checkpointId: "checkpoint_swarm_1",
        checkpointKey: "checkpoint::swarm",
        outputBundleKey: "artifact-bundle::swarm::grep::checkpoint::swarm",
        outputBundleTitle: "grep findings placeholder bundle",
        outputArtifactTypes: [
          "grep_hits.json",
          "worker_findings_bundle.json",
          "worker_handoff_note.md",
        ],
        handoffConsumerAgent: "lead-orchestrator",
        handoffConsumptionGoal:
          "Run bounded grep-style evidence lookup anchored on checkpoint::swarm and return typed findings only.",
        summary: "Read-only worker output adoption seam recorded for grep.",
        requestedBy: "founder@demo.com",
        sourcePage: "/operating",
        createdAt: new Date("2026-04-16T08:07:00.000Z"),
      },
    });
    expect(recordedAdoption.swarmReadOnlyWorkerContract.outputAdoptionRecordState).toBe(
      "recorded",
    );
    expect(recordedAdoption.swarmReadOnlyWorkerContract.outputAdoptionEventId).toBe(
      "swarm_adoption_1",
    );
    expect(recordedAdoption.swarmReadOnlyWorkerContract.outputAdoptedBy).toBe(
      "founder@demo.com",
    );
    expect(recordedAdoption.swarmReadOnlyWorkerContract.outputAdoptionSourcePage).toBe(
      "/operating",
    );
    expect(
      recordedAdoption.swarmReadOnlyWorkerContract.outputAdoptionLifecycleContract.state,
    ).toBe("recorded");
    expect(
      recordedAdoption.swarmReadOnlyWorkerContract.outputAdoptionLifecycleContract.driver,
    ).toBe("recorded");
    expect(
      recordedAdoption.swarmReadOnlyWorkerContract.resultAdoptionResultSideContract.state,
    ).toBe("output_ready");
    expect(
      recordedAdoption.swarmReadOnlyWorkerContract.resultAdoptionResultSideContract.driver,
    ).toBe("adoption_recorded");
    expect(
      recordedAdoption.swarmReadOnlyWorkerContract.resultAdoptionResultSideContract
        .outputAdoptionEventId,
    ).toBe("swarm_adoption_1");
  });

  it("marks close control flow as forward-active when bounded forward work stays open before closeout starts", () => {
    const contract = buildRunThreadContract({
      id: "session_1b",
      workspaceId: "workspace_1",
      sessionKey: "workspace_1:runtime-session:event_1b",
      status: "ACTIVE",
      currentStage: "verification_review",
      sourcePage: "/meetings/meeting_1b",
      boundaryNote: "Review-first runtime only.",
      replayableEventLog: JSON.stringify([
        { stage: "meeting_ingest", at: "2026-04-11T08:00:00.000Z" },
        { stage: "verification_review", at: "2026-04-11T08:15:00.000Z" },
      ]),
      resumedFromKey: null,
      createdAt: new Date("2026-04-11T08:00:00.000Z"),
      updatedAt: new Date("2026-04-11T08:15:00.000Z"),
      closedAt: null,
      checkpoints: [
        {
          id: "checkpoint_1b",
          checkpointKey: "workspace_1:checkpoint:1b",
          label: "post_verification",
          status: "READY",
          summary: "Verification completed and ready to resume.",
          createdAt: new Date("2026-04-11T08:10:00.000Z"),
          updatedAt: new Date("2026-04-11T08:12:00.000Z"),
        },
      ],
      requestLifecycleEntries: [
        {
          id: "takeover_request_1b",
          kind: "takeover_requested",
          label: "takeover requested · RESUME_CHECKPOINT",
          summary: "Operator takeover request recorded for RESUME_CHECKPOINT on workspace_1:checkpoint:1b.",
          checkpointKey: "workspace_1:checkpoint:1b",
          timestamp: new Date("2026-04-11T08:14:15.000Z"),
        },
        {
          id: "takeover_ack_1b",
          kind: "takeover_request_acknowledged",
          label: "takeover acknowledged · RESUME_CHECKPOINT",
          summary: "Operator takeover acknowledgement recorded for RESUME_CHECKPOINT on workspace_1:checkpoint:1b.",
          checkpointKey: "workspace_1:checkpoint:1b",
          timestamp: new Date("2026-04-11T08:14:30.000Z"),
        },
        {
          id: "takeover_start_1b",
          kind: "takeover_active",
          label: "takeover active · RESUME_CHECKPOINT",
          summary: "Operator takeover started for RESUME_CHECKPOINT on workspace_1:checkpoint:1b.",
          actorName: "founder@demo.com",
          checkpointKey: "workspace_1:checkpoint:1b",
          timestamp: new Date("2026-04-11T08:14:35.000Z"),
        },
      ],
      resultAcknowledgements: [
        {
          id: "ack_0b",
          source: "human_execution",
          state: "pending",
          summary: "Human execution proof is still pending acknowledgement.",
          timestamp: new Date("2026-04-11T08:15:00.000Z"),
        },
        {
          id: "ack_1b",
          source: "official_write",
          state: "acknowledged",
          summary: "Guarded official write crm.attach_note is acknowledged.",
          timestamp: new Date("2026-04-11T08:15:30.000Z"),
        },
      ],
    });

    expect(contract.closeoutFlow.state).toBe("idle");
    expect(contract.forwardFlow.state).toBe("active_control");
    expect(contract.closeControl.state).toBe("active");
    expect(contract.closeControl.driver).toBe("settlement_flow");
    expect(contract.closeControlFlow.state).toBe("forward_active");
    expect(contract.closeControlFlow.driver).toBe("forward_flow");
    expect(contract.closeControlFlow.forwardState).toBe("active_control");
    expect(contract.closeControlFlow.settlementState).toBe("active");
    expect(contract.closeControlFlow.forwardAttentionCount).toBe(2);
    expect(contract.closeControlFlow.openCloseoutCount).toBe(0);
    expect(contract.closeDecisionFlow.state).toBe("active");
    expect(contract.closeDecisionFlow.driver).toBe("close_control_flow");
    expect(contract.closeDecisionFlow.controlState).toBe("forward_active");
    expect(contract.closeDecisionControlSummary.state).toBe("forward_active");
    expect(contract.closeDecisionControlSummary.driver).toBe("forward_flow");
    expect(contract.closeDecisionControlSummary.forwardState).toBe("active_control");
    expect(contract.closeResolutionSummary.state).toBe("not_ready");
    expect(contract.closeResolutionSummary.driver).toBe("close_decision_control_summary");
    expect(contract.closeResolutionForwardSummary.state).toBe("forward_active");
    expect(contract.closeResolutionForwardSummary.driver).toBe("forward_flow");
    expect(contract.closeResolutionControlSummary.state).toBe("not_ready");
    expect(contract.closeResolutionControlSummary.driver).toBe("close_resolution_forward_summary");
    expect(contract.closePostureSummary.state).toBe("open");
    expect(contract.closePostureSummary.driver).toBe("close_resolution_forward_summary");
    expect(contract.closePostureForwardSummary.state).toBe("forward_open");
    expect(contract.closePostureForwardSummary.driver).toBe("forward_flow");
  });

  it("uses resumedFromKey as the canonical resumed checkpoint anchor", () => {
    const contract = buildRunThreadContract({
      id: "session_2",
      workspaceId: "workspace_1",
      sessionKey: "workspace_1:runtime-session:event_2",
      status: "ACTIVE",
      currentStage: "resumed:post_verification",
      sourcePage: "/meetings/meeting_2",
      boundaryNote: "Review-first runtime only.",
      meetingId: "meeting_2",
      replayableEventLog: JSON.stringify([{ stage: "meeting_ingest", at: "2026-04-11T09:00:00.000Z" }]),
      resumedFromKey: "workspace_1:checkpoint:resume",
      createdAt: new Date("2026-04-11T09:00:00.000Z"),
      updatedAt: new Date("2026-04-11T09:30:00.000Z"),
      closedAt: null,
      checkpoints: [
        {
          id: "checkpoint_latest",
          checkpointKey: "workspace_1:checkpoint:latest",
          label: "latest_ready",
          status: "READY",
          summary: "Later checkpoint still exists.",
          createdAt: new Date("2026-04-11T09:20:00.000Z"),
          updatedAt: new Date("2026-04-11T09:20:00.000Z"),
        },
        {
          id: "checkpoint_resume",
          checkpointKey: "workspace_1:checkpoint:resume",
          label: "resume_anchor",
          status: "RESUMED",
          summary: "Resume anchor was restored.",
          createdAt: new Date("2026-04-11T09:10:00.000Z"),
          updatedAt: new Date("2026-04-11T09:30:00.000Z"),
        },
      ],
    });

    expect(contract.lifecycle).toBe("resumed");
    expect(contract.latestCheckpoint?.checkpointId).toBe("checkpoint_resume");
    expect(contract.latestCheckpoint?.state).toBe("resumed");
    expect(contract.resume.state).toBe("resumed");
    expect(contract.resume.resumeToken).toBe("workspace_1:checkpoint:resume");
    expect(contract.resume.resumedFromCheckpointId).toBe("checkpoint_resume");
    expect(contract.resume.resumedFromCheckpointKey).toBe("workspace_1:checkpoint:resume");
    expect(contract.resultAcknowledgement.state).toBe("not_available");
    expect(contract.resultFlow.latestState).toBe("not_available");
    expect(contract.resultFlow.trackedSourceCount).toBe(0);
    expect(contract.resultFlow.requiresOperatorAttentionCount).toBe(0);
    expect(contract.closeoutFlow.state).toBe("idle");
    expect(contract.closeoutFlow.openCount).toBe(0);
    expect(contract.closeoutFlow.resolvedCount).toBe(0);
    expect(contract.settlementReview.state).toBe("not_available");
    expect(contract.settlementFlow.state).toBe("active");
    expect(contract.settlementFlow.driver).toBe("lifecycle");
    expect(contract.settlementFlow.openCloseoutCount).toBe(0);
    expect(contract.forwardFlow.state).toBe("idle");
    expect(contract.forwardFlow.attentionCount).toBe(0);
    expect(contract.requestPosture.takeoverState).toBe("not_requested");
    expect(contract.requestPosture.humanInputState).toBe("not_requested");
    expect(contract.checkpointLineage[0]?.lineageRole).toBe("resume_anchor");
    expect(contract.checkpointLineage[1]?.lineageRole).toBe("historical");
    expect(contract.replayRequest.mode).toBe("resume_anchor");
    expect(contract.replayRequest.checkpointKey).toBe("workspace_1:checkpoint:resume");
  });

  it("marks terminal sessions as closed even when checkpoints exist", () => {
    const contract = buildRunThreadContract({
      id: "session_3",
      workspaceId: "workspace_1",
      sessionKey: "workspace_1:runtime-session:event_3",
      status: "COMPLETED",
      currentStage: "completed",
      sourcePage: "/meetings/meeting_3",
      boundaryNote: "Review-first runtime only.",
      replayableEventLog: JSON.stringify([]),
      resumedFromKey: null,
      createdAt: new Date("2026-04-11T10:00:00.000Z"),
      updatedAt: new Date("2026-04-11T10:20:00.000Z"),
      closedAt: new Date("2026-04-11T10:20:00.000Z"),
      checkpoints: [
        {
          id: "checkpoint_3",
          checkpointKey: "workspace_1:checkpoint:3",
          label: "final",
          status: "READY",
          summary: "Final checkpoint.",
          createdAt: new Date("2026-04-11T10:15:00.000Z"),
          updatedAt: new Date("2026-04-11T10:15:00.000Z"),
        },
      ],
    });

    expect(contract.runStatus).toBe("completed");
    expect(contract.lifecycle).toBe("closed");
    expect(contract.closedAt?.toISOString()).toBe("2026-04-11T10:20:00.000Z");
    expect(contract.humanInputCheckpoint.state).toBe("checkpoint_ready");
    expect(contract.requestPosture.summary).toContain("No operator takeover request");
  });

  it("keeps request posture anchored on request and acknowledgement notes even after takeover release", () => {
    const contract = buildRunThreadContract({
      id: "session_4",
      workspaceId: "workspace_1",
      sessionKey: "workspace_1:runtime-session:event_4",
      status: "ACTIVE",
      currentStage: "review_confirmed",
      sourcePage: "/meetings/meeting_4",
      boundaryNote: "Review-first runtime only.",
      replayableEventLog: JSON.stringify([]),
      resumedFromKey: null,
      createdAt: new Date("2026-04-11T11:00:00.000Z"),
      updatedAt: new Date("2026-04-11T11:12:00.000Z"),
      closedAt: null,
      checkpoints: [
        {
          id: "checkpoint_4",
          checkpointKey: "workspace_1:checkpoint:4",
          label: "takeover_anchor",
          status: "READY",
          summary: "Checkpoint remains available.",
          createdAt: new Date("2026-04-11T11:02:00.000Z"),
          updatedAt: new Date("2026-04-11T11:02:00.000Z"),
        },
      ],
      requestLifecycleEntries: [
        {
          id: "takeover_request_4",
          kind: "takeover_requested",
          label: "takeover requested · SAVE_RECOVERY_CHECKPOINT",
          summary: "Operator takeover request recorded for SAVE_RECOVERY_CHECKPOINT on workspace_1:checkpoint:4.",
          checkpointKey: "workspace_1:checkpoint:4",
          timestamp: new Date("2026-04-11T11:05:00.000Z"),
        },
        {
          id: "takeover_ack_4",
          kind: "takeover_request_acknowledged",
          label: "takeover acknowledged · SAVE_RECOVERY_CHECKPOINT",
          summary: "Operator takeover acknowledgement recorded for SAVE_RECOVERY_CHECKPOINT on workspace_1:checkpoint:4.",
          checkpointKey: "workspace_1:checkpoint:4",
          timestamp: new Date("2026-04-11T11:06:00.000Z"),
        },
        {
          id: "takeover_start_4",
          kind: "takeover_active",
          label: "takeover active · SAVE_RECOVERY_CHECKPOINT",
          summary: "Operator takeover started for SAVE_RECOVERY_CHECKPOINT on workspace_1:checkpoint:4.",
          actorName: "founder@demo.com",
          checkpointKey: "workspace_1:checkpoint:4",
          timestamp: new Date("2026-04-11T11:07:00.000Z"),
        },
        {
          id: "takeover_release_4",
          kind: "takeover_released",
          label: "takeover released · SAVE_RECOVERY_CHECKPOINT",
          summary: "Operator takeover released for SAVE_RECOVERY_CHECKPOINT on workspace_1:checkpoint:4.",
          actorName: "founder@demo.com",
          checkpointKey: "workspace_1:checkpoint:4",
          timestamp: new Date("2026-04-11T11:08:00.000Z"),
        },
      ],
    });

    expect(contract.requestPosture.takeoverState).toBe("acknowledged");
    expect(contract.requestPosture.latestLifecycleKind).toBe("takeover_request_acknowledged");
    expect(contract.lifecycleLog[0]?.kind).toBe("takeover_released");
    expect(contract.lifecycleLog.some((item) => item.kind === "takeover_released")).toBe(true);
    expect(contract.closeoutFlow.state).toBe("idle");
    expect(contract.settlementReview.state).toBe("not_available");
    expect(contract.settlementFlow.state).toBe("active");
    expect(contract.settlementFlow.driver).toBe("lifecycle");
    expect(contract.forwardFlow.state).toBe("idle");
    expect(contract.forwardFlow.latestLifecycleKind).toBe("takeover_released");
  });

  it("marks forward flow as lifecycle closeout when takeover follow-through stays open after release", () => {
    const contract = buildRunThreadContract({
      id: "session_5",
      workspaceId: "workspace_1",
      sessionKey: "workspace_1:runtime-session:event_5",
      status: "ACTIVE",
      currentStage: "review_confirmed",
      sourcePage: "/meetings/meeting_5",
      boundaryNote: "Review-first runtime only.",
      replayableEventLog: JSON.stringify([]),
      resumedFromKey: null,
      createdAt: new Date("2026-04-12T11:00:00.000Z"),
      updatedAt: new Date("2026-04-12T11:12:00.000Z"),
      closedAt: null,
      checkpoints: [
        {
          id: "checkpoint_5",
          checkpointKey: "checkpoint::takeover-followthrough",
          label: "takeover_followthrough_anchor",
          status: "READY",
          summary: "Checkpoint remains available for lifecycle closeout.",
          createdAt: new Date("2026-04-12T11:02:00.000Z"),
          updatedAt: new Date("2026-04-12T11:02:00.000Z"),
        },
      ],
      requestLifecycleEntries: [
        {
          id: "takeover_request_5",
          kind: "takeover_requested",
          label: "takeover requested · RESUME_CHECKPOINT",
          summary: "Operator takeover request recorded for RESUME_CHECKPOINT on checkpoint::takeover-followthrough.",
          checkpointKey: "checkpoint::takeover-followthrough",
          timestamp: new Date("2026-04-12T11:04:00.000Z"),
        },
        {
          id: "takeover_ack_5",
          kind: "takeover_request_acknowledged",
          label: "takeover acknowledged · RESUME_CHECKPOINT",
          summary: "Operator takeover acknowledgement recorded for RESUME_CHECKPOINT on checkpoint::takeover-followthrough.",
          checkpointKey: "checkpoint::takeover-followthrough",
          timestamp: new Date("2026-04-12T11:05:00.000Z"),
        },
        {
          id: "takeover_start_5",
          kind: "takeover_active",
          label: "takeover active · RESUME_CHECKPOINT",
          summary: "Operator takeover started for RESUME_CHECKPOINT on checkpoint::takeover-followthrough.",
          actorName: "founder@demo.com",
          checkpointKey: "checkpoint::takeover-followthrough",
          timestamp: new Date("2026-04-12T11:06:00.000Z"),
        },
        {
          id: "takeover_release_5",
          kind: "takeover_released",
          label: "takeover released · RESUME_CHECKPOINT",
          summary: "Operator takeover released for RESUME_CHECKPOINT on checkpoint::takeover-followthrough.",
          actorName: "founder@demo.com",
          checkpointKey: "checkpoint::takeover-followthrough",
          timestamp: new Date("2026-04-12T11:07:00.000Z"),
        },
        {
          id: "takeover_followthrough_request_5",
          kind: "takeover_followthrough_requested",
          label: "takeover follow-through requested · RESUME_CHECKPOINT",
          summary:
            "Close the operator takeover follow-through on checkpoint::takeover-followthrough before the thread is treated as settled.",
          actorName: "operator@demo.com",
          checkpointKey: "checkpoint::takeover-followthrough",
          timestamp: new Date("2026-04-12T11:08:00.000Z"),
        },
      ],
    });

    expect(contract.closeoutFlow.state).toBe("open");
    expect(contract.closeoutFlow.latestSource).toBe("operator_takeover_followthrough");
    expect(contract.closeoutFlow.openCount).toBe(1);
    expect(contract.closeoutFlow.resolvedCount).toBe(0);
    expect(contract.closeoutFlow.currentOwner).toBe("operator@demo.com");
    expect(contract.closeoutFlow.checkpointKey).toBe("checkpoint::takeover-followthrough");
    expect(contract.closeoutFlow.nextAction).toContain("follow-through");
    expect(contract.closeoutFlow.sourceEntries[0]?.source).toBe("operator_takeover_followthrough");
    expect(contract.settlementReview.state).toBe("not_available");
    expect(contract.settlementFlow.state).toBe("closeout_open");
    expect(contract.settlementFlow.driver).toBe("closeout_flow");
    expect(contract.settlementFlow.openCloseoutCount).toBe(1);
    expect(contract.settlementFlow.nextAction).toContain("follow-through");
    expect(contract.forwardFlow.state).toBe("lifecycle_closeout");
    expect(contract.forwardFlow.attentionSources).toContain("operator_takeover_followthrough");
    expect(contract.forwardFlow.currentOwner).toBe("operator@demo.com");
    expect(contract.forwardFlow.checkpointKey).toBe("checkpoint::takeover-followthrough");
    expect(contract.forwardFlow.nextAction).toContain("follow-through");
    expect(contract.lifecycleLog[0]?.kind).toBe("takeover_followthrough_requested");
  });

  it("aggregates operator closeout and downstream result follow-through into one closeout flow", () => {
    const contract = buildRunThreadContract({
      id: "session_6",
      workspaceId: "workspace_1",
      sessionKey: "workspace_1:runtime-session:event_6",
      status: "ACTIVE",
      currentStage: "review_confirmed",
      sourcePage: "/meetings/meeting_6",
      boundaryNote: "Review-first runtime only.",
      replayableEventLog: JSON.stringify([]),
      resumedFromKey: null,
      createdAt: new Date("2026-04-12T12:00:00.000Z"),
      updatedAt: new Date("2026-04-12T12:16:00.000Z"),
      closedAt: null,
      checkpoints: [
        {
          id: "checkpoint_6",
          checkpointKey: "checkpoint::closeout-mixed",
          label: "mixed_closeout_anchor",
          status: "READY",
          summary: "Checkpoint remains available for thread settlement.",
          createdAt: new Date("2026-04-12T12:02:00.000Z"),
          updatedAt: new Date("2026-04-12T12:02:00.000Z"),
        },
      ],
      requestLifecycleEntries: [
        {
          id: "takeover_release_6",
          kind: "takeover_released",
          label: "takeover released · SAVE_RECOVERY_CHECKPOINT",
          summary: "Operator takeover released for SAVE_RECOVERY_CHECKPOINT on checkpoint::closeout-mixed.",
          actorName: "founder@demo.com",
          checkpointKey: "checkpoint::closeout-mixed",
          timestamp: new Date("2026-04-12T12:10:00.000Z"),
        },
        {
          id: "takeover_followthrough_request_6",
          kind: "takeover_followthrough_requested",
          label: "takeover follow-through requested · SAVE_RECOVERY_CHECKPOINT",
          summary: "Close the operator takeover follow-through on checkpoint::closeout-mixed before the thread is treated as settled.",
          actorName: "operator@demo.com",
          checkpointKey: "checkpoint::closeout-mixed",
          timestamp: new Date("2026-04-12T12:12:00.000Z"),
        },
      ],
      resultAcknowledgements: [
        {
          id: "ack_6_1",
          source: "official_followthrough",
          state: "follow_through_resolved",
          summary: "Official follow-through resolved after the bounded write review.",
          timestamp: new Date("2026-04-12T12:11:00.000Z"),
        },
      ],
    });

    expect(contract.closeoutFlow.state).toBe("open");
    expect(contract.closeoutFlow.openCount).toBe(1);
    expect(contract.closeoutFlow.resolvedCount).toBe(1);
    expect(contract.closeoutFlow.latestSource).toBe("operator_takeover_followthrough");
    expect(contract.closeoutFlow.currentOwner).toBe("operator@demo.com");
    expect(contract.closeoutFlow.sourceEntries.map((item) => item.source)).toEqual([
      "operator_takeover_followthrough",
      "official_followthrough",
    ]);
    expect(contract.closeoutFlow.sourceEntries.map((item) => item.state)).toEqual(["open", "resolved"]);
    expect(contract.settlementReview.state).toBe("not_available");
    expect(contract.settlementFlow.state).toBe("closeout_open");
    expect(contract.settlementFlow.openCloseoutCount).toBe(1);
    expect(contract.settlementFlow.resolvedCloseoutCount).toBe(1);
  });

  it("marks settlement ready to close once closeout work is fully resolved", () => {
    const contract = buildRunThreadContract({
      id: "session_7",
      workspaceId: "workspace_1",
      sessionKey: "workspace_1:runtime-session:event_7",
      status: "ACTIVE",
      currentStage: "review_confirmed",
      sourcePage: "/meetings/meeting_7",
      boundaryNote: "Review-first runtime only.",
      replayableEventLog: JSON.stringify([]),
      resumedFromKey: null,
      createdAt: new Date("2026-04-12T13:00:00.000Z"),
      updatedAt: new Date("2026-04-12T13:16:00.000Z"),
      closedAt: null,
      checkpoints: [
        {
          id: "checkpoint_7",
          checkpointKey: "checkpoint::settlement-ready",
          label: "settlement_anchor",
          status: "READY",
          summary: "Checkpoint remains available for explicit closeout review.",
          createdAt: new Date("2026-04-12T13:02:00.000Z"),
          updatedAt: new Date("2026-04-12T13:02:00.000Z"),
        },
      ],
      requestLifecycleEntries: [
        {
          id: "takeover_release_7",
          kind: "takeover_released",
          label: "takeover released · SAVE_RECOVERY_CHECKPOINT",
          summary: "Operator takeover released for SAVE_RECOVERY_CHECKPOINT on checkpoint::settlement-ready.",
          actorName: "founder@demo.com",
          checkpointKey: "checkpoint::settlement-ready",
          timestamp: new Date("2026-04-12T13:10:00.000Z"),
        },
        {
          id: "takeover_followthrough_request_7",
          kind: "takeover_followthrough_requested",
          label: "takeover follow-through requested · SAVE_RECOVERY_CHECKPOINT",
          summary: "Operator takeover follow-through requested for SAVE_RECOVERY_CHECKPOINT on checkpoint::settlement-ready.",
          actorName: "operator@demo.com",
          checkpointKey: "checkpoint::settlement-ready",
          timestamp: new Date("2026-04-12T13:11:00.000Z"),
        },
        {
          id: "takeover_followthrough_resolved_7",
          kind: "takeover_followthrough_resolved",
          label: "takeover follow-through resolved · SAVE_RECOVERY_CHECKPOINT",
          summary: "Operator takeover follow-through resolved for SAVE_RECOVERY_CHECKPOINT on checkpoint::settlement-ready.",
          actorName: "operator@demo.com",
          checkpointKey: "checkpoint::settlement-ready",
          timestamp: new Date("2026-04-12T13:12:00.000Z"),
        },
      ],
    });

    expect(contract.closeoutFlow.state).toBe("resolved");
    expect(contract.closeoutFlow.openCount).toBe(0);
    expect(contract.closeoutFlow.resolvedCount).toBe(1);
    expect(contract.closeoutSummary.state).toBe("review_requestable");
    expect(contract.closeoutSummary.driver).toBe("settlement_review");
    expect(contract.closeControl.state).toBe("review_requestable");
    expect(contract.closeControl.driver).toBe("closeout_summary");
    expect(contract.closeControlFlow.state).toBe("review_requestable");
    expect(contract.closeControlFlow.driver).toBe("close_control");
    expect(contract.closeDecisionFlow.state).toBe("review_requestable");
    expect(contract.closeDecisionFlow.driver).toBe("close_control_flow");
    expect(contract.closeDecisionControlSummary.state).toBe("review_requestable");
    expect(contract.closeDecisionControlSummary.driver).toBe("close_decision_flow");
    expect(contract.closeResolutionSummary.state).toBe("not_ready");
    expect(contract.closeResolutionSummary.driver).toBe("close_decision_control_summary");
    expect(contract.closeResolutionForwardSummary.state).toBe("review_requestable");
    expect(contract.closeResolutionForwardSummary.driver).toBe("close_decision_control_summary");
    expect(contract.closeResolutionControlSummary.state).toBe("not_ready");
    expect(contract.closeResolutionControlSummary.driver).toBe("close_resolution_forward_summary");
    expect(contract.closePostureSummary.state).toBe("open");
    expect(contract.closePostureSummary.driver).toBe("close_resolution_forward_summary");
    expect(contract.closePostureForwardSummary.state).toBe("review_requestable");
    expect(contract.closePostureForwardSummary.driver).toBe("close_resolution_forward_summary");
    expect(contract.settlementReview.state).toBe("requestable");
    expect(contract.settlementReview.nextAction).toContain("Request explicit settlement review");
    expect(contract.settlementFlow.state).toBe("ready_to_close");
    expect(contract.settlementFlow.driver).toBe("closeout_flow");
    expect(contract.settlementFlow.openCloseoutCount).toBe(0);
    expect(contract.settlementFlow.resolvedCloseoutCount).toBe(1);
    expect(contract.settlementFlow.nextAction).toContain("Request explicit settlement review");
  });

  it("keeps settlement flow on explicit review until settlement review is resolved", () => {
    const contract = buildRunThreadContract({
      id: "session_8",
      workspaceId: "workspace_1",
      sessionKey: "workspace_1:runtime-session:event_8",
      status: "ACTIVE",
      currentStage: "review_confirmed",
      sourcePage: "/meetings/meeting_8",
      boundaryNote: "Review-first runtime only.",
      replayableEventLog: JSON.stringify([]),
      resumedFromKey: null,
      createdAt: new Date("2026-04-12T13:00:00.000Z"),
      updatedAt: new Date("2026-04-12T13:16:00.000Z"),
      closedAt: null,
      checkpoints: [
        {
          id: "checkpoint_8",
          checkpointKey: "checkpoint::settlement-review",
          label: "settlement_review_anchor",
          status: "READY",
          summary: "Checkpoint remains available for explicit settlement review.",
          createdAt: new Date("2026-04-12T13:02:00.000Z"),
          updatedAt: new Date("2026-04-12T13:02:00.000Z"),
        },
      ],
      resultAcknowledgements: [
        {
          id: "ack_8_1",
          source: "official_followthrough",
          state: "follow_through_resolved",
          summary: "Official follow-through resolved after review.",
          timestamp: new Date("2026-04-12T13:10:00.000Z"),
        },
      ],
      settlementReviewEntries: [
        {
          id: "settlement_review_request_8",
          kind: "settlement_review_requested",
          summary: "Settlement review requested for checkpoint::settlement-review.",
          actorName: "operator@demo.com",
          checkpointId: "checkpoint_8",
          checkpointKey: "checkpoint::settlement-review",
          resumeToken: "checkpoint::settlement-review",
          nextAction: "Resolve the explicit settlement review before the thread is closed.",
          sourcePage: "/meetings/meeting_8",
          timestamp: new Date("2026-04-12T13:11:00.000Z"),
        },
      ],
    });

    expect(contract.settlementReview.state).toBe("requested");
    expect(contract.closeoutSummary.state).toBe("review_open");
    expect(contract.closeoutSummary.driver).toBe("settlement_review");
    expect(contract.closeControl.state).toBe("review_open");
    expect(contract.closeControl.driver).toBe("settlement_flow");
    expect(contract.settlementFlow.state).toBe("review_open");
    expect(contract.settlementFlow.driver).toBe("settlement_review");
    expect(contract.settlementFlow.nextAction).toContain("Resolve the explicit settlement review");
    expect(contract.lifecycleLog[0]?.kind).toBe("settlement_review_requested");
  });

  it("marks settlement ready to close through explicit settlement review resolution", () => {
    const contract = buildRunThreadContract({
      id: "session_9",
      workspaceId: "workspace_1",
      sessionKey: "workspace_1:runtime-session:event_9",
      status: "ACTIVE",
      currentStage: "review_confirmed",
      sourcePage: "/meetings/meeting_9",
      boundaryNote: "Review-first runtime only.",
      replayableEventLog: JSON.stringify([]),
      resumedFromKey: null,
      createdAt: new Date("2026-04-12T13:20:00.000Z"),
      updatedAt: new Date("2026-04-12T13:32:00.000Z"),
      closedAt: null,
      checkpoints: [
        {
          id: "checkpoint_9",
          checkpointKey: "checkpoint::settlement-review-resolved",
          label: "settlement_review_resolved_anchor",
          status: "READY",
          summary: "Checkpoint remains available for explicit settlement review.",
          createdAt: new Date("2026-04-12T13:22:00.000Z"),
          updatedAt: new Date("2026-04-12T13:22:00.000Z"),
        },
      ],
      resultAcknowledgements: [
        {
          id: "ack_9_1",
          source: "official_followthrough",
          state: "follow_through_resolved",
          summary: "Official follow-through resolved after review.",
          timestamp: new Date("2026-04-12T13:24:00.000Z"),
        },
      ],
      settlementReviewEntries: [
        {
          id: "settlement_review_request_9",
          kind: "settlement_review_requested",
          summary: "Settlement review requested for checkpoint::settlement-review-resolved.",
          actorName: "operator@demo.com",
          checkpointId: "checkpoint_9",
          checkpointKey: "checkpoint::settlement-review-resolved",
          resumeToken: "checkpoint::settlement-review-resolved",
          nextAction: "Resolve the explicit settlement review before the thread is closed.",
          sourcePage: "/meetings/meeting_9",
          timestamp: new Date("2026-04-12T13:25:00.000Z"),
        },
        {
          id: "settlement_review_resolved_9",
          kind: "settlement_review_resolved",
          summary: "Settlement review resolved for checkpoint::settlement-review-resolved.",
          actorName: "reviewer@demo.com",
          checkpointId: "checkpoint_9",
          checkpointKey: "checkpoint::settlement-review-resolved",
          resumeToken: "checkpoint::settlement-review-resolved",
          nextAction: "Close the run thread after bounded operator review.",
          sourcePage: "/meetings/meeting_9",
          timestamp: new Date("2026-04-12T13:27:00.000Z"),
        },
      ],
    });

    expect(contract.settlementReview.state).toBe("resolved");
    expect(contract.closeoutSummary.state).toBe("confirmable");
    expect(contract.closeoutSummary.driver).toBe("closeout_confirmation");
    expect(contract.closeControl.state).toBe("active");
    expect(contract.closeControl.driver).toBe("settlement_flow");
    expect(contract.closeControlFlow.state).toBe("active");
    expect(contract.closeControlFlow.driver).toBe("close_control");
    expect(contract.closeDecisionFlow.state).toBe("active");
    expect(contract.closeDecisionFlow.driver).toBe("close_control_flow");
    expect(contract.closeDecisionControlSummary.state).toBe("active");
    expect(contract.closeDecisionControlSummary.driver).toBe("close_control_flow");
    expect(contract.closeResolutionSummary.state).toBe("not_ready");
    expect(contract.closeResolutionSummary.driver).toBe("close_decision_control_summary");
    expect(contract.closeResolutionForwardSummary.state).toBe("active");
    expect(contract.closeResolutionForwardSummary.driver).toBe("close_decision_control_summary");
    expect(contract.closeResolutionControlSummary.state).toBe("not_ready");
    expect(contract.closeResolutionControlSummary.driver).toBe("close_resolution_forward_summary");
    expect(contract.closePostureSummary.state).toBe("open");
    expect(contract.closePostureSummary.driver).toBe("close_resolution_forward_summary");
    expect(contract.closePostureForwardSummary.state).toBe("open");
    expect(contract.closePostureForwardSummary.driver).toBe("close_posture_summary");
    expect(contract.closeoutConfirmation.state).toBe("confirmable");
    expect(contract.closeoutConfirmation.nextAction).toContain("Confirm thread-level closeout truth");
    expect(contract.settlementFlow.state).toBe("ready_to_close");
    expect(contract.settlementFlow.driver).toBe("settlement_review");
    expect(contract.settlementFlow.nextAction).toContain("Close the run thread");
    expect(contract.lifecycleLog[0]?.kind).toBe("settlement_review_resolved");
  });

  it("marks closeout confirmation as confirmed once explicit closeout truth is recorded", () => {
    const contract = buildRunThreadContract({
      id: "session_10",
      workspaceId: "workspace_1",
      sessionKey: "workspace_1:runtime-session:event_10",
      status: "ACTIVE",
      currentStage: "review_confirmed",
      sourcePage: "/meetings/meeting_10",
      boundaryNote: "Review-first runtime only.",
      replayableEventLog: JSON.stringify([]),
      resumedFromKey: null,
      createdAt: new Date("2026-04-12T13:40:00.000Z"),
      updatedAt: new Date("2026-04-12T13:55:00.000Z"),
      closedAt: null,
      checkpoints: [
        {
          id: "checkpoint_10",
          checkpointKey: "checkpoint::closeout-confirmed",
          label: "closeout_confirmation_anchor",
          status: "READY",
          summary: "Checkpoint remains available for explicit thread closeout confirmation.",
          createdAt: new Date("2026-04-12T13:42:00.000Z"),
          updatedAt: new Date("2026-04-12T13:42:00.000Z"),
        },
      ],
      resultAcknowledgements: [
        {
          id: "ack_10_1",
          source: "official_followthrough",
          state: "follow_through_resolved",
          summary: "Official follow-through resolved after review.",
          timestamp: new Date("2026-04-12T13:44:00.000Z"),
        },
      ],
      settlementReviewEntries: [
        {
          id: "settlement_review_request_10",
          kind: "settlement_review_requested",
          summary: "Settlement review requested for checkpoint::closeout-confirmed.",
          actorName: "operator@demo.com",
          checkpointId: "checkpoint_10",
          checkpointKey: "checkpoint::closeout-confirmed",
          resumeToken: "checkpoint::closeout-confirmed",
          nextAction: "Resolve the explicit settlement review before the thread is closed.",
          sourcePage: "/meetings/meeting_10",
          timestamp: new Date("2026-04-12T13:45:00.000Z"),
        },
        {
          id: "settlement_review_resolved_10",
          kind: "settlement_review_resolved",
          summary: "Settlement review resolved for checkpoint::closeout-confirmed.",
          actorName: "reviewer@demo.com",
          checkpointId: "checkpoint_10",
          checkpointKey: "checkpoint::closeout-confirmed",
          resumeToken: "checkpoint::closeout-confirmed",
          nextAction: "Close the run thread after bounded operator review.",
          sourcePage: "/meetings/meeting_10",
          timestamp: new Date("2026-04-12T13:47:00.000Z"),
        },
      ],
      closeoutConfirmationEntries: [
        {
          id: "closeout_confirmation_10",
          kind: "closeout_confirmed",
          summary: "Thread-level closeout truth confirmed for checkpoint::closeout-confirmed.",
          actorName: "operator@demo.com",
          settlementReviewResolutionEventId: "settlement_review_resolved_10",
          checkpointId: "checkpoint_10",
          checkpointKey: "checkpoint::closeout-confirmed",
          resumeToken: "checkpoint::closeout-confirmed",
          nextAction:
            "Close the runtime session only when bounded operator review confirms the thread can be closed without implying broader authority.",
          sourcePage: "/meetings/meeting_10",
          timestamp: new Date("2026-04-12T13:49:00.000Z"),
        },
      ],
    });

    expect(contract.closeoutConfirmation.state).toBe("confirmed");
    expect(contract.closeoutConfirmation.confirmationEventId).toBe("closeout_confirmation_10");
    expect(contract.closeoutConfirmation.settlementReviewResolutionEventId).toBe(
      "settlement_review_resolved_10",
    );
    expect(contract.closeoutConfirmation.confirmedBy).toBe("operator@demo.com");
    expect(contract.closeoutConfirmation.nextAction).toContain("Close the runtime session");
    expect(contract.closeoutRefresh.state).toBe("not_requestable");
    expect(contract.closeoutSummary.state).toBe("confirmed");
    expect(contract.closeoutSummary.driver).toBe("closeout_confirmation");
    expect(contract.lifecycleLog[0]?.kind).toBe("closeout_confirmed");
  });

  it("marks closeout refresh requestable once newer thread activity makes closeout truth stale", () => {
    const contract = buildRunThreadContract({
      id: "session_11",
      workspaceId: "workspace_1",
      sessionKey: "workspace_1:runtime-session:event_11",
      status: "ACTIVE",
      currentStage: "review_confirmed",
      sourcePage: "/meetings/meeting_11",
      boundaryNote: "Review-first runtime only.",
      replayableEventLog: JSON.stringify([]),
      resumedFromKey: null,
      createdAt: new Date("2026-04-12T14:00:00.000Z"),
      updatedAt: new Date("2026-04-12T14:18:00.000Z"),
      closedAt: null,
      checkpoints: [
        {
          id: "checkpoint_11",
          checkpointKey: "checkpoint::closeout-stale",
          label: "closeout_stale_anchor",
          status: "READY",
          summary: "Checkpoint remains available for explicit thread closeout refresh.",
          createdAt: new Date("2026-04-12T14:02:00.000Z"),
          updatedAt: new Date("2026-04-12T14:02:00.000Z"),
        },
      ],
      resultAcknowledgements: [
        {
          id: "ack_11_1",
          source: "official_followthrough",
          state: "follow_through_resolved",
          summary: "Official follow-through resolved after review.",
          timestamp: new Date("2026-04-12T14:16:00.000Z"),
        },
      ],
      settlementReviewEntries: [
        {
          id: "settlement_review_request_11",
          kind: "settlement_review_requested",
          summary: "Settlement review requested for checkpoint::closeout-stale.",
          actorName: "operator@demo.com",
          checkpointId: "checkpoint_11",
          checkpointKey: "checkpoint::closeout-stale",
          resumeToken: "checkpoint::closeout-stale",
          nextAction: "Resolve the explicit settlement review before the thread is closed.",
          sourcePage: "/meetings/meeting_11",
          timestamp: new Date("2026-04-12T14:05:00.000Z"),
        },
        {
          id: "settlement_review_resolved_11",
          kind: "settlement_review_resolved",
          summary: "Settlement review resolved for checkpoint::closeout-stale.",
          actorName: "reviewer@demo.com",
          checkpointId: "checkpoint_11",
          checkpointKey: "checkpoint::closeout-stale",
          resumeToken: "checkpoint::closeout-stale",
          nextAction: "Confirm the thread-level closeout truth before the runtime session is closed.",
          sourcePage: "/meetings/meeting_11",
          timestamp: new Date("2026-04-12T14:07:00.000Z"),
        },
      ],
      closeoutConfirmationEntries: [
        {
          id: "closeout_confirmation_11",
          kind: "closeout_confirmed",
          summary: "Thread-level closeout truth confirmed for checkpoint::closeout-stale.",
          actorName: "operator@demo.com",
          settlementReviewResolutionEventId: "settlement_review_resolved_11",
          checkpointId: "checkpoint_11",
          checkpointKey: "checkpoint::closeout-stale",
          resumeToken: "checkpoint::closeout-stale",
          nextAction:
            "Close the runtime session only when bounded operator review confirms the thread can be closed without implying broader authority.",
          sourcePage: "/meetings/meeting_11",
          timestamp: new Date("2026-04-12T14:09:00.000Z"),
        },
      ],
    });

    expect(contract.closeoutConfirmation.state).toBe("stale");
    expect(contract.closeoutRefresh.state).toBe("requestable");
    expect(contract.closeoutSummary.state).toBe("refresh_requestable");
    expect(contract.closeoutSummary.driver).toBe("closeout_refresh");
    expect(contract.closeoutRefresh.nextAction).toContain("Request closeout refresh");
  });

  it("marks closeout refresh resolved once a fresh confirmation lands after reopen follow-through", () => {
    const contract = buildRunThreadContract({
      id: "session_12",
      workspaceId: "workspace_1",
      sessionKey: "workspace_1:runtime-session:event_12",
      status: "ACTIVE",
      currentStage: "review_confirmed",
      sourcePage: "/meetings/meeting_12",
      boundaryNote: "Review-first runtime only.",
      replayableEventLog: JSON.stringify([]),
      resumedFromKey: null,
      createdAt: new Date("2026-04-12T14:20:00.000Z"),
      updatedAt: new Date("2026-04-12T14:40:00.000Z"),
      closedAt: null,
      checkpoints: [
        {
          id: "checkpoint_12",
          checkpointKey: "checkpoint::closeout-refresh",
          label: "closeout_refresh_anchor",
          status: "READY",
          summary: "Checkpoint remains available for explicit closeout refresh follow-through.",
          createdAt: new Date("2026-04-12T14:22:00.000Z"),
          updatedAt: new Date("2026-04-12T14:22:00.000Z"),
        },
      ],
      resultAcknowledgements: [
        {
          id: "ack_12_1",
          source: "official_followthrough",
          state: "follow_through_resolved",
          summary: "Official follow-through resolved after review.",
          timestamp: new Date("2026-04-12T14:36:00.000Z"),
        },
      ],
      settlementReviewEntries: [
        {
          id: "settlement_review_request_12",
          kind: "settlement_review_requested",
          summary: "Settlement review requested for checkpoint::closeout-refresh.",
          actorName: "operator@demo.com",
          checkpointId: "checkpoint_12",
          checkpointKey: "checkpoint::closeout-refresh",
          resumeToken: "checkpoint::closeout-refresh",
          nextAction: "Resolve the explicit settlement review before the thread is closed.",
          sourcePage: "/meetings/meeting_12",
          timestamp: new Date("2026-04-12T14:24:00.000Z"),
        },
        {
          id: "settlement_review_resolved_12",
          kind: "settlement_review_resolved",
          summary: "Settlement review resolved for checkpoint::closeout-refresh.",
          actorName: "reviewer@demo.com",
          checkpointId: "checkpoint_12",
          checkpointKey: "checkpoint::closeout-refresh",
          resumeToken: "checkpoint::closeout-refresh",
          nextAction: "Confirm the thread-level closeout truth before the runtime session is closed.",
          sourcePage: "/meetings/meeting_12",
          timestamp: new Date("2026-04-12T14:26:00.000Z"),
        },
      ],
      closeoutConfirmationEntries: [
        {
          id: "closeout_confirmation_12_old",
          kind: "closeout_confirmed",
          summary: "Thread-level closeout truth confirmed for checkpoint::closeout-refresh.",
          actorName: "operator@demo.com",
          settlementReviewResolutionEventId: "settlement_review_resolved_12",
          checkpointId: "checkpoint_12",
          checkpointKey: "checkpoint::closeout-refresh",
          resumeToken: "checkpoint::closeout-refresh",
          nextAction:
            "Close the runtime session only when bounded operator review confirms the thread can be closed without implying broader authority.",
          sourcePage: "/meetings/meeting_12",
          timestamp: new Date("2026-04-12T14:28:00.000Z"),
        },
        {
          id: "closeout_confirmation_12_new",
          kind: "closeout_confirmed",
          summary: "Thread-level closeout truth reconfirmed for checkpoint::closeout-refresh after refresh.",
          actorName: "operator@demo.com",
          settlementReviewResolutionEventId: "settlement_review_resolved_12",
          checkpointId: "checkpoint_12",
          checkpointKey: "checkpoint::closeout-refresh",
          resumeToken: "checkpoint::closeout-refresh",
          nextAction:
            "Close the runtime session only when bounded operator review confirms the refreshed thread can be closed without implying broader authority.",
          sourcePage: "/meetings/meeting_12",
          timestamp: new Date("2026-04-12T14:38:00.000Z"),
        },
      ],
      closeoutRefreshEntries: [
        {
          id: "closeout_refresh_request_12",
          kind: "closeout_refresh_requested",
          summary: "Closeout refresh requested for checkpoint::closeout-refresh.",
          actorName: "operator@demo.com",
          confirmationEventId: "closeout_confirmation_12_old",
          checkpointId: "checkpoint_12",
          checkpointKey: "checkpoint::closeout-refresh",
          resumeToken: "checkpoint::closeout-refresh",
          nextAction: "Reconfirm the thread-level closeout truth after the stale closeout summary is refreshed.",
          sourcePage: "/meetings/meeting_12",
          timestamp: new Date("2026-04-12T14:32:00.000Z"),
        },
      ],
    });

    expect(contract.closeoutConfirmation.state).toBe("confirmed");
    expect(contract.closeoutConfirmation.confirmationEventId).toBe("closeout_confirmation_12_new");
    expect(contract.closeoutRefresh.state).toBe("resolved");
    expect(contract.closeoutSummary.state).toBe("confirmed");
    expect(contract.closeoutSummary.driver).toBe("closeout_refresh");
    expect(contract.closeoutRefresh.requestEventId).toBe("closeout_refresh_request_12");
    expect(contract.closeoutRefresh.confirmationEventId).toBe("closeout_confirmation_12_new");
    expect(contract.lifecycleLog[0]?.kind).toBe("closeout_confirmed");
  });

  function buildCloseoutResolutionContractInput(
    overrides: Partial<Parameters<typeof buildRunThreadContract>[0]> = {},
  ): Parameters<typeof buildRunThreadContract>[0] {
    return {
      id: "session_18",
      workspaceId: "workspace_1",
      sessionKey: "workspace_1:runtime-session:event_18",
      status: "ACTIVE",
      currentStage: "review_confirmed",
      sourcePage: "/meetings/meeting_18",
      boundaryNote: "Review-first runtime only.",
      replayableEventLog: JSON.stringify([]),
      resumedFromKey: null,
      createdAt: new Date("2026-04-12T15:00:00.000Z"),
      updatedAt: new Date("2026-04-12T15:09:00.000Z"),
      closedAt: null,
      checkpoints: [
        {
          id: "checkpoint_18",
          checkpointKey: "checkpoint::closeout-resolution",
          label: "closeout_resolution_anchor",
          status: "READY",
          summary: "Checkpoint remains available for explicit closeout resolution.",
          createdAt: new Date("2026-04-12T15:02:00.000Z"),
          updatedAt: new Date("2026-04-12T15:02:00.000Z"),
        },
      ],
      resultAcknowledgements: [
        {
          id: "ack_18_1",
          source: "official_followthrough",
          state: "follow_through_resolved",
          summary: "Official follow-through resolved after review.",
          timestamp: new Date("2026-04-12T15:04:00.000Z"),
        },
      ],
      settlementReviewEntries: [
        {
          id: "settlement_review_request_18",
          kind: "settlement_review_requested",
          summary: "Settlement review requested for checkpoint::closeout-resolution.",
          actorName: "operator@demo.com",
          checkpointId: "checkpoint_18",
          checkpointKey: "checkpoint::closeout-resolution",
          resumeToken: "checkpoint::closeout-resolution",
          nextAction: "Resolve the explicit settlement review before the thread is closed.",
          sourcePage: "/meetings/meeting_18",
          timestamp: new Date("2026-04-12T15:05:00.000Z"),
        },
        {
          id: "settlement_review_resolved_18",
          kind: "settlement_review_resolved",
          summary: "Settlement review resolved for checkpoint::closeout-resolution.",
          actorName: "reviewer@demo.com",
          checkpointId: "checkpoint_18",
          checkpointKey: "checkpoint::closeout-resolution",
          resumeToken: "checkpoint::closeout-resolution",
          nextAction: "Confirm the thread-level closeout truth before the runtime session is closed.",
          sourcePage: "/meetings/meeting_18",
          timestamp: new Date("2026-04-12T15:07:00.000Z"),
        },
      ],
      closeoutConfirmationEntries: [
        {
          id: "closeout_confirmation_18",
          kind: "closeout_confirmed",
          summary: "Thread-level closeout truth confirmed for checkpoint::closeout-resolution.",
          actorName: "operator@demo.com",
          settlementReviewResolutionEventId: "settlement_review_resolved_18",
          checkpointId: "checkpoint_18",
          checkpointKey: "checkpoint::closeout-resolution",
          resumeToken: "checkpoint::closeout-resolution",
          nextAction:
            "Close the runtime session only when bounded operator review confirms the thread can be closed without implying broader authority.",
          sourcePage: "/meetings/meeting_18",
          timestamp: new Date("2026-04-12T15:09:00.000Z"),
        },
      ],
      ...overrides,
    };
  }

  it("marks closeout resolution as decision-required after closeout truth is confirmed", () => {
    const contract = buildRunThreadContract(buildCloseoutResolutionContractInput());

    expect(contract.closeoutSummary.state).toBe("confirmed");
    expect(contract.closeoutResolution.state).toBe("decision_required");
    expect(contract.closeoutResolution.decision).toBeNull();
    expect(contract.closeoutResolution.closeoutConfirmationEventId).toBe("closeout_confirmation_18");
    expect(contract.closeoutResolution.nextAction).toContain("Record an explicit close-thread or keep-open decision");
    expect(contract.closeoutOutcome.state).toBe("decision_required");
    expect(contract.closeoutOutcome.decision).toBeNull();
    expect(contract.closeoutOutcome.nextAction).toContain(
      "Record an explicit close-thread or keep-open decision",
    );
  });

  it("records an explicit close-thread resolution without auto-closing the session", () => {
    const contract = buildRunThreadContract(
      buildCloseoutResolutionContractInput({
        closeoutResolutionEntries: [
          {
            id: "closeout_resolution_18_close",
            kind: "closeout_resolution_recorded",
            decision: "close_thread",
            summary: "Explicit close-thread resolution recorded for checkpoint::closeout-resolution.",
            actorName: "operator@demo.com",
            closeoutConfirmationEventId: "closeout_confirmation_18",
            closeoutRefreshEventId: null,
            checkpointId: "checkpoint_18",
            checkpointKey: "checkpoint::closeout-resolution",
            resumeToken: "checkpoint::closeout-resolution",
            nextAction: "Close the runtime session only when a separate bounded operator action explicitly executes the close.",
            sourcePage: "/meetings/meeting_18",
            timestamp: new Date("2026-04-12T15:11:00.000Z"),
          },
        ],
      }),
    );

    expect(contract.lifecycle).toBe("checkpoint_ready");
    expect(contract.closedAt).toBeNull();
    expect(contract.closeoutResolution.state).toBe("close_recorded");
    expect(contract.closeoutResolution.decision).toBe("close_thread");
    expect(contract.closeoutResolution.resolutionEventId).toBe("closeout_resolution_18_close");
    expect(contract.closeoutResolution.nextAction).toContain("separate bounded operator action");
    expect(contract.lifecycleLog[0]?.kind).toBe("closeout_resolution_recorded");
  });

  it("records an explicit keep-open resolution when the operator declines to close the thread", () => {
    const contract = buildRunThreadContract(
      buildCloseoutResolutionContractInput({
        closeoutResolutionEntries: [
          {
            id: "closeout_resolution_18_keep",
            kind: "closeout_resolution_recorded",
            decision: "keep_open",
            summary: "Explicit keep-open resolution recorded for checkpoint::closeout-resolution.",
            actorName: "operator@demo.com",
            closeoutConfirmationEventId: "closeout_confirmation_18",
            closeoutRefreshEventId: null,
            checkpointId: "checkpoint_18",
            checkpointKey: "checkpoint::closeout-resolution",
            resumeToken: "checkpoint::closeout-resolution",
            nextAction: "Keep the thread open until a newer closeout truth justifies a different explicit decision.",
            sourcePage: "/meetings/meeting_18",
            timestamp: new Date("2026-04-12T15:11:00.000Z"),
          },
        ],
      }),
    );

    expect(contract.closeoutResolution.state).toBe("keep_open_recorded");
    expect(contract.closeoutResolution.decision).toBe("keep_open");
    expect(contract.closeoutResolution.summary).toContain("keep-open");
    expect(contract.closeoutResolution.nextAction).toContain("Keep the thread open");
  });

  it("marks a prior closeout resolution as stale once closeout truth reopens", () => {
    const contract = buildRunThreadContract(
      buildCloseoutResolutionContractInput({
        updatedAt: new Date("2026-04-12T15:24:00.000Z"),
        closeoutResolutionEntries: [
          {
            id: "closeout_resolution_18_stale",
            kind: "closeout_resolution_recorded",
            decision: "close_thread",
            summary: "Explicit close-thread resolution recorded for checkpoint::closeout-resolution.",
            actorName: "operator@demo.com",
            closeoutConfirmationEventId: "closeout_confirmation_18",
            closeoutRefreshEventId: null,
            checkpointId: "checkpoint_18",
            checkpointKey: "checkpoint::closeout-resolution",
            resumeToken: "checkpoint::closeout-resolution",
            nextAction: "Close the runtime session only when a separate bounded operator action explicitly executes the close.",
            sourcePage: "/meetings/meeting_18",
            timestamp: new Date("2026-04-12T15:11:00.000Z"),
          },
        ],
        closeoutRefreshEntries: [
          {
            id: "closeout_refresh_request_18",
            kind: "closeout_refresh_requested",
            summary: "Closeout refresh requested for checkpoint::closeout-resolution.",
            actorName: "operator@demo.com",
            confirmationEventId: "closeout_confirmation_18",
            checkpointId: "checkpoint_18",
            checkpointKey: "checkpoint::closeout-resolution",
            resumeToken: "checkpoint::closeout-resolution",
            nextAction: "Reconfirm the thread-level closeout truth after stale closeout summary is refreshed.",
            sourcePage: "/meetings/meeting_18",
            timestamp: new Date("2026-04-12T15:18:00.000Z"),
          },
        ],
      }),
    );

    expect(contract.closeoutRefresh.state).toBe("open");
    expect(contract.closeoutSummary.state).toBe("refresh_open");
    expect(contract.closeoutResolution.state).toBe("stale");
    expect(contract.closeoutResolution.decision).toBe("close_thread");
    expect(contract.closeoutResolution.nextAction).toContain("Reconfirm");
  });

  it("marks closeout resolution follow-through as requestable once an explicit decision is recorded", () => {
    const contract = buildRunThreadContract(
      buildCloseoutResolutionContractInput({
        closeoutResolutionEntries: [
          {
            id: "closeout_resolution_18_followthrough_requestable",
            kind: "closeout_resolution_recorded",
            decision: "close_thread",
            summary: "Explicit close-thread resolution recorded for checkpoint::closeout-resolution.",
            actorName: "operator@demo.com",
            closeoutConfirmationEventId: "closeout_confirmation_18",
            closeoutRefreshEventId: null,
            checkpointId: "checkpoint_18",
            checkpointKey: "checkpoint::closeout-resolution",
            resumeToken: "checkpoint::closeout-resolution",
            nextAction:
              "Close the runtime session only when a separate bounded operator action explicitly executes the close.",
            sourcePage: "/meetings/meeting_18",
            timestamp: new Date("2026-04-12T15:11:00.000Z"),
          },
        ],
      }),
    );

    expect(contract.closeoutResolution.state).toBe("close_recorded");
    expect(contract.closeoutResolutionFollowThrough.state).toBe("requestable");
    expect(contract.closeoutResolutionFollowThrough.decision).toBe("close_thread");
    expect(contract.closeoutResolutionFollowThrough.requestEventId).toBeNull();
    expect(contract.closeoutOutcome.state).toBe("followthrough_required");
    expect(contract.closeoutOutcome.decision).toBe("close_thread");
    expect(contract.closeoutFlow.state).toBe("resolved");
    expect(contract.settlementFlow.state).toBe("ready_to_close");
  });

  it("opens closeout resolution follow-through once explicit lifecycle follow-through is requested", () => {
    const contract = buildRunThreadContract(
      buildCloseoutResolutionContractInput({
        closeoutResolutionEntries: [
          {
            id: "closeout_resolution_18_followthrough_open",
            kind: "closeout_resolution_recorded",
            decision: "keep_open",
            summary: "Explicit keep-open resolution recorded for checkpoint::closeout-resolution.",
            actorName: "operator@demo.com",
            closeoutConfirmationEventId: "closeout_confirmation_18",
            closeoutRefreshEventId: null,
            checkpointId: "checkpoint_18",
            checkpointKey: "checkpoint::closeout-resolution",
            resumeToken: "checkpoint::closeout-resolution",
            nextAction: "Keep the thread open until a newer closeout truth justifies a different explicit decision.",
            sourcePage: "/meetings/meeting_18",
            timestamp: new Date("2026-04-12T15:11:00.000Z"),
          },
        ],
        closeoutResolutionFollowThroughEntries: [
          {
            id: "closeout_resolution_followthrough_request_18",
            kind: "closeout_resolution_followthrough_requested",
            decision: "keep_open",
            summary: "Keep-open follow-through requested for checkpoint::closeout-resolution.",
            actorName: "operator@demo.com",
            closeoutResolutionEventId: "closeout_resolution_18_followthrough_open",
            checkpointId: "checkpoint_18",
            checkpointKey: "checkpoint::closeout-resolution",
            resumeToken: "checkpoint::closeout-resolution",
            nextAction: "Resolve the explicit keep-open follow-through before the thread is treated as current keep-open truth.",
            sourcePage: "/meetings/meeting_18",
            timestamp: new Date("2026-04-12T15:12:00.000Z"),
          },
        ],
      }),
    );

    expect(contract.closeoutResolutionFollowThrough.state).toBe("open");
    expect(contract.closeoutResolutionFollowThrough.requestEventId).toBe(
      "closeout_resolution_followthrough_request_18",
    );
    expect(contract.closeoutOutcome.state).toBe("followthrough_open");
    expect(contract.closeoutOutcome.decision).toBe("keep_open");
    expect(contract.closeoutFlow.state).toBe("open");
    expect(contract.closeoutFlow.latestSource).toBe("closeout_resolution_followthrough");
    expect(contract.closeoutFlow.openCount).toBe(1);
    expect(contract.closeoutSummary.state).toBe("confirmed");
    expect(contract.settlementFlow.state).toBe("closeout_open");
    expect(contract.lifecycleLog[0]?.kind).toBe("closeout_resolution_followthrough_requested");
  });

  it("resolves closeout resolution follow-through once the explicit closeout handling is closed", () => {
    const contract = buildRunThreadContract(
      buildCloseoutResolutionContractInput({
        closeoutResolutionEntries: [
          {
            id: "closeout_resolution_18_followthrough_resolved",
            kind: "closeout_resolution_recorded",
            decision: "close_thread",
            summary: "Explicit close-thread resolution recorded for checkpoint::closeout-resolution.",
            actorName: "operator@demo.com",
            closeoutConfirmationEventId: "closeout_confirmation_18",
            closeoutRefreshEventId: null,
            checkpointId: "checkpoint_18",
            checkpointKey: "checkpoint::closeout-resolution",
            resumeToken: "checkpoint::closeout-resolution",
            nextAction:
              "Close the runtime session only when a separate bounded operator action explicitly executes the close.",
            sourcePage: "/meetings/meeting_18",
            timestamp: new Date("2026-04-12T15:11:00.000Z"),
          },
        ],
        closeoutResolutionFollowThroughEntries: [
          {
            id: "closeout_resolution_followthrough_request_18_resolved",
            kind: "closeout_resolution_followthrough_requested",
            decision: "close_thread",
            summary: "Close-thread follow-through requested for checkpoint::closeout-resolution.",
            actorName: "operator@demo.com",
            closeoutResolutionEventId: "closeout_resolution_18_followthrough_resolved",
            checkpointId: "checkpoint_18",
            checkpointKey: "checkpoint::closeout-resolution",
            resumeToken: "checkpoint::closeout-resolution",
            nextAction:
              "Resolve the explicit close-thread follow-through before the thread is treated as lifecycle-settled.",
            sourcePage: "/meetings/meeting_18",
            timestamp: new Date("2026-04-12T15:12:00.000Z"),
          },
          {
            id: "closeout_resolution_followthrough_resolved_18",
            kind: "closeout_resolution_followthrough_resolved",
            decision: "close_thread",
            summary: "Close-thread follow-through resolved for checkpoint::closeout-resolution.",
            actorName: "reviewer@demo.com",
            requestEventId: "closeout_resolution_followthrough_request_18_resolved",
            closeoutResolutionEventId: "closeout_resolution_18_followthrough_resolved",
            checkpointId: "checkpoint_18",
            checkpointKey: "checkpoint::closeout-resolution",
            resumeToken: "checkpoint::closeout-resolution",
            nextAction: "No further close-thread follow-through remains open on this resolution.",
            sourcePage: "/meetings/meeting_18",
            timestamp: new Date("2026-04-12T15:13:00.000Z"),
          },
        ],
      }),
    );

    expect(contract.closeoutResolutionFollowThrough.state).toBe("resolved");
    expect(contract.closeoutResolutionFollowThrough.resolutionEventId).toBe(
      "closeout_resolution_followthrough_resolved_18",
    );
    expect(contract.closeoutOutcome.state).toBe("close_pending");
    expect(contract.closeoutOutcome.decision).toBe("close_thread");
    expect(contract.closeRequest.state).toBe("requestable");
    expect(contract.closeLifecycle.state).toBe("close_requestable");
    expect(contract.closeLifecycle.driver).toBe("close_request");
    expect(contract.closeControl.state).toBe("close_requestable");
    expect(contract.closeControl.driver).toBe("close_lifecycle");
    expect(contract.closeControlFlow.state).toBe("close_requestable");
    expect(contract.closeControlFlow.driver).toBe("close_control");
    expect(contract.closeDecisionFlow.state).toBe("close_requestable");
    expect(contract.closeDecisionFlow.driver).toBe("close_request");
    expect(contract.closeDecisionControlSummary.state).toBe("close_requestable");
    expect(contract.closeDecisionControlSummary.driver).toBe("close_decision_flow");
    expect(contract.closeResolutionSummary.state).toBe("ready_to_request_close");
    expect(contract.closeResolutionSummary.driver).toBe("close_request");
    expect(contract.closeResolutionForwardSummary.state).toBe("ready_to_request_close");
    expect(contract.closeResolutionForwardSummary.driver).toBe("close_resolution_summary");
    expect(contract.closeResolutionControlSummary.state).toBe("ready_to_request_close");
    expect(contract.closeResolutionControlSummary.driver).toBe("close_resolution_summary");
    expect(contract.closePostureSummary.state).toBe("close_ready");
    expect(contract.closePostureSummary.driver).toBe("close_resolution_control_summary");
    expect(contract.closePostureForwardSummary.state).toBe("close_ready");
    expect(contract.closePostureForwardSummary.driver).toBe("close_posture_summary");
    expect(contract.closeRequest.requestEventId).toBeNull();
    expect(contract.closeRequest.nextAction).toContain("Request explicit runtime close");
    expect(contract.closeoutFlow.state).toBe("resolved");
    expect(contract.closeoutFlow.resolvedCount).toBe(2);
    expect(contract.settlementFlow.state).toBe("ready_to_close");
    expect(contract.lifecycleLog[0]?.kind).toBe("closeout_resolution_followthrough_resolved");
  });

  it("opens a typed close request seam once a bounded close request is recorded", () => {
    const contract = buildRunThreadContract(
      buildCloseoutResolutionContractInput({
        closeoutResolutionEntries: [
          {
            id: "closeout_resolution_18_close_request",
            kind: "closeout_resolution_recorded",
            decision: "close_thread",
            summary: "Explicit close-thread resolution recorded for checkpoint::closeout-resolution.",
            actorName: "operator@demo.com",
            closeoutConfirmationEventId: "closeout_confirmation_18",
            closeoutRefreshEventId: null,
            checkpointId: "checkpoint_18",
            checkpointKey: "checkpoint::closeout-resolution",
            resumeToken: "checkpoint::closeout-resolution",
            nextAction:
              "Close the runtime session only when a separate bounded operator action explicitly executes the close.",
            sourcePage: "/meetings/meeting_18",
            timestamp: new Date("2026-04-12T15:11:00.000Z"),
          },
        ],
        closeoutResolutionFollowThroughEntries: [
          {
            id: "closeout_resolution_followthrough_request_18_close_request",
            kind: "closeout_resolution_followthrough_requested",
            decision: "close_thread",
            summary: "Close-thread follow-through requested for checkpoint::closeout-resolution.",
            actorName: "operator@demo.com",
            closeoutResolutionEventId: "closeout_resolution_18_close_request",
            checkpointId: "checkpoint_18",
            checkpointKey: "checkpoint::closeout-resolution",
            resumeToken: "checkpoint::closeout-resolution",
            nextAction:
              "Resolve the explicit close-thread follow-through before the thread is treated as lifecycle-settled.",
            sourcePage: "/meetings/meeting_18",
            timestamp: new Date("2026-04-12T15:12:00.000Z"),
          },
          {
            id: "closeout_resolution_followthrough_resolved_18_close_request",
            kind: "closeout_resolution_followthrough_resolved",
            decision: "close_thread",
            summary: "Close-thread follow-through resolved for checkpoint::closeout-resolution.",
            actorName: "reviewer@demo.com",
            requestEventId: "closeout_resolution_followthrough_request_18_close_request",
            closeoutResolutionEventId: "closeout_resolution_18_close_request",
            checkpointId: "checkpoint_18",
            checkpointKey: "checkpoint::closeout-resolution",
            resumeToken: "checkpoint::closeout-resolution",
            nextAction: "No further close-thread follow-through remains open on this resolution.",
            sourcePage: "/meetings/meeting_18",
            timestamp: new Date("2026-04-12T15:13:00.000Z"),
          },
        ],
        closeRequestEntries: [
          {
            id: "close_request_18_open",
            kind: "close_request_requested",
            summary: "Explicit runtime close requested for checkpoint::closeout-resolution.",
            actorName: "operator@demo.com",
            closeoutResolutionEventId: "closeout_resolution_18_close_request",
            closeoutResolutionFollowThroughEventId:
              "closeout_resolution_followthrough_resolved_18_close_request",
            checkpointId: "checkpoint_18",
            checkpointKey: "checkpoint::closeout-resolution",
            resumeToken: "checkpoint::closeout-resolution",
            nextAction: "Close the runtime session only through a separate bounded close path.",
            sourcePage: "/meetings/meeting_18",
            timestamp: new Date("2026-04-12T15:14:00.000Z"),
          },
        ],
      }),
    );

    expect(contract.closeRequest.state).toBe("open");
    expect(contract.closeLifecycle.state).toBe("close_requested");
    expect(contract.closeLifecycle.driver).toBe("close_request");
    expect(contract.closeControl.state).toBe("close_requested");
    expect(contract.closeControl.driver).toBe("close_lifecycle");
    expect(contract.closeControlFlow.state).toBe("close_requested");
    expect(contract.closeControlFlow.driver).toBe("close_control");
    expect(contract.closeDecisionFlow.state).toBe("close_requested");
    expect(contract.closeDecisionFlow.driver).toBe("close_request");
    expect(contract.closeDecisionControlSummary.state).toBe("close_requested");
    expect(contract.closeDecisionControlSummary.driver).toBe("close_decision_flow");
    expect(contract.closeResolutionSummary.state).toBe("close_requested");
    expect(contract.closeResolutionSummary.driver).toBe("close_request");
    expect(contract.closeResolutionForwardSummary.state).toBe("close_requested");
    expect(contract.closeResolutionForwardSummary.driver).toBe("close_resolution_summary");
    expect(contract.closeResolutionControlSummary.state).toBe("close_requested");
    expect(contract.closeResolutionControlSummary.driver).toBe("close_resolution_summary");
    expect(contract.closePostureSummary.state).toBe("close_pending");
    expect(contract.closePostureSummary.driver).toBe("close_resolution_control_summary");
    expect(contract.closePostureForwardSummary.state).toBe("close_pending");
    expect(contract.closePostureForwardSummary.driver).toBe("close_posture_summary");
    expect(contract.closeRequest.requestEventId).toBe("close_request_18_open");
    expect(contract.closeoutFlow.state).toBe("open");
    expect(contract.closeoutFlow.latestSource).toBe("close_request");
    expect(contract.settlementFlow.state).toBe("closeout_open");
    expect(contract.lifecycleLog[0]?.kind).toBe("close_request_requested");
  });

  it("marks closeout outcome as kept-open once keep-open follow-through is resolved", () => {
    const contract = buildRunThreadContract(
      buildCloseoutResolutionContractInput({
        closeoutResolutionEntries: [
          {
            id: "closeout_resolution_18_keep_open_resolved",
            kind: "closeout_resolution_recorded",
            decision: "keep_open",
            summary: "Explicit keep-open resolution recorded for checkpoint::closeout-resolution.",
            actorName: "operator@demo.com",
            closeoutConfirmationEventId: "closeout_confirmation_18",
            closeoutRefreshEventId: null,
            checkpointId: "checkpoint_18",
            checkpointKey: "checkpoint::closeout-resolution",
            resumeToken: "checkpoint::closeout-resolution",
            nextAction:
              "Keep the thread open until a newer closeout truth justifies a different explicit decision.",
            sourcePage: "/meetings/meeting_18",
            timestamp: new Date("2026-04-12T15:11:00.000Z"),
          },
        ],
        closeoutResolutionFollowThroughEntries: [
          {
            id: "closeout_resolution_followthrough_request_18_keep_open",
            kind: "closeout_resolution_followthrough_requested",
            decision: "keep_open",
            summary: "Keep-open follow-through requested for checkpoint::closeout-resolution.",
            actorName: "operator@demo.com",
            closeoutResolutionEventId: "closeout_resolution_18_keep_open_resolved",
            checkpointId: "checkpoint_18",
            checkpointKey: "checkpoint::closeout-resolution",
            resumeToken: "checkpoint::closeout-resolution",
            nextAction:
              "Resolve the explicit keep-open follow-through before the thread is treated as current keep-open truth.",
            sourcePage: "/meetings/meeting_18",
            timestamp: new Date("2026-04-12T15:12:00.000Z"),
          },
          {
            id: "closeout_resolution_followthrough_resolved_18_keep_open",
            kind: "closeout_resolution_followthrough_resolved",
            decision: "keep_open",
            summary: "Keep-open follow-through resolved for checkpoint::closeout-resolution.",
            actorName: "reviewer@demo.com",
            requestEventId: "closeout_resolution_followthrough_request_18_keep_open",
            closeoutResolutionEventId: "closeout_resolution_18_keep_open_resolved",
            checkpointId: "checkpoint_18",
            checkpointKey: "checkpoint::closeout-resolution",
            resumeToken: "checkpoint::closeout-resolution",
            nextAction: "No further keep-open follow-through remains open on this resolution.",
            sourcePage: "/meetings/meeting_18",
            timestamp: new Date("2026-04-12T15:13:00.000Z"),
          },
        ],
      }),
    );

    expect(contract.closeoutResolutionFollowThrough.state).toBe("resolved");
    expect(contract.closeoutOutcome.state).toBe("kept_open");
    expect(contract.closeLifecycle.state).toBe("kept_open");
    expect(contract.closeLifecycle.driver).toBe("closeout_outcome");
    expect(contract.closeControl.state).toBe("kept_open");
    expect(contract.closeControl.driver).toBe("close_lifecycle");
    expect(contract.closeControlFlow.state).toBe("kept_open");
    expect(contract.closeControlFlow.driver).toBe("close_control");
    expect(contract.closeDecisionFlow.state).toBe("kept_open");
    expect(contract.closeDecisionFlow.driver).toBe("closeout_outcome");
    expect(contract.closeDecisionControlSummary.state).toBe("kept_open");
    expect(contract.closeDecisionControlSummary.driver).toBe("close_decision_flow");
    expect(contract.closeResolutionSummary.state).toBe("kept_open");
    expect(contract.closeResolutionSummary.driver).toBe("close_decision_control_summary");
    expect(contract.closeResolutionForwardSummary.state).toBe("kept_open");
    expect(contract.closeResolutionForwardSummary.driver).toBe("close_resolution_summary");
    expect(contract.closeResolutionControlSummary.state).toBe("kept_open");
    expect(contract.closeResolutionControlSummary.driver).toBe("close_resolution_summary");
    expect(contract.closePostureSummary.state).toBe("kept_open");
    expect(contract.closePostureSummary.driver).toBe("close_resolution_control_summary");
    expect(contract.closePostureForwardSummary.state).toBe("kept_open");
    expect(contract.closePostureForwardSummary.driver).toBe("close_posture_summary");
    expect(contract.closeoutOutcome.decision).toBe("keep_open");
    expect(contract.closeoutOutcome.nextAction).toContain("Keep the thread open");
  });

  it("marks closeout resolution follow-through as stale when closeout truth reopens", () => {
    const contract = buildRunThreadContract(
      buildCloseoutResolutionContractInput({
        updatedAt: new Date("2026-04-12T15:24:00.000Z"),
        closeoutResolutionEntries: [
          {
            id: "closeout_resolution_18_followthrough_stale",
            kind: "closeout_resolution_recorded",
            decision: "close_thread",
            summary: "Explicit close-thread resolution recorded for checkpoint::closeout-resolution.",
            actorName: "operator@demo.com",
            closeoutConfirmationEventId: "closeout_confirmation_18",
            closeoutRefreshEventId: null,
            checkpointId: "checkpoint_18",
            checkpointKey: "checkpoint::closeout-resolution",
            resumeToken: "checkpoint::closeout-resolution",
            nextAction:
              "Close the runtime session only when a separate bounded operator action explicitly executes the close.",
            sourcePage: "/meetings/meeting_18",
            timestamp: new Date("2026-04-12T15:11:00.000Z"),
          },
        ],
        closeoutResolutionFollowThroughEntries: [
          {
            id: "closeout_resolution_followthrough_request_18_stale",
            kind: "closeout_resolution_followthrough_requested",
            decision: "close_thread",
            summary: "Close-thread follow-through requested for checkpoint::closeout-resolution.",
            actorName: "operator@demo.com",
            closeoutResolutionEventId: "closeout_resolution_18_followthrough_stale",
            checkpointId: "checkpoint_18",
            checkpointKey: "checkpoint::closeout-resolution",
            resumeToken: "checkpoint::closeout-resolution",
            nextAction:
              "Resolve the explicit close-thread follow-through before the thread is treated as lifecycle-settled.",
            sourcePage: "/meetings/meeting_18",
            timestamp: new Date("2026-04-12T15:12:00.000Z"),
          },
        ],
        closeRequestEntries: [
          {
            id: "close_request_18_stale",
            kind: "close_request_requested",
            summary: "Explicit runtime close requested for checkpoint::closeout-resolution.",
            actorName: "operator@demo.com",
            closeoutResolutionEventId: "closeout_resolution_18_followthrough_stale",
            closeoutResolutionFollowThroughEventId: null,
            checkpointId: "checkpoint_18",
            checkpointKey: "checkpoint::closeout-resolution",
            resumeToken: "checkpoint::closeout-resolution",
            nextAction: "Close the runtime session only through a separate bounded close path.",
            sourcePage: "/meetings/meeting_18",
            timestamp: new Date("2026-04-12T15:13:00.000Z"),
          },
        ],
        closeoutRefreshEntries: [
          {
            id: "closeout_refresh_request_18_followthrough_stale",
            kind: "closeout_refresh_requested",
            summary: "Closeout refresh requested for checkpoint::closeout-resolution.",
            actorName: "operator@demo.com",
            confirmationEventId: "closeout_confirmation_18",
            checkpointId: "checkpoint_18",
            checkpointKey: "checkpoint::closeout-resolution",
            resumeToken: "checkpoint::closeout-resolution",
            nextAction: "Reconfirm the thread-level closeout truth after stale closeout summary is refreshed.",
            sourcePage: "/meetings/meeting_18",
            timestamp: new Date("2026-04-12T15:18:00.000Z"),
          },
        ],
      }),
    );

    expect(contract.closeoutRefresh.state).toBe("open");
    expect(contract.closeoutResolution.state).toBe("stale");
    expect(contract.closeoutResolutionFollowThrough.state).toBe("stale");
    expect(contract.closeoutOutcome.state).toBe("stale");
    expect(contract.closeRequest.state).toBe("stale");
    expect(contract.closeLifecycle.state).toBe("stale");
    expect(contract.closeLifecycle.driver).toBe("close_request");
    expect(contract.closeControl.state).toBe("stale");
    expect(contract.closeControl.driver).toBe("close_lifecycle");
    expect(contract.closeControlFlow.state).toBe("stale");
    expect(contract.closeControlFlow.driver).toBe("close_control");
    expect(contract.closeDecisionFlow.state).toBe("stale");
    expect(contract.closeDecisionFlow.driver).toBe("close_request");
    expect(contract.closeDecisionControlSummary.state).toBe("stale");
    expect(contract.closeDecisionControlSummary.driver).toBe("close_decision_flow");
    expect(contract.closeResolutionSummary.state).toBe("stale");
    expect(contract.closeResolutionSummary.driver).toBe("close_decision_control_summary");
    expect(contract.closeResolutionForwardSummary.state).toBe("stale");
    expect(contract.closeResolutionForwardSummary.driver).toBe("close_resolution_summary");
    expect(contract.closeResolutionControlSummary.state).toBe("stale");
    expect(contract.closeResolutionControlSummary.driver).toBe("close_resolution_forward_summary");
    expect(contract.closePostureSummary.state).toBe("stale");
    expect(contract.closePostureSummary.driver).toBe("close_resolution_control_summary");
    expect(contract.closePostureForwardSummary.state).toBe("stale");
    expect(contract.closePostureForwardSummary.driver).toBe("close_posture_summary");
    expect(contract.closeoutResolutionFollowThrough.nextAction).toContain("Reconfirm");
  });

  it("marks closeout outcome as closed only when lifecycle close matches a resolved close-thread decision", () => {
    const contract = buildRunThreadContract(
      buildCloseoutResolutionContractInput({
        status: "COMPLETED",
        updatedAt: new Date("2026-04-12T15:14:30.000Z"),
        closedAt: new Date("2026-04-12T15:14:30.000Z"),
        closeoutResolutionEntries: [
          {
            id: "closeout_resolution_18_closed",
            kind: "closeout_resolution_recorded",
            decision: "close_thread",
            summary: "Explicit close-thread resolution recorded for checkpoint::closeout-resolution.",
            actorName: "operator@demo.com",
            closeoutConfirmationEventId: "closeout_confirmation_18",
            closeoutRefreshEventId: null,
            checkpointId: "checkpoint_18",
            checkpointKey: "checkpoint::closeout-resolution",
            resumeToken: "checkpoint::closeout-resolution",
            nextAction:
              "Close the runtime session only when a separate bounded operator action explicitly executes the close.",
            sourcePage: "/meetings/meeting_18",
            timestamp: new Date("2026-04-12T15:11:00.000Z"),
          },
        ],
        closeoutResolutionFollowThroughEntries: [
          {
            id: "closeout_resolution_followthrough_request_18_closed",
            kind: "closeout_resolution_followthrough_requested",
            decision: "close_thread",
            summary: "Close-thread follow-through requested for checkpoint::closeout-resolution.",
            actorName: "operator@demo.com",
            closeoutResolutionEventId: "closeout_resolution_18_closed",
            checkpointId: "checkpoint_18",
            checkpointKey: "checkpoint::closeout-resolution",
            resumeToken: "checkpoint::closeout-resolution",
            nextAction:
              "Resolve the explicit close-thread follow-through before the thread is treated as lifecycle-settled.",
            sourcePage: "/meetings/meeting_18",
            timestamp: new Date("2026-04-12T15:12:00.000Z"),
          },
          {
            id: "closeout_resolution_followthrough_resolved_18_closed",
            kind: "closeout_resolution_followthrough_resolved",
            decision: "close_thread",
            summary: "Close-thread follow-through resolved for checkpoint::closeout-resolution.",
            actorName: "reviewer@demo.com",
            requestEventId: "closeout_resolution_followthrough_request_18_closed",
            closeoutResolutionEventId: "closeout_resolution_18_closed",
            checkpointId: "checkpoint_18",
            checkpointKey: "checkpoint::closeout-resolution",
            resumeToken: "checkpoint::closeout-resolution",
            nextAction: "No further close-thread follow-through remains open on this resolution.",
            sourcePage: "/meetings/meeting_18",
            timestamp: new Date("2026-04-12T15:13:00.000Z"),
          },
        ],
        closeRequestEntries: [
          {
            id: "close_request_18_closed",
            kind: "close_request_requested",
            summary: "Explicit runtime close requested for checkpoint::closeout-resolution.",
            actorName: "operator@demo.com",
            closeoutResolutionEventId: "closeout_resolution_18_closed",
            closeoutResolutionFollowThroughEventId:
              "closeout_resolution_followthrough_resolved_18_closed",
            checkpointId: "checkpoint_18",
            checkpointKey: "checkpoint::closeout-resolution",
            resumeToken: "checkpoint::closeout-resolution",
            nextAction: "Close the runtime session only through a separate bounded close path.",
            sourcePage: "/meetings/meeting_18",
            timestamp: new Date("2026-04-12T15:14:00.000Z"),
          },
        ],
      }),
    );

    expect(contract.lifecycle).toBe("closed");
    expect(contract.closeoutOutcome.state).toBe("closed");
    expect(contract.closeoutOutcome.decision).toBe("close_thread");
    expect(contract.closeoutOutcome.closedAt?.toISOString()).toBe("2026-04-12T15:14:30.000Z");
    expect(contract.closeRequest.state).toBe("resolved");
    expect(contract.closeLifecycle.state).toBe("closed");
    expect(contract.closeLifecycle.driver).toBe("close_request");
    expect(contract.closeControl.state).toBe("closed");
    expect(contract.closeControl.driver).toBe("lifecycle");
    expect(contract.closeDecisionControlSummary.state).toBe("closed");
    expect(contract.closeDecisionControlSummary.driver).toBe("close_decision_flow");
    expect(contract.closeResolutionSummary.state).toBe("closed");
    expect(contract.closeResolutionSummary.driver).toBe("lifecycle");
    expect(contract.closeResolutionForwardSummary.state).toBe("closed");
    expect(contract.closeResolutionForwardSummary.driver).toBe("lifecycle");
    expect(contract.closeResolutionControlSummary.state).toBe("closed");
    expect(contract.closeResolutionControlSummary.driver).toBe("lifecycle");
    expect(contract.closePostureSummary.state).toBe("closed");
    expect(contract.closePostureSummary.driver).toBe("lifecycle");
    expect(contract.closePostureForwardSummary.state).toBe("closed");
    expect(contract.closePostureForwardSummary.driver).toBe("lifecycle");
    expect(contract.closeRequest.resolvedAt?.toISOString()).toBe("2026-04-12T15:14:30.000Z");
  });

  it("marks closeout outcome as mismatch when lifecycle close conflicts with explicit keep-open truth", () => {
    const contract = buildRunThreadContract(
      buildCloseoutResolutionContractInput({
        status: "COMPLETED",
        updatedAt: new Date("2026-04-12T15:14:30.000Z"),
        closedAt: new Date("2026-04-12T15:14:30.000Z"),
        closeoutResolutionEntries: [
          {
            id: "closeout_resolution_18_mismatch",
            kind: "closeout_resolution_recorded",
            decision: "keep_open",
            summary: "Explicit keep-open resolution recorded for checkpoint::closeout-resolution.",
            actorName: "operator@demo.com",
            closeoutConfirmationEventId: "closeout_confirmation_18",
            closeoutRefreshEventId: null,
            checkpointId: "checkpoint_18",
            checkpointKey: "checkpoint::closeout-resolution",
            resumeToken: "checkpoint::closeout-resolution",
            nextAction:
              "Keep the thread open until a newer closeout truth justifies a different explicit decision.",
            sourcePage: "/meetings/meeting_18",
            timestamp: new Date("2026-04-12T15:11:00.000Z"),
          },
        ],
        closeoutResolutionFollowThroughEntries: [
          {
            id: "closeout_resolution_followthrough_request_18_mismatch",
            kind: "closeout_resolution_followthrough_requested",
            decision: "keep_open",
            summary: "Keep-open follow-through requested for checkpoint::closeout-resolution.",
            actorName: "operator@demo.com",
            closeoutResolutionEventId: "closeout_resolution_18_mismatch",
            checkpointId: "checkpoint_18",
            checkpointKey: "checkpoint::closeout-resolution",
            resumeToken: "checkpoint::closeout-resolution",
            nextAction:
              "Resolve the explicit keep-open follow-through before the thread is treated as current keep-open truth.",
            sourcePage: "/meetings/meeting_18",
            timestamp: new Date("2026-04-12T15:12:00.000Z"),
          },
          {
            id: "closeout_resolution_followthrough_resolved_18_mismatch",
            kind: "closeout_resolution_followthrough_resolved",
            decision: "keep_open",
            summary: "Keep-open follow-through resolved for checkpoint::closeout-resolution.",
            actorName: "reviewer@demo.com",
            requestEventId: "closeout_resolution_followthrough_request_18_mismatch",
            closeoutResolutionEventId: "closeout_resolution_18_mismatch",
            checkpointId: "checkpoint_18",
            checkpointKey: "checkpoint::closeout-resolution",
            resumeToken: "checkpoint::closeout-resolution",
            nextAction: "No further keep-open follow-through remains open on this resolution.",
            sourcePage: "/meetings/meeting_18",
            timestamp: new Date("2026-04-12T15:13:00.000Z"),
          },
        ],
      }),
    );

    expect(contract.lifecycle).toBe("closed");
    expect(contract.closeoutOutcome.state).toBe("mismatch");
    expect(contract.closeoutOutcome.decision).toBe("keep_open");
    expect(contract.closeoutOutcome.nextAction).toContain("Reconcile lifecycle close");
  });

  it("derives a review-first swarm verification merge lane from adoption, verification, and disagreement truth", () => {
    const baseInput: Parameters<typeof buildRunThreadContract>[0] = {
      id: "session_swarm_merge_lane",
      workspaceId: "workspace_swarm",
      sessionKey: "session::swarm-merge-lane",
      status: "ACTIVE",
      currentStage: "review_confirmed",
      sourcePage: "/operating",
      boundaryNote: "Review-first runtime only.",
      meetingId: "meeting_swarm",
      companyId: "company_swarm",
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
    };

    const mergeable = buildRunThreadContract({
      ...baseInput,
      verification: {
        status: "passed",
        blockedReasons: [],
        summary: "Verification passed with no open blocker.",
      },
    });
    expect(mergeable.swarmReadOnlyWorkerContract.resultAdoptionResultSideContract.state).toBe(
      "output_ready",
    );
    expect(mergeable.swarmVerificationMergeLaneContract.state).toBe("recordable");
    expect(mergeable.swarmVerificationMergeLaneContract.driver).toBe("mergeable");
    expect(mergeable.swarmVerificationMergeLaneContract.mergeLaneTruth).toBe("mergeable");
    expect(mergeable.swarmVerificationMergeLaneContract.verificationStatus).toBe("passed");
    expect(mergeable.swarmVerificationMergeLaneContract.recordEventId).toBeNull();
    expect(mergeable.swarmVerificationMergeLaneContract.nextAction).toContain(
      "Record the merge lane explicitly",
    );

    const reworkRequired = buildRunThreadContract({
      ...baseInput,
      verification: {
        status: "blocked",
        blockedReasons: ["Evidence still conflicts with the operator brief."],
        summary: "Verification is blocked by unresolved evidence drift.",
      },
    });
    expect(reworkRequired.swarmVerificationMergeLaneContract.state).toBe("recordable");
    expect(reworkRequired.swarmVerificationMergeLaneContract.driver).toBe("rework_required");
    expect(reworkRequired.swarmVerificationMergeLaneContract.mergeLaneTruth).toBe(
      "rework_required",
    );
    expect(reworkRequired.swarmVerificationMergeLaneContract.disagreementSummary).toContain(
      "Evidence still conflicts",
    );

    const humanReviewRequired = buildRunThreadContract({
      ...baseInput,
      verification: {
        status: "passed",
        blockedReasons: [],
        summary: "Verification passed, but disagreement trace is still open.",
      },
      truthConflicts: [
        {
          status: "open",
          summary: "Champion owner differs across verified sources.",
        },
      ],
    });
    expect(humanReviewRequired.swarmVerificationMergeLaneContract.state).toBe("recordable");
    expect(humanReviewRequired.swarmVerificationMergeLaneContract.driver).toBe(
      "human_review_required",
    );
    expect(humanReviewRequired.swarmVerificationMergeLaneContract.mergeLaneTruth).toBe(
      "human_review_required",
    );
    expect(humanReviewRequired.swarmVerificationMergeLaneContract.disagreementSummary).toContain(
      "Champion owner differs",
    );
    expect(humanReviewRequired.swarmVerificationMergeLaneContract.arbiterReference).toBe(
      "explicit human review lane",
    );

    const recorded = buildRunThreadContract({
      ...baseInput,
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
    expect(recorded.swarmVerificationMergeLaneContract.state).toBe("recorded");
    expect(recorded.swarmVerificationMergeLaneContract.driver).toBe("recorded");
    expect(recorded.swarmVerificationMergeLaneContract.recordEventId).toBe("swarm_merge_lane_1");
    expect(recorded.swarmVerificationMergeLaneContract.recordedBy).toBe("founder@demo.com");
    expect(recorded.swarmVerificationMergeLaneContract.sourcePage).toBe("/operating");
    expect(recorded.swarmVerificationMergeLaneContract.summary).toContain(
      "merge lane recorded",
    );
  });
});
