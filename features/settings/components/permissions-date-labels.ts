import { format } from "date-fns";
import { enUS } from "date-fns/locale";
import { formatDateLabel } from "@/lib/utils";

type PermissionDateValue = Date | string | null | undefined;

export function formatPermissionDateLabel(value: PermissionDateValue, english: boolean) {
  if (!value) {
    return english ? "Not set" : "未设置";
  }

  const date = value instanceof Date ? value : new Date(value);

  if (english) {
    return format(date, "MMM d HH:mm", { locale: enUS });
  }

  return formatDateLabel(date);
}
