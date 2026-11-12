import { handleBillingInternalRequest } from "@/lib/billing/internal/internal-routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Billing V1 internal balance-status (S3 protocol v3.10, read-only); signed BillingServiceGrant callers only, off unless the gate is on.
export function POST(request: Request) {
  return handleBillingInternalRequest("balance-status", request);
}
