// lib/seat-device/seat-device-routes.mysql.test.ts
// The five D1 device endpoints (design v0.3 §4.2, §15) through their real
// route handlers and the real store on an isolated MySQL database: answer
// shapes, the code map with its HTTP statuses, no-store on every answer,
// Retry-After on every 429 and 503, the verification URL and entry links (APP_URL only, no
// code), and a log probe that no token or pairing code reaches a log line.
//
//   SEAT_DEVICE_DATABASE_URL=<disposable db> DATABASE_URL=<same>
//   npm run test:seat-device:mysql   (sets SEAT_DEVICE_MYSQL_REQUIRED=1: a missing URL fails instead of skipping)
//
// The routes read the wall clock, so only Date is faked (timers stay real for
// the store's retry backoff), years after the other seat device files' clocks:
// their rows have lapsed by then and never count toward these limits.

import { MembershipStatus, WorkspaceRole, WorkspaceStatus } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import * as authorizeRoute from "@/app/api/public-auth/seat-device/device-authorizations/route";
import * as cancelRoute from "@/app/api/public-auth/seat-device/device-authorizations/cancel/route";
import * as claimRoute from "@/app/api/public-auth/seat-device/device-authorizations/claim/route";
import * as refreshRoute from "@/app/api/public-auth/seat-device/device-tokens/refresh/route";
import * as revokeRoute from "@/app/api/public-auth/seat-device/device-tokens/revoke/route";
import { hashPassword } from "@/lib/auth/formal-auth";
import { db } from "@/lib/db";
import { hashSeatDeviceToken, mintSeatDeviceToken, normalizeSeatDevicePairingCode } from "@/lib/seat-device/contract";
import { decideSeatDeviceAuthorization, verifySeatDeviceApprovalPassword } from "@/lib/seat-device/store-authorize";

const integrationDatabaseUrl = process.env.SEAT_DEVICE_DATABASE_URL;
if (process.env.SEAT_DEVICE_MYSQL_REQUIRED === "1" && !integrationDatabaseUrl) {
  throw new Error("SEAT_DEVICE_MYSQL_REQUIRED=1 but SEAT_DEVICE_DATABASE_URL is missing.");
}
const describeMysql = integrationDatabaseUrl ? describe.sequential : describe.skip;
const suffix = `${process.pid.toString(36)}-${Date.now().toString(36)}`;
const APP_ORIGIN = "https://seat.example.test";
const PASSWORD = "correct horse battery";
const PASSWORD_HASH = hashPassword(PASSWORD);

let clock = Date.parse("2051-01-01T00:00:00.000Z");
// A new day per test; `tick` moves within it.
function nextDay() {
  clock += 24 * 60 * 60 * 1000;
  vi.setSystemTime(clock);
  return new Date(clock);
}
function tick(seconds: number) {
  clock += seconds * 1000;
  vi.setSystemTime(clock);
}

const runOctets = [Math.floor(Math.random() * 256), Math.floor(Math.random() * 256)];
let sourceCounter = 0;
function freshSource() {
  sourceCounter += 1;
  return `12.${runOctets[0]}.${(runOctets[1] + sourceCounter) % 256}.10`;
}

// Every secret a route hands out, for the log probe at the end.
const issuedSecrets: string[] = [];
const logLines: string[] = [];
const CONSOLE_METHODS = ["log", "info", "warn", "error", "debug", "trace"] as const;

type Answer = { status: number; headers: Headers; body: unknown };

const PATHS = {
  authorize: "device-authorizations",
  cancel: "device-authorizations/cancel",
  claim: "device-authorizations/claim",
  refresh: "device-tokens/refresh",
  revoke: "device-tokens/revoke",
} as const;
const ROUTES = { authorize: authorizeRoute, cancel: cancelRoute, claim: claimRoute, refresh: refreshRoute, revoke: revokeRoute };
type Endpoint = keyof typeof ROUTES;

