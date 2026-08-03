import { describe, expect, it } from "vitest";
import {
  buildTranscriptSegmentKey,
  normalizeFinalTranscriptSegments,
  orderTranscriptSegments,
} from "@/lib/integrations/agora-field-capture/transcript-segment";

describe("Agora final transcript segments", () => {
  const finalSegment = {
    sourceUid: "101",
    sentenceId: "9",
    text: "  需要试一下小一码  ",
    textTsMs: "1784354400123",
    durationMs: 1800,
    language: "zh-CN",
    isFinal: true,
  };

  it("normalizes final text and creates a stable provider idempotency key", () => {
    expect(normalizeFinalTranscriptSegments([finalSegment])).toEqual([
      {
        ...finalSegment,
        text: "需要试一下小一码",
      },
    ]);
    expect(buildTranscriptSegmentKey(finalSegment)).toBe("101:9");
  });

  it("rejects interim, empty, oversized, and duplicate segments", () => {
    expect(() =>
      normalizeFinalTranscriptSegments([{ ...finalSegment, isFinal: false }]),
    ).toThrow("Only final Agora transcript segments are accepted");
    expect(() =>
      normalizeFinalTranscriptSegments([{ ...finalSegment, text: " " }]),
    ).toThrow("Transcript segment text is required");
    expect(() =>
      normalizeFinalTranscriptSegments([
        finalSegment,
        { ...finalSegment, text: "duplicate" },
      ]),
    ).toThrow("Duplicate transcript segment in request: 101:9");
    expect(() =>
      normalizeFinalTranscriptSegments([
        { ...finalSegment, text: "x".repeat(4001) },
      ]),
    ).toThrow("Transcript segment text exceeds 4000 characters");
    expect(() =>
      normalizeFinalTranscriptSegments([
        { ...finalSegment, sentenceId: "9223372036854775808" },
      ]),
    ).toThrow("sentenceId exceeds signed int64 range");
  });

  it("orders out-of-order provider segments deterministically", () => {
    const segments = [
      { ...finalSegment, sentenceId: "11", textTsMs: "2000", receivedAt: new Date("2026-07-18T01:00:02Z") },
      { ...finalSegment, sentenceId: "10", textTsMs: "1000", receivedAt: new Date("2026-07-18T01:00:03Z") },
      { ...finalSegment, sourceUid: "102", sentenceId: "1", textTsMs: "1000", receivedAt: new Date("2026-07-18T01:00:01Z") },
    ];

    expect(orderTranscriptSegments(segments).map(buildTranscriptSegmentKey)).toEqual([
      "102:1",
      "101:10",
      "101:11",
    ]);
  });
});
