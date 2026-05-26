import { describe, expect, it } from "vitest";
import {
  formatApprovalLearningDisplayText,
  formatApprovalPolicyModeForReview,
} from "@/features/approvals/approval-learning-display";

describe("approval learning display adapter", () => {
  it("turns internal learning signal keys into review-friendly Chinese copy", () => {
    const display = formatApprovalLearningDisplayText(
      "系统观察到“contact_followup”更适合按 within_48h_preferred 的窗口推进。",
      false,
    );

    expect(display).toContain("从最近记录看");
    expect(display).toContain("关系跟进");
    expect(display).toContain("48 小时内优先跟进");
    expect(display).not.toMatch(/系统观察到|contact_followup|within_48h_preferred/);
  });

  it("keeps the policy mode readable without exposing threshold jargon", () => {
    expect(
      formatApprovalPolicyModeForReview({
        mode: "AUTO_WITHIN_THRESHOLD",
        modeLabel: "阈值内自动执行",
        english: false,
      }),
    ).toBe("条件内自动处理");
  });

  it("maps approval protocol wording into Chinese review language", () => {
    expect(
      formatApprovalLearningDisplayText(
        "Recommendation worker keeps the why-now explanation attached; replay and audit stay available for the owner.",
        false,
      ),
    ).toBe("判断建议协作者会保留时机说明; 回放和审计会继续留给负责人.");

    expect(
      formatApprovalLearningDisplayText(
        "Customer-visible language must remain review-before-send and non-commitment-only.",
        false,
      ),
    ).toBe("客户可见措辞必须保持发送前复核，并且不能形成承诺.");
  });

  it("localizes historical approval action titles", () => {
    const display = formatApprovalLearningDisplayText(
      "发送 Atlas 合作 brief and panel briefing stay in review.",
      false,
    );

    expect(display).toContain("发送 Atlas 合作摘要");
    expect(display).toContain("面试简报");
    expect(display).not.toMatch(/brief|briefing|panel/i);
  });

  it("localizes approval evidence enums before rendering the drawer", () => {
    const display = formatApprovalLearningDisplayText(
      "ActionItem is ADVANCING after INTERNAL_SYNC and CREATE_MEETING.",
      false,
    );

    expect(display).toContain("动作项");
    expect(display).toContain("推进中");
    expect(display).toContain("需内部协同");
    expect(display).toContain("创建会议");
    expect(display).not.toMatch(/ActionItem|ADVANCING|INTERNAL_SYNC|CREATE_MEETING/);
  });

  it("localizes approval preview owner wording before rendering evidence", () => {
    const display = formatApprovalLearningDisplayText(
      "新增内部协同 owner and customer-facing draft owner check.",
      false,
    );

    expect(display).toContain("负责人");
    expect(display).toContain("面向客户");
    expect(display).toContain("草稿");
    expect(display).not.toMatch(/\bowner\b|customer-facing|draft/i);
  });

  it("localizes worker resource capability sentences before rendering approvals", () => {
    const display = formatApprovalLearningDisplayText(
      "Write an internal review note into the review queue. Read boundary and policy context while shaping the review note.",
      false,
    );

    expect(display).toContain("把内部复核记录写入复核队列");
    expect(display).toContain("成形复核记录前先读取边界与策略上下文");
    expect(display).not.toMatch(/Write an internal|Read boundary|review queue|review note/i);
  });
});
