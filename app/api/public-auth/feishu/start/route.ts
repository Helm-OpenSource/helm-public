import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import {
  buildPublicOauthFallbackUrl,
  setPublicOauthStateCookie,
} from "@/lib/auth/public-oauth";
import { buildFeishuAuthUrl, isFeishuOauthConfigured } from "@/lib/connectors/feishu";
import { resolveRequestUiLocale } from "@/lib/i18n/request-locale.server";

export async function GET(request: Request) {
  if (!isFeishuOauthConfigured()) {
    return NextResponse.redirect(buildPublicOauthFallbackUrl(request, "feishu"));
  }

  const url = new URL(request.url);
  const locale = await resolveRequestUiLocale();
  const state = randomUUID();

  await setPublicOauthStateCookie({
    provider: "feishu",
    state,
    locale,
    organizationName: url.searchParams.get("org"),
    workspaceId: url.searchParams.get("ws"),
    title: url.searchParams.get("title"),
  });

  return NextResponse.redirect(buildFeishuAuthUrl(state));
}
