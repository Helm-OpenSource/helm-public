export type OperatingSignalFlowInternalShadowDiagnostics = {
  readonly actionCount: number;
  readonly approvalCount: number;
  readonly auditCount: number;
  readonly boundaryCounter: number;
  readonly pendingReviewCount: number;
  readonly tracePresenceCount: number;
  readonly workspaceCount: number;
};

export type OperatingSignalFlowInternalShadowResult =
  | {
      readonly state: "disabled";
      readonly reason: "flag_off" | "workspace_not_in_allowlist";
    }
  | {
      readonly state: "degraded";
      readonly reason: "empty_window" | "cross_workspace_projection";
      readonly diagnostics: OperatingSignalFlowInternalShadowDiagnostics;
    }
  | {
      readonly state: "shadow_ready";
      readonly diagnostics: OperatingSignalFlowInternalShadowDiagnostics;
      readonly snapshot?: {
        readonly dataPosture?: string;
        readonly window?: string;
        readonly generatedAt?: string;
        readonly aiWorkPosture?: {
          readonly deterministicCoveragePercent?: number;
          readonly explanationCoveragePercent?: number;
          readonly evidenceCoveragePercent?: number;
          readonly boundaryStoppedCount?: number;
        };
        readonly events?: readonly unknown[];
      };
    };

export type OperatingSignalFlowInternalShadowReadoutState =
  | "shadow_disabled"
  | "shadow_not_allowed"
  | "shadow_ready_clean"
  | "shadow_ready_drift_review"
  | "shadow_boundary_blocked"
  | "shadow_degraded"
  | "shadow_expired";

export type OperatingSignalFlowInternalShadowReadoutDecision = "continue" | "revise" | "stop";

export type OperatingSignalFlowInternalShadowReadoutOwnerRole =
  | "engineering_reviewer"
  | "product_owner"
  | "security_reviewer"
  | "operations_reviewer"
  | "data_protection_reviewer"
  | "founder_operator";

export type OperatingSignalFlowInternalShadowReadoutInput = {
  readonly result: OperatingSignalFlowInternalShadowResult;
  readonly reviewedAt: Date | string;
  readonly shadowGeneratedAt?: Date | string;
  readonly maxShadowAgeMs?: number;
  readonly previousDiagnostics?: OperatingSignalFlowInternalShadowDiagnostics | null;
  readonly driftExplanation?: string | null;
};

export type OperatingSignalFlowInternalShadowReadout = {
  readonly state: OperatingSignalFlowInternalShadowReadoutState;
  readonly sourceState: OperatingSignalFlowInternalShadowResult["state"];
  readonly sourceReason: string | null;
  readonly reviewerDecision: OperatingSignalFlowInternalShadowReadoutDecision;
  readonly ownerRoles: readonly OperatingSignalFlowInternalShadowReadoutOwnerRole[];
  readonly requiredResponse: string;
  readonly summary: string;
  readonly scope: {
    readonly singleWorkspace: boolean;
    readonly workspaceCount: number | null;
    readonly allowlistRequired: boolean;
  };
  readonly volume: {
    readonly actionCount: number | null;
    readonly approvalCount: number | null;
    readonly auditCount: number | null;
    readonly eventCount: number | null;
  };
  readonly risk: {
    readonly boundaryCounter: number | null;
    readonly pendingReviewCount: number | null;
    readonly boundaryPosture: "clear" | "blocked" | "unknown";
  };
  readonly quality: {
    readonly deterministicCoveragePercent: number | null;
    readonly explanationCoveragePercent: number | null;
    readonly evidenceCoveragePercent: number | null;
    readonly tracePresenceCount: number | null;
  };
  readonly drift: {
    readonly posture: "not_applicable" | "none" | "requires_explanation" | "explained";
    readonly explanationProvided: boolean;
    readonly changedCounters: ReadonlyArray<{
      readonly counter: keyof OperatingSignalFlowInternalShadowDiagnostics;
      readonly previous: number;
      readonly current: number;
      readonly delta: number;
    }>;
  };
  readonly allowedFieldFamilies: readonly string[];
  readonly forbiddenFieldFamilies: readonly string[];
  readonly adoptionGuards: {
    readonly routePageAdoptionAllowed: false;
    readonly productionQueryDefaultAllowed: false;
    readonly schemaOrApiChangeAllowed: false;
    readonly officialWriteAllowed: false;
    readonly autoExecuteAllowed: false;
    readonly externalSendAllowed: false;
    readonly fixtureBannerRemovalAllowed: false;
    readonly llmFinalRankingAllowed: false;
  };
  readonly nextReviewRequired: true;
};

