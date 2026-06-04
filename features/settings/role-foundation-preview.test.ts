import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RoleFoundationPreview } from "@/features/settings/role-foundation-preview";

describe("RoleFoundationPreview", () => {
  it("renders starter skill suggestions and candidate-only boundary copy", () => {
    const markup = renderToStaticMarkup(
      createElement(RoleFoundationPreview, {
        locale: "zh-CN",
        rolePresetKey: "SALES_LEAD",
        workspaceProfileType: "销售负责人",
        focusAreas: ["客户跟进", "合作拓展"],
      }),
    );

    expect(markup).toContain("角色基础与初始技能建议");
    expect(markup).toContain("外部跟进草稿");
    expect(markup).toContain("当前工作区贴合度");
    expect(markup).toContain("客户跟进");
    expect(markup).toContain("候选能力姿态");
    expect(markup).toContain("正式能力");
  });

  it("renders the fuller role foundation variant with main judgements", () => {
    const markup = renderToStaticMarkup(
      createElement(RoleFoundationPreview, {
        locale: "en-US",
        rolePresetKey: "FOUNDER_CEO",
        variant: "full",
        workspaceProfileType: "Consultant / Services",
        focusAreas: ["Internal work"],
      }),
    );

    expect(markup).toContain("Role foundation and starter skills");
    expect(markup).toContain("Current workspace fit");
    expect(markup).toContain("Main judgements");
    expect(markup).toContain("Approval review");
  });
});
