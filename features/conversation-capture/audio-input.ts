import { CAPTURE_RECORDER_AUDIO_BITS_PER_SECOND } from "@/lib/conversation-capture/audio-capture-policy";

export type AudioInputOption = {
  deviceId: string;
  label: string;
  labelAvailable: boolean;
};

export type AudioTrackProfile = {
  label: string;
  sampleRate?: number;
  channelCount?: number;
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
};

export function collectAudioInputOptions(
  devices: MediaDeviceInfo[],
  fallbackLabelPrefix = "Microphone",
): AudioInputOption[] {
  const seen = new Set<string>();
  const options: AudioInputOption[] = [];

  for (const device of devices) {
    if (device.kind !== "audioinput" || !device.deviceId || seen.has(device.deviceId)) {
      continue;
    }

    seen.add(device.deviceId);
    const label = device.label.trim();
    options.push({
      deviceId: device.deviceId,
      label: label || `${fallbackLabelPrefix} ${options.length + 1}`,
      labelAvailable: Boolean(label),
    });
  }

  return options;
}

export function pickAudioInputOption(
  options: AudioInputOption[],
  requestedDeviceId?: string | null,
) {
  if (requestedDeviceId) {
    const requested = options.find((option) => option.deviceId === requestedDeviceId);
    if (requested) return requested;
  }

  return options.find((option) => option.deviceId === "default") ?? options[0] ?? null;
}

export function buildAudioCaptureConstraints(deviceId?: string | null): MediaStreamConstraints {
  const audio: MediaTrackConstraints = {
    sampleRate: { ideal: 48_000 },
    channelCount: { ideal: 2 },
  };

  if (deviceId) {
    audio.deviceId = { exact: deviceId };
  }

  return {
    audio,
    video: false,
  };
}

export function buildAudioRecorderOptions(mimeType?: string): MediaRecorderOptions {
  return {
    audioBitsPerSecond: CAPTURE_RECORDER_AUDIO_BITS_PER_SECOND,
    ...(mimeType ? { mimeType } : {}),
  };
}

export function getAudioTrackProfile(track: MediaStreamTrack): AudioTrackProfile {
  const settings = track.getSettings();
  return {
    label: track.label.trim() || "Microphone",
    ...(typeof settings.sampleRate === "number" ? { sampleRate: settings.sampleRate } : {}),
    ...(typeof settings.channelCount === "number" ? { channelCount: settings.channelCount } : {}),
    ...(typeof settings.echoCancellation === "boolean"
      ? { echoCancellation: settings.echoCancellation }
      : {}),
    ...(typeof settings.noiseSuppression === "boolean"
      ? { noiseSuppression: settings.noiseSuppression }
      : {}),
    ...(typeof settings.autoGainControl === "boolean"
      ? { autoGainControl: settings.autoGainControl }
      : {}),
  };
}
