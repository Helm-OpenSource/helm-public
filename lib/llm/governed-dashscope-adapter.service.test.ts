import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { afterEach, describe, expect, it } from "vitest";

import type { CaioInferenceInput } from "@/lib/caio-inference/contracts";
import { buildCaioInferencePrompt } from "@/lib/caio-inference/prompt";
import { canonicalJson, sha256 } from "@/lib/expert-capability/hashing";

import {
  GOVERNED_DASHSCOPE_ADAPTER_KEY,
  GOVERNED_DASHSCOPE_DEFAULT_ENDPOINT,
  buildGovernedDashScopeAdapterRegistration,
  computeGovernedDashScopeEndpointFingerprint,
  createGovernedDashScopeAdapter,
  governedDashScopeRequestModel,
} from "./governed-dashscope-adapter.service";
import { isSafeModelGovernanceRef, type TenantModelRoute } from "./model-route-contracts";
import { authorityHash } from "./trusted-spend-authority";

const HASH_A = sha256("a");
/** Owner-signed price record version: letter-led authorityRef shape, independent of the adapter's internal table. */
const ROUTE_PRICING_VERSION = "price-qwen3.8-max-0902-cn-beijing-20261031";
const SECRET = "sk-synthetic-loopback-only";
const REGISTRATION = buildGovernedDashScopeAdapterRegistration({ registrationRef: "adapter-registration:dashscope-test" });

const PAYLOAD: CaioInferenceInput = {
  schemaVersion: "helm.caio.inference-input.v1",
  workspaceId: "workspace-1",
  taskClass: "hourly_diagnosis",
  windowStart: "2026-07-23T10:00:00.000Z",
  windowEnd: "2026-07-23T11:00:00.000Z",
  snapshotRefs: [{ snapshotId: "snapshot-1", snapshotHash: HASH_A }],
  evidenceRefs: ["evidence:metric-a", "evidence:metric-b"],
  supplements: [{ key: "dead_letters", counts: { total: 3, unknown: null } }],
};
const PAYLOAD_HASH = sha256(canonicalJson(PAYLOAD));
const JUDGEMENT = {
  schemaVersion: "helm.caio.layered-judgement.v1",
  facts: [{ statement: "Dead letters rose in the last hour.", evidenceRefs: ["evidence:metric-a"] }],
  inferences: [],
  risks: [{ statement: "Follow-ups may be missed today.", severity: "medium", evidenceRefs: ["evidence:metric-b"] }],
  unknowns: [{ statement: "Whether the provider callback is delayed." }],
  suggestions: [{ kind: "dry_run_request", summary: "Dry-run a consumer restart rule.", evidenceRefs: ["evidence:metric-a"] }],
  confidence: { band: "medium", score: null },
};

function route(overrides: Partial<TenantModelRoute> = {}): TenantModelRoute {
  return {
    routeId: "route-dashscope", provider: "qwen", modelId: "qwen3.7-plus", modelVersion: "qwen3.7-plus-2026-08-15",
    adapterKey: GOVERNED_DASHSCOPE_ADAPTER_KEY, readinessReceiptRef: "readiness:route-dashscope", readinessReceiptHash: HASH_A,
    credentialRef: "secret:tenant/dashscope", governanceProfileRef: "governance:synthetic", governanceProfileHash: HASH_A,
    projectorRegistrationRef: "projector:synthetic", projectorRegistrationHash: HASH_A, projectorVersion: "v1",
    scannerRegistrationRef: "scanner:synthetic", scannerRegistrationHash: HASH_A, scannerVersion: "v1",
    deploymentForm: "domestic_cloud", jurisdiction: "domestic", region: "cn-beijing",
    allowedTaskClasses: ["reasoning_counterfactual"], maximumSensitivity: "internal", allowedProcessingDispositions: ["remote_projected"],
    retentionDays: 0, trainingUse: "prohibited", termsAssurance: "contractual_no_retention",
    providerTermsRef: "terms:synthetic", providerTermsHash: HASH_A, deletionTermsRef: "terms:synthetic-delete", deletionTermsHash: HASH_A,
    pricingTermsRef: "pricing:synthetic", pricingTermsHash: HASH_A, pricingVersion: ROUTE_PRICING_VERSION,
    maxInputTokens: 20_000, maxOutputTokens: 1_000, maxCostUsdMicros: 100_000, maxLatencyMs: 10_000, maxConcurrency: 1, fallbackRouteIds: [],
    ...overrides,
  };
}

