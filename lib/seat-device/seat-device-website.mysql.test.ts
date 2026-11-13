// lib/seat-device/seat-device-website.mysql.test.ts
// The D1 website side of pairing (design v0.3 §4.3, server design §2C.3)
// through the real handler and the real store on an isolated MySQL database:
// approve only with the password typed again (a wrong one is a counted failed
// login of the account, and a locked login refuses a right one), a rotated
// session approves nothing on its own, reject needs no password, the
// cross-site guard runs before the session is read, no-store everywhere, and
// a log probe that no password or pairing code reaches a log line. Then the
// device list (own devices; OWNER/ADMIN the workspace's) and website revoke.
//
//   SEAT_DEVICE_DATABASE_URL=<disposable db> DATABASE_URL=<same>
//   npm run test:seat-device:mysql   (sets SEAT_DEVICE_MYSQL_REQUIRED=1: a missing URL fails instead of skipping)
//
// Only Date is faked, decades after the other seat device files' clocks.

import { MembershipStatus, WorkspaceRole } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// The real verifyPassword, watched: a locked account must not spend scrypt.
vi.mock("@/lib/auth/formal-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/formal-auth")>();
  return { ...actual, verifyPassword: vi.fn(actual.verifyPassword) };
});

import * as websiteRoute from "@/app/api/settings/seat-devices/route";
import { hashPassword, verifyPassword } from "@/lib/auth/formal-auth";
import { LOGIN_RATE_LIMIT, hashLoginIdentifier } from "@/lib/auth/login-rate-limit";
import { getLoginLockStatus } from "@/lib/auth/login-rate-limit.service";
import { db } from "@/lib/db";
import { hashSeatDeviceToken } from "@/lib/seat-device/contract";
import { requestSeatDeviceAuthorization } from "@/lib/seat-device/store-authorize";
import { handleSeatDeviceWebsiteList, handleSeatDeviceWebsiteRequest, type SeatDeviceWebsiteSession } from "@/lib/seat-device/website-routes";

const integrationDatabaseUrl = process.env.SEAT_DEVICE_DATABASE_URL;
if (process.env.SEAT_DEVICE_MYSQL_REQUIRED === "1" && !integrationDatabaseUrl) {
  throw new Error("SEAT_DEVICE_MYSQL_REQUIRED=1 but SEAT_DEVICE_DATABASE_URL is missing.");
}
const describeMysql = integrationDatabaseUrl ? describe.sequential : describe.skip;
const suffix = `${process.pid.toString(36)}-${Date.now().toString(36)}`;
const APP_ORIGIN = "https://seat.example.test";
const PASSWORD = "correct horse battery";
const WRONG = "wrong horse battery";
const PASSWORD_HASH = hashPassword(PASSWORD);

let clock = Date.parse("2071-01-01T00:00:00.000Z");
function nextDay() {
  clock += 24 * 60 * 60 * 1000;
  vi.setSystemTime(clock);
}

const runOctets = [Math.floor(Math.random() * 256), Math.floor(Math.random() * 256)];
let sourceCounter = 0;
function freshSource() {
  sourceCounter += 1;
  return `14.${runOctets[0]}.${(runOctets[1] + sourceCounter) % 256}.10`;
}

const secrets: string[] = [PASSWORD, WRONG];
const logLines: string[] = [];
const CONSOLE_METHODS = ["log", "info", "warn", "error", "debug", "trace"] as const;

type Answer = { status: number; body: unknown };
const errorOf = (code: string) => ({ error: { code } });

const SAME_ORIGIN = { origin: APP_ORIGIN, "sec-fetch-site": "same-origin", "content-type": "application/json" };

