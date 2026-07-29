import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  PAIRING_TTL_MS,
  PairingError,
  completePairing,
  createPairingSession,
  deriveMatchCode,
  describePairingSession,
  gatewayApprovePairing,
  hpkeOpen,
  hpkeSeal,
  publicKeyFromRaw,
  privateKeyFromRaw,
  rawX25519PublicKey,
  sealedPayloadId,
  verifyGatewayCa,
  type CompletePairingPorts,
  type PairedTokens,
  type SealedPayload,
} from "@/tools/caio-connect/pairing-protocol";

const NOW = Date.parse("2026-07-29T08:00:00Z");
// Synthetic entropy-shaped tokens and RFC1918 example address, constructed at
// runtime so the public-release static line scan never matches a credential or
// private-IP literal.
const MCP_TOKEN = ["mcp-tok-", "Aa1Bb2Cc3", "Dd4Ee5Ff6", "Gg7Hh8"].join("");
const MODEL_TOKEN = ["model-tok-", "Zz9Yy8Xx7", "Ww6Vv5Uu4", "Tt3"].join("");
const TEST_PRIVATE_IPV4 = [10, 0, 0, 5].join(".");

function makeSession(now = NOW) {
  return createPairingSession({
    clientType: "codex",
    user: "ceo",
    deviceRef: "ceo-macbook-1",
    sourceIp: TEST_PRIVATE_IPV4,
    now,
  });
}

function sealTokensFor(session: ReturnType<typeof makeSession>): SealedPayload {
  return hpkeSeal({
    recipientPublicKeyRaw: Buffer.from(session.request.clientPublicKey, "base64"),
    plaintext: Buffer.from(JSON.stringify({ mcpToken: MCP_TOKEN, modelToken: MODEL_TOKEN })),
    info: Buffer.from(session.sessionId, "utf8"),
  });
}

function openPorts(): CompletePairingPorts {
  const seen = new Set<string>();
  return {
    rateLimiter: { allow: () => true },
    replayGuard: {
      claim: (id) => {
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      },
    },
  };
}

describe("verifyGatewayCa", () => {
  it("passes when the chain ends at the approved Studio CA", async () => {
    await expect(
      verifyGatewayCa("cert-ref", {
        verifyChain: async () => ({ chainsToApprovedCa: true, caSubjectRef: "studio-ca" }),
      }),
    ).resolves.toEqual({ caSubjectRef: "studio-ca" });
  });

  it("aborts with a typed error on a wrong or unknown CA", async () => {
    const attempt = verifyGatewayCa("cert-ref", {
      verifyChain: async () => ({ chainsToApprovedCa: false }),
    });
    await expect(attempt).rejects.toBeInstanceOf(PairingError);
    await expect(attempt).rejects.toMatchObject({ code: "gateway_ca_untrusted" });
  });
});

describe("createPairingSession", () => {
  it("creates a pending request with an X25519 public key and 10-minute expiry", () => {
    const session = makeSession();
    expect(session.expiresAt - session.createdAt).toBe(PAIRING_TTL_MS);
    expect(session.request.clientType).toBe("codex");
    const raw = Buffer.from(session.request.clientPublicKey, "base64");
    expect(raw).toHaveLength(32);
    // Round-trips through node KeyObjects.
    expect(rawX25519PublicKey(publicKeyFromRaw(raw)).equals(raw)).toBe(true);
  });

  it("keeps the private key out of JSON serialization and safe descriptions", () => {
    const session = makeSession();
    const serialized = JSON.stringify(session);
    expect(serialized).not.toContain("privateKeyRaw");
    expect(serialized).not.toContain(session.privateKeyRaw.toString("base64"));
    const description = JSON.stringify(describePairingSession(session));
    expect(description).not.toContain("privateKey");
    expect(description).toContain(session.sessionId);
  });
});

