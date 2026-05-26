import { beforeEach, describe, expect, it, vi } from "vitest";

const { membershipHelperMock } = vi.hoisted(() => ({
  membershipHelperMock: {
    findMembershipsWithExistingUsers: vi.fn(),
  },
}));

vi.mock("@/lib/auth/membership-with-user", () => ({
  findMembershipsWithExistingUsers:
    membershipHelperMock.findMembershipsWithExistingUsers,
}));

import { resolveBiReportSignalOwner } from "@/lib/bi-report-skill/signal-routing";

describe("bi report signal routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("prefers operations-finance preset for critical finance-style signals", async () => {
    membershipHelperMock.findMembershipsWithExistingUsers.mockResolvedValue([
      {
        role: "OPERATOR",
        rolePresetKey: "OPERATIONS_FINANCE",
        persona: "财务运营",
        joinedAt: new Date("2026-04-22T09:00:00Z"),
        user: { id: "user-finance", name: "财务负责人", email: "finance@example.com" },
      },
      {
        role: "OPERATOR",
        rolePresetKey: "GENERAL_OPERATOR",
        persona: "运营专员",
        joinedAt: new Date("2026-04-22T10:00:00Z"),
        user: { id: "user-operator", name: "操作人", email: "operator@example.com" },
      },
      {
        role: "OWNER",
        rolePresetKey: "FOUNDER_CEO",
        persona: "创始人",
        joinedAt: new Date("2026-04-22T11:00:00Z"),
        user: { id: "user-owner", name: "负责人", email: "owner@example.com" },
      },
    ]);

    const owner = await resolveBiReportSignalOwner({
      workspaceId: "workspace-1",
      skillKey: "bi_business_income_expense_monthly",
      severity: "CRITICAL",
      signalType: "finance_margin_anomaly",
    });

    expect(membershipHelperMock.findMembershipsWithExistingUsers).toHaveBeenCalledWith({
      where: {
        workspaceId: "workspace-1",
        status: "ACTIVE",
      },
      orderBy: {
        joinedAt: "asc",
      },
    });
    expect(owner).toEqual({
      userId: "user-finance",
      name: "财务负责人",
      email: "finance@example.com",
      role: "OPERATOR",
    });
  });

  it("prefers operator persona for aging repay alerts", async () => {
    membershipHelperMock.findMembershipsWithExistingUsers.mockResolvedValue([
      {
        role: "ADMIN",
        rolePresetKey: "DELIVERY_LEAD",
        persona: "交付主管",
        joinedAt: new Date("2026-04-22T10:00:00Z"),
        user: { id: "user-admin", name: "管理员", email: "admin@example.com" },
      },
      {
        role: "OPERATOR",
        rolePresetKey: "GENERAL_OPERATOR",
        persona: "催收运营",
        joinedAt: new Date("2026-04-22T11:00:00Z"),
        user: { id: "user-operator", name: "操作人", email: "operator@example.com" },
      },
    ]);

    const owner = await resolveBiReportSignalOwner({
      workspaceId: "workspace-1",
      skillKey: "bi_mtype_repay_monthly",
      severity: "ALERT",
      signalType: "ptp_fulfillment_gap",
    });

    expect(owner?.role).toBe("OPERATOR");
    expect(owner?.userId).toBe("user-operator");
  });

  it("returns null when there is no active membership", async () => {
    membershipHelperMock.findMembershipsWithExistingUsers.mockResolvedValue([]);

    const owner = await resolveBiReportSignalOwner({
      workspaceId: "workspace-1",
      skillKey: "bi_repay_daily",
      severity: "WARN",
    });

    expect(owner).toBeNull();
  });

  it("prefers delivery-lead persona for complaint-style collection signals", async () => {
    membershipHelperMock.findMembershipsWithExistingUsers.mockResolvedValue([
      {
        role: "OPERATOR",
        rolePresetKey: "GENERAL_OPERATOR",
        persona: "催收专员",
        joinedAt: new Date("2026-04-22T10:00:00Z"),
        user: {
          id: "user-operator",
          name: "坐席负责人",
          email: "operator@example.com",
        },
      },
      {
        role: "OWNER",
        rolePresetKey: "DELIVERY_LEAD",
        persona: "交付主管",
        joinedAt: new Date("2026-04-22T11:00:00Z"),
        user: {
          id: "user-delivery-lead",
          name: "交付主管",
          email: "delivery.lead@example.com",
        },
      },
    ]);

    const owner = await resolveBiReportSignalOwner({
      workspaceId: "workspace-1",
      skillKey: "bi_collection_operating_signal_daily",
      severity: "CRITICAL",
      signalType: "complaint_risk_rising",
    });

    expect(owner).toEqual({
      userId: "user-delivery-lead",
      name: "交付主管",
      email: "delivery.lead@example.com",
      role: "OWNER",
    });
    expect(membershipHelperMock.findMembershipsWithExistingUsers).toHaveBeenCalledOnce();
  });
});
