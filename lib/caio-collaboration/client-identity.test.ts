import { describe, expect, it } from "vitest";

import type { WorkBuddyClientIdentity } from "./contracts";
import {
  resolveVerifiedWorkBuddyClientIdentity,
  type WorkBuddyMtlsPeer,
} from "./client-identity";

const PEER: WorkBuddyMtlsPeer = {
  certificateFingerprint: `sha256:${"a".repeat(64)}`,
  sourceAddress: [192, 168, 50, 20].join("."),
  authorized: true,
};

const IDENTITY: WorkBuddyClientIdentity = {
  schemaVersion: "helm.workbuddy-client-identity/v1",
  clientId: "client:workbuddy-ceo",
  workspaceId: "workspace:synthetic",
  actorUserId: "user:owner",
  certificateFingerprint: PEER.certificateFingerprint,
  scopes: ["caio:p1c:read"],
  transport: "mtls",
  mtlsVerified: true,
  authenticatedAt: "2026-07-26T08:00:00.000Z",
};

describe("resolveVerifiedWorkBuddyClientIdentity", () => {
  it("accepts only a schema-valid identity bound to the TLS peer fingerprint", async () => {
    await expect(
      resolveVerifiedWorkBuddyClientIdentity({
        peer: PEER,
        resolver: {
          resolve: async () => IDENTITY,
        },
      }),
    ).resolves.toEqual(IDENTITY);

    await expect(
      resolveVerifiedWorkBuddyClientIdentity({
        peer: PEER,
        resolver: {
          resolve: async () => ({
            ...IDENTITY,
            certificateFingerprint: `sha256:${"b".repeat(64)}`,
          }),
        },
      }),
    ).resolves.toBeNull();
  });
});
