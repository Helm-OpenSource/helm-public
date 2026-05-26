/**
 * Helm Business Advancement — disabled internal dogfooding packet.
 *
 * Pure packet builder for OPC-stage internal dogfooding preparation. It consumes
 * the founder internal gate and Phase 3M injected-row prototype output, then
 * creates a review-only packet for internal evaluation.
 *
 * It is NOT production query adoption, NOT a runtime adapter, NOT a DB reader,
 * NOT an API, NOT a page integration, NOT a schema change, NOT an official
 * write path, and NOT automated execution authority.
 */

import {
  CAPABILITY_BLOCKED_DECISION_READ,
  CAPABILITY_CUSTOMER_WAITING_READ,
  CAPABILITY_OVERDUE_COMMITMENT_READ,
  PHASE3M_RULE_VERSION,
  runPhase3mDisabledInternalSeamPrototype,
  type Phase3mInput,
  type Phase3mOutput,
} from "./phase3m-disabled-internal-seam-prototype";
import {
  FOUNDER_INTERNAL_GATE_FORBIDDEN_WORK,
  FOUNDER_INTERNAL_GATE_RULE_VERSION,
  POSITIVE_FOUNDER_INTERNAL_GATE_INPUT,
  evaluateFounderInternalGate,
  type FounderInternalGateResult,
} from "./founder-internal-gate";

export const INTERNAL_DOGFOOD_PACKET_RULE_VERSION =
  "business-advancement-internal-dogfood-packet/v1" as const;

export const INTERNAL_DOGFOOD_PACKET_POSTURE =
  "Disabled-Internal-Dogfooding-Only" as const;

export const INTERNAL_DOGFOOD_PACKET_RUNTIME_ADOPTION = "No-Go" as const;

export type InternalDogfoodPacketDecision =
  | "Ready-For-Internal-Dogfooding"
  | "Blocked";

export interface InternalDogfoodPacketOperatorContext {
  readonly packetId: string;
  readonly preparedBy: string;
  readonly preparedAtIso: string;
}

export interface InternalDogfoodCandidateGroup {
  readonly familyId: "TPQR-001" | "TPQR-003" | "TPQR-004";
  readonly signalType: "blocked_decision" | "overdue_commitment" | "customer_waiting";
  readonly status: "evaluated" | "disabled" | "capability_denied";
  readonly includedCount: number;
  readonly excludedCount: number;
  readonly reviewOnlyAction: string;
  readonly boundaryNote: string;
}

export interface InternalDogfoodPacketInput {
  readonly operatorContext: InternalDogfoodPacketOperatorContext;
  readonly founderGate: FounderInternalGateResult;
  readonly prototypeInput: Phase3mInput;
}

export interface InternalDogfoodPacketCheck {
  readonly name: string;
  readonly pass: boolean;
  readonly detail: string;
  readonly blocker?: string;
}

export interface InternalDogfoodPacket {
  readonly ruleVersion: typeof INTERNAL_DOGFOOD_PACKET_RULE_VERSION;
  readonly posture: typeof INTERNAL_DOGFOOD_PACKET_POSTURE;
  readonly runtimeAdoption: typeof INTERNAL_DOGFOOD_PACKET_RUNTIME_ADOPTION;
  readonly founderGateRuleVersion: typeof FOUNDER_INTERNAL_GATE_RULE_VERSION;
  readonly phase3mRuleVersion: typeof PHASE3M_RULE_VERSION;
  readonly decision: InternalDogfoodPacketDecision;
  readonly productionQueryAdoptionAllowed: false;
  readonly runtimeIntegrationAllowed: false;
  readonly publicTrialAllowed: false;
  readonly operatorContext: InternalDogfoodPacketOperatorContext;
  readonly candidateGroups: readonly InternalDogfoodCandidateGroup[];
  readonly checks: readonly InternalDogfoodPacketCheck[];
  readonly blockers: readonly string[];
  readonly reviewInstructions: readonly string[];
  readonly stopConditions: readonly string[];
  readonly forbiddenWork: readonly string[];
}

