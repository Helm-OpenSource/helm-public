import { getOpenAIBaseUrl, isOpenAIConfigured } from "@/lib/llm/config";
import { recordLLMCall } from "@/lib/observability/llm-call-log.service";
import { sanitizeLlmTracePayload } from "@/lib/llm/trace-sanitizer";

type OpenAITranscriptionResponse = {
  text?: string;
  error?: {
    message?: string;
  };
};

function logAsrTrace(event: string, payload: Record<string, unknown>) {
  try {
    console.info(`[LLM trace] asr_${event} ${JSON.stringify(sanitizeLlmTracePayload(payload))}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[LLM trace] asr_${event}_serialization_failed: ${message}`);
  }
}

export type CaptureASRProvider = "openai" | "dashscope";

export type ASRTranscriptResult = {
  text: string;
  sourceType: "OPENAI_ASR" | "DASHSCOPE_ASR";
  provider: CaptureASRProvider;
  model: string;
  confidence: number;
};

export type CaptureASRConfig = {
  provider: CaptureASRProvider;
  model: string;
  language: string;
  enabled: boolean;
};

const DEFAULT_DASHSCOPE_ASR_BASE_URL =
  "https://dashscope.aliyuncs.com/compatible-mode/v1";
const DEFAULT_DASHSCOPE_ASR_MODEL = "qwen3-asr-flash";
/**
 * Base64 data-URI audio travels inside a JSON chat request; keep the raw
 * audio conservatively small so the encoded payload stays well under
 * provider request limits.
 */
const DASHSCOPE_ASR_MAX_AUDIO_BYTES = 7 * 1024 * 1024;

function resolveCaptureASRProvider(): CaptureASRProvider {
  return process.env.ASR_PROVIDER === "dashscope" ? "dashscope" : "openai";
}

export function getCaptureASRConfig(): CaptureASRConfig {
  const provider = resolveCaptureASRProvider();
  return {
    provider,
    model:
      provider === "dashscope"
        ? process.env.ASR_DASHSCOPE_MODEL || DEFAULT_DASHSCOPE_ASR_MODEL
        : process.env.ASR_OPENAI_MODEL || "gpt-4o-mini-transcribe",
    language: process.env.ASR_LANGUAGE || "zh",
    enabled: process.env.ASR_ENABLED !== "false",
  };
}

export function isCaptureASRConfigured() {
  const config = getCaptureASRConfig();
  if (!config.enabled) return false;
  if (config.provider === "dashscope") {
    return Boolean(process.env.DASHSCOPE_API_KEY);
  }
  return isOpenAIConfigured();
}

function buildPromptHint(input: {
  title?: string | null;
  objectLabel?: string | null;
  companyName?: string | null;
  contactName?: string | null;
  opportunityTitle?: string | null;
}) {
  const hints = [
    input.title ? `会话标题：${input.title}` : null,
    input.objectLabel ? `对象：${input.objectLabel}` : null,
    input.companyName ? `公司：${input.companyName}` : null,
    input.contactName ? `联系人：${input.contactName}` : null,
    input.opportunityTitle ? `机会：${input.opportunityTitle}` : null,
  ].filter(Boolean);

  if (!hints.length) {
    return "请按中文商务交流语境转写，重点保留人名、公司名、承诺、阻塞和时间点。";
  }

  return `${hints.join("；")}。请按中文商务交流语境转写，重点保留人名、公司名、承诺、阻塞和时间点。`;
}

