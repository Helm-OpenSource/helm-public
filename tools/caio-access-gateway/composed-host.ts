/**
 * 组合网关宿主：绑定套接字、终止 mTLS、按路径把请求分派给这台宿主上的各个 surface。
 *
 * 为什么在 Core。这套东西原先长在 helm-self 的 overlay 里（workbuddy-lan/https-gateway.ts），
 * 而绑定监听、双向 TLS、排空、并发上限、截止期都是**宿主**的属性，与哪个端点讲什么协议无关。
 * 留在某个租户的 overlay 里，第二个租户要用就只能复制——而各租户的包按子路径钉扎，
 * 彼此的文件根本不在对方的包里，复制是唯一出路。复制一份安全敏感代码，两份就会各自漂移。
 *
 * 所以它搬到这里，两边共用一份。**这一步是纯搬移**：符号、注释、行为逐字照旧，判据是
 * helm-self 的现有回归结果不变。WorkBuddy 端点仍然可选（`workBuddy: null` 时它的路径无人认领，
 * 因而 404），协议实现仍在 helm-self——宿主只认一个能 `handle` 的端点，不认 MCP。
 *
 * 命名保留原样（`WorkBuddyGatewayTransport*` 等）也是为了让这一步是纯搬移：改名是另一回事，
 * 混在搬移里会让「行为没变」这件事无法靠 diff 判断。
 */
import {
  createServer,
  type Server as HttpsServer,
} from "node:https";
import type {
  IncomingHttpHeaders,
  IncomingMessage,
  ServerResponse,
} from "node:http";
import type {
  TLSSocket,
} from "node:tls";

type HeaderValue = string | readonly string[] | undefined;

export type WorkBuddyGatewayTransportRequest = Readonly<{
  method: string;
  url: string;
  headers: Readonly<Record<string, HeaderValue>>;
  tlsAuthorized: boolean;
  certificateFingerprint: string | null;
  sourceAddress: string;
  body: AsyncIterable<Uint8Array | string>;
  abort?: () => void;
  signal?: AbortSignal;
  deferAuditUntilResponseCompletion?: boolean;
}>;

export type WorkBuddyGatewayTransportResponse = Readonly<{
  statusCode: number;
  headers: Readonly<Record<string, string>>;
  body: Readonly<Record<string, unknown>> | null;
  serializedBody: string | null;
  finalizeAudit?: (
    completion?: WorkBuddyGatewayAuditCompletion,
  ) => void;
}>;

type ResponseDeadlineTarget = {
  readonly destroyed: boolean;
  readonly writableFinished: boolean;
  destroy(): void;
  once(
    event: "finish" | "close",
    listener: () => void,
  ): unknown;
};

type ConnectionDeadlineTarget = {
  readonly destroyed: boolean;
  destroy(): void;
  once(event: "close", listener: () => void): unknown;
};

/**
 * One accepted TCP connection's deadline state.
 *
 * The request deadline starts at TCP ACCEPT, not at the end of the TLS
 * handshake and not when the request line arrives. Starting it later lets a
 * client stall the handshake, or dribble headers, and buy itself the whole
 * budget again afterwards — the effective ceiling becomes handshake timeout
 * plus request timeout rather than the one number the binding pins.
 */

type ConnectionDeadlineRecord = {
  readonly acceptedAtMs: number;
  deadlineExceeded: boolean;
  readonly listeners: Set<() => void>;
};

export type WorkBuddyGatewayAuditEvent = Readonly<{
  schemaVersion: "helm.overlay.helm-self.workbuddy-gateway-audit.v1";
  event: "request_completed";
  requestId: string;
  deviceRef: string | null;
  statusCode: number;
  errorCode: string | null;
  outcome:
    | "completed"
    | "cancelled"
    | "deadline"
    | "failed"
    | "rejected";
  durationMs: number;
  requestBytes: number;
  responseBytes: number;
}>;

type WorkBuddyGatewayAuditCompletion = Readonly<{
  statusCode: number;
  errorCode: string | null;
  outcome: WorkBuddyGatewayAuditEvent["outcome"];
  responseBytes: number;
}>;

/**
 * The answer to "may this composed-surface request run".
 *
 * A refusal is a value rather than a thrown error because the caller has to
 * turn it into a wire response, and the two reasons map to different statuses
 * and different retry advice.
 */

export type ComposedOperationOutcome<T> =
  | Readonly<{ admitted: true; value: T }>
  | Readonly<{ admitted: false; reason: "shutting-down" | "busy" }>;

