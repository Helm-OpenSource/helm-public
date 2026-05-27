import { describe, expect, it } from "vitest";
import { CASE_MANAGEMENT_SAMPLE_WORKERS } from "./manifest";

describe("case-management-sample worker manifest", () => {
  it("lists the two public sample worker drivers", () => {
    expect(CASE_MANAGEMENT_SAMPLE_WORKERS).toContain("case-allocation-driver");
    expect(CASE_MANAGEMENT_SAMPLE_WORKERS).toContain("case-stewardship-driver");
  });
});
