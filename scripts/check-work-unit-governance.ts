#!/usr/bin/env tsx
/**
 * Public Core guard for Helm Work Unit governance.
 *
 * This is a deterministic synthetic fixture check. It does not read customer
 * data, write private mainline facts, activate runtime paths, send externally,
 * or grant approvals.
 */

import {
  buildDecisionCard,
  computeWorkUnitSnapshotHash,
  helmWorkUnitSchema,
  hwuAcceptanceChecklist,
  validateUserVisibleTerminology,
  validateWorkUnitTransition,
  validateWorkUnitWithinPublicCore,
  type HelmWorkUnit,
  type WorkUnitActor,
  type WorkUnitViolation,
} from "../lib/work-unit-governance/contracts";

const FIXTURE_TIME = "2026-07-19T00:00:00.000Z";

const EXPECTED_REQUIREMENT_IDS = Array.from({ length: 15 }, (_, index) => {
  return `HWU-${String(index + 1).padStart(2, "0")}`;
});

export type WorkUnitGovernanceFixture = {
  readonly name: string;
  readonly workUnit: HelmWorkUnit;
  readonly expectedRules: readonly string[];
};

export type WorkUnitGovernanceTransitionFixture = {
  readonly name: string;
  readonly current: HelmWorkUnit;
  readonly next: HelmWorkUnit;
  readonly actor: WorkUnitActor;
  readonly expectedRules: readonly string[];
};

export type WorkUnitGovernanceTerminologyFixture = {
  readonly name: string;
  readonly input: unknown;
  readonly expectedTerms: readonly string[];
};

export type WorkUnitGovernanceFailure = {
  readonly name: string;
  readonly check: "work-unit" | "transition" | "terminology" | "checklist";
  readonly detail: string;
};

export type WorkUnitGovernanceCheckResult = {
  readonly ok: boolean;
  readonly total: number;
  readonly passed: number;
  readonly failed: number;
  readonly workUnitFixtures: readonly WorkUnitGovernanceFixture[];
  readonly transitionFixtures: readonly WorkUnitGovernanceTransitionFixture[];
  readonly terminologyFixtures: readonly WorkUnitGovernanceTerminologyFixture[];
  readonly failures: readonly WorkUnitGovernanceFailure[];
};

function buildSyntheticWorkUnit(overrides: Partial<HelmWorkUnit> = {}): HelmWorkUnit {
  return helmWorkUnitSchema.parse({
    schemaVersion: "helm.work-unit.v1",
    id: "hwu-synthetic-001",
    objective: "Review a synthetic quote before it enters the company mainline.",
    scope: ["synthetic:quote"],
    status: "candidate",
    initiator: { actorType: "human", actorRef: "initiator-1" },
    owner: { ownerRef: "owner-1", ownerType: "human_owner", displayName: "Synthetic owner" },
    agentRole: "draft",
    sourceSnapshot: {
      sourceRef: "synthetic://quote/Q-001",
      redactionStatus: "synthetic",
      mainlineBaselineRef: "mainline:baseline-1",
      dependencyRefs: [],
    },
    riskClass: "internal_mainline",
    conflictKeys: ["quote:Q-001"],
    candidateArtifacts: [
      {
        artifactId: "candidate-summary",
        kind: "decision_card",
        title: "Synthetic renewal-cost check",
        summary: "Review whether the synthetic quote includes renewal cost basis.",
        state: "candidate",
        producedBy: "ai",
      },
    ],
    evidenceManifest: [
      {
        evidenceRef: "synthetic://evidence/renewal-cost",
        title: "Synthetic renewal cost evidence",
        redactionStatus: "synthetic",
      },
    ],
    changeSummary: {
      changedWhat: "Adds a renewal-cost review requirement to the synthetic quote.",
      affectedWho: ["synthetic owner"],
      basis: ["synthetic://evidence/renewal-cost"],
      riskSummary: "Internal mainline update only; no customer-visible action.",
    },
    requiredOwners: {
      mode: "all_of",
      owners: [{ ownerRef: "owner-1", ownerType: "human_owner", displayName: "Synthetic owner" }],
    },
    validationReceipts: [
      {
        receiptId: "validation-1",
        name: "synthetic-boundary-check",
        ok: true,
        summary: "Synthetic public-safe fixture.",
        createdAt: FIXTURE_TIME,
      },
    ],
    activationScope: "private_workspace_truth",
    rollbackOrRemediationPlan: {
      kind: "rollback",
      summary: "Supersede the synthetic rule with a newer accepted work unit.",
      responsibleOwnerRef: "owner-1",
    },
    auditRefs: [],
    relatedMainlineChanges: [],
    createdAt: FIXTURE_TIME,
    updatedAt: FIXTURE_TIME,
    ...overrides,
  });
}

