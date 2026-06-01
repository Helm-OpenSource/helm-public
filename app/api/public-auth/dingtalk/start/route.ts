import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import {
  buildPublicOauthFallbackUrl,
  setPublicOauthStateCookie,
} from "@/lib/auth/public-oauth";
import { resolveRequestUiLocale } from "@/lib/i18n/request-locale.server";
import { buildDingTalkAuthUrl, isDingTalkOauthConfigured } from "@/lib/connectors/dingtalk";

export async function GET(request: Request) {
  if (!isDingTalkOauthConfigured()) {
    return NextResponse.redirect(buildPublicOauthFallbackUrl(request, "dingtalk"));
  }

  const url = new URL(request.url);
  const flowId = url.searchParams.get("flowId");
  const organizationName = url.searchParams.get("org");
  const workspaceId = url.searchParams.get("ws");
  const title = url.searchParams.get("title");
  const locale = await resolveRequestUiLocale();
  const state = randomUUID();

  await setPublicOauthStateCookie({
    provider: "dingtalk",
    state,
    locale,
    flowId,
    organizationName,
    workspaceId,
    title,
  });

  return NextResponse.redirect(buildDingTalkAuthUrl(state));
}
