/**
 * Server-side explicit MCP tool allowlist for the CAIO access gateway.
 *
 * v1 grants EXACTLY the capability keys below and rejects everything
 * else. The allowlist is enforced server-side: a client can never widen
 * its own surface, and unknown or forbidden tool names fail with a typed
 * `scope_violation` (403-class) error.
 *
 * Approval, send, presence, and canonical production-write tools (the
 * prepare_ / submit_ mutation pairs from the WorkBuddy dispatcher) are
 * deliberately NOT allowlisted.
 */

import { CaioAccessGatewayError } from "@/lib/caio-access-gateway/gateway-error-contract";

export const CAIO_GATEWAY_CAPABILITY_KEYS = [
  "caio.p1c.read",
  "caio.delivery.read",
  "caio.context_receipt.read",
  "caio.memory_candidate.query",
  "caio.memory_candidate.adopt",
  "caio.memory_candidate.reject",
  "caio.candidate.submit_restricted",
] as const;

export type CaioGatewayCapabilityKey =
  (typeof CAIO_GATEWAY_CAPABILITY_KEYS)[number];

/**
 * The three — and only three — mutations v1 intends to expose. Every other
 * allowlisted tool must be read-only. Names on this list are exempt from the
 * forbidden-name patterns below; nothing else is.
 */
export const CAIO_GATEWAY_INTENDED_MUTATION_TOOL_NAMES: readonly string[] =
  Object.freeze([
    "adopt_memory_candidate",
    "reject_memory_candidate",
    "submit_restricted_candidate",
  ]);

/**
 * In-tree tool names whose executor was READ and found to write. Nothing on
 * this list may ever be allowlisted (asserted by test).
 *
 * - poll_ceo_prompts: despite the "read" shape of caio.delivery.read, its
 *   executor claims prompts (delivery.service.ts claimedAt), records a
 *   presentation (presentedAt) and transitions the delivery envelope to
 *   "delivered". It is a state-mutating dequeue, not a read.
 * - begin_/complete_owner_presence_challenge: presence tools.
 * - the prepare_/submit_/get_*_receipt trio set: canonical production writes.
 */
export const CAIO_GATEWAY_WRITING_TOOL_NAMES: readonly string[] =
  Object.freeze([
    "poll_ceo_prompts",
    "begin_owner_presence_challenge",
    "complete_owner_presence_challenge",
    "prepare_prompt_response",
    "submit_prompt_response",
    "prepare_question_selection",
    "submit_question_selection",
    "prepare_advice_decision",
    "submit_advice_decision",
  ]);

/**
 * Name-shape refusals. A tool whose NAME advertises approval, sending,
 * execution, preparation of a production write, presence, or destruction may
 * not be allowlisted, regardless of capability mapping.
 */
export const CAIO_GATEWAY_FORBIDDEN_TOOL_NAME_PATTERNS: readonly RegExp[] =
  Object.freeze([
    /approve/i,
    /\bsend|_send|^send_/i,
    /execute/i,
    /^prepare_/i,
    /^submit_/i,
    /presence/i,
    /poll_/i,
    /delete|purge|reset/i,
    /^write_|_write$/i,
    /settle|dispatch_call|place_call/i,
  ]);

/**
 * Concrete MCP tool names per capability key.
 *
 * - caio.p1c.read / caio.delivery.read map onto existing READ-ONLY tools
 *   from lib/caio-collaboration/tool-schemas.ts. poll_ceo_prompts is
 *   deliberately NOT mapped here: its executor writes (see
 *   CAIO_GATEWAY_WRITING_TOOL_NAMES), so a read capability must not carry it.
 * - The context-receipt / memory-candidate / restricted-submit names are
 *   NEW tool names whose executors are provided elsewhere; this module only
 *   defines the allowlist contract. Because their argument schemas are not in
 *   this tree, mcp-request-scope.ts declares their project scope
 *   "unresolvable" and the gateway REFUSES requests naming them until a
 *   schema exists — the allowlist entry alone grants nothing.
 */
export const CAIO_GATEWAY_TOOLS_BY_CAPABILITY: Readonly<
  Record<CaioGatewayCapabilityKey, readonly string[]>
> = Object.freeze({
  "caio.p1c.read": Object.freeze(["get_p1c_read_projection"]),
  "caio.delivery.read": Object.freeze([
    "list_pending_ceo_prompts",
    "get_ceo_prompt",
  ]),
  "caio.context_receipt.read": Object.freeze([
    "list_context_receipts",
    "get_context_receipt",
  ]),
  "caio.memory_candidate.query": Object.freeze(["query_memory_candidates"]),
  "caio.memory_candidate.adopt": Object.freeze(["adopt_memory_candidate"]),
  "caio.memory_candidate.reject": Object.freeze(["reject_memory_candidate"]),
  "caio.candidate.submit_restricted": Object.freeze([
    "submit_restricted_candidate",
  ]),
});

function buildAllowedToolIndex(): ReadonlyMap<
  string,
  CaioGatewayCapabilityKey
> {
  const index = new Map<string, CaioGatewayCapabilityKey>();
  for (const capability of CAIO_GATEWAY_CAPABILITY_KEYS) {
    for (const toolName of CAIO_GATEWAY_TOOLS_BY_CAPABILITY[capability]) {
      if (index.has(toolName)) {
        throw new Error(
          `CAIO gateway allowlist tool mapped twice: ${toolName}`,
        );
      }
      index.set(toolName, capability);
    }
  }
  return index;
}

const ALLOWED_TOOL_INDEX = buildAllowedToolIndex();

export const CAIO_GATEWAY_ALLOWED_TOOL_NAMES: readonly string[] =
  Object.freeze([...ALLOWED_TOOL_INDEX.keys()]);

export function isCaioGatewayCapabilityKey(
  value: string,
): value is CaioGatewayCapabilityKey {
  return (CAIO_GATEWAY_CAPABILITY_KEYS as readonly string[]).includes(value);
}

export function isCaioToolAllowed(toolName: string): boolean {
  return ALLOWED_TOOL_INDEX.has(toolName);
}

/** Returns the owning capability key for an allowlisted tool, else null. */
export function capabilityForCaioTool(
  toolName: string,
): CaioGatewayCapabilityKey | null {
  return ALLOWED_TOOL_INDEX.get(toolName) ?? null;
}

/**
 * Throws a typed 403-class `scope_violation` error for any tool name
 * outside the explicit v1 allowlist (unknown and forbidden alike).
 */
export function assertToolAllowed(toolName: string): void {
  if (!ALLOWED_TOOL_INDEX.has(toolName)) {
    throw new CaioAccessGatewayError("scope_violation");
  }
}

/**
 * Drops every tool definition whose name is not explicitly allowlisted.
 * Used when projecting an upstream tool catalog through the gateway.
 */
export function filterToolDefinitions<T extends Readonly<{ name: string }>>(
  tools: readonly T[],
): readonly T[] {
  return Object.freeze(
    tools.filter((tool) => ALLOWED_TOOL_INDEX.has(tool.name)),
  );
}
