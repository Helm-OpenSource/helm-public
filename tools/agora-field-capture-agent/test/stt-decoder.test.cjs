"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { createSttDecoder } = require("../lib/stt-decoder.cjs");

const decoder = createSttDecoder(path.join(__dirname, "../proto/SttMessage.proto"));

function encode(value) {
  return decoder.type.encode(decoder.type.create(value)).finish();
}

test("decodes a final Agora transcript into the bounded Helm segment contract", () => {
  const segment = decoder.decode(
    encode({
      uid: 101,
      time: 1784354400000,
      words: [{ text: "这件外套还有小一码吗", isFinal: true }],
      durationMs: 1840,
      dataType: "transcribe",
      culture: "zh-CN",
      textTs: 1784354400123,
      sentenceId: 789,
    }),
  );

  assert.deepEqual(segment, {
    sourceUid: "101",
    sentenceId: "789",
    text: "这件外套还有小一码吗",
    textTsMs: "1784354400123",
    durationMs: 1840,
    language: "zh-CN",
    isFinal: true,
  });
});

test("ignores interim, translation, and non-idempotent messages", () => {
  assert.equal(
    decoder.decode(
      encode({ words: [{ text: "interim", isFinal: false }], sentenceId: 1, textTs: 2 }),
    ),
    null,
  );
  assert.equal(
    decoder.decode(
      encode({
        dataType: "translate",
        words: [{ text: "translated", isFinal: true }],
        sentenceId: 1,
        textTs: 2,
      }),
    ),
    null,
  );
  assert.equal(
    decoder.decode(encode({ words: [{ text: "missing id", isFinal: true }] })),
    null,
  );
});
