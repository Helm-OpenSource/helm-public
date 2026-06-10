/**
 * Source Profiler — AI prompt builder.
 *
 * Builds the model prompt from a REDACTED ReviewPacket. Refuses to build from a
 * non-redacted packet so real names/rows can never reach a model.
 */

import type { ReviewPacket } from "../contract/review-packet";

const INSTRUCTION = [
  "You are assisting an implementation engineer. Given the REDACTED structural",
  "profile of an external system (aliased object/field names only, no data),",
  "suggest, for each object, the most likely Helm target entity",
  "(Company|Contact|Opportunity|Meeting|Note|Task) and signal family",
  "(commitment|advancement|risk|pacing|receipt|evidence_gap|boundary_attempt),",
  "with a short reasoning and a 0-100 confidence. Your output is advisory only —",
  "a human reviews every suggestion. Return JSON: an array of",
  '{ sourceObjectId, targetEntity, signalFamily, reasoning, confidence }.',
].join(" ");

export function buildAiPrompt(redactedPacket: ReviewPacket): { instruction: string; redactedPacketJson: string } {
  if (redactedPacket.sensitivity !== "REDACTED_SHAREABLE" || redactedPacket.redactionStatus !== "redacted") {
    throw new Error("AI prompt must be built from a REDACTED_SHAREABLE packet");
  }
  const payload = {
    objects: redactedPacket.codeScan.objects.map((o) => ({
      id: o.id,
      kind: o.kind,
      name: o.name,
      fields: o.fields.map((f) => ({ name: f.name, dataType: f.dataType, tags: f.semanticTags })),
    })),
    deterministicCandidates: redactedPacket.candidates.map((c) => ({
      sourceObjectId: c.sourceObjectId,
      targetEntity: c.targetEntity,
      signalFamily: c.signalFamily,
      confidence: c.confidence,
    })),
  };
  return { instruction: INSTRUCTION, redactedPacketJson: JSON.stringify(payload) };
}

/** Human-readable preview of exactly what would be sent. */
export function previewPrompt(prompt: { instruction: string; redactedPacketJson: string }): string {
  return `--- AI PROMPT PREVIEW (redacted-only) ---\n${prompt.instruction}\n\nPAYLOAD:\n${prompt.redactedPacketJson}\n--- END PREVIEW ---`;
}
