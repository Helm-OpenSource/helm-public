"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import {
  AuthCodeChannel,
  AuthCodePurpose,
  MembershipStatus,
  WorkspaceRole,
  type User,
  type Workspace,
} from "@prisma/client";
import { db } from "@/lib/db";
import {
  ACTIVE_WORKSPACE_COOKIE,
  activateMembershipIfInvited,
  clearSession,
  createSession,
  requireCurrentUser,
  resolvePreferredMembership,
  setActiveWorkspace,
} from "@/lib/auth/session";
import { FIRST_LOGIN_IDENTITY_SETUP_COOKIE } from "@/lib/auth/session-cookies";
import { AUTH_SESSION_PROVIDER_TYPES, type AuthSessionProviderType } from "@/lib/auth/provider-seam";
import { createSelfServeTrialOrganization } from "@/lib/auth/trial-onboarding";
import { logEvent } from "@/lib/analytics";
import { resolveUiLocale, type UiLocale, UI_LOCALE_COOKIE } from "@/lib/i18n/config";
import { normalizeWorkspaceUiConfig } from "@/lib/workspace-ops";
import {
  addMinutes,
  AUTH_CODE_TTL_MINUTES,
  buildVerificationPreview,
  canExposeVerificationCodePreview,
  generateVerificationCode,
  hashPassword,
  hashVerificationCode,
  normalizeEmailAddress,
  normalizePhoneNumber,
  shouldForceVerificationCodePreview,
  SIGNUP_ENROLLMENT_TTL_MINUTES,
  verifyHashedVerificationCode,
  verifyPassword,
} from "@/lib/auth/formal-auth";
import { recordUserLastLogin } from "@/lib/auth/login-activity";
import {
  PUBLIC_OAUTH_SIGNUP_PREFILL_COOKIE,
  readPublicOauthSignupPrefillCookie,
} from "@/lib/auth/public-oauth";
import {
  getSystemMailSenderEmail,
  sendSystemMailIfConfigured,
  SYSTEM_MAIL_PURPOSES,
} from "@/lib/notifications/system-mail";
import { getDemoModeProfiles } from "@/lib/demo/demo-modes";
import {
  FIRST_LOGIN_IDENTITY_SETUP_PATH,
  resolvePostLoginRedirectPath,
  shouldRequireFirstLoginIdentityCompletion,
} from "@/lib/auth/first-login-identity-completion";

const codeSchema = z.string().trim().regex(/^\d{6}$/);
const authValidationMessages = {
  passwordConfirmationIncomplete: {
    zh: "请完整填写密码和确认密码",
    en: "Password confirmation is incomplete",
  },
  passwordsMustMatch: {
    zh: "两次输入的密码必须一致",
    en: "Passwords must match",
  },
} as const;

type AuthValidationMessageKey = keyof typeof authValidationMessages;

function getAuthValidationMessage(locale: UiLocale, key: AuthValidationMessageKey) {
  const message = authValidationMessages[key];
  return locale === "en-US" ? message.en : message.zh;
}

function resolveAuthValidationIssueMessage(
  locale: UiLocale,
  issueMessage?: string,
  fallback?: string,
) {
  if (issueMessage && issueMessage in authValidationMessages) {
    return getAuthValidationMessage(locale, issueMessage as AuthValidationMessageKey);
  }

  return issueMessage ?? fallback;
}

const passwordSchema = z
  .string()
  .min(8)
  .regex(/[A-Za-z]/, "Password must include a letter")
  .regex(/\d/, "Password must include a number");

const publicLocaleSchema = z.enum(["zh-CN", "en-US"]);

const legacyEmailLoginSchema = z.object({
  email: z.string().email(),
  locale: publicLocaleSchema.optional(),
});

