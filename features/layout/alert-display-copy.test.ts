import { describe, expect, it } from "vitest";
import { formatShellAlertText } from "@/components/layout/alert-display-copy";

describe("shell alert display copy", () => {
  it("keeps existing English shell alerts unchanged", () => {
    const text = "Recommendations and today focus are ready.";

    expect(formatShellAlertText(text, true)).toBe(text);
  });

  it("converts persisted Chinese shell alerts for the English surface", () => {
    const display = formatShellAlertText(
      "策略建议已收敛到系统规则，meeting_followup 和 contact_followup 进入今日重点；blocker、deals、notes 和 recommendation 都需要复核。",
      true,
    );

    expect(display).toBe(
      "Follow-up rule updates have been folded into workspace rules, meeting follow-up and contact follow-up are in today focus; blockers, opportunities, notes, and recommendations need review.",
    );
    expect(display).not.toMatch(/[一-龥]|策略建议|系统规则|meeting_followup|contact_followup|\bblocker\b|\bdeals\b|\brecommendation\b/);
  });

  it("keeps Chinese shell alerts in manager-facing language", () => {
    const display = formatShellAlertText(
      "策略建议已收敛到系统规则，meeting_followup 和 contact_followup 进入 today focus；blocker、deals、notes 和 recommendation 都需要 review。",
      false,
    );

    expect(display).toContain("会后跟进规则已更新");
    expect(display).toContain("会后跟进");
    expect(display).toContain("关系跟进");
    expect(display).toContain("今日重点");
    expect(display).toContain("阻塞");
    expect(display).toContain("机会");
    expect(display).toContain("记录");
    expect(display).toContain("判断建议");
    expect(display).not.toMatch(/策略建议|系统规则|meeting_followup|contact_followup|blocker|deals|recommendation|today focus/i);
  });
});