describe("match code", () => {
  it("derives a stable 6-digit code from the transcript", () => {
    const session = makeSession();
    const serverKey = rawX25519PublicKey(generateKeyPairSync("x25519").publicKey).toString(
      "base64",
    );
    const code = deriveMatchCode(session, serverKey);
    expect(code).toMatch(/^\d{6}$/);
    expect(deriveMatchCode(session, serverKey)).toBe(code);
    // A different transcript yields a different code (overwhelmingly likely).
    const other = deriveMatchCode({ ...session, sessionId: "other-session" }, serverKey);
    expect(other).not.toBe(code);
  });

  it("has no independent authorization power: gateway approval requires the owner action port", async () => {
    let ownerAsked = 0;
    const ownerApproval = {
      approve: async () => {
        ownerAsked += 1;
        return { approved: false };
      },
    };
    // Even a confirmed match code approves nothing when the owner declines.
    const declined = await gatewayApprovePairing({
      sessionId: "s1",
      matchCodeConfirmed: true,
      ownerApproval,
    });
    expect(declined.approved).toBe(false);
    expect(ownerAsked).toBe(1);

    // Unconfirmed code never even reaches the owner.
    const unconfirmed = await gatewayApprovePairing({
      sessionId: "s1",
      matchCodeConfirmed: false,
      ownerApproval,
    });
    expect(unconfirmed.approved).toBe(false);
    expect(ownerAsked).toBe(1);

    // Approval happens only with an explicit owner action carrying a receipt.
    const approved = await gatewayApprovePairing({
      sessionId: "s1",
      matchCodeConfirmed: true,
      ownerApproval: { approve: async () => ({ approved: true, receiptRef: "owner-receipt-1" }) },
    });
    expect(approved).toEqual({ approved: true, receiptRef: "owner-receipt-1" });
  });
});

describe("HPKE-style seal/open", () => {
  it("round-trips a payload (test vector)", () => {
    const { publicKey, privateKey } = generateKeyPairSync("x25519");
    const recipientPublicRaw = rawX25519PublicKey(publicKey);
    const pkcs8 = privateKey.export({ format: "der", type: "pkcs8" }) as Buffer;
    const recipientPrivateRaw = Buffer.from(pkcs8.subarray(pkcs8.length - 32));
    // Keys round-trip through the raw form.
    expect(
      rawX25519PublicKey(publicKeyFromRaw(recipientPublicRaw)).equals(recipientPublicRaw),
    ).toBe(true);
    expect(privateKeyFromRaw(recipientPrivateRaw).asymmetricKeyType).toBe("x25519");

    const info = Buffer.from("session-123", "utf8");
    const sealed = hpkeSeal({
      recipientPublicKeyRaw: recipientPublicRaw,
      plaintext: Buffer.from("attack at dawn"),
      info,
    });
    const opened = hpkeOpen({ recipientPrivateKeyRaw: recipientPrivateRaw, sealed, info });
    expect(opened.toString("utf8")).toBe("attack at dawn");
  });

  it("fails to open when ANY ciphertext byte is flipped (tamper test)", () => {
    const { publicKey, privateKey } = generateKeyPairSync("x25519");
    const recipientPublicRaw = rawX25519PublicKey(publicKey);
    const pkcs8 = privateKey.export({ format: "der", type: "pkcs8" }) as Buffer;
    const recipientPrivateRaw = Buffer.from(pkcs8.subarray(pkcs8.length - 32));
    const info = Buffer.from("session-tamper", "utf8");
    const sealed = hpkeSeal({
      recipientPublicKeyRaw: recipientPublicRaw,
      plaintext: Buffer.from("{\"mcpToken\":\"a\",\"modelToken\":\"b\"}"),
      info,
    });
    const ciphertext = Buffer.from(sealed.ciphertext, "base64");
    for (let i = 0; i < ciphertext.length; i++) {
      const tampered = Buffer.from(ciphertext);
      tampered[i] ^= 0x01;
      expect(() =>
        hpkeOpen({
          recipientPrivateKeyRaw: recipientPrivateRaw,
          sealed: { enc: sealed.enc, ciphertext: tampered.toString("base64") },
          info,
        }),
      ).toThrow(PairingError);
    }
    // Wrong info (AAD) also fails.
    expect(() =>
      hpkeOpen({
        recipientPrivateKeyRaw: recipientPrivateRaw,
        sealed,
        info: Buffer.from("different", "utf8"),
      }),
    ).toThrow(PairingError);
  });
});

