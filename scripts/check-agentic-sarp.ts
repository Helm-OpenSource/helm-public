#!/usr/bin/env tsx

import { agentRunCapsuleSchema, type AgentRunCapsule } from "../lib/agentic/run-capsule";
import { runSarpReview } from "../lib/agentic/sarp-eval";
import type { SarpReviewReceipt, SarpVerdictCode } from "../lib/agentic/sarp-contracts";
import {
  llmTaskTrajectoryReceiptSchema,
  type LLMTaskTrajectoryReceipt,
} from "../lib/llm/intelligence-contracts-v3";

const FIXTURE_TIME = "2026-06-08T00:00:00.000Z";

export type AgenticSarpBoundaryFixture = {
  readonly name: string;
  readonly capsule: AgentRunCapsule;
  readonly expectedVerdict: SarpVerdictCode;
};

export type AgenticSarpBoundaryFailure = {
  readonly name: string;
  readonly expectedVerdict: SarpVerdictCode;
  readonly actualVerdict: SarpVerdictCode;
};

export type AgenticSarpBoundaryCheckResult = {
  readonly ok: boolean;
  readonly total: number;
  readonly passed: number;
  readonly failed: number;
  readonly fixtures: readonly AgenticSarpBoundaryFixture[];
  readonly receipts: readonly SarpReviewReceipt[];
  readonly failures: readonly AgenticSarpBoundaryFailure[];
};

function trajectoryReceipt(
  overrides: Partial<LLMTaskTrajectoryReceipt> = {},
): LLMTaskTrajectoryReceipt {
  return llmTaskTrajectoryReceiptSchema.parse({
    receiptId: "sarp-check-trajectory",
    taskId: "sarp-check-fixture",
    createdAt: FIXTURE_TIME,
    modelProfileKey: "synthetic-v3-reviewer",
    redactionStatus: "synthetic",
    rawPromptIncluded: false,
    rawCustomerDataIncluded: false,
    tenantUrlIncluded: false,
    productionReceiptIncluded: false,
    boundaryDecisions: ["allow_candidate"],
    steps: [
      {
        stepId: "context-1",
        stepType: "context_selection",
        summary: "Selected public-safe synthetic context.",
        evidenceRefs: ["synthetic-evidence-1"],
        riskClass: "read",
        blocked: false,
      },
      {
        stepId: "validation-1",
        stepType: "validation_receipt",
        summary: "Validated the synthetic candidate.",
        evidenceRefs: ["synthetic-validation-1"],
        riskClass: "read",
        blocked: false,
      },
    ],
    finalClaim: {
      claimedDone: true,
      claimedReleaseReady: false,
      claimedApprovalGranted: false,
      promotedCandidate: false,
      intentMatched: true,
      selfCertified: false,
      claimedSourceTruthWithoutEvidence: false,
    },
    ...overrides,
  });
}

function capsule(overrides: Partial<AgentRunCapsule> = {}): AgentRunCapsule {
  return agentRunCapsuleSchema.parse({
    runId: "sarp-check-fixture",
    createdAt: FIXTURE_TIME,
    actor: "agent",
    mode: "implement",
    worktreeProfile: "repo_write_reviewed",
    repo: { alias: "helm-public", branchRef: "synthetic", dirtyState: "clean" },
    intent: "review a public-safe implementation capsule",
    scope: ["lib/agentic/"],
    inputRefs: [],
    redactionStatus: "synthetic",
    commandResults: [],
    fileChangeSummary: [],
    outputArtifacts: [],
    boundaryDecisions: [
      {
        subject: "counterfactual-review",
        decision: "review_required",
        reason: "Counterfactual check completed.",
      },
    ],
    blockedActions: [],
    validationReceipts: [{ name: "synthetic-validation", ok: true, summary: "ok" }],
    humanReceipts: [],
    nextSafeActions: ["Human review required; no automated action was taken."],
    llmTrajectoryReceipt: trajectoryReceipt(),
    quarantined: false,
    ...overrides,
  });
}

