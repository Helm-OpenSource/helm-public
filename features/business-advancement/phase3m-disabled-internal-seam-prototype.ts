/**
 * Helm Business Advancement - Phase 3M
 * Disabled-by-default internal seam prototype.
 *
 * This file is NOT a runtime adapter, NOT a DB reader, NOT a production query,
 * NOT an API route, NOT a mobile read-model integration, NOT a schema change,
 * NOT an extractor, NOT an event queue, NOT an official write, and NOT an
 * automated execution authority. It does not import from @/, does not import
 * db or prisma, does not read the wall clock, and makes no filesystem or
 * network calls. Injected rows only.
 *
 * Runtime adoption posture: No-Go.
 * Phase 3N internal prototype review is required before any production adoption.
 */

import {
  sourceBlockedDecisionCandidates,
  sourceOverdueCommitmentCandidates,
  sourceCustomerWaitingCandidates,
  type Tpqr001SourceRow,
  type Tpqr001SourceFunctionResult,
  type Tpqr003SourceRow,
  type Tpqr003SourceFunctionResult,
  type Tpqr004SourceRow,
  type Tpqr004SourceFunctionResult,
} from "./phase3h-source-function-planning";

import { tpqr001FamilyResult } from "./phase3k-threshold-calibration-fixtures";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const PHASE3M_RULE_VERSION =
  "phase3m-disabled-internal-seam-prototype/v1" as const;

export const PHASE3M_RUNTIME_ADOPTION_POSTURE = "No-Go" as const;

export const PHASE3M_PROTOTYPE_POSTURE = "Conditional-Go" as const;

export const PHASE3M_DEFAULT_FLAGS = {
  tpqr001: false,
  tpqr003: false,
  tpqr004: false,
} as const;

export const PHASE3M_NEXT_ALLOWED_WORK =
  "Phase 3N internal prototype review OR real-data calibration evidence pack only. Not production adoption.";

// ---------------------------------------------------------------------------
// Capability constants
// ---------------------------------------------------------------------------

export const CAPABILITY_BLOCKED_DECISION_READ =
  "helm.business-advancement.source.blocked-decision.read" as const;

export const CAPABILITY_OVERDUE_COMMITMENT_READ =
  "helm.business-advancement.source.overdue-commitment.read" as const;

export const CAPABILITY_CUSTOMER_WAITING_READ =
  "helm.business-advancement.source.customer-waiting.read" as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Phase3mFlags {
  tpqr001: boolean;
  tpqr003: boolean;
  tpqr004: boolean;
}

export type Phase3mFamilyStatus =
  | "disabled"
  | "capability_denied"
  | "evaluated";

export interface Phase3mFamilyResult<T> {
  readonly status: Phase3mFamilyStatus;
  readonly capabilitySatisfied: boolean;
  readonly enabled: boolean;
  readonly result: T;
}

export interface Phase3mInput {
  readonly workspaceId: string;
  readonly referenceClockMs: number;
  readonly flags?: Partial<Phase3mFlags>;
  readonly capabilities?: readonly string[];
  readonly rows: {
    readonly tpqr001?: Tpqr001SourceRow[];
    readonly tpqr003?: Tpqr003SourceRow[];
    readonly tpqr004?: Tpqr004SourceRow[];
  };
}

