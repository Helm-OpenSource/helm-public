import { cookies } from "next/headers";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { MembershipStatus, WorkspaceRole, type User, type Workspace } from "@prisma/client";
import { logEvent } from "@/lib/analytics";
import { createSession } from "@/lib/auth/session";
import { FIRST_LOGIN_IDENTITY_SETUP_COOKIE } from "@/lib/auth/session-cookies";
import type { AuthSessionProviderType } from "@/lib/auth/provider-seam";
import {
  FIRST_LOGIN_IDENTITY_SETUP_PATH,
  resolvePostLoginRedirectPath,
  shouldRequireFirstLoginIdentityCompletion,
} from "@/lib/auth/first-login-identity-completion";
import { normalizePhoneNumber } from "@/lib/auth/formal-auth";
import { recordUserLastLogin } from "@/lib/auth/login-activity";
import { db } from "@/lib/db";
import { type UiLocale, resolveUiLocale, UI_LOCALE_COOKIE } from "@/lib/i18n/config";

export const DINGTALK_PUBLIC_AUTH_STATE_COOKIE = "helm-dingtalk-public-auth-state";
export const WECOM_PUBLIC_AUTH_STATE_COOKIE = "helm-wecom-public-auth-state";
export const FEISHU_PUBLIC_AUTH_STATE_COOKIE = "helm-feishu-public-auth-state";
export const PUBLIC_OAUTH_SIGNUP_PREFILL_COOKIE = "helm-public-oauth-signup-prefill";
const PUBLIC_OAUTH_SIGNUP_PREFILL_TTL_SECONDS = 60 * 5;
const PUBLIC_OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const PUBLIC_OAUTH_STATE_DIR = path.join(tmpdir(), "helm-public-oauth-states");
const PUBLIC_OAUTH_STATE_KEY_PATTERN = /^[a-zA-Z0-9-]+$/;
const LOGIN_WORKSPACE_SELECTOR_PATH = "/login/workspaces";

export type PublicOauthProvider = "dingtalk" | "wecom" | "feishu";

type PublicOauthStateSnapshot = {
  provider: PublicOauthProvider;
  state: string;
  locale: UiLocale;
  flowId?: string;
  organizationName?: string;
  workspaceId?: string;
  title?: string;
  expiresAtMs: number;
};

export type PublicOauthFallbackStatus =
  | "oauth-error"
  | "failure"
  | "identity-conflict"
  | "missing-identity";

type PublicOauthUser = User & {
  memberships: Array<{
    workspaceId: string;
    role: WorkspaceRole;
    status: MembershipStatus;
    workspace: Workspace;
  }>;
};

type PublicOauthCookieStore = {
  set: (
    name: string,
    value: string,
    options?: {
      httpOnly?: boolean;
      sameSite?: "strict" | "lax" | "none";
      path?: string;
      maxAge?: number;
      secure?: boolean;
    },
  ) => void;
};

export type PublicOauthSignupPrefill = {
  provider: PublicOauthProvider;
  name: string | null;
  email: string | null;
  phone: string | null;
  title?: string | null;
  organizationName?: string | null;
  invitedWorkspaceId?: string | null;
};

type PublicOauthSignupPrefillPayload = PublicOauthSignupPrefill & {
  expiresAt: string;
};

export type PublicOauthUserMatchResult =
  | {
      status: "missing-identity";
      normalizedEmail: null;
      normalizedPhone: null;
    }
  | {
      status: "identity-conflict";
      normalizedEmail: string | null;
      normalizedPhone: string | null;
      emailUserId: string;
      phoneUserId: string;
    }
  | {
      status: "matched";
      normalizedEmail: string | null;
      normalizedPhone: string | null;
      user: PublicOauthUser;
    }
  | {
      status: "unmatched";
      normalizedEmail: string | null;
      normalizedPhone: string | null;
    };

