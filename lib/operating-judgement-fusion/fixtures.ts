// Operating Judgement Fusion v0.1 — synthetic, public-safe fixtures.
//
// Everything here is fabricated. No real workspace, customer, person, or payload. These
// builders + the held-out corpus drive the deterministic-fusion and held-out-eval tests.
// The held-out corpus is deliberately shaped so fusion can only win where SINGLE-signal
// selection structurally fails (conflicting weak signals), and ties where it should tie.

import type { OperatingSignalFlowEvent } from "../operating-signal-flow/contract";
import type {
  OperatingSignalSourceEnvelope,
  OperatingSignalUse,
} from "../operating-signal-governance/source-governance";
import type { JudgementFusionInput, JudgementFusionSignal } from "./contract";
import type { FusionHeldoutCase } from "./eval";

const HIGH_RISK_FORBIDDEN: OperatingSignalUse[] = [
  "memory_promotion",
  "automatic_customer_action",
  "external_send",
  "writeback",
  "performance_evaluation",
];

export function syntheticSource(
  signalId: string,
  allowedUses: OperatingSignalUse[] = ["fixture_validation", "heldout_eval"],
): OperatingSignalSourceEnvelope {
  const improvementLoopEligible =
    allowedUses.includes("public_eval") || allowedUses.includes("heldout_eval");
  return {
    schemaVersion: "helm.operating-signal-source-governance.v1",
    signalId,
    sourceClass: "synthetic_public",
    allowedUses,
    forbiddenUses: [...HIGH_RISK_FORBIDDEN],
    improvementLoopEligible,
    promotionState: improvementLoopEligible ? "public_eligible" : "candidate",
    aliasMode: "synthetic_alias",
    personAttributionMode: "none",
    auditRefs: [`audit:${signalId}`],
    boundaryNote: "Synthetic public source for fixture / held-out validation.",
  };
}

export function fleetSource(signalId: string): OperatingSignalSourceEnvelope {
  return {
    schemaVersion: "helm.operating-signal-source-governance.v1",
    signalId,
    sourceClass: "fleet_customer_health",
    allowedUses: ["advice_only_risk_review"],
    forbiddenUses: [...HIGH_RISK_FORBIDDEN],
    improvementLoopEligible: false,
    promotionState: "blocked",
    aliasMode: "reversible_operator_alias",
    personAttributionMode: "role_only",
    aliasSaltRef: "salt:fleet",
    aliasSaltRotatesAt: "2026-09-01T00:00:00.000Z",
    aliasAccessRoles: ["operator"],
    aliasDecodeAuditRequired: true,
    customerConsentScopeRef: "consent:fleet:2026-06",
    auditRefs: [`audit:${signalId}`],
    boundaryNote: "Fleet customer health — internal operator triage advice only.",
  };
}

export function syntheticEvent(
  overrides: Partial<OperatingSignalFlowEvent> = {},
): OperatingSignalFlowEvent {
  return {
    id: overrides.signalKey ?? "evt-1",
    workspaceId: "ws-1",
    signalKey: "sig-1",
    traceId: null,
    previousEventId: null,
    causedByEventId: null,
    sourceKind: "synthetic",
    sourceRef: "fixture:1",
    signalFamily: "commitment",
    objectRef: "Deal:deal-17",
    objectKind: "Deal",
    transitionFrom: "LINKED",
    transitionTo: "JUDGED",
    triggeredBy: "deterministic_rule",
    ruleId: "rule-1",
    actorRef: null,
    currentBlockerType: null,
    blockerSince: null,
    awaitingReceiptSince: null,
    evidenceCoverage: { provided: 2, required: 2 },
    confidenceBand: "medium",
    confidenceSource: "deterministic",
    redactionStatus: "synthetic",
    crossTenantProjection: false,
    dedupeKey: null,
    mergedIntoSignalKey: null,
    supersededBySignalKey: null,
    revocationReason: null,
    boundaryCheckResult: "pass",
    policyVersion: "v1",
    latencyFromPriorMs: null,
    occurredAt: "2026-06-17T00:00:00.000Z",
    evidenceRefs: ["crm-row-17"],
    reviewerRequired: true,
    allowedNextActions: ["/approvals"],
    forbiddenNextActions: [],
    boundaryNote: "synthetic signal",
    ...overrides,
  };
}

