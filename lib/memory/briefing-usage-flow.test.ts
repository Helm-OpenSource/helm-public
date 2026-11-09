import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  bridge: vi.fn(), log: vi.fn(), prepare: vi.fn(), persist: vi.fn(), cached: vi.fn(), receipt: vi.fn(), audit: vi.fn(),
  snapshot: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() }, transaction: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ db: { briefingSnapshot: mocks.snapshot, $transaction: mocks.transaction,
  contact: { findFirst: async () => ({ id: "contact-1", name: "Synthetic", opportunities: [], meetings: [], emailThreads: [] }) } } }));
vi.mock("@/lib/auth/service-governance", () => ({ assertWorkspaceMemoryServiceAccess: async () => {} }));
vi.mock("@/lib/llm/ordinary-paid-composition.service", () => ({ ordinaryPaidWriterClient: () => ({}) }));
vi.mock("@/lib/llm/ordinary-paid-operation.service", () => ({ prepareOrdinaryPaidOperationOrFallback: mocks.prepare }));
vi.mock("@/lib/memory/briefing-usage.service", () => ({ persistAcceptedBriefingInTransaction: mocks.persist,
  getAcceptedBriefing: mocks.cached, readBriefingUsageReceipt: mocks.receipt }));
vi.mock("@/lib/memory/memory-fact.service", () => ({ getRelevantMemoryFacts: async () => [] }));
vi.mock("@/lib/memory/commitment.service", () => ({ getCommitments: async () => [] }));
vi.mock("@/lib/memory/blocker.service", () => ({ getBlockers: async () => [] }));
vi.mock("@/lib/memory/shared", async original => ({ ...await original<typeof import("@/lib/memory/shared")>(), writeMemoryAuditAndEvent: mocks.audit }));
vi.mock("@/lib/observability/llm-call-log.service", () => ({ recordLLMCall: mocks.log }));
vi.mock("@/lib/llm/config", () => ({ isLLMEnabledByEnv: () => true,
  getWorkspaceLLMConfig: async () => ({ llmEnabled: true, provider: "openai", defaultModel: "synthetic", llmBudgetTier: "pilot" }) }));
