import { format } from "date-fns";
import { enUS } from "date-fns/locale";

type DiagnosticsDateValue = Date | string | null | undefined;

export function formatDiagnosticsDateLabel(
  value: DiagnosticsDateValue,
  english: boolean,
  formatChineseDateLabel: (value: DiagnosticsDateValue) => string,
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
