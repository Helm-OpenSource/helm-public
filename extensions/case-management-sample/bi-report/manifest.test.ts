import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { loadBiReportSkillPack } from "@/lib/bi-report-skill/skill-loader";
import manifest from "./extension.manifest.json";

describe("case-management-sample / bi-report manifest", () => {
  it("stays active and read-only for public bundle validation", () => {
    expect(manifest.status).toBe("ACTIVE");
    expect(manifest.runtimeDeclarations.skills).toEqual([]);
    expect(manifest.runtimeDeclarations.resources).toEqual([]);
    expect(manifest.runtimeDeclarations.surfaces).toEqual([]);
    expect(manifest.surfaces).toEqual([]);
    expect(manifest.capabilityManifest.maxEffectMode).toBe("read_only");
    expect(manifest.capabilityManifest.customerFacingAllowed).toBe(false);
    expect(manifest.capabilityManifest.requiresReviewByDefault).toBe(true);
    expect(manifest.capabilityManifest.nonCommitmentOnly).toBe(true);
    expect(manifest.dependencyDeclarations.policyTruths).toContain("observer-first");
  });

  it("keeps documentation and validation pointers populated", () => {
    expect(manifest.migrationHints.length).toBeGreaterThan(0);
    expect(manifest.documentationPointers.docs).toContain("../README.md");
    expect(manifest.evalContract.checks).toContain("manifest.test.ts");
  });

  it("ships the daily activity readout cookbook assets", () => {
    const files = [
      "report-skills/daily-activity-readout/query.sql",
      "report-skills/daily-activity-readout/schema.json",
      "report-skills/daily-activity-readout/metrics.json",
      "report-skills/daily-activity-readout/result-criteria.json",
      "report-skills/daily-activity-readout/prompt.md",
      "report-skills/daily-activity-readout/message-template.md",
      "report-skills/daily-activity-readout/skill.json",
      "resources/case-management-sample.daily.resource.yaml",
    ];

    for (const file of files) {
      expect(existsSync(new URL(file, import.meta.url))).toBe(true);
    }
    expect(manifest.ownedAssets).toEqual([
      "report-skills/daily-activity-readout",
      "resources/case-management-sample.daily.resource.yaml",
    ]);
  });

  it("loads the cookbook by its declared skill key", async () => {
    const skill = await loadBiReportSkillPack({
      extensionKey: "case-management-sample-bi-report",
      skillKey: "daily-activity-readout",
    });

    expect(skill.manifest.skillKey).toBe("daily-activity-readout");
    expect(skill.baseDir).toContain("report-skills/daily-activity-readout");
    expect(skill.querySql).toContain("sample_case_day_board");
  });
});
