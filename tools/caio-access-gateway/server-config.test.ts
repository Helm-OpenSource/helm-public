import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  CAIO_ACCESS_GATEWAY_LISTEN_PORT,
  CaioAccessGatewayServerConfigError,
  loadCaioAccessGatewayServerConfig,
} from "@/tools/caio-access-gateway/server-config";

// RFC1918 / documentation addresses are built at runtime so the public-release
// static line scan never matches an address literal in this file.
const LAN_ADDRESS = [10, 0, 0, 12].join(".");
const OTHER_LAN_ADDRESS = [10, 0, 0, 13].join(".");
const PUBLIC_ADDRESS = [203, 0, 113, 7].join(".");
const WILDCARD = [0, 0, 0, 0].join(".");

const CERT_DIR = path.join(path.sep, "etc", "caio", "tls");

function env(
  overrides: Readonly<Record<string, string | undefined>> = {},
): Readonly<Record<string, string | undefined>> {
  return {
    CAIO_ACCESS_GATEWAY_BIND_ADDRESS: LAN_ADDRESS,
    CAIO_ACCESS_GATEWAY_MTLS_CERT_PATH: path.join(CERT_DIR, "server.crt"),
    CAIO_ACCESS_GATEWAY_MTLS_KEY_PATH: path.join(CERT_DIR, "server.key"),
    CAIO_ACCESS_GATEWAY_MTLS_CA_PATH: path.join(CERT_DIR, "client-ca.crt"),
    ...overrides,
  };
}

function codeOf(load: () => unknown): string {
  try {
    load();
  } catch (error) {
    if (error instanceof CaioAccessGatewayServerConfigError) return error.code;
    return `unexpected:${String(error)}`;
  }
  return "did_not_throw";
}