const WS = "internal-dogfood-fixture-workspace";
const REF_CLOCK_MS = 1777161600000; // 2026-04-24T00:00:00.000Z
const DAY_MS = 24 * 60 * 60 * 1000;

export const INTERNAL_DOGFOOD_PACKET_REVIEW_INSTRUCTIONS = [
  "Review each candidate group for precision before considering any runtime work.",
  "Treat included rows as review-only examples; do not write back to CRM, memory, approval, or customer-facing systems.",
  "Record false positives, missing evidence, and threshold concerns as review notes only.",
  "If any reviewer asks for production data, stop and return to redacted real-data calibration.",
] as const;

export const INTERNAL_DOGFOOD_PACKET_STOP_CONDITIONS = [
  "Founder internal gate is not Go-For-Disabled-Internal-Dogfooding",
  "Public-release guard regresses",
  "Any step requires data/queries.ts, mobile read-model, schema, API, page behavior, official write, or auto-execution changes",
  "Any reviewer requests production data without redacted calibration approval",
  "Candidate group output is empty or all candidates are capability-denied",
] as const;

export const POSITIVE_INTERNAL_DOGFOOD_PROTOTYPE_INPUT: Phase3mInput = {
  workspaceId: WS,
  referenceClockMs: REF_CLOCK_MS,
  flags: { tpqr001: true, tpqr003: true, tpqr004: true },
  capabilities: [
    CAPABILITY_BLOCKED_DECISION_READ,
    CAPABILITY_OVERDUE_COMMITMENT_READ,
    CAPABILITY_CUSTOMER_WAITING_READ,
  ],
  rows: {
    tpqr001: [
      {
        rowId: "internal-ai-stale",
        workspaceId: WS,
        updatedAtMs: REF_CLOCK_MS - 5 * DAY_MS,
        hasApprovalTask: false,
      },
      {
        rowId: "internal-ai-in-review",
        workspaceId: WS,
        updatedAtMs: REF_CLOCK_MS - 4 * DAY_MS,
        hasApprovalTask: true,
      },
    ],
    tpqr003: [
      {
        rowId: "internal-c-overdue",
        workspaceId: WS,
        commitmentId: "internal-commitment-001",
        dueDateMs: REF_CLOCK_MS - 2 * DAY_MS,
        status: "ACTIVE",
        persistedOverdueFlag: false,
      },
      {
        rowId: "internal-c-canceled",
        workspaceId: WS,
        commitmentId: "internal-commitment-002",
        dueDateMs: REF_CLOCK_MS - 3 * DAY_MS,
        status: "CANCELED",
        persistedOverdueFlag: true,
      },
    ],
    tpqr004: [
      {
        rowId: "internal-et-crm",
        workspaceId: WS,
        emailThreadId: "internal-thread-crm",
        threadStatus: "WAITING_US",
        opportunityId: "internal-opportunity-001",
      },
      {
        rowId: "internal-et-generic",
        workspaceId: WS,
        emailThreadId: "internal-thread-generic",
        threadStatus: "WAITING_US",
        opportunityId: null,
      },
    ],
  },
};

export const DEFAULT_INTERNAL_DOGFOOD_PACKET_INPUT: InternalDogfoodPacketInput = {
  operatorContext: {
    packetId: "ba-internal-dogfood-default",
    preparedBy: "",
    preparedAtIso: "",
  },
  founderGate: evaluateFounderInternalGate(),
  prototypeInput: POSITIVE_INTERNAL_DOGFOOD_PROTOTYPE_INPUT,
};

