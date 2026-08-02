/**
 * Configuration for the CAIO Access Gateway SURFACE.
 *
 * WHAT THIS DESCRIBES
 * The one socket both CAIO surfaces are served on: a private LAN address, port
 * 7443. The Access Gateway API (see server.ts for the route table) and the
 * WorkBuddy MCP surface (`/mcp/workbuddy`) share it, routed by path by one
 * host. This config therefore REFUSES a WorkBuddy declaration naming a
 * DIFFERENT socket — that would be a second listener, and the deployment binds
 * exactly one approved private address and port.
 *
 * FAIL-CLOSED RULES
 *   1. The bind address is REQUIRED and is validated by the shared
 *      validateCaioGatewayBindAddress: a wildcard, a public address, or a
 *      hostname is refused. There is no default and no fallback interface.
 *   2. The port is PINNED to 7443. An env value is accepted only if it names
 *      the pinned port, so an operator cannot quietly move the socket.
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
  /** The WorkBuddy surface is declared on a DIFFERENT socket than this one. */
  | "LISTENER_SPLIT";

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
 * Refuse a WorkBuddy socket that DIFFERS from this one.
 *
 * This rule used to be the exact inverse: it refused the shared socket and
 * permitted a split one. That described an arrangement the deployment cannot
 * run — exactly one approved private address and port is bound — and the
 * consequence was that only one of the two surfaces was ever served. Both
 * surfaces are now served by ONE host on ONE socket, so a WorkBuddy
 * declaration naming a different address or port means someone is trying to
 * build a second listener, and that is what fails closed here.
 *
 * Read straight off the WorkBuddy env keys rather than through
 * loadWorkBuddyGatewayConfig: that loader demands a complete HTTPS/mTLS
 * configuration as soon as the shared `gatewayEnabled` flag is on, and this
 * surface must not require the whole WorkBuddy configuration to be present in
 * order to load. Only the socket coordinates matter here. An absent
 * declaration says nothing and is not an error: the host declares the socket.
 */
function assertNoListenerSplit(
  env: Environment,
  bindAddress: string,
  port: number,
): void {
  const otherAddress = env.CAIO_WORKBUDDY_GATEWAY_BIND_ADDRESS?.trim();
  const otherPort = Number(env.CAIO_WORKBUDDY_GATEWAY_PORT?.trim());
  if (!otherAddress || !Number.isInteger(otherPort)) return;
  if (otherAddress !== bindAddress || otherPort !== port) {
    throw new CaioAccessGatewayServerConfigError(
      "LISTENER_SPLIT",
      "The WorkBuddy LAN gateway is declared on a different socket; both surfaces are served by one host on one socket.",
    );
  }
}

export function loadCaioAccessGatewayServerConfig(
  env: Environment,
): CaioAccessGatewayServerConfig {
  const bindAddress = requireBindAddress(env);
  const port = requirePinnedPort(env);
  assertNoListenerSplit(env, bindAddress, port);

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
