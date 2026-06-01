import { describe, expect, it } from "vitest";
import { buildInboxDetailPageModel } from "@/features/inbox-followup-review-request/detail-model";

const thread = {
  id: "thread-1",
  subject: "华东智造回复",
  counterpart: "赵敏",
  summary: "采购推进需要我方回复。",
  source: "gmail",
  status: "WAITING_US" as const,
  waitingOn: "us",
  shouldReply: true,
  updatedAt: new Date("2026-04-22T10:00:00.000Z"),
  contact: { id: "contact-1", name: "赵敏" },
  company: { id: "company-1", name: "华东智造" },
  opportunity: {
    id: "opportunity-1",
    title: "华东智造采购推进",
    type: "sales",
    riskLevel: "HIGH" as const,
    stage: "WAITING_THEM" as const,
    nextAction: "发送跟进邮件",
  },
  messages: [
    {
      id: "message-1",
      sender: "赵敏",
      senderEmail: "zhaomin@example.com",
      body: "请发下一步采购资料。",
      isInbound: true,
      sentAt: new Date("2026-04-22T09:00:00.000Z"),
    },
  ],
};

describe("buildInboxDetailPageModel", () => {
  it("keeps inbox detail protocol actions within the reporting density guard", () => {
    const model = buildInboxDetailPageModel({
      thread,
      english: false,
      hasReviewRequest: true,
    });

    expect(model.protocol.pageNextAction).toHaveLength(3);
    expect(model.protocol.pageNextAction.map((item) => item.label)).toEqual([
      "回到收件箱列表",
      "打开跟进详情",
      "从跟进详情打开复核请求",
    ]);
  });
});
