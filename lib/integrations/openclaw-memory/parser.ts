import { createHash } from "node:crypto";
import { MemoryType } from "@prisma/client";

export type OpenClawRawMemoryRecord = {
  id: unknown;
  text: unknown;
  category: unknown;
  scope: unknown;
  importance: unknown;
  timestamp: unknown;
  metadata?: unknown;
};

export type ParsedOpenClawMemoryRecord = {
  externalId: string;
  text: string;
  category: string;
  scope: string;
  importance: number | null;
  occurredAt: Date;
  timestampMs: number;
  rawMetadata: string | null;
  checksum: string;
};

export type ParseLineResult =
  | { ok: true; record: ParsedOpenClawMemoryRecord }
  | { ok: false; error: string };

export type ParsePayloadResult = ParseLineResult;

const DEFAULT_SCOPE = "agent:main";
const DEFAULT_CATEGORY = "other";

function clampInt(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function normalizeImportance(value: unknown): number | null {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return null;
  }

  if (value <= 1 && value >= 0) {
    return clampInt(value * 100, 0, 100);
  }

  return clampInt(value, 0, 100);
}

function normalizeTimestamp(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 10_000_000_000 ? Math.floor(value) : Math.floor(value * 1000);
  }

  if (typeof value === "string") {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return numeric > 10_000_000_000 ? Math.floor(numeric) : Math.floor(numeric * 1000);
    }

    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function normalizeMetadata(value: unknown): string | null {
  if (value == null) {
    return null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;

    try {
      return JSON.stringify(JSON.parse(trimmed));
    } catch {
      return JSON.stringify({ raw: trimmed });
    }
  }

  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

function summarizeText(text: string, max = 72) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) {
    return normalized;
  }
  return `${normalized.slice(0, max - 1)}…`;
}

export function parseOpenClawMemoryLine(line: string): ParseLineResult {
  if (!line.trim()) {
    return { ok: false, error: "empty line" };
  }

  let payload: OpenClawRawMemoryRecord;
  try {
    payload = JSON.parse(line) as OpenClawRawMemoryRecord;
  } catch {
    return { ok: false, error: "invalid json" };
  }

  return parseOpenClawMemoryPayload(payload);
}

export function parseOpenClawMemoryPayload(payload: OpenClawRawMemoryRecord): ParsePayloadResult {
  if (!payload || typeof payload !== "object") {
    return { ok: false, error: "invalid payload" };
  }

  const externalId = typeof payload.id === "string" ? payload.id.trim() : "";
  const text = typeof payload.text === "string" ? payload.text.trim() : "";

  if (!externalId) {
    return { ok: false, error: "missing id" };
  }

  if (!text) {
    return { ok: false, error: "missing text" };
  }

  const timestampMs = normalizeTimestamp(payload.timestamp);
  if (!timestampMs) {
    return { ok: false, error: "invalid timestamp" };
  }

  const category =
    typeof payload.category === "string" && payload.category.trim()
      ? payload.category.trim().toLowerCase()
      : DEFAULT_CATEGORY;

  const scope =
    typeof payload.scope === "string" && payload.scope.trim()
      ? payload.scope.trim()
      : DEFAULT_SCOPE;

  const importance = normalizeImportance(payload.importance);
  const rawMetadata = normalizeMetadata(payload.metadata);

  const checksum = createHash("sha256")
    .update([externalId, text, category, scope, String(importance ?? ""), String(timestampMs), rawMetadata ?? ""].join("|"))
    .digest("hex");

  return {
    ok: true,
    record: {
      externalId,
      text,
      category,
      scope,
      importance,
      occurredAt: new Date(timestampMs),
      timestampMs,
      rawMetadata,
      checksum,
    },
  };
}

export function buildOpenClawSourceLabel(record: { scope: string; category: string }) {
  return `OPENCLAW:${record.scope}:${record.category}`;
}

export function mapOpenClawCategoryToMemoryType(category: string): MemoryType {
  switch (category.toLowerCase()) {
    case "decision":
      return MemoryType.DECISION;
    case "preference":
      return MemoryType.RELATIONSHIP;
    case "entity":
      return MemoryType.RELATIONSHIP;
    case "risk":
      return MemoryType.RISK;
    case "next_action":
    case "next-step":
    case "next_step":
      return MemoryType.NEXT_STEP;
    case "fact":
      return MemoryType.SUMMARY;
    default:
      return MemoryType.NOTE;
  }
}

export function buildOpenClawMemoryTitle(record: { category: string; text: string }) {
  return `OpenClaw ${record.category}: ${summarizeText(record.text)}`;
}

export function parseOpenClawSourceLabel(source: string | null | undefined) {
  if (!source || !source.startsWith("OPENCLAW:")) {
    return null;
  }

  const parts = source.split(":");
  if (parts.length < 3) return null;
  const scope = parts.slice(1, -1).join(":");
  const category = parts[parts.length - 1] ?? "";
  return {
    scope,
    category,
  };
}
