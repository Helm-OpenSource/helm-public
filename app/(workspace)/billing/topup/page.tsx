import { notFound } from "next/navigation";
import { canManageWorkspaceBilling } from "@/lib/auth/billing-governance";
import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import { alipayTopupGateOpen, getAlipayTopupConfig, topupAppOrigin } from "@/lib/billing/topup/alipay-topup";
import { parseSuggestedFen } from "@/lib/billing/topup/topup-page";
import { TopupPanel } from "@/features/billing/topup-panel";

export const dynamic = "force-dynamic";
export const metadata = { title: "钱包充值", robots: { index: false, follow: false }, referrer: "no-referrer" };

// Billing V1 S2-d3: wallet top-up page. The amount may be prefilled from the server-issued `suggestedFen`; the order, payer and
// every signed field are server-side (POST /api/billing/v1/topup-orders). `order` is set only on Alipay's return to this page and
// is shown read-only for the session's workspace; nothing it carries is a credit (only notify or query credit).
export default async function TopupPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (!alipayTopupGateOpen()) notFound();
  const session = await getCurrentWorkspaceSession();
  const params = await searchParams;
  const order = typeof params.order === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(params.order) ? params.order : null;
  // Read-only availability (no alert): the create route decides again and logs when it refuses.
  const available = Boolean(getAlipayTopupConfig() && topupAppOrigin());
  return <section className="p-6">
    <TopupPanel canTopUp={canManageWorkspaceBilling(session.membership.role)} alipayAvailable={available}
      suggestedFen={parseSuggestedFen(params.suggestedFen)} returnedOrderId={order} />
  </section>;
}
