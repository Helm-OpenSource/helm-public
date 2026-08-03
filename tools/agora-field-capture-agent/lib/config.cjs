"use strict";

const CAPTURE_TOKEN_PATTERN = /^helm_capture_[A-Za-z0-9_-]{8,}_[A-Za-z0-9_-]{20,}$/;

function normalizeBaseUrl(value) {
  const raw = String(value || "").trim().replace(/\/+$/, "");
  if (!raw) return null;

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("HELM_BASE_URL must be a valid URL");
  }
  const localHttp =
    parsed.protocol === "http:" &&
    ["127.0.0.1", "localhost", "::1"].includes(parsed.hostname);
  if (parsed.protocol !== "https:" && !localHttp) {
    throw new Error("HELM_BASE_URL must use HTTPS outside localhost");
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error("HELM_BASE_URL must not contain credentials, query, or fragment");
  }
  return parsed.toString().replace(/\/$/, "");
}

function readAgentConfig(env = process.env) {
  const baseUrl = normalizeBaseUrl(env.HELM_BASE_URL);
  const token = String(env.HELM_CAPTURE_AGENT_TOKEN || "").trim() || null;
  if (token && !CAPTURE_TOKEN_PATTERN.test(token)) {
    throw new Error("HELM_CAPTURE_AGENT_TOKEN has an invalid format");
  }
  return {
    baseUrl,
    token,
    configured: Boolean(baseUrl && token),
  };
}

function describeAgentConfig(config) {
  return {
    configured: config.configured,
    helmOrigin: config.baseUrl ? new URL(config.baseUrl).origin : null,
    credentialConfigured: Boolean(config.token),
  };
}

module.exports = {
  CAPTURE_TOKEN_PATTERN,
  describeAgentConfig,
  normalizeBaseUrl,
  readAgentConfig,
};
