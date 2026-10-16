import { safeParseJson } from "@/lib/utils";

/**
 * A thread's stored participants: a JSON array of addresses, or one raw
 * address string from older imports. Blank entries are dropped.
 */
export function parseThreadParticipants(value: string | null | undefined): string[] {
  if (!value || !value.trim()) return [];
  const parsed = safeParseJson<unknown>(value, null);
  if (Array.isArray(parsed)) {
    return parsed.filter(
      (item): item is string => typeof item === "string" && item.trim() !== "",
    );
  }
  return [value];
}