function normalizeEmail(value: string | null | undefined) {
  const trimmed = value?.trim().toLowerCase();
  return trimmed ? trimmed : null;
}

function normalizeName(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeAvatar(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeOrganizationName(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, 80) : null;
}

function normalizeWorkspaceId(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeTitle(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, 80) : null;
}

function getPublicOauthStateCookieName(provider: PublicOauthProvider) {
  if (provider === "dingtalk") {
    return DINGTALK_PUBLIC_AUTH_STATE_COOKIE;
  }

  if (provider === "wecom") {
    return WECOM_PUBLIC_AUTH_STATE_COOKIE;
  }

  return FEISHU_PUBLIC_AUTH_STATE_COOKIE;
}

function normalizePublicOauthStateKey(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed || !PUBLIC_OAUTH_STATE_KEY_PATTERN.test(trimmed)) {
    return null;
  }
  return trimmed;
}

function getPublicOauthStateSnapshotPath(provider: PublicOauthProvider, state: string) {
  return path.join(PUBLIC_OAUTH_STATE_DIR, `${provider}-${state}.json`);
}

async function ensurePublicOauthStateDir() {
  await fs.mkdir(PUBLIC_OAUTH_STATE_DIR, { recursive: true });
}

async function persistPublicOauthStateSnapshot(snapshot: PublicOauthStateSnapshot) {
  await ensurePublicOauthStateDir();
  const statePath = getPublicOauthStateSnapshotPath(snapshot.provider, snapshot.state);
  const tempPath = `${statePath}.${Date.now()}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(snapshot), "utf8");
  await fs.rename(tempPath, statePath);
}

async function deletePublicOauthStateSnapshot(provider: PublicOauthProvider, state: string) {
  try {
    await fs.unlink(getPublicOauthStateSnapshotPath(provider, state));
  } catch {
    // ignore
  }
}

function toPublicOauthStateSnapshotPayload(snapshot: PublicOauthStateSnapshot) {
  const organizationName = normalizeOrganizationName(snapshot.organizationName);
  const workspaceId = normalizeWorkspaceId(snapshot.workspaceId);
  const title = normalizeTitle(snapshot.title);
  return {
    state: snapshot.state,
    locale: resolveUiLocale(snapshot.locale),
    flowId: snapshot.flowId?.trim() || null,
    ...(organizationName ? { organizationName } : {}),
    ...(workspaceId ? { workspaceId } : {}),
    ...(title ? { title } : {}),
  };
}

export function buildPublicAuthStartUrl(origin: string, provider: PublicOauthProvider) {
  return `${origin.replace(/\/$/, "")}/api/public-auth/${provider}/start`;
}

export function readPublicOauthState(rawState: string | null) {
  if (!rawState) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawState) as {
      state?: string;
      locale?: string;
      flowId?: string;
      organizationName?: string;
      workspaceId?: string;
      title?: string;
    };
    const normalizedFlowId = parsed.flowId?.trim() || null;
    const organizationName = normalizeOrganizationName(parsed.organizationName);
    const workspaceId = normalizeWorkspaceId(parsed.workspaceId);
    const title = normalizeTitle(parsed.title);

    return {
      state: parsed.state?.trim() || null,
      locale: resolveUiLocale(parsed.locale),
      flowId: normalizedFlowId,
      ...(organizationName ? { organizationName } : {}),
      ...(workspaceId ? { workspaceId } : {}),
      ...(title ? { title } : {}),
    };
  } catch {
    return null;
  }
}

export async function consumePublicOauthStateByLookup(input: {
  provider: PublicOauthProvider;
  state: string | null | undefined;
  now?: Date;
}) {
  const state = normalizePublicOauthStateKey(input.state);
  if (!state) {
    return null;
  }

  try {
    const payload = await fs.readFile(
      getPublicOauthStateSnapshotPath(input.provider, state),
      "utf8",
    );
    const snapshot = JSON.parse(payload) as PublicOauthStateSnapshot;
    const nowMs = (input.now ?? new Date()).getTime();
    if (
      snapshot.provider !== input.provider ||
      snapshot.state !== state ||
      !Number.isFinite(snapshot.expiresAtMs) ||
      snapshot.expiresAtMs <= nowMs
    ) {
      await deletePublicOauthStateSnapshot(input.provider, state);
      return null;
    }

    await deletePublicOauthStateSnapshot(input.provider, state);
    return toPublicOauthStateSnapshotPayload(snapshot);
  } catch {
    return null;
  }
}

export function buildPublicOauthSignupUrl(
  request: Request,
  input: {
    provider: PublicOauthProvider;
    phone?: string | null;
    email?: string | null;
    name?: string | null;
  },
) {
  const url = new URL("/login", resolvePublicOauthRequestBaseUrl(request));
  url.searchParams.set("tab", "signup");
  url.searchParams.set("provider", input.provider);
  url.searchParams.set("prefill", "1");
  return url;
}

export function buildPublicOauthFallbackUrl(
  request: Request,
  provider?: PublicOauthProvider,
  status?: PublicOauthFallbackStatus,
) {
  const url = new URL("/login", resolvePublicOauthRequestBaseUrl(request));
  url.searchParams.set("tab", "phone");

  if (provider) {
    url.searchParams.set("provider", provider);
  }

  if (status) {
    url.searchParams.set("status", status);
  }

  return url;
}

export function resolvePublicOauthRequestBaseUrl(request: Request) {
  const appUrl = process.env.APP_URL?.trim();
  if (appUrl) {
    try {
      return new URL(appUrl).toString();
    } catch {
      // Fall through to request-derived base when APP_URL is malformed.
    }
  }

  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  if (forwardedHost) {
    const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
    try {
      return new URL(`${forwardedProto}://${forwardedHost}`).toString();
    } catch {
      // Fall through to request-derived base when forwarded headers are malformed.
    }
  }

  return new URL(request.url).origin;
}

