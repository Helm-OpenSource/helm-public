import { z } from "zod";

import { CAIO_ATTENTION_ROLE_KEY_PATTERN } from "@/lib/caio-attention/contracts";
import { CAIO_REF_PATTERN } from "@/lib/caio-operating-context/contracts";
import type { NorthstarKpiDirection, NorthstarKpiUnit } from "@/lib/shell/northstar-kpi";

/**
 * CAIO goal ledger contracts: pure shapes, no IO and no clock.
 *
 * A workspace keeps one append-only, hash-chained list of entries. Each entry carries the owner's words, a change
 * note and `files`, an opaque table of sealed digests; under a fixed key one of those digests binds a Core-shaped
 * goal document. The document names goals, metric references, components, gates and the role keys that own them.
 * It has no place for a threshold value, a person or an individual score: every level is strict, so an unknown
 * key anywhere fails closed, and prose fields that carry an amount or a percentage are refused.
 */

export const CAIO_GOAL_LEDGER_ENTRY_SCHEMA_VERSION = "caio-goal-ledger-entry/v1";
export const CAIO_GOAL_LEDGER_DOCUMENT_SCHEMA_VERSION = "caio-goal-ledger-document/v1";
/** `files` key of the Core-shaped document on locally appended entries; an import bundle names its own key. */
export const CAIO_GOAL_LEDGER_DOCUMENT_FILE_KEY = "caio/goal-ledger-document.json";
export const CAIO_GOAL_LEDGER_GENESIS_PREV_HASH = "0".repeat(64);
export const CAIO_GOAL_LEDGER_SHA256_PATTERN = /^[0-9a-f]{64}$/u;
export const CAIO_GOAL_LEDGER_FILE_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,190}$/u;
export const CAIO_GOAL_LEDGER_GOAL_KINDS = ["northstar", "stage_metric"] as const;

/** Metric units and directions mirror the northstar KPI contract; the checks below fail typecheck on drift. */
export const CAIO_GOAL_LEDGER_METRIC_UNITS = [
  "count", "percent", "ratio", "currency_band", "duration_seconds", "days", "index", "rate",
] as const satisfies readonly NorthstarKpiUnit[];
export const CAIO_GOAL_LEDGER_METRIC_DIRECTIONS = ["up_good", "down_good", "neutral"] as const satisfies
  readonly NorthstarKpiDirection[];
type UnlistedUnits = Exclude<NorthstarKpiUnit, (typeof CAIO_GOAL_LEDGER_METRIC_UNITS)[number]>;
type UnlistedDirections = Exclude<NorthstarKpiDirection, (typeof CAIO_GOAL_LEDGER_METRIC_DIRECTIONS)[number]>;
const _unitsExhaustive: [UnlistedUnits] extends [never] ? true : never = true;
const _directionsExhaustive: [UnlistedDirections] extends [never] ? true : never = true;

const MAX_SEALED_FILES = 500;

const ISO_TIMESTAMP_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(?:Z|[+-](\d{2}):(\d{2}))$/u;

/**
 * Epoch milliseconds of an ISO 8601 timestamp with an explicit offset (`Z` or `±hh:mm`), or null. The calendar
 * date and clock fields are checked strictly, because Date.parse rolls 2026-02-30 over into March.
 */
export function parseCaioGoalLedgerTimestamp(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = ISO_TIMESTAMP_PATTERN.exec(value);
  if (!match) return null;
  const [year, month, day, hour, minute, second] = match.slice(1, 7).map(Number);
  const offsetHour = match[7] === undefined ? 0 : Number(match[7]);
  const offsetMinute = match[8] === undefined ? 0 : Number(match[8]);
  if (hour > 23 || minute > 59 || second > 59 || offsetHour > 23 || offsetMinute > 59) return null;
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  const epochMs = Date.parse(value);
  return Number.isFinite(epochMs) ? epochMs : null;
}

