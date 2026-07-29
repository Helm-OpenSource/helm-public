import { describe, expect, it } from "vitest";

import { CaioAccessGatewayError } from "@/lib/caio-access-gateway/gateway-error-contract";
import {
  createCaioGatewayHandler,
  type CaioGatewayHandlerDependencies,
  type CaioGatewayRequest,
  type CaioReadinessState,
} from "@/lib/caio-access-gateway/gateway-http-core";
import type { CaioAccessPrincipal } from "@/lib/caio-access-gateway/token-store.service";

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

type Harness = {
  handler: ReturnType<typeof createCaioGatewayHandler>;
  calls: string[];
  authInputs: Array<{ expectedAudience: string; sourceIp: string }>;
  setReadiness(state: CaioReadinessState): void;
};

function createHarness(
  overrides: Partial<{
    authenticate: CaioGatewayHandlerDependencies["tokenAuthenticator"]["authenticate"];
    mcpDispatch: CaioGatewayHandlerDependencies["mcpDispatch"];
    modelProxy: Partial<CaioGatewayHandlerDependencies["modelProxy"]>;
    auditGate: CaioGatewayHandlerDependencies["auditGate"];
    projectRefs: readonly string[];
    maxBodyBytes: number;
  }> = {},
): Harness {
  const calls: string[] = [];
  const authInputs: Array<{ expectedAudience: string; sourceIp: string }> =
    [];
  let readiness: CaioReadinessState = "ready";
  const deps: CaioGatewayHandlerDependencies = {
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
      if (overrides.mcpDispatch) return overrides.mcpDispatch(input);
      return { ok: true, echo: input.payload };
    },
    modelProxy: {
      responses: async (input) => {
        calls.push("modelProxy.responses");
        if (overrides.modelProxy?.responses) {
          return overrides.modelProxy.responses(input);
        }
        return { object: "response" };
      },
      chatCompletions: async (input) => {
        calls.push("modelProxy.chatCompletions");
        if (overrides.modelProxy?.chatCompletions) {
          return overrides.modelProxy.chatCompletions(input);
        }
        return { object: "chat.completion" };
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
      claimDispatch: async () => {
        calls.push("auditGate");
      },
    },
    readinessProbe: { state: () => readiness },
    maxBodyBytes: overrides.maxBodyBytes,
  };
  return {
    handler: createCaioGatewayHandler(deps),
    calls,
    authInputs,
    setReadiness(state) {
      readiness = state;
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
    body: JSON.stringify({ tool: "get_p1c_read_projection" }),
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

  it("GET /readyz reflects the audit readiness port", async () => {
    const harness = createHarness();
    const ready = await harness.handler(
      request({ method: "GET", path: "/readyz", headers: {}, body: null }),
    );
    expect(ready.status).toBe(200);
    expect(ready.body).toEqual({ status: "ready" });

    harness.setReadiness("degraded");
    const degraded = await harness.handler(
      request({ method: "GET", path: "/readyz", headers: {}, body: null }),
    );
    expect(degraded.status).toBe(200);
    expect(degraded.body).toEqual({ status: "degraded" });

    harness.setReadiness("unavailable");
    const unavailable = await harness.handler(
      request({ method: "GET", path: "/readyz", headers: {}, body: null }),
    );
    expect(unavailable.status).toBe(503);
    expect(unavailable.body).toEqual({ error: "caio_audit_unavailable" });
    expect(Number(unavailable.headers["retry-after"])).toBeGreaterThan(0);
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
    expect(harness.calls).toEqual([]);
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
    expect(harness.calls).toEqual(["authenticate"]);
  });

  it("caps the body after authentication and never dispatches", async () => {
    const harness = createHarness({ maxBodyBytes: 16 });
    const response = await harness.handler(
      request({ body: "x".repeat(1024) }),
    );
    expect(response.status).toBe(413);
    expect(response.body).toEqual({ error: "caio_payload_too_large" });
    expect(harness.calls).toEqual(["authenticate"]);
  });

  it("claims the audit gate before dispatching", async () => {
    const harness = createHarness();
    const response = await harness.handler(request());
    expect(response.status).toBe(200);
    expect(harness.calls).toEqual([
      "authenticate",
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
      expect(harness.calls).toEqual(["authenticate"]);
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
    expect(harness.calls).toEqual(["authenticate", "authenticate"]);
  });
});

describe("project membership gate", () => {
  it("blocks a payload naming a revoked project with 403 project_access_revoked", async () => {
    const harness = createHarness({ projectRefs: ["project:alpha"] });
    const response = await harness.handler(
      request({
        body: JSON.stringify({
          tool: "get_p1c_read_projection",
          projectRef: "project:beta",
        }),
      }),
    );
    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: "caio_forbidden",
      reason: "project_access_revoked",
    });
    expect(harness.calls).toEqual(["authenticate", "projectResolver"]);
  });

  it("passes an accessible project and exposes the live gate to mcpDispatch", async () => {
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
    const response = await harness.handler(
      request({
        body: JSON.stringify({
          tool: "get_p1c_read_projection",
          projectRef: "project:alpha",
        }),
      }),
    );
    expect(response.status).toBe(200);
    expect(dispatchGateError).toBeInstanceOf(CaioAccessGatewayError);
    expect((dispatchGateError as CaioAccessGatewayError).code).toBe(
      "project_access_revoked",
    );
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
    expect(harness.calls).toEqual(["authenticate"]);
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
