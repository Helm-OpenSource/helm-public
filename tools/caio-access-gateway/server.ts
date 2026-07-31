/**
 * The production composition for the CAIO access gateway.
 *
 * This module is the non-test caller of the gateway protocol core: it mounts
 * createCaioGatewayHandler on ONE HTTPS/mTLS listener. Before it existed the
 * protocol core had no caller outside its own directory and its own tests, so
 * nothing in the tree assembled the Access Gateway API at all.
 *
 * WHAT IS NOT TRUE YET — read this before treating the file as deployed
 * ---------------------------------------------------------------------
 * NOTHING IN ANY OF THE FOUR REPOSITORIES STARTS THIS COMPOSITION.
 * `createCaioAccessGatewayServer` has no non-test caller: there is no CLI
 * entrypoint, no launchd job, and no service unit that invokes it, and the
 * launcher the delivery package generates starts a DIFFERENT process — the
 * WorkBuddy LAN gateway (`workbuddy-lan/gateway.cli.ts`). An earlier version of
 * this header said this module "is what a deployment runner starts", which was
 * false in exactly the way that matters: it described an intended end state as
 * an accomplished one, and anyone auditing the tree for "is the Access Gateway
 * actually served" would have been told yes.
 *
 * What is true is narrower and worth stating precisely: the composition exists,
 * is total over its route table, refuses to start twice, and is covered by
 * tests. Serving traffic additionally requires an entrypoint that supplies the
 * bind address, the TLS material and the posture — all of them deployment
 * inputs, which is why no default is invented here. `production-caller.test.ts`
 * fails if this paragraph and the tree ever disagree in either direction.
 *
 * ONE PROCESS, ONE SOCKET, ONE HANDLER
 * ------------------------------------
 * Exactly one TLS listener is created (listenerFactory is called once, from
 * start()), bound to the configured private-LAN address on the pinned port
 * 7443. A second start() is refused rather than opening a second socket, and
 * server-config.ts refuses to load at all when the WorkBuddy LAN gateway is
 * configured onto the same address:port — two listeners can never contend.
 *
 * THE ROUTE TABLE (explicit, tested, and owner-labelled)
 * -----------------------------------------------------
 *   path                    methods  owner                  served here
 *   /mcp                    POST     access_gateway_api     yes
 *   /v1/responses           POST     access_gateway_api     yes
 *   /v1/chat/completions    POST     access_gateway_api     yes
 *   /v1/models              GET      access_gateway_api     yes
 *   /livez                  GET      access_gateway_api     yes
 *   /readyz                 GET      access_gateway_api     yes
 *   /mcp/workbuddy          *        workbuddy_lan_gateway  NO
 *
 * This composition owns the ACCESS GATEWAY API only. The WorkBuddy MCP surface
 * (`/mcp/workbuddy`) is terminated by a different process with its own mTLS
 * material and its own dispatcher; it is listed here precisely so it can be
 * refused explicitly (404, before any port is touched) instead of falling
 * through to the API handler. One surface may never answer for the other, and
 * an operator reading this table can see which process owns which path.
 *
 * mTLS
 * ----
 * The listener demands a client certificate (`requestCert` + `rejectUnauthorized`
 * against the configured client CA), and every request is additionally required
 * to carry a verified peer — derived through the existing client-identity seam
 * (workBuddyMtlsPeerSchema in lib/caio-collaboration/client-identity.ts), which
 * accepts only an authorized socket with a sha256 fingerprint and a source
 * address. A request with no verified peer is refused 401 before any gateway
 * port runs, including on the probe routes: everything on this listener is
 * mutually authenticated. Bearer tokens are the SECOND factor, enforced inside
 * the protocol core.
 *
 * POSTURE
 * -------
 * The deployment posture (`self_service` | `governed_fde`) is a declared
 * property supplied by the caller — never read from the environment, never
 * defaulted (owner ruling of 2026-07-30). It must equal the posture of the
 * wired audit gate or construction fails, and the model proxy enforces the same
 * equality against the same gate, so all three agree by construction. It is
 * reported on /livez and /readyz by the protocol core.
 *
 * FAIL-CLOSED CONSTRUCTION
 * ------------------------
 * Certificate paths, bind address and port come from
 * loadCaioAccessGatewayServerConfig, which throws rather than defaulting;
 * the posture throws when absent; the TLS material is read at start() and a
 * read failure propagates instead of starting a plaintext or
 * certificate-less listener.
 */

