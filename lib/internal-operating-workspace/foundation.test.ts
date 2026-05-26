import { describe, expect, it } from "vitest";
import {
  buildInternalOperatingHomeModel,
  buildInternalRoleSurfaceModel,
  type InternalOperatingFoundationInput,
} from "@/lib/internal-operating-workspace";

const input: InternalOperatingFoundationInput = {
  english: false,
  opportunities: [
    {
      id: "opp_client_1",
      title: "Acme 年度经营动作控制台试点",
      description: "客户试点推进",
      type: "CLIENT",
      stage: "ADVANCING",
      riskLevel: "MEDIUM",
      nextAction: "发送 ROI 跟进邮件",
      nextStepSummary: null,
      priorityScore: 92,
      lossReason: null,
      company: { id: "company_a", name: "Acme Robotics" },
      owner: { id: "user_sales", name: "周玥" },
      contacts: [{ id: "contact_a", name: "Vivian Chen" }],
      meetings: [
        {
          id: "meeting_a",
          title: "Acme 试点对齐会",
          startsAt: new Date("2026-03-31T09:00:00.000Z"),
          note: {
            summary: "确认 ROI 框架和采购评估流程。",
            keyDecisions: "先发 follow-up，再锁内部评估人。",
          },
        },
      ],
      actionItems: [
        {
          id: "task_a",
          title: "起草 follow-up",
          description: "今天发出试点跟进",
          status: "PENDING_APPROVAL",
          approvalTask: { id: "approval_a", status: "PENDING" },
        },
      ],
      memoryEntries: [
        {
          id: "memory_a",
          title: "Acme 复盘",
          content: "champion 已经形成，但预算仍需采购确认。",
          createdAt: new Date("2026-03-30T09:00:00.000Z"),
        },
      ],
    },
    {
      id: "opp_candidate_1",
      title: "Ben Carter 候选人推进",
      description: "招聘推进",
      type: "RECRUITING",
      stage: "ADVANCING",
      riskLevel: "HIGH",
      nextAction: "确认终面 panel",
      nextStepSummary: null,
      priorityScore: 84,
      lossReason: null,
      company: { id: "company_b", name: "GreenPeak Health" },
      owner: { id: "user_rec", name: "沈乔" },
      contacts: [{ id: "contact_b", name: "Ben Carter" }],
      meetings: [],
      actionItems: [],
      memoryEntries: [],
    },
    {
      id: "opp_partner_1",
      title: "Atlas AI 联合解决方案合作",
      description: "伙伴合作",
      type: "PARTNERSHIP",
      stage: "CONTACTED",
      riskLevel: "MEDIUM",
      nextAction: "确认联名方案和分工",
      nextStepSummary: null,
      priorityScore: 80,
      lossReason: null,
      company: { id: "company_c", name: "Atlas AI" },
      owner: { id: "user_founder", name: "林舟" },
      contacts: [{ id: "contact_c", name: "Lena Zhou" }],
      meetings: [],
      actionItems: [],
      memoryEntries: [],
    },
    {
      id: "opp_internal_1",
      title: "产品路线优先级冲突处理",
      description: "内部产品与交付冲突",
      type: "INTERNAL",
      stage: "INTERNAL_SYNC",
      riskLevel: "CRITICAL",
      nextAction: "明确版本优先级和承诺边界",
      nextStepSummary: null,
      priorityScore: 90,
      lossReason: null,
      company: null,
      owner: { id: "user_founder", name: "林舟" },
      contacts: [],
      meetings: [],
      actionItems: [],
      memoryEntries: [],
    },
  ],
  approvals: [
    {
      id: "approval_a",
      status: "PENDING",
      actionItem: {
        id: "task_a",
        title: "起草 follow-up",
        opportunityId: "opp_client_1",
      },
    },
  ],
  audits: [
    {
      id: "audit_a",
      actionType: "APPROVAL_REQUESTED",
      summary: "Acme follow-up 已进入审批。",
      targetId: "opp_client_1",
      relatedObjectId: null,
    },
  ],
};

