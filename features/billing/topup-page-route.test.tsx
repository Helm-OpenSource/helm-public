import { isValidElement, type ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

// The server page only decides gate, role, availability, prefill and which returned order to show; the panel does the rest.
const state = vi.hoisted(() => ({ role: "OWNER", gate: true, config: true as boolean }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NEXT_NOT_FOUND"); } }));
vi.mock("@/lib/auth/session", () => ({ getCurrentWorkspaceSession: async () => ({ membership: { role: state.role } }) }));
vi.mock("@/lib/billing/topup/alipay-topup", () => ({ alipayTopupGateOpen: () => state.gate,
  getAlipayTopupConfig: () => (state.config ? {} : null), topupAppOrigin: () => "https://helm.example.invalid" }));
vi.mock("@/features/billing/topup-panel", () => ({ TopupPanel: () => null }));
import TopupPage from "@/app/(workspace)/billing/topup/page";

type PanelProps = { canTopUp: boolean; alipayAvailable: boolean; suggestedFen: number | null; returnedOrderId: string | null };
async function panelProps(params: Record<string, string | string[]> = {}) {
  const page = await TopupPage({ searchParams: Promise.resolve(params) }) as ReactElement<{ children: ReactElement<PanelProps> }>;
  const panel = page.props.children;
  expect(isValidElement(panel)).toBe(true);
  return panel.props;
}
afterEach(() => { Object.assign(state, { role: "OWNER", gate: true, config: true }); });

describe("top-up page", () => {
  it("is not found while the gates are off", async () => {
    state.gate = false;
    await expect(TopupPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("offers the form only to OWNER and BILLING_ADMIN", async () => {
    for (const [role, can] of [["OWNER", true], ["BILLING_ADMIN", true], ["ADMIN", false], ["MEMBER", false]] as const) {
      state.role = role;
      expect((await panelProps()).canTopUp).toBe(can);
    }
  });

  it("marks Alipay unavailable on incomplete configuration, rounds the prefill up and only passes a well-formed order id", async () => {
    state.config = false;
    expect(await panelProps({ suggestedFen: "12345", order: "ord_1-x" })).toEqual({ canTopUp: true, alipayAvailable: false,
      suggestedFen: 20_000, returnedOrderId: "ord_1-x" });
    for (const order of ["../x", "a b", "x".repeat(65)]) expect((await panelProps({ order })).returnedOrderId).toBeNull();
    expect((await panelProps({ order: ["a", "b"] })).returnedOrderId).toBeNull();
  });
});
