import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireCurrentUser: vi.fn(),
  getCurrentWorkspace: vi.fn(),
  getCurrentMembership: vi.fn(),
  canManageWorkspaceSetup: vi.fn(),
  getWorkspaceGovernanceDeniedMessage: vi.fn(),
  findWorkspace: vi.fn(),
  updateWorkspace: vi.fn(),
  probeOpenAICompatibleModels: vi.fn(),
  resolveWorkspaceLLMModelsWithProbe: vi.fn(),
  writeAuditLog: vi.fn(),
  logEvent: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("@/lib/auth/session", () => ({
  requireCurrentUser: mocks.requireCurrentUser,
  getCurrentWorkspace: mocks.getCurrentWorkspace,
  getCurrentMembership: mocks.getCurrentMembership,
}));

vi.mock("@/lib/auth/settings-governance", () => ({
  canManageWorkspaceSetup: mocks.canManageWorkspaceSetup,
  getWorkspaceGovernanceDeniedMessage: mocks.getWorkspaceGovernanceDeniedMessage,
}));

vi.mock("@/lib/db", () => ({
  db: {
    workspace: {
      findUnique: mocks.findWorkspace,
      update: mocks.updateWorkspace,
    },
  },
}));

vi.mock("@/lib/llm/config", () => ({
  getDefaultWorkspaceLLMConfig: () => ({
    provider: "openai",
    defaultModel: "google/gemma-4-31B-it",
    extractionModel: "google/gemma-4-31B-it",
    briefingModel: "google/gemma-4-31B-it",
    reasoningModel: "google/gemma-4-31B-it",
    llmEnabled: true,
    llmBudgetTier: "pilot",
  }),
  getOpenAICompatibleApiKey: () => "test_api_key",
  getOpenAICompatibleBaseUrl: (provider: "openai" | "qwen") =>
    provider === "qwen"
      ? "https://dashscope.aliyuncs.com/compatible-mode/v1"
      : "http://127.0.0.1:8000/v1",
}));

vi.mock("@/lib/llm/model-catalog", () => ({
  probeOpenAICompatibleModels: mocks.probeOpenAICompatibleModels,
  resolveWorkspaceLLMModelsWithProbe: mocks.resolveWorkspaceLLMModelsWithProbe,
}));

vi.mock("@/lib/audit", () => ({
  writeAuditLog: mocks.writeAuditLog,
}));

vi.mock("@/lib/analytics", () => ({
  logEvent: mocks.logEvent,
}));

import { updateWorkspaceLLMConfigAction } from "@/features/settings/llm-config-actions";

describe("updateWorkspaceLLMConfigAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCurrentUser.mockResolvedValue({ id: "user_1", name: "Tester" });
    mocks.getCurrentWorkspace.mockResolvedValue({ id: "ws_1", defaultLocale: "zh-CN" });
    mocks.getCurrentMembership.mockResolvedValue({ role: "OWNER" });
    mocks.canManageWorkspaceSetup.mockReturnValue(true);
    mocks.getWorkspaceGovernanceDeniedMessage.mockReturnValue("denied");
    mocks.findWorkspace.mockResolvedValue({
      defaultLLMProvider: "openai",
      defaultLLMModel: "google/gemma-4-31B-it",
      extractionModel: "google/gemma-4-31B-it",
      briefingModel: "google/gemma-4-31B-it",
      reasoningModel: "google/gemma-4-31B-it",
    });
    mocks.probeOpenAICompatibleModels.mockResolvedValue({
      baseUrl: "http://127.0.0.1:8000/v1",
      hasCredential: true,
      reachable: true,
      availableModelIds: ["google/gemma-4-31B-it", "deepseek-chat"],
      errorMessage: null,
      checkedAt: "2026-01-01T00:00:00.000Z",
      probeMode: "healthz",
    });
    mocks.resolveWorkspaceLLMModelsWithProbe.mockReturnValue({
      next: {
        defaultModel: "google/gemma-4-31B-it",
        extractionModel: "google/gemma-4-31B-it",
        briefingModel: "google/gemma-4-31B-it",
        reasoningModel: "google/gemma-4-31B-it",
      },
      warnings: [],
    });
    mocks.updateWorkspace.mockResolvedValue({ id: "ws_1" });
    mocks.writeAuditLog.mockResolvedValue(undefined);
    mocks.logEvent.mockResolvedValue(undefined);
  });

  it("updates all model slots when probe passes", async () => {
    const result = await updateWorkspaceLLMConfigAction({
      provider: "openai",
      defaultModel: "google/gemma-4-31B-it",
      extractionModel: "google/gemma-4-31B-it",
      briefingModel: "google/gemma-4-31B-it",
      reasoningModel: "google/gemma-4-31B-it",
    });

    expect(result.ok).toBe(true);
    expect(result.warnings).toEqual([]);
    expect(mocks.updateWorkspace).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          defaultLLMProvider: "openai",
          defaultLLMModel: "google/gemma-4-31B-it",
        }),
      }),
    );
  });

  it("returns warnings for partial unsupported models", async () => {
    mocks.resolveWorkspaceLLMModelsWithProbe.mockReturnValue({
      next: {
        defaultModel: "deepseek-chat",
        extractionModel: "google/gemma-4-31B-it",
        briefingModel: "deepseek-chat",
        reasoningModel: "google/gemma-4-31B-it",
      },
      warnings: ["warning-1", "warning-2"],
    });

    const result = await updateWorkspaceLLMConfigAction({
      provider: "openai",
      defaultModel: "deepseek-chat",
      extractionModel: "missing-model",
      briefingModel: "deepseek-chat",
      reasoningModel: "missing-model",
    });

    expect(result.ok).toBe(true);
    expect(result.warnings).toEqual(["warning-1", "warning-2"]);
    expect(mocks.updateWorkspace).toHaveBeenCalledTimes(1);
  });

  it("keeps old values when all proposed models are unsupported", async () => {
    mocks.resolveWorkspaceLLMModelsWithProbe.mockReturnValue({
      next: {
        defaultModel: "google/gemma-4-31B-it",
        extractionModel: "google/gemma-4-31B-it",
        briefingModel: "google/gemma-4-31B-it",
        reasoningModel: "google/gemma-4-31B-it",
      },
      warnings: ["w1", "w2", "w3", "w4"],
    });

    const result = await updateWorkspaceLLMConfigAction({
      provider: "openai",
      defaultModel: "unsupported-1",
      extractionModel: "unsupported-2",
      briefingModel: "unsupported-3",
      reasoningModel: "unsupported-4",
    });

    expect(result.ok).toBe(true);
    expect(result.warnings).toHaveLength(4);
    expect(mocks.updateWorkspace).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          defaultLLMModel: "google/gemma-4-31B-it",
          extractionModel: "google/gemma-4-31B-it",
          briefingModel: "google/gemma-4-31B-it",
          reasoningModel: "google/gemma-4-31B-it",
        }),
      }),
    );
  });

  it("rejects caller without workspace setup permission", async () => {
    mocks.canManageWorkspaceSetup.mockReturnValue(false);

    const result = await updateWorkspaceLLMConfigAction({
      provider: "openai",
      defaultModel: "google/gemma-4-31B-it",
      extractionModel: "google/gemma-4-31B-it",
      briefingModel: "google/gemma-4-31B-it",
      reasoningModel: "google/gemma-4-31B-it",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe("denied");
    expect(mocks.updateWorkspace).not.toHaveBeenCalled();
  });

  it("supports qwen provider and persists provider selection", async () => {
    mocks.resolveWorkspaceLLMModelsWithProbe.mockReturnValue({
      next: {
        defaultModel: "qwen3.6-plus",
        extractionModel: "qwen3.6-plus",
        briefingModel: "qwen3.6-plus",
        reasoningModel: "qwen3.6-plus",
      },
      warnings: [],
    });

    const result = await updateWorkspaceLLMConfigAction({
      provider: "qwen",
      defaultModel: "qwen3.6-plus",
      extractionModel: "qwen3.6-plus",
      briefingModel: "qwen3.6-plus",
      reasoningModel: "qwen3.6-plus",
    });

    expect(result.ok).toBe(true);
    expect(mocks.updateWorkspace).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          defaultLLMProvider: "qwen",
          defaultLLMModel: "qwen3.6-plus",
          extractionModel: "qwen3.6-plus",
          briefingModel: "qwen3.6-plus",
          reasoningModel: "qwen3.6-plus",
        }),
      }),
    );
  });
});
