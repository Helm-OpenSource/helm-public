import { describe, expect, it } from "vitest";
import {
  buildInternalCommercializationConnectorRecords,
} from "@/lib/internal-commercialization/fixture-connector";
import {
  assertInternalCommercializationReviewSafeAction,
} from "@/lib/internal-commercialization/contract";

describe("internal commercialization fixture connector", () => {
  it("maps offline commercialization cases into alias-only lifecycle records", () => {
    const records = buildInternalCommercializationConnectorRecords();

    expect(records).toHaveLength(8);
    expect(records.every((record) => record.helmDirectCustomerContactAllowed)).toBe(
      false,
    );
    expect(records.every((record) => record.externalSideEffectAllowed)).toBe(
      false,
    );
    expect(records.every((record) => record.officialCommitmentAllowed)).toBe(
      false,
    );
    expect(records.every((record) => record.publicClaimAllowed)).toBe(false);
    expect(records.every((record) => record.rawPiiIncluded)).toBe(false);
  });

  it("rejects outward-facing action verbs in connector output", () => {
    expect(() =>
      assertInternalCommercializationReviewSafeAction(
        "prepare_trial_scope_draft_for_review",
      ),
    ).not.toThrow();

    expect(() =>
      assertInternalCommercializationReviewSafeAction("send_trial_scope"),
    ).toThrow(/not review-safe/);
  });
});
