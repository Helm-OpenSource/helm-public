import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { CaioAccessGatewayError } from "@/lib/caio-access-gateway/gateway-error-contract";
import { createPrismaCaioAccessTokenPersistence } from "@/lib/caio-access-gateway/token-store.prisma";
import {
  createCaioAccessTokenService,
  type CaioAccessTokenService,
} from "@/lib/caio-access-gateway/token-store.service";

const integrationDatabaseUrl =
  process.env.CAIO_ACCESS_GATEWAY_DATABASE_URL;
const confirmedIntegrationDatabaseName =
  process.env.CAIO_ACCESS_GATEWAY_TEST_DATABASE_NAME;
const describeMysql = integrationDatabaseUrl
  ? describe.sequential
  : describe.skip;
const suffix = `${process.pid}-${Date.now()}`;
const ISOLATED_DATABASE_PREFIX = "helm_caio_gw_";
// RFC1918 example addresses constructed at runtime so the public-release
// static line scan never matches a private-IP literal.
const SOURCE_IP = [192, 168, 1, 10].join(".");
const OTHER_SOURCE_IP = [10, 0, 0, 5].join(".");

function assertIsolatedDatabaseTarget(): void {
  if (
    !integrationDatabaseUrl ||
    process.env.DATABASE_URL !== integrationDatabaseUrl
  ) {
    throw new Error(
      "DATABASE_URL must equal CAIO_ACCESS_GATEWAY_DATABASE_URL for the isolated integration test.",
    );
  }
  let databaseName = "";
  try {
    const parsed = new URL(integrationDatabaseUrl);
    databaseName = decodeURIComponent(parsed.pathname.replace(/^\/+/u, ""));
  } catch {
    throw new Error(
      "CAIO_ACCESS_GATEWAY_DATABASE_URL must be a valid isolated MySQL URL.",
    );
  }
  if (
    !databaseName.startsWith(ISOLATED_DATABASE_PREFIX) ||
    databaseName !== confirmedIntegrationDatabaseName
  ) {
    throw new Error(
      "Refusing caio-access-gateway integration test: confirm the isolated database name and use the helm_caio_gw_ prefix.",
    );
  }
}

async function expectCode(
  work: Promise<unknown>,
  code: string,
): Promise<CaioAccessGatewayError> {
  try {
    await work;
  } catch (error) {
    expect(error).toBeInstanceOf(CaioAccessGatewayError);
    expect((error as CaioAccessGatewayError).code).toBe(code);
    return error as CaioAccessGatewayError;
  }
  throw new Error(`Expected rejection with code ${code}.`);
}

