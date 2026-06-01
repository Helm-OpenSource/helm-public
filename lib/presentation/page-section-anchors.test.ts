import { describe, expect, it } from "vitest";
import {
  APPROVAL_PAGE_ANCHORS,
  MEMORY_PAGE_ANCHORS,
  OPPORTUNITY_PAGE_ANCHORS,
  buildApprovalItemAnchor,
  buildMemoryItemAnchor,
  buildOpportunityItemAnchor,
  buildSectionHref,
} from "@/lib/presentation/page-section-anchors";

describe("page section anchors", () => {
  it("keeps stable section ids for approval, opportunity and memory drilldowns", () => {
    expect(APPROVAL_PAGE_ANCHORS).toEqual(
      expect.objectContaining({
        preview: "approval-preview",
        sourceContext: "approval-source-context",
        resultPreview: "approval-result-preview",
      }),
    );
    expect(OPPORTUNITY_PAGE_ANCHORS).toEqual(
      expect.objectContaining({
        briefing: "opportunity-briefing",
        actionWorkspace: "opportunity-action-workspace",
        memorySummary: "opportunity-memory-summary",
      }),
    );
    expect(MEMORY_PAGE_ANCHORS).toEqual(
      expect.objectContaining({
        timeline: "memory-work-timeline",
        auditReplay: "memory-audit-replay",
      }),
    );
  });

  it("builds deep links that land on concrete page sections", () => {
    expect(
      buildSectionHref(
        "/approvals?approvalId=approval_demo",
        APPROVAL_PAGE_ANCHORS.sourceContext,
      ),
    ).toBe("/approvals?approvalId=approval_demo#approval-source-context");
    expect(
      buildSectionHref(
        "/opportunities?opportunityId=opp_demo",
        OPPORTUNITY_PAGE_ANCHORS.briefing,
      ),
    ).toBe("/opportunities?opportunityId=opp_demo#opportunity-briefing");
    expect(
      buildSectionHref(
        "/memory?objectType=OPPORTUNITY&objectId=opp_demo",
        MEMORY_PAGE_ANCHORS.auditReplay,
      ),
    ).toBe(
      "/memory?objectType=OPPORTUNITY&objectId=opp_demo#memory-audit-replay",
    );
  });

  it("keeps section href construction idempotent when a path already has a hash", () => {
    expect(
      buildSectionHref(
        "/memory?objectType=OPPORTUNITY&objectId=opp_demo&from=approvals#memory-work-timeline",
        MEMORY_PAGE_ANCHORS.timeline,
      ),
    ).toBe(
      "/memory?objectType=OPPORTUNITY&objectId=opp_demo&from=approvals#memory-work-timeline",
    );
    expect(
      buildSectionHref(
        "/approvals?approvalId=approval_demo#approval-preview",
        "#approval-source-context",
      ),
    ).toBe("/approvals?approvalId=approval_demo#approval-source-context");
  });

  it("builds stable object-level anchors inside sections", () => {
    expect(buildApprovalItemAnchor("fact", "fact_demo")).toBe(
      "approval-fact-fact_demo",
    );
    expect(buildOpportunityItemAnchor("recommendation", "rec_demo")).toBe(
      "opportunity-recommendation-rec_demo",
    );
    expect(buildMemoryItemAnchor("audit", "audit_demo")).toBe(
      "memory-audit-audit_demo",
    );
  });
});