describeMysql("seat device website pairing on MySQL", () => {
  let workspaceId = "";
  let offWorkspaceId = "";
  let memberCount = 0;
  let sessionReads = 0;

  type Member = { userId: string; email: string; session: SeatDeviceWebsiteSession };
  async function member(providerType = "PASSWORD", role: WorkspaceRole = WorkspaceRole.OPERATOR, inWorkspace?: string): Promise<Member> {
    const ws = inWorkspace ?? workspaceId;
    memberCount += 1;
    const email = `seat-website-${memberCount}-${suffix}@example.com`;
    const user = await db.user.create({
      data: { email, name: `坐席 ${memberCount}`, passwordHash: PASSWORD_HASH, passwordSetAt: new Date("2070-06-01T00:00:00.000Z") },
    });
    await db.membership.create({ data: { workspaceId: ws, userId: user.id, role, status: MembershipStatus.ACTIVE } });
    // Brand new, as a rotation leaves it: its age proves nothing.
    const authSession = await db.authSession.create({
      data: {
        userId: user.id,
        activeWorkspaceId: ws,
        sessionKeyHash: hashSeatDeviceToken(`session-${user.id}-${Math.random()}`),
        providerType,
        expiresAt: new Date(clock + 14 * 24 * 3600 * 1000),
      },
    });
    return { userId: user.id, email, session: { authSessionId: authSession.id, userId: user.id } };
  }

  async function pending() {
    const grant = await requestSeatDeviceAuthorization({ deviceLabel: "前台电脑", clientType: "seat_desktop", clientVersion: "1.0.0", source: freshSource() });
    secrets.push(grant.pairingCode, grant.pairingCode.replace("-", ""), grant.pollToken);
    return grant;
  }

  async function post(who: Member | null, body: unknown, headers: Record<string, string | undefined> = {}, source = freshSource(), url = APP_ORIGIN): Promise<Answer> {
    const merged: Record<string, string> = {};
    for (const [key, value] of Object.entries({ ...SAME_ORIGIN, "x-forwarded-for": source, ...headers })) if (value !== undefined) merged[key] = value;
    const response = await handleSeatDeviceWebsiteRequest(
      new Request(`${url}/api/settings/seat-devices`, { method: "POST", headers: merged, body: JSON.stringify(body) }),
      async () => {
        sessionReads += 1;
        return who?.session ?? null;
      },
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
    const status = response.status;
    expect(response.headers.get("retry-after") !== null).toBe(status === 429 || status === 503);
    const text = await response.text();
    return { status, body: text === "" ? null : JSON.parse(text) };
  }

  const decision = (action: "approve" | "reject", grant: { requestId: string; pairingCode: string }, extra: object = {}) => ({
    action,
    requestId: grant.requestId,
    pairingCode: grant.pairingCode,
    ...(action === "approve" ? { workspaceId } : {}),
    ...extra,
  });
  const row = (id: string) => db.seatDeviceAuthorization.findUniqueOrThrow({ where: { id } });
  const loginFailures = async (email: string) =>
    (await db.failedLoginAttempt.findUnique({ where: { identifierHash: hashLoginIdentifier(email) } }))?.attemptCount ?? 0;

  beforeAll(async () => {
    if (process.env.DATABASE_URL !== integrationDatabaseUrl) {
      throw new Error("DATABASE_URL must equal SEAT_DEVICE_DATABASE_URL for the isolated integration test.");
    }
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.stubEnv("HELM_SEAT_DEVICE_AUTH_ENABLED", "true");
    vi.stubEnv("HELM_SEAT_DEVICE_TRUSTED_PROXY_HOPS", "1");
    vi.stubEnv("APP_URL", APP_ORIGIN);
    for (const method of CONSOLE_METHODS) {
      const original = console[method].bind(console);
      vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
        logLines.push(args.map((arg) => (typeof arg === "string" ? arg : arg instanceof Error ? `${arg.message} ${arg.stack}` : JSON.stringify(arg))).join(" "));
        original(...args);
      });
    }
    nextDay();
    const workspace = await db.workspace.create({
      data: { name: `坐席网站 ${suffix}`, slug: `seat-website-${suffix}`, featureFlagsJson: JSON.stringify({ seatDesktop: true }) },
    });
    workspaceId = workspace.id;
    offWorkspaceId = (await db.workspace.create({ data: { name: `未开通 ${suffix}`, slug: `seat-website-off-${suffix}` } })).id;
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.useRealTimers();
    await db.$disconnect();
  });

  it("looks a code up with the trusted source, then approves only with the right password, audited and notified", async () => {
    nextDay();
    const who = await member();
    const grant = await pending();
    const source = freshSource();
    const found = await post(who, { action: "lookup", pairingCode: grant.pairingCode.toLowerCase() }, {}, `203.0.113.7, ${source}`);
    expect(found.status).toBe(200);
    expect(found.body).toEqual({
      requestId: grant.requestId,
      deviceName: "前台电脑",
      clientVersion: "1.0.0",
      clientReported: ["deviceName", "clientVersion"],
      requestedAt: new Date(clock).toISOString(),
      source: (await row(grant.requestId)).sourceIp,
      expiresInSeconds: 600,
      workspace: { id: workspaceId, name: `坐席网站 ${suffix}` },
    });

    expect(await post(who, decision("approve", grant, { password: WRONG }))).toEqual({ status: 400, body: errorOf("password_invalid") });
    expect(await row(grant.requestId)).toMatchObject({ status: "pending", version: 0, userId: null });
    // Counted where a password login counts it; the code-entry counter is untouched.
    expect(await loginFailures(who.email)).toBe(1);
    expect(await db.failedLoginAttempt.count({ where: { identifierHash: hashLoginIdentifier(`seat-device-code:user:${who.userId}`) } })).toBe(0);
    expect(await db.notification.count({ where: { userId: who.userId } })).toBe(0);

    expect(await post(who, decision("approve", grant, { password: PASSWORD }))).toEqual({ status: 200, body: { requestId: grant.requestId, status: "approved" } });
    expect(await row(grant.requestId)).toMatchObject({ status: "approved", userId: who.userId, workspaceId, approvedAuthSessionId: who.session!.authSessionId });
    expect(await db.auditLog.count({ where: { targetId: grant.requestId, actionType: "SEAT_DEVICE_AUTHORIZATION_APPROVED" } })).toBe(1);
    expect(await db.notification.count({ where: { userId: who.userId, title: "新设备已获授权登录坐席客户端" } })).toBe(1);
  });

  it("locks the account's password login after 8 wrong passwords and then refuses the right one", async () => {
    nextDay();
    const who = await member();
    const grant = await pending();
    for (let attempt = 1; attempt <= LOGIN_RATE_LIMIT.maxAttempts; attempt += 1) {
      expect(await post(who, decision("approve", grant, { password: WRONG }))).toEqual({ status: 400, body: errorOf("password_invalid") });
    }
    vi.mocked(verifyPassword).mockClear();
    expect(await post(who, decision("approve", grant, { password: PASSWORD }))).toEqual({ status: 429, body: errorOf("rate_limited") });
    // Refused on the lock alone: no scrypt for a locked account.
    expect(verifyPassword).not.toHaveBeenCalled();
    expect(await loginFailures(who.email)).toBe(LOGIN_RATE_LIMIT.maxAttempts);
    // The very lock the password login page reads.
    expect((await getLoginLockStatus(who.email)).locked).toBe(true);
    expect(await row(grant.requestId)).toMatchObject({ status: "pending", version: 0 });
  });

  it("approves nothing on a fresh (rotated) session without the password; reject needs none", async () => {
    nextDay();
    const who = await member();
    const grant = await pending();
    for (const extra of [{}, { password: "" }, { passwordVerifiedAt: new Date(clock).toISOString() }]) {
      expect(await post(who, decision("approve", grant, extra))).toEqual({ status: 400, body: errorOf("invalid_input") });
    }
    expect(await row(grant.requestId)).toMatchObject({ status: "pending", version: 0 });
    expect(await post(who, decision("reject", grant, { password: PASSWORD }))).toEqual({ status: 400, body: errorOf("invalid_input") });
    expect(await post(who, decision("reject", grant))).toEqual({ status: 200, body: { requestId: grant.requestId, status: "rejected" } });
    expect(await row(grant.requestId)).toMatchObject({ status: "rejected", userId: null, pairingCodeHash: null });
    expect(await loginFailures(who.email)).toBe(0);
  });

  it("refuses a session that did not come from a password login, even with the right password", async () => {
    nextDay();
    const who = await member("PHONE_CODE");
    const grant = await pending();
    expect(await post(who, decision("approve", grant, { password: PASSWORD }))).toEqual({ status: 403, body: errorOf("reauthentication_required") });
    // Judged before the password: a wrong one is neither answered nor counted.
    expect(await post(who, decision("approve", grant, { password: WRONG }))).toEqual({ status: 403, body: errorOf("reauthentication_required") });
    expect(await loginFailures(who.email)).toBe(0);
    expect(await post(null, decision("approve", grant, { password: PASSWORD }))).toEqual({ status: 403, body: errorOf("reauthentication_required") });
    expect(await row(grant.requestId)).toMatchObject({ status: "pending", version: 0 });
  });

  it("judges the shown workspace and the workspace switch before the password", async () => {
    nextDay();
    const who = await member();
    const grant = await pending();
    // The page showed another workspace than the session sits on now.
    expect(await post(who, decision("approve", grant, { workspaceId: offWorkspaceId, password: WRONG }))).toEqual({ status: 409, body: errorOf("workspace_mismatch") });
    const off = await member("PASSWORD", WorkspaceRole.OPERATOR, offWorkspaceId);
    expect(await post(off, decision("approve", grant, { workspaceId: offWorkspaceId, password: WRONG }))).toEqual({ status: 403, body: errorOf("workspace_not_enabled") });
    expect(await loginFailures(who.email)).toBe(0);
    expect(await loginFailures(off.email)).toBe(0);
    expect(await row(grant.requestId)).toMatchObject({ status: "pending", version: 0 });
  });

  it("compares Origin with APP_URL, never with the request's own URL", async () => {
    nextDay();
    const who = await member();
    const grant = await pending();
    const lookup = { action: "lookup", pairingCode: grant.pairingCode };
    expect(await post(who, lookup, { origin: "https://phish.example" }, freshSource(), "https://phish.example")).toEqual({ status: 403, body: errorOf("forbidden") });
    expect((await post(who, lookup, {}, freshSource(), "https://phish.example")).status).toBe(200);
  });

  it("refuses cross-site requests before reading the session, and anything but JSON", async () => {
    nextDay();
    const who = await member();
    const grant = await pending();
    const reads = sessionReads;
    for (const headers of [
      { origin: undefined },
      { origin: "https://phish.example" },
      { origin: "http://seat.example.test" },
      { "sec-fetch-site": undefined },
      { "sec-fetch-site": "same-site" },
      { "sec-fetch-site": "cross-site" },
      { "sec-fetch-site": "none" },
    ]) {
      expect(await post(who, decision("approve", grant, { password: WRONG }), headers)).toEqual({ status: 403, body: errorOf("forbidden") });
    }
    expect(sessionReads).toBe(reads);
    expect(await post(who, decision("approve", grant, { password: WRONG }), { "content-type": "text/plain" })).toEqual({ status: 400, body: errorOf("invalid_input") });
    expect(await loginFailures(who.email)).toBe(0);
    expect(await row(grant.requestId)).toMatchObject({ status: "pending", version: 0 });
  });

  async function approvedDevice(who: Member) {
    const grant = await pending();
    expect((await post(who, decision("approve", grant, { password: PASSWORD }))).status).toBe(200);
    return grant.requestId;
  }

  async function list(who: Member | null) {
    const answer = await handleSeatDeviceWebsiteList(async () => who?.session ?? null);
    expect(answer.headers.get("cache-control")).toBe("no-store");
    return { status: answer.status, body: await answer.json() };
  }

  it("lists a member's own bound devices; OWNER and ADMIN also see the workspace's", async () => {
    nextDay();
    const seat = await member();
    const colleague = await member();
    const admin = await member("PASSWORD", WorkspaceRole.ADMIN);
    const own = await approvedDevice(seat);
    const theirs = await approvedDevice(colleague);
    const rejected = await pending();
    await post(seat, decision("reject", rejected));
    const mine = await list(seat);
    expect(mine.status).toBe(200);
    expect(mine.body.workspace).toBeNull();
    expect(mine.body.mine).toEqual([
      expect.objectContaining({ deviceId: own, deviceName: "前台电脑", clientVersion: "1.0.0", status: "approved", own: true, memberName: expect.any(String), revokedAt: null }),
    ]);
    const managed = await list(admin);
    expect(managed.body.mine).toEqual([]);
    const ids = managed.body.workspace.map((device: { deviceId: string }) => device.deviceId);
    expect(ids).toEqual(expect.arrayContaining([own, theirs]));
    expect(ids).not.toContain(rejected.requestId);
    expect(await list(null)).toEqual({ status: 403, body: errorOf("reauthentication_required") });
  });

  // Rows written straight to the table: a member's ended devices, newer than a live one.
  async function boundRow(who: Member, status: "active" | "revoked", ws = workspaceId, decidedAt = new Date(clock)) {
    const id = `seat-website-row-${Math.random().toString(36).slice(2)}`;
    await db.seatDeviceAuthorization.create({
      data: {
        id, clientType: "seat_desktop", deviceLabel: "旧电脑", status, pollTokenHash: hashSeatDeviceToken(id),
        requestedAt: decidedAt, requestExpiresAt: decidedAt, workspaceId: ws, userId: who.userId, decidedAt,
        expiresAt: new Date(clock + 24 * 3600 * 1000), revokedAt: status === "revoked" ? decidedAt : null, revokeReason: status === "revoked" ? "self" : null,
      },
    });
    return id;
  }

  it("keeps live devices on the list however many ended ones are newer", async () => {
    nextDay();
    const seat = await member();
    const admin = await member("PASSWORD", WorkspaceRole.ADMIN);
    const liveId = await boundRow(seat, "active", workspaceId, new Date(clock - 3600 * 1000));
    for (let index = 0; index < 210; index += 1) await boundRow(seat, "revoked", workspaceId, new Date(clock - index * 1000));
    const mine = (await list(seat)).body.mine as Array<{ deviceId: string; status: string }>;
    expect(mine[0]).toMatchObject({ deviceId: liveId, status: "active" });
    expect(mine.filter((device) => device.status === "revoked")).toHaveLength(50);
    const managed = (await list(admin)).body.workspace as Array<{ deviceId: string }>;
    expect(managed.map((device) => device.deviceId)).toContain(liveId);
    expect(managed).toHaveLength(101);
  });

  it("never lists a device bound in another workspace", async () => {
    nextDay();
    const seat = await member();
    const admin = await member("PASSWORD", WorkspaceRole.ADMIN);
    const elsewhere = [await boundRow(seat, "active", offWorkspaceId), await boundRow(seat, "revoked", offWorkspaceId)];
    const mine = (await list(seat)).body.mine as Array<{ deviceId: string }>;
    const managed = (await list(admin)).body.workspace as Array<{ deviceId: string }>;
    for (const id of elsewhere) {
      expect(mine.map((device) => device.deviceId)).not.toContain(id);
      expect(managed.map((device) => device.deviceId)).not.toContain(id);
    }
  });

  it("revokes one's own device; another member's only as OWNER or ADMIN", async () => {
    nextDay();
    const seat = await member();
    const colleague = await member();
    const admin = await member("PASSWORD", WorkspaceRole.ADMIN);
    const own = await approvedDevice(seat);
    const theirs = await approvedDevice(colleague);
    expect(await post(seat, { action: "revoke", deviceId: theirs })).toEqual({ status: 403, body: errorOf("forbidden") });
    expect(await row(theirs)).toMatchObject({ status: "approved" });
    expect(await post(seat, { action: "revoke", deviceId: own }, { origin: "https://phish.example" })).toEqual({ status: 403, body: errorOf("forbidden") });
    expect(await post(seat, { action: "revoke", deviceId: own })).toEqual({ status: 200, body: { revoked: true } });
    expect(await row(own)).toMatchObject({ status: "revoked", revokeReason: "self", revokedByUserId: seat.userId });
    expect(await post(admin, { action: "revoke", deviceId: theirs })).toEqual({ status: 200, body: { revoked: true } });
    expect(await row(theirs)).toMatchObject({ status: "revoked", revokeReason: "admin", revokedByUserId: admin.userId });
    expect(await post(admin, { action: "revoke", deviceId: theirs })).toEqual({ status: 200, body: { revoked: false } });
    expect((await list(seat)).body.mine).toEqual([expect.objectContaining({ deviceId: own, status: "revoked", revokeReason: "self" })]);
  });

  it("answers 404 with no body while the deployment switch is off, for every method", async () => {
    vi.stubEnv("HELM_SEAT_DEVICE_AUTH_ENABLED", "false");
    try {
      const request = () => new Request(`${APP_ORIGIN}/api/settings/seat-devices`, { method: "POST", headers: SAME_ORIGIN, body: "{not json" });
      for (const response of [await websiteRoute.POST(request()), await websiteRoute.GET()]) {
        expect(response.status).toBe(404);
        expect(response.headers.get("cache-control")).toBe("no-store");
        expect(await response.text()).toBe("");
      }
    } finally {
      vi.stubEnv("HELM_SEAT_DEVICE_AUTH_ENABLED", "true");
    }
  });

  it("answers a failure outside the closed set 503 with a fixed log line", async () => {
    nextDay();
    const who = await member();
    const grant = await pending();
    const before = logLines.length;
    const failure = vi.spyOn(db, "$transaction").mockRejectedValue(new Error(`driver failure quoting ${PASSWORD} ${grant.pairingCode}`));
    try {
      expect(await post(who, decision("approve", grant, { password: PASSWORD }))).toEqual({ status: 503, body: errorOf("temporarily_unavailable") });
    } finally {
      failure.mockRestore();
    }
    expect(logLines.slice(before)).toEqual([`[seat-device] ${JSON.stringify({ event: "website_endpoint_failed", reason: "Error" })}`]);
  });

  it("never wrote a password or pairing code to a log line (probe over this whole file)", () => {
    expect(logLines.length).toBeGreaterThan(0);
    expect(secrets.filter((secret) => logLines.some((line) => line.includes(secret)))).toEqual([]);
  });
});
