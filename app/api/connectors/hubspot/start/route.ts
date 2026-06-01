import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  canManageWorkspaceImports,
  getImportManagementDeniedMessage,
} from "@/lib/auth/import-governance";
import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import { buildHubSpotAuthUrl, HUBSPOT_STATE_COOKIE, isHubSpotConfigured } from "@/lib/connectors/hubspot";
import { isEnglishWorkspaceDefaultLocale } from "@/lib/i18n/api-message-locale";

export async function GET(request: Request) {
  const session = await getCurrentWorkspaceSession().catch(() => null);
  const user = session?.user;
  const workspace = session?.workspace;

  if (!user || !workspace) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (!canManageWorkspaceImports(session.membership.role)) {
    const english = isEnglishWorkspaceDefaultLocale(workspace.defaultLocale);

    return NextResponse.redirect(
      new URL(
        `/imports/crm?provider=hubspot&status=forbidden&message=${encodeURIComponent(
          getImportManagementDeniedMessage(english),
        )}`,
        request.url,
      ),
    );
  }

  if (!isHubSpotConfigured()) {
    return NextResponse.redirect(new URL("/imports/crm?provider=hubspot&status=missing-config", request.url));
  }

  const state = randomUUID();
  const cookieStore = await cookies();
  cookieStore.set(
    HUBSPOT_STATE_COOKIE,
    JSON.stringify({
      state,
      userId: user.id,
      workspaceId: workspace.id,
      provider: "hubspot",
    }),
    {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 10,
    },
  );

  return NextResponse.redirect(buildHubSpotAuthUrl(state));
}
