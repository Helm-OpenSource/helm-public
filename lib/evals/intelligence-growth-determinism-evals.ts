import { runIntelligenceGrowthBudgetGateEval } from "@/lib/evals/intelligence-growth-budget-gate-evals";
import { runIntelligenceGrowthBoundaryStaticEval } from "@/lib/evals/intelligence-growth-boundary-static-evals";
import { runIntelligenceGrowthChainIntegrityEval } from "@/lib/evals/intelligence-growth-chain-integrity-evals";
import { runIntelligenceGrowthCycleAdvanceEval } from "@/lib/evals/intelligence-growth-cycle-advance-evals";
import { runIntelligenceGrowthApprovalReadinessEval } from "@/lib/evals/intelligence-growth-approval-readiness-evals";
import { runIntelligenceGrowthDataProtectionManifestEval } from "@/lib/evals/intelligence-growth-data-protection-manifest-evals";
import { runIntelligenceGrowthDecisionOutcomeEval } from "@/lib/evals/intelligence-growth-decision-outcome-evals";
import { runIntelligenceGrowthDimensionSaturationEval } from "@/lib/evals/intelligence-growth-dimension-saturation-evals";
import { runIntelligenceGrowthEvalReplaySnapshotEval } from "@/lib/evals/intelligence-growth-eval-replay-snapshot-evals";
import { runIntelligenceGrowthFailureTaxonomyCoverageEval } from "@/lib/evals/intelligence-growth-failure-taxonomy-coverage-evals";
import { runIntelligenceGrowthFixtureLintEval } from "@/lib/evals/intelligence-growth-fixture-lint-evals";
import { runIntelligenceGrowthLearningRequeueEval } from "@/lib/evals/intelligence-growth-learning-requeue-evals";
import { runIntelligenceGrowthLiveCalibrationPreflightEval } from "@/lib/evals/intelligence-growth-live-calibration-preflight-evals";
import { runIntelligenceGrowthRemediationRoundtripEval } from "@/lib/evals/intelligence-growth-remediation-roundtrip-evals";
import { runIntelligenceGrowthReviewPacketEval } from "@/lib/evals/intelligence-growth-review-packet-evals";
import { runIntelligenceGrowthSchemaDriftEval } from "@/lib/evals/intelligence-growth-schema-drift-evals";
import { runIntelligenceGrowthTenantSignalEval } from "@/lib/evals/intelligence-growth-tenant-signal-evals";
import { runIntelligenceGrowthWeeklyScorecardEval } from "@/lib/evals/intelligence-growth-weekly-scorecard-evals";
import { runEval } from "@/lib/intelligence-growth/evaluator";

const DEFAULT_REPEAT_COUNT = 3;
const VOLATILE_FIELD_ALLOWLIST = ["runAt"] as const;
const VOLATILE_REPLACEMENT = "__allowed_volatile__";

export type IntelligenceGrowthDeterminismProducer = {
  readonly id: string;
  readonly run: () => unknown;
};

export type IntelligenceGrowthDeterminismEvalOptions = {
  readonly repeatCount?: number;
  readonly producers?: readonly IntelligenceGrowthDeterminismProducer[];
};

export type IntelligenceGrowthDeterminismEvalSummary = {
  readonly passed: boolean;
  readonly repeatCount: number;
  readonly producerCount: number;
  readonly stableProducerCount: number;
  readonly unstableProducerCount: number;
  readonly volatileFieldAllowlist: typeof VOLATILE_FIELD_ALLOWLIST;
  readonly candidateOnly: true;
  readonly runtimeAllowed: false;
  readonly officialWriteAllowed: false;
  readonly autoExecutionAllowed: false;
  readonly canonicalMemoryWriteAllowed: false;
  readonly promptOrPolicyUpdateAllowed: false;
  readonly skillAutoPromotionAllowed: false;
  readonly failures: readonly {
    readonly producerId: string;
    readonly iteration: number;
    readonly reason: string;
  }[];
};

