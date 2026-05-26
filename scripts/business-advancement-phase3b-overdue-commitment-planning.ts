#!/usr/bin/env tsx
/**
 * Helm Business Advancement - Phase 3B / TPQR-003 / PF3A-003
 * Overdue-commitment planning CLI.
 *
 * Prints the deterministic planning summary for the commitment /
 * overdue_commitment artifact and exits non-zero on any failed evaluator
 * check. This is a planning-only artifact; it does NOT touch a database,
 * network, schema, runtime extractor, API route, or any production query
 * path. The persisted Commitment.overdueFlag column is intentionally NOT
 * used as authority for inclusion; read-time derivation is the sole
 * authority.
 */

import {
  OVERDUE_COMMITMENT_PLANNING_FIXTURE_ROWS,
  OVERDUE_COMMITMENT_PLANNING_REFERENCE_CLOCK_MS,
  evaluateOverdueCommitmentPlanning,
} from "../features/business-advancement/phase3b-overdue-commitment-planning";

const summary = evaluateOverdueCommitmentPlanning(
  OVERDUE_COMMITMENT_PLANNING_FIXTURE_ROWS,
  OVERDUE_COMMITMENT_PLANNING_REFERENCE_CLOCK_MS,
);

console.log(
  "\nHelm Business Advancement - Phase 3B / TPQR-003 / PF3A-003 Overdue-Commitment Planning",
);
console.log(
  "================================================================================",
);
console.log(`tpqrId:                ${summary.tpqrId}`);
console.log(`preflightId:           ${summary.preflightId}`);
console.log(`thresholdRule:         ${summary.thresholdRule}`);
console.log(`graceMs:               ${summary.graceMs} (no grace beyond dueDate; planning rule, not production)`);
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
  console.log(`  dueDateMs:              ${candidate.dueDateMs}`);
  console.log(`  status:                 ${candidate.status}`);
  console.log(`  overdueByMs:            ${candidate.overdueByMs}`);
  console.log(`  reviewPosture:          ${candidate.reviewPosture}`);
  console.log(`  riskLevel:              ${candidate.riskLevel}`);
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
    "TPQR-003 / PF3A-003 overdue-commitment planning artifact FAILED - do not advance Phase 3B planning\n",
  );
  process.exit(1);
}

console.log(
  `\n${summary.checks.length}/${summary.checks.length} checks passed`,
);
console.log(
  "TPQR-003 / PF3A-003 overdue-commitment planning artifact PASSED (planning-only; no runtime adoption)\n",
);
