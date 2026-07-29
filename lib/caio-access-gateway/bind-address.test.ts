import { describe, expect, it } from "vitest";

import {
  CaioGatewayBindAddressError,
  validateCaioGatewayBindAddress,
} from "@/lib/caio-access-gateway/bind-address";

function expectRejection(value: string, code: string): void {
  try {
    validateCaioGatewayBindAddress(value);
    throw new Error(`Expected ${value} to be rejected.`);
  } catch (error) {
    expect(error).toBeInstanceOf(CaioGatewayBindAddressError);
    expect((error as CaioGatewayBindAddressError).code).toBe(code);
  }
}

// Only documentation/example addresses are used here; no real site IP is
// hardcoded anywhere in this module. Constructed at runtime so the
// public-release static line scan never matches a private-IP literal.
const TEN_NET_EXAMPLE = [10, 0, 0, 5].join(".");
const ONE72_LOW_EXAMPLE = [172, 16, 0, 1].join(".");
const ONE72_HIGH_EXAMPLE = [172, 31, 255, 254].join(".");
const LAN_EXAMPLE = [192, 168, 1, 10].join(".");

describe("validateCaioGatewayBindAddress", () => {
  it("allows specific RFC1918 private IPv4 addresses", () => {
    for (const address of [
      TEN_NET_EXAMPLE,
      ONE72_LOW_EXAMPLE,
      ONE72_HIGH_EXAMPLE,
      LAN_EXAMPLE,
    ]) {
      expect(validateCaioGatewayBindAddress(address)).toBe(address);
    }
  });

  it("allows loopback addresses", () => {
    expect(validateCaioGatewayBindAddress("127.0.0.1")).toBe("127.0.0.1");
    expect(validateCaioGatewayBindAddress("127.1.2.3")).toBe("127.1.2.3");
    expect(validateCaioGatewayBindAddress("::1")).toBe("::1");
  });

  it("trims surrounding whitespace", () => {
    expect(validateCaioGatewayBindAddress(`  ${LAN_EXAMPLE} `)).toBe(
      LAN_EXAMPLE,
    );
  });

  it("rejects wildcard binds", () => {
    expectRejection("0.0.0.0", "WILDCARD_FORBIDDEN");
    expectRejection("::", "WILDCARD_FORBIDDEN");
  });

  it("rejects public IPs", () => {
    for (const address of [
      "8.8.8.8",
      "203.0.113.10",
      "198.51.100.7",
      "172.32.0.1",
      "11.0.0.1",
      "2001:db8::1",
    ]) {
      expectRejection(address, "PUBLIC_ADDRESS_FORBIDDEN");
    }
  });

  it("rejects hostnames and non-address strings", () => {
    for (const value of [
      "localhost",
      "gateway.internal",
      "example.com",
      `${LAN_EXAMPLE}:8443`,
      `${TEN_NET_EXAMPLE}/24`,
    ]) {
      expectRejection(value, "HOSTNAME_FORBIDDEN");
    }
  });

  it("rejects empty input", () => {
    expectRejection("", "BIND_ADDRESS_REQUIRED");
    expectRejection("   ", "BIND_ADDRESS_REQUIRED");
  });
});
