import { format } from "date-fns";
import { enUS } from "date-fns/locale";
import { formatDateLabel } from "@/lib/utils";

type MeetingDetailDateValue = Date | string | null | undefined;

export function formatMeetingDetailDateLabel(
  value: MeetingDetailDateValue,
  english: boolean,
) {
  if (!english) return formatDateLabel(value);
  if (!value) return "Not set";

  const date = typeof value === "string" ? new Date(value) : value;
  return format(date, "MMM d HH:mm", { locale: enUS });
}

function toDate(value: Date | string) {
  return typeof value === "string" ? new Date(value) : value;
}

/** "start – end"; the end shows only its time when the meeting ends on the same day. */
export function formatMeetingDetailTimeRange(
  startsAt: Date | string,
  endsAt: Date | string | null | undefined,
  english: boolean,
) {
  const startLabel = formatMeetingDetailDateLabel(startsAt, english);
  if (!endsAt) return startLabel;

  const start = toDate(startsAt);
  const end = toDate(endsAt);
  if (end.getTime() <= start.getTime()) return startLabel;

  const sameDay = format(start, "yyyy-MM-dd") === format(end, "yyyy-MM-dd");
  const endLabel = sameDay
    ? format(end, "HH:mm")
    : formatMeetingDetailDateLabel(end, english);
  return `${startLabel} – ${endLabel}`;
}
