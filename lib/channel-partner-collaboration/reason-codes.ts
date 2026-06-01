// Canonical reason-code registry for the Helm channel partner P0 contract.
// Every reasonCode emitted by lib/channel-partner-collaboration/* AND every
// reasonCode appearing in the offline fixture pack MUST be a value of this
// const object. The evaluator validates fixture-side membership at gate time;
// `tsc` validates contract-side membership at compile time.

export const CHANNEL_PARTNER_REASON_CODES = {
  // Grant / authorization
  PARTNER_GRANT_REQUIRED: "partner_grant_required",

  // Partner Safe DTO projection (P0-REQ-02 / P0-REQ-07)
  PARTNER_SAFE_DTO_ONLY: "partner_safe_dto_only",
  RAW_SOURCE_TABLE_BLOCKED: "raw_source_table_blocked",

  // P0-REQ-02 black list
  PARTNER_ASK_HELM_FORBIDDEN: "partner_ask_helm_forbidden",
  PARTNER_COLLABORATOR_NO_OUTBOUND_SEND: "partner_collaborator_no_outbound_send",

  // Partner cannot bypass nudge to directly write Recommendation
  PARTNER_NUDGE_NO_DIRECT_PROMOTION: "partner_nudge_no_direct_promotion",

  // Partner nudge state-machine outcomes
  PARTNER_NUDGE_INVALID_TRANSITION: "partner_nudge_invalid_transition",
  PARTNER_NUDGE_ACCEPTANCE_UNAUTHORIZED: "partner_nudge_acceptance_unauthorized",
  PARTNER_NUDGE_LIFECYCLE_PROMOTED: "partner_nudge_lifecycle_promoted",
  PARTNER_NUDGE_LIFECYCLE_KEPT_AS_NOTE: "partner_nudge_lifecycle_kept_as_note",
  PARTNER_NUDGE_TIMEOUT_KEPT_AS_NOTE: "partner_nudge_timeout_kept_as_note",
  PARTNER_NUDGE_LIFECYCLE_REJECTED: "partner_nudge_lifecycle_rejected",
  PARTNER_NUDGE_RESUBMIT_RATE_LIMITED: "partner_nudge_resubmit_rate_limited",

  // P0-REQ-05 attribution lock / release outcomes
  PARTNER_ATTRIBUTION_SINGLE_ACTIVE_OK: "partner_attribution_single_active_ok",
  PARTNER_ATTRIBUTION_CONTEST_DOWNGRADED_TO_CONTRIBUTION:
    "partner_attribution_contest_downgraded_to_contribution",
  PARTNER_ATTRIBUTION_THRESHOLD_RELEASED: "partner_attribution_threshold_released",
  PARTNER_ATTRIBUTION_REFERRAL_LOCKED: "partner_attribution_referral_locked",
  PARTNER_ATTRIBUTION_IMPLEMENTATION_LOCKED:
    "partner_attribution_implementation_locked",
  PARTNER_ATTRIBUTION_GRANT_INACTIVE_AT_LOCK_TIME:
    "partner_attribution_grant_inactive_at_lock_time",
  PARTNER_ATTRIBUTION_LEDGER_ANCHOR_REFERENCED:
    "partner_attribution_ledger_anchor_referenced",

  // P2 candidate (offline-only)
  P2_PARTNER_WORKSPACE_CANCEL_SUSPEND_CANDIDATE_OFFLINE_ONLY:
    "p2_partner_workspace_cancel_suspend_candidate_offline_only",

  // P0-REQ-09 revocation cleanup
  PARTNER_GRANT_REVOCATION_CLEANUP_OFFLINE_CONTRACT:
    "partner_grant_revocation_cleanup_offline_contract",
  PARTNER_GRANT_REVOCATION_PENDING_ATTRIBUTION_RELEASED:
    "partner_grant_revocation_pending_attribution_released",

  // Portfolio readout boundary
  PARTNER_PORTFOLIO_PRIVACY_BOUNDARY_OK: "partner_portfolio_privacy_boundary_ok",
  PARTNER_PORTFOLIO_CROSS_TENANT_SCOPE: "partner_portfolio_cross_tenant_scope",
} as const;

export type ChannelPartnerReasonCode =
  (typeof CHANNEL_PARTNER_REASON_CODES)[keyof typeof CHANNEL_PARTNER_REASON_CODES];

const REASON_CODE_VALUES: ReadonlySet<string> = new Set(
  Object.values(CHANNEL_PARTNER_REASON_CODES),
);

export function isKnownChannelPartnerReasonCode(
  code: string,
): code is ChannelPartnerReasonCode {
  return REASON_CODE_VALUES.has(code);
}
