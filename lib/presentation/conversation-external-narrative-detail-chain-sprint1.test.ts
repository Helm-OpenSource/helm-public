import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..", "..");

function read(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

describe("conversation / external narrative detail chain sprint 1", () => {
  it("keeps the sprint 1 docs present", () => {
    const requiredDocs = [
      "docs/product/CONVERSATION_DETAIL_CONTRACT_REPORT.md",
      "docs/product/EXTERNAL_NARRATIVE_DETAIL_CONTRACT_REPORT.md",
      "docs/product/CONVERSATION_EXTERNAL_NARRATIVE_DETAIL_CHAIN_REPORT.md",
      "docs/reviews/CONVERSATION_EXTERNAL_NARRATIVE_ALIGNMENT_REPORT.md",
      "docs/product/CONVERSATION_EXTERNAL_NARRATIVE_DETAIL_CHAIN_SPRINT_1_REPORT.md",
    ];

    for (const relativePath of requiredDocs) {
      expect(
        existsSync(path.join(root, relativePath)),
        `${relativePath} should exist`,
      ).toBe(true);
    }
  });

  it("keeps README and docs index pointed at the conversation/narrative reports", () => {
    const docsReadme = read("docs/README.md");

    for (const snippet of [
      "CONVERSATION_DETAIL_CONTRACT_REPORT.md",
      "EXTERNAL_NARRATIVE_DETAIL_CONTRACT_REPORT.md",
      "CONVERSATION_EXTERNAL_NARRATIVE_DETAIL_CHAIN_REPORT.md",
      "CONVERSATION_EXTERNAL_NARRATIVE_ALIGNMENT_REPORT.md",
      "CONVERSATION_EXTERNAL_NARRATIVE_DETAIL_CHAIN_SPRINT_1_REPORT.md",
    ]) {
      expect(docsReadme).toContain(snippet);
    }
  });

  it("keeps conversation/narrative routes, contract and chain markers aligned", () => {
    const conversationRoute = read("app/(workspace)/conversations/[id]/page.tsx");
    const narrativeRoute = read(
      "app/(workspace)/external-narratives/[id]/page.tsx",
    );
    const conversationView = read("features/conversation-detail/detail-view.tsx");
    const conversationModel = read("features/conversation-detail/detail-model.ts");
    const conversationContract = read(
      "lib/presentation/conversation-detail-contract.ts",
    );
    const offerProposalView = read(
      "features/customer-facing-offer-external-proposal/detail-view.tsx",
    );
    const narrativeView = read("features/external-narrative-detail/detail-view.tsx");
    const narrativeModel = read("features/external-narrative-detail/detail-model.ts");
    const narrativeContract = read(
      "lib/presentation/external-narrative-detail-contract.ts",
    );
    const reinforcementView = read(
      "features/commitment-reinforcement-sendability/detail-view.tsx",
    );
    const navigationModel = read("lib/presentation/unified-detail-navigation.ts");

    for (const snippet of [
      "ConversationDetailView",
      "buildConversationDetailPageContract",
      "buildProposalPackageCommercialDetail",
    ]) {
      expect(conversationRoute).toContain(snippet);
    }

    for (const snippet of [
      "ExternalNarrativeDetailView",
      "buildExternalNarrativeDetailPageContract",
      "buildProposalPackageCommercialDetail",
    ]) {
      expect(narrativeRoute).toContain(snippet);
    }

    for (const snippet of [
      "data-conversation-detail-page",
      'data-page-layer="frontstage"',
      'data-page-layer="midstage"',
      'data-page-layer="backstage"',
      'data-page-layer="evidence"',
      'data-frontstage-block="current-summary"',
      'data-frontstage-block="decision-request"',
      'data-frontstage-block="next-action"',
      'data-frontstage-block="boundary"',
      "ReviewSnapshotBlock",
      "WhyItMattersBlock",
      "BoundaryNote",
      "EvidenceDrawer",
      "handoffSource: \"package\"",
      "handoffSource: \"customer-facing-offer\"",
      "handoffSource: \"conversation\"",
      "handoffTarget: \"conversation\"",
      "handoffTarget: \"external-narrative\"",
      "Founder cue",
      "Sales cue",
      "Delivery cue",
    ]) {
      expect(conversationView).toContain(snippet);
    }

    for (const snippet of [
      "data-external-narrative-detail-page",
      'data-page-layer="frontstage"',
      'data-page-layer="midstage"',
      'data-page-layer="backstage"',
      'data-page-layer="evidence"',
      'data-frontstage-block="current-summary"',
      'data-frontstage-block="decision-request"',
      'data-frontstage-block="next-action"',
      'data-frontstage-block="boundary"',
      "ReviewSnapshotBlock",
      "WhyItMattersBlock",
      "BoundaryNote",
      "EvidenceDrawer",
      "handoffSource: \"external-proposal\"",
      "handoffSource: \"reinforcement\"",
      "handoffSource: \"external-narrative\"",
      "handoffTarget: \"external-narrative\"",
      "handoffTarget: \"conversation\"",
    ]) {
      expect(narrativeView).toContain(snippet);
    }

    for (const snippet of [
      "conversationDetailJudgement",
      "conversationDetailMode",
      "conversationDetailSendabilityMode",
      "founder-meeting",
      "sales-follow-up",
      "review-before-send",
      "conversation_trace",
      "scenario_trace",
    ]) {
      expect(conversationContract).toContain(snippet);
    }

    for (const snippet of [
      "对话 guidance 可以改变重点、节奏和场景适配，但它仍然不能悄悄把仅讨论措辞变成承诺。",
      "conversation_trace",
      "scenario_trace",
      "founder-risk-clarification",
      "sales-objection-response",
      "proposal-shaping-review",
      "delivery_activation_checklist",
    ]) {
      expect(conversationModel).toContain(snippet);
    }

    for (const snippet of [
      "externalNarrativeDetailJudgement",
      "externalNarrativeDetailLevel",
      "externalNarrativeDetailFallbackMode",
      "exploratory-narrative",
      "proposal-supporting-narrative",
      "non-commitment-fallback",
      "narrative_trace",
      "fallback_trace",
    ]) {
      expect(narrativeContract).toContain(snippet);
    }

    for (const snippet of [
      "对外叙事可以提高清晰度和信心，但它仍然不能悄悄把建议硬化成承诺。",
      "narrative_trace",
      "fallback_trace",
    ]) {
      expect(narrativeModel).toContain(snippet);
    }

    for (const snippet of [
      "/conversations/",
      "/external-narratives/",
      "handoffTarget: \"conversation\"",
      "handoffTarget: \"external-narrative\"",
    ]) {
      expect(offerProposalView).toContain(snippet);
    }

    for (const snippet of [
      "/external-narratives/",
      "handoffTarget: \"external-narrative\"",
    ]) {
      expect(reinforcementView).toContain(snippet);
    }

    expect(navigationModel).toContain("\"conversation\"");
    expect(navigationModel).toContain("\"external-narrative\"");
  });

  it("keeps checks and delivery assets aligned to the conversation/narrative chain", () => {
    const selfCheck = read("scripts/helm-self-check.ts");
    const boundaryCheck = read("scripts/decision-first-boundary-check.ts");
    const pilotReadiness = read("scripts/pilot-readiness-check.ts");
    const demoScript = read("docs/product/demo-script.md");
    const manualAcceptance = read("docs/pilot/manual-acceptance-paths.md");
    const deliveryBoundary = read("docs/pilot/delivery-boundary.md");
    const principles = read("docs/product/product-principles.md");

    for (const snippet of [
      "CONVERSATION_DETAIL_CONTRACT_REPORT.md",
      "EXTERNAL_NARRATIVE_DETAIL_CONTRACT_REPORT.md",
      "CONVERSATION_EXTERNAL_NARRATIVE_DETAIL_CHAIN_SPRINT_1_REPORT.md",
    ]) {
      expect(selfCheck).toContain(snippet);
      expect(pilotReadiness).toContain(snippet);
    }

    expect(boundaryCheck).toContain(
      "conversation_external_narrative_pages_keep_scene_level_and_non_commitment_boundaries",
    );
    expect(demoScript).toContain(
      "Conversation / External Narrative Detail Chain",
    );
    expect(manualAcceptance).toContain(
      "路径 R：Conversation / External Narrative Detail Chain",
    );
    expect(deliveryBoundary).toContain(
      "conversation / external narrative detail",
    );
    expect(principles).toContain(
      "conversation / external narrative 详情页",
    );
  });
});