export async function transcribeCaptureAudioWithOpenAI(input: {
  workspaceId: string;
  userId?: string | null;
  audioFile: File;
  title?: string | null;
  objectLabel?: string | null;
  companyName?: string | null;
  contactName?: string | null;
  opportunityTitle?: string | null;
}) {
  const config = getCaptureASRConfig();

  if (!isCaptureASRConfigured()) {
    throw new Error("当前没有可用的 ASR 配置");
  }

  if (input.audioFile.size > 25 * 1024 * 1024) {
    throw new Error("录音文件超过 25MB，请缩短录音或改用更短片段。");
  }

  const startedAt = Date.now();
  const formData = new FormData();
  const extension = input.audioFile.name?.split(".").pop()?.toLowerCase() || "webm";
  const normalizedFile = new File([input.audioFile], input.audioFile.name || `capture.${extension}`, {
    type: input.audioFile.type || "audio/webm",
  });

  formData.set("file", normalizedFile);
  formData.set("model", config.model);
  formData.set("language", config.language);
  formData.set("response_format", "json");
  formData.set(
    "prompt",
    buildPromptHint({
      title: input.title,
      objectLabel: input.objectLabel,
      companyName: input.companyName,
      contactName: input.contactName,
      opportunityTitle: input.opportunityTitle,
    }),
  );

  let success = false;
  let errorMessage: string | undefined;
  let text = "";
  const endpoint = `${getOpenAIBaseUrl()}/audio/transcriptions`;
  const requestPayload = {
    provider: config.provider,
    model: config.model,
    language: config.language,
    responseFormat: "json",
    promptPresent: true,
    fileMeta: {
      type: normalizedFile.type,
      size: normalizedFile.size,
    },
    workspacePresent: Boolean(input.workspaceId),
    userPresent: Boolean(input.userId),
  };
  logAsrTrace("request", {
    endpoint,
    request: requestPayload,
    hasApiKey: Boolean(process.env.OPENAI_API_KEY),
  });

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: formData,
    });

    const payload = (await response.json().catch(async () => ({ text: await response.text() }))) as OpenAITranscriptionResponse;
    logAsrTrace("response", {
      endpoint,
      status: response.status,
      statusText: response.statusText,
      response: {
        textLength: payload.text?.length ?? 0,
        error: payload.error,
      },
    });
    if (!response.ok) {
      throw new Error(payload.error?.message || `OpenAI ASR 调用失败：${response.status}`);
    }

    text = payload.text?.trim() || "";
    if (!text) {
      throw new Error("OpenAI ASR 未返回可用 transcript");
    }

    success = true;
    return {
      text,
      sourceType: "OPENAI_ASR" as const,
      provider: "openai" as const,
      model: config.model,
      confidence: 88,
    };
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "未知转写错误";
    logAsrTrace("error", {
      endpoint,
      request: requestPayload,
      errorMessage,
    });
    throw error;
  } finally {
    await recordLLMCall({
      workspaceId: input.workspaceId,
      userId: input.userId,
      provider: "openai",
      model: config.model,
      modelVersion: config.model,
      modelRole: "EXTRACTION",
      taskType: "AUDIO_TRANSCRIPTION",
      promptKey: "capture-audio-transcription",
      promptVersion: "capture_asr_v1",
      budgetTier: "pilot",
      outputMode: "text",
      inputSummary: `${input.audioFile.type || "audio/unknown"} · ${Math.round(input.audioFile.size / 1024)}KB`,
      outputSummary: success ? text : undefined,
      latencyMs: Date.now() - startedAt,
      success,
      fallbackReason: success ? undefined : "provider_error",
      errorMessage,
    });
  }
}

type DashScopeChatCompletionResponse = {
  choices?: Array<{ message?: { content?: unknown } }>;
  error?: { message?: string };
  message?: string;
};

function extractDashScopeText(payload: DashScopeChatCompletionResponse): string {
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content === "string") {
    return content.trim();
  }
  if (Array.isArray(content)) {
    return content
      .map((part) =>
        typeof part === "string"
          ? part
          : typeof (part as { text?: unknown }).text === "string"
            ? ((part as { text: string }).text)
            : "",
      )
      .join("")
      .trim();
  }
  return "";
}

/**
 * In-region ASR path: qwen3-asr-flash over the OpenAI-compatible chat
 * completions endpoint with the audio inlined as a base64 data URI — no
 * public audio URL is ever created and the audio does not leave the
 * configured DashScope region endpoint.
 */