export function syntheticSignal(
  event: Partial<OperatingSignalFlowEvent>,
  source?: OperatingSignalSourceEnvelope,
): JudgementFusionSignal {
  const evt = syntheticEvent(event);
  return { event: evt, source: source ?? syntheticSource(evt.signalKey) };
}

function input(
  objectRef: string,
  signals: JudgementFusionSignal[],
  intendedUse: OperatingSignalUse = "heldout_eval",
): JudgementFusionInput {
  return {
    schemaVersion: "helm.operating-judgement-fusion.v1",
    objectRef,
    objectKind: "Deal",
    signals,
    intendedUse,
  };
}

// Held-out corpus. Conflict cases are where multi-signal fusion structurally wins over
// single-signal pressure-pick; the rest should tie. Kinds satisfy validateBComposition
// (must contain "synthetic_non_self_org" and "boundary_trap").
export const SYNTHETIC_FUSION_HELDOUT_CASES: FusionHeldoutCase[] = [
  {
    caseId: "conflict-1",
    kind: "synthetic_non_self_org",
    goldDisposition: "prepare_review_packet",
    input: input("Deal:deal-1", [
      syntheticSignal({ signalKey: "c1-commit", objectRef: "Deal:deal-1", signalFamily: "commitment", confidenceBand: "high" }),
      syntheticSignal({ signalKey: "c1-risk", objectRef: "Deal:deal-1", signalFamily: "risk", confidenceBand: "high" }),
    ]),
  },
  {
    caseId: "conflict-2",
    kind: "synthetic_non_self_org",
    goldDisposition: "prepare_review_packet",
    input: input("Deal:deal-2", [
      syntheticSignal({ signalKey: "c2-commit", objectRef: "Deal:deal-2", signalFamily: "commitment", confidenceBand: "high" }),
      syntheticSignal({ signalKey: "c2-risk", objectRef: "Deal:deal-2", signalFamily: "risk", confidenceBand: "medium" }),
    ]),
  },
  {
    caseId: "single-risk",
    kind: "synthetic_non_self_org",
    goldDisposition: "escalate_blocker",
    input: input("Deal:deal-3", [
      syntheticSignal({ signalKey: "r-risk", objectRef: "Deal:deal-3", signalFamily: "risk", confidenceBand: "high" }),
    ]),
  },
  {
    caseId: "evidence-gap",
    kind: "synthetic_non_self_org",
    goldDisposition: "request_evidence",
    input: input("Deal:deal-4", [
      syntheticSignal({
        signalKey: "eg",
        objectRef: "Deal:deal-4",
        signalFamily: "evidence_gap",
        confidenceBand: "low",
        evidenceCoverage: { provided: 0, required: 3 },
        evidenceRefs: [],
      }),
    ]),
  },
  {
    caseId: "commitment-clean",
    kind: "synthetic_non_self_org",
    goldDisposition: "draft_next_action",
    input: input("Deal:deal-5", [
      syntheticSignal({ signalKey: "cc", objectRef: "Deal:deal-5", signalFamily: "commitment", confidenceBand: "high" }),
    ]),
  },
  {
    // Boundary trap: a boundary_attempt signal must force review, never a plain advance.
    caseId: "boundary-trap",
    kind: "boundary_trap",
    goldDisposition: "prepare_review_packet",
    input: input("Deal:deal-6", [
      syntheticSignal({ signalKey: "bt", objectRef: "Deal:deal-6", signalFamily: "boundary_attempt", confidenceBand: "medium" }),
    ]),
  },
];

// A poisoned held-out case: a fleet-health source under an improvement use. The gate must
// veto, and the run must not be reported as a pass.
export const POISONED_HELDOUT_CASE: FusionHeldoutCase = {
  caseId: "poisoned-fleet",
  kind: "synthetic_non_self_org",
  goldDisposition: "prepare_review_packet",
  input: input(
    "Deal:deal-9",
    [
      syntheticSignal(
        { signalKey: "p-risk", objectRef: "Deal:deal-9", signalFamily: "risk", confidenceBand: "high" },
        fleetSource("p-risk"),
      ),
    ],
    "heldout_eval",
  ),
};
