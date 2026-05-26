import { describe, expect, it } from "vitest";
import {
  findNarrativeComponentSpec,
  helmInformationHierarchy,
  narrativeComponentOrder,
  narrativeComponentSpecs,
  narrativeHierarchyReviewQuestions,
} from "@/lib/presentation/narrative-components";

describe("narrative components", () => {
  it("keeps the three-layer hierarchy stable", () => {
    expect(helmInformationHierarchy).toEqual([
      {
        layerId: "L1",
        title: "frontstage",
        label: "前台层",
        defaultContents: ["当前判断", "待决策", "下一步动作", "边界"],
      },
      {
        layerId: "L2",
        title: "midstage",
        label: "中间层",
        defaultContents: [
          "review snapshot",
          "prepared draft",
          "协作分工",
          "secondary summary",
        ],
      },
      {
        layerId: "L3",
        title: "backstage",
        label: "后台层",
        defaultContents: [
          "why it matters",
          "review / state semantics",
          "evidence",
          "replay",
          "audit",
          "worker reasoning",
        ],
      },
    ]);
  });

  it("pins the reusable narrative component set", () => {
    expect(narrativeComponentOrder).toEqual([
      "NarrativeHeader",
      "ReviewSnapshotBlock",
      "DecisionRequestCard",
      "CollaborationRequestCard",
      "ActionRail",
      "BoundaryNote",
      "WhyItMattersBlock",
      "WorkerSummary",
      "EvidenceChip",
      "EvidenceDrawer",
    ]);
    expect(narrativeComponentSpecs).toHaveLength(
      narrativeComponentOrder.length,
    );
    expect(findNarrativeComponentSpec("BoundaryNote")?.defaultLayer).toBe("L1");
    expect(findNarrativeComponentSpec("EvidenceDrawer")?.mustCollapseWhen).toContain(
      "默认折叠",
    );
    expect(findNarrativeComponentSpec("WorkerSummary")?.inputFields).toContain(
      "pageWorkerAssignments",
    );
    expect(findNarrativeComponentSpec("EvidenceDrawer")?.inputFields).toContain(
      "pageEvidenceGroups",
    );
    expect(findNarrativeComponentSpec("ReviewSnapshotBlock")?.defaultLayer).toBe(
      "L2",
    );
    expect(findNarrativeComponentSpec("WhyItMattersBlock")?.allowedInformationRange).toContain(
      "2-3 条关键理由",
    );
    expect(findNarrativeComponentSpec("EvidenceChip")?.forbiddenWhen).toContain(
      "变成主判断正文",
    );
  });

  it("keeps the six review questions visible for page refactors", () => {
    expect(narrativeHierarchyReviewQuestions).toEqual([
      "用户 30 秒内能否知道当前判断",
      "用户 30 秒内能否知道现在需要谁做什么",
      "用户 30 秒内能否直接执行下一步",
      "用户首屏是否只看到当前状态 / 待决策 / 下一步动作 / 边界",
      "系统解释默认是否折叠在中后台层",
      "用户需要核验时能否快速找到依据",
    ]);
  });
});
