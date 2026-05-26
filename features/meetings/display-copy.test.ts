import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { formatMeetingDisplayText } from "@/features/meetings/display-copy";

describe("meeting display copy", () => {
  it("converts meeting implementation language for the Chinese surface", () => {
    const display = formatMeetingDisplayText(
      "Meeting OS wedge keeps panel briefing, review, blockers, recommendations, action pack, evidence refs, open questions, shadow boundary, commitment and boundary posture readable before follow-through.",
      false,
    );

    expect(display).toContain("会议推进切片");
    expect(display).toContain("面试小组简报");
    expect(display).toContain("复核");
    expect(display).toContain("阻塞");
    expect(display).toContain("判断建议");
    expect(display).toContain("行动包");
    expect(display).toContain("依据引用");
    expect(display).toContain("待确认问题");
    expect(display).toContain("影子写入边界");
    expect(display).toContain("承诺");
    expect(display).toContain("边界状态");
    expect(display).not.toMatch(
      /Meeting OS wedge|briefing|review|blocker|recommendation|action pack|evidence refs|open questions|shadow boundary|commitment|posture|follow-through/i,
    );
  });

  it("formats controlled runtime audit actions for Chinese meeting history", () => {
    expect(formatMeetingDisplayText("HELM_V2_OFFICIAL_WRITE_ACKNOWLEDGED", false)).toBe(
      "正式写入确认",
    );
    expect(formatMeetingDisplayText("HELM_V2_MEETING_RUNTIME_INGESTED", false)).toBe(
      "会议运行记录已接入",
    );
    expect(
      formatMeetingDisplayText(
        "Helm v2 ingested Acme Discovery 回顾 into the meeting-to-action runtime.",
        false,
      ),
    ).toBe("会议推进链路已接入：Acme Discovery 回顾。");
  });

  it("cleans persisted briefing snapshot wording on the Chinese surface", () => {
    const display = formatMeetingDisplayText(
      "当前阶段是 INTERNAL_SYNC。来源是 SYSTEM_INFERENCE。仍需关注的阻碍是：暂无明显阻碍。",
      false,
    );

    expect(display).toBe("当前阶段是 需内部协同。来源是 系统推断。仍需关注的阻塞是：暂无明显阻塞。");
  });

  it("cleans raw stage, risk and detail-routing terms on the Chinese surface", () => {
    const display = formatMeetingDisplayText(
      "当前阶段是 WAITING_THEM，风险是 HIGH。Contact 详情需要判断 review、walkthrough 还是 accountable conversation；Founder 接手面负责 follow-up 邮件。",
      false,
    );

    expect(display).toBe(
      "当前阶段是 等待对方，风险是 高风险。联系人详情需要判断 复核、走查 还是 可追踪沟通；创始人接手面负责 跟进邮件。",
    );
    expect(display).not.toMatch(/WAITING_THEM|HIGH|Contact 详情|review|walkthrough|accountable conversation|Founder 接手面|follow-up/i);
  });

  it("cleans persisted risk prompts before rendering meeting briefings", () => {
    const display = formatMeetingDisplayText(
      "如果会后 24 小时内没有结构化 follow-up，这个窗口会迅速冷下来。",
      false,
    );

    expect(display).toBe(
      "如果会后 24 小时内没有结构化跟进，这个窗口会迅速冷下来。",
    );
    expect(display).not.toContain("follow-up");
  });

  it("cleans related-meeting continuity before rendering Chinese meeting detail", () => {
    const display = formatMeetingDisplayText(
      "客户认可价值，但需要一封结构化 follow-up 帮 Vivian 带回财务评估。",
      false,
    );
    const detailSource = readFileSync(
      "features/meetings/meeting-detail-client.tsx",
      "utf8",
    );

    expect(display).toBe(
      "客户认可价值，但需要一封结构化跟进帮 Vivian 带回财务评估。",
    );
    expect(display).not.toContain("follow-up");
    expect(detailSource).toContain("text(meeting.note.previousConclusion)");
    expect(detailSource).toContain("text(meeting.note.relationshipSummary)");
    expect(detailSource).toContain("content={text(briefing.previousConclusion)}");
    expect(detailSource).toContain("content={text(briefing.relationshipSummary)}");
  });
});
