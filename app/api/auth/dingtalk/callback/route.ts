import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { ActorType, ConnectorStatus } from "@prisma/client";
import { logEvent } from "@/lib/analytics";
import { writeAuditLog } from "@/lib/audit";
import { resolveWorkspaceOauthCallbackContext } from "@/lib/auth/oauth-callback-governance";
import { AUTH_SESSION_PROVIDER_TYPES } from "@/lib/auth/provider-seam";
import { createSession, getCurrentUser } from "@/lib/auth/session";
import {
  buildPublicOauthFallbackUrl,
  buildPublicOauthSignupUrl,
  consumePublicOauthStateByLookup,
  DINGTALK_PUBLIC_AUTH_STATE_COOKIE,
  finalizePublicOauthLogin,
  readPublicOauthState,
  resolvePublicOauthRequestBaseUrl,
  resolvePublicOauthUserMatch,
  writePublicOauthSignupPrefillCookie,
} from "@/lib/auth/public-oauth";
import { resolvePublicOauthQrFlow } from "@/lib/auth/public-oauth-qr-flow";
import {
  buildDingTalkCallbackResult,
  DINGTALK_CALLBACK_FAILURE_POSTURES,
  DINGTALK_CALLBACK_RESULT_STATUSES,
  DINGTALK_OAUTH_CALLBACK_AUDIT_ACTIONS,
  DINGTALK_OAUTH_CALLBACK_SOURCE_PAGE,
  exchangeDingTalkAuthCode,
  fetchDingTalkUserProfile,
  getDingTalkStateCookieName,
  persistDingTalkConnectorCallbackResult,
} from "@/lib/connectors/dingtalk";
import { db } from "@/lib/db";
import {
  isEnglishWorkspaceDefaultLocale,
  resolveApiWorkspaceMessage,
} from "@/lib/i18n/api-message-locale";
import { resolveUiLocale, UI_LOCALE_COOKIE, type UiLocale } from "@/lib/i18n/config";

function normalizeEmail(value: string | null | undefined) {
  const trimmed = value?.trim().toLowerCase();
  return trimmed ? trimmed : null;
}

