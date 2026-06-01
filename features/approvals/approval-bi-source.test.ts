import { describe, expect, it } from "vitest";
import {
  normalizeActionItemMetadata,
} from "@/features/approvals/queries";

describe("normalizeActionItemMetadata", () => {
  it("parses string metadata", () => {
    expect(
      normalizeActionItemMetadata(
        JSON.stringify({ biReportSignalId: "signal-1" }),
      ),
    ).toEqual({ biReportSignalId: "signal-1" });
  });

  it("passes through object metadata", () => {
    expect(
      normalizeActionItemMetadata({
        biReportSignalId: "signal-2",
        biReportSkillKey: "bi_repay_daily",
      }),
    ).toEqual({
      biReportSignalId: "signal-2",
      biReportSkillKey: "bi_repay_daily",
    });
  });

  it("returns null for empty input", () => {
    expect(normalizeActionItemMetadata(null)).toBeNull();
    expect(normalizeActionItemMetadata(undefined)).toBeNull();
  });
});
