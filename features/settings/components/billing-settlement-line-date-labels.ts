import { format } from "date-fns";
import { enUS } from "date-fns/locale";

type SettlementLineDateValue = Date | string | null | undefined;

export function formatSettlementLineDateLabel(
  value: SettlementLineDateValue,
  english: boolean,
  formatChineseDateLabel: (value: SettlementLineDateValue) => string,
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
