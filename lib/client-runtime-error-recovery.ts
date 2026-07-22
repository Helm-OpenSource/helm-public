const CHUNK_RELOAD_CLAIM_KEY = "helm.client.chunk-reload-at";
const CLIENT_RUNTIME_ROUTE_FAMILIES = new Set([
  "auth",
  "dashboard",
  "diagnostics",
  "login",
  "reports",
  "settings",
  "workspace",
]);

export const CHUNK_RELOAD_BACKOFF_MS = 5 * 60 * 1000;
export const CLIENT_RUNTIME_ERROR_CODES = ["chunk_load_error", "client_runtime_error"] as const;

export type ClientRuntimeErrorCode = (typeof CLIENT_RUNTIME_ERROR_CODES)[number];

export type ClientRuntimeErrorTelemetry = {
  code: ClientRuntimeErrorCode;
  digest: string | null;
  routeFamily: string;
};

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export function isRecoverableChunkLoadError(error: Pick<Error, "message" | "name">) {
  if (error.name === "ChunkLoadError") {
    return true;
  }

  return /(?:failed to load|loading) chunk\b/i.test(error.message);
}

export function classifyClientRuntimeError(
  error: Pick<Error, "message" | "name">,
): ClientRuntimeErrorCode {
  return isRecoverableChunkLoadError(error) ? "chunk_load_error" : "client_runtime_error";
}

export function toClientRuntimeRouteFamily(pathname: string) {
  const family = pathname.split("/").filter(Boolean)[0]?.toLowerCase() ?? "root";
  return CLIENT_RUNTIME_ROUTE_FAMILIES.has(family) ? family : "other";
}

export function normalizeClientRuntimeErrorTelemetry(body: unknown): ClientRuntimeErrorTelemetry {
  if (!body || typeof body !== "object") {
    return {
      code: "client_runtime_error",
      digest: null,
      routeFamily: "other",
    };
  }

  const candidate = body as Record<string, unknown>;
  const code = trimText(candidate.code, 120);
  const routeFamily = trimText(candidate.routeFamily, 120);
  const digest = trimText(candidate.digest, 120);
  return {
    code: CLIENT_RUNTIME_ERROR_CODES.includes(code as ClientRuntimeErrorCode)
      ? (code as ClientRuntimeErrorCode)
      : "client_runtime_error",
    digest: digest && /^[A-Za-z0-9_-]{1,120}$/.test(digest) ? digest : null,
    routeFamily: toClientRuntimeRouteFamily(`/${routeFamily ?? "other"}`),
  };
}

export function claimStaleChunkReload(storage: StorageLike, nowMs = Date.now()) {
  try {
    const previousRaw = storage.getItem(CHUNK_RELOAD_CLAIM_KEY);
    const previousAt = previousRaw === null ? Number.NaN : Number(previousRaw);

    if (Number.isFinite(previousAt) && nowMs - previousAt < CHUNK_RELOAD_BACKOFF_MS) {
      return false;
    }

    storage.setItem(CHUNK_RELOAD_CLAIM_KEY, String(nowMs));
    return true;
  } catch {
    return false;
  }
}

function trimText(value: unknown, max: number) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized || normalized.length > max) return null;
  return normalized;
}
