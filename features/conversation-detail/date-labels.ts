import { format, formatDistanceToNowStrict } from "date-fns";
import { enUS } from "date-fns/locale";
import { formatDateLabel, formatRelative } from "@/lib/utils";

export function formatConversationDateLabel(
  value: Date | string | null | undefined,
  english: boolean,
) {
  if (!english) return formatDateLabel(value);
  if (!value) return "Not set";

  const date = typeof value === "string" ? new Date(value) : value;
  return format(date, "MMM d HH:mm", { locale: enUS });
}

export function formatConversationRelativeLabel(
  value: Date | string | null | undefined,
  english: boolean,
) {
  if (!english) return formatRelative(value);
  if (!value) return "No date";

  const date = typeof value === "string" ? new Date(value) : value;
  return formatDistanceToNowStrict(date, {
    addSuffix: true,
    locale: enUS,
  });
}
