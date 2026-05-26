import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { buildPublicAuthStartUrl, buildPublicOauthFallbackUrl } from "@/lib/auth/public-oauth";
import {
  createPublicOauthQrFlow,
  getPublicOauthQrFlowOwnerCookieName,
  readPublicOauthQrFlowStatus,
} from "@/lib/auth/public-oauth-qr-flow";
import { getDingTalkConfig, isDingTalkOauthConfigured } from "@/lib/connectors/dingtalk";

const QR_FLOW_TTL_SECONDS = 60 * 10;

function jsonNoStore(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function buildQrCompleteUrl(flowId: string, token: string) {
  const params = new URLSearchParams({
    flowId,
    token,
  });
  return `/api/public-auth/dingtalk/qr-complete?${params.toString()}`;
}

function appendPublicOauthContextParams(target: URL, source: URL) {
  for (const key of ["org", "ws", "title"] as const) {
    const value = source.searchParams.get(key);
    if (value?.trim()) {
      target.searchParams.set(key, value);
    }
  }
}

function resolveDingTalkPublicStartOrigin(request: Request) {
  const config = getDingTalkConfig();
  const redirectUri = config.redirectUri?.trim() || null;

  if (redirectUri) {
    try {
      const redirectUrl = new URL(redirectUri);
      if (!redirectUrl.hostname.includes("localhost") && !redirectUrl.hostname.startsWith("127.")) {
        return redirectUrl.origin;
      }
    } catch {
      // fall back to request origin
    }
  }

  return new URL(request.url).origin;
}

export async function GET(request: Request) {
  if (!isDingTalkOauthConfigured()) {
    return jsonNoStore(
      {
        ok: false,
        status: "missing-config",
        redirectTo: buildPublicOauthFallbackUrl(request, "dingtalk").toString(),
      },
      503,
    );
  }

  const url = new URL(request.url);
  const flowId = url.searchParams.get("flowId");
  const cookieStore = await cookies();

  if (flowId) {
    const ownerKey = cookieStore.get(getPublicOauthQrFlowOwnerCookieName(flowId))?.value ?? null;
    const status = await readPublicOauthQrFlowStatus({
      flowId,
      ownerKey,
    });

    if (status.status === "pending") {
      return jsonNoStore({
        ok: true,
        status: "pending",
      });
    }

    if (
      status.status === "matched" ||
      status.status === "unmatched" ||
      status.status === "oauth-error" ||
      status.status === "failure" ||
      status.status === "identity-conflict" ||
      status.status === "missing-identity"
    ) {
      return jsonNoStore({
        ok: true,
        status: status.status,
        completeUrl: buildQrCompleteUrl(flowId, status.completionToken),
        expiresAt: status.expiresAt,
      });
    }

    if (status.status === "expired") {
      return jsonNoStore(
        {
          ok: false,
          status: "expired",
        },
        410,
      );
    }

    if (status.status === "invalid-owner") {
      return jsonNoStore(
        {
          ok: false,
          status: "invalid-owner",
        },
        403,
      );
    }

    return jsonNoStore(
      {
        ok: false,
        status: "not-found",
      },
      404,
    );
  }

  const created = await createPublicOauthQrFlow({
    provider: "dingtalk",
  });
  const publicStartOrigin = resolveDingTalkPublicStartOrigin(request);
  const startUrl = new URL(buildPublicAuthStartUrl(publicStartOrigin, "dingtalk"));
  startUrl.searchParams.set("flowId", created.flowId);
  appendPublicOauthContextParams(startUrl, url);

  cookieStore.set(
    getPublicOauthQrFlowOwnerCookieName(created.flowId),
    created.ownerKey,
    {
      httpOnly: true,
      sameSite: "lax",
      path: "/api/public-auth/dingtalk",
      maxAge: QR_FLOW_TTL_SECONDS,
    },
  );

  return jsonNoStore({
    ok: true,
    status: "created",
    flowId: created.flowId,
    expiresAt: created.expiresAt,
    qrUrl: startUrl.toString(),
  });
}
