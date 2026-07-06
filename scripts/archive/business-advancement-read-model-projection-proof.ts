#!/usr/bin/env tsx
/**
 * Helm Business Advancement — Phase 2B Read-Model Projection Proof CLI
 *
 * Prints a concise proof summary for the meeting, tenant_resource, and crm
 * active candidate sources. Exits non-zero on any failed check.
 * No database, no network, no runtime extractor, no write authority.
 */

import {
  READ_MODEL_PROJECTION_PROOF,
  evaluateReadModelProjectionProof,
} from "../features/business-advancement/read-model-projection-proof";

const summary = evaluateReadModelProjectionProof();

console.log(
  "\nHelm Business Advancement — Phase 2B Read-Model Projection Proof"
);
console.log("================================================================");
console.log(`Proof rows:      ${summary.totalRows}`);
console.log(`Source types:    ${summary.coveredSourceTypes.join(", ")}`);
console.log();

for (const row of READ_MODEL_PROJECTION_PROOF) {
  console.log(`Source:          ${row.sourceType}`);
  console.log(`  Fixtures:      ${row.coveredFixtureIds.join(", ")}`);
  console.log(`  Signals:       ${row.projectedSignalTypes.join(", ")}`);
  console.log(`  Read-model:    ${row.existingReadModelPath}`);
  console.log(`  Readiness:     ${row.readinessStatus}`);
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
  console.error("Phase 2B read-model projection proof FAILED\n");
  process.exit(1);
}

console.log(
  `\n${summary.checks.length}/${summary.checks.length} checks passed`
);
console.log("Phase 2B read-model projection proof PASSED\n");
