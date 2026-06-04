import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { dispatchPendingBiReportSignalNotifications } from "@/lib/bi-report-skill/signal-notification-dispatcher";

function isEnglishRequest(request: Request) {
  return request.headers.get("accept-language")?.toLowerCase().startsWith("en") ?? false;
}

function getSignalNotificationDispatchMessage(
  request: Request,
  key: "tokenNotConfigured" | "unauthorizedToken" | "missingWorkspaceId",
) {
  const english = isEnglishRequest(request);
  const messages = {
    tokenNotConfigured: english
      ? "SIGNAL_COLLECTION_CRON_TOKEN is not configured."
      : "SIGNAL_COLLECTION_CRON_TOKEN 尚未配置。",
    unauthorizedToken: english ? "Unauthorized cron token." : "cron token 未授权。",
    missingWorkspaceId: english ? "Missing workspaceId." : "缺少 workspaceId。",
  } as const;
  return messages[key];
}

function authorize(request: Request) {
  const expected = process.env.SIGNAL_COLLECTION_CRON_TOKEN?.trim() || "";
  if (!expected) {
    return {
      ok: false,
      status: 503,
      error: getSignalNotificationDispatchMessage(request, "tokenNotConfigured"),
    } as const;
  }
  const token = request.headers.get("x-helm-cron-token")?.trim() || "";
  if (!safeTokenEqual(token, expected)) {
    return {
      ok: false,
      status: 401,
      error: getSignalNotificationDispatchMessage(request, "unauthorizedToken"),
    } as const;
  }
  return { ok: true } as const;
}

export async function POST(request: Request) {
  const auth = authorize(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const url = new URL(request.url);
  const workspaceId = url.searchParams.get("workspaceId")?.trim() || "";
  if (!workspaceId) {
    return NextResponse.json(
      { ok: false, error: getSignalNotificationDispatchMessage(request, "missingWorkspaceId") },
      { status: 400 },
    );
  }

  const result = await dispatchPendingBiReportSignalNotifications({ workspaceId, take: 200 });
  return NextResponse.json({ ok: true, workspaceId, result });
}

function safeTokenEqual(actual: string, expected: string) {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(actualBuffer, expectedBuffer);
}
