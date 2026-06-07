/**
 * Source Profiler — hashing & id helpers.
 */

import { createHash, randomUUID } from "node:crypto";

/** Stable SHA-256 hex of a string. */
export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/** Stable SHA-256 of a JSON-serializable value (key-order-insensitive). */
export function stableHash(value: unknown): string {
  return sha256Hex(stableStringify(value));
}

/** Short (12 hex) stable hash, for human-facing run-dir suffixes. */
export function shortHash(value: unknown): string {
  return stableHash(value).slice(0, 12);
}

export function newRunId(): string {
  return randomUUID();
}

/** Deterministic JSON stringify with sorted object keys. */
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = sortValue((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}
