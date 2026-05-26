export type HarnessSourceOutcome = "pass" | "warn" | "block";

export type SwarmWorkerEffect = "read_only" | "write_candidate" | "official_write";
export type SwarmIsolationPosture = "ready" | "review_required" | "blocked";
export type SwarmIsolationReasonCode =
  | "ready_for_read_only_swarm"
  | "isolation_missing"
  | "task_ledger_missing"
  | "mailbox_conflict_open"
  | "plan_gate_review_required"
  | "write_authority_blocked";
export type SwarmIsolationSourceStepName =
  | "isolation_state"
  | "task_ledger"
  | "mailbox_handoff"
  | "before_write_plan_gate"
  | "authority_boundary";

export type SwarmTaskLedgerEntry = {
  entryKey: string;
  state: "planned" | "running" | "reported" | "blocked" | "closed";
  summary: string;
};

export type SwarmIsolationPlanGateInput = {
  taskKey: string;
  generatedAt?: Date | string;
  workerRole: string;
  requestedEffect: SwarmWorkerEffect;
  isolation: {
    stateRef: string | null;
    writeScope: string[];
    sharedMutableState: boolean;
  };
  taskLedger: {
    ledgerRef: string | null;
    entries: SwarmTaskLedgerEntry[];
  };
  mailbox: {
    handoffRef: string | null;
    pendingHandoffs: number;
    unresolvedConflicts: number;
  };
  planGate: {
    planRef: string | null;
    beforeWriteReviewRequired: boolean;
    approvedForWrite: boolean;
    plannedWrites: string[];
  };
  cleanup: {
    cleanupPolicyRef: string | null;
    resumePolicyRef: string | null;
  };
};

export type HarnessSourceStep<TStep extends string> = {
  step: TStep;
  sourceType: string;
  sourceRef: string | null;
  outcome: HarnessSourceOutcome;
  note: string;
};

export type SwarmIsolationPlanGateReadout = {
  readoutKey: string;
  generatedAt: string;
  posture: SwarmIsolationPosture;
  primaryReasonCode: SwarmIsolationReasonCode;
  worker: {
    role: string;
    requestedEffect: SwarmWorkerEffect;
    allowedEffect: "read_only" | "none";
    isolationStateRef: string | null;
    sharedMutableState: boolean;
  };
  taskLedger: {
    ledgerRef: string | null;
    totalEntries: number;
    openEntries: number;
    blockedEntries: number;
  };
  mailbox: {
    handoffRef: string | null;
    pendingHandoffs: number;
    unresolvedConflicts: number;
  };
  planGate: {
    planRef: string | null;
    beforeWritePlanGate: "review_required_before_write" | "missing";
    plannedWrites: string[];
    writeAuthority: "blocked" | "review_required" | "not_requested";
  };
  cleanup: {
    cleanupPolicyRef: string | null;
    resumePolicyRef: string | null;
    cleanupReady: boolean;
  };
  sourceChain: Array<HarnessSourceStep<SwarmIsolationSourceStepName>>;
  operatorNextMove: string;
  boundaryNotes: string[];
  audit: {
    emittedBy: "harness-swarm-isolation-plan-gate";
    replaySafe: true;
  };
};

export type RuntimeServerSeamPosture =
  | "ready_for_contract"
  | "needs_review_mapping"
  | "needs_ack_mapping"
  | "blocked";
export type RuntimeServerSeamReasonCode =
  | "shared_runtime_seam_ready"
  | "lifecycle_mapping_missing"
  | "review_mapping_missing"
  | "ack_mapping_missing"
  | "surface_mapping_missing";
export type RuntimeServerSeamSourceStepName =
  | "surface_entry"
  | "run_thread_lifecycle"
  | "review_gate"
  | "acknowledgement"
  | "trace_observability"
  | "authority_boundary";

export type RuntimeServerSeamInput = {
  seamKey: string;
  generatedAt?: Date | string;
  surfaces: string[];
  lifecycleRefs: string[];
  reviewRequestRefs: string[];
  acknowledgementRefs: string[];
  recommendationTraceRefs: string[];
  memoryTraceRefs: string[];
  monitorEventRefs: string[];
  handoffRefs: string[];
};

