import { formatDateLabel, formatRelative } from "@/lib/utils";

export function formatSharedCardDateLabel(
  value: Date | string | null | undefined,
  english: boolean,
) {
  if (!english) {
    return formatDateLabel(value);
  }
  if (!value) {
    return "Not set";
  }

  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatSharedCardRelativeLabel(
  value: Date | string | null | undefined,
  english: boolean,
) {
  if (!english) {
    return formatRelative(value);
  }
  if (!value) {
    return "none";
  }

  const date = typeof value === "string" ? new Date(value) : value;
  const diffMs = date.getTime() - Date.now();
  const absoluteMs = Math.abs(diffMs);
  const minuteMs = 60_000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;
  const formatter = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });

  if (absoluteMs < hourMs) {
    return formatter.format(Math.round(diffMs / minuteMs), "minute");
  }
  if (absoluteMs < dayMs) {
    return formatter.format(Math.round(diffMs / hourMs), "hour");
  }
  return formatter.format(Math.round(diffMs / dayMs), "day");
}
