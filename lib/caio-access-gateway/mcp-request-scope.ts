/**
 * The gateway's project-scope contract for MCP requests.
 *
 * WHY THIS EXISTS
 * ---------------
 * Real MCP traffic on POST /mcp is JSON-RPC 2.0. Tool arguments live under
 * `params.arguments`, never at the top level, and the project-scoping field
 * in the actual tool vocabulary is `portfolioRef` (see
 * lib/caio-collaboration/tool-schemas.ts) — no tool takes `projectRef`.
 * An opportunistic "if payload.projectRef is a string then check it" gate is
 * therefore unreachable for every real payload, and is a confused deputy
 * when a caller supplies both an allowed top-level ref and a different
 * nested one.
 *
 * FAIL-CLOSED RULES (all of them are refusals, never silent allows)
 * ----------------------------------------------------------------
 * 1. The payload must be a JSON-RPC 2.0 envelope with a known method.
 *    An unknown method, or any non-envelope body, is REFUSED
 *    (`project_scope_unresolved`) — a request whose scope cannot be
 *    determined is refused.
 * 2. `tools/call` must name a tool on the server-side allowlist. Unknown or
 *    non-allowlisted names are REFUSED (`scope_violation`).
 * 3. Every allowlisted tool must have a declared scope in
 *    CAIO_TOOL_PROJECT_SCOPES. A tool whose argument schema is not in-tree
 *    is declared `unresolvable` and is REFUSED until a schema exists: the
 *    gateway will not guess which argument carries the project scope.
 * 4. A project-scoped tool must supply EVERY declared scoping field as a
 *    non-empty string. An absent or non-string field is REFUSED.
 * 5. `workspaceId` must be present as a non-empty string; the caller of this
 *    module compares it against the authenticated principal's workspace.
 * 6. Any project-scoping field name that appears anywhere in the payload
 *    outside the tool's declared field set — at envelope level, on a
 *    workspace-scoped tool, or nested at any depth — is REFUSED
 *    (`scope_violation`). This closes the confused-deputy gap: the set of
 *    refs the gate authorizes is exactly the set of refs present in the
 *    payload the executor receives.
 * 7. A payload too deep or too large to scan exhaustively is REFUSED rather
 *    than partially trusted.
 */

import { CaioAccessGatewayError } from "@/lib/caio-access-gateway/gateway-error-contract";
import { assertToolAllowed } from "@/lib/caio-access-gateway/mcp-allowlist";

/**
 * Every field name that can carry a project scope.
 *
 * - `portfolioRef` is the real project-scoping field of the in-tree tool
 *   vocabulary (tool-schemas.ts: get_p1c_read_projection).
 * - `projectRef` is RESERVED: no in-tree tool accepts it, so its presence
 *   anywhere in a payload is a smuggling attempt and is refused.
 */
export const CAIO_PROJECT_SCOPING_FIELD_NAMES = [
  "portfolioRef",
  "projectRef",
] as const;

/** JSON-RPC methods that carry no project scope (MCP handshake surface). */
export const CAIO_MCP_SCOPE_FREE_METHODS = [
  "initialize",
  "notifications/initialized",
  "ping",
  "tools/list",
] as const;

export type CaioToolProjectScope =
  /** The tool is project-scoped; every listed field must be supplied. */
  | Readonly<{ kind: "project"; fields: readonly string[] }>
  /** The tool has no project dimension in its declared schema. */
  | Readonly<{ kind: "workspace" }>
  /**
   * The tool's argument schema is not in this tree, so its project scope
   * cannot be declared from evidence. Requests naming it are refused.
   */
  | Readonly<{ kind: "unresolvable"; note: string }>;

const NO_IN_TREE_SCHEMA =
  "no in-tree argument schema or executor; scope cannot be declared";

/**
 * Declared project scope per allowlisted tool name.
 *
 * MUST stay total over CAIO_GATEWAY_ALLOWED_TOOL_NAMES (asserted by test):
 * adding a tool to the allowlist without declaring its scope is a build-time
 * -visible omission rather than a silent authorization hole.
 */