export type RuntimeServerSeamReadout = {
  readoutKey: string;
  generatedAt: string;
  posture: RuntimeServerSeamPosture;
  primaryReasonCode: RuntimeServerSeamReasonCode;
  sharedSeam: {
    seamKey: string;
    surfaceCount: number;
    surfaces: string[];
    lifecycleMapped: boolean;
    reviewMapped: boolean;
    acknowledgementMapped: boolean;
    traceMapped: boolean;
    handoffMapped: boolean;
  };
  sourceChain: Array<HarnessSourceStep<RuntimeServerSeamSourceStepName>>;
  operatorNextMove: string;
  boundaryNotes: string[];
  audit: {
    emittedBy: "harness-runtime-server-seam";
    replaySafe: true;
  };
};

export type SandboxRoadmapPosture =
  | "active_sandbox_available"
  | "deferred_boundary"
  | "roadmap_incomplete";
export type SandboxRoadmapReasonCode =
  | "real_sandbox_available"
  | "real_sandbox_missing"
  | "roadmap_controls_missing";
export type SandboxAutonomyCeiling =
  | "sandbox_backed_execution"
  | "read_only_or_review_first"
  | "blocked";
export type SandboxRoadmapSourceStepName =
  | "current_runtime_truth"
  | "short_term_controls"
  | "mid_term_controls"
  | "long_term_controls"
  | "authority_boundary";

export type SandboxRoadmapInput = {
  roadmapKey: string;
  generatedAt?: Date | string;
  realSandboxAvailable: boolean;
  runtimeTargets: string[];
  shortTermControls: string[];
  midTermControls: string[];
  longTermControls: string[];
};

export type SandboxRoadmapReadout = {
  readoutKey: string;
  generatedAt: string;
  posture: SandboxRoadmapPosture;
  primaryReasonCode: SandboxRoadmapReasonCode;
  autonomyCeiling: SandboxAutonomyCeiling;
  roadmap: {
    runtimeTargets: string[];
    shortTermControls: string[];
    midTermControls: string[];
    longTermControls: string[];
  };
  sourceChain: Array<HarnessSourceStep<SandboxRoadmapSourceStepName>>;
  operatorNextMove: string;
  boundaryNotes: string[];
  audit: {
    emittedBy: "harness-sandbox-roadmap";
    replaySafe: true;
  };
};

export type HarnessFinalCloseoutSummary = {
  generatedAt: string;
  harnessStage:
    | "read_only_harness_gap_complete"
    | "read_only_harness_gap_needs_review"
    | "read_only_harness_gap_blocked";
  totalReadouts: number;
  completedGapKeys: string[];
  reviewGapKeys: string[];
  blockedGapKeys: string[];
  primaryNextMove: string;
  remainingBoundaries: string[];
};

