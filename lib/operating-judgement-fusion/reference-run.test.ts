import { describe, expect, it } from "vitest";

import { referenceFusionEvalPassed, runReferenceFusionHeldoutEval } from "./reference-run";

describe("reference fusion held-out run", () => {
  it("passes under the content-bound pre-registration and anti-cheat gates", () => {
    const report = runReferenceFusionHeldoutEval();
    expect(report.preRegistrationValidation).toEqual({ ok: true, errors: [] });
    expect(report.runValidation.ok).toBe(true);
    expect(report.decision).toBe("fusion_beats_baseline");
    expect(referenceFusionEvalPassed(report)).toBe(true);
  });
});
