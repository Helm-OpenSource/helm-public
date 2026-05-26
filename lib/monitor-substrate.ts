export type MonitorSignalKind =
  | "connector_lag"
  | "webhook_failure"
  | "meeting_ingest_backlog"
  | "memory_sync_anomaly"
  | "settlement_exception"
  | "review_queue_drift";

export type MonitorSignalSeverity = "ok" | "watch" | "escalate" | "blocked";
export type MonitorOutputPosture =
  | "report_only"
  | "route_to_review"
  | "human_ack_required"
  | "blocked";
export type MonitorBoundary =
  | "read_only"
  | "review_first"
  | "no_auto_execution"
  | "no_customer_visible_send";
export type MonitorSourceStepName =
  | "signal_truth"
  | "threshold_check"
  | "review_posture"
  | "authority_boundary";
export type MonitorSourceOutcome = "pass" | "warn" | "block";
export type MonitorReasonCode =
  | "within_threshold"
  | "connector_lag_detected"
  | "webhook_receipt_stale"
  | "meeting_ingest_backlog"
  | "memory_sync_anomaly"
  | "settlement_exception_open"
  | "review_queue_drift"
  | "manual_ack_required"
  | "insufficient_signal";

export type MonitorSourceStep = {
  step: MonitorSourceStepName;
  sourceType: string;
  sourceRef: string | null;
  outcome: MonitorSourceOutcome;
  note: string;
};

export type MonitorSignalInput = {
  monitorKey: string;
  signalKind: MonitorSignalKind;
  sourceRef: string | null;
  observedAt: Date | string;
  threshold?: number;
  staleMinutes?: number;
  failedCount?: number;
  backlogCount?: number;
  anomalyCount?: number;
  exceptionCount?: number;
  driftCount?: number;
  reviewerAvailable?: boolean;
  requiresHumanAck?: boolean;
  humanAckSatisfied?: boolean;
  summary?: string;
  operatorNextMove?: string;
  sourceRefs?: string[];
};

export type MonitorReadout = {
  readoutKey: string;
  monitorKey: string;
  signalKind: MonitorSignalKind;
  observedAt: string;
  severity: MonitorSignalSeverity;
  outputPosture: MonitorOutputPosture;
  primaryReasonCode: MonitorReasonCode;
  summary: string;
  operatorNextMove: string;
  sourceRefs: string[];
  boundaryNotes: string[];
  boundaries: MonitorBoundary[];
  evaluation: {
    metricValue: number;
    threshold: number;
    sourceChain: MonitorSourceStep[];
  };
  audit: {
    emittedBy: "monitor-substrate";
    replaySafe: true;
  };
};

export type MonitorSubstrateSummary = {
  generatedAt: string;
  totalReadouts: number;
  severityCounts: Record<MonitorSignalSeverity, number>;
  reviewKeys: string[];
  blockedKeys: string[];
  primaryNextMove: string;
  boundaryNotes: string[];
};

export function buildMonitorSubstrateReadout(input: MonitorSignalInput): MonitorReadout {
  const observedAt = toIsoString(input.observedAt);
  const metricValue = resolveMetricValue(input);
  const threshold = input.threshold ?? defaultThresholdFor(input.signalKind);
  const hasSignalTruth = Boolean(input.monitorKey.trim()) && Boolean(input.sourceRef?.trim());
  const exceededThreshold = metricValue > threshold;
  const primaryReasonCode = resolveReasonCode({
    hasSignalTruth,
    signalKind: input.signalKind,
    exceededThreshold,
    requiresHumanAck: input.requiresHumanAck ?? false,
    humanAckSatisfied: input.humanAckSatisfied ?? true,
  });
  const severity = resolveSeverity({
    hasSignalTruth,
    signalKind: input.signalKind,
    metricValue,
    threshold,
    requiresHumanAck: input.requiresHumanAck ?? false,
    humanAckSatisfied: input.humanAckSatisfied ?? true,
  });
  const outputPosture = resolveOutputPosture({
    severity,
    signalKind: input.signalKind,
    requiresHumanAck: input.requiresHumanAck ?? false,
    humanAckSatisfied: input.humanAckSatisfied ?? true,
  });
  const boundaryNotes = buildBoundaryNotes(input.signalKind);

  return {
    readoutKey: buildStableKey("monitor_readout", input.monitorKey, input.signalKind),
    monitorKey: input.monitorKey,
    signalKind: input.signalKind,
    observedAt,
    severity,
    outputPosture,
    primaryReasonCode,
    summary: input.summary ?? buildDefaultSummary(input.signalKind, metricValue, threshold),
    operatorNextMove:
      input.operatorNextMove ??
      buildDefaultOperatorNextMove({
        signalKind: input.signalKind,
        severity,
        outputPosture,
      }),
    sourceRefs: uniqueRefs([input.sourceRef, ...(input.sourceRefs ?? [])]),
    boundaryNotes,
    boundaries: [
      "read_only",
      "review_first",
      "no_auto_execution",
      "no_customer_visible_send",
    ],
    evaluation: {
      metricValue,
      threshold,
      sourceChain: [
        buildSignalTruthStep(input),
        buildThresholdStep(input.signalKind, metricValue, threshold),
        buildReviewPostureStep({
          outputPosture,
          reviewerAvailable: input.reviewerAvailable ?? true,
          requiresHumanAck: input.requiresHumanAck ?? false,
          humanAckSatisfied: input.humanAckSatisfied ?? true,
        }),
        {
          step: "authority_boundary",
          sourceType: "policy",
          sourceRef: "read_only_monitor_substrate",
          outcome: "pass",
          note: "Monitor readout is report/review only and does not execute, schedule, notify customers, or mutate business state.",
        },
      ],
    },
    audit: {
      emittedBy: "monitor-substrate",
      replaySafe: true,
    },
  };
}

