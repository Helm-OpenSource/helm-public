import "server-only";
import { Prisma, type PrismaClient } from "@prisma/client";
import { FundsRefusal } from "../funds/funds-journal";
import { TopupRefusal, verifyTopupCallback, type TopupProviderAdapter } from "./topup-orders";

/** Shared by the provider-specific top-up notify entries (Alipay, WeChat Pay); only the wire format differs per provider. */
const MAX_BODY_BYTES = 16_384;

/** The raw body as strict UTF-8, or the HTTP status to refuse with: 413 over 16 KiB (declared or streamed), 400 invalid UTF-8. */
export async function readNotifyBody(request: Request): Promise<string | 400 | 413> {
  if (!(Number(request.headers.get("content-length") ?? "0") <= MAX_BODY_BYTES)) return 413;
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    if (request.body) {
      const reader = request.body.getReader();
      for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
        size += chunk.value.byteLength;
        if (size > MAX_BODY_BYTES) { await reader.cancel(); return 413; }
        chunks.push(chunk.value);
      }
    }
    return new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks));
  } catch { return 400; } // aborted stream or invalid UTF-8
}

/**
 * Providers retry anything not acknowledged. Acknowledged = the observation is durably handled (credited, replayed, state
 * recorded, or a payment exception persisted where a retry cannot help); retryable conditions are not acknowledged.
 */
export async function settleTopupNotify(client: PrismaClient, adapter: TopupProviderAdapter,
  callback: { headers: Record<string, string | null>; rawBody: string }, alert: (reason: string) => void) {
  try {
    await verifyTopupCallback(client, adapter, callback);
    return { acknowledged: true, status: 200 };
  } catch (error) {
    if (error instanceof TopupRefusal) {
      alert(error.code);
      if (error.code === "payer_billing_off") return { acknowledged: false, status: 503 }; // a later retry credits once re-enabled
      return error.exception ? { acknowledged: true, status: 200 } : { acknowledged: false, status: 400 };
    }
    const retryable = (error instanceof FundsRefusal && error.code === "funds_write_conflict") ||
      error instanceof Prisma.PrismaClientInitializationError || error instanceof Prisma.PrismaClientKnownRequestError;
    alert(error instanceof FundsRefusal ? error.code : retryable ? "database_unavailable" : "unexpected_error");
    return { acknowledged: false, status: retryable ? 503 : 500 };
  }
}
