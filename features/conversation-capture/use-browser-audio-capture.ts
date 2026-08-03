"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  buildAudioCaptureConstraints,
  buildAudioRecorderOptions,
  collectAudioInputOptions,
  getAudioTrackProfile,
  pickAudioInputOption,
  type AudioInputOption,
  type AudioTrackProfile,
} from "./audio-input";

const AUDIO_INPUT_STORAGE_KEY = "helm.capture.audio-input-device";
const AUDIO_LEVEL_UPDATE_INTERVAL_MS = 100;

export type AudioInputStatus =
  | "unchecked"
  | "checking"
  | "ready"
  | "active"
  | "permission_denied"
  | "unavailable"
  | "disconnected";

export type AudioCaptureStartResult =
  | { started: true; profile: AudioTrackProfile }
  | {
      started: false;
      reason: "unsupported" | "permission_denied" | "unavailable" | "device_error";
    };

function preferredRecorderMimeType() {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  return candidates.find((mimeType) => MediaRecorder.isTypeSupported?.(mimeType));
}

function storedAudioInputDeviceId() {
  try {
    return window.localStorage.getItem(AUDIO_INPUT_STORAGE_KEY);
  } catch {
    return null;
  }
}

function persistAudioInputDeviceId(deviceId: string | null) {
  try {
    if (deviceId) {
      window.localStorage.setItem(AUDIO_INPUT_STORAGE_KEY, deviceId);
    } else {
      window.localStorage.removeItem(AUDIO_INPUT_STORAGE_KEY);
    }
  } catch {
    // Storage may be disabled. Device selection still works for this panel session.
  }
}

function isPermissionDenied(error: unknown) {
  return (
    error instanceof DOMException &&
    (error.name === "NotAllowedError" || error.name === "SecurityError")
  );
}

