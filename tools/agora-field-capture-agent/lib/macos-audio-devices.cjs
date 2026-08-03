"use strict";

const { execFile } = require("node:child_process");

function parseAvfoundationAudioDevices(output) {
  const lines = String(output || "").split(/\r?\n/);
  const markerIndex = lines.findIndex((line) => line.includes("AVFoundation audio devices:"));
  if (markerIndex < 0) return [];

  const devices = [];
  for (const line of lines.slice(markerIndex + 1)) {
    if (line.includes("AVFoundation video devices:")) break;
    const match = line.match(/\[(\d+)\]\s+(.+)$/);
    if (match) {
      devices.push({
        id: `avfoundation:${match[1]}`,
        index: Number(match[1]),
        name: match[2].trim(),
        source: "AVFOUNDATION",
      });
    }
  }
  return devices;
}

function listMacAudioDevices(execFileImpl = execFile) {
  if (process.platform !== "darwin") return Promise.resolve([]);
  return new Promise((resolve, reject) => {
    execFileImpl(
      "ffmpeg",
      ["-hide_banner", "-f", "avfoundation", "-list_devices", "true", "-i", ""],
      { timeout: 10_000, maxBuffer: 1_000_000 },
      (error, stdout, stderr) => {
        const devices = parseAvfoundationAudioDevices(`${stdout || ""}\n${stderr || ""}`);
        if (devices.length) return resolve(devices);
        if (error?.code === "ENOENT") {
          return reject(new Error("ffmpeg is required for local device diagnostics"));
        }
        reject(new Error("No macOS audio input devices were found"));
      },
    );
  });
}

function parseVolumeDetection(output) {
  const mean = /mean_volume:\s*(-?[\d.]+)\s*dB/i.exec(output)?.[1];
  const max = /max_volume:\s*(-?[\d.]+)\s*dB/i.exec(output)?.[1];
  return {
    detected: mean !== undefined || max !== undefined,
    meanDb: mean === undefined ? null : Number(mean),
    maxDb: max === undefined ? null : Number(max),
  };
}

function testMacAudioDevice(index, execFileImpl = execFile) {
  if (!Number.isInteger(index) || index < 0) {
    return Promise.reject(new Error("A valid AVFoundation audio device index is required"));
  }
  return new Promise((resolve, reject) => {
    execFileImpl(
      "ffmpeg",
      [
        "-hide_banner",
        "-f",
        "avfoundation",
        "-t",
        "3",
        "-i",
        `:${index}`,
        "-af",
        "volumedetect",
        "-f",
        "null",
        "-",
      ],
      { timeout: 12_000, maxBuffer: 1_000_000 },
      (error, stdout, stderr) => {
        const result = parseVolumeDetection(`${stdout || ""}\n${stderr || ""}`);
        if (result.detected) return resolve(result);
        reject(new Error(error?.code === "ENOENT" ? "ffmpeg is not installed" : "No microphone level was detected"));
      },
    );
  });
}

module.exports = {
  listMacAudioDevices,
  parseAvfoundationAudioDevices,
  parseVolumeDetection,
  testMacAudioDevice,
};
