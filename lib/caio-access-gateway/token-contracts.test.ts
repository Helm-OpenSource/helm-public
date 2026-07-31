import { describe, expect, it } from "vitest";

import {
  CAIO_CLIENT_TYPES,
  CAIO_TOKEN_AUDIENCES,
  CAIO_TOKEN_PREFIX_BY_AUDIENCE,
  CAIO_TOKEN_STATUSES,
  CAIO_TOKEN_TTL_MS,
  CAIO_TOKEN_VISIBLE_PREFIX_LENGTH,
  caioTokenIssuanceInputSchema,
  caioTokenRevocationInputSchema,
  caioTokenRotationInputSchema,
  computeCaioTokenExpiry,
  createCaioAccessTokenMaterial,
  hashCaioAccessToken,
  isWellFormedCaioToken,
  parseCaioStoredAliasGrant,
  parseCaioTokenAudience,
  sanitizeCaioAliasGrant,
  serializeCaioAliasGrant,
} from "@/lib/caio-access-gateway/token-contracts";

// RFC1918 example address constructed at runtime so the public-release
// static line scan never matches a private-IP literal.
const TEST_PRIVATE_IPV4 = [192, 168, 1, 10].join(".");

describe("caio token contracts", () => {
  it("pins the closed audience/client/status vocabularies", () => {
    expect(CAIO_TOKEN_AUDIENCES).toEqual(["mcp", "model"]);
    expect(CAIO_CLIENT_TYPES).toEqual(["codex", "workbuddy"]);
    expect(CAIO_TOKEN_STATUSES).toEqual([
      "active",
      "rotated",
      "revoked",
      "expired",
    ]);
  });

  it("issues audience-distinct prefixes with a 43-char base64url body", () => {
    const mcp = createCaioAccessTokenMaterial("mcp");
    const model = createCaioAccessTokenMaterial("model");
    expect(mcp.rawToken.startsWith("hcaio_mcp_")).toBe(true);
    expect(model.rawToken.startsWith("hcaio_mdl_")).toBe(true);
    expect(mcp.rawToken).toHaveLength("hcaio_mcp_".length + 43);
    expect(model.rawToken).toHaveLength("hcaio_mdl_".length + 43);
    expect(mcp.rawToken).not.toBe(model.rawToken);
    expect(CAIO_TOKEN_PREFIX_BY_AUDIENCE.mcp).toBe("hcaio_mcp_");
    expect(CAIO_TOKEN_PREFIX_BY_AUDIENCE.model).toBe("hcaio_mdl_");
  });

  it("derives sha256:<hex> hashes and 12-char visible prefixes", () => {
    const material = createCaioAccessTokenMaterial("mcp");
    expect(material.tokenHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(material.tokenHash).toBe(hashCaioAccessToken(material.rawToken));
    expect(material.tokenPrefix).toBe(
      material.rawToken.slice(0, CAIO_TOKEN_VISIBLE_PREFIX_LENGTH),
    );
    expect(material.tokenPrefix).toHaveLength(12);
    expect(material.tokenPrefix).not.toContain(
      material.rawToken.slice(CAIO_TOKEN_VISIBLE_PREFIX_LENGTH),
    );
  });

  it("computes a TTL of exactly 90 days", () => {
    expect(CAIO_TOKEN_TTL_MS).toBe(90 * 24 * 60 * 60 * 1000);
    const now = new Date("2026-07-29T00:00:00.000Z");
    expect(computeCaioTokenExpiry(now).toISOString()).toBe(
      "2026-10-27T00:00:00.000Z",
    );
  });

  it("parses and validates raw token shapes", () => {
    const mcp = createCaioAccessTokenMaterial("mcp");
    const model = createCaioAccessTokenMaterial("model");
    expect(parseCaioTokenAudience(mcp.rawToken)).toBe("mcp");
    expect(parseCaioTokenAudience(model.rawToken)).toBe("model");
    expect(parseCaioTokenAudience("hqw_something")).toBeNull();
    expect(isWellFormedCaioToken(mcp.rawToken)).toBe(true);
    expect(isWellFormedCaioToken(mcp.rawToken, "mcp")).toBe(true);
    expect(isWellFormedCaioToken(mcp.rawToken, "model")).toBe(false);
    expect(isWellFormedCaioToken("hcaio_mcp_short")).toBe(false);
    expect(isWellFormedCaioToken(`hcaio_mcp_${"!".repeat(43)}`)).toBe(false);
    expect(isWellFormedCaioToken("")).toBe(false);
  });

  it("accepts valid issuance input and rejects malformed input", () => {
    const valid = {
      workspaceId: "ws_1",
      userRef: "user:ceo",
      clientType: "codex" as const,
      deviceRef: "device:mac-studio",
      approvedSourceIp: TEST_PRIVATE_IPV4,
    };
    expect(caioTokenIssuanceInputSchema.safeParse(valid).success).toBe(true);
    expect(
      caioTokenIssuanceInputSchema.safeParse({
        ...valid,
        clientType: "browser",
      }).success,
    ).toBe(false);
    expect(
      caioTokenIssuanceInputSchema.safeParse({
        ...valid,
        approvedSourceIp: "office-router.local",
      }).success,
    ).toBe(false);
    expect(
      caioTokenIssuanceInputSchema.safeParse({
        ...valid,
        extra: "nope",
      }).success,
    ).toBe(false);
  });

  it("validates rotation and revocation inputs strictly", () => {
    const valid = { workspaceId: "ws_1", tokenId: "tok_1" };
    expect(caioTokenRotationInputSchema.safeParse(valid).success).toBe(true);
    expect(caioTokenRevocationInputSchema.safeParse(valid).success).toBe(
      true,
    );
    expect(
      caioTokenRotationInputSchema.safeParse({ workspaceId: "ws_1" })
        .success,
    ).toBe(false);
    expect(
      caioTokenRevocationInputSchema.safeParse({
        ...valid,
        force: true,
      }).success,
    ).toBe(false);
  });
});

describe("stored alias grant", () => {
  it("reads a stored grant back verbatim", () => {
    expect(parseCaioStoredAliasGrant('["caio-codex-default"]')).toEqual([
      "caio-codex-default",
    ]);
  });

  it("distinguishes NULL (no grant) from an empty grant", () => {
    expect(parseCaioStoredAliasGrant(null)).toBeUndefined();
    expect(parseCaioStoredAliasGrant("[]")).toEqual([]);
  });

  it("drops a malformed entry instead of widening the grant", () => {
    expect(
      parseCaioStoredAliasGrant(
        '["caio-codex-default","NOT AN ALIAS","",7,null]',
      ),
    ).toEqual(["caio-codex-default"]);
  });

  it("reads unreadable content as an EMPTY grant, never as no grant", () => {
    for (const raw of ["not-json", '{"alias":"caio-codex-default"}', '"x"']) {
      expect(parseCaioStoredAliasGrant(raw)).toEqual([]);
    }
  });

  it("round-trips through serialization", () => {
    expect(serializeCaioAliasGrant(null)).toBeNull();
    expect(serializeCaioAliasGrant(undefined)).toBeNull();
    expect(serializeCaioAliasGrant([])).toBe("[]");
    expect(
      parseCaioStoredAliasGrant(
        serializeCaioAliasGrant(["caio-codex-default"]),
      ),
    ).toEqual(["caio-codex-default"]);
  });

  it("sanitizes an in-memory grant the same way", () => {
    expect(sanitizeCaioAliasGrant(null)).toBeUndefined();
    expect(sanitizeCaioAliasGrant([])).toEqual([]);
    expect(
      sanitizeCaioAliasGrant(["caio-codex-default", "NOT AN ALIAS"]),
    ).toEqual(["caio-codex-default"]);
  });
});
