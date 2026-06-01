const HTML_ENTITY_MAP: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: "\"",
  apos: "'",
  "#39": "'",
};

function decodeHtmlEntity(entity: string) {
  const lowered = entity.toLowerCase();
  if (HTML_ENTITY_MAP[lowered]) {
    return HTML_ENTITY_MAP[lowered];
  }

  if (/^#\d+$/.test(lowered)) {
    const codePoint = Number.parseInt(lowered.slice(1), 10);
    return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : `&${entity};`;
  }

  if (/^#x[0-9a-f]+$/.test(lowered)) {
    const codePoint = Number.parseInt(lowered.slice(2), 16);
    return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : `&${entity};`;
  }

  return `&${entity};`;
}

function decodeHtmlEntities(value: string) {
  return value.replace(/&([^;\s]+);/g, (_, entity: string) => decodeHtmlEntity(entity));
}

function stripHtml(value: string) {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|blockquote|tr|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
}

export function formatInboxMessageBody(body: string, english = false) {
  const normalized = String(body || "")
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .trim();
  const decoded = decodeHtmlEntities(stripHtml(normalized));
  const compactLines = decoded
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim());

  return compactLines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => formatSeededBusinessCopy(line, english))
    .join("\n")
    .trim();
}
import { formatSeededBusinessCopy } from "@/lib/presentation/seeded-business-copy";
