import { isIP } from "node:net";
import path from "node:path";

import {
  loadWorkBuddyFeatureFlags,
  type WorkBuddyFeatureFlags,
} from "@/lib/caio-collaboration/feature-flags";

type Environment = Readonly<Record<string, string | undefined>>;

export type WorkBuddyGatewayConfig =
  | Readonly<{
      enabled: false;
      featureFlags: WorkBuddyFeatureFlags;
    }>
  | Readonly<{
      enabled: true;
      protocol: "https";
      bindAddress: string;
      port: number;
      mtls: Readonly<{
        certificatePath: string;
        privateKeyPath: string;
        clientCaPath: string;
        requireClientCertificate: true;
      }>;
      featureFlags: WorkBuddyFeatureFlags;
      publicFallbackAllowed: false;
      httpFallbackAllowed: false;
    }>;

export type WorkBuddyGatewayConfigErrorCode =
  | "HTTP_FALLBACK_FORBIDDEN"
  | "HTTPS_REQUIRED"
  | "INVALID_PORT"
  | "LAN_BIND_REQUIRED"
  | "MTLS_REQUIRED"
  | "PUBLIC_FALLBACK_FORBIDDEN";

export class WorkBuddyGatewayConfigError extends Error {
  readonly code: WorkBuddyGatewayConfigErrorCode;

  constructor(
    code: WorkBuddyGatewayConfigErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "WorkBuddyGatewayConfigError";
    this.code = code;
  }
}

function isTrue(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}

function isPrivateIpv4(address: string): boolean {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((value) => !Number.isInteger(value))) {
    return false;
  }
  return (
    octets[0] === 10 ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168)
  );
}

function isPrivateIpv6(address: string): boolean {
  const normalized = address.toLowerCase();
  return (
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    /^fe[89ab]/.test(normalized)
  );
}

export function isPrivateLanAddress(address: string): boolean {
  if (address === "0.0.0.0" || address === "::") return false;
  const family = isIP(address);
  if (family === 4) return isPrivateIpv4(address);
  if (family === 6) return isPrivateIpv6(address);
  return false;
}

function requireAbsolutePath(
  env: Environment,
  key:
    | "CAIO_WORKBUDDY_MTLS_CERT_PATH"
    | "CAIO_WORKBUDDY_MTLS_KEY_PATH"
    | "CAIO_WORKBUDDY_MTLS_CA_PATH",
): string {
  const value = env[key]?.trim() ?? "";
  if (!value || !path.isAbsolute(value)) {
    throw new WorkBuddyGatewayConfigError(
      "MTLS_REQUIRED",
      `${key} must be an absolute path.`,
    );
  }
  return value;
}

export function loadWorkBuddyGatewayConfig(
  env: Environment,
): WorkBuddyGatewayConfig {
  const featureFlags = loadWorkBuddyFeatureFlags(env);

  if (isTrue(env.CAIO_WORKBUDDY_ALLOW_PUBLIC_FALLBACK)) {
    throw new WorkBuddyGatewayConfigError(
      "PUBLIC_FALLBACK_FORBIDDEN",
      "A public network fallback is forbidden.",
    );
  }
  if (isTrue(env.CAIO_WORKBUDDY_ALLOW_HTTP_FALLBACK)) {
    throw new WorkBuddyGatewayConfigError(
      "HTTP_FALLBACK_FORBIDDEN",
      "An HTTP fallback is forbidden.",
    );
  }

  if (!featureFlags.gatewayEnabled) {
    return Object.freeze({
      enabled: false,
      featureFlags,
    });
  }

  if (env.CAIO_WORKBUDDY_GATEWAY_PROTOCOL?.trim() !== "https") {
    throw new WorkBuddyGatewayConfigError(
      "HTTPS_REQUIRED",
      "The LAN gateway requires HTTPS.",
    );
  }

  const bindAddress =
    env.CAIO_WORKBUDDY_GATEWAY_BIND_ADDRESS?.trim() ?? "";
  if (!isPrivateLanAddress(bindAddress)) {
    throw new WorkBuddyGatewayConfigError(
      "LAN_BIND_REQUIRED",
      "The gateway must bind an exact private LAN address.",
    );
  }

  const port = Number(env.CAIO_WORKBUDDY_GATEWAY_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new WorkBuddyGatewayConfigError(
      "INVALID_PORT",
      "The gateway port must be an integer from 1 through 65535.",
    );
  }

  if (!isTrue(env.CAIO_WORKBUDDY_MTLS_REQUIRE_CLIENT_CERT)) {
    throw new WorkBuddyGatewayConfigError(
      "MTLS_REQUIRED",
      "mTLS client certificates must be required.",
    );
  }

  return Object.freeze({
    enabled: true,
    protocol: "https",
    bindAddress,
    port,
    mtls: Object.freeze({
      certificatePath: requireAbsolutePath(
        env,
        "CAIO_WORKBUDDY_MTLS_CERT_PATH",
      ),
      privateKeyPath: requireAbsolutePath(
        env,
        "CAIO_WORKBUDDY_MTLS_KEY_PATH",
      ),
      clientCaPath: requireAbsolutePath(
        env,
        "CAIO_WORKBUDDY_MTLS_CA_PATH",
      ),
      requireClientCertificate: true,
    }),
    featureFlags,
    publicFallbackAllowed: false,
    httpFallbackAllowed: false,
  });
}
