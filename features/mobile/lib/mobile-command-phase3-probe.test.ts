import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * Probe-level test for the Phase 3 runtime adoption wiring at /mobile.
 *
 * The probe is wired in `getMobileCommandReadModel` (mobile-command-read-model.ts)
 * via `resolveThinReadModelAdvancementCandidatesWithFallback`. This test
 * does not exercise the full read-model (which needs DB) — it validates
 * that the adapter helper itself behaves correctly under the gating
 * configuration the probe relies on, and that an invariant violation is
 * propagated up so oncall can react.
 */
import {
  resolveThinReadModelAdvancementCandidatesWithFallback,
  BusinessAdvancementRuntimeNotImplementedError,
} from "@/features/business-advancement/runtime/thin-read-model-adapter";
import {
  BusinessAdvancementInvariantViolationError,
  assertSingleWorkspaceScope,
} from "@/lib/business-advancement/invariant-guards";

const ORIGINAL_ENV = { ...process.env };

describe("/mobile Phase 3 runtime probe contract", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.BUSINESS_ADVANCEMENT_RUNTIME_ENABLED;
    delete process.env.BUSINESS_ADVANCEMENT_RUNTIME_ALLOWLIST;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("returns null when the gate is fully off (default)", async () => {
    const result = await resolveThinReadModelAdvancementCandidatesWithFallback({
      workspaceId: "ws-mobile-1",
    });
    expect(result).toBeNull();
  });

  it("returns null when the workspace is not in the allowlist", async () => {
    process.env.BUSINESS_ADVANCEMENT_RUNTIME_ENABLED = "true";
    process.env.BUSINESS_ADVANCEMENT_RUNTIME_ALLOWLIST = "ws-other";
    const result = await resolveThinReadModelAdvancementCandidatesWithFallback({
      workspaceId: "ws-mobile-1",
    });
    expect(result).toBeNull();
  });

  it("returns null when the gate is fully on but the implementation is still a scaffold", async () => {
    process.env.BUSINESS_ADVANCEMENT_RUNTIME_ENABLED = "true";
    process.env.BUSINESS_ADVANCEMENT_RUNTIME_ALLOWLIST = "ws-mobile-1";
    const result = await resolveThinReadModelAdvancementCandidatesWithFallback({
      workspaceId: "ws-mobile-1",
    });
    expect(result).toBeNull();
  });

  it("propagates BusinessAdvancementInvariantViolationError instead of swallowing it", () => {
    expect(() =>
      assertSingleWorkspaceScope({
        requestedWorkspaceId: "ws-mobile-1",
        observedWorkspaceIds: ["ws-mobile-1", "ws-other"],
      }),
    ).toThrowError(BusinessAdvancementInvariantViolationError);
  });

  it("BusinessAdvancementRuntimeNotImplementedError remains a distinct error class", () => {
    const err = new BusinessAdvancementRuntimeNotImplementedError();
    expect(err.name).toBe("BusinessAdvancementRuntimeNotImplementedError");
    expect(err).toBeInstanceOf(Error);
  });
});