import { readFile } from "node:fs/promises";
import { createServer as createHttpsServer } from "node:https";
import type { IncomingMessage, ServerResponse } from "node:http";

import {
  CAIO_GATEWAY_DEFAULT_MAX_BODY_BYTES,
  createCaioGatewayHandler,
  type CaioGatewayHandlerDependencies,
  type CaioGatewayResponse,
  type CaioMcpDispatchPort,
  type CaioReadinessProbePort,
  type CaioTokenAuthenticatorPort,
} from "@/lib/caio-access-gateway/gateway-http-core";
import { toGatewayError } from "@/lib/caio-access-gateway/gateway-error-contract";
import {
  createCaioGatewayModelDispatchPort,
  createCaioGatewayModelListPort,
} from "@/lib/caio-access-gateway/model-dispatch-bridge";
import type { ProjectMembershipResolver } from "@/lib/caio-access-gateway/project-access";
import type { CaioPreAuthRateLimiterPort } from "@/lib/caio-access-gateway/source-ip-rate-limiter";
import type { CaioCanonicalAuditGatePort } from "@/lib/caio-audit-state/gateway-audit-gate-adapter";
import {
  parseCaioDeploymentPosture,
  type CaioDeploymentPosture,
} from "@/lib/caio-audit-state/deployment-posture";
import {
  workBuddyMtlsPeerSchema,
  type WorkBuddyMtlsPeer,
} from "@/lib/caio-collaboration/client-identity";
import type { CaioModelAliasBinding } from "@/lib/caio-model-proxy/alias-contracts";
import type { CaioModelProxy } from "@/lib/caio-model-proxy/proxy-engine";

import type { CaioAccessGatewayServerConfig } from "@/tools/caio-access-gateway/server-config";

/** The path the WorkBuddy LAN gateway owns — in a DIFFERENT process. */
export const CAIO_WORKBUDDY_MCP_PATH = "/mcp/workbuddy";

/** Which process owns a path. `unowned` is anything neither surface declares. */
export type CaioAccessGatewaySurfaceOwner =
  | "access_gateway_api"
  | "workbuddy_lan_gateway"
  | "unowned";

export type CaioAccessGatewayRoute = Readonly<{
  path: string;
  /** `*` means every method, used only for a path this process refuses. */
  methods: readonly string[];
  owner: CaioAccessGatewaySurfaceOwner;
  servedByThisProcess: boolean;
}>;

/**
 * The route table, as data. Method-level enforcement (405 + Allow) belongs to
 * the protocol core, which already declares it; this table records path
 * OWNERSHIP so the two surfaces cannot be confused and so a test can assert
 * the split.
 */
