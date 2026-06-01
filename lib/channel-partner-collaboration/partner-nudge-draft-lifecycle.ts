import {
  CHANNEL_PARTNER_REASON_CODES,
  type ChannelPartnerReasonCode,
} from "./reason-codes";
import type {
  CustomerActorKind,
  PartnerCustomerGrant,
  PartnerNudgeDraftState,
} from "./types";

// P0-REQ-02: Partner Nudge Draft state machine (two-stage acceptance).
// Pure functions. No DB, no runtime; consumed by offline fixture eval and by
// future P1 / P2 implementations as the canonical lifecycle rule.

export const PARTNER_NUDGE_SUBMITTED_EXPIRY_DAYS = 30;
export const PARTNER_NUDGE_INTERNAL_REVIEW_TIMEOUT_DAYS = 14;
export const PARTNER_NUDGE_RESUBMIT_PER_WEEK_LIMIT = 1;

const CUSTOMER_DECISION_AUTHORIZED_KINDS: readonly CustomerActorKind[] = [
  "ADMIN",
  "OPERATOR",
  "CUSTOMER_CHAMPION",
];

export function isAuthorizedCustomerDecisionMaker(kind: CustomerActorKind): boolean {
  return CUSTOMER_DECISION_AUTHORIZED_KINDS.includes(kind);
}

export type PartnerNudgeIntent =
  | "submit"
  | "withdraw"
  | "accept"
  | "enter_internal_review"
  | "reject"
  | "promote"
  | "keep_as_note"
  | "expire"
  | "timeout_to_note"
  | "revocation_hide";

export type PartnerNudgeActor =
  | { kind: "partner"; partnerCandidateId: string }
  | {
      kind: "customer";
      membershipId: string;
      customerActorKind: CustomerActorKind;
    }
  | { kind: "system" };

export type PartnerNudgeTransitionContext = {
  actor: PartnerNudgeActor;
  grant?: PartnerCustomerGrant;
};

export type PartnerNudgeTransitionResult =
  | {
      ok: true;
      nextState: PartnerNudgeDraftState;
      auditActionType: string;
    }
  | { ok: false; reasonCode: ChannelPartnerReasonCode };

const REJECT_BASE = CHANNEL_PARTNER_REASON_CODES.PARTNER_NUDGE_ACCEPTANCE_UNAUTHORIZED;
const REJECT_INVALID_TRANSITION = CHANNEL_PARTNER_REASON_CODES.PARTNER_NUDGE_INVALID_TRANSITION;
const REJECT_GRANT_REQUIRED = CHANNEL_PARTNER_REASON_CODES.PARTNER_GRANT_REQUIRED;

function isCustomerAuthorized(ctx: PartnerNudgeTransitionContext): boolean {
  if (ctx.actor.kind !== "customer") return false;
  return isAuthorizedCustomerDecisionMaker(ctx.actor.customerActorKind);
}

function grantOkForWrite(ctx: PartnerNudgeTransitionContext): boolean {
  if (!ctx.grant) return false;
  return ctx.grant.status === "active";
}

