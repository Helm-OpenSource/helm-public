import { afterEach, describe, expect, it, vi } from "vitest";

import { serverBootstrapBinding } from "@/lib/runtime/server-bootstrap-binding";

// Instrumentation-level check: the heartbeat must receive the runtime close-chain binding as its resolver, not
// just have the binding module imported somewhere in the file.
const binding = vi.hoisted(() => ({ value: false }));
const startHeartbeat = vi.hoisted(() => vi.fn(async () => () => undefined));
const db = vi.hoisted(() => ({ tag: "db" }));

vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/lib/caio-attention/heartbeat.service", () => ({ startCaioAttentionHeartbeat: startHeartbeat }));
vi.mock("@/lib/caio-attention-runtime/close-chain-binding", () => ({
  CAIO_ATTENTION_CLOSE_CHAIN_BINDING: { get pageServiceBound() { return binding.value; }, lifecycleRoutes: true },
}));
vi.mock("@/lib/reports/engineering-delivery-review-cron", () => ({ startEngineeringDeliveryReviewCron: vi.fn() }));
vi.mock("@/lib/task-follow-through/light-chain-follow-through-cron", () => ({ startLightChainFollowThroughCron: vi.fn() }));
vi.mock("@/lib/caio-attention/reminder-cron", () => ({ startCaioAttentionReminderCron: vi.fn() }));
vi.mock("@/lib/llm/spend-tracker", () => ({ setDBDerivedSpendProvider: vi.fn() }));
vi.mock("@/lib/llm/spend-budget-db-derivation", () => ({ deriveMonthToDateSpendUSDFromCallLog: vi.fn() }));

afterEach(() => {
  globalThis.__helmServerBootstrapAdmission = undefined;
  startHeartbeat.mockClear();
  binding.value = false;
});

describe("node instrumentation starts the CAIO attention heartbeat with the runtime close-chain binding", () => {
  it("passes a resolver that reads CAIO_ATTENTION_CLOSE_CHAIN_BINDING.pageServiceBound on every call", async () => {
    globalThis.__helmServerBootstrapAdmission = Object.freeze({
      policy: JSON.stringify(serverBootstrapBinding),
      initialize: async () => ({ mode: "disabled" as const, status: "disabled" as const }),
    });
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    const { registerNodeInstrumentation } = await import("./node-instrumentation");
    await registerNodeInstrumentation();
    expect(startHeartbeat).toHaveBeenCalledTimes(1);
    const [client, , closeChainBound] = startHeartbeat.mock.calls[0] as unknown as [unknown, unknown, (() => boolean) | undefined];
    expect(client).toBe(db);
    expect(typeof closeChainBound).toBe("function");
    expect(closeChainBound!()).toBe(false);
    binding.value = true;
    expect(closeChainBound!()).toBe(true);
  });
});
