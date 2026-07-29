/**
 * CAIO access gateway barrel.
 *
 * Note: token-store.prisma.ts (the Prisma adapter) is intentionally NOT
 * re-exported here so importing the contracts/protocol core never drags
 * the Prisma client into a bundle. Import the adapter directly from
 * `@/lib/caio-access-gateway/token-store.prisma` where it is wired.
 */

export * from "./token-contracts";
export * from "./token-store.service";
export * from "./token-store.memory";
export * from "./project-access";
export * from "./mcp-allowlist";
export * from "./gateway-error-contract";
export * from "./gateway-http-core";
export * from "./bind-address";
