import { NextResponse } from "next/server";

import {
  createWorkBuddyEdgeIngressHandler,
} from "@/lib/caio-collaboration/edge-ingress";
import {
  createWorkBuddyWorkspaceIdResolver,
} from "@/lib/caio-collaboration-runtime/workbuddy-workspace-resolver.service";
import { db } from "@/lib/db";
import {
  createPrismaWorkBuddyReadOnlyDispatcher,
} from "@/tools/caio-workbuddy-gateway/prisma-readonly-runtime";

const MAX_EDGE_BODY_BYTES = 1_048_576;

export const dynamic = "force-dynamic";

export async function readBoundedRequestBody(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
): Promise<string | null> {
  if (!body) return "";
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      totalBytes += result.value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel("workbuddy_edge_request_too_large");
        return null;
      }
      chunks.push(result.value);
    }
  } finally {
    reader.releaseLock();
  }
  const joined = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(joined);
  } catch {
    return null;
  }
}

export async function GET(): Promise<Response> {
  return NextResponse.json(
    { ok: false, error: "workbuddy_edge_post_required" },
    { status: 405 },
  );
}
export async function POST(request: Request): Promise<Response> {
  const expectedSecret =
    process.env.CAIO_WORKBUDDY_EDGE_SHARED_SECRET?.trim() ?? "";
  const expectedWorkspaceSystemKey =
    process.env.CAIO_WORKBUDDY_EDGE_WORKSPACE_SYSTEM_KEY?.trim() ?? "";
  if (
    Buffer.byteLength(expectedSecret, "utf8") < 32 ||
    !/^[a-z][a-z0-9_-]{0,99}$/.test(expectedWorkspaceSystemKey)
  ) {
    return NextResponse.json(
      { ok: false, error: "workbuddy_edge_not_configured" },
      { status: 503 },
    );
  }

  const contentLength = Number(
    request.headers.get("content-length") ?? "0",
  );
  if (
    Number.isFinite(contentLength) &&
    contentLength > MAX_EDGE_BODY_BYTES
  ) {
    return NextResponse.json(
      { ok: false, error: "workbuddy_edge_request_too_large" },
      { status: 413 },
    );
  }

  const source = await readBoundedRequestBody(
    request.body,
    MAX_EDGE_BODY_BYTES,
  );
  if (source === null) {
    return NextResponse.json(
      { ok: false, error: "workbuddy_edge_request_too_large" },
      { status: 413 },
    );
  }
  let body: unknown;
  try {
    body = JSON.parse(source);
  } catch {
    return NextResponse.json(
      { ok: false, error: "workbuddy_edge_request_invalid" },
      { status: 400 },
    );
  }

  const handler = createWorkBuddyEdgeIngressHandler({
    expectedSecret,
    expectedWorkspaceSystemKey,
    resolveWorkspaceId: createWorkBuddyWorkspaceIdResolver({
      database: db,
    }),
    dispatcher: createPrismaWorkBuddyReadOnlyDispatcher(),
  });
  const result = await handler({
    credential:
      request.headers.get("x-helm-caio-edge-token")?.trim() ?? "",
    body,
    signal: request.signal,
  });
  if (result.body === null) {
    return new Response(null, { status: result.status });
  }
  return NextResponse.json(result.body, { status: result.status });
}