export function writePublicOauthSignupPrefillCookie(
  cookieStore: PublicOauthCookieStore,
  input: {
    provider: PublicOauthProvider;
    phone?: string | null;
    email?: string | null;
    name?: string | null;
    organizationName?: string | null;
    invitedWorkspaceId?: string | null;
    title?: string | null;
  },
  now = new Date(),
) {
  const organizationName = normalizeOrganizationName(input.organizationName);
  const invitedWorkspaceId = normalizeWorkspaceId(input.invitedWorkspaceId);
  const title = normalizeTitle(input.title);
  const payload = {
    provider: input.provider,
    name: normalizeName(input.name),
    email: normalizeEmail(input.email),
    phone: normalizePhoneNumber(input.phone ?? ""),
    ...(organizationName ? { organizationName } : {}),
    ...(invitedWorkspaceId ? { invitedWorkspaceId } : {}),
    ...(title ? { title } : {}),
    expiresAt: new Date(now.getTime() + PUBLIC_OAUTH_SIGNUP_PREFILL_TTL_SECONDS * 1000).toISOString(),
  } satisfies PublicOauthSignupPrefillPayload;

  cookieStore.set(PUBLIC_OAUTH_SIGNUP_PREFILL_COOKIE, JSON.stringify(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/login",
    maxAge: PUBLIC_OAUTH_SIGNUP_PREFILL_TTL_SECONDS,
  });
}