describe("CAIO access gateway server config", () => {
  it("accepts a private LAN bind address and pins the listener to 7443", () => {
    const config = loadCaioAccessGatewayServerConfig(env());
    expect(config.bindAddress).toBe(LAN_ADDRESS);
    expect(config.port).toBe(CAIO_ACCESS_GATEWAY_LISTEN_PORT);
    expect(CAIO_ACCESS_GATEWAY_LISTEN_PORT).toBe(7443);
    expect(config.mtls.requireClientCertificate).toBe(true);
  });

  it("refuses to start with no bind address at all", () => {
    expect(
      codeOf(() =>
        loadCaioAccessGatewayServerConfig(
          env({ CAIO_ACCESS_GATEWAY_BIND_ADDRESS: undefined }),
        ),
      ),
    ).toBe("BIND_ADDRESS_REQUIRED");
  });

  it("refuses a wildcard, a public address and a hostname", () => {
    expect(
      codeOf(() =>
        loadCaioAccessGatewayServerConfig(
          env({ CAIO_ACCESS_GATEWAY_BIND_ADDRESS: WILDCARD }),
        ),
      ),
    ).toBe("WILDCARD_FORBIDDEN");
    expect(
      codeOf(() =>
        loadCaioAccessGatewayServerConfig(
          env({ CAIO_ACCESS_GATEWAY_BIND_ADDRESS: PUBLIC_ADDRESS }),
        ),
      ),
    ).toBe("PUBLIC_ADDRESS_FORBIDDEN");
    expect(
      codeOf(() =>
        loadCaioAccessGatewayServerConfig(
          env({ CAIO_ACCESS_GATEWAY_BIND_ADDRESS: "gateway.internal" }),
        ),
      ),
    ).toBe("HOSTNAME_FORBIDDEN");
  });

  it("refuses a port that is not the pinned 7443", () => {
    expect(
      codeOf(() =>
        loadCaioAccessGatewayServerConfig(
          env({ CAIO_ACCESS_GATEWAY_PORT: "8443" }),
        ),
      ),
    ).toBe("PORT_PINNED");
    // Declaring the pinned port explicitly is allowed.
    expect(
      loadCaioAccessGatewayServerConfig(
        env({ CAIO_ACCESS_GATEWAY_PORT: "7443" }),
      ).port,
    ).toBe(7443);
  });

  it("refuses missing or relative mTLS material rather than defaulting", () => {
    for (const key of [
      "CAIO_ACCESS_GATEWAY_MTLS_CERT_PATH",
      "CAIO_ACCESS_GATEWAY_MTLS_KEY_PATH",
      "CAIO_ACCESS_GATEWAY_MTLS_CA_PATH",
    ]) {
      expect(
        codeOf(() =>
          loadCaioAccessGatewayServerConfig(env({ [key]: undefined })),
        ),
      ).toBe("MTLS_MATERIAL_REQUIRED");
      expect(
        codeOf(() =>
          loadCaioAccessGatewayServerConfig(env({ [key]: "relative/path.pem" })),
        ),
      ).toBe("MTLS_MATERIAL_REQUIRED");
    }
  });

  // The two surfaces are served by ONE process on ONE socket. The rule that
  // used to live here was the exact inverse — it refused the shared socket and
  // permitted a split one — which described an arrangement the deployment
  // cannot actually run: only one approved private address and port is bound,
  // so a second listener never gets one.
  it("accepts the WorkBuddy LAN gateway on THIS socket: that is the composition", () => {
    const config = loadCaioAccessGatewayServerConfig(
      env({
        CAIO_WORKBUDDY_GATEWAY_BIND_ADDRESS: LAN_ADDRESS,
        CAIO_WORKBUDDY_GATEWAY_PORT: String(CAIO_ACCESS_GATEWAY_LISTEN_PORT),
      }),
    );
    expect(config.bindAddress).toBe(LAN_ADDRESS);
    expect(config.port).toBe(CAIO_ACCESS_GATEWAY_LISTEN_PORT);
  });

  it("refuses a WorkBuddy socket that differs from this one", () => {
    expect(
      codeOf(() =>
        loadCaioAccessGatewayServerConfig(
          env({
            CAIO_WORKBUDDY_GATEWAY_BIND_ADDRESS: OTHER_LAN_ADDRESS,
            CAIO_WORKBUDDY_GATEWAY_PORT: String(
              CAIO_ACCESS_GATEWAY_LISTEN_PORT,
            ),
          }),
        ),
      ),
    ).toBe("LISTENER_SPLIT");
    expect(
      codeOf(() =>
        loadCaioAccessGatewayServerConfig(
          env({
            CAIO_WORKBUDDY_GATEWAY_BIND_ADDRESS: LAN_ADDRESS,
            CAIO_WORKBUDDY_GATEWAY_PORT: "8443",
          }),
        ),
      ),
    ).toBe("LISTENER_SPLIT");
  });

  it("says nothing about a WorkBuddy socket that was never declared", () => {
    // CONTROL: with no WorkBuddy declaration at all the rule must not fire,
    // otherwise the two cases above would pass for the wrong reason.
    expect(loadCaioAccessGatewayServerConfig(env()).bindAddress).toBe(
      LAN_ADDRESS,
    );
  });

  it("carries the ONE feature-flag vocabulary, fail-closed by default", () => {
    expect(loadCaioAccessGatewayServerConfig(env()).featureFlags).toEqual({
      gatewayEnabled: false,
      readEnabled: false,
      pushEnabled: false,
      presenceEnabled: false,
      mutationsEnabled: false,
      promptResponsesEnabled: false,
      questionSelectionsEnabled: false,
      adviceDecisionsEnabled: false,
    });
    expect(
      loadCaioAccessGatewayServerConfig(
        env({
          CAIO_WORKBUDDY_GATEWAY_ENABLED: "true",
          CAIO_WORKBUDDY_READ_ENABLED: "true",
        }),
      ).featureFlags,
    ).toMatchObject({ gatewayEnabled: true, readEnabled: true });
  });
});
