import { ActorType, MembershipStatus, WorkspaceRole } from "@prisma/client";
import { pinyin } from "pinyin-pro";
import { suggestRolePresetKeyFromText } from "@/lib/definitions/role-presets";
import { db } from "@/lib/db";
import { discoverDingTalkMcpSubjects } from "@/lib/connectors/dingtalk-mcp-client";
import { fetchDingTalkAppAccessToken, getDingTalkAppMessageConfig } from "@/lib/connectors/dingtalk";
import { normalizePhoneNumber } from "@/lib/auth/formal-auth";
import { writeAuditLog } from "@/lib/audit";

const DINGTALK_USER_DETAIL_URL = "https://oapi.dingtalk.com/topapi/v2/user/get";
const DINGTALK_APP_MESSAGE_SEND_URL =
  "https://oapi.dingtalk.com/topapi/message/corpconversation/asyncsend_v2";
const DINGTALK_APP_MESSAGE_SEND_RESULT_URL =
  "https://oapi.dingtalk.com/topapi/message/corpconversation/getsendresult";
const PLACEHOLDER_EMAIL_DOMAIN = "example.com";

type DingTalkDirectoryEmployee = {
  userId: string;
  unionId: string | null;
  name: string;
  mobile: string | null;
  title: string | null;
  jobNumber: string | null;
  hiredDate: string | null;
  deptIds: number[];
  isLeader: boolean;
  avatarUrl: string | null;
  emailBase: string;
  preferredIndex: number;
};

export type DingTalkDirectoryInviteResult = {
  ok: boolean;
  processed: number;
  createdUsers: number;
  reusedUsers: number;
  upsertedMemberships: number;
  sentMessages: number;
  skipped: number;
  skippedNoMobile: number;
  nameCollisionResolved: number;
  errors: string[];
  details: DingTalkDirectoryInviteDetail[];
};

export type DingTalkDirectoryInviteDetail = {
  dingtalkUserId: string;
  unionId: string | null;
  name: string;
  mobile: string | null;
  normalizedPhone: string | null;
  title: string | null;
  jobNumber: string | null;
  deptIds: number[];
  isLeader: boolean;
  placeholderEmail: string | null;
  userResolution:
    | "REUSED_BY_PHONE"
    | "REUSED_BY_PLACEHOLDER_EMAIL"
    | "CREATED_PLACEHOLDER_EMAIL"
    | "UNRESOLVED";
  membershipStatus:
    | "ACTIVE_KEPT"
    | "INVITED_UPSERTED"
    | "DRY_RUN_SIMULATED"
    | "SKIPPED";
  messageStatus: "SENT" | "DRY_RUN_SIMULATED" | "FAILED" | "SKIPPED";
  note: string | null;
};

export type DingTalkInviteSendReceipt = {
  taskId: string | null;
  readUserIds: string[];
  unreadUserIds: string[];
  failedUserIds: string[];
  forbiddenUserIds: string[];
  invalidUserIds: string[];
  forbiddenReasons: string[];
  deliveryNote: string | null;
};

function normalizeString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeNumberList(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as number[];
  }
  return value
    .map((item) => (typeof item === "number" && Number.isFinite(item) ? Math.trunc(item) : null))
    .filter((item): item is number => item !== null && item > 0);
}

function normalizeStringList(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeString(item))
      .filter((item): item is string => Boolean(item));
  }

  const normalized = normalizeString(value);
  if (!normalized) {
    return [] as string[];
  }

  return normalized
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeTaskId(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(Math.trunc(value));
  }
  return normalizeString(value);
}

function normalizeForbiddenReasonEntries(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as Array<{ userId: string | null; code: string | null; count: string | null }>;
  }
  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const source = item as Record<string, unknown>;
      return {
        userId: normalizeString(source.userid) ?? normalizeString(source.userId),
        code: normalizeString(source.code),
        count:
          typeof source.count === "number" && Number.isFinite(source.count)
            ? String(Math.trunc(source.count))
            : normalizeString(source.count),
      };
    })
    .filter((item): item is { userId: string | null; code: string | null; count: string | null } => Boolean(item));
}

