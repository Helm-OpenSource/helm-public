import "server-only";

// lib/seat-device/website-routes.ts
// Seat desktop device authorization (D1 2b): the member-session side of
// pairing on /api/settings/seat-devices (design v0.3 §4.3). A signed-in
// member looks a pairing code up, then rejects it or approves it with the
// password typed again (server design §2C.3): the password is verified and
// the device approved in one request, so no proof of it is stored or sent.
// GET lists the member's devices (OWNER/ADMIN: every device of the
// workspace); the revoke action removes one (store-tokens.ts rules).
//
// Order: deployment switch (off answers 404 before anything is read), then
// the cross-site guard (Origin equal to APP_URL's origin and sec-fetch-site
// same-origin; the body must be application/json), then the member session,
// then the strict body, then the store. Answers follow the device endpoints
// (device-routes.ts): no-store, {error:{code}}, Retry-After on 429 and 503,
// and a fixed log line for anything outside the closed set, never the
// password, the pairing code or the body.

import { Prisma, WorkspaceRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { resolveTrustedPublicOrigin } from "@/lib/auth/trusted-public-origin";
import { db } from "@/lib/db";
import {
  SEAT_DEVICE_WEBSITE_ACTION_SCHEMA,
  effectiveSeatDeviceStatus,
  isSeatDeviceAuthDeploymentEnabled,
  parseSeatDeviceRequest,
  readSeatDeviceTrustedProxyHops,
  resolveSeatDeviceTrustedSource,
} from "@/lib/seat-device/contract";
import { InvalidBody, readJson, seatDeviceErrorResponse, seatDeviceNotFound } from "@/lib/seat-device/device-routes";
import {
  SeatDeviceAuthError,
  assertSeatDeviceApprovalPreconditions,
  decideSeatDeviceAuthorization,
  loadMemberContext,
  lookupSeatDeviceAuthorization,
  verifySeatDeviceApprovalPassword,
} from "@/lib/seat-device/store-authorize";
import { revokeSeatDeviceByMember } from "@/lib/seat-device/store-tokens";

export type SeatDeviceWebsiteSession = { authSessionId: string; userId: string } | null;

const NO_STORE = { "Cache-Control": "no-store" } as const;

function logUnexpected(reason: string) {
  console.error("[seat-device]", JSON.stringify({ event: "website_endpoint_failed", reason }));
}

async function answer(request: Request, resolveSession: () => Promise<SeatDeviceWebsiteSession>): Promise<Response> {
  let origin: string;
  try {
    origin = resolveTrustedPublicOrigin(process.env);
  } catch {
    logUnexpected("public_origin_invalid");
    return seatDeviceErrorResponse("temporarily_unavailable");
  }
  if (request.headers.get("origin") !== origin || request.headers.get("sec-fetch-site") !== "same-origin") {
    return seatDeviceErrorResponse("forbidden");
  }
  const session = await resolveSession();
  if (!session) return seatDeviceErrorResponse("reauthentication_required");
  const parsed = parseSeatDeviceRequest(SEAT_DEVICE_WEBSITE_ACTION_SCHEMA, await readJson(request));
  if (!parsed.ok) return seatDeviceErrorResponse(parsed.code);
  const body = parsed.value;
  const member = {
    authSessionId: session.authSessionId,
    userId: session.userId,
    source: resolveSeatDeviceTrustedSource(request.headers.get("x-forwarded-for"), readSeatDeviceTrustedProxyHops()),
  };
  if (body.action === "revoke") {
    return NextResponse.json(await revokeSeatDeviceByMember({ ...member, deviceId: body.deviceId }), { headers: NO_STORE });
  }
  if (body.action === "lookup") {
    return NextResponse.json(await lookupSeatDeviceAuthorization({ ...member, pairingCode: body.pairingCode }), { headers: NO_STORE });
  }
  let passwordProof = null;
  if (body.action === "approve") {
    // Session type, switches and workspace first: only then is the password
    // judged (and a wrong one counted).
    await assertSeatDeviceApprovalPreconditions({ ...member, expectedWorkspaceId: body.workspaceId });
    passwordProof = await verifySeatDeviceApprovalPassword({ userId: session.userId, password: body.password });
  }
  const decided = await decideSeatDeviceAuthorization({
    ...member,
    requestId: body.requestId,
    pairingCode: body.pairingCode,
    decision: body.action,
    passwordProof,
    expectedWorkspaceId: body.action === "approve" ? body.workspaceId : null,
  });
  return NextResponse.json(decided, { headers: NO_STORE });
}

// Bound devices only (approved, active, revoked): a pending, rejected or
// cancelled request has no member. Live devices (an unclaimed approval or an
// unexpired active device) are read in full: the device cap keeps them to 3
// per member, so ended rows can never push one off the page. Ended devices
// (revoked or expired) are history: the newest 50 of the member's own and,
// for OWNER/ADMIN, the newest 100 of the workspace.
const OWN_HISTORY_LIMIT = 50;
const WORKSPACE_HISTORY_LIMIT = 100;
const LIST_SELECT = {
  id: true, userId: true, deviceLabel: true, clientVersion: true, status: true, requestExpiresAt: true, expiresAt: true,
  decidedAt: true, approvalSource: true, lastUsedAt: true, revokedAt: true, revokeReason: true,
} as const;

async function listDevices(session: NonNullable<SeatDeviceWebsiteSession>) {
  const now = new Date();
  const member = await loadMemberContext(session.authSessionId, session.userId, now);
  const manager = member.role === WorkspaceRole.OWNER || member.role === WorkspaceRole.ADMIN;
  const live: Prisma.SeatDeviceAuthorizationWhereInput = {
    OR: [{ status: "approved", requestExpiresAt: { gt: now } }, { status: "active", expiresAt: { gt: now } }],
  };
  const bound = (userId: string | { not: null }) => ({ workspaceId: member.workspace.id, userId, status: { in: ["approved", "active", "revoked"] } });
  const history = (userId: string | { not: null }, take: number) =>
    db.seatDeviceAuthorization.findMany({ where: { ...bound(userId), NOT: live }, orderBy: { decidedAt: "desc" }, take, select: LIST_SELECT });
  const [liveRows, ownHistory, workspaceHistory] = await Promise.all([
    db.seatDeviceAuthorization.findMany({ where: { ...bound(manager ? { not: null } : member.userId), ...live }, orderBy: { decidedAt: "desc" }, select: LIST_SELECT }),
    history(member.userId, OWN_HISTORY_LIMIT),
    manager ? history({ not: null }, WORKSPACE_HISTORY_LIMIT) : Promise.resolve([]),
  ]);
  const rows = [...liveRows, ...ownHistory, ...workspaceHistory];
  const users = await db.user.findMany({ where: { id: { in: [...new Set(rows.map((row) => row.userId ?? ""))] } }, select: { id: true, name: true } });
  const names = new Map(users.map((user) => [user.id, user.name]));
  const view = (row: (typeof rows)[number]) => ({
    deviceId: row.id,
    deviceName: row.deviceLabel,
    clientVersion: row.clientVersion,
    status: effectiveSeatDeviceStatus(row, now),
    memberName: names.get(row.userId ?? "") ?? null,
    own: row.userId === member.userId,
    approvedAt: row.decidedAt?.toISOString() ?? null,
    approvalSource: row.approvalSource,
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    revokedAt: row.revokedAt?.toISOString() ?? null,
    revokeReason: row.revokeReason,
  });
  const liveViews = liveRows.map(view);
  return {
    mine: [...liveViews.filter((device) => device.own), ...ownHistory.map(view)],
    workspace: manager ? [...liveViews, ...workspaceHistory.map(view)] : null,
  };
}

export async function handleSeatDeviceWebsiteList(resolveSession: () => Promise<SeatDeviceWebsiteSession>): Promise<Response> {
  if (!isSeatDeviceAuthDeploymentEnabled()) return seatDeviceNotFound();
  try {
    const session = await resolveSession();
    if (!session) return seatDeviceErrorResponse("reauthentication_required");
    return NextResponse.json(await listDevices(session), { headers: NO_STORE });
  } catch (error) {
    if (error instanceof SeatDeviceAuthError) return seatDeviceErrorResponse(error.code, error.retryAfterSeconds);
    logUnexpected(error instanceof Error && /^[A-Za-z]{1,64}$/.test(error.name) ? error.name : "unknown");
    return seatDeviceErrorResponse("temporarily_unavailable");
  }
}

export async function handleSeatDeviceWebsiteRequest(
  request: Request,
  resolveSession: () => Promise<SeatDeviceWebsiteSession>,
): Promise<Response> {
  if (!isSeatDeviceAuthDeploymentEnabled()) return seatDeviceNotFound();
  try {
    return await answer(request, resolveSession);
  } catch (error) {
    if (error instanceof InvalidBody) return seatDeviceErrorResponse("invalid_input");
    if (error instanceof SeatDeviceAuthError) return seatDeviceErrorResponse(error.code, error.retryAfterSeconds);
    logUnexpected(error instanceof Error && /^[A-Za-z]{1,64}$/.test(error.name) ? error.name : "unknown");
    return seatDeviceErrorResponse("temporarily_unavailable");
  }
}
