/**
 * Source Profiler — redacted (shareable) export.
 *
 * Produces a REDACTED_SHAREABLE ReviewPacket from a CONFIDENTIAL one: real
 * object/field names and source paths are aliased to generic tokens, free-text
 * rationale is regenerated generically, while structure, mappings, signal
 * families, and confidence are preserved. Safe to share outside the user's
 * environment.
 */

import type { ReviewPacket } from "../contract/review-packet";
import type { CodeScanSummary, DiscoveredObject } from "../contract/code-scan";
import type { SignalMappingCandidate } from "../contract/mapping";
import { reviewPacketSchema } from "../contract/review-packet";

const REDACTED = "redacted";

export function redactReviewPacket(packet: ReviewPacket): ReviewPacket {
  const objectsSorted = [...packet.codeScan.objects].sort((a, b) => a.id.localeCompare(b.id));

  const objectAlias = new Map<string, string>(); // id -> object_N
  const fieldAlias = new Map<string, string>(); // `${id}:${fieldName}` -> field_N_M
  objectsSorted.forEach((object, i) => {
    objectAlias.set(object.id, `object_${i + 1}`);
    object.fields.forEach((field, j) => {
      fieldAlias.set(`${object.id}:${field.name}`, `field_${i + 1}_${j + 1}`);
    });
  });

  const codeScan: CodeScanSummary = {
    ...packet.codeScan,
    skippedFiles: packet.codeScan.skippedFiles.map((s) => ({ ...s, path: REDACTED })),
    objects: packet.codeScan.objects.map((object) => redactObject(object, objectAlias, fieldAlias)),
  };

  const candidates: SignalMappingCandidate[] = packet.candidates.map((c) =>
    redactCandidate(c, objectAlias, fieldAlias),
  );

  return reviewPacketSchema.parse({
    ...packet,
    sensitivity: "REDACTED_SHAREABLE",
    redactionStatus: "redacted",
    // Redact identity-bearing metadata: source, actor (may be an OS username /
    // email), and workspace. traceId is the run id (non-identifying) and kept.
    requiredMetadata: {
      ...packet.requiredMetadata,
      source: REDACTED,
      actor: REDACTED,
      workspace: REDACTED,
      redactionStatus: "redacted",
    },
    codeScan,
    candidates,
    schemaIntrospection: undefined,
  });
}

function redactObject(
  object: DiscoveredObject,
  objectAlias: Map<string, string>,
  fieldAlias: Map<string, string>,
): DiscoveredObject {
  return {
    ...object,
    name: objectAlias.get(object.id) ?? "object",
    sourceRef: REDACTED,
    fields: object.fields.map((field) => ({
      ...field,
      name: fieldAlias.get(`${object.id}:${field.name}`) ?? "field",
    })),
    associations: object.associations.map((assoc) => ({
      ...assoc,
      fromField: fieldAlias.get(`${object.id}:${assoc.fromField}`) ?? "field",
      toObject: aliasByName(object, assoc.toObject, objectAlias),
    })),
  };
}

function redactCandidate(
  candidate: SignalMappingCandidate,
  objectAlias: Map<string, string>,
  fieldAlias: Map<string, string>,
): SignalMappingCandidate {
  return {
    ...candidate,
    rationale: `Structural match → ${candidate.targetEntity} / ${candidate.signalFamily}; human review required.`,
    fieldMappings: candidate.fieldMappings.map((m) => ({
      ...m,
      sourceField: fieldAlias.get(`${candidate.sourceObjectId}:${m.sourceField}`) ?? "field",
    })),
    // evidenceRefs reference stable hashes / tag names — keep ids, drop nothing sensitive.
    evidenceRefs: candidate.evidenceRefs.map((ref) =>
      objectAlias.has(ref) ? (objectAlias.get(ref) as string) : ref,
    ),
  };
}

/** Best-effort alias for an association target referenced by name. */
function aliasByName(
  _object: DiscoveredObject,
  toObject: string,
  objectAlias: Map<string, string>,
): string {
  // We only have stable aliases by id; a name-only reference cannot be resolved
  // deterministically, so redact it rather than leak the real name.
  return objectAlias.size > 0 ? REDACTED : toObject;
}
