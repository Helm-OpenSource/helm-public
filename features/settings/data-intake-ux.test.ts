import { describe, expect, it } from "vitest";
import {
  formatSourceIntakeLabel,
  getDataIntakeLevels,
  getProofPackageFiles,
  getResourceAccessCatalog,
  getSourceIntakeOptions,
  isSourceIntakeOptionKey,
} from "./data-intake-ux";

describe("data intake UX contract", () => {
  it("keeps setup source intake split across L0/L1/L2 without granting production access", () => {
    const options = getSourceIntakeOptions(false);

    expect(options.map((option) => option.level)).toContain("L0");
    expect(options.map((option) => option.level)).toContain("L1");
    expect(options.map((option) => option.level)).toContain("L2");
    expect(options.map((option) => option.primaryAction)).toContain("生成诊断方案");
    expect(options.map((option) => option.primaryAction)).toContain("准备只读接入评审包");
    expect(options.map((option) => option.boundary).join("\n")).toContain("不是写回、外发、审批或客户部署授权");
  });

  it("maps setup source keys to reader-facing labels", () => {
    expect(isSourceIntakeOptionKey("meeting_summary")).toBe(true);
    expect(formatSourceIntakeLabel("meeting_summary", "zh-CN")).toBe(
      "会议 / workshop 摘要",
    );
    expect(formatSourceIntakeLabel("legacy-hubspot-note", "en-US")).toBe(
      "legacy-hubspot-note",
    );
  });

  it("keeps the resource catalog dry-run and read-only first", () => {
    const catalog = getResourceAccessCatalog(true);

    expect(catalog).toHaveLength(6);
    expect(catalog.map((item) => item.level)).toContain("L2");
    expect(catalog.map((item) => item.dryRunEvidence).join("\n")).toContain("fixture");
    expect(catalog.map((item) => item.readOnlyStatus).join("\n")).toContain("Read-only");
    expect(catalog.map((item) => item.forbiddenAction).join("\n")).not.toMatch(
      /\bauto-send\b|\bauto-approve\b|\bauto-writeback\b/i,
    );
    expect(catalog.map((item) => item.forbiddenAction).join("\n")).toContain(
      "No connected state implies writeback",
    );
  });

  it("lists only proof package files that stay inside public-safe first-mile evidence", () => {
    expect(getDataIntakeLevels("en-US").map((level) => level.key)).toEqual([
      "L0",
      "L1",
      "L2",
    ]);

    expect(getProofPackageFiles("zh-CN").map((file) => file.file)).toEqual([
      "MANIFEST.json",
      "customer-materials.md",
      "signal-quality-report.md",
      "hsi-fixture.json",
      "review-packet.md",
    ]);
  });
});
