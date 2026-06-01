import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  canManageWorkspaceConnectors,
  getConnectorManagementDeniedMessage,
} from "@/lib/auth/import-governance";
import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import {
  buildWeComAuthUrl,
  getWeComStateCookieName,
  isWeComOauthConfigured,
} from "@/lib/connectors/wecom";
import { isEnglishWorkspaceDefaultLocale } from "@/lib/i18n/api-message-locale";

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

export async function GET(request: Request) {
  const session = await getCurrentWorkspaceSession().catch(() => null);
  const user = session?.user;
  const workspace = session?.workspace;

  if (!user || !workspace) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const english = isEnglishWorkspaceDefaultLocale(workspace.defaultLocale);

  if (!canManageWorkspaceConnectors(session.membership.role)) {
    return buildSettingsRedirect(request, {
      status: "forbidden",
      message: getConnectorManagementDeniedMessage(english),
    });
  }

  if (!isWeComOauthConfigured()) {
    return buildSettingsRedirect(request, {
      status: "missing-config",
      message: english ? "WeCom OAuth is not configured yet." : "企业微信 OAuth 尚未完成配置。",
    });
  }

  const state = randomUUID();
  const cookieStore = await cookies();
  cookieStore.set(
    getWeComStateCookieName(),
    JSON.stringify({
      state,
      userId: user.id,
      workspaceId: workspace.id,
      provider: "wecom",
    }),
    {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 10,
    },
  );

  return NextResponse.redirect(buildWeComAuthUrl(state));
}
