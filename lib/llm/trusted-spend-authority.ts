/** Signed metadata verification only. Protected issuer provisioning and provider
 * usage authentication are separate requirements; references are not authority. */
import { createHash, createPublicKey, verify } from "node:crypto";

const MAX = BigInt("9223372036854775807");
export type AuthorityKind = "period" | "price" | "fx" | "budget";
export type AuthorityEnvelope = {
  schema: "helm.spend-authority/v1"; workspaceId: string; ref: string;
  kind: AuthorityKind; version: string; issuerGrantId: string; approverId: string;
  status: "approved"; sourceReceiptHash: string; issuedAt: string; validFrom: string; validUntil: string;
  payload: Record<string, unknown>;
};
export class SpendAuthorityRefused extends Error {
  constructor(reason: string) { super(`spend_authority_${reason}`); }
}
export function refuse(reason: string): never { throw new SpendAuthorityRefused(reason); }
export function exactObject(value: unknown, fields: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      Object.keys(value).sort().join("|") !== [...fields].sort().join("|")) refuse("shape_invalid");
  return value as Record<string, unknown>;
}
export function authorityRef(value: unknown): string {
  if (typeof value !== "string" || !/^[a-z][a-z0-9:._-]{0,190}$/u.test(value)) refuse("ref_invalid");
  return value;
}
export function authorityDate(value: unknown): Date {
  if (typeof value !== "string") refuse("time_invalid");
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== value) refuse("time_invalid");
  return date;
}
function natural(value: unknown, allowZero = true): bigint {
  if (typeof value !== "string" || !/^(0|[1-9][0-9]{0,18})$/u.test(value)) refuse("integer_invalid");
  const n = BigInt(value);
  if (n > MAX || (!allowZero && n === BigInt(0))) refuse("integer_invalid");
  return n;
}
export function canonicalAuthorityJson(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") { if (!Number.isSafeInteger(value)) refuse("json_number_invalid"); return String(value); }
  if (Array.isArray(value)) return `[${value.map(canonicalAuthorityJson).join(",")}]`;
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonicalAuthorityJson((value as Record<string, unknown>)[k])}`).join(",")}}`;
  }
  return refuse("json_invalid");
}
export function authorityHash(value: unknown): string {
  return `sha256:${createHash("sha256").update(canonicalAuthorityJson(value)).digest("hex")}`;
}
export function readSignedAuthority(json: string, signature: string, publicKey: string): AuthorityEnvelope {
  if (json.length > 32_768 || signature.length > 128) refuse("record_size_invalid");
  let parsed: unknown; try { parsed = JSON.parse(json); } catch { return refuse("json_invalid"); }
  if (canonicalAuthorityJson(parsed) !== json) refuse("json_not_canonical");
  const row = exactObject(parsed, ["schema", "workspaceId", "ref", "kind", "version", "issuerGrantId", "approverId", "status", "sourceReceiptHash", "issuedAt", "validFrom", "validUntil", "payload"]);
  if (typeof row.sourceReceiptHash !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(row.sourceReceiptHash)) refuse("source_receipt_invalid");
  if (row.schema !== "helm.spend-authority/v1" || row.status !== "approved" ||
      !["period", "price", "fx", "budget"].includes(String(row.kind))) refuse("purpose_invalid");
  for (const field of ["workspaceId", "ref", "version", "issuerGrantId", "approverId"]) authorityRef(row[field]);
  const issued = authorityDate(row.issuedAt), start = authorityDate(row.validFrom), end = authorityDate(row.validUntil);
  if (issued > start || start >= end) refuse("time_invalid");
  if (!row.payload || typeof row.payload !== "object" || Array.isArray(row.payload)) refuse("payload_invalid");
  const key = createPublicKey(publicKey);
  const bytes = Buffer.from(signature, "base64");
  if (key.asymmetricKeyType !== "ed25519" || bytes.length !== 64 || bytes.toString("base64") !== signature ||
      !verify(null, Buffer.from(json), key, bytes)) refuse("signature_invalid");
  return row as AuthorityEnvelope;
}
export function monthAt(now: Date, timezone: string): string {
  if (!Number.isFinite(now.getTime()) || typeof timezone !== "string" || timezone.length > 64) refuse("period_invalid");
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit" });
  const parts = formatter.formatToParts(now);
  return `${parts.find((p) => p.type === "year")!.value}-${parts.find((p) => p.type === "month")!.value}`;
}
function ceil(n: bigint, d: bigint): bigint { return (n + d - BigInt(1)) / d; }
export function computeMaximumCharge(priceValue: unknown, fxValue: unknown, input: bigint, output: bigint): bigint {
  const price = exactObject(priceValue, ["billing", "provider", "model", "sku", "currency", "input", "output"]);
  if (price.billing !== "input-output-only-v1" || !["USD", "CNY"].includes(String(price.currency))) refuse("billing_unbounded");
  for (const k of ["provider", "model", "sku"]) authorityRef(price[k]);
  const charge = (value: unknown, units: bigint) => {
    const rate = exactObject(value, ["numerator", "denominator", "ceiling"]);
    const maxUnits = natural(rate.ceiling), numerator = natural(rate.numerator), denominator = natural(rate.denominator, false);
    if (typeof units !== "bigint" || units < BigInt(0) || units > maxUnits) refuse("usage_bound_invalid");
    return ceil(units * numerator, denominator);
  };
  let total = charge(price.input, input) + charge(price.output, output);
  if (price.currency === "USD") { if (fxValue !== null) refuse("fx_unexpected"); }
  else {
    const fx = exactObject(fxValue, ["from", "to", "numerator", "denominator"]);
    if (fx.from !== "CNY" || fx.to !== "USD") refuse("fx_direction_invalid");
    total = ceil(total * natural(fx.numerator, false), natural(fx.denominator, false));
  }
  if (total > MAX) refuse("maximum_out_of_range");
  return total;
}
