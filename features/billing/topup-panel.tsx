"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fenToYuanText, isTopupAmountFen, TOPUP_PRESET_FEN, yuanTextToFen } from "@/lib/billing/topup/topup-page";

type Order = { id: string; state: string; amountFen: string; expiresAt: string };
const STATE_TEXT: Record<string, string> = { created: "待付款", pending: "待付款", paid_verified: "已到账", closed_unpaid: "已关闭，未付款",
  unknown: "状态待核实，请稍后刷新或联系管理员" };
const ERROR_TEXT: Record<string, string> = { topup_unavailable: "充值暂不可用，请稍后再试或联系管理员。", topup_forbidden: "当前账号不能为本组织充值。",
  topup_rate_limited: "操作过于频繁，请稍后再试。", topup_billing_off: "本组织的计费账户尚未开通，暂不能充值。",
  topup_amount_out_of_range: "金额超出单笔范围。", topup_amount_not_multiple: "充值金额须为 100 元的整数倍。", payer_unresolved: "本组织尚未绑定计费账户，暂不能充值。" };
const errorText = (code: unknown) => (typeof code === "string" && ERROR_TEXT[code]) || "操作没有完成，请稍后再试。";

/**
 * Billing V1 S2-d3 top-up panel. Alipay: create the order (server signs everything), then open the cashier URL it returns. The
 * WeChat Pay slot is reserved on the same page until its slice lands. After Alipay returns here the order is shown read-only;
 * "刷新状态" asks the server to query Alipay (the only way this page can lead to a credit).
 */
export function TopupPanel({ canTopUp, alipayAvailable, suggestedFen, returnedOrderId }: { canTopUp: boolean; alipayAvailable: boolean;
  suggestedFen: number | null; returnedOrderId: string | null }) {
  const [amount, setAmount] = useState(suggestedFen === null ? "" : fenToYuanText(suggestedFen));
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);
  const attempt = useRef<{ fen: number; key: string } | null>(null); // one Idempotency-Key per amount: a resubmit replays
  const fen = yuanTextToFen(amount);
  const amountOk = isTopupAmountFen(fen);

  useEffect(() => {
    if (!returnedOrderId) return;
    void fetch(`/api/billing/v1/topup-orders/${encodeURIComponent(returnedOrderId)}`, { cache: "no-store" })
      .then(async response => { const body = await response.json(); if (response.ok) setOrder(body.order); else setMessage(errorText(body.error)); })
      .catch(() => setMessage(errorText(null)));
  }, [returnedOrderId]);

  async function payWithAlipay() {
    if (!amountOk || fen === null) return;
    if (!attempt.current || attempt.current.fen !== fen) attempt.current = { fen, key: crypto.randomUUID() };
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/billing/v1/topup-orders", { method: "POST", cache: "no-store",
        headers: { "content-type": "application/json", "idempotency-key": attempt.current.key },
        body: JSON.stringify({ provider: "alipay", amountFen: String(fen) }) });
      const body = await response.json();
      if (!response.ok || typeof body.payUrl !== "string") { setMessage(errorText(body.error)); return; }
      window.location.assign(body.payUrl);
    } catch { setMessage(errorText(null)); } finally { setBusy(false); }
  }

  async function refresh() {
    if (!order) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/billing/v1/topup-orders/${encodeURIComponent(order.id)}/verify`, { method: "POST", cache: "no-store" });
      const body = await response.json();
      if (!response.ok) { setMessage(errorText(body.error)); return; }
      setOrder(body.order);
      if (body.queryError) setMessage("暂时查不到支付结果，请稍后再刷新。");
    } catch { setMessage(errorText(null)); } finally { setBusy(false); }
  }

  return <div className="max-w-xl space-y-6">
    <header className="space-y-1">
      <h1 className="text-xl font-semibold">钱包充值</h1>
      <p className="text-sm text-muted-foreground">充值进入本组织计费账户。到账以支付宝确认为准，支付完成后回到本页点「刷新状态」即可看到。</p>
    </header>
    {order && <div className="space-y-2 rounded border p-4" data-testid="topup-order">
      <p>订单金额 {fenToYuanText(Number(order.amountFen))} 元 · {STATE_TEXT[order.state] ?? order.state}</p>
      {order.state !== "paid_verified" && <Button type="button" variant="outline" onClick={refresh} disabled={busy}>刷新状态</Button>}
    </div>}
    {!canTopUp ? <p>只有本组织的所有者或计费管理员可以充值，请联系他们。</p> : <>
      <div className="space-y-2">
        <label className="block text-sm font-medium" htmlFor="topup-amount">充值金额（元）</label>
        <div className="flex flex-wrap gap-2">{TOPUP_PRESET_FEN.map(preset => <Button key={preset} type="button" variant="outline"
          onClick={() => setAmount(fenToYuanText(preset))}>{fenToYuanText(preset).replace(/\.00$/, "")} 元</Button>)}</div>
        <Input id="topup-amount" inputMode="decimal" value={amount} onChange={event => setAmount(event.target.value)} placeholder="100 的整数倍，例如 500" />
        {amount !== "" && !amountOk && <p className="text-sm">充值金额须为 100 元的整数倍，最低 100 元。</p>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2 rounded border p-4" data-testid="topup-alipay">
          <p className="font-medium">支付宝</p>
          {alipayAvailable
            ? <Button type="button" onClick={payWithAlipay} disabled={busy || !amountOk}>{busy ? "正在创建订单…" : "去支付宝付款"}</Button>
            : <p className="text-sm">充值暂不可用，请稍后再试或联系管理员。</p>}
        </div>
        <div className="space-y-2 rounded border p-4 opacity-60" data-testid="topup-wechat" aria-disabled="true">
          <p className="font-medium">微信支付</p>
          <p className="text-sm">即将开通</p>
        </div>
      </div>
    </>}
    <p role="status">{message}</p>
  </div>;
}
