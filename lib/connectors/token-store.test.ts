import { afterEach, describe, expect, it, vi } from "vitest";
import { isSecureConnectorTokenStorageEnabled, readConnectorToken, storeConnectorToken } from "@/lib/connectors/token-store";

describe("connector token store", () => {
  const originalSecret = process.env.CONNECTOR_TOKEN_SECRET;

  afterEach(() => {
    vi.unstubAllEnvs();
    if (originalSecret === undefined) {
      delete process.env.CONNECTOR_TOKEN_SECRET;
    } else {
      process.env.CONNECTOR_TOKEN_SECRET = originalSecret;
    }
  });

  it("refuses to store plain fallback tokens in production when no secret is set", () => {
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.CONNECTOR_TOKEN_SECRET;

    expect(() => storeConnectorToken("abc123")).toThrow(
      "CONNECTOR_TOKEN_SECRET is required to store connector tokens in production",
    );

    const legacyPlain = `plain:${Buffer.from("abc123", "utf8").toString("base64url")}`;
    expect(readConnectorToken(legacyPlain)).toBe("abc123");
  });

  it("refuses to store plain fallback tokens in production when the secret is blank", () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.CONNECTOR_TOKEN_SECRET = "   ";

    expect(() => storeConnectorToken("abc123")).toThrow(
      "CONNECTOR_TOKEN_SECRET is required to store connector tokens in production",
    );
  });

  it("falls back to readable plain local encoding outside production when no secret is set", () => {
    vi.stubEnv("NODE_ENV", "development");
    delete process.env.CONNECTOR_TOKEN_SECRET;

    const stored = storeConnectorToken("abc123");

    expect(stored?.startsWith("plain:")).toBe(true);
    expect(isSecureConnectorTokenStorageEnabled()).toBe(false);
    expect(readConnectorToken(stored)).toBe("abc123");
  });

  it("encrypts and decrypts tokens when a secret exists", () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.CONNECTOR_TOKEN_SECRET = "helm-local-secret";

    const stored = storeConnectorToken("refresh-token-value");

    expect(stored?.startsWith("enc:")).toBe(true);
    expect(readConnectorToken(stored)).toBe("refresh-token-value");
  });

  it("keeps legacy plain reads working without a secret", () => {
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.CONNECTOR_TOKEN_SECRET;

    const stored = `plain:${Buffer.from("legacy-token-value", "utf8").toString("base64url")}`;

    expect(readConnectorToken(stored)).toBe("legacy-token-value");
  });
});
