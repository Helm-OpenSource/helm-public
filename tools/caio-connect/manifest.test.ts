import { describe, expect, it } from "vitest";

import {
  caioConnectManifestSchema,
  evaluateDistributionManifest,
} from "@/tools/caio-connect/manifest";

const VALID = {
  binaryName: "caio-connect",
  version: "1.2.3",
  sha256: "a".repeat(64),
  signed: true,
  notarized: true,
};

describe("caio-connect distribution manifest", () => {
  it("accepts a signed + notarized manifest", () => {
    expect(caioConnectManifestSchema.safeParse(VALID).success).toBe(true);
    const evaluation = evaluateDistributionManifest(VALID);
    expect(evaluation.status).toBe("ok");
  });

  it("blocks distribution when signing or notarization is missing", () => {
    expect(evaluateDistributionManifest({ ...VALID, signed: false }).status).toBe(
      "blocked:signing_required",
    );
    expect(evaluateDistributionManifest({ ...VALID, notarized: false }).status).toBe(
      "blocked:signing_required",
    );
    expect(
      evaluateDistributionManifest({ ...VALID, signed: false, notarized: false }).status,
    ).toBe("blocked:signing_required");
  });

  it("rejects malformed manifests with issue details", () => {
    const evaluation = evaluateDistributionManifest({
      ...VALID,
      sha256: "not-a-digest",
      version: "v1",
    });
    expect(evaluation.status).toBe("invalid");
    if (evaluation.status !== "invalid") throw new Error("unreachable");
    expect(evaluation.issues.join("; ")).toContain("sha256");
    expect(evaluation.issues.join("; ")).toContain("version");
  });
});
