#!/usr/bin/env tsx
/**
 * Helm Business Advancement - Phase 3E Thin Read-Model Adapter Planning CLI.
 *
 * Runs the pure, synthetic, planning-only adapter evaluator. This does not
 * touch a database, network, API route, page, mobile read model, production
 * query path, external system, or execution authority.
 */

import {
  THIN_READ_MODEL_ADAPTER_FIXTURE_SOURCE_ROWS,
  THIN_READ_MODEL_ADAPTER_FIXTURE_WORKSPACE_ID,
  evaluateThinReadModelAdapterPlan,
} from "../features/business-advancement/thin-read-model-adapter-planning";
import { BLOCKED_DECISION_PLANNING_REFERENCE_CLOCK_MS } from "../features/business-advancement/phase3b-blocked-decision-planning";

const summary = evaluateThinReadModelAdapterPlan({
  workspaceId: THIN_READ_MODEL_ADAPTER_FIXTURE_WORKSPACE_ID,
  referenceClockMs: BLOCKED_DECISION_PLANNING_REFERENCE_CLOCK_MS,
  enabledFamilies: {
    blockedDecision: true,
    overdueCommitment: true,
    customerWaiting: true,
  },
  sourceRows: THIN_READ_MODEL_ADAPTER_FIXTURE_SOURCE_ROWS,
});

console.log(
  "\nHelm Business Advancement - Phase 3E Thin Read-Model Adapter Planning",
);
console.log(
  "================================================================================",
);
console.log(`Workspace:         ${THIN_READ_MODEL_ADAPTER_FIXTURE_WORKSPACE_ID}`);
console.log(`Candidates:        ${summary.candidates.length}`);
console.log(`Excluded rows:     ${summary.excluded.length}`);
console.log(`Eval checks:       ${summary.passed}/${summary.totalChecks}`);
console.log();

console.log("Family Summaries");
console.log("--------------------------------------------------------------------------------");
for (const family of summary.familySummaries) {
  console.log(
    `${family.family.padEnd(20)} disabled=${String(family.disabled).padEnd(5)} sourceRows=${family.sourceRowCount} candidates=${family.candidateCount} excluded=${family.excludedCount}`,
  );
}
console.log();

console.log("Candidates");
console.log("--------------------------------------------------------------------------------");
for (const candidate of summary.candidates) {
  console.log(
    `${String(candidate.sortKey).padStart(2, "0")} ${candidate.family.padEnd(20)} ${candidate.itemId}`,
  );
  console.log(`   sourceRowId:     ${candidate.sourceRowId}`);
  console.log(`   action:          ${candidate.primaryAction.verb} -> ${candidate.primaryAction.target}`);
  console.log(`   thresholdStatus: ${candidate.audit.thresholdStatus}`);
}
console.log();

console.log("Eval Checks");
console.log("--------------------------------------------------------------------------------");
for (const check of summary.checks) {
  const mark = check.passed ? "PASS" : "FAIL";
  console.log(`${mark.padEnd(5)} ${check.checkName}`);
  console.log(`      ${check.detail}`);
}

if (!summary.allPassed) {
  process.exitCode = 1;
}