export const CAIO_ACCESS_GATEWAY_ROUTE_TABLE: readonly CaioAccessGatewayRoute[] =
  Object.freeze([
    Object.freeze({
      path: "/mcp",
      methods: Object.freeze(["POST"]),
      owner: "access_gateway_api" as const,
      servedByThisProcess: true,
    }),
    Object.freeze({
      path: "/v1/responses",
      methods: Object.freeze(["POST"]),
      owner: "access_gateway_api" as const,
      servedByThisProcess: true,
    }),
    Object.freeze({
      path: "/v1/chat/completions",
      methods: Object.freeze(["POST"]),
      owner: "access_gateway_api" as const,
      servedByThisProcess: true,
    }),
    Object.freeze({
      path: "/v1/models",
      methods: Object.freeze(["GET"]),
      owner: "access_gateway_api" as const,
      servedByThisProcess: true,
    }),
    Object.freeze({
      path: "/livez",
      methods: Object.freeze(["GET"]),
      owner: "access_gateway_api" as const,
      servedByThisProcess: true,
    }),
    Object.freeze({
      path: "/readyz",
      methods: Object.freeze(["GET"]),
      owner: "access_gateway_api" as const,
      servedByThisProcess: true,
    }),
    Object.freeze({
      // Declared so it is refused EXPLICITLY here, never answered by the API.
      path: CAIO_WORKBUDDY_MCP_PATH,
      methods: Object.freeze(["*"]),
      owner: "workbuddy_lan_gateway" as const,
      servedByThisProcess: false,
    }),
  ]);

/** The API paths this process serves. */
export const CAIO_ACCESS_GATEWAY_API_PATHS: readonly string[] = Object.freeze(
  CAIO_ACCESS_GATEWAY_ROUTE_TABLE.filter(
    (route) => route.owner === "access_gateway_api",
  ).map((route) => route.path),
);

const ROUTE_OWNER_BY_PATH: ReadonlyMap<string, CaioAccessGatewaySurfaceOwner> =
  new Map(CAIO_ACCESS_GATEWAY_ROUTE_TABLE.map((r) => [r.path, r.owner]));

/** Path-only owner lookup; a query string never changes ownership. */
export function caioAccessGatewayRouteOwner(
  path: string,
): CaioAccessGatewaySurfaceOwner {
  return ROUTE_OWNER_BY_PATH.get(path.split("?")[0] ?? "") ?? "unowned";
}

/** The TLS-socket facts this composition reads. Structural on purpose. */
export type CaioTlsSocketFacts = Readonly<{
  authorized?: boolean;
  remoteAddress?: string;
  getPeerCertificate?: (detailed?: boolean) =>
    | Readonly<{ fingerprint256?: string }>
    | undefined;
}>;

const SHA256_HEX = /^[a-f0-9]{64}$/;

/**
 * Derive the bounded mTLS peer identity from a TLS socket, or null.
 *
 * Fails closed on every missing fact: an unauthorized socket, an absent or
 * malformed certificate fingerprint, and a missing source address all yield
 * null. The result is validated by the shared workBuddyMtlsPeerSchema rather
 * than trusted from shape, so this composition and the WorkBuddy surface speak
 * the same identity contract.
 */
export function caioAccessGatewayMtlsPeer(
  socket: CaioTlsSocketFacts,
): WorkBuddyMtlsPeer | null {
  if (socket.authorized !== true) return null;
  const certificate = socket.getPeerCertificate?.();
  const raw = certificate?.fingerprint256;
  if (typeof raw !== "string") return null;
  const normalized = raw.replaceAll(":", "").toLowerCase();
  if (!SHA256_HEX.test(normalized)) return null;
  const parsed = workBuddyMtlsPeerSchema.safeParse({
    certificateFingerprint: `sha256:${normalized}`,
    sourceAddress: socket.remoteAddress ?? "",
    authorized: true,
  });
  return parsed.success ? parsed.data : null;
}

/** A transport-normalized request, independent of node's IncomingMessage. */
export type CaioAccessGatewayIncoming = Readonly<{
  method: string;
  /** Path plus optional query string, as received. */
  url: string;
  headers: Readonly<Record<string, string | string[] | undefined>>;
  /** Peer address as the transport observed it; never a header. */
  clientIp: string | null;
  /** The verified mTLS peer, or null when the transport could not verify one. */
  peer: WorkBuddyMtlsPeer | null;
  body: string | null;
}>;