function extractDingTalkInvalidRecipients(payload: Record<string, unknown>) {
  const sources: Array<Record<string, unknown>> = [payload];
  const result =
    payload.result && typeof payload.result === "object"
      ? (payload.result as Record<string, unknown>)
      : null;
  const sendResult =
    payload.send_result && typeof payload.send_result === "object"
      ? (payload.send_result as Record<string, unknown>)
      : null;
  if (result) {
    sources.push(result);
  }
  if (sendResult) {
    sources.push(sendResult);
  }

  const keyCandidates = [
    "invalid_user_id_list",
    "invalidUserIdList",
    "invaliduserid",
    "invalid_userid",
    "invaliduser",
    "invalid_user_list",
    "forbidden_user_id_list",
    "forbiddenUserIdList",
  ] as const;

  const recipients = new Set<string>();
  for (const source of sources) {
    for (const key of keyCandidates) {
      for (const item of normalizeStringList(source[key])) {
        recipients.add(item);
      }
    }
  }

  return Array.from(recipients);
}

function resolveLeaderFlag(value: unknown) {
  if (!Array.isArray(value)) {
    return false;
  }
  return value.some((item) => {
    if (!item || typeof item !== "object") {
      return false;
    }
    return (item as { leader?: unknown }).leader === true;
  });
}

export function normalizeNameToPinyinBase(name: string) {
  const normalizedName = name.trim();
  if (!normalizedName) {
    return "member";
  }

  const syllables = pinyin(normalizedName, {
    toneType: "none",
    type: "array",
  });
  const rawJoined = Array.isArray(syllables) ? syllables.join("") : String(syllables ?? "");
  const normalized = rawJoined.toLowerCase().replace(/[^a-z0-9]+/g, "");
  return normalized || "member";
}

export function buildPlaceholderEmail(base: string, index: number) {
  const safeBase = (base.trim().toLowerCase().replace(/[^a-z0-9]+/g, "") || "member").slice(0, 48);
  const safeIndex = Number.isFinite(index) && index > 1 ? Math.trunc(index) : 1;
  const local = safeIndex > 1 ? `${safeBase}-zj-${safeIndex}` : `${safeBase}-zj`;
  return `${local}@${PLACEHOLDER_EMAIL_DOMAIN}`;
}

function assignPreferredEmailSlots(employees: Array<Omit<DingTalkDirectoryEmployee, "emailBase" | "preferredIndex">>) {
  const counters = new Map<string, number>();
  return employees
    .sort((left, right) => left.userId.localeCompare(right.userId))
    .map((employee) => {
      const emailBase = normalizeNameToPinyinBase(employee.name);
      const nextIndex = (counters.get(emailBase) ?? 0) + 1;
      counters.set(emailBase, nextIndex);
      return {
        ...employee,
        emailBase,
        preferredIndex: nextIndex,
      } satisfies DingTalkDirectoryEmployee;
    });
}

async function fetchDingTalkUserDetail(accessToken: string, userId: string) {
  const url = new URL(DINGTALK_USER_DETAIL_URL);
  url.searchParams.set("access_token", accessToken);
  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      userid: userId,
      language: "zh_CN",
    }),
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  const errcode = typeof payload.errcode === "number" ? payload.errcode : -1;
  if (!response.ok || errcode !== 0) {
    throw new Error(`getUserDetailByUserId failed for ${userId}: ${String(payload.errmsg ?? response.statusText)}`);
  }
  const result =
    payload.result && typeof payload.result === "object"
      ? (payload.result as Record<string, unknown>)
      : {};
  return {
    userId: normalizeString(result.userid) ?? userId,
    unionId: normalizeString(result.unionid),
    name: normalizeString(result.name) ?? "未命名成员",
    mobile: normalizeString(result.mobile),
    title: normalizeString(result.title),
    jobNumber: normalizeString(result.job_number),
    hiredDate: normalizeString(result.hired_date),
    deptIds: normalizeNumberList(result.dept_id_list),
    isLeader: resolveLeaderFlag(result.leader_in_dept),
    avatarUrl: normalizeString(result.avatar),
  };
}

