// ---------------------------------------------------------------------------
// Helm CAIO governance — Advise-stage product loop (pure contract layer).
//
// The Advise loop closes advice -> CEO decision -> decision receipt as
// governance RECORDS. An advice proposes; only the CEO decides; a decision
// receipt is a projection of the decided record, never a work order.
//
// AUTHORITY FIREWALL (deliberate, load-bearing):
//   - `authorityEffect` is the literal "none" and `executionRef` is the
//     literal null: an ACCEPTED advice still executes nothing, dispatches
//     nothing, and grants nothing. Consuming systems keep getting their
//     authority from the existing permission / policy chain.
//   - Advice may exist only under an ACTIVE mandate whose stage is
//     "advise" (validated here and re-checked fail-closed by the store).
//     The frozen stage-evidence axis in types.ts is NOT changed by this
//     module: whether "advise" is presented as formed remains a product
//     honesty decision owned by the ADR, not by code.
//
// Pure types + deterministic validators only: no IO, no persistence, no
// runtime authority, no DB, no API, no server action.
// ---------------------------------------------------------------------------

import { parseInstant } from "@/lib/caio-governance/contract";
import type { CaioMandate } from "@/lib/caio-governance/types";

export const CAIO_ADVICE_STATUSES = [
  "proposed",
  "accepted",
  "rejected",
  "deferred",
  "withdrawn",
  "expired",
] as const;

export type CaioAdviceStatus = (typeof CAIO_ADVICE_STATUSES)[number];

// The only outcomes a CEO decision may carry. "expired" and "withdrawn"
// are lifecycle states, not decisions — a decision cannot mint them.
export const CAIO_ADVICE_DECISION_OUTCOMES = [
  "accepted",
  "rejected",
  "deferred",
] as const;

export type CaioAdviceDecisionOutcome =
  (typeof CAIO_ADVICE_DECISION_OUTCOMES)[number];

export type CaioAdvice = {
  adviceId: string;
  workspaceRef: string;
  // The governing mandate record. Advice is only meaningful under an
  // active advise-stage mandate.
  mandateRef: string;
  caioRef: string;
  // Idempotency key: one advice per (workspace, adviceKey); retried
  // proposals must carry identical immutable content.
  adviceKey: string;
  // What the advice is about (an opaque business subject ref).
  subjectRef: string;
  title: string;
  recommendation: string;
  // Grounding evidence. Ungrounded advice is invalid: at least one
  // observation ref is required.
  observationRefs: readonly string[];
  proposedAt: string;
  validUntil: string;
  status: CaioAdviceStatus;
  // Decision fields: all four present iff status is a decision outcome.
  // decidedByRef must equal the governing mandate's ceoRef — advice
  // reports to the CEO alone.
  decidedByRef: string | null;
  decisionOutcome: CaioAdviceDecisionOutcome | null;
  decisionReason: string | null;
  decidedAt: string | null;
  // Present iff status is "withdrawn": the withdrawal instant, so the
  // single-clock projection can say what was true BEFORE the withdrawal.
  withdrawnAt: string | null;
  auditRefs: readonly string[];
  // Authority firewall literals (see file header).
  authorityEffect: "none";
  executionRef: null;
};

export type CaioAdviceValidation = {
  valid: boolean;
  errors: readonly string[];
};

const DECIDED_STATUSES: readonly CaioAdviceStatus[] = [
  "accepted",
  "rejected",
  "deferred",
];

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

