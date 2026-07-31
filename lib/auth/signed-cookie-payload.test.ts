import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  SignedCookieSecretMissingError,
  parseSignedCookiePayload,
  serializeSignedCookiePayload,
} from "@/lib/auth/signed-cookie-payload";

const PURPOSE = "test-purpose";
const SECRET_KEYS = [
  "CONNECTOR_TOKEN_SECRET",
  "CONNECTOR_TOKEN_SECRET_PREVIOUS",
] as const;

describe("signed cookie payloads", () => {
  const saved = new Map<string, string | undefined>();

  beforeEach(() => {
    for (const key of SECRET_KEYS) {
      saved.set(key, process.env[key]);
    }
    process.env.CONNECTOR_TOKEN_SECRET = "a".repeat(48);
    delete process.env.CONNECTOR_TOKEN_SECRET_PREVIOUS;
  });

  afterEach(() => {
    for (const key of SECRET_KEYS) {
      const value = saved.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    vi.unstubAllEnvs();
  });

  it("CONTROL: a value it issued round-trips (a failure here voids every test below)", () => {
    const value = serializeSignedCookiePayload(PURPOSE, { who: "owner", n: 1 });
    expect(parseSignedCookiePayload(PURPOSE, value)).toEqual({ who: "owner", n: 1 });
  });

  it("refuses a payload with no signature at all", () => {
    // The exact shape of the old cookie: bare JSON the client could author.
    const bare = JSON.stringify({ who: "attacker" });
    expect(parseSignedCookiePayload(PURPOSE, bare)).toBeNull();
    expect(
      parseSignedCookiePayload(
        PURPOSE,
        Buffer.from(bare, "utf8").toString("base64url"),
      ),
    ).toBeNull();
  });

  it("refuses a tampered payload carrying a signature that was valid for other bytes", () => {
    const issued = serializeSignedCookiePayload(PURPOSE, { role: "member" });
    const signature = issued.slice(issued.lastIndexOf(".") + 1);
    const forged = Buffer.from(JSON.stringify({ role: "owner" }), "utf8").toString(
      "base64url",
    );
    expect(parseSignedCookiePayload(PURPOSE, `${forged}.${signature}`)).toBeNull();
  });

  it("refuses a signature minted for a DIFFERENT purpose", () => {
    // Domain separation: a prefill cookie must not be usable as, say, a
    // workspace-switch token just because both are signed by this server.
    const issued = serializeSignedCookiePayload("purpose-a", { ok: true });
    expect(parseSignedCookiePayload("purpose-b", issued)).toBeNull();
    expect(parseSignedCookiePayload("purpose-a", issued)).toEqual({ ok: true });
  });

  it("refuses everything once the signing secret changes", () => {
    const issued = serializeSignedCookiePayload(PURPOSE, { ok: true });
    process.env.CONNECTOR_TOKEN_SECRET = "b".repeat(48);
    expect(parseSignedCookiePayload(PURPOSE, issued)).toBeNull();
  });

  it("still accepts the previous secret during a rotation window", () => {
    const issued = serializeSignedCookiePayload(PURPOSE, { ok: true });
    process.env.CONNECTOR_TOKEN_SECRET_PREVIOUS =
      process.env.CONNECTOR_TOKEN_SECRET;
    process.env.CONNECTOR_TOKEN_SECRET = "b".repeat(48);
    expect(parseSignedCookiePayload(PURPOSE, issued)).toEqual({ ok: true });
  });

  it("refuses malformed and empty input rather than throwing", () => {
    for (const value of [null, undefined, "", ".", "no-separator", "a.", ".b"]) {
      expect(parseSignedCookiePayload(PURPOSE, value)).toBeNull();
    }
  });

  it("refuses to sign when no secret is configured", () => {
    delete process.env.CONNECTOR_TOKEN_SECRET;
    delete process.env.CONNECTOR_TOKEN_SECRET_PREVIOUS;
    // Simulating production: writing an unsigned value would be worse than
    // failing the OAuth callback, because the unsigned value is then trusted.
    vi.stubEnv("NODE_ENV", "production");
    expect(() => serializeSignedCookiePayload(PURPOSE, { ok: true })).toThrow(
      SignedCookieSecretMissingError,
    );
    // And nothing verifies either: a production deployment with no secret
    // reads every cookie as untrusted rather than as trusted-by-default.
    expect(parseSignedCookiePayload(PURPOSE, "anything.atall")).toBeNull();
    vi.unstubAllEnvs();
  });
});