export const CAIO_TOOL_PROJECT_SCOPES: Readonly<
  Record<string, CaioToolProjectScope>
> = Object.freeze({
  // tool-schemas.ts: { workspaceId, portfolioRef? }. The gateway requires
  // portfolioRef even though the tool schema marks it optional: a read whose
  // project scope is unstated cannot be authorized against live membership.
  get_p1c_read_projection: Object.freeze({
    kind: "project" as const,
    fields: Object.freeze(["portfolioRef"]),
  }),
  // tool-schemas.ts: { workspaceId, severity? } — strict, no project field.
  list_pending_ceo_prompts: Object.freeze({ kind: "workspace" as const }),
  // tool-schemas.ts: { workspaceId, deliveryObjectId } — strict.
  get_ceo_prompt: Object.freeze({ kind: "workspace" as const }),
  list_context_receipts: Object.freeze({
    kind: "unresolvable" as const,
    note: NO_IN_TREE_SCHEMA,
  }),
  get_context_receipt: Object.freeze({
    kind: "unresolvable" as const,
    note: NO_IN_TREE_SCHEMA,
  }),
  query_memory_candidates: Object.freeze({
    kind: "unresolvable" as const,
    note: NO_IN_TREE_SCHEMA,
  }),
  adopt_memory_candidate: Object.freeze({
    kind: "unresolvable" as const,
    note: NO_IN_TREE_SCHEMA,
  }),
  reject_memory_candidate: Object.freeze({
    kind: "unresolvable" as const,
    note: NO_IN_TREE_SCHEMA,
  }),
  submit_restricted_candidate: Object.freeze({
    kind: "unresolvable" as const,
    note: NO_IN_TREE_SCHEMA,
  }),
});

export type CaioMcpRequestScope =
  | Readonly<{
      kind: "no_project_scope";
      method: string;
      toolName: null;
      workspaceId: null;
      projectRefs: readonly string[];
    }>
  | Readonly<{
      kind: "tool_call";
      method: "tools/call";
      toolName: string;
      workspaceId: string;
      projectRefs: readonly string[];
    }>;

/** Bounds for the exhaustive project-field scan. */
const MAX_SCAN_DEPTH = 24;
const MAX_SCAN_NODES = 20_000;

function unresolved(): CaioAccessGatewayError {
  return new CaioAccessGatewayError("project_scope_unresolved");
}

function scopeViolation(): CaioAccessGatewayError {
  return new CaioAccessGatewayError("scope_violation");
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return (
    value !== null && typeof value === "object" && !Array.isArray(value)
  );
}

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : value;
}

/**
 * Collect every project-scoping ref anywhere in a value.
 *
 * Throws `project_scope_unresolved` when the value cannot be scanned within
 * the depth/node budget (an unscannable payload is never partially trusted)
 * and `scope_violation` when a scoping key holds a non-string value.
 */
function collectProjectRefsDeep(root: unknown): readonly string[] {
  const found: string[] = [];
  let nodes = 0;
  const walk = (value: unknown, depth: number): void => {
    nodes += 1;
    if (depth > MAX_SCAN_DEPTH || nodes > MAX_SCAN_NODES) throw unresolved();
    if (Array.isArray(value)) {
      for (const entry of value) walk(entry, depth + 1);
      return;
    }
    if (!isPlainRecord(value)) return;
    for (const [key, entry] of Object.entries(value)) {
      if (
        (CAIO_PROJECT_SCOPING_FIELD_NAMES as readonly string[]).includes(key)
      ) {
        const ref = nonEmptyString(entry);
        if (ref === null) throw scopeViolation();
        found.push(ref);
        continue;
      }
      walk(entry, depth + 1);
    }
  };
  walk(root, 0);
  return Object.freeze(found);
}

