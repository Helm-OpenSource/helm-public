import { format } from "date-fns";
import { enUS } from "date-fns/locale";
import { formatDateLabel } from "@/lib/utils";

type SettingsDateValue = Date | string | null | undefined;

export function formatSettingsDateLabel(
  value: SettingsDateValue,
  english: boolean,
) {
  if (!english) return formatDateLabel(value);
  if (!value) return "Not set";

  const date = typeof value === "string" ? new Date(value) : value;
  return format(date, "MMM d HH:mm", { locale: enUS });
}
