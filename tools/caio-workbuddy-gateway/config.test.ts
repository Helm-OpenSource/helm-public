import { describe, expect, it } from "vitest";

import {
  loadWorkBuddyGatewayConfig,
  WorkBuddyGatewayConfigError,
} from "./config";

const TEST_PRIVATE_IPV4 = [192, 168, 50, 20].join(".");

const validEnv = {
  CAIO_WORKBUDDY_GATEWAY_ENABLED: "true",
  CAIO_WORKBUDDY_READ_ENABLED: "true",
  CAIO_WORKBUDDY_PUSH_ENABLED: "true",
  CAIO_WORKBUDDY_PRESENCE_ENABLED: "true",
  CAIO_WORKBUDDY_MUTATIONS_ENABLED: "false",
  CAIO_WORKBUDDY_PROMPT_RESPONSES_ENABLED: "false",
  CAIO_WORKBUDDY_QUESTION_SELECTIONS_ENABLED: "false",
  CAIO_WORKBUDDY_ADVICE_DECISIONS_ENABLED: "false",
  CAIO_WORKBUDDY_GATEWAY_PROTOCOL: "https",
  CAIO_WORKBUDDY_GATEWAY_BIND_ADDRESS: TEST_PRIVATE_IPV4,
  CAIO_WORKBUDDY_GATEWAY_PORT: "9443",
  CAIO_WORKBUDDY_MTLS_CERT_PATH: "/private/etc/helm/server.crt",
  CAIO_WORKBUDDY_MTLS_KEY_PATH: "/private/etc/helm/server.key",
  CAIO_WORKBUDDY_MTLS_CA_PATH: "/private/etc/helm/client-ca.crt",
  CAIO_WORKBUDDY_MTLS_REQUIRE_CLIENT_CERT: "true",
} as const;

describe("loadWorkBuddyGatewayConfig", () => {
  it("stays disabled without environment flags", () => {
    expect(loadWorkBuddyGatewayConfig({})).toEqual({
      enabled: false,
      featureFlags: {
        gatewayEnabled: false,
        readEnabled: false,
        pushEnabled: false,
        presenceEnabled: false,
        mutationsEnabled: false,
        promptResponsesEnabled: false,
        questionSelectionsEnabled: false,
        adviceDecisionsEnabled: false,
      },
    });
  });

  it("accepts an exact private address with HTTPS and required mTLS", () => {
    expect(loadWorkBuddyGatewayConfig(validEnv)).toEqual({
      enabled: true,
      protocol: "https",
      bindAddress: TEST_PRIVATE_IPV4,
      port: 9443,
      mtls: {
        certificatePath: "/private/etc/helm/server.crt",
        privateKeyPath: "/private/etc/helm/server.key",
        clientCaPath: "/private/etc/helm/client-ca.crt",
        requireClientCertificate: true,
      },
      featureFlags: {
        gatewayEnabled: true,
        readEnabled: true,
        pushEnabled: true,
        presenceEnabled: true,
        mutationsEnabled: false,
        promptResponsesEnabled: false,
        questionSelectionsEnabled: false,
        adviceDecisionsEnabled: false,
      },
      publicFallbackAllowed: false,
      httpFallbackAllowed: false,
    });
  });

  it.each([
    [
      "wildcard bind",
      { ...validEnv, CAIO_WORKBUDDY_GATEWAY_BIND_ADDRESS: "0.0.0.0" },
      "LAN_BIND_REQUIRED",
    ],
    [
      "public address",
      { ...validEnv, CAIO_WORKBUDDY_GATEWAY_BIND_ADDRESS: "8.8.8.8" },
      "LAN_BIND_REQUIRED",
    ],
    [
      "HTTP",
      { ...validEnv, CAIO_WORKBUDDY_GATEWAY_PROTOCOL: "http" },
      "HTTPS_REQUIRED",
    ],
    [
      "missing client CA",
      { ...validEnv, CAIO_WORKBUDDY_MTLS_CA_PATH: "" },
      "MTLS_REQUIRED",
    ],
    [
      "optional client certificate",
      {
        ...validEnv,
        CAIO_WORKBUDDY_MTLS_REQUIRE_CLIENT_CERT: "false",
      },
      "MTLS_REQUIRED",
    ],
    [
      "public fallback",
      { ...validEnv, CAIO_WORKBUDDY_ALLOW_PUBLIC_FALLBACK: "true" },
      "PUBLIC_FALLBACK_FORBIDDEN",
    ],
    [
      "HTTP fallback",
      { ...validEnv, CAIO_WORKBUDDY_ALLOW_HTTP_FALLBACK: "true" },
      "HTTP_FALLBACK_FORBIDDEN",
    ],
  ])("rejects %s", (_label, env, code) => {
    expect(() => loadWorkBuddyGatewayConfig(env)).toThrow(
      expect.objectContaining<Partial<WorkBuddyGatewayConfigError>>({ code }),
    );
  });
});