function readEnvelope(
  payload: unknown,
): Readonly<{ method: string; params: unknown }> {
  if (!isPlainRecord(payload)) throw unresolved();
  if (payload.jsonrpc !== "2.0") throw unresolved();
  const method = payload.method;
  if (typeof method !== "string" || method.length === 0 || method.length > 200) {
    throw unresolved();
  }
  return Object.freeze({ method, params: payload.params });
}

function readToolCallParams(
  params: unknown,
): Readonly<{ name: string; arguments: Record<string, unknown> }> {
  if (!isPlainRecord(params)) throw unresolved();
  const name = params.name;
  if (typeof name !== "string" || name.length === 0 || name.length > 200) {
    throw unresolved();
  }
  const args = params.arguments ?? {};
  if (!isPlainRecord(args)) throw unresolved();
  return Object.freeze({ name, arguments: args });
}

/**
 * Resolve the project scope a request declares, or refuse it.
 *
 * This is the ONLY sanctioned way to learn which project refs a /mcp request
 * touches. Callers must assert live membership for EVERY returned ref before
 * dispatch, and must hand the returned ref set to the executor so the value
 * that was authorized is the value that gets used.
 */
export function resolveRequestProjectRefs(
  payload: unknown,
): CaioMcpRequestScope {
  const envelope = readEnvelope(payload);

  if (
    (CAIO_MCP_SCOPE_FREE_METHODS as readonly string[]).includes(
      envelope.method,
    )
  ) {
    // Handshake methods touch no project data. They may still not smuggle a
    // project ref anywhere in the payload.
    if (collectProjectRefsDeep(payload).length > 0) throw scopeViolation();
    return Object.freeze({
      kind: "no_project_scope" as const,
      method: envelope.method,
      toolName: null,
      workspaceId: null,
      projectRefs: Object.freeze([]),
    });
  }

  if (envelope.method !== "tools/call") throw unresolved();

  const call = readToolCallParams(envelope.params);
  // The server-side allowlist is on the request path: an unknown or
  // non-allowlisted tool name never reaches an executor.
  assertToolAllowed(call.name);

  const declared = CAIO_TOOL_PROJECT_SCOPES[call.name];
  if (declared === undefined || declared.kind === "unresolvable") {
    throw unresolved();
  }

  const workspaceId = nonEmptyString(call.arguments.workspaceId);
  if (workspaceId === null) throw unresolved();

  const declaredFields =
    declared.kind === "project" ? declared.fields : Object.freeze([]);

  const authorized: string[] = [];
  for (const field of declaredFields) {
    const ref = nonEmptyString(call.arguments[field]);
    if (ref === null) throw unresolved();
    authorized.push(ref);
  }

  // Every ref present anywhere in the payload must be one the declared
  // fields produced; anything else (envelope level, undeclared field name,
  // nested deeper) is a confused-deputy attempt.
  const present = collectProjectRefsDeep(payload);
  const authorizedSet = new Set(authorized);
  if (present.length !== authorized.length) throw scopeViolation();
  for (const ref of present) {
    if (!authorizedSet.has(ref)) throw scopeViolation();
  }

  return Object.freeze({
    kind: "tool_call" as const,
    method: "tools/call" as const,
    toolName: call.name,
    workspaceId,
    projectRefs: Object.freeze([...authorizedSet].sort()),
  });
}

/**
 * Re-assert, immediately before dispatch, that the payload handed to the
 * executor contains no project ref outside the authorized set.
 *
 * `resolveRequestProjectRefs` already guarantees this for the payload it
 * inspected; this function exists so the guarantee is re-checked against the
 * exact object that is forwarded, and so a dispatch adapter can verify it
 * independently.
 */
export function assertPayloadRefsAuthorized(
  payload: unknown,
  authorizedProjectRefs: readonly string[],
): void {
  const allowed = new Set(authorizedProjectRefs);
  for (const ref of collectProjectRefsDeep(payload)) {
    if (!allowed.has(ref)) throw scopeViolation();
  }
}
