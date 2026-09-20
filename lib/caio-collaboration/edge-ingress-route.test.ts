import { afterEach, describe, expect, it } from "vitest";

import {
  GET,
  POST,
  readBoundedRequestBody,
} from "@/app/api/runtime/caio/workbuddy/route";

const originalSecret = process.env.CAIO_WORKBUDDY_EDGE_SHARED_SECRET;
const originalSystemKey =
  process.env.CAIO_WORKBUDDY_EDGE_WORKSPACE_SYSTEM_KEY;

afterEach(() => {
  if (originalSecret === undefined) {
    delete process.env.CAIO_WORKBUDDY_EDGE_SHARED_SECRET;
  } else {
    process.env.CAIO_WORKBUDDY_EDGE_SHARED_SECRET = originalSecret;
  }
  if (originalSystemKey === undefined) {
    delete process.env.CAIO_WORKBUDDY_EDGE_WORKSPACE_SYSTEM_KEY;
  } else {
    process.env.CAIO_WORKBUDDY_EDGE_WORKSPACE_SYSTEM_KEY =
      originalSystemKey;
  }
});

describe("WorkBuddy cloud edge route", () => {
  it("allows POST only", async () => {
    const response = await GET();
    expect(response.status).toBe(405);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "workbuddy_edge_post_required",
    });
  });

  it("fails closed before parsing when deployment config is absent", async () => {
    delete process.env.CAIO_WORKBUDDY_EDGE_SHARED_SECRET;
    delete process.env.CAIO_WORKBUDDY_EDGE_WORKSPACE_SYSTEM_KEY;
    const response = await POST(
      new Request("https://example.test/api/runtime/caio/workbuddy", {
        method: "POST",
        body: "not-json",
      }),
    );
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "workbuddy_edge_not_configured",
    });
  });

  it("rejects an oversized body without touching the database", async () => {
    process.env.CAIO_WORKBUDDY_EDGE_SHARED_SECRET = "s".repeat(48);
    process.env.CAIO_WORKBUDDY_EDGE_WORKSPACE_SYSTEM_KEY = "anson";
    const response = await POST(
      new Request("https://example.test/api/runtime/caio/workbuddy", {
        method: "POST",
        headers: { "content-length": "1048577" },
        body: "{}",
      }),
    );
    expect(response.status).toBe(413);
  });

  it("stops reading a chunked body as soon as the byte limit is crossed", async () => {
    let pulls = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1;
        controller.enqueue(new Uint8Array(600_000));
        if (pulls === 3) controller.close();
      },
    });

    await expect(
      readBoundedRequestBody(body, 1_048_576),
    ).resolves.toBeNull();
    expect(pulls).toBe(2);
  });
});
