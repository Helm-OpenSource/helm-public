/**
 * caio-connect pairing protocol — CEO-Mac pairing client core.
 *
 * Client side of the Studio pairing flow:
 *   1. verifyGatewayCa — the gateway's server certificate must chain to the
 *      approved Studio CA (via an injected verifier); anything else aborts.
 *   2. createPairingSession — ephemeral X25519 keypair + pending request with
 *      a 10-minute expiry.
 *   3. matchCode — 6 digits derived from sha256(transcript), displayed on
 *      both ends for the human to compare. The code has NO independent
 *      authorization power: gateway-side approval always requires the owner
 *      action port; a matching code alone can never approve a pairing.
 *   4. completePairing — receives an HPKE-sealed payload (RFC 9180 base mode
 *      shape: X25519 ECDH + HKDF-SHA256 + AES-256-GCM), decrypts the tokens
 *      IN MEMORY only, hands them to an injected sink, then zeroes the
 *      private key and plaintext buffers. Tokens never reach logs, argv,
 *      clipboard or serialized session state.
 *
 * Signing/notarization and real Keychain access are platform-adapter
 * concerns, out of scope here (see manifest.ts / config-writer.ts ports).
 */

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createPrivateKey,
  createPublicKey,
  diffieHellman,
  generateKeyPairSync,
  hkdfSync,
  randomUUID,
  type KeyObject,
} from "node:crypto";
import { z } from "zod";

export const PAIRING_TTL_MS = 10 * 60 * 1000;

const X25519_SPKI_PREFIX = Buffer.from("302a300506032b656e032100", "hex");
const X25519_PKCS8_PREFIX = Buffer.from("302e020100300506032b656e04220420", "hex");
const HPKE_SALT = Buffer.from("caio-connect/hpke-v1", "utf8");
const HPKE_INFO_PREFIX = Buffer.from("caio-connect/pairing-v1", "utf8");

export type PairingErrorCode =
  | "gateway_ca_untrusted"
  | "pairing_expired"
  | "replay_rejected"
  | "rate_limited"
  | "decrypt_failed"
  | "payload_invalid";

export class PairingError extends Error {
  readonly code: PairingErrorCode;

