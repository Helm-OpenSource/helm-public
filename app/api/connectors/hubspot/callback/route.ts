import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ActorType } from "@prisma/client";
import { logEvent } from "@/lib/analytics";
import { writeAuditLog } from "@/lib/audit";
import { resolveWorkspaceOauthCallbackContext } from "@/lib/auth/oauth-callback-governance";
import { getCurrentUser } from "@/lib/auth/session";
import { exchangeHubSpotCode, HUBSPOT_STATE_COOKIE, upsertHubSpotSourceFromOauth } from "@/lib/connectors/hubspot";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const cookieStore = await cookies();
  const rawState = cookieStore.get(HUBSPOT_STATE_COOKIE)?.value;
  cookieStore.delete(HUBSPOT_STATE_COOKIE);

  if (error) {
    return NextResponse.redirect(new URL(`/imports/crm?provider=hubspot&status=oauth-error&message=${encodeURIComponent(error)}`, request.url));
  }

  if (!code || !state || !rawState) {
    return NextResponse.redirect(new URL("/imports/crm?provider=hubspot&status=missing-state", request.url));
  }

  const callbackContext = await resolveWorkspaceOauthCallbackContext({
    rawState,
    stateParam: state,
    currentUser: await getCurrentUser(),
    capability: "imports",
    english: true,
  });

  if (!callbackContext.ok) {
    if (callbackContext.status === "forbidden") {
      return NextResponse.redirect(
        new URL(
          `/imports/crm?provider=hubspot&status=forbidden&message=${encodeURIComponent(
            callbackContext.message ?? "forbidden",
          )}`,
          request.url,
        ),
      );
    }

    return NextResponse.redirect(
      new URL(
        `/imports/crm?provider=hubspot&status=${
          callbackContext.status === "missing-state" ? "missing-state" : "invalid-state"
        }`,
        request.url,
      ),
    );
  }

  const { workspaceId, userId, user } = callbackContext;

  try {
    const token = await exchangeHubSpotCode(code);
    const source = await upsertHubSpotSourceFromOauth({
      workspaceId,
      userId,
      token,
    });

    await logEvent({
      workspaceId,
      userId,
      eventName: "connector_connected",
      eventCategory: "connector",
      targetType: "ImportSource",
      targetId: source.id,
      metadata: {
        provider: source.sourceType,
        externalAccountLabel: source.externalAccountLabel,
      },
      sourcePage: "/imports/crm",
    });
    await writeAuditLog({
      workspaceId,
      userId,
      actor: user.name,
      actorType: ActorType.USER,
      actionType: "IMPORT_SOURCE_CONNECTED",
      targetType: "ImportSource",
      targetId: source.id,
      summary: `Connected ${source.sourceType} import source ${source.externalAccountLabel ?? source.sourceName}`,
      payload: {
        sourceType: source.sourceType,
        authMode: source.authMode,
        externalAccountLabel: source.externalAccountLabel,
      },
      sourcePage: "/imports/crm",
    });

    return NextResponse.redirect(new URL(`/imports/crm?provider=hubspot&status=connected&sourceId=${source.id}`, request.url));
  } catch (callbackError) {
    const message = callbackError instanceof Error ? callbackError.message : "HubSpot connection failed";
    return NextResponse.redirect(
      new URL(
        `/imports/crm?provider=hubspot&status=error&message=${encodeURIComponent(message)}`,
        request.url,
      ),
    );
  }
}
