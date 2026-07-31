/**
 * Configuration for the ONE CAIO access gateway listener.
 *
 * WHAT THIS PROCESS IS
 * A single HTTPS/mTLS listener on a private LAN address, port 7443, serving the
 * Access Gateway API (see server.ts for the route table). It is NOT the
 * WorkBuddy LAN gateway: that surface (`/mcp/workbuddy`) is terminated by a
 * separate process, and this config REFUSES to start when the two are
 * configured onto the same socket, so two listeners can never fight over 7443.
 *
 * FAIL-CLOSED RULES
 *   1. The bind address is REQUIRED and is validated by the shared
 *      validateCaioGatewayBindAddress: a wildcard, a public address, or a
 *      hostname is refused. There is no default and no fallback interface.
 *   2. The port is PINNED to 7443. An env value is accepted only if it names
 *      the pinned port, so an operator cannot quietly move the listener (and
 *      a moved listener cannot be mistaken for the WorkBuddy one).
 *   3. All THREE pieces of mTLS material (server certificate, private key,
 *      client CA) are REQUIRED as absolute paths. A missing or relative path is
 *      a construction error, never "start without client certificates".
 *   4. The feature flags come from the ONE WorkBuddy flag vocabulary
 *      (loadWorkBuddyFeatureFlags), which is fail-closed by default, so this
 *      composition cannot invent a second, more permissive flag source.
 *
 * The DEPLOYMENT POSTURE is deliberately NOT read here. Per the owner ruling of
 * 2026-07-30 the posture is a declared deployment property carried by the
 * overlay binding and the control-plane BOM — never inferred from the
 * environment — so it is supplied where the server is constructed (server.ts)
 * and cross-checked against the audit gate's own declaration.
 */

import path from "node:path";

import {
  CaioGatewayBindAddressError,
  validateCaioGatewayBindAddress,
} from "@/lib/caio-access-gateway/bind-address";
import {
  loadWorkBuddyFeatureFlags,
  type WorkBuddyFeatureFlags,
} from "@/lib/caio-collaboration/feature-flags";

/** The single pinned listener port for the Access Gateway API. */
export const CAIO_ACCESS_GATEWAY_LISTEN_PORT = 7443;

export type CaioAccessGatewayServerConfigErrorCode =
  /** Re-raised from the shared bind-address validator. */
  | "BIND_ADDRESS_REQUIRED"
  | "WILDCARD_FORBIDDEN"
  | "HOSTNAME_FORBIDDEN"
  | "PUBLIC_ADDRESS_FORBIDDEN"
  /** The declared port is not the pinned 7443. */
  | "PORT_PINNED"
  /** A certificate, key or client-CA path is missing or not absolute. */
  | "MTLS_MATERIAL_REQUIRED"
  /** Another gateway process is configured onto this exact socket. */
  | "LISTENER_CONFLICT";

export class CaioAccessGatewayServerConfigError extends Error {
  readonly code: CaioAccessGatewayServerConfigErrorCode;

  constructor(code: CaioAccessGatewayServerConfigErrorCode, message: string) {
    super(message);
    this.name = "CaioAccessGatewayServerConfigError";
    this.code = code;
  }
}

export type CaioAccessGatewayServerConfig = Readonly<{
  bindAddress: string;
  port: typeof CAIO_ACCESS_GATEWAY_LISTEN_PORT;
  mtls: Readonly<{
    certificatePath: string;
    privateKeyPath: string;
    clientCaPath: string;
    requireClientCertificate: true;
  }>;
  featureFlags: WorkBuddyFeatureFlags;
}>;

type Environment = Readonly<Record<string, string | undefined>>;

/** The three pieces of mTLS material; all required, none defaulted. */
type MtlsPathKey =
  | "CAIO_ACCESS_GATEWAY_MTLS_CERT_PATH"
  | "CAIO_ACCESS_GATEWAY_MTLS_KEY_PATH"
  | "CAIO_ACCESS_GATEWAY_MTLS_CA_PATH";

function requireAbsolutePath(env: Environment, key: MtlsPathKey): string {
  const value = env[key]?.trim() ?? "";
  if (!value || !path.isAbsolute(value)) {
    throw new CaioAccessGatewayServerConfigError(
      "MTLS_MATERIAL_REQUIRED",
      `${key} must be an absolute path; mTLS material is never defaulted.`,
    );
  }
  return value;
}

function requireBindAddress(env: Environment): string {
  try {
    return validateCaioGatewayBindAddress(
      env.CAIO_ACCESS_GATEWAY_BIND_ADDRESS ?? "",
    );
  } catch (error) {
    if (error instanceof CaioGatewayBindAddressError) {
      // Same taxonomy, one hop up: the validator's code is preserved so an
      // operator sees WHICH rule refused the address.
      throw new CaioAccessGatewayServerConfigError(error.code, error.message);
    }
    throw error;
  }
}

function requirePinnedPort(env: Environment): number {
  const declared = env.CAIO_ACCESS_GATEWAY_PORT?.trim();
  if (declared === undefined || declared === "") {
    return CAIO_ACCESS_GATEWAY_LISTEN_PORT;
  }
  if (Number(declared) !== CAIO_ACCESS_GATEWAY_LISTEN_PORT) {
    throw new CaioAccessGatewayServerConfigError(
      "PORT_PINNED",
      `CAIO_ACCESS_GATEWAY_PORT must be ${CAIO_ACCESS_GATEWAY_LISTEN_PORT}.`,
    );
  }
  return CAIO_ACCESS_GATEWAY_LISTEN_PORT;
}

/**
 * Refuse to start when the WorkBuddy LAN gateway is configured onto the very
 * socket this process binds.
 *
 * Read straight off the WorkBuddy env keys rather than through
 * loadWorkBuddyGatewayConfig: that loader demands a complete HTTPS/mTLS
 * configuration as soon as the shared `gatewayEnabled` flag is on, and this
 * process must not require the OTHER process's configuration to be present in
 * order to boot. Only the socket coordinates matter here.
 */
function assertNoListenerConflict(
  env: Environment,
  bindAddress: string,
  port: number,
): void {
  const otherAddress = env.CAIO_WORKBUDDY_GATEWAY_BIND_ADDRESS?.trim();
  const otherPort = Number(env.CAIO_WORKBUDDY_GATEWAY_PORT?.trim());
  if (!otherAddress || !Number.isInteger(otherPort)) return;
  if (otherAddress === bindAddress && otherPort === port) {
    throw new CaioAccessGatewayServerConfigError(
      "LISTENER_CONFLICT",
      "The WorkBuddy LAN gateway is configured on this exact socket; two listeners may not contend for it.",
    );
  }
}

export function loadCaioAccessGatewayServerConfig(
  env: Environment,
): CaioAccessGatewayServerConfig {
  const bindAddress = requireBindAddress(env);
  const port = requirePinnedPort(env);
  assertNoListenerConflict(env, bindAddress, port);

  return Object.freeze({
    bindAddress,
    port: CAIO_ACCESS_GATEWAY_LISTEN_PORT,
    mtls: Object.freeze({
      certificatePath: requireAbsolutePath(
        env,
        "CAIO_ACCESS_GATEWAY_MTLS_CERT_PATH",
      ),
      privateKeyPath: requireAbsolutePath(
        env,
        "CAIO_ACCESS_GATEWAY_MTLS_KEY_PATH",
      ),
      clientCaPath: requireAbsolutePath(
        env,
        "CAIO_ACCESS_GATEWAY_MTLS_CA_PATH",
      ),
      requireClientCertificate: true as const,
    }),
    featureFlags: loadWorkBuddyFeatureFlags(env),
  });
}
