import { describe, expect, it } from "vitest";
import {
  getRoleFoundation,
  listRoleFoundations,
} from "@/lib/definitions/role-foundations";
import { ROLE_PRESET_KEYS } from "@/lib/definitions/role-presets";

describe("role foundations", () => {
  it("exposes one role foundation per preset", () => {
    const foundations = listRoleFoundations("zh-CN");

    expect(foundations).toHaveLength(ROLE_PRESET_KEYS.length);
    expect(new Set(foundations.map((item) => item.rolePresetKey)).size).toBe(
      ROLE_PRESET_KEYS.length,
    );
  });

  it("keeps each starter pack small and grounded in known skills", () => {
    const foundations = listRoleFoundations("zh-CN");

    for (const foundation of foundations) {
      expect(foundation.starterSkillPack.suggestions.length).toBeGreaterThan(0);
      expect(foundation.starterSkillPack.suggestions.length).toBeLessThanOrEqual(3);

      for (const suggestion of foundation.starterSkillPack.suggestions) {
        expect(suggestion.skillId).toBeTruthy();
        expect(suggestion.skillName.length).toBeGreaterThan(0);
        expect(suggestion.rationale.length).toBeGreaterThan(0);
        expect(suggestion.activationCue.length).toBeGreaterThan(0);
      }
    }
  });

  it("keeps founder role boundary-first and candidate-only", () => {
    const founder = getRoleFoundation("FOUNDER_CEO", "zh-CN");

    expect(founder.soulLite.boundaryNotes.some((item) => item.includes("承诺"))).toBe(
      true,
    );
    expect(founder.starterSkillPack.boundaryNote).toContain("candidate capability");
    expect(founder.starterSkillPack.boundaryNote).toContain("formal skill");
  });

  it("uses focus areas to reorder starter skills and explain the workspace fit", () => {
    const salesLead = getRoleFoundation("SALES_LEAD", "zh-CN", {
      workspaceProfileType: "销售负责人",
      focusAreas: ["客户跟进", "合作拓展"],
    });

    expect(salesLead.starterSkillPack.suggestions[0]?.skillId).toBe(
      "external-followup-draft",
    );
    expect(salesLead.workspaceContext.postureSummary).toContain("销售负责人");
    expect(salesLead.workspaceContext.focusSummary).toContain("客户跟进");
  });
});
