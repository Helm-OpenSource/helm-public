import { AccessState, WorkspaceRole } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { buildWorkspaceOperatingFoundationSummary } from "@/lib/operating-system/foundation";
import { buildGoalDrivenHomeModel } from "@/lib/operating-system/goal-driven-home";

describe("goal-driven home", () => {
  it("front-loads campaign, chain moves, blockers and decision requests", () => {
    const foundationSummary = buildWorkspaceOperatingFoundationSummary({
      locale: "zh-CN",
      workspaceName: "Helm",
      membershipRole: WorkspaceRole.OWNER,
      accessState: AccessState.ACTIVE,
      profileType: "创始人 / COO",
      focusAreasJson: JSON.stringify(["客户推进", "伙伴拓展", "招聘推进"]),
      topJudgements: [
        "先保住 Acme 的付费推进",
        "把 renewal 风险继续压在前台",
        "让 Founder / Sales / Delivery 共用同一条经营链",
      ],
      topPriorityHref: "/operating",
      currentPage: "dashboard",
    });

    const model = buildGoalDrivenHomeModel({
      english: false,
      foundationSummary,
      dailyBriefTitle: "系统判断今天先推进“Acme 付费推进”最值。",
      dailyBriefSummary: "主因是 champion 已热，但 renewal 和审批仍在压缩节奏。",
      topJudgements: [
        {
          label: "Acme 付费推进",
          hint: "当前最重要的是把 champion 热度转成明确的下一步。",
          href: "/opportunities?opportunityId=opp_acme",
        },
      ],
      topChains: [
        {
          label: "Acme 付费推进链",
          hint: "从 proposal 到 sendability 再到外部确认。",
          href: "/operating",
        },
      ],
      topDecisionRequests: [
        {
          label: "Founder 需要确认商业边界",
          hint: "新的对外承诺还不能越过 non-commitment boundary。",
          href: "/approvals",
        },
      ],
      roleHandoffs: [
        {
          label: "Sales 接手 Acme",
          hint: "当前最应该先推进 follow-up 和 objection clarification。",
          href: "/operating/roles/sales",
        },
      ],
      highRiskOpportunity: {
        label: "Beta renewal 风险正在升高",
        hint: "先处理 renewal risk clarification，再决定是否扩写承诺。",
        href: "/customer-success/opp_beta",
      },
      pendingApprovals: 2,
      waitingOnUsThreadCount: 3,
      followUpDueCount: 4,
      meetingsToday: 2,
      importedSignalCount: 5,
      executedToday: 6,
    });

    expect(model.currentCampaign.summary).toContain("当前主战役");
    expect(model.topJudgements).toHaveLength(3);
    expect(model.immediateActions).toHaveLength(3);
    expect(model.topChains).toHaveLength(3);
    expect(model.topBlockers).toHaveLength(3);
    expect(model.topDecisionRequests).toHaveLength(3);
    expect(model.helmDid).toHaveLength(3);
    expect(model.roleHandoffs).toHaveLength(3);
    expect(model.actionTemplates).toHaveLength(4);
    expect(model.retroFeedback).toHaveLength(3);
    expect(model.evidenceEntries).toHaveLength(3);
    expect(model.note).toContain("常用动作模板");
  });
});