type Seen = { method: string; url: string; authorization: string | undefined; body: unknown };
type Handler = (req: IncomingMessage, res: ServerResponse, body: string) => void;
const servers: Server[] = [];

async function loopback(handler: Handler): Promise<{ endpoint: string; seen: Seen[] }> {
  const seen: Seen[] = [];
  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      const text = Buffer.concat(chunks).toString("utf8");
      seen.push({ method: req.method ?? "", url: req.url ?? "", authorization: req.headers.authorization, body: text ? JSON.parse(text) : null });
      handler(req, res, text);
    });
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  return { endpoint: `http://127.0.0.1:${port}/compatible-mode/v1`, seen };
}
afterEach(() => { for (const server of servers.splice(0)) server.close(); });

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}
function completion(content: unknown, extra: Record<string, unknown> = {}) {
  return { id: "chatcmpl-synthetic-1", model: "qwen3.7-plus-2026-08-15", choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: typeof content === "string" ? content : JSON.stringify(content) } }],
    usage: { prompt_tokens: 1_000, completion_tokens: 200, total_tokens: 1_200 }, ...extra };
}

function adapter(endpoint: string, overrides: Partial<Parameters<typeof createGovernedDashScopeAdapter>[0]> = {}) {
  return createGovernedDashScopeAdapter({
    registration: REGISTRATION, endpoint, endpointFingerprint: computeGovernedDashScopeEndpointFingerprint(endpoint),
    resolveCredential: async () => SECRET, timeoutMs: 2_000, maximumResponseBytes: 262_144, ...overrides,
  });
}

function invokeInput(signal: AbortSignal = new AbortController().signal, key = "idem-1") {
  return { workspaceId: "workspace-1", route: route(), taskClass: "reasoning_counterfactual" as const, taskRef: "task:caio-1", projectedPayload: PAYLOAD,
    projectedPayloadHash: PAYLOAD_HASH, requestedMaxOutputTokens: 800, providerIdempotencyKey: key, dispatchClaimHash: HASH_A, dispatchRuntimeHash: HASH_A, signal };
}

describe("governed DashScope adapter registration and endpoint binding", () => {
  it("builds a registration that describes this adapter and pins the endpoint fingerprint shape", () => {
    expect(REGISTRATION).toMatchObject({ provider: "qwen", supportedDeploymentForms: ["domestic_cloud"] });
    const fingerprint = computeGovernedDashScopeEndpointFingerprint(GOVERNED_DASHSCOPE_DEFAULT_ENDPOINT);
    expect(fingerprint).toBe(authorityHash({ schema: "helm.controlled-http-endpoint/v1", origin: "https://dashscope.aliyuncs.com", path: "/compatible-mode/v1" }));
    expect(computeGovernedDashScopeEndpointFingerprint(`${GOVERNED_DASHSCOPE_DEFAULT_ENDPOINT}/`)).toBe(fingerprint);
  });

  it("refuses a mismatched fingerprint, a foreign registration, an unsafe endpoint and unbounded transport", () => {
    const endpoint = "http://127.0.0.1:9/compatible-mode/v1";
    expect(() => adapter(endpoint, { endpointFingerprint: HASH_A })).toThrow("dashscope_endpoint_binding_invalid");
    expect(() => adapter(endpoint, { registration: { ...REGISTRATION, provider: "openai" } })).toThrow("dashscope_registration_invalid");
    expect(() => adapter("http://192.0.2.1/v1")).toThrow("dashscope_endpoint_invalid");
    const withUserinfo = new URL(GOVERNED_DASHSCOPE_DEFAULT_ENDPOINT);
    withUserinfo.username = "user";
    expect(() => adapter(withUserinfo.href)).toThrow("dashscope_endpoint_invalid");
    expect(() => adapter(endpoint, { timeoutMs: 0 })).toThrow("dashscope_transport_bounds_invalid");
    expect(() => adapter(endpoint, { maximumResponseBytes: 2_000_000 })).toThrow("dashscope_transport_bounds_invalid");
  });
});

