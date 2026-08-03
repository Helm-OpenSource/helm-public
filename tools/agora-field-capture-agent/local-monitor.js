"use strict";

(function exposeLocalMonitor(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FieldCaptureLocalMonitor = api;
})(typeof globalThis === "undefined" ? null : globalThis, () => {
  function disconnect(node) {
    try {
      node?.disconnect();
    } catch {}
  }

  async function createLocalMonitor({
    mediaDevices,
    audioContextFactory,
    deviceId,
    onLevel = () => {},
    gainValue = 3,
    setIntervalFn = setInterval,
    clearIntervalFn = clearInterval,
  }) {
    if (!mediaDevices?.getUserMedia) throw new Error("浏览器麦克风接口不可用");
    if (typeof audioContextFactory !== "function") throw new Error("系统音频输出不可用");
    if (!String(deviceId || "").trim()) throw new Error("请选择麦克风");

    let stream = null;
    let context = null;
    let source = null;
    let gain = null;
    let analyser = null;
    let meterInterval = null;
    let stopped = false;

    async function stop() {
      if (stopped) return;
      stopped = true;
      if (meterInterval !== null) clearIntervalFn(meterInterval);
      meterInterval = null;
      for (const track of stream?.getTracks?.() || []) track.stop();
      disconnect(source);
      disconnect(gain);
      disconnect(analyser);
      if (context && context.state !== "closed") await context.close();
      onLevel(0);
    }

    try {
      stream = await mediaDevices.getUserMedia({
        audio: {
          deviceId: { exact: String(deviceId) },
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          latency: { ideal: 0 },
          sampleRate: { ideal: 48_000 },
        },
        video: false,
      });
      context = audioContextFactory();
      source = context.createMediaStreamSource(stream);
      gain = context.createGain();
      analyser = context.createAnalyser();

      gain.gain.value = gainValue;
      analyser.fftSize = 512;

      source.connect(analyser);
      analyser.connect(gain);
      gain.connect(context.destination);
      await context.resume();

      const samples = new Float32Array(analyser.fftSize);
      meterInterval = setIntervalFn(() => {
        analyser.getFloatTimeDomainData(samples);
        let sum = 0;
        for (const sample of samples) sum += sample * sample;
        onLevel(Math.min(1, Math.sqrt(sum / samples.length) * 4));
      }, 100);

      return { deviceId: String(deviceId), stop };
    } catch (error) {
      await stop();
      throw error;
    }
  }

  return { createLocalMonitor };
});
