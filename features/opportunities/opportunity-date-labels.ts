import { format, formatDistanceToNowStrict } from "date-fns";
import { enUS } from "date-fns/locale";

type OpportunityDateValue = Date | string | null | undefined;

type ChineseDateFormatter = (value?: OpportunityDateValue) => string;

function toDate(value: OpportunityDateValue) {
  return typeof value === "string" ? new Date(value) : value;
}

export function formatOpportunityDateLabel(
  value: OpportunityDateValue,
  english: boolean,
  formatChineseDateLabel: ChineseDateFormatter,
) {
  if (!english) return formatChineseDateLabel(value);
  if (!value) return "Not set";

  return format(toDate(value)!, "MMM d HH:mm", { locale: enUS });
}

export function formatOpportunityRelativeLabel(
  value: OpportunityDateValue,
  english: boolean,
  formatChineseRelativeLabel: ChineseDateFormatter,
) {
  if (!english) return formatChineseRelativeLabel(value);
  if (!value) return "No recent update";

  return formatDistanceToNowStrict(toDate(value)!, {
    addSuffix: true,
    locale: enUS,
  });
}
