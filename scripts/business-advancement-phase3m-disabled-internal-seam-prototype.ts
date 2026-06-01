/**
 * Phase 3M disabled internal seam prototype — deterministic demo script.
 *
 * Runs injected rows through runPhase3mDisabledInternalSeamPrototype with
 * flags and capabilities enabled and verifies expected statuses/counts.
 * Exits 0 on pass, non-zero on failure. No DB, no network, no wall clock.
 */

import {
  CAPABILITY_BLOCKED_DECISION_READ,
  CAPABILITY_CUSTOMER_WAITING_READ,
  CAPABILITY_OVERDUE_COMMITMENT_READ,
  PHASE3M_NEXT_ALLOWED_WORK,
  PHASE3M_RULE_VERSION,
  runPhase3mDisabledInternalSeamPrototype,
} from "../features/business-advancement/phase3m-disabled-internal-seam-prototype";

// ---------------------------------------------------------------------------
// Deterministic fixture data
// ---------------------------------------------------------------------------

const WS = "ws-phase3m-demo";
const REF_CLOCK_MS = 1777161600000; // 2026-04-24T00:00:00.000Z — injected, no Date.now()

const tpqr001Rows = [
  {
    rowId: "demo-ai-stale",
    workspaceId: WS,
    updatedAtMs: REF_CLOCK_MS - 5 * 24 * 60 * 60 * 1000, // 5 days ago
    hasApprovalTask: false,
  },
  {
    rowId: "demo-ai-fresh",
    workspaceId: WS,
    updatedAtMs: REF_CLOCK_MS - 12 * 60 * 60 * 1000, // 12 hours ago
    hasApprovalTask: false,
  },
  {
    rowId: "demo-ai-in-review",
    workspaceId: WS,
    updatedAtMs: REF_CLOCK_MS - 4 * 24 * 60 * 60 * 1000,
    hasApprovalTask: true,
  },
];

const tpqr003Rows = [
  {
    rowId: "demo-c-overdue",
    workspaceId: WS,
    commitmentId: "cmmt-demo-001",
    dueDateMs: REF_CLOCK_MS - 2 * 24 * 60 * 60 * 1000,
    status: "ACTIVE",
    persistedOverdueFlag: false, // flag is not authority — should still be included
  },
  {
    rowId: "demo-c-future",
    workspaceId: WS,
    commitmentId: "cmmt-demo-002",
    dueDateMs: REF_CLOCK_MS + 3 * 24 * 60 * 60 * 1000,
    status: "ACTIVE",
    persistedOverdueFlag: true, // flag is not authority — should still be excluded
  },
];

const tpqr004Rows = [
  {
    rowId: "demo-et-crm",
    workspaceId: WS,
    emailThreadId: "thread-demo-crm",
    threadStatus: "WAITING_US",
    opportunityId: "opp-demo-001",
  },
  {
    rowId: "demo-et-generic",
    workspaceId: WS,
    emailThreadId: "thread-demo-generic",
    threadStatus: "WAITING_US",
    opportunityId: null,
  },
  {
    rowId: "demo-et-generic-dup",
    workspaceId: WS,
    emailThreadId: "thread-demo-crm", // same as CRM-linked → deduped
    threadStatus: "WAITING_US",
    opportunityId: null,
  },
];

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

const result = runPhase3mDisabledInternalSeamPrototype({
  workspaceId: WS,
  referenceClockMs: REF_CLOCK_MS,
  flags: { tpqr001: true, tpqr003: true, tpqr004: true },
  capabilities: [
    CAPABILITY_BLOCKED_DECISION_READ,
    CAPABILITY_OVERDUE_COMMITMENT_READ,
    CAPABILITY_CUSTOMER_WAITING_READ,
  ],
  rows: { tpqr001: tpqr001Rows, tpqr003: tpqr003Rows, tpqr004: tpqr004Rows },
});

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

console.log("=== Phase 3M Disabled Internal Seam Prototype Demo ===");
console.log(`ruleVersion:                ${PHASE3M_RULE_VERSION}`);
console.log(`runtimeAdoptionPosture:     ${result.runtimeAdoptionPosture}`);
console.log(`prototypePosture:           ${result.prototypePosture}`);
console.log(`productionIntegrationAllowed: ${String(result.productionIntegrationAllowed)}`);
console.log("");

console.log("--- TPQR-001 (blocked_decision) ---");
console.log(`  status:              ${result.tpqr001.status}`);
console.log(`  capabilitySatisfied: ${String(result.tpqr001.capabilitySatisfied)}`);
console.log(`  included:            ${result.tpqr001.result.included.length}`);
console.log(`  excluded:            ${result.tpqr001.result.excluded.length}`);
for (const c of result.tpqr001.result.included) {
  console.log(`    + included: ${c.sourceRowId} stalenessMs=${c.stalenessMs}`);
}
for (const e of result.tpqr001.result.excluded) {
  console.log(`    - excluded: ${e.sourceRowId} reason=${e.exclusionReason}`);
}

