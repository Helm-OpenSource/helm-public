import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { ActorType, ConnectorStatus } from "@prisma/client";
import { logEvent } from "@/lib/analytics";
import { resolveWorkspaceOauthCallbackContext } from "@/lib/auth/oauth-callback-governance";
import { AUTH_SESSION_PROVIDER_TYPES } from "@/lib/auth/provider-seam";
import { normalizePhoneNumber } from "@/lib/auth/formal-auth";
import { createSession, getCurrentUser } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import {
  buildFeishuCallbackResult,
  exchangeFeishuAuthCode,
  fetchFeishuUserProfile,
  FEISHU_CALLBACK_FAILURE_POSTURES,
  FEISHU_CALLBACK_RESULT_STATUSES,
  FEISHU_OAUTH_CALLBACK_AUDIT_ACTIONS,
  FEISHU_OAUTH_CALLBACK_SOURCE_PAGE,
  getFeishuStateCookieName,
  persistFeishuConnectorCallbackResult,
} from "@/lib/connectors/feishu";
import { db } from "@/lib/db";
import {
  isEnglishWorkspaceDefaultLocale,
  resolveApiWorkspaceMessage,
} from "@/lib/i18n/api-message-locale";
import { resolveUiLocale, UI_LOCALE_COOKIE } from "@/lib/i18n/config";

function normalizeEmail(value: string | null | undefined) {
  const trimmed = value?.trim().toLowerCase();
  return trimmed ? trimmed : null;
}

function buildSettingsRedirect(request: Request, params: Record<string, string | null | undefined>) {
  const url = new URL("/settings", request.url);
  url.searchParams.set("tab", "connectors");
  url.searchParams.set("connector", "feishu");

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      url.searchParams.set(key, value);
    }
  }

  return NextResponse.redirect(url);
}

function buildCallbackStatusCopy(input: {
  english: boolean;
  status:
    | "connected"
    | "oauth-error"
    | "failure"
    | "unresolved"
    | "mismatch"
    | "missing-state"
    | "invalid-state"
    | "forbidden";
  message?: string | null;
}) {
  if (input.message?.trim()) {
    return input.message.trim();
  }

  if (input.english) {
    switch (input.status) {
      case "connected":
        return "Feishu OAuth callback completed and the workspace-scoped session is active.";
      case "oauth-error":
        return "Feishu returned an OAuth error during callback.";
      case "failure":
        return "Feishu callback failed before identity binding completed.";
      case "unresolved":
        return "Feishu callback completed, but Helm could not resolve the Feishu identity to the active workspace user.";
      case "mismatch":
        return "Feishu callback completed, but the Feishu identity does not match the active workspace user.";
      case "missing-state":
        return "Feishu callback state is missing or expired.";
      case "invalid-state":
        return "Feishu callback state could not be trusted.";
      case "forbidden":
        return "The current role cannot manage Feishu connector callbacks for this workspace.";
    }
  }

  switch (input.status) {
    case "connected":
      return "飞书 OAuth 回调已完成，当前工作区范围会话已生效。";
    case "oauth-error":
      return "飞书在回调阶段返回了 OAuth 错误。";
    case "failure":
      return "飞书回调在身份绑定完成前失败。";
    case "unresolved":
      return "飞书回调已完成，但 Helm 无法把飞书身份解析到当前工作区用户。";
    case "mismatch":
      return "飞书回调已完成，但飞书身份与当前工作区用户不匹配。";
    case "missing-state":
      return "飞书回调状态缺失或已过期。";
    case "invalid-state":
      return "飞书回调状态无法被信任。";
    case "forbidden":
      return "当前角色不能管理这个工作区的飞书连接器回调。";
  }
}

