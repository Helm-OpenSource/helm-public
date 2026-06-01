import { createOpenAICompatibleAdapter } from "@/lib/llm/openai-adapter";

export const qwenAdapter = createOpenAICompatibleAdapter({
  provider: "qwen",
  label: "Qwen (DashScope OpenAI Compatible)",
  audioTranscription: false,
});