const trialSignupSchema = z
  .object({
    name: z.string().trim().min(1).max(40),
    email: z.string().email(),
    phone: z.string().trim().min(1).max(32),
    organizationName: z.string().trim().min(2).max(60),
    title: z.string().trim().max(80).optional(),
    password: passwordSchema,
    confirmPassword: z.string().min(8),
    locale: z.enum(["zh-CN", "en-US"]).optional(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "passwordsMustMatch",
    path: ["confirmPassword"],
  });

const completeSignupSchema = z.object({
  enrollmentId: z.string().min(1),
  emailCode: z.string().trim().optional(),
  phoneCode: z.string().trim().optional(),
  title: z.string().trim().max(80).optional(),
  locale: publicLocaleSchema.optional(),
});

const passwordLoginSchema = z.object({
  identifier: z.string().trim().min(1).max(120),
  password: z.string().min(8),
  locale: publicLocaleSchema.optional(),
});

const requestPhoneLoginCodeSchema = z.object({
  phone: z.string().trim().min(1).max(32),
  locale: publicLocaleSchema.optional(),
});

const phoneCodeLoginSchema = z.object({
  phone: z.string().trim().min(1).max(32),
  code: codeSchema,
  locale: publicLocaleSchema.optional(),
});

const firstLoginIdentityCompletionSchema = z
  .object({
    email: z.string().optional(),
    phone: z.string().optional(),
    password: z.string().optional(),
    confirmPassword: z.string().optional(),
    locale: publicLocaleSchema.optional(),
  })
  .superRefine((value, ctx) => {
    const hasPasswordInput = Boolean(value.password || value.confirmPassword);
    if (!hasPasswordInput) {
      return;
    }
    if (!value.password || !value.confirmPassword) {
      ctx.addIssue({
        code: "custom",
        message: "passwordConfirmationIncomplete",
        path: ["confirmPassword"],
      });
      return;
    }
    if (value.password !== value.confirmPassword) {
      ctx.addIssue({
        code: "custom",
        message: "passwordsMustMatch",
        path: ["confirmPassword"],
      });
      return;
    }
    const passwordParsed = passwordSchema.safeParse(value.password);
    if (!passwordParsed.success) {
      ctx.addIssue({
        code: "custom",
        message: passwordParsed.error.issues[0]?.message ?? "Password format invalid",
        path: ["password"],
      });
    }
  });

const loginWorkspaceSelectionSchema = z.object({
  workspaceId: z.string().min(1),
  locale: publicLocaleSchema.optional(),
});
const LOGIN_WORKSPACE_SELECTOR_PATH = "/login/workspaces";

type AuthUser = User & {
  memberships: Array<{
    workspaceId: string;
    role: WorkspaceRole;
    status: MembershipStatus;
    workspace: Workspace;
  }>;
};

function resolveActionInputLocale(input: unknown): UiLocale {
  if (typeof input !== "object" || input === null || !("locale" in input)) {
    return resolveUiLocale();
  }

  const locale = (input as { locale?: string | null }).locale;
  return resolveUiLocale(locale ?? undefined);
}

export async function updatePublicLocaleAction(nextLocale: UiLocale) {
  const parsed = publicLocaleSchema.safeParse(nextLocale);

  if (!parsed.success) {
    return {
      ok: false as const,
      error: "INVALID_LOCALE",
    };
  }

  const cookieStore = await cookies();
  const locale = resolveUiLocale(parsed.data);

  cookieStore.set(UI_LOCALE_COOKIE, locale, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  return {
    ok: true as const,
    locale,
  };
}

async function finalizeLoginForUser(
  user: AuthUser,
  sourcePage: string,
  providerType: AuthSessionProviderType,
  locale: UiLocale,
) {
  const english = locale === "en-US";
  const cookieStore = await cookies();
  const activeWorkspaceId = cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value;
  const selectableMemberships = user.memberships.filter(
    (membership) => membership.status !== MembershipStatus.INACTIVE,
  );
  const activeMembership = resolvePreferredMembership(
    selectableMemberships,
    activeWorkspaceId,
  );

  if (!activeMembership) {
    return {
      ok: false as const,
      error: english
        ? "This account is not attached to an active organization."
        : "当前账号还没有可进入的组织。",
    };
  }

  const requiresWorkspaceSelection = selectableMemberships.length > 1;
  await recordUserLastLogin(user.id);
  const workspaceConfig = normalizeWorkspaceUiConfig(activeMembership.workspace);
  const requiresIdentityCompletion =
    !workspaceConfig.demoMode && shouldRequireFirstLoginIdentityCompletion(user);
  const entryKind = workspaceConfig.demoMode
    ? "demo"
    : activeMembership.status === MembershipStatus.INVITED
      ? "invited"
      : "workspace";

  if (
    activeMembership.status === MembershipStatus.INVITED &&
    !requiresWorkspaceSelection
  ) {
    await activateMembershipIfInvited({
      workspaceId: activeMembership.workspaceId,
      userId: user.id,
    });
  }

  await createSession({
    userId: user.id,
    email: user.email,
    workspaceId: activeMembership.workspaceId,
    sourcePage,
    providerType,
  });

  if (requiresIdentityCompletion) {
    cookieStore.set(FIRST_LOGIN_IDENTITY_SETUP_COOKIE, "1", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 14,
    });
  } else {
    cookieStore.delete(FIRST_LOGIN_IDENTITY_SETUP_COOKIE);
  }

  const redirectTo = requiresWorkspaceSelection
    ? LOGIN_WORKSPACE_SELECTOR_PATH
    : requiresIdentityCompletion
      ? FIRST_LOGIN_IDENTITY_SETUP_PATH
      : resolvePostLoginRedirectPath(activeMembership);

  await logEvent({
    workspaceId: activeMembership.workspaceId,
    userId: user.id,
    eventName: "daily_login",
    eventCategory: "auth",
    targetType: "User",
    targetId: user.id,
    metadata: {
      email: user.email,
      phone: user.phone,
      sourcePage,
    },
    sourcePage,
  });

  return {
    ok: true as const,
    redirectTo,
    workspaceName: activeMembership.workspace.name ?? (english ? "your workspace" : "当前工作区"),
    entryKind,
    requiresWorkspaceSelection,
  };
}

async function findUserByIdentifier(identifier: string) {
  const email = identifier.includes("@") ? normalizeEmailAddress(identifier) : null;
  const phone = email ? null : normalizePhoneNumber(identifier);

  if (!email && !phone) {
    return null;
  }

  return db.user.findFirst({
    where: email ? { email } : { phone: phone ?? undefined },
    include: {
      memberships: {
        where: {
          status: {
            not: MembershipStatus.INACTIVE,
          },
        },
        orderBy: {
          createdAt: "asc",
        },
        include: {
          workspace: true,
        },
      },
    },
  });
}

const AUTH_CODE_MAX_ATTEMPTS = 5;

class AuthCodeIssueAttemptsExceededError extends Error {
  constructor() {
    super("auth_code_attempts_exceeded");
    this.name = "AuthCodeIssueAttemptsExceededError";
  }
}

function isAuthCodeIssueAttemptsExceededError(error: unknown) {
  return error instanceof AuthCodeIssueAttemptsExceededError;
}

async function resolveAuthCodeIssueAttemptCarry(input: {
  purpose: AuthCodePurpose;
  target: string;
}) {
  const activeCode = await db.authVerificationCode.findFirst({
    where: {
      purpose: input.purpose,
      target: input.target,
      consumedAt: null,
      expiresAt: {
        gt: new Date(),
      },
    },
    orderBy: [{ attempts: "desc" }, { createdAt: "desc" }],
    select: {
      attempts: true,
    },
  });
  return activeCode?.attempts ?? 0;
}

function getAuthCodeIssueAttemptsExceededMessage(input: {
  flow: "signup" | "login";
  channel?: "email" | "phone";
  english: boolean;
}) {
  if (input.flow === "login") {
    return input.english
      ? "Too many login verification attempts. Wait for the current code to expire before requesting a new code."
      : "登录验证码尝试次数过多，请等待当前验证码过期后再重新获取。";
  }

  if (input.channel === "email") {
    return input.english
      ? "Too many email verification attempts. Wait for the current code to expire before starting signup again."
      : "邮箱验证码尝试次数过多，请等待当前验证码过期后再重新开始注册。";
  }

  return input.english
    ? "Too many phone verification attempts. Wait for the current code to expire before starting signup again."
    : "手机验证码尝试次数过多，请等待当前验证码过期后再重新开始注册。";
}

async function issueAuthCode(input: {
  purpose: AuthCodePurpose;
  channel: AuthCodeChannel;
  target: string;
  enrollmentId?: string;
  userId?: string;
  initialAttempts?: number;
}) {
  const code = generateVerificationCode();
  const expiresAt = addMinutes(new Date(), AUTH_CODE_TTL_MINUTES);
  const initialAttempts =
    input.initialAttempts ?? (await resolveAuthCodeIssueAttemptCarry(input));

  if (initialAttempts >= AUTH_CODE_MAX_ATTEMPTS) {
    throw new AuthCodeIssueAttemptsExceededError();
  }

  await db.authVerificationCode.deleteMany({
    where: {
      purpose: input.purpose,
      target: input.target,
      consumedAt: null,
      attempts: {
        lte: initialAttempts,
      },
    },
  });

  const cappedActiveCode = await db.authVerificationCode.findFirst({
    where: {
      purpose: input.purpose,
      target: input.target,
      consumedAt: null,
      expiresAt: {
        gt: new Date(),
      },
      attempts: {
        gte: AUTH_CODE_MAX_ATTEMPTS,
      },
    },
    select: {
      id: true,
    },
  });

  if (cappedActiveCode) {
    throw new AuthCodeIssueAttemptsExceededError();
  }

  await db.authVerificationCode.create({
    data: {
      purpose: input.purpose,
      channel: input.channel,
      target: input.target,
      codeHash: hashVerificationCode({
        purpose: input.purpose,
        target: input.target,
        code,
      }),
      expiresAt,
      attempts: initialAttempts,
      enrollmentId: input.enrollmentId,
      userId: input.userId,
    },
  });

  return code;
}

async function resolveActiveAuthCode(input: {
  purpose: AuthCodePurpose;
  target: string;
  enrollmentId?: string;
  userId?: string;
}) {
  return db.authVerificationCode.findFirst({
    where: {
      purpose: input.purpose,
      target: input.target,
      consumedAt: null,
      enrollmentId: input.enrollmentId,
      userId: input.userId,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

async function sendSignupEmailCode(input: {
  email: string;
  code: string;
  organizationName: string;
  english: boolean;
}) {
  const titlePrefix = input.english ? "[Helm]" : "【Helm】";
  const subject = input.english
    ? `${titlePrefix} Your verification code`
    : `${titlePrefix} 你的注册验证码`;
  const text = input.english
    ? `Your Helm workspace signup verification code is ${input.code}. It expires in ${AUTH_CODE_TTL_MINUTES} minutes.\n\nOrganization: ${input.organizationName}\nEmail: ${input.email}\n\nIf you did not request this code, please ignore this email.`
    : `你的 Helm 工作区注册验证码是 ${input.code}，${AUTH_CODE_TTL_MINUTES} 分钟内有效。\n\n组织：${input.organizationName}\n邮箱：${input.email}\n\n如果这不是你本人操作，请忽略此邮件。`;

  return sendSystemMailIfConfigured({
    purpose: SYSTEM_MAIL_PURPOSES.AUTH_CODE,
    to: input.email,
    subject,
    text,
  });
}

async function verifyAuthCode(input: {
  purpose: AuthCodePurpose;
  target: string;
  code: string;
  enrollmentId?: string;
  userId?: string;
}) {
  const record = await resolveActiveAuthCode(input);
  if (!record) {
    return { ok: false as const, reason: "missing" as const };
  }

  if (record.expiresAt.getTime() < Date.now()) {
    return { ok: false as const, reason: "expired" as const };
  }

  if (record.attempts >= AUTH_CODE_MAX_ATTEMPTS) {
    return { ok: false as const, reason: "attempts_exceeded" as const };
  }

  const attemptReservation = await db.authVerificationCode.updateMany({
    where: {
      id: record.id,
      consumedAt: null,
      attempts: { lt: AUTH_CODE_MAX_ATTEMPTS },
    },
    data: { attempts: { increment: 1 } },
  });

  if (attemptReservation.count !== 1) {
    return { ok: false as const, reason: "attempts_exceeded" as const };
  }

  const valid = verifyHashedVerificationCode({
    purpose: input.purpose,
    target: input.target,
    code: input.code,
    expectedHash: record.codeHash,
  });

  if (!valid) {
    return {
      ok: false as const,
      reason:
        record.attempts + 1 >= AUTH_CODE_MAX_ATTEMPTS
          ? ("attempts_exceeded" as const)
          : ("invalid" as const),
    };
  }

  const consumeReservation = await db.authVerificationCode.updateMany({
    where: {
      id: record.id,
      consumedAt: null,
    },
    data: {
      consumedAt: new Date(),
    },
  });

  if (consumeReservation.count !== 1) {
    return { ok: false as const, reason: "attempts_exceeded" as const };
  }

  return { ok: true as const };
}

function getSignupCodeError(input: {
  reason: "missing" | "expired" | "invalid" | "attempts_exceeded";
  channel: "email" | "phone";
  english: boolean;
}) {
  if (input.reason === "expired") {
    if (input.channel === "email") {
      return input.english
        ? "The email verification code expired. Start signup again to get a new one."
        : "邮箱验证码已过期，请重新开始注册获取新验证码。";
    }
    return input.english
      ? "The phone verification code expired. Start signup again to get a new one."
      : "手机验证码已过期，请重新开始注册获取新验证码。";
  }

  if (input.reason === "attempts_exceeded") {
    if (input.channel === "email") {
      return input.english
        ? "Too many email verification attempts. Start signup again to get a new code."
        : "邮箱验证码尝试次数过多，请重新开始注册获取新验证码。";
    }
    return input.english
      ? "Too many phone verification attempts. Start signup again to get a new code."
      : "手机验证码尝试次数过多，请重新开始注册获取新验证码。";
  }

  if (input.channel === "email") {
    return input.english ? "The email verification code is incorrect." : "邮箱验证码不正确。";
  }
  return input.english ? "The phone verification code is incorrect." : "手机验证码不正确。";
}

function readDingTalkInvitePrefillContext(input: {
  cookieStore: Awaited<ReturnType<typeof cookies>>;
}) {
  const prefill = readPublicOauthSignupPrefillCookie(
    input.cookieStore.get(PUBLIC_OAUTH_SIGNUP_PREFILL_COOKIE)?.value ?? null,
  );

  if (!prefill || prefill.provider !== "dingtalk" || !prefill.organizationName) {
    return null;
  }

  return prefill;
}

function canBypassSignupVerificationCodes(input: {
  cookieStore: Awaited<ReturnType<typeof cookies>>;
  email: string;
  phone: string;
}) {
  const prefill = readDingTalkInvitePrefillContext({
    cookieStore: input.cookieStore,
  });
  if (!prefill) {
    return false;
  }

  const hasComparableIdentity = Boolean(prefill.email || prefill.phone);
  const emailMatches = prefill.email ? prefill.email === input.email : true;
  const phoneMatches = prefill.phone ? prefill.phone === input.phone : true;
  const hasExactMatch =
    (prefill.email !== null && prefill.email === input.email) ||
    (prefill.phone !== null && prefill.phone === input.phone);

  return hasComparableIdentity && emailMatches && phoneMatches && hasExactMatch;
}

const DEMO_ENTRY_EMAILS: ReadonlySet<string> = new Set(
  (["zh-CN", "en-US"] as const)
    .flatMap((locale) => getDemoModeProfiles(locale))
    .map((profile) => normalizeEmailAddress(profile.accountEmail)),
);

export async function loginAction(input: string | z.infer<typeof legacyEmailLoginSchema>) {
  const actionInput = typeof input === "string" ? { email: input } : input;
  const locale = resolveActionInputLocale(actionInput);
  const english = locale === "en-US";
  const parsed = legacyEmailLoginSchema.safeParse(actionInput);

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? (english ? "Please enter a valid email address" : "邮箱格式不正确"),
    };
  }

  const normalizedEmail = normalizeEmailAddress(parsed.data.email);

  const user = await db.user.findUnique({
    where: { email: normalizedEmail },
    include: {
      memberships: {
        where: {
          status: {
            not: MembershipStatus.INACTIVE,
          },
        },
        orderBy: {
          createdAt: "asc",
        },
        include: {
          workspace: true,
        },
      },
    },
  });

  if (!user || user.memberships.length === 0) {
    return {
      ok: false,
      error: english
        ? "This email does not have an organization yet. Start a verified self-serve trial first, or ask your team to invite this work email."
        : "这个邮箱当前还没有可进入的组织。请先开始正式验证试用，或让团队先邀请这个工作邮箱加入组织。",
    };
  }

  const isDemoEntryEmail = DEMO_ENTRY_EMAILS.has(normalizedEmail);
  const hasActiveMembership = user.memberships.some(
    (membership) => membership.status === MembershipStatus.ACTIVE,
  );
  const hasInvitedMembership = user.memberships.some(
    (membership) => membership.status === MembershipStatus.INVITED,
  );
  const demoMembership = user.memberships.find((membership) =>
    normalizeWorkspaceUiConfig(membership.workspace).demoMode,
  );

  if (isDemoEntryEmail && demoMembership) {
    return finalizeLoginForUser(user, "/login", AUTH_SESSION_PROVIDER_TYPES.EMAIL_ENTRY, locale);
  }

  // Keep the work-email compatibility entry narrow: it only accepts teammates
  // who are still invite-only. Active formal accounts must use credentials.
  if (!isDemoEntryEmail && hasInvitedMembership && !hasActiveMembership) {
    return finalizeLoginForUser(user, "/login", AUTH_SESSION_PROVIDER_TYPES.EMAIL_ENTRY, locale);
  }

  if (isDemoEntryEmail && !demoMembership) {
    return {
      ok: false,
      error: english
        ? "This entry is reserved for the demo workspaces. Please sign in with your password or phone verification code."
        : "该入口仅用于演示工作区。请使用密码登录或手机验证码登录正式账号。",
    };
  }

  return {
    ok: false,
    error: english
      ? "This entry is reserved for demo workspaces and invite-only teammates. Please sign in with your password or phone verification code."
      : "该入口仅用于演示工作区和仅邀请状态的成员。请使用密码登录或手机验证码登录正式账号。",
  };
}

export async function startTrialSignupAction(input: z.infer<typeof trialSignupSchema>) {
  const cookieStore = await cookies();
  const inputLocale = resolveActionInputLocale(input);
  const parsed = trialSignupSchema.safeParse(input);
  const locale: UiLocale = parsed.success
    ? resolveUiLocale(parsed.data.locale ?? inputLocale)
    : inputLocale;
  const english = locale === "en-US";

  if (!parsed.success) {
    return {
      ok: false,
      error:
        resolveAuthValidationIssueMessage(locale, parsed.error.issues[0]?.message) ??
        (english
          ? "Please complete your name, work email, phone number, organization name, and password"
          : "请完整填写姓名、工作邮箱、手机号、组织名称和密码"),
    };
  }

  const normalizedEmail = normalizeEmailAddress(parsed.data.email);
  const normalizedPhone = normalizePhoneNumber(parsed.data.phone);
  const canSkipVerificationCodes = canBypassSignupVerificationCodes({
    cookieStore,
    email: normalizedEmail,
    phone: normalizedPhone ?? "",
  });

  if (!normalizedPhone) {
    return {
      ok: false,
      error: english ? "Please enter a valid phone number" : "请输入有效的手机号",
    };
  }

  const [emailInitialAttempts, phoneInitialAttempts] = canSkipVerificationCodes
    ? [0, 0]
    : await Promise.all([
        resolveAuthCodeIssueAttemptCarry({
          purpose: AuthCodePurpose.SIGNUP_EMAIL,
          target: normalizedEmail,
        }),
        resolveAuthCodeIssueAttemptCarry({
          purpose: AuthCodePurpose.SIGNUP_PHONE,
          target: normalizedPhone,
        }),
      ]);

  if (!canSkipVerificationCodes && emailInitialAttempts >= AUTH_CODE_MAX_ATTEMPTS) {
    return {
      ok: false,
      error: getAuthCodeIssueAttemptsExceededMessage({
        flow: "signup",
        channel: "email",
        english,
      }),
    };
  }

  if (!canSkipVerificationCodes && phoneInitialAttempts >= AUTH_CODE_MAX_ATTEMPTS) {
    return {
      ok: false,
      error: getAuthCodeIssueAttemptsExceededMessage({
        flow: "signup",
        channel: "phone",
        english,
      }),
    };
  }

  await db.authVerificationCode.deleteMany({
    where: {
      target: {
        in: [normalizedEmail, normalizedPhone],
      },
    },
  });

  await db.authEnrollment.deleteMany({
    where: {
      OR: [{ email: normalizedEmail }, { phone: normalizedPhone }],
    },
  });

  const enrollment = await db.authEnrollment.create({
    data: {
      name: parsed.data.name.trim(),
      email: normalizedEmail,
      phone: normalizedPhone,
      organizationName: parsed.data.organizationName.trim(),
      locale,
      passwordHash: hashPassword(parsed.data.password),
      expiresAt: addMinutes(new Date(), SIGNUP_ENROLLMENT_TTL_MINUTES),
    },
  });

  if (canSkipVerificationCodes) {
    return {
      ok: true,
      step: "verify",
      enrollmentId: enrollment.id,
      requiresVerificationCodes: false,
      verificationPreview: buildVerificationPreview({
        email: normalizedEmail,
        phone: normalizedPhone,
      }),
    };
  }

  let emailCode: string;
  let phoneCode: string;
  try {
    [emailCode, phoneCode] = await Promise.all([
      issueAuthCode({
        purpose: AuthCodePurpose.SIGNUP_EMAIL,
        channel: AuthCodeChannel.EMAIL,
        target: normalizedEmail,
        enrollmentId: enrollment.id,
        initialAttempts: emailInitialAttempts,
      }),
      issueAuthCode({
        purpose: AuthCodePurpose.SIGNUP_PHONE,
        channel: AuthCodeChannel.PHONE,
        target: normalizedPhone,
        enrollmentId: enrollment.id,
        initialAttempts: phoneInitialAttempts,
      }),
    ]);
  } catch (error) {
    if (isAuthCodeIssueAttemptsExceededError(error)) {
      return {
        ok: false,
        error: getAuthCodeIssueAttemptsExceededMessage({
          flow: "signup",
          english,
        }),
      };
    }
    throw error;
  }

  const emailDelivery = await sendSignupEmailCode({
    email: normalizedEmail,
    code: emailCode,
    organizationName: enrollment.organizationName,
    english,
  }).catch((error) => {
    console.error("[auth] failed to send signup verification email", error);
    return {
      sent: false as const,
      reason: "send_failed" as const,
      sender: getSystemMailSenderEmail(),
    };
  });
  const forceCodePreview = shouldForceVerificationCodePreview();
  const canExposeCodePreview = canExposeVerificationCodePreview();

  return {
    ok: true,
    step: "verify",
    enrollmentId: enrollment.id,
    requiresVerificationCodes: true,
    verificationPreview: buildVerificationPreview({
      email: normalizedEmail,
      emailCode:
        canExposeCodePreview && (!emailDelivery?.sent || forceCodePreview)
          ? emailCode
          : undefined,
      phone: normalizedPhone,
      phoneCode: canExposeCodePreview ? phoneCode : undefined,
    }),
  };
}

export async function completeTrialSignupVerificationAction(
  input: z.infer<typeof completeSignupSchema>,
) {
  const cookieStore = await cookies();
  const inputLocale = resolveActionInputLocale(input);
  let english = inputLocale === "en-US";
  const parsed = completeSignupSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: english ? "Please complete required signup information" : "请完成注册必填信息",
    };
  }

  const enrollment = await db.authEnrollment.findUnique({
    where: { id: parsed.data.enrollmentId },
  });

  if (!enrollment) {
    return {
      ok: false,
      error: english ? "The signup session expired. Please start again." : "注册会话已过期，请重新开始。",
    };
  }

  const enrollmentLocale = resolveUiLocale(enrollment.locale ?? inputLocale);
  english = enrollmentLocale === "en-US";

  if (enrollment.expiresAt.getTime() < Date.now()) {
    await db.authEnrollment.delete({
      where: { id: enrollment.id },
    });
    return {
      ok: false,
      error: english ? "The signup verification expired. Please start again." : "注册验证已过期，请重新开始。",
    };
  }

  const canSkipVerificationCodes = canBypassSignupVerificationCodes({
    cookieStore,
    email: enrollment.email,
    phone: enrollment.phone,
  });
  const invitePrefill = readDingTalkInvitePrefillContext({ cookieStore });
  const normalizedSignupTitle =
    parsed.data.title?.trim() || invitePrefill?.title?.trim() || null;

  if (!canSkipVerificationCodes) {
    const emailCodeParsed = codeSchema.safeParse(parsed.data.emailCode ?? "");
    const phoneCodeParsed = codeSchema.safeParse(parsed.data.phoneCode ?? "");

    if (!emailCodeParsed.success || !phoneCodeParsed.success) {
      return {
        ok: false,
        error: english ? "Please enter both verification codes" : "请完整填写邮箱和手机验证码",
      };
    }

    const emailResult = await verifyAuthCode({
      purpose: AuthCodePurpose.SIGNUP_EMAIL,
      target: enrollment.email,
      code: emailCodeParsed.data,
      enrollmentId: enrollment.id,
    });
    if (!emailResult.ok) {
      return {
        ok: false,
        error: getSignupCodeError({
          reason: emailResult.reason,
          channel: "email",
          english,
        }),
      };
    }

    const phoneResult = await verifyAuthCode({
      purpose: AuthCodePurpose.SIGNUP_PHONE,
      target: enrollment.phone,
      code: phoneCodeParsed.data,
      enrollmentId: enrollment.id,
    });
    if (!phoneResult.ok) {
      return {
        ok: false,
        error: getSignupCodeError({
          reason: phoneResult.reason,
          channel: "phone",
          english,
        }),
      };
    }
  }

  const verifiedAt = new Date();

  const phoneConflict = await db.user.findFirst({
    where: {
      phone: enrollment.phone,
      email: {
        not: enrollment.email,
      },
    },
  });
  if (phoneConflict) {
    return {
      ok: false,
      error: english ? "This phone number is already attached to another account." : "这个手机号已经绑定到另一个账号。",
    };
  }

  const user =
    (await db.user.findUnique({
      where: { email: enrollment.email },
    })) ??
    (await db.user.create({
      data: {
        email: enrollment.email,
        name: enrollment.name,
        phone: enrollment.phone,
        ...(normalizedSignupTitle ? { title: normalizedSignupTitle } : {}),
        emailVerifiedAt: verifiedAt,
        phoneVerifiedAt: verifiedAt,
        passwordHash: enrollment.passwordHash,
        passwordSetAt: verifiedAt,
      },
    }));

  const savedUser = await db.user.update({
    where: { id: user.id },
    data: {
      name: enrollment.name,
      phone: enrollment.phone,
      ...(normalizedSignupTitle ? { title: normalizedSignupTitle } : {}),
      emailVerifiedAt: verifiedAt,
      phoneVerifiedAt: verifiedAt,
      passwordHash: enrollment.passwordHash,
      passwordSetAt: verifiedAt,
      lastLoginAt: verifiedAt,
    },
  });

  const invitedWorkspaceId =
    canSkipVerificationCodes && invitePrefill?.invitedWorkspaceId
      ? invitePrefill.invitedWorkspaceId
      : null;
  let workspaceIdForSession: string;
  let redirectTo = "/setup?onboarding=trial";

  if (invitedWorkspaceId) {
    const invitedWorkspace = await db.workspace.findUnique({
      where: { id: invitedWorkspaceId },
      select: { id: true },
    });

    if (!invitedWorkspace) {
      return {
        ok: false,
        error: english
          ? "The invite workspace is no longer available. Ask your teammate to resend the invite."
          : "邀请对应的组织已不可用，请让同事重新发送邀请。",
      };
    }

    const existingMembership = await db.membership.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: invitedWorkspace.id,
          userId: savedUser.id,
        },
      },
      select: {
        role: true,
        title: true,
        persona: true,
      },
    });

    const invitedMembershipTitle =
      normalizedSignupTitle || existingMembership?.title?.trim() || null;
    const invitedMembershipPersona =
      existingMembership?.persona?.trim() ||
      invitedMembershipTitle ||
      null;

    await db.membership.upsert({
      where: {
        workspaceId_userId: {
          workspaceId: invitedWorkspace.id,
          userId: savedUser.id,
        },
      },
      create: {
        workspaceId: invitedWorkspace.id,
        userId: savedUser.id,
        role: existingMembership?.role ?? WorkspaceRole.MEMBER,
        status: MembershipStatus.ACTIVE,
        ...(invitedMembershipTitle ? { title: invitedMembershipTitle } : {}),
        ...(invitedMembershipPersona ? { persona: invitedMembershipPersona } : {}),
      },
      update: {
        role: existingMembership?.role ?? WorkspaceRole.MEMBER,
        status: MembershipStatus.ACTIVE,
        ...(invitedMembershipTitle && !existingMembership?.title
          ? { title: invitedMembershipTitle }
          : {}),
        ...(invitedMembershipPersona && !existingMembership?.persona
          ? { persona: invitedMembershipPersona }
          : {}),
      },
    });

    workspaceIdForSession = invitedWorkspace.id;
    redirectTo = "/dashboard";
  } else {
    const { workspace } = await createSelfServeTrialOrganization({
      user: {
        id: savedUser.id,
        email: savedUser.email,
        name: savedUser.name,
        title: savedUser.title,
      },
      organizationName: enrollment.organizationName,
      locale: enrollmentLocale,
    });
    workspaceIdForSession = workspace.id;
  }

  await createSession({
    userId: savedUser.id,
    email: savedUser.email,
    workspaceId: workspaceIdForSession,
    sourcePage: "/login",
    providerType: AUTH_SESSION_PROVIDER_TYPES.VERIFIED_SIGNUP,
  });

  cookieStore.set(UI_LOCALE_COOKIE, enrollmentLocale, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
  });

  await db.authEnrollment.delete({
    where: { id: enrollment.id },
  });
  cookieStore.delete(PUBLIC_OAUTH_SIGNUP_PREFILL_COOKIE);

  return {
    ok: true,
    workspaceId: workspaceIdForSession,
    redirectTo,
  };
}