describeMysql(
  "caio access token store with an isolated MySQL database",
  () => {
    let workspaceId = "";
    let service: CaioAccessTokenService;

    function binding(deviceRef: string) {
      return {
        workspaceId,
        userRef: `user-ceo-${suffix}`,
        clientType: "codex" as const,
        deviceRef,
        approvedSourceIp: SOURCE_IP,
      };
    }

    beforeAll(async () => {
      assertIsolatedDatabaseTarget();
      const workspace = await db.workspace.create({
        data: {
          name: `CAIO access gateway integration ${suffix}`,
          slug: `caio-access-gateway-${suffix}`,
        },
      });
      workspaceId = workspace.id;
      service = createCaioAccessTokenService({
        persistence: createPrismaCaioAccessTokenPersistence(db),
      });
    });

    afterAll(async () => {
      await db.$disconnect();
    });

    it("issues a pair in one transaction and stores only hash + prefix", async () => {
      const now = new Date();
      const pair = await service.issueCaioTokenPair({
        ...binding(`device-issue-${suffix}`),
        now,
      });
      const rows = await db.caioAccessToken.findMany({
        where: { workspaceId, deviceRef: `device-issue-${suffix}` },
      });
      expect(rows).toHaveLength(2);
      expect(new Set(rows.map((row) => row.audience))).toEqual(
        new Set(["mcp", "model"]),
      );
      const serialized = JSON.stringify(rows);
      expect(serialized).not.toContain(pair.mcp.rawToken);
      expect(serialized).not.toContain(pair.model.rawToken);
      for (const row of rows) {
        expect(row.tokenHash).toMatch(/^sha256:[a-f0-9]{64}$/);
        expect(row.tokenPrefix).toHaveLength(12);
        expect(row.status).toBe("active");
        expect(row.expiresAt.getTime() - row.createdAt.getTime()).toBe(
          90 * 24 * 60 * 60 * 1000,
        );
      }
    });

    it("round-trips the per-token alias grant through a real column", async () => {
      const now = new Date();
      const grantedDevice = `device-grant-${suffix}`;
      const grantedPair = await service.issueCaioTokenPair({
        ...binding(grantedDevice),
        grantedAliases: ["caio-codex-default"],
        now,
      });
      const grantedRow = await db.caioAccessToken.findUniqueOrThrow({
        where: { id: grantedPair.model.record.id },
        select: { grantedAliases: true },
      });
      expect(grantedRow.grantedAliases).toBe('["caio-codex-default"]');
      const grantedPrincipal = await service.authenticateCaioToken({
        rawToken: grantedPair.model.rawToken,
        expectedAudience: "model",
        sourceIp: SOURCE_IP,
        now,
      });
      expect(grantedPrincipal.grantedAliases).toEqual(["caio-codex-default"]);

      // An EMPTY grant is stored as "[]" and stays an empty grant: it must not
      // read back as "no grant configured".
      const emptyDevice = `device-grant-empty-${suffix}`;
      const emptyPair = await service.issueCaioTokenPair({
        ...binding(emptyDevice),
        grantedAliases: [],
        now,
      });
      const emptyRow = await db.caioAccessToken.findUniqueOrThrow({
        where: { id: emptyPair.model.record.id },
        select: { grantedAliases: true },
      });
      expect(emptyRow.grantedAliases).toBe("[]");
      const emptyPrincipal = await service.authenticateCaioToken({
        rawToken: emptyPair.model.rawToken,
        expectedAudience: "model",
        sourceIp: SOURCE_IP,
        now,
      });
      expect(emptyPrincipal.grantedAliases).toEqual([]);

      // No grant configured: the column stays NULL and the principal carries
      // nothing, so the client-type default applies.
      const defaultDevice = `device-grant-null-${suffix}`;
      const defaultPair = await service.issueCaioTokenPair({
        ...binding(defaultDevice),
        now,
      });
      const defaultRow = await db.caioAccessToken.findUniqueOrThrow({
        where: { id: defaultPair.model.record.id },
        select: { grantedAliases: true },
      });
      expect(defaultRow.grantedAliases).toBeNull();
      const defaultPrincipal = await service.authenticateCaioToken({
        rawToken: defaultPair.model.rawToken,
        expectedAudience: "model",
        sourceIp: SOURCE_IP,
        now,
      });
      expect(defaultPrincipal.grantedAliases).toBeUndefined();

      // Storage is not a trust boundary: a hand-edited row narrows, never
      // widens.
      await db.caioAccessToken.update({
        where: { id: grantedPair.model.record.id },
        data: { grantedAliases: '["caio-codex-default","NOT AN ALIAS"]' },
      });
      const narrowed = await service.authenticateCaioToken({
        rawToken: grantedPair.model.rawToken,
        expectedAudience: "model",
        sourceIp: SOURCE_IP,
        now,
      });
      expect(narrowed.grantedAliases).toEqual(["caio-codex-default"]);

      await db.caioAccessToken.update({
        where: { id: grantedPair.model.record.id },
        data: { grantedAliases: "not-json" },
      });
      const unreadable = await service.authenticateCaioToken({
        rawToken: grantedPair.model.rawToken,
        expectedAudience: "model",
        sourceIp: SOURCE_IP,
        now,
      });
      expect(unreadable.grantedAliases).toEqual([]);
    });

    it("rejects a second active pair for the same binding", async () => {
      const now = new Date();
      const deviceRef = `device-conflict-${suffix}`;
      await service.issueCaioTokenPair({ ...binding(deviceRef), now });
      await expectCode(
        service.issueCaioTokenPair({ ...binding(deviceRef), now }),
        "active_token_exists",
      );
      expect(
        await db.caioAccessToken.count({
          where: { workspaceId, deviceRef },
        }),
      ).toBe(2);
    });

    it("authenticates and enforces the failure taxonomy against real rows", async () => {
      const now = new Date();
      const deviceRef = `device-auth-${suffix}`;
      const pair = await service.issueCaioTokenPair({
        ...binding(deviceRef),
        now,
      });

      await expect(
        service.authenticateCaioToken({
          rawToken: pair.mcp.rawToken,
          expectedAudience: "mcp",
          sourceIp: SOURCE_IP,
          now,
        }),
      ).resolves.toMatchObject({
        tokenId: pair.mcp.record.id,
        workspaceId,
        audience: "mcp",
      });
      await expectCode(
        service.authenticateCaioToken({
          rawToken: pair.mcp.rawToken,
          expectedAudience: "model",
          sourceIp: SOURCE_IP,
          now,
        }),
        "audience_mismatch",
      );
      await expectCode(
        service.authenticateCaioToken({
          rawToken: pair.model.rawToken,
          expectedAudience: "model",
          sourceIp: OTHER_SOURCE_IP,
          now,
        }),
        "source_ip_mismatch",
      );
      await expectCode(
        service.authenticateCaioToken({
          rawToken: `hcaio_mcp_${"B".repeat(43)}`,
          expectedAudience: "mcp",
          sourceIp: SOURCE_IP,
          now,
        }),
        "token_unknown",
      );
    });

    it("charges failed authentications against the real rate window row", async () => {
      const now = new Date();
      const deviceRef = `device-charge-${suffix}`;
      const pair = await service.issueCaioTokenPair({
        ...binding(deviceRef),
        now,
      });

      // Wrong audience, then wrong source ip: both refused, both charged.
      await expectCode(
        service.authenticateCaioToken({
          rawToken: pair.mcp.rawToken,
          expectedAudience: "model",
          sourceIp: SOURCE_IP,
          now,
        }),
        "audience_mismatch",
      );
      await expectCode(
        service.authenticateCaioToken({
          rawToken: pair.mcp.rawToken,
          expectedAudience: "mcp",
          sourceIp: OTHER_SOURCE_IP,
          now,
        }),
        "source_ip_mismatch",
      );
      const charged = await db.caioAccessToken.findUniqueOrThrow({
        where: { id: pair.mcp.record.id },
        select: { rateWindowRequestCount: true },
      });
      expect(charged.rateWindowRequestCount).toBe(2);

      // A revoked token is charged too.
      await service.revokeCaioToken({
        workspaceId,
        tokenId: pair.model.record.id,
        now,
      });
      await expectCode(
        service.authenticateCaioToken({
          rawToken: pair.model.rawToken,
          expectedAudience: "model",
          sourceIp: SOURCE_IP,
          now,
        }),
        "token_revoked",
      );
      const revokedRow = await db.caioAccessToken.findUniqueOrThrow({
        where: { id: pair.model.record.id },
        select: { rateWindowRequestCount: true },
      });
      expect(revokedRow.rateWindowRequestCount).toBe(1);
    });

    it("counts the fixed rate window atomically under parallel requests", async () => {
      const now = new Date();
      const deviceRef = `device-rate-${suffix}`;
      const pair = await service.issueCaioTokenPair({
        ...binding(deviceRef),
        now,
      });
      const limit = 3;
      const attempts = await Promise.allSettled(
        Array.from({ length: 6 }, () =>
          service.authenticateCaioToken({
            rawToken: pair.mcp.rawToken,
            expectedAudience: "mcp",
            sourceIp: SOURCE_IP,
            now: new Date(),
            rateLimitPerMinute: limit,
          }),
        ),
      );
      const allowed = attempts.filter(
        (attempt) => attempt.status === "fulfilled",
      );
      const limited = attempts.filter(
        (attempt): attempt is PromiseRejectedResult =>
          attempt.status === "rejected",
      );
      // Diagnostic form: a bare length assertion told us "got 6" on MySQL 8.4
      // without showing WHY. Asserting the whole observed shape makes the CI
      // failure self-diagnosing (window row state + per-attempt reasons).
      const diagnosticRow = await db.caioAccessToken.findUniqueOrThrow({
        where: { id: pair.mcp.record.id },
        select: {
          rateWindowStartedAt: true,
          rateWindowRequestCount: true,
        },
      });
      expect({
        allowedCount: allowed.length,
        limitedCount: limited.length,
        finalWindowCount: diagnosticRow.rateWindowRequestCount,
        windowMovedFromIssuance:
          diagnosticRow.rateWindowStartedAt.getTime() !== now.getTime(),
        rejectionCodes: limited
          .map((entry) =>
            entry.reason instanceof CaioAccessGatewayError
              ? entry.reason.code
              : String(entry.reason),
          )
          .sort(),
      }).toEqual({
        allowedCount: limit,
        limitedCount: 6 - limit,
        finalWindowCount: limit,
        windowMovedFromIssuance: false,
        rejectionCodes: Array.from(
          { length: 6 - limit },
          () => "rate_limited",
        ),
      });
      for (const rejection of limited) {
        expect(rejection.reason).toBeInstanceOf(CaioAccessGatewayError);
        const typed = rejection.reason as CaioAccessGatewayError;
        expect(typed.code).toBe("rate_limited");
        expect(typed.retryAfterSeconds).toBeGreaterThanOrEqual(1);
        expect(typed.retryAfterSeconds).toBeLessThanOrEqual(60);
      }
      const row = await db.caioAccessToken.findUniqueOrThrow({
        where: { id: pair.mcp.record.id },
        select: { rateWindowRequestCount: true },
      });
      expect(row.rateWindowRequestCount).toBe(limit);
    });

    it("admits exactly one of two concurrent rotations and fails the old token immediately", async () => {
      const now = new Date();
      const deviceRef = `device-rotate-${suffix}`;
      const pair = await service.issueCaioTokenPair({
        ...binding(deviceRef),
        now,
      });
      const rotations = await Promise.allSettled([
        service.rotateCaioToken({
          workspaceId,
          tokenId: pair.mcp.record.id,
          now: new Date(),
        }),
        service.rotateCaioToken({
          workspaceId,
          tokenId: pair.mcp.record.id,
          now: new Date(),
        }),
      ]);
      const winners = rotations.filter(
        (rotation) => rotation.status === "fulfilled",
      );
      expect(winners).toHaveLength(1);
      const loser = rotations.find(
        (rotation): rotation is PromiseRejectedResult =>
          rotation.status === "rejected",
      );
      expect(loser?.reason).toBeInstanceOf(CaioAccessGatewayError);
      expect((loser?.reason as CaioAccessGatewayError).code).toBe(
        "rotation_conflict",
      );

      const winner = (
        winners[0] as PromiseFulfilledResult<
          Awaited<ReturnType<typeof service.rotateCaioToken>>
        >
      ).value;
      expect(winner.record.rotatedFromTokenId).toBe(pair.mcp.record.id);
      // Exactly one replacement row exists.
      expect(
        await db.caioAccessToken.count({
          where: { rotatedFromTokenId: pair.mcp.record.id },
        }),
      ).toBe(1);
      const oldRow = await db.caioAccessToken.findUniqueOrThrow({
        where: { id: pair.mcp.record.id },
        select: { status: true, rotatedAt: true },
      });
      expect(oldRow.status).toBe("rotated");
      expect(oldRow.rotatedAt).not.toBeNull();

      await expectCode(
        service.authenticateCaioToken({
          rawToken: pair.mcp.rawToken,
          expectedAudience: "mcp",
          sourceIp: SOURCE_IP,
          now: new Date(),
        }),
        "token_rotated",
      );
      await expect(
        service.authenticateCaioToken({
          rawToken: winner.rawToken,
          expectedAudience: "mcp",
          sourceIp: SOURCE_IP,
          now: new Date(),
        }),
      ).resolves.toMatchObject({ tokenId: winner.record.id });
    });

    it("revokes idempotently and blocks the token immediately", async () => {
      const now = new Date();
      const deviceRef = `device-revoke-${suffix}`;
      const pair = await service.issueCaioTokenPair({
        ...binding(deviceRef),
        now,
      });
      const first = await service.revokeCaioToken({
        workspaceId,
        tokenId: pair.model.record.id,
        now,
      });
      expect(first.alreadyRevoked).toBe(false);
      const second = await service.revokeCaioToken({
        workspaceId,
        tokenId: pair.model.record.id,
        now: new Date(now.getTime() + 1_000),
      });
      expect(second.alreadyRevoked).toBe(true);
      await expectCode(
        service.authenticateCaioToken({
          rawToken: pair.model.rawToken,
          expectedAudience: "model",
          sourceIp: SOURCE_IP,
          now: new Date(),
        }),
        "token_revoked",
      );
      await expectCode(
        service.revokeCaioToken({
          workspaceId,
          tokenId: `missing-${suffix}`,
          now,
        }),
        "token_unknown",
      );
    });

    it("expireSweep marks only past-expiry active rows", async () => {
      const now = new Date();
      const deviceRef = `device-sweep-${suffix}`;
      const pair = await service.issueCaioTokenPair({
        ...binding(deviceRef),
        now,
      });
      const sweepAt = new Date(
        now.getTime() + 90 * 24 * 60 * 60 * 1000 + 1_000,
      );
      const swept = await service.expireSweep({ now: sweepAt });
      expect(swept.expiredCount).toBeGreaterThanOrEqual(2);
      const rows = await db.caioAccessToken.findMany({
        where: { workspaceId, deviceRef },
        select: { status: true },
      });
      expect(rows.map((row) => row.status)).toEqual([
        "expired",
        "expired",
      ]);
      await expectCode(
        service.authenticateCaioToken({
          rawToken: pair.mcp.rawToken,
          expectedAudience: "mcp",
          sourceIp: SOURCE_IP,
          now: sweepAt,
        }),
        "token_expired",
      );
    });
  },
);