const ALLOWED_FIELD_FAMILIES = ["state", "scope", "volume", "risk", "quality", "drift", "decision"] as const;

const FORBIDDEN_FIELD_FAMILIES = [
  "raw trace ids",
  "request ids",
  "parent event ids",
  "raw audit payloads",
  "actor names or emails",
  "source pages",
  "object ids",
  "rich action descriptions",
  "rich approval content",
  "external-send targets",
  "official-system payloads",
] as const;

const DIAGNOSTIC_COUNTERS = [
  "actionCount",
  "approvalCount",
  "auditCount",
  "boundaryCounter",
  "pendingReviewCount",
  "tracePresenceCount",
  "workspaceCount",
] as const;

export function projectOperatingSignalFlowInternalShadowReadout(
  input: OperatingSignalFlowInternalShadowReadoutInput,
): OperatingSignalFlowInternalShadowReadout {
  const diagnostics = getDiagnostics(input.result);
  const drift = buildDrift(input.previousDiagnostics, diagnostics, input.driftExplanation);
  const expired = isExpired({
    reviewedAt: input.reviewedAt,
    shadowGeneratedAt: input.shadowGeneratedAt ?? getSnapshotGeneratedAt(input.result),
    maxShadowAgeMs: input.maxShadowAgeMs,
  });
  const boundaryBlocked =
    diagnostics !== null && (diagnostics.boundaryCounter > 0 || diagnostics.workspaceCount !== 1);

  if (input.result.state === "disabled") {
    return buildReadout({
      state: input.result.reason === "workspace_not_in_allowlist" ? "shadow_not_allowed" : "shadow_disabled",
      sourceState: input.result.state,
      sourceReason: input.result.reason,
      reviewerDecision: input.result.reason === "workspace_not_in_allowlist" ? "stop" : "continue",
      ownerRoles:
        input.result.reason === "workspace_not_in_allowlist"
          ? ["engineering_reviewer", "security_reviewer", "founder_operator"]
          : ["engineering_reviewer", "founder_operator"],
      requiredResponse:
        input.result.reason === "workspace_not_in_allowlist"
          ? "Stop and fix the workspace allowlist before any retry."
          : "Leave production unchanged; fixture-backed /operating remains the visible page posture.",
      summary:
        input.result.reason === "workspace_not_in_allowlist"
          ? "Runtime shadow is enabled but this workspace is not allowlisted."
          : "Runtime shadow remains disabled by default.",
      diagnostics,
      quality: getQuality(input.result),
      eventCount: getEventCount(input.result),
      drift,
    });
  }

  if (boundaryBlocked) {
    return buildReadout({
      state: "shadow_boundary_blocked",
      sourceState: input.result.state,
      sourceReason: getReason(input.result),
      reviewerDecision: "stop",
      ownerRoles: ["security_reviewer", "data_protection_reviewer", "founder_operator"],
      requiredResponse: "Stop the adoption path and open a boundary review before any next slice.",
      summary: "Runtime shadow diagnostics contain a boundary or workspace-scope blocker.",
      diagnostics,
      quality: getQuality(input.result),
      eventCount: getEventCount(input.result),
      drift,
    });
  }

  if (input.result.state === "degraded") {
    return buildReadout({
      state: "shadow_degraded",
      sourceState: input.result.state,
      sourceReason: input.result.reason,
      reviewerDecision: "revise",
      ownerRoles: ["engineering_reviewer", "founder_operator"],
      requiredResponse: "Treat this as a runtime readiness blocker and revise the adapter or probe input.",
      summary: "Runtime shadow did not produce a safe internal projection.",
      diagnostics,
      quality: getQuality(input.result),
      eventCount: getEventCount(input.result),
      drift,
    });
  }

  if (expired) {
    return buildReadout({
      state: "shadow_expired",
      sourceState: input.result.state,
      sourceReason: null,
      reviewerDecision: "revise",
      ownerRoles: ["operations_reviewer", "founder_operator"],
      requiredResponse: "Rerun the process-local probe before using this readout for a founder decision.",
      summary: "Runtime shadow is older than the accepted internal review window.",
      diagnostics,
      quality: getQuality(input.result),
      eventCount: getEventCount(input.result),
      drift,
    });
  }

  if (drift.changedCounters.length > 0) {
    return buildReadout({
      state: "shadow_ready_drift_review",
      sourceState: input.result.state,
      sourceReason: null,
      reviewerDecision: drift.explanationProvided ? "continue" : "revise",
      ownerRoles: ["operations_reviewer", "product_owner", "founder_operator"],
      requiredResponse: drift.explanationProvided
        ? "Review the operator drift explanation; continue only as an internal readout."
        : "Explain count drift from ActionItem / ApprovalTask / AuditLog receipts before continuing.",
      summary: "Runtime shadow is single-workspace with no boundary counter, but count drift needs review.",
      diagnostics,
      quality: getQuality(input.result),
      eventCount: getEventCount(input.result),
      drift,
    });
  }

  return buildReadout({
    state: "shadow_ready_clean",
    sourceState: input.result.state,
    sourceReason: null,
    reviewerDecision: "continue",
    ownerRoles: ["product_owner", "operations_reviewer", "founder_operator"],
    requiredResponse: "Review the internal readout only; do not adopt route, page, API, schema, or production query defaults.",
    summary: "Runtime shadow is single-workspace, boundary-clear, and ready for internal readout review.",
    diagnostics,
    quality: getQuality(input.result),
    eventCount: getEventCount(input.result),
    drift,
  });
}

