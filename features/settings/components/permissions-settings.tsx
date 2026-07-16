"use client";

import {
  Fragment,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { SettingsClientProps } from "@/features/settings/types/settings-client-props";
import { formatPermissionDateLabel } from "./permissions-date-labels";
import { Info, RoleGuide } from "./settings-display";

type SettingsMembership = SettingsClientProps["data"]["memberships"][number];
type SettingsSeatSummary = SettingsClientProps["data"]["seatSummary"];
type SettingsActiveMembershipRole =
  SettingsClientProps["data"]["organizationSummary"]["activeMembershipRole"];
type TeamPermissionsRole = SettingsMembership["role"];
type TeamPermissionsStatus = SettingsMembership["status"];

type TeamPermissionsMemberDraft = {
  email: string;
  name: string;
  role: TeamPermissionsRole;
  title: string;
  rolePresetKey: string;
};

type RolePresetOption = {
  key: string;
  label: string;
  summary: string;
};

type InviteGuidance = {
  title: string;
  summary: string;
  description: string;
  acceptanceHint: string;
};

type AliyunSeatBinding = {
  helmUserId: string;
  helmUserEmail: string | null;
  aliyunAgentId: string;
  status: "ACTIVE" | "DISABLED";
};

type AliyunSeatSkillGroup = {
  skillGroupId: string;
  skillGroupName: string;
  displayName: string;
};

type AliyunSeatBindingDraft = {
  rowKey: string;
  skillGroupRef: string;
  aliyunAgentId: string;
  accessKeyId: string;
  accessKeySecret: string;
  error: string | null;
};

const ALIYUN_SEAT_BINDING_API_PATH = "/api/extensions/aliyun-ccc/seat-binding";

type PermissionsRoleGuideCardProps = {
  english: boolean;
};

type TeamPermissionsCardProps = {
  activeMembershipRole: SettingsActiveMembershipRole;
  activeOwnerCount: number;
  addMember: () => void;
  canManageConnectors: boolean;
  canManageMembers: boolean;
  dingtalkDirectoryInviteDryRun:
    SettingsClientProps["data"]["dingtalkDirectoryInviteDryRun"];
  currentUserId: string;
  english: boolean;
  inviteGuidance: InviteGuidance;
  inviteSelectedDingTalkDirectoryUsers: (dingtalkUserIds: string[]) => void;
  dingtalkInvitePending: boolean;
  memberDraft: TeamPermissionsMemberDraft;
  memberships: SettingsMembership[];
  pending: boolean;
  roleLabelsByLocale: Record<string, string>;
  rolePresetOptions: RolePresetOption[];
  seatSummary: SettingsSeatSummary;
  setMemberDraft: Dispatch<SetStateAction<TeamPermissionsMemberDraft>>;
  transferOwnership: (membershipId: string) => void;
  updateMemberGoalProfile: (input: {
    membershipId: string;
    goalTitle: string;
    goalDescription: string;
    goalItems: string[];
    jobResponsibilities: string;
  }) => void;
  updateMemberGroupTag: (input: {
    membershipId: string;
    groupTag: string;
  }) => void;
  updateMemberLifecycle: (
    membershipId: string,
    nextStatus: TeamPermissionsStatus,
  ) => void;
  updateMemberRole: (
    membershipId: string,
    currentRole: TeamPermissionsRole,
    nextRole: TeamPermissionsRole,
  ) => void;
};

function MemberGroupTagEditor({
  english,
  membership,
  pending,
  updateMemberGroupTag,
}: {
  english: boolean;
  membership: SettingsMembership;
  pending: boolean;
  updateMemberGroupTag: TeamPermissionsCardProps["updateMemberGroupTag"];
}) {
  const [groupTag, setGroupTag] = useState(membership.groupTag ?? "");
  return (
    <div
      className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 py-3"
      data-testid={`member-group-tag-${membership.id}`}
    >
      <p className="text-sm font-semibold text-[color:var(--foreground)]">
        {english ? "Group tag" : "分组标签"}
      </p>
      <Input
        value={groupTag}
        onChange={(event) => setGroupTag(event.target.value)}
        placeholder={english ? "e.g. store-a (empty = full view)" : "如 门店A（留空 = 全局视图）"}
        disabled={pending}
        className="w-56"
      />
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={pending}
        onClick={() =>
          updateMemberGroupTag({ membershipId: membership.id, groupTag })
        }
      >
        {english ? "Save group" : "保存分组"}
      </Button>
      <p className="w-full text-xs leading-5 text-[color:var(--muted-foreground)]">
        {english
          ? "Group-tagged non-admin members see their own group's advancement on /operating; admins and untagged members keep the full view."
          : "带分组标签的非管理员成员在经营总盘只看本组推进；管理员与未分组成员保持全局视图。"}
      </p>
    </div>
  );
}

type MemberGoalProfileEditorProps = {
  english: boolean;
  membership: SettingsMembership;
  pending: boolean;
  updateMemberGoalProfile: TeamPermissionsCardProps["updateMemberGoalProfile"];
};

function parseGoalItems(value: string | null): string[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 10);
  } catch {
    return [];
  }
}

