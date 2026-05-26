import type {
  HelmV21HumanInputCheckpointRequestState,
  HelmV21InterruptReasonState,
  HelmV21OperatorDebuggerTakeoverActivationState,
  HelmV21OperatorDebuggerTakeoverFollowThroughState,
  HelmV21OperatorDebuggerTakeoverRequestState,
  HelmV21ResumeAskMode,
  HelmV21RunThreadCloseRequestState,
  HelmV21RunThreadHumanInputCheckpointState,
  HelmV21RunThreadResumeState,
  HelmV21RunThreadSwarmSpawnBudgetEnvelope,
  HelmV21RunThreadSwarmSpawnDenyReason,
  HelmV21RuntimeSwarmOperatorControl,
  HelmV21RuntimeSwarmOperatorControlActionIntent,
  HelmV21RuntimeSwarmOperatorControlBridge,
  HelmV21RuntimeSwarmOperatorControlState,
  HelmV21RuntimeSwarmOperatorControlSurface,
  HelmV21RuntimeSwarmOperatorControlSurfaceDriver,
  HelmV21RuntimeSwarmOperatorControlSurfaceState,
} from "@/lib/helm-v2/contracts";

const SWARM_OPERATOR_CONTROL_SURFACE_BOUNDARY_NOTE =
  "SWARM-004 stays /operating-only, bounded, and review-first. It only fronts pause, resume, kill, and fallback through existing checkpoint, close, and takeover seams without creating a new orchestration plane.";

const PAUSE_BOUNDARY_NOTE =
  "Pause bridges to a human input checkpoint request. It does not suspend a process scheduler or create a broader runtime stop lane.";

const RESUME_BOUNDARY_NOTE =
  "Resume bridges to checkpoint resume. It only reopens from the visible checkpoint anchor and does not create a new replay or repair lane.";

const KILL_BOUNDARY_NOTE =
  "Kill bridges to close request. It is not a process kill, worker kill, or broader execution-plane termination.";

const FALLBACK_BOUNDARY_NOTE =
  "Fallback bridges to operator takeover lifecycle. It is a bounded human-control fallback path, not a native single-agent orchestration plane.";

type SwarmOperatorControlSurfaceItem = {
  id: string;
  meetingId: string | null;
  title: string;
  href: string;
  updatedAt: Date;
  latestCheckpointId: string | null;
  latestCheckpointKey: string | null;
  resumeState: HelmV21RunThreadResumeState;
  resumeAskMode: HelmV21ResumeAskMode;
  interruptReasonState: HelmV21InterruptReasonState;
  recoveryState: "STABLE" | "RECOVERABLE" | "REVIEW_REQUIRED" | "BLOCKED";
  humanInputCheckpointState: HelmV21RunThreadHumanInputCheckpointState;
  humanInputCheckpointId: string | null;
  humanInputCheckpointKey: string | null;
  humanInputRequestState: HelmV21HumanInputCheckpointRequestState;
  closeRequestState: HelmV21RunThreadCloseRequestState;
  closeRequestCheckpointId: string | null;
  closeRequestCheckpointKey: string | null;
  takeoverRequestState: HelmV21OperatorDebuggerTakeoverRequestState;
  takeoverActivationState: HelmV21OperatorDebuggerTakeoverActivationState;
  takeoverFollowThroughState: HelmV21OperatorDebuggerTakeoverFollowThroughState;
  takeoverOwner: string | null;
  swarmBudgetPosture: HelmV21RunThreadSwarmSpawnBudgetEnvelope["budgetPosture"];
  swarmSpawnDenyReason: HelmV21RunThreadSwarmSpawnDenyReason | null;
  repeatPatternStatus:
    | "NONE"
    | "REPEATED_BLOCKED_ACTION"
    | "REPEATED_REVIEW_REQUIRED"
    | "REPEATED_REPRUNE_LOOP"
    | "REPEATED_INEFFECTIVE_ACTION";
};

type ControlBundle = {
  pause: HelmV21RuntimeSwarmOperatorControl;
  resume: HelmV21RuntimeSwarmOperatorControl;
  kill: HelmV21RuntimeSwarmOperatorControl;
  fallback: HelmV21RuntimeSwarmOperatorControl;
};

