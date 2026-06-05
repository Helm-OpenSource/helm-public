import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProactiveMechanismPanel } from "@/components/shared/proactive-mechanism-panel";
import type { ProactiveFlow } from "@/lib/presentation/proactive-mechanism";

describe("ProactiveMechanismPanel", () => {
  it("renders collaboration mode chips in English on the English path", () => {
    const html = renderToStaticMarkup(
      createElement(ProactiveMechanismPanel, {
        flows: [buildFlow()],
        english: true,
      }),
    );

    expect(html).toContain("System drives, human supervises");
    expect(html).toContain("Helm drives, human supervises");
    expect(html).toContain("Next steps");
    expect(html).not.toContain("系统推进，人类监督");
    expect(html).not.toContain("Helm 推进，人类监督");
    expect(html).not.toContain(">下一步<");
  });

  it("keeps collaboration mode chips localized on the Chinese path", () => {
    const html = renderToStaticMarkup(
      createElement(ProactiveMechanismPanel, {
        flows: [buildFlow()],
        english: false,
      }),
    );

    expect(html).toContain("系统推进，人类监督");
    expect(html).toContain("Helm 推进，人类监督");
    expect(html).toContain(">下一步<");
  });
});

function buildFlow(): ProactiveFlow {
  return {
    flowId: "review-flow",
    flowTitle: "Review flow",
    triggerCondition: "A customer-visible draft needs coordination.",
    activeReport: {
      activeReportType: "event",
      activeReportSummary: "A review-sensitive update is ready.",
      activeReportReason: "The current signal is customer-visible.",
      activeReportPriority: "watch",
      activeReportBoundary: ["Do not send automatically."],
      activeReportDecisionRequest: "Decide whether this can move forward.",
      activeReportWorkerSummary: ["Owner: delivery"],
      activeReportEvidenceSummary: ["Evidence: draft prepared"],
      activeReportAudience: ["delivery"],
      activeReportDeliveryMode: "decision-request",
      activeReportPreparationSummary: ["Draft prepared for review"],
    },
    collaboration: {
      collaborationMode: "helm_drives_human_supervises",
      collaborationRequest: "Coordinate the review owner before sending.",
      collaborationSummary: "Helm has prepared the coordination handoff.",
      collaborationReason: "The next move still needs human review.",
      collaborationBoundary: ["Customer-visible actions remain review-first."],
      collaborationOwner: "Delivery owner",
      collaborationWorkerAssignment: ["Review owner: delivery"],
      collaborationEscalationHint: "Escalate if the boundary is unclear.",
      collaborationDecisionRequest: "Confirm the owner.",
      collaborationNextStep: ["Open the review packet."],
    },
    helmCanDo: ["Prepare the review packet"],
    helmSuggestsOnly: ["Suggest the owner"],
    humanDecisionRequired: ["Approve the customer-visible wording"],
    humanLeadRequired: ["Send externally"],
    nextActions: [
      {
        label: "Open review packet",
        href: "/approvals",
      },
    ],
    evidenceLinks: [],
  };
}
