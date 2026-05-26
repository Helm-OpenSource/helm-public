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
});