function MemberGoalProfileEditor({
  english,
  membership,
  pending,
  updateMemberGoalProfile,
}: MemberGoalProfileEditorProps) {
  const [goalTitle, setGoalTitle] = useState(membership.goalTitle ?? "");
  const [goalDescription, setGoalDescription] = useState(
    membership.goalDescription ?? "",
  );
  const [goalItems, setGoalItems] = useState<string[]>(
    parseGoalItems(membership.goalItemsJson),
  );
  const [jobResponsibilities, setJobResponsibilities] = useState(
    membership.jobResponsibilities ?? "",
  );

  const updateGoalItem = (index: number, value: string) => {
    setGoalItems((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? value : item)),
    );
  };

  const removeGoalItem = (index: number) => {
    setGoalItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const addGoalItem = () => {
    setGoalItems((current) => (current.length >= 10 ? current : [...current, ""]));
  };

  const saveGoalProfile = () => {
    updateMemberGoalProfile({
      membershipId: membership.id,
      goalTitle,
      goalDescription,
      goalItems,
      jobResponsibilities,
    });
  };

  return (
    <div
      className="mt-3 space-y-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 py-4"
      data-testid={`member-goal-profile-${membership.id}`}
    >
      <p className="text-sm font-semibold text-[color:var(--foreground)]">
        {english ? "Goal and responsibilities" : "目标与职责"}
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        <Input
          value={goalTitle}
          onChange={(event) => setGoalTitle(event.target.value)}
          placeholder={english ? "Goal" : "目标"}
          disabled={pending}
        />
        <div className="rounded-2xl border border-dashed border-[color:var(--border)] px-3 py-2 text-xs leading-6 text-[color:var(--muted-foreground)]">
          {english
            ? "Goal items support up to 10 entries and each entry keeps within 200 characters."
            : "具体目标内容最多 10 条，每条不超过 200 字。"}
        </div>
      </div>
      <Textarea
        value={goalDescription}
        onChange={(event) => setGoalDescription(event.target.value)}
        placeholder={english ? "Goal description" : "目标描述"}
        rows={3}
        disabled={pending}
      />
      <div className="space-y-2">
        <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
          {english ? "Specific goal items" : "具体目标内容"}
        </p>
        {goalItems.length ? (
          goalItems.map((item, index) => (
            <div key={`${membership.id}-goal-item-${index}`} className="flex items-center gap-2">
              <Input
                value={item}
                onChange={(event) => updateGoalItem(index, event.target.value)}
                placeholder={
                  english
                    ? `Goal item ${index + 1}`
                    : `目标条目 ${index + 1}`
                }
                disabled={pending}
              />
              <Button
                size="sm"
                variant="ghost"
                type="button"
                disabled={pending}
                onClick={() => removeGoalItem(index)}
              >
                {english ? "Remove" : "删除"}
              </Button>
            </div>
          ))
        ) : (
          <p className="text-xs text-[color:var(--muted-foreground)]">
            {english
              ? "No goal item yet. Add your first item."
              : "暂未设置具体目标内容，可先添加一条。"}
          </p>
        )}
        <Button
          size="sm"
          type="button"
          variant="outline"
          disabled={pending || goalItems.length >= 10}
          onClick={addGoalItem}
        >
          {english ? "Add goal item" : "添加目标条目"}
        </Button>
      </div>
      <Textarea
        value={jobResponsibilities}
        onChange={(event) => setJobResponsibilities(event.target.value)}
        placeholder={english ? "Job responsibilities" : "岗位职责"}
        rows={4}
        disabled={pending}
      />
      <Button size="sm" type="button" disabled={pending} onClick={saveGoalProfile}>
        {english ? "Save goal profile" : "保存目标与职责"}
      </Button>
    </div>
  );
}

function normalizeBindingEmail(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

function inviteDetailRowKey(input: {
  dingtalkUserId: string;
  placeholderEmail: string | null;
}): string {
  return normalizeBindingEmail(input.placeholderEmail) || input.dingtalkUserId;
}

function isAliyunSeatBinding(value: unknown): value is AliyunSeatBinding {
  if (!value || typeof value !== "object") {
    return false;
  }
  const row = value as Partial<AliyunSeatBinding>;
  return (
    typeof row.helmUserId === "string" &&
    typeof row.aliyunAgentId === "string" &&
    (row.status === "ACTIVE" || row.status === "DISABLED")
  );
}

function isAliyunSeatSkillGroup(value: unknown): value is AliyunSeatSkillGroup {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<AliyunSeatSkillGroup>;
  return (
    typeof row.skillGroupId === "string" &&
    row.skillGroupId.length > 0 &&
    typeof row.skillGroupName === "string" &&
    typeof row.displayName === "string" &&
    row.displayName.length > 0
  );
}

export function PermissionsRoleGuideCard({
  english,
}: PermissionsRoleGuideCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{english ? "Role guide" : "角色说明"}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <RoleGuide
          title={english ? "Owner" : "负责人"}
          description={
            english
              ? "Owns the organization, can switch organization context and keep the v1 operating boundary explicit."
              : "拥有组织、可切换组织上下文，并负责维持 v1 的运营边界。"
          }
        />
        <RoleGuide
          title={english ? "Billing admin" : "计费管理员"}
          description={
            english
              ? "Can manage billing overview, seat posture and future add-on worker entitlements."
              : "负责计费概览、席位姿态和未来增值能力权益。"
          }
        />
        <RoleGuide
          title={english ? "Admin" : "管理员"}
          description={
            english
              ? "Can change policies, inspect global objects and manage team membership."
              : "可以修改策略、查看全局对象和管理团队成员。"
          }
        />
        <RoleGuide
          title={
            english ? "Operator / Reviewer / Member" : "运营 / 复核 / 成员"
          }
          description={
            english
              ? "Operator keeps the loop moving, reviewer handles formal review, and member collaborates under the same workspace without turning this into a full RBAC builder."
              : "运营负责推进回路，复核负责正式评审，成员保持协作；这仍然不是完整权限构建器。"
          }
        />
      </CardContent>
    </Card>
  );
}

