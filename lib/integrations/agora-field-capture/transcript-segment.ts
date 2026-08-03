export const MAX_TRANSCRIPT_SEGMENT_TEXT_LENGTH = 4000;
export const MAX_TRANSCRIPT_SEGMENTS_PER_REQUEST = 100;
const MAX_SIGNED_INT64 = BigInt("9223372036854775807");

export type AgoraFinalTranscriptSegmentInput = {
  sourceUid: string;
  sentenceId: string;
  text: string;
  textTsMs: string;
  durationMs: number;
  language: string;
  isFinal: boolean;
};

export type StoredTranscriptSegment = AgoraFinalTranscriptSegmentInput & {
  receivedAt: Date;
};

export function buildTranscriptSegmentKey(
  segment: Pick<AgoraFinalTranscriptSegmentInput, "sourceUid" | "sentenceId">,
) {
  return `${segment.sourceUid}:${segment.sentenceId}`;
}

function assertNumericString(value: string, field: string) {
  if (!/^\d{1,20}$/.test(value)) {
    throw new Error(`${field} must be a positive integer string`);
  }
  if (BigInt(value) > MAX_SIGNED_INT64) {
    throw new Error(`${field} exceeds signed int64 range`);
  }
}

export function normalizeFinalTranscriptSegments(
  segments: AgoraFinalTranscriptSegmentInput[],
) {
  if (!segments.length) {
    throw new Error("At least one final transcript segment is required");
  }
  if (segments.length > MAX_TRANSCRIPT_SEGMENTS_PER_REQUEST) {
    throw new Error(
      `At most ${MAX_TRANSCRIPT_SEGMENTS_PER_REQUEST} transcript segments are accepted per request`,
    );
  }

  const seen = new Set<string>();
  return segments.map((segment) => {
    if (!segment.isFinal) {
      throw new Error("Only final Agora transcript segments are accepted");
    }
    const text = segment.text.trim();
    if (!text) {
      throw new Error("Transcript segment text is required");
    }
    if (text.length > MAX_TRANSCRIPT_SEGMENT_TEXT_LENGTH) {
      throw new Error(
        `Transcript segment text exceeds ${MAX_TRANSCRIPT_SEGMENT_TEXT_LENGTH} characters`,
      );
    }
    assertNumericString(segment.sourceUid, "sourceUid");
    assertNumericString(segment.sentenceId, "sentenceId");
    assertNumericString(segment.textTsMs, "textTsMs");
    if (
      !Number.isInteger(segment.durationMs) ||
      segment.durationMs < 0 ||
      segment.durationMs > 3_600_000
    ) {
      throw new Error("durationMs must be an integer between 0 and 3600000");
    }
    if (!/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})?$/.test(segment.language)) {
      throw new Error("language must be a BCP-47 language tag");
    }

    const normalized = { ...segment, text };
    const key = buildTranscriptSegmentKey(normalized);
    if (seen.has(key)) {
      throw new Error(`Duplicate transcript segment in request: ${key}`);
    }
    seen.add(key);
    return normalized;
  });
}

function compareIntegerStrings(left: string, right: string) {
  const leftValue = BigInt(left);
  const rightValue = BigInt(right);
  return leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0;
}

export function orderTranscriptSegments<T extends StoredTranscriptSegment>(
  segments: readonly T[],
) {
  return [...segments].sort((left, right) => {
    const timestampOrder = compareIntegerStrings(left.textTsMs, right.textTsMs);
    if (timestampOrder !== 0) return timestampOrder;
    const receivedOrder = left.receivedAt.getTime() - right.receivedAt.getTime();
    if (receivedOrder !== 0) return receivedOrder;
    const uidOrder = compareIntegerStrings(left.sourceUid, right.sourceUid);
    if (uidOrder !== 0) return uidOrder;
    return compareIntegerStrings(left.sentenceId, right.sentenceId);
  });
}
