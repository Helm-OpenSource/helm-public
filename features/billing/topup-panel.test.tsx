// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { TopupPanel } from "./topup-panel";

let root: Root | null = null, container: HTMLElement | null = null;
async function render(props: Partial<Parameters<typeof TopupPanel>[0]> = {}) {
  container = document.createElement("div"); document.body.append(container);
  root = createRoot(container);
  await act(async () => root!.render(<TopupPanel canTopUp alipayAvailable suggestedFen={null} returnedOrderId={null} {...props} />));
  return container;
}
afterEach(async () => { await act(async () => root?.unmount()); container?.remove(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
const json = (body: object, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const click = async (element: Element | null) => { await act(async () => { (element as HTMLElement).click(); }); await act(async () => new Promise(r => setTimeout(r, 0))); };
const button = (root: HTMLElement, text: string) => [...root.querySelectorAll("button")].find(b => b.textContent?.includes(text)) ?? null;

it("prefills the server-suggested amount and creates an Alipay order with only provider and fen, then opens the cashier URL", async () => {
  const fetchMock = vi.fn(async () => json({ order: { id: "o1" }, payUrl: "https://gateway.alipay.invalid/gateway.do?x=1" }, 201));
  vi.stubGlobal("fetch", fetchMock);
  const assign = vi.fn();
  vi.spyOn(window, "location", "get").mockReturnValue({ ...window.location, assign } as Location);
  const view = await render({ suggestedFen: 20_000 });
  expect((view.querySelector("#topup-amount") as HTMLInputElement).value).toBe("200.00"); // shortfall rounded up by the server helper
  await click(button(view, "去支付宝付款"));
  await click(button(view, "去支付宝付款"));
  const calls = fetchMock.mock.calls as unknown as Array<[string, RequestInit]>;
  expect(calls[0][0]).toBe("/api/billing/v1/topup-orders");
  expect(JSON.parse(String(calls[0][1].body))).toEqual({ provider: "alipay", amountFen: "20000" });
  const keys = calls.map(call => (call[1].headers as Record<string, string>)["idempotency-key"]);
  expect(keys[0]).toMatch(/^[0-9a-f-]{36}$/);
  expect(keys[1]).toBe(keys[0]); // the same amount resubmitted replays the same order
  expect(assign).toHaveBeenCalledWith("https://gateway.alipay.invalid/gateway.do?x=1");
});

it("reserves a disabled WeChat Pay slot, shows unavailable top-up, and hides the form from non-billing roles", async () => {
  const view = await render({ alipayAvailable: false });
  expect(view.querySelector('[data-testid="topup-wechat"]')?.getAttribute("aria-disabled")).toBe("true");
  expect(view.querySelector('[data-testid="topup-alipay"]')?.textContent).toContain("充值暂不可用");
  expect(button(view, "去支付宝付款")).toBeNull();
  await act(async () => root!.unmount()); container!.remove(); root = null;
  const member = await render({ canTopUp: false });
  expect(member.textContent).toContain("只有本组织的所有者或计费管理员可以充值");
  expect(member.querySelector("#topup-amount")).toBeNull();
});

it("shows the returned order read-only and refreshes it through the server query", async () => {
  const fetchMock = vi.fn(async (url: string) => url.endsWith("/verify")
    ? json({ order: { id: "o1", state: "paid_verified", amountFen: "50000", expiresAt: "" }, queried: true, queryError: null })
    : json({ order: { id: "o1", state: "pending", amountFen: "50000", expiresAt: "" } }));
  vi.stubGlobal("fetch", fetchMock);
  const view = await render({ returnedOrderId: "o1" });
  await act(async () => new Promise(r => setTimeout(r, 0)));
  expect(view.querySelector('[data-testid="topup-order"]')?.textContent).toContain("500.00 元 · 待付款");
  await click(button(view, "刷新状态"));
  expect(fetchMock).toHaveBeenLastCalledWith("/api/billing/v1/topup-orders/o1/verify", expect.objectContaining({ method: "POST" }));
  expect(view.querySelector('[data-testid="topup-order"]')?.textContent).toContain("已到账");
  expect(button(view, "刷新状态")).toBeNull();
});

it("accepts only whole multiples of 100 yuan before asking the server", async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  const view = await render();
  const input = view.querySelector("#topup-amount") as HTMLInputElement;
  for (const [text, ok] of [["150", false], ["99", false], ["100.50", false], ["300", true], ["1000000", true]] as const) {
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, text);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect((button(view, "去支付宝付款") as HTMLButtonElement).disabled).toBe(!ok);
    expect(view.textContent?.includes("充值金额须为 100 元的整数倍")).toBe(!ok);
  }
  expect(fetchMock).not.toHaveBeenCalled();
});

it("starts a new order after the key replayed one that can no longer be paid (#550 review P3-3)", async () => {
  const fetchMock = vi.fn(async () => json({ order: { id: "o1" }, replayed: true, payUrl: null }));
  vi.stubGlobal("fetch", fetchMock);
  const view = await render({ suggestedFen: 10_000 });
  await click(button(view, "去支付宝付款"));
  expect(view.querySelector('[role="status"]')?.textContent).toContain("请再点一次以新建订单");
  await click(button(view, "去支付宝付款"));
  const keys = (fetchMock.mock.calls as unknown as Array<[string, RequestInit]>).map(call => (call[1].headers as Record<string, string>)["idempotency-key"]);
  expect(keys[1]).not.toBe(keys[0]);
});

it("maps refusals to fixed text and never navigates", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => json({ error: "topup_unavailable" }, 503)));
  const view = await render({ suggestedFen: 10_000 });
  await click(button(view, "去支付宝付款"));
  expect(view.querySelector('[role="status"]')?.textContent).toBe("充值暂不可用，请稍后再试或联系管理员。");
});
