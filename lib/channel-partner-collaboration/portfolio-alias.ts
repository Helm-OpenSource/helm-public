import { createHmac } from "node:crypto";

import type { PortfolioAliasInput } from "./types";

// P0-REQ-04: grant-scoped HMAC alias for partner portfolio readout.
//
// portfolioAlias(partnerCandidateId, customerWorkspaceId, grantId)
//   = HMAC-SHA256(
//       key  = partnerGrantSaltSecret[grantId],
//       data = partnerCandidateId + ":" + customerWorkspaceId + ":" + grantId
//     )[:12]
//
// Properties (V2.1):
// - Grant-scoped 稳定: same grant lifetime → same alias (跨周对比可行)
// - Grant 终结即失效: new grant → new alias (no alias reuse across grants)
// - Cross-partner 独立: different partners hold different salts → different aliases
// - Salt isolation: never reuse self-tenant-health alias salt material
// - 不可逆: HMAC single-direction; can't recover customerWorkspaceId from alias
//
// Salt sourcing is out of scope for P0 contract; consumers must inject a
// per-grant secret via the `grantSaltSecret` argument (P1/P2 will pull from a
// secrets backend, not from the codebase or env vars).

const ALIAS_HEX_LENGTH = 12;

export function buildPortfolioAlias(
  input: PortfolioAliasInput,
  grantSaltSecret: string,
): string {
  if (!grantSaltSecret) {
    throw new Error(
      "buildPortfolioAlias: grantSaltSecret must be non-empty (per-grant secret)",
    );
  }
  const data = `${input.partnerCandidateId}:${input.customerWorkspaceId}:${input.grantId}`;
  return createHmac("sha256", grantSaltSecret).update(data).digest("hex").slice(
    0,
    ALIAS_HEX_LENGTH,
  );
}

// Quick check that two aliases for the same (partner, customer, grant) tuple
// are stable across calls (i.e., the function is deterministic for fixed salt).
export function portfolioAliasIsStable(
  input: PortfolioAliasInput,
  grantSaltSecret: string,
): boolean {
  return (
    buildPortfolioAlias(input, grantSaltSecret) ===
    buildPortfolioAlias(input, grantSaltSecret)
  );
}
