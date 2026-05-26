/**
 * Helm — P0-REQ-06 Gate Consolidation Eval
 *
 * Planning-only registry evaluator. It checks every active P0 gate answers
 * "which customer-visible risk does this prevent?". Gates that cannot answer
 * are marked freeze / research / archive and must not appear in the active
 * pilot-blocking list.
 *
 * NOT a runtime gate, NOT an API. Catalogs gates by file reference only.
 */

import gateRegistryFixture from "@/evals/gate-consolidation/gate-registry.json";

export type GateStatus = "keep" | "freeze" | "research" | "archive";

export type GateClass =
  | "boundary_static_gate"
  | "object_signal_validity_eval"
  | "context_packet_audit"
  | "memory_quality_impact_eval"
  | "trace_roi_pilot_proof_gate"
  | "meta_gate"
  | "dogfood_opc_artifact";

export interface GateRegistryEntry {
  readonly id: string;
  readonly displayName: string;
  readonly klass: GateClass;
  readonly status: GateStatus;
  readonly customerVisibleRisk: string | null;
  readonly evidence: readonly string[];
  readonly metaOnly: boolean;
  readonly feedsPilotDecision: boolean;
  readonly rationale: string;
}

export interface GateRegistryPolicy {
  readonly activeStatuses: readonly GateStatus[];
  readonly nonBlockingStatuses: readonly GateStatus[];
  readonly requiredCustomerVisibleRiskForKeep: boolean;
}

export interface GateRegistryFixturePack {
  readonly version: string;
  readonly status: string;
  readonly boundary: string;
  readonly policy: GateRegistryPolicy;
  readonly gates: readonly GateRegistryEntry[];
}

export interface GateConsolidationCaseResult {
  readonly id: string;
  readonly status: GateStatus;
  readonly active: boolean;
  readonly hasCustomerVisibleRisk: boolean;
  readonly metaOnly: boolean;
  readonly feedsPilotDecision: boolean;
  readonly violations: readonly string[];
}

export interface GateConsolidationEvalSummary {
  readonly passed: boolean;
  readonly version: string;
  readonly totalGates: number;
  readonly activeCount: number;
  readonly nonBlockingCount: number;
  readonly caseResults: readonly GateConsolidationCaseResult[];
  readonly failures: ReadonlyArray<{ caseId: string; reason: string }>;
}

const REQUIRED_KEEP_KLASSES: readonly GateClass[] = [
  "boundary_static_gate",
  "object_signal_validity_eval",
  "context_packet_audit",
  "memory_quality_impact_eval",
  "trace_roi_pilot_proof_gate",
];

export function runGateConsolidationEval(
  fixturePack: GateRegistryFixturePack =
    gateRegistryFixture as GateRegistryFixturePack,
): GateConsolidationEvalSummary {
  const caseResults = fixturePack.gates.map((gate) =>
    evaluateGate(gate, fixturePack.policy),
  );
  const failures: Array<{ caseId: string; reason: string }> = [];

  for (const result of caseResults) {
    for (const violation of result.violations) {
      failures.push({ caseId: result.id, reason: violation });
    }
  }

  const activeKlasses = new Set(
    caseResults
      .filter((r) => r.active)
      .map((r) => fixturePack.gates.find((g) => g.id === r.id)!.klass),
  );
  for (const required of REQUIRED_KEEP_KLASSES) {
    if (!activeKlasses.has(required)) {
      failures.push({
        caseId: "__summary__",
        reason: `missing_required_keep_klass:${required}`,
      });
    }
  }

  return {
    passed: failures.length === 0,
    version: fixturePack.version,
    totalGates: caseResults.length,
    activeCount: caseResults.filter((r) => r.active).length,
    nonBlockingCount: caseResults.filter((r) => !r.active).length,
    caseResults,
    failures,
  };
}

function evaluateGate(
  gate: GateRegistryEntry,
  policy: GateRegistryPolicy,
): GateConsolidationCaseResult {
  const active = policy.activeStatuses.includes(gate.status);
  const hasCustomerVisibleRisk =
    typeof gate.customerVisibleRisk === "string" &&
    gate.customerVisibleRisk.trim().length > 0;
  const violations: string[] = [];

  if (active && policy.requiredCustomerVisibleRiskForKeep && !hasCustomerVisibleRisk) {
    violations.push("active_gate_missing_customer_visible_risk");
  }
  if (active && gate.metaOnly) {
    violations.push("meta_only_gate_in_active_list");
  }
  if (active && !gate.feedsPilotDecision) {
    violations.push("active_gate_does_not_feed_pilot_decision");
  }
  if (!active && hasCustomerVisibleRisk && policy.nonBlockingStatuses.includes(gate.status)) {
    // Non-active gate carrying a customer-visible risk is a smell — either
    // promote it back to keep or strip the risk claim.
    violations.push("non_active_gate_claims_customer_visible_risk");
  }
  if (gate.evidence.length === 0) {
    violations.push("missing_evidence_pointer");
  }

  return {
    id: gate.id,
    status: gate.status,
    active,
    hasCustomerVisibleRisk,
    metaOnly: gate.metaOnly,
    feedsPilotDecision: gate.feedsPilotDecision,
    violations,
  };
}