export type WorkBuddyGatewayTransport = Readonly<{
  beginShutdown(): void;
  waitForIdle(timeoutMs: number): Promise<boolean>;
  /**
   * Run one composed-surface request under THE SAME accounting the WorkBuddy
   * endpoint uses.
   *
   * Both surfaces are served by one host on one socket, and shutdown is a
   * property of the host, not of one endpoint. A composed surface used to
   * receive a response deadline and nothing else, so its work was invisible to
   * every mechanism that makes shutdown safe: `waitForIdle` could report the
   * gateway idle while an Access Gateway request was still executing,
   * `beginShutdown` did not stop new ones being served, the surface was handed
   * no signal and so could not observe either, and the concurrency limit that
   * protects the host did not apply to it.
   *
   * The signal handed to `run` is aborted by shutdown and by the request
   * deadline, exactly as on the WorkBuddy path.
   */
  runComposedOperation<T>(
    run: (signal: AbortSignal) => Promise<T>,
  ): Promise<ComposedOperationOutcome<T>>;
  handleUnexpectedFailure(
    request: WorkBuddyGatewayTransportRequest,
  ): WorkBuddyGatewayTransportResponse;
  handle(
    request: WorkBuddyGatewayTransportRequest,
  ): Promise<WorkBuddyGatewayTransportResponse>;
}>;

/**
 * 宿主记账：接受/拒绝、并发上限、截止期、排空、不合作操作看门狗。
 *
 * 为什么单独成一份：这套东西是**宿主**的属性，不是 WorkBuddy 端点的。以前它长在 WorkBuddy
 * transport 里，于是「只服务 composed surface 的宿主」也得造一个它永远不用的 MCP 协议处理器与
 * 身份解析器——把协议当成了运行时的入场券。切开之后，协议归协议，记账归宿主。
 *
 * 切开是**行为保持**的：WorkBuddy 协议路径原先在流程里内联做准入，这里把那几个动作原样暴露成
 * 具名原语（isAccepting / atConcurrencyLimit / enterRequest / leaveRequest / trackOperation /
 * watchCancelledOperation），调用点与时序一个不动。两条路径共用同一组计数器，这正是
 * `waitForIdle` 不会在任一条路径执行中报 idle 的原因。
 */

export type GatewayHostAccounting = Readonly<{
  isAccepting(): boolean;
  atConcurrencyLimit(): boolean;
  beginShutdown(): void;
  waitForIdle(timeoutMs: number): Promise<boolean>;
  /** 协议路径的内联准入：进入与离开成对，离开发生在操作的 finally 里。 */
  enterRequest(controller: AbortController): void;
  leaveRequest(controller: AbortController, operation: Promise<unknown>): void;
  trackOperation(operation: Promise<unknown>): void;
  /** 已取消但可能不肯退出的操作：到点仍在跑就开始停机，两条路径都用。 */
  watchCancelledOperation(operation: Promise<unknown>): void;
  runComposedOperation<T>(
    run: (signal: AbortSignal) => Promise<T>,
  ): Promise<ComposedOperationOutcome<T>>;
}>;