export function TeamPermissionsCard({
  activeMembershipRole,
  activeOwnerCount,
  addMember,
  canManageConnectors,
  canManageMembers,
  dingtalkDirectoryInviteDryRun,
  currentUserId,
  dingtalkInvitePending,
  english,
  inviteGuidance,
  inviteSelectedDingTalkDirectoryUsers,
  memberDraft,
  memberships,
  pending,
  roleLabelsByLocale,
  rolePresetOptions,
  seatSummary,
  setMemberDraft,
  transferOwnership,
  updateMemberGoalProfile,
  updateMemberGroupTag,
  updateMemberLifecycle,
  updateMemberRole,
}: TeamPermissionsCardProps) {
  const pendingInviteDetails = useMemo(
    () =>
      (dingtalkDirectoryInviteDryRun?.details ?? []).filter(
        (item) => item.messageStatus !== "SENT",
      ),
    [dingtalkDirectoryInviteDryRun],
  );
  const pendingInviteUserIds = useMemo(
    () => pendingInviteDetails.map((item) => item.dingtalkUserId),
    [pendingInviteDetails],
  );
  const pendingInviteUserIdSet = useMemo(
    () => new Set(pendingInviteUserIds),
    [pendingInviteUserIds],
  );
  const [selectedInviteUserIds, setSelectedInviteUserIds] = useState<string[]>(
    [],
  );
  const [aliyunSeatBindingAvailable, setAliyunSeatBindingAvailable] =
    useState(false);
  const [aliyunSeatBindingsByEmail, setAliyunSeatBindingsByEmail] = useState<
    Record<string, AliyunSeatBinding>
  >({});
  const [aliyunSeatSkillGroups, setAliyunSeatSkillGroups] = useState<
    AliyunSeatSkillGroup[]
  >([]);
  const [aliyunSeatBindingDraft, setAliyunSeatBindingDraft] =
    useState<AliyunSeatBindingDraft | null>(null);
  const [aliyunSeatBindingPendingKey, setAliyunSeatBindingPendingKey] =
    useState<string | null>(null);
  const activeSelectedInviteUserIds = useMemo(
    () =>
      selectedInviteUserIds.filter((userId) =>
        pendingInviteUserIdSet.has(userId),
      ),
    [pendingInviteUserIdSet, selectedInviteUserIds],
  );
  const selectedInviteUserIdSet = useMemo(
    () => new Set(activeSelectedInviteUserIds),
    [activeSelectedInviteUserIds],
  );

  const allPendingSelected =
    pendingInviteUserIds.length > 0 &&
    pendingInviteUserIds.every((userId) => selectedInviteUserIdSet.has(userId));

  useEffect(() => {
    if (!canManageConnectors) {
      setAliyunSeatBindingAvailable(false);
      setAliyunSeatBindingsByEmail({});
      setAliyunSeatSkillGroups([]);
      return;
    }

    let cancelled = false;
    void fetch(ALIYUN_SEAT_BINDING_API_PATH, {
      method: "GET",
      headers: { Accept: "application/json" },
    })
      .then(async (response) => {
        if (!response.ok) {
          return null;
        }
        return (await response.json().catch(() => null)) as {
          ok?: unknown;
          bindings?: unknown;
          skillGroups?: unknown;
        } | null;
      })
      .then((payload) => {
        if (cancelled) return;
        if (!payload?.ok || !Array.isArray(payload.bindings)) {
          setAliyunSeatBindingAvailable(false);
          setAliyunSeatBindingsByEmail({});
          setAliyunSeatSkillGroups([]);
          return;
        }

        const next: Record<string, AliyunSeatBinding> = {};
        for (const binding of payload.bindings) {
          if (!isAliyunSeatBinding(binding)) continue;
          const emailKey = normalizeBindingEmail(binding.helmUserEmail);
          if (emailKey) {
            next[emailKey] = binding;
          }
        }
        setAliyunSeatBindingAvailable(true);
        setAliyunSeatBindingsByEmail(next);
        setAliyunSeatSkillGroups(
          Array.isArray(payload.skillGroups)
            ? payload.skillGroups.filter(isAliyunSeatSkillGroup)
            : [],
        );
      })
      .catch(() => {
        if (cancelled) return;
        setAliyunSeatBindingAvailable(false);
        setAliyunSeatBindingsByEmail({});
        setAliyunSeatSkillGroups([]);
      });

    return () => {
      cancelled = true;
    };
  }, [canManageConnectors]);

  const openAliyunSeatBindingDraft = (rowKey: string, aliyunAgentId = "") => {
    setAliyunSeatBindingDraft({
      rowKey,
      skillGroupRef: "",
      aliyunAgentId,
      accessKeyId: "",
      accessKeySecret: "",
      error:
        aliyunSeatSkillGroups.length === 0
          ? english
            ? "No CCC skill groups are available; use manual binding or check the CCC directory."
            : "未读取到 CCC 技能组；请改用手工绑定或检查 CCC 技能组目录。"
          : null,
    });
  };

  const submitAliyunSeatBinding = async (item: {
    dingtalkUserId: string;
    placeholderEmail: string | null;
  }) => {
    if (!aliyunSeatBindingDraft) return;
    const rowKey = inviteDetailRowKey(item);
    if (aliyunSeatBindingDraft.rowKey !== rowKey) return;
    const helmUserEmail = normalizeBindingEmail(item.placeholderEmail);
    if (!helmUserEmail) {
      setAliyunSeatBindingDraft((current) =>
        current ? { ...current, error: english ? "Missing Helm user email" : "缺少 Helm 用户邮箱" } : current,
      );
      return;
    }
    setAliyunSeatBindingPendingKey(rowKey);
    try {
      const response = await fetch(ALIYUN_SEAT_BINDING_API_PATH, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "bind",
          helmUserEmail,
          aliyunAgentId: aliyunSeatBindingDraft.aliyunAgentId,
          accessKeyId: aliyunSeatBindingDraft.accessKeyId,
          accessKeySecret: aliyunSeatBindingDraft.accessKeySecret,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        ok?: unknown;
        helmUserId?: unknown;
        aliyunAgentId?: unknown;
        error?: unknown;
      } | null;
      if (!response.ok || !payload?.ok) {
        setAliyunSeatBindingDraft((current) =>
          current
            ? {
                ...current,
                error:
                  typeof payload?.error === "string"
                    ? payload.error
                    : english
                      ? "Binding failed"
                      : "绑定失败",
              }
            : current,
        );
        return;
      }
      const helmUserId = typeof payload.helmUserId === "string" ? payload.helmUserId : "";
      const aliyunAgentId =
        typeof payload.aliyunAgentId === "string" ? payload.aliyunAgentId : aliyunSeatBindingDraft.aliyunAgentId;
      setAliyunSeatBindingsByEmail((current) => ({
        ...current,
        [helmUserEmail]: {
          helmUserId,
          helmUserEmail,
          aliyunAgentId,
          status: "ACTIVE",
        },
      }));
      setAliyunSeatBindingDraft(null);
    } finally {
      setAliyunSeatBindingPendingKey(null);
    }
  };

  const provisionAliyunSeat = async (item: {
    dingtalkUserId: string;
    placeholderEmail: string | null;
  }) => {
    if (!aliyunSeatBindingDraft?.skillGroupRef) return;
    const rowKey = inviteDetailRowKey(item);
    if (aliyunSeatBindingDraft.rowKey !== rowKey) return;
    const helmUserEmail = normalizeBindingEmail(item.placeholderEmail);
    if (!helmUserEmail) {
      setAliyunSeatBindingDraft((current) =>
        current
          ? { ...current, error: english ? "Missing Helm user email" : "缺少 Helm 用户邮箱" }
          : current,
      );
      return;
    }

    setAliyunSeatBindingPendingKey(rowKey);
    try {
      const response = await fetch(ALIYUN_SEAT_BINDING_API_PATH, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "provision",
          helmUserEmail,
          skillGroupRef: aliyunSeatBindingDraft.skillGroupRef,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        ok?: unknown;
        helmUserId?: unknown;
        aliyunAgentId?: unknown;
        error?: unknown;
      } | null;
      if (!response.ok || !payload?.ok) {
        setAliyunSeatBindingDraft((current) =>
          current
            ? {
                ...current,
                error:
                  typeof payload?.error === "string"
                    ? payload.error
                    : english
                      ? "Provisioning failed"
                      : "自动开通失败",
              }
            : current,
        );
        return;
      }

      const helmUserId = typeof payload.helmUserId === "string" ? payload.helmUserId : "";
      const aliyunAgentId = typeof payload.aliyunAgentId === "string" ? payload.aliyunAgentId : "";
      if (!helmUserId || !aliyunAgentId) {
        setAliyunSeatBindingDraft((current) =>
          current
            ? { ...current, error: english ? "Invalid provisioning response" : "开通返回无效" }
            : current,
        );
        return;
      }
      setAliyunSeatBindingsByEmail((current) => ({
        ...current,
        [helmUserEmail]: {
          helmUserId,
          helmUserEmail,
          aliyunAgentId,
          status: "ACTIVE",
        },
      }));
      setAliyunSeatBindingDraft(null);
    } finally {
      setAliyunSeatBindingPendingKey(null);
    }
  };

  const unbindAliyunSeat = async (item: {
    dingtalkUserId: string;
    placeholderEmail: string | null;
  }) => {
    const rowKey = inviteDetailRowKey(item);
    const helmUserEmail = normalizeBindingEmail(item.placeholderEmail);
    const binding = helmUserEmail ? aliyunSeatBindingsByEmail[helmUserEmail] : undefined;
    if (!binding) return;
    if (
      typeof window !== "undefined" &&
      !window.confirm(english ? "Unbind this Aliyun seat?" : "确认解绑该阿里云坐席？")
    ) {
      return;
    }
    setAliyunSeatBindingPendingKey(rowKey);
    try {
      const response = await fetch(ALIYUN_SEAT_BINDING_API_PATH, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "unbind",
          helmUserEmail,
          helmUserId: binding.helmUserId,
        }),
      });
      const payload = (await response.json().catch(() => null)) as { ok?: unknown } | null;
      if (!response.ok || !payload?.ok) {
        setAliyunSeatBindingDraft({
          rowKey,
          skillGroupRef: "",
          aliyunAgentId: binding.aliyunAgentId,
          accessKeyId: "",
          accessKeySecret: "",
          error: english ? "Unbind failed" : "解绑失败",
        });
        return;
      }
      setAliyunSeatBindingsByEmail((current) => {
        const next = { ...current };
        delete next[helmUserEmail];
        return next;
      });
    } finally {
      setAliyunSeatBindingPendingKey(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{english ? "Team permissions" : "团队权限"}</CardTitle>
        <CardDescription>
          {english
            ? "Who's invited, active, or inactive — and their seat status."
            : "已邀请、活跃、非活跃成员，以及他们的席位状态。"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-4 md:grid-cols-3">
          <Info
            label={english ? "Active members" : "活跃成员"}
            value={
              english
                ? `${seatSummary.activeSeatCount}`
                : `${seatSummary.activeSeatCount} 位`
            }
          />
          <Info
            label={english ? "Invited members" : "已邀请成员"}
            value={
              english
                ? `${seatSummary.invitedSeatCount}`
                : `${seatSummary.invitedSeatCount} 位`
            }
          />
          <Info
            label={english ? "Inactive members" : "非活跃成员"}
            value={
              english
                ? `${seatSummary.inactiveSeatCount}`
                : `${seatSummary.inactiveSeatCount} 位`
            }
          />
        </div>
        <div className="theme-surface-panel-soft rounded-2xl px-4 py-4 text-sm leading-6 text-[color:var(--muted)]">
          {english
            ? "Invited members stay visible in the organization but do not count as active seats until they enter the organization. Inactive members keep history and operational context, but they no longer count as active seats or default workspace participants."
            : "已邀请成员会保留在组织可见范围内，但在真正进入组织之前不计入活跃席位。非活跃成员会保留历史与运营上下文，但不再计入活跃席位，也不再作为默认工作区参与者。"}
        </div>
        <div className="theme-surface-panel-soft rounded-2xl px-4 py-4 text-sm leading-6 text-[color:var(--muted)]">
          <p className="font-semibold text-[color:var(--foreground)]">{inviteGuidance.title}</p>
          <p className="mt-2">{inviteGuidance.summary}</p>
          <p className="mt-2">{inviteGuidance.description}</p>
          <p className="mt-2 text-[var(--accent)]">
            {inviteGuidance.acceptanceHint}
          </p>
        </div>
        {canManageConnectors ? (
          <div className="theme-surface-panel-soft space-y-3 rounded-2xl px-4 py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-[color:var(--foreground)]">
                {english
                  ? "DingTalk pending-invite details (latest dry-run)"
                  : "钉钉待邀请人员明细（最近 dry-run）"}
              </p>
              {dingtalkDirectoryInviteDryRun ? (
                <p className="text-xs text-[color:var(--muted-foreground)]">
                  {english ? "Recorded" : "记录时间"} ·{" "}
                  {formatPermissionDateLabel(dingtalkDirectoryInviteDryRun.recordedAt, english)}
                </p>
              ) : null}
            </div>
            {dingtalkDirectoryInviteDryRun ? (
              <p className="text-xs leading-6 text-[color:var(--muted)]">
                {english
                  ? `Processed ${dingtalkDirectoryInviteDryRun.processed}, created ${dingtalkDirectoryInviteDryRun.createdUsers}, reused ${dingtalkDirectoryInviteDryRun.reusedUsers}, membership upserts ${dingtalkDirectoryInviteDryRun.upsertedMemberships}, simulated messages ${dingtalkDirectoryInviteDryRun.sentMessages}, skipped ${dingtalkDirectoryInviteDryRun.skipped} (no mobile ${dingtalkDirectoryInviteDryRun.skippedNoMobile}), collisions ${dingtalkDirectoryInviteDryRun.nameCollisionResolved}, errors ${dingtalkDirectoryInviteDryRun.errors.length}.`
                  : `处理 ${dingtalkDirectoryInviteDryRun.processed} 人，新增 ${dingtalkDirectoryInviteDryRun.createdUsers}，复用 ${dingtalkDirectoryInviteDryRun.reusedUsers}，成员写入 ${dingtalkDirectoryInviteDryRun.upsertedMemberships}，模拟消息 ${dingtalkDirectoryInviteDryRun.sentMessages}，跳过 ${dingtalkDirectoryInviteDryRun.skipped}（缺手机号 ${dingtalkDirectoryInviteDryRun.skippedNoMobile}），同名冲突 ${dingtalkDirectoryInviteDryRun.nameCollisionResolved}，错误 ${dingtalkDirectoryInviteDryRun.errors.length}。`}
              </p>
            ) : (
              <p className="text-xs leading-6 text-[color:var(--muted)]">
                {english
                  ? "No dry-run snapshot yet. Run `Directory invite sync (Dry-run)` in Connectors first."
                  : "当前还没有 dry-run 快照。请先到连接器页执行一次“目录邀请同步（Dry-run）”。"}
              </p>
            )}
            {dingtalkDirectoryInviteDryRun &&
            dingtalkDirectoryInviteDryRun.details.length ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-[color:var(--muted-foreground)]">
                  {english
                    ? "Select pending rows, invite one-by-one or in batch, and re-invite already invited rows from actions."
                    : "可勾选待邀请员工，支持单条或批量发送邀请；已邀请员工也可在操作中重新发送邀请。"}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    disabled={
                      !pendingInviteUserIds.length || dingtalkInvitePending
                    }
                    onClick={() =>
                      setSelectedInviteUserIds(
                        allPendingSelected ? [] : pendingInviteUserIds,
                      )
                    }
                  >
                    {allPendingSelected
                      ? english
                        ? "Clear selection"
                        : "清空选择"
                      : english
                        ? "Select all pending"
                        : "全选待邀请"}
                  </Button>
                  <Button
                    size="sm"
                    type="button"
                    disabled={
                      !activeSelectedInviteUserIds.length ||
                      dingtalkInvitePending
                    }
                    onClick={() =>
                      inviteSelectedDingTalkDirectoryUsers(
                        activeSelectedInviteUserIds,
                      )
                    }
                  >
                    {english
                      ? `Invite selected (${activeSelectedInviteUserIds.length})`
                      : `邀请选中（${activeSelectedInviteUserIds.length}）`}
                  </Button>
                </div>
              </div>
            ) : null}
            <div className="max-h-72 overflow-auto rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)]">
              <table className="w-full min-w-[860px] text-left text-xs">
                <thead className="sticky top-0 bg-[color:var(--surface-subtle)] text-[color:var(--muted)]">
                  <tr>
                    <th className="px-3 py-2 font-medium">
                      {english ? "Name" : "姓名"}
                    </th>
                    <th className="px-3 py-2 font-medium">
                      {english ? "Phone" : "手机号"}
                    </th>
                    <th className="px-3 py-2 font-medium">
                      {english ? "Title" : "职位"}
                    </th>
                    <th className="px-3 py-2 font-medium">
                      {english ? "Dept IDs" : "部门 ID"}
                    </th>
                    <th className="px-3 py-2 font-medium">
                      {english ? "Placeholder email" : "占位邮箱"}
                    </th>
                    <th className="px-3 py-2 font-medium">
                      {english ? "Status" : "状态"}
                    </th>
                    <th className="px-3 py-2 font-medium">
                      {english ? "Action" : "操作"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {dingtalkDirectoryInviteDryRun &&
                  dingtalkDirectoryInviteDryRun.details.length ? (
                    dingtalkDirectoryInviteDryRun.details.map((item) => {
                      const rowKey = inviteDetailRowKey(item);
                      const emailKey = normalizeBindingEmail(item.placeholderEmail);
                      const binding = emailKey ? aliyunSeatBindingsByEmail[emailKey] : undefined;
                      const draftOpen = aliyunSeatBindingDraft?.rowKey === rowKey;
                      const seatPending = aliyunSeatBindingPendingKey === rowKey;
                      return (
                        <Fragment key={`${item.dingtalkUserId}:${item.placeholderEmail ?? "none"}`}>
                          <tr
                            className="border-t border-[color:var(--border)]"
                          >
                            <td className="px-3 py-2 text-[color:var(--foreground)]">
                              {item.name}
                            </td>
                            <td className="px-3 py-2 text-[color:var(--muted)]">
                              {item.normalizedPhone ??
                                item.mobile ??
                                (english ? "Missing" : "缺失")}
                            </td>
                            <td className="px-3 py-2 text-[color:var(--muted)]">
                              {item.title ?? (english ? "-" : "无")}
                            </td>
                            <td className="px-3 py-2 text-[color:var(--muted)]">
                              {item.deptIds.length
                                ? item.deptIds.join(", ")
                                : english
                                  ? "-"
                                  : "无"}
                            </td>
                            <td className="px-3 py-2 text-[color:var(--muted)]">
                              {item.placeholderEmail ?? (english ? "-" : "无")}
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex flex-col items-start gap-1">
                                <span
                                  className={`rounded-full px-2 py-1 text-[11px] font-medium ${
                                    item.messageStatus === "SENT"
                                      ? "bg-[color:var(--status-success-bg)] text-[color:var(--status-success-text)]"
                                      : "bg-[color:var(--status-warning-bg)] text-[color:var(--status-warning-text)]"
                                  }`}
                                >
                                  {item.messageStatus === "SENT"
                                    ? english
                                      ? "Invited"
                                      : "已邀请"
                                    : english
                                      ? "Pending invite"
                                      : "待邀请"}
                                </span>
                                {binding ? (
                                  <span className="rounded-full bg-[color:var(--status-success-bg)] px-2 py-1 text-[11px] font-medium text-[color:var(--status-success-text)]">
                                    {english ? "Aliyun seat" : "阿里云坐席"} · {binding.aliyunAgentId}
                                  </span>
                                ) : null}
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex flex-wrap items-center gap-2">
                                {item.messageStatus === "SENT" ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    type="button"
                                    disabled={dingtalkInvitePending}
                                    onClick={() =>
                                      inviteSelectedDingTalkDirectoryUsers([
                                        item.dingtalkUserId,
                                      ])
                                    }
                                  >
                                    {english ? "Re-invite" : "重新邀请"}
                                  </Button>
                                ) : (
                                  <>
                                    <input
                                      type="checkbox"
                                      checked={selectedInviteUserIdSet.has(
                                        item.dingtalkUserId,
                                      )}
                                      onChange={(event) =>
                                        setSelectedInviteUserIds((current) => {
                                          if (event.target.checked) {
                                            return current.includes(item.dingtalkUserId)
                                              ? current
                                              : [...current, item.dingtalkUserId];
                                          }
                                          return current.filter(
                                            (userId) =>
                                              userId !== item.dingtalkUserId,
                                          );
                                        })
                                      }
                                      disabled={dingtalkInvitePending}
                                      aria-label={
                                        english
                                          ? `Select ${item.name}`
                                          : `选择 ${item.name}`
                                      }
                                    />
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      type="button"
                                      disabled={dingtalkInvitePending}
                                      onClick={() =>
                                        inviteSelectedDingTalkDirectoryUsers([
                                          item.dingtalkUserId,
                                        ])
                                      }
                                    >
                                      {english ? "Invite" : "邀请"}
                                    </Button>
                                  </>
                                )}
                                {aliyunSeatBindingAvailable && binding ? (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    type="button"
                                    disabled={seatPending}
                                    onClick={() => unbindAliyunSeat(item)}
                                  >
                                    {english ? "Unbind seat" : "解绑坐席"}
                                  </Button>
                                ) : null}
                                {aliyunSeatBindingAvailable && !binding ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    type="button"
                                    disabled={seatPending || !item.placeholderEmail}
                                    onClick={() => openAliyunSeatBindingDraft(rowKey)}
                                  >
                                    {english ? "Bind seat" : "绑定坐席"}
                                  </Button>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                          {draftOpen ? (
                            <tr className="border-t border-[color:var(--border)] bg-[color:var(--surface-subtle)]/60">
                              <td className="px-3 py-3" colSpan={7}>
                                <div className="space-y-3">
                                  <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_auto]">
                                    <Select
                                      value={aliyunSeatBindingDraft.skillGroupRef}
                                      onValueChange={(skillGroupRef) =>
                                        setAliyunSeatBindingDraft((current) =>
                                          current
                                            ? { ...current, skillGroupRef, error: null }
                                            : current,
                                        )
                                      }
                                      disabled={seatPending || aliyunSeatSkillGroups.length === 0}
                                    >
                                      <SelectTrigger aria-label={english ? "Skill group" : "技能组"}>
                                        <SelectValue
                                          placeholder={english ? "Select skill group" : "选择技能组"}
                                        />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {aliyunSeatSkillGroups.map((skillGroup) => (
                                          <SelectItem
                                            key={skillGroup.skillGroupId}
                                            value={skillGroup.skillGroupId}
                                          >
                                            {skillGroup.displayName}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <Button
                                      size="sm"
                                      type="button"
                                      disabled={
                                        seatPending ||
                                        !aliyunSeatBindingDraft.skillGroupRef
                                      }
                                      onClick={() => provisionAliyunSeat(item)}
                                    >
                                      {english ? "Provision" : "自动开通"}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      type="button"
                                      disabled={seatPending}
                                      onClick={() => setAliyunSeatBindingDraft(null)}
                                    >
                                      {english ? "Cancel" : "取消"}
                                    </Button>
                                  </div>
                                  <div className="grid gap-2 border-t border-[color:var(--border)] pt-3 md:grid-cols-[1fr_1fr_1fr_auto]">
                                    <Input
                                      value={aliyunSeatBindingDraft.aliyunAgentId}
                                      onChange={(event) =>
                                        setAliyunSeatBindingDraft((current) =>
                                          current
                                            ? { ...current, aliyunAgentId: event.target.value, error: null }
                                            : current,
                                        )
                                      }
                                      placeholder={english ? "Seat ID" : "坐席ID"}
                                      disabled={seatPending}
                                    />
                                    <Input
                                      value={aliyunSeatBindingDraft.accessKeyId}
                                      onChange={(event) =>
                                        setAliyunSeatBindingDraft((current) =>
                                          current
                                            ? { ...current, accessKeyId: event.target.value, error: null }
                                            : current,
                                        )
                                      }
                                      placeholder="AK"
                                      type="password"
                                      autoComplete="off"
                                      disabled={seatPending}
                                    />
                                    <Input
                                      value={aliyunSeatBindingDraft.accessKeySecret}
                                      onChange={(event) =>
                                        setAliyunSeatBindingDraft((current) =>
                                          current
                                            ? { ...current, accessKeySecret: event.target.value, error: null }
                                            : current,
                                        )
                                      }
                                      placeholder="SK"
                                      type="password"
                                      autoComplete="off"
                                      disabled={seatPending}
                                    />
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      type="button"
                                      disabled={
                                        seatPending ||
                                        !aliyunSeatBindingDraft.aliyunAgentId ||
                                        !aliyunSeatBindingDraft.accessKeyId ||
                                        !aliyunSeatBindingDraft.accessKeySecret
                                      }
                                      onClick={() => submitAliyunSeatBinding(item)}
                                    >
                                      {english ? "Save binding" : "保存绑定"}
                                    </Button>
                                  </div>
                                </div>
                                {aliyunSeatBindingDraft.error ? (
                                  <p className="mt-2 text-xs font-medium text-[color:var(--status-danger-text)]">
                                    {aliyunSeatBindingDraft.error}
                                  </p>
                                ) : null}
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      );
                    })
                  ) : (
                    <tr>
                      <td
                        className="px-3 py-4 text-center text-[color:var(--muted-foreground)]"
                        colSpan={7}
                      >
                        {english
                          ? "No dry-run detail is available yet."
                          : "当前还没有 dry-run 明细。"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
        {canManageMembers ? (
          <>
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                value={memberDraft.email}
                onChange={(event) =>
                  setMemberDraft((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
                placeholder={english ? "Member email or phone" : "成员邮箱或手机号"}
              />
              <Input
                value={memberDraft.name}
                onChange={(event) =>
                  setMemberDraft((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder={english ? "Name (optional)" : "姓名（可选）"}
              />
              <Select
                value={memberDraft.role}
                onValueChange={(value) =>
                  setMemberDraft((current) => ({
                    ...current,
                    role: value as TeamPermissionsRole,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(roleLabelsByLocale).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={memberDraft.title}
                onChange={(event) =>
                  setMemberDraft((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                placeholder={english ? "Title (optional)" : "职位（可选）"}
              />
              <Select
                value={memberDraft.rolePresetKey}
                onValueChange={(value) =>
                  setMemberDraft((current) => ({
                    ...current,
                    rolePresetKey: value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {rolePresetOptions.map((option) => (
                    <SelectItem key={option.key} value={option.key}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)]/80 px-4 py-3 text-sm leading-6 text-[color:var(--muted)]">
                {rolePresetOptions.find(
                  (option) => option.key === memberDraft.rolePresetKey,
                )?.summary ??
                  (english
                    ? "Pick a role preset to prefill a member definition draft."
                    : "选择角色预设后，会预填一版成员定义草稿。")}
              </div>
            </div>
            <Button
              onClick={addMember}
              disabled={pending || !memberDraft.email}
            >
              {english ? "Add team member" : "添加团队成员"}
            </Button>
          </>
        ) : (
          <div className="theme-surface-panel-soft rounded-2xl px-4 py-4 text-sm leading-6 text-[color:var(--muted)]">
            {english
              ? "Member lifecycle changes stay limited to owner, billing admin, and admin. This surface stays workspace-first and does not expand into a full RBAC builder."
              : "成员生命周期调整仅开放给负责人、计费管理员和管理员。当前仍保持工作区优先，不扩成完整权限构建器。"}
          </div>
        )}
        {memberships.map((membership) => {
          const isCurrentUser = membership.user.id === currentUserId;
          const lastOwnerGuard =
            membership.role === "OWNER" &&
            membership.status !== "INACTIVE" &&
            activeOwnerCount <= 1;
          const canTransferOwnership =
            canManageMembers &&
            activeMembershipRole === "OWNER" &&
            !isCurrentUser &&
            membership.status === "ACTIVE" &&
            membership.role !== "OWNER";

          return (
            <div
              key={membership.id}
              className="theme-surface-panel rounded-2xl px-4 py-4"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-[color:var(--foreground)]">
                    {membership.user.name}
                  </p>
                  <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
                    {membership.user.email} ·{" "}
                    {membership.title ??
                      (english ? "No title yet" : "未填写职位")}
                  </p>
                  {membership.rolePresetKey ? (
                    <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">
                      {english ? "Role preset" : "角色预设"} ·{" "}
                      {rolePresetOptions.find(
                        (option) => option.key === membership.rolePresetKey,
                      )?.label ?? membership.rolePresetKey}
                    </p>
                  ) : null}
                  <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">
                    {membership.status === "ACTIVE"
                      ? english
                        ? `Joined ${formatPermissionDateLabel(membership.joinedAt, english)}`
                        : `加入于 ${formatPermissionDateLabel(membership.joinedAt, english)}`
                      : membership.status === "INVITED"
                        ? english
                          ? "Invited, visible in team operations but not counted as an active seat yet"
                          : "已邀请，当前会保留在团队运营视图里，但还不计入活跃席位"
                        : english
                          ? "Inactive, preserved for history and audit context without counting as an active seat"
                          : "非活跃状态，保留历史与审计上下文，但不会计入活跃席位"}
                  </p>
                  {lastOwnerGuard ? (
                    <p className="mt-2 text-xs font-medium text-[color:var(--status-warning-text)]">
                      {english
                        ? "Transfer ownership before moving the last active owner out of active posture."
                        : "在移出最后一个活跃负责人前，请先完成负责人转移。"}
                    </p>
                  ) : null}
                  {canManageMembers ? (
                    <MemberGoalProfileEditor
                      key={[
                        membership.id,
                        membership.goalTitle ?? "",
                        membership.goalDescription ?? "",
                        membership.goalItemsJson ?? "",
                        membership.jobResponsibilities ?? "",
                      ].join(":")}
                      english={english}
                      membership={membership}
                      pending={pending}
                      updateMemberGoalProfile={updateMemberGoalProfile}
                    />
                  ) : null}
                  {canManageMembers ? (
                    <MemberGroupTagEditor
                      key={`${membership.id}:${membership.groupTag ?? ""}`}
                      english={english}
                      membership={membership}
                      pending={pending}
                      updateMemberGroupTag={updateMemberGroupTag}
                    />
                  ) : null}
                </div>
                <div className="flex flex-col items-start gap-2 md:items-end">
                  <div className="flex flex-wrap items-center gap-2">
                    {canManageMembers && membership.role !== "OWNER" ? (
                      <Select
                        defaultValue={membership.role}
                        disabled={pending}
                        onValueChange={(value) =>
                          updateMemberRole(
                            membership.id,
                            membership.role,
                            value as TeamPermissionsRole,
                          )
                        }
                      >
                        <SelectTrigger
                          data-testid={`membership-role-select-${membership.id}`}
                          className="w-[180px]"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(roleLabelsByLocale)
                            .filter(([value]) => value !== "OWNER")
                            .map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="theme-surface-chip rounded-full px-3 py-2 text-sm font-medium text-[color:var(--foreground)] ring-1 ring-[color:var(--border)]">
                        {roleLabelsByLocale[membership.role]}
                      </div>
                    )}
                    <Badge
                      variant={
                        membership.status === "ACTIVE"
                          ? "success"
                          : membership.status === "INVITED"
                            ? "warning"
                            : "neutral"
                      }
                    >
                      {membership.status === "ACTIVE"
                        ? english
                          ? "Active seat"
                          : "活跃席位"
                        : membership.status === "INVITED"
                          ? english
                            ? "Invited"
                            : "已邀请"
                          : english
                            ? "Inactive"
                            : "非活跃"}
                    </Badge>
                  </div>
                  {canManageMembers ? (
                    <div className="flex flex-wrap justify-end gap-2">
                      {membership.status === "ACTIVE" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={pending || lastOwnerGuard}
                          onClick={() =>
                            updateMemberLifecycle(membership.id, "INACTIVE")
                          }
                        >
                          {english ? "Set inactive" : "设为非活跃"}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={pending}
                          onClick={() =>
                            updateMemberLifecycle(membership.id, "ACTIVE")
                          }
                        >
                          {english ? "Restore active" : "恢复活跃"}
                        </Button>
                      )}
                      {membership.status === "INVITED" ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={pending}
                          onClick={() =>
                            updateMemberLifecycle(membership.id, "INACTIVE")
                          }
                        >
                          {english ? "Cancel invite" : "取消邀请"}
                        </Button>
                      ) : null}
                      {membership.status === "INACTIVE" &&
                      membership.role !== "OWNER" ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={pending}
                          onClick={() =>
                            updateMemberLifecycle(membership.id, "INVITED")
                          }
                        >
                          {english ? "Restore invite" : "恢复邀请"}
                        </Button>
                      ) : null}
                      {canTransferOwnership ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={pending}
                          onClick={() => transferOwnership(membership.id)}
                        >
                          {english ? "Transfer owner" : "转移负责人"}
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
