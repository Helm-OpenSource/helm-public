/** @vitest-environment jsdom */

import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useBrowserAudioCapture } from "./use-browser-audio-capture";

const originalMediaDevices = navigator.mediaDevices;
const originalMediaRecorder = globalThis.MediaRecorder;

function audioTrack(label: string) {
  return {
    label,
    getSettings: () => ({
      deviceId: "insta360-device-id",
      sampleRate: 48_000,
      channelCount: 2,
    }),
    addEventListener: vi.fn(),
    stop: vi.fn(),
  } as unknown as MediaStreamTrack;
}

function mediaStream(track: MediaStreamTrack) {
  return {
    getAudioTracks: () => [track],
    getTracks: () => [track],
  } as unknown as MediaStream;
}

function installMediaDevices(getUserMedia: ReturnType<typeof vi.fn>) {
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia,
      enumerateDevices: vi.fn().mockResolvedValue([
        {
          deviceId: "insta360-device-id",
          groupId: "usb-audio-group",
          kind: "audioinput",
          label: "Insta360 Mic Pro",
          toJSON: () => ({}),
        },
      ]),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
  });
}

afterEach(() => {
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: originalMediaDevices,
  });
  if (originalMediaRecorder) {
    Object.defineProperty(globalThis, "MediaRecorder", {
      configurable: true,
      value: originalMediaRecorder,
    });
  } else {
    Reflect.deleteProperty(globalThis, "MediaRecorder");
  }
  if (typeof window.localStorage.clear === "function") {
    window.localStorage.clear();
  }
  vi.restoreAllMocks();
});

describe("useBrowserAudioCapture", () => {
  it("opens the selected device with the bounded recorder policy", async () => {
    const permissionTrack = audioTrack("Permission probe");
    const recordingTrack = audioTrack("Insta360 Mic Pro");
    const getUserMedia = vi
      .fn()
      .mockResolvedValueOnce(mediaStream(permissionTrack))
      .mockResolvedValueOnce(mediaStream(recordingTrack));
    installMediaDevices(getUserMedia);

    let recorderOptions: MediaRecorderOptions | undefined;
    class FakeMediaRecorder {
      static isTypeSupported(mimeType: string) {
        return mimeType === "audio/webm;codecs=opus";
      }

      state: RecordingState = "inactive";
      mimeType = "audio/webm;codecs=opus";
      ondataavailable: ((event: BlobEvent) => void) | null = null;
      onstop: ((event: Event) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;

      constructor(_stream: MediaStream, options?: MediaRecorderOptions) {
        recorderOptions = options;
      }

      start() {
        this.state = "recording";
      }

      stop() {
        this.state = "inactive";
        this.onstop?.(new Event("stop"));
      }
    }
    Object.defineProperty(globalThis, "MediaRecorder", {
      configurable: true,
      value: FakeMediaRecorder,
    });

    const { result, unmount } = renderHook(() =>
      useBrowserAudioCapture({ enabled: false, fallbackLabelPrefix: "麦克风" }),
    );
    let startResult: Awaited<ReturnType<typeof result.current.startRecording>> | undefined;
    await act(async () => {
      startResult = await result.current.startRecording();
    });

    expect(startResult).toEqual({
      started: true,
      profile: {
        label: "Insta360 Mic Pro",
        sampleRate: 48_000,
        channelCount: 2,
      },
    });
    expect(getUserMedia).toHaveBeenNthCalledWith(2, {
      audio: {
        deviceId: { exact: "insta360-device-id" },
        sampleRate: { ideal: 48_000 },
        channelCount: { ideal: 2 },
      },
      video: false,
    });
    expect(recorderOptions).toEqual({
      audioBitsPerSecond: 48_000,
      mimeType: "audio/webm;codecs=opus",
    });
    expect(result.current.status).toBe("active");

    act(() => result.current.releaseMediaResources());
    expect(recordingTrack.stop).toHaveBeenCalled();
    unmount();
  });

  it("releases the selected device when MediaRecorder cannot start", async () => {
    const permissionTrack = audioTrack("Permission probe");
    const recordingTrack = audioTrack("Insta360 Mic Pro");
    installMediaDevices(
      vi
        .fn()
        .mockResolvedValueOnce(mediaStream(permissionTrack))
        .mockResolvedValueOnce(mediaStream(recordingTrack)),
    );

    class FailingMediaRecorder {
      static isTypeSupported() {
        return true;
      }

      constructor() {
        throw new Error("recorder unavailable");
      }
    }
    Object.defineProperty(globalThis, "MediaRecorder", {
      configurable: true,
      value: FailingMediaRecorder,
    });

    const { result, unmount } = renderHook(() =>
      useBrowserAudioCapture({ enabled: false, fallbackLabelPrefix: "麦克风" }),
    );
    let startResult: Awaited<ReturnType<typeof result.current.startRecording>> | undefined;
    await act(async () => {
      startResult = await result.current.startRecording();
    });

    expect(startResult).toEqual({ started: false, reason: "device_error" });
    expect(recordingTrack.stop).toHaveBeenCalled();
    expect(result.current.status).toBe("disconnected");
    unmount();
  });
});
