import {
  JUDGEMENT_PACKET_SCHEMA_VERSION,
  computeJudgementPacketContentHash,
  type JudgementPacket,
  type JudgementPacketContent,
} from "@/lib/operating-harness/contracts";
import { validateOperatingHarnessJudgementPacket } from "@/lib/operating-harness/validators";

import { computeCaioInferenceInputHash, type CaioInferenceInput, type CaioInferenceRejectionCode } from "./contracts";
import { toCaioLayeredJudgementDisposition, type CaioLayeredJudgement } from "./layered-judgement";

/**
 * Projects a layered judgement onto the public P3a JudgementPacket: advice only, human review required, no
 * forbidden action refs, evidence limited to what the frozen input carried. The layered body itself stays in
 * the queue's private column; the packet only names the closed disposition token.
 */
const BOUNDARY_NOTE =
  "Advisory judgement from an on-premises model over aggregate operating snapshots; human review required, with no dispatch, execution, or outbound effect.";

export function buildCaioInferenceJudgementPacket(input: {
  workspaceId: string;
  jobId: string;
  inferenceInput: CaioInferenceInput;
  layered: CaioLayeredJudgement;
  now: Date;
}): { ok: true; packet: JudgementPacket } | { ok: false; code: CaioInferenceRejectionCode } {
  const { inferenceInput, layered } = input;
  const cited = new Set([
    ...layered.facts.flatMap((entry) => entry.evidenceRefs),
    ...layered.inferences.flatMap((entry) => entry.evidenceRefs),
    ...layered.risks.flatMap((entry) => entry.evidenceRefs),
    ...layered.suggestions.flatMap((entry) => entry.evidenceRefs),
  ]);
  // Input order is the canonical order; a judgement never reorders or invents evidence.
  const evidenceRefs = cited.size > 0
    ? inferenceInput.evidenceRefs.filter((ref) => cited.has(ref))
    : [...inferenceInput.evidenceRefs];

  const content: JudgementPacketContent = {
    schemaVersion: JUDGEMENT_PACKET_SCHEMA_VERSION,
    packetId: `caio-inference-judgement.${input.jobId}`,
    inputSnapshotRef: computeCaioInferenceInputHash(inferenceInput),
    expertRevisionId: `caio-inference.${inferenceInput.taskClass.replace(/_/gu, "-")}.v1`,
    signalEventRefs: inferenceInput.snapshotRefs.map((snapshot) => `caio-snapshot.${snapshot.snapshotId}`),
    businessObjectAliasRef: `caio-workspace.${input.workspaceId}`,
    disposition: toCaioLayeredJudgementDisposition(),
    evidenceRefs,
    commitmentClass: "advice",
    boundaryNote: BOUNDARY_NOTE,
    humanReviewerRequired: true,
    forbiddenActionRefs: [],
    confidence: {
      band: layered.confidence.band,
      score: layered.confidence.score,
      method: "model_assisted",
      calibrationRef: null,
    },
    createdAt: input.now.toISOString(),
  };
  const packet: JudgementPacket = {
    ...content,
    contentHash: computeJudgementPacketContentHash(content),
  };
  if (!validateOperatingHarnessJudgementPacket(packet).ok) {
    return { ok: false, code: "malformed_output" };
  }
  return { ok: true, packet };
}
