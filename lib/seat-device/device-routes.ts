import "server-only";

// lib/seat-device/device-routes.ts
// Seat desktop device authorization (D1 2a): the five device endpoints under
// /api/public-auth/seat-device (design v0.3 §4.2, §15). The route files only
// bind a path to an operation here.
//
// Order: deployment switch (off answers 404 with no body, before the body is
// read), then the request body as strict JSON, then the store. No cookie is
// read: the device is identified by its poll or refresh token alone.
//
// Every answer carries Cache-Control: no-store (server design §1A item 8),
// errors and the switched-off 404 included. Errors are {error:{code}} with
// the status from SEAT_DEVICE_ERROR_STATUS, so the three revoking codes are
// always 401 and a 403 never carries one (§2C.4). Every 429 and 503 carries
// Retry-After. A failure outside the closed set leaves as a closed 503 and a
// fixed log line: no request body, token, pairing code or error message.

import { NextResponse } from "next/server";
import { resolveTrustedPublicOrigin } from "@/lib/auth/trusted-public-origin";
import {
  SEAT_DEVICE_ERROR_STATUS,
  SEAT_DEVICE_POLL_REQUEST_SCHEMA,
  SEAT_DEVICE_REFRESH_REQUEST_SCHEMA,
  SEAT_DEVICE_VERIFICATION_PATH,
  isSeatDeviceAuthDeploymentEnabled,
  parseSeatDeviceAuthorizationRequest,
  parseSeatDeviceRequest,
  parseSeatDeviceRevokeRequest,
  readSeatDeviceTrustedProxyHops,
  resolveSeatDeviceTrustedSource,
  type SeatDeviceErrorCode,
} from "@/lib/seat-device/contract";
import {
  SeatDeviceAuthError,
  cancelSeatDeviceAuthorization,
  claimSeatDeviceAuthorization,
  requestSeatDeviceAuthorization,
} from "@/lib/seat-device/store-authorize";
import { refreshSeatDeviceToken, revokeSeatDeviceWithRefreshToken } from "@/lib/seat-device/store-tokens";

// The largest valid body is an authorization request (a 200-character device
// name); anything far above it is not a client of this contract.
const MAX_BODY_CHARACTERS = 4096;
const NO_STORE = { "Cache-Control": "no-store" } as const;

export type SeatDeviceOperation = "authorize" | "cancel" | "claim" | "refresh" | "revoke";

class InvalidBody extends Error {}

// The answer of a switched-off deployment and of any method other than POST:
// as if the route did not exist.
export function seatDeviceNotFound(): Response {
  return new Response(null, { status: 404, headers: NO_STORE });
}

function ok(body: object) {
  return NextResponse.json(body, { status: 200, headers: NO_STORE });
}

export function seatDeviceErrorResponse(code: SeatDeviceErrorCode, retryAfterSeconds: number | null = null): Response {
  const status = SEAT_DEVICE_ERROR_STATUS[code];
  const headers: Record<string, string> = { ...NO_STORE };
  if (status === 429 || status === 503) {
    // At least 1 second, also when the refusal carries no hint of its own (a
    // pairing-code redraw that ran out, a failure outside the closed set).
    headers["Retry-After"] = String(Math.max(1, Math.ceil(retryAfterSeconds ?? 0)));
  }
  return NextResponse.json({ error: { code } }, { status, headers });
}

async function readJson(request: Request): Promise<unknown> {
  const text = await request.text();
  if (text.length > MAX_BODY_CHARACTERS) throw new InvalidBody();
  try {
    return JSON.parse(text);
  } catch {
    throw new InvalidBody();
  }
}

function trustedSource(request: Request) {
  return resolveSeatDeviceTrustedSource(request.headers.get("x-forwarded-for"), readSeatDeviceTrustedProxyHops());
}

function rejectOnParse<T>(parsed: { ok: true; value: T } | { ok: false; code: SeatDeviceErrorCode }): T {
  if (!parsed.ok) throw new SeatDeviceAuthError(parsed.code);
  return parsed.value;
}

const OPERATIONS: Record<SeatDeviceOperation, (request: Request) => Promise<Response>> = {
  async authorize(request) {
    // Resolved before the store so a misconfigured origin leaves no pending
    // row behind; it is APP_URL, never the request's Host or forwarded host.
    let origin: string;
    try {
      origin = resolveTrustedPublicOrigin(process.env);
    } catch {
      logUnexpected("authorize", "public_origin_invalid");
      return seatDeviceErrorResponse("temporarily_unavailable");
    }
    const input = rejectOnParse(parseSeatDeviceAuthorizationRequest(await readJson(request)));
    const grant = await requestSeatDeviceAuthorization({ ...input, source: trustedSource(request) });
    // The member types the pairing code; the URL never carries it.
    return ok({ ...grant, verificationUrl: `${origin}${SEAT_DEVICE_VERIFICATION_PATH}` });
  },
  async cancel(request) {
    const input = rejectOnParse(parseSeatDeviceRequest(SEAT_DEVICE_POLL_REQUEST_SCHEMA, await readJson(request)));
    return ok(await cancelSeatDeviceAuthorization(input));
  },
  async claim(request) {
    const input = rejectOnParse(parseSeatDeviceRequest(SEAT_DEVICE_POLL_REQUEST_SCHEMA, await readJson(request)));
    return ok(await claimSeatDeviceAuthorization({ ...input, source: trustedSource(request) }));
  },
  async refresh(request) {
    const input = rejectOnParse(parseSeatDeviceRequest(SEAT_DEVICE_REFRESH_REQUEST_SCHEMA, await readJson(request)));
    return ok(await refreshSeatDeviceToken({ ...input, source: trustedSource(request) }));
  },
  async revoke(request) {
    const input = rejectOnParse(parseSeatDeviceRevokeRequest(await readJson(request)));
    await revokeSeatDeviceWithRefreshToken(input);
    return ok({});
  },
};

// Operator signal with fixed fields only: never the error message, which can
// quote SQL parameters, nor anything from the request.
function logUnexpected(operation: SeatDeviceOperation, reason: string) {
  console.error("[seat-device]", JSON.stringify({ event: "device_endpoint_failed", operation, reason }));
}

export async function handleSeatDeviceRequest(operation: SeatDeviceOperation, request: Request): Promise<Response> {
  if (!isSeatDeviceAuthDeploymentEnabled()) return seatDeviceNotFound();
  try {
    return await OPERATIONS[operation](request);
  } catch (error) {
    if (error instanceof InvalidBody) return seatDeviceErrorResponse("invalid_input");
    if (error instanceof SeatDeviceAuthError) return seatDeviceErrorResponse(error.code, error.retryAfterSeconds);
    // The class name and a driver code such as P2024 only, both fixed shapes.
    const name = error instanceof Error && /^[A-Za-z]{1,64}$/.test(error.name) ? error.name : "unknown";
    const driverCode = (error as { code?: unknown } | null)?.code;
    logUnexpected(operation, typeof driverCode === "string" && /^[A-Z0-9_]{1,16}$/.test(driverCode) ? `${name}:${driverCode}` : name);
    return seatDeviceErrorResponse("temporarily_unavailable");
  }
}
