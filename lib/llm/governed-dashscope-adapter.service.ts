import "server-only";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";

import { CAIO_INFERENCE_INPUT_SCHEMA_VERSION, type CaioInferenceInput } from "@/lib/caio-inference/contracts";
import { CAIO_LAYERED_JUDGEMENT_JSON_SCHEMA, validateCaioLayeredJudgement, type CaioLayeredJudgement } from "@/lib/caio-inference/layered-judgement";
import { buildCaioInferencePrompt } from "@/lib/caio-inference/prompt";
import { canonicalJson, sha256 } from "@/lib/expert-capability/hashing";

import type { GovernedModelAdapterResult, GovernedModelProviderAdapter, GovernedModelReadinessProbeObservation } from "./governed-model-adapter-registry.service";
import type { ModelEgressCostBand } from "./model-egress-contracts";
import {
  MODEL_GOVERNANCE_PERSISTED_INT_MAX, computeGovernedModelAdapterRegistrationHash, validateGovernedModelAdapterRegistration,
  type GovernedModelAdapterRegistration, type ModelDeploymentForm, type TenantModelRoute,
} from "./model-route-contracts";
import { PRICING_TABLE_VERSION, resolveTokenCost } from "./token-cost-table";

/**
 * Governed DashScope (Alibaba Cloud Model Studio, Qwen) provider adapter for CAIO inference: the OpenAI-compatible
 * `chat/completions` surface with strict `json_schema` output and thinking disabled, asking the shared CAIO prompt
 * and accepting only a layered judgement the validator admits. It is a transport plus a cost reading; decisions,
 * claims, receipts and spend remain the governed gateway's. Only reviewed server composition constructs it, and the
 * credential comes from an injected resolver keyed by the route's managed reference, never from the environment.
 *
 * Outcome shape follows the gateway's terminal contract: never sent, or refused by a status that carries no
 * completion, is `failure/not_accepted` with zero usage; a 2xx answer with usage whose content the validator refuses
 * is `failure/accepted` and still costed; every transport doubt (timeout, abort, oversize, 5xx, missing usage,
 * undecodable body) stays `unknown` with the cost unset rather than zero-filled.
 *
 * Importing this module or its factory anywhere else in public Core is refused by
 * `scripts/check-model-egress-governance.ts`; a composer that hands the adapter to the registry/gateway must be
 * added to that allowlist under review, so no caller can mint one and call `invoke()` around the claim chain.
 */
export const GOVERNED_DASHSCOPE_PROVIDER = "qwen" as const;
export const GOVERNED_DASHSCOPE_ADAPTER_KEY = "dashscope-compatible-caio-judgement";
export const GOVERNED_DASHSCOPE_ADAPTER_VERSION = "1.0.0";
export const GOVERNED_DASHSCOPE_DEFAULT_ENDPOINT = "https://dashscope.aliyuncs.com/compatible-mode/v1";
export const GOVERNED_DASHSCOPE_ENDPOINT_FINGERPRINT_SCHEMA = "helm.controlled-http-endpoint/v1";
export const GOVERNED_DASHSCOPE_RESPONSE_FORMAT_NAME = "helm_caio_layered_judgement_v1";
const TRANSPORT_CONTRACT = "dashscope.compatible-mode.chat-completions.json-schema/v1";
const MAX_TIMEOUT_MS = 120_000;
const MAX_RESPONSE_BYTES = 1_048_576;
const MAX_REQUEST_BYTES = 262_144;
const MAX_PAYLOAD_BYTES = 131_072;
const MAX_CREDENTIAL_LENGTH = 4_096;
const MAX_PROVIDER_REF_LENGTH = 4_096;
const MAX_ATTEMPTED_KEYS = 65_536;
const READINESS_TTL_MS = 15 * 60_000;
/** Characters per token used by `estimateInputTokensFromText`; conservative so estimates over-count. */
const CHARS_PER_TOKEN = 1.5;
/** OpenAI-compatible statuses that never carry a completion, so the provider did not accept the request. */
const NOT_ACCEPTED_STATUSES = new Set([400, 401, 403, 404, 413, 422, 429]);
const SAFE_MODEL_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,190}$/u;

