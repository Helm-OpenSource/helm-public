import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  resolveThinReadModelAdvancementCandidates,
  resolveThinReadModelAdvancementCandidatesWithFallback,
  BusinessAdvancementRuntimeNotImplementedError,
} from "@/features/business-advancement/runtime/thin-read-model-adapter";

const ORIGINAL_ENV = { ...process.env };

describe("business-advancement / thin-read-model-adapter (scaffold)", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.BUSINESS_ADVANCEMENT_RUNTIME_ENABLED;
    delete process.env.BUSINESS_ADVANCEMENT_RUNTIME_ALLOWLIST;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("returns disabled with reason flag_off when neither env is set", async () => {
    const result = await resolveThinReadModelAdvancementCandidates({
      workspaceId: "ws-1",
    });
    expect(result).toEqual({ state: "disabled", reason: "flag_off" });
  });

  it("returns disabled with reason workspace_not_in_allowlist when flag is on but workspace missing from allowlist", async () => {
    process.env.BUSINESS_ADVANCEMENT_RUNTIME_ENABLED = "true";
    process.env.BUSINESS_ADVANCEMENT_RUNTIME_ALLOWLIST = "ws-other";
    const result = await resolveThinReadModelAdvancementCandidates({
      workspaceId: "ws-1",
    });
    expect(result).toEqual({
      state: "disabled",
      reason: "workspace_not_in_allowlist",
    });
  });

  it("throws BusinessAdvancementRuntimeNotImplementedError when fully gated on (scaffold)", async () => {
    process.env.BUSINESS_ADVANCEMENT_RUNTIME_ENABLED = "true";
    process.env.BUSINESS_ADVANCEMENT_RUNTIME_ALLOWLIST = "ws-1";
    await expect(
      resolveThinReadModelAdvancementCandidates({ workspaceId: "ws-1" }),
    ).rejects.toBeInstanceOf(BusinessAdvancementRuntimeNotImplementedError);
  });

  it("fallback helper returns null for both disabled and not-implemented states", async () => {
    // disabled
    expect(
      await resolveThinReadModelAdvancementCandidatesWithFallback({
        workspaceId: "ws-1",
      }),
    ).toBeNull();
    // gated on, scaffold throws → fallback returns null
    process.env.BUSINESS_ADVANCEMENT_RUNTIME_ENABLED = "true";
    process.env.BUSINESS_ADVANCEMENT_RUNTIME_ALLOWLIST = "ws-1";
    expect(
      await resolveThinReadModelAdvancementCandidatesWithFallback({
        workspaceId: "ws-1",
      }),
    ).toBeNull();
  });
});
