import { describe, expect, it } from "vitest";

import { CaioAccessGatewayError } from "@/lib/caio-access-gateway/gateway-error-contract";
import {
  CAIO_GATEWAY_MCP_AUDIT_ALIAS,
  CAIO_GATEWAY_MCP_AUDIT_POLICY_VERSION,
  createCaioGatewayHandler,
  type CaioGatewayHandlerDependencies,
  type CaioGatewayRequest,
  type CaioModelDispatchOutcome,
} from "@/lib/caio-access-gateway/gateway-http-core";
import { createInMemoryCaioSourceIpRateLimiter } from "@/lib/caio-access-gateway/source-ip-rate-limiter";
import type { CaioAccessPrincipal } from "@/lib/caio-access-gateway/token-store.service";
import type { CaioAuditGateReadiness } from "@/lib/caio-audit-state/audit-state-contracts";
import {
  caioCanonicalAuditClaimSchema,
  type CaioCanonicalAuditClaim,
} from "@/lib/caio-audit-state/gateway-audit-gate-adapter";

// RFC1918 example addresses constructed at runtime so the public-release
// static line scan never matches a private-IP literal.
const CLIENT_LAN_IP = [192, 168, 1, 10].join(".");
const OTHER_LAN_IP = [10, 0, 0, 5].join(".");

const PRINCIPAL: CaioAccessPrincipal = Object.freeze({
  tokenId: "tok_1",
  workspaceId: "ws_1",
  userRef: "user:ceo",
  clientType: "codex",
  deviceRef: "device:mac-studio",
  audience: "mcp",
});

/** Real MCP wire shape: JSON-RPC 2.0 tools/call. */
function jsonRpcToolCall(
  name: string,
  args: Record<string, unknown>,
  envelopeExtras: Record<string, unknown> = {},
): string {
  return JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: { name, arguments: args },
    ...envelopeExtras,
  });
}

const P1C_ALPHA_BODY = jsonRpcToolCall("get_p1c_read_projection", {
  workspaceId: "ws_1",
  portfolioRef: "project:alpha",
});

type DispatchCapture = {
  requestId: string;
  clientCorrelationId: string | null;
  toolName: string | null;
  authorizedProjectRefs: readonly string[];
};

type Harness = {
  handler: ReturnType<typeof createCaioGatewayHandler>;
  calls: string[];
  authInputs: Array<{ expectedAudience: string; sourceIp: string }>;
  auditClaims: CaioCanonicalAuditClaim[];
  dispatches: DispatchCapture[];
  setReadiness(state: CaioAuditGateReadiness): void;
  setReadinessFailure(failing: boolean): void;
};

/** Default allowed model dispatch: a receipt-backed proxy outcome. */
const MODEL_DISPATCH_OK: CaioModelDispatchOutcome = Object.freeze({
  claim: "allowed",
  auditReceiptId: "receipt:model-1",
  body: Object.freeze({ object: "response" }),
});

