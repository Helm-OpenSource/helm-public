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

export const AGENT_LIFECYCLE_STATES = [
  "created",
  "deciding",
  "invoking_tool",
  "observing",
  "awaiting_review",
  "completed",
  "failed",
  "blocked",
] as const;
export type AgentLifecycleState = (typeof AGENT_LIFECYCLE_STATES)[number];

export function isAgentLifecycleState(
  value: unknown,
): value is AgentLifecycleState {
  return AGENT_LIFECYCLE_STATES.includes(value as AgentLifecycleState);
}

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
  | "invalid_output_ref"
  | "max_steps_exceeded";

export type AgentLoopTerminal = Readonly<{
  finalState: AgentLifecycleState;
  terminationReason: AgentLoopTerminationReason;
}>;

export type AgentLoopAdvanceResult = Readonly<{
  state: AgentLoopState;
  /** The single new step produced by this transition, or null when the step budget ended. */
  step: AgentStep | null;
  terminal: AgentLoopTerminal | null;
}>;

export type AgentPlannerExecutor = (input: {
  plan: AgentPlanner;
  state: AgentLoopState;
  ctx: AgentRunContext;
}) => AgentDecision | Promise<AgentDecision>;

export type AgentToolExecutor = (input: {
  tool: AgentToolDefinition;
  invocation: AgentToolInvocation;
  ctx: AgentRunContext;
}) => AgentToolResult | Promise<AgentToolResult>;

export type AgentLoopResult = Readonly<{
  agentRunId: string;
  /** The authoritative workspace the loop ran in (carried from ctx). Persisters MUST use
   * this as the single source of truth so a run can never be written to a foreign tenant. */
  workspaceId: string;
  finalState: AgentLifecycleState;
  steps: readonly AgentStep[];
  terminationReason: AgentLoopTerminationReason;
}>;

function assertAgentRunContext(ctx: AgentRunContext): void {
  assertDeterministicId("agentRunId", ctx.agentRunId);
  if (ctx.traceId) assertDeterministicId("traceId", ctx.traceId);
  if (!Number.isInteger(ctx.maxSteps) || ctx.maxSteps < 1) {
    throw new Error("agent loop requires a positive integer maxSteps");
  }
}

function appendStepToState(
  state: AgentLoopState,
  ctx: AgentRunContext,
  decision: AgentDecision,
  lifecycle: AgentLifecycleState,
  toolResult?: AgentToolResult,
): { state: AgentLoopState; step: AgentStep } {
  const index = state.steps.length;
  const step: AgentStep = {
    index,
    stepId: `step:${ctx.agentRunId}:${index}`,
    decision,
    ...(toolResult ? { toolResult } : {}),
    state: lifecycle,
  };
  return {
    state: { steps: [...state.steps, step], lifecycle },
    step,
  };
}

/**
 * Advance exactly one persistable agent step. This is the recovery seam: callers may
 * persist `step` and `state.lifecycle` before invoking the primitive again. The default
 * planner/tool executors preserve `runAgentLoop` behavior; recoverable runtimes can wrap
 * model/read calls with durable attempt accounting and restrict invocation to read tools.
 */
