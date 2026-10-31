import { generateKeyPairSync } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { canonicalJson, sha256 } from "@/lib/expert-capability/hashing";

import { createGovernedDashScopeUsageCollector } from "./dashscope-usage-collector.service";
import { buildGovernedDashScopeAdapterRegistration } from "./governed-dashscope-adapter.service";
import type { TenantModelRoute } from "./model-route-contracts";
import { authorityHash, canonicalAuthorityJson, computeMaximumCharge } from "./trusted-spend-authority";
import { bytesHash, DASHSCOPE_USAGE_SOURCE, readUsageEvidence, USAGE_SOURCE, type DashScopeUsageCall, type UsageEvidence, type UsageGrant } from "./trusted-usage-evidence";

// Real signing, decoding, pricing and evidence verification over a fake transaction: the readers below stand in for
// the claim and ledger rows. Database behaviour, ACLs and settlement are proven in model-egress-store.mysql.test.ts.
const state = vi.hoisted(() => ({ claim: {} as Record<string, unknown>, grant: {} as unknown, grantAtCall: null as unknown, record: {} as Record<string, unknown>, realm: null as Error | null }));
vi.mock("./trusted-usage-evidence-prisma", () => ({
  assertUsageCollectorRealm: vi.fn(async () => { if (state.realm) throw state.realm; }),
  readUsageClaimInTransaction: vi.fn(async () => state.claim),
  readUsageGrantInTransaction: vi.fn(async () => state.grantAtCall ?? state.grant),
}));
vi.mock("./trusted-spend-authority-prisma", () => ({
  readTrustedSpendRecordInTransaction: vi.fn(async (_tx: unknown, _workspaceId: string, _ref: unknown, kind: string) => (state.record as Record<string, unknown>)[kind]),
}));

const HASH_A = sha256("a"), HASH_B = sha256("b"), HASH_C = sha256("c");
const keys = generateKeyPairSync("ed25519");
const NOW = new Date("2026-11-01T00:00:10.000Z");
const FAR = new Date("2026-11-01T01:00:00.000Z");
const PRICE = { billing: "input-output-only-v1", provider: "qwen", model: "qwen3.7-plus", sku: "text-only", currency: "CNY",
  input: { numerator: "12", denominator: "1", ceiling: "8000" }, output: { numerator: "36", denominator: "1", ceiling: "1000" } };
const FX = { from: "CNY", to: "USD", numerator: "11", denominator: "80" };
const REGISTRATION = buildGovernedDashScopeAdapterRegistration({ registrationRef: "adapter-registration:dashscope-test" });
const ROUTE = { routeId: "route-dashscope", provider: "qwen", modelId: "qwen3.7-plus", modelVersion: "qwen3.7-plus-2026-08-15", pricingVersion: "price-qwen-2026-11" } as TenantModelRoute;
const CALL: DashScopeUsageCall = { workspaceId: "workspace-1", providerIdempotencyKey: "attempt-1", dispatchClaimHash: HASH_B, dispatchRuntimeHash: HASH_C, projectedPayloadHash: HASH_A, route: ROUTE };
const GRANT: UsageGrant = { schema: "helm.usage-attestor-grant/v1", id: "usage-grant-1", workspaceId: "workspace-1", source: DASHSCOPE_USAGE_SOURCE, sourceHash: HASH_A,
  adapterKey: REGISTRATION.adapterKey, registrationHash: REGISTRATION.contentHash, provider: "qwen", model: "qwen3.7-plus", modelVersion: ROUTE.modelVersion, sku: "text-only", endpointFingerprint: HASH_B,
  publicKeyPem: keys.publicKey.export({ type: "spki", format: "pem" }).toString(), validFrom: "2026-10-01T00:00:00.000Z", validUntil: "2026-12-01T00:00:00.000Z" };
const OUTPUT = { facts: [], confidence: { band: "medium", score: 0.72 } };
const request = (model = ROUTE.modelVersion) => Buffer.from(JSON.stringify({ model, messages: [] }), "utf8");
const response = (overrides: Record<string, unknown> = {}, content: unknown = OUTPUT) => Buffer.from(JSON.stringify({ id: "chatcmpl-1", model: ROUTE.modelVersion,
  choices: [{ finish_reason: "stop", message: { content: JSON.stringify(content) } }], usage: { prompt_tokens: 1_000, completion_tokens: 200, total_tokens: 1_200 }, ...overrides }), "utf8");