export function buildMonitorSubstrateSummary(
  readouts: MonitorReadout[],
  options: { generatedAt?: Date | string } = {},
): MonitorSubstrateSummary {
  const severityCounts: Record<MonitorSignalSeverity, number> = {
    ok: 0,
    watch: 0,
    escalate: 0,
    blocked: 0,
  };

  for (const readout of readouts) {
    severityCounts[readout.severity] += 1;
  }

  const prioritized =
    readouts.find((readout) => readout.severity === "blocked") ??
    readouts.find((readout) => readout.severity === "escalate") ??
    readouts.find((readout) => readout.severity === "watch");

  return {
    generatedAt: toIsoString(options.generatedAt ?? new Date()),
    totalReadouts: readouts.length,
    severityCounts,
    reviewKeys: readouts
      .filter((readout) =>
        ["route_to_review", "human_ack_required"].includes(readout.outputPosture),
      )
      .map((readout) => readout.readoutKey),
    blockedKeys: readouts
      .filter((readout) => readout.outputPosture === "blocked")
      .map((readout) => readout.readoutKey),
    primaryNextMove: prioritized?.operatorNextMove ?? "No operator action required.",
    boundaryNotes: [
      "read-only monitor substrate summary; existing source systems remain the truth source",
      "summary does not create scheduler, notification center, customer-visible send, or auto-execution authority",
    ],
  };
}

function resolveMetricValue(input: MonitorSignalInput): number {
  switch (input.signalKind) {
    case "connector_lag":
      return input.staleMinutes ?? 0;
    case "webhook_failure":
      return Math.max(input.failedCount ?? 0, input.staleMinutes ?? 0);
    case "meeting_ingest_backlog":
      return input.backlogCount ?? 0;
    case "memory_sync_anomaly":
      return input.anomalyCount ?? 0;
    case "settlement_exception":
      return input.exceptionCount ?? 0;
    case "review_queue_drift":
      return input.driftCount ?? 0;
  }
}

function defaultThresholdFor(signalKind: MonitorSignalKind): number {
  switch (signalKind) {
    case "connector_lag":
      return 15;
    case "webhook_failure":
      return 0;
    case "meeting_ingest_backlog":
      return 3;
    case "memory_sync_anomaly":
      return 0;
    case "settlement_exception":
      return 0;
    case "review_queue_drift":
      return 5;
  }
}

function resolveReasonCode(input: {
  hasSignalTruth: boolean;
  signalKind: MonitorSignalKind;
  exceededThreshold: boolean;
  requiresHumanAck: boolean;
  humanAckSatisfied: boolean;
}): MonitorReasonCode {
  if (!input.hasSignalTruth) {
    return "insufficient_signal";
  }

  if (input.requiresHumanAck && !input.humanAckSatisfied) {
    return "manual_ack_required";
  }

  if (!input.exceededThreshold) {
    return "within_threshold";
  }

  switch (input.signalKind) {
    case "connector_lag":
      return "connector_lag_detected";
    case "webhook_failure":
      return "webhook_receipt_stale";
    case "meeting_ingest_backlog":
      return "meeting_ingest_backlog";
    case "memory_sync_anomaly":
      return "memory_sync_anomaly";
    case "settlement_exception":
      return "settlement_exception_open";
    case "review_queue_drift":
      return "review_queue_drift";
  }
}

function resolveSeverity(input: {
  hasSignalTruth: boolean;
  signalKind: MonitorSignalKind;
  metricValue: number;
  threshold: number;
  requiresHumanAck: boolean;
  humanAckSatisfied: boolean;
}): MonitorSignalSeverity {
  if (!input.hasSignalTruth) {
    return "blocked";
  }

  if (input.signalKind === "settlement_exception" && input.metricValue > input.threshold) {
    return "blocked";
  }

  if (input.requiresHumanAck && !input.humanAckSatisfied) {
    return "escalate";
  }

  if (input.metricValue <= input.threshold) {
    return "ok";
  }

  const escalationThreshold = Math.max(input.threshold * 2, input.threshold + 5);
  return input.metricValue >= escalationThreshold ? "escalate" : "watch";
}

