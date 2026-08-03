"use strict";

class HelmCaptureApiError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "HelmCaptureApiError";
    this.status = options.status ?? null;
    this.errorCode = options.errorCode ?? "HELM_CAPTURE_API_ERROR";
    this.retryable = Boolean(options.retryable);
  }
}

class HelmCaptureApiClient {
  constructor({
    baseUrl,
    token,
    fetchImpl = globalThis.fetch,
    requestTimeoutMs = 10_000,
  }) {
    if (!baseUrl || !token || typeof fetchImpl !== "function") {
      throw new Error("Configured Helm base URL, capture token, and fetch are required");
    }
    if (!Number.isInteger(requestTimeoutMs) || requestTimeoutMs < 100) {
      throw new Error("Helm capture API timeout must be at least 100 ms");
    }
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.token = token;
    this.fetchImpl = fetchImpl;
    this.requestTimeoutMs = requestTimeoutMs;
  }

  async request(pathname, options = {}) {
    let response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${pathname}`, {
        method: options.method || "GET",
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: "application/json",
          ...(options.body ? { "Content-Type": "application/json" } : {}),
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: options.signal || AbortSignal.timeout(this.requestTimeoutMs),
      });
    } catch (error) {
      throw new HelmCaptureApiError("Helm capture API is unreachable", {
        errorCode: "HELM_CAPTURE_NETWORK_ERROR",
        retryable: true,
        cause: error,
      });
    }

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.success) {
      throw new HelmCaptureApiError(
        payload?.message || `Helm capture API returned HTTP ${response.status}`,
        {
          status: response.status,
          errorCode: payload?.errorCode || "HELM_CAPTURE_API_ERROR",
          retryable: response.status === 408 || response.status === 429 || response.status >= 500,
        },
      );
    }
    return payload.data;
  }

  bootstrap() {
    return this.request("/api/capture-agents/bootstrap");
  }

  start(input) {
    return this.request("/api/capture-agents/sessions/start", {
      method: "POST",
      body: input,
    });
  }

  sendSegments(providerSessionId, segments) {
    return this.request(
      `/api/capture-agents/sessions/${encodeURIComponent(providerSessionId)}/segments`,
      { method: "POST", body: { segments } },
    );
  }

  stop(providerSessionId) {
    return this.request(
      `/api/capture-agents/sessions/${encodeURIComponent(providerSessionId)}/stop`,
      { method: "POST" },
    );
  }
}

module.exports = { HelmCaptureApiClient, HelmCaptureApiError };
