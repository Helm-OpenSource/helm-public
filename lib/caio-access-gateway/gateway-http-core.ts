/**
 * Framework-free CAIO gateway protocol core.
 *
 * No network listening happens here: the handler is a pure async
 * function over a normalized request descriptor, suitable for a node
 * https server adapter. All collaborators are injected ports.
 *
 * Request pipeline order (tested):
 *   parse route -> bearer extract -> authenticate(audience)
 *   -> source ip check (inside the authenticator, from the injected
 *      client ip) -> body size cap (1 MiB default) -> dispatch.
 *
 * Liveness vs readiness: GET /livez only proves the process is alive and
 * never touches the database or any business port; GET /readyz reflects
 * the audit-state readiness port. HTTP liveness is deliberately not
 * conflated with db/business health.
 */

import { randomUUID } from "node:crypto";

import {
  caioGatewayWireErrorFromError,
  isCaioAccessGatewayError,
  toGatewayError,
  type CaioGatewayWireError,
} from "@/lib/caio-access-gateway/gateway-error-contract";
import {
  assertProjectAccess,
  type ProjectMembershipResolver,
} from "@/lib/caio-access-gateway/project-access";
import type { CaioTokenAudience } from "@/lib/caio-access-gateway/token-contracts";
import type {
  CaioAccessPrincipal,
} from "@/lib/caio-access-gateway/token-store.service";

export const CAIO_GATEWAY_DEFAULT_MAX_BODY_BYTES = 1024 * 1024;

export type CaioGatewayRequest = Readonly<{
  method: string;
  /** Path only; a query string, if present, is ignored for routing. */
  path: string;
  /** Header names must be lower-cased by the transport adapter. */
  headers: Readonly<Record<string, string | undefined>>;
  /** Client ip as observed by the transport adapter (not any header). */
  clientIp: string;
  body?: string | Uint8Array | null;
}>;

export type CaioGatewayResponse = Readonly<{
  status: number;
  headers: Readonly<Record<string, string>>;
  /** JSON-serializable payload; the adapter stringifies it. */
  body: unknown;
}>;

export type CaioTokenAuthenticatorPort = Readonly<{
  authenticate(input: {
    rawToken: string;
    expectedAudience: CaioTokenAudience;
    sourceIp: string;
    now: Date;
    rateLimitPerMinute?: number;
  }): Promise<CaioAccessPrincipal>;
}>;

export type CaioMcpDispatchPort = (input: {
  principal: CaioAccessPrincipal;
  requestId: string;
  payload: unknown;
  /** Live per-request project gate bound to the injected resolver. */
  assertProjectAccess(projectRef: string): Promise<void>;
}) => Promise<unknown>;

export type CaioModelProxyPort = Readonly<{
  responses(input: {
    principal: CaioAccessPrincipal;
    requestId: string;
    payload: unknown;
  }): Promise<unknown>;
  chatCompletions(input: {
    principal: CaioAccessPrincipal;
    requestId: string;
    payload: unknown;
  }): Promise<unknown>;
  /**
   * Must respond only with the aliases granted to the presented token.
   */
  listModels(input: {
    workspaceId: string;
    userRef: string;
    clientType: string;
  }): Promise<unknown>;
}>;

export type CaioAuditGatePort = Readonly<{
  /** Claim the audit slot BEFORE any dispatch work; throwing fails the
   * request closed as 503 caio_audit_unavailable. */
  claimDispatch(input: {
    requestId: string;
    route: string;
    principal: CaioAccessPrincipal;
    now: Date;
  }): Promise<void>;
}>;

export type CaioReadinessState = "ready" | "degraded" | "unavailable";

export type CaioReadinessProbePort = Readonly<{
  state(): CaioReadinessState;
}>;

export type CaioGatewayHandlerDependencies = Readonly<{
  tokenAuthenticator: CaioTokenAuthenticatorPort;
  projectResolver: ProjectMembershipResolver;
  mcpDispatch: CaioMcpDispatchPort;
  modelProxy: CaioModelProxyPort;
  auditGate: CaioAuditGatePort;
  readinessProbe: CaioReadinessProbePort;
  maxBodyBytes?: number;
  rateLimitPerMinute?: number;
  now?: () => Date;
  requestIdFactory?: () => string;
}>;

export type CaioGatewayHandler = (
  request: CaioGatewayRequest,
) => Promise<CaioGatewayResponse>;

