import { z } from "zod";

import { ACTION_DISPOSITION_PREFIXES } from "@/lib/expert-capability/contracts";
import { canonicalJson, sha256 } from "@/lib/expert-capability/hashing";

import type { CaioInferenceRejectionCode } from "./contracts";

/**
 * Closed layered judgement returned by an on-premises model. The whole packet is accepted or refused:
 * facts, inferences, risks and suggestions may only cite evidence that exists in the frozen input, a
 * suggestion is only ever a rule draft or a dry-run request, and free text is data that never changes the
 * verdict. The private body is stored as-is; the public JudgementPacket only carries its content hash.
 */
export const CAIO_LAYERED_JUDGEMENT_SCHEMA_VERSION = "helm.caio.layered-judgement.v1" as const;
export const CAIO_LAYERED_JUDGEMENT_MAX_BYTES = 64 * 1024;
export const CAIO_SUGGESTION_KINDS = ["rule_draft", "dry_run_request"] as const;

const statement = z.string().max(500).refine((value) => value.trim().length > 0);
const citedRefs = z.array(z.string().min(1).max(191)).min(1).max(20);

const suggestionSchema = z.object({
  kind: z.enum(CAIO_SUGGESTION_KINDS),
  summary: statement,
  evidenceRefs: citedRefs,
}).strict();

const layeredJudgementSchema = z.object({
  schemaVersion: z.literal(CAIO_LAYERED_JUDGEMENT_SCHEMA_VERSION),
  facts: z.array(z.object({ statement, evidenceRefs: citedRefs }).strict()).max(20),
  inferences: z.array(z.object({ statement, evidenceRefs: citedRefs }).strict()).max(20),
  risks: z.array(z.object({ statement, severity: z.enum(["low", "medium", "high"]), evidenceRefs: citedRefs }).strict()).max(20),
  unknowns: z.array(z.object({ statement }).strict()).max(20),
  suggestions: z.array(suggestionSchema).max(10),
  confidence: z.object({
    band: z.enum(["high", "medium", "low", "mixed", "unknown"]),
    score: z.number().min(0).max(1).nullable(),
  }).strict(),
}).strict();

export type CaioLayeredJudgement = z.infer<typeof layeredJudgementSchema>;

export type CaioLayeredJudgementValidation =
  | { ok: true; value: CaioLayeredJudgement; contentHash: string }
  | { ok: false; code: Extract<CaioInferenceRejectionCode, "malformed_output" | "evidence_outside_input" | "suggestion_kind_not_allowed" | "action_disposition_present" | "payload_too_large"> };

export function validateCaioLayeredJudgement(
  input: unknown,
  allowedEvidenceRefs: ReadonlySet<string>,
): CaioLayeredJudgementValidation {
  let serialized: string;
  try {
    serialized = canonicalJson(input);
  } catch {
    return { ok: false, code: "malformed_output" };
  }
  if (Buffer.byteLength(serialized ?? "", "utf8") > CAIO_LAYERED_JUDGEMENT_MAX_BYTES) {
    return { ok: false, code: "payload_too_large" };
  }

  // A suggestion outside the closed kinds is refused with its own code, even when the rest is well formed.
  if (hasDisallowedSuggestionKind(input)) {
    return { ok: false, code: "suggestion_kind_not_allowed" };
  }

  const parsed = layeredJudgementSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "malformed_output" };
  }
  const value = parsed.data;

  const cited = [
    ...value.facts.flatMap((entry) => entry.evidenceRefs),
    ...value.inferences.flatMap((entry) => entry.evidenceRefs),
    ...value.risks.flatMap((entry) => entry.evidenceRefs),
    ...value.suggestions.flatMap((entry) => entry.evidenceRefs),
  ];
  if (cited.some((ref) => !allowedEvidenceRefs.has(ref))) {
    return { ok: false, code: "evidence_outside_input" };
  }

  const texts = [
    ...value.facts.map((entry) => entry.statement),
    ...value.inferences.map((entry) => entry.statement),
    ...value.risks.map((entry) => entry.statement),
    ...value.unknowns.map((entry) => entry.statement),
    ...value.suggestions.map((entry) => entry.summary),
  ];
  if (texts.some(isActionShaped)) {
    return { ok: false, code: "action_disposition_present" };
  }

  return { ok: true, value, contentHash: sha256(canonicalJson(value)) };
}

/** The public disposition for a JudgementPacket: schema version plus the private body's content hash. */
export function toCaioLayeredJudgementDisposition(contentHash: string): string {
  return `caio.layered-judgement.v1:${contentHash}`;
}

function hasDisallowedSuggestionKind(input: unknown): boolean {
  if (input === null || typeof input !== "object" || Array.isArray(input)) return false;
  const suggestions = (input as { suggestions?: unknown }).suggestions;
  if (!Array.isArray(suggestions)) return false;
  return suggestions.some((entry) => {
    if (entry === null || typeof entry !== "object") return false;
    const kind = (entry as { kind?: unknown }).kind;
    return !(CAIO_SUGGESTION_KINDS as readonly unknown[]).includes(kind);
  });
}

function isActionShaped(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  return ACTION_DISPOSITION_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}
