import { readFileSync } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";

import { describe, expect, it } from "vitest";

import { CaioDeploymentPostureError } from "@/lib/caio-audit-state/deployment-posture";
import type { WorkBuddyMtlsPeer } from "@/lib/caio-collaboration/client-identity";
import {
  CaioOperatingQuestionPackProviderRegistryError,
  type CaioOperatingQuestionPackProvider,
} from "@/lib/stage1-owner-loop/caio-operating-question-pack-provider-registry";
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
import {
  CAIO_MOUNT_FIXTURE_CLIENT_ADDRESS,
  CAIO_MOUNT_FIXTURE_CONFIG,
  CAIO_MOUNT_FIXTURE_FINGERPRINT,
  createCaioMountFixturePorts,
} from "@/tools/caio-access-gateway/mount-fixture";

// The mount fixture is also consumed by the downstream Overlay-owned
// composition suite. Two copies of these deployment-input doubles would drift,
// and a contract test standing on its own private idea of the ports would be
// asserting against a composition nobody deploys.
const CLIENT_ADDRESS = CAIO_MOUNT_FIXTURE_CLIENT_ADDRESS;
const FINGERPRINT = CAIO_MOUNT_FIXTURE_FINGERPRINT;
const PEER: WorkBuddyMtlsPeer = Object.freeze({
  certificateFingerprint: FINGERPRINT,
  sourceAddress: CLIENT_ADDRESS,
  authorized: true,
});
const CONFIG: CaioAccessGatewayServerConfig = CAIO_MOUNT_FIXTURE_CONFIG;

const createPorts = createCaioMountFixturePorts;

