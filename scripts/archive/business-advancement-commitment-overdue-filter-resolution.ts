#!/usr/bin/env tsx
/**
 * Helm Business Advancement - Phase 3A / PF3A-003
 * Commitment overdue-filter resolution CLI.
 *
 * Prints the deterministic evidence matrix for Commitment.overdueFlag, the
 * conservative planning-only conclusion, and the evaluator checks. Exits
 * non-zero on any failed invariant check.
 *
 * No database, no network, no runtime extractor, no write authority,
 * no schema change, no page behavior change.
 */

import {
  COMMITMENT_OVERDUE_FILTER_EVIDENCE,
  evaluateCommitmentOverdueFilterResolution,
} from "../features/business-advancement/commitment-overdue-filter-resolution";

const summary = evaluateCommitmentOverdueFilterResolution();

console.log(
  "\nHelm Business Advancement - Phase 3A / PF3A-003 Commitment Overdue Filter Resolution",
);
console.log(
  "================================================================================",
);
console.log(`Total rows:                  ${summary.totalRows}`);
console.log(`Persisted-column reads:      ${summary.persistedColumnReadCount}`);
console.log(`Read-time derivations:       ${summary.readTimeDerivationCount}`);
console.log(`Maintenance-absence rows:    ${summary.maintenanceAbsenceCount}`);
console.log(`Maintenance-proof rows:      ${summary.maintenanceProofCount}`);
console.log();

console.log("Evidence Matrix");
console.log(
  "--------------------------------------------------------------------------------",
);
for (const row of COMMITMENT_OVERDUE_FILTER_EVIDENCE) {
  console.log(`${row.evidenceId}`);
  console.log(`  filePath:                          ${row.filePath}`);
  console.log(`  evidenceLocator:                   ${row.evidenceLocator}`);
  console.log(`  evidenceKind:                      ${row.evidenceKind}`);
  console.log(`  derivationKind:                    ${row.derivationKind}`);
  console.log(`  safetyAssessment:                  ${row.safetyAssessment}`);
  console.log(
    `  maintenanceProofForPersistedColumn: ${row.maintenanceProofForPersistedColumn}`,
  );
  console.log();
}

console.log("Conclusion");
console.log(
  "--------------------------------------------------------------------------------",
);
console.log(`  conclusion:                ${summary.decision.conclusion}`);
console.log(`  reason:                    ${summary.decision.reason}`);
console.log(
  `  recommendedFutureFilter:   ${summary.decision.recommendedFutureFilter}`,
);
if (summary.decision.residualBlockers.length > 0) {
  console.log("  residualBlockers:");
  for (const blocker of summary.decision.residualBlockers) {
    console.log(`    - ${blocker}`);
  }
}
console.log();

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
    "PF3A-003 commitment overdue filter resolution FAILED - do not advance to thin read-model planning\n",
  );
  process.exit(1);
}

console.log(
  `\n${summary.checks.length}/${summary.checks.length} checks passed`,
);
console.log(
  "PF3A-003 commitment overdue filter resolution PASSED (planning-only artifact)\n",
);