export function createGatewayHostAccounting(input: {
  maxConcurrentRequests: number;
  requestTimeoutMs: number;
  uncooperativeOperationTimeoutMs?: number;
  onUncooperativeOperation?: (error: Error) => void;
}): GatewayHostAccounting {
  const activeControllers = new Set<AbortController>();
  const activeOperations = new Set<Promise<unknown>>();
  const watchedOperations = new WeakSet<Promise<unknown>>();
  const uncooperativeOperationTimeoutMs =
    input.uncooperativeOperationTimeoutMs ?? input.requestTimeoutMs;
  if (
    !Number.isFinite(uncooperativeOperationTimeoutMs) ||
    uncooperativeOperationTimeoutMs < 1
  ) {
    throw new Error("uncooperative_operation_timeout_invalid");
  }
  let acceptingRequests = true;
  let activeRequests = 0;
  let uncooperativeOperationReported = false;

  const beginShutdown = (): void => {
    if (!acceptingRequests) return;
    acceptingRequests = false;
    for (const controller of activeControllers) {
      if (!controller.signal.aborted) {
        controller.abort(new GatewayShuttingDownError());
      }
    }
  };

  const watchCancelledOperation = (
    operation: Promise<unknown>,
  ): void => {
    if (
      watchedOperations.has(operation) ||
      !activeOperations.has(operation)
    ) {
      return;
    }
    watchedOperations.add(operation);
    const timer = setTimeout(() => {
      if (
        !activeOperations.has(operation) ||
        uncooperativeOperationReported
      ) {
        return;
      }
      uncooperativeOperationReported = true;
      beginShutdown();
      try {
        input.onUncooperativeOperation?.(
          new Error("workbuddy_gateway_operation_uncooperative"),
        );
      } catch {
        // A failure reporter cannot restore gateway authority.
      }
    }, uncooperativeOperationTimeoutMs);
    void operation.finally(() => clearTimeout(timer)).catch(() => {});
  };

  /**
   * The composed-surface path into the same accounting as the WorkBuddy one.
   *
   * Deliberately admits BEFORE running and releases in `finally`, so a surface
   * that throws returns its slot: a leaked slot turns one failing request into
   * a permanently busy gateway, which is worse than the failure itself.
   */
  const runComposedOperation = async <T,>(
    run: (signal: AbortSignal) => Promise<T>,
  ): Promise<ComposedOperationOutcome<T>> => {
    if (!acceptingRequests) {
      return Object.freeze({ admitted: false as const, reason: "shutting-down" as const });
    }
    if (activeRequests >= input.maxConcurrentRequests) {
      return Object.freeze({ admitted: false as const, reason: "busy" as const });
    }

    const controller = new AbortController();
    // Same policy as the WorkBuddy path: referenced for the lifetime of the
    // request so an unreferenced timer cannot let the process drop its last
    // handle while the request is pending, and cleared on every settle path so
    // an idle gateway holds no timer.
    let deadlineTimer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      deadlineTimer = null;
      controller.abort(new RequestDeadlineExceededError());
    }, input.requestTimeoutMs);

    activeRequests += 1;
    activeControllers.add(controller);
    const operation = (async () => run(controller.signal))();
    activeOperations.add(operation);
    watchCancelledOperation(operation);
    try {
      const value = await operation;
      return Object.freeze({ admitted: true as const, value });
    } finally {
      if (deadlineTimer) {
        clearTimeout(deadlineTimer);
        deadlineTimer = null;
      }
      activeRequests -= 1;
      activeControllers.delete(controller);
      activeOperations.delete(operation);
    }
  };

  return Object.freeze({
    isAccepting: () => acceptingRequests,
    atConcurrencyLimit: () => activeRequests >= input.maxConcurrentRequests,
    beginShutdown,
    async waitForIdle(timeoutMs: number): Promise<boolean> {
      return waitForOperationsToSettle(activeOperations, timeoutMs);
    },
    enterRequest(controller: AbortController): void {
      activeRequests += 1;
      activeControllers.add(controller);
    },
    leaveRequest(controller: AbortController, operation: Promise<unknown>): void {
      activeRequests -= 1;
      activeControllers.delete(controller);
      activeOperations.delete(operation);
    },
    trackOperation(operation: Promise<unknown>): void {
      activeOperations.add(operation);
    },
    watchCancelledOperation,
    runComposedOperation,
  });
}

export type ComposedGatewaySurface = Readonly<{
  /** Identifies the surface in routing errors. Never sent to a client. */
  key: string;
  /** The exact paths this surface owns. Matched whole, never by prefix. */
  paths: readonly string[];
  /**
   * Serve one request.
   *
   * `options.signal` is the HOST's cancellation for this request: it aborts on
   * shutdown and on the request deadline, from the same accounting that covers
   * the WorkBuddy endpoint. It is passed rather than optional-by-omission
   * because a surface that cannot observe shutdown cannot be drained, and the
   * host would then be waiting on work it has no way to stop.
   *
   * A surface may ignore it — TypeScript lets an implementation declare fewer
   * parameters — but it can no longer be UNABLE to see it, and the composed
   * end-to-end test asserts the host actually supplies one.
   */
  serve(
    request: IncomingMessage,
    response: ServerResponse,
    options: Readonly<{ signal: AbortSignal }>,
  ): Promise<void>;
}>;

export type ComposedGatewayRouteOwner =
  | "workbuddy"
  | ComposedGatewaySurface;

export type ComposedGatewayRouter = Readonly<{
  /** The owning surface, or null for a path no surface declares. */
  owner(url: string): ComposedGatewayRouteOwner | null;
  /** Every routed path, for evidence and tests. */
  paths: readonly string[];
}>;

/**
 * The one route table for the composed listener.
 *
 * Exact path matching only. A prefix rule would let `/mcp/workbuddy/anything`
 * reach the MCP endpoint and `/livez/../x` reach a probe, so a path that is
 * not declared character for character belongs to nobody and is refused. Two
 * surfaces claiming one path is a construction error, not a precedence
 * question: whichever answered would be answering for the other.
 */

