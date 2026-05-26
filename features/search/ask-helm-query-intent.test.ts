import { describe, expect, it } from "vitest";
import { classifyAskHelmQueryIntent } from "@/features/search/ask-helm-query-intent";

describe("Ask Helm query intent classifier", () => {
  it("classifies supported object and memory queries", () => {
    expect(classifyAskHelmQueryIntent("找到和 Atlas 相关的机会")).toMatchObject({
      intentType: "object_search",
      primaryTarget: "search_results",
    });
    expect(classifyAskHelmQueryIntent("Atlas 最近有哪些互动")).toMatchObject({
      intentType: "object_recent",
      needsMemory: true,
      primaryTarget: "object_timeline",
    });
    expect(classifyAskHelmQueryIntent("这家公司目前推进到哪一步了")).toMatchObject({
      intentType: "current_status",
      needsObjectContext: true,
      needsMemory: true,
    });
  });

  it("classifies explanation, help and next-step queries", () => {
    expect(classifyAskHelmQueryIntent("为什么系统建议先做这条")).toMatchObject({
      intentType: "why_recommendation",
      needsSystemKnowledge: true,
    });
    expect(classifyAskHelmQueryIntent("审批和经营记忆的区别是什么")).toMatchObject({
      intentType: "definition_diff",
      primaryTarget: "definition_help",
    });
    expect(classifyAskHelmQueryIntent("这条事情下一步应该在哪个页面处理")).toMatchObject({
      intentType: "next_step_page",
      primaryTarget: "page_deep_link",
    });
  });

  it("separates high-risk, open-domain and cross-workspace denied asks", () => {
    expect(classifyAskHelmQueryIntent("帮我直接给客户发续约邮件")).toMatchObject({
      intentType: "review_required_execution",
      primaryTarget: "review_required_gate",
    });
    expect(classifyAskHelmQueryIntent("Summarize Tesla's latest earnings")).toMatchObject({
      intentType: "unsupported_open_domain",
      primaryTarget: "unsupported_domain_deny",
    });
    expect(
      classifyAskHelmQueryIntent("跨两个 workspace 比较一下哪个团队效率更高"),
    ).toMatchObject({
      intentType: "cross_workspace_denied",
      primaryTarget: "cross_workspace_deny",
    });
  });

  it("classifies normal action needs without opening write authority", () => {
    expect(classifyAskHelmQueryIntent("帮我把 Atlas 续约拆成三步")).toMatchObject({
      intentType: "plan_breakdown",
      primaryTarget: "action_plan",
    });
    expect(classifyAskHelmQueryIntent("准备一封给星河连锁的跟进邮件草稿")).toMatchObject({
      intentType: "prepare_draft",
      primaryTarget: "draft_artifact",
    });
    expect(classifyAskHelmQueryIntent("把这条加入内部跟进队列")).toMatchObject({
      intentType: "queue_internal_followup",
      primaryTarget: "internal_followup_queue",
    });
  });

  it("falls back to object search when the query still carries object cues", () => {
    const result = classifyAskHelmQueryIntent("Atlas 客户");

    expect(result.intentType).toBe("object_search");
    expect(result.matchedRule).toBe("object_cue_fallback");
    expect(result.confidence).toBe("medium");
  });

  it("classifies upward business signal submissions", () => {
    expect(classifyAskHelmQueryIntent("我要上报一个经营信号")).toMatchObject({
      intentType: "submit_business_signal",
      primaryTarget: "signal_intake_form",
    });
    expect(classifyAskHelmQueryIntent("反馈一个客户风险")).toMatchObject({
      intentType: "submit_business_signal",
    });
    expect(classifyAskHelmQueryIntent("客户在等我们的回复")).toMatchObject({
      intentType: "submit_business_signal",
    });
    expect(classifyAskHelmQueryIntent("发现一个交付阻塞")).toMatchObject({
      intentType: "submit_business_signal",
    });
    expect(
      classifyAskHelmQueryIntent("Want to report a customer risk on this opportunity"),
    ).toMatchObject({
      intentType: "submit_business_signal",
    });
  });

  it("falls back to a safe read-only business intent when the query has work cues but no rule matches", () => {
    const result = classifyAskHelmQueryIntent("这条续约现在进展到哪里了");

    expect(result.intentType).toBe("current_status");
    expect(result.matchedRule).toBe("work_context_cue_fallback");
    expect(result.confidence).toBe("medium");
  });

  it("denies open-domain and chitchat without falling into generic out_of_scope", () => {
    expect(classifyAskHelmQueryIntent("讲个笑话给我听")).toMatchObject({
      intentType: "unsupported_chitchat",
      primaryTarget: "unsupported_chitchat_deny",
    });
    expect(classifyAskHelmQueryIntent("Hi")).toMatchObject({
      intentType: "unsupported_chitchat",
    });
    expect(classifyAskHelmQueryIntent("今天上海的天气怎么样")).toMatchObject({
      intentType: "unsupported_open_domain",
    });
    expect(classifyAskHelmQueryIntent("推荐一道家常菜的菜谱")).toMatchObject({
      intentType: "unsupported_open_domain",
    });
    expect(classifyAskHelmQueryIntent("最近 Netflix 上有什么新电影")).toMatchObject({
      intentType: "unsupported_open_domain",
    });
  });
});