// Hostile request headers: the answer must not depend on them, and the
// device endpoints must not read the cookie.
async function post(endpoint: Endpoint, body: unknown, source: string | null = null): Promise<Answer> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    host: "attacker.example",
    "x-forwarded-host": "phish.example",
    "x-forwarded-proto": "http",
    cookie: "helm_session=forged",
  };
  // One trusted hop: the rightmost entry is the source, the left one is client-supplied.
  if (source) headers["x-forwarded-for"] = `203.0.113.7, ${source}`;
  const response = await ROUTES[endpoint].POST(
    new Request(`http://attacker.example/api/public-auth/seat-device/${PATHS[endpoint]}`, {
      method: "POST",
      headers,
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
  expect(response.headers.get("cache-control"), `${endpoint} ${response.status}`).toBe("no-store");
  expect(response.headers.get("set-cookie")).toBeNull();
  const text = await response.text();
  const parsed: unknown = text === "" ? null : JSON.parse(text);
  if (parsed && typeof parsed === "object") {
    for (const key of ["pollToken", "pairingCode", "accessToken", "refreshToken"]) {
      const value = (parsed as Record<string, unknown>)[key];
      if (typeof value === "string") issuedSecrets.push(value);
    }
    const code = (parsed as { pairingCode?: unknown }).pairingCode;
    // The pairing code also as typed: without the display hyphen.
    if (typeof code === "string") issuedSecrets.push(code.replace("-", ""));
  }
  if (response.status === 429 || response.status === 503) {
    expect(response.headers.get("retry-after"), `${endpoint} ${response.status}`).toMatch(/^[1-9][0-9]*$/);
  } else {
    expect(response.headers.get("retry-after")).toBeNull();
  }
  return { status: response.status, headers: response.headers, body: parsed };
}

const errorOf = (code: string) => ({ error: { code } });
// For exact assertions: the status and the whole body, nothing more.
const only = ({ status, body }: Answer) => ({ status, body });
const DEVICE = { deviceName: "前台电脑", clientType: "seat_desktop", clientVersion: "1.0.0" };

describeMysql("seat device endpoints on MySQL", () => {
  let workspaceId = "";
  let memberCount = 0;

  type Member = { userId: string; membershipId: string };
  async function member(): Promise<Member> {
    memberCount += 1;
    const user = await db.user.create({
      data: { email: `seat-routes-${memberCount}-${suffix}@example.com`, name: `坐席 ${memberCount}`, passwordHash: PASSWORD_HASH, passwordSetAt: new Date("2050-06-01T00:00:00.000Z") },
    });
    const membership = await db.membership.create({
      data: { workspaceId, userId: user.id, role: WorkspaceRole.OPERATOR, status: MembershipStatus.ACTIVE },
    });
    return { userId: user.id, membershipId: membership.id };
  }

  async function approve(who: Member, grant: { requestId: string; pairingCode: string }) {
    const now = new Date();
    const authSession = await db.authSession.create({
      data: {
        userId: who.userId,
        activeWorkspaceId: workspaceId,
        sessionKeyHash: hashSeatDeviceToken(`session-${who.userId}-${now.getTime()}-${Math.random()}`),
        providerType: "PASSWORD",
        createdAt: new Date(now.getTime() - 60_000),
        expiresAt: new Date(now.getTime() + 14 * 24 * 3600 * 1000),
      },
    });
    await decideSeatDeviceAuthorization({
      authSessionId: authSession.id,
      userId: who.userId,
      requestId: grant.requestId,
      pairingCode: normalizeSeatDevicePairingCode(grant.pairingCode)!,
      decision: "approve",
      passwordProof: await verifySeatDeviceApprovalPassword({ userId: who.userId, password: PASSWORD }),
      expectedWorkspaceId: workspaceId,
      source: null,
    });
  }

  type Grant = { requestId: string; pollToken: string; pairingCode: string };
  async function authorize(source = freshSource()) {
    const answer = await post("authorize", DEVICE, source);
    expect(answer.status).toBe(200);
    return { grant: answer.body as Grant & { verificationUrl: string; entryLinks: unknown }, source };
  }

  // A claimed device of a fresh member, from a trusted source.
  async function device() {
    const owner = await member();
    const { grant, source } = await authorize();
    await approve(owner, grant);
    tick(5);
    const claimed = await post("claim", { requestId: grant.requestId, pollToken: grant.pollToken }, source);
    expect(claimed.status).toBe(200);
    const body = claimed.body as { accessToken: string; refreshToken: string };
    // The claim binds the trusted source the pair went to (re-claim, grace).
    expect(await db.seatDeviceAuthorization.findUniqueOrThrow({ where: { id: grant.requestId } })).toMatchObject({ lastIp: source, rotationSource: source });
    return { owner, source, deviceId: grant.requestId, ...body };
  }

  beforeAll(async () => {
    if (process.env.DATABASE_URL !== integrationDatabaseUrl) {
      throw new Error("DATABASE_URL must equal SEAT_DEVICE_DATABASE_URL for the isolated integration test.");
    }
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.stubEnv("HELM_SEAT_DEVICE_AUTH_ENABLED", "true");
    vi.stubEnv("HELM_SEAT_DEVICE_TRUSTED_PROXY_HOPS", "1");
    vi.stubEnv("APP_URL", APP_ORIGIN);
    // The activation page (and so its entry link) is off unless a test opens it.
    vi.stubEnv("HELM_AUTH_MEMBER_ACTIVATION_ENABLED", undefined);
    for (const method of CONSOLE_METHODS) {
      const original = console[method].bind(console);
      vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
        logLines.push(args.map((arg) => (typeof arg === "string" ? arg : arg instanceof Error ? `${arg.message} ${arg.stack}` : JSON.stringify(arg))).join(" "));
        original(...args);
      });
    }
    nextDay();
    const workspace = await db.workspace.create({
      data: { name: `坐席端点 ${suffix}`, slug: `seat-routes-${suffix}`, featureFlagsJson: JSON.stringify({ seatDesktop: true }) },
    });
    workspaceId = workspace.id;
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.useRealTimers();
    await db.$disconnect();
  });

  it("authorizes with a URL built from APP_URL only, never carrying the code, and keeps the trusted source", async () => {
    nextDay();
    const { grant, source } = await authorize();
    expect(Object.keys(grant).sort()).toEqual(["entryLinks", "expiresInSeconds", "intervalSeconds", "pairingCode", "pollToken", "requestId", "verificationUrl"]);
    expect(grant).toMatchObject({ expiresInSeconds: 600, intervalSeconds: 5 });
    expect(grant.verificationUrl).toBe(`${APP_ORIGIN}/device`);
    // post() sends a hostile Host, x-forwarded-host and an http forwarded proto.
    expect(grant.entryLinks).toEqual({ signIn: `${APP_ORIGIN}/login`, activateMember: null, signUp: null });
    const url = new URL(grant.verificationUrl);
    expect(url.search + url.hash).toBe("");
    expect(grant.verificationUrl).not.toContain(grant.pairingCode.replace("-", ""));
    expect(grant.pollToken).toMatch(/^hsdp_/);
    expect(grant.pairingCode).toMatch(/^[A-Z]{4}-[A-Z]{4}$/);
    const row = await db.seatDeviceAuthorization.findUniqueOrThrow({ where: { id: grant.requestId } });
    expect(row.sourceIp).toBe(source);
    expect(row.pollTokenHash).toBe(hashSeatDeviceToken(grant.pollToken));
  });

  it("offers the activation link only while the activation page is on, and takes no address from the client", async () => {
    nextDay();
    vi.stubEnv("HELM_AUTH_MEMBER_ACTIVATION_ENABLED", "true");
    try {
      const { grant } = await authorize();
      expect(grant.entryLinks).toEqual({ signIn: `${APP_ORIGIN}/login`, activateMember: `${APP_ORIGIN}/activate-member`, signUp: null });
    } finally {
      vi.stubEnv("HELM_AUTH_MEMBER_ACTIVATION_ENABLED", undefined);
    }
    // A client cannot steer the links: any address field is an unknown field.
    for (const extra of [{ entryLinks: { signUp: "https://phish.example" } }, { signUpUrl: "https://phish.example" }, { verificationUrl: "https://phish.example/device" }]) {
      expect(only(await post("authorize", { ...DEVICE, ...extra }, freshSource()))).toEqual({ status: 400, body: errorOf("invalid_input") });
    }
  });

  it("resolves the public origin before storing anything", async () => {
    nextDay();
    const before = await db.seatDeviceAuthorization.count();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_URL", "http://plain-http.example.test");
    try {
      // Fail closed: no link of any kind leaves with a non-https origin.
      expect(only(await post("authorize", DEVICE, freshSource()))).toEqual({ status: 503, body: errorOf("temporarily_unavailable") });
    } finally {
      vi.stubEnv("NODE_ENV", "test");
      vi.stubEnv("APP_URL", APP_ORIGIN);
    }
    expect(await db.seatDeviceAuthorization.count()).toBe(before);
    expect(logLines.at(-1)).toBe(`[seat-device] ${JSON.stringify({ event: "device_endpoint_failed", operation: "authorize", reason: "public_origin_invalid" })}`);
  });

  it("refuses unknown fields on every endpoint and an unsupported client type", async () => {
    nextDay();
    const poll = { requestId: "abc", pollToken: mintSeatDeviceToken("poll").token };
    const refresh = { refreshToken: mintSeatDeviceToken("refresh").token };
    const extra = { authorize: DEVICE, cancel: poll, claim: poll, refresh, revoke: refresh };
    for (const [endpoint, body] of Object.entries(extra) as [Endpoint, object][]) {
      expect(await post(endpoint, { ...body, extra: 1 })).toMatchObject({ status: 400, body: errorOf("invalid_input") });
    }
    expect(await post("authorize", { ...DEVICE, clientType: "other_client" })).toMatchObject({ status: 400, body: errorOf("client_not_supported") });
    expect(await post("claim", { requestId: "abc", pollToken: "hsdp_short" })).toMatchObject({ status: 400, body: errorOf("invalid_input") });
    expect(await post("revoke", { ...refresh, reason: "admin" })).toMatchObject({ status: 400, body: errorOf("invalid_input") });
  });

  it("limits requests per trusted address bucket with 429 rate_limited and Retry-After", async () => {
    nextDay();
    const source = freshSource();
    for (let index = 0; index < 10; index += 1) await authorize(source);
    const limited = await post("authorize", DEVICE, source);
    expect(limited).toMatchObject({ status: 429, body: errorOf("rate_limited") });
    expect(Number(limited.headers.get("retry-after"))).toBe(600);
  });

  it("polls, throttles, claims and cancels with the closed answers", async () => {
    nextDay();
    const owner = await member();
    const { grant, source } = await authorize();
    const poll = { requestId: grant.requestId, pollToken: grant.pollToken };
    expect(only(await post("claim", poll, source))).toEqual({ status: 200, body: { status: "pending" } });
    const throttled = await post("claim", poll, source);
    expect(throttled).toMatchObject({ status: 429, body: errorOf("slow_down") });
    expect(Number(throttled.headers.get("retry-after"))).toBe(5);
    expect(await post("claim", { ...poll, pollToken: mintSeatDeviceToken("poll").token }, source)).toMatchObject({ status: 403, body: errorOf("poll_token_invalid") });
    await approve(owner, grant);
    tick(5);
    const claimed = await post("claim", poll, source);
    expect(claimed.status).toBe(200);
    expect(Object.keys(claimed.body as object).sort()).toEqual(["accessToken", "deviceId", "expiresInSeconds", "identity", "refreshExpiresInSeconds", "refreshToken", "status"]);
    expect(Object.keys((claimed.body as { identity: object }).identity).sort()).toEqual(["displayName", "kind", "roles", "subjectId", "workspace"]);
    expect(claimed.body).toMatchObject({
      status: "approved",
      expiresInSeconds: 900,
      deviceId: grant.requestId,
      identity: { subjectId: `user:${owner.userId}`, kind: "member", workspace: { id: workspaceId } },
    });
    // Cancel: a wrong poll token reads expired; the claimed, never used pair is revoked.
    expect(only(await post("cancel", { ...poll, pollToken: mintSeatDeviceToken("poll").token }))).toEqual({ status: 200, body: { status: "expired" } });
    expect(only(await post("cancel", poll))).toEqual({ status: 200, body: { status: "cancelled" } });
    expect(only(await post("cancel", poll))).toEqual({ status: 200, body: { status: "revoked" } });
    // A pending request cancels to cancelled and then claims as expired.
    const second = await authorize();
    const secondPoll = { requestId: second.grant.requestId, pollToken: second.grant.pollToken };
    expect(only(await post("cancel", secondPoll))).toEqual({ status: 200, body: { status: "cancelled" } });
    expect(only(await post("claim", secondPoll, second.source))).toEqual({ status: 200, body: { status: "expired" } });
  });

  it("rotates, detects reuse, and answers every revoking code with 401", async () => {
    nextDay();
    const first = await device();
    const rotated = await post("refresh", { refreshToken: first.refreshToken }, first.source);
    expect(rotated.status).toBe(200);
    expect(Object.keys(rotated.body as object).sort()).toEqual(["accessToken", "expiresInSeconds", "refreshExpiresInSeconds", "refreshToken"]);
    expect((await db.seatDeviceAuthorization.findUniqueOrThrow({ where: { id: first.deviceId } })).rotationSource).toBe(first.source);
    tick(61);
    // The previous token after the grace window is reuse: the device is revoked.
    expect(await post("refresh", { refreshToken: first.refreshToken }, first.source)).toMatchObject({ status: 401, body: errorOf("token_revoked") });
    const next = (rotated.body as { refreshToken: string }).refreshToken;
    expect(await post("refresh", { refreshToken: next }, first.source)).toMatchObject({ status: 401, body: errorOf("device_revoked") });
    expect(await post("refresh", { refreshToken: mintSeatDeviceToken("refresh").token })).toMatchObject({ status: 401, body: errorOf("token_revoked") });

    const expired = await device();
    await db.seatDeviceAuthorization.update({ where: { id: expired.deviceId }, data: { expiresAt: new Date(clock - 1000) } });
    expect(await post("refresh", { refreshToken: expired.refreshToken }, expired.source)).toMatchObject({ status: 401, body: errorOf("device_expired") });

    const left = await device();
    await db.membership.update({ where: { id: left.owner.membershipId }, data: { status: MembershipStatus.INACTIVE } });
    expect(await post("refresh", { refreshToken: left.refreshToken }, left.source)).toMatchObject({ status: 401, body: errorOf("account_disabled") });
    expect((await db.seatDeviceAuthorization.findUniqueOrThrow({ where: { id: left.deviceId } })).revokeReason).toBe("membership_inactive");
  });

  it("judges revocation before the workspace flag: 401 for a revoked device or member, 403 only for a standing one", async () => {
    nextDay();
    const standing = await device();
    const revoked = await device();
    const leaving = await device();
    await post("revoke", { refreshToken: revoked.refreshToken });
    await db.membership.update({ where: { id: leaving.owner.membershipId }, data: { status: MembershipStatus.INACTIVE } });
    await db.workspace.update({ where: { id: workspaceId }, data: { featureFlagsJson: JSON.stringify({}) } });
    try {
      expect(await post("refresh", { refreshToken: revoked.refreshToken }, revoked.source)).toMatchObject({ status: 401, body: errorOf("device_revoked") });
      expect(await post("refresh", { refreshToken: leaving.refreshToken }, leaving.source)).toMatchObject({ status: 401, body: errorOf("account_disabled") });
      const off = await post("refresh", { refreshToken: standing.refreshToken }, standing.source);
      expect(off).toMatchObject({ status: 403, body: errorOf("workspace_not_enabled") });
      // Design §15.2: switched off is not revoked; the client keeps its credential.
      expect((await db.seatDeviceAuthorization.findUniqueOrThrow({ where: { id: standing.deviceId } })).status).toBe("active");
    } finally {
      await db.workspace.update({ where: { id: workspaceId }, data: { featureFlagsJson: JSON.stringify({ seatDesktop: true }), status: WorkspaceStatus.ACTIVE } });
    }
    // A SUSPENDED workspace reads workspace_not_enabled and keeps the device;
    // the member is judged first, so one who left reads 401 and is revoked.
    const suspendedLeaver = await device();
    await db.membership.update({ where: { id: suspendedLeaver.owner.membershipId }, data: { status: MembershipStatus.INACTIVE } });
    await db.workspace.update({ where: { id: workspaceId }, data: { status: WorkspaceStatus.SUSPENDED } });
    try {
      tick(1);
      expect(await post("refresh", { refreshToken: standing.refreshToken }, standing.source)).toMatchObject({ status: 403, body: errorOf("workspace_not_enabled") });
      expect(await post("refresh", { refreshToken: suspendedLeaver.refreshToken }, suspendedLeaver.source)).toMatchObject({ status: 401, body: errorOf("account_disabled") });
      expect(await db.seatDeviceAuthorization.findUniqueOrThrow({ where: { id: suspendedLeaver.deviceId } })).toMatchObject({ status: "revoked", revokeReason: "membership_inactive" });
    } finally {
      await db.workspace.update({ where: { id: workspaceId }, data: { status: WorkspaceStatus.ACTIVE } });
    }
  });

  it("limits refresh to six a minute with 429 rate_limited and Retry-After", async () => {
    nextDay();
    const current = await device();
    let refreshToken = current.refreshToken;
    for (let index = 0; index < 6; index += 1) {
      const answer = await post("refresh", { refreshToken }, current.source);
      expect(answer.status).toBe(200);
      refreshToken = (answer.body as { refreshToken: string }).refreshToken;
      tick(1);
    }
    const limited = await post("refresh", { refreshToken }, current.source);
    expect(limited).toMatchObject({ status: 429, body: errorOf("rate_limited") });
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
  });

  it("revokes with any token of the family and answers 200 {} for every token outcome", async () => {
    nextDay();
    const owned = await device();
    const rotated = await post("refresh", { refreshToken: owned.refreshToken }, owned.source);
    expect(rotated.status).toBe(200);
    expect(only(await post("revoke", { refreshToken: mintSeatDeviceToken("refresh").token }))).toEqual({ status: 200, body: {} });
    // The previous token still finds the device after a lost answer.
    expect(only(await post("revoke", { refreshToken: owned.refreshToken, reason: "client_cancelled" }))).toEqual({ status: 200, body: {} });
    const row = await db.seatDeviceAuthorization.findUniqueOrThrow({ where: { id: owned.deviceId } });
    expect(row).toMatchObject({ status: "revoked", revokeReason: "client_cancelled" });
    expect(only(await post("revoke", { refreshToken: owned.refreshToken }))).toEqual({ status: 200, body: {} });
  });

  it("answers every endpoint 404 with no body while the switch is off, and stores nothing", async () => {
    nextDay();
    const live = await device();
    const before = await db.seatDeviceAuthorization.count();
    vi.stubEnv("HELM_SEAT_DEVICE_AUTH_ENABLED", "false");
    try {
      const bodies = {
        authorize: DEVICE,
        cancel: { requestId: live.deviceId, pollToken: "x" },
        claim: { requestId: live.deviceId, pollToken: "x" },
        refresh: { refreshToken: live.refreshToken },
        revoke: { refreshToken: live.refreshToken },
      };
      for (const [endpoint, body] of Object.entries(bodies) as [Endpoint, object][]) {
        expect(await post(endpoint, body, live.source)).toMatchObject({ status: 404, body: null });
      }
    } finally {
      vi.stubEnv("HELM_SEAT_DEVICE_AUTH_ENABLED", "true");
    }
    expect(await db.seatDeviceAuthorization.count()).toBe(before);
    expect((await db.seatDeviceAuthorization.findUniqueOrThrow({ where: { id: live.deviceId } })).status).toBe("active");
  });

  // Contention that outlasts the store's retries leaves as a closed code with
  // Retry-After (1a-2 and 1b review items): 503 for cancel and revoke, 429 for
  // claim and refresh. Simulated by failing every transaction with a conflict.
  it("maps exhausted write conflicts to closed codes with Retry-After", async () => {
    nextDay();
    const live = await device();
    const { grant } = await authorize();
    const poll = { requestId: grant.requestId, pollToken: grant.pollToken };
    const conflict = vi.spyOn(db, "$transaction").mockRejectedValue(new Error("seat device write conflict"));
    try {
      expect(await post("cancel", poll)).toMatchObject({ status: 503, body: errorOf("temporarily_unavailable") });
      expect(await post("revoke", { refreshToken: live.refreshToken })).toMatchObject({ status: 503, body: errorOf("temporarily_unavailable") });
      expect(await post("claim", poll, freshSource())).toMatchObject({ status: 429, body: errorOf("slow_down") });
      expect(await post("refresh", { refreshToken: live.refreshToken }, live.source)).toMatchObject({ status: 429, body: errorOf("rate_limited") });
    } finally {
      conflict.mockRestore();
    }
    expect((await db.seatDeviceAuthorization.findUniqueOrThrow({ where: { id: live.deviceId } })).status).toBe("active");
  });

  it("answers a failure outside the closed set 503 and logs a fixed line without the error's text", async () => {
    nextDay();
    const live = await device();
    const before = logLines.length;
    const failure = vi.spyOn(db, "$transaction").mockRejectedValue(new Error(`driver failure quoting ${live.refreshToken}`));
    try {
      expect(await post("refresh", { refreshToken: live.refreshToken }, live.source)).toMatchObject({ status: 503, body: errorOf("temporarily_unavailable") });
    } finally {
      failure.mockRestore();
    }
    expect(logLines.slice(before)).toEqual([
      `[seat-device] ${JSON.stringify({ event: "device_endpoint_failed", operation: "refresh", reason: "Error" })}`,
    ]);
  });

  it("never wrote a token or pairing code to a log line (probe over this whole file)", () => {
    expect(issuedSecrets.length).toBeGreaterThan(20);
    expect(logLines.length).toBeGreaterThan(0);
    const leaked = issuedSecrets.filter((secret) => logLines.some((line) => line.includes(secret)));
    expect(leaked).toEqual([]);
  });
});
