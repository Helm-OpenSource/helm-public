import { describe, expect, it } from "vitest";

import {
  createToolFailure,
  createToolSuccess,
  workBuddyClientIdentitySchema,
  workBuddySafeRefSchema,
  workBuddyScopeSchema,
} from "./contracts";
import { workBuddyMtlsPeerSchema } from "./client-identity";
import {
  beginOwnerPresenceChallengeInputSchema,
  completeOwnerPresenceChallengeInputSchema,
  getP1cReadProjectionInputSchema,
} from "./tool-schemas";

const FINGERPRINT = `sha256:${"a".repeat(64)}`;
const TEST_PRIVATE_IPV4 = [192, 168, 50, 21].join(".");

describe("WorkBuddy collaboration contracts", () => {
  it("accepts typed refs and opaque canonical database ids without accepting paths", () => {
    expect(workBuddySafeRefSchema.safeParse("workspace:demo").success).toBe(
      true,
    );
    expect(
      workBuddySafeRefSchema.safeParse("cmfx6r9zp0001abc123def456").success,
    ).toBe(true);
    expect(
      workBuddySafeRefSchema.safeParse("../private/customer.json").success,
    ).toBe(false);
    expect(
      workBuddySafeRefSchema.safeParse("workspace id with spaces").success,
    ).toBe(false);
  });

  it("accepts only an mTLS-verified client identity", () => {
    const identity = workBuddyClientIdentitySchema.parse({
      schemaVersion: "helm.workbuddy-client-identity/v1",
      clientId: "client:workbuddy-ceo",
      workspaceId: "workspace:demo",
      actorUserId: "user:owner",
      certificateFingerprint: FINGERPRINT,
      scopes: ["caio:presence:challenge", "caio:p1c:read"],
      transport: "mtls",
      mtlsVerified: true,
      authenticatedAt: "2026-07-26T02:00:00.000Z",
    });

    expect(identity.mtlsVerified).toBe(true);
    expect(
      workBuddyClientIdentitySchema.safeParse({
        ...identity,
        mtlsVerified: false,
      }).success,
    ).toBe(false);
    expect(workBuddyScopeSchema.safeParse("caio:unknown").success).toBe(false);
    expect(
      workBuddyMtlsPeerSchema.safeParse({
        certificateFingerprint: FINGERPRINT,
        sourceAddress: TEST_PRIVATE_IPV4,
        authorized: true,
      }).success,
    ).toBe(true);
    expect(
      workBuddyMtlsPeerSchema.safeParse({
        sourceAddress: TEST_PRIVATE_IPV4,
        authorized: true,
      }).success,
    ).toBe(false);
  });

  it("uses a fail-closed envelope for successes and errors", () => {
    const success = createToolSuccess({
      requestId: "request:1",
      serverTime: "2026-07-26T02:00:01.000Z",
      data: { portfolioRef: "portfolio:1" },
    });
    const failure = createToolFailure({
      requestId: "request:2",
      serverTime: "2026-07-26T02:00:02.000Z",
      code: "SCOPE_DENIED",
      message: "Required scope is unavailable.",
      retryable: false,
    });

    expect(success).toMatchObject({
      ok: true,
      error: null,
      boundary: {
        authorityEffect: "none",
        canonicalMutationAuthorityGranted: false,
        externalExecutionAllowed: false,
        rawContentIncluded: false,
      },
    });
    expect(failure).toMatchObject({
      ok: false,
      data: null,
      error: {
        code: "SCOPE_DENIED",
        retryable: false,
      },
    });
  });

  it("keeps tool inputs narrow and rejects caller-supplied identity", () => {
    expect(
      beginOwnerPresenceChallengeInputSchema.safeParse({
        workspaceId: "workspace:demo",
        idempotencyKey: "idem:begin:1",
      }).success,
    ).toBe(true);
    expect(
      beginOwnerPresenceChallengeInputSchema.safeParse({
        workspaceId: "workspace:demo",
        actorUserId: "user:spoofed",
        idempotencyKey: "idem:begin:1",
      }).success,
    ).toBe(false);
    expect(
      completeOwnerPresenceChallengeInputSchema.safeParse({
        challengeId: "challenge:1",
        proof: {
          schemaVersion: "helm.owner-presence-proof/v1",
          challengeId: "challenge:1",
          algorithm: "device-bound-signature",
          signature: "signed-proof-value",
          assertedAt: "2026-07-26T02:00:10.000Z",
        },
        idempotencyKey: "idem:complete:1",
      }).success,
    ).toBe(true);
    expect(
      getP1cReadProjectionInputSchema.safeParse({
        workspaceId: "workspace:demo",
        portfolioRef: "portfolio:1",
      }).success,
    ).toBe(true);
  });
});
