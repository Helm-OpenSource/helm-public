import { describe, expect, it } from "vitest";
import { buildDetailOperatingSummaryConnections } from "@/components/shared/detail-operating-summary-card";
import {
  createCrossDetailHandoff,
  createUnifiedDetailNavigationModel,
} from "@/lib/presentation/unified-detail-navigation";

describe("detail operating summary card", () => {
  it("keeps the next-action connection from repeating the same CTA as description", () => {
    const navigation = createUnifiedDetailNavigationModel({
      currentNode: {
        detailNodeType: "contact-detail",
        detailNodeSummary: "赵敏关系详情需要继续收口。",
        detailNodeStage: "relationship review",
        detailNodeBoundary: "关系热度不能直接读成承诺。",
        detailNodeAudienceMode: "internal review",
        detailNodeSendabilityMode: null,
        detailNodeStrengthMode: null,
        detailNodePrev: null,
        detailNodeNext: {
          type: "sales-follow-up",
          href: "/sales-followups/test",
          label: "打开销售跟进",
          summary: "切到跟进详情继续推进。",
        },
        detailNodeCurrentReason: "当前应先确认关系动作。",
        detailNodePriority: "important",
        detailNodeNavigationHint: "先看当前关系判断，再切到跟进。",
      },
      handoffs: [
        createCrossDetailHandoff({
          handoffSource: "contact-detail",
          handoffTarget: "sales-follow-up",
          handoffReason: "当前账户路由已经够清楚，现在应该收窄到真正的关系负责人。",
          handoffBoundary:
            "联系人详情可以负责路由关系推进，但不能直接形成承诺。",
          handoffPrerequisite: null,
          handoffDependency: null,
          handoffRisk: "过早外发仍可能造成承诺误读。",
          handoffDecisionRequest:
            "确认赵敏现在是否应该切进跟进。",
          handoffNextAction: "打开销售跟进",
          handoffWorkerSummary: ["销售助手已整理跟进上下文。"],
          handoffEvidenceSummary: ["最近会议和记忆已经挂好。"],
          handoffVisibilityMode: "review-before-send",
          handoffHref: "/sales-followups/test",
        }),
      ],
    });

    const connections = buildDetailOperatingSummaryConnections({
      english: false,
      navigation,
      protocol: {
        pageNextAction: [
          { label: "打开销售跟进", href: "/sales-followups/test" },
        ],
        pageEvidenceLinks: [],
        pageEvidenceSummary: [],
        pageJudgementReason: "先确认关系动作是否足够安全，再进入跟进详情。",
      },
    });

    const nextAction = connections.find(
      (connection) => connection.label === "下一步动作",
    );

    expect(nextAction).toMatchObject({
      value: "打开销售跟进",
      description: "先确认关系动作是否足够安全，再进入跟进详情。",
    });
    expect(nextAction?.description).not.toBe(nextAction?.value);
  });
});
