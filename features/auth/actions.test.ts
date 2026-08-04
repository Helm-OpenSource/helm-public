import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthCodeChannel, AuthCodePurpose, MembershipStatus, WorkspaceRole } from "@prisma/client";
import { hashVerificationCode } from "@/lib/auth/formal-auth";
import { writePublicOauthSignupPrefillCookie } from "@/lib/auth/public-oauth";

const mocks = vi.hoisted(() => {
  const cookieStore = {
    get: vi.fn((_name?: string): { value: string } | undefined => ({ value: "en-US" })),
    set: vi.fn(),
    delete: vi.fn(),
  };
  const authVerificationCode = {
    create: vi.fn(),
    deleteMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  };
  const authEnrollment = {
    delete: vi.fn(),
    deleteMany: vi.fn(),
    create: vi.fn(),
    findUnique: vi.fn(),
  };
  const user = {
    create: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  };
  const workspace = {
    findUnique: vi.fn(),
  };
  const membership = {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    upsert: vi.fn(),
  };
  return {
    cookieStore,
    db: {
      authEnrollment,
      authVerificationCode,
      user,
      workspace,
      membership,
      // One-time code claims are single atomic statements rather than
      // conditional updateMany calls, because Prisma drops the predicate from
      // the write on MySQL. The mock below emulates the statements' semantics.
      $executeRaw: vi.fn(),
    },
    trialOnboarding: {
      createSelfServeTrialOrganization: vi.fn(),
    },
    session: {
      activateMembershipIfInvited: vi.fn(),
      clearSession: vi.fn(),
      createSession: vi.fn(),
      requireCurrentUser: vi.fn(),
      setActiveWorkspace: vi.fn(),
      resolvePreferredMembership: vi.fn((memberships: unknown[]) => memberships[0] ?? null),
    },
    analytics: {
      logEvent: vi.fn(),
    },
    loginActivity: {
      recordUserLastLogin: vi.fn(),
    },
    workspaceOps: {
      normalizeWorkspaceUiConfig: vi.fn((): { demoMode: string | null } => ({
        demoMode: null,
      })),
    },
  };
});

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => mocks.cookieStore),
}));

vi.mock("@/lib/db", () => ({
  db: mocks.db,
}));

vi.mock("@/lib/auth/session", () => ({
  ACTIVE_WORKSPACE_COOKIE: "helm-active-workspace",
  activateMembershipIfInvited: mocks.session.activateMembershipIfInvited,
  clearSession: mocks.session.clearSession,
  createSession: mocks.session.createSession,
  requireCurrentUser: mocks.session.requireCurrentUser,
  setActiveWorkspace: mocks.session.setActiveWorkspace,
  resolvePreferredMembership: mocks.session.resolvePreferredMembership,
}));

vi.mock("@/lib/auth/trial-onboarding", () => ({
  createSelfServeTrialOrganization: mocks.trialOnboarding.createSelfServeTrialOrganization,
}));

vi.mock("@/lib/analytics", () => ({
  logEvent: mocks.analytics.logEvent,
}));

vi.mock("@/lib/auth/login-activity", () => ({
  recordUserLastLogin: mocks.loginActivity.recordUserLastLogin,
}));

vi.mock("@/lib/notifications/system-mail", () => ({
  getSystemMailSenderEmail: () => "system@example.com",
  sendSystemMailIfConfigured: vi.fn(),
  SYSTEM_MAIL_PURPOSES: {
    AUTH_CODE: "auth_code",
  },
}));

vi.mock("@/lib/demo/demo-modes", () => ({
  getDemoModeProfiles: () => [
    {
      accountEmail: "founder@demo.com",
    },
  ],
}));

vi.mock("@/lib/workspace-ops", () => ({
  normalizeWorkspaceUiConfig: mocks.workspaceOps.normalizeWorkspaceUiConfig,
}));

import {
  completeFirstLoginIdentityCompletionAction,
  completeTrialSignupVerificationAction,
  loginAction,
  passwordLoginAction,
  requestPhoneLoginCodeAction,
  startTrialSignupAction,
  loginWithPhoneCodeAction,
} from "@/features/auth/actions";

type AuthCodeRecord = {
  id: string;
  purpose: AuthCodePurpose;
  channel: AuthCodeChannel;
  target: string;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  consumedAt: Date | null;
  enrollmentId?: string | null;
  userId?: string | null;
};

const now = new Date("2026-05-03T08:00:00.000Z");

function makeCodeRecord(input: {
  id: string;
  purpose: AuthCodePurpose;
  channel?: AuthCodeChannel;
  target: string;
  code: string;
  attempts?: number;
  enrollmentId?: string | null;
  userId?: string | null;
}): AuthCodeRecord {
  return {
    id: input.id,
    purpose: input.purpose,
    channel: input.channel ?? AuthCodeChannel.PHONE,
    target: input.target,
    codeHash: hashVerificationCode({
      purpose: input.purpose,
      target: input.target,
      code: input.code,
    }),
    expiresAt: new Date(now.getTime() + 10 * 60 * 1000),
    attempts: input.attempts ?? 0,
    consumedAt: null,
    enrollmentId: input.enrollmentId ?? null,
    userId: input.userId ?? null,
  };
}

function createActiveUser() {
  return {
    id: "user-1",
    email: "owner@example.com",
    phone: "+8613800000000",
    memberships: [
      {
        workspaceId: "workspace-1",
        role: WorkspaceRole.OWNER,
        status: MembershipStatus.ACTIVE,
        workspace: {
          id: "workspace-1",
          name: "Acme",
          profileType: "startup",
        },
      },
    ],
  };
}

function createMultiOrgUser() {
  return {
    id: "user-1",
    email: "owner@example.com",
    phone: "+8613800000000",
    memberships: [
      {
        workspaceId: "workspace-1",
        role: WorkspaceRole.OWNER,
        status: MembershipStatus.ACTIVE,
        workspace: {
          id: "workspace-1",
          name: "Acme",
          profileType: "startup",
        },
      },
      {
        workspaceId: "workspace-2",
        role: WorkspaceRole.ADMIN,
        status: MembershipStatus.ACTIVE,
        workspace: {
          id: "workspace-2",
          name: "Beacon",
          profileType: "sales",
        },
      },
    ],
  };
}

function createEnrollment() {
  return {
    id: "enrollment-1",
    name: "Owner",
    email: "owner@example.com",
    phone: "+8613800000000",
    organizationName: "Acme",
    locale: "en-US",
    passwordHash: "scrypt:hash",
    expiresAt: new Date(now.getTime() + 30 * 60 * 1000),
  };
}

function createSignupInput() {
  return {
    name: "Owner",
    email: "owner@example.com",
    phone: "13800000000",
    organizationName: "Acme",
    password: "Password123",
    confirmPassword: "Password123",
    locale: "en-US" as const,
  };
}

/**
 * Issue a prefill cookie the way the OAuth callback does — through the real
 * writer, so the tests below exercise a genuinely signed value. Hand-rolling
 * the JSON here would be forging it, which is what the attack tests do on
 * purpose and what the legitimate-flow tests must NOT do: a fixture that can
 * mint its own credentials cannot tell a working signature from an absent one.
 */