function resolveOutputPosture(input: {
  severity: MonitorSignalSeverity;
  signalKind: MonitorSignalKind;
  requiresHumanAck: boolean;
  humanAckSatisfied: boolean;
}): MonitorOutputPosture {
  if (input.severity === "ok") {
    return "report_only";
  }

  if (input.signalKind === "settlement_exception" || input.severity === "blocked") {
    return "blocked";
  }

  if (input.requiresHumanAck && !input.humanAckSatisfied) {
    return "human_ack_required";
  }

  return "route_to_review";
}

function buildSignalTruthStep(input: MonitorSignalInput): MonitorSourceStep {
  if (!input.monitorKey.trim() || !input.sourceRef?.trim()) {
    return {
      step: "signal_truth",
      sourceType: "monitor_signal",
      sourceRef: input.sourceRef ?? null,
      outcome: "block",
      note: "Monitor signal is missing a stable monitor key or source reference.",
    };
  }

  return {
    step: "signal_truth",
    sourceType: "monitor_signal",
    sourceRef: input.sourceRef,
    outcome: "pass",
    note: "Monitor signal includes a stable key and source reference.",
  };
}

function buildThresholdStep(
  signalKind: MonitorSignalKind,
  metricValue: number,
  threshold: number,
): MonitorSourceStep {
  const exceeded = metricValue > threshold;
  return {
    step: "threshold_check",
    sourceType: "monitor_threshold",
    sourceRef: signalKind,
    outcome: exceeded ? (signalKind === "settlement_exception" ? "block" : "warn") : "pass",
    note: exceeded
      ? `${signalKind} metric ${metricValue} exceeds threshold ${threshold}.`
      : `${signalKind} metric ${metricValue} stays within threshold ${threshold}.`,
  };
}

function buildReviewPostureStep(input: {
  outputPosture: MonitorOutputPosture;
  reviewerAvailable: boolean;
  requiresHumanAck: boolean;
  humanAckSatisfied: boolean;
}): MonitorSourceStep {
  if (input.outputPosture === "report_only") {
    return {
      step: "review_posture",
      sourceType: "operator_review",
      sourceRef: "report_only",
      outcome: "pass",
      note: "Signal only needs operator-visible reporting.",
    };
  }

  if (input.requiresHumanAck && !input.humanAckSatisfied) {
    return {
      step: "review_posture",
      sourceType: "operator_review",
      sourceRef: "human_ack",
      outcome: "block",
      note: "Signal requires explicit human acknowledgement before any existing manual path can proceed.",
    };
  }

  return {
    step: "review_posture",
    sourceType: "operator_review",
    sourceRef: input.reviewerAvailable ? "review_queue" : "review_queue_unstaffed",
    outcome: input.reviewerAvailable ? "warn" : "block",
    note: input.reviewerAvailable
      ? "Signal should be routed to operator review."
      : "Signal needs review, but no reviewer availability was declared.",
  };
}

function buildDefaultSummary(
  signalKind: MonitorSignalKind,
  metricValue: number,
  threshold: number,
): string {
  return `${signalKind} observed metric ${metricValue} against threshold ${threshold}.`;
}

function buildDefaultOperatorNextMove(input: {
  signalKind: MonitorSignalKind;
  severity: MonitorSignalSeverity;
  outputPosture: MonitorOutputPosture;
}): string {
  if (input.severity === "ok") {
    return "Keep observing; no operator action required.";
  }

  switch (input.signalKind) {
    case "connector_lag":
      return "Review connector sync health and choose an existing manual recovery path if needed.";
    case "webhook_failure":
      return "Route webhook receipt health to operator review; do not replay automatically.";
    case "meeting_ingest_backlog":
      return "Review meeting ingest backlog and select an existing manual recovery path.";
    case "memory_sync_anomaly":
      return "Review memory sync trace before loading, promoting, or relying on the affected memory.";
    case "settlement_exception":
      return "Hold the settlement path and require manual commercial review.";
    case "review_queue_drift":
      return input.outputPosture === "human_ack_required"
        ? "Require human acknowledgement before changing review queue ownership."
        : "Review queue drift and rebalance manually through the existing operator process.";
  }
}

function buildBoundaryNotes(signalKind: MonitorSignalKind): string[] {
  const notes = [
    "read-only monitor substrate; existing source system remains the enforcement source",
    "monitor readout routes to report or review and does not execute actions",
    "monitor readout does not create scheduler, notification center, or customer-visible send authority",
  ];

  if (signalKind === "settlement_exception") {
    notes.push("settlement exception monitor does not create payout rail or mark payments");
  }

  return notes;
}

function uniqueRefs(refs: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(
      refs
        .map((ref) => ref?.trim())
        .filter((ref): ref is string => Boolean(ref)),
    ),
  );
}

function buildStableKey(...parts: string[]): string {
  return parts
    .join(":")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
