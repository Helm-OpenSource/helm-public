#!/usr/bin/env tsx
/**
 * Helm Business Advancement - Phase 3A / PF3A-002
 * Opportunity.updatedAt source audit CLI.
 *
 * Prints the deterministic writer-source matrix and the planning-only
 * conclusion. Exits non-zero on any failed invariant check.
 *
 * No database, no network, no runtime extractor, no write authority,
 * no schema change, no page behavior change.
 */

import {
  OPPORTUNITY_UPDATED_AT_SOURCE_AUDIT,
  evaluateOpportunityUpdatedAtSourceAudit,
} from "../features/business-advancement/opportunity-updated-at-source-audit";

const summary = evaluateOpportunityUpdatedAtSourceAudit();

console.log(
  "\nHelm Business Advancement - Phase 3A / PF3A-002 Opportunity.updatedAt Source Audit",
);
console.log(
  "================================================================================",
);
console.log(`Total rows:       ${summary.totalRows}`);
console.log(`Writer rows:      ${summary.writerRowCount}`);
console.log(`Read-only rows:   ${summary.readOnlyRowCount}`);
console.log();

console.log("Writer-Source Matrix");
console.log(
  "--------------------------------------------------------------------------------",
);
for (const row of OPPORTUNITY_UPDATED_AT_SOURCE_AUDIT) {
  console.log(`${row.writerId}`);
  console.log(`  filePath:                  ${row.filePath}`);
  console.log(`  evidenceLocator:           ${row.evidenceLocator}`);
  console.log(`  operationKind:             ${row.operationKind}`);
  console.log(`  sourceClass:               ${row.sourceClass}`);
  console.log(`  touchesOpportunityRows:    ${row.touchesOpportunityRows}`);
  console.log(`  updatedAtBehavior:         ${row.updatedAtBehavior}`);
  console.log(`  stalenessHeuristicImpact:  ${row.stalenessHeuristicImpact}`);
  console.log();
}

console.log("Conclusion");
console.log(
  "--------------------------------------------------------------------------------",
);
console.log(`  conclusion: ${summary.conclusion.conclusion}`);
console.log(`  reason:     ${summary.conclusion.reason}`);
if (summary.conclusion.residualBlockers.length > 0) {
  console.log("  residualBlockers:");
  for (const blocker of summary.conclusion.residualBlockers) {
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
    "PF3A-002 source audit FAILED - do not advance to thin read-model planning\n",
  );
  process.exit(1);
}

console.log(
  `\n${summary.checks.length}/${summary.checks.length} checks passed`,
);
console.log("PF3A-002 source audit PASSED (planning-only artifact)\n");
