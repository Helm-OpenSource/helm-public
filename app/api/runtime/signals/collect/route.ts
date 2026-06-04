import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import {
  listRegisteredSignalCollectionJobs,
  runRegisteredSignalCollectionJobs,
} from "@/lib/extensions/registry";

const SIGNAL_COLLECTION_CRON_ENTRYPOINT = {
  class: "registered_signal_collection",
  label: "Registered signal collection cron dispatch",
  method: "POST",
  path: "/api/runtime/signals/collect",
  jobKeySelection: "query.jobKey",
};

function isEnglishRequest(request: Request) {
  return request.headers.get("accept-language")?.toLowerCase().startsWith("en") ?? false;
}

function getSignalCollectionCronMessage(
  request: Request,
  key: "tokenNotConfigured" | "unauthorizedToken" | "usePost" | "unknownJob",
) {
  const english = isEnglishRequest(request);
  const messages = {
    tokenNotConfigured: english
      ? "SIGNAL_COLLECTION_CRON_TOKEN is not configured."
      : "SIGNAL_COLLECTION_CRON_TOKEN 尚未配置。",
    unauthorizedToken: english ? "Unauthorized cron token." : "cron token 未授权。",
    usePost: english
      ? "Use POST for signal collection cron dispatch."
      : "请使用 POST 触发信号采集 cron dispatch。",
    unknownJob: english ? "Unknown signal collection job." : "未知的信号采集任务。",
  } as const;
  return messages[key];
}

function authorizeSignalCollectionCron(request: Request) {
  const expected = process.env.SIGNAL_COLLECTION_CRON_TOKEN?.trim() || "";
  if (!expected) {
    return {
      ok: false,
      status: 503,
      error: getSignalCollectionCronMessage(request, "tokenNotConfigured"),
    } as const;
  }

  const token = request.headers.get("x-helm-cron-token")?.trim() || "";
  if (!safeTokenEqual(token, expected)) {
    return {
      ok: false,
      status: 401,
      error: getSignalCollectionCronMessage(request, "unauthorizedToken"),
    } as const;
  }

  return { ok: true } as const;
}

export async function GET(request: Request) {
  return NextResponse.json(
    {
      ok: false,
      error: getSignalCollectionCronMessage(request, "usePost"),
      entrypoint: SIGNAL_COLLECTION_CRON_ENTRYPOINT,
    },
    { status: 405 },
  );
}

export async function POST(request: Request) {
  const auth = authorizeSignalCollectionCron(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const url = new URL(request.url);
  const requestedJobKeys = parseJobKeys(url.searchParams.getAll("jobKey"));
  const registeredJobKeys = new Set(
    listRegisteredSignalCollectionJobs().map((job) => job.key),
  );
  const unknownJobKeys = requestedJobKeys.filter(
    (jobKey) => !registeredJobKeys.has(jobKey),
  );
  if (unknownJobKeys.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        error: getSignalCollectionCronMessage(request, "unknownJob"),
        unknownJobKeys,
      },
      { status: 404 },
    );
  }

  const result = await runRegisteredSignalCollectionJobs({
    jobKeys: requestedJobKeys.length > 0 ? requestedJobKeys : undefined,
    source: "api",
  });
  return NextResponse.json({
    ...result,
    entrypoint: SIGNAL_COLLECTION_CRON_ENTRYPOINT,
  });
}

function parseJobKeys(values: string[]) {
  return Array.from(
    new Set(
      values
        .flatMap((value) => value.split(","))
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );
}

function safeTokenEqual(actual: string, expected: string) {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length) {
    return false;
  }
  return timingSafeEqual(actualBuffer, expectedBuffer);
}