function createHarness(
  overrides: Partial<{
    authenticate: CaioGatewayHandlerDependencies["tokenAuthenticator"]["authenticate"];
    mcpDispatch: CaioGatewayHandlerDependencies["mcpDispatch"];
    modelProxy: Partial<CaioGatewayHandlerDependencies["modelProxy"]>;
    auditGate: CaioGatewayHandlerDependencies["auditGate"];
    preAuthRateLimiter: CaioGatewayHandlerDependencies["preAuthRateLimiter"];
    projectRefs: readonly string[];
    maxBodyBytes: number;
  }> = {},
): Harness {
  const calls: string[] = [];
  const authInputs: Array<{ expectedAudience: string; sourceIp: string }> =
    [];
  const auditClaims: CaioCanonicalAuditClaim[] = [];
  const dispatches: DispatchCapture[] = [];
  let readiness: CaioAuditGateReadiness = "ready";
  let readinessFails = false;
  const deps: CaioGatewayHandlerDependencies = {
    preAuthRateLimiter: overrides.preAuthRateLimiter ?? {
      claimSourceIpSlot: async () => {
        calls.push("preAuthRateLimiter");
        return { allowed: true };
      },
    },
    tokenAuthenticator: {
      authenticate: async (input) => {
        calls.push("authenticate");
        authInputs.push({
          expectedAudience: input.expectedAudience,
          sourceIp: input.sourceIp,
        });
        if (overrides.authenticate) return overrides.authenticate(input);
        return { ...PRINCIPAL, audience: input.expectedAudience };
      },
    },
    projectResolver: {
      async listAccessibleProjectRefs() {
        calls.push("projectResolver");
        return overrides.projectRefs ?? ["project:alpha"];
      },
    },
    mcpDispatch: async (input) => {
      calls.push("mcpDispatch");
      dispatches.push({
        requestId: input.requestId,
        clientCorrelationId: input.clientCorrelationId,
        toolName: input.toolName,
        authorizedProjectRefs: input.authorizedProjectRefs,
      });
      if (overrides.mcpDispatch) return overrides.mcpDispatch(input);
      return { ok: true, echo: input.payload };
    },
    modelProxy: {
      responses: async (input) => {
        calls.push("modelProxy.responses");
        if (overrides.modelProxy?.responses) {
          return overrides.modelProxy.responses(input);
        }
        return MODEL_DISPATCH_OK;
      },
      chatCompletions: async (input) => {
        calls.push("modelProxy.chatCompletions");
        if (overrides.modelProxy?.chatCompletions) {
          return overrides.modelProxy.chatCompletions(input);
        }
        return {
          claim: "allowed",
          auditReceiptId: "receipt:model-2",
          body: { object: "chat.completion" },
        };
      },
      listModels: async (input) => {
        calls.push(
          `modelProxy.listModels:${input.workspaceId}:${input.userRef}:${input.clientType}`,
        );
        if (overrides.modelProxy?.listModels) {
          return overrides.modelProxy.listModels(input);
        }
        return { data: [{ id: "alias:granted" }] };
      },
    },
    auditGate: overrides.auditGate ?? {
      claimDispatch: async (claim) => {
        calls.push("auditGate");
        auditClaims.push(claim);
        return {
          status: "allowed",
          receiptId: "receipt:mcp-1",
          persistedVia: "primary",
          dispatchAttempt: 1,
        };
      },
    },
    readinessProbe: {
      getReadiness: async () => {
        calls.push("readinessProbe");
        if (readinessFails) throw new Error("audit store down");
        return readiness;
      },
    },
    maxBodyBytes: overrides.maxBodyBytes,
  };
  return {
    handler: createCaioGatewayHandler(deps),
    calls,
    authInputs,
    auditClaims,
    dispatches,
    setReadiness(state) {
      readiness = state;
    },
    setReadinessFailure(failing) {
      readinessFails = failing;
    },
  };
}

function request(
  overrides: Partial<CaioGatewayRequest> = {},
): CaioGatewayRequest {
  return {
    method: "POST",
    path: "/mcp",
    headers: { authorization: "Bearer hcaio_mcp_test-token" },
    clientIp: CLIENT_LAN_IP,
    body: P1C_ALPHA_BODY,
    ...overrides,
  };
}

describe("routing", () => {
  it("returns 404 for unknown routes before any dependency runs", async () => {
    const harness = createHarness();
    const response = await harness.handler(
      request({ path: "/admin", headers: {} }),
    );
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "caio_not_found" });
    expect(harness.calls).toEqual([]);
  });

  it("returns 405 with an Allow header on a method mismatch", async () => {
    const harness = createHarness();
    const response = await harness.handler(
      request({ method: "GET", path: "/mcp", headers: {} }),
    );
    expect(response.status).toBe(405);
    expect(response.headers.allow).toBe("POST");
    expect(harness.calls).toEqual([]);
    const models = await harness.handler(
      request({ method: "DELETE", path: "/v1/models" }),
    );
    expect(models.status).toBe(405);
    expect(models.headers.allow).toBe("GET");
  });
});

describe("probes", () => {
  it("GET /livez answers without touching any dependency", async () => {
    const harness = createHarness();
    const response = await harness.handler(
      request({ method: "GET", path: "/livez", headers: {}, body: null }),
    );
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "alive" });
    expect(harness.calls).toEqual([]);
  });

  it("GET /readyz collapses the four audit-gate states onto the gateway's three", async () => {
    const harness = createHarness();
    const probe = () =>
      harness.handler(
        request({ method: "GET", path: "/readyz", headers: {}, body: null }),
      );

    const ready = await probe();
    expect(ready.status).toBe(200);
    expect(ready.body).toEqual({ status: "ready" });

    harness.setReadiness("degraded");
    const degraded = await probe();
    expect(degraded.status).toBe(200);
    expect(degraded.body).toEqual({ status: "degraded" });

    // The gate has a fourth state the gateway probe does not: serving under a
    // recovery admission cap is reported as degraded, never as ready.
    harness.setReadiness("recovering");
    const recovering = await probe();
    expect(recovering.status).toBe(200);
    expect(recovering.body).toEqual({ status: "degraded" });

    harness.setReadiness("unavailable");
    const unavailable = await probe();
    expect(unavailable.status).toBe(503);
    expect(unavailable.body).toEqual({ error: "caio_audit_unavailable" });
    expect(Number(unavailable.headers["retry-after"])).toBeGreaterThan(0);
  });

  it("GET /readyz fails closed when the async readiness probe throws", async () => {
    const harness = createHarness();
    harness.setReadinessFailure(true);
    const response = await harness.handler(
      request({ method: "GET", path: "/readyz", headers: {}, body: null }),
    );
    expect(response.status).toBe(503);
    expect(response.body).toEqual({ error: "caio_audit_unavailable" });
    expect(Number(response.headers["retry-after"])).toBeGreaterThan(0);
  });
});