function buildUnavailableItem(): SwarmOperatorControlSurfaceItem {
  return {
    id: "none",
    meetingId: null,
    title: "none",
    href: "/operating",
    updatedAt: new Date(0),
    latestCheckpointId: null,
    latestCheckpointKey: null,
    resumeState: "not_available",
    resumeAskMode: "none",
    interruptReasonState: "clear",
    recoveryState: "STABLE",
    humanInputCheckpointState: "not_available",
    humanInputCheckpointId: null,
    humanInputCheckpointKey: null,
    humanInputRequestState: "not_requestable",
    closeRequestState: "not_available",
    closeRequestCheckpointId: null,
    closeRequestCheckpointKey: null,
    takeoverRequestState: "not_requestable",
    takeoverActivationState: "inactive",
    takeoverFollowThroughState: "not_requestable",
    takeoverOwner: null,
    swarmBudgetPosture: "SAFE",
    swarmSpawnDenyReason: null,
    repeatPatternStatus: "NONE",
  };
}

function buildControl(input: {
  state: HelmV21RuntimeSwarmOperatorControlState;
  bridge: HelmV21RuntimeSwarmOperatorControlBridge;
  actionIntent: HelmV21RuntimeSwarmOperatorControlActionIntent;
  actionLabel: string | null;
  summary: string;
  nextAction: string | null;
  boundaryNote: string;
  checkpointId?: string | null;
  checkpointKey?: string | null;
}): HelmV21RuntimeSwarmOperatorControl {
  return {
    state: input.state,
    bridge: input.bridge,
    actionIntent: input.actionIntent,
    actionLabel: input.actionLabel,
    summary: input.summary,
    nextAction: input.nextAction,
    boundaryNote: input.boundaryNote,
    checkpointId: input.checkpointId ?? null,
    checkpointKey: input.checkpointKey ?? null,
  };
}

function buildPauseControl(item: SwarmOperatorControlSurfaceItem) {
  if (item.humanInputRequestState === "requested" || item.humanInputRequestState === "acknowledged") {
    return buildControl({
      state: "requested",
      bridge: "human_input_checkpoint",
      actionIntent: "none",
      actionLabel: null,
      summary: `Pause is already being held through checkpoint ${item.humanInputCheckpointKey ?? "the current thread anchor"}.`,
      nextAction: "Resume from the recorded checkpoint when the operator is ready to continue.",
      boundaryNote: PAUSE_BOUNDARY_NOTE,
      checkpointId: item.humanInputCheckpointId,
      checkpointKey: item.humanInputCheckpointKey,
    });
  }

  if (item.humanInputRequestState === "requestable") {
    return buildControl({
      state: "requestable",
      bridge: "human_input_checkpoint",
      actionIntent: "request_pause",
      actionLabel: "Pause",
      summary: `Pause can be requested against checkpoint ${item.humanInputCheckpointKey ?? "the current thread anchor"}.`,
      nextAction: "Request a bounded human-input checkpoint hold before widening operator intervention.",
      boundaryNote: PAUSE_BOUNDARY_NOTE,
      checkpointId: item.humanInputCheckpointId,
      checkpointKey: item.humanInputCheckpointKey,
    });
  }

  return buildControl({
    state: "unavailable",
    bridge: "human_input_checkpoint",
    actionIntent: "none",
    actionLabel: null,
    summary:
      item.humanInputCheckpointState === "not_available"
        ? "Pause is unavailable because no checkpoint anchor is visible on this thread."
        : "Pause is not requestable on the current thread posture.",
    nextAction: "Wait for a checkpoint-backed hold seam before treating pause as available.",
    boundaryNote: PAUSE_BOUNDARY_NOTE,
    checkpointId: item.humanInputCheckpointId,
    checkpointKey: item.humanInputCheckpointKey,
  });
}

function shouldOfferResume(item: SwarmOperatorControlSurfaceItem) {
  return item.resumeState === "ready" && item.resumeAskMode === "resume_checkpoint";
}

