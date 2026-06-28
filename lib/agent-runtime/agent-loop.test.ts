import { afterEach, describe, expect, it } from "vitest";

import {
  type AgentDecision,
  type AgentLoopState,
  type AgentToolResult,
  buildSequencePlanner,
  getAgentTool,
  isTerminalAgentState,
  listAgentTools,
  registerAgentTool,
  resetAgentToolsForTest,
  runAgentLoop,
  transitionAgentState,
} from "@/lib/agent-runtime/agent-loop";

const ctx = { agentRunId: "run:case-triage:w1:0001", workspaceId: "w1", maxSteps: 8 };

const okResult: AgentToolResult = { status: "ok", observationRef: "obs:read:row-1" };

afterEach(() => resetAgentToolsForTest());

describe("agent lifecycle state machine (Tier 1.2)", () => {
  it("allows declared transitions and rejects illegal ones (fail-closed)", () => {
    expect(transitionAgentState("created", "deciding")).toBe("deciding");
    expect(transitionAgentState("deciding", "invoking_tool")).toBe("invoking_tool");
    expect(() => transitionAgentState("completed", "deciding")).toThrow(/illegal/);
    expect(() => transitionAgentState("created", "completed")).toThrow(/illegal/);
  });

  it("knows terminal states", () => {
    expect(isTerminalAgentState("completed")).toBe(true);
    expect(isTerminalAgentState("blocked")).toBe(true);
    expect(isTerminalAgentState("awaiting_review")).toBe(true);
    expect(isTerminalAgentState("deciding")).toBe(false);
  });
});

describe("agent tool registry (Tier 1.2)", () => {
  it("registers and looks up tools; duplicate names fail closed", () => {
    registerAgentTool({ name: "read_ctx", riskLevel: "read", invoke: () => okResult });
    expect(getAgentTool("read_ctx")?.riskLevel).toBe("read");
    expect(listAgentTools()).toEqual(["read_ctx"]);
    expect(() => registerAgentTool({ name: "read_ctx", riskLevel: "read", invoke: () => okResult })).toThrow(/already registered/);
  });
});

describe("supervised agent loop (Tier 1.2)", () => {
  it("rejects non-deterministic run ids and non-positive maxSteps", async () => {
    await expect(
      runAgentLoop({ ctx: { ...ctx, agentRunId: "run:550e8400-e29b-41d4-a716-446655440000" }, plan: () => ({ kind: "finish" }) }),
    ).rejects.toThrow(/UUID/);
    await expect(runAgentLoop({ ctx: { ...ctx, maxSteps: 0 }, plan: () => ({ kind: "finish" }) })).rejects.toThrow(/maxSteps/);
  });

  it("runs read tools and finishes, recording deterministic step ids", async () => {
    let invoked = 0;
    registerAgentTool({
      name: "read_ctx",
      riskLevel: "read",
      invoke: () => {
        invoked += 1;
        return okResult;
      },
    });
    const decisions: AgentDecision[] = [
      { kind: "call_tool", toolName: "read_ctx", argsRef: "args:read:1" },
      { kind: "call_tool", toolName: "read_ctx", argsRef: "args:read:2" },
      { kind: "finish", resultRef: "result:summary" },
    ];
    const result = await runAgentLoop({ ctx, plan: buildSequencePlanner(decisions) });

    expect(result.terminationReason).toBe("finished");
    expect(result.finalState).toBe("completed");
    expect(invoked).toBe(2);
    expect(result.steps.map((s) => s.stepId)).toEqual([
      "step:run:case-triage:w1:0001:0",
      "step:run:case-triage:w1:0001:1",
      "step:run:case-triage:w1:0001:2",
    ]);
    expect(result.steps[0].toolResult?.observationRef).toBe("obs:read:row-1");
  });

  it("fails closed when the tool is not registered (fabricates nothing)", async () => {
    const result = await runAgentLoop({
      ctx,
      plan: () => ({ kind: "call_tool", toolName: "ghost_tool", argsRef: "args:x" }),
    });
    expect(result.terminationReason).toBe("tool_not_registered");
    expect(result.finalState).toBe("blocked");
  });

  it("blocks a forbidden-risk tool BEFORE its handler runs", async () => {
    let ran = false;
    registerAgentTool({
      name: "wire_payment",
      riskLevel: "commitment", // forbidden in public Core
      invoke: () => {
        ran = true;
        return okResult;
      },
    });
    const result = await runAgentLoop({
      ctx,
      plan: () => ({ kind: "call_tool", toolName: "wire_payment", argsRef: "args:pay" }),
    });
    expect(result.terminationReason).toBe("blocked_forbidden_risk");
    expect(result.finalState).toBe("blocked");
    expect(ran).toBe(false);
  });

  it("routes a non-automatable risk (repo_write) to human review instead of auto-running", async () => {
    let ran = false;
    registerAgentTool({
      name: "commit_change",
      riskLevel: "repo_write",
      invoke: () => {
        ran = true;
        return okResult;
      },
    });
    const result = await runAgentLoop({
      ctx,
      plan: () => ({ kind: "call_tool", toolName: "commit_change", argsRef: "args:diff" }),
    });
    expect(result.terminationReason).toBe("await_review");
    expect(result.finalState).toBe("awaiting_review");
    expect(ran).toBe(false);
  });

  it("treats a tool error as a fail-closed termination", async () => {
    registerAgentTool({
      name: "read_ctx",
      riskLevel: "read",
      invoke: (): AgentToolResult => ({ status: "error", observationRef: "obs:err", errorCode: "upstream_down" }),
    });
    const result = await runAgentLoop({
      ctx,
      plan: () => ({ kind: "call_tool", toolName: "read_ctx", argsRef: "args:read" }),
    });
    expect(result.terminationReason).toBe("tool_error");
    expect(result.finalState).toBe("failed");
  });

  it("rejects an inline (non-reference) argsRef", async () => {
    registerAgentTool({ name: "read_ctx", riskLevel: "read", invoke: () => okResult });
    const result = await runAgentLoop({
      ctx,
      plan: () => ({ kind: "call_tool", toolName: "read_ctx", argsRef: "name: Jane Doe, balance 1234" }),
    });
    expect(result.terminationReason).toBe("tool_error");
  });

  it("fails closed when the step budget is exhausted without finishing", async () => {
    registerAgentTool({ name: "read_ctx", riskLevel: "read", invoke: () => okResult });
    const planner = (_state: AgentLoopState): AgentDecision => ({ kind: "call_tool", toolName: "read_ctx", argsRef: "args:loop" });
    const result = await runAgentLoop({ ctx: { ...ctx, maxSteps: 3 }, plan: planner });
    expect(result.terminationReason).toBe("max_steps_exceeded");
    expect(result.finalState).toBe("failed");
    expect(result.steps).toHaveLength(3);
  });
});
