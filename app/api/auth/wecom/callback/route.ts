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
  buildWeComCallbackResult,
  exchangeWeComAuthCode,
  fetchWeComUserProfile,
  getWeComStateCookieName,
  persistWeComConnectorCallbackResult,
  WECOM_CALLBACK_FAILURE_POSTURES,
  WECOM_CALLBACK_RESULT_STATUSES,
  WECOM_OAUTH_CALLBACK_AUDIT_ACTIONS,
  WECOM_OAUTH_CALLBACK_SOURCE_PAGE,
} from "@/lib/connectors/wecom";
import { db } from "@/lib/db";
import { isEnglishWorkspaceDefaultLocale } from "@/lib/i18n/api-message-locale";

function normalizeEmail(value: string | null | undefined) {
  const trimmed = value?.trim().toLowerCase();
  return trimmed ? trimmed : null;
}

function buildSettingsRedirect(request: Request, params: Record<string, string | null | undefined>) {
  const url = new URL("/settings", request.url);
  url.searchParams.set("tab", "connectors");
  url.searchParams.set("connector", "wecom");

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
        return "WeCom OAuth callback completed and the workspace-scoped session is active.";
      case "oauth-error":
        return "WeCom returned an OAuth error during callback.";
      case "failure":
        return "WeCom callback failed before identity binding completed.";
      case "unresolved":
        return "WeCom callback completed, but Helm could not resolve the WeCom identity to the active workspace user.";
      case "mismatch":
        return "WeCom callback completed, but the WeCom identity does not match the active workspace user.";
      case "missing-state":
        return "WeCom callback state is missing or expired.";
      case "invalid-state":
        return "WeCom callback state could not be trusted.";
      case "forbidden":
        return "The current role cannot manage WeCom connector callbacks for this workspace.";
    }
  }

  switch (input.status) {
    case "connected":
      return "企业微信 OAuth 回调已完成，当前工作区范围会话已生效。";
    case "oauth-error":
      return "企业微信在回调阶段返回了 OAuth 错误。";
    case "failure":
      return "企业微信回调在身份绑定完成前失败。";
    case "unresolved":
      return "企业微信回调已完成，但 Helm 无法把企业微信身份解析到当前工作区用户。";
    case "mismatch":
      return "企业微信回调已完成，但企业微信身份与当前工作区用户不匹配。";
    case "missing-state":
      return "企业微信回调状态 缺失或已过期。";
    case "invalid-state":
      return "企业微信回调状态 无法被信任。";
    case "forbidden":
      return "当前角色不能管理这个工作区的企业微信连接器回调。";
  }
}