export class GovernedDashScopeAdapterError extends Error {
  readonly reason: string;
  constructor(reason: string) { super(reason); this.name = "GovernedDashScopeAdapterError"; this.reason = reason; }
}
function refuse(reason: string): never { throw new GovernedDashScopeAdapterError(reason); }

export type GovernedDashScopeCredentialResolver = (credentialRef: string) => Promise<string>;

export type GovernedDashScopeAdapter = GovernedModelProviderAdapter<CaioInferenceInput, CaioLayeredJudgement>;

function parseEndpoint(endpoint: string): { origin: string; path: string; url: URL } {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return refuse("dashscope_endpoint_invalid");
  }
  if (
    url.username || url.password || url.hash || url.search ||
    !(url.protocol === "https:" || (url.protocol === "http:" && url.hostname === "127.0.0.1"))
  ) refuse("dashscope_endpoint_invalid");
  return { origin: url.origin, path: url.pathname.replace(/\/+$/u, ""), url };
}

/** `sha256(canonicalJson({schema, origin, path}))` over the normalized endpoint; the same shape the ordinary adapter pins. */
export function computeGovernedDashScopeEndpointFingerprint(endpoint: string): string {
  const { origin, path } = parseEndpoint(endpoint);
  return sha256(canonicalJson({ schema: GOVERNED_DASHSCOPE_ENDPOINT_FINGERPRINT_SCHEMA, origin, path }));
}

const PROMPT_CONTRACT_FIXTURE: CaioInferenceInput = Object.freeze({
  schemaVersion: CAIO_INFERENCE_INPUT_SCHEMA_VERSION, workspaceId: "workspace", taskClass: "hourly_diagnosis",
  windowStart: "1970-01-01T00:00:00.000Z", windowEnd: "1970-01-01T01:00:00.000Z", snapshotRefs: [], evidenceRefs: [], supplements: [],
}) as CaioInferenceInput;
const PROMPT_FIXED_OVERHEAD_CHARS = buildCaioInferencePrompt(PROMPT_CONTRACT_FIXTURE).length;

/**
 * Hash of what this adapter sends: transport contract, request constants, wire schema and prompt contract. A
 * change to any of them changes the registration hash, so routes and readiness receipts pinned to the old
 * registration fail closed until they are re-probed.
 */
export function computeGovernedDashScopeImplementationHash(): string {
  return sha256(canonicalJson({
    adapterKey: GOVERNED_DASHSCOPE_ADAPTER_KEY, adapterVersion: GOVERNED_DASHSCOPE_ADAPTER_VERSION, transport: TRANSPORT_CONTRACT,
    request: { temperature: 0, stream: false, enable_thinking: false, responseFormatName: GOVERNED_DASHSCOPE_RESPONSE_FORMAT_NAME, strict: true },
    responseSchema: CAIO_LAYERED_JUDGEMENT_JSON_SCHEMA, promptContractHash: sha256(buildCaioInferencePrompt(PROMPT_CONTRACT_FIXTURE)),
  }));
}

export function buildGovernedDashScopeAdapterRegistration(input: {
  registrationRef: string; supportedDeploymentForms?: readonly ModelDeploymentForm[];
}): GovernedModelAdapterRegistration {
  const candidate: GovernedModelAdapterRegistration = {
    schemaVersion: "helm.governed-model-adapter-registration/v1", registrationRef: input.registrationRef,
    adapterKey: GOVERNED_DASHSCOPE_ADAPTER_KEY, adapterVersion: GOVERNED_DASHSCOPE_ADAPTER_VERSION, provider: GOVERNED_DASHSCOPE_PROVIDER,
    implementationHash: computeGovernedDashScopeImplementationHash(),
    supportedDeploymentForms: [...(input.supportedDeploymentForms ?? ["domestic_cloud"])],
    authorityEffect: "adapter_registry_only", contentHash: "sha256:pending",
  };
  return { ...candidate, contentHash: computeGovernedModelAdapterRegistrationHash(candidate) };
}

type TransportResult = { kind: "response"; status: number; bytes: Buffer } | { kind: "timeout" | "aborted" | "too_large" | "error" };

