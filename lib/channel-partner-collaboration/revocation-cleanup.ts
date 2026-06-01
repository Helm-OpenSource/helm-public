import type {
  PartnerNudgeDraftState,
  RevocationCleanupActionForAccrued,
  RevocationCleanupActionForAttribution,
  RevocationCleanupActionForNudge,
  RevocationCleanupOutcome,
} from "./types";

// P0-REQ-09: Customer revokes PartnerCustomerGrant — derive cleanup actions
// per object state. Future-effect only, never retroactive.

export type RevocationContext = {
  nudgeState: PartnerNudgeDraftState;
  attributionStatus: "pending_lock" | "locked" | "released" | "suspended" | "none";
  hasAccruedUnsettledCommission: boolean;
};

function nudgeAction(state: PartnerNudgeDraftState): RevocationCleanupActionForNudge {
  switch (state) {
    case "drafted":
    case "submitted":
      return "hide_from_customer_withdraw";
    case "accepted_by_customer":
    case "customer_internal_review":
      return "retain_in_customer_partner_visibility_closed";
    case "promoted_to_recommendation":
    case "kept_as_partner_note":
    case "rejected_by_customer":
    case "withdrawn_by_partner":
    case "withdrawn_by_partner_revocation":
    case "expired":
      return "retain_in_customer_history_signature";
  }
}

function attributionAction(
  status: RevocationContext["attributionStatus"],
): RevocationCleanupActionForAttribution {
  if (status === "pending_lock" || status === "none" || status === "suspended") {
    return "release_pending_candidate";
  }
  if (status === "locked") {
    return "retain_locked_until_natural_window";
  }
  if (status === "released") {
    return "no_active_attribution_to_handle";
  }
  return "release_pending_candidate";
}

function accruedAction(
  hasAccruedUnsettledCommission: boolean,
): RevocationCleanupActionForAccrued {
  return hasAccruedUnsettledCommission
    ? "retain_until_settlement_window_manual_review"
    : "no_accrued_to_handle";
}

export function deriveRevocationCleanup(
  context: RevocationContext,
): RevocationCleanupOutcome {
  return {
    nudgeAction: nudgeAction(context.nudgeState),
    attributionAction: attributionAction(context.attributionStatus),
    accruedAction: accruedAction(context.hasAccruedUnsettledCommission),
    portfolioAliasRemoved: true,
    futureEffectOnly: true,
  };
}
