import { handleBillingInternalRequest } from "@/lib/billing/internal/internal-routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Billing V1 internal resolve-unknown (S3 protocol); reconciliation-channel grants only, off unless the gate is on.
export function POST(request: Request) {
  return handleBillingInternalRequest("resolve-unknown", request);
}
