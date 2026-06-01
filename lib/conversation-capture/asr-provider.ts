import { db } from "@/lib/db";
import { getOpenAIBaseUrl, isOpenAIConfigured } from "@/lib/llm/config";
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

export type ASRTranscriptResult = {
  text: string;
  sourceType: "OPENAI_ASR";
  provider: "openai";
  model: string;
  confidence: number;
};

export type CaptureASRConfig = {
  provider: "openai";
  model: string;
  language: string;
  enabled: boolean;
};

export function getCaptureASRConfig(): CaptureASRConfig {
  return {
    provider: "openai",
    model: process.env.ASR_OPENAI_MODEL || "gpt-4o-mini-transcribe",
    language: process.env.ASR_LANGUAGE || "zh",
    enabled: process.env.ASR_ENABLED !== "false",
  };
}

export function isCaptureASRConfigured() {
  const config = getCaptureASRConfig();
  return config.enabled && config.provider === "openai" && isOpenAIConfigured();
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
    await db.lLMCallLog.create({
      data: {
        workspaceId: input.workspaceId,
        userId: input.userId ?? undefined,
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
        outputSummary: success ? text.slice(0, 160) : undefined,
        latencyMs: Date.now() - startedAt,
        success,
        fallbackReason: success ? undefined : "provider_error",
        errorMessage,
      },
    });
  }
}
