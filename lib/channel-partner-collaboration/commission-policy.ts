import type { CommissionPolicy } from "./types";

// P0-REQ-05: commission policy default. Values are configurable by Helm OPC;
// the contract just freezes shape + partnerType-aware split. OPC may revise
// concrete thresholds; consumers must read from policy, not hardcode.

export const DEFAULT_COMMISSION_POLICY: CommissionPolicy = {
  policyVersion: "channel-partner-commission-policy-p0-v2.1",
  minActivityThreshold: {
    referral_only: {
      type: "grant_only",
      minAcceptedNudgeCount: 0,
      minActiveDaysWithAccess: 0,
    },
    implementation: {
      type: "engagement_required",
      minAcceptedNudgeCount: 3,
      minActiveDaysWithAccess: 5,
    },
  },
};