export function createComposedGatewayRouter(input: {
  /**
   * WorkBuddy 端点的路径；`null` 表示这个宿主不服务 WorkBuddy 端点。
   *
   * 可选，而不是「传空串」：空串会被 claim 当成非法路径抛错，而「不服务」是一个正当的部署形态
   * （只挂 composed surface 的宿主）。写成 null 让这件事在类型上就说得出来。
   */
  workBuddyPath: string | null;
  surfaces: readonly ComposedGatewaySurface[];
}): ComposedGatewayRouter {
  const table = new Map<string, ComposedGatewayRouteOwner>();
  const claim = (
    path: string,
    owner: ComposedGatewayRouteOwner,
    key: string,
  ): void => {
    if (typeof path !== "string" || !path.startsWith("/")) {
      throw new Error(
        `composed_gateway_route_invalid:${key}:${String(path)}`,
      );
    }
    if (table.has(path)) {
      throw new Error(`composed_gateway_route_conflict:${key}:${path}`);
    }
    table.set(path, owner);
  };
  if (input.workBuddyPath !== null) {
    claim(input.workBuddyPath, "workbuddy", "workbuddy_lan_gateway");
  }
  for (const surface of input.surfaces) {
    for (const path of surface.paths) {
      claim(path, surface, surface.key);
    }
  }
  return Object.freeze({
    owner(url: string): ComposedGatewayRouteOwner | null {
      return table.get(requestPath(url)) ?? null;
    },
    paths: Object.freeze([...table.keys()]),
  });
}

/** The path a request names, without its query or fragment. */

