/**
 * Generic Core daily-mail dedup control.
 *
 * Tracks, per arbitrary string key, whether a daily mail/notification has
 * already been sent today (in the given time zone), so callers can avoid sending
 * the same daily message twice. This is tenant-agnostic Core logic: it holds no
 * tenant-specific behavior and names no tenant — Packs/Overlays import it.
 */
const DEFAULT_TIME_ZONE = "Asia/Shanghai";

declare global {
  var __dailyMailControlState__: Map<string, string> | undefined;
}

function getState() {
  if (!globalThis.__dailyMailControlState__) {
    globalThis.__dailyMailControlState__ = new Map<string, string>();
  }
  return globalThis.__dailyMailControlState__;
}

function formatDayKey(now = new Date(), timeZone = DEFAULT_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const year = parts.find((item) => item.type === "year")?.value ?? "1970";
  const month = parts.find((item) => item.type === "month")?.value ?? "01";
  const day = parts.find((item) => item.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

/**
 * Returns true the first time it sees `key` for the current day (and records it),
 * false on subsequent calls the same day — i.e. "should this daily mail be sent
 * once today?". Tenant-agnostic; the caller supplies the key.
 */
export function shouldSendDailyMailOnce(input: {
  key: string;
  now?: Date;
  timeZone?: string;
}) {
  const state = getState();
  const dayKey = formatDayKey(input.now, input.timeZone);
  if (state.get(input.key) === dayKey) {
    return false;
  }
  state.set(input.key, dayKey);
  return true;
}

export function resetDailyMailControlForTests() {
  globalThis.__dailyMailControlState__ = new Map<string, string>();
}
