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
 * Concrete MCP tool names per capability key.
 *
 * - caio.p1c.read / caio.delivery.read map onto existing read tools from
 *   lib/caio-collaboration/tool-schemas.ts.
 * - The context-receipt / memory-candidate / restricted-submit names are
 *   NEW tool names whose executors are provided elsewhere; this module
 *   only defines the allowlist contract.
 */
export const CAIO_GATEWAY_TOOLS_BY_CAPABILITY: Readonly<
  Record<CaioGatewayCapabilityKey, readonly string[]>
> = Object.freeze({
  "caio.p1c.read": Object.freeze(["get_p1c_read_projection"]),
  "caio.delivery.read": Object.freeze([
    "poll_ceo_prompts",
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
