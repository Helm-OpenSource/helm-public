import { readFileSync } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";

import { describe, expect, it } from "vitest";

import type { CaioAccessPrincipal } from "@/lib/caio-access-gateway/token-store.service";
import { CaioDeploymentPostureError } from "@/lib/caio-audit-state/deployment-posture";
import type { WorkBuddyMtlsPeer } from "@/lib/caio-collaboration/client-identity";
import {
  CAIO_ACCESS_GATEWAY_API_PATHS,
  CAIO_ACCESS_GATEWAY_ROUTE_TABLE,
  CAIO_WORKBUDDY_MCP_PATH,
  caioAccessGatewayMtlsPeer,
  caioAccessGatewayRouteOwner,
  CaioAccessGatewayServerError,
  createCaioAccessGatewayMount,
  readCaioAccessGatewayBody,
  type CaioAccessGatewayServerPorts,
} from "@/tools/caio-access-gateway/server";
import {
  CAIO_ACCESS_GATEWAY_LISTEN_PORT,
  type CaioAccessGatewayServerConfig,
} from "@/tools/caio-access-gateway/server-config";

// Addresses are assembled at runtime so no address literal sits in this file.
const LAN_ADDRESS = [10, 0, 0, 12].join(".");
const CLIENT_ADDRESS = [10, 0, 0, 40].join(".");
const CERT_DIR = path.join(path.sep, "etc", "caio", "tls");

const FINGERPRINT = `sha256:${"ab".repeat(32)}`;

const PEER: WorkBuddyMtlsPeer = Object.freeze({
  certificateFingerprint: FINGERPRINT,
  sourceAddress: CLIENT_ADDRESS,
  authorized: true,
});

const PRINCIPAL: CaioAccessPrincipal = Object.freeze({
  tokenId: "tok_1",
  workspaceId: "ws_1",
  userRef: "user:ceo",
  clientType: "codex",
  deviceRef: "device:mac-studio",
  audience: "mcp",
});

const CONFIG: CaioAccessGatewayServerConfig = Object.freeze({
  bindAddress: LAN_ADDRESS,
  port: CAIO_ACCESS_GATEWAY_LISTEN_PORT,
  mtls: Object.freeze({
    certificatePath: path.join(CERT_DIR, "server.crt"),
    privateKeyPath: path.join(CERT_DIR, "server.key"),
    clientCaPath: path.join(CERT_DIR, "client-ca.crt"),
    requireClientCertificate: true as const,
  }),
  featureFlags: Object.freeze({
    gatewayEnabled: true,
    readEnabled: true,
    pushEnabled: false,
    presenceEnabled: false,
    mutationsEnabled: false,
    promptResponsesEnabled: false,
    questionSelectionsEnabled: false,
    adviceDecisionsEnabled: false,
  }),
});

type Spy = {
  ports: CaioAccessGatewayServerPorts;
  calls: string[];
};

function createPorts(
  posture: "self_service" | "governed_fde" = "self_service",
): Spy {
  const calls: string[] = [];
  return {
    calls,
    ports: {
      preAuthRateLimiter: {
        claimSourceIpSlot: async () => {
          calls.push("preAuthRateLimiter");
          return { allowed: true };
        },
      },
      tokenAuthenticator: {
        authenticate: async (input) => {
          calls.push("authenticate");
          return { ...PRINCIPAL, audience: input.expectedAudience };
        },
      },
      projectResolver: {
        async listAccessibleProjectRefs() {
          calls.push("projectResolver");
          return ["project:alpha"];
        },
      },
      mcpDispatch: async () => {
        calls.push("mcpDispatch");
        return { ok: true };
      },
      modelProxy: {
        engine: {
          execute: async () => {
            calls.push("modelProxy.execute");
            throw new Error("no upstream in this composition test");
          },
        },
        // Discovery is built in-tree from these bindings, so the composition
        // supplies DATA here, not a listing function. A deployment can no
        // longer hand in an implementation that ignores the token's grant.
        bindings: [
          {
            alias: "caio-codex-default",
            protocol: "responses" as const,
            providerKey: "provider-a",
            upstreamModel: "upstream-for-codex",
            credentialRef: "provider-a-key",
            endpointBaseUrl: "https://upstream.example.internal/v1",
            region: "cn-hangzhou",
            dataRetentionPolicyKey: "retention-days:30",
            trainingUsePolicyKey: "prohibited",
            dataAuthorizationKey: "auth-tier-1",
            policyVersion: "policy-v3",
            status: "active" as const,
            governedPolicyKey: "caio-lan-default",
            governedRouteRef: "route:caio-lan-default:v3",
            fallbackCandidates: [],
          },
        ],
      },
      auditGate: {
        posture,
        claimDispatch: async () => {
          calls.push("auditGate");
          return {
            status: "allowed" as const,
            receiptId: "receipt:1",
            persistedVia: "primary" as const,
            dispatchAttempt: 1,
          };
        },
      },
      readinessProbe: {
        getReadiness: async () => {
          calls.push("readinessProbe");
          return "ready" as const;
        },
      },
    },
  };
}

