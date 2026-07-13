import { describe, expect, it } from "vitest";
import { buildMemberDefinitionDraft } from "@/lib/definitions/member-definition";
import { suggestRolePresetKeyFromText } from "@/lib/definitions/role-presets";

describe("member definition draft", () => {
  it("maps common role text into a stable role preset", () => {
    expect(suggestRolePresetKeyFromText("Founder / CEO")).toBe("FOUNDER_CEO");
    expect(suggestRolePresetKeyFromText("客户成功经理")).toBe("CUSTOMER_SUCCESS");
    expect(suggestRolePresetKeyFromText("")).toBe("GENERAL_OPERATOR");
  });

  it("builds a localized draft with workspace context", () => {
    const draft = buildMemberDefinitionDraft({
      locale: "zh-CN",
      workspaceName: "Helm",
      workspaceProfileType: "创始人 / COO",
      focusAreasJson: JSON.stringify(["客户跟进", "合作拓展"]),
      rolePresetKey: "SALES_LEAD",
      title: "销售负责人",
      customNotes: "这周先抓 top 3 accounts。",
    });

    expect(draft.rolePresetKey).toBe("SALES_LEAD");
    expect(draft.mission).toContain("当前工作区关注重点");
    expect(draft.mission).toContain("这周先抓 top 3 accounts");
    expect(draft.ownedOutcomes.length).toBeGreaterThan(0);
    expect(draft.boundaryNotes.some((item) => item.includes("承诺"))).toBe(true);
  });

  it("builds a bounded draft from a workspace-specific role preset", () => {
    const workspaceConfigurationJson = JSON.stringify({
      rolePresetCatalog: {
        includeDefaultPresets: false,
        presets: [
          {
            key: "TENANT_ASSET_OPERATIONS_OWNER",
            basePresetKey: "FOUNDER_CEO",
            label: {
              zh: "资产运营负责人",
              en: "Asset operations owner",
            },
            mission: {
              zh: "把资产运营目标、分案边界和复核升级收成同一条主线。",
              en: "Keep asset goals, allocation boundaries, and review escalation on one line.",
            },
            ownedOutcomes: {
              zh: Array.from({ length: 12 }, (_, index) => `经营结果 ${index + 1}`),
              en: Array.from({ length: 12 }, (_, index) => `Operating outcome ${index + 1}`),
            },
            matchers: ["资产运营负责人"],
          },
        ],
      },
    });

    const draft = buildMemberDefinitionDraft({
      locale: "zh-CN",
      workspaceName: "Synthetic workspace",
      workspaceProfileType: "资产运营",
      workspaceConfigurationJson,
      rolePresetKey: "TENANT_ASSET_OPERATIONS_OWNER",
      title: "资产运营负责人",
    });

    expect(draft.rolePresetKey).toBe("TENANT_ASSET_OPERATIONS_OWNER");
    expect(draft.roleLabel).toBe("资产运营负责人");
    expect(draft.mission).toContain("分案边界");
    expect(draft.ownedOutcomes).toHaveLength(8);
  });
});