function send(input: {
  url: URL; credential: string; body: Buffer | null; timeoutMs: number; maximumBytes: number; signal?: AbortSignal;
}): Promise<TransportResult> {
  return new Promise<TransportResult>((resolve) => {
    let settled = false;
    const finish = (result: TransportResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      input.signal?.removeEventListener("abort", onAbort);
      if (result.kind !== "response") req.destroy();
      resolve(result);
    };
    const headers: Record<string, string> = { authorization: `Bearer ${input.credential}`, accept: "application/json" };
    if (input.body) {
      headers["content-type"] = "application/json";
      headers["content-length"] = String(input.body.length);
    }
    // No redirect following, no retry, no keep-alive: one bounded exchange per call.
    const req = (input.url.protocol === "https:" ? httpsRequest : httpRequest)(
      input.url, { method: input.body ? "POST" : "GET", agent: false, headers }, (res) => {
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          // Settle before destroying: tearing the socket down emits errors that must not relabel the result.
          if (size > input.maximumBytes) finish({ kind: "too_large" }); else chunks.push(Buffer.from(chunk));
        });
        res.on("end", () => finish({ kind: "response", status: res.statusCode ?? 0, bytes: Buffer.concat(chunks) }));
        res.on("error", () => finish({ kind: "error" }));
        res.on("aborted", () => finish({ kind: "error" }));
      });
    const onAbort = () => finish({ kind: "aborted" });
    const timer = setTimeout(() => finish({ kind: "timeout" }), input.timeoutMs);
    req.on("error", () => finish({ kind: "error" }));
    input.signal?.addEventListener("abort", onAbort, { once: true });
    if (input.signal?.aborted) onAbort(); else req.end(input.body ?? undefined);
  });
}

function decodeJson(bytes: Buffer): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function readRequestRef(body: Record<string, unknown> | null): string | null {
  for (const key of ["id", "request_id"]) {
    const value = body?.[key];
    if (typeof value === "string" && value.trim().length > 0 && value.length <= MAX_PROVIDER_REF_LENGTH) return value.trim();
  }
  return null;
}

function readUsage(body: Record<string, unknown> | null): { prompt: number; completion: number } | null {
  const usage = body?.usage;
  if (!usage || typeof usage !== "object") return null;
  const { prompt_tokens: prompt, completion_tokens: completion } = usage as Record<string, unknown>;
  const valid = (value: unknown): value is number =>
    typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= MODEL_GOVERNANCE_PERSISTED_INT_MAX;
  return valid(prompt) && valid(completion) ? { prompt, completion } : null;
}

function costUsdMicros(modelId: string, promptTokens: number, completionTokens: number): number {
  const price = resolveTokenCost(GOVERNED_DASHSCOPE_PROVIDER, modelId);
  // USD per million tokens times tokens is exactly USD micro-units.
  return Math.ceil(promptTokens * price.inputPerMillion + completionTokens * price.outputPerMillion);
}

function costBand(micros: number, maxCostUsdMicros: number): ModelEgressCostBand {
  if (micros === 0) return "zero";
  if (micros * 4 <= maxCostUsdMicros) return "low";
  if (micros * 4 <= maxCostUsdMicros * 3) return "medium";
  return "high";
}

/** The exact id sent as `model`: the route's snapshot id when its modelVersion is one (`<modelId>-<suffix>`), else the model id. */
export function governedDashScopeRequestModel(route: Pick<TenantModelRoute, "modelId" | "modelVersion">): string {
  return route.modelVersion.startsWith(`${route.modelId}-`) && SAFE_MODEL_ID_PATTERN.test(route.modelVersion) ? route.modelVersion : route.modelId;
}

function routeBinding(registration: GovernedModelAdapterRegistration, route: TenantModelRoute): string | null {
  if (route.adapterKey !== registration.adapterKey) return "dashscope_route_adapter_mismatch";
  if (route.provider !== registration.provider) return "dashscope_route_provider_mismatch";
  if (!registration.supportedDeploymentForms.includes(route.deploymentForm)) return "dashscope_route_deployment_form_unsupported";
  if (!SAFE_MODEL_ID_PATTERN.test(route.modelId)) return "dashscope_route_model_id_invalid";
  return null;
}

