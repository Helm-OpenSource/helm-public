import { format } from "date-fns";
import { enUS } from "date-fns/locale";

type AnalyticsDateValue = Date | string | null | undefined;

export function formatAnalyticsDateLabel(
  value: AnalyticsDateValue,
  english: boolean,
  formatChineseDateLabel: (value: AnalyticsDateValue) => string,
) {
  if (!english) return formatChineseDateLabel(value);
  if (!value) return "Not set";

  const date = typeof value === "string" ? new Date(value) : value;
  return format(date, "MMM d HH:mm", { locale: enUS });
}
