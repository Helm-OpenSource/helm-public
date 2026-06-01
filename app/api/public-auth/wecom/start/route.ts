import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  buildPublicOauthFallbackUrl,
} from "@/lib/auth/public-oauth";
import { resolveRequestUiLocale } from "@/lib/i18n/request-locale.server";
import { buildWeComAuthUrl, isWeComOauthConfigured } from "@/lib/connectors/wecom";

const WECOM_PUBLIC_AUTH_STATE_COOKIE = "helm-wecom-public-auth-state";

export async function GET(request: Request) {
  if (!isWeComOauthConfigured()) {
    return NextResponse.redirect(buildPublicOauthFallbackUrl(request, "wecom"));
  }

  const cookieStore = await cookies();
  const locale = await resolveRequestUiLocale();
  const state = randomUUID();

  cookieStore.set(
    WECOM_PUBLIC_AUTH_STATE_COOKIE,
    JSON.stringify({
      state,
      locale,
    }),
    {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 10,
    },
  );

  return NextResponse.redirect(buildWeComAuthUrl(state));
}
