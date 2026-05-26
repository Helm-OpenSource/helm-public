import { getOpenAIApiKey, getOpenAIBaseUrl } from "@/lib/llm/config";
import type { LLMProvider } from "@/lib/llm/types";

const LOCAL_GEMMA_MODEL = "google/gemma-4-31B-it";

export type LLMModelVendor = "local" | "openai" | "qwen" | "deepseek" | "anthropic";

export type LLMModelCatalogItem = {
  id: string;
  label: string;
  vendor: LLMModelVendor;
};

export type LLMModelCatalogGroup = {
  vendor: LLMModelVendor;
  label: string;
  models: LLMModelCatalogItem[];
};

export type LLMConnectionProbe = {
  baseUrl: string;
  hasCredential: boolean;
  reachable: boolean;
  availableModelIds: string[];
  errorMessage: string | null;
  checkedAt: string;
  probeMode: "healthz" | "chat_completions_options";
};

const MODEL_CATALOG: LLMModelCatalogGroup[] = [
  {
    vendor: "local",
    label: "Local",
    models: [
      {
        id: LOCAL_GEMMA_MODEL,
        label: "Gemma 4 31B IT (Local)",
        vendor: "local",
      },
    ],
  },
  {
    vendor: "openai",
    label: "OpenAI",
    models: [
      {
        id: "gpt-5.4",
        label: "GPT-5.4",
        vendor: "openai",
      },
      {
        id: "gpt-5.2",
        label: "GPT-5.2",
        vendor: "openai",
      },
      {
        id: "gpt-4.1",
        label: "GPT-4.1",
        vendor: "openai",
      },
      {
        id: "gpt-4.1-mini",
        label: "GPT-4.1 Mini",
        vendor: "openai",
      },
    ],
  },
  {
    vendor: "qwen",
    label: "Qwen",
    models: [
      {
        id: "qwen3.6-plus",
        label: "Qwen 3.6 Plus",
        vendor: "qwen",
      },
      {
        id: "qwen3.6-flash",
        label: "Qwen 3.6 Flash",
        vendor: "qwen",
      },
      {
        id: "qwen-max-latest",
        label: "Qwen Max Latest",
        vendor: "qwen",
      },
      {
        id: "qwen-plus-latest",
        label: "Qwen Plus Latest",
        vendor: "qwen",
      },
      {
        id: "qwen-turbo-latest",
        label: "Qwen Turbo Latest",
        vendor: "qwen",
      },
    ],
  },
  {
    vendor: "deepseek",
    label: "DeepSeek",
    models: [
      {
        id: "deepseek-reasoner",
        label: "DeepSeek Reasoner",
        vendor: "deepseek",
      },
      {
        id: "deepseek-chat",
        label: "DeepSeek Chat",
        vendor: "deepseek",
      },
    ],
  },
  {
    vendor: "anthropic",
    label: "Anthropic",
    models: [
      {
        id: "claude-opus-4-1-20250805",
        label: "Claude Opus 4.1",
        vendor: "anthropic",
      },
      {
        id: "claude-sonnet-4-20250514",
        label: "Claude Sonnet 4",
        vendor: "anthropic",
      },
    ],
  },
];

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "");
}

function resolveHealthzUrl(baseUrl: string) {
  const withoutV1 = baseUrl.replace(/\/v1$/i, "");
  return `${withoutV1}/healthz`;
}

function resolveQwenProbeUrl(baseUrl: string) {
  return `${baseUrl}/chat/completions`;
}

export function getDefaultLocalGemmaModel() {
  return LOCAL_GEMMA_MODEL;
}

export function getLLMModelCatalog() {
  return MODEL_CATALOG.map((group) => ({
    ...group,
    models: group.models.map((model) => ({ ...model })),
  }));
}

export async function probeOpenAICompatibleModels(options?: {
  apiKey?: string;
  baseUrl?: string;
  provider?: LLMProvider;
  timeoutMs?: number;
}): Promise<LLMConnectionProbe> {
  const provider = options?.provider ?? "openai";
  const apiKey = options?.apiKey ?? getOpenAIApiKey();
  const baseUrl = normalizeBaseUrl(options?.baseUrl ?? getOpenAIBaseUrl());
  const checkedAt = new Date().toISOString();
  const hasCredential = Boolean(apiKey);

  const controller = new AbortController();
  const timeoutMs = options?.timeoutMs ?? 3_500;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const probeUrl = provider === "qwen" ? resolveQwenProbeUrl(baseUrl) : resolveHealthzUrl(baseUrl);
    const probeMode = provider === "qwen" ? "chat_completions_options" : "healthz";
    const method = provider === "qwen" ? "OPTIONS" : "GET";
    const response = await fetch(probeUrl, {
      method,
      headers: hasCredential
        ? {
            Authorization: `Bearer ${apiKey}`,
          }
        : undefined,
      cache: "no-store",
      signal: controller.signal,
    });

    const reachable =
      provider === "qwen"
        ? response.ok || response.status === 405
        : response.ok;

    if (!reachable) {
      return {
        baseUrl,
        hasCredential,
        reachable: false,
        availableModelIds: [],
        errorMessage:
          probeMode === "chat_completions_options"
            ? `Chat completions probe failed (${response.status})`
            : `Health check failed (${response.status})`,
        checkedAt,
        probeMode,
      };
    }

    return {
      baseUrl,
      hasCredential,
      reachable: true,
      availableModelIds: [],
      errorMessage: null,
      checkedAt,
      probeMode,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Health check failed";
    return {
      baseUrl,
      hasCredential,
      reachable: false,
      availableModelIds: [],
      errorMessage: message,
      checkedAt,
      probeMode: provider === "qwen" ? "chat_completions_options" : "healthz",
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function resolveWorkspaceLLMModelsWithProbe(input: {
  current: {
    defaultModel: string;
    extractionModel: string;
    briefingModel: string;
    reasoningModel: string;
  };
  proposed: {
    defaultModel: string;
    extractionModel: string;
    briefingModel: string;
    reasoningModel: string;
  };
  probe: LLMConnectionProbe;
  english: boolean;
}) {
  const warnings: string[] = [];

  if (!input.probe.reachable) {
    warnings.push(
      input.english
        ? "Endpoint health check failed. Saved using selected models without connectivity verification."
        : "端点健康检查失败，已按所选模型保存（未通过连通性校验）。",
    );
  }

  return {
    next: { ...input.proposed },
    warnings,
  };
}
