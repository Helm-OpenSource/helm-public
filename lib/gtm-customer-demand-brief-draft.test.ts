import { describe, expect, it } from "vitest";
import {
  buildGtmCustomerDemandBriefDraft,
  GTM_CUSTOMER_DEMAND_BRIEF_DRAFT_KIND,
  parseGtmCustomerDemandBriefDraftMetadata,
} from "@/lib/gtm-customer-demand-brief-draft";

describe("GTM CustomerDemandBrief draft", () => {
  it("keeps the draft candidate reserved-only and non-executing", () => {
    const draft = buildGtmCustomerDemandBriefDraft({
      english: false,
      requestedBy: "Helm Admin",
      requestedAt: new Date("2026-04-25T09:00:00.000Z"),
      application: {
        id: "application_1",
        applicantName: "赵敏",
        applicantEmail: "zhaomin@example.com",
        applicantOrganization: "星河增长",
        roleTitle: "Founder",
        website: "https://xinghe.example",
        regionLabel: "China",
        background: "希望先看销售跟进和客户复盘控制线。",
        contributionPlan: "已有线索列表和一次客户复盘会。",
        internalNotes: "来自销售预填，不进入客户 workspace。",
        status: "SUBMITTED",
        partnerProgram: {
          title: "销售转介绍计划",
          slug: "sales-referral-program",
        },
        participantPortalAccess: null,
        salesReferral: {
          id: "referral_1",
          beneficiaryLabel: "Northstar BD",
        },
      },
    });

    expect(draft.title).toContain("星河增长");
    expect(draft.draftContent).toContain("CustomerDemandBrief 草稿候选");
    expect(draft.draftContent).toContain("不创建 workspace");
    expect(draft.draftContent).toContain("不外发材料");
    expect(draft.draftContent).toContain("不写客户系统");
    expect(draft.metadata.kind).toBe(GTM_CUSTOMER_DEMAND_BRIEF_DRAFT_KIND);
    expect(draft.metadata.boundary).toMatchObject({
      reservedOnly: true,
      doesNotCreateWorkspace: true,
      doesNotSendMaterial: true,
      doesNotWriteCustomerSystems: true,
      trialInitializationCandidateOnly: true,
      excludesReferralSettlementContributionAttribution: true,
    });
    expect(draft.metadata.sourceTrace).toContain("销售转介绍信号:Northstar BD");
    expect(draft.metadata.cleanHandoffChecks.join(" ")).toContain(
      "trialInitializationPayload",
    );
  });

  it("parses only the GTM demand brief draft metadata kind", () => {
    const parsed = parseGtmCustomerDemandBriefDraftMetadata(
      JSON.stringify({
        kind: GTM_CUSTOMER_DEMAND_BRIEF_DRAFT_KIND,
        version: 1,
        applicationId: "application_1",
        programSlug: "sales-referral-program",
        sourceType: "program_application",
        requestedBy: "Helm Admin",
        requestedAt: "2026-04-25T09:00:00.000Z",
        requiredFields: ["customer identity"],
        missingInformation: [],
        sourceTrace: ["program application:application_1"],
        cleanHandoffChecks: ["customerVisibleSummary requires human review"],
        boundary: {
          reservedOnly: true,
          doesNotCreateWorkspace: true,
          doesNotSendMaterial: true,
          doesNotWriteCustomerSystems: true,
          trialInitializationCandidateOnly: true,
          excludesReferralSettlementContributionAttribution: true,
        },
      }),
    );

    expect(parsed?.applicationId).toBe("application_1");
    expect(parseGtmCustomerDemandBriefDraftMetadata(JSON.stringify({ kind: "other" }))).toBeNull();
  });
});