async function persistFeishuCallbackAudit(input: {
  workspaceId: string;
  userId: string;
  actor: string;
  connectorId: string;
  actionType: string;
  summary: string;
  callbackResult: ReturnType<typeof buildFeishuCallbackResult>;
  provider: "FEISHU";
  role: string;
}) {
  await writeAuditLog({
    workspaceId: input.workspaceId,
    userId: input.userId,
    actor: input.actor,
    actorType: ActorType.USER,
    actionType: input.actionType,
    targetType: "Connector",
    targetId: input.connectorId,
    summary: input.summary,
    payload: {
      provider: input.provider,
      callbackResult: input.callbackResult,
      capability: "connectors",
      workspaceMembershipRole: input.role,
    },
    sourcePage: FEISHU_OAUTH_CALLBACK_SOURCE_PAGE,
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const authCode = url.searchParams.get("code") ?? url.searchParams.get("authCode");
  const state = url.searchParams.get("state");
  const error =
    url.searchParams.get("error") ??
    url.searchParams.get("errmsg") ??
    url.searchParams.get("message");
  const cookieStore = await cookies();
  const rawState = cookieStore.get(getFeishuStateCookieName())?.value ?? null;
  const requestLocale = resolveUiLocale(cookieStore.get(UI_LOCALE_COOKIE)?.value);
  const requestEnglish = requestLocale === "en-US";
  cookieStore.delete(getFeishuStateCookieName());

  const currentUser = await getCurrentUser();

  if (!state || !rawState) {
    return buildSettingsRedirect(request, {
      status: "missing-state",
      message: buildCallbackStatusCopy({
        english: requestEnglish,
        status: "missing-state",
      }),
    });
  }

  const callbackContext = await resolveWorkspaceOauthCallbackContext({
    rawState,
    stateParam: state,
    currentUser,
    capability: "connectors",
    english: requestEnglish,
  });

  if (!callbackContext.ok) {
    return buildSettingsRedirect(request, {
      status: callbackContext.status,
      message: buildCallbackStatusCopy({
        english: requestEnglish,
        status: callbackContext.status,
        message: callbackContext.message,
      }),
    });
  }

  const [workspace, workspaceUser] = await Promise.all([
    db.workspace.findUnique({
      where: { id: callbackContext.workspaceId },
      select: {
        id: true,
        defaultLocale: true,
      },
    }),
    db.user.findUnique({
      where: { id: callbackContext.userId },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
      },
    }),
  ]);

  if (!workspace || !workspaceUser) {
    return buildSettingsRedirect(request, {
      status: "failure",
      message: resolveApiWorkspaceMessage(requestLocale, {
        zh: "无法解析工作区回调上下文。",
        en: "Workspace callback context could not be resolved.",
      }),
    });
  }

  const english = isEnglishWorkspaceDefaultLocale(workspace.defaultLocale);

  const persistFailure = async (input: {
    status: keyof typeof FEISHU_CALLBACK_RESULT_STATUSES;
    failurePosture: keyof typeof FEISHU_CALLBACK_FAILURE_POSTURES;
    actionType: keyof typeof FEISHU_OAUTH_CALLBACK_AUDIT_ACTIONS;
    redirectStatus: "oauth-error" | "failure" | "unresolved" | "mismatch";
    summary: string;
    message?: string | null;
    profile?: Awaited<ReturnType<typeof fetchFeishuUserProfile>> | null;
    tenantKey?: string | null;
    matchedWorkspaceUserEmail?: string | null;
  }) => {
    const callbackResult = buildFeishuCallbackResult({
      status: FEISHU_CALLBACK_RESULT_STATUSES[input.status],
      failurePosture: FEISHU_CALLBACK_FAILURE_POSTURES[input.failurePosture],
      message: input.message ?? buildCallbackStatusCopy({ english, status: input.redirectStatus }),
      profile: input.profile ?? null,
      tenantKey: input.tenantKey ?? null,
      matchedWorkspaceUserEmail: input.matchedWorkspaceUserEmail ?? null,
    });
    const connector = await persistFeishuConnectorCallbackResult({
      workspaceId: workspace.id,
      userId: workspaceUser.id,
      connectorStatus: ConnectorStatus.ERROR,
      externalAccountEmail: callbackResult.providerEmail,
      lastSyncStatus:
        input.redirectStatus === "mismatch"
          ? english
            ? "OAuth callback mismatch"
            : "OAuth 回调不匹配"
          : input.redirectStatus === "unresolved"
            ? english
              ? "OAuth callback unresolved"
              : "OAuth 回调未解析"
            : english
              ? "OAuth callback failed"
              : "OAuth 回调失败",
      lastSyncMessage: callbackResult.message,
      callbackResult,
    });

    await persistFeishuCallbackAudit({
      workspaceId: workspace.id,
      userId: workspaceUser.id,
      actor: workspaceUser.name,
      connectorId: connector.id,
      actionType: FEISHU_OAUTH_CALLBACK_AUDIT_ACTIONS[input.actionType],
      summary: input.summary,
      callbackResult,
      provider: "FEISHU",
      role: callbackContext.role,
    });
    revalidatePath("/settings");

    return buildSettingsRedirect(request, {
      status: input.redirectStatus,
      message: callbackResult.message,
    });
  };

  if (error) {
    return persistFailure({
      status: "FAILURE",
      failurePosture: "REVIEW_REQUIRED",
      actionType: "FAILURE",
      redirectStatus: "oauth-error",
      summary: english ? "Feishu OAuth callback returned an OAuth error" : "飞书 OAuth 回调返回了错误",
      message: error,
    });
  }

  if (!authCode) {
    return persistFailure({
      status: "FAILURE",
      failurePosture: "REVIEW_REQUIRED",
      actionType: "FAILURE",
      redirectStatus: "failure",
      summary: english
        ? "Feishu OAuth callback did not return an authorization code"
        : "飞书 OAuth 回调没有返回授权码",
      message: english
        ? "Feishu callback did not include an authorization code."
        : "飞书回调没有带回授权码。",
    });
  }

  try {
    const token = await exchangeFeishuAuthCode(authCode);
    const profile = await fetchFeishuUserProfile(token.accessToken);
    const providerEmail = normalizeEmail(profile.email);
    const providerMobile = normalizePhoneNumber(profile.mobile ?? "");
    const workspaceEmail = normalizeEmail(workspaceUser.email);
    const workspaceMobile = normalizePhoneNumber(workspaceUser.phone ?? "");
    const matchedWorkspaceUserIdentity =
      providerEmail && workspaceEmail && providerEmail === workspaceEmail
        ? workspaceEmail
        : providerMobile && workspaceMobile && providerMobile === workspaceMobile
          ? workspaceEmail ?? workspaceMobile
          : null;

    if (!providerEmail && !providerMobile) {
      return persistFailure({
        status: "UNRESOLVED",
        failurePosture: "REVIEW_REQUIRED",
        actionType: "UNRESOLVED",
        redirectStatus: "unresolved",
        summary: english
          ? "Feishu OAuth callback could not resolve a provider email or mobile"
          : "飞书 OAuth 回调无法解析服务商邮箱或手机号",
        message: english
          ? "Feishu returned no email or mobile that Helm could bind to the active workspace user."
          : "飞书没有返回 Helm 可用于绑定当前工作区用户的邮箱或手机号。",
        profile,
        tenantKey: token.tenantKey,
      });
    }

    if (!matchedWorkspaceUserIdentity) {
      return persistFailure({
        status: "MISMATCH",
        failurePosture: "REVIEW_REQUIRED",
        actionType: "MISMATCH",
        redirectStatus: "mismatch",
        summary: english
          ? "Feishu OAuth callback identity mismatched the active workspace user"
          : "飞书 OAuth 回调身份与当前工作区用户不匹配",
        message: english
          ? `Feishu returned ${providerEmail ?? providerMobile}, but the active workspace user is ${workspaceEmail ?? workspaceMobile}.`
          : `飞书返回的是 ${providerEmail ?? providerMobile}，但当前工作区用户是 ${workspaceEmail ?? workspaceMobile}。`,
        profile,
        tenantKey: token.tenantKey,
        matchedWorkspaceUserEmail: workspaceEmail,
      });
    }

    await createSession({
      userId: workspaceUser.id,
      email: workspaceUser.email,
      workspaceId: workspace.id,
      sourcePage: FEISHU_OAUTH_CALLBACK_SOURCE_PAGE,
      providerType: AUTH_SESSION_PROVIDER_TYPES.FEISHU_OAUTH,
    });

    const callbackResult = buildFeishuCallbackResult({
      status: FEISHU_CALLBACK_RESULT_STATUSES.SUCCESS,
      failurePosture: FEISHU_CALLBACK_FAILURE_POSTURES.CLEAR,
      message: buildCallbackStatusCopy({ english, status: "connected" }),
      profile,
      tenantKey: token.tenantKey,
      matchedWorkspaceUserEmail: workspaceEmail,
    });

    const connector = await persistFeishuConnectorCallbackResult({
      workspaceId: workspace.id,
      userId: workspaceUser.id,
      connectorStatus: ConnectorStatus.CONNECTED,
      externalAccountEmail: providerEmail ?? workspaceEmail,
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      expireInSeconds: token.expireInSeconds,
      lastSyncStatus: english ? "OAuth callback connected" : "OAuth 回调已连接",
      lastSyncMessage: callbackResult.message,
      callbackResult,
    });

    await logEvent({
      workspaceId: connector.workspaceId,
      userId: connector.userId,
      eventName: "connector_connected",
      eventCategory: "connector",
      targetType: "Connector",
      targetId: connector.id,
      metadata: {
        provider: connector.provider,
        externalAccountEmail: providerEmail ?? workspaceEmail,
        tenantKey: token.tenantKey,
        callbackStatus: callbackResult.status,
      },
      sourcePage: FEISHU_OAUTH_CALLBACK_SOURCE_PAGE,
    });
    await persistFeishuCallbackAudit({
      workspaceId: workspace.id,
      userId: workspaceUser.id,
      actor: workspaceUser.name,
      connectorId: connector.id,
      actionType: FEISHU_OAUTH_CALLBACK_AUDIT_ACTIONS.SUCCESS,
      summary: english
        ? `Feishu OAuth callback resolved ${providerEmail ?? providerMobile} for the active workspace user`
        : `飞书 OAuth 回调已把 ${providerEmail ?? providerMobile} 解析到当前工作区用户`,
      callbackResult,
      provider: "FEISHU",
      role: callbackContext.role,
    });
    await writeAuditLog({
      workspaceId: workspace.id,
      userId: workspaceUser.id,
      actor: workspaceUser.name,
      actorType: ActorType.USER,
      actionType: "CONNECTOR_CONNECTED",
      targetType: "Connector",
      targetId: connector.id,
      summary: english
        ? `Connected Feishu callback foundation for ${providerEmail ?? workspaceEmail}`
        : `已为 ${providerEmail ?? workspaceEmail} 建立飞书回调基础连接`,
      payload: {
        provider: connector.provider,
        authMode: "oauth_callback_foundation",
        callbackResult,
      },
      sourcePage: FEISHU_OAUTH_CALLBACK_SOURCE_PAGE,
    });

    revalidatePath("/settings");

    return buildSettingsRedirect(request, {
      status: "connected",
      message: callbackResult.message,
    });
  } catch (callbackError) {
    return persistFailure({
      status: "FAILURE",
      failurePosture: "RETRYABLE",
      actionType: "FAILURE",
      redirectStatus: "failure",
      summary: english
        ? "Feishu OAuth callback failed before the connector state could be stabilized"
        : "飞书 OAuth 回调在连接状态稳定前失败",
      message:
        callbackError instanceof Error
          ? callbackError.message
          : english
            ? "Feishu callback failed"
            : "飞书回调失败",
    });
  }
}