vi.mock("@/lib/llm/model-router", () => ({ resolveModelForTask: () => ({ provider: "openai", model: "synthetic", modelRole: "REASONING", budgetTier: "pilot" }) }));
vi.mock("@/lib/llm/openai-adapter", () => ({ openAIAdapter: { provider: "openai", isConfigured: () => true } }));
vi.mock("@/lib/llm/qwen-adapter", () => ({ qwenAdapter: { provider: "qwen", isConfigured: () => true } }));
vi.mock("@/lib/llm/ordinary-paid-adapter-bridge.service", async original => ({
  ...await original<typeof import("@/lib/llm/ordinary-paid-adapter-bridge.service")>(), runOrdinaryPaidAdapter: mocks.bridge,
}));
import { generateContactBriefingSnapshot } from "./briefing.service";
import { LlmOutputParseError } from "@/lib/llm/output-parse-error";
import { attachUsageObservation } from "@/lib/llm/usage-observation";
const input = { workspaceId: "workspace-1", actorUserId: "actor-1", actorName: "Synthetic", contactId: "contact-1" };
const receipt = { entryId: "usage-1", operationId: "operation-1", snapshotId: "snapshot-1", actorUserId: "actor-1", sourcePage: "/original" };
const snapshot = { id: "snapshot-1", content: JSON.stringify({ summary: "Stored" }), expiresAt: null };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.prepare.mockResolvedValue({ id: "operation-1" }); mocks.cached.mockResolvedValue(null);
  mocks.snapshot.findFirst.mockResolvedValue(null);
  mocks.snapshot.create.mockImplementation(async ({ data }) => ({ id: "fallback-snapshot", ...data }));
  mocks.transaction.mockImplementation(async callback => callback({ transactionOnly: true }));
  mocks.persist.mockResolvedValue({ snapshot, usageReceipt: receipt });
  mocks.bridge.mockImplementation(async task => {
    const rawOutput = JSON.stringify({ summary: "Accepted", recommendedQuestions: [], recommendedNextSteps: [], importantFactHighlights: [] });
    return { output: task.parseOutput(rawOutput), rawOutput, usage: { promptTokens: 10, completionTokens: 8 },
      governedRoute: { provider: "openai", model: "synthetic", modelVersion: "synthetic-v1" } };
  });
});
describe("briefing logical observation consumption", () => {
  it("observes only accepted structured output with its business artifact in one transaction", async () => {
    const result = await generateContactBriefingSnapshot(input);
    expect(result.usageReceipt).toEqual(receipt); expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.persist).toHaveBeenCalledWith({ transactionOnly: true }, expect.objectContaining({ operationId: "operation-1", actorUserId: "actor-1" }));
    expect(mocks.snapshot.create).not.toHaveBeenCalled();
  });
  it.each([false, true])("reuses persisted binding before provider dispatch, force=%s", async force => {
    if (force) mocks.cached.mockResolvedValue({ snapshot, usageReceipt: receipt });
    else { mocks.snapshot.findFirst.mockResolvedValue(snapshot); mocks.receipt.mockResolvedValue(receipt); }
    const result = await generateContactBriefingSnapshot({ ...input, actorUserId: force ? input.actorUserId : "other-active-actor", force });
    expect(result.usageReceipt).toEqual(receipt); expect(mocks.bridge).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled(); expect(mocks.persist).not.toHaveBeenCalled();
  });
  it.each(["parse", "pii"])("keeps actual token observations for %s rejection without a logical fulfillment", async reason => {
    if (reason === "parse") mocks.bridge.mockRejectedValue(attachUsageObservation(new LlmOutputParseError("synthetic malformed output"), {
      kind: "known", promptTokens: 10, completionTokens: 8,
    }));
    else mocks.bridge.mockResolvedValue({ output: { summary: "Rejected" }, rawOutput: '"synthetic-person@synthetic.invalid"',
      usage: { promptTokens: 10, completionTokens: 8 }, governedRoute: { provider: "openai", model: "synthetic", modelVersion: "synthetic-v1" } });
    const result = await generateContactBriefingSnapshot(input);
    expect(result.usageReceipt).toBeNull(); expect(mocks.persist).not.toHaveBeenCalled();
    expect(mocks.log).toHaveBeenCalledWith(expect.objectContaining({ tokenUsagePrompt: 10, tokenUsageCompletion: 8, success: false,
      fallbackReason: reason === "parse" ? "output_parse_failed" : "policy_pii_in_output" }));
    expect(result.payload.generationMode).toBe("fallback");
  });
  it.each([
    {}, { summary: "Synthetic", recommendedQuestions: [1], recommendedNextSteps: [], importantFactHighlights: [] },
    { summary: "Synthetic", recommendedQuestions: [], recommendedNextSteps: [], importantFactHighlights: [], extra: true },
  ])("does not fulfill syntactically valid but schema-invalid output %j", async value => {
    mocks.bridge.mockImplementation(async task => {
      try { return { output: task.parseOutput(JSON.stringify(value)), rawOutput: JSON.stringify(value),
        governedRoute: { provider: "openai", model: "synthetic", modelVersion: "synthetic-v1" }, usage: { promptTokens: 10, completionTokens: 8 } }; }
      catch (error) { throw attachUsageObservation(error, { kind: "known", promptTokens: 10, completionTokens: 8 }); }
    });
    const result = await generateContactBriefingSnapshot(input);
    expect(result.usageReceipt).toBeNull(); expect(mocks.persist).not.toHaveBeenCalled();
    expect(mocks.log).toHaveBeenCalledWith(expect.objectContaining({ fallbackReason: "output_schema_failed", tokenUsagePrompt: 10, tokenUsageCompletion: 8 }));
  });
  it("preserves legacy semantics without a prepared ordinary operation", async () => {
    mocks.prepare.mockResolvedValue(null);
    const result = await generateContactBriefingSnapshot(input);
    expect(result.usageReceipt).toBeNull(); expect(mocks.snapshot.create).toHaveBeenCalledOnce();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
