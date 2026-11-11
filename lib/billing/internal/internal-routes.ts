import "server-only";
import { NextResponse } from "next/server";
import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { isDeploymentCapabilityEnabled } from "@/lib/runtime/deployment-capabilities";
import { type BillingRejectCode, markUnknown, quote, release, reserve, resolveUnknown, type ServiceActor, settle }
  from "../reservations/reservations";
import { balanceStatus, BALANCE_STATUS_MAX_WORKSPACES } from "../balance/balance-status";
import { authenticateBillingService, type BillingServiceScope, ServiceAuthRefused } from "./service-auth";

/**
 * Billing V1 S3-b3 internal routes (S3 internal protocol; docs/operations/BILLING_INTERNAL_ROUTES.md). Order: deployment gate
 * (off is a plain 404), body size, service signature + scope, strict request shape, then the library entry point, whose
 * `{ ok, ... }` result is the response body. Formats are checked once, by the library (`request_invalid`).
 */
const MAX_BODY_BYTES = 16_384;
const text = z.string().max(256);
type Result = { ok: true } | { ok: false; code: BillingRejectCode };
/** Binds a strict boundary schema to its library entry point; a shape mismatch is `null` (request_invalid). */
function operation<S extends z.ZodType>(schema: S, run: (client: PrismaClient, actor: ServiceActor, req: z.infer<S>) => Promise<Result>) {
  return (client: PrismaClient, actor: ServiceActor, input: unknown) => {
    const parsed = schema.safeParse(input);
    return parsed.success ? run(client, actor, parsed.data) : null;
  };
}
const resolution = { idempotencyKey: text, reservationId: text, operationRef: text, evidenceRef: text };
const OPERATIONS = {
  quote: operation(z.object({ subjectScope: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("workspace"), workspaceId: text }).strict(), z.object({ kind: z.literal("vault"), vaultId: text }).strict()]),
  billingEventRef: text, meterUnit: text, quantity: text }).strict(), quote),
  reserve: operation(z.object({ idempotencyKey: text, operationRef: text, payerRef: text, grantId: text, priceVersionId: text,
    billingEventRef: text, meterUnit: text, quantity: text, expectedMode: z.enum(["shadow", "enforce"]).optional() }).strict(), reserve),
  settle: operation(z.object({ ...resolution, quantityUsed: text }).strict(), settle),
  release: operation(z.object({ ...resolution, reasonCode: z.enum(["not_executed", "failed", "partial_unusable"]) }).strict(), release),
  "mark-unknown": operation(z.object(resolution).strict(), markUnknown),
  "resolve-unknown": operation(z.object({ ...resolution, outcome: z.enum(["settled", "released"]), quantityUsed: text.optional() })
    .strict(), resolveUnknown),
  "balance-status": operation(z.object({ workspaceIds: z.array(text).min(1).max(BALANCE_STATUS_MAX_WORKSPACES) }).strict(), balanceStatus),
} satisfies Record<BillingServiceScope, unknown>;
export type BillingInternalOperation = keyof typeof OPERATIONS;

/** v3.7 `internal_error`: route-only (the library never returns it); the caller stays pending, alerts, backs off, never releases. */
type ProtocolCode = BillingRejectCode | "internal_error";
const STATUS: Record<ProtocolCode, number> = { internal_error: 500, request_invalid: 400, service_unauthorized: 401,
  idempotency_conflict: 409, reservation_state_conflict: 409, unknown_resolution_conflict: 409, mode_mismatch: 409,
  billing_mode_off: 422, insufficient_funds: 422, limit_exceeded: 422, grant_not_active: 422, grant_price_version_mismatch: 422,
  grant_meter_mismatch: 422, grant_charge_zero: 422, quantity_exceeds_reservation: 422, core_unavailable: 503 };
const NO_STORE = { "Cache-Control": "no-store" };
const answer = (body: object, status: number) => NextResponse.json(body, { status, headers: NO_STORE });
const rejected = (code: ProtocolCode, status = STATUS[code]) => answer({ ok: false, code }, status);
/** Structured, PII-free operator signal: operation and a fixed reason only (never ids, keys, signatures or SQL). */
function alert(event: string, operation: string, reason: string) {
  console.error("[billing-internal]", JSON.stringify({ event, operation, reason }));
}

/** Reads at most MAX_BODY_BYTES raw bytes, counting as it streams (chunked bodies too); null once the limit is passed. */
async function readBoundedBody(request: Request): Promise<Uint8Array | null> {
  if (!request.body) return new Uint8Array(0);
  const reader = request.body.getReader(), chunks: Uint8Array[] = [];
  let size = 0;
  for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
    size += chunk.value.byteLength;
    if (size > MAX_BODY_BYTES) { await reader.cancel(); return null; }
    chunks.push(chunk.value);
  }
  return Buffer.concat(chunks);
}
// Database unreachable, connection closed, pool or interactive-transaction timeout: outcome unknown, retry with the same key
// (it replays or refuses). Other driver failures (e.g. P2010 without a MySQL code) stay internal_error: equally never release.
const CONNECTION_CODES = new Set(["P1001", "P1002", "P1008", "P1017", "P2024", "P2028"]);
const connectionLost = (error: unknown) => error instanceof Prisma.PrismaClientInitializationError ||
  (error instanceof Prisma.PrismaClientKnownRequestError && CONNECTION_CODES.has(error.code));

export async function handleBillingInternalRequest(operation: BillingInternalOperation, request: Request) {
  if (!isDeploymentCapabilityEnabled("billing_internal_route")) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (!(declared <= MAX_BODY_BYTES)) return rejected("request_invalid", 413);
  const body = await readBoundedBody(request);
  if (!body) return rejected("request_invalid", 413);
  let actor;
  try {
    ({ actor } = await authenticateBillingService(db, { method: request.method, path: new URL(request.url).pathname,
      headers: request.headers, body }, operation));
  } catch (error) {
    if (!(error instanceof ServiceAuthRefused)) {
      alert("billing_internal_auth_unavailable", operation, error instanceof Error ? error.name : "unknown");
      return rejected("core_unavailable");
    }
    alert("billing_internal_auth_refused", operation, error.reason);
    return rejected("service_unauthorized", error.reason === "scope_denied" ? 403 : 401);
  }
  let input: unknown;
  // Strict UTF-8 that keeps a BOM (JSON.parse then refuses it): what was signed is exactly what is parsed.
  try { input = JSON.parse(new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(body)); } catch { return rejected("request_invalid"); }
  const pending = OPERATIONS[operation](db, actor, input);
  if (!pending) return rejected("request_invalid");
  try {
    const result = await pending;
    return result.ok ? answer(result, 200) : rejected(result.code);
  } catch (error) {
    if (connectionLost(error)) {
      alert("billing_internal_core_unavailable", operation, error instanceof Error ? error.name : "unknown");
      return rejected("core_unavailable");
    }
    // Refusals are results; anything else thrown is unmapped (it rolled back): internal_error with an operator alert.
    const breach = error instanceof Error && error.message.endsWith("_invariant_breach");
    alert(breach ? "billing_internal_invariant_breach" : "billing_internal_unexpected_error", operation,
      breach ? (error as Error).message : error instanceof Error ? error.name : "unknown");
    return rejected("internal_error");
  }
}
