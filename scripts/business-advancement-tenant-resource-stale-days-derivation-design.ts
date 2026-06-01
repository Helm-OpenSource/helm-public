#!/usr/bin/env tsx
/**
 * Helm Business Advancement - Phase 3A / PF3A-005
 * Tenant resource derivedStaleDays derivation design CLI.
 *
 * Prints the deterministic source-candidate catalog, the selected source and
 * formula, the take: 2 calibration result, the evidence matrix, and the
 * evaluator checks. Exits non-zero on any failed invariant check.
 *
 * No database, no network, no runtime extractor, no write authority,
 * no schema change, no page behavior change, no readout type modification.
 */

import {
  DERIVED_STALE_DAYS_CALIBRATION,
  DERIVED_STALE_DAYS_EVIDENCE,
  DERIVED_STALE_DAYS_FORMULA,
  DERIVED_STALE_DAYS_SOURCE_CATALOG,
  PF3A005_ADOPTION_POSTURE,
  applyTpqr005CalibrationRule,
  evaluateDerivedStaleDaysDerivationDesign,
} from "../features/business-advancement/tenant-resource-stale-days-derivation-design";

const summary = evaluateDerivedStaleDaysDerivationDesign();

console.log(
  "\nHelm Business Advancement - Phase 3A / PF3A-005 Derived Stale Days Derivation Design",
);
console.log(
  "================================================================================",
);
console.log(`Total evidence rows:         ${summary.totalRows}`);
console.log(
  `Catalog candidates:          ${summary.catalogCandidates.join(", ")}`,
);
console.log(`Selected source:             ${summary.selectedSource}`);
console.log(`Selected formula:            ${summary.selectedFormulaExpression}`);
console.log(
  `Threshold (planning-only):   ${DERIVED_STALE_DAYS_FORMULA.thresholdComparator} ${DERIVED_STALE_DAYS_FORMULA.thresholdForTpqr005Filter}`,
);
console.log(
  `Noise guard (take):          ${DERIVED_STALE_DAYS_FORMULA.noiseGuardTake}`,
);
console.log(
  `Noise guard ordering:        ${DERIVED_STALE_DAYS_FORMULA.noiseGuardOrderBy}`,
);
console.log(
  `Staleness label:             ${DERIVED_STALE_DAYS_FORMULA.stalenessLabel}`,
);
console.log();

console.log("PF3A-005 Adoption / Gate Posture");
console.log(
  "--------------------------------------------------------------------------------",
);
console.log(
  `  selectedSource:                ${PF3A005_ADOPTION_POSTURE.selectedSource}`,
);
console.log(
  `  formulaStatus:                 ${PF3A005_ADOPTION_POSTURE.formulaStatus}`,
);
console.log(
  `  humanMeaningfulStalenessGate:  ${PF3A005_ADOPTION_POSTURE.humanMeaningfulStalenessGate}`,
);
console.log(
  `  semanticScope:                 ${PF3A005_ADOPTION_POSTURE.semanticScope}`,
);
console.log(
  `  nextRequiredDecision:          ${PF3A005_ADOPTION_POSTURE.nextRequiredDecision}`,
);
for (const note of PF3A005_ADOPTION_POSTURE.postureNotes) {
  console.log(`  note:                          ${note}`);
}
console.log();

console.log("Source Candidate Catalog");
console.log(
  "--------------------------------------------------------------------------------",
);
for (const entry of DERIVED_STALE_DAYS_SOURCE_CATALOG) {
  console.log(`${entry.candidateId}`);
  console.log(`  origin:                          ${entry.originLocator}`);
  console.log(`  verdict:                         ${entry.verdict}`);
  console.log();
}

console.log("Calibration Cases (take: 2 against the > 14 rule)");
console.log(
  "--------------------------------------------------------------------------------",
);
for (const calibrationCase of DERIVED_STALE_DAYS_CALIBRATION) {
  const actual = applyTpqr005CalibrationRule(calibrationCase.fixtures);
  const expectedKey = calibrationCase.expectedTopResourceKeys.join(", ") || "(empty)";
  const actualKey = actual.join(", ") || "(empty)";
  const matches =
    actual.length === calibrationCase.expectedTopResourceKeys.length &&
    actual.every(
      (key, index) => key === calibrationCase.expectedTopResourceKeys[index],
    );
  const mark = matches ? "PASS" : "FAIL";
  console.log(`${calibrationCase.caseId} [${mark}]`);
  console.log(`  description: ${calibrationCase.description}`);
  console.log(`  expected:    ${expectedKey}`);
  console.log(`  actual:      ${actualKey}`);
  console.log();
}

console.log("Evidence Matrix");
console.log(
  "--------------------------------------------------------------------------------",
);
for (const row of DERIVED_STALE_DAYS_EVIDENCE) {
  console.log(`${row.evidenceId}`);
  console.log(`  filePath:                          ${row.filePath}`);
  console.log(`  evidenceLocator:                   ${row.evidenceLocator}`);
  console.log(`  evidenceKind:                      ${row.evidenceKind}`);
  console.log(
    `  relatedSourceCandidate:            ${row.relatedSourceCandidate ?? "(none)"}`,
  );
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
    "PF3A-005 derived stale days derivation design FAILED - do not advance to thin read-model planning\n",
  );
  process.exit(1);
}

console.log(
  `\n${summary.checks.length}/${summary.checks.length} checks passed`,
);
console.log(
  "PF3A-005 derived stale days derivation design PASSED (planning-only artifact)",
);
console.log(
  "Note: PF3A-005 human-meaningful staleness guard is NOT cleared - any runtime / type-surface / thin read-model planning that depends on PF3A-005 must stop and re-surface this guard or explicitly downgrade scope to evidence-freshness-only semantics before any adoption.\n",
);