export async function transcribeCaptureAudioWithDashScope(input: {
  workspaceId: string;
  userId?: string | null;
  audioFile: File;
  title?: string | null;
}) {
  const config = getCaptureASRConfig();

  if (!isCaptureASRConfigured() || config.provider !== "dashscope") {
    throw new Error("当前没有可用的 DashScope ASR 配置");
  }

  if (input.audioFile.size > DASHSCOPE_ASR_MAX_AUDIO_BYTES) {
    throw new Error("录音文件超过 7MB（DashScope 内联音频上限），请缩短录音或改用更短片段。");
  }

  const startedAt = Date.now();
  const mimeType = input.audioFile.type || "audio/webm";
  const audioBuffer = Buffer.from(await input.audioFile.arrayBuffer());
  const dataUri = `data:${mimeType};base64,${audioBuffer.toString("base64")}`;

  const baseUrl = process.env.ASR_DASHSCOPE_BASE_URL || DEFAULT_DASHSCOPE_ASR_BASE_URL;
  const endpoint = `${baseUrl.replace(/\/$/, "")}/chat/completions`;
  const requestPayload = {
    provider: config.provider,
    model: config.model,
    audioBytes: input.audioFile.size,
    mimeType,
    workspacePresent: Boolean(input.workspaceId),
    userPresent: Boolean(input.userId),
  };
  logAsrTrace("request", {
    endpoint,
    request: requestPayload,
    hasApiKey: Boolean(process.env.DASHSCOPE_API_KEY),
  });

  let success = false;
  let errorMessage: string | undefined;
  let text = "";

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.DASHSCOPE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "input_audio",
                input_audio: { data: dataUri },
              },
            ],
          },
        ],
        stream: false,
      }),
    });

    const payload = (await response
      .json()
      .catch(() => ({}))) as DashScopeChatCompletionResponse;
    logAsrTrace("response", {
      endpoint,
      status: response.status,
      statusText: response.statusText,
      response: {
        textLength: extractDashScopeText(payload).length,
        error: payload.error ?? payload.message,
      },
    });
    if (!response.ok) {
      throw new Error(
        payload.error?.message || payload.message || `DashScope ASR 调用失败：${response.status}`,
      );
    }

    text = extractDashScopeText(payload);
    if (!text) {
      throw new Error("DashScope ASR 未返回可用 transcript");
    }

    success = true;
    return {
      text,
      sourceType: "DASHSCOPE_ASR" as const,
      provider: "dashscope" as const,
      model: config.model,
      confidence: 88,
    };
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "未知转写错误";
    logAsrTrace("error", {
      endpoint,
      request: requestPayload,
      errorMessage,
    });
    throw error;
  } finally {
    await recordLLMCall({
      workspaceId: input.workspaceId,
      userId: input.userId,
      provider: "dashscope",
      model: config.model,
      modelVersion: config.model,
      modelRole: "EXTRACTION",
      taskType: "AUDIO_TRANSCRIPTION",
      promptKey: "capture-audio-transcription",
      promptVersion: "capture_asr_v1",
      budgetTier: "pilot",
      outputMode: "text",
      inputSummary: `${mimeType} · ${Math.round(input.audioFile.size / 1024)}KB`,
      outputSummary: success ? text : undefined,
      latencyMs: Date.now() - startedAt,
      success,
      fallbackReason: success ? undefined : "provider_error",
      errorMessage,
    });
  }
}

/**
 * Provider dispatcher — the capture pipeline calls this instead of a
 * provider-specific function. Provider selection comes from ASR_PROVIDER
 * (default: openai, unchanged behavior).
 */
export async function transcribeCaptureAudio(input: {
  workspaceId: string;
  userId?: string | null;
  audioFile: File;
  title?: string | null;
  objectLabel?: string | null;
  companyName?: string | null;
  contactName?: string | null;
  opportunityTitle?: string | null;
}): Promise<ASRTranscriptResult> {
  const config = getCaptureASRConfig();
  if (config.provider === "dashscope") {
    return transcribeCaptureAudioWithDashScope({
      workspaceId: input.workspaceId,
      userId: input.userId,
      audioFile: input.audioFile,
      title: input.title,
    });
  }
  return transcribeCaptureAudioWithOpenAI(input);
}
