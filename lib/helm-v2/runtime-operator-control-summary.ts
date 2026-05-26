import type {
  HelmV21BenchmarkExecutionWorkflowReadModel,
  HelmV21BenchmarkMatrixReadModel,
  HelmV21EnvironmentContractReadModel,
  HelmV21RuntimeOperatorControlSummary,
} from "@/lib/helm-v2/contracts";

const RUNTIME_OPERATOR_CONTROL_SUMMARY_BOUNDARY_NOTE =
  "Operator control summary stays read-only, review-first, and boundary-first. It compresses environment execution truth and benchmark workflow truth into one operator-facing posture without widening execution authority or creating a workflow engine.";

function pickLatestDate(...values: Array<Date | null | undefined>) {
  return values.reduce<Date | null>((latest, current) => {
    if (!current) return latest;
    if (!latest || current.getTime() > latest.getTime()) return current;
    return latest;
  }, null);
}

function buildExecutionFocus(input: {
  latestSummary: string | null;
  latestUpdatedAt: Date | null;
}) {
  if (!input.latestSummary || !input.latestUpdatedAt) {
    return {
      title: null,
      href: null,
      updatedAt: null,
    };
  }

  return {
    title: input.latestSummary,
    href: "/operating",
    updatedAt: input.latestUpdatedAt,
  };
}

function buildBenchmarkFocus(input: { workflow: HelmV21BenchmarkExecutionWorkflowReadModel }) {
  if (input.workflow.followThrough.state !== "not_requested" && input.workflow.followThrough.requestedAt) {
    return {
      title: input.workflow.followThrough.runLabel ?? input.workflow.followThrough.summary,
      href: input.workflow.followThrough.sourcePage ?? "/operating",
      updatedAt: input.workflow.followThrough.resolvedAt ?? input.workflow.followThrough.requestedAt,
    };
  }

  if (input.workflow.acknowledgement.state !== "not_available" && input.workflow.acknowledgement.recordedAt) {
    return {
      title:
        input.workflow.acknowledgement.runLabel ?? input.workflow.acknowledgement.summary,
      href:
        input.workflow.acknowledgement.sourcePage ??
        input.workflow.latestRun.sourcePage ??
        "/operating",
      updatedAt:
        input.workflow.acknowledgement.acknowledgedAt ?? input.workflow.acknowledgement.recordedAt,
    };
  }

  if (input.workflow.latestRun.state === "recorded" && input.workflow.latestRun.recordedAt) {
    return {
      title: input.workflow.latestRun.runLabel ?? input.workflow.latestRun.summary,
      href: input.workflow.latestRun.sourcePage ?? "/operating",
      updatedAt: input.workflow.latestRun.recordedAt,
    };
  }

  if (input.workflow.request.state !== "not_requested" && input.workflow.request.requestedAt) {
    return {
      title: input.workflow.request.summary,
      href: input.workflow.request.sourcePage ?? "/operating",
      updatedAt: input.workflow.request.requestedAt,
    };
  }

  return {
    title: null,
    href: null,
    updatedAt: null,
  };
}

function pickFocus(input: {
  executionFocus: ReturnType<typeof buildExecutionFocus>;
  benchmarkFocus: ReturnType<typeof buildBenchmarkFocus>;
}) {
  if (
    input.executionFocus.updatedAt &&
    (!input.benchmarkFocus.updatedAt ||
      input.executionFocus.updatedAt.getTime() >= input.benchmarkFocus.updatedAt.getTime())
  ) {
    return {
      focusTitle: input.executionFocus.title,
      focusHref: input.executionFocus.href,
    };
  }

  return {
    focusTitle: input.benchmarkFocus.title,
    focusHref: input.benchmarkFocus.href,
  };
}

