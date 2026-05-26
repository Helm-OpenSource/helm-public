import { CHANNEL_PARTNER_REASON_CODES } from "./reason-codes";
import type {
  AttributionCandidate,
  PartnerAuditActionType,
  PartnerCustomerGrant,
  PartnerType,
} from "./types";

// P1 spec builder: given a `locked` AttributionCandidate, produce pure
// write-spec objects for SalesReferral / RevenueAttributionLedger /
// PayoutLedger. NOT a Prisma writer; the actual write adapter belongs in a
// Helm-reserved-only service layer that consumes these specs.
//
// Boundary: this module is P0-pure (no @prisma/client import, no DB call).
// It encodes the contract that "P1 internal implementation will reuse existing
// SalesReferral / RevenueAttributionLedger / PayoutLedger" without bringing
// runtime dependencies into the P0 surface.

// Enum mirrors — values match prisma/schema.prisma `SalesReferralStatus`,
// `RevenueSourceType`, `RevenueBeneficiaryType`, `RevenueLedgerStatus`. We
// inline string literal unions instead of importing @prisma/client to keep the
// P0 contract pure.
export type SalesReferralStatusMirror = "ACTIVE" | "INACTIVE" | "CANCELED";
export type RevenueSourceTypeMirror =
  | "ORGANIZATION_BASE_FEE"
  | "ACTIVE_SEAT"
  | "ADD_ON_WORKER"
  | "CUSTOM_IMPLEMENTATION"
  | "CUSTOM_MAINTENANCE"
  | "SALES_REFERRAL";
export type RevenueBeneficiaryTypeMirror =
  | "PLATFORM"
  | "WORKER_PUBLISHER"
  | "SALES_REFERRAL"
  | "CUSTOM_SERVICES";
export type RevenueLedgerStatusMirror = "PENDING" | "APPROVED" | "PAID" | "REVERSED";

export type SalesReferralSpec = {
  workspaceId: string;
  referralKey: string;
  beneficiaryLabel: string;
  beneficiaryContact?: string;
  notes: string;
  status: SalesReferralStatusMirror;
  effectiveFrom: string;
};

export type RevenueAttributionLedgerSpec = {
  workspaceId: string;
  // SalesReferral FK is resolved at write-time; we carry the upstream key here.
  salesReferralKey: string;
  sourceType: RevenueSourceTypeMirror;
  beneficiaryType: RevenueBeneficiaryTypeMirror;
  sourceLabel: string;
  sourceReference: string;
  beneficiaryLabel: string;
  grossAmountCents: number;
  attributedAmountCents: number;
  currency: string;
  status: RevenueLedgerStatusMirror;
  recognizedAt: string;
};

export type PayoutLedgerSpec = {
  workspaceId: string;
  // RevenueAttributionLedger FK is resolved at write-time; we carry a logical
  // back-reference so the writer can resolve it after creating the ledger row.
  revenueAttributionLedgerLogicalRef: string;
  beneficiaryType: RevenueBeneficiaryTypeMirror;
  beneficiaryLabel: string;
  payableAmountCents: number;
  currency: string;
  status: RevenueLedgerStatusMirror;
  payableAfter?: string;
};

export type LockedAttributionAnchorInput = {
  candidate: AttributionCandidate;
  grant: PartnerCustomerGrant;
  reservedWorkspaceId: string;
  customerPaymentAmountCents: number;
  commissionRateBasisPoints: number;
  recognizedAt: string;
  currency?: string;
  partnerDisplayName: string;
};

export type LockedAttributionAnchorSpec = {
  salesReferral: SalesReferralSpec;
  revenueAttributionLedger: RevenueAttributionLedgerSpec;
  payoutLedger: PayoutLedgerSpec;
  auditActionTypes: readonly PartnerAuditActionType[];
};

export type AttributionAnchorBuildResult =
  | { ok: true; spec: LockedAttributionAnchorSpec }
  | { ok: false; reasonCode: string };

const MAX_BASIS_POINTS = 10_000;
const DEFAULT_CURRENCY = "CNY";

function deriveReferralKey(candidate: AttributionCandidate): string {
  return candidate.linkedSalesReferralKey
    ? candidate.linkedSalesReferralKey
    : `cp-${candidate.partnerCandidateId}-${candidate.customerWorkspaceId}-${candidate.candidateId}`;
}