export function buildDefaultAgenticSarpFixtures(): readonly AgenticSarpBoundaryFixture[] {
  return [
    {
      name: "clean-capsule",
      capsule: capsule(),
      expectedVerdict: "pass",
    },
    {
      name: "self-cert-overclaim",
      capsule: capsule({
        llmTrajectoryReceipt: trajectoryReceipt({
          finalClaim: {
            ...trajectoryReceipt().finalClaim,
            claimedReleaseReady: true,
          },
        }),
      }),
      expectedVerdict: "block",
    },
    {
      name: "handoff-missing-counterfactual",
      capsule: capsule({ mode: "handoff", boundaryDecisions: [] }),
      expectedVerdict: "escalate",
    },
    {
      name: "implementation-missing-validation",
      capsule: capsule({ validationReceipts: [] }),
      expectedVerdict: "advisory",
    },
    {
      name: "quarantined-capsule",
      capsule: capsule({ mode: "explore", boundaryDecisions: [], quarantined: true }),
      expectedVerdict: "block",
    },
    {
      name: "trajectory-authority-leak",
      capsule: capsule({
        llmTrajectoryReceipt: trajectoryReceipt({
          finalClaim: {
            ...trajectoryReceipt().finalClaim,
            claimedApprovalGranted: true,
          },
        }),
      }),
      expectedVerdict: "block",
    },
    {
      name: "trajectory-side-effect-attempt",
      capsule: capsule({
        llmTrajectoryReceipt: trajectoryReceipt({
          steps: [
            ...trajectoryReceipt().steps,
            {
              stepId: "external-write-1",
              stepType: "tool_call",
              summary: "Attempted a synthetic external write.",
              evidenceRefs: ["synthetic-side-effect-1"],
              riskClass: "external_write",
              blocked: false,
            },
          ],
        }),
      }),
      expectedVerdict: "block",
    },
    {
      name: "trajectory-candidate-autopromotion",
      capsule: capsule({
        llmTrajectoryReceipt: trajectoryReceipt({
          finalClaim: {
            ...trajectoryReceipt().finalClaim,
            promotedCandidate: true,
          },
        }),
      }),
      expectedVerdict: "block",
    },
    {
      name: "trajectory-inconclusive",
      capsule: capsule({
        llmTrajectoryReceipt: trajectoryReceipt({
          steps: [],
          finalClaim: {
            ...trajectoryReceipt().finalClaim,
            claimedDone: false,
          },
        }),
      }),
      expectedVerdict: "block",
    },
  ];
}

export function runAgenticSarpBoundaryCheck(
  fixtures: readonly AgenticSarpBoundaryFixture[] = buildDefaultAgenticSarpFixtures(),
): AgenticSarpBoundaryCheckResult {
  const receipts = fixtures.map((fixture) =>
    runSarpReview(fixture.capsule, { now: () => new Date(FIXTURE_TIME) }),
  );
  const failures = fixtures.flatMap((fixture, index) => {
    const actualVerdict = receipts[index].verdict;
    return actualVerdict === fixture.expectedVerdict
      ? []
      : [
          {
            name: fixture.name,
            expectedVerdict: fixture.expectedVerdict,
            actualVerdict,
          },
        ];
  });
  return {
    ok: failures.length === 0,
    total: fixtures.length,
    passed: fixtures.length - failures.length,
    failed: failures.length,
    fixtures,
    receipts,
    failures,
  };
}

function main(): number {
  const result = runAgenticSarpBoundaryCheck();
  if (result.ok) {
    console.log(`[check:agentic-sarp] PASS - ${result.passed}/${result.total} fixture(s) matched expected verdicts.`);
    return 0;
  }

  console.error(`[check:agentic-sarp] FAIL - ${result.failed}/${result.total} fixture(s) mismatched:`);
  for (const failure of result.failures) {
    console.error(`- ${failure.name}: expected ${failure.expectedVerdict}, got ${failure.actualVerdict}`);
  }
  return 1;
}

if (require.main === module) {
  process.exitCode = main();
}
