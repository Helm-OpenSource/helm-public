import {
  getOpenAICompatibleApiKey,
  getOpenAICompatibleBaseUrl,
  isLLMProviderConfigured,
} from "@/lib/llm/config";
import { sanitizeLlmTracePayload } from "@/lib/llm/trace-sanitizer";
import type { LLMProvider, LLMProviderAdapter, LLMResolvedTask, LLMTaskType } from "@/lib/llm/types";
import { Agent, ProxyAgent, Socks5ProxyAgent, type Dispatcher } from "undici";

type OpenAIChatCompletionResponse = {
  choices?: Array<{
    finish_reason?: string;
    message?: {
      content?: string | Array<{ type: string; text?: string }>;
      reasoning_content?: string;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: {
    message?: string;
    type?: string;
    code?: string;
  };
};

type ChatMessageContent = string | Array<{ type: string; text?: string }> | undefined;

let proxyDispatcher: Dispatcher | null | undefined;
const directDispatchersByTimeout = new Map<number, Dispatcher>();
const DEFAULT_LLM_TIMEOUT_MS = 6_000;
const DEFAULT_REASONING_TIMEOUT_MS = 120_000;
const DEFAULT_ASSIGNMENT_TIMEOUT_MS = 600_000;

function logLlmTrace(event: string, payload: Record<string, unknown>) {
  try {
    console.info(`[LLM trace] ${event} ${JSON.stringify(sanitizeLlmTracePayload(payload))}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[LLM trace] ${event} serialization_failed: ${message}`);
  }
}

function toContentString(content: ChatMessageContent) {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => item?.text || "")
      .join("\n")
      .trim();
  }

  return "";
}

function getProxyUrl() {
  return (
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy ||
    process.env.ALL_PROXY ||
    process.env.all_proxy ||
    null
  );
}

function getProxyDispatcher() {
  if (proxyDispatcher !== undefined) {
    return proxyDispatcher;
  }

  const proxyUrl = getProxyUrl();
  if (!proxyUrl) {
    proxyDispatcher = null;
    return proxyDispatcher;
  }

  proxyDispatcher = proxyUrl.startsWith("socks5://")
    ? new Socks5ProxyAgent(proxyUrl)
    : new ProxyAgent(proxyUrl);
  return proxyDispatcher;
}

function getDirectDispatcher(timeoutMs: number) {
  const cached = directDispatchersByTimeout.get(timeoutMs);
  if (cached) {
    return cached;
  }

  const dispatcher = new Agent({
    connectTimeout: Math.min(timeoutMs, 30_000),
    headersTimeout: timeoutMs + 60_000,
    bodyTimeout: timeoutMs + 60_000,
  });
  directDispatchersByTimeout.set(timeoutMs, dispatcher);
  return dispatcher;
}

function parseTimeoutMs(raw: string | undefined, fallback: number) {
  if (!raw) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

/**
 * Strip userinfo from a URL before it goes into a thrown error or log line.
 * Some self-hosted gateways encode auth material in the base URL; without
 * sanitisation that material can end up in logs and bubble back to the caller.
 */
function sanitizeUrlForError(rawUrl: string) {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.username || parsed.password) {
      parsed.username = "";
      parsed.password = "";
      return parsed.toString();
    }
    return rawUrl;
  } catch {
    return rawUrl;
  }
}

function toTraceTextLength(content: ChatMessageContent) {
  return toContentString(content).length;
}

