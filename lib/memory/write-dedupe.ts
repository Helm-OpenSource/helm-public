import { type MemoryFact } from "@prisma/client";
import { safeParseJson } from "@/lib/utils";
import { type CreateFactInput } from "@/lib/memory/memory-fact.service";

type MemoryFactWriteFields = Pick<
  CreateFactInput,
  | "workspaceId"
  | "objectType"
  | "objectId"
  | "factType"
  | "title"
  | "content"
  | "sourceType"
  | "sourceId"
  | "normalizedValue"
>;

export type ExistingMemoryFactForWriteGuard = Pick<
  MemoryFact,
  | "id"
  | "workspaceId"
  | "objectType"
  | "objectId"
  | "factType"
  | "title"
  | "content"
  | "sourceType"
  | "sourceId"
  | "normalizedValue"
>;

export type MemoryFactDuplicateSuppressionReason =
  | "existing_duplicate"
  | "batch_duplicate";

export type MemoryFactConflictReason =
  | "same_normalized_fact_key_different_content"
  | "same_batch_normalized_fact_key_different_content";

export type MemoryFactDuplicateSuppression = {
  reason: MemoryFactDuplicateSuppressionReason;
  writeKey: string;
  title: string;
  matchingFactId: string | null;
};

export type MemoryFactConflictCandidate = {
  reason: MemoryFactConflictReason;
  conflictKey: string;
  writeKey: string;
  title: string;
  existingFactId: string | null;
  existingTitle: string | null;
};

export type MemoryFactWritePlan = {
  createDrafts: CreateFactInput[];
  duplicateSuppressions: MemoryFactDuplicateSuppression[];
  conflictCandidates: MemoryFactConflictCandidate[];
  summary: {
    inputDraftCount: number;
    createDraftCount: number;
    duplicateSuppressedCount: number;
    conflictCandidateCount: number;
    guardMode: "source_object_normalized_fact_key";
    boundaryNote: string;
  };
};

const NORMALIZED_VALUE_KEYS = [
  "factKey",
  "normalizedFactKey",
  "semanticKey",
  "field",
  "attribute",
  "value",
  "text",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizeMemoryFactWriteText(value: unknown) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function readNormalizedValue(value: unknown) {
  if (typeof value !== "string") return value;
  return safeParseJson<unknown>(value, value);
}

function normalizedValueKey(value: unknown): string {
  const parsed = readNormalizedValue(value);

  if (typeof parsed === "string" || typeof parsed === "number" || typeof parsed === "boolean") {
    return normalizeMemoryFactWriteText(parsed);
  }

  if (!isRecord(parsed)) {
    return "";
  }

  for (const key of NORMALIZED_VALUE_KEYS) {
    const part = parsed[key];
    if (typeof part === "string" || typeof part === "number" || typeof part === "boolean") {
      const normalized = normalizeMemoryFactWriteText(part);
      if (normalized) return normalized;
    }
  }

  return "";
}

function factIdentityText(input: Pick<MemoryFactWriteFields, "content" | "title">) {
  return normalizeMemoryFactWriteText(input.content) || normalizeMemoryFactWriteText(input.title);
}

function writeScopeParts(input: Pick<
  MemoryFactWriteFields,
  "workspaceId" | "sourceType" | "sourceId" | "objectType" | "objectId" | "factType"
>) {
  return [
    input.workspaceId,
    input.sourceType,
    input.sourceId,
    input.objectType,
    input.objectId,
    input.factType,
  ].map(String);
}

export function buildMemoryFactWriteKey(input: MemoryFactWriteFields) {
  return [
    ...writeScopeParts(input),
    factIdentityText(input),
  ].join("|");
}

export function buildMemoryFactConflictKey(input: MemoryFactWriteFields) {
  const normalized = normalizedValueKey(input.normalizedValue);
  if (!normalized) return "";

  return [
    ...writeScopeParts(input),
    normalized,
  ].join("|");
}

export function buildMemoryFactWritePlan(args: {
  drafts: CreateFactInput[];
  existingFacts: ExistingMemoryFactForWriteGuard[];
}): MemoryFactWritePlan {
  const existingByWriteKey = new Map<string, ExistingMemoryFactForWriteGuard>();
  const existingByConflictKey = new Map<string, ExistingMemoryFactForWriteGuard>();
  const batchByWriteKey = new Map<string, CreateFactInput>();
  const batchByConflictKey = new Map<string, CreateFactInput>();
  const createDrafts: CreateFactInput[] = [];
  const duplicateSuppressions: MemoryFactDuplicateSuppression[] = [];
  const conflictCandidates: MemoryFactConflictCandidate[] = [];

  for (const fact of args.existingFacts) {
    existingByWriteKey.set(buildMemoryFactWriteKey(fact), fact);
    const conflictKey = buildMemoryFactConflictKey(fact);
    if (conflictKey && !existingByConflictKey.has(conflictKey)) {
      existingByConflictKey.set(conflictKey, fact);
    }
  }

  for (const draft of args.drafts) {
    const writeKey = buildMemoryFactWriteKey(draft);
    const conflictKey = buildMemoryFactConflictKey(draft);
    const existingDuplicate = existingByWriteKey.get(writeKey);
    if (existingDuplicate) {
      duplicateSuppressions.push({
        reason: "existing_duplicate",
        writeKey,
        title: draft.title,
        matchingFactId: existingDuplicate.id,
      });
      continue;
    }

    if (batchByWriteKey.has(writeKey)) {
      duplicateSuppressions.push({
        reason: "batch_duplicate",
        writeKey,
        title: draft.title,
        matchingFactId: null,
      });
      continue;
    }

    const existingConflict = conflictKey ? existingByConflictKey.get(conflictKey) : null;
    if (existingConflict && buildMemoryFactWriteKey(existingConflict) !== writeKey) {
      conflictCandidates.push({
        reason: "same_normalized_fact_key_different_content",
        conflictKey,
        writeKey,
        title: draft.title,
        existingFactId: existingConflict.id,
        existingTitle: existingConflict.title,
      });
      continue;
    }

    const batchConflict = conflictKey ? batchByConflictKey.get(conflictKey) : null;
    if (batchConflict && buildMemoryFactWriteKey(batchConflict) !== writeKey) {
      conflictCandidates.push({
        reason: "same_batch_normalized_fact_key_different_content",
        conflictKey,
        writeKey,
        title: draft.title,
        existingFactId: null,
        existingTitle: batchConflict.title,
      });
      continue;
    }

    createDrafts.push(draft);
    batchByWriteKey.set(writeKey, draft);
    if (conflictKey) {
      batchByConflictKey.set(conflictKey, draft);
    }
  }

  return {
    createDrafts,
    duplicateSuppressions,
    conflictCandidates,
    summary: {
      inputDraftCount: args.drafts.length,
      createDraftCount: createDrafts.length,
      duplicateSuppressedCount: duplicateSuppressions.length,
      conflictCandidateCount: conflictCandidates.length,
      guardMode: "source_object_normalized_fact_key",
      boundaryNote:
        "Memory write dedupe suppresses exact duplicate fact writes and surfaces conflicts for review; it does not rewrite canonical facts or change recommendation / commitment authority.",
    },
  };
}
