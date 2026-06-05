import { format, formatDistanceToNowStrict } from "date-fns";
import { enUS } from "date-fns/locale";

type BusinessAssetDateValue = Date | string | null | undefined;

export function formatBusinessAssetDateLabel(
  value: BusinessAssetDateValue,
  english: boolean,
  formatChineseDateLabel: (value: BusinessAssetDateValue) => string,
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

export function formatBusinessAssetRelativeLabel(
  value: BusinessAssetDateValue,
  english: boolean,
  formatChineseRelativeLabel: (value: BusinessAssetDateValue) => string,
) {
  if (!english) {
    return formatChineseRelativeLabel(value);
  }

  if (!value) {
    return "no recent update";
  }

  const date = typeof value === "string" ? new Date(value) : value;
  return formatDistanceToNowStrict(date, {
    addSuffix: true,
    locale: enUS,
  });
}
