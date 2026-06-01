// P0 offline contract for Helm channel partner / 超级个体 collaboration.
// See: docs/product/HELM_CHANNEL_PARTNER_COLLABORATION_REQUIREMENTS_2026-05-12.md

export type {
  ActivityThresholdRule,
  AnyPartnerSafeDTO,
  AttributionCandidate,
  AttributionCandidateStatus,
  AttributionReleasedReason,
  CommissionPolicy,
  CountBucket,
  CustomerActorKind,
  ForbiddenRawFieldName,
  HealthBucket,
  PartnerAuditActionType,
  PartnerCustomerGrant,
  PartnerCustomerGrantScope,
  PartnerCustomerGrantStatus,
  PartnerNudgeDraft,
  PartnerNudgeDraftState,
  PartnerSafeControlLineDTO,
  PartnerSafeDecisionDTO,
  PartnerSafeMustPushDTO,
  PartnerSafePilotLoopDTO,
  PartnerSafeRecommendationDTO,
  PartnerSubjectCandidate,
  PartnerSubjectCandidateStatus,
  PartnerType,
  PortfolioAliasInput,
  ReviewPostureBucket,
  RevocationCleanupActionForAccrued,
  RevocationCleanupActionForAttribution,
  RevocationCleanupActionForNudge,
  RevocationCleanupOutcome,
} from "./types";

export {
  CHANNEL_PARTNER_COLLABORATION_P0_BOUNDARY,
  FORBIDDEN_RAW_FIELD_NAMES,
  PARTNER_AUDIT_ACTION_TYPES,
} from "./types";

export { DEFAULT_COMMISSION_POLICY } from "./commission-policy";

export {
  PARTNER_NUDGE_INTERNAL_REVIEW_TIMEOUT_DAYS,
  PARTNER_NUDGE_RESUBMIT_PER_WEEK_LIMIT,
  PARTNER_NUDGE_SUBMITTED_EXPIRY_DAYS,
  isAuthorizedCustomerDecisionMaker,
  isInternalReviewTimedOut,
  isResubmitAllowed,
  isSubmittedExpired,
  transitionPartnerNudgeDraft,
} from "./partner-nudge-draft-lifecycle";
export type {
  PartnerNudgeActor,
  PartnerNudgeIntent,
  PartnerNudgeTransitionContext,
  PartnerNudgeTransitionResult,
  ResubmitGateInput,
} from "./partner-nudge-draft-lifecycle";

export {
  decideAttributionLockAtTrialToPaid,
  evaluateMinActivityThreshold,
  isAttributionUniquenessViolated,
} from "./attribution-candidate";
export type {
  LockDecisionInput,
  LockDecisionResult,
  PartnerActivityProfile,
  ThresholdEvaluationResult,
} from "./attribution-candidate";

export { buildPortfolioAlias, portfolioAliasIsStable } from "./portfolio-alias";

export { deriveRevocationCleanup } from "./revocation-cleanup";
export type { RevocationContext } from "./revocation-cleanup";

export {
  assertPartnerSafeRecommendationDto,
  containsForbiddenRawField,
} from "./partner-safe-dto";
export type { DtoBlackListResult } from "./partner-safe-dto";

export {
  CHANNEL_PARTNER_REASON_CODES,
  isKnownChannelPartnerReasonCode,
} from "./reason-codes";
export type { ChannelPartnerReasonCode } from "./reason-codes";

export { buildLockedAttributionAnchorSpec } from "./attribution-ledger-anchor";
export type {
  AttributionAnchorBuildResult,
  LockedAttributionAnchorInput,
  LockedAttributionAnchorSpec,
  PayoutLedgerSpec,
  RevenueAttributionLedgerSpec,
  RevenueBeneficiaryTypeMirror,
  RevenueLedgerStatusMirror,
  RevenueSourceTypeMirror,
  SalesReferralSpec,
  SalesReferralStatusMirror,
} from "./attribution-ledger-anchor";