export function summarizeChatRequestForTrace(requestBody: {
  model?: unknown;
  temperature?: unknown;
  max_completion_tokens?: unknown;
  messages?: unknown;
  response_format?: unknown;
  user?: unknown;
}) {
  const messages = Array.isArray(requestBody.messages) ? requestBody.messages : [];
  return {
    model: requestBody.model,
    temperature: requestBody.temperature,
    maxCompletionTokens: requestBody.max_completion_tokens,
    messageCount: messages.length,
    messageRoles: messages
      .map((message) =>
        message && typeof message === "object" && "role" in message
          ? String((message as { role?: unknown }).role ?? "")
          : "",
      )
      .filter(Boolean),
    responseFormat:
      requestBody.response_format && typeof requestBody.response_format === "object"
        ? {
            type: (requestBody.response_format as { type?: unknown }).type,
            schemaName:
              "json_schema" in requestBody.response_format &&
              requestBody.response_format.json_schema &&
              typeof requestBody.response_format.json_schema === "object"
                ? (requestBody.response_format.json_schema as { name?: unknown }).name
                : undefined,
          }
        : requestBody.response_format,
    userPresent: Boolean(requestBody.user),
  };
}

export function summarizeChatResponseForTrace(payload: OpenAIChatCompletionResponse) {
  const choices = Array.isArray(payload.choices) ? payload.choices : [];
  return {
    choiceCount: choices.length,
    finishReasons: choices.map((choice) => choice.finish_reason).filter(Boolean),
    outputTextLengths: choices.map((choice) => toTraceTextLength(choice.message?.content)),
    reasoningContentPresent: choices.some((choice) => Boolean(choice.message?.reasoning_content)),
    usage: payload.usage
      ? {
          promptTokens: payload.usage.prompt_tokens,
          completionTokens: payload.usage.completion_tokens,
          totalTokens: payload.usage.total_tokens,
        }
      : undefined,
    error: payload.error
      ? {
          message: payload.error.message,
          type: payload.error.type,
          code: payload.error.code,
        }
      : undefined,
  };
}

function getRequestTimeoutMs(taskType: LLMTaskType) {
  const isExternalCaseAssignment =
    taskType === "EXTERNAL_CASE_ASSIGNMENT" ||
    taskType === "EXTERNAL_CASE_ASSIGNMENT_ACTION_BRIEFING" ||
    taskType === "EXTERNAL_EMPLOYEE_SIGNAL_ACTION_BRIEFING" ||
    taskType === "EXTERNAL_EMPLOYEE_SIGNAL_OWNER_ROUTING";

  const defaultTimeout = isExternalCaseAssignment
    ? DEFAULT_ASSIGNMENT_TIMEOUT_MS
    : taskType === "BI_REPORT_ANALYSIS" || taskType === "BI_REPORT_REVIEW"
      ? DEFAULT_REASONING_TIMEOUT_MS
      : DEFAULT_LLM_TIMEOUT_MS;

  const taskSpecificEnvName = isExternalCaseAssignment
    ? "LLM_HTTP_TIMEOUT_MS_EXTERNAL_CASE_ASSIGNMENT"
    : taskType === "BI_REPORT_ANALYSIS" || taskType === "BI_REPORT_REVIEW"
      ? "LLM_HTTP_TIMEOUT_MS_REASONING"
      : "LLM_HTTP_TIMEOUT_MS";

  return parseTimeoutMs(
    process.env[taskSpecificEnvName] ?? process.env.LLM_HTTP_TIMEOUT_MS,
    defaultTimeout,
  );
}

