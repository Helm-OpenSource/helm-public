import { describe, expect, it } from "vitest";

import {
  computeGovernedProjectionRegistrationHash,
  type GovernedProjectionEngineRegistration,
} from "./governed-projection-registration";

const REGISTRATION: GovernedProjectionEngineRegistration = {
  engineKey: "engine-a",
  projectorRegistrationRef: "projector:a",
  projectorKey: "engine-a",
  projectorVersion: "v1",
  projectorImplementationHash: `sha256:${"1".repeat(64)}`,
  scannerRegistrationRef: "scanner:a",
  scannerKey: "engine-a",
  scannerVersion: "v1",
  scannerImplementationHash: `sha256:${"1".repeat(64)}`,
  executionBoundary: "local_only",
};

describe("governed projection registration hash", () => {
  it("is a registration-envelope hash, not the implementation hash", () => {
    const projector = computeGovernedProjectionRegistrationHash(REGISTRATION, "projector");
    const scanner = computeGovernedProjectionRegistrationHash(REGISTRATION, "scanner");
    expect(projector).toMatch(/^sha256:[a-f0-9]{64}$/u);
    expect(projector).not.toBe(REGISTRATION.projectorImplementationHash);
    // Same implementation hash, different registration identity: the two components still differ.
    expect(scanner).not.toBe(projector);
  });

  it("rotates with every field of the registration identity", () => {
    const base = computeGovernedProjectionRegistrationHash(REGISTRATION, "projector");
    for (const patch of [
      { engineKey: "engine-b" },
      { projectorRegistrationRef: "projector:b" },
      { projectorVersion: "v2" },
      { projectorImplementationHash: `sha256:${"2".repeat(64)}` },
    ]) {
      expect(computeGovernedProjectionRegistrationHash({ ...REGISTRATION, ...patch }, "projector")).not.toBe(base);
    }
  });
});
