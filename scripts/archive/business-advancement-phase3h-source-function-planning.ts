#!/usr/bin/env tsx
/**
 * Helm Business Advancement - Phase 3H Named Source Function Planning CLI.
 *
 * Runs the deterministic evaluator for the Phase 3H named source function
 * planning artifact. Does not touch a database, network, API route, page,
 * mobile read model, production query path, external system, or execution
 * authority. No Date.now() is called.
 */

import {
  PHASE3H_BLOCKED_DECISION_THRESHOLD_MS,
  PHASE3H_FIXTURE_WORKSPACE_ID,
  PHASE3H_REFERENCE_CLOCK_MS,
  PHASE3H_RULE_VERSION,
  PHASE3H_TPQR001_FIXTURE_ROWS,
  PHASE3H_TPQR003_FIXTURE_ROWS,
  PHASE3H_TPQR004_FIXTURE_ROWS,
  evaluatePhase3hSourceFunctions,
  sourceBlockedDecisionCandidates,
  sourceCustomerWaitingCandidates,
  sourceOverdueCommitmentCandidates,
} from "../features/business-advancement/phase3h-source-function-planning";

const summary = evaluatePhase3hSourceFunctions();

console.log(
  "\nHelm Business Advancement - Phase 3H Named Source Function Planning",
);
console.log(
  "================================================================================",
);
console.log(`Rule version:         ${PHASE3H_RULE_VERSION}`);
console.log(`Eval checks:          ${summary.passed}/${summary.totalChecks}`);
console.log(`Runtime posture:      ${summary.runtimeAdoptionPosture}`);
console.log();

console.log("Eval Checks");
console.log(
  "--------------------------------------------------------------------------------",
);
for (const check of summary.checks) {
  const mark = check.passed ? "PASS" : "FAIL";
  console.log(`${mark.padEnd(5)} ${check.checkName}`);
  console.log(`      ${check.detail}`);
}
console.log();

console.log("Source Function Candidate Summaries (fixture rows, enabled=true)");
console.log(
  "--------------------------------------------------------------------------------",
);

const r001 = sourceBlockedDecisionCandidates({
  workspaceId: PHASE3H_FIXTURE_WORKSPACE_ID,
  referenceClockMs: PHASE3H_REFERENCE_CLOCK_MS,
  thresholdMs: PHASE3H_BLOCKED_DECISION_THRESHOLD_MS,
  enabled: true,
  rows: PHASE3H_TPQR001_FIXTURE_ROWS,
});
console.log(
  `TPQR-001 sourceBlockedDecisionCandidates:   included=${r001.included.length} excluded=${r001.excluded.length}`,
);
for (const c of r001.included) {
  console.log(
    `  [included] ${c.sourceRowId}  stalenessMs=${c.stalenessMs}  audit.thresholdStatus=${c.audit.thresholdStatus}`,
  );
}
for (const e of r001.excluded) {
  console.log(
    `  [excluded] ${e.sourceRowId}  reason=${e.exclusionReason}  audit.thresholdStatus=${String(e.audit.thresholdStatus)}`,
  );
}
console.log();

const r003 = sourceOverdueCommitmentCandidates({
  workspaceId: PHASE3H_FIXTURE_WORKSPACE_ID,
  referenceClockMs: PHASE3H_REFERENCE_CLOCK_MS,
  enabled: true,
  rows: PHASE3H_TPQR003_FIXTURE_ROWS,
});
console.log(
  `TPQR-003 sourceOverdueCommitmentCandidates: included=${r003.included.length} excluded=${r003.excluded.length}`,
);
for (const c of r003.included) {
  console.log(
    `  [included] ${c.sourceRowId}  overdueByMs=${c.overdueByMs}  audit.thresholdStatus=${c.audit.thresholdStatus}`,
  );
}
for (const e of r003.excluded) {
  console.log(
    `  [excluded] ${e.sourceRowId}  reason=${e.exclusionReason}  audit.thresholdStatus=${String(e.audit.thresholdStatus)}`,
  );
}
console.log();

const r004 = sourceCustomerWaitingCandidates({
  workspaceId: PHASE3H_FIXTURE_WORKSPACE_ID,
  enabled: true,
  rows: PHASE3H_TPQR004_FIXTURE_ROWS,
});
console.log(
  `TPQR-004 sourceCustomerWaitingCandidates:   included=${r004.included.length} excluded=${r004.excluded.length}  crm=${r004.crmLinkedCandidateCount} generic=${r004.genericCandidateCount}`,
);
for (const c of r004.included) {
  console.log(
    `  [included] ${c.sourceRowId}  emailThreadId=${c.emailThreadId}  producer=${c.producerKind}`,
  );
}
for (const e of r004.excluded) {
  console.log(
    `  [excluded] ${e.sourceRowId}  reason=${e.exclusionReason}  emailThreadId=${String(e.emailThreadId)}`,
  );
}
console.log();

if (summary.allPassed) {
  console.log(
    "RESULT: PASS — All Phase 3H named source function planning checks passed.",
  );
  console.log(`RUNTIME ADOPTION: ${summary.runtimeAdoptionPosture}`);
  console.log(`NEXT ALLOWED WORK: ${summary.nextAllowedWork}`);
} else {
  console.log("RESULT: FAIL — One or more checks failed.");
  process.exitCode = 1;
}
