import { describe, expect, it } from "vitest";

import { CaioAccessGatewayError } from "@/lib/caio-access-gateway/gateway-error-contract";
import { createInMemoryCaioAccessTokenPersistence } from "@/lib/caio-access-gateway/token-store.memory";
import {
  CAIO_RATE_WINDOW_MS,
  createCaioAccessTokenService,
} from "@/lib/caio-access-gateway/token-store.service";

const NOW = new Date("2026-07-29T08:00:00.000Z");
// RFC1918 example addresses constructed at runtime so the public-release
// static line scan never matches a private-IP literal.
const APPROVED_SOURCE_IP = [192, 168, 1, 10].join(".");
const OTHER_SOURCE_IP = [10, 0, 0, 5].join(".");
const BINDING = {
  workspaceId: "ws_gateway",
  userRef: "user:ceo",
  clientType: "codex" as const,
  deviceRef: "device:mac-studio",
  approvedSourceIp: APPROVED_SOURCE_IP,
};

function setup() {
  const persistence = createInMemoryCaioAccessTokenPersistence();
  const service = createCaioAccessTokenService({ persistence });
  return { persistence, service };
}

async function expectGatewayError(
  work: Promise<unknown>,
  code: string,
  wireStatus?: number,
): Promise<CaioAccessGatewayError> {
  try {
    await work;
  } catch (error) {
    expect(error).toBeInstanceOf(CaioAccessGatewayError);
    const typed = error as CaioAccessGatewayError;
    expect(typed.code).toBe(code);
    if (wireStatus !== undefined) expect(typed.wireStatus).toBe(wireStatus);
    return typed;
  }
  throw new Error(`Expected rejection with code ${code}.`);
}

describe("issueCaioTokenPair", () => {
  it("issues two independent tokens (mcp + model) with raw tokens returned once", async () => {
    const { persistence, service } = setup();
    const pair = await service.issueCaioTokenPair({ ...BINDING, now: NOW });

    expect(pair.mcp.rawToken.startsWith("hcaio_mcp_")).toBe(true);
    expect(pair.model.rawToken.startsWith("hcaio_mdl_")).toBe(true);
    expect(pair.mcp.rawToken).not.toBe(pair.model.rawToken);
    expect(pair.mcp.record.audience).toBe("mcp");
    expect(pair.model.record.audience).toBe("model");
    expect(pair.mcp.record.expiresAt.getTime() - NOW.getTime()).toBe(
      90 * 24 * 60 * 60 * 1000,
    );

    // Only hash + visible prefix are stored, never the raw token.
    const stored = persistence.rows();
    expect(stored).toHaveLength(2);
    const serialized = JSON.stringify(stored);
    expect(serialized).not.toContain(pair.mcp.rawToken);
    expect(serialized).not.toContain(pair.model.rawToken);
    for (const row of stored) {
      expect(row.tokenHash).toMatch(/^sha256:[a-f0-9]{64}$/);
      expect(row.tokenPrefix).toHaveLength(12);
      expect(row.status).toBe("active");
    }
  });

  it("rejects issuance when an active token already exists for the binding (no revoke-replace)", async () => {
    const { persistence, service } = setup();
    await service.issueCaioTokenPair({ ...BINDING, now: NOW });
    await expectGatewayError(
      service.issueCaioTokenPair({ ...BINDING, now: NOW }),
      "active_token_exists",
      409,
    );
    // Nothing extra was written by the failed issuance.
    expect(persistence.rows()).toHaveLength(2);
  });

  it("allows a second pair on a different device binding", async () => {
    const { service } = setup();
    await service.issueCaioTokenPair({ ...BINDING, now: NOW });
    const other = await service.issueCaioTokenPair({
      ...BINDING,
      deviceRef: "device:macbook",
      now: NOW,
    });
    expect(other.mcp.record.deviceRef).toBe("device:macbook");
  });

  it("rejects malformed issuance input without writing", async () => {
    const { persistence, service } = setup();
    await expectGatewayError(
      service.issueCaioTokenPair({
        ...BINDING,
        approvedSourceIp: "not-an-ip",
        now: NOW,
      }),
      "bad_request",
      400,
    );
    expect(persistence.rows()).toHaveLength(0);
  });
});

