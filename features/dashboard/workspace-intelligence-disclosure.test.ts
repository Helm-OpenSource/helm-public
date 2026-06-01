import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HelmDidBlock, WhyItMattersBlock } from "@/components/shared/narrative-components";
import { WorkspaceGuidancePanel } from "@/components/shared/workspace-guidance-panel";

describe("workspace intelligence disclosure posture", () => {
  it("renders shared guidance collapsed by default and expandable for onboarding flows", () => {
    const collapsed = renderToStaticMarkup(
      createElement(WorkspaceGuidancePanel, {
        eyebrow: "Judgement-first home",
        title: "Keep the next move clear.",
        summary: "Only expand the rest when the operator wants the system rationale.",
        recommendations: [
          { title: "Call Acme", body: "Move the warm chain before it cools." },
          { title: "Review blocker", body: "Confirm whether legal review is still blocking." },
        ],
        reminders: [{ title: "Boundary", body: "Recommendation is still not commitment." }],
        boundary: "This view stays review-first.",
      }),
    );

    const expanded = renderToStaticMarkup(
      createElement(WorkspaceGuidancePanel, {
        eyebrow: "Setup guidance",
        title: "Establish the first operating posture.",
        summary: "First-run setup can keep guidance open.",
        recommendations: [{ title: "Invite team", body: "Keep the first handoff ready." }],
        defaultExpanded: true,
      }),
    );

    expect(collapsed).toContain("<details");
    expect(collapsed).not.toContain(" open=");
    expect(collapsed).toContain("workspace-guidance-meta-pill");
    expect(expanded).toContain(" open=\"\"");
  });

  it("renders why-it-matters and Helm-did blocks as disclosures", () => {
    const why = renderToStaticMarkup(
      createElement(WhyItMattersBlock, {
        label: "Why this matters now",
        reasons: ["This move is time-sensitive.", "A blocker is already slowing the chain."],
      }),
    );
    const helmDid = renderToStaticMarkup(
      createElement(HelmDidBlock, {
        label: "What Helm already did",
        items: ["Prepared the draft.", "Pulled the recent context."],
      }),
    );

    expect(why).toContain("data-narrative-disclosure=\"true\"");
    expect(why).toContain("<details");
    expect(why).toContain("+1");
    expect(helmDid).toContain("data-narrative-disclosure=\"true\"");
    expect(helmDid).toContain("<details");
    expect(helmDid).toContain("Prepared the draft.");
  });
});
