import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthCodeChannel, AuthCodePurpose, MembershipStatus, WorkspaceRole } from "@prisma/client";
import { hashVerificationCode } from "@/lib/auth/formal-auth";

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
    expect(mocks.db.authVerificationCode.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "login-code-2",
          attempts: { lt: 5 },
          consumedAt: null,
        }),
      }),
    );
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
    mocks.db.authVerificationCode.updateMany.mockImplementation(async ({ where, data }) => {
      if (where.attempts?.lt) {
        record.attempts += data.attempts.increment;
        return { count: 1 };
      }
      return { count: 0 };
    });
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
    const prefillCookie = JSON.stringify({
      provider: "dingtalk",
      name: "Owner",
      email: "owner@example.com",
      phone: "+8613800000000",
      organizationName: "Acme",
      expiresAt: "2099-01-01T00:00:00.000Z",
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
    const prefillCookie = JSON.stringify({
      provider: "dingtalk",
      name: "Owner",
      email: "owner@example.com",
      phone: "+8613800000000",
      organizationName: "Acme",
      expiresAt: "2099-01-01T00:00:00.000Z",
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
    const prefillCookie = JSON.stringify({
      provider: "dingtalk",
      name: "Owner",
      email: "owner@example.com",
      phone: "+8613800000000",
      organizationName: "Acme",
      invitedWorkspaceId: "workspace-invite-1",
      expiresAt: "2099-01-01T00:00:00.000Z",
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

  it("fills membership title from invite prefill when signup form title is empty", async () => {
    installAuthCodeStore([]);
    const prefillCookie = JSON.stringify({
      provider: "dingtalk",
      name: "Owner",
      email: "owner@example.com",
      phone: "+8613800000000",
      organizationName: "Acme",
      invitedWorkspaceId: "workspace-invite-1",
      title: "高级JAVA开发工程师",
      expiresAt: "2099-01-01T00:00:00.000Z",
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
