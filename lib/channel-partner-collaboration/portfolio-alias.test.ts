import { describe, expect, it } from "vitest";

import {
  buildPortfolioAlias,
  portfolioAliasIsStable,
} from "./portfolio-alias";

const INPUT = {
  partnerCandidateId: "pc-1",
  customerWorkspaceId: "ws-customer-a",
  grantId: "grant-xyz",
};

const SALT_A = "salt-A-grant-1-secret-material";
const SALT_B = "salt-B-grant-2-different-secret";

describe("portfolio alias (P0-REQ-04)", () => {
  it("emits a 12-hex-char alias", () => {
    const alias = buildPortfolioAlias(INPUT, SALT_A);
    expect(alias).toMatch(/^[0-9a-f]{12}$/);
  });

  it("is deterministic for the same (input, salt) pair", () => {
    expect(buildPortfolioAlias(INPUT, SALT_A)).toBe(
      buildPortfolioAlias(INPUT, SALT_A),
    );
    expect(portfolioAliasIsStable(INPUT, SALT_A)).toBe(true);
  });

  it("differs across different grant salts (cross-partner independence)", () => {
    expect(buildPortfolioAlias(INPUT, SALT_A)).not.toBe(
      buildPortfolioAlias(INPUT, SALT_B),
    );
  });

  it("differs when customerWorkspaceId changes", () => {
    expect(buildPortfolioAlias(INPUT, SALT_A)).not.toBe(
      buildPortfolioAlias({ ...INPUT, customerWorkspaceId: "ws-other" }, SALT_A),
    );
  });

  it("differs when grantId changes (grant termination invalidates alias)", () => {
    expect(buildPortfolioAlias(INPUT, SALT_A)).not.toBe(
      buildPortfolioAlias({ ...INPUT, grantId: "grant-next" }, SALT_A),
    );
  });

  it("rejects empty salt", () => {
    expect(() => buildPortfolioAlias(INPUT, "")).toThrow(/grantSaltSecret/);
  });
});