function redirectAbsolute(url: URL) {
  const response = NextResponse.redirect(url, 307);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function redirectRelative(request: Request, location: string) {
  return redirectAbsolute(new URL(location, resolvePublicOauthRequestBaseUrl(request)));
}

function redirectPublicUrl(url: URL) {
  return redirectAbsolute(url);
}

function buildPublicQrCallbackAckResponse(input: {
  preferredLocale: UiLocale;
  mobileHref?: string | null;
  status:
    | "matched"
    | "unmatched"
    | "identity-conflict"
    | "missing-identity"
    | "oauth-error"
    | "failure";
}) {
  const english = input.preferredLocale === "en-US";
  const titleMap = {
    matched: english ? "Sign-in Confirmed" : "登录确认成功",
    unmatched: english ? "Sign-up Required" : "需要注册后继续",
    "identity-conflict": english ? "Identity Conflict" : "身份信息冲突",
    "missing-identity": english ? "Identity Incomplete" : "身份信息不完整",
    "oauth-error": english ? "DingTalk Authorization Failed" : "钉钉授权失败",
    failure: english ? "Sign-in Incomplete" : "登录未完成",
  } as const;
  const hasMobileSession = input.status === "matched" && Boolean(input.mobileHref);
  const bodyMap = {
    matched: hasMobileSession
      ? english
        ? "Helm sign-in is active on this phone. Continue in the mobile command surface, or return to desktop if you started from a QR code."
        : "这台手机上的 Helm 登录已生效。你可以直接进入移动端，也可以回到电脑端继续。"
      : english
        ? "You can return to your desktop to continue Helm sign-in."
        : "请返回电脑端继续完成 Helm 登录。",
    unmatched: english
      ? "Please return to your desktop to continue Helm sign-up."
      : "请返回电脑端继续完成 Helm 注册。",
    "identity-conflict": english
      ? "Please return to your desktop and use manual sign-in."
      : "请返回电脑端并改用手动登录。",
    "missing-identity": english
      ? "DingTalk did not return enough profile data. Please return to desktop and use manual sign-in."
      : "钉钉返回的资料不足，请返回电脑端改用手动登录。",
    "oauth-error": english
      ? "DingTalk authorization returned an error. Please return to desktop and retry."
      : "钉钉授权返回错误，请返回电脑端重试。",
    failure: english
      ? "This attempt was not completed. Please return to desktop and retry."
      : "本次登录未完成，请返回电脑端重试。",
  } as const;
  const homeUrl = hasMobileSession && input.mobileHref ? input.mobileHref : "/";
  const html = `<!doctype html>
<html lang="${english ? "en" : "zh-CN"}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${titleMap[input.status]}</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Segoe UI", sans-serif; margin: 0; background: #f7f8fa; color: #111827; }
      .wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; box-sizing: border-box; }
      .card { width: min(480px, 100%); background: #fff; border: 1px solid #e5e7eb; border-radius: 16px; padding: 24px; box-sizing: border-box; }
      h1 { margin: 0 0 12px; font-size: 20px; line-height: 1.35; }
      p { margin: 0; color: #4b5563; line-height: 1.6; font-size: 14px; }
      a { margin-top: 16px; display: inline-block; color: #0f766e; text-decoration: none; font-weight: 600; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        <h1>${titleMap[input.status]}</h1>
        <p>${bodyMap[input.status]}</p>
        <a href="${homeUrl}">${hasMobileSession ? (english ? "Open Helm Mobile" : "进入 Helm 移动端") : (english ? "Open Helm" : "打开 Helm")}</a>
      </div>
    </div>
  </body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function buildSettingsRedirect(request: Request, params: Record<string, string | null | undefined>) {
  const url = new URL("/settings", resolvePublicOauthRequestBaseUrl(request));
  url.searchParams.set("tab", "connectors");
  url.searchParams.set("connector", "dingtalk");

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
        return "DingTalk OAuth callback completed and the workspace-scoped session is active.";
      case "oauth-error":
        return "DingTalk returned an OAuth error during callback.";
      case "failure":
        return "DingTalk callback failed before identity binding completed.";
      case "unresolved":
        return "DingTalk callback completed, but Helm could not resolve the DingTalk identity to the active workspace user.";
      case "mismatch":
        return "DingTalk callback completed, but the DingTalk identity does not match the active workspace user.";
      case "missing-state":
        return "DingTalk callback state is missing or expired.";
      case "invalid-state":
        return "DingTalk callback state could not be trusted.";
      case "forbidden":
        return "The current role cannot manage DingTalk connector callbacks for this workspace.";
    }
  }

  switch (input.status) {
    case "connected":
      return "钉钉 OAuth 回调已完成，当前工作区范围会话已生效。";
    case "oauth-error":
      return "钉钉在回调阶段返回了 OAuth 错误。";
    case "failure":
      return "钉钉回调在身份绑定完成前失败。";
    case "unresolved":
      return "钉钉回调已完成，但 Helm 无法把钉钉身份解析到当前工作区用户。";
    case "mismatch":
      return "钉钉回调已完成，但钉钉身份与当前工作区用户不匹配。";
    case "missing-state":
      return "钉钉回调状态 缺失或已过期。";
    case "invalid-state":
      return "钉钉回调状态 无法被信任。";
    case "forbidden":
      return "当前角色不能管理这个工作区的钉钉连接器回调。";
  }
}

async function persistDingTalkCallbackAudit(input: {
  workspaceId: string;
  userId: string;
  actor: string;
  connectorId: string;
  actionType: string;
  summary: string;
  callbackResult: ReturnType<typeof buildDingTalkCallbackResult>;
  provider: "DINGTALK";
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
    sourcePage: DINGTALK_OAUTH_CALLBACK_SOURCE_PAGE,
  });
}

async function handlePublicCallback(input: {
  request: Request;
  authCode: string | null;
  error: string | null;
  preferredLocale: UiLocale;
  flowId?: string | null;
  invitedOrganizationName?: string | null;
  invitedWorkspaceId?: string | null;
  invitedTitle?: string | null;
}) {
  const cookieStore = await cookies();
  const hasQrFlow = Boolean(input.flowId?.trim());
  const buildFailureRedirect = (reason: string) => {
    const url = buildPublicOauthFallbackUrl(input.request, "dingtalk", "failure");
    url.searchParams.set("reason", reason);
    return redirectPublicUrl(url);
  };

  if (input.error) {
    await resolvePublicOauthQrFlow({
      flowId: input.flowId,
      provider: "dingtalk",
      resolution: {
        status: "oauth-error",
        preferredLocale: input.preferredLocale,
      },
    });
    if (hasQrFlow) {
      return buildPublicQrCallbackAckResponse({
        preferredLocale: input.preferredLocale,
        status: "oauth-error",
      });
    }
    return redirectPublicUrl(
      buildPublicOauthFallbackUrl(input.request, "dingtalk", "oauth-error"),
    );
  }

  if (!input.authCode) {
    await resolvePublicOauthQrFlow({
      flowId: input.flowId,
      provider: "dingtalk",
      resolution: {
        status: "failure",
        preferredLocale: input.preferredLocale,
      },
    });
    if (hasQrFlow) {
      return buildPublicQrCallbackAckResponse({
        preferredLocale: input.preferredLocale,
        status: "failure",
      });
    }
    return buildFailureRedirect("callback-missing-authcode");
  }

  let token: Awaited<ReturnType<typeof exchangeDingTalkAuthCode>>;
  try {
    token = await exchangeDingTalkAuthCode(input.authCode);
  } catch (error) {
    console.error("[dingtalk-public-oauth] exchange auth code failed", error);
    await resolvePublicOauthQrFlow({
      flowId: input.flowId,
      provider: "dingtalk",
      resolution: {
        status: "failure",
        preferredLocale: input.preferredLocale,
      },
    });
    if (hasQrFlow) {
      return buildPublicQrCallbackAckResponse({
        preferredLocale: input.preferredLocale,
        status: "failure",
      });
    }
    return buildFailureRedirect("callback-token-exchange-failed");
  }

  let profile: Awaited<ReturnType<typeof fetchDingTalkUserProfile>>;
  try {
    profile = await fetchDingTalkUserProfile(token.accessToken);
  } catch (error) {
    console.error("[dingtalk-public-oauth] fetch user profile failed", error);
    await resolvePublicOauthQrFlow({
      flowId: input.flowId,
      provider: "dingtalk",
      resolution: {
        status: "failure",
        preferredLocale: input.preferredLocale,
      },
    });
    if (hasQrFlow) {
      return buildPublicQrCallbackAckResponse({
        preferredLocale: input.preferredLocale,
        status: "failure",
      });
    }
    return buildFailureRedirect("callback-profile-fetch-failed");
  }

  try {
    const match = await resolvePublicOauthUserMatch({
      email: profile.email,
      phone: profile.mobile,
      preferPhoneMatch: true,
    });

    if (match.status === "matched") {
      const loginInput = {
        user: match.user,
        sourcePage: DINGTALK_OAUTH_CALLBACK_SOURCE_PAGE,
        providerType: AUTH_SESSION_PROVIDER_TYPES.DINGTALK_OAUTH,
        preferredLocale: input.preferredLocale,
        preferredWorkspaceId: input.invitedWorkspaceId ?? null,
        profile: {
          name: profile.nick,
          phone: profile.mobile,
          avatar: profile.avatarUrl,
        },
      } satisfies Parameters<typeof finalizePublicOauthLogin>[0];

      if (hasQrFlow) {
        const result = await finalizePublicOauthLogin(loginInput);

        if (!result.ok) {
          await resolvePublicOauthQrFlow({
            flowId: input.flowId,
            provider: "dingtalk",
            resolution: {
              status: "failure",
              preferredLocale: input.preferredLocale,
            },
          });

          return buildPublicQrCallbackAckResponse({
            preferredLocale: input.preferredLocale,
            status: "failure",
          });
        }
      }

      await resolvePublicOauthQrFlow({
        flowId: input.flowId,
        provider: "dingtalk",
        resolution: {
          status: "matched",
          preferredLocale: input.preferredLocale,
          userId: match.user.id,
          preferredWorkspaceId: input.invitedWorkspaceId ?? null,
          profile: {
            name: profile.nick,
            phone: profile.mobile,
            avatar: profile.avatarUrl,
          },
        },
      });
      if (hasQrFlow) {
        return buildPublicQrCallbackAckResponse({
          preferredLocale: input.preferredLocale,
          status: "matched",
          mobileHref: "/mobile",
        });
      }

      const result = await finalizePublicOauthLogin(loginInput);

      if (result.ok) {
        return redirectRelative(
          input.request,
          result.redirectTo.startsWith("/") ? result.redirectTo : "/dashboard",
        );
      }

      await resolvePublicOauthQrFlow({
        flowId: input.flowId,
        provider: "dingtalk",
        resolution: {
          status: "failure",
          preferredLocale: input.preferredLocale,
        },
      });

      return buildFailureRedirect("callback-finalize-returned-not-ok");
    }

    if (match.status === "unmatched") {
      await resolvePublicOauthQrFlow({
        flowId: input.flowId,
        provider: "dingtalk",
        resolution: {
          status: "unmatched",
          preferredLocale: input.preferredLocale,
          prefill: {
            provider: "dingtalk",
            name: profile.nick?.trim() || null,
            email: profile.email?.trim().toLowerCase() || null,
            phone: profile.mobile?.trim() || null,
            organizationName: input.invitedOrganizationName ?? null,
            invitedWorkspaceId: input.invitedWorkspaceId ?? null,
            title: input.invitedTitle ?? null,
          },
        },
      });
      if (hasQrFlow) {
        return buildPublicQrCallbackAckResponse({
          preferredLocale: input.preferredLocale,
          status: "unmatched",
        });
      }

      writePublicOauthSignupPrefillCookie(cookieStore, {
        provider: "dingtalk",
        phone: profile.mobile,
        email: profile.email,
        name: profile.nick,
        organizationName: input.invitedOrganizationName ?? null,
        invitedWorkspaceId: input.invitedWorkspaceId ?? null,
        title: input.invitedTitle ?? null,
      });

      return redirectPublicUrl(
        buildPublicOauthSignupUrl(input.request, {
          provider: "dingtalk",
        }),
      );
    }

    if (match.status === "identity-conflict") {
      await resolvePublicOauthQrFlow({
        flowId: input.flowId,
        provider: "dingtalk",
        resolution: {
          status: "identity-conflict",
          preferredLocale: input.preferredLocale,
        },
      });
      if (hasQrFlow) {
        return buildPublicQrCallbackAckResponse({
          preferredLocale: input.preferredLocale,
          status: "identity-conflict",
        });
      }
      return redirectPublicUrl(
        buildPublicOauthFallbackUrl(input.request, "dingtalk", "identity-conflict"),
      );
    }

    await resolvePublicOauthQrFlow({
      flowId: input.flowId,
      provider: "dingtalk",
      resolution: {
        status: "missing-identity",
        preferredLocale: input.preferredLocale,
      },
    });
    if (hasQrFlow) {
      return buildPublicQrCallbackAckResponse({
        preferredLocale: input.preferredLocale,
        status: "missing-identity",
      });
    }
    return redirectPublicUrl(
      buildPublicOauthFallbackUrl(input.request, "dingtalk", "missing-identity"),
    );
  } catch (error) {
    console.error("[dingtalk-public-oauth] callback resolution failed", error);
    await resolvePublicOauthQrFlow({
      flowId: input.flowId,
      provider: "dingtalk",
      resolution: {
        status: "failure",
        preferredLocale: input.preferredLocale,
      },
    });
    if (hasQrFlow) {
      return buildPublicQrCallbackAckResponse({
        preferredLocale: input.preferredLocale,
        status: "failure",
      });
    }
    return buildFailureRedirect("callback-match-or-finalize-threw");
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const authCode = url.searchParams.get("authCode") ?? url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const cookieStore = await cookies();

  const rawPublicState = cookieStore.get(DINGTALK_PUBLIC_AUTH_STATE_COOKIE)?.value ?? null;
  const parsedPublicState = readPublicOauthState(rawPublicState);
  let effectivePublicState = parsedPublicState;
  if (
    state &&
    (!effectivePublicState?.state || effectivePublicState.state !== state)
  ) {
    const recoveredState = await consumePublicOauthStateByLookup({
      provider: "dingtalk",
      state,
    });
    if (recoveredState?.state === state) {
      effectivePublicState = recoveredState;
      console.warn("[dingtalk-public-oauth] recovered public state from server-side snapshot", {
        state,
      });
    }
  }
  const isPublicCallback = Boolean(
    effectivePublicState?.state &&
      state &&
      effectivePublicState.state === state,
  );

  if (isPublicCallback) {
    cookieStore.delete(DINGTALK_PUBLIC_AUTH_STATE_COOKIE);
    return handlePublicCallback({
      request,
      authCode,
      error,
      preferredLocale: effectivePublicState?.locale ?? "zh-CN",
      flowId: effectivePublicState?.flowId ?? null,
      invitedOrganizationName: effectivePublicState?.organizationName ?? null,
      invitedWorkspaceId: effectivePublicState?.workspaceId ?? null,
      invitedTitle: effectivePublicState?.title ?? null,
    });
  }

  let currentUser: Awaited<ReturnType<typeof getCurrentUser>> = null;
  try {
    currentUser = await getCurrentUser();
  } catch (error) {
    console.error("[dingtalk-oauth-callback] failed to resolve current user", {
      error,
      hasState: Boolean(state),
      hasPublicState: Boolean(rawPublicState),
      requestPath: url.pathname,
    });
  }

  const rawState = cookieStore.get(getDingTalkStateCookieName())?.value ?? null;
  const requestLocale = resolveUiLocale(cookieStore.get(UI_LOCALE_COOKIE)?.value);
  const requestEnglish = requestLocale === "en-US";
  cookieStore.delete(getDingTalkStateCookieName());

  if (rawPublicState && !rawState) {
    cookieStore.delete(DINGTALK_PUBLIC_AUTH_STATE_COOKIE);
    return redirectPublicUrl(
      buildPublicOauthFallbackUrl(request, "dingtalk", "failure"),
    );
  }

  if (!state || !rawState) {
    if (!currentUser) {
      return redirectPublicUrl(
        buildPublicOauthFallbackUrl(request, "dingtalk", "failure"),
      );
    }

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
    status: keyof typeof DINGTALK_CALLBACK_RESULT_STATUSES;
    failurePosture: keyof typeof DINGTALK_CALLBACK_FAILURE_POSTURES;
    actionType: keyof typeof DINGTALK_OAUTH_CALLBACK_AUDIT_ACTIONS;
    redirectStatus: "oauth-error" | "failure" | "unresolved" | "mismatch";
    summary: string;
    message?: string | null;
    profile?: Awaited<ReturnType<typeof fetchDingTalkUserProfile>> | null;
    corpId?: string | null;
    matchedWorkspaceUserEmail?: string | null;
  }) => {
    const callbackResult = buildDingTalkCallbackResult({
      status: DINGTALK_CALLBACK_RESULT_STATUSES[input.status],
      failurePosture: DINGTALK_CALLBACK_FAILURE_POSTURES[input.failurePosture],
      message: input.message ?? buildCallbackStatusCopy({ english, status: input.redirectStatus }),
      profile: input.profile ?? null,
      corpId: input.corpId ?? null,
      matchedWorkspaceUserEmail: input.matchedWorkspaceUserEmail ?? null,
    });
    const connector = await persistDingTalkConnectorCallbackResult({
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

    await persistDingTalkCallbackAudit({
      workspaceId: workspace.id,
      userId: workspaceUser.id,
      actor: workspaceUser.name,
      connectorId: connector.id,
      actionType: DINGTALK_OAUTH_CALLBACK_AUDIT_ACTIONS[input.actionType],
      summary: input.summary,
      callbackResult,
      provider: "DINGTALK",
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
        ? "DingTalk OAuth callback returned an OAuth error"
        : "钉钉 OAuth 回调返回了错误",
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
        ? "DingTalk OAuth callback did not return an authorization code"
        : "钉钉 OAuth 回调没有返回授权码",
      message: english
        ? "DingTalk callback did not include an authorization code."
        : "钉钉回调没有带回授权码。",
    });
  }

  try {
    const token = await exchangeDingTalkAuthCode(authCode);
    const profile = await fetchDingTalkUserProfile(token.accessToken);
    const providerEmail = normalizeEmail(profile.email);
    const matchedWorkspaceUserEmail = normalizeEmail(workspaceUser.email);

    if (!providerEmail) {
      return persistFailure({
        status: "UNRESOLVED",
        failurePosture: "REVIEW_REQUIRED",
        actionType: "UNRESOLVED",
        redirectStatus: "unresolved",
        summary: english
          ? "DingTalk OAuth callback could not resolve a provider email"
          : "钉钉 OAuth 回调无法解析服务商邮箱",
        message: english
          ? "DingTalk returned no email, so Helm could not bind the callback to the active workspace user."
          : "钉钉没有返回邮箱，Helm 无法把回调绑定到当前工作区用户。",
        profile,
        corpId: token.corpId,
      });
    }

    if (providerEmail !== matchedWorkspaceUserEmail) {
      return persistFailure({
        status: "MISMATCH",
        failurePosture: "REVIEW_REQUIRED",
        actionType: "MISMATCH",
        redirectStatus: "mismatch",
        summary: english
          ? "DingTalk OAuth callback identity mismatched the active workspace user"
          : "钉钉 OAuth 回调身份与当前工作区用户不匹配",
        message: english
          ? `DingTalk returned ${providerEmail}, but the active workspace user is ${matchedWorkspaceUserEmail}.`
          : `钉钉返回的是 ${providerEmail}，但当前工作区用户是 ${matchedWorkspaceUserEmail}。`,
        profile,
        corpId: token.corpId,
        matchedWorkspaceUserEmail,
      });
    }

    await createSession({
      userId: workspaceUser.id,
      email: workspaceUser.email,
      workspaceId: workspace.id,
      sourcePage: DINGTALK_OAUTH_CALLBACK_SOURCE_PAGE,
      providerType: AUTH_SESSION_PROVIDER_TYPES.DINGTALK_OAUTH,
    });

    const callbackResult = buildDingTalkCallbackResult({
      status: DINGTALK_CALLBACK_RESULT_STATUSES.SUCCESS,
      failurePosture: DINGTALK_CALLBACK_FAILURE_POSTURES.CLEAR,
      message: buildCallbackStatusCopy({ english, status: "connected" }),
      profile,
      corpId: token.corpId,
      matchedWorkspaceUserEmail,
    });

    const connector = await persistDingTalkConnectorCallbackResult({
      workspaceId: workspace.id,
      userId: workspaceUser.id,
      connectorStatus: ConnectorStatus.CONNECTED,
      externalAccountEmail: providerEmail,
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
        externalAccountEmail: providerEmail,
        corpId: token.corpId,
        callbackStatus: callbackResult.status,
      },
      sourcePage: DINGTALK_OAUTH_CALLBACK_SOURCE_PAGE,
    });
    await persistDingTalkCallbackAudit({
      workspaceId: workspace.id,
      userId: workspaceUser.id,
      actor: workspaceUser.name,
      connectorId: connector.id,
      actionType: DINGTALK_OAUTH_CALLBACK_AUDIT_ACTIONS.SUCCESS,
      summary: english
        ? `DingTalk OAuth callback resolved ${providerEmail} for the active workspace user`
        : `钉钉 OAuth 回调已把 ${providerEmail} 解析到当前工作区用户`,
      callbackResult,
      provider: "DINGTALK",
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
        ? `Connected DingTalk callback foundation for ${providerEmail}`
        : `已为 ${providerEmail} 建立钉钉回调基础连接`,
      payload: {
        provider: connector.provider,
        authMode: "oauth_callback_foundation",
        callbackResult,
      },
      sourcePage: DINGTALK_OAUTH_CALLBACK_SOURCE_PAGE,
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
        ? "DingTalk OAuth callback failed before the connector state could be stabilized"
        : "钉钉 OAuth 回调在连接状态稳定前失败",
      message:
        callbackError instanceof Error
          ? callbackError.message
          : english
            ? "DingTalk callback failed"
            : "钉钉回调失败",
    });
  }
}