// Lengths count code points, so a limit means the same number of characters to every writer.
const codePointLength = (value: string) => {
  let length = 0;
  for (const _ of value) length += 1;
  return length;
};
const text = (max: number) => z.string().refine((value) => value.trim().length > 0 && codePointLength(value) <= max);
const sha256 = z.string().regex(CAIO_GOAL_LEDGER_SHA256_PATTERN);
const timestamp = z.string().refine((value) => parseCaioGoalLedgerTimestamp(value) !== null);
const ref = z.string().regex(CAIO_REF_PATTERN);
const roleKey = z.string().regex(CAIO_ATTENTION_ROLE_KEY_PATTERN);
const label = text(200);

// Closed key set: imported entries carry the first seven keys; locally appended entries add the optional three.
const entrySchema = z.object({
  seq: z.number().int().min(1),
  ts: timestamp,
  owner_quote: text(4000),
  change: text(4000),
  files: z.record(z.string().regex(CAIO_GOAL_LEDGER_FILE_KEY_PATTERN), sha256)
    .refine((files) => Object.keys(files).length <= MAX_SEALED_FILES),
  prev_hash: sha256,
  hash: sha256,
  writer: text(200).optional(),
  effective_at: timestamp.optional(),
  schema: z.literal(CAIO_GOAL_LEDGER_ENTRY_SCHEMA_VERSION).optional(),
}).strict();

export type CaioGoalLedgerEntry = z.infer<typeof entrySchema>;

/** Shape only. Hash, sequence and link checks belong to the chain verifier. */
export function parseCaioGoalLedgerEntry(raw: unknown):
  | { ok: true; entry: CaioGoalLedgerEntry }
  | { ok: false; errorCode: "entry_shape_invalid" } {
  const parsed = entrySchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errorCode: "entry_shape_invalid" };
  // The record rebuilds `files` and may skip a key such as an own "__proto__" (JSON.parse keeps one) without a
  // refusal, while the entry hash covers the input as given; so every input key must itself match the pattern.
  const inputFileKeys = Object.keys((raw as { files: object }).files);
  if (!inputFileKeys.every((key) => CAIO_GOAL_LEDGER_FILE_KEY_PATTERN.test(key))) {
    return { ok: false, errorCode: "entry_shape_invalid" };
  }
  return { ok: true, entry: parsed.data };
}

const metricSchema = z.object({
  key: ref,
  label: z.object({ zh: label, en: label }).strict(),
  unit: z.enum(CAIO_GOAL_LEDGER_METRIC_UNITS),
  direction: z.enum(CAIO_GOAL_LEDGER_METRIC_DIRECTIONS),
  basisRef: ref,
}).strict();

const goalSchema = z.object({
  key: ref,
  kind: z.enum(CAIO_GOAL_LEDGER_GOAL_KINDS),
  title: text(200),
  standard: text(2000),
  metrics: z.array(metricSchema).max(20),
  // A reference and the digest of the private threshold only; sha256 null means no line is set yet.
  threshold: z.object({ ref, sha256: sha256.nullable() }).strict().nullable(),
  componentKeys: z.array(ref).max(100),
}).strict();

const documentSchema = z.object({
  schema: z.literal(CAIO_GOAL_LEDGER_DOCUMENT_SCHEMA_VERSION),
  goals: z.array(goalSchema).min(1).max(20),
  components: z.array(z.object({ key: ref, label, primaryRoleKey: roleKey }).strict()).max(100),
  gates: z.array(z.object({ key: ref, label, holderRoleKey: roleKey, note: text(500).optional() }).strict()).max(50),
  // People stay in the attention route config; the document pins the version and content hash it was written for.
  roleBindingPin: z.object({
    source: z.literal("caio_attention_route_config"),
    version: z.number().int().min(1),
    contentHash: sha256,
  }).strict().nullable(),
}).strict();

export type CaioGoalLedgerDocument = z.infer<typeof documentSchema>;

export type CaioGoalLedgerDocumentInvalidDetail =
  | "shape_invalid"
  | "duplicate_key"
  | "unknown_component_key"
  | "role_binding_pin_required"
  | "role_binding_pin_unexpected";

