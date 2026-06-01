import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_SESSION_PROVIDER_TYPES } from "@/lib/auth/provider-seam";
import {
  buildPublicOauthFallbackUrl,
  buildPublicOauthSignupUrl,
  finalizePublicOauthLogin,
  findActivePublicOauthUserById,
  writePublicOauthSignupPrefillCookie,
} from "@/lib/auth/public-oauth";
import {
  consumePublicOauthQrFlow,
  getPublicOauthQrFlowOwnerCookieName,
} from "@/lib/auth/public-oauth-qr-flow";
import { DINGTALK_OAUTH_CALLBACK_SOURCE_PAGE } from "@/lib/connectors/dingtalk";

function toRelativeLocation(url: URL) {
  return `${url.pathname}${url.search}`;
}

function redirectRelative(location: string) {
  return new NextResponse(null, {
    status: 307,
    headers: {
      Location: location,
      "Cache-Control": "no-store",
    },
  });
}

function redirectPublicUrl(url: URL) {
  return redirectRelative(toRelativeLocation(url));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const flowId = url.searchParams.get("flowId");
  const completionToken = url.searchParams.get("token");
  const cookieStore = await cookies();
  const ownerKey = flowId
    ? cookieStore.get(getPublicOauthQrFlowOwnerCookieName(flowId))?.value ?? null
    : null;

  if (flowId) {
    cookieStore.delete(getPublicOauthQrFlowOwnerCookieName(flowId));
  }

  const consumed = await consumePublicOauthQrFlow({
    flowId,
    ownerKey,
    completionToken,
  });

  if (!consumed.ok) {
    const fallbackUrl = buildPublicOauthFallbackUrl(request, "dingtalk", "failure");
    fallbackUrl.searchParams.set("reason", `qr-complete-${consumed.reason}`);
    return redirectPublicUrl(fallbackUrl);
  }
  const resolution = consumed.resolution;

  if (resolution.status === "matched") {
    const user = await findActivePublicOauthUserById(resolution.userId);

    if (!user) {
      const fallbackUrl = buildPublicOauthFallbackUrl(request, "dingtalk", "failure");
      fallbackUrl.searchParams.set("reason", "qr-complete-user-not-found");
      return redirectPublicUrl(fallbackUrl);
    }

    const result = await finalizePublicOauthLogin({
      user,
      sourcePage: DINGTALK_OAUTH_CALLBACK_SOURCE_PAGE,
      providerType: AUTH_SESSION_PROVIDER_TYPES.DINGTALK_OAUTH,
      preferredLocale: resolution.preferredLocale,
      profile: resolution.profile,
      preferredWorkspaceId: resolution.preferredWorkspaceId ?? null,
    });

    if (!result.ok) {
      const fallbackUrl = buildPublicOauthFallbackUrl(request, "dingtalk", "failure");
      fallbackUrl.searchParams.set("reason", "qr-complete-finalize-not-ok");
      return redirectPublicUrl(fallbackUrl);
    }

    return redirectRelative(result.redirectTo.startsWith("/") ? result.redirectTo : "/dashboard");
  }

  if (resolution.status === "unmatched") {
    writePublicOauthSignupPrefillCookie(cookieStore, resolution.prefill);

    return redirectPublicUrl(
      buildPublicOauthSignupUrl(request, {
        provider: "dingtalk",
      }),
    );
  }

  const fallbackUrl = buildPublicOauthFallbackUrl(request, "dingtalk", resolution.status);
  fallbackUrl.searchParams.set("reason", `qr-resolution-${resolution.status}`);
  return redirectPublicUrl(fallbackUrl);
}