console.log("");
console.log("--- TPQR-003 (overdue_commitment) ---");
console.log(`  status:              ${result.tpqr003.status}`);
console.log(`  capabilitySatisfied: ${String(result.tpqr003.capabilitySatisfied)}`);
console.log(`  included:            ${result.tpqr003.result.included.length}`);
console.log(`  excluded:            ${result.tpqr003.result.excluded.length}`);
for (const c of result.tpqr003.result.included) {
  console.log(`    + included: ${c.sourceRowId} overdueByMs=${c.overdueByMs}`);
}
for (const e of result.tpqr003.result.excluded) {
  console.log(`    - excluded: ${e.sourceRowId} reason=${e.exclusionReason}`);
}

console.log("");
console.log("--- TPQR-004 (customer_waiting) ---");
console.log(`  status:              ${result.tpqr004.status}`);
console.log(`  capabilitySatisfied: ${String(result.tpqr004.capabilitySatisfied)}`);
console.log(`  included:            ${result.tpqr004.result.included.length}`);
console.log(`  excluded:            ${result.tpqr004.result.excluded.length}`);
for (const c of result.tpqr004.result.included) {
  console.log(`    + included: ${c.sourceRowId} producer=${c.producerKind}`);
}
for (const e of result.tpqr004.result.excluded) {
  console.log(`    - excluded: ${e.sourceRowId} reason=${e.exclusionReason}`);
}

console.log("");
console.log(`nextAllowedWork: ${PHASE3M_NEXT_ALLOWED_WORK}`);
console.log("");

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

const failures: string[] = [];

function assert(cond: boolean, msg: string): void {
  if (!cond) failures.push(msg);
}

assert(
  result.runtimeAdoptionPosture === "No-Go",
  "runtimeAdoptionPosture must be No-Go",
);
assert(
  result.prototypePosture === "Conditional-Go",
  "prototypePosture must be Conditional-Go",
);
assert(
  result.productionIntegrationAllowed === false,
  "productionIntegrationAllowed must be false",
);

// TPQR-001
assert(result.tpqr001.status === "evaluated", "tpqr001 status must be evaluated");
assert(result.tpqr001.capabilitySatisfied, "tpqr001 capabilitySatisfied must be true");
assert(
  result.tpqr001.result.included.length === 1,
  `tpqr001 must have 1 included candidate (got ${result.tpqr001.result.included.length})`,
);
assert(
  result.tpqr001.result.included[0]?.sourceRowId === "demo-ai-stale",
  "tpqr001 included candidate must be demo-ai-stale",
);

// TPQR-003
assert(result.tpqr003.status === "evaluated", "tpqr003 status must be evaluated");
assert(result.tpqr003.capabilitySatisfied, "tpqr003 capabilitySatisfied must be true");
assert(
  result.tpqr003.result.included.length === 1,
  `tpqr003 must have 1 included candidate (got ${result.tpqr003.result.included.length})`,
);
assert(
  result.tpqr003.result.included[0]?.sourceRowId === "demo-c-overdue",
  "tpqr003 included candidate must be demo-c-overdue",
);

// TPQR-004
assert(result.tpqr004.status === "evaluated", "tpqr004 status must be evaluated");
assert(result.tpqr004.capabilitySatisfied, "tpqr004 capabilitySatisfied must be true");
assert(
  result.tpqr004.result.included.length === 2,
  `tpqr004 must have 2 included candidates (got ${result.tpqr004.result.included.length})`,
);
const crmCandidate = result.tpqr004.result.included.find(
  (c) => c.producerKind === "crm_linked",
);
const genericCandidate = result.tpqr004.result.included.find(
  (c) => c.producerKind === "generic",
);
assert(crmCandidate !== undefined, "tpqr004 must have a crm_linked candidate");
assert(genericCandidate !== undefined, "tpqr004 must have a generic candidate");
const dedupExcluded = result.tpqr004.result.excluded.find(
  (e) => e.exclusionReason === "deduped_by_crm_linked",
);
assert(dedupExcluded !== undefined, "tpqr004 must dedup generic duplicate with deduped_by_crm_linked");

// No duplicates in TPQR-004 included
const threadIds = result.tpqr004.result.included.map((c) => c.emailThreadId);
assert(
  new Set(threadIds).size === threadIds.length,
  "tpqr004 included must have no duplicate emailThreadIds",
);

// Final result
if (failures.length > 0) {
  console.error("=== FAILURES ===");
  for (const f of failures) {
    console.error(`  FAIL: ${f}`);
  }
  process.exit(1);
} else {
  console.log("=== ALL CHECKS PASSED ===");
  process.exit(0);
}
