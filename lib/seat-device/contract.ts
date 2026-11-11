// lib/seat-device/contract.ts
// Seat desktop device authorization (D1) contract: a device-initiated sign-in
// for the seat desktop client. The client requests authorization, a member
// enters the pairing code on the website and approves, the client polls to
// claim a short-lived access token plus a rotating refresh token.
//
// Pure judgment only: no database, no clock (callers pass `now`). The only
// side effect here is drawing randomness for codes and tokens.
//
// Security model (design v0.3 §0, §6.3): token secrecy plus revocable server
// state. A stolen token equals a stolen device until it is revoked or the
// credential reaches its absolute expiry; only hashes are ever stored.

import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import type { WorkspaceRole } from "@prisma/client";
import { z } from "zod";
import { normalizeDeviceLabel } from "@/lib/member-mcp/contract";

export const SEAT_DEVICE_CLIENT_TYPES = ["seat_desktop"] as const;
export type SeatDeviceClientType = (typeof SEAT_DEVICE_CLIENT_TYPES)[number];

export const SEAT_DEVICE_PUBLIC_AUTH_BASE_PATH = "/api/public-auth/seat-device";
// The verification URL never carries the pairing code: the member types it.
export const SEAT_DEVICE_VERIFICATION_PATH = "/device";

export const SEAT_DEVICE_REQUEST_TTL_SECONDS = 600;
export const SEAT_DEVICE_POLL_INTERVAL_SECONDS = 5;
export const SEAT_DEVICE_ACCESS_TOKEN_TTL_SECONDS = 900;
// Absolute from approval; a refresh never extends it (owner default Q2).
export const SEAT_DEVICE_CREDENTIAL_TTL_DAYS = 30;
// One window for the access-token overlap after rotation, the single grace
// re-mint of a lost refresh response and the single re-claim.
export const SEAT_DEVICE_ROTATION_GRACE_SECONDS = 60;
export const SEAT_DEVICE_STEP_UP_MAX_SESSION_AGE_SECONDS = 600;
export const SEAT_DEVICE_MAX_ACTIVE_PER_MEMBER = 3;
export const SEAT_DEVICE_REFRESH_LIMIT_PER_MINUTE = 6;
export const SEAT_DEVICE_PENDING_LIMIT_PER_BUCKET_WINDOW = 10;
export const SEAT_DEVICE_PENDING_BUCKET_WINDOW_SECONDS = 600;
export const SEAT_DEVICE_PENDING_LIMIT_PER_BUCKET = 200;
export const SEAT_DEVICE_PENDING_LIMIT_GLOBAL = 300;
// Wrong pairing codes per account: 8 in 15 minutes, then locked 15 minutes.
export const SEAT_DEVICE_CODE_ENTRY_MAX_FAILURES = 8;
export const SEAT_DEVICE_CODE_ENTRY_WINDOW_SECONDS = 900;
export const SEAT_DEVICE_CODE_ENTRY_LOCK_SECONDS = 900;
// Wrong pairing codes per trusted address bucket (one office shares it):
// 30 in 15 minutes, then the bucket is locked 15 minutes (owner ruling
// 2026-11-11; the per-account limit stays 8).
export const SEAT_DEVICE_CODE_ENTRY_MAX_FAILURES_PER_SOURCE_BUCKET = 30;
// Pairing-code unique collisions are retried this many times, then 503.
export const SEAT_DEVICE_PAIRING_CODE_MAX_ATTEMPTS = 5;

const DAY_MS = 24 * 60 * 60 * 1000;

// Stored lifecycle states. "expired" is derived from the clock, never stored.
export const SEAT_DEVICE_STORED_STATUSES = [
  "pending",
  "cancelled",
  "approved",
  "rejected",
  "active",
  "revoked",
] as const;
export type SeatDeviceStoredStatus = (typeof SEAT_DEVICE_STORED_STATUSES)[number];
export type SeatDeviceEffectiveStatus = SeatDeviceStoredStatus | "expired";

export const SEAT_DEVICE_REVOKE_REASONS = [
  "self",
  "admin",
  "device_logout",
  "client_cancelled",
  "refresh_reuse",
  "password_reset",
  "membership_inactive",
  "seat_inactive",
  // The client refused a claim answer it could not read (design v0.3.2).
  "client_rejected",
] as const;
export type SeatDeviceRevokeReason = (typeof SEAT_DEVICE_REVOKE_REASONS)[number];

// The only reasons a device may state when revoking its own credential;
// device_logout when omitted. The server never infers a reason itself.
export const SEAT_DEVICE_CLIENT_REVOKE_REASONS = [
  "device_logout",
  "client_cancelled",
  "client_rejected",
] as const satisfies readonly SeatDeviceRevokeReason[];
export type SeatDeviceClientRevokeReason = (typeof SEAT_DEVICE_CLIENT_REVOKE_REASONS)[number];
export const SEAT_DEVICE_DEFAULT_CLIENT_REVOKE_REASON: SeatDeviceClientRevokeReason = "device_logout";