describe("internal operating workspace foundation", () => {
  it("builds the internal operating home with unified sections", () => {
    const model = buildInternalOperatingHomeModel(input);

    expect(model.sections.map((section) => section.id)).toEqual(
      expect.arrayContaining([
        "lead-revenue",
        "product-delivery",
        "recruiting-organization",
        "partner-custom",
      ]),
    );
    expect(model.roleSurfaces).toHaveLength(6);
    expect(model.topJudgements[0]?.label).toBeTruthy();
    expect(model.immediateActions).toHaveLength(3);
    expect(model.actionTemplates.length).toBeGreaterThan(0);
    expect(model.retroFeedback.length).toBeGreaterThan(0);
  });

  it("keeps Chinese operating copy out of implementation-layer English", () => {
    const home = buildInternalOperatingHomeModel(input);
    const roles = [
      buildInternalRoleSurfaceModel("founder", input),
      buildInternalRoleSurfaceModel("sales", input),
      buildInternalRoleSurfaceModel("delivery", input),
      buildInternalRoleSurfaceModel("customer-success", input),
      buildInternalRoleSurfaceModel("recruiting", input),
      buildInternalRoleSurfaceModel("partner", input),
    ];
    const generatedCopy = [
      home.description,
      home.headline,
      home.summary,
      ...home.sections.flatMap((section) => [
        section.title,
        section.summary,
        section.actionLabel,
        ...section.cards.map((card) =>
          [
            card.subtitle,
            card.stageLabel,
            card.currentJudgement,
            card.nextStep,
            card.riskBoundary,
            card.chainRelation,
          ].join(" "),
        ),
      ]),
      ...home.retroFeedback.flatMap((item) => [item.label, item.hint]),
      ...home.roleSurfaces.flatMap((surface) => [
        surface.title,
        surface.summary,
      ]),
      ...roles.flatMap((role) => [
        role.headline,
        role.summary,
        ...role.sceneSections.flatMap((section) => [
          section.title,
          section.summary,
          ...section.items.map((item) => item.hint),
        ]),
        ...role.retroFeedback.flatMap((item) => [item.label, item.hint]),
      ]),
    ].join(" ");

    expect(generatedCopy).not.toMatch(
      /pipeline list|sendability|renew cue|candidate-facing|uncontrolled outreach|marketplace lane|capability|dependency|meeting ->|decision ->|result ->|object summary|decision owner|delivery judgement|activation friction|expansion pressure|customer success 的起点|partner fit|custom delivery/i,
    );
  });

  it("builds role surfaces with judgement-first handoff items", () => {
    const founder = buildInternalRoleSurfaceModel("founder", input);
    const sales = buildInternalRoleSurfaceModel("sales", input);
    const delivery = buildInternalRoleSurfaceModel("delivery", input);
    const customerSuccess = buildInternalRoleSurfaceModel("customer-success", input);
    const recruiting = buildInternalRoleSurfaceModel("recruiting", input);
    const partner = buildInternalRoleSurfaceModel("partner", input);

    expect(founder.topHandoffs.length).toBeGreaterThan(0);
    expect(founder.topJudgements[0]?.hint).toBeTruthy();
    expect(founder.immediateActions).toHaveLength(3);
    expect(founder.decisionsWaiting.length).toBeGreaterThan(0);
    expect(founder.blockersToClear.length).toBeGreaterThan(0);
    expect(founder.actionTemplates.length).toBeGreaterThan(0);
    expect(founder.retroFeedback.length).toBeGreaterThan(0);
    expect(
      founder.sceneSections.map((section) => section.id),
    ).toEqual(
      expect.arrayContaining([
        "strategic-focus",
        "key-decision",
        "blockage-review",
        "top-customer",
        "top-hiring-need",
        "top-partner-move",
        "founder-qa-variants",
      ]),
    );
    expect(
      founder.sceneSections.find((section) => section.id === "founder-qa-variants")?.items[0]?.href,
    ).toContain("/founder-qa/");
    expect(
      sales.sceneSections.map((section) => section.id),
    ).toEqual(
      expect.arrayContaining([
        "top-leads",
        "top-followups",
        "top-proposal-offer-moves",
        "top-objection-clarification",
        "top-conversion-blockers",
        "sales-followup-variants",
        "sales-objection-variants",
      ]),
    );
    expect(
      sales.sceneSections.find((section) => section.id === "sales-followup-variants")?.items[0]?.href,
    ).toContain("/sales-followups/");
    expect(
      sales.sceneSections.find((section) => section.id === "sales-objection-variants")?.items[0]?.href,
    ).toContain("/sales-objections/");
    expect(
      delivery.sceneSections.map((section) => section.id),
    ).toEqual(
      expect.arrayContaining([
        "walkthrough",
        "activation",
        "proposal-review",
        "package-clarification",
        "risk-clarification",
        "next-step-delivery-move",
        "delivery-walkthrough-variants",
        "delivery-review-variants",
      ]),
    );
    expect(
      delivery.sceneSections.find((section) => section.id === "delivery-walkthrough-variants")?.items[0]?.href,
    ).toContain("/delivery-walkthroughs/");
    expect(
      delivery.sceneSections.find((section) => section.id === "delivery-review-variants")?.items[0]?.href,
    ).toContain("/delivery-reviews/");
    expect(
      customerSuccess.sceneSections.map((section) => section.id),
    ).toEqual(
      expect.arrayContaining([
        "success-follow-through",
        "expansion-review",
        "issue-follow-through",
        "customer-success-issue-escalation-variants",
        "success-issue-variants",
        "escalation-variants",
        "success-check-variants",
        "renewal-expansion-risk-variants",
        "expansion-review-variants",
      ]),
    );
    expect(
      customerSuccess.sceneSections.find((section) => section.id === "customer-success-issue-escalation-variants")?.items[0]?.href,
    ).toContain("/customer-success/");
    expect(
      customerSuccess.sceneSections.find((section) => section.id === "success-issue-variants")?.items[0]?.href,
    ).toContain("/customer-success/");
    expect(
      customerSuccess.sceneSections.find((section) => section.id === "escalation-variants")?.items[0]?.href,
    ).toContain("/customer-success/");
    expect(
      customerSuccess.sceneSections.find((section) => section.id === "success-check-variants")?.items[0]?.href,
    ).toContain("/success-checks/");
    expect(
      customerSuccess.sceneSections.find((section) => section.id === "renewal-expansion-risk-variants")?.items[0]?.href,
    ).toMatch(/\/(success-checks|expansion-reviews)\//);
    expect(
      customerSuccess.sceneSections.find((section) => section.id === "expansion-review-variants")?.items[0]?.href,
    ).toContain("/expansion-reviews/");
    expect(customerSuccess.immediateActions.length).toBeGreaterThan(0);
    expect(customerSuccess.decisionsWaiting.length).toBeGreaterThan(0);
    expect(Array.isArray(customerSuccess.blockersToClear)).toBe(true);
    expect(recruiting.topHandoffs.some((item) => item.kind === "CANDIDATE")).toBe(
      true,
    );
    expect(recruiting.nextActions[0]?.label).toBeTruthy();
    expect(
      recruiting.sceneSections.map((section) => section.id),
    ).toEqual(
      expect.arrayContaining([
        "candidate-fit",
        "next-interview",
        "offer-readiness",
      ]),
    );
    expect(
      partner.sceneSections.map((section) => section.id),
    ).toEqual(
      expect.arrayContaining([
        "partner-fit",
        "custom-delivery",
        "customer-matching",
      ]),
    );
  });
});
