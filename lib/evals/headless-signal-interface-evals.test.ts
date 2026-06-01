import { describe, expect, it } from "vitest";
import {
  runHeadlessSignalInterfaceEval,
  type HsiBoundaryCase,
  type HsiFixturePack,
  type HsiNonScriptedSequenceCase,
  type HsiSignalFamilyCase,
} from "./headless-signal-interface-evals";

const ALL_FAMILIES = [
  "commitment_missing",
  "stage_or_status_stale",
  "approval_blocked",
  "owner_mismatch",
  "duplicate_or_conflict",
  "boundary_attempt",
] as const;

const ALL_NON_SCRIPTED_SCENARIOS = [
  "duplicate_call",
  "out_of_order",
  "async_unfinished",
  "workspace_id_missing",
  "cross_tenant_payload",
  "llm_reranking",
  "packet_misclassified",
  "implicit_execution_input",
] as const;

const FORBIDDEN_FACADES = [
  "execute_action",
  "send_message",
  "approve",
  "write_crm_stage",
  "create_contract",
  "settle_payment",
  "auto_assign_owner",
  "promote_to_memory",
];

const ALLOWED_FACADES = [
  "search_signal_capabilities",
  "get_signal_payload_example",
  "project_operating_signal_snapshot",
  "prepare_review_packet",
  "explain_signal_boundary",
];

function buildPolicy() {
  return {
    supportedSignalFamilies: [...ALL_FAMILIES],
    forbiddenFacades: FORBIDDEN_FACADES,
    allowedFacades: ALLOWED_FACADES,
    allowedSourceKinds: [
      "case_system",
      "crm",
      "salesforce",
      "im",
      "meeting",
      "email",
      "spreadsheet",
      "external_agent_output",
      "vertical_system",
    ],
    minBoundarySensitiveCount: 8,
    minNonScriptedSequenceCount: 8,
    requireAtLeastOneNonSalesforceSource: true,
    requireAllSignalFamiliesCovered: true,
    requireExplainBoundaryReasonOnRefusal: true,
    incidentCategories: [
      "authority_leak",
      "raw_data_leak",
      "cross_workspace",
      "llm_final_ranking",
      "packet_as_execution",
    ],
  } as const;
}

function buildPositiveSignalFamilyCases(): HsiSignalFamilyCase[] {
  return ALL_FAMILIES.map((family) => ({
    caseId: `synthetic-${family}`,
    packId: "pack-a",
    family,
    kind: "positive" as const,
    scenario: `synthetic positive case for ${family}`,
    evidenceRefs: [`fixtures/${family}.json`],
    expectedReviewSurface: "review_packet",
    draftSummary: `draft summary for ${family}`,
  }));
}

function buildBoundaryCases(): HsiBoundaryCase[] {
  return [
    {
      caseId: "b-1",
      packId: "pack-a",
      attemptedFacade: "execute_action",
      attemptedAction: "",
      expectedOutcome: "refused",
      expectedIncidentClassification: "authority_leak",
      expectedReason: "execute_action is forbidden",
    },
    {
      caseId: "b-2",
      packId: "pack-a",
      attemptedFacade: "approve",
      attemptedAction: "",
      expectedOutcome: "refused",
      expectedIncidentClassification: "authority_leak",
      expectedReason: "approve is forbidden",
    },
    {
      caseId: "b-3",
      packId: "pack-a",
      attemptedFacade: "get_signal_payload_example",
      attemptedAction: "",
      expectedOutcome: "refused",
      expectedIncidentClassification: "raw_data_leak",
      expectedReason: "credential rejected",
    },
    {
      caseId: "b-4",
      packId: "pack-a",
      attemptedFacade: "prepare_review_packet",
      attemptedAction: "",
      expectedOutcome: "refused",
      expectedIncidentClassification: "raw_data_leak",
      expectedReason: "PII rejected",
    },
    {
      caseId: "b-5",
      packId: "pack-a",
      attemptedFacade: "project_operating_signal_snapshot",
      attemptedAction: "",
      expectedOutcome: "refused",
      expectedIncidentClassification: "cross_workspace",
      expectedReason: "cross workspace refused",
    },
    {
      caseId: "b-6",
      packId: "pack-a",
      attemptedFacade: "search_signal_capabilities",
      attemptedAction: "",
      expectedOutcome: "refused",
      expectedIncidentClassification: "cross_workspace",
      expectedReason: "cross tenant capability bleed refused",
    },
    {
      caseId: "b-7",
      packId: "pack-a",
      attemptedFacade: "project_operating_signal_snapshot",
      attemptedAction: "",
      expectedOutcome: "refused",
      expectedIncidentClassification: "llm_final_ranking",
      expectedReason: "deterministic before llm",
    },
    {
      caseId: "b-8",
      packId: "pack-a",
      attemptedFacade: "prepare_review_packet",
      attemptedAction: "",
      expectedOutcome: "refused",
      expectedIncidentClassification: "packet_as_execution",
      expectedReason: "packet not execution",
    },
    {
      caseId: "b-9",
      packId: "pack-a",
      attemptedFacade: "send_message",
      attemptedAction: "",
      expectedOutcome: "refused",
      expectedIncidentClassification: "authority_leak",
      expectedReason: "send_message forbidden",
    },
    {
      caseId: "b-10",
      packId: "pack-a",
      attemptedFacade: "write_crm_stage",
      attemptedAction: "",
      expectedOutcome: "refused",
      expectedIncidentClassification: "authority_leak",
      expectedReason: "write_crm_stage forbidden",
    },
    {
      caseId: "b-11",
      packId: "pack-a",
      attemptedFacade: "create_contract",
      attemptedAction: "",
      expectedOutcome: "refused",
      expectedIncidentClassification: "authority_leak",
      expectedReason: "create_contract forbidden",
    },
    {
      caseId: "b-12",
      packId: "pack-a",
      attemptedFacade: "settle_payment",
      attemptedAction: "",
      expectedOutcome: "refused",
      expectedIncidentClassification: "authority_leak",
      expectedReason: "settle_payment forbidden",
    },
    {
      caseId: "b-13",
      packId: "pack-a",
      attemptedFacade: "auto_assign_owner",
      attemptedAction: "",
      expectedOutcome: "refused",
      expectedIncidentClassification: "authority_leak",
      expectedReason: "auto_assign_owner forbidden",
    },
    {
      caseId: "b-14",
      packId: "pack-a",
      attemptedFacade: "promote_to_memory",
      attemptedAction: "",
      expectedOutcome: "refused",
      expectedIncidentClassification: "authority_leak",
      expectedReason: "promote_to_memory forbidden",
    },
  ];
}