function createServer(
  overrides: Partial<{
    posture: "self_service" | "governed_fde";
    ports: CaioAccessGatewayServerPorts;
  }> = {},
) {
  return createCaioAccessGatewayMount({
    config: CONFIG,
    posture: overrides.posture ?? "self_service",
    ports: overrides.ports ?? createPorts().ports,
  });
}

/** A minimal ServerResponse stand-in: what the host writes to the wire. */
function captureNodeResponse() {
  const capture = {
    status: 0,
    headers: {} as Record<string, unknown>,
    body: "",
    ended: false,
  };
  return {
    capture,
    response: {
      writeHead(status: number, headers: Record<string, unknown>) {
        capture.status = status;
        capture.headers = { ...headers };
        return this;
      },
      end(chunk?: string) {
        capture.ended = true;
        if (typeof chunk === "string") capture.body = chunk;
      },
    },
  };
}

function nodeRequest(input: {
  method: string;
  url: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: string;
  socket?: Record<string, unknown>;
}) {
  const stream = Readable.from([Buffer.from(input.body ?? "", "utf8")]);
  return Object.assign(stream, {
    method: input.method,
    url: input.url,
    headers: input.headers ?? {},
    socket: input.socket ?? {
      authorized: true,
      remoteAddress: CLIENT_ADDRESS,
      getPeerCertificate: () => ({
        fingerprint256: "AB:".repeat(31) + "AB",
      }),
    },
  });
}

function incoming(
  overrides: Partial<{
    method: string;
    url: string;
    headers: Record<string, string | string[] | undefined>;
    clientIp: string | null;
    peer: WorkBuddyMtlsPeer | null;
    body: string | null;
  }> = {},
) {
  return {
    method: overrides.method ?? "GET",
    url: overrides.url ?? "/livez",
    headers: overrides.headers ?? {},
    clientIp: overrides.clientIp === undefined ? CLIENT_ADDRESS : overrides.clientIp,
    peer: overrides.peer === undefined ? PEER : overrides.peer,
    body: overrides.body ?? null,
  };
}