  constructor(code: PairingErrorCode, message: string) {
    super(message);
    this.name = "PairingError";
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Key helpers (raw 32-byte X25519 <-> node KeyObject)
// ---------------------------------------------------------------------------

export function rawX25519PublicKey(key: KeyObject): Buffer {
  const der = key.export({ format: "der", type: "spki" }) as Buffer;
  return Buffer.from(der.subarray(der.length - 32));
}

export function publicKeyFromRaw(raw: Buffer): KeyObject {
  return createPublicKey({
    key: Buffer.concat([X25519_SPKI_PREFIX, raw]),
    format: "der",
    type: "spki",
  });
}

export function privateKeyFromRaw(raw: Buffer): KeyObject {
  return createPrivateKey({
    key: Buffer.concat([X25519_PKCS8_PREFIX, raw]),
    format: "der",
    type: "pkcs8",
  });
}

// ---------------------------------------------------------------------------
// Gateway CA verification
// ---------------------------------------------------------------------------

export interface GatewayCaVerifierPort {
  /** Platform adapter: does the presented chain end at the approved Studio CA? */
  verifyChain(serverCertificateRef: string): Promise<{
    chainsToApprovedCa: boolean;
    caSubjectRef?: string;
  }>;
}

export async function verifyGatewayCa(
  serverCertificateRef: string,
  port: GatewayCaVerifierPort,
): Promise<{ caSubjectRef?: string }> {
  const result = await port.verifyChain(serverCertificateRef);
  if (!result.chainsToApprovedCa) {
    throw new PairingError(
      "gateway_ca_untrusted",
      "server certificate does not chain to the approved Studio CA; aborting pairing",
    );
  }
  return { caSubjectRef: result.caSubjectRef };
}

// ---------------------------------------------------------------------------
// Pairing session
// ---------------------------------------------------------------------------

export interface PairingRequest {
  clientType: "codex" | "workbuddy";
  user: string;
  deviceRef: string;
  /** base64 of the raw 32-byte X25519 client public key. */
  clientPublicKey: string;
  /** The client's private (RFC1918) LAN address — set by the transport. */
  sourceIp: string;
}

export interface PairingSession {
  sessionId: string;
  request: PairingRequest;
  createdAt: number;
  expiresAt: number;
  used: boolean;
  /** Non-enumerable raw private key buffer; zeroed after completePairing. */
  privateKeyRaw: Buffer;
}

export interface CreatePairingSessionInput {
  clientType: PairingRequest["clientType"];
  user: string;
  deviceRef: string;
  sourceIp: string;
  now?: number;
}

export function createPairingSession(input: CreatePairingSessionInput): PairingSession {
  const now = input.now ?? Date.now();
  const { publicKey, privateKey } = generateKeyPairSync("x25519");
  const pkcs8 = privateKey.export({ format: "der", type: "pkcs8" }) as Buffer;
  const privateKeyRaw = Buffer.from(pkcs8.subarray(pkcs8.length - 32));
  pkcs8.fill(0);

  const session: PairingSession = {
    sessionId: randomUUID(),
    request: {
      clientType: input.clientType,
      user: input.user,
      deviceRef: input.deviceRef,
      clientPublicKey: rawX25519PublicKey(publicKey).toString("base64"),
      sourceIp: input.sourceIp,
    },
    createdAt: now,
    expiresAt: now + PAIRING_TTL_MS,
    used: false,
    privateKeyRaw,
  };
  // Keep key material out of JSON.stringify / console.log of the session.
  Object.defineProperty(session, "privateKeyRaw", {
    value: privateKeyRaw,
    enumerable: false,
    writable: false,
    configurable: false,
  });
  return session;
}

/**
 * 6-digit match code derived from the pairing transcript. Displayed on both
 * ends for human comparison ONLY — it carries no authorization power.
 */
export function deriveMatchCode(
  session: Pick<PairingSession, "sessionId" | "request">,
  serverPublicKeyBase64: string,
): string {
  const transcript = JSON.stringify({
    sessionId: session.sessionId,
    request: session.request,
    serverPublicKey: serverPublicKeyBase64,
  });
  const digest = createHash("sha256").update(transcript, "utf8").digest();
  const code = digest.readUInt32BE(0) % 1_000_000;
  return code.toString().padStart(6, "0");
}

export interface OwnerApprovalPort {
  /** The ONLY thing that can approve a pending pairing on the gateway. */
  approve(sessionId: string): Promise<{ approved: boolean; receiptRef?: string }>;
}

/**
 * Reference gateway-side approval contract (kept here so the client and the
 * gateway agree on it, and so tests can pin the rule): even a confirmed match
 * code approves NOTHING without an explicit owner action via the port.
 */
export async function gatewayApprovePairing(input: {
  sessionId: string;
  matchCodeConfirmed: boolean;
  ownerApproval: OwnerApprovalPort;
}): Promise<{ approved: boolean; receiptRef?: string }> {
  if (!input.matchCodeConfirmed) {
    return { approved: false };
  }
  const decision = await input.ownerApproval.approve(input.sessionId);
  if (!decision.approved) {
    return { approved: false };
  }
  return { approved: true, receiptRef: decision.receiptRef };
}

// ---------------------------------------------------------------------------
// HPKE-style seal/open (X25519 ECDH + HKDF-SHA256 + AES-256-GCM, base mode)
// ---------------------------------------------------------------------------

export interface SealedPayload {
  /** base64 raw ephemeral X25519 public key (the HPKE "enc"). */
  enc: string;
  /** base64 ciphertext || 16-byte GCM tag. */
  ciphertext: string;
}

function deriveAead(
  sharedSecret: Buffer,
  encRaw: Buffer,
  recipientPublicRaw: Buffer,
  info: Buffer,
): { key: Buffer; iv: Buffer } {
  const okm = Buffer.from(
    hkdfSync(
      "sha256",
      sharedSecret,
      HPKE_SALT,
      Buffer.concat([HPKE_INFO_PREFIX, encRaw, recipientPublicRaw, info]),
      44,
    ),
  );
  return { key: okm.subarray(0, 32), iv: okm.subarray(32, 44) };
}

export function hpkeSeal(input: {
  recipientPublicKeyRaw: Buffer;
  plaintext: Buffer;
  info?: Buffer;
}): SealedPayload {
  const info = input.info ?? Buffer.alloc(0);
  const eph = generateKeyPairSync("x25519");
  const sharedSecret = diffieHellman({
    privateKey: eph.privateKey,
    publicKey: publicKeyFromRaw(input.recipientPublicKeyRaw),
  });
  const encRaw = rawX25519PublicKey(eph.publicKey);
  const { key, iv } = deriveAead(sharedSecret, encRaw, input.recipientPublicKeyRaw, info);
  sharedSecret.fill(0);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(info);
  const body = Buffer.concat([cipher.update(input.plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  key.fill(0);
  return {
    enc: encRaw.toString("base64"),
    ciphertext: Buffer.concat([body, tag]).toString("base64"),
  };
}

export function hpkeOpen(input: {
  recipientPrivateKeyRaw: Buffer;
  sealed: SealedPayload;
  info?: Buffer;
}): Buffer {
  const info = input.info ?? Buffer.alloc(0);
  const encRaw = Buffer.from(input.sealed.enc, "base64");
  const packed = Buffer.from(input.sealed.ciphertext, "base64");
  if (encRaw.length !== 32 || packed.length < 16) {
    throw new PairingError("decrypt_failed", "malformed sealed payload");
  }
  const recipientPublicRaw = rawX25519PublicKey(
    createPublicKey(privateKeyFromRaw(input.recipientPrivateKeyRaw)),
  );
  const sharedSecret = diffieHellman({
    privateKey: privateKeyFromRaw(input.recipientPrivateKeyRaw),
    publicKey: publicKeyFromRaw(encRaw),
  });
  const { key, iv } = deriveAead(sharedSecret, encRaw, recipientPublicRaw, info);
  sharedSecret.fill(0);
  const body = packed.subarray(0, packed.length - 16);
  const tag = packed.subarray(packed.length - 16);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAAD(info);
  decipher.setAuthTag(tag);
  try {
    const plaintext = Buffer.concat([decipher.update(body), decipher.final()]);
    return plaintext;
  } catch {
    throw new PairingError("decrypt_failed", "sealed payload failed authentication");
  } finally {
    key.fill(0);
  }
}

// ---------------------------------------------------------------------------
// completePairing
// ---------------------------------------------------------------------------

const pairedTokensSchema = z.object({
  mcpToken: z.string().min(1),
  modelToken: z.string().min(1),
});

export type PairedTokens = z.infer<typeof pairedTokensSchema>;

export interface RateLimiterPort {
  /** Token-bucket style gate keyed by session; false → rejected. */
  allow(key: string): boolean;
}

export interface ReplayGuardPort {
  /** Claims a payload id exactly once; false when already seen. */
  claim(payloadId: string): boolean;
}

export interface CompletePairingPorts {
  rateLimiter: RateLimiterPort;
  replayGuard: ReplayGuardPort;
}

export interface CompletePairingResult {
  status: "paired";
  sessionId: string;
  completedAt: string;
}

export function sealedPayloadId(sealed: SealedPayload): string {
  return createHash("sha256")
    .update(sealed.enc, "utf8")
    .update(".", "utf8")
    .update(sealed.ciphertext, "utf8")
    .digest("hex");
}

/**
 * Complete a pairing: open the sealed payload, hand the tokens to `onTokens`
 * (e.g. the config writer) and zero all sensitive buffers afterwards. The
 * returned result NEVER contains token values.
 */
export async function completePairing(input: {
  session: PairingSession;
  sealed: SealedPayload;
  ports: CompletePairingPorts;
  onTokens: (tokens: PairedTokens) => Promise<void>;
  now?: number;
}): Promise<CompletePairingResult> {
  const { session, sealed, ports } = input;
  const now = input.now ?? Date.now();

  if (!ports.rateLimiter.allow(session.sessionId)) {
    throw new PairingError("rate_limited", "pairing attempts rate-limited");
  }
  if (now >= session.expiresAt) {
    throw new PairingError("pairing_expired", "pairing session expired (10 minute limit)");
  }
  if (session.used || !ports.replayGuard.claim(sealedPayloadId(sealed))) {
    throw new PairingError("replay_rejected", "sealed payload already consumed");
  }
  session.used = true;

  const plaintext = hpkeOpen({
    recipientPrivateKeyRaw: session.privateKeyRaw,
    sealed,
    info: Buffer.from(session.sessionId, "utf8"),
  });
  try {
    let parsed: unknown;
    try {
      parsed = JSON.parse(plaintext.toString("utf8"));
    } catch {
      throw new PairingError("payload_invalid", "sealed payload is not JSON");
    }
    const tokens = pairedTokensSchema.safeParse(parsed);
    if (!tokens.success) {
      throw new PairingError("payload_invalid", "sealed payload has unexpected shape");
    }
    await input.onTokens(tokens.data);
  } finally {
    // Zero sensitive material regardless of downstream success.
    plaintext.fill(0);
    session.privateKeyRaw.fill(0);
  }

  return {
    status: "paired",
    sessionId: session.sessionId,
    completedAt: new Date(now).toISOString(),
  };
}

/** Log/display-safe view of a session — no key material, no tokens. */
export function describePairingSession(session: PairingSession): Record<string, unknown> {
  return {
    sessionId: session.sessionId,
    clientType: session.request.clientType,
    user: session.request.user,
    deviceRef: session.request.deviceRef,
    sourceIp: session.request.sourceIp,
    createdAt: new Date(session.createdAt).toISOString(),
    expiresAt: new Date(session.expiresAt).toISOString(),
    used: session.used,
  };
}