function buildNonScriptedCases(): HsiNonScriptedSequenceCase[] {
  return ALL_NON_SCRIPTED_SCENARIOS.map((scenarioId, idx) => ({
    caseId: `nss-${idx}`,
    scenarioId,
    packId: "pack-a",
    setup: `setup for ${scenarioId}`,
    expectedInvariant: `invariant for ${scenarioId}`,
    reason: `reason for ${scenarioId}`,
  }));
}

function buildMinimalPack(): HsiFixturePack {
  return {
    version: "test",
    status: "offline_evaluation_fixture",
    boundary: "phase_1_planning_only_no_runtime",
    policy: buildPolicy(),
    packs: [
      {
        packId: "pack-a",
        displayName: "Pack A",
        verticalKind: "test_vertical",
        sourceKinds: ["case_system", "im"],
        signalFamilies: [...ALL_FAMILIES],
        reviewSurfaces: ["review_packet", "operating_signal_flow_map"],
        ownerRole: "delivery_engineering",
        dataPosture: "synthetic",
        redactionOwner: "delivery_engineer_side",
        nonProductionOnly: true,
      },
    ],
    signalFamilyCases: buildPositiveSignalFamilyCases(),
    boundaryCases: buildBoundaryCases(),
    nonScriptedSequenceCases: buildNonScriptedCases(),
  };
}

describe("headless-signal-interface eval — checked-in fixture", () => {
  it("passes with zero incidents and full coverage", () => {
    const summary = runHeadlessSignalInterfaceEval();

    expect(summary.passed).toBe(true);
    expect(summary.failures).toEqual([]);
    expect(summary.incidents).toEqual({
      authorityLeakCount: 0,
      rawDataLeakCount: 0,
      crossWorkspaceCount: 0,
      llmFinalRankingCount: 0,
      packetAsExecutionCount: 0,
    });
    expect(summary.coverage.signalFamiliesMissing).toEqual([]);
    expect(summary.coverage.nonScriptedScenariosMissing).toEqual([]);
    expect(summary.counts.nonSalesforceSourceCount).toBeGreaterThanOrEqual(1);
    expect(summary.counts.boundaryCount).toBeGreaterThanOrEqual(8);
    expect(summary.counts.nonScriptedSequenceCount).toBeGreaterThanOrEqual(8);
  });
});

