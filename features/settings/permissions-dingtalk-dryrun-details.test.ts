/**
 * @vitest-environment jsdom
 */

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { TeamPermissionsCard } from "@/features/settings/components/permissions-settings";
import { parseDingTalkDirectoryInviteDryRunSummary } from "@/features/settings/queries";

describe("dingtalk dry-run detail readout", () => {
  it("parses dry-run payload from usage metadata shape", () => {
    const summary = parseDingTalkDirectoryInviteDryRunSummary({
      createdAt: new Date("2026-04-28T10:00:00.000Z"),
      payload: {
        provider: "DINGTALK",
        action: "DIRECTORY_INVITE_SYNC",
        dryRun: true,
        result: {
          processed: 39,
          createdUsers: 36,
          reusedUsers: 3,
          upsertedMemberships: 39,
          sentMessages: 39,
          skipped: 0,
          skippedNoMobile: 0,
          nameCollisionResolved: 0,
          errors: [],
          details: [
            {
              dingtalkUserId: "u-1",
              unionId: "union-1",
              name: "李建乐",
              mobile: "13800138000",
              normalizedPhone: "+8613800138000",
              title: "AI交付工程师",
              jobNumber: "001",
              deptIds: [123],
              isLeader: false,
              placeholderEmail: "lijianle-zj@example.com",
              userResolution: "CREATED_PLACEHOLDER_EMAIL",
              membershipStatus: "DRY_RUN_SIMULATED",
              messageStatus: "DRY_RUN_SIMULATED",
              note: null,
            },
          ],
        },
      },
    });

    expect(summary).not.toBeNull();
    expect(summary?.processed).toBe(39);
    expect(summary?.details).toHaveLength(1);
    expect(summary?.details[0]?.name).toBe("李建乐");
    expect(summary?.details[0]?.placeholderEmail).toBe(
      "lijianle-zj@example.com",
    );
  });

  it("parses legacy top-level dry-run payload without nested result", () => {
    const summary = parseDingTalkDirectoryInviteDryRunSummary({
      createdAt: new Date("2026-04-28T10:00:00.000Z"),
      payload: {
        provider: "DINGTALK",
        action: "DIRECTORY_INVITE_SYNC",
        dryRun: "true",
        processed: 39,
        createdUsers: 36,
        reusedUsers: 3,
        upsertedMemberships: 39,
        sentMessages: 39,
        skipped: 0,
        skippedNoMobile: 0,
        nameCollisionResolved: 0,
        errors: [],
        details: [
          {
            dingtalkUserId: "u-legacy-1",
            name: "李建乐",
            normalizedPhone: "+8613800138000",
            deptIds: [123],
            userResolution: "CREATED_PLACEHOLDER_EMAIL",
            membershipStatus: "DRY_RUN_SIMULATED",
            messageStatus: "DRY_RUN_SIMULATED",
          },
        ],
      },
    });

    expect(summary).not.toBeNull();
    expect(summary?.processed).toBe(39);
    expect(summary?.details).toHaveLength(1);
    expect(summary?.details[0]?.dingtalkUserId).toBe("u-legacy-1");
  });

  it("parses snapshot payload with details array", () => {
    const summary = parseDingTalkDirectoryInviteDryRunSummary({
      createdAt: new Date("2026-04-28T10:00:00.000Z"),
      payload: {
        dryRun: true,
        result: {
          processed: 2,
          createdUsers: 1,
          reusedUsers: 1,
          upsertedMemberships: 2,
          sentMessages: 2,
          skipped: 0,
          skippedNoMobile: 0,
          nameCollisionResolved: 0,
          errors: [],
          details: [
            {
              dingtalkUserId: "u-snapshot-1",
              name: "张三",
              normalizedPhone: "+8613900000000",
              deptIds: [200],
              userResolution: "CREATED_PLACEHOLDER_EMAIL",
              membershipStatus: "DRY_RUN_SIMULATED",
              messageStatus: "DRY_RUN_SIMULATED",
            },
          ],
        },
      },
    });

    expect(summary).not.toBeNull();
    expect(summary?.details[0]?.dingtalkUserId).toBe("u-snapshot-1");
  });

  it("renders dry-run details on team permissions card when connectors are manageable", () => {
    const parsed = parseDingTalkDirectoryInviteDryRunSummary({
      createdAt: new Date("2026-04-28T10:00:00.000Z"),
      payload: {
        dryRun: true,
        result: {
          processed: 1,
          createdUsers: 1,
          reusedUsers: 0,
          upsertedMemberships: 1,
          sentMessages: 1,
          skipped: 0,
          skippedNoMobile: 0,
          nameCollisionResolved: 0,
          errors: [],
          details: [
            {
              dingtalkUserId: "u-1",
              unionId: "union-1",
              name: "李建乐",
              mobile: "13800138000",
              normalizedPhone: "+8613800138000",
              title: "AI交付工程师",
              jobNumber: "001",
              deptIds: [123],
              isLeader: false,
              placeholderEmail: "lijianle-zj@example.com",
              userResolution: "CREATED_PLACEHOLDER_EMAIL",
              membershipStatus: "DRY_RUN_SIMULATED",
              messageStatus: "DRY_RUN_SIMULATED",
              note: null,
            },
            {
              dingtalkUserId: "u-2",
              unionId: "union-2",
              name: "张露",
              mobile: "13900000000",
              normalizedPhone: "+8613900000000",
              title: "财务经理",
              jobNumber: "002",
              deptIds: [456],
              isLeader: false,
              placeholderEmail: "zhanglu-zj@example.com",
              userResolution: "REUSED_BY_PHONE",
              membershipStatus: "INVITED_UPSERTED",
              messageStatus: "SENT",
              note: null,
            },
          ],
        },
      },
    });

    render(
      createElement(TeamPermissionsCard, {
        activeMembershipRole: "OWNER",
        activeOwnerCount: 1,
        addMember: () => undefined,
        canManageConnectors: true,
        canManageMembers: false,
        dingtalkDirectoryInviteDryRun: parsed,
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
          role: "MEMBER",
          title: "",
          rolePresetKey: "GENERAL_OPERATOR",
        },
        memberships: [
          {
            id: "m-1",
            role: "OWNER",
            status: "ACTIVE",
            joinedAt: new Date("2026-04-28T10:00:00.000Z"),
            title: "负责人",
            goalTitle: null,
            goalDescription: null,
            goalItemsJson: null,
            jobResponsibilities: null,
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
            key: "GENERAL_OPERATOR",
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
      }),
    );

    expect(screen.getByText("钉钉待邀请人员明细（最近 dry-run）")).toBeInTheDocument();
    expect(screen.getByText("李建乐")).toBeInTheDocument();
    expect(screen.getByText("+8613800138000")).toBeInTheDocument();
    expect(screen.getByText("lijianle-zj@example.com")).toBeInTheDocument();
    expect(screen.getByText("待邀请")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "邀请" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重新邀请" })).toBeInTheDocument();
  });
});