export function buildRuntimeOperatorControlSummary(input: {
  environmentContract: HelmV21EnvironmentContractReadModel;
  benchmarkMatrix: HelmV21BenchmarkMatrixReadModel;
}): HelmV21RuntimeOperatorControlSummary {
  const authority = input.environmentContract.executionAuthority;
  const executionSeam = input.environmentContract.executionSeam;
  const workflow = input.benchmarkMatrix.workflow;
  const counts = {
    pendingExecutionWrites: executionSeam.counts.officialWritesPending,
    openExecutionFollowThrough: executionSeam.counts.followThroughOpen,
    benchmarkPendingRequests: workflow.pendingRequestCount,
    benchmarkRecordedGates: input.benchmarkMatrix.summary.recordedGates,
    benchmarkWarningGates: input.benchmarkMatrix.summary.warningGates,
    benchmarkFailingGates: input.benchmarkMatrix.summary.failingGates,
    benchmarkAcknowledgedRuns: workflow.acknowledgedRunCount,
  };
  const latestUpdatedAt = pickLatestDate(
    executionSeam.latestUpdatedAt,
    workflow.latestRequestedAt,
    workflow.latestRecordedAt,
    workflow.latestAcknowledgedAt,
    workflow.latestFollowThroughAt,
    input.benchmarkMatrix.summary.latestRecordedAt,
  );
  const executionFocus = buildExecutionFocus({
    latestSummary: executionSeam.latestSummary,
    latestUpdatedAt: executionSeam.latestUpdatedAt,
  });
  const benchmarkFocus = buildBenchmarkFocus({ workflow });
  const steadyStateFocus = pickFocus({
    executionFocus,
    benchmarkFocus,
  });

  if (executionSeam.posture === "follow_through_open") {
    return {
      state: "execution_follow_through",
      driver: "environment_execution",
      authorityPosture: authority.posture,
      executionSeamPosture: executionSeam.posture,
      benchmarkWorkflowState: workflow.state,
      benchmarkFollowThroughState: workflow.followThrough.state,
      focusTitle: executionFocus.title,
      focusHref: executionFocus.href,
      summary: `Environment execution still has open follow-through. Authority posture remains ${authority.posture}, and benchmark workflow is ${workflow.state}.`,
      nextAction:
        executionSeam.latestSummary ??
        "Resolve the visible official follow-through before treating operator control as settled.",
      latestUpdatedAt,
      boundaryNote: RUNTIME_OPERATOR_CONTROL_SUMMARY_BOUNDARY_NOTE,
      counts,
    };
  }

  if (executionSeam.posture === "awaiting_acknowledgement") {
    return {
      state: "execution_pending",
      driver: "environment_execution",
      authorityPosture: authority.posture,
      executionSeamPosture: executionSeam.posture,
      benchmarkWorkflowState: workflow.state,
      benchmarkFollowThroughState: workflow.followThrough.state,
      focusTitle: executionFocus.title,
      focusHref: executionFocus.href,
      summary: `Environment execution is waiting on acknowledgement. Authority posture remains ${authority.posture}, and benchmark workflow is ${workflow.state}.`,
      nextAction:
        "Acknowledge the visible guarded write or limited-auto result before moving the operator control flow forward.",
      latestUpdatedAt,
      boundaryNote: RUNTIME_OPERATOR_CONTROL_SUMMARY_BOUNDARY_NOTE,
      counts,
    };
  }

  if (executionSeam.posture === "failed" || executionSeam.posture === "deferred") {
    return {
      state: "execution_review",
      driver: "environment_execution",
      authorityPosture: authority.posture,
      executionSeamPosture: executionSeam.posture,
      benchmarkWorkflowState: workflow.state,
      benchmarkFollowThroughState: workflow.followThrough.state,
      focusTitle: executionFocus.title,
      focusHref: executionFocus.href,
      summary: `Environment execution currently needs explicit review (${executionSeam.posture}). Authority posture remains ${authority.posture}, and benchmark workflow is ${workflow.state}.`,
      nextAction:
        executionSeam.posture === "failed"
          ? "Review the failed guarded write or limited-auto outcome before taking the next control step."
          : "Resolve the deferred execution note before treating operator control as settled.",
      latestUpdatedAt,
      boundaryNote: RUNTIME_OPERATOR_CONTROL_SUMMARY_BOUNDARY_NOTE,
      counts,
    };
  }

  if (workflow.state === "follow_through_open") {
    return {
      state: "benchmark_follow_through",
      driver: "benchmark_workflow",
      authorityPosture: authority.posture,
      executionSeamPosture: executionSeam.posture,
      benchmarkWorkflowState: workflow.state,
      benchmarkFollowThroughState: workflow.followThrough.state,
      focusTitle: benchmarkFocus.title,
      focusHref: benchmarkFocus.href,
      summary: `Benchmark workflow still has open follow-through. Execution seam is ${executionSeam.posture}, and authority posture is ${authority.posture}.`,
      nextAction:
        workflow.followThrough.nextAction ??
        "Resolve benchmark follow-through before treating this substrate slice as settled.",
      latestUpdatedAt,
      boundaryNote: RUNTIME_OPERATOR_CONTROL_SUMMARY_BOUNDARY_NOTE,
      counts,
    };
  }

  if (workflow.state === "requested") {
    return {
      state: "benchmark_requested",
      driver: "benchmark_workflow",
      authorityPosture: authority.posture,
      executionSeamPosture: executionSeam.posture,
      benchmarkWorkflowState: workflow.state,
      benchmarkFollowThroughState: workflow.followThrough.state,
      focusTitle: benchmarkFocus.title,
      focusHref: benchmarkFocus.href,
      summary: `Benchmark workflow has a pending rerun request. Execution seam is ${executionSeam.posture}, and authority posture is ${authority.posture}.`,
      nextAction:
        "Run the requested benchmark gates and record the evidence before continuing operator control review.",
      latestUpdatedAt,
      boundaryNote: RUNTIME_OPERATOR_CONTROL_SUMMARY_BOUNDARY_NOTE,
      counts,
    };
  }

  if (workflow.state === "recorded") {
    return {
      state: "benchmark_review",
      driver: "benchmark_workflow",
      authorityPosture: authority.posture,
      executionSeamPosture: executionSeam.posture,
      benchmarkWorkflowState: workflow.state,
      benchmarkFollowThroughState: workflow.followThrough.state,
      focusTitle: benchmarkFocus.title,
      focusHref: benchmarkFocus.href,
      summary: `Benchmark evidence is recorded but not yet acknowledged. Execution seam is ${executionSeam.posture}, and authority posture is ${authority.posture}.`,
      nextAction:
        "Review and acknowledge the latest benchmark evidence before treating this substrate slice as settled.",
      latestUpdatedAt,
      boundaryNote: RUNTIME_OPERATOR_CONTROL_SUMMARY_BOUNDARY_NOTE,
      counts,
    };
  }

  if (
    authority.posture === "boundary_only" &&
    executionSeam.posture === "boundary_only" &&
    workflow.state === "idle" &&
    input.benchmarkMatrix.summary.recordedGates === 0
  ) {
    return {
      state: "boundary_only",
      driver: "environment_authority",
      authorityPosture: authority.posture,
      executionSeamPosture: executionSeam.posture,
      benchmarkWorkflowState: workflow.state,
      benchmarkFollowThroughState: workflow.followThrough.state,
      focusTitle: null,
      focusHref: null,
      summary:
        "Environment authority is still boundary-only, no execution seam is active, and no benchmark evidence is visible yet.",
      nextAction:
        "Connect the required environment seams or keep this runtime slice on manual, review-first operator handling.",
      latestUpdatedAt,
      boundaryNote: RUNTIME_OPERATOR_CONTROL_SUMMARY_BOUNDARY_NOTE,
      counts,
    };
  }

  let nextAction: string | null = "No open execution or benchmark blocker is visible. Keep the runtime review-gated.";
  if (input.benchmarkMatrix.summary.recordedGates === 0) {
    nextAction =
      "No benchmark evidence is visible yet. Keep this substrate slice review-gated until a benchmark run is recorded.";
  } else if (input.benchmarkMatrix.summary.failingGates > 0) {
    nextAction =
      "Latest benchmark evidence still contains failing gates. Keep operator review explicit before treating this slice as settled.";
  } else if (input.benchmarkMatrix.summary.warningGates > 0) {
    nextAction =
      "Latest benchmark evidence still contains warning gates. Keep operator review explicit and confirm whether the warning is acceptable.";
  } else if (authority.posture === "narrow_limited_auto") {
    nextAction =
      "Narrow limited-auto eligibility is visible, but authority remains bounded and review-first.";
  }

  return {
    state: "review_gated",
    driver: "steady_state",
    authorityPosture: authority.posture,
    executionSeamPosture: executionSeam.posture,
    benchmarkWorkflowState: workflow.state,
    benchmarkFollowThroughState: workflow.followThrough.state,
    focusTitle: steadyStateFocus.focusTitle,
    focusHref: steadyStateFocus.focusHref,
    summary: `Operator control remains review-gated. Execution seam is ${executionSeam.posture}, authority posture is ${authority.posture}, and benchmark workflow is ${workflow.state}.`,
    nextAction,
    latestUpdatedAt,
    boundaryNote: RUNTIME_OPERATOR_CONTROL_SUMMARY_BOUNDARY_NOTE,
    counts,
  };
}
