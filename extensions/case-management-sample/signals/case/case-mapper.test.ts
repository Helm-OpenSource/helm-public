import { describe, expect, it } from "vitest";
import { mapSampleCaseToSignal } from "./case-mapper";

describe("case-management-sample case mapper", () => {
  it("maps pending review cases to approval_blocked", () => {
    expect(
      mapSampleCaseToSignal({ caseId: "case-1", status: "pending_review" }).family,
    ).toBe("approval_blocked");
  });
});
