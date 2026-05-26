/**
 * Helm — Headless Signal Interface (HSI) offline gate evaluator.
 *
 * Phase 1 OFFLINE, deterministic, no LLM, no network. Verifies the
 * checked-in HSI fixture is internally consistent and satisfies the
 * §7 Phase 1 acceptance metrics declared in:
 *   docs/product/HELM_HEADLESS_SIGNAL_INTERFACE_REQUIREMENTS.md
 *
 * Five hard incident counters must stay at 0:
 *   authorityLeakCount, rawDataLeakCount, crossWorkspaceCount,
 *   llmFinalRankingCount, packetAsExecutionCount.
 *
 * Soft counters (informational, not pass/fail):
 *   signalFamilyPositiveCount, nonSalesforceSourceCount,
 *   packsPendingOwnerTruth.
 */

import hsiCasesFixture from "@/evals/headless-signal-interface/headless-signal-interface-cases.json";
import {
  HSI_SIGNAL_FAMILIES,
  NON_SALESFORCE_SOURCE_KINDS,
  validateHsiPackManifest,
  type HsiPackManifest,
  type HsiSignalFamily,
  type HsiSourceKind,
} from "@/lib/headless-signal-interface/pack-manifest";

export type IncidentClassification =
  | "authority_leak"
  | "raw_data_leak"
  | "cross_workspace"
  | "llm_final_ranking"
  | "packet_as_execution";

export interface HsiSignalFamilyCase {
  readonly caseId: string;
  readonly packId: string;
  readonly family: HsiSignalFamily;
  readonly kind: "positive";
  readonly scenario: string;
  readonly evidenceRefs: readonly string[];
  readonly expectedReviewSurface: string;
  readonly draftSummary: string;
}

export interface HsiBoundaryCase {
  readonly caseId: string;
  readonly packId: string;
  readonly attemptedFacade: string;
  readonly attemptedAction: string;
  readonly expectedOutcome: "refused" | "downgraded_to_draft" | "downgraded_to_review_packet" | "allowed";
  readonly expectedIncidentClassification: IncidentClassification;
  readonly expectedReason: string;
}

export interface HsiNonScriptedSequenceCase {
  readonly caseId: string;
  readonly scenarioId: string;
  readonly packId: string;
  readonly setup: string;
  readonly expectedInvariant: string;
  readonly reason: string;
}

export interface HsiPolicy {
  readonly supportedSignalFamilies: readonly HsiSignalFamily[];
  readonly forbiddenFacades: readonly string[];
  readonly allowedFacades: readonly string[];
  readonly allowedSourceKinds: readonly HsiSourceKind[];
  readonly minBoundarySensitiveCount: number;
  readonly minNonScriptedSequenceCount: number;
  readonly requireAtLeastOneNonSalesforceSource: boolean;
  readonly requireAllSignalFamiliesCovered: boolean;
  readonly requireExplainBoundaryReasonOnRefusal: boolean;
  readonly incidentCategories: readonly IncidentClassification[];
}

export interface HsiFixturePack {
  readonly version: string;
  readonly status: string;
  readonly boundary: string;
  readonly policy: HsiPolicy;
  readonly packs: readonly HsiPackManifest[];
  readonly signalFamilyCases: readonly HsiSignalFamilyCase[];
  readonly boundaryCases: readonly HsiBoundaryCase[];
  readonly nonScriptedSequenceCases: readonly HsiNonScriptedSequenceCase[];
}

export interface HsiEvalSummary {
  readonly passed: boolean;
  readonly version: string;
  readonly counts: {
    readonly packsTotal: number;
    readonly packsPendingOwnerTruth: number;
    readonly nonSalesforceSourceCount: number;
    readonly signalFamilyPositiveCount: number;
    readonly boundaryCount: number;
    readonly nonScriptedSequenceCount: number;
  };
  readonly incidents: {
    readonly authorityLeakCount: number;
    readonly rawDataLeakCount: number;
    readonly crossWorkspaceCount: number;
    readonly llmFinalRankingCount: number;
    readonly packetAsExecutionCount: number;
  };
  readonly coverage: {
    readonly signalFamiliesCovered: readonly HsiSignalFamily[];
    readonly signalFamiliesMissing: readonly HsiSignalFamily[];
    readonly nonScriptedScenariosCovered: readonly string[];
    readonly nonScriptedScenariosMissing: readonly string[];
    readonly forbiddenFacadesCovered: readonly string[];
    readonly forbiddenFacadesMissing: readonly string[];
  };
  readonly failures: ReadonlyArray<{ caseId: string; reason: string }>;
}

