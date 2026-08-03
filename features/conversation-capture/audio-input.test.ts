import { describe, expect, it } from "vitest";
import {
  buildAudioCaptureConstraints,
  buildAudioRecorderOptions,
  collectAudioInputOptions,
  getAudioTrackProfile,
  pickAudioInputOption,
} from "./audio-input";

function mediaDevice(input: {
  deviceId: string;
  kind?: MediaDeviceKind;
  label?: string;
  groupId?: string;
}) {
  return {
    deviceId: input.deviceId,
    kind: input.kind ?? "audioinput",
    label: input.label ?? "",
    groupId: input.groupId ?? "",
    toJSON: () => ({}),
  } as MediaDeviceInfo;
}

describe("browser audio input selection", () => {
  it("keeps only unique audio inputs and supplies stable fallback labels", () => {
    const options = collectAudioInputOptions(
      [
        mediaDevice({ deviceId: "camera-1", kind: "videoinput", label: "Camera" }),
        mediaDevice({ deviceId: "default", label: "MacBook Pro Microphone" }),
        mediaDevice({ deviceId: "usb-1", label: "Insta360 Mic Pro" }),
        mediaDevice({ deviceId: "usb-1", label: "Insta360 Mic Pro" }),
        mediaDevice({ deviceId: "hidden-1" }),
      ],
      "Microphone",
    );

    expect(options).toEqual([
      {
        deviceId: "default",
        label: "MacBook Pro Microphone",
        labelAvailable: true,
      },
      {
        deviceId: "usb-1",
        label: "Insta360 Mic Pro",
        labelAvailable: true,
      },
      {
        deviceId: "hidden-1",
        label: "Microphone 3",
        labelAvailable: false,
      },
    ]);
  });

  it("honours a pinned external microphone before the browser default", () => {
    const options = collectAudioInputOptions([
      mediaDevice({ deviceId: "default", label: "MacBook Pro Microphone" }),
      mediaDevice({ deviceId: "usb-1", label: "Insta360 Mic Pro" }),
    ]);

    expect(pickAudioInputOption(options, "usb-1")?.label).toBe("Insta360 Mic Pro");
    expect(pickAudioInputOption(options, "missing")?.deviceId).toBe("default");
  });

  it("requests the selected device with 48 kHz and stereo as ideal constraints", () => {
    expect(buildAudioCaptureConstraints("usb-1")).toEqual({
      audio: {
        deviceId: { exact: "usb-1" },
        sampleRate: { ideal: 48_000 },
        channelCount: { ideal: 2 },
      },
      video: false,
    });
  });

  it("uses a speech-oriented recorder bitrate that fits the capture upload budget", () => {
    expect(buildAudioRecorderOptions("audio/webm;codecs=opus")).toEqual({
      audioBitsPerSecond: 48_000,
      mimeType: "audio/webm;codecs=opus",
    });
    expect(buildAudioRecorderOptions()).toEqual({
      audioBitsPerSecond: 48_000,
    });
  });

  it("reports the actual browser track settings without exposing a device id", () => {
    const profile = getAudioTrackProfile({
      label: "Insta360 Mic Pro",
      getSettings: () => ({
        deviceId: "browser-private-device-id",
        groupId: "browser-private-group-id",
        sampleRate: 48_000,
        channelCount: 2,
        echoCancellation: false,
        noiseSuppression: true,
        autoGainControl: false,
      }),
    } as MediaStreamTrack);

    expect(profile).toEqual({
      label: "Insta360 Mic Pro",
      sampleRate: 48_000,
      channelCount: 2,
      echoCancellation: false,
      noiseSuppression: true,
      autoGainControl: false,
    });
    expect(profile).not.toHaveProperty("deviceId");
    expect(profile).not.toHaveProperty("groupId");
  });
});