export function createGovernedDashScopeAdapter(provided: {
  registration: GovernedModelAdapterRegistration; endpoint: string; endpointFingerprint: string;
  resolveCredential: GovernedDashScopeCredentialResolver; timeoutMs: number; maximumResponseBytes: number; now?: () => Date;
}): GovernedDashScopeAdapter {
  const candidate = JSON.parse(canonicalJson(provided.registration)) as GovernedModelAdapterRegistration;
  if (!validateGovernedModelAdapterRegistration(candidate).valid) refuse("dashscope_registration_invalid");
  // The registration must describe this code: provider keys the price table, the key names this adapter and
  // the implementation hash binds prompt, schema and request constants.
  if (
    candidate.provider !== GOVERNED_DASHSCOPE_PROVIDER || candidate.adapterKey !== GOVERNED_DASHSCOPE_ADAPTER_KEY ||
    candidate.adapterVersion !== GOVERNED_DASHSCOPE_ADAPTER_VERSION ||
    candidate.implementationHash !== computeGovernedDashScopeImplementationHash()
  ) refuse("dashscope_registration_binding_invalid");
  const registration = Object.freeze({ ...candidate, supportedDeploymentForms: Object.freeze([...candidate.supportedDeploymentForms]) });
  if (
    !Number.isSafeInteger(provided.timeoutMs) || provided.timeoutMs < 1 || provided.timeoutMs > MAX_TIMEOUT_MS ||
    !Number.isSafeInteger(provided.maximumResponseBytes) || provided.maximumResponseBytes < 1 || provided.maximumResponseBytes > MAX_RESPONSE_BYTES
  ) refuse("dashscope_transport_bounds_invalid");
  const { origin, path } = parseEndpoint(provided.endpoint);
  const fingerprint = computeGovernedDashScopeEndpointFingerprint(provided.endpoint);
  if (fingerprint !== provided.endpointFingerprint) refuse("dashscope_endpoint_binding_invalid");
  const modelsUrl = new URL(`${origin}${path}/models`);
  const completionsUrl = new URL(`${origin}${path}/chat/completions`);
  const timeoutMs = provided.timeoutMs, maximumBytes = provided.maximumResponseBytes;
  const resolveCredential = provided.resolveCredential;
  const now = provided.now ?? (() => new Date());
  const attempted = new Set<string>();

  async function credential(credentialRef: string): Promise<string> {
    let value: string;
    try {
      value = await resolveCredential(credentialRef);
    } catch {
      return refuse("dashscope_credential_unavailable");
    }
    if (typeof value !== "string" || value.length < 1 || value.length > MAX_CREDENTIAL_LENGTH || /\s/u.test(value)) {
      refuse("dashscope_credential_unavailable");
    }
    return value;
  }

  function notAccepted(route: TenantModelRoute, errorCode: string): GovernedModelAdapterResult<CaioLayeredJudgement> {
    // Nothing reached the provider, or the provider refused without a completion: zero usage is observed, not inferred.
    return { outcome: "failure", requestDisposition: "not_accepted", providerRequestRef: null, promptTokens: 0, completionTokens: 0,
      actualCostUsdMicros: 0, costCurrency: "USD", pricingVersion: route.pricingVersion, costBand: "zero", errorCode };
  }
  function unknown(errorCode: string, providerRequestRef: string | null = null, usage: { prompt: number; completion: number } | null = null): GovernedModelAdapterResult<CaioLayeredJudgement> {
    return { outcome: "unknown", requestDisposition: "unknown", providerRequestRef, promptTokens: usage?.prompt ?? null,
      completionTokens: usage?.completion ?? null, actualCostUsdMicros: null, costCurrency: null, pricingVersion: null, costBand: "unknown", errorCode };
  }

  return {
    registration,
    async probeReadiness({ route }): Promise<GovernedModelReadinessProbeObservation> {
      const checkedAt = now();
      const observation = (credentialConfigured: boolean, modelProbeStatus: "ready" | "not_ready", capabilityRefs: string[], evidenceRefs: string[]) => ({
        endpointFingerprint: fingerprint, credentialConfigured, modelProbeStatus, capabilityRefs, evidenceRefs,
        checkedAt: checkedAt.toISOString(), expiresAt: new Date(checkedAt.getTime() + READINESS_TTL_MS).toISOString(),
      });
      const binding = routeBinding(registration, route);
      if (binding) return observation(false, "not_ready", [], [`dashscope-probe:${binding}`]);
      let secret: string;
      try {
        secret = await credential(route.credentialRef);
      } catch {
        return observation(false, "not_ready", [], ["dashscope-probe:credential_unavailable"]);
      }
      const result = await send({ url: modelsUrl, credential: secret, body: null, timeoutMs, maximumBytes });
      secret = "";
      if (result.kind !== "response") return observation(true, "not_ready", [], [`dashscope-probe:transport_${result.kind}`]);
      const digestRef = `dashscope-models-digest:${sha256(result.bytes.toString("base64")).slice("sha256:".length)}`;
      if (result.status !== 200) return observation(true, "not_ready", [], [`dashscope-probe:http_${result.status}`, digestRef]);
      const body = decodeJson(result.bytes);
      const ids = new Set(Array.isArray(body?.data) ? (body!.data as unknown[]).map((entry) => (entry as { id?: unknown } | null)?.id) : []);
      // Prefer the exact id the adapter will send; fall back to the family id when the list names only families.
      const listed = [governedDashScopeRequestModel(route), route.modelId].find((id) => ids.has(id));
      if (!listed) return observation(true, "not_ready", [], ["dashscope-probe:model_not_listed", digestRef]);
      // Only presence on the live list is proven: no claim about schema support, thinking control or quota.
      return observation(true, "ready", [`dashscope-model:${listed}`], [digestRef]);
    },
    async preflight({ route, projectedPayloadBytes, requestedMaxOutputTokens }) {
      const binding = routeBinding(registration, route);
      if (binding) refuse(binding);
      if (route.pricingVersion !== PRICING_TABLE_VERSION) refuse("dashscope_pricing_version_mismatch");
      if (!Number.isSafeInteger(projectedPayloadBytes) || projectedPayloadBytes < 0 || projectedPayloadBytes > MAX_PAYLOAD_BYTES) refuse("dashscope_payload_bytes_invalid");
      if (!Number.isSafeInteger(requestedMaxOutputTokens) || requestedMaxOutputTokens < 1) refuse("dashscope_output_budget_invalid");
      let credentialConfigured = false;
      try {
        await credential(route.credentialRef);
        credentialConfigured = true;
      } catch { /* reported, not thrown: the store refuses the claim on a missing credential */ }
      const estimatedInputTokens = Math.ceil((projectedPayloadBytes + PROMPT_FIXED_OVERHEAD_CHARS) / CHARS_PER_TOKEN);
      const estimatedMaxCostUsdMicros = costUsdMicros(route.modelId, estimatedInputTokens, requestedMaxOutputTokens);
      if (estimatedMaxCostUsdMicros > MODEL_GOVERNANCE_PERSISTED_INT_MAX) refuse("dashscope_cost_out_of_range");
      return { endpointFingerprint: fingerprint, credentialConfigured, observedAt: now().toISOString(), estimatedInputTokens, estimatedMaxCostUsdMicros };
    },
    async invoke(call) {
      const route = call.route;
      const binding = routeBinding(registration, route);
      if (binding) return notAccepted(route, binding);
      if (route.pricingVersion !== PRICING_TABLE_VERSION) return notAccepted(route, "dashscope_pricing_version_mismatch");
      const payloadText = canonicalJson(call.projectedPayload);
      if (Buffer.byteLength(payloadText, "utf8") > MAX_PAYLOAD_BYTES || sha256(payloadText) !== call.projectedPayloadHash) {
        return notAccepted(route, "dashscope_payload_binding_invalid");
      }
      const payload = JSON.parse(payloadText) as CaioInferenceInput;
      if (payload.schemaVersion !== CAIO_INFERENCE_INPUT_SCHEMA_VERSION || !Array.isArray(payload.evidenceRefs)) {
        return notAccepted(route, "dashscope_payload_schema_invalid");
      }
      if (!Number.isSafeInteger(call.requestedMaxOutputTokens) || call.requestedMaxOutputTokens < 1) return notAccepted(route, "dashscope_output_budget_invalid");
      // One send per claim: a second invoke under the same key cannot know what the first one did.
      const tag = sha256(canonicalJson({ workspaceId: call.workspaceId, key: call.providerIdempotencyKey }));
      if (attempted.size >= MAX_ATTEMPTED_KEYS || attempted.has(tag)) refuse("dashscope_dispatch_already_attempted");
      if (call.signal.aborted) return notAccepted(route, "dashscope_aborted_before_send");
      let secret: string;
      try {
        secret = await credential(route.credentialRef);
      } catch {
        return notAccepted(route, "dashscope_credential_unavailable");
      }
      const requestModel = governedDashScopeRequestModel(route);
      const requestBytes = Buffer.from(JSON.stringify({
        model: requestModel,
        messages: [{ role: "user", content: buildCaioInferencePrompt(payload) }],
        temperature: 0,
        max_completion_tokens: call.requestedMaxOutputTokens,
        stream: false,
        // Hybrid Qwen models default to thinking; structured output requires it off.
        enable_thinking: false,
        response_format: { type: "json_schema", json_schema: { name: GOVERNED_DASHSCOPE_RESPONSE_FORMAT_NAME, schema: CAIO_LAYERED_JUDGEMENT_JSON_SCHEMA, strict: true } },
      }), "utf8");
      if (requestBytes.length > MAX_REQUEST_BYTES) return notAccepted(route, "dashscope_request_too_large");
      attempted.add(tag);
      const result = await send({ url: completionsUrl, credential: secret, body: requestBytes, timeoutMs, maximumBytes, signal: call.signal });
      secret = "";
      if (result.kind !== "response") {
        return unknown(result.kind === "too_large" ? "dashscope_response_too_large" : `dashscope_transport_${result.kind}`);
      }
      const body = decodeJson(result.bytes);
      const providerRequestRef = readRequestRef(body);
      const usage = readUsage(body);
      if (result.status < 200 || result.status >= 300) {
        const errorCode = `dashscope_http_${result.status}`;
        return NOT_ACCEPTED_STATUSES.has(result.status) && usage === null ? notAccepted(route, errorCode) : unknown(errorCode, providerRequestRef, usage);
      }
      if (!body) return unknown("dashscope_response_not_json");
      if (!usage) return unknown("dashscope_usage_missing", providerRequestRef);
      if (!providerRequestRef) return unknown("dashscope_request_ref_missing", null, usage);
      const actualCostUsdMicros = costUsdMicros(route.modelId, usage.prompt, usage.completion);
      if (actualCostUsdMicros > MODEL_GOVERNANCE_PERSISTED_INT_MAX) return unknown("dashscope_cost_out_of_range", providerRequestRef, usage);
      const accepted = (errorCode: string | null, output?: CaioLayeredJudgement): GovernedModelAdapterResult<CaioLayeredJudgement> => ({
        outcome: output ? "success" : "failure", ...(output ? { output } : {}), requestDisposition: "accepted", providerRequestRef,
        promptTokens: usage.prompt, completionTokens: usage.completion, actualCostUsdMicros, costCurrency: "USD",
        pricingVersion: PRICING_TABLE_VERSION, costBand: costBand(actualCostUsdMicros, route.maxCostUsdMicros), errorCode,
      });
      if (typeof body.model === "string" && body.model !== requestModel) return accepted("dashscope_model_mismatch");
      const choice = Array.isArray(body.choices) ? (body.choices[0] as Record<string, unknown> | undefined) : undefined;
      if (choice?.finish_reason === "length") return accepted("dashscope_output_truncated");
      const content = choice?.message && typeof choice.message === "object" ? (choice.message as { content?: unknown }).content : undefined;
      if (typeof content !== "string") return accepted("dashscope_output_missing");
      let parsedOutput: unknown;
      try {
        parsedOutput = JSON.parse(content);
      } catch {
        return accepted("dashscope_output_not_json");
      }
      const validation = validateCaioLayeredJudgement(parsedOutput, new Set(payload.evidenceRefs));
      if (!validation.ok) return accepted(`dashscope_output_${validation.code}`);
      return accepted(null, validation.value);
    },
  };
}