export function buildSwarmIsolationPlanGateReadout(
  input: SwarmIsolationPlanGateInput,
): SwarmIsolationPlanGateReadout {
  const generatedAt = toIsoString(input.generatedAt ?? new Date());
  const primaryReasonCode = resolveSwarmReasonCode(input);
  const posture = resolveSwarmPosture(primaryReasonCode);
  const writeRequested = input.requestedEffect !== "read_only" || input.planGate.plannedWrites.length > 0;
  const writeAuthority = resolveWriteAuthority(input);

  return {
    readoutKey: buildStableKey("swarm_isolation_plan_gate", input.taskKey),
    generatedAt,
    posture,
    primaryReasonCode,
    worker: {
      role: input.workerRole,
      requestedEffect: input.requestedEffect,
      allowedEffect: posture === "ready" ? "read_only" : "none",
      isolationStateRef: input.isolation.stateRef,
      sharedMutableState: input.isolation.sharedMutableState,
    },
    taskLedger: {
      ledgerRef: input.taskLedger.ledgerRef,
      totalEntries: input.taskLedger.entries.length,
      openEntries: input.taskLedger.entries.filter((entry) =>
        ["planned", "running", "reported"].includes(entry.state),
      ).length,
      blockedEntries: input.taskLedger.entries.filter((entry) => entry.state === "blocked").length,
    },
    mailbox: {
      handoffRef: input.mailbox.handoffRef,
      pendingHandoffs: input.mailbox.pendingHandoffs,
      unresolvedConflicts: input.mailbox.unresolvedConflicts,
    },
    planGate: {
      planRef: input.planGate.planRef,
      beforeWritePlanGate: input.planGate.beforeWriteReviewRequired
        ? "review_required_before_write"
        : "missing",
      plannedWrites: [...input.planGate.plannedWrites],
      writeAuthority,
    },
    cleanup: {
      cleanupPolicyRef: input.cleanup.cleanupPolicyRef,
      resumePolicyRef: input.cleanup.resumePolicyRef,
      cleanupReady: Boolean(input.cleanup.cleanupPolicyRef && input.cleanup.resumePolicyRef),
    },
    sourceChain: [
      buildSwarmIsolationStep(input),
      buildSwarmTaskLedgerStep(input),
      buildSwarmMailboxStep(input),
      buildSwarmPlanGateStep(input, writeRequested),
      {
        step: "authority_boundary",
        sourceType: "policy",
        sourceRef: "read_only_swarm_isolation_task_ledger_plan_gate",
        outcome: writeAuthority === "blocked" ? "block" : "pass",
        note: "Swarm substrate readout can explain isolation, ledger, handoff, and plan gate posture only; it does not spawn workers, grant write authority, merge outputs, or create a workflow engine.",
      },
    ],
    operatorNextMove: buildSwarmOperatorNextMove(primaryReasonCode),
    boundaryNotes: [
      "swarm isolation readout does not spawn agents, orchestrate UI, grant write authority, or merge outputs",
      "task ledger is audit/readout only and is not a workflow engine",
      "before-write plan gate keeps write attempts review-first and does not create broad auto-write authority",
      "cleanup/resume policy is a readiness marker, not a process supervisor",
    ],
    audit: {
      emittedBy: "harness-swarm-isolation-plan-gate",
      replaySafe: true,
    },
  };
}

export function buildRuntimeServerSeamReadout(
  input: RuntimeServerSeamInput,
): RuntimeServerSeamReadout {
  const generatedAt = toIsoString(input.generatedAt ?? new Date());
  const primaryReasonCode = resolveRuntimeReasonCode(input);
  const posture = resolveRuntimePosture(primaryReasonCode);
  const traceMapped =
    input.recommendationTraceRefs.length > 0 ||
    input.memoryTraceRefs.length > 0 ||
    input.monitorEventRefs.length > 0;

  return {
    readoutKey: buildStableKey("runtime_server_seam", input.seamKey),
    generatedAt,
    posture,
    primaryReasonCode,
    sharedSeam: {
      seamKey: input.seamKey,
      surfaceCount: input.surfaces.length,
      surfaces: uniqueStrings(input.surfaces),
      lifecycleMapped: input.lifecycleRefs.length > 0,
      reviewMapped: input.reviewRequestRefs.length > 0,
      acknowledgementMapped: input.acknowledgementRefs.length > 0,
      traceMapped,
      handoffMapped: input.handoffRefs.length > 0,
    },
    sourceChain: [
      buildRuntimeStep("surface_entry", "surface_registry", input.surfaces, "Surface entry refs"),
      buildRuntimeStep(
        "run_thread_lifecycle",
        "runtime_lifecycle",
        input.lifecycleRefs,
        "Run/thread lifecycle refs",
      ),
      buildRuntimeStep("review_gate", "review_request", input.reviewRequestRefs, "Review refs"),
      buildRuntimeStep(
        "acknowledgement",
        "official_action_ack",
        input.acknowledgementRefs,
        "Acknowledgement refs",
      ),
      buildRuntimeStep(
        "trace_observability",
        "trace_refs",
        [
          ...input.recommendationTraceRefs,
          ...input.memoryTraceRefs,
          ...input.monitorEventRefs,
          ...input.handoffRefs,
        ],
        "Recommendation, memory, monitor, and handoff refs",
      ),
      {
        step: "authority_boundary",
        sourceType: "policy",
        sourceRef: "read_only_runtime_server_app_server_seam",
        outcome: "pass",
        note: "Runtime seam readout unifies contract visibility only; it does not create a server process, app shell, remote execution plane, or new control plane.",
      },
    ],
    operatorNextMove: buildRuntimeOperatorNextMove(primaryReasonCode),
    boundaryNotes: [
      "runtime server seam readout does not create a server process, background worker, remote execution plane, or new control plane",
      "shared seam is contract-first and keeps /operating, automation, extension runtime, and future app shell from owning separate runtime logic",
      "official action acknowledgement remains review-first and does not imply official success without receipt truth",
    ],
    audit: {
      emittedBy: "harness-runtime-server-seam",
      replaySafe: true,
    },
  };
}

