export const EXECUTION_SECTION_MARKER = "--- Helm v2 human execution follow-through ---";
export const OFFICIAL_WRITE_SECTION_MARKER = "--- Helm v2 guarded official write status ---";
export const OFFICIAL_FOLLOW_THROUGH_SECTION_MARKER = "--- Helm v2 official follow-through status ---";

const KNOWN_MANAGED_SUMMARY_MARKERS = new Set([
  EXECUTION_SECTION_MARKER,
  OFFICIAL_WRITE_SECTION_MARKER,
  OFFICIAL_FOLLOW_THROUGH_SECTION_MARKER,
]);

function stripManagedSummarySection(value: string | null | undefined, marker: string) {
  if (!value) return "";

  const lines = value.split("\n");
  const keptLines: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line === marker) {
      index += 1;
      while (index < lines.length && !KNOWN_MANAGED_SUMMARY_MARKERS.has(lines[index] ?? "")) {
        index += 1;
      }
      index -= 1;
      continue;
    }
    keptLines.push(line ?? "");
  }

  return keptLines.join("\n").trimEnd();
}

export function mergeManagedSummarySection(base: string | null | undefined, marker: string, lines: string[]) {
  const cleanBase = stripManagedSummarySection(base, marker);
  const managed = [marker, ...lines].join("\n");
  return cleanBase ? `${cleanBase}\n\n${managed}` : managed;
}
