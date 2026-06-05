import { format } from "date-fns";
import { enUS } from "date-fns/locale";
import { formatDateLabel } from "@/lib/utils";

type TenantResourceDateValue = Date | string | null | undefined;

export function formatTenantResourceDateLabel(
  value: TenantResourceDateValue,
  english: boolean,
  emptyLabel?: string,
) {
  if (!value) {
    return emptyLabel ?? (english ? "Not recorded" : "未记录");
  }

  const date = value instanceof Date ? value : new Date(value);

  if (english) {
    return format(date, "MMM d HH:mm", { locale: enUS });
  }

  return formatDateLabel(date);
}