export function buildSandboxRoadmapReadout(
  input: SandboxRoadmapInput,
): SandboxRoadmapReadout {
  const generatedAt = toIsoString(input.generatedAt ?? new Date());
  const hasRoadmap =
    input.shortTermControls.length > 0 &&
    input.midTermControls.length > 0 &&
    input.longTermControls.length > 0;
  const primaryReasonCode = input.realSandboxAvailable
    ? "real_sandbox_available"
    : hasRoadmap
      ? "real_sandbox_missing"
      : "roadmap_controls_missing";
  const posture = resolveSandboxPosture(primaryReasonCode);
  const autonomyCeiling = resolveAutonomyCeiling(primaryReasonCode);

  return {
    readoutKey: buildStableKey("sandbox_roadmap", input.roadmapKey),
    generatedAt,
    posture,
    primaryReasonCode,
    autonomyCeiling,
    roadmap: {
      runtimeTargets: uniqueStrings(input.runtimeTargets),
      shortTermControls: uniqueStrings(input.shortTermControls),
      midTermControls: uniqueStrings(input.midTermControls),
      longTermControls: uniqueStrings(input.longTermControls),
    },
    sourceChain: [
      {
        step: "current_runtime_truth",
        sourceType: "runtime_boundary",
        sourceRef: input.realSandboxAvailable ? "real_sandbox_available" : "plugin_runtime_no_real_sandbox",
        outcome: input.realSandboxAvailable ? "pass" : "warn",
        note: input.realSandboxAvailable
          ? "Runtime declares a real sandbox boundary."
          : "Current plugin runtime still has no real sandbox; autonomy must stay capped.",
      },
      buildSandboxControlStep("short_term_controls", input.shortTermControls),
      buildSandboxControlStep("mid_term_controls", input.midTermControls),
      buildSandboxControlStep("long_term_controls", input.longTermControls),
      {
        step: "authority_boundary",
        sourceType: "policy",
        sourceRef: "sandbox_roadmap_boundary",
        outcome: input.realSandboxAvailable ? "pass" : "warn",
        note: "Sandbox roadmap records staged controls only and does not claim filesystem, network, process, or tenant isolation until a real sandbox exists.",
      },
    ],
    operatorNextMove:
      primaryReasonCode === "roadmap_controls_missing"
        ? "Complete short, mid, and long term sandbox controls before increasing autonomy."
        : primaryReasonCode === "real_sandbox_missing"
          ? "Keep extension, automation, and swarm autonomy capped at read-only or review-first until real sandbox controls exist."
          : "Sandbox-backed execution can be evaluated through a separate security review gate.",
    boundaryNotes: [
      "sandbox roadmap is a boundary contract; it does not claim real filesystem, network, process, or tenant runtime isolation",
      "without real sandbox, extension authority, automation authority, and swarm autonomy cannot expand beyond read-only or review-first",
      "sandbox rollout must stay separate from marketplace, payment, workflow engine, or broad auto-execution scope",
    ],
    audit: {
      emittedBy: "harness-sandbox-roadmap",
      replaySafe: true,
    },
  };
}

