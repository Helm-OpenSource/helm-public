const DEFAULT_TIME_ZONE = "Asia/Shanghai";

declare global {
  var __midunDailyMailControlState__:
    | Map<string, string>
    | undefined;
}

function getState() {
  if (!globalThis.__midunDailyMailControlState__) {
    globalThis.__midunDailyMailControlState__ = new Map<string, string>();
  }
  return globalThis.__midunDailyMailControlState__;
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

export function shouldSendMidunDailyMail(input: {
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

export function resetMidunDailyMailControlForTests() {
  globalThis.__midunDailyMailControlState__ = new Map<string, string>();
}