const DEFAULT_PRODUCERS: readonly IntelligenceGrowthDeterminismProducer[] = [
  { id: "core_eval", run: () => runEval() },
  { id: "tenant_signal", run: () => runIntelligenceGrowthTenantSignalEval() },
  { id: "review_packet", run: () => runIntelligenceGrowthReviewPacketEval() },
  { id: "weekly_scorecard", run: () => runIntelligenceGrowthWeeklyScorecardEval() },
  { id: "decision_outcome", run: () => runIntelligenceGrowthDecisionOutcomeEval() },
  { id: "learning_requeue", run: () => runIntelligenceGrowthLearningRequeueEval() },
  { id: "chain_integrity", run: () => runIntelligenceGrowthChainIntegrityEval() },
  { id: "cycle_advance", run: () => runIntelligenceGrowthCycleAdvanceEval() },
  { id: "fixture_lint", run: () => runIntelligenceGrowthFixtureLintEval() },
  { id: "dimension_saturation", run: () => runIntelligenceGrowthDimensionSaturationEval() },
  { id: "remediation_roundtrip", run: () => runIntelligenceGrowthRemediationRoundtripEval() },
  { id: "budget_gate", run: () => runIntelligenceGrowthBudgetGateEval() },
  { id: "boundary_static", run: () => runIntelligenceGrowthBoundaryStaticEval() },
  { id: "eval_replay_snapshot", run: () => runIntelligenceGrowthEvalReplaySnapshotEval() },
  { id: "schema_drift", run: () => runIntelligenceGrowthSchemaDriftEval() },
  { id: "failure_taxonomy_coverage", run: () => runIntelligenceGrowthFailureTaxonomyCoverageEval() },
  { id: "data_protection_manifest", run: () => runIntelligenceGrowthDataProtectionManifestEval() },
  { id: "approval_readiness", run: () => runIntelligenceGrowthApprovalReadinessEval() },
  { id: "live_calibration_preflight", run: () => runIntelligenceGrowthLiveCalibrationPreflightEval() },
];

export function runIntelligenceGrowthDeterminismEval(
  options: IntelligenceGrowthDeterminismEvalOptions = {},
): IntelligenceGrowthDeterminismEvalSummary {
  const repeatCount = options.repeatCount ?? DEFAULT_REPEAT_COUNT;
  const producers = options.producers ?? DEFAULT_PRODUCERS;
  const failures: {
    producerId: string;
    iteration: number;
    reason: string;
  }[] = [];

  if (!Number.isInteger(repeatCount) || repeatCount < 2) {
    failures.push({
      producerId: "__determinism__",
      iteration: 0,
      reason: "repeat_count_must_be_at_least_2",
    });
  }

  const stableProducerIds = new Set<string>();

  for (const producer of producers) {
    const baseline = stringifyCanonical(producer.run());
    let stable = true;
    for (let iteration = 2; iteration <= repeatCount; iteration++) {
      const next = stringifyCanonical(producer.run());
      if (next !== baseline) {
        stable = false;
        failures.push({
          producerId: producer.id,
          iteration,
          reason: "unstable_output",
        });
      }
    }
    if (stable) {
      stableProducerIds.add(producer.id);
    }
  }

  const uniqueFailures = deduplicateFailures(failures);
  const unstableProducerIds = new Set(
    uniqueFailures
      .filter((failure) => failure.reason === "unstable_output")
      .map((failure) => failure.producerId),
  );

  return {
    passed: uniqueFailures.length === 0,
    repeatCount,
    producerCount: producers.length,
    stableProducerCount: stableProducerIds.size,
    unstableProducerCount: unstableProducerIds.size,
    volatileFieldAllowlist: VOLATILE_FIELD_ALLOWLIST,
    candidateOnly: true,
    runtimeAllowed: false,
    officialWriteAllowed: false,
    autoExecutionAllowed: false,
    canonicalMemoryWriteAllowed: false,
    promptOrPolicyUpdateAllowed: false,
    skillAutoPromotionAllowed: false,
    failures: uniqueFailures,
  };
}

function stringifyCanonical(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  const result: Record<string, unknown> = {};
  const input = value as Record<string, unknown>;
  for (const key of Object.keys(input).sort()) {
    result[key] = VOLATILE_FIELD_ALLOWLIST.includes(key as typeof VOLATILE_FIELD_ALLOWLIST[number])
      ? VOLATILE_REPLACEMENT
      : canonicalize(input[key]);
  }
  return result;
}

function deduplicateFailures(
  failures: readonly {
    readonly producerId: string;
    readonly iteration: number;
    readonly reason: string;
  }[],
): readonly {
  readonly producerId: string;
  readonly iteration: number;
  readonly reason: string;
}[] {
  const seen = new Set<string>();
  return failures.filter((failure) => {
    const key = `${failure.producerId}:${failure.iteration}:${failure.reason}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
