import { generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, it } from "vitest";
import { authorityHash, canonicalAuthorityJson } from "./trusted-spend-authority";
import { boundedCanonical, decodeControlledResponse, readUsageEvidence, readUsageGrant, USAGE_SCHEMA, USAGE_SOURCE, type UsageEvidence } from "./trusted-usage-evidence";
const H = `sha256:${"a".repeat(64)}`;
const keys = generateKeyPairSync("ed25519");
const grant = { schema: "helm.usage-attestor-grant/v1" as const, id: "grant:synthetic", workspaceId: "workspace:synthetic",
  source: USAGE_SOURCE, sourceHash: H, adapterKey: "synthetic-adapter", registrationHash: H, provider: "synthetic-provider",
  model: "synthetic-model", modelVersion: "v1", sku: "text-only", endpointFingerprint: H,
  publicKeyPem: keys.publicKey.export({ type: "spki", format: "pem" }).toString(), validFrom: "2026-01-01T00:00:00.000Z", validUntil: "2027-01-01T00:00:00.000Z" };
const evidence: UsageEvidence = { schema: USAGE_SCHEMA, workspaceId: grant.workspaceId, decisionId: "decision:synthetic",
  providerIdempotencyKey: "key:synthetic", claimHash: H, runtimeHash: H, routeRef: "route:synthetic", grantId: grant.id,
  grantHash: authorityHash(grant), pricingVersion: "v1", priceRef: "price:synthetic", priceHash: H, fxRef: null, fxHash: null,
  quoteHash: H, requestDigest: H, responseDigest: H, providerRequestRefHash: H, outputContentHash: H,
  promptTokens: 10, completionTokens: 20, capturedAt: "2026-06-01T00:00:00.000Z", requestDisposition: "accepted", outcome: "success" };
const response = { schema: "helm.controlled-model-response/v1", requestId: "key:synthetic", requestRef: "request:synthetic",
  usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
  output: { rawOutput: "synthetic only", modelVersion: "v1", promptTokens: 10, completionTokens: 20 } };
const decode = (value: unknown) => decodeControlledResponse(Buffer.from(canonicalAuthorityJson(value)), "key:synthetic", "v1");
const read = (e: unknown) => { const json = canonicalAuthorityJson(e); return readUsageEvidence(json, sign(null, Buffer.from(json), keys.privateKey).toString("base64"), grant); };
describe("finite controlled usage protocol", () => {
  it("reads a canonical immutable observation without supplying price or approval", () => {
    expect(readUsageGrant(canonicalAuthorityJson(grant))).toEqual(grant);
    expect(read(evidence)).toEqual(evidence); expect(decode(response).completionTokens).toBe(20);
  });
  it.each([true, -1, 0.5, 2_147_483_648, null])("rejects non-natural or out-of-range units %s", (v) => {
    expect(() => decode({ ...response, usage: { ...response.usage, promptTokens: v } })).toThrow();
    expect(() => read({ ...evidence, promptTokens: v })).toThrow();
  });
  it("refuses hidden token categories, totals, model and request mismatches", () => {
    for (const value of [{ ...response, usage: { ...response.usage, cachedTokens: 0 } },
      { ...response, usage: { ...response.usage, totalTokens: 31 } }, { ...response, requestId: "other:key" },
      { ...response, output: { ...response.output, modelVersion: "v2" } },
      { ...response, output: { ...response.output, completionTokens: 19 } }]) expect(() => decode(value)).toThrow();
  });
  it("refuses duplicate keys, bad UTF8, empty, excessive bytes/depth and noncanonical input", () => {
    for (const value of [Buffer.from('{"a":1,"a":1}'), Buffer.from([0xc3, 0x28]), Buffer.alloc(0),
      Buffer.alloc(65_537, 32), Buffer.from(' {"a":1}'), Buffer.from("[".repeat(14) + "0" + "]".repeat(14))]) expect(() => boundedCanonical(value)).toThrow();
  });
  it("binds signature, purpose, scope, expiry, source and complete FX pair", () => {
    for (const value of [{ ...evidence, workspaceId: "workspace:other" }, { ...evidence, grantHash: `sha256:${"b".repeat(64)}` },
      { ...evidence, capturedAt: grant.validUntil }, { ...evidence, fxRef: "fx:v1" },
      { ...evidence, approved: true }, { ...evidence, requestDisposition: "not_accepted" }]) expect(() => read(value)).toThrow();
    const json = canonicalAuthorityJson(evidence);
    expect(() => readUsageEvidence(json, Buffer.alloc(64).toString("base64"), grant)).toThrow();
    expect(() => readUsageGrant(canonicalAuthorityJson({ ...grant, source: "other" }))).toThrow();
  });
  it("makes no caller object a grant and observes an independent byte snapshot", () => {
    expect(() => readUsageGrant(canonicalAuthorityJson({ ...grant, approved: true }))).toThrow();
    const bytes = Buffer.from(canonicalAuthorityJson(response)); const observed = decodeControlledResponse(bytes, "key:synthetic", "v1");
    bytes.fill(0); expect(observed.output.rawOutput).toBe("synthetic only");
  });
});