function buildResumeControl(item: SwarmOperatorControlSurfaceItem) {
  if (item.resumeState === "resumed") {
    return buildControl({
      state: "resolved",
      bridge: "checkpoint_resume",
      actionIntent: "none",
      actionLabel: null,
      summary: `Resume already flowed through checkpoint ${item.latestCheckpointKey ?? "the current anchor"}.`,
      nextAction: "Keep later operator moves review-first after the resume bridge completed.",
      boundaryNote: RESUME_BOUNDARY_NOTE,
      checkpointId: item.latestCheckpointId,
      checkpointKey: item.latestCheckpointKey,
    });
  }

  if (shouldOfferResume(item)) {
    return buildControl({
      state: "ready",
      bridge: "checkpoint_resume",
      actionIntent: "resume_checkpoint",
      actionLabel: "Resume",
      summary: `Resume is ready from checkpoint ${item.latestCheckpointKey ?? "the current anchor"}.`,
      nextAction: "Resume from the latest checkpoint instead of widening into a broader recovery lane.",
      boundaryNote: RESUME_BOUNDARY_NOTE,
      checkpointId: item.latestCheckpointId,
      checkpointKey: item.latestCheckpointKey,
    });
  }

  return buildControl({
    state: "unavailable",
    bridge: "checkpoint_resume",
    actionIntent: "none",
    actionLabel: null,
    summary:
      item.resumeState === "ready"
        ? "Resume remains hidden because the current thread is not explicitly asking for checkpoint resume."
        : "Resume is unavailable because no checkpoint resume seam is currently visible.",
    nextAction:
      item.interruptReasonState === "clear" && item.recoveryState === "STABLE"
        ? "Keep the thread in steady-state review posture until a real resume ask appears."
        : "Wait for an explicit checkpoint-resume ask before treating resume as available.",
    boundaryNote: RESUME_BOUNDARY_NOTE,
    checkpointId: item.latestCheckpointId,
    checkpointKey: item.latestCheckpointKey,
  });
}

function buildKillControl(item: SwarmOperatorControlSurfaceItem) {
  if (item.closeRequestState === "open") {
    return buildControl({
      state: "requested",
      bridge: "close_request",
      actionIntent: "none",
      actionLabel: null,
      summary: `Kill is already bridged through an open close request on ${item.closeRequestCheckpointKey ?? "the current thread anchor"}.`,
      nextAction: "Resolve the open close request before treating kill as settled.",
      boundaryNote: KILL_BOUNDARY_NOTE,
      checkpointId: item.closeRequestCheckpointId,
      checkpointKey: item.closeRequestCheckpointKey,
    });
  }

  if (item.closeRequestState === "requestable") {
    return buildControl({
      state: "requestable",
      bridge: "close_request",
      actionIntent: "request_kill",
      actionLabel: "Kill (close request)",
      summary: "Kill can be requested through the bounded close-request seam.",
      nextAction: "Request close instead of assuming broader runtime termination authority.",
      boundaryNote: KILL_BOUNDARY_NOTE,
      checkpointId: item.closeRequestCheckpointId,
      checkpointKey: item.closeRequestCheckpointKey,
    });
  }

  if (item.closeRequestState === "resolved") {
    return buildControl({
      state: "resolved",
      bridge: "close_request",
      actionIntent: "none",
      actionLabel: null,
      summary: "Kill bridge is already resolved through close request.",
      nextAction: "Keep any later restart or follow-through review-first and explicit.",
      boundaryNote: KILL_BOUNDARY_NOTE,
      checkpointId: item.closeRequestCheckpointId,
      checkpointKey: item.closeRequestCheckpointKey,
    });
  }

  return buildControl({
    state: "unavailable",
    bridge: "close_request",
    actionIntent: "none",
    actionLabel: null,
    summary:
      item.closeRequestState === "mismatch" || item.closeRequestState === "stale"
        ? `Kill is unavailable because the close-request seam is ${item.closeRequestState}.`
        : "Kill is unavailable because no bounded close-request seam is open on this thread.",
    nextAction: "Wait for a requestable close seam instead of inventing a broader kill path.",
    boundaryNote: KILL_BOUNDARY_NOTE,
    checkpointId: item.closeRequestCheckpointId,
    checkpointKey: item.closeRequestCheckpointKey,
  });
}

