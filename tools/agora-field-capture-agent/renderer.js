"use strict";

const elements = {
  modeBadge: document.querySelector("#modeBadge"),
  statusDot: document.querySelector("#statusDot"),
  statusText: document.querySelector("#statusText"),
  helmOrigin: document.querySelector("#helmOrigin"),
  deliveryStatus: document.querySelector("#deliveryStatus"),
  sessionTitle: document.querySelector("#sessionTitle"),
  language: document.querySelector("#language"),
  microphone: document.querySelector("#microphone"),
  refreshDevices: document.querySelector("#refreshDevices"),
  testDevice: document.querySelector("#testDevice"),
  toggleMonitor: document.querySelector("#toggleMonitor"),
  meterFill: document.querySelector("#meterFill"),
  meterValue: document.querySelector("#meterValue"),
  employeeConsent: document.querySelector("#employeeConsent"),
  counterpartyNotice: document.querySelector("#counterpartyNotice"),
  recordingMark: document.querySelector("#recordingMark"),
  liveLabel: document.querySelector("#liveLabel"),
  timer: document.querySelector("#timer"),
  transcriptPreview: document.querySelector("#transcriptPreview"),
  startCapture: document.querySelector("#startCapture"),
  stopCapture: document.querySelector("#stopCapture"),
  errorStrip: document.querySelector("#errorStrip"),
};

const state = {
  config: null,
  bootstrap: null,
  devices: new Map(),
  client: null,
  microphoneTrack: null,
  control: null,
  phase: "INITIALIZING",
  meterTimer: null,
  timerInterval: null,
  startedAt: null,
  testing: false,
  monitor: null,
  monitorTransition: false,
  stopping: false,
};

const AgoraRTC = window.AgoraRTC;
const LocalMonitor = window.FieldCaptureLocalMonitor;
if (AgoraRTC?.setLogLevel) AgoraRTC.setLogLevel(2);

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorMessage(error) {
  return String(error?.message || error || "操作失败").slice(0, 300);
}

function showError(error) {
  elements.errorStrip.hidden = false;
  elements.errorStrip.textContent = errorMessage(error);
}

function clearError() {
  elements.errorStrip.hidden = true;
  elements.errorStrip.textContent = "";
}

function setStatus(phase, text) {
  state.phase = phase;
  elements.statusText.textContent = text;
  elements.statusDot.className = "status-dot";
  if (phase === "RUNNING") elements.statusDot.classList.add("running");
  else if (["READY", "STOPPED"].includes(phase)) elements.statusDot.classList.add("ready");
  else if (["DEGRADED", "FAILED"].includes(phase)) elements.statusDot.classList.add("degraded");
  updateControls();
}

function setMeter(level) {
  const value = Math.max(0, Math.min(1, Number(level) || 0));
  const percentage = Math.round(value * 100);
  elements.meterFill.style.width = `${percentage}%`;
  elements.meterValue.textContent = `${percentage}%`;
}

function formatDuration(milliseconds) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function startTimer() {
  state.startedAt = Date.now();
  clearInterval(state.timerInterval);
  state.timerInterval = setInterval(() => {
    elements.timer.textContent = formatDuration(Date.now() - state.startedAt);
  }, 1000);
}

function stopTimers() {
  clearInterval(state.timerInterval);
  clearInterval(state.meterTimer);
  state.timerInterval = null;
  state.meterTimer = null;
  setMeter(0);
}

function selectedDevice() {
  return state.devices.get(elements.microphone.value) || null;
}

function isLiveReady() {
  return (
    state.bootstrap?.mode === "REAL" &&
    selectedDevice()?.source === "AGORA" &&
    elements.sessionTitle.value.trim().length > 0 &&
    elements.employeeConsent.checked &&
    elements.counterpartyNotice.checked
  );
}

