import { describe, expect, it, vi } from "vitest";
import { BusinessAdvancementInvariantViolationError } from "@/lib/business-advancement/invariant-guards";
import { safeLoadMobileSource } from "./mobile-command-read-model";

describe("safeLoadMobileSource — mobile-command-read-model fail-open contract", () => {
  it("returns the loader result when it succeeds", async () => {
    await expect(
      safeLoadMobileSource("overdue_commitment", async () => [1, 2, 3]),
    ).resolves.toEqual([1, 2, 3]);
  });

  it("returns an empty list when the loader throws a generic error so other sources are not lost", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      await expect(
        safeLoadMobileSource("stalled_opportunity", async () => {
          throw new Error("Unknown column 'opportunity.priorityScore' in 'order clause'");
        }),
      ).resolves.toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("propagates BusinessAdvancementInvariantViolationError so oncall still sees the alarm", async () => {
    await expect(
      safeLoadMobileSource("proof_or_review_required", async () => {
        throw new BusinessAdvancementInvariantViolationError({
          invariant: "business_advancement_candidate_requires_object_ref",
          message: "phase3 invariant: candidate without object_ref",
          auditPayload: { source: "proof_or_review_required" },
        });
      }),
    ).rejects.toBeInstanceOf(BusinessAdvancementInvariantViolationError);
  });
});
