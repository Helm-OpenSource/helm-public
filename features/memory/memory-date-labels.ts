import { format } from "date-fns";
import { enUS } from "date-fns/locale";

type MemoryDateValue = Date | string | null | undefined;

export function formatMemoryDateLabel(
  value: MemoryDateValue,
  english: boolean,
  formatChineseDateLabel: (value: MemoryDateValue) => string,
) {
  if (!english) {
    return formatChineseDateLabel(value);
  }

  if (!value) {
    return "Not set";
  }

  const date = typeof value === "string" ? new Date(value) : value;
  return format(date, "MMM d HH:mm", { locale: enUS });
}
