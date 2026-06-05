import { format, isToday, isTomorrow, isYesterday } from "date-fns";
import { enUS } from "date-fns/locale";
import { formatDateLabel } from "@/lib/utils";

type ReinforcementSendabilityDateValue = Date | string | null | undefined;

export function formatReinforcementSendabilityDateLabel(
  value: ReinforcementSendabilityDateValue,
  english: boolean,
) {
  if (!english) return formatDateLabel(value);
  if (!value) return "Not set";

  const date = typeof value === "string" ? new Date(value) : value;

  if (isToday(date)) return `Today ${format(date, "HH:mm", { locale: enUS })}`;
  if (isTomorrow(date)) {
    return `Tomorrow ${format(date, "HH:mm", { locale: enUS })}`;
  }
  if (isYesterday(date)) {
    return `Yesterday ${format(date, "HH:mm", { locale: enUS })}`;
  }

  return format(date, "MMM d HH:mm", { locale: enUS });
}