export function buildHarnessFinalCloseoutSummary(input: {
  generatedAt?: Date | string;
  swarmReadouts: SwarmIsolationPlanGateReadout[];
  runtimeSeams: RuntimeServerSeamReadout[];
  sandboxRoadmaps: SandboxRoadmapReadout[];
}): HarnessFinalCloseoutSummary {
  const blockedGapKeys: string[] = [];
  const reviewGapKeys: string[] = [];
  const completedGapKeys: string[] = [];

  const swarmComplete = input.swarmReadouts.some((readout) => readout.posture === "ready");
  const runtimeComplete = input.runtimeSeams.some(
    (readout) => readout.posture === "ready_for_contract",
  );
  const sandboxBoundaryComplete = input.sandboxRoadmaps.some(
    (readout) => readout.posture === "deferred_boundary" || readout.posture === "active_sandbox_available",
  );

  pushGapState({
    complete: swarmComplete,
    blocked: input.swarmReadouts.some((readout) => readout.posture === "blocked"),
    gapKey: "swarm_isolation_task_ledger_plan_gate",
    completedGapKeys,
    reviewGapKeys,
    blockedGapKeys,
  });
  pushGapState({
    complete: runtimeComplete,
    blocked: input.runtimeSeams.some((readout) => readout.posture === "blocked"),
    gapKey: "runtime_server_app_server_seam",
    completedGapKeys,
    reviewGapKeys,
    blockedGapKeys,
  });
  pushGapState({
    complete: sandboxBoundaryComplete,
    blocked: input.sandboxRoadmaps.some((readout) => readout.posture === "roadmap_incomplete"),
    gapKey: "sandbox_roadmap_boundary",
    completedGapKeys,
    reviewGapKeys,
    blockedGapKeys,
  });

  return {
    generatedAt: toIsoString(input.generatedAt ?? new Date()),
    harnessStage:
      blockedGapKeys.length > 0
        ? "read_only_harness_gap_blocked"
        : reviewGapKeys.length > 0
          ? "read_only_harness_gap_needs_review"
          : "read_only_harness_gap_complete",
    totalReadouts:
      input.swarmReadouts.length + input.runtimeSeams.length + input.sandboxRoadmaps.length,
    completedGapKeys,
    reviewGapKeys,
    blockedGapKeys,
    primaryNextMove:
      blockedGapKeys.length > 0
        ? `Resolve blocked harness gaps: ${blockedGapKeys.join(", ")}.`
        : reviewGapKeys.length > 0
          ? `Review incomplete harness gaps: ${reviewGapKeys.join(", ")}.`
          : "Harness gap sequence is complete at read-only substrate level; next stage requires explicit implementation approval.",
    remainingBoundaries: [
      "plugin runtime still has no real sandbox",
      "runtime server seam is contract/readout only and does not create a server process",
      "swarm isolation is read-only substrate and does not grant broad write or merge authority",
    ],
  };
}

function resolveSwarmReasonCode(
  input: SwarmIsolationPlanGateInput,
): SwarmIsolationReasonCode {
  if (!input.isolation.stateRef || input.isolation.sharedMutableState) {
    return "isolation_missing";
  }
  if (!input.taskLedger.ledgerRef || input.taskLedger.entries.length === 0) {
    return "task_ledger_missing";
  }
  if (!input.mailbox.handoffRef || input.mailbox.unresolvedConflicts > 0) {
    return "mailbox_conflict_open";
  }
  if (!input.planGate.beforeWriteReviewRequired || !input.planGate.planRef) {
    return "plan_gate_review_required";
  }
  if (input.requestedEffect !== "read_only" || input.planGate.plannedWrites.length > 0) {
    return input.planGate.approvedForWrite ? "plan_gate_review_required" : "write_authority_blocked";
  }
  return "ready_for_read_only_swarm";
}