/** Model ports this composition binds onto the /v1 surface. */
export type CaioAccessGatewayModelPorts = Readonly<{
  /** The proxy engine; the in-tree bridge adapts it to the gateway contract. */
  engine: CaioModelProxy;
  /**
   * The alias bindings this deployment serves. Discovery (`GET /v1/models`) is
   * built FROM these by the in-tree list port rather than supplied as a
   * function: a deployment-supplied listing implementation was handed no grant
   * and so could only answer from the client type's default, which listed
   * aliases to tokens that had been granted none. Taking data instead of a
   * function removes that failure mode instead of documenting it.
   */
  bindings: readonly CaioModelAliasBinding[];
}>;

/** Production ports the deployment supplies. */
export type CaioAccessGatewayServerPorts = Readonly<{
  preAuthRateLimiter: CaioPreAuthRateLimiterPort;
  tokenAuthenticator: CaioTokenAuthenticatorPort;
  projectResolver: ProjectMembershipResolver;
  mcpDispatch: CaioMcpDispatchPort;
  modelProxy: CaioAccessGatewayModelPorts;
  auditGate: CaioCanonicalAuditGatePort;
  readinessProbe: CaioReadinessProbePort;
}>;

export type CaioAccessGatewayTlsMaterial = Readonly<{
  cert: string | Buffer;
  key: string | Buffer;
  ca: string | Buffer;
}>;

export type CaioAccessGatewayTlsOptions = CaioAccessGatewayTlsMaterial &
  Readonly<{
    requestCert: true;
    rejectUnauthorized: true;
    minVersion: "TLSv1.2";
  }>;

export type CaioAccessGatewayListener = Readonly<{
  listen(target: Readonly<{ host: string; port: number }>): Promise<void>;
  close(): Promise<void>;
}>;

export type CaioAccessGatewayListenerFactory = (
  input: Readonly<{
    tls: CaioAccessGatewayTlsOptions;
    onRequest: (
      request: IncomingMessage,
      response: ServerResponse,
    ) => Promise<void>;
  }>,
) => CaioAccessGatewayListener;

export type CaioAccessGatewayServerErrorCode =
  | "ALREADY_STARTED"
  | "POSTURE_MISMATCH";

export class CaioAccessGatewayServerError extends Error {
  readonly code: CaioAccessGatewayServerErrorCode;

  constructor(code: CaioAccessGatewayServerErrorCode, message: string) {
    super(message);
    this.name = "CaioAccessGatewayServerError";
    this.code = code;
  }
}

export type CaioAccessGatewayServer = Readonly<{
  config: CaioAccessGatewayServerConfig;
  posture: CaioDeploymentPosture;
  routeTable: readonly CaioAccessGatewayRoute[];
  /** Serve one normalized request through the route table. */
  handle(request: CaioAccessGatewayIncoming): Promise<CaioGatewayResponse>;
  /** Bind THE listener. Refuses a second call. */
  start(): Promise<Readonly<{ host: string; port: number }>>;
  close(): Promise<void>;
}>;

export type CaioAccessGatewayServerInput = Readonly<{
  config: CaioAccessGatewayServerConfig;
  /** Declared, never inferred; must equal the audit gate's own posture. */
  posture: CaioDeploymentPosture;
  ports: CaioAccessGatewayServerPorts;
  /** Injection seam for tests; production uses the node https listener. */
  listenerFactory?: CaioAccessGatewayListenerFactory;
  tlsMaterialLoader?: (
    config: CaioAccessGatewayServerConfig,
  ) => Promise<CaioAccessGatewayTlsMaterial>;
  maxBodyBytes?: number;
  rateLimitPerMinute?: number;
}>;

const JSON_CONTENT_TYPE = "application/json; charset=utf-8";

function firstHeaderValue(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) return value.join(", ");
  return value;
}

function lowerCasedHeaders(
  headers: Readonly<Record<string, string | string[] | undefined>>,
): Record<string, string | undefined> {
  const normalized: Record<string, string | undefined> = {};
  for (const [name, value] of Object.entries(headers)) {
    normalized[name.toLowerCase()] = firstHeaderValue(value);
  }
  return normalized;
}