export const POSITIVE_INTERNAL_DOGFOOD_PACKET_INPUT: InternalDogfoodPacketInput = {
  operatorContext: {
    packetId: "ba-internal-dogfood-2026-04-30",
    preparedBy: "codex",
    preparedAtIso: "2026-04-30T00:00:00.000Z",
  },
  founderGate: evaluateFounderInternalGate(POSITIVE_FOUNDER_INTERNAL_GATE_INPUT),
  prototypeInput: POSITIVE_INTERNAL_DOGFOOD_PROTOTYPE_INPUT,
};

export function buildInternalDogfoodPacket(
  input: InternalDogfoodPacketInput = DEFAULT_INTERNAL_DOGFOOD_PACKET_INPUT,
): InternalDogfoodPacket {
  const prototype = runPhase3mDisabledInternalSeamPrototype(input.prototypeInput);
  const candidateGroups = buildCandidateGroups(prototype);
  const checks = buildChecks(input, prototype, candidateGroups);
  const blockers = checks.flatMap((check) =>
    check.pass || !check.blocker ? [] : [check.blocker],
  );
  const decision: InternalDogfoodPacketDecision =
    blockers.length === 0 ? "Ready-For-Internal-Dogfooding" : "Blocked";

  return {
    ruleVersion: INTERNAL_DOGFOOD_PACKET_RULE_VERSION,
    posture: INTERNAL_DOGFOOD_PACKET_POSTURE,
    runtimeAdoption: INTERNAL_DOGFOOD_PACKET_RUNTIME_ADOPTION,
    founderGateRuleVersion: FOUNDER_INTERNAL_GATE_RULE_VERSION,
    phase3mRuleVersion: PHASE3M_RULE_VERSION,
    decision,
    productionQueryAdoptionAllowed: false,
    runtimeIntegrationAllowed: false,
    publicTrialAllowed: false,
    operatorContext: input.operatorContext,
    candidateGroups,
    checks,
    blockers,
    reviewInstructions: [...INTERNAL_DOGFOOD_PACKET_REVIEW_INSTRUCTIONS],
    stopConditions: [...INTERNAL_DOGFOOD_PACKET_STOP_CONDITIONS],
    forbiddenWork: [...FOUNDER_INTERNAL_GATE_FORBIDDEN_WORK],
  };
}

function buildCandidateGroups(
  prototype: Phase3mOutput,
): InternalDogfoodCandidateGroup[] {
  return [
    {
      familyId: "TPQR-001",
      signalType: "blocked_decision",
      status: prototype.tpqr001.status,
      includedCount: prototype.tpqr001.result.included.length,
      excludedCount: prototype.tpqr001.result.excluded.length,
      reviewOnlyAction: "Review blocked-decision examples in the packet.",
      boundaryNote:
        "Review only; this does not approve, reject, assign, notify, or write any decision.",
    },
    {
      familyId: "TPQR-003",
      signalType: "overdue_commitment",
      status: prototype.tpqr003.status,
      includedCount: prototype.tpqr003.result.included.length,
      excludedCount: prototype.tpqr003.result.excluded.length,
      reviewOnlyAction: "Review overdue-commitment examples in the packet.",
      boundaryNote:
        "Review only; this does not mark commitments fulfilled, canceled, sent, or externally promised.",
    },
    {
      familyId: "TPQR-004",
      signalType: "customer_waiting",
      status: prototype.tpqr004.status,
      includedCount: prototype.tpqr004.result.included.length,
      excludedCount: prototype.tpqr004.result.excluded.length,
      reviewOnlyAction: "Review customer-waiting examples in the packet.",
      boundaryNote:
        "Review only; this does not send messages, update CRM, or make customer-facing commitments.",
    },
  ];
}

function buildChecks(
  input: InternalDogfoodPacketInput,
  prototype: Phase3mOutput,
  groups: readonly InternalDogfoodCandidateGroup[],
): InternalDogfoodPacketCheck[] {
  return [
    checkOperatorContext(input.operatorContext),
    checkFounderGate(input.founderGate),
    checkPrototypeSafety(prototype),
    checkCandidateGroups(groups),
  ];
}

