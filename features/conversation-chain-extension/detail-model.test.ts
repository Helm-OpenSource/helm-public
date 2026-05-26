import { describe, expect, it } from "vitest";
import { buildMeetingConversationChainExtensionModel } from "@/features/conversation-chain-extension/detail-model";

describe("conversation chain extension detail model", () => {
  it("formats seeded recruiting terms in Chinese meeting-chain summaries", () => {
    const model = buildMeetingConversationChainExtensionModel({
      english: false,
      stageLabels: {
        ADVANCING: "推进中",
      },
      meeting: {
        id: "meeting-1",
        title: "GreenPeak 职位推进同步",
        startsAt: new Date("2026-04-15T10:00:00.000Z"),
        company: { id: "company-1", name: "GreenPeak" },
        contacts: [{ id: "contact-1", name: "Teresa Wang", title: "HRBP" }],
        opportunity: {
          id: "opportunity-1",
          title: "GreenPeak VP Sales 搜寻",
          stage: "ADVANCING",
          riskLevel: "MEDIUM",
          nextAction: "确认 shortlist 和 panel briefing",
          company: { id: "company-1", name: "GreenPeak" },
        },
        note: {
          summary: "GreenPeak 希望在 48 小时内确认 shortlist。",
          keyDecisions: null,
          confirmations: null,
        },
        actionItems: [],
        memoryFacts: [],
        commitments: [],
        blockers: [],
        memoryEntries: [],
        briefingSnapshot: {
          payload: {
            summary:
              "GreenPeak 希望在 48 小时内确认 shortlist，并准备 panel briefing。",
          },
        },
      },
    });
    const rendered = JSON.stringify(model);

    expect(rendered).toContain("候选名单");
    expect(rendered).toContain("面试简报");
    expect(rendered).not.toMatch(/shortlist|panel briefing/i);
  });
});
