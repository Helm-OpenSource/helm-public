"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { BoundedSegmentDelivery } = require("../lib/segment-delivery.cjs");

const segment = {
  sourceUid: "101",
  sentenceId: "1",
  text: "final",
  textTsMs: "1000",
  durationMs: 500,
  language: "zh-CN",
  isFinal: true,
};

test("deduplicates segments and delivers them without local persistence", async () => {
  const delivered = [];
  const queue = new BoundedSegmentDelivery({
    deliver: async (batch) => delivered.push(batch),
    waitImpl: async () => {},
  });

  assert.equal(queue.enqueue(segment), true);
  assert.equal(queue.enqueue(segment), false);
  await queue.flush();
  assert.deepEqual(delivered, [[segment]]);
  assert.equal(Object.hasOwn(queue, "audio"), false);
});

test("retries transient delivery and fails closed on queue overflow", async () => {
  let attempts = 0;
  const states = [];
  const queue = new BoundedSegmentDelivery({
    maxQueued: 1,
    retryDelaysMs: [1],
    waitImpl: async () => {},
    onState: (state) => states.push(state),
    deliver: async () => {
      attempts += 1;
      if (attempts === 1) throw Object.assign(new Error("temporary"), { retryable: true });
    },
  });

  assert.equal(queue.enqueue(segment), true);
  assert.equal(queue.enqueue({ ...segment, sentenceId: "2" }), false);
  await assert.rejects(queue.flush(), /bounded limit/);
  assert.equal(states.some((state) => state.state === "DEGRADED"), true);
});
