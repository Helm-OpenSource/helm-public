export const CAPTURE_RECORDER_AUDIO_BITS_PER_SECOND = 48_000;
export const CAPTURE_TARGET_DURATION_SECONDS = 60 * 60;
export const MAX_CAPTURE_AUDIO_BYTES = 25 * 1024 * 1024;

export function estimatedCaptureAudioBytes(durationSeconds: number) {
  return (CAPTURE_RECORDER_AUDIO_BITS_PER_SECOND * durationSeconds) / 8;
}
