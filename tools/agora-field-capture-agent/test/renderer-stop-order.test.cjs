"use strict";

const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");

test("keeps RTC connected until Agora stop and final-text tail delivery complete", () => {
  const source = readFileSync(path.join(__dirname, "../renderer.js"), "utf8");
  const stopFunction = source.slice(
    source.indexOf("async function stopCapture()"),
    source.indexOf("async function initialize()"),
  );

  const disableMic = stopFunction.indexOf("setEnabled(false)");
  const stopProvider = stopFunction.indexOf("stopControl(providerSessionId)");
  const leaveRtc = stopFunction.indexOf("cleanupRtc()");

  assert.ok(disableMic >= 0, "stop must disable the microphone first");
  assert.ok(stopProvider > disableMic, "Agora stop must happen after microphone quiescence");
  assert.ok(leaveRtc > stopProvider, "RTC leave must happen after provider stop returns");
});
