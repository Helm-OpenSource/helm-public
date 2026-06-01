// P0 offline contract types for Helm channel partner / 超级个体 collaboration.
// Source of truth: docs/product/HELM_CHANNEL_PARTNER_COLLABORATION_REQUIREMENTS_2026-05-12.md (V2.1)
// Boundary: P0 ONLY — no Prisma schema, no migration, no runtime, no API, no UI, no automatic settlement.

export type PartnerType = "referral_only" | "implementation";

// ── P0-REQ-01: Partner Subject Candidate ─────────────────────────────────────

export type PartnerSubjectCandidateStatus =
  | "candidate"
  | "reviewed"
  | "active"
  | "suspended"
  | "released";

export type PartnerSubjectCandidate = {
  partnerCandidateId: string;
  partnerDisplayName: string;
  partnerType: PartnerType;
  sourceReference: string;
  status: PartnerSubjectCandidateStatus;
  linkedSalesReferralKey?: string;
  linkedPartnerProgramKey?: string;
  boundaryFlags: readonly string[];
};

// ── P0-REQ-02: Partner Customer Grant (authorization source) ─────────────────

export type PartnerCustomerGrantStatus =
  | "pending"
  | "active"
  | "rejected"
  | "revoked"
  | "suspended";

export type PartnerCustomerGrantScope =
  | "partner_safe_dto_readout"
  | "nudge_submission"
  | "portfolio_readout";

export type PartnerCustomerGrant = {
  grantId: string;
  partnerCandidateId: string;
  customerWorkspaceId: string;
  grantedByMembershipId: string;
  customerChampionUserId?: string;
  scope: readonly PartnerCustomerGrantScope[];
  status: PartnerCustomerGrantStatus;
  grantedAt: string;
  revokedAt?: string;
};

// ── P0-REQ-02: PartnerNudgeDraft state machine ───────────────────────────────

export type PartnerNudgeDraftState =
  | "drafted"
  | "submitted"
  | "accepted_by_customer"
  | "customer_internal_review"
  | "promoted_to_recommendation"
  | "kept_as_partner_note"
  | "rejected_by_customer"
  | "withdrawn_by_partner"
  | "withdrawn_by_partner_revocation"
  | "expired";

export type PartnerNudgeDraft = {
  nudgeId: string;
  partnerCandidateId: string;
  customerWorkspaceId: string;
  grantId: string;
  state: PartnerNudgeDraftState;
  submittedAt?: string;
  acceptedAt?: string;
  internalReviewEnteredAt?: string;
  finalizedAt?: string;
  finalDecisionByMembershipId?: string;
  rejectReasonCode?: string;
  resubmitOfNudgeId?: string;
};

// ── P0-REQ-02: Customer-side actor authorization ─────────────────────────────

export type CustomerActorKind =
  | "ADMIN"
  | "OPERATOR"
  | "CUSTOMER_CHAMPION"
  | "OTHER_MEMBER";

// ── P0-REQ-05: Attribution candidate (offline-only; not on schema) ───────────

export type AttributionCandidateStatus =
  | "pending_lock"
  | "locked"
  | "released"
  | "suspended"
  | "disputed";

export type AttributionReleasedReason =
  | "min_activity_threshold_not_met"
  | "customer_revoked_grant_before_lock"
  | "multi_partner_downgrade_to_contribution"
  | "partner_workspace_canceled";

export type AttributionCandidate = {
  candidateId: string;
  partnerCandidateId: string;
  customerWorkspaceId: string;
  grantId: string;
  sourceSignalRef?: string;
  partnerType: PartnerType;
  status: AttributionCandidateStatus;
  lockedAt?: string;
  releasedReason?: AttributionReleasedReason;
  linkedSalesReferralKey?: string;
  linkedRevenueAttributionLedgerId?: string;
};

// ── P0-REQ-05: Commission policy (configurable; not hardcoded) ───────────────

export type ActivityThresholdRule =
  | { type: "grant_only"; minAcceptedNudgeCount: 0; minActiveDaysWithAccess: 0 }
  | {
      type: "engagement_required";
      minAcceptedNudgeCount: number;
      minActiveDaysWithAccess: number;
    };

export type CommissionPolicy = {
  policyVersion: string;
  minActivityThreshold: Record<PartnerType, ActivityThresholdRule>;
};

// ── P0-REQ-02: Partner Safe DTO projection contract ──────────────────────────
// These DTOs are what partner-visible code paths MUST consume.
// They are the only allowed shape; direct reads of Recommendation / MustPush /
// Decision / SignalEvent source tables are forbidden by `partner_safe_dto_only`.

export type ReviewPostureBucket =
  | "no_review_required"
  | "review_required"
  | "in_review"
  | "review_complete";

export type HealthBucket = "healthy" | "watch" | "risk" | "blocked";

export type CountBucket = "<5" | "5-20" | "20-100" | "100+";

