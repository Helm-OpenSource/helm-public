import { describe, expect, it } from "vitest";
import {
  createPageReportingProtocol,
  reportingDensityLimits,
  reportingEvidenceSections,
  reportingPageLayers,
  reportingPageSkeleton,
  reportingPrimarySections,
  reportingSecondarySections,
  summarizePageReportingProtocol,
} from "@/lib/presentation/reporting-protocol";

describe("reporting protocol", () => {
  it("keeps the decision-first section taxonomy stable", () => {
    expect(reportingPrimarySections).toEqual([
      "pageJudgement",
      "pageJudgementReason",
      "pageDecisionRequest",
      "pageNextAction",
      "pageBoundarySummary",
      "pageEscalationHint",
    ]);
    expect(reportingSecondarySections).toEqual([
      "pageActionSummary",
      "pagePrioritySignal",
      "pageWorkerSummary",
      "pageWorkerAssignments",
      "pageReviewState",
    ]);
    expect(reportingEvidenceSections).toEqual([
      "pageWhyItMatters",
      "pageEvidenceSummary",
      "pageEvidenceLinks",
      "pageEvidenceGroups",
    ]);
    expect(reportingPageLayers).toEqual([
      {
        layerId: "L1",
        title: "frontstage",
        sections: [
          "pageJudgement",
          "pageJudgementReason",
          "pageDecisionRequest",
          "pageNextAction",
          "pageBoundarySummary",
          "pageEscalationHint",
        ],
      },
      {
        layerId: "L2",
        title: "midstage",
        sections: [
          "pageActionSummary",
          "pagePrioritySignal",
          "pageWorkerSummary",
          "pageWorkerAssignments",
          "pageReviewState",
        ],
      },
      {
        layerId: "L3",
        title: "backstage",
        sections: [
          "pageWhyItMatters",
          "pageEvidenceSummary",
          "pageEvidenceLinks",
          "pageEvidenceGroups",
        ],
      },
    ]);
    expect(reportingPageSkeleton).toEqual([
      "narrativeHeader",
      "currentSummaryCard",
      "decisionRequestCard",
      "actionRail",
      "boundaryNote",
      "reviewSnapshotBlock",
      "whyItMattersBlock",
      "workerSummary",
      "evidenceDrawer",
    ]);
    expect(reportingDensityLimits).toEqual({
      firstScreenBlockMax: 4,
      whyItMattersMin: 2,
      whyItMattersMax: 3,
      reviewSnapshotMax: 5,
      decisionRequestMax: 3,
      nextActionMax: 3,
      nextActionPrimaryCount: 1,
      nextActionSecondaryMax: 2,
      boundaryMax: 3,
    });
  });

  it("summarizes a page protocol without altering the payload", () => {
    const protocol = createPageReportingProtocol({
      pageJudgement: "Helm already knows what matters first.",
      pageJudgementReason: "The system is prioritizing by real operating drag.",
      pageWhyItMatters: [
        "A live window is already open.",
        "The owner can decide without rescanning raw rows.",
      ],
      pageActionSummary: ["Ranked the live queue", "Prepared evidence"],
      pageDecisionRequest: ["Choose the first move"],
      pageNextAction: [{ label: "Open queue", href: "/opportunities" }],
      pageBoundarySummary: ["High-risk actions still require approval"],
      pageEvidenceSummary: ["3 memory facts are driving the order"],
      pageWorkerSummary: ["Sales worker prepared the current move order"],
      pageWorkerAssignments: [
        {
          assignmentId: "sales-assistant-worker",
          title: "Sales Assistant Worker",
          summary: "follow-up drafting is currently staged as customer-safe draft outputs.",
          items: ["Review path stays review-before-send."],
          chips: ["review-before-send"],
        },
      ],
      pageEvidenceLinks: [{ label: "Open memory", href: "/memory" }],
      pageEvidenceGroups: [
        {
          groupId: "contract_flows",
          label: "Contract flows",
          items: [
            {
              itemId: "sales-followup-contract-flow",
              label: "Open follow-up contract flow",
              href: "/opportunities?opportunityId=opp_123",
              summary:
                "Sales follow-up draft path keeps the worker on drafting.",
            },
          ],
        },
      ],
      pageEscalationHint: "Escalate if trust boundary is still unclear.",
      pagePrioritySignal: "Cooling momentum is the dominant signal.",
    });

    expect(protocol.pageJudgement).toContain("Helm");
    expect(summarizePageReportingProtocol(protocol)).toEqual({
      whyCount: 2,
      actionCount: 2,
      decisionCount: 1,
      nextActionCount: 1,
      boundaryCount: 1,
      evidenceCount: 1,
      workerCount: 1,
      workerAssignmentCount: 1,
      drilldownCount: 1,
      evidenceGroupCount: 1,
      reviewState: "prepared",
    });
  });

  it("rejects page payloads that overflow first-screen density limits", () => {
    expect(() =>
      createPageReportingProtocol({
        pageJudgement: "Helm already knows what matters first.",
        pageJudgementReason: "The system is prioritizing by real operating drag.",
        pageWhyItMatters: ["one", "two"],
        pageActionSummary: ["Ranked the live queue"],
        pageDecisionRequest: ["Choose the first move"],
        pageNextAction: [{ label: "Open queue", href: "/opportunities" }],
        pageBoundarySummary: ["High-risk actions still require approval"],
        pageEvidenceSummary: ["3 memory facts are driving the order"],
        pageWorkerSummary: ["Sales worker prepared the current move order"],
        pageEscalationHint:
          "Escalation should merge into the shared boundary block instead of widening the first screen.",
      }),
    ).not.toThrow();

    expect(() =>
      createPageReportingProtocol({
        pageJudgement: "Helm already knows what matters first.",
        pageJudgementReason: "The system is prioritizing by real operating drag.",
        pageWhyItMatters: ["one", "two"],
        pageActionSummary: Array.from({ length: 6 }, (_, index) => `action ${index}`),
        pageDecisionRequest: ["Choose the first move"],
        pageNextAction: [{ label: "Open queue", href: "/opportunities" }],
        pageBoundarySummary: ["High-risk actions still require approval"],
        pageEvidenceSummary: ["3 memory facts are driving the order"],
        pageWorkerSummary: ["Sales worker prepared the current move order"],
      }),
    ).toThrow("pageActionSummary cannot exceed 5 items");

    expect(() =>
      createPageReportingProtocol({
        pageJudgement: "Helm already knows what matters first.",
        pageJudgementReason: "The system is prioritizing by real operating drag.",
        pageWhyItMatters: ["one", "two"],
        pageActionSummary: ["Ranked the live queue"],
        pageDecisionRequest: ["one", "two", "three", "four"],
        pageNextAction: [{ label: "Open queue", href: "/opportunities" }],
        pageBoundarySummary: ["High-risk actions still require approval"],
        pageEvidenceSummary: ["3 memory facts are driving the order"],
        pageWorkerSummary: ["Sales worker prepared the current move order"],
      }),
    ).toThrow("pageDecisionRequest cannot exceed 3 items");

    expect(() =>
      createPageReportingProtocol({
        pageJudgement: "Helm already knows what matters first.",
        pageJudgementReason: "The system is prioritizing by real operating drag.",
        pageWhyItMatters: ["one", "two"],
        pageActionSummary: ["Ranked the live queue"],
        pageDecisionRequest: ["Choose the first move"],
        pageNextAction: [
          { label: "A", href: "/a" },
          { label: "B", href: "/b" },
          { label: "C", href: "/c" },
          { label: "D", href: "/d" },
        ],
        pageBoundarySummary: ["High-risk actions still require approval"],
        pageEvidenceSummary: ["3 memory facts are driving the order"],
        pageWorkerSummary: ["Sales worker prepared the current move order"],
      }),
    ).toThrow("pageNextAction cannot exceed 3 items");

    expect(() =>
      createPageReportingProtocol({
        pageJudgement: "Helm already knows what matters first.",
        pageJudgementReason: "The system is prioritizing by real operating drag.",
        pageWhyItMatters: ["one", "two"],
        pageActionSummary: ["Ranked the live queue"],
        pageDecisionRequest: ["Choose the first move"],
        pageNextAction: [{ label: "Open queue", href: "/opportunities" }],
        pageBoundarySummary: ["one", "two", "three", "four"],
        pageEvidenceSummary: ["3 memory facts are driving the order"],
        pageWorkerSummary: ["Sales worker prepared the current move order"],
      }),
    ).toThrow("pageBoundarySummary cannot exceed 3 items");

    expect(() =>
      createPageReportingProtocol({
        pageJudgement: "Helm already knows what matters first.",
        pageJudgementReason: "The system is prioritizing by real operating drag.",
        pageWhyItMatters: ["one", "two"],
        pageActionSummary: ["Ranked the live queue"],
        pageDecisionRequest: ["Choose the first move"],
        pageNextAction: [
          { label: "A", href: "/a", variant: "secondary" },
          { label: "B", href: "/b", variant: "ghost" },
        ],
        pageBoundarySummary: ["High-risk actions still require approval"],
        pageEvidenceSummary: ["3 memory facts are driving the order"],
        pageWorkerSummary: ["Sales worker prepared the current move order"],
      }),
    ).toThrow("pageNextAction must keep exactly 1 primary action");

    expect(() =>
      createPageReportingProtocol({
        pageJudgement: "Helm already knows what matters first.",
        pageJudgementReason: "The system is prioritizing by real operating drag.",
        pageWhyItMatters: ["one", "two"],
        pageActionSummary: ["Ranked the live queue"],
        pageDecisionRequest: ["Choose the first move"],
        pageNextAction: [
          { label: "A", href: "/a" },
          { label: "B", href: "/b", variant: "secondary" },
          { label: "C", href: "/c", variant: "secondary" },
          { label: "D", href: "/d", variant: "ghost" },
        ],
        pageBoundarySummary: ["High-risk actions still require approval"],
        pageEvidenceSummary: ["3 memory facts are driving the order"],
        pageWorkerSummary: ["Sales worker prepared the current move order"],
      }),
    ).toThrow("pageNextAction cannot exceed 3 items");

    expect(() =>
      createPageReportingProtocol({
        pageJudgement: "Helm already knows what matters first.",
        pageJudgementReason: "The system is prioritizing by real operating drag.",
        pageWhyItMatters: ["one", "two", "three", "four"],
        pageActionSummary: ["Ranked the live queue"],
        pageDecisionRequest: ["Choose the first move"],
        pageNextAction: [{ label: "Open queue", href: "/opportunities" }],
        pageBoundarySummary: ["High-risk actions still require approval"],
        pageEvidenceSummary: ["3 memory facts are driving the order"],
        pageWorkerSummary: ["Sales worker prepared the current move order"],
      }),
    ).toThrow("pageWhyItMatters must keep 2 to 3 items");

    expect(() =>
      createPageReportingProtocol({
        pageJudgement: "Helm already knows what matters first.",
        pageJudgementReason: "The system is prioritizing by real operating drag.",
        pageWhyItMatters: ["one", "two"],
        pageActionSummary: ["Ranked the live queue"],
        pageDecisionRequest: ["Choose the first move"],
        pageNextAction: [{ label: "Open queue", href: "/opportunities" }],
        pageBoundarySummary: ["High-risk actions still require approval"],
        pageEvidenceSummary: ["3 memory facts are driving the order"],
        pageWorkerSummary: ["Sales worker prepared the current move order"],
        pageWorkerAssignments: [
          {
            assignmentId: "sales-assistant-worker",
            title: "",
            summary: "review path",
            items: ["detail"],
          },
        ],
      }),
    ).toThrow("pageWorkerAssignments must keep a visible title");

    expect(() =>
      createPageReportingProtocol({
        pageJudgement: "Helm already knows what matters first.",
        pageJudgementReason: "The system is prioritizing by real operating drag.",
        pageWhyItMatters: ["one", "two"],
        pageActionSummary: ["Ranked the live queue"],
        pageDecisionRequest: ["Choose the first move"],
        pageNextAction: [{ label: "Open queue", href: "/opportunities" }],
        pageBoundarySummary: ["High-risk actions still require approval"],
        pageEvidenceSummary: ["3 memory facts are driving the order"],
        pageWorkerSummary: ["Sales worker prepared the current move order"],
        pageEvidenceGroups: [
          {
            groupId: "contract_flows",
            label: "Contract flows",
            items: [],
          },
        ],
      }),
    ).toThrow("pageEvidenceGroups must keep at least one evidence item");

    expect(() =>
      createPageReportingProtocol({
        pageJudgement: "Helm already knows what matters first.",
        pageJudgementReason: "The system is prioritizing by real operating drag.",
        pageWhyItMatters: ["one", "two"],
        pageActionSummary: ["Ranked the live queue"],
        pageDecisionRequest: ["Choose the first move"],
        pageNextAction: [{ label: "Open queue", href: "/opportunities" }],
        pageBoundarySummary: ["High-risk actions still require approval"],
        pageEvidenceSummary: ["3 memory facts are driving the order"],
        pageWorkerSummary: ["Sales worker prepared the current move order"],
        pageEvidenceGroups: [
          {
            groupId: "contract_flows",
            label: "Contract flows",
            items: [
              {
                itemId: "",
                label: "Open flow",
                href: "/opportunities",
              },
            ],
          },
        ],
      }),
    ).toThrow("pageEvidenceGroups target items must keep an itemId");
  });
});