function buildFallbackControl(item: SwarmOperatorControlSurfaceItem) {
  if (item.takeoverActivationState === "active") {
    return buildControl({
      state: "active",
      bridge: "operator_takeover",
      actionIntent: "release_fallback",
      actionLabel: "Release fallback",
      summary: `Fallback is active under ${item.takeoverOwner ?? "the current operator"} through bounded takeover control.`,
      nextAction: "Release fallback after the bounded human-control window is complete.",
      boundaryNote: FALLBACK_BOUNDARY_NOTE,
      checkpointId: item.latestCheckpointId,
      checkpointKey: item.latestCheckpointKey,
    });
  }

  if (item.takeoverRequestState === "acknowledged") {
    return buildControl({
      state: "requested",
      bridge: "operator_takeover",
      actionIntent: "start_fallback",
      actionLabel: "Start fallback",
      summary: "Fallback request is acknowledged and can now be started from /operating.",
      nextAction: "Start the bounded takeover bridge instead of widening into a new fallback plane.",
      boundaryNote: FALLBACK_BOUNDARY_NOTE,
      checkpointId: item.latestCheckpointId,
      checkpointKey: item.latestCheckpointKey,
    });
  }

  if (item.takeoverRequestState === "requested") {
    return buildControl({
      state: "requested",
      bridge: "operator_takeover",
      actionIntent: "none",
      actionLabel: null,
      summary: "Fallback request is open, but acknowledgement is still required before /operating can start it.",
      nextAction: "Acknowledge the bounded takeover request first; only acknowledged fallback can be started from /operating.",
      boundaryNote: FALLBACK_BOUNDARY_NOTE,
      checkpointId: item.latestCheckpointId,
      checkpointKey: item.latestCheckpointKey,
    });
  }

  if (item.takeoverRequestState === "requestable") {
    return buildControl({
      state: "requestable",
      bridge: "operator_takeover",
      actionIntent: "request_fallback",
      actionLabel: "Fallback",
      summary: "Fallback can be requested through the existing operator takeover seam.",
      nextAction: "Request bounded operator takeover if the thread needs explicit human fallback.",
      boundaryNote: FALLBACK_BOUNDARY_NOTE,
      checkpointId: item.latestCheckpointId,
      checkpointKey: item.latestCheckpointKey,
    });
  }

  if (
    item.takeoverActivationState === "released" ||
    item.takeoverFollowThroughState === "resolved"
  ) {
    return buildControl({
      state: "resolved",
      bridge: "operator_takeover",
      actionIntent: "none",
      actionLabel: null,
      summary: "Fallback already ran through the bounded takeover lifecycle and has been released.",
      nextAction: "Keep later recovery or close moves review-first after the fallback bridge resolved.",
      boundaryNote: FALLBACK_BOUNDARY_NOTE,
      checkpointId: item.latestCheckpointId,
      checkpointKey: item.latestCheckpointKey,
    });
  }

  return buildControl({
    state: "unavailable",
    bridge: "operator_takeover",
    actionIntent: "none",
    actionLabel: null,
    summary: "Fallback is unavailable because no bounded takeover seam is currently requestable.",
    nextAction: "Wait for a requestable takeover seam before treating fallback as available.",
    boundaryNote: FALLBACK_BOUNDARY_NOTE,
    checkpointId: item.latestCheckpointId,
    checkpointKey: item.latestCheckpointKey,
  });
}

function evaluateItemControls(item: SwarmOperatorControlSurfaceItem): ControlBundle {
  return {
    pause: buildPauseControl(item),
    resume: buildResumeControl(item),
    kill: buildKillControl(item),
    fallback: buildFallbackControl(item),
  };
}

function isActiveState(state: HelmV21RuntimeSwarmOperatorControlState) {
  return state === "requested" || state === "active";
}

function isReadyState(state: HelmV21RuntimeSwarmOperatorControlState) {
  return state === "requestable" || state === "ready";
}

