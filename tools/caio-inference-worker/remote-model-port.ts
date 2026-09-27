import { CAIO_LAYERED_JUDGEMENT_JSON_SCHEMA } from "@/lib/caio-inference/layered-judgement";

import type { CaioWorkerModelCompletion, CaioWorkerModelPort } from "./contracts";
import { isTokenCount, readOpenAiUsage } from "./local-model-port";

/**
 * Remote model ports for the device worker.
 *
 * The local port's loopback lock is NOT relaxed: a remote provider is a separate port, selected only by an
 * explicit `provider` in the worker's owner-private config, and each provider accepts exactly one https host.
 * What leaves the device is the prompt built from the frozen, closed-schema inference input (snapshot ids,
 * hashes, evidence refs, aggregate counts) — the same payload the governed egress decision already admitted
 * for a remote route. The API key comes only from a 0600 file; neither the key nor any request/response body
 * is logged or echoed into an error.
 */
export const CAIO_WORKER_REMOTE_PROVIDERS = ["anthropic-messages", "openai-chat-completions"] as const;
export type CaioWorkerRemoteProvider = (typeof CAIO_WORKER_REMOTE_PROVIDERS)[number];

const PROVIDER_ORIGIN: Readonly<Record<CaioWorkerRemoteProvider, string>> = {
  "anthropic-messages": "https://api.anthropic.com",
  "openai-chat-completions": "https://api.openai.com",
};
const ANTHROPIC_VERSION = "2023-06-01";
const MAX_RESPONSE_BYTES = 1024 * 1024;
const MODEL_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/u;
const PROVIDER_REQUEST_REF_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/u;
export const CAIO_WORKER_ANTHROPIC_EFFORTS = ["low", "medium", "high"] as const;

export type CaioWorkerRemoteModelConfig = Readonly<{
  provider: CaioWorkerRemoteProvider;
  /** Must be exactly the provider's origin plus `/v1`; anything else is refused. */
  baseUrl: string;
  model: string;
  apiKey: string;
  /** Anthropic only: thinking cannot be disabled on current Opus models; effort bounds its token spend. */
  effort?: (typeof CAIO_WORKER_ANTHROPIC_EFFORTS)[number];
  probeTimeoutMs?: number;
  completeTimeoutMs?: number;
  fetchImpl?: typeof fetch;
}>;

/** True when `baseUrl` is exactly the provider's https API root. Used by config loading and by the port. */
export function isRemoteProviderBaseUrl(provider: CaioWorkerRemoteProvider, baseUrl: string): boolean {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    return false;
  }
  return (
    url.protocol === "https:" &&
    url.origin === PROVIDER_ORIGIN[provider] &&
    url.username === "" &&
    url.password === "" &&
    url.port === "" &&
    url.search === "" &&
    url.hash === "" &&
    url.pathname.replace(/\/+$/u, "") === "/v1"
  );
}

export function createCaioWorkerRemoteModelPort(config: CaioWorkerRemoteModelConfig): CaioWorkerModelPort {
  if (!(CAIO_WORKER_REMOTE_PROVIDERS as readonly string[]).includes(config.provider)) {
    throw new Error("invalid caio worker remote model: provider not supported");
  }
  if (!isRemoteProviderBaseUrl(config.provider, config.baseUrl)) {
    throw new Error("invalid caio worker remote model: baseUrl must be the provider's https API root");
  }
  if (!MODEL_ID_RE.test(config.model)) throw new Error("invalid caio worker remote model: model id");
  if (typeof config.apiKey !== "string" || config.apiKey.length < 16 || config.apiKey.length > 4_096 || /\s/u.test(config.apiKey)) {
    throw new Error("invalid caio worker remote model access");
  }
  if (config.effort !== undefined && !(CAIO_WORKER_ANTHROPIC_EFFORTS as readonly string[]).includes(config.effort)) {
    throw new Error("invalid caio worker remote model: effort");
  }
  const base = `${PROVIDER_ORIGIN[config.provider]}/v1`;
  const doFetch = config.fetchImpl ?? fetch;
  const probeTimeoutMs = config.probeTimeoutMs ?? 10_000;
  const completeTimeoutMs = config.completeTimeoutMs ?? 300_000;
  const anthropic = config.provider === "anthropic-messages";
  const authHeaders: Record<string, string> = anthropic
    ? { "x-api-key": config.apiKey, "anthropic-version": ANTHROPIC_VERSION }
    : { authorization: `Bearer ${config.apiKey}` };

  return Object.freeze({
    probe: async ({ signal }) => {
      try {
        const response = await withDeadline(
          (deadlineSignal) =>
            doFetch(`${base}/models/${encodeURIComponent(config.model)}`, {
              method: "GET",
              headers: authHeaders,
              signal: deadlineSignal,
            }),
          probeTimeoutMs,
          signal,
        );
        // 404 = the configured model id does not exist for this key; anything non-2xx means not ready.
        if (!response.ok) return { ready: false, detail: `models_status_${response.status}` };
        await response.body?.cancel();
        return { ready: true };
      } catch (error) {
        return { ready: false, detail: error instanceof Error && error.name === "AbortError" ? "probe_timeout" : "probe_failed" };
      }
    },
    complete: async ({ prompt, maxOutputTokens, signal }) => {
      if (!prompt) throw new Error("caio_worker_remote_model_prompt_empty");
      if (!Number.isInteger(maxOutputTokens) || maxOutputTokens < 1) throw new Error("caio_worker_remote_model_budget_invalid");
      // Neither body sets temperature: current Opus models reject sampling parameters, and some OpenAI models
      // reject a non-default temperature. Determinism is not claimed for remote providers.
      const body = anthropic
        ? {
            model: config.model,
            max_tokens: maxOutputTokens,
            ...(config.effort ? { output_config: { effort: config.effort } } : {}),
            messages: [{ role: "user", content: prompt }],
          }
        : {
            model: config.model,
            max_completion_tokens: maxOutputTokens,
            messages: [{ role: "user", content: prompt }],
            // Strict structured output: the model cannot emit an extra key or a missing layer, which would
            // otherwise cost a paid call that the server then refuses as malformed_output.
            response_format: {
              type: "json_schema",
              json_schema: { name: "caio_layered_judgement", strict: true, schema: CAIO_LAYERED_JUDGEMENT_JSON_SCHEMA },
            },
          };
      const response = await withDeadline(
        (deadlineSignal) =>
          doFetch(anthropic ? `${base}/messages` : `${base}/chat/completions`, {
            method: "POST",
            headers: { ...authHeaders, "content-type": "application/json; charset=utf-8" },
            body: JSON.stringify(body),
            signal: deadlineSignal,
          }),
        completeTimeoutMs,
        signal,
      );
      if (!response.ok) throw new Error(`caio_worker_remote_model_status:${response.status}`);
      const text = await readBounded(response);
      return anthropic ? parseAnthropic(text) : parseOpenAi(text);
    },
  });
}