export async function sendDingTalkInviteMessage(input: {
  accessToken: string;
  agentId: string;
  dingtalkUserId: string;
  workspaceName: string;
  inviteUrl: string;
  roleLabel: string;
  title: string | null;
  inviteNonce?: string;
}): Promise<DingTalkInviteSendReceipt> {
  const url = new URL(DINGTALK_APP_MESSAGE_SEND_URL);
  url.searchParams.set("access_token", input.accessToken);
  const inviteNonce =
    normalizeString(input.inviteNonce) ?? `${Date.now()}-${input.dingtalkUserId}`;
  const messageText = [
    `你已被邀请加入 Helm 组织「${input.workspaceName}」`,
    `角色：${input.roleLabel}`,
    input.title ? `职位：${input.title}` : null,
    "",
    `[点击进入并完成登录](${input.inviteUrl})`,
    `邀请批次：${inviteNonce}`,
    "",
    "如非本人操作，请忽略此消息。",
  ]
    .filter(Boolean)
    .join("\n");

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      agent_id: Number.isFinite(Number(input.agentId)) ? Number(input.agentId) : input.agentId,
      userid_list: input.dingtalkUserId,
      to_all_user: false,
      msg: {
        msgtype: "markdown",
        markdown: {
          title: "Helm 组织邀请",
          text: messageText,
        },
      },
    }),
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  const errcode = typeof payload.errcode === "number" ? payload.errcode : -1;
  if (!response.ok || errcode !== 0) {
    throw new Error(`send app message failed: ${String(payload.errmsg ?? response.statusText)}`);
  }

  const taskId = normalizeTaskId(payload.task_id);
  const invalidRecipients = extractDingTalkInvalidRecipients(payload);
  if (invalidRecipients.length > 0) {
    throw new Error(
      `send app message failed: invalid recipients returned by DingTalk (${invalidRecipients.join(",")})`,
    );
  }

  if (!taskId) {
    return {
      taskId: null,
      readUserIds: [],
      unreadUserIds: [],
      failedUserIds: [],
      forbiddenUserIds: [],
      invalidUserIds: [],
      forbiddenReasons: [],
      deliveryNote: "task_id_missing",
    };
  }

  const sendResultUrl = new URL(DINGTALK_APP_MESSAGE_SEND_RESULT_URL);
  sendResultUrl.searchParams.set("access_token", input.accessToken);
  const requestBody = JSON.stringify({
    agent_id: Number.isFinite(Number(input.agentId)) ? Number(input.agentId) : input.agentId,
    task_id: Number.isFinite(Number(taskId)) ? Number(taskId) : taskId,
  });

  let sendResult: Record<string, unknown> = {};
  let deliveryError: string | null = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const sendResultResponse = await fetch(sendResultUrl.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: requestBody,
      cache: "no-store",
    });
    const sendResultPayload = (await sendResultResponse.json().catch(() => ({}))) as Record<string, unknown>;
    const sendResultErrcode =
      typeof sendResultPayload.errcode === "number" ? sendResultPayload.errcode : -1;
    if (!sendResultResponse.ok || sendResultErrcode !== 0) {
      deliveryError = `getsendresult_failed:${String(sendResultPayload.errmsg ?? sendResultResponse.statusText)}`;
      break;
    }

    const resultRoot =
      sendResultPayload.result && typeof sendResultPayload.result === "object"
        ? (sendResultPayload.result as Record<string, unknown>)
        : sendResultPayload;
    sendResult =
      resultRoot.send_result && typeof resultRoot.send_result === "object"
        ? (resultRoot.send_result as Record<string, unknown>)
        : resultRoot;

    const hasAnyResultNow =
      normalizeStringList(sendResult.read_user_id_list).length > 0 ||
      normalizeStringList(sendResult.unread_user_id_list).length > 0 ||
      normalizeStringList(sendResult.failed_user_id_list).length > 0 ||
      normalizeStringList(sendResult.forbidden_user_id_list).length > 0 ||
      normalizeStringList(sendResult.invalid_user_id_list).length > 0 ||
      normalizeForbiddenReasonEntries(sendResult.forbidden_list).length > 0;
    if (hasAnyResultNow) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 700));
  }

  if (deliveryError) {
    return {
      taskId,
      readUserIds: [],
      unreadUserIds: [],
      failedUserIds: [],
      forbiddenUserIds: [],
      invalidUserIds: [],
      forbiddenReasons: [],
      deliveryNote: deliveryError,
    };
  }

  const readUserIds = normalizeStringList(sendResult.read_user_id_list);
  const unreadUserIds = normalizeStringList(sendResult.unread_user_id_list);
  const failedUserIds = normalizeStringList(sendResult.failed_user_id_list);
  const forbiddenUserIds = normalizeStringList(sendResult.forbidden_user_id_list);
  const invalidUserIds = normalizeStringList(sendResult.invalid_user_id_list);
  const forbiddenReasonEntries = normalizeForbiddenReasonEntries(sendResult.forbidden_list);
  const forbiddenReasonUserIds = forbiddenReasonEntries
    .map((item) => item.userId)
    .filter((item): item is string => Boolean(item));
  const forbiddenReasons = forbiddenReasonEntries.map((item) => {
    const parts = [
      item.userId ? `user=${item.userId}` : null,
      item.code ? `code=${item.code}` : null,
      item.count ? `count=${item.count}` : null,
    ].filter(Boolean);
    return parts.join(",");
  });
  const blockedRecipients = new Set([
    ...failedUserIds,
    ...forbiddenUserIds,
    ...forbiddenReasonUserIds,
    ...invalidUserIds,
  ]);

  if (blockedRecipients.has(input.dingtalkUserId)) {
    throw new Error(
      `send app message failed: recipient blocked (failed=${failedUserIds.join(",") || "-"}, forbidden=${forbiddenUserIds.join(",") || "-"}, forbidden_list=${forbiddenReasons.join("|") || "-"}, invalid=${invalidUserIds.join(",") || "-"})`,
    );
  }

  const hasAnyResult =
    readUserIds.length > 0 ||
    unreadUserIds.length > 0 ||
    failedUserIds.length > 0 ||
    forbiddenUserIds.length > 0 ||
    forbiddenReasonEntries.length > 0 ||
    invalidUserIds.length > 0;

  return {
    taskId,
    readUserIds,
    unreadUserIds,
    failedUserIds,
    forbiddenUserIds,
    invalidUserIds,
    forbiddenReasons,
    deliveryNote: hasAnyResult ? null : "result_pending_after_retry",
  };
}