export async function passwordLoginAction(input: z.infer<typeof passwordLoginSchema>) {
  const locale = resolveActionInputLocale(input);
  const english = locale === "en-US";
  const parsed = passwordLoginSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: english ? "Please enter your email or phone and password" : "请输入邮箱或手机号，以及密码",
    };
  }

  const user = await findUserByIdentifier(parsed.data.identifier);
  if (!user || user.memberships.length === 0) {
    return {
      ok: false,
      error: english ? "This account does not have an active organization yet." : "当前账号还没有可进入的组织。",
    };
  }

  if (!user.passwordHash) {
    return {
      ok: false,
      error: english
        ? "This account has not finished password setup yet. Use legacy invite entry or complete verified signup first."
        : "这个账号还没有完成密码设置。请先使用旧邀请入口，或先完成正式验证注册。",
    };
  }

  if (!verifyPassword(parsed.data.password, user.passwordHash)) {
    return {
      ok: false,
      error: english ? "Incorrect password" : "密码不正确",
    };
  }

  return finalizeLoginForUser(user, "/login", AUTH_SESSION_PROVIDER_TYPES.PASSWORD, locale);
}

export async function requestPhoneLoginCodeAction(
  input: z.infer<typeof requestPhoneLoginCodeSchema>,
) {
  const locale = resolveActionInputLocale(input);
  const english = locale === "en-US";
  const parsed = requestPhoneLoginCodeSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: english ? "Please enter your phone number" : "请输入手机号",
    };
  }

  const normalizedPhone = normalizePhoneNumber(parsed.data.phone);
  if (!normalizedPhone) {
    return {
      ok: false,
      error: english ? "Please enter a valid phone number" : "请输入有效的手机号",
    };
  }

  const user = await db.user.findFirst({
    where: { phone: normalizedPhone },
    include: {
      memberships: {
        where: {
          status: {
            not: MembershipStatus.INACTIVE,
          },
        },
        take: 1,
      },
    },
  });

  if (!user || user.memberships.length === 0) {
    return {
      ok: false,
      error: english
        ? "This phone number is not attached to an active organization account."
        : "这个手机号当前没有绑定可进入的组织账号。",
    };
  }

  if (!user.phoneVerifiedAt) {
    return {
      ok: false,
      error: english
        ? "This phone number has not finished verification yet."
        : "这个手机号还没有完成验证。",
    };
  }

  let code: string;
  try {
    code = await issueAuthCode({
      purpose: AuthCodePurpose.LOGIN_PHONE,
      channel: AuthCodeChannel.PHONE,
      target: normalizedPhone,
      userId: user.id,
    });
  } catch (error) {
    if (isAuthCodeIssueAttemptsExceededError(error)) {
      return {
        ok: false,
        error: getAuthCodeIssueAttemptsExceededMessage({
          flow: "login",
          english,
        }),
      };
    }
    throw error;
  }

  return {
    ok: true,
    phone: normalizedPhone,
    verificationPreview: buildVerificationPreview({
      email: user.email,
      phone: normalizedPhone,
      phoneCode: canExposeVerificationCodePreview() ? code : undefined,
    }),
  };
}