export function useBrowserAudioCapture(input: {
  enabled: boolean;
  fallbackLabelPrefix: string;
}) {
  const [audioInputs, setAudioInputs] = useState<AudioInputOption[]>([]);
  const [selectedAudioInputId, setSelectedAudioInputIdState] = useState("");
  const [status, setStatus] = useState<AudioInputStatus>("unchecked");
  const [activeProfile, setActiveProfile] = useState<AudioTrackProfile | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);

  const selectedAudioInputIdRef = useRef("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioLevelFrameRef = useRef<number | null>(null);

  const setSelectedAudioInputId = useCallback((deviceId: string) => {
    selectedAudioInputIdRef.current = deviceId;
    setSelectedAudioInputIdState(deviceId);
    persistAudioInputDeviceId(deviceId || null);
  }, []);

  const stopAudioLevelMeter = useCallback(() => {
    if (audioLevelFrameRef.current !== null) {
      window.cancelAnimationFrame(audioLevelFrameRef.current);
      audioLevelFrameRef.current = null;
    }
    if (audioContextRef.current) {
      void audioContextRef.current.close().catch(() => undefined);
      audioContextRef.current = null;
    }
    setAudioLevel(0);
  }, []);

  const releaseMediaResources = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      recorder.onerror = null;
      try {
        recorder.stop();
      } catch {
        // The device may already have forced the recorder into a terminal state.
      }
    }
    mediaRecorderRef.current = null;
    mediaChunksRef.current = [];

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    stopAudioLevelMeter();
    setActiveProfile(null);
  }, [stopAudioLevelMeter]);

  const refreshAudioInputs = useCallback(
    async (options: { requestPermission?: boolean } = {}) => {
      if (
        typeof window === "undefined" ||
        !navigator.mediaDevices?.enumerateDevices ||
        !navigator.mediaDevices?.getUserMedia
      ) {
        setAudioInputs([]);
        setStatus("unavailable");
        return {
          options: [] as AudioInputOption[],
          selected: null,
          status: "unavailable" as const,
        };
      }

      setStatus("checking");
      let permissionStream: MediaStream | null = null;
      try {
        if (options.requestPermission) {
          permissionStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: false,
          });
        }

        const devices = await navigator.mediaDevices.enumerateDevices();
        const nextOptions = collectAudioInputOptions(devices, input.fallbackLabelPrefix);
        const requestedId =
          selectedAudioInputIdRef.current || storedAudioInputDeviceId();
        const selected = pickAudioInputOption(nextOptions, requestedId);

        setAudioInputs(nextOptions);
        selectedAudioInputIdRef.current = selected?.deviceId ?? "";
        setSelectedAudioInputIdState(selected?.deviceId ?? "");
        setStatus(nextOptions.length ? "ready" : "unavailable");
        return {
          options: nextOptions,
          selected,
          status: nextOptions.length ? ("ready" as const) : ("unavailable" as const),
        };
      } catch (error) {
        const failureStatus = isPermissionDenied(error)
          ? ("permission_denied" as const)
          : ("unavailable" as const);
        setStatus(failureStatus);
        return {
          options: [] as AudioInputOption[],
          selected: null,
          status: failureStatus,
        };
      } finally {
        permissionStream?.getTracks().forEach((track) => track.stop());
      }
    },
    [input.fallbackLabelPrefix],
  );

  const startAudioLevelMeter = useCallback(
    async (stream: MediaStream) => {
      if (typeof window === "undefined" || typeof window.AudioContext === "undefined") {
        return;
      }

      stopAudioLevelMeter();
      const context = new window.AudioContext();
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.72;
      context.createMediaStreamSource(stream).connect(analyser);
      audioContextRef.current = context;
      await context.resume().catch(() => undefined);

      const samples = new Float32Array(analyser.fftSize);
      let lastUpdateAt = 0;
      const update = (time: number) => {
        if (time - lastUpdateAt >= AUDIO_LEVEL_UPDATE_INTERVAL_MS) {
          analyser.getFloatTimeDomainData(samples);
          let sumSquares = 0;
          for (const sample of samples) sumSquares += sample * sample;
          const rms = Math.sqrt(sumSquares / samples.length);
          setAudioLevel(Math.min(100, Math.round(rms * 420)));
          lastUpdateAt = time;
        }
        audioLevelFrameRef.current = window.requestAnimationFrame(update);
      };
      audioLevelFrameRef.current = window.requestAnimationFrame(update);
    },
    [stopAudioLevelMeter],
  );

  const startRecording = useCallback(async (): Promise<AudioCaptureStartResult> => {
    if (
      typeof window === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setStatus("unavailable");
      return { started: false, reason: "unsupported" };
    }

    const prepared = await refreshAudioInputs({ requestPermission: true });
    if (!prepared.selected) {
      return {
        started: false,
        reason:
          prepared.status === "permission_denied" ? "permission_denied" : "unavailable",
      };
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia(
        buildAudioCaptureConstraints(prepared.selected.deviceId),
      );
    } catch (error) {
      if (isPermissionDenied(error)) {
        setStatus("permission_denied");
        return { started: false, reason: "permission_denied" };
      }
      setStatus("disconnected");
      return { started: false, reason: "device_error" };
    }

    const track = stream.getAudioTracks()[0];
    if (!track) {
      stream.getTracks().forEach((item) => item.stop());
      setStatus("unavailable");
      return { started: false, reason: "unavailable" };
    }

    const profile = getAudioTrackProfile(track);
    const actualDeviceId = track.getSettings().deviceId;
    if (actualDeviceId) setSelectedAudioInputId(actualDeviceId);
    track.addEventListener(
      "ended",
      () => {
        setStatus("disconnected");
        setAudioLevel(0);
      },
      { once: true },
    );

    let recorder: MediaRecorder;
    try {
      const selectedMimeType = preferredRecorderMimeType();
      recorder = new MediaRecorder(
        stream,
        buildAudioRecorderOptions(selectedMimeType),
      );
      mediaChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data?.size) mediaChunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        setStatus("disconnected");
        setAudioLevel(0);
      };
      recorder.start(1_000);
    } catch {
      stream.getTracks().forEach((item) => item.stop());
      setStatus("disconnected");
      return { started: false, reason: "device_error" };
    }
    mediaRecorderRef.current = recorder;
    mediaStreamRef.current = stream;
    setActiveProfile(profile);
    setStatus("active");
    void startAudioLevelMeter(stream).catch(() => undefined);
    return { started: true, profile };
  }, [refreshAudioInputs, setSelectedAudioInputId, startAudioLevelMeter]);

  const stopRecording = useCallback(async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      releaseMediaResources();
      setStatus(audioInputs.length ? "ready" : "unavailable");
      return null;
    }

    return new Promise<File | null>((resolve) => {
      const mimeType = recorder.mimeType || mediaChunksRef.current[0]?.type || "audio/webm";
      recorder.onstop = () => {
        const blob = new Blob(mediaChunksRef.current, { type: mimeType });
        releaseMediaResources();
        setStatus(audioInputs.length ? "ready" : "unavailable");
        if (!blob.size) {
          resolve(null);
          return;
        }

        const extension = mimeType.includes("mp4") ? "m4a" : "webm";
        resolve(
          new File([blob], `capture-${Date.now()}.${extension}`, {
            type: mimeType,
          }),
        );
      };
      try {
        recorder.stop();
      } catch {
        releaseMediaResources();
        setStatus(audioInputs.length ? "ready" : "unavailable");
        resolve(null);
      }
    });
  }, [audioInputs.length, releaseMediaResources]);

  useEffect(() => {
    if (!input.enabled || !navigator.mediaDevices) return;
    void refreshAudioInputs();

    const handleDeviceChange = () => {
      void refreshAudioInputs();
    };
    navigator.mediaDevices.addEventListener?.("devicechange", handleDeviceChange);
    return () => {
      navigator.mediaDevices.removeEventListener?.("devicechange", handleDeviceChange);
    };
  }, [input.enabled, refreshAudioInputs]);

  useEffect(() => () => releaseMediaResources(), [releaseMediaResources]);

  return {
    audioInputs,
    selectedAudioInputId,
    status,
    activeProfile,
    audioLevel,
    setSelectedAudioInputId,
    refreshAudioInputs,
    startRecording,
    stopRecording,
    releaseMediaResources,
  };
}
