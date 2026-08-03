/**
 * The CAIO Access Gateway SURFACE: the protocol core mounted onto a host.
 *
 * V1 PRODUCT BOUNDARY — READ THIS BEFORE ANYTHING ELSE
 * ----------------------------------------------------
 * This surface IS MOUNTED IN V1, as the subset a deployment can actually serve.
 * The owner reversed the earlier "WorkBuddy only" decision on 2026-08-03, on
 * the specific question of whether to mount; the reversal is recorded in
 * helm-self's caio-access-gateway-binding.json, and the overlay composition is
 * what performs the mount. This repository still binds no socket.
 *
 * WHAT IS SERVED, AND WHAT IS NOT
 * -------------------------------
 * Owned when the deployment supplies the ports for them:
 *   /v1/responses  /v1/chat/completions  /v1/models  /livez  /readyz
 *
 * NOT owned unless an MCP dispatcher is supplied:
 *   /mcp
 *
 * That is not a bug to fix later. Five of the six production ports this surface
 * needs now have real implementations in this repository — token authenticator
 * (createCaioAccessTokenService over the Prisma persistence), project resolver,
 * canonical audit gate, readiness probe, and the model proxy engine, with the
 * model alias bindings supplied as deployment DATA by design. The MCP
 * dispatcher has none, and writing a plausible one here would produce a facade
 * that dispatches nothing while looking like it dispatches — the failure this
 * paragraph has warned about since before the mount existed.
 *
 * So `mcpDispatch` is the one OPTIONAL port. Without it the mount does not
 * claim /mcp: the path drops out of `apiPaths`, its route-table row reports
 * servedByThisSurface: false, and `handle` refuses it on ownership before
 * authentication — the same 404 any undeclared path gets, decided before a
 * rate-limit slot or a token store is touched. A deployment therefore serves
 * what it can serve, instead of choosing between a facade and no gateway.
 *
 * WHAT THE PREVIOUS BOUNDARY SAID, AND WHY IT CHANGED
 * ---------------------------------------------------
 * Until 2026-08-03 this header said the surface was NOT mounted, on two
 * grounds: a product edge (WorkBuddy-only was what V1 shipped) and a mechanical
 * fact (the six ports had no implementation anywhere). The mechanical claim had
 * gone stale — five of the six acquired real implementations while the sentence
 * stayed — and the product edge was the owner's to move. Both changed, and this
 * is the record of it rather than a silent edit.
 *
 * RE-ENTRY CONDITIONS FOR /mcp — all of them, or it stays unowned
 * ---------------------------------------------------------------
 *   1. An MCP dispatcher exists as a real implementation, supplied by the
 *      deployment rather than invented in-tree. The Access Gateway's /mcp
 *      authenticates by BEARER TOKEN with capability grants and project
 *      scoping; the WorkBuddy dispatcher authenticates by mTLS client identity.
 *      Bridging the two is an authentication-boundary decision, not an adapter,
 *      and is the owner's to make.
 *   2. helm-self's caio-access-gateway-binding.json records the dispatcher as
 *      supplied, alongside the mount it already records.
 *   3. Owner authorization for that specific surface is recorded in the same
 *      binding — a boundaries.ownerAuthorizationRecorded entry naming /mcp,
 *      as one now records the mount itself.
 *
 * Crossing an owner activation gate as a side effect of a wiring change is the
 * accident this paragraph exists to prevent, and it applies to /mcp now exactly
 * as it applied to the whole surface before. The overlay repository states the
 * same conditions in one place
 * (overlays/helm-self/lib/workbuddy-lan/access-gateway-v1-boundary.ts) and its
 * gates hold the declaration and the enforcement together.
 *
 * WHY THE MOUNT STAYS ANYWAY
 * --------------------------
 * createCaioAccessGatewayMount below has no production caller in any
 * repository; it is exercised by tests and by nothing else. It is kept
 * deliberately. It is the seam a later version mounts, and deleting it would
 * force whoever re-enters to re-derive the route table, the mTLS-first
 * ordering and the surface-ownership split from scratch — the parts that are
 * genuinely hard and are genuinely finished. Mountable and tested is the whole
 * claim being made here.
 *
 * This module is the non-test caller of the gateway protocol core: it mounts
 * createCaioGatewayHandler once. Before it existed the protocol core had no
 * caller outside its own directory and its own tests, so nothing in the tree
 * assembled the Access Gateway API at all.
 *
 * WHY THIS IS A SURFACE AND NOT A SERVER
 * --------------------------------------
 * It used to create its own HTTPS listener on the pinned port. So does the
 * WorkBuddy LAN gateway, and the deployment binds exactly ONE approved private
 * address and port — so the two could never both be served, and the installed
 * process (workbuddy-lan/gateway.cli.ts) served WorkBuddy only. Every Access
 * Gateway route was absent from a real install while the tests, this module's
 * guards, and the packaged evidence all passed. That was not a configuration
 * mistake to document: it was a composition that cannot exist. The listener is
 * therefore gone from here. One host binds one socket and routes by path to
 * both surfaces; this module answers for the Access Gateway paths only.
 *
 * WHAT IS NOT TRUE YET — read this before treating the file as deployed
 * ---------------------------------------------------------------------
 * NO MODULE IN THIS REPOSITORY BINDS A SOCKET FOR THIS SURFACE. The host that
 * does lives in the Overlay repository (helm-self workbuddy-lan composed
 * gateway), which this repository cannot see or test. An earlier version of
 * this header said this module "is what a deployment runner starts", which was
 * false in exactly the way that matters: it described an intended end state as
 * an accomplished one, and anyone auditing the tree for "is the Access Gateway
 * actually served" would have been told yes.
 *
 * What is true is narrower and worth stating precisely: the surface exists, is
 * total over its route table, is mountable onto a host listener, and is covered
 * by tests. Serving traffic additionally requires a host that supplies the
 * socket and the TLS material, and ports that are deployment inputs — which is
 * why no default is invented here. `production-caller.test.ts` fails if this
 * paragraph and the tree ever disagree in either direction.
 *
 * ONE SOCKET, ONE HANDLER
 * -----------------------
 * No listener is created here and none can be: `server.test.ts` scans this
 * source and fails on a node:https import, a createServer call or a .listen
 * call. The config still carries the declared bind address and the pinned port
 * 7443 so a host can be checked against them, and server-config.ts now refuses
 * a WorkBuddy socket that DIFFERS from this one — the shared socket is the
 * composition, a split one is the error.
 *
 * THE ROUTE TABLE (explicit, tested, and owner-labelled)
 * -----------------------------------------------------
 *   path                    methods  owner                  owned here
 *   /mcp                    POST     access_gateway_api     yes
 *   /v1/responses           POST     access_gateway_api     yes
 *   /v1/chat/completions    POST     access_gateway_api     yes
 *   /v1/models              GET      access_gateway_api     yes
 *   /livez                  GET      access_gateway_api     yes
 *   /readyz                 GET      access_gateway_api     yes
 *   /mcp/workbuddy          *        workbuddy_lan_gateway  NO
 *
 * The column says which paths this surface would answer IF a host routed them
 * to it. Per the V1 boundary above, no host does: in V1 every row marked
 * access_gateway_api is 404 at the delivery, and `servedByThisSurface` in the
 * data below means "owned by this surface", never "reachable in V1".
 *
 * This surface owns the ACCESS GATEWAY API only. The WorkBuddy MCP surface
 * (`/mcp/workbuddy`) is terminated by the OTHER surface on the same host, with
 * its own dispatcher; it is listed here precisely so it can be refused
 * explicitly (404) instead of falling through to the API handler. The host
 * routes it away before this module ever sees it, and this refusal is the
 * second line: one surface may never answer for the other.
 *
 * mTLS
 * ----
 * The host demands a client certificate at the TLS layer, and every request is
 * additionally required here to carry a verified peer — derived through the
 * existing client-identity seam (workBuddyMtlsPeerSchema in
 * lib/caio-collaboration/client-identity.ts), which accepts only an authorized
 * socket with a sha256 fingerprint and a source address. A request with no
 * verified peer is refused 401 before any gateway port runs, including on the
 * probe routes. Bearer tokens are the SECOND factor, enforced inside the
 * protocol core.
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
 * Bind address and port come from loadCaioAccessGatewayServerConfig, which
 * throws rather than defaulting; the posture throws when absent. Nothing here
 * degrades to a plaintext or certificate-less path, because nothing here
 * terminates TLS at all.
 */

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

