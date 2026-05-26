import { NextResponse } from "next/server";
import { syncDingTalkConnectorAction } from "@/features/connectors/actions";

function buildRedirectUrl(requestUrl: string, status: "connected" | "error", message: string) {
  const params = new URLSearchParams({
    tab: "connectors",
    connector: "dingtalk",
    status,
    message,
  });
  return new URL(`/settings?${params.toString()}`, requestUrl);
}

export async function GET(request: Request) {
  const result = await syncDingTalkConnectorAction();
  if (result.ok) {
    return NextResponse.redirect(
      buildRedirectUrl(request.url, "connected", result.message ?? "DingTalk MCP sync completed"),
    );
  }

  return NextResponse.redirect(
    buildRedirectUrl(request.url, "error", result.error ?? "DingTalk MCP sync failed"),
  );
}