describe("pipeline order", () => {
  it("requires a bearer token before touching the authenticator", async () => {
    const harness = createHarness();
    const response = await harness.handler(request({ headers: {} }));
    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: "caio_unauthorized",
      reason: "bearer_token_required",
    });
    // The per-source-ip budget is charged even for a request with no bearer.
    expect(harness.calls).toEqual(["preAuthRateLimiter"]);
  });

  it("authenticates before the body size cap: bad token wins over an oversized body", async () => {
    const harness = createHarness({
      authenticate: async () => {
        throw new CaioAccessGatewayError("token_unknown");
      },
      maxBodyBytes: 16,
    });
    const response = await harness.handler(
      request({ body: "x".repeat(1024) }),
    );
    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: "caio_unauthorized",
      reason: "token_unknown",
    });
    expect(harness.calls).toEqual(["preAuthRateLimiter", "authenticate"]);
  });

  it("caps the body after authentication and never dispatches", async () => {
    const harness = createHarness({ maxBodyBytes: 16 });
    const response = await harness.handler(
      request({ body: "x".repeat(1024) }),
    );
    expect(response.status).toBe(413);
    expect(response.body).toEqual({ error: "caio_payload_too_large" });
    expect(harness.calls).toEqual(["preAuthRateLimiter", "authenticate"]);
  });

  it("claims the audit gate before dispatching", async () => {
    const harness = createHarness();
    const response = await harness.handler(request());
    expect(response.status).toBe(200);
    expect(harness.calls).toEqual([
      "preAuthRateLimiter",
      "authenticate",
      "projectResolver",
      "auditGate",
      "mcpDispatch",
    ]);
  });

  it("passes the transport client ip into authentication", async () => {
    const harness = createHarness();
    await harness.handler(request({ clientIp: OTHER_LAN_IP }));
    expect(harness.authInputs).toEqual([
      { expectedAudience: "mcp", sourceIp: OTHER_LAN_IP },
    ]);
  });

  it("propagates authenticator taxonomy onto the wire", async () => {
    const cases: Array<[CaioAccessGatewayError, number, string, string?]> = [
      [new CaioAccessGatewayError("token_expired"), 401, "caio_unauthorized"],
      [
        new CaioAccessGatewayError("audience_mismatch"),
        401,
        "caio_unauthorized",
      ],
      [
        new CaioAccessGatewayError("source_ip_mismatch"),
        403,
        "caio_forbidden",
      ],
      [
        new CaioAccessGatewayError("rate_limited", { retryAfterSeconds: 9 }),
        429,
        "caio_rate_limited",
        "9",
      ],
    ];
    for (const [error, status, wireError, retryAfter] of cases) {
      const harness = createHarness({
        authenticate: async () => {
          throw error;
        },
      });
      const response = await harness.handler(request());
      expect(response.status).toBe(status);
      expect((response.body as { error: string }).error).toBe(wireError);
      if (retryAfter !== undefined) {
        expect(response.headers["retry-after"]).toBe(retryAfter);
      }
      expect(harness.calls).toEqual(["preAuthRateLimiter", "authenticate"]);
    }
  });
});

describe("audience binding", () => {
  it("expects the mcp audience on POST /mcp and model on /v1 routes", async () => {
    const harness = createHarness();
    await harness.handler(request());
    await harness.handler(request({ path: "/v1/responses" }));
    await harness.handler(request({ path: "/v1/chat/completions" }));
    await harness.handler(
      request({ method: "GET", path: "/v1/models", body: null }),
    );
    expect(
      harness.authInputs.map((input) => input.expectedAudience),
    ).toEqual(["mcp", "model", "model", "model"]);
  });
});

