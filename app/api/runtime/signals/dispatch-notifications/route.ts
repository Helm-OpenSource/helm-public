import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { dispatchPendingBiReportSignalNotifications } from "@/lib/bi-report-skill/signal-notification-dispatcher";

function authorize(request: Request) {
  const expected = process.env.SIGNAL_COLLECTION_CRON_TOKEN?.trim() || "";
  if (!expected) {
    return { ok: false, status: 503, error: "SIGNAL_COLLECTION_CRON_TOKEN is not configured." } as const;
  }
  const token = request.headers.get("x-helm-cron-token")?.trim() || "";
  if (!safeTokenEqual(token, expected)) {
    return { ok: false, status: 401, error: "Unauthorized cron token." } as const;
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
    return NextResponse.json({ ok: false, error: "missing workspaceId" }, { status: 400 });
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

