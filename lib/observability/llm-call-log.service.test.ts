import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  workspaceFindUnique: vi.fn(),
  llmCallLogCreate: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    workspace: {
      findUnique: mocks.workspaceFindUnique,
    },
    lLMCallLog: {
      create: mocks.llmCallLogCreate,
    },
  },
}));

import { recordLLMCall } from "@/lib/observability/llm-call-log.service";

describe("recordLLMCall outputSummary privacy boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.workspaceFindUnique.mockResolvedValue({ id: "workspace_1" });
    mocks.llmCallLogCreate.mockResolvedValue({ id: "log_1" });
  });

  it("stores metadata only for generic LLM output summaries with detected PII", async () => {
    await recordLLMCall({
      workspaceId: "workspace_1",
      provider: "openai",
      model: "gpt-4.1-mini",
      taskType: "MEETING_MEMORY",
      promptVersion: "v1",
      outputSummary: "客户 synthetic.user@sample.invalid / 13800138000 反馈正面。",
      success: true,
    });

    const data = mocks.llmCallLogCreate.mock.calls[0]?.[0]?.data;
    expect(data.outputSummary).toContain("LLM 输出完成");
    expect(data.outputSummary).toContain("检测到 PII 模式");
    expect(data.outputSummary).toContain("原文未落库");
    expect(data.outputSummary).not.toContain("synthetic.user@sample.invalid");
    expect(data.outputSummary).not.toContain("13800138000");
  });

  it("detects PII before storing non-ASR output metadata", async () => {
    await recordLLMCall({
      workspaceId: "workspace_1",
      provider: "openai",
      model: "gpt-4.1-mini",
      taskType: "MEETING_MEMORY",
      promptVersion: "v1",
      outputSummary: `${"A".repeat(260)} synthetic.user@sample.invalid`,
      success: true,
    });

    const data = mocks.llmCallLogCreate.mock.calls[0]?.[0]?.data;
    expect(data.outputSummary).toContain("LLM 输出完成");
    expect(data.outputSummary).toContain("检测到 PII 模式");
    expect(data.outputSummary).not.toContain("synthetic.user@sample.invalid");
  });

  it("does not persist ASR transcript snippets even when structured PII is absent", async () => {
    await recordLLMCall({
      workspaceId: "workspace_1",
      provider: "openai",
      model: "gpt-4o-mini-transcribe",
      taskType: "AUDIO_TRANSCRIPTION",
      promptVersion: "capture_asr_v1",
      outputSummary: "示例联系人代表公开样例公司确认下周二推进样例方案。",
      success: true,
    });

    const data = mocks.llmCallLogCreate.mock.calls[0]?.[0]?.data;
    expect(data.outputSummary).toContain("ASR 转写完成");
    expect(data.outputSummary).toContain("原文未落库");
    expect(data.outputSummary).not.toContain("示例联系人");
    expect(data.outputSummary).not.toContain("公开样例公司");
    expect(data.outputSummary).not.toContain("样例方案");
  });

  it("stores metadata only for clean non-ASR summaries", async () => {
    await recordLLMCall({
      workspaceId: "workspace_1",
      provider: "openai",
      model: "gpt-4.1-mini",
      taskType: "RECOMMENDATION_EXPLANATION",
      promptVersion: "v1",
      outputSummary: "Generated recommendation explanation without customer identifiers.",
      success: true,
    });

    const data = mocks.llmCallLogCreate.mock.calls[0]?.[0]?.data;
    expect(data.outputSummary).toBe(
      "LLM 输出完成（66 字）；原文未落库。",
    );
    expect(data.outputSummary).not.toContain("Generated recommendation explanation");
  });
});
