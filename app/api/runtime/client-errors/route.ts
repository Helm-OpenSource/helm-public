import { NextResponse } from "next/server";

function trimText(value: unknown, max = 2000) {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }
  return normalized.length > max ? `${normalized.slice(0, max)}…` : normalized;
}

function normalizeErrorPayload(body: unknown) {
  if (!body || typeof body !== "object") {
    return {
      message: null,
      name: null,
      stack: null,
      digest: null,
      url: null,
      userAgent: null,
      timestamp: null,
    };
  }

  const candidate = body as Record<string, unknown>;
  return {
    message: trimText(candidate.message, 500),
    name: trimText(candidate.name, 120),
    stack: trimText(candidate.stack, 4000),
    digest: trimText(candidate.digest, 120),
    url: trimText(candidate.url, 1000),
    userAgent: trimText(candidate.userAgent, 300),
    timestamp: trimText(candidate.timestamp, 120),
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = normalizeErrorPayload(body);

    console.error("[client-runtime-error]", {
      ...payload,
      ip:
        request.headers.get("x-forwarded-for") ??
        request.headers.get("x-real-ip") ??
        "unknown",
      referer: trimText(request.headers.get("referer"), 1000),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[client-runtime-error] failed to record", error);
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