export type DingTalkLiveSendConfirmation = {
  /** Workspace member who explicitly clicked the live-send button. */
  confirmedByUserId: string;
  /** Wall-clock time when the confirmation was captured. */
  confirmedAt: Date;
  /** Surface that captured the confirmation (e.g. `/settings`). */
  sourcePage: string;
  /** Stable correlation ID linking this batch to higher-level audit chains. */
  traceId?: string | null;
};

export class DingTalkLiveSendConfirmationRequiredError extends Error {
  constructor() {
    super(
      "DingTalk directory invite live send requires explicit confirmation; pass dryRun=true or supply confirmation { confirmedByUserId, confirmedAt, sourcePage }",
    );
    this.name = "DingTalkLiveSendConfirmationRequiredError";
  }
}

export function resolveDingTalkDirectoryInviteDryRun(dryRun?: boolean) {
  return dryRun ?? true;
}

export function isValidDingTalkLiveSendConfirmation(
  confirmation?: DingTalkLiveSendConfirmation | null,
): confirmation is DingTalkLiveSendConfirmation {
  return Boolean(
    confirmation?.confirmedByUserId &&
      confirmation.confirmedAt instanceof Date &&
      !Number.isNaN(confirmation.confirmedAt.valueOf()) &&
      confirmation.sourcePage,
  );
}