// Answer of the device's cancel call (design v0.3.2): never says whether a
// request exists; a wrong poll token reads "expired".
export const SEAT_DEVICE_CANCEL_STATUSES = ["cancelled", "claimed", "rejected", "expired", "revoked"] as const;
export type SeatDeviceCancelStatus = (typeof SEAT_DEVICE_CANCEL_STATUSES)[number];

export const SEAT_DEVICE_TOKEN_HISTORY_KINDS = ["refresh", "access", "poll"] as const;
export type SeatDeviceTokenKind = (typeof SEAT_DEVICE_TOKEN_HISTORY_KINDS)[number];

// Error body is {error:{code}}; the value is the HTTP status.
export const SEAT_DEVICE_ERROR_STATUS = {
  invalid_input: 400,
  client_not_supported: 400,
  poll_token_invalid: 403,
  token_revoked: 401,
  device_revoked: 401,
  account_disabled: 401,
  device_expired: 401,
  workspace_not_enabled: 403,
  too_many_devices: 409,
  slow_down: 429,
  rate_limited: 429,
  // Website (member session) side.
  pairing_code_invalid: 400,
  forbidden: 403,
  reauthentication_required: 403,
  temporarily_unavailable: 503,
} as const;
export type SeatDeviceErrorCode = keyof typeof SEAT_DEVICE_ERROR_STATUS;

// 32 random bytes in base64url are exactly 43 characters.
const TOKEN_PREFIXES: Record<SeatDeviceTokenKind, string> = {
  poll: "hsdp_",
  access: "hsda_",
  refresh: "hsdr_",
};
export const SEAT_DEVICE_POLL_TOKEN_PATTERN = /^hsdp_[A-Za-z0-9_-]{43}$/;
export const SEAT_DEVICE_ACCESS_TOKEN_PATTERN = /^hsda_[A-Za-z0-9_-]{43}$/;
export const SEAT_DEVICE_REFRESH_TOKEN_PATTERN = /^hsdr_[A-Za-z0-9_-]{43}$/;

export function hashSeatDeviceToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

