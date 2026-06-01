import { describe, expect, it } from "vitest";
import {
  formatMemoryVisibleStatus,
  formatMemoryVisibleText,
} from "@/features/memory/display-copy";

describe("memory frontstage display copy", () => {
  it("keeps English copy unchanged", () => {
    expect(formatMemoryVisibleText("Open recommendation blocker runtime replay", true)).toBe(
      "Open recommendation blocker runtime replay",
    );
  });

  it("maps system terms to Chinese operating language", () => {
    const copy = formatMemoryVisibleText(
      "recommendation / blocker / commitment / runtime context / review-before-send",
      false,
    );

    expect(copy).toBe("判断建议 / 阻塞 / 承诺 / 运行上下文 / 发送前复核");
  });

  it("maps compound disclosure terms before single-word replacements", () => {
    const copy = formatMemoryVisibleText(
      "reflection carry-forward candidate stays review-safe and customer-visible",
      false,
    );

    expect(copy).toBe("复盘延续候选 stays 复核后可复用 and 客户可见");
    expect(copy).not.toContain("reflection");
    expect(copy).not.toContain("customer-visible");
  });

  it("keeps meeting-memory governance helper copy out of English review jargon", () => {
    const copy = formatMemoryVisibleText(
      "review posture / operating context / wording / grounded / behind review",
      false,
    );

    expect(copy).toBe("复核姿态 / 运营上下文 / 措辞 / 依据明确 / 复核后面");
    expect(copy).not.toMatch(/review|operating context|wording|grounded/i);
  });

  it("maps visible enum status values without changing English mode", () => {
    expect(formatMemoryVisibleStatus("PROMOTED", false)).toBe("已提升");
    expect(formatMemoryVisibleStatus("PROMOTED", true)).toBe("PROMOTED");
  });

  it("maps visible audit enum labels and object types to Chinese review language", () => {
    expect(formatMemoryVisibleText("RECOMMENDATION_GENERATED", false)).toBe(
      "生成判断建议",
    );
    expect(formatMemoryVisibleText("OPPORTUNITY", false)).toBe("机会");
    expect(formatMemoryVisibleText("MEETING_ACTION_ITEMS_GENERATED", false)).toBe(
      "生成会议后续动作",
    );
    expect(formatMemoryVisibleText("CONTENT_UPDATE", false)).toBe("内容更新");
    expect(formatMemoryVisibleText("HELM_V2_MEETING_RUNTIME_INGESTED", false)).toBe(
      "会议运行记录已接入",
    );
    expect(formatMemoryVisibleText("SYSTEM INFERENCE", false)).toBe("系统推断");
    expect(formatMemoryVisibleText("AUTH SESSION", false)).toBe("认证会话");
    expect(formatMemoryVisibleText('"status": "ACTIVE"', false)).toBe(
      '"status": "有效"',
    );
    expect(
      formatMemoryVisibleText(
        "Helm v2 ingested Acme Discovery 回顾 into the meeting-to-action runtime.",
        false,
      ),
    ).toBe("会议推进链路已接入：Acme Discovery 回顾。");
  });

  it("localizes historical meeting and recruiting seed terms", () => {
    const copy = formatMemoryVisibleText(
      "GreenPeak shortlist, finalist and panel briefing should be ready before launch.",
      false,
    );

    expect(copy).toContain("候选名单");
    expect(copy).toContain("终面候选人");
    expect(copy).toContain("面试简报");
    expect(copy).toContain("发布");
    expect(copy).not.toMatch(/shortlist|finalist|panel briefing|launch/i);
  });

  it("localizes audit replay source classes and adaptive evolution labels", () => {
    const copy = formatMemoryVisibleText(
      "SUGGESTION updated by Adaptive Evolution · SkillSuggestion. PREFERENCE SIGNAL FROM PATTERN · PreferenceSignal.",
      false,
    );

    expect(copy).toContain("建议");
    expect(copy).toContain("自适应演进");
    expect(copy).toContain("能力建议");
    expect(copy).toContain("偏好信号");
    expect(copy).toContain("来自模式沉淀");
    expect(copy).not.toMatch(/SUGGESTION|PREFERENCE SIGNAL|FROM PATTERN|Adaptive Evolution|SkillSuggestion|PreferenceSignal/);
  });
});
