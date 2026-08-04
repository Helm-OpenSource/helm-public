import { z } from "zod";

import {
  WORKSPACE_CAPABILITIES,
  type WorkspaceCapability,
} from "@/lib/auth/authorization";

import {
  WorkBuddyCollaborationError,
  workBuddyClientIdentitySchema,
  workBuddyInstantSchema,
  workBuddySafeRefSchema,
  workBuddyScopeSchema,
  type WorkBuddyClientIdentity,
  type WorkBuddyScope,
} from "./contracts";
import {
  assertWorkBuddyRequestActive,
} from "./request-cancellation";

export const WORKBUDDY_OWNER_READ_CAPABILITY =
  WORKSPACE_CAPABILITIES.MANAGE_OPERATIONAL_CONTROLS;
export const WORKBUDDY_OWNER_MUTATION_CAPABILITY =
  WORKSPACE_CAPABILITIES.MANAGE_GOVERNED_ACTIONS;

const workspaceCapabilityValues = Object.values(
  WORKSPACE_CAPABILITIES,
) as [WorkspaceCapability, ...WorkspaceCapability[]];
const workspaceCapabilitySchema = z.enum(workspaceCapabilityValues);

export type WorkBuddyMembershipSnapshot = Readonly<{
  status: "ACTIVE" | "INVITED" | "INACTIVE";
  role:
    | "OWNER"
    | "ADMIN"
    | "BILLING_ADMIN"
    | "OPERATOR"
    | "REVIEWER"
    | "MEMBER";
}>;

export type WorkBuddyCeoBindingSnapshot = Readonly<{
  bindingRef: string;
  actorUserId: string;
  principalKind: "CEO";
  ceoRef: string;
  status: "LIVE";
}>;

export type WorkBuddyCurrentMandateSnapshot = Readonly<{
  mandateRef: string;
  ceoRef: string;
  status: "CURRENT";
}>;

export type WorkBuddyAuthorizationSnapshot = Readonly<{
  membership: WorkBuddyMembershipSnapshot | null;
  hasCapability: boolean;
  mandate: WorkBuddyCurrentMandateSnapshot | null;
  binding: WorkBuddyCeoBindingSnapshot | null;
}>;

export type WorkBuddyAuthorizationSnapshotQuery = Readonly<{
  workspaceId: string;
  actorUserId: string;
  capability: WorkspaceCapability;
  checkedAt: string;
  signal?: AbortSignal;
}>;

export interface WorkBuddyAuthorizationQueries {
  loadAuthorizationSnapshot(
    input: WorkBuddyAuthorizationSnapshotQuery,
  ): Promise<WorkBuddyAuthorizationSnapshot>;
}

export const workBuddyAuthorizationContextSchema = z
  .object({
    schemaVersion: z.literal(
      "helm.workbuddy-authorization-context/v1",
    ),
    workspaceId: workBuddySafeRefSchema,
    actorUserId: workBuddySafeRefSchema,
    clientId: workBuddySafeRefSchema,
    capability: workspaceCapabilitySchema,
    scope: workBuddyScopeSchema,
    ceoBindingRef: workBuddySafeRefSchema,
    mandateRef: workBuddySafeRefSchema,
    ceoRef: workBuddySafeRefSchema,
    checkedAt: workBuddyInstantSchema,
    authorityEffect: z.literal("none"),
    canonicalMutationAuthorityGranted: z.literal(false),
  })
  .strict();

export type WorkBuddyAuthorizationContext = z.infer<
  typeof workBuddyAuthorizationContextSchema
>;

export function requireWorkBuddyOwnerCeoSnapshot(input: {
  snapshot: WorkBuddyAuthorizationSnapshot;
  actorUserId: string;
}): Readonly<{
  mandate: WorkBuddyCurrentMandateSnapshot;
  binding: WorkBuddyCeoBindingSnapshot;
}> {
  const { membership, mandate, binding } = input.snapshot;
  if (
    membership?.status !== "ACTIVE" ||
    membership.role !== "OWNER"
  ) {
    throw new WorkBuddyCollaborationError(
      "OWNER_REQUIRED",
      "An active workspace OWNER membership is required.",
    );
  }
  if (!input.snapshot.hasCapability) {
    throw new WorkBuddyCollaborationError(
      "CAPABILITY_DENIED",
      "The active owner lacks the required workspace capability.",
    );
  }
  if (mandate?.status !== "CURRENT") {
    throw new WorkBuddyCollaborationError(
      "MANDATE_REQUIRED",
      "A current CAIO mandate is required.",
    );
  }
  if (
    binding?.status !== "LIVE" ||
    binding.principalKind !== "CEO" ||
    binding.actorUserId !== input.actorUserId
  ) {
    throw new WorkBuddyCollaborationError(
      "CEO_BINDING_REQUIRED",
      "A live CEO principal binding is required.",
    );
  }
  if (binding.ceoRef !== mandate.ceoRef) {
    throw new WorkBuddyCollaborationError(
      "MANDATE_BINDING_MISMATCH",
      "The live CEO binding does not match the current mandate.",
    );
  }
  return Object.freeze({ mandate, binding });
}