function updateControls() {
  const active = Boolean(state.control);
  const monitoring = Boolean(state.monitor);
  const busy =
    ["STARTING", "STOPPING"].includes(state.phase) || state.testing || state.monitorTransition;
  elements.startCapture.disabled = active || monitoring || busy || !isLiveReady();
  elements.stopCapture.disabled = !active || state.stopping;
  elements.testDevice.disabled = active || monitoring || busy || !selectedDevice();
  elements.toggleMonitor.disabled =
    active || busy || (!monitoring && selectedDevice()?.source !== "AGORA");
  elements.toggleMonitor.textContent = monitoring ? "停止本地监听" : "开启本地监听";
  elements.toggleMonitor.setAttribute("aria-pressed", String(monitoring));
  elements.toggleMonitor.classList.toggle("monitoring", monitoring);
  elements.refreshDevices.disabled = active || monitoring || busy;
  elements.microphone.disabled = active || monitoring || busy;
  elements.sessionTitle.disabled = active || busy;
  elements.language.disabled = active || busy;
  elements.employeeConsent.disabled = active || busy;
  elements.counterpartyNotice.disabled = active || busy;
}

async function stopLocalMonitor({ restoreStatus = true } = {}) {
  const monitor = state.monitor;
  state.monitor = null;
  if (monitor) await monitor.stop();
  setMeter(0);
  if (restoreStatus) {
    setStatus(
      state.bootstrap?.mode === "REAL" ? "READY" : "DEGRADED",
      state.bootstrap?.mode === "REAL" ? "设备就绪" : "本地诊断模式",
    );
  }
  updateControls();
}

async function toggleLocalMonitor() {
  if (state.monitorTransition || state.control) return;
  if (state.monitor) {
    state.monitorTransition = true;
    updateControls();
    try {
      await stopLocalMonitor();
    } finally {
      state.monitorTransition = false;
      updateControls();
    }
    return;
  }

  const device = selectedDevice();
  if (!device || device.source !== "AGORA") return;
  clearError();
  state.monitorTransition = true;
  setStatus("INITIALIZING", "正在启动本地监听");

  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    state.monitor = await LocalMonitor.createLocalMonitor({
      mediaDevices: navigator.mediaDevices,
      audioContextFactory: () =>
        new AudioContextClass({ latencyHint: 0.01, sampleRate: 48_000 }),
      deviceId: device.id,
      onLevel: setMeter,
    });
    setStatus(
      state.bootstrap?.mode === "REAL" ? "READY" : "DEGRADED",
      "低延迟本地监听中",
    );
  } catch (error) {
    showError(error);
    setStatus("FAILED", "本地监听启动失败");
  } finally {
    state.monitorTransition = false;
    updateControls();
  }
}

async function loadDevices() {
  clearError();
  const previous = elements.microphone.value;
  elements.microphone.replaceChildren();
  state.devices.clear();
  setStatus("INITIALIZING", "正在读取麦克风");

  let devices = [];
  try {
    const microphones = await AgoraRTC.getMicrophones(false);
    devices = microphones.map((device, index) => ({
      id: device.deviceId,
      name: device.label || `麦克风 ${index + 1}`,
      source: "AGORA",
    }));
  } catch (error) {
    try {
      devices = await window.fieldCapture.listLocalDevices();
      showError(`${errorMessage(error)}；当前仅可做本地设备诊断`);
    } catch (fallbackError) {
      showError(fallbackError);
    }
  }

  for (const device of devices) {
    state.devices.set(device.id, device);
    const option = document.createElement("option");
    option.value = device.id;
    option.textContent = device.name;
    elements.microphone.append(option);
  }
  const preferred =
    devices.find((device) => /insta360\s+mic\s+pro/i.test(device.name)) ||
    devices.find((device) => device.id === previous) ||
    devices[0];
  if (preferred) elements.microphone.value = preferred.id;

  setStatus(
    state.bootstrap?.mode === "REAL" ? "READY" : "DEGRADED",
    devices.length
      ? state.bootstrap?.mode === "REAL"
        ? "设备就绪"
        : "本地诊断模式"
      : "未发现麦克风",
  );
}

