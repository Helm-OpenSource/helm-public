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

function authorizeSignalCollectionCron(request: Request) {
  const expected = process.env.SIGNAL_COLLECTION_CRON_TOKEN?.trim() || "";
  if (!expected) {
    return {
      ok: false,
      status: 503,
      error: "SIGNAL_COLLECTION_CRON_TOKEN is not configured.",
    } as const;
  }

  const token = request.headers.get("x-helm-cron-token")?.trim() || "";
  if (!safeTokenEqual(token, expected)) {
    return {
      ok: false,
      status: 401,
      error: "Unauthorized cron token.",
    } as const;
  }

  return { ok: true } as const;
}

export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      error: "Use POST for signal collection cron dispatch.",
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
        error: "Unknown signal collection job.",
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