export async function beginPublicPhoneEntryAction(
  input: z.infer<typeof requestPhoneLoginCodeSchema>,
) {
  const locale = resolveActionInputLocale(input);
  const english = locale === "en-US";
  const parsed = requestPhoneLoginCodeSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false as const,
      error: english ? "Please enter your phone number" : "请输入手机号",
    };
  }

  const normalizedPhone = normalizePhoneNumber(parsed.data.phone);
  if (!normalizedPhone) {
    return {
      ok: false as const,
      error: english ? "Please enter a valid phone number" : "请输入有效的手机号",
    };
  }

  const user = await db.user.findFirst({
    where: { phone: normalizedPhone },
    include: {
      memberships: {
        where: {
          status: {
            not: MembershipStatus.INACTIVE,
          },
        },
        take: 1,
      },
    },
  });

  if (!user || user.memberships.length === 0 || !user.phoneVerifiedAt) {
    return {
      ok: true as const,
      mode: "signup" as const,
      phone: normalizedPhone,
      signupHref: `/login?tab=signup&phone=${encodeURIComponent(normalizedPhone)}`,
    };
  }

  let code: string;
  try {
    code = await issueAuthCode({
      purpose: AuthCodePurpose.LOGIN_PHONE,
      channel: AuthCodeChannel.PHONE,
      target: normalizedPhone,
      userId: user.id,
    });
  } catch (error) {
    if (isAuthCodeIssueAttemptsExceededError(error)) {
      return {
        ok: false as const,
        error: getAuthCodeIssueAttemptsExceededMessage({
          flow: "login",
          english,
        }),
      };
    }
    throw error;
  }

  return {
    ok: true as const,
    mode: "login" as const,
    phone: normalizedPhone,
    verificationPreview: buildVerificationPreview({
      email: user.email,
      phone: normalizedPhone,
      phoneCode: canExposeVerificationCodePreview() ? code : undefined,
    }),
  };
}

