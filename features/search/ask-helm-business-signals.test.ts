import { describe, expect, it } from "vitest";
import {
  buildAskHelmBusinessSignalsFromRecords,
  buildAskHelmMemorySummariesFromFacts,
  mergeAskHelmGroundedObjects,
  pickAskHelmTopBusinessSignal,
  selectAskHelmBusinessSignalsForQuestion,
  summarizeAskHelmBusinessSignals,
} from "@/features/search/ask-helm-business-signals";

describe("Ask Helm business signal builder", () => {
  const now = new Date("2026-05-11T08:00:00.000Z");
  const workspaceId = "workspace_demo";

  it("ranks high-risk approvals over stale opportunities and caps at five signals", () => {
    const signals = buildAskHelmBusinessSignalsFromRecords({
      workspaceId,
      now,
      opportunities: [
        {
          id: "opp_stale_a",
          workspaceId,
          title: "Atlas renewal",
          stage: "ADVANCING",
          riskLevel: "MEDIUM",
          lastProgressAt: new Date("2026-04-01T00:00:00.000Z"),
          company: { name: "星河连锁" },
        },
        {
          id: "opp_stale_b",
          workspaceId,
          title: "瀚海拓展",
          stage: "WAITING_THEM",
          riskLevel: "MEDIUM",
          lastProgressAt: new Date("2026-04-01T00:00:00.000Z"),
        },
        {
          id: "opp_done",
          workspaceId,
          title: "已完成",
          stage: "DONE",
          riskLevel: "CRITICAL",
        },
      ],
      pendingApprovals: [
        {
          id: "approval_unbound",
          isHighRisk: true,
          reasoning: "需要确认是否替客户发送续约邮件",
          actionItem: {
            id: "action_unbound",
            title: "续约邮件草稿待复核",
            riskLevel: "HIGH",
          },
        },
        {
          id: "approval_low",
          isHighRisk: false,
          actionItem: {
            id: "action_low",
            title: "内部跟进确认",
            riskLevel: "MEDIUM",
          },
        },
      ],
    });

    expect(signals.length).toBeGreaterThanOrEqual(3);
    expect(signals.length).toBeLessThanOrEqual(5);
    expect(signals[0].kind).toBe("pending_review");
    expect(signals[0].title).toContain("续约邮件草稿待复核");
    expect(signals[0].score).toBeGreaterThanOrEqual(signals[1]?.score ?? -1);
    expect(signals[0].reviewPosture).toBe("review_required");

    expect(signals.find((signal) => signal.object?.objectId === "opp_done"))
      .toBeUndefined();
    expect(signals.some((signal) => signal.kind === "stale_opportunity")).toBe(true);
  });

  it("dedupes by the same opportunity object keeping the highest score", () => {
    const signals = buildAskHelmBusinessSignalsFromRecords({
      workspaceId,
      now,
      opportunities: [
        {
          id: "opp_shared",
          workspaceId,
          title: "Atlas renewal",
          stage: "ADVANCING",
          riskLevel: "HIGH",
          dueDate: new Date("2026-05-01T00:00:00.000Z"),
        },
      ],
      pendingApprovals: [
        {
          id: "approval_shared",
          isHighRisk: false,
          actionItem: {
            id: "action_shared",
            title: "Atlas 续约审批草稿",
            riskLevel: "MEDIUM",
            opportunityId: "opp_shared",
            opportunity: {
              id: "opp_shared",
              workspaceId,
              title: "Atlas renewal",
              stage: "ADVANCING",
              riskLevel: "HIGH",
            },
          },
        },
      ],
    });

    const matched = signals.filter(
      (signal) => signal.object?.objectId === "opp_shared",
    );
    expect(matched).toHaveLength(1);
    expect(matched[0].kind).toBe("overdue_followup");
  });

  it("ignores closed stages and low-importance memory while keeping evidence refs grounded", () => {
    const signals = buildAskHelmBusinessSignalsFromRecords({
      workspaceId,
      now,
      opportunities: [
        {
          id: "opp_done",
          workspaceId,
          title: "已完成机会",
          stage: "DONE",
          riskLevel: "CRITICAL",
        },
        {
          id: "opp_risk",
          workspaceId,
          title: "高风险机会",
          stage: "ADVANCING",
          riskLevel: "CRITICAL",
        },
      ],
      memoryFacts: [
        {
          id: "fact_low",
          workspaceId,
          objectType: "OPPORTUNITY",
          objectId: "opp_risk",
          factType: "SUMMARY",
          title: "无关紧要的总结",
          content: "客户三周前提到偏好邮件沟通",
          sourceType: "EMAIL_MESSAGE",
          sourceId: "msg_1",
          confidence: 50,
          importance: 30,
          freshnessScore: 30,
          status: "ACTIVE",
        },
      ],
    });

    expect(signals.find((signal) => signal.object?.objectId === "opp_done")).toBeUndefined();
    const riskSignal = signals.find((signal) => signal.object?.objectId === "opp_risk");
    expect(riskSignal?.kind).toBe("high_risk_opportunity");
    expect(riskSignal?.evidenceRefs).toContain(`workspace:${workspaceId}`);
    expect(riskSignal?.evidenceRefs).toContain("opportunity:opp_risk");
    expect(signals.some((signal) => signal.id.startsWith("memory-fact:fact_low"))).toBe(false);
  });

  it("turns reviewed-active memory facts into reviewed_active summaries only", () => {
    const summaries = buildAskHelmMemorySummariesFromFacts([
      {
        id: "fact_active",
        workspaceId,
        objectType: "OPPORTUNITY",
        objectId: "opp_overdue",
        factType: "BLOCKER",
        title: "法务卡点",
        content: "客户法务在审合同条款，需要补充 SLA",
        sourceType: "MEETING_NOTE",
        sourceId: "note_1",
        confidence: 80,
        importance: 80,
        freshnessScore: 80,
        status: "ACTIVE",
      },
      {
        id: "fact_invalid",
        workspaceId,
        objectType: "OPPORTUNITY",
        objectId: "opp_overdue",
        factType: "BLOCKER",
        title: "过期信息",
        content: "已失效",
        sourceType: "MEETING_NOTE",
        sourceId: "note_2",
        confidence: 20,
        importance: 20,
        freshnessScore: 10,
        status: "INVALID",
      },
    ]);

    expect(summaries).toHaveLength(2);
    expect(summaries[0].status).toBe("reviewed_active");
    expect(summaries[0].objectRefs).toEqual([
      { type: "opportunity", id: "opp_overdue" },
    ]);
    expect(summaries[1].status).toBe("candidate");
    expect(summaries[1].contradictionStatus).toBe("confirmed");
  });

  it("provides summary helpers for layered answers", () => {
    const signals = buildAskHelmBusinessSignalsFromRecords({
      workspaceId,
      now,
      opportunities: [
        {
          id: "opp_overdue",
          workspaceId,
          title: "Helix expansion",
          stage: "ADVANCING",
          riskLevel: "HIGH",
          dueDate: new Date("2026-04-15T00:00:00.000Z"),
          company: { name: "瀚海实验" },
        },
      ],
    });

    expect(pickAskHelmTopBusinessSignal(signals)?.kind).toBe("overdue_followup");
    expect(summarizeAskHelmBusinessSignals(signals)).toHaveLength(signals.length);
  });

  it("merges grounded objects without duplicates", () => {
    const merged = mergeAskHelmGroundedObjects([
      {
        objectType: "opportunity",
        objectId: "opp_1",
        displayName: "Atlas renewal",
        status: "ADVANCING",
        deepLink: "/opportunities?opportunityId=opp_1",
      },
      {
        objectType: "opportunity",
        objectId: "opp_1",
        displayName: "Atlas renewal (dup)",
        status: "ADVANCING",
        deepLink: "/opportunities?opportunityId=opp_1",
      },
      {
        objectType: "company",
        objectId: "company_1",
        displayName: "瀚海实验",
        status: "SaaS",
        deepLink: "/companies/company_1",
      },
    ]);

    expect(merged).toHaveLength(2);
    expect(merged[0].displayName).toBe("Atlas renewal");
  });

  it("keeps object-specific asks from being hijacked by unrelated workspace-wide signals", () => {
    const signals = buildAskHelmBusinessSignalsFromRecords({
      workspaceId,
      now,
      opportunities: [
        {
          id: "opp_related",
          workspaceId,
          title: "Atlas renewal",
          stage: "ADVANCING",
          riskLevel: "HIGH",
        },
        {
          id: "opp_unrelated",
          workspaceId,
          title: "瀚海拓展",
          stage: "ADVANCING",
          riskLevel: "CRITICAL",
        },
      ],
    });

    const selectedForObject = selectAskHelmBusinessSignalsForQuestion({
      intentType: "current_status",
      signals,
      searchRelatedObjects: [
        {
          objectType: "opportunity",
          objectId: "opp_related",
          displayName: "Atlas renewal",
          status: "ADVANCING",
          deepLink: "/opportunities?opportunityId=opp_related",
        },
      ],
    });

    expect(selectedForObject).toHaveLength(1);
    expect(selectedForObject[0].object?.objectId).toBe("opp_related");

    const selectedForWorkspace = selectAskHelmBusinessSignalsForQuestion({
      intentType: "today_priority",
      signals,
      searchRelatedObjects: [],
    });

    expect(selectedForWorkspace.length).toBeGreaterThan(1);
  });
});
