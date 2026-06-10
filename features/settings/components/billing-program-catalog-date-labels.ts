import { format } from "date-fns";
import { enUS } from "date-fns/locale";

type ProgramCatalogDateValue = Date | string | null | undefined;

export function formatProgramCatalogDateLabel(
  value: ProgramCatalogDateValue,
  english: boolean,
  formatChineseDateLabel: (value: ProgramCatalogDateValue) => string,
) {
  if (english) {
    if (!value) {
      return "Not set";
    }

    const date = value instanceof Date ? value : new Date(value);
    return format(date, "MMM d HH:mm", { locale: enUS });
  }

  return formatChineseDateLabel(value);
}
