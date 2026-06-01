import "server-only";

import { subDays } from "date-fns";
import { ActorType, ApprovalStatus, WorkspaceClass, WorkspaceStatus } from "@prisma/client";
import { safeWriteAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import {
  assertTenantHealthAccess,
  type TenantHealthAccessWorkspace,
} from "@/lib/self-tenant-health/privacy";
import { consumeTenantHealthViewBudget } from "@/lib/self-tenant-health/rate-limit";
import { buildTenantHealthDashboardData } from "@/lib/self-tenant-health/rollup";
import type { TenantHealthDashboardData } from "@/lib/self-tenant-health/types";

export class TenantHealthRateLimitError extends Error {
  constructor() {
    super("Tenant health telemetry view rate limit exceeded.");
    this.name = "TenantHealthRateLimitError";
  }
}

export async function getSelfTenantHealthDashboardData(input: {
  viewerWorkspace: TenantHealthAccessWorkspace;
  viewerWorkspaceId: string;
  viewerUserId: string;
  viewerName: string;
  windowDays?: number;
  now?: Date;
}): Promise<TenantHealthDashboardData> {
  assertTenantHealthAccess(input.viewerWorkspace);

  const rateLimitKey = `${input.viewerWorkspaceId}:${input.viewerUserId}`;
  if (!consumeTenantHealthViewBudget(rateLimitKey)) {
    throw new TenantHealthRateLimitError();
  }

  const now = input.now ?? new Date();
  const windowStart = subDays(now, input.windowDays ?? 7);
  const whereWindow = {
    gte: windowStart,
    lte: now,
  };

  const [workspaces, signalEvents, auditLogs, approvalTasks, llmCalls, budgetRules] =
    await Promise.all([
      db.workspace.findMany({
        where: {
          workspaceClass: WorkspaceClass.CUSTOMER,
          status: {
            not: WorkspaceStatus.CANCELED,
          },
        },
        select: {
          id: true,
          status: true,
        },
        orderBy: { createdAt: "asc" },
        take: 200,
      }),
      db.signalEvent.findMany({
        where: { createdAt: whereWindow },
        select: {
          workspaceId: true,
          sourceType: true,
          signalType: true,
          truthWeight: true,
          createdAt: true,
        },
        take: 5_000,
      }),
      db.auditLog.findMany({
        where: { createdAt: whereWindow },
        select: {
          workspaceId: true,
          actionType: true,
          targetType: true,
          targetId: true,
          relatedObjectType: true,
          createdAt: true,
        },
        take: 8_000,
      }),
      db.approvalTask.findMany({
        where: {
          OR: [
            { createdAt: whereWindow },
            { reviewedAt: whereWindow },
            { status: ApprovalStatus.PENDING },
          ],
        },
        select: {
          id: true,
          workspaceId: true,
          status: true,
          createdAt: true,
          reviewedAt: true,
        },
        take: 8_000,
      }),
      db.lLMCallLog.findMany({
        where: { createdAt: whereWindow },
        select: {
          workspaceId: true,
          provider: true,
          model: true,
          modelRole: true,
          taskType: true,
          tokenUsagePrompt: true,
          tokenUsageCompletion: true,
          latencyMs: true,
          success: true,
          fallbackReason: true,
          createdAt: true,
        },
        take: 8_000,
      }),
      db.budgetRule.findMany({
        where: {
          OR: [
            { scope: "llm" },
            { scope: "llm_estimated_cost_minor_unit" },
            { scope: "llm_monthly_cost" },
          ],
        },
        select: {
          workspaceId: true,
          monthlyLimit: true,
          warningThreshold: true,
        },
        take: 1_000,
      }),
    ]);

  const data = buildTenantHealthDashboardData({
    workspaces,
    signalEvents,
    auditLogs,
    approvalTasks,
    llmCalls,
    budgetRules,
    windowStart,
    windowEnd: now,
  });

  await safeWriteAuditLog({
    workspaceId: input.viewerWorkspaceId,
    userId: input.viewerUserId,
    actor: input.viewerName,
    actorType: ActorType.USER,
    actionType: "TENANT_HEALTH_VIEW_LOG",
    targetType: "TenantHealthTelemetry",
    targetId: input.viewerWorkspaceId,
    summary: "Tenant health read-only dashboard viewed.",
    sourcePage: "/operating/tenant-health",
    payload: {
      rowCount: data.rows.length,
      windowDays: input.windowDays ?? 7,
      healthBuckets: {
        green: data.summary.greenCount,
        watch: data.summary.watchCount,
        risk: data.summary.riskCount,
        blocked: data.summary.blockedCount,
      },
    },
  });

  return data;
}
