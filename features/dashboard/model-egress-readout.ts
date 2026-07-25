export type ModelEgressPolicyReadRow = {
  id: string;
  policyKey: string;
  revision: number;
  status: string;
  validFrom: Date;
  validUntil: Date;
  activatedAt: Date | null;
  revokedAt: Date | null;
};

export type ModelEgressReadinessReadRow = {
  id: string;
  provider: string;
  modelId: string;
  modelVersion: string;
  adapterKey: string;
  deploymentForm: string;
  jurisdiction: string;
  region: string;
  adapterRegistered: boolean;
  credentialConfigured: boolean;
  modelProbeStatus: string;
  expiresAt: Date;
  rawCredentialIncluded: boolean;
  checkedAt: Date;
};

export type ModelEgressDecisionReadRow = {
  id: string;
  taskClass: string;
  sensitivity: string;
  processingDisposition: string;
  routeRef: string | null;
  adapterReadinessState: string;
  catalogVisibilityState: string;
  decision: string;
  reasonCodes: string;
  dispatchClaimedAt: Date | null;
  validUntil: Date;
  createdAt: Date;
  egressReceipts: Array<{
    sequence: number;
    phase: string;
    outcome: string;
    finishedAt: Date | null;
    latencyMs: number | null;
    costBand: string;
    errorCode: string | null;
    recordedAt: Date;
  }>;
};

export type ModelEgressOwnerReadout = {
  asOf: string;
  posture:
    | "not_configured"
    | "admission_review_required"
    | "attention_required"
    | "operational";
  boundary: {
    mode: "read_only";
    rawContentVisible: false;
    credentialsVisible: false;
    dispatchAvailable: false;
  };
  policies: {
    total: number;
    active: number;
  };
  readiness: {
    total: number;
    ready: number;
    rawCredentialViolations: number;
  };
  routing: {
    total: number;
    allowed: number;
    blocked: number;
  };
  dispatch: {
    claimed: number;
    inDoubt: number;
    terminal: number;
    succeeded: number;
    failed: number;
    partial: number;
    unknown: number;
  };
  recentPolicies: Array<{
    id: string;
    policyKey: string;
    revision: number;
    status: string;
    validFrom: string;
    validUntil: string;
    activatedAt: string | null;
    revokedAt: string | null;
  }>;
  recentReadiness: Array<{
    id: string;
    provider: string;
    modelId: string;
    modelVersion: string;
    adapterKey: string;
    deploymentForm: string;
    jurisdiction: string;
    region: string;
    state: "ready" | "expired" | "unavailable" | "unsafe";
    checkedAt: string;
    expiresAt: string;
  }>;
  recentDecisions: Array<{
    id: string;
    taskClass: string;
    sensitivity: string;
    processingDisposition: string;
    routeRef: string | null;
    adapterReadinessState: string;
    catalogVisibilityState: string;
    decision: string;
    reasonCodes: string[];
    state:
      | "blocked"
      | "allowed_not_dispatched"
      | "in_doubt"
      | "succeeded"
      | "failed"
      | "partial"
      | "unknown";
    outcome: string | null;
    latencyMs: number | null;
    costBand: string | null;
    errorCode: string | null;
    createdAt: string;
    validUntil: string;
    finishedAt: string | null;
  }>;
};

export type ModelEgressOwnerMetrics = {
  policyTotal: number;
  activePolicyCount: number;
  readinessTotal: number;
  readyReadinessCount: number;
  rawCredentialViolationCount: number;
  decisionTotal: number;
  allowedDecisionCount: number;
  blockedDecisionCount: number;
  claimedDispatchCount: number;
  inDoubtDispatchCount: number;
};

export type ModelEgressOutcomeCountRow = {
  outcome: string;
  _count: { _all: number };
};

function outcomeCount(
  rows: readonly ModelEgressOutcomeCountRow[],
  outcome: string,
): number {
  return (
    rows.find(
      (row) => row.outcome.toLowerCase() === outcome.toLowerCase(),
    )?._count._all ?? 0
  );
}

function parseReasonCodes(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (
      Array.isArray(parsed) &&
      parsed.every((reason) => typeof reason === "string")
    ) {
      return [...new Set(parsed)].sort();
    }
  } catch {
    // The read surface must not leak malformed stored JSON.
  }
  return ["reason_codes_unavailable"];
}

function readinessState(
  row: ModelEgressReadinessReadRow,
  now: Date,
): ModelEgressOwnerReadout["recentReadiness"][number]["state"] {
  if (row.rawCredentialIncluded) return "unsafe";
  if (row.expiresAt.getTime() <= now.getTime()) return "expired";
  if (
    !row.adapterRegistered ||
    !row.credentialConfigured ||
    row.modelProbeStatus.toLowerCase() !== "ready"
  ) {
    return "unavailable";
  }
  return "ready";
}

