import { MAX_CAPTURE_AUDIO_BYTES } from "./audio-capture-policy";

export { MAX_CAPTURE_AUDIO_BYTES } from "./audio-capture-policy";

const ALLOWED_CAPTURE_AUDIO_TYPES = new Set([
  "audio/webm",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
  "audio/x-wav",
]);

export type CaptureAudioInspection =
  | {
      ok: true;
      mediaType: string;
      size: number;
    }
  | {
      ok: false;
      code: "AUDIO_EMPTY" | "AUDIO_TOO_LARGE" | "AUDIO_TYPE_UNSUPPORTED";
    };

function normalizeMediaType(value: string) {
  return value.split(";", 1)[0]?.trim().toLowerCase() ?? "";
}

export function inspectCaptureAudioFile(file: File): CaptureAudioInspection {
  if (!Number.isFinite(file.size) || file.size <= 0) {
    return { ok: false, code: "AUDIO_EMPTY" };
  }
  if (file.size > MAX_CAPTURE_AUDIO_BYTES) {
    return { ok: false, code: "AUDIO_TOO_LARGE" };
  }

  const mediaType = normalizeMediaType(file.type);
  if (!ALLOWED_CAPTURE_AUDIO_TYPES.has(mediaType)) {
    return { ok: false, code: "AUDIO_TYPE_UNSUPPORTED" };
  }

  return {
    ok: true,
    mediaType,
    size: file.size,
  };
}