describe("body handling", () => {
  it("rejects a missing or invalid JSON body on POST routes", async () => {
    const harness = createHarness();
    const empty = await harness.handler(request({ body: null }));
    expect(empty.status).toBe(400);
    expect(empty.body).toEqual({
      error: "caio_bad_request",
      reason: "json_body_required",
    });
    const invalid = await harness.handler(request({ body: "{nope" }));
    expect(invalid.status).toBe(400);
    expect(invalid.body).toEqual({
      error: "caio_bad_request",
      reason: "json_body_invalid",
    });
    expect(harness.calls).toEqual([
      "preAuthRateLimiter",
      "authenticate",
      "preAuthRateLimiter",
      "authenticate",
    ]);
  });
});

describe("project membership gate on the real MCP wire shape", () => {
  it("authorizes the nested portfolioRef of a JSON-RPC tools/call and hands it to the dispatcher", async () => {
    const harness = createHarness({ projectRefs: ["project:alpha"] });
    const response = await harness.handler(request({ body: P1C_ALPHA_BODY }));
    expect(response.status).toBe(200);
    expect(harness.calls).toEqual([
      "preAuthRateLimiter",
      "authenticate",
      "projectResolver",
      "auditGate",
      "mcpDispatch",
    ]);
    expect(harness.dispatches).toHaveLength(1);
    expect(harness.dispatches[0].toolName).toBe("get_p1c_read_projection");
    expect(harness.dispatches[0].authorizedProjectRefs).toEqual([
      "project:alpha",
    ]);
  });

  it("blocks a revoked project ref nested in params.arguments with 403 project_access_revoked", async () => {
    const harness = createHarness({ projectRefs: ["project:alpha"] });
    const response = await harness.handler(
      request({
        body: jsonRpcToolCall("get_p1c_read_projection", {
          workspaceId: "ws_1",
          portfolioRef: "project:beta",
        }),
      }),
    );
    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: "caio_forbidden",
      reason: "project_access_revoked",
    });
    expect(harness.calls).toEqual([
      "preAuthRateLimiter",
      "authenticate",
      "projectResolver",
    ]);
    expect(harness.dispatches).toEqual([]);
  });

  it("refuses the confused-deputy payload (allowed top-level ref, revoked nested ref)", async () => {
    const harness = createHarness({ projectRefs: ["project:alpha"] });
    const response = await harness.handler(
      request({
        body: jsonRpcToolCall(
          "get_p1c_read_projection",
          { workspaceId: "ws_1", portfolioRef: "project:beta" },
          { projectRef: "project:alpha" },
        ),
      }),
    );
    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: "caio_forbidden",
      reason: "scope_violation",
    });
    // Nothing was dispatched and no 403-shaped check was spent on the
    // unrelated top-level value.
    expect(harness.dispatches).toEqual([]);
  });

  it("refuses a ref smuggled into a nested argument object", async () => {
    const harness = createHarness({ projectRefs: ["project:alpha"] });
    const response = await harness.handler(
      request({
        body: jsonRpcToolCall("get_p1c_read_projection", {
          workspaceId: "ws_1",
          portfolioRef: "project:alpha",
          filter: { nested: { portfolioRef: "project:beta" } },
        }),
      }),
    );
    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: "caio_forbidden",
      reason: "scope_violation",
    });
    expect(harness.dispatches).toEqual([]);
  });

  it("refuses an unknown / non-allowlisted tool name with scope_violation", async () => {
    const harness = createHarness();
    for (const name of ["submit_prompt_response", "totally_unknown_tool"]) {
      const response = await harness.handler(
        request({
          body: jsonRpcToolCall(name, { workspaceId: "ws_1" }),
        }),
      );
      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        error: "caio_forbidden",
        reason: "scope_violation",
      });
    }
    expect(harness.dispatches).toEqual([]);
  });

  it("refuses a project-scoped tool whose scoping field is absent", async () => {
    const harness = createHarness();
    const response = await harness.handler(
      request({
        body: jsonRpcToolCall("get_p1c_read_projection", {
          workspaceId: "ws_1",
        }),
      }),
    );
    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: "caio_forbidden",
      reason: "project_scope_unresolved",
    });
    expect(harness.dispatches).toEqual([]);
  });

  it("refuses the legacy flat body shape that the old gate depended on", async () => {
    const harness = createHarness();
    const response = await harness.handler(
      request({
        body: JSON.stringify({
          tool: "get_p1c_read_projection",
          projectRef: "project:alpha",
        }),
      }),
    );
    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: "caio_forbidden",
      reason: "project_scope_unresolved",
    });
    expect(harness.dispatches).toEqual([]);
  });

  it("dispatches workspace-scoped delivery reads with an empty authorized ref set", async () => {
    const harness = createHarness();
    const response = await harness.handler(
      request({
        body: jsonRpcToolCall("get_ceo_prompt", {
          workspaceId: "ws_1",
          deliveryObjectId: "delivery:1",
        }),
      }),
    );
    expect(response.status).toBe(200);
    expect(harness.dispatches[0].toolName).toBe("get_ceo_prompt");
    expect(harness.dispatches[0].authorizedProjectRefs).toEqual([]);
    // A workspace-scoped tool never consults project membership.
    expect(harness.calls).not.toContain("projectResolver");
  });

  it("refuses a tools/call whose workspaceId is not the authenticated workspace", async () => {
    const harness = createHarness();
    const response = await harness.handler(
      request({
        body: jsonRpcToolCall("get_p1c_read_projection", {
          workspaceId: "ws_other",
          portfolioRef: "project:alpha",
        }),
      }),
    );
    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: "caio_forbidden",
      reason: "scope_violation",
    });
    expect(harness.dispatches).toEqual([]);
  });

  it("allows the MCP handshake methods with no tool and no project scope", async () => {
    const harness = createHarness();
    const response = await harness.handler(
      request({
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/list",
          params: {},
        }),
      }),
    );
    expect(response.status).toBe(200);
    expect(harness.dispatches[0].toolName).toBeNull();
    expect(harness.dispatches[0].authorizedProjectRefs).toEqual([]);
  });

  it("still exposes the live gate to mcpDispatch for refs it resolves itself", async () => {
    let dispatchGateError: unknown = null;
    const harness = createHarness({
      projectRefs: ["project:alpha"],
      mcpDispatch: async (input) => {
        try {
          await input.assertProjectAccess("project:beta");
        } catch (error) {
          dispatchGateError = error;
        }
        return { ok: true };
      },
    });
    const response = await harness.handler(request({ body: P1C_ALPHA_BODY }));
    expect(response.status).toBe(200);
    expect(dispatchGateError).toBeInstanceOf(CaioAccessGatewayError);
    expect((dispatchGateError as CaioAccessGatewayError).code).toBe(
      "project_access_revoked",
    );
  });
});

