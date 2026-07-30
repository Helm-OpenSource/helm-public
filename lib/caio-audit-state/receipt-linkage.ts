// CAIO audit state — linked-receipt identifiers.
//
// The minimal audit receipt is a CLOSED set of exactly six fields and the
// primary store row has no extra columns, so anything that must be recorded
// about a dispatch beyond that set has to ride in the receipt identity itself.
// Two kinds of linked receipt exist, both derived deterministically from the
// original requestId so an auditor can recompute them:
//
//   replay marker   `<requestId>#caio-replay-<n>`
//       The n-th repeat dispatch of an already-recorded [workspace, requestId]
//       with byte-identical content. The original receipt is NOT duplicated;
//       the marker makes the extra dispatch durable and countable instead of
//       invisible, and the per-receipt cap makes it bounded.
//
//   fallback marker `<requestId>#caio-fb-<routeFingerprint>`
//       A fallback dispatch that executed on a DIFFERENT route than the one the
//       original receipt names. The fingerprint identifies the route actually
//       used (providerKey + endpointBaseUrl + upstreamModel), so the audit trail
//       can answer "which upstream served request X" even though the receipt
//       schema has no route field.
//
// Both derivations are length-bounded: the primary store column is
// VARCHAR(191), so a base requestId that would overflow is replaced by a
// collision-resistant digest of itself.

import { createHash } from "node:crypto";

/** Marker namespace owned by the audit gate; callers must never mint these. */
export const CAIO_REPLAY_MARKER_TOKEN = "#caio-replay-";
/** Marker namespace for a fallback dispatch that used a different route. */
export const CAIO_FALLBACK_MARKER_TOKEN = "#caio-fb-";
/** CaioAuditDispatchReceipt.requestId is VARCHAR(191). */
export const CAIO_RECEIPT_REQUEST_ID_STORAGE_MAX = 191;

/** Length-prefixed component encoding: no separator can ever be ambiguous. */
function lengthPrefixed(...parts: readonly string[]): string {
  return parts
    .map((part) => `${Buffer.byteLength(part, "utf8")}:${part}`)
    .join("");
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/**
 * Appends a marker suffix to a request id, keeping the result inside the
 * storage bound. When the base is too long it is replaced by a digest of
 * itself, which stays deterministic (recomputable by an auditor) and cannot
 * collide with another base by truncation.
 */
function withMarkerSuffix(requestId: string, suffix: string): string {
  const direct = `${requestId}${suffix}`;
  if (Buffer.byteLength(direct, "utf8") <= CAIO_RECEIPT_REQUEST_ID_STORAGE_MAX) {
    return direct;
  }
  return `caio-h${sha256Hex(requestId).slice(0, 32)}${suffix}`;
}

/** Deterministic id of the n-th repeat dispatch of one receipt (n >= 2). */
export function caioReplayMarkerRequestId(
  requestId: string,
  attempt: number,
): string {
  if (!Number.isInteger(attempt) || attempt < 2) {
    throw new Error(
      `caio replay marker attempt must be an integer >= 2, got ${String(attempt)}`,
    );
  }
  return withMarkerSuffix(requestId, `${CAIO_REPLAY_MARKER_TOKEN}${attempt}`);
}

/**
 * Stable fingerprint of an executed upstream route. Identity only — no
 * credential material and no request content ever enters this value.
 */
export function caioRouteFingerprint(route: {
  providerKey: string;
  endpointBaseUrl: string;
  upstreamModel: string;
}): string {
  return sha256Hex(
    lengthPrefixed(
      route.providerKey,
      route.endpointBaseUrl,
      route.upstreamModel,
    ),
  ).slice(0, 16);
}

/** Deterministic id of a fallback dispatch, naming the route it executed on. */
export function caioFallbackMarkerRequestId(input: {
  requestId: string;
  route: {
    providerKey: string;
    endpointBaseUrl: string;
    upstreamModel: string;
  };
}): string {
  return withMarkerSuffix(
    input.requestId,
    `${CAIO_FALLBACK_MARKER_TOKEN}${caioRouteFingerprint(input.route)}`,
  );
}

/** True when a request id sits in the gate-owned replay marker namespace. */
export function isCaioReplayMarkerRequestId(requestId: string): boolean {
  return requestId.includes(CAIO_REPLAY_MARKER_TOKEN);
}

/** True when a request id sits in either linked-marker namespace. */
export function isCaioLinkedMarkerRequestId(requestId: string): boolean {
  return (
    isCaioReplayMarkerRequestId(requestId) ||
    requestId.includes(CAIO_FALLBACK_MARKER_TOKEN)
  );
}