function buildReadout(input: {
  readonly state: OperatingSignalFlowInternalShadowReadoutState;
  readonly sourceState: OperatingSignalFlowInternalShadowResult["state"];
  readonly sourceReason: string | null;
  readonly reviewerDecision: OperatingSignalFlowInternalShadowReadoutDecision;
  readonly ownerRoles: readonly OperatingSignalFlowInternalShadowReadoutOwnerRole[];
  readonly requiredResponse: string;
  readonly summary: string;
  readonly diagnostics: OperatingSignalFlowInternalShadowDiagnostics | null;
  readonly quality: OperatingSignalFlowInternalShadowReadout["quality"];
  readonly eventCount: number | null;
  readonly drift: OperatingSignalFlowInternalShadowReadout["drift"];
}): OperatingSignalFlowInternalShadowReadout {
  return {
    state: input.state,
    sourceState: input.sourceState,
    sourceReason: input.sourceReason,
    reviewerDecision: input.reviewerDecision,
    ownerRoles: input.ownerRoles,
    requiredResponse: input.requiredResponse,
    summary: input.summary,
    scope: {
      singleWorkspace: input.diagnostics?.workspaceCount === 1,
      workspaceCount: input.diagnostics?.workspaceCount ?? null,
      allowlistRequired: true,
    },
    volume: {
      actionCount: input.diagnostics?.actionCount ?? null,
      approvalCount: input.diagnostics?.approvalCount ?? null,
      auditCount: input.diagnostics?.auditCount ?? null,
      eventCount: input.eventCount,
    },
    risk: {
      boundaryCounter: input.diagnostics?.boundaryCounter ?? null,
      pendingReviewCount: input.diagnostics?.pendingReviewCount ?? null,
      boundaryPosture: getBoundaryPosture(input.diagnostics),
    },
    quality: input.quality,
    drift: input.drift,
    allowedFieldFamilies: ALLOWED_FIELD_FAMILIES,
    forbiddenFieldFamilies: FORBIDDEN_FIELD_FAMILIES,
    adoptionGuards: {
      routePageAdoptionAllowed: false,
      productionQueryDefaultAllowed: false,
      schemaOrApiChangeAllowed: false,
      officialWriteAllowed: false,
      autoExecuteAllowed: false,
      externalSendAllowed: false,
      fixtureBannerRemovalAllowed: false,
      llmFinalRankingAllowed: false,
    },
    nextReviewRequired: true,
  };
}

