/**
 * @vitest-environment jsdom
 */

import "@testing-library/jest-dom/vitest";
import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TeamPermissionsCard } from "@/features/settings/components/permissions-settings";

const baseProps = {
  activeMembershipRole: "OWNER" as const,
  activeOwnerCount: 1,
  addMember: () => undefined,
  canManageConnectors: false,
  dingtalkDirectoryInviteDryRun: null,
  currentUserId: "user-1",
  english: false,
  inviteGuidance: {
    title: "测试邀请",
    summary: "测试摘要",
    description: "测试说明",
    acceptanceHint: "测试提示",
  },
  inviteSelectedDingTalkDirectoryUsers: () => undefined,
  dingtalkInvitePending: false,
  memberDraft: {
    email: "",
    name: "",
    role: "MEMBER" as const,
    title: "",
    rolePresetKey: "GENERAL_OPERATOR" as const,
  },
  memberships: [
    {
      id: "m-1",
      role: "OWNER" as const,
      status: "ACTIVE" as const,
      joinedAt: new Date("2026-05-14T08:00:00.000Z"),
      title: "负责人",
      goalTitle: "本月销售推进",
      goalDescription: "确保重点客户推进到下一里程碑",
      goalItemsJson: JSON.stringify(["推进A客户复盘", "完成B客户方案"]),
      jobResponsibilities: "负责销售推进与跨团队协同",
      persona: null,
      rolePresetKey: null,
      definitionDraftJson: null,
      definitionAcceptedJson: null,
      user: {
        id: "user-1",
        name: "管理员",
        email: "owner@example.com",
      },
    },
  ],
  pending: false,
  roleLabelsByLocale: {
    OWNER: "负责人",
    BILLING_ADMIN: "计费管理员",
    ADMIN: "管理员",
    OPERATOR: "运营",
    REVIEWER: "复核",
    MEMBER: "成员",
  },
  rolePresetOptions: [
    {
      key: "GENERAL_OPERATOR" as const,
      label: "销售代表",
      summary: "默认销售职责",
    },
  ],
  seatSummary: {
    activeSeatCount: 1,
    invitedSeatCount: 0,
    inactiveSeatCount: 0,
    includedAdminSeats: 1,
    paidIncludedSeatCount: 1,
    paidIncludedSeatUsage: 1,
    additionalBillableSeats: 0,
    trialCollaboratorSeats: 2,
    trialCollaboratorSeatsUsed: 0,
    trialCollaboratorSeatsRemaining: 2,
    trialSeatCapacity: 3,
    trialSeatPressureCount: 0,
  },
  setMemberDraft: () => undefined,
  transferOwnership: () => undefined,
  updateMemberGoalProfile: () => undefined,
  updateMemberLifecycle: () => undefined,
  updateMemberRole: () => undefined,
};

const dingtalkDryRunWithInviteDetail = {
  recordedAt: new Date("2026-07-02T08:00:00.000Z"),
  processed: 1,
  createdUsers: 0,
  reusedUsers: 1,
  upsertedMemberships: 1,
  sentMessages: 1,
  skipped: 0,
  skippedNoMobile: 0,
  nameCollisionResolved: 0,
  errors: [],
  details: [
    {
      dingtalkUserId: "dt-user-1",
      unionId: null,
      name: "坐席一",
      mobile: "5550100001",
      normalizedPhone: "+15550100001",
      title: "回款顾问",
      jobNumber: "A001",
      deptIds: [1001],
      isLeader: false,
      placeholderEmail: "agent1-zj@example.com",
      userResolution: "REUSED_BY_PLACEHOLDER_EMAIL" as const,
      membershipStatus: "INVITED_UPSERTED" as const,
      messageStatus: "SENT" as const,
      note: null,
    },
  ],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("team permissions member goal profile", () => {
  it("renders goal profile editor when canManageMembers is true", () => {
    render(
      createElement(TeamPermissionsCard, {
        ...baseProps,
        canManageMembers: true,
      }),
    );

    expect(screen.getByText("目标与职责")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "保存目标与职责" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("本月销售推进")).toBeInTheDocument();
  });

  it("hides goal profile editor when canManageMembers is false", () => {
    render(
      createElement(TeamPermissionsCard, {
        ...baseProps,
        canManageMembers: false,
      }),
    );

    expect(screen.queryByText("目标与职责")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "保存目标与职责" })).not.toBeInTheDocument();
  });

  it("shows Aliyun seat binding action in the pending invite detail action column", async () => {
    window.__HELM_ALIYUN_SEAT_BINDING_API_PATH__ = "/api/tenant-seat-binding";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ok: true, bindings: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    render(
      createElement(TeamPermissionsCard, {
        ...baseProps,
        canManageConnectors: true,
        canManageMembers: true,
        dingtalkDirectoryInviteDryRun: dingtalkDryRunWithInviteDetail,
      }),
    );

    expect(
      await screen.findByRole("button", { name: "绑定坐席" }),
    ).toBeInTheDocument();
  });
});