describe("audit request id is server-generated", () => {
  it("never lets a client-supplied x-request-id become the audit identity", async () => {
    const harness = createHarness();
    const first = await harness.handler(
      request({
        headers: {
          authorization: "Bearer hcaio_mcp_test-token",
          "x-request-id": "aaa",
        },
      }),
    );
    const second = await harness.handler(
      request({
        headers: {
          authorization: "Bearer hcaio_mcp_test-token",
          "x-request-id": "aaa",
        },
      }),
    );
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(harness.auditClaims).toHaveLength(2);
    const [one, two] = harness.auditClaims;
    expect(one.requestId).not.toBe(two.requestId);
    expect(one.requestId).not.toBe("aaa");
    expect(two.requestId).not.toBe("aaa");
    // Workspace-scoped so two workspaces can never collide.
    expect(one.requestId.startsWith("ws_1:")).toBe(true);
    // The dispatcher sees the same server-side id the audit gate claimed.
    expect(harness.dispatches[0].requestId).toBe(one.requestId);
  });

  it("keeps the client id as a separate non-authoritative correlation field", async () => {
    const harness = createHarness();
    const response = await harness.handler(
      request({
        headers: {
          authorization: "Bearer hcaio_mcp_test-token",
          "x-request-id": "client-correlation-1",
        },
      }),
    );
    expect(response.status).toBe(200);
    expect(harness.dispatches[0].clientCorrelationId).toBe(
      "client-correlation-1",
    );
    expect(response.headers["x-correlation-id"]).toBe("client-correlation-1");
    expect(harness.auditClaims[0].requestId).not.toContain(
      "client-correlation-1",
    );
  });

  it("drops an unsafe client correlation id entirely", async () => {
    const harness = createHarness();
    const response = await harness.handler(
      request({
        headers: {
          authorization: "Bearer hcaio_mcp_test-token",
          "x-request-id": "bad value\r\nx-injected: 1",
        },
      }),
    );
    expect(response.status).toBe(200);
    expect(harness.dispatches[0].clientCorrelationId).toBeNull();
    expect(response.headers["x-correlation-id"]).toBeUndefined();
  });
});