function fakeClient(writes: unknown[][], options: { evidenceExists?: boolean; readback?: string | null } = {}) {
  let saved: string | undefined;
  const tx = {
    async $queryRaw(strings: TemplateStringsArray) {
      const sql = strings.join("?");
      if (sql.includes("UTC_TIMESTAMP")) return [{ now: NOW }];
      if (sql.includes("SELECT workspaceId FROM LLMUsageAttestorGrant")) return [{ workspaceId: "workspace-1" }];
      if (sql.includes("SELECT contentHash")) return [{ contentHash: options.readback === undefined ? saved : options.readback }];
      if (sql.includes("SELECT id FROM LLMTrustedUsageEvidence")) return options.evidenceExists ? [{ id: "usage:decision-1" }] : [];
      throw new Error(`unexpected query: ${sql}`);
    },
    async $executeRaw(_strings: TemplateStringsArray, ...values: unknown[]) { writes.push(values); saved = values[6] as string; return 1; },
  };
  return { $transaction: async <T,>(callback: (client: typeof tx) => Promise<T>) => callback(tx) } as unknown as PrismaClient;
}
function collector(client: PrismaClient, overrides: Partial<Parameters<typeof createGovernedDashScopeUsageCollector>[0]> = {}) {
  return createGovernedDashScopeUsageCollector({ collectorClient: client, chargeClient: client, operationWriterClient: client, registration: REGISTRATION,
    grantId: GRANT.id, usage: { trustedAttestorGrants: { [GRANT.id]: authorityHash(GRANT) } }, spend: { expectedPeriodPolicyVersion: "period-v1", trustedIssuerGrants: {} },
    privateKey: keys.privateKey, endpointFingerprint: HASH_B, ...overrides });
}
beforeEach(() => {
  state.grant = GRANT; state.grantAtCall = null; state.realm = null;
  state.claim = {
    row: { id: "decision-1", dispatchClaimHash: HASH_B, dispatchRuntimeHash: HASH_C, dispatchLeaseExpiresAt: new Date(NOW.getTime() + 45_000) },
    decision: { projectedPayloadHash: HASH_A, routeRef: ROUTE.routeId, routeSnapshot: ROUTE },
    runtime: { adapterRegistrationHash: REGISTRATION.contentHash, endpointFingerprint: HASH_B },
    ledger: { state: "reserved", priceBookRef: "price-1", priceBookHash: HASH_A, fxSnapshotRef: "fx-1", fxSnapshotHash: HASH_B, quoteHash: HASH_C },
  };
  state.record = { price: { envelope: { version: ROUTE.pricingVersion, validUntil: FAR.toISOString(), payload: PRICE }, grant: { validUntil: FAR } },
    fx: { envelope: { version: "fx-1", validUntil: FAR.toISOString(), payload: FX }, grant: { validUntil: FAR } } };
});

