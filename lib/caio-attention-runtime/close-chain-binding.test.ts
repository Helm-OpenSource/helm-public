import { afterEach, describe, expect, it } from "vitest";

import { CAIO_ATTENTION_PAGE_SERVICE_BOUND } from "@/features/caio-attention/service";
import type { CaioAttentionRouteRule } from "@/lib/caio-attention/contracts";
import { getRegisteredCaioAttentionScanConfig } from "@/lib/caio-attention/reminder-cron";
import { registerCaioAttentionPack, resetCaioAttentionPackForTests } from "@/lib/caio-attention/registry";
import { CAIO_ATTENTION_TEST_DEFAULT_POLICY as policy } from "@/lib/caio-attention/schedule";

import { CAIO_ATTENTION_CLOSE_CHAIN_BINDING } from "./close-chain-binding";

const rule: CaioAttentionRouteRule = {
  detectorId: "det-a", category: "business", primaryRoleKey: "lead", primaryFallbackRoleKeys: [], ccRoleKeys: [],
  escalationRoleKey: "result_owner", escalationFallbackRoleKey: "ws_owner", reviewerRoleKey: "result_owner",
  reviewerFallbackRoleKey: "ws_owner", compatibleRuleVersions: ["v1"], committedDue: "suggest",
};

afterEach(() => resetCaioAttentionPackForTests());

describe("CAIO attention close-chain binding and the single pack registration", () => {
  it("reports the page service unbound until the overlay registers the pack, then bound with every close route", () => {
    expect(CAIO_ATTENTION_PAGE_SERVICE_BOUND).toBe(true);
    expect(CAIO_ATTENTION_CLOSE_CHAIN_BINDING.pageServiceBound).toBe(false);
    expect(CAIO_ATTENTION_CLOSE_CHAIN_BINDING.lifecycleRoutes).toBe(true);
    registerCaioAttentionPack({ packId: "p", policy, rules: [rule] });
    expect(CAIO_ATTENTION_CLOSE_CHAIN_BINDING.pageServiceBound).toBe(true);
  });

  it("hands the same policy, route rules and watchdog role to the reminder scan; reset clears both", () => {
    expect(getRegisteredCaioAttentionScanConfig()).toBeNull();
    registerCaioAttentionPack({ packId: "p", policy, rules: [rule], watchdogRoleKey: "tech" });
    expect(getRegisteredCaioAttentionScanConfig()).toEqual({ policy, routeRules: [rule], watchdogRoleKey: "tech" });
    resetCaioAttentionPackForTests();
    expect(getRegisteredCaioAttentionScanConfig()).toBeNull();
  });
});
