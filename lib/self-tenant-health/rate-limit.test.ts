import { describe, expect, it } from "vitest";
import {
  consumeTenantHealthViewBudget,
  resetTenantHealthRateLimitForTesting,
} from "@/lib/self-tenant-health/rate-limit";

describe("tenant health view rate limit", () => {
  it("limits repeated reserved telemetry views per minute", () => {
    resetTenantHealthRateLimitForTesting();

    expect(consumeTenantHealthViewBudget("user_a", 0, 2)).toBe(true);
    expect(consumeTenantHealthViewBudget("user_a", 10, 2)).toBe(true);
    expect(consumeTenantHealthViewBudget("user_a", 20, 2)).toBe(false);
    expect(consumeTenantHealthViewBudget("user_a", 60_000, 2)).toBe(true);
  });
});
