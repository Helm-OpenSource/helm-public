import { describe, expect, it } from "vitest";
import {
  createExternalAgentBearerToken,
  hashExternalAgentBearerToken,
  parseStoredConnectionScopes,
  serializeExternalAgentConnection,
} from "./connection-security";

describe("external agent connection security", () => {
  it("creates a 256-bit bearer token and stores only a stable hash", () => {
    const generated = createExternalAgentBearerToken();

    expect(generated.token).toMatch(/^hqw_[A-Za-z0-9_-]{43}$/);
    expect(generated.tokenHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(generated.tokenHash).toBe(hashExternalAgentBearerToken(generated.token));
    expect(generated.tokenHash).not.toContain(generated.token);
    expect(generated.tokenPrefix).toBe(generated.token.slice(0, 12));
  });

  it("parses only the closed connection scope set", () => {
    expect(
      parseStoredConnectionScopes(
        JSON.stringify(["context:read", "draft:propose", "approve", "context:read"]),
      ),
    ).toEqual(["context:read", "draft:propose"]);
  });

  it("never serializes token hash or raw policy JSON to operators", () => {
    const safe = serializeExternalAgentConnection({
      id: "connection-1",
      providerId: "qoderwork_cn",
      deviceRef: "device:synthetic-1",
      displayName: "Owner Mac",
      tokenHash: "sha256:should-never-leak",
      tokenPrefix: "hqw_example_",
      scopesJson: "[\"context:read\"]",
      allowedSourceIdsJson: "[\"source:synthetic\"]",
      allowedObjectTypesJson: "[\"opportunity\"]",
      maxDataClassification: "internal",
      observationProgramId: "program-1",
      expiresAt: new Date("2099-08-19T00:00:00.000Z"),
      revokedAt: null,
      lastConnectedAt: null,
      lastFailureCode: null,
      createdAt: new Date("2026-07-20T00:00:00.000Z"),
      updatedAt: new Date("2026-07-20T00:00:00.000Z"),
    });

    expect(safe).not.toHaveProperty("tokenHash");
    expect(safe).not.toHaveProperty("scopesJson");
    expect(JSON.stringify(safe)).not.toContain("should-never-leak");
    expect(safe.scopes).toEqual(["context:read"]);
    expect(safe.status).toBe("active");
  });
});
