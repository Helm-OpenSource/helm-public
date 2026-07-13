import { describe, expect, it } from "vitest";
import { sanitizeLlmTracePayload } from "@/lib/llm/trace-sanitizer";
import {
  summarizeChatRequestForTrace,
  summarizeChatResponseForTrace,
} from "@/lib/llm/openai-adapter";

describe("LLM trace sanitizer", () => {
  it("redacts raw prompts, response content, reasoning content, and credentials", () => {
    const sanitized = sanitizeLlmTracePayload({
      provider: "qwen",
      taskType: "EXTERNAL_EMPLOYEE_SIGNAL_OWNER_ROUTING",
      Authorization: "Bearer secret-token",
      apiKey: "secret-key",
      requestBody: {
        messages: [
          { role: "system", content: "private system prompt" },
          { role: "user", content: "private tenant payload" },
        ],
      },
      payload: {
        choices: [
          {
            message: {
              content: "private model output",
              reasoning_content: "private model reasoning",
            },
          },
        ],
      },
    });

    const serialized = JSON.stringify(sanitized);

    expect(serialized).toContain("EXTERNAL_EMPLOYEE_SIGNAL_OWNER_ROUTING");
    expect(serialized).not.toContain("secret-token");
    expect(serialized).not.toContain("secret-key");
    expect(serialized).not.toContain("private system prompt");
    expect(serialized).not.toContain("private tenant payload");
    expect(serialized).not.toContain("private model output");
    expect(serialized).not.toContain("private model reasoning");
  });

  it("summarizes chat requests without prompt text or user ids", () => {
    const summary = summarizeChatRequestForTrace({
      model: "qwen3.7-max",
      temperature: 0.1,
      max_completion_tokens: 500,
      enable_thinking: false,
      messages: [
        { role: "system", content: "private system prompt" },
        { role: "user", content: "private tenant payload" },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "external_employee_signal_owner_routing" },
      },
      user: "user_123",
    });

    expect(summary).toEqual({
      model: "qwen3.7-max",
      temperature: 0.1,
      maxCompletionTokens: 500,
      thinkingEnabled: false,
      messageCount: 2,
      messageRoles: ["system", "user"],
      responseFormat: {
        type: "json_schema",
        schemaName: "external_employee_signal_owner_routing",
      },
      userPresent: true,
    });
  });

  it("summarizes chat responses without content or reasoning text", () => {
    const summary = summarizeChatResponseForTrace({
      choices: [
        {
          finish_reason: "stop",
          message: {
            content: "{\"summary\":\"private output\"}",
            reasoning_content: "private chain of thought",
          },
        },
      ],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 20,
        total_tokens: 30,
      },
    });

    expect(summary).toEqual({
      choiceCount: 1,
      finishReasons: ["stop"],
      outputTextLengths: [28],
      reasoningContentPresent: true,
      usage: {
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
      },
      error: undefined,
    });
  });
});
