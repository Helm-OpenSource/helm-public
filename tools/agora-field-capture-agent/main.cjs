"use strict";

const path = require("node:path");
const {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  session,
  systemPreferences,
} = require("electron");
const { HelmCaptureApiClient } = require("./lib/api-client.cjs");
const { describeAgentConfig, readAgentConfig } = require("./lib/config.cjs");
const {
  assertLiveControlMaterial,
  mergeDeliveryFailure,
} = require("./lib/control-material.cjs");
const {
  listMacAudioDevices,
  testMacAudioDevice,
} = require("./lib/macos-audio-devices.cjs");
const { BoundedSegmentDelivery } = require("./lib/segment-delivery.cjs");
const { createSttDecoder } = require("./lib/stt-decoder.cjs");

app.setName("Helm Field Capture");

let mainWindow = null;
let configurationError = null;
let agentConfig;
try {
  agentConfig = readAgentConfig();
} catch (error) {
  configurationError = error.message;
  agentConfig = { baseUrl: null, token: null, configured: false };
}

const apiClient = agentConfig.configured
  ? new HelmCaptureApiClient({ baseUrl: agentConfig.baseUrl, token: agentConfig.token })
  : null;
const decoder = createSttDecoder(path.join(__dirname, "proto/SttMessage.proto"));
let activeSession = null;
let quittingAfterStop = false;

function safeErrorMessage(error) {
  return String(error?.message || error || "Unknown field-capture error")
    .replace(/helm_capture_[A-Za-z0-9_-]+/g, "[redacted capture token]")
    .slice(0, 500);
}

function publishDeliveryState(state) {
  if (!mainWindow?.isDestroyed()) {
    mainWindow.webContents.send("capture:delivery-state", state);
  }
}

function requireApiClient() {
  if (!apiClient) {
    throw new Error(configurationError || "Helm capture agent is not configured");
  }
  return apiClient;
}

function requireActiveSession(providerSessionId) {
  if (!activeSession || activeSession.providerSessionId !== providerSessionId) {
    throw new Error("No matching active field-capture session");
  }
  return activeSession;
}

function validateStartInput(input) {
  const title = String(input?.title || "").trim();
  if (!title || title.length > 120) throw new Error("Session title must be 1-120 characters");
  if (!["zh-CN", "en-US"].includes(input?.language)) throw new Error("Unsupported language");
  if (input?.consent?.confirmed !== true || input?.consent?.counterpartyNotified !== true) {
    throw new Error("Employee confirmation and counterparty notice are required");
  }
  if (input.consent.noticeTextVersion !== "field-capture-consent/v1") {
    throw new Error("Unsupported consent notice version");
  }
  return { title, language: input.language, consent: input.consent };
}