function requestPath(url: string): string {
  const boundary = url.search(/[?#]/u);
  return boundary === -1 ? url : url.slice(0, boundary);
}

/**
 * Whether the CAIO Access Gateway surface is served by this process.
 *
 * This is a REQUIRED, explicit declaration rather than an optional input. The
 * Access Gateway used to be composed in Core and simply never started, and an
 * omission is exactly what that looked like from the host: nothing in the
 * process said the routes were missing. A caller must now either hand over the
 * surface or say, on the record, why it is not mounted.
 */

export type ComposedAccessGatewayDeclaration =
  | Readonly<{ mounted: true; surface: ComposedGatewaySurface }>
  | Readonly<{ mounted: false; reason: string }>;

/** The surfaces this host serves besides the WorkBuddy MCP endpoint. */

export function resolveComposedGatewaySurfaces(
  declaration: ComposedAccessGatewayDeclaration,
): readonly ComposedGatewaySurface[] {
  if (declaration.mounted) {
    return Object.freeze([declaration.surface]);
  }
  if (declaration.reason.trim().length === 0) {
    throw new Error("access_gateway_declaration_reason_required");
  }
  return Object.freeze([]);
}

export type ExclusiveListenServer = {
  listen(
    options: Readonly<{
      host: string;
      port: number;
      exclusive: boolean;
    }>,
  ): unknown;
  once(event: "error", listener: (error: Error) => void): unknown;
  once(event: "listening", listener: () => void): unknown;
  off(event: "error", listener: (error: Error) => void): unknown;
  off(event: "listening", listener: () => void): unknown;
};

/**
 * Bind THE socket, exclusively.
 *
 * `exclusive` so a second binder fails loudly (EADDRINUSE) instead of silently
 * sharing this process's socket. One approved private address and port is
 * bound, and one host answers on it for every surface.
 */

export async function listenExclusively(
  server: ExclusiveListenServer,
  target: Readonly<{ host: string; port: number }>,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => {
      server.off("listening", onListening);
      reject(error);
    };
    const onListening = () => {
      server.off("error", onError);
      resolve();
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen({
      host: target.host,
      port: target.port,
      exclusive: true,
    });
  });
}

/**
 * 宿主要的那部分配置——套接字与时限，与任何一个端点的协议无关。
 * helm-self 的 WorkBuddy 网关配置结构上满足它，所以那条路照旧直接传。
 */

export type ComposedGatewayHostConfig = Readonly<{
  tls: Readonly<{
    certificate: string | Buffer;
    privateKey: string | Buffer;
    clientCa: string | Buffer;
  }>;
  tlsHandshakeTimeoutMs: number;
  requestTimeoutMs: number;
  maxConcurrentRequests: number;
}>;

/**
 * 绑定套接字、终止 mTLS、按路径分派给各 surface 的宿主。
 *
 * WorkBuddy 端点是**可选**的：`workBuddy: null` 时这个宿主只服务 composed surface，
 * WorkBuddy 路径不被任何人认领，因而 404。以前它是必需的，于是只想挂访问网关的部署也得造一个
 * 永远不用的 MCP 协议处理器——协议成了运行时的入场券，这正是这次切开要去掉的东西。
 *
 * 排空与并发仍然是宿主的：composed surface 的请求照样经 `accounting.runComposedOperation`
 * 记账，所以 `waitForIdle` 不会在它执行中报 idle。
 */

export function createComposedGatewayHostServer(input: {
  config: ComposedGatewayHostConfig;
  accounting: Pick<GatewayHostAccounting, "runComposedOperation">;
  surfaces: readonly ComposedGatewaySurface[];
  workBuddy: Readonly<{
    path: string;
    transport: WorkBuddyGatewayTransport;
  }> | null;
}): HttpsServer {
  const router = createComposedGatewayRouter({
    workBuddyPath: input.workBuddy?.path ?? null,
    surfaces: input.surfaces,
  });
  // Keyed by the RAW accepted socket, which is the only object that exists at
  // TCP accept time. The TLS socket appears later, so the request handler
  // reaches this record through the TLS socket's parent link.
  const connectionDeadlines =
    new WeakMap<object, ConnectionDeadlineRecord>();
  const server = createServer(
    {
      cert: input.config.tls.certificate,
      key: input.config.tls.privateKey,
      ca: input.config.tls.clientCa,
      requestCert: true,
      rejectUnauthorized: true,
      minVersion: "TLSv1.3",
      honorCipherOrder: true,
      handshakeTimeout: input.config.tlsHandshakeTimeoutMs,
    },
    async (request, response) => {
      const connectionAbortController = new AbortController();
      const connectionDeadline = resolveConnectionDeadlineRecord(
        connectionDeadlines,
        request.socket,
      );
      // ROUTING FIRST, on the exact path. Every surface on this socket gets
      // the same deadline policy; a path no surface declares is refused here
      // and never falls through to one that would have answered for it.
      const routeOwner = router.owner(request.url ?? "");
      if (routeOwner !== "workbuddy") {
        armWorkBuddyResponseDeadline(
          response,
          remainingDeadlineMs(
            connectionDeadline,
            input.config.requestTimeoutMs,
          ),
        );
        if (routeOwner === null) {
          writeComposedResponse(
            response,
            errorResponse(
              404,
              "ENDPOINT_NOT_FOUND",
              "The MCP endpoint was not found.",
            ),
          );
          return;
        }
        // THROUGH THE HOST'S ACCOUNTING, not beside it. Shutdown belongs to
        // the host, so a composed surface is admitted, counted, abortable and
        // waited for on exactly the same terms as the WorkBuddy endpoint.
        // Serving it directly here meant stop() could drain to "idle" while
        // this request was still running, and that a request arriving after
        // shutdown began was still served.
        try {
          const outcome = await input.accounting.runComposedOperation((signal) =>
            routeOwner.serve(request, response, { signal }),
          );
          if (!outcome.admitted) {
            writeComposedResponse(
              response,
              outcome.reason === "shutting-down"
                ? errorResponse(
                    503,
                    "GATEWAY_SHUTTING_DOWN",
                    "The gateway is shutting down.",
                    { "retry-after": "1" },
                  )
                : errorResponse(
                    503,
                    "GATEWAY_BUSY",
                    "The gateway concurrency limit was reached.",
                    { "retry-after": "1" },
                  ),
            );
          }
        } catch {
          // A surface failing cannot leak its reason onto the wire, and
          // cannot leave the client waiting on the deadline.
          writeComposedResponse(
            response,
            errorResponse(
              500,
              "GATEWAY_FAILED",
              "The gateway failed safely.",
            ),
          );
        }
        return;
      }
      const onConnectionDeadline = () =>
        connectionAbortController.abort(
          new RequestDeadlineExceededError(),
        );
      let result: WorkBuddyGatewayTransportResponse | null = null;
      let physicalTerminal: "closed" | "finished" | null = null;
      let responseFinished = false;
      let cleanedUp = false;
      const cleanupPhysicalState = () => {
        if (cleanedUp) return;
        cleanedUp = true;
        connectionDeadline?.listeners.delete(onConnectionDeadline);
        request.off("aborted", abortForConnectionClose);
        request.socket.off("close", onSocketClose);
        response.off("finish", onResponseFinish);
        response.off("close", onResponseClose);
      };
      const finalizePhysicalAudit = () => {
        if (!result || !physicalTerminal) return;
        if (physicalTerminal === "finished") {
          result.finalizeAudit?.();
        } else {
          result.finalizeAudit?.(
            physicalFailureAuditCompletion(
              result,
              connectionAbortController.signal,
            ),
          );
        }
        cleanupPhysicalState();
      };
      const onResponseFinish = () => {
        responseFinished = true;
      };
      const onResponseClose = () => {
        responseFinished ||= response.writableFinished;
        if (request.socket.destroyed) {
          onSocketClose();
        }
      };
      const onSocketClose = () => {
        if (
          connectionAbortController.signal.reason instanceof
          RequestDeadlineExceededError
        ) {
          physicalTerminal = "closed";
        } else if (
          responseFinished ||
          response.writableFinished
        ) {
          physicalTerminal = "finished";
        } else {
          connectionAbortController.abort(
            new ClientConnectionClosedError(),
          );
          physicalTerminal = "closed";
        }
        finalizePhysicalAudit();
      };
      const abortForConnectionClose = () =>
        connectionAbortController.abort(
          new ClientConnectionClosedError(),
        );
      request.once("aborted", abortForConnectionClose);
      request.socket.once("close", onSocketClose);
      response.once("finish", onResponseFinish);
      response.once("close", onResponseClose);
      // Adopt the connection's accept-relative deadline. If it already expired
      // while this request was being parsed, fail it closed immediately rather
      // than granting it a fresh budget.
      if (connectionDeadline) {
        if (connectionDeadline.deadlineExceeded) {
          onConnectionDeadline();
        } else {
          connectionDeadline.listeners.add(onConnectionDeadline);
        }
      }
      armWorkBuddyResponseDeadline(
        response,
        remainingDeadlineMs(
          connectionDeadline,
          input.config.requestTimeoutMs,
        ),
        () =>
          connectionAbortController.abort(
            new RequestDeadlineExceededError(),
          ),
      );
      const socket = request.socket as TLSSocket;
      const peer = socket.getPeerCertificate();
      const transportRequest = Object.freeze({
        method: request.method ?? "",
        url: request.url ?? "",
        headers: normalizeHeaders(request.headers),
        tlsAuthorized: socket.authorized === true,
        certificateFingerprint: normalizeFingerprint(
          peer.fingerprint256,
        ),
        sourceAddress: socket.remoteAddress ?? "",
        body: request,
        abort: () => request.destroy(),
        signal: connectionAbortController.signal,
        deferAuditUntilResponseCompletion: true,
      });
      try {
        result = await requireWorkBuddy(input.workBuddy).handle(transportRequest);
      } catch {
        result = requireWorkBuddy(input.workBuddy).handleUnexpectedFailure(
          transportRequest,
        );
      }
      if (response.destroyed) {
        physicalTerminal = "closed";
        finalizePhysicalAudit();
        return;
      }
      if (response.writableEnded) {
        finalizePhysicalAudit();
        return;
      }
      response.statusCode = result.statusCode;
      for (const [name, value] of Object.entries(result.headers)) {
        response.setHeader(name, value);
      }
      if (result.body === null) {
        response.end();
        return;
      }
      response.end(result.serializedBody);
    },
  );
  server.requestTimeout = input.config.requestTimeoutMs;
  server.headersTimeout = Math.min(
    10_000,
    input.config.requestTimeoutMs,
  );
  server.keepAliveTimeout = 5_000;
  server.maxConnections =
    input.config.maxConcurrentRequests * 2;
  server.maxRequestsPerSocket = 1;
  // ACCEPT, not "secureConnection". `connection` fires the moment the kernel
  // hands us the socket, before any TLS byte is exchanged, so the whole
  // TCP -> TLS -> request lifetime is bounded by the one configured timeout.
  server.on("connection", (connection) => {
    const record: ConnectionDeadlineRecord = {
      acceptedAtMs: monotonicNowMs(),
      deadlineExceeded: false,
      listeners: new Set<() => void>(),
    };
    connectionDeadlines.set(connection, record);
    armWorkBuddyConnectionDeadline(
      connection,
      input.config.requestTimeoutMs,
      () => {
        record.deadlineExceeded = true;
        for (const listener of [...record.listeners]) {
          try {
            listener();
          } catch {
            // One listener failing cannot stop the socket teardown below.
          }
        }
      },
    );
  });
  server.on("clientError", (_error, socket) => socket.destroy());
  server.on("tlsClientError", (_error, socket) =>
    socket.destroy(),
  );
  return server;
}

/**
 * Write a host-level answer, unless the surface or the deadline already
 * finished the response. Never throws: the caller is a request handler whose
 * failure would otherwise become an unhandled rejection.
 */

function writeComposedResponse(
  response: ServerResponse,
  result: WorkBuddyGatewayTransportResponse,
): void {
  if (response.destroyed || response.writableEnded) return;
  try {
    response.statusCode = result.statusCode;
    for (const [name, value] of Object.entries(result.headers)) {
      response.setHeader(name, value);
    }
    response.end(result.serializedBody ?? undefined);
  } catch {
    response.destroy();
  }
}

function monotonicNowMs(): number {
  const value = performance.now();
  return Number.isFinite(value) ? value : 0;
}

/**
 * Finds the accept-time record for the socket the HTTP layer handed us.
 *
 * `request.socket` is the TLSSocket; the record was created for the raw socket
 * it wraps, which Node exposes as `_parent`. The hard deadline does NOT depend
 * on this lookup — it is armed on the raw socket and destroys it either way.
 * This link only lets an in-flight request be failed as `deadline` (504)
 * instead of `client connection closed` (499), so if the link ever
 * disappeared the enforcement would stay and only the label would coarsen.
 * The end-to-end TCP -> TLS -> request test asserts the 504, so a change here
 * shows up as a red test rather than a silent gap.
 */

function resolveConnectionDeadlineRecord(
  records: WeakMap<object, ConnectionDeadlineRecord>,
  socket: object,
): ConnectionDeadlineRecord | null {
  const parent = (socket as { _parent?: unknown })._parent;
  if (parent && typeof parent === "object") {
    const viaParent = records.get(parent);
    if (viaParent) return viaParent;
  }
  return records.get(socket) ?? null;
}

/**
 * What is left of the accept-relative budget. Never returns 0 or less: a
 * timer armed with a non-positive delay would fire on the next tick and is
 * indistinguishable from "already expired", which the caller handles
 * explicitly before arming.
 */

function remainingDeadlineMs(
  record: ConnectionDeadlineRecord | null,
  timeoutMs: number,
): number {
  if (!record) return timeoutMs;
  const elapsed = Math.max(0, monotonicNowMs() - record.acceptedAtMs);
  return Math.max(1, timeoutMs - elapsed);
}

export function armWorkBuddyConnectionDeadline(
  connection: ConnectionDeadlineTarget,
  timeoutMs: number,
  onDeadline?: () => void,
): void {
  const connectionDeadline = setTimeout(() => {
    if (!connection.destroyed) {
      onDeadline?.();
      connection.destroy();
    }
  }, timeoutMs);
  connectionDeadline.unref();
  connection.once("close", () =>
    clearTimeout(connectionDeadline),
  );
}

export function armWorkBuddyResponseDeadline(
  response: ResponseDeadlineTarget,
  timeoutMs: number,
  onDeadline?: () => void,
): void {
  const responseDeadline = setTimeout(() => {
    if (!response.destroyed && !response.writableFinished) {
      onDeadline?.();
      response.destroy();
    }
  }, timeoutMs);
  responseDeadline.unref();
  const clearResponseDeadline = () =>
    clearTimeout(responseDeadline);
  response.once("finish", clearResponseDeadline);
  response.once("close", clearResponseDeadline);
}

export async function closeWorkBuddyHttpsGatewayServer(input: {
  server: Pick<
    HttpsServer,
    | "close"
    | "closeAllConnections"
    | "closeIdleConnections"
  >;
  timeoutMs: number;
}): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const settle = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) {
        reject(error);
        return;
      }
      resolve();
    };
    const timer = setTimeout(() => {
      input.server.closeAllConnections();
      settle();
    }, input.timeoutMs);
    input.server.close((error) => settle(error ?? undefined));
    input.server.closeIdleConnections();
  });
}

