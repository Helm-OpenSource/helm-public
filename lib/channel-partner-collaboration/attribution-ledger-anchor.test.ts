import { describe, expect, it } from "vitest";

import { buildLockedAttributionAnchorSpec } from "./attribution-ledger-anchor";
import type { AttributionCandidate, PartnerCustomerGrant } from "./types";

const GRANT: PartnerCustomerGrant = {
  grantId: "grant-1",
  partnerCandidateId: "pc-1",
  customerWorkspaceId: "ws-customer-a",
  grantedByMembershipId: "m-admin",
  scope: ["partner_safe_dto_readout", "nudge_submission"],
  status: "active",
  grantedAt: "2026-04-01T00:00:00.000Z",
};

const LOCKED: AttributionCandidate = {
  candidateId: "ac-1",
  partnerCandidateId: "pc-1",
  customerWorkspaceId: "ws-customer-a",
  grantId: "grant-1",
  partnerType: "implementation",
  status: "locked",
  lockedAt: "2026-05-01T00:00:00.000Z",
  linkedSalesReferralKey: "alias-sr-1",
};

const BASE_INPUT = {
  candidate: LOCKED,
  grant: GRANT,
  reservedWorkspaceId: "ws-helm-reserved",
  customerPaymentAmountCents: 100_000, // 1,000.00 CNY
  commissionRateBasisPoints: 2000, // 20%
  recognizedAt: "2026-05-10T00:00:00.000Z",
  partnerDisplayName: "Partner Aleph",
} as const;

describe("attribution ledger anchor spec builder (P1 contract)", () => {
  it("builds SalesReferral / RevenueAttributionLedger / PayoutLedger specs for a locked candidate", () => {
    const r = buildLockedAttributionAnchorSpec(BASE_INPUT);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.spec.salesReferral.workspaceId).toBe("ws-helm-reserved");
    expect(r.spec.salesReferral.referralKey).toBe("alias-sr-1");
    expect(r.spec.salesReferral.beneficiaryLabel).toBe("Partner Aleph");
    expect(r.spec.salesReferral.status).toBe("ACTIVE");
    expect(r.spec.salesReferral.effectiveFrom).toBe("2026-05-01T00:00:00.000Z");

    expect(r.spec.revenueAttributionLedger.salesReferralKey).toBe("alias-sr-1");
    expect(r.spec.revenueAttributionLedger.sourceType).toBe("SALES_REFERRAL");
    expect(r.spec.revenueAttributionLedger.beneficiaryType).toBe("SALES_REFERRAL");
    expect(r.spec.revenueAttributionLedger.grossAmountCents).toBe(100_000);
    expect(r.spec.revenueAttributionLedger.attributedAmountCents).toBe(20_000); // 20%
    expect(r.spec.revenueAttributionLedger.status).toBe("PENDING");
    expect(r.spec.revenueAttributionLedger.currency).toBe("CNY");

    expect(r.spec.payoutLedger.payableAmountCents).toBe(20_000);
    expect(r.spec.payoutLedger.status).toBe("PENDING");
    expect(r.spec.payoutLedger.beneficiaryType).toBe("SALES_REFERRAL");

    expect(r.spec.auditActionTypes).toEqual(["PARTNER_ATTRIBUTION_LOCKED"]);
  });

  it("derives a referral key when AttributionCandidate has no linked key", () => {
    const r = buildLockedAttributionAnchorSpec({
      ...BASE_INPUT,
      candidate: { ...LOCKED, linkedSalesReferralKey: undefined },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.spec.salesReferral.referralKey).toBe(
      `cp-${LOCKED.partnerCandidateId}-${LOCKED.customerWorkspaceId}-${LOCKED.candidateId}`,
    );
  });

  it("rejects candidate that is not yet locked", () => {
    const r = buildLockedAttributionAnchorSpec({
      ...BASE_INPUT,
      candidate: { ...LOCKED, status: "pending_lock" },
    });
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect(r.reasonCode).toMatch(/attribution_anchor_requires_locked_status/);
  });

  it("rejects mismatched grant/candidate identifiers", () => {
    const r = buildLockedAttributionAnchorSpec({
      ...BASE_INPUT,
      grant: { ...GRANT, grantId: "different-grant" },
    });
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect(r.reasonCode).toBe("attribution_anchor_grant_candidate_mismatch");
  });

  it("rejects mismatched customer workspace", () => {
    const r = buildLockedAttributionAnchorSpec({
      ...BASE_INPUT,
      grant: { ...GRANT, customerWorkspaceId: "ws-other" },
    });
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect(r.reasonCode).toBe(
        "attribution_anchor_customer_workspace_mismatch",
      );
  });

  it("allows revoked grant after lock (covers post-lock revocation)", () => {
    const r = buildLockedAttributionAnchorSpec({
      ...BASE_INPUT,
      grant: { ...GRANT, status: "revoked", revokedAt: "2026-05-02T00:00:00.000Z" },
    });
    expect(r.ok).toBe(true);
  });

  it("rejects pending grant (not yet activated)", () => {
    const r = buildLockedAttributionAnchorSpec({
      ...BASE_INPUT,
      grant: { ...GRANT, status: "pending" },
    });
    expect(r.ok).toBe(false);
  });

  it("rejects non-positive gross amount", () => {
    expect(
      buildLockedAttributionAnchorSpec({
        ...BASE_INPUT,
        customerPaymentAmountCents: 0,
      }).ok,
    ).toBe(false);
    expect(
      buildLockedAttributionAnchorSpec({
        ...BASE_INPUT,
        customerPaymentAmountCents: -1,
      }).ok,
    ).toBe(false);
  });

  it("rejects basis points out of [0, 10000]", () => {
    expect(
      buildLockedAttributionAnchorSpec({
        ...BASE_INPUT,
        commissionRateBasisPoints: -1,
      }).ok,
    ).toBe(false);
    expect(
      buildLockedAttributionAnchorSpec({
        ...BASE_INPUT,
        commissionRateBasisPoints: 10_001,
      }).ok,
    ).toBe(false);
  });

  it("0 basis points yields 0 attributed and payable (degenerate but valid)", () => {
    const r = buildLockedAttributionAnchorSpec({
      ...BASE_INPUT,
      commissionRateBasisPoints: 0,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.spec.revenueAttributionLedger.attributedAmountCents).toBe(0);
    expect(r.spec.payoutLedger.payableAmountCents).toBe(0);
  });

  it("rounds attributed amount down (no overpay)", () => {
    // 333 * 1234 / 10000 = 41.0922 → 41 cents
    const r = buildLockedAttributionAnchorSpec({
      ...BASE_INPUT,
      customerPaymentAmountCents: 333,
      commissionRateBasisPoints: 1234,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.spec.revenueAttributionLedger.attributedAmountCents).toBe(41);
  });

  it("honours custom currency override", () => {
    const r = buildLockedAttributionAnchorSpec({
      ...BASE_INPUT,
      currency: "USD",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.spec.revenueAttributionLedger.currency).toBe("USD");
    expect(r.spec.payoutLedger.currency).toBe("USD");
  });
});
