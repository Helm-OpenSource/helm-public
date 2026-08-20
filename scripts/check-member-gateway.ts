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