function resolveSwarmPosture(reasonCode: SwarmIsolationReasonCode): SwarmIsolationPosture {
  if (reasonCode === "ready_for_read_only_swarm") {
    return "ready";
  }
  if (reasonCode === "plan_gate_review_required") {
    return "review_required";
  }
  return "blocked";
}

function resolveWriteAuthority(
  input: SwarmIsolationPlanGateInput,
): SwarmIsolationPlanGateReadout["planGate"]["writeAuthority"] {
  const writeRequested = input.requestedEffect !== "read_only" || input.planGate.plannedWrites.length > 0;
  if (!writeRequested) {
    return "not_requested";
  }
  return input.planGate.approvedForWrite ? "review_required" : "blocked";
}

function buildSwarmIsolationStep(
  input: SwarmIsolationPlanGateInput,
): HarnessSourceStep<SwarmIsolationSourceStepName> {
  const isolated = Boolean(input.isolation.stateRef) && !input.isolation.sharedMutableState;
  return {
    step: "isolation_state",
    sourceType: "isolated_execution_state",
    sourceRef: input.isolation.stateRef,
    outcome: isolated ? "pass" : "block",
    note: isolated
      ? "Worker has an isolated state reference and no shared mutable state."
      : "Worker isolation is missing or shared mutable state is still present.",
  };
}

function buildSwarmTaskLedgerStep(
  input: SwarmIsolationPlanGateInput,
): HarnessSourceStep<SwarmIsolationSourceStepName> {
  const hasLedger = Boolean(input.taskLedger.ledgerRef) && input.taskLedger.entries.length > 0;
  return {
    step: "task_ledger",
    sourceType: "task_ledger",
    sourceRef: input.taskLedger.ledgerRef,
    outcome: hasLedger ? "pass" : "block",
    note: hasLedger
      ? `Task ledger has ${input.taskLedger.entries.length} tracked entries.`
      : "Task ledger is missing; swarm work cannot be audited.",
  };
}

function buildSwarmMailboxStep(
  input: SwarmIsolationPlanGateInput,
): HarnessSourceStep<SwarmIsolationSourceStepName> {
  const ok = Boolean(input.mailbox.handoffRef) && input.mailbox.unresolvedConflicts === 0;
  return {
    step: "mailbox_handoff",
    sourceType: "mailbox_handoff",
    sourceRef: input.mailbox.handoffRef,
    outcome: ok ? "pass" : "block",
    note: ok
      ? "Mailbox/handoff bus is present and has no unresolved conflicts."
      : "Mailbox/handoff bus is missing or has unresolved conflicts.",
  };
}

function buildSwarmPlanGateStep(
  input: SwarmIsolationPlanGateInput,
  writeRequested: boolean,
): HarnessSourceStep<SwarmIsolationSourceStepName> {
  const gatePresent = Boolean(input.planGate.planRef) && input.planGate.beforeWriteReviewRequired;
  return {
    step: "before_write_plan_gate",
    sourceType: "plan_gate",
    sourceRef: input.planGate.planRef,
    outcome: !gatePresent || (writeRequested && !input.planGate.approvedForWrite) ? "block" : "pass",
    note: gatePresent
      ? "Before-write plan gate is present; write attempts remain review-first."
      : "Before-write plan gate is missing.",
  };
}

function buildSwarmOperatorNextMove(reasonCode: SwarmIsolationReasonCode) {
  switch (reasonCode) {
    case "ready_for_read_only_swarm":
      return "Proceed with read-only worker handoff; require explicit plan review before any write attempt.";
    case "isolation_missing":
      return "Establish isolated execution state before allowing swarm work.";
    case "task_ledger_missing":
      return "Create task ledger entry before worker handoff.";
    case "mailbox_conflict_open":
      return "Resolve mailbox handoff conflicts before continuing.";
    case "plan_gate_review_required":
      return "Route proposed writes through before-write plan review.";
    case "write_authority_blocked":
      return "Block write request; downgrade to read-only or obtain explicit review gate approval.";
  }
}

