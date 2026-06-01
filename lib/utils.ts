import { type ClassValue, clsx } from "clsx";
import { format, formatDistanceToNowStrict, isToday, isTomorrow, isYesterday } from "date-fns";
import { zhCN } from "date-fns/locale";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDateTime(value?: Date | string | null, pattern = "MM月dd日 HH:mm") {
  if (!value) return "未设置";
  const date = typeof value === "string" ? new Date(value) : value;
  return format(date, pattern, { locale: zhCN });
}

export function formatDateLabel(value?: Date | string | null) {
  if (!value) return "未设置";
  const date = typeof value === "string" ? new Date(value) : value;

  if (isToday(date)) return `今天 ${format(date, "HH:mm", { locale: zhCN })}`;
  if (isTomorrow(date)) return `明天 ${format(date, "HH:mm", { locale: zhCN })}`;
  if (isYesterday(date)) return `昨天 ${format(date, "HH:mm", { locale: zhCN })}`;

  return format(date, "MM月dd日 HH:mm", { locale: zhCN });
}

export function formatRelative(value?: Date | string | null) {
  if (!value) return "暂无";
  const date = typeof value === "string" ? new Date(value) : value;
  return formatDistanceToNowStrict(date, {
    addSuffix: true,
    locale: zhCN,
  });
}

export function formatShortDate(value?: Date | string | null) {
  if (!value) return "未设置";
  const date = typeof value === "string" ? new Date(value) : value;
  return format(date, "MM月dd日", { locale: zhCN });
}

export function safeParseJson<T>(value?: string | null, fallback: T = [] as T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function jsonStringify(value: unknown) {
  return JSON.stringify(value, null, 2);
}

export function compactText(value?: string | null) {
  return value?.trim() || "暂无内容";
}

export function trimText(value?: string | null, max = 72) {
  if (!value) return "暂无内容";
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

export function toDateTimeLocalInput(value?: Date | string | null) {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

export function isOverdue(value?: Date | string | null) {
  if (!value) return false;
  const date = typeof value === "string" ? new Date(value) : value;
  return date.getTime() < Date.now();
}

export function formatProgress(current: number, total: number) {
  if (!total) return 0;
  return Math.max(0, Math.min(100, Math.round((current / total) * 100)));
}

export function initials(name?: string | null) {
  if (!name) return "H";
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