function issuePrefillCookie(input: {
  email?: string | null;
  phone?: string | null;
  name?: string | null;
  organizationName?: string | null;
  invitedWorkspaceId?: string | null;
  title?: string | null;
}): string {
  let issued = "";
  writePublicOauthSignupPrefillCookie(
    { set: (_name: string, value: string) => { issued = value; } },
    { provider: "dingtalk", ...input },
    now,
  );
  return issued;
}

function installAuthCodeStore(records: AuthCodeRecord[]) {
  mocks.db.authVerificationCode.findFirst.mockImplementation(async ({ where }) => {
    return (
      records.find((record) => {
        if (where.expiresAt?.gt && record.expiresAt.getTime() <= where.expiresAt.gt.getTime()) {
          return false;
        }
        if (where.attempts?.gte && record.attempts < where.attempts.gte) {
          return false;
        }
        return (
          record.purpose === where.purpose &&
          record.target === where.target &&
          record.consumedAt === null &&
          (where.enrollmentId === undefined || record.enrollmentId === where.enrollmentId) &&
          (where.userId === undefined || record.userId === where.userId)
        );
      }) ?? null
    );
  });

  mocks.db.authVerificationCode.deleteMany.mockImplementation(async ({ where }) => {
    let deleted = 0;
    for (const record of records) {
      const targetMatches =
        where.target === undefined
          ? true
          : Array.isArray(where.target?.in)
            ? where.target.in.includes(record.target)
            : record.target === where.target;
      if (
        (!where.purpose || record.purpose === where.purpose) &&
        targetMatches &&
        (where.attempts?.lte === undefined || record.attempts <= where.attempts.lte) &&
        (where.consumedAt === undefined || record.consumedAt === where.consumedAt)
      ) {
        record.consumedAt = now;
        deleted += 1;
      }
    }
    return { count: deleted };
  });

  mocks.db.authVerificationCode.create.mockImplementation(async ({ data }) => {
    const record: AuthCodeRecord = {
      id: `created-${records.length + 1}`,
      purpose: data.purpose,
      channel: data.channel,
      target: data.target,
      codeHash: data.codeHash,
      expiresAt: data.expiresAt,
      attempts: data.attempts ?? 0,
      consumedAt: null,
      enrollmentId: data.enrollmentId ?? null,
      userId: data.userId ?? null,
    };
    records.push(record);
    return record;
  });

  mocks.db.authVerificationCode.updateMany.mockImplementation(async ({ where, data }) => {
    const record = records.find((candidate) => candidate.id === where.id);
    if (!record || record.consumedAt !== null) {
      return { count: 0 };
    }
    if (where.attempts && record.attempts >= where.attempts.lt) {
      return { count: 0 };
    }
    if (data.attempts?.increment) {
      record.attempts += data.attempts.increment;
    }
    if (data.consumedAt !== undefined) {
      record.consumedAt = data.consumedAt;
    }
    return { count: 1 };
  });

  // Emulates the two atomic claim statements in `verifyAuthCode`. Both carry
  // the pre-state in the UPDATE's own WHERE, so a row that is already consumed
  // — or already at the attempt ceiling — yields zero affected rows rather
  // than a successful claim. Anything else throws: a silent 0 would let an
  // implementation change pass as "no rows matched" instead of failing.
  mocks.db.$executeRaw.mockImplementation(
    async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = strings.join("?");
      const record = records.find((candidate) => candidate.id === values[0]);
      if (!record || record.consumedAt !== null) {
        return 0;
      }
      // The statements decide expiry in the database at write time, so the
      // mock must too: an expired row affects zero rows however the caller
      // read it a moment earlier.
      if (
        sql.includes("`expiresAt` > UTC_TIMESTAMP(3)") &&
        record.expiresAt.getTime() <= Date.now()
      ) {
        return 0;
      }
      if (sql.includes("`attempts` = `attempts` + 1")) {
        const ceiling = values[1] as number;
        if (record.attempts >= ceiling) {
          return 0;
        }
        record.attempts += 1;
        return 1;
      }
      if (sql.includes("`consumedAt` = UTC_TIMESTAMP(3)")) {
        record.consumedAt = new Date();
        return 1;
      }
      throw new Error(`unexpected raw auth code statement: ${sql}`);
    },
  );

  mocks.db.authVerificationCode.update.mockImplementation(async ({ where, data }) => {
    const record = records.find((candidate) => candidate.id === where.id);
    if (!record) {
      throw new Error(`unknown auth code ${where.id}`);
    }
    if (data.consumedAt !== undefined) {
      record.consumedAt = data.consumedAt;
    }
    if (data.attempts?.increment) {
      record.attempts += data.attempts.increment;
    }
    return record;
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  vi.clearAllMocks();
  mocks.cookieStore.get.mockReturnValue({ value: "en-US" });
  mocks.session.requireCurrentUser.mockResolvedValue({ id: "user-1" });
  mocks.session.resolvePreferredMembership.mockImplementation(
    (memberships: unknown[]) => memberships[0] ?? null,
  );
  mocks.workspaceOps.normalizeWorkspaceUiConfig.mockReturnValue({ demoMode: null });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("auth verification code attempt cap", () => {
  it("localizes trial signup password confirmation errors from the submitted locale", async () => {
    const result = await startTrialSignupAction({
      ...createSignupInput(),
      confirmPassword: "Password456",
      locale: "zh-CN",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe("两次输入的密码必须一致");
    expect(mocks.db.authEnrollment.create).not.toHaveBeenCalled();
  });

  it("blocks login when the active phone code already reached the attempt cap", async () => {
    const record = makeCodeRecord({
      id: "login-code-1",
      purpose: AuthCodePurpose.LOGIN_PHONE,
      target: "+8613800000000",
      code: "123456",
      attempts: 5,
      userId: "user-1",
    });
    installAuthCodeStore([record]);
    mocks.db.user.findFirst.mockResolvedValue(createActiveUser());

    const result = await loginWithPhoneCodeAction({
      phone: "13800000000",
      code: "123456",
      locale: "en-US",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("Request a new code");
    expect(mocks.db.authVerificationCode.updateMany).not.toHaveBeenCalled();
    expect(mocks.db.authVerificationCode.update).not.toHaveBeenCalled();
    expect(mocks.session.createSession).not.toHaveBeenCalled();
    expect(record.consumedAt).toBeNull();
    expect(record.attempts).toBe(5);
  });

  it("reserves the final invalid login attempt and asks for a new code", async () => {
    const record = makeCodeRecord({
      id: "login-code-2",
      purpose: AuthCodePurpose.LOGIN_PHONE,
      target: "+8613800000000",
      code: "123456",
      attempts: 4,
      userId: "user-1",
    });
    installAuthCodeStore([record]);
    mocks.db.user.findFirst.mockResolvedValue(createActiveUser());

    const result = await loginWithPhoneCodeAction({
      phone: "13800000000",
      code: "999999",
      locale: "en-US",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("Request a new code");
    // The attempt reservation must carry BOTH pre-state conditions in the
    // statement that performs the write, not merely in a preceding read.
    const reservation = mocks.db.$executeRaw.mock.calls.find(
      ([strings]: [TemplateStringsArray]) =>
        strings.join("?").includes("`attempts` = `attempts` + 1"),
    );
    expect(reservation).toBeDefined();
    const [reservationSql, ...reservationValues] = reservation as [
      TemplateStringsArray,
      ...unknown[],
    ];
    expect(reservationSql.join("?")).toContain("`consumedAt` IS NULL");
    expect(reservationSql.join("?")).toContain("`attempts` < ?");
    expect(reservationValues).toEqual(["login-code-2", 5]);
    expect(mocks.db.authVerificationCode.updateMany).not.toHaveBeenCalled();
    expect(mocks.db.authVerificationCode.update).not.toHaveBeenCalled();
    expect(record.attempts).toBe(5);
    expect(record.consumedAt).toBeNull();
  });

  it("allows a valid login code on the final attempt and consumes it", async () => {
    const record = makeCodeRecord({
      id: "login-code-3",
      purpose: AuthCodePurpose.LOGIN_PHONE,
      target: "+8613800000000",
      code: "123456",
      attempts: 4,
      userId: "user-1",
    });
    installAuthCodeStore([record]);
    mocks.db.user.findFirst.mockResolvedValue(createActiveUser());

    const result = await loginWithPhoneCodeAction({
      phone: "13800000000",
      code: "123456",
      locale: "en-US",
    });

    expect(result.ok).toBe(true);
    expect(mocks.session.createSession).toHaveBeenCalledTimes(1);
    expect(record.attempts).toBe(5);
    expect(record.consumedAt).toEqual(now);
  });

  it("redirects to workspace selection when phone-code login user belongs to multiple organizations", async () => {
    const record = makeCodeRecord({
      id: "login-code-multi-workspace",
      purpose: AuthCodePurpose.LOGIN_PHONE,
      target: "+8613800000000",
      code: "123456",
      attempts: 1,
      userId: "user-1",
    });
    installAuthCodeStore([record]);
    mocks.db.user.findFirst.mockResolvedValue(createMultiOrgUser());

    const result = await loginWithPhoneCodeAction({
      phone: "13800000000",
      code: "123456",
    });

    expect(result.ok).toBe(true);
    if (!result.ok || !("redirectTo" in result)) {
      throw new Error("expected successful multi-organization phone login");
    }
    expect(result.redirectTo).toBe("/login/workspaces");
    expect(result.requiresWorkspaceSelection).toBe(true);
    expect(mocks.session.activateMembershipIfInvited).not.toHaveBeenCalled();
  });

  it("refuses a code that expires between the read and the claim", async () => {
    const record = makeCodeRecord({
      id: "login-code-expiring",
      purpose: AuthCodePurpose.LOGIN_PHONE,
      target: "+8613800000000",
      code: "123456",
      attempts: 0,
      userId: "user-1",
    });
    installAuthCodeStore([record]);
    mocks.db.user.findFirst.mockResolvedValue(createActiveUser());

    // Valid when the action reads it; the clock crosses `expiresAt` before the
    // claim runs. The application-clock check at the top of verifyAuthCode has
    // already passed and cannot revisit it, so only a database predicate in
    // the claim statement can still refuse.
    record.expiresAt = new Date(now.getTime() + 1_000);

    // A thrown error would be indistinguishable from any other failure here —
    // the action reports ok:false either way — so the violation is recorded as
    // a fact the test asserts on directly.
    let wroteWithoutExpiryGuard = false;
    mocks.db.$executeRaw.mockImplementation(
      async (strings: TemplateStringsArray, ...values: unknown[]) => {
        const sql = strings.join("?");
        vi.setSystemTime(new Date(now.getTime() + 5_000));
        if (record.id !== values[0] || record.consumedAt !== null) return 0;
        if (!sql.includes("`expiresAt` > UTC_TIMESTAMP(3)")) {
          wroteWithoutExpiryGuard = true;
          return 1;
        }
        return record.expiresAt.getTime() <= Date.now() ? 0 : 1;
      },
    );

    const result = await loginWithPhoneCodeAction({
      phone: "13800000000",
      code: "123456",
      locale: "en-US",
    });

    // The flow must have REACHED the claim; asserting only ok===false would
    // pass on "code not found", which proves nothing about expiry.
    expect(mocks.db.$executeRaw).toHaveBeenCalled();
    expect(wroteWithoutExpiryGuard).toBe(false);
    expect(result.ok).toBe(false);
    expect(mocks.session.createSession).not.toHaveBeenCalled();
    expect(record.consumedAt).toBeNull();
  });

  // The test above crosses expiry BEFORE the first write, so the ATTEMPT
  // RESERVATION is the statement that refuses and the consume claim is never
  // reached — deleting the consume statement's own expiry predicate left the
  // suite green. Here the reservation SUCCEEDS and expiry is crossed only
  // afterwards, which puts the consume claim in the position of being the only
  // thing that can still refuse. Two claims, two predicates, two tests.
  it("refuses to consume a code that expires after the attempt reservation", async () => {
    const record = makeCodeRecord({
      id: "login-code-expiring-after-reservation",
      purpose: AuthCodePurpose.LOGIN_PHONE,
      target: "+8613800000000",
      code: "123456",
      attempts: 0,
      userId: "user-1",
    });
    installAuthCodeStore([record]);
    mocks.db.user.findFirst.mockResolvedValue(createActiveUser());

    // Still valid at the read AND at the attempt reservation; it lapses in the
    // window between the reservation and the claim.
    record.expiresAt = new Date(now.getTime() + 1_000);

    let reservationSucceeded = false;
    let consumeAttempted = false;
    let consumedWithoutExpiryGuard = false;
    mocks.db.$executeRaw.mockImplementation(
      async (strings: TemplateStringsArray, ...values: unknown[]) => {
        const sql = strings.join("?");
        // The database decides expiry from ITS clock at the instant of each
        // write, which is what `Date.now()` stands in for here.
        const expired = record.expiresAt.getTime() <= Date.now();
        if (record.id !== values[0] || record.consumedAt !== null) return 0;

        if (sql.includes("`attempts` = `attempts` + 1")) {
          if (sql.includes("`expiresAt` > UTC_TIMESTAMP(3)") && expired) return 0;
          record.attempts += 1;
          reservationSucceeded = true;
          // Only NOW does the clock cross expiry: the reservation is already
          // committed and cannot be revisited.
          vi.setSystemTime(new Date(now.getTime() + 5_000));
          return 1;
        }

        if (sql.includes("`consumedAt` = UTC_TIMESTAMP(3)")) {
          consumeAttempted = true;
          if (!sql.includes("`expiresAt` > UTC_TIMESTAMP(3)")) {
            // A claim with no expiry predicate spends the code regardless of
            // the database clock. Recorded as a fact rather than thrown: the
            // action reports ok:false on any throw, which would hide it.
            consumedWithoutExpiryGuard = true;
            record.consumedAt = new Date();
            return 1;
          }
          return expired ? 0 : 1;
        }

        throw new Error(`unexpected raw auth code statement: ${sql}`);
      },
    );

    const result = await loginWithPhoneCodeAction({
      phone: "13800000000",
      code: "123456",
      locale: "en-US",
    });

    // The flow must have got PAST the reservation and reached the claim;
    // otherwise this test would prove the same thing as the one above.
    expect(reservationSucceeded).toBe(true);
    expect(record.attempts).toBe(1);
    expect(consumeAttempted).toBe(true);
    expect(consumedWithoutExpiryGuard).toBe(false);
    expect(result.ok).toBe(false);
    expect(mocks.session.createSession).not.toHaveBeenCalled();
    expect(record.consumedAt).toBeNull();
  });

  it("rejects a valid login code when another request already consumed it", async () => {
    const record = makeCodeRecord({
      id: "login-code-4",
      purpose: AuthCodePurpose.LOGIN_PHONE,
      target: "+8613800000000",
      code: "123456",
      attempts: 1,
      userId: "user-1",
    });
    installAuthCodeStore([record]);
    // A competing request consumes the code between this caller's attempt
    // reservation and its claim: the reservation still succeeds, but the
    // claim's `consumedAt IS NULL` no longer holds at write time, so the
    // statement affects zero rows. This is exactly the interleaving a
    // conditional updateMany cannot detect.
    mocks.db.$executeRaw.mockImplementation(
      async (strings: TemplateStringsArray, ..._values: unknown[]) => {
        const sql = strings.join("?");
        if (sql.includes("`attempts` = `attempts` + 1")) {
          record.attempts += 1;
          return 1;
        }
        if (sql.includes("`consumedAt` = UTC_TIMESTAMP(3)")) {
          return 0;
        }
        throw new Error(`unexpected raw auth code statement: ${sql}`);
      },
    );
    mocks.db.user.findFirst.mockResolvedValue(createActiveUser());

    const result = await loginWithPhoneCodeAction({
      phone: "13800000000",
      code: "123456",
      locale: "en-US",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("Request a new code");
    expect(mocks.session.createSession).not.toHaveBeenCalled();
    expect(record.consumedAt).toBeNull();
  });

  it("maps capped signup email codes to a start-again message", async () => {
    const enrollment = createEnrollment();
    const record = makeCodeRecord({
      id: "signup-email-code",
      purpose: AuthCodePurpose.SIGNUP_EMAIL,
      channel: AuthCodeChannel.EMAIL,
      target: enrollment.email,
      code: "123456",
      attempts: 5,
      enrollmentId: enrollment.id,
    });
    installAuthCodeStore([record]);
    mocks.db.authEnrollment.findUnique.mockResolvedValue(enrollment);

    const result = await completeTrialSignupVerificationAction({
      enrollmentId: enrollment.id,
      emailCode: "123456",
      phoneCode: "123456",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("Start signup again");
    expect(mocks.db.authVerificationCode.updateMany).not.toHaveBeenCalled();
  });

  it("maps capped signup phone codes to a start-again message after email succeeds", async () => {
    const enrollment = createEnrollment();
    const emailRecord = makeCodeRecord({
      id: "signup-email-code",
      purpose: AuthCodePurpose.SIGNUP_EMAIL,
      channel: AuthCodeChannel.EMAIL,
      target: enrollment.email,
      code: "123456",
      enrollmentId: enrollment.id,
    });
    const phoneRecord = makeCodeRecord({
      id: "signup-phone-code",
      purpose: AuthCodePurpose.SIGNUP_PHONE,
      channel: AuthCodeChannel.PHONE,
      target: enrollment.phone,
      code: "123456",
      attempts: 5,
      enrollmentId: enrollment.id,
    });
    installAuthCodeStore([emailRecord, phoneRecord]);
    mocks.db.authEnrollment.findUnique.mockResolvedValue(enrollment);

    const result = await completeTrialSignupVerificationAction({
      enrollmentId: enrollment.id,
      emailCode: "123456",
      phoneCode: "123456",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("Start signup again");
    expect(emailRecord.consumedAt).toEqual(now);
    expect(phoneRecord.consumedAt).toBeNull();
  });

  it("carries previous login phone attempts into a resent code", async () => {
    const record = makeCodeRecord({
      id: "login-code-resend",
      purpose: AuthCodePurpose.LOGIN_PHONE,
      target: "+8613800000000",
      code: "123456",
      attempts: 4,
      userId: "user-1",
    });
    installAuthCodeStore([record]);
    mocks.db.user.findFirst.mockResolvedValue({
      ...createActiveUser(),
      phoneVerifiedAt: now,
      memberships: [{ status: MembershipStatus.ACTIVE }],
    });

    const result = await requestPhoneLoginCodeAction({
      phone: "13800000000",
      locale: "en-US",
    });

    expect(result.ok).toBe(true);
    expect(mocks.db.authVerificationCode.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          attempts: 4,
          purpose: AuthCodePurpose.LOGIN_PHONE,
          target: "+8613800000000",
        }),
      }),
    );
  });

  it("does not issue a phone code for a membership outside a private deployment", async () => {
    vi.stubEnv("HELM_DEPLOYMENT_ENTRY_PROFILE", "tenant");
    vi.stubEnv("HELM_DEPLOYMENT_ENTRY_HOME_PATH", "/tenant/home");
    vi.stubEnv("HELM_DEPLOYMENT_ALLOWED_WORKSPACE_SLUGS", "allowed-workspace");
    installAuthCodeStore([]);
    mocks.db.user.findFirst.mockResolvedValue({
      ...createActiveUser(),
      phoneVerifiedAt: now,
      memberships: [
        {
          status: MembershipStatus.ACTIVE,
          workspace: {
            slug: "other-workspace",
            systemKey: null,
          },
        },
      ],
    });

    const result = await requestPhoneLoginCodeAction({
      phone: "13800000000",
      locale: "en-US",
    });

    expect(result.ok).toBe(false);
    expect(mocks.db.authVerificationCode.create).not.toHaveBeenCalled();
  });

  it("rejects resend when a concurrent verification reaches the cap before delete", async () => {
    const record = makeCodeRecord({
      id: "login-code-race-resend",
      purpose: AuthCodePurpose.LOGIN_PHONE,
      target: "+8613800000000",
      code: "123456",
      attempts: 4,
      userId: "user-1",
    });
    installAuthCodeStore([record]);
    mocks.db.authVerificationCode.deleteMany.mockImplementation(async () => {
      record.attempts = 5;
      return { count: 0 };
    });
    mocks.db.user.findFirst.mockResolvedValue({
      ...createActiveUser(),
      phoneVerifiedAt: now,
      memberships: [{ status: MembershipStatus.ACTIVE }],
    });

    const result = await requestPhoneLoginCodeAction({
      phone: "13800000000",
      locale: "en-US",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("Too many login verification attempts");
    expect(mocks.db.authVerificationCode.create).not.toHaveBeenCalled();
    expect(record.attempts).toBe(5);
    expect(record.consumedAt).toBeNull();
  });

  it("does not issue a new login phone code after the active code reached the cap", async () => {
    const record = makeCodeRecord({
      id: "login-code-capped-resend",
      purpose: AuthCodePurpose.LOGIN_PHONE,
      target: "+8613800000000",
      code: "123456",
      attempts: 5,
      userId: "user-1",
    });
    installAuthCodeStore([record]);
    mocks.db.user.findFirst.mockResolvedValue({
      ...createActiveUser(),
      phoneVerifiedAt: now,
      memberships: [{ status: MembershipStatus.ACTIVE }],
    });

    const result = await requestPhoneLoginCodeAction({
      phone: "13800000000",
      locale: "en-US",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("Too many login verification attempts");
    expect(mocks.db.authVerificationCode.deleteMany).not.toHaveBeenCalled();
    expect(mocks.db.authVerificationCode.create).not.toHaveBeenCalled();
  });

  it("does not restart signup when an active email code already reached the cap", async () => {
    const enrollment = createEnrollment();
    const record = makeCodeRecord({
      id: "signup-email-capped-restart",
      purpose: AuthCodePurpose.SIGNUP_EMAIL,
      channel: AuthCodeChannel.EMAIL,
      target: enrollment.email,
      code: "123456",
      attempts: 5,
      enrollmentId: enrollment.id,
    });
    installAuthCodeStore([record]);
    mocks.db.user.findFirst.mockResolvedValue(null);

    const result = await startTrialSignupAction(createSignupInput());

    expect(result.ok).toBe(false);
    expect(result.error).toContain("Too many email verification attempts");
    expect(mocks.db.authEnrollment.deleteMany).not.toHaveBeenCalled();
    expect(mocks.db.authVerificationCode.create).not.toHaveBeenCalled();
  });

  it("allows verified trial signup start even when the same user already belongs to another organization", async () => {
    installAuthCodeStore([]);
    mocks.db.user.findFirst.mockResolvedValue({
      ...createActiveUser(),
      memberships: [{ status: MembershipStatus.ACTIVE }],
    });
    mocks.db.authEnrollment.create.mockResolvedValue(createEnrollment());

    const result = await startTrialSignupAction(createSignupInput());

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected successful signup start for multi-organization membership");
    }
    expect(result.step).toBe("verify");
    expect(mocks.db.authEnrollment.create).toHaveBeenCalledTimes(1);
  });

  it("does not expose signup verification codes in production previews", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PLAYWRIGHT_BASE_URL", "http://127.0.0.1:61053");
    installAuthCodeStore([]);
    mocks.db.user.findFirst.mockResolvedValue(null);
    mocks.db.authEnrollment.create.mockResolvedValue(createEnrollment());

    const result = await startTrialSignupAction(createSignupInput());

    expect(result.ok).toBe(true);
    if (!result.ok || !result.verificationPreview) {
      throw new Error("expected signup verification preview");
    }
    expect(result.verificationPreview.emailCode).toBeNull();
    expect(result.verificationPreview.phoneCode).toBeNull();
  });

  it("does not expose phone login codes in production previews", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PLAYWRIGHT_BASE_URL", "http://127.0.0.1:61053");
    installAuthCodeStore([]);
    mocks.db.user.findFirst.mockResolvedValue({
      ...createActiveUser(),
      phoneVerifiedAt: now,
      memberships: [{ status: MembershipStatus.ACTIVE }],
    });

    const result = await requestPhoneLoginCodeAction({
      phone: "13800000000",
      locale: "en-US",
    });

    expect(result.ok).toBe(true);
    if (!result.ok || !result.verificationPreview) {
      throw new Error("expected phone login verification preview");
    }
    expect(result.verificationPreview.phoneCode).toBeNull();
  });

  it("skips signup auth codes when dingtalk oauth prefill matches enrollment identity", async () => {
    installAuthCodeStore([]);
    const prefillCookie = issuePrefillCookie({
      name: "Owner",
      email: "owner@example.com",
      phone: "+8613800000000",
      organizationName: "Acme",
    });
    mocks.cookieStore.get.mockImplementation((name?: string) => {
      if (name === "helm-public-oauth-signup-prefill") {
        return { value: prefillCookie };
      }
      if (name === "helm-ui-locale") {
        return { value: "en-US" };
      }
      return undefined;
    });
    mocks.db.user.findFirst.mockResolvedValue(null);
    mocks.db.authEnrollment.create.mockResolvedValue(createEnrollment());

    const result = await startTrialSignupAction(createSignupInput());

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected successful signup start");
    }
    expect(result.requiresVerificationCodes).toBe(false);
    expect(mocks.db.authVerificationCode.create).not.toHaveBeenCalled();
  });

  it("completes signup without auth codes when dingtalk oauth prefill matches enrollment identity", async () => {
    installAuthCodeStore([]);
    const prefillCookie = issuePrefillCookie({
      name: "Owner",
      email: "owner@example.com",
      phone: "+8613800000000",
      organizationName: "Acme",
    });
    mocks.cookieStore.get.mockImplementation((name?: string) => {
      if (name === "helm-public-oauth-signup-prefill") {
        return { value: prefillCookie };
      }
      if (name === "helm-ui-locale") {
        return { value: "en-US" };
      }
      return undefined;
    });
    mocks.db.authEnrollment.findUnique.mockResolvedValue(createEnrollment());
    mocks.db.user.findUnique.mockResolvedValue(null);
    mocks.db.user.create.mockResolvedValue({
      id: "user-1",
      email: "owner@example.com",
      name: "Owner",
      phone: "+8613800000000",
      title: null,
      passwordHash: "scrypt:hash",
    });
    mocks.db.user.update.mockResolvedValue({
      id: "user-1",
      email: "owner@example.com",
      name: "Owner",
      phone: "+8613800000000",
      title: null,
    });
    mocks.trialOnboarding.createSelfServeTrialOrganization.mockResolvedValue({
      workspace: {
        id: "workspace-1",
      },
    });

    const result = await completeTrialSignupVerificationAction({
      enrollmentId: "enrollment-1",
      emailCode: "",
      phoneCode: "",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected successful signup completion");
    }
    expect(result.redirectTo).toBe("/setup?onboarding=trial");
    expect(mocks.session.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        workspaceId: "workspace-1",
      }),
    );
  });

  it("joins invited workspace instead of creating a new trial workspace when prefill carries workspace id", async () => {
    installAuthCodeStore([]);
    const prefillCookie = issuePrefillCookie({
      name: "Owner",
      email: "owner@example.com",
      phone: "+8613800000000",
      organizationName: "Acme",
      invitedWorkspaceId: "workspace-invite-1",
    });
    mocks.cookieStore.get.mockImplementation((name?: string) => {
      if (name === "helm-public-oauth-signup-prefill") {
        return { value: prefillCookie };
      }
      if (name === "helm-ui-locale") {
        return { value: "en-US" };
      }
      return undefined;
    });
    mocks.db.authEnrollment.findUnique.mockResolvedValue(createEnrollment());
    mocks.db.user.findUnique.mockResolvedValue(null);
    mocks.db.user.create.mockResolvedValue({
      id: "user-1",
      email: "owner@example.com",
      name: "Owner",
      phone: "+8613800000000",
      title: null,
      passwordHash: "scrypt:hash",
    });
    mocks.db.user.update.mockResolvedValue({
      id: "user-1",
      email: "owner@example.com",
      name: "Owner",
      phone: "+8613800000000",
      title: null,
    });
    // The genuine invite this flow requires: a Membership row already exists
    // for this identity in the target workspace. Without it the cookie is just
    // a request field naming a workspace.
    mocks.db.membership.findFirst.mockResolvedValue({
      workspaceId: "workspace-invite-1",
      workspace: { id: "workspace-invite-1", slug: "invite", systemKey: null },
    });
    mocks.db.workspace.findUnique.mockResolvedValue({
      id: "workspace-invite-1",
    });
    mocks.db.membership.findUnique.mockResolvedValue(null);
    mocks.db.membership.upsert.mockResolvedValue({
      workspaceId: "workspace-invite-1",
      userId: "user-1",
      role: WorkspaceRole.MEMBER,
      status: MembershipStatus.ACTIVE,
    });

    const result = await completeTrialSignupVerificationAction({
      enrollmentId: "enrollment-1",
      emailCode: "",
      phoneCode: "",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected successful invited join");
    }
    expect(result.redirectTo).toBe("/dashboard");
    expect(mocks.db.membership.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          workspaceId_userId: {
            workspaceId: "workspace-invite-1",
            userId: "user-1",
          },
        },
      }),
    );
    expect(mocks.trialOnboarding.createSelfServeTrialOrganization).not.toHaveBeenCalled();
    expect(mocks.session.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        workspaceId: "workspace-invite-1",
      }),
    );
  });

  // A REVOKED INVITE MUST NOT BE RESURRECTED BY SIGNUP.
  //
  // hasAllowedInviteMembership checks that a non-INACTIVE membership exists for
  // this identity, and that check is real. But it runs BEFORE the write, and it
  // matches by email/phone rather than by the row the write targets. The write
  // itself was an upsert whose `update` branch set status: ACTIVE
  // unconditionally, so a membership revoked in that window came back ACTIVE
  // and the user was seated in the workspace they had just been removed from.
  it("refuses to join a workspace whose membership has been revoked", async () => {
    installAuthCodeStore([]);
    const prefillCookie = issuePrefillCookie({
      name: "Owner",
      email: "owner@example.com",
      phone: "+8613800000000",
      organizationName: "Acme",
      invitedWorkspaceId: "workspace-invite-1",
    });
    mocks.cookieStore.get.mockImplementation((name?: string) => {
      if (name === "helm-public-oauth-signup-prefill") {
        return { value: prefillCookie };
      }
      if (name === "helm-ui-locale") {
        return { value: "en-US" };
      }
      return undefined;
    });
    mocks.db.authEnrollment.findUnique.mockResolvedValue(createEnrollment());
    mocks.db.user.findUnique.mockResolvedValue(null);
    mocks.db.user.create.mockResolvedValue({
      id: "user-1",
      email: "owner@example.com",
      name: "Owner",
      phone: "+8613800000000",
      title: null,
      passwordHash: "scrypt:hash",
    });
    mocks.db.user.update.mockResolvedValue({
      id: "user-1",
      email: "owner@example.com",
      name: "Owner",
      phone: "+8613800000000",
      title: null,
    });
    // The pre-check still sees a live invite for this identity.
    mocks.db.membership.findFirst.mockResolvedValue({
      workspaceId: "workspace-invite-1",
      workspace: { id: "workspace-invite-1", slug: "invite", systemKey: null },
    });
    mocks.db.workspace.findUnique.mockResolvedValue({
      id: "workspace-invite-1",
    });
    // ...but THIS user's membership in that workspace has been revoked.
    mocks.db.membership.findUnique.mockResolvedValue({
      role: WorkspaceRole.MEMBER,
      title: null,
      persona: null,
      status: MembershipStatus.INACTIVE,
    });
    mocks.trialOnboarding.createSelfServeTrialOrganization.mockResolvedValue({
      workspace: { id: "workspace-trial-1" },
    });

    const result = await completeTrialSignupVerificationAction({
      enrollmentId: "enrollment-1",
      emailCode: "",
      phoneCode: "",
    });

    // The revoked membership is never written back to ACTIVE.
    expect(mocks.db.membership.upsert).not.toHaveBeenCalled();
    // And no session is seated in the workspace they were removed from.
    expect(mocks.session.createSession).not.toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: "workspace-invite-1" }),
    );
    // Signup itself still completes: a revoked invite is not a reason to refuse
    // the account, only a reason not to join that workspace.
    expect(result.ok).toBe(true);
    expect(
      mocks.trialOnboarding.createSelfServeTrialOrganization,
    ).toHaveBeenCalled();
  });

  it("fills membership title from invite prefill when signup form title is empty", async () => {
    installAuthCodeStore([]);
    const prefillCookie = issuePrefillCookie({
      name: "Owner",
      email: "owner@example.com",
      phone: "+8613800000000",
      organizationName: "Acme",
      invitedWorkspaceId: "workspace-invite-1",
      title: "高级JAVA开发工程师",
    });
    mocks.cookieStore.get.mockImplementation((name?: string) => {
      if (name === "helm-public-oauth-signup-prefill") {
        return { value: prefillCookie };
      }
      if (name === "helm-ui-locale") {
        return { value: "zh-CN" };
      }
      return undefined;
    });
    mocks.db.authEnrollment.findUnique.mockResolvedValue(createEnrollment());
    mocks.db.user.findUnique.mockResolvedValue(null);
    mocks.db.user.create.mockResolvedValue({
      id: "user-1",
      email: "owner@example.com",
      name: "Owner",
      phone: "+8613800000000",
      title: null,
      passwordHash: "scrypt:hash",
    });
    mocks.db.user.update.mockResolvedValue({
      id: "user-1",
      email: "owner@example.com",
      name: "Owner",
      phone: "+8613800000000",
      title: "高级JAVA开发工程师",
    });
    // The genuine invite this flow requires: a Membership row already exists
    // for this identity in the target workspace. Without it the cookie is just
    // a request field naming a workspace.
    mocks.db.membership.findFirst.mockResolvedValue({
      workspaceId: "workspace-invite-1",
      workspace: { id: "workspace-invite-1", slug: "invite", systemKey: null },
    });
    mocks.db.workspace.findUnique.mockResolvedValue({
      id: "workspace-invite-1",
    });
    mocks.db.membership.findUnique.mockResolvedValue(null);
    mocks.db.membership.upsert.mockResolvedValue({
      workspaceId: "workspace-invite-1",
      userId: "user-1",
      role: WorkspaceRole.MEMBER,
      status: MembershipStatus.ACTIVE,
      title: "高级JAVA开发工程师",
      persona: "高级JAVA开发工程师",
    });

    const result = await completeTrialSignupVerificationAction({
      enrollmentId: "enrollment-1",
      emailCode: "",
      phoneCode: "",
      title: "",
    });

    expect(result.ok).toBe(true);
    expect(mocks.db.membership.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          title: "高级JAVA开发工程师",
          persona: "高级JAVA开发工程师",
        }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// THE PREFILL COOKIE IS AN AUTHORIZATION INPUT, SO IT MUST BE UNFORGEABLE.
//
// `completeTrialSignupVerificationAction` lives in a "use server" module: it is
// publicly invocable and unauthenticated. It reads the OAuth signup prefill
// COOKIE and lets it decide two things — whether email and phone verification
// codes are required at all, and which workspace the new account joins.
// `httpOnly` does not help here: it stops page JavaScript from READING the
// cookie, it does nothing about a client that simply sends whatever Cookie
// header it likes.
//
// These tests are written as an attacker, not as a description of the fix:
// they forge a cookie and assert the outcome the attacker wants is REFUSED.
// ---------------------------------------------------------------------------
describe("forged OAuth signup prefill cookie", () => {
  const FORGED = JSON.stringify({
    provider: "dingtalk",
    name: "Mallory",
    email: "attacker@example.com",
    phone: "+8613900000000",
    organizationName: "Anything",
    invitedWorkspaceId: "workspace-victim",
    expiresAt: "2099-01-01T00:00:00.000Z",
  });

  function sendCookie(value: string) {
    mocks.cookieStore.get.mockImplementation((name?: string) => {
      if (name === "helm-public-oauth-signup-prefill") return { value };
      if (name === "helm-ui-locale") return { value: "en-US" };
      return undefined;
    });
  }

  function attackerEnrollment() {
    return {
      id: "enrollment-attack",
      name: "Mallory",
      email: "attacker@example.com",
      phone: "+8613900000000",
      organizationName: "Anything",
      locale: "en-US",
      passwordHash: "scrypt:hash",
      expiresAt: new Date(now.getTime() + 30 * 60 * 1000),
    };
  }

  beforeEach(() => {
    installAuthCodeStore([]);
    mocks.db.authEnrollment.findUnique.mockResolvedValue(attackerEnrollment());
    mocks.db.user.findUnique.mockResolvedValue(null);
    mocks.db.user.create.mockResolvedValue({
      id: "user-attacker",
      email: "attacker@example.com",
      name: "Mallory",
      phone: "+8613900000000",
      title: null,
      passwordHash: "scrypt:hash",
    });
    mocks.db.user.update.mockResolvedValue({
      id: "user-attacker",
      email: "attacker@example.com",
      name: "Mallory",
      phone: "+8613900000000",
      title: null,
    });
    mocks.db.workspace.findUnique.mockResolvedValue({ id: "workspace-victim" });
    mocks.db.membership.findUnique.mockResolvedValue(null);
    mocks.db.membership.upsert.mockResolvedValue({
      workspaceId: "workspace-victim",
      userId: "user-attacker",
      role: WorkspaceRole.MEMBER,
      status: MembershipStatus.ACTIVE,
    });
    // No membership exists for this identity in the target workspace: the
    // attacker was never invited. This is the fact the fix must consult.
    mocks.db.membership.findFirst.mockResolvedValue(null);
  });

  it("CONTROL: the harness can reach a successful signup (a refusal here means the setup broke)", async () => {
    // Same fixtures, real verification codes, no cookie. If this cannot
    // succeed, the refusals asserted below prove nothing.
    sendCookie("");
    const enrollment = attackerEnrollment();
    installAuthCodeStore([
      makeCodeRecord({
        id: "signup-email",
        purpose: AuthCodePurpose.SIGNUP_EMAIL,
        channel: AuthCodeChannel.EMAIL,
        target: enrollment.email,
        code: "123456",
        enrollmentId: enrollment.id,
      }),
      makeCodeRecord({
        id: "signup-phone",
        purpose: AuthCodePurpose.SIGNUP_PHONE,
        channel: AuthCodeChannel.PHONE,
        target: enrollment.phone,
        code: "123456",
        enrollmentId: enrollment.id,
      }),
    ]);

    const result = await completeTrialSignupVerificationAction({
      enrollmentId: enrollment.id,
      emailCode: "123456",
      phoneCode: "123456",
    });

    expect(result.ok).toBe(true);
  });

  it("refuses to skip verification codes for an unsigned, attacker-authored cookie", async () => {
    sendCookie(FORGED);

    const result = await completeTrialSignupVerificationAction({
      enrollmentId: "enrollment-attack",
      // No codes at all. The whole point of the attack is that the cookie
      // makes the codes optional.
      emailCode: "",
      phoneCode: "",
    });

    expect(result.ok).toBe(false);
    // The account must not exist, and must certainly not be stamped as having
    // had its email and phone verified.
    expect(mocks.db.user.create).not.toHaveBeenCalled();
    expect(mocks.session.createSession).not.toHaveBeenCalled();
  });

  it("refuses to grant workspace membership named by an unsigned cookie", async () => {
    sendCookie(FORGED);

    await completeTrialSignupVerificationAction({
      enrollmentId: "enrollment-attack",
      emailCode: "",
      phoneCode: "",
    });

    // ACTIVE MEMBER of a workspace the attacker merely named in a cookie is
    // the payload of this attack; nothing less than zero upserts is a pass.
    expect(mocks.db.membership.upsert).not.toHaveBeenCalled();
  });

  // A SIGNATURE PROVES ORIGIN, NOT ENTITLEMENT. The workspace id in this
  // cookie comes from the OAuth start URL's query parameters, so whoever began
  // the flow chose it; the signature only says WE serialised it. An attacker
  // who completes a perfectly genuine DingTalk sign-in, having started it with
  // someone else's workspace id in the URL, holds a validly signed cookie
  // naming a workspace they were never invited to. Membership must therefore
  // rest on a real invite record, never on the cookie.
  it("refuses workspace membership from a GENUINELY SIGNED cookie with no invite behind it", async () => {
    const enrollment = attackerEnrollment();
    mocks.cookieStore.get.mockImplementation((name?: string) => {
      if (name === "helm-public-oauth-signup-prefill") {
        return {
          value: issuePrefillCookie({
            name: enrollment.name,
            email: enrollment.email,
            phone: enrollment.phone,
            organizationName: "Anything",
            invitedWorkspaceId: "workspace-victim",
          }),
        };
      }
      if (name === "helm-ui-locale") return { value: "en-US" };
      return undefined;
    });
    // The decisive fact: no Membership row ties this identity to that
    // workspace.
    mocks.db.membership.findFirst.mockResolvedValue(null);
    mocks.trialOnboarding.createSelfServeTrialOrganization.mockResolvedValue({
      workspace: { id: "workspace-fresh-trial" },
    });

    const result = await completeTrialSignupVerificationAction({
      enrollmentId: enrollment.id,
      emailCode: "",
      phoneCode: "",
    });

    // Signup itself may proceed — the OAuth identity is genuine — but the
    // account must land in its own new trial workspace, never as an ACTIVE
    // MEMBER of the one the cookie named.
    expect(mocks.db.membership.upsert).not.toHaveBeenCalled();
    expect(mocks.session.createSession).not.toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: "workspace-victim" }),
    );
    if (result.ok) {
      expect(mocks.trialOnboarding.createSelfServeTrialOrganization).toHaveBeenCalled();
    }
  });

  it("refuses a cookie whose JSON is well-formed but whose signature is absent or wrong", async () => {
    for (const value of [
      FORGED,
      `${FORGED}.`,
      `${FORGED}.not-a-real-signature`,
      `.${FORGED}`,
    ]) {
      mocks.db.user.create.mockClear();
      mocks.db.membership.upsert.mockClear();
      sendCookie(value);

      const result = await completeTrialSignupVerificationAction({
        enrollmentId: "enrollment-attack",
        emailCode: "",
        phoneCode: "",
      });

      expect(result.ok, `cookie variant: ${value.slice(0, 24)}`).toBe(false);
      expect(mocks.db.membership.upsert).not.toHaveBeenCalled();
    }
  });
});

describe("password login action", () => {
  it("returns a user-facing unavailable error when user lookup fails", async () => {
    mocks.db.user.findFirst.mockRejectedValue(new Error("database unavailable"));

    const result = await passwordLoginAction({
      identifier: "owner@example.com",
      password: "Password123",
      locale: "en-US",
    });

    expect(result).toEqual({
      ok: false,
      error: "Unable to sign in right now. Please try again later.",
    });
    expect(mocks.session.createSession).not.toHaveBeenCalled();
  });

  it("keeps missing users on the generic credential error path", async () => {
    mocks.db.user.findFirst.mockResolvedValue(null);

    const result = await passwordLoginAction({
      identifier: "missing@example.com",
      password: "Password123",
      locale: "en-US",
    });

    expect(result).toEqual({
      ok: false,
      error: "Incorrect email/phone or password.",
    });
    expect(mocks.session.createSession).not.toHaveBeenCalled();
  });
});

describe("first-login identity completion action", () => {
  it("localizes incomplete password confirmation errors from the submitted locale", async () => {
    const result = await completeFirstLoginIdentityCompletionAction({
      password: "Password123",
      locale: "zh-CN",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe("请完整填写密码和确认密码");
    expect(mocks.session.requireCurrentUser).not.toHaveBeenCalled();
  });

  it("does not route first-time demo users into identity completion", async () => {
    mocks.cookieStore.get.mockImplementation((name?: string) => {
      if (name === "helm-ui-locale") {
        return { value: "zh-CN" };
      }
      return undefined;
    });
    mocks.workspaceOps.normalizeWorkspaceUiConfig.mockReturnValue({ demoMode: "founder" });
    mocks.db.user.findUnique.mockResolvedValue({
      id: "demo-user-1",
      email: "founder@demo.com",
      name: "林舟",
      phone: "+8613800000000",
      passwordHash: null,
      lastLoginAt: null,
      memberships: [
        {
          workspaceId: "demo-workspace-1",
          role: WorkspaceRole.OWNER,
          status: MembershipStatus.ACTIVE,
          workspace: {
            id: "demo-workspace-1",
            name: "创始人经营工作台 Demo",
            profileType: null,
          },
        },
      ],
    });

    const result = await loginAction("founder@demo.com");

    expect(result.ok).toBe(true);
    if (!result.ok || !("redirectTo" in result)) {
      throw new Error("expected demo login success");
    }
    expect(result.redirectTo).toBe("/dashboard");
    expect(result.entryKind).toBe("demo");
    expect(mocks.cookieStore.set).not.toHaveBeenCalledWith(
      "helm-first-login-identity-setup",
      "1",
      expect.any(Object),
    );
    expect(mocks.cookieStore.delete).toHaveBeenCalledWith("helm-first-login-identity-setup");
  });

  it("fills missing phone and password, then clears pending cookie", async () => {
    const cookieValues: Record<string, string> = {
      "helm-ui-locale": "en-US",
      "helm-active-workspace": "workspace-1",
      "helm-first-login-identity-setup": "1",
    };
    mocks.cookieStore.get.mockImplementation((name?: string) => {
      if (!name) {
        return undefined;
      }
      const value = cookieValues[name];
      return value ? { value } : undefined;
    });
    mocks.db.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "owner@example.com",
      phone: null,
      passwordHash: null,
      memberships: [
        {
          workspaceId: "workspace-1",
          role: WorkspaceRole.OWNER,
          status: MembershipStatus.ACTIVE,
          workspace: {
            id: "workspace-1",
            name: "Acme",
            profileType: null,
            defaultLocale: "en-US",
            pilotMode: true,
            dataRetentionDays: 90,
            captureConsentRequired: true,
            featureFlagsJson: null,
          },
        },
      ],
    });

    const result = await completeFirstLoginIdentityCompletionAction({
      phone: "13800000000",
      password: "Password123",
      confirmPassword: "Password123",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected successful completion");
    }
    expect(result.redirectTo).toBe("/setup");
    expect(mocks.db.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-1" },
        data: expect.objectContaining({
          email: "owner@example.com",
          phone: "+8613800000000",
          passwordHash: expect.any(String),
          passwordSetAt: expect.any(Date),
        }),
      }),
    );
    expect(mocks.cookieStore.delete).toHaveBeenCalledWith("helm-first-login-identity-setup");
  });

  it("rejects invalid phone when phone补录 is required", async () => {
    const cookieValues: Record<string, string> = {
      "helm-ui-locale": "zh-CN",
      "helm-active-workspace": "workspace-1",
      "helm-first-login-identity-setup": "1",
    };
    mocks.cookieStore.get.mockImplementation((name?: string) => {
      if (!name) {
        return undefined;
      }
      const value = cookieValues[name];
      return value ? { value } : undefined;
    });
    mocks.db.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "owner@example.com",
      phone: null,
      passwordHash: "hashed",
      memberships: [
        {
          workspaceId: "workspace-1",
          role: WorkspaceRole.MEMBER,
          status: MembershipStatus.ACTIVE,
          workspace: {
            id: "workspace-1",
            name: "Acme",
            profileType: "sales",
          },
        },
      ],
    });

    const result = await completeFirstLoginIdentityCompletionAction({
      phone: "abc",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("有效手机号");
    expect(mocks.db.user.update).not.toHaveBeenCalled();
  });

  it("skips update when pending cookie is absent", async () => {
    const cookieValues: Record<string, string> = {
      "helm-ui-locale": "en-US",
      "helm-active-workspace": "workspace-1",
    };
    mocks.cookieStore.get.mockImplementation((name?: string) => {
      if (!name) {
        return undefined;
      }
      const value = cookieValues[name];
      return value ? { value } : undefined;
    });
    mocks.db.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "owner@example.com",
      phone: "+8613800000000",
      passwordHash: "hashed",
      memberships: [
        {
          workspaceId: "workspace-1",
          role: WorkspaceRole.MEMBER,
          status: MembershipStatus.ACTIVE,
          workspace: {
            id: "workspace-1",
            name: "Acme",
            profileType: "sales",
          },
        },
      ],
    });

    const result = await completeFirstLoginIdentityCompletionAction({
      email: "owner@example.com",
      phone: "13800000000",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected successful redirect");
    }
    expect(result.redirectTo).toBe("/dashboard");
    expect(mocks.db.user.update).not.toHaveBeenCalled();
  });
});