function partnerTypeLabel(partnerType: PartnerType): string {
  return partnerType === "referral_only"
    ? "referral-only partner"
    : "implementation partner";
}

function computeAttributedAmountCents(
  gross: number,
  basisPoints: number,
): number {
  // Integer floor — never overpay; reconciliation reviewer can revise.
  return Math.floor((gross * basisPoints) / MAX_BASIS_POINTS);
}

export function buildLockedAttributionAnchorSpec(
  input: LockedAttributionAnchorInput,
): AttributionAnchorBuildResult {
  if (input.candidate.status !== "locked") {
    return {
      ok: false,
      reasonCode: `attribution_anchor_requires_locked_status:got=${input.candidate.status}`,
    };
  }
  if (input.grant.status !== "active" && input.grant.status !== "revoked") {
    // Active grant at lock time is the normal case. We allow `revoked` because
    // a customer may revoke AFTER lock; the candidate stays locked until the
    // natural settlement window and the anchor should still be reflectable.
    return {
      ok: false,
      reasonCode: `attribution_anchor_grant_not_anchorable:got=${input.grant.status}`,
    };
  }
  if (input.candidate.grantId !== input.grant.grantId) {
    return {
      ok: false,
      reasonCode: "attribution_anchor_grant_candidate_mismatch",
    };
  }
  if (input.candidate.customerWorkspaceId !== input.grant.customerWorkspaceId) {
    return {
      ok: false,
      reasonCode: "attribution_anchor_customer_workspace_mismatch",
    };
  }
  if (input.candidate.partnerCandidateId !== input.grant.partnerCandidateId) {
    return {
      ok: false,
      reasonCode: "attribution_anchor_partner_candidate_mismatch",
    };
  }
  if (input.customerPaymentAmountCents <= 0) {
    return {
      ok: false,
      reasonCode: "attribution_anchor_non_positive_gross_amount",
    };
  }
  if (
    input.commissionRateBasisPoints < 0 ||
    input.commissionRateBasisPoints > MAX_BASIS_POINTS
  ) {
    return {
      ok: false,
      reasonCode: "attribution_anchor_invalid_basis_points",
    };
  }

  const referralKey = deriveReferralKey(input.candidate);
  const attributed = computeAttributedAmountCents(
    input.customerPaymentAmountCents,
    input.commissionRateBasisPoints,
  );
  const currency = input.currency ?? DEFAULT_CURRENCY;
  const beneficiaryLabel = input.partnerDisplayName;
  const sourceLabel = `${partnerTypeLabel(input.candidate.partnerType)}: ${beneficiaryLabel}`;
  const sourceReference = input.candidate.candidateId;

  const salesReferral: SalesReferralSpec = {
    workspaceId: input.reservedWorkspaceId,
    referralKey,
    beneficiaryLabel,
    notes: `auto-generated from AttributionCandidate ${input.candidate.candidateId}; manual-settlement reviewer must verify before any payout`,
    status: "ACTIVE",
    effectiveFrom:
      input.candidate.lockedAt ?? input.recognizedAt,
  };

  const revenueAttributionLedger: RevenueAttributionLedgerSpec = {
    workspaceId: input.reservedWorkspaceId,
    salesReferralKey: referralKey,
    sourceType: "SALES_REFERRAL",
    beneficiaryType: "SALES_REFERRAL",
    sourceLabel,
    sourceReference,
    beneficiaryLabel,
    grossAmountCents: input.customerPaymentAmountCents,
    attributedAmountCents: attributed,
    currency,
    status: "PENDING",
    recognizedAt: input.recognizedAt,
  };

  const payoutLedger: PayoutLedgerSpec = {
    workspaceId: input.reservedWorkspaceId,
    revenueAttributionLedgerLogicalRef: sourceReference,
    beneficiaryType: "SALES_REFERRAL",
    beneficiaryLabel,
    payableAmountCents: attributed,
    currency,
    status: "PENDING",
  };

  const auditActionTypes: readonly PartnerAuditActionType[] = [
    "PARTNER_ATTRIBUTION_LOCKED",
  ];

  // Silence unused — referenced for type narrowing & future fixture coverage.
  void CHANNEL_PARTNER_REASON_CODES.PARTNER_ATTRIBUTION_LEDGER_ANCHOR_REFERENCED;

  return {
    ok: true,
    spec: {
      salesReferral,
      revenueAttributionLedger,
      payoutLedger,
      auditActionTypes,
    },
  };
}