export async function loginWithPhoneCodeAction(
  input: z.infer<typeof phoneCodeLoginSchema>,
) {
  const locale = resolveActionInputLocale(input);
  const english = locale === "en-US";
  const parsed = phoneCodeLoginSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: english ? "Please enter your phone and verification code" : "请输入手机号和验证码",
    };
  }

  const normalizedPhone = normalizePhoneNumber(parsed.data.phone);
  if (!normalizedPhone) {
    return {
      ok: false,
      error: english ? "Please enter a valid phone number" : "请输入有效的手机号",
    };
  }

  const user = await db.user.findFirst({
    where: { phone: normalizedPhone },
    include: {
      memberships: {
        where: {
          status: {
            not: MembershipStatus.INACTIVE,
          },
        },
        orderBy: {
          createdAt: "asc",
        },
        include: {
          workspace: true,
        },
      },
    },
  });

  if (!user || user.memberships.length === 0) {
    return {
      ok: false,
      error: english ? "This phone number does not match an active organization account." : "这个手机号当前没有匹配到可进入的组织账号。",
    };
  }

  const verification = await verifyAuthCode({
    purpose: AuthCodePurpose.LOGIN_PHONE,
    target: normalizedPhone,
    code: parsed.data.code,
    userId: user.id,
  });

  if (!verification.ok) {
    return {
      ok: false,
      error:
        verification.reason === "expired"
          ? english
            ? "The login verification code expired. Request a new code."
            : "登录验证码已过期，请重新获取。"
          : verification.reason === "attempts_exceeded"
            ? english
              ? "Too many login verification attempts. Request a new code."
              : "登录验证码尝试次数过多，请重新获取。"
          : english
            ? "The login verification code is incorrect."
            : "登录验证码不正确。",
    };
  }

  return finalizeLoginForUser(user, "/login", AUTH_SESSION_PROVIDER_TYPES.PHONE_CODE, locale);
}

