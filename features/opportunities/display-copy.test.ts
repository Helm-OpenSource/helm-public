import { describe, expect, it } from "vitest";
import { formatOpportunityDisplayText } from "@/features/opportunities/display-copy";

describe("opportunity display copy", () => {
  it("keeps English copy unchanged", () => {
    expect(
      formatOpportunityDisplayText(
        "Pipeline pressure enters proposal / package shaping with formal review.",
        true,
      ),
    ).toBe(
      "Pipeline pressure enters proposal / package shaping with formal review.",
    );
  });

  it("converts default Chinese opportunity surface terms into business language", () => {
	    const formatted = formatOpportunityDisplayText(
	      "pipeline pressure enters proposal / package-shaping with formal review, review-before-send, owner-focused slices, blocker, commitment, next action, Replay payload, flow, skill and governance notes.",
	      false,
	    );

    expect(formatted).toContain("机会压力");
    expect(formatted).toContain("方案/方案包整形");
    expect(formatted).toContain("正式复核");
	    expect(formatted).toContain("发送前复核");
	    expect(formatted).toContain("负责人视角");
	    expect(formatted).toContain("下一步动作");
	    expect(formatted).toContain("回放载荷");
	    expect(formatted).toContain("治理");
	    expect(formatted).not.toMatch(
	      /pipeline|formal review|review-before-send|owner-focused|blocker|commitment|next action|Replay payload|flow|skill|governance/i,
	    );
  });

  it("formats meeting runtime audit summaries before they reach opportunity evidence", () => {
    const formatted = formatOpportunityDisplayText(
	      "Helm v2 ingested 华东智造采购推进同步会 into the meeting-to-action runtime.",
      false,
    );

    expect(formatted).toBe("会议推进链路已接入：华东智造采购推进同步会。");
    expect(formatted).not.toMatch(/Helm v2 ingested|meeting-to-action runtime/i);
  });

  it("formats historical commercial seed terms before opportunity pages render", () => {
    const formatted = formatOpportunityDisplayText(
      "Atlas joint launch brief and shortlist context are ready.",
      false,
    );

    expect(formatted).toContain("Atlas 联合发布摘要");
    expect(formatted).toContain("候选名单");
    expect(formatted).not.toMatch(/joint launch brief|shortlist/i);
  });
});
