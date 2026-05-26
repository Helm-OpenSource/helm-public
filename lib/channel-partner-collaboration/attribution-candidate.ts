import {
  CHANNEL_PARTNER_REASON_CODES,
  type ChannelPartnerReasonCode,
} from "./reason-codes";
import type {
  ActivityThresholdRule,
  AttributionCandidate,
  AttributionReleasedReason,
  CommissionPolicy,
  PartnerType,
} from "./types";

// P0-REQ-05: Attribution candidate threshold + lock-vs-release decision.
// Pure functions. P1 implementation will wire these into SalesReferral /
// RevenueAttributionLedger / PayoutLedger; P0 only freezes the offline rule.

export type PartnerActivityProfile = {
  acceptedNudgeCount: number;
  activeDaysWithAccess: number;
};

export type ThresholdEvaluationResult =
  | { meets: true; appliedRule: ActivityThresholdRule }
  | {
      meets: false;
      appliedRule: ActivityThresholdRule;
      reason: AttributionReleasedReason;
    };

export function evaluateMinActivityThreshold(
  partnerType: PartnerType,
  activity: PartnerActivityProfile,
  policy: CommissionPolicy,
): ThresholdEvaluationResult {
  const rule = policy.minActivityThreshold[partnerType];

  if (rule.type === "grant_only") {
    // referral-only just needs a valid grant; activity counts do not gate
    return { meets: true, appliedRule: rule };
  }

  const meets =
    activity.acceptedNudgeCount >= rule.minAcceptedNudgeCount &&
    activity.activeDaysWithAccess >= rule.minActiveDaysWithAccess;

  return meets
    ? { meets: true, appliedRule: rule }
    : {
        meets: false,
        appliedRule: rule,
        reason: "min_activity_threshold_not_met",
      };
}

// Attribution lock decision at trial→paid moment.
export type LockDecisionInput = {
  partnerType: PartnerType;
  activity: PartnerActivityProfile;
  policy: CommissionPolicy;
  grantStillActive: boolean;
  competingActiveCandidates: number;
};

export type LockDecisionResult =
  | { decision: "locked"; reasonCode: ChannelPartnerReasonCode }
  | {
      decision: "released";
      releasedReason: AttributionReleasedReason;
      reasonCode: ChannelPartnerReasonCode;
    };

export function decideAttributionLockAtTrialToPaid(
  input: LockDecisionInput,
): LockDecisionResult {
  if (!input.grantStillActive) {
    return {
      decision: "released",
      releasedReason: "customer_revoked_grant_before_lock",
      reasonCode:
        CHANNEL_PARTNER_REASON_CODES.PARTNER_ATTRIBUTION_GRANT_INACTIVE_AT_LOCK_TIME,
    };
  }

  if (input.competingActiveCandidates > 1) {
    return {
      decision: "released",
      releasedReason: "multi_partner_downgrade_to_contribution",
      reasonCode:
        CHANNEL_PARTNER_REASON_CODES.PARTNER_ATTRIBUTION_CONTEST_DOWNGRADED_TO_CONTRIBUTION,
    };
  }

  const evaluation = evaluateMinActivityThreshold(
    input.partnerType,
    input.activity,
    input.policy,
  );

  if (!evaluation.meets) {
    return {
      decision: "released",
      releasedReason: evaluation.reason,
      reasonCode:
        CHANNEL_PARTNER_REASON_CODES.PARTNER_ATTRIBUTION_THRESHOLD_RELEASED,
    };
  }

  return {
    decision: "locked",
    reasonCode:
      input.partnerType === "referral_only"
        ? CHANNEL_PARTNER_REASON_CODES.PARTNER_ATTRIBUTION_REFERRAL_LOCKED
        : CHANNEL_PARTNER_REASON_CODES.PARTNER_ATTRIBUTION_IMPLEMENTATION_LOCKED,
  };
}

// Single-active-attribution invariant. A given customer workspace must have at
// most one `locked` or `pending_lock` AttributionCandidate at any moment.
export function isAttributionUniquenessViolated(
  candidates: readonly AttributionCandidate[],
): boolean {
  const active = candidates.filter(
    (c) => c.status === "locked" || c.status === "pending_lock",
  );
  if (active.length <= 1) return false;
  const customers = new Set<string>();
  for (const c of active) {
    if (customers.has(c.customerWorkspaceId)) return true;
    customers.add(c.customerWorkspaceId);
  }
  return false;
}
