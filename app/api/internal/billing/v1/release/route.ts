import { handleBillingInternalRequest } from "@/lib/billing/internal/internal-routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Billing V1 internal release (S3 protocol); signed BillingServiceGrant callers only, off unless the deployment gate is on.
export function POST(request: Request) {
  return handleBillingInternalRequest("release", request);
}
