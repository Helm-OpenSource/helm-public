import { format, formatDistanceToNowStrict } from "date-fns";
import { enUS } from "date-fns/locale";

type RiskSignalDateValue = Date | string | null | undefined;

export function formatDashboardRiskSignalDateLabel(
  value: RiskSignalDateValue,
  english: boolean,
  formatChineseDateLabel: (value: RiskSignalDateValue) => string,
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

export function formatDashboardRiskSignalRelativeLabel(
  value: RiskSignalDateValue,
  english: boolean,
  formatChineseRelativeLabel: (value: RiskSignalDateValue) => string,
) {
  if (!english) {
    return formatChineseRelativeLabel(value);
  }

  if (!value) {
    return "No recent activity";
  }

  const date = typeof value === "string" ? new Date(value) : value;
  return formatDistanceToNowStrict(date, {
    addSuffix: true,
    locale: enUS,
  });
}