function buildDrift(
  previous: OperatingSignalFlowInternalShadowDiagnostics | null | undefined,
  current: OperatingSignalFlowInternalShadowDiagnostics | null,
  driftExplanation: string | null | undefined,
): OperatingSignalFlowInternalShadowReadout["drift"] {
  if (previous === null || previous === undefined || current === null) {
    return {
      posture: "not_applicable",
      explanationProvided: false,
      changedCounters: [],
    };
  }

  const changedCounters = DIAGNOSTIC_COUNTERS.flatMap((counter) => {
    const previousValue = sanitizeCount(previous[counter]);
    const currentValue = sanitizeCount(current[counter]);
    if (previousValue === currentValue) return [];
    return [
      {
        counter,
        previous: previousValue,
        current: currentValue,
        delta: currentValue - previousValue,
      },
    ];
  });
  const explanationProvided = typeof driftExplanation === "string" && driftExplanation.trim().length > 0;

  return {
    posture:
      changedCounters.length === 0 ? "none" : explanationProvided ? "explained" : "requires_explanation",
    explanationProvided,
    changedCounters,
  };
}

function getDiagnostics(
  result: OperatingSignalFlowInternalShadowResult,
): OperatingSignalFlowInternalShadowDiagnostics | null {
  if (result.state === "disabled") return null;
  return {
    actionCount: sanitizeCount(result.diagnostics.actionCount),
    approvalCount: sanitizeCount(result.diagnostics.approvalCount),
    auditCount: sanitizeCount(result.diagnostics.auditCount),
    boundaryCounter: sanitizeCount(result.diagnostics.boundaryCounter),
    pendingReviewCount: sanitizeCount(result.diagnostics.pendingReviewCount),
    tracePresenceCount: sanitizeCount(result.diagnostics.tracePresenceCount),
    workspaceCount: sanitizeCount(result.diagnostics.workspaceCount),
  };
}

function getQuality(result: OperatingSignalFlowInternalShadowResult): OperatingSignalFlowInternalShadowReadout["quality"] {
  if (result.state === "disabled") {
    return {
      deterministicCoveragePercent: null,
      explanationCoveragePercent: null,
      evidenceCoveragePercent: null,
      tracePresenceCount: null,
    };
  }

  const posture = result.state === "shadow_ready" ? result.snapshot?.aiWorkPosture : undefined;
  return {
    deterministicCoveragePercent: sanitizePercent(posture?.deterministicCoveragePercent),
    explanationCoveragePercent: sanitizePercent(posture?.explanationCoveragePercent),
    evidenceCoveragePercent: sanitizePercent(posture?.evidenceCoveragePercent),
    tracePresenceCount: sanitizeCount(result.diagnostics.tracePresenceCount),
  };
}

function getEventCount(result: OperatingSignalFlowInternalShadowResult): number | null {
  if (result.state !== "shadow_ready") return null;
  if (Array.isArray(result.snapshot?.events)) return result.snapshot.events.length;
  const diagnostics = getDiagnostics(result);
  if (diagnostics === null) return null;
  return diagnostics.actionCount + diagnostics.approvalCount + diagnostics.auditCount;
}

function getReason(result: OperatingSignalFlowInternalShadowResult): string | null {
  if (result.state === "shadow_ready") return null;
  return result.reason;
}

function getBoundaryPosture(
  diagnostics: OperatingSignalFlowInternalShadowDiagnostics | null,
): OperatingSignalFlowInternalShadowReadout["risk"]["boundaryPosture"] {
  if (diagnostics === null) return "unknown";
  if (diagnostics.boundaryCounter > 0 || diagnostics.workspaceCount !== 1) return "blocked";
  return "clear";
}

function isExpired(input: {
  readonly reviewedAt: Date | string;
  readonly shadowGeneratedAt: Date | string | undefined;
  readonly maxShadowAgeMs: number | undefined;
}): boolean {
  if (input.shadowGeneratedAt === undefined || input.maxShadowAgeMs === undefined) return false;
  const reviewedAt = toTime(input.reviewedAt);
  const shadowGeneratedAt = toTime(input.shadowGeneratedAt);
  if (reviewedAt === null || shadowGeneratedAt === null) return true;
  return reviewedAt - shadowGeneratedAt > input.maxShadowAgeMs;
}

function getSnapshotGeneratedAt(result: OperatingSignalFlowInternalShadowResult): string | undefined {
  if (result.state !== "shadow_ready") return undefined;
  return result.snapshot?.generatedAt;
}

function sanitizeCount(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.floor(value);
}

function sanitizePercent(value: number | undefined): number | null {
  if (value === undefined || !Number.isFinite(value)) return null;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return Math.round(value);
}

function toTime(value: Date | string): number | null {
  const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}