// Constant-time comparison of two stored-form hashes (hex sha256).
export function seatDeviceHashesEqual(left: string | null | undefined, right: string | null | undefined): boolean {
  if (!left || !right || left.length !== right.length) return false;
  return timingSafeEqual(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

export function mintSeatDeviceToken(kind: SeatDeviceTokenKind): { token: string; tokenHash: string } {
  const token = `${TOKEN_PREFIXES[kind]}${randomBytes(32).toString("base64url")}`;
  return { token, tokenHash: hashSeatDeviceToken(token) };
}

// Consonants only: no vowels (no accidental words), no 0/O or 1/I confusion.
// 20^8 ≈ 2^34.6 codes.
export const SEAT_DEVICE_PAIRING_CODE_ALPHABET = "BCDFGHJKLMNPQRSTVWXZ";
export const SEAT_DEVICE_PAIRING_CODE_LENGTH = 8;
const PAIRING_CODE_PATTERN = new RegExp(
  `^[${SEAT_DEVICE_PAIRING_CODE_ALPHABET}]{${SEAT_DEVICE_PAIRING_CODE_LENGTH}}$`,
);

// crypto.randomInt draws by rejection sampling, so every letter is equally
// likely; never derive a letter as `byte % 20` (biased).
export function generateSeatDevicePairingCode(): string {
  let code = "";
  for (let index = 0; index < SEAT_DEVICE_PAIRING_CODE_LENGTH; index += 1) {
    code += SEAT_DEVICE_PAIRING_CODE_ALPHABET[randomInt(SEAT_DEVICE_PAIRING_CODE_ALPHABET.length)];
  }
  return code;
}

export function formatSeatDevicePairingCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

// Accepts what a member types: any case, spaces, the display hyphen.
export function normalizeSeatDevicePairingCode(input: string): string | null {
  const code = input.toUpperCase().replace(/[\s-]/g, "");
  return PAIRING_CODE_PATTERN.test(code) ? code : null;
}

// Hash of the normalized code: the displayed and typed forms hash alike.
// Unpeppered by decision (D1): the code lives 10 minutes, its hash is cleared
// once decided and code entry is rate limited, so the offline window is small.
export function hashSeatDevicePairingCode(input: string): string | null {
  const code = normalizeSeatDevicePairingCode(input);
  return code === null ? null : createHash("sha256").update(code, "utf8").digest("hex");
}

export function effectiveSeatDeviceStatus(
  row: { status: string; requestExpiresAt: Date; expiresAt: Date | null },
  now: Date,
): SeatDeviceEffectiveStatus | null {
  const status = (SEAT_DEVICE_STORED_STATUSES as readonly string[]).includes(row.status)
    ? (row.status as SeatDeviceStoredStatus)
    : null;
  // An approved request must still be claimed within the request lifetime.
  if (status === "pending" || status === "approved") {
    return row.requestExpiresAt.getTime() > now.getTime() ? status : "expired";
  }
  if (status === "active") {
    return row.expiresAt && row.expiresAt.getTime() > now.getTime() ? "active" : "expired";
  }
  return status;
}

// Claim answer for a request that has not produced tokens. The client's closed
// set has no "cancelled"; the client cancelled it itself, so it reads expired.
export function seatDeviceUnclaimedPollStatus(
  status: SeatDeviceEffectiveStatus | null,
): "pending" | "rejected" | "expired" | null {
  if (status === "pending" || status === "rejected" || status === "expired") return status;
  return status === "cancelled" ? "expired" : null;
}

export function seatDeviceCredentialExpiresAt(approvedAt: Date): Date {
  return new Date(approvedAt.getTime() + SEAT_DEVICE_CREDENTIAL_TTL_DAYS * DAY_MS);
}

// After rotation the previous access token stays usable for in-flight calls,
// never past its own expiry and never more than the grace window.
export function seatDevicePreviousAccessExpiresAt(previousExpiresAt: Date, rotatedAt: Date): Date {
  return new Date(
    Math.min(previousExpiresAt.getTime(), rotatedAt.getTime() + SEAT_DEVICE_ROTATION_GRACE_SECONDS * 1000),
  );
}

// Runtime gate: the deployment switch AND the workspace flag must both be on.
export function isSeatDeviceAuthDeploymentEnabled(
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return env.HELM_SEAT_DEVICE_AUTH_ENABLED === "true";
}

export function isSeatDeviceWorkspaceEnabled(
  featureFlagsJson: string | null | undefined,
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  if (!isSeatDeviceAuthDeploymentEnabled(env)) return false;
  try {
    const flags: unknown = JSON.parse(featureFlagsJson ?? "{}");
    return Boolean(flags && typeof flags === "object" && (flags as Record<string, unknown>).seatDesktop === true);
  } catch {
    return false;
  }
}

// Number of proxies in front of the app that append to x-forwarded-for. Any
// value other than a small non-negative integer means 0: source untrusted.
export function readSeatDeviceTrustedProxyHops(
  env: Readonly<Record<string, string | undefined>> = process.env,
): number {
  const value = env.HELM_SEAT_DEVICE_TRUSTED_PROXY_HOPS?.trim() ?? "";
  return /^[0-9]$/.test(value) ? Number(value) : 0;
}

// The client address as seen by the outermost trusted proxy: the Nth entry
// from the right. Entries further left are client-supplied and never used.
export function resolveSeatDeviceTrustedSource(forwardedFor: string | null | undefined, hops: number): string | null {
  if (hops < 1 || !forwardedFor) return null;
  const entries = forwardedFor.split(",").map((entry) => entry.trim());
  if (entries.length < hops) return null;
  const candidate = entries[entries.length - hops];
  return isIP(candidate) === 0 ? null : candidate;
}

function ipv6Groups(address: string): number[] {
  let text = address.split("%")[0].toLowerCase();
  const dottedAt = text.lastIndexOf(":");
  if (text.includes(".")) {
    const octets = text.slice(dottedAt + 1).split(".").map(Number);
    text = `${text.slice(0, dottedAt + 1)}${((octets[0] << 8) | octets[1]).toString(16)}:${((octets[2] << 8) | octets[3]).toString(16)}`;
  }
  const [head, tail] = text.split("::");
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const fill = tail === undefined ? [] : new Array<string>(8 - left.length - right.length).fill("0");
  return [...left, ...fill, ...right].map((group) => Number.parseInt(group, 16));
}

// Rate-limit bucket: IPv4 /24, IPv6 /48 (IPv4-mapped IPv6 counts as IPv4).
export function seatDeviceSourceBucket(ip: string): string | null {
  const family = isIP(ip);
  if (family === 4) return `${ip.split(".").slice(0, 3).join(".")}.0/24`;
  if (family !== 6) return null;
  const groups = ipv6Groups(ip);
  if (groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff) {
    return `${groups[6] >> 8}.${groups[6] & 0xff}.${groups[7] >> 8}.0/24`;
  }
  return `${groups.slice(0, 3).map((group) => group.toString(16)).join(":")}::/48`;
}

export type SeatDeviceIdentity = {
  subjectId: string;
  kind: "member";
  displayName: string;
  workspace: { id: string; name: string };
  roles: WorkspaceRole[];
};

// Members only in D1 (owner default Q4). Same subject namespace as member MCP.
export function seatDeviceIdentity(input: {
  userId: string;
  displayName: string;
  workspace: { id: string; name: string };
  role: WorkspaceRole;
}): SeatDeviceIdentity {
  return {
    subjectId: `user:${input.userId}`,
    kind: "member",
    displayName: input.displayName,
    workspace: { id: input.workspace.id, name: input.workspace.name },
    roles: [input.role],
  };
}

// Request bodies. Every schema is strict: an unknown field is invalid_input.
const requestIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,191}$/);
const pollTokenSchema = z.string().regex(SEAT_DEVICE_POLL_TOKEN_PATTERN);
const refreshTokenSchema = z.string().regex(SEAT_DEVICE_REFRESH_TOKEN_PATTERN);
const pairingCodeSchema = z.string().max(32).transform((value, context) => {
  const code = normalizeSeatDevicePairingCode(value);
  if (code === null) context.addIssue({ code: "custom", message: "pairing code" });
  return code ?? "";
});

