#!/usr/bin/env tsx
// check-member-gateway — static gate for the Member Gateway contract slice
// (docs/superpowers/specs/2026-08-19-member-workbuddy-caio-gateway-design.md).
//
// Fail-closed assertions:
//   1. The frozen literals stay present in lib/member-gateway/types.ts:
//      the two-level projection ladder, the seven read-surface dimensions,
//      the metadata_only field whitelist sentinel, and the structural
//      boundary (authorityEffect "none", externalExecutionAllowed false).
//   2. Dispatch stays schema-inexpressible: no `WorkPacket` identifier may
//      appear anywhere in the module.
//   3. package.json keeps this gate wired, including into check:boundaries.
// This is a contract statement, not production readiness.

import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const violations: string[] = [];

const typesPath = path.join(root, "lib/member-gateway/types.ts");
const typesSource = readFileSync(typesPath, "utf8");

const frozenMarkers = [
  '"remote_projected"',
  '"metadata_only"',
  '"live_membership"',
  '"tool_scope"',
  '"object_relationship_authorization"',
  '"field_purpose_policy"',
  '"source_authorization"',
  '"tenant_provider_egress_policy"',
  '"current_classification"',
  '"LOCAL_VIEW_REQUIRED"',
  '"requiresLocalView"',
  'authorityEffect: "none"',
  "externalExecutionAllowed: false",
];
for (const marker of frozenMarkers) {
  if (!typesSource.includes(marker)) {
    violations.push(
      `lib/member-gateway/types.ts missing frozen marker: ${marker}`,
    );
  }
}

for (const file of [
  "types.ts",
  "contract.ts",
  "index.ts",
  "prompt.ts",
  "signal.ts",
  "signal-store.service.ts",
  "signal-store.mysql.test.ts",
  "prompt-store.service.ts",
  "prompt-store.mysql.test.ts",
  "prompt-response-store.service.ts",
  "prompt-response-store.mysql.test.ts",
  "signal-candidate.ts",
  "signal-candidate-materializer.ts",
  "signal-candidate-review.service.ts",
  "signal-candidate.mysql.test.ts",
  "signal-candidate-materializer.test.ts",
  "reviewer-evidence-projection.service.ts",
  "reviewer-evidence-projection.test.ts",
  "gateway-session.ts",
  "gateway-session.test.ts",
  "signal-candidate-memory-projection.service.ts",
  "signal-candidate-memory-verification.service.ts",
]) {
  const source = readFileSync(
    path.join(root, "lib/member-gateway", file),
    "utf8",
  );
  if (/WorkPacket/.test(source)) {
    violations.push(
      `lib/member-gateway/${file}: WorkPacket identifier must stay inexpressible`,
    );
  }
}

const signalPath = path.join(root, "lib/member-gateway/signal.ts");
const signalSource = readFileSync(signalPath, "utf8");

const signalFrozenMarkers = [
  '"progress"',
  '"blocker"',
  '"customer_signal"',
  '"untrusted"',
  "candidate: true",
  "supersedesReceiptRef",
];
for (const marker of signalFrozenMarkers) {
  if (!signalSource.includes(marker)) {
    violations.push(
      `lib/member-gateway/signal.ts missing frozen marker: ${marker}`,
    );
  }
}

const promptPath = path.join(root, "lib/member-gateway/prompt.ts");
const promptSource = readFileSync(promptPath, "utf8");

const promptFrozenMarkers = [
  '"critical"',
  '"protected_human_response"',
  '"authority_bearing_action"',
  '"refuse"',
  '"pause"',
  '"appeal"',
  '"acknowledge"',
  '"commitment_confirm"',
  "retaliationProhibited",
];
for (const marker of promptFrozenMarkers) {
  if (!promptSource.includes(marker)) {
    violations.push(
      `lib/member-gateway/prompt.ts missing frozen marker: ${marker}`,
    );
  }
}

const candidatePath = path.join(root, "lib/member-gateway/signal-candidate.ts");
const candidateSource = readFileSync(candidatePath, "utf8");

