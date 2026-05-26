import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..", "..");

function read(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

describe("conversation detail chain extension sprint 1", () => {
  it("keeps the Batch 5 docs present", () => {
    const requiredDocs = [
      "docs/product/CONVERSATION_DETAIL_CHAIN_EXTENSION_REPORT.md",
      "docs/reviews/CONVERSATION_DETAIL_CHAIN_EXTENSION_ALIGNMENT_REPORT.md",
    ];

    for (const relativePath of requiredDocs) {
      expect(
        existsSync(path.join(root, relativePath)),
        `${relativePath} should exist`,
      ).toBe(true);
    }
  });

  it("keeps README and docs index pointed at conversation chain extension", () => {
    const docsReadme = read("docs/README.md");

    for (const snippet of [
      "CONVERSATION_DETAIL_CHAIN_EXTENSION_REPORT.md",
      "CONVERSATION_DETAIL_CHAIN_EXTENSION_ALIGNMENT_REPORT.md",
      "Conversation Detail Chain Extension",
    ]) {
      expect(docsReadme).toContain(snippet);
    }
  });

  it("keeps contacts, companies and meetings connected to the unified conversation chain", () => {
    const contactRoute = read("app/(workspace)/contacts/[id]/page.tsx");
    const companyRoute = read("app/(workspace)/companies/[id]/page.tsx");
    const meetingRoute = read("app/(workspace)/meetings/[id]/page.tsx");
    const deliveryReviewCompatibilityRoute = read(
      "app/(workspace)/delivery-reviews/[id]/page.tsx",
    );
    const deliveryWalkthroughCompatibilityRoute = read(
      "app/(workspace)/delivery-walkthroughs/[id]/page.tsx",
    );
    const meetingLoader = read("features/meetings/page-loader.ts");
    const model = read("features/conversation-chain-extension/detail-model.ts");
    const view = read("features/conversation-chain-extension/detail-view.tsx");
    const navigationModel = read("lib/presentation/unified-detail-navigation.ts");
    const navigationPanel = read("components/shared/unified-detail-navigation-panel.tsx");

    for (const snippet of [
      "ConversationChainExtensionDetailView",
      "buildContactConversationChainExtensionModel",
      "data-conversation-chain-object-detail",
    ]) {
      expect(contactRoute).toContain(snippet);
    }

    for (const snippet of [
      "ConversationChainExtensionDetailView",
      "buildCompanyConversationChainExtensionModel",
      "data-conversation-chain-object-detail",
    ]) {
      expect(companyRoute).toContain(snippet);
    }

    for (const snippet of [
      "ConversationChainExtensionDetailView",
      "loadMeetingDetailPageData",
      "data-conversation-chain-object-detail",
    ]) {
      expect(meetingRoute).toContain(snippet);
    }

    expect(meetingLoader).toContain("buildMeetingConversationChainExtensionModel");
    expect(deliveryReviewCompatibilityRoute).toContain(
      "redirect(`/conversations/${encodeURIComponent(id)}`)",
    );
    expect(deliveryWalkthroughCompatibilityRoute).toContain(
      "redirect(`/conversations/${encodeURIComponent(id)}`)",
    );

    for (const snippet of [
      "data-conversation-chain-extension-page",
      "data-conversation-chain-extension-kind",
      "detailNodeType: \"company-detail\"",
      "detailNodeType: \"contact-detail\"",
      "detailNodeType: \"meeting-detail\"",
      "handoffSource: \"company-detail\"",
      "handoffTarget: \"contact-detail\"",
      "handoffSource: \"contact-detail\"",
      "handoffTarget: \"sales-follow-up\"",
      "handoffSource: \"meeting-detail\"",
      "handoffTarget: \"delivery-review\"",
      "handoffTarget: \"delivery-walkthrough\"",
      "/contacts/",
      "/companies/",
      "/meetings/",
      "/sales-followups/",
      "/delivery-reviews/",
      "/delivery-walkthroughs/",
      "customer-facing-with-boundary",
      "internal-only",
    ]) {
      expect(model).toContain(snippet);
    }

    for (const snippet of [
      "RoleConversationDetailShell",
      "data-conversation-chain-extension-page",
    ]) {
      expect(view).toContain(snippet);
    }

    for (const snippet of [
      "\"company-detail\"",
      "\"contact-detail\"",
      "\"meeting-detail\"",
    ]) {
      expect(navigationModel).toContain(snippet);
      expect(navigationPanel).toContain(snippet);
    }
  });

  it("keeps checks and delivery assets aligned to the new chain extension", () => {
    const selfCheck = read("scripts/helm-self-check.ts");
    const boundaryCheck = read("scripts/decision-first-boundary-check.ts");
    const pilotReadiness = read("scripts/pilot-readiness-check.ts");
    const demoScript = read("docs/product/demo-script.md");
    const manualAcceptance = read("docs/pilot/manual-acceptance-paths.md");
    const deliveryBoundary = read("docs/pilot/delivery-boundary.md");
    const principles = read("docs/product/product-principles.md");
    const packageJson = read("package.json");
    const totalReport = read("docs/product/ROLE_BASED_CONVERSATION_EXPANSION_BATCH_1_5_REPORT.md");

    for (const snippet of [
      "CONVERSATION_DETAIL_CHAIN_EXTENSION_REPORT.md",
      "CONVERSATION_DETAIL_CHAIN_EXTENSION_ALIGNMENT_REPORT.md",
    ]) {
      expect(selfCheck).toContain(snippet);
      expect(pilotReadiness).toContain(snippet);
    }

    expect(boundaryCheck).toContain(
      "conversation_detail_chain_extension_pages_keep_current_judgement_boundary_and_handoff_visible",
    );
    expect(demoScript).toContain("Conversation Detail Chain Extension");
    expect(manualAcceptance).toContain("路径 Y：Conversation Detail Chain Extension");
    expect(deliveryBoundary).toContain("conversation detail chain extension");
    expect(principles).toContain("conversation detail chain extension");
    expect(packageJson).toContain(
      "lib/presentation/conversation-detail-chain-extension-sprint1.test.ts",
    );
    expect(totalReport).toContain("Batch 5");
    expect(totalReport).toContain("Conversation detail chain extension");
  });
});
