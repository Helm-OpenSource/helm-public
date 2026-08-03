"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  parseAvfoundationAudioDevices,
  parseVolumeDetection,
} = require("../lib/macos-audio-devices.cjs");

test("parses AVFoundation audio devices including Insta360 Mic Pro", () => {
  const devices = parseAvfoundationAudioDevices(`
[AVFoundation indev @ 0x1] AVFoundation video devices:
[AVFoundation indev @ 0x1] [0] FaceTime HD Camera
[AVFoundation indev @ 0x1] AVFoundation audio devices:
[AVFoundation indev @ 0x1] [0] MacBook Pro Microphone
[AVFoundation indev @ 0x1] [2] Insta360 Mic Pro
`);
  assert.deepEqual(devices, [
    { id: "avfoundation:0", index: 0, name: "MacBook Pro Microphone", source: "AVFOUNDATION" },
    { id: "avfoundation:2", index: 2, name: "Insta360 Mic Pro", source: "AVFOUNDATION" },
  ]);
});

test("parses local microphone level without retaining audio", () => {
  assert.deepEqual(
    parseVolumeDetection("mean_volume: -31.2 dB\nmax_volume: -9.4 dB"),
    { detected: true, meanDb: -31.2, maxDb: -9.4 },
  );
});
