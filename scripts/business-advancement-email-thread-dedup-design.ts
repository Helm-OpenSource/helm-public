#!/usr/bin/env tsx
/**
 * Helm Business Advancement - Phase 3A / PF3A-004
 * Email-thread dedup design CLI.
 *
 * Prints the deterministic evidence matrix for the customer_waiting overlap
 * between loadWaitingEmailThreads (existing path) and the proposed TPQR-004
 * CRM-scoped path, the selected ownership rule, the tie-break order, and the
 * evaluator checks. Exits non-zero on any failed invariant check.
 *
 * No database, no network, no runtime extractor, no write authority,
 * no schema change, no page behavior change.
 */

import {
  EMAIL_THREAD_DEDUP_EVIDENCE,
  OWNERSHIP_RULE_SELECTION,
  evaluateEmailThreadDedupDesign,
} from "../features/business-advancement/email-thread-dedup-design";

const summary = evaluateEmailThreadDedupDesign();

console.log(
  "\nHelm Business Advancement - Phase 3A / PF3A-004 Email Thread Dedup Design",
);
console.log(
  "================================================================================",
);
console.log(`Total rows:                  ${summary.totalRows}`);
console.log(`Producers covered:           ${summary.producersCovered.join(", ")}`);
console.log(`Selected ownership rule:     ${summary.selectedRule}`);
console.log(`Tie-break order:             ${summary.tieBreakOrder.join(" > ")}`);
console.log();

console.log("Evidence Matrix");
console.log(
  "--------------------------------------------------------------------------------",
);
for (const row of EMAIL_THREAD_DEDUP_EVIDENCE) {
  console.log(`${row.evidenceId}`);
  console.log(`  filePath:                          ${row.filePath}`);
  console.log(`  evidenceLocator:                   ${row.evidenceLocator}`);
  console.log(`  evidenceKind:                      ${row.evidenceKind}`);
  console.log(
    `  relatedProducer:                   ${row.relatedProducer ?? "(none)"}`,
  );
  console.log();
}

console.log("Ownership Rule Selection");
console.log(
  "--------------------------------------------------------------------------------",
);
console.log(`  selectedRule:               ${OWNERSHIP_RULE_SELECTION.selectedRule}`);
console.log(
  `  tieBreakOrder:              ${OWNERSHIP_RULE_SELECTION.tieBreakOrder.join(" > ")}`,
);
console.log(`  rationale:                  ${OWNERSHIP_RULE_SELECTION.rationale}`);
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
    "PF3A-004 email thread dedup design FAILED - do not advance to thin read-model planning\n",
  );
  process.exit(1);
}

console.log(
  `\n${summary.checks.length}/${summary.checks.length} checks passed`,
);
console.log(
  "PF3A-004 email thread dedup design PASSED (planning-only artifact)\n",
);
