import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { PublicOauthSignupPrefill, PublicOauthProvider } from "@/lib/auth/public-oauth";
import type { UiLocale } from "@/lib/i18n/config";

const PUBLIC_OAUTH_QR_FLOW_TTL_MS = 10 * 60 * 1000;
const PUBLIC_OAUTH_QR_FLOW_OWNER_COOKIE_PREFIX = "helm-public-oauth-qr-owner-";
const PUBLIC_OAUTH_QR_FLOW_DIR = path.join(tmpdir(), "helm-public-oauth-qr-flows");
const FLOW_ID_PATTERN = /^[a-zA-Z0-9-]+$/;

type PublicOauthQrFallbackStatus =
  | "oauth-error"
  | "failure"
  | "identity-conflict"
  | "missing-identity";

export type PublicOauthQrResolution =
  | {
      status: "matched";
      preferredLocale: UiLocale;
      userId: string;
      preferredWorkspaceId?: string | null;
      profile: {
        name: string | null;
        phone: string | null;
        avatar: string | null;
      };
    }
  | {
      status: "unmatched";
      preferredLocale: UiLocale;
      prefill: PublicOauthSignupPrefill;
    }
  | {
      status: PublicOauthQrFallbackStatus;
      preferredLocale: UiLocale;
    };

type PublicOauthQrFlow = {
  flowId: string;
  ownerKey: string;
  provider: PublicOauthProvider;
  createdAtMs: number;
  expiresAtMs: number;
  completionToken: string | null;
  resolution: PublicOauthQrResolution | null;
};

function normalizeFlowId(flowId: string | null | undefined) {
  const trimmed = flowId?.trim();
  if (!trimmed || !FLOW_ID_PATTERN.test(trimmed)) {
    return null;
  }
  return trimmed;
}

function normalizeOwnerKey(ownerKey: string | null | undefined) {
  const trimmed = ownerKey?.trim();
  return trimmed ? trimmed : null;
}

function getFlowFilePath(flowId: string) {
  return path.join(PUBLIC_OAUTH_QR_FLOW_DIR, `${flowId}.json`);
}

async function ensureFlowDir() {
  await fs.mkdir(PUBLIC_OAUTH_QR_FLOW_DIR, { recursive: true });
}

async function writeFlow(flow: PublicOauthQrFlow) {
  await ensureFlowDir();
  const filePath = getFlowFilePath(flow.flowId);
  const tempPath = `${filePath}.${randomUUID()}.tmp`;
  const payload = JSON.stringify(flow);
  await fs.writeFile(tempPath, payload, "utf8");
  await fs.rename(tempPath, filePath);
}

async function readFlow(flowId: string) {
  try {
    const content = await fs.readFile(getFlowFilePath(flowId), "utf8");
    const parsed = JSON.parse(content) as PublicOauthQrFlow;
    if (!parsed.flowId || parsed.flowId !== flowId) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function deleteFlow(flowId: string) {
  try {
    await fs.unlink(getFlowFilePath(flowId));
  } catch {
    // ignore
  }
}

function isFlowActive(flow: PublicOauthQrFlow, nowMs: number) {
  return flow.expiresAtMs > nowMs;
}

export function getPublicOauthQrFlowOwnerCookieName(flowId: string) {
  return `${PUBLIC_OAUTH_QR_FLOW_OWNER_COOKIE_PREFIX}${flowId}`;
}

export async function createPublicOauthQrFlow(input: {
  provider: PublicOauthProvider;
  now?: Date;
}) {
  const nowMs = (input.now ?? new Date()).getTime();
  const flowId = randomUUID();
  const ownerKey = randomUUID();
  const flow = {
    flowId,
    ownerKey,
    provider: input.provider,
    createdAtMs: nowMs,
    expiresAtMs: nowMs + PUBLIC_OAUTH_QR_FLOW_TTL_MS,
    completionToken: null,
    resolution: null,
  } satisfies PublicOauthQrFlow;

  await writeFlow(flow);

  return {
    flowId,
    ownerKey,
    expiresAt: new Date(flow.expiresAtMs).toISOString(),
  };
}

export async function resolvePublicOauthQrFlow(input: {
  flowId: string | null | undefined;
  provider: PublicOauthProvider;
  resolution: PublicOauthQrResolution;
  now?: Date;
}) {
  const flowId = normalizeFlowId(input.flowId);
  if (!flowId) {
    return false;
  }

  const nowMs = (input.now ?? new Date()).getTime();
  const flow = await readFlow(flowId);

  if (!flow || !isFlowActive(flow, nowMs) || flow.provider !== input.provider) {
    if (flow && !isFlowActive(flow, nowMs)) {
      await deleteFlow(flowId);
    }
    return false;
  }

  if (flow.resolution) {
    return true;
  }

  flow.resolution = input.resolution;
  flow.completionToken = randomUUID();
  await writeFlow(flow);
  return true;
}

export async function readPublicOauthQrFlowStatus(input: {
  flowId: string | null | undefined;
  ownerKey: string | null | undefined;
  now?: Date;
}) {
  const flowId = normalizeFlowId(input.flowId);
  const ownerKey = normalizeOwnerKey(input.ownerKey);

  if (!flowId || !ownerKey) {
    return { status: "invalid-owner" as const };
  }

  const nowMs = (input.now ?? new Date()).getTime();
  const flow = await readFlow(flowId);

  if (!flow) {
    return { status: "not-found" as const };
  }

  if (flow.ownerKey !== ownerKey) {
    return { status: "invalid-owner" as const };
  }

  if (!isFlowActive(flow, nowMs)) {
    await deleteFlow(flowId);
    return { status: "expired" as const };
  }

  if (!flow.resolution || !flow.completionToken) {
    return { status: "pending" as const };
  }

  return {
    status: flow.resolution.status,
    completionToken: flow.completionToken,
    expiresAt: new Date(flow.expiresAtMs).toISOString(),
  } as const;
}

export async function consumePublicOauthQrFlow(input: {
  flowId: string | null | undefined;
  ownerKey: string | null | undefined;
  completionToken: string | null | undefined;
  now?: Date;
}) {
  const flowId = normalizeFlowId(input.flowId);
  const ownerKey = normalizeOwnerKey(input.ownerKey);
  const completionToken = normalizeOwnerKey(input.completionToken);

  if (!flowId) {
    return {
      ok: false as const,
      reason: "invalid-flow-id" as const,
    };
  }

  if (!ownerKey) {
    return {
      ok: false as const,
      reason: "missing-owner-key" as const,
    };
  }

  if (!completionToken) {
    return {
      ok: false as const,
      reason: "missing-token" as const,
    };
  }

  const nowMs = (input.now ?? new Date()).getTime();
  const flow = await readFlow(flowId);

  if (!flow || flow.ownerKey !== ownerKey || !isFlowActive(flow, nowMs)) {
    if (flow && !isFlowActive(flow, nowMs)) {
      await deleteFlow(flowId);
    }
    return {
      ok: false as const,
      reason: !flow
        ? ("not-found" as const)
        : flow.ownerKey !== ownerKey
          ? ("owner-mismatch" as const)
          : ("expired" as const),
    };
  }

  if (!flow.resolution || !flow.completionToken) {
    return {
      ok: false as const,
      reason: "not-resolved" as const,
    };
  }

  if (flow.completionToken !== completionToken) {
    return {
      ok: false as const,
      reason: "token-mismatch" as const,
    };
  }

  await deleteFlow(flowId);
  return {
    ok: true as const,
    resolution: flow.resolution,
  };
}