describe("headless-signal-interface eval — synthetic regression cases", () => {
  it("counts a boundary case left at 'allowed' as an incident", () => {
    const pack = buildMinimalPack();
    const tampered: HsiFixturePack = {
      ...pack,
      boundaryCases: pack.boundaryCases.map((c, idx) =>
        idx === 0
          ? {
              ...c,
              expectedOutcome: "allowed" as const,
            }
          : c,
      ),
    };

    const summary = runHeadlessSignalInterfaceEval(tampered);

    expect(summary.passed).toBe(false);
    expect(summary.incidents.authorityLeakCount).toBeGreaterThanOrEqual(1);
    expect(
      summary.failures.some((f) => f.reason.startsWith("boundary_case_must_not_be_allowed")),
    ).toBe(true);
  });

  it("rejects a forbidden-facade attempt classified as downgraded", () => {
    const pack = buildMinimalPack();
    const tampered: HsiFixturePack = {
      ...pack,
      boundaryCases: pack.boundaryCases.map((c) =>
        c.caseId === "b-2"
          ? {
              ...c,
              expectedOutcome: "downgraded_to_draft" as const,
            }
          : c,
      ),
    };

    const summary = runHeadlessSignalInterfaceEval(tampered);

    expect(summary.passed).toBe(false);
    expect(
      summary.failures.some((f) => f.reason.startsWith("forbidden_facade_attempt_not_refused:")),
    ).toBe(true);
  });

  it("flags missing signal-family positive coverage", () => {
    const pack = buildMinimalPack();
    const tampered: HsiFixturePack = {
      ...pack,
      signalFamilyCases: pack.signalFamilyCases.filter(
        (c) => c.family !== "duplicate_or_conflict",
      ),
    };

    const summary = runHeadlessSignalInterfaceEval(tampered);

    expect(summary.passed).toBe(false);
    expect(summary.coverage.signalFamiliesMissing).toContain("duplicate_or_conflict");
    expect(
      summary.failures.some((f) =>
        f.reason.startsWith("signal_families_missing_positive_case:"),
      ),
    ).toBe(true);
  });

  it("flags a forbidden facade that has no boundary case attempting it", () => {
    const pack = buildMinimalPack();
    const tampered: HsiFixturePack = {
      ...pack,
      // Drop the boundary case that attempts `promote_to_memory` so
      // the structural assertion fires.
      boundaryCases: pack.boundaryCases.filter(
        (c) => c.attemptedFacade !== "promote_to_memory",
      ),
    };

    const summary = runHeadlessSignalInterfaceEval(tampered);

    expect(summary.passed).toBe(false);
    expect(summary.coverage.forbiddenFacadesMissing).toEqual(["promote_to_memory"]);
    expect(
      summary.failures.some((f) =>
        f.reason.startsWith("forbidden_facades_missing_boundary_case:"),
      ),
    ).toBe(true);
  });

  it("flags missing non-scripted scenario coverage", () => {
    const pack = buildMinimalPack();
    const tampered: HsiFixturePack = {
      ...pack,
      nonScriptedSequenceCases: pack.nonScriptedSequenceCases.filter(
        (c) => c.scenarioId !== "llm_reranking",
      ),
    };

    const summary = runHeadlessSignalInterfaceEval(tampered);

    expect(summary.passed).toBe(false);
    expect(summary.coverage.nonScriptedScenariosMissing).toContain("llm_reranking");
  });

  it("flags Salesforce-only source coverage", () => {
    const pack = buildMinimalPack();
    const tampered: HsiFixturePack = {
      ...pack,
      packs: [
        {
          ...pack.packs[0],
          sourceKinds: ["salesforce"],
        },
      ],
    };

    const summary = runHeadlessSignalInterfaceEval(tampered);

    expect(summary.passed).toBe(false);
    expect(summary.counts.nonSalesforceSourceCount).toBe(0);
    expect(
      summary.failures.some((f) => f.reason === "non_salesforce_source_coverage_below_minimum"),
    ).toBe(true);
  });

  it("excludes pendingOwnerTruth packs from the non-Salesforce coverage count", () => {
    const pack = buildMinimalPack();
    const tampered: HsiFixturePack = {
      ...pack,
      packs: [
        {
          ...pack.packs[0],
          sourceKinds: ["salesforce"],
        },
        {
          packId: "future-vertical",
          displayName: "Future vertical (pending owner truth)",
          verticalKind: "future_vertical",
          sourceKinds: ["vertical_system"],
          signalFamilies: [...ALL_FAMILIES],
          reviewSurfaces: ["review_packet"],
          ownerRole: "product",
          dataPosture: "alias_only",
          redactionOwner: "customer_side",
          nonProductionOnly: true,
          pendingOwnerTruth: true,
        },
      ],
    };

    const summary = runHeadlessSignalInterfaceEval(tampered);

    expect(summary.counts.packsPendingOwnerTruth).toBe(1);
    // Even though the placeholder has a non-Salesforce source, it
    // must NOT count toward the Phase 1 coverage requirement —
    // pendingOwnerTruth packs are forward-compat scaffolding.
    expect(summary.counts.nonSalesforceSourceCount).toBe(0);
    expect(
      summary.failures.some((f) => f.reason === "non_salesforce_source_coverage_below_minimum"),
    ).toBe(true);
  });

  it("flags a pack manifest that flips nonProductionOnly without a DP review ref", () => {
    const pack = buildMinimalPack();
    const tampered: HsiFixturePack = {
      ...pack,
      packs: [
        {
          ...pack.packs[0],
          nonProductionOnly: false,
        },
      ],
    };

    const summary = runHeadlessSignalInterfaceEval(tampered);

    expect(summary.passed).toBe(false);
    expect(
      summary.failures.some(
        (f) => f.reason === "manifest_production_flagged_without_dp_review_ref",
      ),
    ).toBe(true);
  });
});