export type PartnerSafeRecommendationDTO = {
  recommendationAlias: string;
  judgementCategory: string;
  reasonCode: string;
  status: string;
  reviewPosture: ReviewPostureBucket;
};

export type PartnerSafeMustPushDTO = {
  mustPushAlias: string;
  riskBucket: "low" | "medium" | "high";
  ageBucket: string;
  reviewPosture: ReviewPostureBucket;
};

export type PartnerSafeDecisionDTO = {
  decisionAlias: string;
  status: string;
  dueBucket: string;
  ownerRoleLabel: string;
  reviewPosture: ReviewPostureBucket;
};

export type PartnerSafeControlLineDTO = {
  controlLineAlias: string;
  health: HealthBucket;
  milestoneBucket: string;
  blockedReasonCode?: string;
};

export type PartnerSafePilotLoopDTO = {
  pilotLoopAlias: string;
  status: string;
  milestoneBucket: string;
  proofPosture: string;
};

export type AnyPartnerSafeDTO =
  | PartnerSafeRecommendationDTO
  | PartnerSafeMustPushDTO
  | PartnerSafeDecisionDTO
  | PartnerSafeControlLineDTO
  | PartnerSafePilotLoopDTO;

// Fields that must never appear on partner-visible code paths (P0-REQ-02 black list).
export const FORBIDDEN_RAW_FIELD_NAMES = [
  "signalSummary",
  "normalizedPayload",
  "inputSummary",
  "outputSummary",
  "internalSalesNotes",
  "trialInitializationPayload",
  "askHelmQuery",
  "askHelmAnswer",
  "askHelmHistory",
  "askHelmContextPacket",
  "rawEvidence",
  "auditPayload",
  "auditSummary",
] as const;

export type ForbiddenRawFieldName = (typeof FORBIDDEN_RAW_FIELD_NAMES)[number];

// ── P0-REQ-04: Portfolio alias contract ──────────────────────────────────────

export type PortfolioAliasInput = {
  partnerCandidateId: string;
  customerWorkspaceId: string;
  grantId: string;
};

// ── P0-REQ-09: Revocation cleanup outcomes ───────────────────────────────────

export type RevocationCleanupActionForNudge =
  | "hide_from_customer_withdraw"
  | "retain_in_customer_partner_visibility_closed"
  | "retain_in_customer_history_signature";

export type RevocationCleanupActionForAttribution =
  | "release_pending_candidate"
  | "retain_locked_until_natural_window"
  | "no_active_attribution_to_handle";

export type RevocationCleanupActionForAccrued =
  | "retain_until_settlement_window_manual_review"
  | "no_accrued_to_handle";

export type RevocationCleanupOutcome = {
  nudgeAction: RevocationCleanupActionForNudge;
  attributionAction: RevocationCleanupActionForAttribution;
  accruedAction: RevocationCleanupActionForAccrued;
  portfolioAliasRemoved: boolean;
  futureEffectOnly: true;
};

// ── Audit action types referenced by the contract ────────────────────────────

export const PARTNER_AUDIT_ACTION_TYPES = [
  "PARTNER_GRANT_GRANTED_BY_CUSTOMER",
  "PARTNER_GRANT_REJECTED_BY_CUSTOMER",
  "PARTNER_GRANT_REVOKED_BY_CUSTOMER",
  "PARTNER_NUDGE_DRAFT_SUBMITTED",
  "PARTNER_NUDGE_DRAFT_ACCEPTED",
  "PARTNER_NUDGE_DRAFT_INTERNAL_REVIEW_ENTERED",
  "PARTNER_NUDGE_DRAFT_PROMOTED",
  "PARTNER_NUDGE_DRAFT_KEPT_AS_NOTE",
  "PARTNER_NUDGE_DRAFT_REJECTED",
  "PARTNER_NUDGE_DRAFT_WITHDRAWN",
  "PARTNER_NUDGE_DRAFT_EXPIRED",
  "PARTNER_PORTFOLIO_SESSION_START",
  "PARTNER_PORTFOLIO_SESSION_END",
  "PARTNER_ACCESS_DETAIL_INSPECTED_BY_CUSTOMER",
  "PARTNER_ATTRIBUTION_LOCKED",
  "PARTNER_ATTRIBUTION_RELEASED",
] as const;

export type PartnerAuditActionType = (typeof PARTNER_AUDIT_ACTION_TYPES)[number];

// ── P0 boundary posture ──────────────────────────────────────────────────────

export const CHANNEL_PARTNER_COLLABORATION_P0_BOUNDARY = {
  noSchemaMigration: true,
  noPrismaModelChange: true,
  noApiRoute: true,
  noUiSurface: true,
  noRuntimeWrite: true,
  noAutoSettlement: true,
  noOutboundSendByPartner: true,
  noPartnerAskHelm: true,
  noPartnerDirectRecommendation: true,
  noCrossTenantHelperLeak: true,
  noPartnerWorkspaceRuntimeYet: true,
} as const;