describe("governed DashScope adapter readiness and preflight", () => {
  it("reports ready only when the live model list names the route model, with safe evidence refs", async () => {
    const { endpoint, seen } = await loopback((_req, res) => json(res, 200, { object: "list", data: [{ id: "qwen3.7-plus-2026-08-15" }, { id: "qwen3.7-flash" }] }));
    const observation = await adapter(endpoint).probeReadiness({ workspaceId: "workspace-1", route: route() });
    expect(observation.modelProbeStatus).toBe("ready");
    expect(observation.credentialConfigured).toBe(true);
    // Only presence on the list is claimed; nothing about schema support or thinking control.
    expect(observation.capabilityRefs).toEqual(["dashscope-model:qwen3.7-plus-2026-08-15"]);
    expect(observation.evidenceRefs).toEqual([expect.stringMatching(/^dashscope-models-digest:[a-f0-9]{64}$/u)]);
    const familyOnly = await loopback((_req, res) => json(res, 200, { data: [{ id: "qwen3.7-plus" }] }));
    expect(await adapter(familyOnly.endpoint).probeReadiness({ workspaceId: "workspace-1", route: route() })).toMatchObject({ modelProbeStatus: "ready", capabilityRefs: ["dashscope-model:qwen3.7-plus"] });
    for (const ref of [...observation.capabilityRefs, ...observation.evidenceRefs]) expect(isSafeModelGovernanceRef(ref)).toBe(true);
    expect(Date.parse(observation.expiresAt)).toBeGreaterThan(Date.parse(observation.checkedAt));
    expect(seen).toEqual([expect.objectContaining({ method: "GET", url: "/compatible-mode/v1/models", authorization: `Bearer ${SECRET}` })]);
  });

  it("stays not_ready when the model is absent, the probe fails or the credential port refuses, never claiming more", async () => {
    const absent = await loopback((_req, res) => json(res, 200, { data: [{ id: "qwen3.7-flash" }] }));
    const failing = await loopback((_req, res) => json(res, 503, { error: { message: "down" } }));
    for (const [endpoint, expected] of [[absent.endpoint, "dashscope-probe:model_not_listed"], [failing.endpoint, "dashscope-probe:http_503"]] as const) {
      const observation = await adapter(endpoint).probeReadiness({ workspaceId: "workspace-1", route: route() });
      expect(observation.modelProbeStatus).toBe("not_ready");
      expect(observation.capabilityRefs).toEqual([]);
      expect(observation.evidenceRefs).toContain(expected);
      for (const ref of observation.evidenceRefs) expect(isSafeModelGovernanceRef(ref)).toBe(true);
    }
    const noCredential = await adapter(absent.endpoint, { resolveCredential: async () => { throw new Error("vault offline"); } })
      .probeReadiness({ workspaceId: "workspace-1", route: route() });
    expect(noCredential).toMatchObject({ modelProbeStatus: "not_ready", credentialConfigured: false, evidenceRefs: ["dashscope-probe:credential_unavailable"] });
    expect(absent.seen).toHaveLength(1);
    const wrongAdapter = await adapter(absent.endpoint).probeReadiness({ workspaceId: "workspace-1", route: route({ adapterKey: "other" }) });
    expect(wrongAdapter).toMatchObject({ modelProbeStatus: "not_ready", evidenceRefs: ["dashscope-probe:dashscope_route_adapter_mismatch"] });
  });

  it("estimates input tokens and worst-case cost from the price table and reports the credential honestly", async () => {
    const endpoint = "http://127.0.0.1:9/compatible-mode/v1";
    const bytes = Buffer.byteLength(canonicalJson(PAYLOAD), "utf8");
    const observation = await adapter(endpoint).preflight({ workspaceId: "workspace-1", route: route(), taskClass: "reasoning_counterfactual", projectedPayloadHash: PAYLOAD_HASH, projectedPayloadBytes: bytes, requestedMaxOutputTokens: 800 });
    const expectedTokens = Math.ceil((bytes + buildCaioInferencePrompt({ ...PAYLOAD, snapshotRefs: [], evidenceRefs: [], supplements: [], workspaceId: "workspace", windowStart: "1970-01-01T00:00:00.000Z", windowEnd: "1970-01-01T01:00:00.000Z" }).length) / 1.5);
    expect(observation).toMatchObject({ credentialConfigured: true, estimatedInputTokens: expectedTokens, estimatedMaxCostUsdMicros: Math.ceil(expectedTokens * 0.276 + 800 * 1.101) });
    const missing = await adapter(endpoint, { resolveCredential: async () => { throw new Error("no"); } })
      .preflight({ workspaceId: "workspace-1", route: route(), taskClass: "reasoning_counterfactual", projectedPayloadHash: PAYLOAD_HASH, projectedPayloadBytes: bytes, requestedMaxOutputTokens: 800 });
    expect(missing.credentialConfigured).toBe(false);
    // The route's pricing version names the signed price record; the adapter neither matches nor rewrites it.
    const other = await adapter(endpoint).preflight({ workspaceId: "workspace-1", route: route({ pricingVersion: "price:other-record" }), taskClass: "reasoning_counterfactual", projectedPayloadHash: PAYLOAD_HASH, projectedPayloadBytes: bytes, requestedMaxOutputTokens: 800 });
    expect(other.estimatedMaxCostUsdMicros).toBe(observation.estimatedMaxCostUsdMicros);
  });
});

