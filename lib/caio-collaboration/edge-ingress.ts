import { randomUUID, timingSafeEqual } from "node:crypto";

import { z } from "zod";

import {
  workBuddyInstantSchema,
  workBuddySafeRefSchema,
  type WorkBuddyClientIdentity,
} from "./contracts";
import {
  handleWorkBuddyMcpMessage,
} from "./mcp-protocol";
import type {
  WorkBuddyMcpToolDispatcher,
} from "./mcp-tool-dispatcher";

export const WORKBUDDY_EDGE_INGRESS_SCHEMA =
  "helm.workbuddy-edge-ingress/v1" as const;

const readScopeSchema = z.enum([
  "caio:delivery:read",
  "caio:p1c:read",
]);

const edgeIdentitySchema = z
  .object({
    clientId: workBuddySafeRefSchema,
    actorUserId: workBuddySafeRefSchema,
    certificateFingerprint: z
      .string()
      .regex(/^sha256:[a-f0-9]{64}$/),
    scopes: z.array(readScopeSchema).length(2),
    authenticatedAt: workBuddyInstantSchema,
  })
  .strict()
  .superRefine((identity, context) => {
    const scopes = new Set(identity.scopes);
    if (
      scopes.size !== 2 ||
      !scopes.has("caio:delivery:read") ||
      !scopes.has("caio:p1c:read")
    ) {
      context.addIssue({
        code: "custom",
        message: "exact read scopes required",
      });
    }
  });

const edgeIngressEnvelopeSchema = z
  .object({
    schemaVersion: z.literal(WORKBUDDY_EDGE_INGRESS_SCHEMA),
    workspaceSystemKey: z
      .string()
      .min(1)
      .max(100)
      .regex(/^[a-z][a-z0-9_-]*$/),
    identity: edgeIdentitySchema,
    message: z.unknown(),
  })
  .strict();

export type WorkBuddyEdgeIngressEnvelope = z.infer<
  typeof edgeIngressEnvelopeSchema
>;

type EdgeIngressResponse = Readonly<{
  status: number;
  body: unknown;
}>;

export type WorkBuddyWorkspaceIdResolver = (
  systemKey: string,
) => Promise<string | null>;

function safeCredentialEqual(
  actual: string,
  expected: string,
): boolean {
  const actualBytes = Buffer.from(actual, "utf8");
  const expectedBytes = Buffer.from(expected, "utf8");
  return (
    actualBytes.length === expectedBytes.length &&
    timingSafeEqual(actualBytes, expectedBytes)
  );
}

export function createWorkBuddyEdgeIngressHandler(input: {
  expectedSecret: string;
  expectedWorkspaceSystemKey: string;
  resolveWorkspaceId: WorkBuddyWorkspaceIdResolver;
  dispatcher: WorkBuddyMcpToolDispatcher;
  randomRequestId?: () => string;
}): (request: {
  credential: string;
  body: unknown;
  signal?: AbortSignal;
}) => Promise<EdgeIngressResponse> {
  if (Buffer.byteLength(input.expectedSecret, "utf8") < 32) {
    throw new Error("workbuddy_edge_secret_invalid");
  }
  const expectedSystemKey = z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z][a-z0-9_-]*$/)
    .parse(input.expectedWorkspaceSystemKey);
  const randomRequestId =
    input.randomRequestId ??
    (() => `workbuddy-edge:${randomUUID()}`);

  return async (request): Promise<EdgeIngressResponse> => {
    if (
      !safeCredentialEqual(
        request.credential,
        input.expectedSecret,
      )
    ) {
      return Object.freeze({
        status: 401,
        body: Object.freeze({
          ok: false,
          error: "workbuddy_edge_unauthorized",
        }),
      });
    }

    const parsed = edgeIngressEnvelopeSchema.safeParse(
      request.body,
    );
    if (!parsed.success) {
      return Object.freeze({
        status: 400,
        body: Object.freeze({
          ok: false,
          error: "workbuddy_edge_request_invalid",
        }),
      });
    }
    if (parsed.data.workspaceSystemKey !== expectedSystemKey) {
      return Object.freeze({
        status: 403,
        body: Object.freeze({
          ok: false,
          error: "workbuddy_edge_workspace_refused",
        }),
      });
    }

    const workspaceId = await input.resolveWorkspaceId(
      expectedSystemKey,
    );
    if (!workspaceId) {
      return Object.freeze({
        status: 503,
        body: Object.freeze({
          ok: false,
          error: "workbuddy_edge_workspace_unavailable",
        }),
      });
    }

    const readScopes: WorkBuddyClientIdentity["scopes"] = [
      "caio:delivery:read",
      "caio:p1c:read",
    ];
    const identity: WorkBuddyClientIdentity = Object.freeze({
      schemaVersion: "helm.workbuddy-client-identity/v1",
      clientId: parsed.data.identity.clientId,
      workspaceId,
      actorUserId: parsed.data.identity.actorUserId,
      certificateFingerprint:
        parsed.data.identity.certificateFingerprint,
      scopes: readScopes,
      transport: "mtls",
      mtlsVerified: true,
      authenticatedAt: parsed.data.identity.authenticatedAt,
    });
    const result = await handleWorkBuddyMcpMessage({
      message: parsed.data.message,
      identity,
      dispatcher: input.dispatcher,
      requestId: randomRequestId(),
      signal: request.signal,
    });
    return Object.freeze({
      status: result.httpStatus,
      body: result.body,
    });
  };
}
