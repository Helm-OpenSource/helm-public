import { describe, expect, it } from "vitest";

import type { OperatingSignalFlowEvent } from "../operating-signal-flow/contract";
import type {
  OperatingSignalSourceClass,
  OperatingSignalSourceEnvelope,
  OperatingSignalUse,
} from "../operating-signal-governance/source-governance";
import { assertAdviceOnlyJudgement, type JudgementFusionInput } from "./contract";
import { fuseOperatingSignals, singleSignalBaseline } from "./fuse";

const HIGH_RISK_FORBIDDEN: OperatingSignalUse[] = [
  "memory_promotion",
  "automatic_customer_action",
  "external_send",
  "writeback",
  "performance_evaluation",
];

function syntheticSource(
  signalId: string,
  allowedUses: OperatingSignalUse[],
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

function fleetSource(signalId: string): OperatingSignalSourceEnvelope {
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

function makeEvent(overrides: Partial<OperatingSignalFlowEvent> = {}): OperatingSignalFlowEvent {
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

function signal(
  event: Partial<OperatingSignalFlowEvent>,
  sourceClass: OperatingSignalSourceClass = "synthetic_public",
  allowedUses: OperatingSignalUse[] = ["fixture_validation"],
) {
  const evt = makeEvent(event);
  const source =
    sourceClass === "fleet_customer_health"
      ? fleetSource(evt.signalKey)
      : syntheticSource(evt.signalKey, allowedUses);
  return { event: evt, source };
}

function input(
  signals: ReturnType<typeof signal>[],
  intendedUse: OperatingSignalUse = "fixture_validation",
): JudgementFusionInput {
  return {
    schemaVersion: "helm.operating-judgement-fusion.v1",
    objectRef: "Deal:deal-17",
    objectKind: "Deal",
    signals,
    intendedUse,
  };
}

describe("fuseOperatingSignals", () => {
  it("fuses aligned signals into a coherent advice judgement", () => {
    const result = fuseOperatingSignals(
      input([
        signal({ signalKey: "sig-a", signalFamily: "commitment", confidenceBand: "medium" }),
        signal({
          signalKey: "sig-b",
          signalFamily: "pacing",
          confidenceBand: "low",
          evidenceCoverage: { provided: 1, required: 2 },
          evidenceRefs: ["meeting-note-05"],
        }),
      ]),
    );

    expect(result.ok).toBe(true);
    expect(result.judgement).not.toBeNull();
    const judgement = result.judgement!;
    expect(judgement.commitmentClass).toBe("advice");
    expect(judgement.disposition).toBe("draft_next_action");
    expect(judgement.confidence.band).toBe("medium");
    expect(judgement.confidence.method).toBe("deterministic_evidence_family_fusion");
    expect(judgement.fusedSignalKeys.sort()).toEqual(["sig-a", "sig-b"]);
    expect(judgement.contributingFamilies.sort()).toEqual(["commitment", "pacing"]);
    expect(assertAdviceOnlyJudgement(judgement)).toEqual({ ok: true, errors: [] });
  });

  it("flags commitment-vs-risk contradiction and forces review", () => {
    const result = fuseOperatingSignals(
      input([
        signal({ signalKey: "sig-a", signalFamily: "commitment", confidenceBand: "high" }),
        signal({ signalKey: "sig-b", signalFamily: "risk", confidenceBand: "high" }),
      ]),
    );

    expect(result.ok).toBe(true);
    const judgement = result.judgement!;
    expect(judgement.conflictFlags).toContain("commitment_advance_vs_risk_contradiction");
    expect(judgement.disposition).toBe("prepare_review_packet");
    expect(judgement.confidence.band).toBe("mixed");
  });

  it("returns request_evidence with low confidence on an evidence gap", () => {
    const result = fuseOperatingSignals(
      input([
        signal({
          signalKey: "sig-a",
          signalFamily: "evidence_gap",
          confidenceBand: "low",
          evidenceCoverage: { provided: 0, required: 3 },
          evidenceRefs: [],
        }),
      ]),
    );

    expect(result.ok).toBe(true);
    const judgement = result.judgement!;
    expect(judgement.disposition).toBe("request_evidence");
    expect(judgement.confidence.band).toBe("unknown");
    expect(judgement.confidence.score).toBe(0);
  });

  it("hard-fails the source-class gate for fleet health under an improvement use", () => {
    const result = fuseOperatingSignals(
      input(
        [signal({ signalKey: "sig-a", signalFamily: "risk" }, "fleet_customer_health")],
        "heldout_eval",
      ),
    );

    expect(result.ok).toBe(false);
    expect(result.judgement).toBeNull();
    expect(result.blockers).toContain("source_class_gate_failed");
    expect(
      result.gate.errors.some((error) =>
        error.includes("source_class_forbidden_from_improvement_loop:fleet_customer_health"),
      ),
    ).toBe(true);
  });

  it("excludes cross-tenant, llm-ranked, boundary-blocked, off-object and pre-link signals", () => {
    const result = fuseOperatingSignals(
      input([
        signal({ signalKey: "ok", signalFamily: "commitment" }),
        signal({ signalKey: "xtenant", crossTenantProjection: true }),
        signal({ signalKey: "llm", confidenceSource: "llm_ranking" }),
        signal({ signalKey: "blocked", boundaryCheckResult: "blocked" }),
        signal({ signalKey: "elsewhere", objectRef: "Deal:other" }),
        signal({ signalKey: "prelink", transitionTo: "NORMALIZED" }),
      ]),
    );

    expect(result.ok).toBe(true);
    expect(result.admittedSignalKeys).toEqual(["ok"]);
    const reasons = Object.fromEntries(
      result.excludedSignalKeys.map((entry) => [entry.signalKey, entry.reason]),
    );
    expect(reasons.xtenant).toBe("cross_tenant_projection_forbidden");
    expect(reasons.llm).toBe("llm_ranking_forbidden");
    expect(reasons.blocked).toBe("boundary_blocked");
    expect(reasons.elsewhere).toBe("different_object");
    expect(reasons.prelink).toBe("not_yet_linked");
  });

  it("excludes raw / private / unsafe-evidence signals as blockers, not silent drops", () => {
    const result = fuseOperatingSignals(
      input([
        signal({ signalKey: "ok", signalFamily: "commitment" }),
        signal({ signalKey: "raw", redactionStatus: "raw_blocked" }),
        signal({ signalKey: "pii", sourceRef: "reach me at person@corp.example.com" }),
        signal({ signalKey: "unsafe-ev", evidenceRefs: ["writeback:crm-queue"] }),
      ]),
    );

    expect(result.ok).toBe(true);
    expect(result.admittedSignalKeys).toEqual(["ok"]);
    const reasons = Object.fromEntries(
      result.excludedSignalKeys.map((entry) => [entry.signalKey, entry.reason]),
    );
    expect(reasons.raw).toBe("raw_blocked");
    expect(reasons.pii).toBe("raw_or_private_content");
    expect(reasons["unsafe-ev"]).toBe("unsafe_evidence_ref");
  });

  it("hard-fails the gate when the source envelope is not bound to the signal", () => {
    const bound = signal({ signalKey: "sig-a", signalFamily: "commitment" });
    const mismatched = { ...bound, source: { ...bound.source, signalId: "different-key" } };
    const result = fuseOperatingSignals(input([mismatched]));

    expect(result.ok).toBe(false);
    expect(result.judgement).toBeNull();
    expect(
      result.gate.errors.some((error) => error.includes("source_envelope_signal_mismatch")),
    ).toBe(true);
  });

  it("singleSignalBaseline produces a one-signal judgement (the baseline fusion must beat)", () => {
    const result = singleSignalBaseline(
      input([
        signal({ signalKey: "sig-a", signalFamily: "commitment", confidenceBand: "low" }),
        signal({ signalKey: "sig-b", signalFamily: "risk", confidenceBand: "high" }),
      ]),
    );

    expect(result.ok).toBe(true);
    expect(result.judgement!.fusedSignalKeys).toEqual(["sig-b"]);
    expect(result.judgement!.contributingFamilies).toEqual(["risk"]);
  });
});
