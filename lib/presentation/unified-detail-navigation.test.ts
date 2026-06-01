import { describe, expect, it } from "vitest";
import {
  createCrossDetailHandoff,
  createUnifiedDetailNavigationModel,
  unifiedDetailNodeTypes,
} from "@/lib/presentation/unified-detail-navigation";

describe("unified detail navigation model", () => {
  it("keeps current node and cross-detail handoff semantics visible", () => {
    const model = createUnifiedDetailNavigationModel({
      currentNode: {
        detailNodeType: "external-proposal",
        detailNodeSummary: "当前 external proposal 已成形，可以切到 reinforcement judgement。",
        detailNodeStage: "review window",
        detailNodeBoundary: "当前仍需保留 non-commitment note 与 boundary cue。",
        detailNodeAudienceMode: "customer-facing with internal review",
        detailNodeSendabilityMode: "review before send",
        detailNodeStrengthMode: null,
        detailNodePrev: {
          type: "customer-facing-offer",
          href: "/offers/test",
          label: "Customer-facing offer detail",
          summary: "回退到更轻的对外表达层。",
        },
        detailNodeNext: {
          type: "reinforcement",
          href: "/reinforcements/test",
          label: "Reinforcement detail",
          summary: "进入 strengthening judgement。",
        },
        detailNodeCurrentReason:
          "当前不再只是 offer wording，而是更结构化的 external proposal judgement。",
        detailNodePriority: "important",
        detailNodeNavigationHint:
          "先看当前 judgement，再看 handoff reason，不要把它读成对象目录。",
      },
      handoffs: [
        createCrossDetailHandoff({
          handoffSource: "external-proposal",
          handoffTarget: "reinforcement",
          handoffReason:
            "当前已经到 reinforcement judgement 窗口，而不是继续原地补 proposal 文案。",
          handoffBoundary:
            "recommendation、discussion-only 和 boundary note 仍不等于 commitment。",
          handoffPrerequisite: "需要先确认当前 boundary note。",
          handoffDependency: "仍依赖 founder review。",
          handoffRisk: "强化 wording 仍可能被误解成 commitment。",
          handoffDecisionRequest: "确认是否进入 reinforcement detail。",
          handoffNextAction: "打开 reinforcement detail。",
          handoffWorkerSummary: ["sales worker 已整理 strengthening cue。"],
          handoffEvidenceSummary: ["replay / audit / boundary trace 已准备。"],
          handoffVisibilityMode: "review-before-send",
          handoffHref: "/reinforcements/test",
        }),
      ],
    });

    expect(model.currentNode.detailNodeType).toBe("external-proposal");
    expect(model.currentNode.detailNodeNext?.type).toBe("reinforcement");
    expect(model.handoffs[0]?.handoffBoundary).toContain("commitment");
  });

  it("requires at least one handoff and non-empty core fields", () => {
    expect(() =>
      createUnifiedDetailNavigationModel({
        currentNode: {
          detailNodeType: "proposal",
          detailNodeSummary: "",
          detailNodeStage: "exploration",
          detailNodeBoundary: "边界仍需保留。",
          detailNodeAudienceMode: "internal review",
          detailNodeSendabilityMode: null,
          detailNodeStrengthMode: null,
          detailNodePrev: null,
          detailNodeNext: null,
          detailNodeCurrentReason: "仍在 proposal framing。",
          detailNodePriority: "watch",
          detailNodeNavigationHint: "先别切页。",
        },
        handoffs: [],
      }),
    ).toThrow("detailNodeSummary must stay present");
  });

  it("keeps the expected commercial detail node families available", () => {
    for (const nodeType of [
      "proposal",
      "package",
      "package-stage-variants",
      "company-detail",
      "contact-detail",
      "meeting-detail",
      "customer-success",
      "success-check",
      "expansion-review",
      "inbox-detail",
      "follow-up-detail",
      "review-request-detail",
      "conversation",
      "founder-conversation",
      "founder-qa",
      "sales-conversation",
      "sales-objection",
      "sales-follow-up",
      "delivery-conversation",
      "delivery-walkthrough",
      "delivery-review",
      "customer-facing-offer",
      "external-proposal",
      "external-narrative",
      "narrative-fallback",
      "reinforcement",
      "sendability",
      "variants",
      "package-variants",
      "reinforcement-variants",
      "commercial-strengthening",
    ]) {
      expect(unifiedDetailNodeTypes).toContain(nodeType);
    }
  });
});
