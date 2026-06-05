import { format } from "date-fns";
import { enUS } from "date-fns/locale";

type CapturePageDateValue = Date | string | null | undefined;

export function formatCapturePageDateLabel(
  value: CapturePageDateValue,
  english: boolean,
  formatChineseDateLabel: (value: CapturePageDateValue) => string,
) {
  if (!english) return formatChineseDateLabel(value);
  if (!value) return "Not set";

  const date = typeof value === "string" ? new Date(value) : value;
  return format(date, "MMM d HH:mm", { locale: enUS });
}
