"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  HelmCaptureApiClient,
  HelmCaptureApiError,
} = require("../lib/api-client.cjs");

test("sends only JSON control data and scoped bearer authorization", async () => {
  const calls = [];
  const client = new HelmCaptureApiClient({
    baseUrl: "https://helm.example.com",
    token: "secret-device-token",
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return new Response(
        JSON.stringify({ success: true, data: { providerSessionId: "provider-1" } }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    },
  });

  await client.start({ title: "Store pilot" });
  assert.equal(calls[0].url, "https://helm.example.com/api/capture-agents/sessions/start");
  assert.equal(calls[0].options.headers.Authorization, "Bearer secret-device-token");
  assert.equal(calls[0].options.headers["Content-Type"], "application/json");
  assert.equal(calls[0].options.signal instanceof AbortSignal, true);
  assert.equal(Buffer.isBuffer(calls[0].options.body), false);
  assert.equal(calls[0].options.body.includes("Store pilot"), true);
});

test("marks only transient failures as retryable", async () => {
  const makeClient = (status) =>
    new HelmCaptureApiClient({
      baseUrl: "https://helm.example.com",
      token: "secret-device-token",
      fetchImpl: async () =>
        new Response(
          JSON.stringify({ success: false, message: "failed", errorCode: "FAILED" }),
          { status, headers: { "Content-Type": "application/json" } },
        ),
    });

  await assert.rejects(makeClient(503).bootstrap(), (error) => {
    assert.equal(error instanceof HelmCaptureApiError, true);
    assert.equal(error.retryable, true);
    return true;
  });
  await assert.rejects(makeClient(400).bootstrap(), (error) => {
    assert.equal(error.retryable, false);
    return true;
  });
});
