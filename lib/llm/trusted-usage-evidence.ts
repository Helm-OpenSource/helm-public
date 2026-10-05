/** Metadata-only attestation, not a provider signature or production grant. */
import { createHash, createPublicKey, verify } from "node:crypto";
import { authorityDate, authorityHash, authorityRef, canonicalAuthorityJson, exactObject, refuse } from "./trusted-spend-authority";
export const USAGE_SCHEMA = "helm.trusted-usage/v1" as const;
export const USAGE_SOURCE = "helm.controlled-http-usage/v1" as const;
export function bytesHash(bytes: Uint8Array): string { return `sha256:${createHash("sha256").update(bytes).digest("hex")}`; }
export function hash(value: unknown): string {
  if (typeof value !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(value)) refuse("usage_hash_invalid");
  return value;
}
export function units(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || value > 2_147_483_647) refuse("usage_units_invalid");
  return value;
}
/** This protocol explicitly requires canonical JSON. No duplicate key, unknown
 * category or ignored token class can become an input/output-only invoice. */
export function boundedCanonical(bytes: Uint8Array, maximum = 65_536): unknown {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0 || bytes.byteLength > maximum) refuse("usage_size_invalid");
  let text: string, value: unknown;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(bytes)); value = JSON.parse(text); }
  catch { return refuse("usage_json_invalid"); }
  const depth = (v: unknown, n: number): void => {
    if (n > 12) refuse("usage_depth_invalid");
    if (v && typeof v === "object") for (const child of Object.values(v)) depth(child, n + 1);
  };
  depth(value, 0);
  if (canonicalAuthorityJson(value) !== text) refuse("usage_json_not_canonical");
  return value;
}
export type UsageGrant = {
  schema: "helm.usage-attestor-grant/v1"; id: string; workspaceId: string; source: typeof USAGE_SOURCE;
  sourceHash: string; adapterKey: string; registrationHash: string; provider: string; model: string;
  modelVersion: string; sku: string; endpointFingerprint: string; publicKeyPem: string;
  validFrom: string; validUntil: string;
};
export function readUsageGrant(json: string): UsageGrant {
  const g = exactObject(boundedCanonical(Buffer.from(json), 16_384), ["schema", "id", "workspaceId", "source", "sourceHash", "adapterKey", "registrationHash", "provider", "model", "modelVersion", "sku", "endpointFingerprint", "publicKeyPem", "validFrom", "validUntil"]);
  if (g.schema !== "helm.usage-attestor-grant/v1" || g.source !== USAGE_SOURCE) refuse("usage_purpose_invalid");
  for (const k of ["id", "workspaceId", "adapterKey", "provider", "model", "modelVersion", "sku"]) authorityRef(g[k]);
  for (const k of ["sourceHash", "registrationHash", "endpointFingerprint"]) hash(g[k]);
  if (typeof g.publicKeyPem !== "string" || g.publicKeyPem.length > 2_048 || createPublicKey(g.publicKeyPem).asymmetricKeyType !== "ed25519" || authorityDate(g.validFrom) >= authorityDate(g.validUntil)) refuse("usage_grant_invalid");
  return g as UsageGrant;
}
export type UsageEvidence = {
  schema: typeof USAGE_SCHEMA; workspaceId: string; decisionId: string; providerIdempotencyKey: string;
  claimHash: string; runtimeHash: string; routeRef: string; grantId: string; grantHash: string;
  pricingVersion: string; priceRef: string; priceHash: string; fxRef: string | null; fxHash: string | null;
  quoteHash: string; requestDigest: string; responseDigest: string; providerRequestRefHash: string;
  outputContentHash: string; promptTokens: number; completionTokens: number; capturedAt: string;
  requestDisposition: "accepted"; outcome: "success";
};
const EVIDENCE_FIELDS = ["schema", "workspaceId", "decisionId", "providerIdempotencyKey", "claimHash", "runtimeHash", "routeRef", "grantId", "grantHash", "pricingVersion", "priceRef", "priceHash", "fxRef", "fxHash", "quoteHash", "requestDigest", "responseDigest", "providerRequestRefHash", "outputContentHash", "promptTokens", "completionTokens", "capturedAt", "requestDisposition", "outcome"] as const;
export function readUsageEvidence(json: string, signature: string, grant: UsageGrant): UsageEvidence {
  const e = exactObject(boundedCanonical(Buffer.from(json), 16_384), EVIDENCE_FIELDS);
  if (e.schema !== USAGE_SCHEMA || e.requestDisposition !== "accepted" || e.outcome !== "success") refuse("usage_disposition_invalid");
  for (const k of ["workspaceId", "decisionId", "providerIdempotencyKey", "routeRef", "grantId", "pricingVersion", "priceRef"]) authorityRef(e[k]);
  for (const k of ["claimHash", "runtimeHash", "grantHash", "priceHash", "quoteHash", "requestDigest", "responseDigest", "providerRequestRefHash", "outputContentHash"]) hash(e[k]);
  if ((e.fxRef === null) !== (e.fxHash === null)) refuse("usage_fx_invalid");
  if (e.fxRef !== null) { authorityRef(e.fxRef); hash(e.fxHash); }
  units(e.promptTokens); units(e.completionTokens); const at = authorityDate(e.capturedAt);
  if (e.workspaceId !== grant.workspaceId || e.grantId !== grant.id || e.grantHash !== authorityHash(grant) || at < authorityDate(grant.validFrom) || at >= authorityDate(grant.validUntil)) refuse("usage_grant_binding_invalid");
  const sig = Buffer.from(signature, "base64");
  if (sig.length !== 64 || sig.toString("base64") !== signature || !verify(null, Buffer.from(json), grant.publicKeyPem, sig)) refuse("usage_signature_invalid");
  return e as UsageEvidence;
}
export function decodeControlledResponse(bytes: Uint8Array, requestId: string, modelVersion: string) {
  const response = exactObject(boundedCanonical(bytes), ["schema", "requestId", "requestRef", "usage", "output"]);
  if (response.schema !== "helm.controlled-model-response/v1" || response.requestId !== requestId) refuse("usage_response_binding_invalid");
  authorityRef(response.requestRef);
  const usage = exactObject(response.usage, ["promptTokens", "completionTokens", "totalTokens"]);
  const input = units(usage.promptTokens), output = units(usage.completionTokens);
  if (units(usage.totalTokens) !== input + output) refuse("usage_total_invalid");
  const content = exactObject(response.output, ["rawOutput", "modelVersion", "promptTokens", "completionTokens"]);
  if (typeof content.rawOutput !== "string" || Buffer.byteLength(content.rawOutput) > 49_152 || content.modelVersion !== modelVersion || content.promptTokens !== input || content.completionTokens !== output) refuse("usage_output_invalid");
  return { requestRef: response.requestRef as string, promptTokens: input, completionTokens: output,
    output: content as { rawOutput: string; modelVersion: string; promptTokens: number; completionTokens: number } };
}
