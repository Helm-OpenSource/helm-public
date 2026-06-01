import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  canManageWorkspaceConnectors,
  getConnectorManagementDeniedMessage,
} from "@/lib/auth/import-governance";
import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import { buildGoogleAuthUrl, getGoogleStateCookieName, isGoogleOauthConfigured } from "@/lib/connectors/google";
import { isEnglishWorkspaceDefaultLocale } from "@/lib/i18n/api-message-locale";

export async function GET(request: Request) {
  const session = await getCurrentWorkspaceSession().catch(() => null);
  const user = session?.user;
  const workspace = session?.workspace;

  if (!user || !workspace) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (!canManageWorkspaceConnectors(session.membership.role)) {
    const english = isEnglishWorkspaceDefaultLocale(workspace.defaultLocale);

    return NextResponse.redirect(
      new URL(
        `/settings?tab=connectors&connector=gmail&status=forbidden&message=${encodeURIComponent(
          getConnectorManagementDeniedMessage(english),
        )}`,
        request.url,
      ),
    );
  }

  if (!isGoogleOauthConfigured()) {
    return NextResponse.redirect(new URL("/settings?tab=connectors&connector=gmail&status=missing-config", request.url));
  }

  const state = randomUUID();
  const cookieStore = await cookies();
  cookieStore.set(
    getGoogleStateCookieName(),
    JSON.stringify({
      state,
      userId: user.id,
      workspaceId: workspace.id,
      provider: "gmail",
    }),
    {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 10,
    },
  );

  return NextResponse.redirect(buildGoogleAuthUrl(state));
}