function wireResponse(
  error: ReturnType<typeof toGatewayError>,
): CaioGatewayResponse {
  return Object.freeze({
    status: error.status,
    headers: Object.freeze({
      "content-type": JSON_CONTENT_TYPE,
      ...error.headers,
    }),
    body: error.body,
  });
}

/**
 * Read a request body with a hard cap, refusing rather than buffering past it.
 * Exported so the cap is testable without a socket.
 */
export async function readCaioAccessGatewayBody(
  chunks: AsyncIterable<Buffer | string>,
  maxBytes: number,
): Promise<Readonly<{ ok: true; body: string }> | Readonly<{ ok: false }>> {
  const parts: Buffer[] = [];
  let size = 0;
  for await (const chunk of chunks) {
    const buffer =
      typeof chunk === "string" ? Buffer.from(chunk, "utf8") : chunk;
    size += buffer.byteLength;
    if (size > maxBytes) return Object.freeze({ ok: false as const });
    parts.push(buffer);
  }
  return Object.freeze({
    ok: true as const,
    body: Buffer.concat(parts).toString("utf8"),
  });
}

/** Production listener: ONE node https server demanding client certificates. */
function createNodeHttpsListener(
  input: Parameters<CaioAccessGatewayListenerFactory>[0],
): CaioAccessGatewayListener {
  const server = createHttpsServer(input.tls, (request, response) => {
    void input.onRequest(request, response);
  });
  return Object.freeze({
    listen: (target) =>
      new Promise<void>((resolve, reject) => {
        const onError = (error: Error) => reject(error);
        server.once("error", onError);
        // `exclusive` so a second process cannot silently share this socket.
        server.listen({ ...target, exclusive: true }, () => {
          server.off("error", onError);
          resolve();
        });
      }),
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  });
}

async function readTlsMaterialFromDisk(
  config: CaioAccessGatewayServerConfig,
): Promise<CaioAccessGatewayTlsMaterial> {
  const [cert, key, ca] = await Promise.all([
    readFile(config.mtls.certificatePath),
    readFile(config.mtls.privateKeyPath),
    readFile(config.mtls.clientCaPath),
  ]);
  return Object.freeze({ cert, key, ca });
}