const authorizationRequestSchema = z
  .object({
    deviceName: z.string().max(200),
    clientType: z.string().max(64),
    clientVersion: z.string().regex(/^[0-9A-Za-z][0-9A-Za-z.+_-]{0,39}$/),
  })
  .strict();

export const SEAT_DEVICE_POLL_REQUEST_SCHEMA = z.object({ requestId: requestIdSchema, pollToken: pollTokenSchema }).strict();
export const SEAT_DEVICE_REFRESH_REQUEST_SCHEMA = z.object({ refreshToken: refreshTokenSchema }).strict();
const revokeRequestSchema = z.object({ refreshToken: refreshTokenSchema, reason: z.unknown().optional() }).strict();
export const SEAT_DEVICE_LOOKUP_REQUEST_SCHEMA = z.object({ pairingCode: pairingCodeSchema }).strict();
export const SEAT_DEVICE_DECISION_REQUEST_SCHEMA = z
  .object({ requestId: requestIdSchema, pairingCode: pairingCodeSchema })
  .strict();

export type SeatDeviceParseResult<T> = { ok: true; value: T } | { ok: false; code: SeatDeviceErrorCode };

export function parseSeatDeviceRequest<T>(schema: z.ZodType<T>, body: unknown): SeatDeviceParseResult<T> {
  const parsed = schema.safeParse(body);
  return parsed.success ? { ok: true, value: parsed.data } : { ok: false, code: "invalid_input" };
}

export function parseSeatDeviceAuthorizationRequest(
  body: unknown,
): SeatDeviceParseResult<{ deviceLabel: string; clientType: SeatDeviceClientType; clientVersion: string }> {
  const parsed = authorizationRequestSchema.safeParse(body);
  if (!parsed.success) return { ok: false, code: "invalid_input" };
  const deviceLabel = normalizeDeviceLabel(parsed.data.deviceName);
  if (deviceLabel === null) return { ok: false, code: "invalid_input" };
  if (!(SEAT_DEVICE_CLIENT_TYPES as readonly string[]).includes(parsed.data.clientType)) {
    return { ok: false, code: "client_not_supported" };
  }
  return {
    ok: true,
    value: {
      deviceLabel,
      clientType: parsed.data.clientType as SeatDeviceClientType,
      clientVersion: parsed.data.clientVersion,
    },
  };
}

export function parseSeatDeviceRevokeRequest(
  body: unknown,
): SeatDeviceParseResult<{ refreshToken: string; reason: SeatDeviceClientRevokeReason }> {
  const parsed = revokeRequestSchema.safeParse(body);
  if (!parsed.success) return { ok: false, code: "invalid_input" };
  const { refreshToken, reason } = parsed.data;
  if (reason === undefined) return { ok: true, value: { refreshToken, reason: SEAT_DEVICE_DEFAULT_CLIENT_REVOKE_REASON } };
  if (!(SEAT_DEVICE_CLIENT_REVOKE_REASONS as readonly unknown[]).includes(reason)) {
    // Client bug: 400. Every token-state outcome of revoke stays 200 {} (no probing).
    return { ok: false, code: "invalid_input" };
  }
  return { ok: true, value: { refreshToken, reason: reason as SeatDeviceClientRevokeReason } };
}

// Audit details of a revoke: never a token or hash. tokenUsedAfterClaim tells
// whether the device used its credential after claiming it (for example a
// client_cancelled revoke of a late approval that was never used).
export type SeatDeviceRevokeAuditDetails = {
  deviceId: string;
  reason: SeatDeviceRevokeReason;
  tokenUsedAfterClaim: boolean;
};
