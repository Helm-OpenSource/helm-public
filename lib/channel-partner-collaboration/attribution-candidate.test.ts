import { describe, expect, it } from "vitest";

import { DEFAULT_COMMISSION_POLICY } from "./commission-policy";
import {
  decideAttributionLockAtTrialToPaid,
  evaluateMinActivityThreshold,
  isAttributionUniquenessViolated,
} from "./attribution-candidate";
import type { AttributionCandidate } from "./types";

const POLICY = DEFAULT_COMMISSION_POLICY;

describe("attribution candidate threshold + lock decision", () => {
  it("referral_only meets threshold with zero activity (grant_only rule)", () => {
    const r = evaluateMinActivityThreshold(
      "referral_only",
      { acceptedNudgeCount: 0, activeDaysWithAccess: 0 },
      POLICY,
    );
    expect(r.meets).toBe(true);
  });

  it("implementation requires 3 accepted nudges + 5 active days", () => {
    const under = evaluateMinActivityThreshold(
      "implementation",
      { acceptedNudgeCount: 2, activeDaysWithAccess: 6 },
      POLICY,
    );
    expect(under.meets).toBe(false);
    if (!under.meets) expect(under.reason).toBe("min_activity_threshold_not_met");

    const over = evaluateMinActivityThreshold(
      "implementation",
      { acceptedNudgeCount: 3, activeDaysWithAccess: 5 },
      POLICY,
    );
    expect(over.meets).toBe(true);
  });

  it("lock decision: referral_only with active grant + grant_only threshold → locked", () => {
    const r = decideAttributionLockAtTrialToPaid({
      partnerType: "referral_only",
      activity: { acceptedNudgeCount: 0, activeDaysWithAccess: 0 },
      policy: POLICY,
      grantStillActive: true,
      competingActiveCandidates: 1,
    });
    expect(r.decision).toBe("locked");
    if (r.decision === "locked")
      expect(r.reasonCode).toBe("partner_attribution_referral_locked");
  });

  it("lock decision: implementation below threshold → released", () => {
    const r = decideAttributionLockAtTrialToPaid({
      partnerType: "implementation",
      activity: { acceptedNudgeCount: 1, activeDaysWithAccess: 1 },
      policy: POLICY,
      grantStillActive: true,
      competingActiveCandidates: 1,
    });
    expect(r.decision).toBe("released");
    if (r.decision === "released") {
      expect(r.releasedReason).toBe("min_activity_threshold_not_met");
      expect(r.reasonCode).toBe("partner_attribution_threshold_released");
    }
  });

  it("lock decision: multiple competing candidates → downgraded to contribution", () => {
    const r = decideAttributionLockAtTrialToPaid({
      partnerType: "implementation",
      activity: { acceptedNudgeCount: 5, activeDaysWithAccess: 7 },
      policy: POLICY,
      grantStillActive: true,
      competingActiveCandidates: 2,
    });
    expect(r.decision).toBe("released");
    if (r.decision === "released")
      expect(r.releasedReason).toBe("multi_partner_downgrade_to_contribution");
  });

  it("lock decision: inactive grant at lock time → released", () => {
    const r = decideAttributionLockAtTrialToPaid({
      partnerType: "implementation",
      activity: { acceptedNudgeCount: 5, activeDaysWithAccess: 7 },
      policy: POLICY,
      grantStillActive: false,
      competingActiveCandidates: 1,
    });
    expect(r.decision).toBe("released");
    if (r.decision === "released")
      expect(r.releasedReason).toBe("customer_revoked_grant_before_lock");
  });

  it("single-active uniqueness: two locked candidates on same customer → violation", () => {
    const candidates: AttributionCandidate[] = [
      {
        candidateId: "ac-1",
        partnerCandidateId: "pc-a",
        customerWorkspaceId: "ws-1",
        grantId: "g-1",
        partnerType: "referral_only",
        status: "locked",
      },
      {
        candidateId: "ac-2",
        partnerCandidateId: "pc-b",
        customerWorkspaceId: "ws-1",
        grantId: "g-2",
        partnerType: "implementation",
        status: "locked",
      },
    ];
    expect(isAttributionUniquenessViolated(candidates)).toBe(true);
  });

  it("single-active uniqueness: one locked + others released → ok", () => {
    const candidates: AttributionCandidate[] = [
      {
        candidateId: "ac-1",
        partnerCandidateId: "pc-a",
        customerWorkspaceId: "ws-1",
        grantId: "g-1",
        partnerType: "referral_only",
        status: "locked",
      },
      {
        candidateId: "ac-2",
        partnerCandidateId: "pc-b",
        customerWorkspaceId: "ws-1",
        grantId: "g-2",
        partnerType: "implementation",
        status: "released",
      },
    ];
    expect(isAttributionUniquenessViolated(candidates)).toBe(false);
  });
});
