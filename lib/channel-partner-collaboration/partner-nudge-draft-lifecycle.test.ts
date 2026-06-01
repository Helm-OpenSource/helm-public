import { describe, expect, it } from "vitest";

import type { PartnerCustomerGrant } from "./types";
import {
  PARTNER_NUDGE_INTERNAL_REVIEW_TIMEOUT_DAYS,
  PARTNER_NUDGE_SUBMITTED_EXPIRY_DAYS,
  isAuthorizedCustomerDecisionMaker,
  isInternalReviewTimedOut,
  isResubmitAllowed,
  isSubmittedExpired,
  transitionPartnerNudgeDraft,
} from "./partner-nudge-draft-lifecycle";

const ACTIVE_GRANT: PartnerCustomerGrant = {
  grantId: "grant-1",
  partnerCandidateId: "pc-1",
  customerWorkspaceId: "ws-1",
  grantedByMembershipId: "m-admin",
  scope: ["partner_safe_dto_readout", "nudge_submission"],
  status: "active",
  grantedAt: "2026-05-01T00:00:00.000Z",
};

describe("partner nudge draft lifecycle", () => {
  it("allows submit only by partner with active grant from drafted", () => {
    const ok = transitionPartnerNudgeDraft("drafted", "submit", {
      actor: { kind: "partner", partnerCandidateId: "pc-1" },
      grant: ACTIVE_GRANT,
    });
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.nextState).toBe("submitted");
      expect(ok.auditActionType).toBe("PARTNER_NUDGE_DRAFT_SUBMITTED");
    }
  });

  it("rejects submit when grant is missing", () => {
    const result = transitionPartnerNudgeDraft("drafted", "submit", {
      actor: { kind: "partner", partnerCandidateId: "pc-1" },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reasonCode).toBe("partner_grant_required");
  });

  it("rejects accept by non-authorized customer member", () => {
    const result = transitionPartnerNudgeDraft("submitted", "accept", {
      actor: {
        kind: "customer",
        membershipId: "m-x",
        customerActorKind: "OTHER_MEMBER",
      },
      grant: ACTIVE_GRANT,
    });
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.reasonCode).toBe("partner_nudge_acceptance_unauthorized");
  });

  it("ADMIN / OPERATOR / CUSTOMER_CHAMPION can accept", () => {
    for (const kind of ["ADMIN", "OPERATOR", "CUSTOMER_CHAMPION"] as const) {
      const result = transitionPartnerNudgeDraft("submitted", "accept", {
        actor: { kind: "customer", membershipId: "m", customerActorKind: kind },
        grant: ACTIVE_GRANT,
      });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.nextState).toBe("accepted_by_customer");
    }
  });

  it("system enters customer_internal_review after customer acceptance", () => {
    const result = transitionPartnerNudgeDraft(
      "accepted_by_customer",
      "enter_internal_review",
      { actor: { kind: "system" }, grant: ACTIVE_GRANT },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.nextState).toBe("customer_internal_review");
      expect(result.auditActionType).toBe(
        "PARTNER_NUDGE_DRAFT_INTERNAL_REVIEW_ENTERED",
      );
    }
  });

  it("OTHER_MEMBER is not an authorized decision maker", () => {
    expect(isAuthorizedCustomerDecisionMaker("OTHER_MEMBER")).toBe(false);
    expect(isAuthorizedCustomerDecisionMaker("ADMIN")).toBe(true);
  });

  it("promotes from customer_internal_review to promoted_to_recommendation", () => {
    const result = transitionPartnerNudgeDraft(
      "customer_internal_review",
      "promote",
      {
        actor: { kind: "customer", membershipId: "m", customerActorKind: "ADMIN" },
        grant: ACTIVE_GRANT,
      },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.nextState).toBe("promoted_to_recommendation");
      expect(result.auditActionType).toBe("PARTNER_NUDGE_DRAFT_PROMOTED");
    }
  });

  it("keep_as_note from customer_internal_review", () => {
    const result = transitionPartnerNudgeDraft(
      "customer_internal_review",
      "keep_as_note",
      {
        actor: {
          kind: "customer",
          membershipId: "m",
          customerActorKind: "OPERATOR",
        },
        grant: ACTIVE_GRANT,
      },
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.nextState).toBe("kept_as_partner_note");
  });

  it("system timeout from customer_internal_review yields kept_as_partner_note", () => {
    const result = transitionPartnerNudgeDraft(
      "customer_internal_review",
      "timeout_to_note",
      { actor: { kind: "system" } },
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.nextState).toBe("kept_as_partner_note");
  });

  it("revocation_hide moves drafted/submitted → withdrawn_by_partner_revocation", () => {
    const result = transitionPartnerNudgeDraft("submitted", "revocation_hide", {
      actor: { kind: "system" },
    });
    expect(result.ok).toBe(true);
    if (result.ok)
      expect(result.nextState).toBe("withdrawn_by_partner_revocation");
  });

  it("partner cannot withdraw after acceptance", () => {
    const result = transitionPartnerNudgeDraft(
      "customer_internal_review",
      "withdraw",
      { actor: { kind: "partner", partnerCandidateId: "pc-1" } },
    );
    expect(result.ok).toBe(false);
  });

  it("internal review timeout is 14 days", () => {
    expect(PARTNER_NUDGE_INTERNAL_REVIEW_TIMEOUT_DAYS).toBe(14);
    expect(
      isInternalReviewTimedOut({
        enteredInternalReviewAt: "2026-05-01T00:00:00.000Z",
        asOf: "2026-05-15T00:00:00.000Z",
      }),
    ).toBe(true);
    expect(
      isInternalReviewTimedOut({
        enteredInternalReviewAt: "2026-05-01T00:00:00.000Z",
        asOf: "2026-05-10T00:00:00.000Z",
      }),
    ).toBe(false);
  });

  it("submitted expiry is 30 days", () => {
    expect(PARTNER_NUDGE_SUBMITTED_EXPIRY_DAYS).toBe(30);
    expect(
      isSubmittedExpired({
        submittedAt: "2026-04-01T00:00:00.000Z",
        asOf: "2026-05-15T00:00:00.000Z",
      }),
    ).toBe(true);
    expect(
      isSubmittedExpired({
        submittedAt: "2026-05-01T00:00:00.000Z",
        asOf: "2026-05-15T00:00:00.000Z",
      }),
    ).toBe(false);
  });

  it("resubmit rate-limit fires when same-week submission already exists", () => {
    expect(
      isResubmitAllowed({
        previousState: "expired",
        submittedNudgeCountInWeek: 1,
      }),
    ).toEqual({ ok: false, reasonCode: "partner_nudge_resubmit_rate_limited" });
    expect(
      isResubmitAllowed({
        previousState: "expired",
        submittedNudgeCountInWeek: 0,
      }).ok,
    ).toBe(true);
  });

  it("resubmit only valid from expired / rejected_by_customer", () => {
    expect(
      isResubmitAllowed({
        previousState: "promoted_to_recommendation",
        submittedNudgeCountInWeek: 0,
      }).ok,
    ).toBe(false);
  });
});
