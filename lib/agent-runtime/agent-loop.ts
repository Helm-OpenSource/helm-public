/**
 * lib/agent-runtime/agent-loop.ts — supervised agent execution loop + tool kernel (Tier 1.2).
 *
 * The AgentOS review (P-A) found Helm governs agent actions superbly but has no agent
 * RUNTIME: no execution loop (receive→decide→call_tool→observe→loop), no tool
 * registry with a real register API (lib/tools is a 2-entry stub + a NOT_IMPLEMENTED
 * executor), and no agent lifecycle state machine. So "agents" today = humans + proposals.
 *
 * This is the missing execution substrate, built to KEEP the governance kernel rather than
 * bypass it:
 *  - a real tool registry (registerAgentTool/getAgentTool/...) keyed by the existing
 *    AgentImplementationRisk vocabulary — no forked risk enum;
 *  - a fail-closed lifecycle state machine (invalid transitions throw);
 *  - a bounded, supervised loop that, every step, gates the planned tool call against the
 *    same risk policy public Core already enforces (AGENT_FORBIDDEN_RISKS blocked;
 *    non-automatable risks routed to human review) BEFORE any handler runs.
 *
 * The loop itself performs NO side effects: actual tool work is delegated to the
 * registered tool's invoke handler (the seam). An empty registry fails closed
 * ("tool_not_registered"), never fabricates. Safety rails match the rest of Helm:
 * deterministic ids (no UUID / no ms timestamp), reference-only args/observations
 * (no PII / no raw values inline), workspace-scoped, bounded steps.
 */

import {
  AGENT_FORBIDDEN_RISKS,
  AGENT_PUBLIC_CORE_AUTOMATABLE_RISKS,
  type AgentImplementationRisk,
} from "@/lib/agentic/contracts";

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const MS_TIMESTAMP_RE = /\b\d{13,}\b/;

/** A reference token (no inline content): non-empty, no whitespace, no PII inline. */
function isReferenceToken(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "" && !/\s/.test(value);
}

function assertDeterministicId(name: string, value: string): void {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`agent loop requires a non-empty ${name}`);
  }
  if (UUID_RE.test(value)) throw new Error(`agent loop ${name} must not contain a UUID`);
  if (MS_TIMESTAMP_RE.test(value)) throw new Error(`agent loop ${name} must not contain a ms timestamp`);
}

// --- lifecycle state machine --------------------------------------------------

export type AgentLifecycleState =
  | "created"
  | "deciding"
  | "invoking_tool"
  | "observing"
  | "awaiting_review"
  | "completed"
  | "failed"
  | "blocked";

/** Allowed transitions. Terminal states (completed/failed/blocked) have no exits. */
const ALLOWED_TRANSITIONS: Readonly<Record<AgentLifecycleState, ReadonlySet<AgentLifecycleState>>> = {
  created: new Set(["deciding", "failed"]),
  deciding: new Set(["invoking_tool", "awaiting_review", "completed", "blocked", "failed"]),
  invoking_tool: new Set(["observing", "failed", "blocked"]),
  observing: new Set(["deciding", "completed", "failed"]),
  awaiting_review: new Set(),
  completed: new Set(),
  failed: new Set(),
  blocked: new Set(),
};

export function isTerminalAgentState(state: AgentLifecycleState): boolean {
  return ALLOWED_TRANSITIONS[state].size === 0;
}

/** fail-closed transition: throws on an undeclared transition. */
export function transitionAgentState(
  from: AgentLifecycleState,
  to: AgentLifecycleState,
): AgentLifecycleState {
  if (!ALLOWED_TRANSITIONS[from]?.has(to)) {
    throw new Error(`illegal agent lifecycle transition: ${from} -> ${to}`);
  }
  return to;
}

// --- tool registry (real register API; the existing lib/tools stub has none) ---