export async function advanceAgentLoopStep(input: {
  ctx: AgentRunContext;
  plan: AgentPlanner;
  state: AgentLoopState;
  executePlanner?: AgentPlannerExecutor;
  executeTool?: AgentToolExecutor;
  canInvokeTool?: (tool: AgentToolDefinition) => boolean;
}): Promise<AgentLoopAdvanceResult> {
  const { ctx, plan, state } = input;
  assertAgentRunContext(ctx);
  if (isTerminalAgentState(state.lifecycle)) {
    throw new Error(`cannot advance terminal agent lifecycle: ${state.lifecycle}`);
  }

  if (state.steps.length >= ctx.maxSteps) {
    const lifecycle = transitionAgentState(state.lifecycle, "failed");
    return {
      state: { steps: [...state.steps], lifecycle },
      step: null,
      terminal: {
        finalState: lifecycle,
        terminationReason: "max_steps_exceeded",
      },
    };
  }

  let lifecycle = transitionAgentState(state.lifecycle, "deciding");
  const decidingState: AgentLoopState = {
    steps: [...state.steps],
    lifecycle,
  };
  const executePlanner: AgentPlannerExecutor =
    input.executePlanner ??
    ((executorInput) =>
      executorInput.plan(
        {
          steps: [...executorInput.state.steps],
          lifecycle: executorInput.state.lifecycle,
        },
        executorInput.ctx,
      ));
  const decision = await executePlanner({ plan, state: decidingState, ctx });

  const finishWithStep = (
    nextLifecycle: AgentLifecycleState,
    terminationReason: AgentLoopTerminationReason | null,
    toolResult?: AgentToolResult,
  ): AgentLoopAdvanceResult => {
    const appended = appendStepToState(
      state,
      ctx,
      decision,
      nextLifecycle,
      toolResult,
    );
    return {
      ...appended,
      terminal: terminationReason
        ? { finalState: nextLifecycle, terminationReason }
        : null,
    };
  };

  if (decision.kind === "finish") {
    if (
      decision.resultRef !== undefined &&
      !isReferenceToken(decision.resultRef)
    ) {
      lifecycle = transitionAgentState(lifecycle, "failed");
      return finishWithStep(lifecycle, "invalid_output_ref");
    }
    lifecycle = transitionAgentState(lifecycle, "completed");
    return finishWithStep(lifecycle, "finished");
  }

  if (decision.kind === "await_review") {
    if (!isReferenceToken(decision.reasonCode)) {
      lifecycle = transitionAgentState(lifecycle, "failed");
      return finishWithStep(lifecycle, "invalid_output_ref");
    }
    lifecycle = transitionAgentState(lifecycle, "awaiting_review");
    return finishWithStep(lifecycle, "await_review");
  }

  if (!isReferenceToken(decision.argsRef)) {
    lifecycle = transitionAgentState(lifecycle, "failed");
    return finishWithStep(lifecycle, "tool_error");
  }

  const tool = getAgentTool(decision.toolName);
  if (!tool) {
    lifecycle = transitionAgentState(lifecycle, "blocked");
    return finishWithStep(lifecycle, "tool_not_registered");
  }
  if (AGENT_FORBIDDEN_RISKS.has(tool.riskLevel)) {
    lifecycle = transitionAgentState(lifecycle, "blocked");
    return finishWithStep(lifecycle, "blocked_forbidden_risk");
  }
  if (
    !AGENT_PUBLIC_CORE_AUTOMATABLE_RISKS.has(tool.riskLevel) ||
    (input.canInvokeTool && !input.canInvokeTool(tool))
  ) {
    lifecycle = transitionAgentState(lifecycle, "awaiting_review");
    return finishWithStep(lifecycle, "await_review");
  }

  lifecycle = transitionAgentState(lifecycle, "invoking_tool");
  const invocation = {
    toolName: decision.toolName,
    argsRef: decision.argsRef,
  };
  const executeTool: AgentToolExecutor =
    input.executeTool ??
    ((executorInput) =>
      executorInput.tool.invoke(executorInput.invocation, executorInput.ctx));
  const result = await executeTool({ tool, invocation, ctx });
  if (result.status === "error" || !isReferenceToken(result.observationRef)) {
    lifecycle = transitionAgentState(lifecycle, "failed");
    return finishWithStep(lifecycle, "tool_error", result);
  }
  lifecycle = transitionAgentState(lifecycle, "observing");
  return finishWithStep(lifecycle, null, result);
}

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
  assertAgentRunContext(ctx);
  let state: AgentLoopState = { steps: [], lifecycle: "created" };
  for (;;) {
    const advanced = await advanceAgentLoopStep({ ctx, plan, state });
    state = advanced.state;
    if (!advanced.terminal) continue;
    return Object.freeze({
      agentRunId: ctx.agentRunId,
      workspaceId: ctx.workspaceId,
      finalState: advanced.terminal.finalState,
      steps: Object.freeze([...state.steps]),
      terminationReason: advanced.terminal.terminationReason,
    });
  }
}