function resolveRuntimeReasonCode(input: RuntimeServerSeamInput): RuntimeServerSeamReasonCode {
  if (input.surfaces.length === 0) {
    return "surface_mapping_missing";
  }
  if (input.lifecycleRefs.length === 0) {
    return "lifecycle_mapping_missing";
  }
  if (input.reviewRequestRefs.length === 0) {
    return "review_mapping_missing";
  }
  if (input.acknowledgementRefs.length === 0) {
    return "ack_mapping_missing";
  }
  return "shared_runtime_seam_ready";
}

function resolveRuntimePosture(
  reasonCode: RuntimeServerSeamReasonCode,
): RuntimeServerSeamPosture {
  switch (reasonCode) {
    case "shared_runtime_seam_ready":
      return "ready_for_contract";
    case "review_mapping_missing":
      return "needs_review_mapping";
    case "ack_mapping_missing":
      return "needs_ack_mapping";
    case "surface_mapping_missing":
    case "lifecycle_mapping_missing":
      return "blocked";
  }
}

function buildRuntimeStep(
  step: RuntimeServerSeamSourceStepName,
  sourceType: string,
  refs: string[],
  label: string,
): HarnessSourceStep<RuntimeServerSeamSourceStepName> {
  return {
    step,
    sourceType,
    sourceRef: refs[0] ?? null,
    outcome: refs.length > 0 ? "pass" : "warn",
    note:
      refs.length > 0
        ? `${label} mapped through ${refs.length} refs.`
        : `${label} missing from runtime seam readout.`,
  };
}

function buildRuntimeOperatorNextMove(reasonCode: RuntimeServerSeamReasonCode) {
  switch (reasonCode) {
    case "shared_runtime_seam_ready":
      return "Keep runtime seam contract-first; do not create server process until implementation is separately approved.";
    case "surface_mapping_missing":
      return "Map at least one operating or automation surface before claiming a shared runtime seam.";
    case "lifecycle_mapping_missing":
      return "Map run/thread lifecycle before runtime seam adoption.";
    case "review_mapping_missing":
      return "Map review request handling before runtime seam adoption.";
    case "ack_mapping_missing":
      return "Map official-action acknowledgement before runtime seam adoption.";
  }
}

function resolveSandboxPosture(reasonCode: SandboxRoadmapReasonCode): SandboxRoadmapPosture {
  switch (reasonCode) {
    case "real_sandbox_available":
      return "active_sandbox_available";
    case "real_sandbox_missing":
      return "deferred_boundary";
    case "roadmap_controls_missing":
      return "roadmap_incomplete";
  }
}

function resolveAutonomyCeiling(reasonCode: SandboxRoadmapReasonCode): SandboxAutonomyCeiling {
  switch (reasonCode) {
    case "real_sandbox_available":
      return "sandbox_backed_execution";
    case "real_sandbox_missing":
      return "read_only_or_review_first";
    case "roadmap_controls_missing":
      return "blocked";
  }
}

function buildSandboxControlStep(
  step: SandboxRoadmapSourceStepName,
  controls: string[],
): HarnessSourceStep<SandboxRoadmapSourceStepName> {
  return {
    step,
    sourceType: "sandbox_control_stage",
    sourceRef: controls[0] ?? null,
    outcome: controls.length > 0 ? "pass" : "block",
    note:
      controls.length > 0
        ? `${controls.length} sandbox roadmap controls declared.`
        : "Sandbox roadmap controls are missing for this stage.",
  };
}

function pushGapState(input: {
  complete: boolean;
  blocked: boolean;
  gapKey: string;
  completedGapKeys: string[];
  reviewGapKeys: string[];
  blockedGapKeys: string[];
}) {
  if (input.complete) {
    input.completedGapKeys.push(input.gapKey);
    return;
  }
  if (input.blocked) {
    input.blockedGapKeys.push(input.gapKey);
    return;
  }
  input.reviewGapKeys.push(input.gapKey);
}

function buildStableKey(prefix: string, seed: string) {
  return `${prefix}:${seed.trim() || "unknown"}`;
}

function toIsoString(value: Date | string) {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return new Date(value).toISOString();
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}
