import { afterEach, describe, expect, it } from "vitest";

import {
  type AgentDecision,
  type AgentLoopState,
  type AgentToolResult,
  advanceAgentLoopStep,
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
  it("advances one persistable step at a time and resumes from prior state", async () => {
    registerAgentTool({
      name: "read_ctx",
      riskLevel: "read",
      invoke: () => okResult,
    });
    const plan = buildSequencePlanner([
      { kind: "call_tool", toolName: "read_ctx", argsRef: "args:read:1" },
      { kind: "finish", resultRef: "result:done" },
    ]);

    const first = await advanceAgentLoopStep({
      ctx,
      plan,
      state: { steps: [], lifecycle: "created" },
    });
    expect(first.step).toMatchObject({
      index: 0,
      stepId: "step:run:case-triage:w1:0001:0",
      state: "observing",
    });
    expect(first.terminal).toBeNull();

    const second = await advanceAgentLoopStep({
      ctx,
      plan,
      state: first.state,
    });
    expect(second.step).toMatchObject({ index: 1, state: "completed" });
    expect(second.terminal).toEqual({
      finalState: "completed",
      terminationReason: "finished",
    });
  });

  it("fails closed at maxSteps without fabricating another step", async () => {
    const state = {
      lifecycle: "observing" as const,
      steps: [
        {
          index: 0,
          stepId: "step:run:case-triage:w1:0001:0",
          decision: {
            kind: "call_tool" as const,
            toolName: "read_ctx",
            argsRef: "args:read:1",
          },
          toolResult: okResult,
          state: "observing" as const,
        },
      ],
    };
    const result = await advanceAgentLoopStep({
      ctx: { ...ctx, maxSteps: 1 },
      plan: () => ({ kind: "finish" }),
      state,
    });
    expect(result.step).toBeNull();
    expect(result.state.steps).toHaveLength(1);
    expect(result.terminal).toEqual({
      finalState: "failed",
      terminationReason: "max_steps_exceeded",
    });
  });

  it("allows a recoverable caller to route non-read tools to review", async () => {
    let invoked = false;
    registerAgentTool({
      name: "write_local_draft",
      riskLevel: "local_draft",
      invoke: () => {
        invoked = true;
        return okResult;
      },
    });
    const result = await advanceAgentLoopStep({
      ctx,
      plan: () => ({
        kind: "call_tool",
        toolName: "write_local_draft",
        argsRef: "args:draft:1",
      }),
      state: { steps: [], lifecycle: "created" },
      canInvokeTool: (tool) => tool.riskLevel === "read",
    });
    expect(result.terminal).toEqual({
      finalState: "awaiting_review",
      terminationReason: "await_review",
    });
    expect(invoked).toBe(false);
  });

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

  it("fails closed on a finish with an inline (non-reference) resultRef", async () => {
    const result = await runAgentLoop({
      ctx,
      plan: () => ({ kind: "finish", resultRef: "summary: balance is 1234 for Jane" }),
    });
    expect(result.terminationReason).toBe("invalid_output_ref");
    expect(result.finalState).toBe("failed");
  });

  it("fails closed on an await_review with an inline (non-reference) reasonCode", async () => {
    const result = await runAgentLoop({
      ctx,
      plan: () => ({ kind: "await_review", reasonCode: "needs human because amount 4321" }),
    });
    expect(result.terminationReason).toBe("invalid_output_ref");
    expect(result.finalState).toBe("failed");
  });

  it("accepts a reference-token resultRef / reasonCode", async () => {
    const finished = await runAgentLoop({ ctx, plan: () => ({ kind: "finish", resultRef: "result:summary-1" }) });
    expect(finished.terminationReason).toBe("finished");
    const review = await runAgentLoop({ ctx, plan: () => ({ kind: "await_review", reasonCode: "needs_human_approval" }) });
    expect(review.terminationReason).toBe("await_review");
  });

  it("rejects a non-deterministic traceId (UUID)", async () => {
    await expect(
      runAgentLoop({ ctx: { ...ctx, traceId: "550e8400-e29b-41d4-a716-446655440000" }, plan: () => ({ kind: "finish" }) }),
    ).rejects.toThrow(/traceId/);
  });

  it("carries the authoritative workspaceId from ctx into the result", async () => {
    const result = await runAgentLoop({ ctx, plan: () => ({ kind: "finish" }) });
    expect(result.workspaceId).toBe("w1");
  });
});