function parseJsonBody(text: string): Record<string, unknown> {
  let body: unknown;
  try {
    body = JSON.parse(text) as unknown;
  } catch {
    throw new Error("caio_worker_remote_model_response_not_json");
  }
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("caio_worker_remote_model_response_shape_invalid");
  }
  return body as Record<string, unknown>;
}

function requestRef(value: unknown): string | null {
  return typeof value === "string" && PROVIDER_REQUEST_REF_RE.test(value) ? value : null;
}

/** Anthropic Messages: concatenated `text` blocks (thinking blocks are ignored); refusals fail closed. */
function parseAnthropic(text: string): CaioWorkerModelCompletion {
  const body = parseJsonBody(text);
  if (body.stop_reason === "refusal") throw new Error("caio_worker_remote_model_refused");
  const blocks = Array.isArray(body.content) ? body.content : [];
  const content = blocks
    .filter((block): block is { type: "text"; text: string } =>
      !!block && typeof block === "object" && (block as { type?: unknown }).type === "text" && typeof (block as { text?: unknown }).text === "string")
    .map((block) => block.text)
    .join("");
  if (content.trim().length === 0) throw new Error("caio_worker_remote_model_response_empty");
  const usage = body.usage as { input_tokens?: unknown; output_tokens?: unknown } | undefined;
  return {
    content,
    usage:
      isTokenCount(usage?.input_tokens) && isTokenCount(usage?.output_tokens)
        ? { inputTokens: usage.input_tokens, outputTokens: usage.output_tokens }
        : null,
    providerRequestRef: requestRef(body.id),
  };
}

/** OpenAI Chat Completions: `choices[0].message.content`, `usage.prompt_tokens/completion_tokens`, `id`. */
function parseOpenAi(text: string): CaioWorkerModelCompletion {
  const body = parseJsonBody(text);
  const choices = body.choices;
  if (!Array.isArray(choices) || choices.length === 0) throw new Error("caio_worker_remote_model_response_shape_invalid");
  const message = (choices[0] as { message?: { content?: unknown; refusal?: unknown } }).message;
  if (typeof message?.refusal === "string" && message.refusal.length > 0) throw new Error("caio_worker_remote_model_refused");
  const content = message?.content;
  if (typeof content !== "string" || content.trim().length === 0) throw new Error("caio_worker_remote_model_response_empty");
  return { content, usage: readOpenAiUsage(body), providerRequestRef: requestRef(body.id) };
}

async function withDeadline<T>(run: (signal: AbortSignal) => Promise<T>, timeoutMs: number, external?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("deadline")), timeoutMs);
  const onExternalAbort = () => controller.abort(new Error("aborted"));
  external?.addEventListener("abort", onExternalAbort, { once: true });
  try {
    return await run(controller.signal);
  } finally {
    clearTimeout(timer);
    external?.removeEventListener("abort", onExternalAbort);
  }
}

async function readBounded(response: Response): Promise<string> {
  const text = await response.text();
  if (Buffer.byteLength(text, "utf8") > MAX_RESPONSE_BYTES) throw new Error("caio_worker_remote_model_response_too_large");
  return text;
}
