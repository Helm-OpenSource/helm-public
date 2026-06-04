import { format } from "date-fns";
import { enUS } from "date-fns/locale";

type ParticipantPortalDateValue = Date | string | null | undefined;

export function formatParticipantPortalDateLabel(
  value: ParticipantPortalDateValue,
  english: boolean,
  formatChineseDateLabel: (value: ParticipantPortalDateValue) => string,
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