describe("governed DashScope usage collector", () => {
  it("signs evidence with every binding and charges the signed price, not a table", async () => {
    const writes: unknown[][] = [];
    const port = await collector(fakeClient(writes));
    expect(port.binding).toEqual({ adapterKey: REGISTRATION.adapterKey, registrationHash: REGISTRATION.contentHash, endpointFingerprint: HASH_B });
    const capture = await port.prepare(CALL);
    expect(capture.leaseRemainingMs).toBe(45_000);
    const [requestBytes, responseBytes] = [request(), response()];
    const recorded = await capture.record({ requestBytes, responseBytes, output: OUTPUT });
    const charge = computeMaximumCharge(PRICE, FX, BigInt(1_000), BigInt(200));
    expect(charge).toBe(BigInt(2_640));
    expect(recorded).toEqual({ providerRequestRef: "chatcmpl-1", promptTokens: 1_000, completionTokens: 200, actualCostUsdMicros: 2_640 });
    const [id, workspaceId, decisionId, key, grantId, json, digest, signature] = writes[0] as string[];
    expect([id, workspaceId, decisionId, key, grantId]).toEqual(["usage:decision-1", "workspace-1", "decision-1", "attempt-1", GRANT.id]);
    const evidence: UsageEvidence = readUsageEvidence(json, signature, GRANT);
    expect(evidence).toEqual({ schema: "helm.trusted-usage/v1", workspaceId: "workspace-1", decisionId: "decision-1", providerIdempotencyKey: "attempt-1", claimHash: HASH_B, runtimeHash: HASH_C,
      routeRef: ROUTE.routeId, grantId: GRANT.id, grantHash: authorityHash(GRANT), pricingVersion: ROUTE.pricingVersion, priceRef: "price-1", priceHash: HASH_A, fxRef: "fx-1", fxHash: HASH_B, quoteHash: HASH_C,
      requestDigest: bytesHash(requestBytes), responseDigest: bytesHash(responseBytes), providerRequestRefHash: sha256("chatcmpl-1"), outputContentHash: sha256(canonicalJson(OUTPUT)),
      promptTokens: 1_000, completionTokens: 200, capturedAt: NOW.toISOString(), requestDisposition: "accepted", outcome: "success" });
    expect(digest).toBe(authorityHash(evidence));
    expect(canonicalAuthorityJson(evidence)).toBe(json);
  });

  it("accepts the family model id when that is what was sent", async () => {
    const capture = await (await collector(fakeClient([]))).prepare(CALL);
    await expect(capture.record({ requestBytes: request("qwen3.7-plus"), responseBytes: response({ model: "qwen3.7-plus" }), output: OUTPUT })).resolves.toMatchObject({ actualCostUsdMicros: 2_640 });
  });

  it.each([
    ["a controlled-HTTP grant", { source: USAGE_SOURCE }],
    ["another adapter", { adapterKey: "other-adapter" }],
    ["another registration", { registrationHash: HASH_B }],
    ["another endpoint", { endpointFingerprint: HASH_C }],
    ["another key", { publicKeyPem: generateKeyPairSync("ed25519").publicKey.export({ type: "spki", format: "pem" }).toString() }],
  ])("refuses at construction a grant for %s", async (_label, change) => {
    state.grant = { ...GRANT, ...change };
    await expect(collector(fakeClient([]))).rejects.toThrow("spend_authority_usage_factory_binding_invalid");
  });

  it("refuses when the shared realm check refuses", async () => {
    state.realm = new Error("spend_authority_usage_collector_acl_invalid");
    await expect(collector(fakeClient([]))).rejects.toThrow("spend_authority_usage_collector_acl_invalid");
  });

  it.each<[string, () => void, string]>([
    ["a grant whose source changed since construction", () => { state.grantAtCall = { ...GRANT, source: USAGE_SOURCE }; }, "usage_dispatch_binding_invalid"],
    ["a different claim", () => { (state.claim.row as Record<string, unknown>).dispatchClaimHash = HASH_C; }, "usage_dispatch_binding_invalid"],
    ["a different route snapshot", () => { (state.claim.decision as Record<string, unknown>).routeSnapshot = { ...ROUTE, modelId: "other" }; }, "usage_dispatch_binding_invalid"],
    ["a ledger no longer reserved", () => { (state.claim.ledger as Record<string, unknown>).state = "unknown"; }, "usage_dispatch_binding_invalid"],
    ["an expired lease", () => { (state.claim.row as Record<string, unknown>).dispatchLeaseExpiresAt = NOW; }, "usage_dispatch_binding_invalid"],
    ["a price for another model", () => { (state.record.price as { envelope: unknown }).envelope = { version: ROUTE.pricingVersion, validUntil: FAR.toISOString(), payload: { ...PRICE, model: "other" } }; }, "usage_price_binding_invalid"],
    ["an expired price", () => { (state.record.price as { grant: unknown }).grant = { validUntil: NOW }; }, "usage_price_expired"],
  ])("prepare refuses %s", async (_label, change, reason) => {
    const port = await collector(fakeClient([]));
    change();
    await expect(port.prepare(CALL)).rejects.toThrow(`spend_authority_${reason}`);
  });

  it("prepare refuses when evidence already exists for the attempt", async () => {
    await expect((await collector(fakeClient([], { evidenceExists: true }))).prepare(CALL)).rejects.toThrow("spend_authority_usage_evidence_already_exists");
  });

  it.each<[string, { requestBytes?: Buffer; responseBytes?: Buffer; output?: unknown }, string]>([
    ["a model the route does not name", { requestBytes: request("qwen3.7-flash") }, "usage_request_binding_invalid"],
    ["a truncated answer", { responseBytes: response({ choices: [{ finish_reason: "length", message: { content: "{}" } }] }) }, "usage_response_binding_invalid"],
    ["inconsistent usage", { responseBytes: response({ usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 4 } }) }, "usage_total_invalid"],
    ["a padded provider reference", { responseBytes: response({ id: " chatcmpl-1" }) }, "usage_response_binding_invalid"],
    ["output that is not the response content", { output: { facts: ["other"] } }, "usage_output_binding_invalid"],
    ["usage above the signed ceiling", { responseBytes: response({ usage: { prompt_tokens: 9_000, completion_tokens: 0, total_tokens: 9_000 } }) }, "usage_bound_invalid"],
  ])("record writes nothing for %s", async (_label, change, reason) => {
    const writes: unknown[][] = [];
    const capture = await (await collector(fakeClient(writes))).prepare(CALL);
    await expect(capture.record({ requestBytes: request(), responseBytes: response(), output: OUTPUT, ...change })).rejects.toThrow(`spend_authority_${reason}`);
    expect(writes).toHaveLength(0);
  });

  it.each<[string, () => void]>([
    ["the quote changed", () => { (state.claim.ledger as Record<string, unknown>).quoteHash = HASH_A; }],
    ["the ledger left reserved", () => { (state.claim.ledger as Record<string, unknown>).state = "unknown"; }],
    ["the lease expired", () => { (state.claim.row as Record<string, unknown>).dispatchLeaseExpiresAt = NOW; }],
  ])("record writes nothing when %s after the send", async (_label, change) => {
    const writes: unknown[][] = [];
    const capture = await (await collector(fakeClient(writes))).prepare(CALL);
    change();
    await expect(capture.record({ requestBytes: request(), responseBytes: response(), output: OUTPUT })).rejects.toThrow("spend_authority_usage_capture_changed_or_expired");
    expect(writes).toHaveLength(0);
  });

  it("refuses a readback that differs from what was written", async () => {
    const capture = await (await collector(fakeClient([], { readback: HASH_A }))).prepare(CALL);
    await expect(capture.record({ requestBytes: request(), responseBytes: response(), output: OUTPUT })).rejects.toThrow("spend_authority_usage_insert_readback_invalid");
  });
});