async function persistWeComCallbackAudit(input: {
  workspaceId: string;
  userId: string;
  actor: string;
  connectorId: string;
  actionType: string;
  summary: string;
  callbackResult: ReturnType<typeof buildWeComCallbackResult>;
  provider: "WECOM";
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
    sourcePage: WECOM_OAUTH_CALLBACK_SOURCE_PAGE,
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
  const rawState = cookieStore.get(getWeComStateCookieName())?.value ?? null;
  cookieStore.delete(getWeComStateCookieName());

  const currentUser = await getCurrentUser();

  if (!state || !rawState) {
    return buildSettingsRedirect(request, {
      status: "missing-state",
      message: buildCallbackStatusCopy({
        english: true,
        status: "missing-state",
      }),
    });
  }

  const callbackContext = await resolveWorkspaceOauthCallbackContext({
    rawState,
    stateParam: state,
    currentUser,
    capability: "connectors",
    english: true,
  });

  if (!callbackContext.ok) {
    return buildSettingsRedirect(request, {
      status: callbackContext.status,
      message: buildCallbackStatusCopy({
        english: true,
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
      message: "Workspace callback context could not be resolved.",
    });
  }

  const english = isEnglishWorkspaceDefaultLocale(workspace.defaultLocale);

  const persistFailure = async (input: {
    status: keyof typeof WECOM_CALLBACK_RESULT_STATUSES;
    failurePosture: keyof typeof WECOM_CALLBACK_FAILURE_POSTURES;
    actionType: keyof typeof WECOM_OAUTH_CALLBACK_AUDIT_ACTIONS;
    redirectStatus: "oauth-error" | "failure" | "unresolved" | "mismatch";
    summary: string;
    message?: string | null;
    profile?: Awaited<ReturnType<typeof fetchWeComUserProfile>> | null;
    corpId?: string | null;
    matchedWorkspaceUserEmail?: string | null;
  }) => {
    const callbackResult = buildWeComCallbackResult({
      status: WECOM_CALLBACK_RESULT_STATUSES[input.status],
      failurePosture: WECOM_CALLBACK_FAILURE_POSTURES[input.failurePosture],
      message: input.message ?? buildCallbackStatusCopy({ english, status: input.redirectStatus }),
      profile: input.profile ?? null,
      corpId: input.corpId ?? null,
      matchedWorkspaceUserEmail: input.matchedWorkspaceUserEmail ?? null,
    });
    const connector = await persistWeComConnectorCallbackResult({
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

    await persistWeComCallbackAudit({
      workspaceId: workspace.id,
      userId: workspaceUser.id,
      actor: workspaceUser.name,
      connectorId: connector.id,
      actionType: WECOM_OAUTH_CALLBACK_AUDIT_ACTIONS[input.actionType],
      summary: input.summary,
      callbackResult,
      provider: "WECOM",
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
      summary: english
        ? "WeCom OAuth callback returned an OAuth error"
        : "企业微信 OAuth 回调返回了错误",
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
        ? "WeCom OAuth callback did not return an authorization code"
        : "企业微信 OAuth 回调没有返回授权码",
      message: english
        ? "WeCom callback did not include an authorization code."
        : "企业微信回调没有带回授权码。",
    });
  }

  try {
    const identity = await exchangeWeComAuthCode(authCode);
    const profile = await fetchWeComUserProfile({
      accessToken: identity.accessToken,
      userId: identity.userId,
      openId: identity.openId,
    });
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
          ? "WeCom OAuth callback could not resolve a provider email or mobile"
          : "企业微信 OAuth 回调无法解析服务商邮箱或手机号",
        message: identity.userId
          ? english
            ? "WeCom returned a user identifier, but no email or mobile that Helm could bind to the active workspace user."
            : "企业微信返回了用户标识，但没有返回 Helm 可用于绑定当前工作区用户的邮箱或手机号。"
          : english
            ? "WeCom callback did not return an internal user identifier that Helm could bind to the active workspace user."
            : "企业微信回调没有返回 Helm 可用于绑定当前工作区用户的内部用户标识。",
        profile,
        corpId: identity.corpId,
      });
    }

    if (!matchedWorkspaceUserIdentity) {
      const providerIdentity = providerEmail ?? providerMobile;
      const workspaceIdentity = workspaceEmail ?? workspaceMobile;
      return persistFailure({
        status: "MISMATCH",
        failurePosture: "REVIEW_REQUIRED",
        actionType: "MISMATCH",
        redirectStatus: "mismatch",
        summary: english
          ? "WeCom OAuth callback identity mismatched the active workspace user"
          : "企业微信 OAuth 回调身份与当前工作区用户不匹配",
        message:
          providerIdentity && workspaceIdentity
            ? english
              ? `WeCom returned ${providerIdentity}, but the active workspace user is ${workspaceIdentity}.`
              : `企业微信返回的是 ${providerIdentity}，但当前工作区用户是 ${workspaceIdentity}。`
            : english
              ? "WeCom callback returned an identity that does not match the active workspace user."
              : "企业微信回调返回的身份与当前工作区用户不匹配。",
        profile,
        corpId: identity.corpId,
        matchedWorkspaceUserEmail: workspaceIdentity,
      });
    }

    await createSession({
      userId: workspaceUser.id,
      email: workspaceUser.email,
      workspaceId: workspace.id,
      sourcePage: WECOM_OAUTH_CALLBACK_SOURCE_PAGE,
      providerType: AUTH_SESSION_PROVIDER_TYPES.WECOM_OAUTH,
    });

    const callbackResult = buildWeComCallbackResult({
      status: WECOM_CALLBACK_RESULT_STATUSES.SUCCESS,
      failurePosture: WECOM_CALLBACK_FAILURE_POSTURES.CLEAR,
      message: buildCallbackStatusCopy({ english, status: "connected" }),
      profile,
      corpId: identity.corpId,
      matchedWorkspaceUserEmail: matchedWorkspaceUserIdentity,
    });

    const connector = await persistWeComConnectorCallbackResult({
      workspaceId: workspace.id,
      userId: workspaceUser.id,
      connectorStatus: ConnectorStatus.CONNECTED,
      externalAccountEmail: providerEmail,
      accessToken: identity.accessToken,
      expireInSeconds: identity.expireInSeconds,
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
        externalAccountEmail: providerEmail,
        corpId: identity.corpId,
        callbackStatus: callbackResult.status,
      },
      sourcePage: WECOM_OAUTH_CALLBACK_SOURCE_PAGE,
    });
    await persistWeComCallbackAudit({
      workspaceId: workspace.id,
      userId: workspaceUser.id,
      actor: workspaceUser.name,
      connectorId: connector.id,
      actionType: WECOM_OAUTH_CALLBACK_AUDIT_ACTIONS.SUCCESS,
      summary: english
        ? `WeCom OAuth callback resolved ${matchedWorkspaceUserIdentity} for the active workspace user`
        : `企业微信 OAuth 回调已把 ${matchedWorkspaceUserIdentity} 解析到当前工作区用户`,
      callbackResult,
      provider: "WECOM",
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
        ? `Connected WeCom callback foundation for ${matchedWorkspaceUserIdentity}`
        : `已为 ${matchedWorkspaceUserIdentity} 建立企业微信回调基础连接`,
      payload: {
        provider: connector.provider,
        authMode: "oauth_callback_foundation",
        callbackResult,
      },
      sourcePage: WECOM_OAUTH_CALLBACK_SOURCE_PAGE,
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
        ? "WeCom OAuth callback failed before the connector state could be stabilized"
        : "企业微信 OAuth 回调在连接状态稳定前失败",
      message:
        callbackError instanceof Error
          ? callbackError.message
          : english
            ? "WeCom callback failed"
            : "企业微信回调失败",
    });
  }
}
