import { describe, expect, it } from "vitest";
import type { CaseManagementSampleSignal } from "./types";

describe("case-management-sample signal types", () => {
  it("exposes the public sample signal shape", () => {
    const signal: CaseManagementSampleSignal = {
      signalId: "sig-1",
      family: "boundary_attempt",
      title: "Boundary review required",
    };
    expect(signal.family).toBe("boundary_attempt");
  });
});