const REQUIRED_NON_SCRIPTED_SCENARIOS: readonly string[] = [
  "duplicate_call",
  "out_of_order",
  "async_unfinished",
  "workspace_id_missing",
  "cross_tenant_payload",
  "llm_reranking",
  "packet_misclassified",
  "implicit_execution_input",
];

export function runHeadlessSignalInterfaceEval(
  fixturePack: HsiFixturePack = hsiCasesFixture as unknown as HsiFixturePack,
): HsiEvalSummary {
  const failures: Array<{ caseId: string; reason: string }> = [];
  const policy = fixturePack.policy;

  for (const pack of fixturePack.packs) {
    for (const violation of validateHsiPackManifest(pack)) {
      failures.push({ caseId: pack.packId, reason: violation });
    }
    for (const family of pack.signalFamilies) {
      if (!policy.supportedSignalFamilies.includes(family)) {
        failures.push({
          caseId: pack.packId,
          reason: `pack_uses_unsupported_signal_family:${family}`,
        });
      }
    }
  }

  const realPacks = fixturePack.packs.filter((p) => p.pendingOwnerTruth !== true);
  const packsPendingOwnerTruth = fixturePack.packs.length - realPacks.length;

  const nonSalesforceSourceCount = realPacks.filter((pack) =>
    pack.sourceKinds.some((kind) => NON_SALESFORCE_SOURCE_KINDS.has(kind)),
  ).length;
  if (
    policy.requireAtLeastOneNonSalesforceSource &&
    nonSalesforceSourceCount < 1
  ) {
    failures.push({
      caseId: "__policy__",
      reason: "non_salesforce_source_coverage_below_minimum",
    });
  }

  const positiveFamiliesSeen = new Set<HsiSignalFamily>();
  for (const c of fixturePack.signalFamilyCases) {
    if (c.kind !== "positive") {
      failures.push({
        caseId: c.caseId,
        reason: `signal_family_case_must_be_positive_in_phase_1:${c.kind}`,
      });
      continue;
    }
    if (!HSI_SIGNAL_FAMILIES.includes(c.family)) {
      failures.push({
        caseId: c.caseId,
        reason: `unknown_signal_family:${c.family}`,
      });
    }
    if (!fixturePack.packs.some((p) => p.packId === c.packId)) {
      failures.push({
        caseId: c.caseId,
        reason: `signal_family_case_references_unknown_pack:${c.packId}`,
      });
    }
    if (c.evidenceRefs.length === 0) {
      failures.push({
        caseId: c.caseId,
        reason: "signal_family_case_missing_evidence_refs",
      });
    }
    positiveFamiliesSeen.add(c.family);
  }
  const signalFamiliesMissing = HSI_SIGNAL_FAMILIES.filter(
    (f) => !positiveFamiliesSeen.has(f),
  );
  if (
    policy.requireAllSignalFamiliesCovered &&
    signalFamiliesMissing.length > 0
  ) {
    failures.push({
      caseId: "__policy__",
      reason: `signal_families_missing_positive_case:${signalFamiliesMissing.join(",")}`,
    });
  }

  const incidentCounts: Record<IncidentClassification, number> = {
    authority_leak: 0,
    raw_data_leak: 0,
    cross_workspace: 0,
    llm_final_ranking: 0,
    packet_as_execution: 0,
  };

  const forbiddenFacadesAttempted = new Set<string>();

  for (const c of fixturePack.boundaryCases) {
    if (!policy.incidentCategories.includes(c.expectedIncidentClassification)) {
      failures.push({
        caseId: c.caseId,
        reason: `unknown_incident_classification:${c.expectedIncidentClassification}`,
      });
    }
    if (c.expectedOutcome === "allowed") {
      // A boundary case that ends in "allowed" means the pack design
      // would permit a forbidden action — that is an incident, not a
      // happy path.
      incidentCounts[c.expectedIncidentClassification] += 1;
      failures.push({
        caseId: c.caseId,
        reason: `boundary_case_must_not_be_allowed:${c.expectedIncidentClassification}`,
      });
    }
    if (policy.requireExplainBoundaryReasonOnRefusal && !c.expectedReason.trim()) {
      failures.push({
        caseId: c.caseId,
        reason: "boundary_case_missing_explain_reason",
      });
    }
    if (policy.forbiddenFacades.includes(c.attemptedFacade)) {
      forbiddenFacadesAttempted.add(c.attemptedFacade);
      if (c.expectedOutcome !== "refused") {
        // Forbidden facade attempts must hard-refuse; downgrade is not
        // enough because there is no allowed handler at all.
        incidentCounts[c.expectedIncidentClassification] += 1;
        failures.push({
          caseId: c.caseId,
          reason: `forbidden_facade_attempt_not_refused:${c.attemptedFacade}`,
        });
      }
    }
  }

  const forbiddenFacadesMissing = policy.forbiddenFacades.filter(
    (facade) => !forbiddenFacadesAttempted.has(facade),
  );
  if (forbiddenFacadesMissing.length > 0) {
    // Structural assertion: every forbidden facade declared in the
    // policy must have at least one boundary case that attempts it.
    // Without this, the eval cannot prove the forbidden list is more
    // than a sticky note.
    failures.push({
      caseId: "__policy__",
      reason: `forbidden_facades_missing_boundary_case:${forbiddenFacadesMissing.join(",")}`,
    });
  }

  if (fixturePack.boundaryCases.length < policy.minBoundarySensitiveCount) {
    failures.push({
      caseId: "__policy__",
      reason: `boundary_case_count_below_minimum:${fixturePack.boundaryCases.length}<${policy.minBoundarySensitiveCount}`,
    });
  }

  const nonScriptedSeen = new Set<string>();
  for (const c of fixturePack.nonScriptedSequenceCases) {
    if (!REQUIRED_NON_SCRIPTED_SCENARIOS.includes(c.scenarioId)) {
      failures.push({
        caseId: c.caseId,
        reason: `unknown_non_scripted_scenario:${c.scenarioId}`,
      });
    }
    if (!c.expectedInvariant.trim()) {
      failures.push({
        caseId: c.caseId,
        reason: "non_scripted_case_missing_expected_invariant",
      });
    }
    if (!fixturePack.packs.some((p) => p.packId === c.packId)) {
      failures.push({
        caseId: c.caseId,
        reason: `non_scripted_case_references_unknown_pack:${c.packId}`,
      });
    }
    nonScriptedSeen.add(c.scenarioId);
  }
  const nonScriptedScenariosMissing = REQUIRED_NON_SCRIPTED_SCENARIOS.filter(
    (s) => !nonScriptedSeen.has(s),
  );
  if (nonScriptedScenariosMissing.length > 0) {
    failures.push({
      caseId: "__policy__",
      reason: `non_scripted_scenarios_missing:${nonScriptedScenariosMissing.join(",")}`,
    });
  }
  if (
    fixturePack.nonScriptedSequenceCases.length <
    policy.minNonScriptedSequenceCount
  ) {
    failures.push({
      caseId: "__policy__",
      reason: `non_scripted_count_below_minimum:${fixturePack.nonScriptedSequenceCases.length}<${policy.minNonScriptedSequenceCount}`,
    });
  }

  return {
    passed: failures.length === 0,
    version: fixturePack.version,
    counts: {
      packsTotal: fixturePack.packs.length,
      packsPendingOwnerTruth,
      nonSalesforceSourceCount,
      signalFamilyPositiveCount: fixturePack.signalFamilyCases.length,
      boundaryCount: fixturePack.boundaryCases.length,
      nonScriptedSequenceCount: fixturePack.nonScriptedSequenceCases.length,
    },
    incidents: {
      authorityLeakCount: incidentCounts.authority_leak,
      rawDataLeakCount: incidentCounts.raw_data_leak,
      crossWorkspaceCount: incidentCounts.cross_workspace,
      llmFinalRankingCount: incidentCounts.llm_final_ranking,
      packetAsExecutionCount: incidentCounts.packet_as_execution,
    },
    coverage: {
      signalFamiliesCovered: Array.from(positiveFamiliesSeen).sort(),
      signalFamiliesMissing,
      nonScriptedScenariosCovered: Array.from(nonScriptedSeen).sort(),
      nonScriptedScenariosMissing,
      forbiddenFacadesCovered: Array.from(forbiddenFacadesAttempted).sort(),
      forbiddenFacadesMissing,
    },
    failures,
  };
}
