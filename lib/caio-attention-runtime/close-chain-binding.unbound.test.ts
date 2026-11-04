import { afterEach, describe, expect, it, vi } from "vitest";

import type { CaioAttentionRouteRule } from "@/lib/caio-attention/contracts";
import { registerCaioAttentionPack, resetCaioAttentionPackForTests } from "@/lib/caio-attention/registry";
import { CAIO_ATTENTION_TEST_DEFAULT_POLICY as policy } from "@/lib/caio-attention/schedule";

import { CAIO_ATTENTION_CLOSE_CHAIN_BINDING, resolveCaioAttentionReportedCloseCapability } from "./close-chain-binding";

// A build whose pages are still on the fail-closed stub (BOUND = false).
vi.mock("@/features/caio-attention/service", () => ({ CAIO_ATTENTION_PAGE_SERVICE_BOUND: false, CAIO_ATTENTION_CLOSE_CAPABILITY_VERSION: 0 }));

const rule: CaioAttentionRouteRule = {
  detectorId: "det-a", category: "business", primaryRoleKey: "lead", primaryFallbackRoleKeys: [], ccRoleKeys: [],
  escalationRoleKey: "result_owner", escalationFallbackRoleKey: "ws_owner", reviewerRoleKey: "result_owner",
  reviewerFallbackRoleKey: "ws_owner", compatibleRuleVersions: ["v1"], committedDue: "suggest",
};

afterEach(() => resetCaioAttentionPackForTests());

describe("CAIO attention close capability on an unbound build", () => {
  it("reports 0 and no close routes even with a registered pack and a release file of 1", () => {
    registerCaioAttentionPack({ packId: "p", policy, rules: [rule] });
    expect(CAIO_ATTENTION_CLOSE_CHAIN_BINDING).toMatchObject({ pageServiceBound: false, lifecycleRoutes: false });
    expect(resolveCaioAttentionReportedCloseCapability(1)).toBe(0);
  });
});