function normalizeHeaders(
  headers: IncomingHttpHeaders,
): Readonly<Record<string, HeaderValue>> {
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [
      key.toLowerCase(),
      value,
    ]),
  );
}

function normalizeFingerprint(
  value: string | undefined,
): string | null {
  if (!value) return null;
  const normalized = value.replaceAll(":", "").toLowerCase();
  return /^[a-f0-9]{64}$/.test(normalized)
    ? `sha256:${normalized}`
    : null;
}

export function commonHeaders(): Readonly<Record<string, string>> {
  return Object.freeze({
    "cache-control": "no-store",
    pragma: "no-cache",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    connection: "close",
  });
}

export class RequestDeadlineExceededError extends Error {
  constructor() {
    super("request_deadline_exceeded");
    this.name = "RequestDeadlineExceededError";
  }
}

export class ClientConnectionClosedError extends Error {
  constructor() {
    super("client_connection_closed");
    this.name = "ClientConnectionClosedError";
  }
}

export class GatewayShuttingDownError extends Error {
  constructor() {
    super("gateway_shutting_down");
    this.name = "GatewayShuttingDownError";
  }
}

export function createResponse(
  statusCode: number,
  headers: Readonly<Record<string, string>>,
  body: Readonly<Record<string, unknown>> | null,
  serializedBody?: string,
): WorkBuddyGatewayTransportResponse {
  const serialized =
    body === null ? null : (serializedBody ?? JSON.stringify(body));
  if (body !== null && typeof serialized !== "string") {
    throw new Error("response_serialization_failed");
  }
  return Object.freeze({
    statusCode,
    headers,
    body,
    serializedBody: serialized,
  });
}