function registerIpcHandlers() {
  ipcMain.handle("capture:get-config", () => ({
    ...describeAgentConfig(agentConfig),
    configurationError,
  }));

  ipcMain.handle("capture:bootstrap", async () => requireApiClient().bootstrap());
  ipcMain.handle("capture:list-local-devices", () => listMacAudioDevices());
  ipcMain.handle("capture:test-local-device", (_event, index) =>
    testMacAudioDevice(Number(index)),
  );

  ipcMain.handle("capture:start-control", async (_event, input) => {
    if (activeSession) throw new Error("A field-capture session is already active");
    const client = requireApiClient();
    const bootstrap = await client.bootstrap();
    if (bootstrap.mode !== "REAL") {
      throw new Error("Agora STT is in MOCK mode; live field capture is disabled");
    }
    const result = await client.start(validateStartInput(input));
    try {
      assertLiveControlMaterial(result);
    } catch (validationError) {
      let compensationFailed = false;
      if (result?.providerSessionId) {
        try {
          await client.stop(result.providerSessionId);
        } catch (stopError) {
          compensationFailed = stopError?.errorCode !== "CAPTURE_AGENT_NO_FINAL_TRANSCRIPT";
        }
      }
      const suffix = compensationFailed
        ? "; compensating stop failed and the provider session requires operator review"
        : "";
      throw new Error(`${safeErrorMessage(validationError)}${suffix}`);
    }

    const providerSessionId = result.providerSessionId;
    const delivery = new BoundedSegmentDelivery({
      deliver: (segments) => client.sendSegments(providerSessionId, segments),
      onState: publishDeliveryState,
    });
    activeSession = {
      providerSessionId,
      captureSessionId: result.captureSessionId,
      publisherUid: String(result.rtc.publisherUid),
      transcriptBotUid: String(result.rtc.transcriptBotUid),
      language: input.language,
      delivery,
    };
    return result;
  });

  ipcMain.handle("capture:accept-stream-message", async (_event, input) => {
    const current = activeSession;
    if (!current) throw new Error("No active field-capture session");
    if (String(input?.remoteUid) !== current.transcriptBotUid) {
      return { accepted: false, reason: "UNEXPECTED_STREAM_SENDER" };
    }
    const payload = input?.payload;
    if (!(payload instanceof Uint8Array) || payload.byteLength === 0 || payload.byteLength > 65_536) {
      throw new Error("Agora STT stream payload is empty or exceeds 64 KiB");
    }

    let segment;
    try {
      segment = decoder.decode(payload, {
        fallbackSourceUid: current.publisherUid,
        defaultLanguage: current.language,
      });
    } catch (error) {
      publishDeliveryState({ state: "DEGRADED", error: "Invalid Agora STT Protobuf message" });
      throw new Error(`Agora STT message decode failed: ${safeErrorMessage(error)}`);
    }
    if (!segment) return { accepted: false, reason: "NOT_FINAL_TRANSCRIPT" };

    const accepted = current.delivery.enqueue(segment);
    return {
      accepted,
      preview: accepted ? segment.text.slice(0, 160) : null,
    };
  });

  ipcMain.handle("capture:stop-control", async (_event, providerSessionId) => {
    const current = requireActiveSession(providerSessionId);
    let deliveryError = null;
    try {
      await current.delivery.flush(10_000);
    } catch (error) {
      deliveryError = error;
    }

    try {
      const result = await requireApiClient().stop(providerSessionId);
      current.delivery.close();
      activeSession = null;
      return mergeDeliveryFailure(result, deliveryError);
    } catch (error) {
      if (error?.errorCode === "CAPTURE_AGENT_NO_FINAL_TRANSCRIPT") {
        current.delivery.close();
        activeSession = null;
        return {
          terminalFailure: true,
          status: "FAILED",
          errorCode: error.errorCode,
          message: safeErrorMessage(error),
        };
      }
      throw error;
    }
  });

  ipcMain.handle("capture:abort-control", async (_event, providerSessionId) => {
    const current = requireActiveSession(providerSessionId);
    try {
      const result = await requireApiClient().stop(providerSessionId);
      current.delivery.close();
      activeSession = null;
      return result;
    } catch (error) {
      if (error?.errorCode === "CAPTURE_AGENT_NO_FINAL_TRANSCRIPT") {
        current.delivery.close();
        activeSession = null;
        return {
          terminalFailure: true,
          status: "FAILED",
          errorCode: error.errorCode,
          message: safeErrorMessage(error),
        };
      }
      throw error;
    }
  });
}

function configurePermissions() {
  const ses = session.defaultSession;
  ses.setPermissionCheckHandler((_webContents, permission, requestingOrigin, details) => {
    if (permission !== "media") return false;
    return requestingOrigin.startsWith("file://") && details.mediaType === "audio";
  });
  ses.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const isOwnWindow = webContents === mainWindow?.webContents;
    const audioOnly =
      permission === "media" &&
      Array.isArray(details.mediaTypes) &&
      details.mediaTypes.includes("audio") &&
      !details.mediaTypes.includes("video");
    callback(Boolean(isOwnWindow && audioOnly));
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 780,
    height: 780,
    minWidth: 620,
    minHeight: 680,
    backgroundColor: "#f6f7f8",
    show: false,
    title: "Helm Field Capture",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: false,
      webSecurity: true,
    },
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event) => event.preventDefault());
  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.loadFile(path.join(__dirname, "index.html"));
}

registerIpcHandlers();

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  configurePermissions();
  if (process.platform === "darwin") {
    await systemPreferences.askForMediaAccess("microphone").catch(() => false);
  }
  createWindow();
});

app.on("before-quit", (event) => {
  if (!activeSession || quittingAfterStop) return;
  event.preventDefault();
  quittingAfterStop = true;
  requireApiClient()
    .stop(activeSession.providerSessionId)
    .catch(() => null)
    .finally(() => {
      activeSession?.delivery.close();
      activeSession = null;
      app.quit();
    });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
