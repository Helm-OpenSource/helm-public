import { describe, expect, it } from "vitest";
import {
  formatAnalyticsTechnicalKey,
  formatAnalyticsVisibleText,
} from "@/features/analytics/display-copy";

describe("analytics frontstage display copy", () => {
  it("keeps English mode unchanged", () => {
    expect(
      formatAnalyticsVisibleText("recommendation prompt workflow", true),
    ).toBe("recommendation prompt workflow");
  });

  it("maps seeded Chinese analytics labels back to English frontstage copy", () => {
    expect(
      formatAnalyticsVisibleText(
        "判断建议 / 阻塞 / 承诺 / 提示词 / 使用信号 / 工作回路",
        true,
      ),
    ).toBe("recommendation / blocker / commitment / prompt / usage signal / workflow");
    expect(formatAnalyticsTechnicalKey("现场采集_已打开", true)).toBe(
      "conversation capture opened",
    );
    expect(
      formatAnalyticsVisibleText(
        "智能服务 服务来源 试点 转写文本 · 智能服务已关闭",
        true,
      ),
    ).toBe("AI service provider pilot transcript · AI service disabled");
  });

  it("maps analytics system terms to Chinese operating language", () => {
    expect(
      formatAnalyticsVisibleText(
        "recommendation / blocker / commitment / prompt / telemetry / workflow",
        false,
      ),
    ).toBe("判断建议 / 阻塞 / 承诺 / 提示词 / 使用信号 / 工作回路");
  });

  it("turns snake-case event keys into readable Chinese-mode labels", () => {
    expect(
      formatAnalyticsTechnicalKey("recommendation_action_created", false),
    ).toBe("判断建议 动作 已创建");
    expect(formatAnalyticsTechnicalKey("today_focus_generated", false)).toBe(
      "今日重点 已生成",
    );
    expect(formatAnalyticsTechnicalKey("Workspace", false)).toBe("工作区");
    expect(formatAnalyticsTechnicalKey("page_view", false)).toBe("页面访问");
    expect(formatAnalyticsTechnicalKey("memory_timeline_viewed", false)).toBe(
      "记忆 时间线 已查看",
    );
    expect(formatAnalyticsTechnicalKey("EmailThread", false)).toBe("邮件会话");
    expect(formatAnalyticsTechnicalKey("meeting_briefing_viewed", false)).toBe(
      "会议简报 已查看",
    );
    expect(formatAnalyticsTechnicalKey("success_check_detail_opened", false)).toBe(
      "成功复盘 详情 已打开",
    );
    expect(formatAnalyticsTechnicalKey("inbox_detail_opened", false)).toBe(
      "收件箱 详情 已打开",
    );
    expect(
      formatAnalyticsTechnicalKey(
        "internal_operating_role_surface_opened",
        false,
      ),
    ).toBe("内部运营角色页 已打开");
    expect(formatAnalyticsTechnicalKey("COMPANY_BRIEFING", false)).toBe(
      "公司 简报",
    );
    expect(formatAnalyticsTechnicalKey("auth", false)).toBe("认证");
  });

  it("maps model and capture usage keys out of frontstage wording", () => {
    expect(formatAnalyticsTechnicalKey("llm_disabled", false)).toBe(
      "智能服务 已关闭",
    );
    expect(
      formatAnalyticsTechnicalKey("conversation_capture_opened", false),
    ).toBe("现场采集 已打开");
    expect(
      formatAnalyticsVisibleText("LLM provider pilot transcript", false),
    ).toBe("智能服务 服务来源 试点 转写文本");
    expect(formatAnalyticsVisibleText("object briefing", false)).toBe(
      "对象 简报",
    );
  });

  it("turns model-call details into operator-readable Chinese labels", () => {
    expect(
      formatAnalyticsVisibleText(
        "openai · gpt 4 1 mini · recommendation explanation · reasoning · json · LLM 被关闭",
        false,
      ),
    ).toBe(
      "智能服务 · 默认模型 · 判断建议 解释 · 推理 · 结构化输出 · 智能服务已关闭",
    );
  });
});
