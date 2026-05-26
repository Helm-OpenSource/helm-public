import { NextResponse } from "next/server";
import { resolvePublicOauthRequestBaseUrl } from "@/lib/auth/public-oauth";

export async function GET(request: Request) {
  const current = new URL(request.url);
  const callbackUrl = new URL("/api/auth/dingtalk/callback", resolvePublicOauthRequestBaseUrl(request));
  callbackUrl.search = current.search;
  return NextResponse.redirect(callbackUrl);
}
