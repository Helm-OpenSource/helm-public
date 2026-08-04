import { describe, expect, it, vi } from "vitest";

import type { WorkBuddyClientIdentity } from "./contracts";
import { createWorkBuddyMcpToolDispatcher } from "./mcp-tool-dispatcher";
import {
  createWorkBuddyGovernedMutationToolDefinitions,
  type WorkBuddyGovernedMutationToolHandlers,
} from "./mutation-tools";

const identity: WorkBuddyClientIdentity = {
  schemaVersion: "helm.workbuddy-client-identity/v1",
  clientId: "client:workbuddy-ceo",
  workspaceId: "workspace:demo",
  actorUserId: "user:owner",
  certificateFingerprint: `sha256:${"a".repeat(64)}`,
  scopes: ["caio:canonical:mutate"],
  transport: "mtls",
  mtlsVerified: true,
  authenticatedAt: "2026-07-26T08:00:00.000Z",
};

function handlers(): WorkBuddyGovernedMutationToolHandlers {
  return {
    preparePromptResponse: vi.fn(async () => ({ prepared: true })),
    submitPromptResponse: vi.fn(async () => ({ submitted: true })),
    getPromptResponseReceipt: vi.fn(async () => ({ receiptRef: "receipt:1" })),
    prepareQuestionSelection: vi.fn(async () => ({ prepared: true })),
    submitQuestionSelection: vi.fn(async () => ({ submitted: true })),
    getQuestionSelectionReceipt: vi.fn(async () => ({
      receiptRef: "receipt:2",
    })),
    prepareAdviceDecision: vi.fn(async () => ({ prepared: true })),
    submitAdviceDecision: vi.fn(async () => ({ submitted: true })),
    getAdviceDecisionReceipt: vi.fn(async () => ({
      receiptRef: "receipt:3",
    })),
  };
}

describe("WorkBuddy governed mutation tools", () => {
  it("keeps every prepare, submit, and receipt tool hidden by default", async () => {
    const toolHandlers = handlers();
    const tools =
      createWorkBuddyGovernedMutationToolDefinitions(toolHandlers);
    const dispatcher = createWorkBuddyMcpToolDispatcher({
      flags: {
        gatewayEnabled: true,
        readEnabled: true,
        pushEnabled: true,
        presenceEnabled: true,
        mutationsEnabled: false,
        promptResponsesEnabled: false,
        questionSelectionsEnabled: false,
        adviceDecisionsEnabled: false,
      },
      tools,
    });

    expect(dispatcher.listTools()).toEqual([]);
    await expect(
      dispatcher.dispatch({
        name: "prepare_advice_decision",
        input: {
          workspaceId: "workspace:demo",
          adviceRef: "advice:1",
          expectedVersion: 1,
          decision: {
            outcome: "accepted",
            reason: "Bounded reason",
          },
          idempotencyKey: "idem:advice:1",
        },
        context: { requestId: "request:disabled", identity },
      }),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "MUTATION_DISABLED" },
    });
    expect(toolHandlers.prepareAdviceDecision).not.toHaveBeenCalled();
  });

  it("registers only the bounded response, selection, and advice surfaces", () => {
    const tools = createWorkBuddyGovernedMutationToolDefinitions(
      handlers(),
    );
    const dispatcher = createWorkBuddyMcpToolDispatcher({
      flags: {
        gatewayEnabled: true,
        readEnabled: true,
        pushEnabled: true,
        presenceEnabled: true,
        mutationsEnabled: true,
        promptResponsesEnabled: true,
        questionSelectionsEnabled: true,
        adviceDecisionsEnabled: true,
      },
      tools,
    });

    expect(dispatcher.listTools().map((tool) => tool.name)).toEqual([
      "prepare_prompt_response",
      "submit_prompt_response",
      "get_prompt_response_receipt",
      "prepare_question_selection",
      "submit_question_selection",
      "get_question_selection_receipt",
      "prepare_advice_decision",
      "submit_advice_decision",
      "get_advice_decision_receipt",
    ]);
    expect(dispatcher.listTools().map((tool) => tool.name)).not.toEqual(
      expect.arrayContaining([
        "execute",
        "external_send",
        "dispatch_caio_action",
        "mandate_issue",
      ]),
    );
  });

  it("requires an independent capability flag for each mutation family", async () => {
    const toolHandlers = handlers();
    const dispatcher = createWorkBuddyMcpToolDispatcher({
      flags: {
        gatewayEnabled: true,
        readEnabled: false,
        pushEnabled: false,
        presenceEnabled: false,
        mutationsEnabled: true,
        promptResponsesEnabled: false,
        questionSelectionsEnabled: true,
        adviceDecisionsEnabled: false,
      },
      tools:
        createWorkBuddyGovernedMutationToolDefinitions(toolHandlers),
    });

    expect(dispatcher.listTools().map((tool) => tool.name)).toEqual([
      "prepare_question_selection",
      "submit_question_selection",
      "get_question_selection_receipt",
    ]);
    await expect(
      dispatcher.dispatch({
        name: "prepare_advice_decision",
        input: {
          workspaceId: "workspace:demo",
          adviceRef: "advice:1",
          expectedVersion: 1,
          decision: {
            outcome: "accepted",
            reason: "Bounded reason",
          },
          idempotencyKey: "idem:advice:1",
        },
        context: { requestId: "request:disabled-advice", identity },
      }),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "MUTATION_DISABLED" },
    });
    expect(toolHandlers.prepareAdviceDecision).not.toHaveBeenCalled();
  });

  it("rejects cross-workspace identity and ambiguous advice outcomes", async () => {
    const toolHandlers = handlers();
    const dispatcher = createWorkBuddyMcpToolDispatcher({
      flags: {
        gatewayEnabled: true,
        readEnabled: true,
        pushEnabled: true,
        presenceEnabled: true,
        mutationsEnabled: true,
        promptResponsesEnabled: true,
        questionSelectionsEnabled: true,
        adviceDecisionsEnabled: true,
      },
      tools:
        createWorkBuddyGovernedMutationToolDefinitions(toolHandlers),
    });

    await expect(
      dispatcher.dispatch({
        name: "prepare_advice_decision",
        input: {
          workspaceId: "workspace:other",
          adviceRef: "advice:1",
          expectedVersion: 1,
          decision: {
            outcome: "accepted",
            reason: "Bounded reason",
          },
          idempotencyKey: "idem:advice:1",
        },
        context: { requestId: "request:workspace", identity },
      }),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "SCOPE_DENIED" },
    });

    await expect(
      dispatcher.dispatch({
        name: "prepare_advice_decision",
        input: {
          workspaceId: "workspace:demo",
          adviceRef: "advice:1",
          expectedVersion: 1,
          decision: {
            outcome: "okay",
            reason: "Ambiguous",
          },
          idempotencyKey: "idem:advice:1",
        },
        context: { requestId: "request:ambiguous", identity },
      }),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "INVALID_TOOL_INPUT" },
    });
    expect(toolHandlers.prepareAdviceDecision).not.toHaveBeenCalled();
  });
});
