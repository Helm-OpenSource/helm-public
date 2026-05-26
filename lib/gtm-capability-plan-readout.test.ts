import { describe, expect, it } from "vitest";
import { buildGtmCapabilityPlanReadout } from "@/lib/gtm-capability-plan-readout";

describe("GTM capability plan readout", () => {
  it("prioritizes submitted reviews before invites, terms gaps and referral proof", () => {
    const readout = buildGtmCapabilityPlanReadout({
      english: false,
      programs: [
        {
          id: "program_1",
          title: "销售转介绍计划",
          slug: "sales-referral-program",
          status: "ACTIVE",
          applicationCount: 2,
          activeTermsVersion: { id: "terms_1" },
        },
        {
          id: "program_2",
          title: "定制交付伙伴计划",
          slug: "custom-partner-program",
          status: "ACTIVE",
          applicationCount: 0,
          activeTermsVersion: null,
        },
      ],
      applications: [
        {
          id: "application_submitted",
          applicantName: "赵敏",
          applicantOrganization: "星河增长",
          status: "SUBMITTED",
          createdAt: new Date("2026-04-25T01:00:00.000Z"),
          partnerProgram: {
            title: "销售转介绍计划",
            slug: "sales-referral-program",
          },
          participantPortalAccess: null,
        },
        {
          id: "application_accepted",
          applicantName: "Ming Li",
          applicantOrganization: null,
          status: "ACCEPTED",
          createdAt: new Date("2026-04-24T01:00:00.000Z"),
          partnerProgram: {
            title: "定制交付伙伴计划",
            slug: "custom-partner-program",
          },
          participantPortalAccess: null,
        },
      ],
      salesReferrals: [
        {
          id: "referral_1",
          beneficiaryLabel: "Northstar BD",
          status: "ACTIVE",
          createdAt: new Date("2026-04-20T01:00:00.000Z"),
        },
      ],
    });

    expect(readout.counts.submittedApplicationCount).toBe(1);
    expect(readout.counts.acceptedPendingInviteCount).toBe(1);
    expect(readout.counts.programTermsGapCount).toBe(1);
    expect(readout.topWorkItems.map((item) => item.id)).toEqual([
      "application-review:application_submitted",
      "application-invite:application_accepted",
      "program-terms-gap:program_2",
    ]);
    expect(readout.boundary).toContain("这不是 CRM");
    expect(readout.summary).toBe(
      "保留区 GTM 读面：先复核申请、保留干净交接，并坚持证据先于公开主张。",
    );
    expect(readout.boundary).toContain("自动建工作区");
    expect(readout.capabilityPlans.find((item) => item.id === "guided-intake")?.status).toBe(
      "review_required",
    );
    expect(readout.capabilityPlans.find((item) => item.id === "guided-intake")?.label).toBe(
      "引导式需求收集与需求简报",
    );
    expect(readout.capabilityPlans.find((item) => item.id === "guided-intake")?.nextAction).toBe(
      "进入试用初始化前，先把需求收成已复核简报。",
    );
    expect(readout.capabilityPlans.find((item) => item.id === "evidence-review")?.nextAction).toBe(
      "痛点和转介绍信号在证据复核前都只保持假设。",
    );
    expect(readout.capabilityPlans.find((item) => item.id === "proof-pack")?.label).toBe(
      "证据包与资产候选",
    );
    expect(readout.guidedIntake.entryModes.map((mode) => mode.id)).toEqual([
      "sales_led",
      "self_serve",
    ]);
    expect(readout.demandBriefDraftFlow.targets.map((target) => target.applicationId)).toEqual([
      "application_submitted",
      "application_accepted",
    ]);
    expect(readout.demandBriefDraftFlow.boundary).toContain("不创建工作区");
    expect(readout.demandBriefDraftFlow.boundary).not.toMatch(/workspace|ActionItem|ApprovalTask/i);
    expect(readout.guidedIntake.requiredFields).toHaveLength(5);
    expect(readout.guidedIntake.reviewGate).toContain("不得进入试用初始化");
    expect(readout.guidedIntake.reviewGate).not.toMatch(/brief|workspace/i);
    expect(readout.guidedIntake.cleanHandoffChecks).toContain(
      "销售预填与自助进入共用同一份客户需求简报契约",
    );
    expect(readout.diagnosticAndProofPack.title).toBe("诊断与证据包计划");
    expect(readout.diagnosticAndProofPack.publicUseGate).toContain("证据包可以形成");
    expect(readout.diagnosticAndProofPack.claimLevels[0]?.boundary).toBe("尚无已复核证据包。");
    expect(
      readout.confirmationAndEvidence.allowedCustomerActions.find(
        (action) => action.id === "request_change",
      )?.directApply,
    ).toBe(false);
    expect(
      readout.confirmationAndEvidence.allowedCustomerActions.find(
        (action) => action.id === "request_change",
      )?.boundary,
    ).toBe("实质改写进入需要复核状态，不能静默覆盖内部判断。");
    expect(readout.confirmationAndEvidence.evidenceDowngradeRule).toContain("不能变成");
    expect(readout.confirmationAndEvidence.evidenceDowngradeRule).not.toMatch(
      /trial_premise|pain captured|evidence declared/i,
    );
  });

  it("keeps English readout non-executing and proof-before-claim", () => {
    const readout = buildGtmCapabilityPlanReadout({
      english: true,
      programs: [],
      applications: [],
      salesReferrals: [],
    });

    expect(readout.boundary).toContain("auto-send");
    expect(readout.boundary).toContain("payout execution");
    expect(readout.demandBriefDraftFlow.boundary).toContain("ActionItem + ApprovalTask");
    expect(readout.demandBriefDraftFlow.boundary).toContain("does not create workspace");
    expect(readout.capabilityPlans.find((item) => item.id === "proof-pack")?.nextAction).toContain(
      "No public claim",
    );
    expect(readout.guidedIntake.reviewGate).toContain("does not create workspace");
    expect(readout.guidedIntake.cleanHandoffChecks).toContain(
      "trialInitializationPayload excludes referral, settlement and contribution attribution",
    );
    expect(readout.diagnosticAndProofPack.firstLoopContract).toEqual([
      "observe",
      "judge",
      "prepare",
      "human review",
      "manual action",
      "verify",
      "learn",
    ]);
    expect(readout.diagnosticAndProofPack.publicUseGate).toContain(
      "cannot publish a customer-visible claim automatically",
    );
  });

  it("keeps guided intake lightweight with bounded questions and source trace preview", () => {
    const readout = buildGtmCapabilityPlanReadout({
      english: true,
      programs: [
        {
          id: "program_1",
          title: "Partner referral",
          slug: "partner-referral",
          status: "ACTIVE",
          applicationCount: 1,
          activeTermsVersion: { id: "terms_1" },
        },
      ],
      applications: [
        {
          id: "application_accepted",
          applicantName: "赵敏",
          applicantOrganization: "星河增长",
          status: "ACCEPTED",
          createdAt: new Date("2026-04-25T01:00:00.000Z"),
          partnerProgram: {
            title: "Partner referral",
            slug: "partner-referral",
          },
          participantPortalAccess: { id: "portal_1" },
        },
      ],
      salesReferrals: [
        {
          id: "referral_1",
          beneficiaryLabel: "星河增长",
          status: "ACTIVE",
          createdAt: new Date("2026-04-25T02:00:00.000Z"),
        },
      ],
      demandBriefDrafts: [
        {
          id: "draft_1",
          title: "CustomerDemandBrief draft: 星河增长",
          status: "PENDING_APPROVAL",
          createdAt: new Date("2026-04-25T03:00:00.000Z"),
          approvalTask: {
            id: "approval_1",
            status: "PENDING",
          },
          metadata: {
            kind: "gtm_customer_demand_brief_draft",
            version: 1,
            applicationId: "application_accepted",
            programSlug: "partner-referral",
            sourceType: "program_application",
            requestedBy: "Helm Admin",
            requestedAt: "2026-04-25T03:00:00.000Z",
            requiredFields: ["customer identity"],
            missingInformation: [],
            sourceTrace: ["program application:application_accepted"],
            cleanHandoffChecks: ["customerVisibleSummary requires human review"],
            boundary: {
              reservedOnly: true,
              doesNotCreateWorkspace: true,
              doesNotSendMaterial: true,
              doesNotWriteCustomerSystems: true,
              trialInitializationCandidateOnly: true,
              excludesReferralSettlementContributionAttribution: true,
            },
          },
        },
      ],
    });

    expect(readout.guidedIntake.steps.every((step) => step.questionCount <= 5)).toBe(true);
    expect(readout.guidedIntake.sourceTracePreview).toEqual([
      "program application",
      "program catalog",
      "sales referral signal",
    ]);
    expect(readout.guidedIntake.missingInformation).not.toContain("customer identity");
    expect(readout.demandBriefDraftFlow.targets[0]).toMatchObject({
      applicationId: "application_accepted",
      hasOpenDraft: true,
      latestApprovalTaskId: "approval_1",
    });
    expect(readout.demandBriefDraftFlow.recentDrafts[0]?.statusLabel).toContain(
      "pending review",
    );
    expect(
      readout.confirmationAndEvidence.controlLineTemplates.find(
        (template) => template.id === "opportunity-judgement",
      )?.status,
    ).toBe("review_required");
    expect(
      readout.diagnosticAndProofPack.claimLevels.find(
        (claim) => claim.id === "public_candidate",
      )?.boundary,
    ).toContain("explicit human approval");
  });
});
