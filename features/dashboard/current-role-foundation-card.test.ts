import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CurrentRoleFoundationCard } from "@/features/dashboard/current-role-foundation-card";

const salesLeadDefinition = {
  version: 1 as const,
  locale: "zh-CN" as const,
  rolePresetKey: "SALES_LEAD" as const,
  roleLabel: "销售负责人",
  title: "销售负责人",
  mission: "把销售主线稳定推进到下一阶段，而不是只堆更多外联动作。",
  ownedOutcomes: ["推进关键机会到下一阶段"],
  mainJudgements: ["哪条机会最该先推"],
  handoffEdges: ["向创始人汇报关键判断和风险"],
  successSignals: ["主机会没有掉线"],
  boundaryNotes: ["草稿不等于已发送"],
  customNotes: null,
  sourceContext: {
    workspaceName: "Helm",
    workspaceProfileType: "销售负责人",
    focusAreas: ["客户跟进", "合作拓展"],
  },
};

describe("CurrentRoleFoundationCard", () => {
  it("renders the accepted-definition posture on dashboard", () => {
    const markup = renderToStaticMarkup(
      createElement(CurrentRoleFoundationCard, {
        locale: "zh-CN",
        workspace: {
          profileType: "销售负责人",
          focusAreas: JSON.stringify(["客户跟进", "合作拓展"]),
        },
        membership: {
          title: "销售负责人",
          persona: null,
          rolePresetKey: "SALES_LEAD",
          definitionDraftJson: null,
          definitionAcceptedJson: JSON.stringify(salesLeadDefinition),
        },
      }),
    );

    expect(markup).toContain("你的角色基础");
    expect(markup).toContain("已接受为当前定义");
    expect(markup).toContain("当前生效的工作定义");
    expect(markup).toContain("销售负责人");
    expect(markup).toContain("角色基础与初始技能建议");
    expect(markup).toContain("外部跟进草稿");
  });

  it("renders the draft-only posture before acceptance", () => {
    const markup = renderToStaticMarkup(
      createElement(CurrentRoleFoundationCard, {
        locale: "en-US",
        workspace: {
          profileType: "Sales lead",
          focusAreas: JSON.stringify(["Customer follow-up"]),
        },
        membership: {
          title: "Sales lead",
          persona: null,
          rolePresetKey: "SALES_LEAD",
          definitionDraftJson: JSON.stringify({
            ...salesLeadDefinition,
            locale: "en-US",
            roleLabel: "Sales lead",
            title: "Sales lead",
            mission:
              "Move the sales line to the next stage instead of piling on more outreach.",
            sourceContext: {
              workspaceName: "Helm",
              workspaceProfileType: "Sales lead",
              focusAreas: ["Customer follow-up"],
            },
          }),
          definitionAcceptedJson: null,
        },
      }),
    );

    expect(markup).toContain("Your role foundation");
    expect(markup).toContain("Draft definition only");
    expect(markup).toContain("Draft role definition waiting for acceptance");
    expect(markup).toContain("Role foundation and starter skills");
  });

  it("falls back to the current preset when no definition has been accepted yet", () => {
    const markup = renderToStaticMarkup(
      createElement(CurrentRoleFoundationCard, {
        locale: "en-US",
        workspace: {
          profileType: "Founder / COO",
          focusAreas: JSON.stringify(["Internal work"]),
        },
        membership: {
          title: "Founder / CEO",
          persona: null,
          rolePresetKey: "FOUNDER_CEO",
          definitionDraftJson: null,
          definitionAcceptedJson: null,
        },
      }),
    );

    expect(markup).toContain("Preset-led start");
    expect(markup).toContain("Preset-led starting point");
    expect(markup).toContain("Founder / CEO");
    expect(markup).toContain("Suggestion only");
    expect(markup).toContain("Approval review");
  });

  it("renders a workspace-specific role while using its built-in foundation", () => {
    const workspaceConfiguration = JSON.stringify({
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
              zh: "把资产运营目标收成同一条主线。",
              en: "Keep asset operating goals on one line.",
            },
            matchers: ["资产运营负责人"],
          },
        ],
      },
    });

    const markup = renderToStaticMarkup(
      createElement(CurrentRoleFoundationCard, {
        locale: "zh-CN",
        workspace: {
          profileType: "资产运营",
          focusAreas: JSON.stringify(["高风险升级"]),
          configuration: workspaceConfiguration,
        },
        membership: {
          title: "资产运营负责人",
          persona: null,
          rolePresetKey: "TENANT_ASSET_OPERATIONS_OWNER",
          definitionDraftJson: null,
          definitionAcceptedJson: null,
        },
      }),
    );

    expect(markup).toContain("资产运营负责人");
    expect(markup).toContain("基于预设的起点");
    expect(markup).toContain("角色基础与初始技能建议");
  });
});
