import { describe, expect, it } from "vitest";
import { buildRuntimeSwarmOperatorControlSurface } from "@/lib/helm-v2/swarm-operator-control-surface";

function buildItem(overrides: Partial<Parameters<typeof buildRuntimeSwarmOperatorControlSurface>[0]["items"][number]> = {}) {
  return {
    id: "session_1",
    meetingId: "meeting_1",
    title: "Customer restart review",
    href: "/meetings/meeting_1",
    updatedAt: new Date("2026-04-21T10:00:00.000Z"),
    latestCheckpointId: "checkpoint_1",
    latestCheckpointKey: "checkpoint::latest",
    resumeState: "not_available" as const,
    resumeAskMode: "none" as const,
    interruptReasonState: "attention" as const,
    recoveryState: "REVIEW_REQUIRED" as const,
    humanInputCheckpointState: "checkpoint_ready" as const,
    humanInputCheckpointId: "checkpoint_1",
    humanInputCheckpointKey: "checkpoint::latest",
    humanInputRequestState: "requestable" as const,
    closeRequestState: "requestable" as const,
    closeRequestCheckpointId: "checkpoint_1",
    closeRequestCheckpointKey: "checkpoint::latest",
    takeoverRequestState: "requestable" as const,
    takeoverActivationState: "inactive" as const,
    takeoverFollowThroughState: "not_requestable" as const,
    takeoverOwner: null,
    swarmBudgetPosture: "WATCH" as const,
    swarmSpawnDenyReason: null,
    repeatPatternStatus: "NONE" as const,
    ...overrides,
  };
}

describe("runtime swarm operator control surface", () => {
  it("stays boundary-only when no meeting-backed thread exposes an honest bridge", () => {
    const summary = buildRuntimeSwarmOperatorControlSurface({
      items: [
        buildItem({
          meetingId: null,
          humanInputRequestState: "not_requestable",
          closeRequestState: "not_available",
          takeoverRequestState: "not_requestable",
          resumeState: "not_available",
          resumeAskMode: "none",
        }),
      ],
    });

    expect(summary.state).toBe("boundary_only");
    expect(summary.driver).toBe("steady_state");
    expect(summary.controls.pause.state).toBe("unavailable");
    expect(summary.controls.resume.state).toBe("unavailable");
    expect(summary.controls.kill.state).toBe("unavailable");
    expect(summary.controls.fallback.state).toBe("unavailable");
  });

  it("surfaces pause as the first bounded bridge when human input checkpoint is requestable", () => {
    const summary = buildRuntimeSwarmOperatorControlSurface({
      items: [buildItem()],
    });

    expect(summary.state).toBe("control_ready");
    expect(summary.driver).toBe("pause");
    expect(summary.controls.pause.state).toBe("requestable");
    expect(summary.controls.pause.actionIntent).toBe("request_pause");
    expect(summary.controls.pause.checkpointKey).toBe("checkpoint::latest");
    expect(summary.focusBudgetPosture).toBe("WATCH");
  });

  it("only exposes resume when the thread is explicitly asking for checkpoint resume", () => {
    const hidden = buildRuntimeSwarmOperatorControlSurface({
      items: [
        buildItem({
          humanInputRequestState: "not_requestable",
          closeRequestState: "not_available",
          takeoverRequestState: "not_requestable",
          resumeState: "ready",
          resumeAskMode: "none",
        }),
      ],
    });

    expect(hidden.controls.resume.state).toBe("unavailable");

    const ready = buildRuntimeSwarmOperatorControlSurface({
      items: [
        buildItem({
          humanInputRequestState: "not_requestable",
          closeRequestState: "not_available",
          takeoverRequestState: "not_requestable",
          resumeState: "ready",
          resumeAskMode: "resume_checkpoint",
        }),
      ],
    });

    expect(ready.controls.resume.state).toBe("ready");
    expect(ready.controls.resume.actionIntent).toBe("resume_checkpoint");
  });

  it("keeps fallback honest across request, acknowledgement, and active lifecycle states", () => {
    const requested = buildRuntimeSwarmOperatorControlSurface({
      items: [
        buildItem({
          humanInputRequestState: "not_requestable",
          closeRequestState: "not_available",
          takeoverRequestState: "requested",
        }),
      ],
    });

    expect(requested.driver).toBe("fallback");
    expect(requested.controls.fallback.state).toBe("requested");
    expect(requested.controls.fallback.actionIntent).toBe("none");

    const acknowledged = buildRuntimeSwarmOperatorControlSurface({
      items: [
        buildItem({
          humanInputRequestState: "not_requestable",
          closeRequestState: "not_available",
          takeoverRequestState: "acknowledged",
        }),
      ],
    });

    expect(acknowledged.driver).toBe("fallback");
    expect(acknowledged.controls.fallback.state).toBe("requested");
    expect(acknowledged.controls.fallback.actionIntent).toBe("start_fallback");

    const active = buildRuntimeSwarmOperatorControlSurface({
      items: [
        buildItem({
          humanInputRequestState: "not_requestable",
          closeRequestState: "not_available",
          takeoverRequestState: "requested",
          takeoverActivationState: "active",
          takeoverOwner: "operator@demo.com",
        }),
      ],
    });

    expect(active.state).toBe("control_active");
    expect(active.controls.fallback.state).toBe("active");
    expect(active.controls.fallback.actionIntent).toBe("release_fallback");
  });

  it("counts only meeting-backed bridges in the operator-visible surface summary", () => {
    const summary = buildRuntimeSwarmOperatorControlSurface({
      items: [
        buildItem({
          meetingId: null,
        }),
        buildItem({
          id: "session_2",
          meetingId: "meeting_2",
          takeoverRequestState: "not_requestable",
          closeRequestState: "not_available",
          humanInputRequestState: "not_requestable",
        }),
      ],
    });

    expect(summary.counts.requestableThreads).toBe(0);
    expect(summary.counts.activeThreads).toBe(0);
    expect(summary.counts.boundaryOnlyThreads).toBe(1);
  });

  it("keeps kill as a close-request bridge instead of a native termination plane", () => {
    const summary = buildRuntimeSwarmOperatorControlSurface({
      items: [
        buildItem({
          humanInputRequestState: "not_requestable",
          closeRequestState: "open",
          takeoverRequestState: "not_requestable",
        }),
      ],
    });

    expect(summary.controls.kill.state).toBe("requested");
    expect(summary.controls.kill.bridge).toBe("close_request");
    expect(summary.controls.kill.actionIntent).toBe("none");
  });
});