export function createOpenAICompatibleAdapter(input: {
  provider: LLMProvider;
  label: string;
  audioTranscription: boolean;
}): LLMProviderAdapter {
  return {
    provider: input.provider,
    label: input.label,
    capabilities: {
      structuredOutput: true,
      configurableBaseUrl: true,
      audioTranscription: input.audioTranscription,
    },
    isConfigured: () => isLLMProviderConfigured(input.provider),
    async run<TOutput>(taskInput: LLMResolvedTask<TOutput>) {
      const baseUrl = getOpenAICompatibleBaseUrl(input.provider);
      const apiKey = getOpenAICompatibleApiKey(input.provider);
      const requestBody = {
        model: taskInput.model,
        temperature: taskInput.temperature ?? 0.2,
        max_completion_tokens: taskInput.maxOutputTokens ?? 900,
        messages: [
          { role: "system", content: taskInput.systemPrompt },
          { role: "user", content: taskInput.userPrompt },
        ],
        ...(taskInput.outputMode === "json"
          ? taskInput.jsonSchema
            ? {
                response_format: {
                  type: "json_schema",
                  json_schema: {
                    name: taskInput.taskType.toLowerCase(),
                    schema: taskInput.jsonSchema,
                    strict: false,
                  },
                },
              }
            : {
                response_format: {
                  type: "json_object",
                },
              }
          : {}),
        user: taskInput.userId ?? undefined,
      };

      const endpoint = `${baseUrl}/chat/completions`;
      const timeoutMs = getRequestTimeoutMs(taskInput.taskType);
      logLlmTrace("chat_request", {
        provider: input.provider,
        endpoint: sanitizeUrlForError(endpoint),
        timeoutMs,
        taskType: taskInput.taskType,
        promptKey: taskInput.promptKey,
        promptVersion: taskInput.promptVersion,
        request: summarizeChatRequestForTrace(requestBody),
        hasApiKey: Boolean(apiKey),
      });

      let response: Response;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const requestInit: RequestInit & { dispatcher?: Dispatcher } = {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        };
        const dispatcher = getProxyDispatcher() ?? getDirectDispatcher(timeoutMs);
        requestInit.dispatcher = dispatcher;
        response = await fetch(endpoint, requestInit);
      } catch (error) {
        const err = error as Error & { cause?: unknown };
        const causeText =
          err?.cause instanceof Error
            ? `${err.cause.name}: ${err.cause.message}`
            : err?.cause
              ? String(err.cause)
              : "n/a";
        logLlmTrace("chat_transport_error", {
          provider: input.provider,
          endpoint: sanitizeUrlForError(endpoint),
          taskType: taskInput.taskType,
          errorName: err?.name || "Error",
          errorMessage: err?.message || "unknown",
          cause: causeText,
        });
        throw new Error(
          `OpenAI-compatible fetch failed for ${sanitizeUrlForError(baseUrl)}/chat/completions: ${err?.name || "Error"}: ${err?.message || "unknown"}; cause: ${causeText}`,
        );
      } finally {
        clearTimeout(timeout);
      }

      let payload: OpenAIChatCompletionResponse;
      try {
        payload = (await response.json()) as OpenAIChatCompletionResponse;
      } catch (error) {
        const err = error as Error;
        logLlmTrace("chat_parse_error", {
          provider: input.provider,
          endpoint: sanitizeUrlForError(endpoint),
          taskType: taskInput.taskType,
          status: response.status,
          statusText: response.statusText,
          errorMessage: err?.message || "unknown",
        });
        throw new Error(
          `OpenAI-compatible response parse failed for ${sanitizeUrlForError(baseUrl)}/chat/completions: ${err?.message || "unknown"}`,
        );
      }

      logLlmTrace("chat_response", {
        provider: input.provider,
        endpoint: sanitizeUrlForError(endpoint),
        taskType: taskInput.taskType,
        status: response.status,
        statusText: response.statusText,
        response: summarizeChatResponseForTrace(payload),
      });

      if (!response.ok) {
        throw new Error(payload.error?.message || `OpenAI 调用失败：${response.status}`);
      }

      const rawOutput = toContentString(payload.choices?.[0]?.message?.content);
      if (!rawOutput) {
        throw new Error("OpenAI 未返回可解析内容");
      }

      return {
        rawOutput,
        output: taskInput.parseOutput(rawOutput),
        modelVersion: taskInput.model,
        usage: {
          promptTokens: payload.usage?.prompt_tokens,
          completionTokens: payload.usage?.completion_tokens,
        },
      };
    },
  };
}

export const openAIAdapter = createOpenAICompatibleAdapter({
  provider: "openai",
  label: "OpenAI Compatible",
  audioTranscription: true,
});