function acceptedDecision(snapshotHash: string) {
  return {
    decidedBy: { actorType: "human_owner", actorRef: "owner-1" },
    decision: "accepted",
    decidedAt: FIXTURE_TIME,
    snapshotHash,
    rationale: "Synthetic owner accepted this exact candidate snapshot.",
  };
}

function receipt(receiptId: string, snapshotHash: string) {
  return {
    receiptId,
    actor: { actorType: "human_owner", actorRef: "owner-1" },
    snapshotHash,
    createdAt: FIXTURE_TIME,
    summary: "Synthetic human-owner receipt.",
    publicCoreCarriesRealInstance: false,
  };
}

function rulesFrom(violations: readonly WorkUnitViolation[]): readonly string[] {
  return violations.map((violation) => violation.rule);
}

export function buildDefaultWorkUnitGovernanceFixtures(): readonly WorkUnitGovernanceFixture[] {
  const candidate = buildSyntheticWorkUnit();
  const snapshotHash = computeWorkUnitSnapshotHash(candidate);
  const staleHash = "sha256:0000000000000000000000000000000000000000000000000000000000000000";

  return [
    {
      name: "clean-candidate",
      workUnit: candidate,
      expectedRules: [],
    },
    {
      name: "ai-authoritative-state",
      workUnit: buildSyntheticWorkUnit({
        status: "accepted_by_human",
        decisionSnapshotHash: snapshotHash,
        decision: {
          decidedBy: { actorType: "ai", actorRef: "agent-1" },
          decision: "accepted",
          decidedAt: FIXTURE_TIME,
          snapshotHash,
          rationale: "AI attempted to accept the synthetic candidate.",
        },
      }),
      expectedRules: ["ai-cannot-authoritative-state"],
    },
    {
      name: "stale-snapshot-promotion",
      workUnit: buildSyntheticWorkUnit({
        status: "promoted_to_mainline",
        decisionSnapshotHash: staleHash,
        decision: acceptedDecision(staleHash),
        mergeReceipt: receipt("merge-stale", staleHash),
      }),
      expectedRules: ["approval-snapshot-mismatch"],
    },
    {
      name: "conflict-key-mainline-drift",
      workUnit: buildSyntheticWorkUnit({
        status: "accepted_by_human",
        decisionSnapshotHash: snapshotHash,
        decision: acceptedDecision(snapshotHash),
        relatedMainlineChanges: [
          {
            mainlineRef: "mainline:quote:Q-001:v2",
            conflictKeys: ["quote:Q-001"],
            changedAt: "2026-07-19T01:00:00.000Z",
          },
        ],
      }),
      expectedRules: ["approval-invalidated-by-related-mainline-change"],
    },
    {
      name: "high-risk-owner-missing",
      workUnit: buildSyntheticWorkUnit({
        owner: undefined,
        riskClass: "commercial_commitment",
      }),
      expectedRules: ["high-risk-owner-required"],
    },
    {
      name: "runtime-activation-without-independent-receipt",
      workUnit: buildSyntheticWorkUnit({
        status: "activated_by_human",
        riskClass: "runtime_activation",
        activationScope: "production_runtime",
        decisionSnapshotHash: snapshotHash,
        decision: acceptedDecision(snapshotHash),
      }),
      expectedRules: ["activation-needs-independent-receipt"],
    },
  ];
}

export function buildDefaultWorkUnitTransitionFixtures(): readonly WorkUnitGovernanceTransitionFixture[] {
  return [
    {
      name: "ai-risk-downgrade",
      current: buildSyntheticWorkUnit({ riskClass: "customer_visible" }),
      next: buildSyntheticWorkUnit({ riskClass: "local_draft" }),
      actor: { actorType: "ai", actorRef: "agent-1" },
      expectedRules: ["ai-risk-downgrade"],
    },
    {
      name: "ai-human-only-state-transition",
      current: buildSyntheticWorkUnit(),
      next: buildSyntheticWorkUnit({ status: "accepted_by_human" }),
      actor: { actorType: "ai", actorRef: "agent-1" },
      expectedRules: ["human-owner-transition-required"],
    },
  ];
}

