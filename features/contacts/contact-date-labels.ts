import { format, formatDistanceToNowStrict } from "date-fns";
import { enUS } from "date-fns/locale";

type ContactDateValue = Date | string | null | undefined;

export function formatContactDateLabel(
  value: ContactDateValue,
  english: boolean,
  formatChineseDateLabel: (value: ContactDateValue) => string,
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

export function formatContactRelativeLabel(
  value: ContactDateValue,
  english: boolean,
  formatChineseRelativeLabel: (value: ContactDateValue) => string,
) {
  if (!english) {
    return formatChineseRelativeLabel(value);
  }

  if (!value) {
    return "no recent interaction";
  }

  const date = typeof value === "string" ? new Date(value) : value;
  return formatDistanceToNowStrict(date, {
    addSuffix: true,
    locale: enUS,
  });
}