function checkOperatorContext(
  context: InternalDogfoodPacketOperatorContext,
): InternalDogfoodPacketCheck {
  const strictIso = isStrictUtcIso(context.preparedAtIso);
  const pass =
    context.packetId.trim().length > 0 &&
    context.preparedBy.trim().length > 0 &&
    strictIso;

  return {
    name: "operator_context_present",
    pass,
    detail: pass
      ? `Packet ${context.packetId} prepared by ${context.preparedBy} at ${context.preparedAtIso}.`
      : `Operator context incomplete: packetId=${context.packetId || "<missing>"} preparedBy=${context.preparedBy || "<missing>"} strictIso=${String(strictIso)}.`,
    blocker: pass
      ? undefined
      : "Internal dogfooding packet requires packetId, preparer, and strict UTC timestamp.",
  };
}

function checkFounderGate(
  gate: FounderInternalGateResult,
): InternalDogfoodPacketCheck {
  const pass =
    gate.decision === "Go-For-Disabled-Internal-Dogfooding" &&
    gate.productionQueryAdoptionAllowed === false &&
    gate.runtimeIntegrationAllowed === false &&
    gate.publicTrialAllowed === false;

  return {
    name: "founder_internal_gate_go",
    pass,
    detail: pass
      ? "Founder internal gate is Go-For-Disabled-Internal-Dogfooding and keeps production/runtime/public trial blocked."
      : `Founder gate not ready or unsafe: decision=${gate.decision}, production=${String(gate.productionQueryAdoptionAllowed)}, runtime=${String(gate.runtimeIntegrationAllowed)}, publicTrial=${String(gate.publicTrialAllowed)}.`,
    blocker: pass
      ? undefined
      : "Founder internal gate must be Go for disabled internal dogfooding while production/runtime/public trial stay blocked.",
  };
}

function checkPrototypeSafety(
  prototype: Phase3mOutput,
): InternalDogfoodPacketCheck {
  const pass =
    prototype.runtimeAdoptionPosture === "No-Go" &&
    prototype.productionIntegrationAllowed === false &&
    prototype.tpqr001.status === "evaluated" &&
    prototype.tpqr003.status === "evaluated" &&
    prototype.tpqr004.status === "evaluated";

  return {
    name: "phase3m_prototype_safe",
    pass,
    detail: pass
      ? "Phase 3M prototype is evaluated for TPQR-001/003/004 while runtime adoption remains No-Go and production integration false."
      : `Phase 3M unsafe: runtime=${prototype.runtimeAdoptionPosture}, production=${String(prototype.productionIntegrationAllowed)}, statuses=${prototype.tpqr001.status}/${prototype.tpqr003.status}/${prototype.tpqr004.status}.`,
    blocker: pass
      ? undefined
      : "Phase 3M prototype must evaluate TPQR-001/003/004 without production integration.",
  };
}

function checkCandidateGroups(
  groups: readonly InternalDogfoodCandidateGroup[],
): InternalDogfoodPacketCheck {
  const totalIncluded = groups.reduce((sum, group) => sum + group.includedCount, 0);
  const allHaveBoundaries = groups.every(
    (group) =>
      group.reviewOnlyAction.toLowerCase().includes("review") &&
      group.boundaryNote.toLowerCase().includes("review only"),
  );
  const pass = totalIncluded > 0 && allHaveBoundaries;

  return {
    name: "candidate_groups_review_only",
    pass,
    detail: pass
      ? `Candidate groups ready for review-only dogfooding: totalIncluded=${totalIncluded}, groups=${groups.length}.`
      : `Candidate group issue: totalIncluded=${totalIncluded}, allHaveBoundaries=${String(allHaveBoundaries)}.`,
    blocker: pass
      ? undefined
      : "Internal dogfooding packet requires at least one included candidate and visible review-only boundary notes.",
  };
}

function isStrictUtcIso(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
    return false;
  }
  return new Date(value).toISOString() === value;
}
