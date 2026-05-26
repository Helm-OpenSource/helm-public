import { describe, expect, it } from "vitest";

import { deriveRevocationCleanup } from "./revocation-cleanup";

describe("revocation cleanup (P0-REQ-09)", () => {
  it("drafted nudge → hide and withdraw", () => {
    const out = deriveRevocationCleanup({
      nudgeState: "drafted",
      attributionStatus: "pending_lock",
      hasAccruedUnsettledCommission: false,
    });
    expect(out.nudgeAction).toBe("hide_from_customer_withdraw");
    expect(out.attributionAction).toBe("release_pending_candidate");
    expect(out.accruedAction).toBe("no_accrued_to_handle");
    expect(out.portfolioAliasRemoved).toBe(true);
    expect(out.futureEffectOnly).toBe(true);
  });

  it("accepted nudge → retain in customer, partner visibility closed", () => {
    const out = deriveRevocationCleanup({
      nudgeState: "accepted_by_customer",
      attributionStatus: "locked",
      hasAccruedUnsettledCommission: true,
    });
    expect(out.nudgeAction).toBe(
      "retain_in_customer_partner_visibility_closed",
    );
    expect(out.attributionAction).toBe("retain_locked_until_natural_window");
    expect(out.accruedAction).toBe(
      "retain_until_settlement_window_manual_review",
    );
  });

  it("promoted nudge → retain in customer history with signature", () => {
    const out = deriveRevocationCleanup({
      nudgeState: "promoted_to_recommendation",
      attributionStatus: "locked",
      hasAccruedUnsettledCommission: false,
    });
    expect(out.nudgeAction).toBe("retain_in_customer_history_signature");
  });

  it("kept_as_partner_note → retain with signature", () => {
    const out = deriveRevocationCleanup({
      nudgeState: "kept_as_partner_note",
      attributionStatus: "released",
      hasAccruedUnsettledCommission: false,
    });
    expect(out.nudgeAction).toBe("retain_in_customer_history_signature");
    expect(out.attributionAction).toBe("no_active_attribution_to_handle");
  });

  it("pending_lock attribution always releases on revocation", () => {
    const out = deriveRevocationCleanup({
      nudgeState: "submitted",
      attributionStatus: "pending_lock",
      hasAccruedUnsettledCommission: false,
    });
    expect(out.attributionAction).toBe("release_pending_candidate");
  });

  it("future-effect-only flag is always true", () => {
    const states: Array<Parameters<typeof deriveRevocationCleanup>[0]["nudgeState"]> = [
      "drafted",
      "submitted",
      "accepted_by_customer",
      "customer_internal_review",
      "promoted_to_recommendation",
      "kept_as_partner_note",
      "rejected_by_customer",
      "expired",
    ];
    for (const s of states) {
      const out = deriveRevocationCleanup({
        nudgeState: s,
        attributionStatus: "locked",
        hasAccruedUnsettledCommission: false,
      });
      expect(out.futureEffectOnly).toBe(true);
    }
  });
});
