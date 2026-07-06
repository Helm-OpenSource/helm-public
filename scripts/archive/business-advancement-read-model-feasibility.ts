#!/usr/bin/env tsx
/**
 * Helm Business Advancement — Phase 1B Read-Model Feasibility Script
 *
 * Prints a concise feasibility summary for all 20 Phase 1A fixtures.
 * Exits 0 on pass, 1 on fail.
 *
 * Usage:
 *   npx tsx scripts/business-advancement-read-model-feasibility.ts
 */

import {
  evaluateReadModelFeasibility,
  getFeasibilityStats,
  FIXTURE_FEASIBILITY_MATRIX,
} from "../features/business-advancement/read-model-feasibility";

const stats = getFeasibilityStats();
const summary = evaluateReadModelFeasibility();

// ---------------------------------------------------------------------------
// Print feasibility statistics
// ---------------------------------------------------------------------------

console.log("\nFeasibility Statistics:");
console.log(`  Total fixtures:                  ${stats.total}`);
console.log(
  `  current_read_model_supported:    ${stats.byStatus.current_read_model_supported}`
);
console.log(
  `  requires_thin_projection:        ${stats.byStatus.requires_thin_projection}`
);
console.log(
  `  future_only:                     ${stats.byStatus.future_only}`
);

console.log("\nSource Coverage:");
const sourceEntries = Object.entries(stats.bySource).sort(([a], [b]) =>
  a.localeCompare(b)
);
for (const [source, counts] of sourceEntries) {
  const label = source.padEnd(20);
  const detail = `current=${counts.current}  thin=${counts.thin}  future=${counts.future}`;
  console.log(`  ${label}  ${detail}`);
}

console.log(`\nFeasible source class count:     ${stats.feasibleSourceClassCount}`);
console.log(`Future-only count:               ${stats.futureOnlyCount}`);

// ---------------------------------------------------------------------------
// Print fixture classifications
// ---------------------------------------------------------------------------

console.log("\nFixture Classifications:");
const STATUS_LABEL: Record<string, string> = {
  current_read_model_supported: "CURRENT",
  requires_thin_projection: "THIN   ",
  future_only: "FUTURE ",
};
for (const row of FIXTURE_FEASIBILITY_MATRIX) {
  const label = STATUS_LABEL[row.feasibilityStatus] ?? row.feasibilityStatus;
  const candidates = row.candidateReadModels.join(", ");
  const id = row.fixtureId.padEnd(10);
  const src = row.sourceType.padEnd(16);
  const sig = row.signalType.padEnd(32);
  console.log(`  [${label}] ${id} ${src} ${sig} → ${candidates}`);
}

// ---------------------------------------------------------------------------
// Print evaluator results
// ---------------------------------------------------------------------------

console.log(`\n${summary.totalChecks} checks:`);
for (const check of summary.checks) {
  const icon = check.passed ? "✓" : "✗";
  console.log(`  ${icon} ${check.checkName}`);
  if (!check.passed) {
    console.log(`    FAIL: ${check.detail}`);
  }
}

// ---------------------------------------------------------------------------
// Exit
// ---------------------------------------------------------------------------

if (summary.overallPassed) {
  console.log(
    `\n${summary.passed}/${summary.totalChecks} checks passed, ${summary.failed} failed`
  );
  console.log("✓ Phase 1B read-model feasibility PASSED\n");
  process.exit(0);
} else {
  console.error(
    `\n${summary.passed}/${summary.totalChecks} checks passed, ${summary.failed} failed`
  );
  console.error("✗ Phase 1B read-model feasibility FAILED\n");
  process.exit(1);
}
