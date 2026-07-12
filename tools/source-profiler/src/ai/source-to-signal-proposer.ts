/**
 * Source Profiler -> Helm v3 source-to-signal proposal bridge.
 *
 * The full ReviewPacket stays local. The existing AI overlay performs the
 * redaction and consent ceremony; this bridge then grounds every advisory
 * candidate against the locally discovered object graph before emitting the
 * public-safe v3 contract. It has no persistence or activation authority.
 */

import {
  V3_SOURCE_PROPOSAL_FORBIDDEN_CAPABILITIES,
  modelCapabilityProfileSchema,
  sourceToSignalProposalBundleSchema,
  type ModelCapabilityProfile,
  type SourceToSignalProposalBundle,
  type V3SourceProposalRedactionProvenance,
} from "../../../../lib/llm/intelligence-contracts-v3";

import { reviewPacketSchema, type ReviewPacket } from "../contract/review-packet";
import type { SignalMappingCandidate } from "../contract/mapping";
import type { AuditEntry } from "../contract/run";
import { shortHash } from "../util/hash";
import { runAiOverlay, type AiOverlayResult } from "./overlay";
import { isRemoteProvider, type AiProvider, type AiProviderKind } from "./types";

export type SourceToSignalProposerStatus =
  | "produced"
  | "blocked"
  | "profile_mismatch"
  | "provider_failure"
  | "parse_failure"
  | "schema_failure"
  | "evidence_failure";

export type SourceToSignalProposerResult = {
  status: SourceToSignalProposerStatus;
  reason: string | null;
  proposals: SourceToSignalProposalBundle[];
  mappingCandidates: SignalMappingCandidate[];
  promptPreview: string | null;
  audit: AuditEntry[];
};

export type SourceToSignalProposerInput = {
  packet: ReviewPacket;
  modelProfile: ModelCapabilityProfile;
  providerKind: AiProviderKind;
  consent: boolean;
  redactionProvenance: V3SourceProposalRedactionProvenance;
  provider?: AiProvider;
  now?: () => Date;
};

export async function proposeSourceToSignalBundles(
  input: SourceToSignalProposerInput,
): Promise<SourceToSignalProposerResult> {
  const packetResult = reviewPacketSchema.safeParse(input.packet);
  if (!packetResult.success) {
    return failed("schema_failure", "invalid_review_packet");
  }

  const profileResult = modelCapabilityProfileSchema.safeParse(input.modelProfile);
  if (!profileResult.success) {
    return failed("profile_mismatch", "invalid_model_profile");
  }

  const profile = profileResult.data;
  const remote = isRemoteProvider(input.providerKind);
  const profileMatchesProvider = remote
    ? profile.providerMode === "remote" && profile.remoteEgressPolicy !== "blocked"
    : profile.providerMode === "local";
  if (
    !profileMatchesProvider ||
    !profile.allowedWorkflowClasses.includes("source_to_signal_proposal")
  ) {
    return failed("profile_mismatch", "workflow_not_allowed_by_model_profile");
  }

  const overlay = await runAiOverlay({
    packet: packetResult.data,
    providerKind: input.providerKind,
    consent: input.consent,
    provider: input.provider,
    now: input.now,
  });
  if (overlay.status !== "produced") {
    return fromOverlayFailure(overlay);
  }

  const objectById = new Map(
    packetResult.data.codeScan.objects.map((object) => [object.id, object]),
  );
  const deterministicByRoute = new Map(
    packetResult.data.candidates
      .filter((candidate) => candidate.origin === "deterministic")
      .map((candidate) => [
        routeKey(candidate.sourceObjectId, candidate.targetEntity, candidate.signalFamily),
        candidate,
      ]),
  );

  const proposals = overlay.candidates.map((candidate) => {
    const sourceObject = objectById.get(candidate.sourceObjectId);
    if (!sourceObject) {
      return null;
    }

    const structuralCandidate = deterministicByRoute.get(
      routeKey(candidate.sourceObjectId, candidate.targetEntity, candidate.signalFamily),
    );
    const evidenceRefs = structuralCandidate?.evidenceRefs.length
      ? structuralCandidate.evidenceRefs
      : [sourceObject.id];
    const confidenceCeiling = structuralCandidate?.confidence ?? 50;

    return {
      proposalId: shortHash(`v3:${profile.profileKey}:${candidate.id}`),
      sourceSummaryRefs: [sourceObject.id],
      sourceCandidateRef: candidate.id,
      candidateOrigin: candidate.origin,
      modelProfileKey: profile.profileKey,
      redactionProvenance: input.redactionProvenance,
      targetSignalFamily: candidate.signalFamily,
      targetEntity: candidate.targetEntity,
      reviewState: "needs_review" as const,
      confidence: Math.min(
        candidate.confidence,
        sourceObject.parseConfidence,
        confidenceCeiling,
      ),
      evidenceRefs,
      mappingRationale: [
        candidate.rationale,
        structuralCandidate
          ? "A deterministic structural candidate grounds this advisory route."
          : "No matching deterministic route exists; human evidence review is required.",
      ],
      missingEvidence: structuralCandidate
        ? []
        : [
            {
              gapId: `grounding:${sourceObject.id}`,
              missingSignalNote:
                "Confirm the proposed entity and signal family against source semantics.",
            },
          ],
      forbiddenCapabilityRefs: [...V3_SOURCE_PROPOSAL_FORBIDDEN_CAPABILITIES],
    };
  });

  if (proposals.some((proposal) => proposal === null)) {
    return {
      status: "evidence_failure",
      reason: "unknown_source_object",
      proposals: [],
      mappingCandidates: [],
      promptPreview: overlay.promptPreview,
      audit: overlay.audit,
    };
  }

  const parsed = sourceToSignalProposalBundleSchema.array().safeParse(proposals);
  if (!parsed.success) {
    return {
      status: "schema_failure",
      reason: "proposal_contract_failure",
      proposals: [],
      mappingCandidates: [],
      promptPreview: overlay.promptPreview,
      audit: overlay.audit,
    };
  }

  return {
    status: "produced",
    reason: null,
    proposals: parsed.data,
    mappingCandidates: overlay.candidates,
    promptPreview: overlay.promptPreview,
    audit: overlay.audit,
  };
}

function routeKey(sourceObjectId: string, targetEntity: string, signalFamily: string): string {
  return `${sourceObjectId}:${targetEntity}:${signalFamily}`;
}

function failed(
  status: Exclude<SourceToSignalProposerStatus, "produced">,
  reason: string,
): SourceToSignalProposerResult {
  return {
    status,
    reason,
    proposals: [],
    mappingCandidates: [],
    promptPreview: null,
    audit: [],
  };
}

function fromOverlayFailure(overlay: AiOverlayResult): SourceToSignalProposerResult {
  return {
    status: overlay.status,
    reason: overlay.reason,
    proposals: [],
    mappingCandidates: [],
    promptPreview: overlay.promptPreview,
    audit: overlay.audit,
  };
}