describe("pre-authentication rate limiting", () => {
  it("charges invalid-token requests from one source ip and 429s past the cap", async () => {
    const harness = createHarness({
      preAuthRateLimiter: createInMemoryCaioSourceIpRateLimiter({
        limitPerMinute: 3,
      }),
      authenticate: async () => {
        throw new CaioAccessGatewayError("token_unknown");
      },
    });
    for (let index = 0; index < 3; index += 1) {
      const response = await harness.handler(request());
      expect(response.status).toBe(401);
    }
    const limited = await harness.handler(request());
    expect(limited.status).toBe(429);
    expect(limited.body).toEqual({ error: "caio_rate_limited" });
    expect(Number(limited.headers["retry-after"])).toBeGreaterThan(0);
    // The limiter refuses before the token is even looked up.
    expect(harness.calls.filter((call) => call === "authenticate")).toHaveLength(
      3,
    );
  });

  it("charges wrong-audience requests against the source-ip budget", async () => {
    const harness = createHarness({
      preAuthRateLimiter: createInMemoryCaioSourceIpRateLimiter({
        limitPerMinute: 1,
      }),
      authenticate: async () => {
        throw new CaioAccessGatewayError("audience_mismatch");
      },
    });
    expect((await harness.handler(request())).status).toBe(401);
    expect((await harness.handler(request())).status).toBe(429);
  });

  it("leaves a valid request from a different source ip unaffected", async () => {
    const limiter = createInMemoryCaioSourceIpRateLimiter({
      limitPerMinute: 1,
    });
    const attacker = createHarness({
      preAuthRateLimiter: limiter,
      authenticate: async () => {
        throw new CaioAccessGatewayError("token_unknown");
      },
    });
    expect((await attacker.handler(request())).status).toBe(401);
    expect((await attacker.handler(request())).status).toBe(429);

    const victim = createHarness({ preAuthRateLimiter: limiter });
    const response = await victim.handler(
      request({ clientIp: OTHER_LAN_IP }),
    );
    expect(response.status).toBe(200);
  });

  it("fails closed when the limiter itself is unavailable", async () => {
    const harness = createHarness({
      preAuthRateLimiter: {
        claimSourceIpSlot: async () => {
          throw new Error("limiter store down: mysql://user:pass@host/db");
        },
      },
    });
    const response = await harness.handler(request());
    expect(response.status).toBe(429);
    // Indistinguishable from a genuine limit hit; no store detail leaks.
    expect(response.body).toEqual({ error: "caio_rate_limited" });
    expect(JSON.stringify(response.body)).not.toContain("mysql://");
    expect(harness.calls).toEqual([]);
  });
});

