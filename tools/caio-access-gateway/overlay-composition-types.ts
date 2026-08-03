//
// The shape this repository depends on from the Overlay composition.
//
// Declared here, in Public, rather than imported from the Overlay checkout,
// because the checkout is loaded at RUNTIME by the contract test and a dynamic
// import from a path that only exists in CI cannot be typechecked. This file is
// therefore a statement of what Public expects the host to provide — and the
// contract test is what proves the host actually provides it, at an exact
// pinned commit.
//
// It is deliberately narrow: only the three exports the contract exercises.
// Widening it would make it a mirror of the Overlay module, which would drift.
//

import type { IncomingMessage, ServerResponse } from "node:http";

export type ComposedGatewaySurface = Readonly<{
  key: string;
  paths: readonly string[];
  serve(
    request: IncomingMessage,
    response: ServerResponse,
    options: Readonly<{ signal: AbortSignal }>,
  ): Promise<void>;
}>;

export type ComposedAccessGatewayDeclaration =
  | Readonly<{ mounted: true; surface: ComposedGatewaySurface }>
  | Readonly<{ mounted: false; reason: string }>;

export type ComposedGatewayRouteOwner = "workbuddy" | ComposedGatewaySurface;

export type ComposedOperationOutcome<T> =
  | Readonly<{ admitted: true; value: T }>
  | Readonly<{ admitted: false; reason: "shutting-down" | "busy" }>;

export declare function resolveComposedGatewaySurfaces(
  declaration: ComposedAccessGatewayDeclaration,
): readonly ComposedGatewaySurface[];

export declare function createComposedGatewayRouter(input: {
  workBuddyPath: string;
  surfaces: readonly ComposedGatewaySurface[];
}): Readonly<{
  owner(url: string): ComposedGatewayRouteOwner | null;
  paths: readonly string[];
}>;

export declare function createWorkBuddyGatewayTransport(input: {
  config: Readonly<{
    endpointPath: string;
    maxRequestBytes: number;
    maxResponseBytes: number;
    requestTimeoutMs: number;
    maxConcurrentRequests: number;
    rateLimitPerMinute: number;
    auditHmacKey: Buffer;
  }>;
  identityResolver: Readonly<{ resolve: () => Promise<unknown> }>;
  handleMessage: (input: unknown) => Promise<{
    httpStatus: number;
    body: Readonly<Record<string, unknown>> | null;
  }>;
  randomRequestId: () => string;
  audit?: (event: unknown) => void;
}): Readonly<{
  beginShutdown(): void;
  waitForIdle(timeoutMs: number): Promise<boolean>;
  runComposedOperation<T>(
    run: (signal: AbortSignal) => Promise<T>,
  ): Promise<ComposedOperationOutcome<T>>;
}>;