export function validateCaioAdvice(advice: CaioAdvice): CaioAdviceValidation {
  const errors: string[] = [];
  for (const [field, value] of [
    ["adviceId", advice.adviceId],
    ["workspaceRef", advice.workspaceRef],
    ["mandateRef", advice.mandateRef],
    ["caioRef", advice.caioRef],
    ["adviceKey", advice.adviceKey],
    ["subjectRef", advice.subjectRef],
    ["title", advice.title],
    ["recommendation", advice.recommendation],
  ] as const) {
    if (!nonEmpty(value)) errors.push(`${field} is required`);
  }
  if (
    !Array.isArray(advice.observationRefs) ||
    advice.observationRefs.length === 0 ||
    advice.observationRefs.some((ref) => !nonEmpty(ref))
  ) {
    errors.push(
      "observationRefs must contain at least one non-empty grounding ref; ungrounded advice is invalid",
    );
  }
  const proposedAt = parseInstant(advice.proposedAt);
  const validUntil = parseInstant(advice.validUntil);
  if (proposedAt === null) errors.push("proposedAt must be a strict RFC 3339 instant");
  if (validUntil === null) errors.push("validUntil must be a strict RFC 3339 instant");
  if (proposedAt !== null && validUntil !== null && validUntil <= proposedAt) {
    errors.push("validUntil must be after proposedAt");
  }
  if (!CAIO_ADVICE_STATUSES.includes(advice.status)) {
    errors.push(`status must be one of: ${CAIO_ADVICE_STATUSES.join(", ")}`);
  }
  const isDecided = DECIDED_STATUSES.includes(advice.status);
  if (isDecided) {
    if (!nonEmpty(advice.decidedByRef)) {
      errors.push("a decided advice must record decidedByRef");
    }
    if (advice.decisionOutcome !== advice.status) {
      errors.push(
        "decisionOutcome must equal the decided status (a decision cannot be relabeled)",
      );
    }
    if (!nonEmpty(advice.decisionReason)) {
      errors.push("a decided advice must record decisionReason");
    }
    const decidedAt =
      advice.decidedAt === null ? null : parseInstant(advice.decidedAt);
    if (decidedAt === null) {
      errors.push("a decided advice must record decidedAt as a strict RFC 3339 instant");
    } else {
      if (proposedAt !== null && decidedAt < proposedAt) {
        errors.push("decidedAt cannot precede proposedAt");
      }
      if (validUntil !== null && decidedAt >= validUntil) {
        errors.push(
          "decidedAt must precede the advice validUntil (a late decision records expiry, never a decision)",
        );
      }
    }
  } else if (
    advice.decidedByRef !== null ||
    advice.decisionOutcome !== null ||
    advice.decisionReason !== null ||
    advice.decidedAt !== null
  ) {
    errors.push(
      "an undecided advice must carry no decision fields (no pre-filled decisions)",
    );
  }
  if (advice.status === "withdrawn") {
    const withdrawnAt =
      advice.withdrawnAt === null ? null : parseInstant(advice.withdrawnAt);
    if (withdrawnAt === null) {
      errors.push(
        "a withdrawn advice must record withdrawnAt as a strict RFC 3339 instant",
      );
    } else if (proposedAt !== null && withdrawnAt < proposedAt) {
      errors.push("withdrawnAt cannot precede proposedAt");
    }
  } else if (advice.withdrawnAt !== null) {
    errors.push("only a withdrawn advice may carry withdrawnAt");
  }
  if (advice.authorityEffect !== "none") {
    errors.push('authorityEffect must be the literal "none"');
  }
  if (advice.executionRef !== null) {
    errors.push(
      "executionRef must be the literal null: an accepted advice still executes nothing",
    );
  }
  return { valid: errors.length === 0, errors };
}

// Advice is only legal under its governing mandate: same workspace, the
// mandate stage is "advise", the advice window lies within the mandate
// window, and any decision was made by the mandate's CEO. Deliberately
// does NOT check mandate.status — status is temporal state the STORE must
// judge at transaction time; a pure validator cannot know "now".
export function validateCaioAdviceAgainstMandate(
  advice: CaioAdvice,
  mandate: CaioMandate,
): CaioAdviceValidation {
  const errors: string[] = [];
  if (advice.mandateRef !== mandate.mandateId) {
    errors.push("advice.mandateRef must reference the governing mandate");
  }
  if (advice.workspaceRef !== mandate.workspaceRef) {
    errors.push("advice and mandate must belong to the same workspace");
  }
  if (advice.caioRef !== mandate.caioRef) {
    errors.push("advice.caioRef must equal the mandate's caioRef");
  }
  if (mandate.stage !== "advise") {
    errors.push(
      `advice requires a mandate at stage "advise"; got "${mandate.stage}" (stage is a product-honesty axis, never an authorization ordering — no other stage implies advise)`,
    );
  }
  const adviceFrom = parseInstant(advice.proposedAt);
  const adviceUntil = parseInstant(advice.validUntil);
  const mandateFrom = parseInstant(mandate.validFrom);
  const mandateUntil = parseInstant(mandate.validUntil);
  if (
    adviceFrom === null ||
    adviceUntil === null ||
    mandateFrom === null ||
    mandateUntil === null ||
    adviceFrom < mandateFrom ||
    adviceUntil > mandateUntil
  ) {
    errors.push("the advice window must lie within the mandate validity window");
  }
  if (advice.decidedByRef !== null && advice.decidedByRef !== mandate.ceoRef) {
    errors.push(
      "only the mandate's CEO can decide advice (decidedByRef must equal mandate.ceoRef)",
    );
  }
  if (advice.decidedAt !== null) {
    const decidedAt = parseInstant(advice.decidedAt);
    if (
      decidedAt === null ||
      mandateFrom === null ||
      mandateUntil === null ||
      decidedAt < mandateFrom ||
      // right-open window: an instant AT validUntil is already outside
      decidedAt >= mandateUntil
    ) {
      errors.push(
        "a decision instant must lie within the mandate validity window",
      );
    }
  }
  return { valid: errors.length === 0, errors };
}

