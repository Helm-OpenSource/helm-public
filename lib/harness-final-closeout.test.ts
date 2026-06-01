import { describe, expect, it } from "vitest";
import {
  buildHarnessFinalCloseoutSummary,
  buildRuntimeServerSeamReadout,
  buildSandboxRoadmapReadout,
  buildSwarmIsolationPlanGateReadout,
} from "@/lib/harness-final-closeout";

describe("harness final closeout", () => {
  it("allows only read-only swarm work when isolation, ledger, mailbox, and plan gate are present", () => {
    const readout = buildSwarmIsolationPlanGateReadout({
      taskKey: "swarm::grep::checkpoint-1",
      generatedAt: "2026-04-24T00:00:00.000Z",
      workerRole: "evidence_reader",
      requestedEffect: "read_only",
      isolation: {
        stateRef: "worktree:agent-a",
        writeScope: [],
        sharedMutableState: false,
      },
      taskLedger: {
        ledgerRef: "ledger:swarm-1",
        entries: [
          {
            entryKey: "task",
            state: "planned",
            summary: "Read bounded evidence and return typed findings.",
          },
        ],
      },
      mailbox: {
        handoffRef: "mailbox:swarm-1",
        pendingHandoffs: 0,
        unresolvedConflicts: 0,
      },
      planGate: {
        planRef: "plan:swarm-1",
        beforeWriteReviewRequired: true,
        approvedForWrite: false,
        plannedWrites: [],
      },
      cleanup: {
        cleanupPolicyRef: "cleanup:delete-worktree",
        resumePolicyRef: "resume:checkpoint",
      },
    });

    expect(readout.posture).toBe("ready");
    expect(readout.primaryReasonCode).toBe("ready_for_read_only_swarm");
    expect(readout.planGate.beforeWritePlanGate).toBe("review_required_before_write");
    expect(readout.sourceChain.map((step) => step.step)).toEqual([
      "isolation_state",
      "task_ledger",
      "mailbox_handoff",
      "before_write_plan_gate",
      "authority_boundary",
    ]);
    expect(readout.boundaryNotes).toContain(
      "swarm isolation readout does not spawn agents, orchestrate UI, grant write authority, or merge outputs",
    );
  });

  it("blocks swarm work when isolation is missing or a write is requested without approval", () => {
    const readout = buildSwarmIsolationPlanGateReadout({
      taskKey: "swarm::writer::checkpoint-1",
      workerRole: "patch_writer",
      requestedEffect: "write_candidate",
      isolation: {
        stateRef: null,
        writeScope: ["lib/example.ts"],
        sharedMutableState: true,
      },
      taskLedger: {
        ledgerRef: null,
        entries: [],
      },
      mailbox: {
        handoffRef: null,
        pendingHandoffs: 1,
        unresolvedConflicts: 1,
      },
      planGate: {
        planRef: null,
        beforeWriteReviewRequired: true,
        approvedForWrite: false,
        plannedWrites: ["lib/example.ts"],
      },
      cleanup: {
        cleanupPolicyRef: null,
        resumePolicyRef: null,
      },
    });

    expect(readout.posture).toBe("blocked");
    expect(readout.primaryReasonCode).toBe("isolation_missing");
    expect(readout.planGate.writeAuthority).toBe("blocked");
    expect(readout.operatorNextMove).toContain("Establish isolated execution state");
  });

  it("summarizes a runtime server seam without creating a server process", () => {
    const readout = buildRuntimeServerSeamReadout({
      seamKey: "runtime-seam:operating",
      generatedAt: "2026-04-24T00:00:00.000Z",
      surfaces: ["/operating", "operator_panel", "automation", "extension_runtime"],
      lifecycleRefs: ["run-thread:lifecycle"],
      reviewRequestRefs: ["review:request"],
      acknowledgementRefs: ["ack:official-action"],
      recommendationTraceRefs: ["trace:recommendation"],
      memoryTraceRefs: ["trace:memory"],
      monitorEventRefs: ["monitor:event"],
      handoffRefs: ["handoff:closeout"],
    });

    expect(readout.posture).toBe("ready_for_contract");
    expect(readout.primaryReasonCode).toBe("shared_runtime_seam_ready");
    expect(readout.sharedSeam.surfaceCount).toBe(4);
    expect(readout.boundaryNotes).toContain(
      "runtime server seam readout does not create a server process, background worker, remote execution plane, or new control plane",
    );
  });

  it("keeps sandbox roadmap honest when no real sandbox exists", () => {
    const readout = buildSandboxRoadmapReadout({
      roadmapKey: "sandbox-roadmap:harness",
      generatedAt: "2026-04-24T00:00:00.000Z",
      realSandboxAvailable: false,
      runtimeTargets: ["plugin_runtime", "extension_runtime", "automation", "swarm"],
      shortTermControls: ["permission prompt", "review gate", "dry run"],
      midTermControls: ["worker process isolation", "environment hardening"],
      longTermControls: ["filesystem sandbox", "network sandbox"],
    });

    expect(readout.posture).toBe("deferred_boundary");
    expect(readout.autonomyCeiling).toBe("read_only_or_review_first");
    expect(readout.primaryReasonCode).toBe("real_sandbox_missing");
    expect(readout.boundaryNotes).toContain(
      "sandbox roadmap is a boundary contract; it does not claim real filesystem, network, process, or tenant runtime isolation",
    );
  });

  it("aggregates final closeout status across swarm, runtime seam, and sandbox roadmap", () => {
    const swarm = buildSwarmIsolationPlanGateReadout({
      taskKey: "swarm::grep::checkpoint-1",
      workerRole: "evidence_reader",
      requestedEffect: "read_only",
      isolation: { stateRef: "worktree:agent-a", writeScope: [], sharedMutableState: false },
      taskLedger: {
        ledgerRef: "ledger:swarm-1",
        entries: [{ entryKey: "task", state: "planned", summary: "Read evidence." }],
      },
      mailbox: { handoffRef: "mailbox:swarm-1", pendingHandoffs: 0, unresolvedConflicts: 0 },
      planGate: {
        planRef: "plan:swarm-1",
        beforeWriteReviewRequired: true,
        approvedForWrite: false,
        plannedWrites: [],
      },
      cleanup: { cleanupPolicyRef: "cleanup", resumePolicyRef: "resume" },
    });
    const runtime = buildRuntimeServerSeamReadout({
      seamKey: "runtime-seam:operating",
      surfaces: ["/operating"],
      lifecycleRefs: ["run-thread:lifecycle"],
      reviewRequestRefs: ["review:request"],
      acknowledgementRefs: ["ack:official-action"],
      recommendationTraceRefs: [],
      memoryTraceRefs: ["trace:memory"],
      monitorEventRefs: ["monitor:event"],
      handoffRefs: ["handoff:closeout"],
    });
    const sandbox = buildSandboxRoadmapReadout({
      roadmapKey: "sandbox-roadmap:harness",
      realSandboxAvailable: false,
      runtimeTargets: ["plugin_runtime"],
      shortTermControls: ["review gate"],
      midTermControls: ["worker process isolation"],
      longTermControls: ["filesystem sandbox"],
    });

    const summary = buildHarnessFinalCloseoutSummary({
      generatedAt: "2026-04-24T00:00:00.000Z",
      swarmReadouts: [swarm],
      runtimeSeams: [runtime],
      sandboxRoadmaps: [sandbox],
    });

    expect(summary.totalReadouts).toBe(3);
    expect(summary.completedGapKeys).toEqual([
      "swarm_isolation_task_ledger_plan_gate",
      "runtime_server_app_server_seam",
      "sandbox_roadmap_boundary",
    ]);
    expect(summary.harnessStage).toBe("read_only_harness_gap_complete");
    expect(summary.remainingBoundaries).toContain("plugin runtime still has no real sandbox");
  });
});
