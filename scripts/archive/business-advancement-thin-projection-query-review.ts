#!/usr/bin/env tsx
/**
 * Helm Business Advancement — Phase 2C Thin Projection Query Review CLI
 *
 * Prints a concise review summary for the five thin projections identified
 * in Phase 2B. Exits non-zero on any failed check.
 * No database, no network, no runtime extractor, no write authority.
 */

import {
  THIN_PROJECTION_QUERY_REVIEW,
  evaluateThinProjectionQueryReview,
} from "../features/business-advancement/thin-projection-query-review";

const summary = evaluateThinProjectionQueryReview();

console.log(
  "\nHelm Business Advancement — Phase 2C Thin Projection Query Review"
);
console.log("================================================================");
console.log(`Review rows:     ${summary.totalRows}`);
console.log();

for (const row of THIN_PROJECTION_QUERY_REVIEW) {
  console.log(`${row.reviewId}  ${row.sourceType}/${row.fixtureId}  [${row.signalType}]`);
  console.log(`  Table:         ${row.proposedReadOnlyWhereClause.table}`);
  console.log(`  Where:         ${row.proposedReadOnlyWhereClause.whereClauses.join(" AND ")}`);
  console.log(`  Readiness:     ${row.readinessStatus}`);
  console.log(`  Posture:       ${row.runtimeAdoptionPosture}`);
  console.log();
}

console.log("Eval Checks:");
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
    `\n${summary.checks.length - failed.length}/${summary.checks.length} checks passed`
  );
  console.error("Phase 2C thin projection query review FAILED\n");
  process.exit(1);
}

console.log(
  `\n${summary.checks.length}/${summary.checks.length} checks passed`
);
console.log("Phase 2C thin projection query review PASSED\n");