export function requireWorkBuddyAuthorizationContext(input: {
  authorization: unknown;
  requiredScope: WorkBuddyScope;
  requiredCapability: WorkspaceCapability;
}): WorkBuddyAuthorizationContext {
  const parsed = workBuddyAuthorizationContextSchema.safeParse(
    input.authorization,
  );
  if (!parsed.success || parsed.data.scope !== input.requiredScope) {
    throw new WorkBuddyCollaborationError(
      "SCOPE_DENIED",
      "A valid, fresh authorization context is required.",
    );
  }
  if (parsed.data.capability !== input.requiredCapability) {
    throw new WorkBuddyCollaborationError(
      "CAPABILITY_DENIED",
      "The authorization context lacks the required workspace capability.",
    );
  }
  return parsed.data;
}

export async function authorizeWorkBuddyOwnerCeoAccess(input: {
  identity: WorkBuddyClientIdentity;
  requiredScope: WorkBuddyScope;
  requiredCapability: WorkspaceCapability;
  queries: WorkBuddyAuthorizationQueries;
  checkedAt: string;
  signal?: AbortSignal;
}): Promise<WorkBuddyAuthorizationContext> {
  assertWorkBuddyRequestActive(input.signal);
  const identity = workBuddyClientIdentitySchema.parse(input.identity);
  const requiredScopeResult = workBuddyScopeSchema.safeParse(
    input.requiredScope,
  );
  if (!requiredScopeResult.success) {
    throw new WorkBuddyCollaborationError(
      "SCOPE_DENIED",
      "The requested WorkBuddy scope is invalid.",
    );
  }
  const requiredCapabilityResult =
    workspaceCapabilitySchema.safeParse(input.requiredCapability);
  if (!requiredCapabilityResult.success) {
    throw new WorkBuddyCollaborationError(
      "CAPABILITY_DENIED",
      "The requested workspace capability is invalid.",
    );
  }
  const checkedAtResult = workBuddyInstantSchema.safeParse(
    input.checkedAt,
  );
  if (
    !checkedAtResult.success ||
    Date.parse(checkedAtResult.data) <
      Date.parse(identity.authenticatedAt)
  ) {
    throw new WorkBuddyCollaborationError(
      "AUTH_EXPIRED",
      "Authorization must be checked after mTLS authentication.",
    );
  }
  const requiredScope = requiredScopeResult.data;
  const requiredCapability = requiredCapabilityResult.data;

  if (!identity.scopes.includes(requiredScope)) {
    throw new WorkBuddyCollaborationError(
      "SCOPE_DENIED",
      "The mTLS client scope does not allow this operation.",
    );
  }

  assertWorkBuddyRequestActive(input.signal);
  const snapshot = await input.queries.loadAuthorizationSnapshot({
    workspaceId: identity.workspaceId,
    actorUserId: identity.actorUserId,
    capability: requiredCapability,
    checkedAt: checkedAtResult.data,
    signal: input.signal,
  });
  assertWorkBuddyRequestActive(input.signal);
  const { mandate, binding } = requireWorkBuddyOwnerCeoSnapshot({
    snapshot,
    actorUserId: identity.actorUserId,
  });

  return Object.freeze(
    workBuddyAuthorizationContextSchema.parse({
      schemaVersion: "helm.workbuddy-authorization-context/v1",
      workspaceId: identity.workspaceId,
      actorUserId: identity.actorUserId,
      clientId: identity.clientId,
      capability: requiredCapability,
      scope: requiredScope,
      ceoBindingRef: binding.bindingRef,
      mandateRef: mandate.mandateRef,
      ceoRef: mandate.ceoRef,
      checkedAt: checkedAtResult.data,
      authorityEffect: "none",
      canonicalMutationAuthorityGranted: false,
    }),
  );
}
