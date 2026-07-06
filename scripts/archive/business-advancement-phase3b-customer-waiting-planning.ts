#!/usr/bin/env tsx
/**
 * Helm Business Advancement - Phase 3B / TPQR-004 / PF3A-004
 * Customer-waiting planning CLI.
 *
 * Prints the deterministic planning summary for the customer_waiting artifact
 * and exits non-zero on any failed evaluator check. This is a planning-only
 * artifact; it does NOT touch a database, network, schema, runtime extractor,
 * API route, or any production query path. The PF3A-004 ownership rule
 * `merge_and_dedup_by_email_thread_id_after_producers` with the TPQR-004-first
 * tie-break is enforced over loadWaitingEmailThreads_generic by the dedup
 * pipeline and asserted by the evaluator.
 */

import {
  CUSTOMER_WAITING_PLANNING_FIXTURE_ROWS,
  CUSTOMER_WAITING_PLANNING_REFERENCE_CLOCK_MS,
  evaluateCustomerWaitingPlanning,
} from "../features/business-advancement/phase3b-customer-waiting-planning";

const summary = evaluateCustomerWaitingPlanning(
  CUSTOMER_WAITING_PLANNING_FIXTURE_ROWS,
  CUSTOMER_WAITING_PLANNING_REFERENCE_CLOCK_MS,
);

console.log(
  "\nHelm Business Advancement - Phase 3B / TPQR-004 / PF3A-004 Customer-Waiting Planning",
);
console.log(
  "================================================================================",
);
console.log(`tpqrId:                ${summary.tpqrId}`);
console.log(`preflightId:           ${summary.preflightId}`);
console.log(`ownershipRule:         ${summary.ownershipRule}`);
console.log(
  `tieBreakOrder:         ${summary.tieBreakOrder.join(" > ")}`,
);
console.log(
  `thresholdMs:           ${summary.thresholdMs} (24h customer-waiting planning candidate; not production)`,
);
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
  console.log(`  producerId:             ${candidate.producerId}`);
  console.log(`  producerRank:           ${candidate.producerRank}`);
  console.log(`  emailThreadId:          ${candidate.emailThreadId}`);
  console.log(
    `  opportunityIdPresent:   ${candidate.opportunityIdPresent}`,
  );
  console.log(
    `  lastCustomerMessageAt:  ${candidate.lastCustomerMessageAtMs}`,
  );
  console.log(`  waitedMs:               ${candidate.waitedMs}`);
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
    "TPQR-004 / PF3A-004 customer-waiting planning artifact FAILED - do not advance Phase 3B planning\n",
  );
  process.exit(1);
}

console.log(
  `\n${summary.checks.length}/${summary.checks.length} checks passed`,
);
console.log(
  "TPQR-004 / PF3A-004 customer-waiting planning artifact PASSED (planning-only; no runtime adoption)\n",
);