export type AgentToolInvocation = Readonly<{
  toolName: string;
  /** Reference to the call arguments (no PII / no raw values inline). */
  argsRef: string;
}>;

export type AgentToolResult = Readonly<{
  status: "ok" | "error";
  /** Reference to the observation/output (no PII / no raw values inline). */
  observationRef: string;
  errorCode?: string;
}>;

export type AgentRunContext = Readonly<{
  /** Deterministic run id (no UUID / no ms timestamp). */
  agentRunId: string;
  workspaceId: string;
  /** Hard upper bound on loop steps (fail-closed when exceeded). */
  maxSteps: number;
  traceId?: string | null;
}>;

export type AgentToolHandler = (
  invocation: AgentToolInvocation,
  ctx: AgentRunContext,
) => AgentToolResult | Promise<AgentToolResult>;

export type AgentToolDefinition = Readonly<{
  name: string;
  /** Reuses the existing public-Core risk vocabulary; no forked enum. */
  riskLevel: AgentImplementationRisk;
  invoke: AgentToolHandler;
}>;

let toolRegistry = new Map<string, AgentToolDefinition>();

/** Register a tool. Duplicate names fail closed (ambiguous dispatch is a defect). */
export function registerAgentTool(def: AgentToolDefinition): void {
  if (!def?.name || def.name.trim() === "") throw new Error("agent tool requires a name");
  if (toolRegistry.has(def.name)) throw new Error(`agent tool already registered: ${def.name}`);
  toolRegistry.set(def.name, def);
}

export function getAgentTool(name: string): AgentToolDefinition | undefined {
  return toolRegistry.get(name);
}

export function listAgentTools(): string[] {
  return [...toolRegistry.keys()];
}

export function resetAgentToolsForTest(): void {
  toolRegistry = new Map();
}

// --- the supervised loop ------------------------------------------------------

export type AgentDecision =
  | Readonly<{ kind: "call_tool"; toolName: string; argsRef: string }>
  | Readonly<{ kind: "finish"; resultRef?: string }>
  | Readonly<{ kind: "await_review"; reasonCode: string }>;

export type AgentStep = Readonly<{
  index: number;
  /** Deterministic step id: step:<agentRunId>:<index>. */
  stepId: string;
  decision: AgentDecision;
  toolResult?: AgentToolResult;
  state: AgentLifecycleState;
}>;

export type AgentLoopState = Readonly<{
  steps: readonly AgentStep[];
  lifecycle: AgentLifecycleState;
}>;

export type AgentPlanner = (
  state: AgentLoopState,
  ctx: AgentRunContext,
) => AgentDecision | Promise<AgentDecision>;

/**
 * A deterministic planner that replays a fixed decision sequence (one per step),
 * finishing once the sequence is exhausted. Useful for replaying a pre-approved plan
 * and for tests — keeps the loop free of any nondeterministic default.
 */
export function buildSequencePlanner(decisions: readonly AgentDecision[]): AgentPlanner {
  return (state: AgentLoopState): AgentDecision => {
    const next = decisions[state.steps.length];
    return next ?? { kind: "finish" };
  };
}

export type AgentLoopTerminationReason =
  | "finished"
  | "await_review"
  | "blocked_forbidden_risk"
  | "tool_not_registered"
  | "tool_error"
  | "max_steps_exceeded";

export type AgentLoopResult = Readonly<{
  agentRunId: string;
  /** The authoritative workspace the loop ran in (carried from ctx). Persisters MUST use
   * this as the single source of truth so a run can never be written to a foreign tenant. */
  workspaceId: string;
  finalState: AgentLifecycleState;
  steps: readonly AgentStep[];
  terminationReason: AgentLoopTerminationReason;
}>;

/**
 * Run a bounded, supervised agent loop. Each step: planner decides → if a tool call,
 * the tool's declared risk is gated against public-Core policy BEFORE the handler runs
 * (forbidden → blocked; non-automatable → human review); the registered handler (seam)
 * performs the work; the observation is recorded reference-only; loop. The loop performs
 * no side effects itself and fabricates nothing — an unregistered tool fails closed.
 */
