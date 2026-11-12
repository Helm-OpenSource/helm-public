/**
 * Billing V1 S2-d3 top-up page helpers (pure; no server-only import so the page and its tests share them). Contract S2D §10.3 /
 * §10.7, with the owner's 2026-11-12 ruling: a client opens a top-up URL only when it is https, on port 443 and on the login origin
 * or an exact allow-listed host; the path is NOT checked.
 */
export const TOPUP_PAGE_PATH = "/billing/topup";
// Same bounds as createTopupOrder (topup-orders.ts): 1 yuan – 50 000 yuan per order.
export const TOPUP_PAGE_MIN_FEN = 100;
export const TOPUP_PAGE_MAX_FEN = 5_000_000;
export const TOPUP_PRESET_FEN = [10_000, 50_000, 100_000, 500_000] as const;

/** `suggestedFen` is only a prefill: an integer string, clamped into the per-order bounds; anything else is ignored. */
export function parseSuggestedFen(raw: unknown) {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string" || !/^[0-9]{1,12}$/.test(value)) return null;
  const fen = Number(value);
  return fen <= 0 ? null : Math.min(Math.max(fen, TOPUP_PAGE_MIN_FEN), TOPUP_PAGE_MAX_FEN);
}

/** The URL a server hands to clients (balance or insufficient-balance answers): APP_URL origin + fixed path, optional prefill only. */
export function buildTopUpUrl(appOrigin: string, suggestedFen?: number | null) {
  const url = new URL(TOPUP_PAGE_PATH, appOrigin);
  const fen = suggestedFen === undefined || suggestedFen === null ? null : parseSuggestedFen(String(suggestedFen));
  if (fen !== null) url.searchParams.set("suggestedFen", String(fen));
  return url.toString();
}

/** Reference for the client-side check (§10.3 as ruled 2026-11-12): https, port 443, same host or exact allow-list, no credentials. */
export function isOpenableTopUpUrl(raw: string, loginOrigin: string, allowedHosts: readonly string[] = []) {
  if (!URL.canParse(raw)) return false;
  const url = new URL(raw);
  const host = url.hostname;
  return url.protocol === "https:" && url.port === "" && !url.username && !url.password &&
    !/^[0-9.]+$/.test(host) && !host.startsWith("[") && (url.host === new URL(loginOrigin).host || allowedHosts.includes(url.host));
}

/** Exact yuan text (at most two decimals) to integer fen, never through floating point; null when not a valid amount. */
export function yuanTextToFen(text: string) {
  const match = /^(0|[1-9][0-9]{0,8})(?:\.([0-9]{1,2}))?$/.exec(text.trim());
  if (!match) return null;
  return Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
}
export const fenToYuanText = (fen: number) => `${Math.trunc(fen / 100)}.${String(fen % 100).padStart(2, "0")}`;
