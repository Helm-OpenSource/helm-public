import { describe, expect, it } from "vitest";

import { CaioAccessGatewayError } from "@/lib/caio-access-gateway/gateway-error-contract";
import { CAIO_GATEWAY_ALLOWED_TOOL_NAMES } from "@/lib/caio-access-gateway/mcp-allowlist";
import {
  CAIO_MCP_SCOPE_FREE_METHODS,
  CAIO_PROJECT_SCOPING_FIELD_NAMES,
  CAIO_TOOL_PROJECT_SCOPES,
  assertPayloadRefsAuthorized,
  resolveRequestProjectRefs,
} from "@/lib/caio-access-gateway/mcp-request-scope";

function expectRefusal(
  work: () => unknown,
  code: "scope_violation" | "project_scope_unresolved",
): void {
  let caught: unknown;
  try {
    work();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(CaioAccessGatewayError);
  expect((caught as CaioAccessGatewayError).code).toBe(code);
  expect((caught as CaioAccessGatewayError).wireStatus).toBe(403);
}

function toolCall(name: string, args: unknown): unknown {
  return {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: { name, arguments: args },
  };
}

describe("declared per-tool project scope map", () => {
  it("declares a scope for every allowlisted tool and for nothing else", () => {
    expect(Object.keys(CAIO_TOOL_PROJECT_SCOPES).sort()).toEqual(
      [...CAIO_GATEWAY_ALLOWED_TOOL_NAMES].sort(),
    );
  });

  it("uses the real project-scoping field names from the tool vocabulary", () => {
    expect(CAIO_PROJECT_SCOPING_FIELD_NAMES).toContain("portfolioRef");
    // projectRef is reserved: no in-tree tool takes it, so its presence is
    // always a smuggling attempt.
    expect(CAIO_PROJECT_SCOPING_FIELD_NAMES).toContain("projectRef");
    expect(CAIO_TOOL_PROJECT_SCOPES.get_p1c_read_projection).toEqual({
      kind: "project",
      fields: ["portfolioRef"],
    });
  });
});

describe("resolveRequestProjectRefs — JSON-RPC shape", () => {
  it("extracts the project ref from params.arguments of a real tools/call", () => {
    const scope = resolveRequestProjectRefs(
      toolCall("get_p1c_read_projection", {
        workspaceId: "ws_1",
        portfolioRef: "project:alpha",
      }),
    );
    expect(scope).toEqual({
      kind: "tool_call",
      method: "tools/call",
      toolName: "get_p1c_read_projection",
      workspaceId: "ws_1",
      projectRefs: ["project:alpha"],
    });
  });

  it("resolves workspace-scoped delivery reads with an empty project ref set", () => {
    for (const name of ["list_pending_ceo_prompts", "get_ceo_prompt"]) {
      const scope = resolveRequestProjectRefs(
        toolCall(name, {
          workspaceId: "ws_1",
          deliveryObjectId: "delivery:1",
          severity: "normal",
        }),
      );
      expect(scope.kind).toBe("tool_call");
      expect(scope.toolName).toBe(name);
      expect(scope.workspaceId).toBe("ws_1");
      expect(scope.projectRefs).toEqual([]);
    }
  });

  it("allows the scope-free handshake methods without a project scope", () => {
    for (const method of CAIO_MCP_SCOPE_FREE_METHODS) {
      const scope = resolveRequestProjectRefs({
        jsonrpc: "2.0",
        id: 1,
        method,
        params: { protocolVersion: "2025-06-18" },
      });
      expect(scope).toEqual({
        kind: "no_project_scope",
        method,
        toolName: null,
        workspaceId: null,
        projectRefs: [],
      });
    }
  });

  it("refuses an unknown JSON-RPC method", () => {
    expectRefusal(
      () =>
        resolveRequestProjectRefs({
          jsonrpc: "2.0",
          id: 1,
          method: "resources/read",
          params: {},
        }),
      "project_scope_unresolved",
    );
  });

  it("refuses a payload that is not a JSON-RPC envelope", () => {
    for (const payload of [
      null,
      "string",
      42,
      [],
      {},
      { tool: "get_p1c_read_projection", projectRef: "project:alpha" },
    ]) {
      expectRefusal(
        () => resolveRequestProjectRefs(payload),
        "project_scope_unresolved",
      );
    }
  });

  it("refuses an unknown / non-allowlisted tool name", () => {
    expectRefusal(
      () =>
        resolveRequestProjectRefs(
          toolCall("submit_prompt_response", { workspaceId: "ws_1" }),
        ),
      "scope_violation",
    );
    expectRefusal(
      () =>
        resolveRequestProjectRefs(
          toolCall("totally_unknown_tool", { workspaceId: "ws_1" }),
        ),
      "scope_violation",
    );
  });

  it("refuses a project-scoped tool whose declared scoping field is absent", () => {
    expectRefusal(
      () =>
        resolveRequestProjectRefs(
          toolCall("get_p1c_read_projection", { workspaceId: "ws_1" }),
        ),
      "project_scope_unresolved",
    );
  });

  it("refuses a declared scoping field that is not a non-empty string", () => {
    for (const value of [null, 42, "", "   ", { ref: "x" }, ["a"]]) {
      expectRefusal(
        () =>
          resolveRequestProjectRefs(
            toolCall("get_p1c_read_projection", {
              workspaceId: "ws_1",
              portfolioRef: value,
            }),
          ),
        "project_scope_unresolved",
      );
    }
  });

  it("refuses a missing or empty workspaceId argument", () => {
    for (const args of [
      { portfolioRef: "project:alpha" },
      { workspaceId: "", portfolioRef: "project:alpha" },
      { workspaceId: 7, portfolioRef: "project:alpha" },
    ]) {
      expectRefusal(
        () =>
          resolveRequestProjectRefs(toolCall("get_p1c_read_projection", args)),
        "project_scope_unresolved",
      );
    }
  });

  it("refuses an allowlisted tool whose argument schema is not in-tree", () => {
    for (const name of [
      "list_context_receipts",
      "get_context_receipt",
      "query_memory_candidates",
      "adopt_memory_candidate",
      "reject_memory_candidate",
      "submit_restricted_candidate",
    ]) {
      expectRefusal(
        () =>
          resolveRequestProjectRefs(
            toolCall(name, {
              workspaceId: "ws_1",
              portfolioRef: "project:alpha",
            }),
          ),
        "project_scope_unresolved",
      );
    }
  });

  it("refuses a reserved project field on a workspace-scoped tool", () => {
    expectRefusal(
      () =>
        resolveRequestProjectRefs(
          toolCall("get_ceo_prompt", {
            workspaceId: "ws_1",
            deliveryObjectId: "delivery:1",
            portfolioRef: "project:beta",
          }),
        ),
      "scope_violation",
    );
  });

  it("refuses an undeclared project field on a project-scoped tool", () => {
    expectRefusal(
      () =>
        resolveRequestProjectRefs(
          toolCall("get_p1c_read_projection", {
            workspaceId: "ws_1",
            portfolioRef: "project:alpha",
            projectRef: "project:beta",
          }),
        ),
      "scope_violation",
    );
  });

  it("refuses a top-level project field on the JSON-RPC envelope", () => {
    expectRefusal(
      () =>
        resolveRequestProjectRefs({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          projectRef: "project:alpha",
          params: {
            name: "get_p1c_read_projection",
            arguments: {
              workspaceId: "ws_1",
              portfolioRef: "project:beta",
            },
          },
        }),
      "scope_violation",
    );
  });

  it("refuses a project field nested deeper than the declared arguments", () => {
    expectRefusal(
      () =>
        resolveRequestProjectRefs(
          toolCall("get_p1c_read_projection", {
            workspaceId: "ws_1",
            portfolioRef: "project:alpha",
            cursor: { after: { portfolioRef: "project:beta" } },
          }),
        ),
      "scope_violation",
    );
  });

  it("refuses a payload that exceeds the scope-scan node budget", () => {
    // Deeply nested payloads cannot be exhaustively scanned, so they are
    // refused rather than partially trusted.
    let deep: Record<string, unknown> = { leaf: true };
    for (let index = 0; index < 64; index += 1) {
      deep = { nested: deep };
    }
    expectRefusal(
      () =>
        resolveRequestProjectRefs(
          toolCall("get_p1c_read_projection", {
            workspaceId: "ws_1",
            portfolioRef: "project:alpha",
            deep,
          }),
        ),
      "project_scope_unresolved",
    );
  });
});

describe("assertPayloadRefsAuthorized", () => {
  it("accepts a payload whose every project ref is in the authorized set", () => {
    expect(() =>
      assertPayloadRefsAuthorized(
        toolCall("get_p1c_read_projection", {
          workspaceId: "ws_1",
          portfolioRef: "project:alpha",
        }),
        ["project:alpha"],
      ),
    ).not.toThrow();
  });

  it("refuses a payload carrying a ref outside the authorized set", () => {
    expectRefusal(
      () =>
        assertPayloadRefsAuthorized(
          toolCall("get_p1c_read_projection", {
            workspaceId: "ws_1",
            portfolioRef: "project:beta",
          }),
          ["project:alpha"],
        ),
      "scope_violation",
    );
  });
});
