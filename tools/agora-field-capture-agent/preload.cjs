"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("fieldCapture", {
  getConfig: () => ipcRenderer.invoke("capture:get-config"),
  bootstrap: () => ipcRenderer.invoke("capture:bootstrap"),
  listLocalDevices: () => ipcRenderer.invoke("capture:list-local-devices"),
  testLocalDevice: (index) => ipcRenderer.invoke("capture:test-local-device", index),
  startControl: (input) => ipcRenderer.invoke("capture:start-control", input),
  acceptStreamMessage: (remoteUid, payload) =>
    ipcRenderer.invoke("capture:accept-stream-message", { remoteUid, payload }),
  stopControl: (providerSessionId) =>
    ipcRenderer.invoke("capture:stop-control", providerSessionId),
  abortControl: (providerSessionId) =>
    ipcRenderer.invoke("capture:abort-control", providerSessionId),
  onDeliveryState: (listener) => {
    const handler = (_event, value) => listener(value);
    ipcRenderer.on("capture:delivery-state", handler);
    return () => ipcRenderer.removeListener("capture:delivery-state", handler);
  },
});