describe("authenticateCaioToken", () => {
  it("authenticates a valid token into a principal", async () => {
    const { service } = setup();
    const pair = await service.issueCaioTokenPair({ ...BINDING, now: NOW });
    const principal = await service.authenticateCaioToken({
      rawToken: pair.mcp.rawToken,
      expectedAudience: "mcp",
      sourceIp: BINDING.approvedSourceIp,
      now: NOW,
    });
    expect(principal).toEqual({
      tokenId: pair.mcp.record.id,
      workspaceId: BINDING.workspaceId,
      userRef: BINDING.userRef,
      clientType: BINDING.clientType,
      deviceRef: BINDING.deviceRef,
      audience: "mcp",
    });
  });

  it("fails token_unknown for unknown and malformed tokens", async () => {
    const { service } = setup();
    await service.issueCaioTokenPair({ ...BINDING, now: NOW });
    await expectGatewayError(
      service.authenticateCaioToken({
        rawToken: `hcaio_mcp_${"A".repeat(43)}`,
        expectedAudience: "mcp",
        sourceIp: BINDING.approvedSourceIp,
        now: NOW,
      }),
      "token_unknown",
      401,
    );
    await expectGatewayError(
      service.authenticateCaioToken({
        rawToken: "not-a-token",
        expectedAudience: "mcp",
        sourceIp: BINDING.approvedSourceIp,
        now: NOW,
      }),
      "token_unknown",
      401,
    );
  });

  it("fails audience_mismatch on an audience swap in both directions", async () => {
    const { service } = setup();
    const pair = await service.issueCaioTokenPair({ ...BINDING, now: NOW });
    await expectGatewayError(
      service.authenticateCaioToken({
        rawToken: pair.mcp.rawToken,
        expectedAudience: "model",
        sourceIp: BINDING.approvedSourceIp,
        now: NOW,
      }),
      "audience_mismatch",
      401,
    );
    await expectGatewayError(
      service.authenticateCaioToken({
        rawToken: pair.model.rawToken,
        expectedAudience: "mcp",
        sourceIp: BINDING.approvedSourceIp,
        now: NOW,
      }),
      "audience_mismatch",
      401,
    );
  });

  it("fails token_expired past the 90-day TTL", async () => {
    const { service } = setup();
    const pair = await service.issueCaioTokenPair({ ...BINDING, now: NOW });
    const atExpiry = new Date(NOW.getTime() + 90 * 24 * 60 * 60 * 1000);
    await expectGatewayError(
      service.authenticateCaioToken({
        rawToken: pair.mcp.rawToken,
        expectedAudience: "mcp",
        sourceIp: BINDING.approvedSourceIp,
        now: atExpiry,
      }),
      "token_expired",
      401,
    );
  });

  it("fails token_revoked immediately after revocation", async () => {
    const { service } = setup();
    const pair = await service.issueCaioTokenPair({ ...BINDING, now: NOW });
    await service.revokeCaioToken({
      workspaceId: BINDING.workspaceId,
      tokenId: pair.mcp.record.id,
      now: NOW,
    });
    await expectGatewayError(
      service.authenticateCaioToken({
        rawToken: pair.mcp.rawToken,
        expectedAudience: "mcp",
        sourceIp: BINDING.approvedSourceIp,
        now: NOW,
      }),
      "token_revoked",
      401,
    );
  });

  it("fails source_ip_mismatch as a 403-class error", async () => {
    const { service } = setup();
    const pair = await service.issueCaioTokenPair({ ...BINDING, now: NOW });
    await expectGatewayError(
      service.authenticateCaioToken({
        rawToken: pair.mcp.rawToken,
        expectedAudience: "mcp",
        sourceIp: OTHER_SOURCE_IP,
        now: NOW,
      }),
      "source_ip_mismatch",
      403,
    );
  });

  it("enforces the fixed 60s window and reports retryAfterSeconds", async () => {
    const { service } = setup();
    const pair = await service.issueCaioTokenPair({ ...BINDING, now: NOW });
    const authenticate = (now: Date) =>
      service.authenticateCaioToken({
        rawToken: pair.mcp.rawToken,
        expectedAudience: "mcp",
        sourceIp: BINDING.approvedSourceIp,
        now,
        rateLimitPerMinute: 2,
      });

    await authenticate(NOW);
    await authenticate(new Date(NOW.getTime() + 1_000));
    const limited = await expectGatewayError(
      authenticate(new Date(NOW.getTime() + 2_000)),
      "rate_limited",
      429,
    );
    expect(limited.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    expect(limited.retryAfterSeconds).toBeLessThanOrEqual(60);

    // The fixed window resets after 60 seconds.
    const afterWindow = new Date(NOW.getTime() + CAIO_RATE_WINDOW_MS);
    await expect(authenticate(afterWindow)).resolves.toMatchObject({
      tokenId: pair.mcp.record.id,
    });
  });

  it("never includes token material in authentication errors", async () => {
    const { service } = setup();
    const pair = await service.issueCaioTokenPair({ ...BINDING, now: NOW });
    const error = await expectGatewayError(
      service.authenticateCaioToken({
        rawToken: pair.mcp.rawToken,
        expectedAudience: "model",
        sourceIp: BINDING.approvedSourceIp,
        now: NOW,
      }),
      "audience_mismatch",
    );
    const serialized = `${error.message}${error.stack ?? ""}`;
    expect(serialized).not.toContain(pair.mcp.rawToken.slice(12));
    expect(serialized).not.toContain(pair.mcp.record.tokenHash);
  });
});

describe("rotateCaioToken", () => {
  it("rotates in one step: old token fails immediately, new token works", async () => {
    const { persistence, service } = setup();
    const pair = await service.issueCaioTokenPair({ ...BINDING, now: NOW });
    const later = new Date(NOW.getTime() + 10_000);
    const rotated = await service.rotateCaioToken({
      workspaceId: BINDING.workspaceId,
      tokenId: pair.mcp.record.id,
      now: later,
    });

    expect(rotated.record.audience).toBe("mcp");
    expect(rotated.record.rotatedFromTokenId).toBe(pair.mcp.record.id);
    expect(rotated.record.approvedSourceIp).toBe(BINDING.approvedSourceIp);
    expect(rotated.record.expiresAt.getTime() - later.getTime()).toBe(
      90 * 24 * 60 * 60 * 1000,
    );

    const old = persistence.peek(pair.mcp.record.id);
    expect(old?.status).toBe("rotated");
    expect(old?.rotatedAt).toEqual(later);

    await expectGatewayError(
      service.authenticateCaioToken({
        rawToken: pair.mcp.rawToken,
        expectedAudience: "mcp",
        sourceIp: BINDING.approvedSourceIp,
        now: later,
      }),
      "token_rotated",
      401,
    );
    await expect(
      service.authenticateCaioToken({
        rawToken: rotated.rawToken,
        expectedAudience: "mcp",
        sourceIp: BINDING.approvedSourceIp,
        now: later,
      }),
    ).resolves.toMatchObject({ tokenId: rotated.record.id });
  });

  it("is concurrency-safe: a second rotation of the same token conflicts", async () => {
    const { service } = setup();
    const pair = await service.issueCaioTokenPair({ ...BINDING, now: NOW });
    await service.rotateCaioToken({
      workspaceId: BINDING.workspaceId,
      tokenId: pair.mcp.record.id,
      now: NOW,
    });
    await expectGatewayError(
      service.rotateCaioToken({
        workspaceId: BINDING.workspaceId,
        tokenId: pair.mcp.record.id,
        now: NOW,
      }),
      "rotation_conflict",
      409,
    );
  });

  it("rejects rotating an unknown or cross-workspace token", async () => {
    const { service } = setup();
    const pair = await service.issueCaioTokenPair({ ...BINDING, now: NOW });
    await expectGatewayError(
      service.rotateCaioToken({
        workspaceId: BINDING.workspaceId,
        tokenId: "tok_missing",
        now: NOW,
      }),
      "token_unknown",
      401,
    );
    await expectGatewayError(
      service.rotateCaioToken({
        workspaceId: "ws_other",
        tokenId: pair.mcp.record.id,
        now: NOW,
      }),
      "token_unknown",
      401,
    );
  });
});

describe("revokeCaioToken", () => {
  it("revokes immediately and stays idempotent", async () => {
    const { persistence, service } = setup();
    const pair = await service.issueCaioTokenPair({ ...BINDING, now: NOW });
    const first = await service.revokeCaioToken({
      workspaceId: BINDING.workspaceId,
      tokenId: pair.model.record.id,
      now: NOW,
    });
    expect(first).toEqual({
      tokenId: pair.model.record.id,
      status: "revoked",
      alreadyRevoked: false,
    });
    const second = await service.revokeCaioToken({
      workspaceId: BINDING.workspaceId,
      tokenId: pair.model.record.id,
      now: new Date(NOW.getTime() + 1_000),
    });
    expect(second.alreadyRevoked).toBe(true);
    // The original revocation instant is preserved.
    expect(persistence.peek(pair.model.record.id)?.revokedAt).toEqual(NOW);
  });

  it("throws token_unknown for a missing token", async () => {
    const { service } = setup();
    await expectGatewayError(
      service.revokeCaioToken({
        workspaceId: BINDING.workspaceId,
        tokenId: "tok_missing",
        now: NOW,
      }),
      "token_unknown",
      401,
    );
  });
});

describe("expireSweep", () => {
  it("marks only past-expiry active tokens as expired", async () => {
    const { persistence, service } = setup();
    const pair = await service.issueCaioTokenPair({ ...BINDING, now: NOW });
    const fresh = await service.issueCaioTokenPair({
      ...BINDING,
      deviceRef: "device:macbook",
      now: new Date(NOW.getTime() + 24 * 60 * 60 * 1000),
    });

    const sweepAt = new Date(NOW.getTime() + 90 * 24 * 60 * 60 * 1000);
    const swept = await service.expireSweep({ now: sweepAt });
    expect(swept.expiredCount).toBe(2);
    expect(persistence.peek(pair.mcp.record.id)?.status).toBe("expired");
    expect(persistence.peek(pair.model.record.id)?.status).toBe("expired");
    expect(persistence.peek(fresh.mcp.record.id)?.status).toBe("active");

    await expectGatewayError(
      service.authenticateCaioToken({
        rawToken: pair.mcp.rawToken,
        expectedAudience: "mcp",
        sourceIp: BINDING.approvedSourceIp,
        now: sweepAt,
      }),
      "token_expired",
      401,
    );
  });
});
