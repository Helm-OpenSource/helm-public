import { describe, expect, it } from "vitest";
import {
  formatCaptureDisplayText,
  formatCaptureObjectType,
} from "@/features/conversation-capture/display-copy";

describe("conversation capture display copy", () => {
  it("converts capture implementation language for the Chinese surface", () => {
    const display = formatCaptureDisplayText(
      "Capture moves transcript-to-memory into recommendations, approvals, review, blocker handling, 阻碍 cleanup and candidate briefing without exposing fallback transcript wording.",
      false,
    );

    expect(display).toContain("现场记录");
    expect(display).toContain("转写到记忆");
    expect(display).toContain("建议");
    expect(display).toContain("审批");
    expect(display).toContain("复核");
    expect(display).toContain("阻塞");
    expect(display).toContain("候选人简报");
    expect(display).toContain("兜底转写");
    expect(display).not.toMatch(
      /capture|transcript|recommendation|approval|review|blocker|briefing|阻碍/i,
    );
  });

  it("maps captured fact type enums before they reach the Chinese result panel", () => {
    expect(formatCaptureDisplayText("NEXT_STEP", false)).toBe("下一步动作");
    expect(formatCaptureDisplayText("SUMMARY", false)).toBe("摘要");
    expect(formatCaptureDisplayText("OPEN", false)).toBe("待处理");
    expect(formatCaptureDisplayText("IN_PROGRESS", false)).toBe("推进中");
  });

  it("localizes shortlist and finalist wording in Chinese capture results", () => {
    const display = formatCaptureDisplayText(
      "shortlist sync moved the finalist into short... follow-up.",
      false,
    );

    expect(display).toContain("候选名单同步");
    expect(display).toContain("终面候选人");
    expect(display).toContain("候选名单");
    expect(display).not.toMatch(/shortlist|finalist|short\.\.\./i);
  });

  it("maps captured object type enums before they reach the result panel", () => {
    expect(formatCaptureObjectType("CONTACT", false)).toBe("联系人");
    expect(formatCaptureObjectType("COMPANY", false)).toBe("公司");
    expect(formatCaptureObjectType("OPPORTUNITY", false)).toBe("机会");
    expect(formatCaptureObjectType("meeting", false)).toBe("会议");
  });

  it("downgrades capture policy copy from automatic execution to governed routing", () => {
    const display = formatCaptureDisplayText(
      "按当前策略，这类动作可以在阈值内自动执行。建议先收口 blocker，再把后续动作送入审批或自动执行链路。",
      false,
    );

    expect(display).toContain("条件内准备");
    expect(display).toContain("受控路由链路");
    expect(display).not.toContain("阈值内自动执行");
    expect(display).not.toContain("自动执行链路");
  });
});
