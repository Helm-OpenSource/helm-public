// lib/member-gateway/gateway-session.ts
// Member Gateway M2d: gateway session anchor contract (stage-two fact
// promotion design §2.1, Owner 裁定记录 #1). Pure judgment + id shape only:
// no IO, no store, no clock — callers (lib/member-gateway/signal-store.
// service.ts, lib/member-gateway/prompt-response-store.service.ts) supply
// the session row and the instant, and own the actual open/reuse
// persistence decision (resolveGatewaySession, store-side).
//
// Session semantics (fixed window, row immutable in practice): a session
// is opened once per (workspaceId, memberRef, deviceRegistrationRef,
// clientId) tuple, on first challenge issuance. It stays "open" for a
// FIXED window measured from `openedAt` — there is deliberately no rolling
// "last activity" update that would extend the window on continued use.
// Once the fixed window elapses, the next challenge issuance opens a new
// session row rather than reusing/extending the old one; the old row is
// never mutated by this. `closedAt` exists in the schema for a future
// explicit-close capability, but no closer ships in this slice — every
// row this slice writes has `closedAt: null` for its entire life.
export const MEMBER_GATEWAY_SESSION_WINDOW_MS = 30 * 60_000;

function toEpochMs(value: Date | string): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

// Boundary contract (deliberately asymmetric, matching "fixed window from
// openedAt"): the instant AT `openedAt` is inside the window (inclusive
// lower bound — a session is open the moment it is opened), the instant AT
// `openedAt + MEMBER_GATEWAY_SESSION_WINDOW_MS` is NOT (exclusive upper
// bound — the window has fully elapsed by the time the clock reaches it,
// so the next issuance must open a new session rather than reuse this
// one). A session with a non-null `closedAt` is never open, regardless of
// where `nowMs` falls relative to the window.
export function isMemberGatewaySessionOpenAt(
  session: { openedAt: Date | string; closedAt: Date | string | null },
  nowMs: number,
): boolean {
  if (session.closedAt !== null) {
    return false;
  }
  const openedAtMs = toEpochMs(session.openedAt);
  if (!Number.isFinite(openedAtMs) || !Number.isFinite(nowMs)) {
    return false;
  }
  return (
    nowMs >= openedAtMs && nowMs < openedAtMs + MEMBER_GATEWAY_SESSION_WINDOW_MS
  );
}

// Caller-supplied id shape for MemberGatewaySession rows (mirrors the
// prefixed-id convention used elsewhere in the member gateway slice).
export function newMemberGatewaySessionId(): string {
  return `mgws-${crypto.randomUUID()}`;
}