export async function completeFirstLoginIdentityCompletionAction(
  input: z.infer<typeof firstLoginIdentityCompletionSchema>,
) {
  const cookieStore = await cookies();
  const locale = resolveActionInputLocale(input);
  const english = locale === "en-US";
  const parsed = firstLoginIdentityCompletionSchema.safeParse(input);
  const activeWorkspaceId = cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value;

  if (!parsed.success) {
    return {
      ok: false,
      error:
        resolveAuthValidationIssueMessage(locale, parsed.error.issues[0]?.message) ??
        (english ? "Please complete required fields." : "请完成必填项。"),
    };
  }

  const sessionUser = await requireCurrentUser();
  const user = await db.user.findUnique({
    where: { id: sessionUser.id },
    include: {
      memberships: {
        where: {
          status: {
            not: MembershipStatus.INACTIVE,
          },
        },
        orderBy: {
          createdAt: "asc",
        },
        include: {
          workspace: true,
        },
      },
    },
  });

  if (!user || user.memberships.length === 0) {
    return {
      ok: false,
      error: english ? "Current account has no active workspace membership." : "当前账号没有可进入的工作区成员关系。",
    };
  }

  const hasPendingIdentitySetupCookie = Boolean(
    cookieStore.get(FIRST_LOGIN_IDENTITY_SETUP_COOKIE)?.value,
  );
  const existingNormalizedEmail = normalizeEmailAddress(user.email ?? "");
  const existingNormalizedPhone = normalizePhoneNumber(user.phone ?? "");
  const requiresEmailCompletion = !existingNormalizedEmail;
  const requiresPhoneCompletion = !existingNormalizedPhone;
  const requiresPasswordSetup = !user.passwordHash;
  const normalizedInputEmail = normalizeEmailAddress(parsed.data.email ?? "");
  const normalizedInputPhone = normalizePhoneNumber(parsed.data.phone ?? "");

  if (!hasPendingIdentitySetupCookie) {
    const membership = resolvePreferredMembership(user.memberships, activeWorkspaceId);
    if (!membership) {
      return {
        ok: false,
        error: english ? "Unable to resolve active workspace." : "无法确定当前工作区。",
      };
    }
    return {
      ok: true,
      redirectTo: resolvePostLoginRedirectPath(membership),
    };
  }

  if (!requiresEmailCompletion && !requiresPhoneCompletion && !requiresPasswordSetup) {
    cookieStore.delete(FIRST_LOGIN_IDENTITY_SETUP_COOKIE);
    const membership = resolvePreferredMembership(
      user.memberships,
      activeWorkspaceId,
    );
    if (!membership) {
      return {
        ok: false,
        error: english ? "Unable to resolve active workspace." : "无法确定当前工作区。",
      };
    }
    return {
      ok: true,
      redirectTo: resolvePostLoginRedirectPath(membership),
    };
  }

  if (requiresEmailCompletion && !normalizedInputEmail) {
    return {
      ok: false,
      error: english ? "Please enter a valid email address." : "请输入有效邮箱地址。",
    };
  }

  if (requiresPhoneCompletion && !normalizedInputPhone) {
    return {
      ok: false,
      error: english ? "Please enter a valid phone number." : "请输入有效手机号。",
    };
  }

  if (requiresPasswordSetup) {
    const passwordParsed = passwordSchema.safeParse(parsed.data.password);
    if (!passwordParsed.success || parsed.data.password !== parsed.data.confirmPassword) {
      return {
        ok: false,
        error: english
          ? "Please set and confirm a valid password."
          : "请设置并确认有效密码。",
      };
    }
  }

  try {
    await db.user.update({
      where: { id: user.id },
      data: {
        email: requiresEmailCompletion ? normalizedInputEmail : user.email,
        phone: requiresPhoneCompletion ? normalizedInputPhone : user.phone,
        ...(requiresPasswordSetup && parsed.data.password
          ? {
              passwordHash: hashPassword(parsed.data.password),
              passwordSetAt: new Date(),
            }
          : {}),
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);
    if (message.includes("Unique constraint")) {
      return {
        ok: false,
        error: english
          ? "Email or phone is already used by another account."
          : "邮箱或手机号已被其他账号占用。",
      };
    }
    return {
      ok: false,
      error: english ? "Failed to update identity profile." : "更新身份资料失败。",
    };
  }

  cookieStore.delete(FIRST_LOGIN_IDENTITY_SETUP_COOKIE);

  const membership = resolvePreferredMembership(
    user.memberships,
    activeWorkspaceId,
  );
  if (!membership) {
    return {
      ok: false,
      error: english ? "Unable to resolve active workspace." : "无法确定当前工作区。",
    };
  }

  return {
    ok: true,
    redirectTo: resolvePostLoginRedirectPath(membership),
  };
}

export async function selectLoginWorkspaceAction(
  input: z.infer<typeof loginWorkspaceSelectionSchema>,
) {
  const parsed = loginWorkspaceSelectionSchema.safeParse(input);
  const english = resolveActionInputLocale(parsed.success ? parsed.data : input) === "en-US";
  if (!parsed.success) {
    return {
      ok: false,
      error: english ? "Please choose an organization." : "请选择要进入的组织。",
    };
  }

  const user = await requireCurrentUser();
  const membership = await db.membership.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: parsed.data.workspaceId,
        userId: user.id,
      },
    },
    include: {
      workspace: true,
    },
  });

  if (!membership || membership.status === MembershipStatus.INACTIVE) {
    return {
      ok: false,
      error: english ? "The selected organization is unavailable." : "选择的组织当前不可用。",
    };
  }

  await setActiveWorkspace(parsed.data.workspaceId);

  if (membership.status === MembershipStatus.INVITED) {
    await activateMembershipIfInvited({
      workspaceId: parsed.data.workspaceId,
      userId: user.id,
    });
  }

  const requiresIdentityCompletion = shouldRequireFirstLoginIdentityCompletion(user);
  const redirectTo = requiresIdentityCompletion
    ? FIRST_LOGIN_IDENTITY_SETUP_PATH
    : resolvePostLoginRedirectPath(
        membership.status === MembershipStatus.INVITED
          ? { ...membership, status: MembershipStatus.ACTIVE }
          : membership,
      );

  return {
    ok: true,
    redirectTo,
  };
}

export async function logoutAction() {
  await clearSession();
  return { ok: true };
}
