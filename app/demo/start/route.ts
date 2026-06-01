import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { MembershipStatus } from "@prisma/client";
import { AUTH_SESSION_PROVIDER_TYPES } from "@/lib/auth/provider-seam";
import {
  ACTIVE_WORKSPACE_COOKIE,
  createSession,
  resolvePreferredMembership,
} from "@/lib/auth/session";
import { normalizeEmailAddress } from "@/lib/auth/formal-auth";
import { recordUserLastLogin } from "@/lib/auth/login-activity";
import { logEvent } from "@/lib/analytics";
import { db } from "@/lib/db";
import {
  getDemoModeProfile,
  type DemoMode,
} from "@/lib/demo/demo-modes";
import { resolveUiLocale, UI_LOCALE_COOKIE } from "@/lib/i18n/config";
import { withLoadingRecoveryFragmentReset } from "@/lib/presentation/loading-recovery";

function resolveDemoMode(value: FormDataEntryValue | string | null) {
  const mode = typeof value === "string" ? value : null;

  if (mode === "founder" || mode === "sales" || mode === "recruiter") {
    return mode;
  }

  return null;
}

function demoEntryUrl(request: NextRequest, mode: DemoMode | null) {
  const targetMode = mode ?? "sales";

  return new URL(
    `/demo?mode=${targetMode}#demo-workspace-${targetMode}`,
    request.url,
  );
}

function resolveRedirectOrigin(request: NextRequest) {
  const directHost = request.headers.get("host");
  const forwardedHost = request.headers.get("x-forwarded-host");
  const localDirectHost =
    directHost?.startsWith("localhost") ||
    directHost?.startsWith("127.") ||
    directHost?.startsWith("[::1]");
  const host = localDirectHost
    ? directHost
    : (forwardedHost ?? directHost);

  if (!host) {
    return request.url;
  }

  const protocol =
    request.headers.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ||
    host.startsWith("127.") ||
    host.startsWith("[::1]")
      ? "http"
      : "https");

  return `${protocol}://${host}`;
}

export async function GET(request: NextRequest) {
  const mode = resolveDemoMode(request.nextUrl.searchParams.get("mode"));

  return NextResponse.redirect(demoEntryUrl(request, mode));
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const mode = resolveDemoMode(formData.get("mode"));

  if (!mode) {
    return NextResponse.redirect(demoEntryUrl(request, null));
  }

  const cookieStore = await cookies();
  const locale = resolveUiLocale(cookieStore.get(UI_LOCALE_COOKIE)?.value);
  const profile = getDemoModeProfile(mode, locale);
  const user = await db.user.findUnique({
    where: { email: normalizeEmailAddress(profile.accountEmail) },
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
    return NextResponse.redirect(demoEntryUrl(request, mode));
  }

  const activeWorkspaceId = cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value;
  const activeMembership = resolvePreferredMembership(
    user.memberships,
    activeWorkspaceId,
  );

  if (!activeMembership) {
    return NextResponse.redirect(demoEntryUrl(request, mode));
  }

  await recordUserLastLogin(user.id);
  await createSession({
    userId: user.id,
    email: user.email,
    workspaceId: activeMembership.workspaceId,
    sourcePage: "/demo/start",
    providerType: AUTH_SESSION_PROVIDER_TYPES.EMAIL_ENTRY,
  });

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
      sourcePage: "/demo/start",
    },
    sourcePage: "/demo/start",
  });

  const targetPath = withLoadingRecoveryFragmentReset(
    profile.quickPath[0]?.href ?? "/dashboard",
  );

  return NextResponse.redirect(
    new URL(targetPath, resolveRedirectOrigin(request)),
    303,
  );
}