type AuthedRoute = Readonly<{
  kind: "mcp" | "model_responses" | "model_chat_completions" | "model_list";
  audience: CaioTokenAudience;
  expectsJsonBody: boolean;
}>;

const AUTHED_ROUTES: Readonly<
  Record<string, Readonly<Partial<Record<string, AuthedRoute>>>>
> = Object.freeze({
  "/mcp": Object.freeze({
    POST: Object.freeze({
      kind: "mcp" as const,
      audience: "mcp" as const,
      expectsJsonBody: true,
    }),
  }),
  "/v1/responses": Object.freeze({
    POST: Object.freeze({
      kind: "model_responses" as const,
      audience: "model" as const,
      expectsJsonBody: true,
    }),
  }),
  "/v1/chat/completions": Object.freeze({
    POST: Object.freeze({
      kind: "model_chat_completions" as const,
      audience: "model" as const,
      expectsJsonBody: true,
    }),
  }),
  "/v1/models": Object.freeze({
    GET: Object.freeze({
      kind: "model_list" as const,
      audience: "model" as const,
      expectsJsonBody: false,
    }),
  }),
});

const PROBE_METHODS: Readonly<Record<string, readonly string[]>> =
  Object.freeze({
    "/livez": Object.freeze(["GET"]),
    "/readyz": Object.freeze(["GET"]),
  });

const JSON_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  "content-type": "application/json; charset=utf-8",
});

function wireResponse(error: CaioGatewayWireError): CaioGatewayResponse {
  return Object.freeze({
    status: error.status,
    headers: Object.freeze({ ...JSON_HEADERS, ...error.headers }),
    body: error.body,
  });
}

function jsonResponse(status: number, body: unknown): CaioGatewayResponse {
  return Object.freeze({ status, headers: JSON_HEADERS, body });
}

function extractBearerToken(
  headers: Readonly<Record<string, string | undefined>>,
): string | null {
  const header = headers.authorization;
  if (typeof header !== "string") return null;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return match ? match[1] : null;
}

function bodyByteLength(body: string | Uint8Array | null | undefined): number {
  if (body === null || body === undefined) return 0;
  if (typeof body === "string") return Buffer.byteLength(body, "utf8");
  return body.byteLength;
}

function bodyText(body: string | Uint8Array | null | undefined): string {
  if (body === null || body === undefined) return "";
  if (typeof body === "string") return body;
  return Buffer.from(body).toString("utf8");
}

const SAFE_REQUEST_ID_PATTERN = /^[A-Za-z0-9_.:-]{1,128}$/;

