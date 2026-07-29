import { z } from "zod";

export const WORKBUDDY_SCOPES = [
  "caio:delivery:read",
  "caio:presence:challenge",
  "caio:p1c:read",
  "caio:canonical:mutate",
] as const;

export const workBuddyScopeSchema = z.enum(WORKBUDDY_SCOPES);
export type WorkBuddyScope = z.infer<typeof workBuddyScopeSchema>;

export const workBuddySafeRefSchema = z
  .string()
  .min(3)
  .max(200)
  .regex(
    /^(?:[a-z][a-z0-9_.-]*:[a-zA-Z0-9][a-zA-Z0-9_.:/-]*|[a-zA-Z0-9][a-zA-Z0-9_.-]*)$/,
  );

export const workBuddyInstantSchema = z.string().datetime({ offset: true });

export const workBuddyIdempotencyKeySchema = z
  .string()
  .min(8)
  .max(200);

export const workBuddyClientIdentitySchema = z
  .object({
    schemaVersion: z.literal("helm.workbuddy-client-identity/v1"),
    clientId: workBuddySafeRefSchema,
    workspaceId: workBuddySafeRefSchema,
    actorUserId: workBuddySafeRefSchema,
    certificateFingerprint: z
      .string()
      .regex(/^sha256:[a-f0-9]{64}$/),
    scopes: z.array(workBuddyScopeSchema).max(WORKBUDDY_SCOPES.length),
    transport: z.literal("mtls"),
    mtlsVerified: z.literal(true),
    authenticatedAt: workBuddyInstantSchema,
  })
  .strict();

export type WorkBuddyClientIdentity = z.infer<
  typeof workBuddyClientIdentitySchema
>;

export const WORKBUDDY_ERROR_CODES = [
  "AUTH_EXPIRED",
  "CAPABILITY_DENIED",
  "CHALLENGE_EXPIRED",
  "CEO_BINDING_REQUIRED",
  "CLIENT_IDENTITY_INVALID",
  "DEVICE_UNTRUSTED",
  "EVIDENCE_STALE",
  "INTERNAL_ERROR",
  "INVALID_TOOL_INPUT",
  "LOCAL_VIEW_REQUIRED",
  "MANDATE_BINDING_MISMATCH",
  "MANDATE_REQUIRED",
  "MUTATION_DISABLED",
  "NETWORK_UNREACHABLE",
  "OBJECT_EXPIRED",
  "OBJECT_WITHDRAWN",
  "OWNER_REQUIRED",
  "PRESENCE_BINDING_MISMATCH",
  "PRESENCE_EXPIRED",
  "PRESENCE_PROOF_INVALID",
  "PRESENCE_REPLAYED",
  "PROJECTION_BLOCKED",
  "REPLAY_REJECTED",
  "REQUEST_DEADLINE_EXCEEDED",
  "SCOPE_DENIED",
  "TOOL_DISABLED",
  "TOOL_NOT_FOUND",
  "VERSION_CONFLICT",
  "WRITE_UNAVAILABLE",
] as const;

export type WorkBuddyErrorCode =
  (typeof WORKBUDDY_ERROR_CODES)[number];

export class WorkBuddyCollaborationError extends Error {
  readonly code: WorkBuddyErrorCode;
  readonly retryable: boolean;

  constructor(
    code: WorkBuddyErrorCode,
    message: string,
    retryable = false,
  ) {
    super(message);
    this.name = "WorkBuddyCollaborationError";
    this.code = code;
    this.retryable = retryable;
  }
}

export type WorkBuddyToolBoundary = Readonly<{
  authorityEffect: "none";
  canonicalMutationAuthorityGranted: false;
  externalExecutionAllowed: false;
  rawContentIncluded: false;
}>;

const TOOL_BOUNDARY: WorkBuddyToolBoundary = Object.freeze({
  authorityEffect: "none",
  canonicalMutationAuthorityGranted: false,
  externalExecutionAllowed: false,
  rawContentIncluded: false,
});

export type ToolEnvelope<T> =
  | Readonly<{
      schemaVersion: "helm.workbuddy-tool-envelope/v1";
      requestId: string;
      serverTime: string;
      ok: true;
      data: T;
      error: null;
      boundary: WorkBuddyToolBoundary;
    }>
  | Readonly<{
      schemaVersion: "helm.workbuddy-tool-envelope/v1";
      requestId: string;
      serverTime: string;
      ok: false;
      data: null;
      error: Readonly<{
        code: WorkBuddyErrorCode;
        message: string;
        retryable: boolean;
      }>;
      boundary: WorkBuddyToolBoundary;
    }>;

export function createToolSuccess<T>(input: {
  requestId: string;
  serverTime: string;
  data: T;
}): ToolEnvelope<T> {
  return Object.freeze({
    schemaVersion: "helm.workbuddy-tool-envelope/v1",
    requestId: input.requestId,
    serverTime: input.serverTime,
    ok: true,
    data: input.data,
    error: null,
    boundary: TOOL_BOUNDARY,
  });
}

export function createToolFailure(input: {
  requestId: string;
  serverTime: string;
  code: WorkBuddyErrorCode;
  message: string;
  retryable: boolean;
}): ToolEnvelope<never> {
  return Object.freeze({
    schemaVersion: "helm.workbuddy-tool-envelope/v1",
    requestId: input.requestId,
    serverTime: input.serverTime,
    ok: false,
    data: null,
    error: Object.freeze({
      code: input.code,
      message: input.message,
      retryable: input.retryable,
    }),
    boundary: TOOL_BOUNDARY,
  });
}
