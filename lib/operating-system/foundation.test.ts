import { AccessState, WorkspaceRole } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  buildDetailOperatingFoundationSummary,
  buildWorkspaceOperatingFoundationSummary,
} from "@/lib/operating-system/foundation";

describe("operating foundation", () => {
  it("keeps workspace operating truth grounded in constitution, role, memory, and campaign layers", () => {
    const summary = buildWorkspaceOperatingFoundationSummary({
      locale: "zh-CN",
      workspaceName: "Helm 内部经营 Demo",
      membershipRole: WorkspaceRole.OWNER,
      accessState: AccessState.TRIALING,
      profileType: "创始人 / COO",
      focusAreasJson: JSON.stringify(["合作拓展", "招聘推进", "客户跟进"]),
      topJudgements: [
        "先推进最热的合作机会",
        "把高风险审批留在 review 前台",
        "让 Helm 团队继续在 Helm 上经营 Helm",
      ],
      topPriorityHref: "/operating",
      currentPage: "operating",
    });

    expect(summary.items).toHaveLength(4);
    expect(summary.items[0]?.value).toContain("建议不等于承诺");
    expect(summary.items[1]?.value).toContain("组织所有者");
    expect(summary.items[2]?.value).toContain("回放");
    expect(summary.items[3]?.value).toContain("当前主战役");
    expect(summary.connections.some((item) => item.href === "/operating")).toBe(true);
    expect(summary.note).toContain("不是完整战略平台");
    expect(JSON.stringify(summary)).not.toMatch(/recommendation|commitment|workspace|workflow engine|Memory|Constitution/);
  });

  it("keeps detail operating truth tied to audience, evidence, and next handoff", () => {
    const summary = buildDetailOperatingFoundationSummary({
      english: false,
      navigation: {
        currentNode: {
          detailNodeType: "sales-conversation",
          detailNodeSummary: "当前客户表达仍在销售推进链中",
          detailNodeStage: "待推进",
          detailNodeBoundary: "对外措辞仍需 review-before-send。",
          detailNodeAudienceMode: "customer-facing-with-boundary",
          detailNodeSendabilityMode: "需审批",
          detailNodeStrengthMode: null,
          detailNodePrev: null,
          detailNodeNext: {
            type: "external-proposal",
            href: "/external-proposals/1",
            label: "外部表达 detail",
            summary: "把可发送表达继续压到 boundary 内。",
          },
          detailNodeCurrentReason: "这条 detail 当前承接的是销售推进后的外部表达判断。",
          detailNodePriority: "urgent",
          detailNodeNavigationHint: "先确认当前对外表达还能不能继续推进。",
        },
        handoffs: [
          {
            handoffSource: "sales-conversation",
            handoffTarget: "external-proposal",
            handoffReason: "需要把销售推进转成更安全的外部表达。",
            handoffBoundary: "发送前仍需明确 boundary 和 non-commitment。",
            handoffPrerequisite: null,
            handoffDependency: null,
            handoffRisk: "外部表达会直接影响客户预期。",
            handoffDecisionRequest: "确认这一步是否进入外部表达。",
            handoffNextAction: "继续查看外部表达 detail。",
            handoffWorkerSummary: ["Helm 已经准备好外部表达的 worker summary。"],
            handoffEvidenceSummary: ["当前 evidence 仍来自对话链和边界 trace。"],
            handoffVisibilityMode: "review-before-send",
            handoffHref: "/external-proposals/1",
          },
        ],
      },
    });

    expect(summary.items).toHaveLength(4);
    expect(summary.items[1]?.value).toContain("销售负责人");
    expect(summary.items[2]?.value).toContain("证据");
    expect(summary.items[3]?.value).toContain("主战役");
    expect(summary.connections[0]?.href).toBe("/external-proposals/1");
  });
});