describe("governed DashScope adapter invoke", () => {
  it("sends one strict json_schema chat completion without thinking and returns a costed success", async () => {
    const { endpoint, seen } = await loopback((_req, res) => json(res, 200, completion(JUDGEMENT)));
    const result = await adapter(endpoint).invoke(invokeInput());
    expect(result).toEqual({
      outcome: "success", output: JUDGEMENT, requestDisposition: "accepted", providerRequestRef: "chatcmpl-synthetic-1",
      promptTokens: 1_000, completionTokens: 200, actualCostUsdMicros: Math.ceil(1_000 * 0.276 + 200 * 1.101), costCurrency: "USD",
      pricingVersion: ROUTE_PRICING_VERSION, costBand: "low", errorCode: null,
    });
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ method: "POST", url: "/compatible-mode/v1/chat/completions", authorization: `Bearer ${SECRET}` });
    const body = seen[0].body as Record<string, unknown>;
    expect(body).toMatchObject({ model: "qwen3.7-plus-2026-08-15", temperature: 0, stream: false, enable_thinking: false, max_completion_tokens: 800 });
    expect(body.response_format).toMatchObject({ type: "json_schema", json_schema: { name: "helm_caio_layered_judgement_v1", strict: true, schema: { additionalProperties: false } } });
    expect(body.messages).toEqual([{ role: "user", content: buildCaioInferencePrompt(PAYLOAD) }]);
    expect(JSON.stringify(body)).not.toContain(SECRET);
    const otherRecord = await adapter(endpoint).invoke({ ...invokeInput(), route: route({ pricingVersion: "price:other-record" }) });
    expect(otherRecord).toMatchObject({ outcome: "success", pricingVersion: "price:other-record", actualCostUsdMicros: 497 });
  });

  it("sends the route's exact snapshot id when it has one and refuses an answer from another model", async () => {
    expect(governedDashScopeRequestModel({ modelId: "qwen3.8-max", modelVersion: "qwen3.8-max-0902" })).toBe("qwen3.8-max-0902");
    expect(governedDashScopeRequestModel({ modelId: "qwen3.7-plus", modelVersion: "2026-08-15" })).toBe("qwen3.7-plus");
    const echo = await loopback((_req, res, body) => json(res, 200, completion(JUDGEMENT, { model: (JSON.parse(body) as { model: string }).model })));
    const dated = route({ modelVersion: "2026-08-15" });
    expect(await adapter(echo.endpoint).invoke({ ...invokeInput(), route: dated })).toMatchObject({ outcome: "success" });
    expect(echo.seen[0].body).toMatchObject({ model: "qwen3.7-plus" });
    const other = await loopback((_req, res) => json(res, 200, completion(JUDGEMENT, { model: "qwen3.7-plus" })));
    expect(await adapter(other.endpoint).invoke(invokeInput())).toMatchObject({ outcome: "failure", requestDisposition: "accepted", errorCode: "dashscope_model_mismatch", actualCostUsdMicros: 497 });
    expect(other.seen[0].body).toMatchObject({ model: "qwen3.7-plus-2026-08-15" });
  });

  it("costs a 2xx answer the validator refuses as an accepted failure with the closed code", async () => {
    const outsideInput = { ...JUDGEMENT, facts: [{ statement: "x", evidenceRefs: ["evidence:not-in-input"] }] };
    const { endpoint } = await loopback((_req, res) => json(res, 200, completion(outsideInput)));
    const result = await adapter(endpoint).invoke(invokeInput());
    expect(result).toMatchObject({ outcome: "failure", requestDisposition: "accepted", providerRequestRef: "chatcmpl-synthetic-1", promptTokens: 1_000, completionTokens: 200, actualCostUsdMicros: 497, costCurrency: "USD", pricingVersion: ROUTE_PRICING_VERSION, errorCode: "dashscope_output_evidence_outside_input" });
    expect(result).not.toHaveProperty("output");
    const notJson = await loopback((_req, res) => json(res, 200, completion("not json at all")));
    expect(await adapter(notJson.endpoint).invoke(invokeInput())).toMatchObject({ outcome: "failure", requestDisposition: "accepted", errorCode: "dashscope_output_not_json", actualCostUsdMicros: 497 });
    const truncated = await loopback((_req, res) => json(res, 200, { ...completion(JUDGEMENT), choices: [{ finish_reason: "length", message: { content: "{" } }] }));
    expect(await adapter(truncated.endpoint).invoke(invokeInput())).toMatchObject({ outcome: "failure", requestDisposition: "accepted", errorCode: "dashscope_output_truncated" });
  });

  it("keeps provider doubt unknown without zero-filling: 5xx, undecodable body, missing usage", async () => {
    const serverError = await loopback((_req, res) => json(res, 500, { error: { message: "internal" }, request_id: "req-500" }));
    expect(await adapter(serverError.endpoint).invoke(invokeInput())).toEqual({ outcome: "unknown", requestDisposition: "unknown", providerRequestRef: "req-500", promptTokens: null, completionTokens: null, actualCostUsdMicros: null, costCurrency: null, pricingVersion: null, costBand: "unknown", errorCode: "dashscope_http_500" });
    const garbage = await loopback((_req, res) => { res.writeHead(200, { "content-type": "text/html" }); res.end("<html>gateway</html>"); });
    expect(await adapter(garbage.endpoint).invoke(invokeInput())).toMatchObject({ outcome: "unknown", errorCode: "dashscope_response_not_json", actualCostUsdMicros: null });
    const noUsage = await loopback((_req, res) => json(res, 200, { ...completion(JUDGEMENT), usage: undefined }));
    expect(await adapter(noUsage.endpoint).invoke(invokeInput())).toMatchObject({ outcome: "unknown", errorCode: "dashscope_usage_missing", providerRequestRef: "chatcmpl-synthetic-1", costBand: "unknown", actualCostUsdMicros: null });
  });

  it("marks a refusing 4xx and every pre-send refusal as not accepted with zero usage", async () => {
    const unauthorized = await loopback((_req, res) => json(res, 401, { error: { message: "Incorrect API key", type: "invalid_request_error" } }));
    const notAccepted = { outcome: "failure", requestDisposition: "not_accepted", providerRequestRef: null, promptTokens: 0, completionTokens: 0, actualCostUsdMicros: 0, costCurrency: "USD", pricingVersion: ROUTE_PRICING_VERSION, costBand: "zero" };
    expect(await adapter(unauthorized.endpoint).invoke(invokeInput())).toEqual({ ...notAccepted, errorCode: "dashscope_http_401" });
    const untouched = await loopback((_req, res) => json(res, 200, completion(JUDGEMENT)));
    const credentialDown = adapter(untouched.endpoint, { resolveCredential: async () => { throw new Error("vault offline"); } });
    expect(await credentialDown.invoke(invokeInput())).toEqual({ ...notAccepted, errorCode: "dashscope_credential_unavailable" });
    expect(await adapter(untouched.endpoint).invoke({ ...invokeInput(), projectedPayloadHash: HASH_A })).toEqual({ ...notAccepted, errorCode: "dashscope_payload_binding_invalid" });
    expect(await adapter(untouched.endpoint).invoke(invokeInput(AbortSignal.abort()))).toEqual({ ...notAccepted, errorCode: "dashscope_aborted_before_send" });
    expect(untouched.seen).toHaveLength(0);
  });

  it("times out, honours the caller's abort, bounds the response and never resends one idempotency key", async () => {
    const slow = await loopback((_req, res) => { setTimeout(() => json(res, 200, completion(JUDGEMENT)), 1_500); });
    const timing = adapter(slow.endpoint, { timeoutMs: 100 });
    expect(await timing.invoke(invokeInput())).toMatchObject({ outcome: "unknown", requestDisposition: "unknown", errorCode: "dashscope_transport_timeout", actualCostUsdMicros: null, costBand: "unknown" });
    await expect(timing.invoke(invokeInput())).rejects.toThrow("dashscope_dispatch_already_attempted");
    const controller = new AbortController();
    const pending = adapter(slow.endpoint).invoke(invokeInput(controller.signal, "idem-2"));
    setTimeout(() => controller.abort(), 50);
    expect(await pending).toMatchObject({ outcome: "unknown", errorCode: "dashscope_transport_aborted" });
    const huge = await loopback((_req, res) => json(res, 200, completion(JUDGEMENT, { padding: "x".repeat(4_096) })));
    expect(await adapter(huge.endpoint, { maximumResponseBytes: 1_024 }).invoke(invokeInput())).toMatchObject({ outcome: "unknown", errorCode: "dashscope_response_too_large" });
  });
  it("reserves the key before the credential await: concurrent calls send at most once, other keys still work", async () => {
    const { endpoint, seen } = await loopback((_req, res) => json(res, 200, completion(JUDGEMENT)));
    let release: (value: string) => void = () => undefined;
    const barrier = new Promise<string>((resolve) => { release = resolve; });
    const instance = adapter(endpoint, { resolveCredential: () => barrier });
    const first = instance.invoke(invokeInput());
    await expect(instance.invoke(invokeInput())).rejects.toThrow("dashscope_dispatch_already_attempted");
    release(SECRET);
    expect(await first).toMatchObject({ outcome: "success" });
    expect(seen.filter((entry) => entry.method === "POST")).toHaveLength(1);
    await expect(instance.invoke(invokeInput())).rejects.toThrow("dashscope_dispatch_already_attempted");
    expect(await instance.invoke(invokeInput(undefined, "idem-2"))).toMatchObject({ outcome: "success" });
    expect(seen.filter((entry) => entry.method === "POST")).toHaveLength(2);
  });

  it("releases the key only when nothing reached the wire", async () => {
    const { endpoint, seen } = await loopback((_req, res) => json(res, 200, completion(JUDGEMENT)));
    let failures = 1;
    const instance = adapter(endpoint, { resolveCredential: async () => { if (failures-- > 0) throw new Error("port down"); return SECRET; } });
    expect(await instance.invoke(invokeInput())).toMatchObject({ outcome: "failure", requestDisposition: "not_accepted", errorCode: "dashscope_credential_unavailable" });
    expect(seen).toHaveLength(0);
    expect(await instance.invoke(invokeInput())).toMatchObject({ outcome: "success" });
  });

  it.each([
    ["missing", undefined, "dashscope_model_missing"],
    ["null", null, "dashscope_model_missing"],
    ["a number", 42, "dashscope_model_missing"],
    ["empty", "", "dashscope_model_missing"],
    ["another model", "qwen3.7-flash", "dashscope_model_mismatch"],
  ])("does not succeed when the response model is %s, and keeps the observed usage", async (_label, model, errorCode) => {
    const { endpoint } = await loopback((_req, res) => json(res, 200, completion(JUDGEMENT, { model })));
    const result = await adapter(endpoint).invoke(invokeInput());
    expect(result).toMatchObject({ outcome: "failure", requestDisposition: "accepted", promptTokens: 1_000, completionTokens: 200, errorCode });
    expect(result.output).toBeUndefined();
    expect(result.actualCostUsdMicros).toBeGreaterThan(0);
  });
});

