import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ActorType } from "@prisma/client";
import { logEvent } from "@/lib/analytics";
import { writeAuditLog } from "@/lib/audit";
import { resolveWorkspaceOauthCallbackContext } from "@/lib/auth/oauth-callback-governance";
import { getCurrentUser } from "@/lib/auth/session";
import {
  exchangeGoogleCode,
  fetchGoogleAccountEmail,
  getGoogleStateCookieName,
  syncGmailConnector,
  upsertGmailConnectorFromOauth,
} from "@/lib/connectors/google";
import { resolveUiLocale, UI_LOCALE_COOKIE } from "@/lib/i18n/config";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const cookieStore = await cookies();
  const rawState = cookieStore.get(getGoogleStateCookieName())?.value;
  const requestLocale = resolveUiLocale(cookieStore.get(UI_LOCALE_COOKIE)?.value);
  const requestEnglish = requestLocale === "en-US";
  cookieStore.delete(getGoogleStateCookieName());

  if (error) {
    return NextResponse.redirect(new URL(`/settings?tab=connectors&connector=gmail&status=oauth-error&message=${encodeURIComponent(error)}`, request.url));
  }

  if (!code || !state || !rawState) {
    return NextResponse.redirect(new URL("/settings?tab=connectors&connector=gmail&status=missing-state", request.url));
  }

  const callbackContext = await resolveWorkspaceOauthCallbackContext({
    rawState,
    stateParam: state,
    currentUser: await getCurrentUser(),
    capability: "connectors",
    english: requestEnglish,
  });

  if (!callbackContext.ok) {
    if (callbackContext.status === "forbidden") {
      return NextResponse.redirect(
        new URL(
          `/settings?tab=connectors&connector=gmail&status=forbidden&message=${encodeURIComponent(
            callbackContext.message ?? "forbidden",
          )}`,
          request.url,
        ),
      );
    }

    if (callbackContext.status === "missing-state") {
      return NextResponse.redirect(
        new URL("/settings?tab=connectors&connector=gmail&status=missing-state", request.url),
      );
    }

    if (callbackContext.status === "invalid-state") {
      return NextResponse.redirect(new URL("/settings?tab=connectors&connector=gmail&status=invalid-state", request.url));
    }

    return NextResponse.redirect(new URL("/settings?tab=connectors&connector=gmail&status=invalid-state", request.url));
  }
  const { workspaceId, userId, user } = callbackContext;

  try {
    const token = await exchangeGoogleCode(code);
    const externalAccountEmail = await fetchGoogleAccountEmail(token.access_token);

    if (!externalAccountEmail) {
      throw new Error("Could not resolve the Google account email");
    }

    const connector = await upsertGmailConnectorFromOauth({
      workspaceId,
      userId,
      externalAccountEmail,
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresIn: token.expires_in,
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
        externalAccountEmail,
      },
      sourcePage: "/settings",
    });
    await writeAuditLog({
      workspaceId: connector.workspaceId,
      userId: connector.userId,
      actor: user.name,
      actorType: ActorType.USER,
      actionType: "CONNECTOR_CONNECTED",
      targetType: "Connector",
      targetId: connector.id,
      summary: `Connected Gmail connector for ${externalAccountEmail}`,
      payload: {
        provider: connector.provider,
        externalAccountEmail,
        authMode: "oauth",
      },
      sourcePage: "/settings",
    });

    const result = await syncGmailConnector(connector.id);
    await writeAuditLog({
      workspaceId: connector.workspaceId,
      userId: connector.userId,
      actor: user.name,
      actorType: ActorType.USER,
      actionType: "CONNECTOR_SYNC_COMPLETED",
      targetType: "Connector",
      targetId: connector.id,
      summary: `Completed Gmail connector sync for ${externalAccountEmail}`,
      payload: {
        provider: connector.provider,
        usedMock: result.usedMock,
        syncedThreads: result.syncedThreads,
        syncedMessages: result.syncedMessages,
      },
      sourcePage: "/settings",
    });

    return NextResponse.redirect(new URL("/settings?tab=connectors&connector=gmail&status=connected", request.url));
  } catch (callbackError) {
    const message = callbackError instanceof Error ? callbackError.message : "Gmail connection failed";
    return NextResponse.redirect(new URL(`/settings?tab=connectors&connector=gmail&status=error&message=${encodeURIComponent(message)}`, request.url));
  }
}
