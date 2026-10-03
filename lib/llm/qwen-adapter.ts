import { closeUnguardedPaidAdapter, createOpenAICompatibleAdapter } from "@/lib/llm/openai-adapter";
import type { LLMProviderAdapter } from "@/lib/llm/types";

export const qwenAdapter: LLMProviderAdapter = {
  ...createOpenAICompatibleAdapter({
    provider: "qwen", label: "Qwen (DashScope OpenAI Compatible)", audioTranscription: false,
  }),
  run: closeUnguardedPaidAdapter,
};