async function testSelectedDevice() {
  const device = selectedDevice();
  if (!device || state.testing || state.control) return;
  clearError();
  state.testing = true;
  updateControls();
  setStatus("INITIALIZING", "麦克风测试中");

  try {
    if (device.source === "AGORA") {
      const track = await AgoraRTC.createMicrophoneAudioTrack({
        microphoneId: device.id,
        encoderConfig: "speech_standard",
        AEC: true,
        AGC: true,
        ANS: true,
      });
      const interval = setInterval(() => setMeter(track.getVolumeLevel()), 100);
      await wait(3000);
      clearInterval(interval);
      track.close();
    } else {
      const result = await window.fieldCapture.testLocalDevice(device.index);
      setMeter(result.maxDb === null ? 0 : Math.min(1, Math.pow(10, result.maxDb / 20)));
      await wait(700);
    }
    setStatus(state.bootstrap?.mode === "REAL" ? "READY" : "DEGRADED", "麦克风测试通过");
  } catch (error) {
    showError(error);
    setStatus("FAILED", "麦克风测试失败");
  } finally {
    state.testing = false;
    setMeter(0);
    updateControls();
  }
}

function attachRtcEvents(client) {
  client.on("stream-message", (uid, payload) => {
    void window.fieldCapture
      .acceptStreamMessage(uid, payload)
      .then((result) => {
        if (result?.accepted && result.preview) {
          elements.transcriptPreview.textContent = result.preview;
        }
      })
      .catch((error) => {
        showError(error);
        setStatus("DEGRADED", "转写回传异常");
      });
  });
  client.on("connection-state-change", (current, previous, reason) => {
    if (!state.control || state.stopping) return;
    if (current === "CONNECTED") setStatus("RUNNING", "声网实时转写中");
    if (current === "RECONNECTING") setStatus("DEGRADED", "网络重连中");
    if (current === "DISCONNECTED" && previous !== "DISCONNECTING") {
      showError(reason || "声网连接已断开");
      setStatus("DEGRADED", "声网连接中断");
    }
  });
  client.on("network-quality", (quality) => {
    if (state.control && quality.uplinkNetworkQuality >= 5) {
      setStatus("DEGRADED", "上行网络质量过低");
    }
  });
  client.on("token-privilege-will-expire", () => {
    showError("RTC token 即将到期，本次记录将自动停止");
    void stopCapture();
  });
}

async function cleanupRtc() {
  stopTimers();
  const track = state.microphoneTrack;
  const client = state.client;
  state.microphoneTrack = null;
  state.client = null;

  if (track) {
    try {
      if (client) await client.unpublish(track);
    } catch {}
    track.close();
  }
  if (client) {
    try {
      await client.leave();
    } catch {}
  }
}

async function startCapture() {
  if (!isLiveReady() || state.control) return;
  clearError();
  setStatus("STARTING", "正在创建现场会话");
  const device = selectedDevice();
  let control = null;

  try {
    const track = await AgoraRTC.createMicrophoneAudioTrack({
      microphoneId: device.id,
      encoderConfig: "speech_standard",
      AEC: true,
      AGC: true,
      ANS: true,
    });
    state.microphoneTrack = track;

    control = await window.fieldCapture.startControl({
      title: elements.sessionTitle.value.trim(),
      language: elements.language.value,
      consent: {
        confirmed: true,
        counterpartyNotified: true,
        noticeTextVersion: "field-capture-consent/v1",
      },
    });
    state.control = control;

    const client = AgoraRTC.createClient({ mode: "live", codec: "vp8" });
    state.client = client;
    attachRtcEvents(client);
    await client.setClientRole("host");
    await client.join(
      control.rtc.appId,
      control.rtc.channelName,
      control.rtc.publisherToken,
      Number(control.rtc.publisherUid),
    );
    await client.publish(track);

    state.meterTimer = setInterval(() => setMeter(track.getVolumeLevel()), 100);
    startTimer();
    elements.recordingMark.classList.add("running");
    elements.liveLabel.textContent = "正在记录";
    elements.transcriptPreview.textContent = "等待最终转写";
    setStatus("RUNNING", "声网实时转写中");
  } catch (error) {
    await cleanupRtc();
    if (control?.providerSessionId) {
      await window.fieldCapture.abortControl(control.providerSessionId).catch(() => null);
    }
    state.control = null;
    showError(error);
    setStatus("FAILED", "现场会话启动失败");
  }
}