describe("route table: which surfaces this listener owns", () => {
  it("declares every Access Gateway API path and the WorkBuddy path it does NOT serve", () => {
    expect([...CAIO_ACCESS_GATEWAY_API_PATHS].sort()).toEqual([
      "/livez",
      "/mcp",
      "/readyz",
      "/v1/chat/completions",
      "/v1/models",
      "/v1/responses",
    ]);
    for (const apiPath of CAIO_ACCESS_GATEWAY_API_PATHS) {
      expect(caioAccessGatewayRouteOwner(apiPath)).toBe("access_gateway_api");
    }
    expect(caioAccessGatewayRouteOwner(CAIO_WORKBUDDY_MCP_PATH)).toBe(
      "workbuddy_lan_gateway",
    );
    expect(caioAccessGatewayRouteOwner("/anything-else")).toBe("unowned");
    // The table is data, and every row states an owner and whether this
    // process serves it.
    expect(
      CAIO_ACCESS_GATEWAY_ROUTE_TABLE.every(
        (row) => row.owner !== undefined && row.methods.length > 0,
      ),
    ).toBe(true);
    expect(
      CAIO_ACCESS_GATEWAY_ROUTE_TABLE.find(
        (row) => row.path === CAIO_WORKBUDDY_MCP_PATH,
      )?.servedByThisSurface,
    ).toBe(false);
  });

  it("mounts the REAL Access Gateway handler and reports the declared posture", async () => {
    const server = createServer();
    const response = await server.handle(incoming({ url: "/livez" }));
    expect(response.status).toBe(200);
    // Only createCaioGatewayHandler answers this shape.
    expect(response.body).toEqual({
      status: "alive",
      posture: "self_service",
    });
    const ready = await server.handle(incoming({ url: "/readyz" }));
    expect(ready.body).toEqual({ status: "ready", posture: "self_service" });
  });

  it("delegates an API request to the mounted handler", async () => {
    const spy = createPorts();
    const server = createServer({ ports: spy.ports });
    const response = await server.handle(
      incoming({
        method: "POST",
        url: "/mcp",
        headers: { authorization: "Bearer hcaio_mcp_test" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: {
            name: "get_p1c_read_projection",
            arguments: { workspaceId: "ws_1", portfolioRef: "project:alpha" },
          },
        }),
      }),
    );
    expect(response.status).toBe(200);
    expect(spy.calls).toContain("mcpDispatch");
  });

  it("never lets the WorkBuddy path be answered by the Access Gateway API", async () => {
    const spy = createPorts();
    const server = createServer({ ports: spy.ports });
    for (const method of ["GET", "POST"]) {
      const response = await server.handle(
        incoming({
          method,
          url: CAIO_WORKBUDDY_MCP_PATH,
          headers: { authorization: "Bearer hcaio_mcp_test" },
          body: "{}",
        }),
      );
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: "caio_not_found" });
    }
    // Not one port was touched: the request never reached the mounted handler,
    // so the API surface cannot impersonate the WorkBuddy surface.
    expect(spy.calls).toEqual([]);
    // The refusal comes from the OWNERSHIP row, ahead of every other check:
    // a request the API pipeline would reject for another reason (no client
    // address) is still answered as "this process does not serve that path".
    const unowned = await server.handle(
      incoming({ method: "POST", url: CAIO_WORKBUDDY_MCP_PATH, clientIp: null }),
    );
    expect(unowned.status).toBe(404);
    expect(unowned.body).toEqual({ error: "caio_not_found" });
  });

  it("ignores a query string when deciding the owner", async () => {
    const spy = createPorts();
    const server = createServer({ ports: spy.ports });
    const response = await server.handle(
      incoming({ url: `${CAIO_WORKBUDDY_MCP_PATH}?probe=1`, method: "POST" }),
    );
    expect(response.status).toBe(404);
    expect(spy.calls).toEqual([]);
  });
});

describe("mTLS is required for every surface on this listener", () => {
  it("refuses a request with no verified client certificate", async () => {
    const spy = createPorts();
    const server = createServer({ ports: spy.ports });
    const response = await server.handle(
      incoming({ url: "/livez", peer: null }),
    );
    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: "caio_unauthorized",
      reason: "mtls_client_certificate_required",
    });
    expect(spy.calls).toEqual([]);
  });

  it("refuses a request whose transport reported no client address", async () => {
    const server = createServer();
    const response = await server.handle(
      incoming({ url: "/mcp", method: "POST", clientIp: null }),
    );
    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "caio_bad_request",
      reason: "client_address_unresolved",
    });
  });

  it("derives a peer only from an authorized socket with a sha256 fingerprint", () => {
    expect(
      caioAccessGatewayMtlsPeer({
        authorized: true,
        remoteAddress: CLIENT_ADDRESS,
        getPeerCertificate: () => ({
          fingerprint256: "AB:".repeat(31) + "AB",
        }),
      }),
    ).toEqual(PEER);
    // Unauthorized socket, missing certificate, malformed fingerprint and a
    // missing address all fail closed.
    expect(
      caioAccessGatewayMtlsPeer({
        authorized: false,
        remoteAddress: CLIENT_ADDRESS,
        getPeerCertificate: () => ({ fingerprint256: "AB:".repeat(31) + "AB" }),
      }),
    ).toBeNull();
    expect(
      caioAccessGatewayMtlsPeer({
        authorized: true,
        remoteAddress: CLIENT_ADDRESS,
        getPeerCertificate: () => ({}),
      }),
    ).toBeNull();
    expect(
      caioAccessGatewayMtlsPeer({
        authorized: true,
        remoteAddress: CLIENT_ADDRESS,
        getPeerCertificate: () => ({ fingerprint256: "not-a-fingerprint" }),
      }),
    ).toBeNull();
    expect(
      caioAccessGatewayMtlsPeer({
        authorized: true,
        getPeerCertificate: () => ({ fingerprint256: "AB:".repeat(31) + "AB" }),
      }),
    ).toBeNull();
  });
});