/** The path the WorkBuddy LAN surface owns on the same host. */
export const CAIO_WORKBUDDY_MCP_PATH = "/mcp/workbuddy";

/** Which surface owns a path. `unowned` is anything neither surface declares. */
export type CaioAccessGatewaySurfaceOwner =
  | "access_gateway_api"
  | "workbuddy_lan_gateway"
  | "unowned";

export type CaioAccessGatewayRoute = Readonly<{
  path: string;
  /** `*` means every method, used only for a path this process refuses. */
  methods: readonly string[];
  owner: CaioAccessGatewaySurfaceOwner;
  servedByThisSurface: boolean;
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
      servedByThisSurface: true,
    }),
    Object.freeze({
      path: "/v1/responses",
      methods: Object.freeze(["POST"]),
      owner: "access_gateway_api" as const,
      servedByThisSurface: true,
    }),
    Object.freeze({
      path: "/v1/chat/completions",
      methods: Object.freeze(["POST"]),
      owner: "access_gateway_api" as const,
      servedByThisSurface: true,
    }),
    Object.freeze({
      path: "/v1/models",
      methods: Object.freeze(["GET"]),
      owner: "access_gateway_api" as const,
      servedByThisSurface: true,
    }),
    Object.freeze({
      path: "/livez",
      methods: Object.freeze(["GET"]),
      owner: "access_gateway_api" as const,
      servedByThisSurface: true,
    }),
    Object.freeze({
      path: "/readyz",
      methods: Object.freeze(["GET"]),
      owner: "access_gateway_api" as const,
      servedByThisSurface: true,
    }),
    Object.freeze({
      // Declared so it is refused EXPLICITLY here, never answered by the API.
      path: CAIO_WORKBUDDY_MCP_PATH,
      methods: Object.freeze(["*"]),
      owner: "workbuddy_lan_gateway" as const,
      servedByThisSurface: false,
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
  /**
   * The proxy engine; the in-tree bridge adapts it to the gateway contract.
   *
   * OPTIONAL, for the same reason mcpDispatch is. Dispatch calls an upstream
   * model provider with that provider's credentials — real external egress —
   * whereas discovery (`GET /v1/models`) is built in-tree from `bindings` and
   * calls nothing. A deployment that has bindings but no upstream engine can
   * serve discovery honestly; without this it would have to choose between
   * fabricating an engine and mounting nothing.
   *
   * When it is absent, /v1/responses and /v1/chat/completions are NOT OWNED by
   * the mount, on exactly the terms /mcp is not owned without a dispatcher.
   */
  engine?: CaioModelProxy;
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
  /**
   * OPTIONAL, and the only optional port here.
   *
   * Five of the six ports this surface needs have real implementations in this
   * repository. The MCP dispatcher does not, and writing a plausible one
   * in-tree would produce a facade that dispatches nothing while looking like
   * it dispatches — the specific failure this surface's header warns about.
   *
   * When it is absent, `/mcp` is NOT OWNED by the mount: it drops out of
   * `apiPaths`, its route-table row reports `servedByThisSurface: false`, and
   * `handle` refuses it on ownership before authentication. A deployment can
   * therefore serve the subset it can actually serve, instead of choosing
   * between a facade and no gateway at all.
   */
  mcpDispatch?: CaioMcpDispatchPort;
  modelProxy: CaioAccessGatewayModelPorts;
  auditGate: CaioCanonicalAuditGatePort;
  readinessProbe: CaioReadinessProbePort;
}>;

export type CaioAccessGatewayServerErrorCode =
  | "POSTURE_MISMATCH"
  /**
   * Raised only if a path this mount does not own somehow reaches the protocol
   * core. It cannot happen through `handle`, which refuses an unowned /mcp on
   * ownership first; it exists so that a future change breaking that ordering
   * fails loudly instead of quietly serving a path the mount never claimed.
   */
  | "MCP_DISPATCH_UNAVAILABLE"
  /** As above, for the two upstream dispatch paths. */
  | "MODEL_DISPATCH_UNAVAILABLE";

export class CaioAccessGatewayServerError extends Error {
  readonly code: CaioAccessGatewayServerErrorCode;

  constructor(code: CaioAccessGatewayServerErrorCode, message: string) {
    super(message);
    this.name = "CaioAccessGatewayServerError";
    this.code = code;
  }
}

/**
 * The mounted Access Gateway surface.
 *
 * It answers requests; it never owns a socket. The host that binds the one
 * listener routes the paths in `apiPaths` here and everything else elsewhere.
 */
export type CaioAccessGatewayMount = Readonly<{
  config: CaioAccessGatewayServerConfig;
  posture: CaioDeploymentPosture;
  routeTable: readonly CaioAccessGatewayRoute[];
  /** The paths a host must route to this surface. */
  apiPaths: readonly string[];
  /** Serve one normalized request through the route table. */
  handle(request: CaioAccessGatewayIncoming): Promise<CaioGatewayResponse>;
  /**
   * Serve one node request onto the host's response. The host has already
   * terminated TLS and demanded the client certificate; the verified peer is
   * read back off the socket here so this surface never trusts a header.
   *
   * `options.signal` is the HOST's cancellation for this request — shutdown or
   * the request deadline. It is honoured before any port is touched, during the
   * body read, and again before the answer is written, so a host that is
   * draining can actually stop this work rather than wait on it or report
   * itself idle while it runs.
   */
  serveNodeRequest(
    request: IncomingMessage,
    response: ServerResponse,
    options?: Readonly<{ signal?: AbortSignal }>,
  ): Promise<void>;
}>;

export type CaioAccessGatewayMountInput = Readonly<{
  config: CaioAccessGatewayServerConfig;
  /** Declared, never inferred; must equal the audit gate's own posture. */
  posture: CaioDeploymentPosture;
  ports: CaioAccessGatewayServerPorts;
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
 *
 * The optional `signal` is the HOST's cancellation. A body is the one part of a
 * request whose length the peer controls, so it is where an unbounded read
 * lives: without a signal the loop below runs until the client decides to stop,
 * and a host trying to shut down can only wait or lie about being idle. The
 * check is at the top of each iteration, so an already-aborted signal reads
 * nothing at all.
 */
export async function readCaioAccessGatewayBody(
  chunks: AsyncIterable<Buffer | string>,
  maxBytes: number,
  signal?: AbortSignal,
): Promise<
  | Readonly<{ ok: true; body: string }>
  | Readonly<{ ok: false; reason: "too-large" | "aborted" }>
> {
  const parts: Buffer[] = [];
  let size = 0;
  for await (const chunk of chunks) {
    if (signal?.aborted) {
      return Object.freeze({ ok: false as const, reason: "aborted" as const });
    }
    const buffer =
      typeof chunk === "string" ? Buffer.from(chunk, "utf8") : chunk;
    size += buffer.byteLength;
    if (size > maxBytes) {
      return Object.freeze({ ok: false as const, reason: "too-large" as const });
    }
    parts.push(buffer);
  }
  return Object.freeze({
    ok: true as const,
    body: Buffer.concat(parts).toString("utf8"),
  });
}

export function createCaioAccessGatewayMount(
  input: CaioAccessGatewayMountInput,
): CaioAccessGatewayMount {
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

  // The /v1 dispatch surface, composed from the in-tree bridge so the chain
  // gateway -> proxy -> canonical audit gate is the real one.
  const engine = input.ports.modelProxy.engine;
  const modelDispatch = engine
    ? createCaioGatewayModelDispatchPort({ proxy: engine })
    : null;

  // Discovery is derived from the same bindings the dispatch path resolves
  // against, so a suspended or ungranted route can never be advertised.
  const modelList = createCaioGatewayModelListPort({
    bindings: input.ports.modelProxy.bindings,
  });

  // Which paths THIS mount owns. `/mcp` only when a dispatcher was supplied;
  // see the port's declaration for why it is the one optional input.
  const servesMcp = typeof input.ports.mcpDispatch === "function";
  const servesModelDispatch = modelDispatch !== null;
  const UNOWNED_WITHOUT_PORT: Readonly<Record<string, boolean>> = Object.freeze({
    "/mcp": servesMcp,
    "/v1/responses": servesModelDispatch,
    "/v1/chat/completions": servesModelDispatch,
  });
  const routeTable: readonly CaioAccessGatewayRoute[] = Object.freeze(
    CAIO_ACCESS_GATEWAY_ROUTE_TABLE.map((row) =>
      row.path in UNOWNED_WITHOUT_PORT
        ? Object.freeze({
            ...row,
            servedByThisSurface: UNOWNED_WITHOUT_PORT[row.path] === true,
          })
        : row,
    ),
  );
  const apiPaths: readonly string[] = Object.freeze(
    routeTable
      .filter((row) => row.owner === "access_gateway_api" && row.servedByThisSurface)
      .map((row) => row.path),
  );

  const dependencies: CaioGatewayHandlerDependencies = {
    preAuthRateLimiter: input.ports.preAuthRateLimiter,
    tokenAuthenticator: input.ports.tokenAuthenticator,
    projectResolver: input.ports.projectResolver,
    // Unreachable when no dispatcher was supplied: `handle` refuses /mcp on
    // ownership before anything here runs, and a test asserts no port is
    // touched. It throws rather than returning a plausible answer so that a
    // future change which breaks that ordering fails loudly instead of
    // silently serving an unowned path.
    mcpDispatch:
      input.ports.mcpDispatch ??
      (() => {
        throw new CaioAccessGatewayServerError(
          "MCP_DISPATCH_UNAVAILABLE",
          "no MCP dispatcher was supplied to this mount; /mcp is not owned by it",
        );
      }),
    modelProxy: {
      // Unreachable without an engine: `handle` refuses both dispatch paths on
      // ownership first. Throwing rather than answering keeps a future ordering
      // mistake loud instead of plausible.
      responses:
        modelDispatch?.responses ??
        (() => {
          throw new CaioAccessGatewayServerError(
            "MODEL_DISPATCH_UNAVAILABLE",
            "no upstream model engine was supplied to this mount; /v1/responses is not owned by it",
          );
        }),
      chatCompletions:
        modelDispatch?.chatCompletions ??
        (() => {
          throw new CaioAccessGatewayServerError(
            "MODEL_DISPATCH_UNAVAILABLE",
            "no upstream model engine was supplied to this mount; /v1/chat/completions is not owned by it",
          );
        }),
      listModels: modelList.listModels,
    },
    auditGate: input.ports.auditGate,
    readinessProbe: input.ports.readinessProbe,
    featureFlags: input.config.featureFlags,
    maxBodyBytes,
    rateLimitPerMinute: input.rateLimitPerMinute,
  };

  // THE mounted protocol core. One handler for every path this surface owns.
  const handler = createCaioGatewayHandler(dependencies);

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
    // A path this MOUNT does not own is refused here too, on the same terms and
    // in the same place. /mcp without a dispatcher is not "a route that will
    // fail later": it is not served, so it is answered exactly as any undeclared
    // path is — before authentication, before the rate limiter, before any port.
    const requestPath = request.url.split("?")[0] ?? "";
    if (
      requestPath in UNOWNED_WITHOUT_PORT &&
      UNOWNED_WITHOUT_PORT[requestPath] !== true
    ) {
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

  async function serveNodeRequest(
    request: IncomingMessage,
    response: ServerResponse,
    options?: Readonly<{ signal?: AbortSignal }>,
  ): Promise<void> {
    const signal = options?.signal;
    let result: CaioGatewayResponse;
    // BEFORE ANY PORT IS TOUCHED. The host aborts on shutdown and on the
    // request deadline; starting work it has already given up on would make
    // its drain wait for something nobody is waiting for, and would let a
    // request that arrived after shutdown reach a token authenticator, a model
    // proxy or an audit gate.
    if (signal?.aborted) {
      result = wireResponse(
        toGatewayError({
          status: 503,
          error: "caio_request_cancelled",
          retryAfterSeconds: 1,
        }),
      );
      response.writeHead(result.status, { ...result.headers });
      response.end(JSON.stringify(result.body ?? null));
      return;
    }
    try {
      const read = await readCaioAccessGatewayBody(
        request,
        maxBodyBytes,
        signal,
      );
      if (read.ok) {
        result = await handle({
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
        });
        // Aborted while the route was running: the host is no longer waiting
        // for this answer, and sending a success would report work as
        // delivered that the host has already accounted as cancelled.
        if (signal?.aborted) {
          result = wireResponse(
        toGatewayError({
          status: 503,
          error: "caio_request_cancelled",
          retryAfterSeconds: 1,
        }),
      );
        }
      } else {
        // A cancelled read and an oversized one are different facts: one is the
        // host withdrawing, the other is the peer exceeding a cap.
        result =
          read.reason === "aborted"
            ? wireResponse(
                toGatewayError({
                  status: 503,
                  error: "caio_request_cancelled",
                  retryAfterSeconds: 1,
                }),
              )
            : wireResponse(toGatewayError({ status: 413 }));
      }
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
    routeTable,
    apiPaths,
    handle,
    serveNodeRequest,
  });
}