const candidateFrozenMarkers = [
  '"member_work_signal_candidate.json"',
  '"member_work_signal_candidate_review_required"',
  '"untrusted"',
  "promotionAllowed",
  "evaluationUseProhibited",
];
for (const marker of candidateFrozenMarkers) {
  if (!candidateSource.includes(marker)) {
    violations.push(
      `lib/member-gateway/signal-candidate.ts missing frozen marker: ${marker}`,
    );
  }
}

// M2d Task 3: the stage-two fact-promotion projection service must never
// silently lose its frozen falses (a projection is always
// PENDING_VERIFICATION, never a MemoryPromotion/MemoryItem write) — this
// is the closest a static scan comes to enforcing that prohibition, since
// TARGET_ROOTS in check-llm-candidate-boundaries.ts never scans
// lib/member-gateway (see that file's own header comment).
const memoryProjectionPath = path.join(
  root,
  "lib/member-gateway/signal-candidate-memory-projection.service.ts",
);
const memoryProjectionSource = readFileSync(memoryProjectionPath, "utf8");

const memoryProjectionFrozenMarkers = [
  "memoryPromotionCreated: false",
  "canonicalMemoryWritten: false",
  '"pending_verification"',
];
for (const marker of memoryProjectionFrozenMarkers) {
  if (!memoryProjectionSource.includes(marker)) {
    violations.push(
      `lib/member-gateway/signal-candidate-memory-projection.service.ts missing frozen marker: ${marker}`,
    );
  }
}

// The llm-candidate boundary gate never scans lib/member-gateway, so the
// projection service's no-write prohibition (a projection yields a
// PENDING_VERIFICATION candidate, never a promotion or canonical memory
// write) is pinned statically here in addition to the mysql zero-write
// proof.
if (/\.memoryPromotion\.|\.memoryItem\./.test(memoryProjectionSource)) {
  violations.push(
    "lib/member-gateway/signal-candidate-memory-projection.service.ts must never write MemoryPromotion or MemoryItem",
  );
}

// Memory member-verification slice (docs/superpowers/plans/2026-08-22
// -memory-member-verification.md, Architecture 2/6): the sibling
// verification service must never lose its PENDING_VERIFICATION source-
// state anchor (the only status a CAS-guarded decision may transition
// FROM), and — same reasoning as the projection service above — must
// never write MemoryPromotion or MemoryItem, which is structurally
// impossible for a member-anchored row but is pinned here in addition to
// the isolated-MySQL suite's runtime proof.
const memoryVerificationPath = path.join(
  root,
  "lib/member-gateway/signal-candidate-memory-verification.service.ts",
);
const memoryVerificationSource = readFileSync(memoryVerificationPath, "utf8");

if (!memoryVerificationSource.includes("PENDING_VERIFICATION")) {
  violations.push(
    "lib/member-gateway/signal-candidate-memory-verification.service.ts missing frozen marker: PENDING_VERIFICATION",
  );
}
if (/\.memoryPromotion\.|\.memoryItem\./.test(memoryVerificationSource)) {
  violations.push(
    "lib/member-gateway/signal-candidate-memory-verification.service.ts must never write MemoryPromotion or MemoryItem",
  );
}

const pkg = JSON.parse(
  readFileSync(path.join(root, "package.json"), "utf8"),
) as { scripts?: Record<string, string> };
if (!pkg.scripts?.["check:member-gateway"]?.includes("check-member-gateway")) {
  violations.push("package.json missing check:member-gateway wiring");
}
if (!pkg.scripts?.["check:boundaries"]?.includes("check:member-gateway")) {
  violations.push("check:boundaries does not include check:member-gateway");
}

if (violations.length > 0) {
  console.error(`member-gateway: FAIL — ${violations.length} violation(s).`);
  for (const violation of violations) {
    console.error(violation);
  }
  process.exit(1);
}
console.log(
  "member-gateway: PASS - contract literals frozen and dispatch remains schema-inexpressible; this is a contract statement, not production readiness",
);
