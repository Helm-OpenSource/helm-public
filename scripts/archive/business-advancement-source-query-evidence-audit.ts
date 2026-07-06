#!/usr/bin/env tsx
/**
 * Helm Business Advancement - Phase 3G Source-Query Evidence Audit CLI.
 *
 * Runs the pure, static evidence audit evaluator. This does not touch a
 * database, network, API route, page, mobile read model, production query
 * path, external system, or execution authority. No Date.now() is called.
 */

import {
  PHASE3G_RULE_VERSION,
  evaluatePhase3gSourceQueryEvidence,
} from "../features/business-advancement/source-query-evidence-audit";

const summary = evaluatePhase3gSourceQueryEvidence();

console.log(
  "\nHelm Business Advancement - Phase 3G Source-Query Evidence Audit",
);
console.log(
  "================================================================================",
);
console.log(`Rule version:         ${PHASE3G_RULE_VERSION}`);
console.log(`Evidence rows:        ${summary.evidenceRows.length}`);
console.log(`Query shape records:  ${summary.queryShapes.length}`);
console.log(`Eval checks:          ${summary.passed}/${summary.totalChecks}`);
console.log(`Runtime posture:      ${summary.runtimeAdoptionPosture}`);
console.log();

console.log("Evidence Row Verdicts");
console.log("--------------------------------------------------------------------------------");
for (const row of summary.evidenceRows) {
  console.log(
    `${row.verdict.padEnd(11)} ${row.evidenceId}  [${row.tpqrId}/${row.question}]`,
  );
}
console.log();

console.log("Query Shape Records");
console.log("--------------------------------------------------------------------------------");
for (const shape of summary.queryShapes) {
  console.log(`${shape.shapeId.padEnd(32)} ${shape.tpqrId}  gateStatus=${shape.gateStatus}`);
  console.log(`  WHERE: ${shape.whereClause}`);
  console.log(`  clock=${String(shape.explicitClockRequired).padEnd(5)} persistedFlag=${String(shape.persistedFlagAuthority).padEnd(5)} wsInherited=${String(shape.workspaceScopeInherited)}`);
}
console.log();

console.log("Eval Checks");
console.log("--------------------------------------------------------------------------------");
for (const check of summary.checks) {
  const mark = check.passed ? "PASS" : "FAIL";
  console.log(`${mark.padEnd(5)} ${check.checkName}`);
  console.log(`      ${check.detail}`);
}
console.log();

if (summary.allPassed) {
  console.log("RESULT: PASS — All Phase 3G evidence audit checks passed.");
  console.log(`RUNTIME ADOPTION: ${summary.runtimeAdoptionPosture}`);
  console.log(`NEXT ALLOWED WORK: ${summary.nextAllowedWork}`);
} else {
  console.log("RESULT: FAIL — One or more evidence audit checks failed.");
  process.exitCode = 1;
}