function getDriverPriority(bundle: ControlBundle): {
  state: HelmV21RuntimeSwarmOperatorControlSurfaceState;
  driver: HelmV21RuntimeSwarmOperatorControlSurfaceDriver;
  score: number;
} {
  const candidates: Array<{
    state: HelmV21RuntimeSwarmOperatorControlSurfaceState;
    driver: HelmV21RuntimeSwarmOperatorControlSurfaceDriver;
    score: number;
    controlState: HelmV21RuntimeSwarmOperatorControlState;
  }> = [
    {
      state:
        bundle.fallback.state === "active"
          ? "control_active"
          : "control_ready",
      driver: "fallback",
      score:
        bundle.fallback.state === "active"
          ? 0
          : bundle.fallback.state === "requested" &&
              bundle.fallback.actionIntent === "start_fallback"
            ? 1
            : bundle.fallback.state === "requested"
              ? 6
              : bundle.fallback.state === "requestable"
                ? 7
                : Number.POSITIVE_INFINITY,
      controlState: bundle.fallback.state,
    },
    {
      state: "control_active",
      driver: "pause",
      score: bundle.pause.state === "requested" ? 2 : Number.POSITIVE_INFINITY,
      controlState: bundle.pause.state,
    },
    {
      state: "control_ready",
      driver: "resume",
      score: bundle.resume.state === "ready" ? 3 : Number.POSITIVE_INFINITY,
      controlState: bundle.resume.state,
    },
    {
      state: isActiveState(bundle.kill.state) ? "control_active" : "control_ready",
      driver: "kill",
      score:
        bundle.kill.state === "requested"
          ? 4
          : bundle.kill.state === "requestable"
            ? 8
            : Number.POSITIVE_INFINITY,
      controlState: bundle.kill.state,
    },
    {
      state: "control_ready",
      driver: "pause",
      score: bundle.pause.state === "requestable" ? 5 : Number.POSITIVE_INFINITY,
      controlState: bundle.pause.state,
    },
    {
      state: "control_ready",
      driver: "fallback",
      score:
        bundle.fallback.state === "requestable"
          ? 7
          : Number.POSITIVE_INFINITY,
      controlState: bundle.fallback.state,
    },
  ];
  const active = candidates.reduce<typeof candidates[number] | null>((best, candidate) => {
    if (candidate.score === Number.POSITIVE_INFINITY) {
      return best;
    }
    if (!best || candidate.score < best.score) {
      return candidate;
    }
    return best;
  }, null);
  return active
    ? {
        state: active.state,
        driver: active.driver,
        score: active.score,
      }
    : {
        state: "boundary_only",
        driver: "steady_state",
        score: Number.POSITIVE_INFINITY,
      };
}

function buildFocusSummary(input: {
  item: SwarmOperatorControlSurfaceItem;
  bundle: ControlBundle;
  driver: HelmV21RuntimeSwarmOperatorControlSurfaceDriver;
  state: HelmV21RuntimeSwarmOperatorControlSurfaceState;
}) {
  const control =
    input.driver === "pause"
      ? input.bundle.pause
      : input.driver === "resume"
        ? input.bundle.resume
        : input.driver === "kill"
          ? input.bundle.kill
          : input.driver === "fallback"
            ? input.bundle.fallback
            : null;

  if (!control) {
    return {
      summary:
        "No meeting-backed thread currently exposes an honest pause, resume, kill, or fallback bridge on /operating.",
      nextAction:
        "Keep SWARM-004 boundary-only until a checkpoint, close, or takeover seam becomes explicitly visible.",
    };
  }

  return {
    summary:
      input.state === "control_active"
        ? `${input.item.title} currently holds the bounded ${input.driver} bridge on /operating. Budget posture is ${input.item.swarmBudgetPosture}, repeated-denial posture is ${input.item.repeatPatternStatus}, and spawn deny reason is ${input.item.swarmSpawnDenyReason ?? "none"}.`
        : `${input.item.title} currently exposes a bounded ${input.driver} bridge on /operating. Pause maps to human input checkpoint, resume maps to checkpoint resume, kill maps to close request, and fallback maps to operator takeover.`,
    nextAction: control.nextAction,
  };
}