export function transitionPartnerNudgeDraft(
  from: PartnerNudgeDraftState,
  intent: PartnerNudgeIntent,
  context: PartnerNudgeTransitionContext,
): PartnerNudgeTransitionResult {
  switch (intent) {
    case "submit": {
      if (from !== "drafted") {
        return { ok: false, reasonCode: REJECT_INVALID_TRANSITION };
      }
      if (context.actor.kind !== "partner") {
        return { ok: false, reasonCode: REJECT_INVALID_TRANSITION };
      }
      if (!grantOkForWrite(context)) {
        return { ok: false, reasonCode: REJECT_GRANT_REQUIRED };
      }
      return {
        ok: true,
        nextState: "submitted",
        auditActionType: "PARTNER_NUDGE_DRAFT_SUBMITTED",
      };
    }

    case "withdraw": {
      if (context.actor.kind !== "partner") {
        return { ok: false, reasonCode: REJECT_INVALID_TRANSITION };
      }
      // Partner may only withdraw before customer acceptance.
      if (from === "drafted" || from === "submitted") {
        return {
          ok: true,
          nextState: "withdrawn_by_partner",
          auditActionType: "PARTNER_NUDGE_DRAFT_WITHDRAWN",
        };
      }
      return { ok: false, reasonCode: REJECT_INVALID_TRANSITION };
    }

    case "accept": {
      if (from !== "submitted") {
        return { ok: false, reasonCode: REJECT_INVALID_TRANSITION };
      }
      if (!isCustomerAuthorized(context)) {
        return { ok: false, reasonCode: REJECT_BASE };
      }
      return {
        ok: true,
        nextState: "accepted_by_customer",
        auditActionType: "PARTNER_NUDGE_DRAFT_ACCEPTED",
      };
    }

    case "enter_internal_review": {
      if (from !== "accepted_by_customer") {
        return { ok: false, reasonCode: REJECT_INVALID_TRANSITION };
      }
      if (context.actor.kind !== "system") {
        return { ok: false, reasonCode: REJECT_INVALID_TRANSITION };
      }
      return {
        ok: true,
        nextState: "customer_internal_review",
        auditActionType: "PARTNER_NUDGE_DRAFT_INTERNAL_REVIEW_ENTERED",
      };
    }

    case "reject": {
      if (from !== "submitted") {
        return { ok: false, reasonCode: REJECT_INVALID_TRANSITION };
      }
      if (!isCustomerAuthorized(context)) {
        return { ok: false, reasonCode: REJECT_BASE };
      }
      return {
        ok: true,
        nextState: "rejected_by_customer",
        auditActionType: "PARTNER_NUDGE_DRAFT_REJECTED",
      };
    }

    case "promote": {
      if (from !== "customer_internal_review") {
        return { ok: false, reasonCode: REJECT_INVALID_TRANSITION };
      }
      if (!isCustomerAuthorized(context)) {
        return { ok: false, reasonCode: REJECT_BASE };
      }
      return {
        ok: true,
        nextState: "promoted_to_recommendation",
        auditActionType: "PARTNER_NUDGE_DRAFT_PROMOTED",
      };
    }

    case "keep_as_note": {
      if (from !== "customer_internal_review") {
        return { ok: false, reasonCode: REJECT_INVALID_TRANSITION };
      }
      if (!isCustomerAuthorized(context)) {
        return { ok: false, reasonCode: REJECT_BASE };
      }
      return {
        ok: true,
        nextState: "kept_as_partner_note",
        auditActionType: "PARTNER_NUDGE_DRAFT_KEPT_AS_NOTE",
      };
    }

    case "timeout_to_note": {
      if (from !== "customer_internal_review") {
        return { ok: false, reasonCode: REJECT_INVALID_TRANSITION };
      }
      if (context.actor.kind !== "system") {
        return { ok: false, reasonCode: REJECT_INVALID_TRANSITION };
      }
      return {
        ok: true,
        nextState: "kept_as_partner_note",
        auditActionType: "PARTNER_NUDGE_DRAFT_KEPT_AS_NOTE",
      };
    }

    case "expire": {
      if (from !== "submitted") {
        return { ok: false, reasonCode: REJECT_INVALID_TRANSITION };
      }
      if (context.actor.kind !== "system") {
        return { ok: false, reasonCode: REJECT_INVALID_TRANSITION };
      }
      return {
        ok: true,
        nextState: "expired",
        auditActionType: "PARTNER_NUDGE_DRAFT_EXPIRED",
      };
    }

    case "revocation_hide": {
      if (from !== "drafted" && from !== "submitted") {
        return { ok: false, reasonCode: REJECT_INVALID_TRANSITION };
      }
      if (context.actor.kind !== "system") {
        return { ok: false, reasonCode: REJECT_INVALID_TRANSITION };
      }
      return {
        ok: true,
        nextState: "withdrawn_by_partner_revocation",
        auditActionType: "PARTNER_NUDGE_DRAFT_WITHDRAWN",
      };
    }
  }
}

// Resubmit gating: per (partnerCandidateId, customerWorkspaceId, ISO-week)
// at most PARTNER_NUDGE_RESUBMIT_PER_WEEK_LIMIT submitted nudges.
export type ResubmitGateInput = {
  previousState: PartnerNudgeDraftState;
  submittedNudgeCountInWeek: number;
};

export function isResubmitAllowed(input: ResubmitGateInput): {
  ok: boolean;
  reasonCode?: ChannelPartnerReasonCode;
} {
  if (input.previousState !== "expired" && input.previousState !== "rejected_by_customer") {
    return {
      ok: false,
      reasonCode: CHANNEL_PARTNER_REASON_CODES.PARTNER_NUDGE_INVALID_TRANSITION,
    };
  }
  if (input.submittedNudgeCountInWeek >= PARTNER_NUDGE_RESUBMIT_PER_WEEK_LIMIT) {
    return {
      ok: false,
      reasonCode: CHANNEL_PARTNER_REASON_CODES.PARTNER_NUDGE_RESUBMIT_RATE_LIMITED,
    };
  }
  return { ok: true };
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function isInternalReviewTimedOut(input: {
  enteredInternalReviewAt: string;
  asOf: string;
}): boolean {
  const entered = new Date(input.enteredInternalReviewAt).getTime();
  const asOf = new Date(input.asOf).getTime();
  if (!Number.isFinite(entered) || !Number.isFinite(asOf)) return false;
  const days = (asOf - entered) / MS_PER_DAY;
  return days >= PARTNER_NUDGE_INTERNAL_REVIEW_TIMEOUT_DAYS;
}

export function isSubmittedExpired(input: {
  submittedAt: string;
  asOf: string;
}): boolean {
  const submitted = new Date(input.submittedAt).getTime();
  const asOf = new Date(input.asOf).getTime();
  if (!Number.isFinite(submitted) || !Number.isFinite(asOf)) return false;
  const days = (asOf - submitted) / MS_PER_DAY;
  return days >= PARTNER_NUDGE_SUBMITTED_EXPIRY_DAYS;
}
