import { describe, expect, it } from "vitest";
import { generateOpportunitySignals, generateThreadAnalysis } from "@/lib/ai";

describe("AI suggestion helpers", () => {
  it("suggests internal sync risks clearly", () => {
    const signal = generateOpportunitySignals({
      type: "CLIENT",
      stage: "INTERNAL_SYNC",
      riskLevel: "HIGH",
      nextAction: "组织内部评审",
    });

    expect(signal.riskHints[0]).toContain("内部协同");
  });

  it("detects waiting-us thread state", () => {
    const analysis = generateThreadAnalysis({
      thread: {
        subject: "Acme ROI follow-up",
        status: "WAITING_US",
        waitingOn: "我方",
        opportunityId: "opp_1",
      },
      messages: [
        {
          body: "今天会后如果能把 ROI 框架发我，我可以尽快拉财务评估。",
          isInbound: true,
        },
      ],
      opportunity: {
        type: "CLIENT",
        stage: "ADVANCING",
        riskLevel: "MEDIUM",
        nextAction: "发送 ROI follow-up",
      },
    });

    expect(analysis.status).toContain("待我方动作");
    expect(analysis.waitingOn).toBe("我方");
  });
});