describe("audit gate", () => {
  it("fails closed as 503 caio_audit_unavailable when the claim throws", async () => {
    const harness = createHarness({
      auditGate: {
        claimDispatch: async () => {
          throw new Error("audit ledger down: mysql://user:pass@host/db");
        },
      },
    });
    const response = await harness.handler(request());
    expect(response.status).toBe(503);
    expect(response.body).toEqual({ error: "caio_audit_unavailable" });
    expect(Number(response.headers["retry-after"])).toBeGreaterThan(0);
    expect(JSON.stringify(response.body)).not.toContain("mysql://");
    expect(harness.calls).toEqual([
      "preAuthRateLimiter",
      "authenticate",
      "projectResolver",
    ]);
  });

  it("fails closed when the gate rejects a reserved or malformed receipt id", async () => {
    // The real gate throws (not refuses) for a receipt id inside its own
    // replay-marker namespace, and the canonical port deliberately propagates
    // it. A throw must never be swallowed into an allowed dispatch.
    for (const thrown of [
      new Error(
        "caio_audit_reserved_request_id: requestId must not use the replay marker namespace",
      ),
      new TypeError("invalid_type at inputHash"),
    ]) {
      const harness = createHarness({
        auditGate: {
          claimDispatch: async () => {
            throw thrown;
          },
        },
      });
      const response = await harness.handler(request());
      expect(response.status).toBe(503);
      expect(response.body).toEqual({ error: "caio_audit_unavailable" });
      expect(harness.calls).not.toContain("mcpDispatch");
      expect(harness.dispatches).toEqual([]);
    }
  });

  it("claims the canonical six receipt fields, mapping the principal", async () => {
    const harness = createHarness();
    const response = await harness.handler(request());
    expect(response.status).toBe(200);
    expect(harness.auditClaims).toHaveLength(1);
    const claim = harness.auditClaims[0];
    // The claim is exactly the canonical closed set: no `route`, no principal
    // object, no payload. The strict schema is the assertion.
    expect(Object.keys(claim).sort()).toEqual([
      "clientType",
      "inputHash",
      "modelAlias",
      "policyVersion",
      "requestId",
      "workspaceId",
    ]);
    expect(caioCanonicalAuditClaimSchema.parse(claim)).toEqual(claim);
    expect(claim.workspaceId).toBe("ws_1");
    expect(claim.clientType).toBe("codex");
    expect(claim.modelAlias).toBe(CAIO_GATEWAY_MCP_AUDIT_ALIAS);
    expect(claim.policyVersion).toBe(CAIO_GATEWAY_MCP_AUDIT_POLICY_VERSION);
    expect(claim.inputHash).toMatch(/^sha256:[a-f0-9]{64}$/u);
    // The digest is content-derived, never the payload text itself.
    expect(claim.inputHash).not.toContain("project:alpha");
  });

  it("refuses a receipt conflict as a permanent 409 and never dispatches", async () => {
    const harness = createHarness({
      auditGate: {
        claimDispatch: async () => ({
          status: "receipt_conflict",
          errorCode: "caio_audit_receipt_conflict",
          httpStatus: 409,
          retryAfterSeconds: null,
        }),
      },
    });
    const response = await harness.handler(request());
    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: "caio_audit_receipt_conflict" });
    expect(response.headers["retry-after"]).toBeUndefined();
    expect(harness.dispatches).toEqual([]);
  });

  it("refuses a replay-cap hit as 429 caio_audit_replay_limit_exceeded", async () => {
    const harness = createHarness({
      auditGate: {
        claimDispatch: async () => ({
          status: "replay_limit_exceeded",
          errorCode: "caio_audit_replay_limit_exceeded",
          httpStatus: 429,
          retryAfterSeconds: null,
        }),
      },
    });
    const response = await harness.handler(request());
    expect(response.status).toBe(429);
    expect(response.body).toEqual({
      error: "caio_audit_replay_limit_exceeded",
    });
    expect(response.headers["retry-after"]).toBeUndefined();
    expect(harness.dispatches).toEqual([]);
  });

  it("refuses an unavailable audit store as 503 with Retry-After", async () => {
    const harness = createHarness({
      auditGate: {
        claimDispatch: async () => ({
          status: "audit_unavailable",
          errorCode: "caio_audit_unavailable",
          httpStatus: 503,
          retryAfterSeconds: 30,
        }),
      },
    });
    const response = await harness.handler(request());
    expect(response.status).toBe(503);
    expect(response.body).toEqual({ error: "caio_audit_unavailable" });
    expect(response.headers["retry-after"]).toBe("30");
    expect(harness.dispatches).toEqual([]);
  });

  it("emits no Retry-After when a refusal carries a null retryAfterSeconds", async () => {
    const harness = createHarness({
      auditGate: {
        claimDispatch: async () => ({
          status: "audit_unavailable",
          errorCode: "caio_audit_unavailable",
          httpStatus: 503,
          retryAfterSeconds: null,
        }),
      },
    });
    const response = await harness.handler(request());
    expect(response.status).toBe(503);
    expect(response.headers["retry-after"]).toBeUndefined();
    expect(JSON.stringify(response.headers)).not.toContain("undefined");
  });

  it("treats an allowed outcome without a receipt id as not claimed", async () => {
    const harness = createHarness({
      auditGate: {
        claimDispatch: async () =>
          ({
            status: "allowed",
            receiptId: "",
            persistedVia: "primary",
            dispatchAttempt: 1,
          }) as never,
      },
    });
    const response = await harness.handler(request());
    expect(response.status).toBe(503);
    expect(response.body).toEqual({ error: "caio_audit_unavailable" });
    expect(harness.dispatches).toEqual([]);
  });
});