export function readPublicOauthSignupPrefillCookie(
  rawValue: string | null,
  now = new Date(),
): PublicOauthSignupPrefill | null {
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as PublicOauthSignupPrefillPayload;

    if (
      parsed.provider !== "dingtalk" &&
      parsed.provider !== "wecom" &&
      parsed.provider !== "feishu"
    ) {
      return null;
    }

    const expiresAt = Date.parse(parsed.expiresAt);

    if (!Number.isFinite(expiresAt) || expiresAt <= now.getTime()) {
      return null;
    }

    return {
      provider: parsed.provider,
      name: normalizeName(parsed.name),
      email: normalizeEmail(parsed.email),
      phone: normalizePhoneNumber(parsed.phone ?? ""),
      ...(normalizeOrganizationName(parsed.organizationName)
        ? { organizationName: normalizeOrganizationName(parsed.organizationName) }
        : {}),
      ...(normalizeWorkspaceId(parsed.invitedWorkspaceId)
        ? { invitedWorkspaceId: normalizeWorkspaceId(parsed.invitedWorkspaceId) }
        : {}),
      ...(normalizeTitle(parsed.title)
        ? { title: normalizeTitle(parsed.title) }
        : {}),
    };
  } catch {
    return null;
  }
}

async function findActivePublicOauthUser(where: { email?: string; phone?: string }) {
  const user = await db.user.findFirst({
    where,
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

  if (user && user.memberships.length > 0) {
    return user satisfies PublicOauthUser;
  }

  return null;
}

export async function findActivePublicOauthUserById(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
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

  if (user && user.memberships.length > 0) {
    return user satisfies PublicOauthUser;
  }

  return null;
}

export async function resolvePublicOauthUserMatch(input: {
  email?: string | null;
  phone?: string | null;
  preferPhoneMatch?: boolean;
}): Promise<PublicOauthUserMatchResult> {
  const normalizedEmail = normalizeEmail(input.email);
  const normalizedPhone = normalizePhoneNumber(input.phone ?? "");

  if (!normalizedEmail && !normalizedPhone) {
    return {
      status: "missing-identity",
      normalizedEmail: null,
      normalizedPhone: null,
    };
  }

  const [emailUser, phoneUser] = await Promise.all([
    normalizedEmail ? findActivePublicOauthUser({ email: normalizedEmail }) : Promise.resolve(null),
    normalizedPhone ? findActivePublicOauthUser({ phone: normalizedPhone }) : Promise.resolve(null),
  ]);

  if (input.preferPhoneMatch && phoneUser) {
    return {
      status: "matched",
      normalizedEmail,
      normalizedPhone,
      user: phoneUser,
    };
  }

  if (emailUser && phoneUser && emailUser.id !== phoneUser.id) {
    return {
      status: "identity-conflict",
      normalizedEmail,
      normalizedPhone,
      emailUserId: emailUser.id,
      phoneUserId: phoneUser.id,
    };
  }

  const user = input.preferPhoneMatch ? phoneUser ?? emailUser : emailUser ?? phoneUser;

  if (user) {
    return {
      status: "matched",
      normalizedEmail,
      normalizedPhone,
      user,
    };
  }

  return {
    status: "unmatched",
    normalizedEmail,
    normalizedPhone,
  };
}

export async function findPublicOauthUserMatch(input: {
  email?: string | null;
  phone?: string | null;
}) {
  const match = await resolvePublicOauthUserMatch(input);
  return match.status === "matched" ? match.user : null;
}

export async function finalizePublicOauthLogin(input: {
  user: PublicOauthUser;
  sourcePage: string;
  providerType: AuthSessionProviderType;
  preferredLocale?: UiLocale | null;
  preferredWorkspaceId?: string | null;
  profile?: {
    name?: string | null;
    phone?: string | null;
    avatar?: string | null;
  };
}) {
  const selectableMemberships = input.user.memberships.filter(
    (membership) => membership.status !== MembershipStatus.INACTIVE,
  );
  const requiresWorkspaceSelection =
    selectableMemberships.length > 1 && !input.preferredWorkspaceId;
  const activeMembership =
    (input.preferredWorkspaceId
      ? selectableMemberships.find(
          (membership) => membership.workspaceId === input.preferredWorkspaceId,
        )
      : null) ??
    selectableMemberships.find((membership) => membership.status === MembershipStatus.ACTIVE) ??
    selectableMemberships.find((membership) => membership.status === MembershipStatus.INVITED) ??
    selectableMemberships[0] ??
    null;
  const requiresIdentityCompletion =
    shouldRequireFirstLoginIdentityCompletion(input.user);

  if (!activeMembership) {
    return {
      ok: false as const,
      redirectTo: "/login?tab=phone",
    };
  }

  const patchName = normalizeName(input.profile?.name);
  const patchPhone = normalizePhoneNumber(input.profile?.phone ?? "");
  const patchAvatar = normalizeAvatar(input.profile?.avatar);
  const shouldPatchName = !input.user.name?.trim() && !!patchName;
  const shouldPatchPhone = !input.user.phone && !!patchPhone;
  const shouldPatchAvatar = !input.user.avatar && !!patchAvatar;

  if (shouldPatchName || shouldPatchPhone || shouldPatchAvatar) {
    try {
      await db.user.update({
        where: { id: input.user.id },
        data: {
          ...(shouldPatchName ? { name: patchName } : {}),
          ...(shouldPatchPhone ? { phone: patchPhone } : {}),
          ...(shouldPatchAvatar ? { avatar: patchAvatar } : {}),
        },
      });
    } catch {
      // Do not block login when optional profile write-back fails.
    }
  }

  await recordUserLastLogin(input.user.id);

  await createSession({
    userId: input.user.id,
    email: input.user.email,
    workspaceId: activeMembership.workspaceId,
    sourcePage: input.sourcePage,
    providerType: input.providerType,
  });

  const cookieStore = await cookies();
  const locale = resolveUiLocale(input.preferredLocale ?? activeMembership.workspace.defaultLocale);
  cookieStore.set(UI_LOCALE_COOKIE, locale, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
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
    userId: input.user.id,
    eventName: "daily_login",
    eventCategory: "auth",
    targetType: "User",
    targetId: input.user.id,
    metadata: {
      email: input.user.email,
      phone: shouldPatchPhone ? patchPhone : input.user.phone,
      sourcePage: input.sourcePage,
      providerType: input.providerType,
    },
    sourcePage: input.sourcePage,
  });

  return {
    ok: true as const,
    redirectTo,
  };
}

export async function setPublicOauthStateCookie(input: {
  provider: PublicOauthProvider;
  state: string;
  locale: UiLocale;
  flowId?: string | null;
  organizationName?: string | null;
  workspaceId?: string | null;
  title?: string | null;
}) {
  const cookieStore = await cookies();
  const normalizedFlowId = input.flowId?.trim() || null;
  const organizationName = normalizeOrganizationName(input.organizationName);
  const workspaceId = normalizeWorkspaceId(input.workspaceId);
  const title = normalizeTitle(input.title);
  cookieStore.set(
    getPublicOauthStateCookieName(input.provider),
    JSON.stringify({
      state: input.state,
      locale: input.locale,
      ...(normalizedFlowId ? { flowId: normalizedFlowId } : {}),
      ...(organizationName ? { organizationName } : {}),
      ...(workspaceId ? { workspaceId } : {}),
      ...(title ? { title } : {}),
    }),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 10,
    },
  );

  const state = normalizePublicOauthStateKey(input.state);
  if (!state) {
    return;
  }

  try {
    await persistPublicOauthStateSnapshot({
      provider: input.provider,
      state,
      locale: input.locale,
      ...(normalizedFlowId ? { flowId: normalizedFlowId } : {}),
      ...(organizationName ? { organizationName } : {}),
      ...(workspaceId ? { workspaceId } : {}),
      ...(title ? { title } : {}),
      expiresAtMs: Date.now() + PUBLIC_OAUTH_STATE_TTL_MS,
    });
  } catch (error) {
    console.error("[public-oauth] failed to persist state snapshot", {
      provider: input.provider,
      state,
      error,
    });
  }
}
