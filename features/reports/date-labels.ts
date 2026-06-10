import { format } from "date-fns";
import { enUS } from "date-fns/locale";
import { formatDateLabel, formatShortDate } from "@/lib/utils";

type ReportDateValue = Date | string | null | undefined;

function normalizeReportDate(value: ReportDateValue) {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value : new Date(value);
}

export function formatReportShortDate(value: ReportDateValue, english: boolean) {
  const date = normalizeReportDate(value);

  if (!date) {
    return english ? "Not set" : "未设置";
  }

  if (english) {
    return format(date, "MMM d", { locale: enUS });
  }

  return formatShortDate(date);
}

export function formatReportDateLabel(value: ReportDateValue, english: boolean) {
  const date = normalizeReportDate(value);

  if (!date) {
    return english ? "Not set" : "未设置";
  }

  if (english) {
    return format(date, "MMM d HH:mm", { locale: enUS });
  }

  return formatDateLabel(date);
}

export function formatReportDateRange(
  start: ReportDateValue,
  end: ReportDateValue,
  english: boolean,
) {
  return `${formatReportShortDate(start, english)} - ${formatReportShortDate(end, english)}`;
}