async function stopCapture() {
  if (!state.control || state.stopping) return;
  state.stopping = true;
  setStatus("STOPPING", "正在停止并分析");
  clearError();
  const providerSessionId = state.control.providerSessionId;

  try {
    if (state.microphoneTrack) {
      await state.microphoneTrack.setEnabled(false).catch(() => null);
      await wait(900);
    }
    const stopped = await window.fieldCapture.stopControl(providerSessionId);
    await cleanupRtc();
    state.control = null;
    elements.recordingMark.classList.remove("running");
    if (stopped?.terminalFailure) {
      elements.liveLabel.textContent = "无可用转写";
      showError(stopped.message || "未收到声网最终转写，未执行 Helm 分析");
      setStatus("FAILED", "本次记录未生成分析");
    } else if (stopped?.deliveryFailure) {
      elements.liveLabel.textContent = "已停止·需复核";
      showError(
        stopped.deliveryFailureMessage ||
          "部分最终转写未能回传；声网采集已停止，请在 Helm 中复核分析完整性",
      );
      setStatus("DEGRADED", "已停止，最终转写可能不完整");
    } else {
      elements.liveLabel.textContent = "已完成";
      setStatus("STOPPED", "已保存并进入 Helm 分析");
    }
  } catch (error) {
    showError(error);
    setStatus("DEGRADED", "停止或分析未完成，可重试");
  } finally {
    state.stopping = false;
    updateControls();
  }
}

async function initialize() {
  if (!AgoraRTC || !LocalMonitor || !window.fieldCapture) {
    showError("现场采集运行时未加载");
    setStatus("FAILED", "运行时不可用");
    return;
  }

  state.config = await window.fieldCapture.getConfig();
  elements.helmOrigin.textContent = state.config.helmOrigin || "Helm 未配置";
  if (state.config.configurationError) showError(state.config.configurationError);

  if (state.config.configured) {
    try {
      state.bootstrap = await window.fieldCapture.bootstrap();
      const live = state.bootstrap.mode === "REAL";
      elements.modeBadge.textContent = live ? "LIVE ASR" : "MOCK";
      elements.modeBadge.classList.add(live ? "live" : "mock");
    } catch (error) {
      showError(error);
    }
  } else {
    elements.modeBadge.textContent = "本地诊断";
    elements.modeBadge.classList.add("mock");
  }

  await loadDevices();
  if (!elements.sessionTitle.value) {
    const now = new Date();
    elements.sessionTitle.value = `销售现场 ${now.toLocaleDateString("zh-CN")} ${now.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`;
  }
  updateControls();
}

elements.refreshDevices.addEventListener("click", () => void loadDevices());
elements.testDevice.addEventListener("click", () => void testSelectedDevice());
elements.toggleMonitor.addEventListener("click", () => void toggleLocalMonitor());
elements.startCapture.addEventListener("click", () => void startCapture());
elements.stopCapture.addEventListener("click", () => void stopCapture());
for (const element of [
  elements.sessionTitle,
  elements.language,
  elements.microphone,
  elements.employeeConsent,
  elements.counterpartyNotice,
]) {
  element.addEventListener("input", updateControls);
  element.addEventListener("change", updateControls);
}

window.fieldCapture.onDeliveryState((delivery) => {
  elements.deliveryStatus.textContent = `待发送 ${delivery.pending || 0}`;
  if (delivery.state === "DEGRADED") {
    showError(delivery.error || "最终转写回传失败");
    setStatus("DEGRADED", "最终转写回传异常");
  }
});

AgoraRTC.on("microphone-changed", (info) => {
  const selected = selectedDevice();
  if (info.state === "INACTIVE" && selected?.id === info.device.deviceId) {
    if (state.microphoneTrack) void state.microphoneTrack.setEnabled(false).catch(() => null);
    if (state.monitor?.deviceId === info.device.deviceId) {
      void stopLocalMonitor({ restoreStatus: false }).catch(() => null);
    }
    showError("当前麦克风已断开，音频发布已暂停");
    setStatus("DEGRADED", "麦克风已断开");
  }
  if (!state.control && !state.monitor) void loadDevices();
});

window.addEventListener("beforeunload", () => {
  void stopLocalMonitor({ restoreStatus: false }).catch(() => null);
});

void initialize().catch((error) => {
  showError(error);
  setStatus("FAILED", "初始化失败");
});