function readResponseErrorCode(
  response: WorkBuddyGatewayTransportResponse,
): string | null {
  const rpcError = response.body?.error;
  if (
    rpcError &&
    typeof rpcError === "object" &&
    !Array.isArray(rpcError)
  ) {
    const data = (rpcError as { data?: unknown }).data;
    if (data && typeof data === "object" && !Array.isArray(data)) {
      const errorCode = (data as { errorCode?: unknown }).errorCode;
      if (typeof errorCode === "string") return errorCode;
    }
  }
  const result = response.body?.result;
  if (
    !result ||
    typeof result !== "object" ||
    Array.isArray(result) ||
    (result as { isError?: unknown }).isError !== true
  ) {
    return null;
  }
  const structuredContent = (
    result as { structuredContent?: unknown }
  ).structuredContent;
  if (
    !structuredContent ||
    typeof structuredContent !== "object" ||
    Array.isArray(structuredContent)
  ) {
    return null;
  }
  const toolError = (
    structuredContent as { error?: unknown }
  ).error;
  if (
    !toolError ||
    typeof toolError !== "object" ||
    Array.isArray(toolError)
  ) {
    return null;
  }
  const errorCode = (toolError as { code?: unknown }).code;
  return typeof errorCode === "string" ? errorCode : null;
}

