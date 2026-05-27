import { describe, expect, it } from "vitest";
import { CASE_MANAGEMENT_SAMPLE_BI_REPORT } from "./manifest";

describe("case-management-sample bi report manifest", () => {
  it("keeps the report synthetic and daily", () => {
    expect(CASE_MANAGEMENT_SAMPLE_BI_REPORT.cadence).toBe("daily");
    expect(CASE_MANAGEMENT_SAMPLE_BI_REPORT.dataPosture).toBe("synthetic");
  });
});