// The decision receipt: a pure PROJECTION of a decided advice. It is
// evidence that a decision happened — never a work order, an approval
// token, or an execution input.
export type CaioAdviceDecisionReceipt = {
  adviceRef: string;
  mandateRef: string;
  subjectRef: string;
  outcome: CaioAdviceDecisionOutcome;
  decidedByRef: string;
  decidedAt: string;
  decisionReason: string;
  authorityEffect: "none";
};

export type CaioAdviceDecisionProjection =
  | { state: "not_yet_proposed"; proposedAt: string }
  | { state: "awaiting_decision"; expiresAt: string }
  | { state: "expired"; expiredAt: string }
  | { state: "withdrawn"; withdrawnAt: string }
  | { state: "decided"; receipt: CaioAdviceDecisionReceipt };

// Single-clock projection: `atIso` is a genuine historical clock — the
// projection says what was true AT that instant, for every state. A
// decided record projects as awaiting before its decidedAt; a withdrawn
// record projects as awaiting before its withdrawnAt; every record
// projects as not_yet_proposed before its proposedAt. Fails closed
// (throws) on an advice that does not validate — projections of invalid
// records are meaningless.
export function projectCaioAdviceDecision(
  advice: CaioAdvice,
  atIso: string,
): CaioAdviceDecisionProjection {
  const validation = validateCaioAdvice(advice);
  if (!validation.valid) {
    throw new Error(
      `refusing to project an invalid advice record: ${validation.errors.join("; ")}`,
    );
  }
  const at = parseInstant(atIso);
  if (at === null) {
    throw new Error("projection instant must be a strict RFC 3339 instant");
  }
  const proposedAt = parseInstant(advice.proposedAt) as number;
  const validUntil = parseInstant(advice.validUntil) as number;
  if (at < proposedAt) {
    return { state: "not_yet_proposed", proposedAt: advice.proposedAt };
  }
  const timeStateAt = () =>
    validUntil <= at
      ? ({ state: "expired", expiredAt: advice.validUntil } as const)
      : ({ state: "awaiting_decision", expiresAt: advice.validUntil } as const);
  if (advice.status === "withdrawn") {
    const withdrawnAt = parseInstant(advice.withdrawnAt as string) as number;
    if (at < withdrawnAt) return timeStateAt();
    return { state: "withdrawn", withdrawnAt: advice.withdrawnAt as string };
  }
  if (advice.status === "expired" || advice.status === "proposed") {
    return timeStateAt();
  }
  {
    const decidedAt = parseInstant(advice.decidedAt as string) as number;
    if (at < decidedAt) return timeStateAt();
  }
  // Decided statuses: validateCaioAdvice already guaranteed the decision
  // fields are present and consistent.
  return {
    state: "decided",
    receipt: {
      adviceRef: advice.adviceId,
      mandateRef: advice.mandateRef,
      subjectRef: advice.subjectRef,
      outcome: advice.decisionOutcome as CaioAdviceDecisionOutcome,
      decidedByRef: advice.decidedByRef as string,
      decidedAt: advice.decidedAt as string,
      decisionReason: advice.decisionReason as string,
      authorityEffect: "none",
    },
  };
}
