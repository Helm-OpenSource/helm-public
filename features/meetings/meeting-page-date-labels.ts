import { format } from "date-fns";
import { enUS } from "date-fns/locale";

type MeetingPageDateValue = Date | string | null | undefined;

export function formatMeetingPageDateLabel(
  value: MeetingPageDateValue,
  english: boolean,
  formatChineseDateLabel: (value: MeetingPageDateValue) => string,
) {
  if (!english) return formatChineseDateLabel(value);
  if (!value) return "Not set";

  const date = typeof value === "string" ? new Date(value) : value;
  return format(date, "MMM d HH:mm", { locale: enUS });
}
