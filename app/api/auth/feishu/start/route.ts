import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  canManageWorkspaceConnectors,
  getConnectorManagementDeniedMessage,
} from "@/lib/auth/import-governance";
import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import {
  buildFeishuAuthUrl,
  getFeishuStateCookieName,
  isFeishuOauthConfigured,
} from "@/lib/connectors/feishu";
import { isEnglishWorkspaceDefaultLocale } from "@/lib/i18n/api-message-locale";

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

  if (!isFeishuOauthConfigured()) {
    return buildSettingsRedirect(request, {
      status: "missing-config",
      message: english ? "Feishu OAuth is not configured yet." : "飞书 OAuth 尚未完成配置。",
    });
  }

  const state = randomUUID();
  const cookieStore = await cookies();
  cookieStore.set(
    getFeishuStateCookieName(),
    JSON.stringify({
      state,
      userId: user.id,
      workspaceId: workspace.id,
      provider: "feishu",
    }),
    {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 10,
    },
  );

  return NextResponse.redirect(buildFeishuAuthUrl(state));
}
