"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  assertLiveControlMaterial,
  mergeDeliveryFailure,
} = require("../lib/control-material.cjs");

function liveResult(overrides = {}) {
  return {
    providerSessionId: "provider-1",
    rtc: {
      mock: false,
      appId: "app-id",
      channelName: "helm-field-example",
      publisherUid: 101,
      publisherToken: "short-lived-token",
      transcriptBotUid: 301,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      ...overrides,
    },
  };
}

test("accepts complete short-lived live RTC material", () => {
  const input = liveResult();
  assert.equal(assertLiveControlMaterial(input), input);
});

test("rejects mock, incomplete, expired, and colliding RTC material", () => {
  assert.throws(() => assertLiveControlMaterial(liveResult({ mock: true })), /non-live/);
  assert.throws(() => assertLiveControlMaterial(liveResult({ publisherToken: "" })), /incomplete/);
  assert.throws(
    () => assertLiveControlMaterial(liveResult({ expiresAt: new Date(0).toISOString() })),
    /expired/,
  );
  assert.throws(
    () => assertLiveControlMaterial(liveResult({ transcriptBotUid: 101 })),
    /must be distinct/,
  );
});

test("marks a safely stopped session as incomplete when final text delivery failed", () => {
  assert.deepEqual(
    mergeDeliveryFailure(
      { status: "STOPPED", providerSessionId: "provider-1" },
      new Error("delivery exhausted"),
    ),
    {
      status: "STOPPED",
      providerSessionId: "provider-1",
      deliveryFailure: true,
      deliveryFailureMessage: "delivery exhausted",
    },
  );
  assert.deepEqual(mergeDeliveryFailure({ status: "STOPPED" }, null), {
    status: "STOPPED",
  });
});
