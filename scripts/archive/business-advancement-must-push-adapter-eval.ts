#!/usr/bin/env tsx
/**
 * Helm Business Advancement — Phase 2 Must Push Adapter Eval
 *
 * Offline evaluator for the planning-only Signal -> Must Push adapter.
 * No database, no network, no runtime extractor, no write authority.
 */

import { ADVANCEMENT_SIGNAL_FIXTURES } from "../features/business-advancement/fixtures";
import { FIXTURE_FEASIBILITY_MATRIX } from "../features/business-advancement/read-model-feasibility";
import {
  summarizeMustPushAdapter,
  type MustPushActiveCandidate,
  type MustPushAdapterResult,
  type MustPushDeferredCandidate,
} from "../features/business-advancement/must-push-adapter";

interface AdapterEvalCheck {
  readonly name: string;
  readonly passed: boolean;
  readonly detail: string;
}

const summary = summarizeMustPushAdapter(
  ADVANCEMENT_SIGNAL_FIXTURES,
  FIXTURE_FEASIBILITY_MATRIX,
  5
);

const checks: readonly AdapterEvalCheck[] = [
  checkAllFixturesProcessed(summary.results),
  checkCandidateCounts(summary.results),
  checkTopItemsCompressed(summary.topItems.length),
  checkActiveCandidateGrounding(summary.results),
  checkDeferredFutureOnlyAndBlocked(summary.results),
  checkNoForbiddenPrimaryActionLanguage(summary.results),
];

console.log("\nHelm Business Advancement — Phase 2 Must Push Adapter Eval");
console.log("================================================================");
console.log(`Total fixtures:     ${summary.total}`);
console.log(`Active candidates:  ${summary.active}`);
console.log(`Deferred results:   ${summary.deferred}`);
console.log(`Top items:          ${summary.topItems.length}`);

console.log("\nTop Must Push Items:");
for (const item of summary.topItems) {
  console.log(
    `  ${item.itemId.padEnd(20)} ${item.riskLevel.padEnd(6)} ${item.reviewPosture.padEnd(20)} ${item.title}`
  );
}

console.log("\nDeferred Results:");
for (const result of summary.results.filter(isDeferred)) {
  console.log(
    `  ${result.fixtureId.padEnd(10)} ${result.feasibilityStatus.padEnd(28)} ${result.reason}`
  );
}

console.log("\nEval Checks:");
for (const check of checks) {
  console.log(`  ${check.passed ? "PASS" : "FAIL"} ${check.name}`);
  if (!check.passed) {
    console.log(`    ${check.detail}`);
  }
}

const failed = checks.filter((check) => !check.passed);
if (failed.length > 0) {
  console.error(`\n${checks.length - failed.length}/${checks.length} checks passed`);
  console.error("Phase 2 Must Push adapter eval FAILED\n");
  process.exit(1);
}

console.log(`\n${checks.length}/${checks.length} checks passed`);
console.log("Phase 2 Must Push adapter eval PASSED\n");

function checkAllFixturesProcessed(
  results: readonly MustPushAdapterResult[]
): AdapterEvalCheck {
  return {
    name: "all_fixtures_processed",
    passed: results.length === 20,
    detail: `Expected 20 results, got ${results.length}.`,
  };
}

function checkCandidateCounts(
  results: readonly MustPushAdapterResult[]
): AdapterEvalCheck {
  const active = results.filter(isActive).length;
  const deferred = results.filter(isDeferred).length;
  return {
    name: "candidate_counts",
    passed: active === 14 && deferred === 6,
    detail: `Expected active=14 and deferred=6, got active=${active}, deferred=${deferred}.`,
  };
}

function checkTopItemsCompressed(topCount: number): AdapterEvalCheck {
  return {
    name: "top_items_compressed_to_3_5",
    passed: topCount >= 3 && topCount <= 5,
    detail: `Expected 3-5 top items, got ${topCount}.`,
  };
}

function checkActiveCandidateGrounding(
  results: readonly MustPushAdapterResult[]
): AdapterEvalCheck {
  const violations = results.filter(isActive).filter((result) => {
    const item = result.item;
    return (
      item.evidenceRefs.length === 0 ||
      item.boundaryNote.trim() === "" ||
      item.sourceSummary.trim() === "" ||
      item.primaryAction.trim() === ""
    );
  });

  return {
    name: "active_candidates_are_grounded",
    passed: violations.length === 0,
    detail: `Ungrounded active candidates: ${violations.map((v) => v.fixtureId).join(", ")}`,
  };
}

function checkDeferredFutureOnlyAndBlocked(
  results: readonly MustPushAdapterResult[]
): AdapterEvalCheck {
  const invalid = results.filter(isDeferred).filter(
    (result) =>
      result.reason !== "future_only" &&
      result.reason !== "blocked_boundary"
  );

  return {
    name: "deferred_results_are_future_or_blocked",
    passed: invalid.length === 0,
    detail: `Invalid deferred reasons: ${invalid.map((v) => v.fixtureId).join(", ")}`,
  };
}

function checkNoForbiddenPrimaryActionLanguage(
  results: readonly MustPushAdapterResult[]
): AdapterEvalCheck {
  const forbiddenTerms = [
    "auto",
    "execute",
    "approve",
    "send",
    "write",
    "commitment",
    "自动",
    "执行",
    "审批",
    "批准",
    "发送",
    "写入",
    "承诺",
  ];
  const violations = results.filter(isActive).filter((result) => {
    const action = result.item.primaryAction.toLowerCase();
    return forbiddenTerms.some((term) => action.includes(term));
  });

  return {
    name: "no_forbidden_primary_action_language",
    passed: violations.length === 0,
    detail: `Forbidden primary action language: ${violations.map((v) => v.fixtureId).join(", ")}`,
  };
}

function isActive(result: MustPushAdapterResult): result is MustPushActiveCandidate {
  return result.status === "active";
}

function isDeferred(
  result: MustPushAdapterResult
): result is MustPushDeferredCandidate {
  return result.status === "deferred";
}
