"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  describeAgentConfig,
  normalizeBaseUrl,
  readAgentConfig,
} = require("../lib/config.cjs");

test("allows HTTPS and localhost HTTP but rejects remote plaintext", () => {
  assert.equal(normalizeBaseUrl("https://helm.example.com/"), "https://helm.example.com");
  assert.equal(normalizeBaseUrl("http://127.0.0.1:3107/"), "http://127.0.0.1:3107");
  assert.throws(() => normalizeBaseUrl("http://helm.example.com"), /HTTPS/);
});

test("never includes the capture token in renderer configuration", () => {
  const config = readAgentConfig({
    HELM_BASE_URL: "http://localhost:3107",
    HELM_CAPTURE_AGENT_TOKEN: `helm_capture_${"a".repeat(16)}_${"b".repeat(43)}`,
  });
  const description = describeAgentConfig(config);
  assert.deepEqual(description, {
    configured: true,
    helmOrigin: "http://localhost:3107",
    credentialConfigured: true,
  });
  assert.equal(JSON.stringify(description).includes(config.token), false);
});