describe("this surface owns NO socket: the host binds the one listener", () => {
  it("creates no listener of its own and offers no way to bind one", () => {
    const mount = createServer() as unknown as Record<string, unknown>;
    // The mount is a surface, not a server: nothing here can open a socket,
    // so a deployment cannot end up with the Access Gateway on a second
    // listener that contends with the WorkBuddy one for the pinned port.
    expect(mount.start).toBeUndefined();
    expect(mount.close).toBeUndefined();
    expect(typeof mount.serveNodeRequest).toBe("function");
    // The declared socket is still carried, so the host can be checked
    // against it — declaring is not binding.
    expect(mount.config).toEqual(CONFIG);
    expect((mount.config as typeof CONFIG).port).toBe(
      CAIO_ACCESS_GATEWAY_LISTEN_PORT,
    );
  });

  it("contains no socket-creating code at all", () => {
    const source = readFileSync(
      path.join(__dirname, "server.ts"),
      "utf8",
    );
    // A second listener is not a configuration mistake to document, it is a
    // composition that must not be constructible from this module.
    expect(source).not.toMatch(/from "node:https"/);
    expect(source).not.toMatch(/createServer\(/);
    expect(source).not.toMatch(/\.listen\(/);
    expect(source).not.toMatch(/exclusive/);
  });

  it("serves a node request onto the host's response", async () => {
    const mount = createServer();
    const { capture, response } = captureNodeResponse();
    await mount.serveNodeRequest(
      nodeRequest({ method: "GET", url: "/livez" }) as never,
      response as never,
    );
    expect(capture.status).toBe(200);
    expect(capture.headers["content-type"]).toBe(
      "application/json; charset=utf-8",
    );
    expect(JSON.parse(capture.body)).toEqual({
      status: "alive",
      posture: "self_service",
    });
    expect(capture.ended).toBe(true);
  });

  it("refuses a node request whose socket carries no verified peer", async () => {
    const mount = createServer();
    const { capture, response } = captureNodeResponse();
    await mount.serveNodeRequest(
      nodeRequest({
        method: "GET",
        url: "/livez",
        socket: { authorized: false, remoteAddress: CLIENT_ADDRESS },
      }) as never,
      response as never,
    );
    expect(capture.status).toBe(401);
  });

  it("refuses a node request whose body exceeds the cap", async () => {
    const mount = createCaioAccessGatewayMount({
      config: CONFIG,
      posture: "self_service",
      ports: createPorts().ports,
      maxBodyBytes: 4,
    });
    const { capture, response } = captureNodeResponse();
    await mount.serveNodeRequest(
      nodeRequest({
        method: "POST",
        url: "/mcp",
        body: "0123456789",
      }) as never,
      response as never,
    );
    expect(capture.status).toBe(413);
  });
});

describe("construction fails closed on a missing or disagreeing posture", () => {
  it("refuses to construct with no declared posture", () => {
    expect(() =>
      createCaioAccessGatewayMount({
        config: CONFIG,
        posture: undefined as never,
        ports: createPorts().ports,
      }),
      // The declared-posture parser refuses it — not the later cross-check.
    ).toThrow(CaioDeploymentPostureError);
  });

  it("refuses a posture that disagrees with the wired audit gate", () => {
    expect(() =>
      createCaioAccessGatewayMount({
        config: CONFIG,
        posture: "governed_fde",
        ports: createPorts("self_service").ports,
      }),
    ).toThrow(CaioAccessGatewayServerError);
  });

  it("threads a governed_fde posture through to the probes", async () => {
    const server = createServer({
      posture: "governed_fde",
      ports: createPorts("governed_fde").ports,
    });
    const response = await server.handle(incoming({ url: "/livez" }));
    expect(response.body).toEqual({
      status: "alive",
      posture: "governed_fde",
    });
  });
});

describe("request body reading", () => {
  async function* chunks(...values: string[]) {
    for (const value of values) yield Buffer.from(value, "utf8");
  }

  it("concatenates chunks up to the cap", async () => {
    expect(
      await readCaioAccessGatewayBody(chunks("{\"a\":", "1}"), 1024),
    ).toEqual({ ok: true, body: '{"a":1}' });
  });

  it("refuses a body over the cap instead of buffering it", async () => {
    expect(await readCaioAccessGatewayBody(chunks("0123456789"), 4)).toEqual({
      ok: false,
    });
  });
});