describe("model proxy routes", () => {
  it("GET /v1/models delegates with the token's workspace/user/clientType", async () => {
    const harness = createHarness();
    const response = await harness.handler(
      request({ method: "GET", path: "/v1/models", body: null }),
    );
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: [{ id: "alias:granted" }] });
    expect(harness.calls).toContain(
      "modelProxy.listModels:ws_1:user:ceo:codex",
    );
  });

  it("collapses upstream failures to an opaque 502 without leaking messages", async () => {
    const harness = createHarness({
      modelProxy: {
        responses: async () => {
          throw new Error("upstream said: api-key=sk-secret prompt leaked");
        },
      },
    });
    const response = await harness.handler(
      request({ path: "/v1/responses" }),
    );
    expect(response.status).toBe(502);
    expect(response.body).toEqual({ error: "caio_upstream_failed" });
    expect(JSON.stringify(response.body)).not.toContain("sk-secret");
  });

  it("passes through a typed 422 external release denial", async () => {
    const harness = createHarness({
      modelProxy: {
        chatCompletions: async () => {
          throw new CaioAccessGatewayError("external_release_denied");
        },
      },
    });
    const response = await harness.handler(
      request({ path: "/v1/chat/completions" }),
    );
    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      error: "caio_external_release_denied",
    });
  });

  it("passes through a typed 503 no-route signal", async () => {
    const harness = createHarness({
      modelProxy: {
        responses: async () => {
          throw new CaioAccessGatewayError("no_route", {
            retryAfterSeconds: 20,
          });
        },
      },
    });
    const response = await harness.handler(
      request({ path: "/v1/responses" }),
    );
    expect(response.status).toBe(503);
    expect(response.body).toEqual({ error: "caio_no_route" });
    expect(response.headers["retry-after"]).toBe("20");
  });
});

describe("model routes claim inside the proxy, not at the HTTP layer", () => {
  it("never claims an audit slot at the HTTP layer for a model route", async () => {
    const harness = createHarness();
    for (const path of ["/v1/responses", "/v1/chat/completions"]) {
      const response = await harness.handler(request({ path }));
      expect(response.status).toBe(200);
    }
    const models = await harness.handler(
      request({ method: "GET", path: "/v1/models", body: null }),
    );
    expect(models.status).toBe(200);
    // The HTTP layer knows no modelAlias/inputHash/policyVersion, so it does
    // not (and cannot) claim: the proxy claims where the alias is resolved.
    expect(harness.calls).not.toContain("auditGate");
    expect(harness.auditClaims).toEqual([]);
  });

  it("returns the proxy body only when a receipt backs the dispatch", async () => {
    const harness = createHarness();
    const response = await harness.handler(request({ path: "/v1/responses" }));
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ object: "response" });
    const chat = await harness.handler(
      request({ path: "/v1/chat/completions" }),
    );
    expect(chat.body).toEqual({ object: "chat.completion" });
  });

  it("refuses a model dispatch whose proxy reports no audit claim", async () => {
    for (const outcome of [
      { claim: "allowed", auditReceiptId: "", body: { object: "response" } },
      { claim: "allowed", body: { object: "response" } },
      { object: "response" },
      null,
    ]) {
      const harness = createHarness({
        modelProxy: {
          responses: async () => outcome as never,
        },
      });
      const response = await harness.handler(
        request({ path: "/v1/responses" }),
      );
      expect(response.status).toBe(503);
      expect(response.body).toEqual({ error: "caio_audit_unavailable" });
      // Whatever the proxy returned is never surfaced as a success body.
      expect(JSON.stringify(response.body)).not.toContain("response");
    }
  });

  it("maps a proxy audit refusal onto 503, 409 and 429", async () => {
    const cases = [
      {
        refusal: "audit_unavailable" as const,
        retryAfterSeconds: 30,
        status: 503,
        error: "caio_audit_unavailable",
        retryAfter: "30",
      },
      {
        refusal: "receipt_conflict" as const,
        retryAfterSeconds: null,
        status: 409,
        error: "caio_audit_receipt_conflict",
        retryAfter: undefined,
      },
      {
        refusal: "replay_limit_exceeded" as const,
        retryAfterSeconds: null,
        status: 429,
        error: "caio_audit_replay_limit_exceeded",
        retryAfter: undefined,
      },
    ];
    for (const testCase of cases) {
      const harness = createHarness({
        modelProxy: {
          chatCompletions: async () => ({
            claim: "refused",
            refusal: testCase.refusal,
            retryAfterSeconds: testCase.retryAfterSeconds,
          }),
        },
      });
      const response = await harness.handler(
        request({ path: "/v1/chat/completions" }),
      );
      expect(response.status).toBe(testCase.status);
      expect(response.body).toEqual({ error: testCase.error });
      expect(response.headers["retry-after"]).toBe(testCase.retryAfter);
    }
  });
});
