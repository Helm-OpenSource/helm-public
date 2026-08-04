/**
 * CAIO gateway bind-address validation.
 *
 * Policy: bind only to a specific RFC1918 private IPv4 address or a
 * loopback address. Wildcards ("0.0.0.0", "::"), public IPs, IPv6
 * non-loopback addresses, and hostnames are rejected. The RFC1918 check
 * reuses the exported private-LAN helper from the WorkBuddy gateway
 * config. No real site IP is ever hardcoded here — tests use
 * documentation/example addresses only.
 */

import { isIP } from "node:net";

import { isPrivateLanAddress } from "@/tools/caio-workbuddy-gateway/config";

export type CaioGatewayBindAddressErrorCode =
  | "BIND_ADDRESS_REQUIRED"
  | "WILDCARD_FORBIDDEN"
  | "HOSTNAME_FORBIDDEN"
  | "PUBLIC_ADDRESS_FORBIDDEN";

export class CaioGatewayBindAddressError extends Error {
  readonly code: CaioGatewayBindAddressErrorCode;

  constructor(code: CaioGatewayBindAddressErrorCode, message: string) {
    super(message);
    this.name = "CaioGatewayBindAddressError";
    this.code = code;
  }
}

function isLoopback(address: string, family: number): boolean {
  if (family === 4) return address.startsWith("127.");
  if (family === 6) return address.toLowerCase() === "::1";
  return false;
}

/**
 * Returns the trimmed address when it is a specific RFC1918 private IPv4
 * or loopback address; throws a typed error otherwise.
 */
export function validateCaioGatewayBindAddress(value: string): string {
  const candidate = value.trim();
  if (!candidate) {
    throw new CaioGatewayBindAddressError(
      "BIND_ADDRESS_REQUIRED",
      "A bind address is required.",
    );
  }
  if (candidate === "0.0.0.0" || candidate === "::") {
    throw new CaioGatewayBindAddressError(
      "WILDCARD_FORBIDDEN",
      "Binding every interface is forbidden; use one private LAN or loopback address.",
    );
  }
  const family = isIP(candidate);
  if (family === 0) {
    throw new CaioGatewayBindAddressError(
      "HOSTNAME_FORBIDDEN",
      "Hostnames are forbidden; use a literal IP address.",
    );
  }
  if (isLoopback(candidate, family)) return candidate;
  if (family === 4 && isPrivateLanAddress(candidate)) return candidate;
  throw new CaioGatewayBindAddressError(
    "PUBLIC_ADDRESS_FORBIDDEN",
    "Only an RFC1918 private IPv4 or loopback address may be bound.",
  );
}
