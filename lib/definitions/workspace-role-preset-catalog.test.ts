import { describe, expect, it } from "vitest";
import {
  getWorkspaceRolePresetDefinition,
  listWorkspaceRolePresetOptions,
  resolveWorkspaceRolePresetKey,
} from "@/lib/definitions/workspace-role-preset-catalog";

const tenantCatalogConfiguration = JSON.stringify({
  rolePresetCatalog: {
    includeDefaultPresets: false,
    presets: [
      {
        key: "TENANT_ASSET_OPERATIONS_OWNER",
        basePresetKey: "FOUNDER_CEO",
        workspaceRole: "OWNER",
        roleCategory: "OWNER",
        label: {
          zh: "资产运营负责人",
          en: "Asset operations owner",
        },
        summary: {
          zh: "负责资产运营目标、策略边界和跨角色升级。",
          en: "Owns asset operating goals, strategy boundaries, and escalations.",
        },
        mission: {
          zh: "把资产运营目标、分案边界和复核升级收成同一条主线。",
          en: "Keep asset goals, allocation boundaries, and review escalation on one line.",
        },
        ownedOutcomes: {
          zh: ["明确资产运营目标", "决定高风险升级顺序"],
          en: ["Clarify asset operating goals", "Set high-risk escalation order"],
        },
        mainJudgements: {
          zh: ["当前目标是否需要调整"],
          en: ["Whether the current goal needs adjustment"],
        },
        handoffEdges: {
          zh: ["向主管交代策略边界"],
          en: ["Handoff strategy boundaries to supervisors"],
        },
        successSignals: {
          zh: ["关键升级没有漏掉"],
          en: ["Critical escalations do not slip"],
        },
        boundaryNotes: {
          zh: ["策略建议不等于自动执行"],
          en: ["Strategy advice is not automatic execution"],
        },
        matchers: ["资产运营负责人", "asset operations owner"],
      },
      {
        key: "TENANT_REVIEW_GATE",
        basePresetKey: "OPERATIONS_FINANCE",
        workspaceRole: "REVIEWER",
        roleCategory: "REVIEWER",
        label: "复核闸口",
        summary: "负责高风险动作复核。",
        matchers: ["复核", "review gate"],
      },
    ],
  },
});

describe("workspace role preset catalog", () => {
  it("keeps the default Helm role presets when workspace configuration has no catalog", () => {
    const options = listWorkspaceRolePresetOptions(null, "zh-CN");

    expect(options.map((option) => option.key)).toContain("GENERAL_OPERATOR");
    expect(options.map((option) => option.label)).toContain("通用运营成员");
  });

  it("uses a workspace catalog without leaking default presets into the option list", () => {
    const options = listWorkspaceRolePresetOptions(
      tenantCatalogConfiguration,
      "zh-CN",
    );

    expect(options.map((option) => option.key)).toEqual([
      "TENANT_ASSET_OPERATIONS_OWNER",
      "TENANT_REVIEW_GATE",
    ]);
    expect(options.map((option) => option.label)).toEqual([
      "资产运营负责人",
      "复核闸口",
    ]);
  });

  it("matches tenant role text to a tenant preset key", () => {
    expect(
      resolveWorkspaceRolePresetKey({
        rawConfiguration: tenantCatalogConfiguration,
        title: "资产运营负责人",
      }),
    ).toBe("TENANT_ASSET_OPERATIONS_OWNER");
  });

  it("fails closed for a built-in key when the workspace catalog is override-only", () => {
    expect(
      getWorkspaceRolePresetDefinition("GENERAL_OPERATOR", tenantCatalogConfiguration),
    ).toBeNull();
  });
});