export function auditCompletion(
  response: WorkBuddyGatewayTransportResponse,
): WorkBuddyGatewayAuditCompletion {
  return Object.freeze({
    statusCode: response.statusCode,
    errorCode: readResponseErrorCode(response),
    outcome: responseOutcome(response),
    responseBytes:
      response.serializedBody === null
        ? 0
        : Buffer.byteLength(response.serializedBody),
  });
}

function physicalFailureAuditCompletion(
  response: WorkBuddyGatewayTransportResponse,
  signal: AbortSignal,
): WorkBuddyGatewayAuditCompletion {
  const base = auditCompletion(response);
  if (
    base.errorCode === "REQUEST_DEADLINE_EXCEEDED" ||
    base.errorCode === "GATEWAY_SHUTTING_DOWN"
  ) {
    return Object.freeze({
      ...base,
      responseBytes: 0,
    });
  }
  if (
    signal.reason instanceof RequestDeadlineExceededError ||
    (
      signal.reason &&
      typeof signal.reason === "object" &&
      "name" in signal.reason &&
      signal.reason.name === "TimeoutError"
    )
  ) {
    return Object.freeze({
      statusCode: 504,
      errorCode: "REQUEST_DEADLINE_EXCEEDED",
      outcome: "deadline",
      responseBytes: 0,
    });
  }
  return Object.freeze({
    statusCode: 499,
    errorCode: "CLIENT_CONNECTION_CLOSED",
    outcome: "cancelled",
    responseBytes: 0,
  });
}

function responseOutcome(
  response: WorkBuddyGatewayTransportResponse,
): WorkBuddyGatewayAuditEvent["outcome"] {
  if (response.statusCode === 499) return "cancelled";
  if (response.statusCode === 504) return "deadline";
  if (response.statusCode >= 500) return "failed";
  if (response.statusCode >= 400) return "rejected";
  const result = response.body?.result;
  if (
    result &&
    typeof result === "object" &&
    !Array.isArray(result) &&
    (result as { isError?: unknown }).isError === true
  ) {
    return "rejected";
  }
  return "completed";
}

async function waitForOperationsToSettle(
  operations: ReadonlySet<Promise<unknown>>,
  timeoutMs: number,
): Promise<boolean> {
  if (operations.size === 0) return true;
  if (!Number.isFinite(timeoutMs) || timeoutMs < 0) return false;
  const pending = Promise.allSettled([...operations]).then(
    () => true,
  );
  if (timeoutMs === 0) return false;
  let timer: NodeJS.Timeout | undefined;
  const elapsed = new Promise<false>((resolve) => {
    timer = setTimeout(() => resolve(false), timeoutMs);
  });
  const result = await Promise.race([pending, elapsed]);
  if (timer) clearTimeout(timer);
  return result;
}

export function errorResponse(
  statusCode: number,
  errorCode: string,
  message: string,
  additionalHeaders: Readonly<Record<string, string>> = {},
): WorkBuddyGatewayTransportResponse {
  return createResponse(
    statusCode,
    Object.freeze({
      ...commonHeaders(),
      "content-type": "application/json",
      ...additionalHeaders,
    }),
    Object.freeze({
      jsonrpc: "2.0",
      id: null,
      error: Object.freeze({
        code: -32000,
        message,
        data: Object.freeze({ errorCode }),
      }),
    }),
  );
}


/**
 * 路由到 WorkBuddy 却没有 WorkBuddy——只可能是路由表与宿主配置不一致。
 * 大声失败而不是给一个看似合理的 404：后者会把配置错误伪装成「客户端请求了不存在的路径」。
 */

function requireWorkBuddy(
  workBuddy: Readonly<{ path: string; transport: WorkBuddyGatewayTransport }> | null,
): WorkBuddyGatewayTransport {
  if (workBuddy === null) {
    throw new Error("composed_gateway_workbuddy_route_without_endpoint");
  }
  return workBuddy.transport;
}

/**
 * WorkBuddy 宿主：本模块原有的入口，现在是通用宿主的薄包装。
 *
 * 签名与行为都不变——传了 transport 就既是 WorkBuddy 端点的实现，也是这台宿主的记账，
 * 与切开之前逐字一致。
 */
