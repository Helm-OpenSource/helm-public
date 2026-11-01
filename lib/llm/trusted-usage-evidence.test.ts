import { generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, it } from "vitest";
import { authorityHash, canonicalAuthorityJson } from "./trusted-spend-authority";
import { boundedCanonical, bytesHash, DASHSCOPE_USAGE_SOURCE, decodeControlledResponse, decodeDashScopeChatCompletion, readUsageEvidence, readUsageGrant, readMysqlTableNameMode, USAGE_SCHEMA, USAGE_SOURCE, type UsageEvidence } from "./trusted-usage-evidence";
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
  it.each([0, BigInt(0), 1, BigInt(1), 2, BigInt(2)])("preserves exact MySQL table-name metadata %s", (mode) => {
    const normalized = readMysqlTableNameMode(mode);
    expect(normalized).toBe(Number(mode));
    expect(normalized === 0 ? "Membership" : "Membership".toLowerCase()).toBe(Number(mode) === 0 ? "Membership" : "membership");
  });
  it.each(["0", "2", true, null, undefined, -1, 3, BigInt(-1), BigInt(3), 0.5, NaN, Infinity])("refuses malformed MySQL table-name metadata %s", (mode) => {
    expect(() => readMysqlTableNameMode(mode)).toThrow();
  });
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

describe("DashScope usage source", () => {
  const model = "qwen3.8-max-0902";
  const response = (overrides: Record<string, unknown> = {}) => ({ id: "chatcmpl-synthetic", model,
    choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: "{\"ok\":true}" } }],
    usage: { prompt_tokens: 1_000, completion_tokens: 200, total_tokens: 1_200 }, ...overrides });
  const bytes = (value: unknown) => Buffer.from(JSON.stringify(value));

  it("is a closed second source: a grant may name it, nothing else is admitted", () => {
    const signedGrant = (source: string) => canonicalAuthorityJson({ ...grant, source });
    expect(readUsageGrant(signedGrant(DASHSCOPE_USAGE_SOURCE)).source).toBe(DASHSCOPE_USAGE_SOURCE);
    expect(() => readUsageGrant(signedGrant("helm.dashscope-other/v1"))).toThrow("usage_purpose_invalid");
  });

  it("reads non-canonical third-party bytes and keeps the digest of exactly those bytes", () => {
    const pretty = Buffer.from(JSON.stringify(response(), null, 2));
    expect(() => boundedCanonical(pretty)).toThrow();
    expect(decodeDashScopeChatCompletion(pretty, model)).toEqual({ requestRef: "chatcmpl-synthetic", promptTokens: 1_000,
      completionTokens: 200, rawOutput: "{\"ok\":true}", responseDigest: bytesHash(pretty) });
  });

  it.each([
    ["missing id", { id: undefined }, "usage_response_binding_invalid"],
    ["another model", { model: "qwen3.8-max" }, "usage_response_binding_invalid"],
    ["missing model", { model: undefined }, "usage_response_binding_invalid"],
    ["truncated answer", { choices: [{ finish_reason: "length", message: { content: "{" } }] }, "usage_response_binding_invalid"],
    ["two choices", { choices: [{}, {}] }, "usage_response_binding_invalid"],
    ["empty content", { choices: [{ finish_reason: "stop", message: { content: "" } }] }, "usage_response_binding_invalid"],
    ["missing usage", { usage: undefined }, "usage_units_invalid"],
    ["negative tokens", { usage: { prompt_tokens: -1, completion_tokens: 0, total_tokens: -1 } }, "usage_units_invalid"],
    ["wrong total", { usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 3 } }, "usage_total_invalid"],
  ])("leaves no success evidence for %s", (_label, overrides, code) => {
    expect(() => decodeDashScopeChatCompletion(bytes(response(overrides)), model)).toThrow(code);
  });

  it("refuses bad UTF-8, empty, oversized and non-object bodies", () => {
    expect(() => decodeDashScopeChatCompletion(Uint8Array.from([0xff]), model)).toThrow("usage_json_invalid");
    expect(() => decodeDashScopeChatCompletion(new Uint8Array(0), model)).toThrow("usage_size_invalid");
    expect(() => decodeDashScopeChatCompletion(new Uint8Array(1_048_577), model)).toThrow("usage_size_invalid");
    expect(() => decodeDashScopeChatCompletion(bytes([1]), model)).toThrow("usage_json_invalid");
  });
});
