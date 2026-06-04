import { afterEach, describe, expect, it, vi } from "vitest";
import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { isSecureConnectorTokenStorageEnabled, readConnectorToken, storeConnectorToken } from "@/lib/connectors/token-store";

describe("connector token store", () => {
  const managedEnvKeys = [
    "NODE_ENV",
    "CONNECTOR_TOKEN_SECRET",
    "CONNECTOR_TOKEN_SECRET_ID",
    "CONNECTOR_TOKEN_SECRET_PREVIOUS",
    "CONNECTOR_TOKEN_SECRET_PREVIOUS_ID",
  ] as const;
  const originalEnv = new Map(
    managedEnvKeys.map((key) => [key, process.env[key]]),
  );

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    for (const key of managedEnvKeys) {
      const originalValue = originalEnv.get(key);
      if (originalValue === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalValue;
      }
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
    process.env.CONNECTOR_TOKEN_SECRET = "helm-local-secret-000000000000000000";
    process.env.CONNECTOR_TOKEN_SECRET_ID = "primary";

    const stored = storeConnectorToken("refresh-token-value");

    expect(stored?.startsWith("enc:v2:primary:")).toBe(true);
    expect(readConnectorToken(stored)).toBe("refresh-token-value");
  });

  it("refuses weak production secrets at the token-store boundary", () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.CONNECTOR_TOKEN_SECRET = "short-secret";

    expect(() => storeConnectorToken("abc123")).toThrow(
      "CONNECTOR_TOKEN_SECRET must be at least 32 characters in production",
    );
  });

  it("does not silently treat unprefixed stored values as plaintext", () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.CONNECTOR_TOKEN_SECRET = "helm-local-secret-000000000000000000";

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(readConnectorToken("raw-token-without-prefix")).toBeNull();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("unsupported connector token storage format"),
    );
  });

  it("reads v2 tokens through previous secret during a rotation window", () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.CONNECTOR_TOKEN_SECRET = "old-secret-000000000000000000000000";
    process.env.CONNECTOR_TOKEN_SECRET_ID = "old";

    const stored = storeConnectorToken("rotating-refresh-token");

    process.env.CONNECTOR_TOKEN_SECRET = "new-secret-000000000000000000000000";
    process.env.CONNECTOR_TOKEN_SECRET_ID = "new";
    process.env.CONNECTOR_TOKEN_SECRET_PREVIOUS = "old-secret-000000000000000000000000";
    process.env.CONNECTOR_TOKEN_SECRET_PREVIOUS_ID = "old";

    expect(readConnectorToken(stored)).toBe("rotating-refresh-token");
  });

  it("returns null with an operator warning when encrypted token key material is unavailable", () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.CONNECTOR_TOKEN_SECRET = "old-secret-000000000000000000000000";
    process.env.CONNECTOR_TOKEN_SECRET_ID = "old";

    const stored = storeConnectorToken("rotating-refresh-token");

    process.env.CONNECTOR_TOKEN_SECRET = "new-secret-000000000000000000000000";
    process.env.CONNECTOR_TOKEN_SECRET_ID = "new";
    delete process.env.CONNECTOR_TOKEN_SECRET_PREVIOUS;
    delete process.env.CONNECTOR_TOKEN_SECRET_PREVIOUS_ID;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(readConnectorToken(stored)).toBeNull();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("connector token secret version is not configured"),
    );
  });

  it("keeps legacy encrypted token reads working for migration", () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.CONNECTOR_TOKEN_SECRET = "legacy-secret-000000000000000000000";

    const stored = encryptLegacyToken("legacy-encrypted-token", process.env.CONNECTOR_TOKEN_SECRET);

    expect(readConnectorToken(stored)).toBe("legacy-encrypted-token");
  });

  it("keeps legacy plain reads working without a secret", () => {
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.CONNECTOR_TOKEN_SECRET;

    const stored = `plain:${Buffer.from("legacy-token-value", "utf8").toString("base64url")}`;

    expect(readConnectorToken(stored)).toBe("legacy-token-value");
  });
});

function encryptLegacyToken(token: string, secret: string) {
  const iv = randomBytes(12);
  const key = createHash("sha256").update(secret).digest();
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `enc:${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}