export async function syncAndInviteDingTalkDirectory(input: {
  workspaceId: string;
  operator: string;
  /**
   * When unset, defaults to `true` (safe). Live send must be requested
   * explicitly with `dryRun: false` AND a `confirmation` payload — this
   * preserves the README "客户可见的事永远等你点" guarantee even when
   * upstream callers forget to thread the flag.
   */
  dryRun?: boolean;
  /** Required when `dryRun === false`. */
  confirmation?: DingTalkLiveSendConfirmation;
  deptIds?: number[];
  maxUsers?: number;
  targetUserIds?: string[];
}) {
  // Fail-fast: refuse the request before any DB / network / API work happens
  // when the caller asked for live send without a valid confirmation.
  const dryRunDecision = resolveDingTalkDirectoryInviteDryRun(input.dryRun);
  if (!dryRunDecision && !isValidDingTalkLiveSendConfirmation(input.confirmation)) {
    throw new DingTalkLiveSendConfirmationRequiredError();
  }

  const workspace = await db.workspace.findUnique({
    where: { id: input.workspaceId },
    select: {
      id: true,
      name: true,
      profileType: true,
      description: true,
    },
  });
  if (!workspace) {
    throw new Error("Workspace not found");
  }

  const appConfig = getDingTalkAppMessageConfig();
  if (!appConfig.agentId) {
    throw new Error("DINGTALK_AGENT_ID is not configured");
  }

  const userIds =
    input.targetUserIds && input.targetUserIds.length > 0
      ? [...new Set(input.targetUserIds.filter(Boolean))]
      : [
          ...new Set(
            (
              await discoverDingTalkMcpSubjects({
                deptIds: input.deptIds?.length ? input.deptIds : [1],
                maxUsers: input.maxUsers ?? 5000,
              })
            )
              .map((subject) => subject.userId)
              .filter((value): value is string => Boolean(value)),
          ),
        ];
  userIds.sort();

  const appToken = await fetchDingTalkAppAccessToken();
  const employees: Array<Omit<DingTalkDirectoryEmployee, "emailBase" | "preferredIndex">> = [];
  const errors: string[] = [];

  for (const userId of userIds) {
    try {
      const detail = await fetchDingTalkUserDetail(appToken.accessToken, userId);
      employees.push(detail);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  const plannedEmployees = assignPreferredEmailSlots(employees);
  const appUrl = process.env.APP_URL?.trim() || "";
  const organizationName = workspace.name?.trim() || "Helm";
  const buildInviteUrl = (title?: string | null) => {
    const normalizedTitle = title?.trim();
    if (appUrl) {
      const url = new URL("/api/public-auth/dingtalk/start", appUrl);
      url.searchParams.set("org", organizationName);
      url.searchParams.set("ws", workspace.id);
      if (normalizedTitle) {
        url.searchParams.set("title", normalizedTitle);
      }
      return url.toString();
    }

    const params = new URLSearchParams({
      org: organizationName,
      ws: workspace.id,
    });
    if (normalizedTitle) {
      params.set("title", normalizedTitle);
    }
    return `/api/public-auth/dingtalk/start?${params.toString()}`;
  };
  // Defense in depth: callers must opt INTO live send by passing `dryRun: false`
  // explicitly. If the flag is missing entirely we treat it as a dry run so a
  // forgotten parameter cannot fire customer-visible messages.
  const dryRun = resolveDingTalkDirectoryInviteDryRun(input.dryRun);
  const confirmation = input.confirmation;
  if (!dryRun) {
    if (!isValidDingTalkLiveSendConfirmation(confirmation)) {
      throw new DingTalkLiveSendConfirmationRequiredError();
    }

    await writeAuditLog({
      workspaceId: workspace.id,
      userId: confirmation.confirmedByUserId,
      actor: input.operator,
      actorType: ActorType.USER,
      actionType: "DINGTALK_DIRECTORY_INVITE_LIVE_SEND_CONFIRMED",
      targetType: "Connector",
      targetId: "DINGTALK_DIRECTORY_INVITE_SYNC",
      summary: `DingTalk directory invite live send confirmed for ${plannedEmployees.length} planned users`,
      payload: {
        dryRun: false,
        confirmedAt: confirmation.confirmedAt.toISOString(),
        sourcePage: confirmation.sourcePage,
        traceId: confirmation.traceId ?? null,
        plannedUsers: plannedEmployees.length,
        boundary: "explicit-user-confirmation-required-before-customer-visible-message",
      },
      sourcePage: confirmation.sourcePage,
      trace: confirmation.traceId
        ? { traceId: confirmation.traceId }
        : undefined,
    });
  }

  let createdUsers = 0;
  let reusedUsers = 0;
  let upsertedMemberships = 0;
  let sentMessages = 0;
  let skipped = 0;
  let skippedNoMobile = 0;
  let nameCollisionResolved = 0;
  const details: DingTalkDirectoryInviteDetail[] = [];

  for (const employee of plannedEmployees) {
    const normalizedPhone = normalizePhoneNumber(employee.mobile ?? "");
    if (!normalizedPhone) {
      skipped += 1;
      skippedNoMobile += 1;
      const note = `skip ${employee.userId}: missing mobile`;
      errors.push(note);
      details.push({
        dingtalkUserId: employee.userId,
        unionId: employee.unionId,
        name: employee.name,
        mobile: employee.mobile,
        normalizedPhone: null,
        title: employee.title,
        jobNumber: employee.jobNumber,
        deptIds: employee.deptIds,
        isLeader: employee.isLeader,
        placeholderEmail: null,
        userResolution: "UNRESOLVED",
        membershipStatus: "SKIPPED",
        messageStatus: "SKIPPED",
        note,
      });
      continue;
    }

    let user = await db.user.findUnique({
      where: { phone: normalizedPhone },
    });
    let userResolution: DingTalkDirectoryInviteDetail["userResolution"] = "UNRESOLVED";
    let resolvedPlaceholderEmail: string | null = null;
    let detailNote: string | null = null;
    if (user) {
      reusedUsers += 1;
      userResolution = "REUSED_BY_PHONE";
    }

    let emailIndex = employee.preferredIndex;
    if (emailIndex > 1) {
      nameCollisionResolved += 1;
    }
    while (!user) {
      const candidateEmail = buildPlaceholderEmail(employee.emailBase, emailIndex);
      resolvedPlaceholderEmail = candidateEmail;
      const byEmail = await db.user.findUnique({
        where: { email: candidateEmail },
      });
      if (!byEmail) {
        if (dryRun) {
          createdUsers += 1;
          userResolution = "CREATED_PLACEHOLDER_EMAIL";
          break;
        }
        user = await db.user.create({
          data: {
            email: candidateEmail,
            phone: normalizedPhone,
            name: employee.name,
            title: employee.title ?? undefined,
            avatar: employee.avatarUrl ?? undefined,
          },
        });
        createdUsers += 1;
        userResolution = "CREATED_PLACEHOLDER_EMAIL";
        break;
      }

      if (!byEmail.phone || byEmail.phone === normalizedPhone) {
        user = byEmail;
        reusedUsers += 1;
        userResolution = "REUSED_BY_PLACEHOLDER_EMAIL";
        if (!dryRun && !byEmail.phone) {
          user = await db.user.update({
            where: { id: byEmail.id },
            data: { phone: normalizedPhone },
          });
        }
        break;
      }

      emailIndex += 1;
      nameCollisionResolved += 1;
    }

    if (!user && dryRun) {
      // keep rolling in dry run without writes
      upsertedMemberships += 1;
      sentMessages += 1;
      details.push({
        dingtalkUserId: employee.userId,
        unionId: employee.unionId,
        name: employee.name,
        mobile: employee.mobile,
        normalizedPhone,
        title: employee.title,
        jobNumber: employee.jobNumber,
        deptIds: employee.deptIds,
        isLeader: employee.isLeader,
        placeholderEmail: resolvedPlaceholderEmail,
        userResolution,
        membershipStatus: "DRY_RUN_SIMULATED",
        messageStatus: "DRY_RUN_SIMULATED",
        note: null,
      });
      continue;
    }

    if (!user) {
      skipped += 1;
      detailNote = `skip ${employee.userId}: cannot resolve or create user`;
      errors.push(detailNote);
      details.push({
        dingtalkUserId: employee.userId,
        unionId: employee.unionId,
        name: employee.name,
        mobile: employee.mobile,
        normalizedPhone,
        title: employee.title,
        jobNumber: employee.jobNumber,
        deptIds: employee.deptIds,
        isLeader: employee.isLeader,
        placeholderEmail: resolvedPlaceholderEmail,
        userResolution,
        membershipStatus: "SKIPPED",
        messageStatus: "SKIPPED",
        note: detailNote,
      });
      continue;
    }

    let detailMembershipStatus: DingTalkDirectoryInviteDetail["membershipStatus"] = "INVITED_UPSERTED";
    if (!dryRun) {
      const rolePresetKey = suggestRolePresetKeyFromText(
        employee.title,
        workspace.profileType,
        workspace.description,
      );
      const existingMembership = await db.membership.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: workspace.id,
            userId: user.id,
          },
        },
      });
      const membershipRole = existingMembership?.role ?? WorkspaceRole.MEMBER;
      const dbMembershipStatus =
        existingMembership?.status === MembershipStatus.ACTIVE
          ? MembershipStatus.ACTIVE
          : MembershipStatus.INVITED;
      detailMembershipStatus =
        existingMembership?.status === MembershipStatus.ACTIVE
          ? "ACTIVE_KEPT"
          : "INVITED_UPSERTED";

      await db.membership.upsert({
        where: {
          workspaceId_userId: {
            workspaceId: workspace.id,
            userId: user.id,
          },
        },
        create: {
          workspaceId: workspace.id,
          userId: user.id,
          role: membershipRole,
          status: dbMembershipStatus,
          title: employee.title ?? undefined,
          persona: employee.title ?? undefined,
          rolePresetKey,
        },
        update: {
          role: membershipRole,
          status: dbMembershipStatus,
          title: employee.title ?? undefined,
          persona: employee.title ?? undefined,
          rolePresetKey,
        },
      });

      if (!user.title && employee.title) {
        await db.user.update({
          where: { id: user.id },
          data: { title: employee.title },
        });
      }
    }

    upsertedMemberships += 1;

    if (dryRun) {
      sentMessages += 1;
      details.push({
        dingtalkUserId: employee.userId,
        unionId: employee.unionId,
        name: employee.name,
        mobile: employee.mobile,
        normalizedPhone,
        title: employee.title,
        jobNumber: employee.jobNumber,
        deptIds: employee.deptIds,
        isLeader: employee.isLeader,
        placeholderEmail: user.email ?? resolvedPlaceholderEmail,
        userResolution,
        membershipStatus: "DRY_RUN_SIMULATED",
        messageStatus: "DRY_RUN_SIMULATED",
        note: null,
      });
      continue;
    }

    try {
      await sendDingTalkInviteMessage({
        accessToken: appToken.accessToken,
        agentId: appConfig.agentId,
        dingtalkUserId: employee.userId,
        workspaceName: workspace.name,
        inviteUrl: buildInviteUrl(employee.title),
        roleLabel: "MEMBER",
        title: employee.title,
      });
      sentMessages += 1;
      // Per-recipient audit trail keeps the README #5 promise enforceable: every
      // customer-visible action lands a row tying recipient → confirmer → trace.
      await writeAuditLogSafely({
        workspaceId: workspace.id,
        userId: confirmation?.confirmedByUserId ?? null,
        actor: input.operator,
        actorType: ActorType.USER,
        actionType: "DINGTALK_DIRECTORY_INVITE_DISPATCHED",
        targetType: "MEMBERSHIP",
        targetId: user.id,
        summary: `DingTalk invite sent to ${employee.name}`,
        payload: {
          dingtalkUserId: employee.userId,
          unionId: employee.unionId,
          deptIds: employee.deptIds,
          confirmedByUserId: confirmation?.confirmedByUserId ?? null,
          confirmedAt: confirmation?.confirmedAt?.toISOString() ?? null,
          traceId: confirmation?.traceId ?? null,
        },
        sourcePage: confirmation?.sourcePage ?? null,
        trace: confirmation?.traceId
          ? { traceId: confirmation.traceId }
          : undefined,
      });
      details.push({
        dingtalkUserId: employee.userId,
        unionId: employee.unionId,
        name: employee.name,
        mobile: employee.mobile,
        normalizedPhone,
        title: employee.title,
        jobNumber: employee.jobNumber,
        deptIds: employee.deptIds,
        isLeader: employee.isLeader,
        placeholderEmail: user.email ?? resolvedPlaceholderEmail,
        userResolution,
        membershipStatus: detailMembershipStatus,
        messageStatus: "SENT",
        note: null,
      });
    } catch (error) {
      const note = `${employee.userId}: ${error instanceof Error ? error.message : String(error)}`;
      errors.push(note);
      await writeAuditLogSafely({
        workspaceId: workspace.id,
        userId: confirmation?.confirmedByUserId ?? null,
        actor: input.operator,
        actorType: ActorType.USER,
        actionType: "DINGTALK_DIRECTORY_INVITE_FAILED",
        targetType: "MEMBERSHIP",
        targetId: user.id,
        summary: `DingTalk invite send failed for ${employee.name}`,
        payload: {
          dingtalkUserId: employee.userId,
          unionId: employee.unionId,
          deptIds: employee.deptIds,
          errorMessage: error instanceof Error ? error.message : String(error),
          confirmedByUserId: confirmation?.confirmedByUserId ?? null,
          confirmedAt: confirmation?.confirmedAt?.toISOString() ?? null,
          traceId: confirmation?.traceId ?? null,
        },
        sourcePage: confirmation?.sourcePage ?? null,
        trace: confirmation?.traceId
          ? { traceId: confirmation.traceId }
          : undefined,
      });
      details.push({
        dingtalkUserId: employee.userId,
        unionId: employee.unionId,
        name: employee.name,
        mobile: employee.mobile,
        normalizedPhone,
        title: employee.title,
        jobNumber: employee.jobNumber,
        deptIds: employee.deptIds,
        isLeader: employee.isLeader,
        placeholderEmail: user.email ?? resolvedPlaceholderEmail,
        userResolution,
        membershipStatus: detailMembershipStatus,
        messageStatus: "FAILED",
        note,
      });
    }
  }

  return {
    ok: errors.length === 0,
    processed: plannedEmployees.length,
    createdUsers,
    reusedUsers,
    upsertedMemberships,
    sentMessages,
    skipped,
    skippedNoMobile,
    nameCollisionResolved,
    errors,
    details,
  } satisfies DingTalkDirectoryInviteResult;
}

async function writeAuditLogSafely(input: Parameters<typeof writeAuditLog>[0]) {
  try {
    await writeAuditLog(input);
  } catch (error) {
    // Audit failure must NEVER swallow the original send result. We log to
    // stderr so operators can correlate, but the dispatch outcome stays
    // user-visible as either SENT or FAILED.
    console.warn(
      `[dingtalk-directory-invite] failed to record audit (${input.actionType} -> ${input.targetId}):`,
      error instanceof Error ? error.message : error,
    );
  }
}
