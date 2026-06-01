#!/usr/bin/env tsx
/**
 * Helm Business Advancement - Phase 3B / TPQR-001 / PF3-001
 * Blocked-decision planning CLI.
 *
 * Prints the deterministic planning summary for the meeting / blocked_decision
 * artifact and exits non-zero on any failed evaluator check. This is a
 * planning-only artifact; it does NOT touch a database, network, schema,
 * runtime extractor, API route, or any production query.
 */

import {
  BLOCKED_DECISION_PLANNING_FIXTURE_ROWS,
  BLOCKED_DECISION_PLANNING_REFERENCE_CLOCK_MS,
  evaluateBlockedDecisionPlanning,
} from "../features/business-advancement/phase3b-blocked-decision-planning";

const summary = evaluateBlockedDecisionPlanning(
  BLOCKED_DECISION_PLANNING_FIXTURE_ROWS,
  BLOCKED_DECISION_PLANNING_REFERENCE_CLOCK_MS,
);

console.log(
  "\nHelm Business Advancement - Phase 3B / TPQR-001 / PF3-001 Blocked-Decision Planning",
);
console.log(
  "================================================================================",
);
console.log(`tpqrId:                ${summary.tpqrId}`);
console.log(`preflightId:           ${summary.preflightId}`);
console.log(`thresholdMs:           ${summary.thresholdMs} (48h planning candidate; not production)`);
console.log(`referenceClockMs:      ${summary.referenceClockMs}`);
console.log(`totalSourceRows:       ${summary.totalSourceRows}`);
console.log(`includedCount:         ${summary.includedCount}`);
console.log(`excludedCount:         ${summary.excludedCount}`);
console.log();

console.log("Included Planning Candidates");
console.log(
  "--------------------------------------------------------------------------------",
);
for (const candidate of summary.candidates) {
  console.log(`${candidate.itemId} (sortKey=${candidate.sortKey})`);
  console.log(`  sourceRowId:            ${candidate.sourceRowId}`);
  console.log(`  title:                  ${candidate.title}`);
  console.log(`  stalenessMs:            ${candidate.stalenessMs}`);
  console.log(`  reviewPosture:          ${candidate.reviewPosture}`);
  console.log(`  riskLevel:              ${candidate.riskLevel}`);
  console.log(`  deepLinkPlanningTarget: ${candidate.deepLinkPlanningTarget}`);
  console.log(`  primaryAction:          ${candidate.primaryAction}`);
  console.log();
}

console.log("Excluded Rows");
console.log(
  "--------------------------------------------------------------------------------",
);
for (const row of summary.excluded) {
  console.log(`${row.sourceRowId}`);
  console.log(`  reason:                 ${row.reason}`);
  console.log(`  detail:                 ${row.detail}`);
  console.log();
}

console.log("Eval Checks");
console.log(
  "--------------------------------------------------------------------------------",
);
for (const check of summary.checks) {
  const mark = check.passed ? "PASS" : "FAIL";
  console.log(`  ${mark} ${check.checkName}`);
  if (!check.passed) {
    console.log(`       ${check.detail}`);
  }
}

const failed = summary.checks.filter((c) => !c.passed);
if (failed.length > 0) {
  console.error(
    `\n${summary.checks.length - failed.length}/${summary.checks.length} checks passed`,
  );
  console.error(
    "TPQR-001 / PF3-001 blocked-decision planning artifact FAILED - do not advance Phase 3B planning\n",
  );
  process.exit(1);
}

console.log(
  `\n${summary.checks.length}/${summary.checks.length} checks passed`,
);
console.log(
  "TPQR-001 / PF3-001 blocked-decision planning artifact PASSED (planning-only; no runtime adoption)\n",
);
