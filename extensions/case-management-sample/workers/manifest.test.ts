import manifest from "./extension.manifest.json";
import { describe, expect, it } from "vitest";

describe("case-management-sample / workers manifest", () => {
  it("keeps worker cookbook read-only and review-first", () => {
    expect(manifest.status).toBe("ACTIVE");
    expect(manifest.capabilityManifest.maxEffectMode).toBe("read_only");
    expect(manifest.capabilityManifest.customerFacingAllowed).toBe(false);
    expect(manifest.capabilityManifest.requiresReviewByDefault).toBe(true);
    expect(manifest.capabilityManifest.nonCommitmentOnly).toBe(true);
    expect(manifest.migrationHints.length).toBeGreaterThan(0);
  });

  it("declares both cookbook drivers and their checks", () => {
    expect(manifest.runtimeDeclarations.workers).toEqual([]);
    expect(manifest.ownedAssets).toEqual([
      "case-allocation-driver",
      "case-stewardship-driver",
    ]);
    expect(manifest.evalContract.checks).toContain("case-allocation-driver/decide.test.ts");
    expect(manifest.evalContract.checks).toContain("case-stewardship-driver/decide.test.ts");
  });
});
