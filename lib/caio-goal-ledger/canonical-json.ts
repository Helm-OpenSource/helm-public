import { createHash } from "node:crypto";

/**
 * Canonical JSON and hashing for the CAIO goal ledger chain: pure, no IO and no clock.
 *
 * Keys sort by Unicode code point (the UTF-8 byte order), separators carry no spaces, non-ASCII text is written as
 * is and strings escape exactly as JSON.stringify does. The value domain is closed: strings, safe integers,
 * booleans, null, plain objects and arrays. Fractional or non-finite numbers, integers beyond the safe range,
 * lone surrogates, undefined and every other type are refused, so two runtimes hashing one entry agree byte for
 * byte. Not interchangeable with lib/expert-capability/hashing.ts, which sorts by UTF-16 unit and accepts floats.
 */

export const CAIO_GOAL_LEDGER_CANONICAL_JSON_ERROR_CODES = [
  "non_integer_number",
  "unsafe_integer",
  "lone_surrogate",
  "unsupported_value",
  "cycle",
  "too_deep",
] as const;
export type CaioGoalLedgerCanonicalJsonErrorCode = (typeof CAIO_GOAL_LEDGER_CANONICAL_JSON_ERROR_CODES)[number];

export type CaioGoalLedgerCanonicalJsonResult =
  | { ok: true; text: string }
  | { ok: false; errorCode: CaioGoalLedgerCanonicalJsonErrorCode };

const MAX_DEPTH = 64;
// With the u flag a well-formed surrogate pair is one astral code point, so only lone surrogates match.
const LONE_SURROGATE = /\p{Cs}/u;

class CanonicalJsonRefusal {
  constructor(readonly errorCode: CaioGoalLedgerCanonicalJsonErrorCode) {}
}

// UTF-16 order differs from code point order only where a surrogate meets a unit in U+E000..U+FFFF: shift the
// surrogates above that block so astral characters sort after every BMP character.
const codePointOrderUnit = (unit: number) => (unit < 0xd800 ? unit : unit >= 0xe000 ? unit - 0x800 : unit + 0x2000);

function compareCodePoints(left: string, right: string): number {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const a = left.charCodeAt(index);
    const b = right.charCodeAt(index);
    if (a !== b) return codePointOrderUnit(a) - codePointOrderUnit(b);
  }
  return left.length - right.length;
}

function encodeString(value: string): string {
  if (LONE_SURROGATE.test(value)) throw new CanonicalJsonRefusal("lone_surrogate");
  return JSON.stringify(value);
}

function isPlainObject(value: object): boolean {
  const prototype = Object.getPrototypeOf(value);
  return (prototype === Object.prototype || prototype === null) && Object.getOwnPropertySymbols(value).length === 0;
}

function encode(value: unknown, depth: number, ancestors: Set<object>): string {
  if (value === null) return "null";
  switch (typeof value) {
    case "boolean":
      return value ? "true" : "false";
    case "string":
      return encodeString(value);
    case "number":
      if (!Number.isInteger(value)) throw new CanonicalJsonRefusal("non_integer_number");
      if (!Number.isSafeInteger(value)) throw new CanonicalJsonRefusal("unsafe_integer");
      return Object.is(value, -0) ? "0" : String(value);
    case "object":
      break;
    default:
      throw new CanonicalJsonRefusal("unsupported_value");
  }
  if (depth >= MAX_DEPTH) throw new CanonicalJsonRefusal("too_deep");
  if (ancestors.has(value)) throw new CanonicalJsonRefusal("cycle");
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      // Holes and extra named properties would be dropped silently; refuse them instead.
      if (Object.getPrototypeOf(value) !== Array.prototype || Object.keys(value).length !== value.length) {
        throw new CanonicalJsonRefusal("unsupported_value");
      }
      return `[${value.map((item) => encode(item, depth + 1, ancestors)).join(",")}]`;
    }
    if (!isPlainObject(value)) throw new CanonicalJsonRefusal("unsupported_value");
    const record = value as Record<string, unknown>;
    const members = Object.keys(record)
      .sort(compareCodePoints)
      .map((key) => `${encodeString(key)}:${encode(record[key], depth + 1, ancestors)}`);
    return `{${members.join(",")}}`;
  } finally {
    ancestors.delete(value);
  }
}

export function canonicalizeCaioGoalLedgerJson(value: unknown): CaioGoalLedgerCanonicalJsonResult {
  try {
    return { ok: true, text: encode(value, 0, new Set()) };
  } catch (error) {
    if (error instanceof CanonicalJsonRefusal) return { ok: false, errorCode: error.errorCode };
    throw error;
  }
}

/** sha256 over the UTF-8 bytes of `text`, lowercase hex. Text that is not well-formed UTF-16 has no lossless UTF-8. */
export function sha256HexOfCaioGoalLedgerText(text: string):
  | { ok: true; hash: string }
  | { ok: false; errorCode: "lone_surrogate" } {
  if (LONE_SURROGATE.test(text)) return { ok: false, errorCode: "lone_surrogate" };
  return { ok: true, hash: createHash("sha256").update(text, "utf8").digest("hex") };
}

/**
 * Entry hash: sha256 of the canonical JSON of the entry without its top-level `hash` key. Returns the preimage too,
 * so a verifier can compare bytes, not only digests. Nested `hash` keys are part of the preimage.
 */
export function computeCaioGoalLedgerEntryHash(entry: unknown):
  | { ok: true; preimage: string; hash: string }
  | { ok: false; errorCode: CaioGoalLedgerCanonicalJsonErrorCode | "entry_not_object" } {
  if (typeof entry !== "object" || entry === null || Array.isArray(entry) || !isPlainObject(entry)) {
    return { ok: false, errorCode: "entry_not_object" };
  }
  const { hash: _hash, ...preimageSource } = entry as Record<string, unknown>;
  const canonical = canonicalizeCaioGoalLedgerJson(preimageSource);
  if (!canonical.ok) return canonical;
  const digest = sha256HexOfCaioGoalLedgerText(canonical.text);
  if (!digest.ok) return digest;
  return { ok: true, preimage: canonical.text, hash: digest.hash };
}