export interface Phase3mOutput {
  readonly runtimeAdoptionPosture: "No-Go";
  readonly prototypePosture: "Conditional-Go";
  readonly productionIntegrationAllowed: false;
  readonly ruleVersion: typeof PHASE3M_RULE_VERSION;
  readonly tpqr001: Phase3mFamilyResult<Tpqr001SourceFunctionResult>;
  readonly tpqr003: Phase3mFamilyResult<Tpqr003SourceFunctionResult>;
  readonly tpqr004: Phase3mFamilyResult<Tpqr004SourceFunctionResult>;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

// 72h conservative fixture default from Phase 3K calibration
const TPQR001_THRESHOLD_MS: number =
  tpqr001FamilyResult.conservativeFixtureDefaultMs;

function emptyTpqr001Result(): Tpqr001SourceFunctionResult {
  return { included: [], excluded: [] };
}

function emptyTpqr003Result(): Tpqr003SourceFunctionResult {
  return { included: [], excluded: [] };
}

function emptyTpqr004Result(): Tpqr004SourceFunctionResult {
  return {
    included: [],
    excluded: [],
    crmLinkedCandidateCount: 0,
    genericCandidateCount: 0,
  };
}

export function runPhase3mDisabledInternalSeamPrototype(
  input: Phase3mInput,
): Phase3mOutput {
  const flags: Phase3mFlags = {
    tpqr001: input.flags?.tpqr001 ?? false,
    tpqr003: input.flags?.tpqr003 ?? false,
    tpqr004: input.flags?.tpqr004 ?? false,
  };

  const capabilities: readonly string[] = input.capabilities ?? [];

  // -------------------------------------------------------------------------
  // TPQR-001: blocked_decision
  // -------------------------------------------------------------------------

  const tpqr001Rows: readonly Tpqr001SourceRow[] = input.rows.tpqr001 ?? [];
  let tpqr001: Phase3mFamilyResult<Tpqr001SourceFunctionResult>;

  if (!flags.tpqr001) {
    const result =
      tpqr001Rows.length > 0
        ? sourceBlockedDecisionCandidates({
            workspaceId: input.workspaceId,
            referenceClockMs: input.referenceClockMs,
            thresholdMs: TPQR001_THRESHOLD_MS,
            enabled: false,
            rows: tpqr001Rows,
          })
        : emptyTpqr001Result();
    tpqr001 = {
      status: "disabled",
      capabilitySatisfied: false,
      enabled: false,
      result,
    };
  } else if (!capabilities.includes(CAPABILITY_BLOCKED_DECISION_READ)) {
    const result =
      tpqr001Rows.length > 0
        ? sourceBlockedDecisionCandidates({
            workspaceId: input.workspaceId,
            referenceClockMs: input.referenceClockMs,
            thresholdMs: TPQR001_THRESHOLD_MS,
            enabled: false,
            rows: tpqr001Rows,
          })
        : emptyTpqr001Result();
    tpqr001 = {
      status: "capability_denied",
      capabilitySatisfied: false,
      enabled: false,
      result,
    };
  } else {
    const result = sourceBlockedDecisionCandidates({
      workspaceId: input.workspaceId,
      referenceClockMs: input.referenceClockMs,
      thresholdMs: TPQR001_THRESHOLD_MS,
      enabled: true,
      rows: tpqr001Rows,
    });
    tpqr001 = {
      status: "evaluated",
      capabilitySatisfied: true,
      enabled: true,
      result,
    };
  }

  // -------------------------------------------------------------------------
  // TPQR-003: overdue_commitment
  // -------------------------------------------------------------------------

  const tpqr003Rows: readonly Tpqr003SourceRow[] = input.rows.tpqr003 ?? [];
  let tpqr003: Phase3mFamilyResult<Tpqr003SourceFunctionResult>;

  if (!flags.tpqr003) {
    const result =
      tpqr003Rows.length > 0
        ? sourceOverdueCommitmentCandidates({
            workspaceId: input.workspaceId,
            referenceClockMs: input.referenceClockMs,
            enabled: false,
            rows: tpqr003Rows,
          })
        : emptyTpqr003Result();
    tpqr003 = {
      status: "disabled",
      capabilitySatisfied: false,
      enabled: false,
      result,
    };
  } else if (!capabilities.includes(CAPABILITY_OVERDUE_COMMITMENT_READ)) {
    const result =
      tpqr003Rows.length > 0
        ? sourceOverdueCommitmentCandidates({
            workspaceId: input.workspaceId,
            referenceClockMs: input.referenceClockMs,
            enabled: false,
            rows: tpqr003Rows,
          })
        : emptyTpqr003Result();
    tpqr003 = {
      status: "capability_denied",
      capabilitySatisfied: false,
      enabled: false,
      result,
    };
  } else {
    const result = sourceOverdueCommitmentCandidates({
      workspaceId: input.workspaceId,
      referenceClockMs: input.referenceClockMs,
      enabled: true,
      rows: tpqr003Rows,
    });
    tpqr003 = {
      status: "evaluated",
      capabilitySatisfied: true,
      enabled: true,
      result,
    };
  }

  // -------------------------------------------------------------------------
  // TPQR-004: customer_waiting
  // -------------------------------------------------------------------------

  const tpqr004Rows: readonly Tpqr004SourceRow[] = input.rows.tpqr004 ?? [];
  let tpqr004: Phase3mFamilyResult<Tpqr004SourceFunctionResult>;

  if (!flags.tpqr004) {
    const result =
      tpqr004Rows.length > 0
        ? sourceCustomerWaitingCandidates({
            workspaceId: input.workspaceId,
            enabled: false,
            rows: tpqr004Rows,
          })
        : emptyTpqr004Result();
    tpqr004 = {
      status: "disabled",
      capabilitySatisfied: false,
      enabled: false,
      result,
    };
  } else if (!capabilities.includes(CAPABILITY_CUSTOMER_WAITING_READ)) {
    const result =
      tpqr004Rows.length > 0
        ? sourceCustomerWaitingCandidates({
            workspaceId: input.workspaceId,
            enabled: false,
            rows: tpqr004Rows,
          })
        : emptyTpqr004Result();
    tpqr004 = {
      status: "capability_denied",
      capabilitySatisfied: false,
      enabled: false,
      result,
    };
  } else {
    const result = sourceCustomerWaitingCandidates({
      workspaceId: input.workspaceId,
      enabled: true,
      rows: tpqr004Rows,
    });
    tpqr004 = {
      status: "evaluated",
      capabilitySatisfied: true,
      enabled: true,
      result,
    };
  }

  return {
    runtimeAdoptionPosture: "No-Go",
    prototypePosture: "Conditional-Go",
    productionIntegrationAllowed: false,
    ruleVersion: PHASE3M_RULE_VERSION,
    tpqr001,
    tpqr003,
    tpqr004,
  };
}
