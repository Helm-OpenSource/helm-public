"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createLocalMonitor } = require("../local-monitor.js");

function fakeNode() {
  return {
    connectedTo: null,
    disconnected: false,
    connect(target) {
      this.connectedTo = target;
      return target;
    },
    disconnect() {
      this.disconnected = true;
    },
  };
}

test("routes the selected microphone to the default output and releases every resource", async () => {
  const track = { stopped: false, stop() { this.stopped = true; } };
  const stream = { getTracks: () => [track] };
  const source = fakeNode();
  const gain = { ...fakeNode(), gain: { value: 1 } };
  const analyser = {
    ...fakeNode(),
    fftSize: 0,
    getFloatTimeDomainData(samples) {
      samples.fill(0.25);
    },
  };
  const destination = {};
  const context = {
    state: "running",
    destination,
    resumed: false,
    closed: false,
    createMediaStreamSource: (value) => {
      assert.equal(value, stream);
      return source;
    },
    createGain: () => gain,
    createAnalyser: () => analyser,
    async resume() { this.resumed = true; },
    async close() { this.closed = true; },
  };
  let constraints = null;
  let clearedTimer = null;
  const levels = [];

  const monitor = await createLocalMonitor({
    mediaDevices: {
      async getUserMedia(value) {
        constraints = value;
        return stream;
      },
    },
    audioContextFactory: () => context,
    deviceId: "insta360-device",
    onLevel: (value) => levels.push(value),
    setIntervalFn: (callback) => {
      callback();
      return 17;
    },
    clearIntervalFn: (timer) => { clearedTimer = timer; },
  });

  assert.deepEqual(constraints.audio.deviceId, { exact: "insta360-device" });
  assert.equal(constraints.audio.echoCancellation, false);
  assert.equal(constraints.audio.noiseSuppression, false);
  assert.equal(constraints.audio.autoGainControl, false);
  assert.deepEqual(constraints.audio.latency, { ideal: 0 });
  assert.deepEqual(constraints.audio.sampleRate, { ideal: 48_000 });
  assert.equal(constraints.video, false);
  assert.equal(context.resumed, true);
  assert.equal(source.connectedTo, analyser);
  assert.equal(analyser.connectedTo, gain);
  assert.equal(gain.connectedTo, destination);
  assert.ok(levels.some((value) => value > 0));

  await monitor.stop();
  await monitor.stop();

  assert.equal(clearedTimer, 17);
  assert.equal(track.stopped, true);
  assert.equal(source.disconnected, true);
  assert.equal(gain.disconnected, true);
  assert.equal(analyser.disconnected, true);
  assert.equal(context.closed, true);
  assert.equal(levels.at(-1), 0);
});