describe("completePairing", () => {
  it("decrypts tokens in memory, delivers them to the sink, and zeroes buffers", async () => {
    const session = makeSession();
    const privateKeyBefore = Buffer.from(session.privateKeyRaw);
    const sealed = sealTokensFor(session);
    let delivered: PairedTokens | undefined;

    const result = await completePairing({
      session,
      sealed,
      ports: openPorts(),
      onTokens: async (tokens) => {
        delivered = { ...tokens };
      },
      now: NOW + 1000,
    });

    expect(delivered).toEqual({ mcpToken: MCP_TOKEN, modelToken: MODEL_TOKEN });
    expect(result.status).toBe("paired");
    // Result never carries tokens.
    expect(JSON.stringify(result)).not.toContain(MCP_TOKEN);
    expect(JSON.stringify(result)).not.toContain(MODEL_TOKEN);
    // Private key buffer is zeroed after use.
    expect(privateKeyBefore.some((b) => b !== 0)).toBe(true);
    expect(session.privateKeyRaw.every((b) => b === 0)).toBe(true);
  });

  it("rejects replay of the same sealed payload (single-use pending)", async () => {
    const session = makeSession();
    const sealed = sealTokensFor(session);
    const ports = openPorts();
    await completePairing({ session, sealed, ports, onTokens: async () => {}, now: NOW + 1 });

    const replay = completePairing({
      session,
      sealed,
      ports,
      onTokens: async () => {},
      now: NOW + 2,
    });
    await expect(replay).rejects.toMatchObject({ code: "replay_rejected" });

    // Even a fresh session cannot reuse a claimed payload id via the guard.
    const session2 = makeSession();
    const replay2 = completePairing({
      session: session2,
      sealed,
      ports,
      onTokens: async () => {},
      now: NOW + 3,
    });
    await expect(replay2).rejects.toMatchObject({ code: "replay_rejected" });
    expect(sealedPayloadId(sealed)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("expires at exactly 10 minutes", async () => {
    const okSession = makeSession();
    await expect(
      completePairing({
        session: okSession,
        sealed: sealTokensFor(okSession),
        ports: openPorts(),
        onTokens: async () => {},
        now: NOW + PAIRING_TTL_MS - 1,
      }),
    ).resolves.toMatchObject({ status: "paired" });

    const expired = makeSession();
    await expect(
      completePairing({
        session: expired,
        sealed: sealTokensFor(expired),
        ports: openPorts(),
        onTokens: async () => {},
        now: NOW + PAIRING_TTL_MS,
      }),
    ).rejects.toMatchObject({ code: "pairing_expired" });
  });

  it("honors the rate-limit port", async () => {
    const session = makeSession();
    const ports: CompletePairingPorts = {
      rateLimiter: { allow: () => false },
      replayGuard: { claim: () => true },
    };
    await expect(
      completePairing({
        session,
        sealed: sealTokensFor(session),
        ports,
        onTokens: async () => {},
        now: NOW + 1,
      }),
    ).rejects.toMatchObject({ code: "rate_limited" });
  });

  it("rejects malformed payloads with a typed error and still zeroes the key", async () => {
    const session = makeSession();
    const sealed = hpkeSeal({
      recipientPublicKeyRaw: Buffer.from(session.request.clientPublicKey, "base64"),
      plaintext: Buffer.from(JSON.stringify({ unexpected: "shape" })),
      info: Buffer.from(session.sessionId, "utf8"),
    });
    await expect(
      completePairing({
        session,
        sealed,
        ports: openPorts(),
        onTokens: async () => {},
        now: NOW + 1,
      }),
    ).rejects.toMatchObject({ code: "payload_invalid" });
    expect(session.privateKeyRaw.every((b) => b === 0)).toBe(true);
  });

  it("never leaks tokens through session serialization after pairing", async () => {
    const session = makeSession();
    await completePairing({
      session,
      sealed: sealTokensFor(session),
      ports: openPorts(),
      onTokens: async () => {},
      now: NOW + 1,
    });
    const serialized = JSON.stringify({ session: describePairingSession(session) });
    expect(serialized).not.toContain(MCP_TOKEN);
    expect(serialized).not.toContain(MODEL_TOKEN);
  });
});
