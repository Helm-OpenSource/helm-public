import { format, formatDistanceStrict } from "date-fns";
import { enUS } from "date-fns/locale";

type CaptureDateValue = Date | string | null | undefined;

export function formatCaptureResultDateLabel(
  value: CaptureDateValue,
  english: boolean,
  formatChineseDateLabel: (value: CaptureDateValue) => string,
) {
  if (!english) return formatChineseDateLabel(value);
  if (!value) return "Not set";

  const date = typeof value === "string" ? new Date(value) : value;
  return format(date, "MMM d HH:mm", { locale: enUS });
}

export function formatCaptureResultRelativeLabel(
  value: CaptureDateValue,
  english: boolean,
  formatChineseRelativeLabel: (value: CaptureDateValue) => string,
  baseDate = new Date(),
) {
  if (!english) return formatChineseRelativeLabel(value);
  if (!value) return "Not available";

  const date = typeof value === "string" ? new Date(value) : value;
  return formatDistanceStrict(date, baseDate, {
    addSuffix: true,
    locale: enUS,
  });
}
