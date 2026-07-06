#!/usr/bin/env tsx
/**
 * Helm Business Advancement — Phase 3 Entry Gate: Runtime Readiness Preflight CLI
 *
 * Prints a concise preflight summary for the five thin projections from Phase 2C.
 * Exits non-zero on any failed check.
 * No database, no network, no runtime extractor, no write authority.
 */

import {
  RUNTIME_READINESS_PREFLIGHT,
  evaluateRuntimeReadinessPreflight,
} from "../features/business-advancement/runtime-readiness-preflight";

const summary = evaluateRuntimeReadinessPreflight();

console.log(
  "\nHelm Business Advancement — Phase 3 Entry Gate: Runtime Readiness Preflight"
);
console.log("================================================================================");
console.log(`Preflight rows:  ${summary.totalRows}`);
console.log();

for (const row of RUNTIME_READINESS_PREFLIGHT) {
  console.log(
    `${row.preflightId}  [${row.linkedTpqrId}]  ${row.sourceType}/${row.fixtureId}  [${row.signalType}]`
  );
  console.log(`  Status:        ${row.runtimeReadinessStatus}`);
  console.log(`  Posture:       ${row.runtimeAdoptionPosture}`);
  if (row.conditionalRuntimeGuard) {
    const guardPreview =
      row.conditionalRuntimeGuard.length > 120
        ? row.conditionalRuntimeGuard.slice(0, 120) + "..."
        : row.conditionalRuntimeGuard;
    console.log(`  Guard:         ${guardPreview}`);
  }
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
  console.error("Phase 3 entry gate runtime readiness preflight FAILED\n");
  process.exit(1);
}

console.log(
  `\n${summary.checks.length}/${summary.checks.length} checks passed`
);
console.log("Phase 3 entry gate runtime readiness preflight PASSED\n");
