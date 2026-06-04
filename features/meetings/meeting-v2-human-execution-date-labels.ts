import { format } from "date-fns";
import { enUS } from "date-fns/locale";

type MeetingHumanExecutionDateValue = Date | string | null | undefined;

export function formatMeetingHumanExecutionDateLabel(
  value: MeetingHumanExecutionDateValue,
  english: boolean,
  formatChineseDateLabel: (value: MeetingHumanExecutionDateValue) => string,
) {
  if (!english) return formatChineseDateLabel(value);
  if (!value) return "Not set";

  const date = typeof value === "string" ? new Date(value) : value;
  return format(date, "MMM d HH:mm", { locale: enUS });
}
