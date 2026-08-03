"use strict";

const {
  listMacAudioDevices,
  testMacAudioDevice,
} = require("./lib/macos-audio-devices.cjs");

async function main() {
  const devices = await listMacAudioDevices();
  for (const device of devices) {
    process.stdout.write(`[${device.index}] ${device.name}\n`);
  }
  const micPro = devices.find((device) => /insta360\s+mic\s+pro/i.test(device.name));
  if (!micPro) throw new Error("Insta360 Mic Pro was not detected");
  process.stdout.write(`Detected: ${micPro.name} (AVFoundation ${micPro.index})\n`);

  if (process.argv.includes("--test")) {
    process.stdout.write("Running a 3-second local level test; audio is not saved.\n");
    const level = await testMacAudioDevice(micPro.index);
    process.stdout.write(`Level: mean=${level.meanDb} dB, max=${level.maxDb} dB\n`);
  }
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
