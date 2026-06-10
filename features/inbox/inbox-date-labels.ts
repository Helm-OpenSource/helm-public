import { format } from "date-fns";
import { enUS } from "date-fns/locale";

type InboxDateValue = Date | string | null | undefined;

export function formatInboxDateLabel(
  value: InboxDateValue,
  english: boolean,
  formatChineseDateLabel: (value: InboxDateValue) => string,
) {
  if (!english) return formatChineseDateLabel(value);
  if (!value) return "Not set";

  const date = typeof value === "string" ? new Date(value) : value;
  return format(date, "MMM d HH:mm", { locale: enUS });
}
