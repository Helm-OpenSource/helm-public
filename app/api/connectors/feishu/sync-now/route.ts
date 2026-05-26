import { NextResponse } from "next/server";
import { syncFeishuConnectorAction } from "@/features/connectors/actions";

function buildRedirectUrl(requestUrl: string, status: "connected" | "error", message: string) {
  const params = new URLSearchParams({
    tab: "connectors",
    connector: "feishu",
    status,
    message,
  });
  return new URL(`/settings?${params.toString()}`, requestUrl);
}

export async function GET(request: Request) {
  const result = await syncFeishuConnectorAction();
  if (result.ok) {
    return NextResponse.redirect(
      buildRedirectUrl(
        request.url,
        "connected",
        result.message ?? "Feishu Bitable read-only ingest completed",
      ),
    );
  }

  return NextResponse.redirect(
    buildRedirectUrl(
      request.url,
      "error",
      result.error ?? "Feishu Bitable read-only ingest failed",
    ),
  );
}
