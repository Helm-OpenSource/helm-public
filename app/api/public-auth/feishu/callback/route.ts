import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_SESSION_PROVIDER_TYPES } from "@/lib/auth/provider-seam";
import {
  buildPublicOauthFallbackUrl,
  buildPublicOauthSignupUrl,
  finalizePublicOauthLogin,
  readPublicOauthState,
  resolvePublicOauthUserMatch,
  writePublicOauthSignupPrefillCookie,
  FEISHU_PUBLIC_AUTH_STATE_COOKIE,
} from "@/lib/auth/public-oauth";
import {
  exchangeFeishuAuthCode,
  fetchFeishuUserProfile,
} from "@/lib/connectors/feishu";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code") ?? url.searchParams.get("authCode");
  const stateParam = url.searchParams.get("state");
  const cookieStore = await cookies();
  const stored = readPublicOauthState(
    cookieStore.get(FEISHU_PUBLIC_AUTH_STATE_COOKIE)?.value ?? null,
  );
  cookieStore.delete(FEISHU_PUBLIC_AUTH_STATE_COOKIE);

  if (!stored || !stateParam || stored.state !== stateParam || !code) {
    return NextResponse.redirect(buildPublicOauthFallbackUrl(request, "feishu"));
  }

  try {
    const identity = await exchangeFeishuAuthCode(code);
    const profile = await fetchFeishuUserProfile(identity.accessToken);
    const matchedUser = await resolvePublicOauthUserMatch({
      email: profile.email,
      phone: profile.mobile,
    });

    if (matchedUser.status === "matched") {
      const result = await finalizePublicOauthLogin({
        user: matchedUser.user,
        sourcePage: "/api/public-auth/feishu/callback",
        providerType: AUTH_SESSION_PROVIDER_TYPES.FEISHU_OAUTH,
        preferredLocale: stored.locale,
        preferredWorkspaceId: stored.workspaceId,
        profile: {
          name: profile.nick,
          phone: profile.mobile,
          avatar: profile.avatarUrl,
        },
      });

      return NextResponse.redirect(new URL(result.redirectTo, request.url));
    }

    if (matchedUser.status === "identity-conflict") {
      return NextResponse.redirect(
        buildPublicOauthFallbackUrl(request, "feishu", "identity-conflict"),
      );
    }

    if (matchedUser.status === "missing-identity") {
      return NextResponse.redirect(
        buildPublicOauthFallbackUrl(request, "feishu", "missing-identity"),
      );
    }

    writePublicOauthSignupPrefillCookie(cookieStore, {
      provider: "feishu",
      phone: profile.mobile,
      email: profile.email,
      name: profile.nick,
      organizationName: stored.organizationName,
      invitedWorkspaceId: stored.workspaceId,
      title: stored.title,
    });

    return NextResponse.redirect(
      buildPublicOauthSignupUrl(request, {
        provider: "feishu",
        phone: profile.mobile,
        email: profile.email,
        name: profile.nick,
      }),
    );
  } catch {
    return NextResponse.redirect(buildPublicOauthFallbackUrl(request, "feishu"));
  }
}
