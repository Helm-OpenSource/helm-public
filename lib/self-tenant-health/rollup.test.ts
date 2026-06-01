import { describe, expect, it } from "vitest";
import { buildTenantHealthDashboardData } from "@/lib/self-tenant-health/rollup";

const now = new Date("2026-05-12T08:00:00.000Z");
const windowStart = new Date("2026-05-05T08:00:00.000Z");

function workspace(id: string) {
  return { id, status: "ACTIVE" };
}

describe("self-tenant signal health rollup", () => {
  it("marks boundary incidents as blocked and never needs raw summaries", () => {
    const data = buildTenantHealthDashboardData({
      workspaces: [workspace("workspace_a")],
      signalEvents: [
        {
          workspaceId: "workspace_a",
          sourceType: "meeting",
          signalType: "risk",
          truthWeight: 1,
          createdAt: now,
        },
      ],
      auditLogs: [
        {
          workspaceId: "workspace_a",
          actionType: "SIGNAL_BOUNDARY_INCIDENT_BLOCKED",
          targetType: "SignalEvent",
          relatedObjectType: "meeting",
          createdAt: now,
        },
      ],
      llmCalls: [],
      windowStart,
      windowEnd: now,
      aliasSalt: "test_salt",
    });

    expect(data.rows[0]).toMatchObject({
      tenantAlias: "tenant_15cd0ae8",
      candidateCount: 1,
      unsafeBoundaryCount: 1,
      healthState: "blocked",
      supportReasonCodes: ["boundary_incident"],
    });
    expect(data.rows[0]).not.toHaveProperty("workspaceId");
  });

  it("flags low validity and duplicate noise at the documented thresholds", () => {
    const signalEvents = Array.from({ length: 5 }, (_, index) => ({
      workspaceId: "workspace_b",
      sourceType: "crm",
      signalType: "opportunity",
      truthWeight: index < 3 ? 1 : 0,
      createdAt: now,
    }));
    const auditLogs = [
      "SIGNAL_DUPLICATE_NOISE",
      "SIGNAL_DUPLICATE_NOISE",
    ].map((actionType) => ({
      workspaceId: "workspace_b",
      actionType,
      targetType: "SignalEvent",
      relatedObjectType: "opportunity",
      createdAt: now,
    }));

    const data = buildTenantHealthDashboardData({
      workspaces: [workspace("workspace_b")],
      signalEvents,
      auditLogs,
      llmCalls: [],
      windowStart,
      windowEnd: now,
      aliasSalt: "test_salt",
    });

    expect(data.rows[0].healthState).toBe("risk");
    expect(data.rows[0].supportReasonCodes).toEqual([
      "low_validity_pass_rate",
      "duplicate_noise",
      "low_accepted_rate",
    ]);
  });

  it("keeps LLM costs as buckets and budget states", () => {
    const data = buildTenantHealthDashboardData({
      workspaces: [workspace("workspace_c")],
      signalEvents: [],
      auditLogs: [],
      llmCalls: [
        {
          workspaceId: "workspace_c",
          provider: "qwen",
          model: "qwen3.6-plus",
          modelRole: "reasoning",
          taskType: "ask_helm",
          tokenUsagePrompt: 1_000_000,
          tokenUsageCompletion: 1_000_000,
          latencyMs: 1000,
          success: true,
          fallbackReason: null,
          createdAt: now,
        },
      ],
      budgetRules: [
        {
          workspaceId: "workspace_c",
          monthlyLimit: 3200,
          warningThreshold: 80,
        },
      ],
      windowStart,
      windowEnd: now,
      aliasSalt: "test_salt",
    });

    expect(data.rows[0].costBucket).toBe("cny_0_100");
    expect(data.rows[0].budgetState).toBe("blocked");
    expect(data.rows[0]).not.toHaveProperty("estimatedCostMinorUnit");
    expect(data.rows[0]).not.toHaveProperty("topCostFeatureArea");
  });

  it("counts approval tasks as review-required telemetry and deduplicates approval audits", () => {
    const data = buildTenantHealthDashboardData({
      workspaces: [workspace("workspace_review")],
      signalEvents: [
        {
          workspaceId: "workspace_review",
          sourceType: "BI_REPORT_BUSINESS_SIGNAL",
          signalType: "manager_daily_intervention_required",
          truthWeight: 90,
          createdAt: now,
        },
      ],
      auditLogs: [
        {
          workspaceId: "workspace_review",
          actionType: "APPROVAL_APPROVED",
          targetType: "ApprovalTask",
          targetId: "approval_approved",
          relatedObjectType: "action",
          createdAt: now,
        },
        {
          workspaceId: "workspace_review",
          actionType: "APPROVAL_APPROVED",
          targetType: "ApprovalTask",
          targetId: "approval_approved",
          relatedObjectType: "action",
          createdAt: now,
        },
        {
          workspaceId: "workspace_review",
          actionType: "APPROVAL_REJECTED",
          targetType: "ApprovalTask",
          targetId: "approval_rejected",
          relatedObjectType: "action",
          createdAt: now,
        },
      ],
      approvalTasks: [
        {
          id: "approval_approved",
          workspaceId: "workspace_review",
          status: "EXECUTED",
          createdAt: now,
          reviewedAt: now,
        },
        {
          id: "approval_rejected",
          workspaceId: "workspace_review",
          status: "REJECTED",
          createdAt: now,
          reviewedAt: now,
        },
        {
          id: "approval_pending",
          workspaceId: "workspace_review",
          status: "PENDING",
          createdAt: now,
          reviewedAt: null,
        },
        {
          id: "approval_old_reviewed",
          workspaceId: "workspace_review",
          status: "EXECUTED",
          createdAt: new Date("2026-05-04T08:00:00.000Z"),
          reviewedAt: now,
        },
      ],
      llmCalls: [],
      windowStart,
      windowEnd: now,
      aliasSalt: "test_salt",
    });

    expect(data.rows[0]).toMatchObject({
      primarySourceType: "resource_state",
      reviewRequiredCount: 4,
      reviewedCount: 3,
      acceptedCount: 2,
      rejectedCount: 1,
      healthState: "blocked",
      supportReasonCodes: ["review_coverage_gap"],
    });
  });
});
