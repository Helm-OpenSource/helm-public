import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_SESSION_PROVIDER_TYPES } from "@/lib/auth/provider-seam";
import {
  buildPublicOauthFallbackUrl,
  buildPublicOauthSignupUrl,
  finalizePublicOauthLogin,
  findPublicOauthUserMatch,
  writePublicOauthSignupPrefillCookie,
} from "@/lib/auth/public-oauth";
import {
  exchangeWeComAuthCode,
  fetchWeComUserProfile,
} from "@/lib/connectors/wecom";
import { type UiLocale, resolveUiLocale } from "@/lib/i18n/config";

const WECOM_PUBLIC_AUTH_STATE_COOKIE = "helm-wecom-public-auth-state";

function readState(rawState: string | null) {
  if (!rawState) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawState) as { state?: string; locale?: string };

    return {
      state: parsed.state?.trim() || null,
      locale: resolveUiLocale(parsed.locale),
    };
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code") ?? url.searchParams.get("authCode");
  const stateParam = url.searchParams.get("state");
  const cookieStore = await cookies();
  const stored = readState(cookieStore.get(WECOM_PUBLIC_AUTH_STATE_COOKIE)?.value ?? null);
  cookieStore.delete(WECOM_PUBLIC_AUTH_STATE_COOKIE);

  if (!stored || !stateParam || stored.state !== stateParam || !code) {
    return NextResponse.redirect(buildPublicOauthFallbackUrl(request, "wecom"));
  }

  try {
    const identity = await exchangeWeComAuthCode(code);
    const profile = await fetchWeComUserProfile({
      accessToken: identity.accessToken,
      userId: identity.userId,
      openId: identity.openId,
    });
    const matchedUser = await findPublicOauthUserMatch({
      email: profile.email,
      phone: profile.mobile,
    });

    if (matchedUser) {
      const result = await finalizePublicOauthLogin({
        user: matchedUser,
        sourcePage: "/api/public-auth/wecom/callback",
        providerType: AUTH_SESSION_PROVIDER_TYPES.WECOM_OAUTH,
        preferredLocale: stored.locale satisfies UiLocale,
      });

      return NextResponse.redirect(new URL(result.redirectTo, request.url));
    }

    writePublicOauthSignupPrefillCookie(cookieStore, {
      provider: "wecom",
      phone: profile.mobile,
      email: profile.email,
      name: profile.nick,
    });

    return NextResponse.redirect(
      buildPublicOauthSignupUrl(request, {
        provider: "wecom",
        phone: profile.mobile,
        email: profile.email,
        name: profile.nick,
      }),
    );
  } catch {
    return NextResponse.redirect(buildPublicOauthFallbackUrl(request, "wecom"));
  }
}