function decisionState(
  row: ModelEgressDecisionReadRow,
): {
  state: ModelEgressOwnerReadout["recentDecisions"][number]["state"];
  terminal: ModelEgressDecisionReadRow["egressReceipts"][number] | null;
} {
  if (row.decision.toLowerCase() !== "allowed") {
    return { state: "blocked", terminal: null };
  }
  const terminal =
    row.egressReceipts.find((receipt) => receipt.sequence === 2) ?? null;
  if (!terminal && row.dispatchClaimedAt) {
    return { state: "in_doubt", terminal: null };
  }
  if (!terminal) {
    return { state: "allowed_not_dispatched", terminal: null };
  }
  const outcome = terminal.outcome.toLowerCase();
  if (outcome === "success") return { state: "succeeded", terminal };
  if (outcome === "failure") return { state: "failed", terminal };
  if (outcome === "partial") return { state: "partial", terminal };
  return { state: "unknown", terminal };
}

export function buildModelEgressOwnerReadout(input: {
  now: Date;
  metrics: ModelEgressOwnerMetrics;
  terminalOutcomeCounts: readonly ModelEgressOutcomeCountRow[];
  policies: readonly ModelEgressPolicyReadRow[];
  readiness: readonly ModelEgressReadinessReadRow[];
  decisions: readonly ModelEgressDecisionReadRow[];
}): ModelEgressOwnerReadout {
  const succeeded = outcomeCount(input.terminalOutcomeCounts, "success");
  const failed = outcomeCount(input.terminalOutcomeCounts, "failure");
  const partial = outcomeCount(input.terminalOutcomeCounts, "partial");
  const unknown = outcomeCount(input.terminalOutcomeCounts, "unknown");
  const terminal = input.terminalOutcomeCounts.reduce(
    (sum, row) => sum + row._count._all,
    0,
  );

  let posture: ModelEgressOwnerReadout["posture"] = "operational";
  if (input.metrics.policyTotal === 0 && input.metrics.decisionTotal === 0) {
    posture = "not_configured";
  } else if (
    input.metrics.rawCredentialViolationCount > 0 ||
    input.metrics.inDoubtDispatchCount > 0
  ) {
    posture = "attention_required";
  } else if (
    input.metrics.activePolicyCount === 0 ||
    input.metrics.readyReadinessCount === 0 ||
    input.metrics.blockedDecisionCount > 0
  ) {
    posture = "admission_review_required";
  }

  return {
    asOf: input.now.toISOString(),
    posture,
    boundary: {
      mode: "read_only",
      rawContentVisible: false,
      credentialsVisible: false,
      dispatchAvailable: false,
    },
    policies: {
      total: input.metrics.policyTotal,
      active: input.metrics.activePolicyCount,
    },
    readiness: {
      total: input.metrics.readinessTotal,
      ready: input.metrics.readyReadinessCount,
      rawCredentialViolations:
        input.metrics.rawCredentialViolationCount,
    },
    routing: {
      total: input.metrics.decisionTotal,
      allowed: input.metrics.allowedDecisionCount,
      blocked: input.metrics.blockedDecisionCount,
    },
    dispatch: {
      claimed: input.metrics.claimedDispatchCount,
      inDoubt: input.metrics.inDoubtDispatchCount,
      terminal,
      succeeded,
      failed,
      partial,
      unknown,
    },
    recentPolicies: input.policies.map((policy) => ({
      id: policy.id,
      policyKey: policy.policyKey,
      revision: policy.revision,
      status: policy.status,
      validFrom: policy.validFrom.toISOString(),
      validUntil: policy.validUntil.toISOString(),
      activatedAt: policy.activatedAt?.toISOString() ?? null,
      revokedAt: policy.revokedAt?.toISOString() ?? null,
    })),
    recentReadiness: input.readiness.map((row) => ({
      id: row.id,
      provider: row.provider,
      modelId: row.modelId,
      modelVersion: row.modelVersion,
      adapterKey: row.adapterKey,
      deploymentForm: row.deploymentForm,
      jurisdiction: row.jurisdiction,
      region: row.region,
      state: readinessState(row, input.now),
      checkedAt: row.checkedAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
    })),
    recentDecisions: input.decisions.map((row) => {
      const projection = decisionState(row);
      return {
        id: row.id,
        taskClass: row.taskClass,
        sensitivity: row.sensitivity,
        processingDisposition: row.processingDisposition,
        routeRef: row.routeRef,
        adapterReadinessState: row.adapterReadinessState,
        catalogVisibilityState: row.catalogVisibilityState,
        decision: row.decision.toLowerCase(),
        reasonCodes: parseReasonCodes(row.reasonCodes),
        state: projection.state,
        outcome:
          projection.terminal?.outcome.toLowerCase() ?? null,
        latencyMs: projection.terminal?.latencyMs ?? null,
        costBand: projection.terminal?.costBand ?? null,
        errorCode: projection.terminal?.errorCode ?? null,
        createdAt: row.createdAt.toISOString(),
        validUntil: row.validUntil.toISOString(),
        finishedAt:
          projection.terminal?.finishedAt?.toISOString() ?? null,
      };
    }),
  };
}
