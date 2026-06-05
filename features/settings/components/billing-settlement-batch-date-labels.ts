import { format } from "date-fns";
import { enUS } from "date-fns/locale";

type SettlementBatchDateValue = Date | string | null | undefined;

export function formatSettlementBatchDateLabel(
  value: SettlementBatchDateValue,
  english: boolean,
  formatChineseDateLabel: (value: SettlementBatchDateValue) => string,
) {
  if (!english) {
    return formatChineseDateLabel(value);
  }

  if (!value) {
    return "Not set";
  }

  const date = value instanceof Date ? value : new Date(value);
  return format(date, "MMM d HH:mm", { locale: enUS });
}

export function formatSettlementBatchDateRangeLabel(
  start: SettlementBatchDateValue,
  end: SettlementBatchDateValue,
  english: boolean,
  formatChineseDateLabel: (value: SettlementBatchDateValue) => string,
) {
  return `${formatSettlementBatchDateLabel(start, english, formatChineseDateLabel)} - ${formatSettlementBatchDateLabel(
    end,
    english,
    formatChineseDateLabel,
  )}`;
}