export function buildRuntimeSwarmOperatorControlSurface(input: {
  items: SwarmOperatorControlSurfaceItem[];
}): HelmV21RuntimeSwarmOperatorControlSurface {
  const evaluated = input.items.map((item) => {
    const bundle = evaluateItemControls(item);
    const priority = getDriverPriority(bundle);
    return {
      item,
      bundle,
      priority,
    };
  });
  const meetingBacked = evaluated.filter(({ item }) => Boolean(item.meetingId));

  const requestableThreads = meetingBacked.filter(
    ({ bundle }) =>
      isReadyState(bundle.pause.state) ||
      isReadyState(bundle.resume.state) ||
      isReadyState(bundle.kill.state) ||
      isReadyState(bundle.fallback.state),
  ).length;
  const activeThreads = meetingBacked.filter(
    ({ bundle }) =>
      isActiveState(bundle.pause.state) ||
      isActiveState(bundle.kill.state) ||
      bundle.fallback.state === "active",
  ).length;
  const boundaryOnlyThreads = meetingBacked.filter(
    ({ priority }) => priority.state === "boundary_only",
  ).length;

  const focus =
    meetingBacked
      .sort((left, right) => {
        if (left.priority.score !== right.priority.score) {
          return left.priority.score - right.priority.score;
        }
        return right.item.updatedAt.getTime() - left.item.updatedAt.getTime();
      })[0] ?? null;

  if (!focus || focus.priority.state === "boundary_only") {
    const unavailableItem = buildUnavailableItem();
    return {
      state: "boundary_only",
      driver: "steady_state",
      focusSessionId: focus?.item.id ?? null,
      focusMeetingId: focus?.item.meetingId ?? null,
      focusTitle: focus?.item.title ?? null,
      focusHref: focus?.item.href ?? "/operating",
      focusCheckpointKey: focus?.item.latestCheckpointKey ?? null,
      focusBudgetPosture: focus?.item.swarmBudgetPosture ?? null,
      focusSpawnDenyReason: focus?.item.swarmSpawnDenyReason ?? null,
      focusRepeatPatternStatus: focus?.item.repeatPatternStatus ?? null,
      summary:
        "No meeting-backed continuity thread currently exposes an honest pause, resume, kill, or fallback bridge on /operating.",
      nextAction:
        "Keep SWARM-004 boundary-only until checkpoint, close-request, or takeover seams become explicitly requestable.",
      latestUpdatedAt: focus?.item.updatedAt ?? null,
      boundaryNote: SWARM_OPERATOR_CONTROL_SURFACE_BOUNDARY_NOTE,
      counts: {
        requestableThreads,
        activeThreads,
        boundaryOnlyThreads,
      },
      controls: focus?.bundle ?? {
        pause: buildPauseControl(unavailableItem),
        resume: buildResumeControl(unavailableItem),
        kill: buildKillControl(unavailableItem),
        fallback: buildFallbackControl(unavailableItem),
      },
    };
  }

  const focusSummary = buildFocusSummary({
    item: focus.item,
    bundle: focus.bundle,
    driver: focus.priority.driver,
    state: focus.priority.state,
  });

  return {
    state: focus.priority.state,
    driver: focus.priority.driver,
    focusSessionId: focus.item.id,
    focusMeetingId: focus.item.meetingId,
    focusTitle: focus.item.title,
    focusHref: focus.item.href,
    focusCheckpointKey: focus.item.latestCheckpointKey,
    focusBudgetPosture: focus.item.swarmBudgetPosture,
    focusSpawnDenyReason: focus.item.swarmSpawnDenyReason,
    focusRepeatPatternStatus: focus.item.repeatPatternStatus,
    summary: focusSummary.summary,
    nextAction: focusSummary.nextAction,
    latestUpdatedAt: focus.item.updatedAt,
    boundaryNote: SWARM_OPERATOR_CONTROL_SURFACE_BOUNDARY_NOTE,
    counts: {
      requestableThreads,
      activeThreads,
      boundaryOnlyThreads,
    },
    controls: focus.bundle,
  };
}
