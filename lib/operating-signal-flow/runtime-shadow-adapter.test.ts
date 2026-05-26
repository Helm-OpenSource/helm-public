import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  buildOperatingSignalFlowRuntimeShadowSnapshot,
  OPERATING_SIGNAL_FLOW_SHADOW_FIELD_SELECTORS,
  resolveOperatingSignalFlowRuntimeShadowSnapshot,
  type OperatingSignalFlowShadowActionRow,
  type OperatingSignalFlowShadowApprovalRow,
  type OperatingSignalFlowShadowAuditRow,
} from "@/lib/operating-signal-flow/runtime-shadow-adapter";

const ORIGINAL_ENV = { ...process.env };
const NOW = new Date("2026-05-21T06:30:00.000Z");

function actionRow(overrides: Partial<OperatingSignalFlowShadowActionRow> = {}): OperatingSignalFlowShadowActionRow {
  return {
    id: "action-1",
    workspaceId: "ws-1",
    ownerId: "owner-1",
    actionType: "CREATE_TASK",
    sourceType: "SYSTEM_INFERENCE",
    riskLevel: "HIGH",
    suggestedAt: new Date("2026-05-21T05:30:00.000Z"),
    dueDate: new Date("2026-05-22T05:30:00.000Z"),
    executedAt: null,
    status: "PENDING_APPROVAL",
    executionStatus: "pending",
    executionMode: "REQUIRES_APPROVAL",
    requiresApproval: true,
    createdAt: new Date("2026-05-21T05:30:00.000Z"),
    updatedAt: new Date("2026-05-21T05:40:00.000Z"),
    ...overrides,
  };
}

function approvalRow(
  overrides: Partial<OperatingSignalFlowShadowApprovalRow> = {},
): OperatingSignalFlowShadowApprovalRow {
  return {
    id: "approval-1",
    workspaceId: "ws-1",
    status: "PENDING",
    isHighRisk: true,
    autoExecute: false,
    reviewedAt: null,
    createdAt: new Date("2026-05-21T05:45:00.000Z"),
    updatedAt: new Date("2026-05-21T05:45:00.000Z"),
    ...overrides,
  };
}

function auditRow(overrides: Partial<OperatingSignalFlowShadowAuditRow> = {}): OperatingSignalFlowShadowAuditRow {
  return {
    id: "audit-1",
    workspaceId: "ws-1",
    actorType: "SYSTEM",
    actionType: "OPERATING_SIGNAL_FLOW_PHASE3A_PLAN_COMPLETED",
    targetType: "ActionItem",
    relatedObjectType: "ActionItem",
    traceId: "trace-raw-secret",
    requestId: "request-raw-secret",
    parentEventId: "parent-raw-secret",
    createdAt: new Date("2026-05-21T06:00:00.000Z"),
    ...overrides,
  };
}

describe("operating signal flow / runtime shadow adapter", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.OPERATING_SIGNAL_FLOW_RUNTIME_SHADOW_ENABLED;
    delete process.env.OPERATING_SIGNAL_FLOW_RUNTIME_SHADOW_ALLOWLIST;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("returns disabled without touching the runtime query path when the flag is off", async () => {
    await expect(
      resolveOperatingSignalFlowRuntimeShadowSnapshot({ workspaceId: "ws-1", now: NOW }),
    ).resolves.toEqual({ state: "disabled", reason: "flag_off" });
  });

  it("keeps forbidden rich text and raw payload fields out of the Prisma selectors", () => {
    expect(Object.keys(OPERATING_SIGNAL_FLOW_SHADOW_FIELD_SELECTORS.actionItem)).not.toEqual(
      expect.arrayContaining(["description", "aiReason", "draftContent", "metadata", "policySnapshot"]),
    );
    expect(Object.keys(OPERATING_SIGNAL_FLOW_SHADOW_FIELD_SELECTORS.approvalTask)).not.toEqual(
      expect.arrayContaining(["contextSnapshot", "reasoning", "editableContent", "resultPreview", "decisionReason"]),
    );
    expect(Object.keys(OPERATING_SIGNAL_FLOW_SHADOW_FIELD_SELECTORS.auditLog)).not.toEqual(
      expect.arrayContaining(["summary", "payload", "actor", "sourcePage"]),
    );
  });

  it("builds a deterministic current-window shadow snapshot without exposing raw trace ids", () => {
    const result = buildOperatingSignalFlowRuntimeShadowSnapshot({
      workspaceId: "ws-1",
      window: "24h",
      generatedAt: NOW,
      actions: [actionRow()],
      approvals: [approvalRow()],
      audits: [auditRow()],
    });

    expect(result.state).toBe("shadow_ready");
    if (result.state !== "shadow_ready") throw new Error("expected shadow_ready");

    expect(result.snapshot.dataPosture).toBe("current_window");
    expect(result.snapshot.fixtureBannerVisible).toBe(false);
    expect(result.snapshot.boundaryStatementVisible).toBe(true);
    expect(result.snapshot.aiWorkPosture.boundaryStoppedCount).toBe(0);
    expect(result.diagnostics).toMatchObject({
      actionCount: 1,
      approvalCount: 1,
      auditCount: 1,
      tracePresenceCount: 1,
      workspaceCount: 1,
    });

    const serialized = JSON.stringify(result.snapshot);
    expect(serialized).not.toContain("trace-raw-secret");
    expect(serialized).not.toContain("request-raw-secret");
    expect(serialized).not.toContain("parent-raw-secret");
    expect(result.snapshot.events.map((event) => event.signalKey)).toEqual([
      "osf-shadow-action-001",
      "osf-shadow-approval-001",
      "osf-shadow-audit-001",
    ]);
  });

  it("degrades instead of projecting cross-workspace rows", () => {
    const result = buildOperatingSignalFlowRuntimeShadowSnapshot({
      workspaceId: "ws-1",
      window: "24h",
      generatedAt: NOW,
      actions: [actionRow(), actionRow({ id: "action-2", workspaceId: "ws-2" })],
      approvals: [],
      audits: [],
    });

    expect(result).toEqual({
      state: "degraded",
      reason: "cross_workspace_projection",
      diagnostics: {
        actionCount: 2,
        approvalCount: 0,
        auditCount: 0,
        boundaryCounter: 0,
        pendingReviewCount: 2,
        tracePresenceCount: 0,
        workspaceCount: 2,
      },
    });
  });

  it("counts auto-execution posture as a boundary counter in shadow only", () => {
    const result = buildOperatingSignalFlowRuntimeShadowSnapshot({
      workspaceId: "ws-1",
      window: "24h",
      generatedAt: NOW,
      actions: [actionRow({ executionMode: "AUTO_WITHIN_THRESHOLD", requiresApproval: false })],
      approvals: [approvalRow({ autoExecute: true })],
      audits: [],
    });

    expect(result.state).toBe("shadow_ready");
    if (result.state !== "shadow_ready") throw new Error("expected shadow_ready");

    expect(result.diagnostics.boundaryCounter).toBe(2);
    expect(result.snapshot.aiWorkPosture.boundaryStoppedCount).toBe(2);
    expect(result.snapshot.edges.some((edge) => edge.boundaryCounter === 2)).toBe(true);
  });
});