describe("governed DashScope adapter with a usage collector port", () => {
  type Exchange = { requestBytes: Uint8Array; responseBytes: Uint8Array; output: unknown };
  const FLOAT_SCORE = { ...JUDGEMENT, confidence: { band: "medium", score: 0.72 } };
  function usageCollector(endpoint: string, overrides: {
    prepare?: () => Promise<never>; record?: (exchange: Exchange) => Promise<never>; leaseRemainingMs?: number;
  } = {}) {
    const prepared: Array<{ route: unknown }> = [], recorded: Exchange[] = [];
    return { prepared, recorded, port: {
      binding: { adapterKey: REGISTRATION.adapterKey, registrationHash: REGISTRATION.contentHash, endpointFingerprint: computeGovernedDashScopeEndpointFingerprint(endpoint) },
      prepare: overrides.prepare ?? (async (call: { route: unknown }) => {
        prepared.push(call);
        return { leaseRemainingMs: overrides.leaseRemainingMs ?? 60_000, record: async (exchange: Exchange) => {
          recorded.push(exchange);
          if (overrides.record) return overrides.record(exchange);
          return { providerRequestRef: "chatcmpl-from-evidence", promptTokens: 1_000, completionTokens: 200, actualCostUsdMicros: 2_640 };
        } };
      }),
    } };
  }

  it("returns the cost, reference and tokens from the evidence and hands over the exact bytes sent and received", async () => {
    const received: string[] = [];
    const { endpoint, seen } = await loopback((_req, res, body) => { received.push(body); json(res, 200, completion(FLOAT_SCORE)); });
    const collector = usageCollector(endpoint);
    const result = await adapter(endpoint, { usageCollector: collector.port }).invoke(invokeInput());
    expect(result).toEqual({ outcome: "success", output: FLOAT_SCORE, requestDisposition: "accepted", providerRequestRef: "chatcmpl-from-evidence",
      promptTokens: 1_000, completionTokens: 200, actualCostUsdMicros: 2_640, costCurrency: "USD", pricingVersion: ROUTE_PRICING_VERSION, costBand: "low", errorCode: null });
    expect(seen).toHaveLength(1);
    expect(collector.prepared).toHaveLength(1);
    expect(collector.prepared[0]).toMatchObject({ workspaceId: "workspace-1", providerIdempotencyKey: "idem-1", dispatchClaimHash: HASH_A, dispatchRuntimeHash: HASH_A, projectedPayloadHash: PAYLOAD_HASH });
    expect(Buffer.from(collector.recorded[0].requestBytes).toString("utf8")).toBe(received[0]);
    expect(JSON.parse(Buffer.from(collector.recorded[0].responseBytes).toString("utf8"))).toEqual(completion(FLOAT_SCORE));
    expect(collector.recorded[0].output).toEqual(FLOAT_SCORE);
  });

  it("the gateway's output hash accepts a fractional confidence that the authority hash refuses", () => {
    expect(() => authorityHash(FLOAT_SCORE)).toThrow("spend_authority_json_number_invalid");
    expect(sha256(canonicalJson(FLOAT_SCORE))).toMatch(/^sha256:[a-f0-9]{64}$/u);
  });

  it("refuses a collector bound to another registration or endpoint at construction", async () => {
    const { endpoint } = await loopback((_req, res) => json(res, 200, completion(JUDGEMENT)));
    const { port } = usageCollector(endpoint);
    for (const binding of [{ ...port.binding, registrationHash: HASH_A }, { ...port.binding, endpointFingerprint: HASH_A }, { ...port.binding, adapterKey: "other-adapter" }]) {
      expect(() => adapter(endpoint, { usageCollector: { ...port, binding } })).toThrow("dashscope_usage_collector_binding_invalid");
    }
  });

  it("sends nothing and releases the key when prepare refuses", async () => {
    const { endpoint, seen } = await loopback((_req, res) => json(res, 200, completion(JUDGEMENT)));
    const refused = usageCollector(endpoint, { prepare: async () => { throw new Error("spend_authority_usage_dispatch_binding_invalid"); } });
    const instance = adapter(endpoint, { usageCollector: refused.port });
    expect(await instance.invoke(invokeInput())).toMatchObject({ outcome: "failure", requestDisposition: "not_accepted", actualCostUsdMicros: 0, errorCode: "dashscope_usage_dispatch_binding_invalid" });
    const hidden = usageCollector(endpoint, { prepare: async () => { throw new Error("connect failed at a private host"); } });
    expect(await adapter(endpoint, { usageCollector: hidden.port }).invoke(invokeInput())).toMatchObject({ requestDisposition: "not_accepted", errorCode: "dashscope_usage_prepare_refused" });
    expect(seen).toHaveLength(0);
    await expect(instance.invoke(invokeInput())).resolves.toMatchObject({ requestDisposition: "not_accepted" });
  });

  it("stays unknown without zero-filling when the evidence write fails, and never resends", async () => {
    const { endpoint, seen } = await loopback((_req, res) => json(res, 200, completion(JUDGEMENT)));
    const collector = usageCollector(endpoint, { record: async () => { throw new Error("spend_authority_usage_capture_changed_or_expired"); } });
    const instance = adapter(endpoint, { usageCollector: collector.port });
    expect(await instance.invoke(invokeInput())).toEqual({ outcome: "unknown", requestDisposition: "unknown", providerRequestRef: "chatcmpl-synthetic-1", promptTokens: 1_000, completionTokens: 200,
      actualCostUsdMicros: null, costCurrency: null, pricingVersion: null, costBand: "unknown", errorCode: "dashscope_usage_capture_changed_or_expired" });
    await expect(instance.invoke(invokeInput())).rejects.toThrow("dashscope_dispatch_already_attempted");
    expect(seen).toHaveLength(1);
  });

  it.each([
    ["a schema refusal", completion({ ...JUDGEMENT, facts: "not-a-list" }), "dashscope_output_malformed_output"],
    ["another model", completion(JUDGEMENT, { model: "qwen3.7-flash" }), "dashscope_model_mismatch"],
    ["truncated output", { ...completion(JUDGEMENT), choices: [{ finish_reason: "length", message: { content: "{" } }] }, "dashscope_output_truncated"],
  ])("writes no evidence on %s and keeps the existing accepted failure", async (_label, body, errorCode) => {
    const { endpoint } = await loopback((_req, res) => json(res, 200, body));
    const collector = usageCollector(endpoint);
    const result = await adapter(endpoint, { usageCollector: collector.port }).invoke(invokeInput());
    expect(result).toMatchObject({ outcome: "failure", requestDisposition: "accepted", promptTokens: 1_000, completionTokens: 200, errorCode });
    expect(collector.prepared).toHaveLength(1);
    expect(collector.recorded).toHaveLength(0);
  });

  it("does not wait past the dispatch lease", async () => {
    const { endpoint } = await loopback(() => { /* never answers */ });
    const collector = usageCollector(endpoint, { leaseRemainingMs: 30 });
    const startedAt = Date.now();
    expect(await adapter(endpoint, { usageCollector: collector.port }).invoke(invokeInput())).toMatchObject({ outcome: "unknown", errorCode: "dashscope_transport_timeout" });
    expect(Date.now() - startedAt).toBeLessThan(1_500);
  });

  it("takes the claim's route as it was before the first await", async () => {
    const { endpoint } = await loopback((_req, res) => json(res, 200, completion(JUDGEMENT)));
    const collector = usageCollector(endpoint);
    const input = invokeInput();
    const pending = adapter(endpoint, { usageCollector: collector.port }).invoke(input);
    input.route.maxCostUsdMicros = 1;
    await pending;
    expect(collector.prepared[0].route).toEqual(route());
  });
});
