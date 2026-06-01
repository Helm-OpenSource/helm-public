import { describe, expect, it } from "vitest";
import {
  formatRoleDetailDisplayText,
  formatRoleDetailEvidenceGroups,
  formatRoleDetailPageProtocol,
} from "@/lib/presentation/role-detail-display-copy";

describe("formatRoleDetailDisplayText", () => {
  it("keeps English detail copy unchanged", () => {
    expect(
      formatRoleDetailDisplayText(
        "Review request detail keeps customer success handoff visible.",
        true,
      ),
    ).toBe("Review request detail keeps customer success handoff visible.");
  });

  it("converts shared detail system language for Chinese surfaces", () => {
    const display = formatRoleDetailDisplayText(
      "Review request detail keeps customer success handoff, blocker, review trace, readiness and non-commitment visible.",
      false,
    );

    expect(display).toBe(
      "复核请求详情 keeps 客户成功接手, 阻塞, 复核记录, 就绪判断 and 非承诺 visible.",
    );
    expect(display).not.toMatch(
      /Review request|customer success|blocker|review trace|readiness|non-commitment/i,
    );
  });

  it("converts recommendation language for object and review detail surfaces", () => {
    const display = formatRoleDetailDisplayText(
      "Current recommendation still depends on recommendation fact and commitments.",
      false,
    );

    expect(display).toBe("Current 建议 still depends on 建议事实 and 承诺.");
    expect(display).not.toMatch(/recommendation/i);
  });

  it("converts send safety and next-action machine labels for Chinese detail pages", () => {
    const display = formatRoleDetailDisplayText(
      "ATTENTION: NEXT ACTION stays INTERNAL_SYNC, review-before-send / human-review-required posture and never becomes safe-to-send by default.",
      false,
    );

    expect(display).toContain("注意事项");
    expect(display).toContain("下一步动作");
    expect(display).toContain("需内部协同");
    expect(display).toContain("需要人工复核");
    expect(display).toContain("可安全外发");
    expect(display).not.toMatch(
      /ATTENTION|NEXT ACTION|INTERNAL_SYNC|human-review-required|safe-to-send|posture/i,
    );
  });

  it("converts recommendation action enums and action-item wording before detail rendering", () => {
    const display = formatRoleDetailDisplayText(
      "DRAFT_EXTERNAL_EMAIL 未配置策略，默认进入逐条审批。若不立即记录 action item 会继续拖慢推进。",
      false,
    );

    expect(display).toContain("起草外发邮件");
    expect(display).toContain("动作项");
    expect(display).not.toMatch(/DRAFT_EXTERNAL_EMAIL|action item/i);
  });

  it("converts raw stage and risk tags in unified detail chains", () => {
    const display = formatRoleDetailDisplayText(
      "当前阶段是 WAITING_THEM。星河连锁会议链路 · HIGH；基于采购推进会生成一封结构化 跟进 邮件。",
      false,
    );

    expect(display).toBe(
      "当前阶段是 等待对方。星河连锁会议链路 · 高风险；基于采购推进会生成一封结构化 跟进邮件。",
    );
    expect(display).not.toMatch(/WAITING_THEM|HIGH|跟进 邮件/);
  });

  it("converts seeded business terms shared by detail routes", () => {
    const display = formatRoleDetailDisplayText(
      "Daniel 是内部 champion。GreenPeak shortlist sync needs panel briefing, and Atlas joint launch brief should not leak as raw demo copy.",
      false,
    );

    expect(display).toContain("内部支持人");
    expect(display).toContain("候选名单");
    expect(display).toContain("面试简报");
    expect(display).toContain("联合发布摘要");
    expect(display).not.toMatch(
      /champion|shortlist|panel briefing|joint launch|brief/i,
    );
  });

  it("converts evidence-layer terms in expanded Chinese detail drawers", () => {
    const display = formatRoleDetailDisplayText(
      "replay, audit, worker output, boundary trace, sendability trace, handoff trace and historical changes support the next judgement and proposal shaping review bundle.",
      false,
    );

    expect(display).toContain("回放");
    expect(display).toContain("审计");
    expect(display).toContain("协作产出");
    expect(display).toContain("边界记录");
    expect(display).toContain("发送边界记录");
    expect(display).toContain("交接记录");
    expect(display).toContain("历史变化");
    expect(display).toContain("判断");
    expect(display).toContain("方案成形复核");
    expect(display).not.toMatch(
      /replay|audit|worker output|trace|historical changes|judgement|shaping|bundle/i,
    );
  });

  it("converts commercial detail protocol copy for Chinese surfaces", () => {
    const display = formatRoleDetailPageProtocol(
      {
        pageJudgement:
          "Keep customer-facing offer wording in review-before-send sendability.",
        pageJudgementReason:
          "The briefing shows sales worker output, package boundary and draft pressure.",
        pageWhyItMatters: [
          "External proposal reinforcement can still outrun scope and timing certainty.",
        ],
        pageActionSummary: [
          "Review gate, send gate, customer-facing wording and internal-only note stay separated.",
        ],
        pageDecisionRequest: [
          "Confirm whether the next follow-up drafting move stays recommendation-only.",
        ],
        pageNextAction: [{ label: "Open customer-facing offer detail", href: "/offers/test" }],
        pageBoundarySummary: [
          "Recommendation-only draft does not equal contract promise.",
        ],
        pageEvidenceSummary: [
          "briefing, sendability trace and delivery worker output stay in evidence.",
        ],
        pageWorkerSummary: [
          "founder, sales and delivery keep outward narrative fallback visible.",
        ],
      },
      false,
    );

    expect(display.pageJudgement).toContain("面向客户报价");
    expect(display.pageJudgement).toContain("发送前复核");
    expect(display.pageJudgementReason).toContain("简报");
    expect(display.pageJudgementReason).toContain("销售协作者");
    expect(display.pageDecisionRequest[0]).toContain("仅建议");
    expect(display.pageBoundarySummary[0]).toContain("合同承诺");
    expect(display.pageNextAction[0]?.label).toContain("面向客户报价");
    expect(
      [
        display.pageJudgement,
        display.pageJudgementReason,
        ...display.pageWhyItMatters,
        ...display.pageActionSummary,
        ...display.pageDecisionRequest,
        ...display.pageBoundarySummary,
        ...display.pageEvidenceSummary,
        ...display.pageWorkerSummary,
        display.pageNextAction[0]?.label ?? "",
      ].join(" "),
    ).not.toMatch(
      /customer-facing|review-before-send|sendability|briefing|sales worker|draft pressure|external proposal|scope|timing|certainty|review gate|send gate|internal-only|follow-up drafting|recommendation-only|contract promise|delivery worker|outward narrative|fallback/i,
    );
  });

  it("converts dynamic commercial route labels and evidence groups", () => {
    const display = formatRoleDetailDisplayText(
      "Open package variants, package stage, sendability, reinforcement variants, commercial strengthening and external narrative detail.",
      false,
    );
    const groups = formatRoleDetailEvidenceGroups(
      [
        {
          groupId: "route-copy",
          label: "customer-visible strengthening cue",
          items: [
            "sales follow-up and delivery walkthrough must keep non-commitment fallback visible.",
          ],
        },
      ],
      false,
    );

    expect(display).toContain("方案包");
    expect(display).toContain("发送边界");
    expect(display).toContain("强化表达");
    expect(display).toContain("对外叙事");
    expect(groups[0]?.label).toContain("客户可见");
    expect(groups[0]?.items[0]).toContain("非承诺");
    expect(`${display} ${groups[0]?.label} ${groups[0]?.items[0]}`).not.toMatch(
      /package variants|package stage|sendability|reinforcement variants|commercial strengthening|external narrative|customer-visible strengthening|sales follow-up|delivery walkthrough|non-commitment fallback/i,
    );
  });
});
