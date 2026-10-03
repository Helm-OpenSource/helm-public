import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  gateway: vi.fn(),
  operation: vi.fn(),
  decisionRead: vi.fn(),
  terminalRead: vi.fn(),
  recordLLMCall: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: {
  lLMWorkflowOperation: { findFirst: mocks.operation },
  modelRouteDecision: { findFirst: mocks.decisionRead },
  modelEgressReceipt: { findUnique: mocks.terminalRead },
} }));
vi.mock("@/lib/observability/llm-call-log.service", () => ({
  recordLLMCall: mocks.recordLLMCall,
}));
vi.mock("@/lib/llm/config", () => ({
  getWorkspaceLLMConfig: async () => ({
    llmEnabled: true, provider: "openai", defaultModel: "synthetic-model",
    llmBudgetTier: "pilot",
  }),
}));
vi.mock("@/lib/llm/model-router", () => ({
  resolveModelForTask: () => ({ provider: "openai", model: "synthetic-model",
    modelRole: "REASONING", budgetTier: "pilot" }),
}));
vi.mock("@/lib/llm/openai-adapter", () => ({ openAIAdapter: {
  provider: "openai", label: "synthetic", capabilities: {}, isConfigured: () => true,
} }));
vi.mock("@/lib/llm/qwen-adapter", () => ({ qwenAdapter: {
  provider: "qwen", label: "synthetic", capabilities: {}, isConfigured: () => true,
} }));
vi.mock("@/lib/llm/ordinary-paid-adapter-bridge.service", async (original) => {
  const actual = await original<typeof import("@/lib/llm/ordinary-paid-adapter-bridge.service")>();
  return { ...actual, runOrdinaryPaidAdapter: actual.createOrdinaryPaidAdapterBridge({
    policyKey: "synthetic-policy", gateway: mocks.gateway,
    operationWriterClient: { lLMWorkflowOperation: { findFirst: mocks.operation } } as never,
    chargeClient: { lLMWorkflowOperation: { findFirst: mocks.operation },
      modelRouteDecision: { findFirst: mocks.decisionRead },
      modelEgressReceipt: { findUnique: mocks.terminalRead } } as never,
  }) };
});

import { canonicalJson, sha256 } from "@/lib/expert-capability/hashing";
import { GovernedModelGatewayError } from "@/lib/llm/governed-model-gateway.service";
import { executeLLMTask } from "@/lib/llm/provider-registry";

const projectedPayload = {
  taskType: "BI_REPORT_ANALYSIS" as const, promptKey: "synthetic.bi",
  promptVersion: "v1", systemPrompt: "synthetic system", userPrompt: "synthetic user",
  outputMode: "json" as const, jsonSchema: null,
};
const task = {
  ...projectedPayload, workspaceId: "synthetic-workspace", userId: "synthetic-actor",
  ordinaryOperationId: "synthetic-operation",
  parseOutput: (raw: string) => JSON.parse(raw) as { synthetic: string },
  fallbackOutput: { synthetic: "business-fallback" },
};

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.recordLLMCall.mockResolvedValue(undefined);
  mocks.operation.mockResolvedValue({
    id: task.ordinaryOperationId, workspaceId: task.workspaceId,
    status: "prepared", kind: "bi_analysis", actorUserId: task.userId,
    requestKey: "synthetic-request", projectionReceiptRef: "projection:synthetic",
    projectedPayloadHash: sha256(canonicalJson(projectedPayload)),
  });
});

describe("ordinary charged attempt exception boundary", () => {
  it.each([null, undefined])("withholds malformed gateway result %s after entry", async (value) => {
    mocks.gateway.mockResolvedValue(value);
    await expect(executeLLMTask(task)).rejects.toMatchObject({
      code: "paid_egress_in_doubt",
    });
    expect(mocks.gateway).toHaveBeenCalledTimes(1);
  });
  it.each([
    ["terminal persistence", new GovernedModelGatewayError(
      "terminal_receipt_persistence_failed_output_withheld", "synthetic-decision")],
    ["unknown ledger persistence", new Error("synthetic_unknown_ledger_write_failed")],
  ])("withholds business output after %s throws", async (_label, error) => {
    mocks.gateway.mockRejectedValue(error);
    await expect(executeLLMTask(task)).rejects.toMatchObject({
      code: "paid_egress_in_doubt",
    });
    expect(mocks.gateway).toHaveBeenCalledTimes(1);
  });

  it("withholds business output if settled-result readback itself fails", async () => {
    mocks.gateway.mockResolvedValue({ status: "success", selectedDecisionRef: "synthetic-decision",
      attempts: [],
      output: { rawOutput: '{"synthetic":"complete"}', modelVersion: "synthetic-model",
        promptTokens: 10, completionTokens: 10 } });
    mocks.decisionRead.mockRejectedValue(new Error("synthetic_readback_connection_lost"));
    await expect(executeLLMTask(task)).rejects.toMatchObject({
      code: "paid_egress_committed_readback_invalid",
    });
    expect(mocks.gateway).toHaveBeenCalledTimes(1);
  });

  it("can return a no-charge fallback before the gateway is entered", async () => {
    const result = await executeLLMTask({ ...task, ordinaryOperationId: undefined });
    expect(result.fallbackUsed).toBe(true);
    expect(result.fallbackReason).toBe("paid_egress_operation_or_policy_unconfigured");
    expect(mocks.gateway).not.toHaveBeenCalled();
  });
});