export function createCaioAccessGatewayServer(
  input: CaioAccessGatewayServerInput,
): CaioAccessGatewayServer {
  // Declared posture, parsed fail-closed: absent or unparseable cannot start.
  const posture = parseCaioDeploymentPosture(input.posture);
  if (input.ports.auditGate.posture !== posture) {
    throw new CaioAccessGatewayServerError(
      "POSTURE_MISMATCH",
      `posture mismatch: server is ${posture}, audit gate is ${String(
        input.ports.auditGate.posture,
      )}`,
    );
  }

  const maxBodyBytes = input.maxBodyBytes ?? CAIO_GATEWAY_DEFAULT_MAX_BODY_BYTES;
  const listenerFactory = input.listenerFactory ?? createNodeHttpsListener;
  const loadTlsMaterial = input.tlsMaterialLoader ?? readTlsMaterialFromDisk;

  // The /v1 dispatch surface, composed from the in-tree bridge so the chain
  // gateway -> proxy -> canonical audit gate is the real one.
  const modelDispatch = createCaioGatewayModelDispatchPort({
    proxy: input.ports.modelProxy.engine,
  });

  // Discovery is derived from the same bindings the dispatch path resolves
  // against, so a suspended or ungranted route can never be advertised.
  const modelList = createCaioGatewayModelListPort({
    bindings: input.ports.modelProxy.bindings,
  });

  const dependencies: CaioGatewayHandlerDependencies = {
    preAuthRateLimiter: input.ports.preAuthRateLimiter,
    tokenAuthenticator: input.ports.tokenAuthenticator,
    projectResolver: input.ports.projectResolver,
    mcpDispatch: input.ports.mcpDispatch,
    modelProxy: {
      responses: modelDispatch.responses,
      chatCompletions: modelDispatch.chatCompletions,
      listModels: modelList.listModels,
    },
    auditGate: input.ports.auditGate,
    readinessProbe: input.ports.readinessProbe,
    featureFlags: input.config.featureFlags,
    maxBodyBytes,
    rateLimitPerMinute: input.rateLimitPerMinute,
  };

  // THE mounted protocol core. One handler for every surface this process owns.
  const handler = createCaioGatewayHandler(dependencies);

  let listener: CaioAccessGatewayListener | null = null;

  async function handle(
    request: CaioAccessGatewayIncoming,
  ): Promise<CaioGatewayResponse> {
    // 1. mTLS first: no verified peer, no surface at all.
    if (request.peer === null) {
      return wireResponse(
        toGatewayError({
          status: 401,
          reason: "mtls_client_certificate_required",
        }),
      );
    }

    // 2. Ownership: a path this process does not serve is refused here, so the
    //    Access Gateway API can never answer for the WorkBuddy gateway.
    const owner = caioAccessGatewayRouteOwner(request.url);
    if (owner === "workbuddy_lan_gateway") {
      return wireResponse(toGatewayError({ status: 404 }));
    }

    // 3. A request with no observed peer address cannot be rate-limited or
    //    source-ip checked; refuse rather than pass an empty address on.
    const clientIp = request.clientIp?.trim() ?? "";
    if (clientIp.length === 0) {
      return wireResponse(
        toGatewayError({ status: 400, reason: "client_address_unresolved" }),
      );
    }

    // 4. The mounted protocol core owns everything else, including its own
    //    404/405 answers for API paths.
    return handler({
      method: request.method,
      path: request.url,
      headers: lowerCasedHeaders(request.headers),
      clientIp,
      body: request.body,
    });
  }

  async function onRequest(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> {
    let result: CaioGatewayResponse;
    try {
      const read = await readCaioAccessGatewayBody(request, maxBodyBytes);
      result = read.ok
        ? await handle({
            method: request.method ?? "",
            url: request.url ?? "",
            headers: request.headers,
            clientIp:
              (request.socket as unknown as CaioTlsSocketFacts).remoteAddress ??
              null,
            peer: caioAccessGatewayMtlsPeer(
              request.socket as unknown as CaioTlsSocketFacts,
            ),
            body: read.body,
          })
        : wireResponse(toGatewayError({ status: 413 }));
    } catch {
      // Nothing about an internal failure reaches the wire.
      result = wireResponse(toGatewayError({ status: 502 }));
    }
    response.writeHead(result.status, { ...result.headers });
    response.end(JSON.stringify(result.body ?? null));
  }

  return Object.freeze({
    config: input.config,
    posture,
    routeTable: CAIO_ACCESS_GATEWAY_ROUTE_TABLE,
    handle,
    async start() {
      if (listener !== null) {
        throw new CaioAccessGatewayServerError(
          "ALREADY_STARTED",
          "The CAIO access gateway listener is already started; one process owns one socket.",
        );
      }
      const material = await loadTlsMaterial(input.config);
      listener = listenerFactory({
        tls: Object.freeze({
          ...material,
          // Client certificates are demanded by the listener itself, not only
          // checked afterwards.
          requestCert: true as const,
          rejectUnauthorized: true as const,
          minVersion: "TLSv1.2" as const,
        }),
        onRequest,
      });
      await listener.listen({
        host: input.config.bindAddress,
        port: input.config.port,
      });
      return Object.freeze({
        host: input.config.bindAddress,
        port: input.config.port,
      });
    },
    async close() {
      const current = listener;
      listener = null;
      if (current !== null) await current.close();
    },
  });
}