export function createCaioGatewayHandler(
  dependencies: CaioGatewayHandlerDependencies,
): CaioGatewayHandler {
  const maxBodyBytes =
    dependencies.maxBodyBytes ?? CAIO_GATEWAY_DEFAULT_MAX_BODY_BYTES;
  const now = dependencies.now ?? (() => new Date());
  const requestIdFactory =
    dependencies.requestIdFactory ?? (() => randomUUID());

  function readinessResponse(): CaioGatewayResponse {
    const state = dependencies.readinessProbe.state();
    if (state === "unavailable") {
      return wireResponse(
        toGatewayError({
          status: 503,
          error: "caio_audit_unavailable",
          retryAfterSeconds: 5,
        }),
      );
    }
    return jsonResponse(200, Object.freeze({ status: state }));
  }

  async function dispatchAuthedRoute(input: {
    route: AuthedRoute;
    routePath: string;
    request: CaioGatewayRequest;
  }): Promise<CaioGatewayResponse> {
    const { route, routePath, request } = input;
    const headerRequestId = request.headers["x-request-id"];
    const requestId =
      headerRequestId !== undefined &&
      SAFE_REQUEST_ID_PATTERN.test(headerRequestId)
        ? headerRequestId
        : requestIdFactory();

    // 2. Bearer extract.
    const rawToken = extractBearerToken(request.headers);
    if (rawToken === null) {
      return wireResponse(
        toGatewayError({ status: 401, reason: "bearer_token_required" }),
      );
    }

    // 3. Authenticate (audience + source ip + rate limit taxonomy).
    const principal = await dependencies.tokenAuthenticator.authenticate({
      rawToken,
      expectedAudience: route.audience,
      sourceIp: request.clientIp,
      now: now(),
      rateLimitPerMinute: dependencies.rateLimitPerMinute,
    });

    // 4. Body size cap (after authentication, before any parsing).
    if (bodyByteLength(request.body) > maxBodyBytes) {
      return wireResponse(toGatewayError({ status: 413 }));
    }

    // 5. Parse the JSON body where the route requires one.
    let payload: unknown = null;
    if (route.expectsJsonBody) {
      const text = bodyText(request.body);
      if (text.trim().length === 0) {
        return wireResponse(
          toGatewayError({ status: 400, reason: "json_body_required" }),
        );
      }
      try {
        payload = JSON.parse(text);
      } catch {
        return wireResponse(
          toGatewayError({ status: 400, reason: "json_body_invalid" }),
        );
      }
    }

    const boundAssertProjectAccess = (projectRef: string) =>
      assertProjectAccess(
        dependencies.projectResolver,
        principal.workspaceId,
        principal.userRef,
        projectRef,
      );

    // 6. Live project membership gate for payloads that name a project.
    if (
      payload !== null &&
      typeof payload === "object" &&
      !Array.isArray(payload) &&
      typeof (payload as { projectRef?: unknown }).projectRef === "string"
    ) {
      await boundAssertProjectAccess(
        (payload as { projectRef: string }).projectRef,
      );
    }

    // 7. Audit gate: claim before any dispatch work (fail closed).
    try {
      await dependencies.auditGate.claimDispatch({
        requestId,
        route: routePath,
        principal,
        now: now(),
      });
    } catch (error) {
      if (isCaioAccessGatewayError(error)) throw error;
      throw new CaioAuditUnavailableSignal();
    }

    // 8. Dispatch.
    switch (route.kind) {
      case "mcp": {
        const result = await dependencies.mcpDispatch({
          principal,
          requestId,
          payload,
          assertProjectAccess: boundAssertProjectAccess,
        });
        return jsonResponse(200, result);
      }
      case "model_responses": {
        const result = await dependencies.modelProxy.responses({
          principal,
          requestId,
          payload,
        });
        return jsonResponse(200, result);
      }
      case "model_chat_completions": {
        const result = await dependencies.modelProxy.chatCompletions({
          principal,
          requestId,
          payload,
        });
        return jsonResponse(200, result);
      }
      case "model_list": {
        const result = await dependencies.modelProxy.listModels({
          workspaceId: principal.workspaceId,
          userRef: principal.userRef,
          clientType: principal.clientType,
        });
        return jsonResponse(200, result);
      }
    }
  }

  return async function handleCaioGatewayRequest(
    request: CaioGatewayRequest,
  ): Promise<CaioGatewayResponse> {
    // 1. Parse route (before anything else; unknown -> 404, method -> 405).
    const path = request.path.split("?")[0] ?? "";
    const method = request.method.toUpperCase();

    const probeMethods = PROBE_METHODS[path];
    if (probeMethods) {
      if (!probeMethods.includes(method)) {
        return wireResponse(
          toGatewayError({ status: 405, allow: probeMethods }),
        );
      }
      // /livez: process-alive only. It must never touch the database or
      // any business port, so it answers before any dependency is used.
      if (path === "/livez") {
        return jsonResponse(200, Object.freeze({ status: "alive" }));
      }
      return readinessResponse();
    }

    const routeMethods = AUTHED_ROUTES[path];
    if (!routeMethods) {
      return wireResponse(toGatewayError({ status: 404 }));
    }
    const route = routeMethods[method];
    if (!route) {
      return wireResponse(
        toGatewayError({
          status: 405,
          allow: Object.keys(routeMethods),
        }),
      );
    }

    try {
      return await dispatchAuthedRoute({ route, routePath: path, request });
    } catch (error) {
      if (error instanceof CaioAuditUnavailableSignal) {
        return wireResponse(
          toGatewayError({
            status: 503,
            error: "caio_audit_unavailable",
            retryAfterSeconds: 5,
          }),
        );
      }
      if (isCaioAccessGatewayError(error)) {
        return wireResponse(caioGatewayWireErrorFromError(error));
      }
      // Unknown upstream/internal failures collapse to an opaque 502;
      // upstream raw bodies and messages never reach the wire.
      return wireResponse(toGatewayError({ status: 502 }));
    }
  };
}

/** Internal marker: the audit gate failed without a typed gateway error. */
class CaioAuditUnavailableSignal extends Error {
  constructor() {
    super("audit_unavailable");
    this.name = "CaioAuditUnavailableSignal";
  }
}
