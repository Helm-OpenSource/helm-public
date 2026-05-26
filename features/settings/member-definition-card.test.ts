import { describe, expect, it } from "vitest";
import {
  resolveMemberDefinitionDisplayState,
} from "@/features/settings/member-definition-card";
import type { MemberDefinitionDraft } from "@/lib/definitions/member-definition";

const acceptedDefinition: MemberDefinitionDraft = {
  version: 1,
  locale: "zh-CN",
  rolePresetKey: "FOUNDER_CEO",
  roleLabel: "创始人 / CEO",
  title: "董事长",
  mission: "负责收拢经营主线。",
  ownedOutcomes: ["关键机会推进"],
  mainJudgements: ["先推动哪条主线"],
  handoffEdges: ["向团队拆分下一步"],
  successSignals: ["下一步清楚"],
  boundaryNotes: ["不自动承诺"],
  customNotes: null,
  sourceContext: {
    workspaceName: "Helm",
    workspaceProfileType: "创始人 / COO",
    focusAreas: ["客户跟进"],
  },
};

describe("resolveMemberDefinitionDisplayState", () => {
  it("shows a pending draft before the accepted definition when both exist and differ", () => {
    const draftDefinition: MemberDefinitionDraft = {
      ...acceptedDefinition,
      mission: "把客户跟进、招聘推进和合作拓展收成一个明确的下一步经营动作。",
      customNotes: "董事长需要优先看跨角色判断。",
    };

    const displayState = resolveMemberDefinitionDisplayState({
      acceptedDefinition,
      draftDefinition,
      acceptedJson: JSON.stringify(acceptedDefinition),
      draftJson: JSON.stringify(draftDefinition),
    });

    expect(displayState.status).toBe("pending-draft");
    expect(displayState.definition?.mission).toBe(draftDefinition.mission);
  });

  it("keeps the accepted definition active when the stored draft matches it", () => {
    const acceptedJson = JSON.stringify(acceptedDefinition);
    const displayState = resolveMemberDefinitionDisplayState({
      acceptedDefinition,
      draftDefinition: acceptedDefinition,
      acceptedJson,
      draftJson: acceptedJson,
    });

    expect(displayState.status).toBe("accepted");
    expect(displayState.definition?.mission).toBe(acceptedDefinition.mission);
  });

  it("shows draft-only state before anything has been accepted", () => {
    const displayState = resolveMemberDefinitionDisplayState({
      acceptedDefinition: null,
      draftDefinition: acceptedDefinition,
      acceptedJson: null,
      draftJson: JSON.stringify(acceptedDefinition),
    });

    expect(displayState.status).toBe("draft-only");
    expect(displayState.definition?.rolePresetKey).toBe("FOUNDER_CEO");
  });
});