// Amount: a currency sign before digits, or digits before 元 / 万元 / 亿元, not where 元 starts another word
// (元组, 元素, 元数据, 元旦, 元月, 元运算, 元函数, 元器件). Rate: digits before a percent sign. \p{Nd} also matches
// full-width digits.
const AMOUNT_PATTERN =
  /[¥￥]\s*\p{Nd}[\p{Nd},，]*(?:\.\p{Nd}+)?|\p{Nd}[\p{Nd},，]*(?:\.\p{Nd}+)?\s*(?:万元|亿元|元(?!组|素|数据|旦|月|运算|函数|器件))/u;
const RATE_PATTERN = /\p{Nd}+(?:\.\p{Nd}+)?\s*[%％]/u;

/** True when the text carries an amount or a percentage, which must not travel in ledger prose. */
export function caioGoalLedgerProseCarriesValue(value: string): boolean {
  return AMOUNT_PATTERN.test(value) || RATE_PATTERN.test(value);
}

/** Every role key the document uses, in document order, without repeats. */
export function collectCaioGoalLedgerRoleKeys(document: CaioGoalLedgerDocument): string[] {
  return [...new Set([
    ...document.components.map((component) => component.primaryRoleKey),
    ...document.gates.map((gate) => gate.holderRoleKey),
  ])];
}

const hasDuplicates = (keys: readonly string[]) => new Set(keys).size !== keys.length;

// Every free-text field of the document, so no value can travel in prose anywhere in it.
function proseFields(document: CaioGoalLedgerDocument): string[] {
  return [
    ...document.goals.flatMap((goal) => [
      goal.title,
      goal.standard,
      ...goal.metrics.flatMap((metric) => [metric.label.zh, metric.label.en]),
    ]),
    ...document.components.map((component) => component.label),
    ...document.gates.flatMap((gate) => (gate.note === undefined ? [gate.label] : [gate.label, gate.note])),
  ];
}

/**
 * Validates a parsed document. Goal, component and gate keys are unique in their own lists, metric keys across the
 * whole document and component references within a goal; every reference resolves. The role binding pin is
 * required exactly when the document uses a role key.
 */
export function parseCaioGoalLedgerDocument(raw: unknown):
  | { ok: true; document: CaioGoalLedgerDocument }
  | { ok: false; errorCode: "document_invalid"; detail: CaioGoalLedgerDocumentInvalidDetail }
  | { ok: false; errorCode: "prose_carries_value" } {
  const invalid = (detail: CaioGoalLedgerDocumentInvalidDetail) =>
    ({ ok: false, errorCode: "document_invalid", detail }) as const;
  const parsed = documentSchema.safeParse(raw);
  if (!parsed.success) return invalid("shape_invalid");
  const document = parsed.data;
  if (
    hasDuplicates(document.goals.map((goal) => goal.key))
    || hasDuplicates(document.components.map((component) => component.key))
    || hasDuplicates(document.gates.map((gate) => gate.key))
    || hasDuplicates(document.goals.flatMap((goal) => goal.metrics.map((metric) => metric.key)))
    || document.goals.some((goal) => hasDuplicates(goal.componentKeys))
  ) {
    return invalid("duplicate_key");
  }
  const componentKeys = new Set(document.components.map((component) => component.key));
  if (document.goals.some((goal) => goal.componentKeys.some((key) => !componentKeys.has(key)))) {
    return invalid("unknown_component_key");
  }
  const usesRoleKeys = collectCaioGoalLedgerRoleKeys(document).length > 0;
  if (usesRoleKeys && document.roleBindingPin === null) return invalid("role_binding_pin_required");
  if (!usesRoleKeys && document.roleBindingPin !== null) return invalid("role_binding_pin_unexpected");
  if (proseFields(document).some(caioGoalLedgerProseCarriesValue)) return { ok: false, errorCode: "prose_carries_value" };
  return { ok: true, document };
}
