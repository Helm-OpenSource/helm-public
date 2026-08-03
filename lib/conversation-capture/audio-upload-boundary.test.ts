import { describe, expect, it } from "vitest";
import {
  MAX_CAPTURE_AUDIO_BYTES,
  inspectCaptureAudioFile,
} from "./audio-upload-boundary";
import {
  CAPTURE_TARGET_DURATION_SECONDS,
  estimatedCaptureAudioBytes,
} from "./audio-capture-policy";

function audioFile(options: {
  size?: number;
  type?: string;
  name?: string;
}) {
  const size = options.size ?? 64;
  return new File([new Uint8Array(size)], options.name ?? "capture.webm", {
    type: options.type ?? "audio/webm;codecs=opus",
  });
}

describe("capture audio upload boundary", () => {
  it("keeps the 60-minute target below the server upload boundary", () => {
    const sixtyMinuteAudioBudget = estimatedCaptureAudioBytes(
      CAPTURE_TARGET_DURATION_SECONDS,
    );

    expect(sixtyMinuteAudioBudget).toBeLessThan(MAX_CAPTURE_AUDIO_BYTES);
  });

  it("accepts browser recorder MIME parameters after normalizing the media type", () => {
    expect(inspectCaptureAudioFile(audioFile({}))).toEqual({
      ok: true,
      mediaType: "audio/webm",
      size: 64,
    });
  });

  it("rejects empty audio before ASR processing", () => {
    expect(inspectCaptureAudioFile(audioFile({ size: 0 }))).toEqual({
      ok: false,
      code: "AUDIO_EMPTY",
    });
  });

  it("rejects unsupported content types before ASR processing", () => {
    expect(
      inspectCaptureAudioFile(
        audioFile({ type: "application/octet-stream", name: "capture.bin" }),
      ),
    ).toEqual({
      ok: false,
      code: "AUDIO_TYPE_UNSUPPORTED",
    });
  });

  it("rejects audio larger than the Core request boundary", () => {
    const oversized = {
      name: "capture.webm",
      size: MAX_CAPTURE_AUDIO_BYTES + 1,
      type: "audio/webm",
    } as File;

    expect(inspectCaptureAudioFile(oversized)).toEqual({
      ok: false,
      code: "AUDIO_TOO_LARGE",
    });
  });
});