function questionPackProvider(
  providerId = "pack-provider:operating-input-v1",
): CaioOperatingQuestionPackProvider {
  return Object.freeze({
    providerId,
    resolveOperatingInput: async () => ({ authorityEffect: "none" }),
  });
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
  /** A body that does not simply end, for cancellation cases. */
  bodyStream?: AsyncIterable<Buffer | string>;
  socket?: Record<string, unknown>;
}) {
  const stream = input.bodyStream
    ? Readable.from(input.bodyStream)
    : Readable.from([Buffer.from(input.body ?? "", "utf8")]);
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
      "/v1/execution-results",
      "/v1/models",
      "/v1/operating-questions/generate",
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

  // A DEPLOYMENT MAY MOUNT THE SUBSET IT CAN ACTUALLY SERVE.
  //
  // The MCP dispatcher has no in-tree implementation, and inventing one would
  // produce a facade that dispatches nothing while looking like it dispatches.
  // So `/mcp` is owned only when a dispatcher is supplied, and a mount without
  // one does not claim the path at all — the host's router then 404s it, exactly
  // as it does for a path no surface declares.
  describe("a mount without an MCP dispatcher", () => {
    function createPartialMount() {
      const spy = createPorts();
      const { mcpDispatch: _dropped, ...withoutDispatch } = spy.ports;
      return {
        spy,
        mount: createCaioAccessGatewayMount({
          config: CONFIG,
          posture: "self_service",
          ports: withoutDispatch,
        }),
      };
    }

    it("does not declare /mcp among the paths it owns", () => {
      const { mount } = createPartialMount();
      expect(mount.apiPaths).not.toContain("/mcp");
      // CONTROL: everything else is still owned, so this is a subset and not a
      // mount that quietly stopped serving.
      expect([...mount.apiPaths].sort()).toEqual([
        "/livez",
        "/readyz",
        "/v1/chat/completions",
        "/v1/execution-results",
        "/v1/models",
        "/v1/responses",
      ]);
      // And a mount WITH a dispatcher still owns it.
      expect(createServer().apiPaths).toContain("/mcp");
    });

    it("says so in its own route table, not only in the path list", () => {
      const { mount } = createPartialMount();
      expect(
        mount.routeTable.find((row) => row.path === "/mcp")?.servedByThisSurface,
      ).toBe(false);
      expect(
        createServer().routeTable.find((row) => row.path === "/mcp")
          ?.servedByThisSurface,
      ).toBe(true);
    });

    it("refuses /mcp without touching a single port", async () => {
      const { mount, spy } = createPartialMount();
      const response = await mount.handle(
        incoming({
          method: "POST",
          url: "/mcp",
          headers: { authorization: "Bearer hcaio_mcp_test" },
          body: "{}",
        }),
      );
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: "caio_not_found" });
      // Not one port ran: the refusal is ownership, decided before
      // authentication, so an unserved path cannot consume a rate-limit slot or
      // reach a token store.
      expect(spy.calls).toEqual([]);
    });

    it("still serves the routes it does own", async () => {
      const { mount } = createPartialMount();
      const alive = await mount.handle(incoming({ url: "/livez" }));
      expect(alive.status).toBe(200);
      const ready = await mount.handle(incoming({ url: "/readyz" }));
      expect(ready.body).toEqual({ status: "ready", posture: "self_service" });
    });
  });

  describe("the mounted operating-question Pack provider", () => {
    it("does not own question generation when no Pack provider is mounted", async () => {
      const spy = createPorts();
      const mount = createServer({ ports: spy.ports });

      expect(mount.apiPaths).not.toContain(
        "/v1/operating-questions/generate",
      );
      const response = await mount.handle(
        incoming({
          method: "POST",
          url: "/v1/operating-questions/generate",
          headers: { authorization: "Bearer hcaio_mcp_test" },
          body: JSON.stringify({
            portfolioRef: "opportunity:portfolio-1",
            generationKey: "generation:one",
          }),
        }),
      );
      expect(response.status).toBe(404);
      expect(spy.calls).toEqual([]);
    });

    it("owns question generation only when exactly one provider is mounted", () => {
      const fixture = createPorts();
      const mount = createServer({
        ports: {
          ...fixture.ports,
          operatingQuestionPackProviders: [questionPackProvider()],
        },
      });

      expect(mount.apiPaths).toContain(
        "/v1/operating-questions/generate",
      );
      expect(
        mount.routeTable.find(
          (row) => row.path === "/v1/operating-questions/generate",
        )?.servedByThisSurface,
      ).toBe(true);
    });

    it("rejects duplicate Pack provider registration during construction", () => {
      const fixture = createPorts();

      expect(() =>
        createServer({
          ports: {
            ...fixture.ports,
            operatingQuestionPackProviders: [
              questionPackProvider("pack-provider:first"),
              questionPackProvider("pack-provider:second"),
            ],
          },
        }),
      ).toThrowError(
        expect.objectContaining<Partial<CaioOperatingQuestionPackProviderRegistryError>>({
          code: "PACK_PROVIDER_ALREADY_MOUNTED",
        }),
      );
    });
  });

  // THE SAME RULE, ONE LEVEL DOWN.
  //
  // /v1/responses and /v1/chat/completions call an upstream model provider with
  // that provider's credentials — real external egress. /v1/models does not: it
  // is discovery, built in-tree from the alias bindings the deployment supplies
  // as DATA. A deployment that has bindings but no upstream engine can serve
  // discovery honestly, and must not appear to offer dispatch it cannot do.
  describe("a mount without an upstream model engine", () => {
    function createDiscoveryOnlyMount() {
      const spy = createPorts();
      const { engine: _dropped, ...modelProxyWithoutEngine } =
        spy.ports.modelProxy;
      return {
        spy,
        mount: createCaioAccessGatewayMount({
          config: CONFIG,
          posture: "self_service",
          ports: { ...spy.ports, modelProxy: modelProxyWithoutEngine },
        }),
      };
    }

    it("owns discovery but not dispatch", () => {
      const { mount } = createDiscoveryOnlyMount();
      expect(mount.apiPaths).toContain("/v1/models");
      expect(mount.apiPaths).not.toContain("/v1/responses");
      expect(mount.apiPaths).not.toContain("/v1/chat/completions");
      // CONTROL: with an engine, both dispatch paths are owned.
      expect(createServer().apiPaths).toContain("/v1/responses");
      expect(createServer().apiPaths).toContain("/v1/chat/completions");
    });

    it("refuses dispatch without touching a port, and never calls upstream", async () => {
      const { mount, spy } = createDiscoveryOnlyMount();
      for (const url of ["/v1/responses", "/v1/chat/completions"]) {
        const response = await mount.handle(
          incoming({
            method: "POST",
            url,
            headers: { authorization: "Bearer hcaio_mcp_test" },
            body: "{}",
          }),
        );
        expect(response.status, url).toBe(404);
      }
      // No credential loader, no upstream client, no audit receipt: an unowned
      // path costs nothing and reaches nothing.
      expect(spy.calls).toEqual([]);
    });

    it("still answers discovery and the probes", async () => {
      const { mount } = createDiscoveryOnlyMount();
      const ready = await mount.handle(incoming({ url: "/readyz" }));
      expect(ready.status).toBe(200);
    });
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

  // THE HOST'S CANCELLATION, not this surface's own.
  //
  // Both surfaces are served by one host on one socket, so shutdown and the
  // request deadline belong to the host. It hands this mount a signal; before
  // this the mount could not accept one, so a composed host had no way to stop
  // work it had started, and its drain had to either wait forever or lie.
  it("refuses a node request whose signal is already aborted", async () => {
    const { ports, calls } = createPorts();
    const mount = createCaioAccessGatewayMount({
      config: CONFIG,
      posture: "self_service",
      ports,
    });
    const { capture, response } = captureNodeResponse();
    const controller = new AbortController();
    controller.abort();

    await mount.serveNodeRequest(
      nodeRequest({ method: "GET", url: "/livez" }) as never,
      response as never,
      { signal: controller.signal },
    );

    expect(capture.status).toBe(503);
    expect(capture.ended).toBe(true);
    // Not merely a 503 on the wire: no port was touched, so nothing was
    // started that the host would then have to wait for.
    expect(calls).toEqual([]);
  });

  it("still serves when the host's signal is live", async () => {
    // CONTROL for the case above. Without it, a mount that refused every
    // request carrying a signal would pass that assertion.
    const mount = createServer();
    const { capture, response } = captureNodeResponse();
    const controller = new AbortController();

    await mount.serveNodeRequest(
      nodeRequest({ method: "GET", url: "/livez" }) as never,
      response as never,
      { signal: controller.signal },
    );

    expect(capture.status).toBe(200);
    expect(JSON.parse(capture.body)).toEqual({
      status: "alive",
      posture: "self_service",
    });
  });

  it("stops reading a body once the host aborts", async () => {
    const mount = createServer();
    const { capture, response } = captureNodeResponse();
    const controller = new AbortController();
    let chunksRead = 0;
    // A body that would never end on its own. Only the host's signal can
    // release it; without one, the read is unbounded and the host's drain has
    // nothing it can do about it.
    const endlessBody = {
      async *[Symbol.asyncIterator]() {
        for (;;) {
          chunksRead += 1;
          if (chunksRead === 2) controller.abort();
          yield Buffer.from("x");
          await new Promise((resolve) => setImmediate(resolve));
        }
      },
    };

    await mount.serveNodeRequest(
      nodeRequest({
        method: "POST",
        url: "/v1/models",
        bodyStream: endlessBody,
      }) as never,
      response as never,
      { signal: controller.signal },
    );

    expect(capture.status).toBe(503);
    expect(chunksRead).toBeLessThan(50);
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
    // The refusal now says WHY. A cap breach and a host cancellation are
    // different facts and become different statuses (413 vs 503); a bare
    // `{ ok: false }` forced the caller to guess, and it guessed 413 for both.
    expect(await readCaioAccessGatewayBody(chunks("0123456789"), 4)).toEqual({
      ok: false,
      reason: "too-large",
    });
  });

  it("closes the request iterator when the body exceeds the cap", async () => {
    let returnCalls = 0;
    const oversizedBody: AsyncIterable<Buffer> = {
      [Symbol.asyncIterator]() {
        return {
          next: async () => ({
            done: false as const,
            value: Buffer.from("0123456789", "utf8"),
          }),
          return: async () => {
            returnCalls += 1;
            return { done: true as const, value: undefined };
          },
        };
      },
    };

    expect(await readCaioAccessGatewayBody(oversizedBody, 4)).toEqual({
      ok: false,
      reason: "too-large",
    });
    expect(returnCalls).toBe(1);
  });

  it("reads nothing at all when the host's signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    let pulled = 0;
    async function* counted() {
      pulled += 1;
      yield Buffer.from("0123456789", "utf8");
    }
    expect(
      await readCaioAccessGatewayBody(counted(), 1024, controller.signal),
    ).toEqual({ ok: false, reason: "aborted" });
    // CONTROL: the same generator without a signal is consumed, so the
    // assertion above is about cancellation and not about an inert fixture.
    let pulledAgain = 0;
    async function* countedAgain() {
      pulledAgain += 1;
      yield Buffer.from("0123456789", "utf8");
    }
    expect(await readCaioAccessGatewayBody(countedAgain(), 1024)).toEqual({
      ok: true,
      body: "0123456789",
    });
    expect(pulled).toBe(0);
    expect(pulledAgain).toBe(1);
  });

  it("stops while the first body chunk is still pending", async () => {
    const controller = new AbortController();
    let returnCalls = 0;
    const pendingBody: AsyncIterable<Buffer> = {
      [Symbol.asyncIterator]() {
        return {
          next: () => new Promise<IteratorResult<Buffer>>(() => {}),
          return: async () => {
            returnCalls += 1;
            return { done: true, value: undefined };
          },
        };
      },
    };

    const reading = readCaioAccessGatewayBody(
      pendingBody,
      1024,
      controller.signal,
    );
    controller.abort();

    const result = await Promise.race([
      reading,
      new Promise<"timed-out">((resolve) =>
        setTimeout(() => resolve("timed-out"), 50),
      ),
    ]);
    expect(result).toEqual({ ok: false, reason: "aborted" });
    expect(returnCalls).toBe(1);
  });
});