export function buildDefaultWorkUnitTerminologyFixtures(): readonly WorkUnitGovernanceTerminologyFixture[] {
  return [
    {
      name: "decision-card-clean",
      input: buildDecisionCard(buildSyntheticWorkUnit()),
      expectedTerms: [],
    },
    {
      name: "nested-github-terms",
      input: {
        primaryAction: "Merge",
        helper: { next: "Open the PR after CI completes." },
      },
      expectedTerms: ["Merge", "PR", "CI"],
    },
  ];
}

function compareExpectedRules(options: {
  readonly name: string;
  readonly check: WorkUnitGovernanceFailure["check"];
  readonly actualRules: readonly string[];
  readonly expectedRules: readonly string[];
}): readonly WorkUnitGovernanceFailure[] {
  const missing = options.expectedRules.filter((rule) => !options.actualRules.includes(rule));
  if (missing.length > 0) {
    return [
      {
        name: options.name,
        check: options.check,
        detail: `missing expected rule(s): ${missing.join(", ")}`,
      },
    ];
  }

  if (options.expectedRules.length === 0 && options.actualRules.length > 0) {
    return [
      {
        name: options.name,
        check: options.check,
        detail: `unexpected rule(s): ${options.actualRules.join(", ")}`,
      },
    ];
  }

  return [];
}

export function runWorkUnitGovernanceBoundaryCheck(options: {
  readonly workUnitFixtures?: readonly WorkUnitGovernanceFixture[];
  readonly transitionFixtures?: readonly WorkUnitGovernanceTransitionFixture[];
  readonly terminologyFixtures?: readonly WorkUnitGovernanceTerminologyFixture[];
} = {}): WorkUnitGovernanceCheckResult {
  const workUnitFixtures =
    options.workUnitFixtures ?? buildDefaultWorkUnitGovernanceFixtures();
  const transitionFixtures =
    options.transitionFixtures ?? buildDefaultWorkUnitTransitionFixtures();
  const terminologyFixtures =
    options.terminologyFixtures ?? buildDefaultWorkUnitTerminologyFixtures();

  const failures: WorkUnitGovernanceFailure[] = [];

  for (const fixture of workUnitFixtures) {
    failures.push(
      ...compareExpectedRules({
        name: fixture.name,
        check: "work-unit",
        actualRules: rulesFrom(validateWorkUnitWithinPublicCore(fixture.workUnit)),
        expectedRules: fixture.expectedRules,
      }),
    );
  }

  for (const fixture of transitionFixtures) {
    failures.push(
      ...compareExpectedRules({
        name: fixture.name,
        check: "transition",
        actualRules: rulesFrom(
          validateWorkUnitTransition({
            current: fixture.current,
            next: fixture.next,
            actor: fixture.actor,
          }),
        ),
        expectedRules: fixture.expectedRules,
      }),
    );
  }

  for (const fixture of terminologyFixtures) {
    const actualTerms = validateUserVisibleTerminology(fixture.input).map((violation) => violation.term);
    failures.push(
      ...compareExpectedRules({
        name: fixture.name,
        check: "terminology",
        actualRules: actualTerms,
        expectedRules: fixture.expectedTerms,
      }),
    );
  }

  const actualRequirementIds = hwuAcceptanceChecklist.map((item) => item.requirementId);
  if (actualRequirementIds.join("|") !== EXPECTED_REQUIREMENT_IDS.join("|")) {
    failures.push({
      name: "hwu-acceptance-checklist",
      check: "checklist",
      detail: `expected ${EXPECTED_REQUIREMENT_IDS.join(", ")}, got ${actualRequirementIds.join(", ")}`,
    });
  }

  const total =
    workUnitFixtures.length + transitionFixtures.length + terminologyFixtures.length + 1;

  return {
    ok: failures.length === 0,
    total,
    passed: total - failures.length,
    failed: failures.length,
    workUnitFixtures,
    transitionFixtures,
    terminologyFixtures,
    failures,
  };
}

function main(): number {
  const result = runWorkUnitGovernanceBoundaryCheck();
  if (result.ok) {
    console.log(
      `[check:work-unit-governance] PASS - ${result.passed}/${result.total} check(s) matched expected boundary outcomes.`,
    );
    return 0;
  }

  console.error(
    `[check:work-unit-governance] FAIL - ${result.failed}/${result.total} check(s) mismatched:`,
  );
  for (const failure of result.failures) {
    console.error(`- ${failure.check}/${failure.name}: ${failure.detail}`);
  }
  return 1;
}

if (require.main === module) {
  process.exitCode = main();
}
