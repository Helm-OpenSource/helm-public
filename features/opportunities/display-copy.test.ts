import { describe, expect, it } from "vitest";
import {
  formatOpportunityDisplayText,
  formatOpportunityProactiveFlow,
  formatOpportunityReportingProtocol,
} from "@/features/opportunities/display-copy";
import type { ProactiveFlow } from "@/lib/presentation/proactive-mechanism";
import type { PageReportingProtocol } from "@/lib/presentation/reporting-protocol";

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

  it("formats reporting protocol evidence without leaking raw system labels", () => {
    const protocol: PageReportingProtocol = {
      pageJudgement: "Pipeline pressure is high",
      pageJudgementReason:
        "Current blockers and commitments are attached to the recommendation.",
      pageWhyItMatters: ["Replay payload keeps evidence visible."],
      pageActionSummary: ["proposal / package window is active."],
      pageDecisionRequest: ["Use formal review before customer-facing wording."],
      pageNextAction: [{ label: "Open proposal page", href: "/proposals/1" }],
      pageBoundarySummary: ["review-before-send and non-commitment only."],
      pageEvidenceSummary: ["flow and skill remain traceable."],
      pageWorkerSummary: ["Sales worker prepares a follow-up draft."],
      pageEvidenceGroups: [
        {
          groupId: "replay_payload",
          label: "Replay payload",
          items: [
            {
              itemId: "replay-1",
              label: "Open opportunity replay",
              href: "/opportunities",
              summary: "blocker and commitment context",
            },
          ],
        },
      ],
    };

    const result = formatOpportunityReportingProtocol(protocol, false);
    const evidenceTarget = result.pageEvidenceGroups?.[0]?.items[0];
    const formatted = [
      result.pageJudgement,
      result.pageJudgementReason,
      ...result.pageWhyItMatters,
      ...result.pageActionSummary,
      ...result.pageDecisionRequest,
      ...result.pageNextAction.map((action) => action.label),
      ...result.pageBoundarySummary,
      ...result.pageEvidenceSummary,
      ...result.pageWorkerSummary,
      result.pageEvidenceGroups?.[0]?.label,
      typeof evidenceTarget === "string" ? evidenceTarget : evidenceTarget?.label,
      typeof evidenceTarget === "string"
        ? undefined
        : evidenceTarget?.summary,
    ]
      .filter(Boolean)
      .join("\n");

    expect(formatted).toContain("回放载荷");
    expect(formatted).toContain("查看机会回放");
    expect(formatted).toContain("正式复核");
    expect(formatted).not.toMatch(
      /pipeline|proposal|package|formal review|review-before-send|Replay payload|Open opportunity replay|blocker|commitment|flow|skill/i,
    );
  });

  it("formats proactive flow copy and action labels for Chinese surfaces", () => {
    const flow: ProactiveFlow = {
      flowId: "sales-delivery-package-window",
      flowTitle: "Sales / delivery package window",
      triggerCondition: "proposal / package-shaping requires formal review",
      activeReport: {
        activeReportType: "event",
        activeReportSummary: "proposal / package-shaping window",
        activeReportReason: "blocker and commitment context is attached",
        activeReportPriority: "operating",
        activeReportBoundary: ["customer-facing wording stays review-before-send"],
        activeReportWorkerSummary: ["Sales worker prepares follow-up framing."],
        activeReportEvidenceSummary: ["Replay memory stays available."],
        activeReportAudience: ["sales", "delivery"],
        activeReportDeliveryMode: "event-alert",
        activeReportPreparationSummary: ["Latest blocker and commitment attached."],
      },
      collaboration: {
        collaborationMode: "helm_drives_human_supervises",
        collaborationRequest:
          "sales and delivery supervise before customer-facing language hardens.",
        collaborationSummary: "package / proposal collaboration view",
        collaborationReason: "sales / delivery alignment is required.",
        collaborationBoundary: ["Final proposal promise stays with owners."],
        collaborationOwner: "Sales owner + delivery review",
        collaborationWorkerAssignment: ["Delivery worker keeps scope visible."],
        collaborationNextStep: ["Choose follow-up or internal clarification."],
      },
      helmCanDo: ["Keep package-shaping candidate ranked high."],
      helmSuggestsOnly: ["The final package wording."],
      humanDecisionRequired: ["Decide whether sales or delivery leads."],
      humanLeadRequired: ["Any customer-facing commitment."],
      nextActions: [{ label: "Open package page", href: "/packages/1" }],
    };

    const result = formatOpportunityProactiveFlow(flow, false);
    const formatted = [
      result.flowTitle,
      result.triggerCondition,
      result.activeReport.activeReportSummary,
      result.activeReport.activeReportReason,
      ...result.activeReport.activeReportBoundary,
      ...result.activeReport.activeReportWorkerSummary,
      ...result.activeReport.activeReportEvidenceSummary,
      ...result.activeReport.activeReportPreparationSummary,
      result.collaboration.collaborationRequest,
      result.collaboration.collaborationSummary,
      result.collaboration.collaborationReason,
      ...result.collaboration.collaborationBoundary,
      result.collaboration.collaborationOwner,
      ...result.collaboration.collaborationWorkerAssignment,
      ...result.collaboration.collaborationNextStep,
      ...result.helmCanDo,
      ...result.helmSuggestsOnly,
      ...result.humanDecisionRequired,
      ...result.humanLeadRequired,
      ...result.nextActions.map((action) => action.label),
    ].join("\n");

    expect(formatted).toContain("销售");
    expect(formatted).toContain("交付");
    expect(formatted).toContain("方案包页");
    expect(formatted).not.toMatch(
      /Sales|delivery|customer-facing|review-before-send|package page|proposal|blocker|commitment/i,
    );
  });
});
