import "server-only";

// lib/seat-device/revocation-observer.ts
// One optional observer told which seat devices were revoked, after the
// revoking transaction committed. Registered at most once, at the
// composition root; without a registration every revoke is unchanged.
//
// Each revoking path collects its notices inside its transaction closure and
// hands them out with the closure's result, so a rolled-back or retried
// attempt's notices are dropped with it. The observer is called without
// being awaited: its errors, rejections and running time never reach the
// revoking call. A process that stops after the commit and before the
// observer finishes loses that call; an extension that needs every revoke
// reconciles from the device table itself.

import type { SeatDeviceRevokeReason } from "@/lib/seat-device/contract";

export type SeatDeviceRevocationNotice = Readonly<{
  deviceId: string;
  workspaceId: string;
  userId: string;
  membershipId: string | null;
  reason: SeatDeviceRevokeReason;
  actorUserId: string | null;
  audiencePin: string | null;
}>;

export type SeatDeviceRevocationObserver = (notices: readonly SeatDeviceRevocationNotice[]) => unknown;

const key = Symbol.for("helm.seat-device-revocation-observer");
const store = globalThis as typeof globalThis & { [key]?: SeatDeviceRevocationObserver };

/** Composition-root registration only; never populated by request input. */
export function registerSeatDeviceRevocationObserver(observer: SeatDeviceRevocationObserver) {
  if (typeof observer !== "function" || (store[key] && store[key] !== observer)) {
    throw new Error("Seat device revocation observer already registered");
  }
  store[key] = observer;
}

/** Whether an observer is registered: a caller may skip collecting notices without one. */
export function isSeatDeviceRevocationObserved(): boolean {
  return store[key] !== undefined;
}

// The notice of a revoked row, or null for a row without a workspace or a
// user: the revocable states always carry both, and such a row is not
// audited either.
export function seatDeviceRevocationNotice(
  row: { id: string; workspaceId: string | null; userId: string | null; membershipId: string | null; audiencePin: string | null },
  reason: SeatDeviceRevokeReason,
  actorUserId: string | null,
): SeatDeviceRevocationNotice | null {
  if (!row.workspaceId || !row.userId) return null;
  return Object.freeze({
    deviceId: row.id,
    workspaceId: row.workspaceId,
    userId: row.userId,
    membershipId: row.membershipId,
    reason,
    actorUserId,
    audiencePin: row.audiencePin,
  });
}

function observerFailed(error: unknown) {
  const name = error instanceof Error && /^[A-Za-z]{1,64}$/.test(error.name) ? error.name : "unknown";
  console.error("[seat-device]", JSON.stringify({ event: "revocation_observer_failed", reason: name }));
}

/** Call only after the revoking transaction committed. Never throws, never waits. */
export function notifySeatDevicesRevoked(notices: readonly (SeatDeviceRevocationNotice | null)[]): void {
  const observer = store[key];
  if (!observer) return;
  const revoked = Object.freeze(notices.filter((notice): notice is SeatDeviceRevocationNotice => notice !== null));
  if (revoked.length === 0) return;
  void Promise.resolve()
    .then(() => observer(revoked))
    .catch(observerFailed);
}