export async function runAgentLoop(input: {
  ctx: AgentRunContext;
  plan: AgentPlanner;
}): Promise<AgentLoopResult> {
  const { ctx, plan } = input;
  assertDeterministicId("agentRunId", ctx.agentRunId);
  if (!Number.isInteger(ctx.maxSteps) || ctx.maxSteps < 1) {
    throw new Error("agent loop requires a positive integer maxSteps");
  }

  const steps: AgentStep[] = [];
  let lifecycle: AgentLifecycleState = "created";

  const record = (decision: AgentDecision, state: AgentLifecycleState, toolResult?: AgentToolResult) => {
    const index = steps.length;
    steps.push({
      index,
      stepId: `step:${ctx.agentRunId}:${index}`,
      decision,
      ...(toolResult ? { toolResult } : {}),
      state,
    });
  };

  const finish = (
    finalState: AgentLifecycleState,
    terminationReason: AgentLoopTerminationReason,
  ): AgentLoopResult =>
    Object.freeze({ agentRunId: ctx.agentRunId, workspaceId: ctx.workspaceId, finalState, steps: Object.freeze([...steps]), terminationReason });

  for (let i = 0; i < ctx.maxSteps; i += 1) {
    lifecycle = transitionAgentState(lifecycle, "deciding");
    const decision = await plan({ steps: [...steps], lifecycle }, ctx);

    if (decision.kind === "finish") {
      lifecycle = transitionAgentState(lifecycle, "completed");
      record(decision, lifecycle);
      return finish(lifecycle, "finished");
    }

    if (decision.kind === "await_review") {
      lifecycle = transitionAgentState(lifecycle, "awaiting_review");
      record(decision, lifecycle);
      return finish(lifecycle, "await_review");
    }

    // decision.kind === "call_tool"
    if (!isReferenceToken(decision.argsRef)) {
      lifecycle = transitionAgentState(lifecycle, "failed");
      record(decision, lifecycle);
      return finish(lifecycle, "tool_error");
    }

    const tool = getAgentTool(decision.toolName);
    if (!tool) {
      lifecycle = transitionAgentState(lifecycle, "blocked");
      record(decision, lifecycle);
      return finish(lifecycle, "tool_not_registered");
    }

    if (AGENT_FORBIDDEN_RISKS.has(tool.riskLevel)) {
      lifecycle = transitionAgentState(lifecycle, "blocked");
      record(decision, lifecycle);
      return finish(lifecycle, "blocked_forbidden_risk");
    }

    if (!AGENT_PUBLIC_CORE_AUTOMATABLE_RISKS.has(tool.riskLevel)) {
      // e.g. repo_write — allowed to exist, but never auto-run in public Core: route to human review.
      lifecycle = transitionAgentState(lifecycle, "awaiting_review");
      record(decision, lifecycle);
      return finish(lifecycle, "await_review");
    }

    lifecycle = transitionAgentState(lifecycle, "invoking_tool");
    const result = await tool.invoke({ toolName: decision.toolName, argsRef: decision.argsRef }, ctx);

    if (result.status === "error" || !isReferenceToken(result.observationRef)) {
      lifecycle = transitionAgentState(lifecycle, "failed");
      record(decision, lifecycle, result);
      return finish(lifecycle, "tool_error");
    }

    lifecycle = transitionAgentState(lifecycle, "observing");
    record(decision, lifecycle, result);
    // back to the top of the loop (observing -> deciding) for the next step.
  }

  // Exhausted the step budget without the planner finishing → fail closed.
  // Every loop continuation leaves lifecycle at "observing", from which "failed" is legal.
  lifecycle = transitionAgentState(lifecycle, "failed");
  return finish(lifecycle, "max_steps_exceeded");
}
