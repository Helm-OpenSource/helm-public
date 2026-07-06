#!/usr/bin/env tsx
/**
 * Helm Business Advancement - Phase 3A Runtime Guard Resolution Plan CLI
 *
 * Prints a concise guard-resolution summary for the four conditional Phase 3
 * guards (PF3-002 / PF3-003 / PF3-004 / PF3-005). Exits non-zero on any
 * failed invariant check.
 *
 * No database, no network, no runtime extractor, no write authority,
 * no schema change, no page behavior change.
 */

import {
  RUNTIME_GUARD_RESOLUTION_PLAN,
  evaluateRuntimeGuardResolutionPlan,
} from "../features/business-advancement/runtime-guard-resolution-plan";

const summary = evaluateRuntimeGuardResolutionPlan();

console.log(
  "\nHelm Business Advancement - Phase 3A Runtime Guard Resolution Plan",
);
console.log(
  "================================================================================",
);
console.log(`Guard rows:  ${summary.totalRows}`);
console.log();

for (const row of RUNTIME_GUARD_RESOLUTION_PLAN) {
  console.log(`${row.guardId}  [resolves ${row.sourcePhase3CheckId}]`);
  console.log(`  Status:                       ${row.currentStatus}`);
  console.log(`  Resolution class:             ${row.resolutionClass}`);
  console.log(
    `  Runtime implementation:       ${row.runtimeImplementationAllowed} (planning-only)`,
  );
  console.log(
    `  Schema change:                ${row.schemaChangeAllowed} (planning-only)`,
  );
  console.log(`  Evidence to collect:          ${row.evidenceToCollect.length} item(s)`);
  console.log(
    `  Accepted resolution criteria: ${row.acceptedResolutionCriteria.length} item(s)`,
  );
  console.log(`  Stop conditions:              ${row.stopConditions.length} item(s)`);
  console.log(`  Next work order:              ${row.nextWorkOrder.length} step(s)`);
  console.log(`  Boundary notes:               ${row.boundaryNotes.length} item(s)`);
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
    `\n${summary.checks.length - failed.length}/${summary.checks.length} checks passed`,
  );
  console.error(
    "Phase 3A runtime guard resolution plan FAILED - do not proceed to thin read-model planning\n",
  );
  process.exit(1);
}

console.log(
  `\n${summary.checks.length}/${summary.checks.length} checks passed`,
);
console.log("Phase 3A runtime guard resolution plan PASSED (planning-only)\n");
