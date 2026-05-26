import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  activeReportDeliveryModes,
  activeReportTypes,
  collaborationModes,
  createActiveReportProtocol,
  createProactiveCollaborationProtocol,
  createProactiveFlow,
  proactiveLayers,
  summarizeProactiveFlow,
} from "@/lib/presentation/proactive-mechanism";

const root = path.resolve(__dirname, "..", "..");

function read(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

describe("proactive mechanism", () => {
  it("keeps the proactive taxonomy stable", () => {
    expect(proactiveLayers).toEqual([
      "observe",
      "judge",
      "prepare",
      "report",
      "collaborate",
      "controlled_auto_execute",
    ]);
    expect(activeReportTypes).toEqual(["periodic", "event", "request"]);
    expect(activeReportDeliveryModes).toEqual([
      "home-brief",
      "event-alert",
      "decision-request",
    ]);
    expect(collaborationModes).toEqual([
      "helm_drives_human_supervises",
      "helm_prepares_human_decides",
      "helm_reminds_human_leads",
    ]);
  });

  it("summarizes a proactive flow without changing its payload", () => {
    const flow = createProactiveFlow({
      flowId: "test-flow",
      flowTitle: "Founder decision request",
      triggerCondition: "Risk changed",
      activeReport: createActiveReportProtocol({
        activeReportType: "event",
        activeReportSummary: "A risk surfaced",
        activeReportReason: "The main opportunity is cooling.",
        activeReportPriority: "urgent",
        activeReportBoundary: ["High-risk moves still need approval"],
        activeReportDecisionRequest: "Choose the next move.",
        activeReportWorkerSummary: ["Recommendation worker ranked the move"],
        activeReportEvidenceSummary: ["2 blockers and 1 commitment"],
        activeReportAudience: ["founder", "operator"],
        activeReportDeliveryMode: "decision-request",
        activeReportPreparationSummary: ["Prepared the summary"],
      }),
      collaboration: createProactiveCollaborationProtocol({
        collaborationMode: "helm_prepares_human_decides",
        collaborationRequest: "Please review",
        collaborationSummary: "Helm prepared the draft",
        collaborationReason: "The move is not safe enough to self-authorize",
        collaborationBoundary: ["Recommendation is not commitment"],
        collaborationOwner: "Founder owner",
        collaborationWorkerAssignment: ["Approval worker keeps boundary visible"],
        collaborationEscalationHint: "Escalate if wording hardens",
        collaborationDecisionRequest: "Approve or hold",
        collaborationNextStep: ["Open review drawer"],
      }),
      helmCanDo: ["Prepare context"],
      helmSuggestsOnly: ["Suggest wording"],
      humanDecisionRequired: ["Approve or reject"],
      humanLeadRequired: ["External commitment"],
      nextActions: [{ label: "Open queue", href: "/approvals" }],
      evidenceLinks: [{ label: "Open memory", href: "/memory" }],
    });

    expect(summarizeProactiveFlow(flow)).toEqual({
      preparationCount: 1,
      boundaryCount: 2,
      workerCount: 2,
      evidenceCount: 1,
      nextActionCount: 1,
    });
  });

  it("wires active reporting and proactive collaboration into the representative pages", () => {
    type RepresentativePage = string | string[];
    const representativePages: RepresentativePage[] = [
      // Dashboard page is the orchestrator; the proactive flow builders
      // live in features/dashboard/founder-proactive-flow.ts.
      [
        "app/(workspace)/dashboard/page.tsx",
        "features/dashboard/founder-proactive-flow.ts",
      ],
      "features/opportunities/opportunities-client.tsx",
      "features/approvals/approvals-client.tsx",
    ];

    for (const pagePath of representativePages) {
      const paths = Array.isArray(pagePath) ? pagePath : [pagePath];
      const content = paths.map((p) => read(p)).join("\n");
      const aggregateLabel = paths.join(", ");

      expect(content, aggregateLabel).toContain("ProactiveMechanismPanel");
      expect(content, aggregateLabel).toContain("createActiveReportProtocol");
      expect(content, aggregateLabel).toContain("createProactiveCollaborationProtocol");
      expect(content, aggregateLabel).toContain("activeReportType");
      expect(content, aggregateLabel).toContain("activeReportSummary");
      expect(content, aggregateLabel).toContain("collaborationMode");
      expect(content, aggregateLabel).toContain("collaborationDecisionRequest");
    }
  });

  it("keeps the shared proactive panel markers visible", () => {
    const panel = read("components/shared/proactive-mechanism-panel.tsx");
    const sharedComponents = read("components/shared/narrative-components.tsx");

    expect(panel).toContain("data-active-reporting");
    expect(panel).toContain("data-active-report-summary");
    expect(panel).toContain('data-page-layer="frontstage"');
    expect(panel).toContain('data-page-layer="midstage"');
    expect(panel).toContain('data-page-layer="backstage"');
    expect(panel).toContain('data-page-layer="evidence"');
    expect(panel).toContain('data-frontstage-block="current-summary"');
    expect(panel).toContain("data-worker-assignment");
    expect(sharedComponents).toContain("data-collaboration-request");
    expect(sharedComponents).toContain("data-active-evidence");
  });
});
