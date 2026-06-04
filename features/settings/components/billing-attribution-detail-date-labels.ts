import { format } from "date-fns";
import { enUS } from "date-fns/locale";

type AttributionDetailDateValue = Date | string | null | undefined;

export function formatAttributionDetailDateLabel(
  value: AttributionDetailDateValue,
  english: boolean,
  formatChineseDateLabel: (value: AttributionDetailDateValue) => string,
) {
  if (!english) {
    return formatChineseDateLabel(value);
  }

  if (!value) {
    return "Not set";
  }

  const date = value instanceof Date ? value : new Date(value);
  return format(date, "MMM d HH:mm", { locale: enUS });
}
